/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、lucide-react 的 `LayoutGrid`、`esc-page` 的整页组件与 `esc-api` 的取数面类型
 * [OUTPUT]: 对外提供 esc 页面的**两处座位身份与接线**——侧栏一级入口 id `ENTERPRISE_ESC_ENTRY_ID`（`expert-skill-connector`，**必须与 main 的 key 同名**）、
 *   可见文案 `ENTERPRISE_ESC_ENTRY_LABEL`、排序 `ENTERPRISE_ESC_ENTRY_ORDER`、图标 `EnterpriseEscIcon`、
 *   两份注册选项工厂 `enterpriseEscPanelOptions`/`enterpriseEscMainOptions`，以及接线器 `bindEnterpriseEscSeats`
 * [POS]: esc 页面的**入口层**（怎么进），页面长什么样归 `esc-page`。
 *   ★逐字照抄 `library-entry.tsx` 的座位形状（那是本仓已验证的官方约定）：`sidebar.panellist` 的 metadata 走
 *   options（`{name, id, order, label}`）+ 图标走 register 的第二个参数；`main` 的 `key` 与侧栏 `id` 取自
 *   **同一个常量**（官方按同名配对，不同名就是一个点不开的死入口）。
 *   ★与资料库的**唯一结构差异**：资料库那两处由管理门（本机设置，默认关）驱动、关就真撤；esc 是**常驻**一级入口，
 *   故这里不引入门——注册即接线。登录与否由页面自己按取数结果如实呈现（未登录 ⇒ 401 ⇒ 画「请先登录」那一态）。
 *   ★**口径 46/47**：`main` 槽的 inject 面多带一枚 `skillPort`（本机技能写入口）——它**不进** `api`。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { LayoutGrid } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import type { EnterpriseEscApi } from './esc-api.js'
import { EnterpriseEscPanel } from './esc-page.js'
import type { EnterpriseEscSkillPort } from './esc-types.js'

/** 侧栏一级入口的 id，同时是 `main` 槽的 key（官方约定：list id 指向同名的 main 面板）。 */
export const ENTERPRISE_ESC_ENTRY_ID = 'expert-skill-connector'

/** 侧栏那一行的可见文案与无障碍名。 */
export const ENTERPRISE_ESC_ENTRY_LABEL = '专家·技能·连接器'

/**
 * 侧栏排序：官方全局面板实测 `plugins`=0、`schedules`=10，本仓资料库取 20，故这里取 30 排在它们之后。
 * **不复用任何既有 id**。
 */
export const ENTERPRISE_ESC_ENTRY_ORDER = 30

/**
 * 侧栏入口的图标（官方 `sidebar.panellist` 的注册组件）。
 *
 * 官方侧栏自己持有这一行的**按钮**（真 `<button>` + `aria-label` + 选中时 `aria-current="page"` + 焦点环），
 * 并把 glyph 放进一枚 `aria-hidden` 的 span 里；官方同族的面板图标同样**只吃 `size`**、高亮交给侧栏，
 * 故这里不自己再画一遍高亮。
 */
export function EnterpriseEscIcon(props: {
  readonly size?: number | undefined
  readonly active?: boolean | undefined
}): ReactNode {
  return createElement(LayoutGrid, { 'aria-hidden': true, size: props.size ?? 18 })
}

/** `sidebar.panellist`（list 槽）的注册选项：id 就是那个与 `main` 同名的常量。 */
export function enterpriseEscPanelOptions(): Readonly<Record<string, unknown>> {
  return {
    name: 'sidebar.panellist',
    id: ENTERPRISE_ESC_ENTRY_ID,
    order: ENTERPRISE_ESC_ENTRY_ORDER,
    label: ENTERPRISE_ESC_ENTRY_LABEL,
  }
}

/** `main`（keyed/root 槽）的注册选项：`key` 与侧栏 `id` 取自**同一个常量**，同名不可能漂移。 */
export function enterpriseEscMainOptions(
  api: EnterpriseEscApi,
  skillPort?: EnterpriseEscSkillPort | undefined,
): Readonly<Record<string, unknown>> {
  return {
    name: 'main',
    key: ENTERPRISE_ESC_ENTRY_ID,
    // 取数面经 inject 交给页面：页面只认那六个同源**只读**方法，拿不到平台 origin、也拼不出平台 URL。
    // ★口径 46：本机技能写入口（本地导入 / 自装清单 / 卸载）另走一枚端口随 inject 一起下去——
    //   它**不进** `api`（那一面是结构性只读的，见 `esc-types.ts` 的长注释）。
    inject: () => ({ api, skillPort }),
  }
}

/** slot 服务上本层用到的两个方法（与 `client.tsx` 的 `SlotContextPort.slots` 同形）。 */
export interface EnterpriseEscSeatPorts {
  inject(name: string, register: () => unknown): unknown
  register(options: Readonly<Record<string, unknown>>, component: (props: never) => ReactNode): unknown
}

/**
 * 把 esc 的两处座位（侧栏入口 `sidebar.panellist` + 页面主体 `main`）一起接到 slot 服务上。
 *
 * 两处注册选项都从 `ENTERPRISE_ESC_ENTRY_ID` 产出，故只可能同生同死（与资料库同一条纪律）。
 *
 * @param ports - `ctx.slots`。
 * @param api - 页面取数面（经 `main` 的 inject 面交给页面）。
 * @param skillPort - 本机技能写入口（口径 46；可选——缺席时那两枚按钮置灰写明原因）。
 * @returns 两处座位的注销器（顺序与注册顺序一致；实际生命周期由 `ports.inject` 接管）。
 */
export function bindEnterpriseEscSeats(
  ports: EnterpriseEscSeatPorts,
  api: EnterpriseEscApi,
  skillPort?: EnterpriseEscSkillPort | undefined,
): readonly unknown[] {
  return [
    ports.inject('sidebar.panellist', () =>
      ports.register(enterpriseEscPanelOptions(), EnterpriseEscIcon as (props: never) => ReactNode),
    ),
    ports.inject('main', () =>
      ports.register(
        enterpriseEscMainOptions(api, skillPort),
        EnterpriseEscPanel as unknown as (props: never) => ReactNode,
      ),
    ),
  ]
}
