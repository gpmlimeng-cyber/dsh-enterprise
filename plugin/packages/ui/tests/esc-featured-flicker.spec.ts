/**
 * 「精选卡描述先多行、后一行」那一次闪烁的门禁（本刀：回查落定之前这一行不画卡）。
 *
 * ★**这一份锁的是"同一枚卡在两种入参下必须长得一样"，不是"某一次取数成功"**——
 *   判据全部落在**渲染树逐格比对**上（本仓 vitest 没有 DOM，`createElement` 的产物照样能逐格读 props）。
 *
 * ★**为什么这些锁是这个形状**：
 *   · **正锁（首帧不跳）**：回查未落定 ⇒ **整卡不进 DOM**，出既有骨架 ⇒ 员工不可能看见
 *     "缺描述 + 占位句顶替"的那一副；
 *   · **指纹反向锁**：渲染树里**永远不许**出现"先 `.esc-card-lock` 占位、后 `.esc-card-headdesc`"
 *     这条路径——它就是本次 bug 的指纹本身；
 *   · **未命中仍画卡**：分界画在**取数状态**上而不是数据上，"查过了、一条都没命中"是**终态**，
 *     那一档 `.esc-card-lock` 是它**该有**的内容，不是占位；
 *   · **源码反向锁**：判据只有一处（`enterpriseEscFeaturedSettled`），且每支出口都落定（不许"永远等"）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

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

import { EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { ENTERPRISE_ESC_COPY } from '../src/esc/esc-copy.js'
import {
  ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY,
  enterpriseEscFeaturedBody,
  enterpriseEscFeaturedSettled,
} from '../src/esc/esc-featured.js'
import type { EnterpriseEscFeaturedLookup, EnterpriseEscFeaturedState } from '../src/esc/esc-featured.js'
import type { EscRecommendRecord, ResourceItem } from '../src/esc/esc-types.js'

type Element = { type: unknown; props: Record<string, unknown> }

const asElement = (value: unknown): Element => value as Element

const childrenOf = (element: Element): unknown[] => {
  const children = element.props['children']
  return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
}

const walk = (node: unknown, out: Element[] = []): Element[] => {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const each of node) walk(each, out)
    return out
  }
  const element = node as Element
  out.push(element)
  for (const each of childrenOf(element)) walk(each, out)
  return out
}

const classNamesOf = (root: Element): string[] =>
  walk(root)
    .map(each => each.props['className'])
    .filter((value): value is string => typeof value === 'string')

const featuredSource = (): string =>
  readFileSync(new URL('../src/esc/esc-featured.tsx', import.meta.url), 'utf8')

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n')

const record: EscRecommendRecord = {
  id: 8,
  targetType: 'Skill',
  targetId: 158,
  recType: 'Official',
  label: 'dev-engineer-toolkit',
}

/** 广场目录那一份（**描述只存在于这里** —— 推荐记录自己只有 label + icon）。 */
const directoryItem: ResourceItem = {
  id: 'skill-4194',
  name: 'dev-engineer-toolkit',
  description: '这是一段很长的技能描述文字'.repeat(6),
}

const ready: EnterpriseEscFeaturedState = { kind: 'ready', items: [record] }
const hitLookup: EnterpriseEscFeaturedLookup = new Map([[158, directoryItem]])

describe('精选卡描述闪烁：本刀（回查落定之前不画卡）', () => {
  it('★正锁：回查未落定 ⇒ 整卡不进 DOM（只出既有骨架），落定后卡片逐字出现', () => {
    // ── 首帧：回查还在路上（`lookupSettled: false`）
    const pending = asElement(enterpriseEscFeaturedBody(ready, () => undefined, { lookupSettled: false }))
    expect(pending.props['className']).toBe('esc-loading')
    expect(textOfAll(pending)).toBe(ENTERPRISE_ESC_COPY.loading)
    // 骨架里**一枚卡都不许有** —— 这是本刀的核心：首帧不存在"缺描述的卡"
    expect(classNamesOf(pending)).not.toContain('esc-card')

    // ── 终帧：回查落地
    const settled = asElement(enterpriseEscFeaturedBody(ready, () => undefined, {
      lookup: hitLookup,
      lookupSettled: true,
      targetType: 'Skill',
    }))
    expect(settled.props['className']).toBe('esc-featured-grid')
    // 网格里的卡片元素**还没有被渲染**（`EnterpriseEscCard` 是 memo 组件）⇒ 必须往下走一层
    // 才看得见它内部的类名（这正是 `onlyCard` 那份树读法存在的理由）。
    const settledTree = asElement(EnterpriseEscCardView(onlyCard(settled).props as never))
    expect(settledTree.props['className']).toBe('esc-card esc-card-skill')
    // 描述那一格**首帧就与终帧逐字相同**（它在骨架那一帧压根不存在 ⇒ 不存在"三行那一态"）
    expect(classNamesOf(settledTree)).toContain('esc-card-headdesc')
  })

  it('★正锁：描述格与卡片根类名，命中/未落定两种形态下都**唯一**且**恒定**', () => {
    const settledCard = onlyCard(enterpriseEscFeaturedBody(ready, () => undefined, {
      lookup: hitLookup, lookupSettled: true, targetType: 'Skill',
    }))
    const settledTree = asElement(EnterpriseEscCardView(settledCard.props as never))
    expect(settledTree.props['className']).toBe('esc-card esc-card-skill')
    expect(classNamesOf(settledTree)).toContain('esc-card-headdesc')

    // ★未落定那一帧：这一行**出的是骨架**，不是一枚"另一种样子"的卡。
    //   判据**必须落到骨架那一帧本身**：只查"骨架里没有这些类名"是不够的——若有人把闸撤了、
    //   骨架那一帧改回出卡，`classNamesOf` 就因为走不进未渲染的 `EnterpriseEscCard` 元素而**看不见**内里的类名
    //   ⇒ 那正是本刀第一版门禁的空转处。故这里改成**正面断言那一帧的元素形态**：
    //   它要么是骨架（`.esc-loading`），要么整张卡与终帧**逐字同形**；两者都不是即红。
    const pending = asElement(enterpriseEscFeaturedBody(ready, () => undefined, { lookupSettled: false }))
    expect(pending.props['className']).toBe('esc-loading')
    // 那一帧里**一枚卡元素都不许在树上**（用元素类型判定，不依赖类名是否已渲染）——
    //   子节点只有骨架那一句文字，没有 `EnterpriseEscCard` 元素。
    expect(childrenOf(pending).every(node => typeof node === 'string')).toBe(true)
    expect(childrenOf(pending)).toHaveLength(1)
    expect(classNamesOf(pending)).not.toContain('esc-card-lock')
  })

  it('★指纹反向锁：渲染树里不许出现「先 `.esc-card-lock` 占位、后 `.esc-card-headdesc`」', () => {
    // 命中那一帧：描述与锁定原因**共存**（刻意版式，描述答"这是什么"、锁定原因答"为什么点不了"）
    const settled = onlyCard(enterpriseEscFeaturedBody(ready, () => undefined, {
      lookup: hitLookup, lookupSettled: true, targetType: 'Skill',
    }))
    const settledNames = classNamesOf(asElement(EnterpriseEscCardView(settled.props as never)))
    expect(settledNames).toContain('esc-card-headdesc')
    expect(settledNames).toContain('esc-card-lock')

    // ★★**指纹** ＝ **同一枚卡的两帧之间**描述格才长出来，而长出来之前是 `.esc-card-lock` 占着。
    //   把它写成一条**跨帧**判据（这是本次 bug 的定义，改前必然成立 ⇒ 改后必然不成立）：
    //     未落定那一帧**要么根本没有卡**（骨架），**要么**那枚卡里描述与锁定原因**已经都在**。
    //   —— 绝不允许"未落定那一帧只有 `.esc-card-lock`、落定后才有 `.esc-card-headdesc`"。
    const pendingBody = enterpriseEscFeaturedBody(ready, () => undefined, { lookupSettled: false })
    // 骨架那一帧的子节点是文字（不是卡片元素）⇒ 这一帧"没有卡"（`pendingCard === null`）
    const pendingCard = pendingBody !== null && typeof pendingBody === 'object' && !Array.isArray(pendingBody)
      ? childrenOf(pendingBody as Element).find(node => node !== null && node !== undefined && typeof node !== 'string') as Element | undefined
      : undefined
    const pendingNames = pendingCard === undefined
      ? []
      : classNamesOf(asElement(EnterpriseEscCardView(pendingCard.props as never)))
    const placeholderOnly = pendingNames.includes('esc-card-lock') && !pendingNames.includes('esc-card-headdesc')
    expect(placeholderOnly).toBe(false)
    // 且命中那一帧必须**真的有**描述格（否则上面那条恒真、又是一条空转锁）
    expect(settledNames.filter(name => name === 'esc-card-headdesc')).toHaveLength(1)
  })

  it('★未命中（落定成空索引）仍照常画卡，内容与改前逐字相同', () => {
    const missed = asElement(enterpriseEscFeaturedBody(ready, () => undefined, {
      lookup: ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY,
      lookupSettled: true,
      targetType: 'Skill',
    }))
    // 卡片**照画**（分界画在取数状态上，不画在数据上）
    expect(missed.props['className']).toBe('esc-featured-grid')
    const card = onlyCard(missed)
    const tree = asElement(EnterpriseEscCardView(card.props as never))
    // 没命中 ⇒ 描述缺席、锁定原因**在场**（那正是它该有的内容，不是占位）
    const names = classNamesOf(tree)
    expect(names).not.toContain('esc-card-headdesc')
    expect(names).toContain('esc-card-lock')
  })

  it('★判据只有一处（`enterpriseEscFeaturedSettled`），且每一支出口都落定（不许"永远等"）', () => {
    // 判据本体：`undefined` ＝ 在途；**空索引算落定**（那是"查过了、一条都没命中"）
    expect(enterpriseEscFeaturedSettled(undefined)).toBe(false)
    expect(enterpriseEscFeaturedSettled(ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY)).toBe(true)
    expect(enterpriseEscFeaturedSettled(hitLookup)).toBe(true)

    // 源码反向锁：判据**只有那一个定义**（不许第二处自己判 `!== undefined`）
    const code = stripComments(featuredSource())
    expect((code.match(/export function enterpriseEscFeaturedSettled\(/g) ?? [])).toHaveLength(1)
    // ★★**零第二份真值**：判据**只读那一个入参**。函数体里若出现任何模块级可变量（`let`/`const` 数组、
    //   Set、Map…）或任何别的状态容器，就说明它另存了一份"落定过没有"的真值 ——
    //   那正是"回查结果缓存成第二份 source of truth"那条变异（它会让一次命中**永久**改写后续判定）。
    //   判据：函数体逐字是 `return lookup !== undefined`（不许有任何旁路状态）。
    const body = code.slice(code.indexOf('export function enterpriseEscFeaturedSettled('))
    const end = body.indexOf('\n}')
    expect(body.slice(0, end)).toContain('return lookup !== undefined')
    expect(body.slice(0, end)).not.toMatch(/\b(let|const)\b/)
    // 三支出口都必须写 `setLookup`：ready 之外的早退、成功、以及 **`.catch`（失败也要落定）**
    const setCalls = code.match(/setLookup\(/g) ?? []
    expect(setCalls.length).toBeGreaterThanOrEqual(3)
    // 骨架复用既有那枚 `.esc-loading`，**零新增 CSS 类**（剥注释后本文件不产 `<style>`；注释里提到
    // `esc-style.ts` 是正当记录，不是产物）
    expect(code).toContain("lookupSettled: enterpriseEscFeaturedSettled(lookup)")
    expect(code).not.toContain('<style')
  })
})

/* ────────────────────────── 小工具 ────────────────────────── */

function textOfAll(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOfAll).join('')
  if (typeof node === 'object') return textOfAll((node as Element).props['children'])
  return ''
}

function onlyCard(body: unknown): Element {
  const grid = asElement(body)
  const cards = childrenOf(grid).filter(node => node !== null && node !== undefined)
  expect(cards).toHaveLength(1)
  return asElement(cards[0])
}
