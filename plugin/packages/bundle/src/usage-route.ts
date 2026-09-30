/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与异常摘要串
 * [OUTPUT]: 对外提供中心 `usage/me` 的本地只读镜像 `registerEnterpriseUsageRoute`，以及可单测的失败投影 `projectUsageFailure` 与信封投影 `projectUsageEnvelope`
 * [POS]: bundle 的用量只读投影层——Access Token 只存在于平台 Service，本文件既不接触凭据也不重算配额语义，只把上游结果重封成本地 `{data}` 信封
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ServerResponse } from 'node:http'
import { thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/** 中心 `GET /enterprise/api/v1/usage/me`；与 contracts 的 paths/usage 真源同名。 */
export const ENTERPRISE_USAGE_ME_PATH = '/enterprise/api/v1/usage/me'

/** 本地只读镜像路径；浏览器只认这一条同源路由，取数仍由 Host 代取令牌。 */
export const ENTERPRISE_USAGE_LOCAL_PATH = '/enterprise/api/v1/local/usage'

/**
 * 代取令牌所需的最小平台面；`EnterprisePlatformService.request` 结构性满足它，
 * 因此组合层直接传平台 Service，不必为本路由新开一条取数出口。
 */
export interface EnterpriseUsagePlatformPort {
  request(input: string, init?: RequestInit): Promise<Response>
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 与 account-state 的错误码形状门禁同源：只回显受控标识符，任意外字符串不进响应体。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/** 与 account-origin 内部 helper 等价的 20 行小工具；两份私有实现好过为复用而反向依赖。 */
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
class UsageUpstreamError extends Error {
  constructor(readonly httpStatus: number) {
    super(`enterprise usage upstream returned ${httpStatus}`)
    this.name = 'UsageUpstreamError'
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
export interface UsageFailureProjection {
  readonly status: 401 | 503
  readonly code: string
  readonly step: 'upstream-unauthorized' | 'upstream-unauthorized-expired' | 'upstream-failed'
}

/**
 * 失败投影的唯一判断点：认证拒绝（会话过期/缺失/未登录，含本地「平台未就绪」）投影 401，
 * 其余一切失败投影 503。503 保留受控形状的上游错误码（如设备撤销），
 * 未知或非法形状一律回落到本地稳定码 `ENT_PLATFORM_UNAVAILABLE`。
 *
 * @param error - 取数路径逃出来的异常。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectUsageFailure(error: unknown): UsageFailureProjection {
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
 * @returns 上游 `data` 字段，原样透传不做配额语义。
 * @throws {TypeError} 正文不是对象或缺少 `data`。
 */
export function projectUsageEnvelope(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new TypeError('enterprise usage response must be an envelope object')
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new TypeError('enterprise usage response is missing the data field')
  }
  return (payload as { readonly data: unknown }).data
}

/**
 * 在 Harness `ctx.webServer` 上注册本人用量的同源只读路由。
 *
 * 浏览器不可见 Access Token，因此取数只能由 Host 代取：本路由以 GET 调用中心
 * `usage/me`，成功把 `{data}` 透传给 UI；上游 401 投影 401（未登录/会话过期），
 * 其余失败投影 503。所有投影在写状态行之前就算好响应体，异常不逃到 Cordis 顶层。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param platform - 代取令牌的平台请求面（组合层传 `EnterprisePlatformService`）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseUsageRoute(
  webServer: WebServerRoutePort,
  platform: EnterpriseUsagePlatformPort,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_USAGE_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      let status = 200
      let body: unknown
      try {
        const upstream = await platform.request(ENTERPRISE_USAGE_ME_PATH, {
          headers: { accept: 'application/json' },
          method: 'GET',
          redirect: 'error',
        })
        if (!upstream.ok) throw new UsageUpstreamError(upstream.status)
        body = { data: projectUsageEnvelope(await upstream.json()) }
      } catch (error) {
        const failure = projectUsageFailure(error)
        status = failure.status
        body = { error: { code: failure.code } }
        onError?.(`enterprise usage request projected to ${failure.status}`
          + ` [operation=GET ${ENTERPRISE_USAGE_LOCAL_PATH} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
      writeJson(response, status, body)
    },
  })
}
