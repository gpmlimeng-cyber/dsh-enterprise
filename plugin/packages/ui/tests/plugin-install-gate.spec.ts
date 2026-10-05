/**
 * [INPUT]: 依赖 `plugin-install-gate.ts` 的全部纯投影（锁定原因与词表 / 悬浮说明）、`marketplace-entry.tsx` 的目录页外壳与插件行 facts、`plugin-market.tsx` 的插件行门禁投影、`error-messages.ts` 的人话映射
 * [OUTPUT]: 锁五件事——① **平台彻底退出决策面**：这一叶不再读设备系统（UA 三个样本下同一行渲染逐字相同）、也不再读目录声明的 `operatingSystems`（源码级：叶与两个消费面里一个平台词、一个 UA 读法都不许留）；② **★不变式**：`installErrorCode` 缺席时，插件行的行为与文案与 OS 声明**完全无关**——「声明含当前平台 / 不含当前平台 / 根本没有该字段」三种形态渲染结果逐字相同（形状序列化 + 可见文本 + 可见说明 + 开关 props 四路同证），且与设备 UA 也无关；③ `installErrorCode` 存在（情形 A）：可见 alert（人话 +「下一步：」+ 技术信息里的码）+ 开关禁用，retryable 给真重发、终态不给假重试；④ 情形 C（no-entry / in-progress / restart / busy / fatal）的行上可见说明与唯一措辞；⑤ **两把反向锁**：插件行里凡 Switch 被禁用必须有非空可见 `role="status"|"alert"` 文本（含「只挂 title」的反例树），且**插件行可见文案里不得出现任何平台词**（含两个消费面的源码级锁）
 * **本刀（Codex 插件商店口径：行动作不再用开关）**：`switchWithin` 的**取证落点换了一处、判据没换**——
 *   已安装那一行的动作现在是「⋯」里的启停项（`.own-market-moreItem`，未接下拉宿主时按平铺渲染），
 *   `slotWithin('install')`（未装那一格的「安装」按钮）照旧；故「分流两块各自守自己那条反向锁」
 *   （`已装不给安装按钮 / 未装不给启停项`）、「禁用即须有可见说明」、「平台词零出现」三条不变式**逐条保留**；
 *   死控件反例树改成「禁用 + 只挂 title 的动作项」（它自己的动作文案不算解释）；
 *   「卸载」那条边界按新契约改写：市场行的「⋯」**可以**卸载，但**只给非内置项**
 *   （`inCatalog === false`），内置/后台预置项不给；设置页详情那一面仍是唯一的**带确认**入口。
 * [POS]: 产品宪法「禁用控件不许只挂一句 title」与「平台不参与任何判断（界面不出现平台词）」两件事的机械门锁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { enterpriseErrorMessage, enterpriseErrorRetryable } from '../src/error-messages.js'
import {
  ENTERPRISE_PLUGIN_DISABLE_TITLE,
  ENTERPRISE_PLUGIN_ENABLE_TITLE,
  ENTERPRISE_PLUGIN_IN_FLIGHT_STATES,
  ENTERPRISE_PLUGIN_INSTALL_TITLE,
  ENTERPRISE_PLUGIN_LOCK_NOTICE,
  ENTERPRISE_PLUGIN_LOCK_TITLE,
  ENTERPRISE_PLUGIN_UNINSTALL_TITLE,
  enterprisePluginInstallLabel,
  enterprisePluginInstallTitle,
  enterprisePluginInstalled,
  enterprisePluginInstalledStatusLabel,
  enterprisePluginLockNotice,
  enterprisePluginLockReason,
  enterprisePluginRowAction,
  enterprisePluginSwitchTitle,
  enterprisePluginUninstallLabel,
  enterprisePluginUninstallTitle,
  type EnterprisePluginLockReason,
} from '../src/plugin-install-gate.js'
import {
  ENTERPRISE_MARKET_DISABLE_TEXT,
  ENTERPRISE_MARKET_ENABLE_TEXT,
  ENTERPRISE_PLUGIN_BLOCKED_RETRY_LABEL,
  EnterpriseMarketLegacyShell,
  enterpriseMarketPluginRowFacts,
  enterpriseMarketPluginRows,
  type EnterpriseMarketPluginRow,
  type EnterpriseMarketShellProps,
} from '../src/marketplace-entry.js'
import { enterprisePluginRowGate, EnterprisePluginGateNotes } from '../src/plugin-market.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
  // `official-ui.ts` 在 **import 期**就把 Menu / MenuItemButton / 四枚 Icon 取成**模块级常量**
  // ⇒ mock 缺任何一项都会在**加载期**抛「No "…" export is defined on the mock」，整份 spec 起不来。
  // 本文件不测这些原语，补齐占位即可（**不是**放宽任何断言）。
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
}))

afterEach(() => { vi.unstubAllGlobals() })

/* ───────────────────────── 无 DOM 的树工具（与 marketplace-entry.spec 同一口径） ───────────────────────── */

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

/** 员工**看得见**的文本（跳过 `<style>`；`title` 不是子文本，故天然被排除——这正是反向锁要的）。
 *  稳定码那枚 `<code>` 也跳过：码只准待在「技术信息」折叠区里，不算「人话说明」。 */
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

/**
 * 一棵子树的**规范形状**（不变式的最强断言：不只是可见文本，连元素类型、全部 props 与层级一起比）。
 * 函数组件透明展开（mock 原语产出 undefined，故只留下它的 props）；函数 props 归一成 `fn`（不是渲染结果）。
 */
function shapeWithin(node: ReactNode): string {
  if (node === null || node === undefined) return 'null'
  if (typeof node === 'boolean') return String(node)
  if (typeof node === 'string' || typeof node === 'number') return JSON.stringify(String(node))
  if (Array.isArray(node)) return `[${node.map(shapeWithin).join(',')}]`
  if (!isValidElement(node)) return String(node)
  const element = node as ReactElement<Record<string, unknown>>
  const props = element.props
  const head = Object.keys(props).filter(key => key !== 'children').sort().map((key) => {
    const value = props[key]
    if (typeof value === 'function') return `${key}=fn`
    if (value === undefined) return `${key}=undef`
    // 卡片那枚官方兜底图标的**渐变 id 逐次唯一**（写死会让同页几十枚全解析到第一个同名 defs、
    // 整页染成同一色——官方 `useArtworkId` 注释即此）⇒ 每次渲染都不同。
    // 它是**实现细节**、不是本文件要守的不变式（这里守的是「不同 OS 声明 / 不同 UA 渲染出同一行」），
    // 故归一成占位——**不是放松断言**：元素类型、其余全部 props、层级与可见文本照旧逐字比。
    if (key === 'id' && typeof value === 'string' && value.startsWith('own-market-art-')) return `${key}=ARTIFACT-ID`
    if (key === 'fill' && typeof value === 'string' && value.startsWith('url(#own-market-art-')) return `${key}=ARTIFACT-FILL`
    return `${key}=${JSON.stringify(value)}`
  }).join(' ')
  const type = typeof element.type === 'string' ? element.type : 'C'
  if (typeof element.type === 'function') {
    const rendered = (element.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return `<${type} ${head}>${shapeWithin(rendered as ReactNode)}`
  }
  return `<${type} ${head}>${shapeWithin(props['children'] as ReactNode)}`
}

/** 插件行那枚 `<li>` 的子树（按 `data-enterprise-plugin-package` 取，单行渲染时唯一）。 */
function pluginRow(tree: ReactNode, name: string): ReactNode {
  let found: ReactNode
  walkTree(tree, element => {
    if (element.props['data-enterprise-plugin-package'] === name) found = element.props['children'] as ReactNode
  })
  return found
}

/**
 * 子树里那一枚动作控件的 props——**按分流槽位取**（`data-enterprise-plugin-slot`），
 * 而不是按控件类型：分流本身就是被测对象，槽位缺席 = 这一格没画控件（未安装那一行没有开关）。
 *
 * **本刀（卡片操作区不再用开关）**：只有「未安装 ⇒ 安装按钮」那一格还带槽位属性；
 * 已安装那一格给的是一枚「⋯」（未接下拉宿主时按**平铺**渲染，见 `toggleWithin`）。
 */
function slotWithin(node: ReactNode, slot: 'install' | 'switch'): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined
  walkTree(node, element => {
    if (element.props['data-enterprise-plugin-slot'] === slot) found = element.props
  })
  return found
}

/** 行上「⋯」的**动作项**：启停那一项（文案恒为「停用」或「启用」，按当前启停位给相反的那一枚）。 */
function menuItemWithin(node: ReactNode, label: string): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined
  walkTree(node, element => {
    const props = element.props
    if (element.type === 'button' && props['className'] === 'own-market-moreItem' && props['children'] === label) {
      found = props as Record<string, unknown>
    }
  })
  return found
}

/**
 * 已安装那一行的**启停动作**（分流到 `'switch'` 那一格才存在）：本刀卡片不再用开关，
 * 该动作是行上「⋯」里的那一项——两个方向取同一处（按当前启停位给相反的那一枚）。
 */
const switchWithin = (node: ReactNode): Record<string, unknown> | undefined =>
  menuItemWithin(node, ENTERPRISE_MARKET_DISABLE_TEXT) ?? menuItemWithin(node, ENTERPRISE_MARKET_ENABLE_TEXT)
/** 未安装那一行的【安装】按钮 props（分流到 `'install'` 那一格才存在）。 */
const plusWithin = (node: ReactNode): Record<string, unknown> | undefined => slotWithin(node, 'install')

/** 子树里全部 `role="status"|"alert"` 元素的可见文本。 */
function noticesWithin(node: ReactNode): readonly string[] {
  const acc: string[] = []
  walkTree(node, element => {
    const role = element.props['role']
    if (role !== 'status' && role !== 'alert') return
    acc.push(textWithin(element.props['children'] as ReactNode))
  })
  return acc
}

/** **反向锁的判据之一**：这一行有没有「说得出口」的可见解释（空字符串 / 只有 title 都不算）。 */
function visibleExplanations(row: ReactNode): readonly string[] {
  return noticesWithin(row).filter(text => text.trim().length > 0)
}

/* ───────────────────────── 平台词的判据（反向锁之二） ─────────────────────────
 *
 * 判定口径（写在用例旁边，免得下次靠猜）：
 *  ① **什么算「可见文案」**：`textWithin()` 的产物——员工在界面上真正看得见的**文本节点**。
 *     属性一律不算（`title` / `aria-label` / `data-*` 都不是子文本），`<style>` 不算，
 *     「技术信息」折叠区里那枚承载稳定错误码的节点（`data-enterprise-error-code`）也不算：
 *     码是排障用的机器字，不是「按平台给的人话」；把码算进可见文案只会逼着人不显示码。
 *  ② **什么算「平台词」**：契约三平台名与它们的人话名一起算——
 *     `android` / `darwin` / `win32` / `linux` / `macOS` / `Windows`（大小写不敏感）。
 *  ③ **覆盖哪几个渲染面**：`marketplace-entry.tsx` 的插件行（可整树直调，逐形态逐 UA 渲染后过锁）
 *     加 `plugin-market.tsx` 那枚卡片行与详情（该组件含 hook、本仓无 react-dom 不能直调，
 *     故用**源码级**锁：剥掉注释后整个文件里一个平台词都不许有，且不许再把声明列表拼上屏）。
 */
const PLATFORM_WORD = /android|darwin|win32|linux|macos|windows/gi

/** 一段可见文案里出现的平台词（大小写不敏感）。 */
function platformWordsIn(text: string): readonly string[] {
  return text.match(PLATFORM_WORD) ?? []
}

/** 剥掉注释后的源码（注释里说明「平台已退出」是允许的，代码里不许留平台词）。 */
const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/* ───────────────────────── 真实 UA 样本 ───────────────────────── */

const UA = {
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  macOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  linuxDesktop: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  node: 'Node.js/24',
  junk: 'curl/8.4.0',
} as const

/** 设备 UA 的三个代表（含与不含、认得出与认不出）。 */
const DEVICE_UAS: readonly (readonly [string, string])[] = [
  ['安卓', UA.androidPhone],
  ['macOS', UA.macOS],
  ['node（认不出）', UA.node],
]

/**
 * **不变式的三条腿**：三种 OS 声明形态。
 * 平台退出决策面之后，这一列数据只随行携带——三种形态在插件行上必须渲染出**逐字相同**的结果。
 */
const DECLARATION_FORMS: readonly { readonly name: string; readonly operatingSystems: readonly string[] | undefined }[] = [
  { name: '声明含当前平台（darwin/linux/win32 全列：安卓与桌面 Linux 都命中 linux）', operatingSystems: ['darwin', 'linux', 'win32'] },
  { name: '声明不含当前平台（只有 darwin/win32）', operatingSystems: ['darwin', 'win32'] },
  { name: '根本没有该字段（旧宿主 / 手搓行）', operatingSystems: undefined },
]

/** 一行**未安装**插件（目录版 + 空本机记录）的构造器，字段一次给全，避免测试自造第二份形状。 */
function row(overrides: Partial<EnterpriseMarketPluginRow> = {}): EnterpriseMarketPluginRow {
  return {
    packageName: 'ent-a', version: '1.2.0', state: 'EXPECTED', inCatalog: true,
    enabled: true,
    operatingSystems: ['darwin', 'linux', 'win32'], ...overrides,
  }
}

/**
 * 一行**已安装**插件：本机记录说该装着（`desiredState: 'INSTALLED'`）+ 已落盘版本 + 启停位。
 * 它才是渲染【开关】的那一格；未安装那一行给的是【＋】（两者由 `enterprisePluginRowAction` 分流）。
 */
function installed(overrides: Partial<EnterpriseMarketPluginRow> = {}): EnterpriseMarketPluginRow {
  return row({ state: 'ACTIVE', desiredState: 'INSTALLED', recordVersion: '1.2.0', ...overrides })
}

/** 安卓壳里的目录页外壳：`navigator.userAgent` 仍然注入（它现在**一个字段都不影响渲染**，正是要看这一点）。 */
function shellProps(userAgent: string, plugin: EnterpriseMarketPluginRow, extra: Partial<EnterpriseMarketShellProps> = {}): EnterpriseMarketShellProps {
  vi.stubGlobal('navigator', { userAgent })
  return { view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: [plugin], ...extra }
}

/**
 * 三种声明形态各渲染一次那唯一一行插件（`installErrorCode` 缺席、写入口在场）。
 *
 * 用**已安装**那一行：它是渲染【开关】的那一格，故「声明形态不影响开关」这条不变式仍逐字可比。
 */
function rowsForEachForm(onTogglePluginEnabled: () => void): readonly { readonly form: string; readonly line: ReactNode }[] {
  return DECLARATION_FORMS.map(form => ({
    form: form.name,
    line: pluginRow(
      EnterpriseMarketLegacyShell(shellProps(
        UA.androidPhone, installed({ operatingSystems: form.operatingSystems }), { onTogglePluginEnabled },
      )),
      'ent-a',
    ),
  }))
}

/* ══════════════════ 平台退出决策面：这一叶不再读设备系统 ══════════════════ */

describe('设备系统彻底退出决策面：这一叶不再读 UA、也不再读系统声明', () => {
  it('renders one identical row for android / macOS / an unrecognisable user agent (there is no UA read left)', () => {
    const shapes = DEVICE_UAS.map(([, userAgent]) => shapeWithin(pluginRow(
      EnterpriseMarketLegacyShell(shellProps(userAgent, installed(), { onTogglePluginEnabled: vi.fn() })), 'ent-a',
    )))
    expect(new Set(shapes).size, '三家设备 UA 必须渲染同一行').toBe(1)
    // 安卓 WebView 的 UA 里确实同时含 `Linux`：这在过去是「必须把安卓判在 Linux 前面」的理由，
    // 现在它只是浏览器的一个字符串——同一行与 UA 一个字段都不相关。
    expect(/Linux/.test(UA.androidPhone)).toBe(true)
    expect(platformWordsIn(textWithin(pluginRow(
      EnterpriseMarketLegacyShell(shellProps(UA.androidPhone, installed(), { onTogglePluginEnabled: vi.fn() })), 'ent-a',
    )))).toEqual([])
  })

  it('has no fallback branch left: a junk UA and no navigator at all behave exactly like android', () => {
    const withUa = (userAgent: string): string => shapeWithin(pluginRow(
      EnterpriseMarketLegacyShell(shellProps(userAgent, installed(), { onTogglePluginEnabled: vi.fn() })), 'ent-a',
    ))
    const android = withUa(UA.androidPhone)
    expect(withUa(UA.junk)).toBe(android)
    expect(withUa(UA.node)).toBe(android)
    // 「认不出设备系统」这条降级支路已经不存在了：没有 navigator 也一样渲染（没有人去读它）。
    vi.stubGlobal('navigator', undefined)
    const withoutNavigator = shapeWithin(pluginRow(
      EnterpriseMarketLegacyShell({
        view: 'page', activeTab: 'plugins', sessionUsable: true,
        enterprisePlugins: [installed()], onTogglePluginEnabled: vi.fn(),
      }), 'ent-a',
    ))
    expect(withoutNavigator).toBe(android)
  })

  it('carries no device-system projection and no platform word in the leaf or its two consumers (source-level)', async () => {
    const leaf = stripComments(await readFile(new URL('../src/plugin-install-gate.ts', import.meta.url), 'utf8'))
    // 叶里不许再有「设备系统」这一层的任何痕迹：不读 UA、不留设备系统词表、不留到契约平台名的映射。
    for (const banned of [
      'navigator', 'userAgent', 'enterpriseDeviceOs', 'EnterpriseDeviceOs', 'ENTERPRISE_DEVICE_OS_LABEL',
      'enterprisePluginOs', 'EnterprisePluginOs', 'enterprisePluginOsNotice', 'ENTERPRISE_PLUGIN_OS_UNDECLARED',
    ]) {
      expect(leaf, `plugin-install-gate.ts / ${banned}`).not.toContain(banned)
    }
    expect(platformWordsIn(leaf)).toEqual([])
    // 两个消费面同样一个平台词都不许留（口径真源与两处渲染一起过锁）。
    for (const name of ['marketplace-entry.tsx', 'plugin-market.tsx'] as const) {
      const source = stripComments(await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8'))
      expect(platformWordsIn(source), name).toEqual([])
      for (const banned of ['enterpriseDeviceOs', 'enterprisePluginOsNotice', 'enterprisePluginOs(', 'hostOs', 'osNotice']) {
        expect(source, `${name} / ${banned}`).not.toContain(banned)
      }
    }
    // 声明列表不许再拼上屏（数据仍在行上随行携带，但不读、不渲染）。
    const market = stripComments(await readFile(new URL('../src/plugin-market.tsx', import.meta.url), 'utf8'))
    expect(market).not.toContain('operatingSystems.map')
    expect(market).not.toContain('OS[')
  })
})

/* ══════════════════ ★不变式：文案与行为与 OS 声明完全无关 ══════════════════ */

describe('★不变式：installErrorCode 缺席时，插件行的行为与文案与 OS 声明完全无关', () => {
  it('renders the three declaration forms into one and the same row (shape, text, notices, switch props)', () => {
    const rendered = rowsForEachForm(vi.fn())
    expect(rendered).toHaveLength(3)
    const [first, ...rest] = rendered
    for (const current of rest) {
      expect(shapeWithin(current.line), current.form).toBe(shapeWithin(first!.line))
      expect(textWithin(current.line), current.form).toBe(textWithin(first!.line))
      expect(visibleExplanations(current.line), current.form).toEqual([])
      expect(noticesWithin(current.line), current.form).toEqual([])
      // 开关的可拨性、checked 与悬浮说明也逐字相同（过去 `title` 里会多那半句「发布者未声明支持…」）。
      expect(JSON.stringify(switchWithin(current.line)), current.form)
        .toBe(JSON.stringify(switchWithin(first!.line)))
      expect(switchWithin(current.line)!['disabled'], current.form).toBe(false)
      // 已安装 + 启用着 ⇒ 开关的悬浮说明是「点此停用（不会卸载）」——**绝**不是「点此卸载」。
      expect(switchWithin(current.line)!['title'], current.form).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
    }
  })

  it('stays identical across the forms AND across every device user agent (a 3 × 3 matrix)', () => {
    const shapes = new Set<string>()
    const texts = new Set<string>()
    for (const form of DECLARATION_FORMS) {
      for (const [host, userAgent] of DEVICE_UAS) {
        const line = pluginRow(
          EnterpriseMarketLegacyShell(shellProps(userAgent, installed({ operatingSystems: form.operatingSystems }), { onTogglePluginEnabled: vi.fn() })),
          'ent-a',
        )
        shapes.add(shapeWithin(line))
        texts.add(textWithin(line))
        expect(visibleExplanations(line), `${form.name} / ${host}`).toEqual([])
      }
    }
    expect(shapes.size, '九种组合必须收敛成同一棵树').toBe(1)
    expect(texts.size, '不多一个字').toBe(1)
  })

  it('keeps the row facts and the behaviour equal too (the action still really toggles in every form)', () => {
    const onTogglePluginEnabled = vi.fn()
    const facts = DECLARATION_FORMS.map(form => enterpriseMarketPluginRowFacts(
      { view: 'page', onTogglePluginEnabled },
      installed({ operatingSystems: form.operatingSystems }),
    ))
    for (const current of facts.slice(1)) expect(current).toEqual(facts[0])
    expect(facts[0]?.switchDisabled).toBe(false)
    expect(facts[0]?.lockReason).toBeUndefined()
    expect(facts[0]?.slot).toBe('switch')
    expect(facts[0]?.switchTitle).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
    // 行为也一样：三种形态下点「⋯」里那一项都真的走回调（没有任何一条被「声明」这件事挡死）。
    // 已安装 + 启用着 ⇒ 那一项是「停用」，点它就是 `next = !enabled = false`。
    for (const form of DECLARATION_FORMS) {
      const line = pluginRow(
        EnterpriseMarketLegacyShell(shellProps(UA.androidPhone, installed({ operatingSystems: form.operatingSystems }), { onTogglePluginEnabled })),
        'ent-a',
      )
      const toggle = switchWithin(line)!
      expect(toggle['children'], form.name).toBe(ENTERPRISE_MARKET_DISABLE_TEXT)
      ;(toggle['onClick'] as () => void)()
      expect(onTogglePluginEnabled, form.name).toHaveBeenLastCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
    }
    expect(onTogglePluginEnabled).toHaveBeenCalledTimes(DECLARATION_FORMS.length)
  })
})

/* ══════════════════ 「为什么现在动不了」的唯一判定与唯一措辞 ══════════════════ */

describe('「为什么现在动不了」的唯一判定与唯一措辞', () => {
  /** 判定输入的最小底：可拨。 */
  const open = { hasAction: true, state: 'EXPECTED' as const }

  it('folds every disable cause into one reason, with the catalog verdict first', () => {
    expect(enterprisePluginLockReason(open)).toBeUndefined()
    expect(enterprisePluginLockReason({ ...open, installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' })).toBe('incompatible')
    // 目录判定优先于「没写入口」：它带稳定码、带下一步，是更能行动的那一条。
    expect(enterprisePluginLockReason({ ...open, hasAction: false, installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }))
      .toBe('incompatible')
    expect(enterprisePluginLockReason({ ...open, hasAction: false })).toBe('no-entry')
    expect(enterprisePluginLockReason({ ...open, fatal: true })).toBe('fatal')
    for (const state of ENTERPRISE_PLUGIN_IN_FLIGHT_STATES) {
      expect(enterprisePluginLockReason({ ...open, state })).toBe('in-progress')
    }
    expect(enterprisePluginLockReason({ ...open, state: 'ACTIVE' })).toBeUndefined()
    expect(enterprisePluginLockReason({ ...open, state: 'FAILED' })).toBeUndefined()
    expect(enterprisePluginLockReason({ ...open, restartPending: true })).toBe('restart')
    expect(enterprisePluginLockReason({ ...open, busy: true })).toBe('busy')
    // 优先级：状态读不到 > 在途 > 等重启 > 别的操作用着。
    expect(enterprisePluginLockReason({ ...open, fatal: true, state: 'INSTALLING', restartPending: true, busy: true }))
      .toBe('fatal')
    expect(enterprisePluginLockReason({ ...open, state: 'INSTALLING', restartPending: true, busy: true }))
      .toBe('in-progress')
    expect(enterprisePluginLockReason({ ...open, restartPending: true, busy: true })).toBe('restart')
    // 判定输入里根本没有「系统声明」这一格：平台的缺席不是靠传 undefined，而是这一层不收这字段。
    expect(Object.keys(open)).toEqual(['hasAction', 'state'])
  })

  it('gives every lock reason a non-empty visible sentence (except the one the shared notice owns)', () => {
    for (const [reason, text] of Object.entries(ENTERPRISE_PLUGIN_LOCK_NOTICE)) {
      expect(text.length, reason).toBeGreaterThan(8)
      expect(text, reason).not.toContain('ENT_')
      expect(enterprisePluginLockNotice(reason as EnterprisePluginLockReason), reason).toBe(text)
      expect(platformWordsIn(text), reason).toEqual([])
    }
    expect(Object.keys(ENTERPRISE_PLUGIN_LOCK_NOTICE).sort())
      .toEqual(['busy', 'fatal', 'in-progress', 'no-entry', 'restart'])
    // `incompatible` 的那一句由唯一提示组件连原因带下一步一起渲染，这里不产出（免得说两遍）。
    expect(enterprisePluginLockNotice('incompatible')).toBeUndefined()
    expect(enterprisePluginLockNotice(undefined)).toBeUndefined()
    // 悬浮说明是补充，不可能为空、也不提平台。
    for (const [reason, title] of Object.entries(ENTERPRISE_PLUGIN_LOCK_TITLE)) {
      expect(title.length, reason).toBeGreaterThan(2)
      expect(platformWordsIn(title), reason).toEqual([])
    }
    expect(ENTERPRISE_PLUGIN_LOCK_TITLE.incompatible).toBe('该插件当前不可安装')
  })

  it('writes a truthful hover title for both the usable and the locked switch, with no platform half-sentence', () => {
    // ★ 关闭开关＝**停用**：可拨时它说的是「点此停用（不会卸载）」/「点此启用」，
    //   「点此卸载」这种行上说法在本层已经**不存在**（由下面那条反向锁守着）。
    expect(enterprisePluginSwitchTitle({ enabled: true })).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
    expect(enterprisePluginSwitchTitle({ enabled: false })).toBe(ENTERPRISE_PLUGIN_ENABLE_TITLE)
    expect(enterprisePluginSwitchTitle({ enabled: true })).not.toContain('卸载')
    for (const form of DECLARATION_FORMS) {
      expect(enterprisePluginSwitchTitle({ enabled: true }), form.name).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
    }
    expect(enterprisePluginSwitchTitle({ enabled: true, lockReason: 'no-entry' }))
      .toBe(ENTERPRISE_PLUGIN_LOCK_TITLE['no-entry'])
    // 目录判定只进【＋】那一格：title 用该码的**人话**，不是一句「不可安装」了事。
    expect(enterprisePluginInstallTitle({ installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }))
      .toBe(`不可安装：${enterpriseErrorMessage('ENT_PLUGIN_INCOMPATIBLE')}`)
    expect(enterprisePluginInstallTitle({})).toBe(ENTERPRISE_PLUGIN_INSTALL_TITLE)
    // 已安装那一行的开关**不读**目录判定（不可安装 ≠ 不能停用）——它没有这个入参。
    expect(platformWordsIn(enterprisePluginSwitchTitle({ enabled: true, lockReason: 'busy' }))).toEqual([])
    expect(enterprisePluginUninstallTitle({})).toBe(ENTERPRISE_PLUGIN_UNINSTALL_TITLE)
    expect(enterprisePluginUninstallTitle({ lockReason: 'busy' })).toBe(ENTERPRISE_PLUGIN_LOCK_TITLE.busy)
  })
})

/* ══════════════════ 插件行的动作门禁 ══════════════════ */

describe('插件行的动作门禁：分流两块 + 三个坑位各自一条，口径只有一处', () => {
  /** 目录里这一版（旧调用点可能把整版都递进来：多带的 `operatingSystems` 必须被门禁完全忽略）。 */
  const item = {} as { readonly installErrorCode?: string | undefined }
  /** 分流结果的显式读取（写成一个函数只是为了让断言读起来是一句话）。 */
  const plusSlotOf = (gate: { readonly slot: 'install' | 'switch' }): 'install' | 'switch' => gate.slot

  it('gives the not-installed row a ＋ slot and the installed row a switch slot', () => {
    const notInstalled = enterprisePluginRowGate({
      item, state: 'EXPECTED', installed: false, enabled: true,
      restartPending: false, busy: false, fatal: false,
    })
    expect(notInstalled.slot).toBe('install')
    expect(notInstalled.installTitle).toBe(ENTERPRISE_PLUGIN_INSTALL_TITLE)
    // 未安装那一行**不给开关**（分流决定；按钮那一格自带 ＋ 的无障碍名与悬浮说明）。
    expect(plusSlotOf(notInstalled)).toBe('install')
    const done = enterprisePluginRowGate({
      item, state: 'ACTIVE', installed: true, enabled: true,
      restartPending: false, busy: false, fatal: false,
    })
    expect(done.slot).toBe('switch')
    expect(done.switchTitle).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
    // 已停用那一格：同一枚开关，说「点此启用」。
    const disabled = enterprisePluginRowGate({
      item, state: 'ACTIVE', installed: true, enabled: false,
      restartPending: false, busy: false, fatal: false,
    })
    expect(disabled.switchTitle).toBe(ENTERPRISE_PLUGIN_ENABLE_TITLE)
  })

  it('lets the catalog verdict block the ＋ slot but never the switch or the uninstall slot', () => {
    const gate = enterprisePluginRowGate({
      item: { ...item, installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' },
      state: 'ACTIVE', installed: true, enabled: true,
      restartPending: false, busy: false, fatal: false,
    })
    expect(gate.installLock).toBe('incompatible')
    // ★ 已安装那一行的开关与详情页的卸载**都不受**目录判定影响：不可安装 ≠ 不能停用/卸载
    //   （停用与卸载是用户在本机上的自救动作）。
    expect(gate.switchLock).toBeUndefined()
    expect(gate.uninstallLock).toBeUndefined()
    // 安装那一条的可见原因由唯一提示组件说（门禁不自造第二句），悬浮说明带人话。
    expect(gate.installLockNotice).toBeUndefined()
    expect(gate.installTitle).toBe(`不可安装：${enterpriseErrorMessage('ENT_PLUGIN_INCOMPATIBLE')}`)
    expect(gate.uninstallTitle).toBe(ENTERPRISE_PLUGIN_UNINSTALL_TITLE)
  })

  it('blocks all three slots for busy / fatal / restart, each with a visible sentence', () => {
    const cases: readonly [Partial<Parameters<typeof enterprisePluginRowGate>[0]>, EnterprisePluginLockReason | undefined][] = [
      [{ busy: true }, 'busy'],
      [{ fatal: true }, 'fatal'],
      [{ restartPending: true }, 'restart'],
      [{}, undefined],
    ]
    for (const [flags, expected] of cases) {
      const gate = enterprisePluginRowGate({
        item, state: 'ACTIVE', installed: true, enabled: true,
        restartPending: false, busy: false, fatal: false, ...flags,
      })
      expect(gate.installLock, JSON.stringify(flags)).toBe(expected)
      expect(gate.switchLock, JSON.stringify(flags)).toBe(expected)
      expect(gate.uninstallLock, JSON.stringify(flags)).toBe(expected)
      expect(gate.installLockNotice).toBe(enterprisePluginLockNotice(expected))
      expect(gate.switchLockNotice).toBe(enterprisePluginLockNotice(expected))
    }
  })

  it('folds the three declaration forms into one and the same gate, and the card adds no visible note', () => {
    /** 把「目录那一版」整个递进来（含多带的 `operatingSystems`）：门禁必须对它完全无感。 */
    const catalogVersion = (operatingSystems: readonly string[] | undefined): { installErrorCode?: string | undefined } =>
      ({ operatingSystems }) as { installErrorCode?: string | undefined }
    const gates = DECLARATION_FORMS.map(form => enterprisePluginRowGate({
      item: catalogVersion(form.operatingSystems),
      state: 'EXPECTED', installed: false, enabled: true,
      restartPending: false, busy: false, fatal: false,
    }))
    for (const current of gates.slice(1)) expect(current).toEqual(gates[0])
    // 控件**保持可用**：没有禁用原因，也没有多出来的那句可见提示（三种形态都是）。
    for (const [index, gate] of gates.entries()) {
      const form = DECLARATION_FORMS[index]!
      expect(gate.installLock, form.name).toBeUndefined()
      expect(gate.installLockNotice, form.name).toBeUndefined()
      expect(gate.installTitle, form.name).toBe(ENTERPRISE_PLUGIN_INSTALL_TITLE)
      expect(EnterprisePluginGateNotes({ gate, subject: 'ent-a' }), form.name).toBeNull()
    }
    // 有禁用原因时那枚子块照旧出可见的一句（不是被减法顺手拆掉的）。
    // 目录判定（`incompatible`）的可见交代归唯一提示组件，故这里用一条自带可见句的原因来证子块还在干活。
    const locked = enterprisePluginRowGate({
      item, state: 'ACTIVE', installed: true, enabled: true,
      restartPending: false, busy: true, fatal: false,
    })
    expect(locked.switchLock).toBe('busy')
    expect(locked.installLock).toBe('busy')
    expect(textWithin(EnterprisePluginGateNotes({ gate: locked, subject: 'ent-a' })))
      .toBe(ENTERPRISE_PLUGIN_LOCK_NOTICE.busy)
    expect(platformWordsIn(textWithin(EnterprisePluginGateNotes({ gate: locked, subject: 'ent-a' })))).toEqual([])
  })
})

/* ══════════════════ 目录行渲染：installErrorCode × 声明形态 ══════════════════ */

describe('目录行渲染：installErrorCode 与声明形态的组合', () => {
  it('carries the declared systems from the catalog onto the row as data (kept, but never judged)', () => {
    const rows = enterpriseMarketPluginRows([
      { pluginVersionId: 'v1', packageName: 'ent-a', version: '1.2.0', sizeBytes: 1024, operatingSystems: ['darwin', 'linux', 'win32'] },
    ])
    expect(rows[0]?.operatingSystems).toEqual(['darwin', 'linux', 'win32'])
    // 本机记录独有（已下架）时没有该字段 → 行上同样是 undefined，三种形态因此都可能出现。
    const localOnly = enterpriseMarketPluginRows([], [
      { packageName: 'ent-b', version: '1.0.0', desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null },
    ])
    expect(localOnly[0]?.operatingSystems).toBeUndefined()
  })

  it('also answers the same question through the pure row facts (any caller, any shape of the declaration)', () => {
    const factsOf = (operatingSystems: readonly string[] | undefined) => enterpriseMarketPluginRowFacts(
      { view: 'page', onInstallPlugin: vi.fn(), onTogglePluginEnabled: vi.fn() },
      installed({ operatingSystems }),
    )
    const [declared, undeclared, absent] = DECLARATION_FORMS.map(form => factsOf(form.operatingSystems))
    expect(undeclared).toEqual(declared)
    expect(absent).toEqual(declared)
    expect(declared?.slot).toBe('switch')
    expect(declared?.installed).toBe(true)
    expect(declared?.switchDisabled).toBe(false)
    expect(declared?.installDisabled).toBe(false)
    expect(declared?.lockReason).toBeUndefined()
    expect(declared?.lockNotice).toBeUndefined()
    expect(declared?.switchTitle).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
  })

  it('renders the row identically for every declaration form, with no platform word on screen', () => {
    const rendered = rowsForEachForm(vi.fn())
    for (const current of rendered) {
      const toggle = switchWithin(current.line)!
      expect(toggle['disabled'], current.form).toBe(false)
      expect(toggle['title'], current.form).toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
      expect(visibleExplanations(current.line), current.form).toEqual([])
      // 可见文案（不是 title、不是属性）里一个平台词都没有，也没有任何「不能安装」的噪音。
      expect(platformWordsIn(textWithin(current.line)), current.form).toEqual([])
      expect(textWithin(current.line), current.form).not.toContain('这里暂时不能安装')
      expect(textWithin(current.line), current.form).not.toContain('未声明')
    }
    // 点一下就真的走回调（启停没被「声明形态」这件事挡死）。
    ;(switchWithin(rendered[1]!.line)!['onClick'] as () => void)()
  })

  it('keeps the whole catalog page free of platform words, whichever declaration the catalog carries', () => {
    for (const form of DECLARATION_FORMS) {
      const tree = EnterpriseMarketLegacyShell(shellProps(
        UA.androidPhone, installed({ operatingSystems: form.operatingSystems }), { onTogglePluginEnabled: vi.fn() },
      ))
      expect(platformWordsIn(textWithin(tree)), form.name).toEqual([])
    }
  })

  it('shows the catalog verdict as a visible sentence plus next step, and disables the ＋ slot', () => {
    const props = shellProps(
      UA.androidPhone,
      row({ operatingSystems: ['darwin', 'win32'], installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }),
      { onInstallPlugin: vi.fn() },
    )
    const line = pluginRow(EnterpriseMarketLegacyShell(props), 'ent-a')
    // 未安装那一行给的是【＋】：目录判定禁用的正是它，行上根本没有开关。
    expect(switchWithin(line)).toBeUndefined()
    expect(plusWithin(line)!['disabled']).toBe(true)
    expect(plusWithin(line)!['title']).toBe(`不可安装：${enterpriseErrorMessage('ENT_PLUGIN_INCOMPATIBLE')}`)
    const explanations = visibleExplanations(line)
    expect(explanations).toHaveLength(1)
    // 员工看得见：人话 +「下一步：」；稳定码只待在「技术信息」折叠区里。
    expect(explanations[0]).toContain('这个插件与当前客户端不兼容。')
    expect(explanations[0]).toContain('下一步：')
    expect(explanations[0]).toContain('请联系企业管理员更换版本。')
    expect(explanations[0]).not.toContain('ENT_')
    // 有稳定码时不再叠第二句（同一件事不说两遍）。
    expect(textWithin(line)).not.toContain('未声明')
    // 终态不可重试：不给假重试。
    expect(enterpriseErrorRetryable('ENT_PLUGIN_INCOMPATIBLE')).toBe(false)
    expect(textWithin(line)).not.toContain('重新检查这个插件能不能装')
  })

  it('offers a real retry only when the code is retryable and the re-fetch callback exists', () => {
    const onRetryPlugins = vi.fn()
    const retryable = 'ENT_PLUGIN_DOWNLOAD_FAILED'
    expect(enterpriseErrorRetryable(retryable)).toBe(true)
    const props = shellProps(
      UA.androidPhone,
      row({ installErrorCode: retryable }),
      { onInstallPlugin: vi.fn(), onRetryPlugins },
    )
    const line = pluginRow(EnterpriseMarketLegacyShell(props), 'ent-a')
    const retryButton = (node: ReactNode): Record<string, unknown> | undefined => {
      let found: Record<string, unknown> | undefined
      walkTree(node, element => {
        if (element.props['aria-label'] === ENTERPRISE_PLUGIN_BLOCKED_RETRY_LABEL) found = element.props
      })
      return found
    }
    const retry = retryButton(line)
    expect(retry, '可重试的码必须给一个能走的动作').toBeDefined()
    ;(retry?.['onClick'] as () => void)()
    expect(onRetryPlugins).toHaveBeenCalledTimes(1)
    // 没有重取回调就不渲染那枚按钮（不给死按钮）。
    const noCallback = EnterpriseMarketLegacyShell(shellProps(
      UA.androidPhone,
      row({ installErrorCode: retryable }),
      { onInstallPlugin: vi.fn() },
    ))
    expect(retryButton(pluginRow(noCallback, 'ent-a'))).toBeUndefined()
  })
})

/* ══════════════════ 反向锁一：禁用即须有可见说明 ══════════════════ */

describe('反向锁：插件行的禁用态必须带可见说明，不许只挂 title', () => {
  /**
   * 每一种「动不了 / 用得了」的现场，**按分流分别列**：未安装那一格给 ＋、已安装那一格给开关。
   * 两个槽位各自守自己那条反向锁（`slot` 就是分流结果本身）。
   */
  const scenarios: readonly {
    readonly name: string
    readonly row: EnterpriseMarketPluginRow
    readonly slot: 'install' | 'switch'
    readonly writeAction?: boolean
  }[] = [
    // 未安装 ⇒ 【＋】（安装那一格；目录判定正是拦它的那一条）
    { name: '未安装·目录判定不可安装', row: row({ installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }), slot: 'install', writeAction: true },
    { name: '未安装·没有写入口', row: row(), slot: 'install' },
    { name: '首次安装中（本机还没有落盘版本）', row: row({ state: 'INSTALLING', desiredState: 'INSTALLED', recordVersion: null }), slot: 'install', writeAction: true },
    { name: '首次下载中（本机还没有落盘版本）', row: row({ state: 'DOWNLOADING', desiredState: 'INSTALLED', recordVersion: null }), slot: 'install', writeAction: true },
    // 已安装 ⇒ 【开关】（启用/停用那一格；目录判定**不**进来）
    { name: '已安装·目录判定不可安装（仍要能停用）', row: installed({ installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }), slot: 'switch', writeAction: true },
    { name: '已安装·没有写入口', row: installed(), slot: 'switch' },
    { name: '已安装·正在安装', row: installed({ state: 'INSTALLING' }), slot: 'switch', writeAction: true },
    { name: '已安装·正在卸载', row: installed({ state: 'REMOVING' }), slot: 'switch', writeAction: true },
    { name: '已安装·切换版本', row: installed({ state: 'ROLLBACK' }), slot: 'switch', writeAction: true },
    { name: '已安装·一切正常（应保持可用）', row: installed(), slot: 'switch', writeAction: true },
    { name: '已安装·已停用（应保持可用）', row: installed({ enabled: false }), slot: 'switch', writeAction: true },
    { name: '未安装·声明不含当前平台（应保持可用）', row: row({ operatingSystems: ['darwin', 'win32'] }), slot: 'install', writeAction: true },
    { name: '未安装·声明根本没有该字段（应保持可用）', row: row({ operatingSystems: undefined }), slot: 'install', writeAction: true },
  ]

  it('gives every disabled control an explained row, and keeps every unlocked control usable', () => {
    for (const scenario of scenarios) {
      for (const [host, userAgent] of DEVICE_UAS) {
        const extra = scenario.writeAction === true
          ? { onInstallPlugin: vi.fn(), onTogglePluginEnabled: vi.fn() }
          : {}
        const line = pluginRow(EnterpriseMarketLegacyShell(shellProps(userAgent, scenario.row, extra)), 'ent-a')
        // 分流两块各取各的：未安装 ⇒ 安装按钮（槽位属性）；已安装 ⇒ 「⋯」里的启停项。
        const control = scenario.slot === 'switch' ? switchWithin(line) : plusWithin(line)
        const where = `${scenario.name} / ${host}`
        expect(control, `${where}：分流到 ${scenario.slot} 那一格必须有控件`).toBeDefined()
        // 另一格必须**不**存在（未安装不给启停项、已安装不给安装按钮）。
        if (scenario.slot === 'switch') {
          expect(plusWithin(line), `${where}：出现了不该出现的控件`).toBeUndefined()
        } else {
          expect(switchWithin(line), `${where}：出现了不该出现的控件`).toBeUndefined()
        }
        if (control!['disabled'] === true) {
          // 反向锁的核心：被禁用 ⇒ 行里必须有一个**非空**的可见说明（只挂 title 一律判红）。
          expect(visibleExplanations(line).length, `${where}：禁用了却只有 title`).toBeGreaterThan(0)
          // 而且 title 不能说「点此安装 / 点此停用 / 点此启用」那种「看起来能用」的话。
          expect(String(control!['title']), where).not.toBe(ENTERPRISE_PLUGIN_INSTALL_TITLE)
          expect(String(control!['title']), where).not.toBe(ENTERPRISE_PLUGIN_DISABLE_TITLE)
          expect(String(control!['title']), where).not.toBe(ENTERPRISE_PLUGIN_ENABLE_TITLE)
        } else {
          // 可用 ⇒ 这一格不许多一句「不能安装」的噪音。
          expect(textWithin(line), where).not.toContain('这里暂时不能安装')
          // 「下一步：」那一句只属于**目录判定**（`installErrorCode`）的唯一提示组件；
          // 没有该码的行上不该出现任何带「下一步」的提示（上面那条就是它在合法情形下的出口）。
          if (scenario.row.installErrorCode === undefined) {
            expect(noticesWithin(line).some(text => text.includes('下一步：')), where).toBe(false)
          }
        }
      }
    }
  })

  it('would catch the old dead-control shape: the predicate is false for a title-only disabled action', () => {
    // 反例树：一枚禁用 + 只挂 title 的动作（就是「死控件」那一行的形状）。判据必须对它是空的——
    // 否则上面那条反向锁就是空转。
    const deadControl = createElement(
      'li',
      { className: 'own-market-row', 'data-enterprise-plugin-package': 'ent-a' },
      createElement('button', {
        className: 'own-market-moreItem', disabled: true, title: '该插件当前不可安装',
        onClick: () => undefined, 'data-enterprise-plugin-slot': 'switch',
      }, ENTERPRISE_MARKET_DISABLE_TEXT),
    )
    expect(switchWithin(deadControl)?.['disabled']).toBe(true)
    // 它自己的动作文案（「停用」）照样在——但那**不是**「为什么动不了」的解释，故判据必须仍然为空。
    expect(textWithin(deadControl)).toBe(ENTERPRISE_MARKET_DISABLE_TEXT)
    expect(visibleExplanations(deadControl)).toEqual([])
    // 同一判据在真实行上成立（说明它确实在测「有没有可见说明」）。
    const line = pluginRow(EnterpriseMarketLegacyShell(shellProps(
      UA.androidPhone, installed({ state: 'INSTALLING' }), {
        onInstallPlugin: vi.fn(), onTogglePluginEnabled: vi.fn(),
      },
    )), 'ent-a')
    expect(switchWithin(line)!['disabled']).toBe(true)
    expect(visibleExplanations(line)).toEqual([ENTERPRISE_PLUGIN_LOCK_NOTICE['in-progress']])
  })

  it('keeps both renderings on the single shared vocabulary (source-level lock)', async () => {
    for (const name of ['marketplace-entry.tsx', 'plugin-market.tsx'] as const) {
      const source = stripComments(await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8'))
      expect(source, name).toContain("from './plugin-install-gate.js'")
      for (const shared of [
        'enterprisePluginLockReason(', 'enterprisePluginLockNotice(', 'enterprisePluginSwitchTitle(',
        // 分流也读同一枚真源（哪一格给 ＋ / 哪一格给开关）。
        'enterprisePluginInstalled(',
      ]) {
        expect(source, `${name} / ${shared}`).toContain(shared)
      }
      // 旧写法（禁用 + 只有一句 title）不许留下任何痕迹。
      expect(source, name).not.toContain("'该插件当前不可安装'")
      expect(source, name).not.toContain('installErrorCode !== undefined ?')
      expect(source, name).not.toContain('|| item.installErrorCode !== undefined ||')
    }
    // 两处渲染都从同一枚判定取禁用结果（不再是各写一串 `||`）。
    expect(stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')))
      .toContain('switchDisabled: switchLockReason !== undefined')
    expect(stripComments(await readFile(new URL('../src/plugin-market.tsx', import.meta.url), 'utf8')))
      .toContain('disabled={gate.installLock !== undefined}')
    // 那一句唯一措辞只准待在口径真源里。
    expect(await readFile(new URL('../src/plugin-install-gate.ts', import.meta.url), 'utf8'))
      .toContain("'该插件当前不可安装'")
  })
})

/* ══════════════════ 反向锁二：可见文案里不得出现平台词 ══════════════════ */

describe('反向锁：插件行可见文案里不得出现平台词', () => {
  it('never puts a platform word into the row for any declaration form or device (the words are the leaf\'s, not the row\'s)', () => {
    for (const form of DECLARATION_FORMS) {
      for (const [host, userAgent] of DEVICE_UAS) {
        const line = pluginRow(
          EnterpriseMarketLegacyShell(shellProps(
            userAgent, installed({ operatingSystems: form.operatingSystems }), { onTogglePluginEnabled: vi.fn() },
          )),
          'ent-a',
        )
        const where = `${form.name} / ${host}`
        // 判据自证：可见文本里确实有字（不是拿空串过锁），且一个平台词都没有。
        expect(textWithin(line).length, where).toBeGreaterThan(0)
        expect(platformWordsIn(textWithin(line)), where).toEqual([])
        // 连被禁用的那几行（情形 A / 情形 C）也一起过锁：提示里同样不许出现平台词。
        const lockedLine = pluginRow(
          EnterpriseMarketLegacyShell(shellProps(userAgent, installed({
            operatingSystems: form.operatingSystems, installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE',
          }), { onTogglePluginEnabled: vi.fn() })),
          'ent-a',
        )
        expect(platformWordsIn(textWithin(lockedLine)), `${where} / 情形 A`).toEqual([])
      }
    }
    // 判据自证：把平台词塞进可见文本，判据必须报出来（否则上面全是空转）。
    expect(platformWordsIn('发布者未声明支持 Android，仍可安装。')).toEqual(['Android'])
    expect(platformWordsIn('系统：macOS / Windows / Linux · 1024 KiB')).toEqual(['macOS', 'Windows', 'Linux'])
    expect(platformWordsIn('darwin / win32')).toEqual(['darwin', 'win32'])
    // 行上的开关 `title` 也一并过锁（属性不算可见文案，但它更不该带平台词）。
    expect(platformWordsIn(String(switchWithin(rowsForEachForm(vi.fn())[0]!.line)!['title']))).toEqual([])
  })

  it('cannot even reach the screen from plugin-market: the card row and the detail list no longer render the declaration', async () => {
    const market = stripComments(await readFile(new URL('../src/plugin-market.tsx', import.meta.url), 'utf8'))
    // 该组件含 hook、本仓无 react-dom 不能整树直调，故按源码锁住「不可能产出平台词」：
    // 既没有平台词字面量，也没有把声明列表拼上屏的写法。
    expect(platformWordsIn(market)).toEqual([])
    expect(market).not.toContain('operatingSystems')
    // 详情弹窗里那格「系统」也整条退场（平台彻底退出决策面，界面不出现平台词）。
    expect(market).not.toContain('系统')
    // 该文件里唯一产可见文案的两处（行上说明、悬浮说明）都来自同一份平台无关的口径真源。
    const gate = enterprisePluginRowGate({
      item: { installErrorCode: undefined }, state: 'EXPECTED', restartPending: false, busy: false, fatal: false,
    })
    expect(EnterprisePluginGateNotes({ gate, subject: 'ent-a' })).toBeNull()
    expect(platformWordsIn(gate.installTitle)).toEqual([])
    expect(platformWordsIn(gate.uninstallTitle)).toEqual([])
  })
})

/* ══════════════════ 反向锁三：动作分流的三条硬口径（用户明确纠正过的语义） ══════════════════ */

describe('反向锁：插件行动作分流——＋ / 开关 / 卸载三件不许串台', () => {
  it('未安装的行**给【＋】、不给开关**（开关一律不出现在未安装那一格）', () => {
    for (const notInstalled of [
      row(),
      // 一次**失败**的首次安装：desiredState 说「该装着」、但本机还没有落盘版本 ⇒ 仍是未安装那一格。
      row({ state: 'FAILED', desiredState: 'INSTALLED', recordVersion: null }),
      row({ state: 'INSTALLING', desiredState: 'INSTALLED', recordVersion: null }),
      row({ state: 'REMOVING', desiredState: 'ABSENT' }),
      row({ installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }),
    ]) {
      const line = pluginRow(EnterpriseMarketLegacyShell(shellProps(
        UA.androidPhone, notInstalled, { onInstallPlugin: vi.fn(), onTogglePluginEnabled: vi.fn() },
      )), 'ent-a')
      expect(switchWithin(line), `${notInstalled.state}/${String(notInstalled.desiredState)} 不该有开关`).toBeUndefined()
      expect(plusWithin(line), `${notInstalled.state} 该给一枚 ＋`).toBeDefined()
      // ＋ 的语义由无障碍名承载（可见文案只有一枚 ＋）。
      expect(plusWithin(line)!['aria-label']).toBe(enterprisePluginInstallLabel('ent-a'))
    }
    // 分流判定本身也直接过一遍（行渲染之外的第二条腿）。
    expect(enterprisePluginRowAction({ desiredState: 'INSTALLED', version: null, state: 'FAILED' })).toBe('install')
    expect(enterprisePluginRowAction({ state: 'EXPECTED' })).toBe('install')
    expect(enterprisePluginRowAction({ state: 'ACTIVE' })).toBe('switch')
  })

  it('已安装的行**给启停项、不给安装按钮**（装上之后就没有安装那一格了）', () => {
    for (const done of [
      installed(),
      installed({ enabled: false }),
      installed({ installErrorCode: 'ENT_PLUGIN_INCOMPATIBLE' }),
      installed({ inCatalog: false }),
      installed({ state: 'RESTART_REQUIRED' }),
    ]) {
      const line = pluginRow(EnterpriseMarketLegacyShell(shellProps(
        UA.androidPhone, done, { onInstallPlugin: vi.fn(), onTogglePluginEnabled: vi.fn() },
      )), 'ent-a')
      expect(plusWithin(line), `${done.state} 不该有安装按钮（已安装那一格给的是启停项）`).toBeUndefined()
      expect(switchWithin(line), `${done.state} 该给一枚启停项`).toBeDefined()
    }
    // 已安装 + 启用着 ⇒ 那一项是「停用」；已停用 ⇒ 那一项是「启用」（文案就是**启停位**本身）。
    const on = pluginRow(EnterpriseMarketLegacyShell(shellProps(
      UA.androidPhone, installed(), { onTogglePluginEnabled: vi.fn() },
    )), 'ent-a')
    expect(switchWithin(on)!['children']).toBe(ENTERPRISE_MARKET_DISABLE_TEXT)
    const off = pluginRow(EnterpriseMarketLegacyShell(shellProps(
      UA.androidPhone, installed({ enabled: false }), { onTogglePluginEnabled: vi.fn() },
    )), 'ent-a')
    expect(switchWithin(off)!['children']).toBe(ENTERPRISE_MARKET_ENABLE_TEXT)
    // 已停用那一行的可见状态词是「已安装 · 已停用」——收敛到唯一那份词表，不是另造一句。
    expect(textWithin(off)).toContain(enterprisePluginInstalledStatusLabel(false))
    expect(enterprisePluginInstalledStatusLabel(false)).toBe('已安装 · 已停用')
  })

  it('★关闭开关＝**停用**，绝不等于卸载：点「停用」只叫停用那条路，行上一个「卸载」字都没有', async () => {
    const onTogglePluginEnabled = vi.fn()
    const line = pluginRow(EnterpriseMarketLegacyShell(shellProps(
      UA.androidPhone, installed(), { onInstallPlugin: vi.fn(), onTogglePluginEnabled },
    )), 'ent-a')
    // ① 行为：点「停用」走的是「停用」那一条回声（分发到 `onTogglePluginEnabled(row,false)`），
    //    这条路上根本没有卸载动作可走——`onInstallPlugin`（装/更新）一次都不该被叫。
    const toggle = switchWithin(line)!
    expect(toggle['children']).toBe(ENTERPRISE_MARKET_DISABLE_TEXT)
    ;(toggle['onClick'] as () => void)()
    expect(onTogglePluginEnabled).toHaveBeenCalledTimes(1)
    expect(onTogglePluginEnabled).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
    // ② 源码：**插件**这一条链上「点此卸载」那种行上说法已整段退场（先剥注释：文件头会如实引用旧说法）。
    for (const name of ['plugin-install-gate.ts', 'plugin-market.tsx'] as const) {
      expect(stripComments(await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')), name)
        .not.toContain('点此卸载')
    }
    // `marketplace-entry.tsx` 里那两条仍各归各的行（技能行没有启停位，它的动作本来就是装/卸）——
    // 所以这里按**插件链**锁：插件那一项读的是 `facts.switchTitle`（口径真源），不是技能那条路径。
    const marketSource = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(marketSource).toContain('title: facts.switchTitle')
    expect(marketSource).toContain('enterprisePluginSwitchTitle')
    // 插件那一项的 `onSelect` 只走「启用/停用」，绝不走卸载。
    expect(marketSource).toContain('onToggleEnabled?.(!facts.enabled)')
    // ③ 源码：插件行那一处启停写入口**只**调 `setPluginEnabled`。
    const market = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(market).toContain('store!.setPluginEnabled(row.packageName, next)')
    // ④ 源码：停用那一支的失败前缀是「停用失败」，不是「卸载失败」。
    expect(market).toContain("return '停用失败'")
  })

  it('★【卸载】只在两处可达：市场行的「⋯」（非内置）与设置页详情的确认动作', async () => {
    // ① 插件市场的行**确实**有卸载入口（本刀：菜单项「卸载」，与「企业设置 → 插件」详情共用同一个写入口），
    //    但它**只给非内置项**（`enterpriseMarketPluginBuiltin`：仍由企业目录提供 = 后台分配/预置 = 内置，动不了）。
    const market = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect((market.match(/\.removePlugin\(/g) ?? [])).toHaveLength(1)
    // 列表行**没有**确认弹层（卸载确认只在设置页详情那一面）。
    expect(market).not.toContain('确认卸载')
    expect(market).not.toContain('<ConfirmAction')
    expect(market).toContain('builtin ? [] : [')
    // ② 「企业设置 → 插件」：`store.removePlugin` 全文件**只有一处**，且落在详情那一支里（列表行不给）。
    const card = stripComments(await readFile(new URL('../src/plugin-market.tsx', import.meta.url), 'utf8'))
    expect((card.match(/store\.removePlugin\(/g) ?? [])).toHaveLength(1)
    const detailStart = card.indexOf('const detailActions = (name: string)')
    const rowStart = card.indexOf('const rowActions = (name: string)')
    expect(detailStart, '详情那一支的写入口').toBeGreaterThan(0)
    expect(rowStart, '列表行那一支的写入口').toBeGreaterThan(0)
    // 卸载那一次调用必须在 `detailActions` 里、在 `rowActions` 之后（即**不在**列表行那一支里）。
    expect(card.indexOf('store.removePlugin(')).toBeGreaterThan(detailStart)
    expect(card.indexOf('store.removePlugin(')).toBeGreaterThan(rowStart)
    // 列表行那一支里没有任何卸载措辞；详情那一支带确认与「说清影响」的原句。
    const rowBody = card.slice(rowStart, detailStart)
    expect(rowBody).not.toContain('卸载')
    expect(card).toContain('ENTERPRISE_PLUGIN_UNINSTALL_IMPACT')
    expect((card.match(/<ConfirmAction/g) ?? [])).toHaveLength(1)
    // ③ 三处渲染的分流都读同一枚真源（不是各写一个 `state === 'ACTIVE'`）。
    for (const source of [market, card]) expect(source).toContain('enterprisePluginInstalled(')
  })
})
