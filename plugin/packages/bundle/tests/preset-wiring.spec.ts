/**
 * [INPUT]: 依赖 vitest、**真实** `@deepseek-ai/cordis` 的 `Context`/`Service`（与真机同一套 inject 语义）、`src/preset/wiring.ts` 的延迟接线与晚绑定持有者、`src/preset/errors.ts` 的稳定码、`tests/preset-support.ts` 的假安装端口
 * [OUTPUT]: 锁死「配方一键启用」的**两个冻结点**：① 取服务——apply 那一刻官方服务还没 provide 时端口**不**被判死，服务稍后出现时回调被 Cordis 重新装载、端口真的交给路由；② 交端口——实时解引用的端口从 503 转 200，不因 `{...}` 快照而永久缺席；并锁住服务始终缺席/被撤下时仍 fail-closed，以及 `step=deferred`/`step=wired`/`step=unavailable`/`step=unwired` 判定点日志可见
 * [POS]: 配方纵深的**时序门禁**。它专门守住真机缺陷（三条路由永久 400 `ENT_INVALID_REQUEST`）的根因：官方 plugin-manager 与本 bundle 是同一棵 loader 树里并发 create 的两个条目，一次性 `ctx.get` 会在服务 provide 之前定生死。码→HTTP 状态仍在 platform-client 的 `local-api.spec.ts`，本文件只证「端口最终有没有交到路由手上」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { EnterprisePresetError } from '../src/preset/errors.js'
import {
  createLateBoundPresetService,
  deferEnterprisePresetWiring,
  unavailablePresetInstallPort,
  type LateBoundPresetService,
} from '../src/preset/wiring.js'
import type { PresetInstallPort } from '../src/preset/index.js'
import { createFakePresetPort } from './preset-support.js'

/** 一条接线留痕。 */
interface LogRow {
  readonly level: 'info' | 'warn' | 'error'
  readonly message: string
}

/** 假 ctx：把 inject 的**回调名册**留在手上，测试可以精确控制「服务何时出现」。 */
function makeFakeContext(): {
  readonly ctx: {
    inject(deps: unknown, callback: (ctx: unknown) => unknown): unknown
    get(name: string): unknown
    readonly logger: Record<'info' | 'warn' | 'error', (message: string) => void>
  }
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
    },
  }
}

/** 一张假服务面：`get(name)` 只回名册里已登记的项（模拟 cordis 的「未提供即 undefined」）。 */
function makeServiceScope(entries: Readonly<Record<string, unknown>>): { get(name: string): unknown } {
  return { get: (name: string) => entries[name] }
}

/** 官方 `PluginManager` 的最小结构面（安装/卸载两枚方法）。 */
function makeManager(): {
  installBundle(spec: string): Promise<unknown>
  removeBundle(name: string): Promise<unknown>
} {
  return {
    installBundle: async (spec: string) => ({ target: spec, changed: false, application: 'applied' }),
    removeBundle: async (name: string) => ({ target: name, changed: false, application: 'applied' }),
  }
}

/** 与官方 `super(ctx, 'pluginManager')` 同一语义的迟到服务。 */
class LatePluginManager extends Service {
  constructor(ctx: Context) {
    super(ctx, 'pluginManager')
  }
  async installBundle(spec: string) { return { target: spec, changed: false, application: 'applied' as const } }
  async removeBundle(name: string) { return { target: name, changed: false, application: 'applied' as const } }
}

/** 让 inject 回调那一拍跑完（cordis 的 fiber 装载是异步的）。 */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

describe('deferEnterprisePresetWiring', () => {
  it('声明 inject 而不是一次性 ctx.get：apply 那刻服务缺席时端口不被判死，服务出现后回调重跑并交端口', async () => {
    const root = new Context()
    // profileContext 在 root 上（官方 profile-boot 在装载任何条目之前 provide 它）。
    root.provide('profileContext', { name: 'web', dir: '/profile/web' })

    const wired: { port: PresetInstallPort | undefined, profileDir: string | undefined } = {
      port: undefined,
      profileDir: undefined,
    }
    const logs: LogRow[] = []
    deferEnterprisePresetWiring(root, {
      onWired: (port, profileDir) => {
        wired.port = port
        wired.profileDir = profileDir
      },
      log: (level, message) => { logs.push({ level, message }) },
    })

    // ① apply 那一刻：服务还没 provide ⇒ 端口不能在这时被「定生死」（回调因依赖不满足仍停在 pending）。
    expect(wired.port).toBeUndefined()
    expect(logs.some(row => row.level === 'warn' && row.message.includes('[operation=wirePreset step=deferred'))).toBe(true)
    expect(logs.some(row => row.message.includes('pluginManager=absent'))).toBe(true)

    // ② 服务稍后出现（与真机 plugin-manager 的 `super(ctx, 'pluginManager')` 同一语义）。
    await root.plugin(LatePluginManager)
    await settle()

    // ③ 端口**最终**被解析并交给路由（这就是真机上三条路由从永久 400 变成 200 的那一步）。
    expect(wired.port).toBeDefined()
    expect(wired.profileDir).toBe('/profile/web')
    expect(logs.some(row => row.level === 'info' && row.message.includes('[operation=wirePreset step=wired'))).toBe(true)
    expect(logs.some(row => row.message.includes('pluginManager=ready profileDir=ready'))).toBe(true)

    // 端口确实能打到官方 installBundle（不是一枚空壳）。
    await expect(wired.port!.installBundle('/x/bundle')).resolves.toMatchObject({ application: 'applied' })
    await root.fiber.dispose()
  })

  it('交出去的端口是从官方服务面现取的真端口：转发一次 installBundle 就能在官方面上看到', async () => {
    const root = new Context()
    root.provide('profileContext', { name: 'web', dir: '/profile/web' })
    const fake = createFakePresetPort({ linkOnInstall: false })
    let handed: PresetInstallPort | undefined
    deferEnterprisePresetWiring(root, { onWired: port => { handed = port } })
    await root.plugin(class extends Service {
      constructor(ctx: Context) { super(ctx, 'pluginManager') }
      installBundle(spec: string) {
        fake.port.installBundle(spec)
        return Promise.resolve({ target: spec, changed: true, application: 'applied' })
      }
      removeBundle(name: string) {
        fake.port.removeBundle(name)
        return Promise.resolve({ target: name, changed: true, application: 'applied' })
      }
    })
    await settle()
    expect(handed).toBeDefined()
    // 端口不是空壳：它把调用**原样转发**到官方 pluginManager 上（假端口在那边记账）。
    await handed!.installBundle('/x/bundle')
    await handed!.removeBundle('dsh-ent-preset-ent-demo')
    expect(fake.installCalls).toEqual(['/x/bundle'])
    expect(fake.removeCalls).toEqual(['dsh-ent-preset-ent-demo'])
    await root.fiber.dispose()
  })

  it('服务始终缺席时不接线：如实留 step=unavailable，绝不静默降级成别的安装通道', () => {
    const rig = makeFakeContext()
    const wired: PresetInstallPort[] = []
    deferEnterprisePresetWiring(rig.ctx as never, {
      onWired: port => { wired.push(port) },
      log: (level, message) => { rig.logs.push({ level, message }) },
    })
    // 声明的依赖就是官方口径的那两枚（顺序即 inject 声明）。
    expect(rig.depSets).toHaveLength(1)
    expect(rig.depSets[0]).toEqual(['pluginManager', 'profileContext'])

    // 依赖齐备但读不到（服务被撤下 / 不在 profile 里）：回调跑一次，如实记 unavailable，不接线。
    const outcome = rig.callbacks[0]!(makeServiceScope({ profileContext: { dir: '/profile/web' } }))
    expect(outcome).toBeUndefined()
    expect(wired).toHaveLength(0)
    expect(rig.logs.some(row => row.level === 'warn'
      && row.message.includes('[operation=wirePreset step=unavailable pluginManager=absent profileDir=ready'))).toBe(true)
  })

  it('profileContext.dir 缺席（进程不在 profile 里）同样不接线——官方 installBundle 没有落点', () => {
    const rig = makeFakeContext()
    const wired: PresetInstallPort[] = []
    deferEnterprisePresetWiring(rig.ctx as never, {
      onWired: port => { wired.push(port) },
      log: (level, message) => { rig.logs.push({ level, message }) },
    })
    rig.callbacks[0]!(makeServiceScope({ pluginManager: makeManager() }))
    expect(wired).toHaveLength(0)
    expect(rig.logs.some(row => row.message.includes('step=unavailable pluginManager=ready profileDir=absent'))).toBe(true)
  })

  it('服务面缺 installBundle/removeBundle 时与缺席同判（都不接线）——不接半个端口、不猜另一个安装面', () => {
    const rig = makeFakeContext()
    const wired: PresetInstallPort[] = []
    deferEnterprisePresetWiring(rig.ctx as never, {
      onWired: port => { wired.push(port) },
      log: (level, message) => { rig.logs.push({ level, message }) },
    })
    // 形状不对的服务（只有别的成员）在 `presetPluginManagerFromContext` 就被判为不可达。
    rig.callbacks[0]!(makeServiceScope({ pluginManager: { nope: true }, profileContext: { dir: '/profile/web' } }))
    expect(wired).toHaveLength(0)
    expect(rig.logs.some(row => row.level === 'warn'
      && row.message.includes('step=unavailable pluginManager=absent profileDir=ready'))).toBe(true)
  })

  it('服务被撤下时留 step=unwired，并允许调用方撤回端口（不静默换实现）', async () => {
    const root = new Context()
    root.provide('profileContext', { name: 'web', dir: '/profile/web' })
    let wired = 0
    let unwired = 0
    const logs: LogRow[] = []
    deferEnterprisePresetWiring(root, {
      onWired: () => { wired += 1 },
      onUnwired: () => { unwired += 1 },
      log: (level, message) => { logs.push({ level, message }) },
    })
    const manager = await root.plugin(LatePluginManager)
    await settle()
    expect(wired).toBe(1)
    await manager.dispose()
    await settle()
    expect(unwired).toBe(1)
    expect(logs.some(row => row.level === 'warn' && row.message.includes('step=unwired'))).toBe(true)
    await root.fiber.dispose()
  })

  it('unavailablePresetInstallPort 是 fail-closed 的：抛 ENT_PRESET_INSTALL_FAILED（唯一那张表给 503）', async () => {
    const port = unavailablePresetInstallPort()
    await expect(port.installBundle('/x/bundle')).rejects.toBeInstanceOf(EnterprisePresetError)
    await expect(port.removeBundle('pkg')).rejects.toMatchObject({ code: 'ENT_PRESET_INSTALL_FAILED' })
  })
})

describe('createLateBoundPresetService（第二个冻结点：端口快照）', () => {
  /** 与 `apply()` 里同样的拼装：对象字面量构造时 `{...}` 展开的判决被快照。 */
  interface RouteOptions {
    readonly presetEnable?: () => Promise<unknown>
    readonly presetStatus?: () => Promise<unknown>
  }

  function routeOptionsFrom(holder: LateBoundPresetService<{ readonly id: string }>): RouteOptions {
    return {
      // ⚠ 这一行就是缺陷现场：`service()` 在构造时被求值一次。
      ...(holder.service() === undefined ? {} : { presetEnable: async () => 'enabled' }),
      // 而这个端口在调用时实时解引用——修复的关键差异。
      presetStatus: async () => (holder.service() === undefined
        ? Promise.reject(new EnterprisePresetError(
          'ENT_PRESET_INSTALL_FAILED',
          'the official plugin manager is not available on this profile yet',
        ))
        : Promise.resolve(holder.service()!.id)),
    }
  }

  it('未接线时 service() 恒为 undefined：三条路由抛稳定码 503（fail-closed），不是 400 永久缺口', async () => {
    const holder = createLateBoundPresetService<{ readonly id: string }>({ create: () => ({ id: 'wired' }) })
    expect(holder.service()).toBeUndefined()
    const routes = routeOptionsFrom(holder)
    // `{...}` 快照那一支确实缺席（与修复前同形）——但真正交给路由的 status 端口仍然在。
    expect(routes.presetEnable).toBeUndefined()
    expect(routes.presetStatus).toBeDefined()
    await expect(routes.presetStatus!()).rejects.toMatchObject({ code: 'ENT_PRESET_INSTALL_FAILED' })
  })

  it('端口先交给路由、服务后才就绪：同一个端口对象从 503 变成真值（不再被判死）', async () => {
    const holder = createLateBoundPresetService<{ readonly id: string }>({ create: () => ({ id: 'wired' }) })
    const routes = routeOptionsFrom(holder)
    await expect(routes.presetStatus!()).rejects.toMatchObject({ code: 'ENT_PRESET_INSTALL_FAILED' })
    // 服务稍后就绪（真机上就是官方 pluginManager 的 Service 构造跑在 apply 之后）。
    holder.wire(unavailablePresetInstallPort(), '/profile/web')
    await expect(routes.presetStatus!()).resolves.toBe('wired')
  })

  it('服务被撤下后 service() 回到 undefined：新端口回到等待态（503），不引用已卸载的官方实例', async () => {
    const holder = createLateBoundPresetService<{ readonly id: string }>({ create: () => ({ id: 'wired' }) })
    const routes = routeOptionsFrom(holder)
    holder.wire(unavailablePresetInstallPort(), '/profile/web')
    await expect(routes.presetStatus!()).resolves.toBe('wired')
    holder.unwire()
    await expect(routes.presetStatus!()).rejects.toMatchObject({ code: 'ENT_PRESET_INSTALL_FAILED' })
  })

  it('接线时把刚解析到的官方端口与 profileDir 原样交给创建函数（不猜、不重取）', () => {
    const seen: { port?: PresetInstallPort, profileDir?: string } = {}
    const fake = createFakePresetPort({ linkOnInstall: false })
    const holder = createLateBoundPresetService<string>({
      create: (port, profileDir) => {
        seen.port = port
        seen.profileDir = profileDir
        return 'ready'
      },
    })
    holder.wire(fake.port, '/profile/web')
    expect(seen.port).toBe(fake.port)
    expect(seen.profileDir).toBe('/profile/web')
    expect(holder.service()).toBe('ready')
  })
})
