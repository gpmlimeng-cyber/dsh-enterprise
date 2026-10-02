/**
 * [INPUT]: 依赖官方 slots/remote/connection 生命周期事件、EnterpriseAccountStore、brand-occupants 的三个品牌占用者与品牌座位源（`createEnterpriseBrandingSeats`／`bindEnterpriseBrandSeat`），以及宿主 ui-theme 与 shortcuts 服务（按需读取，不作硬注入），不创建传输连接；**本刀新增**资料库的本地设置门 `createEnterpriseLibraryGate`、目录取数源 `createEnterpriseLibraryCatalogSource` 与两处座位的接线器 `bindEnterpriseLibrarySeats`
 * [OUTPUT]: 注册账号/插件设置、官方 settings.launcher 座位上的账号菜单、官方插件页「官方」分组里的「插件市场」入口卡片（注册 `EnterpriseMarketLegacyPage`：官方两行卡片 + **点技能行本体在该 page 视图内整页切换到技能详情子页面**，**这是唯一市场入口**）与详情页标题行（`plugins.detail.badge` 槽只出「版本号 + 包名」，无「预览版」签、无可拨总开关）；「独立应用商店」的两处注册（官方 `main` 槽上的 `enterprise-store` 整页面板与 `sidebar.panellist` 一级入口，order 20）已在上一刀撤掉，本刀把它留下的 store 外壳死代码（`EnterpriseMarketStorePage`／`EnterpriseStoreIcon`／`ENTERPRISE_STORE_*`／HERO 与其样式文案／只服务它的搜索框）从 `marketplace-entry.tsx` 一并删除；**本刀新增企业品牌的三处消费点**：侧栏品牌行的两格（`sidebar.brand.mark`／`sidebar.brand.name`，priority **-10** 遮蔽官方 priority 0 的鱼标与字标）与「新会话」Hero 的品牌位（`conversation.hero.brand.mark`，priority **0**，官方无占用者），三处都经 `bindEnterpriseBrandSeat` 由品牌视图驱动——有企业品牌才注册、未配置或取数失败就撤掉注册，官方鱼标／官方 HeroFish 原样接管（渲染器 single 槽只要有 occupant 就不再走 `opts.fallback`，故「占用者返回 null」不能当降级路径）；宿主模型/凭据变化后按需读取状态，让请求触发的认证失效立即呈现；向菜单注入官方主题只读源、桌面能力面（动作 + 更新状态）与官方快捷键注册表只读源 **本刀（资料库）**：`apply` 末尾新增资料库的两处座位接线——`createEnterpriseLibraryGate`（本机设置里的管理门，默认关）驱动 `bindEnterpriseLibrarySeats` 在 `sidebar.panellist`（id `library`）与 `main`（key 同名）上做**视图驱动的注册/注销**（关就真撤，复用 brand-occupants 那套手法），并建一份目录取数源经 `main` 的 inject 面交给页面；`plugins.item` 的 inject 面因此从 `{store}` 扩成 `{store, libraryGate}`（组件行那枚「资料库」开关与企业会话 store 是两回事）。
 * [POS]: dsh-ui 的浏览器组合根，只向 React 注入共享脱敏 store、主题源、桌面能力面与快捷键源，并把企业品牌的三个展示位挂到官方已声明的槽位上（品牌读取与 logo 渲染仍归 branding.ts，本文件不复制品牌逻辑），不注册任何全屏阻断层，也不自建第二份逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from 'react'
import { EnterpriseAccountMenu } from './account-menu.js'
import { EnterpriseAccountStore } from './account-store.js'
import { EnterpriseSettingsSection } from './account-view.js'
import {
  bindEnterpriseBrandSeat,
  createEnterpriseBrandingSeats,
  ENTERPRISE_HERO_BRAND_MARK_SEAT,
  ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT,
  ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT,
  EnterpriseHeroBrandMark,
  EnterpriseSidebarBrandMark,
  EnterpriseSidebarBrandName,
} from './brand-occupants.js'
import { createEnterpriseDesktopSource } from './desktop-runtime.js'
import { bindEnterpriseLibrarySeats } from './library-entry.js'
import { createEnterpriseLibraryGate } from './library-gate.js'
import { createEnterpriseLibraryCatalogSource } from './library-panel.js'
import { createEnterpriseLocalApi } from './local-api.js'
import {
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  EnterpriseMarketBadge,
  EnterpriseMarketLegacyPage,
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
export * from './brand-occupants.js'
export * from './branding.js'
export * from './desktop-runtime.js'
export * from './feedback-dialog.js'
export * from './help-link.js'
export * from './library-entry.js'
export * from './library-gate.js'
export * from './library-panel.js'
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

/**
 * Required Client services; target declaration lifetime is handled by `slots.inject()`.
 * `layout` 已随侧栏「应用商店」两处注册一并撤掉：它当初只为「从商店跳回官方插件列表」声明，
 * 而全仓（src 与 tests）没有一处消费 `ctx.layout`／`selectPanel`，唯一使用场景
 * （`enterprise-store` 主内容区面板）本刀已删，故不再保留这条无人消费的硬注入声明。
 */
export const inject = ['slots', 'remote']

/** 复用官方 slot 类型注册账号设置、个人中心菜单、插件页市场卡片／详情徽标（市场入口只剩官方插件页这一处）；网络能力只封装在共享 store 内。 */
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
  // 官方插件页「官方」分组里的入口卡片：**唯一市场入口**（卡片不改成跳转、不删除）。
  // 点进去的 `page` 视图走 `EnterpriseMarketLegacyPage`（9723a97 那一版两行卡片；点技能行本体在该视图内
  // **整页切换**到技能详情子页面）。注入共享 store 让行上开关与登录弹窗真实可用。
  // 「独立应用商店」的两处注册（官方 `main` 槽上的 `enterprise-store` 整页面板 + `sidebar.panellist`
  // 上的「应用商店」一级入口）已在上一刀撤掉，随之失去引用的 store 外壳死代码（`EnterpriseMarketStorePage`／
  // `EnterpriseStoreIcon`／`ENTERPRISE_STORE_*`／HERO／只服务它的搜索框）已从 `marketplace-entry.tsx` 一并删除。
  ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item',
    id: ENTERPRISE_MARKET_ENTRY_ID,
    order: ENTERPRISE_MARKET_ENTRY_ORDER,
    label: ENTERPRISE_MARKET_ENTRY_LABEL,
    // `libraryGate` 是「包含内容」里「资料库」那一行的管理开关（本机设置）：与设置区/个人中心共享的
    // 企业账号 store 不是一回事——一个是企业会话真值，一个是本机开关，故各注入各的。
    inject: () => ({ store, libraryGate }),
  }, EnterpriseMarketLegacyPage as (props: never) => ReactNode))
  // 详情页标题行（官方 titleRow 的 h3 旁）只出「版本号 + 包名」——纯噪音的「预览版」文字签已删，
  // 标题行也没有可拨总开关（产品决策：拨不动的开关像坏的；功能开关在各行与「组件」页签里）。
  // 注入共享 store 让版本签读组件版本；对非本条目 subject 返回 null（官方槽语义）。
  ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
    name: 'plugins.detail.badge',
    id: ENTERPRISE_MARKET_ENTRY_ID,
    inject: () => ({ store }),
  }, EnterpriseMarketBadge as (props: never) => ReactNode))
  /**
   * 企业品牌的三处消费点（本刀）：侧栏品牌行（官方 `sidebar.brand.mark`／`sidebar.brand.name`，都是
   * `{kind:'single',scope:'root'}`）与「新会话」Hero 的品牌位（`conversation.hero.brand.mark`）。
   * 侧栏两格被官方 `dsh-client-ui-brand-official` 以 priority 0 占着，而 single 槽「同 priority 冲突抛错、
   * 取每格第一个活条目（priority 升序）」，故用 -10 遮蔽官方（官方原话 lowest renders）；Hero 那格官方
   * 无占用者（`occupants: []`／`replaceRisk:'none'`），0 即可。
   *
   * 注册面由品牌视图驱动（`bindEnterpriseBrandSeat`）：**有企业品牌才注册**，未配置或取数失败就撤掉，
   * 让官方鱼标／官方 HeroFish 原样接管——渲染器对 single 槽只要有 occupant 就直接渲染它、`opts.fallback`
   * 不再生效，所以「占用者返回 null」只会把那一格弄空，不能当降级路径（官方行为必须一字不变）。
   */
  const brandingSeats = createEnterpriseBrandingSeats(store)
  ctx.effect(() => brandingSeats.start(), 'owndsh: enterprise branding seats')
  bindEnterpriseBrandSeat(ctx.slots, brandingSeats, ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT, EnterpriseSidebarBrandMark as (props: never) => ReactNode)
  bindEnterpriseBrandSeat(ctx.slots, brandingSeats, ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT, EnterpriseSidebarBrandName as (props: never) => ReactNode)
  bindEnterpriseBrandSeat(ctx.slots, brandingSeats, ENTERPRISE_HERO_BRAND_MARK_SEAT, EnterpriseHeroBrandMark as (props: never) => ReactNode)
  /**
   * **资料库**（本刀）：管理门（本机设置，默认**关**）与目录取数源各建一份，排在既有座位之后。
   *
   * 门是唯一真源：组件行那枚 Switch 读它（经 `plugins.item` 的 inject 面交给市场页）、侧栏一级入口与
   * `main` 面板两处座位的注册/注销也由它驱动（`bindEnterpriseLibrarySeats` 复用 `brand-occupants.tsx`
   * 的「有内容才占座、没有就真撤」手法——官方槽只要有占用者就不走 fallback，所以关着的时候必须真撤）。
   * 取数端口这一刀还是缺席的（宿主侧资料库还没接线），故页面如实出「接入中」的失败态 + 重试——
   * 这正是产品宪法要的「失败要说人话 + 下一步」，而不是拿空列表假装「公司没给你资料」。
   */
  const libraryGate = createEnterpriseLibraryGate()
  const librarySource = createEnterpriseLibraryCatalogSource()
  ctx.effect(() => () => { librarySource.reset() }, 'owndsh: library catalog source')
  bindEnterpriseLibrarySeats(ctx.slots, libraryGate, librarySource)
}
