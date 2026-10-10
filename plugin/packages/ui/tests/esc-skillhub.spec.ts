/**
 * [INPUT]: 依赖 `esc-skill-card.ts`（**唯一装配点** `enterpriseEscSkillCardSpec`）、`esc-skillhub.ts` /
 *   `esc-skillhub-list.tsx`（**单源浏览面**那一维度的纯事实层与呈现层）、`esc-third-party.ts` /
 *   `esc-third-party-list.tsx`（本刀 ② 换卡后的纯适配器与骨架）、`esc-card.tsx`（卡片两枚导出）、
 *   `esc-copy.ts` 的维度文案、`local-api.ts` 的**唯一**查询串构造器 `skillhubBrowseQuery` 与那条浏览路由、
 *   `skill-api-decode.ts` 的浏览面严格解码器，以及 `node:fs`（源码级反向锁与"构造点各恰一处"的计数）
 * [OUTPUT]: 对外提供**技能页收尾这一刀的三条锁**：
 *   ① **装配唯一** —— `enterpriseEscSkillCardSpec` 在全 `src` 只有**一处定义**，四个技能面
 *      （广场 / 精选 / 本地三方 / SkillHub）的卡片入参**构造点各自只调它**（源码级计数），
 *      且这四个面里**不许再出现**手拼 `createElement(EnterpriseEscCard, {…})` 的第二写法；
 *      **反向登记**：「已安装」与「企业技能」两个面本刀**未归顺**（仍手拼），下一刀收编；
 *   ② **本地三方 = 同一张卡 + 同一骨架** —— 那套手写行类名（九个）在全 `src` **零残留**，
 *      骨架逐字是 `.esc-list-section > .esc-catalog-cell > 同一张卡`；既有那枚
 *      `enterpriseThirdPartyActionPlan` **一个字不改**、由纯适配器映成卡片形态；
 *   ③ **SkillHub 维度** —— 第四枚页签的名字与来源都换（**位次与数量一字未动**）、
 *      数据源**只投影 `sourceId === 'skillhub.cn'`**（本刀已知浪费：另三源结果被丢弃）、
 *      四态 + 两句不同的"为什么空"、安装把 `installSource` **原样回传**（界面不拼路径、不接受输入），
 *      且**撤掉「企业技能」维度之后「应用商店 → 企业技能」那一枚照旧在**（内容不丢）。
 * [POS]: 本刀（技能页收尾：① 抽出唯一装配 ② 本地三方换卡 ③ 新增 SkillHub 维度）的**唯一**机械门禁。
 *   ★为什么单独成文件：那三条锁横跨四个面与一份样式表，塞进任何一份既有 spec 都会让它读起来像
 *     "打补丁"；收在这里，读者一眼看到的是"这一刀到底钉住了哪三件事"。
 *   ★**本文件不碰 React 渲染**（本仓 vitest 无 DOM）：卡片这一层走**内层纯函数直调**
 *     （`EnterpriseEscCardView`，与 `esc-installed-actions.spec.ts` 同一条手法）。
 *   ★**没有一条既有断言被放宽**：改前锁"只投影 `sourceId === 'skillhub.cn'`"的判据在本刀
 *     **换成更硬的一条**（这一族文件里**零** `sourceId` 判据 —— 单源面里那道过滤是死代码），
 *     理由逐条写在用例注释里。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

/**
 * 官方原语在本仓**不是**运行期依赖（发行时用宿主共享实例），而 devDependency 那份在**导入期**
 * 就会 `import 'clsx'`（不在本仓依赖里）⇒ 直接 import 呈现层会在"收集测试"阶段就炸。
 * 与另几份 esc spec 同一条手法：整模块替身化（本文件不测官方原语自己的渲染）。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: 'button',
  Pill: 'button',
  Input: 'input',
  Menu: 'div',
  MenuItemButton: 'button',
  Modal: 'div',
  Switch: 'span',
  Tag: 'span',
  IconEllipsisOutlineMedium: 'span',
  IconSettingsOutlineMedium: 'span',
  IconUserOutlineMedium: 'span',
  IconLoadingOutlineMedium: 'span',
}))

import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
import {
  ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY,
  enterpriseEscSkillCardHidden,
  enterpriseEscSkillCardParams,
  enterpriseEscSkillCardSpec,
} from '../src/esc/esc-skill-card.js'
import {
  ENTERPRISE_SKILLHUB_BLOCKED_BY_BUSY,
  ENTERPRISE_SKILLHUB_DEFAULT_SORT,
  ENTERPRISE_SKILLHUB_EMPTY_CATEGORY,
  ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT,
  ENTERPRISE_SKILLHUB_FIRST_PAGE,
  ENTERPRISE_SKILLHUB_INSTALL,
  ENTERPRISE_SKILLHUB_INSTALLING,
  ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED,
  ENTERPRISE_SKILLHUB_LOADING,
  ENTERPRISE_SKILLHUB_LOAD_MORE,
  ENTERPRISE_SKILLHUB_PAGE_MAX,
  ENTERPRISE_SKILLHUB_QUERY_MIN,
  ENTERPRISE_SKILLHUB_SOURCE_ID,
  ENTERPRISE_SKILLHUB_SOURCE_TITLE,
  enterpriseSkillHubCardInstall,
  enterpriseSkillHubCardItem,
  enterpriseSkillHubCategoryChips,
  enterpriseSkillHubFace,
  enterpriseSkillHubHasNextPage,
  type EnterpriseSkillHubEmptyReason,
} from '../src/esc/esc-skillhub.js'
import { createEnterpriseLocalApi, ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH, skillhubBrowseQuery } from '../src/local-api.js'
import { EnterpriseEscSkillHubList } from '../src/esc/esc-skillhub-list.js'
import {
  ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE,
  ENTERPRISE_THIRD_PARTY_INSTALL,
  ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE,
  ENTERPRISE_THIRD_PARTY_INSTALLING,
  ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED,
  ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY,
  enterpriseThirdPartyActionPlan,
  enterpriseThirdPartyCardInstall,
  enterpriseThirdPartySkillRow,
} from '../src/esc/esc-third-party.js'
import { EnterpriseEscThirdPartyList } from '../src/esc/esc-third-party-list.js'
import { decodeEnterpriseSkillhubBrowse } from '../src/skill-api-decode.js'
import type { EnterpriseSkillhubBrowse, EnterpriseSkillhubSkill, EnterpriseThirdPartySkill } from '../src/skill-api-decode.js'

/* ══════════════ 源码级小工具 ══════════════ */

const ESC_DIR = new URL('../src/esc/', import.meta.url)
const SRC_DIR = new URL('../src/', import.meta.url)

function readSrc(name: string, dir = ESC_DIR): string {
  return readFileSync(new URL(name, dir), 'utf8')
}

/** 剥掉块注释与行注释（源码级反向锁只该盯**代码**，沿革说明里提某个名字是允许的）。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((line) => {
    const at = line.indexOf('//')
    return at === -1 ? line : line.slice(0, at)
  }).join('\n')
}

/** `src/`（含 `src/esc/`）子树里所有 `.ts`/`.tsx` 源文件（名字相对 `src/`，正斜杠）。 */
function allSrcFiles(): readonly { readonly name: string; readonly code: string }[] {
  const out: { name: string; code: string }[] = []
  const walkDir = (dir: URL, prefix: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = new URL(entry, dir)
      if (statSync(full).isDirectory()) {
        walkDir(new URL(`${entry}/`, dir), `${prefix}${entry}/`)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue
      out.push({ name: `${prefix}${entry}`, code: readFileSync(full, 'utf8') })
    }
  }
  walkDir(SRC_DIR, '')
  return out
}

/**
 * 每一处 `createElement(EnterpriseEscCard, { … })` 的 **props 源文本**（花括号配对切出来）。
 *
 * ★与 `esc-installed-actions.spec.ts` 那份同名工具**逐字同构**（那边锁的是"同时传 `actionSwitch`
 *   与 `showUse` 的调用点恰好一处"，本文件锁的是"这四个面的 props 必须来自那一枚装配"）——
 *   两边都只做源码级配对切片，不需要真渲染器。
 */
function cardCallSites(): readonly { readonly name: string; readonly props: string }[] {
  const out: { name: string; props: string }[] = []
  const marker = 'createElement(EnterpriseEscCard, {'
  for (const file of allSrcFiles()) {
    let at = file.code.indexOf(marker)
    while (at !== -1) {
      const open = at + marker.length - 1
      let depth = 0
      let end = open
      for (; end < file.code.length; end += 1) {
        const character = file.code[end]
        if (character === '{') depth += 1
        else if (character === '}') {
          depth -= 1
          if (depth === 0) break
        }
      }
      out.push({ name: file.name, props: file.code.slice(open, end + 1) })
      at = file.code.indexOf(marker, end)
    }
  }
  return out
}

/* ══════════════ 树级小工具（无 DOM） ══════════════ */

type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
const asElement = (node: unknown) => node as Element
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
const byClass = (node: unknown, className: string): Element | undefined =>
  walk(node).find(each => each.props['className'] === className)
const cardsOf = (tree: unknown): Element[] => walk(tree).filter(each => each.type === EnterpriseEscCard)
const renderCard = (card: Element): Element => asElement(EnterpriseEscCardView(card.props as never))

/* ══════════════ 夹具 ══════════════ */

/** 一枚三方候选（与 `esc-third-party.spec.ts` 同一份形状）。 */
function thirdPartySkill(overrides: Partial<EnterpriseThirdPartySkill> = {}): EnterpriseThirdPartySkill {
  return {
    id: 'sha256-abc'.slice(0, 16),
    name: 'code-review',
    rootId: 'claude-code',
    sourceName: 'Claude Code',
    directory: 'code-review',
    status: 'available',
    ...overrides,
  }
}

/** 一条浏览结果（**必需三格** + `description`；计数刻意缺席 —— 「上游没说」≠「说是 0」）。 */
const HUB_SKILL: EnterpriseSkillhubSkill = {
  name: 'dev-expert',
  slug: 'dev-expert',
  version: '1.2.3',
  description: '一句话说明',
  installSource: 'skillhub.cn:dev-expert@1.2.3',
}

/** 下级分类表（宿主给的 13 枚里取 5 枚当夹具；★顺序即宿主给的顺序，界面不许重排）。 */
const CATEGORIES = [
  { key: 'office-efficiency', name: '办公效率' },
  { key: 'content-creation', name: '内容创作' },
  { key: 'dev-programming', name: '开发编程' },
  { key: 'life-service', name: '生活服务' },
  { key: 'pay-skill', name: 'Pay Skill' },
]

/** 一次浏览的响应投影（默认：一页、没���页、分类表在场）。 */
function browse(overrides: Partial<EnterpriseSkillhubBrowse> = {}): EnterpriseSkillhubBrowse {
  return { skills: [], page: 1, hasMore: false, categories: CATEGORIES, ...overrides }
}
const hubSkill = (overrides: Partial<EnterpriseSkillhubSkill> = {}): EnterpriseSkillhubSkill => ({ ...HUB_SKILL, ...overrides })
const READY: { kind: 'ready'; value: EnterpriseSkillhubBrowse } = {
  kind: 'ready',
  value: browse({ skills: [HUB_SKILL] }),
}
/** 空态那两档的**真值集合**（锁②用：新维度没有第三档）。 */
const emptyReasons = ((): readonly EnterpriseSkillHubEmptyReason[] => {
  const probes = ['', 'dev-programming'] as const
  return probes.map(category => enterpriseSkillHubFace({
    state: { kind: 'empty', value: browse({ skills: [] }) },
    category,
  }).emptyReason!)
})()

/** 一只只回 `{data}` 信封的假 fetch（与 `esc.spec.ts` 那枚 `fakeFetcher` 同一形制）。 */
function jsonResponse(payload: unknown): unknown {
  return { ok: true, status: 200, json: async () => payload }
}

/* ══════════════ ① 唯一装配 ══════════════ */

describe('① 技能卡入参的装配在全仓**只有一处定义**，四个面各自只调它', () => {
  it('定义恰一处：`export function enterpriseEscSkillCardSpec(` 在全 `src` 恰好一次', () => {
    /** ★剥注释后再数：沿革说明里提这个名字是合法的，判据只该盯**代码**。 */
    const owners = allSrcFiles()
      .map(file => ({ name: file.name, count: (stripComments(file.code).match(/export function enterpriseEscSkillCardSpec\(/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(owners).toEqual([{ name: 'esc/esc-skill-card.ts', count: 1 }])
  })

  it('★四个技能面的卡片入参构造点各自只调它（源码级计数：每面恰一处）', () => {
    const callers = allSrcFiles()
      .map(file => ({ name: file.name, count: (file.code.match(/enterpriseEscSkillCardSpec\(/g) ?? []).length }))
      .filter(each => each.count > 0)
      .map(each => each.name)
      .sort()
    /**
     * ★判据是**精确集合**：四个面各恰一处 + 定义文件自己那一处（函数声明里的 `(`）。
     *   多一处（有人在别的面又调一次）/ 少一处（某个面绕过装配自己拼）/ 换一个面
     *   （有人把某一面从这张名单里换掉）都当场红。
     */
    expect(callers).toEqual([
      'esc/esc-aggregation.tsx',
      'esc/esc-featured.tsx',
      'esc/esc-skill-card.ts',
      'esc/esc-skillhub-list.tsx',
      'esc/esc-third-party-list.tsx',
    ])
    // 每面**恰好一处**（不是"至少一处"——两处就是有人又写了一遍）。
    for (const name of ['esc/esc-aggregation.tsx', 'esc/esc-featured.tsx', 'esc/esc-skillhub-list.tsx', 'esc/esc-third-party-list.tsx']) {
      expect((readSrc(name.replace('esc/', '')).match(/enterpriseEscSkillCardSpec\(/g) ?? []).length, name).toBe(1)
    }
  })

  it('★反向锁：四个面里 `createElement(EnterpriseEscCard, {…})` 的 props **必须**来自那枚装配（`...cardProps`）', () => {
    const faces = ['esc/esc-aggregation.tsx', 'esc/esc-featured.tsx', 'esc/esc-skillhub-list.tsx', 'esc/esc-third-party-list.tsx']
    const sites = cardCallSites()
    for (const face of faces) {
      const mine = sites.filter(site => site.name === face)
      expect(mine.length, face).toBeGreaterThan(0)
      for (const site of mine) {
        // ① 装配的结果一定是**摊开**进来的（`...cardProps`）……
        expect(site.props, `${face}：这一处卡片 props 没有摊开装配结果`).toContain('...cardProps')
        // ② ……而"一整堆手拼"那几个键**一个都不许**在这一处出现（出现即是第二种写法）。
        for (const handwritten of ['iconShape:', 'showUse:', 'installed:', 'install:', 'more:', 'tryNow:']) {
          expect(site.props, `${face}：这一处手拼了 ${handwritten}`).not.toContain(handwritten)
        }
      }
    }
  })

  it('旧名 `enterpriseEscSkillCardParams` 是**同一枚函数的别名**（不是第二份实现）', () => {
    const source = readSrc('esc-skill-card.ts')
    // 别名那一行是"再出口"，不是 `export function`（后者会被上面那条"定义恰一处"抓住）。
    expect(source).toContain('export const enterpriseEscSkillCardParams = enterpriseEscSkillCardSpec')
    expect(source).not.toContain('export function enterpriseEscSkillCardParams(')
    // 行为级：同一份夹具下两个名字给的是**同一个函数**。
    expect(enterpriseEscSkillCardParams).toBe(enterpriseEscSkillCardSpec)
    const input = { installed: false, justInstalled: false } as const
    expect(enterpriseEscSkillCardParams(input)).toEqual(enterpriseEscSkillCardSpec(input))
  })

  it('★如实登记：**「已安装」与「企业技能」两个面本刀未归顺**（仍手拼），下一刀收编', () => {
    /**
     * ★这条是**反向登记**，不是"通过就算数"：它把"还没统一"这件事钉成**可机械核对的事实** ——
     *   那两个面今天确实**没有**走这一枚装配（`cardCallSites` 里它们的 props 里没有 `...cardProps`）。
     *   ⇒ 下一刀把它们收编时，这一条会**红**，从而强制改这里（"如实登记"不许悄悄漂成"其实统一了"）。
     *   ★为什么本刀不顺手收编：用户明令这两个面**不动**（它们已能跑），
     *     它们的动作坐标（`actionSwitch` / `packageId`）与技能档不同，混进来会把这一刀的范围搞糊。
     */
    const sites = cardCallSites()
    for (const name of ['esc/esc-installed.tsx', 'esc/esc-catalog-list.tsx']) {
      const mine = sites.filter(site => site.name === name)
      expect(mine.length, name).toBeGreaterThan(0)
      for (const site of mine) {
        expect(site.props, `${name}：这一面本刀登记为"未归顺"`).not.toContain('...cardProps')
        expect(site.props).toContain('showUse:')
      }
    }
  })
})

/* ══════════════ ② 本地三方：同一张卡 + 同一骨架 ══════════════ */

describe('② 本地三方换成与广场同一张卡 + 同一骨架（手写行版式整族退场）', () => {
  /** 改前那一族九个行类名（本刀要求：全 `src` 零残留，含样式表）。 */
  const DEAD_ROW_CLASSES = [
    'esc-third-party-row', 'esc-third-party-rows', 'esc-third-party-rowline', 'esc-third-party-rowmain',
    'esc-third-party-name', 'esc-third-party-desc', 'esc-third-party-meta', 'esc-third-party-action',
    'esc-third-party-lock',
  ] as const

  it('★九个手写行类名在全 `src` 零出现（**不留死规则**，也不留第二套行版式的种子）', () => {
    for (const name of DEAD_ROW_CLASSES) {
      const owners = allSrcFiles()
        .filter(file => stripComments(file.code).includes(name))
        .map(file => file.name)
      expect(owners, `还有文件在用 ${name}`).toEqual([])
    }
    // ★样式表里也不许有"规则留着但没人用"那种死规则（判据是剥注释后逐条规则的选择器）。
    const css = stripComments(readSrc('esc-style.ts'))
    for (const name of DEAD_ROW_CLASSES) {
      expect(css.includes(`.${name}`), name).toBe(false)
    }
  })

  it('★骨架逐字同构：`.esc-list-section > .esc-catalog-cell > 同一张卡`', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: { kind: 'ready', value: { roots: [{ id: 'claude-code', name: 'Claude Code', present: true, count: 1, skipped: 0 }], skills: [thirdPartySkill()] } },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    const section = byClass(tree, 'esc-list-section')!
    expect(section).toBeTruthy()
    const cells = walk(section).filter(each => String(each.props['className']) === 'esc-catalog-cell')
    expect(cells).toHaveLength(1)
    const cards = cardsOf(cells[0])
    expect(cards).toHaveLength(1)
    // 同一张卡（`EnterpriseEscCard` 本体，不是"长得像"）。
    expect(cards[0]!.type).toBe(EnterpriseEscCard)
    // ★同一枚装配铺的两格（`iconShape`/`showUse` 由装配给，本面一个字都不手拼）。
    expect(cards[0]!.props['iconShape']).toBe('square')
    expect(cards[0]!.props['showUse']).toBe(true)
  })

  it('★纯适配器把**既有**那枚 `enterpriseThirdPartyActionPlan` 映成卡片形态（四档 + 另两态）', () => {
    const row = enterpriseThirdPartySkillRow(thirdPartySkill())
    const onInstall = (): void => undefined
    // ① 可点：`onInstall` 只在可点那一档出现（禁用即无写入口，是结构事实）。
    const live = enterpriseThirdPartyCardInstall({ row, wired: true, onInstall })
    expect(live.disabled).toBe(false)
    expect(live.text).toBe(ENTERPRISE_THIRD_PARTY_INSTALL)
    expect(typeof live.onInstall).toBe('function')
    // ② 别的在途挡住：禁用 + **可见原因**（与既有那枚计划的 reason 逐字同源）。
    const blocked = enterpriseThirdPartyCardInstall({ row, wired: true, busy: { id: 'other', title: 'X' }, onInstall })
    expect(blocked.disabled).toBe(true)
    expect(blocked.reason).toBe(ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY)
    expect(blocked.reason).toBe(enterpriseThirdPartyActionPlan({ wired: true, id: row.id, name: row.name, busy: { id: 'other', title: 'X' } }).reason)
    expect(blocked.onInstall).toBeUndefined()
    // ③ 本枚在途：文案进行中、`busy` 显式给（不许从 disabled 推）。
    const self = enterpriseThirdPartyCardInstall({ row, wired: true, busy: { id: row.id, title: row.name }, onInstall })
    expect(self.text).toBe(ENTERPRISE_THIRD_PARTY_INSTALLING)
    expect(self.busy).toBe(true)
    // ④ 端口缺席：禁用 + 另一句可见原因。
    const orphan = enterpriseThirdPartyCardInstall({ row, wired: false, onInstall })
    expect(orphan.disabled).toBe(true)
    expect(orphan.reason).toBe(ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED)
    // ⑤⑥ 另两态（已装 / 命名冲突）：**不调计划**，直接给禁用的【＋】+ 那一句状态原因。
    for (const status of ['installed', 'conflict'] as const) {
      const deadRow = enterpriseThirdPartySkillRow(thirdPartySkill({ status }))
      const dead = enterpriseThirdPartyCardInstall({ row: deadRow, wired: true, onInstall })
      expect(dead.disabled, status).toBe(true)
      expect(dead.onInstall).toBeUndefined()
      // ★原因是**行投影那一整句 note**（`状态：原因`，含"目录名"那半句）——
      //   它比单独那一句 note 信息更全，且与改前手写行上写的是**同一句**。
      expect(dead.reason).toBe(deadRow.note)
      expect(String(dead.reason)).toContain(status === 'installed' ? ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE : ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE)
    }
  })

  it('★已装那一档与广场**同源**：那两枚计划工厂原样透传（源码级：不在本面另造一份）', () => {
    const list = readSrc('esc-third-party-list.tsx')
    // 两个工厂都来自 props（聚合层持有的**同一枚**），本文件里没有任何计划表的构造。
    expect(list).toContain('props.tryOf?.(row.name, true)')
    expect(list).toContain('props.moreOf?.(row.name, tryNow)')
    expect(list).not.toContain('enterpriseEscSkillTryTable(')
    expect(list).not.toContain('enterpriseEscSkillMoreTable(')
    // 聚合层：本地三方那一支交下去的正是**同一个** `moreOf` / `tryOf`（与广场网格共用的那两枚）。
    const agg = readSrc('esc-aggregation.tsx')
    expect(agg).toContain('...(resourceType === \'skill\' ? { tryOf } : {}),')
    // ① 两个面（本地三方 / SkillHub）各自把这一对工厂交下去**恰一处**（缩进十格的就是那两处 props）。
    expect(agg.match(/\n {10}moreOf,\n {10}tryOf,/g) ?? []).toHaveLength(2)
    // ② 两个面各自把这一对**原样透传**给纯渲染层（缩进四格的两处调用）。
    expect(agg.match(/\n {4}moreOf,\n {4}tryOf,/g) ?? []).toHaveLength(2)
  })

  it('★呈现层：已装那一档画「更多 + 去试试」、另两态那枚【＋】禁用并把原因**行上可见**', () => {
    const tree = EnterpriseEscThirdPartyList({
      state: {
        kind: 'ready',
        value: {
          roots: [{ id: 'claude-code', name: 'Claude Code', present: true, count: 2, skipped: 0 }],
          skills: [
            thirdPartySkill({ id: 'id-1', name: 'first', status: 'available' }),
            thirdPartySkill({ id: 'id-2', name: 'taken', directory: 'taken', status: 'conflict' }),
          ],
        },
      },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    const cards = cardsOf(tree)
    expect(cards).toHaveLength(2)
    // 可装那一档：卡片是**未装**那一支，且那枚【＋】可点。
    expect(cards[0]!.props['installed']).toBe(false)
    expect((cards[0]!.props['install'] as { disabled: boolean }).disabled).toBe(false)
    // 冲突那一档：未装 + 禁用 + 原因。
    expect(cards[1]!.props['installed']).toBe(false)
    const conflict = cards[1]!.props['install'] as { disabled: boolean; reason?: string }
    expect(conflict.disabled).toBe(true)
    // 直调卡片内层：禁用那枚旁边**真有一句看得见的原因**（`.esc-card-lock`，与广场同一条落点）。
    const locks = walk(renderCard(cards[1]!)).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(locks).toHaveLength(1)
    expect(locks[0]!.props['children']).toBe(String(conflict.reason))
    expect(String(conflict.reason)).toContain(ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE)
  })
})

/* ══════════════ ③ SkillHub 维度（单源浏览面） ══════════════ */

describe('③ SkillHub 维度：单源浏览面（位次/数量一字未动）', () => {
  it('第四枚页签的文案是 `SkillHub`，且完整说法挂在它的悬浮说明上', () => {
    expect(ENTERPRISE_ESC_COPY.mainTabSkillHub).toBe('SkillHub')
    expect(ENTERPRISE_ESC_LOCAL_COPY.skillHubTabTitle).toContain(ENTERPRISE_ESC_LOCAL_COPY.skillHubSourceTitle)
    // 撤掉的那一枚的文案**照旧留着**（那一面的代码本刀按 ① 不动，下一刀收编还要用它）。
    expect(ENTERPRISE_ESC_COPY.mainTabCatalog).toBe('企业技能')
  })

  it('★撤掉「企业技能」维度之后，**「应用商店 → 企业技能」那一枚照旧在**（内容不丢）', () => {
    const market = readSrc('marketplace-entry.tsx', SRC_DIR)
    /**
     * ★这一条盯的是本刀最容易误伤的那件事：撤维度时**顺手把应用商店那一枚也删了**。
     *   判据取应用商店自己的**页签真源 + 面板 id**（它与 esc 技能页那一枚是**两处不同的入口**）。
     */
    expect(market).toContain("{ id: 'skills', label: '技能' }")
    expect(market).toContain("skills: { tab: 'market-tab-skills', panel: 'market-panel-skills' }")
    expect(market).toContain("export const ENTERPRISE_MARKET_DEFAULT_TAB: EnterpriseMarketTabId = 'skills'")
    // esc 那一侧：那一枚页签**已经不在**（换成 SkillHub 了）。
    const toolbar = readSrc('esc-toolbar.tsx')
    expect(toolbar).not.toContain("value: 'catalog' as const")
    expect(toolbar).toContain("value: 'skillhub' as const")
    // 它那一族文案与那一面的代码仍在（下一刀收编时的落点）。
    expect(readSrc('esc-catalog-list.tsx').length).toBeGreaterThan(0)
  })

  it('★数据源**单源**：响应里没有 `sourceId`，投影层**零过滤**（那笔"只投影 skillhub.cn"的浪费已不存在）', () => {
    // ★**加强**（不是放宽）：改前锁的是"只投影 `sourceId === 'skillhub.cn'`"。
    //   本刀换了**单源**路由，响应里压根没有 `sourceId` ⇒ 那道过滤连同它服务的"四源投影"一起**删除**。
    //   ⇒ 锁换成更硬的一条：**这一族文件里不许再出现 `sourceId` 判据**（留着就是一句永远为真的死代码）。
    const hub = stripComments(readSrc('esc-skillhub.ts'))
    expect(hub).not.toContain('sourceId')
    expect(stripComments(readSrc('esc-skillhub-list.tsx'))).not.toContain('sourceId')
    // 单源那一面**照旧只服务 skillhub.cn** —— 这句真源（文案与说明句的唯一取值口）不撤。
    expect(ENTERPRISE_SKILLHUB_SOURCE_ID).toBe('skillhub.cn')
    expect(ENTERPRISE_SKILLHUB_SOURCE_TITLE).toContain('skillhub.cn')
    // ★**反向登记**：那条四源 fan-out 路由**一字未动**、仍服务「添加技能 → 在线搜索」那一面。
    const market = readSrc('marketplace-entry.tsx', SRC_DIR)
    expect(market).toContain('onlineApi.onlineSearchSkills(query, controller.signal)')
    expect(market).toContain('enterpriseOnlineFace(')
    const online = stripComments(readSrc('online-search.ts', SRC_DIR))
    expect(online).toContain('export function enterpriseOnlineFace(')
    expect(online).toContain('export function enterpriseOnlineResultRow(')
  })

  it('四态互斥 + **两句不同的"为什么空"**（未选分类 / 选中分类）', () => {
    const rows = browse({ skills: [hubSkill()] }).skills
    // 加载 / 失败各自只命中一档（失败带稳定码、**不带**任何"没有结果"的说法）。
    expect(enterpriseSkillHubFace({ state: { kind: 'loading' } })).toEqual({ kind: 'loading', rows: [] })
    const failed = enterpriseSkillHubFace({ state: { kind: 'failed', code: 'ENT_LOCAL_REQUEST_FAILED' } })
    expect(failed.kind).toBe('failed')
    expect(failed.failedCode).toBe('ENT_LOCAL_REQUEST_FAILED')
    expect(failed.emptyNote).toBeUndefined()
    // 有内容 ⇒ 就绪（**空态那一句一次都不许出现**）。
    const ready = enterpriseSkillHubFace({ state: { kind: 'ready', value: browse({ skills: [hubSkill()] }) } })
    expect(ready.kind).toBe('ready')
    expect(ready.rows).toHaveLength(1)
    expect(ready.emptyNote).toBeUndefined()
    // 未选分类（「全部」）而这一片空 ⇒ `no-result`。
    const noResult = enterpriseSkillHubFace({ state: { kind: 'empty', value: browse({ skills: [] }) } })
    expect(noResult.kind).toBe('empty')
    expect(noResult.emptyReason).toBe('no-result')
    expect(noResult.emptyNote).toBe(ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT)
    // 选中了一枚分类而那一类下空 ⇒ **另一句**（下一步不同：换分类 / 回「全部」）。
    const byCategory = enterpriseSkillHubFace({
      state: { kind: 'empty', value: browse({ skills: [] }) },
      category: 'dev-programming',
    })
    expect(byCategory.emptyReason).toBe('empty-category')
    expect(byCategory.emptyNote).toBe(ENTERPRISE_SKILLHUB_EMPTY_CATEGORY)
    expect(ENTERPRISE_SKILLHUB_EMPTY_CATEGORY).not.toBe(ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT)
    // ★**加强**：那一枚分类**有内容**时，「分类下没有内容」那句**一次都不许出现**（用户裁决明令）。
    const categoryWithContent = enterpriseSkillHubFace({
      state: { kind: 'ready', value: browse({ skills: [hubSkill()] }) },
      category: 'dev-programming',
    })
    expect(categoryWithContent.kind).toBe('ready')
    expect(categoryWithContent.emptyNote).toBeUndefined()
    expect(rows).toHaveLength(1)
    expect(ENTERPRISE_SKILLHUB_LOADING).toContain('SkillHub')
  })

  it('★安装：把响应里那条 `installSource` **原样回传**（界面不拼路径、不解析坐标、不接受用户输入）', () => {
    const row = enterpriseSkillHubFace({ state: READY }).rows[0]!
    const seen: string[] = []
    const plan = enterpriseSkillHubCardInstall({ row, wired: true, onInstall: () => { seen.push(row.installSource) } })
    expect(plan.disabled).toBe(false)
    plan.onInstall!()
    // 回传的就是响应里那一枚（`skillhub.cn:dev-expert@1.2.3`），一个字符都没被加工。
    expect(seen).toEqual(['skillhub.cn:dev-expert@1.2.3'])
    expect(seen[0]).toBe(HUB_SKILL.installSource)
    /**
     * ★**源码级反向锁**：本维度这一族文件里**不许出现任何路径/ URL 构造** ——
     *   不许 `join(`、不许 `split(':'`/解析坐标、不许 `encodeURIComponent`（查询串的编码只归
     *   `local-api.ts` 那一处唯一构造器）、不许把 `~` 与目录名拼起来（那是"本地三方"那条通路的靶心）。
     */
    for (const name of ['esc-skillhub.ts', 'esc-skillhub-list.tsx']) {
      const code = stripComments(readSrc(name))
      for (const pattern of [/join\(/, /split\(\s*['"`]/, /encodeURIComponent/, /~/, /webkitdirectory/, /showDirectoryPicker/, /https?:\/\//, /skillhub\.cn:/]) {
        expect(code, `${name} 不许出现 ${String(pattern)}`).not.toMatch(pattern)
      }
      expect(code, `${name} 不许自己发请求`).not.toContain('fetch(')
    }
    // ★**加强**：坐标**原样**出现在装配里（`id` 与回填坐标**同源**，没有第二次 derivation）。
    expect(enterpriseSkillHubCardItem(row)).toEqual({
      id: 'skillhub.cn:dev-expert@1.2.3',
      name: 'dev-expert',
      description: '一句话说明',
    })
  })

  it('★安装四档：在途 / 被别的挡住 / 端口缺席 / 可点 —— 禁用**必带可见原因**', () => {
    const row = enterpriseSkillHubFace({ state: READY }).rows[0]!
    const onInstall = (): void => undefined
    expect(enterpriseSkillHubCardInstall({ row, wired: true, onInstall }).disabled).toBe(false)
    const self = enterpriseSkillHubCardInstall({ row, wired: true, busy: { source: row.installSource, name: row.name }, onInstall })
    expect(self.busy).toBe(true)
    expect(self.text).toBe(ENTERPRISE_SKILLHUB_INSTALLING)
    expect(self.onInstall).toBeUndefined()
    const blocked = enterpriseSkillHubCardInstall({ row, wired: true, busy: { source: 'other:9', name: 'X' }, onInstall })
    expect(blocked.reason).toBe(ENTERPRISE_SKILLHUB_BLOCKED_BY_BUSY)
    expect(blocked.onInstall).toBeUndefined()
    const orphan = enterpriseSkillHubCardInstall({ row, wired: false, onInstall })
    expect(orphan.reason).toBe(ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED)
    expect(orphan.onInstall).toBeUndefined()
    expect(ENTERPRISE_SKILLHUB_INSTALL).toBe('安装')
  })

  it('★呈现层：结果卡与广场同一骨架（`.esc-list-section > .esc-catalog-cell > 同一张卡`），四态各只画一档', () => {
    const tree = EnterpriseEscSkillHubList({ state: READY, onReload: () => undefined, page: 1 })
    const states = walk(tree).filter(each => typeof each.props['data-esc-skillhub-state'] === 'string')
    expect(states.map(each => each.props['data-esc-skillhub-state'])).toEqual(['ready'])
    const section = byClass(tree, 'esc-list-section')!
    const cells = walk(section).filter(each => String(each.props['className']) === 'esc-catalog-cell')
    expect(cells).toHaveLength(1)
    expect(cells[0]!.props['data-esc-skillhub-result']).toBe('skillhub.cn:dev-expert@1.2.3')
    const cards = cardsOf(cells[0])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.props['iconShape']).toBe('square')
    expect(cards[0]!.props['showUse']).toBe(true)
    // 失败态：唯一提示组件 + 真重发的重试。
    const failed = EnterpriseEscSkillHubList({ state: { kind: 'failed', code: 'ENT_LOCAL_REQUEST_FAILED' }, onReload: () => undefined })
    expect(walk(failed).map(each => each.props['data-esc-skillhub-state']).filter(Boolean)).toEqual(['failed'])
    expect(byClass(failed, 'esc-import-error')).toBeTruthy()
    // 空态：未选分类 = `no-result`；选中分类 = `empty-category`（两句**逐字不同**）。
    const emptyAll = EnterpriseEscSkillHubList({ state: { kind: 'empty', value: browse({ skills: [] }) }, onReload: () => undefined })
    expect(walk(emptyAll).map(each => each.props['data-esc-skillhub-empty']).filter(Boolean)).toEqual(['no-result'])
    const emptyCategory = EnterpriseEscSkillHubList({
      state: { kind: 'empty', value: browse({ skills: [] }) },
      category: 'dev-programming',
      onReload: () => undefined,
    })
    expect(walk(emptyCategory).map(each => each.props['data-esc-skillhub-empty']).filter(Boolean)).toEqual(['empty-category'])
  })

  it('★呈现层：已装那一档不画【＋】（与广场同一条判据）；在途/禁用原因都**行上可见**', () => {
    const installed = EnterpriseEscSkillHubList({
      state: READY,
      installedSources: ['skillhub.cn:dev-expert@1.2.3'],
      onReload: () => undefined,
    })
    const card = cardsOf(installed)[0]!
    expect(card.props['installed']).toBe(true)
    expect(card.props['install']).toBeUndefined()
    // 未装那一档：直调卡片内层能看到那枚**可点**的圆形【＋】。
    const fresh = EnterpriseEscSkillHubList({ state: READY, onInstall: () => undefined, onReload: () => undefined })
    const liveButton = asElement(byClass(renderCard(cardsOf(fresh)[0]!), 'esc-install-plus'))
    expect(liveButton.props['disabled']).toBe(false)
    expect(liveButton.props['aria-label']).toBe(`${ENTERPRISE_SKILLHUB_INSTALL}dev-expert`)
    // 在途那一条：卡片把「正在安装…」写进行上（不是只挂 title）。
    const busy = EnterpriseEscSkillHubList({
      state: READY,
      busy: { source: 'skillhub.cn:dev-expert@1.2.3', name: 'dev-expert' },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    const busyCard = cardsOf(busy)[0]!
    expect(busyCard.props['installed']).toBe(false)
    const locks = walk(renderCard(busyCard)).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(locks).toHaveLength(1)
    expect(locks[0]!.props['children']).toBe(ENTERPRISE_SKILLHUB_INSTALLING)
  })

  /* ── ★ 本刀新增的五把锁（逐条对应用户裁决） ── */

  it('★锁①：挂载即发一趟**不带 `q`** 的浏览请求，URL 形状逐字、排序显式为 `downloads`', async () => {
    /**
     * ★这是「进页面自动显示」的**唯一**可测落点：取数面是一个**注入的假**，
     *   我们只看它**收到了哪个查询串**——真机上"进页面就有内容"就是这件事。
     */
    const calls: string[] = []
    const fetcher = (async (url: string) => {
      calls.push(url)
      return jsonResponse({ data: browse({ skills: [hubSkill()], page: 1, hasMore: false }) })
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    // ★查询串由**唯一构造器**产出（编码与取舍全包只有它一处），界面那一侧拼不出来。
    const url = `${ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH}${skillhubBrowseQuery({
      sort: ENTERPRISE_SKILLHUB_DEFAULT_SORT,
      page: ENTERPRISE_SKILLHUB_FIRST_PAGE,
    })}`
    // ★形状逐字：**没有 `q`**（浏览模式）、`sort=downloads`、`page=1`。
    expect(url).toBe('/enterprise/api/v1/local/skills/skillhub?sort=downloads&page=1')
    expect(url).not.toContain('q=')
    // 真发一趟（证明这条路径与那个解码器确实是通的）。
    await expect(api.browseSkillhubSkills(
      skillhubBrowseQuery({ sort: ENTERPRISE_SKILLHUB_DEFAULT_SORT, page: ENTERPRISE_SKILLHUB_FIRST_PAGE }),
      new AbortController().signal,
    )).resolves.toMatchObject({ page: 1, hasMore: false })
    expect(calls).toEqual(['/enterprise/api/v1/local/skills/skillhub?sort=downloads&page=1'])
    // ★**默认排序就是下载量**，且**界面显式传**（宿主不替你选、界面也不靠"不发 sort"来蒙对）。
    expect(ENTERPRISE_SKILLHUB_DEFAULT_SORT).toBe('downloads')
    // ★★**加强**（本条锁的第一版太弱、被一次红绿演练当场抓住）：上面验的是**构造器**的输出，
    //   而"挂载那一趟到底带不带 `q`"是**聚合层那次调用**的事 —— 构造器对了不代表调用方没塞一个空 `q`。
    //   故这里**再咬一次调用点的源码形状**：那一行必须逐字是"空串就不带 q"，
    //   且 `sort`/`page` 两格**显式**在场（不是靠"不发 sort 就蒙对 downloads"）。
    const agg = readSrc('esc-aggregation.tsx')
    expect(agg).toContain("...(keyword === '' ? {} : { q: keyword }),")
    expect(agg).not.toContain('q: keyword,')
    expect(agg).toContain("sort: ENTERPRISE_SKILLHUB_DEFAULT_SORT,")
    expect(agg).toContain('page: skillHubPage,')
    // ★那次调用确实**经由唯一构造器**（界面自己拼查询串是第二份真值）。
    expect(agg).toContain('void api.browseSkillhubSkills(')
    expect(agg).toContain('skillhubBrowseQuery({')
    // ★这一族文件里**零** `encodeURIComponent`（编码只归 `local-api.ts` 那一处）。
    for (const file of ['esc-skillhub.ts', 'esc-skillhub-list.tsx', 'esc-aggregation.tsx']) {
      expect(stripComments(readSrc(file)), file).not.toContain('encodeURIComponent')
    }
    // ★**本刀不做排序控件**（YAGNI）：界面上**没有任何**排序控件的痕迹（下一版登记）。
    const list = stripComments(readSrc('esc-skillhub-list.tsx'))
    expect(list).not.toContain('排序')
    expect(list).not.toMatch(/sort/i)
    // ★查询串构造器：**非空才带**、顺序固定、编码只有这一处。
    expect(skillhubBrowseQuery({})).toBe('')
    expect(skillhubBrowseQuery({ q: '', category: '', sort: 'downloads', page: 1 })).toBe('?sort=downloads&page=1')
    expect(skillhubBrowseQuery({ q: 'a b', category: 'pay-skill', sort: 'downloads', page: 2 }))
      .toBe('?q=a+b&category=pay-skill&sort=downloads&page=2')
  })

  it('★锁②：输入 1 个字**不清空已有内容**（且一条请求都不发）', () => {
    /**
     * ★判据落在**取数那一层**：半截输入时那一格是 `return undefined`（不是 `setState`）⇒
     *   状态**原封不动**留在上一次那批结果上。这就是"1 个字不许把已有内容清空"的**实现形状**。
     */
    const agg = readSrc('esc-aggregation.tsx')
    // 那道闸：不足下限 ⇒ `return undefined`（一个 `setState` 都不得有）。
    expect(agg).toContain('if (!skillHubQueryReady) return undefined')
    // 闸的位置在 `setSkillHubState({ kind: \'loading\' })` **之前**（否则它已经清空了）。
    const gate = agg.indexOf('if (!skillHubQueryReady) return undefined')
    const loading = agg.indexOf("setSkillHubState({ kind: 'loading' })", gate)
    expect(loading).toBeGreaterThan(gate)
    // ★那一档的**两句空态已整族删除**（本仓不留死句子）：源码里一个字都不许有。
    for (const file of ['esc-skillhub.ts', 'esc-skillhub-list.tsx', 'esc-aggregation.tsx']) {
      const code = stripComments(readSrc(file))
      expect(code, `${file} 不许再有"还没搜"那一档`).not.toContain('no-query')
      expect(code, `${file} 不许再有"太短"那一档`).not.toContain('too-short')
    }
    // 纯投影层：**没有任何**"输入不够长 ⇒ 查不到档位"的入口（`EnterpriseSkillHubEmptyReason` 只有两档）。
    expect(emptyReasons).toEqual(['no-result', 'empty-category'])
    expect(ENTERPRISE_SKILLHUB_QUERY_MIN).toBe(2)
    // ★**加强**：聚合层**不再**引用在线搜索那条查询档位判据了（浏览是默认形态）。
    expect(stripComments(agg)).not.toContain('enterpriseOnlineQueryState')
  })

  it('★锁③：`categories` 缺席 ⇒ chip 整排不画 **且** 选中回「全部」', () => {
    // ★**缺席 ⇒ 连「全部」都不给**（`chips` 是**空**清单 ⇒ 那一排**整排不画**）。
    //   ★这是与另两枚维度**刻意不同**的一条：它们的「全部」是一枚永远在场的退路，
    //   而这一维的「全部」只在**真的有那张分类表**时才有意义 —— 一枚孤零零的「全部」
    //   会让人以为"点它能回到某个完整的列表"，而那时我们手上**没有任何分类可选**。
    for (const selected of ['', 'dev-programming']) {
      const absent = enterpriseSkillHubCategoryChips(undefined, selected)
      expect(absent.chips, selected).toEqual([])
      expect(absent.activeKey, selected).toBe('')
    }
    // 空数组（宿主给了张**空**表）与**整键缺席**同判。
    expect(enterpriseSkillHubCategoryChips([], '').chips).toEqual([])
    // ★**选中回「全部」**：三类缺席场景 —— 键不在场 / 选中的那枚这轮没出现 / 从未选过。
    for (const selected of ['', 'dev-programming', 'pay-skill']) {
      expect(enterpriseSkillHubCategoryChips(undefined, selected).activeKey, selected).toBe('')
    }
    // 在场时：★**顺序照宿主给的原样**（不重排）+ 中文名 + 「全部」恒在首位 + 选中保持。
    const present = enterpriseSkillHubCategoryChips(CATEGORIES, 'life-service')
    expect(present.chips.map(chip => chip.label)).toEqual([
      '全部', '办公效率', '内容创作', '开发编程', '生活服务', 'Pay Skill',
    ])
    expect(present.activeKey).toBe('life-service')
    // ★**缺席时整排不画**：呈现层那一次渲染里，**一枚 chip 都不许出现**
    // （"缺席"≠"没有分类" ⇒ 画一排空胶囊就是"看着还能用"的死控件）。
    const tree = EnterpriseEscSkillHubList({
      state: { kind: 'ready', value: browse({ skills: [hubSkill()], categories: undefined }) },
      onReload: () => undefined,
      onCategoryChange: () => undefined,
    })
    expect(walk(tree).filter(each => each.props['data-esc-subtab'] !== undefined)).toEqual([])
    // ★在场时**真画出来**（锁③的另一半：不是"永远不画"，是"没有才不画"）。
    const withChips = EnterpriseEscSkillHubList({
      state: { kind: 'ready', value: browse({ skills: [hubSkill()], categories: CATEGORIES }) },
      onReload: () => undefined,
      onCategoryChange: () => undefined,
    })
    //   ★「全部」那一枚的 `data-esc-subtab` 是空串（空 key 是它的身份），故用 `!== undefined` 收集、不用 truthy。
    expect(walk(withChips).map(each => each.props['data-esc-subtab']).filter(v => v !== undefined)).toEqual([
      '', 'office-efficiency', 'content-creation', 'dev-programming', 'life-service', 'pay-skill',
    ])
    // ★**点某枚 chip 就带 `category` 重取、页码归 1**：判据落在聚合层那枚动作上。
    const agg = readSrc('esc-aggregation.tsx')
    expect(agg).toContain('const onSelectSkillHubCategory = useCallback((key: string): void => {')
    expect(agg).toContain('setSkillHubCategory(key)\n    setSkillHubPage(ENTERPRISE_SKILLHUB_FIRST_PAGE)')
  })

  it('★锁④：`hasMore === false` ⇒ 那枚「加载更多」不画，**且聚合层一次都不再取**', () => {
    // 纯投影：唯一点（`hasMore` 必为真，且页码没触 20 的上限）。
    expect(enterpriseSkillHubHasNextPage({ hasMore: false, page: 1 })).toBe(false)
    expect(enterpriseSkillHubHasNextPage({ hasMore: true, page: 1 })).toBe(true)
    // ★**加强**：页码触上限 ⇒ 也不画（宿主那边会判 400 —— 不发那个注定失败的请求）。
    expect(enterpriseSkillHubHasNextPage({ hasMore: true, page: ENTERPRISE_SKILLHUB_PAGE_MAX })).toBe(false)
    expect(enterpriseSkillHubHasNextPage({ hasMore: true, page: ENTERPRISE_SKILLHUB_PAGE_MAX - 1 })).toBe(true)
    // 呈现层：`hasMore: false` ⇒ **整枚按钮不画**（连一句"到底了"都不说）。
    const exhausted = EnterpriseEscSkillHubList({
      state: { kind: 'ready', value: browse({ skills: [hubSkill()], hasMore: false }) },
      onReload: () => undefined,
      onLoadMore: () => undefined,
      page: 1,
    })
    expect(walk(exhausted).filter(each => each.props['aria-label'] === ENTERPRISE_SKILLHUB_LOAD_MORE)).toEqual([])
    // 有下一页 ⇒ 画，且点它**真的**回调一次。
    let clicked = 0
    const more = EnterpriseEscSkillHubList({
      state: { kind: 'ready', value: browse({ skills: [hubSkill()], hasMore: true }) },
      onReload: () => undefined,
      onLoadMore: () => { clicked += 1 },
      page: 1,
    })
    const button = walk(more).find(each => each.props['aria-label'] === ENTERPRISE_SKILLHUB_LOAD_MORE)
    expect(button).toBeTruthy()
    ;(button!.props['onClick'] as () => void)()
    expect(clicked).toBe(1)
    // ★**取数侧**：聚合层那枚动作先问 `hasMore`（ref 镜像），不满足直接 `return`（**不发**）。
    const agg = readSrc('esc-aggregation.tsx')
    expect(agg).toContain('const onLoadMoreSkillHub = useCallback((): void => {')
    expect(agg).toContain('if (!skillHubHasMoreRef.current) return')
  })

  it('★本刀的清理：这一维**不再**用 `/skills/online-search`；`esc-api.ts` 里那枚也已删', () => {
    // ① 这一族文件里**零**四源痕迹（路径 / 方法 / 那套投影类型）。
    for (const file of ['esc-skillhub.ts', 'esc-skillhub-list.tsx']) {
      const code = stripComments(readSrc(file))
      expect(code, file).not.toContain('online-search')
      expect(code, file).not.toContain('onlineSearchSkills')
      expect(code, file).not.toContain('EnterpriseOnlineSkill')
    }
    const agg = stripComments(readSrc('esc-aggregation.tsx'))
    expect(agg).not.toContain('api.onlineSearchSkills')
    expect(agg).not.toContain('EnterpriseOnlineSkillSearch')
    // ② `esc-api.ts` 里那枚 `onlineSearchSkills` 因**再无消费者**已删（不留死代码）。
    const api = stripComments(readSrc('esc-api.ts'))
    expect(api).not.toContain('onlineSearchSkills')
    expect(api).toContain('browseSkillhubSkills')
    // ③ ★**应用商店那条面里仍在用的路径一字不许动**（「添加技能 → 在线搜索」照旧）。
    const market = stripComments(readSrc('marketplace-entry.tsx', SRC_DIR))
    expect(market).toContain('onlineApi.onlineSearchSkills(query, controller.signal)')
    expect(market).toContain('enterpriseOnlineFace(props.state, props.query')
    expect(stripComments(readSrc('local-api.ts', SRC_DIR))).toContain('ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH')
    expect(stripComments(readSrc('local-api-decode.ts', SRC_DIR))).toContain('onlineSearchSkills(query: string, signal: AbortSignal)')
    // ④ 全 `src` 里 `enterpriseOnlineFace` 的**消费者只有应用商店那一处**（本仓真的换了单源面）。
    //    ★判据排除**定义文件自己**那一处 `export function …(` —— 它是"给谁用的"不是"谁在用"。
    const consumers = allSrcFiles()
      .map(file => ({
        name: file.name,
        count: (stripComments(file.code).match(/enterpriseOnlineFace\(/g) ?? []).length,
      }))
      .filter(each => each.count > 0)
      .filter(each => each.name !== 'online-search.ts')
      .map(each => each.name)
    expect(consumers).toEqual(['marketplace-entry.tsx'])
    //    ★而定义文件里**只有那一枚** `enterpriseOnlineFace`（没有第二个同义投影）。
    expect((stripComments(readSrc('online-search.ts', SRC_DIR)).match(/export function enterpriseOnlineFace\(/g) ?? []).length).toBe(1)
  })

  it('★解码器：关闭键集 + 「缺席 ≠ 0」，且坐标串去重', () => {
    // 「上游没说」≠「说是 0」：`downloads: 0` **留着**、缺席**不产出**。
    expect(decodeEnterpriseSkillhubBrowse({
      skills: [{ name: 'a', slug: 'a', installSource: 'skillhub.cn:a@1', downloads: 0 }],
      page: 1,
      hasMore: false,
    }).skills[0]!.downloads).toBe(0)
    expect(decodeEnterpriseSkillhubBrowse({
      skills: [{ name: 'a', slug: 'a', installSource: 'skillhub.cn:a@1' }],
      page: 1,
      hasMore: false,
    }).skills[0]).toEqual({ name: 'a', slug: 'a', installSource: 'skillhub.cn:a@1' })
    // `categories` 整键缺席**合法**（"没有证据说有" ≠ "说是没有"）。
    expect(decodeEnterpriseSkillhubBrowse({ skills: [], page: 1, hasMore: false }).categories).toBeUndefined()
    // 关闭键集：多一枚上游字段即整条判畸形。
    for (const bad of [
      { skills: [], page: 1, hasMore: false, upstreamUrl: 'https://skillhub.cn' },
      { skills: [{ name: 'a', slug: 'a', installSource: 'x', namespace: 'ns' }], page: 1, hasMore: false },
      { page: 1, hasMore: false },
      { skills: [], hasMore: false },
      { skills: [], page: 0, hasMore: false },
      { skills: [], page: 21, hasMore: false },
      { skills: [], page: 1, hasMore: 'false' },
      // ★`categories` **不是**数组 = 协议畸形（整条判死）；但**数组里**一枚形状不合**按枚丢掉**（见下）。
      { skills: [], page: 1, hasMore: false, categories: { key: 'k', name: 'x' } },
      { skills: [], page: 1, hasMore: false, total: -1 },
    ]) {
      expect(() => decodeEnterpriseSkillhubBrowse(bad), JSON.stringify(bad)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 坐标串去重（点第二行的【＋】不能装第一行那条技能）。
    expect(() => decodeEnterpriseSkillhubBrowse({
      skills: [
        { name: 'a', slug: 'a', installSource: 'skillhub.cn:a@1' },
        { name: 'b', slug: 'a', installSource: 'skillhub.cn:a@1' },
      ],
      page: 1,
      hasMore: false,
    })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // ★形状不合的那一枚分类**按枚丢掉**（元数据表，一枚坏的不拖垮整张表），重复 key 也去重。
    expect(decodeEnterpriseSkillhubBrowse({
      skills: [],
      page: 1,
      hasMore: false,
      categories: [
        { key: 'dev', name: '开发编程' },
        { key: 'dev' },
        'nope',
        { key: 'dev', name: '重复' },
        { key: 'pay', name: 'Pay Skill' },
      ],
    }).categories).toEqual([{ key: 'dev', name: '开发编程' }, { key: 'pay', name: 'Pay Skill' }])
    // ★**零第二份解码器**：全 `src` 里 `export function decodeEnterpriseSkillhubBrowse(` **恰好一处**，
    //   而**调用**（`decodeEnterpriseSkillhubBrowse(`）**恰好一处**（`local-api.ts` 那个委托格里）。
    //   声明与调用分开数，是为了"有人复制一份解码器"与"有人写了第二处取数"都当场红。
    const declarations = allSrcFiles()
      .map(file => ({
        name: file.name,
        count: (stripComments(file.code).match(/export function decodeEnterpriseSkillhubBrowse\(/g) ?? []).length,
      }))
      .filter(each => each.count > 0)
    expect(declarations).toEqual([{ name: 'skill-api-decode.ts', count: 1 }])
    const callers = allSrcFiles()
      .map(file => ({
        name: file.name,
        count: (stripComments(file.code).match(/decodeEnterpriseSkillhubBrowse\(/g) ?? []).length,
      }))
      .filter(each => each.count > 0)
    expect(callers).toEqual([{ name: 'local-api.ts', count: 1 }, { name: 'skill-api-decode.ts', count: 1 }])
  })

  it('装配的既有性质没被这一刀碰坏（刚装那一枚只显示「去试试」；隐藏规则仍只认磁盘真值）', () => {
    // 顺手回归：本刀只**换面**，没有动这枚装配自己的两条硬口径。
    expect(enterpriseEscSkillCardSpec({ installed: false, justInstalled: true, install: { text: 'X', disabled: false, title: 't', ariaLabel: 'a' } }))
      .toEqual({ iconShape: 'square', showUse: true, installed: true })
    expect(enterpriseEscSkillCardHidden({ name: 'n', installedNames: new Set(['n']), justInstalledSkillName: 'n' })).toBe(false)
    expect(enterpriseEscSkillCardHidden({ name: 'n', installedNames: new Set(['n']) })).toBe(true)
    expect(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY).toEqual({})
    expect(cardsOf(EnterpriseEscThirdPartyList({ state: { kind: 'loading' }, onReload: () => undefined }))).toEqual([])
  })
})

/** 那枚浏览结果行的类型再出口（本文件只用它的形状，不新造第二份）。 */
export type { EnterpriseSkillhubSkill }
