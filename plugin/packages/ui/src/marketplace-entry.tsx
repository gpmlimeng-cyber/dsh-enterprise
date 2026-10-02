/**
 * [INPUT]: 依赖 React（useState/useEffect）、品牌位图 brand、lucide-react 四枚图标（三枚组件图标 + 侧栏入口的 Store）、官方 ui-primitives 的 Switch/Tag/StateDot（pinned 0.1.5-rc.2 的 .d.ts 已导出，不走 official-ui 收窄接缝；**该 pin 不含 `SegmentedTabs`**，故 page 视图的页签条照 `account-view.tsx` 既有 tablist 手写自绘，pin 对齐是另一个待用户拍板的开放项）、account-state 的 `enterpriseSessionUsable` 与 account-store 的 `EnterpriseAccountSnapshot`（shared 面、订阅只在 WithStore 包装内）、local-api-decode 的技能 DTO（`EnterpriseRuntimeSkill` 目录 + 已装记录 `EnterpriseInstalledSkill`——技能行开关的「已装」只认后者这一份 Host 真值）与失败码唯一投影 `enterpriseLocalErrorCode`（行内失败提示的 code 来源，与技能 tab 同源）、消费官方 `plugins.item` owner props（`view`/`form`）与主内容区面板（`main` key）注入的等价 props（`view` 恒取 `ENTERPRISE_STORE_PANEL_VIEW`、`store` 与卡片同源）；中心当前版本只从**详情投影** `store.api.skillDetail(id)` 取（列表投影的 `versionId` 恒为空串），且只对已装行取——未装行没有本机版本可比，不白跑请求
 * [REF]: **行版式参考 `jingyunstudio/jingyun-dsh` 的 `MarketplaceSection.tsx`**（每行 = 可展开卡片：标题行放标题 + 状态点 + 一枚「启用/已装」标签 + chevron，展开区放动作与失败提示；列表上方一枚 350ms 防抖搜索框），**但排版取值一律照官方** `@deepseek-ai/dsh-client-ui-settings-plugin-inventory` 的 `qSYn7G_*`（卡片 `.5px` + `radius-xl`(20px) + `settings-card-stroke/fill`、标题 **14/20-500**、描述 **12/18 + 两行 clamp 且始终可见**、`cardDetails` 顶部发丝线 + `10px 14px 12px` 内衬、`cardContent` `min-height:52px` + `padding:12px 14px` + `gap:2px`、列表 `repeat(2,minmax(0,1fr))` + `gap:10px`）；**明确不复刻它的四处漂移**：`cardTitle` 13px/600、`card` 1px + 10px 圆角 + `bg-layer-3`、描述「仅展开时显示」、自绘 `configTag`（11px/5px/自配色 → 改用官方 `Tag` 原语），也不抄它的 `max-height:380px` 滚动容器与 `@media 768` 断点（改官方容器查询 520，并留同断点 media 兜底旧 WebView）。官方 pin 的 primitives 0.1.5-rc.2 **有** `DisclosureRow`，但它是 24px 的紧凑流程行（13/24 标题、无尾部控件位），与官方插件清单卡片的取值和结构都不同，故**不复用**它、改照 `qSYn7G_*` 手写卡片并把它的交互语义（整行 button + `aria-expanded`）照搬。
 * [OUTPUT]: 提供官方插件页「官方」分组里的「插件市场」入口卡片、**同一个三页签商店整页**，以及独立应用商店的共享身份常量（`ENTERPRISE_STORE_PANEL_ID`／`ENTERPRISE_STORE_ENTRY_LABEL`／`ENTERPRISE_STORE_ENTRY_ORDER`／`ENTERPRISE_STORE_PANEL_VIEW`）与侧栏一级入口图标 `EnterpriseStoreIcon`（官方 owner props `{ size, active }`）——面板与卡片共用同一份实现（page 视图顶部手写页签条 = 企业技能 / 企业插件 / 组件，默认选中「企业技能」；三个 `role="tabpanel"` 只有当前页签挂载内容，页签内容直接复用原三节的行渲染、不重写节内实现），以及可脱离 DOM 测试的页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`、页签文案计数投影 `enterpriseMarketTabLabel`）、组件清单/计数摘要/组件状态纯投影、企业插件行投影、企业技能行投影（**官方插件清单卡片**：标题行 = 标题 + 版本签 `sourceDshVersion` + 可选分类签 `category`，描述行始终可见，并带中心当前版本 `latestVersionId`）与标题行标签纯投影 `enterpriseMarketSkillVersionTag`/`enterpriseMarketSkillCategoryTag`、「有更新」判定纯投影 `enterpriseMarketSkillHasUpdate` 与判定入口 `enterpriseMarketSkillRowHasUpdate`、**行开合真源**（`enterpriseMarketRowKey`＝`{页签}:{行 id}`、`enterpriseMarketRowDetailsId`、单选 `enterpriseMarketRowOpen`）与**行尾三件套**纯投影（`enterpriseMarketSkillDot`/`enterpriseMarketSkillConfigTag`/`enterpriseMarketPluginConfigTag`/`enterpriseMarketSkillStatusLabel`/`enterpriseMarketPluginStatusLabel`）、**搜索真源**（`ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS=350`、`EnterpriseMarketDirectoryTabId`/`ENTERPRISE_MARKET_DIRECTORY_TABS`/`ENTERPRISE_MARKET_SEARCH_INITIAL`、`enterpriseMarketSearchPlaceholder`/`enterpriseMarketSearchLabel`/`ENTERPRISE_MARKET_SEARCH_EMPTY`、`enterpriseMarketSearchTerm` + 通用 `enterpriseMarketSearchRows` 与技能/插件两个行级包装）、展开区那枚辅助动作的纯投影 `enterpriseMarketSkillUpdateTag` 与文案常量 `ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`、技能行受管态纯投影 `enterpriseMarketSkillState`（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）、**唯一剩下可折叠的「组件」页签折叠态** `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败可见反馈 `EnterpriseMarketActionError` 与文案投影 `enterpriseMarketActionErrorLabel`，以及注册常量；卡片摘要与详情页正文**不重复同一句**——摘要只在 `summary` 视图出现（官方必渲染的那一份），详情页只留页签条与三个面板；**详情页顶部压缩**：badge 槽只出「版本号 + 包名」（纯噪音的「预览版」文字签已删），企业技能/企业插件两节原先各占一整行的独立计数行（`.own-market-sectionMeta`）已删、计数并入页签文案，`.own-market-storeTabs` 顶部间距 2→0、`.own-market-section` 顶部间距 24→12
 * [POS]: ui 的企业应用商店（二期结构切片后的形态：**一份实现两处入口**）：官方 `plugins.item` 槽位（卡片一句话走 `summary`、**整页三页签商店**走 `page`）+ 侧栏一级入口「应用商店」对应的**主内容区面板**（`main` key = `ENTERPRISE_STORE_PANEL_ID`，注册时注入 `view = ENTERPRISE_STORE_PANEL_VIEW`，恒进 `page` 分支）；两条入口注册的是**同一个** `EnterpriseMarketPage`（同一份 store、同一份纯函数体），面板不新增自己的槽位、不重画商店；**page 视图 = 页签条（企业技能 | 企业插件 | 组件，默认「企业技能」）+ 三个 `role="tabpanel"`**：页签条手写（`role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls`/`aria-labelledby`/`id` 三处配对、roving `tabIndex`、←/→/Home/End 走焦并选中、选中态 2px 下划线），**不用官方 `SegmentedTabs`**（工程编译期 pin 的 primitives 0.1.5-rc.2 不含它，import 即 TS 报错；pin 对齐待用户拍板），三个面板**只有当前页签的内容挂载**（其余只留一个 `hidden` 空壳，让 `aria-controls` 恒能解析）；store 与开登录回调均为可选注入（共享注册面经 `client.tsx` 的 `inject` 给本条目注入 store，缺席时降级为占位态，注入后自动升级为真值态）；组件行 `reserved` 只剩配方一行，插件与技能行随企业会话真值，两个目录节（企业插件/企业技能）都只在对应大组件开启且目录非空时出现，每一节顶部各有一枚搜索框（**位置照参考对象：列表上方**；350ms 防抖在 hook 入口、纯客户端过滤、按页签分槽，不发请求也不新增本机路由；「组件」页签恒三行故不配），企业插件行与技能行现在**同一套可展开卡片**（.own-market-cardGrid / .own-market-cardShell[data-open] + 整行 `.own-market-cardContent` button）：标题行 = 标题（`.own-market-cardTitle` 官方 14/20-500）+ 技能行的两枚只读标签（版本签取 `sourceDshVersion`、分类签取可选 `category`，缺席/null/空串时整枚签不渲染、安静缺席不塞占位；标签过多时标题先省略、两枚签保持可见，行高不变）+ 行尾三件套（官方 `StateDot`：已装 done / 有更新 warning / 未装 idle / **在途 ongoing 旋转弧**；一枚官方 `Tag` 标签「已装·未装」/「已启用·未启用」，`data-enterprise-row-enabled` 同源；需要留意的态补一行可见文字，安静态不出）+ chevron（展开 rotate(180deg)）；描述行（`.own-market-cardDescription` 官方 12/18 + 两行 clamp）**始终可见**，展开区（`.own-market-cardDetails`，官方 .5px 发丝线 + 平台底 + 10/14/12 内衬）里才是动作：技能行给 `skillId`（`.own-market-entryValue`）+ **有更新的辅助动作**（真实 `<button type="button">`、`.own-market-skillTag`、键盘可达、`data-enterprise-skill-tag='UPDATE_AVAILABLE'`，只在「有更新」时出现，`aria-label` = `更新企业技能 X`、`title` = 「点此更新到中心当前版本」、点击 = `onToggleSkill(skill, true)`，在途 `disabled` 但**不消失**）+ 那枚官方 `Switch`（`checked` = 该技能已装 / 插件已启用，在途 `disabled`，`label` 给动作语义，`onChange(next)` 原样交回），开关仍是该行主控件、辅助动作排在它**左侧**；开合由 `expandedRow`（单选行键 `{页签}:{行 id}`，`onToggleRow` 翻转）决定，**收起时展开区整段不进 DOM**（照官方 `{open && children}`），行内失败提示（`role="alert"` + 稳定错误码，`own-market-inlineError`）也落在展开区里，失败行开关照旧可拨可重试；技能列表列的是后台分配（预置）的**全部**技能——不按「已装」过滤，未装的也照列，装不装由用户拨这枚开关决定；版本身份只投影 `versionId` 这一份（`sha256` 按 `skill-api-decode` 的契约在解码时校验形状后即丢，界面拿不到中心哈希，故「有更新」**不比 sha256**）——中心列表投影的 `versionId` 恒为空串、只有 `GET /skills/{id}` 详情才是真值，故 hook 入口**只对已装行**逐个取详情（`store.api.skillDetail(packageId)`）按 id 归并成行上的 `latestVersionId`，取不到/失败即留空串＝该行不判更新（不猜）；**两节的行共用同一份失败可见反馈**：动作失败时命中该行的 `role="alert"` 行内提示（`安装失败`/`卸载失败` + `enterpriseLocalErrorCode` 的稳定码，照「技能」tab 的 `own-skill-inlineError` 口径），失败后该行开关不再禁用、可原地重试；技能目录与已装清单由 hook 入口分别经 `store.api.skills()` 与 `store.api.installedSkills()` **并行**取（已装态取数失败只降级为全部未装，不拖垮目录），纯函数体只收直传的行；**页签化后的折叠态**：企业技能 / 企业插件两节的节头折叠**已删除**（显隐由页签承担；两节原先把「N 个」单独占一行，现计数已并入页签文案、独立计数行整段删除），唯一还带折叠语义的是**「组件」页签内部的组件清单**（仍是 `groupToggle` 节头 + `ENTERPRISE_MARKET_DEFAULT_EXPANDED` 单字段初值＝展开，`enterpriseMarketSectionOpen` 纯投影仍照官方 `?? false` 口径，`EnterpriseMarketSectionId` 随之收敛为 `'components'` 一个成员）；**行开合与搜索的四个状态也自持在 `EnterpriseMarketPage` 里**（`expandedRow: string | null` 初值 `null`＝全收起、`onToggleRow` 单选翻转；`searchInput` 原始值 + `searchQuery` 防抖后值各一份 `Record<目录页签, string>`，`useEffect` 里 `setTimeout(..., ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS)` 并在清理里 `clearTimeout`），纯函数体一个状态、一个定时器都不持（全靠 props 直传），故测试可直接函数调用拿到完整语义树；
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Package, Sparkles, BookMarked, ChevronDown, Search, Store } from 'lucide-react'
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
 * 面板侧由 `client.tsx` 的 `inject` 传这个常量——两条入口最终都走 `EnterpriseMarketPage` 的 `page` 分支。
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
 * 行的开合状态真源（`EnterpriseMarketPage` 的 `useState<string | null>`）：
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
  /**
   * **当前展开的那一行**（行键 = `enterpriseMarketRowKey(tab, 行 id)`；单选：同一时刻最多一行展开）。
   * `null` = 全部收起、`undefined` = 没给过状态（纯函数直调按「全开」拿完整树，与 `expandedSections` 同约定）。
   * 真运行时由 `EnterpriseMarketPage` 的 `useState<string | null>` 供给——纯函数体仍然一行状态都不持。
   */
  readonly expandedRow?: string | null | undefined
  /** 行的开合回调（点标题行按钮触发，传行键）；缺席时标题行按钮仍在但不改状态（纯函数直调场景）。 */
  readonly onToggleRow?: ((key: string) => void) | undefined
  /**
   * 搜索框里显示的**原始输入值**（按目录页签分槽，缺席 = 空串）。
   * 它必须直连受控 `input.value`：只用防抖后的 `searchQuery` 当 value 的话，每次按键后的重渲染
   * 都会把输入框重置回旧值（用户会觉得「打字被吞」）——防抖只影响**过滤**，不影响框里显示什么。
   */
  readonly searchValue?: Partial<Record<EnterpriseMarketDirectoryTabId, string>> | undefined
  /**
   * **防抖后**的搜索关键词，按目录页签分槽（`{ skills, plugins }`，缺席 = 空串 = 不过滤）。
   * 只有目录类页签（企业技能/企业插件）用它过滤行；「组件」页签不渲染搜索框、也不读它。
   */
  readonly searchQuery?: Partial<Record<EnterpriseMarketDirectoryTabId, string>> | undefined
  /** 搜索框的原始输入回调（`onSearchInput(tab, value)`）；防抖在 hook 入口，本纯函数体只往上抛。 */
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
 * 版式 = **官方插件清单卡片**（参考对象 jingyun 的可展开行结构）：标题行（displayName + 版本签 + 分类签
 * + 状态点 + 一枚「已装/未装」标签 + chevron）+ 始终可见的描述行（官方 12/18、两行 clamp），
 * 展开区里才是动作（skillId + [有更新时的辅助动作] [官方 Switch]，开关是主控件）与失败提示。
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
/* ── 行版式（结构照参考对象 jingyun 的 .catalog/.cards/.card…，**取值逐条照官方插件清单 .qSYn7G_***）──
   列表容器 = 官方 .catalog（flex column + gap 12），同时是官方容器查询的上下文（卡片按**容器**宽度换列，
   不是按视口——本页是面板，容器查询才说得准）。 */
.own-market-catalog{display:flex;flex-direction:column;gap:12px;min-width:0;container:own-market-catalog/inline-size}
/* 搜索框 = 官方 .search：列表上方、label 相对定位、放大镜绝对左 12px（pointer-events:none 不挡输入）。 */
.own-market-catalogSearch{position:relative;display:flex;align-items:center;width:100%;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-catalogSearch>svg{position:absolute;left:12px;pointer-events:none}
/* 输入框逐值照官方 .search input：.5px 描边 + radius-md + bg-layer-1 + 36px 高 + 0/34/0/36 内衬 + 13px 字。 */
.own-market-catalogSearchInput{width:100%;height:36px;border:.5px solid var(--dsw-alias-border-l4,#d0d5dd);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:13px;outline:none;padding:0 34px 0 36px}
.own-market-catalogSearchInput::placeholder{color:var(--dsw-alias-label-tertiary,#98a2b3)}
/* 焦点态照官方：描边换 focus-ring 色 + 2px 18% 同色光晕（不是另画一套 outline）。 */
.own-market-catalogSearchInput:focus-visible{border-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#2563eb));box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#2563eb)) 18%, transparent)}
.own-market-catalogSearchEmpty{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:13px;line-height:20px;margin:0;padding:2px 0}
/* 卡片网格 = 官方 .cards：两列 + gap 10；窄到 520 转单列（官方容器查询 + 同断点 media 兜底旧 WebView）。 */
.own-market-cardGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}
/* 卡片 = 官方 .card：.5px settings-card-stroke + radius-xl(20px) + settings-card-fill，overflow:hidden 收圆角。 */
.own-market-cardShell{display:flex;flex-direction:column;min-width:0;overflow:hidden;border:.5px solid var(--dsw-alias-settings-card-stroke,#d0d5dd);border-radius:var(--dsw-radius-xl,20px);background:var(--dsw-alias-settings-card-fill,#fff)}
.own-market-cardShell[data-open='true']{border-color:var(--dsw-alias-border-l3,#d0d5dd)}
/* 标题行按钮 = 官方 .cardContent：整行可点、无边框透明、列向 gap 2 + 12/14 内衬 + 52px 最小高；
   hover 与展开态共用官方 interactive-bg-hover，焦点环内缩 2px（官方 outline-offset:-2px）。 */
.own-market-cardContent{display:flex;flex-direction:column;flex:auto;align-items:stretch;gap:2px;box-sizing:border-box;width:100%;min-height:52px;border:0;padding:12px 14px;background:0 0;color:inherit;font:inherit;text-align:left;cursor:pointer}
.own-market-cardContent:hover,.own-market-cardShell[data-open='true']>.own-market-cardContent{background:var(--dsw-alias-interactive-bg-hover,#f2f4f7)}
.own-market-cardContent:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:-2px}
/* 主行 = 官方 .cardMainRow：两端对齐、间距 12（左标题、右状态点/标签/chevron）。 */
.own-market-cardMainRow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
/* 标题 + 两枚签：**单行 nowrap flex**，行高锁 20px（= 官方标题行高；官方 Tag 固定 19px 高 < 20px，
   故加签不改变这一行的高度）。标签过多时**标题先让步**：标题 flex:0 1 auto + min-width:0 先省略，
   两枚签 .own-market-tag 的 flex:none 保持可见；head 自身 overflow:hidden 兜底，绝不换行、绝不撑高。 */
.own-market-cardHead{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;line-height:20px;overflow:hidden}
/* 标题 = 官方 .cardTitle 取值 **14px/500/20px**（明确不复刻 jingyun 漂移的 13px/600）。 */
.own-market-cardTitle{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary,#101828);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.own-market-skillTitle{flex:0 1 auto;min-width:0}
/* 描述 = 官方 .cardDescription 取值 **12/18 + 两行 clamp**，且**始终可见**（官方口径；
   明确不复刻 jingyun「仅展开时显示」的拍平）。展开时官方解除 clamp，这里照抄。 */
.own-market-cardDescription{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px;text-wrap:pretty}
.own-market-cardShell[data-open='true'] .own-market-cardDescription{display:block}
/* 行尾 = 官方 .cardTrailing（tertiary + gap 8）+ .phaseDot 包着官方 StateDot（10px 图钉尺寸，不缩放）。 */
.own-market-cardTrailing{display:inline-flex;flex:none;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-market-phaseDot{display:inline-flex;flex:none}
.own-market-configTag{flex:none}
/* 状态点旁的可见状态文案（官方 StateDot 是 aria-hidden，要求与文字配对）：12/18 secondary，单行不换行。 */
.own-market-rowStatus{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:18px;white-space:nowrap}
/* chevron：收起 0° → 展开 180°（照官方 .card[data-open=true] .chevron）；与组件节那枚 -90° 的
   .own-market-chevron 各用各的类，互不继承（否则卡片 chevron 会跟着转 -90°）。 */
.own-market-cardChevron{flex:none;color:var(--dsw-alias-label-tertiary,#98a2b3);transition:transform .14s ease}
.own-market-cardShell[data-open='true'] .own-market-cardChevron{transform:rotate(180deg)}
/* 展开区 = 官方 .cardDetails：顶部 .5px 发丝线 + 平台底 + 10/14/12 内衬（不是另造一层卡片）。 */
.own-market-cardDetails{border-top:.5px solid var(--dsw-alias-border-l2,#e4e7ec);background:var(--dsw-alias-bg-module-platform,#f9fafb);padding:10px 14px 12px}
/* 动作条：靠右（照参考对象 .actionContainer 的 flex-end），[辅助标签] 在 [Switch] 左侧。 */
.own-market-cardActions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}
/* 行内标识 = 官方 .entryValue（mono 12/18 primary），落在展开区顶部（技能行给 skillId）。 */
.own-market-entryValue{display:block;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#101828);overflow-wrap:anywhere;margin-bottom:8px}
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
/* 行内失败提示（企业插件行/企业技能行共用）：取值照「技能」tab 的 .own-skill-inlineError（error 色 + 12/19 + 左对齐 + 无内衬）。
   那份 CSS 归 skill-market 的 <style> 持有、切到本页时并不在 DOM，故这里补一份同值规则，不借道未挂载的样式表。 */
.own-market-inlineError{padding:0;text-align:left;font-size:12px;line-height:19px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
/* 卡片换列：官方用**容器查询**（本页是面板，宽度不等于视口）。旧 WebView 不支持容器查询时，
   下面那条同断点的 media 兜底保证手机（视口本就 <520）仍是单列，不会挤成两列。 */
@container own-market-catalog (width<=520px){.own-market-cardGrid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:520px){.own-market-cardGrid{grid-template-columns:minmax(0,1fr)}}
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
  expandedRow, onToggleRow, searchValue, searchQuery, onSearchInput,
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
  // 搜索过滤（**纯客户端**，不发请求、不新增路由）：关键词缺席/空串时原样返回全部行，目录顺序不动。
  const visibleSkills = enterpriseMarketSearchSkillRows(enterpriseSkills, searchQuery?.skills ?? '')
  const visiblePlugins = enterpriseMarketSearchPluginRows(enterprisePlugins, searchQuery?.plugins ?? '')
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
  /**
   * 目录页签顶部的搜索框（照参考对象的位置：**列表上方**、卡片网格之前）。
   * 这里只把**原始输入**往上抛（`onSearchInput`），防抖 350ms 由 hook 入口做——纯函数体不持定时器也不持状态；
   * `value` 取的是**原始输入值** `searchValue`（不是防抖后的 `searchQuery`——否则每次按键的重渲染都会把框重置回旧值）。
   * 「组件」页签不渲染它：那三行是交付排期清单、恒三行（理由见 `EnterpriseMarketDirectoryTabId`）。
   */
  const searchBox = (tab: EnterpriseMarketDirectoryTabId): ReactNode => (
    <label className="own-market-catalogSearch">
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        className="own-market-catalogSearchInput"
        value={searchValue?.[tab] ?? ''}
        placeholder={enterpriseMarketSearchPlaceholder(tab)}
        aria-label={enterpriseMarketSearchLabel(tab)}
        onChange={(event) => { onSearchInput?.(tab, event.target.value) }}
      />
    </label>
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
      <div role="tablist" aria-label={ENTERPRISE_MARKET_TABLIST_LABEL} className="own-market-storeTabs">
        {ENTERPRISE_MARKET_TABS.map((tab, index) => {
          const selected = tab.id === activeTab
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
            （= 会话可用）且目录非空才出现。每一行 = **官方插件清单卡片**（可展开）：
            标题行 = 标题 + 版本签/分类签 + 状态点 + 一枚「已装/未装」标签 + chevron（整行是 button），
            展开区 = skillId + [有更新时的辅助动作] + [官方 Switch] + 失败提示。
            一键安装/卸载到官方 `~/.dsh/skills`，已装态与「有更新」都只认 Host 回传的真值
            （`installedSkills` 的 `versionId` × 行上的 `latestVersionId`；本页不猜版本、不留乐观已装）。
            列的是后台分配（预置）的全部技能——未装的照列，装不装由用户在展开区拨这枚开关决定。
            搜索只是**客户端过滤这一屏**（目录真值仍是 Host 那份），页签计数说的仍是目录总行数。 */}
        {activeTab === 'skills' && skillRowsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-skills">
            <div className="own-market-catalog">
              {searchBox('skills')}
              {visibleSkills.length === 0 ? (
                <p className="own-market-catalogSearchEmpty">{ENTERPRISE_MARKET_SEARCH_EMPTY}</p>
              ) : (
                <ul className="own-market-cardGrid">
                  {visibleSkills.map(skill => {
                    const skillState = enterpriseMarketSkillState(installedSkills, pendingSkill, skill)
                    const rowKey = enterpriseMarketRowKey('skills', skill.id)
                    const open = enterpriseMarketRowOpen(expandedRow, rowKey)
                    const detailsId = enterpriseMarketRowDetailsId('skills', skill.id)
                    const config = enterpriseMarketSkillConfigTag(skillState)
                    const statusLabel = enterpriseMarketSkillStatusLabel(skillState)
                    // 在途（安装中/卸载中）不许再拨：并发动作会互相覆盖已装清单。
                    const busy = skillState === 'INSTALLING' || skillState === 'REMOVING'
                    // 辅助标签只认「有更新」这一个事实（与受管态共用同一判定点），与在途无关：
                    // 在途时它**保留但禁用**（用户看得见「正在更新」），未装行 / 已装同版本行一律不出。
                    const hasUpdate = enterpriseMarketSkillRowHasUpdate(installedSkills, skill)
                    const updateTag = enterpriseMarketSkillUpdateTag(skill.displayName)
                    // 标题行那两枚标签的取值：版本签取列表投影的 `sourceDshVersion`（无需服务端改动）；
                    // 分类签取可选字段 `category`——没有（缺席/null/空串）时这里就是 undefined，签**整枚不渲染**。
                    const versionTag = enterpriseMarketSkillVersionTag(skill.sourceDshVersion)
                    const categoryTag = enterpriseMarketSkillCategoryTag(skill.category)
                    return (
                      <li
                        key={skill.id}
                        className="own-market-cardShell"
                        data-open={open ? 'true' : undefined}
                        data-enterprise-skill-package={skill.id}
                        data-enterprise-skill-id={skill.skillId}
                        data-enterprise-skill-state={skillState}
                        data-enterprise-row-enabled={config.enabled ? 'true' : 'false'}
                      >
                        {/* 整行是 button（native button = 键盘 Enter/Space 天然可用），`aria-expanded` + `aria-controls`
                            指向展开区；收起时展开区整段不进 DOM（照官方 `{open && children}`）。 */}
                        <button
                          type="button"
                          className="own-market-cardContent"
                          aria-expanded={open}
                          aria-controls={detailsId}
                          onClick={() => { onToggleRow?.(rowKey) }}
                        >
                          <span className="own-market-cardMainRow">
                            {/* 标题 + 版本签 + 分类签：整行 nowrap 单行，标签过多时标题先省略、两枚签保持可见。 */}
                            <span className="own-market-cardHead">
                              <span className="own-market-cardTitle own-market-skillTitle">{skill.displayName}</span>
                              {versionTag === undefined ? null : (
                                <Tag className="own-market-tag own-market-skillVersionTag" tone="neutral">{versionTag}</Tag>
                              )}
                              {categoryTag === undefined ? null : (
                                <Tag className="own-market-tag own-market-skillCategoryTag" tone="info">{categoryTag}</Tag>
                              )}
                            </span>
                            {/* 行尾三件事，照参考对象「状态点 + 一枚标签」+ 我们的短板补齐：
                                ① 官方 `StateDot`（在途 = `ongoing` 旋转弧，官方与它都没有）；
                                ② 一枚「已装/未装」标签（官方 `Tag` 原语，替代它自绘的 configTag）；
                                ③ 需要人留意的状态补一行文字（StateDot 是 aria-hidden，必须与文字配对）。 */}
                            <span className="own-market-cardTrailing">
                              <span className="own-market-phaseDot">
                                <StateDot state={enterpriseMarketSkillDot(skillState)} />
                              </span>
                              <Tag className="own-market-configTag" tone={config.tone}>{config.label}</Tag>
                              {statusLabel === undefined ? null : <span className="own-market-rowStatus">{statusLabel}</span>}
                              <ChevronDown size={12} className="own-market-cardChevron" aria-hidden="true" />
                            </span>
                          </span>
                          {/* 描述按官方口径**始终可见**（12/18 + 两行 clamp；展开时解除 clamp）——
                              不复刻参考对象「仅展开时显示描述」的拍平。 */}
                          <span className="own-market-cardDescription">{skill.description}</span>
                        </button>
                        {open ? (
                          <div className="own-market-cardDetails" id={detailsId}>
                            {/* 行内标识照官方 `.entryValue`（mono 12/18）：技能包的稳定 kebab-case id。 */}
                            <code className="own-market-entryValue">{skill.skillId}</code>
                            <div className="own-market-cardActions">
                              {/* 开关**左侧**的辅助动作：只在「有更新」时出现（其余态右侧就一个 Switch）。
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
                                checked={config.enabled}
                                label={`${config.enabled ? '卸载' : '安装'}企业技能 ${skill.displayName}`}
                                disabled={!onToggleSkill || busy}
                                title={onToggleSkill === undefined
                                  ? '企业账号未登录，暂不可操作'
                                  : busy ? '动作进行中，暂不可操作' : config.enabled ? '点此卸载' : '点此安装到 ~/.dsh/skills'}
                                onChange={(next) => { onToggleSkill?.(skill, next) }}
                              />
                            </div>
                            {/* 失败可见反馈（与「技能」tab 的 own-skill-inlineError 同一口径）：失败即在该行给
                                role="alert" + 稳定错误码，且退回未装态（已装清单仍由 Host 回传真值主导）；
                                失败**不**禁用开关——再拨一次就是重试。 */}
                            {rowError(skillActionError, skill.id)}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
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
            行版式与企业技能节**同一套卡片**（标题行 = 包名 + 状态点 + 「已启用/未启用」标签 + chevron，
            展开区 = 安装/卸载开关 + 失败提示）；安装/卸载语义、失败反馈与开关口径一字未动。 */}
        {activeTab === 'plugins' && pluginRowsVisible ? (
          <section className="own-market-section" data-market-section="enterprise-plugins">
            <div className="own-market-catalog">
              {searchBox('plugins')}
              {visiblePlugins.length === 0 ? (
                <p className="own-market-catalogSearchEmpty">{ENTERPRISE_MARKET_SEARCH_EMPTY}</p>
              ) : (
                <ul className="own-market-cardGrid">
                  {visiblePlugins.map(plugin => {
                    const rowKey = enterpriseMarketRowKey('plugins', plugin.packageName)
                    const open = enterpriseMarketRowOpen(expandedRow, rowKey)
                    const detailsId = enterpriseMarketRowDetailsId('plugins', plugin.packageName)
                    const config = enterpriseMarketPluginConfigTag(plugin.state)
                    const statusLabel = enterpriseMarketPluginStatusLabel(plugin.state)
                    return (
                      <li
                        key={plugin.packageName}
                        className="own-market-cardShell"
                        data-open={open ? 'true' : undefined}
                        data-enterprise-plugin-package={plugin.packageName}
                        data-enterprise-plugin-state={plugin.state}
                        data-enterprise-row-enabled={config.enabled ? 'true' : 'false'}
                      >
                        <button
                          type="button"
                          className="own-market-cardContent"
                          aria-expanded={open}
                          aria-controls={detailsId}
                          onClick={() => { onToggleRow?.(rowKey) }}
                        >
                          <span className="own-market-cardMainRow">
                            <span className="own-market-cardHead">
                              <span className="own-market-cardTitle">{plugin.packageName}</span>
                            </span>
                            {/* 状态点复用本仓既有的官方语义映射 `enterprisePluginDot`（ACTIVE=done、FAILED=error、
                                在途=ongoing、等待重启/回滚=warning、其余=idle），文案取官方状态词表。 */}
                            <span className="own-market-cardTrailing">
                              <span className="own-market-phaseDot">
                                <StateDot state={enterprisePluginDot(plugin.state)} />
                              </span>
                              <Tag className="own-market-configTag" tone={config.tone}>{config.label}</Tag>
                              {statusLabel === undefined ? null : <span className="own-market-rowStatus">{statusLabel}</span>}
                              <ChevronDown size={12} className="own-market-cardChevron" aria-hidden="true" />
                            </span>
                          </span>
                          {/* 描述行照旧（官方口径始终可见）：一句话说明这行的来路与版本。 */}
                          <span className="own-market-cardDescription">
                            {plugin.inCatalog ? `企业发布 · v${plugin.version ?? ''}` : '已不在企业目录中'}
                          </span>
                        </button>
                        {open ? (
                          <div className="own-market-cardDetails" id={detailsId}>
                            <div className="own-market-cardActions">
                              <Switch
                                checked={config.enabled}
                                label={`安装企业插件 ${plugin.packageName}`}
                                disabled={!onTogglePlugin || plugin.installErrorCode !== undefined
                                  || plugin.state === 'INSTALLING' || plugin.state === 'DOWNLOADING' || plugin.state === 'REMOVING' || plugin.state === 'ROLLBACK'}
                                title={plugin.installErrorCode !== undefined ? '该插件当前不可安装'
                                  : config.enabled ? '点此卸载' : '点此安装'}
                                onChange={(next) => { onTogglePlugin?.(plugin, next) }}
                              />
                            </div>
                            {/* 安装/卸载失败的可见反馈：这是原先「拨了没反应」的那一处——动作失败只有 store 收着码，
                                本页一个字都没说。失败后开关照旧可拨（上面的 disabled 不含本提示）。 */}
                            {rowError(pluginActionError, plugin.packageName)}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
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
  /**
   * 行展开态：**单选**（同一时刻最多一行展开，照参考对象的 `expanded === item.id`），行键 = `{页签}:{行 id}`。
   * 初值 `null` = 全部收起——安装/卸载开关与失败提示都在展开区里，这也正是「可展开行」的意义：
   * 收起时每一行都只有一行字（标题 + 状态点 + 标签），展开才露出动作。
   */
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const onToggleRow = (key: string): void => {
    setExpandedRow(current => (current === key ? null : key))
  }
  /**
   * 搜索：`searchInput` 是输入框里的**原始值**（每次按键都更新、决定框里显示什么），
   * `searchQuery` 是**防抖 350ms** 之后的过滤口径（`ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS`，照参考对象同值）。
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
        expandedRow={expandedRow}
        onToggleRow={onToggleRow}
        searchValue={searchInput}
        searchQuery={searchQuery}
        onSearchInput={onSearchInput}
      />
      <EnterpriseLoginDialog store={store as EnterpriseAccountStore} open={dialog.open} onClose={dialog.closeDialog} />
    </>
  )
}
