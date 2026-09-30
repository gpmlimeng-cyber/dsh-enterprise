/**
 * [INPUT]: 依赖 protocol/error-codes 的码联合与协议层的 fetch 观测值
 * [OUTPUT]: 对外提供成功信封解包、失败信封到 EnterprisePlatformError 的构造、Retry-After 保留
 * [POS]: protocol 层的报文边界；所有中心响应必须经此进入业务层，业务层不得再自行解析 error 字段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ENTERPRISE_ERROR_CODES,
  type EnterpriseClientErrorCode,
  type EnterpriseErrorCode,
} from './error-codes.js'

/** 中心返回的失败主体。 */
interface WireError {
  readonly code?: unknown
  readonly message?: unknown
  readonly requestId?: unknown
  readonly retryable?: unknown
}

/** 携带契约码、HTTP 状态与 requestId 的稳定失败；不携带响应正文或凭据。 */
export class EnterprisePlatformError extends Error {
  readonly code: EnterpriseClientErrorCode
  readonly retryable: boolean
  // 显式 `| undefined` 而非可选属性：目标工作区开启 exactOptionalPropertyTypes，
  // 可选属性不允许显式赋值 undefined，会迫使每个赋值点写条件展开。
  readonly httpStatus: number | undefined
  readonly requestId: string | undefined
  readonly retryAfter: string | undefined

  constructor(
    code: EnterpriseClientErrorCode,
    message: string,
    options: {
      readonly retryable?: boolean
      readonly httpStatus?: number
      readonly requestId?: string
      readonly retryAfter?: string
    } = {},
  ) {
    super(message)
    this.name = 'EnterprisePlatformError'
    this.code = code
    this.retryable = options.retryable ?? false
    this.httpStatus = options.httpStatus
    this.requestId = options.requestId
    this.retryAfter = options.retryAfter
  }
}

const KNOWN_CODES = new Set<string>(ENTERPRISE_ERROR_CODES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 只有契约枚举内的码才被信任；未知码一律折叠为 ENT_NETWORK_ERROR 以免伪造码穿透 UI。 */
function normalizeCode(code: unknown): EnterpriseErrorCode | 'ENT_NETWORK_ERROR' {
  if (typeof code === 'string' && KNOWN_CODES.has(code)) {
    return code as EnterpriseErrorCode
  }
  return 'ENT_NETWORK_ERROR'
}

/**
 * 解包 `{ data, requestId }` 成功信封。
 * @throws EnterprisePlatformError 当主体不是合法信封时（ENT_RESPONSE_INVALID）。
 */
export function unwrapEnvelope<T>(payload: unknown): T {
  if (!isRecord(payload) || !('data' in payload)) {
    throw new EnterprisePlatformError(
      'ENT_RESPONSE_INVALID',
      '企业服务响应缺少 data 信封',
      { retryable: false },
    )
  }
  return payload.data as T
}

/** 从 `{ error: {...} }` 主体构造稳定失败；缺失字段按契约兜底。 */
export function toPlatformError(
  payload: unknown,
  httpStatus: number,
  headers?: Headers,
): EnterprisePlatformError {
  const retryAfter = headers?.get('retry-after') ?? undefined
  const wire: WireError = isRecord(payload) && isRecord(payload.error)
    ? (payload.error as WireError)
    : {}
  const code = normalizeCode(wire.code)
  const message = typeof wire.message === 'string' && wire.message.length > 0
    ? wire.message
    : `企业服务返回失败（HTTP ${String(httpStatus)}）`
  const retryable = typeof wire.retryable === 'boolean'
    ? wire.retryable
    : httpStatus === 429 || httpStatus === 503
  return new EnterprisePlatformError(code, message, {
    retryable,
    httpStatus,
    ...(typeof wire.requestId === 'string' ? { requestId: wire.requestId } : {}),
    ...(retryAfter === undefined ? {} : { retryAfter }),
  })
}

/** 网络层异常（DNS/ECONNREFUSED/超时）统一折叠，避免把底层错误文案泄露给 UI。 */
export function toNetworkError(cause: unknown): EnterprisePlatformError {
  const aborted = isRecord(cause) && cause.name === 'AbortError'
  return new EnterprisePlatformError(
    aborted ? 'ENT_AUTH_TIMEOUT' : 'ENT_NETWORK_ERROR',
    aborted ? '企业服务请求超时' : '企业服务不可达',
    { retryable: true },
  )
}
