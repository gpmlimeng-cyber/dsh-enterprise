/**
 * [INPUT]: 依赖 dsh-ui Client apply、账号菜单组件与结构化 slots test double
 * [OUTPUT]: 验证 settings.section/settings.launcher 注册身份、共享 store 注入与个人中心座位独有的官方主题源，且 shell.overlay 与旧 footer 入口已退场
 * [POS]: dsh-ui Client 组合回归测试，锁定「官方设置区 + 官方个人中心座位」路线且不把 Host Context 传入 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  apply,
  EnterpriseAccountMenu,
  EnterpriseSettingsSection,
} from '../src/client.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(), Input: vi.fn(), Modal: vi.fn(), useAnchoredPosition: vi.fn(), useDismissOnOutsidePointer: vi.fn(),
}))

describe('enterprise Client plugin', () => {
  it('registers the account section and the personal-center launcher through official slots', () => {
    const registrations: { options: Record<string, unknown>; component: unknown }[] = []
    const register = vi.fn((options, component) => {
      registrations.push({ options, component })
      return () => undefined
    })
    const slotsInject = vi.fn((_name, callback: () => unknown) => callback())
    const remoteEvents: string[] = []
    const serviceWaits: string[][] = []
    apply({
      slots: { inject: slotsInject, register },
      remote: { $on: (event) => { remoteEvents.push(event); return () => undefined } },
      get: () => undefined,
      inject: (deps) => { serviceWaits.push([...deps]); return undefined },
      on: vi.fn(() => () => undefined),
      effect: effect => { effect() },
    })
    expect(remoteEvents).toContain('llm/adapters-updated')
    // 不硬注入 ui-theme：只等一次服务出现来补发通知，服务缺席时插件照常激活。
    expect(serviceWaits).toEqual([['theme']])

    expect(slotsInject.mock.calls.map(call => call[0])).toEqual([
      'settings.section',
      'settings.launcher',
    ])
    expect(registrations.map(item => item.options)).toMatchObject([
      { name: 'settings.section', id: 'enterprise', order: 25, label: 'DSH Enterprise 设置' },
      { name: 'settings.launcher' },
    ])
    expect(registrations.map(item => item.component)).toEqual([
      EnterpriseSettingsSection,
      EnterpriseAccountMenu,
    ])
    const stores = registrations.map(item => (item.options['inject'] as () => { store: unknown })().store)
    expect(stores[0]).toBe(stores[1])
    // 外观选项组住在个人中心菜单里：只有该座位拿到官方主题源，设置区不碰主题。
    const section = registrations[0]!.options['inject'] as () => Record<string, unknown>
    const launcher = registrations[1]!.options['inject'] as () => {
      theme: { getSnapshot: () => unknown; subscribe: (listener: () => void) => () => void }
    }
    expect(section()).not.toHaveProperty('theme')
    // 宿主没有 ui-theme 时源仍存在但读不到偏好，选项组据此禁用。
    expect(launcher().theme.getSnapshot()).toBeUndefined()
    expect(launcher().theme.subscribe(() => undefined)()).toBeUndefined()
    expect(registrations.map(item => item.options['name'])).not.toContain('shell.overlay')
    // 官方账户行整行停用后，个人中心只由 launcher 座位承载，不再挂 footer 动作，避免第二入口。
    expect(registrations.map(item => item.options['name'])).not.toContain('sidebar.footer.action')
  })
})
