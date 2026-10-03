/**
 * [INPUT]: 依赖 `./preset/wiring.js` 的**唯一一份**官方延迟接线实现、plugin-distribution 的官方安装面取值器与结构类型（`managedPluginManagerFromContext` / `OfficialPluginManagerLike`）、cordis 的类型面
 * [OUTPUT]: 对外提供 `deferEnterprisePluginManagerWiring`——把**受管插件安装/卸载/取消**这一条线的官方服务面（`pluginManager`）按同一套 inject 语义**延迟**接出来
 * [POS]: bundle 的**第二条官方接线**（第一条是配方一键启用）。它刻意薄到只剩文案与取值器：时序、判定点语法、
 *        「服务被撤下」的回调语义全部复用 `./preset/wiring.js` 的 `deferOfficialServiceWiring`——
 *        两条线等的是同一件真机事实（官方 plugin-manager 与本 bundle 在同一棵 loader 树里并发 create），
 *        故绝不允许各写一套「何时算就绪」的判决
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  managedPluginManagerFromContext,
  type OfficialPluginManagerLike,
} from '@dshent/plugin-distribution'
import {
  deferOfficialServiceWiring,
  type EnterprisePresetWiringContext,
  type EnterprisePresetWiringLog,
} from './preset/wiring.js'

/** 受管插件安装面要等的两个官方服务：`pluginManager` 本体与 profile 落点（官方 `installBundle` 就落在那儿）。 */
export const PLUGIN_MANAGER_WIRING_SERVICES: readonly ['pluginManager', 'profileContext'] =
  ['pluginManager', 'profileContext']

export interface EnterprisePluginManagerWiringOptions {
  /** 官方服务就绪、端口已绑定时回调；`manager` 就是**刚解析到**的那一枚官方服务。 */
  readonly onWired: (manager: OfficialPluginManagerLike, profileDir: string) => void
  /** 服务被撤下（provider 卸载 / fiber 失效）时回调；此时安装面必须回到 fail-closed。 */
  readonly onUnwired?: () => void
  /** 判定点留痕；缺省即静默（单测）。宿主接线必须传，否则「服务就绪」无可见判据。 */
  readonly log?: EnterprisePresetWiringLog
}

/**
 * 把官方安装面延迟接到受管插件分发服务上。
 *
 * 就绪判据是 `[operation=wirePluginManager step=wired pluginManager=ready profileDir=ready]`：
 * 它与配方那条 `wirePreset` 同族，启动日志里一眼能看出**两条线各自有没有接上**。
 * 形状门禁（五枚方法全在才算可达）在 plugin-distribution 的 `managedPluginManagerFromContext` 里，
 * 这里不重复判定：本函数只负责「何时」。
 *
 * @param ctx - bundle 组合根上下文（或单测的假 ctx）。
 * @param options - 就绪/撤下回调与留痕端口。
 * @returns 立刻返回；官方服务就绪的**那一刻**才经 `onWired` 交出服务。
 */
export function deferEnterprisePluginManagerWiring(
  ctx: EnterprisePresetWiringContext,
  options: EnterprisePluginManagerWiringOptions,
): void {
  deferOfficialServiceWiring<OfficialPluginManagerLike>(ctx, {
    operation: 'wirePluginManager',
    services: PLUGIN_MANAGER_WIRING_SERVICES,
    texts: {
      waiting: 'owndsh: managed plugin installation is waiting for the official plugin manager',
      readFailed: 'owndsh: managed plugin installation could not read the official services',
      unavailable: 'owndsh: managed plugin installation is not wired on this profile',
      rejected: 'owndsh: the official plugin manager does not expose installBundle/removeBundle/setBundleEnabled/waitForInstall/cancelInstall',
      wired: 'owndsh: managed plugin installation is wired to the official plugin manager',
      unwired: 'owndsh: the official plugin manager went away; managed plugin installation falls back',
    },
    ...(options.log === undefined ? {} : { log: options.log }),
    // 形状门禁（五枚方法全在）在 plugin-distribution 的取值器里；本函数只负责「何时」。
    // 它同时充当 `pluginManager=` 那一位的判据，故日志与判决用的是**同一道**更严的门禁。
    probe: readable => managedPluginManagerFromContext(readable),
    resolve: readable => managedPluginManagerFromContext(readable),
    onWired: (manager, profileDir) => { options.onWired(manager, profileDir) },
    ...(options.onUnwired === undefined ? {} : { onUnwired: options.onUnwired }),
  })
}
