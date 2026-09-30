/**
 * [INPUT]: 依赖 shortcuts-open 的 reach-in 打开器/入口形状判定/探针/版本摘要，以及 account-menu 与 client 的源码
 * [OUTPUT]: 锁定产品裁决 B 的验收面：`shell.overlay` 上 id=shortcuts 的入口存在 → 调私有 store 的 `create().actions.open()` 且探针确认对话框出现；入口缺失、store 形状变化、调用抛错、限时未出现 → 走降级且**不抛错**，恰好记一次含版本摘要的 warn；并锁定「先关菜单、下一 tick 才开」「失败调 openSettings()」「保留自渲染一览」三条源码级不变量
 * [POS]: dsh-ui「快捷键」reach-in 的契约回归（unsupported workaround）；有人把可选链去掉、把失败静默、或把版本号当拒绝执行的条件，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_SHORTCUTS_GUIDE,
  ENTERPRISE_SHORTCUTS_OVERLAY_ID,
  createEnterpriseShortcutsReachIn,
  enterpriseShortcutDialogCount,
  enterpriseShortcutsOverlayEntry,
  enterpriseShortcutsVersionText,
} from '../src/shortcuts-open.js'

/** 官方 ui-shortcuts 的注册形状：`{options:{id:'shortcuts'}, store:{create: () => instance}}`。 */
function officialEntry(open: () => void): unknown {
  return { options: { id: 'shortcuts' }, store: { create: () => ({ actions: { open } }) } }
}

/**
 * 探针 double：计数从 0 起，`appear()` 由测试在「官方 open 被调用」时手动加一——
 * 这正是运行时 `[role="dialog"]` 数量会变的情形。
 */
function probe() {
  let count = 0
  return {
    appear: () => { count += 1 },
    port: { dialogCount: () => count },
  }
}

const noWait = async (): Promise<void> => undefined

describe('the official shortcuts dialog reach-in follows the product ruling', () => {
  it('finds the overlay entry by id and rejects every other shape', () => {
    expect(enterpriseShortcutsOverlayEntry([{ options: { id: 'other' } }, officialEntry(() => undefined)]))
      .toBeDefined()
    expect(enterpriseShortcutsOverlayEntry([])).toBeUndefined()
    expect(enterpriseShortcutsOverlayEntry([null, 'x', 7])).toBeUndefined()
    expect(enterpriseShortcutsOverlayEntry([{ options: { id: 'shortcuts' } }])).toBeDefined()
    expect(enterpriseShortcutsOverlayEntry([{ options: null }, { notOptions: true }])).toBeUndefined()
    expect(ENTERPRISE_SHORTCUTS_OVERLAY_ID).toBe('shortcuts')
  })

  it('calls store.create().actions.open() and confirms the dialog appeared', async () => {
    const fake = probe()
    const open = vi.fn(() => { fake.appear() })
    const reachIn = createEnterpriseShortcutsReachIn({
      probe: fake.port,
      slots: { entries: () => [officialEntry(open)] },
      version: () => 'version=0.1.7-rc.2 protocolVersion=1',
      wait: noWait,
      warn: vi.fn(),
    })
    await expect(reachIn.open()).resolves.toEqual({ outcome: 'opened' })
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('degrades without throwing when the entry is missing or the store shape changed', async () => {
    for (const entries of [
      [],
      [{ options: { id: 'shortcuts' } }],
      [{ options: { id: 'shortcuts' }, store: {} }],
      [{ options: { id: 'shortcuts' }, store: { create: () => ({}) } }],
      [{ options: { id: 'shortcuts' }, store: { create: () => ({ actions: {} }) } }],
      [{ options: { id: 'shortcuts' }, store: { create: () => null } }],
    ] as const) {
      const warn = vi.fn()
      const reachIn = createEnterpriseShortcutsReachIn({
        probe: probe().port,
        slots: { entries: () => entries as readonly unknown[] },
        version: () => 'version=unknown protocolVersion=unknown',
        wait: noWait,
        warn,
      })
      const result = await reachIn.open()
      expect(result.outcome).toBe('unavailable')
      expect(result.step).toBe('entry-shape-unavailable')
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('step=entry-shape-unavailable')
      expect(warn.mock.calls[0]?.[0]).toContain('operation=openShortcuts')
    }
  })

  it('never lets an official throw escape and still leaves exactly one warn', async () => {
    const warn = vi.fn()
    const reachIn = createEnterpriseShortcutsReachIn({
      probe: probe().port,
      slots: { entries: () => [{ options: { id: 'shortcuts' }, store: { create: () => { throw new Error('boom') } } }] },
      version: () => 'version=0.1.7-rc.2 protocolVersion=1',
      wait: noWait,
      warn,
    })
    await expect(reachIn.open()).resolves.toEqual({ outcome: 'unavailable', step: 'invoke-threw' })
    expect(warn).toHaveBeenCalledTimes(1)
    // 版本摘要进 warn：升级后靠这一行定位失效原因。
    expect(warn.mock.calls[0]?.[0]).toContain('version=0.1.7-rc.2')
    expect(warn.mock.calls[0]?.[0]).toContain('protocolVersion=1')
  })

  it('treats a dialog that never shows up as unavailable (bounded probe, no infinite loop)', async () => {
    const warn = vi.fn()
    const open = vi.fn()
    const reachIn = createEnterpriseShortcutsReachIn({
      intervalMs: 1,
      probe: probe().port,
      probeMs: 3,
      slots: { entries: () => [officialEntry(open)] },
      version: () => 'version=unknown protocolVersion=unknown',
      wait: noWait,
      warn,
    })
    await expect(reachIn.open()).resolves.toEqual({ outcome: 'unavailable', step: 'dialog-not-observed' })
    expect(open).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('counts dialogs by the official modal selector and summarises the service version defensively', () => {
    const seen: string[] = []
    const document = { querySelectorAll: (selector: string) => { seen.push(selector); return { length: 2 } } }
    expect(enterpriseShortcutDialogCount(document)).toBe(2)
    expect(seen).toEqual(['[role="dialog"]'])
    expect(enterpriseShortcutsVersionText({ catalog: {}, fixedCatalog: {}, protocolVersion: 1, version: '0.2.0' }))
      .toBe('version=0.2.0 protocolVersion=1 catalog=present fixedCatalog=present')
    expect(enterpriseShortcutsVersionText(undefined)).toBe('service=absent')
    expect(enterpriseShortcutsVersionText({})).toContain('version=unknown')
  })
})

describe('the menu degrades visibly instead of silently', () => {
  it('keeps the guide wording and the self-rendered catalog list as the fallback', async () => {
    expect(ENTERPRISE_SHORTCUTS_GUIDE).toContain('设置 → 通用 → 编辑快捷键')
    const view = await readFile(new URL('../src/shortcuts-view.tsx', import.meta.url), 'utf8')
    // 降级不是「只给一句话」：notice 之外的官方一览照旧渲染。
    expect(view).toContain('props.notice')
    expect(view).toContain('onOpenSettings')
    expect(view).toContain('enterpriseShortcutGroups(props.rows)')
    // 决不采用 DOM 合成按键与全局键盘监听（弹窗内隔离外层 Settings 的 Escape 是既有实现，不是全局监听）。
    expect(view).not.toMatch(/(document|window)\.addEventListener/u)
    expect(view).not.toContain('dispatchEvent')
    const open = await readFile(new URL('../src/shortcuts-open.ts', import.meta.url), 'utf8')
    expect(open).not.toMatch(/dispatchEvent|KeyboardEvent|document\.addEventListener|window\.addEventListener/)
    expect(open).toContain('unsupported workaround')
  })

  it('marks the workaround in code and keeps the version out of the go/no-go decision', async () => {
    const source = await readFile(new URL('../src/shortcuts-open.ts', import.meta.url), 'utf8')
    expect(source).toContain('unsupported workaround — 依赖官方 slot 内部 store，官方升级可能失效')
    // 版本只进 warn：没有任何按版本号早退的分支。
    expect(source).not.toMatch(/if\s*\([^)]*version[^)]*\)\s*return\s*'unavailable'/u)
  })

  it('wires the reach-in through the client so the launcher座位 always gets an opener', async () => {
    const client = await readFile(new URL('../src/client.tsx', import.meta.url), 'utf8')
    expect(client).toContain('createEnterpriseShortcutsReachIn')
    expect(client).toContain('shortcutsOpener')
    expect(client).toContain('slots.entries')
  })
})
