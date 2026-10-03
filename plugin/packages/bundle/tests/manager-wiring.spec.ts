/**
 * [INPUT]: 依赖 vitest、**真实** `@deepseek-ai/cordis` 的 `Context`/`Service`（与真机同一套 inject 语义）、
 *          `src/manager-wiring.ts` 的受管插件安装面接线、`src/preset/wiring.ts` 的通用接线与晚绑定持有者，
 *          以及 plugin-distribution 的官方插件 manager 端口（`createLateBoundManagedPluginManagerPort`）
 * [OUTPUT]: 锁死**两条官方接线共用同一份时序实现**：① 通用 `deferOfficialServiceWiring` 的五条判定点（deferred/wired/unavailable/port-rejected/unwired）
 *          与自定义文案；② 受管插件安装面 `deferEnterprisePluginManagerWiring` 在 apply 那刻服务缺席时不解散、
 *          服务出现后回调被重新装载、官方端口真的交到持有者手上、服务撤下后安装面回到 fail-closed
 * [POS]: bundle 的**第二条官方接线**的时序门禁。它与 `preset-wiring.spec.ts` 共用同一件真机事实
 *          （官方 plugin-manager 与本 bundle 并发 create），故两份测试也必须证明「两条线等的是同一套判决」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { createLateBoundManagedPluginManagerPort } from '@dshent/plugin-distribution'
import {
  PLUGIN_MANAGER_WIRING_SERVICES,
  deferEnterprisePluginManagerWiring,
} from '../src/manager-wiring.js'
import {
  deferOfficialServiceWiring,
  type EnterprisePresetWiringContext,
} from '../src/preset/wiring.js'

interface LogRow {
  readonly level: 'info' | 'warn' | 'error'
  readonly message: string
}

/** 假 ctx：把 inject 的**回调名册**留在手上，测试可以精确控制「服务何时出现」。 */
function makeFakeContext(): {
  readonly ctx: EnterprisePresetWiringContext
  readonly callbacks: ((ctx: unknown) => unknown)[]
  readonly depSets: unknown[]
  readonly logs: LogRow[]
} {
  const callbacks: ((ctx: unknown) => unknown)[] = []
  const depSets: unknown[] = []
  const logs: LogRow[] = []
  return {
    callbacks,
    depSets,
    logs,
    ctx: {
      inject(deps, callback) {
        depSets.push(deps)
        callbacks.push(callback)
        return { kind: 'fiber-stub' }
      },
      // 真 cordis 的 `ctx.get` 在服务未 provide 时回 undefined（不抛）——假 ctx 照抄这个语义。
      get: () => undefined,
      logger: {
        info: (message: string) => { logs.push({ level: 'info', message }) },
        warn: (message: string) => { logs.push({ level: 'warn', message }) },
        error: (message: string) => { logs.push({ level: 'error', message }) },
      },
    } as unknown as EnterprisePresetWiringContext,
  }
}

/** 一张假服务面：`get(name)` 只回名册里已登记的项（模拟 cordis 的「未提供即 undefined」）。 */
function makeServiceScope(entries: Readonly<Record<string, unknown>>): { get(name: string): unknown } {
  return { get: (name: string) => entries[name] }
}

/** 官方 `PluginManager` 的最小结构面（安装/卸载/启停/等待/取消五枚方法）。 */
function makeOfficialManager(): {
  installBundle(spec: string): Promise<unknown>
  removeBundle(name: string): Promise<unknown>
  setBundleEnabled(name: string, enabled: boolean): Promise<unknown>
  waitForInstall(requestId: string): Promise<unknown>
  cancelInstall(requestId: string): Promise<unknown>
} {
  return {
    installBundle: async (spec: string) => ({ target: spec, changed: true, application: 'applied' }),
    removeBundle: async (name: string) => ({ target: name, changed: true, application: 'applied' }),
    setBundleEnabled: async (name: string, enabled: boolean) => ({
      target: name, changed: true, application: 'applied', stage: 'enable', enabled,
    }),
    waitForInstall: async () => null,
    cancelInstall: async () => ({ status: 'cancelled' }),
  }
}

/** 官方实例上真的被打到的那几枚调用（`root.plugin(Class)` 交回的是 fiber，故用名册记账）。 */
const officialInstalls: string[] = []
const officialBundleToggles: [string, boolean][] = []

/** 与官方 `super(ctx, 'pluginManager')` 同一语义的迟到服务。 */
class LatePluginManager extends Service {
  constructor(ctx: Context) {
    super(ctx, 'pluginManager')
  }
  async installBundle(spec: string) {
    officialInstalls.push(spec)
    return { target: spec, changed: true, application: 'applied' as const }
  }
  async removeBundle(name: string) { return { target: name, changed: true, application: 'applied' as const } }
  async setBundleEnabled(name: string, enabled: boolean) {
    officialBundleToggles.push([name, enabled])
    return { target: name, changed: true, application: 'restart-required' as const, stage: 'enable' as const, enabled }
  }
  async waitForInstall() { return null }
  async cancelInstall() { return { status: 'cancelled' as const } }
}

/** 让 inject 回调那一拍跑完（cordis 的 fiber 装载是异步的）。 */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

describe('deferOfficialServiceWiring（两条官方接线共用的时序实现）', () => {
  it('runs the five judgement points with the caller-supplied text and the official inject semantics', () => {
    const rig = makeFakeContext()
    const wired: string[] = []
    deferOfficialServiceWiring<string>(rig.ctx, {
      operation: 'wireThing',
      services: ['pluginManager', 'profileContext'],
      texts: {
        waiting: 'thing is waiting',
        readFailed: 'thing could not read',
        unavailable: 'thing is not wired',
        rejected: 'thing was rejected',
        wired: 'thing is wired',
        unwired: 'thing went away',
      },
      log: (level, message) => { rig.logs.push({ level, message }) },
      resolve: readable => {
        const manager = readable.get('pluginManager')
        if (manager === undefined) return undefined
        // 形状合法但端口本身拒绝我们（例如官方服务面只带 installBundle/removeBundle 之外的形状差异）。
        if ((manager as { reject?: boolean }).reject === true) throw new Error('port rejected')
        return 'resolved-port'
      },
      onWired: value => { wired.push(value) },
    })
    // ① apply 那刻的判决：deferred（等待中，不是终局）。
    expect(rig.depSets).toEqual([['pluginManager', 'profileContext']])
    expect(rig.logs.some(row => row.message.includes('thing is waiting [operation=wireThing step=deferred'))).toBe(true)

    // ② 服务齐备但取值器说不可达 ⇒ unavailable，不接线。
    expect(rig.callbacks[0]!(makeServiceScope({ profileContext: { dir: '/profile/web' } }))).toBeUndefined()
    expect(wired).toEqual([])
    expect(rig.logs.some(row => row.message.includes('thing is not wired [operation=wireThing step=unavailable'
      + ' pluginManager=absent profileDir=ready]'))).toBe(true)

    // ③ 取值器抛错 ⇒ port-rejected（服务在，但不接受我们这枚端口）。
    expect(rig.callbacks[0]!(makeServiceScope({
      pluginManager: { ...makeOfficialManager(), reject: true }, profileContext: { dir: '/profile/web' },
    }))).toBeUndefined()
    expect(wired).toEqual([])
    expect(rig.logs.some(row => row.level === 'error'
      && row.message.includes('thing was rejected [operation=wireThing step=port-rejected'
        + ' pluginManager=ready profileDir=ready]'))).toBe(true)

    // ④ 正常就绪 ⇒ wired，并把端口交出去；返回值就是撤下回调。
    const disposer = rig.callbacks[0]!(makeServiceScope({
      pluginManager: makeOfficialManager(), profileContext: { dir: '/profile/web' },
    }))
    expect(wired).toEqual(['resolved-port'])
    expect(rig.logs.some(row => row.level === 'info'
      && row.message.includes('thing is wired [operation=wireThing step=wired pluginManager=ready profileDir=ready]')))
      .toBe(true)
    expect(typeof disposer).toBe('function')
  })
})

describe('deferEnterprisePluginManagerWiring（受管插件安装面）', () => {
  it('waits for the same two services and, once the official manager appears, hands the real port to the holder', async () => {
    expect(PLUGIN_MANAGER_WIRING_SERVICES).toEqual(['pluginManager', 'profileContext'])
    const root = new Context()
    // profileContext 在 root 上（官方 profile-boot 在装载任何条目之前 provide 它）。
    root.provide('profileContext', { name: 'web', dir: '/profile/web' })
    const holder = createLateBoundManagedPluginManagerPort()
    const logs: LogRow[] = []
    let unwired = 0
    deferEnterprisePluginManagerWiring(root, {
      onWired: manager => { holder.wire(manager) },
      onUnwired: () => { holder.unwire(); unwired += 1 },
      log: (level, message) => { logs.push({ level, message }) },
    })

    // ① apply 那一刻：服务还没 provide ⇒ 夹在端口后面的官方服务仍是缺席的（fail-closed，不是终局）。
    expect(holder.wired()).toBe(false)
    await expect(holder.port.removeBundle('pkg')).rejects.toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    expect(logs.some(row => row.level === 'warn'
      && row.message.includes('[operation=wirePluginManager step=deferred'))).toBe(true)

    // ② 官方服务稍后出现（与真机 plugin-manager 的 `super(ctx, 'pluginManager')` 同一语义）。
    const managerFiber = await root.plugin(LatePluginManager)
    await settle()

    // ③ 端口被真的交出来：这两枚调用打到了官方实例上（不是空壳、也不是我们自造的通道）。
    expect(holder.wired()).toBe(true)
    await expect(holder.port.installBundle('/abs/artifact.tgz', { requestId: 'req-1' }))
      .resolves.toMatchObject({ application: 'applied' })
    expect(officialInstalls).toEqual(['/abs/artifact.tgz'])
    // 第五枚（启停）也走同一枚晚绑定端口：方向原样交给官方实例。
    await expect(holder.port.setBundleEnabled('@example/dsh-tools', false))
      .resolves.toMatchObject({ stage: 'enable', enabled: false })
    expect(officialBundleToggles).toEqual([['@example/dsh-tools', false]])
    expect(logs.some(row => row.level === 'info' && row.message.includes(
      '[operation=wirePluginManager step=wired pluginManager=ready profileDir=ready]'))).toBe(true)

    // ④ 服务被撤下 ⇒ 安装面立刻回到 fail-closed（不静默换实现、不引用已卸载的官方实例）。
    await managerFiber.dispose()
    await settle()
    expect(unwired).toBe(1)
    expect(holder.wired()).toBe(false)
    await expect(holder.port.installBundle('/abs/artifact.tgz')).rejects.toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    expect(logs.some(row => row.level === 'warn'
      && row.message.includes('[operation=wirePluginManager step=unwired'))).toBe(true)
    await root.fiber.dispose()
  })

  it('never wires when the official surface is missing any one of the five methods (no half-port)', () => {
    const rig = makeFakeContext()
    const onWired = vi.fn()
    deferEnterprisePluginManagerWiring(rig.ctx, {
      onWired,
      log: (level, message) => { rig.logs.push({ level, message }) },
    })
    expect(rig.depSets).toEqual([['pluginManager', 'profileContext']])
    // 只有 installBundle/removeBundle 的旧服务面：形状门禁判不可达 ⇒ 不接线（缺 cancelInstall 就是假取消键）。
    rig.callbacks[0]!(makeServiceScope({
      pluginManager: {
        installBundle: async () => undefined,
        removeBundle: async () => undefined,
      },
      profileContext: { dir: '/profile/web' },
    }))
    expect(onWired).not.toHaveBeenCalled()
    expect(rig.logs.some(row => row.level === 'warn'
      && row.message.includes('[operation=wirePluginManager step=unavailable'
        + ' pluginManager=absent profileDir=ready]'))).toBe(true)

    // 四枚齐备、**独缺启停那第五枚**的旧服务面：同样不接线（否则界面会得到一枚拨不动的假开关）。
    rig.callbacks[0]!(makeServiceScope({
      pluginManager: {
        installBundle: async () => undefined,
        removeBundle: async () => undefined,
        waitForInstall: async () => null,
        cancelInstall: async () => ({ status: 'cancelled' }),
      },
      profileContext: { dir: '/profile/web' },
    }))
    expect(onWired).not.toHaveBeenCalled()
    expect(rig.logs.filter(row => row.level === 'warn'
      && row.message.includes('pluginManager=absent profileDir=ready]'))).toHaveLength(2)
  })
})
