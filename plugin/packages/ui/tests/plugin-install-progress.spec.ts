/**
 * [INPUT]: 依赖 `plugin-install-progress.ts` 的真进度/落地交代唯一投影、`account-store.ts` 的「安装中」轮询、
 *          `marketplace-entry.tsx` 的共享行子块（插件行落点）、`plugin-market.tsx` 的卡片/详情落点（两个纯组件）、
 *          `plugin-install-gate.ts` 的在途清单与 `local-api` 的错误类；无 DOM（与 marketplace-entry.spec 同一套树工具）
 * [OUTPUT]: 锁六件事——① **真进度只能来自真状态**：`enterprisePluginProgress` 只在「本机真的在走工序」或
 *          「本客户端真的发出过动作」时产出，安静行一律 `undefined`；② **绝不假装进度**：产物里没有百分比、
 *          渲染出来的 `role="progressbar"` 没有 `aria-valuenow`（不确定态），那条动画只动 `transform`、不动 `width`
 *          （源码级反向锁：谁把它改成会填满的条就先红）；③ **阶段推进与三态收束**：`DOWNLOADING → VERIFIED → INSTALLING`
 *          阶段文字真的换，收束到 done（ACTIVE）/ 需重启（RESTART_REQUIRED）/ 失败（FAILED，交给唯一提示组件 + 可重试）；
 *          ④ **不给假取消**：上游没有可达的取消面（本仓受管安装走 `dsh plugin` 子进程，不经官方 pluginManager），
 *          故只有一句「不能取消」的可见交代、没有任何取消按钮；⑤ **无障碍与 reduced-motion**：`role="progressbar"`
 *          + `aria-live="polite"` + `aria-valuetext`（阶段文字），`@media (prefers-reduced-motion:reduce)` 关掉动效后
 *          **阶段文字仍是独立文本节点**；进度刻意不占 `role="status"|"alert"`，故既有「禁用即须有可见说明」那条
 *          反向锁的计数不受影响；⑥ **接线是真的**：store 在动作在途时轮询的是我们自己那条**只读** `GET /plugins`
 *          （真源：`plugin-distribution` 每走一步都写真实受管态），读不到只把稳定码摆出来（不静默、不误判成安装失败），
 *          装完自停，页面刷新撞上在途安装时自动接上。
 * [POS]: 「企业插件安装的动态过程效果」这一刀的机械门禁：把「真进度而不是假动画」从口号变成可执行断言
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { EnterpriseAccountStore } from '../src/account-store.js'
import type { EnterpriseLocalApi, EnterprisePluginStatus, EnterpriseLocalStatus, ManagedPluginState } from '../src/local-api.js'
import { EnterpriseLocalApiError } from '../src/local-api.js'
import { ENTERPRISE_PLUGIN_IN_FLIGHT_STATES } from '../src/plugin-install-gate.js'
import {
  ENTERPRISE_PLUGIN_PROGRESS_CANCEL_NOTICE,
  ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS,
  ENTERPRISE_PLUGIN_PROGRESS_PENDING_INSTALL,
  ENTERPRISE_PLUGIN_PROGRESS_PENDING_REMOVE,
  ENTERPRISE_PLUGIN_PROGRESS_POLL_MS,
  ENTERPRISE_PLUGIN_PROGRESS_READ_FAILED,
  ENTERPRISE_PLUGIN_PROGRESS_STATES,
  ENTERPRISE_PLUGIN_SETTLED_INSTALLED,
  ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART,
  ENTERPRISE_PLUGIN_SETTLED_REMOVED,
  enterprisePluginProgress,
  enterprisePluginSettledNotice,
} from '../src/plugin-install-progress.js'
import {
  EnterpriseMarketLegacyShell,
  EnterprisePluginProgressNotes,
  EnterprisePluginSettledNote,
  enterpriseMarketPluginRowFacts,
  type EnterpriseMarketPluginRow,
  type EnterpriseMarketShellProps,
} from '../src/marketplace-entry.js'
import {
  EnterprisePluginCardProgressNotes,
  EnterprisePluginCardSettledNote,
} from '../src/plugin-market.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
}))

afterEach(() => { vi.unstubAllGlobals() })

/* ───────────────────────── 无 DOM 的树工具（与同包其他 spec 同一口径） ───────────────────────── */

/** 函数组件透明展开 + 递归 props；mock 原语产出 undefined 时退回它的 children。 */
function walkTree(node: ReactNode, visit: (element: ReactElement<Record<string, unknown>>) => void): void {
  if (Array.isArray(node)) { for (const child of node) walkTree(child, visit); return }
  if (!isValidElement(node)) return
  const element = node as ReactElement<Record<string, unknown>>
  visit(element)
  const props = element.props
  if (typeof element.type === 'function') {
    const rendered = (element.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) { walkTree(rendered as ReactNode, visit); return }
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') walkTree(value as ReactNode, visit)
  }
}

/** 员工看得见的文本（跳过 `<style>` 与承载稳定码的节点，与既有反向锁同一口径）。 */
function textWithin(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textWithin).join(' ')
  if (!isValidElement(node)) return ''
  const props = node.props as Record<string, unknown>
  if (node.type === 'style') return ''
  if (props['data-enterprise-error-code'] !== undefined) return ''
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return textWithin(rendered as ReactNode)
  }
  return textWithin(props['children'] as ReactNode)
}

/** 带着某个 `data-*` 钩子的全部元素 props（进度/交代/行都靠它取证）。 */
function collectByAttr(node: ReactNode, attr: string, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) { for (const child of node) collectByAttr(child, attr, acc); return acc }
  if (!isValidElement(node)) return acc
  const element = node as ReactElement<Record<string, unknown>>
  const props = element.props
  if (props[attr] !== undefined) acc.push(props)
  if (typeof element.type === 'function') {
    const rendered = (element.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) { collectByAttr(rendered as ReactNode, attr, acc); return acc }
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByAttr(value as ReactNode, attr, acc)
  }
  return acc
}

/** 子树里全部 `role="status"|"alert"` 元素的可见文本（与 plugin-install-gate.spec 同一判据）。 */
function noticesWithin(node: ReactNode): readonly string[] {
  const acc: string[] = []
  walkTree(node, element => {
    const role = element.props['role']
    if (role !== 'status' && role !== 'alert') return
    acc.push(textWithin(element.props['children'] as ReactNode))
  })
  return acc
}

/** 插件行那一枚 `<li>` 的子树。 */
function pluginRow(tree: ReactNode, name: string): ReactNode {
  let found: ReactNode
  walkTree(tree, element => {
    if (element.props['data-enterprise-plugin-package'] === name) found = element.props['children'] as ReactNode
  })
  return found
}

/** 一行插件（目录版 + 本机态）的构造器。 */
function row(overrides: Partial<EnterpriseMarketPluginRow> = {}): EnterpriseMarketPluginRow {
  return { packageName: 'ent-a', version: '1.2.0', state: 'EXPECTED', inCatalog: true, ...overrides }
}

/** 目录页外壳的 props（插件页签 + 写入口在场）。 */
function shellProps(plugin: EnterpriseMarketPluginRow | readonly EnterpriseMarketPluginRow[], extra: Partial<EnterpriseMarketShellProps> = {}): EnterpriseMarketShellProps {
  return {
    view: 'page',
    activeTab: 'plugins',
    sessionUsable: true,
    enterprisePlugins: Array.isArray(plugin) ? plugin : [plugin] as never,
    onTogglePlugin: vi.fn(),
    ...extra,
  }
}

/** 整份 `<style>` 文本（两套外壳共用那份 `baseStyles` + `rowStyles`）。 */
function collectStyleText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(collectStyleText).join('')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return String((node.props as Record<string, unknown>)['children'] ?? '')
  const children = (node.props as Record<string, unknown>)['children']
  if (children === null || children === undefined || typeof children !== 'object') return ''
  return collectStyleText(children as ReactNode)
}

/** 剥掉块注释后的源码：源码级不变量只看**代码**（文档里引用 `aria-valuenow` 这类反例不该被算成用法）。 */
function stripBlocks(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

/* ───────────────────────── 「安装中」这一行的现场事实 ───────────────────────── */

describe('真进度只能来自真状态（纯投影）', () => {
  const ask = (overrides: Partial<Parameters<typeof enterprisePluginProgress>[0]> = {}) => enterprisePluginProgress({
    packageName: 'ent-a', state: 'EXPECTED', stageText: '未安装', ...overrides,
  })

  it('says nothing about a quiet row, and never borrows another row\'s action', () => {
    // 没有在途受管态、也没有本客户端发出的动作 ⇒ 整段不产出（安静行不挂装饰）。
    expect(ask()).toBeUndefined()
    // 本客户端在动的是**别的包**：这一行照样安静（多行各自独立）。
    expect(ask({ busy: { action: 'install', packageName: 'ent-b' } })).toBeUndefined()
    // 已经收束的态（已装 / 等重启 / 未装）一律不算「安装中」——否则页面一刷新就永久挂着一条进度。
    for (const settled of ['EXPECTED', 'ACTIVE', 'RESTART_REQUIRED'] as const) {
      expect(ask({ state: settled }), settled).toBeUndefined()
    }
  })

  it('reports the real Host stage (not an estimate) whenever the machine is really mid-operation', () => {
    for (const stage of ['ROLLBACK', 'DOWNLOAD_PENDING', 'DOWNLOADING', 'VERIFIED', 'INSTALLING', 'REMOVE_PENDING', 'REMOVING'] as const) {
      const progress = ask({ state: stage, stageText: `阶段-${stage}` })
      expect(progress?.phase, stage).toBe('working')
      expect(progress?.stageText, stage).toBe(`阶段-${stage}`)
      expect(progress?.state, stage).toBe(stage)
      expect(progress?.owned, stage).toBe(false)
    }
  })

  it('says "request submitted" instead of inventing a stage the Host has not reported yet', () => {
    const install = ask({ busy: { action: 'install', packageName: 'ent-a' } })
    expect(install?.phase).toBe('pending')
    expect(install?.stageText).toBe(ENTERPRISE_PLUGIN_PROGRESS_PENDING_INSTALL)
    expect(install?.owned).toBe(true)
    const remove = ask({ busy: { action: 'remove', packageName: 'ent-a' } })
    expect(remove?.stageText).toBe(ENTERPRISE_PLUGIN_PROGRESS_PENDING_REMOVE)
    // 方向也能由真状态单独判出来（页面刷新撞上别人的卸载时）：这是真事实，不是猜的。
    expect(ask({ state: 'REMOVING', stageText: '正在卸载' })?.stageText).toBe('正在卸载')
  })

  it('leaves failure to the failure notice instead of stacking a contradictory "in progress"', () => {
    expect(ask({ state: 'FAILED', busy: { action: 'install', packageName: 'ent-a' } })).toBeUndefined()
  })

  it('carries the two hard truths: never determinate, never cancellable', () => {
    const progress = ask({ state: 'DOWNLOADING', stageText: '正在下载' })
    expect(progress?.indeterminate).toBe(true)
    expect(progress?.cancelable).toBe(false)
    expect(progress?.cancelNotice).toBe(ENTERPRISE_PLUGIN_PROGRESS_CANCEL_NOTICE)
    // 那一路读不到时多一句**可见**交代（不是静默）。
    expect(progress?.readFailedNotice).toBeUndefined()
    expect(ask({ state: 'DOWNLOADING', stageText: '正在下载', readErrorCode: 'ENT_LOCAL_UNAVAILABLE' })?.readFailedNotice)
      .toBe(ENTERPRISE_PLUGIN_PROGRESS_READ_FAILED)
  })

  it('keeps the progress list a strict superset of the switch-lock list, and excludes every settled state', () => {
    for (const state of ENTERPRISE_PLUGIN_IN_FLIGHT_STATES) {
      expect(ENTERPRISE_PLUGIN_PROGRESS_STATES, state).toContain(state)
    }
    for (const settled of ['EXPECTED', 'ACTIVE', 'RESTART_REQUIRED', 'FAILED'] as const) {
      expect(ENTERPRISE_PLUGIN_PROGRESS_STATES, settled).not.toContain(settled)
    }
  })

  it('is honestly indeterminate: no percentage anywhere in the projection or its render sites', async () => {
    const leaf = await readFile(new URL('../src/plugin-install-progress.ts', import.meta.url), 'utf8')
    const market = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    const tab = await readFile(new URL('../src/plugin-market.tsx', import.meta.url), 'utf8')
    // ① 投影产物的键集**封闭**：没有 percent / ratio / value 这类「完成度」字段可塞。
    const progress = enterprisePluginProgress({ packageName: 'ent-a', state: 'DOWNLOADING', stageText: '正在下载' })!
    expect(Object.keys(progress).sort()).toEqual([
      'cancelNotice', 'cancelable', 'indeterminate', 'owned', 'phase', 'stageText', 'state',
    ])
    expect(typeof (progress as unknown as Record<string, unknown>)['indeterminate']).toBe('boolean')
    // ② 这条链的**代码**（剥掉注释）里没有百分比；也没有任何 aria-valuenow/min/max 的用法
    //    （没有 aria-valuenow 的 progressbar，按 ARIA 口径就是「不知道还剩多少」的不确定态）。
    const code = (source: string): string => stripBlocks(source).replace(/\/\/[^\n]*/g, '')
    expect(code(leaf).match(/\d+\s*%/)).toBeNull()
    for (const [name, source] of [['leaf', leaf], ['market', market], ['tab', tab]] as const) {
      expect(stripBlocks(source).match(/aria-valuenow|aria-valuemin|aria-valuemax/), name).toBeNull()
    }
    // ③ 屏幕上那句阶段文字里也从来没有百分号（员工看不到「假装进度」的数字）。
    const line = pluginRow(EnterpriseMarketLegacyShell(shellProps(row({ state: 'DOWNLOADING' }))), 'ent-a')
    expect(textWithin(line)).toContain('正在下载')
    expect(collectByAttr(line, 'data-enterprise-plugin-progress')).toHaveLength(1)
    expect(textWithin(collectByAttr(line, 'data-enterprise-plugin-progress')[0]?.['children'] as ReactNode)).not.toContain('%')
    // ④ 那条装饰动画只动 transform（不确定态流光），**不**动 width——
    //    谁把它改成会从左走到右填满的进度条，这里先红。
    const keyframes = /@keyframes own-market-progress-flow\{([^}]*\}[^}]*)\}/.exec(collectStyleText(
      EnterpriseMarketLegacyShell(shellProps(row({ state: 'DOWNLOADING' }))),
    ))?.[1]
    expect(keyframes).toBeDefined()
    expect(keyframes).toContain('transform:translateX')
    expect(keyframes).not.toContain('width')
    // ⑤ 上面那条只动 transform 的动画在「减少动态效果」下真的被关掉。
    const css = collectStyleText(EnterpriseMarketLegacyShell(shellProps(row({ state: 'DOWNLOADING' }))))
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(/@media \(prefers-reduced-motion: reduce\)\{[^}]*\.own-market-progressFlow::after\{[^}]*animation:none/.test(css)).toBe(true)
  })
})

describe('落地交代（完成 / 需重启）', () => {
  it('says exactly the truth of the final state, and only for the row the action touched', () => {
    expect(enterprisePluginSettledNotice({ packageName: 'ent-a', settled: { action: 'install', packageName: 'ent-a', state: 'ACTIVE' } }))
      .toBe(ENTERPRISE_PLUGIN_SETTLED_INSTALLED)
    expect(enterprisePluginSettledNotice({ packageName: 'ent-a', settled: { action: 'install', packageName: 'ent-a', state: 'RESTART_REQUIRED' } }))
      .toBe(ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART)
    expect(enterprisePluginSettledNotice({ packageName: 'ent-a', settled: { action: 'remove', packageName: 'ent-a', state: 'RESTART_REQUIRED' } }))
      .toBe(ENTERPRISE_PLUGIN_SETTLED_REMOVED)
    // 卸载把本机记录删干净 ⇒ `EXPECTED`（本机不再装着）也是「卸完了」这个事实。
    expect(enterprisePluginSettledNotice({ packageName: 'ent-a', settled: { action: 'remove', packageName: 'ent-a', state: 'EXPECTED' } }))
      .toBe(ENTERPRISE_PLUGIN_SETTLED_REMOVED)
    // 别的行、别的态、缺席：一律没有要说的（失败由唯一提示组件负责，这里不抢）。
    expect(enterprisePluginSettledNotice({ packageName: 'ent-b', settled: { action: 'install', packageName: 'ent-a', state: 'ACTIVE' } })).toBeUndefined()
    expect(enterprisePluginSettledNotice({ packageName: 'ent-a', settled: { action: 'install', packageName: 'ent-a', state: 'FAILED' } })).toBeUndefined()
    expect(enterprisePluginSettledNotice({ packageName: 'ent-a' })).toBeUndefined()
  })
})

/* ───────────────────────── 行渲染：进度 / 推进 / 收束 ───────────────────────── */

describe('企业插件行的「安装中」过程效果', () => {
  it('puts the progress on the row that is really installing, and leaves every other row alone', () => {
    const props = shellProps(
      [row({ packageName: 'ent-a', state: 'INSTALLING' }), row({ packageName: 'ent-b', state: 'ACTIVE' })],
      { pluginBusy: { action: 'install', packageName: 'ent-a' } },
    )
    const tree = EnterpriseMarketLegacyShell(props)
    // 只有那一行有进度；另一行一个节点都没有（多行各自独立）。
    const bars = collectByAttr(tree, 'data-enterprise-plugin-progress')
    expect(bars).toHaveLength(1)
    expect(bars[0]?.['data-enterprise-plugin-progress']).toBe('ent-a')
    expect(String(bars[0]?.['data-enterprise-plugin-progress'])).not.toBe('ent-b')
    // 语义是**不确定态**进度条：没有 aria-valuenow，只有阶段文字放在 aria-valuetext 里。
    let progressbar: Record<string, unknown> | undefined
    walkTree(tree, element => { if (element.props['role'] === 'progressbar') progressbar = element.props })
    expect(progressbar?.['aria-valuenow']).toBeUndefined()
    expect(progressbar?.['aria-valuetext']).toBe('正在安装')
    expect(progressbar?.['aria-live']).toBe('polite')
    // 行自身对辅助技术自报忙；另一行没有这个属性。
    const busyRows = collectByAttr(tree, 'aria-busy')
    expect(busyRows).toHaveLength(1)
    // 另一行的开关照旧可用（进度只属于它自己那一行）。
    const switches: Record<string, unknown>[] = []
    walkTree(tree, element => { if (element.type === (Switch as unknown)) switches.push(element.props) })
    expect(switches).toHaveLength(2)
    expect(switches.find(item => String(item['label']).includes('ent-b'))?.['disabled']).toBe(false)
    expect(switches.find(item => String(item['label']).includes('ent-a'))?.['disabled']).toBe(true)
    // 「不能取消」是**一句话**，不是一枚按钮：整行里没有任何取消按钮，也没有 cancelable 为 true 的钩子。
    expect(bars[0]?.['data-enterprise-plugin-progress-cancelable']).toBe('false')
    expect(bars[0]?.['data-enterprise-plugin-progress-indeterminate']).toBe('true')
    expect(textWithin(pluginRow(tree, 'ent-a'))).toContain(ENTERPRISE_PLUGIN_PROGRESS_CANCEL_NOTICE)
    expect(textWithin(pluginRow(tree, 'ent-a'))).not.toContain('取消安装')
    const buttons: Record<string, unknown>[] = []
    walkTree(tree, element => { if (element.type === (Switch as unknown)) return; if (element.props['className'] === 'own-market-progressButton') buttons.push(element.props) })
    expect(buttons).toEqual([])
  })

  it('advances the stage text with the real Host stage, one word at a time', () => {
    const stages: readonly (readonly [ManagedPluginState, string])[] = [
      ['DOWNLOAD_PENDING', '等待下载'],
      ['DOWNLOADING', '正在下载'],
      ['VERIFIED', '校验通过'],
      ['INSTALLING', '正在安装'],
    ]
    const seen = stages.map(([state]) => {
      const facts = enterpriseMarketPluginRowFacts(shellProps(row({ state })), row({ state }))
      return { state, stageText: facts.progress?.stageText, phase: facts.progress?.phase }
    })
    // 每一次都是**真阶段词**（取自既有那份官方状态词表），不是编的、也不是估算的。
    for (const [index, [state, stageText]] of stages.entries()) {
      expect(seen[index]?.state, state).toBe(state)
      expect(seen[index]?.stageText, state).toBe(stageText)
      expect(seen[index]?.phase, state).toBe('working')
    }
    // 阶段真的在换：四次渲染拿到四个互不相同的阶段词。
    expect(new Set(seen.map(item => item.stageText)).size).toBe(stages.length)
  })

  it('converges to done / needs-restart with a visible, announced sentence, and clears the progress', () => {
    const cases: readonly (readonly [EnterprisePluginStatus['plugins'][number]['state'], string])[] = [
      ['ACTIVE', ENTERPRISE_PLUGIN_SETTLED_INSTALLED],
      ['RESTART_REQUIRED', ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART],
    ]
    for (const [state, notice] of cases) {
      const props = shellProps(row({ state }), {
        pluginSettled: { action: 'install', packageName: 'ent-a', state },
      })
      const tree = EnterpriseMarketLegacyShell(props)
      // 收束那一句是 `role="status"`（读屏能接着进度收到「安装完成…」）。
      expect(noticesWithin(pluginRow(tree, 'ent-a')), state).toContain(notice)
      const settled = collectByAttr(tree, 'data-enterprise-plugin-settled')
      expect(settled).toHaveLength(1)
      expect(settled[0]?.['data-enterprise-plugin-settled']).toBe('ent-a')
      // 工序已经落地 ⇒ 那条不确定态进度整段退场（不留一条永远在动的假进度）。
      expect(collectByAttr(tree, 'data-enterprise-plugin-progress')).toEqual([])
    }
    // 别的行不会引用这一行的收束（按包名归行）。
    const other = EnterpriseMarketLegacyShell(shellProps(
      row({ packageName: 'ent-b', state: 'ACTIVE' }),
      { pluginSettled: { action: 'install', packageName: 'ent-a', state: 'ACTIVE' } },
    ))
    expect(collectByAttr(other, 'data-enterprise-plugin-settled')).toEqual([])
  })

  it('converges to failed through the single notice component, with the switch still retryable', () => {
    const props = shellProps(row({ state: 'FAILED' }), {
      pluginActionError: { id: 'ent-a', action: 'install', code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
    })
    const line = pluginRow(EnterpriseMarketLegacyShell(props), 'ent-a')
    // 失败可见：唯一提示组件（人话 + 下一步 + 技术信息里的稳定码），前缀说清是「安装失败」。
    const alerts = noticesWithin(line)
    expect(alerts.length).toBeGreaterThan(0)
    expect(textWithin(line)).toContain('安装失败')
    expect(textWithin(line)).toContain('下一步：')
    // 稳定码只待在「技术信息」折叠区里，但必须取得回（既有排障口径不变）。
    expect(collectByAttr(line, 'data-enterprise-error-code').map(props => props['data-enterprise-error-code']))
      .toEqual(['ENT_PLUGIN_SIGNATURE_INVALID'])
    // 失败**不**禁用开关：再拨一次就是重试（既有口径不变）。
    let toggle: Record<string, unknown> | undefined
    walkTree(line, element => { if (element.type === (Switch as unknown)) toggle = element.props })
    expect(toggle?.['disabled']).toBe(false)
    // 失败态不叠「正在处理…」那种自相矛盾的进度。
    expect(collectByAttr(line, 'data-enterprise-plugin-progress')).toEqual([])
  })

  it('keeps the progress strip out of the "disabled switch must be explained" ledger', () => {
    const props = shellProps(row({ state: 'INSTALLING' }))
    const line = pluginRow(EnterpriseMarketLegacyShell(props), 'ent-a')
    // 既有反向锁的判据只看 `role="status"|"alert"`：进度刻意用 `role="progressbar"`，
    // 所以那一句「安装或卸载正在进行」仍然是这一行**唯一**的解释——既有的 425+ 条断言不会被这条进度加一条而漂。
    expect(noticesWithin(line).filter(text => text.trim().length > 0)).toEqual(['安装或卸载正在进行，完成后就能继续操作。'])
    expect(collectByAttr(line, 'data-enterprise-plugin-progress')).toHaveLength(1)
  })

  it('renders the same progress and the same words from the shared projection in both places', async () => {
    const progress = enterprisePluginProgress({ packageName: 'ent-a', state: 'DOWNLOADING', stageText: '正在下载' })!
    const settled = ENTERPRISE_PLUGIN_SETTLED_INSTALLED
    // 官方插件页里的插件市场（行落点）
    const rowTree = EnterprisePluginProgressNotes({ id: 'ent-a', facts: { progress, settledNotice: settled } as never })
    // 企业设置 → 插件（卡片行 + 详情弹窗落点，同一枚纯组件）
    const cardTree = EnterprisePluginCardProgressNotes({ name: 'ent-a', progress })
    for (const [label, tree] of [['row', rowTree], ['card', cardTree]] as const) {
      let bar: Record<string, unknown> | undefined
      walkTree(tree, element => { if (element.props['role'] === 'progressbar') bar = element.props })
      expect(bar?.['aria-valuetext'], label).toBe('正在下载')
      expect(bar?.['aria-live'], label).toBe('polite')
      expect(textWithin(tree), label).toContain('正在下载')
      expect(textWithin(tree), label).toContain(ENTERPRISE_PLUGIN_PROGRESS_CANCEL_NOTICE)
    }
    expect(collectByAttr(EnterprisePluginSettledNote({ id: 'ent-a', facts: { settledNotice: settled } as never }), 'data-enterprise-plugin-settled')).toHaveLength(1)
    expect(collectByAttr(EnterprisePluginCardSettledNote({ name: 'ent-a', notice: settled }), 'data-enterprise-plugin-settled')).toHaveLength(1)
    // 没有进度 / 没有交代时两处都整段不进 DOM（安静行不加噪音）。
    expect(EnterprisePluginProgressNotes({ id: 'ent-a', facts: {} as never })).toBeNull()
    expect(EnterprisePluginSettledNote({ id: 'ent-a', facts: {} as never })).toBeNull()
    expect(EnterprisePluginCardProgressNotes({ name: 'ent-a', progress: undefined })).toBeNull()
    expect(EnterprisePluginCardSettledNote({ name: 'ent-a', notice: undefined })).toBeNull()
    // 源码级：两处都只经**同一份**投影取进度与交代（没有第二套阶段词、也没有第二份百分比）。
    const market = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    const tab = await readFile(new URL('../src/plugin-market.tsx', import.meta.url), 'utf8')
    const code = (source: string): string => stripBlocks(source).replace(/\/\/[^\n]*/g, '')
    for (const [name, source] of [['marketplace-entry', code(market)], ['plugin-market', code(tab)]] as const) {
      expect(source, name).toContain("from './plugin-install-progress.js'")
      expect(source, name).toContain('enterprisePluginProgress(')
      expect(source, name).toContain('enterprisePluginSettledNotice(')
      // 两处卡片/行都靠 `role="progressbar"`（不确定态），谁也不许自己造第二个会填满的条。
      expect(source.match(/role="progressbar"/g)?.length, name).toBe(1)
    }
    // 设置页那份 CSS 也必须尊重「减少动态效果」。
    expect(tab).toContain('@media (prefers-reduced-motion: reduce)')
    expect(tab).toContain('animation:none')
  })
})

/* ───────────────────────── store 轮询：真进度接的是我们自己那条只读路由 ───────────────────────── */

const baseStatus: EnterpriseLocalStatus = {
  bundleVersion: '0.1.0',
  platformUrl: 'https://enterprise.example.com',
  transport: 'webServer.register',
  state: 'READY',
}

/** 一份受管插件投影（真实形状：`lastErrorCode`/`desiredRevision` 都在）。 */
function pluginStatus(state: ManagedPluginState, packageName = 'ent-a'): EnterprisePluginStatus {
  return {
    assignmentRevision: 3,
    plugins: [{
      packageName,
      version: state === 'RESTART_REQUIRED' || state === 'ACTIVE' ? '1.2.0' : null,
      desiredRevision: 3,
      desiredState: 'INSTALLED',
      state,
      lastErrorCode: null,
    }],
  }
}

/** 只实现这一刀用得到的那几件的假 API（其余方法在测试里不会被调用）。 */
function fakeApi(overrides: Partial<EnterpriseLocalApi> = {}): EnterpriseLocalApi {
  return {
    status: vi.fn(async () => baseStatus),
    refresh: vi.fn(async () => baseStatus),
    plugins: vi.fn(async () => pluginStatus('EXPECTED')),
    installPlugin: vi.fn(async () => pluginStatus('RESTART_REQUIRED')),
    removePlugin: vi.fn(async () => pluginStatus('EXPECTED')),
    ...overrides,
  } as unknown as EnterpriseLocalApi
}

describe('「安装中」真进度的接线（store 轮询只读状态路由）', () => {
  it('polls our own read-only /plugins route while the install is in flight, then stops by itself', async () => {
    vi.useFakeTimers()
    try {
      let current = pluginStatus('EXPECTED')
      const plugins = vi.fn(async () => current)
      let finish!: (value: EnterprisePluginStatus) => void
      const api = fakeApi({
        plugins,
        installPlugin: vi.fn(() => new Promise<EnterprisePluginStatus>(resolve => { finish = resolve })),
      })
      const store = new EnterpriseAccountStore(api)
      await store.refresh()
      const before = plugins.mock.calls.length
      const installing = store.installPlugin('ent-a', '1001')
      // 请求已在途：行上立刻进「安装中」态（`pending`：Host 还没报到在途阶段）。
      expect(store.getSnapshot().pluginBusy).toEqual({ action: 'install', packageName: 'ent-a' })
      // 每一拍都去读**我们自己那条只读路由**，Host 真实走到哪一步就上屏哪一步。
      for (const stage of ['DOWNLOAD_PENDING', 'DOWNLOADING', 'VERIFIED', 'INSTALLING'] as const) {
        current = pluginStatus(stage)
        await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
        expect(store.getSnapshot().pluginStatus?.plugins[0]?.state, stage).toBe(stage)
      }
      expect(plugins.mock.calls.length).toBeGreaterThan(before)
      // 只读：全程没有任何第二条动作发出去（进度不是靠猜、也不是靠再发一次安装）。
      expect(api.installPlugin).toHaveBeenCalledTimes(1)
      expect(api.removePlugin).not.toHaveBeenCalled()
      // 收束：Host 报到 RESTART_REQUIRED，动作返回 ⇒ 落地交代记的是**真实受管态**。
      current = pluginStatus('RESTART_REQUIRED')
      finish(pluginStatus('RESTART_REQUIRED'))
      await installing
      expect(store.getSnapshot().pluginBusy).toBeUndefined()
      expect(store.getSnapshot().pluginSettled).toEqual({ action: 'install', packageName: 'ent-a', state: 'RESTART_REQUIRED' })
      expect(enterprisePluginSettledNotice({ packageName: 'ent-a', settled: store.getSnapshot().pluginSettled }))
        .toBe(ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART)
      // 自停：装完就一拍都不再读（不留常驻轮询）。
      const settledCalls = plugins.mock.calls.length
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS * 5)
      expect(plugins.mock.calls.length).toBe(settledCalls)
    } finally { vi.useRealTimers() }
  })

  it('surfaces an unreadable progress line as a visible code, without calling it a failed install, and keeps retrying', async () => {
    vi.useFakeTimers()
    try {
      const plugins = vi.fn()
        .mockResolvedValueOnce(pluginStatus('EXPECTED'))
        .mockRejectedValue(new EnterpriseLocalApiError('ENT_LOCAL_UNAVAILABLE', 503))
      let finish!: (value: EnterprisePluginStatus) => void
      const api = fakeApi({
        plugins,
        installPlugin: vi.fn(() => new Promise<EnterprisePluginStatus>(resolve => { finish = resolve })),
      })
      const store = new EnterpriseAccountStore(api)
      await store.refresh()
      const installing = store.installPlugin('ent-a', '1001')
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
      // 进度这一路读不到 ⇒ 只把稳定码摆出来（界面在那一行说「进度暂时读不到…」）。
      expect(store.getSnapshot().pluginProgressErrorCode).toBe('ENT_LOCAL_UNAVAILABLE')
      expect(store.getSnapshot().pluginProgressErrorCode).toBeDefined()
      // 它**不是**安装失败：动作那一路的失败码仍然没有。
      expect(store.getSnapshot().pluginErrorCode).toBeUndefined()
      // 下一拍继续重读（自愈）；读回真状态后那把码就撤掉。
      const readCalls = plugins.mock.calls.length
      plugins.mockResolvedValue(pluginStatus('INSTALLING'))
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
      expect(plugins.mock.calls.length).toBeGreaterThan(readCalls)
      expect(store.getSnapshot().pluginProgressErrorCode).toBeUndefined()
      expect(store.getSnapshot().pluginStatus?.plugins[0]?.state).toBe('INSTALLING')
      finish(pluginStatus('RESTART_REQUIRED'))
      await installing
    } finally { vi.useRealTimers() }
  })

  it('puts a failed install on the failure path (no completion claim) and keeps the real failure code', async () => {
    vi.useFakeTimers()
    try {
      let current = pluginStatus('EXPECTED')
      const api = fakeApi({
        plugins: vi.fn(async () => current),
        installPlugin: vi.fn(async () => { throw new EnterpriseLocalApiError('ENT_PLUGIN_SIGNATURE_INVALID', 503) }),
      })
      const store = new EnterpriseAccountStore(api)
      await store.refresh()
      await store.installPlugin('ent-a', '1001')
      // 失败 ⇒ 不许有「安装完成」那种交代（否则界面会说一件没发生的事）。
      expect(store.getSnapshot().pluginSettled).toBeUndefined()
      expect(store.getSnapshot().pluginErrorCode).toBe('ENT_PLUGIN_SIGNATURE_INVALID')
      expect(store.getSnapshot().pluginBusy).toBeUndefined()
      // 失败后也不再空转轮询。
      const calls = vi.mocked(api.plugins).mock.calls.length
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS * 5)
      expect(vi.mocked(api.plugins).mock.calls.length).toBe(calls)
      current = pluginStatus('FAILED')
      expect(current.plugins[0]?.state).toBe('FAILED')
    } finally { vi.useRealTimers() }
  })

  it('covers the uninstall direction on the same read-only line', async () => {
    vi.useFakeTimers()
    try {
      let current = pluginStatus('ACTIVE')
      let finish!: (value: EnterprisePluginStatus) => void
      const api = fakeApi({
        plugins: vi.fn(async () => current),
        removePlugin: vi.fn(() => new Promise<EnterprisePluginStatus>(resolve => { finish = resolve })),
      })
      const store = new EnterpriseAccountStore(api)
      await store.refresh()
      const removing = store.removePlugin('ent-a')
      expect(store.getSnapshot().pluginBusy).toEqual({ action: 'remove', packageName: 'ent-a' })
      current = pluginStatus('REMOVING')
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
      expect(store.getSnapshot().pluginStatus?.plugins[0]?.state).toBe('REMOVING')
      // Host 把记录删干净 ⇒ 投影里没有这一行了；落地交代仍如实说「卸完了」。
      current = { assignmentRevision: 4, plugins: [] }
      finish({ assignmentRevision: 4, plugins: [] })
      await removing
      expect(store.getSnapshot().pluginSettled).toEqual({ action: 'remove', packageName: 'ent-a', state: 'EXPECTED' })
    } finally { vi.useRealTimers() }
  })

  it('picks a stage already running after a page refresh, and still stops when it settles', async () => {
    vi.useFakeTimers()
    try {
      let current = pluginStatus('DOWNLOADING')
      const plugins = vi.fn(async () => current)
      const api = fakeApi({ plugins })
      const store = new EnterpriseAccountStore(api)
      // 页面刚打开就撞上一次正在进行的安装：取数结果里已经有在途受管态 ⇒ 进度轮询自动接上。
      await store.refresh()
      const initial = plugins.mock.calls.length
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
      expect(plugins.mock.calls.length).toBeGreaterThan(initial)
      expect(store.getSnapshot().pluginStatus?.plugins[0]?.state).toBe('DOWNLOADING')
      current = pluginStatus('RESTART_REQUIRED')
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS * 2)
      const settled = plugins.mock.calls.length
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS * 5)
      expect(plugins.mock.calls.length).toBe(settled)
      expect(store.getSnapshot().pluginStatus?.plugins[0]?.state).toBe('RESTART_REQUIRED')
    } finally { vi.useRealTimers() }
  })

  it('bounds the "observed but not ours" polling, so a machine stuck mid-stage cannot spin forever', async () => {
    vi.useFakeTimers()
    try {
      // Host 进程若在工序中崩过，磁盘上的受管态就会永远停在 `DOWNLOADING` 这一格。
      const plugins = vi.fn(async () => pluginStatus('DOWNLOADING'))
      const api = fakeApi({ plugins })
      const store = new EnterpriseAccountStore(api)
      await store.refresh()
      const initial = plugins.mock.calls.length
      // 有上限：轮够 MAX_IDLE_TICKS 拍就停表（不会变成 1.2 秒一次的常驻空转）。
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS * (ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS + 5))
      const calls = plugins.mock.calls.length
      expect(calls - initial).toBeLessThanOrEqual(ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS + 1)
      await vi.advanceTimersByTimeAsync(ENTERPRISE_PLUGIN_PROGRESS_POLL_MS * 20)
      expect(plugins.mock.calls.length).toBe(calls)
      // 行为仍诚实：进度停在**最后报到的那个真阶段**上（阶段是真的，只是不再推进）。
      expect(store.getSnapshot().pluginStatus?.plugins[0]?.state).toBe('DOWNLOADING')
      expect(enterprisePluginProgress({
        packageName: 'ent-a', state: 'DOWNLOADING', stageText: '正在下载',
      })?.stageText).toBe('正在下载')
    } finally { vi.useRealTimers() }
  })
})
