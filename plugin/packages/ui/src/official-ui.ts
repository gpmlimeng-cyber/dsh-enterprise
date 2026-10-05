/**
 * [INPUT]: 依赖官方 @deepseek-ai/dsh-client-ui-primitives 的运行时导出（宿主共享实例，不打进本包）
 * [OUTPUT]: 对外提供本包真正消费的官方 UI 视图：OfficialMenu、OfficialMenuItemButton 与四个官方图标组件
 * [POS]: dsh-ui 与官方共享 UI 实例之间的唯一类型接缝。官方从 0.1.7-rc.2（本插件声明的发布基线）起就提供 Menu 的
 *   children 组件行、MenuItemButton 与 *Medium/*Regular 图标，0.2.0-rc.2 实物同形；但本包的 devDependency 仍钉在
 *   0.1.5-rc.2，其 .d.ts 只声明了 items 版 Menu 与一批 *16 命名的图标。抬版本要动 pnpm-lock.yaml /
 *   pnpm-workspace.yaml（越出「只改 packages/ui/**」的写作用域），所以这里把官方实例收窄成我们实际用到的签名：
 *   编译期不猜、运行期取的仍是宿主共享的官方实物。签名逐条抄自 0.1.7-rc.2 官方源码
 *   packages/client/ui-primitives/src/Menu.tsx:47-70/168-190 与 src/icons/props.ts，并用 0.2.0-rc.2 的
 *   lib/index.js 导出表核对过。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement, ReactNode } from 'react'

/** 官方图标组件的调用面（0.1.7-rc.2 src/icons/props.ts 的 IconProps）。 */
export interface OfficialIconProps {
  readonly size?: number | undefined
  readonly className?: string | undefined
}

export type OfficialIcon = (props: OfficialIconProps) => ReactElement

/** 官方菜单行：与官方 items 数据行同一套标记与样式，因此共用键盘漫游与选中后的焦点归还。 */
export interface OfficialMenuItemButtonProps {
  readonly children: ReactNode
  readonly shortcut?: { readonly keys: readonly string[]; readonly aria?: string | undefined } | undefined
  readonly icon?: ReactNode
  readonly disabled?: boolean
  /** 破坏性动作：错误色文字/图标加危险悬停填充。 */
  readonly danger?: boolean
  readonly separatorBefore?: boolean
  readonly onSelect: () => void
}

/** 官方菜单卡片：只声明本包实际传入的 props；items/onSelect 由官方默认（空列表）。 */
export interface OfficialMenuProps {
  readonly open: boolean
  readonly anchor: ReactNode
  readonly children?: ReactNode
  readonly onClose: () => void
  readonly autoFocus?: boolean
  readonly className?: string | undefined
  /** 卡片挂到 document.body，用锚点矩形做 fixed 定位：侧栏的 overflow 裁不到它。 */
  readonly portal?: boolean
  readonly side?: 'bottom' | 'top' | 'right'
  /**
   * 列表相对锚点的对齐（官方 `lib/types/Menu.d.ts:75` 逐字 `align?: 'start' | 'end'`，默认 `'start'`）。
   * 工具行右端那枚「添加技能」下拉传 `'end'` ⇒ 卡片右边缘与按钮右边缘对齐（用户口径「右对齐与按钮」）。
   */
  readonly align?: 'start' | 'end'
}

interface OfficialPrimitives {
  readonly Menu: (props: OfficialMenuProps) => ReactElement
  readonly MenuItemButton: (props: OfficialMenuItemButtonProps) => ReactElement
  readonly IconEllipsisOutlineMedium: OfficialIcon
  readonly IconSettingsOutlineMedium: OfficialIcon
  readonly IconUserOutlineMedium: OfficialIcon
  readonly IconLoadingOutlineMedium: OfficialIcon
}

const official = primitives as unknown as OfficialPrimitives

export const OfficialMenu = official.Menu
export const OfficialMenuItemButton = official.MenuItemButton
export const IconEllipsisOutlineMedium = official.IconEllipsisOutlineMedium
export const IconSettingsOutlineMedium = official.IconSettingsOutlineMedium
export const IconUserOutlineMedium = official.IconUserOutlineMedium
export const IconLoadingOutlineMedium = official.IconLoadingOutlineMedium
