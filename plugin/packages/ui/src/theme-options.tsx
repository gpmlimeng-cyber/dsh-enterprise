/**
 * [INPUT]: 依赖 React 的 useSyncExternalStore、Lucide 的 SunMoon，以及宿主 ui-theme 服务的 getTheme/setTheme 与 theme/change 事件
 * [OUTPUT]: 对外提供偏好词表 ENTERPRISE_THEME_PREFERENCES 与窄化 isEnterpriseThemePreference、官方主题只读源 createEnterpriseThemeSource/EnterpriseThemeSource（服务晚到时补发通知）、共享订阅 useEnterpriseTheme、选项组模型 enterpriseThemeRow、点击写入 selectEnterpriseTheme 与分段组件 EnterpriseThemeOptionGroup
 * [POS]: dsh-ui 个人中心菜单内的外观选项组；把官方主题偏好翻译成「读回/写入/订阅」三个端口，不持有第二份偏好，也不直接改 DOM class
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { SunMoon } from 'lucide-react'
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'

/** 官方内置主题偏好全集（ui-theme 的 THEME_PREFERENCES）；这里只做窄化，不另立枚举。 */
export const ENTERPRISE_THEME_PREFERENCES = ['light', 'dark', 'system'] as const

export type EnterpriseThemePreference = typeof ENTERPRISE_THEME_PREFERENCES[number]

/** 分段文案与官方外观行同一组偏好，顺序与官方 AppearanceRow 的三个立方一致。 */
const THEME_LABELS: Readonly<Record<EnterpriseThemePreference, string>> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

const THEME_ROW_LABEL = '外观'

export function isEnterpriseThemePreference(value: unknown): value is EnterpriseThemePreference {
  return ENTERPRISE_THEME_PREFERENCES.some(preference => preference === value)
}

/** 官方 ThemeRuntime 的消费面：getTheme 读回持久化偏好，setTheme 是唯一写入入口。 */
export interface EnterpriseThemeService {
  getTheme(): { readonly preference: string }
  setTheme(id: string): void
}

/** 宿主 Context 里本模块真正用到的三项能力：服务读取、主题变更事件与等待服务出现。 */
export interface EnterpriseThemeContextPort {
  get(name: string): unknown
  on(event: 'theme/change', listener: () => void): () => void
  /** 以子插件等待服务出现；本插件不因 ui-theme 缺席而停摆。 */
  inject(deps: readonly string[], callback: () => void): unknown
}

export interface EnterpriseThemeSource {
  /** 当前持久化偏好；宿主没提供官方主题服务时是 undefined，组件据此整体禁用。 */
  getSnapshot(): EnterpriseThemePreference | undefined
  /** 写入官方偏好；服务缺席时什么都不做，绝不回落到本地 state。 */
  setPreference(preference: EnterpriseThemePreference): void
  subscribe(listener: () => void): () => void
}

/** 官方主题服务缺席时的空源：让组件无条件保持同一套 hook 顺序。 */
export const ENTERPRISE_THEME_ABSENT: EnterpriseThemeSource = {
  getSnapshot: () => undefined,
  setPreference: () => undefined,
  subscribe: () => () => undefined,
}

/**
 * 按需解析官方主题服务：`ctx.get('theme')` 每次读取都问一次服务表，
 * 因此即使 ui-theme 在本插件之后才 provide，外观选项组也能读到它。
 */
function themeService(context: EnterpriseThemeContextPort): EnterpriseThemeService | undefined {
  const service = context.get('theme')
  if (typeof service !== 'object' || service === null) return undefined
  const candidate = service as { getTheme?: unknown; setTheme?: unknown }
  if (typeof candidate.getTheme !== 'function' || typeof candidate.setTheme !== 'function') return undefined
  return service as EnterpriseThemeService
}

/**
 * 把官方主题服务包成只读源：读回与写入都直接落在官方运行时上，订阅只转发 `theme/change`。
 * 首个订阅者建立事件监听，最后一个订阅者离开时释放，插件卸载时由 Cordis 归还剩余监听。
 * ui-theme 的注入面（locale/configForms）比本插件宽，冷启动必然晚于本插件 provide，
 * 因此另外等一次服务出现并补发通知，已挂载的选项组立刻重读，而不是停在禁用态等下一次渲染。
 */
export function createEnterpriseThemeSource(context: EnterpriseThemeContextPort): EnterpriseThemeSource {
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of [...listeners]) listener() }
  let off: (() => void) | undefined
  context.inject(['theme'], notify)
  return {
    getSnapshot: () => {
      const preference = themeService(context)?.getTheme().preference
      return isEnterpriseThemePreference(preference) ? preference : undefined
    },
    setPreference: (preference) => { themeService(context)?.setTheme(preference) },
    subscribe: (listener) => {
      listeners.add(listener)
      off ??= context.on('theme/change', notify)
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        off?.()
        off = undefined
      }
    },
  }
}

/** 菜单渲染用的只读订阅：值就是官方偏好本身；宿主没有主题服务时恒为 undefined。 */
export function useEnterpriseTheme(source: EnterpriseThemeSource | undefined): EnterpriseThemePreference | undefined {
  const resolved = source ?? ENTERPRISE_THEME_ABSENT
  return useSyncExternalStore(resolved.subscribe, resolved.getSnapshot, resolved.getSnapshot)
}

export interface EnterpriseThemeOption {
  readonly id: EnterpriseThemePreference
  readonly label: string
  readonly selected: boolean
  readonly disabled: boolean
}

export interface EnterpriseThemeRowModel {
  readonly label: string
  readonly options: readonly EnterpriseThemeOption[]
}

/** 选项组模型：选中态只由官方回读的偏好决定；偏好读不到（无主题服务或取值非法）时整组禁用。 */
export function enterpriseThemeRow(preference: EnterpriseThemePreference | undefined): EnterpriseThemeRowModel {
  return {
    label: THEME_ROW_LABEL,
    options: ENTERPRISE_THEME_PREFERENCES.map(id => ({
      id,
      label: THEME_LABELS[id],
      selected: preference === id,
      disabled: preference === undefined,
    })),
  }
}

/** 点击分段的唯一副作用入口：选中态没变化就不写，避免重复持久化。 */
export function selectEnterpriseTheme(
  source: EnterpriseThemeSource | undefined,
  current: EnterpriseThemePreference | undefined,
  next: EnterpriseThemePreference,
): void {
  if (current === next) return
  source?.setPreference(next)
}

const row: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: 10,
  justifyContent: 'space-between',
  padding: '6px 10px',
}

const rowLabel: CSSProperties = {
  alignItems: 'center',
  color: 'inherit',
  display: 'flex',
  fontSize: 13,
  gap: 10,
  lineHeight: '20px',
  minWidth: 0,
}

const rowIcon: CSSProperties = {
  alignItems: 'center',
  color: 'var(--dsw-alias-menu-icon, var(--dsw-alias-label-tertiary, #667085))',
  display: 'inline-flex',
  flex: 'none',
  height: 16,
  justifyContent: 'center',
  width: 16,
}

/** 分段样式照 jingyun 的胶囊几何（2px 内衬、11px 字号、3px 10px 内距），颜色全部取宿主 token。 */
const styles = `
      .own-theme-seg { background: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06)); border-radius: 8px; display: flex; flex: none; gap: 2px; padding: 2px; }
      .own-theme-seg-btn { background: transparent; border: 0; border-radius: 6px; color: var(--dsw-alias-label-tertiary, #667085); cursor: pointer; font: inherit; font-size: 11px; font-weight: 400; line-height: 16px; padding: 3px 10px; transition: background-color 0.15s ease, color 0.15s ease; white-space: nowrap; }
      .own-theme-seg-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(38, 49, 72, 0.14)); color: var(--dsw-alias-label-primary, #101828); }
      .own-theme-seg-btn:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 1px; }
      .own-theme-seg-btn:disabled { cursor: not-allowed; opacity: 0.4; }
      .own-theme-seg-btn-active { background: var(--dsw-alias-bg-layer-1, #ffffff); box-shadow: var(--dsw-elevation-soft, 0 1px 3px rgba(0, 0, 0, 0.12)); color: var(--dsw-alias-label-primary, #101828); font-weight: 600; }
      .own-theme-seg-btn-active:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-1, #ffffff); }
      @media (prefers-reduced-motion: reduce) { .own-theme-seg-btn { transition: none; } }
`

export interface EnterpriseThemeOptionGroupProps {
  /** 官方主题源；宿主未提供 ui-theme 时为 undefined，整组禁用而非假装已选。 */
  readonly source?: EnterpriseThemeSource | undefined
}

/** 菜单内的外观选项组：只读官方偏好决定选中态，点击写回官方主题运行时。 */
export function EnterpriseThemeOptionGroup(props: EnterpriseThemeOptionGroupProps): ReactNode {
  const preference = useEnterpriseTheme(props.source)
  const model = enterpriseThemeRow(preference)
  return <>
    <style>{styles}</style>
    <div style={row}>
      <span style={rowLabel}>
        <span aria-hidden style={rowIcon}><SunMoon size={16} /></span>
        {model.label}
      </span>
      {/* 菜单里的单选组：语义按 menuitemradio 报读，选中态就是官方偏好本身。 */}
      <div aria-label={model.label} className="own-theme-seg" role="group">
        {model.options.map(option => <button
          key={option.id}
          aria-checked={option.selected}
          className={option.selected ? 'own-theme-seg-btn own-theme-seg-btn-active' : 'own-theme-seg-btn'}
          disabled={option.disabled}
          onClick={() => { selectEnterpriseTheme(props.source, preference, option.id) }}
          role="menuitemradio"
          type="button"
        >{option.label}</button>)}
      </div>
    </div>
  </>
}
