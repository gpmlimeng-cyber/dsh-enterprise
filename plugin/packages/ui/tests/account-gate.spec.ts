/**
 * [INPUT]: 依赖 client apply 的官方 slot 注册、login-dialog 的弹窗状态机（`nuwax` 转移）/入口投影与 account-state 的账号投影
 * [OUTPUT]: 锁定全屏门禁退场（不再注册 shell.overlay 阻断层；座位面收敛为 settings.section/launcher + plugins.item/plugins.detail.badge 共四处——独立应用商店的 main/sidebar.panellist 两处已随侧栏入口撤销）、账号区登录入口（**本刀：由 NUWAX 两态驱动**）、弹窗开关与「关窗不取消」、NUWAX 已登录即自动关闭、脱敏快照与含 ENT_SETTINGS_UNAVAILABLE 的错误码中文文案 **本刀**：inject 面末尾追加资料库两处座位名（`sidebar.panellist`/`main`），并把「已撤的商店座位不再注册」的锁细化为「那两处槽上此刻一个占用者都没有、`enterprise-store` 与 `library` 都不在注册表里」。**P1-A**：inject 面再追加 composer 两处座位名（`conversation.input.dock` / `conversation.input.left`），同样门默认关 ⇒ 零占用者。
 * [POS]: dsh-ui 登录入口的无 React 契约回归，真实 DOM 交互与视觉由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import { enterpriseAccountIdentity, enterpriseErrorMessage, enterpriseErrorDisplay, enterpriseSessionUsable } from '../src/account-state.js'
import type { EnterpriseAccountSnapshot } from '../src/account-store.js'
import { apply } from '../src/client.js'
import {
  ENTERPRISE_LOGIN_DIALOG_CLOSED,
  enterpriseLoginDialogReducer,
  enterpriseLoginEntry,
  type EnterpriseLoginDialogState,
} from '../src/login-dialog.js'
import type { EnterpriseAccountBootstrap, EnterpriseLocalStatus, EnterpriseNuwaxPrincipal } from '../src/local-api.js'

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
  // esc（口径 31）用到的原语：工具栏的 Pill 与卡片上的 Switch/Tag（本文件不渲染它们，
  // 但 mock 面要如实列出，免得"mock 里没有这个导出"变成一条与本次改动无关的假失败）。
  Pill: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
}))

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

/** NUWAX 主体夹具：字段取自宿主 `getLoginInfo` 的受控投影（uid/tenantId 是数字，两个名字是非空串）。 */
const principalFixture: EnterpriseNuwaxPrincipal = { uid: 538565, userName: '538565', nickName: '李猛', tenantId: 1 }

/** 产品决策：进入系统不再有任何全屏门禁，未登录也能正常使用宿主。 */
describe('the full-screen access gate is retired', () => {
  it('registers the two settings seats and the plugins-page market entry, never a store seat or a shell.overlay blocker', () => {
    const injected: string[] = []
    const registrations: Record<string, unknown>[] = []
    apply({
      slots: {
        inject: (name, register) => { injected.push(name); return register() },
        register: (options) => { registrations.push(options); return () => undefined },
      },
      remote: { $on: () => () => undefined },
      get: () => undefined,
      inject: () => undefined,
      on: () => () => undefined,
      effect: effect => { effect() },
    })
    expect(injected).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      // ★ **`plugins.detail.actions` 那处已撤**：官方把 actions 槽渲染在标题**上方**的 `_detailHead`，
      //   而用户要求两枚动作与标题同排 ⇒ 改由 `EnterpriseMarketTitleSlot` 挂在 badge 槽（`_titleRow` 内）。
      'sidebar.brand.mark',
      'sidebar.brand.name',
      'conversation.hero.brand.mark',
      // 资料库（本刀）：侧栏一级入口 + main 面板两处座位按同一套 inject 手法接上；
      // 管理门（本机设置）默认关，故这里只 inject、**一个占用者都不注册**。
      'sidebar.panellist',
      'main',
      // 口径 31：esc（「专家·技能·连接器」）的两处座位**紧随其后**且**常驻**（不设管理门）——
      // 槽名与资料库那两处相同，但注册表里**真的有两行**（下面的独占断言）。
      'sidebar.panellist',
      'main',
      // P1-A（把资料加入当前对话）：composer 的两处座位（已选条目条 + `@ 资料库` 按钮）同一个门驱动，同上只 inject。
      'conversation.input.dock',
      'conversation.input.left',
    ])
    // composer 那两格此刻同样一个占用者都没有（门默认关 ⇒ 既有输入区一行都不变）。
    expect(registrations.map(options => options['name'])).not.toContain('conversation.input.dock')
    expect(registrations.map(options => options['name'])).not.toContain('conversation.input.left')
    // 撤销锁（口径 31 之后更新）：`main`/`sidebar.panellist` 这两个槽上此刻恰好各**一个**占用者，
    // 且是同一个 esc 页面（`expert-skill-connector`）——**不是**当初那两处应用商店座位；
    // 资料库那两处仍被管理门（默认关）压着、一行注册都没有。`shell.overlay` 依旧不碰。
    expect(registrations.map(options => options['key'] ?? options['id'])).not.toContain('enterprise-store')
    expect(registrations.map(options => options['key'] ?? options['id'])).not.toContain('library')
    const seatNames = registrations.map(options => options['name'])
    expect(seatNames.filter(name => name === 'main')).toHaveLength(1)
    expect(seatNames.filter(name => name === 'sidebar.panellist')).toHaveLength(1)
    expect(registrations.map(options => options['key'] ?? options['id'])).toContain('expert-skill-connector')
    expect(injected).not.toContain('shell.overlay')
    expect(registrations.map(options => options['name'])).not.toContain('shell.overlay')
  })

  it('treats every disconnected state as usable host state, not as a blocked shell', () => {
    for (const state of ['UNCONFIGURED', 'SIGNED_OUT', 'CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED'] as const) {
      expect(enterpriseSessionUsable(state)).toBe(false)
      expect(enterpriseLoginEntry(state, undefined).action).toBe('open-login')
    }
    expect(enterpriseSessionUsable(undefined)).toBe(false)
  })
})

/**
 * 账号设置区在未登录时给出明确登录入口：点击动作就是打开同一个弹窗。
 * **本刀（口径 30：登录入口换成 NUWAX）**：入口投影的输入域从「企业连接 11 态」换成「NUWAX 两态」——
 * 未登录（含还没读到状态）恒可点，只有真的已登录才是退出。
 */
describe('the account area offers a login entry while disconnected', () => {
  const signedIn = { state: 'signed-in', principal: principalFixture } as const
  const signedOut = { state: 'signed-out' } as const

  it('exposes an open-login action for every unauthenticated shape', () => {
    for (const status of [undefined, signedOut] as const) {
      expect(enterpriseLoginEntry(status, undefined)).toEqual({ action: 'open-login', label: '登录', disabled: false })
    }
    // 在途的登录仍可点：点开就是那面正在转圈的表单（不是"登录"两个字被冻住）。
    expect(enterpriseLoginEntry(signedOut, 'login')).toEqual({ action: 'open-login', label: '登录进行中', disabled: false })
  })

  it('switches to a confirmed sign-out only for a signed-in NUWAX session, and greys it while leaving', () => {
    expect(enterpriseLoginEntry(signedIn, undefined)).toEqual({ action: 'logout', label: '退出登录', disabled: false })
    expect(enterpriseLoginEntry(signedIn, 'logout')).toEqual({ action: 'logout', label: '正在退出', disabled: true })
    // 已登录时一次登录在途是不可能的（表单已经不在了），但真出现也不许把退出按钮变灰锁死：
    // 判据只看 `nuwaxBusy`，不看具体的那个方向。
    expect(enterpriseLoginEntry(signedIn, 'login')).toEqual({ action: 'logout', label: '退出登录', disabled: true })
  })
})

/** 弹窗初始关闭，触发后打开；取消、Esc、遮罩共用同一个关闭入口，关闭后界面照常可用。 */
describe('the login dialog opens on demand and closes without blocking', () => {
  it('stays closed until the trigger, then closes again on cancel, Escape or mask', () => {
    const closed: EnterpriseLoginDialogState = ENTERPRISE_LOGIN_DIALOG_CLOSED
    expect(closed.open).toBe(false)
    expect(enterpriseLoginDialogReducer(closed, { type: 'close' })).toBe(closed)
    const open = enterpriseLoginDialogReducer(closed, { type: 'open' })
    expect(open.open).toBe(true)
    expect(enterpriseLoginDialogReducer(open, { type: 'close' }).open).toBe(false)
    expect(enterpriseLoginDialogReducer(open, { type: 'open' })).toBe(open)
  })

  /**
   * **契约退场（本刀：登录入口换成 NUWAX）**：原 `enterpriseLoginDialogCloseAction(state, busy)`
   * 随企业登录事务一起走了——NUWAX 登录是**一条单往返的本机 POST**，没有宿主侧事务可撤销，
   * 关窗因此不取消任何东西：那次请求照旧把它自己的结果写进共享快照（成功时弹窗也已经关着了）。
   */
  it('never cancels anything on close: a NUWAX login is one round trip with no host-side transaction', () => {
    const open: EnterpriseLoginDialogState = { open: true }
    const closed = enterpriseLoginDialogReducer(open, { type: 'close' })
    expect(closed.open).toBe(false)
    // 关窗后收到「还没登录」的推送**不许**把弹窗又弹开（否则关闭按钮等于失效）。
    expect(enterpriseLoginDialogReducer(closed, { type: 'nuwax', status: { state: 'signed-out' } })).toBe(closed)
  })
})

/** 登录成功后弹窗自动关闭，账号信息立即可见；弹窗与账号区共用同一 store 快照。 */
describe('a successful login closes the dialog and exposes the account', () => {
  it('closes on the first signed-in NUWAX status pushed from the shared snapshot', () => {
    const open: EnterpriseLoginDialogState = { open: true }
    expect(enterpriseLoginDialogReducer(open, { type: 'nuwax', status: undefined }).open).toBe(true)
    expect(enterpriseLoginDialogReducer(open, { type: 'nuwax', status: { state: 'signed-out' } }).open).toBe(true)
    expect(enterpriseLoginDialogReducer(open, {
      type: 'nuwax',
      status: { state: 'signed-in', principal: principalFixture },
    }).open).toBe(false)
  })

  it('projects login name, department, platform, device and version from a connected bootstrap', () => {
    const identity = enterpriseAccountIdentity({ phase: 'ready', status, bootstrap })
    expect(identity).toEqual({
      displayName: '张三',
      loginName: 'zhangsan',
      department: '20011',
      isDepartmentKnown: true,
      platformUrl: 'https://enterprise.example.com',
      isPlatformConfigured: true,
      deviceId: '90018',
      installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a',
      deviceLabel: '90018 · 4c96d076-a80a-4b6c-8df6-f0db804b6f0a',
      versionLabel: '0.1.0',
    })
  })

  it('keeps account fields readable before bootstrap and while signed out', () => {
    const signedOut = enterpriseAccountIdentity({
      phase: 'ready',
      status: { ...status, platformUrl: null, state: 'UNCONFIGURED', user: undefined },
    })
    expect(signedOut).toMatchObject({
      displayName: '企业账号',
      loginName: '',
      department: '未设置部门',
      platformUrl: '未配置',
      isPlatformConfigured: false,
      deviceLabel: '登录后可用',
    })
    expect(enterpriseAccountIdentity({ phase: 'loading' }).versionLabel).toBe('正在读取')
  })
})

/**
 * **契约退场（本刀）**：`enterpriseLoginSubmitPlan` 与整面 Server 地址编辑器一起走了——
 * NUWAX 登录不需要任何地址（平台地址由部署配置在宿主侧决议），也就没有"先存地址再登录"这条合并动作。
 * 逐字替换它的判据在 `tests/login-page.spec.ts`（本地先判：两项都要填）与 `nuwax-session.spec.ts`
 * （真打 /nuwax/login 的正文与稳定码）里。
 */


/** 快照契约本身不变：官方账号区停用后 store 仍是唯一事实源。 */
it('keeps the shared snapshot free of secrets and tokens', () => {
  const snapshot: EnterpriseAccountSnapshot = { phase: 'ready', status, bootstrap }
  expect(Object.keys(snapshot)).toEqual(['phase', 'status', 'bootstrap'])
  expect(JSON.stringify(snapshot)).not.toMatch(/token|secret|password/i)
})

/** 已知错误码给中文人话并附受控标识符，未命中只给兜底人话，未知形状的字符串不回显。 */
describe('error codes stay inside the local vocabulary', () => {
  it('maps known codes, falls back for unknown ones, and drops unvalidated text', () => {
    // 文案的唯一真源已搬到 src/error-messages.ts；这里锁的是 account-state 那条兼容接缝
    // （message 仍来自同一份映射，值随降维后的措辞更新）。
    expect(enterpriseErrorDisplay('ENT_AUTH_TIMEOUT')).toEqual({ message: '登录等待超时。', code: 'ENT_AUTH_TIMEOUT' })
    expect(enterpriseErrorDisplay('ENT_SOMETHING_NEW')).toEqual({ message: '操作没有完成。', code: 'ENT_SOMETHING_NEW' })
    expect(enterpriseErrorDisplay('<img src=x onerror=alert(1)>')).toEqual({ message: '操作没有完成。' })
    // 兜底与任何已知码一样：人话里**不含裸码**（详见 error-messages.spec.ts 的全码遍历断言）。
    expect(enterpriseErrorDisplay('ENT_SOMETHING_NEW').message).not.toContain('ENT_')
    expect(enterpriseErrorDisplay('<img src=x onerror=alert(1)>').message).not.toContain('ENT_')
  })

  it('gives the settings-persistence code a Chinese message from the same table', () => {
    // 该码由本地路由在「本 profile 的企业设置不可持久化」时返回（平台层同名稳定码）。
    expect(enterpriseErrorDisplay('ENT_SETTINGS_UNAVAILABLE')).toEqual({
      message: '企业设置暂时无法保存。',
      code: 'ENT_SETTINGS_UNAVAILABLE',
    })
    expect(enterpriseErrorMessage('ENT_SETTINGS_UNAVAILABLE')).toBe('企业设置暂时无法保存。')
  })
})
