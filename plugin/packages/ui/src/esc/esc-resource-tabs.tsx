/**
 * [INPUT]: 依赖 React 的 createElement、lucide-react 的三枚图标、官方原语 `Pill`（`@deepseek-ai/dsh-client-ui-primitives`）、
 *   `esc-constants` 的兜底菜单与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscResourceTabs`（{activeKey, onSelect} → 内容页左上角的三个药丸页签）+ 菜单图标映射 `ENTERPRISE_ESC_MENU_ICON`
 * [POS]: esc 页面的**页面切换器**（原来是左栏，用户裁决「三个菜单放到内容页左上角，作为药丸页签切换页面」）。
 *   ★来源不变：菜单数据仍是 `ESC_DEFAULT_CATEGORY_MENUS`（原文件在"后端还没配这个菜单"时的既有兜底；
 *   DSH 侧没有菜单权限树）；图标仍是 lucide 同义图标（原 NUWAX `SvgIcon name="icons-nav-*"` 的替代）。
 *   ★只有"摆在哪、长什么样"变了：`<aside>` 竖排列表 → 顶部横排药丸（官方 `Pill`，与主 tab / 二级分类同一枚控件，
 *   故三行页签是一套视觉语言，不再有两套）。
 *   ★交互语义**照抄**左栏那次裁决：点击当前项也算一次"切换请求"（原页面靠 `_t` 时间戳驱动内容区 remount 刷新），
 *   故每次点击都回调一次 `onSelect`，由页面把刷新令牌 +1——重复点击同一个资源类型同样会整区重拉。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { LayoutGrid, Link, Sparkles, Users } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { ESC_DEFAULT_CATEGORY_MENUS } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY } from './esc-copy.js'
import type { ResourceTypeEnum } from './esc-types.js'

/** 菜单图标：NUWAX 那三个图标标识 → lucide 同义图标（映射只此一份）。 */
export const ENTERPRISE_ESC_MENU_ICON: Readonly<Record<ResourceTypeEnum, () => ReactNode>> = {
  expert: () => createElement(Users, { size: 14, 'aria-hidden': true }),
  skill: () => createElement(Sparkles, { size: 14, 'aria-hidden': true }),
  connector: () => createElement(Link, { size: 14, 'aria-hidden': true }),
}

/** 兜底图标（`ENTERPRISE_ESC_MENU_ICON` 里查不到时的退路，正常路径取不到它）。 */
const FALLBACK_ICON = (): ReactNode => createElement(LayoutGrid, { size: 14, 'aria-hidden': true })

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
          active: item.code === activeKey,
          'aria-current': item.code === activeKey ? 'page' : undefined,
          onClick: () => onSelect(item.code),
        },
        (ENTERPRISE_ESC_MENU_ICON[item.code] ?? FALLBACK_ICON)(),
        createElement('span', { children: item.label }),
      ),
    ),
  )
}
