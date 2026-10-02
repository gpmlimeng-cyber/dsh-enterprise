/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、lucide-react 的 Library 图标、library-panel 的页面宿主 `EnterpriseLibraryPanel` 与取数源类型 `EnterpriseLibrarySource`、library-gate 的管理门类型 `EnterpriseLibraryGate`
 * [OUTPUT]: 资料库**侧栏一级入口**与 `main` 面板的座位身份与接线——入口 id `ENTERPRISE_LIBRARY_ENTRY_ID`（`library`，**必须与 main 的 key 同名**）、可见文案 `ENTERPRISE_LIBRARY_ENTRY_LABEL`、排序 `ENTERPRISE_LIBRARY_ENTRY_ORDER`、入口图标 `EnterpriseLibraryIcon`（官方侧栏那枚 glyph，只吃 `{size, active}`）、两份注册选项工厂 `enterpriseLibraryPanelOptions`／`enterpriseLibraryMainOptions`（两份都从同一个 id 常量产出，同名是结构性的），以及**视图驱动**的注册/注销接线器 `bindEnterpriseLibrarySeat`／`bindEnterpriseLibrarySeats`
 * [POS]: ui 的资料库**入口层**（怎么进），页面长什么样归 library-panel。座位的存亡完全由管理门快照驱动：关 → 一个占用者都不留（`dispose()` 真撤），开 → 两处座位一起注册。官方 `sidebar.panellist` 的注册形状是「metadata 走 options（`{ name, id, order, label }`）+ 图标走 register 的第二个参数」，**没有** `title`/`icon` 字段（见官方 plugin-manager / schedule 两处注册），故这里按官方实物写，不发明字段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Library } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import type { EnterpriseLibraryGate } from './library-gate.js'
import { EnterpriseLibraryPanel, type EnterpriseLibrarySource } from './library-panel.js'

/** 侧栏一级入口的 id，同时是 `main` 槽的 key（官方约定：list id 指向同名的 main 面板）。 */
export const ENTERPRISE_LIBRARY_ENTRY_ID = 'library'

/** 侧栏那一行的可见文案与无障碍名（官方侧栏用它作行标题与 `aria-label`）。 */
export const ENTERPRISE_LIBRARY_ENTRY_LABEL = '资料库'

/**
 * 侧栏排序：官方全局面板实测 `plugins`=0、`schedules`=10，故排在它们之后。
 * **不复用任何既有 id**：早前被用户要求撤掉的「应用商店」入口用的是别的 id（`enterprise-store`），与这里无关。
 */
export const ENTERPRISE_LIBRARY_ENTRY_ORDER = 20

/**
 * 侧栏入口的图标（官方 `sidebar.panellist` 的注册组件）。
 *
 * 官方侧栏自己持有这一行的**按钮**（`PanelRow`：真 `<button class=panelRow>` + `aria-label` + 选中时
 * `aria-current="page"` + `:focus-visible` 焦点环 + `.panelActive` 高亮底色），并把 glyph 放进一枚
 * `aria-hidden` 的 span 里；官方同族的两枚面板图标（plugin-manager / schedule）同样**只吃 `size`**、
 * 高亮交给侧栏，故这里不自己再画一遍高亮（`active` 是官方 ownerProps 的字段，保留声明但不重复表达）。
 *
 * @param props - 官方 `SidebarPanelIconOwnerProps`：`size`（正方形边长）与 `active`（是否当前项）。
 */
export function EnterpriseLibraryIcon(props: {
  readonly size?: number | undefined
  readonly active?: boolean | undefined
}): ReactNode {
  return createElement(Library, { 'aria-hidden': true, 'size': props.size ?? 18 })
}

/** `sidebar.panellist`（list 槽）的注册选项：id 就是那个与 `main` 同名的常量。 */
export function enterpriseLibraryPanelOptions(): Readonly<Record<string, unknown>> {
  return {
    name: 'sidebar.panellist',
    id: ENTERPRISE_LIBRARY_ENTRY_ID,
    order: ENTERPRISE_LIBRARY_ENTRY_ORDER,
    label: ENTERPRISE_LIBRARY_ENTRY_LABEL,
  }
}

/** `main`（keyed/root 槽）的注册选项：`key` 与上面的 `id` 取自**同一个常量**，同名不可能漂移。 */
export function enterpriseLibraryMainOptions(source: EnterpriseLibrarySource): Readonly<Record<string, unknown>> {
  return {
    name: 'main',
    key: ENTERPRISE_LIBRARY_ENTRY_ID,
    inject: () => ({ source }),
  }
}

/** slot 服务上本层用到的两个方法（与 client.tsx 的 SlotContextPort.slots 同形）。 */
export interface EnterpriseLibrarySeatPorts {
  inject(name: string, register: () => unknown): unknown
  register(options: Readonly<Record<string, unknown>>, component: (props: never) => ReactNode): unknown
}

/**
 * 把一处座位接到 slot 服务上，**注册面由管理门快照驱动**。
 *
 * 与 `brand-occupants.tsx` 的 `bindEnterpriseBrandSeat` 同一套手法（那套手法是为「有内容才占座」立的）：
 *   · 快照里门是**关**的 → `dispose()` 真撤掉占用者（一个都不留），官方那边就回到「这一格没有占用者」；
 *   · 门是**开**的 → 注册一次；此后只要还是开着的就不重复注册（避免无意义的重挂载）；
 *   · slot effect 结束（插件卸载 / 槽位声明消失）→ 先退订再撤注册。
 *
 * @param ports - `ctx.slots`（只给 inject/register 两个方法）。
 * @param gate - 资料库管理门快照源（本机设置）。
 * @param options - 该座位的注册选项工厂（每次调用必须产出同一份选项）。
 * @param component - 该座位的占用者组件。
 * @returns 该座位的注销器（由 `ctx.slots.inject` 的 effect 生命周期接管）。
 */
export function bindEnterpriseLibrarySeat(
  ports: EnterpriseLibrarySeatPorts,
  gate: EnterpriseLibraryGate,
  options: () => Readonly<Record<string, unknown>>,
  component: (props: never) => ReactNode,
): unknown {
  const seatName = String(options()['name'])
  return ports.inject(seatName, () => {
    let dispose: (() => void) | undefined
    let registered = false
    const sync = (): void => {
      if (!gate.getSnapshot().enabled) {
        // 开关关：**真的撤掉**这两个座位（官方槽只要还有占用者就不走 fallback，「返回 null」只会把那一格弄空）。
        dispose?.()
        dispose = undefined
        registered = false
        return
      }
      if (registered) return
      dispose = ports.register(options(), component) as (() => void) | undefined
      registered = true
    }
    const off = gate.subscribe(sync)
    sync()
    return () => {
      off()
      dispose?.()
      dispose = undefined
      registered = false
    }
  })
}

/**
 * 把资料库的两处座位（侧栏入口 `sidebar.panellist` + 页面主体 `main`）一起接到 slot 服务上。
 *
 * 两处注册选项都从 `ENTERPRISE_LIBRARY_ENTRY_ID` 产出：侧栏的 `id` 与 main 的 `key` **同名**
 * （官方按同名配对；不同名就是一个点不开的死入口），因此这里只可能同生同死。
 *
 * @param ports - `ctx.slots`。
 * @param gate - 资料库管理门快照源。
 * @param source - 页面主体的目录取数源（经 `main` 的 inject 面交给宿主）。
 * @returns 两处座位的注销器（顺序与注册顺序一致）。
 */
export function bindEnterpriseLibrarySeats(
  ports: EnterpriseLibrarySeatPorts,
  gate: EnterpriseLibraryGate,
  source: EnterpriseLibrarySource,
): readonly unknown[] {
  return [
    bindEnterpriseLibrarySeat(
      ports,
      gate,
      enterpriseLibraryPanelOptions,
      EnterpriseLibraryIcon as (props: never) => ReactNode,
    ),
    bindEnterpriseLibrarySeat(
      ports,
      gate,
      () => enterpriseLibraryMainOptions(source),
      EnterpriseLibraryPanel as (props: never) => ReactNode,
    ),
  ]
}
