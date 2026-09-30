/**
 * [INPUT]: 依赖账号视图的固定连接/受管插件状态投影与协议类型，并读取 account-view 源码核对 tab 装配
 * [OUTPUT]: 验证会话可用判定、Server 编辑时机、插件状态文案与「插件/配方/技能」三目录 tab 的顺序与按需挂载；登录入口与弹窗契约由 account-gate.spec 覆盖
 * [POS]: dsh-ui 插件 tab 的产品词汇门禁，真实 DOM 与视觉由 Harness snapshot 覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  enterprisePluginStatePresentation,
  enterpriseServerEditable,
  enterpriseSessionUsable,
  enterpriseStatePresentation,
} from '../src/account-view.js'
import { ENTERPRISE_CONNECTION_STATES, MANAGED_PLUGIN_STATES } from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: vi.fn(), Input: vi.fn(), Modal: vi.fn() }))

describe('enterprise plugin state presentation', () => {
  it('treats only a usable enterprise session as connected', () => {
    expect(enterpriseSessionUsable()).toBe(false)
    for (const state of ENTERPRISE_CONNECTION_STATES) {
      expect(enterpriseSessionUsable(state)).toBe(state === 'READY' || state === 'REFRESHING')
    }
  })

  it('presents a usable account session as logged in', () => {
    expect(enterpriseStatePresentation('READY').title).toBe('已登录')
  })

  it('only offers Server editing without a usable session or authentication transition', () => {
    expect(enterpriseServerEditable()).toBe(false)
    for (const state of ['READY', 'REFRESHING', 'AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING'] as const) {
      expect(enterpriseServerEditable(state)).toBe(false)
    }
    for (const state of ['UNCONFIGURED', 'SIGNED_OUT', 'CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED'] as const) {
      expect(enterpriseServerEditable(state)).toBe(true)
    }
  })

  it('covers all managed states with stable employee-facing language', () => {
    for (const state of MANAGED_PLUGIN_STATES) {
      expect(enterprisePluginStatePresentation(state)).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        color: expect.any(String),
      })
    }
    expect(enterprisePluginStatePresentation('RESTART_REQUIRED').description).toBe('重启 Harness 后生效')
    expect(enterprisePluginStatePresentation('FAILED').title).toBe('处理失败')
  })
})

describe('enterprise settings catalog tabs', () => {
  it('places 技能 after 插件/配方 and mounts the skill market only while selected', async () => {
    const view = await readFile(new URL('../src/account-view.tsx', import.meta.url), 'utf8')
    const order = ["label: '插件'", "label: '配方'", "label: '技能'"].map(label => view.indexOf(label))
    expect(order.every(index => index > 0)).toBe(true)
    expect(order).toEqual([...order].sort((left, right) => left - right))
    expect(view).toContain("{ id: 'skills' as const, label: '技能' }")
    expect(view).toContain('panel-skills')
    // 按需挂载：只有选中技能 tab 才渲染市场视图（与插件/配方同口径，不预取数据）。
    expect(view).toContain("{activeTab === 'skills' ? <EnterpriseSkillMarket store={props.store} /> : null}")
  })
})
