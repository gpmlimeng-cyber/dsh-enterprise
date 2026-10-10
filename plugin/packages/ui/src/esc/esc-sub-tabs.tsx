/**
 * [INPUT]: 只依赖 React 的 createElement/ReactNode、官方原语 `Pill`、以及本文件自己那两枚纯投影（不依赖任何取数面、不发请求）
 * [OUTPUT]: 对外提供**二级 chip 行**这条机制的唯一一份实现——纯投影 `enterpriseEscSubTabs`（由若干枚**数据驱动**的 chip + 选中态投影出"渲染什么、选中的是不是还有效"）、`enterpriseEscSubTabFilter`（按一枚 key 过滤候选，给"选中某枚 chip 就只看它"用）、以及呈现层 `EnterpriseEscSubTabRow`（复用与二级分类行**同一套类名/token**的一排胶囊）
 * [POS]: esc 页「维度 → 二级 chip 行 → 内容过滤」这条机制的**唯一真源**（口径 62 抽出来的那一层）。
 *   ★**为什么必须抽出来**：技能页现在有**两个**维度的二级 chip 行是**数据驱动**的
 *     （「本地三方」按本机 Agent 来源根；SkillHub 按市场来源），而 ES 页原有的二级分类行是
 *     **后端目录**驱动的。三处的视觉语言必须**同一套**（同一个类名、同一套 token、同一排间距），
 *     而"哪几枚 chip 该出现""选中的那枚没了怎么办""按它怎么过滤"是**同一条判据**。
 *     写成两份的后果是可预见的：两处一定会漂成两种选中态、两种"全部"文案。
 *   ★**它与后端分类行（`esc-categories.ts`）的关系**：那一行是**平台目录**（专家/技能/连接器的
 *     分类树），走 `useEnterpriseEscCategories`；这一行是**响应里的数据**，由各维度自己投影出来。
 *     两者在工具栏里**共用同一个渲染入口**（`EnterpriseEscToolbar` 的 `subTabs` prop）与
 *     **同一套类名**，故员工看到的永远是同一排东西。
 *   ★**零编造**：本文件不产生任何 chip 的文案或 key——它们全部由调用方从**真响应**里投影出来
 *     （例如 `enterpriseThirdPartySubChips(roots)`）；这里只做"选中态与过滤"这两件通用的事。
 *   ★**本刀（免疫式修法）**：本行容器与每一枚药丸**共用工具栏那两枚行内几何常量**
 *     （`ESC_TABS_ROW_INLINE_STYLE` / `ESC_PILL_INLINE_STYLE`）——本行刻意复用同一套类名，
 *     几何就必须逐字同一份（官方主题 sheet 的文档序不由我们决定，详见 `esc-toolbar.tsx` 文件头）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { createElement, type ReactNode } from 'react'
import { ESC_PILL_INLINE_STYLE, ESC_TABS_ROW_INLINE_STYLE } from './esc-toolbar.js'

/**
 * 二级 chip 行的**一行数据**（维度无关：谁产出都长这个样）。
 *
 * `key` 是这一枚 chip 的稳定标识（**由数据给**，不是下标）：选中态与过滤都认它。
 * `label` 是可见文案（**由数据给**：来源名 / 分类名）。
 */
export interface EnterpriseEscSubTab {
  readonly key: string
  readonly label: string
}

/** 「全部」那一枚的固定 key（空串：与后端分类行那个 `key: ''` 同一条约定，两行不会打架）。 */
export const ENTERPRISE_ESC_SUB_TAB_ALL_KEY = ''
/** 「全部」那一枚的固定文案。 */
export const ENTERPRISE_ESC_SUB_TAB_ALL_LABEL = '全部'

/**
 * 二级 chip 行的**唯一状态投影**（纯函数）。
 *
 * 三件事一次算清，因为它们必须**同源**：
 *   · `chips` —— 真正渲染的那一排（「全部」恒在首位 + 调用方给的每一枚）；
 *   · `activeKey` —— 当前选中的那一枚；选中的那枚**已经不在**这一排里（响应变了 / 换了维度）
 *     时**回落「全部」**（否则会进入"没有任何 chip 是选中的，但列表却被某个看不见的 key 过滤着"
 *     这种最坏形态：员工看到的是一份被筛过、却看不出被什么筛过的清单）；
 *   · `blanked` —— 这一排**是不是空的**（调用方给零枚 chip 且不该显示「全部」时）。
 *
 * @param input - `chips`（**不含**「全部」，由调用方从真数据投影）、`activeKey`（当前选中）、
 *   `withAll`（要不要那枚「全部」；默认要）。
 * @returns 渲染清单 + 生效的选中 key。
 */
export function enterpriseEscSubTabs(input: {
  readonly chips: readonly EnterpriseEscSubTab[]
  readonly activeKey: string
  readonly withAll?: boolean | undefined
}): { readonly chips: readonly EnterpriseEscSubTab[]; readonly activeKey: string } {
  const withAll = input.withAll !== false
  const chips = withAll
    ? [{ key: ENTERPRISE_ESC_SUB_TAB_ALL_KEY, label: ENTERPRISE_ESC_SUB_TAB_ALL_LABEL }, ...input.chips]
    : [...input.chips]
  /**
   * ★选中态**只**在"它真的在渲染清单里"时保留：不在就回落「全部」。
   *   `withAll === false` 且清单非空时，"回落"的目标是**第一枚**（没有「全部」可回）——
   *   这与"清单为空就无过滤"是同一条意图：**一个不存在的 key 不许继续过滤**。
   */
  const fallback = withAll ? ENTERPRISE_ESC_SUB_TAB_ALL_KEY : (chips[0]?.key ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY)
  const active = chips.some(chip => chip.key === input.activeKey) ? input.activeKey : fallback
  return { chips, activeKey: active }
}

/**
 * 按选中那一枚 chip 过滤候选（纯函数）。
 *
 * @param items - 候选。
 * @param activeKey - 选中的 key（**必须是** `enterpriseEscSubTabs` 投影出来的那一枚）。
 * @param keyOf - 从一条候选取出"它属于哪一枚 chip"（各维度自己给：本机来源根是 `rootId`，
 *   将来的市场来源是 `sourceId`）。
 * @returns 过滤后的候选（选「全部」/空 key ⇒ **原样返回**，连数组都不重建）。
 */
export function enterpriseEscSubTabFilter<T>(
  items: readonly T[],
  activeKey: string,
  keyOf: (item: T) => string,
): readonly T[] {
  if (activeKey === ENTERPRISE_ESC_SUB_TAB_ALL_KEY) return items
  return items.filter(item => keyOf(item) === activeKey)
}

/**
 * 二级 chip 行的**呈现**（唯一实现；一个**纯投影函数**，不是 React 组件）。
 *
 * ★**复用二级分类行那一套类名**（`esc-category-tabs` + `esc-pill`）：两行是同一排东西，
 *   不该长出第二套视觉语言。另挂 `data-esc-subtab` / `data-esc-subtab-key` 两个稳定钩子
 *   （门禁据此取证"渲染了哪几枚、选中的是哪一枚"，不必去数第几个子节点）。
 * ★`onSelect` 缺席 ⇒ 整行**不渲染**（没有可点性的一排胶囊就是死控件）。
 */
export function EnterpriseEscSubTabRow(props: {
  readonly chips: readonly EnterpriseEscSubTab[]
  readonly activeKey: string
  readonly onSelect: (key: string) => void
  /** 「全部」那一枚的悬浮说明（可选；缺省不挂 title）。 */
  readonly allTitle?: string | undefined
}): ReactNode {
  if (props.chips.length === 0) return null
  return createElement(
    'div',
    // ★**本刀（免疫式修法）**：容器与每一枚药丸都**共用工具栏那两枚常量**
    //   （`ESC_TABS_ROW_INLINE_STYLE` / `ESC_PILL_INLINE_STYLE`；本行刻意复用同一套类名，
    //   几何就必须逐字同一份——各抄一份早晚会漂成"同一排东西两个形态"）。
    { className: 'esc-category-tabs', style: ESC_TABS_ROW_INLINE_STYLE },
    props.chips.map(chip =>
      createElement(Pill, {
        key: chip.key === ENTERPRISE_ESC_SUB_TAB_ALL_KEY ? '__all__' : chip.key,
        className: 'esc-pill',
        style: ESC_PILL_INLINE_STYLE,
        active: chip.key === props.activeKey,
        ...{ 'data-esc-selected': chip.key === props.activeKey },
        ...{ 'data-esc-subtab': chip.key },
        ...(chip.key === ENTERPRISE_ESC_SUB_TAB_ALL_KEY && props.allTitle !== undefined
          ? { title: props.allTitle }
          : {}),
        onClick: () => { props.onSelect(chip.key) },
        children: chip.label,
      }),
    ),
  )
}
