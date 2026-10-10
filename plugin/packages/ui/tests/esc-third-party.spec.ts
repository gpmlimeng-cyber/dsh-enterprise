/**
 * [INPUT]: 依赖 `esc-third-party.ts`（纯事实层：四态投影 / 按根分组 / 行投影 / 按钮终态）、
 *   `esc-third-party-install.ts`（一次一条的安装执行器）、`esc-third-party-list.tsx`（呈现层）、
 *   `esc-toolbar.tsx`（维度行与分类行）、`esc-categories.ts` 的分类集合判据，以及
 *   `skill-api-decode.ts` 的严格解码器与 `local-api.ts`/`esc-api.ts` 的两条新路由
 * [OUTPUT]: 锁定**口径 62**（本地三方 Agent 技能源）的界面半边：① 维度行**恰好四枚**且逐字（含顺序；
 *   ★口径 53 按**新裁决**把它从三枚重新基线化为四枚，见那一条用例里那段理由）
 *   + 本维度**分类胶囊行不渲染**；② 四态互斥 + **两句不同的"为什么空"** + 失败态**真重发**（请求计数取证）；
 *   ★★**本刀（版面精简 + 空来源不显示）**新增四组锁：⑦ **可见来源三句判据逐条归因**
 *   （`present` / `count` / `aliasOf` 各自单独动一个字段都必须翻脸，且那一把尺子贯穿 chip / 可见来源 /
 *   组标题**三处逐字相等**）；⑧ **"不许丢候选"的等式锁**（可见来源技能数之和 = 可见候选条数，
 *   且判据**直接引** `enterpriseThirdPartyVisibleRoots`、不另写一遍 `.filter`）；⑨ **丢弃计数按所有根求和**
 *   （含别名根与空来源；且**为 0 时那一句整个属性不出现**）；⑩ **页面级大标题的源码级反向锁**
 *   （判「那一格文案真源 / 那一枚再出口 / 那两枚渲染类名**都已不存在**」，**不是**判那句字面量消失——
 *   它必须活在标签的悬浮说明里，拿字面量当靶会连活的一起杀）；⑪ 改前那一族**死句子**全 `src` 一个字节不剩
 *   （剥掉块注释与行注释后逐句判）；
 *   ③ 行投影三态（只有 `available` 才画【安装】；另两态各有可见原因）；④ **`path` 只来自上次响应**
 *   （纯投影里没有拼路径的地方 + 源码级反锁：相关文件里不出现宿主路径构造）；⑤ **一次一条在途**
 *   （第二条被拒且给出可见原因）；⑥ 新码入表 + 两条新路由的同源路径与委托形状
 * [POS]: 口径 62 界面半边的机械门禁——把"哪一维、画什么、谁能点、为什么不能点、空是哪一种空、
 *   在途能不能再点"钉在**纯函数与源码**两层，页面只消费（本文件不碰 React 渲染、不碰 DOM、不碰 fetch 之外的运行时）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主的共享实例），而 `0.1.5-rc.2` 那份 devDependency
 * 的 `Button` 在**导入期**就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接把呈现层 import 进来会
 * 在"收集测试"阶段就炸。与 `tests/feedback-dialog.spec.ts` 同一条手法：把这一面**替身化**
 * ——本文件要测的是我们自己的**投影与结构**（`Button` 收到哪些 props），不是官方原语自己的渲染。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: 'button',
  Pill: 'button',
  Input: 'input',
  // ★**本刀收尾（②本地三方换成与广场同一张卡）**：本文件现在要**直调卡片内层那一枚**
  //   （`EnterpriseEscCardView`，本仓无 DOM）来核"禁用必带**行上可见**原因"，
  //   故替身里必须把卡片会读到的那几枚原语也给全（`esc-card.tsx` 在模块层取 `Button`/`Switch`；
  //   `official-ui.ts` 另取 Menu/MenuItemButton 与四枚图标，见下面那几行）。
  Switch: 'span',
  Tag: 'span',
  Modal: 'div',
  // `official-ui.ts` 在**模块求值**时就把这几枚取出来（`official.Menu` / `official.MenuItemButton` /
  // 四枚图标），故替身里必须给它们一个值（字符串只是占位：本文件不断言菜单与图标的渲染）。
  Menu: 'div',
  MenuItemButton: 'button',
  IconEllipsisOutlineMedium: 'span',
  IconSettingsOutlineMedium: 'span',
  IconUserOutlineMedium: 'span',
  IconLoadingOutlineMedium: 'span',
}))

import {
  ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY,
  ENTERPRISE_THIRD_PARTY_BUSY_SUFFIX,
  ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE,
  ENTERPRISE_THIRD_PARTY_DIRECTORY_PREFIX,
  ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL,
  ENTERPRISE_THIRD_PARTY_EMPTY_NO_SOURCE,
  ENTERPRISE_THIRD_PARTY_INSTALL,
  ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE,
  ENTERPRISE_THIRD_PARTY_INSTALLING,
  ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED,
  ENTERPRISE_THIRD_PARTY_LOADING,
  ENTERPRISE_THIRD_PARTY_REFRESH,
  ENTERPRISE_THIRD_PARTY_REFRESH_LABEL,
  ENTERPRISE_THIRD_PARTY_STATE_AVAILABLE,
  ENTERPRISE_THIRD_PARTY_STATE_CONFLICT,
  ENTERPRISE_THIRD_PARTY_STATE_INSTALLED,
  enterpriseThirdPartyActionPlan,
  enterpriseThirdPartyCountText,
  enterpriseThirdPartyFace,
  enterpriseThirdPartyInstalledText,
  enterpriseThirdPartyInstallingText,
  enterpriseThirdPartyRootGroups,
  enterpriseThirdPartyRootLabel,
  enterpriseThirdPartyRootVisible,
  enterpriseThirdPartyVisibleRoots,
  enterpriseThirdPartyVisibleSkills,
  enterpriseThirdPartyCardInstall,
  enterpriseThirdPartyCardItem,
  enterpriseThirdPartySkillRow,
  enterpriseThirdPartySkippedCount,
  enterpriseThirdPartySubChips,
} from '../src/esc/esc-third-party.js'
import { enterpriseEscSubTabFilter, enterpriseEscSubTabs } from '../src/esc/esc-sub-tabs.js'
import { createEnterpriseThirdPartyInstaller } from '../src/esc/esc-third-party-install.js'
import { EnterpriseEscThirdPartyList } from '../src/esc/esc-third-party-list.js'
import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { EnterpriseEscToolbar } from '../src/esc/esc-toolbar.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
import { ENTERPRISE_LIST_RETRY } from '../src/list-state.js'
import { decodeEnterpriseThirdPartySkills, decodeEnterpriseThirdPartySkills as decodeThirdParty } from '../src/skill-api-decode.js'
import { ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH, ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH, createEnterpriseLocalApi } from '../src/local-api.js'
import { createEnterpriseEscApi } from '../src/esc/esc-api.js'
import { createEnterpriseListSource } from '../src/list-state.js'
import type { EnterpriseThirdPartyRoot, EnterpriseThirdPartySkill, EnterpriseThirdPartySkills } from '../src/skill-api-decode.js'

/* ══════════════ 测试夹具 ══════════════ */

type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
const asElement = (node: unknown) => node as Element
const childrenOf = (element: Element): unknown[] => {
  const children = element.props['children']
  return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
}
/** 在整棵投影树里按类名找第一处（与 `esc.spec.ts` 同一条手法：判据是类名，不是第几层）。 */
function findByClass(node: unknown, className: string): Element | undefined {
  return walk(node).find(each => each.props['className'] === className)
}
/** 与 `findByClass` 同一件事的短名（工具栏那一组用例里出现得太密）。 */
const byClass = findByClass
function walk(node: unknown, out: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const each of node) walk(each, out)
    return out
  }
  if (node === null || node === undefined || node === false) return out
  if (typeof node !== 'object') return out
  const element = node as Element
  out.push(element)
  return walk(element.props['children'], out)
}

/**
 * ★**本刀收尾（②本地三方换成与广场同一张卡）**：两枚取证入口 —— 本仓**无 DOM**，而卡片是
 * 组件（列表把 props 交出来之后，卡片内部那一棵树不在 `walk` 的射程里）⇒ 分两步取证：
 *   ① `cardsOf` 读**列表交给卡片的那一份 props**（"这一枚卡片拿到什么"的判据）；
 *   ② `renderCard` 拿那一份 props **直调卡片内层** `EnterpriseEscCardView`（与既有已安装页那几条
 *      同一条手法）⇒ 卡片内部那枚圆形【＋】与**行上可见**的禁用原因照样可机械判据。
 */
const cardsOf = (tree: unknown): Element[] => walk(tree).filter(each => each.type === EnterpriseEscCard)
/** 一枚卡片元素 → 它内部渲染出来的树（纯函数直调走**内层**那一枚，`memo` 的产物是对象）。 */
const renderCard = (card: Element): Element =>
  asElement(EnterpriseEscCardView(card.props as never))
/** 一格（本刀起「本地三方」的卡片住在广场那一枚格子 `.esc-catalog-cell` 里）。 */
const cellsOf = (tree: unknown): Element[] =>
  walk(tree).filter(each => typeof each.props['data-enterprise-third-party-skill'] === 'string')

const ROOT: EnterpriseThirdPartyRoot = { id: 'claude-code', name: 'Claude Code', present: true, count: 1, skipped: 0 }
/** 一枚**没被检测到**的根（`present:false`）——口径 62 要求它照旧成组并显示「未检测到」。 */
const ABSENT_ROOT: EnterpriseThirdPartyRoot = { id: 'codex', name: 'Codex', present: false, count: 0, skipped: 0 }

function skill(overrides: Partial<EnterpriseThirdPartySkill> = {}): EnterpriseThirdPartySkill {
  return {
    id: `sha256-${overrides.name ?? 'code-review'}`.slice(0, 16),
    name: 'code-review',
    rootId: 'claude-code',
    sourceName: 'Claude Code',
    directory: 'code-review',
    status: 'available',
    ...overrides,
  }
}

function value(roots: readonly EnterpriseThirdPartyRoot[], skills: readonly EnterpriseThirdPartySkill[]): EnterpriseThirdPartySkills {
  return { roots, skills }
}

/** 造一份**计数自洽**的扫描真值（解码层要求每根 `count` 与条数逐字相等）。 */
function selfConsistent(roots: readonly EnterpriseThirdPartyRoot[], skills: readonly EnterpriseThirdPartySkill[]): EnterpriseThirdPartySkills {
  return {
    // ★只重算 `count`（候选条数）；`skipped` **原样保留**（它是"过不了闸门的目录数"，与候选清单无关）。
    roots: roots.map(root => ({ ...root, count: skills.filter(each => each.rootId === root.id).length })),
    skills,
  }
}

/* ══════════════ ① 维度行 ══════════════ */

describe('口径 62/本刀 ③：技能页维度行恰好四枚（系统广场 / 团队空间 / 本地三方 / SkillHub）', () => {
  it('技能页逐字且按序四枚；专家页两枚；连接器页第三枚仍是「已连接的」', () => {
    const labelsOf = (resourceType: 'expert' | 'skill' | 'connector', source = 'system') => {
      const toolbar = asElement(EnterpriseEscToolbar({
        resourceType,
        source,
        onSourceChange: () => undefined,
        categories: [],
        activeCategory: '',
        onCategoryChange: () => undefined,
        keyword: '',
        onKeywordChange: () => undefined,
      } as never))
      const row = findByClass(toolbar, 'esc-source-tabs')
      expect(row, `维度行（${resourceType}）`).toBeTruthy()
      return childrenOf(row as Element).map(node => asElement(node).props['children'])
    }
    /**
     * ★**本刀收尾重新基线化**（用户裁决：第四枚的名字与来源都换）：第四个字符串由「企业技能」
     *   换成 `SkillHub`。★**不是把口径 55/62/53 那把锁放宽**：判据形状一字未改（`toEqual` 逐字
     *   + 顺序 + `toHaveLength(4)`），数量与前三枚的位次也一字未动 —— 换的只是第四枚的名字与它
     *   背后的数据面（企业中心目录 → 既有的在线搜索本机路由）。
     *   ★「企业技能」**维度整枚撤掉**：它的内容不丢（「应用商店 → 企业技能」与企业设置两处照旧）。
     */
    expect(labelsOf('skill')).toEqual(['系统广场', '团队空间', '本地三方', 'SkillHub'])
    expect(labelsOf('skill')).toHaveLength(4)
    expect(ENTERPRISE_ESC_COPY.mainTabThirdParty).toBe('本地三方')
    expect(ENTERPRISE_ESC_COPY.mainTabSkillHub).toBe('SkillHub')
    // ★回归：专家页仍是两枚、连接器页第三枚仍是「已连接的」（两处一字未动）。
    expect(labelsOf('expert')).toEqual(['系统广场', '团队空间'])
    expect(labelsOf('connector')).toEqual(['系统广场', '团队空间', '已连接的'])
    // ★反向锁：这两枚页专属维度**都不许**出现在专家页/连接器页。
    for (const other of ['expert', 'connector'] as const) {
      expect(labelsOf(other), other).not.toContain('本地三方')
      expect(labelsOf(other), other).not.toContain('SkillHub')
      // ★本刀收尾加强：撤掉的那一枚也不许回来。
      expect(labelsOf(other), other).not.toContain('企业技能')
    }
  })

  it('第三、四枚各自带悬浮说明（完整说法在里面）；前两枚不带', () => {
    const toolbar = asElement(EnterpriseEscToolbar({
      resourceType: 'skill',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
    } as never))
    const pills = childrenOf(findByClass(toolbar, 'esc-source-tabs') as Element)
    const titleOf = (index: number) => asElement(pills[index]).props['title']
    // 「本地三方」四个字读不出是什么 ⇒ 完整说法「本地三方 Agent 技能源」必须挂在它的**标签悬浮说明**里。
    expect(titleOf(2)).toBe(ENTERPRISE_ESC_LOCAL_COPY.thirdPartyTabTitle)
    // ★**本刀（版面精简）**：完整说法的唯一真源只剩标签悬浮说明这一处（页内大标题那一格文案连同
    //   它的容器已整族删除，见 `esc-copy.ts` 那段）⇒ 判据从"引那枚常量"改成"句中必须逐字含完整说法"。
    //   ★这是**加强**（原来只断言"含常量"，没断言那句完整说法真的在字面上）而不是放宽：常量本身已删，
    //   判据必须落到**它保证的那件事**上——四字标签的悬浮说明读得出它是"本地三方 Agent 技能源"。
    expect(String(titleOf(2))).toContain('本地三方 Agent 技能源')
    // ★反向锁：删掉的是**页内**那一份大标题，**标签悬浮说明必须还在**（四字标签读不出"扫的是谁的库"）。
    expect(String(titleOf(2))).toContain('扫本机其它 Agent CLI 的技能库')
    // ★本刀 ③：第四枚换成 `SkillHub` 之后同判（一个英文专名更读不出"从哪来、装什么"）——
    //   完整说法与页内说明句同源（同一个常量）。
    expect(titleOf(3)).toBe(ENTERPRISE_ESC_LOCAL_COPY.skillHubTabTitle)
    expect(String(titleOf(3))).toContain(ENTERPRISE_ESC_LOCAL_COPY.skillHubSourceTitle)
    expect(titleOf(2)).not.toBe(titleOf(3))
    // ★判据：**只有**这两枚带 title（前两枚的四个字已经说全了，凭空多一句会毁掉"哪一枚需要看说明"的信号）。
    expect(titleOf(0)).toBeUndefined()
    expect(titleOf(1)).toBeUndefined()
    expect(pills).toHaveLength(4)
  })

  it('★二级 chip 行**数据驱动**：`subTabs` 在场时画它，缺席时逐字回到后端分类那一支', () => {
    const toolbarOf = (extra: Record<string, unknown>) => asElement(EnterpriseEscToolbar({
      resourceType: 'skill',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [
        { key: '', label: '全部' },
        { key: 'Agent', label: 'Agent' },
      ],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
      ...extra,
    } as never))
    // ① 缺席 ⇒ 逐字是后端分类那一支（本刀没有顺手改掉老行为）。
    const backend = toolbarOf({})
    expect(childrenOf(byClass(backend, 'esc-category-tabs')).map(node => asElement(node).props['children']))
      .toEqual(['全部', 'Agent'])
    // ② 在场 ⇒ 画的是**它**（数据驱动的 chip），后端那三枚一枚都不出现。
    const dataDriven = toolbarOf({
      subTabs: {
        chips: [
          { key: '', label: '全部' },
          { key: 'workbuddy', label: 'WorkBuddy' },
          { key: 'codex', label: 'Codex' },
        ],
        activeKey: 'codex',
        onSelect: () => undefined,
      },
    })
    const row = byClass(dataDriven, 'esc-category-tabs')
    expect(childrenOf(row).map(node => asElement(node).props['children'])).toEqual(['全部', 'WorkBuddy', 'Codex'])
    expect(childrenOf(row).map(node => asElement(node).props['children'])).not.toContain('Agent')
    // ★选中态与既有那排同一个视觉语言：同一个类名 + `data-esc-selected`，只多一枚取证钩子。
    expect(childrenOf(row).map(node => asElement(node).props['className'])).toEqual(['esc-pill', 'esc-pill', 'esc-pill'])
    expect(childrenOf(row).map(node => asElement(node).props['data-esc-selected'])).toEqual([false, false, true])
    expect(childrenOf(row).map(node => asElement(node).props['data-esc-subtab'])).toEqual(['', 'workbuddy', 'codex'])
    // ③ 数据驱动这一支下，"分类暂时读不到"那句**不画**（它指向的筛选器根本不在这一维度里）。
    expect(byClass(toolbarOf({
      categoriesUnavailable: true,
      subTabs: { chips: [{ key: '', label: '全部' }], activeKey: '', onSelect: () => undefined },
    }), 'esc-toolbar-note')).toBeUndefined()
    // 反向锁：后端那一支下那句照旧画（本刀没有把它一并关掉）。
    expect(byClass(toolbarOf({ categoriesUnavailable: true }), 'esc-toolbar-note')).toBeTruthy()
  })

  it('★chip 行由真响应投影：只有「有技能 + 不是别名 + 检测到」的根出 chip；含「全部」', () => {
    const roots: EnterpriseThirdPartyRoot[] = [
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 2, skipped: 3 },
      { id: 'codex', name: 'Codex', present: false, count: 0, skipped: 0 },
      // 别名根（`~/.qwen/skills` → `~/.agents/skills`）：**不出 chip**（否则同一批技能几十枚 chip）。
      { id: 'agents-xdg', name: 'Agent Skills', present: true, count: 1, skipped: 0, aliasOf: 'agents' },
      { id: 'agents', name: 'Agent Skills', present: true, count: 1, skipped: 0 },
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 0 },
    ]
    const skills = [
      skill({ id: 'id-w1', name: 'w-one', rootId: 'workbuddy' }),
      skill({ id: 'id-w2', name: 'w-two', rootId: 'workbuddy' }),
      skill({ id: 'id-a1', name: 'a-one', rootId: 'agents' }),
      skill({ id: 'id-alias', name: 'a-one-alias', rootId: 'agents-xdg' }),
    ]
    const chips = enterpriseThirdPartySubChips(selfConsistent(roots, skills))
    // 逐字与顺序都取自响应（界面不写死清单、也不消费后端目录那套分类）。
    expect(chips).toEqual([
      { key: 'workbuddy', label: 'WorkBuddy' },
      { key: 'agents', label: 'Agent Skills' },
    ])
    // 三件被排除的事实各自都在（0 枚 / 未检测到 / 别名）——用反向断言钉住。
    expect(chips.map(each => each.key)).not.toContain('qoder')
    expect(chips.map(each => each.key)).not.toContain('codex')
    expect(chips.map(each => each.key)).not.toContain('agents-xdg')
    // 「全部」由通用机制统一加（各维度不各写一份）。
    const projected = enterpriseEscSubTabs({ chips, activeKey: 'agents' })
    expect(projected.chips.map(each => each.label)).toEqual(['全部', 'WorkBuddy', 'Agent Skills'])
    expect(projected.activeKey).toBe('agents')
    // ★选中的那枚**已经不在**这一排里 ⇒ 回落「全部」（不许留一个看不见的 key 继续筛）。
    expect(enterpriseEscSubTabs({ chips, activeKey: 'agents-xdg' }).activeKey).toBe('')
    // 过滤：选「全部」原样返回（连数组都不重建），选某枚只留它那一根。
    expect(enterpriseEscSubTabFilter(skills, '', each => each.rootId)).toBe(skills)
    expect(enterpriseEscSubTabFilter(skills, 'workbuddy', each => each.rootId).map(each => each.name))
      .toEqual(['w-one', 'w-two'])
    /**
     * ★**本刀（版面精简）**：那句统计横幅「已检测到 N 个技能源，其中 M 个有技能，另有 K 个目录不符合
     *   技能规范。」**整族删除**（用户截图②：不要出现除卡片外其他冗余描述）。但**如实丢弃计数 K 绝不
     *   静默吞掉** ⇒ 它挪进「重新扫描」的**悬浮说明**。这一条锁的是那枚数本身。
     * ★**按「所有根」求和**（本刀裁决，含别名根与空来源）：这个数解释的是「**整个本机三方扫描里
     *   有多少目录被挡在门外**」，与「界面上显示哪些来源」是**两件不同的事**。「空来源不显示」管的是
     *   **来源**，不是**事实** ⇒ 若把空来源的丢弃数一起吞掉，「我在 Codex 里明明有技能却没出现」
     *   零解释。`workbuddy` 那 3 枚必须一个不少。
     */
    expect(enterpriseThirdPartySkippedCount(selfConsistent(roots, skills))).toBe(3)
    // ★**别名根与空来源的 skipped 一样要进**（同一把尺子，不许对它们例外）：
    //   `agents` 2 枚 + `agents-xdg`（别名归并、整枚不显示）9 枚 = **11**，一个字节都不许少。
    expect(enterpriseThirdPartySkippedCount(selfConsistent([
      { id: 'agents', name: 'Agent Skills', present: true, count: 1, skipped: 2 },
      { id: 'agents-xdg', name: 'Agent Skills', present: true, count: 0, skipped: 9, aliasOf: 'agents' },
    ], [skill({ rootId: 'agents' })]))).toBe(11)
    // ★**全是空来源**时，计数**照旧报真实的那几枚**（`qoder` 4 + `codex` 7 = **11**）——
    //   这正是本刀裁决要守住的那一档：界面上**一枚来源都不显示**，但"有多少目录被挡在门外"
    //   **一个字都不许少**。若这里回退成 0，「我在 Codex 里明明有技能却没出现」就真的零解释了。
    expect(enterpriseThirdPartySkippedCount(selfConsistent([
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 0, skipped: 0 },
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 4 },
      { id: 'codex', name: 'Codex', present: false, count: 0, skipped: 7 },
    ], []))).toBe(11)
    // ★K === 0（**所有**根都没有丢弃）⇒ 那个数就是 0（页面据此**整句不出**悬浮说明，不写"没有丢弃"）。
    expect(enterpriseThirdPartySkippedCount(selfConsistent([
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 0, skipped: 0 },
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 0 },
    ], []))).toBe(0)
  })

  it('★**空来源整枚不显示**（`count===0` 与 `aliasOf` 两种在场都不出芯片、不进"可见来源"、不出组标题）', () => {
    const roots: EnterpriseThirdPartyRoot[] = [
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 2, skipped: 3 },
      // 三种"空来源"形态同时在场：`count===0` 在场 / 别名归并（`aliasOf`）/ 未检测到。
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 4 },
      { id: 'codex', name: 'Cursor', present: false, count: 0, skipped: 0 },
      { id: 'agents-xdg', name: 'Agent Skills', present: true, count: 0, skipped: 9, aliasOf: 'agents' },
      { id: 'agents', name: 'Agent Skills', present: true, count: 1, skipped: 0 },
      // ★★**第四种形态（本刀新锁的那一类）：`present:false` 却带着候选**。
      //   `present` 答的是「这个位置真的能被读成目录清单」、`count` 答的是「里面有几枚」——**两件不同的事**，
      //   而本仓解码层（`skill-api-decode.ts`）**只逐键校验 `present` 是布尔、只逐条校验 `count` 与候选条数相等，
      //   两条纪律之间没有任何耦合** ⇒ 这枚形状会**原样通过**解码。
      //   ★正因如此它**绝不能**被当成"有技能的可见来源"：界面会报出一个**位置根本不存在**的来源。
      { id: 'ghost', name: 'Ghost Skills', present: false, count: 1, skipped: 0 },
    ]
    const skills = [
      skill({ id: 'id-w1', name: 'w-one', rootId: 'workbuddy' }),
      skill({ id: 'id-w2', name: 'w-two', rootId: 'workbuddy' }),
      skill({ id: 'id-a1', name: 'a-one', rootId: 'agents' }),
      skill({ id: 'id-g1', name: 'g-one', rootId: 'ghost' }),
    ]
    const scan = selfConsistent(roots, skills)
    // ① 唯一判据：四种空来源形态**逐个**都判假（这是"芯片 / 组标题 / 计数"三处共用的那一把尺子）。
    for (const id of ['qoder', 'codex', 'agents-xdg', 'ghost']) {
      expect(enterpriseThirdPartyRootVisible(roots.find(each => each.id === id)!), id).toBe(false)
    }
    expect(enterpriseThirdPartyRootVisible(roots.find(each => each.id === 'workbuddy')!)).toBe(true)
    // ★**逐字段归因**（比"整枚判假"更强：证明是**哪一句**在挡它，别让人靠删掉一个判据蒙过去）：
    //   同一个根，每次只动**一个**字段，逐个证明三句判据**各自独立生效**、缺一不可。
    const base = { id: 'probe', name: 'Probe', present: true, count: 1, skipped: 0 }
    expect(enterpriseThirdPartyRootVisible(base)).toBe(true)
    // ① `present` 那一句：改成 `false` ⇒ 即便带着 1 枚候选也判假（"位置不在"不许当筛选项）。
    expect(enterpriseThirdPartyRootVisible({ ...base, present: false })).toBe(false)
    // ② `count` 那一句：改成 0 ⇒ 判假（扫到了、里面没东西）。
    expect(enterpriseThirdPartyRootVisible({ ...base, count: 0 })).toBe(false)
    // ③ `aliasOf` 那一句：加上别名 ⇒ 判假（同一份库不许铺成两组）。
    expect(enterpriseThirdPartyRootVisible({ ...base, aliasOf: 'probe-real' })).toBe(false)
    // ② 芯片行只有两枚（空来源一枚都不出，含那枚"带候选的幽灵来源"）；③ 组标题同理，只有两枚组。
    expect(enterpriseThirdPartySubChips(scan).map(each => each.key)).toEqual(['workbuddy', 'agents'])
    expect(enterpriseThirdPartySubChips(scan).map(each => each.key)).not.toContain('ghost')
    const groups = enterpriseThirdPartyRootGroups(scan)
    expect(groups.map(each => each.root.id)).toEqual(['workbuddy', 'agents'])
    // ★**同一把尺子贯穿三处**（芯片 / 可见来源 / 组标题）——三处**逐字等于**那唯一一枚判据的输出。
    expect(enterpriseThirdPartySubChips(scan).map(each => each.key))
      .toEqual(enterpriseThirdPartyVisibleRoots(scan).map(each => each.id))
    expect(groups.map(each => each.root.id)).toEqual(enterpriseThirdPartyVisibleRoots(scan).map(each => each.id))
    // ④ **每一组恒有候选、恒不缺席**（"组标题 + 一句空话"那种形态本刀起不可达）。
    for (const group of groups) {
      expect(group.skills.length, group.root.id).toBeGreaterThan(0)
      expect(group.absent, group.root.id).toBe(false)
      expect('emptyNote' in group, group.root.id).toBe(false)
    }
    // ★反向锁：组标题那一带**不许**再出现「未检测到」签或任何"这个位置…"的句子（它们恒为不可达）。
    const tree = EnterpriseEscThirdPartyList({ state: { kind: 'ready', value: scan }, onReload: () => undefined })
    const heads = walk(tree).filter(each => String(each.props['className']) === 'esc-third-party-grouphead')
    expect(heads).toHaveLength(2)
    for (const head of heads) {
      // 组标题**只留**「来源名 + N 枚技能」一行（两件：根名 + 计数），不许有第三件东西。
      expect(childrenOf(head)).toHaveLength(2)
      expect(walk(head).filter(each => String(each.props['className']) === 'esc-third-party-grouptag')).toHaveLength(0)
      expect(walk(head).filter(each => String(each.props['className']) === 'esc-third-party-rootnote')).toHaveLength(0)
      expect(walk(head).map(each => String(each.props['children'])).join('')).not.toContain('未检测到')
    }
    // ★反向锁：改前那四件**死句子**，全 `src` 里一个字节都不许剩（源码级反向锁）。
    //   ① 页内说明句 · ② 统计横幅 · ③④ 针对**单个**空来源的那三句（用户截图③）。
    // ★**靶心取"整句里只有死掉的那一处才有"的片段**：不能拿"源目录不动"当靶 —— 它同时在**活着**的
    //   【＋】悬浮说明（`ENTERPRISE_THIRD_PARTY_INSTALL_TITLE`）里，那一句本刀**必须留着**
    //   （"复制"这件事不许因为删页内说明句而没人说了）。
    const dead = [
      '这里列出本机其它 Agent CLI 技能库里的技能',
      '已检测到 12 个技能源',
      '已检测到 3 个技能源',
      '个技能源，其中',
      '个有技能',
      // ★丢弃计数**不在这里当靶**：横幅那句与 title 那句**都以「个目录不符合技能规范。」收尾**
      //   ⇒ 这个片段区分不了「已删的横幅」与「活着的 title」（第一版锁就栽在这，跑红）。
      //   横幅的**判别靶**是上面三条（已检测到 N 个技能源 / 个技能源，其中 / 个有技能）✓
      //   而「计数确实挪进了 title」由下一条用例正面断言（逐字比对 title 文本）—— 一正一反，互不越界。
      '这个位置没有检测到技能源',
      '这个位置里没有技能',
      '其它来源里有',
      // ★**页面级大标题不在这族"字面量靶"里**（第二版锁就栽在这，跑红）：完整说法「本地三方 Agent 技能源」
      //   **必须**留在**标签的悬浮说明**（`thirdPartyTabTitle`，四字标签读不出它扫的是谁的库 —— 那是本刀
      //   刻意留下的活句子），拿字面量当靶会连活的一起杀。⇒ 大标题改用**下面那条源码级反向锁**判：
      //   「那一格文案**真源**已不在 `esc-copy.ts`」+「那一维度的**导出常量**全仓已不存在」。
      //   一正一反，与上面那三条横幅靶互不越界。
    ]
    // ★**④ 页面级大标题的源码级反向锁**（判"**定义与导出**已消失"，不是判那句字面量消失）：
    //   ① `esc-copy.ts` 里那一格文案真源 `thirdPartySourceTitle` **不存在**（活着的 `thirdPartyTabTitle` 不受影响）；
    //   ② 全 `src` 里 `ENTERPRISE_THIRD_PARTY_SOURCE_TITLE`（本仓曾把它当再出口的那枚）**一个都不许剩**；
    //   ③ 三枚渲染它的类名 `.esc-third-party-head` / `.esc-third-party-title` 在 `esc-style.ts` 里**一个都不许剩**。
    //   ★**为什么必须盯"定义与导出"而不是"字面量"**：那句话本身还要活在标签悬浮说明里，
    //   唯一能证明"页内大标题整条删掉了"的，是**那一格真源与那一枚再出口在源码里已经不存在**。
    for (const name of ['../src/esc/esc-third-party.ts', '../src/esc/esc-third-party-list.tsx', '../src/esc/esc-copy.ts', '../src/esc/esc-style.ts']) {
      const raw = readFileSync(new URL(name, import.meta.url), 'utf8')
      // 剥掉块注释：这一族句子在注释里被**指名解释为什么删**是允许的，代码里出现才是问题。
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => {
        const at = line.indexOf('//')
        return at === -1 ? line : line.slice(0, at)
      }).join('\n')
      for (const sentence of dead) {
        expect(code, `${name} 不许剩死句「${sentence}」`).not.toContain(sentence)
      }
      // ★同一份剥注释后的源码，另跑下面那族"**定义/导出/规则**已消失"的判据。
      //   （大标题那一格真源 `thirdPartySourceTitle` 只能在 `esc-copy.ts` 判，其余三枚全 `src` 判。）
      expect(code, `${name} 不许剩大标题真源 thirdPartySourceTitle`).not.toContain('thirdPartySourceTitle')
      expect(code, `${name} 不许剩大标题再出口 ENTERPRISE_THIRD_PARTY_SOURCE_TITLE`).not.toContain('ENTERPRISE_THIRD_PARTY_SOURCE_TITLE')
      for (const className of ['esc-third-party-head', 'esc-third-party-title']) {
        expect(code, `${name} 不许剩大标题那一族死规则「${className}」`).not.toContain(className)
      }
    }
    // ★**反向锁（不许因为删了大标题把标签悬浮说明一起删掉）**：那一格**活着的**文案真源必须还在，
    //   且它**读得出**完整说法与"从哪来"（四字标签读不出扫的是谁的库）。
    expect('thirdPartyTabTitle' in ENTERPRISE_ESC_LOCAL_COPY).toBe(true)
    expect(String(ENTERPRISE_ESC_LOCAL_COPY.thirdPartyTabTitle)).toContain('本地三方 Agent 技能源')
    expect(String(ENTERPRISE_ESC_LOCAL_COPY.thirdPartyTabTitle)).toContain('扫本机其它 Agent CLI 的技能库')
    // ★**别的维度一个字不许动**（本刀只删「本地三方」这一维的用法与定义）：另外两枚完整说法照旧在册。
    expect(String(ENTERPRISE_ESC_LOCAL_COPY.catalogSourceTitle)).toBe('企业技能目录')
    expect(String(ENTERPRISE_ESC_LOCAL_COPY.skillHubSourceTitle)).toContain('SkillHub')
    // ★**键集逐字钉死**（比"某几个键不在"更强）：这一维度的文案真源**恰好**只剩这两枚
    //   ——`thirdPartySourceTitle` 若被偷偷加回来，键数会变成 3 而这里跑红。
    expect(Object.keys(ENTERPRISE_ESC_LOCAL_COPY).filter(key => key.toLowerCase().includes('thirdparty')))
      .toEqual(['thirdPartyTabTitle'])
  })

  it('★★**等式锁：可见来源的技能总数与"响应里所有非空来源的技能数之和"逐字相等**（隐藏的是来源，不是技能）', () => {
    // 本机真实形态：2 枚真源 + 一堆空来源/别名/未检测到，其中混进一枚**带技能的别名根**（形状变了也不许画两组）。
    const roots: EnterpriseThirdPartyRoot[] = [
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 41, skipped: 190 },
      { id: 'agents', name: 'Agent Skills', present: true, count: 7, skipped: 6 },
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 4 },
      { id: 'codex', name: 'Cursor', present: false, count: 0, skipped: 0 },
      { id: 'agents-xdg', name: 'Agent Skills', present: true, count: 3, skipped: 9, aliasOf: 'agents' },
      // ★**第三种"形状变了"的情形**：`present:false` 却带着 3 枚候选（解码层原样收，见 `enterpriseThirdPartyRootVisible`）。
      { id: 'ghost', name: 'Ghost Skills', present: false, count: 3, skipped: 0 },
    ]
    const skills = [
      ...Array.from({ length: 41 }, (_, i) => skill({ id: `w-${i}`, name: `w-${i}`, rootId: 'workbuddy' })),
      ...Array.from({ length: 7 }, (_, i) => skill({ id: `a-${i}`, name: `a-${i}`, rootId: 'agents' })),
      ...Array.from({ length: 3 }, (_, i) => skill({ id: `x-${i}`, name: `x-${i}`, rootId: 'agents-xdg' })),
      ...Array.from({ length: 3 }, (_, i) => skill({ id: `g-${i}`, name: `g-${i}`, rootId: 'ghost' })),
    ]
    const scan = selfConsistent(roots, skills)
    // 响应里一共 54 枚候选（41 + 7 + 3 别名 + 3 幽灵；后两组都在**这份清单**里）。
    expect(scan.skills).toHaveLength(54)
    // ★等式锁：可见来源（workbuddy + agents）的技能数之和 = 41 + 7 = 48，
    //   而**可见**的那一份候选逐字等于它 —— 滤空来源一枚都没滤掉。
    //   ★判据**直接引唯一那枚函数**（不另写一遍 `.filter(...)`）——两处判据迟早会漂，
    //   而这条等式锁的**全部价值**恰恰在于"它与那一枚是同一把尺子"。
    const expected = enterpriseThirdPartyVisibleRoots(scan).reduce((sum, root) => sum + root.count, 0)
    expect(expected).toBe(48)
    // ★**带候选的别名根那一组也不许出现在界面上**（同一份库不许铺成两组）。
    expect(enterpriseThirdPartyVisibleSkills(scan).map(each => each.id)).not.toContain('x-0')
    // ★**带候选的"位置不存在"那一组同样不许出现**（界面不许报出一个根本不存在的来源）。
    expect(enterpriseThirdPartyVisibleSkills(scan).map(each => each.id)).not.toContain('g-0')
    expect(enterpriseThirdPartyVisibleRoots(scan).map(each => each.id)).toEqual(['workbuddy', 'agents'])
    expect(enterpriseThirdPartyVisibleSkills(scan)).toHaveLength(expected)
    // ★**呈现层同一条等式**：树上那几枚卡片的 id 与"可见候选"逐字同序、一枚不多一枚不少。
    const tree = EnterpriseEscThirdPartyList({ state: { kind: 'ready', value: scan }, onReload: () => undefined })
    const rendered = cellsOf(tree).map(cell => String(cell.props['data-enterprise-third-party-skill']))
    expect(rendered).toEqual(enterpriseThirdPartyVisibleSkills(scan).map(each => each.id))
    expect(rendered).toHaveLength(expected)
    // ★而改前**这一枚真值**是 54（改前组标题全列、空来源只多出空话与标题，候选一枚不少）——
    //   ⇒ 本刀锁的不是"少了 6 枚技能"，锁的是"隐藏的是**来源**（分组/标题/芯片），不是候选"。
    //   空来源那两枚（qoder / codex）本来就 0 枚，滤掉它们对候选总数**零影响**，等式两侧都成立。
    expect(enterpriseThirdPartyVisibleSkills(scan).every(each => scan.skills.some(all => all.id === each.id))).toBe(true)
  })

  it('★**丢弃计数进「重新扫描」的悬浮说明**；为 0 时那句话**整句不出现**（不写"没有丢弃"）', () => {
    const refreshTitle = (scan: EnterpriseThirdPartySkills) => {
      const tree = EnterpriseEscThirdPartyList({ state: { kind: 'ready', value: scan }, onReload: () => undefined })
      const button = walk(tree).find(each => each.props['children'] === ENTERPRISE_THIRD_PARTY_REFRESH)!
      return button.props['title']
    }
    // ① 有丢弃：悬浮说明**逐字**报出那个数，且**行上版面一个字节都没多**（悬浮才看得到）。
    const withSkipped = selfConsistent([
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 1, skipped: 190 },
      { id: 'agents', name: 'Agent Skills', present: true, count: 1, skipped: 6 },
    ], [skill({ rootId: 'workbuddy' }), skill({ id: 'id-a1', name: 'a-one', rootId: 'agents' })])
    expect(refreshTitle(withSkipped)).toBe(`${ENTERPRISE_THIRD_PARTY_REFRESH_LABEL}：另有 196 个目录不符合技能规范。`)
    // ★版面判据：页内**没有**那一句（`data-enterprise-third-party-summary` / 那一族死类名一处都不许复现）。
    const tree = EnterpriseEscThirdPartyList({ state: { kind: 'ready', value: withSkipped }, onReload: () => undefined })
    expect(walk(tree).some(each => each.props['data-enterprise-third-party-summary'] !== undefined)).toBe(false)
    expect(walk(tree).some(each => String(each.props['className']).startsWith('esc-third-party-head'))).toBe(false)
    // ② 计数为 0 ⇒ `title` **整个属性不出现**（不是空串、也不是"没有丢弃"那句废话）。
    const none = selfConsistent([
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 1, skipped: 0 },
    ], [skill()])
    expect(refreshTitle(none)).toBeUndefined()
    // ③ ★**空来源那一枚的 skipped 要进**（本刀裁决）：它整枚不显示，但「那 190 个目录被挡在门外」是**事实**，
    //   吞掉它 = 「我在 Codex 里明明有技能却没出现」这件事零解释 ⇒ 计数按**所有根**求和。
    expect(refreshTitle(selfConsistent([
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 1, skipped: 0 },
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 190 },
    ], [skill()]))).toBe(`${ENTERPRISE_THIRD_PARTY_REFRESH_LABEL}：另有 190 个目录不符合技能规范。`)
    // ④ 空态那一枚「重新扫描」**照旧**给，且**同样**带悬浮说明（那一态恰是最需要再扫一次的时候）。
    const emptyTree = EnterpriseEscThirdPartyList({
      state: { kind: 'empty', value: selfConsistent([
        { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 0, skipped: 26 },
      ], []) },
      onReload: () => undefined,
    })
    expect(walk(emptyTree).some(each => each.props['children'] === ENTERPRISE_THIRD_PARTY_REFRESH)).toBe(true)
    expect(walk(emptyTree).find(each => each.props['children'] === ENTERPRISE_THIRD_PARTY_REFRESH)!.props['title'])
      .toBe(`${ENTERPRISE_THIRD_PARTY_REFRESH_LABEL}：另有 26 个目录不符合技能规范。`)
    // ★失败态那枚是「重试」，**刻意不挂**这一句（读不到时没有任何可信真值，给一个数就是编）。
    const failedTree = EnterpriseEscThirdPartyList({
      state: { kind: 'failed', code: 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE' }, onReload: () => undefined,
    })
    const retry = walk(failedTree).find(each => each.props['children'] === ENTERPRISE_LIST_RETRY)!
    expect(retry.props['title']).toBeUndefined()
  })

  it('★**页面级大标题整条删除**（与页签「本地三方」同一句话说两遍）：内容区第一件东西就是卡片/chip 行', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: value([ROOT], [skill()]) }, onReload: () => undefined,
    })
    // ① 大标题那三个容器/类名一个都不许再出现。
    for (const className of ['esc-third-party-head', 'esc-third-party-title', 'esc-third-party-note', 'esc-third-party-summary']) {
      expect(byClass(tree, className), className).toBeUndefined()
    }
    // ② 页内**不许**再出现那句完整说法（它只在标签悬浮说明里）。
    expect(walk(tree).map(each => String(each.props['children'])).join('|')).not.toContain('本地三方 Agent 技能源')
    // ★反向锁：那两件事**不许因为删句子被一起删掉**——「重新扫描」与二级 chip 行的宿主都在位
    //   （chip 行住在工具栏，由 `enterpriseThirdPartySubChips` 投影，见上面那条用例）。
    expect(walk(tree).some(each => each.props['children'] === ENTERPRISE_THIRD_PARTY_REFRESH)).toBe(true)
    expect(enterpriseThirdPartySubChips(value([ROOT], [skill()]))).toHaveLength(1)
    // ③ **没有空档**：删掉的那三块没有留下任何替身元素（内容区的直接子节点就是反馈行 / 四态块）。
    const root = asElement(tree)
    const kinds = childrenOf(root)
      .filter(node => node !== null)
      .map(node => asElement(node).props['data-enterprise-third-party-state'])
      .filter(Boolean)
    expect(kinds).toEqual(['ready'])
  })
})

/* ══════════════ ② 四态 ══════════════ */

describe('口径 62：四态互斥 + 两句不同的「为什么空」', () => {
  it('loading / failed / empty / ready 四态各自只命中一档（绝不出现"空又不加载又无错误"）', () => {
    const loading = enterpriseThirdPartyFace({ kind: 'loading' })
    expect(loading).toEqual({ kind: 'loading', groups: [] })
    const failed = enterpriseThirdPartyFace({ kind: 'failed', code: 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE' })
    expect(failed).toEqual({ kind: 'failed', failedCode: 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE', groups: [] })
    // ★失败态**绝不回落空列表**：没有 `emptyNote`、也没有任何"没检测到技能源"的说法
    //   （那是另一件事实，混起来就是撒谎——口径 62 明令）。
    expect(failed.emptyNote).toBeUndefined()
    for (const face of [loading, failed]) {
      expect(Object.keys(face)).not.toContain('emptyNote')
    }
    // 就绪：不补空话。
    const ready = enterpriseThirdPartyFace({ kind: 'ready', value: value([ROOT], [skill()]) })
    expect(ready.kind).toBe('ready')
    expect(ready.emptyNote).toBeUndefined()
    expect(ready.groups).toHaveLength(1)
    // 空：照旧铺真值（每个根那句空话）**另**补一句"为什么空"。
    const empty = enterpriseThirdPartyFace({ kind: 'empty', value: value([ROOT], []) })
    expect(empty.kind).toBe('empty')
    expect(empty.emptyNote).toBe(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL)
  })

  it('两句「为什么空」是两句不同的话，且按"有没有检测到根"选', () => {
    expect(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SOURCE).not.toBe(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL)
    // ① 一枚源都没检测到（`present:false` 的根不算"检测到"）。
    const noSource = enterpriseThirdPartyFace({ kind: 'empty', value: value([ABSENT_ROOT], []) })
    expect(noSource.noSource).toBe(true)
    expect(noSource.emptyNote).toBe(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SOURCE)
    // ② 检测到了源、但里面没有技能。
    const noSkill = enterpriseThirdPartyFace({ kind: 'empty', value: value([ROOT], []) })
    expect(noSkill.noSource).toBe(false)
    expect(noSkill.emptyNote).toBe(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL)
    // 两句的**指代**必须不同：一句说"源"，一句说"技能"。
    expect(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SOURCE).toContain('技能源')
    expect(ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL).not.toContain('未检测到任何')
  })

  it('按根分组：只按**可见**根成组、保序、组内保序；空来源整枚不出现（那一族三句已整族删除）', () => {
    const roots = [ROOT, ABSENT_ROOT]
    const skills = [skill({ id: 'id-b', name: 'b-skill' }), skill({ id: 'id-a', name: 'a-skill' })]
    const groups = enterpriseThirdPartyRootGroups(value(roots, skills))
    /**
     * ★**本刀（用户原话：「有技能就按他所在应用分组显示，没有的就不显示」）**：改前 `ABSENT_ROOT`
     *   （`present:false` / `count:0`）**照样成组**并配一句「这个位置没有检测到技能源。」——那正是用户
     *   截图③点名要删的那一行。判据从"全列"改成"只列 `enterpriseThirdPartyRootVisible` 判真的"。
     * ★**这条不是把断言放宽**：改前那条锁的是"未检测到的根仍在列表里"，而用户**明确否决**了那一条
     *   （「如果没有技能就不要显示来源了，DSH 默认过滤掉」）⇒ 旧期望值本身是本刀要撤的契约。
     *   新的锁**更强**：不只"不在"（反向断言），还逐条锁住它连同组标题、空话一起消失。
     */
    expect(groups.map(group => group.root.id)).toEqual(['claude-code'])
    // 组内保持 Host 给的顺序（界面不重排）。
    expect(groups[0]!.skills.map(each => each.name)).toEqual(['b-skill', 'a-skill'])
    // ★**每一组恒有候选、恒不缺席、恒没有 `emptyNote` 那一格**（三句"这个位置…"永不可达 ⇒ 一格字段也不留）。
    for (const group of groups) {
      expect(group.skills.length, group.root.id).toBeGreaterThan(0)
      expect(group.absent, group.root.id).toBe(false)
      expect(Object.keys(group)).not.toContain('emptyNote')
    }
    // 根标签：人话名优先，空名退到 id（不编、不留白）。
    expect(enterpriseThirdPartyRootLabel(ROOT)).toBe('Claude Code')
    expect(enterpriseThirdPartyRootLabel({ ...ROOT, name: '  ' })).toBe('claude-code')
    // 计数：零说「没有技能」，不说「0 枚」。（★**可见组恒 > 0**，那一档本刀起界面上不可达，
    //   但这枚纯函数仍逐字锁住它——它是**说明口径**不是**渲染分支**，删掉等于把口径也丢了。）
    expect(enterpriseThirdPartyCountText(0)).toBe('没有技能')
    expect(enterpriseThirdPartyCountText(3)).toBe('3 枚技能')
  })

  it('★失败态那枚重试**真重发**（请求计数取证），不是重画一下', async () => {
    let calls = 0
    let failFirst = true
    const source = createEnterpriseListSource<EnterpriseThirdPartySkills>({
      load: async () => {
        calls += 1
        if (failFirst) throw new Error('boom')
        return value([ROOT], [skill()])
      },
      isEmpty: each => each.skills.length === 0,
      errorCode: () => 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE',
    })
    source.load()
    await Promise.resolve()
    await Promise.resolve()
    expect(source.requests()).toBe(1)
    expect(source.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE' })
    expect(enterpriseThirdPartyFace(source.getSnapshot()).kind).toBe('failed')
    // 点那枚【重试】= 真的再发一条（计数 +1），且这次成功 ⇒ 就绪。
    failFirst = false
    source.retry()
    await Promise.resolve()
    await Promise.resolve()
    expect(source.requests()).toBe(2)
    expect(calls).toBe(2)
    expect(source.getSnapshot().kind).toBe('ready')
  })
})

/* ══════════════ ③ 行投影 ══════════════ */

describe('口径 62 / 本刀②：一条候选 → 一张**与广场同一张**卡（只有可装那一档那枚【＋】可点）', () => {
  it('三态各有中文；只有 available 可装，另两态各带一句**不同的**可见原因', () => {
    const available = enterpriseThirdPartySkillRow(skill({ status: 'available' }))
    expect(available.statusLabel).toBe(ENTERPRISE_THIRD_PARTY_STATE_AVAILABLE)
    expect(available.installable).toBe(true)
    expect(available.statusNote).toBeUndefined()
    const installed = enterpriseThirdPartySkillRow(skill({ status: 'installed' }))
    expect(installed.statusLabel).toBe(ENTERPRISE_THIRD_PARTY_STATE_INSTALLED)
    expect(installed.installable).toBe(false)
    expect(installed.statusNote).toBe(ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE)
    const conflict = enterpriseThirdPartySkillRow(skill({ status: 'conflict' }))
    expect(conflict.statusLabel).toBe(ENTERPRISE_THIRD_PARTY_STATE_CONFLICT)
    expect(conflict.installable).toBe(false)
    expect(conflict.statusNote).toBe(ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE)
    // ★两句原因必须说清**后果**（一个"不用再装"、一个"会覆盖它"），且互不相同。
    expect(ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE).not.toBe(ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE)
    expect(String(conflict.statusNote)).toContain('覆盖')
    // 行上那一句是「状态：原因」的形制，两态都可读。
    expect(installed.note).toBe(`${ENTERPRISE_THIRD_PARTY_STATE_INSTALLED}：${ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE}`)
    expect(conflict.note).toBe(`${ENTERPRISE_THIRD_PARTY_STATE_CONFLICT}：${ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE}`)
  })

  it('描述只显示首行、读不到就整行不出；目录名与技能名不同时才补那一句', () => {
    const multi = enterpriseThirdPartySkillRow(skill({ description: '第一行说明。\n第二行不该出现。' }))
    expect(multi.description).toBe('第一行说明。')
    expect(String(multi.description)).not.toContain('第二行')
    // 缺席 / 纯空白首行都归一成"没有描述"（不画一个空行）。
    expect(enterpriseThirdPartySkillRow(skill()).description).toBeUndefined()
    expect(enterpriseThirdPartySkillRow(skill({ description: '   \n后面的' })).description).toBeUndefined()
    // 名字与目录名相同 ⇒ 不再重复一遍目录名。
    const same = enterpriseThirdPartySkillRow(skill({ name: 'code-review', directory: 'code-review' }))
    expect(same.note).not.toContain(ENTERPRISE_THIRD_PARTY_DIRECTORY_PREFIX)
    // 不同 ⇒ 补上目录名（目录名是"会不会撞名"的凭据，不能被技能名盖住）。
    const differ = enterpriseThirdPartySkillRow(skill({ name: '代码审查', directory: 'code-review' }))
    expect(differ.note.startsWith(`${ENTERPRISE_THIRD_PARTY_DIRECTORY_PREFIX}code-review · `)).toBe(true)
    // 来源根名照旧带在行上。
    expect(differ.sourceName).toBe('Claude Code')
  })

  it('★本刀②：三态各画成一枚卡片（同一格骨架）；只有可装那两态那枚【＋】可点，禁用时原因**行上可见**', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: value([ROOT], [
        skill({ id: 'id-available', name: 'can-install', status: 'available' }),
        skill({ id: 'id-installed', name: 'already-there', status: 'installed' }),
        skill({ id: 'id-conflict', name: 'name-taken', status: 'conflict' }),
      ]) },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    /**
     * ★**本刀②重新基线化**：改前这三条画的是**本文件手写的行**（`li.esc-third-party-row` +
     *   `span`×3 + 一枚 `Button`），现在画的是**与广场逐字同构的格子 + 同一张卡**
     *   （`.esc-list-section > .esc-catalog-cell > EnterpriseEscCard`）。
     *   ★**判据没有放宽、反而更强**：旧断言只数得到"本文件自己造的那枚按钮"，
     *   看不见卡片内部到底画了什么；新断言分两层取证 ——
     *     ① 列表交给卡片的 props（`installed` / `install` 两格逐档）；
     *     ② **直调卡片内层**再核那枚圆形【＋】与**行上可见**的原因（`.esc-card-lock`）。
     */
    const cells = cellsOf(tree)
    expect(cells).toHaveLength(3)
    // ① 三枚都是同一枚卡片（结构与广场同构：`.esc-list-section > .esc-catalog-cell`）。
    expect(cells.map(cell => String(cell.props['className']))).toEqual(['esc-catalog-cell', 'esc-catalog-cell', 'esc-catalog-cell'])
    expect(String(asElement(byClass(tree, 'esc-list-section')).props['className'])).toBe('esc-list-section')
    const cards = cardsOf(tree)
    expect(cards).toHaveLength(3)
    expect(cards[0]!.props['item']).toEqual(enterpriseThirdPartyCardItem(enterpriseThirdPartySkillRow(
      skill({ id: 'id-available', name: 'can-install', status: 'available' }),
    )))
    // ★只有 `available` 那一档拿到**可点**的【＋】计划（另两态拿到的是禁用的）。
    expect(cards[0]!.props['installed']).toBe(false)
    expect((cards[0]!.props['install'] as { disabled: boolean }).disabled).toBe(false)
    /**
     * ★**已装那一档走"已装"分支**（与广场同判据）：`installed === true` ⇒ 卡片画「更多 + 去试试」，
     *   **根本画不出【＋】**（这一格不是"给一枚禁用的按钮"，是"那一档没有按钮"）。
     * ★**命名冲突那一档不是"已装"**（它是"复制过去会覆盖"）：`installed === false` +
     *   一枚**禁用**的【＋】+ 原因**行上可见**。
     */
    const allCards = walk(tree).filter(each => each.type === EnterpriseEscCard)
    const installedCard = allCards.find(each => (each.props['item'] as { id: string }).id === 'id-installed')!
    const conflictCard = allCards.find(each => (each.props['item'] as { id: string }).id === 'id-conflict')!
    expect(installedCard.props['installed']).toBe(true)
    expect(installedCard.props['install']).toBeUndefined()
    expect(conflictCard.props['installed']).toBe(false)
    const conflictInstall = conflictCard.props['install'] as { disabled: boolean; reason?: string; onInstall?: unknown }
    expect(conflictInstall.disabled).toBe(true)
    expect(conflictInstall.reason).toBe(enterpriseThirdPartySkillRow(skill({ id: 'id-conflict', name: 'name-taken', status: 'conflict' })).note)
    expect(conflictInstall.onInstall).toBeUndefined()
    // ② 直调卡片内层：可用那一张真的画出一枚可点的圆形【＋】；冲突那一张画的是禁用 + 可见原因。
    const liveButton = asElement(byClass(renderCard(cards[0]!), 'esc-install-plus'))
    expect(liveButton.props['disabled']).toBe(false)
    expect(liveButton.props['aria-label']).toBe(`${ENTERPRISE_THIRD_PARTY_INSTALL}can-install`)
    const conflictTree = renderCard(conflictCard)
    expect(asElement(byClass(conflictTree, 'esc-install-plus')).props['disabled']).toBe(true)
    const locks = walk(conflictTree).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(locks).toHaveLength(1)
    expect(locks[0]!.props['role']).toBe('status')
    expect(locks[0]!.props['children']).toBe(String(conflictInstall.reason))
    // 状态词与后果那两句都在（员工读得出"为什么这一条不能装"）。
    expect(String(conflictInstall.reason)).toContain(ENTERPRISE_THIRD_PARTY_STATE_CONFLICT)
    expect(String(conflictInstall.reason)).toContain(ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE)
    expect(String(conflictInstall.reason)).not.toBe(ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE)
  })

  it('★一次一条在途：正在装的那一条卡片写着「正在安装…」，其余那枚【＋】禁用 + **可见原因**', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: value([ROOT], [
        skill({ id: 'id-1', name: 'first' }),
        skill({ id: 'id-2', name: 'second' }),
      ]) },
      busy: { id: 'id-1', title: 'first' },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    /**
     * ★**本刀②重新基线化**（判据形状未改、落点改成卡片那两格）：改前数的是本文件自己造的两枚
     *   `Button`，现在读的是**列表交给卡片的那两格计划**（唯一构造点是纯适配器）。
     */
    const cards = cardsOf(tree)
    expect(cards).toHaveLength(2)
    // 第一条（在途那一条）：计划是"本枚在途"那一档（文案进行中、禁用、`busy` 显式给）。
    const busyPlan = cards[0]!.props['install'] as { text: string; disabled: boolean; busy: boolean }
    expect(busyPlan.text).toBe(ENTERPRISE_THIRD_PARTY_INSTALLING)
    expect(busyPlan.disabled).toBe(true)
    expect(busyPlan.busy).toBe(true)
    // 第二条：仍写「安装」但禁用，**且计划里带着那句可见原因**。
    const blockedPlan = cards[1]!.props['install'] as { text: string; disabled: boolean; reason?: string; onInstall?: unknown }
    expect(blockedPlan.text).toBe(ENTERPRISE_THIRD_PARTY_INSTALL)
    expect(blockedPlan.disabled).toBe(true)
    expect(blockedPlan.reason).toBe(ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY)
    expect(blockedPlan.onInstall).toBeUndefined()
    // 直调卡片内层：在途那张把「正在安装…」**行上可见**地写出来；被挡住那张写的是那句原因。
    expect(asElement(byClass(renderCard(cards[0]!), 'esc-install-plus')).props['disabled']).toBe(true)
    const busyLock = walk(renderCard(cards[0]!)).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(busyLock).toHaveLength(1)
    expect(busyLock[0]!.props['children']).toBe(ENTERPRISE_THIRD_PARTY_INSTALLING)
    const blockedLock = walk(renderCard(cards[1]!)).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(blockedLock).toHaveLength(1)
    expect(blockedLock[0]!.props['children']).toBe(ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY)
    // ★可见原因与"进行中那一行"那句**不是同一句**（一个说"别的按钮为什么不能点"、一个说"现在在装谁"）。
    expect(ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY).not.toBe(ENTERPRISE_THIRD_PARTY_BUSY_SUFFIX)
    const status = walk(tree).find(each => typeof each.props['data-enterprise-third-party-busy'] === 'string')
    expect(asElement(status).props['children']).toBe(enterpriseThirdPartyInstallingText('first'))
  })

  it('写入口缺席时那枚按钮禁用 + 可见原因（判据是端口，不是写死的 disabled）', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: value([ROOT], [skill()]) },
      onReload: () => undefined,
    })
    // ★本刀②：落点从"本文件造的那枚按钮"改成"卡片那格计划 + 直调卡片内层那枚【＋】"。
    const plan = cardsOf(tree)[0]!.props['install'] as { disabled: boolean; reason?: string; onInstall?: unknown }
    expect(plan.disabled).toBe(true)
    expect(plan.reason).toBe(ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED)
    expect(plan.onInstall).toBeUndefined()
    const cardTree = renderCard(cardsOf(tree)[0]!)
    expect(asElement(byClass(cardTree, 'esc-install-plus')).props['disabled']).toBe(true)
    const lock = walk(cardTree).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(lock).toHaveLength(1)
    expect(asElement(lock[0]).props['children']).toBe(ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED)
    // 纯投影那一层也逐档锁住（四档互斥）。
    expect(enterpriseThirdPartyActionPlan({ wired: true, id: 'x', name: 'X' })).toMatchObject({ kind: 'install', disabled: false })
    expect(enterpriseThirdPartyActionPlan({ wired: false, id: 'x', name: 'X' })).toMatchObject({ kind: 'not-ported', disabled: true })
    expect(enterpriseThirdPartyActionPlan({ wired: true, id: 'x', name: 'X', busy: { id: 'y', title: 'Y' } }))
      .toMatchObject({ kind: 'blocked', disabled: true, reason: ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY })
    expect(enterpriseThirdPartyActionPlan({ wired: true, id: 'x', name: 'X', busy: { id: 'x', title: 'X' } }))
      .toMatchObject({ kind: 'this-busy', disabled: true, text: ENTERPRISE_THIRD_PARTY_INSTALLING })
  })

  it('四态在呈现层各自只画一档（loading / failed / empty / ready 互斥）', () => {
    const stateOf = (state: Parameters<typeof EnterpriseEscThirdPartyList>[0]['state']) => {
      const tree = EnterpriseEscThirdPartyList({ state, onInstall: () => undefined, onReload: () => undefined })
      const states = walk(tree).filter(each => typeof each.props['data-enterprise-third-party-state'] === 'string')
      return states.map(each => each.props['data-enterprise-third-party-state'])
    }
    expect(stateOf({ kind: 'loading' })).toEqual(['loading'])
    expect(stateOf({ kind: 'failed', code: 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE' })).toEqual(['failed'])
    expect(stateOf({ kind: 'empty', value: value([ROOT], []) })).toEqual(['empty'])
    expect(stateOf({ kind: 'ready', value: value([ROOT], [skill()]) })).toEqual(['ready'])
    // 加载中那句文案与重试按钮都在（失败态那枚是真重发的出口，由 `onReload` 承担）。
    const loadingTree = EnterpriseEscThirdPartyList({ state: { kind: 'loading' }, onReload: () => undefined })
    expect(walk(loadingTree).map(each => each.props['children']).join('|')).toContain(ENTERPRISE_THIRD_PARTY_LOADING)
    // 空态那两句：两句**不同**的话由 `noSource` 选。
    const emptyNoSource = EnterpriseEscThirdPartyList({ state: { kind: 'empty', value: value([ABSENT_ROOT], []) }, onReload: () => undefined })
    expect(walk(emptyNoSource).map(each => each.props['data-enterprise-third-party-empty']).filter(Boolean))
      .toEqual(['no-source'])
    const emptyNoSkill = EnterpriseEscThirdPartyList({ state: { kind: 'empty', value: value([ROOT], []) }, onReload: () => undefined })
    expect(walk(emptyNoSkill).map(each => each.props['data-enterprise-third-party-empty']).filter(Boolean))
      .toEqual(['no-skill'])
    // 空态也给那枚【重新扫描】（刚往 ~/.claude/skills 里放了技能就靠它）。
    expect(walk(emptyNoSkill).some(each => each.props['children'] === ENTERPRISE_THIRD_PARTY_REFRESH)).toBe(true)
  })
})

/* ══════════════ ④ path 只来自上次响应 ══════════════ */

describe('口径 62：path 只来自上次响应（界面绝不拼路径）', () => {
  it('★源码级反锁：本维度相关文件里不出现宿主路径构造', () => {
    /**
     * 靶心是**界面自己造路径**这一类改法，不是所有斜杠：
     *   · `join(` —— `path.join` 那族；
     *   · `webkitdirectory` / `showDirectoryPicker` —— 让浏览器直接读用户目录（那是另一条完全不同的通路）；
     *   · `~` —— 任何形式的家目录展开（模板串拼 `~/.claude/skills` 就是最典型的越界改法）；
     *   · 把点斜杠或斜杠与"技能/目录/SKILL.md"拼起来 —— 手搓落点。
     * ★路由常量（`/enterprise/api/v1/local/…`）**不在靶心里**：那是同源本机 API 的路径，不是宿主文件路径。
     */
    const files = [
      '../src/esc/esc-third-party.ts',
      '../src/esc/esc-third-party-list.tsx',
      '../src/esc/esc-third-party-install.ts',
    ]
    const forbidden = [/join\(/, /webkitdirectory/, /showDirectoryPicker/, /~/, /['"`]\s*\.?\/(SKILL\.md|skills)/]
    for (const name of files) {
      const source = readFileSync(new URL(name, import.meta.url), 'utf8')
      // 剥掉注释：沿革说明里提"不许拼路径"是允许的，代码里出现才是问题。
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => {
        const at = line.indexOf('//')
        return at === -1 ? line : line.slice(0, at)
      }).join('\n')
      for (const pattern of forbidden) {
        expect(code, `${name} 不许出现 ${String(pattern)}`).not.toMatch(pattern)
      }
    }
  })

  it('★回传的值就是上次响应里那枚不透明 id：一路透传、中间一次都没被加工', () => {
    const seen: string[] = []
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: value([ROOT], [skill({ id: 'a1b2c3d4e5f60718', name: 'code-review' })]) },
      onInstall: (id) => { seen.push(id) },
      onReload: () => undefined,
    })
    // ★本刀②：那枚【＋】的写入口现在由卡片那格计划带着（**可点那一档才有**）——
    //   点它之后回传的仍只有那枚不透明 `id`（`data-*` 钩子与 `item.id` 都是它，没有第二处 derivation）。
    const plan = cardsOf(tree)[0]!.props['install'] as { onInstall?: () => void }
    expect(typeof plan.onInstall).toBe('function')
    plan.onInstall!()
    expect(seen).toEqual(['a1b2c3d4e5f60718'])
    // 呈现树上那枚 id 就是投影里给的那一枚（没有第二处 derivation）。
    expect(walk(tree).some(each => each.props['data-enterprise-third-party-skill'] === 'a1b2c3d4e5f60718')).toBe(true)
    expect((cardsOf(tree)[0]!.props['item'] as { id: string }).id).toBe('a1b2c3d4e5f60718')
  })

  it('★两条新路由：同源固定路径 + 正文关闭键集恰好 `{path}`', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      // 扫描那条回 `{roots, skills}`；安装那条回自装清单（与 `GET /skills/self-installed` 同形）。
      const data = url.endsWith('/install') ? { skills: [] } : { roots: [], skills: [] }
      return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response
    }) as unknown as typeof fetch
    const local = createEnterpriseLocalApi(fetcher)
    const esc = createEnterpriseEscApi(fetcher, local)
    const signal = new AbortController().signal
    // ① 扫描：GET、只读、路径与常量逐字同值。
    await esc.thirdPartySkills(signal)
    expect(calls[0]!.url).toBe(ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH)
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/skills/third-party')
    expect(calls[0]!.init?.method).toBeUndefined()
    // ② 安装：POST、正文**关闭键集恰好** `{path}`，且 `path` 就是原样传进去的那一枚。
    await esc.installThirdPartySkill('a1b2c3d4e5f60718', signal)
    expect(calls[1]!.url).toBe(ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH)
    expect(calls[1]!.url).toBe('/enterprise/api/v1/local/skills/third-party/install')
    expect(calls[1]!.init?.method).toBe('POST')
    expect(JSON.parse(String(calls[1]!.init?.body))).toEqual({ path: 'a1b2c3d4e5f60718' })
    // ③ esc 那两条与 local 那两条逐字段同值（同一份 requestJson，不做第二套翻译）。
    expect(await esc.thirdPartySkills(signal)).toEqual(await local.thirdPartySkills(signal))
  })
})

/* ══════════════ ⑤ 一次一条在途 ══════════════ */

describe('口径 62：一次只允许一条在途（第二条被拒且给出可见原因）', () => {
  /** 一枚可手动收束的 promise（用来把"在途窗口"钉住）。 */
  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('★第二条在途请求被拒（返回 false 且**一条都不发**），结算后解锁', async () => {
    const gate = deferred<unknown>()
    const run = vi.fn(() => gate.promise)
    const settled: string[] = []
    const installer = createEnterpriseThirdPartyInstaller({
      run,
      errorCode: () => 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE',
      onSettled: (_target, settlement) => { settled.push(settlement.ok ? 'ok' : settlement.code) },
    })
    expect(installer.isBusy()).toBe(false)
    expect(installer.run({ id: 'id-1', title: 'first' })).toBe(true)
    expect(installer.isBusy()).toBe(true)
    expect(installer.target()).toEqual({ id: 'id-1', title: 'first' })
    expect(installer.requests()).toBe(1)
    // ★第二枚：被拒、**没有**发请求、请求计数不动（这就是"一次只允许一条"的机械判据）。
    expect(installer.run({ id: 'id-2', title: 'second' })).toBe(false)
    expect(run).toHaveBeenCalledTimes(1)
    expect(installer.requests()).toBe(1)
    expect(installer.target()).toEqual({ id: 'id-1', title: 'first' })
    // 结算（成功）⇒ 解锁，且那一次通知已经发出。
    gate.resolve({ ok: true })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toEqual(['ok'])
    expect(installer.isBusy()).toBe(false)
    expect(installer.target()).toBeUndefined()
    // 解锁之后第二条照常能发。
    expect(installer.run({ id: 'id-2', title: 'second' })).toBe(true)
    expect(installer.requests()).toBe(2)
  })

  it('失败也解锁（异常翻成稳定码交给那一行），且**不中止**在途那一次（写动作）', async () => {
    const gate = deferred<unknown>()
    const installer = createEnterpriseThirdPartyInstaller({
      run: () => gate.promise,
      errorCode: () => 'ENT_SKILL_NAME_CONFLICT',
    })
    installer.run({ id: 'id-1', title: 'first' })
    gate.reject(new Error('boom'))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(installer.isBusy()).toBe(false)
  })

  it('呈现层：在途时其余按钮一并禁用（原因写在进行中那一行 + 每枚按钮旁边）', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: value([ROOT], [
        skill({ id: 'id-1', name: 'first' }),
        skill({ id: 'id-2', name: 'second' }),
      ]) },
      busy: { id: 'id-1', title: 'first' },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    const buttons = walk(tree).filter(each => String(each.props['className']) === 'esc-third-party-install')
    expect(buttons.every(each => each.props['disabled'] === true)).toBe(true)
    const busyLine = walk(tree).find(each => typeof each.props['data-enterprise-third-party-busy'] === 'string')
    expect(String(asElement(busyLine).props['children'])).toContain(ENTERPRISE_THIRD_PARTY_BUSY_SUFFIX)
  })
})

/* ══════════════ ⑥ 解码器（形状即纪律） ══════════════ */

describe('口径 62：扫描响应的严格解码（形状里没有 path）', () => {
  const payload = {
    roots: [{ id: 'claude-code', name: 'Claude Code', present: true, count: 1, skipped: 0 }],
    skills: [{
      id: 'a1b2c3d4e5f60718',
      name: 'code-review',
      rootId: 'claude-code',
      sourceName: 'Claude Code',
      directory: 'code-review',
      status: 'available',
    }],
  }

  it('合法响应解出根与候选；可选描述缺席归一成"没有这个键"', () => {
    const decoded = decodeThirdParty(payload)
    expect(decoded.roots).toHaveLength(1)
    expect(decoded.skills[0]!.id).toBe('a1b2c3d4e5f60718')
    expect(decoded.skills[0]!.description).toBeUndefined()
    expect('description' in decoded.skills[0]!).toBe(false)
    // 可选描述：JSON null 与空串都归一成"没有"；有值就带上。
    for (const given of [null, '', '把代码审查规则带进新会话。']) {
      const each = decodeThirdParty({ ...payload, skills: [{ ...payload.skills[0]!, description: given }] })
      expect(each.skills[0]!.description).toBe(given === '把代码审查规则带进新会话。' ? given : undefined)
    }
  })

  it('★形状里**没有 path**：多塞一枚路径即整条判畸形（宿主绝对路径不进浏览器）', () => {
    expect(() => decodeThirdParty({
      ...payload,
      skills: [{ ...payload.skills[0]!, path: '/Users/someone/.claude/skills/code-review' }],
    })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    // 根那一层同样没有 path。
    expect(() => decodeThirdParty({
      roots: [{ ...payload.roots[0]!, path: '/Users/someone/.claude/skills' }],
      skills: payload.skills,
    })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })

  it('每条候选的 rootId 必须在 roots 里；每根的 count 必须与条数逐字相等；空列表合法', () => {
    // 无家可归的候选 ⇒ 畸形（界面按根分组，它没有诚实的落点）。
    expect(() => decodeThirdParty({ ...payload, skills: [{ ...payload.skills[0]!, rootId: 'nope' }] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    // 计数与清单对不上 ⇒ 畸形（"这个根几枚"这个数字其中半个必是假的）。
    expect(() => decodeThirdParty({ ...payload, roots: [{ ...payload.roots[0]!, count: 7 }] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    // 三态以外的字面 ⇒ 畸形。
    expect(() => decodeThirdParty({ ...payload, skills: [{ ...payload.skills[0]!, status: 'pending' }] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    // 空列表合法（本机一枚三方技能都没有）。
    expect(decodeThirdParty({ roots: [], skills: [] })).toEqual({ roots: [], skills: [] })
    // 未检测到的根必须 `present:false` + `count:0`（本机真实形态）。
    expect(decodeThirdParty({ roots: [{ id: 'codex', name: 'Codex', present: false, count: 0, skipped: 0 }], skills: [] }))
      .toEqual({ roots: [{ id: 'codex', name: 'Codex', present: false, count: 0, skipped: 0 }], skills: [] })
  })

  it('★根是**五键封闭**：`skipped` 必填、且是**数不是列表**（被跳过的条目不进响应）', () => {
    // 五键少一枚（`skipped` 缺席）⇒ 整条判畸形：界面要能说出"另有 N 个被跳过"，缺了这格就说不出。
    const { skipped: _drop, ...rootWithoutSkipped } = payload.roots[0]!
    expect(() => decodeThirdParty({ ...payload, roots: [rootWithoutSkipped] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    /**
     * ★**它是数、不是列表**：宿主若把"被跳过的目录"当数组发过来（哪怕长度对得上），
     *   也必须判畸形 —— 那些条目界面对它们**什么也不做**，收下来只会造出第二份真源。
     */
    for (const bad of [[0], ['/x'], { length: 0 }, '0', null, -1, 0.5]) {
      expect(() => decodeThirdParty({ ...payload, roots: [{ ...payload.roots[0]!, skipped: bad }] }), String(bad))
        .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    }
    /**
     * ★**`skipped` 是必填、不是可选**——判据落在**解码结果**上，不落在"抛异常"上。
     *
     * ★为什么必须这样锁：把它写成"可选键"（`hasExactKeys` 的第二组里）时，上面那条
     *   `toThrowError` **依然会绿**——缺席的 `skipped` 会被类型那一关拦下（`undefined` 不是非负整数），
     *   于是"字段失踪"与"字段类型错"在异常这一层长得一模一样。两条路必须**分得开**：
     *   · 结构错（这格该在而不在）⇒ 解码结果里**必在**；
     *   · 类型错（带了但不是数）⇒ 上面那个 for 循环已经逐个形态钉住。
     */
    expect('skipped' in decodeThirdParty(payload).roots[0]!).toBe(true)
    expect(decodeThirdParty(payload).roots[0]!.skipped).toBe(0)
    // 反向：**没带 `skipped` 的根**在解码结果里也必须**不带**这一格（写入可选键时这里会红）。
    expect('skipped' in (rootWithoutSkipped as { skipped?: number })).toBe(false)
    // 合法形态：真数照收；多塞第六枚键同样畸形（键集封闭）。
    expect(decodeThirdParty({ ...payload, roots: [{ ...payload.roots[0]!, skipped: 26 }] }).roots[0]!.skipped).toBe(26)
    expect(() => decodeThirdParty({ ...payload, roots: [{ ...payload.roots[0]!, skippedList: [] }] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })

  it('同一枚 id 出现两次 ⇒ 畸形（它是 React key 与回传值，重复即协议 bug）', () => {
    const two = { ...payload, roots: [{ ...payload.roots[0]!, count: 2 }], skills: [payload.skills[0]!, { ...payload.skills[0]! }] }
    expect(() => decodeThirdParty(two)).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })

  it('解码器与常量同名再导出（`decodeEnterpriseThirdPartySkills` 是唯一名字）', () => {
    expect(decodeEnterpriseThirdPartySkills).toBe(decodeThirdParty)
    expect(selfConsistent([ROOT], [skill()]).roots[0]!.count).toBe(1)
  })
})
