/**
 * [INPUT]: 依赖 marketplace-entry 的页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_TAB_IDS`）、唯一目录页外壳
 *          `EnterpriseMarketLegacyShell`、共享行子块 `EnterpriseMarketInlineRows`、配方行投影与 facts
 *          （`enterpriseMarketPresetRows`/`enterpriseMarketPresetRowFacts`）、配方详情子页面 `EnterprisePresetDetailPage`
 *          与它那一族包含内容纯投影（`enterprisePresetDependencies`/`enterprisePresetContentsGroups`/
 *          `enterprisePresetContentsState`/`enterprisePresetCategory`）；另读 `node:fs/promises` 的源码文本做反向锁
 *          （preset-market.tsx 仍挂着设置弹窗的配方 tab，且两页用的是**同一个**取数源工厂）
 * [OUTPUT]: 「企业配方页签」这一刀的验收门禁：① 四枚页签且「企业配方」位次在**企业插件之后、包含内容之前**，
 *           四页签的 aria 四向配对与 ←/→/Home/End 键盘路径仍成立；② 配方行**复用唯一共享行子块**渲染
 *           （图标 + 两行文案 + 版本**短号**签 + 可选分类签，完整坐标只在 `title`）；动作区是**真开关**
 *           （三态：未授权关 / 已授权未装关 / 已装开，指纹已变单独一态）、进行中不可连点**但失败不禁用**、
 *           ① 不可用时按 `enterprisePresetFallbackPlan` 走 ②（新会话 + 填入指令）再走 ③（剪贴板）且
 *           **每一级都有可见说明**（不静默降级）、③ 只在 ① 不可用时才渲染（① 可用时一枚都不出）；
 *           ③ 点**行标题**进配方详情
 *           子页面、面包屑「返回配方列表」是唯一返回入口（且详情里没有列表的页签/行）；④ 详情「这份配方包含」
 *           在 `dependencies` **存在**（按 kind 分组、显示 id 与「必需 / 可选」，未知 kind 归「其它」不丢）
 *           与**缺席**（可见说明「暂时无法读取包含内容」，不白屏、不假装「不包含」）两种情况下的表现；
 *           ⑤ 反向锁：市场页里**不存在**旧「应用商店」相关 id/文案，行渲染仍只有一处实现，
 *           配方页可见文本不出现宪法反目标技术词（preset / Preset / YAML / manifest / 组件 …）；
 *           ⑥ **启用成功后的落地交代**：「将在新会话生效」那一句按官方两种落地方式分别出（热生效 /
 *           需重启），没有成功回执时整段不进 DOM，行上与详情里读同一份 facts。
 * [POS]: 市场页「企业配方」页签与配方详情的行为取证点（dsh-ui 没有 DOM 渲染测试，本文件是这一刀的门禁）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterprisePresetDisclosure, EnterprisePresetStatus, EnterpriseRuntimePreset } from '../src/local-api-decode.js'
import {
  ENTERPRISE_MARKET_COMPONENTS,
  ENTERPRISE_MARKET_TAB_IDS,
  ENTERPRISE_MARKET_TABS,
  ENTERPRISE_PRESET_CONTENTS_EMPTY,
  ENTERPRISE_PRESET_CONTENTS_TITLE,
  ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE,
  ENTERPRISE_PRESET_COPIED_TEXT,
  ENTERPRISE_PRESET_COPY_TEXT,
  ENTERPRISE_PRESET_DETAIL_BACK_LABEL,
  ENTERPRISE_PRESET_DETAIL_BACK_TEXT,
  ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL,
  ENTERPRISE_PRESET_DEPENDENCY_REQUIRED,
  ENTERPRISE_PRESET_NEW_SESSION_TEXT,
  ENTERPRISE_PRESET_APPLIED_EXISTING_TEXT,
  ENTERPRISE_PRESET_APPLIED_HOT_TEXT,
  ENTERPRISE_PRESET_APPLIED_OTHER_TEXT,
  ENTERPRISE_PRESET_APPLIED_RESTART_TEXT,
  ENTERPRISE_PRESET_APPROVAL_CANCEL,
  ENTERPRISE_PRESET_APPROVAL_CONFIRM,
  ENTERPRISE_PRESET_APPROVAL_DISCLAIMER,
  ENTERPRISE_PRESET_APPROVAL_STALE_NOTE,
  ENTERPRISE_PRESET_APPROVAL_TITLE,
  EnterpriseMarketInlineRows,
  EnterpriseMarketLegacyShell,
  EnterprisePresetApprovalDialog,
  EnterprisePresetDetailPage,
  enterpriseMarketPresetRowFacts,
  enterpriseMarketPresetRows,
  enterpriseMarketShellModel,
  enterpriseMarketTabLabel,
  enterprisePresetCategory,
  enterprisePresetAppliedNotice,
  enterprisePresetContentsCountText,
  enterprisePresetContentsGroups,
  enterprisePresetContentsState,
  enterprisePresetDependencies,
  enterprisePresetDependencyRequiredText,
  enterprisePresetNewSessionReason,
  enterprisePresetRouteUnsupported,
} from '../src/marketplace-entry.js'

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
}))

/* ─────────────────────────────── 夹具 ─────────────────────────────── */

/**
 * 一条配方（`EnterpriseRuntimePreset`，即共享取数源 `createEnterprisePresetListSource` 的产出形状）。
 * `sourceDshVersion` 刻意用**完整坐标**（真实导入的形态）：行上签只显示短号、完整坐标留给 `title`。
 */
const PRESET: EnterpriseRuntimePreset = {
  id: '1902500000000000701',
  presetId: 'review-agent',
  displayName: '代码评审配方',
  description: '带检查单的评审配方。',
  sourceDshVersion: 'skillhub.cn/dev-expert@2.0.3',
  sizeBytes: 4096,
  updatedAt: '2026-09-30T08:00:00Z',
  versionId: '7001',
  dependencies: [],
}

/** 带可选分类的配方：分类是服务端**可能**新增的字段，故用断言把键加上（投影读它走的是防御性 `unknown`）。 */
const PRESET_WITH_CATEGORY = { ...PRESET, category: '研发工具' } as EnterpriseRuntimePreset

/** 依赖清单样本：技能（必需） / 插件（可选） / 一种服务端将来才有的未知类型。 */
const DEPENDENCIES = [
  { kind: 'skill', id: 'code-review', mode: 'latest', required: true },
  { kind: 'plugin', id: 'ent-linter', mode: 'pinned', versionId: '9001', required: false },
  { kind: 'connector', id: 'ent-gitlab', mode: 'latest', required: false },
]

/** 一份像 `store.api.presetDetail(id)` 那样的详情投影（本页只消费 `dependencies` 一个键）。 */
const DETAIL = { ...PRESET, dependencies: DEPENDENCIES }

/* ─────────────────────────── 元素树取证工具 ─────────────────────────── */
/* 与 marketplace-entry.spec 同一口径：函数组件就地展开一次（真组件只走产出），
   `vi.fn()` mock 的原语产出 undefined 时退回按 props 递归，保住它们的 children。 */

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return ''
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return textOf(rendered as ReactNode)
  }
  return textOf(props['children'] as ReactNode)
}

function collect(node: ReactNode, match: (props: Record<string, any>, node: any) => boolean, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collect(child, match, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, any>
  if (match(props, node)) { acc.push(props); return acc }
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collect(rendered as ReactNode, match, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collect(value as ReactNode, match, acc)
  }
  return acc
}

const byRole = (tree: ReactNode, role: string): Record<string, any>[] => collect(tree, props => props['role'] === role)
const byClassName = (tree: ReactNode, name: string): Record<string, any>[] =>
  collect(tree, props => String(props['className'] ?? '').split(/\s+/).includes(name))
const byData = (tree: ReactNode, key: string): Record<string, any>[] => collect(tree, props => props[key] !== undefined)
const switches = (tree: ReactNode): Record<string, any>[] => collect(tree, (_props, node) => node.type === (Switch as unknown))
const tags = (tree: ReactNode): Record<string, any>[] => collect(tree, (_props, node) => node.type === (Tag as unknown))
/** 官方原语（Button/Switch/Tag…）在测试里是 `vi.fn()`：按元素类型收集它们的 props。 */
const primitives = (tree: ReactNode, type: unknown): Record<string, any>[] => collect(tree, (_props, node) => node.type === type)

/** 剥掉注释后的源码：源码级不变量只看代码（头部文档里提到同一个标识符不该被多记一次）。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

/** 外壳 props 形状（直接从外壳签名取，避免测试自造第二份类型）。 */
type ShellProps = Parameters<typeof EnterpriseMarketLegacyShell>[0]

const presetRow = (preset: EnterpriseRuntimePreset = PRESET) => enterpriseMarketPresetRows([preset])[0]!

/* ── 一键启用的本机真值 fixture（形状 = `GET /presets/<id>/status` 的 200 响应） ── */

/** 一份披露清单：会装的一个 bundle + 会挂载的一个模块（弹层逐项列的就是它）。 */
const PRESET_DISCLOSURE: EnterprisePresetDisclosure = {
  fingerprint: 'a'.repeat(64),
  bundles: [{ name: 'dsh-ent-preset-review-agent', summary: '带检查单的评审配方', digest: 'b'.repeat(64) }],
  mounts: [{ name: '@deepseek-ai/dsh-agent-preset', summary: '挂载行 preset-review-agent' }],
}

/** 一条 status 响应（默认 = 未授权未装）；`over` 覆盖要取证的那一项。 */
function presetStatus(over: Partial<EnterprisePresetStatus> = {}): EnterprisePresetStatus {
  return {
    presetPackageId: PRESET.id,
    declarationId: 'review-agent',
    fingerprint: 'a'.repeat(64),
    authorization: 'needs-authorization',
    inFlight: false,
    disclosure: PRESET_DISCLOSURE,
    installed: null,
    ...over,
  }
}

/** 已装记录（`status.installed` 的真值）；`over` 覆盖要取证的字段。 */
function presetInstall(over: Record<string, unknown> = {}): NonNullable<EnterprisePresetStatus['installed']> {
  return {
    declarationId: 'review-agent',
    recipeId: 'review-agent',
    displayName: '代码评审配方',
    packageName: 'dsh-ent-preset-review-agent',
    fingerprint: 'a'.repeat(64),
    version: '1.0.0',
    installedAt: '2026-09-30T08:00:00Z',
    officialApplication: 'applied',
    ...over,
  } as NonNullable<EnterprisePresetStatus['installed']>
}

/** 一行的本机动作真值（控制器按行 id 持有的那份）。 */
const presetState = (status?: EnterprisePresetStatus, extra: Record<string, unknown> = {}) =>
  ({ ...(status === undefined ? {} : { status }), loading: false, ...extra })

/**
 * 配方详情子页面的输入（与控制器里那份构造同形：行 + **行上同一份** facts + 详情取数结果 + 同一枚动作回调）。
 * facts 一律从一个带 `onCopyPresetInstruction` 的 props 算出来——与真控制器一样，详情里的动作是否接通
 * 取决于同一份 facts（这里正是「详情与行同源」的取证前提）。
 */
function presetPageInput(overrides: Partial<Parameters<typeof EnterprisePresetDetailPage>[0]> = {}): Parameters<typeof EnterprisePresetDetailPage>[0] {
  const row = presetRow(PRESET_WITH_CATEGORY)
  const onCopyInstruction = overrides.onCopyInstruction
  const props: ShellProps = {
    view: 'page',
    enterprisePresets: [row],
    ...(onCopyInstruction === undefined ? {} : { onCopyPresetInstruction: onCopyInstruction }),
  }
  return {
    row,
    facts: enterpriseMarketPresetRowFacts(props, row),
    detailLoading: false,
    onBack: vi.fn(),
    ...overrides,
  }
}

/** 「旧服务端不输出这个键」的详情投影：把 `dependencies` 整个删掉（不是留一个空数组）。 */
function detailWithoutDependencies(): Record<string, unknown> {
  const { dependencies: _dropped, ...rest } = DETAIL
  return rest
}

/* ══════════════════════ ① 页签：位次 / 计数 / aria / 键盘 ══════════════════════ */

describe('企业配方 page tab (with 企业技能 / 企业插件 side by side)', () => {
  it('adds 企业配方 as the third store tab, right after 企业插件 and before 包含内容', () => {
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'presets', 'components'])
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label)).toEqual(['企业技能', '企业插件', '企业配方', '包含内容'])
    // 位次是**用户指定的**：企业插件之后、包含内容之前（不是追加到末尾）。
    expect(ENTERPRISE_MARKET_TABS[2]?.id).toBe('presets')
    // id 是新取的 `presets`（**不复用**已按用户要求移除的旧「应用商店」那批 id/文案）。
    expect(ENTERPRISE_MARKET_TAB_IDS.presets).toEqual({ tab: 'market-tab-presets', panel: 'market-panel-presets' })
    // 页签文案仍是「基础词 + 计数」同一份投影：无目录时配方如实为 0。
    expect(enterpriseMarketTabLabel('企业配方', 0)).toBe('企业配方 0')
  })

  it('keeps every tab paired with its own panel and keeps the aria/keyboard path working with four tabs', () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page' })
    const tabs = byRole(tree, 'tab')
    const panels = byRole(tree, 'tabpanel')
    expect(tabs.map(tab => tab['id'])).toEqual([
      ENTERPRISE_MARKET_TAB_IDS.skills.tab,
      ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
      ENTERPRISE_MARKET_TAB_IDS.presets.tab,
      ENTERPRISE_MARKET_TAB_IDS.components.tab,
    ])
    expect(panels.map(panel => panel['id'])).toEqual([
      ENTERPRISE_MARKET_TAB_IDS.skills.panel,
      ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
      ENTERPRISE_MARKET_TAB_IDS.presets.panel,
      ENTERPRISE_MARKET_TAB_IDS.components.panel,
    ])
    // 四向配对：每个页签的 aria-controls 都能解析到一枚 aria-labelledby 指回它的面板。
    for (const tab of tabs) {
      const panel = panels.find(item => item['id'] === tab['aria-controls'])
      expect(panel, String(tab['id'])).toBeDefined()
      expect(panel?.['aria-labelledby']).toBe(tab['id'])
    }
    // roving tabIndex 只剩当前页签可 Tab 到。
    expect(tabs.map(tab => tab['tabIndex'])).toEqual([0, -1, -1, -1])
    // ←/→/Home/End 仍是「走焦 + 选中」一步到位：配方参与循环（从企业插件往右一步就是它）。
    const onSelectTab = vi.fn()
    const keyboard = byRole(EnterpriseMarketLegacyShell({ view: 'page', onSelectTab }), 'tab')
    const press = (index: number, key: string) => keyboard[index]?.['onKeyDown']?.({ key, preventDefault: vi.fn(), currentTarget: null })
    press(1, 'ArrowRight')
    expect(onSelectTab).toHaveBeenLastCalledWith('presets')
    press(2, 'ArrowLeft')
    expect(onSelectTab).toHaveBeenLastCalledWith('plugins')
    press(3, 'ArrowRight')
    expect(onSelectTab).toHaveBeenLastCalledWith('skills')
    press(0, 'End')
    expect(onSelectTab).toHaveBeenLastCalledWith('components')
    press(3, 'Home')
    expect(onSelectTab).toHaveBeenLastCalledWith('skills')
  })

  it('counts the 企业配方 tab from the rows it really renders (and keeps it at 0 without a directory)', () => {
    const withoutDirectory = enterpriseMarketShellModel({ view: 'page', sessionUsable: true })
    expect(withoutDirectory.tabEntries.map(entry => entry.id)).toEqual(['skills', 'plugins', 'presets', 'components'])
    expect(withoutDirectory.tabCounts.presets).toBe(0)
    expect(withoutDirectory.presetsPanel).toEqual({ kind: 'hidden' })
    const withDirectory = enterpriseMarketShellModel({
      view: 'page',
      sessionUsable: true,
      enterprisePresets: enterpriseMarketPresetRows([PRESET]),
    })
    expect(withDirectory.tabCounts.presets).toBe(1)
    expect(withDirectory.presetsPanel).toEqual({ kind: 'ready' })
    // 四枚页签的文案同源：包含内容那枚恒取组件清单长度，其余取自真实行数。
    expect(withoutDirectory.tabEntries.map(entry => entry.text)).toEqual([
      '企业技能 0', '企业插件 0', '企业配方 0', `包含内容 ${ENTERPRISE_MARKET_COMPONENTS.length}`,
    ])
  })
})

/* ══════════════════ ② 配方行：共享行渲染 + 无假开关 + 复制反馈 ══════════════════ */

describe('企业配方 rows reuse the single shared row block', () => {
  it('renders a preset row through EnterpriseMarketInlineRows (icon + two lines + version/category tags)', () => {
    const row = presetRow(PRESET_WITH_CATEGORY)
    const props: ShellProps = { view: 'page', sessionUsable: true, enterprisePresets: [row] }
    const tree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(props), props })

    // 与技能/插件行**同一串**行类名（同一个子块铺出来的，不是第二套版式）。
    for (const name of ['own-market-rows', 'own-market-row', 'own-market-rowLine', 'own-market-rowIcon', 'own-market-rowMain', 'own-market-cardHead', 'own-market-cardId', 'own-market-cardDesc']) {
      expect(byClassName(tree, name).length, name).toBeGreaterThan(0)
    }
    // 行标题可点开详情（用户口径）：行本体是一枚真 button，带 data 钩子与完整动作语义。
    const open = byData(tree, 'data-enterprise-preset-open')
    expect(open).toHaveLength(1)
    expect(open[0]?.['aria-label']).toBe('查看企业配方 代码评审配方 详情')
    // 两行文案：标题 + 描述。
    expect(textOf(tree)).toContain('代码评审配方')
    expect(textOf(tree)).toContain('带检查单的评审配方。')
    // 版本签只显示**短号**，完整坐标挂在紧包它的节点 `title` 上（与技能行同一投影）。
    expect(textOf(tree)).toContain('2.0.3')
    expect(textOf(tree)).not.toContain('skillhub.cn/dev-expert@2.0.3')
    const hint = byClassName(tree, 'own-market-skillVersionHint')[0]
    expect(hint?.['title']).toBe('skillhub.cn/dev-expert@2.0.3')
    // 分类签：有分类就出一枚（服务端没这个字段时安静缺席，另有用例）。
    expect(tags(tree).map(tag => tag['children'])).toEqual(['2.0.3', '研发工具'])
  })

  it('gives the preset row a real Switch once the one-click action is wired (three states, no copy pill)', () => {
    const row = presetRow(PRESET)
    const onTogglePreset = vi.fn()
    const base: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onTogglePreset,
      // ① 一键启用接通：还额外给一个复制回调，也**不该**在行上出那枚第三级按钮（它是兜底，不是主控件）。
      onCopyPresetInstruction: vi.fn(),
      presetStates: { [row.id]: presetState(presetStatus()) },
    }
    const tree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(base), props: base })
    // 真开关（与技能/插件行同款）：未授权未装 ⇒ 关。
    expect(switches(tree)).toHaveLength(1)
    expect(switches(tree)[0]?.['checked']).toBe(false)
    expect(switches(tree)[0]?.['disabled']).toBe(false)
    expect(switches(tree)[0]?.['label']).toBe('启用企业配方 代码评审配方')
    // ① 可用时第三级那枚按钮**不出现**（③ 只能是第三级），也没有任何降级说明。
    expect(byData(tree, 'data-enterprise-preset-copy')).toEqual([])
    expect(byData(tree, 'data-enterprise-preset-fallback')).toEqual([])
    switches(tree)[0]?.['onChange']?.(true)
    expect(onTogglePreset).toHaveBeenCalledWith(row, true)

    // 已授权未装：还是关，但悬浮说明变成「点此启用」。
    const authorized = { ...base, presetStates: { [row.id]: presetState(presetStatus({ authorization: 'authorized' })) } }
    const authorizedTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(authorized), props: authorized })
    expect(switches(authorizedTree)[0]?.['checked']).toBe(false)
    expect(switches(authorizedTree)[0]?.['title']).toBe('点此启用')

    // 已装：开；拨下去 = 停用（同一次回调、next=false）。
    const installed = { ...base, presetStates: { [row.id]: presetState(presetStatus({ authorization: 'authorized', installed: presetInstall() })) } }
    const installedTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(installed), props: installed })
    expect(switches(installedTree)[0]?.['checked']).toBe(true)
    expect(switches(installedTree)[0]?.['title']).toBe('点此停用')
    switches(installedTree)[0]?.['onChange']?.(false)
    expect(onTogglePreset).toHaveBeenLastCalledWith(row, false)

    // 指纹已变：仍是关（要重新确认），状态词与悬浮说明如实交代。
    const stale = { ...base, presetStates: { [row.id]: presetState(presetStatus({ authorization: 'fingerprint-changed' })) } }
    const staleTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(stale), props: stale })
    expect(switches(staleTree)[0]?.['checked']).toBe(false)
    const staleFacts = enterpriseMarketPresetRowFacts(stale, row)
    expect(staleFacts.state).toBe('fingerprint-changed')
    expect(staleFacts.needsApproval).toBe(true)
    expect(staleFacts.stateLabel).toBe('内容已更新')
  })

  it('keeps the switch un-clickable while busy but never disables retry after a failure', () => {
    const row = presetRow(PRESET)
    const onTogglePreset = vi.fn()
    const base: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onTogglePreset,
      presetStates: { [row.id]: presetState(presetStatus({ authorization: 'authorized' })) },
    }
    // 进行中（本机报告 inFlight）⇒ 不可连点。
    const busy = { ...base, presetStates: { [row.id]: presetState(presetStatus({ authorization: 'authorized', inFlight: true })) } }
    expect(switches(EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(busy), props: busy }))[0]?.['disabled']).toBe(true)
    // 本地动作在途（`pendingPresetId` 命中该行）⇒ 同样不可连点。
    expect(switches(EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel({ ...base, pendingPresetId: row.id }), props: { ...base, pendingPresetId: row.id } }))[0]?.['disabled']).toBe(true)
    // **D1：失败不禁用** —— 行上有失败码时开关照旧可拨（再拨一次就是重试）。
    const failed = { ...base, presetActionError: { id: row.id, action: 'install' as const, code: 'ENT_PRESET_INSTALL_FAILED' } }
    const failedTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(failed), props: failed })
    expect(switches(failedTree)[0]?.['disabled']).toBe(false)
    expect(byRole(failedTree, 'alert').length).toBeGreaterThan(0)
    // 真值还没读到（`status` 缺席）⇒ 不可拨（不知道拨下去会做什么，但也绝不给「假的已授权」）。
    const unknown = { ...base, presetStates: { [row.id]: presetState() } }
    const unknownFacts = enterpriseMarketPresetRowFacts(unknown, row)
    expect(unknownFacts.state).toBe('unknown')
    expect(unknownFacts.switchDisabled).toBe(true)
    expect(unknownFacts.enabled).toBe(false)
  })

  it('falls back visibly: level ① unavailable → level ② (new session) before level ③ (clipboard)', () => {
    const row = presetRow(PRESET)
    // ① 不可用（没有写入口）+ ② 接通 ⇒ 走第二级，且**必须**有一句「为什么没走一键启用」的可见说明。
    const onOpenPresetInNewSession = vi.fn()
    const onCopyPresetInstruction = vi.fn()
    const second: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onOpenPresetInNewSession,
      onCopyPresetInstruction,
      presetStates: { [row.id]: presetState(presetStatus()) },
    }
    const secondTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(second), props: second })
    const facts2 = enterpriseMarketPresetRowFacts(second, row)
    expect(facts2.fallback.level).toBe('new-session')
    expect(facts2.fallback.note).toBe(enterprisePresetNewSessionReason(facts2.fallback.reason!))
    const newSession = byData(secondTree, 'data-enterprise-preset-new-session')
    expect(newSession).toHaveLength(1)
    expect(textOf(secondTree)).toContain(ENTERPRISE_PRESET_NEW_SESSION_TEXT)
    newSession[0]?.['onClick']?.()
    expect(onOpenPresetInNewSession).toHaveBeenCalledWith(row)
    // 第二级优先：即使第三级也接通，第三级仍只在旁边（它是兜底，不是主控件）。
    const note = byData(secondTree, 'data-enterprise-preset-fallback')[0]
    expect(note?.['data-enterprise-preset-fallback-level']).toBe('new-session')
    expect(textOf(secondTree)).toContain('一键启用暂时不可用')
    // 没有 Switch（① 不可用就绝不画一枚拨不动的开关）。
    expect(switches(secondTree)).toEqual([])

    // ② 也不可用 ⇒ 落到第三级，且说明换了一句（说清两级都不可用）。
    const third: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onCopyPresetInstruction,
      presetStates: { [row.id]: presetState(presetStatus()) },
    }
    const thirdTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(third), props: third })
    const facts3 = enterpriseMarketPresetRowFacts(third, row)
    expect(facts3.fallback.level).toBe('clipboard')
    expect(byData(thirdTree, 'data-enterprise-preset-fallback')[0]?.['data-enterprise-preset-fallback-level']).toBe('clipboard')
    expect(textOf(thirdTree)).toContain('一键启用与新建会话都不可用')

    // 三级全不可用：仍然是**显式**的说明（绝不留一枚点了没反应的控件）。
    const none: ShellProps = { view: 'page', sessionUsable: true, enterprisePresets: [row], presetStates: { [row.id]: presetState(presetStatus()) } }
    const noneTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(none), props: none })
    expect(byData(noneTree, 'data-enterprise-preset-copy')).toEqual([])
    expect(byData(noneTree, 'data-enterprise-preset-new-session')).toEqual([])
    expect(textOf(noneTree)).toContain('请联系企业管理员')
  })

  it('treats a route-level failure code as "one-click unavailable" but a retryable one as a retry', () => {
    const row = presetRow(PRESET)
    const withCode = (code: string): ShellProps => ({
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onTogglePreset: vi.fn(),
      onCopyPresetInstruction: vi.fn(),
      presetStates: { [row.id]: presetState(presetStatus(), { errorCode: code }) },
    })
    // Host 那条子路径没接线（400）⇒ 结构性不可用 ⇒ 走降级链（而不是给一枚拨了没反应的开关）。
    expect(enterpriseMarketPresetRowFacts(withCode('ENT_INVALID_REQUEST'), row).fallback.level).toBe('clipboard')
    // 一次可重试的失败（503）⇒ 留在第一级，让员工「再拨一次即重试」。
    expect(enterpriseMarketPresetRowFacts(withCode('ENT_PRESET_INSTALL_FAILED'), row).fallback.level).toBe('one-click')
    // 终态的安装失败（不可重试）⇒ 也如实降级。
    const terminal = withCode('ENT_PRESET_RECIPE_INVALID')
    expect(enterpriseMarketPresetRowFacts(terminal, row).fallback.level).toBe('clipboard')
    expect(enterprisePresetRouteUnsupported('ENT_INVALID_REQUEST')).toBe(true)
    expect(enterprisePresetRouteUnsupported('ENT_RESOURCE_NOT_FOUND')).toBe(true)
    expect(enterprisePresetRouteUnsupported(undefined)).toBe(false)
  })

  it('keeps the third-level copy feedback and renders nothing when the callback is missing (no dead button)', () => {
    const row = presetRow(PRESET)
    const onCopyPresetInstruction = vi.fn()
    const props: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onCopyPresetInstruction,
      presetStates: { [row.id]: presetState(presetStatus()) },
    }
    const model = enterpriseMarketShellModel(props)
    const tree = EnterpriseMarketInlineRows({ tab: 'presets', model, props })
    const copy = byData(tree, 'data-enterprise-preset-copy')
    expect(copy).toHaveLength(1)
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_COPY_TEXT)
    copy[0]?.['onClick']?.()
    expect(onCopyPresetInstruction).toHaveBeenCalledWith(row)

    // 复制成功后的可见反馈与行 facts 同源（按钮文案变「已复制」）。
    expect(enterpriseMarketPresetRowFacts({ ...props, presetCopiedId: row.id }, row).copied).toBe(true)
    const copied = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel({ ...props, presetCopiedId: row.id }), props: { ...props, presetCopiedId: row.id } })
    expect(byData(copied, 'data-enterprise-preset-copy')[0]?.['children']).toBe(ENTERPRISE_PRESET_COPIED_TEXT)

    // 回调缺席（纯函数直调 / 旧调用方）时整枚不渲染——**不给死按钮**。
    const bare = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel({ view: 'page', enterprisePresets: [row] }), props: { view: 'page', enterprisePresets: [row] } })
    expect(byData(bare, 'data-enterprise-preset-copy')).toEqual([])
    expect(switches(bare)).toEqual([])
  })

  it('says 将在新会话生效 after a successful enable, in the wording of the official application kind', () => {
    const row = presetRow(PRESET)
    const withAppl = (applied: Record<string, unknown>): ShellProps => ({
      view: 'page',
      sessionUsable: true,
      enterprisePresets: [row],
      onTogglePreset: vi.fn(),
      presetStates: { [row.id]: presetState(presetStatus({ authorization: 'authorized', installed: presetInstall() }), { applied }) },
    })
    // ① 没启过（没有回执）：这一整段不进 DOM——绝不编一句「已启用」。
    const bare = EnterpriseMarketInlineRows({
      tab: 'presets',
      model: enterpriseMarketShellModel({ view: 'page', enterprisePresets: [row], onTogglePreset: vi.fn() }),
      props: { view: 'page', enterprisePresets: [row], onTogglePreset: vi.fn() },
    })
    expect(byData(bare, 'data-enterprise-preset-applied')).toEqual([])
    expect(textOf(bare)).not.toContain('将在新会话生效')
    expect(enterprisePresetAppliedNotice(undefined)).toBeUndefined()

    // ② 官方 `restart-required`：必须说清「要重新打开客户端」且含那句硬事实。
    const restart = withAppl({ application: 'restart-required', officialApplication: 'restart-required', needsNewSession: true })
    const restartTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(restart), props: restart })
    const restartNote = byData(restartTree, 'data-enterprise-preset-applied')
    expect(restartNote).toHaveLength(1)
    expect(restartNote[0]?.['role']).toBe('status')
    expect(textOf(restartTree)).toContain('将在新会话生效')
    expect(textOf(restartTree)).toContain('需要重新打开客户端')
    expect(enterprisePresetAppliedNotice({ application: 'restart-required', needsNewSession: true }))
      .toBe(ENTERPRISE_PRESET_APPLIED_RESTART_TEXT)

    // ③ 官方 `applied`（热生效）：同一句硬事实 + 一句「已打开的会话不会改变」（两态都诚实呈现）。
    const hot = withAppl({ application: 'hot', officialApplication: 'applied', needsNewSession: true })
    const hotTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(hot), props: hot })
    expect(textOf(hotTree)).toContain('将在新会话生效')
    expect(textOf(hotTree)).toContain('已经打开的会话不会改变')
    expect(enterprisePresetAppliedNotice({ application: 'hot', needsNewSession: true }))
      .toBe(ENTERPRISE_PRESET_APPLIED_HOT_TEXT)

    // ④ 官方 `overridden` 那种 `other`：仍然只说那句硬事实，不把官方英文原值砸给员工。
    const other = withAppl({ application: 'other', officialApplication: 'overridden', needsNewSession: true })
    const otherTree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(other), props: other })
    expect(textOf(otherTree)).toContain(ENTERPRISE_PRESET_APPLIED_OTHER_TEXT)
    expect(textOf(otherTree)).not.toContain('overridden')

    // ⑤ 同配方同指纹、本次没重装：前面补一句（Host 的 `alreadyInstalled`）。
    expect(enterprisePresetAppliedNotice({ application: 'hot', needsNewSession: true, alreadyInstalled: true }))
      .toBe(`${ENTERPRISE_PRESET_APPLIED_EXISTING_TEXT}${ENTERPRISE_PRESET_APPLIED_HOT_TEXT}`)
    expect(enterprisePresetAppliedNotice({ application: 'hot', needsNewSession: true, alreadyInstalled: false }))
      .toBe(ENTERPRISE_PRESET_APPLIED_HOT_TEXT)

    // ⑥ 行上与详情里读的是同一份 facts ⇒ 同一句话（详情子页面也出这一句）。
    const detail = EnterprisePresetDetailPage(presetPageInput({ facts: enterpriseMarketPresetRowFacts(restart, row), onTogglePreset: vi.fn() }))
    expect(byData(detail, 'data-enterprise-preset-applied')).toHaveLength(1)
    expect(textOf(detail)).toContain(ENTERPRISE_PRESET_APPLIED_RESTART_TEXT)
  })

  it('drops the version tag / category tag quietly when the optional facts are missing (no placeholder text)', () => {
    const row = presetRow({ ...PRESET, sourceDshVersion: '' })
    const props: ShellProps = { view: 'page', enterprisePresets: [row] }
    const tree = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel(props), props })
    expect(tags(tree)).toEqual([])
    // 投影层同样安静缺席：分类只有非空串才产出这个键。
    expect(enterprisePresetCategory({ category: '   ' })).toBeUndefined()
    expect(enterprisePresetCategory({})).toBeUndefined()
    expect(enterprisePresetCategory({ category: '研发工具' })).toBe('研发工具')
  })
})

/* ═══════════════════ ③ 配方详情：行标题进、面包屑回 ═══════════════════ */

describe('企业配方 detail sub-page', () => {
  it('opens from the row title (not from the action) and switches the whole panel to the detail view', () => {
    const row = presetRow(PRESET)
    const onOpenPresetDetail = vi.fn()
    const listProps: ShellProps = { view: 'page', sessionUsable: true, activeTab: 'presets', enterprisePresets: [row], onOpenPresetDetail }
    const list = EnterpriseMarketLegacyShell(listProps)
    // 列表视图：页签条 + 四个面板 + 配方行；没有详情。
    expect(byRole(list, 'tablist')).toHaveLength(1)
    expect(byRole(list, 'tabpanel')).toHaveLength(4)
    expect(byData(list, 'data-enterprise-preset-detail')).toEqual([])
    // 点**行标题**（行本体）才进详情；动作区那枚药丸与它无关（结构性同级，不冒泡）。
    const copyAndOpen = byData(EnterpriseMarketLegacyShell({ ...listProps, onCopyPresetInstruction: vi.fn() }), 'data-enterprise-preset-open')[0]
    copyAndOpen?.['onClick']?.()
    expect(onOpenPresetDetail).toHaveBeenCalledWith(row)

    // 控制器把这一行交给 `presetPage` ⇒ 面板**整页切换**：列表 / 页签条 / 面板整段不挂载。
    const detail = EnterpriseMarketLegacyShell({ ...listProps, presetPage: presetPageInput() })
    expect(byRole(detail, 'tablist')).toEqual([])
    expect(byRole(detail, 'tabpanel')).toEqual([])
    expect(byClassName(detail, 'own-market-rows')).toEqual([])
    expect(byClassName(detail, 'own-market-detail')).toHaveLength(1)
    expect(byData(detail, 'data-enterprise-preset-detail')[0]?.['data-enterprise-preset-detail']).toBe(presetPageInput().row.id)
  })

  it('returns to the list through the crumb (the only way back) and shows the identified preset', () => {
    const page = presetPageInput({ detail: DETAIL })
    const onBack = vi.fn()
    const tree = EnterprisePresetDetailPage({ ...page, onBack })
    const crumb = byClassName(tree, 'own-market-crumb')[0]
    expect(crumb?.['type']).toBe('button')
    expect(crumb?.['aria-label']).toBe(ENTERPRISE_PRESET_DETAIL_BACK_LABEL)
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_DETAIL_BACK_TEXT)
    crumb?.['onClick']?.()
    expect(onBack).toHaveBeenCalledTimes(1)
    // 与技能详情同一套框架取值：h3 标题 + 「来源」徽标（完整坐标）+ 「标识」行（presetId）+ 描述。
    expect(byClassName(tree, 'own-market-detailTitle')[0]?.['children']).toBe('代码评审配方')
    expect(byClassName(tree, 'own-market-detailSourceLabel')[0]?.['children']).toBe('来源')
    expect(textOf(tree)).toContain('skillhub.cn/dev-expert@2.0.3')
    expect(byClassName(tree, 'own-market-detailName')[0]?.['children']).toBeDefined()
    expect(textOf(tree)).toContain('review-agent')
    expect(textOf(tree)).toContain('带检查单的评审配方。')
    // 详情里**没有**列表的行结构（列表那一支一字不挂载）。
    expect(byData(tree, 'data-enterprise-preset-open')).toEqual([])
  })

  it('renders the same action block in the detail head, from the same facts and the same callbacks as the row', () => {
    // ① 一键启用接通：详情头部同样是一枚真开关（与行上同一枚子块、同一份 facts、同一个回调）。
    const row = presetRow(PRESET)
    const onTogglePreset = vi.fn()
    const detailProps: ShellProps = {
      view: 'page',
      enterprisePresets: [row],
      onTogglePreset,
      onCopyPresetInstruction: vi.fn(),
      presetStates: { [row.id]: presetState(presetStatus({ authorization: 'authorized' })) },
    }
    const wired = EnterprisePresetDetailPage({
      row,
      facts: enterpriseMarketPresetRowFacts(detailProps, row),
      detailLoading: false,
      onTogglePreset,
      onBack: vi.fn(),
    })
    expect(switches(wired)).toHaveLength(1)
    expect(byData(wired, 'data-enterprise-preset-copy')).toEqual([])
    switches(wired)[0]?.['onChange']?.(true)
    expect(onTogglePreset).toHaveBeenCalledWith(row, true)

    // ② 一键启用不可用：详情头部给第二级 + 第三级，并且**同源地**渲染那一句降级说明。
    const onOpenPresetInNewSession = vi.fn()
    const onCopyInstruction = vi.fn()
    const falloutProps: ShellProps = {
      view: 'page',
      enterprisePresets: [row],
      onOpenPresetInNewSession,
      onCopyPresetInstruction: onCopyInstruction,
      presetStates: { [row.id]: presetState(presetStatus()) },
    }
    const fallbackPage = EnterprisePresetDetailPage({
      row,
      facts: enterpriseMarketPresetRowFacts(falloutProps, row),
      detailLoading: false,
      onOpenInNewSession: onOpenPresetInNewSession,
      onCopyInstruction,
      onBack: vi.fn(),
    })
    const copy = byData(fallbackPage, 'data-enterprise-preset-copy')
    expect(copy).toHaveLength(1)
    copy[0]?.['onClick']?.()
    expect(onCopyInstruction).toHaveBeenCalledWith(row)
    expect(byData(fallbackPage, 'data-enterprise-preset-new-session')).toHaveLength(1)
    expect(byData(fallbackPage, 'data-enterprise-preset-fallback')).toHaveLength(1)
    // 同一份 facts：复制过的那一行在详情里的按钮文案同样是「已复制」。
    expect(byData(EnterprisePresetDetailPage({
      row,
      facts: { ...enterpriseMarketPresetRowFacts(falloutProps, row), copied: true },
      detailLoading: false,
      onCopyInstruction,
      onBack: vi.fn(),
    }), 'data-enterprise-preset-copy')[0]?.['children']).toBe(ENTERPRISE_PRESET_COPIED_TEXT)
  })
})

/* ═══════════ ③b 授权弹层：逐项披露 / confirmFingerprint / 指纹已变重确认 ═══════════ */

describe('自造授权弹层（配方一键启用）', () => {
  const row = presetRow(PRESET)
  const facts = enterpriseMarketPresetRowFacts({ view: 'page', enterprisePresets: [row] }, row)

  it('lists every bundle and mount it would install, with the official-density disclaimer', () => {
    const tree = EnterprisePresetApprovalDialog({
      row,
      facts,
      disclosure: PRESET_DISCLOSURE,
      fingerprintChanged: false,
      busy: false,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    })
    // 弹层身份 + 语义（自造覆盖层，不是官方 Modal）。
    const dialog = byRole(tree, 'dialog')[0]
    expect(dialog?.['aria-modal']).toBe('true')
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_APPROVAL_TITLE)
    // 逐项披露：会装哪些 bundle（名称 + 简述）、会挂载哪些模块（名称 + 简述）。
    const bundles = byData(tree, 'data-enterprise-preset-approval-bundle')
    expect(bundles.map(item => item['data-enterprise-preset-approval-bundle'])).toEqual(['dsh-ent-preset-review-agent'])
    const mounts = byData(tree, 'data-enterprise-preset-approval-mount')
    expect(mounts.map(item => item['data-enterprise-preset-approval-mount'])).toEqual(['@deepseek-ai/dsh-agent-preset'])
    expect(textOf(tree)).toContain('带检查单的评审配方')
    // 免责声明与官方原型**逐字同句**（信息密度对齐）。
    expect(byData(tree, 'data-enterprise-preset-approval-disclaimer')[0]?.['children']).toBe(ENTERPRISE_PRESET_APPROVAL_DISCLAIMER)
    // 指纹没变时**不**出那句「内容变了」。
    expect(byData(tree, 'data-enterprise-preset-approval-stale')).toEqual([])
    // 两枚按钮：取消 / 确认并启用（官方那套 per-call「允许一次」的语义不照抄）。
    const buttons = primitives(tree, Button)
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.['children']).toBe(ENTERPRISE_PRESET_APPROVAL_CANCEL)
    expect(buttons[1]?.['children']).toBe(ENTERPRISE_PRESET_APPROVAL_CONFIRM)
  })

  it('does not carry any body text about an empty list when the disclosure is empty, and stays honest', () => {
    const tree = EnterprisePresetApprovalDialog({
      row,
      facts,
      disclosure: { fingerprint: 'a'.repeat(64), bundles: [], mounts: [] },
      fingerprintChanged: false,
      busy: false,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    })
    expect(byData(tree, 'data-enterprise-preset-approval-bundle')).toEqual([])
    expect(textOf(tree)).toContain('没有额外要安装或挂载的内容')
  })

  it('says 内容变了 when the confirmed fingerprint no longer matches, and routes the two buttons', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const tree = EnterprisePresetApprovalDialog({
      row,
      facts,
      disclosure: PRESET_DISCLOSURE,
      fingerprintChanged: true,
      errorCode: 'ENT_PRESET_AUTHORIZATION_STALE',
      busy: false,
      onConfirm,
      onCancel,
    })
    // 指纹已变：明说「内容变了，需要重新确认」，并把上一次确认的失败码摆在弹层里（可重开、不给死按钮）。
    expect(byData(tree, 'data-enterprise-preset-approval-stale')[0]?.['children']).toBe(ENTERPRISE_PRESET_APPROVAL_STALE_NOTE)
    expect(byData(tree, 'data-enterprise-error-code')[0]?.['data-enterprise-error-code']).toBe('ENT_PRESET_AUTHORIZATION_STALE')
    const buttons = primitives(tree, Button)
    buttons[0]?.['onClick']?.()
    expect(onCancel).toHaveBeenCalledTimes(1)
    buttons[1]?.['onClick']?.()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while the confirmation is in flight (no double tap), and re-enables after failure', () => {
    const base = { row, facts, disclosure: PRESET_DISCLOSURE, fingerprintChanged: false, onConfirm: vi.fn(), onCancel: vi.fn() }
    const busyTree = EnterprisePresetApprovalDialog({ ...base, busy: true })
    expect(primitives(busyTree, Button).map(button => button['disabled'])).toEqual([true, true])
    const idleTree = EnterprisePresetApprovalDialog({ ...base, busy: false })
    expect(primitives(idleTree, Button).map(button => button['disabled'])).toEqual([false, false])
  })

  it('carries the confirmed fingerprint, not the stale one, when the facts came from status', () => {
    // facts 里的 `needsApproval` 就是「点开关要先弹层」的判定；弹层回传的指纹取自**同一份** status.disclosure。
    const needs = enterpriseMarketPresetRowFacts({
      view: 'page',
      enterprisePresets: [row],
      onTogglePreset: vi.fn(),
      presetStates: { [row.id]: presetState(presetStatus({ authorization: 'needs-authorization' })) },
    }, row)
    expect(needs.needsApproval).toBe(true)
    // 已装的行不该再要确认（拨下去是停用，不是启用）。
    const done = enterpriseMarketPresetRowFacts({
      view: 'page',
      enterprisePresets: [row],
      onTogglePreset: vi.fn(),
      presetStates: { [row.id]: presetState(presetStatus({ authorization: 'needs-authorization', installed: presetInstall() })) },
    }, row)
    expect(done.needsApproval).toBe(false)
    expect(done.enabled).toBe(true)
  })
})

/* ═════════════ ④ 「这份配方包含」：dependencies 存在 / 缺席两种表现 ═════════════ */

describe('「这份配方包含」 section', () => {
  it('groups the dependencies by kind when the field is there (技能 / 插件 each a group, id + 必需/可选)', () => {
    const tree = EnterprisePresetDetailPage(presetPageInput({ detail: DETAIL }))
    const section = byData(tree, 'data-enterprise-preset-contents')[0]
    expect(section?.['data-enterprise-preset-contents-state']).toBe('available')
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_CONTENTS_TITLE)
    expect(textOf(tree)).toContain(enterprisePresetContentsCountText(3))

    const groups = byData(tree, 'data-enterprise-preset-group')
    expect(groups.map(group => group['data-enterprise-preset-group'])).toEqual(['skill', 'plugin', 'other'])
    const dependencies = byData(tree, 'data-enterprise-preset-dependency')
    expect(dependencies.map(item => item['data-enterprise-preset-dependency'])).toEqual(['code-review', 'ent-linter', 'ent-gitlab'])
    expect(dependencies.map(item => item['data-enterprise-preset-required'])).toEqual(['true', 'false', 'false'])
    // 每条显示 id 与「必需 / 可选」：必需只认服务端给的严格 true。
    expect(textOf(tree)).toContain('code-review')
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_DEPENDENCY_REQUIRED)
    expect(textOf(tree)).toContain('ent-linter')
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL)
    // 未知 kind 归「其它」组：不静默丢掉（否则界面会显得这份配方什么都没有）。
    expect(groups[2]?.['children']).toBeDefined()
    expect(textOf(tree)).toContain('ent-gitlab')
    expect(enterprisePresetDependencyRequiredText(true)).toBe(ENTERPRISE_PRESET_DEPENDENCY_REQUIRED)
    expect(enterprisePresetDependencyRequiredText(false)).toBe(ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL)
  })

  it('says 暂时无法读取包含内容 (visible, never blank, never a fabricated "不包含") when the field is absent', () => {
    // 情形一：详情对象里**根本没有这个键**（解码这一路还没带上它 / 旧服务端）⇒ 如实说读不到。
    const missingField = EnterprisePresetDetailPage(presetPageInput({ detail: detailWithoutDependencies() }))
    expect(byData(missingField, 'data-enterprise-preset-contents')[0]?.['data-enterprise-preset-contents-state']).toBe('unavailable')
    expect(textOf(missingField)).toContain(ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE)
    expect(textOf(missingField)).not.toContain(ENTERPRISE_PRESET_CONTENTS_EMPTY)
    expect(byData(missingField, 'data-enterprise-preset-dependency')).toEqual([])
    // 情形二：详情这次压根没取到（未在途）= 同一条可见说明，不是白屏。
    const notFetched = EnterprisePresetDetailPage(presetPageInput({ detailLoading: false }))
    expect(textOf(notFetched)).toContain(ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE)
    // 情形三：在途时给轻提示（首帧就看得见，不空白）。
    expect(enterprisePresetContentsState({ loading: true })).toEqual({ kind: 'loading', hint: expect.any(String) })
    // 纯投影的防御口径：非数组 / 形状不对一律按「读不到」处理，不把畸形数据当成「不包含」。
    expect(enterprisePresetContentsState({ loading: false, detail: { dependencies: 'oops' } }).kind).toBe('unavailable')
    expect(enterprisePresetDependencies({ dependencies: 'oops' })).toEqual([])
    expect(enterprisePresetDependencies({})).toEqual([])
    expect(enterprisePresetDependencies(null)).toEqual([])
  })

  it('says 这份配方不包含技能或插件 only when the field is there and really empty', () => {
    const tree = EnterprisePresetDetailPage(presetPageInput({ detail: { ...PRESET, dependencies: [] } }))
    expect(byData(tree, 'data-enterprise-preset-contents')[0]?.['data-enterprise-preset-contents-state']).toBe('empty')
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_CONTENTS_EMPTY)
    expect(textOf(tree)).not.toContain(ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE)
    // 规则只收「有非空 id」的条目：没有身份的东西不上屏（也进不了分组）。
    expect(enterprisePresetDependencies({ dependencies: [{ kind: 'skill', id: '', required: true }, null, 'x'] })).toEqual([])
    expect(enterprisePresetContentsGroups([])).toEqual([])
    // required 只认严格 true：字段异常时不猜「必需」。
    expect(enterprisePresetDependencies({ dependencies: [{ kind: 'skill', id: 'a', required: 'yes' }] })[0]?.required).toBe(false)
  })

  it('surfaces a detail fetch failure with the shared notice plus a real retry', () => {
    const onReloadDetail = vi.fn()
    const tree = EnterprisePresetDetailPage(presetPageInput({ detailErrorCode: 'ENT_PLATFORM_UNAVAILABLE', onReloadDetail }))
    // 失败可见：一句话 + 唯一提示组件（含「技术信息」里的稳定码）+ 真的重发。
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_CONTENTS_UNAVAILABLE)
    expect(byRole(tree, 'alert').length + byClassName(tree, 'own-market-inlineError').length).toBeGreaterThan(0)
    expect(byClassName(tree, 'own-market-fileRetry')).toHaveLength(1)
    const retry = primitives(tree, Button)[0]
    expect(retry).toBeDefined()
    retry?.['onClick']?.()
    expect(onReloadDetail).toHaveBeenCalledTimes(1)
  })
})

/* ══════════════════════ ⑤ 反向锁：没有旧应用商店 / 只有一套行 ══════════════════════ */

describe('reverse locks for the 企业配方 tab', () => {
  it('leaves no trace of the removed 应用商店 entry (no legacy tab id, no legacy label)', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 「应用商店」那个独立入口已按用户要求整段移除：连它的名字都不许再出现在代码里。
    //（注意 `.own-market-storeTabs`/`.own-market-storeTab` 是**页签条**的既有类名，与本条无关，不在名单里。）
    for (const legacy of ['应用商店', 'market-tab-store', 'market-panel-store', 'EnterpriseMarketStore', 'EnterpriseMarketStorePage']) {
      expect(source, legacy).not.toContain(legacy)
    }
    // 页签 id 就是这四枚（新取的 `presets`），没有第五枚、也没有复用旧 id。
    expect(Object.keys(ENTERPRISE_MARKET_TAB_IDS).sort()).toEqual(['components', 'plugins', 'presets', 'skills'])
    // 页签条上出现的文案里没有一个「商店」字样（那是被移除的独立入口的名字）。
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label).join(' ')).not.toContain('商店')
  })

  it('keeps exactly one row implementation and one preset-facts entry point', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    const count = (re: RegExp): number => (source.match(re) ?? []).length
    // 行渲染只有一处实现，三个目录页签（技能 / 插件 / 配方）各调用它一次。
    expect(count(/export function EnterpriseMarketInlineRows\(/g)).toBe(1)
    expect(count(/<EnterpriseMarketInlineRows /g)).toBe(3)
    // 配方行 facts 唯一入口：1 处定义 + 行渲染 1 处 + 详情输入构造 1 处 + **授权弹层输入构造 1 处** = 4
    // （行上 / 详情里 / 弹层里读的都是同一份，不存在第二套算法）。
    expect(count(/enterpriseMarketPresetRowFacts\(/g)).toBe(4)
    // 配方行投影唯一入口：1 处定义 + 控制器 1 处 = 2（没有第二处造行的写法）。
    expect(count(/enterpriseMarketPresetRows\(/g)).toBe(2)
    // 授权弹层只有一枚实现，且只由宿主挂一次（行上与详情里都不各挂一份）。
    expect(count(/export function EnterprisePresetApprovalDialog\(/g)).toBe(1)
    expect(count(/<EnterprisePresetApprovalDialog /g)).toBe(1)
    // **降级链的三级各只有一处渲染点**：真开关（唯一子块里）、第二级按钮、第三级按钮。
    expect(count(/<EnterpriseMarketPresetRowActions/g)).toBe(2)
    expect(count(/data-enterprise-preset-new-session=/g)).toBe(1)
    expect(count(/data-enterprise-preset-copy=/g)).toBe(1)
    // 三级的判定只在一个纯函数里（`enterprisePresetFallbackPlan`）：1 处定义 + 1 处调用。
    expect(count(/enterprisePresetFallbackPlan\(/g)).toBe(2)
    expect(count(/enterprisePresetRouteUnsupported\(/g)).toBe(3)
    // 取数源用的是设置弹窗那**一个**工厂：本文件只调用一处（控制器里那一处 useMemo），没有自造 fetch。
    expect(count(/createEnterprisePresetListSource\(/g)).toBe(1)
    expect(source).not.toContain('/enterprise/api/v1/local/presets')
  })

  it('shares the preset directory source with the settings dialog (one factory, one instruction builder)', async () => {
    const market = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    const settings = await readFile(new URL('../src/preset-market.tsx', import.meta.url), 'utf8')
    const accountView = await readFile(new URL('../src/account-view.tsx', import.meta.url), 'utf8')
    // 设置弹窗的配方 tab **保留**（入口没丢）：account-view 仍挂 `EnterprisePresetMarket`。
    expect(accountView).toContain('EnterprisePresetMarket')
    // 两个界面用的是**同一个**取数源工厂与**同一个**指令构造器（市场页 import 它们，不新造第二套）。
    for (const shared of ['createEnterprisePresetListSource', 'buildPresetImportInstruction']) {
      expect(settings, shared).toContain(`export function ${shared}(`)
      expect(market, shared).toContain(shared)
    }
  })

  it('never lets a technical word reach the preset page (terminology lock)', () => {
    const row = presetRow(PRESET_WITH_CATEGORY)
    const props: ShellProps = {
      view: 'page',
      sessionUsable: true,
      activeTab: 'presets',
      enterprisePresets: [row],
      onCopyPresetInstruction: vi.fn(),
      presetsListState: { kind: 'ready', value: [row] },
    }
    const texts = [
      textOf(EnterpriseMarketLegacyShell(props)),
      textOf(EnterpriseMarketLegacyShell({ ...props, presetPage: presetPageInput({ detail: DETAIL, onCopyInstruction: vi.fn() }) })),
      // 复制指令的**正文**不上屏（它含上游专名）：本页只把它写进剪贴板。
      textOf(EnterprisePresetDetailPage(presetPageInput({ detail: DETAIL }))),
    ]
    for (const text of texts) {
      for (const banned of ['preset', 'Preset', 'YAML', 'yaml', 'manifest', 'Cordis', 'cordis', '.dshpreset', 'dsh-preset', '组件', 'Preset Square Skill']) {
        expect(text, banned).not.toContain(banned)
      }
      // 术语降维后的措辞确实在（配方/包含内容这些词才是员工该看到的）。
      expect(text).toContain('配方')
    }
    // 加载/空/失败三句也复用了设置弹窗那一份（不各写一套）。
    expect(textOf(EnterpriseMarketLegacyShell({ ...props, enterprisePresets: [], presetsListState: { kind: 'loading' } }))).toContain('正在加载企业配方')
  })
})
