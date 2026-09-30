/**
 * [INPUT]: 依赖 Node `node:crypto` 的 randomUUID、`node:http` 的请求/响应类型与 Buffer、platform-client 的 route port 与异常摘要串
 * [OUTPUT]: 对外提供中心 `POST /enterprise/api/v1/feedback` 的本地 multipart 透传 `registerEnterpriseFeedbackRoute`，以及可单测的 `enterpriseFeedbackImageKind` 魔数判定、`projectFeedbackAttachmentLimits` 本地限流、`projectFeedbackFailure` 失败投影、`parseFeedbackMultipart`/`buildFeedbackMultipart` 编解码与 `collectEnterpriseFeedbackDiagnostics`
 * [POS]: bundle 的反馈提交转发层——Access Token 只在平台 Service 内存，本文件既不让浏览器接触令牌、也不信任浏览器提交的 diagnostics：Host 就地做与中心同名（≤3 张 / 单张 ≤2 MiB / 位图魔数）的附件限流，再用自己采集的契约封闭键集覆盖 `metadata.diagnostics`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/** 中心 `POST /enterprise/api/v1/feedback`；与 contracts/paths/feedback 真源同名。 */
export const ENTERPRISE_FEEDBACK_CENTER_PATH = '/enterprise/api/v1/feedback'

/** 本地 multipart 透传路径；浏览器只认这一条同源路由，取令牌与限流都在 Host。 */
export const ENTERPRISE_FEEDBACK_LOCAL_PATH = '/enterprise/api/v1/local/feedback'

/** 与中心一致的附件上限：≤3 张、单张 ≤2 MiB（本地先失败，不把大文件推到中心）。 */
export const ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS = 3
export const ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024

/**
 * 有界读取上限：三张满额附件之外再留 1 MiB 给 metadata 与 multipart 分帧。
 * 超出即按「单张附件过大」投影，避免无限缓冲，也不给中心送去注定被拒的正文。
 */
export const ENTERPRISE_FEEDBACK_BODY_MAX_BYTES = ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS
  * ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES + 1024 * 1024

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 与 account-state/usage-route 的错误码形状门禁同源：只回显受控标识符。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/
/** contracts/paths/feedback.yaml 的 `Idempotency-Key` 形状：UUID v4，小写/大写都收，其余一律拒。 */
const IDEMPOTENCY_KEY_SHAPE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/
/** multipart boundary 的 RFC 2046 bchars 子集；浏览器边界都在其中，其余按畸形正文拒绝。 */
const BOUNDARY_SHAPE = /^[0-9A-Za-z'()+_,\-./:=? ]{1,70}$/

/** 契约 diagnostics 的逐字段形状（components/feedback.yaml#/FeedbackDiagnostics）。 */
const DIAGNOSTIC_SHAPES = {
  pluginVersion: /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/,
  hostVersion: /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/,
  os: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/,
  installationId: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/,
  lastErrorCode: /^[A-Z][A-Z0-9_]{0,63}$/,
} as const

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
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

/** 代取令牌所需的最小平台面；`EnterprisePlatformService` 结构性满足它。 */
export interface EnterpriseFeedbackPlatformPort {
  request(input: string, init?: RequestInit): Promise<Response>
  /** 只读平台状态；字段由本文件按名读取并收窄，不信任其形状。 */
  status(): unknown
  /** 只读 bootstrap 快照（含设备 installationId）；未登录或未取到时 undefined。 */
  bootstrap(): unknown
}

/** Host 采集的封闭诊断键集；缺失或形状不符一律 null，绝不透传任意字符串。 */
export interface EnterpriseFeedbackDiagnostics {
  readonly pluginVersion: string | null
  readonly hostVersion: string | null
  readonly os: string | null
  readonly installationId: string | null
  readonly lastErrorCode: string | null
}

/** Host 侧常量事实：版本来自 bundle 与 Harness 运行时身份，os 由组合层给出。 */
export interface EnterpriseFeedbackDiagnosticsFact {
  readonly pluginVersion: string
  readonly hostVersion: string
  readonly os: string
}

function diagnosed(value: unknown, shape: RegExp): string | null {
  return typeof value === 'string' && shape.test(value) ? value : null
}

/**
 * 采集 `diagnostics`，键集严格限定为契约的五个字段。
 *
 * installationId 取 bootstrap 的服务端回执（浏览器拿不到权威值），lastErrorCode 取最近一次
 * 平台失败码；两者都按契约正则收窄，任何不符形状的值（含潜在令牌与路径）都退化成 null。
 */
export function collectEnterpriseFeedbackDiagnostics(
  platform: Pick<EnterpriseFeedbackPlatformPort, 'bootstrap' | 'status'>,
  fact: EnterpriseFeedbackDiagnosticsFact,
): EnterpriseFeedbackDiagnostics {
  const installationId = record(record(platform.bootstrap())?.['device'])?.['installationId']
  const lastErrorCode = record(platform.status())?.['errorCode']
  return {
    pluginVersion: diagnosed(fact.pluginVersion, DIAGNOSTIC_SHAPES.pluginVersion),
    hostVersion: diagnosed(fact.hostVersion, DIAGNOSTIC_SHAPES.hostVersion),
    os: diagnosed(fact.os, DIAGNOSTIC_SHAPES.os),
    installationId: diagnosed(installationId, DIAGNOSTIC_SHAPES.installationId),
    lastErrorCode: diagnosed(lastErrorCode, DIAGNOSTIC_SHAPES.lastErrorCode),
  }
}

/** multipart 的一个 part；附件与 metadata 共用同一形状，按 `name` 分流。 */
export interface FeedbackMultipartPart {
  readonly name: string
  readonly filename?: string | undefined
  readonly contentType?: string | undefined
  readonly data: Buffer
}

/** 位图魔数判定结果即契约的 MIME 白名单；SVG 与任何矢量格式都不在这里。 */
export type EnterpriseFeedbackImageKind = 'image/png' | 'image/jpeg' | 'image/webp'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((byte, index) => bytes[index] === byte)
}

/**
 * 按魔数（而非 `Content-Type` 或扩展名）判定位图类型。
 *
 * WebP 要求 `RIFF....WEBP` 两个锚点，避免把任意 RIFF 容器当图片放行；SVG 是文本，
 * 因此不会命中任何一条白名单分支。
 */
export function enterpriseFeedbackImageKind(bytes: Uint8Array): EnterpriseFeedbackImageKind | undefined {
  if (startsWith(bytes, PNG_MAGIC)) return 'image/png'
  if (startsWith(bytes, JPEG_MAGIC)) return 'image/jpeg'
  if (bytes.length >= 12
    && startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  return undefined
}

/** 从 `content-type` 头里取 boundary；不是 multipart/form-data 或边界非法时返回 undefined。 */
export function feedbackMultipartBoundary(contentType: string | undefined): string | undefined {
  if (contentType === undefined) return undefined
  const header = /^multipart\/form-data\s*;/i.exec(contentType)
  if (header === null) return undefined
  const match = /boundary=(?:"([^"]*)"|([^;]*))/i.exec(contentType)
  const boundary = (match?.[1] ?? match?.[2] ?? '').trim()
  return BOUNDARY_SHAPE.test(boundary) ? boundary : undefined
}

function partHeaders(raw: Buffer): { readonly disposition: string; readonly contentType: string | undefined } {
  let disposition = ''
  let contentType: string | undefined
  for (const line of raw.toString('utf8').split('\r\n')) {
    const index = line.indexOf(':')
    if (index <= 0) continue
    const name = line.slice(0, index).trim().toLowerCase()
    const value = line.slice(index + 1).trim()
    if (name === 'content-disposition') disposition = value
    if (name === 'content-type') contentType = value
  }
  return { disposition, contentType }
}

function quotedParameter(header: string, parameter: string): string | undefined {
  const match = new RegExp(`;\\s*${parameter}="([^"]*)"`, 'i').exec(header)
  return match?.[1]
}

/**
 * 解析 multipart 正文；畸形（缺结束边界、缺头分隔、非 form-data 分帧）一律返回 undefined。
 *
 * 本函数只在 Host 侧做校验与重建，输入是**已经按上限缓冲**的正文，因此不做流式增量解析。
 */
export function parseFeedbackMultipart(
  body: Buffer,
  boundary: string,
): readonly FeedbackMultipartPart[] | undefined {
  const delimiter = Buffer.from(`--${boundary}`)
  const parts: FeedbackMultipartPart[] = []
  let index = body.indexOf(delimiter)
  while (index !== -1) {
    let cursor = index + delimiter.length
    if (body[cursor] === 0x2d && body[cursor + 1] === 0x2d) return parts
    if (body[cursor] === 0x0d && body[cursor + 1] === 0x0a) cursor += 2
    const next = body.indexOf(delimiter, cursor)
    if (next === -1) return undefined
    // 下一个边界前的 CRLF 属于分帧，不属于正文。
    const end = body[next - 2] === 0x0d && body[next - 1] === 0x0a ? next - 2 : next
    const chunk = body.subarray(cursor, end)
    const headerEnd = chunk.indexOf('\r\n\r\n')
    if (headerEnd === -1) return undefined
    const headers = partHeaders(chunk.subarray(0, headerEnd))
    const name = quotedParameter(headers.disposition, 'name')
    if (name === undefined || !/^form-data\b/i.test(headers.disposition)) return undefined
    const filename = quotedParameter(headers.disposition, 'filename')
    parts.push({
      name,
      ...(filename === undefined ? {} : { filename }),
      ...(headers.contentType === undefined ? {} : { contentType: headers.contentType }),
      data: chunk.subarray(headerEnd + 4),
    })
    index = next
  }
  return undefined
}

/** 附件文件名进重建正文前先去引号与换行，杜绝分帧头注入。 */
function safeFilename(filename: string | undefined): string {
  return (filename ?? 'attachment').replace(/["\r\n\\]/g, '_')
}

/**
 * 用 Host 自己的 boundary 重建提交正文：metadata 换成补过 diagnostics 的 JSON，
 * 附件按**魔数判定**出的 MIME 重写 `content-type`（不沿用浏览器声明），文件名只做去危险字符。
 */
export function buildFeedbackMultipart(
  boundary: string,
  metadataJson: string,
  attachments: readonly FeedbackMultipartPart[],
): Buffer {
  const chunks: Buffer[] = []
  const head = (name: string, extra: string): Buffer =>
    Buffer.from(`--${boundary}\r\ncontent-disposition: form-data; name="${name}"${extra}\r\n\r\n`)
  chunks.push(head('metadata', '\r\ncontent-type: application/json'), Buffer.from(metadataJson, 'utf8'), Buffer.from('\r\n'))
  for (const attachment of attachments) {
    const kind = enterpriseFeedbackImageKind(attachment.data) ?? 'application/octet-stream'
    chunks.push(head('attachments', `; filename="${safeFilename(attachment.filename)}"\r\ncontent-type: ${kind}`))
    chunks.push(attachment.data, Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface FeedbackFailureProjection {
  readonly status: 400 | 401 | 413 | 503
  readonly code: string
  readonly step:
    | 'local-body-too-large'
    | 'local-multipart-invalid'
    | 'local-metadata-invalid'
    | 'local-idempotency-key'
    | 'local-attachment-count'
    | 'local-attachment-too-large'
    | 'local-attachment-kind'
    | 'upstream-unauthorized'
    | 'upstream-unauthorized-expired'
    | 'upstream-rejected'
    | 'upstream-failed'
}

function localFailure(
  status: 400 | 413,
  code: string,
  step: FeedbackFailureProjection['step'],
): FeedbackFailureProjection {
  return { status, code, step }
}

/**
 * 本地限流：与中心同名的错误码，尽早失败。
 *
 * 顺序固定为「张数 → 单张大小 → 魔数」：张数超限是 400，单张超限是 413，
 * 非 PNG/JPEG/WebP（含 SVG）是 400——三者在中心是同码同状态，本地投影因此不必再翻译一次。
 */
export function projectFeedbackAttachmentLimits(
  parts: readonly FeedbackMultipartPart[],
): FeedbackFailureProjection | undefined {
  const attachments = parts.filter(part => part.name === 'attachments')
  if (attachments.length > ENTERPRISE_FEEDBACK_MAX_ATTACHMENTS) {
    return localFailure(400, 'ENT_FEEDBACK_ATTACHMENT_INVALID', 'local-attachment-count')
  }
  for (const attachment of attachments) {
    if (attachment.data.length > ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES) {
      return localFailure(413, 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE', 'local-attachment-too-large')
    }
  }
  for (const attachment of attachments) {
    if (enterpriseFeedbackImageKind(attachment.data) === undefined) {
      return localFailure(400, 'ENT_FEEDBACK_ATTACHMENT_INVALID', 'local-attachment-kind')
    }
  }
  return undefined
}

/**
 * 上游返回了非 2xx 但**没有抛异常**时的等价失败；`code` 由响应体解出，可能缺席。
 * 平台 Service 已把非 2xx 折叠成 `EnterprisePlatformError`，这一支只兜住其它实现。
 */
class FeedbackUpstreamError extends Error {
  constructor(readonly httpStatus: number, readonly code?: string) {
    super(`enterprise feedback upstream returned ${httpStatus}`)
    this.name = 'FeedbackUpstreamError'
  }
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const status: unknown = Reflect.get(error, 'httpStatus')
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined
}

/**
 * 失败投影的唯一判断点：认证拒绝投影 401；中心三个稳定业务码按契约状态透传
 * （`ENT_FEEDBACK_INVALID`/`ENT_FEEDBACK_ATTACHMENT_INVALID`→400、`ENT_FEEDBACK_ATTACHMENT_TOO_LARGE`→413）；
 * 其余一切（含未知码与网络中断）投影 503，并只保留受控形状的码。
 */
export function projectFeedbackFailure(error: unknown): FeedbackFailureProjection {
  const code = errorCodeOf(error)
  const expired = code === 'ENT_AUTH_SESSION_EXPIRED'
  if (expired || code === 'ENT_AUTH_REQUIRED' || httpStatusOf(error) === 401) {
    return {
      status: 401,
      code: expired ? 'ENT_AUTH_SESSION_EXPIRED' : 'ENT_AUTH_REQUIRED',
      step: expired ? 'upstream-unauthorized-expired' : 'upstream-unauthorized',
    }
  }
  if (code === 'ENT_FEEDBACK_INVALID') return { status: 400, code, step: 'upstream-rejected' }
  if (code === 'ENT_FEEDBACK_ATTACHMENT_INVALID') return { status: 400, code, step: 'upstream-rejected' }
  if (code === 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE') return { status: 413, code, step: 'upstream-rejected' }
  return {
    status: 503,
    code: code !== undefined && CODE_SHAPE.test(code) ? code : 'ENT_PLATFORM_UNAVAILABLE',
    step: 'upstream-failed',
  }
}

/** 上游非 2xx 的响应体里取稳定错误码；正文畸形或缺字段时返回 undefined。 */
async function upstreamErrorCode(response: Response): Promise<string | undefined> {
  try {
    const payload: unknown = await response.json()
    const code = record(record(payload)?.['error'])?.['code']
    return typeof code === 'string' && code.length > 0 ? code : undefined
  } catch {
    return undefined
  }
}

/**
 * 上游正文 `{data, requestId}` → 本地单键信封 `{data}`。
 *
 * 本地取数口径只认单键信封（`ui/local-api.ts`），因此 requestId 等字段必须止步于 Host。
 *
 * @throws {TypeError} 正文不是对象或缺少 `data`。
 */
export function projectFeedbackEnvelope(payload: unknown): unknown {
  const envelope = record(payload)
  if (envelope === undefined || !Object.prototype.hasOwnProperty.call(envelope, 'data')) {
    throw new TypeError('enterprise feedback response must be an envelope object')
  }
  return envelope['data']
}

/**
 * 有界读取请求正文；超过上限时继续排空（不缓冲）并返回 undefined。
 *
 * 排空而不是 `destroy()`：让浏览器能读到 413 响应，而不是一个 connection reset。
 */
async function readBoundedBody(request: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  let overflow = false
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += bytes.length
    if (total > limit) {
      overflow = true
      continue
    }
    chunks.push(bytes)
  }
  return overflow ? undefined : Buffer.concat(chunks)
}

function singleHeader(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  return value?.[0]
}

/**
 * 在 Harness `ctx.webServer` 上注册反馈提交的同源 multipart 透传路由。
 *
 * 浏览器无 Access Token，取令牌只能由 Host 代取：本路由以 POST 把浏览器正文重建成
 * 「metadata 补 Host 诊断 + 已限流附件」的形式转交中心 `feedback`。本地限流与中心同名同码，
 * 认证拒绝投影 401，中心 400/413 业务码原样透传，其余失败投影 503 并留 warn（含 operation/step/status/error）。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param platform - 代取令牌与诊断事实的平台面（组合层传 `EnterprisePlatformService`）。
 * @param diagnostics - bundle 侧版本/OS 事实。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseFeedbackRoute(
  webServer: WebServerRoutePort,
  platform: EnterpriseFeedbackPlatformPort,
  diagnostics: EnterpriseFeedbackDiagnosticsFact,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_FEEDBACK_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_FEEDBACK_LOCAL_PATH}`
      /**
       * 本地拒绝也是可见结论：写状态行前先把响应体算完，异常不逃到 Cordis 顶层。
       *
       * 这些分支可能还没读完正文（如声明长度超界），因此统一 `resume()` 排空而不是 destroy：
       * 客户端要读到这条 4xx/5xx，而不是一个 connection reset。
       */
      const reject = (failure: FeedbackFailureProjection): void => {
        request.resume()
        writeJson(response, failure.status, { error: { code: failure.code } })
      }
      const declaredLength = Number(singleHeader(request.headers['content-length']))
      if (Number.isFinite(declaredLength) && declaredLength > ENTERPRISE_FEEDBACK_BODY_MAX_BYTES) {
        reject(localFailure(413, 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE', 'local-body-too-large'))
        return
      }
      const boundary = feedbackMultipartBoundary(singleHeader(request.headers['content-type']))
      if (boundary === undefined) {
        reject(localFailure(400, 'ENT_FEEDBACK_INVALID', 'local-multipart-invalid'))
        return
      }
      const idempotencyKey = singleHeader(request.headers['idempotency-key'])
      if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY_SHAPE.test(idempotencyKey)) {
        reject(localFailure(400, 'ENT_FEEDBACK_INVALID', 'local-idempotency-key'))
        return
      }
      const body = await readBoundedBody(request, ENTERPRISE_FEEDBACK_BODY_MAX_BYTES)
      if (body === undefined) {
        reject(localFailure(413, 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE', 'local-body-too-large'))
        return
      }
      const parts = parseFeedbackMultipart(body, boundary)
      const metadataPart = parts?.find(part => part.name === 'metadata')
      if (parts === undefined || metadataPart === undefined) {
        reject(localFailure(400, 'ENT_FEEDBACK_INVALID', 'local-multipart-invalid'))
        return
      }
      const limited = projectFeedbackAttachmentLimits(parts)
      if (limited !== undefined) {
        reject(limited)
        return
      }
      let metadata: JsonRecord
      try {
        const parsed: unknown = JSON.parse(metadataPart.data.toString('utf8'))
        const candidate = record(parsed)
        if (candidate === undefined) throw new TypeError('feedback metadata must be an object')
        metadata = candidate
      } catch {
        reject(localFailure(400, 'ENT_FEEDBACK_INVALID', 'local-metadata-invalid'))
        return
      }
      let status = 201
      let payload: unknown
      try {
        const forwardBoundary = `----dshentFeedback${randomUUID().replace(/-/g, '')}`
        const forward = buildFeedbackMultipart(
          forwardBoundary,
          JSON.stringify({ ...metadata, diagnostics: collectEnterpriseFeedbackDiagnostics(platform, diagnostics) }),
          parts.filter(part => part.name === 'attachments'),
        )
        const upstream = await platform.request(ENTERPRISE_FEEDBACK_CENTER_PATH, {
          // Node 下 Buffer 就是合法的 fetch body；DOM 的 BodyInit 只认 ArrayBuffer 视图族，故在此收窄。
          body: forward as unknown as BodyInit,
          headers: {
            accept: 'application/json',
            'content-type': `multipart/form-data; boundary=${forwardBoundary}`,
            ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
          },
          method: 'POST',
          redirect: 'error',
        })
        if (!upstream.ok) throw new FeedbackUpstreamError(upstream.status, await upstreamErrorCode(upstream))
        status = upstream.status
        payload = { data: projectFeedbackEnvelope(await upstream.json()) }
      } catch (error) {
        const failure = projectFeedbackFailure(error)
        status = failure.status
        payload = { error: { code: failure.code } }
        // 400/413 是中心对已提交正文的结论，不是本机故障；只有 401 与 503 留痕。
        if (failure.status !== 400 && failure.status !== 413) {
          onError?.(`enterprise feedback request projected to ${failure.status}`
            + ` [operation=${operation} step=${failure.step} status=${failure.status}]`
            + ` ${thrownErrorDiagnostics(error)}`, error)
        }
      }
      writeJson(response, status, payload)
    },
  })
}
