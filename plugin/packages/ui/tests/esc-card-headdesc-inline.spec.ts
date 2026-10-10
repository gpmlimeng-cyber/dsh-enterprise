/**
 * 「技能卡描述**先三行、再收成一行**」闪烁的门禁（**免疫式修法**：单行几何行内定死，不依赖任何样式表）。
 *
 * ★**这一份锁的是什么**（与上一刀 `esc-featured-flicker.spec.ts` 那份**刻意不同**、两条并存）：
 *   上一刀锁的是"**格数**会不会跳变"（回查落定前不画卡 ⇒ 头里格数恒定）；
 *   本刀锁的是"**同一格内的排版**会不会跳变"——用户原话「描述本身就是**先三行、再收成一行**
 *   （**同一张卡、同一处文字**）」⇒ 两帧是**同一枚元素**，格数那条判据**天然抓不到**。
 *
 * ★**根因（本轮坐实，见 `esc-card.tsx` 文件头那一段的逐条证据）**：
 *   官方主题 sheet 由 `installThemeStyles(ctx)` 在**插件激活那一刻**经 `ctx.effect` 追加进
 *   `document.head`（`dsh-client-ui-theme/lib/client.js:1180-1193`），而本仓那份 `<style>` 是
 *   **React 树里的一枚元素**（`esc-page.tsx:255`）⇒ **两者的文档序不由我们决定**。官方那份若压在我们
 *   之后，它那份全局 `p` 排版让描述格首帧回到 CSS 初始值 `white-space: normal`（**自由折行 = 三行**），
 *   等我们的规则生效再收成一行。
 *   ⇒ 修法是**把"恒一行"从样式表搬到元素自己身上**：行内样式压过任何 stylesheet 的作者规则，
 *     **与文档序无关**（本仓 vitest 无布局引擎，故只能锁"元素在不在同一棵树""属性在不在"，如实如此）。
 *
 * ★**四条锁各自咬住一件事**（不许靠类名、必须逐条断言属性的**值**）：
 *   ① 正锁：描述元素带**行内单行几何**，四个属性逐条断值；
 *   ② 反向锁：描述元素**不许**新增/依赖任何新类名（**零新增 CSS 类**），且类名**仍恰是**既有那一个；
 *   ③ 快照：卡片**其它格子**（锁 / 标签 / 元信息）几何**未变**（逐字快照）；
 *   ④ **CSS 里那条规则仍在**——免疫 ≠ 拆掉样式（margin / 颜色 / 字号 / 行高 / flex 仍归它）。
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

import { ESC_CARD_HEADDESC_INLINE_STYLE, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { EnterpriseEscConnectorCard } from '../src/esc/esc-connector-plaza.js'
import { ENTERPRISE_ESC_COPY } from '../src/esc/esc-copy.js'
import type { ResourceItem } from '../src/esc/esc-types.js'
import type { EnterpriseConnectorItem } from '../src/local-api-decode.js'

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

const byClass = (root: unknown, cls: string): Element[] =>
  walk(root).filter(each => each.props['className'] === cls)

const cssSource = (): string => readFileSync(new URL('../src/esc/esc-style.ts', import.meta.url), 'utf8')

const item: ResourceItem = {
  id: 'skill-4194',
  name: 'dev-engineer-toolkit',
  description: '这是一段很长的技能描述文字，它真的非常长，需要单行截断才能落在卡片内缘。'.repeat(3),
  meta: '1.2.0 · 340 KB',
  publishUser: { userName: 'nuwax', nickName: '纽瓦克斯', avatar: 'https://cdn.example.com/a.png' },
  stats: [
    { type: 'star', value: 3 },
    { type: 'user', value: 12 },
    { type: 'link', value: 41 },
  ],
  collected: true,
}

/** 技能卡那一档（`showUse` ⇒ 走标签行版式，描述那格在场）。 */
const skillCard = (): Element => asElement(EnterpriseEscCardView({ item, showUse: true } as never))

/** 连接器广场那张卡（第二个 `esc-card-headdesc` 装配点；**共用**同一处定义）。 */
const connectorCard = (): Element => asElement(EnterpriseEscConnectorCard({
  item: {
    id: 1,
    name: 'slack',
    description: '把企业消息接到会话里。'.repeat(4),
    installType: 'official',
    deployStatus: 'ready',
    official: true,
    toolCount: 3,
    space: { id: 7, name: '研发空间' },
  } as EnterpriseConnectorItem,
}))

/** 描述格那枚元素（两个装配点都恰好一枚；用「恰好一枚」本身当断言的一部分）。 */
const headDesc = (card: Element): Element => {
  const hits = byClass(card, 'esc-card-headdesc')
  expect(hits).toHaveLength(1)
  return hits[0]!
}

describe('技能卡描述「先三行、再收成一行」：免疫式修法（单行几何行内定死）', () => {
  it('★正锁①：描述元素带**行内单行几何** —— 四个属性逐条断值（不靠类名）', () => {
    for (const card of [skillCard(), connectorCard()]) {
      const style = headDesc(card).props['style'] as Record<string, unknown>
      // ★逐条断**值**（不是 `toBeDefined`、不是 `toMatchObject` 的部分命中）：
      //   少一件就退化，而"少了哪一件"正是这套症状的形状，故每件都必须被单独咬住。
      expect(style['whiteSpace']).toBe('nowrap')
      expect(style['overflow']).toBe('hidden')
      expect(style['textOverflow']).toBe('ellipsis')
      // display:block 钉死"它不会因官方某条 display 规则变成 flex/inline 而丢掉截断的前提"
      // （text-overflow 只对块级盒生效）。它不改变当前观感（<p> 本就是块级）。
      expect(style['display']).toBe('block')
      // ★不许再多出第五件：多一件就是"顺手加了别的版式"，本仓零新增 CSS 类、版式观感一字未改。
      expect(Object.keys(style).sort()).toEqual(['display', 'overflow', 'textOverflow', 'whiteSpace'])
    }
  })

  it('★正锁①·另一面：两个装配点**共用同一处定义**（不许各抄一份字面量）', () => {
    // 两个装配点逐字同一枚对象 ⇒ 将来改动只可能改一处，不会漂成"两个形态"。
    expect(headDesc(connectorCard()).props['style']).toBe(ESC_CARD_HEADDESC_INLINE_STYLE)
    expect(headDesc(skillCard()).props['style']).toBe(ESC_CARD_HEADDESC_INLINE_STYLE)
  })

  it('★反向锁②：描述元素**不许**新增/依赖任何新类名（零新增 CSS 类），类名**仍恰是**既有那一个', () => {
    for (const card of [skillCard(), connectorCard()]) {
      const cls = headDesc(card).props['className']
      // 类名**恰是**既有那一个 —— 不是"包含"：多一个类就是新增 CSS 类。
      expect(cls).toBe('esc-card-headdesc')
      expect(typeof cls).toBe('string')
      // ★反向锁的另一半：**样式表里不许为这次修法新加一条规则**。
      //   "零新增 CSS 类"这条纪律由样式表那条规则**逐条**数守：本仓的 headdesc 规则必须**仍是那一条**、
      //   仍是唯一一条（`esc-style.ts` 里 `.esc-card-headdesc` 只声明一次）。
      const css = cssSource()
      const rules = css.match(/\.esc-card-headdesc\s*\{[^}]*\}/g) ?? []
      expect(rules).toHaveLength(1)
    }
  })

  it('★快照③：`.esc-card-lock` 几何**未变**（仍未加截断） + 描述格的**其余 props 一字未动** —— 逐字快照', () => {
    const card = skillCard()

    // ★**本刀重新基线化（加强，不是放宽）**：改前这一条把"元信息行 `style` 为 `undefined`"当成
    //   "其它格子的几何一个字节都没动"的证据。**本刀把那一格显式免疫了**（它与描述、标题、标签行
    //   共用同一格数预算 ⇒ 官方 sheet 晚到会让**同一张卡连跳两次**，不修它就还在跳）
    //   ⇒ 那半条判据**必须**改写，否则它会开始奖励"漏修一格"。
    //   ★**加强的方向**：改前它只锁"没有 style"，现在它锁**逐属性断值 + 共用同一枚常量**，
    //   并**追加**下面两条真正不许动的反向锁（锁格不加截断 / 标签行项数与顺序一字未改）。
    //   ⇒ 净效果是覆盖面**变大**（多锁了元信息/标签行/标签格的行内几何与逐属性值），
    //     "漏修"与"多改"两端都会红，只有一条**期望值**被改掉（元信息那一格的 `undefined` → 那枚常量）。

    // 元信息行：本刀起它**也**带行内单行几何（`ESC_CARD_META_INLINE_STYLE`），
    //   与标题、标签行**共用同一格数预算** ⇒ 三处必须一起免疫。
    const meta = byClass(card, 'esc-card-meta')
    expect(meta).toHaveLength(1)
    const metaStyle = meta[0]!.props['style'] as Record<string, unknown>
    expect(metaStyle['whiteSpace']).toBe('nowrap')
    expect(metaStyle['overflow']).toBe('hidden')
    expect(metaStyle['textOverflow']).toBe('ellipsis')
    // `flex: none`（元信息不许被压扁）是那一条纪律本身，与上面三件同属"必须成立"的几何。
    expect(metaStyle['flex']).toBe('none')
    expect(meta[0]!.props['title']).toBe(item.meta)
    expect(meta[0]!.props['children']).toBe(item.meta)

    // 标签行整行：本刀起它**也**带行内不换行几何（`ESC_CARD_TAGS_INLINE_STYLE`）。
    const tags = byClass(card, 'esc-card-tags')
    expect(tags).toHaveLength(1)
    const tagsStyle = tags[0]!.props['style'] as Record<string, unknown>
    expect(tagsStyle['flexWrap']).toBe('nowrap')
    expect(tagsStyle['overflow']).toBe('hidden')
    // 四格（作者 → 收藏 → 安装 → 使用），顺序与项数一字未改。
    // 作者那格的类名是 `esc-tag esc-tag-author`（两个类），故按**包含**收齐五处再断数。
    const tagRow = tags[0]!
    const tagCells = walk(tagRow).filter(each =>
      typeof each.props['className'] === 'string' && (each.props['className'] as string).split(' ').includes('esc-tag'),
    )
    expect(tagCells).toHaveLength(4)
    // ★顺序：作者 → 收藏 → 安装 → 使用（口径 40/42 的裁决⑧）
    expect(tagCells.map(each => each.props['title'])).toEqual([
      '纽瓦克斯',
      ENTERPRISE_ESC_COPY.statCollect,
      ENTERPRISE_ESC_COPY.statInstall,
      ENTERPRISE_ESC_COPY.statUsage,
    ])
    // ★**标签单格也免疫**（本刀）：格内恒一行 ⇒ 行高不再随官方 sheet 的文档序变化。
    for (const cell of tagCells) {
      const style = cell.props['style'] as Record<string, unknown>
      expect(style['whiteSpace'], '每个标签单格都要 nowrap').toBe('nowrap')
      expect(style['display'], '每个标签单格都要钉死 inline-flex').toBe('inline-flex')
    }

    // ★**`.esc-card-lock` 刻意不许加截断** —— 它是"为什么点不了"的那句话，
    //   截了它等于把理由藏起来（信息不许藏，版式才让位）。这条快照把"没加"钉死。
    const locks = walk(card).filter(each => each.props['className'] === 'esc-card-lock')
    expect(locks.length).toBeGreaterThan(0)
    for (const lock of locks) {
      expect(lock.props['style']).toBeUndefined()
      expect(lock.props['role']).toBe('status')
      // 它**不许**有 title 兜底之外的截断属性（行内 style 一律缺席）
      expect(Object.keys(lock.props)).not.toContain('style')
    }
  })

  it('★快照③·同一张卡的**位置级结构**：描述格仍是 headmain 的第二格，标签行仍在卡片直属层', () => {
    const card = skillCard()
    const header = byClass(card, 'esc-card-header')[0]!
    const headmain = byClass(header, 'esc-card-headmain')[0]!
    // headmain 内部（过滤掉**缺席即 null** 的那几格与未渲染的图标组件后再断位次）：
    // 标题行 → 描述 → 元信息 ⇒ 描述格必须**紧跟**标题行，与本刀无关的格子不许插到它前面。
    const inner = childrenOf(headmain)
      .filter((node): node is Element => typeof node === 'object' && node !== null)
      .map(asElement)
      .filter(each => typeof each.props['className'] === 'string')
    expect(inner.map(each => each.props['className']).slice(0, 3)).toEqual([
      'esc-card-titlerow',
      'esc-card-headdesc',
      'esc-card-meta',
    ])
    // 卡片直属子节点：header → 标签行（描述那格**不在**直属层；缺席即 null 的那两格先滤掉）
    expect(childrenOf(card)
      .filter((node): node is Element => typeof node === 'object' && node !== null)
      .map(asElement)
      .filter(each => typeof each.props['className'] === 'string')
      .map(each => each.props['className'])).toEqual([
      'esc-card-header',
      'esc-card-tags',
    ])
  })

  it('★正锁④：`.esc-card-headdesc` 那条 CSS 规则**仍在**（免疫 ≠ 拆掉样式）', () => {
    const css = cssSource()
    const rule = /\.esc-card-headdesc\s*\{([^}]*)\}/.exec(css)
    expect(rule).not.toBeNull()
    const body = rule![1]!
    // 归这条规则的四件事**一个都没少**：margin / 颜色 / 字号 / 行高 / flex 都还在它身上。
    expect(body).toContain('margin: 3px 0 0')
    expect(body).toContain('color: var(--dsw-alias-label-secondary)')
    expect(body).toContain('font-size: var(--esc-fs-xxs)')
    expect(body).toContain('line-height: 1.5')
    expect(body).toContain('flex: none')
    // ★**它仍写着那三件**——本刀没有把这条规则**改成**别的样子，只是**并行**加了一份行内同值几何。
    //   （行内那份才是免疫的那一份；这条规则继续供"别处引用同一类名"与"将来改版式"用。）
    expect(body).toContain('white-space: nowrap')
    expect(body).toContain('overflow: hidden')
    expect(body).toContain('text-overflow: ellipsis')
  })

  it('★诚实边界：单一 stylesheet 的**文档序**这件事，本仓 vitest **证不了**（如实登记，不假装能量）', () => {
    // 本仓 vitest **没有布局引擎**、也没有 DOM ⇒ 能证的只有"元素在不在同一棵树""类名/内联属性在不在"，
    //   **证不了**"官方那份 sheet 在你真机上晚到几毫秒""那一帧到底折几行"。
    //   故这条用例**不做任何像素断言**，只把这条边界**写在门禁里**，让下一个改这里的人看见：
    //   ★本仓唯一能做的是**让"单行"这件事不再依赖那份 sheet 在场**（正锁①）；
    //     真机上"官方 sheet 晚到多少"与"闪烁是否消失"**只能由用户复量**。
    expect(typeof document).toBe('undefined')
    // 反过来把**可证的**那条钉死：行内几何在元素自己身上（与 stylesheet 无关）。
    expect(headDesc(skillCard()).props['style']).toBe(ESC_CARD_HEADDESC_INLINE_STYLE)
  })
})
