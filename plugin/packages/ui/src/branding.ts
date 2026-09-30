/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useState、brand 的两张内置位图、account-state 的共享脱敏订阅与 local-api 的只读品牌端口
 * [OUTPUT]: 提供内置品牌真源 ENTERPRISE_BUILTIN_BRANDING、逐字段回落的 resolveEnterpriseBranding、只收同源本地副本的 enterpriseBrandingLogoUrl、元素工厂 EnterpriseBrandMark 与读取 hook useEnterpriseBranding
 * [POS]: dsh-ui 的品牌读取层，把「Host 到底有没有企业品牌」收敛成一份必然可渲染的品牌视图；任何失败都回落内置，登录弹窗与菜单头部共用这一份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from './brand.js'

/** 品牌契约（docs/branding-customization-plan.md §3）在浏览器侧的形状；LOGO 三个槽位是本地只读副本地址或 null。 */
export interface EnterpriseBrandingLogoSet {
  readonly light: string | null
  readonly dark: string | null
  readonly square: string | null
}

export interface EnterpriseBrandingWelcome {
  readonly headline: string
  readonly editionLabel: string
}

export interface EnterpriseBrandingDocument {
  readonly revision: number
  readonly name: string
  readonly shortName: string
  readonly logo: EnterpriseBrandingLogoSet
  readonly welcome: EnterpriseBrandingWelcome
  readonly updatedAt: string
}

/** 后台未配置或不可达时的唯一内置品牌：文案取自本插件原有的硬编码产品名与规划 §2 的内置欢迎语/版本标识。 */
export const ENTERPRISE_BUILTIN_BRANDING = {
  editionLabel: '预览版',
  headline: '探索未至之境',
  name: 'DSH Enterprise',
  shortName: 'DSH Enterprise',
} as const

/**
 * 浏览器只接受本地只读副本地址：企业后台给的远端 URL 由 Host 下载并改写成本地路径，
 * 因此这里拒绝任何 data:/javascript:/外站/路径穿越写法，异常来源一律退回内置位图。
 */
const BRANDING_ASSET_SOURCE = /^\/enterprise\/api\/v1\/local\/branding\/asset\/(?:light|dark|square)\?v=\d{1,19}$/

/** 交付给界面的一份品牌视图：每个字段都必然可渲染，调用方不需要再判空。 */
export interface EnterpriseBrandingView {
  readonly name: string
  /** 紧凑位（菜单头部）用的简称；后台没给就等于名称。 */
  readonly shortName: string
  readonly headline: string
  readonly editionLabel: string
  /** 登录弹窗主视觉（动效优先）。 */
  readonly logoSrc: string
  /** 减动效分支与菜单头部使用的静态位图。 */
  readonly staticLogoSrc: string
  /** 是否来自企业后台配置；false 表示全部字段都是内置默认。 */
  readonly custom: boolean
}

/** 校验 Host 投影出的 LOGO 来源；非法值返回 undefined 由调用方回落。 */
export function enterpriseBrandingLogoUrl(value: unknown): string | undefined {
  return typeof value === 'string' && BRANDING_ASSET_SOURCE.test(value) ? value : undefined
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

/**
 * 把 Host 文档折叠成界面视图：逐字段回落内置默认，LOGO 逐个槽位回落内置位图。
 * B2 不区分宿主深浅主题，`logo.dark` 只作为 `logo.light` 缺席时的回落（主题化在 B4）。
 *
 * @param document - Host 投影；null 表示企业未配置品牌或取数失败。
 * @returns 必然可渲染的品牌视图。
 */
export function resolveEnterpriseBranding(document: EnterpriseBrandingDocument | null | undefined): EnterpriseBrandingView {
  const light = enterpriseBrandingLogoUrl(document?.logo.light)
  const dark = enterpriseBrandingLogoUrl(document?.logo.dark)
  const square = enterpriseBrandingLogoUrl(document?.logo.square)
  const name = text(document?.name, ENTERPRISE_BUILTIN_BRANDING.name)
  const staticLogoSrc = light ?? dark ?? square ?? DSHENT_ICON
  return {
    custom: document !== null && document !== undefined,
    editionLabel: text(document?.welcome.editionLabel, ENTERPRISE_BUILTIN_BRANDING.editionLabel),
    headline: text(document?.welcome.headline, ENTERPRISE_BUILTIN_BRANDING.headline),
    logoSrc: light ?? dark ?? DSHENT_ANIMATED_ICON,
    name,
    shortName: text(document?.shortName, name === ENTERPRISE_BUILTIN_BRANDING.name
      ? ENTERPRISE_BUILTIN_BRANDING.shortName
      : name),
    staticLogoSrc,
  }
}

export interface EnterpriseBrandMarkProps {
  /** 主来源；与 staticSrc 同为本地副本地址或内置位图。 */
  readonly src: string
  readonly staticSrc: string
  /** 副本 404 或解码失败时的内置回落（动效与静态两份）。 */
  readonly fallback: string
  readonly staticFallback: string
  readonly size: number
  readonly style?: CSSProperties | undefined
}

/**
 * 品牌位图元素工厂：`prefers-reduced-motion` 走静态分支，加载失败就地换成内置位图。
 * 用 createElement 而不是 JSX，是为了让读取层留在 .ts 里与本包既有风格一致。
 */
export function EnterpriseBrandMark(props: EnterpriseBrandMarkProps): ReactNode {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [props.src, props.staticSrc])
  return createElement('picture', null,
    createElement('source', {
      media: '(prefers-reduced-motion: reduce)',
      srcSet: failed ? props.staticFallback : props.staticSrc,
    }),
    createElement('img', {
      'alt': '',
      'aria-hidden': true,
      'height': props.size,
      'onError': () => { setFailed(true) },
      'src': failed ? props.fallback : props.src,
      'style': props.style,
      'width': props.size,
    }),
  )
}

/**
 * 读取 Host 的品牌投影。挂载即读一次本地只读路由，并在「Server 地址 / 连接状态」变化后重读
 * ——Host 正好在这两个时点各拉一次企业接口，因此浏览器不需要任何轮询。
 * 读取失败（未配置、Host 没装品牌、旧版 Host 无此路由）一律回落内置，绝不抛给界面。
 */
export function useEnterpriseBranding(store: EnterpriseAccountStore): EnterpriseBrandingView {
  const status = useAccount(store).status
  const key = `${status?.platformUrl ?? ''}#${status?.state ?? ''}`
  const [document, setDocument] = useState<EnterpriseBrandingDocument | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void store.api.branding(controller.signal).then(
      value => { if (!controller.signal.aborted) setDocument(value) },
      () => { if (!controller.signal.aborted) setDocument(null) },
    )
    return () => { controller.abort() }
  }, [store, key])
  return resolveEnterpriseBranding(document)
}
