/**
 * [INPUT]: 依赖 React 的 createElement、官方原语 `Pill`（`@deepseek-ai/dsh-client-ui-primitives`）、
 *   `esc-constants` 的兜底菜单、`esc-tab-icons` 的三枚 workbuddy 图标 path 与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscResourceTabs`（{activeKey, onSelect} → 内容页左上角的三个药丸页签）+ 菜单图标映射 `ENTERPRISE_ESC_MENU_ICON`
 * [POS]: esc 页面的**页面切换器**（原来是左栏，用户裁决「三个菜单放到内容页左上角，作为药丸页签切换页面」）。
 *   ★来源不变：菜单数据仍是 `ESC_DEFAULT_CATEGORY_MENUS`（原文件在"后端还没配这个菜单"时的既有兜底；
 *   DSH 侧没有菜单权限树）；图标仍是 lucide 同义图标（原 NUWAX `SvgIcon name="icons-nav-*"` 的替代）。
 *   ★只有"摆在哪、长什么样"变了：`<aside>` 竖排列表 → 顶部横排药丸（官方 `Pill`，与主 tab / 二级分类同一枚控件，
 *   故三行页签是一套视觉语言，不再有两套）。
 *   ★交互语义**照抄**左栏那次裁决：点击当前项也算一次"切换请求"（原页面靠 `_t` 时间戳驱动内容区 remount 刷新），
 *   故每次点击都回调一次 `onSelect`，由页面把刷新令牌 +1——重复点击同一个资源类型同样会整区重拉。
 *   ★**本刀（免疫式修法）**：三枚药丸**共用工具栏那一枚行内几何常量** `ESC_PILL_INLINE_STYLE`
 *     （官方主题 sheet 的文档序不由我们决定，`white-space: nowrap` 单靠类名会晚到失效 ⇒ 折行/圆角塌）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { createElement, type ReactNode } from 'react'
import { ESC_DEFAULT_CATEGORY_MENUS } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY } from './esc-copy.js'
import { ESC_PILL_INLINE_STYLE } from './esc-toolbar.js'
import { WORKBUDDY_ESC_TAB_PATH } from './esc-tab-icons.js'
import type { ResourceTypeEnum } from './esc-types.js'

/**
 * 页签图标：**workbuddy 那三枚真图**（逐字取其 path 的 d，见 `esc-tab-icons.ts`）。
 *
 * ★原先是三枚 lucide 同义图标（`Users`/`Sparkles`/`Link`）——那是**近似**，不是同一枚图。
 * 用户裁决「专家、技能、连接器图片换成这个」之后一律换掉，不再保留近似图标。
 * 填色走 CSS 的 `currentColor`（与原 SVG 一致）⇒ 选中黑、非选中灰由样式层管，图标自己不写死颜色。
 */
export const ENTERPRISE_ESC_MENU_ICON: Readonly<Record<ResourceTypeEnum, () => ReactNode>> = {
  expert: () => createElement('svg', { className: 'esc-tab-icon', viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
    ...WORKBUDDY_ESC_TAB_PATH.expert.map(d => createElement('path', { key: d.slice(0, 12), d }))),
  skill: () => createElement('svg', { className: 'esc-tab-icon', viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
    ...WORKBUDDY_ESC_TAB_PATH.skill.map(d => createElement('path', { key: d.slice(0, 12), d }))),
  connector: () => createElement('svg', { className: 'esc-tab-icon', viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true },
    ...WORKBUDDY_ESC_TAB_PATH.connector.map(d => createElement('path', { key: d.slice(0, 12), d }))),
}

/** 兜底图标（`ENTERPRISE_ESC_MENU_ICON` 里查不到时的退路，正常路径取不到它）。 */
const FALLBACK_ICON = (): ReactNode => createElement('svg', { className: 'esc-tab-icon', viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true })

/** 页签入参。 */
export interface EnterpriseEscResourceTabsProps {
  readonly activeKey: ResourceTypeEnum
  /** 选中某个资源类型（重复点当前项也要回调：页面据此刷新内容区，与原文 `_t` 同义）。 */
  readonly onSelect: (code: ResourceTypeEnum) => void
}

/** 内容页左上角的三个资源类型药丸页签（专家&专家团 / 技能 / 连接器）。 */
export function EnterpriseEscResourceTabs({ activeKey, onSelect }: EnterpriseEscResourceTabsProps): ReactNode {
  return createElement(
    'nav',
    { className: 'esc-resource-tabs', 'aria-label': ENTERPRISE_ESC_COPY.pageTitle },
    ESC_DEFAULT_CATEGORY_MENUS.map(item =>
      createElement(
        Pill,
        {
          key: item.code,
          className: 'esc-resource-tab esc-pill',
          // ★**本刀（免疫式修法）**：与工具栏那两行、乃至数据驱动的二级 chip 行**共用同一枚常量**
          //   （`ESC_PILL_INLINE_STYLE`；三行是同一套视觉语言，几何就得逐字同一份）。
          //   容器 `.esc-resource-tabs` 的 `flex-wrap: nowrap` 同样靠样式表，不另起一枚——
          //   它是**容器**格，而清单一格叫「二级 chip 行」，工具栏那两行已按同一枚常量免疫。
          style: ESC_PILL_INLINE_STYLE,
          active: item.code === activeKey,
          'aria-current': item.code === activeKey ? 'page' : undefined,
          // 同上：选中态由我们自己的标记驱动（官方 active 落到它那份哈希类名上，外部选不中）。
          ...{ 'data-esc-selected': item.code === activeKey },
          onClick: () => onSelect(item.code),
        },
        (ENTERPRISE_ESC_MENU_ICON[item.code] ?? FALLBACK_ICON)(),
        createElement('span', { children: item.label }),
      ),
    ),
  )
}
