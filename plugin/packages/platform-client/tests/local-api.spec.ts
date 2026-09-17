/**
 * [INPUT]: 依赖 platform-client 本地 API 注册器与 Node 原生 HTTP server/fetch
 * [OUTPUT]: 验证方法/content-type/体积/DTO、平台/插件状态、显式刷新、无常驻 SSE、探针退役与 disposer
 * [POS]: platform-client Host/Client 协作回归测试，以真实 HTTP 锁定官方 webServer 契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  registerEnterpriseLocalApi,
  type EnterpriseLocalPlatformPort,
  type EnterprisePlatformStatus,
  type WebServerRoutePort,
} from '../src/index.js'

describe('enterprise local API', () => {
  let server: Server
  let baseUrl: string
  let routes: Map<string, Parameters<WebServerRoutePort['register']>[0]>
  let webServer: WebServerRoutePort
  let currentStatus: EnterprisePlatformStatus
  let platform: EnterpriseLocalPlatformPort
  let pluginStatus: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    routes = new Map()
    currentStatus = {
      state: 'SIGNED_OUT',
      bundleVersion: '0.1.0',
      platformUrl: 'https://enterprise.example.com',
      transport: 'webServer.register',
    }
    platform = {
      status: () => structuredClone(currentStatus),
      refresh: vi.fn(async () => structuredClone(currentStatus)),
      setServerUrl: vi.fn(async serverUrl => ({ serverUrl })),
      startLogin: vi.fn(async () => ({ flowId: 'flow-1' })),
      cancelLogin: vi.fn(() => true),
      logout: vi.fn(async () => undefined),
      bootstrap: vi.fn(() => undefined),
      listPresets: vi.fn(async () => []),
      getPreset: vi.fn(async () => ({ id: '1', presetId: 'weekly', displayName: '周报' })),
    }
    pluginStatus = vi.fn(() => ({
      assignmentRevision: 7,
      plugins: [{
        packageName: '@example/dsh-code-review',
        version: '1.2.0',
        sha256: 'a'.repeat(64),
        desiredRevision: 7,
        desiredState: 'INSTALLED',
        state: 'RESTART_REQUIRED',
        lastErrorCode: null,
        restartMarker: null,
      }],
    }))
    webServer = {
      register: (route) => {
        const key = `${route.kind}:${route.path}`
        if (routes.has(key)) throw new Error(`duplicate route ${key}`)
        routes.set(key, route)
        return () => { routes.delete(key) }
      },
    }
    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      const route = routes.get(`exact:${path}`) ?? [...routes.values()].find(candidate => (
        candidate.kind === 'prefix' && path.startsWith(candidate.path)
      ))
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(request, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('serves desensitized state and bootstrap without CORS or Token fields', async () => {
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus })
    const response = await fetch(`${baseUrl}/enterprise/api/v1/local/status`)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    const body = await response.json()
    expect(body).toEqual({ data: currentStatus })
    expect(JSON.stringify(body)).not.toMatch(/token|authorization/i)

    const bootstrap = await fetch(`${baseUrl}/enterprise/api/v1/local/bootstrap`)
    await expect(bootstrap.json()).resolves.toEqual({ data: null })
    const plugins = await fetch(`${baseUrl}/enterprise/api/v1/local/plugins`)
    expect(plugins.headers.get('cache-control')).toBe('no-store')
    await expect(plugins.json()).resolves.toEqual({ data: pluginStatus.mock.results[0]?.value })
    expect(pluginStatus).toHaveBeenCalledOnce()
    expect(JSON.stringify(pluginStatus.mock.results[0]?.value)).not.toMatch(/token|authorization|publicKey/i)
    const rejected = await fetch(`${baseUrl}/enterprise/api/v1/local/status`, { method: 'POST' })
    expect(rejected.status).toBe(405)
    expect(rejected.headers.get('allow')).toBe('GET')
  })

  it('validates empty JSON action DTOs and dispatches login, cancel, and logout', async () => {
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus })
    const start = await fetch(`${baseUrl}/enterprise/api/v1/local/auth/start`, {
      body: '{}', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(start.status).toBe(200)
    await expect(start.json()).resolves.toEqual({ data: { flowId: 'flow-1' } })

    const cancel = await fetch(`${baseUrl}/enterprise/api/v1/local/auth/cancel`, {
      body: '{}', headers: { 'content-type': 'application/json; charset=utf-8' }, method: 'POST',
    })
    await expect(cancel.json()).resolves.toEqual({ data: { cancelled: true } })
    const logout = await fetch(`${baseUrl}/enterprise/api/v1/local/logout`, {
      body: '{}', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    await expect(logout.json()).resolves.toEqual({ data: { loggedOut: true } })
    expect(platform.startLogin).toHaveBeenCalledOnce()
    expect(platform.cancelLogin).toHaveBeenCalledOnce()
    expect(platform.logout).toHaveBeenCalledOnce()

    const wrongType = await fetch(`${baseUrl}/enterprise/api/v1/local/auth/start`, {
      body: '{}', headers: { 'content-type': 'text/plain' }, method: 'POST',
    })
    expect(wrongType.status).toBe(400)
    const unknownField = await fetch(`${baseUrl}/enterprise/api/v1/local/auth/start`, {
      body: '{"unexpected":true}', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(unknownField.status).toBe(400)
  })

  it('accepts only explicit package/version actions and rejects executable or unknown fields', async () => {
    const pluginAction = vi.fn(async () => undefined)
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus, pluginAction })
    const post = (action: string, body: unknown) => fetch(`${baseUrl}/enterprise/api/v1/local/plugins/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    for (const body of [
      {}, { packageName: '--eval', pluginVersionId: '880' },
      { packageName: '@example/tools', pluginVersionId: '880', command: 'dsh' },
      { packageName: '@example/tools', pluginVersionId: '../880' },
    ]) expect((await post('install', body)).status).toBe(400)
    expect(pluginAction).not.toHaveBeenCalled()
    expect((await post('install', { packageName: '@example/tools', pluginVersionId: '880' })).status).toBe(200)
    expect(pluginAction).toHaveBeenCalledWith('install', '@example/tools', '880')
    expect((await post('remove', { packageName: '@example/tools' })).status).toBe(200)
    expect(pluginAction).toHaveBeenCalledWith('remove', '@example/tools', undefined)
    pluginAction.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'ENT_PLUGIN_BUSY' }))
    expect((await post('remove', { packageName: '@example/tools' })).status).toBe(409)
  })

  it('updates the Server origin and responds before invoking the optional restart after uninstall', async () => {
    const calls: string[] = []
    registerEnterpriseLocalApi(webServer, {
      platform,
      pluginStatus,
      uninstallPlugin: async () => ({ restart: () => { calls.push('restart') } }),
    })
    const server = await fetch(`${baseUrl}/enterprise/api/v1/local/server`, {
      body: JSON.stringify({ serverUrl: 'https://next.example.com' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    await expect(server.json()).resolves.toEqual({ data: { serverUrl: 'https://next.example.com' } })
    expect(platform.setServerUrl).toHaveBeenCalledWith('https://next.example.com')

    const uninstall = await fetch(`${baseUrl}/enterprise/api/v1/local/uninstall`, {
      body: '{}', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    await expect(uninstall.json()).resolves.toEqual({
      data: { uninstalled: true, restartRequested: true },
    })
    expect(calls).toEqual(['restart'])
  })

  it('refreshes on demand and has no resident SSE endpoint', async () => {
    const dispose = registerEnterpriseLocalApi(webServer, { platform, pluginStatus })
    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/events`)).status).toBe(404)
    expect(platform.refresh).not.toHaveBeenCalled()
    const response = await fetch(`${baseUrl}/enterprise/api/v1/local/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    await expect(response.json()).resolves.toEqual({ data: currentStatus })
    expect(platform.refresh).toHaveBeenCalledOnce()
    dispose()
    expect(routes.size).toBe(0)
  })

  it('rejects invalid and oversized Server DTOs, omits the retired probe, and removes every route', async () => {
    const dispose = registerEnterpriseLocalApi(webServer, { platform, pluginStatus })
    const probe = await fetch(`${baseUrl}/enterprise/api/v1/local/session-copies`, { method: 'POST' })
    expect(probe.status).toBe(404)
    const invalid = await fetch(`${baseUrl}/enterprise/api/v1/local/server`, {
      body: '{"unexpected":"x"}',
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(invalid.status).toBe(400)
    const oversized = await fetch(`${baseUrl}/enterprise/api/v1/local/server`, {
      body: JSON.stringify({ padding: 'x'.repeat(256 * 1024) }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(oversized.status).toBe(413)
    dispose()
    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/status`)).status).toBe(404)
  })

  it('exposes cloud project routes only when the port is injected and maps workspace errors', async () => {
    const cloudWorkspace = {
      list: vi.fn(async () => [{ id: '1', slug: 'team-docs', name: 'Team Docs', cloneUrl: 'https://x/1', role: 'OWNER', mapping: null }]),
      create: vi.fn(async (body: { name: string }) => ({ id: '2', slug: 'docs', name: body.name, cloneUrl: 'https://x/2', role: 'OWNER', mapping: null })),
      clone: vi.fn(async () => ({ path: '/tmp/team-docs' })),
      pull: vi.fn(async () => ({ fastForward: true, message: 'ok' })),
      commit: vi.fn(async () => ({ committed: true })),
      push: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ branch: 'main', dirty: false, path: '/tmp/team-docs' })),
      addMember: vi.fn(async (_projectId: string, body: { userId: string }) => ({ userId: body.userId, role: 'MEMBER' })),
    }
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus, cloudWorkspace })

    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects`)).json())
      .resolves.toEqual({
        data: [{ id: '1', slug: 'team-docs', name: 'Team Docs', cloneUrl: 'https://x/1', role: 'OWNER', mapping: null }],
      })
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects`, {
      body: JSON.stringify({ name: 'Docs' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).json()).resolves.toEqual({
      data: { id: '2', slug: 'docs', name: 'Docs', cloneUrl: 'https://x/2', role: 'OWNER', mapping: null },
    })
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/clone`, {
      body: JSON.stringify({ rootDir: '/tmp' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).json()).resolves.toEqual({ data: { path: '/tmp/team-docs' } })
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/pull`, { method: 'POST' })).json())
      .resolves.toEqual({ data: { fastForward: true, message: 'ok' } })
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/commit`, {
      body: JSON.stringify({ message: 'update' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).json()).resolves.toEqual({ data: { committed: true } })
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/status`, { method: 'POST' })).json())
      .resolves.toEqual({ data: { branch: 'main', dirty: false, path: '/tmp/team-docs' } })
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/members`, {
      body: JSON.stringify({ userId: '7' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).json()).resolves.toEqual({ data: { userId: '7', role: 'MEMBER' } })

    const invalidMember = await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/members`, {
      body: JSON.stringify({ userId: 'not-an-id' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(invalidMember.status).toBe(400)
  })

  it('omits cloud project routes when no port is injected', async () => {
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus })
    const response = await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects`)
    expect(response.status).toBe(404)
  })

  it('maps stable workspace error codes to their HTTP status', async () => {
    const cloudWorkspace = {
      list: vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'ENT_WORKSPACE_DISABLED' }) }),
      create: vi.fn(async () => { throw Object.assign(new Error('conflict'), { code: 'ENT_WORKSPACE_SLUG_CONFLICT' }) }),
      clone: vi.fn(async () => { throw Object.assign(new Error('not mapped'), { code: 'ENT_WORKSPACE_NOT_MAPPED' }) }),
      pull: vi.fn(async () => { throw Object.assign(new Error('git down'), { code: 'ENT_GIT_UNAVAILABLE' }) }),
      commit: vi.fn(async () => { throw Object.assign(new Error('diverged'), { code: 'ENT_GIT_NON_FAST_FORWARD' }) }),
      push: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ branch: 'main', dirty: false, path: '/tmp/x' })),
      addMember: vi.fn(async (_projectId: string, body: { userId: string }) => ({ userId: body.userId, role: 'MEMBER' })),
    }
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus, cloudWorkspace })

    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects`)).status).toBe(403)
    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects`, {
      body: JSON.stringify({ name: 'Docs' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).status).toBe(409)
    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/clone`, {
      body: JSON.stringify({ rootDir: '/tmp' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).status).toBe(400)
    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/pull`, { method: 'POST' })).status).toBe(500)
    expect((await fetch(`${baseUrl}/enterprise/api/v1/local/cloud-projects/1/commit`, {
      body: JSON.stringify({ message: 'update' }),
      headers: { 'content-type': 'application/json' }, method: 'POST',
    })).status).toBe(409)
  })
})
