/**
 * [INPUT]: 依赖 `src/connector-enable-route.ts`（四条路由 + 失败投影）、`src/connector-enable-service.ts`（脱敏投影/`url` 去凭据/四个端口）、`src/connector-enable.ts`（内核那 11 枚码与两枚纯函数）、`src/connector-plaza.ts`（D1 那条只读路由，作为「一字未改」的对照）、`src/esc-route.ts` 的宿主内部读唯一入口、`src/nuwax-auth.ts` 的会话持有者、`tests/engine-route-match.ts`（引擎语义匹配器）、`tests/connector-enable-support.ts`（真 HTTP 假平台 + 有形状闸门的官方管理面 double + 临时 dshHome）与 `tests/nuwax-support.ts`（隔离 dshHome）
 * [OUTPUT]: 锁定 D2 本机 HTTP 面的十条纪律——①注册形状与**引擎语义**（三条 exact + 一条不带尾斜杠的 prefix；D1 那条一字未改、`<mcpId>` 吃不到 `enable`/`disable`/`connected`）②`<mcpId>` 非纯数字 ⇒ 400 且**零内核调用** ③正文关闭键集恰好（多/少/非 JSON/`content-type` 不对 ⇒ 400 零内核）④四格方法错配 ⇒ 405 + `Allow` 且零副作用 ⑤★**脱敏反向锁**：三份响应正文逐字 grep 不到凭据面/宿主路径/patch 面 ⑥★`url` 去内嵌凭据逐格 + 畸形明确失败 ⑦★授权两枚码（403/409）**原样透出**且零落盘零安装 ⑧内核 11 枚码逐枚走**唯一那张表**（含「11 枚都在表里」的反向锁）⑨官方管理面缺席 ⇒ fail-closed（明确失败、**不装**、零落盘）⑩源码级（无 `exec`/`spawn`/动态 import、不新增 HTTP 客户端、`index.ts` 的 `createNuwaxSessionHolder(` 仍恰好一处、11 枚码的定义处仍只在内核文件里、本面不另立第二张状态表）；另锁「已连接的」盘点的**真源与语义复用**（官方 `listBundles` + 内核同一枚纯判据）
 * [POS]: D2 本机面的回归门禁（**真 HTTP** 服务器 + **引擎语义**分发器 + **真内核** + 假官方管理面 + 真 HTTP 假平台）。★本文件**不主张**任何真机读数：平台形状按 `analysis/connector-plaza-probe.md` §1/§6 的冻结契约构造。有人把 `url` 的内嵌凭据原样出厂、把 `secretPath`/`headers` 带进响应、把正文门禁放开、把 `<mcpId>` 的形状尺去掉、或者把内核那几枚码折成 503 一把抓，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'
import {
  CONNECTOR_BUNDLE_PACKAGE_PREFIX,
  EnterpriseConnectorEnableError,
  connectorBundleRoot,
  connectorEnableDisclosure,
  connectorEnableFingerprint,
  readConnectorAuthorizations,
  readConnectorPlatformConfig,
  type ConnectorEnablePort,
  type EnterpriseConnectorEnableErrorCode,
} from '../src/connector-enable.js'
import {
  ENTERPRISE_CONNECTOR_CONNECTED_KEYS,
  ENTERPRISE_CONNECTOR_CONNECTION_KEYS,
  ENTERPRISE_CONNECTOR_DISABLE_KEYS,
  ENTERPRISE_CONNECTOR_DISCLOSURE_KEYS,
  ENTERPRISE_CONNECTOR_ENABLE_KEYS,
  ENTERPRISE_CONNECTOR_STATUS_KEYS,
  createEnterpriseConnectorEnableService,
  projectConnectorConnections,
  projectConnectorDisclosure,
  projectConnectorDisableResult,
  projectConnectorEnableResult,
  stripConnectorUrlCredentials,
} from '../src/connector-enable-service.js'
import {
  ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH,
  ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH,
  ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH,
  ENTERPRISE_CONNECTOR_LOCAL_PREFIX,
  ENTERPRISE_CONNECTOR_STATUS_PREFIX,
  projectConnectorEnableFailure,
  registerEnterpriseConnectorEnableRoutes,
  type EnterpriseConnectorEnableRouteStep,
} from '../src/connector-enable-route.js'
import {
  ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH,
  registerEnterpriseConnectorPlazaRoute,
} from '../src/connector-plaza.js'
import { readEnterpriseEscHostJson, type EnterpriseEscHostReadPort } from '../src/esc-route.js'
import { createNuwaxSessionHolder } from '../src/nuwax-auth.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import {
  PLATFORM_TOKEN,
  appliedResult,
  connectorDetailRow,
  createFakeOfficialManager,
  connectorEnableTempHome,
  disposeConnectorEnableHomes,
  disposeFakePlatforms,
  platformEnvelope,
  platformLoginReply,
  startFakePlatform,
  type FakeOfficialManager,
  type FakePlatform,
} from './connector-enable-support.js'
import { disposeNuwaxTempHomes, nuwaxTempHome } from './nuwax-support.js'

const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'correct horse battery staple'
const TICKET = 'connector-enable-route-ticket-must-not-leave-the-host'
const MCP_ID = '134'
const SERVER_NAME = 'qixinhuiyan-mcp'
const TOKEN = PLATFORM_TOKEN
const PACKAGE_NAME = `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}${MCP_ID}`
const STATUS_PATH = `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/${MCP_ID}/status`
const BUNDLE_MANIFEST = `${PACKAGE_NAME}/package.json`

/**
 * 本刀裁决（Lead 冻结）的**逐码**映射：内核 11 枚码各自的状态由 platform-client 那张**唯一**的表定，
 * 本面不另立第二张。这里把裁决结果逐枚钉住（表就是唯一实现处；改动它必须同时改这份期望）。
 */
const CONNECTOR_CODE_STATUS: Readonly<Record<EnterpriseConnectorEnableErrorCode, number>> = {
  ENT_INVALID_REQUEST: 400,
  ENT_CONNECTOR_CONFIG_UNAVAILABLE: 503,
  ENT_CONNECTOR_CONFIG_INVALID: 502,
  ENT_CONNECTOR_AUTHORIZATION_REQUIRED: 403,
  ENT_CONNECTOR_AUTHORIZATION_STALE: 409,
  ENT_CONNECTOR_STATE_INVALID: 503,
  ENT_CONNECTOR_LOCAL_WRITE_FAILED: 503,
  ENT_CONNECTOR_INSTALL_IN_PROGRESS: 409,
  ENT_CONNECTOR_INSTALL_FAILED: 503,
  ENT_CONNECTOR_INSTALL_CANCELLED: 409,
  ENT_CONNECTOR_UNINSTALL_FAILED: 503,
}

/** 内核那 11 枚码（定义处仍只在内核文件里；这里只枚举，不定义）。 */
const KERNEL_CODES = Object.keys(CONNECTOR_CODE_STATUS) as readonly EnterpriseConnectorEnableErrorCode[]

/** 一条合法披露（纯函数用例的输入；`url` 与指纹都由内核导出函数算，绝不自己另算一份）。 */
const DISCLOSURE = {
  mcpId: MCP_ID,
  name: '启信慧眼MCP',
  serverName: SERVER_NAME,
  host: 'mcp.qixin.example',
  url: 'https://mcp.qixin.example/mcp',
  credentials: true,
} as const

/** 响应里绝不许出现的探针（凭据面 / 宿主路径 / patch 面 / 内部字段）。 */
const FORBIDDEN_PROBES = [
  TOKEN,
  `${TOKEN}-key`,
  'Bearer',
  'authorization',
  'Authorization',
  'X-Api-Key',
  'secretPath',
  'headers',
  '!!js',
  'cordis.patch',
  'serverConfig',
  'mcpConfig',
  'connector-secrets',
  'connector-bundles',
  'failOnStartupError',
  'rowId',
  'dsh-mcp-client',
] as const

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => { resolve() }) })))
  await disposeFakePlatforms()
  await disposeConnectorEnableHomes()
  // ★会话持有者带落盘：每份 holder 一份自己的 dshHome，否则上一份票据会被当成「重启后的登录态」读回来。
  disposeNuwaxTempHomes()
})

/* ────────────────────────── 夹具 ────────────────────────── */

/** 端口调用计数（「零内核调用」那几条断言靠它）。 */
interface PortCounts {
  installs: number
  removes: number
  lists: number
}

interface Harness {
  readonly home: string
  readonly platform: FakePlatform
  readonly official: FakeOfficialManager
  readonly counts: PortCounts
  readonly routes: readonly RegisteredRoute[]
  readonly origin: string
  readonly logs: { readonly message: string, readonly error: unknown }[]
  /** 让假平台在登录两跳之外再服务 `/api/mcp/<id>` 详情那一跳。 */
  serveDetail(row: unknown, id?: string): void
  /** 让假平台服务广场那两条路径（D1 的对照用例要用）。 */
  servePlaza(spaces: unknown[]): void
  dispose(): Promise<void>
}

/** 官方管理面的**计数**包装（与生产同形：三个方法原样转发，只多记一笔）。 */
function countingPort(inner: ConnectorEnablePort, counts: PortCounts): ConnectorEnablePort {
  return {
    async installBundle(spec, options) {
      counts.installs += 1
      return inner.installBundle(spec, options)
    },
    async removeBundle(name) {
      counts.removes += 1
      return inner.removeBundle(name)
    },
    async listBundles() {
      counts.lists += 1
      return inner.listBundles()
    },
  }
}

/**
 * 一台「真 HTTP 假平台 + 真宿主内部读入口 + 假官方管理面 + 真内核 + **引擎语义**分发」的完整夹具。
 *
 * 路由分发走 `engineRouteMatch`（逐行复刻 `dsh-host-webserver` 的 `match()`），故「exact 整路径优先、
 * prefix 只认路径段边界」这条判决**真的参与**了用例；D1 那条只读路由默认也挂上，用来证它没被本刀吃掉。
 */
async function startHarness(options: { readonly available?: boolean } = {}): Promise<Harness> {
  const home = await connectorEnableTempHome()
  const platform = await startFakePlatform()
  const details = new Map<string, unknown>()
  let plazaSpaces: unknown[] | undefined
  platform.respond = (path) => {
    const login = platformLoginReply(path, TICKET)
    if (login !== undefined) return login
    if (plazaSpaces !== undefined && path === '/api/space/list') return platformEnvelope(plazaSpaces)
    if (/^\/api\/mcp\/list\/[0-9]{1,18}$/.test(path)) return platformEnvelope([])
    if (details.has(path)) return platformEnvelope(details.get(path))
    return undefined
  }
  const holder = createNuwaxSessionHolder({
    fetch: (input, init) => fetch(input, init),
    origin: platform.origin,
    dshHome: nuwaxTempHome('connector-enable-route'),
  })
  await holder.login(ACCOUNT, PASSWORD)
  // ★登录两跳是**夹具准备**、不是"被测请求打出去的上游"：清掉记录，后面的"零上游"断言才说得准。
  platform.calls.length = 0
  const readPort: EnterpriseEscHostReadPort = { holder, env: {} }
  const official = createFakeOfficialManager()
  const counts: PortCounts = { installs: 0, removes: 0, lists: 0 }
  const delegate = countingPort(official.port, counts)
  const logs: { readonly message: string, readonly error: unknown }[] = []
  const service = createEnterpriseConnectorEnableService({
    port: () => (options.available === false ? undefined : delegate),
    readPlatformJson: path => readEnterpriseEscHostJson(readPort, path),
    dshHome: home,
    now: () => new Date('2026-10-09T00:00:00.000Z'),
    onError: (message, error) => { logs.push({ message, error }) },
  })
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
  // D1 那条只读路由（**本刀一字未改**）：默认挂上，用它的存在证明本刀没有借用/替换它。
  registerEnterpriseConnectorPlazaRoute(webServer, {
    readHostJson: path => readEnterpriseEscHostJson(readPort, path),
  })
  registerEnterpriseConnectorEnableRoutes(webServer, {
    status: mcpId => service.status(mcpId),
    enable: (mcpId, confirmFingerprint) => service.enable(mcpId, confirmFingerprint),
    disable: mcpId => service.disable(mcpId),
    connected: () => service.connected(),
    onError: (message, error) => { logs.push({ message, error }) },
  })
  const server = createServer((request, response) => {
    const route = engineRouteMatch(routes, (request.url ?? '/').split('?')[0] ?? '/')
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
    home,
    platform,
    official,
    counts,
    routes,
    origin: `http://127.0.0.1:${String(address.port)}`,
    logs,
    serveDetail: (row, id = MCP_ID) => { details.set(`/api/mcp/${id}`, row) },
    servePlaza: (spaces) => { plazaSpaces = spaces },
    dispose: async () => {
      await new Promise<void>(resolve => { server.close(() => { resolve() }) })
    },
  }
}

/* ────────────────────────── 小工具 ────────────────────────── */

interface CallResult {
  readonly status: number
  readonly allow: string | null
  readonly text: string
}

async function call(
  origin: string,
  method: string,
  path: string,
  body?: string,
  contentType?: string,
): Promise<CallResult> {
  const response = await fetch(`${origin}${path}`, {
    method,
    ...(body === undefined ? {} : { body }),
    ...(contentType === undefined ? {} : { headers: { 'content-type': contentType } }),
  })
  return { status: response.status, allow: response.headers.get('allow'), text: await response.text() }
}

/** `POST` 一个 JSON 正文（`body` 是字符串时原样发，用来造"不是 JSON"那种形状）。 */
function post(origin: string, path: string, body?: unknown, contentType = 'application/json'): Promise<CallResult> {
  const encoded = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  return call(origin, 'POST', path, encoded, contentType)
}

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected an object')
  return value as Record<string, unknown>
}

function keysOf(value: unknown): string[] {
  return Object.keys(recordOf(value)).sort()
}

/** 信封里的 `data`（本面所有 2xx 都是 `{data: …}`）。 */
function dataOf(text: string): Record<string, unknown> {
  return recordOf(recordOf(JSON.parse(text) as unknown)['data'])
}

/** 失败体里的稳定码。 */
function codeOf(text: string): unknown {
  return recordOf(recordOf(JSON.parse(text) as unknown)['error'])['code']
}

function connectionOf(text: string): Record<string, unknown> {
  return recordOf(dataOf(text)['connection'])
}

function disclosureOf(text: string): Record<string, unknown> {
  return recordOf(dataOf(text)['disclosure'])
}

/** 员工确认用的指纹：走**内核导出**的两个纯函数（与生产同一条路），绝不自己另算一份。 */
function confirmFor(row: unknown, id = MCP_ID): string {
  return connectorEnableFingerprint(connectorEnableDisclosure(readConnectorPlatformConfig(platformEnvelope(row).body, id)))
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** 去掉注释（源码级反锁要按"代码里有没有那个字面量"判，注释里的数字不算）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function srcFile(name: string): URL {
  return new URL(`../src/${name}`, import.meta.url)
}

/** 跑一次调用并把抛出来的错误交回（断言稳定码用）。 */
async function failOf(promise: Promise<unknown>): Promise<{ code?: string, step?: string }> {
  try {
    await promise
    throw new Error('expected the call to fail')
  } catch (error) {
    return error as { code?: string, step?: string }
  }
}

/* ══════════════════════════ ① 注册形状与引擎语义 ══════════════════════════ */

describe('① 注册形状与引擎 exact/prefix 语义', () => {
  it('注册面恰好这五条（三条新 exact + 一条 status prefix + D1 那条没被改）', async () => {
    const harness = await startHarness()
    try {
      const shape = harness.routes.map(route => `${route.kind}:${route.path}`).sort()
      expect(shape).toEqual([
        `exact:${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH}`,
        `exact:${ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH}`,
        `exact:${ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH}`,
        `exact:${ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH}`,
        `prefix:${ENTERPRISE_CONNECTOR_STATUS_PREFIX}`,
      ].sort())
      // ★prefix 注册 path 与 D1 那条 exact **逐字相同**且**不带尾斜杠**（带尾斜杠时子路径在引擎层空体 404）。
      expect(ENTERPRISE_CONNECTOR_STATUS_PREFIX).toBe(ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH)
      expect(ENTERPRISE_CONNECTOR_STATUS_PREFIX.endsWith('/')).toBe(false)
      // ★D1 那条的 kind/path 一字未改（本面只 import 它的常量，不 register 它）。
      const plaza = harness.routes.filter(route => route.path === ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH)
      expect(plaza.map(route => route.kind)).toEqual(['exact', 'prefix'])
    } finally {
      await harness.dispose()
    }
  })

  it('引擎语义分发：exact 整路径优先；`enable`/`disable`/`connected` 不被 `<mcpId>` 贪掉', async () => {
    const harness = await startHarness()
    try {
      const at = (path: string): RegisteredRoute | undefined => engineRouteMatch(harness.routes, path)
      // 裸 `/connectors` 命中 D1 那条 exact，动态段走本面的 prefix —— 两条是**不同**的 handler。
      const plazaRoute = at(ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH)
      expect(plazaRoute?.kind).toBe('exact')
      expect(plazaRoute?.path).toBe(ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH)
      const statusRoute = at(STATUS_PATH)
      expect(statusRoute?.kind).toBe('prefix')
      expect(statusRoute?.path).toBe(ENTERPRISE_CONNECTOR_STATUS_PREFIX)
      expect(statusRoute?.handler).not.toBe(plazaRoute?.handler)
      // ★三个"词"各自命中自己的 exact 路由（引擎的判决，不是我们代码里判据的先后顺序）。
      for (const word of ['enable', 'disable', 'connected']) {
        const path = `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/${word}`
        expect(at(path)?.kind).toBe('exact')
        expect(at(path)?.path).toBe(path)
      }
      // 反例（为什么 prefix 不能带尾斜杠）：带尾斜杠的注册 path 连自己的子路径都不匹配。
      const trailing: RegisteredRoute[] = [{ kind: 'prefix', path: `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/`, handler: () => undefined }]
      expect(engineRouteMatch(trailing, STATUS_PATH)).toBeUndefined()
    } finally {
      await harness.dispose()
    }
  })

  it('真实 HTTP：D1 的 `/connectors` 仍回广场形状，`<mcpId>/status` 不被它吃掉', async () => {
    const harness = await startHarness()
    try {
      harness.servePlaza([{ id: 3, name: '默认空间' }])
      harness.serveDetail(connectorDetailRow())
      const plaza = await call(harness.origin, 'GET', ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH)
      expect(plaza.status).toBe(200)
      expect(keysOf(dataOf(plaza.text))).toEqual(['complete', 'connectors', 'spaces'])
      const status = await call(harness.origin, 'GET', STATUS_PATH)
      expect(status.status).toBe(200)
      expect(keysOf(dataOf(status.text))).toEqual([...ENTERPRISE_CONNECTOR_STATUS_KEYS].sort())
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ② `<mcpId>` 形状门禁 ══════════════════════════ */

describe('② `<mcpId>` 路径段必须是纯数字（复用内核那一把尺）', () => {
  it('非纯数字（含 `enable`/`disable`/`connected` 这类词）⇒ 400 且零内核调用', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      const bad = [
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/enable/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/disable/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/connected/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/12a/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/1e3/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/0134x/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/134.0/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/-134/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}//status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/%31%33%34/status`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/134`,
        `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/134/status/extra`,
      ]
      for (const path of bad) {
        const result = await call(harness.origin, 'GET', path)
        expect([path, result.status, codeOf(result.text)]).toEqual([path, 400, 'ENT_INVALID_REQUEST'])
      }
      expect(harness.counts).toEqual({ installs: 0, removes: 0, lists: 0 })
      expect(harness.platform.calls).toHaveLength(0)
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ③ 正文关闭键集 ══════════════════════════ */

describe('③ 正文关闭键集（多键/少键/非 JSON/content-type 不对 ⇒ 400 零内核）', () => {
  it('enable：恰好 `{mcpId}` 或 `{mcpId, confirmFingerprint}`', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      const cases: readonly (readonly [string, string | undefined, string | undefined])[] = [
        ['没有正文', undefined, undefined],
        ['不是 JSON', '{', 'application/json'],
        ['content-type 不是 application/json', JSON.stringify({ mcpId: MCP_ID }), 'text/plain'],
        ['空对象', JSON.stringify({}), 'application/json'],
        ['少了 mcpId', JSON.stringify({ confirmFingerprint: 'a'.repeat(64) }), 'application/json'],
        ['多了键', JSON.stringify({ mcpId: MCP_ID, extra: 1 }), 'application/json'],
        ['近似键名', JSON.stringify({ mcpId: MCP_ID, confirmFingerprints: 'a'.repeat(64) }), 'application/json'],
        ['confirmFingerprint 不是字符串', JSON.stringify({ mcpId: MCP_ID, confirmFingerprint: 42 }), 'application/json'],
        ['mcpId 是词', JSON.stringify({ mcpId: 'enable' }), 'application/json'],
        ['mcpId 不是安全正整数', JSON.stringify({ mcpId: 1.5 }), 'application/json'],
        ['mcpId 超出安全整数域', JSON.stringify({ mcpId: 1e21 }), 'application/json'],
        ['mcpId 是对象', JSON.stringify({ mcpId: {} }), 'application/json'],
        ['正文不是对象', JSON.stringify([MCP_ID]), 'application/json'],
      ]
      for (const [label, body, contentType] of cases) {
        const result = await call(harness.origin, 'POST', ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, body, contentType)
        expect([label, result.status, codeOf(result.text)]).toEqual([label, 400, 'ENT_INVALID_REQUEST'])
      }
      expect(harness.counts).toEqual({ installs: 0, removes: 0, lists: 0 })
      expect(harness.platform.calls).toHaveLength(0)
    } finally {
      await harness.dispose()
    }
  })

  it('disable：关闭键集恰好 `{mcpId}`（`confirmFingerprint` 在这一面没有语义）', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      const cases: readonly (readonly [string, string | undefined])[] = [
        ['空对象', JSON.stringify({})],
        ['多了 confirmFingerprint', JSON.stringify({ mcpId: MCP_ID, confirmFingerprint: 'a'.repeat(64) })],
        ['少了 mcpId', JSON.stringify({ confirmFingerprint: 'a'.repeat(64) })],
        ['不是 JSON', '{'],
      ]
      for (const [label, body] of cases) {
        const result = await call(harness.origin, 'POST', ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, body, 'application/json')
        expect([label, result.status, codeOf(result.text)]).toEqual([label, 400, 'ENT_INVALID_REQUEST'])
      }
      expect(harness.counts).toEqual({ installs: 0, removes: 0, lists: 0 })
      expect(harness.platform.calls).toHaveLength(0)
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ④ 405 + Allow ══════════════════════════ */

describe('④ 方法错配 ⇒ 405 + `Allow`（零副作用）', () => {
  it('四格各一次', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      const grid: readonly (readonly [string, string, string])[] = [
        ['GET', ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, 'POST'],
        ['GET', ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, 'POST'],
        ['POST', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH, 'GET'],
        ['POST', STATUS_PATH, 'GET'],
        ['PUT', STATUS_PATH, 'GET'],
        // D1 那条一字未改：POST 到裸路径仍是它自己的 405 + `Allow: GET`。
        ['POST', ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH, 'GET'],
      ]
      for (const [method, path, allow] of grid) {
        const result = await call(harness.origin, method, path)
        expect([method, path, result.status, result.allow, codeOf(result.text)]).toEqual([method, path, 405, allow, 'ENT_INVALID_REQUEST'])
      }
      expect(harness.counts).toEqual({ installs: 0, removes: 0, lists: 0 })
      expect(harness.platform.calls).toHaveLength(0)
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ⑤ 脱敏反向锁 ══════════════════════════ */

describe('⑤ 脱敏反向锁：三份响应正文都不含凭据面/宿主路径/patch 面', () => {
  /** 一份**故意装满危险面**的平台行：URL 内嵌凭据 + Authorization/自定义头 + 真 token。 */
  function dangerousRow(): Record<string, unknown> {
    return connectorDetailRow({
      mcpConfig: {
        serverConfig: JSON.stringify({
          mcpServers: {
            [SERVER_NAME]: {
              url: `https://svc:${TOKEN}@mcp.qixin.example/mcp`,
              headers: { Authorization: `Bearer ${TOKEN}`, 'X-Api-Key': `${TOKEN}-key` },
            },
          },
        }),
      },
    })
  }

  it('status / enable / disable 三份正文逐字 grep 不到任何探针，且键集关闭', async () => {
    const harness = await startHarness()
    try {
      const row = dangerousRow()
      harness.serveDetail(row)
      const fingerprint = confirmFor(row)
      const status = await call(harness.origin, 'GET', STATUS_PATH)
      const enabled = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID, confirmFingerprint: fingerprint })
      const disabled = await post(harness.origin, ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, { mcpId: MCP_ID })
      expect([status.status, enabled.status, disabled.status]).toEqual([200, 200, 200])

      for (const [label, text] of [['status', status.text], ['enable', enabled.text], ['disable', disabled.text]] as const) {
        for (const probe of [...FORBIDDEN_PROBES, harness.home, harness.platform.origin, connectorBundleRoot({ dshHome: harness.home })]) {
          expect([label, probe, text.includes(probe)]).toEqual([label, probe, false])
        }
      }

      // 出厂键集**恰好**是冻结契约那几格。
      expect(keysOf(dataOf(status.text))).toEqual([...ENTERPRISE_CONNECTOR_STATUS_KEYS].sort())
      expect(keysOf(dataOf(enabled.text))).toEqual([...ENTERPRISE_CONNECTOR_ENABLE_KEYS].sort())
      expect(keysOf(dataOf(disabled.text))).toEqual([...ENTERPRISE_CONNECTOR_DISABLE_KEYS].sort())
      expect(keysOf(disclosureOf(status.text))).toEqual([...ENTERPRISE_CONNECTOR_DISCLOSURE_KEYS].sort())
      expect(keysOf(connectionOf(status.text))).toEqual([...ENTERPRISE_CONNECTOR_CONNECTION_KEYS].sort())

      // ★出厂的两枚合法事实：`url` 已去内嵌凭据；`packageName` 逐字是内核那一枚（官方安装面包名、不含凭据）。
      expect(disclosureOf(status.text)['url']).toBe('https://mcp.qixin.example/mcp')
      expect(disclosureOf(status.text)['host']).toBe('mcp.qixin.example')
      expect(disclosureOf(status.text)['credentials']).toBe(true)
      expect(connectionOf(status.text)['packageName']).toBe(PACKAGE_NAME)
      expect(connectionOf(status.text)['mcpId']).toBe(134)
      expect(enabled.text).not.toContain(BUNDLE_MANIFEST)
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ⑥ `url` 去内嵌凭据（纯函数） ══════════════════════════ */

describe('⑥ `url` 去内嵌凭据（纯函数，逐格）', () => {
  it('有凭据摘掉、无凭据原样、畸形明确失败', () => {
    expect(stripConnectorUrlCredentials('https://u:p@h/x')).toBe('https://h/x')
    expect(stripConnectorUrlCredentials('https://u@h/x')).toBe('https://h/x')
    expect(stripConnectorUrlCredentials('http://u:p@h:8443/x?q=1#f')).toBe('http://h:8443/x?q=1#f')
    expect(stripConnectorUrlCredentials('https://u%40x:p%3Aw@h/x')).toBe('https://h/x')
    // ★无凭据**逐字原样**（绝不顺手做 `new URL().toString()` 那种规范化：`https://h` 会变成 `https://h/`）。
    expect(stripConnectorUrlCredentials('https://h/x')).toBe('https://h/x')
    expect(stripConnectorUrlCredentials('https://h')).toBe('https://h')
    expect(stripConnectorUrlCredentials('http://127.0.0.1:9/mcp?q=1')).toBe('http://127.0.0.1:9/mcp?q=1')
    for (const bad of ['', 'not a url', '/relative/path', 'ftp://u:p@h/x', 'wss://u:p@h/x', 'https://']) {
      expect(() => stripConnectorUrlCredentials(bad)).toThrow(EnterpriseConnectorEnableError)
    }
  })

  it('披露投影：畸形/缺席/多余键一律明确失败（不 `as`、不静默补默认）', () => {
    expect(projectConnectorDisclosure(DISCLOSURE)).toEqual({ ...DISCLOSURE, mcpId: 134 })
    expect(() => projectConnectorDisclosure(undefined)).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorDisclosure({ ...DISCLOSURE, url: 'not a url' })).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorDisclosure({ ...DISCLOSURE, extra: 1 })).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorDisclosure({ ...DISCLOSURE, host: '' })).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorDisclosure({ ...DISCLOSURE, mcpId: 'zzz' })).toThrow(EnterpriseConnectorEnableError)
    // ★18 位十进制可以超出 `2^53-1`：宁可明确失败，也不发一个已经丢精度的数字。
    expect(() => projectConnectorDisclosure({ ...DISCLOSURE, mcpId: '999999999999999999' })).toThrow(EnterpriseConnectorEnableError)
    // ★`credentials` 不做真值性转换。
    expect(() => projectConnectorDisclosure({ ...DISCLOSURE, credentials: 'yes' })).toThrow(EnterpriseConnectorEnableError)
    const failure = (() => {
      try {
        projectConnectorDisclosure({ ...DISCLOSURE, url: 'not a url' })
        return undefined
      } catch (error) {
        return error as EnterpriseConnectorEnableError
      }
    })()
    expect(failure?.code).toBe('ENT_CONNECTOR_STATE_INVALID')
  })

  it('结果投影：畸形结果/缺席两格明确失败；`alreadyAbsent` 原样', () => {
    const connection = { mcpId: MCP_ID, packageName: PACKAGE_NAME, installed: true, enabled: true, connected: true }
    expect(projectConnectorEnableResult({ connection, fingerprint: 'f'.repeat(64), alreadyInstalled: true }))
      .toEqual({ connection: { ...connection, mcpId: 134 }, fingerprint: 'f'.repeat(64), alreadyInstalled: true })
    expect(projectConnectorDisableResult({ connection, alreadyAbsent: true }))
      .toEqual({ connection: { ...connection, mcpId: 134 }, alreadyAbsent: true })
    expect(() => projectConnectorEnableResult(undefined)).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorEnableResult({ connection, fingerprint: 'f'.repeat(64) })).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorEnableResult({ connection, fingerprint: '', alreadyInstalled: false })).toThrow(EnterpriseConnectorEnableError)
    expect(() => projectConnectorDisableResult({ connection: { ...connection, installed: 1 }, alreadyAbsent: true }))
      .toThrow(EnterpriseConnectorEnableError)
  })
})

/* ══════════════════════════ ⑦ 授权两枚码原样透出 ══════════════════════════ */

describe('⑦ 授权闸门的两枚码原样透出（403/409，且零落盘零安装）', () => {
  it('从没确认过 ⇒ 403 + ENT_CONNECTOR_AUTHORIZATION_REQUIRED', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      const result = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID })
      expect(result.status).toBe(CONNECTOR_CODE_STATUS.ENT_CONNECTOR_AUTHORIZATION_REQUIRED)
      expect(codeOf(result.text)).toBe('ENT_CONNECTOR_AUTHORIZATION_REQUIRED')
      expect(harness.counts.installs).toBe(0)
      expect(await exists(join(connectorBundleRoot({ dshHome: harness.home }), MCP_ID))).toBe(false)
      expect(await readConnectorAuthorizations({ dshHome: harness.home })).toEqual([])
    } finally {
      await harness.dispose()
    }
  })

  it('指纹对不上 ⇒ 409 + ENT_CONNECTOR_AUTHORIZATION_STALE（不吞不换）', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      const result = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, {
        mcpId: MCP_ID,
        confirmFingerprint: 'f'.repeat(64),
      })
      expect(result.status).toBe(CONNECTOR_CODE_STATUS.ENT_CONNECTOR_AUTHORIZATION_STALE)
      expect(codeOf(result.text)).toBe('ENT_CONNECTOR_AUTHORIZATION_STALE')
      expect(harness.counts.installs).toBe(0)
      expect(await exists(join(connectorBundleRoot({ dshHome: harness.home }), MCP_ID))).toBe(false)
      expect(await readConnectorAuthorizations({ dshHome: harness.home })).toEqual([])
    } finally {
      await harness.dispose()
    }
  })

  it('status 出的指纹就是 enable 校验的那一枚；确认一次之后不交指纹也能过（幂等如实）', async () => {
    const harness = await startHarness()
    try {
      const row = connectorDetailRow()
      harness.serveDetail(row)
      const status = await call(harness.origin, 'GET', STATUS_PATH)
      expect(disclosureOf(status.text)['url']).toBe(DISCLOSURE.url)
      expect(dataOf(status.text)['fingerprint']).toBe(confirmFor(row))
      expect(connectionOf(status.text)['connected']).toBe(false)

      const first = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, {
        mcpId: MCP_ID,
        confirmFingerprint: dataOf(status.text)['fingerprint'],
      })
      expect(first.status).toBe(200)
      expect(dataOf(first.text)['alreadyInstalled']).toBe(false)
      expect(connectionOf(first.text)).toEqual({
        mcpId: 134,
        packageName: PACKAGE_NAME,
        installed: true,
        enabled: true,
        connected: true,
      })

      // 同一 mcpId 再启用：本机已确认过**同一份**披露 ⇒ 不重新打扰员工，且如实说「本来就已经装好」。
      const second = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID })
      expect(second.status).toBe(200)
      expect(dataOf(second.text)['alreadyInstalled']).toBe(true)
      expect(harness.counts.installs).toBe(1)

      // 断开：官方 `removeBundle` 一次，回 `alreadyAbsent:false`；再断开 ⇒ `alreadyAbsent:true`（本机不记账）。
      const off = await post(harness.origin, ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, { mcpId: MCP_ID })
      expect(off.status).toBe(200)
      expect(dataOf(off.text)['alreadyAbsent']).toBe(false)
      const offAgain = await post(harness.origin, ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, { mcpId: MCP_ID })
      expect(offAgain.status).toBe(200)
      expect(dataOf(offAgain.text)['alreadyAbsent']).toBe(true)
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ⑧ 内核 11 枚码 → 唯一那张表 ══════════════════════════ */

describe('⑧ 内核 11 枚码逐枚走唯一那张表', () => {
  it('表里这 11 枚码都在（反向锁：防将来被静默删掉），且逐枚状态与裁决一致', async () => {
    const table = await readFile(new URL('../../platform-client/src/local-api.ts', import.meta.url), 'utf8')
    for (const code of KERNEL_CODES) {
      const error = new EnterpriseConnectorEnableError(code, 'probe', 'config')
      expect([code, enterpriseLocalErrorStatus(error)]).toEqual([code, CONNECTOR_CODE_STATUS[code]])
      // ★反向锁：这枚码**逐字**出现在唯一那张表里（不是靠表尾默认兜住的）。
      expect([code, table.includes(`'${code}'`)]).toEqual([code, true])
    }
    expect(KERNEL_CODES).toHaveLength(11)
  })

  it('失败投影逐枚：状态走表、码原样（400 那枚归 ENT_INVALID_REQUEST）', () => {
    const steps: readonly EnterpriseConnectorEnableRouteStep[] = ['status-failed', 'enable-failed', 'disable-failed', 'connected-failed']
    for (const code of KERNEL_CODES) {
      for (const step of steps) {
        const error = new EnterpriseConnectorEnableError(code, 'probe', 'config')
        const failure = projectConnectorEnableFailure(error, step)
        expect([code, step, failure.status, failure.code, failure.step])
          .toEqual([code, step, enterpriseLocalErrorStatus(error), CONNECTOR_CODE_STATUS[code] === 400 ? 'ENT_INVALID_REQUEST' : code, step])
      }
    }
    // 形状类失败（无码）⇒ 400 + `ENT_INVALID_REQUEST`；正文超限（RangeError）⇒ 413（与 platform-client 同判）。
    expect(projectConnectorEnableFailure(new TypeError('x'), 'status-failed'))
      .toEqual({ status: 400, code: 'ENT_INVALID_REQUEST', step: 'status-failed' })
    expect(projectConnectorEnableFailure(new RangeError('x'), 'disable-failed').status).toBe(413)
  })

  it('真实 HTTP 上逐码（400/403/409/502/503 五类，含进行中那一枚）', async () => {
    // 400：正文字段形状（内核那枚 ENT_INVALID_REQUEST）
    {
      const harness = await startHarness()
      try {
        harness.serveDetail(connectorDetailRow())
        const result = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: 'enable' })
        expect([result.status, codeOf(result.text)]).toEqual([400, 'ENT_INVALID_REQUEST'])
      } finally {
        await harness.dispose()
      }
    }
    // 403：从没确认过（上面 ⑦ 已锁，这里只锁状态走表）
    {
      const harness = await startHarness()
      try {
        harness.serveDetail(connectorDetailRow())
        const result = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID })
        expect(result.status).toBe(enterpriseLocalErrorStatus(new EnterpriseConnectorEnableError('ENT_CONNECTOR_AUTHORIZATION_REQUIRED', 'probe', 'authorization-read')))
      } finally {
        await harness.dispose()
      }
    }
    // 502：平台答了我们读不懂的东西（`serverConfig` 不是 JSON）
    {
      const harness = await startHarness()
      try {
        harness.serveDetail(connectorDetailRow({ mcpConfig: { serverConfig: 'not json' } }))
        const result = await call(harness.origin, 'GET', STATUS_PATH)
        expect([result.status, codeOf(result.text)]).toEqual([502, 'ENT_CONNECTOR_CONFIG_INVALID'])
      } finally {
        await harness.dispose()
      }
    }
    // 503：本机状态读不懂（官方清单不是一张表）
    {
      const harness = await startHarness()
      try {
        harness.serveDetail(connectorDetailRow())
        harness.official.listResult = 'not an array'
        const result = await call(harness.origin, 'GET', STATUS_PATH)
        expect([result.status, codeOf(result.text)]).toEqual([503, 'ENT_CONNECTOR_STATE_INVALID'])
      } finally {
        await harness.dispose()
      }
    }
    // 503：官方安装面抛错（用合法指纹先把授权闸门过掉）
    {
      const harness = await startHarness()
      try {
        const row = connectorDetailRow()
        harness.serveDetail(row)
        harness.official.installError = new Error('boom')
        const result = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID, confirmFingerprint: confirmFor(row) })
        expect([result.status, codeOf(result.text)]).toEqual([503, 'ENT_CONNECTOR_INSTALL_FAILED'])
      } finally {
        await harness.dispose()
      }
    }
    // 409：官方取消了这次安装（与 `ENT_PLUGIN_INSTALL_CANCELLED` 同判）
    {
      const harness = await startHarness()
      try {
        const row = connectorDetailRow()
        harness.serveDetail(row)
        harness.official.installResult = appliedResult(PACKAGE_NAME, 'cancelled')
        const result = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID, confirmFingerprint: confirmFor(row) })
        expect([result.status, codeOf(result.text)]).toEqual([409, 'ENT_CONNECTOR_INSTALL_CANCELLED'])
      } finally {
        await harness.dispose()
      }
    }
    // 503：官方卸载失败 / 409：同一枚连接器正在装（`inFlight`）
    {
      const harness = await startHarness()
      try {
        const row = connectorDetailRow()
        harness.serveDetail(row)
        harness.official.removeResult = appliedResult(PACKAGE_NAME, 'failed')
        harness.official.bundles = [{ name: PACKAGE_NAME, installed: true, enabled: true }]
        const off = await post(harness.origin, ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, { mcpId: MCP_ID })
        expect([off.status, codeOf(off.text)]).toEqual([503, 'ENT_CONNECTOR_UNINSTALL_FAILED'])
      } finally {
        await harness.dispose()
      }
    }
    {
      const harness = await startHarness()
      try {
        const row = connectorDetailRow()
        harness.serveDetail(row)
        let release: (() => void) | undefined
        harness.official.installGate = new Promise<void>((resolve) => { release = resolve })
        const first = post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID, confirmFingerprint: confirmFor(row) })
        for (let i = 0; i < 200 && harness.official.installs.length === 0; i += 1) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
        expect(harness.official.installs).toHaveLength(1)
        const during = await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID, confirmFingerprint: confirmFor(row) })
        expect([during.status, codeOf(during.text)]).toEqual([409, 'ENT_CONNECTOR_INSTALL_IN_PROGRESS'])
        release?.()
        expect((await first).status).toBe(200)
      } finally {
        await harness.dispose()
      }
    }
  })

  it('平台读面的受控码原样上抛、无码错折成「这次没读到」（服务层，与生产读面同形折叠）', async () => {
    const home = await connectorEnableTempHome()
    const official = createFakeOfficialManager()
    const logs: unknown[] = []
    const noCode = createEnterpriseConnectorEnableService({
      port: () => official.port,
      readPlatformJson: async () => { throw new Error('socket hang up') },
      dshHome: home,
      onError: (message, error) => { logs.push({ message, error }) },
    })
    const failed = await failOf(noCode.status(MCP_ID))
    expect([failed.code, failed.step]).toEqual(['ENT_CONNECTOR_CONFIG_UNAVAILABLE', 'platform-read'])
    const controlled = createEnterpriseConnectorEnableService({
      port: () => official.port,
      readPlatformJson: async () => { throw Object.assign(new Error('nope'), { code: 'ENT_AUTH_REQUIRED' }) },
      dshHome: home,
    })
    // ★受控码**原样**上抛：没登录时该说"请先登录"，绝不折成"本机这块暂时不可用"。
    expect((await failOf(controlled.status(MCP_ID))).code).toBe('ENT_AUTH_REQUIRED')
  })
})

/* ══════════════════════════ ⑧b 「已连接的」盘点 ══════════════════════════ */

describe('⑧b `GET /connectors/connected`：真源是官方清单，语义复用内核同一枚纯判据', () => {
  it('按本族包名筛、只列已装、形状不对的不入列 + `complete:false`', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      harness.serveDetail(connectorDetailRow({ id: 900, name: '营销通MCP' }), '900')
      harness.official.bundles = [
        { name: PACKAGE_NAME, installed: true, enabled: true },
        { name: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}900`, installed: true, enabled: false },
        { name: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}901`, installed: false, enabled: true },
        { name: '@local/some-other-bundle', installed: true, enabled: true },
        { name: '@deepseek-ai/dsh-mcp-client', installed: true, enabled: true },
        { name: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}not-a-number`, installed: true, enabled: true },
      ]
      const result = await call(harness.origin, 'GET', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH)
      expect(result.status).toBe(200)
      const data = dataOf(result.text)
      expect(keysOf(data)).toEqual([...ENTERPRISE_CONNECTOR_CONNECTED_KEYS].sort())
      expect(data['complete']).toBe(false)
      const list = data['connected']
      expect(Array.isArray(list)).toBe(true)
      expect((list as unknown[]).map(item => recordOf(item)['mcpId'])).toEqual([134, 900])
      // ★装了但没启用 ⇒ 在列（那一格是"装上了"）、`connected:false`；没装的**不入列**。
      expect(recordOf((list as unknown[])[1])).toEqual({
        mcpId: 900,
        packageName: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}900`,
        installed: true,
        enabled: false,
        connected: false,
      })
      // ★跨路由一致性：同一条官方状态经 `/status`（内核 `connection()`）与经本盘点给出**逐字相同**的事实。
      for (const id of [MCP_ID, '900']) {
        const status = await call(harness.origin, 'GET', `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/${id}/status`)
        expect(connectionOf(status.text)).toEqual(recordOf((list as unknown[]).find(item => recordOf(item)['mcpId'] === Number(id))))
      }
      // ★形状丢弃如实留痕（不入列、也不折成"没连接"）。
      expect(harness.logs.some(entry => entry.message.includes('step=connected-shape'))).toBe(true)
    } finally {
      await harness.dispose()
    }
  })

  it('本族形状全对 ⇒ `complete:true`（别人的 bundle 不算漏报）', async () => {
    const harness = await startHarness()
    try {
      harness.official.bundles = [
        { name: PACKAGE_NAME, installed: true, enabled: true },
        { name: '@local/some-other-bundle', installed: true, enabled: true },
      ]
      const result = await call(harness.origin, 'GET', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH)
      const data = dataOf(result.text)
      expect(data['complete']).toBe(true)
      expect((data['connected'] as unknown[])).toHaveLength(1)
      expect(harness.logs.some(entry => entry.message.includes('step=connected-shape'))).toBe(false)
      // 官方清单一次都没读成？（正常恰好一次，且没有重复打点）
      expect(harness.counts.lists).toBe(1)
    } finally {
      await harness.dispose()
    }
  })

  it('官方清单读不到/形状不对 ⇒ 明确失败，绝不静默回空列表', async () => {
    {
      const harness = await startHarness()
      try {
        harness.official.listError = new Error('boom')
        const result = await call(harness.origin, 'GET', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH)
        expect([result.status, codeOf(result.text)]).toEqual([503, 'ENT_CONNECTOR_STATE_INVALID'])
      } finally {
        await harness.dispose()
      }
    }
    {
      const harness = await startHarness()
      try {
        harness.official.listResult = 'not an array'
        const result = await call(harness.origin, 'GET', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH)
        expect([result.status, codeOf(result.text)]).toEqual([503, 'ENT_CONNECTOR_STATE_INVALID'])
      } finally {
        await harness.dispose()
      }
    }
  })

  it('纯投影：非本族包名与本族畸形包名分别「忽略」与「如实丢弃」', () => {
    const projection = projectConnectorConnections([
      { name: PACKAGE_NAME, installed: true, enabled: true },
      { name: '@local/other', installed: true, enabled: true },
      { name: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}abc`, installed: true, enabled: true },
      { name: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}900`, installed: false, enabled: true },
    ])
    expect(projection.dropped).toBe(1)
    expect(projection.connections).toEqual([{
      mcpId: 134,
      packageName: PACKAGE_NAME,
      installed: true,
      enabled: true,
      connected: true,
    }])
  })
})

/* ══════════════════════════ ⑨ 端口缺席 ⇒ fail-closed ══════════════════════════ */

describe('⑨ 官方管理面缺席 ⇒ fail-closed（明确失败、不装、零落盘）', () => {
  it('四条路由都明确失败，且一个字节都不落盘', async () => {
    const harness = await startHarness({ available: false })
    try {
      const row = connectorDetailRow()
      harness.serveDetail(row)
      const expected = enterpriseLocalErrorStatus(new EnterpriseConnectorEnableError('ENT_CONNECTOR_STATE_INVALID', 'probe', 'official-state'))
      const grid: readonly (readonly [string, string, string | undefined])[] = [
        ['GET', STATUS_PATH, undefined],
        ['POST', ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, JSON.stringify({ mcpId: MCP_ID, confirmFingerprint: confirmFor(row) })],
        ['POST', ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, JSON.stringify({ mcpId: MCP_ID })],
        ['GET', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH, undefined],
      ]
      for (const [method, path, body] of grid) {
        const result = await call(harness.origin, method, path, body, body === undefined ? undefined : 'application/json')
        expect([method, path, result.status, codeOf(result.text)])
          .toEqual([method, path, expected, 'ENT_CONNECTOR_STATE_INVALID'])
      }
      // ★fail-closed：官方安装面一次都没被调、盘上零痕迹（连授权记录都没写）。
      expect(harness.official.installs).toHaveLength(0)
      expect(harness.official.removes).toHaveLength(0)
      expect(await exists(join(connectorBundleRoot({ dshHome: harness.home }), MCP_ID))).toBe(false)
      expect(await readConnectorAuthorizations({ dshHome: harness.home })).toEqual([])
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ⑨b 判定点日志 ══════════════════════════ */

describe('⑨b 判定点经 `onError` 进 Host 日志（`step=` 分得开）', () => {
  it('四条路由各自的 step + 内核自己的 kernel-step', async () => {
    const harness = await startHarness()
    try {
      harness.serveDetail(connectorDetailRow())
      // status-failed（形状）
      await call(harness.origin, 'GET', `${ENTERPRISE_CONNECTOR_LOCAL_PREFIX}/12a/status`)
      // enable-failed（授权）+ 内核判定点
      await post(harness.origin, ENTERPRISE_CONNECTOR_ENABLE_LOCAL_PATH, { mcpId: MCP_ID })
      // disable-failed（官方卸载失败）
      harness.official.bundles = [{ name: PACKAGE_NAME, installed: true, enabled: true }]
      harness.official.removeResult = appliedResult(PACKAGE_NAME, 'failed')
      await post(harness.origin, ENTERPRISE_CONNECTOR_DISABLE_LOCAL_PATH, { mcpId: MCP_ID })
      // connected-failed（官方清单读不到）
      harness.official.listError = new Error('boom')
      await call(harness.origin, 'GET', ENTERPRISE_CONNECTOR_CONNECTED_LOCAL_PATH)

      const messages = harness.logs.map(entry => entry.message)
      expect(messages.some(message => message.includes('step=status-failed'))).toBe(true)
      expect(messages.some(message => message.includes('step=enable-failed') && message.includes('kernel-step=authorization-read'))).toBe(true)
      expect(messages.some(message => message.includes('step=disable-failed') && message.includes('kernel-step=uninstall'))).toBe(true)
      expect(messages.some(message => message.includes('step=connected-failed'))).toBe(true)
      // 原始 error 也一并交出去（不改响应语义，只给排障的人）。
      expect(harness.logs.some(entry => entry.error !== undefined)).toBe(true)
    } finally {
      await harness.dispose()
    }
  })
})

/* ══════════════════════════ ⑩ 源码级反锁 ══════════════════════════ */

describe('⑩ 源码级反锁', () => {
  it('新增两叶：无 `exec`/`spawn`/动态 import、不新增 HTTP 客户端', async () => {
    for (const name of ['connector-enable-route.ts', 'connector-enable-service.ts']) {
      const source = await readFile(srcFile(name), 'utf8')
      expect([name, source.includes('child_process')]).toEqual([name, false])
      expect([name, /\bexec(File|Sync)?\s*\(/.test(source)]).toEqual([name, false])
      expect([name, /\bspawn(Sync)?\s*\(/.test(source)]).toEqual([name, false])
      expect([name, /\bimport\s*\(/.test(source)]).toEqual([name, false])
      expect([name, source.includes('fetch(')]).toEqual([name, false])
    }
  })

  it('本面不另立第二张「码 → 状态」表：两叶里除 `400`/`405` 外没有别的 4xx/5xx 字面量', async () => {
    for (const name of ['connector-enable-route.ts', 'connector-enable-service.ts']) {
      const code = stripComments(await readFile(srcFile(name), 'utf8'))
      const literals = [...code.matchAll(/\b([45][0-9]{2})\b/g)].map(match => match[1] as string)
      // ★允许的那两枚都有明确出处，且**都不是**"码 → 状态"的映射：
      //   · `405` = 方法不符（`methodNotAllowed`，与全仓本机路由同一处写法）；
      //   · `400` = 响应体里那枚兜底码的判据（`status === 400 ? 'ENT_INVALID_REQUEST' : code`，
      //     与 `skill-third-party-route.ts` / platform-client 的 `dispatchPresetAction` **逐字同款**）——
      //     状态本身仍只来自 `enterpriseLocalErrorStatus`。
      // ⇒ 403/409/502/503 这类**语义状态**在源文件里一个字都没有：谁把它们写死，这条就红。
      for (const literal of new Set(literals)) {
        expect([name, literal, ['400', '405'].includes(literal)]).toEqual([name, literal, true])
      }
    }
  })

  it('`index.ts`：`createNuwaxSessionHolder(` 仍恰好一处，且新接线挂在同处（同一个 escReadPort 的宿主内部读面）', async () => {
    const source = await readFile(srcFile('index.ts'), 'utf8')
    expect(source.match(/createNuwaxSessionHolder\(/g) ?? []).toHaveLength(1)
    expect(source).toContain('registerEnterpriseConnectorEnableRoutes(ctx.webServer')
    expect(source).toContain("'enterpriseConnectorEnable.routes'")
    // ★端口每次调用现场解引用（官方 plugin-manager 可能晚于本插件就绪）
    expect(source).toContain('connectorEnablePortFromContext(ctx)')
    // ★不新造第二份取数入口：平台读面就是 D0/D1 那一份
    expect(source).toContain('readPlatformJson: path => readEnterpriseEscHostJson(escReadPort, path)')
    // ★内核实例只造一次（`inFlight` 那本账活在实例里），不是每次调用新造
    expect(source.match(/createEnterpriseConnectorEnableService\(/g) ?? []).toHaveLength(1)
  })

  it('内核 11 枚码的**定义处**仍只在内核文件里（P0 那套 `src/connector/*` 是另一个族、另有自己的边界）', async () => {
    const kernel = await readFile(srcFile('connector-enable.ts'), 'utf8')
    const union = /export type EnterpriseConnectorEnableErrorCode =([\s\S]*?)\n\n/.exec(kernel)
    expect(union).not.toBeNull()
    const members = [...(union?.[1] ?? '').matchAll(/'([A-Z0-9_]+)'/g)].map(match => match[1] as string)
    expect(members.slice().sort()).toEqual(KERNEL_CODES.slice().sort())
    const stepUnion = /export type EnterpriseConnectorEnableStep =([\s\S]*?)\n\n/.exec(kernel)
    expect(stepUnion).not.toBeNull()

    for (const name of (await readdir(new URL('../src/', import.meta.url))).filter(entry => entry.endsWith('.ts'))) {
      if (name === 'connector-enable.ts') continue
      const source = await readFile(srcFile(name), 'utf8')
      expect([name, /type\s+EnterpriseConnectorEnableErrorCode\b/.test(source)]).toEqual([name, false])
      expect([name, /type\s+EnterpriseConnectorEnableStep\b/.test(source)]).toEqual([name, false])
      // 也不许把 11 枚码抄成第二个封闭清单（数组 / 映射 / 第二张表）。
      const listed = KERNEL_CODES.filter(code => source.includes(`'${code}'`)).length
      expect([name, listed < KERNEL_CODES.length]).toEqual([name, true])
    }
  })
})
