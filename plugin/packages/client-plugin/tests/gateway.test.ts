/**
 * [INPUT]: 依赖 node:fs/node:net/node:os 与 tests/fixtures 的契约快照，依赖 vitest，依赖 gateway 的 profiles/proxy/register 与 protocol 的信封与类型
 * [OUTPUT]: 对外提供 E2 门禁断言：三协议投影、default sentinel、loopback 与路径白名单、非缓冲 SSE 透传、指纹幂等更新与有序拆卸
 * [POS]: gateway 的裁判；fixture 是投影的事实裁判，官方 pi-ai 类型是 profile 字段的编译期裁判
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { networkInterfaces } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { buildEnterpriseProfiles, type EnterpriseProfiles } from '../src/gateway/profiles.js'
import {
  isLoopbackAddress,
  startEnterpriseGatewayProxy,
  type EnterpriseGatewayProxy,
  type EnterpriseGatewayProxyPort,
} from '../src/gateway/proxy.js'
import { registerEnterpriseGateway } from '../src/gateway/register.js'
import { EnterprisePlatformError, unwrapEnvelope } from '../src/protocol/envelope.js'
import type { EnterpriseRequestInit } from '../src/protocol/http.js'
import {
  ENTERPRISE_DEFAULT_MODEL,
  ENTERPRISE_GATEWAY_ROUTES,
  ENTERPRISE_PROVIDER,
  type EnterpriseBootstrapModel,
  type EnterpriseBootstrapSnapshot,
  type EnterprisePlatformStatus,
} from '../src/protocol/types.js'

const BASE_URL = 'http://127.0.0.1:4567/enterprise/gateway/v1'
const AUTHORIZATION = 'Bearer placeholder-value'
const REAL_TOKEN = 'real-access-token-9f3c'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as unknown
}

/** 最小合法快照；模型目录是唯一被投影的部分。 */
function bootstrapSnapshot(models: readonly EnterpriseBootstrapModel[]): EnterpriseBootstrapSnapshot {
  return {
    revision: 1,
    user: { id: '1', username: 'alice', displayName: 'Alice', departmentId: null },
    device: { id: '1', installationId: '123e4567-e89b-42d3-a456-426614174000', status: 'ACTIVE' },
    models,
    quotas: [],
    plugins: { revision: 0, assignments: [] },
    sessionPolicy: { enabled: false, retentionDays: 90, maxBatchBytes: 1024 },
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

describe('buildEnterpriseProfiles', () => {
  const bootstrap = unwrapEnvelope<EnterpriseBootstrapSnapshot>(fixture('bootstrap-models-success.json'))

  it('把契约快照投影成三协议 route 与企业默认哨兵', () => {
    const profiles = buildEnterpriseProfiles(bootstrap, BASE_URL, AUTHORIZATION)
    expect(Object.keys(profiles)).toStrictEqual(['enterprise-openai-completions', ENTERPRISE_PROVIDER])
    expect(ENTERPRISE_PROVIDER).toBe('enterprise')
    expect(ENTERPRISE_DEFAULT_MODEL).toBe('enterprise/default')
    expect(profiles['enterprise-openai-completions']).toStrictEqual({
      api: 'openai-completions',
      baseURL: BASE_URL,
      displayName: '企业模型 · Chat Completions',
      models: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          input: ['text'],
          contextWindow: 65536,
          maxTokens: 8192,
        },
      ],
      headers: { authorization: AUTHORIZATION },
    })
    // 默认哨兵复用被选中模型的协议与容量，只换 id 与名称后缀。
    expect(profiles[ENTERPRISE_PROVIDER]).toStrictEqual({
      api: 'openai-completions',
      baseURL: BASE_URL,
      displayName: '企业模型',
      models: [
        {
          id: ENTERPRISE_DEFAULT_MODEL,
          name: 'DeepSeek Chat（企业默认）',
          input: ['text'],
          contextWindow: 65536,
          maxTokens: 8192,
        },
      ],
      headers: { authorization: AUTHORIZATION },
    })
  })

  it('anthropic 分组去掉结尾 /v1，OpenAI 系保留 /v1', () => {
    const profiles = buildEnterpriseProfiles(
      bootstrapSnapshot([
        { alias: 'claude-sonnet', name: 'Claude Sonnet', apiProtocol: 'anthropic-messages', isDefault: false },
        { alias: 'gpt-next', apiProtocol: 'openai-responses', isDefault: false },
      ]),
      BASE_URL,
      AUTHORIZATION,
    )
    expect(Object.keys(profiles)).toStrictEqual(['enterprise-openai-responses', 'enterprise-anthropic-messages'])
    expect(profiles['enterprise-openai-responses'].baseURL).toBe(BASE_URL)
    expect(profiles['enterprise-anthropic-messages'].baseURL).toBe('http://127.0.0.1:4567/enterprise/gateway')
    expect(profiles['enterprise-anthropic-messages'].api).toBe('anthropic-messages')
    // 未声明名称时回落到 alias。
    expect(profiles['enterprise-openai-responses'].models).toStrictEqual([
      { id: 'gpt-next', name: 'gpt-next', input: ['text'] },
    ])
  })

  it('空快照与无模型快照都投影成空字典', () => {
    expect(buildEnterpriseProfiles(undefined, BASE_URL, AUTHORIZATION)).toStrictEqual({})
    expect(buildEnterpriseProfiles(bootstrapSnapshot([]), BASE_URL, AUTHORIZATION)).toStrictEqual({})
  })

  it('undefined 字段被剔除而不是置 null，且不产出空壳对象', () => {
    const profiles = buildEnterpriseProfiles(
      bootstrapSnapshot([
        {
          alias: 'deepseek-reasoner',
          apiProtocol: 'openai-completions',
          isDefault: false,
          reasoningEfforts: { low: 'low', medium: undefined },
          compat: { thinkingFormat: 'deepseek', supportsReasoningEffort: undefined },
        },
      ]),
      BASE_URL,
      AUTHORIZATION,
    )
    expect(profiles['enterprise-openai-completions'].models?.[0]).toStrictEqual({
      id: 'deepseek-reasoner',
      name: 'deepseek-reasoner',
      input: ['text'],
      reasoningEfforts: { low: 'low' },
      compat: { thinkingFormat: 'deepseek' },
    })
    // JSON 往返不丢任何字段，即投影里不存在 undefined 值。
    expect(JSON.parse(JSON.stringify(profiles))).toStrictEqual(profiles)
  })

  it('reasoningEfforts === false 原样传递，off: null 保留，pi-ai 不认识的 thinkingFormat 被剔除', () => {
    const profiles = buildEnterpriseProfiles(
      bootstrapSnapshot([
        {
          alias: 'plain',
          apiProtocol: 'openai-completions',
          isDefault: false,
          reasoningEfforts: false,
          // minimax/kimi/longcat 只存在于中心契约，pi-ai 无对应实现：透传会让整条 route 不可服务。
          compat: { thinkingFormat: 'minimax' },
        },
        {
          alias: 'thinking',
          apiProtocol: 'openai-completions',
          isDefault: false,
          reasoningEfforts: { off: null, high: 'high', xhigh: undefined },
        },
      ]),
      BASE_URL,
      AUTHORIZATION,
    )
    expect(profiles['enterprise-openai-completions'].models?.[0]).toStrictEqual({
      id: 'plain',
      name: 'plain',
      input: ['text'],
      reasoningEfforts: false,
    })
    expect(profiles['enterprise-openai-completions'].models?.[1].reasoningEfforts).toStrictEqual({
      off: null,
      high: 'high',
    })
    expect(JSON.parse(JSON.stringify(profiles))).toStrictEqual(profiles)
  })
})

/** 记录平台侧调用的假端口；真实令牌只由它持有。 */
interface RecordingPort extends EnterpriseGatewayProxyPort {
  readonly calls: { path: string; init: EnterpriseRequestInit | undefined; body: string }[]
}

function recordingPort(reply: (path: string) => Response | Promise<Response>): RecordingPort {
  const calls: RecordingPort['calls'] = []
  return {
    calls,
    accessToken: () => REAL_TOKEN,
    request: async (path, init) => {
      const body = init?.body instanceof Uint8Array ? Buffer.from(init.body).toString('utf8') : ''
      calls.push({ path, init, body })
      return await reply(path)
    },
  }
}

async function withProxy(run: (proxy: EnterpriseGatewayProxy, port: RecordingPort) => Promise<void>): Promise<void> {
  const port = recordingPort(() => new Response('upstream', { status: 200 }))
  const proxy = await startEnterpriseGatewayProxy({ platform: port })
  try {
    await run(proxy, port)
  } finally {
    await proxy.dispose()
  }
}

interface RawResponse {
  readonly status: number
  readonly body: string
}

/** 直连 TCP 的原始请求，用于伪造来源地址与浏览器头（fetch 无法表达这两者）。 */
function rawHttp(options: {
  readonly payload: string
  readonly localAddress?: string
  readonly port: number
}): Promise<RawResponse | undefined> {
  return new Promise<RawResponse | undefined>(resolve => {
    const socket = connect({
      host: '127.0.0.1',
      port: options.port,
      ...(options.localAddress === undefined ? {} : { localAddress: options.localAddress }),
    })
    let text = ''
    let settled = false
    const finish = (value: RawResponse | undefined): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(value)
    }
    const timer = setTimeout(() => {
      // 内核丢弃了该源地址的包：本机不支持这种伪造，判定为无法验证。
      finish(undefined)
    }, 3000)
    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write(options.payload))
    socket.on('data', chunk => {
      text += chunk
    })
    socket.on('error', () => finish(undefined))
    socket.on('close', () => {
      const separation = text.indexOf('\r\n\r\n')
      if (separation < 0) {
        finish(undefined)
        return
      }
      const statusLine = text.slice(0, text.indexOf('\r\n'))
      finish({ status: Number(statusLine.split(' ')[1]), body: text.slice(separation + 4) })
    })
  })
}

/** 用于伪造非 loopback 来源的本机网卡地址；没有则跳过该断言。 */
function localNetworkAddress(): string | undefined {
  for (const entry of Object.values(networkInterfaces())) {
    for (const info of entry ?? []) {
      if (info.family === 'IPv4' && !info.internal) return info.address
    }
  }
  return undefined
}

describe('startEnterpriseGatewayProxy', () => {
  it('只绑定 127.0.0.1、端口随机，占位凭据不含真实令牌', async () => {
    await withProxy(async proxy => {
      expect(proxy.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/enterprise\/gateway\/v1$/)
      expect(Number(new URL(proxy.baseURL).port)).toBeGreaterThan(0)
      expect(proxy.authorization).toMatch(/^Bearer [A-Za-z0-9_-]{43}$/)
      expect(proxy.authorization).not.toContain(REAL_TOKEN)
    })
  })

  it('只放行 POST + 三条契约路由，并原样透传请求体', async () => {
    await withProxy(async (proxy, port) => {
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: '你好' }] })
      const allowed = await fetch(`${proxy.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { authorization: proxy.authorization, 'content-type': 'application/json', 'x-session-id': 's-1' },
        body,
      })
      expect(allowed.status).toBe(200)
      const [call] = port.calls
      expect(call?.path).toBe(ENTERPRISE_GATEWAY_ROUTES['openai-completions'])
      expect(call?.body).toBe(body)
      expect(call?.init?.method).toBe('POST')
      // 占位 bearer 绝不抵达中心：真实令牌由 platform 逐请求注入。
      expect(call?.init?.headers?.authorization).toBeUndefined()
      expect(call?.init?.headers?.['content-type']).toBe('application/json')
      expect(call?.init?.headers?.['x-session-id']).toBe('s-1')
      expect(call?.init?.headers?.['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)

      for (const path of ['/embeddings', '/chat/completions/extra', '/v1/embeddings']) {
        const denied = await fetch(`${proxy.baseURL}${path}`, {
          method: 'POST',
          headers: { authorization: proxy.authorization, 'content-type': 'application/json' },
          body: '{}',
        })
        expect(denied.status).toBe(404)
        expect(await denied.json()).toStrictEqual({
          error: { code: 'ENT_RESOURCE_NOT_FOUND', message: '企业模型代理没有该路由' },
        })
      }
      const wrongMethod = await fetch(`${proxy.baseURL}/chat/completions`, {
        headers: { authorization: proxy.authorization },
      })
      expect(wrongMethod.status).toBe(404)
      // 只有那一次合法请求到达平台。
      expect(port.calls).toHaveLength(1)
    })
  })

  it('容忍 SDK 重复拼接的一层 /v1，并映射回契约路由', async () => {
    await withProxy(async (proxy, port) => {
      const response = await fetch(`${proxy.baseURL}/v1/messages`, {
        method: 'POST',
        headers: { authorization: proxy.authorization, 'content-type': 'application/json' },
        body: '{}',
      })
      expect(response.status).toBe(200)
      expect(port.calls[0]?.path).toBe(ENTERPRISE_GATEWAY_ROUTES['anthropic-messages'])
    })
  })

  it('缺少或错误占位凭据返回 403，且真实令牌从不出现在响应里', async () => {
    const port = recordingPort(() => {
      throw new EnterprisePlatformError('ENT_UPSTREAM_RATE_LIMITED', `上游拒绝了 ${REAL_TOKEN}`, {
        httpStatus: 429,
        retryable: false,
        requestId: 'req-9',
        retryAfter: '7',
      })
    })
    const proxy = await startEnterpriseGatewayProxy({ platform: port })
    try {
      const missing = await fetch(`${proxy.baseURL}/chat/completions`, { method: 'POST', body: '{}' })
      expect(missing.status).toBe(403)
      expect(await missing.text()).not.toContain(REAL_TOKEN)

      const wrong = await fetch(`${proxy.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { authorization: 'Bearer wrong' },
        body: '{}',
      })
      expect(wrong.status).toBe(403)

      const folded = await fetch(`${proxy.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { authorization: proxy.authorization, 'content-type': 'application/json' },
        body: '{}',
      })
      expect(folded.status).toBe(429)
      expect(folded.headers.get('retry-after')).toBe('7')
      expect(folded.headers.get('x-request-id')).toBe('req-9')
      expect(await folded.json()).toStrictEqual({
        error: {
          code: 'ENT_UPSTREAM_RATE_LIMITED',
          message: '上游拒绝了 [redacted]',
          retryable: false,
          type: 'quota_exceeded',
        },
      })
    } finally {
      await proxy.dispose()
    }
  })

  it('浏览器来源（Origin）即使带正确占位凭据也 403', async () => {
    await withProxy(async (proxy, port) => {
      const { port: bound } = new URL(proxy.baseURL)
      const response = await rawHttp({
        port: Number(bound),
        payload: [
          `POST ${ENTERPRISE_GATEWAY_ROUTES['openai-completions']} HTTP/1.1`,
          'Host: 127.0.0.1',
          `Authorization: ${proxy.authorization}`,
          'Origin: http://127.0.0.1:43120',
          'Content-Type: application/json',
          'Content-Length: 2',
          'Connection: close',
          '',
          '{}',
        ].join('\r\n'),
      })
      expect(response?.status).toBe(403)
      expect(port.calls).toHaveLength(0)
    })
  })

  it('非 loopback 来源一律 403（真起 node:http，端口 0）', async ctx => {
    const localAddress = localNetworkAddress()
    if (localAddress === undefined) {
      ctx.skip()
      return
    }
    await withProxy(async (proxy, port) => {
      const { port: bound } = new URL(proxy.baseURL)
      const response = await rawHttp({
        localAddress,
        port: Number(bound),
        payload: [
          `POST ${ENTERPRISE_GATEWAY_ROUTES['openai-completions']} HTTP/1.1`,
          'Host: 127.0.0.1',
          `Authorization: ${proxy.authorization}`,
          'Content-Type: application/json',
          'Content-Length: 2',
          'Connection: close',
          '',
          '{}',
        ].join('\r\n'),
      })
      if (response === undefined) {
        // 不支持用非 loopback 源地址访问 127.0.0.1 的内核：仅能靠下方纯函数断言。
        ctx.skip()
        return
      }
      expect(response.status).toBe(403)
      expect(port.calls).toHaveLength(0)
    })
  })

  it('SSE 逐块透传：首块必须在上游闭合前到达客户端', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const encoder = new TextEncoder()
    const port: EnterpriseGatewayProxyPort = {
      accessToken: () => REAL_TOKEN,
      request: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('data: first\n\n'))
              void gate.then(() => {
                controller.enqueue(encoder.encode('data: second\n\n'))
                controller.close()
              })
            },
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req-sse' } },
        ),
    }
    const proxy = await startEnterpriseGatewayProxy({ platform: port })
    try {
      const response = await fetch(`${proxy.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { authorization: proxy.authorization, 'content-type': 'application/json' },
        body: '{}',
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(response.headers.get('x-request-id')).toBe('req-sse')
      const body = response.body
      if (body === null) throw new Error('代理必须给出流式响应体')
      const reader = body.getReader()
      const decoder = new TextDecoder()
      // 上游尚未闭合：若代理缓冲整条响应，这次 read 永远等不到。
      const first = await withTimeout(reader.read(), 5000, '首块没有在上游闭合前到达，代理缓冲了响应')
      let received = first.done || first.value === undefined ? '' : decoder.decode(first.value)
      expect(received).toBe('data: first\n\n')
      release()
      while (true) {
        const item = await withTimeout(reader.read(), 5000, '上游闭合后代理没有继续转发')
        if (item.done) break
        if (item.value !== undefined) received += decoder.decode(item.value)
      }
      expect(received).toBe('data: first\n\ndata: second\n\n')
    } finally {
      release()
      await proxy.dispose()
    }
  })

  it('dispose 幂等，并掐断在途连接', async () => {
    const port: EnterpriseGatewayProxyPort = {
      accessToken: () => REAL_TOKEN,
      // 永不闭合的 SSE：dispose 必须主动掐断，否则流式回答会吊死已卸载的宿主。
      request: async () =>
        new Response(new ReadableStream<Uint8Array>({ start: () => undefined }), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    }
    const proxy = await startEnterpriseGatewayProxy({ platform: port })
    const response = await fetch(`${proxy.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { authorization: proxy.authorization, 'content-type': 'application/json' },
      body: '{}',
    })
    const reader = response.body?.getReader()
    await proxy.dispose()
    await proxy.dispose()
    await expect(
      fetch(`${proxy.baseURL}/chat/completions`, { method: 'POST', headers: { authorization: proxy.authorization } }),
    ).rejects.toThrow()
    expect(reader).toBeDefined()
    const settled = await withTimeout(
      reader === undefined
        ? Promise.resolve('done')
        : reader.read().then(
            () => 'done',
            () => 'done',
          ),
      5000,
      'dispose 没有释放在途 SSE 连接',
    )
    expect(settled).toBe('done')
  })

  it('客户端断开时立刻掐断上游请求', async () => {
    let upstreamSignal: AbortSignal | undefined
    const port: EnterpriseGatewayProxyPort = {
      accessToken: () => REAL_TOKEN,
      request: async (_path, init) => {
        upstreamSignal = init?.signal ?? undefined
        return new Response(new ReadableStream<Uint8Array>({ start: () => undefined }), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      },
    }
    const proxy = await startEnterpriseGatewayProxy({ platform: port })
    try {
      const controller = new AbortController()
      const response = await fetch(`${proxy.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { authorization: proxy.authorization, 'content-type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      })
      expect(response.status).toBe(200)
      expect(upstreamSignal?.aborted).toBe(false)
      controller.abort()
      // 浏览器/客户端放弃回答后，中心侧的请求必须马上停，否则配额继续被吃。
      await vi.waitFor(() => {
        expect(upstreamSignal?.aborted).toBe(true)
      })
    } finally {
      await proxy.dispose()
    }
  })

  it('超长请求体返回 413 并关闭连接', async () => {
    await withProxy(async (proxy, port) => {
      const { port: bound } = new URL(proxy.baseURL)
      const chunk = 'x'.repeat(1024 * 1024)
      const response = await rawHttp({
        port: Number(bound),
        payload: [
          `POST ${ENTERPRISE_GATEWAY_ROUTES['openai-completions']} HTTP/1.1`,
          'Host: 127.0.0.1',
          `Authorization: ${proxy.authorization}`,
          'Content-Type: application/json',
          'Content-Length: 11534336',
          'Connection: close',
          '',
          '',
        ].join('\r\n') + chunk.repeat(11),
      })
      expect(response?.status).toBe(413)
      expect(response?.body).toContain('ENT_REQUEST_TOO_LARGE')
      expect(port.calls).toHaveLength(0)
    })
  })

  it('isLoopbackAddress 只接受 127.0.0.0/8 与 ::1', () => {
    for (const address of ['127.0.0.1', '127.0.0.5', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopbackAddress(address)).toBe(true)
    }
    for (const address of ['192.168.1.5', '10.0.0.1', '::ffff:192.168.1.5', '::2', '', null, undefined]) {
      expect(isLoopbackAddress(address)).toBe(false)
    }
  })
})

/** 假 Cordis 容器：只记录官方插件的挂载、更新与拆卸。 */
interface GatewayHarness {
  readonly ctx: Context
  readonly port: EnterpriseGatewayProxyPort & {
    bootstrap(): EnterpriseBootstrapSnapshot | undefined
    subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void
  }
  readonly configs: unknown[]
  readonly events: string[]
  emit(snapshot: EnterpriseBootstrapSnapshot): void
}

function createHarness(): GatewayHarness {
  const events: string[] = []
  const configs: unknown[] = []
  const listeners = new Set<(status: EnterprisePlatformStatus) => void>()
  let current: EnterpriseBootstrapSnapshot | undefined
  const fiber = Object.assign(Promise.resolve(), {
    update: (config: unknown, noSave?: boolean): Promise<void> => {
      events.push(noSave === true ? 'update:noSave' : 'update')
      configs.push(config)
      return Promise.resolve()
    },
    dispose: (): Promise<void> => {
      events.push('dispose-official')
      return Promise.resolve()
    },
  })
  const ctx: Record<string, unknown> = {}
  ctx.isolate = (name: string): unknown => {
    events.push(`isolate:${name}`)
    return ctx
  }
  ctx.plugin = (_plugin: unknown, config: unknown): unknown => {
    events.push('plugin')
    configs.push(config)
    return fiber
  }
  ctx.logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined }
  const port = {
    accessToken: () => REAL_TOKEN,
    request: async (): Promise<Response> => new Response('{}', { status: 200 }),
    bootstrap: (): EnterpriseBootstrapSnapshot | undefined => current,
    subscribe: (listener: (status: EnterprisePlatformStatus) => void): (() => void) => {
      listeners.add(listener)
      return () => {
        events.push('unsubscribe')
        listeners.delete(listener)
      }
    },
  }
  return {
    ctx: ctx as unknown as Context,
    port,
    configs,
    events,
    emit: (snapshot: EnterpriseBootstrapSnapshot): void => {
      current = snapshot
      const status: EnterprisePlatformStatus = { state: 'READY', bundleVersion: '0.1.0', platformUrl: null }
      for (const listener of listeners) listener(status)
    },
  }
}

describe('registerEnterpriseGateway', () => {
  it('隔离 settings 挂载官方 pi-ai，按 JSON 指纹幂等更新，并按序完整拆卸', async () => {
    const harness = createHarness()
    const snapshot = bootstrapSnapshot([
      { alias: 'deepseek-chat', name: 'DeepSeek Chat', apiProtocol: 'openai-completions', isDefault: true },
    ])
    const disposer = await registerEnterpriseGateway(harness.ctx, {
      platform: harness.port,
      harnessVersion: '0.1.7-rc.1',
      bundleVersion: '0.1.0',
    })
    expect(harness.events).toStrictEqual(['isolate:settings', 'plugin'])
    // 挂载时平台尚无快照：官方插件以空 route 集合启动，等订阅推送再更新。
    expect(harness.configs[0]).toStrictEqual({ providers: {} })

    harness.emit(snapshot)
    await vi.waitFor(() => {
      expect(harness.events).toStrictEqual(['isolate:settings', 'plugin', 'update:noSave'])
    })
    const updated = harness.configs[1] as { providers: EnterpriseProfiles }
    expect(Object.keys(updated.providers)).toStrictEqual(['enterprise-openai-completions', ENTERPRISE_PROVIDER])
    expect(updated.providers['enterprise-openai-completions'].baseURL).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/enterprise\/gateway\/v1$/,
    )
    expect(updated.providers[ENTERPRISE_PROVIDER].models?.[0].id).toBe(ENTERPRISE_DEFAULT_MODEL)

    // 同一快照（同一指纹）不得触发第二次更新。
    harness.emit(snapshot)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(harness.events.filter(event => event.startsWith('update'))).toHaveLength(1)

    await disposer()
    expect(harness.events.slice(-2)).toStrictEqual(['unsubscribe', 'dispose-official'])
    const settled = harness.events.length
    await disposer()
    expect(harness.events).toHaveLength(settled)
  })
})
