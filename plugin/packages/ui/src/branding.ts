/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useState、brand 的两张内置位图、account-state 的共享脱敏订阅与 local-api 的只读品牌端口
 * [OUTPUT]: 提供内置品牌真源 ENTERPRISE_BUILTIN_BRANDING、逐字段回落的 resolveEnterpriseBranding、只收同源本地副本的 enterpriseBrandingLogoUrl、元素工厂 EnterpriseBrandMark 与读取 hook useEnterpriseBranding **本刀（取数失败不再与「未配置」混同）**：新增读态投影 `enterpriseBrandingReadState`、「企业标识」取值投影 `enterpriseBrandingIdentityValue`、会话内记忆 `rememberEnterpriseBranding` / `recallEnterpriseBranding` 与读取结果类型 `EnterpriseBrandingRead`（readState + 稳定码 + retry）。
 * [POS]: dsh-ui 的品牌读取层，把「Host 到底有没有企业品牌」收敛成一份必然可渲染的品牌视图；任何失败都回落内置，登录弹窗与菜单头部共用这一份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from './brand.js'
// 只借「异常 → 稳定码」这一份唯一投影（本仓不许第二套码表）；运行期只在失败分支调用，故这条模块环无副作用。
import { enterpriseLocalErrorCode } from './local-api.js'

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

/** 「企业设置 → 账号」那行「企业标识」的标签（术语降维：说「企业标识」，不说 logo/branding）。 */
export const ENTERPRISE_BRANDING_IDENTITY_LABEL = '企业标识'
/** 企业确实没配品牌时那行的取值（如实说「未配置」，不是错误）。 */
export const ENTERPRISE_BRANDING_BUILTIN_VALUE = '默认标识（企业未配置）'
/** 品牌取数失败时那行的取值（如实说「读不到」，不长篇大论、也不弹窗打断）。 */
export const ENTERPRISE_BRANDING_UNAVAILABLE_VALUE = '暂时无法读取'
/** 品牌取数失败提示的动作前缀（人话与下一步取 `error-messages.ts` 的唯一映射）。 */
export const ENTERPRISE_BRANDING_READ_FAILED = '企业标识暂时无法读取'
/**
 * 品牌读取的**三态**：
 *  · `configured` 读到企业品牌；
 *  · `builtin` 企业**没有配置**（Host 明确回 null）——按产品口径继续静默回落内置，不打扰；
 *  · `unavailable` **取数失败**（Host/本机路由出错）——与「没配置」是两件事，必须让员工看得出来。
 */
export type EnterpriseBrandingReadState = 'configured' | 'builtin' | 'unavailable'

/**
 * 由「这次读到什么 + 有没有失败码」投影出读态（纯函数，测试直调）。
 *
 * 这条投影就是本刀的核心裁定：**未配置 → builtin（保留静默）**；
 * **取数失败 → unavailable（显式可见 + 可重试）**；两者绝不再混成同一个 `null`。
 */
export function enterpriseBrandingReadState(
  document: EnterpriseBrandingDocument | null | undefined,
  code: string | undefined,
): EnterpriseBrandingReadState {
  if (code !== undefined) return 'unavailable'
  return document === null || document === undefined ? 'builtin' : 'configured'
}

/**
 * 「企业标识」那一行的取值投影（纯函数）：三态各说各的，**不让员工从默认标识推出「公司没配」**。
 */
export function enterpriseBrandingIdentityValue(readState: EnterpriseBrandingReadState, name: string): string {
  if (readState === 'unavailable') return ENTERPRISE_BRANDING_UNAVAILABLE_VALUE
  if (readState === 'builtin') return ENTERPRISE_BRANDING_BUILTIN_VALUE
  return name
}

/** 品牌读取层交给界面的东西：可渲染的品牌视图 + 读态 + （失败时的）稳定码 + 重试。 */
export interface EnterpriseBrandingRead extends EnterpriseBrandingView {
  readonly readState: EnterpriseBrandingReadState
  /** 取数失败时的稳定码（`ENT_*`）；其余情况 undefined。 */
  readonly code?: string | undefined
  /** 重新读一次（真的重发那条只读请求）。 */
  readonly retry: () => void
}

/**
 * 会话内记住「最后一次读到的品牌文档」（键 = Server 地址 # 连接状态）。
 *
 * 只做**会话内**记忆，不做持久化缓存（那是 P0-6 的另一刀）：它的作用是在同一次会话里
 * 一次重读失败不要把已经渲染出来的企业品牌**突然换回官方鱼标**（换租户时键会变，旧文档自然不复用）。
 */
let rememberedBrandingKey: string | undefined
let rememberedBrandingDocument: EnterpriseBrandingDocument | null = null

/** 记住本次读到的品牌文档（成功与否都记：`null` 也记，代表「这家企业确实没配」）。 */
export function rememberEnterpriseBranding(key: string, document: EnterpriseBrandingDocument | null): void {
  rememberedBrandingKey = key
  rememberedBrandingDocument = document
}

/** 取回本会话记住的品牌文档；键（Server 地址 # 连接状态）变了即不复用。 */
export function recallEnterpriseBranding(key: string): EnterpriseBrandingDocument | null {
  return rememberedBrandingKey === key ? rememberedBrandingDocument : null
}

/**
 * 读取 Host 的品牌投影。挂载即读一次本地只读路由，并在「Server 地址 / 连接状态」变化后重读
 * ——Host 正好在这两个时点各拉一次企业接口，因此浏览器不需要任何轮询。
 *
 * **本刀（失败自愈）**：读失败时**不再与「未配置」混同**——保留稳定码并把 `readState` 标成
 * `unavailable`，界面因此在**唯一一处**（企业设置 → 账号的「企业标识」行）如实说明「暂时读不到、
 * 现在显示默认标识」+ 可重试；侧栏与登录弹窗继续静默回落官方（视觉不闪、不叠错误、不打断）。
 *
 * @param store - 企业账号共享 store（用它的只读品牌端口）。
 * @returns 品牌视图 + 读态 + 失败码 + 重试。
 */
export function useEnterpriseBranding(store: EnterpriseAccountStore): EnterpriseBrandingRead {
  const status = useAccount(store).status
  const key = `${status?.platformUrl ?? ''}#${status?.state ?? ''}`
  const [document, setDocument] = useState<EnterpriseBrandingDocument | null>(null)
  const [code, setCode] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    // 先用本会话记住的那份顶上（重读期间不把已渲染的企业品牌抖回默认）。
    setDocument(recallEnterpriseBranding(key))
    setCode(undefined)
    void store.api.branding(controller.signal).then(
      value => {
        if (controller.signal.aborted) return
        rememberEnterpriseBranding(key, value)
        setDocument(value)
        setCode(undefined)
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        // 失败：能回退到本会话记住的那份就回退（企业品牌不断），同时把失败码摆出来（可见、可重试）。
        setDocument(recallEnterpriseBranding(key))
        setCode(enterpriseLocalErrorCode(error))
      },
    )
    return () => { controller.abort() }
  }, [store, key, attempt])
  const view = resolveEnterpriseBranding(document)
  return {
    ...view,
    readState: enterpriseBrandingReadState(document, code),
    code,
    retry: () => { setAttempt(current => current + 1) },
  }
}
