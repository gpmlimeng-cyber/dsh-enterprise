/**
 * [INPUT]: 依赖 node:http（真服务器）/ node:fs/promises / node:os / node:path，以及 `../src/plugin-install-port.js` 的官方结果投影
 * [OUTPUT]: 对外提供三件测试支撑——`startFakePlatform`/`disposeFakePlatforms`（**真 HTTP** 假平台：一枚 `node:http` 服务器 + 它记下的每次调用与票据）、`createFakeOfficialManager`（官方管理面 double：三方法 + 调用记录 + 挂起闸门；`installBundle` 会**读** spec 目录里的 `package.json` 并按官方契约核形状）、`connectorEnableTempHome`/`disposeConnectorEnableHomes`（临时 dshHome）
 * [POS]: tests 下的 D2 连接器启用测试支撑（**不是产品代码**：`tsconfig.json` 的 `include` 只收 `src/**`，故它只被 vitest 转译、不进 bundle 产物）。三件支撑各自对着一条纪律：假平台是**真 HTTP**（本面「取配置」那条路要经真取数入口打真网络，不是把 `Response` 手搓进内存）；官方管理面是**有形状闸门**的假件（读得出 spec 里那份 `package.json` 才算一份 bundle）；dshHome 按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { projectOfficialResult, type OfficialBundleApplication } from '../src/plugin-install-port.js'
import {
  projectOfficialBundleSummaries,
  type ConnectorEnablePort,
  type ConnectorOfficialBundleSummary,
} from '../src/connector-enable.js'

/* ─────────────── 真 HTTP 假平台 ─────────────── */

/** 假平台收到的一次请求（票据从 `cookie` 头里取出来——宿主内部读面必须带着它）。 */
export interface FakePlatformCall {
  readonly method: string
  readonly path: string
  readonly ticket: string | undefined
}

/** 一次平台的响应（`undefined` ⇒ 服务器回 404，用于「这条路径不该被打」的反例）。 */
export interface FakePlatformReply {
  readonly status?: number
  readonly body: unknown
  /** 额外响应头（登录那条路要用 `set-cookie` 把票据发回来）。 */
  readonly headers?: Readonly<Record<string, string>>
}

export interface FakePlatform {
  /** `http://127.0.0.1:<port>`（**回环 + 明文 HTTP**：`normalizeAccountOrigin` 只放行回环的 http）。 */
  readonly origin: string
  readonly calls: FakePlatformCall[]
  /** 平台反应：由测试按路径给；未设置的路径一律 404。 */
  respond: (path: string, call: FakePlatformCall) => FakePlatformReply | undefined
  countOf(path: string): number
}

const platformServers: Server[] = []

/** 起一台真 HTTP 假平台（每个用例一台，端口由系统分配）。 */
export async function startFakePlatform(): Promise<FakePlatform> {
  const calls: FakePlatformCall[] = []
  const platform = {
    origin: 'http://127.0.0.1:0',
    calls,
    respond: (() => undefined) as FakePlatform['respond'],
    countOf: (path: string) => calls.filter(call => call.path === path).length,
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const cookie = request.headers['cookie']
    const ticket = typeof cookie === 'string' ? /(?:^|;\s*)ticket=([^;]*)/.exec(cookie)?.[1] : undefined
    const call: FakePlatformCall = { method: request.method ?? '', path, ticket }
    calls.push(call)
    const reply = platform.respond(path, call)
    if (reply === undefined) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ code: '4040', message: 'not found', data: null }))
      return
    }
    response.writeHead(reply.status ?? 200, {
      'content-type': 'application/json',
      ...(reply.headers ?? {}),
    })
    response.end(JSON.stringify(reply.body))
  })
  platformServers.push(server)
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake platform did not bind a TCP port')
  platform.origin = `http://127.0.0.1:${String(address.port)}`
  return platform
}

/** 关掉本文件起过的全部假平台。 */
export async function disposeFakePlatforms(): Promise<void> {
  await Promise.all(platformServers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => { resolve() }) })))
}

/** 平台成功信封（带 `code` 一格：取配置的唯一信封判据就是「带 `code` 的对象」）。 */
export function platformEnvelope(body: unknown, status = 200): FakePlatformReply {
  return { status, body: { code: '0000', message: 'ok', data: body, success: true } }
}

/** 登录两跳的反应（票据经真 `set-cookie` 发回；`readSetCookies` 两条路都认）。 */
export function platformLoginReply(path: string, ticket: string): FakePlatformReply | undefined {
  if (path === '/api/user/passwordLogin') {
    return {
      body: { code: '0000', data: { token: 'jwt' } },
      headers: { 'set-cookie': `ticket=${ticket}; Max-Age=604800; HttpOnly` },
    }
  }
  if (path === '/api/user/getLoginInfo') {
    return { body: { code: '0000', data: { uid: 1_784_006_361, userName: '538565', nickName: '李猛', tenantId: 1 } } }
  }
  return undefined
}

/** 平台那枚「真 token」：反向锁（patch 文本里 grep 不到它）拿它当探针。 */
export const PLATFORM_TOKEN = 'connector-enable-token-9f3a1c7d2b'

/** 平台连接器详情行的形状（`analysis/connector-plaza-probe.md` §1 那 18 键里本面用到的几格）。 */
export function connectorDetailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 134,
    name: '启信慧眼MCP',
    serverName: 'qixinhuiyan-mcp',
    mcpConfig: {
      serverConfig: JSON.stringify({
        mcpServers: {
          'qixinhuiyan-mcp': {
            url: 'https://mcp.qixin.example/mcp',
            headers: { Authorization: `Bearer ${PLATFORM_TOKEN}` },
          },
        },
      }),
    },
    ...overrides,
  }
}

/* ─────────────── 官方管理面 double ─────────────── */

export interface FakeOfficialManager {
  readonly manager: {
    installBundle(spec: string, options?: unknown): Promise<unknown>
    removeBundle(name: string): Promise<unknown>
    listBundles(): Promise<unknown>
  }
  /** 端口（官方结果经 `projectOfficialResult` 投影，与生产那条路完全同形）。 */
  readonly port: ConnectorEnablePort
  readonly installs: { readonly spec: string, readonly options: unknown }[]
  readonly removes: string[]
  bundles: ConnectorOfficialBundleSummary[]
  installResult: OfficialBundleApplication
  removeResult: OfficialBundleApplication
  installError: unknown
  removeError: unknown
  /** 若设，`installBundle` 先等它 resolve 再返回（「进行中」用例）。 */
  installGate?: Promise<void>
  /** 若设，`listBundles` 原样回它（形状闸门用例：非数组 / 含畸形行）。 */
  listResult?: unknown
  listError?: unknown
}

/** 官方 `ChangeResult` 同形的成功结果。 */
export function appliedResult(
  target: string,
  application: OfficialBundleApplication['application'] = 'applied',
): OfficialBundleApplication {
  return { target, changed: true, application, stage: 'enable', enabled: true, warnings: [] }
}

/**
 * 官方管理面 double。
 *
 * ★它的 `installBundle` **不是**一个只会记一笔的桩：它按官方契约去 **读** spec 目录里的
 *   `package.json`，要求 `name` 是字符串、`dsh.bundle.patch` 在场，并据此登记「这条 bundle 装上了」。
 *   ⇒ 一份形状不对的合成物在这里就会红，而不是在真机上才发现官方装不了。
 */
export function createFakeOfficialManager(): FakeOfficialManager {
  const installs: { spec: string, options: unknown }[] = []
  const removes: string[] = []
  const fake: FakeOfficialManager = {
    installs,
    removes,
    bundles: [],
    installResult: appliedResult('@local/dsent-connector-134'),
    removeResult: appliedResult('@local/dsent-connector-134'),
    installError: undefined,
    removeError: undefined,
    manager: undefined as unknown as FakeOfficialManager['manager'],
    port: undefined as unknown as ConnectorEnablePort,
  }
  const manager = {
    async installBundle(spec: string, options?: unknown): Promise<unknown> {
      installs.push({ spec, options })
      if (fake.installGate !== undefined) await fake.installGate
      if (fake.installError !== undefined) throw fake.installError
      const manifest = JSON.parse(await readFile(join(spec, 'package.json'), 'utf8')) as Record<string, unknown>
      const dsh = manifest['dsh'] as { bundle?: { patch?: unknown } } | undefined
      if (typeof manifest['name'] !== 'string' || typeof dsh?.bundle?.patch !== 'string') {
        throw new Error('fake official manager: spec is not a configuration-only bundle')
      }
      if (fake.installResult.application !== 'failed' && fake.installResult.application !== 'cancelled') {
        fake.bundles = [
          ...fake.bundles.filter(item => item.name !== manifest['name']),
          { name: manifest['name'], installed: true, enabled: true },
        ]
      }
      return fake.installResult
    },
    async removeBundle(name: string): Promise<unknown> {
      removes.push(name)
      if (fake.removeError !== undefined) throw fake.removeError
      if (fake.removeResult.application !== 'failed' && fake.removeResult.application !== 'cancelled') {
        fake.bundles = fake.bundles.filter(item => item.name !== name)
      }
      return fake.removeResult
    },
    async listBundles(): Promise<unknown> {
      if (fake.listError !== undefined) throw fake.listError
      if (fake.listResult !== undefined) return fake.listResult
      return fake.bundles
    },
  }
  const port: ConnectorEnablePort = {
    async installBundle(spec, options) {
      return projectOfficialResult(spec, await manager.installBundle(spec, options))
    },
    async removeBundle(name) {
      return projectOfficialResult(name, await manager.removeBundle(name))
    },
    async listBundles() {
      // 与生产那条路**同形**：官方原值经本面的形状闸门投影（畸形 ⇒ 抛），不是直接把数组透出去。
      return projectOfficialBundleSummaries(await manager.listBundles())
    },
  }
  ;(fake as { manager: unknown }).manager = manager
  ;(fake as { port: unknown }).port = port
  return fake
}

/* ─────────────── 临时 dshHome ─────────────── */

const createdHomes: string[] = []

/** 造一份一次性临时 dshHome（`~/.sshwork` 下；本仓硬约束，绝不写 `/tmp`）。 */
export async function connectorEnableTempHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true, mode: 0o700 })
  const path = await mkdtemp(join(root, 'dshent-connector-enable-'))
  createdHomes.push(path)
  return path
}

/** 清掉本文件登记过的全部临时 dshHome。 */
export async function disposeConnectorEnableHomes(): Promise<void> {
  await Promise.all(createdHomes.splice(0).map(path => rm(path, { force: true, recursive: true })))
}
