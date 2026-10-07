/**
 * [INPUT]: 依赖 login-page 的四个纯投影（NUWAX 登录态呈现 / 正文动作分支 / 本地凭据先判 / 页脚服务地址）与 account-state 的共享状态图标映射
 * [OUTPUT]: 锁定登录入口换成 NUWAX 之后的四条产品词汇规则——两态与两个在途方向各有自己的文案、动作分支只看「已登录没有」、凭据本地先判只判「两项都要填」、**页脚只认宿主投影的 NUWAX 服务地址**（读不到就画占位，绝不回落到企业平台地址）
 * [POS]: dsh-ui 登录弹窗正文的产品词汇门禁；真实 DOM、弹窗尺寸与滚动由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import { enterpriseStateIcon, enterpriseStatePresentation } from '../src/account-state.js'
import {
  enterpriseLoginPageAction,
  enterpriseNuwaxCredentialError,
  enterpriseNuwaxPresentation,
  enterpriseNuwaxServiceAddress,
} from '../src/login-page.js'
import { ENTERPRISE_CONNECTION_STATES, type EnterpriseNuwaxPrincipal, type EnterpriseNuwaxStatus } from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: vi.fn(), Input: vi.fn(), Modal: vi.fn() }))

const principal: EnterpriseNuwaxPrincipal = { uid: 538565, userName: '538565', nickName: '李猛', tenantId: 1 }
const signedIn = { state: 'signed-in', principal } as const
const signedOut = { state: 'signed-out' } as const

/**
 * 登录态呈现：**只有 NUWAX 这两态 + 两个在途方向**，不画企业那 11 态
 * （企业连接态仍由 account-state 的 `CONNECTION_PRESENTATION` 负责，账号设置页照旧用它）。
 */
describe('the login entry speaks NUWAX states only', () => {
  it('draws a signed-out entry with the NUWAX wording, never the enterprise one', () => {
    for (const status of [undefined, signedOut] as const) {
      const presentation = enterpriseNuwaxPresentation(status, undefined)
      expect(presentation).toMatchObject({ title: '未登录', description: '请使用你的 NUWAX 账号登录', icon: 'building' })
      // 企业那句「设置 DSH Enterprise Server 地址后即可登录」不许在这里出现：登录入口已经不需要地址了。
      expect(presentation.description).not.toContain('Server')
    }
  })

  it('marks a signed-in session as success and both in-flight directions as progress', () => {
    expect(enterpriseNuwaxPresentation(signedIn, undefined)).toMatchObject({ title: '已登录', icon: 'success' })
    expect(enterpriseNuwaxPresentation(signedOut, 'login')).toMatchObject({ title: '正在登录', icon: 'progress' })
    // 在途事实优先于登录态本身：正在退出时不许同时说「已登录」。
    expect(enterpriseNuwaxPresentation(signedIn, 'logout')).toMatchObject({ title: '正在退出', icon: 'progress' })
  })
})

/** 正文动作分支：**只有**已登录才是退出，其余（含还没读到状态、含在途）一律给登录表单。 */
describe('the login page action branches on the NUWAX session alone', () => {
  it('offers the form for every unsigned shape and the sign-out for a signed-in one', () => {
    for (const status of [undefined, signedOut] as const) {
      expect(enterpriseLoginPageAction(status, undefined)).toBe('login')
    }
    expect(enterpriseLoginPageAction(signedOut, 'login')).toBe('login')
    expect(enterpriseLoginPageAction(signedIn, undefined)).toBe('logout')
    expect(enterpriseLoginPageAction(signedIn, 'logout')).toBe('logout')
  })

  it('covers the whole NUWAX union so no employee state loses its action', () => {
    const actions = [
      enterpriseLoginPageAction(signedIn, undefined),
      enterpriseLoginPageAction(signedOut, undefined),
      enterpriseLoginPageAction(undefined, undefined),
    ]
    expect(new Set(actions)).toEqual(new Set(['login', 'logout']))
  })
})

/**
 * 本地先判只做一件事：两项都要填。三条**刻意不做**的事各有反例钉着——
 * 不判口令复杂度、不 trim 口令、不把账号里的空白当合法输入。
 */
describe('the local pre-check only requires both fields', () => {
  it('asks for whichever field is missing and passes a complete pair through', () => {
    expect(enterpriseNuwaxCredentialError('', 'x')).toBe('请输入 NUWAX 账号')
    expect(enterpriseNuwaxCredentialError('   ', 'x')).toBe('请输入 NUWAX 账号')
    expect(enterpriseNuwaxCredentialError('538565', '')).toBe('请输入 NUWAX 口令')
    expect(enterpriseNuwaxCredentialError('538565', 'anything')).toBeUndefined()
  })

  it('never trims the password and never judges its strength', () => {
    // 首尾空白可能是口令的一部分 ⇒ 非空即通过；「弱口令」也不在这里拦（那是 NUWAX 平台的规则）。
    expect(enterpriseNuwaxCredentialError('538565', '   ')).toBeUndefined()
    expect(enterpriseNuwaxCredentialError('538565', '12')).toBeUndefined()
  })
})

/** 状态图标与状态文案同源，账号区与登录弹窗不许各画一套。 */
describe('the shared state icon follows the state presentation', () => {
  it('carries the presentation color, size and caller animation class', () => {
    const icon = enterpriseStateIcon(enterpriseStatePresentation('AUTHORIZING'), 16, 'own-login-spin') as unknown as {
      readonly props: { readonly color: string; readonly size: number; readonly className?: string; readonly 'aria-hidden'?: boolean }
    }
    expect(icon.props.color).toBe(enterpriseStatePresentation('AUTHORIZING').color)
    expect(icon.props.size).toBe(16)
    expect(icon.props.className).toBe('own-login-spin')
    expect(icon.props['aria-hidden']).toBe(true)
  })

  it('renders a valid icon element for every presentation, NUWAX ones included', () => {
    for (const state of ENTERPRISE_CONNECTION_STATES) {
      expect(enterpriseStateIcon(enterpriseStatePresentation(state))).toBeTruthy()
    }
    for (const status of [undefined, signedOut, signedIn] as const) {
      expect(enterpriseStateIcon(enterpriseNuwaxPresentation(status, undefined))).toBeTruthy()
    }
  })
})

/**
 * 页脚那行的来源纪律（**本组就是那处缺陷的回归锁**）。
 *
 * 症状：登录入口已经换成 NUWAX，页脚却显示**企业平台地址**（`status.platformUrl`）——
 * 员工会把它读成「这个登录要连那台机器」，而实际打的是 NUWAX 服务。
 * 判据：这一行的唯一来源是宿主投影的 `origin`；宿主没给就是没给（页面画占位），
 * **绝不**回落到企业地址、也**不**自己拼一个。真实 DOM 由 Harness 手工冒烟覆盖。
 */
describe('the login footer names the NUWAX service and never an enterprise address', () => {
  it('reads the host-projected NUWAX origin verbatim', () => {
    expect(enterpriseNuwaxServiceAddress({ ...signedOut, origin: 'https://agent.sunoasis.com.cn' }))
      .toBe('https://agent.sunoasis.com.cn')
    expect(enterpriseNuwaxServiceAddress({ ...signedIn, origin: 'https://nuwax.example.com' }))
      .toBe('https://nuwax.example.com')
  })

  it('admits it does not know instead of inventing an address', () => {
    // 还没读到 / 部署显式停用 / 畸形空串：一律 undefined，由页面画占位。
    expect(enterpriseNuwaxServiceAddress(undefined)).toBeUndefined()
    expect(enterpriseNuwaxServiceAddress(signedOut)).toBeUndefined()
    expect(enterpriseNuwaxServiceAddress({ ...signedOut, origin: '' })).toBeUndefined()
    // 企业平台地址**不是**这里的兜底：同一份投影里就算还挂着平台地址（现在并没有），这一格也只读 `origin`。
    const withPlatformAddress = {
      state: 'signed-out',
      platformUrl: 'https://62.234.16.179',
    } as unknown as EnterpriseNuwaxStatus
    expect(enterpriseNuwaxServiceAddress(withPlatformAddress)).toBeUndefined()
  })
})
