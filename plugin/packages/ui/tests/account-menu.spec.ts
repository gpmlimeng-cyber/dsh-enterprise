/**
 * [INPUT]: 依赖 account-menu 的入口决策/菜单模型/分区顺序/状态机/效果执行器，以及 account-state 的账号投影与 login-dialog 的入口投影
 * [OUTPUT]: 锁定入口一律弹菜单（未登录七态也走菜单且不直开弹窗）、菜单项集合与顺序（未登录首项「登录」，外观与设置始终在列，已连接才有退出登录）、登录中的进度行、外部点击与 Esc 关闭、焦点去向与设置项的面板切换调用
 * [POS]: dsh-ui 个人中心菜单的无 React 契约回归，真实 DOM 与视觉由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_MENU_CLOSED,
  ENTERPRISE_MENU_OPEN,
  ENTERPRISE_MENU_STYLES,
  applyEnterpriseMenuEffects,
  enterpriseAccountMenu,
  enterpriseMenuCommandEffects,
  enterpriseMenuEntryPath,
  enterpriseMenuKeyEvent,
  enterpriseMenuSections,
  enterpriseMenuTransition,
  enterpriseMenuTriggerElement,
  type EnterpriseMenuTargets,
} from '../src/account-menu.js'
import { enterpriseAccountIdentity } from '../src/account-state.js'
import type { EnterpriseAccountBootstrap, EnterpriseLocalStatus } from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(), Input: vi.fn(), Modal: vi.fn(), useAnchoredPosition: vi.fn(), useDismissOnOutsidePointer: vi.fn(),
}))

/** 副作用记录器：断言状态机给出的效果序列，而不是组件内部实现。 */
function harness(calls: string[]): EnterpriseMenuTargets {
  return {
    closeDialog: () => { calls.push('close-dialog') },
    focusMenu: () => { calls.push('focus-menu') },
    focusTrigger: () => { calls.push('focus-trigger') },
    openLogin: () => { calls.push('open-login') },
    openSettings: () => { calls.push('open-settings') },
    startLogout: () => { calls.push('start-logout') },
  }
}

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

/** 菜单模型：头部两行与行项集合都由登录态与状态文案推导。 */
describe('the personal-center menu model follows the account state', () => {
  it('shows 未登录 plus one guiding line and a login row while signed out', () => {
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
      expect(model.account).toEqual([{ id: 'login', label: '登录', disabled: false }])
      expect(model.settings).toEqual({ id: 'settings', label: '设置', disabled: false })
      expect(model.session).toEqual([])
    }
  })

  it('shows nickname, login name and department with a confirmed sign-out once connected', () => {
    const model = enterpriseAccountMenu({
      state: 'READY',
      busy: undefined,
      identity: enterpriseAccountIdentity({ phase: 'ready', status, bootstrap }),
    })
    expect(model).toMatchObject({
      title: '张三', detail: 'zhangsan · 20011', initial: '张', presentsAccount: true, triggerLabel: '张三',
    })
    expect(model.account).toEqual([])
    expect(model.session).toEqual([{ id: 'logout', label: '退出登录', disabled: false, danger: true }])
  })

  it('offers a progress row instead of a login row while an authorization is in flight', () => {
    const identity = identityOf('AUTHORIZING')
    const model = enterpriseAccountMenu({ state: 'AUTHORIZING', busy: 'login', identity })
    expect(model.account).toEqual([{ id: 'progress', label: '查看登录进度', disabled: false }])
    expect(model.session).toEqual([])
    // 登录中已按账号信息呈现头部，但按钮仍是官方 t('more') 的「更多」，还没拿到企业会话。
    expect(model).toMatchObject({ title: '企业账号', detail: '请在系统浏览器中完成企业登录', presentsAccount: true, triggerLabel: '更多' })
    expect(enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: 'login', identity }).account)
      .toEqual([{ id: 'login', label: '登录', disabled: true }])
    expect(enterpriseAccountMenu({ state: 'READY', busy: 'logout', identity }).session)
      .toEqual([{ id: 'logout', label: '正在退出', disabled: true, danger: true }])
  })

  it('keeps 外观 and 设置 in the menu for every account state', () => {
    for (const state of [...SIGNED_OUT_STATES, ...IN_FLIGHT_STATES, ...USABLE_STATES]) {
      const model = enterpriseAccountMenu({ state, busy: undefined, identity: identityOf(state) })
      expect(enterpriseMenuSections(model)).toContain('appearance')
      expect(enterpriseMenuSections(model)).toContain('settings')
      expect(model.settings).toEqual({ id: 'settings', label: '设置', disabled: false })
    }
  })

  it('orders the login row first and drops the department placeholder from the header line', () => {
    const signedOut = enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: undefined, identity: identityOf('SIGNED_OUT') })
    expect(enterpriseMenuSections(signedOut)).toEqual(['account', 'appearance', 'settings'])
    expect(signedOut.account[0]).toEqual({ id: 'login', label: '登录', disabled: false })

    const connected = enterpriseAccountMenu({ state: 'READY', busy: undefined, identity: identityOf('READY', { ...status.user!, departmentId: null }) })
    expect(connected.detail).toBe('zhangsan')

    const inFlight = enterpriseAccountMenu({ state: 'ENROLLING', busy: undefined, identity: identityOf('ENROLLING') })
    expect(enterpriseMenuSections(inFlight)).toEqual(['account', 'appearance', 'settings'])
    expect(enterpriseMenuSections(enterpriseAccountMenu({ state: 'READY', busy: undefined, identity: identityOf('READY', status.user) })))
      .toEqual(['appearance', 'settings', 'session'])
  })

  it('keeps the brand fallback initial when the projection has no display name', () => {
    const identity = enterpriseAccountIdentity({ phase: 'ready', status: { ...status, user: undefined } })
    expect(identity.displayName).toBe('企业账号')
    expect(enterpriseAccountMenu({ state: 'SIGNED_OUT', busy: undefined, identity }).initial).toBe('企')
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
})

/** 触发按钮的类名与两态属性是 hover / 折叠 / 未登录三条 CSS 规则的唯一开关。 */
describe('the trigger button carries the class and state attributes hover needs', () => {
  const handlers: EnterpriseMenuTriggerHandlers = { onClick: () => undefined, onKeyDown: () => undefined, ref: null }
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

  it('flips both attributes for the collapsed rail and the signed-in row', () => {
    const rail = enterpriseMenuTriggerElement({ ...view, initial: '张', signedIn: true, wide: false }, handlers)
    expect(rail.props['data-collapsed']).toBe('true')
    expect(rail.props['data-signed-out']).toBe('false')
    expect(rail.props.style).toBeUndefined()
  })
})

/** 注入样式表持有全部交互态；兜底必须主题中性，深色硬编码在深色主题上等于没有反馈。 */
describe('the injected stylesheet owns every trigger interaction state', () => {
  /** 样式表里每一处悬停/按下的 token 兜底声明，逐条核对兜底值。 */
  const hoverBackgrounds = [...ENTERPRISE_MENU_STYLES.matchAll(
    /background: (var\(--dsw-alias-interactive-bg-(?:hover|hover-danger|active)[^;]*\));/g,
  )].map(match => match[1] ?? '')

  it('keeps a usable trigger hover rule on the official sidebar token', () => {
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-trigger:hover')
    expect(ENTERPRISE_MENU_STYLES)
      .toContain('var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent))')
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-item:hover:not(:disabled)')
  })

  it('covers focus-visible, pressed and both trigger states', () => {
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-trigger:active')
    expect(ENTERPRISE_MENU_STYLES).toContain('.own-menu-trigger:focus-visible')
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-menu-trigger[data-collapsed='true']")
    expect(ENTERPRISE_MENU_STYLES).toContain(".own-menu-trigger[data-signed-out='true']:not([data-collapsed='true'])")
  })

  it('falls back to a theme-neutral currentColor overlay instead of a dark-on-dark colour', () => {
    expect(hoverBackgrounds.length).toBeGreaterThanOrEqual(4)
    for (const declaration of hoverBackgrounds) {
      expect(declaration).toContain('color-mix(in srgb, currentColor')
      expect(declaration).not.toMatch(/rgba\(\s*9\s*,\s*9\s*,\s*11/)
    }
    expect(ENTERPRISE_MENU_STYLES).not.toMatch(/rgba\(\s*9\s*,\s*9\s*,\s*11/)
  })
})
