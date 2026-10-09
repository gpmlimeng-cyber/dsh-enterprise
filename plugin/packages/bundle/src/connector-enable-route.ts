/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与稳定码→HTTP 状态**唯一**那张表 `enterpriseLocalErrorStatus`、本包 `connector-enable.ts` 的 `requireConnectorMcpId`（`<mcpId>` 的**唯一**一把尺）与 `EnterpriseConnectorEnableError`（判定点 `step` 由它带出）、`connector-plaza.ts` 的族路径常量 `ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH`
 * [OUTPUT]: 对外提供连接器启用面的本机路由注册器 `registerEnterpriseConnectorEnableRoutes`（**三条 exact**：`POST …/connectors/enable`、`POST …/connectors/disable`、`GET …/connectors/connected`；**一条 prefix**：`GET …/connectors/<mcpId>/status`）、四条路径常量、端口形状 `EnterpriseConnectorEnableRoutePort`、失败投影 `projectConnectorEnableFailure`、状态段常量与正文字节上限
 * [POS]: 口径 67 Phase C D2 的**本机 HTTP 面**（D0/D1 的 `connector-plaza.ts` 是只读投影的 HTTP 面，本文件是写入口 + 单枚/一批只读投影的 HTTP 面）。
 *   ★**只做形状门禁 + 分派 + 投影**：取配置/合成/装卸/授权全在内核（`connector-enable.ts`），
 *   出厂键集全在 `connector-enable-service.ts`（本层一个响应键都不自己拼）。
 *
 *   ### ★为什么是「两条 exact + 一条 prefix」而不是三条 exact（引擎语义决定的，不是风格）
 *   契约里 `enable`/`disable` 把 `mcpId` 放在**正文**，故它们的路径是**定值**：注册成 exact 之后，
 *   引擎 `dsh-host-webserver` 的 `match()`（`lib/index.js:322`：「先查 exact 表整路径命中，miss 后才在
 *   prefix 表取最长」）**结构上**保证 `/connectors/enable` 不可能被 `<mcpId>` 那条贪掉——那是引擎的判决，
 *   不是我们代码里判据的先后顺序。而 `/connectors/<mcpId>/status` 带一个**动态段**，exact 表表达不了
 *   （它只按整路径查表），故它与 `platform-client` 的 `/presets/<id>/{enable,disable,status}`、
 *   `skill-route.ts` 的 `/skills/<id>` 同款：注册一条**与 D1 那条 exact 逐字相同、不带尾斜杠**的 prefix
 *   （`/enterprise/api/v1/local/connectors`），由 handler 按后缀分派。
 *   ★**prefix 绝不能带尾斜杠**：引擎只认 `pathname === prefix || pathname.startsWith(prefix + '/')`，
 *   带尾斜杠会让 `/connectors/<id>/status` 在引擎层空体 404、根本不进 handler。
 *   ★**D1 那条 exact 一字未改**：本文件只 import 它的路径常量，不 register 它、也不改它的 handler；
 *   exact / prefix 是引擎里的**两张表**（`register()` 只对同 kind 同 path 抛重复），故「列表 exact +
 *   动态 prefix」共用同一个字符串不冲突，且裸 `/connectors` 仍然由 D1 那条 exact 优先命中。
 *
 *   ### ★为什么路由层不写第二把 `<mcpId>` 尺
 *   路径段与正文字段都**只**交给内核导出的 `requireConnectorMcpId`：它已经定死了「1..18 位十进制」
 *   与「形状不对 ⇒ `ENT_INVALID_REQUEST`」两件事（含 `\d` 不收、前后缀不收）。在路由层再写一个正则或
 *   `Number.isInteger` 之类的判据，等于让同一个形状有两处真相——两处只要有一天不一致，就会出现
 *   「路由放行、内核拒绝」这类只在真机上看得见的分裂。正文里 `mcpId` 允许是 JSON 数字（`status` 出厂
 *   的 `mcpId` 就是数字，界面会把它原样回交）时，也只做「安全正整数 ⇒ `String()`」这一步**类型折叠**，
 *   随后仍交给**同一把尺**。
 *
 *   ### ★失败一律走唯一那张表
 *   本文件**不含**任何「码 → 状态」的映射（除 200/405 这两个非失败状态）：所有失败都抛出去，由
 *   `enterpriseLocalErrorStatus` 定状态；响应体只回受控形状的稳定码，无码的形状失败归
 *   `ENT_INVALID_REQUEST`（与 `skill-third-party-route.ts` 同一手法）。内核那 11 枚码的状态由那张表定，
 *   本面**不另立一张**（图省事把授权两枚折成 503，会让界面的下一步措辞与真实原因错位）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'
import { EnterpriseConnectorEnableError, requireConnectorMcpId } from './connector-enable.js'
import { ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH } from './connector-plaza.js'

/**
 * 连接器族本机路由的公共前缀：**逐字**取自 D1 那条只读路由的常量（不在这里重写一遍字符串）。
 *
 * ★为什么是 import 而不是再写一遍：`/connectors` 这一条 D1 路由的路径是本族的**共同底座**，
 *   两份字面量迟早会漂移（漂移那天，prefix 与 exact 就不再是同一条路径，`match()` 的行为随之改变）。
 */
export const ENTERPRISE_CONNECTOR_LOCAL_PREFIX = ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH

/** `POST`：把一枚连接器启用到本机（`mcpId` 在**正文**里）。 */
export const ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH = `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/enable`

/** `POST`：断开一枚连接器（`mcpId` 在**正文**里）。 */
export const ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH = `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/disable`

/** `GET`：本机已装上的连接器那一批（**不含** `mcpId`，一次盘点；与 D1 的「广场」并列）。 */
export const ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH = `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/connected`

/**
 * `GET <local>/connectors/<mcpId>/status` 的**注册 path**（prefix 路由，不带尾斜杠——见文件头部）。
 *
 * ★它与 {@link ENTERPRISE_CONNECTOR_LOCAL_PREFIX} 是**同一条字符串**：裸路径由 D1 的 exact 命中，
 *   子路径（`<mcpId>/status`）由本条 prefix 命中。读代码时别把它们看成两条不同的路径。
 */
export const ENTERPRISE_CONNECTOR_STATUS_PREFIX = ENTERPRISE_CONNECTOR_LOCAL_PREFIX

/** `<mcpId>/status` 里那个**定值**后段（`<mcpId>` 是唯一允许变化的段）。 */
export const ENTERPRISE_CONNECTOR_STATUS_SEGMENT = 'status'

/** 正文上限：只装 `{mcpId}` / `{mcpId, confirmFingerprint}` 两三个短字符串（与全仓 JSON 本机路由同一档）。 */
export const ENTERPRISE_CONNECTOR_MAX_BODY_BYTES = 256 * 1024

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 稳定码形状（与全仓本机路由同约定）：**只回受控标识符**，任意外字符串不进响应体。 */
const CODE_SHAPE = /^ENT_[A-Z0-9_]{1,64}$/

/**
 * 本面四条路由的端口（由组合层绑定 `connector-enable-service.ts` 的四个真实现）。
 *
 * 形状故意最小：路由只负责「方法 + 正文键集 + 错误投影」，**取配置/装卸/授权与出厂键集全在左右两侧**。
 * 端口是**必需参数**（不像官方安装面那样要等官方服务 provide）：组合层无条件接线，
 * "端口缺席"在类型上不可表达 ⇒ 不为不可能出现的状态编码。
 */
export interface EnterpriseConnectorEnableRoutePort {
  /** `GET <local>/connectors/<mcpId>/status`：披露 + 指纹 + 已连接态。 */
  status(mcpId: string): Promise<unknown>
  /** `POST <local>/connectors/enable`：正文关闭键集 `{mcpId}` 或 `{mcpId, confirmFingerprint}`。 */
  enable(mcpId: string, confirmFingerprint?: string): Promise<unknown>
  /** `POST <local>/connectors/disable`：正文关闭键集 `{mcpId}`。 */
  disable(mcpId: string): Promise<unknown>
  /** `GET <local>/connectors/connected`：本机已装上的本族连接器（一次盘点）。 */
  connected(): Promise<unknown>
  /** 失败留痕（操作名 / 判定点 / 原始 error）；不改变任何响应语义。 */
  readonly onError?: ((message: string, error: unknown) => void) | undefined
}

/**
 * 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。
 *
 * `step` 是**本层**的判定点（三条只读/写路由各自一格，日志里分得开）；内核自己的判定点
 * （`EnterpriseConnectorEnableStep`，11 枚）由 `EnterpriseConnectorEnableError.step` 带出，
 * 在日志里以 `kernel-step=` 并列出现——两者都留着，排障时不必去猜是哪一段。
 */
export type EnterpriseConnectorEnableRouteStep =
  | 'status-failed'
  | 'enable-failed'
  | 'disable-failed'
  | 'connected-failed'

/** 失败投影的结果。 */
export interface ConnectorEnableFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: EnterpriseConnectorEnableRouteStep
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

/** 方法不符：405 + `Allow`（与全仓本机路由同判；**零副作用**：正文不读、端口一次都不进）。 */
function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

/** 从异常里取稳定码（只认字符串 `code`；取不到就回 `undefined`，由调用方按状态兜底）。 */
function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/**
 * 失败投影的唯一判断点：状态码走 platform-client 的**唯一**那张表，响应体只回受控形状的稳定码。
 *
 *  · 400（形状类失败，含内核那枚 `ENT_INVALID_REQUEST`）⇒ 一律回 `ENT_INVALID_REQUEST`
 *    （与 platform-client 的 `dispatchPresetAction`、`skill-third-party-route.ts` 同一手法：
 *    形状失败不该把内部实现细节当码发出去）；
 *  · 其余：异常自己带的受控码**原样透出**（内核 11 枚码一个字节都不换——那是契约）；
 *  · 连码都没有（不该发生：内核与 `escReadError` 都带码）⇒ 回落本族那枚「本机这面读不懂/不可用」的码，
 *    绝不把任意异常文本当码出厂。
 *
 * @param error - 分派路径逃出来的异常。
 * @param step - 本层判定点（四条路由各一格）。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectConnectorEnableFailure(
  error: unknown,
  step: EnterpriseConnectorEnableRouteStep,
): ConnectorEnableFailureProjection {
  const code = errorCodeOf(error)
  const status = enterpriseLocalErrorStatus(error)
  return {
    status,
    code: status === 400 ? 'ENT_INVALID_REQUEST' : code !== undefined && CODE_SHAPE.test(code) ? code : 'ENT_CONNECTOR_STATE_INVALID',
    step,
  }
}

/**
 * 有界读 JSON 正文（与 platform-client 那条既有 JSON 路由**同一把尺**：`content-type` 必须是
 * `application/json`、正文有界 256 KiB、解析失败即 400）。本面不收文件字节，故不引第二条配额。
 */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const declared = request.headers['content-length']
  if (typeof declared === 'string' && declared !== '' && Number(declared) > ENTERPRISE_CONNECTOR_MAX_BODY_BYTES) {
    throw new RangeError('connector action body is too large')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += bytes.byteLength
    if (total > ENTERPRISE_CONNECTOR_MAX_BODY_BYTES) throw new RangeError('connector action body is too large')
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw new TypeError(`connector action body is not valid JSON: ${String(error)}`)
  }
}

/** 只认真对象（数组与 null 都不算）：形状不对即 400，**一次都不进内核**。 */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('connector action body must be a JSON object')
  }
  return value as Record<string, unknown>
}

/**
 * 正文字段 `mcpId` 的**唯一**收窄点（判据仍只有内核那一把尺）。
 *
 * JSON 里 id 既可能是字符串（`"134"`）也可能是数字（`134`）——`status` 出厂的 `mcpId` 就是数字，
 * 界面自然会把它原样回交。故这里只把**安全正整数**折成十进制字符串，随后与字符串一样交给
 * `requireConnectorMcpId`：路由层**没有**自己写正则、也没有自己的十进制判据。
 */
function requireBodyMcpId(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError('mcpId must be the platform decimal id')
    }
    return requireConnectorMcpId(String(value))
  }
  return requireConnectorMcpId(value)
}

/**
 * 在 Harness `ctx.webServer` 上注册连接器启用面的四条同源路由。
 *
 *  · `POST <local>/connectors/enable`           → `port.enable(mcpId, confirmFingerprint?)`（exact）
 *  · `POST <local>/connectors/disable`          → `port.disable(mcpId)`（exact）
 *  · `GET  <local>/connectors/connected`        → `port.connected()`（exact）
 *  · `GET  <local>/connectors/<mcpId>/status`   → `port.status(mcpId)`（**prefix**，见文件头部）
 *
 * 三条硬口径：① 方法不符 ⇒ 405 + `Allow`（正文不读、端口不进，**零副作用**）；② 正文**关闭键集恰好**
 * （多键/少键/非 `application/json`/非 JSON ⇒ 400 且一次都不进端口）；③ 异常一律在写状态行之前收敛成
 * `{error:{code}}` 并走唯一那张码→状态表，绝不逃到 Cordis 顶层；失败经 `onError` 留判定点。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 组合层绑定的四个真实现（见 {@link EnterpriseConnectorEnableRoutePort}）。
 * @returns 注销这四条路由的 disposer。
 */
export function registerEnterpriseConnectorEnableRoutes(
  webServer: WebServerRoutePort,
  port: EnterpriseConnectorEnableRoutePort,
): () => void {
  const fail = (
    response: ServerResponse,
    error: unknown,
    operation: string,
    step: EnterpriseConnectorEnableRouteStep,
  ): void => {
    const failure = projectConnectorEnableFailure(error, step)
    const kernelStep = error instanceof EnterpriseConnectorEnableError ? error.step : undefined
    writeJson(response, failure.status, { error: { code: failure.code } })
    port.onError?.(
      `enterprise connector enable request projected to ${String(failure.status)}`
        + ` [operation=${operation} step=${failure.step}`
        + `${kernelStep === undefined ? '' : ` kernel-step=${kernelStep}`} status=${String(failure.status)}]`,
      error,
    )
  }

  const disposeEnable = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH}`
      try {
        const body = asRecord(await readJsonBody(request))
        // 关闭键集**恰好**两种形状：`{mcpId}` 与 `{mcpId, confirmFingerprint}`（后者=员工确认过披露）。
        // 越界键、缺 `mcpId`、`confirmFingerprint` 不是字符串都在这**一步**变成 400，一次都不进内核。
        const keys = Object.keys(body).sort().join(',')
        if (keys !== 'mcpId' && keys !== 'confirmFingerprint,mcpId') {
          throw new TypeError('invalid connector enable body')
        }
        let confirmFingerprint: string | undefined
        if (keys === 'confirmFingerprint,mcpId') {
          const value = body['confirmFingerprint']
          // ★只做**类型**闸门：指纹的**比较**是内核那唯一一处判定（本层不判它像不像 sha256，
          //   否则「交了一个形状像但内容不对的指纹」就会从内核那枚 STALE 变成 400，换掉了语义）。
          if (typeof value !== 'string') throw new TypeError('confirmFingerprint must be a string')
          confirmFingerprint = value
        }
        const mcpId = requireBodyMcpId(body['mcpId'])
        writeJson(response, 200, { data: await port.enable(mcpId, confirmFingerprint) })
      } catch (error) {
        fail(response, error, operation, 'enable-failed')
      }
    },
  })

  const disposeDisable = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH}`
      try {
        const body = asRecord(await readJsonBody(request))
        // 关闭键集**恰好** `{mcpId}`：确认指纹对"断开"没有语义（没有任何落盘需要授权），故不给这个键。
        if (Object.keys(body).sort().join(',') !== 'mcpId') {
          throw new TypeError('invalid connector disable body')
        }
        const mcpId = requireBodyMcpId(body['mcpId'])
        writeJson(response, 200, { data: await port.disable(mcpId) })
      } catch (error) {
        fail(response, error, operation, 'disable-failed')
      }
    },
  })

  const disposeConnected = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      const operation = `GET ${ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH}`
      try {
        writeJson(response, 200, { data: await port.connected() })
      } catch (error) {
        fail(response, error, operation, 'connected-failed')
      }
    },
  })

  const disposeStatus = webServer.register({
    kind: 'prefix',
    // ★不带尾斜杠（见文件头部）：带尾斜杠时 `/connectors/<id>/status` 在引擎层就 404，根本不进 handler。
    path: ENTERPRISE_CONNECTOR_STATUS_PREFIX,
    handler: async (request, response) => {
      // ★方法先判：非 GET 一律 405 + `Allow: GET`，且**不解析路径、不进端口**（零副作用）。
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      const pathname = (request.url ?? '/').split('?')[0] ?? '/'
      const rest = pathname.slice(ENTERPRISE_CONNECTOR_STATUS_PREFIX.length + 1)
      const operation = `GET ${ENTERPRISE_CONNECTOR_STATUS_PREFIX}/<mcpId>/${ENTERPRISE_CONNECTOR_STATUS_SEGMENT}`
      try {
        // 形状门禁：**恰好**两段，且第二段逐字就是 `status`（多一段、少一段、词不对一律 400）。
        // 这是「`enable`/`disable`/`connected` 不许被 `<mcpId>` 贪掉」的第二道保险：那三个词即使
        // 走到这里，`<mcpId>` 那一格也过不了内核那把尺（且 exact 表本来就先命中它们自己的路由）。
        const segments = rest.split('/')
        if (segments.length !== 2 || segments[1] !== ENTERPRISE_CONNECTOR_STATUS_SEGMENT) {
          throw new TypeError('connector status path must be <mcpId>/status')
        }
        const mcpId = requireConnectorMcpId(segments[0])
        writeJson(response, 200, { data: await port.status(mcpId) })
      } catch (error) {
        fail(response, error, operation, 'status-failed')
      }
    },
  })

  return () => {
    disposeStatus()
    disposeConnected()
    disposeDisable()
    disposeEnable()
  }
}
