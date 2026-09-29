/**
 * [INPUT]: 依赖 node:http 自建真实监听实例、vitest、routes/guard 与 routes/index 的公开面
 * [OUTPUT]: 对外提供 guard 同源判定矩阵与本地端点行为断言（成功信封、fail-closed 拒绝、失败码收敛）
 * [POS]: 企业本地路由的裁判；用假 deps 注入 platform/usage/market，不触碰真实控制面与凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { EnterprisePlatformError } from '../src/protocol/envelope.js'
import type {
  EnterpriseBootstrapSnapshot,
  EnterprisePlatformStatus,
  EnterprisePluginAssignment,
} from '../src/protocol/types.js'
import { checkEnterpriseRequestOrigin, isLoopbackHostname } from '../src/routes/guard.js'
import {
  registerEnterpriseRoutes,
  type EnterpriseRouteDeps,
  type EnterpriseRouteHandlerContext,
  type EnterpriseRouteMarketEntry,
} from '../src/routes/index.js'

type RouteTable = Map<
  string,
  (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
>

// ── 假 deps：端口全部用 vi.fn() 记录调用，绝不接触真实网络/凭据 ───────────────

function makeAssignment(overrides: Partial<EnterprisePluginAssignment> = {}): EnterprisePluginAssignment {
  return {
    pluginVersionId: 'pv-1',
    packageName: '@example/tool',
    version: '1.2.3',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    signatureBase64: '',
    compatibility: {
      harnessCommits: ['b'.repeat(40)],
      enterpriseBundleRange: '^0.1.0',
      operatingSystems: ['darwin', 'linux', 'win32'],
    },
    downloadUrl: 'https://example.test/tool.tgz',
    required: false,
    desiredState: 'INSTALLED',
    ...overrides,
  }
}

const SIGNED_OUT: EnterprisePlatformStatus = {
  state: 'SIGNED_OUT',
  bundleVersion: '0.1.0',
  platformUrl: 'http://10.0.0.5:8080',
}

const READY: EnterprisePlatformStatus = {
  ...SIGNED_OUT,
  state: 'READY',
  user: { id: 'u-1', username: 'zhang', displayName: '张三', departmentId: null },
}

interface Harness {
  context: EnterpriseRouteHandlerContext
  deps: EnterpriseRouteDeps
  routes: RouteTable
}

function createHarness(marketInstallEnabled = true): Harness {
  const marketEntry: EnterpriseRouteMarketEntry = {
    assignment: makeAssignment(),
    installed: null,
    action: 'INSTALL',
  }
  const bootstrap: EnterpriseBootstrapSnapshot = {
    revision: 7,
    user: { id: 'u-1', username: 'zhang', displayName: '张三', departmentId: null },
    device: { id: 'd-1', installationId: 'i-1', status: 'ACTIVE' },
    models: [],
    quotas: [],
    plugins: { revision: 7, assignments: [makeAssignment()] },
    sessionPolicy: { enabled: false, retentionDays: 30, maxBatchBytes: 1024 },
  }
  const deps: EnterpriseRouteDeps = {
    platform: {
      status: vi.fn(() => SIGNED_OUT),
      bootstrap: vi.fn(() => bootstrap),
      setServerUrl: vi.fn(async (url: string) => ({ serverUrl: url })),
      startLogin: vi.fn(async () => ({ flowId: 'flow-1' })),
      refresh: vi.fn(async () => READY),
      logout: vi.fn(async () => undefined),
    },
    usage: {
      me: vi.fn(async () => [
        {
          policyId: 'p-1',
          name: '默认策略',
          scope: 'USER',
          resourceType: 'ALL_MODELS',
          resourceName: '全部模型',
          windows: [
            {
              key: 'fiveHours' as const,
              label: '5 小时',
              limit: 1000,
              usedTokens: 250,
              reservedTokens: 0,
              resetsAt: null,
              percent: 25,
              exhausted: false,
            },
          ],
        },
      ]),
    },
    market: {
      list: vi.fn(() => [marketEntry]),
      plan: vi.fn(async () => [marketEntry]),
      apply: vi.fn(async (packageName?: string) => ({ applied: [packageName ?? 'plan'] })),
      installEnabled: marketInstallEnabled,
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  const routes: RouteTable = new Map()
  const context: EnterpriseRouteHandlerContext = {
    webServer: {
      register: (route) => {
        routes.set(route.path, route.handler)
      },
    },
  }
  return { context, deps, routes }
}

// ── 真实 node:http 实例：完整跑通 Host/Origin/方法/请求体全链路 ──────────────

interface RawResult {
  status: number
  body: string
}

function createTestServer(routes: RouteTable): http.Server {
  return http.createServer((req, res) => {
    const handler = routes.get(new URL(req.url ?? '/', 'http://127.0.0.1').pathname)
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'ENT_RESOURCE_NOT_FOUND' }))
      return
    }
    void Promise.resolve(handler(req, res)).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500)
        res.end()
      }
    })
  })
}

function listen(server: http.Server): Promise<number> {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address !== null ? address.port : 0)
    })
  })
}

function close(server: http.Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
}

/** 直连 node:http，`setHost: false` 保证 Host 头完全由测试控制（同源判定必须可控）。 */
function requestOn(
  targetPort: number,
  options: {
    method: 'GET' | 'POST'
    path: string
    headers?: Record<string, string>
    body?: string
  },
): Promise<RawResult> {
  return new Promise<RawResult>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: targetPort,
        method: options.method,
        path: options.path,
        headers: options.headers ?? {},
        setHost: false,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on('error', reject)
    if (options.body !== undefined) req.write(options.body)
    req.end()
  })
}

let server: http.Server
let port = 0
let harness: Harness

/** 本机同源请求头：Host 与 Origin 都指向当前监听端口。 */
function localHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, ...extra }
}

beforeAll(async () => {
  harness = createHarness(true)
  registerEnterpriseRoutes(harness.context, harness.deps)
  server = createTestServer(harness.routes)
  port = await listen(server)
})

afterAll(async () => {
  await close(server)
})

describe('guard：同源判定矩阵', () => {
  const post = (headers: Record<string, string | string[] | undefined>) =>
    checkEnterpriseRequestOrigin({ method: 'POST', headers })
  const get = (headers: Record<string, string | string[] | undefined>) =>
    checkEnterpriseRequestOrigin({ method: 'GET', headers })

  it('回环 Host + 回环 Origin：放行', () => {
    expect(post({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' })).toEqual({ allowed: true })
    expect(post({ host: 'localhost:3080', origin: 'http://localhost:3080' })).toEqual({ allowed: true })
    expect(post({ host: '[::1]:3080', origin: 'http://[::1]:3080' })).toEqual({ allowed: true })
    expect(post({ host: '::1', origin: 'http://[::1]' })).toEqual({ allowed: true })
    expect(post({ host: '127.0.0.2:3080', origin: 'http://127.0.0.2:3080' })).toEqual({ allowed: true })
  })

  it('非回环但 Origin 与 Host 完全一致：放行（局域网部署）', () => {
    expect(post({ host: '192.168.1.50:3080', origin: 'http://192.168.1.50:3080' })).toEqual({
      allowed: true,
    })
    expect(post({ host: 'dsh.corp.test:8443', origin: 'https://dsh.corp.test:8443' })).toEqual({
      allowed: true,
    })
  })

  it('跨站 Origin：拒绝', () => {
    expect(post({ host: '127.0.0.1:3080', origin: 'http://evil.test' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_CROSS_SITE',
    })
    expect(get({ host: '127.0.0.1:3080', origin: 'http://evil.test' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_CROSS_SITE',
    })
    expect(post({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1.evil.test:3080' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_CROSS_SITE',
    })
  })

  it('回环来源按契约整体受信：回环跨端口仍放行（本机无信任边界）', () => {
    expect(post({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:5173' })).toEqual({ allowed: true })
    expect(post({ host: '127.0.0.1:3080', origin: 'http://localhost:5173' })).toEqual({ allowed: true })
  })

  it('写动作缺 Origin：拒绝（fail-closed）', () => {
    expect(post({ host: '127.0.0.1:3080' })).toEqual({ allowed: false, reason: 'ORIGIN_MISSING' })
    expect(post({ host: '192.168.1.50:3080' })).toEqual({ allowed: false, reason: 'ORIGIN_MISSING' })
  })

  it('Origin: null：拒绝（opaque 来源）', () => {
    expect(post({ host: '127.0.0.1:3080', origin: 'null' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_NULL',
    })
    expect(get({ host: '127.0.0.1:3080', origin: 'null' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_NULL',
    })
  })

  it('GET 缺 Origin：只有回环 Host 放行', () => {
    expect(get({ host: '127.0.0.1:3080' })).toEqual({ allowed: true })
    expect(get({ host: 'localhost' })).toEqual({ allowed: true })
    expect(get({ host: '192.168.1.50:3080' })).toEqual({ allowed: false, reason: 'ORIGIN_MISSING' })
  })

  it('Host 缺失/可疑/重复：拒绝', () => {
    expect(post({ origin: 'http://127.0.0.1:3080' })).toEqual({ allowed: false, reason: 'HOST_MISSING' })
    expect(get({ host: '   ' })).toEqual({ allowed: false, reason: 'HOST_MISSING' })
    expect(get({ host: '127.0.0.1:3080.evil.test' })).toEqual({ allowed: false, reason: 'HOST_INVALID' })
    expect(get({ host: 'user@127.0.0.1:3080' })).toEqual({ allowed: false, reason: 'HOST_INVALID' })
    expect(get({ host: '127.0.0.1:99999' })).toEqual({ allowed: false, reason: 'HOST_INVALID' })
    expect(get({ host: ['127.0.0.1:3080', 'evil.test'] })).toEqual({
      allowed: false,
      reason: 'HOST_INVALID',
    })
  })

  it('Origin 重复/非法：拒绝', () => {
    const host = '127.0.0.1:3080'
    expect(get({ host, origin: ['http://127.0.0.1:3080', 'http://evil.test'] })).toEqual({
      allowed: false,
      reason: 'ORIGIN_MULTIPLE',
    })
    expect(get({ host, origin: 'http://127.0.0.1:3080/../x' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_INVALID',
    })
    expect(get({ host, origin: 'file:///tmp/x' })).toEqual({ allowed: false, reason: 'ORIGIN_INVALID' })
    expect(get({ host, origin: 'http://user@127.0.0.1:3080' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_INVALID',
    })
    expect(get({ host, origin: 'not a url' })).toEqual({ allowed: false, reason: 'ORIGIN_INVALID' })
  })

  it('默认端口归一化：80/443 与省略端口等价', () => {
    expect(post({ host: 'dsh.corp.test:80', origin: 'http://dsh.corp.test' })).toEqual({ allowed: true })
    expect(post({ host: 'dsh.corp.test:443', origin: 'https://dsh.corp.test' })).toEqual({ allowed: true })
    expect(post({ host: 'dsh.corp.test', origin: 'http://dsh.corp.test:8080' })).toEqual({
      allowed: false,
      reason: 'ORIGIN_CROSS_SITE',
    })
  })

  it('isLoopbackHostname 只认字面量回环，绝不解析 DNS', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('127.255.255.254')).toBe(true)
    expect(isLoopbackHostname('localhost.')).toBe(true)
    expect(isLoopbackHostname('0.0.0.0')).toBe(false)
    expect(isLoopbackHostname('128.0.0.1')).toBe(false)
    expect(isLoopbackHostname('localhost.evil.test')).toBe(false)
    expect(isLoopbackHostname('::2')).toBe(false)
  })
})

describe('routes：信封、鉴权与失败收敛', () => {
  it('GET /status：同源返回成功信封', async () => {
    const result = await requestOn(port, {
      method: 'GET',
      path: '/api/dshent/enterprise/status',
      headers: { Host: `127.0.0.1:${port}` },
    })
    expect(result.status).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ success: true, data: SIGNED_OUT })
  })

  it('GET /status 跨站 Origin：403 且不泄露内部信息', async () => {
    const result = await requestOn(port, {
      method: 'GET',
      path: '/api/dshent/enterprise/status',
      headers: { Host: `127.0.0.1:${port}`, Origin: 'http://evil.test' },
    })
    expect(result.status).toBe(403)
    expect(JSON.parse(result.body)).toEqual({ success: false, error: 'ENT_PERMISSION_DENIED' })
    expect(result.body).not.toContain('ORIGIN_CROSS_SITE')
    expect(harness.deps.logger.warn).toHaveBeenCalled()
  })

  it('POST /server-url：同源带 Origin 成功并回传最新状态', async () => {
    const result = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/server-url',
      headers: localHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ serverUrl: 'http://10.0.0.9:8080' }),
    })
    expect(result.status).toBe(200)
    expect(harness.deps.platform.setServerUrl).toHaveBeenCalledWith('http://10.0.0.9:8080')
    expect(JSON.parse(result.body)).toEqual({
      success: true,
      data: { serverUrl: 'http://10.0.0.9:8080', status: SIGNED_OUT },
    })
  })

  it('POST /server-url 缺 Origin：403 且未触达业务层', async () => {
    const before = vi.mocked(harness.deps.platform.setServerUrl).mock.calls.length
    const result = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/server-url',
      headers: { Host: `127.0.0.1:${port}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverUrl: 'http://10.0.0.9:8080' }),
    })
    expect(result.status).toBe(403)
    expect(JSON.parse(result.body).error).toBe('ENT_PERMISSION_DENIED')
    expect(vi.mocked(harness.deps.platform.setServerUrl).mock.calls.length).toBe(before)
  })

  it('POST /server-url Origin: null：403', async () => {
    const result = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/server-url',
      headers: { Host: `127.0.0.1:${port}`, Origin: 'null' },
      body: JSON.stringify({ serverUrl: 'http://10.0.0.9:8080' }),
    })
    expect(result.status).toBe(403)
  })

  it('方法不匹配：405 且码为 ENT_INVALID_REQUEST', async () => {
    const result = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/status',
      headers: localHeaders(),
      body: '{}',
    })
    expect(result.status).toBe(405)
    expect(JSON.parse(result.body)).toEqual({ success: false, error: 'ENT_INVALID_REQUEST' })
  })

  it('请求体非法/字段缺失：400 ENT_INVALID_REQUEST', async () => {
    const notJson = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/server-url',
      headers: localHeaders(),
      body: '{oops',
    })
    expect(notJson.status).toBe(400)
    expect(JSON.parse(notJson.body).error).toBe('ENT_INVALID_REQUEST')

    const blank = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/server-url',
      headers: localHeaders(),
      body: JSON.stringify({ serverUrl: '   ' }),
    })
    expect(blank.status).toBe(400)
    expect(JSON.parse(blank.body).error).toBe('ENT_INVALID_REQUEST')
  })

  it('业务层抛 EnterprisePlatformError：保留稳定码，不回传原始 message', async () => {
    vi.mocked(harness.deps.platform.setServerUrl).mockRejectedValueOnce(
      new EnterprisePlatformError('ENT_SERVER_URL_INVALID', '地址不合法'),
    )
    const result = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/server-url',
      headers: localHeaders(),
      body: JSON.stringify({ serverUrl: 'ftp://x' }),
    })
    expect(result.status).toBe(400)
    expect(JSON.parse(result.body)).toEqual({ success: false, error: 'ENT_SERVER_URL_INVALID' })
    expect(result.body).not.toContain('地址不合法')
  })

  it('业务层抛未知异常：折叠为 ENT_NETWORK_ERROR', async () => {
    vi.mocked(harness.deps.platform.refresh).mockRejectedValueOnce(new Error('socket 里的秘密'))
    const result = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/refresh',
      headers: localHeaders(),
      body: '{}',
    })
    expect(result.status).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ success: false, error: 'ENT_NETWORK_ERROR' })
    expect(result.body).not.toContain('socket 里的秘密')
  })

  it('GET /usage：返回配额窗口视图', async () => {
    const result = await requestOn(port, {
      method: 'GET',
      path: '/api/dshent/enterprise/usage',
      headers: { Host: `127.0.0.1:${port}` },
    })
    expect(result.status).toBe(200)
    const parsed = JSON.parse(result.body) as {
      success: boolean
      data: { windows: { key: string; percent: number | null }[] }[]
    }
    expect(parsed.success).toBe(true)
    expect(parsed.data[0]?.windows).toHaveLength(1)
    expect(parsed.data[0]?.windows[0]?.key).toBe('fiveHours')
  })

  it('GET /bootstrap：返回脱敏快照', async () => {
    const result = await requestOn(port, {
      method: 'GET',
      path: '/api/dshent/enterprise/bootstrap',
      headers: { Host: `127.0.0.1:${port}` },
    })
    const parsed = JSON.parse(result.body) as { success: boolean; data: { revision: number } }
    expect(parsed.success).toBe(true)
    expect(parsed.data.revision).toBe(7)
  })

  it('GET /market：plan 失败时降级 list，并给出安装开关', async () => {
    vi.mocked(harness.deps.market.plan).mockRejectedValueOnce(new Error('offline'))
    const result = await requestOn(port, {
      method: 'GET',
      path: '/api/dshent/enterprise/market',
      headers: { Host: `127.0.0.1:${port}` },
    })
    expect(result.status).toBe(200)
    const parsed = JSON.parse(result.body) as {
      success: boolean
      data: { entries: EnterpriseRouteMarketEntry[]; marketInstallEnabled: boolean }
    }
    expect(parsed.data.marketInstallEnabled).toBe(true)
    expect(parsed.data.entries).toHaveLength(1)
    expect(parsed.data.entries[0]?.action).toBe('INSTALL')
    expect(parsed.data.entries[0]?.blockedReason).toBeUndefined()
  })

  it('POST /market/apply：透传包名', async () => {
    const applied = await requestOn(port, {
      method: 'POST',
      path: '/api/dshent/enterprise/market/apply',
      headers: localHeaders(),
      body: JSON.stringify({ packageName: '@example/tool' }),
    })
    expect(applied.status).toBe(200)
    expect(harness.deps.market.apply).toHaveBeenCalledWith('@example/tool')
  })

  it('marketInstallEnabled=false：GET 呈现只读，POST 403 且不触达 apply', async () => {
    const disabled = createHarness(false)
    registerEnterpriseRoutes(disabled.context, disabled.deps)
    const disabledServer = createTestServer(disabled.routes)
    const disabledPort = await listen(disabledServer)
    try {
      const readOnly = await requestOn(disabledPort, {
        method: 'GET',
        path: '/api/dshent/enterprise/market',
        headers: { Host: `127.0.0.1:${disabledPort}` },
      })
      const parsed = JSON.parse(readOnly.body) as { data: { marketInstallEnabled: boolean } }
      expect(parsed.data.marketInstallEnabled).toBe(false)

      const blocked = await requestOn(disabledPort, {
        method: 'POST',
        path: '/api/dshent/enterprise/market/apply',
        headers: {
          Host: `127.0.0.1:${disabledPort}`,
          Origin: `http://127.0.0.1:${disabledPort}`,
        },
        body: '{}',
      })
      expect(blocked.status).toBe(403)
      expect(JSON.parse(blocked.body).error).toBe('ENT_PERMISSION_DENIED')
      expect(disabled.deps.market.apply).not.toHaveBeenCalled()
    } finally {
      await close(disabledServer)
    }
  })
})
