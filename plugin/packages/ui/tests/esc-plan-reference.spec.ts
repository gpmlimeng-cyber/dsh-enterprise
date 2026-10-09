/**
 * [INPUT]: 依赖 `esc-plan-table.ts`（那张"同键同对象"的表）、三张计划表的唯一构造点
 *   （`esc-skill-try.ts` / `esc-skill-more.ts` / `esc-system.ts`）、`esc-card.tsx` 的两枚导出
 *   （memo 那一枚 + 内层纯渲染那一枚）、`esc-skill-card.ts` 的卡片入参装配点、`esc-style.ts` 的样式表，
 *   以及 `node:fs`（源码级反向锁与"构造点各恰一处"的计数）
 * [OUTPUT]: 对外提供**技能页性能的回归锁**（纯函数级 + 源码级两半）：
 *   ① **卡片真的被 memo 包着**（且内层那一枚仍可直接直调取证）；
 *   ② **同一份数据 + 同一份状态下的两次"渲染"，三个计划逐键引用相等** —— 这正是 `memo` 的默认判据
 *      （props 逐键浅相等），故它在纯函数级证明了"那几百张卡真的会被跳过"；
 *   ③ 状态一变 ⇒ 表换新（旧引用不许复用，否则禁用/在途那些字会停在上一帧）；
 *   ④ **三个计划的构造点各恰一处**（全 `src` 唯一调用者＝各自那张表）；
 *   ⑤ 自装名字集合**只折一次**（且全 `src` 没有第二处"折完再判"的写法）；
 *   ⑥ 卡片所在的那一格真的吃到 `content-visibility`（占位高只用既有 token、卡片本体那几条基线未动）
 * [POS]: 本刀（技能页性能）的**唯一**性能回归门 —— 与 `esc.spec.ts` 那条"样式两向锁"
 *   （hover 只留底色）分工不同：那一条管**样式层不再白算**，这一条管**渲染层不再白画**。
 *   ★为什么必须是"纯函数级"：本仓 vitest **没有 DOM**、也不起 React 渲染器
 *   ⇒ "两次渲染下引用相等"只能靠"同一张表取两次"来取证；而 `memo` 的默认比较器就是**浅相等**，
 *   故下面那条 `sameProps` 与 React 内部判据**逐字同构**（键集相同 + 逐键 `Object.is`）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { enterpriseEscPlanTable } from '../src/esc/esc-plan-table.js'

/**
 * 官方原语在本仓**不是**运行期依赖（发行时用宿主共享实例），而 `devDependency` 那份在**导入期**
 * 就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在"收集测试"阶段就炸。
 * 与另几份 esc spec 同一条手法：整模块替身化（本文件测的是"表与计划"的引用关系，不渲染任何组件）。
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

import { enterpriseEscSkillCardParams } from '../src/esc/esc-skill-card.js'
import { enterpriseEscSelfInstalledNames, enterpriseEscSkillMoreTable } from '../src/esc/esc-skill-more.js'
import { enterpriseEscSkillTryTable } from '../src/esc/esc-skill-try.js'
import { EnterpriseEscStyle } from '../src/esc/esc-style.js'
import { enterpriseEscSystemInstallTable } from '../src/esc/esc-system.js'
import type { EnterpriseSelfInstalledSkill } from '../src/skill-api-decode.js'

const NAME = 'dev-engineer-toolkit'
const OTHER = 'code-review'

/** 一份自装记录真值（`names[]` 是**落盘目录名**，判据只认它）。 */
const RECORDS: readonly EnterpriseSelfInstalledSkill[] = [
  { skillId: 'meeting-notes', displayName: '会议纪要', sha256: 'a'.repeat(64), names: [NAME], installedAt: '', sourceInput: 'notes.dshskill' },
]

/** 一枚广场卡片的数据（`targetId` / `allowCopy` 是安装计划真正读的那两格）。 */
const ITEM = { id: 'skill-4194', name: NAME, description: '一句话说明', targetId: 158, allowCopy: 1 }

/**
 * `memo` 的默认比较器（`shallowEqual`）的**逐字同构**：键集相同 + 逐键 `Object.is`。
 *
 * ★为什么在这里照抄一遍：本仓没有 React 渲染器，而"卡片会不会被跳过"这件事的**唯一**判据就是它 ——
 *   把它写出来，`expect(sameProps(第一次, 第二次)).toBe(true)` 才有意义（而不是"我以为相等"）。
 */
function sameProps(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every(key => Object.is(a[key], b[key]))
}

/* ══════════════ 走查源码用的小工具（与另几份 spec 同一手法） ══════════════ */

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

function readEscSrc(name: string): string {
  return stripComments(readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8'))
}

function allSrcFiles(): readonly { readonly name: string; readonly code: string }[] {
  const root = new URL('../src/', import.meta.url)
  const out: { name: string; code: string }[] = []
  const visit = (dir: URL, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      out.push({ name: `${prefix}${entry.name}`, code: stripComments(readFileSync(new URL(entry.name, dir), 'utf8')) })
    }
  }
  visit(root, '')
  return out
}

/** 某个标识符后面紧跟 `(` 的文件清单（＝真正的**调用者**，定义那一行不算）。 */
function callers(id: string): readonly string[] {
  return allSrcFiles()
    .filter(file => new RegExp(`${id}\\(`).test(file.code))
    .map(file => file.name)
    .sort()
}

/** 样式表里所有规则的 `{选择器, 声明体}`（顶层，够用：本文件里没有嵌套规则）。 */
function cssRules(css: string): readonly { readonly selector: string; readonly body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(hit => ({ selector: hit[1]!.trim(), body: hit[2]! }))
}

/* ══════════════ ① 卡片记忆化（memo 那一层真的在） ══════════════ */

describe('① 卡片记忆化：`EnterpriseEscCard` 是 `memo` 那一枚，内层纯渲染那一枚仍可直调取证', () => {
  it('导出的是 memo 对象（不是裸函数），且它的内层就是 `EnterpriseEscCardView`', () => {
    // `memo()` 的产物是一个对象：`$$typeof` 是那枚唯一的符号，`type` 指向内层渲染函数。
    expect(typeof EnterpriseEscCard).toBe('object')
    expect((EnterpriseEscCard as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'))
    expect((EnterpriseEscCard as unknown as { type: unknown }).type).toBe(EnterpriseEscCardView)
    expect(typeof EnterpriseEscCardView).toBe('function')
    // 源码级：本文件里 `memo(` **恰好一处**（多一处就是又包了一层或另包了一枚卡片）。
    const card = readEscSrc('esc-card.tsx')
    expect(card.match(/memo\(/g) ?? []).toHaveLength(1)
    expect(card).toContain('export const EnterpriseEscCard = memo(EnterpriseEscCardView)')
    // 反向锁：旧形态（裸函数导出）不许回来 —— 那正是"几百张卡整页重画"的根因。
    expect(card).not.toContain('export function EnterpriseEscCard(')
  })
})

/* ══════════════ ② 两次"渲染"下三个计划**引用相等**（memo 的判据） ══════════════ */

describe('② 性能回归锁：同一份数据 + 同一份状态的两次"渲染"，`install` / `more` / `tryNow` 引用相等', () => {
  /** 这一面那一份"真值 + 状态"下建起来的三张表（＝页面上那三处 `useMemo` 的产物）。 */
  function tables() {
    const selfInstalledNames = enterpriseEscSelfInstalledNames(RECORDS)
    const tryPlans = enterpriseEscSkillTryTable({ wired: true, onTry: () => undefined })
    const morePlans = enterpriseEscSkillMoreTable({
      selfInstalledNames,
      wired: { uninstall: true, reveal: true },
      onUninstall: () => undefined,
      onReveal: () => undefined,
    })
    const installPlans = enterpriseEscSystemInstallTable({ enabled: true, wired: true, onInstall: () => undefined })
    return { selfInstalledNames, tryPlans, morePlans, installPlans }
  }

  it('同一张表取两次 ⇒ **同一枚对象**；两份卡片入参**逐键浅相等**（＝ memo 会跳过这棵子树）', () => {
    const { tryPlans, morePlans, installPlans } = tables()
    /** 一次"渲染"：卡片入参的唯一装配点（与页面里那张卡走的是同一个函数）。 */
    const render = () => {
      const tryNow = tryPlans(NAME, false)
      const item = ITEM as never
      return {
        item,
        ...enterpriseEscSkillCardParams({
          installed: false,
          justInstalled: false,
          install: installPlans(item),
          more: morePlans(NAME, tryNow),
          tryNow,
        }),
      }
    }
    const first = render()
    const second = render()
    // 三个计划**各恰一处**：两次"渲染"拿到的是同一枚对象（install / more / tryNow）。
    expect(second.install).toBe(first.install)
    expect(second.more).toBe(first.more)
    expect(second.tryNow).toBe(first.tryNow)
    expect(first.install).toBeTruthy()
    expect(first.more).toBeTruthy()
    expect(first.tryNow).toBeTruthy()
    // 卡片入参**逐键浅相等** ⇒ React.memo 的默认判据成立 ⇒ 这棵子树被跳过（不再白画）。
    expect(sameProps(first as unknown as Record<string, unknown>, second as unknown as Record<string, unknown>)).toBe(true)
    // 反向取证：`item` 那一格是同**一个**列表对象（引用稳定是前提，不是巧合）。
    expect(second.item).toBe(first.item)
  })

  it('状态一变 ⇒ 换新表、给新计划（旧引用不许复用：禁用/在途那些字必须跟着状态走）', () => {
    const idle = enterpriseEscSkillTryTable({ wired: true, onTry: () => undefined })
    const busy = enterpriseEscSkillTryTable({ wired: true, pending: NAME, onTry: () => undefined })
    // 两档都取"已装"（那一档才可点：未装会走 NOT_INSTALLED 的禁用）。
    expect(busy(NAME, true)).not.toBe(idle(NAME, true))
    expect(idle(NAME, true).disabled).toBe(false)
    expect(busy(NAME, true).disabled).toBe(true)
    expect(busy(NAME, true).title).not.toBe(idle(NAME, true).title)
    // 另一枚（别的名字）不受这一格状态影响：表是**按名**的，不是"一锅端"。
    expect(busy(OTHER, true).disabled).toBe(false)
    // 「更多」那一层同样：`pending` 一变，同一枚技能拿到的是新计划（旧的那一枚带着上一帧的禁用态）。
    const idleMore = enterpriseEscSkillMoreTable({
      selfInstalledNames: enterpriseEscSelfInstalledNames(RECORDS),
      wired: { uninstall: true, reveal: true },
      onUninstall: () => undefined,
      onReveal: () => undefined,
    })
    const busyMore = enterpriseEscSkillMoreTable({
      selfInstalledNames: enterpriseEscSelfInstalledNames(RECORDS),
      wired: { uninstall: true, reveal: true },
      pending: { name: NAME, action: 'uninstall' },
      onUninstall: () => undefined,
      onReveal: () => undefined,
    })
    expect(busyMore(NAME)).not.toBe(idleMore(NAME))
    expect(busyMore(NAME)!.busyText).toBeTruthy()
    expect(idleMore(NAME)!.busyText).toBeUndefined()
  })

  it('表内**构造只跑一次**（同键取 N 次；连"这一枚没有计划"这个结论也只算一次）', () => {
    const build = vi.fn((key: string) => ({ key }))
    const table = enterpriseEscPlanTable<string, { key: string }>(build)
    const first = table(NAME)
    expect(table(NAME)).toBe(first)
    const other = table(OTHER)
    expect(table(OTHER)).toBe(other)
    expect(table(NAME)).toBe(first)
    // 两枚键 ⇒ 构造恰好两次（不是四次）。
    expect(build).toHaveBeenCalledTimes(2)
    // `undefined` 也是一个结论：它同样被存住（否则那条"这一枚不画 ⋯"的判据每渲染重跑一遍）。
    const none = vi.fn(() => undefined)
    const tableOfNone = enterpriseEscPlanTable<string, undefined>(none)
    expect(tableOfNone('x')).toBeUndefined()
    expect(tableOfNone('x')).toBeUndefined()
    expect(none).toHaveBeenCalledTimes(1)
  })
})

/* ══════════════ ③ 三个计划的**构造点各恰一处**（源码级） ══════════════ */

describe('③ 三个计划的构造点各恰一处：全 `src` 里只有各自那张表调它们', () => {
  it('三枚纯投影 / 装配点在全 `src` 里各只有一个调用者（就是它自己那张表）', () => {
    expect(callers('enterpriseEscSkillTryPlan')).toEqual(['esc/esc-skill-try.ts'])
    expect(callers('enterpriseEscSkillMorePlan')).toEqual(['esc/esc-skill-more.ts'])
    expect(callers('escSystemInstallPlan')).toEqual(['esc/esc-system.ts'])
    expect(callers('enterpriseEscSystemCardInstall')).toEqual(['esc/esc-system.ts'])
    // 三张表的定义各一处（`esc-plan-table.ts` 是"同键同对象"的唯一实现）。
    expect(readEscSrc('esc-plan-table.ts').match(/export function enterpriseEscPlanTable</g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-skill-try.ts').match(/export function enterpriseEscSkillTryTable\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-skill-more.ts').match(/export function enterpriseEscSkillMoreTable\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-system.ts').match(/export function enterpriseEscSystemInstallTable\(/g) ?? []).toHaveLength(1)
  })

  it('三处页面各建**一次**表，且都在 `useMemo` 里（表被逐帧重建 ＝ memo 白包）', () => {
    const aggregation = readEscSrc('esc-aggregation.tsx')
    expect(aggregation.match(/enterpriseEscSkillTryTable\(/g) ?? []).toHaveLength(1)
    expect(aggregation.match(/enterpriseEscSkillMoreTable\(/g) ?? []).toHaveLength(1)
    expect(aggregation.match(/enterpriseEscSystemInstallTable\(/g) ?? []).toHaveLength(1)
    expect(aggregation).toContain('const tryPlans = useMemo(() => enterpriseEscSkillTryTable({')
    expect(aggregation).toContain('const morePlans = useMemo(() => enterpriseEscSkillMoreTable({')
    expect(aggregation).toContain('const installPlans = useMemo(() => enterpriseEscSystemInstallTable({')
    const installed = readEscSrc('esc-installed.tsx')
    expect(installed).toContain('const morePlans = useMemo(() => enterpriseEscSkillMoreTable({')
    expect(installed).toContain('const tryPlans = useMemo(() => enterpriseEscSkillTryTable({')
    const catalog = readEscSrc('esc-catalog-list.tsx')
    expect(catalog).toContain('const tryPlans = useMemo(() => enterpriseEscSkillTryTable({')
  })

  it('自装名字集合**只折一次**，且全 `src` 里没有第二处"折完再判"的写法（判据只有一处）', () => {
    // 三处页面各折一次（`useMemo` 里），事实层定义一处。
    expect(callers('enterpriseEscSelfInstalledNames'))
      .toEqual(['esc/esc-aggregation.tsx', 'esc/esc-installed.tsx', 'esc/esc-skill-more.ts'])
    expect(readEscSrc('esc-aggregation.tsx'))
      .toContain('const selfInstalledNames = useMemo(() => enterpriseEscSelfInstalledNames(selfInstalled), [selfInstalled])')
    // 反向锁：任何"临时折一个集合再 `.has(`"的写法都不许出现（那就是第二处归属判据）。
    const inlineFoldAndCheck = allSrcFiles()
      .filter(file => /enterpriseEscSelfInstalledNames\([^)]*\)\s*\.has\(/.test(file.code))
      .map(file => file.name)
    expect(inlineFoldAndCheck).toEqual([])
    // 归属判据（对那枚集合的 `.has(`）在全 `src` 里只出现在计划投影里一处。
    const membership = allSrcFiles()
      .filter(file => /selfInstalledNames\.has\(/.test(file.code))
      .map(file => file.name)
    expect(membership).toEqual(['esc/esc-skill-more.ts'])
  })
})

/* ══════════════ ④ 真值引用稳定（"引用稳定是 memo 生效的前提"那一半） ══════════════ */

describe('④ 真值引用稳定：已安装页那四份派生真值都走 `useMemo`，空真值取**同一枚常量**', () => {
  it('发现面 / 元信息表 / 自装记录 / 分组卡片四份都由 `useMemo` 派生', () => {
    const installed = readEscSrc('esc-installed.tsx')
    expect(installed).toContain('const skills = useMemo(')
    expect(installed).toContain('const metaTable = useMemo(')
    expect(installed).toContain('const selfRecords = useMemo(')
    expect(installed).toContain('const groups = useMemo(() => enterpriseEscInstalledGroups(skills, metaTable), [skills, metaTable])')
    // 三枚空真值常量（同一引用）——反向锁：渲染期现造 `[]` 会让上面那四格每帧失效。
    for (const constant of ['ENTERPRISE_ESC_INSTALLED_NO_DISCOVERED', 'ENTERPRISE_ESC_INSTALLED_NO_RECORDS', 'ENTERPRISE_ESC_INSTALLED_NO_CENTER']) {
      expect(installed).toContain(`const ${constant}: readonly`)
    }
    expect(installed).not.toMatch(/meta\.kind === 'ready' \? meta\.value\.self : \[\]/)
  })
})

/* ══════════════ ⑤ 跳过屏幕外（②那一半的样式锁） ══════════════ */

describe('⑤ 跳过屏幕外：卡片所在的那一格吃到 `content-visibility`，占位高只用既有 token', () => {
  const css = (): string => (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children

  it('两枚"格子"选择器共用一条规则，且 `contain-intrinsic-size` 引用既有 token（不写魔法数字）', () => {
    const declarations = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = cssRules(declarations).find(each => each.body.includes('content-visibility'))
    expect(rule, '样式表里必须有那条跳过屏幕外的规则').toBeTruthy()
    /**
     * ★**本刀收尾重新基线化（更强方向，不是放宽）**：选择器由**三枚**收成**两枚** ——
     *   `.esc-third-party-row` 整族九条规则**已删**（本刀 ②：本地三方换成与广场同一张卡 + 同一骨架，
     *   那一族类名在全 `src` 已零引用）。★覆盖面**严格更大**而不是更小：本地三方那两维的卡片现在
     *   住在 `.esc-catalog-cell` 那一格里（`.esc-list-section > .esc-catalog-cell > 卡片`），
     *   故它们照旧吃到这一条规则 —— 走的是覆盖面更宽的那一枚选择器。
     *   ★下面那两条**反向锁**是这一刀新增的（旧断言看不见"死规则被留下"这件事）：
     *   ① 那一族九个类名**一个都不许残留**在样式表里；② 选择器清单**恰好**是这两枚。
     */
    for (const selector of ['.esc-catalog-cell', '.esc-list-section > .esc-card']) {
      expect(rule!.selector, selector).toContain(selector)
    }
    expect(rule!.selector).not.toContain('.esc-third-party-row')
    expect([...rule!.selector.matchAll(/\.esc-[a-z0-9-]+/g)].map(hit => hit[0]).sort())
      .toEqual(['.esc-card', '.esc-catalog-cell', '.esc-list-section'])
    for (const dead of [
      '.esc-third-party-rows', '.esc-third-party-row', '.esc-third-party-rowline', '.esc-third-party-rowmain',
      '.esc-third-party-name', '.esc-third-party-desc', '.esc-third-party-meta', '.esc-third-party-action',
      '.esc-third-party-lock',
    ]) {
      // 判据是"整份样式表里没有一条规则的选择器带这个类名"（剥注释后取规则体，避免沿革说明误判）。
      expect(cssRules(declarations).some(each => each.selector.includes(dead)), dead).toBe(false)
    }
    expect(rule!.body).toContain('content-visibility: auto')
    expect(rule!.body).toContain('contain-intrinsic-size: auto var(--esc-card-min-h)')
    // 占位高**只用 token**：那一条声明里一个魔法 px 都不许有。
    expect(rule!.body).not.toMatch(/[0-9]+px/)
    // 那条 token 仍在（值＝卡片自己的高度下限，见 `.esc-card` 那一段）。
    expect(declarations).toContain('--esc-card-min-h: 84px;')
  })

  it('反向锁：卡片本体的那几条既有基线**一行未动**（跳过绘制只加在格子上）', () => {
    const declarations = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const card = cssRules(declarations).find(each => each.selector === '.esc-card')!
    expect(card).toBeTruthy()
    expect(card.body).toContain('border: 1px solid var(--dsw-alias-border-l1);')
    expect(card.body).toContain('box-shadow: var(--dsw-shadow-lv2);')
    expect(card.body).toContain('min-height: var(--esc-card-min-h);')
    expect(card.body).toContain('gap: var(--esc-card-gap);')
    // ★卡片本体**不**吃 `content-visibility`（那会改它的几何/包含块）；只有格子吃。
    expect(card.body).not.toContain('content-visibility')
    expect(card.body).not.toContain('contain-intrinsic-size')
  })

  it('hover 只留真正会变的属性（③那一半）：`:hover` 只有 background-color，静止态两条仍在', () => {
    const declarations = css().replace(/\/\*[\s\S]*?\*\//g, '')
    const hover = cssRules(declarations).find(each => each.selector === '.esc-card:hover')!
    const card = cssRules(declarations).find(each => each.selector === '.esc-card')!
    expect(hover.body).toContain('background-color: var(--dsw-alias-interactive-bg-hover)')
    expect(hover.body).not.toContain('border-color')
    expect(hover.body).not.toContain('box-shadow')
    // 静止态那两条必须还在（⇒ hover 时的计算样式与改前**逐像素相同**）。
    expect(card.body).toContain('border: 1px solid var(--dsw-alias-border-l1);')
    expect(card.body).toContain('box-shadow: var(--dsw-shadow-lv2);')
  })
})
