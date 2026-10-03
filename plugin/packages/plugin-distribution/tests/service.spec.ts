/**
 * [INPUT]: 依赖 Cordis Context、真实临时状态/制品文件、签名 assignment、PROTECTED_ENTERPRISE_PACKAGES 信任锚，以及 fake 的 platform 与官方 pluginManager 端口、subprocess、inventory
 * [OUTPUT]: 验证默认无签名免公钥安装、显式验签阻断、版本操作/卸载耐久、授权复查、重启确认、撤回、核心保护、官方 application 三态（hot/restart-required/failed）如实透出、官方取消与失败原样保留，以及**全程不再起 `dsh plugin` 子进程**
 * [POS]: plugin-distribution 的完整状态机验收，模拟中心 revision 而不修改或替身化 Harness 源码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, generateKeyPairSync, sign, type KeyPairKeyObjectResult } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import type { SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { BootstrapSnapshot, EnterprisePlatformStatus } from '@dshent/platform-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalizeJson,
  EnterprisePluginDistributionService,
  ManagedPluginStore,
  PROTECTED_ENTERPRISE_PACKAGES,
  signatureManifest,
  type EnterprisePlatformPort,
  type ManagedPluginCancellation,
  type ManagedPluginChangeResult,
  type ManagedPluginInstallOptions,
  type ManagedPluginManagerPort,
  type PluginDistributionContext,
  type PluginInventoryPort,
  type RuntimePluginAssignment,
} from '../src/index.js'

const HARNESS_COMMIT = 'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e'
const REQUEST_ID = `req_${'1'.repeat(26)}`
const cleanups: (() => Promise<void>)[] = []

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()))
})

function assignment(
  pair: KeyPairKeyObjectResult,
  content: Buffer,
  options: {
    readonly id?: string
    readonly packageName?: string
    readonly version?: string
    readonly displayName?: string
    readonly desiredState?: 'INSTALLED' | 'ABSENT'
    readonly sha256?: string
  } = {},
): RuntimePluginAssignment {
  const value: RuntimePluginAssignment = {
    pluginVersionId: options.id ?? '880',
    packageName: options.packageName ?? '@example/dsh-code-review',
    version: options.version ?? '1.2.0',
    displayName: options.displayName ?? '@example/dsh-code-review',
    sizeBytes: content.byteLength,
    sha256: options.sha256 ?? createHash('sha256').update(content).digest('hex'),
    signatureBase64: `${'A'.repeat(86)}==`,
    compatibility: {
      harnessCommits: [HARNESS_COMMIT],
      enterpriseBundleRange: '>=0.1.0 <0.2.0',
      operatingSystems: ['darwin', 'linux', 'win32'],
    },
    downloadUrl: options.desiredState === 'ABSENT'
      ? null
      : `/enterprise/api/v1/plugins/versions/${options.id ?? '880'}/download`,
    required: true,
    desiredState: options.desiredState ?? 'INSTALLED',
  }
  return {
    ...value,
    signatureBase64: sign(null, Buffer.from(canonicalizeJson(signatureManifest(value))), pair.privateKey)
      .toString('base64'),
  }
}

function bootstrap(revision: number, assignments: RuntimePluginAssignment[]): BootstrapSnapshot {
  return {
    revision,
    user: { id: '10031', username: 'zhangsan', displayName: 'Zhang San', departmentId: '210' },
    device: {
      id: '90018', installationId: '4fbec6ac-05fb-4bc7-8457-709647d9fe76', status: 'ACTIVE',
    },
    models: [],
    quotas: [],
    plugins: { revision, assignments },
    sessionPolicy: { enabled: false, retentionDays: 90, maxBatchBytes: 1_048_576 },
  }
}

class FakePlatform implements EnterprisePlatformPort {
  readonly reports: Record<string, unknown>[] = []
  readonly listeners = new Set<(status: EnterprisePlatformStatus) => void>()
  statusValue: EnterprisePlatformStatus = {
    state: 'READY', bundleVersion: '0.1.0', platformUrl: 'https://enterprise.invalid',
    transport: 'webServer.register',
  }

  constructor(public snapshot: BootstrapSnapshot, readonly artifacts: ReadonlyMap<string, Buffer>) {}

  status(): EnterprisePlatformStatus { return this.statusValue }
  bootstrap(): BootstrapSnapshot { return structuredClone(this.snapshot) }
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  async request(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const path = input.toString()
    if (path === '/enterprise/api/v1/plugins/assignments') {
      return Response.json({ data: this.snapshot.plugins, requestId: REQUEST_ID })
    }
    if (path === '/enterprise/api/v1/plugins/inventory') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      this.reports.push(body)
      const items = body['items'] as unknown[]
      return Response.json({ data: { reported: items.length }, requestId: REQUEST_ID })
    }
    const artifact = this.artifacts.get(path)
    if (artifact === undefined) return new Response(null, { status: 404 })
    return new Response(artifact, { headers: { 'content-length': String(artifact.byteLength) } })
  }
  publish(snapshot: BootstrapSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener({ ...this.statusValue, revision: snapshot.revision })
  }
}

/**
 * 假的官方 `pluginManager` 端口：每次调用都记账，并可按测试脚本化结果。
 *
 * 默认 `install` 落 `restart-required`（官方对**已存在的依赖**永远给这一支，见 `lib/index.js:1795`），
 * 于是既有的「装完要重启」断言逐条不变；`applied`（hot）那一支由新增用例显式脚本化。
 */
interface FakeManagerOptions {
  readonly install?: (spec: string, options: ManagedPluginInstallOptions | undefined) => Promise<ManagedPluginChangeResult>
  readonly remove?: (name: string) => Promise<ManagedPluginChangeResult>
  readonly setEnabled?: (name: string, enabled: boolean) => Promise<ManagedPluginChangeResult>
  readonly cancel?: (requestId: string) => Promise<ManagedPluginCancellation>
  readonly wait?: (requestId: string) => Promise<ManagedPluginChangeResult | null>
}

interface FakeManager {
  readonly port: ManagedPluginManagerPort
  readonly installCalls: {
    readonly spec: string
    readonly enabled: boolean | undefined
    readonly requestId: string | undefined
  }[]
  readonly removeCalls: string[]
  /** 每一个启停请求的 `[包名, 方向]`；方向由用户拨的路径决定，不是我们折出来的。 */
  readonly setEnabledCalls: (readonly [string, boolean])[]
  readonly cancelCalls: string[]
  readonly waitCalls: string[]
}

function fakePluginManager(options: FakeManagerOptions = {}): FakeManager {
  const installCalls: FakeManager['installCalls'] = []
  const removeCalls: string[] = []
  const setEnabledCalls: FakeManager['setEnabledCalls'] = []
  const cancelCalls: string[] = []
  const waitCalls: string[] = []
  return {
    installCalls,
    removeCalls,
    setEnabledCalls,
    cancelCalls,
    waitCalls,
    port: {
      async installBundle(spec, installOptions) {
        installCalls.push({ spec, enabled: installOptions?.enabled, requestId: installOptions?.requestId })
        if (options.install !== undefined) return await options.install(spec, installOptions)
        return { target: spec, changed: true, application: 'restart-required' }
      },
      async removeBundle(name) {
        removeCalls.push(name)
        if (options.remove !== undefined) return await options.remove(name)
        return { target: name, changed: true, application: 'applied' }
      },
      async setBundleEnabled(name, enabled) {
        setEnabledCalls.push([name, enabled])
        if (options.setEnabled !== undefined) return await options.setEnabled(name, enabled)
        // 官方口径：非 hot 的 profile 变更一律 `restart-required`（`lib/index.js:2042`）。
        return { target: name, changed: true, application: 'restart-required', stage: 'enable', enabled }
      },
      async cancelInstall(requestId) {
        cancelCalls.push(requestId)
        if (options.cancel !== undefined) return await options.cancel(requestId)
        return { status: 'cancelled' }
      },
      async waitForInstall(requestId) {
        waitCalls.push(requestId)
        if (options.wait !== undefined) return await options.wait(requestId)
        return null
      },
    },
  }
}

/**
 * 旧的 CLI 子进程边界**已经不存在**，但假运行时仍被提供进 ctx：本文件所有用例都断言它一次都没被碰过
 * ——这就是「不再起 `dsh plugin` 子进程」的现场证据（服务连 `subprocess` 都不再注入）。
 */
function fakeSubprocess(exitCode = 0): {
  readonly runtime: SubprocessRuntime
  readonly specs: SubprocessSpawnSpec[]
} {
  const specs: SubprocessSpawnSpec[] = []
  const runtime = {
    resolveExecutable: vi.fn(async () => '/opt/dsh/bin/dsh'),
    spawn: vi.fn((spec: SubprocessSpawnSpec) => {
      specs.push(spec)
      return { done: Promise.resolve({ exitCode, signal: null }) }
    }),
  } as unknown as SubprocessRuntime
  return { runtime, specs }
}

function inventory(entries: { moduleName: string; enabled: boolean; fiberPhase: 'active' | 'failed' | null }[] = []): PluginInventoryPort {
  return {
    list: () => ({
      entries: entries.map((entry, index) => ({ entryId: `entry-${index}` as never, ...entry })),
    }),
  }
}

async function environment(options: {
  readonly platform: FakePlatform
  readonly subprocess?: ReturnType<typeof fakeSubprocess>
  readonly inventory?: PluginInventoryPort
  readonly dshHome?: string
  readonly runMarker?: string
  /** 官方安装面端口；`null` 表示**故意不接线**（服务缺席 ⇒ fail-closed），`undefined` 用默认假端口。 */
  readonly manager?: FakeManager | null
  readonly verifyPluginSignatures?: boolean
  /** `null` 表示"客户端映射表里没有本机引擎版本"，即故意不传 harnessCommit。 */
  readonly harnessCommit?: string | null
  readonly trustedPluginPublicKey?: string | null
  readonly store?: ManagedPluginStore
}): Promise<{
  readonly context: PluginDistributionContext
  readonly home: string
  readonly service: EnterprisePluginDistributionService
  readonly subprocess: ReturnType<typeof fakeSubprocess>
  readonly manager: FakeManager | undefined
  readonly close: () => Promise<void>
}> {
  const home = options.dshHome ?? await mkdtemp(join(tmpdir(), 'enterprise-plugin-service-'))
  const subprocess = options.subprocess ?? fakeSubprocess()
  const manager = options.manager === null ? undefined : options.manager ?? fakePluginManager()
  const ctx = new Context()
  ctx.reflect.provide('enterprisePlatform', options.platform as never)
  ctx.reflect.provide('subprocess', subprocess.runtime)
  ctx.reflect.provide('pluginInventory' as never, (options.inventory ?? inventory()) as never)
  const service = new EnterprisePluginDistributionService(ctx as unknown as PluginDistributionContext, {
    ...(options.verifyPluginSignatures === undefined ? {} : { verifyPluginSignatures: options.verifyPluginSignatures }),
    ...(options.trustedPluginPublicKey === null ? {} : {
      trustedPluginPublicKey: options.trustedPluginPublicKey
        ?? testKey.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    }),
    ...(options.harnessCommit === null ? {} : { harnessCommit: options.harnessCommit ?? HARNESS_COMMIT }),
    bundleVersion: '0.1.0',
    dshHome: home,
  }, {
    ...(manager === undefined ? {} : { pluginManager: manager.port }),
    ...(options.store === undefined ? {} : { store: options.store }),
    runMarker: options.runMarker ?? 'test-run',
  })
  let closed = false
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    await service.dispose()
    await ctx.fiber.dispose()
  }
  cleanups.push(async () => {
    await close()
    if (options.dshHome === undefined) await rm(home, { force: true, recursive: true })
  })
  return { context: ctx as unknown as PluginDistributionContext, home, service, subprocess, manager, close }
}

const testKey = generateKeyPairSync('ed25519')

describe('EnterprisePluginDistributionService', () => {
  it('reconciles, reports and uninstalls with an asynchronous Harness inventory', async () => {
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-async-inventory-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const desired = assignment(testKey, Buffer.from('installed managed bundle'))
    const store = new ManagedPluginStore(home)
    await store.write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: desired.packageName, version: desired.version, sha256: desired.sha256,
        enabled: true, desiredRevision: 1, desiredState: 'INSTALLED', state: 'RESTART_REQUIRED',
        lastErrorCode: null, restartMarker: 'previous-run',
      }],
    })
    const activeInventory = inventory([{
      moduleName: desired.packageName, enabled: true, fiberPhase: 'active',
    }])
    const asyncInventory: PluginInventoryPort = { list: async () => activeInventory.list() }
    const platform = new FakePlatform(bootstrap(2, [desired]), new Map())
    const env = await environment({ platform, dshHome: home, store, inventory: asyncInventory })

    await env.service.settled()

    expect(env.service.status().fatalErrorCode).toBeUndefined()
    expect(env.service.status().plugins[0]).toMatchObject({ state: 'ACTIVE', desiredRevision: 2 })
    expect(platform.reports.at(-1)).toMatchObject({
      items: [expect.objectContaining({ state: 'ACTIVE', loaderPhase: 'active' })],
    })
    expect(env.subprocess.specs).toHaveLength(0)

    platform.publish(bootstrap(3, [{ ...desired, desiredState: 'ABSENT', downloadUrl: null }]))
    await env.service.settled()
    expect(env.service.status().plugins[0]?.state).toBe('RESTART_REQUIRED')
    expect(env.manager?.removeCalls).toEqual([desired.packageName])
    expect(env.manager?.installCalls).toEqual([])
    await env.close()

    const restarted = await environment({
      platform: new FakePlatform(bootstrap(3, []), new Map()), dshHome: home, store,
      inventory: asyncInventory, runMarker: 'next-run',
    })
    await restarted.service.settled()
    expect(restarted.service.status().plugins[0]?.state).toBe('FAILED')
    await restarted.service.uninstall()
    expect(restarted.manager?.removeCalls).toEqual([desired.packageName, 'dshent-plugin'])
    expect(restarted.subprocess.specs).toEqual([])
  })

  it('stops cleanly when managed state cannot be loaded', async () => {
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-invalid-state-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const store = new ManagedPluginStore(home)
    vi.spyOn(store, 'read').mockRejectedValueOnce(new Error('invalid state'))
    const platform = new FakePlatform(bootstrap(1, []), new Map())
    const env = await environment({ platform, dshHome: home, store })

    await env.service.settled()
    platform.publish(bootstrap(2, []))
    await env.service.settled()

    expect(env.service.status()).toMatchObject({ fatalErrorCode: 'ENT_PLUGIN_STATE_INVALID' })
    expect(platform.reports).toEqual([])
  })

  it.each([null, 'unused-invalid-public-key'])('installs over HTTP without signature configuration or parsing key %s', async key => {
    const content = Buffer.from('intranet managed bundle')
    const desired = { ...assignment(testKey, content), signatureBase64: '' }
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    platform.statusValue = { ...platform.statusValue, platformUrl: 'http://enterprise.invalid' }
    const env = await environment({ platform, trustedPluginPublicKey: key })

    await env.service.settled()
    expect(env.service.status().catalog[0]?.installErrorCode).toBeUndefined()
    await env.service.install(desired.packageName, desired.pluginVersionId)
    expect(env.service.status().plugins[0]?.state).toBe('RESTART_REQUIRED')
    expect(env.manager?.installCalls).toHaveLength(1)
    expect(env.subprocess.specs).toEqual([])
  })

  it('carries the artifact description into the local catalog and omits the key when the server has none', async () => {
    const content = Buffer.from('described managed bundle')
    // 服务端发了 description（契约 PluginDescription，可选）→ 本地 catalog 原样带出来（UI 卡片第二行的取值）。
    const described = { ...assignment(testKey, content), description: '把代码审查规则带进新会话。' }
    const platform = new FakePlatform(bootstrap(1, [described]), new Map([[described.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    expect(env.service.status().catalog[0]?.description).toBe('把代码审查规则带进新会话。')
    // 服务端（例如未升级的那一侧）不发这个键 → 本地 catalog **不产出这个键**（下游据此说「暂无描述」，
    // 绝不补空串：ui 的解码白名单是关闭键集，「缺席」才是唯一缺失口径）。
    const plain = assignment(testKey, content)
    const otherPlatform = new FakePlatform(bootstrap(1, [plain]), new Map([[plain.downloadUrl!, content]]))
    const other = await environment({ platform: otherPlatform })
    await other.service.settled()
    expect(other.service.status().catalog[0]).not.toHaveProperty('description')
  })

  it('carries the artifact readme into the local catalog and omits the key when the server has none', async () => {
    const content = Buffer.from('readme-bearing managed bundle')
    // 服务端发了 readme（契约 PluginReadme，可选）→ 本地 catalog 原样带出来（UI 详情「描述」段的首选取值）。
    const readme = '# Acme 工具箱\n\n把代码审查规则带进新会话。\n'
    const described = { ...assignment(testKey, content), readme }
    const platform = new FakePlatform(bootstrap(1, [described]), new Map([[described.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    // **逐字节原样**：本层不解析 Markdown、不 trim、不截断（渲染与限长都不归它管）。
    expect(env.service.status().catalog[0]?.readme).toBe(readme)
    // 服务端（未升级 / 制品没有 README）不发这个键 → 本地 catalog **不产出这个键**
    // （下游据此回落到短 description，绝不补空串：ui 的解码白名单是关闭键集，「缺席」才是唯一缺失口径）。
    const plain = assignment(testKey, content)
    const otherPlatform = new FakePlatform(bootstrap(1, [plain]), new Map([[plain.downloadUrl!, content]]))
    const other = await environment({ platform: otherPlatform })
    await other.service.settled()
    expect(other.service.status().catalog[0]).not.toHaveProperty('readme')
  })

  it('carries the artifact displayName into the local catalog and tolerates an old server that omits it', async () => {
    const content = Buffer.from('named managed bundle')
    // 服务端发了 displayName（契约 PluginDisplayName，必填 1..120）→ 本地 catalog 原样带出（UI 卡片**标题**取值）。
    const named = { ...assignment(testKey, content), displayName: 'T13 门禁工具箱' }
    const platform = new FakePlatform(bootstrap(1, [named]), new Map([[named.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    expect(env.service.status().catalog[0]?.displayName).toBe('T13 门禁工具箱')
    // 旧服务端（这一刀之前那批 bootstrap 不带该键）→ 本地 catalog 同样不产出它；ui 的白名单与渲染层
    // 据此**回退成包名**（不空白、不编造）——这是刻意的兼容窗口，不是本地把服务端事实吞掉。
    const plain = assignment(testKey, content)
    // 老服务端的字节是**整键缺席**，不是空串：夹具缺省会补 displayName，故此处显式删键还原旧响应。
    delete (plain as Partial<RuntimePluginAssignment>).displayName
    const otherPlatform = new FakePlatform(bootstrap(1, [plain]), new Map([[plain.downloadUrl!, content]]))
    const other = await environment({ platform: otherPlatform })
    await other.service.settled()
    expect(other.service.status().catalog[0]).not.toHaveProperty('displayName')
    expect(other.service.status().catalog[0]?.packageName).toBe(plain.packageName)
  })

  it('keeps the catalog switch usable when the runtime engine version has no mapped commit', async () => {
    const content = Buffer.from('unmapped engine managed bundle')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    // harnessCommit: null 等价于"真机引擎版本不在客户端映射表里"——今天 0.2.0-rc.2 打死的正是这一格。
    const env = await environment({ platform, harnessCommit: null })

    await env.service.settled()
    expect(env.service.status().catalog[0]?.installErrorCode).toBeUndefined()
    await env.service.install(desired.packageName, desired.pluginVersionId)
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'RESTART_REQUIRED', lastErrorCode: null,
    })
    expect(env.manager?.installCalls).toHaveLength(1)
    expect(env.subprocess.specs).toEqual([])
  })

  it('keeps blocking the catalog and installation when the artifact rejects this engine commit', async () => {
    const content = Buffer.from('foreign engine managed bundle')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    // 已确知引擎 commit（0.2.0-rc.2 的发行 commit），但制品白名单只声明了 HARNESS_COMMIT。
    const env = await environment({ platform, harnessCommit: '639ed015397290b3745d163aafe02ffee4aa3f84' })

    await env.service.settled()
    expect(env.service.status().catalog[0]?.installErrorCode).toBe('ENT_PLUGIN_INCOMPATIBLE')
    await expect(env.service.install(desired.packageName, desired.pluginVersionId))
      .rejects.toMatchObject({ code: 'ENT_PLUGIN_INCOMPATIBLE' })
    expect(env.manager?.installCalls).toEqual([])
  })

  it('keeps managed installation fail-closed when verification is enabled without a trust root', async () => {
    const content = Buffer.from('unsigned deployment bundle')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform, verifyPluginSignatures: true, trustedPluginPublicKey: null })

    await env.service.settled()
    expect(env.service.status().catalog[0]?.installErrorCode).toBe('ENT_PLUGIN_SIGNATURE_INVALID')
    await expect(env.service.install(desired.packageName, desired.pluginVersionId)).rejects.toMatchObject({ code: 'ENT_PLUGIN_SIGNATURE_INVALID' })
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_SIGNATURE_INVALID',
    })
    expect(env.manager?.installCalls).toEqual([])
  })

  it.each([true, false])('applies signature policy %s to both catalog and explicit installation', async enabled => {
    const content = Buffer.from('signature policy bundle')
    const desired = { ...assignment(testKey, content), signatureBase64: '' }
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform, verifyPluginSignatures: enabled })
    await env.service.settled()

    if (enabled) {
      expect(env.service.status().catalog[0]?.installErrorCode).toBe('ENT_PLUGIN_SIGNATURE_INVALID')
      await expect(env.service.install(desired.packageName, desired.pluginVersionId))
        .rejects.toMatchObject({ code: 'ENT_PLUGIN_SIGNATURE_INVALID' })
      expect(env.manager?.installCalls).toEqual([])
      platform.publish(bootstrap(2, [assignment(testKey, content)]))
      await env.service.settled()
    }
    expect(env.service.status().catalog[0]?.installErrorCode).toBeUndefined()
    await env.service.install(desired.packageName, desired.pluginVersionId)
    expect(env.manager?.installCalls).toHaveLength(1)
  })

  it('hands the verified absolute tgz and our own request id to the official installBundle', async () => {
    const content = Buffer.from('managed bundle for the official face')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform })

    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    // 交出去的是**本地已校验的绝对 tarball 路径**（内容寻址），不是包名、不是 spec 里的 registry：
    // 官方 `parseInstallSpec` 按 tarball 收（`dsh-plugin-manager/lib/types/install-spec.js:52-56`）。
    expect(env.manager?.installCalls).toEqual([{
      spec: join(env.home, 'enterprise', 'artifacts', `${desired.sha256}.tgz`),
      enabled: true,
      requestId: expect.any(String),
    }])
    // requestId 是取消句柄：官方 `cancelInstall` 只认我们自己生成的那一枚。
    expect(env.manager?.installCalls[0]?.requestId).toMatch(/^[0-9a-f-]{36}$/)
    // 全程零子进程。
    expect(env.subprocess.specs).toEqual([])
  })

  it('installs with exact shell-free argv, persists restart-required, then confirms active only in a new process', async () => {
    const content = Buffer.from('managed bundle v1')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(7, [desired]), new Map([[desired.downloadUrl!, content]]))
    const first = await environment({ platform, runMarker: 'run-one' })
    await first.service.settled()
    expect(first.subprocess.specs).toHaveLength(0)
    expect(first.service.status().catalog[0]).toMatchObject({ packageName: desired.packageName })
    await first.service.install(desired.packageName, desired.pluginVersionId)

    expect(first.manager?.installCalls.map(call => call.spec)).toEqual([
      join(first.home, 'enterprise', 'artifacts', `${desired.sha256}.tgz`),
    ])
    expect(first.subprocess.specs).toEqual([])
    expect(first.service.status().plugins[0]).toMatchObject({ state: 'RESTART_REQUIRED', restartMarker: 'run-one' })
    expect(first.context.enterprisePluginDistribution.status().plugins[0]).toMatchObject({
      state: 'RESTART_REQUIRED', restartMarker: 'run-one',
    })
    platform.publish(bootstrap(7, [desired]))
    await first.service.settled()
    expect(first.service.status().plugins[0]?.state).toBe('RESTART_REQUIRED')
    const persisted = await readFile(join(first.home, 'enterprise', 'managed-plugins.json'), 'utf8')
    expect(persisted).not.toMatch(/token|authorization|signature|publicKey/i)
    await first.close()

    const restartedPlatform = new FakePlatform(bootstrap(7, [desired]), new Map([[desired.downloadUrl!, content]]))
    const restarted = await environment({
      platform: restartedPlatform,
      dshHome: first.home,
      runMarker: 'run-two',
      inventory: inventory([{ moduleName: desired.packageName, enabled: true, fiberPhase: 'active' }]),
    })
    await restarted.service.settled()
    expect(restarted.service.status().plugins[0]).toMatchObject({ state: 'ACTIVE', restartMarker: null })
    expect(restarted.subprocess.specs).toHaveLength(0)
    expect(restartedPlatform.reports.at(-1)).toMatchObject({
      items: [expect.objectContaining({ packageName: desired.packageName, state: 'ACTIVE', loaderPhase: 'active' })],
    })

    restartedPlatform.publish(bootstrap(8, [desired]))
    await restarted.service.settled()
    expect(restarted.service.status()).toMatchObject({
      assignmentRevision: 8,
      plugins: [expect.objectContaining({ desiredRevision: 8, state: 'ACTIVE' })],
    })
    expect(restarted.subprocess.specs).toHaveLength(0)
  })

  it('keeps verification failures inactive and rejects every enterprise core package before the official face', async () => {
    const content = Buffer.from('actual artifact')
    const bad = assignment(testKey, content, { sha256: 'f'.repeat(64) })
    const platform = new FakePlatform(bootstrap(1, [bad]), new Map([[bad.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    await expect(env.service.install(bad.packageName, bad.pluginVersionId)).rejects.toMatchObject({ code: 'ENT_PLUGIN_HASH_MISMATCH' })
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_HASH_MISMATCH',
    })
    expect(env.subprocess.specs).toHaveLength(0)

    // 列表驱动：信任锚里的每个名字都必须被拒，且拒绝必须发生在官方安装面之前。
    // 逐项独立 revision，避免覆盖式 publish 影响彼此；未命名过的核心包一次都不该进入 catalog。
    const protectedNames = [...PROTECTED_ENTERPRISE_PACKAGES].sort()
    expect(protectedNames.length).toBeGreaterThan(0)
    let revision = 2
    for (const packageName of protectedNames) {
      const core = assignment(testKey, content, {
        id: String(880 + revision), packageName, version: '0.1.0',
      })
      platform.publish(bootstrap(revision, [core]))
      await env.service.settled()
      await expect(env.service.install(core.packageName, core.pluginVersionId))
        .rejects.toMatchObject({ code: 'ENT_PLUGIN_CORE_PROTECTED' })
      expect(env.service.status().catalog).toEqual([])
      // 拒绝后不得留下任何本机记录：核心包连状态机都不该进入。
      expect(env.service.status().plugins.map(record => record.packageName)).not.toContain(packageName)
      revision += 1
    }
    // 全部 6 个名字走完后，官方安装面与子进程一次都没有被触碰：保护发生在构造入参之前。
    expect(env.manager?.installCalls).toEqual([])
    expect(env.subprocess.specs).toEqual([])
  })

  it('leaves shutdown-interrupted work retryable for the next process', async () => {
    const content = Buffer.from('managed bundle after restart')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map())
    const originalRequest = platform.request.bind(platform)
    platform.request = vi.fn(async (input: string | URL, init: RequestInit = {}) => input !== desired.downloadUrl
      ? originalRequest(input, init) : new Promise<Response>(
      (_resolve, reject) => {
        const signal = init.signal
        if (signal?.aborted === true) {
          reject(signal.reason)
          return
        }
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      },
    ))
    const interrupted = await environment({ platform, runMarker: 'interrupted-run' })
    await interrupted.service.settled()
    const installing = interrupted.service.install(desired.packageName, desired.pluginVersionId).catch(() => undefined)
    await vi.waitFor(() => {
      expect(interrupted.service.status().plugins[0]?.state).toBe('DOWNLOADING')
    })
    await interrupted.close()
    await installing
    expect(interrupted.service.status().plugins[0]?.state).toBe('DOWNLOADING')

    const restartedPlatform = new FakePlatform(
      bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]),
    )
    const restarted = await environment({
      platform: restartedPlatform,
      dshHome: interrupted.home,
      runMarker: 'retry-run',
    })
    await restarted.service.settled()
    expect(restarted.subprocess.specs).toHaveLength(0)
    await restarted.service.install(desired.packageName, desired.pluginVersionId)
    expect(restarted.manager?.installCalls).toHaveLength(1)
    expect(restarted.subprocess.specs).toEqual([])
    expect(restarted.service.status().plugins[0]).toMatchObject({
      state: 'RESTART_REQUIRED', restartMarker: 'retry-run',
    })
  })

  it('rolls back through the verified exact tgz path and removes ABSENT only after restart confirmation', async () => {
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-rollback-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const v2Content = Buffer.from('managed bundle v2')
    const v2 = assignment(testKey, v2Content, { id: '882', version: '2.0.0' })
    await new ManagedPluginStore(home).write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: v2.packageName,
        version: v2.version,
        sha256: v2.sha256,
        enabled: true,
        desiredRevision: 1,
        desiredState: 'INSTALLED',
        state: 'ACTIVE',
        lastErrorCode: null,
        restartMarker: null,
      }],
    })
    const v1Content = Buffer.from('managed bundle v1')
    const v1 = assignment(testKey, v1Content, { id: '880', version: '1.0.0' })
    const platform = new FakePlatform(bootstrap(2, [v1]), new Map([[v1.downloadUrl!, v1Content]]))
    const env = await environment({
      platform,
      dshHome: home,
      runMarker: 'rollback-run',
      inventory: inventory([{ moduleName: v1.packageName, enabled: true, fiberPhase: 'active' }]),
    })
    await env.service.settled()
    expect(env.subprocess.specs).toHaveLength(0)
    expect(env.service.status().plugins[0]?.version).toBe('2.0.0')
    await env.service.install(v1.packageName, v1.pluginVersionId)
    // 换版本这一刀：先写 ROLLBACK，再把**新制品的本地绝对路径**交给官方 installBundle。
    expect(env.manager?.installCalls.map(call => call.spec)).toEqual([
      join(home, 'enterprise', 'artifacts', `${v1.sha256}.tgz`),
    ])
    expect(env.subprocess.specs).toEqual([])
    expect(env.service.status().plugins[0]).toMatchObject({ version: '1.0.0', state: 'RESTART_REQUIRED' })

    const absent = assignment(testKey, v1Content, { id: '880', version: '1.0.0', desiredState: 'ABSENT' })
    platform.publish(bootstrap(3, [absent]))
    await env.service.settled()
    expect(env.manager?.removeCalls).toEqual([v1.packageName])
    expect(env.service.status().plugins[0]).toMatchObject({
      desiredState: 'ABSENT', state: 'RESTART_REQUIRED', restartMarker: 'rollback-run',
    })
    await env.close()

    const restartedPlatform = new FakePlatform(bootstrap(3, [absent]), new Map())
    const restarted = await environment({
      platform: restartedPlatform,
      dshHome: home,
      runMarker: 'after-remove',
      inventory: inventory(),
    })
    await restarted.service.settled()
    expect(restarted.service.status().plugins).toEqual([])
    expect(restarted.subprocess.specs).toHaveLength(0)
    expect(restartedPlatform.reports.at(-1)).toEqual({ items: [] })
  })

  it('uninstalls managed packages before DSH Enterprise and clears managed state', async () => {
    const content = Buffer.from('managed bundle to remove')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    await env.service.uninstall()

    // 卸载顺序不变：先受管包，最后才是 DSH Enterprise 自身；两者都走官方 `removeBundle`。
    expect(env.manager?.installCalls.map(call => call.spec)).toEqual([
      join(env.home, 'enterprise', 'artifacts', `${desired.sha256}.tgz`),
    ])
    expect(env.manager?.removeCalls).toEqual([desired.packageName, 'dshent-plugin'])
    expect(env.subprocess.specs).toEqual([])
    expect(env.service.status().plugins).toEqual([])
    expect(JSON.parse(await readFile(join(env.home, 'enterprise', 'managed-plugins.json'), 'utf8')))
      .toMatchObject({ plugins: [] })
  })

  it('keeps publication, updates, polling and restart free of automatic installation and remembers removal', async () => {
    const content = Buffer.from('optional enterprise plugin')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    platform.publish(bootstrap(2, [{ ...desired, required: false }]))
    await env.service.settled()
    expect(env.subprocess.specs).toEqual([])
    expect(env.manager?.installCalls).toEqual([])
    expect(env.service.status().plugins).toEqual([])
    await env.service.install(desired.packageName, desired.pluginVersionId)
    const updated = assignment(testKey, Buffer.from('next version'), { id: '999', version: '2.0.0' })
    platform.publish(bootstrap(3, [updated]))
    await env.service.settled()
    expect(env.manager?.installCalls).toHaveLength(1)
    expect(env.service.status().plugins[0]?.version).toBe('1.2.0')
    await env.service.remove(desired.packageName)
    platform.publish(bootstrap(4, [updated]))
    await env.service.settled()
    expect(env.manager?.removeCalls).toEqual([desired.packageName])
    await env.close()
    const restarted = await environment({ platform, dshHome: env.home, runMarker: 'after-user-removal' })
    await restarted.service.settled()
    expect(restarted.service.status().plugins).toEqual([])
    expect(restarted.subprocess.specs).toEqual([])
    expect(restarted.service.status().catalog[0]?.version).toBe('2.0.0')
  })

  it('rejects stale selection, revoked cached artifacts, concurrent actions and signed-out installation', async () => {
    const content = Buffer.from('authorized artifact')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    await expect(env.service.install(desired.packageName, '999')).rejects.toMatchObject({ code: 'ENT_PERMISSION_DENIED' })
    const installing = env.service.install(desired.packageName, desired.pluginVersionId)
    await expect(env.service.remove(desired.packageName)).rejects.toMatchObject({ code: 'ENT_PLUGIN_BUSY' })
    await installing
    platform.snapshot = bootstrap(2, [])
    await expect(env.service.install(desired.packageName, desired.pluginVersionId)).rejects.toMatchObject({ code: 'ENT_PERMISSION_DENIED' })
    expect(env.manager?.installCalls).toHaveLength(1)
    expect(env.subprocess.specs).toEqual([])
    platform.statusValue = { ...platform.statusValue, state: 'SIGNED_OUT' }
    expect(env.service.status().catalog).toEqual([])
    await expect(env.service.install(desired.packageName, desired.pluginVersionId)).rejects.toMatchObject({ code: 'ENT_AUTH_REQUIRED' })
  })

  // ── 官方 application 三态如实透出（本刀新增） ─────────────────────────────────────────────────

  it('records ACTIVE when the official manager applied the bundle hot, and never asks for a restart', async () => {
    const content = Buffer.from('hot applied managed bundle')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const manager = fakePluginManager({
      install: async spec => ({ target: spec, changed: true, application: 'applied' }),
    })
    const env = await environment({
      platform,
      manager,
      inventory: inventory([{ moduleName: desired.packageName, enabled: true, fiberPhase: 'active' }]),
    })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    // 官方口径的 hot：patch 已在**本进程**生效 ⇒ 如实记 ACTIVE（不是 RESTART_REQUIRED），
    // 版本/摘要就是刚刚落盘的这一枚制品（旧实现无论官方怎样都只写 RESTART_REQUIRED）。
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'ACTIVE', version: '1.2.0', sha256: desired.sha256, restartMarker: null, lastErrorCode: null,
    })
    expect(env.manager?.installCalls).toHaveLength(1)
    expect(env.subprocess.specs).toEqual([])
  })

  it('keeps RESTART_REQUIRED when the official manager claims hot but the Loader cannot confirm it yet', async () => {
    const content = Buffer.from('hot but not loaded yet')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const manager = fakePluginManager({
      install: async spec => ({ target: spec, changed: true, application: 'applied' }),
    })
    const env = await environment({ platform, manager, inventory: inventory() })

    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    // 官方 applied 但 Loader 里没有这枚 active row（inventory 为空）⇒ 保守记 RESTART_REQUIRED，
    // 既不谎报「已生效」，也不给下一拍的 `confirmRestartedState` 留一个会被打成 LOADER_INACTIVE 的 ACTIVE。
    // 这个降级不是静默的：同步会留一条 `step=hot-unconfirmed` warn（判定点串见 `applyInstalledApplication`）。
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'RESTART_REQUIRED', restartMarker: 'test-run',
    })
    expect(env.subprocess.specs).toEqual([])
  })

  it('surfaces the official failure honestly instead of pretending success', async () => {
    const content = Buffer.from('not a bundle managed artifact')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const manager = fakePluginManager({
      install: async spec => ({
        target: spec,
        changed: false,
        application: 'failed',
        failedAt: 'spec-host',
        error: { code: 'not-bundle', diagnostic: 'the package declares no dsh.bundle' },
      }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()
    const failure = await env.service.install(desired.packageName, desired.pluginVersionId)
      .then(() => undefined, (error: unknown) => error)
    expect(failure).toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    // 官方失败事实**原样保留**在 cause 里（官方码 + 它自己的诊断），不是被我们吃掉。
    expect(String((failure as { cause?: unknown }).cause)).toContain('code=not-bundle')
    expect(String((failure as { cause?: unknown }).cause)).toContain('failedAt=spec-host')
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_CLI_FAILED',
    })
    expect(env.subprocess.specs).toEqual([])
  })

  it('reuses ENT_PLUGIN_INCOMPATIBLE for the official incompatible-version refusal', async () => {
    const content = Buffer.from('incompatible managed artifact')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const manager = fakePluginManager({
      install: async spec => ({
        target: spec, changed: false, application: 'failed', error: { code: 'incompatible-version' },
      }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()
    // 官方 `incompatible-version`（制品与运行中的 DSH 版本不兼容）与我们那枚码**同一语义** ⇒ 复用同一码与同一句员工文案。
    const failure = await env.service.install(desired.packageName, desired.pluginVersionId)
      .then(() => undefined, (error: unknown) => error)
    expect(failure).toMatchObject({ code: 'ENT_PLUGIN_INCOMPATIBLE' })
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_INCOMPATIBLE',
    })
  })

  it('keeps an official removal failure in the record and in the cause', async () => {
    const content = Buffer.from('managed bundle whose removal is refused')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const manager = fakePluginManager({
      remove: async name => ({
        target: name, changed: false, application: 'failed', error: { code: 'not-removable' },
      }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)
    const failure = await env.service.remove(desired.packageName).then(() => undefined, (error: unknown) => error)
    expect(failure).toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    expect(String((failure as { cause?: unknown }).cause)).toContain('code=not-removable')
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_CLI_FAILED',
    })
    expect(env.subprocess.specs).toEqual([])
  })

  // ── 官方进度与取消（本刀新增） ─────────────────────────────────────────────────────────────────

  it('cancels an in-flight installation through the official cancelInstall and leaves the machine untouched', async () => {
    const content = Buffer.from('managed bundle to cancel')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    let settle: ((result: ManagedPluginChangeResult) => void) | undefined
    const manager = fakePluginManager({
      install: async () => await new Promise<ManagedPluginChangeResult>(resolve => { settle = resolve }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()
    const installing = env.service.install(desired.packageName, desired.pluginVersionId)
    // 真进度：官方在跑的整段时间里，只读路由投影的受管态就是 `INSTALLING`（我们写、官方跑）。
    await vi.waitFor(() => { expect(env.manager?.installCalls).toHaveLength(1) })
    expect(env.service.status().plugins[0]?.state).toBe('INSTALLING')
    const requestId = env.manager!.installCalls[0]!.requestId

    // 取消打的是**我们自己生成**的那一枚 requestId —— 官方面上真的会 abort 并等文件回滚。
    await expect(env.service.cancel(desired.packageName)).resolves.toEqual({ status: 'cancelled' })
    expect(env.manager?.cancelCalls).toEqual([requestId])

    // 官方取消的语义是「package.json/lock 已回滚」⇒ 在途 install 以「取消」收束，本机记录回到安装前（这里本来没有记录）。
    settle!({ target: desired.packageName, changed: false, application: 'cancelled' })
    await expect(installing).rejects.toMatchObject({ code: 'ENT_PLUGIN_INSTALL_CANCELLED' })
    expect(env.service.status().plugins).toEqual([])
    expect(env.subprocess.specs).toEqual([])
  })

  it('restores the pre-install record when a version change is cancelled', async () => {
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-cancel-rollback-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const v1Content = Buffer.from('managed bundle v1')
    const v1 = assignment(testKey, v1Content, { id: '880', version: '1.0.0' })
    await new ManagedPluginStore(home).write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: v1.packageName, version: v1.version, sha256: v1.sha256,
        enabled: true, desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE',
        lastErrorCode: null, restartMarker: null,
      }],
    })
    // 中心把这一行改成 v2；用户在换版本途中按了取消。
    const v2Content = Buffer.from('managed bundle v2')
    const v2 = assignment(testKey, v2Content, { id: '882', version: '2.0.0' })
    const platform = new FakePlatform(bootstrap(2, [v2]), new Map([[v2.downloadUrl!, v2Content]]))
    let settle: ((result: ManagedPluginChangeResult) => void) | undefined
    const manager = fakePluginManager({
      install: async () => await new Promise<ManagedPluginChangeResult>(resolve => { settle = resolve }),
    })
    const env = await environment({
      platform,
      manager,
      dshHome: home,
      inventory: inventory([{ moduleName: v2.packageName, enabled: true, fiberPhase: 'active' }]),
    })
    await env.service.settled()
    const installing = env.service.install(v2.packageName, v2.pluginVersionId)
    await vi.waitFor(() => { expect(env.manager?.installCalls).toHaveLength(1) })
    // 换版本先落 ROLLBACK（旧版本 v1 仍是真的装着），取消之后必须**原样回到 v1 ACTIVE**。
    settle!({ target: v2.packageName, changed: false, application: 'cancelled' })
    await expect(installing).rejects.toMatchObject({ code: 'ENT_PLUGIN_INSTALL_CANCELLED' })
    expect(env.service.status().plugins[0]).toMatchObject({ version: '1.0.0', state: 'ACTIVE' })
  })

  it('answers cancellation truthfully and recovers the official outcome after a too-late cancellation', async () => {
    const content = Buffer.from('managed bundle that applies too fast')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    let settle: ((result: ManagedPluginChangeResult) => void) | undefined
    const manager = fakePluginManager({
      install: async () => await new Promise<ManagedPluginChangeResult>(resolve => { settle = resolve }),
      cancel: async () => ({ status: 'too-late' }),
      wait: async () => ({ target: desired.packageName, changed: true, application: 'restart-required' }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()

    // 没有在跑的东西：如实回 `not-running`，**不**去官方面上瞎调一次 cancelInstall。
    await expect(env.service.cancel(desired.packageName)).resolves.toEqual({ status: 'not-running' })
    expect(env.manager?.cancelCalls).toEqual([])

    const installing = env.service.install(desired.packageName, desired.pluginVersionId)
    await vi.waitFor(() => { expect(env.manager?.installCalls).toHaveLength(1) })
    // 官方已经把 bundle 交给应用阶段：取消不可达 ⇒ 如实回 `too-late`，并用 waitForInstall **不取消地**取回官方结果。
    await expect(env.service.cancel(desired.packageName)).resolves.toEqual({ status: 'too-late' })
    expect(env.manager?.waitCalls).toEqual([env.manager!.installCalls[0]!.requestId])
    settle!({ target: desired.packageName, changed: true, application: 'restart-required' })
    await installing
    expect(env.service.status().plugins[0]?.state).toBe('RESTART_REQUIRED')
  })

  it('fails closed with no second installation channel when the official plugin manager is absent', async () => {
    const content = Buffer.from('managed bundle without an official face')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    // `manager: null` = 官方服务始终没被 provide（端口缺席 ⇒ fail-closed 端口）。
    const env = await environment({ platform, manager: null })
    await env.service.settled()
    await expect(env.service.install(desired.packageName, desired.pluginVersionId))
      .rejects.toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_CLI_FAILED',
    })
    await expect(env.service.cancel(desired.packageName)).resolves.toEqual({ status: 'not-running' })
    // 既没有官方安装面、也没有任何 CLI 子进程：fail-closed，不猜第二条通道。
    expect(env.subprocess.specs).toEqual([])
  })

  // ── 启用 / 停用（本刀新增：官方 setBundleEnabled + 本机私有 enabled 位） ────────────────────────

  it('toggles a managed plugin off through the official setBundleEnabled and keeps the row installed until a restart', async () => {
    const content = Buffer.from('managed bundle to disable')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({
      platform,
      inventory: inventory([{ moduleName: desired.packageName, enabled: true, fiberPhase: 'active' }]),
    })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)
    expect(env.service.status().plugins[0]).toMatchObject({ enabled: true })

    await env.service.setEnabled(desired.packageName, false)

    // 只改 profile 的 bundle 层：官方启停面被拨了**一次**、方向就是用户拨的那一枚；**没有**再装一次。
    expect(env.manager?.setEnabledCalls).toEqual([[desired.packageName, false]])
    expect(env.manager?.installCalls).toHaveLength(1)
    // 那一行**仍在**（desiredState/version/摘要原样），只是启停位翻了、等重启生效（与卸载同一收束口径）。
    expect(env.service.status().plugins[0]).toMatchObject({
      packageName: desired.packageName,
      desiredState: 'INSTALLED',
      version: desired.version,
      sha256: desired.sha256,
      enabled: false,
      state: 'RESTART_REQUIRED',
      restartMarker: 'test-run',
      lastErrorCode: null,
    })
    expect(env.subprocess.specs).toEqual([])
  })

  it('is idempotent: an already-matching enablement bit never troubles the official face', async () => {
    const content = Buffer.from('managed bundle with a stable switch')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    // 已经是「启用」：再点一次启用不该打官方面（那一跑会白改一次盘 + 白 reload 一次）。
    await env.service.setEnabled(desired.packageName, true)
    expect(env.manager?.setEnabledCalls).toEqual([])
    expect(env.service.status().plugins[0]).toMatchObject({ enabled: true })

    await env.service.setEnabled(desired.packageName, false)
    await env.service.setEnabled(desired.packageName, false)
    expect(env.manager?.setEnabledCalls).toEqual([[desired.packageName, false]])
    expect(env.service.status().plugins[0]).toMatchObject({ enabled: false })
  })

  it('fail-closes an official enablement failure and leaves the record exactly as it was', async () => {
    const content = Buffer.from('managed bundle whose enablement is refused')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const manager = fakePluginManager({
      setEnabled: async name => ({
        target: name, changed: false, application: 'failed', error: { code: 'management-required' },
      }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    const failure = await env.service.setEnabled(desired.packageName, false)
      .then(() => undefined, (error: unknown) => error)
    // 官方拒绝启停 ⇒ fail-closed（不假装成功）；官方码与它自己的话原样留在 cause 里。
    expect(failure).toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    expect(String((failure as { cause?: unknown }).cause)).toContain('code=management-required')
    // 记录不动：还是「已安装 · 已启用 · 等重启」，绝不因为我们尝试过就翻成停用或失败。
    expect(env.service.status().plugins[0]).toMatchObject({
      enabled: true, state: 'RESTART_REQUIRED', lastErrorCode: null,
    })
  })

  it('refuses a toggle while another plugin operation is in flight (the same serial gate as install/remove)', async () => {
    const content = Buffer.from('managed bundle with a slow switch')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    let settle: ((result: ManagedPluginChangeResult) => void) | undefined
    const manager = fakePluginManager({
      setEnabled: async () => await new Promise<ManagedPluginChangeResult>(resolve => { settle = resolve }),
    })
    const env = await environment({ platform, manager })
    await env.service.settled()
    await env.service.install(desired.packageName, desired.pluginVersionId)

    const toggling = env.service.setEnabled(desired.packageName, false)
    await vi.waitFor(() => { expect(env.manager?.setEnabledCalls).toHaveLength(1) })
    // 同一时刻只允许一件插件操作：第二次拨（哪怕反向）拿到的是与装/卸同一条串行闸的 BUSY。
    await expect(env.service.setEnabled(desired.packageName, true))
      .rejects.toMatchObject({ code: 'ENT_PLUGIN_BUSY' })
    settle!({ target: desired.packageName, changed: true, application: 'restart-required', stage: 'enable', enabled: false })
    await toggling
    expect(env.manager?.setEnabledCalls).toEqual([[desired.packageName, false]])
  })

  it('refuses to toggle an unmanaged row or one the center has already withdrawn', async () => {
    const content = Buffer.from('managed bundle that may be withdrawn')
    const desired = assignment(testKey, content)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform })
    await env.service.settled()

    // 从来没有受管记录：没有可启停的运行面，且绝不能凭一枚包名去官方 profile 里加一层。
    await expect(env.service.setEnabled(desired.packageName, true))
      .rejects.toMatchObject({ code: 'ENT_PERMISSION_DENIED' })
    expect(env.manager?.setEnabledCalls).toEqual([])

    await env.service.install(desired.packageName, desired.pluginVersionId)
    await env.service.remove(desired.packageName)
    expect(env.service.status().plugins[0]).toMatchObject({ desiredState: 'ABSENT' })
    // 中心/用户已撤回的那一行：同样拒（否则 `setBundleEnabled(true)` 会把刚摘掉的 bundle 偷偷加回来）。
    await expect(env.service.setEnabled(desired.packageName, true))
      .rejects.toMatchObject({ code: 'ENT_PERMISSION_DENIED' })
    expect(env.manager?.setEnabledCalls).toEqual([])
  })

  it('confirms a disabled plugin as installed-but-off in the next process instead of calling it inactive', async () => {
    const content = Buffer.from('managed bundle disabled before the restart')
    const desired = assignment(testKey, content)
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-disabled-confirm-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const store = new ManagedPluginStore(home)
    await store.write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: desired.packageName, version: desired.version, sha256: desired.sha256,
        enabled: false, desiredRevision: 1, desiredState: 'INSTALLED', state: 'RESTART_REQUIRED',
        lastErrorCode: null, restartMarker: 'previous-run',
      }],
    })
    // 停用后 bundle 已从 profile 层摘掉 ⇒ Loader 里连一条 entry 都没有（inventory 为空）。
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map())
    const env = await environment({ platform, dshHome: home, store, inventory: inventory(), runMarker: 'next-run' })
    await env.service.settled()
    expect(env.service.status().plugins[0]).toMatchObject({
      state: 'ACTIVE', enabled: false, restartMarker: null, lastErrorCode: null, version: desired.version,
    })

    // 对照组：同一份现场，但启停位是「启用」⇒ 依旧如实判 LOADER_INACTIVE（停用不是失败，启用后不见了才是）。
    const otherHome = await mkdtemp(join(tmpdir(), 'enterprise-plugin-enabled-inactive-'))
    cleanups.push(() => rm(otherHome, { force: true, recursive: true }))
    const otherStore = new ManagedPluginStore(otherHome)
    await otherStore.write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: desired.packageName, version: desired.version, sha256: desired.sha256,
        enabled: true, desiredRevision: 1, desiredState: 'INSTALLED', state: 'RESTART_REQUIRED',
        lastErrorCode: null, restartMarker: 'previous-run',
      }],
    })
    const other = await environment({
      platform: new FakePlatform(bootstrap(1, [desired]), new Map()),
      dshHome: otherHome,
      store: otherStore,
      inventory: inventory(),
      runMarker: 'next-run',
    })
    await other.service.settled()
    expect(other.service.status().plugins[0]).toMatchObject({
      state: 'FAILED', enabled: true, lastErrorCode: 'ENT_PLUGIN_LOADER_INACTIVE',
    })
  })

  it('never re-enables a disabled plugin when the reconciler sees the same artifact', async () => {
    const content = Buffer.from('managed bundle that stays off')
    const desired = assignment(testKey, content)
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-disabled-reconcile-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const store = new ManagedPluginStore(home)
    await store.write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: desired.packageName, version: desired.version, sha256: desired.sha256,
        enabled: false, desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE',
        lastErrorCode: null, restartMarker: null,
      }],
    })
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map([[desired.downloadUrl!, content]]))
    const env = await environment({ platform, dshHome: home, store })
    await env.service.settled()

    await env.service.install(desired.packageName, desired.pluginVersionId)

    // sameArtifact + 已停用 ⇒ 绝不重新走 `installBundle({enabled:true})`（那等于把用户的停用偷偷开回来）。
    expect(env.manager?.installCalls).toEqual([])
    expect(env.service.status().plugins[0]).toMatchObject({
      enabled: false, state: 'ACTIVE', version: desired.version,
    })
  })

  it('keeps a disabled plugin disabled when the center offers a new version through an explicit install', async () => {
    const v1Content = Buffer.from('managed bundle v1 disabled')
    const v1 = assignment(testKey, v1Content, { id: '880', version: '1.0.0' })
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-disabled-upgrade-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const store = new ManagedPluginStore(home)
    await store.write({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: v1.packageName, version: v1.version, sha256: v1.sha256,
        enabled: false, desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE',
        lastErrorCode: null, restartMarker: null,
      }],
    })
    const v2Content = Buffer.from('managed bundle v2 while disabled')
    const v2 = assignment(testKey, v2Content, { id: '882', version: '2.0.0' })
    const platform = new FakePlatform(bootstrap(2, [v2]), new Map([[v2.downloadUrl!, v2Content]]))
    const env = await environment({ platform, dshHome: home, store })
    await env.service.settled()

    await env.service.install(v2.packageName, v2.pluginVersionId)

    // 换版本这一刀把启停位**一起带下去**：新制品装上盘，但仍是「已停用」（不借安装之机把开关拨回来）。
    expect(env.manager?.installCalls).toEqual([{
      spec: join(home, 'enterprise', 'artifacts', `${v2.sha256}.tgz`),
      enabled: false,
      requestId: expect.any(String),
    }])
    expect(env.service.status().plugins[0]).toMatchObject({
      version: '2.0.0', enabled: false, state: 'RESTART_REQUIRED',
    })
  })

  it('treats a legacy record without the local enabled bit as enabled (read-time normalization, no migration)', async () => {
    const home = await mkdtemp(join(tmpdir(), 'enterprise-plugin-legacy-record-'))
    cleanups.push(() => rm(home, { force: true, recursive: true }))
    const content = Buffer.from('legacy managed bundle')
    const desired = assignment(testKey, content)
    const path = join(home, 'enterprise', 'managed-plugins.json')
    await mkdir(dirname(path), { recursive: true })
    // 旧 Host 写下的那一份：**没有 `enabled` 这一枚键**（形状门禁的另一个合法键集）。
    await writeFile(path, `${JSON.stringify({
      formatVersion: 1,
      assignmentRevision: 1,
      plugins: [{
        packageName: desired.packageName, version: desired.version, sha256: desired.sha256,
        desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE',
        lastErrorCode: null, restartMarker: null,
      }],
    }, null, 2)}\n`)
    const platform = new FakePlatform(bootstrap(1, [desired]), new Map())
    // 读时归一：**读一次**就得到 `enabled: true`，而且读**不**写回（旧文件一字不动 ⇒ 不迁移、不重写）。
    const loaded = await new ManagedPluginStore(home).read()
    expect(loaded.plugins[0]).toMatchObject({ enabled: true, state: 'ACTIVE' })
    expect(await readFile(path, 'utf8')).not.toContain('"enabled"')

    const env = await environment({
      platform,
      dshHome: home,
      inventory: inventory([{ moduleName: desired.packageName, enabled: true, fiberPhase: 'active' }]),
    })
    await env.service.settled()

    // 投影端原样带出这一枚归一后的位（旧 Host 照旧解得开、不报 STATE_INVALID）。
    expect(env.service.status().plugins[0]).toMatchObject({ enabled: true, state: 'ACTIVE' })
    // 而且这一枚 `true` 不是摆设：拨一次停用是真的会打官方面。
    await env.service.setEnabled(desired.packageName, false)
    expect(env.manager?.setEnabledCalls).toEqual([[desired.packageName, false]])
  })

  it('has no CLI subprocess boundary left anywhere in the package source', async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const entries = await readdir(resolve(root, 'src'))
    expect(entries).not.toContain('cli.ts')
    for (const file of entries.filter(entry => entry.endsWith('.ts'))) {
      const source = await readFile(resolve(root, 'src', file), 'utf8')
      expect(source, file).not.toMatch(/from '\.\/cli\.js'/)
      expect(source, file).not.toMatch(/installManagedPlugin|removeManagedPlugin/)
      expect(source, file).not.toMatch(/installPluginArguments|removePluginArguments/)
      expect(source, file).not.toMatch(/subprocess\.(spawn|resolveExecutable)/)
    }
    // 官方安装面是**唯一**的安装/卸载/取消边界。
    const service = await readFile(resolve(root, 'src/service.ts'), 'utf8')
    expect(service).toContain('this.pluginManager.installBundle(')
    expect(service).toContain('this.pluginManager.removeBundle(')
    expect(service).toContain('this.pluginManager.cancelInstall(')
  })
})
