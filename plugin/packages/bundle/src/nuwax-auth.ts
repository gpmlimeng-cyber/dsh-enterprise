/**
 * [INPUT]: 依赖 Node 全局 `fetch`/`AbortController`/`Buffer`、`node:crypto` 的 `randomUUID`、`node:fs` 的 `mkdirSync`/`readFileSync`/`renameSync`/`rmSync`/`writeFileSync`、`node:path` 的 `dirname`/`join`、platform-client 的 `resolveEnterpriseDshHome`（与官方 `dsh-home-paths` 同一套 `显式 → $DSH_HOME → ~/.dsh` 优先级），以及本包 `./account-origin.js` 的 `normalizeAccountOrigin`（origin 六条规则**只有那一份**，这里不写第二套）
 * [OUTPUT]: 对外提供插件侧 NUWAX 员工登录认证的五件事：`normalizeNuwaxOrigin`/`resolveNuwaxOrigin`（部署配置 → 平台 origin）、`loginNuwaxAccount`（口令登录 → 一次冻结的 `NuwaxSession`，**会话自带签发它的 `origin`**）、`createNuwaxSessionHolder`（会话持有：`login`/`logout`/`status`/`current`/`serviceOrigin`，**并在进程启动时从落盘件恢复**）、`nuwaxSessionStatePath`/`NUWAX_SESSION_STATE_FILENAME`/`NUWAX_SESSION_STATE_KEYS`/`NUWAX_PRINCIPAL_STATE_KEYS`（落盘坐标与冻结键集，测试与运维按它取证），以及封闭稳定码 `NuwaxAuthErrorCode` 与只带码的 `NuwaxAuthError`
 * [POS]: bundle 的**插件侧员工登录内核**（口径 29：企业后台换成 NUWAX、账号面走员工自己的 NUWAX 账号）——只碰 HTTP 与本机文件系统：**不写日志、不碰 UI**。本机路由只回**派生的** `principal`/`expiresAt` 与 `serviceOrigin`（部署配置决议出的服务地址）——票据绝不回到浏览器。
 *   ★`NuwaxSession.origin` 是**取数面**的红线（口径 31 的 `esc-route.ts` 消费它）：票据只发回签发它的那一台，
 *   绝不按"当前配置"重新决议——否则配置一改，员工的票据就被交给第二个域。**恢复出来的会话带的是落盘时那个
 *   origin**，同样绝不按重启后的新配置重算（这一条正是本刀持久化最容易写错的地方，故有专门的反锁）。
 *   ★三处与 `skill-online.ts` 那个公开取数面**刻意不同**，别照抄：① **带凭据**（这里是登录本身，凭据就是员工刚输入的口令）；② **单源、不跟随重定向**（平台只有这一个 origin，3xx 一律当协议错误，绝不把口令交给第二个域）；③ 上限/超时是**本文件自己的常量**（登录响应 <1 KB，与公开源那几个 MiB 级上限不同义）。
 *   ★**本刀的落盘纪律**（与 `skill-install.ts`/`preset/authorization.ts` 那两份同构：0o700 目录 + 0o600 文件 + 临时件 rename 原子落）：
 *   ① 落点 `<dshHome>/enterprise/nuwax-session.json`（经 `resolveEnterpriseDshHome()`，故它天然在 `.gitignore` 覆盖的 `$DSH_HOME` 之下）；
 *   ② 只写**冻结四键** `{expiresAt, origin, principal, ticket}`（`principal` 再冻结四键），**口令一个字节都不写**——没有托管口令就没有自动续期的正当性，故不做后台重登；
 *   ③ 读回来一律 fail-closed 成**无凭据**（崩掉、形状不对、键集多一个少一个、origin 归一化不过、已过期）：**绝不抛、绝不崩插件启动**，并顺手删掉那份坏状态；
 *   ④ `logout()` 连落盘件一起删（删不掉就抛 `ENT_NUWAX_SESSION_STATE_INVALID`——那不是降级取舍，是"退出登录形同虚设"）；
 *   ⑤ 与既有两条相反的一处**刻意差异**：`skill-install`/`preset/authorization` 读坏状态是**抛**（那是请求路径，得让人知道），
 *      这里读坏状态是**按没登录**（这是启动路径，抛就等于插件起不来）——差别只在"请求路径 vs 启动路径"。
 *   ★如实缺口（本刀**没有**做、也**不该**偷偷做的）：过期后不自动续期（续期要么重新输口令，要么先定凭据托管方案）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { normalizeAccountOrigin } from './account-origin.js'

/** 部署配置项：NUWAX 平台 origin。 */
export const NUWAX_ORIGIN_ENV = 'DSHENT_NUWAX_ORIGIN'

/**
 * 没配 `NUWAX_ORIGIN_ENV` 时的企业默认 origin（与 `account-origin.ts` 的 `DEFAULT_ACCOUNT_ORIGIN` 同一体裁：
 * 企业默认值进源码，部署可用环境变量覆盖）。把它设成**空串**即显式停用本能力（回落 `ENT_NUWAX_NOT_CONFIGURED`）。
 */
export const DEFAULT_NUWAX_ORIGIN = 'https://agent.sunoasis.com.cn'

/** 口令登录端点（实测 `POST {origin}/api/user/passwordLogin`；字段名是 `phone`，但它同收邮箱）。 */
export const NUWAX_LOGIN_PATH = '/api/user/passwordLogin'

/** 登录态自证端点（实测带 `ticket` cookie 取当前账号）。 */
export const NUWAX_LOGIN_INFO_PATH = '/api/user/getLoginInfo'

/** 单次请求超时：覆盖「拿到响应头 + 读完正文」全程。 */
export const NUWAX_REQUEST_TIMEOUT_MS = 15_000

/** 单个响应正文上限（登录响应实测 <1 KB；这条挡的是"平台回了一个巨型正文"）。 */
export const NUWAX_MAX_RESPONSE_BYTES = 262_144

/** 账号形状上限（登录表单实际远小于此；只用来挡住畸形输入）。 */
export const NUWAX_MAX_ACCOUNT_LENGTH = 320

/** 口令形状上限（同上；**不**用长度去判断口令强度，那是平台的事）。 */
export const NUWAX_MAX_PASSWORD_LENGTH = 1024

/**
 * 平台**没给**任何过期信息时的兜底会话时长：宁短不长 —— 过期即如实要求重登，
 * 绝不让一枚可能已被平台吊销的票据在本机一直"看起来有效"。
 */
export const NUWAX_FALLBACK_SESSION_TTL_MS = 10 * 60 * 1000

/** 平台时间戳的解释时区：平台是境内服务，`expireDate` 按其本地时间（UTC+8）读。 */
const PLATFORM_TIME_OFFSET_HOURS = 8

/** 会话时长上限（超过一律按兜底时长处理：平台给的过期时间荒谬时不跟着荒谬）。 */
const MAX_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 平台业务成功码（实测）。 */
const PLATFORM_SUCCESS_CODE = '0000'

/** 平台"用户不存在或密码错误"码（实测；与"平台拒绝"分开，因为下一步不同）。 */
const PLATFORM_INVALID_CREDENTIAL_CODE = '0001'

/** 本机稳定码（与 platform-client 的 `enterpriseLocalErrorStatus` 一一对应，那里是唯一一张码→HTTP 状态表）。 */
export type NuwaxAuthErrorCode =
  | 'ENT_NUWAX_NOT_CONFIGURED'
  | 'ENT_NUWAX_INVALID_CREDENTIALS'
  | 'ENT_NUWAX_REJECTED'
  | 'ENT_NUWAX_UNAVAILABLE'
  | 'ENT_NUWAX_TIMEOUT'
  | 'ENT_NUWAX_PROTOCOL'
  /** 本刀新增：登录态**落盘件**的形状/写/删失败（读到坏形状**不**用它——启动路径一律按没凭据，删掉坏件）。 */
  | 'ENT_NUWAX_SESSION_STATE_INVALID'

/** 各码的固定人话（**绝不**拼进平台原文：平台响应里可能有我们不该外传的东西）。 */
const ERROR_MESSAGES: Record<NuwaxAuthErrorCode, string> = {
  ENT_NUWAX_NOT_CONFIGURED: 'NUWAX 平台地址未配置',
  ENT_NUWAX_INVALID_CREDENTIALS: 'NUWAX 账号或口令不正确',
  ENT_NUWAX_REJECTED: 'NUWAX 平台拒绝了这次登录',
  ENT_NUWAX_UNAVAILABLE: '连不上 NUWAX 平台',
  ENT_NUWAX_TIMEOUT: 'NUWAX 平台响应超时',
  ENT_NUWAX_PROTOCOL: 'NUWAX 平台返回了无法解析的响应',
  ENT_NUWAX_SESSION_STATE_INVALID: 'NUWAX 登录态无法保存到本机',
}

/**
 * 只携带稳定码的认证失败。
 *
 * ★安全红线（有测试锁）：消息里**不放**口令、不放票据、不放平台原文、不放请求 URL 的查询串；
 * 平台码经过 {@link sanitizePlatformCode} 净化后才允许出现在消息里（它只是"哪一个业务码"，不是自由文本）。
 */
export class NuwaxAuthError extends Error {
  constructor(
    readonly code: NuwaxAuthErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'NuwaxAuthError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

/** 认证主体（`/api/user/getLoginInfo` 的受控投影）。 */
export interface NuwaxPrincipal {
  readonly uid: number
  readonly userName: string
  readonly nickName: string
  readonly tenantId: number
}

/** 一次登录换来的会话：票据 + 过期时刻 + 主体 + **签发它的那台 origin**。 */
export interface NuwaxSession {
  readonly ticket: string
  readonly expiresAt: number
  readonly principal: NuwaxPrincipal
  /**
   * **签发这枚票据的那一个 origin**（登录当时决议出来的那一台）。
   *
   * ★这是一条红线：票据只能发回**签发它的这一台**。后续任何带票据的取数（本仓目前是 `esc-route.ts`
   * 那条只读代理）都必须用它，**不许**按"当前配置"重新决议一次——配置若在登录之后被指到另一个域，
   * 重新决议就等于把员工的票据交给第二个域，而那正是登录面用 `redirect: 'manual'` 挡掉的那件事。
   */
  readonly origin: string
}

/** 对界面可见的登录态（**不含票据**）。 */
export interface NuwaxAuthStatus {
  readonly state: 'signed-in' | 'signed-out'
  readonly principal?: NuwaxPrincipal
  readonly expiresAt?: number
}

/** 认证依赖：`fetch` 与时钟都可注入（测试不许打真网）。 */
export interface NuwaxAuthDependencies {
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>
  /** 部署配置来源（默认 `process.env`）；只读 `NUWAX_ORIGIN_ENV` 一个键。 */
  readonly env?: Record<string, string | undefined> | undefined
  /** 时钟（默认 `Date.now`）。 */
  readonly now?: (() => number) | undefined
  /** 覆盖单次请求超时（测试用）。 */
  readonly timeoutMs?: number | undefined
  /** 覆盖响应正文上限（测试用）。 */
  readonly maxBytes?: number | undefined
  /** 落点覆盖（测试用；缺省走 `resolveEnterpriseDshHome()` 的 `显式 → $DSH_HOME → ~/.dsh` 优先级）。 */
  readonly dshHome?: string | undefined
}

/** 会话持有者（本机路由端口直接用它；没有第二份登录态真源）。 */
export interface NuwaxSessionHolder {
  /** 当前登录态（过期即算登出）。 */
  status(): NuwaxAuthStatus
  /** 当前可用会话（过期 / 未登录 ⇒ `undefined`）；票据只交给宿主内部调用方。 */
  current(): NuwaxSession | undefined
  /** 用员工自己的 NUWAX 账号登录；并发调用复用同一次登录（不重复打平台）。 */
  login(account: string, password: string): Promise<NuwaxAuthStatus>
  /**
   * 登出：丢弃**进程内**与**落盘件**两处会话（无网络调用 —— 平台的登出会把别的端也踢下线，本刀**不做**）。
   *
   * ★删不掉落盘件就抛 `ENT_NUWAX_SESSION_STATE_INVALID`：否则下次启动会把票据恢复回来，"退出登录"形同虚设。
   */
  logout(): void
  /**
   * 部署配置决议出的 NUWAX **服务地址**（登录实际打的那一台；界面用它显示「登录到哪台」）。
   *
   * ★与 `login()` 的分工：`login()` 里决议失败是**必须失败**（绝不悄悄打到默认域）；
   * 而这里只是给界面一个只读投影，配置缺席/非法一律回 `undefined`（不抛），由界面画占位。
   * ★回的是**地址不是凭据**：票据永远不出现在这条投影里。
   */
  serviceOrigin(): string | undefined
}

/**
 * 把一个部署配置值规范化成 NUWAX origin。
 *
 * 六条地址规则**复用** `account-origin.ts` 的 `normalizeAccountOrigin`（绝对 HTTP(S)、`http:` 只放行回环、
 * 不带 userinfo/path/query/fragment、大小写与默认端口归一）—— 唯一分歧是**空值语义相反**：
 * 账户后台的空白是"回落到企业默认"，而 NUWAX origin 的空白是**显式停用**（`ENT_NUWAX_NOT_CONFIGURED`），
 * 故空串在本函数里先被拦下，非空才交给那份共用实现。
 *
 * @param value - 配置读出的地址。
 * @returns 归一化后的 `protocol//host[:port]`。
 * @throws {NuwaxAuthError} 空白或形状非法（码都是 `ENT_NUWAX_NOT_CONFIGURED`：部署配置问题，不是用户输入问题）。
 */
export function normalizeNuwaxOrigin(value: string): string {
  if (value.trim().length === 0) {
    throw new NuwaxAuthError('ENT_NUWAX_NOT_CONFIGURED', `${NUWAX_ORIGIN_ENV} is empty`)
  }
  try {
    return normalizeAccountOrigin(value)
  } catch (error) {
    throw new NuwaxAuthError('ENT_NUWAX_NOT_CONFIGURED', `${NUWAX_ORIGIN_ENV} is not a usable origin`, error)
  }
}

/**
 * 从部署配置决议 NUWAX origin。
 *
 * 三条规则：① 没设 ⇒ 用 {@link DEFAULT_NUWAX_ORIGIN}（开箱可用）；② 设成空白 ⇒ 显式停用（503 讲真话）；
 * ③ 设了但形状非法 ⇒ 同样 fail-closed（**绝不**悄悄回落到默认域 —— 那会把口令发到一个用户没指定的地方）。
 *
 * @param env - 配置来源（默认 `process.env`）。
 * @returns 归一化后的 origin。
 * @throws {NuwaxAuthError} `ENT_NUWAX_NOT_CONFIGURED`。
 */
export function resolveNuwaxOrigin(env: Record<string, string | undefined> = process.env): string {
  const configured = env[NUWAX_ORIGIN_ENV]
  if (configured === undefined) return normalizeNuwaxOrigin(DEFAULT_NUWAX_ORIGIN)
  return normalizeNuwaxOrigin(configured)
}

/**
 * 用员工自己的账号/口令换一枚 NUWAX 会话：口令登录 → 拿票据 → 用票据自证并取主体。
 *
 * 顺序固定、任一步失败即终止（**不**在没有票据的情况下继续下一步）：
 * ① `POST /api/user/passwordLogin`（`{phone, password}`）→ 平台码 + `Set-Cookie: ticket=…`；
 * ② `GET /api/user/getLoginInfo`（`Cookie: ticket=…`）→ 主体；
 * ③ 过期时刻优先取票据 cookie 的 `Max-Age`（时区无关），否则按平台 `expireDate`（UTC+8），
 *    都没有就按 {@link NUWAX_FALLBACK_SESSION_TTL_MS} 兜底。
 *
 * @param account - 员工输入的 NUWAX 账号（平台字段名是 `phone`，实测同收邮箱）。
 * @param password - 员工输入的口令（只在本次请求体内出现，不缓存、不进日志）。
 * @param deps - `fetch`/时钟/上限，见 {@link NuwaxAuthDependencies}。
 * @returns 一次冻结的会话。
 * @throws {NuwaxAuthError} 六枚稳定码之一。
 */
export async function loginNuwaxAccount(
  account: string,
  password: string,
  deps: NuwaxAuthDependencies & { readonly origin: string },
): Promise<NuwaxSession> {
  const origin = normalizeNuwaxOrigin(deps.origin)
  assertCredentialShape(account, password)
  const now = deps.now ?? Date.now
  const timeoutMs = deps.timeoutMs ?? NUWAX_REQUEST_TIMEOUT_MS
  const maxBytes = deps.maxBytes ?? NUWAX_MAX_RESPONSE_BYTES

  const loginResponse = await send(deps.fetch, `${origin}${NUWAX_LOGIN_PATH}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ phone: account, password }),
  }, timeoutMs, maxBytes)
  const loginEnvelope = parseEnvelope(loginResponse.bytes)
  requirePlatformSuccess(loginEnvelope.code)
  const cookie = readTicketCookie(readSetCookies(loginResponse.response))
  const ticket = cookie?.ticket ?? readOptionalString(loginEnvelope.data, 'token')
  if (ticket === undefined || ticket.length === 0) {
    throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform answered a successful login without a ticket')
  }

  const infoResponse = await send(deps.fetch, `${origin}${NUWAX_LOGIN_INFO_PATH}`, {
    method: 'GET',
    headers: { accept: 'application/json', cookie: `ticket=${ticket}` },
  }, timeoutMs, maxBytes)
  const infoEnvelope = parseEnvelope(infoResponse.bytes)
  requirePlatformSuccess(infoEnvelope.code)
  const principal = readPrincipal(infoEnvelope.data)

  return {
    ticket,
    expiresAt: resolveExpiry(cookie?.maxAgeMs, infoEnvelope.data?.['expireDate'] ?? loginEnvelope.data?.['expireDate'], now()),
    principal,
    // 记住"这枚票据是哪一台签发的"：后续带票据的取数必须用它，绝不按当前配置重新决议。
    origin,
  }
}

/** 落盘根目录段（`<dshHome>/enterprise/`，与本仓另两份状态文件同一层）。 */
const NUWAX_SESSION_STATE_DIR_SEGMENTS: readonly string[] = ['enterprise']

/** 落盘文件名（自取但必须能表达「NUWAX 会话」；扩展名与另两份 JSON 状态文件同族）。 */
export const NUWAX_SESSION_STATE_FILENAME = 'nuwax-session.json'

/**
 * 落盘**冻结四键**（已按字典序排好，直接拿去做逐字比对）。
 *
 * ★多一个键或少一个键即判「无凭据」：这张文件是磁盘输入，只有形状封闭才能挡住别人往里塞 `password`/`cookie`
 * 这类我们**从不写**的字段后再被某段代码读出来当凭据。
 */
export const NUWAX_SESSION_STATE_KEYS = 'expiresAt,origin,principal,ticket'

/** 落盘主体的**冻结四键**（同上，逐字比对用）。 */
export const NUWAX_PRINCIPAL_STATE_KEYS = 'nickName,tenantId,uid,userName'

/** 票据形状上限：只用来挡住「这不是一枚票据」的超长串，不是对平台票面长度的断言。 */
const NUWAX_MAX_TICKET_LENGTH = 4096

/**
 * 落盘坐标：`<dshHome>/enterprise/nuwax-session.json`。
 *
 * 走 `resolveEnterpriseDshHome()`（与 `skill-install.ts`/`preset/authorization.ts` 同一份真源、同一套
 * `显式 → $DSH_HOME → ~/.dsh` 优先级），因此落点天然位于 `.gitignore` 覆盖的 `$DSH_HOME` 之下——不需要改
 * 任何排除规则，也不会有任何一条路径把票据带进 git。
 *
 * @param options - 可选 `dshHome` 覆盖与 `env` 配置来源（默认 `process.env`）。
 * @returns 绝对路径。
 */
export function nuwaxSessionStatePath(
  options: { readonly dshHome?: string | undefined; readonly env?: Record<string, string | undefined> | undefined } = {},
): string {
  // ★exactOptionalPropertyTypes：可选属性**不能**显式传 `undefined`，
  //   故缺席的键一律不出现（而不是传 undefined）——语义相同，类型也对。
  const home = resolveEnterpriseDshHome({
    ...(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    env: options.env ?? process.env,
  })
  return join(home, ...NUWAX_SESSION_STATE_DIR_SEGMENTS, NUWAX_SESSION_STATE_FILENAME)
}

/**
 * 读回一次落盘的会话（启动时恢复登录态的唯一入口）。
 *
 * 六种情况**一律**按「没有凭据」处理并**顺手删掉那份状态**，绝不抛、绝不让插件起不来：
 * 文件不存在 / 读不到（权限、目录不是文件）/ 不是 JSON / 不是对象 / 键集不精确 / 字段形状非法（含 origin
 * 归一化不过）/ 已过期。★这是与 `skill-install.ts`、`preset/authorization.ts` 那两处**刻意相反**的一处：
 * 它们在请求路径上读坏状态要抛（让人知道），这里在**启动路径**上读坏状态只能按没登录（抛就等于整个插件起不来）。
 *
 * ★过期即失效：绝不拿一枚已过期的票据去打平台（那既是一次注定失败的网络往返，也让「过期」在链路上留痕）。
 *
 * @param options - `dshHome`/`env`（决定落点）。
 * @param now - 时钟（判过期用，默认 `Date.now`）。
 * @returns 仍有效的会话；无凭据（含过期/损坏）一律 `undefined`。
 */
function readPersistedSession(
  options: Pick<NuwaxAuthDependencies, 'dshHome' | 'env'>,
  now: () => number,
): NuwaxSession | undefined {
  const path = nuwaxSessionStatePath(options)
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    // 判据：只有「文件不在」才是正常的未登录态；读不到（权限/不是普通文件）同样按无凭据走——
    // 这两条都不值得让插件启动失败，但都**不是**「静默吞」：状态已被清掉，下次登录会重新写一份。
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') removePersistedSessionQuietly(path, 'unreadable')
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    // 判据：正文不是 JSON ⇒ 这份状态没有可解析的事实，按无凭据并删掉（绝不允许"半份状态"活下来）。
    removePersistedSessionQuietly(path, 'corrupt')
    return undefined
  }
  const session = readPersistedShape(parsed)
  if (session === undefined) {
    removePersistedSessionQuietly(path, 'shape')
    return undefined
  }
  if (now() >= session.expiresAt) {
    // 判据：过期票**不算凭据**（且必须删掉，否则每次启动都要重读一次过期事实）。
    removePersistedSessionQuietly(path, 'expired')
    return undefined
  }
  return session
}

/** 逐字收窄落盘形状（键集精确比对，字段逐个判型）；任一处不符即回 `undefined` 由调用方删文件。 */
function readPersistedShape(value: unknown): NuwaxSession | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  if (Object.keys(row).sort().join(',') !== NUWAX_SESSION_STATE_KEYS) return undefined
  const ticket = row['ticket']
  const origin = row['origin']
  const expiresAt = row['expiresAt']
  const principal = row['principal']
  if (typeof ticket !== 'string' || ticket.length === 0 || ticket.length > NUWAX_MAX_TICKET_LENGTH) return undefined
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= 0) return undefined
  if (typeof origin !== 'string' || origin.trim().length === 0) return undefined
  if (typeof principal !== 'object' || principal === null || Array.isArray(principal)) return undefined
  const profile = principal as Record<string, unknown>
  if (Object.keys(profile).sort().join(',') !== NUWAX_PRINCIPAL_STATE_KEYS) return undefined
  const uid = profile['uid']
  const userName = profile['userName']
  const nickName = profile['nickName']
  const tenantId = profile['tenantId']
  if (typeof uid !== 'number' || !Number.isInteger(uid) || uid <= 0) return undefined
  if (typeof userName !== 'string' || userName.length === 0) return undefined
  if (typeof nickName !== 'string' || nickName.length === 0) return undefined
  if (typeof tenantId !== 'number' || !Number.isInteger(tenantId) || tenantId < 0) return undefined
  // 落盘 origin 必须仍是**可归一化的 origin**：坏形状说明这份状态不是我们写的（或被人手改过），
  // 按无凭据处理 —— 绝不把一串来路不明的 origin 当成"票据该发回去的那一台"。
  try {
    return { ticket, expiresAt, principal: { uid, userName, nickName, tenantId }, origin: normalizeAccountOrigin(origin) }
  } catch {
    return undefined
  }
}

/**
 * 原子落盘一次会话：同目录临时件 + rename（与 `skill-install.ts` 的已装清单、`preset/authorization.ts` 的授权
 * 状态**同一套纪律**：0o700 目录 + 0o600 文件 + 临时件）。
 *
 * ★写出去的正文是**逐字四键** `{expiresAt, origin, principal, ticket}`：`password` 在这个对象里**不存在**
 * （不是被删掉，是从源头就没有那个字段），源码级反锁见 `tests/nuwax-auth.spec.ts`。
 *
 * @param session - 刚拿到的那一次会话（含**签发时**的 `origin`）。
 * @param options - `dshHome`/`env`（决定落点）。
 * @throws {NuwaxAuthError} `ENT_NUWAX_SESSION_STATE_INVALID`：落盘失败（临时件已清，绝不留半份状态）。
 */
function writePersistedSession(session: NuwaxSession, options: Pick<NuwaxAuthDependencies, 'dshHome' | 'env'>): void {
  const path = nuwaxSessionStatePath(options)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileSync(temporary, JSON.stringify({
      ticket: session.ticket,
      expiresAt: session.expiresAt,
      // ★原样写签发时那台：恢复出来绝不能按重启后的新配置重算（票据只发回签发它的那一台）。
      origin: session.origin,
      principal: { ...session.principal },
    }), { encoding: 'utf8', mode: 0o600 })
    renameSync(temporary, path)
  } catch (error) {
    // 判据：临时件已尽力清掉（清不掉也不改判：它带随机后缀、mode 0o600、且下一轮写会覆盖同名空间）；
    // 真正不能降级的是**「登录成功却没持久化」**这件事——那会让员工以为重启后仍在登录态，所以抛稳定码。
    try {
      rmSync(temporary, { force: true })
    } catch {
      // 清理失败不改变判决（上面抛的那枚码才是给调用方的真话）。
    }
    throw new NuwaxAuthError('ENT_NUWAX_SESSION_STATE_INVALID', 'the nuwax session could not be persisted', error)
  }
}

/**
 * 删掉落盘件（`logout()` 的磁盘那一半）。
 *
 * ★删不掉就**抛**：留着这份文件就等于下次启动把票据恢复回来，"退出登录"形同虚设——这不是可以吞掉的降级取舍。
 *
 * @param options - `dshHome`/`env`（决定落点）。
 * @throws {NuwaxAuthError} `ENT_NUWAX_SESSION_STATE_INVALID`。
 */
function removePersistedSession(options: Pick<NuwaxAuthDependencies, 'dshHome' | 'env'>): void {
  const path = nuwaxSessionStatePath(options)
  try {
    rmSync(path, { force: true })
  } catch (error) {
    throw new NuwaxAuthError('ENT_NUWAX_SESSION_STATE_INVALID', 'the persisted nuwax session could not be removed', error)
  }
}

/**
 * 恢复路径上的删除（读不到/损坏/形状不对/已过期四种情况共用）。
 *
 * ★与 {@link removePersistedSession} 的差别是**故意的判据**：那四条路径的结论已经是「没有凭据」，
 * 此时删不掉只是让这份坏状态留到下一次启动再被同样判一次——不改变任何结论，故按 best-effort 吞掉。
 * 而 `logout()` 是**用户明确要求结束登录**，删不掉必须让人知道。
 *
 * @param path - 已知路径（避免重算落点）。
 * @param reason - 判据标签：调用方在 catch 前已按它判过一次结论，这里只保证「四种坏状态一定尝试过删除」这一事实可被读到。
 */
function removePersistedSessionQuietly(path: string, reason: 'unreadable' | 'corrupt' | 'shape' | 'expired'): void {
  try {
    rmSync(path, { force: true })
  } catch {
    // 判据（`reason` 即本分支的判据标签）：结论已经是「没有凭据」，删除失败不改变它——best-effort，不是静默吞掉一次失败判定。
    void reason
  }
}

/**
 * 造一个会话持有者。
 *
 * 六条语义（都有测试锁）：① **单飞** —— 并发 `login()` 复用同一次平台调用；② **失败不缓存** ——
 * 失败原样抛出且下一次 `login()` 会重新打平台；③ **过期即登出** —— 不做后台续期（没有托管口令就没有续期的正当性）；
 * ④ **登出不复活** —— `logout()` 之后到达的登录结果被丢弃（与 `platform-credentials.ts` 的会话代次纪律同源）；
 * ⑤ **启动即恢复** —— 构造时从 `<dshHome>/enterprise/nuwax-session.json` 读回上一次那枚会话（**连它签发时的
 *    `origin` 一起**），读不到/坏了/已过期一律按未登录；⑥ **登出连盘一起清** —— 否则"退出登录"只在本次进程内成立。
 *
 * origin 仍在**首次登录时**才决议（部署配置缺失/非法不该拖垮插件启动，且每次登录都读当前配置）；
 * ★但**恢复路径不走这个决议**：落盘件里的 `origin` 就是那枚票据的归属地（见 {@link NuwaxSession.origin} 那条红线）。
 *
 * @param deps - `fetch`/时钟/上限/配置来源/落点；`origin` 给了就用它（测试与显式部署都走这条）。
 * @returns 会话持有者。
 */
export function createNuwaxSessionHolder(
  deps: NuwaxAuthDependencies & { readonly origin?: string | undefined },
): NuwaxSessionHolder {
  const now = deps.now ?? Date.now
  let session: NuwaxSession | undefined = readPersistedSession(deps, now)
  let inflight: Promise<NuwaxAuthStatus> | undefined
  /** 会话代次：`logout()` 递增；只增不减，用来丢掉迟到结果。 */
  let generation = 0

  const live = (): NuwaxSession | undefined => {
    if (session === undefined) return undefined
    if (now() >= session.expiresAt) {
      session = undefined
      // 过期即失效：顺手把那份落盘件也清掉（否则下次启动还要重读一次过期事实才丢弃）。
      // ★这处删除是 **best-effort**：结论已经是"没登录"，删不掉不改变任何结果，故不抛（同 readPersistedSession 那条判据）。
      removePersistedSessionQuietly(nuwaxSessionStatePath(deps), 'expired')
      return undefined
    }
    return session
  }

  const status = (): NuwaxAuthStatus => {
    const current = live()
    return current === undefined
      ? { state: 'signed-out' }
      : { state: 'signed-in', principal: current.principal, expiresAt: current.expiresAt }
  }

  /**
   * 只读服务地址投影：**读不到不是错误**（`status()` 那条路不该因为部署配置缺席而变成失败），
   * 故这里的 catch 是刻意的、且只回 `undefined`——绝不回落到任何别的地址。
   */
  const serviceOrigin = (): string | undefined => {
    try {
      return deps.origin ?? resolveNuwaxOrigin(deps.env)
    } catch {
      return undefined
    }
  }

  const run = async (account: string, password: string): Promise<NuwaxAuthStatus> => {
    const startedAt = generation
    const origin = deps.origin ?? resolveNuwaxOrigin(deps.env)
    const fresh = await loginNuwaxAccount(account, password, { ...deps, origin, now })
    // 登录期间发生过登出：这次结果属于上一个会话代次，丢弃（绝不复活已登出的凭据）。
    if (generation !== startedAt) return status()
    // 先落盘再对外宣称已登录：写失败要如实抛（`ENT_NUWAX_SESSION_STATE_INVALID`），不能让员工以为
    // "下次重启也在"而其实没存住。反过来"先宣称后落盘"则会在写失败时留下一句骗人的话。
    writePersistedSession(fresh, deps)
    session = fresh
    return status()
  }

  return {
    status,
    current: live,
    serviceOrigin,
    async login(account: string, password: string): Promise<NuwaxAuthStatus> {
      if (inflight !== undefined) return inflight
      const task = run(account, password)
      inflight = task
      try {
        return await task
      } finally {
        if (inflight === task) inflight = undefined
      }
    },
    logout(): void {
      generation += 1
      session = undefined
      // ★顺序固定：先清内存、再删盘（删失败会抛，那枚码就是"这次退出没成功"的真话）。
      removePersistedSession(deps)
    },
  }
}

/**
 * 账号/口令形状门禁（只判"像不像一次登录输入"，不判强度）。
 *
 * 形状问题抛 `TypeError`（与既有各本机路由同一个约定 ⇒ `enterpriseLocalErrorStatus` 判 400）：
 * "空口令"是**请求不合法**，不是"凭据不对"（后者要真的问过平台才算）。
 */
function assertCredentialShape(account: string, password: string): void {
  if (account.length === 0 || account.length > NUWAX_MAX_ACCOUNT_LENGTH) {
    throw new TypeError('the account must be a non-empty string within the length limit')
  }
  if (password.length === 0 || password.length > NUWAX_MAX_PASSWORD_LENGTH) {
    throw new TypeError('the password must be a non-empty string within the length limit')
  }
}

/** 一次带超时与上限的请求；**不跟随重定向**（3xx 一律协议错误，绝不把凭据交给第二个域）。 */
async function send(
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ readonly response: Response; readonly bytes: Buffer }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetchImpl(url, { ...init, redirect: 'manual', signal: controller.signal })
    } catch (error) {
      throw transportError(error)
    }
    if (response.status >= 300 && response.status < 400) {
      await cancelBody(response)
      throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform redirected the login request')
    }
    if (response.status >= 500) {
      await cancelBody(response)
      throw new NuwaxAuthError('ENT_NUWAX_UNAVAILABLE', `the platform answered HTTP ${response.status}`)
    }
    if (response.status !== 200) {
      await cancelBody(response)
      throw new NuwaxAuthError('ENT_NUWAX_REJECTED', `the platform answered HTTP ${response.status}`)
    }
    return { response, bytes: await readBoundedBytes(response, maxBytes) }
  } finally {
    clearTimeout(timer)
  }
}

/** 有界读正文：声明超限即早退，读的过程中超限立刻放弃（不是读完整段再判）。 */
async function readBoundedBytes(response: Response, limit: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    await cancelBody(response)
    throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform response declares more bytes than the limit')
  }
  const body = response.body
  if (body === null) throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform answered without a body')
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    for (;;) {
      const step = await reader.read()
      if (step.done === true) break
      const chunk = step.value
      if (chunk === undefined) continue
      total += chunk.byteLength
      if (total > limit) {
        await reader.cancel().catch(() => undefined)
        throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform response is larger than the limit')
      }
      chunks.push(Buffer.from(chunk))
    }
  } catch (error) {
    if (error instanceof NuwaxAuthError) throw error
    throw transportError(error)
  }
  return Buffer.concat(chunks)
}

/** 把传输层异常收敛成稳定码（超时与不可达分开，界面给的下一步不同）。 */
function transportError(error: unknown): NuwaxAuthError {
  if (error instanceof NuwaxAuthError) return error
  if (isAbortError(error)) return new NuwaxAuthError('ENT_NUWAX_TIMEOUT', 'the platform request timed out', error)
  return new NuwaxAuthError('ENT_NUWAX_UNAVAILABLE', 'the platform request failed', error)
}

/** `AbortController.abort()` 在不同运行时抛 `AbortError`（名字固定）；只按名字判，不 import 运行时私有类型。 */
function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/** 主动放掉一个我们不读的正文（避免连接被吊住）；失败无所谓，绝不因此改判。 */
async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // 放不掉就算了：这条路径只发生在"我们已经决定拒绝"之后，取消失败不改变判决。
  }
}

/** 平台信封：`{code, message, data}`；`code` 数字/字符串都收，其余一切都当不存在。 */
interface PlatformEnvelope {
  readonly code: string
  readonly data: Record<string, unknown> | undefined
}

/** 解析平台信封；正文不是 JSON 对象 / 没有 `code` ⇒ 协议错误。 */
function parseEnvelope(bytes: Buffer): PlatformEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform answered a body that is not JSON', error)
  }
  const record = asRecord(parsed)
  const raw = record?.['code']
  const code = typeof raw === 'string' ? raw : typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : undefined
  if (record === undefined || code === undefined) {
    throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform answered without a business code')
  }
  return { code, data: asRecord(record['data']) }
}

/** 平台码闸门：`0000` 放行；`0001`（实测"用户不存在或密码错误"）判"凭据不对"；其余一律"平台拒绝"。 */
function requirePlatformSuccess(code: string): void {
  if (code === PLATFORM_SUCCESS_CODE) return
  if (code === PLATFORM_INVALID_CREDENTIAL_CODE) {
    throw new NuwaxAuthError('ENT_NUWAX_INVALID_CREDENTIALS', ERROR_MESSAGES.ENT_NUWAX_INVALID_CREDENTIALS)
  }
  throw new NuwaxAuthError('ENT_NUWAX_REJECTED', `${ERROR_MESSAGES.ENT_NUWAX_REJECTED}（${sanitizePlatformCode(code)}）`)
}

/** 平台码净化：只留 `[A-Za-z0-9_-]`、最长 32；其余一律 `unknown`（**绝不让平台自由文本进错误消息**）。 */
function sanitizePlatformCode(value: string): string {
  return /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : 'unknown'
}

/** 取 `Set-Cookie` 列表（优先 `getSetCookie()`，回退单值 `get()`）。 */
function readSetCookies(response: Response): readonly string[] {
  const bag = response.headers as unknown as { getSetCookie?: () => readonly string[] }
  if (typeof bag.getSetCookie === 'function') {
    const list = bag.getSetCookie()
    if (Array.isArray(list) && list.length > 0) return list
  }
  const single = response.headers.get('set-cookie')
  return single === null || single.length === 0 ? [] : [single]
}

/** 从 cookie 串里取 `ticket`（顺带取 `Max-Age` 秒数 —— 它是时区无关的那一份过期信息）。 */
function readTicketCookie(cookies: readonly string[]): { readonly ticket: string; readonly maxAgeMs: number | undefined } | undefined {
  for (const cookie of cookies) {
    const match = /(?:^|;\s*)ticket=([^;]+)/.exec(cookie)
    const ticket = match?.[1]
    if (ticket === undefined || ticket.length === 0) continue
    const maxAge = /(?:^|;\s*)max-age=(\d+)/i.exec(cookie)
    const seconds = maxAge === null ? undefined : Number(maxAge[1])
    return {
      ticket,
      maxAgeMs: seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined,
    }
  }
  return undefined
}

/** 取主体：`uid`（回退 `id`）必须是正数，两个名字必须非空；缺一个即协议错误。 */
function readPrincipal(data: Record<string, unknown> | undefined): NuwaxPrincipal {
  const uid = readPositiveNumber(data, 'uid') ?? readPositiveNumber(data, 'id')
  const userName = readOptionalString(data, 'userName')
  const nickName = readOptionalString(data, 'nickName')
  if (uid === undefined || userName === undefined || nickName === undefined) {
    throw new NuwaxAuthError('ENT_NUWAX_PROTOCOL', 'the platform answered an incomplete login profile')
  }
  return { uid, userName, nickName, tenantId: readPositiveNumber(data, 'tenantId') ?? 0 }
}

/** 过期时刻决议：cookie `Max-Age` > 平台 `expireDate` > 兜底时长；荒谬值（已过期 / 超 30 天）一律兜底。 */
function resolveExpiry(maxAgeMs: number | undefined, expireDate: unknown, now: number): number {
  const cap = now + MAX_SESSION_TTL_MS
  const candidate = maxAgeMs !== undefined && maxAgeMs > 0 ? now + maxAgeMs : parsePlatformTimestamp(expireDate)
  if (candidate === undefined || candidate <= now || candidate > cap) return now + NUWAX_FALLBACK_SESSION_TTL_MS
  return candidate
}

/**
 * 读平台时间戳 `YYYY-MM-DD[ T]HH:mm:ss`（或只有日期）并按 UTC+8 解释。
 *
 * 为什么不是 `new Date(text)`：那个把无时区后缀的串按**运行环境本地时区**解释，同一份响应在不同机器上
 * 会算出不同的过期时刻。这里显式按平台本地时间（境内服务，UTC+8）换算，结果与机器时区无关。
 */
function parsePlatformTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(value.trim())
  if (dateTime !== null) {
    const millis = Date.UTC(
      Number(dateTime[1]), Number(dateTime[2]) - 1, Number(dateTime[3]),
      Number(dateTime[4]) - PLATFORM_TIME_OFFSET_HOURS, Number(dateTime[5]), Number(dateTime[6]),
    )
    return Number.isFinite(millis) ? millis : undefined
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly === null) return undefined
  const millis = Date.UTC(
    Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]),
    23 - PLATFORM_TIME_OFFSET_HOURS, 59, 59,
  )
  return Number.isFinite(millis) ? millis : undefined
}

/** 取一个非空字符串字段（空白串当不存在）。 */
function readOptionalString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = source?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

/** 取一个正数字段（数字或纯数字串都收）。 */
function readPositiveNumber(source: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = source?.[key]
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** 只认真对象的收窄（数组与 null 都不算）。 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
