/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与异常摘要串
 * [OUTPUT]: 对外提供企业技能目录的本地只读镜像 `registerEnterpriseSkillRoutes`（列表 exact + 详情 prefix，**详情 prefix 不带尾斜杠**以适配引擎的路径段前缀匹配），以及可单测的失败投影 `projectSkillFailure` 与信封投影 `projectSkillEnvelope`
 * [POS]: bundle 的员工技能取数层——Access Token 只存在于平台 Service，本文件既不接触凭据也不重算可见性，只把中心 runtime 技能列表/详情重封成本地 `{data}` 信封；路线形状受引擎 `dsh-host-webserver` 的 `match()` 约束（见 `LOCAL_DETAIL_ROUTE`）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/** 中心 runtime 技能列表；与 contracts 的 paths/skill 真源同名（详情即此后缀雪花 id）。 */
export const ENTERPRISE_SKILLS_LIST_PATH = '/enterprise/api/v1/skills'

/** 本地只读镜像路径；浏览器只认这条同源路由，取数仍由 Host 代取令牌。 */
export const ENTERPRISE_SKILL_LOCAL_PATH = '/enterprise/api/v1/local/skills'

/**
 * 注册给引擎的详情 **prefix**：与列表路径逐字相同，**不带尾斜杠**。
 *
 * 引擎 `dsh-host-webserver` 的 `match()`（`lib/index.js`）只做「路径段前缀」：
 * `pathname === prefix || pathname.startsWith(`${prefix}/`)`，且在 exact 表 miss 后取最长 prefix。
 * 因此若这里注册成 `${...}/skills/`，`/skills/{packageId}` 既不等于 prefix 也不以
 * `prefix + '/'` 开头，引擎层直接 404（空响应体，不进 handler）——这正是 `/skills/code-review`
 * 线上 404、而 `/skills/`（恰好等于带尾斜杠的 prefix）能进 handler 回 400 的原因。
 * 官方 `dsh-host-open-in-app` 的图标路由同样注册不带尾斜杠的 `/open-in-app/icon`。
 * 裸列表路径由 exact 路由优先命中（引擎 exact 表先于 prefix 表），故两条路由共用同一字符串不冲突。
 */
const LOCAL_DETAIL_ROUTE = ENTERPRISE_SKILL_LOCAL_PATH

/** packageId 的切分点（**含**斜杠）：详情路径去掉这段前缀就是包 id，与上面注册的 prefix 不是同一条串。 */
const LOCAL_DETAIL_PREFIX = `${ENTERPRISE_SKILL_LOCAL_PATH}/`

/**
 * 与中心契约同源的雪花 id 形状。
 * 同一前缀下还挂着 `/versions/{versionId}/download`，此正则天然把它排除在详情之外。
 */
const PACKAGE_ID = /^[1-9][0-9]{0,18}$/

/**
 * 代取令牌所需的最小平台面；`EnterprisePlatformService.request` 结构性满足它，
 * 因此组合层直接传平台 Service，不必为本路由新开一条取数出口。
 */
export interface EnterpriseSkillPlatformPort {
  request(input: string, init?: RequestInit): Promise<Response>
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 与 account-state 的错误码形状门禁同源：只回显受控标识符，任意外字符串不进响应体。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/** 与 usage-route 内部 helper 等价的私有小工具；两份私有实现好过为复用而反向依赖。 */
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

/**
 * 上游返回了非 2xx 但**没有抛异常**时的等价失败。
 * 平台 Service 已把非 2xx 折叠成 `EnterprisePlatformError`（带 `httpStatus`），
 * 这一支只兜住其它实现，让投影逻辑不必按实现分叉。
 */
class SkillUpstreamError extends Error {
  constructor(readonly httpStatus: number) {
    super(`enterprise skills upstream returned ${httpStatus}`)
    this.name = 'SkillUpstreamError'
  }
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/** 结构读取 HTTP 状态：平台 Service 的 `EnterprisePlatformError` 与上面的兜底错误都带 `httpStatus`。 */
function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const status: unknown = Reflect.get(error, 'httpStatus')
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface SkillFailureProjection {
  readonly status: 401 | 503
  readonly code: string
  readonly step: 'upstream-unauthorized' | 'upstream-unauthorized-expired' | 'upstream-failed'
}

/**
 * 失败投影的唯一判断点：认证拒绝（会话过期/缺失/未登录，含本地「平台未就绪」）投影 401，
 * 其余一切失败投影 503。503 保留受控形状的上游错误码（如设备撤销或技能不可见），
 * 未知或非法形状一律回落到本地稳定码 `ENT_PLATFORM_UNAVAILABLE`。
 *
 * @param error - 取数路径逃出来的异常。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectSkillFailure(error: unknown): SkillFailureProjection {
  const code = errorCodeOf(error)
  const expired = code === 'ENT_AUTH_SESSION_EXPIRED'
  if (expired || code === 'ENT_AUTH_REQUIRED' || httpStatusOf(error) === 401) {
    return {
      status: 401,
      code: expired ? 'ENT_AUTH_SESSION_EXPIRED' : 'ENT_AUTH_REQUIRED',
      step: expired ? 'upstream-unauthorized-expired' : 'upstream-unauthorized',
    }
  }
  return {
    status: 503,
    code: code !== undefined && CODE_SHAPE.test(code) ? code : 'ENT_PLATFORM_UNAVAILABLE',
    step: 'upstream-failed',
  }
}

/**
 * 把中心信封 `{data, requestId}` 投影成本地信封 `{data}`。
 *
 * 本地取数口径只认单键信封（`ui/local-api.ts` 的 `requestJson`），因此这里必须剥掉
 * `requestId` 等其余字段，而不是把上游正文原样写出。
 *
 * @param payload - 上游 200 的 JSON 正文。
 * @returns 上游 `data` 字段，原样透传不做技能语义。
 * @throws {TypeError} 正文不是对象或缺少 `data`。
 */
export function projectSkillEnvelope(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new TypeError('enterprise skills response must be an envelope object')
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new TypeError('enterprise skills response is missing the data field')
  }
  return (payload as { readonly data: unknown }).data
}

/** 取请求路径（丢查询串）；包 id 校验会再拒掉一切非法形状，故无需 URL 解析。 */
function pathnameOf(request: IncomingMessage): string {
  const raw = request.url ?? ''
  const query = raw.indexOf('?')
  return query < 0 ? raw : raw.slice(0, query)
}

/**
 * 在 Harness `ctx.webServer` 上注册企业技能目录的同源只读路由。
 *
 * 浏览器不可见 Access Token，因此取数只能由 Host 代取：`GET <local>/skills` 与
 * `GET <local>/skills/{packageId}` 分别以 GET 调用中心 runtime 技能列表与详情，
 * 成功把 `{data}` 透传给 UI；上游 401 投影 401（未登录/会话过期），其余失败投影 503。
 * 所有投影在写状态行之前就算好响应体，异常不逃到 Cordis 顶层。
 *
 * 只读：技能包下载（`/versions/{id}/download`）不在此面内——一期员工端只复制装配指令，
 * 由用户自己的 Agent 会话落盘，Host 不代下载。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param platform - 代取令牌的平台请求面（组合层传 `EnterprisePlatformService`）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销这两条路由的 disposer。
 */
export function registerEnterpriseSkillRoutes(
  webServer: WebServerRoutePort,
  platform: EnterpriseSkillPlatformPort,
  onError?: (message: string, error: unknown) => void,
): () => void {
  const proxy = async (
    response: ServerResponse,
    localPath: string,
    upstreamPath: string,
  ): Promise<void> => {
    let status = 200
    let body: unknown
    try {
      const upstream = await platform.request(upstreamPath, {
        headers: { accept: 'application/json' },
        method: 'GET',
        redirect: 'error',
      })
      if (!upstream.ok) throw new SkillUpstreamError(upstream.status)
      body = { data: projectSkillEnvelope(await upstream.json()) }
    } catch (error) {
      const failure = projectSkillFailure(error)
      status = failure.status
      body = { error: { code: failure.code } }
      onError?.(`enterprise skills request projected to ${failure.status}`
        + ` [operation=GET ${localPath} step=${failure.step} status=${failure.status}]`
        + ` ${thrownErrorDiagnostics(error)}`, error)
    }
    writeJson(response, status, body)
  }

  const disposeList = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      await proxy(response, ENTERPRISE_SKILL_LOCAL_PATH, ENTERPRISE_SKILLS_LIST_PATH)
    },
  })

  const disposeDetail = webServer.register({
    kind: 'prefix',
    // 不带尾斜杠：引擎按「路径段前缀」匹配，带尾斜杠会让 /skills/<id> 在引擎层就 404。
    path: LOCAL_DETAIL_ROUTE,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      const packageId = pathnameOf(request).slice(LOCAL_DETAIL_PREFIX.length)
      if (!PACKAGE_ID.test(packageId)) {
        // 浏览器只可能拿列表里的 id 来取详情；非法形状在本地就拒，绝不带着任意路径打上游。
        writeJson(response, 400, { error: { code: 'ENT_INVALID_REQUEST' } })
        return
      }
      await proxy(
        response,
        `${ENTERPRISE_SKILL_LOCAL_PATH}/${packageId}`,
        `${ENTERPRISE_SKILLS_LIST_PATH}/${packageId}`,
      )
    },
  })

  return () => {
    disposeDetail()
    disposeList()
  }
}
