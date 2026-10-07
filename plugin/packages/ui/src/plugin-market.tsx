/**
 * [INPUT]: 依赖共享 EnterpriseAccountStore 的企业目录/本机事实、Harness Button/Switch/Tag 与 Lucide 图标
 * [OUTPUT]: 提供设置页内的插件搜索/已安装筛选、版本详情、显式安装/卸载及状态文案。 **本刀（卡片第二行改描述 + 标题行标签照技能）**：卡片标题行由「只有包名」改成 **标题 + 「企业」签 + 版本短号签**（新增纯函数组件 `EnterprisePluginCardHead`，标签用技能行**同一枚**官方 `Tag` 原语、**同一串类名** `own-market-tag`/`own-market-skillVersionTag`、同一个 tone，字面仍取 `enterpriseMarketVersionTag` 的 `v{version}`），卡片**第二行**由「企业发布 · v…」改成**插件描述**（`enterprisePluginDescriptionText`，缺失如实说「暂无描述」）；版本信息一个字没丢（它在标题签上，详情弹窗「企业版本」那一格照旧）；第三行（体积）与页脚（状态词 + 动作区）一字未动；**CSS 一个新类都没加**（`styles` 字符串逐字节不变，类名一律沿用两个消费侧既有声明）。 **本刀（失败文案降维）**：删除本文件的插件码表，失败一律渲染 `EnterpriseErrorNotice`（人话 + 「下一步：」+「技术信息」里的稳定码），兜底不再把码拼进可见句子 **本刀（目录三态 + 可重试）**：新增纯投影 `enterprisePluginCatalogState` / `enterprisePluginCatalogEmptyText` / `enterprisePluginCatalogVersionText`，目录四态（未登录 / 加载中 / 失败 / 空（三种原因）/ 就绪）显式化；失败态给唯一提示组件 + 真重发的重试，目录没取到时详情那一格不再谎称「已下架」。 **本刀（死开关改造）**：安装按钮原先 `disabled={busy || !connected || fatal !== undefined || item.installErrorCode !== undefined || waiting}` 且一句 `title` 都没有——禁用了却一个字不说，是产品宪法禁止的死控件。现改为：① 新增纯投影 `enterprisePluginRowGate`（唯一入口）与 `EnterprisePluginRowGate`/`EnterprisePluginGateNotes`，禁用原因全部来自新叶 `plugin-install-gate.ts` 的 `enterprisePluginLockReason`（目录判定 / 在途 / 等重启 / 别的操作用着 / 状态读不到），`installErrorCode` 只拦安装、不拦卸载；② 每一枚禁用都配**行上可见**的一句（`role="status"`，落点复用既有 `.own-market-sub`，不新增 CSS）与一句悬浮说明 `enterprisePluginSwitchTitle`；③ 平台彻底退出决策面：目录声明的 `operatingSystems` 与设备系统都不再进来（数据面字段照旧随行携带），卡片行与详情弹窗**一个字都不提系统**——「声明含当前平台 / 不含 / 根本没有该字段」三种形态渲染逐字相同；④ 不可达的 `!connected` 条件删掉（连不上时 `catalog`/`local` 皆空、一行都渲染不出来），并写清这条推理。 **本刀（企业插件安装的动态过程效果）**：卡片行与详情弹窗新增「安装中」那一条**真进度**（`EnterprisePluginCardProgressNotes` 与 `EnterprisePluginCardSettledNote`，两处共用同一个 `pluginProgressFacts` 入参），阶段文字直接取本文件那张 `STATES`（故与行脚状态词是同一张表、不可能漂）；`role="progressbar"` + `aria-live="polite"` + `aria-valuetext`（不确定态、无 aria-valuenow），CSS 另加 `own-plugin-progress*` 一族与一条 `@media (prefers-reduced-motion:reduce)`；进度与交代都由 `plugin-install-progress.ts` 的唯一投影算出，本文件不自造阶段词、不编百分比。 **本刀（企业插件真取消）**：进度条旁边新增一枚**真取消按钮**（官方 `Button` 原语 + Lucide `X`，**零新增 CSS 类**）——只在 `progress.cancelable`（官方取消句柄真实存在的那个受管态）**且写入口在场**时才画，点它就是 `store.cancelPlugin(name)`（同源 `POST /plugins/cancel`，正文关闭键集 `{packageName}`）；取消请求在途时按钮保持可见但 `disabled`、文案改「正在取消…」，同一落点以 `role="status"` 播报那句进行态（**不是**死控件）；不能取消时**不画**按钮、改画 `progress.cancelNotice` 那句可见原因（「走到『正在安装』后就能取消」/「卸载已经开始，完成前不能中断」）；卡片行与详情弹窗共用同一个 `cancelInstall` 写入口与同一份投影，故两处行为不可能分叉。 **本刀（卡片标题 = 插件名称 + 点标题进详情）**：新增纯函数组件 `EnterprisePluginCardTitle`（标题行的唯一实现：整枚真 `<button>` + 无障碍名「查看 <名称> 的详情」 + 点击回传本行包名），`EnterprisePluginCardHead` 新增 `displayName` 入参与投影取值 `enterprisePluginDisplayName`（显示名 → 缺省/空白回退包名）；详情弹窗「插件」那一格读同一枚投影；表格与第三行/页脚/动作区一字未动、CSS 一字未动（零新增类）。
 * [POS]: ui 的员工插件管理视图，由「企业设置」的插件 tab 承载，数据与执行由 DSH Enterprise Host 拥有
 * **本刀（详情 = 子页面，不是弹窗；用户口径第 15 条）**：点卡片标题**不再**弹 `Modal`——详情改成**内容区里的
 *   子页面**，与技能/配方详情（`marketplace-entry.tsx` 的整页切换）**同一形态**：新增纯函数
 *   `EnterprisePluginContentRegion`（列表 ↔ 详情**互斥**，详情在场时列表整段不进 DOM：不是浮层、无遮罩、
 *   无 portal、无 dialog 语义）与纯函数 `EnterprisePluginDetailPage`（`role="region"` + 可聚焦 `h3` 标题 +
 *   左上角【返回】）。**详情字段逐项、逐顺序复用改动前弹窗那一份** `<dl class="own-market-facts">`（插件 /
 *   企业版本 / 本机版本 / 发布方 /（大小）/（安装状态）/（暂时不能安装），文案一字未改），进度与落地交代仍是
 *   同一份投影，动作区（更新版本 / 【卸载】+ 二次确认）由页面注入同一枚 `detailActions`——**确认框仍是弹窗**
 *   （`ConfirmAction` + 官方 `Modal` 原样保留，用户要改的是详情不是确认）。返回两条路：返回按钮 + Esc
 *  （监听钉在本页根节点、命中即 `stopPropagation`）；**浏览器返回键没接**（本页没有真实路由，硬造 `history`
 *   会与宿主打架，故不假装有，由测试守住 `pushState`/`popstate` 一个都不许出现）。返回后**列表滚动位置与焦点
 *   还原**：点击那一刻读下最近可滚动祖先的 `scrollTop`、按**包名**把焦点还给那一枚标题按钮（列表是重新挂载
 *   的，旧 DOM 引用已失效），`useLayoutEffect` 在绘制前落定。**无障碍**：标题按钮的 `aria-haspopup="dialog"`
 *   **删除**（不再是弹窗，一个 `aria-haspopup` 都不留），详情标题带 `tabIndex={-1}` 作为进入时的程序化聚焦点。
 *   **CSS 一个字节都没动**（`styles` 长度 5345 与 FNV-1a 1754276488 两条基线原样通过；新代码只用本页既有的
 *   `.own-market-toolbar`/`.own-market-actions`/`.own-market-facts` 与 `.own-plugin-progress*`）。
 * **本刀（插件行动分流，用户口径）**：列表行的动作区按状态分流——**未安装 ⇒ 一枚【＋】圆形图标按钮**（点 = 安装；
 *   形态照 workdsh 技能市场卡片右侧那枚 ＋：`SkillsPanel.tsx:275` 的 `<Button className="install">＋</Button>` +
 *   `styles.ts:144-147` 的四条规则，本刀在插件卡片上落成新类 `.own-plugin-install`，值逐条相同），
 *   **已安装 ⇒ 一枚官方 `Switch` ＝ 启用 / 停用**（关掉走 `store.setPluginEnabled(name,false)`，**绝不**卸载）；
 *   **【卸载】整条移进详情子页面**（`detailActions`：`ConfirmAction` 二次确认 + `ENTERPRISE_PLUGIN_UNINSTALL_IMPACT`
 *   说清影响），列表行一个卸载入口都没有（由 `tests/plugin-install-gate.spec.ts` 的反向锁守着）。
 *   同时把「已安装」那一格的状态词收敛成 `已安装 · 已启用 / 已停用`（唯一一份在 gate 叶里），
 *   并把「更新版本」也一并收进详情（列表行只有 ＋ 或开关两枚控件）。
 * **本刀（卡片标题 = 插件名称 + 点标题进详情）**：卡片标题由**包名**改成**插件名称**——取值经叶子唯一投影
 *   `enterprisePluginDisplayName(displayName, packageName)`（与「插件市场」插件行、详情子页面**同一份真源**）：
 *   有制品 `displayName` 就用它，缺席/空白**回退包名**（不空白、不编造）。标题即详情入口：抽出纯函数
 *   `EnterprisePluginCardTitle`（无 hook、测试可直调），整枚标题行是**真 `<button>`**（原生键盘可达 +
 *   焦点环，不自造第二套键盘实现；与官方插件页技能行/配方行同款），无障碍名固定为「查看 <名称> 的详情」，
 *   点击回调把**本行**的包名回传（`openDetail`）；详情子页面那一格读同一枚投影。
 *   ★ 如实交代：真实数据里 6 条企业插件制品**没有一条声明 `displayName`** ⇒ 显示名 = 包名，
 *   这类插件在界面上的标题与改前**逐字相同**，只有声明了人类可读名的插件才看得出差别。 **本刀（导出给「插件市场」复用）**：新增 `ENTERPRISE_PLUGIN_STYLES`（本文件那份全局 CSS 的唯一出口）与 `scrollTargetOf`（「进入详情前那一刻真的会滚的那个祖先」的唯一判定）两个导出——官方插件页「插件市场」那一面的插件详情子页面**原样复用**本文件的 `EnterprisePluginDetailPage`，故它必须把这份样式表一并挂上（两份表类名零交集，同页并存不互相覆盖），而还原滚动位置必须与这边**同一条**判定。导出的是同一串字节，CSS 与 face A 的详情子页面、它的锁都一字未动。
 * **本刀（插件市场详情补描述，用户口径第 19 条）**：`EnterprisePluginDetailPage` 新增**可选** prop
 *   `description`（additive：face A 不传 ⇒ 它渲染出的东西逐字不变，由详情大纲逐字快照锁着）——face B 传真值
 *   后，详情里在事实表**之后**多一段「描述」：纯文本子节点（无 `dangerouslySetInnerHTML`）、
 *   `pre-wrap` 保留原始换行、`overflow-wrap:anywhere` 不被长串英文撑破、上限 12 行×20px=240px 超出在块内
 *   滚动读全（不截断不折叠）；缺失一律整段不进 DOM（不留「暂无描述」空壳）。取值经新增纯投影
 *   `enterprisePluginDetailDescription`（缺描述 → `undefined`，与行上 `enterprisePluginDescriptionText`
 *   的「暂无描述」口径**刻意不同**）。**CSS 一个字节都没动、一个新类都没加**（复用本页既有
 *   `.own-market-notice`，其余是内联版式），故 `styles` 长度 5345 与 FNV-1a 1754276488 原样通过。
 * **本刀（口径 22：README 渲染成漂亮排版）**：`EnterprisePluginDetailPage` 再增一枚**可选**
 *   `descriptionMarkdown`（additive：**face A 不传 ⇒ 缺省不为真 ⇒ 输出逐字不变**，那条大纲逐字快照仍绿）——
 *   为真时「描述」段正文改由新叶 `markdown-render.tsx` 的 `renderMarkdown` 翻成 React 元素（标题 / 段落 /
 *   无序·有序列表 / 围栏代码块 / 引用 / 水平线 / 行内代码 / 粗斜体 / 删除线 / 链接 / 行内换行），
 *   raw HTML 与非法协议一律降级为纯文本、图片**绝不**变成 `<img>`；容器与排布（既有的 `.own-market-notice` +
 *   12 行×20px=240px 块内滚动 + `overflow-wrap:anywhere`，仍在事实表之后、动作区之前）一字未动，
 *   **CSS 一个字节都没动、一个新类都没加**（Markdown 版式全部是内联样式，`styles` 5345 / 1754276488 仍绿）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { ChevronDown, Download, Package, RefreshCw, Search, Trash2, X } from 'lucide-react'
import {
  useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type ReactNode, type Ref,
} from 'react'
import type { EnterpriseAccountStore } from './account-store.js'
import { ConfirmAction } from './confirm-action.js'
// 卡片标题行的标识与第二行的文案都取自**叶子** `enterprise-card-text.tsx`（与官方插件页的技能行/插件行
// 共用同一份）：标签的类名与 tone、版本字面 `v{version}`、标题取值（显示名 → 缺省回退包名）、
// 描述缺失的降级句都只有那一处真源。
import {
  EnterpriseMarketBadgeTag,
  enterpriseMarketVersionTag,
  enterprisePluginDescriptionText,
  enterprisePluginDisplayName,
} from './enterprise-card-text.js'
import { EnterpriseErrorNotice } from './error-notice.js'
import type { ManagedPluginState } from './local-api.js'
// 口径 22：README 的 **Markdown 排版**只由这一处实现（自写的最小安全渲染器；全仓没有现成的 Markdown 库，
// 依赖纪律也不许新增 package.json 依赖）。本文件只决定「这一段用哪种版式」，解析与安全闸门都在那一叶里。
import { renderMarkdown } from './markdown-render.js'
import {
  ENTERPRISE_PLUGIN_UNINSTALL_IMPACT,
  ENTERPRISE_PLUGIN_UNINSTALL_TITLE,
  enterprisePluginInstallLabel,
  enterprisePluginInstallTitle,
  enterprisePluginInstalled,
  enterprisePluginInstalledStatusLabel,
  enterprisePluginLockNotice,
  enterprisePluginLockReason,
  enterprisePluginRowAction,
  enterprisePluginSwitchTitle,
  enterprisePluginUninstallLabel,
  enterprisePluginUninstallTitle,
  type EnterprisePluginLockReason,
  type EnterprisePluginRowAction,
} from './plugin-install-gate.js'
// 「安装中」那一条**真进度**的唯一投影（与官方插件页里的插件市场共用同一份；
// 阶段文字就取下面那张 `STATES` 状态词表，故两处不可能各说一套）。
import {
  ENTERPRISE_PLUGIN_PROGRESS_CANCELLING,
  enterprisePluginProgress,
  enterprisePluginSettledNotice,
  type EnterprisePluginBusyFact,
  type EnterprisePluginProgress,
  type EnterprisePluginSettledFact,
} from './plugin-install-progress.js'

const STATES: Record<ManagedPluginState, { title: string; description: string; color: string }> = {
  EXPECTED: { title: '未安装', description: '可选择安装', color: '#667085' },
  DOWNLOAD_PENDING: { title: '等待下载', description: '制品下载即将开始', color: '#2563eb' },
  DOWNLOADING: { title: '正在下载', description: '正在获取企业插件', color: '#2563eb' },
  VERIFIED: { title: '校验通过', description: '制品完整性与兼容性校验通过', color: '#2563eb' },
  INSTALLING: { title: '正在安装', description: '正在更新本机插件', color: '#2563eb' },
  RESTART_REQUIRED: { title: '等待重启', description: '重启 Harness 后生效', color: '#b54708' },
  ACTIVE: { title: '已安装', description: '插件已启用', color: '#16803c' },
  REMOVE_PENDING: { title: '等待卸载', description: '卸载操作即将开始', color: '#b54708' },
  REMOVING: { title: '正在卸载', description: '正在更新本机插件', color: '#b54708' },
  FAILED: { title: '处理失败', description: '请重试', color: '#c4320a' },
  ROLLBACK: { title: '切换版本', description: '正在安装所选版本', color: '#2563eb' },
}

export const enterprisePluginStatePresentation = (state: ManagedPluginState) => STATES[state]

/** 目录取数中的轻提示。 */
export const ENTERPRISE_PLUGIN_LIST_LOADING = '正在加载插件'
/** 未登录时的空态（说清「为什么空」+ 下一步）。 */
export const ENTERPRISE_PLUGIN_LIST_SIGNED_OUT = '登录企业账号后可用'
/** 目录取数失败的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射给）。 */
export const ENTERPRISE_PLUGIN_LIST_FAILED = '插件目录加载失败'
/** 目录本身为空。 */
export const ENTERPRISE_PLUGIN_LIST_EMPTY_CATALOG = '企业还没有发布任何插件。请联系企业管理员发布，或稍后刷新再看。'
/** 搜索没命中。 */
export const ENTERPRISE_PLUGIN_LIST_EMPTY_SEARCH = '没有匹配的插件，试试换个关键词。'
/** 「已安装」筛选下确实一个都没装。 */
export const ENTERPRISE_PLUGIN_LIST_EMPTY_INSTALLED = '还没有安装任何企业插件。'
/** 详情弹窗里企业目录那一格读不到时的如实说法（**不谎称「已下架」**）。 */
export const ENTERPRISE_PLUGIN_VERSION_UNREADABLE = '暂时无法读取'
/** 详情子页面里「已不在企业目录中」的既有口径。 */
export const ENTERPRISE_PLUGIN_VERSION_DELISTED = '已下架'
/** 详情子页面可见标题（改动前弹窗那一枚 `title="插件详情"` 的原话，一个字没改）。 */
export const ENTERPRISE_PLUGIN_DETAIL_TITLE = '插件详情'
/** 详情子页面左上角【返回】的可见文案（照技能/配方详情那枚面包屑的口径：只说去处，动词由无障碍名承载）。 */
export const ENTERPRISE_PLUGIN_DETAIL_BACK_TEXT = '插件列表'
/** 返回按钮的**完整动作语义**（无障碍名，与可见文案分开：读屏听到的是「返回插件列表」）。 */
export const ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL = '返回插件列表'
/** 详情「发布方」那一格的既有取值（改动前是内联字面量，本刀提成常量以便逐字锁住）。 */
export const ENTERPRISE_PLUGIN_DETAIL_PUBLISHER = '企业管理员'
/** 详情「本机版本」那一格在未安装时的既有取值。 */
export const ENTERPRISE_PLUGIN_DETAIL_NOT_INSTALLED = '未安装'
/** 详情里那一段【描述】的小标题（**只有传真值时才上屏**；不传 ⇒ 连这段标题都不进 DOM）。 */
export const ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LABEL = '描述'
/**
 * 描述块最多显示几行（超出在块内滚动看全，**不截断、不折叠、不丢字**）。
 *
 * 取 12 行的理由：契约 `PluginDescription` 的上限是 1000 字，而企业目录里**最长的那条真实描述是
 * 347 字**（`@mengli114/dsh-settings-nav-collapse` 的 `package.json`）——它在详情页的正文宽度下
 * 约 5–6 行，故**真实数据一条都不会滚动**；而 1000 字的极端值（≈3 倍）在手机窄屏上会到十几行，
 * 12 行这一刀把它挡在返回按钮/动作区之前，用户可以就地滚动读完，不会有任何字被丢掉。
 */
export const ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_LINES = 12
/** 与描述块复用的既有文案类 `.own-market-notice` 的 `line-height:20px` **同值**（按行换算上限必须与它一致）。 */
export const ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LINE_HEIGHT = 20
/** 描述块的高度上限 = 行数 × 行高（超出 240px 的部分在块内滚动）。 */
export const ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_HEIGHT
  = `${ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_LINES * ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LINE_HEIGHT}px`

/**
 * 详情里那一段描述的取值（纯投影，测试直调）：**有描述才返回值**，其余（缺席 / null / 空串 / 纯空白）
 * 一律 `undefined` ⇒ 整段不进 DOM（连「描述」这枚小标题都不出现，不留空壳、更不写占位句）。
 *
 * 与卡片第二行那枚 `enterprisePluginDescriptionText` 的差别正在**缺失口径**上：行上缺描述必须
 * **如实说一句「暂无描述」**（一行空白看着像坏了），详情里缺描述则**整段不出现**（多一段没有内容的
 * 标题才是真噪音）。有描述时两者一致：**原样返回，不 trim、不截断、不改写**。
 */
export function enterprisePluginDetailDescription(description: string | null | undefined): string | undefined {
  if (description === undefined || description === null) return undefined
  return description.trim() === '' ? undefined : description
}

/**
 * 详情弹窗「企业版本」那一格的取值（纯投影，测试直调）。
 * 目录取到了才敢说「已下架」；目录本身没取到（失败/在途）时说「暂时无法读取」——
 * 否则用户会把一次取数失败读成「这个插件被下架了」。
 */
export function enterprisePluginCatalogVersionText(input: {
  readonly catalogState: EnterprisePluginCatalogState
  readonly version?: string | undefined
}): string {
  if (input.version !== undefined) return input.version
  return input.catalogState.kind === 'failed' || input.catalogState.kind === 'loading'
    ? ENTERPRISE_PLUGIN_VERSION_UNREADABLE
    : ENTERPRISE_PLUGIN_VERSION_DELISTED
}

/**
 * 「企业设置 → 插件」目录此刻该说什么（纯投影，测试直调）：未登录 / 加载中 / 失败 / 空 / 就绪。
 *
 * 三态**互斥**由这个联合体保证：失败与空不可能同时成立（失败要在没有可渲染行时才算失败），
 * 因此「插件目录取数失败」不会再被显示成「暂无可用企业插件」那片空白。
 */
export type EnterprisePluginCatalogState =
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'empty'; readonly reason: 'catalog' | 'search' | 'installed' }
  | { readonly kind: 'ready' }

export function enterprisePluginCatalogState(input: {
  readonly connected: boolean
  readonly loading: boolean
  readonly errorCode?: string | undefined
  /** 过滤后真正要渲染的行数。 */
  readonly rowCount: number
  /** 未过滤的可用目录行数（用来把「目录为空」与「筛选后为空」分开说）。 */
  readonly catalogCount: number
  readonly searching: boolean
  readonly view: 'all' | 'installed'
}): EnterprisePluginCatalogState {
  if (!input.connected) return { kind: 'signed-out' }
  // 有行可渲染就是就绪（同一个失败码可能是行级动作失败，那由行上的提示负责，不把整列判成失败）。
  if (input.rowCount > 0) return { kind: 'ready' }
  // 一行都没有：先看是不是还在取数（重试在途也走这一支——用户点完立刻见到进行中态），再看失败，最后才是空。
  if (input.loading) return { kind: 'loading' }
  if (input.errorCode !== undefined) return { kind: 'failed', code: input.errorCode }
  if (input.catalogCount === 0) return { kind: 'empty', reason: 'catalog' }
  if (input.searching) return { kind: 'empty', reason: 'search' }
  return { kind: 'empty', reason: input.view === 'installed' ? 'installed' : 'catalog' }
}

/** 空态的三句「为什么空 + 下一步」（按原因取，不写成一坨三元表达式）。 */
export function enterprisePluginCatalogEmptyText(reason: 'catalog' | 'search' | 'installed'): string {
  if (reason === 'search') return ENTERPRISE_PLUGIN_LIST_EMPTY_SEARCH
  if (reason === 'installed') return ENTERPRISE_PLUGIN_LIST_EMPTY_INSTALLED
  return ENTERPRISE_PLUGIN_LIST_EMPTY_CATALOG
}

/**
 * 一行插件的**动作门禁**与**可见提示**（纯投影，测试直调）：卡片行、插件市场行与详情弹窗读的是同一份事实。
 *
 * 为什么要有它：动作控件动不了时必须**在界面上**说清为什么——原先这里只有 `title`（安装按钮一句
 * 「该插件当前不可安装」），正是产品宪法禁止的「死开关」。受管态 / 等重启 / 别的操作用着 / 状态读不到
 * 四件现场事实与目录判定经 `plugin-install-gate.ts` 的**唯一**判定折成禁用原因。
 *
 * **本刀（动作分流）**：这一行给哪一枚控件由 `slot` 说（`'install'` = 未安装 ⇒【＋】；
 * `'switch'` = 已安装 ⇒【开关】＝启用/停用）。三个坑位各自一份禁用原因：
 *  · `installLock` —— **目录判定会拦它**（不可安装就不给装）；
 *  · `switchLock` —— **目录判定不拦它**：已安装的行即使企业目录里已下架/判不可安装，
 *    用户仍要能把本机这一枚停掉（那是他的自救动作）；
 *  · `uninstallLock` —— 同 `switchLock`，目录判定同样不拦（卸载是自救动作的最后一格）。
 */
export interface EnterprisePluginRowGate {
  /** 这一行给哪一种控件（未安装 ⇒ ＋；已安装 ⇒ 开关）。 */
  readonly slot: EnterprisePluginRowAction
  /** 【＋】的禁用原因（`undefined` = 可点）。 */
  readonly installLock: EnterprisePluginLockReason | undefined
  /** 【开关】的禁用原因（`undefined` = 可拨）。 */
  readonly switchLock: EnterprisePluginLockReason | undefined
  /** 详情页【卸载】的禁用原因（`undefined` = 可点）；目录判定不拦卸载。 */
  readonly uninstallLock: EnterprisePluginLockReason | undefined
  /** 安装禁用时的可见一句话；`undefined` = 没有（可点，或原因由唯一提示组件说）。 */
  readonly installLockNotice: string | undefined
  /** 开关禁用时的可见一句话。 */
  readonly switchLockNotice: string | undefined
  /** 卸载禁用时的可见一句话。 */
  readonly uninstallLockNotice: string | undefined
  /** 【＋】的悬浮说明（补充，不替代上面那句）。 */
  readonly installTitle: string
  /** 【开关】的悬浮说明（按启停位说「点此停用 / 点此启用」）。 */
  readonly switchTitle: string
  /** 【卸载】的悬浮说明（它只在详情页出现）。 */
  readonly uninstallTitle: string
}

/**
 * 折出上面那份门禁的**唯一**入口。
 *
 * **与系统声明无关**：目录给的 `operatingSystems` 不进来、也不参与任何一步，
 * 所以「声明含当前平台 / 不含 / 根本没有该字段」三种形态在这一行上渲染结果逐字相同。
 *
 * @param input.item - 企业目录里的这一版（缺席 = 已下架，只剩本机记录）。
 * @param input.state - 本机受管态（无本机记录按 `EXPECTED`）。
 * @param input.enabled - 这一枚的启停位（未安装的行恒 `true`，它不渲染开关）。
 */
export function enterprisePluginRowGate(input: {
  readonly item?: { readonly installErrorCode?: string | undefined } | undefined
  readonly state: ManagedPluginState
  readonly installed: boolean
  readonly enabled: boolean
  readonly restartPending: boolean
  readonly busy: boolean
  readonly fatal: boolean
}): EnterprisePluginRowGate {
  const slot: EnterprisePluginRowAction = input.installed ? 'switch' : 'install'
  const installLock = enterprisePluginLockReason({
    hasAction: true,
    state: input.state,
    installErrorCode: input.item?.installErrorCode,
    restartPending: input.restartPending,
    busy: input.busy,
    fatal: input.fatal,
  })
  // 已安装那一行：目录判定**不**进这道门（不可安装 ≠ 不能停用）。
  const switchLock = enterprisePluginLockReason({
    hasAction: true,
    state: input.state,
    restartPending: input.restartPending,
    busy: input.busy,
    fatal: input.fatal,
  })
  const uninstallLock = enterprisePluginLockReason({
    hasAction: true,
    state: input.state,
    restartPending: input.restartPending,
    busy: input.busy,
    fatal: input.fatal,
  })
  return {
    slot,
    installLock,
    switchLock,
    uninstallLock,
    installLockNotice: enterprisePluginLockNotice(installLock),
    switchLockNotice: enterprisePluginLockNotice(switchLock),
    uninstallLockNotice: enterprisePluginLockNotice(uninstallLock),
    installTitle: enterprisePluginInstallTitle({
      lockReason: installLock,
      installErrorCode: input.item?.installErrorCode,
    }),
    switchTitle: enterprisePluginSwitchTitle({ enabled: input.enabled, lockReason: switchLock }),
    uninstallTitle: enterprisePluginUninstallTitle({ lockReason: uninstallLock }),
  }
}

/**
 * 卡片行上那句**可见**说明（这一行的动作为什么点不动）。
 * 没有要说的就整段不进 DOM；行落点用本页既有的次级文案类（`.own-market-sub`），不新增 CSS。
 */
export function EnterprisePluginGateNotes({ gate, subject }: {
  readonly gate: EnterprisePluginRowGate
  readonly subject: string
}): ReactNode {
  const notice = gate.slot === 'switch'
    ? gate.switchLockNotice
    : gate.installLockNotice
  if (notice === undefined) return null
  return (
    <div className="own-market-sub" role="status" data-enterprise-plugin-lock={subject}>{notice}</div>
  )
}

/**
 * 「**安装中**」那一条真进度（本页落点：卡片行与详情弹窗共用同一个入参形状）。
 *
 * 语义与官方插件页里那一条**逐项同源**（同一份 `plugin-install-progress.ts` 投影、同一串文案常量），
 * 只有承载类名不同——两份 `<style>` 都是全局单类选择器、类名必须与同包其他源文件零交集，
 * 故这里用它自己的 `own-plugin-progress*` 一族，而不是复用别页的类名（复用会互相覆盖）。
 * ① `role="progressbar"` 且**不给** `aria-valuenow`：这是「不知道还剩多少」的不确定态，
 *    `aria-valuetext` 里放**真阶段文字**，读屏因此听到「正在下载」而不是任何百分比；
 * ② `aria-live="polite"`：阶段一推进就播报；
 * ③ 那条流光 `aria-hidden`——动效只是"还在动"的暗示，关掉它（`prefers-reduced-motion`）信息一字不少。
 * 没有进度时整段不进 DOM。
 *
 * **本刀（真取消）**：`progress.cancelable` 为真时给一枚**真按钮**（官方 `Button` 原语，不新增任何 CSS 类），
 * 点它就是 `onCancel(name)` → store 的同源 `POST /plugins/cancel`；取消请求在途时按钮保持可见但 `disabled`
 * 并改文案为「正在取消…」（不是死控件：旁边那句进行态交代就是它的可见原因）。
 * 不能取消时**不画**按钮（那一刻点了也打不到东西），改画 `progress.cancelNotice` 那句可见原因；
 * 取消请求在途时同一落点换成「正在取消…」并以 `role="status"` 播报。
 * `onCancel` 缺席（纯函数直调 / 老调用方）时整枚按钮不渲染——照本仓「没写入口就不画死按钮」的降级口径。
 */
export function EnterprisePluginCardProgressNotes({ name, progress, onCancel }: {
  readonly name: string
  readonly progress: EnterprisePluginProgress | undefined
  readonly onCancel?: ((packageName: string) => void) | undefined
}): ReactNode {
  if (progress === undefined) return null
  return (
    <div
      className="own-plugin-progress"
      data-enterprise-plugin-progress={name}
      data-enterprise-plugin-progress-phase={progress.phase}
      data-enterprise-plugin-progress-stage={progress.state}
      data-enterprise-plugin-progress-indeterminate={progress.indeterminate ? 'true' : 'false'}
      data-enterprise-plugin-progress-cancelable={progress.cancelable ? 'true' : 'false'}
      data-enterprise-plugin-progress-canceling={progress.canceling ? 'true' : 'false'}
    >
      <span
        className="own-plugin-progressFlow"
        role="progressbar"
        aria-live="polite"
        aria-label={`${name} 安装进度`}
        aria-valuetext={progress.stageText}
      />
      <span className="own-plugin-progressText">{progress.stageText}</span>
      {progress.readFailedNotice === undefined ? null : (
        <span className="own-plugin-progressNote">{progress.readFailedNotice}</span>
      )}
      {/* 真取消入口：只有官方取消句柄真的在（`cancelable`）且写入口在场时才画。 */}
      {progress.cancelable && onCancel !== undefined ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={progress.canceling}
          title={progress.canceling ? ENTERPRISE_PLUGIN_PROGRESS_CANCELLING : `取消安装 ${name}`}
          aria-label={progress.canceling ? `正在取消 ${name} 的安装` : `取消安装 ${name}`}
          icon={<X size={14} aria-hidden />}
          onClick={() => { onCancel(name) }}
        >
          {progress.canceling ? '正在取消…' : '取消安装'}
        </Button>
      ) : null}
      {/* 取消不了就说清为什么（可见、不静默）；正在取消时这里是进行态并以 `role="status"` 播报。 */}
      {progress.cancelNotice === undefined ? null : (
        <span className="own-plugin-progressNote" role={progress.canceling ? 'status' : undefined}>
          {progress.cancelNotice}
        </span>
      )}
    </div>
  )
}

/**
 * 一次安装/卸载**刚结束**的落地交代（完成 / 需重启的明确收束）。
 *
 * `role="status"`（不是 `alert`）：不打断，但读屏要能接着进度那条收到「安装完成…」。
 * 失败不走这里——失败由本页既有的 `EnterpriseErrorNotice`（`role="alert"` + 稳定码）负责。
 */
export function EnterprisePluginCardSettledNote({ name, notice }: {
  readonly name: string
  readonly notice: string | undefined
}): ReactNode {
  if (notice === undefined) return null
  return (
    <div className="own-plugin-progressSettled" role="status" data-enterprise-plugin-settled={name}>{notice}</div>
  )
}

/**
 * 一行插件的进度与交代（本页唯一取值入口，卡片行与详情弹窗都调它，避免两处各算一份）。
 *
 * 阶段文字取 `STATES[state].title`——与卡片行页脚那句状态词**同一张表**，所以「行上说正在下载、
 * 进度说下载中」这种漂移在本页结构上不可能发生。
 */
function pluginProgressFacts(snapshot: {
  readonly pluginBusy?: EnterprisePluginBusyFact | undefined
  readonly pluginSettled?: EnterprisePluginSettledFact | undefined
  readonly pluginProgressErrorCode?: string | undefined
  readonly pluginCancelBusy?: { readonly packageName: string } | undefined
}, name: string, state: ManagedPluginState): {
  readonly progress: EnterprisePluginProgress | undefined
  readonly settledNotice: string | undefined
} {
  return {
    progress: enterprisePluginProgress({
      packageName: name,
      busy: snapshot.pluginBusy,
      state,
      stageText: STATES[state].title,
      readErrorCode: snapshot.pluginProgressErrorCode,
      // 取消请求在途那份事实也进来：它决定按钮是「可点」还是「正在取消…（不可用）」。
      cancelBusy: snapshot.pluginCancelBusy,
    }),
    settledNotice: enterprisePluginSettledNotice({ packageName: name, settled: snapshot.pluginSettled }),
  }
}

const bytes = (value: number) => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`

const styles = `
.own-market{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-market *{box-sizing:border-box}
.own-market-toolbar,.own-market-tabs,.own-market-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.own-market-tabs{border-bottom:1px solid var(--dsw-alias-border-l2,#e4e7ec);gap:20px;margin-bottom:18px}
.own-market-tabs button{color:var(--dsw-alias-label-secondary,#475467);font:inherit;border:0;border-bottom:2px solid transparent;background:none;padding:10px 0;cursor:pointer}
.own-market-tabs button[aria-pressed=true]{color:var(--dsw-alias-label-primary,#101828);border-bottom-color:var(--dsw-alias-brand-primary,#2563eb)}
.own-market-toolbar{margin-bottom:18px}.own-market-search{display:flex;align-items:center;gap:8px;flex:1;min-width:140px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);border-radius:6px;padding:0 10px;height:36px}
.own-market-search input{width:100%;min-width:0;border:0;background:none;color:inherit;font:inherit;outline:none}.own-market-search:focus-within{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:2px}
.own-market-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:12px}
.own-market-card{display:flex;flex-direction:column;gap:14px;min-width:0;padding:16px;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:8px;background:var(--dsw-alias-bg-layer-1,transparent)}
.own-market-card:focus-within,.own-market-card:hover{border-color:var(--dsw-alias-brand-primary,#2563eb)}
.own-market-title{display:flex;align-items:flex-start;gap:10px;color:inherit;text-align:left;border:0;padding:0;background:none;cursor:pointer;font:inherit;min-width:0;width:100%}
.own-market-glyph{display:grid;place-items:center;width:36px;height:36px;flex-shrink:0;border-radius:6px;background:var(--dsw-alias-bg-skeleton,#f2f4f7);color:var(--dsw-alias-label-secondary,#475467)}
.own-market-title strong{display:block;font-size:14px;line-height:21px;overflow-wrap:anywhere}.own-market-sub{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-market-card footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:auto;min-height:30px}
.own-market-empty{text-align:center;padding:44px 12px;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-notice{padding:10px 0;line-height:20px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-error{color:var(--dsw-alias-state-error-primary,#c4320a)}
.own-market-facts{display:grid;grid-template-columns:minmax(70px,auto) minmax(0,1fr);gap:12px 20px;font-size:13px;margin:0}.own-market-facts dt{color:var(--dsw-alias-label-secondary,#667085)}.own-market-facts dd{margin:0;overflow-wrap:anywhere}
/* ── 「安装中」那一条真进度（卡片行与详情弹窗共用） ───────────────────────────────
   类名带 own-plugin- 前缀：本页与官方插件页那份 style 都是全局单类选择器、又必须零交集，
   故这条进度用它自己的一族（与另一处那条 own-market-progress* 是**同一份投影、两个落点**）。
   画的是**不确定态**流光而不是会填满的进度条——这条链从 Host 只拿得到阶段、拿不到百分比
   （留档在 plugin-install-progress.ts 的文件头）；动效只是装饰，阶段文字是独立文本节点。 */
.own-plugin-progress{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;padding:2px 0}
.own-plugin-progressFlow{position:relative;display:block;flex:0 1 96px;width:96px;height:4px;border-radius:2px;background:var(--dsw-alias-bg-skeleton,#f2f4f7);overflow:hidden}
.own-plugin-progressFlow::after{content:'';position:absolute;top:0;bottom:0;width:40%;border-radius:2px;background:var(--dsw-alias-brand-primary,#2563eb);animation:own-plugin-progress-flow 1.3s ease-in-out infinite}
.own-plugin-progressText{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px}
.own-plugin-progressNote{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-plugin-progressSettled{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
@keyframes own-plugin-progress-flow{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
/* 尊重「减少动态效果」：滑动关掉、装饰层改成静态淡色；阶段文字与进度条语义一字不少。 */
@media (prefers-reduced-motion: reduce){.own-plugin-progressFlow::after{width:100%;opacity:.4;animation:none;transform:none}}
/* ── 未安装那一行那枚【＋】安装按钮（圆形图标按钮） ──────────────────────────────
   形态照 workdsh 技能市场卡片右侧那枚 ＋：源码 workdsh-web/packages/plugins/skills/src/client/
   SkillsPanel.tsx:275 的 <Button className="install">＋</Button> 与同包 styles.ts:144-147 的
   .wd-skills .install{display:grid;place-items:center;width:40px;min-height:40px;height:40px;padding:0;
   border-radius:50%;border:1px solid …;background:…;font-size:20px;line-height:1}、:hover:not(:disabled)
   与 :disabled{opacity:.45}。逐值搬过来，只把它用的 token 换成**本仓同一份官方 token 词表**里的同义项
   （三个名字本仓都有，本文件其余规则也照用），故圆角/尺寸/字号/悬停/禁用透明度与 workdsh 逐值一致。 */
.own-plugin-install{display:grid;place-items:center;width:40px;min-height:40px;height:40px;padding:0;border-radius:50%;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);background:var(--dsw-alias-bg-layer-2,#fff);font-size:20px;line-height:1}
.own-plugin-install:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,currentColor 8%,transparent));border-color:var(--dsw-alias-border-l2,#e4e7ec)}
.own-plugin-install:disabled{opacity:.45}
`

/**
 * **本页那份全局 CSS 的唯一出口**（本刀：官方插件页「插件市场」那一面的插件详情子页面）。
 *
 * 为什么需要它：「插件市场」那一面按用户口径接上插件详情**子页面**时，**原样复用**本文件的
 * `EnterprisePluginDetailPage`（不复制第二份实现）；而那枚组件的版面是照**这份**样式表写的
 * （`.own-market-toolbar` / `.own-market-facts` / `.own-market-actions` / `.own-plugin-progress*`），
 * 故那一面必须把它一并挂上——本文件不导出、那边就只能重写一份 CSS（本仓的样式纪律明确禁止复制）。
 *
 * 两处同页并存**不会互相覆盖**：本文件与 `marketplace-entry.tsx` 两份表的类名**零交集**
 * （由 `marketplace-entry.spec.ts` 的「类名隔离」源码级不变量逐类守着）。
 * 这里导出的就是**同一串字节**——CSS 一个字、一个类名都没动（本文件那份字节级基线照旧通过）。
 */
export const ENTERPRISE_PLUGIN_STYLES = styles

/**
 * 卡片**标题行 + 第二行**的唯一实现（纯函数、无 hook —— 测试可直接直调，卡片本体含 hook 直调不了）。
 *
 * 版式与取值：
 * · 标题行 = **标题 + 「企业」签 + 版本短号签**。标签的样式/机制**照技能卡片那一枚复用**：同一个官方 `Tag`
 *   原语、同一串类名（`.own-market-tag` / `.own-market-skillVersionTag`）、同一个 tone（企业=info、版本=neutral）；
 *   版本字面仍取 `enterpriseMarketVersionTag` 的 `v{version}`（官方 badge 槽同一枚字面），故版本信息
 *   从第二行搬到这枚签上**一个字都没丢**（详情弹窗的「企业版本」那一格照旧）。
 *   `.own-market-tag` 的**声明**只有 `marketplace-entry.tsx` 一处（那份 CSS 在这个表面不挂载），故这行
 *   的 flex 版式用**同一组取值的内联布局**表达（display/gap/minWidth，无颜色无字号）——**不新增 CSS 类**。
 * · **标题取值 = 插件名称**（制品 `package.json` 的 `displayName`），经叶子唯一投影
 *   `enterprisePluginDisplayName`：有显示名用显示名，**缺席/空白回退包名**（不空白、不编造）——
 *   与「插件市场」插件行、详情弹窗读的是**同一份**投影，三处不可能漂成三个名。
 * · 第二行 = **插件描述**；没有描述按 `enterprisePluginDescriptionText` 如实降级成「暂无描述」
 *   （不空白、不编造、不拿版本充数）。
 */
export function EnterprisePluginCardHead({ displayName, packageName, version, description }: {
  readonly displayName?: string | null | undefined
  readonly packageName: string
  readonly version: string | null | undefined
  readonly description: string | null | undefined
}): ReactNode {
  const versionLabel = enterpriseMarketVersionTag(version ?? undefined)
  // 标题的唯一取值点（显示名 → 缺省回退包名）；无障碍名与可见标题都从这一枚 `title` 派生，不许各算一份。
  const title = enterprisePluginDisplayName(displayName, packageName)
  return (
    <span style={{ minWidth: 0 }}>
      {/* 标题先行、标题先让步：标题可换行（`.own-market-title strong` 的 overflow-wrap:anywhere），
          两枚签 flex:none 保持完整可见。 */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <strong style={{ minWidth: 0 }}>{title}</strong>
        <EnterpriseMarketBadgeTag />
        {versionLabel === undefined ? null : (
          <Tag className="own-market-tag own-market-skillVersionTag" tone="neutral">{versionLabel}</Tag>
        )}
      </span>
      <span className="own-market-sub">{enterprisePluginDescriptionText(description)}</span>
    </span>
  )
}

/**
 * 「企业设置 → 插件」卡片**标题按钮**的唯一实现（纯函数、无 hook —— 测试可直接直调）。
 *
 * 用户口径「点击（标题）显示详情页」在这里落成**真 `<button>`**（不是 `<span>`）：键盘可达、焦点环与
 * Enter/Space 激活全部来自浏览器原生按钮语义——与官方插件页的技能行 / 配方行
 * （`marketplace-entry.tsx` 的 `.own-market-rowOpen` 按钮）**同款**，**不自造第二套键盘实现**
 * （没有额外 keydown 监听、没有 tabIndex/role 手写复刻）。
 *
 * 无障碍名固定为「查看 <名称> 的详情」，其中 <名称> 与可见标题是**同一枚投影**
 * （`enterprisePluginDisplayName`）——读屏听到的名字与用户看到的字永远一致；点它把内容区**整段换成**该插件的
 * 详情**子页面**（列表里没有第二处详情入口；市场面插件行没有详情页，见 marketplace-entry 头注）。
 *
 * ★**没有弹窗语义**：`aria-haspopup="dialog"` 已删除（本刀前它挂在这里、因为详情确实是一枚弹窗）——
 * 现在这枚按钮是把内容区换成子页面，不是弹出浮层，`aria-haspopup` 说什么都是错的，故一个都不留
 * （由 `tests/plugin-card.spec.ts` 锁死）。
 *
 * `onOpen` 缺席时 disabled + 说明性 `title`：照本文件与技能/配方行的既有降级口径，**不给死按钮**
 * （点了没反应又不说为什么才是死控件；这里点不动但说得出原因）。正常运行时它恒被注入。
 */
export function EnterprisePluginCardTitle({
  name, displayName, packageName, version, description, onOpen,
}: {
  /** 本行的真实键（包名）：点击回调回传它，与 `openDetail`/目录查表同一把钥匙。 */
  readonly name: string
  readonly displayName?: string | null | undefined
  readonly packageName: string
  readonly version: string | null | undefined
  readonly description: string | null | undefined
  readonly onOpen?: ((packageName: string) => void) | undefined
}): ReactNode {
  const title = enterprisePluginDisplayName(displayName, packageName)
  return (
    <button
      type="button"
      className="own-market-title"
      data-enterprise-plugin-open={name}
      // 无障碍名 = 动作 + 名称 + 结果（与技能/配方行的 `查看…详情` 同一句式）。
      aria-label={`查看 ${title} 的详情`}
      title={onOpen === undefined ? '详情入口未接通' : '查看详情'}
      disabled={onOpen === undefined}
      onClick={() => { onOpen?.(name) }}
    >
      <span className="own-market-glyph"><Package size={20} aria-hidden /></span>
      <EnterprisePluginCardHead
        displayName={displayName}
        packageName={packageName}
        version={version}
        description={description}
      />
    </button>
  )
}

/**
 * 进入详情前那一刻「真的会滚」的那个祖先（最近的一个 `overflow-y: auto|scroll` 且内容确实超高的元素）；
 * 一个都没有就退到整页滚动容器。
 *
 * 为什么要它：列表被详情替换后内容变矮，浏览器会把这个容器的 `scrollTop` **夹回去**；
 * 所以必须在**点击那一刻**把真值读下来，返回时按同一把引用写回去 —— 用户回到列表时还在原位。
 * 它是纯读（不写 DOM、不发请求），读写的一生只有 `openDetail` / 返回那一个 `useLayoutEffect`。
 *
 * **导出**：官方插件页「插件市场」那一面的插件详情子页面（`marketplace-entry.tsx`）要还原同一个位置，
 * 用的必须是**同一条**判定（「最近的那个真会滚的祖先」）——两面各写一份实现迟早会一处还原一处不还原。
 */
export function scrollTargetOf(node: HTMLElement | null): HTMLElement | undefined {
  let current = node?.parentElement ?? undefined
  while (current !== undefined) {
    if (current.scrollHeight > current.clientHeight) {
      const overflow = window.getComputedStyle(current).overflowY
      if (overflow === 'auto' || overflow === 'scroll') return current
    }
    current = current.parentElement ?? undefined
  }
  const scrolling = document.scrollingElement
  return scrolling instanceof HTMLElement ? scrolling : undefined
}

/**
 * 「企业设置 → 插件」的**详情子页面**（纯函数、无 hook —— 测试可直接直调，卡片本体含 hook 直调不了）。
 *
 * 用户口径：详情要是**子页面**、不是弹窗。故这一支**没有** `<Modal>`、没有 `role="dialog"`、
 * 没有遮罩、没有 portal：它就是内容区里的一块普通内容（外壳那一支把列表整段换掉，见
 * `EnterprisePluginContentRegion`），与技能/配方详情的形态**完全一致**（那边也是整页切换）。
 *
 * 详情内容**逐字段、逐顺序**复用改动前弹窗里那一份（`<dl class="own-market-facts">`）：插件 / 企业版本 /
 * 本机版本 / 发布方 /（大小）/（安装状态）/（暂时不能安装）——字段一个不少、顺序不变、文案一个字不改；
 * 进度与落地交代也是同一份投影，动作区（更新版本 / 【卸载】+ 二次确认）由持有写入口的页面注入
 * （`props.actions`），故**卸载入口与二次确认照旧**，且`ConfirmAction` 那枚确认框**仍然是弹窗**（用户只要求
 * 详情不是弹窗，破坏性动作的确认框该弹出式就得弹出式）。
 *
 * 无障碍：整块是 `role="region"` + 「插件详情：<名称>」的无障碍名；可见标题那枚 `h3` 带 `tabIndex={-1}`，
 * 是**进入详情时的程序化聚焦点**（读屏立刻报出「插件详情」，且它不进 Tab 序、不抢键盘操作）；
 * 左上角【返回】是一枚真按钮（`aria-label` 给完整动作语义「返回插件列表」），键盘可达。
 *
 * 样式：**一个新 CSS 类都没加**——返回行/动作行用本页既有的 `.own-market-toolbar`/`.own-market-actions`，
 * 事实表用既有 `.own-market-facts`，进度用既有 `.own-plugin-progress*`；chevron 的 90° 旋转是内联版式。
 *
 * **描述（用户口径第 19 条 → 第 20 条）**：事实表**之后**那一段「描述」只在 `props.description` 有真值时才进 DOM
 * （取值经 `enterprisePluginDetailDescription`，缺失 ⇒ `undefined` ⇒ 整段不出现，**不留空壳**）；
 * 纯文本子节点渲染（无 `dangerouslySetInnerHTML`）、`pre-wrap` 保留原始换行、`overflow-wrap:anywhere`
 * 挡长串英文，高度上限 12 行 × 20px = 240px、超出在块内滚动读全（不截断）。该 prop 是 **additive** 的：
 * face A 不传 ⇒ 本组件渲染出的东西与改动前**逐字相同**（`plugin-card.spec.ts` 的详情大纲逐字快照）。
 * **口径 20 只换这一段的内容来源**（face B 那一侧改为「有 README 就用 README，没有才回落短描述」，
 * 判定点唯一在 `enterpriseMarketPluginDetailBody`），本组件的渲染方式与版式**一字未动**：
 * README 同样当纯文本、同样保换行、同样只做版式限长——不解析 Markdown、不新增依赖、不注入 HTML。
 *
 * **口径 22（README 渲染成 Markdown 排版）**：上面那句「不解析 Markdown」**只对缺省路径成立**——
 * 新增的可选 prop `descriptionMarkdown` 为真时，正文改由 `markdown-render.tsx` 的 `renderMarkdown`
 * 翻成 React 元素（**唯一的 Markdown 解析点**，本组件只决定「这一段用哪种版式」）；
 * 该 prop 缺省（face A 从来不传）⇒ 走原来的纯文本子节点路径，输出**逐字不变**。
 * 版式切换不动容器：`.own-market-notice`、12 行×20px=240px 块内滚动、`overflow-wrap:anywhere` 全不变。
 */
export interface EnterprisePluginDetailPageProps {
  /** 本页的真实键（包名）：进详情的唯一钥匙，也是进度/动作归行的那把钥匙。 */
  readonly packageName: string
  readonly displayName?: string | null | undefined
  /**
   * 详情「描述」段的**正文**（这一段只认「有没有值」，不关心它来自哪一枚字段）。
   *
   * **可选、additive**：只有官方插件页「插件市场」那一面（face B）传真值——它把详情接上这一面之后，
   * 详情里原先只有事实表、没有描述；「企业设置 → 插件」那一面（face A）**不传** ⇒ 这一段整段不进 DOM，
   * face A 的详情输出**逐字不变**（由 `plugin-card.spec.ts` 的详情大纲逐字快照锁着）。缺失（缺席 / null /
   * 空串 / 纯空白）一律整段不出现，**不渲染「暂无描述」空壳**（那是卡片第二行的口径，不是详情里的）。
   *
   * **口径 20 起，face B 传进来的不再一定是那枚短描述**：它现在由 face B 的唯一投影
   * `enterpriseMarketPluginDetailBody(readme, description)` 决定——**有 README 就给 README**，
   * 没有才回落到制品 `package.json` 的短 `description`（契约 `PluginDescription`，≤1000）。
   * 故这里收到的正文可能是整篇 README（≤65536，含原始换行与 Markdown 记号）——本组件**一律当纯文本**：
   * 不解析 Markdown、不查标签、`dangerouslySetInnerHTML` 全文件零出现，换行靠 `pre-wrap` 原样保留。
   * face A 仍不传这个 prop，它的输出与口径 19 逐字相同（additive 例外，同口径 18③）。
   * **口径 22 起**：正文要不要按 Markdown 排版由下面的 `descriptionMarkdown` 决定——本 prop 的语义
   * （「这一段有没有正文」与「正文是什么」）**一个字没变**，只是多了一条版式开关。
   */
  readonly description?: string | undefined
  /**
   * 「描述」段的**版式**（用户口径第 22 条）——`true` = 正文按 **Markdown 排版**（`renderMarkdown`），
   * 缺省 / `false` = 与口径 19/20 **逐字相同**的纯文本子节点路径。
   *
   * **可选、additive、缺省为假**：face A（企业设置 → 插件）**不传** ⇒ 它的详情输出逐字不变
   * （`plugin-card.spec.ts` 的详情大纲逐字快照 708 / 2780040711 原样通过）；face B 只在**正文真的来自
   * README** 时传 `true`（判定点唯一在 face B 的 `enterpriseMarketPluginDetailMarkdown(readme)`），
   * 回落到短描述时仍传假 ⇒ 那一支的版式**一个字都没改**。
   *
   * 为真时正文仍走下面那枚 `enterprisePluginDetailDescription` 归一（空串/纯空白 ⇒ 整段不出现），
   * 渲染交给 `markdown-render.tsx`：raw HTML 当纯文本、`javascript:`/`data:` 链接降级为文字、
   * 图片不当图片加载、**没有**任何 HTML 注入口，且解析器有深度的步数预算（病态输入不会卡住界面）。
   */
  readonly descriptionMarkdown?: boolean | undefined
  /** 「企业版本」那一格的取值（由 `enterprisePluginCatalogVersionText` 唯一投影算出后传进来）。 */
  readonly catalogVersionText: string
  /** 「本机版本」那两个分支的现场事实（与改动前弹窗里那条三元表达式**逐字同构**）。 */
  readonly installed: boolean
  readonly installedVersion?: string | null | undefined
  /** 只在目录里还有这一版时才有（已下架时「大小」那一格整格不出）。 */
  readonly sizeBytes?: number | undefined
  /** 目录判定给的稳定码（有才出「安装状态」那一格）。 */
  readonly installErrorCode?: string | undefined
  /** 门禁给的可见原因（有才出「暂时不能安装」那一格，不许只挂 title）。 */
  readonly installLockNotice?: string | undefined
  readonly progress?: EnterprisePluginProgress | undefined
  readonly settledNotice?: string | undefined
  /** 【返回】的唯一动作（清掉详情目标即回列表）。 */
  readonly onBack: () => void
  /** 进度条上的真取消入口（与卡片行同一个写入口）。 */
  readonly onCancelInstall?: ((packageName: string) => void) | undefined
  /** 详情里的动作区（更新版本 / 卸载 + 二次确认）——由持有写入口的页面注入，纯组件不自造写入口。 */
  readonly actions: ReactNode
  /** 详情容器（进入详情时程序化聚焦的落点范围；纯函数直调时不传）。 */
  readonly pageRef?: Ref<HTMLDivElement> | undefined
}

export function EnterprisePluginDetailPage(props: EnterprisePluginDetailPageProps): ReactNode {
  const title = enterprisePluginDisplayName(props.displayName, props.packageName)
  // 描述先过唯一那枚投影：没有（含空串/纯空白）就是 `undefined`，下面那一整段据此**整段不进 DOM**。
  const description = enterprisePluginDetailDescription(props.description)
  // 口径 22 的版式开关：**只有正文在场、且调用方明说它是 README** 时才按 Markdown 排版；
  // 缺省（face A 永远如此）与「正文来自短描述」两种情形都走原来的纯文本路径，输出逐字不变。
  const descriptionIsMarkdown = description !== undefined && props.descriptionMarkdown === true
  return (
    <div
      ref={props.pageRef}
      data-enterprise-plugin-detail={props.packageName}
      role="region"
      aria-label={`${ENTERPRISE_PLUGIN_DETAIL_TITLE}：${title}`}
    >
      {/* ① 左上角【返回】：真按钮 + 完整动作语义的无障碍名（键盘可达、Enter/Space 激活走浏览器原生语义）。 */}
      <div className="own-market-toolbar">
        <Button
          size="sm"
          variant="ghost"
          icon={<ChevronDown size={14} aria-hidden style={{ transform: 'rotate(90deg)' }} />}
          aria-label={ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL}
          title={ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL}
          data-enterprise-plugin-detail-back=""
          onClick={() => { props.onBack() }}
        >
          {ENTERPRISE_PLUGIN_DETAIL_BACK_TEXT}
        </Button>
      </div>
      {/* ② 可见标题：**进入详情时的焦点落点**（`tabIndex=-1` 只为程序化聚焦，不进 Tab 序）。 */}
      <h3 tabIndex={-1} data-enterprise-plugin-detail-title="" style={{ margin: 0 }}>{ENTERPRISE_PLUGIN_DETAIL_TITLE}</h3>
      {/* ③ 事实表：与改动前弹窗那一份**逐字段、逐顺序**相同（这就是「详情内容原样复用」本身）。 */}
      <dl className="own-market-facts">
        <dt>插件</dt><dd>{title}</dd>
        <dt>企业版本</dt><dd>{props.catalogVersionText}</dd>
        <dt>本机版本</dt><dd>{props.installed ? props.installedVersion : ENTERPRISE_PLUGIN_DETAIL_NOT_INSTALLED}</dd>
        <dt>发布方</dt><dd>{ENTERPRISE_PLUGIN_DETAIL_PUBLISHER}</dd>
        {props.sizeBytes === undefined ? null : <><dt>大小</dt><dd>{bytes(props.sizeBytes)}</dd></>}
        {props.installErrorCode === undefined ? null : <><dt>安装状态</dt><dd><EnterpriseErrorNotice code={props.installErrorCode} /></dd></>}
        {props.installLockNotice === undefined ? null : <><dt>暂时不能安装</dt><dd>{props.installLockNotice}</dd></>}
      </dl>
      {/* ③bis 【描述】：排在事实表**之后**（既有版式一字不动），只有传真值时才进 DOM。
          ① 缺省路径是纯文本子节点渲染（全文件无 `dangerouslySetInnerHTML`，见 `plugin-card.spec.ts` 的源码级锁）；
             ★口径 22：`descriptionMarkdown` 为真（正文来自 README）时改由 `renderMarkdown` 出 React 元素
             （仍无任何 HTML 注入口：raw HTML 当文字、图片不当图片、非法协议链接降级为文字）；
          ② `whiteSpace:'pre-wrap'` **保留原始换行**（纯文本路径；Markdown 路径的块级元素自带间距）；
          ③ `overflowWrap:'anywhere'` 让长串英文/URL 不撑破版面；
          ④ 高度上限 = 12 行 × 20px = 240px（常量在文件上方，理由写在 `_MAX_LINES` 上），
             超出在块内 `overflowY:'auto'` 滚动读全——**不截断、不折叠、不丢字**；
          ⑤ 用的还是本页既有的文案类 `.own-market-notice`（padding / line-height / 次级色 / 可换行），
             **一个新 CSS 类都没加**（`plugin-card.spec.ts` 的「每个 className 都已被本文件声明」集合判据守着）。 */}
      {description === undefined ? null : (
        <section className="own-market-notice" data-enterprise-plugin-detail-description="">
          <h4 style={{ margin: 0, fontSize: 13, lineHeight: `${ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LINE_HEIGHT}px` }}>
            {ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LABEL}
          </h4>
          <div
            data-enterprise-plugin-detail-description-text=""
            /* 版式标记：为真时这一段是 Markdown 渲染面（`undefined` 时 React 不写这个属性，纯文本路径一字不变）。 */
            data-enterprise-plugin-markdown={descriptionIsMarkdown ? '' : undefined}
            /* 可聚焦：这一段在长描述时是**可滚动区**，键盘用户必须能滚着把剩下的字读完（WCAG 2.1.1）。 */
            tabIndex={0}
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_HEIGHT,
              overflowY: 'auto',
            }}
          >{descriptionIsMarkdown ? renderMarkdown(description) : description}</div>
        </section>
      )}
      {/* ④ 详情里的进度与落地交代：与卡片行**同一份**投影、同一个取消写入口（不会「行上在装、详情说没在装」）。 */}
      <EnterprisePluginCardProgressNotes name={props.packageName} progress={props.progress} onCancel={props.onCancelInstall} />
      <EnterprisePluginCardSettledNote name={props.packageName} notice={props.settledNotice} />
      {/* ⑤ 动作区（更新版本 / 【卸载】+ 二次确认）：注入式，故确认框仍走官方 Modal，本支一个 `Modal` 都没有。 */}
      {props.actions}
    </div>
  )
}

/**
 * 内容区的**唯一容器**（纯函数、测试可直接直调）：列表与详情**互斥**——详情在场时列表整段不进 DOM
 * （`detail ?? list`，不是叠一层、没有遮罩、没有 portal）。
 *
 * 它就是「详情占据内容区、列表区域被详情子页面替换」这句话的机器判据：两个分支共用**同一个**返回节点，
 * 故测试可以断言「详情分支里那棵列表树一个元素都不在」而同时「两侧都在这一个容器内」。
 * 页头与标签栏（全部插件 / 已安装 / 搜索工具条）在这个容器**之上**，两态都不动。
 */
export function EnterprisePluginContentRegion({ detail, list }: {
  readonly detail?: ReactNode | undefined
  readonly list: ReactNode
}): ReactNode {
  return <div data-enterprise-plugin-region={detail === undefined ? 'list' : 'detail'}>{detail ?? list}</div>
}

export function EnterprisePluginMarket({ store }: {
  readonly store: EnterpriseAccountStore
}): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [view, setView] = useState<'all' | 'installed'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string>()
  /** 本页根节点（Esc 的监听范围钉在这里：只在插件页里生效，不抢别处的 Esc）。 */
  const root = useRef<HTMLElement>(null)
  /** 详情容器：进入详情时那个 `useLayoutEffect` 从这里取焦点落点（就是它里面的详情标题）。 */
  const page = useRef<HTMLDivElement>(null)
  /** 进详情前那一刻的滚动位置（点击那一下读，之后列表就被替换了）。 */
  const scrollMemory = useRef<{ readonly target: HTMLElement; readonly top: number } | undefined>(undefined)
  /** 是哪一行的标题开的详情：返回时按**名字**把焦点还给它。 */
  const opener = useRef<string | undefined>(undefined)
  /**
   * 【返回】的两条真路径：① 详情页左上角那枚返回按钮（`onBack`）；② Esc。
   *
   * 监听钉在本页根节点上（不是 `document`）：只有焦点落在插件页里时 Esc 才回列表，不去抢别的面板的 Esc；
   * 命中后 `stopPropagation`，免得这一下继续冒泡把整个设置页也关掉。
   * **浏览器返回键没接** —— 本页是官方 `plugins.item` 的 page 视图、**没有真实路由**（与技能/配方详情同一形态，
   * 见 `marketplace-entry.tsx` 头注），硬造 `history` 会与宿主自己的返回处理打架；故这里**不假装有路由**
   * （「不许出现 pushState/popstate」由测试守着），如实只给返回按钮 + Esc 两条路。
   */
  useEffect(() => {
    if (selected === undefined) return
    const node = root.current
    if (node === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setSelected(undefined)
    }
    node.addEventListener('keydown', onKeyDown)
    return () => { node.removeEventListener('keydown', onKeyDown) }
  }, [selected])
  /**
   * 进入详情：焦点落到详情标题（`tabIndex={-1}` 的程序化聚焦点），读屏因此立刻报出「插件详情」。
   * 用 `useLayoutEffect`：在浏览器绘制前就把焦点放好，用户不会看到「焦点还留在已经不在的那枚按钮上」
   * 那一帧（也不必自造 `autoFocus`/tabIndex 之外的第二套聚焦机制）。
   */
  useLayoutEffect(() => {
    if (selected === undefined) return
    page.current?.querySelector<HTMLElement>('[data-enterprise-plugin-detail-title]')?.focus()
  }, [selected])
  /**
   * 返回：把滚动位置与焦点**还原到进入详情前那一眼**（`useLayoutEffect` 在绘制前落定，看不见跳动）。
   *
   * 焦点按**名字**找回那一枚标题按钮（不是按旧 DOM 引用）：返回时列表是**重新挂载**的，进入详情前那个 DOM
   * 节点已经不可用（`isConnected === false`），照旧引用 focus 会静默失败。
   */
  useLayoutEffect(() => {
    if (selected !== undefined) return
    const saved = scrollMemory.current
    scrollMemory.current = undefined
    if (saved !== undefined && saved.target.isConnected) saved.target.scrollTop = saved.top
    const name = opener.current
    opener.current = undefined
    if (name === undefined) return
    const buttons = root.current?.querySelectorAll<HTMLElement>('[data-enterprise-plugin-open]')
    if (buttons === undefined) return
    for (const button of buttons) {
      if (button.dataset['enterprisePluginOpen'] === name) { button.focus(); return }
    }
  }, [selected])
  const status = snapshot.pluginStatus
  const connected = snapshot.status?.state === 'READY' || snapshot.status?.state === 'REFRESHING'
  const catalog = connected ? status?.catalog ?? [] : []
  const local = new Map((connected ? status?.plugins ?? [] : []).map(item => [item.packageName, item]))
  const available = new Map(catalog.map(item => [item.packageName, item]))
  const names = [...new Set([...available.keys(), ...local.keys()])]
  /**
   * 「这一行装没装」与「这一枚启用着吗」——两件**正交**事实，各自只有一处取值：
   * 「装没装」只认本机记录（`plugin-install-gate.ts` 的唯一判定：`desiredState` + 已落盘版本）；
   * 「启用着吗」只认记录里那一枚启停位（Host 的 `enabled`；旧 Host 不带这个键时解码层已归一成 `true`）。
   * 目录里的版本**不**参与「装没装」：失败的首装记录里 `version` 是 `null`，那一行要给的
   * 是「重试安装」（【＋】），不是一枚看起来装着却没在跑的开关。
   */
  const isInstalled = (name: string): boolean => enterprisePluginInstalled({
    desiredState: local.get(name)?.desiredState,
    version: local.get(name)?.version,
    state: local.get(name)?.state ?? 'EXPECTED',
  })
  const enabledOf = (name: string): boolean => local.get(name)?.enabled ?? true
  const rows = names.filter(name => (view === 'all' || isInstalled(name)) && name.toLowerCase().includes(query.trim().toLowerCase()))

  const busy = snapshot.pluginBusy !== undefined || snapshot.busy !== undefined
  const fatal = status?.fatalErrorCode
  // 目录失败码：`fatal` 是「状态本身都读不到」，`pluginErrorCode` 是插件投影那一次取数/动作的失败码。
  const catalogErrorCode = snapshot.pluginErrorCode ?? fatal
  // 目录四态（纯投影）：有行就绪；一行都没有时按「在途 → 失败 → 空（说清为什么空）」逐级判定。
  const catalogState = enterprisePluginCatalogState({
    connected,
    loading: snapshot.pluginsLoading === true,
    errorCode: catalogErrorCode,
    rowCount: rows.length,
    catalogCount: catalog.length,
    searching: query.trim() !== '',
    view,
  })
  const selectedItem = selected === undefined ? undefined : available.get(selected)
  const selectedLocal = selected === undefined ? undefined : local.get(selected)
  const restartRequired = [...local.values()].some(item => item.state === 'RESTART_REQUIRED')
  /**
   * 一行插件的动作门禁（纯投影的唯一入口）。`!connected` 不在这里：连不上企业服务时
   * `catalog`/`local` 两张表都是空的（`connected ? … : []`，见上面），一行都渲染不出来，
   * 那个条件在**任何可达路径上**都不可能命中——留着只会让「禁用了却没解释」多一个隐分支。
   * **平台不进来**：目录声明的 `operatingSystems` 谁都不读，三行禁用的成因只有目录判定 / 在途 / 等重启 / 忙 / 读不到。
   */
  const gateFor = (name: string): EnterprisePluginRowGate => enterprisePluginRowGate({
    item: available.get(name),
    state: local.get(name)?.state ?? 'EXPECTED',
    installed: isInstalled(name),
    enabled: enabledOf(name),
    restartPending: local.get(name)?.state === 'RESTART_REQUIRED',
    busy,
    fatal: fatal !== undefined,
  })
  /**
   * 一行插件的**真进度**与落地交代（本页唯一取值入口）。
   * 入参是同一份 store 快照（在途动作 / 轮询刷新的真实受管态 / 那一路读不到的码），
   * 卡片行与详情子页面都调它，故两处不可能各算一份进度。
   */
  const progressFor = (name: string): { readonly progress: EnterprisePluginProgress | undefined; readonly settledNotice: string | undefined } =>
    pluginProgressFacts(snapshot, name, local.get(name)?.state ?? 'EXPECTED')
  /**
   * 取消在途安装的唯一写入口（卡片行与详情子页面共用这一枚）。
   *
   * 失败不外抛也不吞：store 把稳定码写进 `pluginErrorCode`，本页已有那条失败提示会把它原样呈现，
   * 而按钮仍在（状态没变）⇒ 用户直接再点一次就是重试。
   */
  const cancelInstall = (name: string): void => { void store.cancelPlugin(name) }
  /**
   * 打开详情（卡片标题那枚按钮的唯一回调）：**在点击这一刻**把两件事记下来 ——
   *  ① 滚动位置（列表一被替换，浏览器就会把容器的 `scrollTop` 夹回去，事后再读就晚了）；
   *  ② 是哪一行开的详情（返回时列表是重新挂载的，旧 DOM 引用已经不可用，故记**名字**）。
   */
  const openDetail = (packageName: string): void => {
    const target = scrollTargetOf(root.current)
    scrollMemory.current = target === undefined ? undefined : { target, top: target.scrollTop }
    opener.current = packageName
    setSelected(packageName)
  }
  /** 【返回】的唯一动作：清掉详情目标，列表自然回来（滚动位置与焦点由那个 `useLayoutEffect` 还原）。 */
  const closeDetail = (): void => { setSelected(undefined) }
  /** 详情那一行的进度/交代（没开详情就是 `undefined`，连算都不用算）。 */
  const detailPending = selected === undefined ? undefined : progressFor(selected)
  /**
   * **列表行**的动作区（唯一分流点）：未安装 ⇒ 一枚【＋】图标按钮；已安装 ⇒ 一枚【开关】＝启用/停用。
   *
   * 三件刻意的事，都照用户口径钉死：
   *  ① 【＋】是**图标按钮**（可见文案只有一枚 ＋），语义由无障碍名 `enterprisePluginInstallLabel`
   *     承载、鼠标悬停另有一句 `title`（样式照 workdsh 技能市场卡片右侧那枚 ＋：圆形、40×40、
   *     20px 字号、1px 边线、悬停换背景——本页复用它已有的 token，故 CSS 一字未改，
   *     只用既有类名 + 内联版式表达）。
   *  ② 已安装那一枚是**开关**，关掉它走 `store.setPluginEnabled(name,false)` ＝ **停用**，
   *     **绝不**卸载（卸载那条路只在详情弹窗里，见 `detailActions`）。
   *  ③ 安装中 / 停用中 / 失败一律**沿用既有态**：进度条、真取消、失败提示与可重试都在原地，
   *     本函数不自造第二套。
   */
  const rowActions = (name: string) => {
    const item = available.get(name)
    const record = local.get(name)
    const gate = gateFor(name)
    if (gate.slot === 'install') {
      // 未安装：目录里没有这一版（已下架）时不给死按钮——一枚点不动的 ＋ 什么也不说明。
      if (item === undefined) return <div className="own-market-actions" />
      return <div className="own-market-actions">
        <Button
          size="sm"
          variant="outline"
          disabled={gate.installLock !== undefined}
          title={gate.installTitle}
          aria-label={enterprisePluginInstallLabel(name)}
          className="own-plugin-install"
          data-enterprise-plugin-slot="install"
          onClick={() => { void store.installPlugin(name, item.pluginVersionId) }}
        >
          ＋
        </Button>
      </div>
    }
    // 已安装：一枚开关。`checked` 是**启停位**（不是「装没装」——装没装已经由分流决定）。
    return <div className="own-market-actions">
      <Switch
        checked={enabledOf(name)}
        label={`启用 ${name}`}
        disabled={gate.switchLock !== undefined}
        title={gate.switchTitle}
        data-enterprise-plugin-slot="switch"
        onChange={(next) => { void store.setPluginEnabled(name, next) }}
      />
    </div>
  }
  /**
   * **详情弹窗**的动作区：列表行不允许出现的两件事都在这里。
   *
   *  · 更新到目录当前版本（已安装且目录里有**别的**版本时才给）；
   *  · 【卸载】——**破坏性**操作：带确认（`ConfirmAction`）且确认弹窗里**说清影响**
   *    （`ENTERPRISE_PLUGIN_UNINSTALL_IMPACT`：移除范围、企业侧分配不受影响、以后要重新下载）。
   *    「卸载只在详情页给」这一条就是本函数与 `rowActions` 的分工本身。
   */
  const detailActions = (name: string) => {
    const item = available.get(name)
    const record = local.get(name)
    const gate = gateFor(name)
    const updatable = isInstalled(name) && item !== undefined && record?.version !== item.version
    return <div className="own-market-actions">
      {updatable ? <Button size="sm" variant="outline"
        disabled={gate.installLock !== undefined}
        title={gate.installTitle}
        icon={<Download size={14} aria-hidden />}
        onClick={() => { void store.installPlugin(name, item.pluginVersionId) }}>
        {snapshot.pluginBusy?.packageName === name && snapshot.pluginBusy.action === 'install' ? '正在安装' : '更新版本'}
      </Button> : null}
      {isInstalled(name) ? <ConfirmAction
        title={ENTERPRISE_PLUGIN_UNINSTALL_TITLE}
        description={ENTERPRISE_PLUGIN_UNINSTALL_IMPACT}
        confirmLabel="确认卸载"
        disabled={gate.uninstallLock !== undefined}
        onConfirm={() => { setSelected(undefined); void store.removePlugin(name) }}>
        {open => <Button size="sm" variant="ghost"
          aria-label={enterprisePluginUninstallLabel(name)}
          title={gate.uninstallTitle}
          disabled={gate.uninstallLock !== undefined}
          icon={<Trash2 size={14} aria-hidden />} onClick={open} />}
      </ConfirmAction> : null}
    </div>
  }
  /**
   * 详情**子页面**的入参（唯一构造点就在这里）：每一件事实都从本页已有的那份投影读出，
   * 与卡片行同一把钥匙、同一份 store 快照 —— 不存在第二套详情数据。
   * 动作区（更新版本 / 【卸载】+ 二次确认）注入的是同一枚 `detailActions`（写入口只有一处）。
   *
   * 连不上企业服务时（`connected === false`）**不画详情**：那一刻目录与本机两张表都是空的，
   * 画出来只会是一份「已下架 + 未安装」的假详情 —— 与改动前那枚弹窗 `open={connected && …}` 同一条口径。
   * 详情内容那一格「插件」读的仍是**同一枚**叶子投影 `enterprisePluginDisplayName`（显示名 → 缺省回退包名），
   * 与卡片标题、插件市场行不可能漂成三个名。
   */
  const detailPage: ReactNode | undefined = selected === undefined || !connected ? undefined : (
    <EnterprisePluginDetailPage
      packageName={selected}
      displayName={selectedItem?.displayName}
      catalogVersionText={enterprisePluginCatalogVersionText({ catalogState, version: selectedItem?.version })}
      installed={selectedLocal?.desiredState === 'INSTALLED'}
      installedVersion={selectedLocal?.version}
      sizeBytes={selectedItem?.sizeBytes}
      installErrorCode={selectedItem?.installErrorCode}
      installLockNotice={gateFor(selected).installLockNotice}
      progress={detailPending?.progress}
      settledNotice={detailPending?.settledNotice}
      onBack={closeDetail}
      onCancelInstall={cancelInstall}
      actions={detailActions(selected)}
      pageRef={page}
    />
  )


  return <section ref={root} className="own-market" aria-label="企业插件市场">
    <style>{styles}</style>
    {/* 页头与标签栏：**两态都不动**（详情占据的只有下面的内容区）。 */}
    <div className="own-market-tabs" role="group" aria-label="插件视图">
      <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>全部插件</button>
      <button type="button" aria-pressed={view === 'installed'} onClick={() => setView('installed')}>已安装 ({names.filter(isInstalled).length})</button>
      <span className="own-market-sub" style={{ marginLeft: 'auto' }}>{catalog.length} 个可用插件</span>
    </div>
    <div className="own-market-toolbar">
      <label className="own-market-search"><Search size={16} aria-hidden /><input type="search" aria-label="搜索企业插件" placeholder="搜索企业插件" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <Button size="sm" variant="ghost" aria-label="刷新插件" title="刷新插件" disabled={!connected || snapshot.pluginsLoading || busy}
        icon={<RefreshCw size={16} aria-hidden />} onClick={() => { void store.refreshPlugins() }} />
    </div>
    {/* 内容区（**唯一容器**）：列表 ↔ 详情**子页面**互斥切换 —— 详情在场时下面这一整棵列表
        （目录四态 + 卡片网格）**一个元素都不挂载**，不是浮层、没有遮罩、没有 portal、没有 dialog 语义。
        与技能/配方详情是同一形态（`marketplace-entry.tsx` 的整页切换），差别只在：本页的页头与标签栏在
        容器**之上**、保持不动，而那边是连页签条一起整页切走。 */}
    <EnterprisePluginContentRegion
      detail={detailPage}
      list={<>
        {restartRequired ? <div className="own-market-notice" role="status">插件变更已保存，完全退出并重新打开客户端后生效。</div> : null}
        {/* 目录四态（未登录 / 加载中 / 失败 / 空 / 就绪）由纯投影算一次：失败**不再与空混同**。
            失败态复用唯一提示组件（人话 + 下一步 + 技术信息里的码）并给**真的重发**的重试。 */}
        {catalogState.kind === 'signed-out' ? <div className="own-market-empty">{ENTERPRISE_PLUGIN_LIST_SIGNED_OUT}</div> : null}
        {catalogState.kind === 'loading' ? <div className="own-market-empty" role="status">{ENTERPRISE_PLUGIN_LIST_LOADING}</div> : null}
        {catalogState.kind === 'failed' ? (
          <div className="own-market-notice">
            <EnterpriseErrorNotice className="own-market-notice own-market-error" code={catalogState.code} prefix={ENTERPRISE_PLUGIN_LIST_FAILED} />
            <Button size="sm" icon={<RefreshCw size={14} aria-hidden />} aria-label="重新加载插件目录"
              onClick={() => { void store.refreshPlugins() }}>
              重试
            </Button>
          </div>
        ) : null}
        {catalogState.kind === 'empty' ? <div className="own-market-empty">{enterprisePluginCatalogEmptyText(catalogState.reason)}</div> : null}
        {/* 行级/动作级的失败码照旧单独出（它与目录四态无关，命中哪一行由上面的行内提示负责）。 */}
        {catalogState.kind !== 'failed' && (snapshot.pluginErrorCode !== undefined || fatal !== undefined)
          ? <EnterpriseErrorNotice className="own-market-notice own-market-error" code={(snapshot.pluginErrorCode ?? fatal)!} />
          : null}
        {status?.lastReportErrorCode ? <div className="own-market-notice" role="status">设备状态暂未上报</div> : null}
        <div className="own-market-grid">
          {rows.map(name => {
            const item = available.get(name)
            const record = local.get(name)
            const presentation = record ? STATES[record.state] : undefined
            // 这一行的进度与交代只算一次（同一份 store 快照 + 本行真实受管态），下面两处落点读同一份。
            const pending = progressFor(name)
            return <article className="own-market-card" key={name} data-enterprise-plugin-package={name} data-enterprise-plugin-state={record?.state ?? 'AVAILABLE'}>
              {/* 标题即入口：整枚标题行是真 `<button>`（键盘可达、有焦点环），无障碍名「查看 <名称> 的详情」，
                  点它把**内容区**整段换成这一行的详情子页面——「点标题进详情页」的用户口径。标题文本 = 插件名称
                  （制品 displayName），缺省回退包名；回调把**本行**的 name 回传（不是列表里别的行）。 */}
              <EnterprisePluginCardTitle
                name={name}
                displayName={item?.displayName}
                packageName={name}
                version={item?.version ?? record?.version ?? undefined}
                description={item?.description}
                onOpen={openDetail}
              />
              {/* 标题行（标题 + 企业签 + 版本短号签）与**第二行（插件描述）**都在上面那一枚纯函数里；
                  第三行（体积）与页脚（状态词 + 动作区）在下面，一字未动。 */}
              {/* 只报体积：平台已退出决策面，行上不再出现任何平台词（声明含/不含当前平台渲染逐字相同）。 */}
              <div className="own-market-sub">{item ? bytes(item.sizeBytes) : '已不在企业目录中'}</div>
              {/* 目录判定不可安装：原因 +「下一步：」+ 技术信息里的码，全部可见（原先这一句只在按钮的 title 里）。 */}
              {item?.installErrorCode ? <EnterpriseErrorNotice className="own-market-sub" code={item.installErrorCode} /> : null}
              {/* 动作点不动时**在行上**说清为什么（原因只来自那一份平台无关的门禁）。 */}
              <EnterprisePluginGateNotes gate={gateFor(name)} subject={name} />
              {/* 「安装中」这一行的**真进度**（阶段文字 + 不确定态流光 + 真取消入口/取消不了的原因）：
                  没有工序就整段不进 DOM。 */}
              <EnterprisePluginCardProgressNotes name={name} progress={pending.progress} onCancel={cancelInstall} />
              {/* 刚结束那一次动作的落地交代（完成 / 需重启）：`role="status"` 把「安装中 → 完成」接上。 */}
              <EnterprisePluginCardSettledNote name={name} notice={pending.settledNotice} />
              {record?.lastErrorCode ? <EnterpriseErrorNotice className="own-market-sub own-market-error" code={record.lastErrorCode} /> : null}
              <footer><span style={{ color: presentation?.color ?? 'var(--dsw-alias-label-secondary,#667085)' }}>{isInstalled(name) ? enterprisePluginInstalledStatusLabel(enabledOf(name)) : presentation?.title ?? '可选安装'}</span>{rowActions(name)}</footer>
            </article>
          })}
        </div>
      </>}
    />
  </section>
}
