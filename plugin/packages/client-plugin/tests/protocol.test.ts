/**
 * [INPUT]: 依赖 vitest、node:fs 读取契约 fixture、protocol 层 envelope 与 http
 * [OUTPUT]: 覆盖信封解包、错误码折叠、Retry-After 保留、服务地址规范化、401 单次重放与超时折叠
 * [POS]: protocol 层的地基单测；这些不变量一旦破了，上层所有模块的错误语义都会失真
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import {
  EnterprisePlatformError,
  toNetworkError,
  toPlatformError,
  unwrapEnvelope,
} from '../src/protocol/envelope.js'
import { EnterpriseHttpClient, normalizeServerUrl } from '../src/protocol/http.js'

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'),
  ) as unknown
}

function asFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof globalThis.fetch {
  return impl as unknown as typeof globalThis.fetch
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('envelope', () => {
  it('解包 data 信封并保留主体', () => {
    const data = unwrapEnvelope<{ sources: { type: string }[] }>(
      fixture('auth-sources-success.json'),
    )
    expect(data.sources).toHaveLength(1)
    expect(data.sources[0]?.type).toBe('LOCAL')
  })

  it('缺少 data 信封时抛 ENT_RESPONSE_INVALID', () => {
    expect(() => unwrapEnvelope({ requestId: 'req_x' })).toThrowError(EnterprisePlatformError)
    try {
      unwrapEnvelope({ requestId: 'req_x' })
    } catch (error) {
      expect((error as EnterprisePlatformError).code).toBe('ENT_RESPONSE_INVALID')
    }
  })

  it('契约内错误码原样保留，并带出 requestId 与 retryable', () => {
    const error = toPlatformError(fixture('quota-error.json'), 429)
    expect(error.code).toBe('ENT_QUOTA_DAILY_EXCEEDED')
    expect(error.requestId).toBe('req_01ARZ3NDEKTSV4RRFFQ69G5FAV')
    expect(error.retryable).toBe(false)
    expect(error.httpStatus).toBe(429)
    expect(error.message).toContain('配额')
  })

  it('契约外错误码折叠为 ENT_NETWORK_ERROR，不允许未知码穿透', () => {
    const error = toPlatformError(fixture('unknown-error-code.json'), 500)
    expect(error.code).toBe('ENT_NETWORK_ERROR')
  })

  it('Retry-After 头被保留供上层退避', () => {
    const headers = new Headers({ 'retry-after': '30' })
    const error = toPlatformError({ error: { code: 'ENT_AUTH_REQUIRED', message: 'x', retryable: true } }, 401, headers)
    expect(error.retryAfter).toBe('30')
    expect(error.code).toBe('ENT_AUTH_REQUIRED')
  })

  it('缺少 retryable 时按 HTTP 状态兜底', () => {
    expect(toPlatformError({ error: { code: 'ENT_REQUEST_IN_PROGRESS', message: 'x' } }, 429).retryable).toBe(true)
    expect(toPlatformError({ error: { code: 'ENT_REQUEST_IN_PROGRESS', message: 'x' } }, 400).retryable).toBe(false)
  })

  it('abort 折叠为 ENT_AUTH_TIMEOUT，其余网络异常折叠为 ENT_NETWORK_ERROR', () => {
    const aborted = new Error('aborted')
    aborted.name = 'AbortError'
    expect(toNetworkError(aborted).code).toBe('ENT_AUTH_TIMEOUT')
    expect(toNetworkError(new Error('ECONNREFUSED')).code).toBe('ENT_NETWORK_ERROR')
  })
})

describe('normalizeServerUrl', () => {
  it('接受 http/https 并去掉尾斜杠', () => {
    expect(normalizeServerUrl('http://192.168.1.50:8080/')).toBe('http://192.168.1.50:8080')
    expect(normalizeServerUrl(' https://ent.example.com ')).toBe('https://ent.example.com')
  })

  it('拒绝空值、非 URL、非 http(s) 与带查询串/片段的地址', () => {
    for (const bad of ['', '   ', 'not-a-url', 'ftp://x/y', 'http://h/?a=1', 'http://h/#f']) {
      expect(() => normalizeServerUrl(bad)).toThrowError(EnterprisePlatformError)
    }
  })
})

describe('EnterpriseHttpClient', () => {
  it('200 时解包 data 并携带 Bearer 头', async () => {
    const seen: RequestInit[] = []
    const http = new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      accessToken: () => 'sa-token-1',
      fetch: asFetch(async (_url, init) => {
        seen.push(init ?? {})
        return jsonResponse(fixture('auth-sources-success.json'))
      }),
    })
    const data = await http.request<{ sources: unknown[] }>('/enterprise/auth/v1/sources')
    expect(data.sources).toHaveLength(1)
    expect((seen[0]?.headers as Record<string, string>).authorization).toBe('Bearer sa-token-1')
  })

  it('401 只续期重放一次，成功后返回新令牌的结果', async () => {
    let calls = 0
    const refresh = vi.fn(async () => 'sa-token-2')
    const http = new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      accessToken: () => (calls === 0 ? 'stale' : 'sa-token-2'),
      onUnauthorized: refresh,
      fetch: asFetch(async (_url, init) => {
        calls += 1
        const auth = (init?.headers as Record<string, string> | undefined)?.authorization
        return auth === 'Bearer sa-token-2'
          ? jsonResponse({ data: { ok: true }, requestId: 'req_1' })
          : jsonResponse(fixture('quota-error.json'), 401)
      }),
    })
    const data = await http.request<{ ok: boolean }>('/enterprise/api/v1/bootstrap')
    expect(data.ok).toBe(true)
    expect(calls).toBe(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('无法续期时抛出中心错误码，不再重放', async () => {
    let calls = 0
    const http = new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      accessToken: () => 'stale',
      onUnauthorized: async () => null,
      fetch: asFetch(async () => {
        calls += 1
        return jsonResponse(fixture('quota-error.json'), 401)
      }),
    })
    await expect(http.request('/enterprise/api/v1/bootstrap')).rejects.toMatchObject({
      code: 'ENT_QUOTA_DAILY_EXCEEDED',
      httpStatus: 401,
    })
    expect(calls).toBe(1)
  })

  it('超时折叠为 ENT_AUTH_TIMEOUT 并 abort 上游请求', async () => {
    const http = new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      timeoutMs: 20,
      fetch: asFetch(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const error = new Error('aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }),
      ),
    })
    await expect(http.request('/enterprise/api/v1/bootstrap')).rejects.toMatchObject({
      code: 'ENT_AUTH_TIMEOUT',
    })
  })

  it('非 2xx 且无 error 主体时仍给出稳定失败', async () => {
    const http = new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetch: asFetch(async () => new Response('boom', { status: 500 })),
    })
    await expect(http.request('/enterprise/api/v1/bootstrap')).rejects.toMatchObject({
      code: 'ENT_NETWORK_ERROR',
      httpStatus: 500,
    })
  })

  it('释放后请求立即失败', async () => {
    const http = new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetch: asFetch(async () => jsonResponse({ data: {}, requestId: 'r' })),
    })
    http.dispose()
    await expect(http.request('/enterprise/api/v1/bootstrap')).rejects.toMatchObject({
      code: 'ENT_PLATFORM_DISPOSED',
    })
  })
})
