/**
 * [INPUT]: 依赖 dsh-ui 的 DOM 装饰入口 `startEnterpriseMarketBadgeDecoration`／`decorateEnterpriseMarketBadge`／
 *          `removeEnterpriseMarketBadge`／`ENTERPRISE_MARKET_ROW_SELECTOR`／`ENTERPRISE_MARKET_BADGE_ATTRIBUTE`、
 *          `marketplace-entry` 的三个字面真源、`client.tsx` 的 `apply`，以及本文件自造的**最小假 DOM**
 *          （`FakeElement`／`FakeDocument`／`FakeMutationObserver`——本工作区没有 jsdom/happy-dom，故按官方
 *          `ItemCard`/`CardHead` 的实物结构自造 domOutline，并实现装饰真正用到的那几个 DOM 面 + 一段
 *          只认 `tag`/`[attr]`/`[attr="v"]`/`.class`/`:not(...)`/后代组合的选择器引擎）
 * [OUTPUT]: 验证「官方列表卡标题行那枚『企业』签」这条 DOM 装饰路：① 定位只认 `[data-plugin-item="plugin-market"]`
 *          那一行 + 正文恰为「插件市场」的标题按钮，插入点＝标题按钮的 `parentElement`（官方 titleRow）、
 *          位置＝标题按钮**正后方**；② 样式来源＝**克隆**页面上官方 Tag 实物（首选官方「实验性」签，
 *          连它的哈希 `statusTag` 类一起克隆）只把文本换成「企业」，tone 恒为 `info`；
 *          ③ 作用域严格——官方行自己的签一字不动、不被注入；④ 幂等（同一条行只插一枚，连跑两次仍一枚）；
 *          ⑤ 官方重渲染（切页/刷新/路由变化重建卡片）后重新铺；⑥ `dispose` 摘掉我们插的签 + 停观察，
 *          官方签仍在；⑦ 官方「实验性」签不在场但有别的官方 Tag ⇒ 退路（改 tone=info）+ warn；
 *          ⑧ 官方标记不在（不在官方插件页＝静默；面板在且不在加载中却没有我们那一行＝`row-missing` + warn；
 *          行在但插入点/样本缺失＝不插 + warn，且同一原因只记一条）；
 *          ⑨ 无新增 CSS 类（新文件零 `<style>`、不设 `className`、「企业」二字只有 `ENTERPRISE_MARKET_BADGE_TEXT`
 *          这一处真源）；⑩ `apply` 的接线真的用 `ctx.effect` 起了装饰，且无 `document` 的宿主里整段安全跳过。
 * [POS]: DOM 装饰这条路的回归门。它锁的是**官方结构契约**（`data-plugin-item`／标题按钮／`span[data-tone]`），
 *        官方任何一条变了这组用例必须红，逼着人回来面对「失效即不显示」这条如实口径，而不是让标签悄悄漂移。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  decorateEnterpriseMarketBadge,
  ENTERPRISE_MARKET_BADGE_ATTRIBUTE,
  ENTERPRISE_MARKET_ROW_SELECTOR,
  removeEnterpriseMarketBadge,
  startEnterpriseMarketBadgeDecoration,
} from '../src/market-entry-badge.js'
import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
} from '../src/marketplace-entry.js'

/**
 * 官方 `ui-primitives` 只在浏览器里由宿主共享实例提供（本工作区里它自己的 `clsx` 依赖没装），
 * 故照 `client.spec.ts` 的既有手法把它整块 mock 掉——本文件测的是 DOM 装饰，一枚原语组件都不渲染。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  Modal: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
}))

/* -------------------------------------------------------------------------- */
/* 自造最小 DOM（只实现装饰用到的面 + 一段够用的选择器引擎）                        */
/* -------------------------------------------------------------------------- */

/** 自造 DOM 的声明式大纲。 */
interface Outline {
  readonly tag: string
  readonly attrs?: Record<string, string>
  readonly classes?: readonly string[]
  readonly text?: string
  readonly children?: readonly Outline[]
}

/** 装饰真正用到的选择器语法：`tag`、`[attr]`、`[attr="v"]`、`.class`、`:not(...)`、后代组合（空格）。 */
function matchesCompound(element: FakeElement, compound: string): boolean {
  const tag = /^([a-zA-Z][\w-]*)/.exec(compound)
  if (tag !== null && element.tagName.toLowerCase() !== tag[1]!.toLowerCase()) return false
  const rest = compound.slice(tag?.[0].length ?? 0)
  const token = /(\[[^\]]*\]|\.[^.[\]]+|:not\([^)]*\))/g
  let match: RegExpExecArray | null
  while ((match = token.exec(rest)) !== null) {
    const piece = match[1]!
    if (piece.startsWith('[')) {
      const body = piece.slice(1, -1)
      const eq = body.indexOf('=')
      if (eq < 0) {
        if (!element.hasAttribute(body)) return false
        continue
      }
      const name = body.slice(0, eq)
      const raw = body.slice(eq + 1)
      const value = raw.startsWith('"') ? raw.slice(1, -1) : raw
      if (element.getAttribute(name) !== value) return false
      continue
    }
    if (piece.startsWith('.')) {
      if (!element.hasClass(piece.slice(1))) return false
      continue
    }
    // `:not(...)`
    if (matchesCompound(element, piece.slice(5, -1))) return false
  }
  return true
}

/** 后代组合：最右一段匹配自身，其余各段必须依次命中某个祖先。 */
function matchesSelector(element: FakeElement, selector: string): boolean {
  const parts = selector.trim().split(/\s+/)
  if (!matchesCompound(element, parts[parts.length - 1]!)) return false
  let node = element.parent
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    while (node !== null && !matchesCompound(node, parts[index]!)) node = node.parent
    if (node === null) return false
    node = node.parent
  }
  return true
}

/** 自造元素：文本直接挂在元素上（不建文本节点），够装饰用。 */
class FakeElement {
  readonly tagName: string
  readonly children: FakeElement[] = []
  parent: FakeElement | null = null
  ownText: string
  private readonly attrs = new Map<string, string>()
  private readonly classes = new Set<string>()

  constructor(tag: string, attrs?: Record<string, string>, classes?: readonly string[], text?: string) {
    this.tagName = tag
    this.ownText = text ?? ''
    for (const [name, value] of Object.entries(attrs ?? {})) this.attrs.set(name, value)
    for (const name of classes ?? []) this.classes.add(name)
  }

  get textContent(): string {
    let out = this.ownText
    for (const child of this.children) out += child.textContent
    return out
  }

  set textContent(value: string) {
    this.ownText = value
    this.children.length = 0
  }

  get className(): string { return [...this.classes].join(' ') }
  get parentElement(): FakeElement | null { return this.parent }
  get nextSibling(): FakeElement | null {
    if (this.parent === null) return null
    const index = this.parent.children.indexOf(this)
    return index < 0 ? null : this.parent.children[index + 1] ?? null
  }

  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null }
  setAttribute(name: string, value: string): void { this.attrs.set(name, value) }
  hasAttribute(name: string): boolean { return this.attrs.has(name) }
  hasClass(name: string): boolean { return this.classes.has(name) }

  appendChild(node: FakeElement): FakeElement {
    node.detachFromParent()
    node.parent = this
    this.children.push(node)
    return node
  }

  insertBefore(node: FakeElement, reference: FakeElement | null): FakeElement {
    node.detachFromParent()
    node.parent = this
    const index = reference === null ? -1 : this.children.indexOf(reference)
    if (index < 0) this.children.push(node)
    else this.children.splice(index, 0, node)
    return node
  }

  removeChild(node: FakeElement): FakeElement {
    const index = this.children.indexOf(node)
    if (index >= 0) this.children.splice(index, 1)
    node.parent = null
    return node
  }

  remove(): void { this.detachFromParent() }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of [...this.children]) this.removeChild(child)
    for (const node of nodes) this.appendChild(node)
  }

  cloneNode(deep: boolean): FakeElement {
    const copy = new FakeElement(this.tagName, Object.fromEntries(this.attrs), [...this.classes], this.ownText)
    if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true))
    return copy
  }

  querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = []
    const walk = (node: FakeElement): void => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) found.push(child)
        walk(child)
      }
    }
    walk(this)
    return found
  }

  private detachFromParent(): void {
    if (this.parent !== null) this.parent.removeChild(this)
  }
}

/** 自造 `MutationObserver`：只记 observe/disconnect 与手动 `trigger()`。 */
class FakeMutationObserver {
  static readonly instances: FakeMutationObserver[] = []
  readonly callback: () => void
  target: unknown = null
  options: unknown = null
  disconnects = 0

  constructor(callback: () => void) {
    this.callback = callback
    FakeMutationObserver.instances.push(this)
  }

  observe(target: unknown, options: unknown): void {
    this.target = target
    this.options = options
  }

  disconnect(): void { this.disconnects += 1 }

  trigger(): void { this.callback() }
}

/** 自造 `document`：`documentElement > body > outline`。 */
class FakeDocument {
  readonly documentElement: FakeElement
  readonly body: FakeElement
  defaultView: Record<string, unknown> = {}

  constructor(outline: readonly Outline[]) {
    this.body = new FakeElement('body')
    for (const child of outline) this.body.appendChild(buildOutline(child))
    this.documentElement = new FakeElement('html')
    this.documentElement.appendChild(this.body)
  }

  querySelector(selector: string): FakeElement | null { return this.documentElement.querySelector(selector) }
  querySelectorAll(selector: string): FakeElement[] { return this.documentElement.querySelectorAll(selector) }
}

function buildOutline(outline: Outline): FakeElement {
  const element = new FakeElement(outline.tag, outline.attrs, outline.classes, outline.text)
  for (const child of outline.children ?? []) element.appendChild(buildOutline(child))
  return element
}

/** 薄薄一层：装饰只吃 `Document` 这个类型，运行期就是我们自造的那份。 */
function asDocument(document: FakeDocument): Document { return document as unknown as Document }

/* -------------------------------------------------------------------------- */
/* 官方实物结构的大纲（照 dsh-client-ui-plugin-manager/lib/client.js:1941-2097）  */
/* -------------------------------------------------------------------------- */

/** 官方 `CardHead` 的官方哈希类只用来证明「克隆连类一起拿」，取值照官方 `:1692`/`:1701` 的形态。 */
const OFFICIAL_STATUS_TAG_CLASSES = ['X_2TxG_tag', 'X_2TxG_statusTag'] as const

/** 我们那一行（官方 `ItemCard`）：`data-plugin-item="plugin-market"` + 标题按钮 + 我们的描述行。 */
function ourRowOutline(children?: readonly Outline[]): Outline {
  return {
    tag: 'li',
    attrs: { 'data-plugin-item': ENTERPRISE_MARKET_ENTRY_ID },
    classes: ['X_2TxG_card', 'X_2TxG_cardLink'],
    children: [{
      tag: 'div',
      classes: ['X_2TxG_cardHead'],
      children: [
        { tag: 'span', classes: ['X_2TxG_cardIcon'] },
        {
          tag: 'div',
          classes: ['X_2TxG_cardMain'],
          children: [
            {
              tag: 'div',
              classes: ['X_2TxG_titleRow'],
              children: [
                {
                  tag: 'button',
                  attrs: { type: 'button' },
                  classes: ['X_2TxG_cardTitle', 'X_2TxG_cardOpen'],
                  text: ENTERPRISE_MARKET_ENTRY_LABEL,
                },
                ...(children ?? []),
              ],
            },
            { tag: 'span', classes: ['X_2TxG_cardDesc', 'own-market-entry-summary'], text: '企业插件 · 技能 · 配方' },
          ],
        },
      ],
    }],
  }
}

/** 官方某个插件行（官方 `PackageCard`）：可能带一枚官方签（默认是 beta 的「实验性」签）。 */
function officialPackageRowOutline(withStatusTag: boolean, tone = 'info', tagText = '实验性'): Outline {
  return {
    tag: 'li',
    attrs: { 'data-plugin-package': 'dsh-client-ui-example' },
    classes: ['X_2TxG_card', 'X_2TxG_cardLink'],
    children: [{
      tag: 'div',
      classes: ['X_2TxG_cardHead'],
      children: [
        { tag: 'span', classes: ['X_2TxG_cardIcon'] },
        {
          tag: 'div',
          classes: ['X_2TxG_cardMain'],
          children: [
            {
              tag: 'div',
              classes: ['X_2TxG_titleRow'],
              children: [
                { tag: 'button', attrs: { type: 'button' }, classes: ['X_2TxG_cardOpen'], text: '某官方插件' },
                ...(withStatusTag
                  ? [{ tag: 'span', classes: [...OFFICIAL_STATUS_TAG_CLASSES], attrs: { 'data-tone': tone }, text: tagText }]
                  : []),
              ],
            },
            { tag: 'span', classes: ['X_2TxG_cardDesc'], text: '官方插件的说明' },
          ],
        },
      ],
    }],
  }
}

/** 官方已有的那 7 行（4 张配置卡 + 若干插件）不必逐行复刻：装饰只认 `data-plugin-item="plugin-market"`。 */
function officialListOutline(options: { readonly statusTag?: boolean; readonly ourRow?: boolean } = {}): Outline[] {
  const rows: Outline[] = [officialPackageRowOutline(options.statusTag ?? true)]
  if (options.ourRow ?? true) rows.push(ourRowOutline())
  return rows
}

/**
 * 我们那一行的 `titleRow`，照官方 `CardHead` 实物结构走：
 * `li[data-plugin-item] > div.cardHead > [span.cardIcon, div.cardMain]` 且 `div.cardMain > [div.titleRow, span.cardDesc]`。
 */
function ourTitleRow(document: FakeDocument): FakeElement {
  const row = document.querySelector(ENTERPRISE_MARKET_ROW_SELECTOR)!
  const cardMain = row.children[0]!.children[1]!
  return cardMain.children[0]!
}

/** 场上所有「我们插的签」。 */
function ourBadges(document: FakeDocument): FakeElement[] {
  return document.querySelectorAll(`[${ENTERPRISE_MARKET_BADGE_ATTRIBUTE}]`)
}

/* -------------------------------------------------------------------------- */
/* 用例                                                                        */
/* -------------------------------------------------------------------------- */

describe('enterprise badge DOM decoration (the tag in the official list title row)', () => {
  it('inserts exactly one 企业 tag right after the official title button, cloned from the official 实验性 tag', () => {
    const document = new FakeDocument(officialListOutline())
    const warn = vi.fn()
    const result = decorateEnterpriseMarketBadge(asDocument(document), warn)

    expect(result).toBe('cloned-status-tag')
    expect(warn).not.toHaveBeenCalled()

    const titleRow = ourTitleRow(document)
    // 位次：标题按钮第一，我们的签紧随其后（标题正后方）。
    expect(titleRow.children.map(child => child.textContent)).toEqual([
      ENTERPRISE_MARKET_ENTRY_LABEL,
      ENTERPRISE_MARKET_BADGE_TEXT,
    ])
    const badge = titleRow.children[1]!
    expect(badge.tagName).toBe('span')
    // **样式来源**：克隆了官方那枚「实验性」签的**全部类**（含官方那个只声明尺寸的哈希 statusTag 类），
    // 只把文本换了——尺寸/颜色/圆角因此与官方「实验性」逐像素一致。
    expect(badge.className.split(' ')).toEqual([...OFFICIAL_STATUS_TAG_CLASSES])
    expect(badge.getAttribute('data-tone')).toBe('info')
    expect(badge.getAttribute(ENTERPRISE_MARKET_BADGE_ATTRIBUTE)).toBe(ENTERPRISE_MARKET_ENTRY_ID)
    expect(badge.textContent).toBe(ENTERPRISE_MARKET_BADGE_TEXT)
    // 官方那枚原件没被改：文本仍是「实验性」、没有被搬走。
    const officialTag = document.querySelector('[data-plugin-package] [data-tone="info"]')!
    expect(officialTag.textContent).toBe('实验性')
    expect(officialTag.getAttribute(ENTERPRISE_MARKET_BADGE_ATTRIBUTE)).toBeNull()
    expect(ourBadges(document)).toHaveLength(1)
  })

  it('never touches the official rows: they keep their own tags and get no injection', () => {
    const document = new FakeDocument(officialListOutline({ statusTag: true }))
    decorateEnterpriseMarketBadge(asDocument(document), vi.fn())
    const officialRow = document.querySelector('[data-plugin-package]')!
    expect(officialRow.querySelector(`[${ENTERPRISE_MARKET_BADGE_ATTRIBUTE}]`)).toBeNull()
    // 官方行里那枚签仍只有它自己的文本与 tone（一个字节都没动）。
    const officialTags = officialRow.querySelectorAll('span[data-tone]')
    expect(officialTags).toHaveLength(1)
    expect(officialTags[0]!.textContent).toBe('实验性')
  })

  it('is idempotent: repeated applies keep exactly one tag and never duplicate it', () => {
    const document = new FakeDocument(officialListOutline())
    const doc = asDocument(document)
    expect(decorateEnterpriseMarketBadge(doc, vi.fn())).toBe('cloned-status-tag')
    expect(decorateEnterpriseMarketBadge(doc, vi.fn())).toBe('present')
    expect(decorateEnterpriseMarketBadge(doc, vi.fn())).toBe('present')
    expect(ourBadges(document)).toHaveLength(1)
    expect(ourTitleRow(document).children).toHaveLength(2)
  })

  it('re-applies after the official page re-renders (page switch / refresh rebuilds the card)', () => {
    const document = new FakeDocument(officialListOutline())
    const change = vi.fn()
    const decoration = startEnterpriseMarketBadgeDecoration(asDocument(document), {
      observe: onChange => { change.mockImplementation(onChange); return () => undefined },
    })
    expect(ourBadges(document)).toHaveLength(1)

    // 官方整块重建（旧节点连同我们的签一起消失），观察器被叫醒后必须重新铺。
    document.body.replaceChildren(buildOutline(officialPackageRowOutline(true)), buildOutline(ourRowOutline()))
    expect(ourBadges(document)).toHaveLength(0)
    change()
    expect(ourBadges(document)).toHaveLength(1)
    expect(ourTitleRow(document).children[1]!.textContent).toBe(ENTERPRISE_MARKET_BADGE_TEXT)
    decoration.dispose()
  })

  it('dispose removes only our tag and stops observing; then a re-render stays clean', () => {
    FakeMutationObserver.instances.length = 0
    const document = new FakeDocument(officialListOutline())
    document.defaultView = { MutationObserver: FakeMutationObserver }
    const decoration = startEnterpriseMarketBadgeDecoration(asDocument(document))
    expect(ourBadges(document)).toHaveLength(1)
    const observers = FakeMutationObserver.instances.length
    expect(observers).toBeGreaterThan(0)
    // 默认观察器盯 body 的子树结构变化。
    expect(FakeMutationObserver.instances[0]!.target).toBe(document.body)
    expect(FakeMutationObserver.instances[0]!.options).toEqual({ childList: true, subtree: true })

    decoration.dispose()
    expect(ourBadges(document)).toHaveLength(0)
    expect(FakeMutationObserver.instances.every(instance => instance.disconnects === 1)).toBe(true)
    // 官方签仍在；观察器已停，再触发变化也不会重新插。
    expect(document.querySelector('[data-plugin-package] [data-tone="info"]')!.textContent).toBe('实验性')
    FakeMutationObserver.instances[0]!.trigger()
    expect(ourBadges(document)).toHaveLength(0)

    // `dispose` 可反复调：第二次不抛、也不多摘任何东西。
    expect(() => decoration.dispose()).not.toThrow()
  })

  it('falls back to another official Tag (tone forced to info) and warns when the 实验性 tag is absent', () => {
    // 官方行在，但那行没有「实验性」签，只有一枚「有问题」签（同为官方 statusTag 类、只是 tone=danger）。
    const document = new FakeDocument([
      officialPackageRowOutline(true, 'danger', '有问题'),
      ourRowOutline(),
    ])
    const warn = vi.fn()
    const result = decorateEnterpriseMarketBadge(asDocument(document), warn)
    expect(result).toBe('cloned-official-tag')
    const badge = ourTitleRow(document).children[1]!
    expect(badge.textContent).toBe(ENTERPRISE_MARKET_BADGE_TEXT)
    expect(badge.getAttribute('data-tone')).toBe('info')
    expect(badge.className.split(' ')).toEqual([...OFFICIAL_STATUS_TAG_CLASSES])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('退路')
    // 官方那枚原件没被改 tone、也没被搬走。
    expect(document.querySelector('[data-plugin-package] [data-tone="danger"]')!.textContent).toBe('有问题')
  })

  it('inserts nothing and warns once per decoration when our row exists but no official Tag sample is on the page', () => {
    const document = new FakeDocument(officialListOutline({ statusTag: false }))
    const warn = vi.fn()
    let change: () => void = () => undefined
    // 走真装饰（同一实例）：观察器每次被叫醒都会重铺，但**同一原因只记一条 warn**，不许刷屏。
    const decoration = startEnterpriseMarketBadgeDecoration(asDocument(document), {
      warn,
      observe: onChange => { change = onChange; return () => undefined },
    })
    expect(decoration.apply()).toBe('sample-missing')
    change()
    change()
    // 宁愿没有签，也不留半成品：标题行里除标题按钮外什么都没有。
    expect(ourTitleRow(document).children).toHaveLength(1)
    expect(ourBadges(document)).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('找不到官方 Tag')
    decoration.dispose()
  })

  it('stays silent (not an error) when our row is not on the page at all', () => {
    const document = new FakeDocument([officialPackageRowOutline(true)])
    const warn = vi.fn()
    expect(decorateEnterpriseMarketBadge(asDocument(document), warn)).toBe('not-on-page')
    expect(warn).not.toHaveBeenCalled()
    expect(ourBadges(document)).toHaveLength(0)
  })

  it('distinguishes "not on the official page" from "on it but our row marker is gone"', () => {
    // 官方面板在、也没在加载，但那一行不在（官方 `data-plugin-item` 改名了）⇒ 记一条 warn，不插。
    const missingRow = new FakeDocument([{
      tag: 'section',
      attrs: { 'data-plugin-panel': 'true', 'aria-busy': 'false' },
      children: [officialPackageRowOutline(true)],
    }])
    const warn = vi.fn()
    const doc = asDocument(missingRow)
    // 第三参是「同一实例的告警去重闸」——真运行时装饰句柄自己持一份（见上面那条例）。
    const warned = new Set<string>()
    expect(decorateEnterpriseMarketBadge(doc, warn, warned)).toBe('row-missing')
    expect(decorateEnterpriseMarketBadge(doc, warn, warned)).toBe('row-missing')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain(ENTERPRISE_MARKET_ROW_SELECTOR)

    // 官方那块面板还在加载（`aria-busy="true"`）时行本来就没出来：静默，别白记。
    const loading = new FakeDocument([{
      tag: 'section',
      attrs: { 'data-plugin-panel': 'true', 'aria-busy': 'true' },
      children: [officialPackageRowOutline(true)],
    }])
    const loadingWarn = vi.fn()
    expect(decorateEnterpriseMarketBadge(asDocument(loading), loadingWarn)).toBe('not-on-page')
    expect(loadingWarn).not.toHaveBeenCalled()
  })

  it('gives up (no half-baked tag) and warns when the official title button is not where it was', () => {
    // 官方结构变了：那一行的 `data-plugin-item` 还在，但里面的按钮不再是标题（文本对不上）。
    const document = new FakeDocument([{
      tag: 'li',
      attrs: { 'data-plugin-item': ENTERPRISE_MARKET_ENTRY_ID },
      children: [{
        tag: 'div',
        classes: ['X_2TxG_cardMain'],
        children: [{
          tag: 'div',
          classes: ['X_2TxG_titleRow'],
          children: [{ tag: 'button', attrs: { type: 'button' }, text: '别的按钮' }],
        }],
      }],
    }, officialPackageRowOutline(true)])
    const warn = vi.fn()
    expect(decorateEnterpriseMarketBadge(asDocument(document), warn)).toBe('anchor-missing')
    expect(ourBadges(document)).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('标题按钮')
  })

  it('cleans up every inserted tag across rows (remove is global, scoped by our own attribute)', () => {
    const document = new FakeDocument(officialListOutline())
    const doc = asDocument(document)
    decorateEnterpriseMarketBadge(doc, vi.fn())
    expect(ourBadges(document)).toHaveLength(1)
    removeEnterpriseMarketBadge(doc)
    expect(ourBadges(document)).toHaveLength(0)
  })

  it('adds no CSS class and keeps 企业 single-sourced: the new module is DOM-only', async () => {
    const source = await readFile(new URL('../src/market-entry-badge.ts', import.meta.url), 'utf8')
    // 零样式：新文件里没有 `<style>`、不设 `className`、也没有为自有类名写的 CSS 规则块。
    expect(source).not.toContain('<style')
    expect(source).not.toContain('className')
    expect(source).not.toMatch(/\.own-[a-z-]+\s*\{/)
    // 「企业」二字只有一处真源（`ENTERPRISE_MARKET_BADGE_TEXT`），新文件里不出现裸字面量。
    expect(source).toContain('ENTERPRISE_MARKET_BADGE_TEXT')
    expect(source).not.toContain(`'${ENTERPRISE_MARKET_BADGE_TEXT}'`)
    // 唯一提到我们自己的类名是「排除我们自己那枚 React 徽章」的 `:not(.own-market-tag)`，不新增类。
    expect(source).toContain(':not(.own-market-tag)')
    // 行定位选择器就是官方写 `item.id` 的那个属性（不是我们自造的钩子）。
    expect(ENTERPRISE_MARKET_ROW_SELECTOR).toBe(`[data-plugin-item="${ENTERPRISE_MARKET_ENTRY_ID}"]`)
    expect(ENTERPRISE_MARKET_BADGE_ATTRIBUTE).toBe('data-enterprise-market-badge')
  })

  it('is wired from apply() through ctx.effect and stays a safe no-op where there is no document', async () => {
    const client = await readFile(new URL('../src/client.tsx', import.meta.url), 'utf8')
    expect(client).toContain('startEnterpriseMarketBadgeDecoration(document')
    expect(client).toContain('decoration.dispose()')

    // 真接线：`ctx.effect` 起装饰——宿主给了 `document` 时当场铺签，effect 的清理函数摘签。
    const { apply } = await import('../src/client.js')
    const document = new FakeDocument(officialListOutline())
    const effects: { label?: string; dispose: unknown }[] = []
    const warnings: string[] = []
    vi.stubGlobal('document', document as unknown as Document)
    try {
      apply({
        slots: { inject: (_name: string, callback: () => unknown) => callback(), register: () => () => undefined },
        remote: { $on: () => () => undefined },
        get: () => undefined,
        inject: () => undefined,
        on: () => () => undefined,
        logger: { warn: (message: string) => { warnings.push(message) } },
        effect: (callback: () => unknown, label?: string) => {
          const dispose = callback()
          effects.push({ label, dispose })
          return undefined
        },
      } as never)
    } finally {
      vi.unstubAllGlobals()
    }
    const badgeEffect = effects.find(item => (item.label ?? '').includes('badge'))
    expect(badgeEffect, JSON.stringify(effects.map(item => item.label))).toBeDefined()
    expect(typeof badgeEffect!.dispose).toBe('function')
    // 铺签当场生效（走的是 `document` 全局，与浏览器同一条路径）。
    expect(ourBadges(document)).toHaveLength(1)
    ;(badgeEffect!.dispose as () => void)()
    expect(ourBadges(document)).toHaveLength(0)
    expect(warnings).toEqual([])

    // 无 `document` 的宿主（本仓库的 Node 测试环境默认就是）走安全跳过：不抛、不接线。
    const effectsWithoutDocument: unknown[] = []
    apply({
      slots: { inject: (_name: string, callback: () => unknown) => callback(), register: () => () => undefined },
      remote: { $on: () => () => undefined },
      get: () => undefined,
      inject: () => undefined,
      on: () => () => undefined,
      effect: (callback: () => unknown, label?: string) => {
        effectsWithoutDocument.push({ label, dispose: callback() })
        return undefined
      },
    } as never)
    const skip = effectsWithoutDocument.find(item => (item as { label?: string }).label?.includes('badge')) as { dispose: unknown }
    expect(typeof skip.dispose).toBe('function')
    expect(() => (skip.dispose as () => void)()).not.toThrow()
  })
})
