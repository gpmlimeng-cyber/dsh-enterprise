/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、稳定码→状态码唯一映射 `enterpriseLocalErrorStatus` 与异常摘要串
 * [OUTPUT]: 对外提供 `GET /enterprise/api/v1/local/skills/discovered` 的注册函数 `registerEnterpriseSkillDiscoveryRoute`、端口契约 `EnterpriseSkillDiscoveryPort`、白名单投影 `projectDiscoveredSkills` + 逐键清单 `ENTERPRISE_DISCOVERED_SKILL_KEYS`、失败投影 `projectSkillDiscoveryFailure` 与唯一稳定码 `ENT_SKILL_DISCOVERY_UNAVAILABLE`
 * [POS]: bundle 的**官方发现面只读镜像**（口径 54）——与 `skill-route.ts`（企业技能目录镜像）、
 *   `skill-upload.ts`/`skill-system.ts`（本机写入口）并列的第三条只读面：它**不碰平台、不碰令牌**，
 *   只把宿主官方服务 `ctx.get('skills')` 的快照投影成浏览器能读的 `{data:{skills,complete}}`。
 *   ★**为什么要这一条**（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）：
 *   本仓原有两份"我们自己的记录"（企业中心 `installed.json` 与本机自装 `self-installed.json`），
 *   它们**必然与磁盘真值不一致**（真机取证：`~/.dsh/skills/` 上实有 7 枚技能，而企业那份记录只认 1 枚）
 *   —— "已安装"该怎么答，唯一有资格回答的是**官方自己的发现面**（它就是运行时真正加载的那一份）。
 *   ★三条硬口径：
 *   ① **只回白名单字段** —— `name`/`description`/`whenToUse?`/`invocation`/`source`/`provider`，
 *      **`path` 与 `resourceBase` 一律不出去**（那是宿主绝对路径，进了浏览器就是泄漏面；
 *      "来源"这件事由 `source` 这一枚枚举说清，不需要路径）；
 *   ② **服务缺席 / 快照抛错 / 快照读不懂 ⇒ 明确失败码**，**绝不静默回空列表** ——
 *      空列表不是"没读到你"，而是"谎称你什么都没装"，那是本仓最不能有的失败形态；
 *   ③ **只读、不读技能正文**（全文件不出现 `SKILL.md` 的读取），非 GET 405、异常 503
 *      走本包既有路由口径（`enterpriseLocalErrorStatus` 那张唯一表 + `onError` 留判定点）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/**
 * 本机**官方发现面**的只读路由：`GET /enterprise/api/v1/local/skills/discovered`。
 *
 * 与 `platform-client` 那族 `/skills/{install,uninstall,installed,content,upload,self-installed,…}`
 * 并列（同一 `/enterprise/api/v1/local/skills` 前缀之下）。
 * ★它注册在 **bundle 侧**（`skill-route.ts` 已经持有 `/skills` 这条 prefix，本文件再注册一条
 * **exact** sibling）：引擎 `dsh-host-webserver` 是 exact / prefix **两张表**，exact 整路径命中
 * 先于 prefix，故 `discovered` 不会被那条 prefix handler 当成包 id 去判 400 —— 这与
 * `skill-route.ts` 自己注册 `/skills` exact 列表是同一个理由（坐标见 `skill-route.ts` 头注）。
 */
export const ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH = '/enterprise/api/v1/local/skills/discovered'

/**
 * 这条面唯一的稳定码：**本机的技能发现面这次读不到**。
 *
 * ★三种来由收在**一枚**码上，因为对员工来说是同一件事、下一步也是同一条：
 *   ① 老宿主根本没有官方 `skills` 服务（服务缺席）；
 *   ② 服务在场但 `snapshot()` 抛（官方自己的失败）；
 *   ③ 服务回了我们读不懂的东西（形状闸门不过 —— 见 `projectDiscoveredSkills`）。
 *   三者的下一步都是「重试一次；仍然失败请让管理员确认部署版本」，故不拆三枚
 *   （本仓纪律："一个码一句话"；下一步相同的失败不许各给一个码）。
 * ★**状态码走 `enterpriseLocalErrorStatus` 那张唯一表**：本码刻意**不进**那张表，
 *   落在表尾默认 503（与 `ENT_NUWAX_NOT_CONFIGURED` 同一手法：本机这块暂时不可用、可重试），
 *   因此不需要动 platform-client 一个字节。
 * ★**绝不用空列表代替它**：空列表 = "你什么都没装"，那是**假话**（用户明确点名不许）。
 */
export const ENT_SKILL_DISCOVERY_UNAVAILABLE = 'ENT_SKILL_DISCOVERY_UNAVAILABLE'

/** 一次快照里**允许**出厂的那几格；顺序即响应里的键序（用例按这个清单做逐键集合断言）。 */
export const ENTERPRISE_DISCOVERED_SKILL_KEYS = [
  'name',
  'description',
  'invocation',
  'source',
  'provider',
] as const

/** `whenToUse` 是**可选**的一格：官方没给就不给这个键（不是一个空串——"没说"与"说空"要分得开）。 */
export const ENTERPRISE_DISCOVERED_OPTIONAL_KEYS = ['whenToUse'] as const

/** 投影后的一条已发现技能（浏览器侧解码器 `decodeEnterpriseDiscoveredSkills` 收的就是这个形状）。 */
export interface EnterpriseDiscoveredSkill {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation: { readonly modelInvocable: boolean; readonly userInvocable: boolean }
  readonly source: string
  readonly provider: string
}

/** 投影后的一次快照。`complete` 由**官方**给：`false` = 它自己说"还没发现完"。 */
export interface EnterpriseDiscoveredSkills {
  readonly skills: readonly EnterpriseDiscoveredSkill[]
  readonly complete: boolean
}

/**
 * 宿主官方 `skills` 服务的最小面（结构性，**不 import 官方包**）。
 *
 * 契约逐字取自宿主里那个服务（`ctx.get('skills')`）：
 * `snapshot(options) => Promise<{skills: SkillSummary[], complete: boolean}>`。
 * ★返回 `unknown` 是**有意的**：`ctx.get()` 拿到的东西在编译期本来就不受约束，
 *   把形状闸门放在**这一条边的唯一一处**（`projectDiscoveredSkills`）比在类型上"假定它是对的"诚实。
 */
export interface EnterpriseSkillSnapshotPort {
  snapshot(options: { readonly signal?: AbortSignal }): Promise<unknown>
}

/**
 * 组合层交给路由的端口：**每次调用现场解引用**官方服务（服务可能晚于本插件就绪）。
 *
 * ★为什么不是直接给 `EnterpriseSkillSnapshotPort`：官方服务在 apply 那刻可能还没 provide
 *   （与 `preset/wiring.ts` 那个冻结点同一个道理），把它**快照**在端口对象里就等于"启动顺序决定可用性"。
 *   端口返回 `undefined` = 此刻没有这个服务 ⇒ 路由如实回 `ENT_SKILL_DISCOVERY_UNAVAILABLE`。
 */
export interface EnterpriseSkillDiscoveryPort {
  discover(): EnterpriseSkillSnapshotPort | undefined
}

/** 本面抛给路由的稳定错误（只带码与一句内因；响应体里只出码）。 */
export class EnterpriseSkillDiscoveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** 日志判定点：服务缺席与快照失败在日志里必须分得开（响应对员工是同一句话，排障不是）。 */
    readonly step: SkillDiscoveryFailureProjection['step'] = 'snapshot-failed',
  ) {
    super(message)
    this.name = 'EnterpriseSkillDiscoveryError'
  }
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 与 account-state / skill-route 的错误码形状门禁同源：只回显受控标识符。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/** 与 usage-route / skill-route 内部 helper 等价的私有小工具；两份私有实现好过为复用而反向依赖。 */
function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/** 读一条必填字符串；不是字符串就**当场拒**（丢条目 = 少报一个技能，比失败更坏）。 */
function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      `official skills snapshot has a non-string ${key}`,
    )
  }
  return value
}

/** 读调用策略那两枚布尔（官方契约里它们必填且必是布尔）。 */
function requireInvocation(value: unknown): { readonly modelInvocable: boolean; readonly userInvocable: boolean } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      'official skills snapshot has a non-object invocation',
    )
  }
  const record = value as Record<string, unknown>
  if (typeof record['modelInvocable'] !== 'boolean' || typeof record['userInvocable'] !== 'boolean') {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      'official skills snapshot has a non-boolean invocation field',
    )
  }
  return { modelInvocable: record['modelInvocable'], userInvocable: record['userInvocable'] }
}

/**
 * 把官方快照投影成**逐键白名单**的响应体。
 *
 * ★**这是整条路由的形状闸门，也是唯一一道**：
 *   · 快照不是对象 / `skills` 不是数组 / `complete` 不是布尔 ⇒ 抛（回失败码，不回空列表）；
 *   · 逐条只**读**白名单那几格，产出的对象**从零构造**（不是"删掉 path"，是"根本不放进去"）
 *     ⇒ `path` 与 `resourceBase` 在任何输入下都不可能出厂（用例对**输出的键集**做逐键断言）；
 *   · `whenToUse` 缺席或非字符串 ⇒ **不给这个键**（可选就是可选，不编空串）；
 *   · 任一条必填格形状不对 ⇒ 抛（宁可如实失败，也不静默少报一枚）。
 * ★空列表是**合法**结果（磁盘上真的一枚都没有），它只在官方确实这么回时才出现 ——
 *   与"服务读不到"那条路泾渭分明，这正是本刀要守住的那条界线。
 *
 * @param snapshot - 官方 `snapshot()` 的原始返回值（`unknown`：形状由这里判）。
 * @returns `{skills, complete}`：逐键白名单、无宿主路径。
 * @throws {EnterpriseSkillDiscoveryError} 形状读不懂。
 */
export function projectDiscoveredSkills(snapshot: unknown): EnterpriseDiscoveredSkills {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      'official skills snapshot is not an object',
    )
  }
  const record = snapshot as Record<string, unknown>
  const raw = record['skills']
  if (!Array.isArray(raw)) {
    throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has no skills array')
  }
  if (typeof record['complete'] !== 'boolean') {
    throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has no boolean complete')
  }
  const skills: EnterpriseDiscoveredSkill[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has a non-object entry')
    }
    const each = entry as Record<string, unknown>
    const name = requireString(each, 'name')
    if (name.length === 0) {
      throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has an empty skill name')
    }
    const whenToUse = each['whenToUse']
    skills.push({
      name,
      description: requireString(each, 'description'),
      // 可选那一格：只有真的是非空字符串才出厂（"没说"与"说空"分得开）。
      ...(typeof whenToUse === 'string' && whenToUse.length > 0 ? { whenToUse } : {}),
      invocation: requireInvocation(each['invocation']),
      source: requireString(each, 'source'),
      provider: requireString(each, 'provider'),
      // ★`path` / `resourceBase` 就在这里被**结构性**丢掉：上面这个字面量里没有它们的位置。
    })
  }
  return { skills, complete: record['complete'] }
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface SkillDiscoveryFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: 'service-absent' | 'snapshot-failed'
}

/**
 * 失败投影的唯一判断点。
 *
 * 服务缺席由调用处**显式**抛同一枚码（`step=service-absent`，可从消息里区分），
 * 快照抛错/形状不过走这里（`step=snapshot-failed`）。两者状态码都取
 * `enterpriseLocalErrorStatus`（本码落在表尾 ⇒ 503），**绝不折成 200 + 空列表**。
 *
 * @param error - 取数路径逃出来的异常。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectSkillDiscoveryFailure(error: unknown): SkillDiscoveryFailureProjection {
  const code = errorCodeOf(error)
  return {
    status: enterpriseLocalErrorStatus(error),
    code: code !== undefined && CODE_SHAPE.test(code) ? code : ENT_SKILL_DISCOVERY_UNAVAILABLE,
    step: error instanceof EnterpriseSkillDiscoveryError ? error.step : 'snapshot-failed',
  }
}

/**
 * 在 Harness `ctx.webServer` 上注册**本机官方发现面**的同源只读路由。
 *
 * 三个失败面都在写状态行之前收敛成 `{error:{code}}`，异常不逃到 Cordis 顶层：
 *  · 端口缺席（组合层没接线）⇒ 与"此刻解引用不到服务"同一枚码；
 *  · `discover()` 回 `undefined`（老宿主没有官方 `skills` 服务）⇒ 同一枚码，**不静默**；
 *  · `snapshot()` 抛 / 形状不过 ⇒ 走 `projectSkillDiscoveryFailure`。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param discovery - 官方发现面端口；缺席即整条路由 fail-closed（一律 503 明确码）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseSkillDiscoveryRoute(
  webServer: WebServerRoutePort,
  discovery?: EnterpriseSkillDiscoveryPort | undefined,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      let status = 200
      let body: unknown
      try {
        const service = discovery?.discover()
        if (service === undefined) {
          throw new EnterpriseSkillDiscoveryError(
            ENT_SKILL_DISCOVERY_UNAVAILABLE,
            'the official skills service is not available on this host',
            'service-absent',
          )
        }
        // ★只读：一次快照，**不读任何 SKILL.md 正文**、不写任何状态文件。
        body = { data: projectDiscoveredSkills(await service.snapshot({})) }
      } catch (error) {
        const failure = projectSkillDiscoveryFailure(error)
        status = failure.status
        body = { error: { code: failure.code } }
        onError?.(`enterprise skill discovery request projected to ${failure.status}`
          + ` [operation=GET ${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
      writeJson(response, status, body)
    },
  })
}
