/**
 * [INPUT]: 依赖 platform-client 本地 API 注册器与 Node 原生 HTTP server/fetch，路由分发复用同目录的引擎语义匹配器 `engine-route-match.ts`
 * [OUTPUT]: 验证方法/content-type/体积/DTO、平台/插件状态、显式刷新、无常驻 SSE、探针退役与 disposer、**三条技能动作 exact 路由（形状/入参门禁/409 与 503 错误投影/405 Allow/端口缺席即不注册）**，并用引擎语义锁死「三条详情 prefix 不带尾斜杠」——品牌位图 / 会话恢复 / 配方详情对子路径可达，且带尾斜杠的旧形状会漏掉子路径；同时锁死 `/skills/install|uninstall|installed` 靠 exact 表抢在 bundle 侧 `/skills` 详情 prefix 之前
 * [POS]: platform-client Host/Client 协作回归测试，以真实 HTTP 锁定官方 webServer 契约；prefix 形状的判定不再用「裸 startsWith」假匹配器，而是逐行复刻引擎 `match()`，否则线上空体 404 在测试里是绿的
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH,
  ENTERPRISE_SKILL_INSTALL_LOCAL_PATH,
  ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH,
  registerEnterpriseLocalApi,
  type EnterpriseLocalPlatformPort,
  type EnterpriseLocalSessionPort,
  type EnterprisePlatformStatus,
  type WebServerRoutePort,
} from '../src/index.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'

/**
 * 会话同步端口假件。`restore` 留出独立引用，用来断言 sourceSessionId 确实是从 URL 路径段切出来的，
 * 而不是被某个更宽的 prefix 整段吞掉。
 */
function sessionSyncPort(): {
  readonly port: EnterpriseLocalSessionPort
  readonly restore: ReturnType<typeof vi.fn<(sourceSessionId: string, cwd: string) => Promise<{ restoredSessionId: string, sourceSessionId: string }>>>
} {
  const restore = vi.fn<(sourceSessionId: string, cwd: string) => Promise<{ restoredSessionId: string, sourceSessionId: string }>>(
    async sourceSessionId => ({ restoredSessionId: 'restored-9', sourceSessionId }),
  )
  const port: EnterpriseLocalSessionPort = {
    list: vi.fn(async () => []),
    restore,
    status: vi.fn(() => ({ deviceId: 'device-1', enabled: true, lastError: null, pendingSessionIds: [] })),
  }
  return { port, restore }
}

describe('enterprise local API', () => {
  let server: Server
  let baseUrl: string
  let routes: Map<string, RegisteredRoute>
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
      // 与引擎 `handle()` 同形：先取 URL pathname（丢查询串），再走 match()，未命中即空体 404。
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      const route = engineRouteMatch([...routes.values()], path)
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

  // 技能一键安装的三条 exact 动作路由：形状、入参门禁、错误投影与 405 契约都在真实 HTTP 上锁死。
  it('exposes the three skill actions by exact path, validates the body, and projects skill failure codes', async () => {
    const skillStatus = vi.fn(async () => ({ skills: [{ packageId: '901', names: ['code-review'] }] }))
    const skillAction = vi.fn(async (action: 'install' | 'uninstall', packageId: string) => ({
      skills: action === 'install' ? [{ packageId, names: ['code-review'] }] : [],
    }))
    const onError = vi.fn()
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus, skillAction, skillStatus, onError })

    // 注册形状：三条一律 exact、path 与共享常量逐字相同、都不带尾斜杠（尾斜杠一旦回来这里先红）。
    const skillRoutes = [...routes.values()].filter(route => route.path.includes('/local/skills/'))
    expect(skillRoutes.map(route => route.kind)).toEqual(['exact', 'exact', 'exact'])
    expect(skillRoutes.map(route => route.path).sort()).toEqual([
      ENTERPRISE_SKILL_INSTALL_LOCAL_PATH,
      ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH,
      ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH,
    ])

    const post = (action: string, body: unknown) => fetch(`${baseUrl}/enterprise/api/v1/local/skills/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })

    // GET 已装态：单键 `{data}` 信封，Host 的清单形状原样透传（路由层不认识技能字段）。
    const installed = await fetch(`${baseUrl}/enterprise/api/v1/local/skills/installed`)
    expect(installed.headers.get('cache-control')).toBe('no-store')
    await expect(installed.json()).resolves.toEqual({ data: { skills: [{ packageId: '901', names: ['code-review'] }] } })
    expect(skillStatus).toHaveBeenCalledOnce()

    // 入参门禁：只认 `{packageId}` 单键雪花朵；多键、路径片段、数字、前导零与非雪花形状一律 400 且不进动作。
    for (const body of [
      {}, { packageId: '901', source: 'https://evil.example' }, { packageId: '../../etc/passwd' },
      { packageId: 901 }, { packageId: '0' }, { packageId: '01902500000000000001' },
    ]) expect((await post('install', body)).status).toBe(400)
    expect(skillAction).not.toHaveBeenCalled()

    const ok = await post('install', { packageId: '901' })
    await expect(ok.json()).resolves.toEqual({ data: { skills: [{ packageId: '901', names: ['code-review'] }] } })
    expect(skillAction).toHaveBeenCalledWith('install', '901')
    await expect((await post('uninstall', { packageId: '901' })).json()).resolves.toEqual({ data: { skills: [] } })
    expect(skillAction).toHaveBeenCalledWith('uninstall', '901')

    // 错误投影：同名技能目录已被占用是本机状态冲突（409），其余技能失败族投影 503 并保留受控码。
    skillAction.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'ENT_SKILL_NAME_CONFLICT' }))
    expect((await post('install', { packageId: '901' })).status).toBe(409)
    skillAction.mockRejectedValueOnce(Object.assign(new Error('hash'), { code: 'ENT_SKILL_HASH_MISMATCH' }))
    const rejected = await post('install', { packageId: '901' })
    expect(rejected.status).toBe(503)
    await expect(rejected.json()).resolves.toEqual({ error: { code: 'ENT_SKILL_HASH_MISMATCH' } })
    expect(onError).toHaveBeenCalled()

    // 405 契约：动作只认 POST、清单只认 GET，都不触发端口。
    const wrongActionMethod = await fetch(`${baseUrl}/enterprise/api/v1/local/skills/install`)
    expect(wrongActionMethod.status).toBe(405)
    expect(wrongActionMethod.headers.get('allow')).toBe('POST')
    const wrongInstalledMethod = await fetch(`${baseUrl}/enterprise/api/v1/local/skills/installed`, {
      body: '{}', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(wrongInstalledMethod.status).toBe(405)
    expect(wrongInstalledMethod.headers.get('allow')).toBe('GET')
    expect(skillAction).toHaveBeenCalledTimes(4)
    expect(skillStatus).toHaveBeenCalledOnce()
  })

  // 端口缺席即不注册；注册后也必须靠 exact 表抢在 bundle 侧 `/skills` 详情 prefix 之前。
  it('registers no skill action without a port and keeps the actions ahead of the /skills detail prefix', () => {
    registerEnterpriseLocalApi(webServer, { platform, pluginStatus })
    expect([...routes.values()].some(route => route.path.includes('/local/skills/'))).toBe(false)

    // bundle 侧的真实形状桩：列表 exact + 详情 prefix 共用同一字符串（不带尾斜杠）。
    const detail: RegisteredRoute = {
      kind: 'prefix', path: '/enterprise/api/v1/local/skills', handler: () => undefined,
    }
    const install: RegisteredRoute = {
      kind: 'exact', path: ENTERPRISE_SKILL_INSTALL_LOCAL_PATH, handler: () => undefined,
    }
    const installed: RegisteredRoute = {
      kind: 'exact', path: ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH, handler: () => undefined,
    }
    const table = [detail, install, installed]
    expect(engineRouteMatch(table, ENTERPRISE_SKILL_INSTALL_LOCAL_PATH)).toBe(install)
    expect(engineRouteMatch(table, ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH)).toBe(installed)
    // 反例：exact 表只看整路径，裸前缀与真实包 id 子路径仍归详情 prefix，不被动作抢走。
    expect(engineRouteMatch(table, '/enterprise/api/v1/local/skills')).toBe(detail)
    expect(engineRouteMatch(table, '/enterprise/api/v1/local/skills/1902500000000000001')).toBe(detail)
    // 尾斜杠旧形状在引擎语义下漏掉一切子路径——这正是本仓修过的空体 404 家族。
    expect(engineRouteMatch([{ ...detail, path: '/enterprise/api/v1/local/skills/' }], ENTERPRISE_SKILL_INSTALL_LOCAL_PATH))
      .toBeUndefined()
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

  it('registers the three detail prefixes without a trailing slash and keeps bare paths on the exact table', () => {
    const { port: sessionSync } = sessionSyncPort()
    const branding = { asset: vi.fn(async () => undefined), document: vi.fn(async () => null) }
    registerEnterpriseLocalApi(webServer, { branding, platform, pluginStatus, sessionSync })
    const registered = [...routes.values()]

    // 三条 prefix 的注册 path 与各自父路径逐字相同（不带尾斜杠）——尾斜杠一旦回来，这里先红。
    expect(registered.filter(route => route.kind === 'prefix').map(route => route.path).sort())
      .toEqual([
        '/enterprise/api/v1/local/branding/asset',
        '/enterprise/api/v1/local/presets',
        '/enterprise/api/v1/local/sessions',
      ])

    // 引擎语义下这三条子路径必须命中 prefix（旧形状会返回 undefined → 空体 404）。
    for (const [pathname, expected] of [
      ['/enterprise/api/v1/local/branding/asset/light', '/enterprise/api/v1/local/branding/asset'],
      ['/enterprise/api/v1/local/sessions/1902500000000000001/copies', '/enterprise/api/v1/local/sessions'],
      ['/enterprise/api/v1/local/presets/1902500000000000001', '/enterprise/api/v1/local/presets'],
    ] as const) {
      const matched = engineRouteMatch(registered, pathname)
      expect(matched?.kind).toBe('prefix')
      expect(matched?.path).toBe(expected)
    }

    // exact 表优先：裸列表路径不会落到同串 prefix 上，sibling `/sessions/sync` 也不会被更短的 prefix 抢走。
    for (const pathname of [
      '/enterprise/api/v1/local/presets',
      '/enterprise/api/v1/local/sessions',
      '/enterprise/api/v1/local/sessions/sync',
    ]) {
      expect(engineRouteMatch(registered, pathname)?.kind).toBe('exact')
      expect(engineRouteMatch(registered, pathname)?.path).toBe(pathname)
    }

    // 边界反例：引擎要求边界处必须是 `/`，`/presetsXYZ` 不是 `/presets` 的子路径；
    // 旧测试里的「裸 startsWith」假匹配器会把这类无关路径喂进 handler。
    expect(engineRouteMatch(registered, '/enterprise/api/v1/local/presetsXYZ')).toBeUndefined()
    expect(engineRouteMatch(registered, '/enterprise/api/v1/local/sessionsXYZ/copies')).toBeUndefined()
  })

  it('counter-example: the legacy trailing-slash prefix is invisible to the engine for every sub-path', () => {
    const handler = (): void => {}
    const legacy: readonly RegisteredRoute[] = [
      { handler, kind: 'exact', path: '/enterprise/api/v1/local/branding' },
      { handler, kind: 'prefix', path: '/enterprise/api/v1/local/branding/asset/' },
      { handler, kind: 'exact', path: '/enterprise/api/v1/local/presets' },
      { handler, kind: 'prefix', path: '/enterprise/api/v1/local/presets/' },
      { handler, kind: 'exact', path: '/enterprise/api/v1/local/sessions' },
      { handler, kind: 'prefix', path: '/enterprise/api/v1/local/sessions/' },
    ]
    for (const pathname of [
      '/enterprise/api/v1/local/branding/asset/light',
      '/enterprise/api/v1/local/presets/1902500000000000001',
      '/enterprise/api/v1/local/sessions/1902500000000000001/copies',
    ]) {
      // 引擎层查不到路由 → `writeHead(404).end()` 的空体响应，handler 一次都不会被调用。
      expect(engineRouteMatch(legacy, pathname)).toBeUndefined()
    }
    // 旧形状唯一能进 handler 的入口是「恰好等于带尾斜杠的 prefix」本身，于是 slice 出空串 → 一律 400/404。
    expect(engineRouteMatch(legacy, '/enterprise/api/v1/local/presets/')?.path)
      .toBe('/enterprise/api/v1/local/presets/')
  })

  it('serves the three detail sub-paths that the trailing-slash prefix family dropped as empty-body 404', async () => {
    const { port: sessionSync, restore } = sessionSyncPort()
    const branding = { asset: vi.fn(async () => undefined), document: vi.fn(async () => null) }
    registerEnterpriseLocalApi(webServer, { branding, platform, pluginStatus, sessionSync })

    // ① 配方详情：GET /presets/<id>；裸 /presets 仍由 exact 列表路由回答。
    const preset = await fetch(`${baseUrl}/enterprise/api/v1/local/presets/1902500000000000001`)
    expect(preset.status).toBe(200)
    await expect(preset.json()).resolves.toEqual({ data: { displayName: '周报', id: '1', presetId: 'weekly' } })
    expect(platform.getPreset).toHaveBeenCalledWith('1902500000000000001')
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/presets`)).json()).resolves.toEqual({ data: [] })
    expect(platform.listPresets).toHaveBeenCalledOnce()

    // ② 远端会话恢复：POST /sessions/<id>/copies，id 必须从路径段切出来而不是被前缀整段吞掉。
    const restored = await fetch(`${baseUrl}/enterprise/api/v1/local/sessions/1902500000000000001/copies`, {
      body: JSON.stringify({ cwd: '/data/user/0/com.deepcode.shell/files/home' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(restored.status).toBe(200)
    await expect(restored.json()).resolves.toEqual({
      data: { restoredSessionId: 'restored-9', sourceSessionId: '1902500000000000001' },
    })
    expect(restore).toHaveBeenCalledWith('1902500000000000001', '/data/user/0/com.deepcode.shell/files/home')
    // sibling exact 路由不被新的更短 prefix 抢走。
    await expect((await fetch(`${baseUrl}/enterprise/api/v1/local/sessions/sync`)).json()).resolves.toEqual({
      data: { deviceId: 'device-1', enabled: true, lastError: null, pendingSessionIds: [] },
    })

    // ③ 品牌位图：GET /branding/asset/<slot>。真实字节由 branding.spec.ts 用真缓存端到端锁定，
    //    这里只锁「handler 被引擎放行」：stub 的 asset() 被调用即证明不再止步于引擎层空体 404。
    const asset = await fetch(`${baseUrl}/enterprise/api/v1/local/branding/asset/light?v=12`)
    expect(branding.asset).toHaveBeenCalledWith('light')
    expect(asset.status).toBe(404)
    await expect(asset.json()).resolves.toEqual({ error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
  })
})
