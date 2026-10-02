/**
 * [INPUT]: 只依赖 cordis 的类型面（`Inject`）、`./install.js` 的官方安装端口契约与两个 `*FromContext` 取值器、`./errors.js` 的稳定码
 * [OUTPUT]: 对外提供**两条官方接线共用的** `deferOfficialServiceWiring`（官方 inject 声明 + 延迟解析 + `step=deferred/wired/unavailable/port-rejected/unwired` 判定点），
 *           以及它的配方包装 `deferEnterprisePresetWiring`：把「配方一键启用」的宿主接线从**一次性 `ctx.get`** 改成**官方口径的 inject 声明 + 延迟解析**——官方 `pluginManager`（以及 `profileContext`）在 apply() 的那一刻还没被 provide 时不解散，服务出现后回调被 Cordis 重新装载，端口**届时**才交给路由；服务真不可用则一直不交，路由家族仍按 `ENT_INVALID_REQUEST` fail-closed
 * [POS]: bundle 配方纵深的**时序边界层**。这里只解决一件事——「服务何时可用」不归 apply() 的那一刻裁决；
 *        受管插件安装面（`../manager-wiring.ts`）复用同一份实现，故两条线不可能各写一套时序。安装端口本身的语义仍在 `./install.ts`，码→HTTP 状态仍在 platform-client 的 `local-api.ts`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Inject } from '@deepseek-ai/cordis'
import { EnterprisePresetError } from './errors.js'
import {
  officialPresetInstallPort,
  presetPluginManagerFromContext,
  presetProfileDirFromContext,
  type OfficialPluginManagerLike,
  type PresetInstallPort,
} from './install.js'

/**
 * 延迟解析要等的那两个官方服务。
 *
 * 两者都按官方口径用可选读法 `ctx.get(name)` + undefined 检查（官方 Inspect 面把
 * `ctx.get("pluginManager")` 标为 `requiresUndefinedCheck: true`）。写成 `readonly` 元组是为了
 * 让调用方一眼看出这份声明会被 Cordis 当依赖用，而不是被就地修改。
 */
export const PRESET_WIRING_SERVICES: readonly ['pluginManager', 'profileContext'] =
  ['pluginManager', 'profileContext']

/** 接线时的判定点留痕；`message` 只进 Host 日志，不进任何响应体。 */
export interface EnterprisePresetWiringLog {
  /**
   * @param level - `warn` 是「此刻仍不可用 / 服务被撤下（已 fail-closed）」，
   *                `error` 是「服务在但官方端口拒绝我们 / 解析抛错」，`info` 是正常就绪。
   * @param message - 已带 `[operation=wirePreset …]` 判定点串的说明。
   * @param error - 可选原始 error（只进 Host 日志）。
   */
  (level: 'info' | 'warn' | 'error', message: string, error?: unknown): void
}

export interface EnterprisePresetWiringOptions {
  /** 官方服务就绪、端口已绑定时回调；三条配方路由的**唯一**安装面来源。 */
  readonly onWired: (port: PresetInstallPort, profileDir: string) => void
  /**
   * 服务被撤下（provider 卸载 / fiber 失效）时回调。
   * 缺省时仍 fail-closed：路由保持在上一次绑定的端口上「不静默换实现」，只由日志说明已撤下。
   */
  readonly onUnwired?: () => void
  /** 判定点留痕；缺省即静默（单测）。宿主接线必须传，否则「服务就绪」无可见判据。 */
  readonly log?: EnterprisePresetWiringLog
  /**
   * 覆盖要等待的服务集（仅在测试里用；生产一律 `PRESET_WIRING_SERVICES`）。
   * 保留成可注入是为了让「服务稍后才就绪」那条单测不必伪造 profile 启动。
   */
  readonly services?: readonly string[]
}

/** `ctx.inject(deps, callback)` 与 `ctx.logger` 只需要窄结构，便于单测注入假 ctx。 */
export interface EnterprisePresetWiringContext {
  inject(deps: Inject, callback: (ctx: EnterprisePresetWiringContext) => unknown): unknown
  readonly logger: {
    info(message: string, ...rest: unknown[]): void
    warn(message: string, ...rest: unknown[]): void
    error(message: string, ...rest: unknown[]): void
  }
}

/** 服务已就绪前交给路由的端口：**不是** 400 缺口，而是「安装面此刻不可用」的 fail-closed 端口。 */
export function unavailablePresetInstallPort(): PresetInstallPort {
  const refuse = (): never => {
    throw new EnterprisePresetError(
      'ENT_PRESET_INSTALL_FAILED',
      'the official plugin manager is not available on this profile yet',
    )
  }
  return {
    installBundle: async () => refuse(),
    removeBundle: async () => refuse(),
  }
}

/**
 * 把「端口是否已就绪」与「谁在持有已就绪的端口」分开：持有者实例**一次创建、长期不变**，
 * 内部状态随官方服务出现/撤下而变。
 *
 * 这是本缺陷的**第二个冻结点**：`EnterprisePlatformService` 的构造参数是在 apply() 里
 * 用对象字面量 + `{...}` 展开拼出来的，一旦把端口写成「端口缺席就不展开」，那份判决就被
 * 快照进服务对象，之后服务就绪也进不了路由。持有者让每个端口在**调用时**实时解引用。
 */
export interface LateBoundPresetService<T> {
  /** 当前已就绪的服务；未就绪即 `undefined`（调用方据此 fail-closed）。 */
  service(): T | undefined
  /** 端口已交给路由：内部状态变为「就绪」。 */
  wire(port: PresetInstallPort, profileDir: string): void
  /** 官方服务被撤下：回到未就绪态（已装记录仍在盘上，不因此丢）。 */
  unwire(): void
}

export interface LateBoundPresetServiceOptions<T> {
  /** 用**刚解析到的**官方端口与 profile 目录造出服务实例。 */
  readonly create: (port: PresetInstallPort, profileDir: string) => T
}

/**
 * 造一个晚绑定持有者。
 *
 * @param options - 就绪时怎样造服务实例。
 * @returns 端口句柄：`wire()` 之前 `service()` 恒为 `undefined`（三条路由因此抛稳定码 503，fail-closed）。
 */
export function createLateBoundPresetService<T>(
  options: LateBoundPresetServiceOptions<T>,
): LateBoundPresetService<T> {
  let current: T | undefined
  return {
    service: () => current,
    wire: (port, profileDir) => {
      current = options.create(port, profileDir)
    },
    unwire: () => {
      current = undefined
    },
  }
}

/** 与既有 `[operation=wirePreset step=unavailable pluginManager=absent …]` 同族的判定点串。 */
function availability(manager: unknown, profileDir: string | undefined): string {
  return `pluginManager=${manager === undefined ? 'absent' : 'ready'}`
    + ` profileDir=${profileDir === undefined ? 'absent' : 'ready'}`
}

/**
 * 一个官方服务面接线的**全部文案**（只进 Host 日志）：两条线（配方一键启用 / 受管插件安装面）用同一套
 * 判定点语法，只有操作名与主语不同。
 */
export interface OfficialServiceWiringTexts {
  /** `step=deferred`：apply() 那一刻服务还没 provide（正常等待，不是终局）。 */
  readonly waiting: string
  /** `step=resolve-threw`：读服务本身抛了（兜底，别把 inject fiber 打成 FAILED）。 */
  readonly readFailed: string
  /** `step=unavailable`：依赖声明了却读不到，或 profile 落点缺席（fail-closed，不接线）。 */
  readonly unavailable: string
  /** `step=port-rejected`：服务在，但它不接受我们这枚端口（形状不符）。 */
  readonly rejected: string
  /** `step=wired`：端口已交给路由（就绪的可见判据）。 */
  readonly wired: string
  /** `step=unwired`：服务被撤下。 */
  readonly unwired: string
}

export interface OfficialServiceWiringOptions<T> {
  /** 判定点里的 operation 名（`wirePreset` / `wirePluginManager`）。 */
  readonly operation: string
  readonly texts: OfficialServiceWiringTexts
  /**
   * 要等待的服务集；缺省 `PRESET_WIRING_SERVICES`（两条线都等 `pluginManager` + `profileContext`：
   * 官方 `installBundle` 没有 profile 落点就无处可装，故落点缺席与端口缺席同判）。
   */
  readonly services?: readonly string[]
  /** 判定点留痕；缺省即静默（单测）。宿主接线必须传，否则「服务就绪」无可见判据。 */
  readonly log?: EnterprisePresetWiringLog
  /**
   * 「官方服务面是否可达」的判据（缺省 `presetPluginManagerFromContext`：`installBundle` + `removeBundle`）。
   *
   * 它是 `step=unavailable` 里 `pluginManager=absent|ready` 那一位的**真源**，也是「接线前服务是否存在」
   * 的判定：各条线可以有自己的形状门禁——受管插件那条多要 `waitForInstall`/`cancelInstall`
   * （缺 `cancelInstall` 时界面那枚取消键就是假的，故整条判不可达），于是它交自己的取值器进来，
   * 让日志与判决**同时**按更严的那一道说真话。
   */
  readonly probe?: (ctx: { get(name: string): unknown }) => unknown
  /**
   * 服务集齐后从**刚解析到的** ctx 取端口；返回 `undefined` 即「服务面不可达」（不接线）。
   * 抛错即「服务在但拒绝了这枚端口」——由本函数翻成 `step=port-rejected`。
   */
  readonly resolve: (ctx: { get(name: string): unknown }, profileDir: string) => T | undefined
  /** 就绪回调：拿到**刚解析到的**端口与 profile 目录。 */
  readonly onWired: (value: T, profileDir: string) => void
  /** 服务被撤下（provider 卸载 / fiber 失效）时回调。 */
  readonly onUnwired?: () => void
}

/**
 * 把**任意官方服务面**延迟接到调用方（官方 inject 语义，见 `cordis/src/registry.ts` 的
 * `RegistryService.inject`：`ctx.inject(deps, cb)` ≡ `ctx.plugin({ inject, apply: cb })`，
 * 依赖齐备前 fiber 停在 PENDING，依赖出现或被替换时回调**被重新装载**）。
 *
 * 这是本仓两条官方接线的**唯一**实现：`deferEnterprisePresetWiring`（配方一键启用）与
 * `deferEnterprisePluginManagerWiring`（受管插件安装/卸载/取消）都只是它的薄包装——两处等待的
 * 是同一件真机事实（官方 plugin-manager 与本 bundle 在同一棵 loader 树里**并发 create**），
 * 故「取服务的时序」不允许各写一份。
 *
 * 三条纪律（与配方那条逐字相同）：
 * 1. **不在 apply() 那一刻定生死**（一次性 `ctx.get` 在服务 provide 之前拿到 undefined 且永不重试）。
 * 2. **服务真不可用时仍然 fail-closed**：不猜第二条安装通道，调用方按自己的稳定码拒。
 * 3. **就绪判据必须可见**：绑成功打一条 `step=wired` info，把 `pluginManager=ready profileDir=ready` 写进启动日志。
 *
 * @param ctx - bundle 组合根上下文（或单测的假 ctx）。
 * @param options - 文案、端口解析与就绪/撤下回调。
 * @returns 立刻返回；端口在服务就绪的**那一刻**才经 `onWired` 交给调用方。
 */
export function deferOfficialServiceWiring<T>(
  ctx: EnterprisePresetWiringContext,
  options: OfficialServiceWiringOptions<T>,
): void {
  const services = options.services ?? PRESET_WIRING_SERVICES
  const probe = options.probe ?? presetPluginManagerFromContext
  const report: EnterprisePresetWiringLog = options.log ?? ((level, message, error) => {
    if (level === 'info') {
      ctx.logger.info(message)
      return
    }
    if (level === 'error') {
      ctx.logger.error(message, error)
      return
    }
    ctx.logger.warn(message)
  })
  const texts = options.texts

  // 第一次判定：apply() 那一刻的真实可见性。真机上这里通常就是 absent——它必须是「等待中」而不是终局。
  const readable = ctx as unknown as { get(name: string): unknown }
  report('warn', `${texts.waiting} [operation=${options.operation} step=deferred ${availability(
    probe(readable),
    presetProfileDirFromContext(readable),
  )}]`)

  ctx.inject(services as Inject, (serviceCtx) => {
    let present: unknown
    let profileDir: string | undefined
    try {
      const serviceReadable = serviceCtx as unknown as { get(name: string): unknown }
      present = probe(serviceReadable)
      profileDir = presetProfileDirFromContext(serviceReadable)
    } catch (error) {
      // cordis 的 `ctx.get` 本身不抛；这里只兜真出现异常时别把 inject fiber 打成 FAILED。
      report('error', `${texts.readFailed} [operation=${options.operation} step=resolve-threw]`, error)
      return
    }
    if (present === undefined || profileDir === undefined) {
      // 声明了依赖却仍读不到：如实记 unavailable 并**不接线**（调用方 fail-closed）。
      report('warn', `${texts.unavailable}`
        + ` [operation=${options.operation} step=unavailable ${availability(present, profileDir)}]`)
      return
    }
    let port: T
    try {
      const resolved = options.resolve(serviceCtx as unknown as { get(name: string): unknown }, profileDir)
      if (resolved === undefined) {
        report('warn', `${texts.unavailable}`
          + ` [operation=${options.operation} step=unavailable ${availability(present, profileDir)}]`)
        return
      }
      port = resolved
    } catch (error) {
      report('error', `${texts.rejected}`
        + ` [operation=${options.operation} step=port-rejected ${availability(present, profileDir)}]`, error)
      return
    }
    options.onWired(port, profileDir)
    report('info', `${texts.wired}`
      + ` [operation=${options.operation} step=wired ${availability(present, profileDir)}]`)
    // 服务被撤下（官方 plugin-manager 卸载 / fiber 失效）时：留一条 warn 作判据，不静默换实现。
    return () => {
      report('warn', `${texts.unwired}`
        + ` [operation=${options.operation} step=unwired ${availability(undefined, profileDir)}]`)
      options.onUnwired?.()
    }
  })
}

/**
 * 把官方安装面**延迟**接到配方路由上（`deferOfficialServiceWiring` 的配方包装，文案逐字不变）。
 *
 * 三条纪律与判定点串见 `deferOfficialServiceWiring`；端口本身的语义仍在 `./install.ts`。
 *
 * @param ctx - bundle 组合根上下文（或单测的假 ctx）。
 * @param options - 就绪/撤下回调与留痕端口。
 * @returns 立刻返回；端口在服务就绪的**那一刻**才经 `onWired` 交给路由。
 */
export function deferEnterprisePresetWiring(
  ctx: EnterprisePresetWiringContext,
  options: EnterprisePresetWiringOptions,
): void {
  deferOfficialServiceWiring<PresetInstallPort>(ctx, {
    operation: 'wirePreset',
    texts: {
      waiting: 'owndsh: preset one-click enable is waiting for the official plugin manager',
      readFailed: 'owndsh: preset one-click enable could not read the official services',
      unavailable: 'owndsh: preset one-click enable is not wired on this profile',
      rejected: 'owndsh: the official plugin manager does not expose installBundle/removeBundle',
      wired: 'owndsh: preset one-click enable is wired to the official plugin manager',
      unwired: 'owndsh: the official plugin manager went away; preset one-click enable falls back',
    },
    ...(options.services === undefined ? {} : { services: options.services }),
    ...(options.log === undefined ? {} : { log: options.log }),
    resolve: readable => {
      const manager = presetPluginManagerFromContext(readable)
      if (manager === undefined) return undefined
      // 形状不符时 `officialPresetInstallPort` 抛错 ⇒ 由上面翻成 `step=port-rejected`。
      return officialPresetInstallPort(manager)
    },
    onWired: (port, profileDir) => { options.onWired(port, profileDir) },
    ...(options.onUnwired === undefined ? {} : { onUnwired: options.onUnwired }),
  })
}
