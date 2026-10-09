/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、稳定码→状态码唯一映射 `enterpriseLocalErrorStatus` 与 `thrownErrorDiagnostics`、本包 `skill-self-installed.ts` 的两个内核与结果形状（由组合层绑定）
 * [OUTPUT]: 对外提供本刀两条本机路由注册器 `registerEnterpriseSelfInstalledActionRoutes`（`POST /enterprise/api/v1/local/skills/self-installed/uninstall` 与 `POST …/self-installed/reveal`）、两条路径常量、端口形状 `EnterpriseSelfInstalledActionRoutePort`、内核回值形状 `EnterpriseSelfInstalledUninstallKernelResult`、**出厂响应视图** `EnterpriseSelfInstalledUninstallView`（关闭三键）与失败投影 `projectSelfInstalledActionFailure`
 * [POS]: bundle 的「自装技能卸载 / 打开所在文件夹」**本机 HTTP 面** —— 与 `skill-published-route.ts`（口径 64 B0）、`skill-third-party-route.ts`（口径 62）并列的技能动作面，注册面**全在 bundle 侧**（本刀**不碰** platform-client：那条 `/skills/self-installed` 只读 exact 由 platform-client 持有，本文件两条注册成它下面的 **exact** sibling；`skill-route.ts` 持有一条 `/skills` prefix，而引擎 `dsh-host-webserver` 是 exact / prefix 两张表、exact 整路径优先 ⇒ 这两条既不会被 prefix 当成包 id 判 400，也不会与那条只读精确串冲突）。
 *   ★**只做形状门禁 + 分派 + 投影**：唯一归属判据、跨归属判据、路径等式、暂存/记账/删除全在 `skill-self-installed.ts`（本层不写第二套判定）。
 *   ★正文**关闭键集恰好** `{name}`（多键/少键/非字符串/空串/超长/非 JSON/`content-type` 不是 `application/json`
 *   一律 400 且**一次都不进端口**）；`name` = 技能在本机的**目录名**（消费方是官方发现面：那份投影只有 `name`、
 *   没有我们的记录 id），形状的精确 kebab 判据仍在内核那一份里（**一处判定**，本层只做字符串 + 长度粗闸门）。
 *   ★**新码一枚都不加**：`ENT_INVALID_REQUEST`/`ENT_RESOURCE_NOT_FOUND`/`ENT_SKILL_CONTENT_INVALID`/
 *   `ENT_SKILL_INSTALL_FAILED`/`ENT_SKILL_STATE_INVALID`/`ENT_PLATFORM_UNAVAILABLE` 全是既有码，
 *   状态码一律走 platform-client 那张唯一映射表 ⇒ platform-client 零改动。
 *   ★非 POST 一律 405 + `Allow: POST`。
 *   ★**响应键集闭合（裁决②）**：内核回**四键**（含 `alreadyMissing`），路由在写状态行之前把它剥掉 ⇒
 *   出厂 `data` **恰好两键** `{skills,removed}`（与头注、与界面解码器一致），`alreadyMissing`
 *   只经 `onError` 留一条 `step=idempotent` 的判定点日志 —— **不上屏、不进响应**。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/**
 * 自装技能**卸载**的 exact 动作路由：`POST /enterprise/api/v1/local/skills/self-installed/uninstall`。
 *
 * ★必须注册成 **exact**：`skill-route.ts` 持有 `/enterprise/api/v1/local/skills` 这条 prefix，
 * 引擎 `match()` 是「exact 整路径优先、miss 后才取最长 prefix」⇒ 不注册 exact 的话 `self-installed`
 * 会被那条 prefix handler 当成包 id 去判 400（`skill-published-route.ts` 同一个坑、同一条解法）。
 */
export const ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH = '/enterprise/api/v1/local/skills/self-installed/uninstall'

/** 自装技能**打开所在文件夹**的 exact 动作路由：`POST …/skills/self-installed/reveal`。 */
export const ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH = '/enterprise/api/v1/local/skills/self-installed/reveal'

/** 入参 `name` 的长度上界：与 `skill-upload.ts` 读盘收窄技能名那条 `length > 64` 逐字同源。 */
const MAX_SKILL_NAME_LENGTH = 64

/** 与既有本机技能路由同源：错误码只回显受控标识符，任意外字符串不进响应体。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** JSON 正文上限：与 platform-client 的 `MAX_LOCAL_BODY_BYTES` 同一条 256 KiB（本面只收一个标识符）。 */
const MAX_LOCAL_BODY_BYTES = 256 * 1024

/**
 * 本面两条路由的端口（由组合层绑定 `skill-self-installed.ts` 的两个真实现）。
 *
 * 形状故意最小：两条都**只有**一个 `name` 入参——「打开一个客户端给的路径」在本形状上不可表达。
 */
export interface EnterpriseSelfInstalledActionRoutePort {
  /**
   * `POST <local>/skills/self-installed/uninstall`：按目录名卸载（只删它唯一独占的那个目录）。
   *
   * 端口回**四键**（含 `alreadyMissing`）；路由在写响应之前把它剥掉 ⇒ 出厂响应**恰好三键**
   * `{skills,removed}`（见 {@link EnterpriseSelfInstalledUninstallView}）。
   */
  uninstall(name: string): Promise<EnterpriseSelfInstalledUninstallKernelResult>
  /** `POST <local>/skills/self-installed/reveal`：用系统文件管理器打开这条技能所在的文件夹。 */
  reveal(name: string, signal: AbortSignal): Promise<unknown>
}

/** 卸载内核的实际回值（三键）；`alreadyMissing` 是**只进 Host 日志**的那一格。 */
export interface EnterpriseSelfInstalledUninstallKernelResult {
  readonly skills: readonly unknown[]
  readonly removed: readonly string[]
  readonly alreadyMissing: readonly string[]
}

/** 出厂响应体 `data` 的**关闭两键**（界面按它解码；`alreadyMissing` 不在这一份里）。 */
export interface EnterpriseSelfInstalledUninstallView {
  readonly skills: readonly unknown[]
  readonly removed: readonly string[]
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface SelfInstalledActionFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: 'uninstall-failed' | 'reveal-failed'
}

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

/**
 * 失败投影的唯一判断点：状态码走 platform-client 的**唯一**那张表，响应体只回受控形状的稳定码。
 *
 * ★**受控码优先于状态码**：`ENT_SKILL_CONTENT_INVALID`（本机落盘可疑）与 `ENT_RESOURCE_NOT_FOUND`
 * （记录里没有这条）在表上分别是 409/404，它们与"请求形状不对"（`ENT_INVALID_REQUEST`，400）的
 * **下一步完全不同** ⇒ 只要异常带着受控码就原样透出；只有**连码都没有**的形状类失败（`TypeError` 等）
 * 才归 `ENT_INVALID_REQUEST`，其余无码失败回落既有码 `ENT_SKILL_INSTALL_FAILED`
 * （**绝不复述任意字符串**、绝不新增码）。
 *
 * @param error - 分派路径逃出来的异常。
 * @param step - 判定点（`uninstall-failed` / `reveal-failed`）。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectSelfInstalledActionFailure(
  error: unknown,
  step: SelfInstalledActionFailureProjection['step'],
): SelfInstalledActionFailureProjection {
  const code = errorCodeOf(error)
  const status = enterpriseLocalErrorStatus(error)
  return {
    status,
    code: code !== undefined && CODE_SHAPE.test(code)
      ? code
      : status === 400 ? 'ENT_INVALID_REQUEST' : 'ENT_SKILL_INSTALL_FAILED',
    step,
  }
}

/**
 * 有界读 JSON 正文（与 platform-client 那条既有 JSON 路由**同一把尺**：`content-type` 必须是
 * `application/json`、正文有界 256 KiB、解析失败即 400）。本面**只收一个标识符**，不引第二条配额。
 */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const declared = request.headers['content-length']
  if (typeof declared === 'string' && declared !== '' && Number(declared) > MAX_LOCAL_BODY_BYTES) {
    throw new RangeError('self-installed skill action body is too large')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += bytes.byteLength
    if (total > MAX_LOCAL_BODY_BYTES) throw new RangeError('self-installed skill action body is too large')
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw new TypeError(`self-installed skill action body is not valid JSON: ${String(error)}`)
  }
}

/**
 * 关闭键集**恰好** `{name}` 的门禁：这是本面唯一的入参形状，「路径」在这个形状上不可表达。
 *
 * @param request - 已确认是 POST 的请求。
 * @returns 已过粗闸门的 `name`（kebab 精确正则仍在内核那一份里）。
 * @throws {TypeError} 键集/类型/长度任一条不满足（→ 400，且**一次都不进端口**）。
 */
async function readSkillNameBody(request: IncomingMessage): Promise<string> {
  const value = await readJsonBody(request)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid self-installed skill action')
  }
  const body = value as Record<string, unknown>
  const name = body['name']
  if (Object.keys(body).sort().join(',') !== 'name'
    || typeof name !== 'string'
    || name.length === 0
    || name.length > MAX_SKILL_NAME_LENGTH) {
    throw new TypeError('invalid self-installed skill action')
  }
  return name
}

/**
 * 在 Harness `ctx.webServer` 上注册本刀的两条同源路由（**exact** sibling）。
 *
 *  · `POST <local>/skills/self-installed/uninstall` → `{data:{skills,removed}}`；
 *    `skills` 与 `GET /skills/self-installed` **逐字同形**（界面复用同一份解码器），`removed` 是本次真的
 *    从技能根里消失的名字（被中心/另一条自装记录认领的名字一律**拒**，从不"跳过"）。
 *  · `POST <local>/skills/self-installed/reveal` → `{data:{revealed:true}}`（**不含**宿主路径）。
 *
 * 两条硬口径：① 非 POST ⇒ 405 + `Allow: POST`（两次注册各自独立，方法不匹配时**零副作用**）；
 * ② 异常一律在写状态行之前收敛成 `{error:{code}}`，绝不逃到 Cordis 顶层。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 组合层绑定的两个内核（**必需**：与 `skill-published-route.ts` 同一条理由——
 *   这两条端口的接线是 `apply()` 里的同步动作，"端口缺席"在类型上不可表达）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销两条路由的 disposer。
 */
export function registerEnterpriseSelfInstalledActionRoutes(
  webServer: WebServerRoutePort,
  port: EnterpriseSelfInstalledActionRoutePort,
  onError?: (message: string, error: unknown) => void,
): () => void {
  const uninstall = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH}`
      try {
        const name = await readSkillNameBody(request)
        // ★响应键集**恰好两键** `{skills,removed}`：内核回的 `alreadyMissing`（"记录里有、盘上本来就没了"
        //   这条幂等事实）**只进 Host 日志**，在写状态行之前就被剥掉 —— 它既不该上屏，也不属于界面契约
        //   （界面按三键解码；多给一枚键会让"宿主加字段"变成"员工的一次成功卸载被判成失败"）。
        const { alreadyMissing, ...result } = await port.uninstall(name)
        if (alreadyMissing.length > 0) {
          onError?.(`enterprise self-installed skill uninstall found ${alreadyMissing.length} directory already missing`
            + ` [operation=${operation} step=idempotent status=200 names=${alreadyMissing.join('|')}]`, undefined)
        }
        writeJson(response, 200, { data: result })
      } catch (error) {
        const failure = projectSelfInstalledActionFailure(error, 'uninstall-failed')
        writeJson(response, failure.status, { error: { code: failure.code } })
        onError?.(`enterprise self-installed skill uninstall projected to ${failure.status}`
          + ` [operation=${operation} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
    },
  })
  const reveal = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH}`
      try {
        const name = await readSkillNameBody(request)
        // 客户端在响应写完前断开（`response` 未写完就 close）时中止系统交接：
        // 请求流自己的 'close' 在带正文的 POST 上会提前触发，故判据只能是响应是否已写完。
        const abort = new AbortController()
        response.on('close', () => { if (!response.writableEnded) abort.abort() })
        writeJson(response, 200, { data: await port.reveal(name, abort.signal) })
      } catch (error) {
        const failure = projectSelfInstalledActionFailure(error, 'reveal-failed')
        writeJson(response, failure.status, { error: { code: failure.code } })
        onError?.(`enterprise self-installed skill reveal projected to ${failure.status}`
          + ` [operation=${operation} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
    },
  })
  return () => { uninstall(); reveal() }
}
