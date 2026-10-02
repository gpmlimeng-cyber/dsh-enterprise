/**
 * [INPUT]: 依赖 React（useState/useEffect）、品牌位图 brand、lucide-react 三枚组件图标、官方 ui-primitives 的 Switch/Tag/StateDot（pinned 0.1.5-rc.2 的 .d.ts 已导出，不走 official-ui 收窄接缝；**该 pin 不含 `SegmentedTabs`**，故 page 视图的页签条照 `account-view.tsx` 既有 tablist 手写自绘，pin 对齐是另一个待用户拍板的开放项）、account-state 的 `enterpriseSessionUsable` 与 account-store 的 `EnterpriseAccountSnapshot`（shared 面、订阅只在 WithStore 包装内）、local-api-decode 的技能 DTO（`EnterpriseRuntimeSkill` 目录 + 已装记录 `EnterpriseInstalledSkill`——技能行开关的「已装」只认后者这一份 Host 真值）与失败码唯一投影 `enterpriseLocalErrorCode`（行内失败提示的 code 来源，与技能 tab 同源）、消费官方 `plugins.item` owner props（`view`/`form`）；中心当前版本只从**详情投影** `store.api.skillDetail(id)` 取（列表投影的 `versionId` 恒为空串），且只对已装行取——未装行没有本机版本可比，不白跑请求
 * [OUTPUT]: 提供官方插件页「官方」分组里的「插件市场」入口卡片与**三页签商店整页**（page 视图顶部手写页签条 = 企业技能 / 企业插件 / 组件，默认选中「企业技能」；三个 `role="tabpanel"` 只有当前页签挂载内容，页签内容直接复用原三节的行渲染、不重写节内实现），以及可脱离 DOM 测试的页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`、页签文案计数投影 `enterpriseMarketTabLabel`）、组件清单/计数摘要/组件状态纯投影、企业插件行投影、企业技能行投影（官方两行卡片：**第 1 行标题 + 紧随的版本签 `sourceDshVersion` + 可选分类签 `category`**、第 2 行描述，并带中心当前版本 `latestVersionId`）与标题行标签纯投影 `enterpriseMarketSkillVersionTag`/`enterpriseMarketSkillCategoryTag`、「有更新」判定纯投影 `enterpriseMarketSkillHasUpdate` 与判定入口 `enterpriseMarketSkillRowHasUpdate`、开关左侧那枚辅助标签的纯投影 `enterpriseMarketSkillUpdateTag` 与文案常量 `ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`、技能行受管态纯投影 `enterpriseMarketSkillState`（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）、**唯一剩下可折叠的「组件」页签折叠态** `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败可见反馈 `EnterpriseMarketActionError` 与文案投影 `enterpriseMarketActionErrorLabel`，以及注册常量；卡片摘要与详情页正文**不重复同一句**——摘要只在 `summary` 视图出现（官方必渲染的那一份），详情页只留页签条与三个面板；**详情页顶部压缩**：badge 槽只出「版本号 + 包名」（纯噪音的「预览版」文字签已删），企业技能/企业插件两节原先各占一整行的独立计数行（`.own-market-sectionMeta`）已删、计数并入页签文案，`.own-market-tabs` 顶部间距 2→0、`.own-market-section` 顶部间距 24→12
 * [POS]: ui 的企业扩展市场入口，只占官方 `plugins.item` 槽位（卡片一句话走 `summary`、**整页三页签商店**走 `page`），不注册侧栏入口与独立市场弹层；**page 视图 = 页签条（企业技能 | 企业插件 | 组件，默认「企业技能」）+ 三个 `role="tabpanel"`**：页签条手写（`role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls`/`aria-labelledby`/`id` 三处配对、roving `tabIndex`、←/→/Home/End 走焦并选中、选中态 2px 下划线），**不用官方 `SegmentedTabs`**（工程编译期 pin 的 primitives 0.1.5-rc.2 不含它，import 即 TS 报错；pin 对齐待用户拍板），三个面板**只有当前页签的内容挂载**（其余只留一个 `hidden` 空壳，让 `aria-controls` 恒能解析）；store 与开登录回调均为可选注入（共享注册面经 `client.tsx` 的 `inject` 给本条目注入 store，缺席时降级为占位态，注入后自动升级为真值态）；组件行 `reserved` 只剩配方一行，插件与技能行随企业会话真值，两个目录节（企业插件/企业技能）都只在对应大组件开启且目录非空时出现，企业插件行维持原样（状态点 + 文案 + 官方 `Switch` 一键安装/卸载），企业技能行右侧 = **[辅助标签按钮] [Switch]**（标签在前）：官方两行卡片（第 1 行标题 `own-market-cardId`——标题行是 nowrap 单行 `.own-market-cardHead`（行高锁 20px），标题后紧跟**两枚只读标签**：版本签取列表投影的 `sourceDshVersion`、分类签取新增可选字段 `category`（缺席/null/空串时整枚签不渲染，安静缺席、不塞占位）——标签过多时标题先省略、两枚签保持可见，行高不变；第 2 行描述 `own-market-cardDesc` 单行省略，不出现元信息行）+ 那枚**始终存在**的官方 `Switch`：`checked` = 该技能已装（`installedSkills` 命中本行）、在途（`INSTALLING`/`REMOVING`）`disabled`、`label` 给动作语义（`安装企业技能 X`/`卸载企业技能 X`）、`onChange(next)` 原样交回 `onToggleSkill(skill, next)`，开关仍是该行的主控件；**开关左侧的辅助标签**是真实 `<button type="button">`（`own-market-skillTag`，键盘可达、`:focus-visible` 焦点环、`data-enterprise-skill-tag='UPDATE_AVAILABLE'`），**只在「有更新」时出现**（`enterpriseMarketSkillRowHasUpdate`：本机已装记录的 `versionId` 与行上的 `latestVersionId` 都非空且不等），`aria-label` = `更新企业技能 X`、`title` = 「点此更新到中心当前版本」、点击 = `onToggleSkill(skill, true)`（重装到中心当前版本），在途 `disabled` 但**不消失**（用户看得见「正在更新」）；未装行、已装且同版本行、以及未装行的在途一律不出这枚标签——右侧就一个 `Switch`；`installedSkills`（Host 回传的已装记录）/`pendingSkill`（行键 + 方向）/`onToggleSkill` 三个直传输入决定 `data-enterprise-skill-state` 与那枚开关的 checked/disabled，动作返回的已装清单覆盖本地真值、失败即退回未装（界面不保留乐观已装）；技能列表列的是后台分配（预置）的**全部**技能——不按「已装」过滤，未装的也照列，装不装由用户拨这枚开关决定；版本身份只投影 `versionId` 这一份（`sha256` 按 `skill-api-decode` 的契约在解码时校验形状后即丢，界面拿不到中心哈希，故「有更新」**不比 sha256**）——中心列表投影的 `versionId` 恒为空串、只有 `GET /skills/{id}` 详情才是真值，故 hook 入口**只对已装行**逐个取详情（`store.api.skillDetail(packageId)`）按 id 归并成行上的 `latestVersionId`，取不到/失败即留空串＝该行不判更新（不猜）；**两节的行共用同一份失败可见反馈**：动作失败时命中该行的 `role="alert"` 行内提示（`安装失败`/`卸载失败` + `enterpriseLocalErrorCode` 的稳定码，照「技能」tab 的 `own-skill-inlineError` 口径），失败后该行开关不再禁用、可原地重试；技能目录与已装清单由 hook 入口分别经 `store.api.skills()` 与 `store.api.installedSkills()` **并行**取（已装态取数失败只降级为全部未装，不拖垮目录），纯函数体只收直传的行；**页签化后的折叠态**：企业技能 / 企业插件两节的节头折叠**已删除**（显隐由页签承担；两节原先把「N 个」单独占一行，现计数已并入页签文案、独立计数行整段删除），唯一还带折叠语义的是**「组件」页签内部的组件清单**（仍是 `groupToggle` 节头 + `ENTERPRISE_MARKET_DEFAULT_EXPANDED` 单字段初值＝展开，`enterpriseMarketSectionOpen` 纯投影仍照官方 `?? false` 口径，`EnterpriseMarketSectionId` 随之收敛为 `'components'` 一个成员）；
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Package, Sparkles, BookMarked, ChevronDown } from 'lucide-react'
import { StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { enterpriseSessionUsable, useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { enterprisePluginStatePresentation } from './plugin-market.js'
import type { EnterpriseInstalledSkill, EnterprisePluginCatalogItem, EnterprisePluginItem, EnterpriseRuntimeSkill, ManagedPluginState } from './local-api-decode.js'
import { enterpriseLocalErrorCode } from './local-api-decode.js'
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

/**
 * 组件交付排期清单，按交付顺序（插件与技能已排期，配方仍预留）。
 * **历史规划元数据，不驱动任何渲染**：页签化之后真正的页签真源是下面的 `ENTERPRISE_MARKET_TABS`。
 */
export const ENTERPRISE_MARKET_PLAN = [
  { id: 'plugins', label: '插件', note: '官方 / 已安装 / 企业插件 三分组' },
  { id: 'skills', label: '技能', note: '已排期' },
  { id: 'presets', label: '配方', note: '预留' },
] as const

/** `page` 视图三个页签的 id（页签条顺序即 `ENTERPRISE_MARKET_TABS` 的数组顺序）。 */
export type EnterpriseMarketTabId = 'skills' | 'plugins' | 'components'

/**
 * 页签条真源：**顺序即渲染顺序**，第一项同时是默认选中项（见 `ENTERPRISE_MARKET_DEFAULT_TAB`）。
 * 文案与原来三节的节标题同词（企业技能 / 企业插件 / 组件）——页签已经承担「显隐」。
 * **`label` 只是基础词**：渲染时经 `enterpriseMarketTabLabel(label, count)` 补上计数
 * （原先企业技能 / 企业插件两节内部各占一行的 `N 个` 计数行已退场，数字并入页签，见该投影）。
 */
export const ENTERPRISE_MARKET_TABS = [
  { id: 'skills', label: '企业技能' },
  { id: 'plugins', label: '企业插件' },
  { id: 'components', label: '组件' },
] as const

/** 默认页签＝「企业技能」：用户的主战场，后台分配（预置）的技能一进页面就该看得见。 */
export const ENTERPRISE_MARKET_DEFAULT_TAB: EnterpriseMarketTabId = 'skills'

/** 页签条的无障碍名（`role="tablist"` 的 `aria-label`）。 */
export const ENTERPRISE_MARKET_TABLIST_LABEL = '企业市场'

/**
 * 页签 ↔ 面板的固定 id 配对：`id` / `aria-controls` / `aria-labelledby` 三处同源，避免手抄漂移。
 * 纯函数体**不能调 `useId`**（那会把 `EnterpriseMarketEntry` 变成 hook 组件，破坏「可直接函数调用测试」的既有形状）；
 * 而本页同一时刻只有一份实例（官方 `plugins.item` 的 page 视图只渲染当前 item），故用常量 id 足够。
 */
export const ENTERPRISE_MARKET_TAB_IDS: Record<EnterpriseMarketTabId, { readonly tab: string; readonly panel: string }> = {
  skills: { tab: 'market-tab-skills', panel: 'market-panel-skills' },
  plugins: { tab: 'market-tab-plugins', panel: 'market-panel-plugins' },
  components: { tab: 'market-tab-components', panel: 'market-panel-components' },
}

/**
 * 页签文案 = 基础词 + 计数（`企业技能 3`）。
 * **数字口径与原先那行节计数同源**：取该页签**真正要渲染的行数**（企业技能 / 企业插件受可见性门控，
 * 门控不过即 0；组件恒取组件清单长度）。
 * 为压缩详情页顶部的垂直空间，原先在两节内部各占一整行的 `.own-market-sectionMeta`（`N 个`）已退场，
 * 数字并入页签本身；计数用裸数字（不再带「个」字）以省字宽——页签仍是 13/20 的单行（`white-space:nowrap`），
 * 既不换行也不撑高页签条。
 */
export function enterpriseMarketTabLabel(label: string, count: number): string {
  return `${label} ${count}`
}

/** 计数摘要分段，照官方 `partsSummary` 口径。 */
export type EnterpriseMarketSummary = { readonly total: number; readonly ready: number; readonly reserved: number }

/**
 * 一次企业市场安装/卸载失败的行内提示（插件行与技能行共用同一形状）。
 * `id` 是行键（企业插件 = packageName、企业技能 = 技能包雪花 id），`code` 一律来自
 * `enterpriseLocalErrorCode` 这一份失败码唯一投影——界面只负责显示，不自造文案也不吞错误码。
 */
export interface EnterpriseMarketActionError {
  /** 出错的行键：与该行的 `data-enterprise-*-package` 同值。 */
  readonly id: string
  /** 失败的动作：行内前缀文案由它决定（安装失败 / 卸载失败）。 */
  readonly action: 'install' | 'uninstall'
  /** 稳定错误码（`ENT_…`），与「技能」tab、插件设置页同一份投影。 */
  readonly code: string
}

/** 失败动作 → 行内提示前缀，照「技能」tab 的行内提示口径（安装失败 / 卸载失败）。 */
export function enterpriseMarketActionErrorLabel(error: EnterpriseMarketActionError): string {
  return error.action === 'install' ? '安装失败' : '卸载失败'
}

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
   * 企业技能目录（`store.api.skills()` 的列表投影，经 hook 入口取数后直传；已装行的
   * `latestVersionId` 由 hook 入口补的详情归并进来）。
   * 与本 props 的「企业插件」节同规则：仅当「技能」组件开启（`sessionUsable`）且目录非空时
   * 追加「企业技能」节；**列的是后台分配（预置）的全部技能**，不按「已装」过滤，行右侧 = 官方 `Switch`
   * （始终在，`onToggleSkill` + 已装态直传决定它的 checked/disabled）+ **仅在「有更新」时**出现的那枚
   * 辅助标签按钮（`enterpriseMarketSkillRowHasUpdate` 命中才渲染）。
   */
  readonly enterpriseSkills?: readonly EnterpriseMarketSkillRow[] | undefined
  /**
   * 本机已装技能记录（`store.api.installedSkills()` 的投影，经 hook 入口取数后直传）。
   * 判定「已装」（= 那枚开关的 `checked`）只认这份 Host 真值里的 `packageId`；判定「有更新」只用它的
   * `versionId` 比行上的 `latestVersionId`（两侧都非空且不等）。缺席时所有行显示未装、开关一律关，
   * 纯函数体不猜也不做乐观切换。
   */
  readonly installedSkills?: readonly EnterpriseInstalledSkill[] | undefined
  /** 当前正在安装/卸载的技能包动作（行键 + 方向）；命中行的开关禁用（在途不许再拨）。 */
  readonly pendingSkill?: EnterpriseMarketSkillPending | undefined
  /**
   * 企业插件的安装/卸载动作（`store.installPlugin` / `store.removePlugin`）；缺席时开关禁用。
   * 注：安装动作在 hook 入口调用后触发 store 刷新，本纯函数体不持 store。
   */
  readonly onTogglePlugin?: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined
  /**
   * 企业技能的一键安装/卸载动作；缺席时技能行的开关禁用（与企业插件行同一降级口径）。
   * `next` 就是官方 Switch 拨动后的目标态：`true` = 装到本机 `~/.dsh/skills`、`false` = 卸掉。
   */
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  /**
   * 企业插件行最近一次安装/卸载失败（`EnterpriseMarketPage` 把 store 已收下的 `pluginErrorCode`
   * 归到刚发起动作的那一行）：命中 `packageName` 的行渲染 `role="alert"` 行内提示；缺席即无失败。
   * 有失败提示**不**禁用该行开关——用户要能原地重试。
   */
  readonly pluginActionError?: EnterpriseMarketActionError | undefined
  /**
   * 企业技能行最近一次安装/卸载失败（行键 = 技能包 id）：命中该行时渲染 `role="alert"` 行内提示。
   * 与插件行同口径：提示出现不影响开关可拨性（失败后仍可再拨一次重试）。
   */
  readonly skillActionError?: EnterpriseMarketActionError | undefined
  /**
   * 「组件」页签内部那份组件清单的折叠态（页签化后**只剩这一节还带折叠语义**）。
   * 缺席视为展开（纯函数直调测试不传即得完整树）；真运行时由 `EnterpriseMarketPage` 的 `useState`
   * 供给，其初值是 `ENTERPRISE_MARKET_DEFAULT_EXPANDED`。
   */
  readonly expandedSections?: { readonly components: boolean } | undefined
  /** 折叠切换回调（点组件节节头按钮触发）；缺席时节头按钮禁用（不提供死按钮）。 */
  readonly onToggleSection?: ((section: EnterpriseMarketSectionId) => void) | undefined
  /**
   * 当前选中的页签（`page` 视图）。缺席按 `ENTERPRISE_MARKET_DEFAULT_TAB`（「企业技能」）。
   * 真运行时由 `EnterpriseMarketPage` 的 `useState` 供给——本纯函数体不持状态（保持可直接函数调用测试）。
   */
  readonly activeTab?: EnterpriseMarketTabId | undefined
  /**
   * 页签切换回调。页签条**恒可交互**（roving `tabIndex` + ←/→/Home/End 走焦并选中）：选中态与键盘可达
   * 是 tablist 自身的语义，把当前页签做成禁用项会让人以为它坏了；真运行时恒由 hook 入口供给，
   * 缺席时点击是 no-op（只读页签条，不会在真运行时出现）。
   */
  readonly onSelectTab?: ((tab: EnterpriseMarketTabId) => void) | undefined
}

/**
 * 可折叠节的 id 联合。页签化之后**只剩「组件」页签内部那份组件清单还带折叠语义**：
 * 企业技能 / 企业插件两节的显隐已由页签承担，故这两个成员随折叠一起收敛掉（不留死字段）。
 */
export type EnterpriseMarketSectionId = 'components'

/** 节头的可点按钮 id 与内容区 id（`aria-controls` 用）；页签化后只有组件节用得到。 */
export const ENTERPRISE_MARKET_SECTION_IDS = {
  components: 'components',
} as const

/**
 * 唯一剩下可折叠的那一节（「组件」页签内部的组件清单）的初始展开态（`EnterpriseMarketPage` 的 `useState` 初值）。
 * 页签化之后企业技能 / 企业插件两节已无折叠语义，故本常量随之收敛为单字段：
 * 进「组件」页签就直接看得见插件/技能/配方三行，用户仍可手动折叠。
 */
export const ENTERPRISE_MARKET_DEFAULT_EXPANDED: Record<EnterpriseMarketSectionId, boolean> = {
  components: true,
}

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
 * 「企业技能」节的一行：企业后台上传的技能包。
 * 口径照官方已安装卡片 `CardHead`——**只两行**：第 1 行标题（displayName）、第 2 行描述
 * （description，单行省略不撑高卡片），右侧 = **[有更新时的辅助标签] [官方 Switch]**（开关始终在、是主控件）。
 * 不再堆状态点 + 元信息。「复制装配指令」仍是「技能」tab 的第二条路，这里给的是「一键落盘」。
 */
export interface EnterpriseMarketSkillRow {
  /** 技能包雪花 id，同时是详情取数键（`store.api.skillDetail(id)`）与安装动作入参。 */
  readonly id: string
  /** manifest.json 的稳定标识（kebab-case 等），进 `data-enterprise-skill-id`。 */
  readonly skillId: string
  readonly displayName: string
  /** 空描述归一为固定占位，与技能 tab 详情弹窗同一句话。 */
  readonly description: string
  /**
   * **列表投影里就有**的 DSH 来源版本（`EnterpriseRuntimeSkill.sourceDshVersion`，形如 `0.1.7-rc.3`）：
   * 它就是「企业技能」行第 1 行紧跟标题那枚**版本签**的取值，**不需要任何服务端改动**。
   * 解码层已保证它是非空串，故行上恒带；万一为空则不出这枚签（`enterpriseMarketSkillVersionTag`）。
   */
  readonly sourceDshVersion: string
  /**
   * 服务端新增的**可选分类**（`category`，列表与详情投影都会有）。**为缺失设计**：解码层已把
   * 缺席 / null / 空串一律归一成「没有这个键」，故这里缺席 ＝ 没有分类 ＝ 第 1 行不出分类签
   * （安静缺席是预期行为，绝不塞占位文案、也不猜分类）。
   */
  readonly category?: string
  /**
   * 中心当前版本的 `versionId`（判定「有更新」的另一侧）。**列表投影不带这个字段**——`skill-api-decode`
   * 的列表解码把 `versionId` 写死为空串，只有 `GET /skills/{id}` 详情投影才是真值；故由 hook 入口
   * **只对已装行**逐个取详情后经 `enterpriseMarketSkillRows(skills, details)` 按 id 归并进来。
   * 取不到/失败即空串 ＝ 该行不判更新（宁可少说一句，也不猜「有更新」）。
   */
  readonly latestVersionId: string
}

/**
 * 技能目录 → 可渲染的「企业技能」行（纯函数，按目录顺序原样投影，**不做任何过滤**）。
 * 后台分配（预置）的技能全都要列出来，装没装只影响该行右侧那枚开关的 checked，不影响这行出不出现。
 * 版本签直接取列表投影的 `sourceDshVersion`，分类签取可选字段 `category`（有非空值才产出该键）。
 * @param skills - `store.api.skills()` 的列表投影（摘要；`versionId` 恒为空串）。
 * @param details - 可选的中心详情投影（`store.api.skillDetail(id)`），只用来补中心当前版本；
 *   按 id 归并，缺该行详情即留空串——未装行不需要它（没有本机版本可比）。
 */
export function enterpriseMarketSkillRows(
  skills: readonly EnterpriseRuntimeSkill[] = [],
  details: readonly EnterpriseRuntimeSkill[] = [],
): EnterpriseMarketSkillRow[] {
  const latestById = new Map(details.map(detail => [detail.id, detail.versionId]))
  return skills.map(skill => ({
    id: skill.id,
    skillId: skill.skillId,
    displayName: skill.displayName,
    description: skill.description === '' ? '（暂无描述）' : skill.description,
    sourceDshVersion: skill.sourceDshVersion,
    // 分类照解码层同一口径：只有非空串才产出这个键（缺席/null/空串都不产出，界面据此不出分类签）。
    ...(skill.category !== undefined && skill.category !== '' ? { category: skill.category } : {}),
    latestVersionId: latestById.get(skill.id) ?? '',
  }))
}

/**
 * 「企业技能」行**第 1 行**（标题行）版本签的可见文案。
 * 取值就是列表投影里已有的 `sourceDshVersion`（形如 `0.1.7-rc.3`），**不加 `v` 前缀**——`v{version}` 是
 * 本入口详情页 badge 的口径（`enterpriseMarketVersionTag`），行上的版本签照字段原值说，不造第二套字面。
 * @param sourceDshVersion - 行上的 `sourceDshVersion`。
 * @returns 标签文案；空串返回 undefined（不渲染空签，也不塞占位）。
 */
export function enterpriseMarketSkillVersionTag(sourceDshVersion: string): string | undefined {
  return sourceDshVersion === '' ? undefined : sourceDshVersion
}

/**
 * 「企业技能」行**第 1 行**（标题行）分类签的可见文案。
 * **为缺失设计**：字段尚未上线时这里恒得 undefined，分类签就安静缺席（预期行为）——绝不塞占位文案、不猜分类。
 * 这是标题行标签的**最后一道防线**：解码层已把 null/空串归一为缺席，这里再兜一次 `undefined`/`null`/纯空白，
 * 使「直接构造行」的调用方也不会画出空药丸。分类名不做任何加工，原值照说。
 * @param category - 行上的可选分类（`EnterpriseMarketSkillRow.category`）。
 * @returns 标签文案；没有分类返回 undefined。
 */
export function enterpriseMarketSkillCategoryTag(category: string | null | undefined): string | undefined {
  if (category === undefined || category === null) return undefined
  return category.trim() === '' ? undefined : category
}

/**
 * 「企业技能」行现在的受管态（与 `data-enterprise-skill-state` 同源）：
 * `AVAILABLE` 未装可装、`INSTALLED` 已落盘且与中心同版本、`UPDATE_AVAILABLE` 已落盘但中心有别的版本、
 * `INSTALLING`/`REMOVING` 动作在途。
 * 它就是那两枚控件的口径：`INSTALLED`/`UPDATE_AVAILABLE`（卸载在途时也是）→ 开关 `checked`，
 * 两个在途态 → 开关 `disabled`；辅助标签只在 `UPDATE_AVAILABLE` 的**事实**（见 `enterpriseMarketSkillRowHasUpdate`）上出现。
 */
export type EnterpriseMarketSkillState = 'AVAILABLE' | 'INSTALLED' | 'UPDATE_AVAILABLE' | 'INSTALLING' | 'REMOVING'

/** 开关左侧那枚辅助标签唯一的可见文案（改文案只改这一处；其余态由 Switch + 状态点表达，不再各造一枚签）。 */
export const ENTERPRISE_MARKET_SKILL_UPDATE_LABEL = '有更新'

/** 辅助标签的 `data-enterprise-skill-tag` 取值：这枚按钮的身份就是「更新」。 */
export const ENTERPRISE_MARKET_SKILL_UPDATE_TAG = 'UPDATE_AVAILABLE'

/** 「企业技能」行当前在途的动作：行键 + 方向（`true` = 安装/更新、`false` = 卸载），与 hook 入口的 `pendingSkill` 同形。 */
export interface EnterpriseMarketSkillPending {
  readonly packageId: string
  readonly next: boolean
}

/**
 * 本机已装记录与中心当前版本是否不一致（=「有更新」）。
 * 两侧都必须拿得到非空 `versionId` 才判：未装、详情没取到（旧 Host 没有详情路由）都返回 false——不猜版本。
 * 比的是 `versionId` 而不是 `sha256`：`sha256` 按本包契约在解码时校验形状后即丢（`skill-api-decode`
 * 的「sha256 不出界面」同策），本层能拿到的版本身份只有这一份 `versionId`。
 * @param installedVersionId - 本机已装记录的 `versionId`（`EnterpriseInstalledSkill.versionId`）。
 * @param latestVersionId - 中心当前版本的 `versionId`（行上的 `latestVersionId`）。
 * @returns 是否有更新。
 */
export function enterpriseMarketSkillHasUpdate(installedVersionId: string, latestVersionId: string): boolean {
  return installedVersionId !== '' && latestVersionId !== '' && installedVersionId !== latestVersionId
}

/**
 * 某一行是否「有更新」：先按行键命中 Host 回传的已装记录，再比两侧 `versionId`。
 * 这是辅助标签出现与否的**唯一判定点**（与 `enterpriseMarketSkillState` 共用，禁止另写一份）。
 * @param installedSkills - Host 回传的已装记录（缺席＝全部未装，界面不猜）。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 是否有更新。
 */
export function enterpriseMarketSkillRowHasUpdate(
  installedSkills: readonly EnterpriseInstalledSkill[] | undefined,
  row: EnterpriseMarketSkillRow,
): boolean {
  const record = installedSkills?.find(item => item.packageId === row.id)
  return record !== undefined && enterpriseMarketSkillHasUpdate(record.versionId, row.latestVersionId)
}

/**
 * 开关左侧那枚辅助标签的可渲染投影（文案 / 无障碍名 / 悬浮说明一次产出）。
 * 它**不是**主控件——主控件始终是右侧那枚官方 `Switch`；这枚标签只在「有更新」时补一条
 * 「把本机旧版本换成中心当前版本」的快捷路。
 */
export interface EnterpriseMarketSkillUpdateTag {
  /** 可见文案，恒为 `ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`。 */
  readonly label: string
  /** 无障碍名（动作语义，读屏与键盘听到的就是它）。 */
  readonly ariaLabel: string
  /** 悬浮说明：点它 = 更新到中心当前版本。 */
  readonly title: string
}

/**
 * 技能名 → 辅助标签投影。
 * @param displayName - 技能显示名，进无障碍名。
 * @returns 标签投影（在途时的 `disabled` 由渲染层按 `pendingSkill` 给，不在这里混说状态）。
 */
export function enterpriseMarketSkillUpdateTag(displayName: string): EnterpriseMarketSkillUpdateTag {
  return {
    label: ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
    ariaLabel: `更新企业技能 ${displayName}`,
    title: '点此更新到中心当前版本',
  }
}

/**
 * 一行技能包当前的受管态（唯一判定点，纯函数直调可测）。
 * 优先级：在途 > 未装 > 有更新 > 已装——在途时界面只说「正在进行、先别拨」，不混说版本。
 * @param installedSkills - Host 回传的已装记录（缺席＝全部未装，界面不猜）。
 * @param pending - 当前在途动作；命中本行时按方向出 `INSTALLING`/`REMOVING`。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 受管态。
 */
export function enterpriseMarketSkillState(
  installedSkills: readonly EnterpriseInstalledSkill[] | undefined,
  pending: EnterpriseMarketSkillPending | undefined,
  row: EnterpriseMarketSkillRow,
): EnterpriseMarketSkillState {
  if (pending?.packageId === row.id) return pending.next ? 'INSTALLING' : 'REMOVING'
  if (installedSkills?.some(item => item.packageId === row.id) !== true) return 'AVAILABLE'
  return enterpriseMarketSkillRowHasUpdate(installedSkills, row) ? 'UPDATE_AVAILABLE' : 'INSTALLED'
}

/** 「企业技能」节是否该渲染（「技能」组件开启且目录非空），与企业插件节同规则。 */
export function enterpriseMarketSkillSectionVisible(
  skillsComponentEnabled: boolean,
  rows: readonly EnterpriseMarketSkillRow[],
): boolean {
  return skillsComponentEnabled && rows.length > 0
}

/**
 * 一节当前是否展开（照官方 `PluginInventorySettingsTab` 的 `searching || (open ?? false)`：
 * 官方搜索时强制展开，我们当前无搜索故退化为 `open ?? defaultOpen`）。
 * 页签化后只剩「组件」页签内部的组件清单还问这个问题（企业技能/企业插件两节的显隐已由页签承担）。
 * @param expandedSections - 当前折叠态（缺席＝按 `defaultOpen`，测试直调不传即得完整树）。
 * @param section - 节 id（现在只有 `'components'`）。
 * @param defaultOpen - 缺席时的默认展开值。
 * @returns 是否展开。
 */
export function enterpriseMarketSectionOpen(
  expandedSections: Record<EnterpriseMarketSectionId, boolean> | undefined,
  section: EnterpriseMarketSectionId,
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
/* 节容器：顶部间距从官方 RowsSection 口径的 24 收到 12（详情页顶部压缩），
   节内 gap 仍是 12；首个节内容（行列表首行自带 12px 上内衬）与页签条下边框的视觉间距
   ≈ 12 + 12 = 24px，不会与页签条粘连。 */
.own-market-section{display:flex;flex-direction:column;gap:12px;min-width:0;margin-top:12px}
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
/* 「企业技能」行第 1 行 = 标题 + 版本签 + 分类签：**单行 nowrap flex**，行高锁 20px（= 标题行高，
   官方 Tag 固定 19px 高＝1px 上下内衬 + 17px 行高，故加签不改变这一行的高度，行的 40px 总高
   ＝ 标题 20 + gap 2 + 描述 18 也不变）。标签过多时**标题先让步**：标题 flex:0 1 auto + min-width:0
   继承卡片标题的 nowrap/ellipsis 先省略，两枚签 .own-market-tag 的 flex:none 保持可见；
   head 自身 overflow:hidden 兜底，绝不换行、绝不撑高。 */
.own-market-cardHead{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;line-height:20px;overflow:hidden}
.own-market-skillTitle{flex:0 1 auto;min-width:0}
.own-market-rowState{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:18px;white-space:nowrap}
.own-market-row[data-state='off'] .own-market-rowState{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowStateFailed{color:var(--dsw-alias-state-error-primary,#c4320a)}
/* 企业技能行右侧 = [辅助标签按钮] [官方 Switch]（开关样式归官方组件）。
   辅助标签只在「有更新」时出现：无边框圆角淡底（标签观感，不是第二枚开关）、键盘可达 + focus-ring、
   禁用态降透明——它是开关左侧的快捷路，不抢主控件的位置。 */
.own-market-skillTag{flex:none;border:0;border-radius:999px;padding:1px 10px;background:var(--dsw-alias-background-secondary,#f2f4f7);font-size:12.5px;line-height:18px;color:var(--dsw-alias-accent-primary,#2563eb);font-variant-numeric:tabular-nums;cursor:pointer}
.own-market-skillTag:hover:not(:disabled){background:var(--dsw-alias-border-l2,#e4e7ec);color:var(--dsw-alias-label-primary,#101828)}
.own-market-skillTag:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-skillTag:disabled{cursor:default;opacity:.6}
/* page 视图顶部的页签条（手写，不用官方 SegmentedTabs——工程 pin 的 primitives 0.1.5-rc.2 不含它）：
   口径逐值照 account-view.tsx 既有 tablist（底部 1px 分隔线 + 选中项 2px 下划线 + 同字号/行高），
   hover/focus-visible 也沿用同一套 token，不新造视觉。
   顶部间距从 2 收到 0（详情页顶部压缩）：页签条之上是官方 .detailSections 的 32px，仍有分隔；
   flex-wrap:nowrap + 页签 white-space:nowrap 保证「文案带计数」后页签**不换行、不撑高**这一行
   （计数是紧凑裸数字，三个页签合计宽度仍远小于手机端面板宽度）。 */
.own-market-tabs{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:22px;min-width:0;margin-top:0;border-bottom:1px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-market-tab{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary,#667085);cursor:pointer;font:inherit;font-size:13px;line-height:20px;margin-bottom:-1px;padding:7px 1px 8px;white-space:nowrap}
.own-market-tab:hover{color:var(--dsw-alias-label-primary,#101828)}
.own-market-tab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-tab[aria-selected='true']{border-bottom-color:var(--dsw-alias-label-primary,#101828);color:var(--dsw-alias-label-primary,#101828);font-weight:500}
/* 面板：非当前页签只留一个 hidden 空壳（内容整段不挂载），显式补一条 [hidden] 规则，
   免得将来给 .own-market-panel 加上 display 类选择器后覆盖 UA 的 [hidden]{display:none}（本仓已踩过）。 */
.own-market-panel{min-width:0}
.own-market-panel[hidden]{display:none}
/* 页签化后的节：企业技能 / 企业插件两节已无折叠也**无独立计数行**（计数并入页签文案，
   故 .own-market-sectionMeta 规则随之一并删除——不留死样式）；只有组件节的节头按钮
   （.own-market-groupToggle）还带折叠，它的计数仍用 .own-market-sectionCount 与标题同排。 */
/* 行内失败提示（企业插件行/企业技能行共用）：取值照「技能」tab 的 .own-skill-inlineError（error 色 + 12/19 + 左对齐 + 无内衬）。
   那份 CSS 归 skill-market 的 <style> 持有、切到本页时并不在 DOM，故这里补一份同值规则，不借道未挂载的样式表。 */
.own-market-inlineError{padding:0;text-align:left;font-size:12px;line-height:19px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
`

/** 组件行图标：三枚 lucide 图标按 id 定位，避免借用官方 `*Regular` 图标。 */
const COMPONENT_GLYPHS = { plugins: Package, skills: Sparkles, presets: BookMarked } as const

function ComponentGlyph({ id }: { readonly id: string }): ReactNode {
  const Glyph = COMPONENT_GLYPHS[id as keyof typeof COMPONENT_GLYPHS] ?? Package
  return <Glyph size={18} aria-hidden="true" />
}

/**
 * 官方 `plugins.detail.badge` 贡献（titleRow 里 h3 旁）：只对本入口出「版本号 + 包名」，
 * 其余 subject 返回 null（官方槽语义）。hook 组件：订阅 store 取版本。
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
 * badge 槽的纯呈现（照智能体团队 titleRow：版本号 + 包名），不调 hook —— 测试直接调用。
 * 产品决策：标题行不再放可拨开关（拨不动的开关像坏的），也不放状态签（只读头部，状态由组件行体现）；
 * **「预览版」文字签也已移除**——它对用户没有任何信息量，却和标题、版本签挤在同一行（窄屏会把它挤到第二行、
 * 白撑高 titleRow）。版本签留（`v{version}` 是真信息）。
 * 包名走 `flex-basis:100%` 在官方 `titleRow` 的 `flex-wrap:wrap` 下换行成独立一行——官方 `ItemDetail`
 * 只有 `titleRow → desc` 两行、描述之间无独立插点，包名借官方换行落在标题下、描述上（贴智能体团队 标题→包名→描述）。
 * @param props - `version` 插件 bundle 版本（来自 store status）。
 * @returns 标题行内的「版本号」签 + 独立换行的「包名」。
 */
export function BadgeView({ version }: { readonly version?: string | undefined }): ReactNode {
  const versionTag = enterpriseMarketVersionTag(version)
  return (
    <>
      {versionTag === undefined ? null : <Tag className="own-market-tag" tone="neutral">{versionTag}</Tag>}
      <span className="own-market-badge-name">
        <code data-plugin-name>{ENTERPRISE_MARKET_ENTRY_ID}</code>
      </span>
    </>
  )
}

/**
 * 官方插件页「官方」分组里的「插件市场」入口（纯函数：无 hook、无订阅，测试直接调用）。
 * @param props - 官方 `plugins.item` 的 owner props，`view` 区分卡片与详情正文；`sessionUsable`/`onOpenLogin`/`enterprisePlugins`/`enterpriseSkills`/`activeTab`/`onSelectTab` 为可选注入。
 * @returns `summary` 时为单行卡片文案，`page` 时为带「页签条（企业技能 | 企业插件 | 组件）+ 三个面板」的整页正文。
 */
export function EnterpriseMarketEntry({
  view, sessionUsable = false, onOpenLogin, enterprisePlugins = [], enterpriseSkills = [], onTogglePlugin,
  installedSkills, pendingSkill, onToggleSkill, pluginActionError, skillActionError,
  expandedSections = undefined, onToggleSection, activeTab = ENTERPRISE_MARKET_DEFAULT_TAB, onSelectTab,
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
  // 「企业技能」页签与企业插件页签同规则：只在「技能」大组件开启（= 会话可用）且目录非空时出内容。
  const skillsEnabled = enterpriseMarketComponentEnabled('skills', sessionUsable)
  const skillRowsVisible = enterpriseMarketSkillSectionVisible(skillsEnabled, enterpriseSkills)
  // 折叠：页签化之后**只剩「组件」页签内部那一节**还带折叠；真运行时的初值见
  // `ENTERPRISE_MARKET_DEFAULT_EXPANDED`，纯函数不传 `expandedSections` 时按展开处理（测试直调得完整树）。
  const componentsOpen = enterpriseMarketSectionOpen(expandedSections, 'components', true)
  const canToggle = typeof onToggleSection === 'function'
  /**
   * 一行的失败行内提示：只有行键命中时才出现，`role="alert"` 交给读屏立刻播报，稳定错误码放在 `code` 里。
   * 照「技能」tab 的行内提示口径（`安装失败`/`卸载失败` + `<code>{code}</code>`），且**不**参与该行开关的
   * `disabled` 计算——失败恰恰是最需要能再拨一次的场景。
   */
  const rowError = (error: EnterpriseMarketActionError | undefined, id: string): ReactNode => (
    error?.id === id
      ? <div className="own-market-inlineError" role="alert">{enterpriseMarketActionErrorLabel(error)} <code>{error.code}</code></div>
      : null
  )
  /** 组件节的节头（唯一还带折叠的一节）：照官方 groupToggle button（chevron + 标题 + 计数同排，aria-expanded/controls）。 */
  const sectionHead = (section: EnterpriseMarketSectionId, title: string, count: ReactNode): ReactNode => (
    <div className="own-market-sectionHead">
      <button
        type="button"
        className="own-market-groupToggle"
        aria-expanded={componentsOpen}
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
  /**
   * 页签文案里的计数：**取该页签真正要渲染的行数**——与原先那行节计数同一口径（那行只在节渲染时出现），
   * 故门控不过（会话不可用 / 目录为空）即如实记 0，绝不在面板空白时还喊「有 N 条」。
   * 数字并入页签文案后，企业技能 / 企业插件两节内部的独立计数行（`sectionMeta`）已整段删除，
   * 详情页顶部因此少一行。
   */
  const tabCounts: Record<EnterpriseMarketTabId, number> = {
    skills: skillRowsVisible ? enterpriseSkills.length : 0,
    plugins: pluginRowsVisible ? enterprisePlugins.length : 0,
    components: ENTERPRISE_MARKET_COMPONENTS.length,
  }
  /**
   * 页签条的键盘走焦：纯函数体不能持 `ref`（调 `useRef` 就变成 hook 组件、直调测试即崩），
   * 故在 keydown 里从事件源向上找 `[role="tablist"]`、按同序取第 `index` 个 `[role="tab"]` 调 `focus()`。
   * 只在真浏览器事件里执行；直调函数组件的测试不触发（`closest` 缺席即返回）。
   */
  const focusTab = (source: EventTarget | null, index: number): void => {
    const element = source as HTMLElement | null
    if (element === null || typeof element.closest !== 'function') return
    const tablist = element.closest('[role="tablist"]')
    tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus()
  }
  /** ←/→ 循环、Home/End 跳首尾，且都是「走焦 + 选中」一步到位（WAI-ARIA tabs 的自动激活口径）。 */
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % ENTERPRISE_MARKET_TABS.length; break
      case 'ArrowLeft': nextIndex = (index - 1 + ENTERPRISE_MARKET_TABS.length) % ENTERPRISE_MARKET_TABS.length; break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = ENTERPRISE_MARKET_TABS.length - 1; break
      default: return
    }
    const next = ENTERPRISE_MARKET_TABS[nextIndex]
    if (next === undefined) return
    event.preventDefault()
    onSelectTab?.(next.id)
    focusTab(event.currentTarget, nextIndex)
  }
  return (
    <section className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
      <style>{styles}</style>
      {/* 页签条放在 page 视图顶部：企业技能 | 企业插件 | 组件，默认选中「企业技能」。
          文案 = 基础词 + 计数（`enterpriseMarketTabLabel`，如「企业技能 3」）——计数原先在节内独占一行，
          现在并入页签，顶部少一行。
          手写 tablist（照 account-view.tsx 既有写法）——官方 `SegmentedTabs` 在工程编译期 pin 的
          primitives 0.1.5-rc.2 里不存在，直接 import 会 TS 报错（pin 对齐是另一个待用户拍板项）。
          aria 契约：容器 `role="tablist"` + `aria-label`；页签 `role="tab"` + `aria-selected` +
          `aria-controls`（指向面板 id）+ roving `tabIndex`；←/→/Home/End 走焦并选中。 */}
      <div role="tablist" aria-label={ENTERPRISE_MARKET_TABLIST_LABEL} className="own-market-tabs">
        {ENTERPRISE_MARKET_TABS.map((tab, index) => {
          const selected = tab.id === activeTab
          return (
            <button
              key={tab.id}
              id={ENTERPRISE_MARKET_TAB_IDS[tab.id].tab}
              type="button"
              role="tab"
              className="own-market-tab"
              aria-selected={selected}
              aria-controls={ENTERPRISE_MARKET_TAB_IDS[tab.id].panel}
              tabIndex={selected ? 0 : -1}
              onClick={() => { onSelectTab?.(tab.id) }}
              onKeyDown={(event) => { onTabKeyDown(event, index) }}
            >{enterpriseMarketTabLabel(tab.label, tabCounts[tab.id])}</button>
          )
        })}
      </div>
      {/* 三个面板按页签顺序严格配对（`id` ↔ `aria-controls` ↔ `aria-labelledby` 三处同源）。
          非当前页签只留一个 `hidden` 空壳：既让 `aria-controls` 恒能解析，又保证**内容整段不挂载**
          ——页签已经承担「显隐」，不必为隐藏的页签再渲染一次。 */}
      <div
        id={ENTERPRISE_MARKET_TAB_IDS.skills.panel}
        role="tabpanel"
        aria-labelledby={ENTERPRISE_MARKET_TAB_IDS.skills.tab}
        hidden={activeTab !== 'skills'}
        className="own-market-panel"
      >
        {/* 「企业技能」页签内容（默认页签，用户主战场）：与企业插件节同规则——「技能」大组件开启
            （= 会话可用）且目录非空才出现。行 = 官方两行卡片（标题 + 描述）+ 右侧 [有更新时的辅助标签]
            [官方 Switch]（开关与企业插件行同款）；一键安装/卸载到官方 `~/.dsh/skills`，已装态与「有更新」
            都只认 Host 回传的真值（`installedSkills` 的 `versionId` × 行上的 `latestVersionId`；本页不猜版本、
            不留乐观已装）。列的是后台分配（预置）的全部技能——未装的照列，装不装由用户拨这枚开关决定。
            节头折叠已删（显隐由页签承担），计数已并入页签文案。 */}
        {activeTab === 'skills' && skillRowsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-skills">
            <ul className="own-market-rows">
              {enterpriseSkills.map(skill => {
                const skillState = enterpriseMarketSkillState(installedSkills, pendingSkill, skill)
                // 开关口径照企业插件行（同一枚官方 Switch）：`checked` = 该技能已落盘（卸载在途、有更新时都算已装，
                // 磁盘上还在），两个在途态 `disabled`（并发动作会互相覆盖已装清单），`label` 给动作语义。
                const installed = skillState === 'INSTALLED' || skillState === 'UPDATE_AVAILABLE' || skillState === 'REMOVING'
                const busy = skillState === 'INSTALLING' || skillState === 'REMOVING'
                // 辅助标签只认「有更新」这一个事实（与受管态共用同一判定点），与 `pendingSkill` 无关：
                // 在途时它**保留但禁用**（用户看得见「正在更新」），未装行 / 已装同版本行/未装行的在途一律不出。
                const hasUpdate = enterpriseMarketSkillRowHasUpdate(installedSkills, skill)
                const updateTag = enterpriseMarketSkillUpdateTag(skill.displayName)
                // 第 1 行标题后那两枚标签的取值：版本签取列表投影的 `sourceDshVersion`（无需服务端改动）；
                // 分类签取新增可选字段 `category`——没有（缺席/null/空串）时这里就是 undefined，签**整枚不渲染**。
                const versionTag = enterpriseMarketSkillVersionTag(skill.sourceDshVersion)
                const categoryTag = enterpriseMarketSkillCategoryTag(skill.category)
                return (
                  <li
                    key={skill.id}
                    className="own-market-row"
                    data-enterprise-skill-package={skill.id}
                    data-enterprise-skill-id={skill.skillId}
                    data-enterprise-skill-state={skillState}
                  >
                    <div className="own-market-rowLine">
                      <span className="own-market-rowIcon"><Sparkles size={18} aria-hidden="true" /></span>
                      {/* 两行文案照官方已安装卡片 CardHead（title 行 + description 行）：
                          第 1 行 = displayName（= 官方 title，14/20-500-省略），
                          第 2 行 = description（= 官方 description，13/18-tertiary-**单行**省略，不换行撑高卡片）。 */}
                      <div className="own-market-rowMain">
                        {/* 第 1 行 = 官方卡片标题 + 紧随其后的两枚**只读标签**（复用官方 `Tag` 原语，
                            tone 照本文件 badge 槽既有口径：版本签 neutral、分类签 info），整行 nowrap 单行
                            （`.own-market-cardHead`）——标签过多时标题先省略、两枚签保持可见，行高不变。
                            分类缺席/null/空串时整枚签不渲染（安静缺席、不塞占位）；第 2 行描述与右侧
                            [有更新辅助标签] [Switch] 的既有结构与行为一字未动。 */}
                        <span className="own-market-cardHead">
                          <span className="own-market-cardId own-market-skillTitle">{skill.displayName}</span>
                          {versionTag === undefined ? null : (
                            <Tag className="own-market-tag own-market-skillVersionTag" tone="neutral">{versionTag}</Tag>
                          )}
                          {categoryTag === undefined ? null : (
                            <Tag className="own-market-tag own-market-skillCategoryTag" tone="info">{categoryTag}</Tag>
                          )}
                        </span>
                        <span className="own-market-cardDesc">{skill.description}</span>
                      </div>
                      {/* 开关**左侧**的辅助标签：只在「有更新」时出现（其余态右侧就一个 Switch）。
                          真实 <button type="button">，键盘可达、`:focus-visible` 焦点环（`.own-market-skillTag`），
                          `data-enterprise-skill-tag` 给测试与门禁；`aria-label` 给动作语义
                          `更新企业技能 X`、`title` 说明「点此更新到中心当前版本」；
                          点击 = 安装中心当前版本（`onToggleSkill(skill, true)`），在途禁用但不消失。 */}
                      {hasUpdate ? (
                        <button
                          type="button"
                          className="own-market-skillTag"
                          data-enterprise-skill-tag={ENTERPRISE_MARKET_SKILL_UPDATE_TAG}
                          aria-label={updateTag.ariaLabel}
                          disabled={!onToggleSkill || busy}
                          title={onToggleSkill === undefined ? '企业账号未登录，暂不可操作' : updateTag.title}
                          onClick={() => { onToggleSkill?.(skill, true) }}
                        >
                          {updateTag.label}
                        </button>
                      ) : null}
                      {/* 右侧官方 Switch（企业插件行同款写法）：`checked` = 该技能已安装，
                          `disabled` = 在途或回调缺席，`label` 给动作语义（安装/卸载企业技能 X），
                          拨动即把 (skill, next) 交回 `onToggleSkill`（true 装 / false 卸）。
                          它始终是该行**主控件**——辅助标签只是有更新时的快捷路，绝不取代开关。 */}
                      <Switch
                        checked={installed}
                        label={`${installed ? '卸载' : '安装'}企业技能 ${skill.displayName}`}
                        disabled={!onToggleSkill || busy}
                        title={onToggleSkill === undefined
                          ? '企业账号未登录，暂不可操作'
                          : busy ? '动作进行中，暂不可操作' : installed ? '点此卸载' : '点此安装到 ~/.dsh/skills'}
                        onChange={(next) => { onToggleSkill?.(skill, next) }}
                      />
                    </div>
                    {/* 失败可见反馈（与「技能」tab 的 own-skill-inlineError 同一口径）：失败即在该行给
                        role="alert" + 稳定错误码，且退回未装态（已装清单仍由 Host 回传真值主导）；
                        失败**不**禁用开关——再拨一次就是重试。 */}
                    {rowError(skillActionError, skill.id)}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
      <div
        id={ENTERPRISE_MARKET_TAB_IDS.plugins.panel}
        role="tabpanel"
        aria-labelledby={ENTERPRISE_MARKET_TAB_IDS.plugins.tab}
        hidden={activeTab !== 'plugins'}
        className="own-market-panel"
      >
        {/* 「企业插件」页签内容：仅当「插件」大组件开启时出现，列企业后台上传的真实插件目录。
            行渲染、失败反馈、开关口径一字未动（只是从「同页分节」搬进本页签），节头折叠已删、计数并入页签文案。 */}
        {activeTab === 'plugins' && pluginRowsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-plugins">
            <ul className="own-market-rows">
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
                  {/* 安装/卸载失败的可见反馈：这是原先「拨了没反应」的那一处——动作失败只有 store 收着码，
                      本页一个字都没说。失败后开关照旧可拨（上面的 disabled 不含本提示）。 */}
                  {rowError(pluginActionError, plugin.packageName)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div
        id={ENTERPRISE_MARKET_TAB_IDS.components.panel}
        role="tabpanel"
        aria-labelledby={ENTERPRISE_MARKET_TAB_IDS.components.tab}
        hidden={activeTab !== 'components'}
        className="own-market-panel"
      >
        {/* 「组件」页签内容：这是页签化后**唯一还带折叠语义**的一节（组件清单本来就有折叠）。 */}
        {activeTab === 'components' ? (
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
        ) : null}
      </div>
    </section>
  )
}

/**
 * 官方 `plugins.item` 的真实入口（唯一含 hook 的导出）：订阅企业账号 store、自持登录弹窗，
 * 把会话可用性、插件目录与开登录回调喂给纯函数体 `EnterpriseMarketEntry`。`store` 缺席时开关恒禁用（不提供假切换）。
 *
 * 技能目录不在 store 快照里，故由本入口按会话可用性就地取（`store.api.skills()`，同源固定路径）；
 * 取数失败/未登录都收敛成空目录——「企业技能」页签据此不出内容，不残留半个错误态。
 * 已装态与目录**并行**取（`store.api.installedSkills()`），并**只对已装行**再补一次详情
 * （`store.api.skillDetail(id)`：中心列表投影的 `versionId` 恒为空串，判定「有更新」只能靠详情里的它）；
 * 已装只用来决定那枚开关的 checked / disabled 与辅助标签出不出现，本页不做乐观切换。
 * **页签状态也自持在这里**（`useState<EnterpriseMarketTabId>`，初值 `ENTERPRISE_MARKET_DEFAULT_TAB`
 * ＝「企业技能」）：纯函数体不持状态，页签的选中态只能由本 hook 入口供给（与折叠态同一写法）。
 * @param props - `view` 透传官方视图；`store` 由共享注册面（`client.tsx` 的 `plugins.item` inject）注入。
 * @returns 官方插件页「插件市场」入口，`page` 视图下页签条 + 组件行开关都真实可用。
 */
export function EnterpriseMarketPage({ view, store }: { readonly view: 'summary' | 'page'; readonly store?: EnterpriseAccountStore | undefined }): ReactNode {
  const snapshot = useAccount(store as EnterpriseAccountStore)
  const dialog = useEnterpriseLoginDialog(store as EnterpriseAccountStore)
  const sessionUsable = enterpriseSessionUsable(snapshot.status?.state)
  // 页签：初值取 `ENTERPRISE_MARKET_DEFAULT_TAB`——**默认落在「企业技能」**（用户的主战场：
  // 后台分配/预置的技能一进页面就列出来），组件与「企业插件」要靠点页签才进去。
  const [activeTab, setActiveTab] = useState<EnterpriseMarketTabId>(ENTERPRISE_MARKET_DEFAULT_TAB)
  // 折叠态：初值取 `ENTERPRISE_MARKET_DEFAULT_EXPANDED`——页签化后**只剩「组件」页签内部**那一节
  // 还带折叠（默认展开）；本组件是唯一 hook 入口，纯函数体不持状态。
  const [expandedSections, setExpandedSections] = useState<Record<EnterpriseMarketSectionId, boolean>>(ENTERPRISE_MARKET_DEFAULT_EXPANDED)
  const onToggleSection = (section: EnterpriseMarketSectionId): void => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  const hasStore = store !== undefined
  const openLogin = hasStore ? dialog.openDialog : undefined
  const pluginStatus = snapshot.pluginStatus
  const catalog = pluginStatus?.catalog ?? []
  const local = pluginStatus?.plugins ?? []
  const enterprisePlugins = enterpriseMarketPluginRows(catalog, local)
  // 技能目录：只在 `page` 视图（企业技能节的宿主）+ 有 store + 会话可用时取；卡片视图不预取。
  // 会话不可用/取数失败一律回落空目录（节随之消失）；依赖变化即中止在途请求，避免迟到结果跨会话回填。
  // 已装态与目录**并行**取：旧 Host 没有 `/skills/installed` 时目录照常显示，只是所有行显示未装、开关全关。
  const [enterpriseSkills, setEnterpriseSkills] = useState<readonly EnterpriseMarketSkillRow[]>([])
  const [installedSkills, setInstalledSkills] = useState<readonly EnterpriseInstalledSkill[]>([])
  const [pendingSkill, setPendingSkill] = useState<EnterpriseMarketSkillPending>()
  useEffect(() => {
    if (view !== 'page' || !hasStore || !sessionUsable) {
      setEnterpriseSkills([])
      setInstalledSkills([])
      return
    }
    const controller = new AbortController()
    // 两条取数各自兜底：目录失败回落空目录（节消失），已装清单失败只回落全部未装（不拖垮目录）。
    const api = store!.api
    void Promise.all([
      api.skills(controller.signal).catch(() => [] as readonly EnterpriseRuntimeSkill[]),
      api.installedSkills(controller.signal).catch(() => [] as readonly EnterpriseInstalledSkill[]),
    ])
      .then(async ([items, installed]) => {
        if (controller.signal.aborted) return
        setInstalledSkills(installed)
        // 中心列表投影不带 `versionId`（`skill-api-decode` 写死空串），只有 `GET /skills/{id}` 详情才是真值，
        // 故**只对已装行**按需取详情：没有本机版本的未装行无从比较，不白跑请求；某行详情失败即留空
        // （该行不判「有更新」），也绝不拖垮整个目录。按 id 归并成行上的 `latestVersionId`。
        const details = await Promise.all(installed.map(item =>
          api.skillDetail(item.packageId, controller.signal).catch(() => undefined),
        ))
        if (controller.signal.aborted) return
        setEnterpriseSkills(enterpriseMarketSkillRows(items, details.filter(detail => detail !== undefined)))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setEnterpriseSkills([])
        setInstalledSkills([])
      })
    return () => { controller.abort() }
  }, [view, hasStore, sessionUsable, store])
  const versionIdByPackage = new Map(catalog.map(item => [item.packageName, item.pluginVersionId]))
  // 失败可见反馈（两行共用同一份口径）：
  // · 技能侧：动作 promise 的 catch 直接拿到错误对象（行键 = 技能包 id）；
  // · 插件侧：`store.#pluginAction` 把失败**吞**进 `snapshot.pluginErrorCode`（不 rethrow，设置页插件
  //   市场正是靠它出头号提示），所以这里记住「刚发起动作的那一行与动作」，再把 store 已收下的稳定码
  //   归到该行；`localCode` 只用于本地就能判定、根本没发出请求的那一种（目录里已无可安装版本）。
  // 每次发起动作都先清掉旧提示（照「技能」tab 的 `setActionError(undefined)`），成功后自然不会再出现。
  const [skillActionError, setSkillActionError] = useState<EnterpriseMarketActionError>()
  const [pluginAction, setPluginAction] = useState<{
    readonly packageName: string
    readonly action: 'install' | 'uninstall'
    readonly localCode?: string
  }>()
  const pluginErrorCode = pluginAction?.localCode ?? snapshot.pluginErrorCode
  const pluginActionError: EnterpriseMarketActionError | undefined =
    pluginAction !== undefined && pluginErrorCode !== undefined
      ? { id: pluginAction.packageName, action: pluginAction.action, code: pluginErrorCode }
      : undefined
  const onTogglePlugin: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      const action: 'install' | 'uninstall' = next ? 'install' : 'uninstall'
      if (next) {
        const versionId = versionIdByPackage.get(row.packageName)
        if (versionId === undefined) {
          // 本机还装着、企业目录里已经没有可安装的版本（下架/版本被撤）：不发请求，也不留静默 no-op。
          setPluginAction({ packageName: row.packageName, action, localCode: 'ENT_RESOURCE_NOT_FOUND' })
          return
        }
        setPluginAction({ packageName: row.packageName, action })
        void store!.installPlugin(row.packageName, versionId)
      } else {
        setPluginAction({ packageName: row.packageName, action })
        void store!.removePlugin(row.packageName)
      }
    }
    : undefined
  const onToggleSkill: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      // 与企业插件同一并发纪律：同一时刻只允许一个技能动作，动作返回的已装清单直接覆盖本地真值。
      if (pendingSkill !== undefined) return
      setPendingSkill({ packageId: row.id, next })
      setSkillActionError(undefined)
      const signal = AbortSignal.timeout(120_000)
      const operation = next ? store!.api.installSkill : store!.api.uninstallSkill
      void operation.call(store!.api, row.id, signal)
        .then(items => setInstalledSkills(items))
        .catch((error: unknown) => {
          // 失败就把该行退回未装态：不保留乐观已装，避免界面比磁盘更乐观。
          if (next) setInstalledSkills(previous => previous.filter(item => item.packageId !== row.id))
          // 并把失败摆到这一行上（稳定错误码 + 安装/卸载前缀）：原先这里只吞错误，用户拨了开关没有任何反应。
          setSkillActionError({ id: row.id, action: next ? 'install' : 'uninstall', code: enterpriseLocalErrorCode(error) })
        })
        .finally(() => setPendingSkill(undefined))
    }
    : undefined
  return (
    <>
      <EnterpriseMarketEntry
        view={view}
        sessionUsable={sessionUsable}
        onOpenLogin={openLogin}
        enterprisePlugins={enterprisePlugins}
        enterpriseSkills={enterpriseSkills}
        onTogglePlugin={onTogglePlugin}
        installedSkills={installedSkills}
        pendingSkill={pendingSkill}
        onToggleSkill={onToggleSkill}
        pluginActionError={pluginActionError}
        skillActionError={skillActionError}
        expandedSections={expandedSections}
        onToggleSection={onToggleSection}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
      <EnterpriseLoginDialog store={store as EnterpriseAccountStore} open={dialog.open} onClose={dialog.closeDialog} />
    </>
  )
}
