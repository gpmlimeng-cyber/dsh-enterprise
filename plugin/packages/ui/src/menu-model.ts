/**
 * [INPUT]: 依赖 account-state 的账号投影（仅帮助与文档那行用它的平台地址）、login-dialog 的入口投影、login-page 的 NUWAX 状态呈现、desktop-runtime 的更新状态投影、help-link 的帮助站地址派生与文案、local-api 的 NUWAX 登录态联合，以及 account-store/account-state 的脱敏投影类型
 * [OUTPUT]: **本刀（登录入口换成 NUWAX）**：`EnterpriseAccountMenuInput` 的 `state`/`busy`（企业连接态）换成 `nuwax`/`nuwaxBusy`——头部两行与会话行都由 NUWAX 登录态推导，`identity` 只剩一个用途（帮助与文档那行仍按企业平台地址是否配置判禁用）。对外提供入口决策 enterpriseMenuEntryPath、菜单模型 enterpriseAccountMenu 与 EnterpriseAccountMenuModel、分组 enterpriseMenuBlocks/enterpriseMenuSections 与常量 ENTERPRISE_MENU_BLOCK_IDS/ENTERPRISE_MENU_VISUAL_BLOCKS/ENTERPRISE_MENU_SEPARATOR_COUNT、能力面 EnterpriseMenuCapabilities，以及开关状态机 enterpriseMenuTransition/enterpriseMenuKeyEvent/enterpriseMenuCommandEffects/applyEnterpriseMenuEffects
 * [POS]: dsh-ui 个人中心菜单的纯决策层（无 React、无 DOM、无 store 副作用）：行项集合、分组边界与发丝线条数都从「登录态 × 能力面 × 平台配置」推导，组件只消费这些事实。发丝线条数被 `ENTERPRISE_MENU_SEPARATOR_COUNT` 这个常量锁死（头部 + 三组 = 4 个视觉块 → 3 条线），防止再退化为「每个 section 边界都画线」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseAccountIdentity } from './account-state.js'
import {
  enterpriseUpdateTrailing,
  type EnterpriseUpdatePresentation,
  type EnterpriseUpdateTrailing,
} from './desktop-runtime.js'
import {
  ENTERPRISE_HELP_HINT,
  ENTERPRISE_HELP_LABEL,
  ENTERPRISE_HELP_UNCONFIGURED_HINT,
  enterpriseHelpUrl,
} from './help-link.js'
import { enterpriseLoginEntry } from './login-dialog.js'
import { enterpriseNuwaxPresentation, type EnterpriseNuwaxBusy } from './login-page.js'
import type { EnterpriseNuwaxStatus } from './local-api.js'
/**
 * 菜单里可被选中的命令；分组由模型给出，顺序即视觉顺序。
 *
 * 刻意不含 `usage` 与 `docs`：这两行是**行内就地**动作（展开用量块 / 打开帮助并在行下给失败反馈），
 * 菜单不关、面板与开关同树，因此它们不走「选中即关闭」的状态机。
 */
export type EnterpriseMenuCommand =
  | 'login'
  | 'progress'
  | 'logout'
  | 'settings'
  | 'feedback'
  | 'shortcuts'
  | 'reload'
  | 'restart'
  | 'update'

/** 菜单行的全部 id：命令之外还有两个行内动作行。 */
export type EnterpriseMenuRowId = EnterpriseMenuCommand | 'usage' | 'docs'

/** 入口去向只有菜单一条：官方 settings.launcher 座位上的按钮是菜单触发器，未登录也一样。 */
export type EnterpriseMenuEntryPath = 'menu'

/**
 * 入口决策的唯一出口。官方占用者（`ui-settings-account` 的 AccountMenu）对任何登录态都弹菜单，
 * 未登录时只是把菜单里的 `signout` 换成 `signin`；本实现照此办理，未登录直开登录弹窗会让
 * 「设置」与「外观」失去入口（齿轮 fallback 只在座位空时渲染），所以这里恒返回菜单。
 * 参数说明判定输入域，答案不再依赖它们。
 */
export function enterpriseMenuEntryPath(
  _nuwax: EnterpriseNuwaxStatus | undefined,
  _busy: EnterpriseNuwaxBusy | undefined,
): EnterpriseMenuEntryPath {
  return 'menu'
}

export interface EnterpriseMenuItem {
  readonly id: EnterpriseMenuRowId
  readonly label: string
  readonly disabled: boolean
  /** 破坏性动作：错误色文字、图标与危险悬停底色。 */
  readonly danger?: boolean
  /** 行文案被省略号截断时的全文（更新失败原因这类长文案用它兜住完整信息）。 */
  readonly title?: string | undefined
  /** 行右侧的弱化提示（帮助与文档的「需登录」/「请先配置企业 Server 地址」）。 */
  readonly hint?: string | undefined
}

/**
 * 菜单呈现事实。末行固定是「会话动作位」：未登录=登录、登录中=查看登录进度、已连接=退出登录，
 * 三者不在同一分区并存，视觉上永远落在同一格；`shortcuts`/`maintenance`/`docs` 由能力与配置决定呈现。
 */
export interface EnterpriseAccountMenuModel {
  readonly title: string
  readonly detail: string
  readonly initial: string
  /** 头部与头像位是否按账号信息呈现：已连接与登录中为真，未登录为假（显示「未登录」与状态引导语）。 */
  readonly presentsAccount: boolean
  /** 触发按钮文案：官方 `t('more')` 的「更多」，或已连接时的昵称。 */
  readonly triggerLabel: string
  /** 用量行：菜单内默认折叠的行内快捷块，点击就地展开（菜单不关）。 */
  readonly usage: EnterpriseMenuItem
  /** 反馈入口：始终一条「帮助与反馈」；未登录时弹窗内提示先登录（该行不隐藏、不静默）。 */
  readonly feedback: EnterpriseMenuItem
  /** 帮助与文档：平台地址未配置时禁用（行右侧写明原因），配置好后提示该站点需登录。 */
  readonly docs: EnterpriseMenuItem
  /** 设置组：始终一条，选中后由宿主打开官方设置面板。 */
  readonly settings: EnterpriseMenuItem
  /** 快捷键入口：官方注册表（或 launcher 的 settingsShortcut）没有可读数据时整组不出现。 */
  readonly shortcuts: EnterpriseMenuItem | undefined
  /** 维护组：恒有「重新载入页面」，检查更新在前、重启按能力检测增删。 */
  readonly maintenance: readonly EnterpriseMenuItem[]
  /** 会话组：末行三态共用同一格，未登录与已连接视觉相呼应。 */
  readonly session: readonly EnterpriseMenuItem[]
}

/** 未登录与登录中的触发文案，取值同官方 zh 词表 `more: '更多'`：入口现在是菜单，不再自称登录按钮。 */
const TRIGGER_MORE_LABEL = '更多'

/** 行的固定文案；能力探测只决定在不在列，不改变用词。 */
const RELOAD_LABEL = '重新载入页面'
const RESTART_LABEL = '重新启动应用'
const UPDATE_LABEL = '检查更新'
const SHORTCUTS_LABEL = '快捷键'
const FEEDBACK_LABEL = '帮助与反馈'
const USAGE_LABEL = '我的用量'

/**
 * 能力面：重载恒可用（纯 Web 也有 `location.reload()`），重启只在官方动作面存在时显示，
 * 更新只在 `dshDesktop.updates` 可读时显示，快捷键只在有官方注册表或 launcher 键帽时显示。
 */
export interface EnterpriseMenuCapabilities {
  readonly restart: boolean
  readonly updates: boolean
  readonly shortcuts: boolean
}

export const ENTERPRISE_MENU_CAPABILITIES_NONE: EnterpriseMenuCapabilities = {
  restart: false,
  shortcuts: false,
  updates: false,
}

export interface EnterpriseAccountMenuInput {
  /**
   * **NUWAX 登录态**（本刀：登录入口换成 NUWAX 之后，菜单头部与会话行都由它推导）。
   *
   * 企业连接态（`EnterpriseConnectionState`）**不再**出现在这里：那份事实照旧驱动市场与用量，
   * 但它不再决定"登录入口长什么样"——否则就会出现「企业连上了、NUWAX 没登录」时菜单说已登录、
   * 点开却是一面 NUWAX 表单的自相矛盾。
   */
  readonly nuwax: EnterpriseNuwaxStatus | undefined
  readonly nuwaxBusy: EnterpriseNuwaxBusy | undefined
  readonly identity: EnterpriseAccountIdentity
  readonly capabilities?: EnterpriseMenuCapabilities | undefined
  /** 官方更新状态；缺席或相位 idle 都按「检查更新」呈现。 */
  readonly update?: EnterpriseUpdatePresentation | undefined
  /** 本进程是否见过 checking 相位：idle 的右侧状态据此在「未检查」与「已是最新」之间取值。 */
  readonly updateChecked?: boolean | undefined
}

/** 头像圈内的首字符：CJK 单字与代理对都取第一个完整字符，空名回落品牌首字母。 */
function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? 'D'
}

/**
 * 更新行：行标签**恒为**「检查更新」（动作名），失败原因与进度都归右侧的状态标签，
 * 因此这里不再把 failure 顶到行文案上——两处重复是同一条信息被说两遍。
 */
function updateRow(trailing: EnterpriseUpdateTrailing): EnterpriseMenuItem {
  return { disabled: trailing.disabled, id: 'update', label: UPDATE_LABEL }
}

/**
 * 菜单模型：行项集合随**NUWAX 登录态**与能力面变化，文案复用登录页的状态映射，不新增第二套词汇。
 * 已登录显示 NUWAX 昵称加账号/租户；登录中同样按账号信息呈现，不再回落「未登录」；
 * 其余状态显示「未登录」加当前状态的引导语。帮助与文档仍按**企业平台地址**是否配置决定禁用，
 * 那是另一份事实（它决定帮助站连不连得上），因此 `identity` 只在这里用。
 */
export function enterpriseAccountMenu(input: EnterpriseAccountMenuInput): EnterpriseAccountMenuModel {
  const entry = enterpriseLoginEntry(input.nuwax, input.nuwaxBusy)
  const presentation = enterpriseNuwaxPresentation(input.nuwax, input.nuwaxBusy)
  const principal = input.nuwax?.state === 'signed-in' ? input.nuwax.principal : undefined
  const usable = entry.action === 'logout'
  const inFlight = input.nuwaxBusy === 'login'
  const identified = usable || inFlight
  const capabilities = input.capabilities ?? ENTERPRISE_MENU_CAPABILITIES_NONE
  const detail = principal === undefined ? '' : `${principal.userName} · 租户 ${principal.tenantId}`
  const helpConfigured = enterpriseHelpUrl(input.identity.platformUrl) !== undefined
  return {
    title: identified ? (principal?.nickName ?? 'NUWAX 账号') : '未登录',
    detail: identified && detail !== '' ? detail : presentation.description,
    initial: initialOf(principal?.nickName ?? ''),
    presentsAccount: identified,
    triggerLabel: usable ? (principal?.nickName ?? TRIGGER_MORE_LABEL) : TRIGGER_MORE_LABEL,
    usage: { id: 'usage', label: USAGE_LABEL, disabled: false },
    feedback: { id: 'feedback', label: FEEDBACK_LABEL, disabled: false },
    docs: {
      disabled: !helpConfigured,
      // 行右侧不写字（2026-10-01 用户裁定）：这一行只有「打开帮助站」一个含义，
      // 右侧那句弱化提示在菜单里是噪音；禁用原因改写进 title（悬停可见），不再占用行尾。
      id: 'docs',
      label: ENTERPRISE_HELP_LABEL,
      title: helpConfigured ? ENTERPRISE_HELP_HINT : ENTERPRISE_HELP_UNCONFIGURED_HINT,
    },
    settings: { id: 'settings', label: '设置', disabled: false },
    shortcuts: capabilities.shortcuts ? { id: 'shortcuts', label: SHORTCUTS_LABEL, disabled: false } : undefined,
    maintenance: [
      ...(capabilities.updates ? [updateRow(enterpriseUpdateTrailing(input.update, input.updateChecked === true))] : []),
      { id: 'reload', label: RELOAD_LABEL, disabled: false },
      ...(capabilities.restart ? [{ id: 'restart', label: RESTART_LABEL, disabled: false } as const] : []),
    ],
    session: usable
      ? [{ id: 'logout', label: input.nuwaxBusy === 'logout' ? '正在退出' : '退出登录', disabled: entry.disabled, danger: true }]
      : inFlight
        ? [{ id: 'progress', label: '查看登录进度', disabled: false }]
        : [{ id: 'login', label: '登录', disabled: entry.disabled }],
  }
}

/** 菜单分区；分区顺序即视觉顺序，末行恒为会话动作位。 */
export type EnterpriseMenuSection =
  | 'appearance'
  | 'usage'
  | 'settings'
  | 'shortcuts'
  | 'feedback'
  | 'docs'
  | 'maintenance'
  | 'session'

/** 三个语义分组块：发丝线只画在块与块之间，组内一律不画。 */
export type EnterpriseMenuBlockId = 'preferences' | 'enterprise' | 'session'

export const ENTERPRISE_MENU_BLOCK_IDS = ['preferences', 'enterprise', 'session'] as const

/**
 * 视觉块 = 账号头部 + 三个分组；发丝线数 = 视觉块数 − 1。
 *
 * 这里把「头」也算作一个块是刻意的：线上退化过一次「每个 section 边界都画线」（6 条），
 * 常量断言必须能直接数出 3 条，而不是靠 `sections − 1` 那种随分组增减而漂移的算式。
 */
export const ENTERPRISE_MENU_VISUAL_BLOCKS = ['header', ...ENTERPRISE_MENU_BLOCK_IDS] as const

/** 菜单里的发丝线总数常量（头部下 1 条 + 分组间 2 条）；断言它就是防退化。 */
export const ENTERPRISE_MENU_SEPARATOR_COUNT = ENTERPRISE_MENU_VISUAL_BLOCKS.length - 1

export interface EnterpriseMenuBlock {
  readonly id: EnterpriseMenuBlockId
  readonly sections: readonly EnterpriseMenuSection[]
}

/**
 * 分组内容（产品口径）：
 * 【偏好】外观 · 我的用量 · 设置 · 快捷键 ／【企业服务】帮助与反馈 · 帮助与文档 · 检查更新 · 重新载入页面 · 重新启动应用（按能力）／【会话】登录 · 退出登录。
 * 空分组不产出（没有会话行时不留一条孤零零的线）。
 */
export function enterpriseMenuBlocks(model: EnterpriseAccountMenuModel): readonly EnterpriseMenuBlock[] {
  const blocks: readonly EnterpriseMenuBlock[] = [
    {
      id: 'preferences',
      sections: [
        'appearance',
        'usage',
        'settings',
        ...(model.shortcuts === undefined ? [] : ['shortcuts'] as const),
      ],
    },
    {
      id: 'enterprise',
      sections: [
        'feedback',
        'docs',
        ...(model.maintenance.length === 0 ? [] : ['maintenance'] as const),
      ],
    },
    { id: 'session', sections: model.session.length === 0 ? [] : ['session'] as const },
  ]
  return blocks.filter(block => block.sections.length > 0)
}

/** 拍平的分区序列（视觉顺序）；给只需要顺序的调用方与测试用，渲染走 `enterpriseMenuBlocks`。 */
export function enterpriseMenuSections(model: EnterpriseAccountMenuModel): readonly EnterpriseMenuSection[] {
  return enterpriseMenuBlocks(model).flatMap(block => block.sections)
}

export interface EnterpriseMenuState {
  readonly open: boolean
}

export const ENTERPRISE_MENU_CLOSED: EnterpriseMenuState = { open: false }
export const ENTERPRISE_MENU_OPEN: EnterpriseMenuState = { open: true }

/** 一次转移要求界面做的副作用；`focus-menu` 由官方 Menu 的 autoFocus 兑现，因此组件里是空实现。 */
export type EnterpriseMenuEffect =
  | 'focus-menu'
  | 'focus-trigger'
  | 'open-login'
  | 'open-feedback'
  | 'start-logout'
  | 'open-settings'
  | 'open-shortcuts'
  | 'request-reload'
  | 'request-restart'
  | 'request-update'
  | 'close-dialog'

export type EnterpriseMenuEvent =
  /**
   * 触发按钮：唯一去向是菜单。已打开就关闭，未打开就打开；弹窗开着时先关弹窗，
   * 菜单与弹窗不共存。登录弹窗只能由菜单里的「登录」/「查看登录进度」行打开。
   */
  | { readonly type: 'launch'; readonly dialogOpen: boolean }
  /** Esc 与 Tab：关闭并把焦点归还触发按钮。 */
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
 * 行内动作（我的用量、帮助与文档）不经这里——它们就地生效，菜单保持打开。
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

/** 选中一条行项的效果序列：先归还焦点，再打开下一个界面或触发维护动作。 */
export function enterpriseMenuCommandEffects(command: EnterpriseMenuCommand): readonly EnterpriseMenuEffect[] {
  switch (command) {
    case 'settings': return ['focus-trigger', 'open-settings']
    case 'feedback': return ['focus-trigger', 'open-feedback']
    case 'logout': return ['focus-trigger', 'start-logout']
    case 'shortcuts': return ['focus-trigger', 'open-shortcuts']
    case 'reload': return ['focus-trigger', 'request-reload']
    case 'restart': return ['focus-trigger', 'request-restart']
    case 'update': return ['focus-trigger', 'request-update']
    case 'login':
    case 'progress': return ['focus-trigger', 'open-login']
  }
}

/**
 * 面板按键到菜单事件的唯一映射：Esc 与 Tab 都关闭菜单并把焦点还给触发按钮。
 * 官方 Menu 已经接管 Esc（并自己做无焦点环的归还），这里保留映射是为了补上官方未定义的一格：
 * 外观组的分段是 `menuitemradio` 而不是官方行项，Tab 落到它上面时官方不结算，需要按本契约关闭。
 */
export function enterpriseMenuKeyEvent(key: string): EnterpriseMenuEvent | undefined {
  return key === 'Escape' || key === 'Tab' ? { type: 'dismiss' } : undefined
}

/** 转移效果落到具体能力上的目标表；退出确认的开启器只在它挂载的调用点交得出来。 */
export interface EnterpriseMenuTargets {
  readonly focusMenu: () => void
  readonly focusTrigger: () => void
  readonly openLogin: () => void
  /** 「帮助与反馈」弹窗：开关状态与弹窗元素必须同树。 */
  readonly openFeedback: () => void
  readonly openSettings: () => void
  /**
   * 「快捷键」：先关我们的菜单（状态机已同步关闭），下一 tick 再走官方 reach-in；
   * 目标缺失或失败时降级成「一览 + 引导」并调 openSettings()。
   */
  readonly openShortcuts: () => void
  /** 维护动作各自带可见反馈，缺任何一个都会退化成「点了没反应」。 */
  readonly requestReload: () => void
  readonly requestRestart: () => void
  readonly requestUpdate: () => void
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
      case 'open-feedback': targets.openFeedback(); break
      case 'open-settings': targets.openSettings(); break
      case 'open-shortcuts': targets.openShortcuts(); break
      case 'request-reload': targets.requestReload(); break
      case 'request-restart': targets.requestRestart(); break
      case 'request-update': targets.requestUpdate(); break
      case 'start-logout': targets.startLogout?.(); break
      case 'close-dialog': targets.closeDialog(); break
    }
  }
}
