/**
 * [INPUT]: 依赖 marketplace-entry 的注册常量、组件清单/摘要/状态/开关语义纯投影、企业技能行投影与可见性门控、入口组件与版本签组件本身，以及 local-api-decode 的 `EnterpriseRuntimeSkill` 形状
 * [OUTPUT]: 验证入口身份常量、卡片一句话的单行约束、组件清单（插件/技能/配方）顺序与 reserved 语义、计数摘要口径、summary/page 两视图结构（含「包含的组件」标题与逐行开关，且 page 不重画标题/desc）、版本签只对本条目 subject 出、企业插件节的归并与门控，以及**企业技能节的行投影（复用技能 tab 元信息口径）/可见性门控/计数/折叠开关/一键安装开关**（与企业插件行同范式：已装态由 Host 回传、在途禁用、缺席动作恒禁用）
 * [POS]: dsh-ui 插件市场入口的产品词汇门禁，真实渲染与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseRuntimeSkill } from '../src/local-api-decode.js'
import {
  ENTERPRISE_MARKET_COMPONENTS,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  ENTERPRISE_MARKET_PLAN,
  ENTERPRISE_MARKET_SUMMARY,
  BadgeView,
  EnterpriseMarketBadge,
  EnterpriseMarketEntry,
  enterpriseMarketComponentDot,
  enterpriseMarketComponentEnabled,
  enterpriseMarketComponentState,
  enterpriseMarketComponentSummary,
  enterpriseMarketComponentSummaryText,
  enterpriseMarketComponentSwitchDisabled,
  enterpriseMarketEntryPlan,
  enterpriseMarketEntrySummary,
  enterpriseMarketPluginRows,
  enterpriseMarketPluginSectionVisible,
  enterpriseMarketSectionOpen,
  enterpriseMarketSkillRows,
  enterpriseMarketSkillSectionVisible,
  enterpriseMarketVersionTag,
  enterpriseMarketSkillState,
  enterprisePluginDot,
  ENTERPRISE_MARKET_SECTION_IDS,
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
  Modal: vi.fn(),
}))

/** 收集元素树里的可见文本，跳过 style 内容，用于无 DOM 断言页面结构。 */
function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return ''
  return textOf(node.props.children as ReactNode)
}

/** 「企业技能」节的目录 fixture：与 skill-market.spec 的列表投影同形（列表态 versionId/skills 为空）。 */
const SKILL: EnterpriseRuntimeSkill = {
  id: '1902500000000000001',
  skillId: 'meeting-notes',
  displayName: '会议纪要技能组',
  description: '把会议录音与转写整理成结构化纪要。',
  sourceDshVersion: '0.1.7-rc.2',
  sizeBytes: 40_960,
  skillCount: 2,
  updatedAt: '2026-09-30T08:00:00Z',
  versionId: '',
  skills: [],
}

describe('enterprise marketplace entry', () => {
  it('occupies one plugins.item id after the four official configuration cards', () => {
    expect(ENTERPRISE_MARKET_ENTRY_ID).toBe('plugin-market')
    expect(ENTERPRISE_MARKET_ENTRY_LABEL).toBe('插件市场')
    expect(ENTERPRISE_MARKET_ENTRY_ORDER).toBeGreaterThan(40)
  })

  it('keeps the summary a single line because the official page renders it twice', () => {
    const summary = enterpriseMarketEntrySummary()
    expect(summary).toBe(ENTERPRISE_MARKET_SUMMARY)
    expect(summary.trim()).toBe(summary)
    expect(summary).not.toContain('\n')
    expect(summary.length).toBeGreaterThan(0)
  })

  it('lists the page tabs as 插件/技能/配方 with 配方 the only reserved tab', () => {
    const plan = enterpriseMarketEntryPlan()
    expect(plan).toBe(ENTERPRISE_MARKET_PLAN)
    expect(plan.map(tab => tab.id)).toEqual(['plugins', 'skills', 'presets'])
    expect(plan.map(tab => tab.label)).toEqual(['插件', '技能', '配方'])
    expect(plan.slice(0, 2).map(tab => tab.note)).not.toContain('预留')
    expect(plan[1].note).toBe('已排期')
    expect(plan[2].note).toBe('预留')
  })

  it('renders the single-line summary for the card and the component page for the detail view', () => {
    const summary = EnterpriseMarketEntry({ view: 'summary' })
    expect(isValidElement(summary)).toBe(true)
    expect(textOf(summary)).toBe(ENTERPRISE_MARKET_SUMMARY)

    const page = EnterpriseMarketEntry({ view: 'page' })
    expect(isValidElement(page)).toBe(true)
    expect(isValidElement(page) ? page.props['aria-label'] : undefined).toBe(ENTERPRISE_MARKET_ENTRY_LABEL)
    const text = textOf(page)
    for (const tab of ENTERPRISE_MARKET_PLAN) expect(text).toContain(tab.label)
    expect(text).toContain('预留')
  })

  it('lists exactly three components in order with only presets reserved', () => {
    expect(ENTERPRISE_MARKET_COMPONENTS.map(row => row.id)).toEqual(['plugins', 'skills', 'presets'])
    expect(ENTERPRISE_MARKET_COMPONENTS.map(row => row.label)).toEqual(['插件', '技能', '配方'])
    expect(ENTERPRISE_MARKET_COMPONENTS.filter(row => row.reserved).map(row => row.id)).toEqual(['presets'])
    expect(ENTERPRISE_MARKET_COMPONENTS[0]?.reserved).toBe(false)
    expect(ENTERPRISE_MARKET_COMPONENTS[1]?.reserved).toBe(false)
  })

  it('derives per-component enablement, state, dot, and switch discipline from session usability', () => {
    // 插件/技能行同口径：未登录 → 不可用/需登录/idle/可拨动（有回调时），已登录 → 可用/可用/done/禁用（防假切换）。
    for (const id of ['plugins', 'skills'] as const) {
      expect(enterpriseMarketComponentEnabled(id, false)).toBe(false)
      expect(enterpriseMarketComponentState(id, false)).toBe('需登录')
      expect(enterpriseMarketComponentDot(id, false)).toBe('idle')
      expect(enterpriseMarketComponentSwitchDisabled(id, false, true)).toBe(false)
      expect(enterpriseMarketComponentEnabled(id, true)).toBe(true)
      expect(enterpriseMarketComponentState(id, true)).toBe('可用')
      expect(enterpriseMarketComponentDot(id, true)).toBe('done')
      expect(enterpriseMarketComponentSwitchDisabled(id, true, true)).toBe(true)
    }
    // 配方仍预留：恒不可用/预留/idle，开关恒禁用（含无回调态）。
    expect(enterpriseMarketComponentEnabled('presets', true)).toBe(false)
    expect(enterpriseMarketComponentState('presets', true)).toBe('预留')
    expect(enterpriseMarketComponentDot('presets', true)).toBe('idle')
    expect(enterpriseMarketComponentSwitchDisabled('presets', true, true)).toBe(true)
    expect(enterpriseMarketComponentSwitchDisabled('presets', false, false)).toBe(true)
    // 无登录回调时：插件/技能行开关也禁用（不提供假切换入口）。
    expect(enterpriseMarketComponentSwitchDisabled('plugins', false, false)).toBe(true)
    expect(enterpriseMarketComponentSwitchDisabled('skills', false, false)).toBe(true)
  })

  it('counts the component summary with the official partsSummary 口径 (共 N 个 · N 可用 · N 预留)', () => {
    expect(enterpriseMarketComponentSummary()).toEqual({ total: 3, ready: 0, reserved: 1 })
    expect(enterpriseMarketComponentSummaryText()).toBe('共 3 个 · 1 预留')
    expect(enterpriseMarketComponentSummary(undefined, true)).toEqual({ total: 3, ready: 2, reserved: 1 })
    expect(enterpriseMarketComponentSummaryText(undefined, true)).toBe('共 3 个 · 2 可用 · 1 预留')
    // 逐行状态与三段计数一致：1 预留 + 未登录的插件/技能需登录 → 不产出「可用」段。
    expect(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false)).toBe('共 3 个 · 1 预留')
  })

  it('renders the detail page with the official component-section heading and per-row switch labels', () => {
    const page = EnterpriseMarketEntry({ view: 'page' })
    expect(isValidElement(page)).toBe(true)
    const text = textOf(page)
    expect(text).toContain('包含的组件')
    expect(text).toContain(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false))
    for (const row of ENTERPRISE_MARKET_COMPONENTS) expect(text).toContain(row.label)
    // 回归锁：详情页正文不重复标题与摘要——标题 h3 由官方 ItemDetail 用 item.label 渲染（我们不再画），
    // 卡片摘要只在 summary 视图出现，desc 已按产品决策删除，详情页只剩版本签 + 组件列表。
    expect(text).not.toContain('企业插件、技能与配方的统一入口')
    expect(text).not.toContain(ENTERPRISE_MARKET_SUMMARY)
    expect(text).not.toContain(ENTERPRISE_MARKET_ENTRY_LABEL)
  })

  // 回归锁：注入 store（有 onOpenLogin 回调）后，头部总开关与插件行开关必须可点；
  // 此前 client.tsx 未给 plugins.item 注 inject 导致三开关恒 disabled（点了没反应）的 bug 不许再犯。
  it('keeps the header and plugins-row switches clickable when a login action is wired (no dead control)', () => {
    const onOpenLogin = vi.fn()
    const page = EnterpriseMarketEntry({ view: 'page', sessionUsable: false, onOpenLogin })
    expect(isValidElement(page)).toBe(true)
    // page 里只有三行组件开关（头部总开关已挪到 plugins.detail.badge 槽，由 BadgeView 测试）。
    const switches = collectSwitchProps(page)
    expect(switches).toHaveLength(3)
    // 插件行与技能行开关未登录且有回调 → 必须可点（disabled false），配方恒禁用（预留）。
    // 注意：Switch 的无障碍名走 `label` prop（vi.fn() mock 不展开成 aria-label），切换动作走 `onChange`。
    const pluginsSwitch = switches.find(props => props.label === '启用组件 插件')
    expect(pluginsSwitch).toBeDefined()
    expect(pluginsSwitch?.checked).toBe(false)
    expect(pluginsSwitch?.disabled).toBe(false)
    const skillsSwitch = switches.find(props => props.label === '启用组件 技能')
    expect(skillsSwitch?.checked).toBe(false)
    expect(skillsSwitch?.disabled).toBe(false)
    const presetsSwitch = switches.find(props => props.label === '启用组件 配方')
    expect(presetsSwitch?.disabled).toBe(true)
    // page 不再含头部总开关（它在 badge 槽）。
    expect(switches.find(props => props.label === '启用插件市场')).toBeUndefined()
  })

  // 版本号 + 标签走官方 plugins.detail.badge 槽（titleRow 里 h3 旁，照智能体团队）：只对本条目 subject 生效。
  it('gates the badge on the plugin-market subject and renders version+label tags (no switch)', () => {
    // subject 过滤：其余 subject 一律 null（hook 前就返回，不碰状态）。
    expect(EnterpriseMarketBadge({ subject: { kind: 'item', id: 'shell' } })).toBeNull()
    expect(EnterpriseMarketBadge({ subject: { kind: 'bundle', pkg: { name: 'x' } } })).toBeNull()
    // 纯呈现（BadgeView 不调 hook）：有版本 → 版本签 + 标签；无版本 → 只有标签。
    const withVersion = BadgeView({ version: '0.1.0' })
    expect(textOf(withVersion)).toContain('v0.1.0')
    expect(textOf(withVersion)).toContain('预览版')
    // 标题行只有签、无可拨开关（拨不动的开关像坏的，产品决策去掉）。
    expect(collectSwitchProps(withVersion)).toHaveLength(0)
    const withoutVersion = BadgeView({})
    expect(textOf(withoutVersion)).toContain('预览版')
    expect(textOf(withoutVersion)).not.toContain('v')
    // 版本签口径照官方 versionTag 'v{version}'。
    expect(enterpriseMarketVersionTag('1.2.3')).toBe('v1.2.3')
    expect(enterpriseMarketVersionTag(undefined)).toBeUndefined()
    expect(enterpriseMarketVersionTag('')).toBeUndefined()
  })

  // 「企业插件」节：catalog + 本机态归并、仅当「插件」组件 ON 且有记录时渲染。
  it('merges catalog and local records into enterprise plugin rows', () => {
    const catalog = [
      { pluginVersionId: 'v1', packageName: 'ent-a', version: '1.2.0', sizeBytes: 1024, operatingSystems: ['darwin'] },
      { pluginVersionId: 'v2', packageName: 'ent-b', version: '2.0.0', sizeBytes: 2048, operatingSystems: ['darwin'] },
    ] as const
    const local = [
      { packageName: 'ent-b', version: '2.0.0', desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null },
      { packageName: 'ent-c', version: null, desiredRevision: 2, desiredState: 'INSTALLED', state: 'RESTART_REQUIRED', lastErrorCode: null },
    ] as const
    const rows = enterpriseMarketPluginRows(catalog, local)
    // 目录顺序优先，本机独有（ent-c）追加；三行都归并出来。
    expect(rows.map(r => r.packageName)).toEqual(['ent-a', 'ent-b', 'ent-c'])
    // ent-a：只在目录 → 可选安装、版本取目录、inCatalog。
    expect(rows[0]).toMatchObject({ version: '1.2.0', state: 'EXPECTED', inCatalog: true })
    // ent-b：目录 + 本机 ACTIVE → 本机态覆盖。
    expect(rows[1]).toMatchObject({ version: '2.0.0', state: 'ACTIVE', inCatalog: true })
    // ent-c：只在本机（已下架）→ inCatalog false，版本取本机。
    expect(rows[2]).toMatchObject({ version: null, state: 'RESTART_REQUIRED', inCatalog: false })
  })

  it('renders the enterprise plugin section only when the plugins component is on and rows exist', () => {
    expect(enterpriseMarketPluginSectionVisible(true, [{ packageName: 'x' } as never])).toBe(true)
    expect(enterpriseMarketPluginSectionVisible(false, [{ packageName: 'x' } as never])).toBe(false)
    expect(enterpriseMarketPluginSectionVisible(true, [])).toBe(false)
    expect(enterpriseMarketPluginSectionVisible(false, [])).toBe(false)
    // 状态点映射：已装 done / 失败 error / 进行中 ongoing / 等待 warning / 其余 idle。
    expect(enterprisePluginDot('ACTIVE')).toBe('done')
    expect(enterprisePluginDot('FAILED')).toBe('error')
    expect(enterprisePluginDot('INSTALLING')).toBe('ongoing')
    expect(enterprisePluginDot('RESTART_REQUIRED')).toBe('warning')
    expect(enterprisePluginDot('EXPECTED')).toBe('idle')
  })

  // page 在「插件」组件 ON 时渲染企业插件节、OFF 时不渲染（含 catalog 数据）。
  it('appends the enterprise plugin section in page only when the plugins component is on', () => {
    const enterprisePlugins = [
      { packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true },
      { packageName: 'ent-b', version: '2.0.0', state: 'EXPECTED', inCatalog: true },
    ] as const
    // OFF：sessionUsable=false → 「插件」组件未开启 → 不出企业插件节。
    const off = EnterpriseMarketEntry({ view: 'page', sessionUsable: false, enterprisePlugins: enterprisePlugins as never })
    expect(textOf(off)).not.toContain('企业插件')
    expect(textOf(off)).not.toContain('ent-a')
    // ON：sessionUsable=true → 「插件」组件开启 → 出企业插件节 + 逐个包名 + 「企业插件」标题。
    const on = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterprisePlugins: enterprisePlugins as never })
    const text = textOf(on)
    expect(text).toContain('企业插件')
    expect(text).toContain('ent-a')
    expect(text).toContain('ent-b')
    expect(text).toContain('企业发布 · v1.2.0')
    // 两节的 section 都在：包含的组件 + 企业插件。
    expect(text).toContain('包含的组件')
    // 回归锁：企业插件卡片只两行文案（包名 + 一句话说明），照官方已安装卡片 CardHead——
    // 不含详情页 RowsSection 的 mono 模块名行（那是 rowMain 结构，官方卡片没有）。
    expect(text).not.toContain('enterprise plugins · catalog')
    expect(text).not.toContain('已装 · v')
  })

  // 「企业技能」节：目录 → 只读行（复用技能 tab 的元信息口径），与企业插件节同规则门控。
  it('projects the enterprise skill catalog into read-only rows reusing the skill-tab meta 口径', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组', description: '' },
    ])
    expect(rows.map(row => row.id)).toEqual(['1902500000000000001', '1902500000000000002'])
    // 元信息与「企业设置 → 技能」卡片同一份 enterpriseSkillMeta 口径（DSH 版本 · 大小 · N 个技能）。
    expect(rows[0]).toEqual({
      id: '1902500000000000001',
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      meta: 'DSH 0.1.7-rc.2 · 40.0 KiB · 2 个技能',
    })
    // 空描述归一为固定占位，与技能 tab 详情弹窗同一句话；目录顺序原样保留（技能无本机受管态，不做归并）。
    expect(rows[1]?.description).toBe('（暂无描述）')
    expect(enterpriseMarketSkillRows()).toEqual([])
  })

  it('renders the enterprise skill section only when the skills component is on and the catalog is non-empty', () => {
    expect(enterpriseMarketSkillSectionVisible(true, [{ id: '1' } as never])).toBe(true)
    expect(enterpriseMarketSkillSectionVisible(false, [{ id: '1' } as never])).toBe(false)
    expect(enterpriseMarketSkillSectionVisible(true, [])).toBe(false)
    expect(enterpriseMarketSkillSectionVisible(false, [])).toBe(false)
  })

  // page 在「技能」组件 ON 且目录非空时渲染企业技能节、OFF 时不渲染；技能行与企业插件行同范式：
  // 一行阅读事实 + 一个**真实可拨**的安装开关（已装态由 Host 回传，纯函数体不猜、不乐观）。
  it('appends the enterprise skill section in page only when the skills component is on, and wires its install switch', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    // OFF：sessionUsable=false → 「技能」组件未开启 → 不出企业技能节。
    const off = EnterpriseMarketEntry({ view: 'page', sessionUsable: false, enterpriseSkills })
    expect(textOf(off)).not.toContain('企业技能')
    expect(textOf(off)).not.toContain('会议纪要技能组')
    // ON：标题 + 计数（`N 个`）+ 包名 + 元信息。
    const on = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills })
    const text = textOf(on)
    expect(text).toContain('企业技能')
    expect(text).toContain('1 个')
    expect(text).toContain('会议纪要技能组')
    expect(text).toContain('把会议录音与转写整理成结构化纪要。')
    expect(text).toContain('DSH 0.1.7-rc.2 · 40.0 KiB · 2 个技能')
    // 数据钩子命名与企业插件节同风格（`enterprise-skills`）。
    expect(collectSectionByHook(on, 'enterprise-skills')).not.toBeUndefined()
    expect(collectSectionByHook(on, 'enterprise-plugins')).toBeUndefined()
    // 技能行现在有开关：三个组件行 + 一个技能行 = 4；未注入动作时禁用（不提供假切换）。
    expect(collectSwitchProps(on)).toHaveLength(4)
    const unwired = collectSwitchProps(on).at(-1)
    expect(unwired?.['label']).toBe('安装企业技能 会议纪要技能组')
    expect(unwired?.['checked']).toBe(false)
    expect(unwired?.['disabled']).toBe(true)
    // 注入动作后开关可拨，并把 (row, next) 原样交给调用方。
    const onToggleSkill = vi.fn()
    const wired = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills, onToggleSkill })
    const skillSwitch = collectSwitchProps(wired).at(-1)
    expect(skillSwitch?.['disabled']).toBe(false)
    skillSwitch?.['onChange']?.(true)
    expect(onToggleSkill).toHaveBeenCalledWith(expect.objectContaining({ id: '1902500000000000001' }), true)
  })

  // 已装态与在途动作是三个彼此独立的输入：已装清单定 checked、pendingSkillId 定禁用与状态钩子。
  it('projects each skill row state from the installed ids and the pending action, never from optimism', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    expect(enterpriseMarketSkillState(undefined, undefined, row)).toBe('AVAILABLE')
    expect(enterpriseMarketSkillState([], undefined, row)).toBe('AVAILABLE')
    expect(enterpriseMarketSkillState(['1902500000000000001'], undefined, row)).toBe('INSTALLED')
    expect(enterpriseMarketSkillState(['1902500000000000001'], '1902500000000000001', row)).toBe('INSTALLING')
    expect(enterpriseMarketSkillState([], '1902500000000000001', row, false)).toBe('REMOVING')
    expect(enterpriseMarketSkillState(['1902500000000000001'], '1902500000000000002', row)).toBe('INSTALLED')

    const installedTree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [row],
      installedSkillIds: ['1902500000000000001'],
      onToggleSkill: vi.fn(),
    })
    const installedSwitch = collectSwitchProps(installedTree).at(-1)
    expect(installedSwitch?.['checked']).toBe(true)
    expect(installedSwitch?.['disabled']).toBe(false)
    expect(installedSwitch?.['title']).toBe('点此卸载')
    // 在途行的开关必须禁用：并发动作会互相覆盖已装清单。
    const pendingTree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [row],
      installedSkillIds: [],
      pendingSkillId: '1902500000000000001',
      onToggleSkill: vi.fn(),
    })
    expect(collectSwitchProps(pendingTree).at(-1)?.['disabled']).toBe(true)
    expect(textOf(pendingTree)).toContain('会议纪要技能组')
  })

  // 折叠（照官方 PluginInventory groupToggle）：企业技能节与另两节共用同一份 aria 契约与折叠语义。
  it('toggles the enterprise-skills section with the same aria contract as the other two sections', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    expect(ENTERPRISE_MARKET_SECTION_IDS.enterpriseSkills).toBe('enterprise-skills')
    expect(enterpriseMarketSectionOpen(undefined, 'enterpriseSkills')).toBe(false)
    expect(enterpriseMarketSectionOpen(
      { components: false, enterprisePlugins: false, enterpriseSkills: true },
      'enterpriseSkills',
    )).toBe(true)

    const collapsed = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      expandedSections: { components: false, enterprisePlugins: false, enterpriseSkills: false },
      onToggleSection: vi.fn(),
    })
    const collapsedBtn = collectButtonProps(collapsed)
      .find(button => button['aria-controls'] === 'market-section-enterprise-skills')
    expect(collapsedBtn).toBeDefined()
    expect(collapsedBtn?.['aria-expanded']).toBe(false)
    // 收起时列表整段不进 DOM，但节头/标题/计数仍在。
    expect(collectElementById(collapsed, 'market-section-enterprise-skills')).toBeUndefined()
    expect(textOf(collapsed)).toContain('企业技能')

    const expanded = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      expandedSections: { components: false, enterprisePlugins: false, enterpriseSkills: true },
      onToggleSection: vi.fn(),
    })
    expect(collectButtonProps(expanded)
      .find(button => button['aria-controls'] === 'market-section-enterprise-skills')?.['aria-expanded']).toBe(true)
    expect(collectElementById(expanded, 'market-section-enterprise-skills')).not.toBeUndefined()

    const spy = vi.fn()
    const clickable = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      expandedSections: { components: false, enterprisePlugins: false, enterpriseSkills: false },
      onToggleSection: spy,
    })
    collectButtonProps(clickable)
      .find(button => button['aria-controls'] === 'market-section-enterprise-skills')?.onClick?.()
    expect(spy).toHaveBeenCalledWith('enterpriseSkills')
  })

  // 折叠（照官方 PluginInventory groupToggle）：默认折叠、aria-expanded/controls 齐全、chevron 旋转。
  it('collapses all three sections by default when expandedSections is provided, and toggles aria-expanded', () => {
    // 缺席（bare call）→ 默认折叠（照官方 `?? false`）；页面纯函数体不传 expandedSections 时会传 defaultOpen=true（测试直调得完整树）。
    expect(enterpriseMarketSectionOpen(undefined, 'components')).toBe(false)
    expect(enterpriseMarketSectionOpen(undefined, 'enterprisePlugins')).toBe(false)
    expect(enterpriseMarketSectionOpen(undefined, 'enterpriseSkills')).toBe(false)
    expect(enterpriseMarketSectionOpen(undefined, 'components', true)).toBe(true)
    // 显式 provided → 按值。
    const allClosed = { components: false, enterprisePlugins: false, enterpriseSkills: false }
    expect(enterpriseMarketSectionOpen(allClosed, 'components')).toBe(false)
    expect(enterpriseMarketSectionOpen({ ...allClosed, components: true }, 'components')).toBe(true)
    expect(enterpriseMarketSectionOpen({ ...allClosed, components: true }, 'enterprisePlugins')).toBe(false)
    expect(ENTERPRISE_MARKET_SECTION_IDS.components).toBe('components')
    expect(ENTERPRISE_MARKET_SECTION_IDS.enterprisePlugins).toBe('enterprise-plugins')

    // 折叠态：两节内容都 hidden，但节头按钮 + 标题 + 计数仍在（可再点开）。
    const collapsed = EnterpriseMarketEntry({
      view: 'page',
      expandedSections: allClosed,
      onToggleSection: vi.fn(),
    })
    const collapsedButtons = collectButtonProps(collapsed)
    const compBtn = collapsedButtons.find(b => b['aria-controls'] === 'market-section-components')
    expect(compBtn).toBeDefined()
    expect(compBtn?.['aria-expanded']).toBe(false)
    // 折叠时列表整段不进 DOM（条件渲染，照官方 groupBody）——`.own-market-rows{display:flex}` 会覆盖
    // UA 的 `[hidden]{display:none}`，故不用 hidden 属性，直接不渲染 <ul>。节头/标题/计数仍在文本里。
    expect(collectElementById(collapsed, 'market-section-components')).toBeUndefined()
    expect(textOf(collapsed)).toContain('包含的组件')

    // 展开态：aria-expanded=true、列表在 DOM。
    const expanded = EnterpriseMarketEntry({
      view: 'page',
      expandedSections: { components: true, enterprisePlugins: true, enterpriseSkills: true },
      onToggleSection: vi.fn(),
    })
    const expandedButtons = collectButtonProps(expanded)
    expect(expandedButtons.find(b => b['aria-controls'] === 'market-section-components')?.['aria-expanded']).toBe(true)
    expect(collectElementById(expanded, 'market-section-components')).not.toBeUndefined()
    // 点节头触发 onToggleSection。
    const spy = vi.fn()
    const clickable = EnterpriseMarketEntry({
      view: 'page',
      expandedSections: allClosed,
      onToggleSection: spy,
    })
    collectButtonProps(clickable).find(b => b['aria-controls'] === 'market-section-components')?.onClick?.()
    expect(spy).toHaveBeenCalledWith('components')
  })
})

/** 收集元素树里所有 `<button>` 的 props（节头 groupToggle），递归展开函数组件子树。 */
function collectButtonProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectButtonProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === 'button') { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') collectButtonProps((node.type as (p: unknown) => ReactNode)(props), acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectButtonProps(value as ReactNode, acc)
  }
  return acc
}

/** 找 id 匹配的元素（折叠时列表条件渲染不进 DOM，返回 undefined；展开时返回该元素）。 */
function collectElementById(node: ReactNode, id: string): unknown {
  if (Array.isArray(node)) { for (const child of node) { const r = collectElementById(child, id); if (r !== undefined) return r } return undefined }
  if (!isValidElement(node)) return undefined
  const props = node.props as Record<string, unknown>
  if (props['id'] === id) return node
  if (typeof node.type === 'function') { const r = collectElementById((node.type as (p: unknown) => ReactNode)(props), id); if (r !== undefined) return r }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') { const r = collectElementById(value as ReactNode, id); if (r !== undefined) return r }
  }
  return undefined
}

/** 找 `data-market-section` 匹配的节元素（锁两节的数据钩子命名）。 */
function collectSectionByHook(node: ReactNode, hook: string): unknown {
  if (Array.isArray(node)) {
    for (const child of node) { const r = collectSectionByHook(child, hook); if (r !== undefined) return r }
    return undefined
  }
  if (!isValidElement(node)) return undefined
  const props = node.props as Record<string, unknown>
  if (props['data-market-section'] === hook) return node
  if (typeof node.type === 'function') {
    const r = collectSectionByHook((node.type as (p: unknown) => ReactNode)(props), hook)
    if (r !== undefined) return r
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') {
      const r = collectSectionByHook(value as ReactNode, hook)
      if (r !== undefined) return r
    }
  }
  return undefined
}

/** 收集元素树里所有 `<Switch>` 的 props（`vi.fn()` mock 的组件由 JSX 引用，props 存于 element.props）；嵌套函数组件先展开再递归。 */
function collectSwitchProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectSwitchProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === (Switch as unknown)) { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 嵌套函数组件（DetailHead 等）：就地渲染一次，把它返回的树继续递归。
    collectSwitchProps((node.type as (p: unknown) => ReactNode)(props), acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectSwitchProps(value as ReactNode, acc)
  }
  return acc
}
