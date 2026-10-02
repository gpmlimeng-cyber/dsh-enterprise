/**
 * [INPUT]: 依赖 marketplace-entry 的**两套呈现外壳**（`EnterpriseMarketLegacyShell` 旧外观 / `EnterpriseMarketStoreShell` 新外观）、两个 hook 入口（`EnterpriseMarketLegacyPage`/`EnterpriseMarketStorePage`）与共享逻辑层（`enterpriseMarketShellModel`、`enterpriseMarketSkillRowFacts`/`enterpriseMarketPluginRowFacts`、HERO 文案投影）、注册常量、**页签真源**（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`）、组件清单/摘要/状态/开关语义纯投影、企业插件行投影、企业技能行投影（含详情归并的中心版本 `latestVersionId`，以及标题行两枚标签的取值：列表投影的 `sourceDshVersion` 与可选 `category`）与可见性门控、标题行标签纯投影 `enterpriseMarketSkillVersionTag`/`enterpriseMarketSkillCategoryTag`、技能节受管态纯投影 `enterpriseMarketSkillState`、「有更新」判定 `enterpriseMarketSkillHasUpdate`/`enterpriseMarketSkillRowHasUpdate` 与辅助标签投影 `enterpriseMarketSkillUpdateTag`、**组件页签折叠态常量** `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败行内提示投影 `enterpriseMarketActionErrorLabel`、入口组件与版本签组件本身、**页签文案计数投影** `enterpriseMarketTabLabel`，以及 local-api-decode 的 `EnterpriseRuntimeSkill`/`EnterpriseInstalledSkill` 形状与应用商店共享身份常量（`ENTERPRISE_STORE_PANEL_ID`/`ENTERPRISE_STORE_ENTRY_LABEL`/`ENTERPRISE_STORE_ENTRY_ORDER`/`ENTERPRISE_STORE_PANEL_VIEW`）、侧栏图标 `EnterpriseStoreIcon`，以及 `client.tsx` 的 `apply`/`inject` 真注册面（最小 slots double）
 * [OUTPUT]: 验证入口身份常量、卡片一句话的单行约束、**page 视图的三页签商店结构**（页签条手写 `role="tablist"`、三个页签的 `aria-selected`/`aria-controls`/roving `tabIndex`/`id` 与三个 `role="tabpanel"` 的 `aria-labelledby` 严格配对、**默认选中「企业技能」**、切换后**只渲染该页签内容**、←/→/Home/End 走焦并选中、鼠标点击回调）、组件清单（插件/技能/配方）顺序与 reserved 语义、计数摘要口径、summary/page 两视图结构（page 上的组件行在「组件」页签里，且 page 不重画标题/desc）、版本签只对本条目 subject 出、企业插件页签的归并与门控，以及**企业技能页签的官方两行卡片**（第 1 行标题 + 紧随的**版本签 `sourceDshVersion`** 与**可选分类签 `category`**——分类缺席/null/空串时该签不出现、第 1 行 nowrap 单行锁 20px 行高故加签不撑高、标题先省略标签保持可见；第 2 行描述各自成行、描述单行省略、旧元信息行退场）/可见性门控/计数/右侧那枚官方 `Switch`（`checked` 反映已装、在途 `disabled`、`label` 给动作语义、`onChange(next)` 两个方向都回调）与受管态投影（未装/已装/有更新/在途），以及**开关左侧那枚辅助标签**（只在「有更新」时出现、`aria-label`=`更新企业技能 X`、点击走安装方向、在途 `disabled` 不消失、未装/已装同版本一律不出现、标签严格排在 Switch 左侧），以及**「有更新」独立用例**（只有两侧 `versionId` 参与、`sha256` 换值不改结论、缺任一侧不判），以及**只改技能行**的回归锁（技能行有 Switch + 辅助标签、企业插件行一字未动），以及**两节行上的失败可见反馈**（失败 → 该行 role="alert" + 稳定错误码、只落失败行、失败后开关仍可拨重试、成功路径不出现该提示），以及**页签化后唯一剩下的组件节折叠**（`ENTERPRISE_MARKET_DEFAULT_EXPANDED` 单字段、aria 契约、折叠态列表不进 DOM），以及**详情页顶部压缩的取值锁**（badge 只剩版本号一签 + 包名、「预览版」签不再出现；`.own-market-storeTabs` `margin-top:0` + `flex-wrap:nowrap`、`.own-market-section` `margin-top:12px`、`.own-market-storeTab` `white-space:nowrap`/13-20；`.own-market-sectionMeta` 类规则整条删除且 DOM 不再有该容器，计数改由页签文案承载「企业技能 3」），以及**二期结构切片的注册形状门禁**（`main` key 与 `sidebar.panellist` id 同值 = `enterprise-store`、order 20 排在官方实测 plugins=0/schedules=10 之后、label「应用商店」、图标为函数组件、`inject` 声明含 `layout`）与**双外观拆分的门禁**（`plugins.item` 的注册组件 !== `main` 的注册组件，且分别为 `EnterpriseMarketLegacyPage`/`EnterpriseMarketStorePage`；面板注册面注入的 `view` 恒为 `ENTERPRISE_STORE_PANEL_VIEW='page'`、`plugins.item` 的 inject 恰为 `{store}` 且两处 store 同源；同一组输入下两套外壳的页签 id/文案/aria 配对/开关动作名/数据钩子逐项一致，而关键结构各自符合各自外观：旧外壳出 `own-market-cardId` 且无 `own-market-cardShell`/`own-market-cardGrid`/`own-market-storeHero`，新外壳反之；两套外壳的语义类断言（页签 aria 与键盘、组件节折叠、开关各态、两枚签、失败提示与可重试、计数口径）**逐个外壳各跑一遍**，外观类断言各自指名外壳）
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
  EnterpriseMarketHero,
  EnterpriseMarketLegacyPage,
  EnterpriseMarketLegacyShell,
  EnterpriseMarketRowError,
  EnterpriseMarketStorePage,
  EnterpriseMarketStoreShell,
  ENTERPRISE_STORE_HERO_NOTE,
  ENTERPRISE_STORE_HERO_TITLE,
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
  enterpriseMarketPluginRowFacts,
  enterpriseMarketPluginRows,
  enterpriseMarketPluginSectionVisible,
  enterpriseMarketPluginStatusLabel,
  enterpriseMarketHeroPluginChip,
  enterpriseMarketHeroSkillChip,
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
  enterpriseMarketShellModel,
  enterpriseMarketSkillCategoryTag,
  enterpriseMarketSkillConfigTag,
  enterpriseMarketSkillDot,
  enterpriseMarketSkillHasUpdate,
  enterpriseMarketSkillRowFacts,
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
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 两套外壳的共享子块（页签条 / 面板 / 组件节 / HERO / 行内失败提示）是**真函数组件**：
    // 它们的 children 由自己产出，必须先就地渲染一次才看得到文本；`vi.fn()` mock（Tag/Switch/StateDot）
    // 产出 undefined，退回读它的 children（否则 `v0.1.0` 这类标签文本会丢）。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return textOf(rendered as ReactNode)
  }
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

/**
 * 两套**外观外壳**（同一份逻辑、两套呈现）：`plugins.item` 的详情页走旧外壳（9723a97 那一版），
 * 侧栏「应用商店」面板走新外壳（HERO + 卡片网格 + 搜索）。
 * 所有「语义类」断言都对这张表逐个跑——两套外壳都不能少任何一条能力；
 * 「外观类」断言各自指名外壳（旧：`.own-market-cardId`/`.own-market-cardDesc`；新：`.own-market-cardShell`/`.own-market-cardGrid`）。
 */
const MARKET_SHELLS = [
  {
    label: '旧外观（plugins.item 详情页）',
    shell: EnterpriseMarketLegacyShell,
    layout: 'inline' as const,
    listClass: 'own-market-rows',
    titleClass: 'own-market-cardId',
    descClass: 'own-market-cardDesc',
  },
  {
    label: '新外观（应用商店 main 面板）',
    shell: EnterpriseMarketStoreShell,
    layout: 'card' as const,
    listClass: 'own-market-cardGrid',
    titleClass: 'own-market-cardTitle',
    descClass: 'own-market-cardDescription',
  },
] as const

/** 两套外壳共用的 props 形状（`Parameters` 直接从外壳签名取，避免测试自造第二份类型）。 */
type ShellProps = Parameters<typeof EnterpriseMarketLegacyShell>[0]

/** 同一组输入喂给两套外壳，返回「外壳名 → 树」的逐项表，供语义类断言逐个跑。 */
function renderShells(props: ShellProps): readonly (typeof MARKET_SHELLS[number] & { readonly tree: ReactNode })[] {
  return MARKET_SHELLS.map(entry => ({ ...entry, tree: entry.shell(props) }))
}

/** 商业化字样黑名单：两套外壳的全树文本与样式文本都不许出现（旧新都不做买卖）。 */
const BANNED_COMMERCIAL_WORDS = ['价格', '¥', '购买', '购物车', '客服', '付款', '支付', '下单', '优惠', '折扣', '交易', '续费', '订阅费'] as const

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
    // 两套外壳都必须有「summary 一句话 + page 三页签」这两面：逐个跑。
    for (const { label, shell } of MARKET_SHELLS) {
      const summary = shell({ view: 'summary' })
      expect(isValidElement(summary), label).toBe(true)
      expect(textOf(summary), label).toBe(ENTERPRISE_MARKET_SUMMARY)

      const page = shell({ view: 'page' })
      expect(isValidElement(page), label).toBe(true)
      expect(isValidElement(page) ? page.props['aria-label'] : undefined, label).toBe(ENTERPRISE_MARKET_ENTRY_LABEL)
      // page 视图 = 一条页签条 + 三个面板；页签文案 = 基础词 + 计数（无数据时企业技能/企业插件为 0、
      // 组件恒为清单长度 3）——计数原先独占一行，现在并入页签（顶部压缩）。
      const text = textOf(page)
      for (const tab of ENTERPRISE_MARKET_TABS) expect(text, label).toContain(tab.label)
      expect(text, label).toContain(enterpriseMarketTabLabel('企业技能', 0))
      expect(text, label).toContain(enterpriseMarketTabLabel('企业插件', 0))
      expect(text, label).toContain(enterpriseMarketTabLabel('组件', ENTERPRISE_MARKET_COMPONENTS.length))
      // 卡片摘要仍只出现在 summary 视图（page 里一个字都不重复）。
      expect(text, label).not.toContain(ENTERPRISE_MARKET_SUMMARY)
    }
  })

  // 本刀的核心：page 视图顶部一条手写页签条，三个页签 + 三个面板严格配对，默认选中「企业技能」。
  it('renders a hand-written tablist with the three page tabs and 企业技能 selected by default', () => {
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'components'])
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label)).toEqual(['企业技能', '企业插件', '组件'])
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(ENTERPRISE_MARKET_TABS[0]?.id).toBe(ENTERPRISE_MARKET_DEFAULT_TAB)

    // 页签条是两套外壳**共用**的一份渲染，故两套都要过同一组 aria/计数/roving 断言。
    for (const { label, shell } of MARKET_SHELLS) {
      const page = shell({ view: 'page' })
      // 容器：手写 tablist（官方 SegmentedTabs 在编译期 pin 的 primitives 0.1.5-rc.2 里不存在，不许 import）。
      const tablists = collectByRole(page, 'tablist')
      expect(tablists, label).toHaveLength(1)
      expect(tablists[0]?.['aria-label'], label).toBe(ENTERPRISE_MARKET_TABLIST_LABEL)
      const tabs = collectByRole(page, 'tab')
      // 页签文案 = 基础词 + 紧凑计数（企业技能/企业插件无目录时如实为 0，组件 = 清单长度 3）：
      // 原先两节内部的独立计数行已删，数字并入页签（详情页顶部少一行）。
      expect(tabs.map(tab => tab['children']), label).toEqual(['企业技能 0', '企业插件 0', '组件 3'])
      expect(tabs.map(tab => tab['children']), label).toEqual(ENTERPRISE_MARKET_TABS.map(tab => enterpriseMarketTabLabel(
        tab.label,
        tab.id === 'components' ? ENTERPRISE_MARKET_COMPONENTS.length : 0,
      )))
      // 默认选中 + roving tabIndex（只有当前页签可 Tab 到，其余靠方向键）。
      expect(tabs.map(tab => tab['aria-selected']), label).toEqual([true, false, false])
      expect(tabs.map(tab => tab['tabIndex']), label).toEqual([0, -1, -1])
    }
  })

  it('pairs every tab with its tabpanel and mounts only the selected panel content', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    // 三页签的 aria 四向配对与「只有当前页签挂载内容」是两套外壳共用的语义：逐个外壳 × 逐个页签跑。
    for (const { label: shellLabel, shell } of MARKET_SHELLS) {
    for (const tab of ENTERPRISE_MARKET_TABS) {
      const where = `${shellLabel} / ${tab.id}`
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        activeTab: tab.id,
        enterpriseSkills,
        enterprisePlugins: enterprisePlugins as never,
      })
      const ids = ENTERPRISE_MARKET_TAB_IDS[tab.id]
      const tabs = collectByRole(tree, 'tab')
      // 页签 id ↔ aria-controls ↔ 面板 id ↔ 面板 aria-labelledby 四处同源，且只有当前页签是选中态。
      expect(tabs.map(node => node['id']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.tab,
        ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
        ENTERPRISE_MARKET_TAB_IDS.components.tab,
      ])
      expect(tabs.map(node => node['aria-controls']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.panel,
        ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
        ENTERPRISE_MARKET_TAB_IDS.components.panel,
      ])
      expect(tabs.filter(node => node['aria-selected'] === true).map(node => node['id']), where).toEqual([ids.tab])
      const panels = collectByRole(tree, 'tabpanel')
      expect(panels.map(node => node['id']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.panel,
        ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
        ENTERPRISE_MARKET_TAB_IDS.components.panel,
      ])
      expect(panels.map(node => node['aria-labelledby']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.tab,
        ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
        ENTERPRISE_MARKET_TAB_IDS.components.tab,
      ])
      // 每个 aria-controls 都能解析到一个真实面板；非当前页签的面板 hidden，且**内容整段不挂载**。
      for (const node of tabs) expect(panels.some(panel => panel['id'] === node['aria-controls']), where).toBe(true)
      expect(panels.filter(panel => panel['hidden'] === true).map(panel => panel['id']), where)
        .toEqual(panels.filter(panel => panel['id'] !== ids.panel).map(panel => panel['id']))
      const text = textOf(tree)
      if (tab.id === 'skills') {
        expect(text, where).toContain('会议纪要技能组')
        expect(text, where).not.toContain('包含的组件')
        expect(text, where).not.toContain('ent-a')
      } else if (tab.id === 'plugins') {
        expect(text, where).toContain('ent-a')
        expect(text, where).not.toContain('会议纪要技能组')
        expect(text, where).not.toContain('包含的组件')
      } else {
        expect(text, where).toContain('包含的组件')
        expect(text, where).not.toContain('会议纪要技能组')
        expect(text, where).not.toContain('ent-a')
      }
    }
    }
  })

  it('switches the active tab from clicks and from the arrow/home/end keys', () => {
    // 页签键盘/点击契约在共用渲染里，两套外壳必须逐项一致。
    for (const { label, shell } of MARKET_SHELLS) {
      const onSelectTab = vi.fn()
      const tree = shell({ view: 'page', onSelectTab })
      const tabs = collectButtonProps(tree).filter(button => button['role'] === 'tab')
      expect(tabs, label).toHaveLength(3)
      // 点击：三个页签各自把 (tabId) 交回调用方。
      for (const [index, tab] of ENTERPRISE_MARKET_TABS.entries()) {
        tabs[index]?.['onClick']?.()
        expect(onSelectTab, label).toHaveBeenLastCalledWith(tab.id)
      }
      // 键盘：←/→ 循环、Home/End 跳首尾；都是「走焦 + 选中」一步到位，且拦住默认滚动。
      const press = (index: number, key: string): { preventDefault: () => void } => {
        const event = { key, preventDefault: vi.fn(), currentTarget: null }
        tabs[index]?.['onKeyDown']?.(event)
        return event
      }
      expect(press(0, 'ArrowRight').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('plugins')
      expect(press(0, 'ArrowLeft').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('components')
      expect(press(2, 'ArrowRight').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('skills')
      expect(press(2, 'Home').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('skills')
      expect(press(0, 'End').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('components')
      // 其余键不拦、不改选中（Tab / Enter / 空格交给浏览器与 onClick）。
      const ignored = press(0, 'Tab')
      expect(ignored.preventDefault, label).not.toHaveBeenCalled()
      const calls = onSelectTab.mock.calls.length
      press(0, 'Enter')
      expect(onSelectTab.mock.calls.length, label).toBe(calls)
    }
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
    // 组件清单已搬进「组件」页签：只有选中该页签时才在树上（页签承担显隐）。这一节两套外壳共用同一份内容。
    for (const { label, shell } of MARKET_SHELLS) {
      const page = shell({ view: 'page', activeTab: 'components' })
      expect(isValidElement(page), label).toBe(true)
      const text = textOf(page)
      expect(text, label).toContain('包含的组件')
      expect(text, label).toContain(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false))
      for (const row of ENTERPRISE_MARKET_COMPONENTS) expect(text, label).toContain(row.label)
      // 回归锁：正文不重复标题与摘要——标题 h3 由官方 ItemDetail 用 item.label 渲染（我们不再画），
      // 卡片摘要只在 summary 视图出现，desc 已按产品决策删除，「组件」页签里只有组件清单。
      expect(text, label).not.toContain('企业插件、技能与配方的统一入口')
      expect(text, label).not.toContain(ENTERPRISE_MARKET_SUMMARY)
      expect(text, label).not.toContain(ENTERPRISE_MARKET_ENTRY_LABEL)
      // 未选中「组件」时这份清单整段不挂载（默认页签是「企业技能」）。
      expect(textOf(shell({ view: 'page' })), label).not.toContain('包含的组件')
    }
  })

  // 回归锁：注入 store（有 onOpenLogin 回调）后，组件行开关必须可点；
  // 此前 client.tsx 未给 plugins.item 注 inject 导致三开关恒 disabled（点了没反应）的 bug 不许再犯。
  it('keeps the component-row switches clickable when a login action is wired (no dead control)', () => {
    for (const { label, shell } of MARKET_SHELLS) {
      const onOpenLogin = vi.fn()
      const page = shell({ view: 'page', activeTab: 'components', sessionUsable: false, onOpenLogin })
      expect(isValidElement(page), label).toBe(true)
      // 「组件」页签里只有三行组件开关（正文没有头部总开关：badge 槽只出只读的「版本号 + 包名」，
      // 见下面的 BadgeView 用例——那里断言标题行没有任何 Switch）。
      const switches = collectSwitchProps(page)
      expect(switches, label).toHaveLength(3)
      // 插件行与技能行开关未登录且有回调 → 必须可点（disabled false），配方恒禁用（预留）。
      // 注意：Switch 的无障碍名走 `label` prop（vi.fn() mock 不展开成 aria-label），切换动作走 `onChange`。
      const pluginsSwitch = switches.find(props => props.label === '启用组件 插件')
      expect(pluginsSwitch, label).toBeDefined()
      expect(pluginsSwitch?.checked, label).toBe(false)
      expect(pluginsSwitch?.disabled, label).toBe(false)
      const skillsSwitch = switches.find(props => props.label === '启用组件 技能')
      expect(skillsSwitch?.checked, label).toBe(false)
      expect(skillsSwitch?.disabled, label).toBe(false)
      const presetsSwitch = switches.find(props => props.label === '启用组件 配方')
      expect(presetsSwitch?.disabled, label).toBe(true)
      // page 不含头部总开关（badge 槽只有只读的版本号 + 包名，功能开关就是这三行）。
      expect(switches.find(props => props.label === '启用插件市场'), label).toBeUndefined()
    }
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
    // 顶部压缩与「计数并入页签」是两套外壳**共用**的那份 CSS/文案，故两套都要锁同一组取值。
    for (const { label, shell, titleClass } of MARKET_SHELLS) {
      const page = shell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
      const css = collectStyleText(page)
      // 顶部间距：两个取值都收紧到压缩后的定值（节内 gap 不动，仍是 12）。
      const tabsRule = cssRuleBody(css, '.own-market-storeTabs')
      expect(tabsRule, label).toContain('margin-top:0')
      expect(tabsRule, label).toContain('flex-wrap:nowrap')
      const sectionRule = cssRuleBody(css, '.own-market-section')
      expect(sectionRule, label).toContain('margin-top:12px')
      expect(sectionRule, label).not.toContain('margin-top:24px')
      expect(sectionRule, label).toContain('gap:12px')
      // 独立计数行退场：类规则整条删除（不留死样式），DOM 里也不再出现该容器。
      expect(cssRuleBody(css, '.own-market-sectionMeta'), label).toBe('')
      expect(collectByClassName(page, 'own-market-sectionMeta'), label).toEqual([])
      // 页签行高不变：单行 nowrap，13/20——计数并入文案后不换行、不撑高页签条。
      const tabRule = cssRuleBody(css, '.own-market-storeTab')
      expect(tabRule, label).toContain('white-space:nowrap')
      expect(tabRule, label).toContain('font-size:13px')
      expect(tabRule, label).toContain('line-height:20px')
      // 计数确实落在页签上（企业技能 1），且压缩没有动到节里的行内容。
      const tabs = collectByRole(page, 'tab')
      expect(tabs.map(tab => tab['children']), label).toEqual(['企业技能 1', '企业插件 0', '组件 3'])
      expect(collectSectionByHook(page, 'enterprise-skills'), label).not.toBeUndefined()
      // 行标题类名各自指认外壳：旧外观 `own-market-cardId`、新外观 `own-market-cardTitle`（两套外观不同源）。
      expect(collectByClassName(page, titleClass).map(props => props['children']), label).toEqual(['会议纪要技能组'])
    }
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
    for (const { label, shell } of MARKET_SHELLS) {
      // OFF：sessionUsable=false → 「插件」组件未开启 → 本页签里什么都没有（连节容器都不出）。
      const off = shell({ view: 'page', activeTab: 'plugins', sessionUsable: false, enterprisePlugins: enterprisePlugins as never })
      expect(textOf(off), label).not.toContain('ent-a')
      expect(collectSectionByHook(off, 'enterprise-plugins'), label).toBeUndefined()
      // 计数口径锁：页签数字取**真正要渲染的行数**（门控不过即 0），绝不出现「页签说 2 条、面板空白」。
      expect(collectByRole(off, 'tab').map(tab => tab['children']), label).toEqual(['企业技能 0', '企业插件 0', '组件 3'])
      // ON：sessionUsable=true → 「插件」组件开启 → 出插件行 + 逐个包名 + 计数。
      const on = shell({ view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: enterprisePlugins as never })
      const text = textOf(on)
      expect(text, label).toContain('ent-a')
      expect(text, label).toContain('ent-b')
      expect(text, label).toContain('企业发布 · v1.2.0')
      // 计数已并入页签文案（原先节内那行独立的 `2 个` 已删）：这里锁「企业插件 2」。
      expect(text, label).toContain(enterpriseMarketTabLabel('企业插件', 2))
      // 节内独立计数行确实不存在（新外壳的 HERO 会另有「2 个企业插件」这句 chip 文案，故不能再用 `2 个` 当代理断言）。
      expect(collectByClassName(on, 'own-market-sectionMeta'), label).toEqual([])
      expect(collectSectionByHook(on, 'enterprise-plugins'), label).not.toBeUndefined()
      // 回归锁：企业插件卡片只两行文案（包名 + 一句话说明），照官方已安装卡片 CardHead——
      // 不含详情页 RowsSection 的 mono 模块名行（那是 rowMain 结构，官方卡片没有）；
      // 也不越界渲染别页签的内容（组件清单只在「组件」页签）。
      expect(text, label).not.toContain('enterprise plugins · catalog')
      expect(text, label).not.toContain('已装 · v')
      expect(text, label).not.toContain('包含的组件')
    }
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

  // 默认页签（「企业技能」）在「技能」组件 ON 且目录非空时渲染技能行、OFF 时不渲染；
  // 两套外壳的**语义**（门控 / 计数并入页签 / 标题+描述两行 / 官方 Switch 是主控件 / 数据钩子）必须一致，
  // 只有行版式的类名与取值各自不同（旧 `.own-market-cardId`+`.own-market-cardDesc`、新卡片网格那套）。
  it('renders the skill tab with the official Switch as the row primary control in both shells', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    for (const { label, shell, titleClass, descClass } of MARKET_SHELLS) {
      // OFF：sessionUsable=false → 「技能」组件未开启 → 默认页签里什么内容都没有（节容器都不出）。
      const off = shell({ view: 'page', sessionUsable: false, enterpriseSkills })
      expect(collectSectionByHook(off, 'enterprise-skills'), label).toBeUndefined()
      expect(textOf(off), label).not.toContain('会议纪要技能组')
      // ON：两行文案 + 计数（原先那行独立的 `1 个` 已删，计数并入页签文案 `企业技能 1`）。
      const on = shell({ view: 'page', sessionUsable: true, enterpriseSkills })
      const text = textOf(on)
      expect(text, label).toContain(enterpriseMarketTabLabel('企业技能', 1))
      // 节内独立计数行确实不存在（新外壳的 HERO 另有「共 1 个企业技能」这句 chip 文案，
      // 故「正文不含 `N 个`」不再是这条语义的代理断言——改锁那个容器本身）。
      expect(collectByClassName(on, 'own-market-sectionMeta'), label).toEqual([])
      // 两行结构：第 1 行标题、第 2 行描述各自成行（类名各自指认外壳，证明两套外观不同源）。
      expect(collectByClassName(on, titleClass).map(props => props['children']), label).toEqual(['会议纪要技能组'])
      expect(collectByClassName(on, descClass).map(props => props.children), label)
        .toEqual(['把会议录音与转写整理成结构化纪要。'])
      // 标题行容器那两枚签在同一个 head 里（两套外壳共用 `.own-market-cardHead`）。
      expect(collectByClassName(on, 'own-market-cardHead'), label).toHaveLength(1)
      // 旧元信息行退场：不再堆「DSH 版本 · 大小 · N 个技能」。
      expect(text, label).not.toContain('DSH 0.1.7-rc.2')
      // **未装行不出任何辅助标签**（那枚按钮只在「有更新」时出现，见下面的独立用例）。
      expect(collectByClassName(on, 'own-market-skillTag'), label).toEqual([])
      expect(collectDataValues(on, 'data-enterprise-skill-tag'), label).toEqual([])
      const switches = collectSwitchProps(on)
      expect(switches, label).toHaveLength(1)
      const skillSwitch = switches.find(props => String(props['label']).includes('会议纪要技能组'))
      expect(skillSwitch, label).toBeDefined()
      // 未注入动作即禁用（不提供假入口），但语义照旧是「安装」方向。
      expect(skillSwitch?.['checked'], label).toBe(false)
      expect(skillSwitch?.['disabled'], label).toBe(true)
      expect(skillSwitch?.['label'], label).toBe('安装企业技能 会议纪要技能组')
      // 数据钩子命名与企业插件节同风格（`enterprise-skills`）；别页签的节不在树上。
      expect(collectSectionByHook(on, 'enterprise-skills'), label).not.toBeUndefined()
      expect(collectSectionByHook(on, 'enterprise-plugins'), label).toBeUndefined()
      // 受管态仍如实落在行上（`AVAILABLE` = 未装可装，那枚开关据此关闭）。
      expect(collectDataValues(on, 'data-enterprise-skill-state'), label).toEqual(['AVAILABLE'])
      // 注入动作后开关可拨：拨一次即把 (row, next=true) 交给调用方（= 一键安装）。
      const onToggleSkill = vi.fn()
      const wired = shell({ view: 'page', sessionUsable: true, enterpriseSkills, onToggleSkill })
      const wiredSwitch = collectSwitchProps(wired).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(wiredSwitch['disabled'], label).toBe(false)
      expect(wiredSwitch['title'], label).toBe('点此安装到 ~/.dsh/skills')
      wiredSwitch['onChange']?.(true)
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: '1902500000000000001' }), true)
    }
    // **新外壳**独有的版式取值：描述照官方 .cardDescription 12/18 + 两行 clamp + 始终可见
    //（不是 jingyun 的 13/18 单行、也不是「仅展开显示」）；标题照官方 .cardTitle 14/500/ellipsis；
    // 行尾占 cardTrailing 版式（组件行那套 `.own-market-rowState` 不再用于目录行）。
    const store = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills })
    const css = collectStyleText(store)
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('font-size:12px')
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('line-height:18px')
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('-webkit-line-clamp:2')
    expect(cssRuleBody(css, '.own-market-cardDescription')).toContain('overflow:hidden')
    expect(cssRuleBody(css, '.own-market-cardDescription')).not.toContain('-webkit-line-clamp:1')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('font-size:14px')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('font-weight:500')
    expect(cssRuleBody(css, '.own-market-cardTitle')).toContain('text-overflow:ellipsis')
    expect(collectByClassName(store, 'own-market-cardTrailing')).toHaveLength(1)
    expect(collectByClassName(store, 'own-market-rowState')).toEqual([])
    // 旧外壳那套取值仍在（9723a97 的 cardId 14/20-500-省略、cardDesc 13/18 单行 clamp）。
    const legacy = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills })
    const legacyCss = collectStyleText(legacy)
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('font-size:14px')
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('text-overflow:ellipsis')
    expect(cssRuleBody(legacyCss, '.own-market-cardDesc')).toContain('font-size:13px')
    expect(cssRuleBody(legacyCss, '.own-market-cardDesc')).toContain('-webkit-line-clamp:1')
    // 旧外壳**没有**新外壳的卡片网格与展开区类名（两套外观互不串味）。
    expect(collectByClassName(legacy, 'own-market-cardShell')).toEqual([])
    expect(collectByClassName(legacy, 'own-market-cardGrid')).toEqual([])
    expect(collectByClassName(legacy, 'own-market-cardDetails')).toEqual([])
    expect(cssRuleBody(legacyCss, '.own-market-cardShell')).toBe('')
    expect(cssRuleBody(legacyCss, '.own-market-cardGrid')).toBe('')
  })

  // 标题行（第 1 行）新增两枚只读标签：**版本签**取列表投影本来就有的 `sourceDshVersion`（无需服务端改动）、
  // **分类签**取服务端新增的可选字段 `category`。为缺失设计：分类缺席/null/空串时整枚签不渲染（安静缺席）。
  it('adds a version tag and an optional category tag to the skill title row', () => {
    // 两枚签的取值、tone、顺序与「分类缺席即整枚不渲染」在两套外壳里必须一模一样（同一份 facts + 同一份 head 容器）。
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
      })
      // 版本签：文案等于 `sourceDshVersion` 原值（不加 `v` 前缀——那是详情页 badge 的口径），
      // 复用官方 `Tag` 原语 + 本文件既有 `.own-market-tag` 定位（不新造视觉体系）。
      const versionTags = collectByClassName(tree, 'own-market-skillVersionTag')
      expect(versionTags, label).toHaveLength(1)
      expect(versionTags[0]?.['children'], label).toBe('0.1.7-rc.2')
      expect(versionTags[0]?.['tone'], label).toBe('neutral')
      expect(String(versionTags[0]?.['className']), label).toContain('own-market-tag')
      // 分类签：有分类才出，文案照原值。
      const categoryTags = collectByClassName(tree, 'own-market-skillCategoryTag')
      expect(categoryTags, label).toHaveLength(1)
      expect(categoryTags[0]?.['children'], label).toBe('研发工具')
      expect(categoryTags[0]?.['tone'], label).toBe('info')
      // 顺序锁：两枚签都在**标题那一行**的 head 容器里，且严格排在标题**之后**（标题 → 版本签 → 分类签）。
      const head = collectByClassName(tree, 'own-market-cardHead')[0]
      const headKids = head?.['children'] as ReactNode[]
      expect(headKids, label).toHaveLength(3)
      expect(isValidElement(headKids[0]) ? (headKids[0].props as Record<string, unknown>)['children'] : undefined, label).toBe('会议纪要技能组')
      expect(isValidElement(headKids[1]) ? (headKids[1].props as Record<string, unknown>)['children'] : undefined, label).toBe('0.1.7-rc.2')
      expect(isValidElement(headKids[2]) ? (headKids[2].props as Record<string, unknown>)['children'] : undefined, label).toBe('研发工具')
      // 恒只有那枚官方 Switch；未装行不出辅助标签。
      expect(collectSwitchProps(tree).map(props => String(props['label'])), label).toEqual(['安装企业技能 会议纪要技能组'])
      expect(collectTagProps(tree), label).toEqual([])
      // 分类缺席（undefined）/ 空串：**分类签不出现**（安静缺席是预期行为，绝不塞占位文案）；
      // 版本签与其余内容照旧在（少一枚分类签不动别的）。
      for (const skills of [
        enterpriseMarketSkillRows([SKILL]),
        enterpriseMarketSkillRows([{ ...SKILL, category: '' }]),
      ]) {
        const bare = shell({ view: 'page', sessionUsable: true, enterpriseSkills: skills })
        expect(collectByClassName(bare, 'own-market-skillCategoryTag'), label).toEqual([])
        expect(collectByClassName(bare, 'own-market-skillVersionTag'), label).toHaveLength(1)
        // 分类签那一格是 `null`（不渲染），故 head 里**元素**只剩标题 + 版本签两枚。
        const bareKids = (collectByClassName(bare, 'own-market-cardHead')[0]?.['children'] as ReactNode[])
          .filter(child => child !== null && child !== undefined)
        expect(bareKids, label).toHaveLength(2)
        expect(isValidElement(bareKids[0]) ? (bareKids[0].props as Record<string, unknown>)['children'] : undefined, label).toBe('会议纪要技能组')
        expect(isValidElement(bareKids[1]) ? (bareKids[1].props as Record<string, unknown>)['children'] : undefined, label).toBe('0.1.7-rc.2')
      }
    }
    // 第 2 行描述不受标签影响（新外壳那套官方描述行；旧外壳的 cardDesc 上面已锁）。
    const store = EnterpriseMarketStoreShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    expect(collectByClassName(store, 'own-market-cardDescription').map(props => props.children))
      .toEqual(['把会议录音与转写整理成结构化纪要。'])
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
  // 故加签不改变**标题那一行**的高度。去折叠后卡片内是四段（标题行 / 描述行 / 常显动作条 / 失败提示槽），
  // 但标题行自身仍是「标题 + 两枚签」的 20px 单行。
  it('keeps the skill title row single-line so the tags never grow the row', () => {
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
      })
      const css = collectStyleText(tree)
      const head = cssRuleBody(css, '.own-market-cardHead')
      expect(head, label).toContain('display:flex')
      expect(head, label).toContain('flex-wrap:nowrap')
      expect(head, label).toContain('align-items:center')
      expect(head, label).toContain('line-height:20px')
      expect(head, label).toContain('overflow:hidden')
      // 标题先让步（可收缩 + 继承卡片标题的 nowrap/ellipsis），两枚签 `flex:none` 保持可见。
      expect(cssRuleBody(css, '.own-market-skillTitle'), label).toContain('flex:0 1 auto')
      expect(cssRuleBody(css, '.own-market-skillTitle'), label).toContain('min-width:0')
      expect(cssRuleBody(css, '.own-market-tag'), label).toContain('flex:none')
    }
    // 第 1 行的省略口径：两套外壳各自的标题类都是 14/20-500 + nowrap + ellipsis（取值同源、类名不同）。
    const store = EnterpriseMarketStoreShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    const storeCss = collectStyleText(store)
    expect(cssRuleBody(storeCss, '.own-market-cardTitle')).toContain('white-space:nowrap')
    expect(cssRuleBody(storeCss, '.own-market-cardTitle')).toContain('text-overflow:ellipsis')
    const legacy = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    const legacyCss = collectStyleText(legacy)
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('white-space:nowrap')
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('text-overflow:ellipsis')
    // 结构锁（新外壳）：cardContent = 标题行 + 描述行 + **常显动作条** + 失败提示槽（恰好 4 个子节点）；
    // 标签变多只影响标题行内部，不会多出第五段。
    const content = collectByClassName(store, 'own-market-cardContent')[0]
    const contentKids = content?.['children'] as ReactNode[]
    expect(contentKids).toHaveLength(4)
    expect(String((contentKids[0] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardMainRow')
    expect(String((contentKids[1] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardDescription')
    expect(String((contentKids[2] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardActions')
    expect((contentKids[3] as { type?: unknown }).type).toBe(EnterpriseMarketRowError)
    // 结构锁（旧外壳）：rowMain 里也恰好两行（标题行 head + 描述行 cardDesc）。
    const legacyMain = collectByClassName(legacy, 'own-market-rowMain')[0]
    const legacyKids = legacyMain?.['children'] as ReactNode[]
    expect(legacyKids).toHaveLength(2)
    expect(String((legacyKids[0] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardHead')
    expect(String((legacyKids[1] as { props?: Record<string, unknown> }).props?.['className'])).toContain('own-market-cardDesc')
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
  // 两套外壳的**落点**不同（旧 = 行内 `[标签][Switch]`，新 = 卡片内**常显**动作条），但事实与行为必须逐项一致。
  it('renders the auxiliary update label left of the switch only when an update exists', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    for (const { label, shell, layout } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      // 未装行：不出现。
      const notInstalled = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], onToggleSkill })
      expect(collectTagProps(notInstalled), label).toEqual([])
      // 已装且与中心同版本：不出现。
      const current = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        installedSkills: [installedSkill(SKILL_DETAIL.versionId)], onToggleSkill,
      })
      expect(collectTagProps(current), label).toEqual([])
      // 已装旧版本：出现，文案/无障碍名/悬浮说明按投影给。
      const tree = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated], onToggleSkill })
      const tags = collectTagProps(tree)
      expect(tags, label).toHaveLength(1)
      expect(tags[0], label).toMatchObject({
        type: 'button',
        'data-enterprise-skill-tag': 'UPDATE_AVAILABLE',
        'aria-label': '更新企业技能 会议纪要技能组',
        title: '点此更新到中心当前版本',
        disabled: false,
        children: ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
      })
      // 点击 = 安装中心当前版本（`next=true`），不是卸载、也不是 no-op。
      tags[0]?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: updatable.id }), true)
      // 顺序锁：标签严格排在 Switch **左侧**（开关仍是该行主控件，不许反过来）——各自取各自的动作容器。
      const kids = layout === 'inline' ? legacyRowLineChildren(tree, updatable.id) : cardActionChildren(tree, updatable.id)
      const order = actionOrder(kids)
      expect(order.tag, label).toBeGreaterThanOrEqual(0)
      expect(order.switch, label).toBeGreaterThan(order.tag)
      // 有更新时行上的受管态钩子如实报 `UPDATE_AVAILABLE`；那枚开关仍开着（盘上装着旧版本）、可拨（拨下去 = 卸载）。
      expect(collectDataValues(tree, 'data-enterprise-skill-state'), label).toEqual(['UPDATE_AVAILABLE'])
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(true)
      expect(skillSwitch['label'], label).toBe('卸载企业技能 会议纪要技能组')
      expect(skillSwitch['disabled'], label).toBe(false)
    }
    expect(ENTERPRISE_MARKET_SKILL_UPDATE_TAG).toBe('UPDATE_AVAILABLE')
    // 纯投影与常量同源（改文案只改一处）。
    expect(enterpriseMarketSkillUpdateTag('会议纪要技能组')).toEqual({
      label: '有更新',
      ariaLabel: '更新企业技能 会议纪要技能组',
      title: '点此更新到中心当前版本',
    })
    expect(ENTERPRISE_MARKET_SKILL_UPDATE_LABEL).toBe('有更新')
  })

  // 在途语义：有更新的行在途时辅助标签**保留但禁用**（用户看得见「正在更新」）；未装行的在途一律不出现。
  it('keeps the update label visible but disabled while the row is busy', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    for (const { label, shell } of MARKET_SHELLS) {
      const busyUpdate = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
        pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
      })
      const tags = collectTagProps(busyUpdate)
      expect(tags, label).toHaveLength(1)
      expect(tags[0]?.['disabled'], label).toBe(true)
      // 未装行在途（正在做首次安装）：右侧就一个 Switch，不出现辅助标签。
      const busyFresh = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
      })
      expect(collectTagProps(busyFresh), label).toEqual([])
      // 没有动作回调（未登录/无 store）时标签禁用，但语义仍是「更新」。
      const unwired = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
      })
      expect(collectTagProps(unwired)[0], label).toMatchObject({ disabled: true, title: '企业账号未登录，暂不可操作' })
    }
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
    for (const { label: shellLabel, shell } of MARKET_SHELLS) {
      for (const item of cases) {
        const where = `${shellLabel} / ${item.name}`
        const tree = shell({
          view: 'page',
          sessionUsable: true,
          enterpriseSkills: [row],
          ...(item.installedSkills === undefined ? {} : { installedSkills: item.installedSkills }),
          ...(item.pendingSkill === undefined ? {} : { pendingSkill: item.pendingSkill }),
          onToggleSkill,
        })
        const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
        expect(skillSwitch['label'], where).toBe(item.label)
        expect(skillSwitch['checked'], where).toBe(item.checked)
        // 在途禁用（并发动作会互相覆盖已装清单），其余一律可拨。
        expect(skillSwitch['disabled'], where).toBe(item.disabled)
        // 行上的受管态钩子仍如实报态（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）。
        expect(collectDataValues(tree, 'data-enterprise-skill-state'), where).toEqual([item.state])
      }
      // 第五态「有更新」：行上带中心当前版本、本机装着旧版本 → 开关照旧开着且可拨（拨下去 = 卸载）。
      const updatable = updatableRow()
      const outdatedTree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        installedSkills: [installedSkill('1902500000000000100')], onToggleSkill,
      })
      expect(collectDataValues(outdatedTree, 'data-enterprise-skill-state'), shellLabel).toEqual(['UPDATE_AVAILABLE'])
      const outdatedSwitch = collectSwitchProps(outdatedTree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(outdatedSwitch['checked'], shellLabel).toBe(true)
      expect(outdatedSwitch['disabled'], shellLabel).toBe(false)
      expect(outdatedSwitch['label'], shellLabel).toBe('卸载企业技能 会议纪要技能组')
    }
  })

  // 一键安装/卸载：开关在两个方向上都把 (row, next) 交给 onToggleSkill —— 未装拨上 = true，已装拨下 = false。
  it('toggles the skill action from the switch in both directions', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      const installable = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [row], onToggleSkill })
      const installSwitch = collectSwitchProps(installable).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(installSwitch['checked'], label).toBe(false)
      expect(installSwitch['label'], label).toBe('安装企业技能 会议纪要技能组')
      installSwitch['onChange']?.(true)
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)

      // 已装：开关是打开的，拨下去即卸载（`next=false`）。
      const installed = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [row], installedSkills: [installedSkill('v2')], onToggleSkill,
      })
      const installedSwitch = collectSwitchProps(installed).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(installedSwitch['checked'], label).toBe(true)
      expect(installedSwitch['label'], label).toBe('卸载企业技能 会议纪要技能组')
      expect(installedSwitch['title'], label).toBe('点此卸载')
      installedSwitch['onChange']?.(false)
      expect(onToggleSkill, label).toHaveBeenLastCalledWith(expect.objectContaining({ id: row.id }), false)
    }
  })

  // 缺陷回归锁：企业技能行的动作失败时市场侧原先**没有任何可见反馈**（用户报「点了没反应」）。
  // 现在失败必须落在出错的那一行：role="alert" + 稳定错误码，且开关仍可拨（再拨一次就是重试）。
  it('shows the enterprise skill-row failure with its stable code and keeps the switch retryable', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      const failed = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills: [row],
        onToggleSkill,
        skillActionError: { id: row.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      })
      const alerts = collectAlerts(failed)
      expect(alerts, label).toHaveLength(1)
      expect(textOf(alerts[0]), label).toContain('安装失败')
      expect(textOf(alerts[0]), label).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
      // 复用市场侧既有类名体系（形制照技能 tab 的行内提示），不新造视觉——两套外壳同一份 `EnterpriseMarketRowError`。
      expect(isValidElement(alerts[0]) ? alerts[0].props.className : undefined, label).toBe('own-market-inlineError')
      // 失败没留下乐观已装：开关仍是「未装」态且可拨，拨上去就是重试。
      const skillSwitch = collectSwitchProps(failed).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(false)
      expect(skillSwitch['disabled'], label).toBe(false)
      skillSwitch['onChange']?.(true)
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)
    }
  })

  // 失败文案随「意图动作」走，且提示只落失败行：另一行不受影响、两个开关都照旧可拨。
  it('labels the failure by the attempted action and renders it only on the failing row', () => {
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'install', code: 'ENT_X' })).toBe('安装失败')
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'uninstall', code: 'ENT_X' })).toBe('卸载失败')
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组' },
    ])
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills: rows,
        installedSkills: [installedSkill('v1', rows[1]!.id)],
        onToggleSkill: vi.fn(),
        skillActionError: { id: rows[1]!.id, action: 'uninstall', code: 'ENT_SKILL_STATE_INVALID' },
      })
      const alerts = collectAlerts(tree)
      expect(alerts, label).toHaveLength(1)
      expect(textOf(alerts[0]), label).toContain('卸载失败')
      expect(textOf(alerts[0]), label).toContain('ENT_SKILL_STATE_INVALID')
      expect(textOf(alerts[0]), label).not.toContain('代码评审技能组')
      // 两行开关都在（一关一开）、都没被提示禁用（失败行可重试，正常行不受牵连）。
      const switches = collectSwitchProps(tree).filter(props => String(props['label']).includes('企业技能'))
      expect(switches, label).toHaveLength(2)
      expect(switches[0]?.['checked'], label).toBe(false)
      expect(switches[1]?.['checked'], label).toBe(true)
      expect(switches[0]?.['disabled'], label).toBe(false)
      expect(switches[1]?.['disabled'], label).toBe(false)
    }
  })

  // 回归锁（本轮改动的边界）：技能行右侧 = 官方 Switch（**始终在**）＋仅在有更新时出现的辅助标签，
  // 企业插件行的开关口径**完全未动**（同样一枚 Switch）。两行各在自己的页签里，故分两次渲染锁同一批语义。
  it('gives the skill row a Switch again and leaves the plugin row switch untouched', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const { label, shell } of MARKET_SHELLS) {
      const onTogglePlugin = vi.fn()
      // 「企业插件」页签：插件行照旧「状态点 + 文案 + Switch」，checked/title/onChange 口径一字未改。
      const pluginsTab = shell({
        view: 'page',
        activeTab: 'plugins',
        sessionUsable: true,
        enterprisePlugins: enterprisePlugins as never,
        onTogglePlugin,
      })
      const pluginSwitch = collectSwitchProps(pluginsTab).find(props => props['label'] === '安装企业插件 ent-a')!
      expect(collectSwitchProps(pluginsTab).map(props => String(props['label'])), label).toEqual(['安装企业插件 ent-a'])
      expect(pluginSwitch['checked'], label).toBe(true)
      expect(pluginSwitch['title'], label).toBe('点此卸载')
      expect(pluginSwitch['disabled'], label).toBe(false)
      pluginSwitch['onChange']?.(false)
      expect(onTogglePlugin, label).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
      // 「企业技能」页签：已装同版本行（行上没有中心版本 → 不判更新）右侧只有那枚开关：
      // 不出辅助标签、也没有 `data-enterprise-skill-tag` 钩子；技能行未占 rowState 版式（那是组件行的状态点位）。
      const skillsTab = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        installedSkills: [installedSkill('v2')],
        onToggleSkill: vi.fn(),
      })
      expect(collectSwitchProps(skillsTab).map(props => String(props['label'])), label).toEqual(['卸载企业技能 会议纪要技能组'])
      expect(collectByClassName(skillsTab, 'own-market-skillTag'), label).toEqual([])
      expect(collectDataValues(skillsTab, 'data-enterprise-skill-tag'), label).toEqual([])
      expect(collectDataValues(skillsTab, 'data-enterprise-skill-state'), label).toEqual(['INSTALLED'])
      // 技能行不使用组件行那套 `.own-market-rowState`（旧外壳只在插件行用它）。
      expect(collectByClassName(skillsTab, 'own-market-rowState'), label).toEqual([])
    }
  })

  // 企业插件行原先也只有「目录不可装」的禁用 + title 提示，动作失败同样一个字都不说（失败码只留在 store 里，
  // 由「企业设置 → 插件」那个视图出头号提示）。这里一并补齐同范式的行内提示。
  it('shows the enterprise plugin-row failure with its code and leaves the other rows clean', () => {
    const enterprisePlugins = [
      { packageName: 'ent-a', version: '1.2.0', state: 'EXPECTED', inCatalog: true },
      { packageName: 'ent-b', version: '2.0.0', state: 'ACTIVE', inCatalog: true },
    ] as const
    for (const { label, shell } of MARKET_SHELLS) {
      const onTogglePlugin = vi.fn()
      const tree = shell({
        view: 'page',
        activeTab: 'plugins',
        sessionUsable: true,
        enterprisePlugins: enterprisePlugins as never,
        onTogglePlugin,
        pluginActionError: { id: 'ent-a', action: 'install', code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
      })
      const alerts = collectAlerts(tree)
      expect(alerts, label).toHaveLength(1)
      expect(textOf(alerts[0]), label).toContain('安装失败')
      expect(textOf(alerts[0]), label).toContain('ENT_PLUGIN_SIGNATURE_INVALID')
      // 失败行开关仍可拨（原地重试），另一行没有凭空多出失败提示。
      const failedSwitch = collectSwitchProps(tree).find(props => props['label'] === '安装企业插件 ent-a')
      expect(failedSwitch?.['disabled'], label).toBe(false)
      failedSwitch?.['onChange']?.(true)
      expect(onTogglePlugin, label).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), true)
      expect(textOf(tree), label).toContain('ent-b')
    }
  })

  // 成功路径（没有失败事实直传）不得出现任何提示：提示只在失败时出现，成功时一个字都不多说。
  // 两个行页签 × 两套外壳各渲染一次，四处都必须干净。
  it('renders no inline alert when no action failed (success path stays clean)', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const { label, shell } of MARKET_SHELLS) {
      for (const tab of ['skills', 'plugins'] as const) {
        const tree = shell({
          view: 'page',
          activeTab: tab,
          sessionUsable: true,
          enterprisePlugins: enterprisePlugins as never,
          enterpriseSkills,
          installedSkills: [installedSkill('v1')],
          onTogglePlugin: vi.fn(),
          onToggleSkill: vi.fn(),
        })
        const where = `${label} / ${tab}`
        expect(collectAlerts(tree), where).toEqual([])
        expect(textOf(tree), where).not.toContain('安装失败')
        expect(textOf(tree), where).not.toContain('卸载失败')
      }
      // 成功路径上开关只是如实反映 Host 真值（已装 → 打开）。
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        installedSkills: [installedSkill('v1')],
        onToggleSkill: vi.fn(),
      })
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(true)
    }
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

    // 折叠态：组件清单整段不进 DOM，但节头按钮 + 标题 + 计数仍在（可再点开）。这一节两套外壳共用同一份渲染。
    for (const { label, shell } of MARKET_SHELLS) {
      const collapsed = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: { components: false },
        onToggleSection: vi.fn(),
      })
      const compBtn = collectButtonProps(collapsed).find(b => b['aria-controls'] === 'market-section-components')
      expect(compBtn, label).toBeDefined()
      expect(compBtn?.['aria-expanded'], label).toBe(false)
      // 折叠时列表整段不进 DOM（条件渲染，照官方 groupBody）——`.own-market-rows{display:flex}` 会覆盖
      // UA 的 `[hidden]{display:none}`，故不用 hidden 属性，直接不渲染 <ul>。节头/标题/计数仍在文本里。
      expect(collectElementById(collapsed, 'market-section-components'), label).toBeUndefined()
      expect(textOf(collapsed), label).toContain('包含的组件')

      // 展开态：aria-expanded=true、列表在 DOM。
      const expanded = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: { components: true },
        onToggleSection: vi.fn(),
      })
      expect(collectButtonProps(expanded).find(b => b['aria-controls'] === 'market-section-components')?.['aria-expanded'], label).toBe(true)
      expect(collectElementById(expanded, 'market-section-components'), label).not.toBeUndefined()
      // 点节头触发 onToggleSection。
      const spy = vi.fn()
      const clickable = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: { components: false },
        onToggleSection: spy,
      })
      collectButtonProps(clickable).find(b => b['aria-controls'] === 'market-section-components')?.onClick?.()
      expect(spy, label).toHaveBeenCalledWith('components')
    }
  })

  // 页签化后的默认态：`ENTERPRISE_MARKET_DEFAULT_EXPANDED` 只剩一个字段（组件节默认展开）；
  // 「一进页面就看得见后台分配（预置）的全部技能」这条用户口径改由**默认页签 = 企业技能**承担。
  it('defaults to the 企业技能 tab and keeps the components section expanded by default', () => {
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(ENTERPRISE_MARKET_DEFAULT_EXPANDED).toEqual({ components: true })
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    for (const { label, shell } of MARKET_SHELLS) {
      // 不传 activeTab（真运行时初值 = 默认页签）：技能列表直接在树上，未装的也照列。
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
        onToggleSection: vi.fn(),
      })
      expect(textOf(tree), label).toContain('会议纪要技能组')
      expect(collectElementById(tree, 'market-section-components'), label).toBeUndefined()
      // 默认态下技能行那枚开关就在树上（未装 → 关闭）。
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(false)
      expect(skillSwitch['disabled'], label).toBe(true)
      // 「组件」页签默认展开：切到它就直接看见组件清单（折叠按钮仍是展开态）。
      const componentsTab = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
        onToggleSection: vi.fn(),
      })
      expect(collectElementById(componentsTab, 'market-section-components'), label).not.toBeUndefined()
    }
  })

  // ══ 本刀（去折叠）的门禁 —— **只锁新外壳**（旧外壳走 9723a97 的官方两行卡片，见上面的 MARKET_SHELLS 循环）══
  // 新外壳行版式源自参考对象 `jingyunstudio/jingyun-dsh` 的 `MarketplaceSection.tsx`（卡片 + 列表上方搜索框），
  // **但排版取值一律照官方** `@deepseek-ai/dsh-client-ui-settings-plugin-inventory` 的 `qSYn7G_*`。
  // 用户裁决 A 去掉了卡片折叠：动作常显，故 `[data-open]` 展开态、chevron、展开区、skillId 行与焦点环一并退场。
  it('locks the official plugin-inventory card values on every directory row (store shell only)', () => {
    const page = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
    const css = collectStyleText(page)
    // 卡片本体 = 官方 .card：.5px settings-card-stroke + radius-xl + settings-card-fill（不是 1px/10px/bg-layer-3）。
    const card = cssRuleBody(css, '.own-market-cardShell')
    expect(card).toContain('border:.5px solid var(--dsw-alias-settings-card-stroke')
    expect(card).toContain('border-radius:var(--dsw-radius-xl')
    expect(card).toContain('background:var(--dsw-alias-settings-card-fill')
    expect(card).not.toContain('border:1px')
    expect(card).not.toContain('border-radius:10px')
    expect(card).not.toContain('bg-layer-3')
    // 卡片**不折叠**：`[data-open]` 那套展开态描边（官方 .card[data-open=true]{border-color:border-l3}）整条退场。
    expect(css).not.toContain("[data-open='true']")
    expect(cssRuleBody(css, ".own-market-cardShell[data-open='true']")).toBe('')
    // 卡片内容块 = 官方 .cardContent 的静态几何：列向 gap 2 + 12/14 内衬 + 52px 最小高（去折叠后不再是 button）。
    const content = cssRuleBody(css, '.own-market-cardContent')
    expect(content).toContain('flex-direction:column')
    expect(content).toContain('min-height:52px')
    expect(content).toContain('padding:12px 14px')
    expect(content).toContain('gap:2px')
    // 去折叠后内容块不再是可点元素：没有 cursor:pointer、没有 hover 底、也没有内缩焦点环。
    expect(content).not.toContain('cursor:pointer')
    expect(cssRuleBody(css, '.own-market-cardContent:focus-visible')).toBe('')
    expect(css).not.toContain('.own-market-cardContent:hover')
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
    // 动作条 = 卡片内**常显**（去折叠后唯一的动作落点）：靠右 + 8px 间距 + **可换行**（窄屏不挤爆）+ 顶部 6px。
    const actions = cssRuleBody(css, '.own-market-cardActions')
    expect(actions).toContain('display:flex')
    expect(actions).toContain('flex-wrap:wrap')
    expect(actions).toContain('justify-content:flex-end')
    expect(actions).toContain('gap:8px')
    expect(actions).toContain('margin-top:6px')
    // 列表 = 官方 .cards 两列 + gap 10，窄容器转单列（官方容器查询 + 同断点 media 兜底旧 WebView）。
    const cards = cssRuleBody(css, '.own-market-cardGrid')
    expect(cards).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
    expect(cards).toContain('gap:10px')
    expect(css).toContain('@container own-market-catalog')
    expect(css).toContain('@media (max-width:520px)')
    // DOM 结构锁：card / cardContent / cardMainRow / cardTrailing / cardDescription / cardActions 各恰好一件
    // （去折叠后的卡片骨架：标题行 + 描述行 + 常显动作条 + 失败提示槽）。
    for (const name of ['own-market-cardShell', 'own-market-cardContent', 'own-market-cardMainRow', 'own-market-cardTrailing', 'own-market-cardDescription', 'own-market-cardActions']) {
      expect(collectByClassName(page, name), name).toHaveLength(1)
    }
    // 行尾事实：官方 StateDot（10px 图钉尺寸，不缩放）+ 一枚官方 Tag 标签（chevron 已随折叠退场）。
    expect(collectStateDotProps(page)).toHaveLength(1)
    expect(collectByClassName(page, 'own-market-phaseDot')).toHaveLength(1)
    expect(collectByClassName(page, 'own-market-configTag')).toHaveLength(1)
    expect(collectByClassName(page, 'own-market-cardChevron')).toEqual([])
    // 行还是「目录类」的两列卡片：两侧页签都用 .own-market-cardGrid（组件页签仍走它自己的 rows 版式，见另用例）。
    expect(collectByClassName(page, 'own-market-rows')).toEqual([])
  })

  // 卡片**不折叠**（用户裁决 A）：新外壳目录卡片上直接就是标题/签/状态点/描述与两个动作（[有更新] + Switch），
  // 没有任何展开/收起机制——chevron、`aria-expanded`/`aria-controls`、展开区、`skillId` 行都不在树上。
  // 行键 / 展开区 id / 开合三个纯投影**仍留在共享层**（控制器那份状态按「不夹带清理」保留），这里继续锁它们的取值；
  // 同时锁死「新外壳不再消费它们」：`expandedRow` 传 null 还是某个行键，卡片产出逐项相同。
  it('renders every store-shell card without any disclosure: actions are always visible on the card', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组' },
    ])
    const key = enterpriseMarketRowKey('skills', SKILL.id)
    // 共享层纯投影仍在（行键 / 展开区 id / 开合口径一字未改）——现在只是「保留事实」，没有外壳消费它。
    expect(key).toBe(`skills:${SKILL.id}`)
    expect(enterpriseMarketRowKey('plugins', 'ent-a')).toBe('plugins:ent-a')
    expect(enterpriseMarketRowDetailsId('skills', SKILL.id)).toBe(`market-details-skills-${SKILL.id}`)
    expect(enterpriseMarketRowDetailsId('plugins', '@scope/ent-a')).toBe('market-details-plugins--scope-ent-a')
    expect(enterpriseMarketRowOpen(undefined, key)).toBe(true)
    expect(enterpriseMarketRowOpen(null, key)).toBe(false)
    expect(enterpriseMarketRowOpen(key, key)).toBe(true)
    expect(enterpriseMarketRowOpen('skills:other', key)).toBe(false)

    // `expandedRow` 无论怎么传，卡片都长得一模一样（新外壳一行状态都不消费）。
    const shapes = [null, key, enterpriseMarketRowKey('skills', rows[1]!.id)].map(expandedRow => EnterpriseMarketStoreShell({
      view: 'page', sessionUsable: true, enterpriseSkills: rows, expandedRow, onToggleSkill: vi.fn(), onToggleRow: vi.fn(),
    }))
    for (const tree of shapes) {
      // 动作**常显**：两行各一枚官方 Switch，且都落在卡片内的动作条里。
      expect(collectSwitchProps(tree).map(props => String(props['label']))).toEqual([
        '安装企业技能 会议纪要技能组',
        '安装企业技能 代码评审技能组',
      ])
      expect(collectByClassName(tree, 'own-market-cardActions')).toHaveLength(2)
      // 展开机制一件都不在：chevron / 展开区 / `skillId` 行 / 行上的 `data-open`。
      expect(collectByClassName(tree, 'own-market-cardChevron')).toEqual([])
      expect(collectByClassName(tree, 'own-market-cardDetails')).toEqual([])
      expect(collectByClassName(tree, 'own-market-entryValue')).toEqual([])
      expect(collectByClassName(tree, 'own-market-cardShell').map(props => props['data-open'])).toEqual([undefined, undefined])
      // 内容块不再是 disclosure 按钮：没有 `aria-expanded` / `aria-controls` / `onClick`（点了不会发生任何事）。
      const contents = collectByClassName(tree, 'own-market-cardContent')
      expect(contents.map(props => props['aria-expanded'])).toEqual([undefined, undefined])
      expect(contents.map(props => props['aria-controls'])).toEqual([undefined, undefined])
      expect(contents.map(props => props['onClick'])).toEqual([undefined, undefined])
      // `skillId` 不再作为可见文本出现（那行 `code-review` 被用户明确判为无用）。
      expect(textOf(tree)).not.toContain('code-review')
    }
    // 内容块是 `div`（不是 `<button>`）：整行可点的按钮里嵌不进官方 Switch 与 [有更新] 按钮。
    expect(collectButtonProps(shapes[0]!).filter(props => String(props['className'] ?? '').includes('own-market-cardContent'))).toEqual([])
    // 插件卡片同一套：`expandedRow: null` 时安装/卸载开关照样在卡片上（没有展开区可收起它）。
    const plugins = EnterpriseMarketStoreShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true, expandedRow: null,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      onTogglePlugin: vi.fn(),
    })
    expect(collectSwitchProps(plugins).map(props => String(props['label']))).toEqual(['安装企业插件 ent-a'])
    expect(collectByClassName(plugins, 'own-market-cardDetails')).toEqual([])
    expect(collectByClassName(plugins, 'own-market-cardChevron')).toEqual([])
    expect(collectByClassName(plugins, 'own-market-cardActions')).toHaveLength(1)
  })

  // **新增锁（本轮改动的核心）**：动作**在同一张卡片内部**——`[有更新]` 与官方 `Switch` 都落在该卡片的
  // `.own-market-cardContent` 之内（不是搬到卡片外面另起一条），失败提示也在同一张卡里；
  // 技能卡片与插件卡片各锁一遍（「动作常显」= 常显在**卡片上**，不是常显在别处）。
  it('keeps both card actions inside the same card as the title and the description', () => {
    const row = updatableRow()
    const tree = EnterpriseMarketStoreShell({
      view: 'page', sessionUsable: true, enterpriseSkills: [row],
      installedSkills: [installedSkill('1902500000000000100')], onToggleSkill: vi.fn(),
      skillActionError: { id: row.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
    })
    const card = collectByDataProp(tree, 'data-enterprise-skill-package', row.id)[0]
    expect(collectByClassName(card, 'own-market-cardContent')).toHaveLength(1)
    // 标题行 / 描述行 / 动作条都在同一张卡里；有更新按钮、官方 Switch、失败提示也在同一张卡里。
    for (const name of ['own-market-cardMainRow', 'own-market-cardDescription', 'own-market-cardActions']) {
      expect(collectByClassName(card, name), name).toHaveLength(1)
    }
    expect(collectTagProps(card)).toHaveLength(1)
    expect(collectSwitchProps(card)).toHaveLength(1)
    expect(collectAlerts(card)).toHaveLength(1)
    // 全树只有这一条动作条：动作没有在卡片外重复挂载一份。
    expect(collectByClassName(tree, 'own-market-cardActions')).toHaveLength(1)
    // 插件卡片同理：安装/卸载开关落在同一个卡片内容块里。
    const plugins = EnterpriseMarketStoreShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      onTogglePlugin: vi.fn(),
    })
    const pluginCard = collectByDataProp(plugins, 'data-enterprise-plugin-package', 'ent-a')[0]
    expect(collectByClassName(pluginCard, 'own-market-cardContent')).toHaveLength(1)
    expect(collectByClassName(pluginCard, 'own-market-cardActions')).toHaveLength(1)
    expect(collectSwitchProps(pluginCard)).toHaveLength(1)
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
    const page = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills, onSearchInput })
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
    const typing = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchValue: { skills: '代码' }, searchQuery: { skills: '' } })
    expect(collectByClassName(typing, 'own-market-catalogSearchInput')[0]?.['value']).toBe('代码')
    expect(collectByClassName(typing, 'own-market-cardShell')).toHaveLength(2)
    expect(collectByClassName(page, 'own-market-catalogSearchInput')[0]?.['value']).toBe('')

    // 过滤后**只有命中的行**在 DOM；页签计数仍说目录总行数（页签口径不变）；一条不剩时给空态文案且列表整段不渲染。
    const filtered = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: '代码' } })
    expect(textOf(filtered)).toContain('代码评审技能组')
    expect(textOf(filtered)).not.toContain('会议纪要技能组')
    expect(collectByRole(filtered, 'tab')[0]?.['children']).toBe(enterpriseMarketTabLabel('企业技能', 2))
    const empty = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: 'zzz' } })
    expect(textOf(empty)).toContain(ENTERPRISE_MARKET_SEARCH_EMPTY)
    expect(collectByClassName(empty, 'own-market-cardGrid')).toEqual([])
    // 清空关键词即恢复全部（空串 = 不过滤）。
    const cleared = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: '' } })
    expect(collectByClassName(cleared, 'own-market-cardShell')).toHaveLength(2)
    // 页签分槽：技能页签的框只回技能的关键词，插件页签各有自己的框与自己的槽。
    const pluginsPage = EnterpriseMarketStoreShell({ view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: plugins as never, onSearchInput })
    expect(collectByClassName(pluginsPage, 'own-market-catalogSearchInput')[0]?.['placeholder']).toBe('搜索企业插件…')
    collectByClassName(pluginsPage, 'own-market-catalogSearchInput')[0]?.['onChange']?.({ target: { value: 'x' } })
    expect(onSearchInput).toHaveBeenLastCalledWith('plugins', 'x')
    // 「组件」页签**不配搜索框**（恒三行、且是交付排期清单，过滤它只会把三行藏成一两行）：整棵树里没有它。
    const components = EnterpriseMarketStoreShell({ view: 'page', activeTab: 'components' })
    expect(collectByClassName(components, 'own-market-catalogSearch')).toEqual([])
    expect(collectByClassName(components, 'own-market-catalogSearchInput')).toEqual([])
    expect(textOf(components)).toContain('包含的组件')

    // **旧外壳不渲染搜索框**（9723a97 那一版没有这一件），但**过滤口径是共享的**：
    // 同一组 `searchQuery` 喂进去，旧外壳也只列出命中的行——证明过滤逻辑只有一份、不是新外壳私有。
    const legacy = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills })
    expect(collectByClassName(legacy, 'own-market-catalogSearch')).toEqual([])
    expect(collectByClassName(legacy, 'own-market-catalogSearchInput')).toEqual([])
    const legacyFiltered = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills, searchQuery: { skills: '代码' } })
    expect(textOf(legacyFiltered)).toContain('代码评审技能组')
    expect(textOf(legacyFiltered)).not.toContain('会议纪要技能组')
    expect(collectByRole(legacyFiltered, 'tab')[0]?.['children']).toBe(enterpriseMarketTabLabel('企业技能', 2))

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
    const tree = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]), onToggleSkill: vi.fn() })
    expect(collectStateDotProps(tree).map(props => props['state'])).toEqual(['idle'])
    expect(collectByClassName(tree, 'own-market-configTag')[0]).toMatchObject({ tone: 'neutral', children: '未装' })
    expect(collectByClassName(tree, 'own-market-rowStatus')).toEqual([])
    expect(collectDataValues(tree, 'data-enterprise-row-enabled')).toEqual(['false'])
    // 在途：状态点转 ongoing（旋转弧）、标签仍是「未装」、状态文字「安装中」——标题行上就能看见「正在进行」。
    const busy = EnterpriseMarketStoreShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
      pendingSkill: { packageId: SKILL.id, next: true }, onToggleSkill: vi.fn(),
    })
    expect(collectStateDotProps(busy).map(props => props['state'])).toEqual(['ongoing'])
    expect(collectByClassName(busy, 'own-market-rowStatus').map(props => props['children'])).toEqual(['安装中'])
    expect(collectDataValues(busy, 'data-enterprise-skill-state')).toEqual(['INSTALLING'])
    // 已装旧版本：warning 点 + success「已装」标签 + 「有更新」文字（三者互补：盘上事实 vs 相对中心的结论）。
    const outdated = EnterpriseMarketStoreShell({
      view: 'page', sessionUsable: true, enterpriseSkills: [updatableRow()],
      installedSkills: [installedSkill('1902500000000000100')], onToggleSkill: vi.fn(),
    })
    expect(collectStateDotProps(outdated).map(props => props['state'])).toEqual(['warning'])
    expect(collectByClassName(outdated, 'own-market-configTag')[0]).toMatchObject({ tone: 'success', children: '已装' })
    expect(collectByClassName(outdated, 'own-market-rowStatus').map(props => props['children'])).toEqual(['有更新'])
    // 插件行：ACTIVE → done + success「已启用」且无多余文字；FAILED → error 点 + 官方「处理失败」+ 未启用标签。
    const activePlugin = EnterpriseMarketStoreShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
    })
    expect(collectStateDotProps(activePlugin).map(props => props['state'])).toEqual(['done'])
    expect(collectByClassName(activePlugin, 'own-market-configTag')[0]).toMatchObject({ tone: 'success', children: '已启用' })
    expect(collectByClassName(activePlugin, 'own-market-rowStatus')).toEqual([])
    const failedPlugin = EnterpriseMarketStoreShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'FAILED', inCatalog: true }] as never,
    })
    expect(collectStateDotProps(failedPlugin).map(props => props['state'])).toEqual(['error'])
    expect(collectByClassName(failedPlugin, 'own-market-configTag')[0]).toMatchObject({ tone: 'neutral', children: '未启用' })
    expect(collectByClassName(failedPlugin, 'own-market-rowStatus').map(props => props['children'])).toEqual(['处理失败'])
    // 旧外壳的**落点**不同、**事实同源**：技能行不出状态点/事实标签（9723a97 那一版没有这两件），
    // 插件行恒出「状态点 + 官方状态词」（安静态也说）——两者读的是同一批 facts（dot / stateTitle）。
    const legacySkills = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
    expect(collectStateDotProps(legacySkills)).toEqual([])
    expect(collectByClassName(legacySkills, 'own-market-configTag')).toEqual([])
    expect(collectByClassName(legacySkills, 'own-market-rowStatus')).toEqual([])
    const activeLegacyPlugin = EnterpriseMarketLegacyShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
    })
    const failedLegacyPlugin = EnterpriseMarketLegacyShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'FAILED', inCatalog: true }] as never,
    })
    // 状态点语义与状态词与「新外壳」逐项一致（同一份 `enterprisePluginDot` + 同一份官方状态词表）。
    expect(collectStateDotProps(activeLegacyPlugin).map(props => props['state']))
      .toEqual(collectStateDotProps(activePlugin).map(props => props['state']))
    expect(collectStateDotProps(failedLegacyPlugin).map(props => props['state']))
      .toEqual(collectStateDotProps(failedPlugin).map(props => props['state']))
    // 旧外壳的落点是「状态点旁**恒**出一行官方状态词」：`ACTIVE` 的原值是「已安装」（不是新外壳那枚 Tag 的「已启用」）。
    expect(textOf(activeLegacyPlugin)).toContain('已安装')
    expect(textOf(failedLegacyPlugin)).toContain('处理失败')
  })

  // **能力回归锁（新外壳，去折叠后）**：五条「必须保留的能力」一个不少，只是落点从展开区搬到卡片上——
  // ① 版本签/分类签 → 标题行；② 有更新辅助动作 / ③ 安装卸载开关 / ④ 失败提示 → **卡片内常显**（不再有收起态）；
  // ⑤ 组件页签的折叠语义、三行清单与无障碍契约不变（那一节的折叠不属本次改动）。
  it('keeps every pre-existing capability on the store-shell card (no disclosure remains)', () => {
    const row = updatableRow()
    const shared = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [row],
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: row.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      onToggleSkill: vi.fn(),
      onToggleRow: vi.fn(),
    }
    const tree = EnterpriseMarketStoreShell({ ...shared, expandedRow: enterpriseMarketRowKey('skills', row.id) })
    // ① 标题行：标题 + 版本签 + 分类签（分类缺席时那一格是 null，不塞占位）。
    expect((collectByClassName(tree, 'own-market-cardHead')[0]?.['children'] as ReactNode[])).toHaveLength(3)
    expect(collectByClassName(tree, 'own-market-skillVersionTag')).toHaveLength(1)
    // ②③④ 三件事**全在卡片上常显**：有更新按钮 + 官方 Switch + role="alert" 各恰好一件。
    expect(textOf(tree)).toContain('有更新')
    expect(collectTagProps(tree)).toHaveLength(1)
    expect(collectSwitchProps(tree)).toHaveLength(1)
    expect(collectAlerts(tree)).toHaveLength(1)
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
    // **去折叠的语义核心**：`expandedRow: null`（原先的「全收起」态）下动作与提示**照旧常显**——没有能力被收起来。
    const collapsed = EnterpriseMarketStoreShell({ ...shared, expandedRow: null })
    expect(collectSwitchProps(collapsed)).toHaveLength(1)
    expect(collectAlerts(collapsed)).toHaveLength(1)
    expect(collectTagProps(collapsed)).toHaveLength(1)
    expect(collectByClassName(collapsed, 'own-market-cardActions')).toHaveLength(1)
    // 展开机制本身一件都不在（chevron / 展开区 / skillId 行 / `aria-controls` 配对）。
    for (const absent of ['own-market-cardDetails', 'own-market-cardChevron', 'own-market-entryValue']) {
      expect(collectByClassName(tree, absent), absent).toEqual([])
      expect(collectByClassName(collapsed, absent), absent).toEqual([])
    }
    expect(collectByClassName(tree, 'own-market-cardContent')[0]?.['aria-controls']).toBeUndefined()
    // ⑤ 组件页签：折叠语义与三行清单、开关动作名一字未动；搜索框没进这个页签。
    const components = EnterpriseMarketStoreShell({ view: 'page', activeTab: 'components', expandedSections: { components: true }, onToggleSection: vi.fn() })
    expect(collectElementById(components, 'market-section-components')).not.toBeUndefined()
    expect(collectSwitchProps(components).map(props => props['label'])).toEqual(['启用组件 插件', '启用组件 技能', '启用组件 配方'])
    expect(textOf(components)).toContain('包含的组件')
    expect(collectByClassName(components, 'own-market-catalogSearch')).toEqual([])
    // 三页签与默认选中不变（去折叠没有动信息架构）。
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'components'])
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(collectByRole(EnterpriseMarketStoreShell({ view: 'page' }), 'tablist')).toHaveLength(1)
    expect(collectByRole(EnterpriseMarketStoreShell({ view: 'page' }), 'tab')).toHaveLength(3)
    expect(collectByRole(EnterpriseMarketStoreShell({ view: 'page' }), 'tabpanel')).toHaveLength(3)
  })

  // 旧外壳的**能力落点回归锁**（9723a97 那一版）：同样的十条能力，一条不许少，只是落点换成行内。
  // ① 版本签/分类签 → 标题行；②③④ 有更新动作 / 官方 Switch / role="alert" → **行内**（没有展开区）。
  // ⑤ 组件页签折叠与三行清单（与两套外壳共用的那份渲染）不变。
  it('keeps every pre-existing capability inside the legacy inline layout', () => {
    const row = updatableRow()
    const shared = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [row],
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: row.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      onToggleSkill: vi.fn(),
    }
    const tree = EnterpriseMarketLegacyShell(shared)
    // ① 标题行：标题 + 版本签 + 分类签（分类缺席时那一格是 null，不塞占位）。
    expect((collectByClassName(tree, 'own-market-cardHead')[0]?.['children'] as ReactNode[])).toHaveLength(3)
    expect(collectByClassName(tree, 'own-market-skillVersionTag')).toHaveLength(1)
    // ②③④ 三件事都在**行内**（同一个 rowLine 里）：有更新按钮 + 官方 Switch + role="alert" 各恰好一件。
    expect(collectTagProps(tree)).toHaveLength(1)
    expect(collectSwitchProps(tree)).toHaveLength(1)
    expect(collectAlerts(tree)).toHaveLength(1)
    // 行内**没有**展开区/卡片网格/搜索框（那三件是新外观的落点）。
    expect(collectByClassName(tree, 'own-market-cardDetails')).toEqual([])
    expect(collectByClassName(tree, 'own-market-cardShell')).toEqual([])
    expect(collectByClassName(tree, 'own-market-cardGrid')).toEqual([])
    expect(collectByClassName(tree, 'own-market-catalogSearch')).toEqual([])
    // 辅助动作严格排在 Switch **左侧**（开关仍是主控件）。
    const lineKids = legacyRowLineChildren(tree, row.id)
    const order = actionOrder(lineKids)
    expect(order.tag).toBeGreaterThanOrEqual(0)
    expect(order.switch).toBeGreaterThan(order.tag)
    // 行内失败提示的类名与「技能」tab 同口径（两套外壳共用同一份 `EnterpriseMarketRowError`），且带稳定错误码。
    const alertNodes = collectAlerts(tree)
    expect(isValidElement(alertNodes[0]) ? (alertNodes[0].props as Record<string, unknown>)['className'] : undefined).toBe('own-market-inlineError')
    expect(textOf(alertNodes[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // 组件页签：折叠语义 + 三行清单 + 开关动作名与另一套外壳逐项一致。
    const components = EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'components', expandedSections: { components: true }, onToggleSection: vi.fn() })
    expect(collectElementById(components, 'market-section-components')).not.toBeUndefined()
    expect(collectSwitchProps(components).map(props => props['label'])).toEqual(['启用组件 插件', '启用组件 技能', '启用组件 配方'])
    expect(textOf(components)).toContain('包含的组件')
  })

  // HERO：**只有新外壳有**（旧外观一个字都不加）。结构 = 渐变底横幅 → 标题「应用商店」→ 两枚计数 chip → 副文案。
  it('adds the gradient HERO to the store shell only, with counts taken from the real row numbers', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL, { ...SKILL, id: '1902500000000000002', skillId: 'code-review' }])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    const props = { view: 'page' as const, sessionUsable: true, enterpriseSkills, enterprisePlugins: enterprisePlugins as never }
    const store = EnterpriseMarketStoreShell(props)
    // 结构：恰好一条 HERO，三件内容都在里面（标题 / 两枚 chip / 副文案）。
    const heroes = collectByClassName(store, 'own-market-storeHero')
    expect(heroes).toHaveLength(1)
    const heroText = textOf(store)
    expect(heroText).toContain(ENTERPRISE_STORE_HERO_TITLE)
    expect(heroText).toContain(ENTERPRISE_STORE_HERO_NOTE)
    // 两枚计数 chip：数字取**真实行数**（与页签计数同源）。
    expect(collectByClassName(store, 'own-market-storeHeroChip').map(chip => chip['children'])).toEqual([
      enterpriseMarketHeroSkillChip(2),
      enterpriseMarketHeroPluginChip(1),
    ])
    expect(enterpriseMarketHeroSkillChip(0)).toBe('共 0 个企业技能')
    expect(enterpriseMarketHeroPluginChip(0)).toBe('0 个企业插件')
    // 与页签计数同源：chip 数字 === 「企业技能 2」/「企业插件 1」里的数字。
    const tabs = collectByRole(store, 'tab').map(tab => tab['children'])
    expect(tabs).toEqual(['企业技能 2', '企业插件 1', '组件 3'])
    expect(enterpriseMarketShellModel(props).tabCounts).toEqual({ skills: 2, plugins: 1, components: 3 })
    // 门控不过（会话不可用）时 chip 如实说 0——不另算一套。
    const gated = EnterpriseMarketStoreShell({ view: 'page', sessionUsable: false, enterpriseSkills, enterprisePlugins: enterprisePlugins as never })
    expect(collectByClassName(gated, 'own-market-storeHeroChip').map(chip => chip['children']))
      .toEqual([enterpriseMarketHeroSkillChip(0), enterpriseMarketHeroPluginChip(0)])
    // 旧外壳**没有** HERO：连类名与文案都不出现。
    const legacy = EnterpriseMarketLegacyShell(props)
    expect(collectByClassName(legacy, 'own-market-storeHero')).toEqual([])
    expect(textOf(legacy)).not.toContain(ENTERPRISE_STORE_HERO_TITLE)
    expect(textOf(legacy)).not.toContain(ENTERPRISE_STORE_HERO_NOTE)
    expect(textOf(legacy)).not.toContain(enterpriseMarketHeroSkillChip(2))
    // summary 视图不出 HERO（官方卡片只渲染那一句话）。
    expect(collectByClassName(EnterpriseMarketStoreShell({ view: 'summary' }), 'own-market-storeHero')).toEqual([])
    // 渐变底：两枚**既有**背景色 token 拼 linear-gradient（本仓主题里没有渐变 token）；
    // 圆角/内衬/字号一律照本文件既有官方取值（radius-xl / 14px 内衬 / 14-20-500 / 12-18）。
    const css = collectStyleText(store)
    const hero = cssRuleBody(css, '.own-market-storeHero')
    expect(hero).toContain('linear-gradient(135deg,var(--dsw-alias-state-business-tertiary')
    expect(hero).toContain('var(--dsw-alias-bg-layer-2')
    expect(hero).toContain('border-radius:var(--dsw-radius-xl')
    expect(hero).toContain('border:.5px solid var(--dsw-alias-settings-card-stroke')
    expect(hero).toContain('padding:14px')
    expect(cssRuleBody(css, '.own-market-storeHeroTitle')).toContain('font-size:14px')
    expect(cssRuleBody(css, '.own-market-storeHeroTitle')).toContain('font-weight:500')
    expect(cssRuleBody(css, '.own-market-storeHeroChip')).toContain('border-radius:999px')
    expect(cssRuleBody(css, '.own-market-storeHeroChip')).toContain('font-size:12px')
    expect(cssRuleBody(css, '.own-market-storeHeroNote')).toContain('font-size:12px')
    // 旧外壳那份 `<style>` 里也没有 HERO 规则（两套外观的 CSS 各装各的）。
    expect(cssRuleBody(collectStyleText(legacy), '.own-market-storeHero')).toBe('')
  })

  // 容器内边距（用户反馈「四周缺少间距」）：侧栏「应用商店」是我们**自己注册的 main 面板**，官方不像
  // `plugins.item` 的 `DetailTop` 那样给它带外层内边距，故 HERO / 页签条 / 搜索框 / 卡片网格原先整页贴着
  // 屏幕左右边缘。修在**新外壳的根容器**上；旧外壳外面有官方内边距，一行都不能加——本用例同时反向锁死它。
  it('pads the store shell root container and keeps the legacy shell free of that padding', () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
    }
    const store = EnterpriseMarketStoreShell(props)
    const legacy = EnterpriseMarketLegacyShell(props)
    const css = collectStyleText(store)
    // 规则原文（写进 `storeStyles` 的那一条）：左右 14px = 卡片内衬 `padding:12px 14px` 的横向 14px（= HERO 内衬）；
    // 顶部 14px 同一口径（HERO 不贴内容区上沿）；底部 20px = 卡片/HERO 的 radius-xl(20px) 量级（最后一张卡不贴底）。
    expect(cssRuleBody(css, '.own-market-entry.own-market-storePage'))
      .toBe('padding:14px 14px 20px;box-sizing:border-box')
    // 内边距加在**新外壳的根节点**上：根节点自己就是这个 section，故 HERO / 页签条 / 搜索框 / 卡片网格 /
    // 动作条 / 失败提示六件全部落在同一个有内边距的容器里（逐个在树里实渲染一次）。
    expect(isValidElement(store) ? store.type : undefined).toBe('section')
    expect(isValidElement(store) ? store.props.className : undefined).toBe('own-market-entry own-market-storePage')
    for (const name of ['own-market-storeHero', 'own-market-storeTabs', 'own-market-catalogSearch', 'own-market-cardGrid', 'own-market-cardActions', 'own-market-inlineError']) {
      expect(collectByClassName(store, name), name).toHaveLength(1)
    }
    // 不横向溢出：`.own-market-entry *` 的既有 border-box 口径对本页所有后代成立，根节点自己再显式声明一次
    // （块级 `width:auto` + border-box 下内边距落在容器内部，不产生横向滚动）。
    expect(cssRuleBody(css, '.own-market-entry *')).toBe('box-sizing:border-box')
    // 窄屏那套单列逻辑一字未动（容器查询 + 同断点 media 兜底旧 WebView）。
    expect(css).toContain('@container own-market-catalog')
    expect(css).toContain('@media (max-width:520px)')
    // 反向断言（防把官方那层间距重复叠上）：旧外壳既没有这枚类，也没有这条内边距规则。
    expect(isValidElement(legacy) ? legacy.props.className : undefined).toBe('own-market-entry')
    expect(collectByClassName(legacy, 'own-market-storePage')).toEqual([])
    const legacyCss = collectStyleText(legacy)
    expect(cssRuleBody(legacyCss, '.own-market-entry.own-market-storePage')).toBe('')
    expect(legacyCss).not.toContain('storePage')
    expect(legacyCss).not.toContain('padding:14px 14px 20px')
    // 旧外壳根节点仍是零内边距（依赖官方 DetailTop 自带内边距），共享的 border-box 口径照旧还在。
    const legacyRoot = cssRuleBody(legacyCss, '.own-market-entry')
    expect(legacyRoot).toContain('min-width:0')
    expect(legacyRoot).not.toContain('padding')
  })

  // 商业化字样反向断言：两套外壳（含 summary 与三个页签、含失败态与已装态）的全树文本与样式文本
  // 都不许出现价格/交易/购买/购物车/客服之类的字样。
  it('keeps both shells free of any commercial wording', () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [updatableRow()],
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'FAILED', inCatalog: false }] as never,
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      pluginActionError: { id: 'ent-a', action: 'install' as const, code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
    }
    for (const { label, shell } of MARKET_SHELLS) {
      const trees: readonly ReactNode[] = [
        shell({ view: 'summary' }),
        shell(props),
        shell({ ...props, activeTab: 'plugins' }),
        shell({ ...props, activeTab: 'components' }),
      ]
      for (const tree of trees) {
        const text = `${textOf(tree)}\n${collectStyleText(tree)}`
        for (const word of BANNED_COMMERCIAL_WORDS) {
          expect(text, `${label} / ${word}`).not.toContain(word)
        }
      }
    }
    // HERO 文案本身也过一遍黑名单（新增文案最容易带进买卖话术）。
    for (const word of BANNED_COMMERCIAL_WORDS) {
      expect(ENTERPRISE_STORE_HERO_TITLE, word).not.toContain(word)
      expect(ENTERPRISE_STORE_HERO_NOTE, word).not.toContain(word)
    }
  })

  // ══ 拆分的核心门禁：两套外壳**只有呈现不同**，事实/行为必须逐项一致（同一份逻辑）══════════════════
  it('proves the two shells share exactly one logic layer (identical facts on identical input)', async () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [updatableRow()],
      enterprisePlugins: [
        { packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true },
        { packageName: 'ent-b', version: null, state: 'RESTART_REQUIRED', inCatalog: false },
      ] as never,
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      pluginActionError: { id: 'ent-a', action: 'uninstall' as const, code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
      onToggleSkill: vi.fn(),
      onTogglePlugin: vi.fn(),
    }
    // ① 模型只有一个：同一组 props 两次调用逐字段相等（纯函数、无隐藏状态）。
    expect(enterpriseMarketShellModel(props)).toEqual(enterpriseMarketShellModel(props))
    const model = enterpriseMarketShellModel(props)
    // ② 页签计数一致：两套外壳的页签文案 === 模型给的文案。
    for (const { label, shell } of MARKET_SHELLS) {
      expect(collectByRole(shell(props), 'tab').map(tab => tab['children']), label)
        .toEqual(model.tabEntries.map(entry => entry.text))
    }
    // ③「有更新」判定一致：同一行在两边都判更新（两边都渲染出同一枚辅助动作，点击都走安装方向）。
    const legacy = EnterpriseMarketLegacyShell(props)
    const store = EnterpriseMarketStoreShell(props)
    const legacyTag = collectTagProps(legacy)
    const storeTag = collectTagProps(store)
    expect(legacyTag).toHaveLength(1)
    expect(storeTag).toHaveLength(1)
    expect(legacyTag[0]?.['data-enterprise-skill-tag']).toBe(storeTag[0]?.['data-enterprise-skill-tag'])
    expect(legacyTag[0]?.['aria-label']).toBe(storeTag[0]?.['aria-label'])
    expect(enterpriseMarketSkillRowFacts(props, props.enterpriseSkills[0]!).hasUpdate).toBe(true)
    // ④ 失败码一致：两边的 role="alert" 文案（前缀 + 稳定码）逐字相同。
    expect(collectAlerts(legacy).map(alert => textOf(alert))).toEqual(collectAlerts(store).map(alert => textOf(alert)))
    expect(textOf(collectAlerts(legacy)[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // ⑤ 行级 facts 只有一份：两套外壳渲染出的开关 checked/disabled/label 与 facts 逐项相等。
    const facts = enterpriseMarketSkillRowFacts(props, props.enterpriseSkills[0]!)
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell(props)
      const skillSwitch = collectSwitchProps(tree).find(item => String(item['label']).includes('企业技能'))!
      expect(skillSwitch['checked'], label).toBe(facts.enabled)
      expect(skillSwitch['disabled'], label).toBe(props.onToggleSkill === undefined || facts.busy)
      expect(collectDataValues(tree, 'data-enterprise-skill-state'), label).toEqual([facts.state])
      // ⑥ 组件清单投影一致（三行、仅配方预留）——要切到「组件」页签才挂载那一节。
      expect(collectDataValues(shell({ ...props, activeTab: 'components' }), 'data-market-component'), label)
        .toEqual(['plugins', 'skills', 'presets'])
    }
    // ⑦ 源码级不变量：逻辑入口只有一处定义、两套外壳各调用一次；防抖与动作接线各只有一份。
    // 只看**代码**（剥掉注释）——否则文档里提到同一个标识符就会被误计一次。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    const count = (re: RegExp): number => (source.match(re) ?? []).length
    // 模型：1 处定义 + 恰好两套外壳各 1 处调用 = 3。
    expect(count(/enterpriseMarketShellModel\(/g)).toBe(3)
    // 行 facts 唯一入口：1 处定义 + 两套外壳各 1 处 = 3。
    expect(count(/enterpriseMarketSkillRowFacts\(/g)).toBe(3)
    expect(count(/enterpriseMarketPluginRowFacts\(/g)).toBe(3)
    // 防抖定时器、安装/卸载动作、过滤写回各只有一份（复制逻辑会在这里翻倍）。
    expect(count(/setTimeout\(/g)).toBe(1)
    expect(count(/setSearchQuery\(/g)).toBe(1)
    expect(count(/\.installPlugin\(/g)).toBe(1)
    expect(count(/\.removePlugin\(/g)).toBe(1)
    // 两个 hook 入口只经同一个宿主接线（没有各写一套取数/动作/弹窗）。
    expect(count(/EnterpriseMarketShellHost/g)).toBe(3)
    expect(count(/useEnterpriseMarketController\(/g)).toBe(2)
  })

  // 类名隔离的源码级不变量（本轮发现的真实隐患）：本页与「企业设置 → 插件」（`plugin-market.tsx`）都注入
  // 同名前缀的 `<style>`，而两者用的是**全局单类选择器**——同一个类名会被后挂载的那份 CSS 覆盖
  // （例如 `plugin-market` 的 `.own-market-card` 会把本页卡片改成 1px/8px/padding:16、`.own-market-search input`
  // 会以更高特异性压掉本页输入框的描边）。故本文件的类名必须与同包其他源文件**零交集**。
  it('keeps this page\'s style class names disjoint from every other source file', async () => {
    const mine = declaredClassNames(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 抽取器先自证有效：两套外观各自新起的类名必须能被抽出来（新外壳的卡片网格 + 旧外壳的官方两行卡片 + HERO）。
    expect(mine.has('own-market-cardShell')).toBe(true)
    expect(mine.has('own-market-cardGrid')).toBe(true)
    expect(mine.has('own-market-catalogSearch')).toBe(true)
    expect(mine.has('own-market-storeTabs')).toBe(true)
    expect(mine.has('own-market-cardId')).toBe(true)
    expect(mine.has('own-market-cardDesc')).toBe(true)
    expect(mine.has('own-market-storeHero')).toBe(true)
    expect(mine.has('own-market-storeHeroChip')).toBe(true)
    // 两套外壳的行版式类名互相独立：旧外观**没有**新外观那套卡片网格类，反之亦然。
    // （`declaredClassNames` 按模板字面量抽取，故把 `<style>` 里的 CSS 重新包成一对反引号。）
    const cssClassesOf = (tree: ReactNode): Set<string> => declaredClassNames(`\`${collectStyleText(tree)}\``)
    const legacyOnly = cssClassesOf(EnterpriseMarketLegacyShell({ view: 'page' }))
    const storeOnly = cssClassesOf(EnterpriseMarketStoreShell({ view: 'page' }))
    expect(legacyOnly.has('own-market-cardId')).toBe(true)
    expect(legacyOnly.has('own-market-cardShell')).toBe(false)
    expect(legacyOnly.has('own-market-cardGrid')).toBe(false)
    expect(legacyOnly.has('own-market-storeHero')).toBe(false)
    expect(storeOnly.has('own-market-cardShell')).toBe(true)
    expect(storeOnly.has('own-market-cardGrid')).toBe(true)
    expect(storeOnly.has('own-market-cardId')).toBe(false)
    // 共用部分（baseStyles）两边都在：页签条与节容器只有一份实现。
    for (const shared of ['own-market-storeTabs', 'own-market-storeTab', 'own-market-section', 'own-market-cardHead', 'own-market-inlineError']) {
      expect(legacyOnly.has(shared), shared).toBe(true)
      expect(storeOnly.has(shared), shared).toBe(true)
    }
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
 * 二期结构切片 **+ 双外观拆分**：官方插件页「官方」分组里的「插件市场」卡片与侧栏一级入口「应用商店」
 * 对应的主内容区面板是**两条入口**，且**各用各的呈现外壳**：
 *  · `plugins.item` → `EnterpriseMarketLegacyPage` → `EnterpriseMarketLegacyShell`（旧外观：9723a97 那一版官方两行卡片）；
 *  · `main`(key `enterprise-store`) → `EnterpriseMarketStorePage` → `EnterpriseMarketStoreShell`（新外观：HERO + 卡片网格 + 搜索）。
 * 这里锁三件事：
 *  ① **注册形状**——slot 名、`main.key` 与 `sidebar.panellist.id` 同值、order=20、label「应用商店」、图标存在、
 *     `inject` 声明含 `layout`（四个注册面与 `inject` 形状相对拆分前**一字未改**）；
 *  ② **两条入口指向不同组件**——`plugins.item` 的组件 !== `main` 的组件，且各自渲染出的关键结构符合各自外观
 *     （旧外壳出 `.own-market-cardId` 且**无** HERO/卡片网格；新外壳出 `.own-market-cardShell`/`.own-market-cardGrid` 且**有** HERO）；
 *  ③ **同一份逻辑**——两条入口共用同一个控制器/同一份 store，故同一组输入下页签计数、失败码、行事实逐项一致。
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

  it('wires the two entries to two different shells (plugins.item → legacy, main → store)', async () => {
    const { registrations } = runClientRegistrations()
    const item = registrations.find(entry => entry.options['name'] === 'plugins.item')!
    const panel = registrations.find(entry => entry.options['name'] === 'main')!
    // ① 门禁的核心：两条入口**不是**同一个组件（拆分前它俩指向同一个 `EnterpriseMarketPage`）。
    expect(item.component).not.toBe(panel.component)
    expect(item.component).toBe(EnterpriseMarketLegacyPage)
    expect(panel.component).toBe(EnterpriseMarketStorePage)
    expect(EnterpriseMarketLegacyPage).not.toBe(EnterpriseMarketStorePage)
    // ② 两个入口壳各自把「哪个呈现外壳」交给同一个宿主：源码级断言（hook 组件不能直接函数调用渲染）。
    //    这保证注册面指向的外壳与测试里渲染的外壳是同一对，不会出现「改了注册但测试锁的是另一个」。
    const clientSource = await readFile(new URL('../src/client.tsx', import.meta.url), 'utf8')
    expect(clientSource).toContain('EnterpriseMarketLegacyPage')
    expect(clientSource).toContain('EnterpriseMarketStorePage')
    expect(clientSource).not.toContain('EnterpriseMarketPage as')
    // ③ 面板侧不读官方 owner props，而在注册面注入等价 props：view 恒为 'page'、store 与卡片同源；卡片侧只注入 store。
    const panelProps = (panel.options['inject'] as () => Record<string, unknown>)()
    const itemProps = (item.options['inject'] as () => Record<string, unknown>)()
    expect(panelProps['view']).toBe(ENTERPRISE_STORE_PANEL_VIEW)
    expect(ENTERPRISE_STORE_PANEL_VIEW).toBe('page')
    expect(itemProps).toEqual({ store: itemProps['store'] })
    expect(panelProps['store']).toBe(itemProps['store'])
    // ④ 两条入口的**呈现**不同、**语义**相同：同一组 props 下关键结构逐项对照。
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
    }
    const legacy = EnterpriseMarketLegacyShell(props)
    const store = EnterpriseMarketStoreShell(props)
    // 呈现差异（关键结构各自符合各自外观）。
    expect(collectByClassName(legacy, 'own-market-cardId')).toHaveLength(1)
    expect(collectByClassName(legacy, 'own-market-cardShell')).toEqual([])
    expect(collectByClassName(legacy, 'own-market-cardGrid')).toEqual([])
    expect(collectByClassName(legacy, 'own-market-storeHero')).toEqual([])
    expect(collectByClassName(store, 'own-market-cardShell')).toHaveLength(1)
    expect(collectByClassName(store, 'own-market-cardGrid')).toHaveLength(1)
    expect(collectByClassName(store, 'own-market-storeHero')).toHaveLength(1)
    expect(collectByClassName(store, 'own-market-cardId')).toEqual([])
    // 语义相同（同一份逻辑）：页签 id/文案/aria 配对/开关动作名。
    const semanticShapeOf = (tree: ReactNode) => ({
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
      skillStates: collectDataValues(tree, 'data-enterprise-skill-state'),
      pluginStates: collectDataValues(tree, 'data-enterprise-plugin-state'),
    })
    expect(semanticShapeOf(store)).toEqual(semanticShapeOf(legacy))
    // 两套外壳都必须产出「一条 role="tablist" + 三个企业页签 + 三个面板」。
    for (const [label, tree] of [['legacy', legacy], ['store', store]] as const) {
      expect(collectByRole(tree, 'tablist'), label).toHaveLength(1)
      expect(collectByRole(tree, 'tablist')[0]?.['aria-label'], label).toBe(ENTERPRISE_MARKET_TABLIST_LABEL)
      expect(collectByRole(tree, 'tab').map(node => node['children']), label)
        .toEqual(['企业技能 1', '企业插件 1', '组件 3'])
      expect(collectByRole(tree, 'tab').map(node => node['aria-selected']), label).toEqual([true, false, false])
      expect(collectByRole(tree, 'tabpanel'), label).toHaveLength(ENTERPRISE_MARKET_TABS.length)
    }
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
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectButtonProps(rendered as ReactNode, acc)
  }
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
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByRole(rendered as ReactNode, role, acc)
  }
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
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectAlerts(rendered as ReactNode, acc)
  }
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
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectSwitchProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectSwitchProps(value as ReactNode, acc)
  }
  return acc
}

/**
 * 剥掉注释后的源码：源码级不变量必须**只看代码**——否则头部 [OUTPUT] 里提到同一个标识符
 * （例如 `enterpriseMarketShellModel(props)`）就会被错误地多记一次，断言变成对文档敏感。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/**
 * 抽出某个源文件**样式块**里声明的 CSS 类名（只看模板字面量里像 CSS 的块，
 * 不把 JS 成员访问如 `props.length` 误当类名），用于锁「本文件与同包其他文件的类名零交集」。
 */
function declaredClassNames(source: string): Set<string> {
  const blocks = [...source.matchAll(/`([^`]*?)`/gs)]
    .map(match => match[1] ?? '')
    .filter(block => block.includes('{') && block.includes('}') && block.includes(':'))
  // CSS 注释里会**刻意**提到旧类名（例如「类名从旧名 .own-market-tabs 改成 .own-market-storeTabs」），
  // 那是改名理由的留痕、不是真的声明，故先剥掉 /* … */ 再抽类名，避免注释把断言弄成假阳性。
  const css = blocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  return new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)\s*[,:{[\s>]/g)].map(match => match[1]!))
}

/** 收集元素树里所有官方 `<StateDot>` 的 props（行尾状态点语义：活跃/未观察/在途…）。 */
function collectStateDotProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectStateDotProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === (StateDot as unknown)) { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectStateDotProps(rendered as ReactNode, acc)
  }
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
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectDataValues(rendered as ReactNode, prop, acc)
  }
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
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectTagProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectTagProps(value as ReactNode, acc)
  }
  return acc
}

/**
 * 取某行**卡片内动作条**（`.own-market-cardActions`）的直属子元素（顺序即渲染顺序），
 * 用于锁「辅助标签严格排在 Switch 左侧」。去折叠后动作条直接在卡片内容里（不再是展开区里那份），
 * 故按该行的数据钩子（`data-enterprise-*-package`）精确定位到本行，再向下取动作条。
 */
function cardActionChildren(tree: ReactNode, rowId: string, tab: 'skills' | 'plugins' = 'skills'): ReactNode[] {
  const hook = tab === 'skills' ? 'data-enterprise-skill-package' : 'data-enterprise-plugin-package'
  const row = collectByDataProp(tree, hook, rowId)[0]
  const actions = collectByClassName(row, 'own-market-cardActions')[0]
  const actionKids = actions?.['children']
  return Array.isArray(actionKids) ? (actionKids as ReactNode[]) : []
}

/**
 * 收集树里某个 `data-*` 属性**取值命中**的**元素本身**（不是 props），用于继续向下取 children。
 * 与 `collectDataValues` 同族，但保留节点——锁「某一行的动作子元素顺序」时要继续下钻。
 */
function collectByDataProp(node: ReactNode, prop: string, value: unknown, acc: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) { for (const child of node) collectByDataProp(child, prop, value, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props[prop] === value) { acc.push(node); return acc }
  if (typeof node.type === 'function') collectByDataProp((node.type as (p: unknown) => ReactNode)(props), prop, value, acc)
  for (const v of Object.values(props)) {
    if (v !== null && typeof v === 'object') collectByDataProp(v as ReactNode, prop, value, acc)
  }
  return acc
}

/**
 * 旧外壳某行的动作区 = `.own-market-rowLine` 的直属子元素（`[有更新]` 与 `[Switch]` 都落在这一行里）。
 * 新外壳的动作落在**卡片内常显**的动作条 `.own-market-cardActions`（见 `cardActionChildren`）——两套外观的落点不同，故各取各的容器。
 */
function legacyRowLineChildren(tree: ReactNode, rowId: string): ReactNode[] {
  const row = collectByDataProp(tree, 'data-enterprise-skill-package', rowId)[0] as { props?: Record<string, unknown> } | undefined
  const kids = row?.props?.['children'] as ReactNode[] | undefined
  const line = collectByClassName(kids as ReactNode, 'own-market-rowLine')[0]
  const lineKids = line?.['children']
  return Array.isArray(lineKids) ? (lineKids as ReactNode[]) : []
}

/**
 * 一行动作区里「辅助标签」与「官方 Switch」的下标（两套外壳共用同一套判定）。
 * 顺序锁的语义是「辅助动作严格排在 Switch 左侧」——`switch` 必须大于 `tag`。
 */
function actionOrder(children: readonly ReactNode[]): { readonly tag: number; readonly switch: number } {
  return {
    tag: children.findIndex(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-tag'] !== undefined),
    switch: children.findIndex(child => isValidElement(child) && child.type === (Switch as unknown)),
  }
}

/** 收集 `className` 命中的元素 props（按空格分隔的类名之一匹配），用于锁两行卡片结构。 */
function collectByClassName(node: ReactNode, name: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByClassName(child, name, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const className = props['className']
  if (typeof className === 'string' && className.split(/\s+/).includes(name)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByClassName(rendered as ReactNode, name, acc)
  }
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
