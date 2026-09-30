/**
 * [INPUT]: 依赖 React、品牌位图 brand、lucide-react 三枚组件图标、官方 ui-primitives 的 Switch/Tag/StateDot（pinned 0.1.5-rc.2 的 .d.ts 已导出，不走 official-ui 收窄接缝）、account-state 的 `enterpriseSessionUsable` 与 account-store 的 `EnterpriseAccountSnapshot`（shared 面、订阅只在 WithStore 包装内），消费官方 `plugins.item` owner props（`view`/`form`）
 * [OUTPUT]: 提供官方插件页「官方」分组里的「插件市场」入口卡片与带「开关 + 组件列表」的详情页（布局逐值照官方 PackageDetail+RowsSection 实物），以及可脱离 DOM 测试的组件清单/计数摘要/组件状态纯投影与注册常量；卡片摘要与详情页正文**不重复同一句**——摘要只在 `summary` 视图出现（官方必渲染的那一份），详情页只留标题与组件列表
 * [POS]: ui 的企业扩展市场入口，只占官方 `plugins.item` 槽位（卡片一句话走 `summary`、详情正文走 `page`），不注册侧栏入口与独立市场弹层；store 与开登录回调均为可选注入（共享注册面经 `client.tsx` 的 `inject` 给本条目注入 store，缺席时降级为占位态，注入后自动升级为真值态）；组件行 `reserved` 只剩配方一行，插件与技能行随企业会话真值
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Package, Sparkles, BookMarked, ChevronDown } from 'lucide-react'
import { StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { enterpriseSessionUsable, useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { enterprisePluginStatePresentation } from './plugin-market.js'
import type { EnterprisePluginCatalogItem, EnterprisePluginItem, ManagedPluginState } from './local-api-decode.js'
import { EnterpriseLoginDialog, useEnterpriseLoginDialog } from './login-dialog.js'

/** 本入口在官方插件页占用的 slot id，同时是卡片 DOM 的 `data-plugin-item` 与详情页路由键。 */
export const ENTERPRISE_MARKET_ENTRY_ID = 'plugin-market'

/** 卡片与详情页共用的标题，官方把它渲染在卡片标题与详情页 `h3` 两处。 */
export const ENTERPRISE_MARKET_ENTRY_LABEL = '插件市场'

/** 在官方 `plugins.item` 中排在官方四个配置卡片（10/20/30/40）之后。 */
export const ENTERPRISE_MARKET_ENTRY_ORDER = 50

/** 卡片与详情页描述行共用的一句话；官方会把 `summary` 渲染两次，故必须保持单行。 */
export const ENTERPRISE_MARKET_SUMMARY = '企业插件 · 技能 · 配方'

/** 详情页组件列表真源：三行按交付顺序，`reserved` 决定状态点与开关禁用。 */
export const ENTERPRISE_MARKET_COMPONENTS = [
  { id: 'plugins', label: '插件', module: 'enterprise plugins · remote.pluginManager', note: '企业发布的插件与官方插件包', reserved: false },
  { id: 'skills', label: '技能', module: 'official skills/list', note: '企业发布的技能包与装配指令', reserved: false },
  { id: 'presets', label: '配方', module: 'dsh-preset / .dshpreset', note: '企业配方广场', reserved: true },
] as const

/** 详情页页签排期清单，按交付顺序；插件与技能已进入排期，配方仍为预留页签。 */
export const ENTERPRISE_MARKET_PLAN = [
  { id: 'plugins', label: '插件', note: '官方 / 已安装 / 企业插件 三分组' },
  { id: 'skills', label: '技能', note: '已排期' },
  { id: 'presets', label: '配方', note: '预留' },
] as const

/** 计数摘要分段，照官方 `partsSummary` 口径。 */
export type EnterpriseMarketSummary = { readonly total: number; readonly ready: number; readonly reserved: number }

/** 官方 `plugins.item` 送给注册者的业务字段。 */
export interface EnterpriseMarketEntryProps {
  /** 官方 dispatch 的视图：卡片一句话用 `summary`，详情页正文用 `page`。 */
  readonly view: 'summary' | 'page'
  /**
   * 官方对注册了配置命名空间的条目传入配置表单；本入口没有配置命名空间，
   * `PluginManagerPage.formFor()` 会提前返回 `undefined`，因此这里只声明不消费。
   */
  readonly form?: never
  /**
   * 企业账号共享 store：`EnterpriseMarketPage` 订阅它并把会话可用性/开登录回调喂给本纯函数体。
   * 本组件自身不调 hook（保持纯函数可测）；`store` 缺席时由调用方给 `sessionUsable=false`。
   */
  readonly store?: EnterpriseAccountStore | undefined
  /**
   * 会话可用性直传（测试用）：真运行时由 `EnterpriseMarketPage` 订阅 store 算出后传入，缺席取 false。
   */
  readonly sessionUsable?: boolean
  /**
   * 打开企业登录弹窗的回调：未登录时拨动总开关/组件开关触发；缺席时开关恒禁用（不提供假切换）。
   */
  readonly onOpenLogin?: (() => void) | undefined
  /**
   * 企业后台上传的真实插件目录（`store.pluginStatus.catalog`，经 hook 入口订阅后直传）。
   * 仅当「插件」组件开启（`sessionUsable`）时在页面追加「企业插件」节渲染；缺席/关闭时该节不出现。
   */
  readonly enterprisePlugins?: readonly EnterpriseMarketPluginRow[] | undefined
  /**
   * 企业插件的安装/卸载动作（`store.installPlugin` / `store.removePlugin`）；缺席时开关禁用。
   * 注：安装动作在 hook 入口调用后触发 store 刷新，本纯函数体不持 store。
   */
  readonly onTogglePlugin?: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined
  /**
   * 两节的折叠态（照官方 `PluginInventorySettingsTab`：`aria-expanded` + 默认折叠）。缺席视为全展开
   * （纯函数直调测试不传即得完整树）；真运行时由 `EnterpriseMarketPage` 的 `useState` 供给。
   */
  readonly expandedSections?: { readonly components: boolean; readonly enterprisePlugins: boolean } | undefined
  /** 折叠切换回调（点节头按钮触发）；缺席时节头按钮禁用（不提供死按钮）。 */
  readonly onToggleSection?: ((section: 'components' | 'enterprisePlugins') => void) | undefined
}

/** 节头的可点按钮 id 与内容区 id（`aria-controls` 用），两节各自独立。 */
export const ENTERPRISE_MARKET_SECTION_IDS = { components: 'components', enterprisePlugins: 'enterprise-plugins' } as const

/** 「企业插件」节的一行：企业后台上传的插件（catalog）+ 本机安装态。 */
export interface EnterpriseMarketPluginRow {
  readonly packageName: string
  /** 企业目录版本；已不在目录则取本机版本，都无则 null。 */
  readonly version: string | null
  /** 本机受管态（未安装/安装中/已装…）；无本机记录则 EXPECTED（可选安装）。 */
  readonly state: ManagedPluginState
  /** 企业目录是否仍提供（false = 已下架但本机仍装着）。 */
  readonly inCatalog: boolean
  /** 目录里的安装不可用原因（如不兼容/权限），有则禁安装。 */
  readonly installErrorCode?: string | undefined
}

/** 目录 + 本机态 → 可渲染的「企业插件」行（纯函数，按 packageName 归并，目录顺序优先）。 */
export function enterpriseMarketPluginRows(
  catalog: readonly EnterprisePluginCatalogItem[] = [],
  local: readonly EnterprisePluginItem[] = [],
): EnterpriseMarketPluginRow[] {
  const localByName = new Map(local.map(item => [item.packageName, item]))
  const names = [...new Set([...catalog.map(item => item.packageName), ...localByName.keys()])]
  return names.map((packageName) => {
    const cat = catalog.find(item => item.packageName === packageName)
    const rec = localByName.get(packageName)
    return {
      packageName,
      version: cat?.version ?? rec?.version ?? null,
      state: rec?.state ?? 'EXPECTED',
      inCatalog: cat !== undefined,
      installErrorCode: cat?.installErrorCode,
    }
  })
}

/** 「企业插件」节是否该渲染（「插件」组件开启且有目录/本机记录）。 */
export function enterpriseMarketPluginSectionVisible(
  pluginsComponentEnabled: boolean,
  rows: readonly EnterpriseMarketPluginRow[],
): boolean {
  return pluginsComponentEnabled && rows.length > 0
}

/**
 * 一节当前是否展开（照官方 `PluginInventorySettingsTab` 的 `searching || (open ?? false)`：
 * 官方搜索时强制展开，我们当前无搜索故退化为 `open ?? defaultOpen`；默认全折叠）。
 * @param expandedSections - 当前折叠态（缺席＝全展开，测试直调不传即得完整树）。
 * @param section - 节 id。
 * @param defaultOpen - 缺席时的默认展开值。
 * @returns 是否展开。
 */
export function enterpriseMarketSectionOpen(
  expandedSections: { readonly components: boolean; readonly enterprisePlugins: boolean } | undefined,
  section: 'components' | 'enterprisePlugins',
  defaultOpen = false,
): boolean {
  if (expandedSections === undefined) return defaultOpen
  return expandedSections[section]
}

/** 企业插件受管态 → 官方 StateDot 语义（已装绿/进行中蓝/等待或失败红棕/其余灰）。 */
export function enterprisePluginDot(state: ManagedPluginState): StateDotState {
  if (state === 'ACTIVE') return 'done'
  if (state === 'FAILED') return 'error'
  if (state === 'DOWNLOADING' || state === 'INSTALLING' || state === 'REMOVING') return 'ongoing'
  if (state === 'RESTART_REQUIRED' || state === 'REMOVE_PENDING' || state === 'ROLLBACK') return 'warning'
  return 'idle'
}

/** 入口卡片与详情页描述行共用的一句话。 */
export const enterpriseMarketEntrySummary = (): string => ENTERPRISE_MARKET_SUMMARY

/** 详情页预留的页签清单，按交付顺序。 */
export const enterpriseMarketEntryPlan = (): typeof ENTERPRISE_MARKET_PLAN => ENTERPRISE_MARKET_PLAN

/** 组件清单原样投影，按交付顺序。 */
export const enterpriseMarketComponents = (): typeof ENTERPRISE_MARKET_COMPONENTS => ENTERPRISE_MARKET_COMPONENTS

/** 每行组件当前是否可用（配方恒预留不可用；插件与技能行随企业会话真值）。 */
export function enterpriseMarketComponentEnabled(id: string, sessionUsable: boolean): boolean {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return false
  return sessionUsable
}

/** 组件状态行的可见文案：预留 → 预留；可用 → 可用；否则 → 需登录。 */
export function enterpriseMarketComponentState(id: string, sessionUsable: boolean): '预留' | '可用' | '需登录' {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return '预留'
  return sessionUsable ? '可用' : '需登录'
}

/** 组件状态点：预留与需登录都是 idle，可用是 done（照官方 StateDot 语义）。 */
export function enterpriseMarketComponentDot(id: string, sessionUsable: boolean): StateDotState {
  return enterpriseMarketComponentState(id, sessionUsable) === '可用' ? 'done' : 'idle'
}

/** 组件行开关是否禁用（预留恒禁用；插件/技能行在已可用或回调缺席时禁用，避免假切换）。 */
export function enterpriseMarketComponentSwitchDisabled(id: string, sessionUsable: boolean, hasLoginAction: boolean): boolean {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return true
  if (!hasLoginAction) return true
  return sessionUsable
}

/** 计数摘要三段：总可用/预留，照官方 partsSummary 的口径拆段。 */
export function enterpriseMarketComponentSummary(
  rows: readonly { readonly id: string }[] = ENTERPRISE_MARKET_COMPONENTS,
  sessionUsable = false,
): EnterpriseMarketSummary {
  const present = rows.filter(row => ENTERPRISE_MARKET_COMPONENTS.some(item => item.id === row.id))
  const reserved = present.filter(row => enterpriseMarketComponentState(row.id, sessionUsable) === '预留').length
  const ready = present.filter(row => enterpriseMarketComponentState(row.id, sessionUsable) === '可用').length
  return { total: present.length, ready, reserved }
}

/** 计数摘要三段拼成一行，照官方 `partsSummary` 的「共 N 个 · N 可用 · N 预留」口径。 */
export function enterpriseMarketComponentSummaryText(
  rows: readonly { readonly id: string }[] = ENTERPRISE_MARKET_COMPONENTS,
  sessionUsable = false,
): string {
  const summary = enterpriseMarketComponentSummary(rows, sessionUsable)
  return [`共 ${summary.total} 个`, summary.ready > 0 ? `${summary.ready} 可用` : '', summary.reserved > 0 ? `${summary.reserved} 预留` : '']
    .filter(Boolean)
    .join(' · ')
}

const styles = `
.own-market-entry{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-market-entry *{box-sizing:border-box}
.own-market-entry-summary{color:var(--dsw-alias-label-secondary,#667085)}
/* 包名：负 margin 抵消官方 .detailSections 的 margin-top 32，让它紧贴官方描述（照智能体团队 detailMain gap 8）。
   官方把 page 放在 detailSections（mt 32）而智能体团队的包名在 detailMain（gap 8）内——item 与 package 结构差异，只能在这里调平。 */
/* 包名在 badge 槽内换行成标题下独立一行（照官方 .detailName：mono 12/18 tertiary）。
   flex-basis:100% 借官方 titleRow 的 flex-wrap:wrap 让它独占一行，落在标题下、描述上（贴智能体团队 标题→包名→描述）；
   因官方 ItemDetail 只有 titleRow→desc 两行、描述间无独立插点，只能借 titleRow 换行。 */
.own-market-badge-name{flex-basis:100%;min-width:0;margin-top:4px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#98a2b3);overflow-wrap:anywhere}
.own-market-tag{flex:none;font-variant-numeric:tabular-nums}
.own-market-section{display:flex;flex-direction:column;gap:12px;min-width:0;margin-top:24px}
.own-market-sectionHead{display:flex;align-items:baseline;gap:10px;min-width:0}
.own-market-sectionTitle{margin:0;font-size:14px;line-height:20px;font-weight:500}
/* 节头可点按钮：照官方 groupToggle（flex none + gap8 + 无边框 + 透明 + 左对齐 + focus-ring）。 */
.own-market-groupToggle{display:flex;flex:none;align-items:center;gap:8px;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.own-market-groupToggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-groupToggle[disabled]{cursor:default}
.own-market-groupTitle{font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary,#101828)}
/* chevron：收起 rotate(-90°) → 展开 rotate(0)，照官方 groupToggle 的 .chevron 口径。 */
.own-market-chevron{flex:none;transform:rotate(-90deg);transition:transform .15s ease}
.own-market-groupToggle[aria-expanded='true'] .own-market-chevron{transform:none}
.own-market-sectionCount{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.own-market-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.own-market-row{padding:12px 2px;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);min-width:0}
.own-market-row:last-child{border-bottom:0}
.own-market-rowLine{display:flex;align-items:center;gap:16px;min-width:0}
.own-market-rowIcon{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;width:40px;height:40px;border:0.5px solid var(--dsw-alias-border-l3,#d0d5dd);border-radius:8px;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowMain{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}
.own-market-rowId{font-size:13.5px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828);overflow-wrap:anywhere}
.own-market-row[data-state='off'] .own-market-rowId{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowModule{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary,#98a2b3);overflow-wrap:anywhere}
.own-market-rowNote{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
/* 企业插件卡片两行文案，照官方已安装卡片 .cardTitle/.cardDesc 字号：title 14/20-500-ellipsis、desc 13/18-tertiary-单行。 */
.own-market-cardId{font-size:14px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.own-market-row[data-state='off'] .own-market-cardId{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-cardDesc{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:13px;line-height:18px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
.own-market-rowState{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:18px;white-space:nowrap}
.own-market-row[data-state='off'] .own-market-rowState{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowStateFailed{color:var(--dsw-alias-state-error-primary,#c4320a)}
`

/** 组件行图标：三枚 lucide 图标按 id 定位，避免借用官方 `*Regular` 图标。 */
const COMPONENT_GLYPHS = { plugins: Package, skills: Sparkles, presets: BookMarked } as const

function ComponentGlyph({ id }: { readonly id: string }): ReactNode {
  const Glyph = COMPONENT_GLYPHS[id as keyof typeof COMPONENT_GLYPHS] ?? Package
  return <Glyph size={18} aria-hidden="true" />
}

/**
 * 官方 `plugins.detail.badge` 贡献（titleRow 里 h3 旁）：只对本入口出「版本号 + 标签」，
 * 其余 subject 返回 null（官方槽语义）。hook 组件：订阅 store 取版本与会话可用性。
 */
export function EnterpriseMarketBadge({ subject, store }: {
  readonly subject: { readonly kind: string; readonly id?: string }
  readonly store?: EnterpriseAccountStore | undefined
}): ReactNode {
  if (subject.kind !== 'item' || subject.id !== ENTERPRISE_MARKET_ENTRY_ID) return null
  const snapshot = useAccount(store as EnterpriseAccountStore)
  return <BadgeView version={snapshot.status?.bundleVersion} />
}

/** 版本签文案，照官方 `versionTag: 'v{version}'` 口径；缺版本时返回 undefined（不渲染版本签）。 */
export function enterpriseMarketVersionTag(bundleVersion: string | undefined): string | undefined {
  return bundleVersion === undefined || bundleVersion === '' ? undefined : `v${bundleVersion}`
}

/**
 * badge 槽的纯呈现（照智能体团队 titleRow：版本号 + 标签 + 包名），不调 hook —— 测试直接调用。
 * 产品决策：标题行不再放可拨开关（拨不动的开关像坏的），也不放状态签（只读头部，状态由组件行体现）。
 * 包名走 `flex-basis:100%` 在官方 `titleRow` 的 `flex-wrap:wrap` 下换行成独立一行——官方 `ItemDetail`
 * 只有 `titleRow → desc` 两行、描述之间无独立插点，包名借官方换行落在标题下、描述上（贴智能体团队 标题→包名→描述）。
 * @param props - `version` 插件 bundle 版本（来自 store status）。
 * @returns 标题行内的「版本号」「预览版」两签 + 独立换行的「包名」。
 */
export function BadgeView({ version }: { readonly version?: string | undefined }): ReactNode {
  const versionTag = enterpriseMarketVersionTag(version)
  return (
    <>
      {versionTag === undefined ? null : <Tag className="own-market-tag" tone="neutral">{versionTag}</Tag>}
      <Tag className="own-market-tag" tone="info">预览版</Tag>
      <span className="own-market-badge-name">
        <code data-plugin-name>{ENTERPRISE_MARKET_ENTRY_ID}</code>
      </span>
    </>
  )
}

/**
 * 官方插件页「官方」分组里的「插件市场」入口（纯函数：无 hook、无订阅，测试直接调用）。
 * @param props - 官方 `plugins.item` 的 owner props，`view` 区分卡片与详情正文；`sessionUsable`/`onOpenLogin` 为可选注入。
 * @returns `summary` 时为单行卡片文案，`page` 时为带「开关 + 组件列表」的详情页正文。
 */
export function EnterpriseMarketEntry({
  view, sessionUsable = false, onOpenLogin, enterprisePlugins = [], onTogglePlugin,
  expandedSections = undefined, onToggleSection,
}: EnterpriseMarketEntryProps): ReactNode {
  if (view === 'summary') return <span className="own-market-entry-summary">{ENTERPRISE_MARKET_SUMMARY}</span>
  const hasLoginAction = typeof onOpenLogin === 'function'
  const rows = ENTERPRISE_MARKET_COMPONENTS.map(row => ({
    ...row,
    enabled: enterpriseMarketComponentEnabled(row.id, sessionUsable),
    state: enterpriseMarketComponentState(row.id, sessionUsable),
    dot: enterpriseMarketComponentDot(row.id, sessionUsable),
    switchDisabled: enterpriseMarketComponentSwitchDisabled(row.id, sessionUsable, hasLoginAction),
  }))
  const pluginsEnabled = enterpriseMarketComponentEnabled('plugins', sessionUsable)
  const pluginRowsVisible = enterpriseMarketPluginSectionVisible(pluginsEnabled, enterprisePlugins)
  // 折叠：默认两节全折叠（照官方 PluginInventory）；纯函数不传 expandedSections 时全展开（测试直调得完整树）。
  const componentsOpen = enterpriseMarketSectionOpen(expandedSections, 'components', true)
  const enterprisePluginsOpen = enterpriseMarketSectionOpen(expandedSections, 'enterprisePlugins', true)
  const canToggle = typeof onToggleSection === 'function'
  /** 一节的节头：照官方 groupToggle button（chevron + 标题 + 计数同排，aria-expanded/controls）。 */
  const sectionHead = (section: 'components' | 'enterprisePlugins', title: string, count: ReactNode): ReactNode => (
    <div className="own-market-sectionHead">
      <button
        type="button"
        className="own-market-groupToggle"
        aria-expanded={section === 'components' ? componentsOpen : enterprisePluginsOpen}
        aria-controls={`market-section-${ENTERPRISE_MARKET_SECTION_IDS[section]}`}
        disabled={!canToggle}
        title={canToggle ? undefined : '折叠动作未接通'}
        onClick={() => { onToggleSection?.(section) }}
      >
        <ChevronDown className="own-market-chevron" size={12} aria-hidden="true" />
        <span className="own-market-groupTitle">{title}</span>
      </button>
      <span className="own-market-sectionCount">{count}</span>
    </div>
  )
  return (
    <section className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
      <style>{styles}</style>
      <section className="own-market-section">
        {sectionHead('components', '包含的组件', enterpriseMarketComponentSummaryText(rows, sessionUsable))}
        {/* 条件渲染而非 hidden 属性：`.own-market-rows{display:flex}` 类选择器会覆盖 UA 的
            `[hidden]{display:none}`（author > UA），hidden 属性存在但列表不消失——照官方 groupBody
            的 `{open ? <div> : null}` 写法，收起时列表真正不进 DOM。 */}
        {componentsOpen ? (
          <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.components}`}>
            {rows.map(row => (
              <li
                key={row.id}
                className="own-market-row"
                data-market-component={row.id}
                data-state={row.enabled ? 'on' : 'off'}
              >
                <div className="own-market-rowLine">
                  <span className="own-market-rowIcon"><ComponentGlyph id={row.id} /></span>
                  <div className="own-market-rowMain">
                    <span className="own-market-rowId">{row.label}</span>
                    <span className="own-market-rowNote">{row.note}</span>
                    <code className="own-market-rowModule">{row.module}</code>
                  </div>
                  <span className="own-market-rowState">
                    <StateDot state={row.dot} />
                    {row.state}
                  </span>
                  <Switch
                    checked={row.enabled}
                    label={`启用组件 ${row.label}`}
                    disabled={row.switchDisabled}
                    title={row.reserved ? `预留：${row.label}组件未接入` : row.enabled ? '请在企业账号中退出登录' : '登录企业账号后启用'}
                    onChange={() => { onOpenLogin?.() }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {/* 「企业插件」节：仅当上面的「插件」大组件开启时出现，列企业后台上传的真实插件目录。 */}
      {pluginRowsVisible ? (
        <section className="own-market-section" data-market-section="enterprise-plugins">
          {sectionHead('enterprisePlugins', '企业插件', `${enterprisePlugins.length} 个`)}
          {enterprisePluginsOpen ? (
            <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.enterprisePlugins}`}>
              {enterprisePlugins.map(plugin => (
                <li
                  key={plugin.packageName}
                  className="own-market-row"
                  data-enterprise-plugin-package={plugin.packageName}
                  data-enterprise-plugin-state={plugin.state}
                >
                  <div className="own-market-rowLine">
                    <span className="own-market-rowIcon"><Package size={18} aria-hidden="true" /></span>
                    {/* 两行文案，照官方已安装卡片 CardHead（title 行 + description 行）：
                        第 1 行 = 包名（= 官方 title），第 2 行 = 一句话说明（= 官方 description，单行 ellipsis）。
                        不再放 mono 模块名——那是详情页 RowsSection 的 rowMain 结构，官方卡片没有。 */}
                    <div className="own-market-rowMain">
                      <span className="own-market-cardId">{plugin.packageName}</span>
                      <span className="own-market-cardDesc">
                        {plugin.inCatalog ? `企业发布 · v${plugin.version ?? ''}` : '已不在企业目录中'}
                      </span>
                    </div>
                    <span className="own-market-rowState">
                      <StateDot state={enterprisePluginDot(plugin.state)} />
                      {enterprisePluginStatePresentation(plugin.state).title}
                    </span>
                    <Switch
                      checked={plugin.state === 'ACTIVE'}
                      label={`安装企业插件 ${plugin.packageName}`}
                      disabled={!onTogglePlugin || plugin.installErrorCode !== undefined
                        || plugin.state === 'INSTALLING' || plugin.state === 'DOWNLOADING' || plugin.state === 'REMOVING' || plugin.state === 'ROLLBACK'}
                      title={plugin.installErrorCode !== undefined ? '该插件当前不可安装'
                        : plugin.state === 'ACTIVE' ? '点此卸载' : '点此安装'}
                      onChange={(next) => { onTogglePlugin?.(plugin, next) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}

/**
 * 官方 `plugins.item` 的真实入口（唯一含 hook 的导出）：订阅企业账号 store、自持登录弹窗，
 * 把会话可用性与开登录回调喂给纯函数体 `EnterpriseMarketEntry`。`store` 缺席时开关恒禁用（不提供假切换）。
 * @param props - `view` 透传官方视图；`store` 由共享注册面（`client.tsx` 的 `plugins.item` inject）注入。
 * @returns 官方插件页「插件市场」入口，`page` 视图下头部总开关与组件行开关都真实可用。
 */
export function EnterpriseMarketPage({ view, store }: { readonly view: 'summary' | 'page'; readonly store?: EnterpriseAccountStore | undefined }): ReactNode {
  const snapshot = useAccount(store as EnterpriseAccountStore)
  const dialog = useEnterpriseLoginDialog(store as EnterpriseAccountStore)
  const sessionUsable = enterpriseSessionUsable(snapshot.status?.state)
  // 折叠态：默认两节全折叠（照官方 PluginInventory `?? false`）；本组件是唯一 hook 入口，纯函数体不持状态。
  const [expandedSections, setExpandedSections] = useState<{ components: boolean; enterprisePlugins: boolean }>({
    components: false,
    enterprisePlugins: false,
  })
  const onToggleSection = (section: 'components' | 'enterprisePlugins'): void => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  const hasStore = store !== undefined
  const openLogin = hasStore ? dialog.openDialog : undefined
  const pluginStatus = snapshot.pluginStatus
  const catalog = pluginStatus?.catalog ?? []
  const local = pluginStatus?.plugins ?? []
  const enterprisePlugins = enterpriseMarketPluginRows(catalog, local)
  const versionIdByPackage = new Map(catalog.map(item => [item.packageName, item.pluginVersionId]))
  const onTogglePlugin: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      if (next) {
        const versionId = versionIdByPackage.get(row.packageName)
        if (versionId !== undefined) void store!.installPlugin(row.packageName, versionId)
      } else {
        void store!.removePlugin(row.packageName)
      }
    }
    : undefined
  return (
    <>
      <EnterpriseMarketEntry
        view={view}
        sessionUsable={sessionUsable}
        onOpenLogin={openLogin}
        enterprisePlugins={enterprisePlugins}
        onTogglePlugin={onTogglePlugin}
        expandedSections={expandedSections}
        onToggleSection={onToggleSection}
      />
      <EnterpriseLoginDialog store={store as EnterpriseAccountStore} open={dialog.open} onClose={dialog.closeDialog} />
    </>
  )
}
