/**
 * [INPUT]: 依赖 React 的 createElement/CSSProperties/ReactNode/SyntheticEvent、brand 的两张内置位图、branding 的品牌视图与元素工厂（resolveEnterpriseBranding／EnterpriseBrandMark／EnterpriseBrandingDocument），以及 EnterpriseAccountStore 的本机只读品牌端口（store.api.branding 与 store.subscribe/getSnapshot）
 * [OUTPUT]: 三处官方品牌座位的占用者与接线——纯呈现（未配置即 null）的 `EnterpriseSidebarBrandMark`／`EnterpriseSidebarBrandName`／`EnterpriseHeroBrandMark`、座位身份真源 `ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT`／`ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT`／`ENTERPRISE_HERO_BRAND_MARK_SEAT`（priority -10／-10／0）、非 React 的品牌座位源 `createEnterpriseBrandingSeats` 与「有企业品牌才注册、没有就撤掉」的 `bindEnterpriseBrandSeat`，以及名称口径纯投影 `enterpriseBrandSeatName`
 * [POS]: dsh-ui 的品牌消费层：品牌读取仍归 branding.ts，本层只把同一份视图接到官方 `sidebar.brand.mark`／`sidebar.brand.name`／`conversation.hero.brand.mark` 三个座位上；未配置或取数失败时**一个占用者都不留**，官方鱼标与 HeroFish 原样接管（渲染器 `dsh-client-ui-renderer/lib/client.js:988` 对 single 槽只要有 occupant 就直接渲染它，opt.fallback 不再生效，故降级不能靠「占用者返回 null」实现）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import type { EnterpriseAccountStore } from './account-store.js'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from './brand.js'
import {
  EnterpriseBrandMark,
  resolveEnterpriseBranding,
  type EnterpriseBrandingDocument,
  type EnterpriseBrandingView,
} from './branding.js'

/** 一个品牌座位的身份：官方槽位名 + 遮蔽优先级。 */
export interface EnterpriseBrandSeat {
  readonly name: string
  readonly priority: number
}

/**
 * 侧栏品牌行两处座位用 **-10**：官方 `dsh-client-ui-brand-official` 在 priority 0 占着这两格
 * （`lib/client.js:9-20`，默认 0），slots 对 single 槽「同 priority 冲突即抛错」
 * （`dsh-client-ui-slots/lib/index.js:163-174`），并按 priority **升序**取每格第一个活条目
 * （`:221-222`、`:281-289`）——官方原话 "register at a different priority to shadow it (lowest renders)"。
 * 所以只有更低的值能遮蔽官方，-10 留出与官方拉开距离的余量。
 */
export const ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT: EnterpriseBrandSeat = { name: 'sidebar.brand.mark', priority: -10 }
export const ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT: EnterpriseBrandSeat = { name: 'sidebar.brand.name', priority: -10 }

/**
 * 「新会话」Hero 的品牌位用 **0**：官方槽位目录对 `conversation.hero.brand.mark` 标
 * `occupants: []`、`replaceRisk: "none"`（`dsh-cordis-client-runner/lib/client.js:2692`），没有占用者，
 * 0 不产生任何冲突；这里注册的是可渲染的资产图，官方 HeroFish 仍是它的 `{fallback}`。
 */
export const ENTERPRISE_HERO_BRAND_MARK_SEAT: EnterpriseBrandSeat = { name: 'conversation.hero.brand.mark', priority: 0 }

/** 占用者从 slot `inject` 拿到的唯一输入：品牌视图（未配置/取数失败时 `custom === false`）。 */
export interface EnterpriseBrandOccupantProps {
  readonly view: EnterpriseBrandingView
}

/**
 * 名称取值口径：简称优先，简称缺席用全称。
 *
 * 逐字段「trim 后非空才认、否则回退」的口径由 `resolveEnterpriseBranding` 提供（与登录弹窗同源）；
 * 这里只决定**取哪个字段**——侧栏是一行紧凑位（官方 `.brandName` 容器 18px/600/letter-spacing .04em），
 * 用后台的「品牌简称」；登录弹窗的标题位更宽，仍用全称 `branding.name`。两者共用同一份品牌视图。
 */
export function enterpriseBrandSeatName(view: EnterpriseBrandingView): string {
  return view.shortName === '' ? view.name : view.shortName
}

/** 位图加载失败时就地换内置位图：无状态、无重渲染，与 `EnterpriseBrandMark` 的 onError 回落同一口径。 */
function seatImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget
  if (!image.src.startsWith('data:')) image.src = DSHENT_ICON
}

/** 侧栏品牌位（24px 档）：复用 branding.ts 的元素工厂，减动效与 404 两路回落都在厂里。 */
const sidebarMark: CSSProperties = { borderRadius: 6, display: 'block', objectFit: 'contain' }

/** 侧栏品牌名：容器已给官方排版，这里只补「长了就省略」这一条。 */
const sidebarName: CSSProperties = {
  display: 'block',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/** Hero 品牌位：官方把 `.fish` 类传进来（display:block／transform-origin／鱼游动效），直接落在图上。 */
const heroMark: CSSProperties = { display: 'block', objectFit: 'contain' }

/**
 * 侧栏品牌位占用者。`ownerProps` 是官方的 `{ size: 24 }`（槽位目录 SidebarBrandMarkOwnerProps）。
 * 未配置品牌返回 null——但**降级不靠这个 null**：本组件只在「品牌视图 custom === true」时才被注册，
 * 因此返回 null 只是防御性的第二道闸（见 bindEnterpriseBrandSeat）。
 */
export function EnterpriseSidebarBrandMark(props: EnterpriseBrandOccupantProps & { readonly size?: number | undefined }): ReactNode {
  if (!props.view.custom) return null
  return createElement(EnterpriseBrandMark, {
    fallback: DSHENT_ANIMATED_ICON,
    size: props.size ?? 24,
    src: props.view.logoSrc,
    staticFallback: DSHENT_ICON,
    staticSrc: props.view.staticLogoSrc,
    style: sidebarMark,
  })
}

/**
 * 侧栏品牌名占用者。`ownerProps` 是官方的 `{}`（SidebarBrandNameOwnerProps 只有 `children?: never`），
 * 内容与宽度都归占用者自己；外层 `.brandName` 已给 18px/600/letter-spacing .04em，这里不再抄一份排版。
 */
export function EnterpriseSidebarBrandName(props: EnterpriseBrandOccupantProps): ReactNode {
  if (!props.view.custom) return null
  return createElement('span', { style: sidebarName }, enterpriseBrandSeatName(props.view))
}

/**
 * 「新会话」Hero 品牌位占用者。官方 `HeroShell`（`dsh-client-ui-conversation/lib/client.js:15680-15683`）
 * 传 `{ size: 34, className: <HeroShell .fish> }`，`className` 必须接住并落在图上（官方注释：Host class
 * preserving the surrounding mark geometry）；`size` 是 ownerProps 声明的正方形边长。
 */
export function EnterpriseHeroBrandMark(
  props: EnterpriseBrandOccupantProps & { readonly size?: number | undefined; readonly className?: string | undefined },
): ReactNode {
  if (!props.view.custom) return null
  return createElement('img', {
    'alt': '',
    'aria-hidden': true,
    'className': props.className,
    'height': props.size ?? 34,
    'onError': seatImageFallback,
    'src': props.view.staticLogoSrc,
    'style': heroMark,
    'width': props.size ?? 34,
  })
}

/** 品牌座位源：非 React 的薄外部 store，形状与 `useAccount` 一致（subscribe/getSnapshot），供 slot 注册面使用。 */
export interface EnterpriseBrandingSeats {
  /** 启动取数（幂等）；返回注销（含中止在途请求）。 */
  start(): () => void
  /** 当前品牌视图；必然可渲染。 */
  view(): EnterpriseBrandingView
  /** 视图变化订阅；返回注销。 */
  subscribe(listener: () => void): () => void
}

/** 占用者真正消费的字段：变了才需要重注册（重注册＝重新渲染，避免无意义的重挂载）。 */
function seatViewKey(view: EnterpriseBrandingView): string {
  return [view.custom, view.name, view.shortName, view.logoSrc, view.staticLogoSrc].join('\u0000')
}

/**
 * 建一份品牌座位源：挂载即读一次本机只读路由，并在「Server 地址 / 连接状态」变化后重读
 * ——与 `useEnterpriseBranding` 同一份 deps 口径（同一个 key、同一条路由、同一个 `resolveEnterpriseBranding`），
 * 差别只在它必须是 hook-free 的：slot 注册发生在 `apply(ctx)` 里，那里没有 React 渲染上下文。
 * 读取失败（未配置、Host 没装品牌、旧版 Host 无此路由）一律回落内置视图，绝不抛给界面。
 */
export function createEnterpriseBrandingSeats(store: EnterpriseAccountStore): EnterpriseBrandingSeats {
  let view = resolveEnterpriseBranding(null)
  let key: string | undefined
  let started = false
  let unsubscribe: (() => void) | undefined
  let inFlight: AbortController | undefined
  const listeners = new Set<() => void>()

  const apply = (document: EnterpriseBrandingDocument | null): void => {
    const next = resolveEnterpriseBranding(document)
    if (seatViewKey(next) === seatViewKey(view)) return
    view = next
    // 逐个复制：订阅者在回调里注销自己也不影响本轮派发。
    for (const listener of [...listeners]) listener()
  }

  const read = (): void => {
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller
    void store.api.branding(controller.signal).then(
      document => { if (!controller.signal.aborted) apply(document) },
      () => { if (!controller.signal.aborted) apply(null) },
    )
  }

  const sync = (): void => {
    const status = store.getSnapshot().status
    const next = `${status?.platformUrl ?? ''}#${status?.state ?? ''}`
    if (next === key) return
    key = next
    read()
  }

  return {
    start(): () => void {
      if (started) return () => undefined
      started = true
      unsubscribe = store.subscribe(sync)
      sync()
      return () => {
        started = false
        unsubscribe?.()
        unsubscribe = undefined
        inFlight?.abort()
        inFlight = undefined
      }
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    view: () => view,
  }
}

/** slot 服务上本层用到的两个方法（与 client.tsx 的 SlotContextPort.slots 同形）。 */
export interface EnterpriseBrandSeatPorts {
  inject(name: string, register: () => unknown): unknown
  register(options: Readonly<Record<string, unknown>>, component: (props: never) => ReactNode): unknown
}

/**
 * 把一个座位接到 slot 服务上，注册面由品牌视图驱动。
 *
 * 为什么不是「无条件注册 + 未配置返回 null」：single 槽只要存在 occupant 就直接渲染它
 * （`dsh-client-ui-renderer/lib/client.js:988-990`：`const entry = host.entriesOfSlot(key)[0];
 * if (!entry) return … opts.fallback; return guarded(entry, …)`），occupant 返回 null 只会让这一格**空掉**
 * ——官方鱼标与 HeroFish 都不会回来。所以未配置/取数失败时我们**撤掉自己的注册**：侧栏退回官方
 * `client-ui-brand-official`（priority 0），Hero 退回官方 `{ fallback: HeroFish }`，官方行为一字不变。
 *
 * @returns 该座位的注销器（由 `ctx.slots.inject` 的 effect 生命周期接管）。
 */
export function bindEnterpriseBrandSeat(
  ports: EnterpriseBrandSeatPorts,
  seats: EnterpriseBrandingSeats,
  seat: EnterpriseBrandSeat,
  component: (props: never) => ReactNode,
): unknown {
  return ports.inject(seat.name, () => {
    let dispose: (() => void) | undefined
    let registered: string | undefined
    const sync = (): void => {
      const current = seats.view()
      if (!current.custom) {
        // 未配置 / 取数失败：一格都不占，官方继续负责这一格。
        dispose?.()
        dispose = undefined
        registered = undefined
        return
      }
      const next = seatViewKey(current)
      if (registered === next) return
      // 先撤再注册：single 槽同 priority 重复注册会抛错，且视图变了要重新渲染占用者。
      dispose?.()
      dispose = ports.register({
        name: seat.name,
        priority: seat.priority,
        inject: () => ({ view: seats.view() }),
      }, component) as (() => void) | undefined
      registered = next
    }
    const off = seats.subscribe(sync)
    sync()
    return () => {
      off()
      dispose?.()
      dispose = undefined
      registered = undefined
    }
  })
}
