/**
 * [INPUT]: 依赖 shortcuts-view 的官方注册表只读源/行解码/分组投影/范围说明/键帽取值，以及假的宿主 Context 与官方目录快照仓
 * [OUTPUT]: 锁定「数据源只能是官方注册表」这条线：目录可读时逐行来自官方、不可读时只展示 launcher 的 settingsShortcut 并标注范围、注册表非空时不叠加第二套按键表，以及没有全局键盘监听、没有自造按键表
 * [POS]: dsh-ui 快捷键入口的契约回归；有人自己写一张按键表、装全局 keydown、或把降级数据说成完整注册表，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_SHORTCUT_GROUP_LABELS,
  ENTERPRISE_SHORTCUTS_EMPTY,
  createEnterpriseShortcutsSource,
  decodeEnterpriseShortcutEntry,
  enterpriseShortcutGroups,
  enterpriseShortcutKeys,
  enterpriseShortcutRows,
  enterpriseShortcutScopeNote,
} from '../src/shortcuts-view.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
}))

/** 官方 `createSnapshotStore` 的最小替身：getSnapshot 引用稳定，subscribe 可观察。 */
function fakeStore(initial: readonly unknown[]) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    listenerCount: () => listeners.size,
    set: (next: readonly unknown[]) => {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** 官方 `shortcuts` 服务的读取面：catalog（可编辑命令）+ fixedCatalog（固定操作）。 */
function fakeContext(service?: unknown) {
  const waits: string[][] = []
  const notifications: (() => void)[] = []
  let current = service
  return {
    context: {
      get: () => current,
      inject: (deps: readonly string[], callback: () => void) => {
        waits.push([...deps])
        notifications.push(callback)
        return callback
      },
    },
    waits,
    provide: (next: unknown) => { current = next },
    /** Loader 兑现 inject 时的那一次补发通知。 */
    fire: () => { for (const notify of notifications) notify() },
  }
}

const CATALOG = [
  { aliases: ['settings'], aria: 'Meta+Comma', binding: { code: 'Comma', modifiers: ['meta'] }, conflicts: [], id: 'settings.open', issue: null, keys: ['⌘', ','], label: '打开设置', modified: false },
  { aliases: [], aria: 'Meta+Slash', binding: { code: 'Slash', modifiers: ['meta'] }, conflicts: [], id: 'shortcuts.open', issue: null, keys: ['⌘', '/'], label: '快捷键速查', modified: false },
]
const FIXED = [
  { bindings: [{ code: 'ArrowUp', modifiers: [] }], group: 'menus', id: 'fixed.move', keys: ['↑', '↓'], label: '移动菜单选择' },
]

describe('the shortcut source reads the official registry and nothing else', () => {
  it('waits for the official service without hard-injecting it', () => {
    const fake = fakeContext()
    const source = createEnterpriseShortcutsSource(fake.context)
    expect(fake.waits).toEqual([['shortcuts']])
    // 服务缺席时是常量空快照：引用稳定，useSyncExternalStore 不会自激。
    expect(source.getSnapshot()).toBe(ENTERPRISE_SHORTCUTS_EMPTY)
    expect(source.getSnapshot()).toBe(source.getSnapshot())
    expect(() => { source.subscribe(() => undefined)() }).not.toThrow()
  })

  it('merges the two official catalogs into one stable snapshot and follows both stores', () => {
    const catalog = fakeStore(CATALOG)
    const fixed = fakeStore(FIXED)
    const fake = fakeContext({ catalog, fixedCatalog: fixed })
    const source = createEnterpriseShortcutsSource(fake.context)
    const first = source.getSnapshot()
    expect(first.catalog).toEqual(CATALOG)
    expect(first.fixed).toEqual(FIXED)
    // 数据没变时必须是同一引用。
    expect(source.getSnapshot()).toBe(first)
    const seen = vi.fn()
    const off = source.subscribe(seen)
    expect(catalog.listenerCount()).toBe(1)
    expect(fixed.listenerCount()).toBe(1)
    fixed.set([])
    expect(seen).toHaveBeenCalledTimes(1)
    expect(source.getSnapshot().fixed).toEqual([])
    off()
    expect(catalog.listenerCount()).toBe(0)
    expect(fixed.listenerCount()).toBe(0)
  })

  it('attaches to the catalogs that appear after the plugin loaded', () => {
    const fake = fakeContext()
    const source = createEnterpriseShortcutsSource(fake.context)
    const seen = vi.fn()
    source.subscribe(seen)
    expect(seen).not.toHaveBeenCalled()
    const catalog = fakeStore(CATALOG)
    // 服务晚到：inject 补发一次通知，随后必须把目录订阅补挂上，之后的变化才跟得住。
    fake.provide({ catalog, fixedCatalog: fakeStore(FIXED) })
    fake.fire()
    expect(seen).toHaveBeenCalledTimes(1)
    expect(source.getSnapshot().catalog).toEqual(CATALOG)
    catalog.set([])
    expect(seen).toHaveBeenCalledTimes(2)
  })
})

describe('official rows are decoded strictly', () => {
  it('drops anything that is not a complete official row', () => {
    expect(decodeEnterpriseShortcutEntry(CATALOG[0], 'application', 'registry')).toEqual({
      group: 'application',
      id: 'settings.open',
      keys: ['⌘', ','],
      label: '打开设置',
      scope: 'registry',
      aria: 'Meta+Comma',
    })
    for (const value of [null, 3, 'row', [], { id: 'a' }, { id: '', keys: [], label: 'x' }, { id: 'a', keys: [], label: '' }, { id: 'a', keys: ['x', 7], label: 'x' }, { id: 'a', keys: 'x', label: 'x' }]) {
      expect(decodeEnterpriseShortcutEntry(value, 'application', 'registry')).toBeUndefined()
    }
  })
})

describe('rows come from the official registry, with one launcher fallback', () => {
  const settingsShortcut = { keys: ['⌘', ','], aria: 'Meta+Comma' }

  it('uses the official catalogs when they are readable and ignores the launcher keycap', () => {
    const rows = enterpriseShortcutRows({ catalog: CATALOG, fixed: FIXED }, settingsShortcut)
    expect(rows.map(row => row.id)).toEqual(['settings.open', 'shortcuts.open', 'fixed.move'])
    // 可编辑命令照官方速查归入 application，固定操作保留官方 group。
    expect(rows.map(row => row.group)).toEqual(['application', 'application', 'menus'])
    expect(rows.every(row => row.scope === 'registry')).toBe(true)
    expect(enterpriseShortcutScopeNote(rows)).toBeUndefined()
  })

  it('falls back to the single settingsShortcut row when the whole registry is unreadable', () => {
    const rows = enterpriseShortcutRows(ENTERPRISE_SHORTCUTS_EMPTY, settingsShortcut)
    expect(rows).toEqual([{
      aria: 'Meta+Comma',
      group: 'launcher',
      id: 'settings.open',
      keys: ['⌘', ','],
      label: '设置',
      scope: 'launcher',
    }])
    expect(enterpriseShortcutScopeNote(rows)).toContain('没有可读的官方快捷键注册表')
    expect(enterpriseShortcutGroups(rows).map(group => group.label)).toEqual([ENTERPRISE_SHORTCUT_GROUP_LABELS['launcher']])
  })

  it('invents nothing when there is neither a registry nor a launcher keycap', () => {
    expect(enterpriseShortcutRows(ENTERPRISE_SHORTCUTS_EMPTY, undefined)).toEqual([])
    expect(enterpriseShortcutRows(ENTERPRISE_SHORTCUTS_EMPTY, { keys: [] })).toEqual([])
    expect(enterpriseShortcutRows({ catalog: [null, 7], fixed: [{ id: 'x' }] }, undefined)).toEqual([])
  })
})

describe('grouping and keycaps stay on the official vocabulary', () => {
  it('renders official groups in the official order and never labels an unknown group', () => {
    const rows = enterpriseShortcutRows({ catalog: CATALOG, fixed: [...FIXED, { group: 'weird', id: 'x.y', keys: ['F'], label: '未知分组' }] }, undefined)
    const groups = enterpriseShortcutGroups(rows)
    expect(groups.map(group => group.group)).toEqual(['application', 'menus', 'weird'])
    expect(groups.map(group => group.label)).toEqual(['应用操作', '菜单与弹层', 'weird'])
    // 分组标签只来自官方 zh 词表 + 我们自定的降级分组。
    expect(Object.keys(ENTERPRISE_SHORTCUT_GROUP_LABELS)).toEqual(['application', 'input', 'menus', 'approval', 'launcher'])
  })

  it('exposes a row keycap only when the official row carries one', () => {
    const rows = enterpriseShortcutRows({ catalog: CATALOG, fixed: FIXED }, undefined)
    expect(enterpriseShortcutKeys(rows, 'shortcuts.open')).toEqual({ keys: ['⌘', '/'], aria: 'Meta+Slash' })
    expect(enterpriseShortcutKeys(rows, 'nope.open')).toBeUndefined()
    // 官方说「暂无快捷键」的行不给键帽，界面自己显示官方那句 unbound 文案。
    expect(enterpriseShortcutKeys(enterpriseShortcutRows({ catalog: [{ id: 'a.b', keys: [], label: '无键位' }], fixed: [] }, undefined), 'a.b'))
      .toBeUndefined()
  })
})

/** 入口本身不绑按键：官方 `shortcuts.open` 已由官方注册，我们只读、只显示。 */
describe('the shortcuts view registers no keys and keeps no second table', () => {
  it('never installs a keyboard listener', async () => {
    const source = await readFile(new URL('../src/shortcuts-view.tsx', import.meta.url), 'utf8')
    // 全局快捷键捕获一律不许有：document/window 上不得挂 keydown。
    expect(source).not.toContain("document.addEventListener('keydown'")
    expect(source).not.toContain("window.addEventListener('keydown'")
    expect(source).not.toContain('onKeyDown=')
    // 弹窗根部那一条 Escape 隔离监听与本包其它弹窗同款，不是快捷键捕获。
    expect(source).toContain("root.addEventListener('keydown', onKeyDown)")
    // 自造按键表的形状：物理 code 字面量（KeyX / DigitN / F1）在任何一行都不许出现。
    expect(source).not.toMatch(/'(Key[A-Z]|Digit[0-9]|F[1-9]|1[0-9]|2[0-4])'/u)
    expect(source).not.toContain('modifiers:')
  })

  it('renders the dialog it opens with the open flag of its own controller', async () => {
    const source = await readFile(new URL('../src/shortcuts-view.tsx', import.meta.url), 'utf8')
    const index = source.indexOf('export function EnterpriseShortcutsDialog')
    const element = source.slice(index, source.indexOf('</Modal>', index))
    expect(element).toContain('open={props.open}')
    expect(element).toContain('onClose={props.onClose}')
    expect(element).toContain('enterpriseShortcutGroups(props.rows)')
    // 只读：没有录制、编辑或写入偏好这条路。
    expect(element).not.toContain('edit(')
    expect(element).not.toContain('recording(')
  })
})
