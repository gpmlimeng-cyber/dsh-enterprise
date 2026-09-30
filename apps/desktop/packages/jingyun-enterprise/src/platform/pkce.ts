/**
 * [INPUT]: 依赖 node:crypto 的熵与 sha256，依赖 node:http 在 127.0.0.1 上监听一次性回调
 * [OUTPUT]: 对外提供 createCodeVerifier/codeChallengeS256/createState/createTransactionId 与 startLoopbackCallback 回调对象
 * [POS]: platform 层的浏览器登录原语；只管理 verifier/state/回调生命周期，不接触任何令牌，state 相等性由 auth 编排层裁决
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'

import { EnterprisePlatformError } from '../protocol/envelope.js'

/** 默认回调路径；与契约 authorize 的 redirect_uri 约定一致。 */
export const ENTERPRISE_CALLBACK_PATH = '/enterprise/auth/callback'
/** RFC 7636 unreserved 字符集。 */
const URL_SAFE = /^[A-Za-z0-9._~-]+$/
const MIN_VERIFIER = 43
const MAX_VERIFIER = 128
const TOKEN_BYTES = 32
const MAX_PORT = 65_535

type LoopbackFailureCode = 'ENT_AUTH_TIMEOUT' | 'ENT_AUTH_CANCELLED' | 'ENT_AUTH_CODE_INVALID'

/** 一次性浏览器回调；`waitForCode` 可被 abort 打断，`close` 幂等。 */
export interface EnterpriseLoopbackCallback {
  readonly redirectUri: string
  waitForCode(signal: AbortSignal): Promise<{ code: string; state: string }>
  close(): Promise<void>
}

export interface EnterpriseLoopbackOptions {
  /** 0 或缺省表示由内核分配随机端口，避免固定端口冲突。 */
  readonly port?: number
  readonly timeoutMs: number
  /** 回调路径；缺省使用 ENTERPRISE_CALLBACK_PATH。 */
  readonly path?: string
  /** 创建即取消：已 abort 时立即释放端口并拒绝。 */
  readonly signal?: AbortSignal
}

function failureText(code: LoopbackFailureCode): string {
  if (code === 'ENT_AUTH_TIMEOUT') return '企业登录回调等待超时'
  if (code === 'ENT_AUTH_CANCELLED') return '企业登录已取消'
  return '企业登录回调缺少授权码'
}

/** 生成 32 字节熵的 PKCE code verifier（base64url，43 字符，落在 unreserved 字符集内）。 */
export function createCodeVerifier(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** RFC 7636 S256：base64url(sha256(ASCII(verifier)))，不带 padding。 */
export function codeChallengeS256(verifier: string): string {
  if (verifier.length < MIN_VERIFIER || verifier.length > MAX_VERIFIER || !URL_SAFE.test(verifier)) {
    throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'PKCE code verifier 不符合 RFC 7636 字符集或长度')
  }
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/** 生成 32–64 字符的 state（base64url 43 字符）。 */
export function createState(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** 生成 32–64 字符的登录事务标识。 */
export function createTransactionId(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/**
 * 启动只绑定 127.0.0.1 的一次性回调监听。
 *
 * 不变量：
 * 1. 只接受 `GET` 且路径精确等于配置路径，其余请求以 404/405 拒绝且不结束等待；
 * 2. 回调缺 `code` 视为协议失败（ENT_AUTH_CODE_INVALID）并立即释放端口；
 * 3. 超时（ENT_AUTH_TIMEOUT）、外部 abort 或显式 close（ENT_AUTH_CANCELLED）都会关闭服务器；
 * 4. 回调结果原样交给编排层，本模块不做 state 比较，也不把查询串写入任何日志。
 */
export async function startLoopbackCallback(
  options: EnterpriseLoopbackOptions,
): Promise<EnterpriseLoopbackCallback> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'timeoutMs 必须是正整数')
  }
  const port = options.port ?? 0
  if (!Number.isSafeInteger(port) || port < 0 || port > MAX_PORT) {
    throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'port 必须落在 0–65535')
  }
  const path = options.path ?? ENTERPRISE_CALLBACK_PATH
  if (!path.startsWith('/') || path.length < 2) {
    throw new EnterprisePlatformError('ENT_INVALID_REQUEST', '回调路径必须以 / 开头')
  }

  let settled = false
  let timer: NodeJS.Timeout | undefined
  let server: Server | undefined
  let resolveResult: (value: { code: string; state: string }) => void = () => undefined
  let rejectResult: (reason: unknown) => void = () => undefined
  const pending = new Promise<{ code: string; state: string }>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  // 等待方可能因超时先行结束；挂空 catch 防止未处理的 Promise 拒绝击穿宿主进程。
  void pending.catch(() => undefined)

  function closeServer(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    options.signal?.removeEventListener('abort', onAbort)
    const current = server
    server = undefined
    if (current === undefined) return
    try {
      current.closeAllConnections()
      current.close()
    } catch {
      // 端口释放失败不影响已经结算的登录结果。
    }
  }

  function settleFailure(code: LoopbackFailureCode): void {
    if (settled) return
    settled = true
    rejectResult(new EnterprisePlatformError(code, failureText(code)))
    closeServer()
  }

  function onAbort(): void {
    settleFailure('ENT_AUTH_CANCELLED')
  }

  server = createServer((request, response) => {
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://127.0.0.1')
    } catch {
      response.writeHead(400).end()
      return
    }
    if (request.method !== 'GET') {
      response.writeHead(405).end()
      return
    }
    if (url.pathname !== path) {
      response.writeHead(404).end()
      return
    }
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') ?? ''
    if (code === null || code.length === 0 || code.length > 2048) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Missing authorization code')
      settleFailure('ENT_AUTH_CODE_INVALID')
      return
    }
    if (settled) {
      response.writeHead(410).end()
      return
    }
    settled = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    options.signal?.removeEventListener('abort', onAbort)
    resolveResult({ code, state })
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    // 等响应刷出后再释放监听端口，避免浏览器拿到 connection reset。
    response.end(
      '<!doctype html><meta charset="utf-8"><title>DSH Enterprise</title><p>登录已完成，可以关闭此窗口。',
      () => {
        closeServer()
      },
    )
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const current = server as Server
      current.once('error', reject)
      current.listen(port, '127.0.0.1', () => {
        current.off('error', reject)
        resolve()
      })
    })
  } catch {
    closeServer()
    throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', '无法在 127.0.0.1 上监听企业登录回调端口', {
      retryable: true,
    })
  }

  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted === true) {
    settleFailure('ENT_AUTH_CANCELLED')
    throw new EnterprisePlatformError('ENT_AUTH_CANCELLED', failureText('ENT_AUTH_CANCELLED'))
  }

  const address = server?.address()
  if (address === null || address === undefined || typeof address === 'string') {
    closeServer()
    throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', '企业登录回调监听未暴露 TCP 端口', {
      retryable: true,
    })
  }

  timer = setTimeout(() => {
    settleFailure('ENT_AUTH_TIMEOUT')
  }, options.timeoutMs)

  return {
    redirectUri: `http://127.0.0.1:${String(address.port)}${path}`,
    waitForCode(signal: AbortSignal): Promise<{ code: string; state: string }> {
      if (signal.aborted) {
        settleFailure('ENT_AUTH_CANCELLED')
        return Promise.reject(
          new EnterprisePlatformError('ENT_AUTH_CANCELLED', failureText('ENT_AUTH_CANCELLED')),
        )
      }
      signal.addEventListener('abort', onAbort, { once: true })
      return pending.finally(() => {
        signal.removeEventListener('abort', onAbort)
      })
    },
    async close(): Promise<void> {
      settleFailure('ENT_AUTH_CANCELLED')
      closeServer()
    },
  }
}
