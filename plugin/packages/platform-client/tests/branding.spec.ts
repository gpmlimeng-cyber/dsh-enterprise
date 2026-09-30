/**
 * [INPUT]: 依赖 platform-client 的品牌缓存/解析器与本地 API 注册器，以及 Node 原生 HTTP server/fetch 与真实临时目录
 * [OUTPUT]: 验证「接口缺失/未配置/离线/超时/缓存损坏 → 没有企业品牌可回落」、revision 去重与磁盘副本复用、`string | { url }` 双形 LOGO 槽位（含旧缓存同 revision 自愈）、位图 MIME/尺寸/同源三道资源门禁，以及本地只读品牌路由契约
 * [POS]: platform-client 的品牌数据边界回归测试，锁定取数、缓存与降级语义，并保证品牌故障不影响任何既有本地路由
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRANDING_ASSET_LOCAL_PATH,
  BRANDING_LOCAL_PATH,
  BRANDING_MAX_ASSET_BYTES,
  EnterpriseBrandingCache,
  parseEnterpriseBranding,
  registerEnterpriseLocalApi,
  type EnterpriseLocalPlatformPort,
  type EnterprisePlatformStatus,
  type WebServerRoutePort,
} from '../src/index.js'

const LATEST_REVISION = 13
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')

interface EnterpriseStub {
  branding: unknown
  brandingStatus: number
  readonly assets: Map<string, { readonly contentType: string, readonly body: Buffer }>
  readonly requests: string[]
}

const platformStatus: EnterprisePlatformStatus = {
  bundleVersion: '0.1.0',
  platformUrl: 'https://enterprise.example.com',
  state: 'SIGNED_OUT',
  transport: 'webServer.register',
}

function platformPort(): EnterpriseLocalPlatformPort {
  return {
    bootstrap: () => undefined,
    cancelLogin: () => true,
    getPreset: async () => ({}),
    listPresets: async () => [],
    logout: async () => undefined,
    refresh: async () => structuredClone(platformStatus),
    setServerUrl: async serverUrl => ({ serverUrl }),
    startLogin: async () => ({ flowId: 'flow-1' }),
    status: () => structuredClone(platformStatus),
  }
}

/** 真实 HTTP：请求路径即证据，取数与资源下载都走这条线。 */
function startServer(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<{ server: Server, origin: string }> {
  const server = createServer(handler)
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('missing test port')
      resolve({ origin: `http://127.0.0.1:${address.port}`, server })
    })
  })
}

function stopServer(server: Server): Promise<void> {
  server.closeAllConnections()
  return new Promise(resolve => server.close(() => resolve()))
}

describe('enterprise branding cache', () => {
  let server: Server
  let origin: string
  let stub: EnterpriseStub
  let dshHome: string
  let requests: string[]
  let fetchImpl: (input: URL, init: RequestInit) => Promise<Response>

  beforeEach(async () => {
    dshHome = await mkdtemp(join(tmpdir(), 'dshent-branding-'))
    requests = []
    stub = {
      assets: new Map([['/assets/light-12.png', { body: PNG, contentType: 'image/png' }]]),
      branding: {
        logo: { dark: null, light: '/assets/light-12.png', square: '/assets/square-12.png' },
        name: '未命名',
        revision: 12,
        shortName: '未命名',
        updatedAt: '2026-09-30T02:00:00Z',
        welcome: { editionLabel: '预览版', headline: '探索未至之境' },
      },
      brandingStatus: 200,
      requests: [],
    }
    const started = await startServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      stub.requests.push(path)
      if (path === '/enterprise/api/v1/branding') {
        response.writeHead(stub.brandingStatus, { 'content-type': 'application/json' })
        response.end(JSON.stringify(stub.branding))
        return
      }
      const asset = stub.assets.get(path)
      if (asset === undefined) return void response.writeHead(404).end()
      response.writeHead(200, { 'content-type': asset.contentType })
      response.end(asset.body)
    })
    server = started.server
    origin = started.origin
    fetchImpl = async (input, init) => {
      requests.push(input.toString())
      return await fetch(input, init)
    }
  })

  afterEach(async () => {
    await stopServer(server)
    await rm(dshHome, { force: true, recursive: true })
  })

  const makeCache = (overrides: {
    readonly fetch?: (input: URL, init: RequestInit) => Promise<Response>
    readonly home?: string
    readonly serverUrl?: () => URL | undefined
    readonly timeoutMs?: number
  } = {}): EnterpriseBrandingCache => new EnterpriseBrandingCache({
    dshHome: overrides.home ?? dshHome,
    fetch: overrides.fetch ?? fetchImpl,
    serverUrl: overrides.serverUrl ?? (() => new URL(origin)),
    ...(overrides.timeoutMs === undefined ? {} : { timeoutMs: overrides.timeoutMs }),
  })

  it('treats a missing endpoint as no branding at all', async () => {
    stub.brandingStatus = 404
    const cache = makeCache()
    await expect(cache.refresh()).resolves.toBeUndefined()
    await expect(cache.document()).resolves.toBeNull()
    await expect(cache.asset('light')).resolves.toBeUndefined()
  })

  it('never touches the network while no Server is configured', async () => {
    const fetchSpy = vi.fn(fetchImpl)
    const cache = makeCache({ fetch: fetchSpy, serverUrl: () => undefined })
    await expect(cache.refresh()).resolves.toBeUndefined()
    await expect(cache.document()).resolves.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('parses the bare contract and the data envelope, ignoring unknown fields', () => {
    const parsed = parseEnterpriseBranding({ data: { ...stub.branding as object, accentColor: '#123456' } })
    expect(parsed?.name).toBe('未命名')
    expect(parsed?.welcome.headline).toBe('探索未至之境')
    expect(parseEnterpriseBranding({ revision: 'twelve' })).toBeUndefined()
    expect(parseEnterpriseBranding(null)).toBeUndefined()
  })

  it('accepts both logo slot shapes and drops malformed ones field by field', () => {
    // 契约真源是 { url, sha256, … } 对象；B2 之前线上也可能给裸字符串，两种都要认。
    const parsed = parseEnterpriseBranding({
      logo: {
        dark: { extra: { nested: true }, sha256: 'a'.repeat(64), sizeBytes: 1024, url: 'https://cdn.example.com/dark.png' },
        light: ' /assets/light.png ',
        square: { url: 42 },
      },
      revision: 7,
    })
    expect(parsed?.logo).toEqual({
      dark: 'https://cdn.example.com/dark.png',
      light: '/assets/light.png',
      square: null,
    })
    const rejected = [
      { light: {} },
      { light: { url: '' } },
      { light: { url: '   ' } },
      { light: { url: 42 } },
      { light: { url: null } },
      { light: { url: { url: '/assets/light.png' } } },
      { light: ['/assets/light.png'] },
      { light: { url: '\u0000bad' } },
      { light: { url: `/${'x'.repeat(2048)}` } },
    ]
    for (const logo of rejected) {
      expect(parseEnterpriseBranding({ logo, revision: 7 })?.logo.light, JSON.stringify(logo)).toBeNull()
    }
    expect(parseEnterpriseBranding({ logo: ['/assets/light.png'], revision: 7 })?.logo.light).toBeNull()
  })

  it('downloads object-form logo slots into local bitmap copies and stores only plain references', async () => {
    stub.branding = {
      data: {
        logo: {
          dark: { contentType: 'image/png', height: 64, sha256: 'd'.repeat(64), sizeBytes: PNG.byteLength, url: '/assets/dark-12.png', width: 64 },
          light: { url: '/assets/light-12.png' },
          square: {},
        },
        name: 'DeepSeek Harness',
        revision: 12,
        shortName: 'DSH 企业版',
        updatedAt: '2026-09-30T02:00:00Z',
        welcome: { editionLabel: '企业版', headline: '共赴未至之境' },
      },
    }
    stub.assets.set('/assets/dark-12.png', { body: PNG, contentType: 'image/png' })
    const cache = makeCache()
    await cache.refresh()
    await expect(cache.document()).resolves.toEqual({
      logo: {
        dark: `${BRANDING_ASSET_LOCAL_PATH}/dark?v=12`,
        light: `${BRANDING_ASSET_LOCAL_PATH}/light?v=12`,
        square: null,
      },
      name: 'DeepSeek Harness',
      revision: 12,
      shortName: 'DSH 企业版',
      updatedAt: '2026-09-30T02:00:00Z',
      welcome: { editionLabel: '企业版', headline: '共赴未至之境' },
    })
    await expect(cache.asset('light')).resolves.toEqual({ contentType: 'image/png', bytes: PNG })
    await expect(cache.asset('dark')).resolves.toEqual({ contentType: 'image/png', bytes: PNG })
    await expect(cache.asset('square')).resolves.toBeUndefined()
    // 落盘的是解析后的字符串引用，绝不把远端对象原样写进缓存。
    const cached = JSON.parse(await readFile(join(dshHome, 'enterprise', 'branding.json'), 'utf8')) as {
      readonly assets: unknown, readonly logo: unknown,
    }
    expect(cached.logo).toEqual({ dark: '/assets/dark-12.png', light: '/assets/light-12.png', square: null })
    expect(cached.assets).toEqual({ dark: { contentType: 'image/png', file: 'dark-12.png' }, light: { contentType: 'image/png', file: 'light-12.png' } })
  })

  it('applies the bitmap, size and origin gates to object-form logo slots too', async () => {
    const objectLight = (url: string): object => ({ url })
    stub.branding = {
      ...stub.branding as object,
      logo: { dark: null, light: objectLight('/assets/light-12.png'), square: null },
    }
    stub.assets.set('/assets/light-12.png', { body: Buffer.from('<svg onload="alert(1)"/>'), contentType: 'image/svg+xml' })
    const svg = makeCache()
    await svg.refresh()
    await expect(svg.document()).resolves.toMatchObject({ logo: { light: null } })
    await expect(svg.asset('light')).resolves.toBeUndefined()

    stub.assets.set('/assets/light-12.png', { body: Buffer.alloc(BRANDING_MAX_ASSET_BYTES + 1), contentType: 'image/png' })
    const oversized = makeCache()
    await oversized.refresh()
    await expect(oversized.document()).resolves.toMatchObject({ logo: { light: null } })
    await expect(readdir(join(dshHome, 'enterprise', 'branding')).catch(() => [] as string[])).resolves.toEqual([])

    stub.branding = {
      ...stub.branding as object,
      logo: { dark: null, light: objectLight('http://127.0.0.1:9/logo.png'), square: null },
    }
    const foreign = makeCache()
    await foreign.refresh()
    await expect(foreign.document()).resolves.toMatchObject({ logo: { light: null } })
    expect(requests.some(url => url.includes(':9/'))).toBe(false)
  })

  it('drops malformed logo slots without corrupting a document that has none of them', async () => {
    stub.branding = {
      ...stub.branding as object,
      logo: { dark: [1], light: {}, square: { url: 42 } },
    }
    const cache = makeCache()
    await cache.refresh()
    await expect(cache.document()).resolves.toMatchObject({ logo: { dark: null, light: null, square: null } })
    expect(stub.requests.filter(path => path.includes('assets'))).toEqual([])
    const cached = JSON.parse(await readFile(join(dshHome, 'enterprise', 'branding.json'), 'utf8')) as {
      readonly assets: unknown, readonly logo: unknown,
    }
    expect(cached.logo).toEqual({ dark: null, light: null, square: null })
    expect(cached.assets).toEqual({})
    // 缓存仍然可用：冷启动离线也能读出同一份文档。
    await expect(makeCache({ serverUrl: () => undefined }).document()).resolves.toMatchObject({
      logo: { light: null }, revision: 12,
    })
  })

  it('repairs a stale cache that lost object-form logos at the same revision', async () => {
    // 旧版 Host 的现场：对象形 LOGO 被解析成 null、assets 为空，而 revision 与线上一致。
    await mkdir(join(dshHome, 'enterprise'), { recursive: true })
    await writeFile(join(dshHome, 'enterprise', 'branding.json'), JSON.stringify({
      assets: {},
      logo: { dark: null, light: null, square: null },
      name: '未命名',
      revision: 12,
      shortName: '未命名',
      updatedAt: '2026-09-30T02:00:00Z',
      welcome: { editionLabel: '预览版', headline: '探索未至之境' },
    }))
    stub.branding = {
      ...stub.branding as object,
      logo: { dark: null, light: { url: '/assets/light-12.png' }, square: null },
    }
    const cache = makeCache()
    await cache.refresh()
    await expect(cache.document()).resolves.toMatchObject({
      logo: { dark: null, light: `${BRANDING_ASSET_LOCAL_PATH}/light?v=12`, square: null },
      name: '未命名',
      revision: 12,
    })
    await expect(cache.asset('light')).resolves.toEqual({ contentType: 'image/png', bytes: PNG })
    await expect(readdir(join(dshHome, 'enterprise', 'branding'))).resolves.toEqual(['light-12.png'])
  })

  it('caches the document and its bitmap copies, and serves them again offline', async () => {
    const cache = makeCache()
    await cache.refresh()
    await expect(cache.document()).resolves.toEqual({
      logo: { dark: null, light: `${BRANDING_ASSET_LOCAL_PATH}/light?v=12`, square: null },
      name: '未命名',
      revision: 12,
      shortName: '未命名',
      updatedAt: '2026-09-30T02:00:00Z',
      welcome: { editionLabel: '预览版', headline: '探索未至之境' },
    })
    await expect(cache.asset('light')).resolves.toEqual({ contentType: 'image/png', bytes: PNG })
    // square 声明的资源在服务端不存在：只丢这一个槽位，整份品牌照常可用。
    await expect(cache.asset('square')).resolves.toBeUndefined()

    const offlineFetch = vi.fn(async () => { throw new Error('offline') })
    const restored = makeCache({ fetch: offlineFetch, serverUrl: () => undefined })
    await expect(restored.document()).resolves.toMatchObject({ name: '未命名' })
    await expect(restored.asset('light')).resolves.toEqual({ contentType: 'image/png', bytes: PNG })
    expect(offlineFetch).not.toHaveBeenCalled()
  })

  it('only republishes a different revision, and then re-downloads the bitmaps', async () => {
    const cache = makeCache()
    await cache.refresh()
    expect(stub.requests.filter(path => path.includes('light'))).toHaveLength(1)

    stub.branding = { ...stub.branding as object, name: 'ACME 云', revision: 12 }
    await cache.refresh()
    await expect(cache.document()).resolves.toMatchObject({ name: '未命名' })
    expect(stub.requests.filter(path => path.includes('light'))).toHaveLength(1)

    stub.assets.set(`/${LATEST_REVISION}-light.png`, { body: PNG, contentType: 'image/png' })
    stub.branding = {
      logo: { dark: null, light: `/${LATEST_REVISION}-light.png`, square: null },
      name: 'ACME 云',
      revision: LATEST_REVISION,
      shortName: 'ACME',
      updatedAt: '2026-09-30T03:00:00Z',
      welcome: { editionLabel: '正式版', headline: '探索未至之境' },
    }
    await cache.refresh()
    await expect(cache.document()).resolves.toMatchObject({
      logo: { light: `${BRANDING_ASSET_LOCAL_PATH}/light?v=${LATEST_REVISION}` },
      name: 'ACME 云',
      revision: LATEST_REVISION,
    })
    expect(stub.requests.filter(path => path.includes('light'))).toHaveLength(2)
    // 旧 revision 的副本没有读者，随新文档一起清掉，缓存目录不无界增长。
    await expect(readdir(join(dshHome, 'enterprise', 'branding'))).resolves.toEqual([`light-${LATEST_REVISION}.png`])
  })

  it('resolves a timeout without throwing and keeps the previous brand', async () => {
    const seeded = makeCache()
    await seeded.refresh()
    const hanging = (_input: URL, init: RequestInit): Promise<Response> => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
    const timedOut = makeCache({ fetch: hanging, timeoutMs: 30 })
    const started = Date.now()
    await expect(timedOut.refresh()).resolves.toBeUndefined()
    expect(Date.now() - started).toBeLessThan(2_000)
    // 超时实例照样读得到本机缓存，且没有 reject 泄漏。
    await expect(timedOut.document()).resolves.toMatchObject({ name: '未命名' })
    await expect(timedOut.asset('light')).resolves.toEqual({ contentType: 'image/png', bytes: PNG })
    // 已有品牌的实例遇到超时也只保留旧品牌，不抛错。
    await timedOut.refresh()
    await expect(timedOut.document()).resolves.toMatchObject({ name: '未命名' })
  })

  it('rejects a non-bitmap asset and an oversized asset without losing the document', async () => {
    stub.assets.set('/assets/light-12.png', { body: Buffer.from('<svg onload="alert(1)"/>'), contentType: 'image/svg+xml' })
    const cache = makeCache()
    await cache.refresh()
    await expect(cache.document()).resolves.toMatchObject({ logo: { light: null } })
    await expect(cache.asset('light')).resolves.toBeUndefined()

    stub.assets.set('/assets/light-12.png', { body: Buffer.alloc(512 * 1024 + 1), contentType: 'image/png' })
    const oversized = makeCache()
    await oversized.refresh()
    await expect(oversized.document()).resolves.toMatchObject({ logo: { light: null } })
    await expect(oversized.asset('light')).resolves.toBeUndefined()
    // 被拒绝的资源不落盘；一个都没写成功时连副本目录都不会建出来。
    await expect(readdir(join(dshHome, 'enterprise', 'branding')).catch(() => [] as string[])).resolves.toEqual([])
  })

  it('refuses to pull a logo from outside the platform origin', async () => {
    stub.branding = {
      ...stub.branding as object,
      logo: { dark: null, light: 'http://127.0.0.1:9/logo.png', square: null },
    }
    const cache = makeCache()
    await cache.refresh()
    await expect(cache.document()).resolves.toMatchObject({ logo: { light: null } })
    expect(requests.some(url => url.includes(':9/'))).toBe(false)
  })

  it('survives a corrupt cache file instead of failing the browser read', async () => {
    const cached = makeCache()
    await cached.refresh()
    await writeFile(join(dshHome, 'enterprise', 'branding.json'), '{ not json')
    const corrupted = makeCache()
    await expect(corrupted.document()).resolves.toBeNull()
    await expect(corrupted.asset('light')).resolves.toBeUndefined()
  })
})

describe('enterprise branding local routes', () => {
  let server: Server
  let origin: string
  let routes: Map<string, Parameters<WebServerRoutePort['register']>[0]>
  let webServer: WebServerRoutePort
  let dshHome: string

  beforeEach(async () => {
    routes = new Map()
    dshHome = await mkdtemp(join(tmpdir(), 'dshent-branding-routes-'))
    webServer = {
      register: (route) => {
        const key = `${route.kind}:${route.path}`
        if (routes.has(key)) throw new Error(`duplicate route ${key}`)
        routes.set(key, route)
        return () => { routes.delete(key) }
      },
    }
    const started = await startServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      const route = routes.get(`exact:${path}`) ?? [...routes.values()].find(candidate => (
        candidate.kind === 'prefix' && (path === candidate.path || path.startsWith(candidate.path))
      ))
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(request, response))
    })
    server = started.server
    origin = started.origin
  })

  afterEach(async () => {
    await stopServer(server)
    await rm(dshHome, { force: true, recursive: true })
  })

  /** 直接落一份缓存文件，避免路由测试再搭一台企业 server。 */
  const seededCache = async (): Promise<EnterpriseBrandingCache> => {
    await mkdir(join(dshHome, 'enterprise', 'branding'), { recursive: true })
    await writeFile(join(dshHome, 'enterprise', 'branding', 'light-12.png'), PNG)
    await writeFile(join(dshHome, 'enterprise', 'branding.json'), JSON.stringify({
      assets: { light: { contentType: 'image/png', file: 'light-12.png' } },
      logo: { dark: null, light: 'https://enterprise.example.com/light.png', square: null },
      name: 'ACME 云',
      revision: 12,
      shortName: 'ACME',
      updatedAt: '2026-09-30T02:00:00Z',
      welcome: { editionLabel: '预览版', headline: '探索未至之境' },
    }))
    return new EnterpriseBrandingCache({
      dshHome,
      fetch: async () => { throw new Error('unexpected fetch') },
      serverUrl: () => undefined,
    })
  }

  const emptyCache = (): EnterpriseBrandingCache => new EnterpriseBrandingCache({
    dshHome,
    fetch: async () => { throw new Error('unexpected fetch') },
    serverUrl: () => undefined,
  })

  it('serves the cached brand document and its bitmap copy over the local origin', async () => {
    registerEnterpriseLocalApi(webServer, { branding: await seededCache(), platform: platformPort(), pluginStatus: () => ({}) })

    const document = await fetch(`${origin}${BRANDING_LOCAL_PATH}`)
    expect(document.headers.get('cache-control')).toBe('no-store')
    expect(document.headers.get('access-control-allow-origin')).toBeNull()
    await expect(document.json()).resolves.toEqual({
      data: {
        logo: { dark: null, light: `${BRANDING_ASSET_LOCAL_PATH}/light?v=12`, square: null },
        name: 'ACME 云',
        revision: 12,
        shortName: 'ACME',
        updatedAt: '2026-09-30T02:00:00Z',
        welcome: { editionLabel: '预览版', headline: '探索未至之境' },
      },
    })

    const asset = await fetch(`${origin}${BRANDING_ASSET_LOCAL_PATH}/light?v=12`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('content-type')).toBe('image/png')
    expect(asset.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await asset.arrayBuffer())).toEqual(PNG)
    expect((await fetch(`${origin}${BRANDING_ASSET_LOCAL_PATH}/dark?v=12`)).status).toBe(404)
    expect((await fetch(`${origin}${BRANDING_ASSET_LOCAL_PATH}/evil?v=12`)).status).toBe(404)
    expect((await fetch(`${origin}${BRANDING_LOCAL_PATH}`, { method: 'POST' })).status).toBe(405)
    expect((await fetch(`${origin}${BRANDING_ASSET_LOCAL_PATH}/light`, { method: 'POST' })).status).toBe(405)
    // 未登录也一样读得到：品牌读取从不依赖会话状态。
    expect(routes.has(`exact:${BRANDING_LOCAL_PATH}`)).toBe(true)
  })

  it('answers an empty profile with an explicit null, and registers nothing without the port', async () => {
    const dispose = registerEnterpriseLocalApi(webServer, { branding: emptyCache(), platform: platformPort(), pluginStatus: () => ({}) })
    await expect((await fetch(`${origin}${BRANDING_LOCAL_PATH}`)).json()).resolves.toEqual({ data: null })
    dispose()
    registerEnterpriseLocalApi(webServer, { platform: platformPort(), pluginStatus: () => ({}) })
    expect(routes.has(`exact:${BRANDING_LOCAL_PATH}`)).toBe(false)
    expect(routes.has(`prefix:${BRANDING_ASSET_LOCAL_PATH}/`)).toBe(false)
  })
})
