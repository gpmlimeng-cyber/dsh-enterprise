/**
 * [INPUT]: 依赖 marketplace-entry 的注册常量、**页签真源**（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`）、组件清单/摘要/状态/开关语义纯投影、企业插件行投影、企业技能行投影（含详情归并的中心版本 `latestVersionId`，以及标题行两枚标签的取值：列表投影的 `sourceDshVersion` 与可选 `category`）与可见性门控、标题行标签纯投影 `enterpriseMarketSkillVersionTag`/`enterpriseMarketSkillCategoryTag`、技能节受管态纯投影 `enterpriseMarketSkillState`、「有更新」判定 `enterpriseMarketSkillHasUpdate`/`enterpriseMarketSkillRowHasUpdate` 与辅助标签投影 `enterpriseMarketSkillUpdateTag`、**组件页签折叠态常量** `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败行内提示投影 `enterpriseMarketActionErrorLabel`、入口组件与版本签组件本身、**页签文案计数投影** `enterpriseMarketTabLabel`，以及 local-api-decode 的 `EnterpriseRuntimeSkill`/`EnterpriseInstalledSkill` 形状与应用商店共享身份常量（`ENTERPRISE_STORE_PANEL_ID`/`ENTERPRISE_STORE_ENTRY_LABEL`/`ENTERPRISE_STORE_ENTRY_ORDER`/`ENTERPRISE_STORE_PANEL_VIEW`）、侧栏图标 `EnterpriseStoreIcon`，以及 `client.tsx` 的 `apply`/`inject` 真注册面（最小 slots double）
 * [OUTPUT]: 验证入口身份常量、卡片一句话的单行约束、**page 视图的三页签商店结构**（页签条手写 `role="tablist"`、三个页签的 `aria-selected`/`aria-controls`/roving `tabIndex`/`id` 与三个 `role="tabpanel"` 的 `aria-labelledby` 严格配对、**默认选中「企业技能」**、切换后**只渲染该页签内容**、←/→/Home/End 走焦并选中、鼠标点击回调）、组件清单（插件/技能/配方）顺序与 reserved 语义、计数摘要口径、summary/page 两视图结构（page 上的组件行在「组件」页签里，且 page 不重画标题/desc）、版本签只对本条目 subject 出、企业插件页签的归并与门控，以及**企业技能页签的官方两行卡片**（第 1 行标题 + 紧随的**版本签 `sourceDshVersion`** 与**可选分类签 `category`**——分类缺席/null/空串时该签不出现、第 1 行 nowrap 单行锁 20px 行高故加签不撑高、标题先省略标签保持可见；第 2 行描述各自成行、描述单行省略、旧元信息行退场）/可见性门控/计数/右侧那枚官方 `Switch`（`checked` 反映已装、在途 `disabled`、`label` 给动作语义、`onChange(next)` 两个方向都回调）与受管态投影（未装/已装/有更新/在途），以及**开关左侧那枚辅助标签**（只在「有更新」时出现、`aria-label`=`更新企业技能 X`、点击走安装方向、在途 `disabled` 不消失、未装/已装同版本一律不出现、标签严格排在 Switch 左侧），以及**「有更新」独立用例**（只有两侧 `versionId` 参与、`sha256` 换值不改结论、缺任一侧不判），以及**只改技能行**的回归锁（技能行有 Switch + 辅助标签、企业插件行一字未动），以及**两节行上的失败可见反馈**（失败 → 该行 role="alert" + 稳定错误码、只落失败行、失败后开关仍可拨重试、成功路径不出现该提示），以及**页签化后唯一剩下的组件节折叠**（`ENTERPRISE_MARKET_DEFAULT_EXPANDED` 单字段、aria 契约、折叠态列表不进 DOM），以及**详情页顶部压缩的取值锁**（badge 只剩版本号一签 + 包名、「预览版」签不再出现；`.own-market-storeTabs` `margin-top:0` + `flex-wrap:nowrap`、`.own-market-section` `margin-top:12px`、`.own-market-storeTab` `white-space:nowrap`/13-20；`.own-market-sectionMeta` 类规则整条删除且 DOM 不再有该容器，计数改由页签文案承载「企业技能 3」），以及**二期结构切片的注册形状门禁**（`main` key 与 `sidebar.panellist` id 同值 = `enterprise-store`、order 20 排在官方实测 plugins=0/schedules=10 之后、label「应用商店」、图标为函数组件、`inject` 声明含 `layout`）与**一份实现两处入口门禁**（两处注册同一个 `EnterpriseMarketPage`、面板注册面注入的 `view` 恒为 `ENTERPRISE_STORE_PANEL_VIEW='page'` 且 store 与卡片同源；`plugins.item` 的 page 与新面板产出的三页签商店在 `role="tablist"`/三个页签的 id 与文案/aria 配对/开关动作名/全树可见文本上逐项一致）
 * [POS]: dsh-ui 插件市场入口与独立应用商店座位（主内容区面板 + 侧栏一级入口）的产品词汇门禁，真实渲染与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseInstalledSkill, EnterpriseRuntimeSkill } from '../src/local-api-decode.js'
import { apply, inject } from '../src/client.js'
import {
  ENTERPRISE_MARKET_COMPONENTS,
  ENTERPRISE_MARKET_DEFAULT_EXPANDED,
  ENTERPRISE_MARKET_DEFAULT_TAB,
  ENTERPRISE_MARKET_DIRECTORY_TABS,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  ENTERPRISE_MARKET_PLAN,
  ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS,
  ENTERPRISE_MARKET_SEARCH_EMPTY,
  ENTERPRISE_MARKET_SEARCH_INITIAL,
  ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
  ENTERPRISE_MARKET_SKILL_UPDATE_TAG,
  ENTERPRISE_MARKET_SUMMARY,
  ENTERPRISE_MARKET_TAB_IDS,
  ENTERPRISE_MARKET_TABLIST_LABEL,
  ENTERPRISE_MARKET_TABS,
  ENTERPRISE_STORE_ENTRY_LABEL,
  ENTERPRISE_STORE_ENTRY_ORDER,
  ENTERPRISE_STORE_PANEL_ID,
  ENTERPRISE_STORE_PANEL_VIEW,
  EnterpriseStoreIcon,
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
  enterpriseMarketPluginConfigTag,
  enterpriseMarketPluginRows,
  enterpriseMarketPluginSectionVisible,
  enterpriseMarketPluginStatusLabel,
  enterpriseMarketRowDetailsId,
  enterpriseMarketRowKey,
  enterpriseMarketRowOpen,
  enterpriseMarketSearchLabel,
  enterpriseMarketSearchPlaceholder,
  enterpriseMarketSearchPluginRows,
  enterpriseMarketSearchRows,
  enterpriseMarketSearchSkillRows,
  enterpriseMarketSearchTerm,
  enterpriseMarketSectionOpen,
  enterpriseMarketSkillCategoryTag,
  enterpriseMarketSkillConfigTag,
  enterpriseMarketSkillDot,
  enterpriseMarketSkillHasUpdate,
  enterpriseMarketSkillRowHasUpdate,
  enterpriseMarketSkillRows,
  enterpriseMarketSkillSectionVisible,
  enterpriseMarketSkillState,
  enterpriseMarketSkillStatusLabel,
  enterpriseMarketSkillUpdateTag,
  enterpriseMarketSkillVersionTag,
  enterpriseMarketTabLabel,
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

/**
 * 带可选分类的目录行 fixture：分类签取值同源（列表投影的 `category`）。
 * 分类是服务端**新增**字段——这里只用于验证「有分类就出一枚签」，缺席时的安静缺席另有用例。
 */
const SKILL_WITH_CATEGORY: EnterpriseRuntimeSkill = { ...SKILL, category: '研发工具' }

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

  it('renders the single-line summary for the card and the three-tab store page for the detail view', () => {
    const summary = EnterpriseMarketEntry({ view: 'summary' })
    expect(isValidElement(summary)).toBe(true)
    expect(textOf(summary)).toBe(ENTERPRISE_MARKET_SUMMARY)

    const page = EnterpriseMarketEntry({ view: 'page' })
    expect(isValidElement(page)).toBe(true)
    expect(isValidElement(page) ? page.props['aria-label'] : undefined).toBe(ENTERPRISE_MARKET_ENTRY_LABEL)
    // page 视图现在是一条页签条 + 三个面板；页签文案 = 基础词 + 计数（无数据时企业技能/企业插件为 0、
    // 组件恒为清单长度 3）——计数原先独占一行，现在并入页签（顶部压缩）。
    const text = textOf(page)
    for (const tab of ENTERPRISE_MARKET_TABS) expect(text).toContain(tab.label)
    expect(text).toContain(enterpriseMarketTabLabel('企业技能', 0))
    expect(text).toContain(enterpriseMarketTabLabel('企业插件', 0))
    expect(text).toContain(enterpriseMarketTabLabel('组件', ENTERPRISE_MARKET_COMPONENTS.length))
    // 卡片摘要仍只出现在 summary 视图（page 里一个字都不重复）。
    expect(text).not.toContain(ENTERPRISE_MARKET_SUMMARY)
  })

  // 本刀的核心：page 视图顶部一条手写页签条，三个页签 + 三个面板严格配对，默认选中「企业技能」。
  it('renders a hand-written tablist with the three page tabs and 企业技能 selected by default', () => {
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'components'])
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label)).toEqual(['企业技能', '企业插件', '组件'])
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(ENTERPRISE_MARKET_TABS[0]?.id).toBe(ENTERPRISE_MARKET_DEFAULT_TAB)

    const page = EnterpriseMarketEntry({ view: 'page' })
    // 容器：手写 tablist（官方 SegmentedTabs 在编译期 pin 的 primitives 0.1.5-rc.2 里不存在，不许 import）。
    const tablists = collectByRole(page, 'tablist')
    expect(tablists).toHaveLength(1)
    expect(tablists[0]?.['aria-label']).toBe(ENTERPRISE_MARKET_TABLIST_LABEL)
    const tabs = collectByRole(page, 'tab')
    // 页签文案 = 基础词 + 紧凑计数（企业技能/企业插件无目录时如实为 0，组件 = 清单长度 3）：
    // 原先两节内部的独立计数行已删，数字并入页签（详情页顶部少一行）。
    expect(tabs.map(tab => tab['children'])).toEqual(['企业技能 0', '企业插件 0', '组件 3'])
    expect(tabs.map(tab => tab['children'])).toEqual(ENTERPRISE_MARKET_TABS.map(tab => enterpriseMarketTabLabel(
      tab.label,
      tab.id === 'components' ? ENTERPRISE_MARKET_COMPONENTS.length : 0,
    )))
    // 默认选中 + roving tabIndex（只有当前页签可 Tab 到，其余靠方向键）。
    expect(tabs.map(tab => tab['aria-selected'])).toEqual([true, false, false])
    expect(tabs.map(tab => tab['tabIndex'])).toEqual([0, -1, -1])
  })

  it('pairs every tab with its tabpanel and mounts only the selected panel content', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const tab of ENTERPRISE_MARKET_TABS) {
      const tree = EnterpriseMarketEntry({
        view: 'page',
        sessionUsable: true,
        activeTab: tab.id,
        enterpriseSkills,
        enterprisePlugins: enterprisePlugins as never,
      })
      const ids = ENTERPRISE_MARKET_TAB_IDS[tab.id]
      const tabs = collectByRole(tree, 'tab')
      // 页签 id ↔ aria-controls ↔ 面板 id ↔ 面板 aria-labelledby 四处同源，且只有当前页签是选中态。
      expect(tabs.map(node => node['id'])).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.tab,
        ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
        ENTERPRISE_MARKET_TAB_IDS.components.tab,
      ])
      expect(tabs.map(node => node['aria-controls'])).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.panel,
        ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
        ENTERPRISE_MARKET_TAB_IDS.components.panel,
      ])
      expect(tabs.filter(node => node['aria-selected'] === true).map(node => node['id'])).toEqual([ids.tab])
      const panels = collectByRole(tree, 'tabpanel')
      expect(panels.map(node => node['id'])).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.panel,
        ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
        ENTERPRISE_MARKET_TAB_IDS.components.panel,
      ])
      expect(panels.map(node => node['aria-labelledby'])).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.tab,
        ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
        ENTERPRISE_MARKET_TAB_IDS.components.tab,
      ])
      // 每个 aria-controls 都能解析到一个真实面板；非当前页签的面板 hidden，且**内容整段不挂载**。
      for (const node of tabs) expect(panels.some(panel => panel['id'] === node['aria-controls'])).toBe(true)
      expect(panels.filter(panel => panel['hidden'] === true).map(panel => panel['id']))
        .toEqual(panels.filter(panel => panel['id'] !== ids.panel).map(panel => panel['id']))
      const text = textOf(tree)
      if (tab.id === 'skills') {
        expect(text).toContain('会议纪要技能组')
        expect(text).not.toContain('包含的组件')
        expect(text).not.toContain('ent-a')
      } else if (tab.id === 'plugins') {
        expect(text).toContain('ent-a')
        expect(text).not.toContain('会议纪要技能组')
        expect(text).not.toContain('包含的组件')
      } else {
        expect(text).toContain('包含的组件')
        expect(text).not.toContain('会议纪要技能组')
        expect(text).not.toContain('ent-a')
      }
    }
  })

  it('switches the active tab from clicks and from the arrow/home/end keys', () => {
    const onSelectTab = vi.fn()
    const tree = EnterpriseMarketEntry({ view: 'page', onSelectTab })
    const tabs = collectButtonProps(tree).filter(button => button['role'] === 'tab')
    expect(tabs).toHaveLength(3)
    // 点击：三个页签各自把 (tabId) 交回调用方。
    for (const [index, tab] of ENTERPRISE_MARKET_TABS.entries()) {
      tabs[index]?.['onClick']?.()
      expect(onSelectTab).toHaveBeenLastCalledWith(tab.id)
    }
    // 键盘：←/→ 循环、Home/End 跳首尾；都是「走焦 + 选中」一步到位，且拦住默认滚动。
    const press = (index: number, key: string): { preventDefault: () => void } => {
      const event = { key, preventDefault: vi.fn(), currentTarget: null }
      tabs[index]?.['onKeyDown']?.(event)
      return event
    }
    expect(press(0, 'ArrowRight').preventDefault).toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenLastCalledWith('plugins')
    expect(press(0, 'ArrowLeft').preventDefault).toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenLastCalledWith('components')
    expect(press(2, 'ArrowRight').preventDefault).toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenLastCalledWith('skills')
    expect(press(2, 'Home').preventDefault).toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenLastCalledWith('skills')
    expect(press(0, 'End').preventDefault).toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenLastCalledWith('components')
    // 其余键不拦、不改选中（Tab / Enter / 空格交给浏览器与 onClick）。
    const ignored = press(0, 'Tab')
    expect(ignored.preventDefault).not.toHaveBeenCalled()
    const calls = onSelectTab.mock.calls.length
    press(0, 'Enter')
    expect(onSelectTab.mock.calls.length).toBe(calls)
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

  it('renders the 组件 tab with the official component-section heading and per-row switch labels', () => {
    // 组件清单已搬进「组件」页签：只有选中该页签时才在树上（页签承担显隐）。
    const page = EnterpriseMarketEntry({ view: 'page', activeTab: 'components' })
    expect(isValidElement(page)).toBe(true)
    const text = textOf(page)
    expect(text).toContain('包含的组件')
    expect(text).toContain(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false))
    for (const row of ENTERPRISE_MARKET_COMPONENTS) expect(text).toContain(row.label)
    // 回归锁：详情页正文不重复标题与摘要——标题 h3 由官方 ItemDetail 用 item.label 渲染（我们不再画），
    // 卡片摘要只在 summary 视图出现，desc 已按产品决策删除，「组件」页签里只有组件清单。
    expect(text).not.toContain('企业插件、技能与配方的统一入口')
    expect(text).not.toContain(ENTERPRISE_MARKET_SUMMARY)
    expect(text).not.toContain(ENTERPRISE_MARKET_ENTRY_LABEL)
    // 未选中「组件」时这份清单整段不挂载（默认页签是「企业技能」）。
    expect(textOf(EnterpriseMarketEntry({ view: 'page' }))).not.toContain('包含的组件')
  })

  // 回归锁：注入 store（有 onOpenLogin 回调）后，组件行开关必须可点；
  // 此前 client.tsx 未给 plugins.item 注 inject 导致三开关恒 disabled（点了没反应）的 bug 不许再犯。
  it('keeps the component-row switches clickable when a login action is wired (no dead control)', () => {
    const onOpenLogin = vi.fn()
    const page = EnterpriseMarketEntry({ view: 'page', activeTab: 'components', sessionUsable: false, onOpenLogin })
    expect(isValidElement(page)).toBe(true)
    // 「组件」页签里只有三行组件开关（详情页没有头部总开关：badge 槽只出只读的「版本号 + 包名」，
    // 见上面的 BadgeView 用例——那里断言标题行没有任何 Switch）。
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
    // page 不再含头部总开关（badge 槽只有只读的版本号 + 包名，功能开关就是这三行）。
    expect(switches.find(props => props.label === '启用插件市场')).toBeUndefined()
  })

  // 版本号 + 包名走官方 plugins.detail.badge 槽（titleRow 里 h3 旁）：只对本条目 subject 生效；
  // 「预览版」文字签已按顶部压缩删掉（纯噪音、无信息量），标题行也没有可拨总开关。
  it('gates the badge on the plugin-market subject and renders version + package name only (no 预览版, no switch)', () => {
    // subject 过滤：其余 subject 一律 null（hook 前就返回，不碰状态）。
    expect(EnterpriseMarketBadge({ subject: { kind: 'item', id: 'shell' } })).toBeNull()
    expect(EnterpriseMarketBadge({ subject: { kind: 'bundle', pkg: { name: 'x' } } })).toBeNull()
    // 纯呈现（BadgeView 不调 hook）：有版本 → 恰好一枚版本签 + 包名行；无版本 → 只剩包名行。
    const withVersion = BadgeView({ version: '0.1.0' })
    expect(textOf(withVersion)).toContain('v0.1.0')
    expect(textOf(withVersion)).not.toContain('预览版')
    const tags = collectByClassName(withVersion, 'own-market-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0]?.['children']).toBe('v0.1.0')
    // 包名行照旧（本刀不动它：它是我们 badge 槽里换行的一行，不是官方 chrome 的字号/间距）。
    expect(collectByClassName(withVersion, 'own-market-badge-name')).toHaveLength(1)
    expect(textOf(withVersion)).toContain(ENTERPRISE_MARKET_ENTRY_ID)
    // 标题行只有签、无可拨开关（拨不动的开关像坏的，产品决策去掉）。
    expect(collectSwitchProps(withVersion)).toHaveLength(0)
    const withoutVersion = BadgeView({})
    expect(textOf(withoutVersion)).not.toContain('预览版')
    expect(collectByClassName(withoutVersion, 'own-market-tag')).toHaveLength(0)
    expect(textOf(withoutVersion)).not.toContain('v')
    // 版本签口径照官方 versionTag 'v{version}'。
    expect(enterpriseMarketVersionTag('1.2.3')).toBe('v1.2.3')
    expect(enterpriseMarketVersionTag(undefined)).toBeUndefined()
    expect(enterpriseMarketVersionTag('')).toBeUndefined()
  })

  // 详情页顶部压缩的取值锁（本刀核心视觉）：页签条 top 间距 2→0、首个节 top 间距 24→12、
  // 独立计数行（`.own-market-sectionMeta`）整段退场、页签文案自带计数且行高不变（nowrap + 13/20）。
  // 这些数字一旦被改回去（例如又加回 24 / 又插回一行计数），本用例必须红。
  it('locks the compressed detail-page top spacing and the count-in-tab labels', () => {
    const page = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
    const css = collectStyleText(page)
    // 顶部间距：两个取值都收紧到压缩后的定值（节内 gap 不动，仍是 12）。
    const tabsRule = cssRuleBody(css, '.own-market-storeTabs')
    expect(tabsRule).toContain('margin-top:0')
    expect(tabsRule).toContain('flex-wrap:nowrap')
    const sectionRule = cssRuleBody(css, '.own-market-section')
    expect(sectionRule).toContain('margin-top:12px')
    expect(sectionRule).not.toContain('margin-top:24px')
    expect(sectionRule).toContain('gap:12px')
    // 独立计数行退场：类规则整条删除（不留死样式），DOM 里也不再出现该容器。
    expect(cssRuleBody(css, '.own-market-sectionMeta')).toBe('')
    expect(collectByClassName(page, 'own-market-sectionMeta')).toEqual([])
    // 页签行高不变：单行 nowrap，13/20——计数并入文案后不换行、不撑高页签条。
    const tabRule = cssRuleBody(css, '.own-market-storeTab')
    expect(tabRule).toContain('white-space:nowrap')
    expect(tabRule).toContain('font-size:13px')
    expect(tabRule).toContain('line-height:20px')
    // 计数确实落在页签上（企业技能 1），且压缩没有动到节里的行内容。
    const tabs = collectByRole(page, 'tab')
    expect(tabs.map(tab => tab['children'])).toEqual(['企业技能 1', '企业插件 0', '组件 3'])
    expect(collectSectionByHook(page, 'enterprise-skills')).not.toBeUndefined()
    expect(collectByClassName(page, 'own-market-cardTitle').map(props => props['children'])).toEqual(['会议纪要技能组'])
    // 纯投影口径：基础词 + 计数，页签文案不会被写成「N 个」那种长写法。
    expect(enterpriseMarketTabLabel('企业技能', 3)).toBe('企业技能 3')
    expect(enterpriseMarketTabLabel('组件', 3)).toBe('组件 3')
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

  // 「企业插件」页签在「插件」组件 ON 时渲染插件行、OFF 时不渲染（含 catalog 数据）。
  it('renders the enterprise plugin rows in the 企业插件 tab only when the plugins component is on', () => {
    const enterprisePlugins = [
      { packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true },
      { packageName: 'ent-b', version: '2.0.0', state: 'EXPECTED', inCatalog: true },
    ] as const
    // OFF：sessionUsable=false → 「插件」组件未开启 → 本页签里什么都没有（连节容器都不出）。
    const off = EnterpriseMarketEntry({ view: 'page', activeTab: 'plugins', sessionUsable: false, enterprisePlugins: enterprisePlugins as never })
    expect(textOf(off)).not.toContain('ent-a')
    expect(collectSectionByHook(off, 'enterprise-plugins')).toBeUndefined()
    // 计数口径锁：页签数字取**真正要渲染的行数**（门控不过即 0），绝不出现「页签说 2 条、面板空白」。
    expect(collectByRole(off, 'tab').map(tab => tab['children'])).toEqual(['企业技能 0', '企业插件 0', '组件 3'])
    // ON：sessionUsable=true → 「插件」组件开启 → 出插件行 + 逐个包名 + 计数。
    const on = EnterpriseMarketEntry({ view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: enterprisePlugins as never })
    const text = textOf(on)
    expect(text).toContain('ent-a')
    expect(text).toContain('ent-b')
    expect(text).toContain('企业发布 · v1.2.0')
    // 计数已并入页签文案（原先节内那行独立的 `2 个` 已删）：这里锁「企业插件 2」。
    expect(text).toContain(enterpriseMarketTabLabel('企业插件', 2))
    expect(text).not.toContain('2 个')
    expect(collectSectionByHook(on, 'enterprise-plugins')).not.toBeUndefined()
    // 回归锁：企业插件卡片只两行文案（包名 + 一句话说明），照官方已安装卡片 CardHead——
    // 不含详情页 RowsSection 的 mono 模块名行（那是 rowMain 结构，官方卡片没有）；
    // 也不越界渲染别页签的内容（组件清单只在「组件」页签）。
    expect(text).not.toContain('enterprise plugins · catalog')
    expect(text).not.toContain('已装 · v')
    expect(text).not.toContain('包含的组件')
  })

  // 「企业技能」节：目录 → 官方两行卡片行（标题 + 描述），后台预置的全部技能照列、不做过滤或归并。
  it('projects the enterprise skill catalog into official two-line rows without filtering or merging', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组', description: '' },
    ])
    expect(rows.map(row => row.id)).toEqual(['1902500000000000001', '1902500000000000002'])
    // 行带界面真正渲染的两行文案 + 标题行两枚标签的取值 + 中心当前版本：列表投影没有详情时
    // `latestVersionId` 是空串（不猜）；`sourceDshVersion` 是列表投影本来就有的字段（版本签直接用它）。
    expect(rows[0]).toEqual({
      id: '1902500000000000001',
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      sourceDshVersion: '0.1.7-rc.2',
      latestVersionId: '',
    })
    expect(rows[0]?.latestVersionId).toBe('')
    // 分类（服务端新增可选字段）照解码层同一口径投影：有非空值才产出这个键。
    expect(enterpriseMarketSkillRows([SKILL_WITH_CATEGORY])[0]?.category).toBe('研发工具')
    expect(enterpriseMarketSkillRows([SKILL])[0]?.category).toBeUndefined()
    expect(enterpriseMarketSkillRows([{ ...SKILL, category: '' }])[0]?.category).toBeUndefined()
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

  // 默认页签（「企业技能」）在「技能」组件 ON 且目录非空时渲染技能行、OFF 时不渲染；技能行 === 官方两行卡片
  // （第 1 行标题、第 2 行描述，描述单行省略）+ 右侧那枚官方 Switch（辅助标签只在「有更新」时补位）。
  it('renders the two-line skill card with the official Switch as the row primary control', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    // OFF：sessionUsable=false → 「技能」组件未开启 → 默认页签里什么内容都没有（节容器都不出）。
    const off = EnterpriseMarketEntry({ view: 'page', sessionUsable: false, enterpriseSkills })
    expect(collectSectionByHook(off, 'enterprise-skills')).toBeUndefined()
    expect(textOf(off)).not.toContain('会议纪要技能组')
    // ON：两行文案 + 计数（原先那行独立的 `1 个` 已删，计数并入页签文案 `企业技能 1`）。
    const on = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills })
    const text = textOf(on)
    expect(text).toContain(enterpriseMarketTabLabel('企业技能', 1))
    expect(text).not.toContain('1 个')
    // 两行结构：第 1 行标题、第 2 行描述各自成行（照官方插件清单卡片的 .cardMainRow + .cardDescription）。
    expect(collectByClassName(on, 'own-market-cardTitle').map(props => props['children'])).toEqual(['会议纪要技能组'])
    expect(collectByClassName(on, 'own-market-cardDescription').map(props => props.children))
      .toEqual(['把会议录音与转写整理成结构化纪要。'])
    // 描述取值照**官方** .cardDescription：12/18 + 两行 clamp + 始终可见（不是 jingyun 的 13/18 单行、也不是「仅展开显示」）。
    const css = collectStyleText(on)
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('font-size:12px')
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('line-height:18px')
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('-webkit-line-clamp:2')
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('overflow:hidden')
    expect(cssRuleBody(css, '.own-market-cardDescription')).not.toContain('-webkit-line-clamp:1')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('font-size:14px')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('font-weight:500')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('text-overflow:ellipsis')
    // 旧元信息行退场：不再堆「DSH 版本 · 大小 · N 个技能」（未装行的动作都在展开区里）。
    expect(text).not.toContain('DSH 0.1.7-rc.2')
    // 行尾 = 参考对象的「状态点 + 一枚标签」：技能行也占这套版式（组件行那套 `.own-market-rowState` 不再用于目录行），
    // 且**未装行不出任何辅助标签**（那枚按钮只在「有更新」时出现，见下面的独立用例）。
    expect(collectByClassName(on, 'own-market-cardTrailing')).toHaveLength(1)
    expect(collectByClassName(on, 'own-market-rowState')).toEqual([])
    expect(collectByClassName(on, 'own-market-skillTag')).toEqual([])
    expect(collectDataValues(on, 'data-enterprise-skill-tag')).toEqual([])
    const switches = collectSwitchProps(on)
    expect(switches).toHaveLength(1)
    const skillSwitch = switches.find(props => String(props['label']).includes('会议纪要技能组'))
    expect(skillSwitch).toBeDefined()
    // 未注入动作即禁用（不提供假入口），但语义照旧是「安装」方向。
    expect(skillSwitch?.['checked']).toBe(false)
    expect(skillSwitch?.['disabled']).toBe(true)
    expect(skillSwitch?.['label']).toBe('安装企业技能 会议纪要技能组')
    // 数据钩子命名与企业插件节同风格（`enterprise-skills`）；别页签的节不在树上。
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

  // 标题行（第 1 行）新增两枚只读标签：**版本签**取列表投影本来就有的 `sourceDshVersion`（无需服务端改动）、
  // **分类签**取服务端新增的可选字段 `category`。为缺失设计：分类缺席/null/空串时整枚签不渲染（安静缺席）。
  it('adds a version tag and an optional category tag to the skill title row', () => {
    const tree = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    // 版本签：文案等于 `sourceDshVersion` 原值（不加 `v` 前缀——那是详情页 badge 的口径），
    // 复用官方 `Tag` 原语 + 本文件既有 `.own-market-tag` 定位（不新造视觉体系）。
    const versionTags = collectByClassName(tree, 'own-market-skillVersionTag')
    expect(versionTags).toHaveLength(1)
    expect(versionTags[0]?.['children']).toBe('0.1.7-rc.2')
    expect(versionTags[0]?.['tone']).toBe('neutral')
    expect(String(versionTags[0]?.['className'])).toContain('own-market-tag')
    // 分类签：有分类才出，文案照原值。
    const categoryTags = collectByClassName(tree, 'own-market-skillCategoryTag')
    expect(categoryTags).toHaveLength(1)
    expect(categoryTags[0]?.['children']).toBe('研发工具')
    expect(categoryTags[0]?.['tone']).toBe('info')
    // 顺序锁：两枚签都在**标题那一行**的 head 容器里，且严格排在标题**之后**（标题 → 版本签 → 分类签）。
    const head = collectByClassName(tree, 'own-market-cardHead')[0]
    const headKids = head?.['children'] as ReactNode[]
    expect(headKids).toHaveLength(3)
    expect(isValidElement(headKids[0]) ? (headKids[0].props as Record<string, unknown>)['children'] : undefined).toBe('会议纪要技能组')
    expect(isValidElement(headKids[1]) ? (headKids[1].props as Record<string, unknown>)['children'] : undefined).toBe('0.1.7-rc.2')
    expect(isValidElement(headKids[2]) ? (headKids[2].props as Record<string, unknown>)['children'] : undefined).toBe('研发工具')
    // 第 2 行描述与展开区控件不受影响：描述行照旧、恒只有那枚官方 Switch。
    expect(collectByClassName(tree, 'own-market-cardDescription').map(props => props.children))
      .toEqual(['把会议录音与转写整理成结构化纪要。'])
    expect(collectSwitchProps(tree).map(props => String(props['label']))).toEqual(['安装企业技能 会议纪要技能组'])
    expect(collectTagProps(tree)).toEqual([])
    // 分类缺席（undefined）/ 空串：**分类签不出现**（安静缺席是预期行为，绝不塞占位文案）；
    // 版本签与其余内容照旧在（少一枚分类签不动别的）。
    for (const skills of [
      enterpriseMarketSkillRows([SKILL]),
      enterpriseMarketSkillRows([{ ...SKILL, category: '' }]),
    ]) {
      const bare = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: skills })
      expect(collectByClassName(bare, 'own-market-skillCategoryTag')).toEqual([])
      expect(collectByClassName(bare, 'own-market-skillVersionTag')).toHaveLength(1)
      // 分类签那一格是 `null`（不渲染），故 head 里**元素**只剩标题 + 版本签两枚。
      const bareKids = (collectByClassName(bare, 'own-market-cardHead')[0]?.['children'] as ReactNode[])
        .filter(child => child !== null && child !== undefined)
      expect(bareKids).toHaveLength(2)
      expect(isValidElement(bareKids[0]) ? (bareKids[0].props as Record<string, unknown>)['children'] : undefined).toBe('会议纪要技能组')
      expect(isValidElement(bareKids[1]) ? (bareKids[1].props as Record<string, unknown>)['children'] : undefined).toBe('0.1.7-rc.2')
    }
    // 纯投影：缺席/null/空串/纯空白都归一成 undefined（标题行标签的最后一道防线），有值原样返回。
    expect(enterpriseMarketSkillCategoryTag(undefined)).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag(null)).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag('')).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag('   ')).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag('研发工具')).toBe('研发工具')
    expect(enterpriseMarketSkillVersionTag('0.1.7-rc.3')).toBe('0.1.7-rc.3')
    expect(enterpriseMarketSkillVersionTag('')).toBeUndefined()
  })

  // 行高不变的口径（结构性锁）：第 1 行是**单行 nowrap flex**——标签过多时标题先让步省略、两枚签
  // `flex:none` 保持可见；官方 `Tag` 固定 19px 高（1px 上下内衬 + 17px 行高）< head 的 20px 行高，
  // 故加签不改变这一行的高度，行仍是「两行卡片」的 40px 总高（标题 20 + gap 2 + 描述 18）。
  it('keeps the skill title row single-line so the tags never grow the row', () => {
    const tree = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    const css = collectStyleText(tree)
    const head = cssRuleBody(css, '.own-market-cardHead')
    expect(head).toContain('display:flex')
    expect(head).toContain('flex-wrap:nowrap')
    expect(head).toContain('align-items:center')
    expect(head).toContain('line-height:20px')
    expect(head).toContain('overflow:hidden')
    // 标题先让步（可收缩 + 继承卡片标题的 nowrap/ellipsis），两枚签 `flex:none` 保持可见。
    expect(cssRuleBody(css, '.own-market-skillTitle')).toContain('flex:0 1 auto')
    expect(cssRuleBody(css, '.own-market-skillTitle')).toContain('min-width:0')
    expect(cssRuleBody(css, '.own-market-tag')).toContain('flex:none')
    // 第 1 行的省略口径不变（仍是那枚 14/20-500 + nowrap + ellipsis 的官方卡片标题）。
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('white-space:nowrap')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('text-overflow:ellipsis')
    // 结构锁：cardContent 仍是恰好两行（cardMainRow + 描述），没有因为标签多出第三行。
    const content = collectByClassName(tree, 'own-market-cardContent')[0]
    const contentKids = content?.['children'] as ReactNode[]
    expect(contentKids).toHaveLength(2)
    expect(String((contentKids[0] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardMainRow')
    expect(String((contentKids[1] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardDescription')
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
    // 顺序锁：标签严格排在 Switch **左侧**（开关仍是该行主控件，动作条里不许反过来）。
    const kids = cardActionChildren(tree, updatable.id)
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
  // 企业插件行**完全未动**（同样一枚 Switch）。两行现在各在自己的页签里，故分两次渲染锁同一批语义。
  it('gives the skill row a Switch again and leaves the plugin row switch untouched', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    const onTogglePlugin = vi.fn()
    // 「企业插件」页签：插件行照旧「状态点 + 文案 + Switch」，checked/title/onChange 口径一字未改。
    const pluginsTab = EnterpriseMarketEntry({
      view: 'page',
      activeTab: 'plugins',
      sessionUsable: true,
      enterprisePlugins: enterprisePlugins as never,
      onTogglePlugin,
    })
    const pluginSwitch = collectSwitchProps(pluginsTab).find(props => props['label'] === '安装企业插件 ent-a')!
    expect(collectSwitchProps(pluginsTab).map(props => String(props['label']))).toEqual(['安装企业插件 ent-a'])
    expect(pluginSwitch['checked']).toBe(true)
    expect(pluginSwitch['title']).toBe('点此卸载')
    expect(pluginSwitch['disabled']).toBe(false)
    pluginSwitch['onChange']?.(false)
    expect(onTogglePlugin).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
    // 「企业技能」页签：已装同版本行（行上没有中心版本 → 不判更新）右侧只有那枚开关：
    // 不出辅助标签、也没有 `data-enterprise-skill-tag` 钩子；技能行未占 rowState 版式（那是组件行的状态点位）。
    const skillsTab = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      installedSkills: [installedSkill('v2')],
      onToggleSkill: vi.fn(),
    })
    expect(collectSwitchProps(skillsTab).map(props => String(props['label']))).toEqual(['卸载企业技能 会议纪要技能组'])
    expect(collectByClassName(skillsTab, 'own-market-skillTag')).toEqual([])
    expect(collectDataValues(skillsTab, 'data-enterprise-skill-tag')).toEqual([])
    expect(collectDataValues(skillsTab, 'data-enterprise-skill-state')).toEqual(['INSTALLED'])
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
      activeTab: 'plugins',
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
  // 两个行页签各渲染一次（同一份输入，只是选中页签不同），两处都必须干净。
  it('renders no inline alert when no action failed (success path stays clean)', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const tab of ['skills', 'plugins'] as const) {
      const tree = EnterpriseMarketEntry({
        view: 'page',
        activeTab: tab,
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
    }
    // 成功路径上开关只是如实反映 Host 真值（已装 → 打开）。
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      installedSkills: [installedSkill('v1')],
      onToggleSkill: vi.fn(),
    })
    const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(skillSwitch['checked']).toBe(true)
  })

  // 折叠（照官方 PluginInventory groupToggle）：页签化后**只剩「组件」页签内部那一节**还带折叠语义；
  // 企业技能 / 企业插件两节的节头折叠随页签化退场（显隐由页签承担，这两节只剩一行计数）——
  // 原来锁「企业技能节折叠 aria 契约」的那条用例绑定的正是被移除的行为，故删除（语义由上面的页签用例接管）。
  it('honours an explicit expandedSections map and toggles aria-expanded on the only collapsible section', () => {
    // 缺席（bare call）→ 纯投影默认折叠（照官方 `?? false`）；页面纯函数体不传 expandedSections 时会传 defaultOpen=true（测试直调得完整树）。
    expect(enterpriseMarketSectionOpen(undefined, 'components')).toBe(false)
    expect(enterpriseMarketSectionOpen(undefined, 'components', true)).toBe(true)
    // 显式 provided → 按值。
    expect(enterpriseMarketSectionOpen({ components: false }, 'components')).toBe(false)
    expect(enterpriseMarketSectionOpen({ components: true }, 'components')).toBe(true)
    expect(ENTERPRISE_MARKET_SECTION_IDS.components).toBe('components')
    // 节 id 真源已收敛为唯一还带折叠的「组件」一节：另两个节名随折叠一起删掉，不留死字段。
    expect(Object.keys(ENTERPRISE_MARKET_SECTION_IDS)).toEqual(['components'])

    // 折叠态：组件清单整段不进 DOM，但节头按钮 + 标题 + 计数仍在（可再点开）。
    const collapsed = EnterpriseMarketEntry({
      view: 'page',
      activeTab: 'components',
      expandedSections: { components: false },
      onToggleSection: vi.fn(),
    })
    const compBtn = collectButtonProps(collapsed).find(b => b['aria-controls'] === 'market-section-components')
    expect(compBtn).toBeDefined()
    expect(compBtn?.['aria-expanded']).toBe(false)
    // 折叠时列表整段不进 DOM（条件渲染，照官方 groupBody）——`.own-market-rows{display:flex}` 会覆盖
    // UA 的 `[hidden]{display:none}`，故不用 hidden 属性，直接不渲染 <ul>。节头/标题/计数仍在文本里。
    expect(collectElementById(collapsed, 'market-section-components')).toBeUndefined()
    expect(textOf(collapsed)).toContain('包含的组件')

    // 展开态：aria-expanded=true、列表在 DOM。
    const expanded = EnterpriseMarketEntry({
      view: 'page',
      activeTab: 'components',
      expandedSections: { components: true },
      onToggleSection: vi.fn(),
    })
    expect(collectButtonProps(expanded).find(b => b['aria-controls'] === 'market-section-components')?.['aria-expanded']).toBe(true)
    expect(collectElementById(expanded, 'market-section-components')).not.toBeUndefined()
    // 点节头触发 onToggleSection。
    const spy = vi.fn()
    const clickable = EnterpriseMarketEntry({
      view: 'page',
      activeTab: 'components',
      expandedSections: { components: false },
      onToggleSection: spy,
    })
    collectButtonProps(clickable).find(b => b['aria-controls'] === 'market-section-components')?.onClick?.()
    expect(spy).toHaveBeenCalledWith('components')
  })

  // 页签化后的默认态：`ENTERPRISE_MARKET_DEFAULT_EXPANDED` 只剩一个字段（组件节默认展开）；
  // 「一进页面就看得见后台分配（预置）的全部技能」这条用户口径改由**默认页签 = 企业技能**承担。
  it('defaults to the 企业技能 tab and keeps the components section expanded by default', () => {
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(ENTERPRISE_MARKET_DEFAULT_EXPANDED).toEqual({ components: true })
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    // 不传 activeTab（真运行时初值 = 默认页签）：技能列表直接在树上，未装的也照列。
    const tree = EnterpriseMarketEntry({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills,
      expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
      onToggleSection: vi.fn(),
    })
    expect(textOf(tree)).toContain('会议纪要技能组')
    expect(collectElementById(tree, 'market-section-components')).toBeUndefined()
    // 默认态下技能行那枚开关就在树上（未装 → 关闭、可拨）。
    const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
    expect(skillSwitch['checked']).toBe(false)
    expect(skillSwitch['disabled']).toBe(true)
    // 「组件」页签默认展开：切到它就直接看见组件清单（折叠按钮仍是展开态）。
    const componentsTab = EnterpriseMarketEntry({
      view: 'page',
      activeTab: 'components',
      expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
      onToggleSection: vi.fn(),
    })
    expect(collectElementById(componentsTab, 'market-section-components')).not.toBeUndefined()
  })

  // ══ 本刀（观感复刻）的门禁 ══════════════════════════════════════════════════════════════════════════
  // 行版式照参考对象 `jingyunstudio/jingyun-dsh` 的 `MarketplaceSection.tsx`（可展开卡片 + 列表上方搜索框），
  // **但排版取值一律照官方** `@deepseek-ai/dsh-client-ui-settings-plugin-inventory` 的 `qSYn7G_*`。
  // 这条用例把官方取值逐条钉死，并把参考对象那四处已知漂移明确**排除**（改回去必须红）。
  it('locks the official plugin-inventory card values on every directory row', () => {
    const page = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
    const css = collectStyleText(page)
    // 卡片本体 = 官方 .card：.5px settings-card-stroke + radius-xl + settings-card-fill（不是 1px/10px/bg-layer-3）。
    const card = cssRuleBody(css, '.own-market-cardShell')
    expect(card).toContain('border:.5px solid var(--dsw-alias-settings-card-stroke')
    expect(card).toContain('border-radius:var(--dsw-radius-xl')
    expect(card).toContain('background:var(--dsw-alias-settings-card-fill')
    expect(card).not.toContain('border:1px')
    expect(card).not.toContain('border-radius:10px')
    expect(card).not.toContain('bg-layer-3')
    // 展开态只换描边色（官方 .card[data-open=true]{border-color:border-l3}），不加阴影。
    expect(cssRuleBody(css, ".own-market-cardShell[data-open='true']")).toContain('border-color:var(--dsw-alias-border-l3')
    // 标题行按钮 = 官方 .cardContent：列向 gap 2 + 12/14 内衬 + 52px 最小高 + 内缩 2px 的焦点环。
    const content = cssRuleBody(css, '.own-market-cardContent')
    expect(content).toContain('flex-direction:column')
    expect(content).toContain('min-height:52px')
    expect(content).toContain('padding:12px 14px')
    expect(content).toContain('gap:2px')
    // 焦点态照官方：焦点环内缩 2px（outline-offset:-2px），不是另画一层边框。
    const contentFocus = cssRuleBody(css, '.own-market-cardContent:focus-visible')
    expect(contentFocus).toContain('outline:var(--dsw-focus-ring-width')
    expect(contentFocus).toContain('outline-offset:-2px')
    // 主行 = 官方 .cardMainRow 两端对齐。
    expect(cssRuleBody(css, '.own-market-cardMainRow')).toContain('justify-content:space-between')
    // 标题 = 官方 .cardTitle **14/20/500**（排除 jingyun 漂移的 13px/600）。
    const title = cssRuleBody(css, '.own-market-cardTitle')
    expect(title).toContain('font-size:14px')
    expect(title).toContain('font-weight:500')
    expect(title).toContain('line-height:20px')
    expect(title).not.toContain('font-size:13px')
    expect(title).not.toContain('font-weight:600')
    // 描述 = 官方 .cardDescription **12/18 + 两行 clamp**（排除 13/18 单行、「仅展开时显示」）。
    const desc = cssRuleBody(css, '.own-market-cardDescription')
    expect(desc).toContain('font-size:12px')
    expect(desc).toContain('line-height:18px')
    expect(desc).toContain('-webkit-line-clamp:2')
    expect(desc).not.toContain('-webkit-line-clamp:1')
    // 展开区 = 官方 .cardDetails（顶部 .5px 发丝线 + 平台底 + 10/14/12 内衬）。
    const details = cssRuleBody(css, '.own-market-cardDetails')
    expect(details).toContain('border-top:.5px solid var(--dsw-alias-border-l2')
    expect(details).toContain('background:var(--dsw-alias-bg-module-platform')
    expect(details).toContain('padding:10px 14px 12px')
    // 列表 = 官方 .cards 两列 + gap 10，窄容器转单列（官方容器查询 + 同断点 media 兜底旧 WebView）。
    const cards = cssRuleBody(css, '.own-market-cardGrid')
    expect(cards).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
    expect(cards).toContain('gap:10px')
    expect(css).toContain('@container own-market-catalog')
    expect(css).toContain('@media (max-width:520px)')
    // DOM 结构锁：card / cardContent / cardMainRow / cardTrailing / cardDescription 各恰好一件（行可展开的骨架）。
    for (const name of ['own-market-cardShell', 'own-market-cardContent', 'own-market-cardMainRow', 'own-market-cardTrailing', 'own-market-cardChevron', 'own-market-cardDescription']) {
      expect(collectByClassName(page, name), name).toHaveLength(1)
    }
    // 行尾三件事：官方 StateDot（10px 图钉尺寸，不缩放）+ 一枚官方 Tag 标签 + chevron。
    expect(collectStateDotProps(page)).toHaveLength(1)
    expect(collectByClassName(page, 'own-market-phaseDot')).toHaveLength(1)
    expect(collectByClassName(page, 'own-market-configTag')).toHaveLength(1)
    // 行还是「目录类」的两列卡片：两侧页签都用 .own-market-cardGrid（组件页签仍走它自己的 rows 版式，见另用例）。
    expect(collectByClassName(page, 'own-market-rows')).toEqual([])
  })

  // 可展开行：整行是 button（`aria-expanded` + `aria-controls` 配对），开合状态**只由 props 决定**
  // ——纯函数体一行状态都不持（与 activeTab/expandedSections 同一约定），真运行时由 hook 入口的 useState 供给。
  it('expands one directory row at a time through an aria-paired disclosure button', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组' },
    ])
    const key = enterpriseMarketRowKey('skills', SKILL.id)
    expect(key).toBe(`skills:${SKILL.id}`)
    expect(enterpriseMarketRowKey('plugins', 'ent-a')).toBe('plugins:ent-a')
    // 展开区 id 只留安全字符（包名里的 @ 与 / 不会拿到非法选择器）。
    expect(enterpriseMarketRowDetailsId('skills', SKILL.id)).toBe(`market-details-skills-${SKILL.id}`)
    expect(enterpriseMarketRowDetailsId('plugins', '@scope/ent-a')).toBe('market-details-plugins--scope-ent-a')
    // 纯投影：显式给了就按它（单选）；`undefined` = 没给过状态 → 全开（纯函数直调得完整树，与 expandedSections 同约定）。
    expect(enterpriseMarketRowOpen(undefined, key)).toBe(true)
    expect(enterpriseMarketRowOpen(null, key)).toBe(false)
    expect(enterpriseMarketRowOpen(key, key)).toBe(true)
    expect(enterpriseMarketRowOpen('skills:other', key)).toBe(false)

    // 全收起（真运行时初值 null）：两行都只剩标题行，展开区整段不进 DOM（照官方 `{open && children}`），开关随之不在树上。
    const collapsed = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: rows, expandedRow: null, onToggleSkill: vi.fn(), onToggleRow: vi.fn() })
    expect(collectByClassName(collapsed, 'own-market-cardShell').map(props => props['data-open'])).toEqual([undefined, undefined])
    expect(collectByClassName(collapsed, 'own-market-cardContent').map(props => props['aria-expanded'])).toEqual([false, false])
    expect(collectByClassName(collapsed, 'own-market-cardDetails')).toEqual([])
    expect(collectSwitchProps(collapsed)).toEqual([])
    // 标题行按钮仍在，且 `aria-controls` 与展开区 id 同源（收起时该容器不在 DOM，与官方同）。
    expect(collectByClassName(collapsed, 'own-market-cardContent').map(props => props['aria-controls'])).toEqual([
      enterpriseMarketRowDetailsId('skills', rows[0]!.id),
      enterpriseMarketRowDetailsId('skills', rows[1]!.id),
    ])
    // 展开第二行：只有那一行 data-open=true，只有它的展开区与开关进 DOM（**单选**，不是全部展开）。
    const expanded = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: rows,
      expandedRow: enterpriseMarketRowKey('skills', rows[1]!.id), onToggleSkill: vi.fn(), onToggleRow: vi.fn(),
    })
    expect(collectByClassName(expanded, 'own-market-cardShell').map(props => props['data-open'])).toEqual([undefined, 'true'])
    expect(collectByClassName(expanded, 'own-market-cardContent').map(props => props['aria-expanded'])).toEqual([false, true])
    expect(collectElementById(expanded, enterpriseMarketRowDetailsId('skills', rows[1]!.id))).not.toBeUndefined()
    expect(collectElementById(expanded, enterpriseMarketRowDetailsId('skills', rows[0]!.id))).toBeUndefined()
    expect(collectSwitchProps(expanded)).toHaveLength(1)

    // 点标题行 → 回调**本行的行键**（hook 入口据此单选翻转；收起点它也是同一个行键，翻转由 onToggleRow 自己判）。
    const onToggleRow = vi.fn()
    const clickable = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: rows, expandedRow: key, onToggleRow })
    collectByClassName(clickable, 'own-market-cardContent')[0]?.['onClick']?.()
    expect(onToggleRow).toHaveBeenCalledWith(key)
    // 没有回调时标题行仍是可聚焦的真按钮、点击是 no-op（不抛错、也不假改状态）。
    const bare = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: rows, expandedRow: null })
    expect(collectByClassName(bare, 'own-market-cardContent')[0]?.['aria-expanded']).toBe(false)
    expect(() => { collectByClassName(bare, 'own-market-cardContent')[0]?.['onClick']?.() }).not.toThrow()
  })

  // 搜索框：位置照参考对象（**列表上方**、卡片之前）、350ms 防抖（在 hook 入口，纯函数体只抛原始输入）、
  // 过滤是**纯客户端**的（不发请求、不新增本机路由）；只给两个目录页签配（「组件」恒三行，理由见常量注释）。
  it('filters only the active directory tab through a 350ms-debounced client-side search box', async () => {
    expect(ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS).toBe(350)
    expect(ENTERPRISE_MARKET_DIRECTORY_TABS).toEqual(['skills', 'plugins'])
    expect(ENTERPRISE_MARKET_SEARCH_INITIAL).toEqual({ skills: '', plugins: '' })
    expect(enterpriseMarketSearchPlaceholder('skills')).toBe('搜索企业技能…')
    expect(enterpriseMarketSearchPlaceholder('plugins')).toBe('搜索企业插件…')
    expect(enterpriseMarketSearchLabel('skills')).toBe('搜索企业技能')
    expect(enterpriseMarketSearchLabel('plugins')).toBe('搜索企业插件')

    // 纯过滤投影：空关键词原样返回（顺序不动、不减不增）；大小写/首尾空白不敏感；命中任一字段即留；一条不命中给空数组。
    const skills = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组', description: '评审代码' },
    ])
    expect(enterpriseMarketSearchSkillRows(skills, '')).toEqual(skills)
    expect(enterpriseMarketSearchSkillRows(skills, '   ')).toEqual(skills)
    expect(enterpriseMarketSearchSkillRows(skills, '代码').map(row => row.skillId)).toEqual(['code-review'])
    expect(enterpriseMarketSearchSkillRows(skills, 'MEETING-NOTES').map(row => row.skillId)).toEqual(['meeting-notes'])
    expect(enterpriseMarketSearchSkillRows(skills, '转写').map(row => row.id)).toEqual([SKILL.id])
    expect(enterpriseMarketSearchSkillRows(skills, '研发工具')).toEqual([])
    expect(enterpriseMarketSearchSkillRows(enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]), '研发工具')).toHaveLength(1)
    expect(enterpriseMarketSearchSkillRows(skills, '不存在的东西')).toEqual([])
    expect(enterpriseMarketSearchTerm('  A b ')).toBe('a b')
    expect(enterpriseMarketSearchRows(skills, '', row => [row.displayName])).toEqual(skills)
    // 插件侧同一套口径（包名 / 版本）。
    const plugins = enterpriseMarketPluginRows(
      [{ pluginVersionId: 'v1', packageName: 'ent-a', version: '1.2.0', sizeBytes: 1024, operatingSystems: ['linux'] }] as never,
      [],
    )
    expect(enterpriseMarketSearchPluginRows(plugins, 'ENT-A')).toHaveLength(1)
    expect(enterpriseMarketSearchPluginRows(plugins, '1.2')).toHaveLength(1)
    expect(enterpriseMarketSearchPluginRows(plugins, 'ent-z')).toEqual([])

    // 渲染：搜索框在**列表上方**（catalog 的第一个孩子，cards 在它之后）、placeholder/无障碍名按页签给；
    // 输入回调把**原始值**抛给 hook 入口（防抖在那边，本层不持定时器也不持状态）。
    const onSearchInput = vi.fn()
    const page = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: skills, onSearchInput })
    const catalogKids = collectByClassName(page, 'own-market-catalog')[0]?.['children'] as ReactNode[]
    expect(String((catalogKids[0] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-catalogSearch')
    expect(String((catalogKids[1] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardGrid')
    const input = collectByClassName(page, 'own-market-catalogSearchInput')[0]
    expect(input?.['type']).toBe('search')
    expect(input?.['placeholder']).toBe('搜索企业技能…')
    expect(input?.['aria-label']).toBe('搜索企业技能')
    input?.['onChange']?.({ target: { value: '代码' } })
    expect(onSearchInput).toHaveBeenCalledWith('skills', '代码')
    // 受控值必须直连**原始输入**（`searchValue`）而不是防抖后的 `searchQuery`：否则每次按键后的重渲染
    // 都会把框重置回旧值（用户会觉得「打字被吞」）；防抖只影响过滤。
    const typing = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchValue: { skills: '代码' }, searchQuery: { skills: '' } })
    expect(collectByClassName(typing, 'own-market-catalogSearchInput')[0]?.['value']).toBe('代码')
    expect(collectByClassName(typing, 'own-market-cardShell')).toHaveLength(2)
    expect(collectByClassName(page, 'own-market-catalogSearchInput')[0]?.['value']).toBe('')

    // 过滤后**只有命中的行**在 DOM；页签计数仍说目录总行数（页签口径不变）；一条不剩时给空态文案且列表整段不渲染。
    const filtered = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: '代码' } })
    expect(textOf(filtered)).toContain('代码评审技能组')
    expect(textOf(filtered)).not.toContain('会议纪要技能组')
    expect(collectByRole(filtered, 'tab')[0]?.['children']).toBe(enterpriseMarketTabLabel('企业技能', 2))
    const empty = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: 'zzz' } })
    expect(textOf(empty)).toContain(ENTERPRISE_MARKET_SEARCH_EMPTY)
    expect(collectByClassName(empty, 'own-market-cardGrid')).toEqual([])
    // 清空关键词即恢复全部（空串 = 不过滤）。
    const cleared = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: '' } })
    expect(collectByClassName(cleared, 'own-market-cardShell')).toHaveLength(2)
    // 页签分槽：技能页签的框只回技能的关键词，插件页签各有自己的框与自己的槽。
    const pluginsPage = EnterpriseMarketEntry({ view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: plugins as never, onSearchInput })
    expect(collectByClassName(pluginsPage, 'own-market-catalogSearchInput')[0]?.['placeholder']).toBe('搜索企业插件…')
    collectByClassName(pluginsPage, 'own-market-catalogSearchInput')[0]?.['onChange']?.({ target: { value: 'x' } })
    expect(onSearchInput).toHaveBeenLastCalledWith('plugins', 'x')
    // 「组件」页签**不配搜索框**（恒三行、且是交付排期清单，过滤它只会把三行藏成一两行）：整棵树里没有它。
    const components = EnterpriseMarketEntry({ view: 'page', activeTab: 'components' })
    expect(collectByClassName(components, 'own-market-catalogSearch')).toEqual([])
    expect(collectByClassName(components, 'own-market-catalogSearchInput')).toEqual([])
    expect(textOf(components)).toContain('包含的组件')

    // 防抖（源码级不变量）：350 只以常量形式出现一次，定时器必须清；纯函数体里不许出现定时器/请求。
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    expect(source).toContain('setTimeout(() => {')
    expect(source).toContain('}, ENTERPRISE_MARKET_SEARCH_DEBOUNCE_MS)')
    expect(source).toContain('clearTimeout(timer)')
    expect(source).not.toContain('}, 350)')
    expect(source).not.toContain('fetch(')
  })

  // 行尾状态点：语义照官方 `StateDot`（活跃=已装/可用 → done、未观察=未装 → idle、需留意 → warning），
  // **在途用官方 `StateDot state="ongoing"`（旋转弧）** —— 官方与参考对象都没有的在途反馈，属我们补短板；
  // 旁边那枚「启用/已装」标签照参考对象的 configTag 语义，视觉改用官方 `Tag` 原语（不自绘颜色）。
  it('maps every directory row to the official StateDot semantics, config tag and status text', () => {
    // 技能行五态 → 状态点 / 标签 / 状态文案（安静态不重复说话：事实已由标签说清）。
    expect(enterpriseMarketSkillDot('AVAILABLE')).toBe('idle')
    expect(enterpriseMarketSkillDot('INSTALLED')).toBe('done')
    expect(enterpriseMarketSkillDot('UPDATE_AVAILABLE')).toBe('warning')
    expect(enterpriseMarketSkillDot('INSTALLING')).toBe('ongoing')
    expect(enterpriseMarketSkillDot('REMOVING')).toBe('ongoing')
    expect(enterpriseMarketSkillConfigTag('AVAILABLE')).toEqual({ enabled: false, label: '未装', tone: 'neutral' })
    expect(enterpriseMarketSkillConfigTag('INSTALLED')).toEqual({ enabled: true, label: '已装', tone: 'success' })
    expect(enterpriseMarketSkillConfigTag('UPDATE_AVAILABLE')).toEqual({ enabled: true, label: '已装', tone: 'success' })
    expect(enterpriseMarketSkillConfigTag('INSTALLING')).toEqual({ enabled: false, label: '未装', tone: 'neutral' })
    expect(enterpriseMarketSkillConfigTag('REMOVING')).toEqual({ enabled: true, label: '已装', tone: 'success' })
    expect(enterpriseMarketSkillStatusLabel('AVAILABLE')).toBeUndefined()
    expect(enterpriseMarketSkillStatusLabel('INSTALLED')).toBeUndefined()
    expect(enterpriseMarketSkillStatusLabel('UPDATE_AVAILABLE')).toBe('有更新')
    expect(enterpriseMarketSkillStatusLabel('INSTALLING')).toBe('安装中')
    expect(enterpriseMarketSkillStatusLabel('REMOVING')).toBe('卸载中')
    // 插件行：只有本机 ACTIVE 才算「已启用」；状态文案仍取本仓唯一那份官方状态词表，两个安静态不出文字。
    expect(enterpriseMarketPluginConfigTag('ACTIVE')).toEqual({ enabled: true, label: '已启用', tone: 'success' })
    for (const state of ['EXPECTED', 'DOWNLOAD_PENDING', 'DOWNLOADING', 'VERIFIED', 'INSTALLING', 'RESTART_REQUIRED', 'REMOVE_PENDING', 'REMOVING', 'FAILED', 'ROLLBACK'] as const) {
      expect(enterpriseMarketPluginConfigTag(state), state).toEqual({ enabled: false, label: '未启用', tone: 'neutral' })
    }
    expect(enterpriseMarketPluginStatusLabel('ACTIVE')).toBeUndefined()
    expect(enterpriseMarketPluginStatusLabel('EXPECTED')).toBeUndefined()
    expect(enterpriseMarketPluginStatusLabel('FAILED')).toBe('处理失败')
    expect(enterpriseMarketPluginStatusLabel('RESTART_REQUIRED')).toBe('等待重启')

    // 未装技能行：idle 点 + neutral「未装」标签 + 没有多余文字；行上带可断言的启用态钩子。
    const tree = EnterpriseMarketEntry({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]), onToggleSkill: vi.fn() })
    expect(collectStateDotProps(tree).map(props => props['state'])).toEqual(['idle'])
    expect(collectByClassName(tree, 'own-market-configTag')[0]).toMatchObject({ tone: 'neutral', children: '未装' })
    expect(collectByClassName(tree, 'own-market-rowStatus')).toEqual([])
    expect(collectDataValues(tree, 'data-enterprise-row-enabled')).toEqual(['false'])
    // 在途：状态点转 ongoing（旋转弧）、标签仍是「未装」、状态文字「安装中」——标题行上就能看见「正在进行」。
    const busy = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
      pendingSkill: { packageId: SKILL.id, next: true }, onToggleSkill: vi.fn(),
    })
    expect(collectStateDotProps(busy).map(props => props['state'])).toEqual(['ongoing'])
    expect(collectByClassName(busy, 'own-market-rowStatus').map(props => props['children'])).toEqual(['安装中'])
    expect(collectDataValues(busy, 'data-enterprise-skill-state')).toEqual(['INSTALLING'])
    // 已装旧版本：warning 点 + success「已装」标签 + 「有更新」文字（三者互补：盘上事实 vs 相对中心的结论）。
    const outdated = EnterpriseMarketEntry({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatableRow()],
      installedSkills: [installedSkill('1902500000000000100')], onToggleSkill: vi.fn(),
    })
    expect(collectStateDotProps(outdated).map(props => props['state'])).toEqual(['warning'])
    expect(collectByClassName(outdated, 'own-market-configTag')[0]).toMatchObject({ tone: 'success', children: '已装' })
    expect(collectByClassName(outdated, 'own-market-rowStatus').map(props => props['children'])).toEqual(['有更新'])
    // 插件行：ACTIVE → done + success「已启用」且无多余文字；FAILED → error 点 + 官方「处理失败」+ 未启用标签。
    const activePlugin = EnterpriseMarketEntry({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
    })
    expect(collectStateDotProps(activePlugin).map(props => props['state'])).toEqual(['done'])
    expect(collectByClassName(activePlugin, 'own-market-configTag')[0]).toMatchObject({ tone: 'success', children: '已启用' })
    expect(collectByClassName(activePlugin, 'own-market-rowStatus')).toEqual([])
    const failedPlugin = EnterpriseMarketEntry({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'FAILED', inCatalog: true }] as never,
    })
    expect(collectStateDotProps(failedPlugin).map(props => props['state'])).toEqual(['error'])
    expect(collectByClassName(failedPlugin, 'own-market-configTag')[0]).toMatchObject({ tone: 'neutral', children: '未启用' })
    expect(collectByClassName(failedPlugin, 'own-market-rowStatus').map(props => props['children'])).toEqual(['处理失败'])
  })

  // 复刻的**边界回归锁**：改成可展开行之后，原先那五条「必须保留的能力」各自都要有落点——
  // ① 版本签/分类签 → 标题行；② 有更新辅助动作 / ③ 安装卸载开关 / ④ 失败提示 → 展开区（收起时一起收起，展开即回来）；
  // ⑤ 组件页签的折叠语义、三行清单与无障碍契约不变。
  it('keeps every pre-existing capability inside the new disclosure layout', () => {
    const row = updatableRow()
    const key = enterpriseMarketRowKey('skills', row.id)
    const shared = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [row],
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: row.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      onToggleSkill: vi.fn(),
      onToggleRow: vi.fn(),
    }
    const tree = EnterpriseMarketEntry({ ...shared, expandedRow: key })
    // ① 标题行：标题 + 版本签 + 分类签（分类缺席时那一格是 null，不塞占位）。
    expect((collectByClassName(tree, 'own-market-cardHead')[0]?.['children'] as ReactNode[])).toHaveLength(3)
    expect(collectByClassName(tree, 'own-market-skillVersionTag')).toHaveLength(1)
    // ②③④ 三件事都在**展开区**里：有更新按钮 + 官方 Switch + role="alert"（全树各恰好一件，即「都在展开区」）。
    const details = collectElementById(tree, enterpriseMarketRowDetailsId('skills', row.id))
    expect(details).not.toBeUndefined()
    expect(textOf(details as ReactNode)).toContain('有更新')
    expect(collectAlerts(details as ReactNode)).toHaveLength(1)
    expect(collectSwitchProps(tree)).toHaveLength(1)
    expect(collectSwitchProps(details as ReactNode)).toHaveLength(1)
    expect(collectTagProps(tree)).toHaveLength(1)
    expect(collectTagProps(details as ReactNode)).toHaveLength(1)
    // 动作条里的相对顺序不变：辅助动作在 Switch **左侧**（开关仍是主控件）。
    const actionKids = cardActionChildren(tree, row.id)
    const tagIndex = actionKids.findIndex(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-tag'] !== undefined)
    const switchIndex = actionKids.findIndex(child => isValidElement(child) && child.type === (Switch as unknown))
    expect(tagIndex).toBeGreaterThanOrEqual(0)
    expect(switchIndex).toBeGreaterThan(tagIndex)
    // 行内失败提示的类名与「技能」tab 同口径（不新造视觉），且带稳定错误码。
    const alertNodes = collectAlerts(tree)
    expect(isValidElement(alertNodes[0]) ? (alertNodes[0].props as Record<string, unknown>)['className'] : undefined).toBe('own-market-inlineError')
    expect(textOf(alertNodes[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // 收起（真运行时初值 null）：动作与提示一起收起——不是丢能力，展开就回来；`aria-controls` 恒指向本行展开区。
    const collapsed = EnterpriseMarketEntry({ ...shared, expandedRow: null })
    expect(collectSwitchProps(collapsed)).toEqual([])
    expect(collectAlerts(collapsed)).toEqual([])
    expect(collectTagProps(collapsed)).toEqual([])
    expect(collectByClassName(collapsed, 'own-market-cardContent')[0]?.['aria-controls']).toBe(enterpriseMarketRowDetailsId('skills', row.id))
    // ⑤ 组件页签：折叠语义与三行清单、开关动作名一字未动；搜索框没进这个页签。
    const components = EnterpriseMarketEntry({ view: 'page', activeTab: 'components', expandedSections: { components: true }, onToggleSection: vi.fn() })
    expect(collectElementById(components, 'market-section-components')).not.toBeUndefined()
    expect(collectSwitchProps(components).map(props => props['label'])).toEqual(['启用组件 插件', '启用组件 技能', '启用组件 配方'])
    expect(textOf(components)).toContain('包含的组件')
    expect(collectByClassName(components, 'own-market-catalogSearch')).toEqual([])
    // 三页签与默认选中不变（复刻没有动信息架构）。
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'components'])
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(collectByRole(EnterpriseMarketEntry({ view: 'page' }), 'tablist')).toHaveLength(1)
    expect(collectByRole(EnterpriseMarketEntry({ view: 'page' }), 'tab')).toHaveLength(3)
    expect(collectByRole(EnterpriseMarketEntry({ view: 'page' }), 'tabpanel')).toHaveLength(3)
  })

  // 类名隔离的源码级不变量（本轮发现的真实隐患）：本页与「企业设置 → 插件」（`plugin-market.tsx`）都注入
  // 同名前缀的 `<style>`，而两者用的是**全局单类选择器**——同一个类名会被后挂载的那份 CSS 覆盖
  // （例如 `plugin-market` 的 `.own-market-card` 会把本页卡片改成 1px/8px/padding:16、`.own-market-search input`
  // 会以更高特异性压掉本页输入框的描边）。故本文件的类名必须与同包其他源文件**零交集**。
  it('keeps this page\'s style class names disjoint from every other source file', async () => {
    const mine = declaredClassNames(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 抽取器先自证有效：本刀新起的几个类名必须能被抽出来。
    expect(mine.has('own-market-cardShell')).toBe(true)
    expect(mine.has('own-market-cardGrid')).toBe(true)
    expect(mine.has('own-market-catalogSearch')).toBe(true)
    expect(mine.has('own-market-storeTabs')).toBe(true)
    // 会与 plugin-market 撞名的那三个旧名字（以及它们各自的派生名）不再出现。
    expect(mine.has('own-market-card')).toBe(false)
    expect(mine.has('own-market-search')).toBe(false)
    expect(mine.has('own-market-tabs')).toBe(false)
    const names = (await readdir(new URL('../src/', import.meta.url)))
      .filter(name => /\.tsx?$/.test(name) && name !== 'marketplace-entry.tsx')
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const other = declaredClassNames(await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8'))
      expect([...mine].filter(cls => other.has(cls)), name).toEqual([])
    }
  })
})

/**
 * 二期结构切片：应用商店从「官方插件页内的一个 page」升级为「**侧栏一级入口 + 主内容区整页面板**」，
 * 两条入口（`plugins.item` 的 card/page 与新的 `main` key `enterprise-store` + `sidebar.panellist`）并存。
 * 这里锁两件事：
 *  ① **注册形状**——slot 名、`main.key` 与 `sidebar.panellist.id` 同值、order=20、label「应用商店」、图标存在、
 *     `inject` 声明含 `layout`；
 *  ② **一份实现两处入口**——两处注册的是**同一个组件函数**（`EnterpriseMarketPage`），面板侧只在注册时注入
 *     等价 props（`view` 恒为 `ENTERPRISE_STORE_PANEL_VIEW='page'`，与 item 的 page 同值、store 同源），
 *     因此两处产出的三页签商店结构逐项一致（任何「复制一份实现」都会在这里分叉出来）。
 */
describe('the enterprise store panel and its sidebar entry', () => {
  it('registers the main panel and the sidebar entry with matching id/key, order 20 and the 应用商店 label', () => {
    const { injected, registrations } = runClientRegistrations()
    // `layout` 是「从商店跳回官方插件列表」（ctx.layout.selectPanel('plugins')）的必要声明。
    expect([...inject]).toEqual(['slots', 'remote', 'layout'])
    expect(injected).toContain('main')
    expect(injected).toContain('sidebar.panellist')

    const panel = registrations.find(entry => entry.options['name'] === 'main')!
    const sidebar = registrations.find(entry => entry.options['name'] === 'sidebar.panellist')!
    expect(panel.options).toMatchObject({ name: 'main', key: 'enterprise-store' })
    expect(sidebar.options).toMatchObject({
      name: 'sidebar.panellist',
      id: 'enterprise-store',
      order: 20,
      label: '应用商店',
    })
    // 官方契约「每个 list id 对应同名 main 面板」：两处必须同值，否则点击命中 selectPanel 的「未注册」抛错。
    expect(sidebar.options['id']).toBe(panel.options['key'])
    expect(sidebar.options['id']).toBe(ENTERPRISE_STORE_PANEL_ID)
    expect(ENTERPRISE_STORE_ENTRY_LABEL).toBe('应用商店')
    expect(ENTERPRISE_STORE_ENTRY_ORDER).toBe(20)
    // 排在官方实测占用（plugins=0、schedules=10）之后。
    expect(ENTERPRISE_STORE_ENTRY_ORDER).toBeGreaterThan(10)
    // 图标：侧栏 owner props 是 { size, active }，本组件消费 size（函数组件、真实元素）。
    expect(typeof sidebar.component).toBe('function')
    expect(sidebar.component).toBe(EnterpriseStoreIcon)
    const icon = EnterpriseStoreIcon({ size: 18 })
    expect(isValidElement(icon)).toBe(true)
    expect(isValidElement(icon) ? icon.props['size'] : undefined).toBe(18)
  })

  it('renders one and the same three-tab store through both entries', () => {
    const { registrations } = runClientRegistrations()
    const item = registrations.find(entry => entry.options['name'] === 'plugins.item')!
    const panel = registrations.find(entry => entry.options['name'] === 'main')!
    // ① 一份实现两处入口：两处注册的是**同一个组件函数**（没有复制第二份商店）。
    expect(panel.component).toBe(item.component)
    // ② 面板侧不读官方 owner props，而在注册面注入等价 props：view 恒为 'page'、store 与卡片同源。
    const panelProps = (panel.options['inject'] as () => Record<string, unknown>)()
    const itemProps = (item.options['inject'] as () => Record<string, unknown>)()
    expect(panelProps['view']).toBe(ENTERPRISE_STORE_PANEL_VIEW)
    expect(ENTERPRISE_STORE_PANEL_VIEW).toBe('page')
    expect(panelProps['store']).toBe(itemProps['store'])

    const props = {
      sessionUsable: true,
      enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
    }
    // 树① = plugins.item 的 page 视图（官方把 owner props 的 view 传成 'page'）；
    // 树② = 新面板（client.tsx 注入的正是上面读出的那个 view 值）。
    const viaItemPage = EnterpriseMarketEntry({ view: 'page', ...props })
    const viaStorePanel = EnterpriseMarketEntry({ view: panelProps['view'] as 'page', ...props })
    /** 只取「关键结构」：页签条/页签/面板的 aria 配对、右侧开关的动作名与全树可见文本。 */
    const shapeOf = (tree: ReactNode) => ({
      tablist: collectByRole(tree, 'tablist').map(node => node['aria-label']),
      tabs: collectByRole(tree, 'tab').map(node => ({
        id: node['id'],
        label: node['children'],
        selected: node['aria-selected'],
        controls: node['aria-controls'],
        tabIndex: node['tabIndex'],
      })),
      panels: collectByRole(tree, 'tabpanel').map(node => ({
        id: node['id'],
        labelledby: node['aria-labelledby'],
        hidden: node['hidden'],
      })),
      switches: collectSwitchProps(tree).map(node => node['label']),
      text: textOf(tree),
    })
    for (const [shell, tree] of [['plugins.item page', viaItemPage], ['store panel', viaStorePanel]] as const) {
      // 两处都必须产出「一条 role="tablist" + 三个企业页签」的商店。
      expect(collectByRole(tree, 'tablist'), shell).toHaveLength(1)
      expect(collectByRole(tree, 'tablist')[0]?.['aria-label'], shell).toBe(ENTERPRISE_MARKET_TABLIST_LABEL)
      expect(collectByRole(tree, 'tab').map(node => node['children']), shell)
        .toEqual(['企业技能 1', '企业插件 1', '组件 3'])
      expect(collectByRole(tree, 'tab').map(node => node['aria-selected']), shell).toEqual([true, false, false])
      expect(collectByRole(tree, 'tabpanel'), shell).toHaveLength(ENTERPRISE_MARKET_TABS.length)
    }
    // 同一份实现 + 同一个 view 值 → 同一份关键结构（页签 id/文案/aria 配对/开关动作名/全部可见文本）。
    expect(shapeOf(viaStorePanel)).toEqual(shapeOf(viaItemPage))
  })
})

/**
 * 跑一遍真注册面（`client.tsx` 的 `apply`）并收集座位：`slots.inject(name, register)` 的名字顺序
 * 与每次 `register(options, component)` 的形状。测试宿主没有官方 slots 台账，故只喂最小 double。
 */
function runClientRegistrations(): {
  readonly injected: readonly string[]
  readonly registrations: readonly { readonly options: Record<string, unknown>; readonly component: unknown }[]
} {
  const injected: string[] = []
  const registrations: { options: Record<string, unknown>; component: unknown }[] = []
  apply({
    slots: {
      inject: (name: string, register: () => unknown) => { injected.push(name); return register() },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ options, component })
        return () => undefined
      },
    },
    remote: { $on: () => () => undefined },
    get: () => undefined,
    inject: () => undefined,
    on: () => () => undefined,
    effect: (effect: () => unknown) => { effect() },
  })
  return { injected, registrations }
}

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

/** 收集树里 `role` 匹配的元素 props（页签条 / 页签 / 面板的 aria 配对断言），递归展开函数组件子树。 */
function collectByRole(node: ReactNode, role: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByRole(child, role, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['role'] === role) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') collectByRole((node.type as (p: unknown) => ReactNode)(props), role, acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByRole(value as ReactNode, role, acc)
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

/**
 * 抽出某个源文件**样式块**里声明的 CSS 类名（只看模板字面量里像 CSS 的块，
 * 不把 JS 成员访问如 `props.length` 误当类名），用于锁「本文件与同包其他文件的类名零交集」。
 */
function declaredClassNames(source: string): Set<string> {
  const blocks = [...source.matchAll(/`([^`]*?)`/gs)]
    .map(match => match[1] ?? '')
    .filter(block => block.includes('{') && block.includes('}') && block.includes(':'))
  return new Set([...blocks.join('\n').matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)\s*[,:{[\s>]/g)].map(match => match[1]!))
}

/** 收集元素树里所有官方 `<StateDot>` 的 props（行尾状态点语义：活跃/未观察/在途…）。 */
function collectStateDotProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectStateDotProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === (StateDot as unknown)) { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') collectStateDotProps((node.type as (p: unknown) => ReactNode)(props), acc)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectStateDotProps(value as ReactNode, acc)
  }
  return acc
}

/** 收集元素树里某个 `data-*` 属性的全部取值（锁数据钩子：受管态如实报态、辅助标签只在有更新时出现）。 */
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

/**
 * 取某行**展开区动作条**（`.own-market-cardActions`）的直属子元素（顺序即渲染顺序），
 * 用于锁「辅助标签严格排在 Switch 左侧」——版式改了（动作从标题行搬进可展开的 cardDetails），
 * 但这条相对顺序不许反过来。动作条用展开区的 DOM id（`enterpriseMarketRowDetailsId`）精确定位到本行。
 */
function cardActionChildren(tree: ReactNode, rowId: string, tab: 'skills' | 'plugins' = 'skills'): ReactNode[] {
  const details = collectElementById(tree, enterpriseMarketRowDetailsId(tab, rowId)) as { props?: Record<string, unknown> } | undefined
  const kids = details?.props?.['children'] as ReactNode[] | undefined
  const actions = collectByClassName(kids as ReactNode, 'own-market-cardActions')[0]
  const actionKids = actions?.['children']
  return Array.isArray(actionKids) ? (actionKids as ReactNode[]) : []
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
