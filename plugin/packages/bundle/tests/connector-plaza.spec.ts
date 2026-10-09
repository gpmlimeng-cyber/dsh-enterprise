/**
 * [INPUT]: 依赖 `src/connector-plaza.ts` 的路由注册器/投影/常量、`src/esc-route.ts` 的两张许可表与宿主内部读入口、`src/nuwax-auth.ts` 的会话持有者、`tests/engine-route-match.ts`（引擎语义匹配器）、`tests/nuwax-support.ts`（隔离 dshHome）与 node:http 真服务器；平台反应由真实 `Response` 构造（不打真网）
 * [OUTPUT]: 锁定口径 67 Phase C 的宿主半边——D0（参数化模式表 5 → 8：三条 MCP 路径**只进宿主内部表**、浏览器可读表**零新增**、浏览器读 `GET` 面一律 400 且**零上游**、既有 7 字面 + 3「我的专家」+ 2 B0 逐条回归、`browserReadable: true` 条目数与 D0 之前逐字相同）与 D1（`GET /enterprise/api/v1/local/connectors`：安全格**恰好**那几格、整份响应逐字 grep 不到配置面、部分成功保留、全失败 503 + 新码且**绝不 200 空数组**、两处有界与 `complete:false` 原样出厂、405 + `Allow: GET`）
 * [POS]: Phase C 连接器广场的**宿主面**回归门禁（真 HTTP + 引擎语义分发，不是直接调 handler）；有人把 `/api/mcp/<id>` 加进浏览器可读表、把 `mcpConfig` 带进响应、把"全失败"折成空列表、把 `complete:false` 折成 true、或把某个空间的失败升级成整体失败，这里都会红。★本文件**不主张**任何真机读数：平台形状全部按 `analysis/connector-plaza-probe.md` 的冻结契约构造
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_CONNECTOR_KEYS,
  ENTERPRISE_CONNECTOR_MAX_CONNECTORS,
  ENTERPRISE_CONNECTOR_MAX_SPACES,
  ENTERPRISE_CONNECTOR_OPTIONAL_KEYS,
  ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH,
  ENT_CONNECTOR_PLAZA_UNAVAILABLE,
  projectConnectorRow,
  readConnectorPlaza,
  registerEnterpriseConnectorPlazaRoute,
  type EnterpriseConnectorPlazaPort,
} from '../src/connector-plaza.js'
import {
  ENTERPRISE_ESC_IMAGE_LOCAL_PATH,
  ENTERPRISE_ESC_MOCK_LOCAL_PATH,
  ENTERPRISE_ESC_READ_ENDPOINTS,
  ENTERPRISE_ESC_READ_LOCAL_PATH,
  ENTERPRISE_ESC_READ_PATTERNS,
  readEnterpriseEscHostJson,
  registerEnterpriseEscReadRoute,
  resolveEnterpriseEscBrowserReadable,
  resolveEnterpriseEscHostReadable,
  type EnterpriseEscReadRoutePort,
} from '../src/esc-route.js'
import {
  createNuwaxSessionHolder,
  type NuwaxAuthDependencies,
  type NuwaxSessionHolder,
} from '../src/nuwax-auth.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { disposeNuwaxTempHomes, nuwaxTempHome } from './nuwax-support.js'

const ORIGIN = 'https://nuwax.example.com'
const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'correct horse battery staple'
const TICKET = 'connector-plaza-ticket-must-not-leave-the-host'

/** D0 新增的三条 MCP 平台路径（宿主内部专用）与它们的反例。 */
const MCP_HOST_PATHS = ['/api/mcp/list/3', '/api/mcp/deployed/list/3', '/api/mcp/134'] as const

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => { resolve() }) })))
  // ★会话持有者带落盘：每份 holder 一份自己的 dshHome，否则上一份票据会被当成"重启后的登录态"读回来。
  disposeNuwaxTempHomes()
})

/** 登录用的平台反应。 */
function loginPlatform(): NuwaxAuthDependencies['fetch'] {
  return async (input: string): Promise<Response> => input.endsWith('/api/user/passwordLogin')
    ? new Response(JSON.stringify({ code: '0000', data: { token: 'jwt' } }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': `ticket=${TICKET}; Max-Age=604800; HttpOnly; Secure; SameSite=None`,
      },
    })
    : new Response(JSON.stringify({ code: '0000', data: { uid: 1_784_006_361, userName: '538565', nickName: '李猛', tenantId: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
}

/** 已登录的会话持有者（宿主内部取数就靠它那枚票据）。 */
async function signedInHolder(): Promise<NuwaxSessionHolder> {
  return await (async () => {
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN, dshHome: nuwaxTempHome('connector-plaza') })
    await holder.login(ACCOUNT, PASSWORD)
    return holder
  })()
}

/** 平台 fetch double：记下每次调用（url + init），反应由测试给。 */
interface PlatformDouble {
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly calls: { readonly url: string; readonly init: RequestInit | undefined }[]
  /** 某条平台路径被打了几次（断言"零上游"与"恰好一次"用）。 */
  countOf(path: string): number
}

function platformDouble(respond: (url: string, init: RequestInit | undefined) => Response): PlatformDouble {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init })
    return respond(input, init)
  })
  return {
    fetchImpl: fetchImpl as unknown as PlatformDouble['fetchImpl'],
    calls,
    countOf: (path: string) => calls.filter(call => new URL(call.url).pathname === path).length,
  }
}

/** 平台成功信封（**带 message/success 两格**：esc 面要求原样回交，故测试也按原样给）。 */
function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ code: '0000', message: 'ok', data, success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * 一条平台 MCP 行：**真机 18 键全覆盖**（`analysis/connector-plaza-probe.md` §1），
 * 且危险面**故意填上真东西**（URL 内嵌凭据、header、token、平台内部身份）——
 * 本文件要证的不是"我们没写这几格"，而是"它们进不了响应体"。
 */
function platformRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 134,
    spaceId: 3,
    creatorId: 1_784_006_361,
    uid: 'uid-should-never-leave-the-host',
    name: '启信慧眼MCP',
    serverName: 'qixinhuiyan-mcp',
    description: '企业信息查询',
    icon: 'https://nuwax.example.com/api/logo/mcp/134',
    category: '数据服务',
    installType: 'STREAMABLE_HTTP',
    deployStatus: 'Deployed',
    mcpConfig: { mcpServers: { 'qixinhuiyan-mcp': { url: 'https://mcp.qixin.example.com/sse?ak=SUPER_SECRET_AK' } } },
    deployedConfig: {
      serverConfig: { headers: { authorization: 'Bearer SUPER_SECRET_TOKEN' } },
      tools: [{ name: 'tool-a' }, { name: 'tool-b' }, { name: 'tool-c' }],
    },
    deployed: true,
    modified: '2026-10-09T00:00:00.000+00:00',
    permissions: 'SHOULD-NEVER-LEAVE',
    platformMcp: false,
    created: '2026-10-01T00:00:00.000+00:00',
    creator: { id: 1_784_006_361, name: '李猛' },
    ...overrides,
  }
}

/** 真机三个空间的形状（`/api/space/list` 的 `data`）。 */
const SPACES = [
  { id: 2, name: '个人空间', type: 'Personal' },
  { id: 3, name: '数智化', type: 'Team' },
  { id: 248, name: '营销通空间', type: 'Team' },
] as const

/** 危险面的**逐字**清单（反向锁）：整份响应正文一个字节都不许出现。 */
const FORBIDDEN_IN_RESPONSE = [
  'mcpConfig',
  'deployedConfig',
  'serverConfig',
  'url',
  'header',
  'authorization',
  'permissions',
  'creatorId',
  'uid',
  'serverName',
  'SUPER_SECRET_AK',
  'SUPER_SECRET_TOKEN',
  'SHOULD-NEVER-LEAVE',
] as const

/* ────────────────────────── ① D0：两张许可表 ────────────────────────── */

describe('口径 67 D0：MCP 只读路径只进宿主内部表', () => {
  it('★三条路径浏览器可读表里**没有**、宿主内部表里是 GET；其余取值逐字', () => {
    for (const path of MCP_HOST_PATHS) {
      expect(resolveEnterpriseEscBrowserReadable(path), path).toBeUndefined()
      expect(resolveEnterpriseEscHostReadable(path), path).toBe('GET')
    }
    // 参数段仍是"1..18 位纯数字"这条唯一判据：畸形一律两张表都不认。
    for (const bad of [
      '/api/mcp/list/3a',
      '/api/mcp/list/3/',
      '/api/mcp/list/3?page=1',
      '/api/mcp/list/%33',
      '/api/mcp/list/',
      '/api/mcp/deployed/list/3/extra',
      '/api/mcp/134/',
      '/api/mcp/0000000000000000000',
    ]) {
      expect(resolveEnterpriseEscBrowserReadable(bad), bad).toBeUndefined()
      expect(resolveEnterpriseEscHostReadable(bad), bad).toBeUndefined()
    }
  })

  it('★浏览器可读表**零新增**：`browserReadable: true` 的条目数与 D0 之前逐字相同（10 条）', () => {
    // D0 之前 = 7 条字面 + 3 条「我的专家」模式规则。这三条 MCP 一条都不许加进来。
    const browserReadablePatterns = ENTERPRISE_ESC_READ_PATTERNS.filter(rule => rule.browserReadable)
    expect(browserReadablePatterns.map(rule => rule.template))
      .toEqual(['/api/agent/list/<id>', '/api/user/agent/collect/list/<id>/<id>', '/api/user/agent/dev/collect/list/<id>/<id>'])
    expect(browserReadablePatterns).toHaveLength(3)
    expect(Object.keys(ENTERPRISE_ESC_READ_ENDPOINTS)).toHaveLength(7)
    expect(Object.keys(ENTERPRISE_ESC_READ_ENDPOINTS).length + browserReadablePatterns.length).toBe(10)
    // ★结构级：模式表**只有**后五条 `browserReadable: false`，且 MCP 那三条一条都不在其中为 true。
    expect(ENTERPRISE_ESC_READ_PATTERNS.filter(rule => !rule.browserReadable).map(rule => rule.template)).toEqual([
      '/api/published/skill/<id>',
      '/api/published/skill/export/<id>',
      '/api/mcp/list/<id>',
      '/api/mcp/deployed/list/<id>',
      '/api/mcp/<id>',
    ])
  })

  it('既有 7 字面 + 3「我的专家」+ 2 B0 逐条回归（表字面 deep-equal）', () => {
    expect(ENTERPRISE_ESC_READ_ENDPOINTS).toEqual({
      '/api/system/display/recommend/list': 'POST',
      '/api/published/category/list': 'GET',
      '/api/space/list': 'GET',
      '/api/connector/providers': 'GET',
      '/api/published/agent/list': 'POST',
      '/api/published/skill/list': 'POST',
      '/api/published/skill/enable/list': 'POST',
    })
    expect(ENTERPRISE_ESC_READ_PATTERNS.slice(0, 5).map(rule => [rule.template, rule.method, rule.browserReadable])).toEqual([
      ['/api/agent/list/<id>', 'GET', true],
      ['/api/user/agent/collect/list/<id>/<id>', 'GET', true],
      ['/api/user/agent/dev/collect/list/<id>/<id>', 'GET', true],
      ['/api/published/skill/<id>', 'GET', false],
      ['/api/published/skill/export/<id>', 'GET', false],
    ])
    // 既有的 5 条正则逐字未改（参数段形状锁死）。
    expect(ENTERPRISE_ESC_READ_PATTERNS[0]!.pattern.test('/api/agent/list/158')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[1]!.pattern.test('/api/user/agent/collect/list/12/34')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[2]!.pattern.test('/api/user/agent/dev/collect/list/12/34')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[3]!.pattern.test('/api/published/skill/158')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[4]!.pattern.test('/api/published/skill/export/158')).toBe(true)
    for (const [path, method] of Object.entries(ENTERPRISE_ESC_READ_ENDPOINTS)) {
      expect(resolveEnterpriseEscBrowserReadable(path), path).toBe(method)
      expect(resolveEnterpriseEscHostReadable(path), path).toBe(method)
    }
  })

  it('★浏览器经 `POST /esc/read` 读 `/api/mcp/134` ⇒ 400 且**零上游**；宿主内部读同一路径能取到', async () => {
    const double = platformDouble(() => envelope([platformRow()]))
    const holder = await signedInHolder()
    const escPort: EnterpriseEscReadRoutePort = { holder, fetch: double.fetchImpl }
    const harness = await startEscHarness(escPort)
    const response = await fetch(`${harness.origin}${ENTERPRISE_ESC_READ_LOCAL_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/api/mcp/134' }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    expect(double.calls).toHaveLength(0)
    // ★反向对照：宿主内部读面能取到同一条（同一个 escPort、同一枚票据）。
    const envelopeOfHost = await readEnterpriseEscHostJson(escPort, '/api/mcp/134')
    expect(envelopeOfHost).toEqual({ code: '0000', message: 'ok', success: true, data: [platformRow()] })
    expect(double.countOf('/api/mcp/134')).toBe(1)
    expect(new Headers(double.calls[0]!.init?.headers).get('cookie')).toBe(`ticket=${TICKET}`)
  })

  it('★不引入 POST 读：模式表八条全是 GET；`POST /api/mcp/deployed/list` 两张表都不认', () => {
    expect(ENTERPRISE_ESC_READ_PATTERNS.map(rule => rule.method)).toEqual(['GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET'])
    expect(resolveEnterpriseEscHostReadable('/api/mcp/deployed/list')).toBeUndefined()
    expect(resolveEnterpriseEscBrowserReadable('/api/mcp/deployed/list')).toBeUndefined()
    expect(Object.keys(ENTERPRISE_ESC_READ_ENDPOINTS)).not.toContain('/api/mcp/deployed/list')
    for (const writePath of [
      '/api/mcp/create',
      '/api/mcp/update',
      '/api/mcp/delete/134',
      '/api/mcp/stop/134',
      '/api/mcp/server/config/refresh/134',
      '/api/mcp/credential/validate',
      '/api/mcp/test',
      '/api/mcp/server/config/export/134',
      '/api/mcp/official/list',
    ]) {
      expect(resolveEnterpriseEscBrowserReadable(writePath), writePath).toBeUndefined()
      expect(resolveEnterpriseEscHostReadable(writePath), writePath).toBeUndefined()
    }
  })
})

/* ────────────────────────── ② D1：投影（纯函数） ────────────────────────── */

describe('口径 67 D1：宿主侧脱敏投影（纯函数）', () => {
  it('★一条真机行投影后：键集**恰好**安全格，危险面一格都不在', () => {
    const projected = projectConnectorRow(platformRow(), { id: 3, name: '数智化' })
    // ★`official` 这一格由平台 `platformMcp` 的**显式布尔**派生（这里是 false ⇒ 在）。
    expect(Object.keys(projected).sort()).toEqual([...ENTERPRISE_CONNECTOR_KEYS, 'description', 'icon', 'official', 'toolCount'].sort())
    expect(projected).toEqual({
      id: 134,
      name: '启信慧眼MCP',
      description: '企业信息查询',
      icon: 'https://nuwax.example.com/api/logo/mcp/134',
      installType: 'STREAMABLE_HTTP',
      deployStatus: 'Deployed',
      // ★`toolCount` **只**借 `deployedConfig.tools[]` 的长度（配置正文一个字都不出去）。
      toolCount: 3,
      official: false,
      space: { id: 3, name: '数智化' },
    })
    const serialized = JSON.stringify(projected)
    for (const forbidden of FORBIDDEN_IN_RESPONSE) {
      expect(serialized, forbidden).not.toContain(forbidden)
    }
    expect(serialized).not.toEqual(JSON.stringify(platformRow()))
  })

  it('★"没说"与"说了 false/0/空"分得开：缺席即不给键', () => {
    // 平台 `platformMcp` 缺席/非布尔 ⇒ **不给** `official`（那是"没说"，不是"说不是"）。
    expect('official' in projectConnectorRow(platformRow({ platformMcp: undefined }), { id: 3, name: '数智化' })).toBe(false)
    expect('official' in projectConnectorRow(platformRow({ platformMcp: 'true' }), { id: 3, name: '数智化' })).toBe(false)
    // 平台真的说了 true ⇒ 逐字出厂（这就是 `official: true` 的唯一来源）。
    expect(projectConnectorRow(platformRow({ platformMcp: true }), { id: 3, name: '数智化' }).official).toBe(true)
    // 没有 `deployedConfig.tools[]` ⇒ 不给 `toolCount`（"没说"）；真的空数组 ⇒ 给 0（"说了 0"）。
    expect('toolCount' in projectConnectorRow(platformRow({ deployedConfig: undefined }), { id: 3, name: '数智化' })).toBe(false)
    expect('toolCount' in projectConnectorRow(platformRow({ deployedConfig: { serverConfig: {} } }), { id: 3, name: '数智化' })).toBe(false)
    expect(projectConnectorRow(platformRow({ deployedConfig: { tools: [] } }), { id: 3, name: '数智化' }).toolCount).toBe(0)
    // 描述/图标的同一条：缺席或空串都不给键。
    expect('description' in projectConnectorRow(platformRow({ description: undefined }), { id: 3, name: '数智化' })).toBe(false)
    expect('description' in projectConnectorRow(platformRow({ description: '' }), { id: 3, name: '数智化' })).toBe(false)
    expect('icon' in projectConnectorRow(platformRow({ icon: null }), { id: 3, name: '数智化' })).toBe(false)
  })

  it('★必填格形状读不懂 ⇒ 抛（宁可如实失败，也不静默少报一台连接器）', () => {
    const space = { id: 3, name: '数智化' }
    for (const bad of [
      null,
      [],
      'row',
      platformRow({ id: '134' }),
      platformRow({ id: 1.5 }),
      platformRow({ id: -1 }),
      platformRow({ id: Number.MAX_SAFE_INTEGER + 2 }),
      platformRow({ name: '' }),
      platformRow({ name: 7 }),
      platformRow({ installType: undefined }),
      platformRow({ deployStatus: null }),
    ]) {
      let caught: unknown
      try {
        projectConnectorRow(bad, space)
      } catch (error) {
        caught = error
      }
      expect(caught, JSON.stringify(bad)).toBeInstanceOf(Error)
      expect((caught as { readonly code?: string }).code, JSON.stringify(bad)).toBe(ENT_CONNECTOR_PLAZA_UNAVAILABLE)
    }
  })
})

/* ────────────────────────── ③ D1：逐空间盘点 ────────────────────────── */

/** 一台"假平台"：按平台路径给信封或抛错。 */
function hostDouble(handlers: Readonly<Record<string, () => Promise<unknown> | unknown>>): {
  readonly port: EnterpriseConnectorPlazaPort
  readonly read: (path: string) => Promise<unknown>
  readonly paths: string[]
} {
  const paths: string[] = []
  const read = vi.fn(async (path: string): Promise<unknown> => {
    paths.push(path)
    const handler = handlers[path]
    if (handler === undefined) throw new Error(`the plaza must not read ${path}`)
    return await handler()
  })
  return { port: { readHostJson: read }, read, paths }
}

describe('口径 67 D1：逐空间盘点（部分成功 / 全失败 / 有界）', () => {
  it('★部分成功保留：一个空间挂 ⇒ 其余照出、那个空间 `ok:false`（`count:0`）、`complete:false`', async () => {
    const errors: unknown[] = []
    const double = hostDouble({
      '/api/space/list': () => envelope([...SPACES]),
      '/api/mcp/list/2': () => envelope([]),
      '/api/mcp/list/3': () => { throw new Error('platform 500') },
      '/api/mcp/list/248': () => envelope([platformRow({ id: 900, name: '营销通MCP', spaceId: 248 })]),
    })
    const plaza = await readConnectorPlaza({ ...double.port, onError: (_message, error) => { errors.push(error) } })
    expect(plaza.spaces).toEqual([
      { id: 2, name: '个人空间', ok: true, count: 0 },
      { id: 3, name: '数智化', ok: false, count: 0 },
      { id: 248, name: '营销通空间', ok: true, count: 1 },
    ])
    expect(plaza.connectors.map(each => each.id)).toEqual([900])
    // ★`complete:false` 原样出厂（有空间挂了就不是一份完整盘点）。
    expect(plaza.complete).toBe(false)
    expect(errors).toHaveLength(1)
    // 真机三个空间数（0 + 1）——**不是**空列表。
    expect(plaza.connectors.length).toBe(1)
  })

  it('★全失败 ⇒ 抛本面唯一那枚码（绝不静默回空列表、也绝不 200）', async () => {
    const double = hostDouble({
      '/api/space/list': () => envelope([...SPACES]),
      '/api/mcp/list/2': () => { throw new Error('boom-2') },
      '/api/mcp/list/3': () => { throw new Error('boom-3') },
      '/api/mcp/list/248': () => { throw new Error('boom-248') },
    })
    let caught: unknown
    try {
      await readConnectorPlaza(double.port)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as { readonly code?: string }).code).toBe(ENT_CONNECTOR_PLAZA_UNAVAILABLE)
    // ★三个空间**逐个都试过**（不是第一个失败就整体放弃）。
    expect(double.paths).toEqual(['/api/space/list', '/api/mcp/list/2', '/api/mcp/list/3', '/api/mcp/list/248'])
  })

  it('★全失败且上游给了受控码 ⇒ 那枚码原样上抛（没登录就说"请先登录"，不埋在 503 里）', async () => {
    const double = hostDouble({
      '/api/space/list': () => envelope([...SPACES]),
      '/api/mcp/list/2': () => { throw Object.assign(new Error('no session'), { code: 'ENT_AUTH_REQUIRED' }) },
      '/api/mcp/list/3': () => { throw Object.assign(new Error('no session'), { code: 'ENT_AUTH_REQUIRED' }) },
      '/api/mcp/list/248': () => { throw Object.assign(new Error('no session'), { code: 'ENT_AUTH_REQUIRED' }) },
    })
    let caught: unknown
    try {
      await readConnectorPlaza(double.port)
    } catch (error) {
      caught = error
    }
    expect((caught as { readonly code?: string }).code).toBe('ENT_AUTH_REQUIRED')
    // ★空间列表那一条同理：没登录 ⇒ 同一枚码（不是本面那枚 503）。
    const spaceListFails = hostDouble({
      '/api/space/list': () => { throw Object.assign(new Error('no session'), { code: 'ENT_AUTH_REQUIRED' }) },
    })
    let second: unknown
    try {
      await readConnectorPlaza(spaceListFails.port)
    } catch (error) {
      second = error
    }
    expect((second as { readonly code?: string }).code).toBe('ENT_AUTH_REQUIRED')
  })

  it('★空间列表读不到 / 形状读不懂 ⇒ 同一枚码（**不是**"你们没有空间"）', async () => {
    for (const handler of [
      // 上游挂了（500）：`esc-route.ts` 把它翻成 `ENT_NUWAX_UNAVAILABLE`（502）—— 那是**上游**的事，
      // 与本面"本机这块暂时不可用"（503）不同源，故这里只断言"没被折成空空间列表"。
      (): unknown => new Response('boom', { status: 500 }),
      // 下面五条是**形状**问题（上游给了 200，但读不懂）：一律本面那枚码。
      (): unknown => envelope({ notAnArray: true }),
      (): unknown => ({ code: '4010' }),
      (): unknown => 'nonsense',
      (): unknown => envelope([{ name: '没有 id' }]),
      (): unknown => envelope([{ id: 3 }]),
      (): unknown => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ]) {
      const double = hostDouble({ '/api/space/list': handler })
      let caught: unknown
      try {
        await readConnectorPlaza(double.port)
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(Error)
      const code = (caught as { readonly code?: string }).code
      expect([ENT_CONNECTOR_PLAZA_UNAVAILABLE, 'ENT_NUWAX_UNAVAILABLE']).toContain(code)
      // ★空间列表读不懂时**一个空间都不查**（不拿半个事实去查）。
      expect(double.paths).toEqual(['/api/space/list'])
    }
  })

  it('★空间列表形状读不懂 ⇒ 本面那枚码（**逐字**：不是上游那族）', async () => {
    for (const handler of [
      (): unknown => envelope({ notAnArray: true }),
      (): unknown => ({ code: '4010' }),
      (): unknown => envelope([{ name: '没有 id' }]),
    ]) {
      const double = hostDouble({ '/api/space/list': handler })
      let caught: unknown
      try {
        await readConnectorPlaza(double.port)
      } catch (error) {
        caught = error
      }
      expect((caught as { readonly code?: string }).code).toBe(ENT_CONNECTOR_PLAZA_UNAVAILABLE)
    }
  })

  it('★两个空间都没有 MCP 行（真机个人空间 0 条）⇒ 200 + 空列表 + `complete:true`（合法结果）', async () => {
    const double = hostDouble({
      '/api/space/list': () => envelope([...SPACES]),
      '/api/mcp/list/2': () => envelope([]),
      '/api/mcp/list/3': () => envelope([]),
      '/api/mcp/list/248': () => envelope([]),
    })
    const plaza = await readConnectorPlaza(double.port)
    expect(plaza.connectors).toEqual([])
    expect(plaza.complete).toBe(true)
    expect(plaza.spaces.every(each => each.ok)).toBe(true)
  })

  it('★有界：空间数超上限 ⇒ 截断（多出来的空间一次都不查）+ `complete:false`', async () => {
    const many = Array.from({ length: 5 }, (_, index) => ({ id: 100 + index, name: `空间${String(index)}` }))
    const double = hostDouble({
      '/api/space/list': () => envelope(many),
      ...Object.fromEntries(many.map(space => [`/api/mcp/list/${String(space.id)}`, () => envelope([])])),
    })
    const plaza = await readConnectorPlaza({ ...double.port, maxSpaces: 2 })
    expect(ENTERPRISE_CONNECTOR_MAX_SPACES).toBe(64)
    expect(double.paths).toEqual(['/api/space/list', '/api/mcp/list/100', '/api/mcp/list/101'])
    expect(plaza.spaces).toHaveLength(2)
    expect(plaza.complete).toBe(false)
  })

  it('★有界：连接器总数超上限 ⇒ 截断（不报错、不静默丢）+ `complete:false`、`spaces[].count` 仍是平台真值', async () => {
    const double = hostDouble({
      '/api/space/list': () => envelope([...SPACES]),
      '/api/mcp/list/2': () => envelope([]),
      '/api/mcp/list/3': () => envelope([platformRow({ id: 1 }), platformRow({ id: 2 }), platformRow({ id: 3 })]),
      '/api/mcp/list/248': () => envelope([platformRow({ id: 900 })]),
    })
    const plaza = await readConnectorPlaza({ ...double.port, maxConnectors: 2 })
    expect(ENTERPRISE_CONNECTOR_MAX_CONNECTORS).toBe(1000)
    expect(plaza.connectors.map(each => each.id)).toEqual([1, 2])
    // 到顶后**不再查**后面的空间（少打无用的上游），`complete:false` 说出这件事。
    expect(double.paths).toEqual(['/api/space/list', '/api/mcp/list/2', '/api/mcp/list/3'])
    expect(plaza.spaces.at(-1)).toEqual({ id: 3, name: '数智化', ok: true, count: 3 })
    expect(plaza.complete).toBe(false)
  })

  it('★某个空间回的不是数组 / 行读不懂 ⇒ 那个空间 `ok:false`（整批一条都不出厂）', async () => {
    const double = hostDouble({
      '/api/space/list': () => envelope([...SPACES]),
      '/api/mcp/list/2': () => envelope({ rows: [] }),
      '/api/mcp/list/3': () => envelope([platformRow({ id: 1 }), platformRow({ id: 'not-a-number' })]),
      '/api/mcp/list/248': () => envelope([platformRow({ id: 900 })]),
    })
    const plaza = await readConnectorPlaza(double.port)
    expect(plaza.spaces).toEqual([
      { id: 2, name: '个人空间', ok: false, count: 0 },
      { id: 3, name: '数智化', ok: false, count: 0 },
      { id: 248, name: '营销通空间', ok: true, count: 1 },
    ])
    expect(plaza.connectors.map(each => each.id)).toEqual([900])
    expect(plaza.complete).toBe(false)
  })
})

/* ────────────────────────── ④ D1：真 HTTP 路由 ────────────────────────── */

/** 把两条本机路由挂进一台真 HTTP 服务器：esc 面（同一份 escPort）+ 连接器广场面。 */
interface PlazaHarness {
  readonly routes: readonly RegisteredRoute[]
  readonly origin: string
  readonly escPort: EnterpriseEscReadRoutePort
  dispose(): Promise<void>
}

async function startPlazaHarness(input: {
  readonly holder: NuwaxSessionHolder
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly plazaPort?: EnterpriseConnectorPlazaPort | undefined
  readonly onError?: (message: string, error: unknown) => void
}): Promise<PlazaHarness> {
  const escPort: EnterpriseEscReadRoutePort = {
    holder: input.holder,
    fetch: input.fetchImpl,
    ...(input.onError === undefined ? {} : { onError: input.onError }),
  }
  const routes: RegisteredRoute[] = []
  const webServer: WebServerRoutePort = {
    host: '127.0.0.1',
    port: 0,
    register: (registered) => {
      routes.push(registered)
      return () => {
        const index = routes.indexOf(registered)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  registerEnterpriseEscReadRoute(webServer, escPort)
  registerEnterpriseConnectorPlazaRoute(webServer, input.plazaPort ?? {
    // ★生产接线逐字同款：广场复用**同一个** escPort 的宿主内部读入口。
    readHostJson: path => readEnterpriseEscHostJson(escPort, path),
    ...(input.onError === undefined ? {} : { onError: input.onError }),
  })
  const server = createServer((request, response) => {
    const route = engineRouteMatch(routes, (request.url ?? '/').split('?')[0]!)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(request, response))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing test port')
  return {
    routes,
    origin: `http://127.0.0.1:${address.port}`,
    escPort,
    dispose: async () => {
      await new Promise<void>(resolve => server.close(() => { resolve() }))
    },
  }
}

/** 真机三个空间的平台反应（经**真** escPort 打出去，不是桩）。 */
function realPlatformDouble(options: { readonly failSpace?: number } = {}): PlatformDouble {
  return platformDouble((url) => {
    const path = new URL(url).pathname
    if (path === '/api/space/list') return envelope([...SPACES])
    if (path === '/api/mcp/list/2') return envelope([])
    if (path === '/api/mcp/list/3') {
      if (options.failSpace === 3) return new Response('boom', { status: 500 })
      return envelope([
        platformRow({ id: 134 }),
        platformRow({ id: 900, name: '营销通MCP', spaceId: 3, platformMcp: true, deployedConfig: undefined }),
      ])
    }
    if (path === '/api/mcp/list/248') {
      if (options.failSpace === 248) return new Response('boom', { status: 500 })
      return envelope([platformRow({ id: 248, name: '营销通空间MCP', spaceId: 248, icon: '', deployedConfig: { tools: [] } })])
    }
    throw new Error(`unexpected platform path ${path}`)
  })
}

describe('GET /enterprise/api/v1/local/connectors', () => {
  it('★注册形状：恰好一条 exact、路径逐字不带尾斜杠；父路径/截断/带尾斜杠都 404', async () => {
    const harness = await startPlazaHarness({ holder: await signedInHolder(), fetchImpl: realPlatformDouble().fetchImpl })
    expect(ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH).toBe('/enterprise/api/v1/local/connectors')
    expect(ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH.endsWith('/')).toBe(false)
    expect(harness.routes.map(route => `${route.kind} ${route.path}`)).toEqual([
      `exact ${ENTERPRISE_ESC_READ_LOCAL_PATH}`,
      `exact ${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}`,
      `exact ${ENTERPRISE_ESC_MOCK_LOCAL_PATH}`,
      `exact ${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`,
    ])
    for (const path of [
      '/enterprise/api/v1/local/connector',
      '/enterprise/api/v1/local/connectors/',
      '/enterprise/api/v1/local/connectors/x',
      '/enterprise/api/v1/local',
    ]) {
      expect((await fetch(`${harness.origin}${path}`)).status, path).toBe(404)
    }
    await harness.dispose()
  })

  it('★200：整份响应正文逐字 grep 不到配置面/平台身份；逐条键集恰好安全格', async () => {
    const double = realPlatformDouble()
    const harness = await startPlazaHarness({ holder: await signedInHolder(), fetchImpl: double.fetchImpl })
    const response = await fetch(`${harness.origin}${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    const serialized = await response.text()
    // ★本刀最重要的一条反向锁：整份响应正文（含嵌套）一个危险字节都没有。
    for (const forbidden of FORBIDDEN_IN_RESPONSE) {
      expect(serialized, forbidden).not.toContain(forbidden)
    }
    const body = JSON.parse(serialized) as { readonly data: { readonly connectors: readonly Record<string, unknown>[]; readonly complete: boolean; readonly spaces: readonly unknown[] } }
    expect(Object.keys(body)).toEqual(['data'])
    expect(Object.keys(body.data).sort()).toEqual(['complete', 'connectors', 'spaces'])
    expect(body.data.complete).toBe(true)
    expect(body.data.spaces).toEqual([
      { id: 2, name: '个人空间', ok: true, count: 0 },
      { id: 3, name: '数智化', ok: true, count: 2 },
      { id: 248, name: '营销通空间', ok: true, count: 1 },
    ])
    expect(body.data.connectors.map(each => each.id)).toEqual([134, 900, 248])
    for (const each of body.data.connectors) {
      const keys = new Set(Object.keys(each))
      // ★可选四格各自独立：平台没说就不给键 ⇒ 键数落在「必填 5」到「必填 5 + 可选 4」之间。
      expect(keys.size, '键数只能是安全格或安全格+可选').toBeGreaterThanOrEqual(ENTERPRISE_CONNECTOR_KEYS.length)
      expect(keys.size).toBeLessThanOrEqual(ENTERPRISE_CONNECTOR_KEYS.length + ENTERPRISE_CONNECTOR_OPTIONAL_KEYS.length)
      for (const key of ENTERPRISE_CONNECTOR_KEYS) expect(keys.has(key), key).toBe(true)
      for (const key of keys) {
        expect([...ENTERPRISE_CONNECTOR_KEYS, ...ENTERPRISE_CONNECTOR_OPTIONAL_KEYS], key).toContain(key)
      }
      expect(Object.keys(each['space'] as object).sort()).toEqual(['id', 'name'])
    }
    // 逐条与纯函数投影**逐字**一致（同一个实现，不是两套）。
    expect(body.data.connectors[0]).toEqual(projectConnectorRow(platformRow({ id: 134 }), { id: 3, name: '数智化' }))
    expect(serialized).not.toEqual(JSON.stringify({ data: { connectors: [platformRow()], complete: true, spaces: [] } }))
    await harness.dispose()
  })

  it('★真 HTTP 的部分成功：一个空间 500 ⇒ 其余照出、那个空间 `ok:false`、`complete:false`', async () => {
    const double = realPlatformDouble({ failSpace: 248 })
    const harness = await startPlazaHarness({ holder: await signedInHolder(), fetchImpl: double.fetchImpl })
    const response = await fetch(`${harness.origin}${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: { readonly complete: boolean; readonly connectors: readonly { readonly id: number }[]; readonly spaces: readonly unknown[] } }
    expect(body.data.spaces).toEqual([
      { id: 2, name: '个人空间', ok: true, count: 0 },
      { id: 3, name: '数智化', ok: true, count: 2 },
      { id: 248, name: '营销通空间', ok: false, count: 0 },
    ])
    expect(body.data.connectors.map(each => each.id)).toEqual([134, 900])
    expect(body.data.complete).toBe(false)
    await harness.dispose()
  })

  it('★真 HTTP 的全失败：503 + `ENT_CONNECTOR_PLAZA_UNAVAILABLE`（**绝不 200 空数组**），失败经 onError 留判定点', async () => {
    const reported: string[] = []
    const harness = await startPlazaHarness({
      holder: await signedInHolder(),
      // 三条空间 MCP 路径**形状**全读不懂（200 但不是信封）⇒ 全失败走本面那枚码（503）。
      fetchImpl: platformDouble((url) => {
        const path = new URL(url).pathname
        if (path === '/api/space/list') return envelope([...SPACES])
        return envelope({ notAnArray: true })
      }).fetchImpl,
      onError: message => { reported.push(message) },
    })
    const response = await fetch(`${harness.origin}${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_CONNECTOR_PLAZA_UNAVAILABLE } })
    expect(reported.some(message => message.includes('step=plaza-failed') || message.includes('step=space-mcp-failed'))).toBe(true)
    await harness.dispose()
  })

  it('★没登录 ⇒ 401 `ENT_AUTH_REQUIRED`（同一套判决、同一个 escPort），且零平台调用', async () => {
    const double = realPlatformDouble()
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN, dshHome: nuwaxTempHome('connector-anon') })
    const harness = await startPlazaHarness({ holder, fetchImpl: double.fetchImpl })
    const response = await fetch(`${harness.origin}${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'ENT_AUTH_REQUIRED' } })
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('★非 GET 一律 405 + `Allow: GET`，且**零上游**、零副作用', async () => {
    const double = realPlatformDouble()
    const harness = await startPlazaHarness({ holder: await signedInHolder(), fetchImpl: double.fetchImpl })
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await fetch(`${harness.origin}${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow'), method).toBe('GET')
      expect(await response.json(), method).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('★端口的 `onError` 收到部分失败的判定点（`step=space-mcp-failed`）', async () => {
    const double = realPlatformDouble({ failSpace: 248 })
    const reported: string[] = []
    const harness = await startPlazaHarness({
      holder: await signedInHolder(),
      fetchImpl: double.fetchImpl,
      onError: message => { reported.push(message) },
    })
    expect((await fetch(`${harness.origin}${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`)).status).toBe(200)
    expect(reported.some(message => message.includes('step=space-mcp-failed'))).toBe(true)
    await harness.dispose()
  })
})

/* ────────────────────────── ⑤ 组合层接线与源码级纪律 ────────────────────────── */

describe('口径 67：组合层接线与源码级纪律', () => {
  it('★组合层把**同一个** escReadPort 的宿主内部读面交给广场（不是第二份客户端/票据）', async () => {
    const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(index).toContain("import { registerEnterpriseConnectorPlazaRoute } from './connector-plaza.js'")
    expect(index).toMatch(/readHostJson: path => readEnterpriseEscHostJson\(escReadPort, path\)/)
    expect(index).toContain("'enterpriseConnectorPlaza.routes'")
    // 组合层没有第二枚票据：`createNuwaxSessionHolder` 在 index.ts 里仍然只造一次。
    expect(index.match(/createNuwaxSessionHolder\(/g)).toHaveLength(1)
  })

  it('★源码级：无 exec/spawn/动态 import、不新增 HTTP 客户端、不碰 platform-client', async () => {
    const source = await readFile(new URL('../src/connector-plaza.ts', import.meta.url), 'utf8')
    for (const forbidden of ['exec(', 'spawn(', 'execFile', 'child_process', 'await import(', 'import(']) {
      expect(source, forbidden).not.toContain(forbidden)
    }
    expect(source).not.toContain('fetch(')
    // ★新码**不**进 platform-client 那张码→状态表（那张表在另一个包里，本刀一个字节都不动）。
    const table = await readFile(new URL('../../platform-client/src/local-api.ts', import.meta.url), 'utf8')
    expect(table).not.toContain(ENT_CONNECTOR_PLAZA_UNAVAILABLE)
  })
})

/** D0 的 esc 面夹具（复用真 HTTP + 引擎语义分发；只注册 esc 那三条）。 */
async function startEscHarness(port: EnterpriseEscReadRoutePort): Promise<{ readonly origin: string }> {
  const routes: RegisteredRoute[] = []
  registerEnterpriseEscReadRoute({
    host: '127.0.0.1',
    port: 0,
    register: (route) => {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }, port)
  const server = createServer((request, response) => {
    const route = engineRouteMatch(routes, (request.url ?? '/').split('?')[0]!)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(request, response))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing test port')
  return { origin: `http://127.0.0.1:${address.port}` }
}
