/**
 * [INPUT]: 依赖 marketplace-entry 的页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_TAB_IDS`）、唯一目录页外壳
 *          `EnterpriseMarketLegacyShell`、共享行子块 `EnterpriseMarketInlineRows`、配方行投影与 facts
 *          （`enterpriseMarketPresetRows`/`enterpriseMarketPresetRowFacts`）、配方详情子页面 `EnterprisePresetDetailPage`
 *          与它那一族包含内容纯投影（`enterprisePresetDependencies`/`enterprisePresetContentsGroups`/
 *          `enterprisePresetContentsState`/`enterprisePresetCategory`）；另读 `node:fs/promises` 的源码文本做反向锁
 *          （preset-market.tsx 仍挂着设置弹窗的配方 tab，且两页用的是**同一个**取数源工厂）
 * [OUTPUT]: 「企业配方页签」这一刀的验收门禁：① 四枚页签且「企业配方」位次在**企业插件之后、包含内容之前**，
 *           四页签的 aria 四向配对与 ←/→/Home/End 键盘路径仍成立；② 配方行**复用唯一共享行子块**渲染
 *           （图标 + 两行文案 + 版本**短号**签 + 可选分类签，完整坐标只在 `title`），动作区只有「复制导入指令」、
 *           **没有 Switch**（不给假开关），复制后文案变「已复制」，回调缺席时整枚不渲染；③ 点**行标题**进配方详情
 *           子页面、面包屑「返回配方列表」是唯一返回入口（且详情里没有列表的页签/行）；④ 详情「这份配方包含」
 *           在 `dependencies` **存在**（按 kind 分组、显示 id 与「必需 / 可选」，未知 kind 归「其它」不丢）
 *           与**缺席**（可见说明「暂时无法读取包含内容」，不白屏、不假装「不包含」）两种情况下的表现；
 *           ⑤ 反向锁：市场页里**不存在**旧「应用商店」相关 id/文案，行渲染仍只有一处实现，
 *           配方页可见文本不出现宪法反目标技术词（preset / Preset / YAML / manifest / 组件 …）。
 * [POS]: 市场页「企业配方」页签与配方详情的行为取证点（dsh-ui 没有 DOM 渲染测试，本文件是这一刀的门禁）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseRuntimePreset } from '../src/local-api-decode.js'
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
  EnterpriseMarketInlineRows,
  EnterpriseMarketLegacyShell,
  EnterprisePresetDetailPage,
  enterpriseMarketPresetRowFacts,
  enterpriseMarketPresetRows,
  enterpriseMarketShellModel,
  enterpriseMarketTabLabel,
  enterprisePresetCategory,
  enterprisePresetContentsCountText,
  enterprisePresetContentsGroups,
  enterprisePresetContentsState,
  enterprisePresetDependencies,
  enterprisePresetDependencyRequiredText,
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

  it('gives the preset row the real action it has (copy the import instruction) and never a fake switch', () => {
    const row = presetRow(PRESET)
    const onCopyPresetInstruction = vi.fn()
    const props: ShellProps = { view: 'page', sessionUsable: true, enterprisePresets: [row], onCopyPresetInstruction }
    const model = enterpriseMarketShellModel(props)
    const tree = EnterpriseMarketInlineRows({ tab: 'presets', model, props })

    // **反向锁**：配方今天没有安装链路 ⇒ 行上一枚 Switch 都没有（不给假开关、也不做假已装态）。
    expect(switches(tree)).toEqual([])
    expect(byData(tree, 'data-enterprise-preset-state')).toEqual([])
    // 动作区只有本机真能用的那一条：复制导入指令（回调带上被点的那一行）。
    const copy = byData(tree, 'data-enterprise-preset-copy')
    expect(copy).toHaveLength(1)
    expect(textOf(tree)).toContain(ENTERPRISE_PRESET_COPY_TEXT)
    copy[0]?.['onClick']?.()
    expect(onCopyPresetInstruction).toHaveBeenCalledWith(row)

    // 复制成功后的可见反馈与行 facts 同源（按钮文案变「已复制」）。
    expect(enterpriseMarketPresetRowFacts({ ...props, presetCopiedId: row.id }, row).copied).toBe(true)
    const copied = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel({ ...props, presetCopiedId: row.id }), props: { ...props, presetCopiedId: row.id } })
    expect(textOf(copied)).toContain(ENTERPRISE_PRESET_COPIED_TEXT)
    expect(textOf(copied)).not.toContain(ENTERPRISE_PRESET_COPY_TEXT)

    // 回调缺席（纯函数直调 / 旧调用方）时整枚不渲染——**不给死按钮**。
    const bare = EnterpriseMarketInlineRows({ tab: 'presets', model: enterpriseMarketShellModel({ view: 'page', enterprisePresets: [row] }), props: { view: 'page', enterprisePresets: [row] } })
    expect(byData(bare, 'data-enterprise-preset-copy')).toEqual([])
    expect(switches(bare)).toEqual([])
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

  it('keeps the copy action in the detail head, from the same facts and the same callback as the row', () => {
    const onCopyInstruction = vi.fn()
    const page = presetPageInput({ detail: DETAIL, onCopyInstruction })
    const tree = EnterprisePresetDetailPage(page)
    const copy = byData(tree, 'data-enterprise-preset-copy')
    expect(copy).toHaveLength(1)
    copy[0]?.['onClick']?.()
    expect(onCopyInstruction).toHaveBeenCalledWith(page.row)
    // 同一份 facts：复制过的那一行在详情里的按钮文案同样是「已复制」。
    expect(textOf(EnterprisePresetDetailPage({ ...page, facts: { ...page.facts, copied: true } }))).toContain(ENTERPRISE_PRESET_COPIED_TEXT)
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
    // 配方行 facts 唯一入口：1 处定义 + 行渲染 1 处 + 详情输入构造 1 处 = 3（详情与行不可能各算一套）。
    expect(count(/enterpriseMarketPresetRowFacts\(/g)).toBe(3)
    // 配方行投影唯一入口：1 处定义 + 控制器 1 处 = 2（没有第二处造行的写法）。
    expect(count(/enterpriseMarketPresetRows\(/g)).toBe(2)
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
