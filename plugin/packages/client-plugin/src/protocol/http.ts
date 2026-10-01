/**
 * [INPUT]: 依赖 protocol/envelope 的信封解包与错误构造，依赖全局 fetch 与 AbortSignal
 * [OUTPUT]: 对外提供带超时、Bearer 注入、401 单次续期重放的 EnterpriseHttpClient；非 raw 出口把非 2xx 折叠为 EnterprisePlatformError，raw 出口（requestResponse）原样返回 Response
 * [POS]: protocol 层的唯一 HTTP 出口；业务模块不得自行调用 fetch，以保证重放与错误折叠一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  EnterprisePlatformError,
  toNetworkError,
  toPlatformError,
  unwrapEnvelope,
} from './envelope.js'

/** 401 续期钩子：返回新 accessToken，返回 null 表示无法续期。 */
export type EnterpriseTokenRefresher = () => Promise<string | null>

export interface EnterpriseHttpClientOptions {
  /** 中心基址，例如 `http://192.168.1.50:8080`；尾斜杠会被规范化。 */
  readonly baseUrl: string
  readonly timeoutMs?: number
  readonly fetch?: typeof globalThis.fetch
  /** 每次请求现取，避免缓存过期令牌。 */
  readonly accessToken?: () => string | null
  /** 仅在没有显式 Authorization 头时用于 401 的一次性续期重放。 */
  readonly onUnauthorized?: EnterpriseTokenRefresher
  /** 默认 `dsh-desktop`；管理端 CLI 复用本客户端时改为 `ent-admin-cli`。 */
  readonly clientId?: string
}

const DEFAULT_TIMEOUT_MS = 30_000

/** JSON/查询参数以外的请求体由调用方自行序列化；此处只负责传输与错误归一。 */
export interface EnterpriseRequestInit {
  readonly method?: string
  readonly body?: BodyInit | null
  readonly headers?: Record<string, string>
  readonly signal?: AbortSignal
  /** 默认 true；流式转发时必须置 false，交由调用方处理 SSE。 */
  readonly json?: boolean
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

/** 校验并规范化用户填写的服务地址；只接受 http/https 且必须可被 URL 解析。 */
export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new EnterprisePlatformError('ENT_SERVER_URL_INVALID', '企业服务地址为空')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new EnterprisePlatformError('ENT_SERVER_URL_INVALID', '企业服务地址不是合法 URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new EnterprisePlatformError('ENT_SERVER_URL_INVALID', '企业服务地址只支持 http 或 https')
  }
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new EnterprisePlatformError('ENT_SERVER_URL_INVALID', '企业服务地址不得携带查询串或片段')
  }
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
  return path.length === 0 ? parsed.origin : joinUrl(parsed.origin, path)
}

/**
 * 企业控制面 HTTP 客户端。
 *
 * 关键不变量：
 * 1. 每个请求都有超时，且超时后 abort 上游，避免悬挂连接耗尽句柄；
 * 2. 401 只重放一次（且仅在提供了 onUnauthorized 时），防止续期风暴；
 * 3. 任何非 2xx 都折叠成 EnterprisePlatformError，业务层永远看不到裸 Response。
 */
export class EnterpriseHttpClient {
  private baseUrlInternal: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly accessToken: () => string | null
  private readonly onUnauthorized?: EnterpriseTokenRefresher
  private readonly clientId: string
  private disposed = false

  constructor(options: EnterpriseHttpClientOptions) {
    this.baseUrlInternal = normalizeServerUrl(options.baseUrl)
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.accessToken = options.accessToken ?? (() => null)
    this.clientId = options.clientId ?? 'dsh-desktop'
    if (options.onUnauthorized !== undefined) {
      this.onUnauthorized = options.onUnauthorized
    }
  }

  get baseUrl(): string {
    return this.baseUrlInternal
  }

  get clientIdValue(): string {
    return this.clientId
  }

  setBaseUrl(next: string): void {
    this.baseUrlInternal = normalizeServerUrl(next)
  }

  /** 释放后所有请求立即失败，用于 Host 卸载时切断在途流量。 */
  dispose(): void {
    this.disposed = true
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new EnterprisePlatformError('ENT_PLATFORM_DISPOSED', '企业平台客户端已释放')
    }
  }

  /**
   * 解析成功的 JSON 主体。网关流式转发请使用 `requestResponse`。
   */
  async request<T>(path: string, init: EnterpriseRequestInit = {}): Promise<T> {
    const response = await this.execute(path, init)
    const text = await response.text()
    let payload: unknown
    try {
      payload = text.length === 0 ? undefined : JSON.parse(text)
    } catch {
      throw new EnterprisePlatformError('ENT_RESPONSE_INVALID', '企业服务响应不是合法 JSON', {
        httpStatus: response.status,
      })
    }
    return unwrapEnvelope<T>(payload)
  }

  /** 返回原始 Response 供 SSE/二进制使用；调用方负责 body 消费与释放。 */
  async requestResponse(path: string, init: EnterpriseRequestInit = {}): Promise<Response> {
    return this.execute(path, init, true)
  }

  private async execute(
    path: string,
    init: EnterpriseRequestInit,
    raw = false,
    allowReplay = true,
  ): Promise<Response> {
    this.assertUsable()
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers }
    if (headers.authorization === undefined) {
      const token = this.accessToken()
      if (token !== null && token.length > 0) {
        headers.authorization = `Bearer ${token}`
      }
    }
    if (init.body !== undefined && init.body !== null && headers['content-type'] === undefined && init.json !== false) {
      headers['content-type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
    }, this.timeoutMs)
    const external = init.signal
    const onExternalAbort = (): void => {
      controller.abort()
    }
    external?.addEventListener('abort', onExternalAbort, { once: true })

    let response: Response
    try {
      response = await this.fetchImpl(joinUrl(this.baseUrlInternal, path), {
        method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
        headers,
        ...(init.body === undefined ? {} : { body: init.body }),
        signal: controller.signal,
      })
    } catch (error) {
      throw toNetworkError(error)
    } finally {
      clearTimeout(timer)
      external?.removeEventListener('abort', onExternalAbort)
    }

    if (response.ok) {
      return response
    }

    const retryAfter = response.headers.get('retry-after') ?? undefined
    let payload: unknown
    try {
      const text = await response.clone().text()
      payload = text.length === 0 ? undefined : JSON.parse(text)
    } catch {
      payload = undefined
    }

    // 401 单次续期重放：仅针对未显式提供 Authorization 的场景，避免覆盖调用方身份。
    if (
      response.status === 401 &&
      allowReplay &&
      init.headers?.authorization === undefined &&
      this.onUnauthorized !== undefined &&
      !raw
    ) {
      const refreshed = await this.onUnauthorized()
      if (refreshed !== null && refreshed.length > 0) {
        return this.execute(path, init, raw, false)
      }
    }

    // raw 出口（requestResponse / 网关 SSE 转发）按契约「返回原始 Response 供调用方消费」：
    // 把状态码交回调用方，不在传输层折叠为异常——否则 control-plane 补的 401 单次续期
    // 重放分支永远收不到 Response（401 在此被提前抛出）。
    if (raw) return response

    throw toPlatformError(payload, response.status, retryAfter === undefined ? undefined : response.headers)
  }
}
