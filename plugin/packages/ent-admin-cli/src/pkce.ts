/**
 * [INPUT]: 依赖 node:crypto 与 node:http 回环，依赖 callback-page 判定回调语言（缺省中文）并渲染浏览器可见结果页
 * [OUTPUT]: 对外提供 createPkceS256、startLoopbackCallback、PkceLoopbackError 与回调语言诊断契约
 * [POS]: ent-admin-cli 的 PKCE 原语，语义对齐 platform-client/T05，不依赖 Cordis
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  pickCallbackLocale,
  renderCallbackPage,
  type CallbackBranding,
  type CallbackLocale,
  type CallbackOutcome,
} from './callback-page.js'

export type PkceLoopbackErrorCode =
  | 'ENT_AUTH_CANCELLED'
  | 'ENT_AUTH_CALLBACK_INVALID'
  | 'ENT_AUTH_STATE_INVALID'
  | 'ENT_AUTH_TIMEOUT'

export class PkceLoopbackError extends Error {
  constructor(
    readonly code: PkceLoopbackErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PkceLoopbackError'
  }
}

export interface PkceS256Pair {
  readonly verifier: string
  readonly challenge: string
  readonly method: 'S256'
}

export interface LoopbackCallbackResult {
  readonly code: string
  readonly state: string
}

export interface LoopbackCallback {
  readonly redirectUri: string
  readonly result: Promise<LoopbackCallbackResult>
  cancel(): void
}

/**
 * 回环回调收到的语言线索与其判定结论：下次「页面为何是英文」无需复现即可定性。
 * 原文已在 pkce 侧截断到 {@link ACCEPT_LANGUAGE_LOG_LIMIT} 字符，且 `Accept-Language` 本身不含令牌。
 */
export interface CallbackRequestDiagnostics {
  /** 原始 `Accept-Language`，已截断；请求头缺失或非单值字符串时为 `''`。 */
  readonly acceptLanguage: string
  /** 据此判定的回调页语言。 */
  readonly locale: CallbackLocale
}

/** 诊断留痕的原文上限：足够看清语言列表，又不至于把畸形头整体灌进日志。 */
export const ACCEPT_LANGUAGE_LOG_LIMIT = 200

export interface LoopbackCallbackOptions {
  readonly expectedState: string
  readonly timeoutMs: number
  readonly signal?: AbortSignal
  /**
   * 结果页品牌来源；CLI 默认不提供，返回 null/undefined 或抛错都回落内置 `DSH Enterprise`，
   * 品牌永远不阻断登录结果页。
   */
  readonly branding?: () => Promise<CallbackBranding | null | undefined>
  /**
   * 回环回调的诊断留痕端口，由调用方绑定既有 stderr 日志；缺省即不留痕，不影响登录。
   * 只上报截断后的 `Accept-Language` 原文与判定结论，不含任何令牌。
   */
  readonly onCallbackRequest?: (info: CallbackRequestDiagnostics) => void
}

export function createPkceS256(entropy: Uint8Array = randomBytes(32)): PkceS256Pair {
  if (entropy.byteLength < 32) {
    throw new TypeError('PKCE entropy must contain at least 32 bytes')
  }
  const verifier = Buffer.from(entropy).toString('base64url')
  if (verifier.length < 43 || verifier.length > 128) {
    throw new TypeError('PKCE verifier must contain 43 to 128 ASCII characters')
  }
  return {
    verifier,
    challenge: createHash('sha256').update(verifier, 'ascii').digest('base64url'),
    method: 'S256',
  }
}

export async function startLoopbackCallback(options: LoopbackCallbackOptions): Promise<LoopbackCallback> {
  if (options.expectedState.length === 0) throw new TypeError('expectedState is required')
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive safe integer')
  }

  let server: Server
  let settled = false
  let resolveResult!: (value: LoopbackCallbackResult) => void
  let rejectResult!: (reason: PkceLoopbackError) => void
  const result = new Promise<LoopbackCallbackResult>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  let stopped = false
  const stopServer = (): void => {
    if (stopped) return
    stopped = true
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', cancel)
    server.closeAllConnections()
    server.close()
  }
  /**
   * 结算失败事务。`deferStop` 为 true 时把停监听交给响应刷出回调，
   * 否则浏览器可能只看到 connection reset 而看不到失败页。
   */
  const settleFailure = (error: PkceLoopbackError, deferStop = false): void => {
    if (settled) return
    settled = true
    rejectResult(error)
    if (!deferStop) stopServer()
  }
  const cancel = (): void => {
    settleFailure(new PkceLoopbackError('ENT_AUTH_CANCELLED', 'PKCE login was cancelled'))
  }
  const timeout = setTimeout(() => {
    settleFailure(new PkceLoopbackError('ENT_AUTH_TIMEOUT', 'PKCE callback timed out'))
  }, options.timeoutMs)

  /** 结果页是浏览器唯一可见面：先写完整 HTML，响应刷出后才释放端口。 */
  const respond = (response: ServerResponse, status: number, body: string): void => {
    const payload = Buffer.from(body, 'utf8')
    response.writeHead(status, {
      'cache-control': 'no-store',
      'content-length': payload.byteLength,
      'content-type': 'text/html; charset=utf-8',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    })
    // 正常刷出走 end 回调；浏览器中途断开时靠 close 事件兜底，端口不会悬着。
    response.once('close', stopServer)
    response.end(payload, () => stopServer())
  }

  /** 品牌只作装饰：取不到就用内置名，绝不因品牌故障改变结果页语义。 */
  const renderPage = async (outcome: CallbackOutcome, locale: CallbackLocale): Promise<string> => {
    let branding: CallbackBranding | null = null
    try {
      branding = (await options.branding?.()) ?? null
    } catch {
      branding = null
    }
    return renderCallbackPage({ branding, locale, outcome })
  }

  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const header = request.headers['accept-language']
    // 语言只判定一次，诊断留痕与实际渲染共用同一结论，避免日志与页面说法不一致。
    const acceptLanguage = typeof header === 'string' ? header : ''
    const locale = pickCallbackLocale(acceptLanguage)
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://127.0.0.1')
    } catch {
      response.writeHead(400).end()
      return
    }
    if (request.method !== 'GET' || url.pathname !== '/callback') {
      response.writeHead(404).end()
      return
    }
    // 只对真正的回环回调留痕，且只留原文截断与结论：Accept-Language 里没有令牌。
    options.onCallbackRequest?.({
      acceptLanguage: acceptLanguage.slice(0, ACCEPT_LANGUAGE_LOG_LIMIT),
      locale,
    })
    const state = url.searchParams.get('state')
    const code = url.searchParams.get('code')
    const reported = url.searchParams.get('error')
    if (settled) {
      // 已结算后仍挤进来的回调（例如成功响应刷出前的并发请求）不再兑现登录，只给一页明确结论。
      respond(response, 410, await renderPage({ reason: 'expired', status: 'failure' }, locale))
      return
    }
    if (state !== options.expectedState) {
      settleFailure(new PkceLoopbackError('ENT_AUTH_STATE_INVALID', 'PKCE callback state mismatch'), true)
      respond(response, 400, await renderPage({ reason: 'state', status: 'failure' }, locale))
      return
    }
    if (reported !== null || code === null || code.length === 0) {
      settleFailure(new PkceLoopbackError(
        'ENT_AUTH_CALLBACK_INVALID',
        reported === null ? 'PKCE callback code is missing' : 'PKCE callback reported an authorization error',
      ), true)
      respond(
        response,
        400,
        await renderPage({ reason: reported === null ? 'code' : 'error', status: 'failure' }, locale),
      )
      return
    }
    settled = true
    resolveResult({ code, state })
    respond(response, 200, await renderPage({ status: 'success' }, locale))
  }

  server = createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      if (!response.writableEnded) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        response.end()
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  }).catch((cause: unknown) => {
    clearTimeout(timeout)
    throw cause
  })

  options.signal?.addEventListener('abort', cancel, { once: true })
  if (options.signal?.aborted === true) cancel()
  const address = server.address()
  if (address === null || typeof address === 'string') {
    cancel()
    throw new Error('PKCE loopback listener did not expose a TCP port')
  }

  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    result,
    cancel,
  }
}
