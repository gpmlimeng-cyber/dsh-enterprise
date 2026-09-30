/**
 * [INPUT]: 依赖 `src/usage-route.ts` 的路由注册器与投影纯函数、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定「我的用量」本地只读路由的 200/401/405/上游异常四类投影、上游信封剥离、以及「浏览器不接触令牌」的请求面
 * [POS]: bundle 的用量取数回归门禁；有人把上游正文原样写出、把 401 折成 503，或在路由里自己发 HTTP 带令牌，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_USAGE_LOCAL_PATH,
  ENTERPRISE_USAGE_ME_PATH,
  projectUsageEnvelope,
  projectUsageFailure,
  registerEnterpriseUsageRoute,
} from '../src/usage-route.js'

/** 中心 `usage/me` 的真实信封形状：策略数组 + requestId（requestId 必须止步于 Host）。 */
const UPSTREAM_BODY = {
  data: [
    {
      daily: { limit: 1_000_000, reservedTokens: 1024, resetsAt: '2026-08-19T00:00:00+08:00', usedTokens: 12_000 },
      fiveHours: { limit: 200_000, reservedTokens: 1024, resetsAt: '2026-08-18T20:00:00+08:00', usedTokens: 12_000 },
      monthly: { limit: 20_000_000, reservedTokens: 1024, resetsAt: '2026-09-01T00:00:00+08:00', usedTokens: 250_000 },
      name: 'Default',
      policyId: '1900100000000000002',
      resourceName: '全部模型',
      resourceType: 'ALL_MODELS',
      scope: 'ORGANIZATION',
      weekly: { limit: 5_000_000, reservedTokens: 1024, resetsAt: '2026-08-24T00:00:00+08:00', usedTokens: 250_000 },
    },
  ],
  requestId: 'req_01K2W3V4X5Y6Z7A8B9C0D1E2F3',
}

describe('usage route projection', () => {
  it('strips the upstream envelope down to data and rejects other shapes', () => {
    expect(projectUsageEnvelope(UPSTREAM_BODY)).toBe(UPSTREAM_BODY.data)
    expect(() => projectUsageEnvelope({ requestId: 'req_1' })).toThrow(TypeError)
    expect(() => projectUsageEnvelope([UPSTREAM_BODY])).toThrow(TypeError)
    expect(() => projectUsageEnvelope(null)).toThrow(TypeError)
  })

  it('projects 401 for auth rejections and 503 for everything else', () => {
    expect(projectUsageFailure(Object.assign(new Error('expired'), {
      code: 'ENT_AUTH_SESSION_EXPIRED',
      httpStatus: 401,
    }))).toEqual({ status: 401, code: 'ENT_AUTH_SESSION_EXPIRED', step: 'upstream-unauthorized-expired' })
    expect(projectUsageFailure(Object.assign(new Error('missing'), { code: 'ENT_AUTH_REQUIRED' })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'upstream-unauthorized' })
    // 上游 401 但码被折叠掉时仍必须投影 401，不能退化成 503。
    expect(projectUsageFailure(Object.assign(new Error('unauthorized'), { httpStatus: 401 })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'upstream-unauthorized' })
    expect(projectUsageFailure(Object.assign(new Error('revoked'), { code: 'ENT_DEVICE_REVOKED', httpStatus: 403 })))
      .toEqual({ status: 503, code: 'ENT_DEVICE_REVOKED', step: 'upstream-failed' })
    // 网络中断与畸形正文都没有受控码：503 + 本地稳定码，绝不复述任意字符串。
    expect(projectUsageFailure(new Error('socket hang up')))
      .toEqual({ status: 503, code: 'ENT_PLATFORM_UNAVAILABLE', step: 'upstream-failed' })
    expect(projectUsageFailure(Object.assign(new Error('odd'), { code: 'not a code' })))
      .toEqual({ status: 503, code: 'ENT_PLATFORM_UNAVAILABLE', step: 'upstream-failed' })
  })
})

describe('GET /enterprise/api/v1/local/usage', () => {
  let server: Server
  let baseUrl: string
  let route: Parameters<WebServerRoutePort['register']>[0] | undefined
  let request: Mock<(input: string, init?: RequestInit) => Promise<Response>>
  let onError: Mock<(message: string, error: unknown) => void>

  beforeEach(async () => {
    route = undefined
    request = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(UPSTREAM_BODY), {
        headers: { 'content-type': 'application/json' },
        status: 200,
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
    registerEnterpriseUsageRoute(webServer, { request }, onError)
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

  it('GET 200 透传 data 且不泄漏 requestId，并由 Host 代取中心路径', async () => {
    expect(ENTERPRISE_USAGE_ME_PATH).toBe('/enterprise/api/v1/usage/me')
    expect(ENTERPRISE_USAGE_LOCAL_PATH).toBe('/enterprise/api/v1/local/usage')
    const response = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: UPSTREAM_BODY.data })
    // 取数只经平台 Service：路由自己不发 HTTP，也不自行拼 Authorization 头。
    expect(request).toHaveBeenCalledTimes(1)
    const [path, init] = request.mock.calls[0]!
    expect(path).toBe(ENTERPRISE_USAGE_ME_PATH)
    expect(init?.method).toBe('GET')
    expect(JSON.stringify(init?.headers)).not.toContain('uthorization')
    expect(onError).not.toHaveBeenCalled()
  })

  it('上游 401 投影 401 并留 warn 判定点', async () => {
    request.mockRejectedValueOnce(Object.assign(new Error('platform login is required'), {
      code: 'ENT_AUTH_REQUIRED',
      httpStatus: 401,
    }))
    const response = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'ENT_AUTH_REQUIRED' } })
    expect(onError).toHaveBeenCalledTimes(1)
    const [message] = onError.mock.calls[0]!
    expect(message).toContain(`operation=GET ${ENTERPRISE_USAGE_LOCAL_PATH}`)
    expect(message).toContain('step=upstream-unauthorized')
    expect(message).toContain('status=401')
  })

  it('上游异常投影 503 并留 warn 判定点', async () => {
    request.mockRejectedValueOnce(new Error('socket hang up'))
    const response = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`)
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
    const response = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('上游返回非 2xx 但未抛异常时按状态码投影', async () => {
    request.mockResolvedValueOnce(new Response('{"error":{"code":"ENT_AUTH_REQUIRED"}}', { status: 401 }))
    const unauthorized = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`)
    expect(unauthorized.status).toBe(401)
    request.mockResolvedValueOnce(new Response('{"error":{"code":"ENT_PLATFORM_UNAVAILABLE"}}', { status: 503 }))
    const failed = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
  })

  it('非 GET 一律 405 并声明 Allow，且不触发任何取数', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_USAGE_LOCAL_PATH}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow')).toBe('GET')
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(request).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
