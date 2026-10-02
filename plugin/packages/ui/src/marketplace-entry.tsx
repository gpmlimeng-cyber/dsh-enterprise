/**
 * [INPUT]: 依赖 React（useEffect/useState）、lucide-react 图标（组件行三枚 + 侧栏入口的 Store + 两套外壳各自的图形）、官方 ui-primitives 的 Switch/Tag/StateDot（pinned 0.1.5-rc.2 的 .d.ts 已导出，不走 official-ui 收窄接缝；**该 pin 不含 `SegmentedTabs`**，故页签条照 `account-view.tsx` 既有 tablist 手写自绘，pin 对齐是另一个待用户拍板的开放项）、account-state 的 `enterpriseSessionUsable` 与 account-store 的 `EnterpriseAccountStore`（订阅只发生在共享控制器 `useEnterpriseMarketController` 里）、local-api-decode 的技能 DTO（`EnterpriseRuntimeSkill` 目录 + 已装记录 `EnterpriseInstalledSkill`——「已装」只认后者这一份 Host 真值）与失败码唯一投影 `enterpriseLocalErrorCode`（行内失败提示的 code 来源，与技能 tab 同源）、消费官方 `plugins.item` owner props（`view`/`form`）与主内容区面板（`main` key）注入的等价 props（`view` 恒取 `ENTERPRISE_STORE_PANEL_VIEW`、`store` 与卡片同源）；中心当前版本只从**详情投影** `store.api.skillDetail(id)` 取（列表投影的 `versionId` 恒为空串），且只对已装行取——未装行没有本机版本可比，不白跑请求
 * [REF]: **旧外观的逐段真源是 `9723a97:plugin/packages/ui/src/marketplace-entry.tsx`**（技能行 = 官方两行卡片：第 1 行标题 `.own-market-cardId` + 版本签 + 分类签，第 2 行描述 `.own-market-cardDesc`，右侧 `[有更新] [Switch]`；插件行 = 图标 + 两行文案 + 状态点 + 官方状态词 + `Switch`；三个页签；组件节折叠），**不从记忆重写**；**新外观**取自 7557ffd 那一版，但**行版式已在本轮统一到旧外观那一套**：7557ffd 的官方插件清单卡片 `qSYn7G_*`（`.own-market-cardShell`/`.own-market-cardGrid`/`.own-market-cardTitle`/`.own-market-cardDescription`/`.own-market-cardActions` 等，连同两列网格与 `@container`/`@media 520` 兜底）**整组删除**，只作出处留痕。两套外壳的**目录行完全同源**：由同一枚子块 `EnterpriseMarketInlineRows` 渲染同一串类名（`.own-market-rows`/`.own-market-row*`/`.own-market-cardHead`/`.own-market-cardId`/`.own-market-cardDesc`），行取值只有一份 `rowStyles`；旧外壳的 `<style>` 因此仍是 `baseStyles + rowStyles`，与改动前**逐字节相同**（同一份 DOM 大纲 + 同一份 6880 字符 CSS）。呈现差异只剩「HERO + 搜索框 + 根内边距」三件。旧外观那一版用的 `.own-market-tabs` 与 `plugin-market.tsx` 同名（两份全局单类 `<style>` 互相覆盖），7557ffd 已因此改名 `.own-market-storeTabs`——**页签条两套共用改后的类名，不许退回旧名**。
 * [OUTPUT]: **两套呈现外壳 + 一份逻辑 + 一份技能详情弹层**。**本刀（技能详情）**：技能行**行本体**（图标 + 两行文案）成为一枚真 `<button class="own-market-rowOpen">`——点它打开该技能的详情弹层；`[有更新]` 与官方 `Switch` 是它在 `.own-market-rowLine` 里的**同级兄弟**（不在按钮内，故点动作既不会冒泡进详情、也不会被藏起来），两者由**唯一一枚共享子块** `EnterpriseMarketSkillRowActions` 渲染（行本体与详情弹层渲染的是同一枚子块、同一份 `facts`、同一个 `onToggleSkill`）。详情承载形式是**官方 `Modal`**：`EnterpriseSkillDetailView`（纯函数，Esc / 点遮罩 / 关闭按钮三条路径都由官方原语的 `onClose` 承担，本文件不画遮罩、不接 keydown、不管焦点）+ `EnterpriseSkillDetailDialog`（唯一含副作用的包装：**只在已装时**经 `store.api.skillContent` 读 `<dshHome>/skills/<name>/SKILL.md` 的正文，名字取 Host 已装记录里的 `names[0]`，界面从不拼路径、不接受用户输入）；配套纯投影 `enterpriseSkillDetailFacts`（技能名称/技能 ID/技能包 ID/DSH 版本/可选分类/已装状态，分类缺席即整条不产出）、`enterpriseSkillDetailInstallLabel` 与 `enterpriseSkillDetailBody`（未装 / 读取中 / 读失败（带稳定码）/ 已取到四态）及四条提示常量 `ENTERPRISE_SKILL_DETAIL_{NOT_INSTALLED,LOADING,FAILED,EMPTY}`；`EnterpriseMarketShellProps` 新增 `onOpenSkillDetail`（缺席即那枚按钮 `disabled` + 说明性 title，照组件节节头的既有降级口径，不给死按钮），共享控制器的 `EnterpriseMarketController.skillDetail` 是弹层输入的**唯一构造点**（行投影/行 facts/同一条已装记录/同一份失败事实/同一个动作回调），共享宿主 `EnterpriseMarketShellHost` 同树渲染它——弹层**不属于任何一套外观**。另：`rowStyles` 随之多出 `.own-market-rowOpen` 三条规则。 以下为既有能力：**两套呈现外壳 + 一份逻辑**。共享逻辑只有一处：控制器 hook `useEnterpriseMarketController`（store 订阅与取数、已装真值、安装/卸载动作、失败码归行、页签选中态、行开合态、搜索输入与 350ms 防抖）、模型投影 `enterpriseMarketShellModel(props)`（组件清单行、目录门控、页签文案与计数、过滤后的可见行、折叠态）与行级 facts `enterpriseMarketSkillRowFacts`/`enterpriseMarketPluginRowFacts`（受管态、开关口径、更新判定、两枚签取值、行键与开合、插件开关禁用口径）。呈现外壳是两个纯函数组件、接受**同一组** `EnterpriseMarketShellProps`：`EnterpriseMarketLegacyShell`（旧外观：行图标 + 官方两行卡片 + 右侧 `[有更新] [Switch]`，**无 HERO**、无搜索框、无行展开）与 `EnterpriseMarketStoreShell`（新外观：**含 HERO** + 搜索框 + 根内边距；目录行与旧外壳**同一套**——同一枚子块 `EnterpriseMarketInlineRows`，动作与失败提示都在行内；**不折叠**）。两者共用的行渲染子块是 `EnterpriseMarketInlineRows`（按目录页签铺整段 `.own-market-rows`：技能行 = 图标 + 两行文案 + `[有更新]` + `Switch` + 失败提示；插件行 = 图标 + 两行文案 + 状态点与官方状态词 + `Switch` + 失败提示）。两条入口各一个 hook 组件——`EnterpriseMarketLegacyPage` 注册到官方 `plugins.item`、`EnterpriseMarketStorePage` 注册到官方 `main`（key = `ENTERPRISE_STORE_PANEL_ID`），两者都只经 `EnterpriseMarketShellHost` 接同一份控制器与同一个登录弹窗。另出口：共享身份常量（`ENTERPRISE_STORE_PANEL_ID`/`ENTERPRISE_STORE_ENTRY_LABEL`/`ENTERPRISE_STORE_ENTRY_ORDER`/`ENTERPRISE_STORE_PANEL_VIEW`）与侧栏图标 `EnterpriseStoreIcon`；HERO 文案真源（`ENTERPRISE_STORE_HERO_TITLE`/`ENTERPRISE_STORE_HERO_NOTE`/`enterpriseMarketHeroSkillChip`/`enterpriseMarketHeroPluginChip`）；页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`/`enterpriseMarketTabLabel`）；组件清单与计数摘要投影（`ENTERPRISE_MARKET_COMPONENTS`/`ENTERPRISE_MARKET_PLAN`/`enterpriseMarketComponent{Enabled,State,Dot,SwitchDisabled,Summary,SummaryText}`）；行投影（`enterpriseMarketPluginRows`/`enterpriseMarketPluginSectionVisible`/`enterpriseMarketSkillRows`/`enterpriseMarketSkillSectionVisible`）；技能行标签与状态投影（`enterpriseMarketSkillVersionTag`/`enterpriseMarketSkillCategoryTag`/`enterpriseMarketSkillHasUpdate`/`enterpriseMarketSkillRowHasUpdate`/`enterpriseMarketSkillUpdateTag`/`ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`/`ENTERPRISE_MARKET_SKILL_UPDATE_TAG`/`enterpriseMarketSkillState`/`enterpriseMarketSkillDot`/`enterpriseMarketSkillConfigTag`/`enterpriseMarketSkillStatusLabel`）；插件行状态投影（`enterprisePluginDot`/`enterpriseMarketPluginConfigTag`/`enterpriseMarketPluginStatusLabel`）；行键与开合投影（`enterpriseMarketRowKey`/`enterpriseMarketRowDetailsId`/`enterpriseMarketRowOpen`）；搜索真源（`ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS`/`EnterpriseMarketDirectoryTabId`/`ENTERPRISE_MARKET_DIRECTORY_TABS`/`ENTERPRISE_MARKET_SEARCH_INITIAL`/`enterpriseMarketSearchPlaceholder`/`enterpriseMarketSearchLabel`/`ENTERPRISE_MARKET_SEARCH_EMPTY`/`enterpriseMarketSearchTerm`/`enterpriseMarketSearchRows`/`enterpriseMarketSearchSkillRows`/`enterpriseMarketSearchPluginRows`）；折叠真源（`ENTERPRISE_MARKET_DEFAULT_EXPANDED`/`enterpriseMarketSectionOpen`/`EnterpriseMarketSectionId`/`ENTERPRISE_MARKET_SECTION_IDS`）；**两套外壳共用的行渲染子块 `EnterpriseMarketInlineRows`**（行版式统一的唯一实现点）；失败可见反馈（`EnterpriseMarketActionError`/`enterpriseMarketActionErrorLabel`/`EnterpriseMarketRowError`）；badge 槽（`EnterpriseMarketBadge`/`BadgeView`/`enterpriseMarketVersionTag`）；注册常量 `ENTERPRISE_MARKET_ENTRY_ID`/`ENTERPRISE_MARKET_ENTRY_LABEL`/`ENTERPRISE_MARKET_ENTRY_ORDER`。卡片摘要与详情页正文**不重复同一句**——摘要只在 `summary` 视图出现（官方必渲染的那一份，两套外壳共用 `EnterpriseMarketSummaryLine`）。
 * [POS]: ui 的企业应用商店（**明确的双外观拆分：两条入口各用各的呈现外壳、共用同一份逻辑**）。**本刀（技能详情）**：技能行本体可点 → 打开该技能详情弹层（**弹层不属于任何一套外观**，由共享宿主 `EnterpriseMarketShellHost` 在两条入口上各渲染一次），故官方插件页「插件市场」与侧栏「应用商店」**两边都拿到同一个入口**；企业插件行与组件行**不给**详情入口（用户只要求技能行；插件行本轮一字未动，组件行是交付排期清单）。详情里的动作与行上**同源**：同一枚 `EnterpriseMarketSkillRowActions`、同一份 `enterpriseMarketSkillRowFacts`、同一个 `onToggleSkill` 回调、同一份 `skillActionError`，因此不存在第二套状态或第二个动作实现；正文只对**已装**技能可读（中心详情投影只有 frontmatter 脱敏事实、不含正文），未装行显示「安装后可查看完整内容」并**一条请求都不发**；读正文失败给 `role="alert"` + 稳定错误码 + 重试按钮，不静默。 以下为既有能力：ui 的企业应用商店——① 官方插件页「官方」分组里的「插件市场」卡片点进去（官方 `plugins.item` 的 `page` 视图）走 **旧外壳 `EnterpriseMarketLegacyShell`**（9723a97 那一版观感：行图标 + 官方两行卡片 + 右侧 `[有更新] [Switch]`，**没有** HERO、没有搜索框、没有可展开行）；② 侧栏一级入口「应用商店」对应的**主内容区面板**（官方 `main` 槽，`key = ENTERPRISE_STORE_PANEL_ID='enterprise-store'`，注册时注入恒定的 `view = ENTERPRISE_STORE_PANEL_VIEW`）走 **新外壳 `EnterpriseMarketStoreShell`**（渐变 HERO + 列表上方搜索框 + 根内边距；**目录行与官方插件页「插件市场」逐项同一套**：两个目录页签的行由同一枚子块 `EnterpriseMarketInlineRows` 渲染，动作（`[有更新]` + 官方 `Switch`）与失败提示都在行内；**不折叠**）。**版式统一的落点（本刀）**：两条入口现在**共用同一段行渲染**——`EnterpriseMarketInlineRows` 是唯一实现点，旧外壳与新外壳各调用它两次（两个目录页签）；行类名（`.own-market-rows`/`.own-market-row`/`.own-market-rowLine`/`.own-market-rowIcon`/`.own-market-rowMain`/`.own-market-cardHead`/`.own-market-cardId`/`.own-market-cardDesc`）、行 facts、动作顺序（辅助动作严格排在开关左侧）与失败提示因此是**结构性一致**，将来不会再分叉。新外壳**只多三件**：HERO（`EnterpriseMarketHero`）、两个目录页签的搜索框（350ms 防抖）、根容器的 `.own-market-storePage` 内边距；其余（页签条与 aria/键盘、面板壳、组件节、失败提示）本来就是共享的一份。**新外壳目录行为什么不折叠（用户裁决 A）**：那个展开区里原先只有对用户近乎无用的 `skillId` 与两个真正的动作（`[有更新]` / 安装卸载 `Switch`），而企业技能/企业插件目录常态只有 3–5 行——把**唯一真正要做的事**藏进一次点击之后没有任何收益，反而让「有更新」不可见。故新外壳目录行删掉 chevron、`aria-expanded`/`aria-controls`、整个展开区与 `skillId` 行，动作（`[有更新]` + `Switch`）**常显在行上**；失败提示直接跟在整条行线下方。**旧外壳与共享控制器都不因此改动**（旧外壳本来就不折叠；控制器里的行开合态按「不夹带清理」保留，见该处注释）。四个注册面（`main`、`sidebar.panellist`、`plugins.item`、`plugins.detail.badge`）与全部注册常量、`inject` 形状一字未改，只有「注册到 `plugins.item` 与 `main` 的组件」从原来那一个换成了各自的 hook 入口。**两套外壳的公共能力一条不少**：版本签（`sourceDshVersion`）、可选分类签（`category`，缺席/null/空串不渲染）、「有更新」辅助动作（真实 `<button>`，点击 = 更新到中心当前版本）、安装/卸载 `Switch`、「失败 `role="alert"` + 稳定错误码 + 失败可重试」、三页签（企业技能默认 / 企业插件 / 组件）、组件页签折叠语义、页签的 aria 契约与键盘走焦（两套外壳共用 `EnterpriseMarketTabStrip` 一份实现）。**严禁**任何价格/交易/购买/购物车/客服之类的商业化字样——两套外壳的全树文本都不出现（由测试反向锁死）。`store` 与开登录回调均为可选注入：缺席时开关恒禁用、会话不可用时目录节不出现，两套外壳同规则。**容器内边距只在新外壳这一层分叉**：新外壳的根节点多一枚类 `.own-market-storePage`（`storeStyles` 里 `padding:14px 14px 20px`），HERO / 页签条 / 搜索框 / 通栏行 / 行内失败提示全部落在同一个有内边距的容器里——因为官方 `main` 面板不像 `DetailTop` 那样自带外层内边距，不给这层就整页贴边；旧外壳（`plugins.item` 详情页）**自身一行不加**、依赖官方 `DetailTop` 自带内边距，两者**不可互相叠加**（给旧外壳补内边距会让旧外观变挤）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Package, Sparkles, BookMarked, ChevronDown, RefreshCw, Search, Store } from 'lucide-react'
import { Button, Modal, StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { enterpriseSessionUsable, useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { enterprisePluginStatePresentation } from './plugin-market.js'
import type { EnterpriseInstalledSkill, EnterpriseInstalledSkillContent, EnterprisePluginCatalogItem, EnterprisePluginItem, EnterpriseRuntimeSkill, ManagedPluginState } from './local-api-decode.js'
import { enterpriseLocalErrorCode } from './local-api-decode.js'
import { EnterpriseLoginDialog, useEnterpriseLoginDialog } from './login-dialog.js'

/** 本入口在官方插件页占用的 slot id，同时是卡片 DOM 的 `data-plugin-item` 与详情页路由键。 */
export const ENTERPRISE_MARKET_ENTRY_ID = 'plugin-market'

/** 卡片与详情页共用的标题，官方把它渲染在卡片标题与详情页 `h3` 两处。 */
export const ENTERPRISE_MARKET_ENTRY_LABEL = '插件市场'

/** 在官方 `plugins.item` 中排在官方四个配置卡片（10/20/30/40）之后。 */
export const ENTERPRISE_MARKET_ENTRY_ORDER = 50

/**
 * 独立应用商店的**共享身份**：侧栏一级入口的 `sidebar.panellist.id` 与主内容区面板的 `main.key` 必须同值
 * （官方契约：「每个 list id 对应同名 main 面板」；不同值会让点击命中 `layout.selectPanel` 的「未注册」抛错）。
 */
export const ENTERPRISE_STORE_PANEL_ID = 'enterprise-store'

/** 侧栏一级入口文案：侧栏按钮的行标题与可访问名都由它解析（`resolveSlotLabel` 收字符串或函数）。 */
export const ENTERPRISE_STORE_ENTRY_LABEL = '应用商店'

/** 侧栏排序：官方实测占用 `plugins = 0`、`schedules = 10`，故取 20 排在两者之后。 */
export const ENTERPRISE_STORE_ENTRY_ORDER = 20

/**
 * 新面板（`main` key = `ENTERPRISE_STORE_PANEL_ID`）恒用的视图值，与官方 `plugins.item` 的 `page` 同值。
 * 这就是「一份实现两处入口」的全部差异：`plugins.item` 由官方传 `view`（卡片 `summary` / 详情 `page`），
 * 面板侧由 `client.tsx` 的 `inject` 传这个常量——面板恒走 `page` 分支（与官方 `plugins.item` 详情页的那个值同源）。
 */
export const ENTERPRISE_STORE_PANEL_VIEW = 'page' as const

/**
 * 侧栏一级入口「应用商店」的图标（官方 `sidebar.panellist` owner props 为 `{ size, active }`；
 * 侧栏自己拥有按钮与 label，本组件只画图形）。用 lucide `Store`：与本页组件行的 `Package`/`Sparkles`
 * 同一套描边图形；官方 primitives 的 `Icon*OutlineRegular` 集合里没有商店/货架语义（无 store/grid 之族），
 * 故不硬借一颗语义不符的官方图标。
 */
export function EnterpriseStoreIcon({ size }: { readonly size: number }): ReactNode {
  return <Store size={size} aria-hidden="true" />
}

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
 * 两套外壳都**不能调 `useId`**（那会把外壳变成 hook 组件，破坏「可直接函数调用测试」的既有形状）；
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

/**
 * 搜索框防抖（毫秒）：照参考对象 `MarketplaceSection` 的一处定值（`setTimeout(..., 350)`）。
 * 只做**纯客户端过滤**——不发新请求、不新增本机路由；防抖只是为了不让每次按键都重排整页。
 */
export const ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS = 350

/**
 * 可搜索的页签（目录类）：只有内容跟着中心目录走、行数会长的两个页签配搜索框。
 * 「组件」页签恒三行、且是交付排期清单（不是市场目录），过滤它只会把三行藏成一两行，故不配搜索框。
 */
export type EnterpriseMarketDirectoryTabId = 'skills' | 'plugins'

/** 目录类页签的稳定顺序（搜索槽位按它初始化）。 */
export const ENTERPRISE_MARKET_DIRECTORY_TABS: readonly EnterpriseMarketDirectoryTabId[] = ['skills', 'plugins']

/** 搜索槽位的初值：每个目录页签一个独立的关键词（切页签不串词）。 */
export const ENTERPRISE_MARKET_SEARCH_INITIAL: Record<EnterpriseMarketDirectoryTabId, string> = { skills: '', plugins: '' }

/** 搜索框占位文案（说清搜的是什么，照参考对象「搜索智能体模板…」的句式）。 */
export function enterpriseMarketSearchPlaceholder(tab: EnterpriseMarketDirectoryTabId): string {
  return tab === 'skills' ? '搜索企业技能…' : '搜索企业插件…'
}

/** 搜索框的无障碍名（读屏听到的动作名，与占位同源但不带省略号）。 */
export function enterpriseMarketSearchLabel(tab: EnterpriseMarketDirectoryTabId): string {
  return tab === 'skills' ? '搜索企业技能' : '搜索企业插件'
}

/** 过滤后一条都不剩时的空态文案（不是「目录为空」——目录为空时整节都不渲染）。 */
export const ENTERPRISE_MARKET_SEARCH_EMPTY = '没有匹配的条目'

/** 关键词归一（唯一入口）：去首尾空白 + 折叠大小写。空关键词 = 不过滤。 */
export function enterpriseMarketSearchTerm(query: string): string {
  return query.trim().toLowerCase()
}

/**
 * 通用客户端过滤：空关键词**原样返回全部**（不减不增、不动顺序），否则任一字段（大小写不敏感）命中即留。
 * 纯函数、无状态、不发请求——目录仍来自 Host 真值，这里只决定「这一屏显示哪几行」。
 * @param rows - 当前页签的行（目录顺序）。
 * @param query - 输入框里的原始关键词（本函数自己归一，调用方不必预处理）。
 * @param fields - 一行的可匹配字段（缺席的字段用 undefined 表示，不参与匹配）。
 * @returns 过滤后的行（新数组）。
 */
export function enterpriseMarketSearchRows<T>(
  rows: readonly T[],
  query: string,
  fields: (row: T) => readonly (string | undefined)[],
): T[] {
  const term = enterpriseMarketSearchTerm(query)
  if (term === '') return [...rows]
  return rows.filter(row => fields(row).some(field => field !== undefined && field.toLowerCase().includes(term)))
}

/** 技能行的可匹配字段：显示名 / 描述 / 技能包 id / 分类 / DSH 版本。 */
export function enterpriseMarketSearchSkillRows(rows: readonly EnterpriseMarketSkillRow[], query: string): EnterpriseMarketSkillRow[] {
  return enterpriseMarketSearchRows(rows, query, row => [row.displayName, row.description, row.skillId, row.category, row.sourceDshVersion])
}

/** 企业插件行的可匹配字段：包名 / 版本（其余字段是枚举态，搜它们没有意义）。 */
export function enterpriseMarketSearchPluginRows(rows: readonly EnterpriseMarketPluginRow[], query: string): EnterpriseMarketPluginRow[] {
  return enterpriseMarketSearchRows(rows, query, row => [row.packageName, row.version ?? undefined])
}

/**
 * 行的开合状态真源（共享控制器 `useEnterpriseMarketController` 的 `useState<string | null>`）：
 * 行键 = `{页签}:{行 id}`——带页签前缀是为了「切页签不会误开同名行」（技能包 id 是雪花、插件是包名，两者不该互相命中）。
 */
export function enterpriseMarketRowKey(tab: EnterpriseMarketDirectoryTabId, id: string): string {
  return `${tab}:${id}`
}

/** 展开区容器的 DOM id（标题行按钮 `aria-controls` 的落点）：行 id 只留安全字符，包名里的 `@`/`/` 不会拿到非法选择器。 */
export function enterpriseMarketRowDetailsId(tab: EnterpriseMarketDirectoryTabId, id: string): string {
  return `market-details-${tab}-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`
}

/**
 * 某行是否展开——**单选**：同一时刻最多一行展开（照参考对象的 `expanded === item.id`）。
 * 显式给了 `expandedRow`（真运行时恒为 `string | null`）就按它；`undefined` 视为「没有给过状态」→ 全开，
 * 让纯函数直调拿到完整树（与 `enterpriseMarketSectionOpen` 的 `defaultOpen` 同一约定）。
 */
export function enterpriseMarketRowOpen(expandedRow: string | null | undefined, key: string): boolean {
  return expandedRow === undefined ? true : expandedRow === key
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

/**
 * 两套外壳（`EnterpriseMarketLegacyShell` / `EnterpriseMarketStoreShell`）**共用**的 props —— 外壳之间唯一允许的差异是版式。
 * 业务真值（目录、已装清单、在途动作、两个失败码）与全部回调由共享控制器 `useEnterpriseMarketController` 统一注入；
 * UI 态（页签选中 / 搜索 / 行开合 / 组件节折叠）也来自同一份控制器状态。纯函数直调时全部可选——
 * 缺席即按最保守的口径渲染（未登录、无目录、无失败、全展开），这样测试能直接函数调用拿到完整语义树。
 */
export interface EnterpriseMarketShellProps {
  /** 视图：卡片一句话用 `summary`，详情正文用 `page`（两套外壳都支持，入口侧各自恒定传 `page`）。 */
  readonly view: 'summary' | 'page'
  /**
   * 官方对注册了配置命名空间的条目传入配置表单；本入口没有配置命名空间，
   * `PluginManagerPage.formFor()` 会提前返回 `undefined`，因此这里只声明不消费。
   */
  readonly form?: never
  /**
   * 企业账号共享 store：控制器订阅它并算出会话可用性/开登录回调后注入。外壳自身不订阅、不调 hook
   * （保持纯函数可直接调用），`store` 缺席时外壳拿到的 `sessionUsable` 是 false。
   */
  readonly store?: EnterpriseAccountStore | undefined
  /** 会话可用性直传（测试用）：真运行时由控制器订阅 store 算出后传入，缺席取 false。 */
  readonly sessionUsable?: boolean
  /** 打开企业登录弹窗的回调：未登录时拨动组件开关触发；缺席时开关恒禁用（不提供假切换）。 */
  readonly onOpenLogin?: (() => void) | undefined
  /**
   * 企业后台上传的真实插件目录（`store.pluginStatus.catalog` × 本机记录归并后的行投影）。
   * 仅当「插件」大组件开启（`sessionUsable`）且非空时在「企业插件」页签渲染；缺席 = 空目录。
   */
  readonly enterprisePlugins?: readonly EnterpriseMarketPluginRow[] | undefined
  /**
   * 企业技能目录（`store.api.skills()` 的列表投影；已装行的中心当前版本由控制器补详情归并）。
   * 与「企业插件」同规则：仅当「技能」大组件开启且目录非空时在「企业技能」页签渲染；
   * **列的是后台分配（预置）的全部技能**，不按「已装」过滤。缺席 = 空目录。
   */
  readonly enterpriseSkills?: readonly EnterpriseMarketSkillRow[] | undefined
  /**
   * 本机已装技能记录（Host 真值）：「已装」只认这份记录里的 `packageId`；「有更新」只用它的 `versionId`
   * 比行上的 `latestVersionId`（两侧都非空且不等）。缺席时所有行显示未装、开关一律关，两层外壳都不猜。
   */
  readonly installedSkills?: readonly EnterpriseInstalledSkill[] | undefined
  /** 当前正在安装/卸载的技能包动作（行键 + 方向）；命中行的开关禁用（在途不许再拨）。 */
  readonly pendingSkill?: EnterpriseMarketSkillPending | undefined
  /** 企业插件的安装/卸载动作；缺席时开关禁用（不提供假切换）。 */
  readonly onTogglePlugin?: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined
  /**
   * 企业技能的一键安装/卸载动作；缺席时技能行开关禁用（与插件行同一降级口径）。
   * `next` 就是官方 Switch 拨动后的目标态：`true` = 装到本机 `~/.dsh/skills`、`false` = 卸掉。
   */
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  /**
   * 打开某条**企业技能**的详情弹层（用户点行本体触发，不是点开关/`[有更新]`）。
   *
   * 只交回被点的那一行——弹层里的名称/描述/分类/版本/skillId/已装态与动作全部由宿主用**同一份真值**
   * （同一个 `EnterpriseMarketSkillRow` + 同一个 `enterpriseMarketSkillRowFacts` + 同一个 `onToggleSkill`）
   * 投影出来，界面上不存在第二套状态。缺席时那枚按钮 `disabled` + `title='详情入口未接通'`
   * （照组件节节头「折叠动作未接通」的既有降级口径：**不给死按钮**，也不为此分叉第二套行结构），
   * 真运行时恒由共享控制器供给。
   */
  readonly onOpenSkillDetail?: ((row: EnterpriseMarketSkillRow) => void) | undefined
  /**
   * 企业插件行最近一次安装/卸载失败（控制器把 store 已收下的 `pluginErrorCode` 归到刚发起动作的那一行）：
   * 命中 `packageName` 的行渲染 `role="alert"` 行内提示；缺席即无失败。
   * 有失败提示**不**禁用该行开关——用户要能原地重试。
   */
  readonly pluginActionError?: EnterpriseMarketActionError | undefined
  /**
   * 企业技能行最近一次安装/卸载失败（行键 = 技能包 id）：命中该行时渲染 `role="alert"` 行内提示。
   * 与插件行同口径：提示出现不影响开关可拨性（失败后仍可再拨一次重试）。
   */
  readonly skillActionError?: EnterpriseMarketActionError | undefined
  /**
   * 「组件」页签内部那份组件清单的折叠态（页签化后**只剩这一节还带折叠语义**，两套外壳同规则）。
   * 缺席视为展开（纯函数直调测试不传即得完整树）；真运行时由控制器的 `useState` 供给，初值 = `ENTERPRISE_MARKET_DEFAULT_EXPANDED`。
   */
  readonly expandedSections?: { readonly components: boolean } | undefined
  /** 折叠切换回调（点组件节节头按钮触发）；缺席时节头按钮禁用（不提供死按钮）。 */
  readonly onToggleSection?: ((section: EnterpriseMarketSectionId) => void) | undefined
  /**
   * 当前选中的页签。缺席按 `ENTERPRISE_MARKET_DEFAULT_TAB`（「企业技能」）。
   * 两套外壳共用这一个选择：页签条只有一份实现（`EnterpriseMarketTabStrip`），切到哪一套都同一套语义。
   */
  readonly activeTab?: EnterpriseMarketTabId | undefined
  /**
   * 页签切换回调。页签条**恒可交互**（roving `tabIndex` + ←/→/Home/End 走焦并选中）：选中态与键盘可达
   * 是 tablist 自身的语义，把当前页签做成禁用项会让人以为它坏了；缺席时点击是 no-op（只读页签条，真运行时恒由控制器供给）。
   */
  readonly onSelectTab?: ((tab: EnterpriseMarketTabId) => void) | undefined
  /**
   * **当前展开的那一行**（行键 = `enterpriseMarketRowKey(tab, 行 id)`；单选：同一时刻最多一行展开）。
   * `null` = 全部收起、`undefined` = 没给过状态（纯函数直调按「全开」拿完整树，与 `expandedSections` 同约定）。
   * **去折叠后两套外壳都不再消费它**：新外壳卡片改为动作常显，旧外壳的落点本来就是行内直出动作条。
   * 这份状态与下面的回调**按用户裁决先保留**在共享控制器里（不为了这次改动去动共享层）；行 facts 仍照它算 `open`。
   */
  readonly expandedRow?: string | null | undefined
  /** 行的开合回调（去折叠后两套外壳都不再调用；与上面的状态一起保留在共享层，缺席即 no-op）。 */
  readonly onToggleRow?: ((key: string) => void) | undefined
  /**
   * 搜索框里显示的**原始输入值**（按目录页签分槽，缺席 = 空串）。
   * 它必须直连受控 `input.value`：只用防抖后的 `searchQuery` 当 value 的话，每次按键后的重渲染
   * 都会把输入框重置回旧值（用户会觉得「打字被吞」）——防抖只影响**过滤**，不影响框里显示什么。
   * **旧外壳不渲染搜索框**，故它那一侧这个值真运行时恒为空串。
   */
  readonly searchValue?: Partial<Record<EnterpriseMarketDirectoryTabId, string>> | undefined
  /**
   * **防抖后**的搜索关键词，按目录页签分槽（`{ skills, plugins }`，缺席 = 空串 = 不过滤）。
   * 过滤口径只有一处（`enterpriseMarketShellModel`），两套外壳都吃同一份结果。
   */
  readonly searchQuery?: Partial<Record<EnterpriseMarketDirectoryTabId, string>> | undefined
  /** 搜索框的原始输入回调（`onSearchInput(tab, value)`）；防抖在控制器里，本层只往上抛。 */
  readonly onSearchInput?: ((tab: EnterpriseMarketDirectoryTabId, value: string) => void) | undefined
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
 * 唯一剩下可折叠的那一节（「组件」页签内部的组件清单）的初始展开态（共享控制器 `useEnterpriseMarketController` 的 `useState` 初值）。
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
 * 版式 = **官方插件清单卡片**（参考对象 jingyun 的卡片结构）：标题行（displayName + 版本签 + 分类签
 * + 状态点 + 一枚「已装/未装」标签）+ 始终可见的描述行（官方 12/18、两行 clamp）+ 卡片内**常显**的动作条
 * （[有更新时的辅助动作] [官方 Switch]，开关是主控件）与紧随其后的失败提示。
 * **卡片不折叠**：展开区与 chevron 已移除——展开区里原先只有对用户近乎无用的 `skillId` 和两个真正的动作，
 * 而动作藏进一次点击之后、列表又只有 3–5 行，折叠在这里没有意义（用户裁决）。故动作直接常显在卡片上。
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
   * 它就是「企业技能」行**标题行**紧跟标题那枚**版本签**的取值，**不需要任何服务端改动**。
   * 解码层已保证它是非空串，故行上恒带；万一为空则不出这枚签（`enterpriseMarketSkillVersionTag`）。
   */
  readonly sourceDshVersion: string
  /**
   * 服务端新增的**可选分类**（`category`，列表与详情投影都会有）。**为缺失设计**：解码层已把
   * 缺席 / null / 空串一律归一成「没有这个键」，故这里缺席 ＝ 没有分类 ＝ 标题行不出分类签
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
 * 「企业技能」行**标题行**版本签的可见文案。
 * 取值就是列表投影里已有的 `sourceDshVersion`（形如 `0.1.7-rc.3`），**不加 `v` 前缀**——`v{version}` 是
 * 本入口详情页 badge 的口径（`enterpriseMarketVersionTag`），行上的版本签照字段原值说，不造第二套字面。
 * @param sourceDshVersion - 行上的 `sourceDshVersion`。
 * @returns 标签文案；空串返回 undefined（不渲染空签，也不塞占位）。
 */
export function enterpriseMarketSkillVersionTag(sourceDshVersion: string): string | undefined {
  return sourceDshVersion === '' ? undefined : sourceDshVersion
}

/**
 * 「企业技能」行**标题行**分类签的可见文案。
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

/**
 * 技能行受管态 → 官方 `StateDot` 语义（它就是标题行那枚状态点的唯一映射点）：
 * 已装 `done` / 有更新 `warning`（要人注意，但还不是失败）/ 未装 `idle`（没有活动的事实）/ 在途 `ongoing`（旋转弧）。
 * 在途用 `ongoing` 是**我们补的短板**：官方与参考对象都只画静态点，我们让「安装中/卸载中」在标题行就能看出来。
 */
export function enterpriseMarketSkillDot(state: EnterpriseMarketSkillState): StateDotState {
  if (state === 'INSTALLED') return 'done'
  if (state === 'UPDATE_AVAILABLE') return 'warning'
  if (state === 'INSTALLING' || state === 'REMOVING') return 'ongoing'
  return 'idle'
}

/**
 * 状态点旁那行可见状态文案（官方 `StateDot` 是 `aria-hidden`，文档要求「与文字配对」）。
 * **安静态不出文字**：`AVAILABLE`/`INSTALLED` 的事实已由那枚「启用/已装」标签说清，再写一遍就是噪音；
 * 只有「有更新」与两个在途态（用户此刻最需要知道的）才补一行文字。
 * @param state - 行受管态。
 * @returns 文案；安静态返回 undefined（不渲染、也不塞占位）。
 */
export function enterpriseMarketSkillStatusLabel(state: EnterpriseMarketSkillState): string | undefined {
  if (state === 'UPDATE_AVAILABLE') return '有更新'
  if (state === 'INSTALLING') return '安装中'
  if (state === 'REMOVING') return '卸载中'
  return undefined
}

/**
 * 标题行那枚「启用/已装」标签的渲染投影（照参考对象的 `configTag data-enabled`，视觉改用官方 `Tag` 原语）。
 * 它是**只读事实**：`enabled` 同时给 `data-enterprise-row-enabled` 与 `Switch.checked` 用，避免两处各判一次。
 */
export interface EnterpriseMarketConfigTag {
  /** 事实：该行是否已落盘/已启用（技能=已装，插件=ACTIVE）。 */
  readonly enabled: boolean
  /** 可见文案。 */
  readonly label: string
  /** 官方 `Tag` 的调色（已启用 `success`，否则 `neutral`）——不自定义颜色。 */
  readonly tone: 'success' | 'neutral'
}

/** 技能行的「已装/未装」标签：在途（安装中）与卸载在途分别落到 未装/已装，与 `Switch.checked` 同源。 */
export function enterpriseMarketSkillConfigTag(state: EnterpriseMarketSkillState): EnterpriseMarketConfigTag {
  const enabled = state === 'INSTALLED' || state === 'UPDATE_AVAILABLE' || state === 'REMOVING'
  return { enabled, label: enabled ? '已装' : '未装', tone: enabled ? 'success' : 'neutral' }
}

/** 企业插件行的「已启用/未启用」标签：只有本机 `ACTIVE` 才算已启用（在途/等待重启/失败都不是）。 */
export function enterpriseMarketPluginConfigTag(state: ManagedPluginState): EnterpriseMarketConfigTag {
  const enabled = state === 'ACTIVE'
  return { enabled, label: enabled ? '已启用' : '未启用', tone: enabled ? 'success' : 'neutral' }
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

/**
 * 企业插件行状态点旁那行可见状态文案（插件侧口径与技能侧同：安静态不出文字）。
 * 文案仍取自本仓唯一那份官方状态词表 `enterprisePluginStatePresentation`（不新造第二套说法）：
 * `ACTIVE`（已启用标签已说清）与 `EXPECTED`（未启用标签已说清）不出文字，其余（在途/等待重启/失败）如实出。
 * @param state - 本机受管态。
 * @returns 文案；两个安静态返回 undefined。
 */
export function enterpriseMarketPluginStatusLabel(state: ManagedPluginState): string | undefined {
  return state === 'ACTIVE' || state === 'EXPECTED' ? undefined : enterprisePluginStatePresentation(state).title
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
/**
 * 组件清单行的渲染投影（组件节三行 + 每行的启用/状态/状态点/开关禁用）。
 * 两套外壳共用同一个投影结果，故「仅配方 reserved」「未登录则需登录」这两条口径在两处不可能分叉。
 */
export interface EnterpriseMarketComponentRow {
  readonly id: string
  readonly label: string
  readonly module: string
  readonly note: string
  readonly reserved: boolean
  readonly enabled: boolean
  readonly state: '预留' | '可用' | '需登录'
  readonly dot: StateDotState
  readonly switchDisabled: boolean
}

/** 一个页签的渲染真源：id + 基础词 + 计数 + 最终文案（文案 = `enterpriseMarketTabLabel(label, count)`）。 */
export interface EnterpriseMarketTabEntry {
  readonly id: EnterpriseMarketTabId
  readonly label: string
  readonly count: number
  readonly text: string
}

/**
 * 两套外壳**共用的同一份模型**：props → 外壳需要的一切派生事实（组件行、目录门控、页签文案与计数、过滤后的可见行、折叠态）。
 * 它是「逻辑只保留一份」的**可测证明点**：两套外壳都只调它，因此「页签计数不一致 / 门控不一致 / 过滤口径不一致」
 * 不需要靠人工对齐——结构上只有这一处可改（纯函数、无 hook、无状态，测试可对同一组输入逐字段比对）。
 */
export interface EnterpriseMarketShellModel {
  /** 当前选中的页签（`props.activeTab` 缺席即 `ENTERPRISE_MARKET_DEFAULT_TAB`）。 */
  readonly activeTab: EnterpriseMarketTabId
  /** 会话可用性（`props.sessionUsable` 缺席即 false）。 */
  readonly sessionUsable: boolean
  /** 组件清单三行（含状态点与开关禁用口径）。 */
  readonly componentRows: readonly EnterpriseMarketComponentRow[]
  /** 「组件」页签是否展开（唯一还带折叠语义的一节）。 */
  readonly componentsOpen: boolean
  /** 折叠回调是否接通（缺席时不给死按钮）。 */
  readonly canToggleSection: boolean
  /** 组件节计数摘要（共 N 个 · N 可用 · N 预留）。 */
  readonly componentSummaryText: string
  /** 三个页签的文案与计数。 */
  readonly tabEntries: readonly EnterpriseMarketTabEntry[]
  /** 页签计数按 id 查（与 `tabEntries[].count` 同源，HERO 的两枚 chip 也取它）。 */
  readonly tabCounts: Record<EnterpriseMarketTabId, number>
  /** 「企业技能」页签门控通过（技能组件开启**且**目录非空）。 */
  readonly skillsVisible: boolean
  /** 「企业插件」页签门控通过（插件组件开启**且**目录非空）。 */
  readonly pluginsVisible: boolean
  /** 实际渲染的技能行（空关键词 = 目录原样；旧外壳不渲染搜索框，真运行时关键词恒为空）。 */
  readonly visibleSkills: readonly EnterpriseMarketSkillRow[]
  /** 实际渲染的插件行（同上）。 */
  readonly visiblePlugins: readonly EnterpriseMarketPluginRow[]
}

/**
 * 两套外壳的唯一逻辑入口（纯函数）。装配顺序：组件行 → 目录门控 → 搜索过滤 → 页签计数。
 * @param props - 两套外壳共用的 `EnterpriseMarketShellProps`。
 * @returns 外壳渲染需要的全部派生事实。
 */
export function enterpriseMarketShellModel(props: EnterpriseMarketShellProps): EnterpriseMarketShellModel {
  const sessionUsable = props.sessionUsable ?? false
  const hasLoginAction = typeof props.onOpenLogin === 'function'
  const enterprisePlugins = props.enterprisePlugins ?? []
  const enterpriseSkills = props.enterpriseSkills ?? []
  const componentRows: EnterpriseMarketComponentRow[] = ENTERPRISE_MARKET_COMPONENTS.map(row => ({
    ...row,
    enabled: enterpriseMarketComponentEnabled(row.id, sessionUsable),
    state: enterpriseMarketComponentState(row.id, sessionUsable),
    dot: enterpriseMarketComponentDot(row.id, sessionUsable),
    switchDisabled: enterpriseMarketComponentSwitchDisabled(row.id, sessionUsable, hasLoginAction),
  }))
  // 两个目录页签的门控同规则：只在对应大组件开启（= 会话可用）且目录非空时出内容。
  const skillsVisible = enterpriseMarketSkillSectionVisible(enterpriseMarketComponentEnabled('skills', sessionUsable), enterpriseSkills)
  const pluginsVisible = enterpriseMarketPluginSectionVisible(enterpriseMarketComponentEnabled('plugins', sessionUsable), enterprisePlugins)
  // 搜索过滤（**纯客户端**，不发请求、不新增路由）：关键词缺席/空串时原样返回全部行，目录顺序不动。
  const visibleSkills = enterpriseMarketSearchSkillRows(enterpriseSkills, props.searchQuery?.skills ?? '')
  const visiblePlugins = enterpriseMarketSearchPluginRows(enterprisePlugins, props.searchQuery?.plugins ?? '')
  // 页签计数取该页签**真正要渲染的行数**：目录门控不过即如实记 0，绝不在面板空白时还喊「有 N 条」。
  const tabCounts: Record<EnterpriseMarketTabId, number> = {
    skills: skillsVisible ? enterpriseSkills.length : 0,
    plugins: pluginsVisible ? enterprisePlugins.length : 0,
    components: ENTERPRISE_MARKET_COMPONENTS.length,
  }
  return {
    activeTab: props.activeTab ?? ENTERPRISE_MARKET_DEFAULT_TAB,
    sessionUsable,
    componentRows,
    componentsOpen: enterpriseMarketSectionOpen(props.expandedSections, 'components', true),
    canToggleSection: typeof props.onToggleSection === 'function',
    componentSummaryText: enterpriseMarketComponentSummaryText(componentRows, sessionUsable),
    tabEntries: ENTERPRISE_MARKET_TABS.map(tab => ({
      id: tab.id,
      label: tab.label,
      count: tabCounts[tab.id],
      text: enterpriseMarketTabLabel(tab.label, tabCounts[tab.id]),
    })),
    tabCounts,
    skillsVisible,
    pluginsVisible,
    visibleSkills,
    visiblePlugins,
  }
}

/**
 * 技能行的**同一份**派生事实（两套外壳共用；行版式不同但事实完全相同）。
 * 「受管态 → 开关 checked」「受管态 → 在途禁用」「有更新」三条都只在这里算一次：
 * 旧外壳的官方两行卡片与新外壳的可展开卡片都读它，故两边不可能各判一套。
 */
export interface EnterpriseMarketSkillRowFacts {
  /** 行键（`{页签}:{行 id}`）。**去折叠后两套外壳都不再消费它**，作为共享层（控制器 `expandedRow` + 行键投影）的一份保留事实。 */
  readonly rowKey: string
  /** 展开区容器 id（行 id 已归一成安全字符）。**去折叠后没有展开区**，同为共享层的保留事实（纯投影仍可用）。 */
  readonly detailsId: string
  /** 该行此刻是否展开（`expandedRow` 缺席视为全开）。**去折叠后两套外壳都不再消费它**，保留给共享层。 */
  readonly open: boolean
  /** 受管态（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）。 */
  readonly state: EnterpriseMarketSkillState
  /** 「已装/未装」标签投影（新外壳的 Tag 用它，文案与 tone 都从这一份来）。 */
  readonly config: EnterpriseMarketConfigTag
  /** 开关与「已装/未装」标签同源的事实：`config.enabled`。 */
  readonly enabled: boolean
  /** 官方 `StateDot` 语义（新外壳的行尾状态点用它：已装 done / 有更新 warning / 未装 idle / 在途 ongoing）。 */
  readonly dot: StateDotState
  /** 在途（安装中/卸载中）：开关与辅助动作都禁用，但辅助动作**不消失**。 */
  readonly busy: boolean
  /** 是否「有更新」（两侧 `versionId` 都拿得到且不等）。 */
  readonly hasUpdate: boolean
  /** 辅助动作的文案投影（文案/无障碍名/悬浮说明）。 */
  readonly updateTag: EnterpriseMarketSkillUpdateTag
  /** 标题行版本签的可见文案（`sourceDshVersion` 原值；空串即 undefined = 不渲染）。 */
  readonly versionTag: string | undefined
  /** 标题行分类签的可见文案（缺席/null/空串即 undefined = 整枚不渲染）。 */
  readonly categoryTag: string | undefined
}

/**
 * 技能行 facts 的唯一入口。
 * @param props - 共享 props（要 `installedSkills`/`pendingSkill`/`expandedRow`）。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 该行在两套外壳里共用的事实。
 */
export function enterpriseMarketSkillRowFacts(props: EnterpriseMarketShellProps, row: EnterpriseMarketSkillRow): EnterpriseMarketSkillRowFacts {
  const state = enterpriseMarketSkillState(props.installedSkills, props.pendingSkill, row)
  const rowKey = enterpriseMarketRowKey('skills', row.id)
  return {
    rowKey,
    detailsId: enterpriseMarketRowDetailsId('skills', row.id),
    open: enterpriseMarketRowOpen(props.expandedRow, rowKey),
    state,
    // 开关的 checked 与「已装/未装」标签**同源**：只有一个判定点（`enterpriseMarketSkillConfigTag`）。
    config: enterpriseMarketSkillConfigTag(state),
    enabled: enterpriseMarketSkillConfigTag(state).enabled,
    dot: enterpriseMarketSkillDot(state),
    busy: state === 'INSTALLING' || state === 'REMOVING',
    hasUpdate: enterpriseMarketSkillRowHasUpdate(props.installedSkills, row),
    updateTag: enterpriseMarketSkillUpdateTag(row.displayName),
    versionTag: enterpriseMarketSkillVersionTag(row.sourceDshVersion),
    categoryTag: enterpriseMarketSkillCategoryTag(row.category),
  }
}

/**
 * 企业插件行的**同一份**派生事实（两套外壳共用）。
 * 「开关 checked / 开关禁用 / 状态点 / 状态文案」四条都只在这里算一次：旧外壳的「状态点 + 官方状态词恒出」
 * 与新外壳的「状态点 + 一枚 Tag + 安静态不出文字」读的是同一批事实，只对**呈现**做各自的选择。
 */
export interface EnterpriseMarketPluginRowFacts {
  readonly rowKey: string
  readonly detailsId: string
  readonly open: boolean
  /** 开关与「已启用/未启用」标签同源的事实：`enterpriseMarketPluginConfigTag(state).enabled`（只有本机 ACTIVE）。 */
  readonly enabled: boolean
  /** 官方 `StateDot` 语义（已装 done / 失败 error / 在途 ongoing / 等待 warning / 其余 idle）。 */
  readonly dot: StateDotState
  /** 「已启用/未启用」标签投影（新外壳的 Tag 用它）。 */
  readonly config: EnterpriseMarketConfigTag
  /** 需要人留意时的可见状态文案（安静态 undefined；新外壳用）。 */
  readonly statusLabel: string | undefined
  /** 官方状态词表的原值（旧外壳的落点：状态点旁**恒**出一行文案，安静态也说）。 */
  readonly stateTitle: string
  /** 开关是否禁用（无回调 / 目录不可装 / 在途 / 回滚中）。 */
  readonly switchDisabled: boolean
}

/**
 * 插件行 facts 的唯一入口。
 * @param props - 共享 props（要 `onTogglePlugin`/`expandedRow`）。
 * @param row - 目录 + 本机态归并后的插件行。
 * @returns 该行在两套外壳里共用的事实。
 */
export function enterpriseMarketPluginRowFacts(props: EnterpriseMarketShellProps, row: EnterpriseMarketPluginRow): EnterpriseMarketPluginRowFacts {
  const rowKey = enterpriseMarketRowKey('plugins', row.packageName)
  const config = enterpriseMarketPluginConfigTag(row.state)
  return {
    rowKey,
    detailsId: enterpriseMarketRowDetailsId('plugins', row.packageName),
    open: enterpriseMarketRowOpen(props.expandedRow, rowKey),
    enabled: config.enabled,
    dot: enterprisePluginDot(row.state),
    config,
    statusLabel: enterpriseMarketPluginStatusLabel(row.state),
    stateTitle: enterprisePluginStatePresentation(row.state).title,
    switchDisabled: props.onTogglePlugin === undefined || row.installErrorCode !== undefined
      || row.state === 'INSTALLING' || row.state === 'DOWNLOADING' || row.state === 'REMOVING' || row.state === 'ROLLBACK',
  }
}

/** 新外壳 HERO 的标题（只有新外壳有 HERO；旧外壳一个字都不加）。 */
export const ENTERPRISE_STORE_HERO_TITLE = '应用商店'

/**
 * 新外壳 HERO 的副文案：一句话说清「这是企业内部分发」。
 * 全文不含任何价格/交易/购买/购物车/客服之类的商业化字样（由测试反向锁死）。
 */
export const ENTERPRISE_STORE_HERO_NOTE = '企业内部分发：这里的插件与技能都由企业中心统一发布，安装后落盘到本机。'

/**
 * HERO 第一枚计数 chip 的文案。数字取**真实行数**——与「企业技能」页签计数同源（`tabCounts.skills`），
 * 门控不过时如实说 0，绝不另算一套。
 * @param count - 企业技能目录的真实行数。
 */
export function enterpriseMarketHeroSkillChip(count: number): string {
  return `共 ${count} 个企业技能`
}

/**
 * HERO 第二枚计数 chip 的文案。数字取 `tabCounts.plugins`（与「企业插件」页签计数同源）。
 * @param count - 企业插件目录的真实行数。
 */
export function enterpriseMarketHeroPluginChip(count: number): string {
  return `${count} 个企业插件`
}

/**
 * 两套外壳**共用**的样式：节容器、组件节（`.own-market-rows`/`.own-market-row*`）、行内失败提示、页签条与面板、
 * 标题行那两枚签（`.own-market-cardHead`/`.own-market-skillTitle`/`.own-market-tag`）、技能行那颗「有更新」药丸。
 * 这些规则在旧新两套外观里逐值相同，故只保留一份——旧外壳不必抄第二份，也就不会在后续改动里悄悄跟新外壳分叉。
 * 类名一律避开 `plugin-market.tsx` 已占用的同前缀名字（`.own-market-card`/`.own-market-tabs`/`.own-market-search` 等），
 * 因为两处都注入全局单类选择器的 `<style>`，同名会互相覆盖（本仓已踩过，7557ffd 已改名）。
 */
const baseStyles = `
.own-market-entry{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-market-entry *{box-sizing:border-box}
.own-market-entry-summary{color:var(--dsw-alias-label-secondary,#667085)}
/* 包名在 badge 槽内换行成标题下独立一行（照官方 .detailName：mono 12/18 tertiary）。
   flex-basis:100% 借官方 titleRow 的 flex-wrap:wrap 让它独占一行，落在标题下、描述上。 */
.own-market-badge-name{flex-basis:100%;min-width:0;margin-top:4px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#98a2b3);overflow-wrap:anywhere}
.own-market-tag{flex:none;font-variant-numeric:tabular-nums}
/* 节容器：顶部间距从官方 RowsSection 口径的 24 收到 12（详情页顶部压缩），节内 gap 仍是 12。 */
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
/* 标题 + 两枚签：**单行 nowrap flex**，行高锁 20px（官方 Tag 固定 19px 高 < 20px，故加签不改变这一行的高度）。
   标签过多时**标题先让步**：标题 flex:0 1 auto + min-width:0 先省略，两枚签 .own-market-tag 的 flex:none 保持可见；
   head 自身 overflow:hidden 兜底，绝不换行、绝不撑高。两套外壳的标题行都用这一份取值。 */
.own-market-cardHead{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;line-height:20px;overflow:hidden}
.own-market-skillTitle{flex:0 1 auto;min-width:0}
.own-market-rowState{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:18px;white-space:nowrap}
.own-market-row[data-state='off'] .own-market-rowState{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowStateFailed{color:var(--dsw-alias-state-error-primary,#c4320a)}
/* 技能行右侧那枚「有更新」辅助动作（两套外壳同一取值）：无边框圆角淡底（标签观感，不是第二枚开关）、
   键盘可达 + focus-ring、禁用态降透明——它是开关左侧的快捷路，不抢主控件的位置。 */
.own-market-skillTag{flex:none;border:0;border-radius:999px;padding:1px 10px;background:var(--dsw-alias-background-secondary,#f2f4f7);font-size:12.5px;line-height:18px;color:var(--dsw-alias-accent-primary,#2563eb);font-variant-numeric:tabular-nums;cursor:pointer}
.own-market-skillTag:hover:not(:disabled){background:var(--dsw-alias-border-l2,#e4e7ec);color:var(--dsw-alias-label-primary,#101828)}
.own-market-skillTag:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-skillTag:disabled{cursor:default;opacity:.6}
/* page 视图顶部的页签条（手写，不用官方 SegmentedTabs——工程 pin 的 primitives 0.1.5-rc.2 不含它）：
   口径逐值照 9723a97 的 tablist（底部 1px 分隔线 + 选中项 2px 下划线 + 13/20），**两套外壳共用同一份渲染**。
   类名从旧名 .own-market-tabs 改成 .own-market-storeTabs：旧名与 plugin-market.tsx 同名会互相覆盖（7557ffd 已改名）。
   flex-wrap:nowrap + 页签 white-space:nowrap 保证「文案带计数」后页签**不换行、不撑高**这一行。 */
.own-market-storeTabs{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:22px;min-width:0;margin-top:0;border-bottom:1px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-market-storeTab{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary,#667085);cursor:pointer;font:inherit;font-size:13px;line-height:20px;margin-bottom:-1px;padding:7px 1px 8px;white-space:nowrap}
.own-market-storeTab:hover{color:var(--dsw-alias-label-primary,#101828)}
.own-market-storeTab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-storeTab[aria-selected='true']{border-bottom-color:var(--dsw-alias-label-primary,#101828);color:var(--dsw-alias-label-primary,#101828);font-weight:500}
/* 面板：非当前页签只留一个 hidden 空壳（内容整段不挂载），显式补一条 [hidden] 规则，
   免得将来给 .own-market-panel 加上 display 类选择器后覆盖 UA 的 [hidden]{display:none}（本仓已踩过）。 */
.own-market-panel{min-width:0}
.own-market-panel[hidden]{display:none}
/* 页签化后的节：企业技能 / 企业插件两节已无折叠也**无独立计数行**（计数并入页签文案，
   故 .own-market-sectionMeta 规则随之一并删除——不留死样式）；只有组件节的节头按钮
   （.own-market-groupToggle）还带折叠，它的计数仍用 .own-market-sectionCount 与标题同排。 */
/* 行内失败提示（企业插件行/企业技能行共用，两套外壳同值）：取值照「技能」tab 的 .own-skill-inlineError
   （error 色 + 12/19 + 左对齐 + 无内衬）。那份 CSS 归 skill-market 的 <style> 持有、切到本页时并不在 DOM，
   故这里补一份同值规则，不借道未挂载的样式表。 */
.own-market-inlineError{padding:0;text-align:left;font-size:12px;line-height:19px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
`

/**
 * **两套外壳共用的行取值**（`baseStyles` 之外的那两条行内文案规则）：`.own-market-cardId`（标题 14/20-500-省略）
 * 与 `.own-market-cardDesc`（描述 13/18-tertiary-**单行**省略），逐值取自 `9723a97`。
 * 改动前它是「旧外壳独有」、新外壳另起一套卡片类名；版式统一后两套外壳的行由**同一枚子块**
 * `EnterpriseMarketInlineRows` 渲染，行取值也就只有这一份——两边一起改、一起坏，不会再分叉。
 * 渲染顺序：旧外壳 = `baseStyles` + 这份行取值（与改动前逐字节相同），新外壳 = `baseStyles` + 这份行取值 + `storeStyles`。
 */
const rowStyles = `
.own-market-cardId{font-size:14px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.own-market-row[data-state='off'] .own-market-cardId{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-cardDesc{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:13px;line-height:18px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
/* 技能行**行本体**（图标 + 标题 + 描述那一片）是一枚真 button 元素：整片可点、原生键盘可达（Enter/Space）、
   有 focus 环与 hover 提示（光标 + 标题/描述转主色调）。取值照本文件既有口径：行图标与文案之间仍是 16px
   （= .own-market-rowLine 的 gap），因此包上这枚按钮**不改变行的几何**。
   **动作不会被藏起来、也不会被这枚按钮吞掉**：[有更新] 与官方 Switch 是它在 .own-market-rowLine 里的
   **兄弟节点而不是后代**——点它们根本不会冒泡进详情（不是靠 stopPropagation 拦，而是结构上就不在可点区域内），
   .own-market-rowLine/li 自身没有任何 onClick。 */
.own-market-rowOpen{display:flex;flex:1;align-items:center;gap:16px;min-width:0;border:0;padding:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;border-radius:8px}
.own-market-rowOpen:hover .own-market-cardId,.own-market-rowOpen:hover .own-market-cardDesc{color:var(--dsw-alias-accent-primary,#2563eb)}
.own-market-rowOpen:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
`

/**
 * **新外壳**（侧栏「应用商店」主内容区面板）独有的样式：HERO 横幅 + 官方插件清单卡片网格 + 列表上方搜索框。
 * 结构参考 `jingyunstudio/jingyun-dsh` 的 `MarketplaceSection.tsx`（卡片 + 列表上方搜索框），
 * **排版取值一律照官方** `qSYn7G_*`（卡片 `.5px` + radius-xl(20px) + settings-card-stroke/fill、标题 14/20-500、
 * 描述 12/18 + 两行 clamp 且始终可见、列表两列 + gap 10）。
 * **去折叠后不再有展开区**：官方 `.cardDetails` 那套「.5px 发丝线 + 平台底 + 10/14/12 内衬」的规则与卡片
 * `[data-open]` 展开态描边/chevron 旋转、`skillId` 行（`.entryValue`）一并删除——动作改由卡片内常显的
 * `.own-market-cardActions` 承载（靠右 + 可换行，窄屏不挤爆）。
 */
const storeStyles = `
/* ── 容器内边距（**只有新外壳有**）：侧栏「应用商店」是我们自己注册的 main 面板，官方**不会**给它加外层
   内边距——不给这一层，HERO / 页签条 / 搜索框 / 通栏行就整页贴着屏幕左右边缘（用户截图反馈「四周缺少间距」）。
   对照：旧外壳（plugins.item 详情页）外面有官方 DetailTop 自带的内边距，**一行都不能加**，否则旧外观变挤。
   取值与本文件既有官方口径对齐：左右 14px = 行图标框与 HERO 的横向内衬口径；顶部 14px 同一口径（HERO 不贴
   内容区上沿）；底部 20px 略大于顶部（= HERO 的 radius-xl 圆角量级），给列表最后一行收尾留白。
   box-sizing:border-box 与 .own-market-entry * 的既有口径一致：块级 width:auto 下内边距本就落在容器内部、
   不撑出横向滚动，这里再显式声明一次（改动前那条「窄屏单列」逻辑已随卡片网格一起退场）。 */
.own-market-entry.own-market-storePage{padding:14px 14px 20px;box-sizing:border-box}
/* ── HERO（**只有新外壳有**）：渐变底横幅 → 标题「应用商店」→ 两枚计数 chip → 一句副文案 ──────────
   渐变用两枚**既有**背景色 token 拼（本仓主题里没有渐变 token，故不新造颜色）：
   --dsw-alias-state-business-tertiary（官方自己就拿它当底色的淡蓝面）→ --dsw-alias-bg-layer-2（中性卡片面），
   深浅主题各自成立。圆角/内衬/字号照本文件既有官方取值：.5px + settings-card-stroke + radius-xl（= HERO 口径）、
   内衬 14px、标题 14/20-500、chip 12/18 药丸（= .own-market-skillTag 那套 999px + 1px 10px）、副文案 12/18。 */
.own-market-storeHero{display:flex;flex-direction:column;gap:8px;padding:14px;margin-bottom:12px;border:.5px solid var(--dsw-alias-settings-card-stroke,#d0d5dd);border-radius:var(--dsw-radius-xl,20px);background:linear-gradient(135deg,var(--dsw-alias-state-business-tertiary,#e4edfd),var(--dsw-alias-bg-layer-2,#fff))}
.own-market-storeHeroTitle{margin:0;font-size:14px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828)}
.own-market-storeHeroChips{display:flex;flex-wrap:wrap;gap:8px}
.own-market-storeHeroChip{display:inline-flex;align-items:center;border-radius:999px;padding:1px 10px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.own-market-storeHeroNote{margin:0;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px}
/* ── 目录区（搜索框 + 通栏行列表）────────────────────────────────────────────────────────────
   这一层只剩「列表上方那枚搜索框」与它的空态文案：**行版式不在这一层**——两套外壳的目录行由共享子块
   EnterpriseMarketInlineRows 渲染成 .own-market-rows/.own-market-row* 通栏行（取值在 rowStyles/baseStyles
   里，与官方插件页「插件市场」逐值同一份）。改动前那套官方插件清单**卡片**（.own-market-cardGrid 两列网格
   + 配套的容器查询与 520 断点单列兜底、.own-market-cardShell 外壳、
   .own-market-cardContent/.own-market-cardMainRow/.own-market-cardTitle/.own-market-cardDescription/
   .own-market-cardTrailing/.own-market-phaseDot/.own-market-configTag/.own-market-cardActions/
   .own-market-rowStatus）已随统一**整组删除**：它们不再被任何地方使用（组件节与旧外壳本来就不用，
   新外壳改用通栏行），留着只会是死样式。容器查询上下文一并退场——通栏行按容器宽度自适应，
   不再需要 520 断点。 */
.own-market-catalog{display:flex;flex-direction:column;gap:12px;min-width:0}
/* 搜索框 = 官方 .search：列表上方、label 相对定位、放大镜绝对左 12px（pointer-events:none 不挡输入）。 */
.own-market-catalogSearch{position:relative;display:flex;align-items:center;width:100%;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-catalogSearch>svg{position:absolute;left:12px;pointer-events:none}
/* 输入框逐值照官方 .search input：.5px 描边 + radius-md + bg-layer-1 + 36px 高 + 0/34/0/36 内衬 + 13px 字。 */
.own-market-catalogSearchInput{width:100%;height:36px;border:.5px solid var(--dsw-alias-border-l4,#d0d5dd);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:13px;outline:none;padding:0 34px 0 36px}
.own-market-catalogSearchInput::placeholder{color:var(--dsw-alias-label-tertiary,#98a2b3)}
/* 焦点态照官方：描边换 focus-ring 色 + 2px 18% 同色光晕（不是另画一套 outline）。 */
.own-market-catalogSearchInput:focus-visible{border-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#2563eb));box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#2563eb)) 18%, transparent)}
.own-market-catalogSearchEmpty{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:13px;line-height:20px;margin:0;padding:2px 0}
`

/**
 * **技能详情弹层**独有的样式（两套外壳共用这一份：弹层不属于任何一套外观，由共享宿主同树渲染）。
 *
 * 承载形式是官方 `Modal`（Esc 关闭 / 点遮罩关闭 / 焦点圈定与归还都由它给，本文件不另画遮罩），
 * 这里只定义弹层内部的取值，全部沿用本文件既有官方口径——13/20 正文、12/19 说明、14/20-500 小标题、
 * mono 11.5/16、药丸 999px + 1px 10px、`.5px` 发丝线 + radius-md，**不新造一套视觉**。
 * 错误提示不在这里另起一份：弹层复用 `baseStyles` 里的 `.own-market-inlineError`（与行上同一条规则、
 * 同一句话「安装失败/卸载失败 + 稳定错误码」），因为承载它的外壳 `<style>` 恒与弹层同树挂载。
 */
const detailStyles = `
.own-market-detail{display:flex;flex-direction:column;gap:10px;min-width:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#101828)}
.own-market-detailDesc{margin:0;color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:19px;overflow-wrap:anywhere}
.own-market-detailFacts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:0;min-width:0}
.own-market-detailFacts dt{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:19px;white-space:nowrap}
.own-market-detailFacts dd{margin:0;min-width:0;font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-market-detailValue{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.own-market-detailBody{display:flex;flex-direction:column;gap:6px;min-width:0;padding-top:10px;border-top:0.5px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-market-detailBodyHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.own-market-detailBodyTitle{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828)}
.own-market-detailBodyName{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary,#667085);overflow-wrap:anywhere}
.own-market-detailPre{margin:0;max-height:280px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;border:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-background-secondary,#f2f4f7);font:11.5px/17px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-primary,#101828)}
.own-market-detailHint{margin:0;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:19px}
.own-market-detailActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:2px}
.own-market-detailActions .own-market-detailSpacer{flex:1}
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
 * 卡片一句话（`summary` 视图）：官方会把它渲染两次，故必须保持单行——两套外壳共用这一份实现。
 */
function EnterpriseMarketSummaryLine(): ReactNode {
  return <span className="own-market-entry-summary">{ENTERPRISE_MARKET_SUMMARY}</span>
}

/**
 * 页签条（**两套外壳共用同一份渲染**）：手写 `role="tablist"` + roving `tabIndex` + ←/→/Home/End 走焦并选中。
 * 视觉取值逐值来自 `9723a97` 的 `.own-market-tabs`/`.own-market-tab`（13/20、选中态 2px 下划线、hover/focus 环），
 * 类名改用 `.own-market-storeTabs`/`.own-market-storeTab`——旧名与 `plugin-market.tsx` 同名，两份全局单类
 * `<style>` 会互相覆盖（7557ffd 已因此改名），旧外壳不许退回旧名。
 * 纯函数体**不能持 `ref`**（调 `useRef` 就变成 hook 组件、直调测试即崩），故键盘走焦在 keydown 里从事件源向上
 * 找 `[role="tablist"]`、按同序取第 `index` 个 `[role="tab"]` 调 `focus()`：只在真浏览器事件里执行。
 */
function EnterpriseMarketTabStrip({ model, onSelectTab }: {
  readonly model: EnterpriseMarketShellModel
  readonly onSelectTab: ((tab: EnterpriseMarketTabId) => void) | undefined
}): ReactNode {
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
    <div role="tablist" aria-label={ENTERPRISE_MARKET_TABLIST_LABEL} className="own-market-storeTabs">
      {model.tabEntries.map((tab, index) => {
        const selected = tab.id === model.activeTab
        return (
          <button
            key={tab.id}
            id={ENTERPRISE_MARKET_TAB_IDS[tab.id].tab}
            type="button"
            role="tab"
            className="own-market-storeTab"
            aria-selected={selected}
            aria-controls={ENTERPRISE_MARKET_TAB_IDS[tab.id].panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => { onSelectTab?.(tab.id) }}
            onKeyDown={(event) => { onTabKeyDown(event, index) }}
          >{tab.text}</button>
        )
      })}
    </div>
  )
}

/**
 * 一个页签的面板外壳（**两套外壳共用**）：`id` / `aria-controls` / `aria-labelledby` 三处同源，
 * 非当前页签只留一个 `hidden` 空壳——既让 `aria-controls` 恒能解析，又保证**内容整段不挂载**
 * （页签已经承担「显隐」，不必为隐藏的页签再渲染一次）。两套外壳都走它，aria 配对不可能在某一套里漂移。
 */
function EnterpriseMarketPanel({ tab, activeTab, children }: {
  readonly tab: EnterpriseMarketTabId
  readonly activeTab: EnterpriseMarketTabId
  readonly children: ReactNode
}): ReactNode {
  return (
    <div
      id={ENTERPRISE_MARKET_TAB_IDS[tab].panel}
      role="tabpanel"
      aria-labelledby={ENTERPRISE_MARKET_TAB_IDS[tab].tab}
      hidden={activeTab !== tab}
      className="own-market-panel"
    >
      {children}
    </div>
  )
}

/**
 * 行内失败提示（**两套外壳共用同一份渲染与文案投影**）：只有行键命中时才出现，`role="alert"` 交给读屏立刻播报，
 * 稳定错误码放在 `code` 里。照「技能」tab 的行内提示口径（`安装失败`/`卸载失败` + `<code>{code}</code>`），
 * 且**不**参与该行开关的 `disabled` 计算——失败恰恰是最需要能再拨一次的场景。
 */
export function EnterpriseMarketRowError({ error, id }: {
  readonly error: EnterpriseMarketActionError | undefined
  readonly id: string
}): ReactNode {
  if (error?.id !== id) return null
  return <div className="own-market-inlineError" role="alert">{enterpriseMarketActionErrorLabel(error)} <code>{error.code}</code></div>
}

/**
 * 「组件」页签的内容（**两套外壳共用**）：这是页签化后**唯一还带折叠语义**的一节。
 * 节头照官方 groupToggle button（chevron + 标题 + 计数同排，`aria-expanded`/`aria-controls`），
 * 折叠态列表整段条件渲染不进 DOM（照官方 groupBody 的 `{open ? <div> : null}`——`.own-market-rows{display:flex}`
 * 类选择器会覆盖 UA 的 `[hidden]{display:none}`，用 hidden 属性列表不会消失，本仓实测已抓出）。
 */
function EnterpriseMarketComponentsPanel({ model, onToggleSection, onOpenLogin }: {
  readonly model: EnterpriseMarketShellModel
  readonly onToggleSection: ((section: EnterpriseMarketSectionId) => void) | undefined
  readonly onOpenLogin: (() => void) | undefined
}): ReactNode {
  return (
    <section className="own-market-section">
      <div className="own-market-sectionHead">
        <button
          type="button"
          className="own-market-groupToggle"
          aria-expanded={model.componentsOpen}
          aria-controls={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.components}`}
          disabled={!model.canToggleSection}
          title={model.canToggleSection ? undefined : '折叠动作未接通'}
          onClick={() => { onToggleSection?.('components') }}
        >
          <ChevronDown className="own-market-chevron" size={12} aria-hidden="true" />
          <span className="own-market-groupTitle">包含的组件</span>
        </button>
        <span className="own-market-sectionCount">{model.componentSummaryText}</span>
      </div>
      {model.componentsOpen ? (
        <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.components}`}>
          {model.componentRows.map(row => (
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
  )
}

/**
 * 新外壳顶部的 HERO 横幅（**只有新外壳有**；旧外壳一个字都不加）。
 * 结构：渐变底横幅 → 标题「应用商店」→ 两枚计数 chip → 一句副文案。
 * 两枚 chip 的数字取**真实行数**——就是 `model.tabCounts.skills`/`model.tabCounts.plugins`（与页签计数同源，
 * 门控不过即如实说 0），不另算一套。
 * 渐变底见 `storeStyles` 的 `.own-market-storeHero`：两枚既有背景色 token
 * `--dsw-alias-state-business-tertiary` → `--dsw-alias-bg-layer-2`。
 */
export function EnterpriseMarketHero({ skills, plugins }: {
  readonly skills: number
  readonly plugins: number
}): ReactNode {
  return (
    <div className="own-market-storeHero">
      <h2 className="own-market-storeHeroTitle">{ENTERPRISE_STORE_HERO_TITLE}</h2>
      <div className="own-market-storeHeroChips">
        <span className="own-market-storeHeroChip" data-enterprise-hero-chip="skills">{enterpriseMarketHeroSkillChip(skills)}</span>
        <span className="own-market-storeHeroChip" data-enterprise-hero-chip="plugins">{enterpriseMarketHeroPluginChip(plugins)}</span>
      </div>
      <p className="own-market-storeHeroNote">{ENTERPRISE_STORE_HERO_NOTE}</p>
    </div>
  )
}

/**
 * **技能行那两个动作的唯一实现**（`[有更新]` 辅助标签 + 官方 `Switch`）。
 *
 * 行本体（`EnterpriseMarketInlineRows`）与详情弹层（`EnterpriseSkillDetailView`）渲染的是**同一枚子块**，
 * 吃同一份 `facts`（唯一入口 `enterpriseMarketSkillRowFacts`）与同一个 `onToggleSkill` 回调——
 * 「详情里的动作与行上同源」因此是结构性的：文案、禁用口径、无障碍名与悬浮说明全部只在 facts 里算一次，
 * 两个落点不可能各说一套，也不可能有第二个状态副本。
 *
 * 返回**数组**而不是 Fragment：行线的 DOM 大纲与 `[有更新]`/`Switch` 的相对顺序是既有测试的取证点，
 * 数组让这两个元素在树里仍然是行线的直属同级项（Fragment 会成为中间节点、把顺序取证挡在外面）。
 *
 * @param row - 这一行的目录投影（标题与动作语义从它取）。
 * @param facts - 行 facts（`enterpriseMarketSkillRowFacts` 的产出）。
 * @param onToggleSkill - 与行上同一个回调；缺席即禁用（不提供假切换）。
 * @returns `[有更新（命中才出）, 官方 Switch]`。
 */
export function EnterpriseMarketSkillRowActions({ row, facts, onToggleSkill }: {
  readonly row: EnterpriseMarketSkillRow
  readonly facts: EnterpriseMarketSkillRowFacts
  readonly onToggleSkill: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
}): ReactNode {
  return [
    // 开关**左侧**的辅助动作：只在「有更新」时出现（其余态右侧就一个 Switch）。
    // 点击 = 安装中心当前版本（`onToggleSkill(row, true)`），在途禁用但不消失。
    facts.hasUpdate ? (
      <button
        key="update"
        type="button"
        className="own-market-skillTag"
        data-enterprise-skill-tag={ENTERPRISE_MARKET_SKILL_UPDATE_TAG}
        aria-label={facts.updateTag.ariaLabel}
        disabled={onToggleSkill === undefined || facts.busy}
        title={onToggleSkill === undefined ? '企业账号未登录，暂不可操作' : facts.updateTag.title}
        onClick={() => { onToggleSkill?.(row, true) }}
      >
        {facts.updateTag.label}
      </button>
    ) : null,
    // 右侧官方 Switch：`checked` = 该技能已装、在途禁用、`label` 给动作语义——它始终是该行主控件。
    <Switch
      key="switch"
      checked={facts.enabled}
      label={`${facts.enabled ? '卸载' : '安装'}企业技能 ${row.displayName}`}
      disabled={onToggleSkill === undefined || facts.busy}
      title={onToggleSkill === undefined
        ? '企业账号未登录，暂不可操作'
        : facts.busy ? '动作进行中，暂不可操作' : facts.enabled ? '点此卸载' : '点此安装到 ~/.dsh/skills'}
      onChange={(next) => { onToggleSkill?.(row, next) }}
    />,
  ]
}

/**
 * 详情弹层里一条事实（名称 / 描述 / 分类 / 版本 / skillId / 已装状态）。
 * 纯投影、无 DOM：`value` 一律来自**行上那份**目录投影或 Host 回传的已装记录，不另取一次数、不猜。
 */
export interface EnterpriseSkillDetailFact {
  readonly key: string
  readonly label: string
  /** 事实正文；`mono` = 用等宽字体（id 类取值）。 */
  readonly value: string
  readonly mono?: boolean
}

/** 已装状态的可见文案：已装说「已安装 · 含 N 个技能」，未装说「未安装」，在途说安装中/卸载中。 */
export function enterpriseSkillDetailInstallLabel(facts: EnterpriseMarketSkillRowFacts): string {
  if (facts.state === 'INSTALLING') return '安装中…'
  if (facts.state === 'REMOVING') return '卸载中…'
  return facts.enabled ? '已安装' : '未安装'
}

/**
 * 详情要展示的事实列表（纯函数，测试直调）。
 *
 * **分类为缺失设计**：`category` 缺席/null/空串时整条事实不产出（安静缺席，塞「未分类」等于编事实）。
 * 其余五条恒出：技能名称、描述、技能 ID（`skillId`）、技能包 ID（雪花 id）、DSH 来源版本（`sourceDshVersion`）。
 * 已装状态与技能 ID 之间不重复：已装记录里那份 `names` 只在「正文」一节按名字出现。
 *
 * @param row - 行上的目录投影（与行本体同一份数据）。
 * @param facts - 行 facts（已装/在途口径与行上的开关同源）。
 * @returns 按展示顺序排列的事实列表。
 */
export function enterpriseSkillDetailFacts(
  row: EnterpriseMarketSkillRow,
  facts: EnterpriseMarketSkillRowFacts,
): readonly EnterpriseSkillDetailFact[] {
  const facts_: EnterpriseSkillDetailFact[] = [
    { key: 'name', label: '技能名称', value: row.displayName },
    { key: 'skillId', label: '技能 ID', value: row.skillId, mono: true },
    { key: 'packageId', label: '技能包 ID', value: row.id, mono: true },
    { key: 'version', label: 'DSH 版本', value: row.sourceDshVersion },
    { key: 'install', label: '已装状态', value: enterpriseSkillDetailInstallLabel(facts) },
  ]
  const category = enterpriseMarketSkillCategoryTag(row.category)
  // 分类排在版本之前（与行上标题行的签序一致：标题 → 版本 → 分类 是签序，这里是事实序，取可读性）。
  return category === undefined
    ? facts_
    : [...facts_.slice(0, 4), { key: 'category', label: '分类', value: category }, ...facts_.slice(4)]
}

/**
 * 详情「正文」一节的状态（纯投影，测试直调）：未装 / 读取中 / 读失败 / 已取到。
 *
 * 优先级写死为「未装 → 失败 → 读取中 → 有正文」：未装的包根本不该发正文请求，因此未装永远说那句提示；
 * 失败优先于「读取中」，否则一次失败会被下一轮的 loading 盖成「正在读取」而看不到错误码。
 */
export type EnterpriseSkillDetailBody =
  | { readonly kind: 'available'; readonly name: string; readonly text: string }
  | { readonly kind: 'not-installed'; readonly hint: string }
  | { readonly kind: 'loading'; readonly hint: string }
  | { readonly kind: 'failed'; readonly code: string; readonly hint: string }

/** 未装时那句提示：正文只在本机已装的技能里，中心详情投影只有 frontmatter 脱敏事实、**不含正文**。 */
export const ENTERPRISE_SKILL_DETAIL_NOT_INSTALLED = '安装后可查看完整内容（企业中心只发布脱敏摘要，SKILL.md 正文在本机已装技能里）。'
/** 读取中的提示。 */
export const ENTERPRISE_SKILL_DETAIL_LOADING = '正在读取技能正文…'
/** 读取失败的提示前缀（后半句是稳定错误码）。 */
export const ENTERPRISE_SKILL_DETAIL_FAILED = '技能正文读取失败'
/** 空正文的兜底文案（Host 回了 200 但文件是空的：如实说，不假装有内容）。 */
export const ENTERPRISE_SKILL_DETAIL_EMPTY = '（正文为空）'

/**
 * 由「已装与否 + 读取态 + 正文」投影出正文一节该说什么。
 *
 * @param input - `installed`（该包是否已装：只有已装才有正文可取）、`loading`、`errorCode`、`content`。
 * @returns 正文一节的四态之一。
 */
export function enterpriseSkillDetailBody(input: {
  readonly installed: boolean
  readonly loading: boolean
  readonly errorCode?: string | undefined
  readonly content?: { readonly name: string, readonly content: string } | undefined
}): EnterpriseSkillDetailBody {
  if (!input.installed) return { kind: 'not-installed', hint: ENTERPRISE_SKILL_DETAIL_NOT_INSTALLED }
  if (input.errorCode !== undefined) {
    return { kind: 'failed', code: input.errorCode, hint: ENTERPRISE_SKILL_DETAIL_FAILED }
  }
  if (input.loading || input.content === undefined) {
    return { kind: 'loading', hint: ENTERPRISE_SKILL_DETAIL_LOADING }
  }
  return { kind: 'available', name: input.content.name, text: input.content.content }
}

/**
 * **技能详情弹层**（纯函数、无 hook，两套外壳共用同一份呈现：两条入口都经共享宿主渲染它）。
 *
 * 承载形式：官方 `Modal`——**Esc 关闭、点遮罩关闭、焦点圈定在弹层内并在关闭后归还**都由这个原语给
 * （`onClose` 同时是这三条关闭路径的唯一入口，本文件不自己画遮罩、不自己接 keydown、不自己管焦点）；
 * 标题走 `Modal` 的 `title`（同时是 `role="dialog"` 的 `aria-label`），关闭按钮的无障碍名走 `closeLabel`。
 *
 * 内容全部来自**行上那一份**数据：`row`（目录投影）+ `facts`（行 facts）+ `installed`（Host 回传的已装记录）
 * + 正文（只读本机路由）。动作渲染 `EnterpriseMarketSkillRowActions`——与行上是同一枚子块、同一份 facts、
 * 同一个回调，故不存在第二套动作逻辑或状态副本；失败提示复用与行上同一条 `.own-market-inlineError` 规则与
 * 同一句前缀（`enterpriseMarketActionErrorLabel`）+ 稳定错误码。
 *
 * @param props - 见字段注释；`content`/`contentLoading`/`contentErrorCode` 由 hook 包装（`EnterpriseSkillDetailDialog`）供给。
 * @returns 弹层（`Modal` 门户）+ 本弹层独有的 `<style>`。
 */
export function EnterpriseSkillDetailView(props: {
  readonly row: EnterpriseMarketSkillRow
  readonly facts: EnterpriseMarketSkillRowFacts
  readonly installed?: EnterpriseInstalledSkill | undefined
  readonly content?: EnterpriseInstalledSkillContent | undefined
  readonly contentLoading: boolean
  readonly contentErrorCode?: string | undefined
  readonly actionError?: EnterpriseMarketActionError | undefined
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  readonly onReloadContent?: (() => void) | undefined
  readonly onClose: () => void
}): ReactNode {
  const body = enterpriseSkillDetailBody({
    installed: props.installed !== undefined,
    loading: props.contentLoading,
    ...(props.contentErrorCode === undefined ? {} : { errorCode: props.contentErrorCode }),
    ...(props.content === undefined ? {} : { content: props.content }),
  })
  return (
    <>
      <style>{detailStyles}</style>
      <Modal open onClose={props.onClose} closeLabel="关闭" title={props.row.displayName}>
        <div className="own-market-detail" data-enterprise-skill-detail={props.row.id}>
          <p className="own-market-detailDesc">{props.row.description}</p>
          <dl className="own-market-detailFacts">
            {enterpriseSkillDetailFacts(props.row, props.facts).map(fact => (
              <div key={fact.key} className="own-market-detailFact" data-enterprise-skill-detail-fact={fact.key} style={{ display: 'contents' }}>
                <dt>{fact.label}</dt>
                <dd className={fact.mono === true ? 'own-market-detailValue' : undefined}>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <section className="own-market-detailBody" aria-label="技能正文">
            <div className="own-market-detailBodyHead">
              <span className="own-market-detailBodyTitle">技能正文</span>
              {body.kind === 'available' ? <code className="own-market-detailBodyName">{body.name}</code> : null}
            </div>
            {body.kind === 'available' ? (
              <pre className="own-market-detailPre" data-enterprise-skill-content={body.name}>
                {body.text === '' ? ENTERPRISE_SKILL_DETAIL_EMPTY : body.text}
              </pre>
            ) : null}
            {body.kind === 'available' ? null : <p className="own-market-detailHint">{body.hint}</p>}
            {body.kind === 'failed' ? (
              <div className="own-market-inlineError" role="alert">
                {ENTERPRISE_SKILL_DETAIL_FAILED} <code>{body.code}</code>
              </div>
            ) : null}
            {body.kind === 'failed' && props.onReloadContent !== undefined ? (
              <div className="own-market-detailActions">
                <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => { props.onReloadContent?.() }}>
                  重试读取正文
                </Button>
              </div>
            ) : null}
          </section>
          <div className="own-market-detailActions">
            <EnterpriseMarketSkillRowActions row={props.row} facts={props.facts} onToggleSkill={props.onToggleSkill} />
          </div>
          {props.actionError === undefined ? null : (
            <div className="own-market-inlineError" role="alert">
              {enterpriseMarketActionErrorLabel(props.actionError)} <code>{props.actionError.code}</code>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

/**
 * 详情弹层的 **hook 包装**（唯一含副作用的那一层）：点开一条已装技能时经只读同源路由读它的 `SKILL.md` 正文。
 *
 * 三条刻意的约束：
 *  ① **只在已装时发请求**，且名字取 `installed.names[0]`——那是 Host 自己回传的已装记录里的第一个技能目录名，
 *     界面从不接受用户输入的路径，也不自己拼路径；未装行只显示「安装后可查看完整内容」，一条请求都不发；
 *  ② 请求可被 `AbortController` 中止（换行/关闭弹层即中止），且结果回来时先看 `signal.aborted`，
 *     避免迟到结果落到已经换掉的那条技能上；
 *  ③ 失败不静默：`enterpriseLocalErrorCode` 把错误投影成稳定码交给纯视图，视图给 `role="alert"` + 错误码 + 重试按钮。
 *
 * @param props - 与纯视图同一组输入再加 `store`（同源网络实例）与 `onClose`。
 * @returns 纯视图。
 */
export function EnterpriseSkillDetailDialog(props: {
  readonly row: EnterpriseMarketSkillRow
  readonly facts: EnterpriseMarketSkillRowFacts
  readonly installed?: EnterpriseInstalledSkill | undefined
  readonly actionError?: EnterpriseMarketActionError | undefined
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  readonly store?: EnterpriseAccountStore | undefined
  readonly onClose: () => void
}): ReactNode {
  const [content, setContent] = useState<EnterpriseInstalledSkillContent>()
  const [contentErrorCode, setContentErrorCode] = useState<string>()
  const [contentLoading, setContentLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const packageId = props.installed?.packageId
  // 正文只读**第一个**技能目录：名字来自 Host 的已装记录（不是用户输入、也不是我们拼的路径）。
  const name = props.installed?.names[0]
  const api = props.store?.api
  useEffect(() => {
    if (api === undefined || packageId === undefined || name === undefined) {
      setContent(undefined)
      setContentErrorCode(undefined)
      setContentLoading(false)
      return
    }
    const controller = new AbortController()
    setContent(undefined)
    setContentErrorCode(undefined)
    setContentLoading(true)
    void api.skillContent(packageId, name, controller.signal)
      .then(value => { if (!controller.signal.aborted) setContent(value) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setContentErrorCode(enterpriseLocalErrorCode(error)) })
      .finally(() => { if (!controller.signal.aborted) setContentLoading(false) })
    return () => { controller.abort() }
  }, [api, packageId, name, attempt])
  return (
    <EnterpriseSkillDetailView
      row={props.row}
      facts={props.facts}
      {...(props.installed === undefined ? {} : { installed: props.installed })}
      {...(content === undefined ? {} : { content })}
      contentLoading={contentLoading}
      {...(contentErrorCode === undefined ? {} : { contentErrorCode })}
      {...(props.actionError === undefined ? {} : { actionError: props.actionError })}
      {...(props.onToggleSkill === undefined ? {} : { onToggleSkill: props.onToggleSkill })}
      onReloadContent={() => { setAttempt(current => current + 1) }}
      onClose={props.onClose}
    />
  )
}

/**
 * **两套外壳共用的行渲染块**（版式统一的唯一实现点）：按目录页签把整段 `<ul className="own-market-rows">`
 * 连行一起铺出来——技能行 = 行图标 + 两行文案（标题行 `.own-market-cardHead`：标题 + 版本签 + 可选分类签；
 * 描述行 `.own-market-cardDesc`）+ 右侧 `[有更新]` 与官方 `Switch` + 行下失败提示；插件行 = 行图标 + 两行文案 +
 * 状态点与官方状态词 + `Switch` + 行下失败提示。
 * **旧外壳（官方插件页「插件市场」）与新外壳（侧栏「应用商店」）都只经它渲染目录行**——类名、取值、行 facts、
 * 动作落点（辅助动作严格排在开关左侧）与失败提示（`role="alert"` + 稳定错误码）因此不可能在两套外观之间分叉
 * （改动前两套外壳各画一份行，正是分叉的来源；本子块把「一致」变成结构上的一致）。
 * 纯函数、无 hook：事实一律来自 `enterpriseMarketShellModel` 与行 facts，本子块只负责铺版面。
 */
export function EnterpriseMarketInlineRows({ tab, model, props }: {
  readonly tab: EnterpriseMarketDirectoryTabId
  readonly model: EnterpriseMarketShellModel
  readonly props: EnterpriseMarketShellProps
}): ReactNode {
  if (tab === 'skills') {
    return (
<ul className="own-market-rows">
        {model.visibleSkills.map(skill => {
          const facts = enterpriseMarketSkillRowFacts(props, skill)
          return (
            <li
              key={skill.id}
              className="own-market-row"
              data-enterprise-skill-package={skill.id}
              data-enterprise-skill-id={skill.skillId}
              data-enterprise-skill-state={facts.state}
            >
              <div className="own-market-rowLine">
                {/* **行本体**（图标 + 两行文案）是一枚真 `<button>`：点它 = 打开该技能详情。
                    它是 `.own-market-rowLine` 的第一个子节点，下面那两枚动作是它的**兄弟**——
                    点 `[有更新]` / 拨 `Switch` 既不会冒泡进来、也不在可点区域内（结构性保证，不靠 stopPropagation）。
                    回调缺席时 disabled + 说明性 title（照组件节节头的既有降级口径，不给死按钮）。 */}
                <button
                  type="button"
                  className="own-market-rowOpen"
                  data-enterprise-skill-open={skill.id}
                  aria-label={`查看企业技能 ${skill.displayName} 详情`}
                  disabled={props.onOpenSkillDetail === undefined}
                  title={props.onOpenSkillDetail === undefined ? '详情入口未接通' : '查看详情'}
                  onClick={() => { props.onOpenSkillDetail?.(skill) }}
                >
                  <span className="own-market-rowIcon"><Sparkles size={18} aria-hidden="true" /></span>
                  <div className="own-market-rowMain">
                    {/* 第 1 行 = 标题 + 两枚只读签（版本签取 `sourceDshVersion`、分类签取可选 `category`）：
                        单行 nowrap，标签过多时标题先省略、两枚签保持可见，行高不变。 */}
                    <span className="own-market-cardHead">
                      <span className="own-market-cardId own-market-skillTitle">{skill.displayName}</span>
                      {facts.versionTag === undefined ? null : (
                        <Tag className="own-market-tag own-market-skillVersionTag" tone="neutral">{facts.versionTag}</Tag>
                      )}
                      {facts.categoryTag === undefined ? null : (
                        <Tag className="own-market-tag own-market-skillCategoryTag" tone="info">{facts.categoryTag}</Tag>
                      )}
                    </span>
                    {/* 第 2 行 = 描述（官方 13/18-tertiary 单行省略，不换行撑高卡片）。 */}
                    <span className="own-market-cardDesc">{skill.description}</span>
                  </div>
                </button>
                {/* 动作与行上**同一枚子块**（也是详情弹层渲染的那一枚）：同一份 facts、同一个回调。 */}
                <EnterpriseMarketSkillRowActions row={skill} facts={facts} onToggleSkill={props.onToggleSkill} />
              </div>
              {/* 失败可见反馈：失败即在该行给 role="alert" + 稳定错误码，且**不**禁用开关（再拨一次就是重试）。 */}
              <EnterpriseMarketRowError error={props.skillActionError} id={skill.id} />
            </li>
          )
        })}
      </ul>
    )
  }
  return (
<ul className="own-market-rows">
        {model.visiblePlugins.map(plugin => {
          const facts = enterpriseMarketPluginRowFacts(props, plugin)
          return (
            <li
              key={plugin.packageName}
              className="own-market-row"
              data-enterprise-plugin-package={plugin.packageName}
              data-enterprise-plugin-state={plugin.state}
            >
              <div className="own-market-rowLine">
                <span className="own-market-rowIcon"><Package size={18} aria-hidden="true" /></span>
                <div className="own-market-rowMain">
                  <span className="own-market-cardId">{plugin.packageName}</span>
                  <span className="own-market-cardDesc">
                    {plugin.inCatalog ? `企业发布 · v${plugin.version ?? ''}` : '已不在企业目录中'}
                  </span>
                </div>
                {/* 旧外壳的落点：状态点旁**恒**出一行官方状态词（安静态也说），文案取自本仓唯一那份官方状态词表。 */}
                <span className="own-market-rowState">
                  <StateDot state={facts.dot} />
                  {facts.stateTitle}
                </span>
                <Switch
                  checked={facts.enabled}
                  label={`安装企业插件 ${plugin.packageName}`}
                  disabled={facts.switchDisabled}
                  title={plugin.installErrorCode !== undefined ? '该插件当前不可安装'
                    : facts.enabled ? '点此卸载' : '点此安装'}
                  onChange={(next) => { props.onTogglePlugin?.(plugin, next) }}
                />
              </div>
              <EnterpriseMarketRowError error={props.pluginActionError} id={plugin.packageName} />
            </li>
          )
        })}
      </ul>
  )
}

/**
 * **旧外壳**：官方插件页「官方」分组里的「插件市场」卡片点进去的详情页正文（官方 `plugins.item` 的 `page` 视图）。
 * 逐段取自 `9723a97`：
 *  · 技能行 = 行图标 + 官方两行卡片（第 1 行 `.own-market-cardId` 标题 + 紧随的版本签/分类签、第 2 行 `.own-market-cardDesc` 描述）
 *    + 右侧 `[有更新（命中才出）] [Switch]` + 行下失败提示；
 *  · 插件行 = 行图标 + 两行文案 + 状态点 + 官方状态词 + `Switch` + 行下失败提示；
 *  · 三个页签共用 `EnterpriseMarketTabStrip`，组件节共用 `EnterpriseMarketComponentsPanel`。
 * **没有** HERO、**没有**搜索框、**没有**可展开行——这三件是「新外观」的落点，旧外观一件都不加。
 * 纯函数、无 hook：事实一律来自 `enterpriseMarketShellModel` 与行 facts，本组件只负责铺版面。
 */
export function EnterpriseMarketLegacyShell(props: EnterpriseMarketShellProps): ReactNode {
  if (props.view === 'summary') return <EnterpriseMarketSummaryLine />
  const model = enterpriseMarketShellModel(props)
  return (
    <section className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
      <style>{baseStyles}{rowStyles}</style>
      <EnterpriseMarketTabStrip model={model} onSelectTab={props.onSelectTab} />
      {/* 「企业技能」页签（默认页签，用户主战场）：与企业插件页签同规则——「技能」大组件开启（= 会话可用）
          且目录非空才出现。列的是后台分配（预置）的全部技能：未装的照列，装不装由用户拨右侧那枚开关决定。 */}
      <EnterpriseMarketPanel tab="skills" activeTab={model.activeTab}>
        {model.activeTab === 'skills' && model.skillsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-skills">
            <EnterpriseMarketInlineRows tab="skills" model={model} props={props} />
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「企业插件」页签内容：仅当「插件」大组件开启时出现，列企业后台上传的真实插件目录。 */}
      <EnterpriseMarketPanel tab="plugins" activeTab={model.activeTab}>
        {model.activeTab === 'plugins' && model.pluginsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-plugins">
            <EnterpriseMarketInlineRows tab="plugins" model={model} props={props} />
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「组件」页签：两套外壳共用同一份内容（唯一还带折叠语义的一节）。 */}
      <EnterpriseMarketPanel tab="components" activeTab={model.activeTab}>
        {model.activeTab === 'components' ? (
          <EnterpriseMarketComponentsPanel model={model} onToggleSection={props.onToggleSection} onOpenLogin={props.onOpenLogin} />
        ) : null}
      </EnterpriseMarketPanel>
    </section>
  )
}

/**
 * **新外壳**：侧栏一级入口「应用商店」对应的主内容区面板（官方 `main` 槽，key `ENTERPRISE_STORE_PANEL_ID`）。
 * 在旧外壳的基础上多三件「新外观」落点，其余语义（页签、组件节、失败提示、能力）与旧外壳完全同源：
 *  ① 顶部 **HERO** 渐变横幅（标题 + 两枚计数 chip + 一句副文案）；
 *  ② 两个目录页签行 = 官方插件清单**卡片网格**（标题行 + 行尾事实 + 始终可见的描述行 + **卡片内常显的动作条**；
 *     卡片**不折叠**——chevron/`aria-expanded`/`aria-controls`/展开区/`skillId` 行全部退场，动作不再藏在一次点击之后）；
 *  ③ 列表上方 350ms 防抖的**搜索框**（纯客户端过滤，发给模型的 `searchQuery` 只有一份）。
 * 纯函数、无 hook：事实一律来自 `enterpriseMarketShellModel` 与行 facts。
 */
export function EnterpriseMarketStoreShell(props: EnterpriseMarketShellProps): ReactNode {
  if (props.view === 'summary') return <EnterpriseMarketSummaryLine />
  const model = enterpriseMarketShellModel(props)
  /**
   * 目录页签顶部的搜索框（照参考对象的位置：**列表上方**、卡片网格之前）。
   * 只把**原始输入**往上抛（`onSearchInput`），防抖 350ms 由控制器做——本层不持定时器也不持状态；
   * `value` 取的是**原始输入值** `searchValue`（不是防抖后的 `searchQuery`，否则每次按键的重渲染都会把框重置回旧值）。
   * 「组件」页签不渲染它：那三行是交付排期清单、恒三行。
   */
  const searchBox = (tab: EnterpriseMarketDirectoryTabId): ReactNode => (
    <label className="own-market-catalogSearch">
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        className="own-market-catalogSearchInput"
        value={props.searchValue?.[tab] ?? ''}
        placeholder={enterpriseMarketSearchPlaceholder(tab)}
        aria-label={enterpriseMarketSearchLabel(tab)}
        onChange={(event) => { props.onSearchInput?.(tab, event.target.value) }}
      />
    </label>
  )
  return (
    <section className="own-market-entry own-market-storePage" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
      <style>{baseStyles}{rowStyles}{storeStyles}</style>
      {/* HERO 只有新外壳有：数字取真实行数（与页签计数同源）。 */}
      <EnterpriseMarketHero skills={model.tabCounts.skills} plugins={model.tabCounts.plugins} />
      <EnterpriseMarketTabStrip model={model} onSelectTab={props.onSelectTab} />
      {/* 「企业技能」页签：卡片**不折叠**——卡片上直接是标题/签/状态点/描述，动作（[有更新] + 官方 Switch）
          常显在卡片内，失败提示紧随其后。原先的 chevron / `aria-expanded` / `aria-controls` / 展开区 / skillId 行已全部退场。 */}
      <EnterpriseMarketPanel tab="skills" activeTab={model.activeTab}>
        {model.activeTab === 'skills' && model.skillsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-skills">
            <div className="own-market-catalog">
              {searchBox('skills')}
              {model.visibleSkills.length === 0 ? (
                <p className="own-market-catalogSearchEmpty">{ENTERPRISE_MARKET_SEARCH_EMPTY}</p>
              ) : (
                <EnterpriseMarketInlineRows tab="skills" model={model} props={props} />
              )}
            </div>
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「企业插件」页签：与技能行同一套**不折叠**卡片（标题行 = 包名 + 行尾事实，动作条里是安装/卸载开关 + 失败提示）。 */}
      <EnterpriseMarketPanel tab="plugins" activeTab={model.activeTab}>
        {model.activeTab === 'plugins' && model.pluginsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-plugins">
            <div className="own-market-catalog">
              {searchBox('plugins')}
              {model.visiblePlugins.length === 0 ? (
                <p className="own-market-catalogSearchEmpty">{ENTERPRISE_MARKET_SEARCH_EMPTY}</p>
              ) : (
                <EnterpriseMarketInlineRows tab="plugins" model={model} props={props} />
              )}
            </div>
          </section>
        ) : null}
      </EnterpriseMarketPanel>
      {/* 「组件」页签：两套外壳共用同一份内容（唯一还带折叠语义的一节）。 */}
      <EnterpriseMarketPanel tab="components" activeTab={model.activeTab}>
        {model.activeTab === 'components' ? (
          <EnterpriseMarketComponentsPanel model={model} onToggleSection={props.onToggleSection} onOpenLogin={props.onOpenLogin} />
        ) : null}
      </EnterpriseMarketPanel>
    </section>
  )
}

/**
 * 共享控制器的产出：**一份**外壳 props + 登录弹窗的最小接线。
 * `shellProps` 是两套外壳唯一的事实来源（业务真值 + 回调 + UI 态全在里面），`loginOpen`/`closeLogin` 交给宿主
 * 同树渲染登录弹窗（弹窗不属于任何一套外观，故不进外壳 props）。
 */
export interface EnterpriseMarketController {
  /** 两套外壳共用的 props（控制器是唯一构造点）。 */
  readonly shellProps: EnterpriseMarketShellProps
  /**
   * 详情弹层的输入（点行本体后才非空）；两条入口共用**同一份**：
   * 同一行、同一份 facts、同一条已装记录、同一个动作回调与同一份失败事实。
   */
  readonly skillDetail: EnterpriseMarketSkillDetailProps | undefined
  /** 登录弹窗当前是否打开。 */
  readonly loginOpen: boolean
  /** 关闭登录弹窗（含「登录中先取消」的既有语义，由 login-dialog 自己判）。 */
  readonly closeLogin: () => void
}

/** 共享宿主交给详情弹层的那一组输入（控制器是唯一构造点，弹层自己不取数、不持第二份状态）。 */
export interface EnterpriseMarketSkillDetailProps {
  readonly row: EnterpriseMarketSkillRow
  readonly facts: EnterpriseMarketSkillRowFacts
  readonly installed?: EnterpriseInstalledSkill | undefined
  readonly actionError?: EnterpriseMarketActionError | undefined
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  readonly store?: EnterpriseAccountStore | undefined
  readonly onClose: () => void
}

/**
 * 共享控制器（**唯一一份逻辑**）：订阅企业账号 store、按会话可用性取技能目录/已装清单/中心版本、
 * 组装安装/卸载动作与失败码归行，并持有四份 UI 态（页签选中、组件节折叠、行开合、搜索输入 + 350ms 防抖后的口径）。
 * 两条入口各一个 hook 组件（`EnterpriseMarketLegacyPage` / `EnterpriseMarketStorePage`），但两者都只经本 hook 取
 * **同一份** `EnterpriseMarketShellProps`——取数、动作、失败处理与状态归属在这里只有一份，外壳只负责画。
 *
 * 技能目录不在 store 快照里，故按会话可用性就地取（`store.api.skills()`，同源固定路径）；
 * 取数失败/未登录都收敛成空目录——两个目录页签据此不出内容，不残留半个错误态。
 * 已装态与目录**并行**取（`store.api.installedSkills()`），并**只对已装行**再补一次详情
 * （`store.api.skillDetail(id)`：中心列表投影的 `versionId` 恒为空串，判定「有更新」只能靠详情里的它）；
 * 已装只用来决定那枚开关的 checked / disabled 与辅助动作出不出现，本页不做乐观切换。
 * @param props - `view` 透传入口侧视图（`summary` 不预取技能目录）；`store` 由共享注册面的 `inject` 注入。
 * @returns 一份外壳 props + 登录弹窗的最小接线。
 */
export function useEnterpriseMarketController({ view, store }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
}): EnterpriseMarketController {
  const snapshot = useAccount(store as EnterpriseAccountStore)
  const dialog = useEnterpriseLoginDialog(store as EnterpriseAccountStore)
  const sessionUsable = enterpriseSessionUsable(snapshot.status?.state)
  // 页签：初值取 `ENTERPRISE_MARKET_DEFAULT_TAB`——**默认落在「企业技能」**（用户的主战场：
  // 后台分配/预置的技能一进页面就列出来），组件与「企业插件」要靠点页签才进去。
  const [activeTab, setActiveTab] = useState<EnterpriseMarketTabId>(ENTERPRISE_MARKET_DEFAULT_TAB)
  // 折叠态：初值取 `ENTERPRISE_MARKET_DEFAULT_EXPANDED`——页签化后**只剩「组件」页签内部**那一节还带折叠。
  const [expandedSections, setExpandedSections] = useState<Record<EnterpriseMarketSectionId, boolean>>(ENTERPRISE_MARKET_DEFAULT_EXPANDED)
  const onToggleSection = (section: EnterpriseMarketSectionId): void => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  /**
   * 行展开态：**单选**（同一时刻最多一行展开），行键 = `{页签}:{行 id}`，初值 `null` = 全部收起。
   * **去折叠后没有任何外壳消费它**（用户裁决 A：应用商店卡片去掉折叠、动作常显）。
   * 按「不为这次改动去动共享层」的要求，那份状态与 `onToggleRow` **原样保留**：行 facts 仍照 `expandedRow`
   * 算 `open`/`detailsId`，纯投影 `enterpriseMarketRowOpen`/`enterpriseMarketRowKey` 也仍在出口上。
   * 将来若要收敛，须连同 `EnterpriseMarketShellProps.expandedRow`/`onToggleRow`、行 facts 的三枚字段与
   * 整条控制器状态一起删，并同步测试——那是独立的一次清理，不夹带在本轮里。
   */
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const onToggleRow = (key: string): void => {
    setExpandedRow(current => (current === key ? null : key))
  }
  /**
   * 搜索：`searchInput` 是输入框里的**原始值**（每次按键都更新、决定框里显示什么），
   * `searchQuery` 是**防抖 350ms** 之后的过滤口径（`ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS`）。
   * 按目录页签分槽（切页签不串词）；过滤是纯函数 `enterpriseMarketSearch*Rows`，**不发任何请求**。
   * 同值不重设 state（引用稳定），避免每敲一次键就多渲染一轮。
   */
  const [searchInput, setSearchInput] = useState<Record<EnterpriseMarketDirectoryTabId, string>>(ENTERPRISE_MARKET_SEARCH_INITIAL)
  const [searchQuery, setSearchQuery] = useState<Record<EnterpriseMarketDirectoryTabId, string>>(ENTERPRISE_MARKET_SEARCH_INITIAL)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(previous => (
        previous.skills === searchInput.skills && previous.plugins === searchInput.plugins ? previous : searchInput
      ))
    }, ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS)
    return () => { clearTimeout(timer) }
  }, [searchInput])
  const onSearchInput = (tab: EnterpriseMarketDirectoryTabId, value: string): void => {
    setSearchInput(previous => (tab === 'skills' ? { ...previous, skills: value } : { ...previous, plugins: value }))
  }
  const hasStore = store !== undefined
  const openLogin = hasStore ? dialog.openDialog : undefined
  const pluginStatus = snapshot.pluginStatus
  const catalog = pluginStatus?.catalog ?? []
  const local = pluginStatus?.plugins ?? []
  const enterprisePlugins = enterpriseMarketPluginRows(catalog, local)
  // 技能目录：只在 `page` 视图（企业技能页签的宿主）+ 有 store + 会话可用时取；卡片视图不预取。
  // 会话不可用/取数失败一律回落空目录（页签随之不出现）；依赖变化即中止在途请求，避免迟到结果跨会话回填。
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
    // 两条取数各自兜底：目录失败回落空目录（页签消失），已装清单失败只回落全部未装（不拖垮目录）。
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
  // 每次发起动作都先清掉旧提示，成功后自然不会再出现。
  const [skillActionError, setSkillActionError] = useState<EnterpriseMarketActionError>()
  /**
   * 被点开详情的那一条技能行（**行键 = 行对象本身**：详情里的一切都从这同一份目录投影取，
   * 不在打开时另存一份副本，避免弹层与行显示出两个「同一技能」的版本）。`undefined` = 弹层关闭。
   */
  const [skillDetailRow, setSkillDetailRow] = useState<EnterpriseMarketSkillRow>()
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
  const shellProps: EnterpriseMarketShellProps = {
    view,
    sessionUsable,
    onOpenLogin: openLogin,
    enterprisePlugins,
    enterpriseSkills,
    onTogglePlugin,
    installedSkills,
    pendingSkill,
    onToggleSkill,
    pluginActionError,
    skillActionError,
    expandedSections,
    onToggleSection,
    activeTab,
    onSelectTab: setActiveTab,
    expandedRow,
    onToggleRow,
    searchValue: searchInput,
    searchQuery,
    onSearchInput,
    // 点行本体 = 把**那一行**记成当前详情目标；行的开关与 `[有更新]` 有自己的回调，不经过这里。
    onOpenSkillDetail: setSkillDetailRow,
  }
  /**
   * 详情弹层的输入**只在这里构造一次**：行投影、行 facts（与行上同一个函数）、已装记录（同一份
   * `installedSkills`）、失败事实（同一份 `skillActionError`）与动作回调（同一个 `onToggleSkill`）。
   * 弹层因此不可能持有第二份「已装」或第二套动作逻辑。
   */
  const detailInstalled = skillDetailRow === undefined
    ? undefined
    : (installedSkills ?? []).find(item => item.packageId === skillDetailRow.id)
  const skillDetail: EnterpriseMarketSkillDetailProps | undefined = skillDetailRow === undefined ? undefined : {
    row: skillDetailRow,
    facts: enterpriseMarketSkillRowFacts(shellProps, skillDetailRow),
    ...(detailInstalled === undefined ? {} : { installed: detailInstalled }),
    ...(skillActionError?.id === skillDetailRow.id ? { actionError: skillActionError } : {}),
    ...(onToggleSkill === undefined ? {} : { onToggleSkill }),
    ...(store === undefined ? {} : { store }),
    onClose: () => { setSkillDetailRow(undefined) },
  }
  return {
    // 外壳 props **只在这里构造一次**：两套外壳拿到的是同一个形状、同一批事实。
    shellProps,
    skillDetail,
    loginOpen: dialog.open,
    closeLogin: dialog.closeDialog,
  }
}

/**
 * 两条入口**共用**的宿主：唯一含 hook 的接线——控制器 → 指定外壳 → 同一个登录弹窗 + 同一个技能详情弹层。
 * 入口之间的差异被收敛成「传哪个 `shell`」这一件事，故两条入口不会各写一套取数/动作/弹窗接线；
 * 详情弹层与登录弹窗一样**不属于任何一套外观**，故也不进外壳 props（外壳只拿到「点行要做什么」那一枚回调）。
 */
export function EnterpriseMarketShellHost({ view, store, shell }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
  readonly shell: (props: EnterpriseMarketShellProps) => ReactNode
}): ReactNode {
  const controller = useEnterpriseMarketController({ view, store })
  return (
    <>
      {shell(controller.shellProps)}
      {controller.skillDetail === undefined ? null : <EnterpriseSkillDetailDialog {...controller.skillDetail} />}
      <EnterpriseLoginDialog store={store as EnterpriseAccountStore} open={controller.loginOpen} onClose={controller.closeLogin} />
    </>
  )
}

/**
 * 官方 `plugins.item` 的真实入口（**旧外观**）：官方插件页「官方」分组里的「插件市场」卡片点进去的详情页。
 * 与 `EnterpriseMarketStorePage` 的唯一差异是「把哪个外壳交给宿主」。
 * @param props - `view` 由官方透传（卡片 `summary` / 详情 `page`）；`store` 由共享注册面的 `inject` 注入。
 */
export function EnterpriseMarketLegacyPage({ view, store }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
}): ReactNode {
  return <EnterpriseMarketShellHost view={view} store={store} shell={EnterpriseMarketLegacyShell} />
}

/**
 * 侧栏一级入口「应用商店」对应的主内容区面板的真实入口（**新外观**：HERO + 卡片网格 + 搜索；卡片不折叠、动作常显）。
 * @param props - `view` 由 `client.tsx` 的 `inject` 恒定注入 `ENTERPRISE_STORE_PANEL_VIEW`（= `'page'`）；`store` 与卡片同源。
 */
export function EnterpriseMarketStorePage({ view, store }: {
  readonly view: 'summary' | 'page'
  readonly store?: EnterpriseAccountStore | undefined
}): ReactNode {
  return <EnterpriseMarketShellHost view={view} store={store} shell={EnterpriseMarketStoreShell} />
}
