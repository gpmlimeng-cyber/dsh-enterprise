/**
 * [INPUT]: 依赖 library-entry 的入口身份与两处座位接线（`ENTERPRISE_LIBRARY_ENTRY_ID`/`_LABEL`/`_ORDER`、`EnterpriseLibraryIcon`、
 *          `enterpriseLibraryPanelOptions`/`enterpriseLibraryMainOptions`、`bindEnterpriseLibrarySeats`）、library-panel 的页面与取数源
 *          （`EnterpriseLibraryPanelView`/`createEnterpriseLibraryCatalogSource`/全部文案常量）、library-gate 的管理门，
 *          以及 marketplace-entry 的目录页外壳（组件页签里那一行「资料库」+ 它那枚 Switch）
 * [OUTPUT]: 锁定资料库两件 UI 的行为契约——① 座位身份（id=`library`、与 `main` 的 key **同名**、不复用已撤 id）；
 *          ② **视图驱动反向锁**（管理门关时两个槽上一个占用者都没有；开时两处一起注册；再关就真撤）；
 *          ③ 页面三态（加载提示 / 空说清为什么空 + 下一步 / 失败人话 + 下一步 + 稳定码）与**点重试真的重发**；
 *          ④ 未接入控件（上传 / 查找）禁用且原因写在页面上；⑤ 术语锁（员工可见文案不含 asset/revision/KV/per-record/前端 等技术词）；
 *          ⑥ 组件行那枚 Switch 反映本地设置、拨动即持久化、写失败可见且可重试
 * [POS]: 资料库这一刀的入口 + 页面 + 组件行接线的门禁。本仓 vitest 没有 DOM，故页面用**纯函数直调**取证、
 *        「重试真的重发」落在组件真正订阅的那个取数源上（组件只是订户 + 一枚按钮）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

// 三个视图都经官方 primitives 渲染（本仓未装 clsx），故照既有用例的同一份 mock 把它们换掉。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  Modal: vi.fn(),
}))

import { Button, Switch as SwitchPrimitive } from '@deepseek-ai/dsh-client-ui-primitives'
import { ENTERPRISE_ERROR_ACTION_PREFIX, ENTERPRISE_ERROR_TECH_ATTR } from '../src/error-notice.js'
import {
  bindEnterpriseLibrarySeats,
  ENTERPRISE_LIBRARY_ENTRY_ID,
  ENTERPRISE_LIBRARY_ENTRY_LABEL,
  ENTERPRISE_LIBRARY_ENTRY_ORDER,
  EnterpriseLibraryIcon,
  enterpriseLibraryMainOptions,
  enterpriseLibraryPanelOptions,
} from '../src/library-entry.js'
import { createEnterpriseLibraryGate, type EnterpriseLibraryGateStorage } from '../src/library-gate.js'
import {
  ENTERPRISE_LIBRARY_EMPTY,
  ENTERPRISE_LIBRARY_EMPTY_NEXT,
  ENTERPRISE_LIBRARY_FAILED_PREFIX,
  ENTERPRISE_LIBRARY_LOADING,
  ENTERPRISE_LIBRARY_NOT_WIRED,
  ENTERPRISE_LIBRARY_NOT_WIRED_ID,
  ENTERPRISE_LIBRARY_PAGE_LABEL,
  ENTERPRISE_LIBRARY_PAGE_NOTE,
  ENTERPRISE_LIBRARY_SEARCH_LABEL,
  ENTERPRISE_LIBRARY_UPLOAD,
  EnterpriseLibraryPanel,
  EnterpriseLibraryPanelView,
  createEnterpriseLibraryCatalogSource,
  type EnterpriseLibraryItem,
} from '../src/library-panel.js'
import { ENTERPRISE_LIST_RETRY } from '../src/list-state.js'
import { ENTERPRISE_MARKET_COMPONENTS, EnterpriseMarketLegacyShell } from '../src/marketplace-entry.js'

/** 收集元素树里的**可见文本**：跳过 `<style>` 与「技术信息」里那枚稳定码（它与弹层里同一份口径）。 */
function visibleText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(visibleText).join(' ')
  if (!isValidElement(node)) return ''
  const props = node.props as Record<string, unknown>
  if (node.type === 'style') return ''
  if (props[ENTERPRISE_ERROR_TECH_ATTR] !== undefined) return ''
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return visibleText(rendered as ReactNode)
  }
  return visibleText(props['children'] as ReactNode)
}

/** 收集「技术信息」里的稳定码（证明码没被吞掉）。 */
function technicalCodes(node: ReactNode, acc: string[] = []): string[] {
  if (Array.isArray(node)) { for (const child of node) technicalCodes(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const code = props[ENTERPRISE_ERROR_TECH_ATTR]
  if (typeof code === 'string') acc.push(code)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return technicalCodes(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') technicalCodes(value as ReactNode, acc)
  }
  return acc
}

/** 收集树上所有 `type === target` 的元素（保留顺序）。真函数组件先就地渲染再递归（mock 原语产出 undefined 时退回 props）。 */
function collectByType(node: ReactNode, target: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) { for (const child of node) collectByType(child, target, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === target) { acc.push(node.props as Record<string, unknown>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByType(rendered as ReactNode, target, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByType(value as ReactNode, target, acc)
  }
  return acc
}

/** 收集所有 Switch 的 props（`SwitchPrimitive` 就是本文件 mock 出来的那个引用，与源文件里同一份）。 */
function collectSwitchProps(node: ReactNode, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  return collectByType(node, SwitchPrimitive, acc)
}

/** 组件页签里那枚「资料库」开关的 props（找不到即用例失败）。 */
function librarySwitch(tree: ReactNode): Record<string, unknown> {
  const found = collectSwitchProps(tree).find(item => item['label'] === '启用资料库')
  expect(found, '找不到「启用资料库」那枚开关').toBeDefined()
  return found as Record<string, unknown>
}

/** 去掉注释：文档里提到 `onKeyDown`/`aria-current` 这类词不该被算成一处实现。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

/** 一次取数的完成（Promise 链多让几个宏任务过去即可稳定观察）。 */
async function settle(times = 6): Promise<void> {
  for (let index = 0; index < times; index += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

/** 一份可编排的假本机设置（写次数是「重试真的再写一次」的取证点）。 */
function fakeStorage(initial?: string) {
  let value = initial
  let writeFails = false
  const writes: string[] = []
  const storage: EnterpriseLibraryGateStorage = {
    read: () => value,
    write: (next: string) => {
      if (writeFails) throw new Error('本机设置不可用')
      writes.push(next)
      value = next
    },
  }
  return { storage, writes: (): readonly string[] => writes, failWrite: (on: boolean): void => { writeFails = on } }
}

/** 一处座位的假取证台：注册表 + inject 名单 + 每个座位交回的注销器。 */
function seatHarness() {
  const registrations: { slot: string; options: Record<string, unknown>; component: unknown }[] = []
  const injected: string[] = []
  const ports = {
    inject: (name: string, callback: () => unknown) => { injected.push(name); return callback() },
    register: (options: Readonly<Record<string, unknown>>, component: (props: never) => ReactNode) => {
      const record = { slot: String(options['name']), options: { ...options }, component }
      registrations.push(record)
      return () => {
        const at = registrations.indexOf(record)
        if (at >= 0) registrations.splice(at, 1)
      }
    },
  }
  return { ports, registrations, injected }
}

const SOURCE = createEnterpriseLibraryCatalogSource()

describe('资料库：侧栏一级入口与 main 面板（视图驱动注册/注销）', () => {
  it('两处座位用同一个 id：侧栏 id 与 main 的 key 同名，且不复用已撤的商店 id', () => {
    expect(ENTERPRISE_LIBRARY_ENTRY_ID).toBe('library')
    expect(ENTERPRISE_LIBRARY_ENTRY_LABEL).toBe('资料库')
    // 官方全局面板实测 plugins=0 / schedules=10，排在它们之后。
    expect(ENTERPRISE_LIBRARY_ENTRY_ORDER).toBe(20)

    const panel = enterpriseLibraryPanelOptions()
    const main = enterpriseLibraryMainOptions(SOURCE)
    // 官方 `sidebar.panellist` 的实物形状：metadata 走 options（name/id/order/label），**没有** title/icon 字段
    //（图标是 register 的第二个参数，见官方 plugin-manager / schedule 两处注册）。
    expect(Object.keys(panel).sort()).toEqual(['id', 'label', 'name', 'order'])
    expect(panel['name']).toBe('sidebar.panellist')
    expect(panel['id']).toBe(ENTERPRISE_LIBRARY_ENTRY_ID)
    expect(panel['label']).toBe('资料库')
    expect(panel['order']).toBe(20)
    expect(main['name']).toBe('main')
    expect(main['key']).toBe(ENTERPRISE_LIBRARY_ENTRY_ID)
    // **同名是结构性的**：两份都从同一个常量产出，官方「list id 指向同名 main 面板」的配对不可能漂移。
    expect(panel['id']).toBe(main['key'])
    // 不复用早前按用户要求撤掉的「应用商店」id。
    expect(panel['id']).not.toBe('enterprise-store')
    expect(main['key']).not.toBe('enterprise-store')
  })

  it('入口图标只吃官方 ownerProps（键盘、焦点环、当前项高亮都归官方侧栏那一行）', async () => {
    const icon = EnterpriseLibraryIcon({ size: 16, active: true }) as { props: Record<string, unknown> }
    expect(isValidElement(icon)).toBe(true)
    expect(icon.props['size']).toBe(16)
    // 官方把 glyph 放进一枚 aria-hidden 的 span，行按钮自己带 aria-label / aria-current / :focus-visible。
    // 取证（宿主 0.2.0-rc.2，`dsh-client-ui-sidebar/lib/client.js:127-152` 的 `PanelRow`）：
    //   `<button className=panelRow aria-label={label} aria-current={active ? 'page' : undefined} onClick=…>`
    //   + glyph 外层 `span.panelGlyph[aria-hidden=true]`；焦点环在它的 CSS module 里
    //   （`.panelRow:focus-visible{outline:var(--dsw-focus-ring-width) solid …}`），当前项底色是 `.panelActive`。
    // 因此「可聚焦 / 焦点环 / 当前项高亮」不需要我们再实现一遍——重复实现只会多出第二套焦点语义。
    expect(icon.props['aria-hidden']).toBe(true)
    // 源码级反向锁：入口层**不**自造第二枚按钮或键盘处理（否则就是第二套焦点语义）。
    const entry = stripComments(await readFile(new URL('../src/library-entry.tsx', import.meta.url), 'utf8'))
    for (const forbidden of ['onKeyDown', 'tabIndex', 'aria-current', 'addEventListener', '<button']) {
      expect(entry, forbidden).not.toContain(forbidden)
    }
  })

  it('管理门关着时两处座位上一个占用者都没有（反向锁）；开着时两处一起注册且 key 同名', () => {
    const fake = fakeStorage(undefined)
    const gate = createEnterpriseLibraryGate(fake.storage)
    const harness = seatHarness()
    const unbind = bindEnterpriseLibrarySeats(harness.ports, gate, SOURCE)

    // 两处座位都 inject（视图驱动必须先订阅到门），但**默认关** ⇒ 一格都不占。
    expect(harness.injected).toEqual(['sidebar.panellist', 'main'])
    expect(harness.registrations).toEqual([])

    // 拨开：**立刻生效**（同一个 tick 内两处座位已注册）。
    gate.setEnabled(true)
    expect(harness.registrations.map(item => item.slot)).toEqual(['sidebar.panellist', 'main'])
    const panel = harness.registrations[0]!.options
    const main = harness.registrations[1]!.options
    expect(panel['id']).toBe('library')
    expect(main['key']).toBe(panel['id'])
    expect(harness.registrations[1]!.component).toBe(EnterpriseLibraryPanel)
    expect(harness.registrations[0]!.component).toBe(EnterpriseLibraryIcon)
    // main 的 inject 面把**同一份**取数源交给页面宿主（不存在第二个数据源）。
    expect((main['inject'] as () => { source: unknown })().source).toBe(SOURCE)
    // 没有动作端口时那个键**根本不出现**（页面据此把三枚控件禁用并写明原因，而不是给死按钮）。
    expect((main['inject'] as () => Record<string, unknown>)()['api']).toBeUndefined()
    // 给了动作端口就原样交进去（同一份对象，不复制、不包装）。
    const api = {
      importText: async () => undefined,
      search: async () => [],
      readText: async () => ({ assetId: 'as_1', revisionId: 'rv_1', name: 'a.md', kind: 'markdown', content: '', byteLength: 0 }),
    }
    const injected = (enterpriseLibraryMainOptions(SOURCE, api)['inject'] as () => { source: unknown, api: unknown })()
    expect(injected.api).toBe(api)
    expect(injected.source).toBe(SOURCE)

    // 重复拨到开：不重复注册（避免无意义的重挂载）。
    gate.setEnabled(true)
    expect(harness.registrations).toHaveLength(2)

    // 关回去：**真的撤掉**（不是注册着再返回 null——官方槽只要有占用者就不走 fallback）。
    gate.setEnabled(false)
    expect(harness.registrations).toEqual([])

    // 座位生命周期结束（插件卸载 / 槽位声明消失）：先撤注册、再退订。
    gate.setEnabled(true)
    for (const dispose of unbind as readonly (() => void)[]) dispose()
    expect(harness.registrations).toEqual([])
    gate.setEnabled(false)
    expect(harness.registrations).toEqual([])
  })
})

describe('资料库页面：三态齐备、重试真重发、未接入处禁用并说明原因', () => {
  it('加载中：只给一句轻提示（不空白、不假装空）', () => {
    const tree = EnterpriseLibraryPanelView({ state: { kind: 'loading' } })
    expect(tree.props['data-enterprise-library-state']).toBe('loading')
    expect(visibleText(tree)).toContain(ENTERPRISE_LIBRARY_LOADING)
    expect(visibleText(tree)).not.toContain(ENTERPRISE_LIBRARY_EMPTY)
  })

  it('空态：说清「资料库还没有内容」+ 下一步（并给真的重发的刷新）', async () => {
    const load = vi.fn(() => Promise.resolve([] as readonly EnterpriseLibraryItem[]))
    const source = createEnterpriseLibraryCatalogSource(load)
    source.load()
    await settle()
    expect(source.getSnapshot().kind).toBe('empty')

    const onReload = vi.fn(() => { source.retry() })
    const tree = EnterpriseLibraryPanelView({ state: source.getSnapshot(), onReload })
    expect(tree.props['data-enterprise-library-state']).toBe('empty')
    const text = visibleText(tree)
    expect(text).toContain(ENTERPRISE_LIBRARY_EMPTY)
    expect(text).toContain('资料库还没有内容')
    expect(text).toContain(ENTERPRISE_LIBRARY_EMPTY_NEXT)
    expect(text).toContain('下一步：')

    // 点那枚刷新 → **真的重发一次取数**（数请求轮次，等价于点了一次按钮）。
    const retry = collectByType(tree, Button).find(props => props['children'] === ENTERPRISE_LIST_RETRY)
    expect(retry, '空态里应有那枚刷新按钮').toBeDefined()
    expect(typeof retry!['onClick']).toBe('function')
    ;(retry!['onClick'] as () => void)()
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(2)
    await settle()
    expect(source.getSnapshot().kind).toBe('empty')
  })

  it('失败态：人话 + 下一步 + 收进「技术信息」的稳定码（裸码不上屏），点重试真的再取一次', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('宿主还没接线'))
      .mockResolvedValue([{ id: 'doc-1', title: '员工手册' }] as readonly EnterpriseLibraryItem[])
    const source = createEnterpriseLibraryCatalogSource(load)
    source.load()
    await settle()
    expect(source.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_LIBRARY_UNAVAILABLE' })

    const tree = EnterpriseLibraryPanelView({ state: source.getSnapshot(), onReload: () => { source.retry() } })
    expect(tree.props['data-enterprise-library-state']).toBe('failed')
    const text = visibleText(tree)
    // 成功文案来自 error-messages.ts 的唯一映射（人话 + 下一步），不是本页自造。
    expect(text).toContain(`${ENTERPRISE_LIBRARY_FAILED_PREFIX}：资料库还在接入中，暂时打不开。`)
    expect(text).toContain(ENTERPRISE_ERROR_ACTION_PREFIX)
    expect(text).not.toContain('ENT_LIBRARY_UNAVAILABLE')
    expect(technicalCodes(tree)).toContain('ENT_LIBRARY_UNAVAILABLE')

    // 点重试 → 真的重发；这次成功 → 就绪态把那一条列出来。
    const retry = collectByType(tree, Button).find(props => props['children'] === ENTERPRISE_LIST_RETRY)
    ;(retry!['onClick'] as () => void)()
    expect(load).toHaveBeenCalledTimes(2)
    await settle()
    const ready = EnterpriseLibraryPanelView({ state: source.getSnapshot() })
    expect(ready.props['data-enterprise-library-state']).toBe('ready')
    expect(visibleText(ready)).toContain('员工手册')
    expect(collectByType(ready, 'li').length).toBeGreaterThan(0)
  })

  it('未接入的两枚控件一律禁用，且原因**写在页面上**并用 aria-describedby 指过去', () => {
    const tree = EnterpriseLibraryPanelView({ state: { kind: 'loading' } })
    const upload = collectByType(tree, Button).find(props => props['children'] === ENTERPRISE_LIBRARY_UPLOAD)
    expect(upload, '上传控件应在页面上（未接入时禁用）').toBeDefined()
    expect(upload!['disabled']).toBe(true)
    expect(upload!['aria-describedby']).toBe(ENTERPRISE_LIBRARY_NOT_WIRED_ID)

    const search = collectByType(tree, 'input').find(props => props['aria-label'] === ENTERPRISE_LIBRARY_SEARCH_LABEL)
    expect(search, '查找框应在页面上（未接入时禁用）').toBeDefined()
    expect(search!['disabled']).toBe(true)
    expect(search!['aria-label']).toBe(ENTERPRISE_LIBRARY_SEARCH_LABEL)
    expect(search!['aria-describedby']).toBe(ENTERPRISE_LIBRARY_NOT_WIRED_ID)

    // 原因是可见文案（不是只挂在 title 里的隐形说明），且那句文案的节点 id 就是 describe 的落点。
    expect(visibleText(tree)).toContain(ENTERPRISE_LIBRARY_NOT_WIRED)
    const note = collectByType(tree, 'span').find(props => props['id'] === ENTERPRISE_LIBRARY_NOT_WIRED_ID)
    expect(note, '原因节点必须真的在树上（aria-describedby 的落点）').toBeDefined()
    expect(note!['children']).toBe(ENTERPRISE_LIBRARY_NOT_WIRED)
  })

  it('页面自己不发明宿主路由：数据只从注入的端口进来（拿不到就照实说接入中）', async () => {
    const panel = stripComments(await readFile(new URL('../src/library-panel.tsx', import.meta.url), 'utf8'))
    expect(panel).not.toContain('fetch(')
    expect(panel).not.toContain('local/library')
    // 三态与重试走唯一状态机、失败走唯一提示组件（不自己写第二套）。
    expect(panel).toContain('createEnterpriseListSource')
    expect(panel).toContain('EnterpriseErrorNotice')
    // 端口缺席时如实抛「接入中」，绝不回落成空列表（那会谎称「公司没给你资料」）。
    expect(panel).toContain("new EnterpriseLocalApiError('ENT_LIBRARY_UNAVAILABLE')")
    const source = createEnterpriseLibraryCatalogSource()
    source.load()
    await settle()
    expect(source.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_LIBRARY_UNAVAILABLE' })
  })

  it('员工可见文案里不出现 asset / revision / KV / per-record / 前端 等技术词', () => {
    const states = [
      EnterpriseLibraryPanelView({ state: { kind: 'loading' } }),
      EnterpriseLibraryPanelView({ state: { kind: 'empty', value: [] } }),
      EnterpriseLibraryPanelView({ state: { kind: 'failed', code: 'ENT_LIBRARY_UNAVAILABLE' } }),
      EnterpriseLibraryPanelView({ state: { kind: 'ready', value: [{ id: 'a', title: '员工手册' }] } }),
      // 组件页签里那一行（名称 + 一句说明 + 状态词 + 开关无障碍名）。
      EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'components' }),
    ]
    const surfaces: readonly [string, string][] = [
      ['入口文案', `${ENTERPRISE_LIBRARY_ENTRY_LABEL} ${ENTERPRISE_LIBRARY_PAGE_LABEL} ${ENTERPRISE_LIBRARY_PAGE_NOTE}`],
      ...states.map((tree, index) => [`界面 ${index}`, visibleText(tree)] as [string, string]),
    ]
    // 用户点名的技术词 + 产品宪法反目标技术词（与 employee-copy.spec.ts 同一份口径）。
    const banned = ['asset', 'revision', 'per-record', 'KV', '前端', 'manifest', 'YAML', 'Cordis', 'bundle patch', 'MCP', '环境变量', 'API Key', '分配', '退休', '审计', '权限码', '组件']
    for (const [where, text] of surfaces) {
      for (const word of banned) expect(text, `${where} / ${word}`).not.toContain(word)
    }
    // 资料库那一行自己的三句文案也逐句过一遍（它们最容易把内部词带上来）。
    const library = ENTERPRISE_MARKET_COMPONENTS.find(row => row.id === 'library')!
    expect(library.label).toBe('资料库')
    for (const word of banned) expect(library.note, `行说明 / ${word}`).not.toContain(word)
  })
})

describe('组件行「资料库」的管理开关（本机设置）：反映本地设置、拨动即持久化、失败可见可重试', () => {
  it('默认关：Switch 反映本地设置（未开启 / 未拨），拨开立刻持久化', () => {
    const fake = fakeStorage(undefined)
    const gate = createEnterpriseLibraryGate(fake.storage)
    const render = (): ReactNode => EnterpriseMarketLegacyShell({
      view: 'page',
      activeTab: 'components',
      libraryGate: gate.getSnapshot(),
      onToggleLibrary: next => { gate.setEnabled(next) },
      onRetryLibrarySave: () => { gate.retry() },
    })

    const before = render()
    expect(visibleText(before)).toContain('未开启')
    const initial = librarySwitch(before)
    expect(initial['checked']).toBe(false)
    expect(initial['disabled']).toBe(false)
    expect(initial['title']).toBe('打开后左侧会出现「资料库」入口')

    // 拨动 → 本机设置真的收到 on（持久化），界面随之变成「可用」。
    ;(initial['onChange'] as (next: boolean) => void)(true)
    expect(fake.writes()).toEqual(['on'])
    const after = render()
    expect(librarySwitch(after)['checked']).toBe(true)
    expect(visibleText(after)).toContain('可用')
    expect(librarySwitch(after)['title']).toBe('资料库入口已打开，可在左侧进入')
  })

  it('写失败：失败摆在那一行上（人话 + 下一步 + 稳定码）并可重试；失败**不**禁用开关', () => {
    const fake = fakeStorage('on')
    const gate = createEnterpriseLibraryGate(fake.storage)
    const render = (): ReactNode => EnterpriseMarketLegacyShell({
      view: 'page',
      activeTab: 'components',
      libraryGate: gate.getSnapshot(),
      onToggleLibrary: next => { gate.setEnabled(next) },
      onRetryLibrarySave: () => { gate.retry() },
    })

    fake.failWrite(true)
    gate.setEnabled(false)
    expect(gate.getSnapshot().errorCode).toBe('ENT_LIBRARY_SETTING_SAVE_FAILED')

    const failed = render()
    const text = visibleText(failed)
    expect(text).toContain('资料库开关没有保存到本机。') // 人话取自唯一映射
    expect(text).toContain(ENTERPRISE_ERROR_ACTION_PREFIX)
    expect(text).not.toContain('ENT_LIBRARY_SETTING_SAVE_FAILED') // 裸码不上屏
    expect(technicalCodes(failed)).toContain('ENT_LIBRARY_SETTING_SAVE_FAILED')
    // 失败后开关仍可拨（再拨一次就是重试）。
    expect(librarySwitch(failed)['disabled']).toBe(false)

    // 点那枚重试 → **真的再写一次**，成功后提示消失。
    const retry = collectByType(failed, Button).find(props => props['children'] === ENTERPRISE_LIST_RETRY)
    expect(retry, '失败行上应有那枚重试按钮').toBeDefined()
    fake.failWrite(false)
    ;(retry!['onClick'] as () => void)()
    expect(fake.writes()).toEqual(['off'])
    expect(gate.getSnapshot().errorCode).toBeUndefined()
    expect(visibleText(render())).not.toContain('资料库开关没有保存到本机。')
  })

  it('没有写入口时那枚开关禁用（不给死开关）', () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'components' })
    expect(librarySwitch(tree)['disabled']).toBe(true)
    expect(visibleText(tree)).toContain('未开启')
  })
})
