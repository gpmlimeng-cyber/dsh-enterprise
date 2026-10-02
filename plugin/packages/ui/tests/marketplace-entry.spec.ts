/**
 * [INPUT]: 依赖 marketplace-entry 的注册常量、组件清单/摘要/状态/开关语义纯投影、企业插件行投影、企业技能行投影（含详情归并的中心版本 `latestVersionId`）与可见性门控、技能节受管态纯投影 `enterpriseMarketSkillState`、「有更新」判定 `enterpriseMarketSkillHasUpdate`/`enterpriseMarketSkillRowHasUpdate` 与辅助标签投影 `enterpriseMarketSkillUpdateTag`、三节默认展开态常量 `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败行内提示投影 `enterpriseMarketActionErrorLabel`、入口组件与版本签组件本身，以及 local-api-decode 的 `EnterpriseRuntimeSkill`/`EnterpriseInstalledSkill` 形状
 * [OUTPUT]: 验证入口身份常量、卡片一句话的单行约束、组件清单（插件/技能/配方）顺序与 reserved 语义、计数摘要口径、summary/page 两视图结构（含「包含的组件」标题与逐行开关，且 page 不重画标题/desc）、版本签只对本条目 subject 出、企业插件节的归并与门控，以及**企业技能节的官方两行卡片**（标题 + 描述各自成行、描述单行省略、旧元信息行退场）/可见性门控/计数/折叠开关/**默认展开**（`ENTERPRISE_MARKET_DEFAULT_EXPANDED` 三值全 true，未装的技能也照列）/右侧那枚官方 `Switch`（`checked` 反映已装、在途 `disabled`、`label` 给动作语义、`onChange(next)` 两个方向都回调）与受管态投影（未装/已装/有更新/在途），以及**开关左侧那枚辅助标签**（只在「有更新」时出现、`aria-label`=`更新企业技能 X`、点击走安装方向、在途 `disabled` 不消失、未装/已装同版本一律不出现、标签严格排在 Switch 左侧），以及**「有更新」独立用例**（只有两侧 `versionId` 参与、`sha256` 换值不改结论、缺任一侧不判），以及**只改技能行**的回归锁（技能行恢复 Switch + 补辅助标签、企业插件行一字未动），以及**两节行上的失败可见反馈**（失败 → 该行 role="alert" + 稳定错误码、只落失败行、失败后开关仍可拨重试、成功路径不出现该提示）
 * [POS]: dsh-ui 插件市场入口的产品词汇门禁，真实渲染与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseInstalledSkill, EnterpriseRuntimeSkill } from '../src/local-api-decode.js'
import {
  ENTERPRISE_MARKET_COMPONENTS,
  ENTERPRISE_MARKET_DEFAULT_EXPANDED,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  ENTERPRISE_MARKET_PLAN,
  ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
  ENTERPRISE_MARKET_SKILL_UPDATE_TAG,
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
  enterpriseMarketActionErrorLabel,
  enterpriseMarketPluginRows,
  enterpriseMarketPluginSectionVisible,
  enterpriseMarketSectionOpen,
  enterpriseMarketSkillHasUpdate,
  enterpriseMarketSkillRowHasUpdate,
  enterpriseMarketSkillRows,
  enterpriseMarketSkillSectionVisible,
  enterpriseMarketSkillState,
  enterpriseMarketSkillUpdateTag,
  enterpriseMarketVersionTag,
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

/**
 * 中心**详情**投影 fixture：与列表投影同形，但 `versionId` 是真值、`skills` 有条目
 * （`skill-api-decode` 的列表解码把 `versionId` 写死为空串，只有 `/skills/{id}` 详情带真值）。
 */
const SKILL_DETAIL: EnterpriseRuntimeSkill = {
  ...SKILL,
  versionId: '1902500000000000101',
  skills: [{ name: 'meeting-notes', description: '把会议记录整理成结构化纪要', modelInvocable: true, userInvocable: true }],
}

/** 带中心当前版本的行（= hook 入口把详情按 id 归并后的形态）。 */
function updatableRow(): ReturnType<typeof enterpriseMarketSkillRows>[number] {
  return enterpriseMarketSkillRows([SKILL], [SKILL_DETAIL])[0]!
}

/** 已装记录 fixture（Host 回传的落盘真值）：命中 `packageId` 即该行开关 `checked`。 */
function installedSkill(versionId: string, id: string = SKILL.id): EnterpriseInstalledSkill {
  return {
    packageId: id,
    skillId: SKILL.skillId,
    displayName: SKILL.displayName,
    versionId,
    sha256: 'a'.repeat(64),
    names: ['meeting-notes'],
    installedAt: '2026-09-30T08:00:00Z',
  }
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

  // 「企业技能」节：目录 → 官方两行卡片行（标题 + 描述），后台预置的全部技能照列、不做过滤或归并。
  it('projects the enterprise skill catalog into official two-line rows without filtering or merging', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组', description: '' },
    ])
    expect(rows.map(row => row.id)).toEqual(['1902500000000000001', '1902500000000000002'])
    // 行只带界面真正渲染的两行文案 + 中心当前版本：列表投影没有详情时 `latestVersionId` 是空串（不猜）。
    expect(rows[0]).toEqual({
      id: '1902500000000000001',
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      latestVersionId: '',
    })
    expect(rows[0]?.latestVersionId).toBe('')
    // 中心当前版本只能从**详情投影**来（列表投影的 versionId 恒为空串）：按 id 归并进行上。
    const merged = enterpriseMarketSkillRows([SKILL], [SKILL_DETAIL])
    expect(merged[0]?.latestVersionId).toBe('1902500000000000101')
    // 详情归并严格按 id：别的包的详情不落到本行（不猜、不错配）。
    expect(enterpriseMarketSkillRows([SKILL], [{ ...SKILL_DETAIL, id: 'x' }])[0]?.latestVersionId).toBe('')
    // 空描述归一为固定占位，与技能 tab 详情弹窗同一句话；目录顺序原样保留，**不做任何过滤**。
    expect(rows[1]?.description).toBe('（暂无描述）')
    expect(enterpriseMarketSkillRows()).toEqual([])
  })

  it('renders the enterprise skill section only when the skills component is on and the catalog is non-empty', () => {
    expect(enterpriseMarketSkillSectionVisible(true, [{ id: '1' } as never])).toBe(true)
    expect(enterpriseMarketSkillSectionVisible(false, [{ id: '1' } as never])).toBe(false)
    expect(enterpriseMarketSkillSectionVisible(true, [])).toBe(false)
    expect(enterpriseMarketSkillSectionVisible(false, [])).toBe(false)
  })

  // page 在「技能」组件 ON 且目录非空时渲染企业技能节、OFF 时不渲染；技能行 === 官方两行卡片
  // （第 1 行标题、第 2 行描述，描述单行省略）+ 右侧那枚官方 Switch（辅助标签只在「有更新」时补位）。
  it('renders the two-line skill card with the official Switch as the row primary control', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    // OFF：sessionUsable=false → 「技能」组件未开启 → 不出企业技能节。
    const off = EnterpriseMarketEntry({ view: 'page', sessionUsable: false, enterpriseSkills })
    expect(textOf(off)).not.toContain('企业技能')
    expect(textOf(off)).not.toContain('会议纪要技能组')
    // ON：标题 + 计数（`N 个`）+ 两行文案。
    const on = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills })
    const text = textOf(on)
    expect(text).toContain('企业技能')
    expect(text).toContain('1 个')
    // 两行结构：第 1 行标题、第 2 行描述各自成行（照官方已安装卡片 CardHead）。
    expect(collectByClassName(on, 'own-market-cardId').map(props => props['children'])).toEqual(['会议纪要技能组'])
    expect(collectByClassName(on, 'own-market-cardDesc').map(props => props.children))
      .toEqual(['把会议录音与转写整理成结构化纪要。'])
    // 描述单行：取值照官方 desc 13/18 tertiary + 单行 clamp，绝不换行撑高卡片。
    const css = collectStyleText(on)
    expect(cssRuleBody(css, '.own-market-cardDesc')).toContain('font-size:13px')
    expect(cssRuleBody(css, '.own-market-cardDesc')).toContain('line-height:18px')
    expect(cssRuleBody(css, '.own-market-cardDesc')).toContain('-webkit-line-clamp:1')
    expect(cssRuleBody(css, '.own-market-cardDesc')).toContain('overflow:hidden')
    expect(cssRuleBody(css, '.own-market-cardId')).toContain('font-size:14px')
    expect(cssRuleBody(css, '.own-market-cardId')).toContain('text-overflow:ellipsis')
    // 旧元信息行退场：不再堆「DSH 版本 · 大小 · N 个技能」（未装行右侧就一个开关）。
    expect(text).not.toContain('DSH 0.1.7-rc.2')
    // 右侧恢复为官方 Switch：3 个组件行开关 + 1 个技能行开关；技能行不再占 rowState 版式，
    // 且**未装行不出任何辅助标签**（那枚按钮只在「有更新」时出现，见下面的独立用例）。
    expect(collectByClassName(on, 'own-market-rowState')).toHaveLength(3)
    expect(collectByClassName(on, 'own-market-skillTag')).toEqual([])
    expect(collectDataValues(on, 'data-enterprise-skill-tag')).toEqual([])
    const switches = collectSwitchProps(on)
    expect(switches).toHaveLength(4)
    const skillSwitch = switches.find(props => String(props['label']).includes('会议纪要技能组'))
    expect(skillSwitch).toBeDefined()
    // 未注入动作即禁用（不提供假入口），但语义照旧是「安装」方向。
    expect(skillSwitch?.['checked']).toBe(false)
    expect(skillSwitch?.['disabled']).toBe(true)
    expect(skillSwitch?.['label']).toBe('安装企业技能 会议纪要技能组')
    // 数据钩子命名与企业插件节同风格（`enterprise-skills`）。
    expect(collectSectionByHook(on, 'enterprise-skills')).not.toBeUndefined()
    expect(collectSectionByHook(on, 'enterprise-plugins')).toBeUndefined()
    // 受管态仍如实落在行上（`AVAILABLE` = 未装可装，那枚开关据此关闭）。
    expect(collectDataValues(on, 'data-enterprise-skill-state')).toEqual(['AVAILABLE'])
    // 注入动作后开关可拨：拨一次即把 (row, next=true) 交给调用方（= 一键安装）。
    const onToggleSkill = vi.fn()
    const wired = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills, onToggleSkill })
    const wiredSwitch = collectSwitchProps(wired).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(wiredSwitch['disabled']).toBe(false)
    expect(wiredSwitch['title']).toBe('点此安装到 ~/.dsh/skills')
    wiredSwitch['onChange']?.(true)
    expect(onToggleSkill).toHaveBeenCalledWith(expect.objectContaining({ id: '1902500000000000001' }), true)
  })

  // 已装记录与在途动作是两个彼此独立的输入：判定「已装/在途」只认 Host 真值，从不乐观猜测；
  // 「有更新」只在**两侧 versionId 都拿得到**时才敢说（列表态行没有中心版本 → 一律按已装）。
  it('projects each skill row state from the installed records and the pending action, never from optimism', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    // 未装（清单缺席或为空）→ 可装。
    expect(enterpriseMarketSkillState(undefined, undefined, row)).toBe('AVAILABLE')
    expect(enterpriseMarketSkillState([], undefined, row)).toBe('AVAILABLE')
    // 已装记录命中本行 → 已装；行上没有中心版本（列表态 latestVersionId='') → 不判更新，只说已装。
    expect(enterpriseMarketSkillState([installedSkill('v2')], undefined, row)).toBe('INSTALLED')
    expect(enterpriseMarketSkillState([installedSkill('v1')], undefined, row)).toBe('INSTALLED')
    // 别的包的已装记录不算本行已装（行键 = 技能包 id）。
    expect(enterpriseMarketSkillState([installedSkill('v2', 'x')], undefined, row)).toBe('AVAILABLE')
    // 两侧 versionId 都拿得到且不等 → 有更新（本页唯一敢说「有更新」的条件）。
    const updatable = updatableRow()
    expect(enterpriseMarketSkillState([installedSkill('1902500000000000100')], undefined, updatable)).toBe('UPDATE_AVAILABLE')
    expect(enterpriseMarketSkillState([installedSkill(SKILL_DETAIL.versionId)], undefined, updatable)).toBe('INSTALLED')
    // 在途方向决定「安装中」还是「卸载中」（原先只传 id 时卸载在途会错报安装中）；在途优先于版本判定。
    expect(enterpriseMarketSkillState(undefined, { packageId: row.id, next: true }, row)).toBe('INSTALLING')
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: row.id, next: true }, row)).toBe('INSTALLING')
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: row.id, next: false }, row)).toBe('REMOVING')
    // 有更新的行在途时也只报在途，不混说版本。
    expect(enterpriseMarketSkillState([installedSkill('1902500000000000100')], { packageId: row.id, next: true }, updatable))
      .toBe('INSTALLING')
    // 别的包在途不影响本行；在途优先于已装判定。
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: 'x', next: false }, row)).toBe('INSTALLED')
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: row.id, next: false }, row)).toBe('REMOVING')
  })

  // 「有更新」独立用例：这个结论**只有两侧 versionId 参与**——sha256 换值不改结论、缺任一侧不判。
  it('derives 有更新 from both versionIds only, ignoring sha256 and missing sides', () => {
    const updatable = updatableRow()
    const older = installedSkill('1902500000000000100')
    // 两侧非空且不等 → 有更新；相等 → 无。
    expect(enterpriseMarketSkillHasUpdate(older.versionId, updatable.latestVersionId)).toBe(true)
    expect(enterpriseMarketSkillHasUpdate(SKILL_DETAIL.versionId, SKILL_DETAIL.versionId)).toBe(false)
    // 缺任一侧（未装 / 详情没取到）一律 false：宁可少说一句，也不猜「有更新」。
    expect(enterpriseMarketSkillHasUpdate('', updatable.latestVersionId)).toBe(false)
    expect(enterpriseMarketSkillHasUpdate(older.versionId, '')).toBe(false)
    expect(enterpriseMarketSkillHasUpdate('', '')).toBe(false)
    // 行的判定入口：行键必须命中已装记录（别的包的记录不算）。
    expect(enterpriseMarketSkillRowHasUpdate([older], updatable)).toBe(true)
    expect(enterpriseMarketSkillRowHasUpdate(undefined, updatable)).toBe(false)
    expect(enterpriseMarketSkillRowHasUpdate([{ ...older, packageId: 'x' }], updatable)).toBe(false)
    // **sha256 不参与**：本机记录的 sha256 与中心哈希不一致（界面本来就拿不到中心哈希）也照样只比 versionId。
    expect(enterpriseMarketSkillRowHasUpdate([{ ...older, sha256: 'b'.repeat(64) }], updatable)).toBe(true)
    expect(enterpriseMarketSkillRowHasUpdate([{ ...installedSkill(SKILL_DETAIL.versionId), sha256: 'b'.repeat(64) }], updatable)).toBe(false)
  })

  // 开关左侧那枚辅助标签：只在「有更新」时出现（其余态右侧就一个 Switch），点击 = 安装中心当前版本。
  it('renders the auxiliary update label left of the switch only when an update exists', () => {
    const updatable = updatableRow()
    const onToggleSkill = vi.fn()
    // 未装行：不出现。
    const notInstalled = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], onToggleSkill })
    expect(collectTagProps(notInstalled)).toEqual([])
    // 已装且与中心同版本：不出现。
    const current = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
      installedSkills: [installedSkill(SKILL_DETAIL.versionId)], onToggleSkill,
    })
    expect(collectTagProps(current)).toEqual([])
    // 已装旧版本：出现，文案/无障碍名/悬浮说明按投影给。
    const outdated = installedSkill('1902500000000000100')
    const tree = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated], onToggleSkill })
    const tags = collectTagProps(tree)
    expect(tags).toHaveLength(1)
    expect(tags[0]).toMatchObject({
      type: 'button',
      'data-enterprise-skill-tag': 'UPDATE_AVAILABLE',
      'aria-label': '更新企业技能 会议纪要技能组',
      title: '点此更新到中心当前版本',
      disabled: false,
      children: ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
    })
    expect(ENTERPRISE_MARKET_SKILL_UPDATE_TAG).toBe('UPDATE_AVAILABLE')
    // 纯投影与常量同源（改文案只改一处）。
    expect(enterpriseMarketSkillUpdateTag('会议纪要技能组')).toEqual({
      label: '有更新',
      ariaLabel: '更新企业技能 会议纪要技能组',
      title: '点此更新到中心当前版本',
    })
    expect(ENTERPRISE_MARKET_SKILL_UPDATE_LABEL).toBe('有更新')
    // 点击 = 安装中心当前版本（`next=true`），不是卸载、也不是 no-op。
    tags[0]?.['onClick']?.()
    expect(onToggleSkill).toHaveBeenCalledWith(expect.objectContaining({ id: updatable.id }), true)
    // 顺序锁：标签严格排在 Switch **左侧**（开关仍是该行主控件，右侧顺序不许反过来）。
    const kids = rowLineChildren(tree, updatable.id)
    const tagIndex = kids.findIndex(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-tag'] !== undefined)
    const switchIndex = kids.findIndex(child => isValidElement(child) && child.type === (Switch as unknown))
    expect(tagIndex).toBeGreaterThanOrEqual(0)
    expect(switchIndex).toBeGreaterThan(tagIndex)
    // 有更新时行上的受管态钩子如实报 `UPDATE_AVAILABLE`；那枚开关仍开着（盘上装着旧版本）、可拨（拨下去 = 卸载）。
    expect(collectDataValues(tree, 'data-enterprise-skill-state')).toEqual(['UPDATE_AVAILABLE'])
    const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(skillSwitch['checked']).toBe(true)
    expect(skillSwitch['label']).toBe('卸载企业技能 会议纪要技能组')
    expect(skillSwitch['disabled']).toBe(false)
  })

  // 在途语义：有更新的行在途时辅助标签**保留但禁用**（用户看得见「正在更新」）；未装行的在途一律不出现。
  it('keeps the update label visible but disabled while the row is busy', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    const busyUpdate = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
      pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
    })
    const tags = collectTagProps(busyUpdate)
    expect(tags).toHaveLength(1)
    expect(tags[0]?.['disabled']).toBe(true)
    // 未装行在途（正在做首次安装）：右侧就一个 Switch，不出现辅助标签。
    const busyFresh = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
      pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
    })
    expect(collectTagProps(busyFresh)).toEqual([])
    // 没有动作回调（未登录/无 store）时标签禁用，但语义仍是「更新」。
    const unwired = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
    })
    expect(collectTagProps(unwired)[0]).toMatchObject({ disabled: true, title: '企业账号未登录，暂不可操作' })
  })

  // 开关各态在真实树上的落点：`checked`/`disabled` + `label` 动作语义 + 行上的 `data-enterprise-skill-state` 一致
  // （未装 / 已装 / 有更新 / 安装中 / 卸载中）。
  it('renders the skill-row switch states on the row with matching data hooks', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    const onToggleSkill = vi.fn()
    const cases: readonly {
      readonly name: string
      readonly installedSkills?: readonly EnterpriseInstalledSkill[]
      readonly pendingSkill?: { readonly packageId: string, readonly next: boolean }
      readonly state: string
      readonly label: string
      readonly checked: boolean
      readonly disabled: boolean
    }[] = [
      { name: '未装', state: 'AVAILABLE', label: '安装企业技能 会议纪要技能组', checked: false, disabled: false },
      { name: '已装', installedSkills: [installedSkill('v2')], state: 'INSTALLED', label: '卸载企业技能 会议纪要技能组', checked: true, disabled: false },
      { name: '安装中', pendingSkill: { packageId: row.id, next: true }, state: 'INSTALLING', label: '安装企业技能 会议纪要技能组', checked: false, disabled: true },
      { name: '卸载中', installedSkills: [installedSkill('v2')], pendingSkill: { packageId: row.id, next: false }, state: 'REMOVING', label: '卸载企业技能 会议纪要技能组', checked: true, disabled: true },
    ]
    for (const item of cases) {
      const tree = EnterpriseMarketEntry({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills: [row],
        ...(item.installedSkills === undefined ? {} : { installedSkills: item.installedSkills }),
        ...(item.pendingSkill === undefined ? {} : { pendingSkill: item.pendingSkill }),
        onToggleSkill,
      })
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['label']).toBe(item.label)
      expect(skillSwitch['checked']).toBe(item.checked)
      // 在途禁用（并发动作会互相覆盖已装清单），其余一律可拨。
      expect(skillSwitch['disabled']).toBe(item.disabled)
      // 行上的受管态钩子仍如实报态（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）。
      expect(collectDataValues(tree, 'data-enterprise-skill-state')).toEqual([item.state])
    }
    // 第五态「有更新」：行上带中心当前版本、本机装着旧版本 → 开关照旧开着且可拨（拨下去 = 卸载）。
    const updatable = updatableRow()
    const outdatedTree = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
      installedSkills: [installedSkill('1902500000000000100')], onToggleSkill,
    })
    expect(collectDataValues(outdatedTree, 'data-enterprise-skill-state')).toEqual(['UPDATE_AVAILABLE'])
    const outdatedSwitch = collectSwitchProps(outdatedTree).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(outdatedSwitch['checked']).toBe(true)
    expect(outdatedSwitch['disabled']).toBe(false)
    expect(outdatedSwitch['label']).toBe('卸载企业技能 会议纪要技能组')
  })

  // 一键安装/卸载：开关在两个方向上都把 (row, next) 交给 onToggleSkill —— 未装拨上 = true，已装拨下 = false。
  it('toggles the skill action from the switch in both directions', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    const onToggleSkill = vi.fn()
    const installable = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: [row], onToggleSkill })
    const installSwitch = collectSwitchProps(installable).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(installSwitch['checked']).toBe(false)
    expect(installSwitch['label']).toBe('安装企业技能 会议纪要技能组')
    installSwitch['onChange']?.(true)
    expect(onToggleSkill).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)

    // 已装：开关是打开的，拨下去即卸载（`next=false`）。
    const installed = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [row], installedSkills: [installedSkill('v2')], onToggleSkill,
    })
    const installedSwitch = collectSwitchProps(installed).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(installedSwitch['checked']).toBe(true)
    expect(installedSwitch['label']).toBe('卸载企业技能 会议纪要技能组')
    expect(installedSwitch['title']).toBe('点此卸载')
    installedSwitch['onChange']?.(false)
    expect(onToggleSkill).toHaveBeenLastCalledWith(expect.objectContaining({ id: row.id }), false)
  })

  // 缺陷回归锁：企业技能行的动作失败时市场侧原先**没有任何可见反馈**（用户报「点了没反应」）。
  // 现在失败必须落在出错的那一行：role="alert" + 稳定错误码，且开关仍可拨（再拨一次就是重试）。
  it('shows the enterprise skill-row failure with its stable code and keeps the switch retryable', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    const onToggleSkill = vi.fn()
    const failed = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [row],
      onToggleSkill,
      skillActionError: { id: row.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
    })
    const alerts = collectAlerts(failed)
    expect(alerts).toHaveLength(1)
    expect(textOf(alerts[0])).toContain('安装失败')
    expect(textOf(alerts[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // 复用市场侧既有类名体系（形制照技能 tab 的行内提示），不新造视觉。
    expect(isValidElement(alerts[0]) ? alerts[0].props.className : undefined).toBe('own-market-inlineError')
    // 失败没留下乐观已装：开关仍是「未装」态且可拨，拨上去就是重试。
    const skillSwitch = collectSwitchProps(failed).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(skillSwitch['checked']).toBe(false)
    expect(skillSwitch['disabled']).toBe(false)
    skillSwitch['onChange']?.(true)
    expect(onToggleSkill).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)
  })

  // 失败文案随「意图动作」走，且提示只落失败行：另一行不受影响、两个开关都照旧可拨。
  it('labels the failure by the attempted action and renders it only on the failing row', () => {
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'install', code: 'ENT_X' })).toBe('安装失败')
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'uninstall', code: 'ENT_X' })).toBe('卸载失败')
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组' },
    ])
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: rows,
      installedSkills: [installedSkill('v1', rows[1]!.id)],
      onToggleSkill: vi.fn(),
      skillActionError: { id: rows[1]!.id, action: 'uninstall', code: 'ENT_SKILL_STATE_INVALID' },
    })
    const alerts = collectAlerts(tree)
    expect(alerts).toHaveLength(1)
    expect(textOf(alerts[0])).toContain('卸载失败')
    expect(textOf(alerts[0])).toContain('ENT_SKILL_STATE_INVALID')
    expect(textOf(alerts[0])).not.toContain('代码评审技能组')
    // 两行开关都在（一关一开）、都没被提示禁用（失败行可重试，正常行不受牵连）。
    const switches = collectSwitchProps(tree).filter(props => String(props['label']).includes('企业技能'))
    expect(switches).toHaveLength(2)
    expect(switches[0]?.['checked']).toBe(false)
    expect(switches[1]?.['checked']).toBe(true)
    expect(switches[0]?.['disabled']).toBe(false)
    expect(switches[1]?.['disabled']).toBe(false)
  })

  // 回归锁（本轮改动的边界）：技能行右侧 = 官方 Switch（**始终在**）＋仅在有更新时出现的辅助标签，
  // 企业插件行**完全未动**（同样一枚 Switch）。
  it('gives the skill row a Switch again and leaves the plugin row switch untouched', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    const onTogglePlugin = vi.fn()
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterprisePlugins: enterprisePlugins as never,
      enterpriseSkills,
      installedSkills: [installedSkill('v2')],
      onTogglePlugin,
      onToggleSkill: vi.fn(),
    })
    // Switch 恰好 3 个组件行开关 + 1 个插件行开关 + 1 个技能行开关 = 5。
    const labels = collectSwitchProps(tree).map(props => String(props['label']))
    expect(labels).toHaveLength(5)
    expect(labels).toContain('安装企业插件 ent-a')
    expect(labels).toContain('卸载企业技能 会议纪要技能组')
    // 插件行照旧「状态点 + 文案 + Switch」，其 checked/title/onChange 口径一字未改。
    const pluginSwitch = collectSwitchProps(tree).find(props => props['label'] === '安装企业插件 ent-a')!
    expect(pluginSwitch['checked']).toBe(true)
    expect(pluginSwitch['title']).toBe('点此卸载')
    expect(pluginSwitch['disabled']).toBe(false)
    pluginSwitch['onChange']?.(false)
    expect(onTogglePlugin).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
    // 已装同版本行（行上没有中心版本 → 不判更新）右侧只有那枚开关：不出辅助标签、也没有 `data-enterprise-skill-tag` 钩子。
    expect(collectByClassName(tree, 'own-market-skillTag')).toEqual([])
    expect(collectDataValues(tree, 'data-enterprise-skill-tag')).toEqual([])
    // 技能行未占 rowState 版式（那是组件行的状态点位）。
    expect(collectDataValues(tree, 'data-enterprise-skill-state')).toEqual(['INSTALLED'])
  })

  // 企业插件行原先也只有「目录不可装」的禁用 + title 提示，动作失败同样一个字都不说（失败码只留在 store 里，
  // 由「企业设置 → 插件」那个视图出头号提示）。这里一并补齐同范式的行内提示。
  it('shows the enterprise plugin-row failure with its code and leaves the other rows clean', () => {
    const enterprisePlugins = [
      { packageName: 'ent-a', version: '1.2.0', state: 'EXPECTED', inCatalog: true },
      { packageName: 'ent-b', version: '2.0.0', state: 'ACTIVE', inCatalog: true },
    ] as const
    const onTogglePlugin = vi.fn()
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterprisePlugins: enterprisePlugins as never,
      onTogglePlugin,
      pluginActionError: { id: 'ent-a', action: 'install', code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
    })
    const alerts = collectAlerts(tree)
    expect(alerts).toHaveLength(1)
    expect(textOf(alerts[0])).toContain('安装失败')
    expect(textOf(alerts[0])).toContain('ENT_PLUGIN_SIGNATURE_INVALID')
    // 失败行开关仍可拨（原地重试），另一行没有凭空多出失败提示。
    const failedSwitch = collectSwitchProps(tree).find(props => props['label'] === '安装企业插件 ent-a')
    expect(failedSwitch?.['disabled']).toBe(false)
    failedSwitch?.['onChange']?.(true)
    expect(onTogglePlugin).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), true)
    expect(textOf(tree)).toContain('ent-b')
  })

  // 成功路径（没有失败事实直传）不得出现任何提示：提示只在失败时出现，成功时一个字都不多说。
  it('renders no inline alert when no action failed (success path stays clean)', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterprisePlugins: enterprisePlugins as never,
      enterpriseSkills,
      installedSkills: [installedSkill('v1')],
      onTogglePlugin: vi.fn(),
      onToggleSkill: vi.fn(),
    })
    expect(collectAlerts(tree)).toEqual([])
    expect(textOf(tree)).not.toContain('安装失败')
    expect(textOf(tree)).not.toContain('卸载失败')
    // 成功路径上开关只是如实反映 Host 真值（已装 → 打开）。
    const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(skillSwitch['checked']).toBe(true)
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

  // 折叠（照官方 PluginInventory groupToggle）：显式给 expandedSections 时按值、aria-expanded/controls 齐全。
  it('honours an explicit expandedSections map and toggles aria-expanded per section', () => {
    // 缺席（bare call）→ 纯投影默认折叠（照官方 `?? false`）；页面纯函数体不传 expandedSections 时会传 defaultOpen=true（测试直调得完整树）。
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

  // 用户口径「分组折叠默认展开」：真运行时的初值 = `ENTERPRISE_MARKET_DEFAULT_EXPANDED`——**三节全展开**，
  // 后台分配（预置）的全部技能（含未装的）一进页面就列出来，用户再用行右侧那枚开关决定装不装。
  it('expands all three sections by default', () => {
    // 用户口径「分组折叠默认展开」：三节各占一个独立字段，全部为 true。
    expect(ENTERPRISE_MARKET_DEFAULT_EXPANDED).toEqual({
      components: true,
      enterprisePlugins: true,
      enterpriseSkills: true,
    })
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
      onToggleSection: vi.fn(),
    })
    // 三节默认都展开可见（技能列表未装的也照列，不按已装过滤）。
    expect(collectElementById(tree, 'market-section-enterprise-skills')).not.toBeUndefined()
    expect(collectElementById(tree, 'market-section-components')).not.toBeUndefined()
    expect(textOf(tree)).toContain('会议纪要技能组')
    // 默认态下技能行那枚开关就在树上（未装 → 关闭、可拨）。
    const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(skillSwitch['checked']).toBe(false)
    expect(skillSwitch['disabled']).toBe(true)
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

/** 收集元素树里所有 `role="alert"` 的元素（行内失败提示），递归展开函数组件子树。 */
function collectAlerts(node: ReactNode, acc: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) { for (const child of node) collectAlerts(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['role'] === 'alert') { acc.push(node); return acc }
  if (typeof node.type === 'function') collectAlerts((node.type as (p: unknown) => ReactNode)(props), acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectAlerts(value as ReactNode, acc)
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

/** 收集树里某个 `data-*` 属性的全部取值（锁数据钩子：受管态如实报态、辅助标签只在有更新时出现）。 */
function collectDataValues(node: ReactNode, prop: string, acc: unknown[] = []): unknown[] {
  if (Array.isArray(node)) { for (const child of node) collectDataValues(child, prop, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props[prop] !== undefined) acc.push(props[prop])
  if (typeof node.type === 'function') collectDataValues((node.type as (p: unknown) => ReactNode)(props), prop, acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectDataValues(value as ReactNode, prop, acc)
  }
  return acc
}

/** 收集树里带 `data-enterprise-skill-tag` 的元素 props（开关左侧那枚辅助标签；不出现即空数组）。 */
function collectTagProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectTagProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['data-enterprise-skill-tag'] !== undefined) { acc.push(props as Record<string, any>); return acc }
  if (typeof node.type === 'function') collectTagProps((node.type as (p: unknown) => ReactNode)(props), acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectTagProps(value as ReactNode, acc)
  }
  return acc
}

/** 取某行 `rowLine` 的直属子元素（顺序即渲染顺序），用于锁「辅助标签在开关左侧」。 */
function rowLineChildren(tree: ReactNode, packageId: string): ReactNode[] {
  const row = collectByClassName(tree, 'own-market-row').find(props => props['data-enterprise-skill-package'] === packageId)
  const line = (Array.isArray(row?.['children']) ? row?.['children'][0] : row?.['children']) as ReactNode
  if (!isValidElement(line)) return []
  const kids = (line.props as Record<string, unknown>)['children']
  return Array.isArray(kids) ? (kids as ReactNode[]) : []
}

/** 收集 `className` 命中的元素 props（按空格分隔的类名之一匹配），用于锁两行卡片结构。 */
function collectByClassName(node: ReactNode, name: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByClassName(child, name, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const className = props['className']
  if (typeof className === 'string' && className.split(/\s+/).includes(name)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') collectByClassName((node.type as (p: unknown) => ReactNode)(props), name, acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByClassName(value as ReactNode, name, acc)
  }
  return acc
}

/** 取元素树里 `<style>` 注入的 CSS 文本（视觉口径可直接断言，不必等真机算样式）。 */
function collectStyleText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(collectStyleText).join('')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return String((node.props as Record<string, unknown>)['children'] ?? '')
  const children = (node.props as Record<string, unknown>)['children']
  if (children === null || children === undefined || typeof children !== 'object') return ''
  return collectStyleText(children as ReactNode)
}

/** 从 CSS 文本里取某条类规则的声明块（如 `.own-market-cardDesc{…}`），用于锁字号/单行口径。 */
function cssRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escaped}\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
}
