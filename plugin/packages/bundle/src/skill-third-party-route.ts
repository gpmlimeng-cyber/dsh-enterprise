/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、稳定码→状态码唯一映射 `enterpriseLocalErrorStatus` 与 `thrownErrorDiagnostics`、本包 `skill-third-party.ts` 的唯一稳定码 `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`
 * [OUTPUT]: 对外提供口径 62 的两条本机路由注册器 `registerEnterpriseThirdPartySkillRoutes`（`GET /enterprise/api/v1/local/skills/third-party` 只读盘点 + `POST …/third-party/install` 复制式安装）、路径常量 `ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH`/`ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH`、端口形状 `EnterpriseThirdPartySkillRoutePort` 与失败投影 `projectThirdPartySkillFailure`；出厂契约（Lead 冻结）：`GET` 的 `data` 是 `{roots:[{id,name,present,count,skipped,aliasOf?}],skills:[…]}`，`count` 与 `skills[]` 里同 `rootId` 的条数**逐字相等**，`path` 与宿主绝对路径**一律不出厂**
 * [POS]: bundle 的「本地三方 Agent 技能源」**本机 HTTP 面** —— 与 `skill-discovery.ts`（口径 54 的官方发现面）并列的第四条技能只读/动作面，注册面全在 bundle 侧（platform-client 零改动）：`/skills` 那条 prefix 由 `skill-route.ts` 持有，本文件两条都注册成 **exact** sibling（引擎 `dsh-host-webserver` 是 exact / prefix 两张表，exact 整路径优先 ⇒ `third-party` 不会被当成包 id 判 400）。★**只做形状门禁 + 分派 + 投影**：根表、候选判据、三态、复制与落盘全在 `skill-third-party.ts`（本层不写第二套判定）。★**`path` 一律不出厂**（响应即端口的投影，端口只回 `{roots,skills}`，两处形状都**没有** `path` 这一格）；★**失败绝不静默回空列表**：扫描抛错/端口缺席 ⇒ `503 + ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（该码落在 `enterpriseLocalErrorStatus` 表尾默认档），非 GET/POST ⇒ 405 + `Allow`。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'
import { ENT_SKILL_THIRD_PARTY_UNAVAILABLE } from './skill-third-party.js'

/**
 * 只读盘点的 exact 路由：`GET /enterprise/api/v1/local/skills/third-party`。
 *
 * ★必须注册成 **exact**：`skill-route.ts` 持有 `/enterprise/api/v1/local/skills` 这条 prefix，
 * 而引擎的 `match()` 是「exact 整路径优先、miss 后才取最长 prefix」⇒ 不注册 exact 的话
 * `third-party` 会被那条 prefix handler 当成包 id 去判 400（`skill-discovery.ts` 的 `discovered` 同一个坑）。
 */
export const ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH = '/enterprise/api/v1/local/skills/third-party'

/** 复制式安装的 exact 动作路由：`POST /enterprise/api/v1/local/skills/third-party/install`。 */
export const ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH = `${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}/install`

/** 入参 `path` 的形状上限：与 bundle 侧同一条 1024（`MAX_THIRD_PARTY_PATH_LENGTH`）。 */
const MAX_THIRD_PARTY_PATH_LENGTH = 1024

/** 与既有本机技能路由同源：错误码只回显受控标识符，任意外字符串不进响应体。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** JSON 正文上限：与 platform-client 的 `MAX_LOCAL_BODY_BYTES` 同一条 256 KiB（本面不收文件正文）。 */
const MAX_LOCAL_BODY_BYTES = 256 * 1024

/**
 * 本面两条路由的端口（由组合层绑定 `skill-third-party.ts` 的两个真实现）。
 *
 * 形状故意最小：路由只负责「方法 + 正文键集 + 错误投影」，**根表与落盘语义全在 bundle 内核那一份里**。
 */
export interface EnterpriseThirdPartySkillRoutePort {
  /** `GET <local>/skills/third-party`：本机三方技能根盘点 + 候选三态。 */
  discover(): Promise<unknown>
  /** `POST <local>/skills/third-party/install`：把候选 `path` 复制进 `<dshHome>/skills`。 */
  install(path: string): Promise<unknown>
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface ThirdPartySkillFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: 'port-absent' | 'discover-failed' | 'install-failed'
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
 * 失败投影的唯一判断点：状态码走 platform-client 的**唯一**那张表（本面新码落在表尾 ⇒ 503），
 * 响应体只回受控形状的稳定码；受控码之外一律回落本面那枚稳定码（**绝不复述任意字符串**）。
 *
 * @param error - 分派路径逃出来的异常。
 * @param step - 判定点（`discover-failed` / `install-failed`）。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectThirdPartySkillFailure(
  error: unknown,
  step: 'discover-failed' | 'install-failed',
): ThirdPartySkillFailureProjection {
  const code = errorCodeOf(error)
  const status = enterpriseLocalErrorStatus(error)
  return {
    status,
    code: status === 400
      ? 'ENT_INVALID_REQUEST'
      : code !== undefined && CODE_SHAPE.test(code) ? code : ENT_SKILL_THIRD_PARTY_UNAVAILABLE,
    step,
  }
}

/**
 * 有界读 JSON 正文（与 platform-client 那条既有 JSON 路由**同一把尺**：`content-type` 必须是
 * `application/json`、正文有界 256 KiB、解析失败即 400）。本面**不收文件字节**，故不引第二条配额。
 *
 * 只做形状；键集判定在调用处，语义在 bundle 内核。
 */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const declared = request.headers['content-length']
  if (typeof declared === 'string' && declared !== '' && Number(declared) > MAX_LOCAL_BODY_BYTES) {
    throw new RangeError('third-party skill body is too large')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += bytes.byteLength
    if (total > MAX_LOCAL_BODY_BYTES) throw new RangeError('third-party skill body is too large')
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw new TypeError(`third-party skill body is not valid JSON: ${String(error)}`)
  }
}

/**
 * 在 Harness `ctx.webServer` 上注册「本地三方 Agent 技能源」的两条同源路由。
 *
 *  · `GET  <local>/skills/third-party`          → `port.discover()`（根清单 + 候选三态；**无宿主绝对路径**）
 *  · `POST <local>/skills/third-party/install`  → `port.install(path)`（正文**关闭键集恰好** `{path}`）
 *
 * 三条硬口径：① 端口整个缺席 ⇒ 两条路由都回 `503 + ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（fail-closed，
 * **绝不静默回空列表** —— 空列表 = 谎称「本机没有三方技能」）；② 非 GET/POST ⇒ 405 + `Allow`；
 * ③ 异常一律在写状态行之前收敛成 `{error:{code}}`，绝不逃到 Cordis 顶层。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 组合层绑定的两个真实现；缺席即两条路由 fail-closed（都回那枚 503 明确码）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销这两条路由的 disposer。
 */
export function registerEnterpriseThirdPartySkillRoutes(
  webServer: WebServerRoutePort,
  port?: EnterpriseThirdPartySkillRoutePort | undefined,
  onError?: (message: string, error: unknown) => void,
): () => void {
  const fail = (
    response: ServerResponse,
    error: unknown,
    operation: string,
    step: 'discover-failed' | 'install-failed',
  ): void => {
    const failure = projectThirdPartySkillFailure(error, step)
    writeJson(response, failure.status, { error: { code: failure.code } })
    onError?.(`enterprise third-party skill request projected to ${failure.status}`
      + ` [operation=${operation} step=${failure.step} status=${failure.status}]`
      + ` ${thrownErrorDiagnostics(error)}`, error)
  }

  const disposeDiscover = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      try {
        if (port === undefined) {
          throw Object.assign(new Error('the third-party skill port is not wired'), { code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE })
        }
        writeJson(response, 200, { data: await port.discover() })
      } catch (error) {
        fail(response, error, `GET ${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}`, 'discover-failed')
      }
    },
  })

  const disposeInstall = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH}`
      try {
        if (port === undefined) {
          throw Object.assign(new Error('the third-party skill port is not wired'), { code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE })
        }
        const value = await readJsonBody(request)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new TypeError('invalid third-party skill install')
        }
        const body = value as Record<string, unknown>
        // 关闭键集**恰好** `{path}`（与 `/skills/adopt` 同一把尺）：越界键、非字符串、空串、超长都在这
        // 一步变成 400，**一次都不进** bundle —— 那条路径是不是候选由 bundle 内核判定。
        if (Object.keys(body).sort().join(',') !== 'path'
          || typeof body['path'] !== 'string'
          || body['path'].length === 0
          || body['path'].length > MAX_THIRD_PARTY_PATH_LENGTH) {
          throw new TypeError('invalid third-party skill install')
        }
        writeJson(response, 200, { data: await port.install(body['path']) })
      } catch (error) {
        fail(response, error, operation, 'install-failed')
      }
    },
  })

  return () => {
    disposeInstall()
    disposeDiscover()
  }
}
