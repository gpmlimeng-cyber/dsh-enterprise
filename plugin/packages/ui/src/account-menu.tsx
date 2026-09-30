/**
 * [INPUT]: 依赖 React（含 Ref/ReactElement 类型）、Lucide、官方 ui-primitives 的 useAnchoredPosition/useDismissOnOutsidePointer、account-state 的账号投影与状态文案、login-dialog 的入口投影与弹窗、account-view 的登出确认、theme-options 的外观选项组，以及 EnterpriseAccountStore 的脱敏快照
 * [OUTPUT]: 对外提供入口决策 enterpriseMenuEntryPath、菜单纯决策 enterpriseAccountMenu/enterpriseMenuSections/enterpriseMenuTransition/enterpriseMenuCommandEffects/applyEnterpriseMenuEffects、触发按钮元素工厂 enterpriseMenuTriggerElement、注入样式表 ENTERPRISE_MENU_STYLES 与菜单组件 EnterpriseAccountMenu，后者占据官方 settings.launcher 座位
 * [POS]: dsh-ui 唯一的侧栏账号入口，照官方占用者语义：任何登录态点击都先弹菜单，未登录时首项「登录」才打开登录弹窗，因此「外观」与「设置」对未登录用户始终可达；设置项交还宿主 openSettings() 打开官方设置面板。触发按钮的几何与全部交互态只由 ENTERPRISE_MENU_STYLES 的类规则持有，元素本身不带内联样式——内联 background 的内联优先级会压掉 :hover，折叠与未登录两态也无法由属性规则覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { LoaderCircle, LogIn, LogOut, MoreHorizontal, Settings, UserRound } from 'lucide-react'
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  ENTERPRISE_LOADING_PRESENTATION,
  enterpriseAccountIdentity,
  enterpriseLoginInFlight,
  enterpriseStatePresentation,
  useAccount,
  type EnterpriseAccountIdentity,
} from './account-state.js'
import type { EnterpriseAccountAction, EnterpriseAccountStore } from './account-store.js'
import { LogoutConfirmation, type EnterpriseStoreInjected } from './account-view.js'
import {
  enterpriseLoginEntry,
  EnterpriseLoginDialog,
  useEnterpriseLoginDialog,
} from './login-dialog.js'
import type { EnterpriseConnectionState } from './local-api.js'
import { EnterpriseThemeOptionGroup, type EnterpriseThemeSource } from './theme-options.js'

/** 菜单里唯一可被选中的四个命令；分组由模型给出，顺序即视觉顺序。 */
export type EnterpriseMenuCommand = 'login' | 'progress' | 'logout' | 'settings'

/** 入口去向只有菜单一条：官方 settings.launcher 座位上的按钮是菜单触发器，未登录也一样。 */
export type EnterpriseMenuEntryPath = 'menu'

/**
 * 入口决策的唯一出口。官方占用者（`ui-settings-account` 的 AccountMenu）对任何登录态都弹菜单，
 * 未登录时只是把菜单里的 `signout` 换成 `signin`；本实现照此办理，未登录直开登录弹窗会让
 * 「设置」与「外观」失去入口（齿轮 fallback 只在座位空时渲染），所以这里恒返回菜单。
 * 参数说明判定输入域，答案不再依赖它们。
 */
export function enterpriseMenuEntryPath(
  _state: EnterpriseConnectionState | undefined,
  _busy: EnterpriseAccountAction | undefined,
): EnterpriseMenuEntryPath {
  return 'menu'
}

export interface EnterpriseMenuItem {
  readonly id: EnterpriseMenuCommand
  readonly label: string
  readonly disabled: boolean
  /** 破坏性动作：错误色文字、图标与危险悬停底色。 */
  readonly danger?: boolean
}

/** 菜单的全部呈现事实：头部两行、首字头像、触发按钮文案，以及三组行项（组间画分隔线）。 */
export interface EnterpriseAccountMenuModel {
  readonly title: string
  readonly detail: string
  readonly initial: string
  /** 头部与头像位是否按账号信息呈现：已连接与登录中为真，未登录为假（显示「未登录」与状态引导语）。 */
  readonly presentsAccount: boolean
  /** 触发按钮文案：官方 `t('more')` 的「更多」，或已连接时的昵称。 */
  readonly triggerLabel: string
  /** 账号动作组：未登录是首项「登录」，登录中是「查看登录进度」，已连接为空。 */
  readonly account: readonly EnterpriseMenuItem[]
  /** 设置组：始终一条，选中后由宿主打开官方设置面板。 */
  readonly settings: EnterpriseMenuItem
  /** 会话组：只有可用会话才有「退出登录」，走既有确认路径。 */
  readonly session: readonly EnterpriseMenuItem[]
}

/** 未登录与登录中的触发文案，取值同官方 zh 词表 `more: '更多'`：入口现在是菜单，不再自称登录按钮。 */
const TRIGGER_MORE_LABEL = '更多'

export interface EnterpriseAccountMenuInput {
  readonly state: EnterpriseConnectionState | undefined
  readonly busy: EnterpriseAccountAction | undefined
  readonly identity: EnterpriseAccountIdentity
}

/** 头像圈内的首字符：CJK 单字与代理对都取第一个完整字符，空名回落品牌首字母。 */
function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? 'D'
}

/**
 * 菜单模型：行项集合随登录态变化，文案复用账号区的状态映射，不新增第二套词汇。
 * 已连接显示昵称加登录名/部门；登录中身份可能已从 bootstrap 取到，同样按账号信息呈现，
 * 不再回落「未登录」；其余状态显示「未登录」加当前状态的引导语。部门未知时不出现在这一行里，
 * 让「未设置部门」这类占位不进入菜单头部。
 */
export function enterpriseAccountMenu(input: EnterpriseAccountMenuInput): EnterpriseAccountMenuModel {
  const entry = enterpriseLoginEntry(input.state, input.busy)
  const presentation = input.state === undefined
    ? ENTERPRISE_LOADING_PRESENTATION
    : enterpriseStatePresentation(input.state)
  const usable = entry.action === 'logout'
  const inFlight = enterpriseLoginInFlight(input.state)
  const identified = usable || inFlight
  const detail = [input.identity.loginName, input.identity.isDepartmentKnown ? input.identity.department : '']
    .filter(part => part !== '').join(' · ')
  const account: readonly EnterpriseMenuItem[] = inFlight
    ? [{ id: 'progress', label: '查看登录进度', disabled: false }]
    : usable ? [] : [{ id: 'login', label: '登录', disabled: entry.disabled }]
  return {
    title: identified ? input.identity.displayName : '未登录',
    detail: identified && detail !== '' ? detail : presentation.description,
    initial: initialOf(input.identity.displayName),
    presentsAccount: identified,
    triggerLabel: usable ? input.identity.displayName : TRIGGER_MORE_LABEL,
    account,
    settings: { id: 'settings', label: '设置', disabled: false },
    session: usable
      ? [{ id: 'logout', label: input.busy === 'logout' ? '正在退出' : '退出登录', disabled: entry.disabled, danger: true }]
      : [],
  }
}

/** 菜单分区；分区顺序即视觉顺序，组件按此渲染，测试据此锁定「登录 → 外观 → 设置」的次序。 */
export type EnterpriseMenuSection = 'account' | 'appearance' | 'settings' | 'session'

/**
 * 可见分区：外观选项组与设置项与登录态无关，任何状态下都在列；账号动作组只在有行项时出现
 * （未登录的「登录」是菜单第一项），会话组只在有可用会话时出现。
 */
export function enterpriseMenuSections(model: EnterpriseAccountMenuModel): readonly EnterpriseMenuSection[] {
  return [
    ...(model.account.length === 0 ? [] : ['account'] as const),
    'appearance',
    'settings',
    ...(model.session.length === 0 ? [] : ['session'] as const),
  ]
}

export interface EnterpriseMenuState {
  readonly open: boolean
}

export const ENTERPRISE_MENU_CLOSED: EnterpriseMenuState = { open: false }
export const ENTERPRISE_MENU_OPEN: EnterpriseMenuState = { open: true }

/** 一次转移要求界面做的副作用；`focus-menu` 只能由面板挂载后的布局效果兑现。 */
export type EnterpriseMenuEffect =
  | 'focus-menu'
  | 'focus-trigger'
  | 'open-login'
  | 'start-logout'
  | 'open-settings'
  | 'close-dialog'

export type EnterpriseMenuEvent =
  /**
   * 触发按钮：唯一去向是菜单。已打开就关闭，未打开就打开；弹窗开着时先关弹窗，
   * 菜单与弹窗不共存。登录弹窗只能由菜单里的「登录」/「查看登录进度」行打开。
   */
  | { readonly type: 'launch'; readonly dialogOpen: boolean }
  /** Esc 与外部点击：关闭并把焦点归还触发按钮。 */
  | { readonly type: 'dismiss' }
  /** 指针点击外部、或另一个界面（登录弹窗/设置面板）接管前台：只关闭，不抢焦点。 */
  | { readonly type: 'release' }
  | { readonly type: 'select'; readonly command: EnterpriseMenuCommand }
  /** 宿主报告设置面板已经打开：菜单让位，焦点归面板自己管理。 */
  | { readonly type: 'settings-open' }

export interface EnterpriseMenuTransition {
  readonly state: EnterpriseMenuState
  readonly effects: readonly EnterpriseMenuEffect[]
}

/**
 * 菜单路径的切换语义：已打开就关闭并把焦点归还触发按钮；未打开就打开，
 * 弹窗仍在前台时先让弹窗退场（菜单与弹窗不共存，登录中的取消语义由弹窗自己承担）。
 */
function toggleMenu(state: EnterpriseMenuState, dialogOpen: boolean): EnterpriseMenuTransition {
  if (state.open) return { state: ENTERPRISE_MENU_CLOSED, effects: ['focus-trigger'] }
  return {
    state: ENTERPRISE_MENU_OPEN,
    effects: dialogOpen ? ['close-dialog', 'focus-menu'] : ['focus-menu'],
  }
}

/**
 * 菜单开关的唯一状态机：开关、关闭与选中都不含隐式分支，关闭一律带着明确的焦点去向，
 * 打开则要求焦点进入菜单；入口没有第二条路，登录弹窗只由菜单行项打开。
 */
export function enterpriseMenuTransition(
  state: EnterpriseMenuState,
  event: EnterpriseMenuEvent,
): EnterpriseMenuTransition {
  switch (event.type) {
    case 'launch':
      return toggleMenu(state, event.dialogOpen)
    case 'dismiss':
      return state.open ? { state: ENTERPRISE_MENU_CLOSED, effects: ['focus-trigger'] } : { state, effects: [] }
    // 指针关闭与前方界面接管都只收回菜单，焦点留在用户或那个界面手上。
    case 'release':
    case 'settings-open':
      return state.open ? { state: ENTERPRISE_MENU_CLOSED, effects: [] } : { state, effects: [] }
    case 'select':
      if (!state.open) return { state, effects: [] }
      return { state: ENTERPRISE_MENU_CLOSED, effects: enterpriseMenuCommandEffects(event.command) }
  }
}

/** 选中一条行项的效果序列：先归还焦点，再打开下一个界面，那个界面关闭后回到触发按钮。 */
export function enterpriseMenuCommandEffects(command: EnterpriseMenuCommand): readonly EnterpriseMenuEffect[] {
  if (command === 'settings') return ['focus-trigger', 'open-settings']
  if (command === 'logout') return ['focus-trigger', 'start-logout']
  return ['focus-trigger', 'open-login']
}

/**
 * 面板按键到菜单事件的唯一映射：Esc 与 Tab 都关闭菜单并把焦点还给触发按钮
 * （调用方需阻止默认行为，否则浏览器会从被卸载的行项上继续找焦点）；方向键返回 undefined 由调用方处理。
 */
export function enterpriseMenuKeyEvent(key: string): EnterpriseMenuEvent | undefined {
  return key === 'Escape' || key === 'Tab' ? { type: 'dismiss' } : undefined
}

/** 转移效果落到具体能力上的目标表；退出确认的开启器只在它挂载的调用点交得出来。 */
export interface EnterpriseMenuTargets {
  readonly focusMenu: () => void
  readonly focusTrigger: () => void
  readonly openLogin: () => void
  readonly openSettings: () => void
  readonly closeDialog: () => void
  readonly startLogout?: (() => void) | undefined
}

/** 按转移给出的顺序执行效果；这是组件唯一触碰界面能力的地方。 */
export function applyEnterpriseMenuEffects(
  effects: readonly EnterpriseMenuEffect[],
  targets: EnterpriseMenuTargets,
): void {
  for (const effect of effects) {
    switch (effect) {
      case 'focus-menu': targets.focusMenu(); break
      case 'focus-trigger': targets.focusTrigger(); break
      case 'open-login': targets.openLogin(); break
      case 'start-logout': targets.startLogout?.(); break
      case 'open-settings': targets.openSettings(); break
      case 'close-dialog': targets.closeDialog(); break
    }
  }
}

/**
 * 菜单内可被方向键漫游的焦点项：四个行项，以及外观选项组的三段单选
 * （分段不是普通 menuitem，但同属菜单前台，必须能被方向键走到）。
 */
const FOCUSABLE_ITEM = 'button[role="menuitem"]:not([disabled]), button[role="menuitemradio"]:not([disabled])'
const MENU_LABEL = 'DSH Enterprise 账号菜单'

/** 官方 settings.launcher 座位：宽窄两态、设置面板开关、设置面板打开入口、快捷键展示与官方主题源。 */
export interface EnterpriseAccountMenuProps extends EnterpriseStoreInjected {
  readonly wide: boolean
  readonly settingsOpen?: boolean | undefined
  readonly openSettings: () => void
  readonly settingsShortcut?: { readonly keys: readonly string[]; readonly aria?: string | undefined } | undefined
  /** 官方主题偏好只读源；宿主没有 ui-theme 时为 undefined，外观选项组整体禁用。 */
  readonly theme?: EnterpriseThemeSource | undefined
}

/** 触发按钮的类名与两态属性：hover、折叠、未登录三条 CSS 规则都由它们开关。 */
const TRIGGER_CLASS = 'own-menu-trigger'
const TRIGGER_GLYPH_CLASS = 'own-menu-avatar'
const TRIGGER_LABEL_CLASS = 'own-menu-trigger-label'

/** 触发按钮的静态呈现事实：宽窄、登录态、文案、入口类型与当前连接状态。 */
export interface EnterpriseMenuTriggerView {
  readonly wide: boolean
  readonly signedIn: boolean
  readonly initial: string
  readonly label: string
  readonly ariaExpanded: boolean
  /** 入口决策的唯一答案，照官方占用者恒为 menu。 */
  readonly entryPath: EnterpriseMenuEntryPath
  readonly state: string | undefined
}

/** 触发按钮的行为接缝：ref 与两个事件处理器由调用方给出，元素工厂自身不持有状态。 */
export interface EnterpriseMenuTriggerHandlers {
  readonly ref: Ref<HTMLButtonElement>
  readonly onClick: () => void
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}

/**
 * 触发按钮的元素工厂：几何与全部交互态只在 `ENTERPRISE_MENU_STYLES` 的类规则里声明，这颗 button
 * 因此不带任何 `style`。这是缺陷根因的正面约束——内联 `background` 的内联优先级会压掉 `:hover`，
 * 折叠与未登录两态也必须由 `data-collapsed` / `data-signed-out` 属性规则覆盖，不能靠内联分叉。
 */
export function enterpriseMenuTriggerElement(
  view: EnterpriseMenuTriggerView,
  handlers: EnterpriseMenuTriggerHandlers,
): ReactElement {
  return <button
    ref={handlers.ref}
    aria-expanded={view.ariaExpanded}
    aria-haspopup={view.entryPath}
    aria-label={MENU_LABEL}
    className={TRIGGER_CLASS}
    data-collapsed={view.wide ? 'false' : 'true'}
    data-enterprise-menu-trigger=""
    data-enterprise-state={view.state}
    data-signed-out={view.signedIn ? 'false' : 'true'}
    onClick={handlers.onClick}
    onKeyDown={handlers.onKeyDown}
    title={MENU_LABEL}
    type="button"
  >
    {view.signedIn
      ? <span aria-hidden className={TRIGGER_GLYPH_CLASS} style={avatarColorSignedIn}>{view.initial}</span>
      : <span aria-hidden className={TRIGGER_GLYPH_CLASS} style={avatarColor}><MoreHorizontal size={view.wide ? 16 : 18} /></span>}
    {view.wide ? <span className={TRIGGER_LABEL_CLASS}>{view.label}</span> : null}
  </button>
}

/**
 * 头像/图标位只内联两套颜色：几何统一归 `.own-menu-avatar` 类规则，紧凑的未登录行才能在 20px
 * 圆内放得下图标而不被 `overflow: hidden` 切边；内联几何会再次压掉状态规则。
 */
const avatarColor: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2, #f2f4f7)',
  color: 'var(--dsw-alias-label-secondary, #475467)',
}

const avatarColorSignedIn: CSSProperties = {
  background: 'var(--dsw-alias-accent-primary, #2563eb)',
  color: 'var(--dsw-alias-label-on-primary, #ffffff)',
}

const card: CSSProperties = {
  backdropFilter: 'var(--dsw-menu-backdrop-filter, none)',
  background: 'var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, #ffffff))',
  border: '1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08))',
  borderRadius: 16,
  boxShadow: 'var(--dsw-elevation-prominent, 0 16px 36px -4px rgba(0, 0, 0, 0.18), 0 6px 16px -2px rgba(0, 0, 0, 0.08))',
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-primary, #101828)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxWidth: 'calc(100vw - 24px)',
  padding: '12px 10px',
  position: 'fixed',
  width: 270,
  zIndex: 1100,
}

const header: CSSProperties = { alignItems: 'center', display: 'flex', gap: 10, padding: '4px 8px 8px' }

const headerText: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 }

const headerTitle: CSSProperties = { fontSize: 14, fontWeight: 600, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const headerDetail: CSSProperties = { color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12, lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const divider: CSSProperties = { background: 'var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.06))', height: 1, margin: '2px 0' }

const group: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }

/** 行项只内联几何与排版：`background` 归类规则（`.own-menu-item`），否则内联优先级会压掉 hover/active。 */
const item: CSSProperties = {
  alignItems: 'center',
  border: 0,
  borderRadius: 8,
  boxSizing: 'border-box',
  color: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  font: 'inherit',
  fontSize: 13,
  gap: 10,
  lineHeight: '20px',
  padding: '8px 10px',
  textAlign: 'left',
  width: '100%',
}

const itemIcon: CSSProperties = {
  alignItems: 'center',
  color: 'var(--dsw-alias-menu-icon, var(--dsw-alias-label-tertiary, #667085))',
  display: 'inline-flex',
  flex: 'none',
  height: 16,
  justifyContent: 'center',
  width: 16,
}

const itemLabel: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const keycaps: CSSProperties = {
  alignItems: 'center',
  color: 'var(--dsw-alias-label-tertiary, #667085)',
  display: 'inline-flex',
  flex: 'none',
  fontSize: 12,
  gap: 3,
  lineHeight: '16px',
  marginLeft: 'auto',
  whiteSpace: 'nowrap',
}

/**
 * 菜单视觉与键盘态的唯一真源，由组件以 `<style>` 注入。两条硬约束：
 * 1. 触发按钮与菜单行的 `background` 只在这里声明，元素上不得再有内联同名属性；
 * 2. 悬停/按下的兜底一律主题中性——官方 token 缺席时用 `color-mix(in srgb, currentColor …)` 叠加，
 *    深浅主题都可见；深色硬编码兜底（如 rgba(9, 9, 11, .05)）在深色主题上等于没有反馈。
 * 触发按钮几何照官方占用者与 fallback 齿轮：42px 整行 / 36px 折叠钮 / 未登录紧凑行；圆角与颜色全取宿主 token。
 */
export const ENTERPRISE_MENU_STYLES = `
      .own-menu-card { animation: own-menu-in 0.15s ease-out; }
      .own-menu-trigger {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: var(--dsw-radius-md, 12px);
        box-sizing: border-box;
        color: var(--dsw-alias-label-primary, #101828);
        cursor: pointer;
        display: flex;
        flex: 1 1 auto;
        font: inherit;
        font-size: 14px;
        gap: 8px;
        height: 42px;
        line-height: 22px;
        margin: 0;
        min-width: 0;
        overflow: hidden;
        padding: 0 10px 0 8px;
        transition: background-color 0.15s ease, color 0.15s ease;
        user-select: none;
      }
      .own-menu-trigger[data-collapsed='true'] { flex: none; gap: 0; height: 36px; justify-content: center; padding: 0; width: 36px; }
      .own-menu-trigger[data-signed-out='true']:not([data-collapsed='true']) { height: 32px; line-height: 20px; padding: 6px 2px 6px 6px; }
      .own-menu-trigger[data-signed-out='true']:not([data-collapsed='true']) .own-menu-avatar { height: 20px; width: 20px; }
      .own-menu-trigger-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .own-menu-avatar {
        align-items: center;
        border-radius: 50%;
        corner-shape: round;
        display: flex;
        flex: none;
        font-size: 12px;
        font-weight: 600;
        height: 24px;
        justify-content: center;
        line-height: 1;
        width: 24px;
      }
      .own-menu-trigger:hover { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent)); }
      .own-menu-trigger:active { background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 14%, transparent))); }
      .own-menu-trigger:focus-visible, .own-menu-item:focus-visible { outline-color: var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe)); outline-offset: 2px; outline-style: solid; outline-width: var(--dsw-focus-ring-width, 2px); }
      .own-menu-item { background: transparent; transition: background-color 0.15s ease, color 0.15s ease; }
      .own-menu-item:hover:not(:disabled), .own-menu-item:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent)); }
      .own-menu-item:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 14%, transparent))); }
      .own-menu-item:disabled { cursor: not-allowed; opacity: 0.4; }
      .own-menu-item-danger { color: var(--dsw-alias-state-error-primary, #c4320a); }
      .own-menu-item-danger .own-menu-item-icon { color: var(--dsw-alias-state-error-primary, #c4320a); }
      .own-menu-item-danger:hover:not(:disabled), .own-menu-item-danger:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent))); }
      .own-menu-item-danger:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover-danger, color-mix(in srgb, currentColor 14%, transparent))); }
      .own-menu-spin { animation: own-menu-rotate 1s linear infinite; }
      @keyframes own-menu-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }
      @keyframes own-menu-rotate { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .own-menu-card, .own-menu-spin { animation: none; } }
`

/** 一条可选中行：图标位 16px、hover 填充、危险色，与官方菜单行同节奏。 */
function MenuRow({ entry, icon, trailing, startLogout, select }: {
  readonly entry: EnterpriseMenuItem
  readonly icon: ReactNode
  readonly trailing?: ReactNode
  readonly startLogout?: (() => void) | undefined
  readonly select: (command: EnterpriseMenuCommand, startLogout?: () => void) => void
}): ReactNode {
  return <button
    className={entry.danger === true ? 'own-menu-item own-menu-item-danger' : 'own-menu-item'}
    disabled={entry.disabled}
    onClick={() => { select(entry.id, startLogout) }}
    role="menuitem"
    style={item}
    type="button"
  >
    <span className="own-menu-item-icon" style={itemIcon}>{icon}</span>
    <span style={itemLabel}>{entry.label}</span>
    {trailing === undefined ? null : <span aria-hidden style={keycaps}>{trailing}</span>}
  </button>
}

/** 行项图标：登录/进度/设置/退出各有语义图标，退出进行中改显与登录同款的旋转进度。 */
function menuRowIcon(id: EnterpriseMenuCommand, spinning: boolean): ReactNode {
  if (id === 'progress') return <LoaderCircle className="own-menu-spin" size={16} />
  if (id === 'login') return <LogIn size={16} />
  if (id === 'logout') return spinning ? <LoaderCircle className="own-menu-spin" size={16} /> : <LogOut size={16} />
  return <Settings size={16} />
}

/**
 * 侧栏左下角的唯一企业入口，照官方占用者语义：任何登录态点击都先弹菜单，
 * 未登录时第一项是「登录」（打开登录弹窗），「外观」与「设置」始终在列，已连接才有「退出登录」；
 * 菜单分区顺序由 enterpriseMenuSections 给出，设置交还宿主 openSettings() 打开官方设置面板；
 * 焦点与关闭语义全部走纯状态机。
 */
export function EnterpriseAccountMenu(props: EnterpriseAccountMenuProps): ReactNode {
  const snapshot = useAccount(props.store)
  const dialog = useEnterpriseLoginDialog(props.store)
  const model = enterpriseAccountMenu({
    state: snapshot.status?.state,
    busy: snapshot.busy,
    identity: enterpriseAccountIdentity(snapshot),
  })
  const entry = enterpriseLoginEntry(snapshot.status?.state, snapshot.busy)
  // 入口去向只有一个答案（菜单），aria-haspopup 因此恒为 menu；类型由决策函数给出。
  const entryPath = enterpriseMenuEntryPath(snapshot.status?.state, snapshot.busy)
  const signedIn = entry.action === 'logout'
  const [menu, setMenu] = useState<EnterpriseMenuState>(ENTERPRISE_MENU_CLOSED)
  const menuRef = useRef(menu)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const focusMenuPending = useRef(false)
  const settingsWasOpen = useRef(props.settingsOpen === true)
  const position = useAnchoredPosition({ anchorRef: trigger, gap: 8, margin: 12, open: menu.open, panelRef: panel, side: 'top' })

  /** 事件入口：先按纯状态机得到新状态与效果，再落地。状态只在 run 里前进，ref 与 state 不会分叉。 */
  const run = (event: EnterpriseMenuEvent, startLogout?: () => void): void => {
    const next = enterpriseMenuTransition(menuRef.current, event)
    menuRef.current = next.state
    setMenu(next.state)
    applyEnterpriseMenuEffects(next.effects, {
      closeDialog: dialog.closeDialog,
      focusMenu: () => { focusMenuPending.current = true },
      focusTrigger: () => { trigger.current?.focus() },
      openLogin: dialog.openDialog,
      openSettings: props.openSettings,
      startLogout,
    })
  }
  // 外部点击监听跨渲染保持稳定，事件到达时再读最新处理器。
  const runRef = useRef(run)
  useEffect(() => { runRef.current = run })
  const onOutsidePointer = useCallback((open: boolean) => {
    // 指针关闭不抢焦点：焦点留在用户刚点的目标上，只有键盘关闭才归还触发按钮。
    if (!open) runRef.current({ type: 'release' })
  }, [])
  useDismissOnOutsidePointer(root, menu.open, onOutsidePointer)
  // 打开后焦点进入菜单首项：面板挂载后才能聚焦，所以由布局效果兑现。
  useLayoutEffect(() => {
    if (!menu.open) { focusMenuPending.current = false; return }
    if (!focusMenuPending.current) return
    focusMenuPending.current = false
    panel.current?.querySelector<HTMLButtonElement>(FOCUSABLE_ITEM)?.focus()
  }, [menu.open])
  // 宿主报告设置面板已打开（含快捷键路径）时菜单让位，焦点归面板自己管理。
  useEffect(() => {
    const open = props.settingsOpen === true
    const wasOpen = settingsWasOpen.current
    settingsWasOpen.current = open
    if (open && !wasOpen) runRef.current({ type: 'settings-open' })
  }, [props.settingsOpen])
  // 互斥的另一侧：登录弹窗一旦在前台，菜单立即让位，且不改动弹窗自己的焦点。
  useEffect(() => {
    if (dialog.open && menuRef.current.open) runRef.current({ type: 'release' })
  }, [dialog.open])

  const select = (command: EnterpriseMenuCommand, startLogout?: () => void): void => {
    run({ type: 'select', command }, startLogout)
  }
  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const menuEvent = enterpriseMenuKeyEvent(event.key)
    if (menuEvent !== undefined) { event.preventDefault(); event.stopPropagation(); run(menuEvent); return }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    const items = [...(panel.current?.querySelectorAll<HTMLButtonElement>(FOCUSABLE_ITEM) ?? [])]
    if (items.length === 0) return
    event.preventDefault()
    const index = items.findIndex(element => element === document.activeElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : index < 0 ? (step === 1 ? 0 : items.length - 1)
          : (index + step + items.length) % items.length
    items[next]?.focus()
  }
  const shortcutKeys = props.settingsShortcut?.keys ?? []
  const spinning = snapshot.busy !== undefined
  /** 分区到行项的映射：只有设置分区是单行，外观分区由主题组自己渲染。 */
  const sectionRows = (section: EnterpriseMenuSection): readonly EnterpriseMenuItem[] => {
    if (section === 'account') return model.account
    if (section === 'settings') return [model.settings]
    return model.session
  }
  const renderRow = (row: EnterpriseMenuItem, section: EnterpriseMenuSection, startLogout: () => void): ReactNode => <MenuRow
    key={row.id}
    entry={row}
    icon={menuRowIcon(row.id, spinning)}
    select={select}
    startLogout={section === 'session' ? startLogout : undefined}
    trailing={row.id !== 'settings' || shortcutKeys.length === 0
      ? undefined
      : shortcutKeys.map((key, index) => <kbd key={index} style={{ font: 'inherit' }}>{key}</kbd>)}
  />
  const launcher = (startLogout: () => void): ReactNode => <>
    <div ref={root} style={{ display: 'flex', flex: '1 1 auto', minWidth: 0 }}>
      {enterpriseMenuTriggerElement({
        ariaExpanded: menu.open,
        entryPath,
        initial: model.initial,
        label: model.triggerLabel,
        signedIn,
        state: snapshot.status?.state ?? snapshot.phase,
        wide: props.wide,
      }, {
        onClick: () => { run({ type: 'launch', dialogOpen: dialog.open }) },
        onKeyDown: (event) => { if (event.key === 'Escape' && menu.open) { event.preventDefault(); run({ type: 'dismiss' }) } },
        ref: trigger,
      })}
      {menu.open ? <div
        ref={panel}
        aria-label={MENU_LABEL}
        className="own-menu-card"
        onKeyDown={onPanelKeyDown}
        role="menu"
        style={position === null ? { ...card, visibility: 'hidden' } : { ...card, ...position }}
      >
        <div role="presentation" style={header}>
          <span aria-hidden className={TRIGGER_GLYPH_CLASS} style={model.presentsAccount ? avatarColorSignedIn : avatarColor}>
            {model.presentsAccount ? model.initial : <UserRound size={16} />}
          </span>
          <span style={headerText}>
            <span style={headerTitle} title={model.title}>{model.title}</span>
            <span style={headerDetail} title={model.detail}>{model.detail}</span>
          </span>
        </div>
        {enterpriseMenuSections(model).map(section => <Fragment key={section}>
          <div role="separator" style={divider} />
          {section === 'appearance'
            ? <EnterpriseThemeOptionGroup source={props.theme} />
            : <div style={group}>
              {sectionRows(section).map(row => renderRow(row, section, startLogout))}
            </div>}
        </Fragment>)}
      </div> : null}
    </div>
    <EnterpriseLoginDialog store={props.store} open={dialog.open} onClose={dialog.closeDialog} />
  </>
  // 退出确认挂在菜单之外，所以菜单关闭不会卸载确认弹窗；未登录时没有行项引用它的开启器。
  return <>
    <style>{ENTERPRISE_MENU_STYLES}</style>
    <LogoutConfirmation store={props.store} disabled={entry.disabled}>{launcher}</LogoutConfirmation>
  </>
}
