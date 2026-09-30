/**
 * [INPUT]: 依赖官方 slots/remote/connection 生命周期事件、EnterpriseAccountStore，以及宿主 ui-theme 与 shortcuts 服务（按需读取，不作硬注入），不创建传输连接
 * [OUTPUT]: 注册账号/插件设置、官方 settings.launcher 座位上的账号菜单，以及官方插件页「官方」分组里的「插件市场」入口卡片；宿主模型/凭据变化后按需读取状态，让请求触发的认证失效立即呈现；向菜单注入官方主题只读源、桌面能力面（动作 + 更新状态）与官方快捷键注册表只读源
 * [POS]: dsh-ui 的浏览器组合根，只向 React 注入共享脱敏 store、主题源、桌面能力面与快捷键源，不注册任何全屏阻断层、侧栏入口或独立市场弹层，也不传递 Host Context
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from 'react'
import { EnterpriseAccountMenu } from './account-menu.js'
import { EnterpriseAccountStore } from './account-store.js'
import { EnterpriseSettingsSection } from './account-view.js'
import { createEnterpriseDesktopSource } from './desktop-runtime.js'
import { createEnterpriseLocalApi } from './local-api.js'
import {
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  EnterpriseMarketBadge,
  EnterpriseMarketPage,
} from './marketplace-entry.js'
import { createEnterpriseShortcutsSource } from './shortcuts-view.js'
import {
  createEnterpriseShortcutsReachIn,
  enterpriseShortcutDialogCount,
  enterpriseShortcutsVersionText,
} from './shortcuts-open.js'
import { createEnterpriseThemeSource } from './theme-options.js'

export * from './account-menu.js'
export * from './account-store.js'
export * from './account-state.js'
export * from './account-view.js'
export * from './branding.js'
export * from './desktop-runtime.js'
export * from './feedback-dialog.js'
export * from './help-link.js'
export * from './login-dialog.js'
export * from './local-api.js'
export * from './maintenance-view.js'
export * from './marketplace-entry.js'
export * from './menu-model.js'
export * from './menu-styles.js'
export * from './plugin-market.js'
export * from './session-view.js'
export * from './shortcuts-open.js'
export * from './shortcuts-view.js'
export * from './usage-panel.js'

interface SlotContextPort {
  readonly remote: {
    $on(event: 'llm/adapters-updated' | 'credentials/reference-updated' | 'settings/document-updated', listener: () => void): () => void
  }
  /** 无注入需求地读取服务；ui-theme 缺席或晚于本插件 provide 时都返回 undefined。 */
  get(name: string): unknown
  on(event: 'connection/reset' | 'theme/change', listener: () => void): () => void
  /** 以子插件等待服务出现，本插件不硬注入 ui-theme。 */
  inject(deps: readonly string[], callback: () => void): unknown
  effect(effect: () => () => void, label: string): void
  /** 官方宿主 logger（结构读取）；没有它时 warn 退到 console，绝不静默。 */
  readonly logger?: { readonly warn?: (message: string, ...rest: unknown[]) => void } | undefined
  readonly slots: {
    inject(name: string, register: () => unknown): unknown
    register(
      options: Readonly<Record<string, unknown>>,
      component: (props: never) => ReactNode,
    ): unknown
    /**
     * 官方 slot 台账的只读快照（0.1.7-rc.2 `Slots.entries(key)`）。
     *
     * 只给「快捷键」的 reach-in 用：官方没有受支持 API 打开它自己的「编辑快捷键」对话框，
     * 产品裁决 B 允许摸这个私有 store。形状不认识时打开器走降级，不抛错。
     */
    entries?(name: string): readonly unknown[]
  }
}

/** Required Client service; target declaration lifetime is handled by `slots.inject()`. */
export const inject = ['slots', 'remote']

/** 复用三个官方 slot 类型注册账号设置、个人中心菜单与插件页市场入口；网络能力只封装在共享 store 内。 */
export function apply(ctx: SlotContextPort): void {
  const store = new EnterpriseAccountStore(createEnterpriseLocalApi())
  // 官方主题服务由 ui-theme provide；这里只建只读源，真正读取发生在菜单渲染时。
  const theme = createEnterpriseThemeSource(ctx)
  // 桌面能力面：动作面与更新状态各自探测（Harness 只有 updates，fork 才有 renderer-action）。
  const desktop = createEnterpriseDesktopSource()
  ctx.effect(() => () => { desktop.updates.dispose() }, 'owndsh: desktop update carrier')
  // 官方快捷键注册表由 @deepseek-ai/dsh-client-shortcuts provide；缺席时源为空，入口退回 launcher 键帽。
  const shortcuts = createEnterpriseShortcutsSource(ctx)
  /**
   * 「快捷键」的 reach-in 打开器（unsupported workaround，产品裁决 B）：官方没有受支持 API 打开它自己的
   * 「编辑快捷键」对话框，只能逐级可选链摸 `shell.overlay` 上的私有 store，并用限时探针校验对话框真的出现了。
   * 失败只记一次 warn（含官方版本摘要）并让菜单走「一览 + 引导」降级——版本号不作为拒绝执行的条件。
   */
  const shortcutsOpener = createEnterpriseShortcutsReachIn({
    probe: { dialogCount: () => (typeof document === 'undefined' ? 0 : enterpriseShortcutDialogCount(document)) },
    slots: { entries: name => (typeof ctx.slots.entries === 'function' ? ctx.slots.entries(name) : []) },
    version: () => enterpriseShortcutsVersionText(ctx.get('shortcuts')),
    warn: message => {
      const logger = ctx.logger
      if (typeof logger?.warn === 'function') { logger.warn(message); return }
      // 宿主没有 logger 时的可见兜底：浏览器控制台的这一条 warn 是唯一留痕处。
      console.warn(message)
    },
  })
  ctx.effect(() => {
    const refresh = () => { void store.refresh() }
    const disposers = [
      ctx.remote.$on('llm/adapters-updated', refresh),
      ctx.remote.$on('credentials/reference-updated', refresh),
      ctx.remote.$on('settings/document-updated', refresh),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'owndsh: refresh account on Host changes')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'enterprise',
    order: 25,
    label: '企业设置',
    inject: () => ({ store }),
  }, EnterpriseSettingsSection as (props: never) => ReactNode))
  ctx.slots.inject('settings.launcher', () => ctx.slots.register({
    name: 'settings.launcher',
    inject: () => ({ desktop, shortcuts, shortcutsOpener, store, theme }),
  }, EnterpriseAccountMenu as (props: never) => ReactNode))
  // 官方插件页「官方」分组里的入口卡片：只占官方 plugins.item 槽位，
  // 不新增侧栏入口、不顶替官方插件页；注入共享 store 让详情页开关/登录弹窗真实可用。
  ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item',
    id: ENTERPRISE_MARKET_ENTRY_ID,
    order: ENTERPRISE_MARKET_ENTRY_ORDER,
    label: ENTERPRISE_MARKET_ENTRY_LABEL,
    inject: () => ({ store }),
  }, EnterpriseMarketPage as (props: never) => ReactNode))
  // 「预览版」签 + 总开关走官方 plugins.detail.badge 槽（titleRow 里 h3 旁），与标题同排；
  // 注入共享 store 让开关读会话状态并开登录弹窗；对非本条目 subject 返回 null（官方槽语义）。
  ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
    name: 'plugins.detail.badge',
    id: ENTERPRISE_MARKET_ENTRY_ID,
    inject: () => ({ store }),
  }, EnterpriseMarketBadge as (props: never) => ReactNode))
}
