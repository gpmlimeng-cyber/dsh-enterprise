/**
 * [INPUT]: 依赖 node:crypto 的随机占位 bearer 与常量时间比较、node:http 的本地服务器、protocol/error-codes 的稳定码、protocol/http 的 EnterpriseRequestInit、protocol/types 的三条网关路由
 * [OUTPUT]: 对外提供 startEnterpriseGatewayProxy、EnterpriseGatewayProxy/EnterpriseGatewayProxyPort 类型与 isLoopbackAddress
 * [POS]: gateway 的 Host 私有传输层；只做来源与路径白名单、占位 bearer 鉴权与字节透传，既不解析也不自行发请求，LLM wire 语义全归官方 pi-ai
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { EnterpriseClientErrorCode } from '../protocol/error-codes.js'
import { EnterprisePlatformError } from '../protocol/envelope.js'
import type { EnterpriseRequestInit } from '../protocol/http.js'
import { ENTERPRISE_GATEWAY_ROUTES } from '../protocol/types.js'

/** 代理握有的平台能力：真实令牌只在这里逐请求注入，绝不进入任何回给浏览器的字节。 */
export interface EnterpriseGatewayProxyPort {
  accessToken(): string | null
  request(path: string, init?: EnterpriseRequestInit): Promise<Response>
}

export interface EnterpriseGatewayProxy {
  readonly baseURL: string
  readonly authorization: string
  dispose(): Promise<void>
}

export interface EnterpriseGatewayProxyOptions {
  /** 缺省 0（随机端口）；只绑定 127.0.0.1。 */
  readonly port?: number
  readonly platform: EnterpriseGatewayProxyPort
  /**
   * 与平台共用的 fetch 实现；代理自身不使用它。
   * 保留此字段是 INTERFACES §3 的签名约束：唯一 HTTP 出口是 platform.request，
   * 代理直接发请求就会绕过控制面的 Bearer 注入、超时与 401 单次续期重放。
   */
  readonly fetch?: typeof globalThis.fetch
}

const LOOPBACK_HOST = '127.0.0.1'
const ROUTE_PREFIX = '/enterprise/gateway/v1'
const MAX_REQUEST_BYTES = 10 * 1024 * 1024
/** 判超限后继续排空的上限；超过即放弃连接，避免本机恶意客户端用无限流拖住进程。 */
const MAX_DRAIN_BYTES = MAX_REQUEST_BYTES * 2
const ALLOWED_PATHS: ReadonlySet<string> = new Set(Object.values(ENTERPRISE_GATEWAY_ROUTES))

/** 白名单放行的请求头；authorization 刻意不在其中，占位 bearer 不得抵达中心。 */
const FORWARDED_HEADERS = [
  'accept',
  'content-type',
  'anthropic-beta',
  'anthropic-version',
  'idempotency-key',
  'openai-organization',
  'openai-project',
  'session_id',
  'x-client-request-id',
  'x-session-affinity',
  'x-session-id',
] as const

/** 内核给出的来源地址是否属于 loopback（127.0.0.0/8 与 ::1，含 IPv4 映射形态）。 */
export function isLoopbackAddress(address: string | null | undefined): boolean {
  if (address === null || address === undefined || address.length === 0) return false
  const normalized = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  if (normalized === '::1') return true
  return normalized.startsWith('127.')
}

/**
 * 浏览器/WebView 发起的请求一定带 Origin，官方 SDK 的 Node fetch 不带。
 * 依据 Fetch 规范：非 GET/HEAD 请求一律附加 Origin（同源 POST 亦然），本代理只放行 POST。
 * 不能看 Sec-Fetch-*：Node 自带 fetch 也会发 `Sec-Fetch-Mode: cors`。
 * 本代理只服务本机 Host 进程；否则任何页面脚本都能凭宿主配置里的占位 bearer 花掉员工配额。
 */
function isBrowserRequest(request: IncomingMessage): boolean {
  return request.headers.origin !== undefined
}

/** 常量时间比较占位 bearer，避免用比较耗时泄露前缀。 */
function authorized(request: IncomingMessage, expected: Buffer): boolean {
  const actual = request.headers.authorization
  if (typeof actual !== 'string') return false
  const received = Buffer.from(actual)
  return received.length === expected.length && timingSafeEqual(received, expected)
}

/**
 * 把请求路径收敛到三条契约路由。
 * Anthropic SDK 会自行在 baseURL 后补 /v1/messages，个别配置会把 /v1 拼两次；
 * 这里容忍一层重复，其余路径一律拒绝。
 */
function gatewayPath(pathname: string): string | undefined {
  if (ALLOWED_PATHS.has(pathname)) return pathname
  const nested = `${ROUTE_PREFIX}/v1`
  if (!pathname.startsWith(`${nested}/`)) return undefined
  const collapsed = `${ROUTE_PREFIX}${pathname.slice(nested.length)}`
  return ALLOWED_PATHS.has(collapsed) ? collapsed : undefined
}

/** 原样转发可识别的客户端头，并补齐契约要求的 SSE 接受与幂等键。 */
function headersOf(request: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers[name]
    if (typeof value === 'string' && value.length > 0) headers[name] = value
  }
  headers.accept = 'text/event-stream, application/json'
  if (headers['idempotency-key'] === undefined) headers['idempotency-key'] = randomUUID()
  return headers
}

/**
 * 限长读取请求体：超限后不再累积，但仍排空到排空上限，好让 413 能干净写回；
 * 排空也超限时提前退出（for-await 的 return 会销毁请求），放弃连接而不是无限收字节。
 */
async function readLimited(request: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  let oversized = false
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += bytes.byteLength
    if (oversized) {
      if (total > MAX_DRAIN_BYTES) break
      continue
    }
    if (total > MAX_REQUEST_BYTES) {
      oversized = true
      chunks.length = 0
      continue
    }
    chunks.push(bytes)
  }
  return oversized ? undefined : Buffer.concat(chunks)
}

interface WriteOptions {
  readonly requestId?: string
  readonly retryAfter?: string
  /** 请求体未读完时必须关闭连接，否则残余字节会被当作下一个请求。 */
  readonly close?: boolean
}

function writeJson(response: ServerResponse, status: number, value: unknown, options: WriteOptions = {}): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    ...(options.requestId === undefined ? {} : { 'x-request-id': options.requestId }),
    ...(options.retryAfter === undefined ? {} : { 'retry-after': options.retryAfter }),
    ...(options.close === true ? { connection: 'close' } : {}),
  })
  response.end(JSON.stringify(value))
}

/** 统一失败信封；message 只放已脱敏文案。 */
function writeError(
  response: ServerResponse,
  status: number,
  code: EnterpriseClientErrorCode,
  message: string,
  options: WriteOptions & { readonly retryable?: boolean; readonly marker?: string } = {},
): void {
  writeJson(
    response,
    status,
    {
      error: {
        code,
        message,
        ...(options.retryable === undefined ? {} : { retryable: options.retryable }),
        ...(options.marker === undefined ? {} : { type: options.marker }),
      },
    },
    options,
  )
}

/** 真实令牌绝不允许出现在回给本机客户端的文案里；命中即替换。 */
function redactToken(text: string, token: string | null): string {
  return token === null || token.length === 0 ? text : text.split(token).join('[redacted]')
}

function writePlatformError(response: ServerResponse, error: unknown, token: string | null): void {
  if (error instanceof EnterprisePlatformError) {
    writeError(response, error.httpStatus ?? 503, error.code, redactToken(error.message, token), {
      retryable: error.retryable,
      ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
      ...(error.retryAfter === undefined ? {} : { retryAfter: error.retryAfter }),
      // dshent 约定：不可重试的 429 标注终态配额。官方 0.1.5-rc.2 + pi-ai 0.85.1
      // 目前按错误文案判定可重试性，此标记只为兼容保留，不改写中心文案。
      ...(error.httpStatus === 429 && !error.retryable ? { marker: 'quota_exceeded' } : {}),
    })
    return
  }
  writeError(response, 503, 'ENT_PLATFORM_UNAVAILABLE', '企业控制面不可用', { retryable: true })
}

/**
 * 失败路径统一入口：已经发过头或连接已销毁时只销毁连接，
 * 否则写契约失败信封。无论哪条路径都不允许把异常抛回事件循环。
 */
function failRequest(response: ServerResponse, error: unknown, token: string | null): void {
  if (response.headersSent || response.destroyed) {
    response.destroy()
    return
  }
  writePlatformError(response, error, token)
}

/**
 * 逐块转发上游响应：读到一块写一块，绝不等待整体完成，
 * 因此 SSE 首事件与上游首字节同时到达，长回答也不会在本代理积压成内存。
 */
async function relay(upstream: Response, response: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {
    'cache-control': 'no-store',
    'content-type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
  }
  const requestId = upstream.headers.get('x-request-id')
  if (requestId !== null) headers['x-request-id'] = requestId
  const retryAfter = upstream.headers.get('retry-after')
  if (retryAfter !== null) headers['retry-after'] = retryAfter
  response.writeHead(upstream.status, headers)
  if (upstream.body === null) {
    response.end()
    return
  }
  // 立刻把响应头交给客户端：否则首字节会被压在首个 body 分块之后，
  // 上游静默期里 adapter 的流式请求会一直看不到响应头。
  response.flushHeaders()
  const reader = upstream.body.getReader()
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      if (response.destroyed) break
      response.write(Buffer.from(item.value))
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  if (!response.writableEnded && !response.destroyed) response.end()
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  platform: EnterpriseGatewayProxyPort,
  expected: Buffer,
): Promise<void> {
  if (!isLoopbackAddress(request.socket.remoteAddress) || isBrowserRequest(request)) {
    writeError(response, 403, 'ENT_PERMISSION_DENIED', '企业模型代理只服务本机 Host 进程')
    return
  }
  if (!authorized(request, expected)) {
    writeError(response, 403, 'ENT_PERMISSION_DENIED', '企业模型代理需要本机占位凭据')
    return
  }
  const path = gatewayPath(new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`).pathname)
  if (request.method !== 'POST' || path === undefined) {
    writeError(response, 404, 'ENT_RESOURCE_NOT_FOUND', '企业模型代理没有该路由')
    return
  }
  const body = await readLimited(request)
  if (body === undefined) {
    writeError(response, 413, 'ENT_REQUEST_TOO_LARGE', '企业模型请求体超过本机上限', { close: true })
    return
  }
  const abort = new AbortController()
  // 客户端断开时立即掐断上游，避免在途请求继续占用配额与连接。
  request.on('error', () => abort.abort())
  response.on('close', () => {
    if (!response.writableEnded) abort.abort()
  })
  try {
    const upstream = await platform.request(path, {
      method: 'POST',
      headers: headersOf(request),
      body: new Uint8Array(body),
      signal: abort.signal,
      json: false,
    })
    await relay(upstream, response)
  } catch (error) {
    failRequest(response, error, platform.accessToken())
  }
}

/**
 * 启动官方 adapter 到企业中心的 Host 私有认证代理。
 * 不变量：只绑定 127.0.0.1、端口缺省随机、只放行 POST + 三条契约路由、
 * 请求体与响应流逐字节透传、真实令牌永不离开 Host 进程。
 */
export async function startEnterpriseGatewayProxy(
  options: EnterpriseGatewayProxyOptions,
): Promise<EnterpriseGatewayProxy> {
  const authorization = `Bearer ${randomBytes(32).toString('base64url')}`
  const expected = Buffer.from(authorization)
  const server = createServer((request, response) => {
    // 兜底监听：客户端半途断开时 IncomingMessage/OutgoingMessage 会 emit('error')，
    // 没有监听器的 'error' 会变成未捕获异常并掀翻宿主进程。清理逻辑另走 'close' 与 readLimited。
    request.on('error', () => undefined)
    response.on('error', () => undefined)
    handleRequest(request, response, options.platform, expected).catch((error: unknown) => {
      failRequest(response, error, options.platform.accessToken())
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, LOOPBACK_HOST, () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', '企业模型代理未能绑定本机端口')
  }
  let disposal: Promise<void> | undefined
  return {
    baseURL: `http://${LOOPBACK_HOST}:${String(address.port)}${ROUTE_PREFIX}`,
    authorization,
    dispose: (): Promise<void> =>
      (disposal ??= new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error === undefined) resolve()
          else reject(error)
        })
        // 关闭在途连接：keep-alive 与正在流式推送的 SSE 一并释放。
        server.closeAllConnections()
      })),
  }
}
