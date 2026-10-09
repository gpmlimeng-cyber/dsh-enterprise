/**
 * [INPUT]: 依赖 `esc-skill-card.ts`（**唯一装配点** `enterpriseEscSkillCardSpec`）、`esc-skillhub.ts` /
 *   `esc-skillhub-list.tsx`（本刀 ③ 那一维度的纯事实层与呈现层）、`esc-third-party.ts` /
 *   `esc-third-party-list.tsx`（本刀 ② 换卡后的纯适配器与骨架）、`esc-card.tsx`（卡片两枚导出）、
 *   `esc-copy.ts` 的维度文案，以及 `node:fs`（源码级反向锁与"构造点各恰一处"的计数）
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
  ENTERPRISE_SKILLHUB_EMPTY_NO_QUERY,
  ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT,
  ENTERPRISE_SKILLHUB_INSTALL,
  ENTERPRISE_SKILLHUB_INSTALLING,
  ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED,
  ENTERPRISE_SKILLHUB_LOADING,
  ENTERPRISE_SKILLHUB_SOURCE_DOWN,
  ENTERPRISE_SKILLHUB_SOURCE_ID,
  enterpriseSkillHubCardInstall,
  enterpriseSkillHubCardItem,
  enterpriseSkillHubFace,
} from '../src/esc/esc-skillhub.js'
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
import type { EnterpriseOnlineSkillResult, EnterpriseOnlineSkillSearch, EnterpriseThirdPartySkill } from '../src/skill-api-decode.js'

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

/** 一次在线搜索的四源 fan-out（本刀 ③ 的**已知浪费**：界面只用 skillhub.cn 那一源）。 */
const FOUR_SOURCE_SEARCH: EnterpriseOnlineSkillSearch = {
  sources: [
    { id: 'skills.sh', ok: true },
    { id: 'claude-plugins.dev', ok: true },
    { id: 'clawhub.ai', ok: true },
    { id: ENTERPRISE_SKILLHUB_SOURCE_ID, ok: true },
  ],
  results: [
    { sourceId: 'skills.sh', name: 'from-skills-sh', installSource: 'skills-sh:1' },
    { sourceId: 'claude-plugins.dev', name: 'from-claude-plugins', installSource: 'claude-plugins:2' },
    { sourceId: 'clawhub.ai', name: 'from-clawhub', installSource: 'clawhub:3' },
    {
      sourceId: ENTERPRISE_SKILLHUB_SOURCE_ID,
      name: 'from-skillhub',
      description: '一句话说明',
      installSource: 'skillhub:4',
    },
  ],
}
const READY: { kind: 'ready'; value: EnterpriseOnlineSkillSearch } = { kind: 'ready', value: FOUR_SOURCE_SEARCH }

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

/* ══════════════ ③ SkillHub 维度 ══════════════ */

describe('③ SkillHub 维度：名字与来源都换（位次/数量一字未动）', () => {
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

  it('★数据源**只投影 `sourceId === \'skillhub.cn\'` 那批**（四源 fan-out 的另三源被丢弃 = 已知浪费）', () => {
    const face = enterpriseSkillHubFace(READY, 'code review')
    expect(face.kind).toBe('ready')
    expect(face.rows.map(row => row.name)).toEqual(['from-skillhub'])
    // 另三源的结果**一条都不许**上屏（"把四源全画出来"就是这条锁要咬的改法）。
    for (const name of ['from-skills-sh', 'from-claude-plugins', 'from-clawhub']) {
      expect(face.rows.some(row => row.name === name), name).toBe(false)
    }
    // 判据是那一枚常量（改来源时只需改一处）。
    expect(ENTERPRISE_SKILLHUB_SOURCE_ID).toBe('skillhub.cn')
    // ★源码级：过滤只发生在 `esc-skillhub.ts` 那一处（视图不许再滤一遍）。
    const hub = readSrc('esc-skillhub.ts')
    expect(hub.match(/result\.sourceId === ENTERPRISE_SKILLHUB_SOURCE_ID/g) ?? []).toHaveLength(1)
    expect(readSrc('esc-skillhub-list.tsx')).not.toContain('sourceId')
  })

  it('四态互斥 + **两句不同的"为什么空"** + 这一源自己那句坏消息分开说', () => {
    // 还没搜（空 key / 太短）：两句措辞，但都属于"还没到门槛"那一类 —— 与"搜了没有"是两件事。
    const idle = enterpriseSkillHubFace(READY, '')
    expect(idle.kind).toBe('empty')
    expect(idle.emptyReason).toBe('no-query')
    expect(idle.emptyNote).toBe(ENTERPRISE_SKILLHUB_EMPTY_NO_QUERY)
    expect(idle.rows).toEqual([])
    const tooShort = enterpriseSkillHubFace(READY, 'a')
    expect(tooShort.emptyReason).toBe('too-short')
    // 加载 / 失败各自只命中一档（失败带稳定码、**不带**任何"没有结果"的说法）。
    expect(enterpriseSkillHubFace({ kind: 'loading' }, 'code review')).toEqual({ kind: 'loading', rows: [] })
    const failed = enterpriseSkillHubFace({ kind: 'failed', code: 'ENT_LOCAL_REQUEST_FAILED' }, 'code review')
    expect(failed.kind).toBe('failed')
    expect(failed.failedCode).toBe('ENT_LOCAL_REQUEST_FAILED')
    expect(failed.emptyNote).toBeUndefined()
    // 搜了、没匹配：另一句（与"还没搜"那句**逐字不同**）。
    const noResult = enterpriseSkillHubFace({ kind: 'empty', value: { sources: [{ id: ENTERPRISE_SKILLHUB_SOURCE_ID, ok: true }], results: [] } }, 'code review')
    expect(noResult.kind).toBe('empty')
    expect(noResult.emptyReason).toBe('no-result')
    expect(noResult.emptyNote).toBe(ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT)
    expect(ENTERPRISE_SKILLHUB_EMPTY_NO_QUERY).not.toBe(ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT)
    // 这一源自己没取到 ⇒ 单独一句（与"没有结果"分开说），且在**就绪态照铺**。
    const down = enterpriseSkillHubFace({
      kind: 'ready',
      value: { sources: [{ id: ENTERPRISE_SKILLHUB_SOURCE_ID, ok: false }], results: FOUR_SOURCE_SEARCH.results },
    }, 'code review')
    expect(down.kind).toBe('ready')
    expect(down.sourceNote).toBe(ENTERPRISE_SKILLHUB_SOURCE_DOWN)
    expect(down.sourceNote).not.toBe(ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT)
    // 加载那句是独立的（就绪播报复用在线搜索那一面既有那枚文案，不新写一份）。
    expect(ENTERPRISE_SKILLHUB_LOADING).toContain('SkillHub')
  })

  it('★安装：把响应里那条 `installSource` **原样回传**（界面不拼路径、不接受用户输入）', () => {
    const row = enterpriseSkillHubFace(READY, 'code review').rows[0]!
    const seen: string[] = []
    const plan = enterpriseSkillHubCardInstall({ row, wired: true, onInstall: () => { seen.push(row.installSource) } })
    expect(plan.disabled).toBe(false)
    plan.onInstall!()
    // 回传的就是响应里那一枚（`skillhub:4`），一个字符都没被加工。
    expect(seen).toEqual(['skillhub:4'])
    expect(seen[0]).toBe(FOUR_SOURCE_SEARCH.results[3]!.installSource)
    /**
     * ★**源码级反向锁**：本维度这一族文件里**不许出现任何路径/ URL 构造** ——
     *   不许 `join(`、不许 `split(':'`/解析坐标、不许 `encodeURIComponent`（查询串的编码只归
     *   `local-api.ts` 那一处）、不许把 `~` 与目录名拼起来（那是"本地三方"那条通路的靶心，同样适用）。
     */
    for (const name of ['esc-skillhub.ts', 'esc-skillhub-list.tsx']) {
      const code = stripComments(readSrc(name))
      for (const pattern of [/join\(/, /split\(\s*['"`]/, /encodeURIComponent/, /~/, /webkitdirectory/, /showDirectoryPicker/, /https?:\/\//]) {
        expect(code, `${name} 不许出现 ${String(pattern)}`).not.toMatch(pattern)
      }
      expect(code, `${name} 不许自己发请求`).not.toContain('fetch(')
    }
  })

  it('★安装四档：在途 / 被别的挡住 / 端口缺席 / 可点 —— 禁用**必带可见原因**', () => {
    const row = enterpriseSkillHubFace(READY, 'code review').rows[0]!
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
    // 卡片的 `item` 就是那一枚坐标（React key 与回填坐标只有一处 derivation）。
    expect(enterpriseSkillHubCardItem(row)).toEqual({ id: 'skillhub:4', name: 'from-skillhub', description: '一句话说明' })
    expect(ENTERPRISE_SKILLHUB_INSTALL).toBe('安装')
  })

  it('★呈现层：结果卡与广场同一骨架（`.esc-list-section > .esc-catalog-cell > 同一张卡`），四态各只画一档', () => {
    const tree = EnterpriseEscSkillHubList({ state: READY, query: 'code review', onInstall: () => undefined, onReload: () => undefined })
    const states = walk(tree).filter(each => typeof each.props['data-esc-skillhub-state'] === 'string')
    expect(states.map(each => each.props['data-esc-skillhub-state'])).toEqual(['ready'])
    const section = byClass(tree, 'esc-list-section')!
    const cells = walk(section).filter(each => String(each.props['className']) === 'esc-catalog-cell')
    expect(cells).toHaveLength(1)
    expect(cells[0]!.props['data-esc-skillhub-result']).toBe('skillhub:4')
    const cards = cardsOf(cells[0])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.props['iconShape']).toBe('square')
    expect(cards[0]!.props['showUse']).toBe(true)
    // 失败态：唯一提示组件 + 真重发的重试；空态：两句不同的"为什么空"（**不是**同一句）。
    const failed = EnterpriseEscSkillHubList({ state: { kind: 'failed', code: 'ENT_LOCAL_REQUEST_FAILED' }, query: 'x y', onReload: () => undefined })
    expect(walk(failed).map(each => each.props['data-esc-skillhub-state']).filter(Boolean)).toEqual(['failed'])
    expect(byClass(failed, 'esc-import-error')).toBeTruthy()
    const emptyIdle = EnterpriseEscSkillHubList({ state: READY, query: '', onReload: () => undefined })
    expect(walk(emptyIdle).map(each => each.props['data-esc-skillhub-empty']).filter(Boolean)).toEqual(['no-query'])
    const emptyNoResult = EnterpriseEscSkillHubList({
      state: { kind: 'empty', value: { sources: [{ id: ENTERPRISE_SKILLHUB_SOURCE_ID, ok: true }], results: [] } },
      query: 'x y',
      onReload: () => undefined,
    })
    expect(walk(emptyNoResult).map(each => each.props['data-esc-skillhub-empty']).filter(Boolean)).toEqual(['no-result'])
  })

  it('★呈现层：已装那一档不画【＋】（与广场同一条判据）；在途/禁用原因都**行上可见**', () => {
    const installed = EnterpriseEscSkillHubList({
      state: READY,
      query: 'code review',
      installedSources: ['skillhub:4'],
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    const card = cardsOf(installed)[0]!
    expect(card.props['installed']).toBe(true)
    expect(card.props['install']).toBeUndefined()
    // 未装那一档：直调卡片内层能看到那枚**可点**的圆形【＋】。
    const fresh = EnterpriseEscSkillHubList({ state: READY, query: 'code review', onInstall: () => undefined, onReload: () => undefined })
    const liveButton = asElement(byClass(renderCard(cardsOf(fresh)[0]!), 'esc-install-plus'))
    expect(liveButton.props['disabled']).toBe(false)
    expect(liveButton.props['aria-label']).toBe(`${ENTERPRISE_SKILLHUB_INSTALL}from-skillhub`)
    // 在途那一条：卡片把「正在安装…」写进行上（不是只挂 title）。
    const busy = EnterpriseEscSkillHubList({
      state: READY,
      query: 'code review',
      busy: { source: 'skillhub:4', name: 'from-skillhub' },
      onInstall: () => undefined,
      onReload: () => undefined,
    })
    const busyCard = cardsOf(busy)[0]!
    expect(busyCard.props['installed']).toBe(false)
    const locks = walk(renderCard(busyCard)).filter(each => String(each.props['className']) === 'esc-card-lock')
    expect(locks).toHaveLength(1)
    expect(locks[0]!.props['children']).toBe(ENTERPRISE_SKILLHUB_INSTALLING)
  })

  it('★这一维**不做分类 chip**（v1 明令）：工具栏那一支给的是**空 chip 行**，不是后端分类那一支', () => {
    const agg = readSrc('esc-aggregation.tsx')
    // 判据是"source === 'skillhub' 时给一枚空 chip 行"（否则工具栏会退回平台分类树）。
    expect(agg).toContain("...(source === 'skillhub'")
    expect(agg).toContain("subTabs: { chips: [], activeKey: '', onSelect: () => undefined },")
    // 本维度也没有分页/触底加载（那条路由是"搜一次给一批"）。
    const list = readSrc('esc-skillhub-list.tsx')
    expect(list).not.toContain('hasMore')
    expect(list).not.toContain('onScroll')
  })

  it('装配的既有性质没被这一刀碰坏（刚装那一枚只显示「去试试」；隐藏规则仍只认磁盘真值）', () => {
    // 顺手回归：本刀只**加面**，没有动这枚装配自己的两条硬口径。
    expect(enterpriseEscSkillCardSpec({ installed: false, justInstalled: true, install: { text: 'X', disabled: false, title: 't', ariaLabel: 'a' } }))
      .toEqual({ iconShape: 'square', showUse: true, installed: true })
    expect(enterpriseEscSkillCardHidden({ name: 'n', installedNames: new Set(['n']), justInstalledSkillName: 'n' })).toBe(false)
    expect(enterpriseEscSkillCardHidden({ name: 'n', installedNames: new Set(['n']) })).toBe(true)
    expect(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY).toEqual({})
    expect(cardsOf(EnterpriseEscThirdPartyList({ state: { kind: 'loading' }, onReload: () => undefined }))).toEqual([])
  })
})

/** 那枚结果行的类型再出口（本文件只用它的形状，不新造第二份）。 */
export type { EnterpriseOnlineSkillResult }
