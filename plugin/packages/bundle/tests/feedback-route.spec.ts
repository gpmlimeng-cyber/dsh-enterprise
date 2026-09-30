/**
 * [INPUT]: 依赖 `src/feedback-route.ts` 的路由注册器与全部纯函数、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch/FormData/Buffer
 * [OUTPUT]: 锁定反馈本地 multipart 透传的成功（200/201）、401、405、张数/大小/SVG 三类本地限流、中心 400/413 业务码透传、上游异常 503 与 warn 判定点，以及 diagnostics 键集裁剪与 Idempotency-Key 透传
 * [POS]: bundle 的反馈提交回归门禁；有人把浏览器正文原样转发（带上伪造 diagnostics）、把附件限流删掉、或把 401 折成 503，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES,
  ENTERPRISE_FEEDBACK_CENTER_PATH,
  ENTERPRISE_FEEDBACK_LOCAL_PATH,
  buildFeedbackMultipart,
  collectEnterpriseFeedbackDiagnostics,
  enterpriseFeedbackImageKind,
  feedbackMultipartBoundary,
  parseFeedbackMultipart,
  projectFeedbackAttachmentLimits,
  projectFeedbackFailure,
  registerEnterpriseFeedbackRoute,
  type EnterpriseFeedbackDiagnosticsFact,
  type FeedbackMultipartPart,
} from '../src/feedback-route.js'

/** 中心成功回执的真实信封形状：data + requestId（requestId 必须止步于 Host）。 */
const UPSTREAM_BODY = {
  data: {
    attachmentCount: 1,
    createdAt: '2026-09-30T05:20:11Z',
    id: '1900100000000000007',
    occurredAt: '2026-09-30T13:20:00+08:00',
    status: 'new',
    type: 'issue',
  },
  requestId: 'req_01K2W3V4X5Y6Z7A8B9C0D1E2F3',
}

const DIAGNOSTICS_FACT: EnterpriseFeedbackDiagnosticsFact = {
  hostVersion: '0.1.7-rc.2',
  os: 'darwin-24.6.0',
  pluginVersion: '0.1.0',
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]

function image(magic: readonly number[], padding = 32): Uint8Array {
  return new Uint8Array([...magic, ...new Array<number>(padding).fill(0)])
}

function metadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { consent: true, description: '上传大文件后界面没有反馈', type: 'issue', ...overrides }
}

function multipartBody(overrides: Record<string, unknown> = {}, attachments: readonly { bytes: Uint8Array; filename: string; type: string }[] = []): FormData {
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata(overrides))], { type: 'application/json' }))
  for (const attachment of attachments) {
    form.append('attachments', new Blob([attachment.bytes], { type: attachment.type }), attachment.filename)
  }
  return form
}

/** 把 Host 转发的正文按它自己的 boundary 解回来，断言的是**实际发给中心的东西**。 */
function forwardedMetadata(init: RequestInit): Record<string, unknown> {
  const body = init.body as Buffer
  const headers = init.headers as Record<string, string>
  const boundary = feedbackMultipartBoundary(headers['content-type'])
  if (boundary === undefined) throw new Error('forwarded body is not multipart')
  const parts = parseFeedbackMultipart(body, boundary)
  if (parts === undefined) throw new Error('forwarded body is malformed')
  const part = parts.find(candidate => candidate.name === 'metadata')
  if (part === undefined) throw new Error('forwarded body has no metadata part')
  return JSON.parse(part.data.toString('utf8')) as Record<string, unknown>
}

describe('feedback attachment limits and bitmaps', () => {
  it('recognises only PNG/JPEG/WebP by magic number', () => {
    expect(enterpriseFeedbackImageKind(new Uint8Array(image(PNG_MAGIC)))).toBe('image/png')
    expect(enterpriseFeedbackImageKind(new Uint8Array(image(JPEG_MAGIC)))).toBe('image/jpeg')
    expect(enterpriseFeedbackImageKind(new Uint8Array(image(WEBP_MAGIC)))).toBe('image/webp')
    // SVG 是文本：既不命中有损/无损位图魔数，也不因为 Content-Type 被放行。
    expect(enterpriseFeedbackImageKind(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeUndefined()
    // 非 WebP 的 RIFF 容器（此处 WAVE）不得因为 RIFF 头就放行。
    expect(enterpriseFeedbackImageKind(new TextEncoder().encode('RIFF0000WAVE'))).toBeUndefined()
    expect(enterpriseFeedbackImageKind(new Uint8Array([0x89, 0x50]))).toBeUndefined()
  })

  it('projects count first, then per-attachment size, then the bitmap magic', () => {
    const row = (name: string, bytes: Uint8Array): FeedbackMultipartPart => ({ data: Buffer.from(bytes), name })
    const png = new Uint8Array(image(PNG_MAGIC))
    expect(projectFeedbackAttachmentLimits([row('metadata', png), row('attachments', png)])).toBeUndefined()
    expect(projectFeedbackAttachmentLimits([
      row('attachments', png), row('attachments', png), row('attachments', png), row('attachments', png),
    ])).toMatchObject({ status: 400, code: 'ENT_FEEDBACK_ATTACHMENT_INVALID', step: 'local-attachment-count' })
    const big = Buffer.concat([Buffer.from(png), Buffer.alloc(ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES)])
    expect(projectFeedbackAttachmentLimits([row('attachments', big)]))
      .toMatchObject({ status: 413, code: 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE', step: 'local-attachment-too-large' })
    expect(projectFeedbackAttachmentLimits([row('attachments', new TextEncoder().encode('<svg/>'))]))
      .toMatchObject({ status: 400, code: 'ENT_FEEDBACK_ATTACHMENT_INVALID', step: 'local-attachment-kind' })
  })

  it('rebuilds a body that parses back with the metadata it was given', () => {
    const boundary = '----dshentTestBoundary'
    const attachment: FeedbackMultipartPart = { data: Buffer.from(image(PNG_MAGIC)), filename: 'shot.png', name: 'attachments' }
    const rebuilt = buildFeedbackMultipart(boundary, JSON.stringify({ consent: true }), [attachment])
    const parts = parseFeedbackMultipart(rebuilt, boundary)
    expect(parts).toHaveLength(2)
    expect(JSON.parse(parts![0]!.data.toString('utf8'))).toEqual({ consent: true })
    expect(parts![1]!.contentType).toBe('image/png')
    expect(parts![1]!.filename).toBe('shot.png')
  })

  it('collects exactly the five contract keys and nulls anything out of shape', () => {
    const collected = collectEnterpriseFeedbackDiagnostics({
      bootstrap: () => ({ device: { installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a' } }),
      status: () => ({ errorCode: 'ENT_FEEDBACK_INVALID' }),
    }, DIAGNOSTICS_FACT)
    expect(Object.keys(collected).sort()).toEqual(
      ['hostVersion', 'installationId', 'lastErrorCode', 'os', 'pluginVersion'],
    )
    expect(collected).toEqual({
      hostVersion: '0.1.7-rc.2',
      installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a',
      lastErrorCode: 'ENT_FEEDBACK_INVALID',
      os: 'darwin-24.6.0',
      pluginVersion: '0.1.0',
    })
    // 越界形状（令牌、本地路径、任意文本）没有落点，一律退化成 null。
    const trimmed = collectEnterpriseFeedbackDiagnostics({
      bootstrap: () => ({ device: { installationId: '/Users/linus/.dsh/enterprise/device.json' } }),
      status: () => ({ errorCode: 'Bearer sk-live-123' }),
    }, { hostVersion: 'not a version', os: 'darwin 24.6.0', pluginVersion: '0.1.0' })
    expect(trimmed.installationId).toBeNull()
    expect(trimmed.lastErrorCode).toBeNull()
    expect(trimmed.hostVersion).toBeNull()
    expect(trimmed.os).toBeNull()
  })

  it('projects 401 for auth rejections, passes the three contract codes through, and 503 otherwise', () => {
    expect(projectFeedbackFailure(Object.assign(new Error('expired'), {
      code: 'ENT_AUTH_SESSION_EXPIRED',
      httpStatus: 401,
    }))).toEqual({ status: 401, code: 'ENT_AUTH_SESSION_EXPIRED', step: 'upstream-unauthorized-expired' })
    expect(projectFeedbackFailure(Object.assign(new Error('missing'), { code: 'ENT_AUTH_REQUIRED' })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'upstream-unauthorized' })
    expect(projectFeedbackFailure(Object.assign(new Error('unauthorized'), { httpStatus: 401 })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'upstream-unauthorized' })
    for (const [code, status] of [
      ['ENT_FEEDBACK_INVALID', 400],
      ['ENT_FEEDBACK_ATTACHMENT_INVALID', 400],
      ['ENT_FEEDBACK_ATTACHMENT_TOO_LARGE', 413],
    ] as const) {
      expect(projectFeedbackFailure(Object.assign(new Error(code), { code, httpStatus: status })))
        .toEqual({ status, code, step: 'upstream-rejected' })
    }
    expect(projectFeedbackFailure(new Error('socket hang up')))
      .toEqual({ status: 503, code: 'ENT_PLATFORM_UNAVAILABLE', step: 'upstream-failed' })
    expect(projectFeedbackFailure(Object.assign(new Error('odd'), { code: 'not a code' })))
      .toEqual({ status: 503, code: 'ENT_PLATFORM_UNAVAILABLE', step: 'upstream-failed' })
  })
})

describe('POST /enterprise/api/v1/local/feedback', () => {
  let server: Server
  let baseUrl: string
  let route: Parameters<WebServerRoutePort['register']>[0] | undefined
  let request: Mock<(input: string, init?: RequestInit) => Promise<Response>>
  let onError: Mock<(message: string, error: unknown) => void>
  let bootstrapSnapshot: unknown
  let platformStatus: unknown

  beforeEach(async () => {
    route = undefined
    bootstrapSnapshot = { device: { installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a' } }
    platformStatus = { errorCode: 'ENT_NETWORK_FAILED', state: 'READY' }
    request = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(UPSTREAM_BODY), {
        headers: { 'content-type': 'application/json' },
        status: 201,
      }),
    )
    onError = vi.fn<(message: string, error: unknown) => void>()
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        route = registered
        return () => { route = undefined }
      },
    }
    registerEnterpriseFeedbackRoute(webServer, {
      bootstrap: () => bootstrapSnapshot,
      request,
      status: () => platformStatus,
    }, DIAGNOSTICS_FACT, onError)
    server = createServer((incoming, response) => {
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(incoming, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  const post = (body: FormData, headers?: Record<string, string>): Promise<Response> =>
    fetch(`${baseUrl}${ENTERPRISE_FEEDBACK_LOCAL_PATH}`, {
      body,
      method: 'POST',
      ...(headers === undefined ? {} : { headers }),
    })

  it('201 成功：由 Host 代取中心路径并剥掉 requestId', async () => {
    expect(ENTERPRISE_FEEDBACK_CENTER_PATH).toBe('/enterprise/api/v1/feedback')
    expect(ENTERPRISE_FEEDBACK_LOCAL_PATH).toBe('/enterprise/api/v1/local/feedback')
    const response = await post(multipartBody({}, [{
      bytes: new Uint8Array(image(PNG_MAGIC)),
      filename: 'shot.png',
      type: 'image/png',
    }]))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: UPSTREAM_BODY.data })
    expect(request).toHaveBeenCalledTimes(1)
    const [path, init] = request.mock.calls[0]!
    expect(path).toBe(ENTERPRISE_FEEDBACK_CENTER_PATH)
    expect(init?.method).toBe('POST')
    // 取数只经平台 Service：路由自己不发 HTTP，也不自行拼 Authorization 头。
    expect(JSON.stringify(init?.headers)).not.toContain('uthorization')
    expect(onError).not.toHaveBeenCalled()
  })

  it('replaces browser diagnostics with the Host-collected five-key set', async () => {
    const response = await post(multipartBody({
      diagnostics: { pluginVersion: 'forged', token: 'sk-live-secret', path: '/Users/linus/.dsh' },
    }))
    expect(response.status).toBe(201)
    const forwarded = forwardedMetadata(request.mock.calls[0]![1]!)
    expect(forwarded['diagnostics']).toEqual({
      hostVersion: '0.1.7-rc.2',
      installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a',
      lastErrorCode: 'ENT_NETWORK_FAILED',
      os: 'darwin-24.6.0',
      pluginVersion: '0.1.0',
    })
    const raw = JSON.stringify(forwarded)
    expect(raw).not.toContain('sk-live-secret')
    expect(raw).not.toContain('/Users/linus')
    // 未申报的字段原样保留，Host 只接管 diagnostics 这一个键。
    expect(forwarded).toMatchObject({ consent: true, description: '上传大文件后界面没有反馈', type: 'issue' })
  })

  it('200 也照原状态投影，绝不写出上游 requestId', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify(UPSTREAM_BODY), { status: 200 }))
    const response = await post(multipartBody())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: UPSTREAM_BODY.data })
  })

  it('透传合法 Idempotency-Key，非法值在本地就拒绝', async () => {
    const key = '4c96d076-a80a-4b6c-8df6-f0db804b6f0a'
    await post(multipartBody(), { 'idempotency-key': key })
    expect((request.mock.calls[0]![1]!.headers as Record<string, string>)['idempotency-key']).toBe(key)
    request.mockClear()
    const rejected = await post(multipartBody(), { 'idempotency-key': 'not-a-uuid' })
    expect(rejected.status).toBe(400)
    expect(await rejected.json()).toEqual({ error: { code: 'ENT_FEEDBACK_INVALID' } })
    expect(request).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('超过 3 张附件在本地就按中心同名码拒绝，不触发取数', async () => {
    const attachment = { bytes: new Uint8Array(image(PNG_MAGIC)), filename: 'a.png', type: 'image/png' }
    const response = await post(multipartBody({}, [attachment, attachment, attachment, attachment]))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: 'ENT_FEEDBACK_ATTACHMENT_INVALID' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('单张超过 2 MiB 在本地就投影 413，不把大文件推到中心', async () => {
    const oversize = new Uint8Array(ENTERPRISE_FEEDBACK_ATTACHMENT_MAX_BYTES + 1)
    oversize.set(PNG_MAGIC)
    const response = await post(multipartBody({}, [{ bytes: oversize, filename: 'huge.png', type: 'image/png' }]))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: { code: 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('SVG 按魔数被拒（不信任 Content-Type 与扩展名）', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
    const response = await post(multipartBody({}, [{ bytes: svg, filename: 'shot.png', type: 'image/png' }]))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: 'ENT_FEEDBACK_ATTACHMENT_INVALID' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('上游 401 投影 401 并留 warn 判定点', async () => {
    request.mockRejectedValueOnce(Object.assign(new Error('platform login is required'), {
      code: 'ENT_AUTH_REQUIRED',
      httpStatus: 401,
    }))
    const response = await post(multipartBody())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'ENT_AUTH_REQUIRED' } })
    const [message] = onError.mock.calls[0]!
    expect(message).toContain(`operation=POST ${ENTERPRISE_FEEDBACK_LOCAL_PATH}`)
    expect(message).toContain('step=upstream-unauthorized')
    expect(message).toContain('status=401')
  })

  it('中心 400/413 业务码原样透传且不当作本机故障留痕', async () => {
    for (const [code, status] of [['ENT_FEEDBACK_INVALID', 400], ['ENT_FEEDBACK_ATTACHMENT_TOO_LARGE', 413]] as const) {
      request.mockRejectedValueOnce(Object.assign(new Error(code), { code, httpStatus: status }))
      const response = await post(multipartBody())
      expect(response.status, code).toBe(status)
      expect(await response.json()).toEqual({ error: { code } })
    }
    // 上游非 2xx 但未抛异常时按响应体里的稳定码投影。
    request.mockResolvedValueOnce(new Response('{"error":{"code":"ENT_FEEDBACK_ATTACHMENT_TOO_LARGE"}}', { status: 413 }))
    const passthrough = await post(multipartBody())
    expect(passthrough.status).toBe(413)
    expect(await passthrough.json()).toEqual({ error: { code: 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE' } })
    expect(onError).not.toHaveBeenCalled()
  })

  it('上游异常投影 503 并留 warn 判定点', async () => {
    request.mockRejectedValueOnce(new Error('socket hang up'))
    const response = await post(multipartBody())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
    const [message, error] = onError.mock.calls[0]!
    expect(message).toContain('step=upstream-failed')
    expect(message).toContain('status=503')
    expect(message).toContain('socket hang up')
    expect(error).toBeInstanceOf(Error)
  })

  it('上游 200 但信封畸形时投影 503，不把 requestId 或任意正文写出', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: 'req_1' }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }))
    const response = await post(multipartBody())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('缺少 metadata 或非 multipart 正文在本地就拒', async () => {
    const withoutMetadata = new FormData()
    withoutMetadata.append('attachments', new Blob([image(PNG_MAGIC)], { type: 'image/png' }), 'a.png')
    const missing = await post(withoutMetadata)
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: { code: 'ENT_FEEDBACK_INVALID' } })
    const plain = await fetch(`${baseUrl}${ENTERPRISE_FEEDBACK_LOCAL_PATH}`, {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(plain.status).toBe(400)
    expect(request).not.toHaveBeenCalled()
  })

  it('正文超过有界上限时按声明长度尽早投影 413，不做缓冲也不触发取数', async () => {
    // 8 MiB > 三张满额附件 + 1 MiB 分帧余量：解析之前就该被拒。
    const response = await fetch(`${baseUrl}${ENTERPRISE_FEEDBACK_LOCAL_PATH}`, {
      body: Buffer.alloc(8 * 1024 * 1024),
      headers: { 'content-type': 'multipart/form-data; boundary=----oversize' },
      method: 'POST',
    })
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: { code: 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE' } })
    expect(request).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('非 POST 一律 405 并声明 Allow，且不触发任何取数', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_FEEDBACK_LOCAL_PATH}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow')).toBe('POST')
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(request).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
