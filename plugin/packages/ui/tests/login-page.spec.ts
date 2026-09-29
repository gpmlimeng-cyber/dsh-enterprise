/**
 * [INPUT]: 依赖 login-page 的原登录页投影、account-state 的状态文案与投影源
 * [OUTPUT]: 锁定登录弹窗正文的两个原件规则（Server 编辑器显隐、登录/取消/登出分支）与共享状态图标映射
 * [POS]: dsh-ui 登录弹窗正文的产品词汇门禁，真实 DOM、弹窗尺寸与滚动由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import { enterpriseStateIcon, enterpriseStatePresentation } from '../src/account-state.js'
import { enterpriseLoginPageAction, enterpriseLoginServerEditorVisible } from '../src/login-page.js'
import { ENTERPRISE_CONNECTION_STATES } from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: vi.fn(), Input: vi.fn(), Modal: vi.fn() }))

/** 原件 account-view.tsx:635：只有可编辑且未配置、或显式点了「修改 Server 地址」才展开编辑器。 */
describe('the ported Server editor keeps the original visibility rule', () => {
  it('expands for an unconfigured client and for an explicit edit request', () => {
    expect(enterpriseLoginServerEditorVisible('UNCONFIGURED', false)).toBe(true)
    expect(enterpriseLoginServerEditorVisible('SIGNED_OUT', true)).toBe(true)
    for (const state of ['CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED'] as const) {
      expect(enterpriseLoginServerEditorVisible(state, true)).toBe(true)
      expect(enterpriseLoginServerEditorVisible(state, false)).toBe(false)
    }
  })

  it('never expands without an editable session, even while editing is requested', () => {
    expect(enterpriseLoginServerEditorVisible(undefined, true)).toBe(false)
    for (const state of ['READY', 'REFRESHING', 'AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING'] as const) {
      expect(enterpriseLoginServerEditorVisible(state, false)).toBe(false)
      expect(enterpriseLoginServerEditorVisible(state, true)).toBe(false)
    }
  })
})

/** 原件 account-view.tsx:376-396：未配置无动作，迁移中取消，可用会话退出，其余登录企业账号。 */
describe('the ported login actions keep the original branch rule', () => {
  it('maps every connection state to exactly one action', () => {
    expect(enterpriseLoginPageAction('UNCONFIGURED')).toBe('none')
    for (const state of ['AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING'] as const) {
      expect(enterpriseLoginPageAction(state)).toBe('cancel-login')
    }
    for (const state of ['READY', 'REFRESHING'] as const) {
      expect(enterpriseLoginPageAction(state)).toBe('logout')
    }
    for (const state of ['SIGNED_OUT', 'CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED', undefined] as const) {
      expect(enterpriseLoginPageAction(state)).toBe('login')
    }
  })

  it('covers the whole state union so no employee state loses its action', () => {
    const actions = ENTERPRISE_CONNECTION_STATES.map(state => enterpriseLoginPageAction(state))
    expect(actions).toHaveLength(ENTERPRISE_CONNECTION_STATES.length)
    expect(actions.filter(action => action === 'none')).toEqual(['none'])
    expect(new Set(actions)).toEqual(new Set(['none', 'cancel-login', 'logout', 'login']))
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

  it('renders a valid icon element for every presentation', () => {
    for (const state of ENTERPRISE_CONNECTION_STATES) {
      expect(enterpriseStateIcon(enterpriseStatePresentation(state))).toBeTruthy()
    }
  })
})
