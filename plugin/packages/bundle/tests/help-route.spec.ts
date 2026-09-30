/**
 * [INPUT]: 依赖 `src/help-route.ts` 的地址派生与路由注册器、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定帮助中心本地路由的门禁 —— 地址只由 Host 的平台地址派生（严格 allowlist：没有可注入的输入）、POST 成功才 200、未配置/系统浏览器失败投影 503 且留判定点、非 POST 405，以及「浏览器不参与 URL 构造」
 * [POS]: bundle 帮助中心的回归门禁；有人让浏览器传 URL、把畸形平台地址当合法、或在失败时静默 200，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_HELP_LOCAL_PATH,
  ENTERPRISE_HELP_PATH,
  enterpriseHelpTarget,
  registerEnterpriseHelpRoute,
} from '../src/help-route.js'

describe('the help target is derived from the host platform origin', () => {
  it('appends the fixed /help/ path and normalises the origin', () => {
    expect(ENTERPRISE_HELP_PATH).toBe('/help/')
    expect(ENTERPRISE_HELP_LOCAL_PATH).toBe('/enterprise/api/v1/local/help/open')
    expect(enterpriseHelpTarget('https://enterprise.example.com')).toBe('https://enterprise.example.com/help/')
    expect(enterpriseHelpTarget('https://enterprise.example.com/enterprise/api')).toBe('https://enterprise.example.com/help/')
    expect(enterpriseHelpTarget('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/help/')
  })

  it('refuses everything that is not a usable http(s) origin (no hardcoded fallback)', () => {
    for (const value of [null, undefined, '', 'not a url', 'ftp://enterprise.example.com', 'javascript:alert(1)']) {
      expect(enterpriseHelpTarget(value), String(value)).toBeUndefined()
    }
    // 严格 allowlist 的另一半：源码里没有任何硬编码域名字面量。
    return import('node:fs/promises').then(async ({ readFile }) => {
      const source = await readFile(new URL('../src/help-route.ts', import.meta.url), 'utf8')
      expect(source).not.toMatch(/https?:\/\/[a-z0-9.-]+/u)
    })
  })
})

describe('POST /enterprise/api/v1/local/help/open', () => {
  let server: Server
  let baseUrl: string
  let route: Parameters<WebServerRoutePort['register']>[0] | undefined
  let open: Mock<(url: string, signal: AbortSignal) => Promise<void>>
  let onError: Mock<(message: string, error: unknown) => void>
  let platformOrigin: string | undefined

  beforeEach(async () => {
    route = undefined
    platformOrigin = 'https://enterprise.example.com'
    open = vi.fn<(url: string, signal: AbortSignal) => Promise<void>>(async () => undefined)
    onError = vi.fn<(message: string, error: unknown) => void>()
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        route = registered
        return () => { route = undefined }
      },
    }
    registerEnterpriseHelpRoute(webServer, () => platformOrigin, { open }, onError)
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

  it('opens the system browser at the derived URL and answers 200', async () => {
    // 交接当场必须没有已中止的信号：无正文 POST 的请求流 'close' 会立刻触发，
    // 判据只能是响应是否已写完（否则生产上 execFile 会被自己中止）。
    open.mockImplementationOnce(async (_url, signal) => {
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal.aborted).toBe(false)
    })
    const response = await fetch(`${baseUrl}${ENTERPRISE_HELP_LOCAL_PATH}`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { opened: true } })
    expect(open).toHaveBeenCalledTimes(1)
    const [url] = open.mock.calls[0]!
    expect(url).toBe('https://enterprise.example.com/help/')
    // 浏览器只在同源固定路径上发 POST，URL 由 Host 派生。
    expect(onError).not.toHaveBeenCalled()
  })

  it('ignores any client-supplied URL because the request carries none', async () => {
    const response = await fetch(`${baseUrl}${ENTERPRISE_HELP_LOCAL_PATH}`, {
      body: JSON.stringify({ url: 'https://attacker.example.com/' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(response.status).toBe(200)
    expect(open.mock.calls[0]?.[0]).toBe('https://enterprise.example.com/help/')
  })

  it('projects 503 with a controlled code when the platform origin is not configured', async () => {
    platformOrigin = undefined
    const response = await fetch(`${baseUrl}${ENTERPRISE_HELP_LOCAL_PATH}`, { method: 'POST' })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
    expect(open).not.toHaveBeenCalled()
    const [message, error] = onError.mock.calls[0]!
    expect(message).toContain(`operation=POST ${ENTERPRISE_HELP_LOCAL_PATH}`)
    expect(message).toContain('step=system-browser-failed')
    expect(message).toContain('status=503')
    expect(error).toBeInstanceOf(Error)
  })

  it('projects 503 when the system browser handoff rejects', async () => {
    open.mockRejectedValueOnce(new Error('xdg-open: not found'))
    const response = await fetch(`${baseUrl}${ENTERPRISE_HELP_LOCAL_PATH}`, { method: 'POST' })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
    expect(onError.mock.calls[0]?.[0]).toContain('xdg-open: not found')
  })

  it('answers 405 with an Allow header for every other method and never opens anything', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_HELP_LOCAL_PATH}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow')).toBe('POST')
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(open).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
