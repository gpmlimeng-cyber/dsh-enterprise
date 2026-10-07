/**
 * [INPUT]: 依赖 React（Ref/ReactElement/KeyboardEvent 类型）、official-ui 接缝提供的官方 Menu/MenuItemButton/官方图标、Lucide 的图标组（LogOut/Gauge/MessageSquareText/BookOpen/RotateCw/Power/Download/Keyboard）、account-state 的账号投影与状态文案、login-dialog 的入口投影与弹窗、usage-panel 的行内折叠用量块、feedback-dialog 的反馈表单弹窗、account-view 的登出确认、theme-options 的外观选项组、desktop-runtime 的桌面能力面与更新状态、maintenance-view 的维护反馈弹窗与右侧状态控件、shortcuts-view 的官方快捷键只读源与速查弹窗、shortcuts-open 的 reach-in 打开器、help-link 的帮助站地址派生与打开口径，以及 EnterpriseAccountStore 的脱敏快照
 * [OUTPUT]: **本刀（登录入口换成 NUWAX）**：末行会话动作位与头部账号事实改读 `snapshot.nuwax` / `snapshot.nuwaxBusy`，退出确认传 `target="nuwax"`（退的是 NUWAX 会话）。对外提供入口决策 enterpriseMenuEntryPath、菜单纯决策 enterpriseAccountMenu/enterpriseMenuSections/enterpriseMenuBlocks/enterpriseMenuTransition/enterpriseMenuCommandEffects/applyEnterpriseMenuEffects、发丝线常量 ENTERPRISE_MENU_SEPARATOR_COUNT、触发按钮元素工厂 enterpriseMenuTriggerElement 与菜单组件 EnterpriseAccountMenu（样式表由 menu-styles 持有），后者占据官方 settings.launcher 座位
 * [POS]: dsh-ui 唯一的侧栏账号入口。末行固定是「会话动作位」（**本刀起由 NUWAX 登录态驱动**：未登录=登录、登录中=查看登录进度、已登录=退出登录）；视觉上只有三个分组块——【偏好】外观 · 我的用量 · 设置 · 快捷键 ／【企业服务】帮助与反馈 · 帮助与文档 · 检查更新 · 重新载入页面 · 重新启动应用（按能力）／【会话】登录 · 退出登录，发丝线只画在头部与相邻分组之间（3 条）。卡片本体、菜单行、portal 定位、自动聚焦与 Esc 全部交给官方 Menu/MenuItemButton 原语，因此宽度/圆角/阴影/行几何/悬停与危险色都随宿主版本与官方一致；我们自己持有的只有官方没有的部分——触发按钮（官方那颗在 ui-settings-account 包内不导出）、账号头部、外观选项组、行内用量块、维护行右侧状态控件与全部发丝线——并逐条照官方 0.2.0-rc.2 实物取值（ui-settings-account/lib/client.js:1612 的 AccountMenu.module.css、ui-settings-general/lib/client.js:60 的 SettingsRoot、ui-primitives 的 Menu/SegmentedControl CSS）。触发按钮的 background 只由 ENTERPRISE_MENU_STYLES 的类规则声明，元素本身不带任何内联样式，否则内联优先级会压掉 :hover
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { BookOpen, Download, Gauge, Keyboard, LogOut, MessageSquareText, Power, RotateCw } from 'lucide-react'
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import {
  IconEllipsisOutlineMedium,
  IconLoadingOutlineMedium,
  IconSettingsOutlineMedium,
  IconUserOutlineMedium,
  OfficialMenu,
  OfficialMenuItemButton,
} from './official-ui.js'
import { enterpriseAccountIdentity, useAccount } from './account-state.js'
import { LogoutConfirmation, type EnterpriseStoreInjected } from './account-view.js'
import { EnterpriseFeedbackDialog, useEnterpriseFeedbackDialog } from './feedback-dialog.js'
import {
  ENTERPRISE_DESKTOP_ABSENT,
  enterpriseUpdateTrailing,
  type EnterpriseDesktopSource,
} from './desktop-runtime.js'
import {
  ENTERPRISE_HELP_FAILED_HINT,
  ENTERPRISE_HELP_UNCONFIGURED_HINT,
  enterpriseHelpUrl,
  openEnterpriseHelp,
} from './help-link.js'
import {
  enterpriseLoginEntry,
  EnterpriseLoginDialog,
  useEnterpriseLoginDialog,
} from './login-dialog.js'
import { ENTERPRISE_MENU_STYLES } from './menu-styles.js'
import {
  EnterpriseMaintenanceNotice,
  EnterpriseUpdateTrailingControl,
  useEnterpriseMaintenance,
  useEnterpriseUpdate,
} from './maintenance-view.js'
import {
  enterpriseShortcutKeys,
  enterpriseShortcutRows,
  EnterpriseShortcutsDialog,
  useEnterpriseShortcuts,
  useEnterpriseShortcutsDialog,
  type EnterpriseShortcutRow,
  type EnterpriseShortcutsSource,
} from './shortcuts-view.js'
import {
  ENTERPRISE_SHORTCUTS_GUIDE,
  type EnterpriseShortcutsReachIn,
} from './shortcuts-open.js'
import { EnterpriseThemeOptionGroup, type EnterpriseThemeSource } from './theme-options.js'
import {
  EnterpriseUsagePanel,
  EnterpriseUsageRowContent,
  useEnterpriseUsageSection,
} from './usage-panel.js'
import {
  ENTERPRISE_MENU_CLOSED,
  applyEnterpriseMenuEffects,
  enterpriseAccountMenu,
  enterpriseMenuBlocks,
  enterpriseMenuEntryPath,
  enterpriseMenuKeyEvent,
  enterpriseMenuTransition,
  type EnterpriseMenuCommand,
  type EnterpriseMenuEntryPath,
  type EnterpriseMenuEvent,
  type EnterpriseMenuItem,
  type EnterpriseMenuRowId,
  type EnterpriseMenuSection,
  type EnterpriseMenuState,
} from './menu-model.js'

// 纯决策层原样再导出：既有消费方（含测试）继续从本文件取菜单模型与状态机。
export * from './menu-model.js'


const MENU_LABEL = 'DSH Enterprise 账号菜单'

/** 先关菜单、下一 tick 再开官方对话框：官方 modal 的判定与我们的菜单不能抢同一帧。 */
export const ENTERPRISE_SHORTCUTS_OPEN_DELAY_MS = 0

/** 官方 settings.launcher 座位：宽窄两态、设置面板开关、设置面板打开入口、快捷键展示与官方主题源。 */
export interface EnterpriseAccountMenuProps extends EnterpriseStoreInjected {
  readonly wide: boolean
  readonly settingsOpen?: boolean | undefined
  readonly openSettings: () => void
  readonly settingsShortcut?: { readonly keys: readonly string[]; readonly aria?: string | undefined } | undefined
  /** 官方主题偏好只读源；宿主没有 ui-theme 时为 undefined，外观选项组整体禁用。 */
  readonly theme?: EnterpriseThemeSource | undefined
  /** 桌面能力面（动作 + 更新）；纯 Web 为 undefined，维护组只剩「重新载入页面」。 */
  readonly desktop?: EnterpriseDesktopSource | undefined
  /** 官方快捷键注册表只读源；宿主没有 shortcuts 服务时为 undefined，入口退回 launcher 键帽。 */
  readonly shortcuts?: EnterpriseShortcutsSource | undefined
  /**
   * 官方「编辑快捷键」对话框的 reach-in 打开器（unsupported workaround）。
   * 缺席即视为不可用：走降级（自渲染一览 + 引导 + openSettings），不静默。
   */
  readonly shortcutsOpener?: EnterpriseShortcutsReachIn | undefined
  /** 用量详情页接缝：本期不传，详情按钮是不可用态 + 「即将上线」提示。 */
  readonly onOpenUsageDetails?: (() => void) | undefined
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

/** 触发按钮的行为接缝：ref 与点击处理器由调用方给出，元素工厂自身不持有状态。 */
export interface EnterpriseMenuTriggerHandlers {
  readonly ref: Ref<HTMLButtonElement>
  readonly onClick: () => void
}

/**
 * 触发按钮的元素工厂：几何与全部交互态只在 `ENTERPRISE_MENU_STYLES` 的类规则里声明，这颗 button
 * 因此不带任何 `style`——内联 `background` 的内联优先级会压掉 `:hover`，折叠与未登录两态也必须由
 * `data-collapsed` / `data-signed-out` 属性规则覆盖。未登录态照官方占用者：不画头像圈，直接是
 * 14px 的官方省略号图标（官方调用点 `IconEllipsisOutlineMedium size={14}`）+ 「更多」。
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
    type="button"
  >
    {view.signedIn
      ? <span aria-hidden className={TRIGGER_GLYPH_CLASS}>{view.initial}</span>
      : <IconEllipsisOutlineMedium size={14} />}
    {view.wide ? <span className={TRIGGER_LABEL_CLASS}>{view.label}</span> : null}
  </button>
}


/**
 * 行项图标：登录/进度/设置/用量各取官方图标，尺寸写官方行渲染后的 14px；
 * 退出登录官方在包内自绘、不导出，用同形的 Lucide。用量行同理用 Lucide 的 Gauge：
 * 官方 `IconGaugeOutlineMedium` 未进本包的官方类型接缝（devDependency 0.1.5-rc.2 无此命名），
 * 在类型接缝里声明一个徽标之外的名字会在低版本宿主上渲染成 undefined。维护组、快捷键与
 * 帮助与文档同理走 Lucide：官方那几颗 14px 图标同样不在本包的接缝里。
 */
function menuRowIcon(id: EnterpriseMenuRowId, spinning: boolean): ReactNode {
  if (id === 'progress') return <IconLoadingOutlineMedium className="own-menu-spin" size={14} />
  if (id === 'login') return <IconUserOutlineMedium size={14} />
  if (id === 'usage') return <Gauge size={14} />
  if (id === 'feedback') return <MessageSquareText size={14} />
  if (id === 'docs') return <BookOpen size={14} />
  if (id === 'logout') return spinning ? <IconLoadingOutlineMedium className="own-menu-spin" size={14} /> : <LogOut size={14} />
  if (id === 'reload') return <RotateCw size={14} />
  if (id === 'restart') return <Power size={14} />
  if (id === 'update') return <Download size={14} />
  if (id === 'shortcuts') return <Keyboard size={14} />
  return <IconSettingsOutlineMedium size={14} />
}

/**
 * 侧栏左下角的唯一企业入口，照官方占用者语义：任何登录态点击都先弹菜单，
 * 未登录时第一项是「登录」（打开登录弹窗），「外观」与「设置」始终在列，已连接才有「退出登录」；
 * 分组内容由 enterpriseMenuBlocks 给出，设置交还宿主 openSettings() 打开官方设置面板；
 * 焦点与关闭语义全部走纯状态机，卡片、行项、portal 定位、自动聚焦与 Esc 交给官方原语；
 * 行内动作（我的用量折叠块、帮助与文档）与它们的状态/反馈都在这一棵树里。
 */
export function EnterpriseAccountMenu(props: EnterpriseAccountMenuProps): ReactNode {
  const snapshot = useAccount(props.store)
  const dialog = useEnterpriseLoginDialog(props.store)
  const usage = useEnterpriseUsageSection(props.store)
  const feedbackDialog = useEnterpriseFeedbackDialog()
  const shortcutsDialog = useEnterpriseShortcutsDialog()
  // 桌面能力面：动作（fork 专有）与更新（Harness 专有）各自探测；两边都没有时维护组只剩重载。
  const desktop = props.desktop ?? ENTERPRISE_DESKTOP_ABSENT
  const update = useEnterpriseUpdate(desktop.updates)
  const maintenance = useEnterpriseMaintenance(desktop.actions)
  // 快捷键只读行：官方注册表优先，整体不可读时退回 launcher 的 settingsShortcut（并标注范围）。
  const shortcutData = useEnterpriseShortcuts(props.shortcuts)
  const shortcutRows: readonly EnterpriseShortcutRow[] = enterpriseShortcutRows(shortcutData, props.settingsShortcut)
  const identity = enterpriseAccountIdentity(snapshot)
  /**
   * 「已是最新」只在见过一轮 checking 之后才说得出口：官方 phase 回到 idle 就是「这轮检查没有可用更新」，
   * 而从未检查过时必须说「未检查」，不能替官方宣布结论。
   */
  const [updateChecked, setUpdateChecked] = useState(false)
  useEffect(() => {
    if (update?.phase === 'checking') setUpdateChecked(true)
  }, [update?.phase])
  const model = enterpriseAccountMenu({
    nuwax: snapshot.nuwax,
    nuwaxBusy: snapshot.nuwaxBusy,
    identity,
    capabilities: {
      restart: desktop.actions !== undefined,
      shortcuts: shortcutRows.length > 0,
      updates: desktop.updates.available,
    },
    update,
    updateChecked,
  })
  /** 右侧状态控件与行文案的共同事实：相位驱动，官方没有 currentVersion/releaseNotes，这里也不造。 */
  const updateTrailing = enterpriseUpdateTrailing(update, updateChecked)
  /** 更新动作的唯一入口：行点击（经状态机）与右侧控件（stopPropagation）都落到官方 `updates.open()`。 */
  const openUpdate = (): void => { desktop.updates.open() }
  /** 「快捷键」行的官方键帽：取官方注册表里 `shortcuts.open` 那条，取不到就不显示按键。 */
  const shortcutsEntry = enterpriseShortcutKeys(shortcutRows, 'shortcuts.open')
  // 会话行与入口都读 **NUWAX 登录态**（本刀：登录入口换成 NUWAX）；企业连接态照旧驱动市场与用量。
  const entry = enterpriseLoginEntry(snapshot.nuwax, snapshot.nuwaxBusy)
  // 入口去向只有一个答案（菜单），aria-haspopup 因此恒为 menu；类型由决策函数给出。
  const entryPath = enterpriseMenuEntryPath(snapshot.nuwax, snapshot.nuwaxBusy)
  const signedIn = entry.action === 'logout'
  const [menu, setMenu] = useState<EnterpriseMenuState>(ENTERPRISE_MENU_CLOSED)
  const menuRef = useRef(menu)
  const trigger = useRef<HTMLButtonElement>(null)
  /** 帮助与文档打开失败时的行内可见反馈（菜单保持打开，用户不必去找日志）。 */
  const [helpNotice, setHelpNotice] = useState<string | undefined>(undefined)
  /** 菜单宽度＝触发按钮 hover 区域的实测宽度：等宽即左右边缘对齐（官方无论左对齐还是居中）。
      侧栏可折叠、宽度会变，故由 ResizeObserver 跟随；折叠态 36px 不足以承载菜单，回落最小可读宽度。 */
  const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined)
  const settingsWasOpen = useRef(props.settingsOpen === true)

  /**
   * 产品裁决 B 的执行序列：我们的菜单已由状态机同步关闭 → **下一 tick** 才走 reach-in，
   * 免得官方 modal 的判定与我们的菜单抢同一帧。reach-in 没打开官方对话框时绝不静默：
   * 亮出「一览 + 引导」弹窗并调官方 `openSettings()`，用户永远有一条能走通的路。
   */
  const openShortcutsDialog = useCallback((): void => {
    globalThis.setTimeout(() => {
      const opener = props.shortcutsOpener
      const degrade = (): void => {
        shortcutsDialog.openDialog(ENTERPRISE_SHORTCUTS_GUIDE)
        props.openSettings()
      }
      if (opener === undefined) { degrade(); return }
      void opener.open().then(result => {
        if (result.outcome === 'opened') return
        degrade()
      }, degrade)
    }, ENTERPRISE_SHORTCUTS_OPEN_DELAY_MS)
  }, [props.shortcutsOpener, props.openSettings, shortcutsDialog])


  /** 事件入口：先按纯状态机得到新状态与效果，再落地。状态只在 run 里前进，ref 与 state 不会分叉。 */
  const run = (event: EnterpriseMenuEvent, startLogout?: () => void): void => {
    const next = enterpriseMenuTransition(menuRef.current, event)
    menuRef.current = next.state
    setMenu(next.state)
    applyEnterpriseMenuEffects(next.effects, {
      closeDialog: dialog.closeDialog,
      // 打开时的焦点进入菜单由官方 Menu 的 autoFocus 承担（它自己用无焦点环的方式落焦）。
      focusMenu: () => undefined,
      focusTrigger: () => { trigger.current?.focus() },
      openLogin: dialog.openDialog,
      openSettings: props.openSettings,
      openShortcuts: openShortcutsDialog,
      openFeedback: feedbackDialog.openDialog,
      requestReload: maintenance.requestReload,
      requestRestart: maintenance.requestRestart,
      requestUpdate: openUpdate,
      startLogout,
    })
  }
  // 官方 Menu 要求 onClose 稳定（它是其文档监听器的依赖）：事件到达时再读最新处理器。
  const runRef = useRef(run)
  useEffect(() => { runRef.current = run })
  const closeMenu = useCallback(() => {
    // 官方 Menu 已经把键盘关闭的焦点归还做掉了，这里只收回菜单，指针关闭不抢焦点。
    runRef.current({ type: 'release' })
  }, [])
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

  useEffect(() => {
    const node = trigger.current
    if (node === null || typeof ResizeObserver === 'undefined') return
    /** 官方 Menu 的 .list 左右各 4px 内边距：内容宽 + 8 = 卡片宽，故减去它才与按钮等宽。 */
    const surfacePadding = 8
    const minMenuWidth = 200
    const sync = (): void => {
      const width = node.offsetWidth - surfacePadding
      setMenuWidth(width >= minMenuWidth ? width : minMenuWidth)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(node)
    return () => { observer.disconnect() }
  }, [props.wide])

  const select = (command: EnterpriseMenuCommand, startLogout?: () => void): void => {
    run({ type: 'select', command }, startLogout)
  }
  /** 外观组里的 Tab：官方 Menu 只结算 role=menuitem，menuitemradio 不在它的定义里，按契约补上关闭与归还。 */
  const onThemeGroupKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return
    const menuEvent = enterpriseMenuKeyEvent(event.key)
    if (menuEvent === undefined) return
    event.preventDefault()
    run(menuEvent)
  }
  /**
   * 帮助与文档：地址由账号投影的平台地址派生（不写死域名），打开优先走 Host 系统浏览器通道、
   * 失败退 `window.open`；两条路都没成就把可见提示留在行下面。菜单不关——这是行内动作，
   * 关掉菜单就没有地方摆这条反馈。
   */
  const openDocs = (): void => {
    const url = enterpriseHelpUrl(identity.platformUrl)
    if (url === undefined) {
      setHelpNotice(ENTERPRISE_HELP_UNCONFIGURED_HINT)
      return
    }
    setHelpNotice(undefined)
    void openEnterpriseHelp({ api: props.store.api, url }).then(outcome => {
      if (outcome !== 'failed') return
      setHelpNotice(`${ENTERPRISE_HELP_FAILED_HINT}${url}`)
    })
  }
  const spinning = snapshot.busy !== undefined
  /** 分区到行项的映射：设置、用量、反馈、帮助与快捷键分区各是单行，外观分区由主题组自己渲染，维护组按能力面成组。 */
  const sectionRows = (section: EnterpriseMenuSection): readonly EnterpriseMenuItem[] => {
    switch (section) {
      case 'usage': return [model.usage]
      case 'feedback': return [model.feedback]
      case 'docs': return [model.docs]
      case 'settings': return [model.settings]
      case 'shortcuts': return model.shortcuts === undefined ? [] : [model.shortcuts]
      case 'maintenance': return model.maintenance
      case 'session': return model.session
      default: return []
    }
  }
  /**
   * 行项渲染：行本体仍然是官方 MenuItemButton（键盘漫游、悬停、危险色全归官方）。
   * 两种行内动作先行：用量行只翻转折叠态、帮助行就地打开；其余行才走「选中即关闭」的状态机。
   * 更新行在标签槽里多挂右侧状态控件——它嵌在 `role=menuitem` 的 button 内，所以控件自己
   * stopPropagation，一次点击不会既走按钮又关菜单。
   */
  const renderRow = (row: EnterpriseMenuItem, section: EnterpriseMenuSection, startLogout: () => void): ReactNode => {
    if (row.id === 'usage') {
      return <OfficialMenuItemButton
        disabled={row.disabled}
        icon={menuRowIcon(row.id, spinning)}
        key={row.id}
        onSelect={usage.toggle}
      >
        <span className="own-menu-row" title={row.title}>
          <span className="own-menu-row-text">{row.label}</span>
          <EnterpriseUsageRowContent expanded={usage.expanded} />
        </span>
      </OfficialMenuItemButton>
    }
    if (row.id === 'docs') {
      return <OfficialMenuItemButton
        disabled={row.disabled}
        icon={menuRowIcon(row.id, spinning)}
        key={row.id}
        onSelect={openDocs}
      >
        <span className="own-menu-row" title={row.title}>
          <span className="own-menu-row-text">{row.label}</span>
          {row.hint === undefined ? null : <span className="own-menu-row-hint">{row.hint}</span>}
        </span>
      </OfficialMenuItemButton>
    }
    const command: EnterpriseMenuCommand = row.id
    return <OfficialMenuItemButton
      key={row.id}
      danger={row.danger === true}
      disabled={row.disabled}
      icon={menuRowIcon(row.id, spinning)}
      onSelect={() => { select(command, row.id === 'logout' ? startLogout : undefined) }}
      shortcut={row.id === 'settings' ? props.settingsShortcut : row.id === 'shortcuts' ? shortcutsEntry : undefined}
    >
      <span className="own-menu-row" title={row.title}>
        <span className="own-menu-row-text">{row.label}</span>
        {section === 'maintenance' && row.id === 'update'
          ? <EnterpriseUpdateTrailingControl onOpen={openUpdate} trailing={updateTrailing} />
          : null}
      </span>
    </OfficialMenuItemButton>
  }
  /**
   * 官方卡片只负责外框与键盘，内容按官方行几何排：头部 → 发丝线 →【偏好】→ 发丝线 →【企业服务】→ 发丝线 →【会话】。
   * 线只在相邻视觉块之间画，组内一律不画；条数由 `ENTERPRISE_MENU_SEPARATOR_COUNT` 常量锁定（防退化）。
   */
  const panel = (startLogout: () => void): ReactNode => <div className="own-menu-content" style={menuWidth === undefined ? undefined : { width: menuWidth }}>
    <div className="own-menu-header" role="presentation">
      <span aria-hidden className={TRIGGER_GLYPH_CLASS}>
        {model.presentsAccount ? model.initial : <IconUserOutlineMedium size={16} />}
      </span>
      <span className="own-menu-header-text">
        <span className="own-menu-header-title" title={model.title}>{model.title}</span>
        <span className="own-menu-header-detail" title={model.detail}>{model.detail}</span>
      </span>
    </div>
    {/* 用户信息下方固定一条发丝线：头部是第一个视觉块，线画在它与首个分组之间。 */}
    <div className="own-menu-separator" role="separator" />
    {enterpriseMenuBlocks(model).map((block, index) => <Fragment key={block.id}>
      {/* 官方对落在列表首位之前的发丝线有专门的去重规则（Menu.module.css .itemWrap:first-child），首块前不画。 */}
      {index === 0 ? null : <div className="own-menu-separator" role="separator" />}
      {block.sections.map(section => section === 'appearance'
        ? <div key={section} onKeyDown={onThemeGroupKeyDown} role="presentation"><EnterpriseThemeOptionGroup source={props.theme} /></div>
        : <Fragment key={section}>
          {sectionRows(section).map(row => <Fragment key={row.id}>
            {renderRow(row, section, startLogout)}
            {/* 用量展开区与开关同一棵树；折叠时根本不渲染，因此折叠态不会取数。 */}
            {section === 'usage' && usage.expanded
              ? <EnterpriseUsagePanel
                onRefresh={usage.refresh}
                {...(props.onOpenUsageDetails === undefined ? {} : { onOpenUsageDetails: props.onOpenUsageDetails })}
                state={usage.state}
              />
              : null}
            {/* 帮助打开失败的可见反馈：就摆在那一行下面，菜单不关。 */}
            {section === 'docs' && helpNotice !== undefined
              ? <p className="own-menu-notice" role="status">{helpNotice}</p>
              : null}
          </Fragment>)}
        </Fragment>)}
    </Fragment>)}
  </div>
  const launcher = (startLogout: () => void): ReactNode => <OfficialMenu
    anchor={enterpriseMenuTriggerElement({
      ariaExpanded: menu.open,
      entryPath,
      initial: model.initial,
      label: model.triggerLabel,
      signedIn,
      state: snapshot.nuwax?.state ?? snapshot.phase,
      wide: props.wide,
    }, {
      onClick: () => { run({ type: 'launch', dialogOpen: dialog.open }) },
      ref: trigger,
    })}
    autoFocus
    className="own-menu-anchor"
    onClose={closeMenu}
    open={menu.open}
    portal
    side="top"
  >
    {panel(startLogout)}
  </OfficialMenu>
  // 退出确认挂在菜单之外，所以菜单关闭不会卸载确认弹窗；未登录时没有行项引用它的开启器。
  // `target="nuwax"`：这一格退出的是 NUWAX 会话（本刀之后它就是"登录入口"那个登录）。
  return <>
    <style>{ENTERPRISE_MENU_STYLES}</style>
    <LogoutConfirmation store={props.store} disabled={entry.disabled} target="nuwax">{launcher}</LogoutConfirmation>
    {/* 登录弹窗必须与菜单同树渲染：开关是本组件状态，缺这一行会让「登录」点击静默失效（不崩溃、不报错）。 */}
    <EnterpriseLoginDialog onClose={dialog.closeDialog} open={dialog.open} store={props.store} />
    {/* 「帮助与反馈」同理：开关是 feedbackDialog 的状态，表单与提交都在弹窗内收敛。 */}
    <EnterpriseFeedbackDialog onClose={feedbackDialog.closeDialog} open={feedbackDialog.open} store={props.store} />
    {/* 「快捷键」同理：开关是 shortcutsDialog 的状态；reach-in 失败时它同时是降级面（一览 + 引导）。 */}
    <EnterpriseShortcutsDialog
      notice={shortcutsDialog.notice}
      onClose={shortcutsDialog.closeDialog}
      onOpenSettings={props.openSettings}
      open={shortcutsDialog.open}
      rows={shortcutRows}
    />
    {/* 维护反馈同理：开关是 maintenance 的状态；它是请求后的可见反馈（含超时），不是二次确认。 */}
    <EnterpriseMaintenanceNotice notice={maintenance.notice} onClose={maintenance.close} />
  </>
}
