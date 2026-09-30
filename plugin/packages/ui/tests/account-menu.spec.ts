/**
 * [INPUT]: 依赖 menu-model 的入口决策/菜单模型/分组与发丝线常量/状态机/效果执行器、account-menu 的触发按钮元素工厂与源码、menu-styles 的注入样式表、maintenance-view 的右侧控件源码，以及 account-state 的账号投影与 login-dialog 的入口投影
 * [OUTPUT]: 锁定入口一律弹菜单（未登录七态也走菜单且不直开弹窗）、末行会话动作位三态共用同一格、三组分区内容与顺序（偏好＝外观·我的用量·设置·快捷键／企业服务＝帮助与反馈·帮助与文档·维护／会话）、**发丝线数量 === 视觉块数 − 1 = 3**、更新行的「状态标签 + 快捷键按钮」两件事都不重复行标签、帮助与文档未配置即禁用且有可见提示、外部点击与 Esc 关闭、焦点去向与各行的效果序列、我们自有的发丝线取更浅 token 且不覆盖官方 CSS、品牌行已移除，以及四个弹窗「开关与元素同树」与右侧控件 stopPropagation 的源码级不变量
 * [POS]: dsh-ui 个人中心菜单的无 React 契约回归，真实 DOM 与视觉由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_MENU_CLOSED,
  ENTERPRISE_MENU_OPEN,
  ENTERPRISE_MENU_SEPARATOR_COUNT,
  ENTERPRISE_MENU_VISUAL_BLOCKS,
  applyEnterpriseMenuEffects,
  enterpriseAccountMenu,
  enterpriseMenuBlocks,
  enterpriseMenuCommandEffects,
  enterpriseMenuEntryPath,
  enterpriseMenuKeyEvent,
  enterpriseMenuSections,
  enterpriseMenuTransition,
  type EnterpriseMenuTargets,
} from '../src/account-menu.js'
import {
  enterpriseMenuTriggerElement,
  type EnterpriseMenuTriggerHandlers,
  type EnterpriseMenuTriggerView,
} from '../src/account-menu.js'
import { enterpriseAccountIdentity } from '../src/account-state.js'
import {
  ENTERPRISE_HELP_HINT,
  ENTERPRISE_HELP_UNCONFIGURED_HINT,
} from '../src/help-link.js'
import { ENTERPRISE_MENU_STYLES } from '../src/menu-styles.js'
import type { EnterpriseAccountBootstrap, EnterpriseLocalStatus } from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  Modal: vi.fn(),
}))

/** 副作用记录器：断言状态机给出的效果序列，而不是组件内部实现。 */
function harness(calls: string[]): EnterpriseMenuTargets {
  return {
    closeDialog: () => { calls.push('close-dialog') },
    focusMenu: () => { calls.push('focus-menu') },
    focusTrigger: () => { calls.push('focus-trigger') },
    openLogin: () => { calls.push('open-login') },
    openFeedback: () => { calls.push('open-feedback') },
    openSettings: () => { calls.push('open-settings') },
    openShortcuts: () => { calls.push('open-shortcuts') },
    requestReload: () => { calls.push('request-reload') },
    requestRestart: () => { calls.push('request-restart') },
    requestUpdate: () => { calls.push('request-update') },
    startLogout: () => { calls.push('start-logout') },
  }
}

/** 能力面：除纯 Web 恒有的重载外，其余三项都要探测才在列。 */
const ALL_CAPABILITIES = { restart: true, shortcuts: true, updates: true } as const

const status: EnterpriseLocalStatus = {
  bundleVersion: '0.1.0',
  platformUrl: 'https://enterprise.example.com',
  transport: 'webServer.register',
  state: 'READY',
  user: { departmentId: '20011', displayName: '张三', id: '10031', username: 'zhangsan' },
}

const bootstrap: EnterpriseAccountBootstrap = {
  device: { id: '90018', installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a', status: 'ACTIVE' },
  user: status.user!,
}

/** 未登录全部七态：undefined 与六个终态。 */
const SIGNED_OUT_STATES = [undefined, 'UNCONFIGURED', 'SIGNED_OUT', 'CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED'] as const
/** 登录进行中：浏览器授权、设备注册、配置同步。 */
const IN_FLIGHT_STATES = ['AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING'] as const
const USABLE_STATES = ['READY', 'REFRESHING'] as const

const identityOf = (state: EnterpriseLocalStatus['state'], user: EnterpriseLocalStatus['user'] = undefined) =>
  enterpriseAccountIdentity({ phase: 'ready', status: { ...status, state, user } })

/** 菜单模型：头部两行与行项集合都由登录态与能力面推导。 */
describe('the personal-center menu model follows the account state', () => {
  it('shows 未登录 plus one guiding line and the login row on the last line while signed out', () => {
    for (const [state, guide] of [
      ['UNCONFIGURED', '设置 DSH Enterprise Server 地址后即可登录'],
      ['SIGNED_OUT', '尚未连接企业服务'],
      ['AUTH_EXPIRED', '企业会话已失效，请重新登录'],
    ] as const) {
      const model = enterpriseAccountMenu({ state, busy: undefined, identity: identityOf(state) })
      expect(model.title).toBe('未登录')
      expect(model.detail).toBe(guide)
      expect(model.presentsAccount).toBe(false)
      // 官方用 t('more')：未登录的按钮是菜单触发器，不再是登录按钮。
      expect(model.triggerLabel).toBe('更多')
      // 末行是唯一的会话动作位：未登录的「登录」不再占用 account 组，那个组已整体退场。
      expect(model.session).toEqual([{ id: 'login', label: '登录', disabled: false }])
      expect(model.settings).toEqual({ id: 'settings', label: '设置', disabled: false })
      expect(enterpriseMenuSections(model).at(-1)).toBe('session')
      expect(enterpriseMenuSections(model)).not.toContain('account')
    }
  })

  it('shows nickname, login name and department with a confirmed sign-out on the last line once connected', () => {
    const model = enterpriseAccountMenu({
      state: 'READY',
      busy: undefined,
      identity: enterpriseAccountIdentity({ phase: 'ready', status, bootstrap }),
    })
    expect(model).toMatchObject({
      title: '张三', detail: 'zhangsan · 20011', initial: '张', presentsAccount: true, triggerLabel: '张三',
    })
    expect(model.session).toEqual([{ id: 'logout', label: '退出登录', disabled: false, danger: true }])
    expect(enterpriseMenuSections(model).at(-1)).toBe('session')
  })

  it('moves the progress row into the same last-line slot while an authorization is in flight', () => {
    const identity = identityOf('AUTHORIZING')
    const model = enterpriseAccountMenu({ state: 'AUTHORIZING', busy: 'login', identity })
    expect(model.session).toEqual([{ id: 'progress', label: '查看登录进度', disabled: false }])
    // 登录中已按账号信息呈现头部，但按钮仍是官方 t('more') 的「更多」，还没拿到企业会话。
    expect(model).toMatchObject({ title: '企业账号', detail: '请在系统浏览器中完成企业登录', presentsAccount: true, triggerLabel: '更多' })
    expect(enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: 'login', identity }).session)
      .toEqual([{ id: 'login', label: '登录', disabled: true }])
    expect(enterpriseAccountMenu({ state: 'READY', busy: 'logout', identity }).session)
      .toEqual([{ id: 'logout', label: '正在退出', disabled: true, danger: true }])
  })

  it('keeps 外观、我的用量、设置 and 帮助与反馈 in the menu for every account state', () => {
    for (const state of [...SIGNED_OUT_STATES, ...IN_FLIGHT_STATES, ...USABLE_STATES]) {
      const model = enterpriseAccountMenu({ state, busy: undefined, identity: identityOf(state) })
      expect(enterpriseMenuSections(model)).toContain('appearance')
      expect(enterpriseMenuSections(model)).toContain('usage')
      expect(enterpriseMenuSections(model)).toContain('settings')
      expect(enterpriseMenuSections(model)).toContain('feedback')
      expect(model.usage).toEqual({ id: 'usage', label: '我的用量', disabled: false })
      expect(model.settings).toEqual({ id: 'settings', label: '设置', disabled: false })
      // 未登录也照样在列：该行可见是硬要求，先登录的引导语由弹窗自己说。
      expect(model.feedback).toEqual({ id: 'feedback', label: '帮助与反馈', disabled: false })
    }
  })

  it('orders the three semantic groups and drops the department placeholder', () => {
    const signedOut = enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: undefined, identity: identityOf('SIGNED_OUT') })
    expect(enterpriseMenuSections(signedOut))
      .toEqual(['appearance', 'usage', 'settings', 'feedback', 'docs', 'maintenance', 'session'])
    expect(enterpriseMenuBlocks(signedOut).map(block => block.id))
      .toEqual(['preferences', 'enterprise', 'session'])

    const connected = enterpriseAccountMenu({ state: 'READY', busy: undefined, identity: identityOf('READY', { ...status.user!, departmentId: null }) })
    expect(connected.detail).toBe('zhangsan')

    const featured = enterpriseAccountMenu({
      state: 'READY', busy: undefined, identity: identityOf('READY', status.user), capabilities: ALL_CAPABILITIES,
    })
    expect(enterpriseMenuSections(featured))
      .toEqual(['appearance', 'usage', 'settings', 'shortcuts', 'feedback', 'docs', 'maintenance', 'session'])
    // 组内顺序照产品口径：帮助与反馈 → 帮助与文档 → 检查更新 → 重新载入页面 → 重新启动应用。
    expect(featured.maintenance.map(row => row.id)).toEqual(['update', 'reload', 'restart'])
    expect(featured.shortcuts).toEqual({ id: 'shortcuts', label: '快捷键', disabled: false })
    expect(enterpriseMenuBlocks(featured).map(block => block.sections)).toEqual([
      ['appearance', 'usage', 'settings', 'shortcuts'],
      ['feedback', 'docs', 'maintenance'],
      ['session'],
    ])
  })

  it('puts 我的用量 immediately before 设置', () => {
    for (const state of [...SIGNED_OUT_STATES, ...IN_FLIGHT_STATES, ...USABLE_STATES]) {
      const sections = enterpriseMenuSections(enterpriseAccountMenu({ state, busy: undefined, identity: identityOf(state) }))
      expect(sections.indexOf('usage'), state).toBe(sections.indexOf('settings') - 1)
    }
  })

  it('keeps the brand fallback initial when the projection has no display name', () => {
    const identity = enterpriseAccountIdentity({ phase: 'ready', status: { ...status, user: undefined } })
    expect(identity.displayName).toBe('企业账号')
    expect(enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: undefined, identity }).initial).toBe('企')
  })
})

/**
 * 队列第 10 项：分割线收敛为分组边界。
 * 断言是**常量**：发丝线条数恒等于「视觉块数（头部 + 三个语义分组）− 1」，防止再退化成「每个 section 一条线」。
 */
describe('the hairline separators only mark group boundaries', () => {
  const anyModel = enterpriseAccountMenu({
    state: 'READY', busy: undefined, identity: identityOf('READY', status.user), capabilities: ALL_CAPABILITIES,
  })

  it('pins the separator count to the block count instead of the section count', () => {
    expect(ENTERPRISE_MENU_VISUAL_BLOCKS).toEqual(['header', 'preferences', 'enterprise', 'session'])
    expect(ENTERPRISE_MENU_SEPARATOR_COUNT).toBe(3)
    expect(ENTERPRISE_MENU_SEPARATOR_COUNT).toBe(ENTERPRISE_MENU_VISUAL_BLOCKS.length - 1)
    // 渲染口径：头部下 1 条 + 分组之间（分组数 − 1）条 = 视觉块数 − 1。
    const blocks = enterpriseMenuBlocks(anyModel)
    expect(1 + (blocks.length - 1)).toBe(ENTERPRISE_MENU_SEPARATOR_COUNT)
    // 分组数远少于分区数：线数绝不能跟着分区数走（6 个分区 → 曾经 6 条线）。
    expect(enterpriseMenuSections(anyModel).length).toBeGreaterThan(blocks.length)
  })

  it('keeps every group non-empty and multi-section where the product says so', () => {
    const blocks = enterpriseMenuBlocks(anyModel)
    for (const block of blocks) expect(block.sections.length, block.id).toBeGreaterThan(0)
    expect(blocks[0]?.sections).toHaveLength(4)
    expect(blocks[1]?.sections).toHaveLength(3)
  })
})

/** 维护组与快捷键入口只在对应能力存在时出现：能就显示、不能就隐藏，绝不假装点了有用。 */
describe('the maintenance group follows the detected desktop capabilities', () => {
  it('always offers the reload row and hides restart/update without the matching channel', () => {
    const model = enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: undefined, identity: identityOf('SIGNED_OUT') })
    expect(model.maintenance).toEqual([{ id: 'reload', label: '重新载入页面', disabled: false }])
    expect(model.shortcuts).toBeUndefined()
  })

  it('adds 重新启动应用 only when the official renderer-action channel exists', () => {
    const withActions = enterpriseAccountMenu({
      state: 'SIGNED_OUT',
      busy: undefined,
      identity: identityOf('SIGNED_OUT'),
      capabilities: { restart: true, shortcuts: false, updates: false },
    })
    expect(withActions.maintenance.map(row => row.id)).toEqual(['reload', 'restart'])
  })

  it('hides the whole 更新 row while the official updates channel is unavailable', () => {
    const withoutUpdates = enterpriseAccountMenu({
      state: 'SIGNED_OUT',
      busy: undefined,
      identity: identityOf('SIGNED_OUT'),
      capabilities: { restart: false, shortcuts: false, updates: false },
      update: { phase: 'available' },
    })
    expect(withoutUpdates.maintenance.map(row => row.id)).toEqual(['reload'])
  })

  it('keeps the 更新 row label constant while the phase moves', () => {
    const row = (update: { readonly phase: string } | undefined) => enterpriseAccountMenu({
      state: 'SIGNED_OUT',
      busy: undefined,
      identity: identityOf('SIGNED_OUT'),
      capabilities: ALL_CAPABILITIES,
      update: update as never,
    }).maintenance.find(candidate => candidate.id === 'update')
    // 行标签恒为「检查更新」；失败原因不再顶到行文案上（它归右侧状态标签）。
    expect(row(undefined)).toEqual({ id: 'update', label: '检查更新', disabled: false })
    expect(row({ phase: 'idle' })).toEqual({ id: 'update', label: '检查更新', disabled: false })
    expect(row({ phase: 'available' })).toEqual({ id: 'update', label: '检查更新', disabled: false })
    expect(row({ phase: 'downloading' })).toEqual({ id: 'update', label: '检查更新', disabled: true })
    expect(row({ phase: 'ready' })).toEqual({ id: 'update', label: '检查更新', disabled: false })
    expect(row({ phase: 'error', failure: 'check-network' }))
      .toEqual({ id: 'update', label: '检查更新', disabled: false })
  })
})

/** 队列第 9 项：帮助与文档由平台地址派生，未配置时禁用并把原因摆在行上（不静默）。 */
describe('the 帮助与文档 row follows the platform address', () => {
  it('enables the row with a 需登录 hint when the platform address is configured', () => {
    const model = enterpriseAccountMenu({ state: 'READY', busy: undefined, identity: identityOf('READY', status.user) })
    expect(model.docs).toEqual({
      disabled: false,
      hint: ENTERPRISE_HELP_HINT,
      id: 'docs',
      label: '帮助与文档',
      title: ENTERPRISE_HELP_HINT,
    })
    expect(ENTERPRISE_HELP_HINT).toContain('需登录')
  })

  it('disables the row and states the reason when the platform address is missing', () => {
    // UNCONFIGURED 的投影里 platformUrl 是 null（decodeEnterpriseLocalStatus 的形状门禁保证二者同真同假）。
    const identity = enterpriseAccountIdentity({
      phase: 'ready',
      status: { ...status, platformUrl: null, state: 'UNCONFIGURED', user: undefined },
    })
    const unconfigured = enterpriseAccountMenu({ state: 'UNCONFIGURED', busy: undefined, identity })
    expect(identity.isPlatformConfigured).toBe(false)
    expect(unconfigured.docs.disabled).toBe(true)
    expect(unconfigured.docs.hint).toBe(ENTERPRISE_HELP_UNCONFIGURED_HINT)
    expect(unconfigured.docs.title).toBe(ENTERPRISE_HELP_UNCONFIGURED_HINT)
  })
})

/** 入口不再按登录态分叉：任何状态都先弹菜单，登录弹窗只能由菜单行项打开。 */
describe('the trigger always opens the menu', () => {
  it('answers 菜单 for every signed-out, in-flight and usable state', () => {
    for (const state of [...SIGNED_OUT_STATES, ...IN_FLIGHT_STATES, ...USABLE_STATES]) {
      expect(enterpriseMenuEntryPath(state, undefined)).toBe('menu')
      expect(enterpriseMenuEntryPath(state, 'login')).toBe('menu')
      expect(enterpriseMenuEntryPath(state, 'logout')).toBe('menu')
    }
  })

  it('opens the menu, never the login dialog, from every signed-out state', () => {
    for (const state of SIGNED_OUT_STATES) {
      expect(enterpriseMenuEntryPath(state, undefined)).toBe('menu')
      const launch = enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'launch', dialogOpen: false })
      expect(launch.state).toEqual(ENTERPRISE_MENU_OPEN)
      expect(launch.effects).toEqual(['focus-menu'])
      expect(launch.effects).not.toContain('open-login')
      const calls: string[] = []
      applyEnterpriseMenuEffects(launch.effects, harness(calls))
      expect(calls).toEqual(['focus-menu'])
    }
  })

  it('handles the menu path with the existing toggle semantics', () => {
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'launch', dialogOpen: false }))
      .toEqual({ state: ENTERPRISE_MENU_OPEN, effects: ['focus-menu'] })
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'launch', dialogOpen: false }))
      .toEqual({ state: ENTERPRISE_MENU_CLOSED, effects: ['focus-trigger'] })
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'launch', dialogOpen: true })).toEqual({
      state: ENTERPRISE_MENU_CLOSED,
      effects: ['focus-trigger'],
    })
  })

  it('closes the menu before the login row opens the dialog', () => {
    const selected = enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'select', command: 'login' })
    expect(selected.state).toEqual(ENTERPRISE_MENU_CLOSED)
    expect(selected.effects).toEqual(['focus-trigger', 'open-login'])
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'select', command: 'progress' }).effects)
      .toEqual(['focus-trigger', 'open-login'])
  })
})

/** 菜单路径的切换与互斥语义保持不变：菜单和弹窗不共存。 */
describe('the menu path keeps the existing exclusion semantics', () => {
  it('closes an open login dialog before the menu takes the foreground', () => {
    const opened = enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'launch', dialogOpen: true })
    expect(opened.effects).toEqual(['close-dialog', 'focus-menu'])
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'dismiss' }).effects).toEqual([])
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'select', command: 'login' }).effects).toEqual([])
  })
})

/** 关闭语义：键盘关闭归还焦点给触发按钮，指针关闭与前方界面接管都不抢焦点。 */
describe('the menu closes with a defined focus owner', () => {
  it('returns focus to the trigger for Escape, Tab and the trigger itself', () => {
    for (const event of [{ type: 'dismiss' }, { type: 'launch', dialogOpen: false }] as const) {
      const closed = enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, event)
      expect(closed.state).toEqual(ENTERPRISE_MENU_CLOSED)
      expect(closed.effects).toEqual(['focus-trigger'])
    }
    for (const key of ['Escape', 'Tab']) {
      expect(enterpriseMenuKeyEvent(key)).toEqual({ type: 'dismiss' })
      expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, enterpriseMenuKeyEvent(key)!))
        .toEqual({ state: ENTERPRISE_MENU_CLOSED, effects: ['focus-trigger'] })
    }
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) {
      expect(enterpriseMenuKeyEvent(key)).toBeUndefined()
    }
  })

  it('leaves focus where the pointer or the new foreground surface put it', () => {
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'release' }))
      .toEqual({ state: ENTERPRISE_MENU_CLOSED, effects: [] })
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'settings-open' }))
      .toEqual({ state: ENTERPRISE_MENU_CLOSED, effects: [] })
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'settings-open' }).state)
      .toEqual(ENTERPRISE_MENU_CLOSED)
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'release' }).state)
      .toEqual(ENTERPRISE_MENU_CLOSED)
  })
})

/** 选中分发：设置交还宿主面板，退出走既有确认，登录与进度开同一个弹窗；焦点先回到触发按钮。 */
describe('selection runs the command effects in order', () => {
  it('opens the official settings panel on the settings row and hands focus back first', () => {
    const calls: string[] = []
    const targets = harness(calls)
    applyEnterpriseMenuEffects(enterpriseMenuCommandEffects('settings'), targets)
    expect(calls).toEqual(['focus-trigger', 'open-settings'])
    expect(targets.startLogout).toBeDefined()
    expect(calls).not.toContain('open-login')
  })

  it('routes the destructive row through the existing sign-out confirmation', () => {
    const calls: string[] = []
    applyEnterpriseMenuEffects(enterpriseMenuCommandEffects('logout'), harness(calls))
    expect(calls).toEqual(['focus-trigger', 'start-logout'])
  })

  it('opens the shared login dialog for both login and progress rows', () => {
    for (const command of ['login', 'progress'] as const) {
      const calls: string[] = []
      applyEnterpriseMenuEffects(enterpriseMenuCommandEffects(command), harness(calls))
      expect(calls).toEqual(['focus-trigger', 'open-login'])
    }
  })

  it('closes the dialog before the menu takes focus when it opens over one', () => {
    const calls: string[] = []
    const opened = enterpriseMenuTransition(ENTERPRISE_MENU_CLOSED, { type: 'launch', dialogOpen: true })
    applyEnterpriseMenuEffects(opened.effects, harness(calls))
    expect(calls).toEqual(['close-dialog', 'focus-menu'])
  })

  it('opens the feedback form dialog from the 帮助与反馈 row and hands focus back first', () => {
    const calls: string[] = []
    applyEnterpriseMenuEffects(enterpriseMenuCommandEffects('feedback'), harness(calls))
    expect(calls).toEqual(['focus-trigger', 'open-feedback'])
    const selected = enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'select', command: 'feedback' })
    expect(selected.state).toEqual(ENTERPRISE_MENU_CLOSED)
    expect(selected.effects).toEqual(['focus-trigger', 'open-feedback'])
  })

  it('opens the read-only shortcuts reference from the 快捷键 row', () => {
    const calls: string[] = []
    applyEnterpriseMenuEffects(enterpriseMenuCommandEffects('shortcuts'), harness(calls))
    expect(calls).toEqual(['focus-trigger', 'open-shortcuts'])
  })

  it('gives each maintenance row exactly one effect sequence', () => {
    const expected = {
      reload: ['focus-trigger', 'request-reload'],
      restart: ['focus-trigger', 'request-restart'],
      update: ['focus-trigger', 'request-update'],
    } as const
    for (const [command, effects] of Object.entries(expected)) {
      const calls: string[] = []
      applyEnterpriseMenuEffects(enterpriseMenuCommandEffects(command as 'reload'), harness(calls))
      expect(calls).toEqual(effects)
      // 行点击只走状态机这一次；右侧控件是第二条独立入口，必须自己 stopPropagation，
      // 因此任何一次行点击都不得出现「两次 request-update」这种叠加。
      expect(calls.filter(call => call === 'request-update')).toHaveLength(command === 'update' ? 1 : 0)
    }
    expect(enterpriseMenuTransition(ENTERPRISE_MENU_OPEN, { type: 'select', command: 'update' }).state)
      .toEqual(ENTERPRISE_MENU_CLOSED)
  })
})

/** 触发按钮的类名与两态属性是 hover / 折叠 / 未登录三条 CSS 规则的唯一开关。 */
describe('the trigger button carries the class and state attributes hover needs', () => {
  const handlers: EnterpriseMenuTriggerHandlers = { onClick: () => undefined, ref: null }
  const view: EnterpriseMenuTriggerView = {
    ariaExpanded: false,
    entryPath: 'menu',
    initial: '张',
    label: '更多',
    signedIn: false,
    state: 'SIGNED_OUT',
    wide: true,
  }

  it('marks the wide signed-out row with the hover class and both state attributes', () => {
    const element = enterpriseMenuTriggerElement(view, handlers)
    expect(element.props.className).toBe('own-menu-trigger')
    expect(element.props['data-collapsed']).toBe('false')
    expect(element.props['data-signed-out']).toBe('true')
    expect(element.props['data-enterprise-menu-trigger']).toBe('')
    expect(element.props['data-enterprise-state']).toBe('SIGNED_OUT')
    // 内联 background 的内联优先级会压掉 :hover（本次缺陷的根因），元素必须完全不带内联样式。
    expect(element.props.style).toBeUndefined()
    expect(element.props.type).toBe('button')
  })

  it('renders the official 14px ellipsis instead of a hand-drawn avatar circle while signed out', () => {
    const element = enterpriseMenuTriggerElement(view, handlers)
    const glyph = element.props.children[0]
    // 官方占用者未登录时是裸的 IconEllipsisOutlineMedium size={14}，不套头像圈。
    expect(glyph.props.size).toBe(14)
    expect(glyph.props.className).toBeUndefined()
    expect(element.props.children[1].props.className).toBe('own-menu-trigger-label')
  })

  it('flips both attributes for the collapsed rail and the signed-in row', () => {
    const rail = enterpriseMenuTriggerElement({ ...view, initial: '张', signedIn: true, wide: false }, handlers)
    expect(rail.props['data-collapsed']).toBe('true')
    expect(rail.props['data-signed-out']).toBe('false')
    expect(rail.props.style).toBeUndefined()
    // 已登录仍是官方 .avatar 的 24px 圆，圈内是首字；窄栏不渲染文案。
    expect(rail.props.children[0].props.className).toBe('own-menu-avatar')
    expect(rail.props.children[0].props.children).toBe('张')
    expect(rail.props.children[1]).toBeNull()
  })
})

/** 注入样式表持有我们自绘部分的全部交互态；兜底必须主题中性，深色硬编码在深色主题上等于没有反馈。 */
describe('the injected stylesheet owns every trigger interaction state', () => {
  /** 样式表里每一处悬停的 token 兜底声明，逐条核对兜底值。 */
  const hoverBackgrounds = [...ENTERPRISE_MENU_STYLES.matchAll(
    /background: (var\(--dsw-alias-interactive-bg-(?:hover|hover-danger|active)[^;]*\));/g,
  )].map(match => match[1] ?? '')

  it('keeps a usable trigger hover rule on the official sidebar token', () => {
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-trigger:hover')
    expect(ENTERPRISE_MENU_STYLES)
      .toContain('var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent))')
  })

  it('copies the official trigger geometry, radius and both state blocks verbatim', () => {
    // 官方 AccountMenu.module.css：44px 整行 / 6px 内衬 / gap 8 / radius-md / 14px 字号。
    expect(ENTERPRISE_MENU_STYLES).toContain('height: 44px')
    expect(ENTERPRISE_MENU_STYLES).toContain('padding: 6px')
    expect(ENTERPRISE_MENU_STYLES).toContain('gap: 8px')
    // 官方 .root{flex:1;min-width:0} + .anchor{width:100%} 的合体：Menu 锚点 span 撑满设置行。
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-anchor { flex: 1; min-width: 0; width: 100%; }')
    expect(ENTERPRISE_MENU_STYLES).toContain('border-radius: var(--dsw-radius-md, 12px)')
    expect(ENTERPRISE_MENU_STYLES).toContain('font-size: 14px')
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-menu-trigger[data-collapsed='true'] { box-sizing: border-box; justify-content: center; gap: 0; width: 36px; height: 36px; padding: 0; }")
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-menu-trigger[data-signed-out='true']:not([data-collapsed='true']) { height: 32px; padding: 6px 2px 6px 6px; line-height: 20px; }")
    // 官方 .avatar 的 24px 圆与两颗官方 token。
    expect(ENTERPRISE_MENU_STYLES).toContain('var(--dsw-alias-bg-skeleton')
    expect(ENTERPRISE_MENU_STYLES).toContain('var(--dsw-alias-label-tertiary, #667085)')
  })

  it('covers focus-visible and both trigger states', () => {
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-trigger:focus-visible')
    expect(ENTERPRISE_MENU_STYLES).toContain('var(--dsw-focus-ring-width, 2px)')
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-menu-trigger[data-collapsed='true']")
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-menu-trigger[data-signed-out='true']:not([data-collapsed='true'])")
  })

  it('leaves the menu card and its rows to the official primitive', () => {
    // 卡片与行项由官方 Menu/MenuItemButton 渲染：我们不许留任何自绘行、卡片或分隔线之外的官方件。
    expect(ENTERPRISE_MENU_STYLES).not.toContain('.own-menu-item')
    expect(ENTERPRISE_MENU_STYLES).not.toContain('background: var(--dsw-specific-menu')
    expect(ENTERPRISE_MENU_STYLES).not.toContain('box-shadow: var(--dsw-elevation-prominent')
    // 我们那条发丝线几何照官方 Menu.module.css 的 .separator：0.5px、3px 2px 外边距。
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-separator { height: 0.5px; margin: 3px 2px;')
  })

  it('tones every separator we own down to the lighter official token', () => {
    // 官方 .separator 用 border-l2（浅色 #0000001a / 深色 #ffffff1f）；我们的发丝线统一调浅到 border-l1
    // （#0000000a / #ffffff0f），并带主题中性兜底。官方那份 CSS 不在本包里，也不许被覆盖。
    expect(ENTERPRISE_MENU_STYLES).toContain(
      '.own-menu-separator { height: 0.5px; margin: 3px 2px; background: var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 8%, transparent)); }',
    )
    const separatorRule = /\.own-menu-separator \{[^}]*\}/u.exec(ENTERPRISE_MENU_STYLES)?.[0] ?? ''
    expect(separatorRule).not.toBe('')
    expect(separatorRule).not.toContain('--dsw-alias-border-l2')
    // 覆盖官方 CSS 的红线：样式表里不得出现官方模块类名。
    expect(ENTERPRISE_MENU_STYLES).not.toMatch(/\.(separator|itemWrap|itemLabel|shortcut)\s*\{/)
  })

  it('lays the inline usage block out in exactly three columns', () => {
    // 队列第 11 项：展开区每行三列（周期｜剩余额度｜详情），表头与数据行共用同一个轨道模板。
    expect(ENTERPRISE_MENU_STYLES)
      .toContain('.own-usage-head, .own-usage-item { align-items: center; display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr) 64px auto; }')
    const tracks = (/grid-template-columns: ([^;]+);/u.exec(ENTERPRISE_MENU_STYLES)?.[1] ?? '')
      .replace(/minmax\([^)]*\)/gu, 'X').trim().split(/\s+/u)
    expect(tracks).toHaveLength(3)
    // 耗尽用警示色，剩余百分比右对齐。
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-usage-percent[data-exhausted='true']")
    expect(ENTERPRISE_MENU_STYLES).toContain('var(--dsw-alias-status-error, #c4320a)')
  })

  it('falls back to a theme-neutral currentColor overlay instead of a dark-on-dark colour', () => {
    // 自绘部分只剩触发按钮与外观组两处悬停填充；行与卡片的悬停归官方样式表。
    expect(hoverBackgrounds.length).toBeGreaterThanOrEqual(2)
    for (const declaration of hoverBackgrounds) {
      expect(declaration).toContain('color-mix(in srgb, currentColor')
      expect(declaration).not.toMatch(/rgba\(\s*9\s*,\s*9\s*,\s*11/)
    }
    expect(ENTERPRISE_MENU_STYLES).not.toMatch(/rgba\(\s*9\s*,\s*9\s*,\s*11/)
  })
})

describe('the launcher tree renders the dialogs and inline blocks it opens', () => {
  /** 每个弹窗都要在自己的标签里同时出现开关与关闭回调；缺一个就是线上那种「点了没反应」。 */
  async function source(): Promise<string> {
    const { readFile } = await import('node:fs/promises')
    return readFile(new URL('../src/account-menu.tsx', import.meta.url), 'utf8')
  }

  it('pairs every dialog with the very state that opens it', async () => {
    const text = await source()
    const pairs = [
      ['<EnterpriseFeedbackDialog', 'open={feedbackDialog.open}', 'onClose={feedbackDialog.closeDialog}'],
      ['<EnterpriseShortcutsDialog', 'open={shortcutsDialog.open}', 'onClose={shortcutsDialog.closeDialog}'],
      ['<EnterpriseMaintenanceNotice', 'notice={maintenance.notice}', 'onClose={maintenance.close}'],
      ['<EnterpriseLoginDialog', 'open={dialog.open}', 'onClose={dialog.closeDialog}'],
    ] as const
    for (const [tag, open, close] of pairs) {
      const index = text.indexOf(tag)
      expect(index, tag).toBeGreaterThan(-1)
      const element = text.slice(index, text.indexOf('/>', index))
      expect(element, tag).toContain(open)
      expect(element, tag).toContain(close)
    }
    // 用量折叠块不是弹窗：它的展开区必须与 useEnterpriseUsageSection 的状态同树渲染。
    expect(text).toContain('<EnterpriseUsagePanel')
    expect(text).toContain('state={usage.state}')
    expect(text).toContain('usage.expanded')
    // 帮助与文档的失败反馈同样落在行下面（菜单不关），有状态就有元素。
    expect(text).toContain('helpNotice !== undefined')
  })

  it('drops the brand row and draws the separator under the account facts', async () => {
    const text = await source()
    expect(text).not.toContain('own-menu-brand')
    expect(text).not.toContain('useEnterpriseBranding')
    const header = text.indexOf('own-menu-header-detail')
    const separator = text.indexOf('own-menu-separator', header)
    // 头部（用户信息）之后必须是发丝线，然后是各分组。
    expect(separator).toBeGreaterThan(header)
    expect(separator).toBeLessThan(text.indexOf('enterpriseMenuBlocks(model)'))
  })

  it('keeps the row click and the trailing control from firing each other', async () => {
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(new URL('../src/maintenance-view.tsx', import.meta.url), 'utf8')
    const control = text.slice(text.indexOf('export function EnterpriseUpdateTrailingControl'))
    const body = control.slice(0, control.indexOf('\n}'))
    // 右侧控件嵌在官方行项（role=menuitem 的 button）里，必须先 stopPropagation 再触发。
    expect(body.indexOf('stopPropagation')).toBeGreaterThan(-1)
    expect(body.indexOf('stopPropagation')).toBeLessThan(body.indexOf('props.onOpen()'))
    // 反方向：行点击只走状态机一次，不许在组件里再补一次 open。
    const menu = await source()
    expect(menu).not.toMatch(/onSelect=\{\(\) => \{[^}]*desktop\.updates\.open/u)
  })

  it('closes our menu before the official shortcuts reach-in runs on the next tick', async () => {
    const text = await source()
    // 产品裁决 B 的时序：状态机先关菜单，setTimeout 才调 reach-in；失败必须降级到「一览 + 引导」+ openSettings。
    expect(text).toContain('globalThis.setTimeout(() => {')
    expect(text).toContain('ENTERPRISE_SHORTCUTS_OPEN_DELAY_MS')
    expect(text).toContain('ENTERPRISE_SHORTCUTS_GUIDE')
    expect(text).toContain('props.openSettings()')
  })
})
