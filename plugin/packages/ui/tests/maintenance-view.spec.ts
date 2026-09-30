/**
 * [INPUT]: 依赖 maintenance-view 的相位文案投影、超时阈值、维护控制器与右侧状态控件，外加 account-menu 的源码
 * [OUTPUT]: 锁定「已请求重启 + 超时提示」三态文案（官方 8s 静默那一格的补丁）、阈值来源、右侧控件的 stopPropagation 与只读态，以及弹窗元素必须与开关同树
 * [POS]: dsh-ui 维护反馈与更新行的契约回归；有人拿掉超时提示、让右侧点击同时触发行点击、或把反馈弹窗做成二次确认，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_MAINTENANCE_TIMEOUT_MS,
  EnterpriseMaintenanceNotice,
  EnterpriseUpdateTrailingControl,
  enterpriseMaintenanceNotice,
} from '../src/maintenance-view.js'
import type { EnterpriseUpdateTrailing } from '../src/desktop-runtime.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
}))

/** 两个维护动作的三态文案；秒数必须与阈值同源，改阈值不会留下对不上的提示。 */
describe('the maintenance notice states what was requested and what to do on timeout', () => {
  it('keeps the two official timeouts as the single source of the copy', () => {
    expect(ENTERPRISE_MAINTENANCE_TIMEOUT_MS).toEqual({ reload: 5_000, restart: 10_000 })
    expect(enterpriseMaintenanceNotice({ kind: 'restart', outcome: 'requested' }).description)
      .toContain('10 秒')
    expect(enterpriseMaintenanceNotice({ kind: 'reload', outcome: 'requested' }).description)
      .toContain('5 秒')
  })

  it('carries the restart request, its 10s timeout and the manual fallback verbatim', () => {
    expect(enterpriseMaintenanceNotice({ kind: 'restart', outcome: 'requested' })).toEqual({
      title: '已请求重启应用',
      description: '已请求重启应用；若 10 秒内没有反应，请手动退出并重开客户端。',
      tone: 'progress',
    })
    // 官方 app.relaunch 的 spawn 失败只写 stderr、客户端 8 秒后静默退回：超时必须说出来。
    expect(enterpriseMaintenanceNotice({ kind: 'restart', outcome: 'timeout' })).toEqual({
      title: '仍未检测到重启',
      description: '请手动退出客户端并重新打开。',
      tone: 'warning',
    })
    expect(enterpriseMaintenanceNotice({ kind: 'restart', outcome: 'failed' })).toEqual({
      title: '重启请求未被接受',
      description: '请手动退出客户端并重新打开。',
      tone: 'warning',
    })
  })

  it('gives the reload path its own three states', () => {
    expect(enterpriseMaintenanceNotice({ kind: 'reload', outcome: 'requested' })).toEqual({
      title: '正在重新载入页面',
      description: '已请求重新载入页面；若 5 秒内没有反应，请手动重新载入页面或重开客户端。',
      tone: 'progress',
    })
    expect(enterpriseMaintenanceNotice({ kind: 'reload', outcome: 'timeout' }).tone).toBe('warning')
    expect(enterpriseMaintenanceNotice({ kind: 'reload', outcome: 'failed' }).title).toBe('重新载入未生效')
  })
})

/** 右侧控件是行点击之外的第二条入口：它必须自己掐断冒泡，否则一次点击会被结算两次。 */
describe('the update trailing control never fires the row it sits in', () => {
  const open = (trailing: EnterpriseUpdateTrailing) => EnterpriseUpdateTrailingControl({ onOpen: vi.fn(), trailing })

  it('stops propagation before it triggers the same official action', () => {
    const onOpen = vi.fn()
    const stopPropagation = vi.fn()
    const element = EnterpriseUpdateTrailingControl({
      onOpen,
      trailing: { action: 'open', actionLabel: '更新', disabled: false, state: '有可用更新 2.0.16' },
    })
    // 组合位持有两件事：状态标签 + 快捷按钮。
    expect(element.props.className).toBe('own-update-trailing')
    const [state, action] = element.props.children
    expect(state.props.className).toBe('own-update-state')
    expect(state.props.children).toBe('有可用更新 2.0.16')
    expect(action.props.className).toBe('own-update-action')
    expect(action.props.role).toBe('button')
    // 键盘焦点仍归官方行项：这颗按钮只是指针入口，不抢第二个 Tab 站。
    expect(action.props.tabIndex).toBe(-1)
    expect(action.props.children).toBe('更新')
    action.props.onClick({ stopPropagation })
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders a read-only state label while a phase is busy', () => {
    for (const trailing of [
      { action: 'none', disabled: true, state: '下载中 42%' },
      { action: 'none', disabled: true, state: '检查中…' },
    ] as const) {
      const element = open(trailing)
      expect(element.props.className).toBe('own-update-trailing')
      const [state, action] = element.props.children
      expect(state.props.className).toBe('own-update-state')
      expect(state.props.children).toBe(trailing.state)
      // 忙相位没有第二入口。
      expect(action).toBeNull()
    }
  })
})

/** 弹窗元素必须与开关状态同树；反馈不是二次确认，所以只有「关闭」这一条出路。 */
describe('the maintenance notice is rendered where its switch lives', () => {
  it('binds open and onClose to the same prop pair in maintenance-view source', async () => {
    const source = await readFile(new URL('../src/maintenance-view.tsx', import.meta.url), 'utf8')
    const index = source.indexOf('export function EnterpriseMaintenanceNotice')
    const element = source.slice(index, source.indexOf('</Modal>', index))
    expect(element).toContain('open={props.notice !== undefined}')
    expect(element).toContain('onClose={props.onClose}')
    // 官方原生重启自带模态确认，我们不许再加一道：这里只允许「关闭」。
    expect(element).toContain('<Button onClick={props.onClose} variant="outline">关闭</Button>')
    expect(element).not.toMatch(/确定|确认重启|立即重启/u)
  })

  it('triggers the official channel only after the visible feedback is armed', async () => {
    const source = await readFile(new URL('../src/maintenance-view.tsx', import.meta.url), 'utf8')
    const reload = source.slice(source.indexOf('const requestReload'), source.indexOf('const requestRestart'))
    const restart = source.slice(source.indexOf('const requestRestart'), source.indexOf('const close = useCallback'))
    expect(reload.indexOf("start('reload')")).toBeGreaterThan(-1)
    expect(reload.indexOf("start('reload')")).toBeLessThan(reload.indexOf('runEnterpriseReload'))
    expect(reload).toContain('globalThis.location.reload()')
    expect(restart.indexOf("start('restart')")).toBeLessThan(restart.indexOf('runEnterpriseRestart'))
    // 没有官方动作面时重启什么都不做（行项本来就不在列）。
    expect(restart).toContain('if (actions === undefined) return')
    expect(restart).toContain("setNotice(current => current === undefined ? current : { ...current, outcome: 'failed' })")
  })

  it('flips to the timeout wording on the kind-specific deadline', async () => {
    const source = await readFile(new URL('../src/maintenance-view.tsx', import.meta.url), 'utf8')
    expect(source).toContain('}, ENTERPRISE_MAINTENANCE_TIMEOUT_MS[kind])')
    expect(source).toContain("outcome === 'requested'")
    expect(source).toContain("? { ...current, outcome: 'timeout' }")
  })
})
