/**
 * [INPUT]: 依赖 `esc-third-party.ts`（纯事实层：四态投影 / 按根分组 / 行投影 / 按钮终态）、
 *   `esc-third-party-install.ts`（一次一条的安装执行器）、`esc-third-party-list.tsx`（呈现层）、
 *   `esc-toolbar.tsx`（维度行与分类行）、`esc-categories.ts` 的分类集合判据，以及
 *   `skill-api-decode.ts` 的严格解码器与 `local-api.ts`/`esc-api.ts` 的两条新路由
 * [OUTPUT]: 锁定**口径 62**（本地三方 Agent 技能源）的界面半边：① 维度行**恰好四枚**且逐字（含顺序；
 *   ★口径 53 按**新裁决**把它从三枚重新基线化为四枚，见那一条用例里那段理由）
 *   + 本维度**分类胶囊行不渲染**；② 四态互斥 + **两句不同的"为什么空"** + 失败态**真重发**（请求计数取证）；
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
  ENTERPRISE_THIRD_PARTY_ABSENT_TAG,
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
  ENTERPRISE_THIRD_PARTY_SOURCE_TITLE,
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
  enterpriseThirdPartyCardInstall,
  enterpriseThirdPartyCardItem,
  enterpriseThirdPartySkillRow,
  enterpriseThirdPartySourceSummary,
  enterpriseThirdPartySubChips,
} from '../src/esc/esc-third-party.js'
import { enterpriseEscSubTabFilter, enterpriseEscSubTabs } from '../src/esc/esc-sub-tabs.js'
import { createEnterpriseThirdPartyInstaller } from '../src/esc/esc-third-party-install.js'
import { EnterpriseEscThirdPartyList } from '../src/esc/esc-third-party-list.js'
import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { EnterpriseEscToolbar } from '../src/esc/esc-toolbar.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
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
    // 「本地三方」四个字读不出是什么 ⇒ 完整说法「本地三方 Agent 技能源」必须挂在它的悬浮说明里。
    expect(titleOf(2)).toBe(ENTERPRISE_ESC_LOCAL_COPY.thirdPartyTabTitle)
    expect(String(titleOf(2))).toContain(ENTERPRISE_THIRD_PARTY_SOURCE_TITLE)
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
    // "检测到几个源、其中几个有技能"那句（0 枚与别名的根不进 chip ⇒ 必须有个总数交代）。
    // ★两个数**都不数别名**（别名是同一个库：算进去就是替同一份东西报十次）。
    // ★三个数都不数别名；`workbuddy` 那 3 枚 skipped 必须出现在句尾。
    expect(enterpriseThirdPartySourceSummary(selfConsistent(roots, skills)))
      .toBe('已检测到 3 个技能源，其中 2 个有技能，另有 3 个目录不符合技能规范。')
    // ★K === 0 ⇒ **整句不出那半句**（不写"另有 0 个"）。
    expect(enterpriseThirdPartySourceSummary(selfConsistent([
      { id: 'workbuddy', name: 'WorkBuddy', present: true, count: 0, skipped: 0 },
      { id: 'qoder', name: 'QoderWork CN', present: true, count: 0, skipped: 0 },
      { id: 'codex', name: 'Codex', present: false, count: 0, skipped: 0 },
    ], []))).toBe('已检测到 2 个技能源，其中 0 个有技能。')
    // ★别名的 skipped **不计入**（同一份库不许报两次）。
    expect(enterpriseThirdPartySourceSummary(selfConsistent([
      { id: 'agents', name: 'Agent Skills', present: true, count: 1, skipped: 2 },
      { id: 'agents-xdg', name: 'Agent Skills', present: true, count: 0, skipped: 9, aliasOf: 'agents' },
    ], [skill({ rootId: 'agents' })])))
      .toBe('已检测到 1 个技能源，其中 1 个有技能，另有 2 个目录不符合技能规范。')
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

  it('按根分组：未检测到的根照样成组、保序、组内保序；三种空话各司其职', () => {
    const roots = [ROOT, ABSENT_ROOT]
    const skills = [skill({ id: 'id-b', name: 'b-skill' }), skill({ id: 'id-a', name: 'a-skill' })]
    const groups = enterpriseThirdPartyRootGroups(value(roots, skills))
    expect(groups.map(group => group.root.id)).toEqual(['claude-code', 'codex'])
    // 组内保持 Host 给的顺序（界面不重排）。
    expect(groups[0]!.skills.map(each => each.name)).toEqual(['b-skill', 'a-skill'])
    // 未检测到的根照旧成组 + `absent` 为真（页面据此在节头写「未检测到」）。
    expect(groups[1]!.absent).toBe(true)
    expect(groups[1]!.skills).toEqual([])
    expect(groups[1]!.emptyNote).toBeDefined()
    // 三种空话互不相同（位置不存在 / 位置里没东西 / 这一节空但别处有）。
    const alone = enterpriseThirdPartyRootGroups(value([ROOT], []))[0]!
    const withOthers = enterpriseThirdPartyRootGroups(value([ROOT, ABSENT_ROOT], [skill()]))[0]!
    expect(new Set([groups[1]!.emptyNote, alone.emptyNote, withOthers.emptyNote]).size).toBe(3)
    // 根标签：人话名优先，空名退到 id（不编、不留白）。
    expect(enterpriseThirdPartyRootLabel(ROOT)).toBe('Claude Code')
    expect(enterpriseThirdPartyRootLabel({ ...ROOT, name: '  ' })).toBe('claude-code')
    // 计数：零说「没有技能」，不说「0 枚」。
    expect(enterpriseThirdPartyCountText(0)).toBe('没有技能')
    expect(enterpriseThirdPartyCountText(3)).toBe('3 枚技能')
    expect(ENTERPRISE_THIRD_PARTY_ABSENT_TAG).toBe('未检测到')
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
