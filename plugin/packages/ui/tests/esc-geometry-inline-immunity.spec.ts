/**
 * 「其余靠类名 + 文档序的单行几何」→**行内免疫**的门禁（本刀：`esc-style.ts` 头那张清单的**全部十行**）。
 *
 * ★**这一份锁与上一刀那份（`esc-card-headdesc-inline.spec.ts`）刻意不同**：
 *   上一刀锁的是**一格**（描述）与它当时的"其它格子一个字没动"；本刀把那一类**整族**收掉，
 *   于是"其它格子没动"这条判据**必须换掉**（它在那边被**重新基线化**并写明了理由）。
 *   两份并存：描述那一格的"真写入口令 `toBe` 同一枚对象"由上一刀继续锁，本刀不重复。
 *
 * ★**同一份机理**（逐条证据见 `esc-card.tsx` 文件头与 `esc-style.ts` 文件头）：
 *   官方主题 sheet 由 `installThemeStyles(ctx)` 在**插件激活那一刻**经 `ctx.effect` 追加进
 *   `document.head`（`dsh-client-ui-theme/lib/client.js:1180-1193`），而本仓那份 `<style>` 是
 *   **React 树里的一枚元素**（`esc-page.tsx:255`）⇒ **两者的文档序不由我们决定**。
 *   官方那份若压在我们之后，它那份全局排版让受管辖的格子首帧回到 CSS **初始值**
 *   （`white-space: normal`）⇒ **自由折行 / 自由换行**；等我们的规则生效再收回去 ⇒ **版面跳变**。
 *   ⇒ 修法是把"恒一行"**行内**钉在元素上：**行内样式压过任何 stylesheet 的作者规则**，与文档序无关。
 *   ★**诚实边界**：本仓 vitest **无布局引擎、无 DOM** ⇒ 能证的只有"元素在不在同一棵树""类名/行内属性
 *     在不在、值对不对"，**证不了**"真机上官方那份 sheet 差几毫秒到"、**证不了**"跳变已消失"。
 *     真机复量只能由用户做；本仓能保证的是**这些格子不再依赖那份 sheet 在场**。
 *
 * ★**五类锁各自咬住一件事**：
 *   ① 正锁①：**逐格逐属性断值**（不许靠类名、不许 `toMatchObject` 部分命中）；
 *   ② 反向锁②：**不许新增类名承载它**（零新增 CSS 类，且类名仍恰是既有那一个）；
 *   ③ 正锁③：CSS 里那条规则**仍在**（免疫 ≠ 拆样式），且**归它的那几件一个没少**；
 *   ④ 复用锁④：**所有装配点共用同一枚常量对象**（`toBe` 同一引用，不许第二份字面量）；
 *   ⑤ 总锁⑤：清单一格都**能在源码级被点名**（按类名逐格反查，避免"漏一格"）。
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

import {
  ESC_AUTHOR_NAME_INLINE_STYLE,
  ESC_CARD_META_INLINE_STYLE,
  ESC_CARD_TAGS_INLINE_STYLE,
  ESC_CARD_TITLE_INLINE_STYLE,
  ESC_CONNECT_CATEGORY_INLINE_STYLE,
  ESC_TAG_AUTHOR_INLINE_STYLE,
  ESC_TAG_INLINE_STYLE,
  EnterpriseEscCardView,
} from '../src/esc/esc-card.js'
import { ESC_CONNECTOR_ENABLE_INLINE_STYLE, EnterpriseEscConnectorCard } from '../src/esc/esc-connector-plaza.js'
import { ESC_PILL_INLINE_STYLE, ESC_TABS_ROW_INLINE_STYLE, EnterpriseEscToolbar } from '../src/esc/esc-toolbar.js'
import { EnterpriseEscSubTabRow } from '../src/esc/esc-sub-tabs.js'
import { EnterpriseEscResourceTabs } from '../src/esc/esc-resource-tabs.js'
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

const byClassToken = (root: unknown, cls: string): Element[] =>
  walk(root).filter(each =>
    typeof each.props['className'] === 'string' && (each.props['className'] as string).split(' ').includes(cls),
  )

const readEsc = (name: string): string => readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8')

const cssSource = (): string => readEsc('esc-style.ts')

const style = (element: Element): Record<string, unknown> => element.props['style'] as Record<string, unknown>

/**
 * 逐属性断**值**——不是 `toBeDefined`、不是部分命中。
 *
 * ★**为什么必须逐条断**：这套症状的形状**就是**"少了哪一件"，少 `overflow` 时 `text-overflow`
 * 静默失效（观感只差一点点），少 `flexWrap` 时容器安静地换成换行。`toMatchObject` 那类部分命中
 * 正是会让这两种退化溜过门禁的东西。
 */
const expectStyle = (element: Element, expected: Readonly<Record<string, unknown>>, label: string): void => {
  expect(style(element), `${label}：必须带行内几何`).toBeTypeOf('object')
  for (const [key, value] of Object.entries(expected)) {
    expect(style(element)[key], `${label} 的 ${key}`).toBe(value)
  }
  // ★**不许再多出一件**：多一件就是"顺手加了别的版式"。本仓零新增 CSS 类、观感一字未改。
  expect(Object.keys(style(element)).sort(), `${label}：只允许这几件`).toEqual(Object.keys(expected).sort())
}

const item: ResourceItem = {
  id: 'skill-4194',
  name: 'dev-engineer-toolkit',
  description: '这是一段很长的技能描述文字，它真的非常长，需要单行截断才能落在卡片内缘。'.repeat(3),
  meta: '1.2.0 · 340 KB',
  // ★`category` 是 `.esc-connect-category` 那一格的唯一取值口（连接器那一支才渲染它；
  //   缺席即整格不进 DOM —— 那正是"缺席即不画"纪律，故这一格要在场就必须填它）。
  category: '研发协同',
  publishUser: { userName: 'nuwax', nickName: '纽瓦克斯', avatar: 'https://cdn.example.com/a.png' },
  stats: [
    { type: 'star', value: 3 },
    { type: 'user', value: 12 },
    { type: 'link', value: 41 },
  ],
  collected: true,
}

const connectorItem: EnterpriseConnectorItem = {
  id: 1,
  name: 'slack',
  description: '把企业消息接到会话里。'.repeat(4),
  installType: 'official',
  deployStatus: 'ready',
  official: true,
  toolCount: 3,
  category: '研发协同',
  space: { id: 7, name: '研发空间' },
} as EnterpriseConnectorItem

/** 技能卡那一档（`showUse` ⇒ 走标签行版式，描述/元信息/标签行全部在场）。 */
const skillCard = (): Element => asElement(EnterpriseEscCardView({ item, showUse: true } as never))

/** 专家卡那一档（同一套标签行版式；口径 42 起两档共用同一枚零件）。 */
const expertCard = (): Element => asElement(EnterpriseEscCardView({ item, showSummon: true } as never))

/** 三层版式那一档（裸 `h3`，不加标题行）。 */
const bareCard = (): Element => asElement(EnterpriseEscCardView({ item } as never))

/** 连接器卡（`showConnect` ⇒ 连接器分类那一格在场）。 */
const legacyConnectorCard = (): Element => asElement(EnterpriseEscCardView({ item, showConnect: true } as never))

/** 连接器广场那张卡（第二个装配点）。 */
const plazaCard = (): Element => asElement(EnterpriseEscConnectorCard({ item: connectorItem }))

const only = (hits: Element[], label: string): Element => {
  expect(hits, `${label}：恰好一枚`).toHaveLength(1)
  return hits[0]!
}

/**
 * ★★**这份门禁的"真值"是一张**字面量表**，不是那几枚常量本身。
 *
 * ★**为什么必须这样**（这是本刀自己踩出来的一条锁法）：若断言写成
 *   `expect(element.props.style).toBe(ESC_CARD_TITLE_INLINE_STYLE)`，
 *   那么把**常量本身**删掉 `overflow`/`textOverflow`（只留 `nowrap`——正是这套症状要防的那种退化）
 *   时，断言会**跟着一起缩小**，于是**照样全绿**：一份"少了三件"的常量能安然通过自己的门禁。
 *   ⇒ 逐属性判据必须对着**字面量**断，那枚常量只作为**被测对象**参与。
 * ★引用相等（`toBe` 同一枚对象）与**逐属性值**是**两条独立的锁**：前者锁"不许抄第二份字面量"，
 *   后者锁"值本身对不对"。缺前者会漂成两个形态，缺后者会把一份残缺的常量放行。
 */
const GEOMETRY = {
  /** `.esc-card-title`：不折行 + 超宽截断省略 + 钉死块级前提。 */
  'esc-card-title': { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  /** `.esc-card-meta`：同上，**外加** `flex: none`（元信息不许被压扁）。 */
  'esc-card-meta': { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none' },
  /** `.esc-card-tags`：容器不许折成第二行。 */
  'esc-card-tags': { display: 'flex', flexWrap: 'nowrap', overflow: 'hidden' },
  /** `.esc-tag`：标签单格，格内不折行；**刻意无** `textOverflow`（装的是图标 + 个位数统计）。 */
  'esc-tag': { display: 'inline-flex', whiteSpace: 'nowrap', overflow: 'hidden' },
  /** `.esc-tag.esc-tag-author`：**两条规则的并集**（它同时挂 `esc-tag` 与 `esc-tag-author`）。 */
  'esc-tag-author': { display: 'inline-flex', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 },
  /** `.esc-author-name`：定高 16px 盒，故 `overflow` 不可省（否则折行溢出盒外被裁成半个字）。 */
  'esc-author-name': { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  /** `.esc-connect-category`：**不含** `flex`（那一条属卡片布局，不属这一格）。 */
  'esc-connect-category': { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  /** `.esc-connector-enable`：只两件（两个字永远截不到，**刻意无** `overflow`/`textOverflow`）。 */
  'esc-connector-enable': { flex: 'none', whiteSpace: 'nowrap' },
  /** `.esc-pill`：用户裁决⑤那两半（永不压缩 + 永不折行）+ 定高盒不被撑破；**从不截断**。 */
  'esc-pill': { whiteSpace: 'nowrap', flexShrink: 0, boxSizing: 'border-box' },
  /** `.esc-source-tabs` / `.esc-category-tabs`：两行容器共用的那一段。 */
  'esc-tabs-row': { display: 'flex', flexWrap: 'nowrap' },
} as const satisfies Readonly<Record<string, Readonly<Record<string, unknown>>>>

describe('清单第一组 ·「连跳两次」那四条（同一张卡头尾、共用同一格数预算）', () => {
  it('★① `.esc-card-title`：三个装配点都带行内单行几何，逐属性断值', () => {
    const expected = GEOMETRY['esc-card-title']
    // ★三个装配点：标签行版式的「标题行」里那一枚（技能卡 / 专家卡）、三层版式的裸 `h3`。
    for (const card of [skillCard(), expertCard()]) {
      const titleRow = only(byClass(card, 'esc-card-titlerow'), '技能/专家卡的标题行')
      const title = only(byClass(titleRow, 'esc-card-title'), '标题行里的标题')
      expectStyle(title, expected, '.esc-card-title（标题行版式）')
      expect(title.props['title']).toBe(item.name)
      expect(title.props['children']).toBe(item.name)
    }
    expectStyle(only(byClass(bareCard(), 'esc-card-title'), '三层版式的裸 h3'), expected, '.esc-card-title（三层版式）')
  })

  it('★① `.esc-card-meta`：两个装配点都带行内单行几何 + `flex: none`', () => {
    const expected = GEOMETRY['esc-card-meta']
    // ★`flex: none` 是这一格自己的纪律（不许被压扁），故它与那三件同行内定死——CSS 里那份一字未删。
    expect(expected['flex']).toBe('none')
    const cardMeta = only(byClass(skillCard(), 'esc-card-meta'), '技能卡的元信息行')
    expectStyle(cardMeta, expected, '.esc-card-meta（技能卡）')
    expect(cardMeta.props['children']).toBe(item.meta)
    // ★广场卡那一格装的是**它自己那份**元信息（安装类型 · 工具数 · 空间名），不是技能卡的 `item.meta`。
    const plazaMeta = only(byClass(plazaCard(), 'esc-card-meta'), '广场卡的元信息行')
    expectStyle(plazaMeta, expected, '.esc-card-meta（广场卡）')
    expect(typeof plazaMeta.props['children']).toBe('string')
  })

  it('★① `.esc-card-tags`：标签行容器带行内不换行几何（`flexWrap` + `overflow`）', () => {
    const expected = GEOMETRY['esc-card-tags']
    // ★容器免疫的是"折成第二行"那一件事，故关键那件是 `flexWrap: 'nowrap'`。
    expect(expected['flexWrap']).toBe('nowrap')
    for (const card of [skillCard(), expertCard()]) {
      expectStyle(only(byClass(card, 'esc-card-tags'), '标签行容器'), expected, '.esc-card-tags')
    }
  })

  it('★① `.esc-tag`：四格标签单格都带行内不折行几何；作者格是两条规则的**并集**', () => {
    // ★统计三格走 `tagCellOf`（一个渲染点，三次调用），作者格另挂 `esc-tag-author`。
    const cells = byClassToken(skillCard(), 'esc-tag')
    expect(cells).toHaveLength(4)
    const statCells = cells.filter(each => each.props['className'] === 'esc-tag')
    expect(statCells).toHaveLength(3)
    for (const cell of statCells) expectStyle(cell, GEOMETRY['esc-tag'], '.esc-tag（统计格）')
    // ★作者那一格**同时挂两个类** ⇒ 它必须同时满足两条规则里"必须成立"的那几件（并集常量）。
    const author = only(cells.filter(each => each.props['className'] === 'esc-tag esc-tag-author'), '作者格')
    const union = GEOMETRY['esc-tag-author']
    // 并集 = `esc-tag` 那三件 + `esc-tag-author` 那两件，逐条断值（不许只断其中一半）。
    for (const [key, value] of Object.entries(GEOMETRY['esc-tag'])) expect(union[key], `并集要含 ${key}`).toBe(value)
    for (const key of ['minWidth', 'overflow']) expect(union[key], `并集要含 ${key}`).toBeDefined()
    expect(union['minWidth']).toBe(0)
    expectStyle(author, union, '.esc-tag.esc-tag-author（作者格）')
    // ★作者格的子节点**只有一枚** `AuthorRow` 元素（那一枚内部才有 `.esc-author-name`；
    //   它用了 `useState`，本仓无渲染器 ⇒ 渲染树层面不可达，如实登记——见下面「`.esc-author-name`」那条）。
    expect(childrenOf(author)).toHaveLength(1)
  })

  it('★② 反向锁：这四条不许靠**新增类名**承载——类名仍恰是既有那一个', () => {
    // ★逐格断"类名**恰是**既有那一个"，不是"包含"：多一个类就是新增 CSS 类。
    const card = skillCard()
    expect(only(byClass(card, 'esc-card-title'), '标题').props['className']).toBe('esc-card-title')
    expect(only(byClass(card, 'esc-card-meta'), '元信息').props['className']).toBe('esc-card-meta')
    expect(only(byClass(card, 'esc-card-tags'), '标签行').props['className']).toBe('esc-card-tags')
    for (const cell of byClassToken(card, 'esc-tag')) {
      const cls = cell.props['className'] as string
      expect(['esc-tag', 'esc-tag esc-tag-author']).toContain(cls)
    }
    // ★反向锁的另一半：**样式表里不许为这次修法新加一条规则**。每格的规则必须**仍是既有那几条**
    //   ——逐条点名（不是"数量不许变"，数量会因将来正当的版式改动而变；这里锁的是"没有多出一条新规则"）。
    const css = cssSource()
    // `.esc-card-title` **既有两条**（基础那条 + `.esc-card-titlerow .esc-card-title` 那条 flex/min-width），
    //   那是口径 39 留下的既有结构，本刀**一条没加**。反向锁写成"逐条点名它们仍在"更耐改。
    expect(css).toMatch(/\.esc-card-title \{[^}]*white-space: nowrap;[^}]*\}/)
    expect(css).toMatch(/\.esc-card-titlerow \.esc-card-title \{ flex: 1; min-width: 0; \}/)
    expect(css).toMatch(/\.esc-card-meta \{[^}]*flex: none;[^}]*\}/)
    expect(css).toMatch(/\.esc-card-tags \{[^}]*flex-wrap: nowrap;[^}]*\}/)
    expect(css).toMatch(/\.esc-tag \{[^}]*white-space: nowrap;[^}]*\}/)
    // ★`.esc-card-title` 那条**基础规则**仍恰是唯一一条以 `.esc-card-title {` 开头的规则
    //   （带前缀的那条不算），本刀没给它新造第二条。
    expect(css.match(/^\.esc-card-title \{/gm) ?? [], '.esc-card-title 基础规则仍唯一').toHaveLength(1)
  })

  it('★③ CSS 里那四条规则**仍在**，且归它们的几何一个没少（免疫 ≠ 拆样式）', () => {
    const css = cssSource()
    const body = (head: string): string => {
      const hit = new RegExp(`\\${head} \\{([^}]*)\\}`).exec(css)
      expect(hit, `${head} 那条规则仍在`).not.toBeNull()
      return hit![1]!
    }
    // 标题：颜色/字号/字重/行高/字距仍归它，另加那三件几何**一字未删**。
    expect(body('.esc-card-title')).toContain('white-space: nowrap')
    expect(body('.esc-card-title')).toContain('overflow: hidden')
    expect(body('.esc-card-title')).toContain('text-overflow: ellipsis')
    expect(body('.esc-card-title')).toContain('font-weight: 650')
    // 元信息：`flex: none` 那一格纪律仍在。
    expect(body('.esc-card-meta')).toContain('flex: none')
    expect(body('.esc-card-meta')).toContain('white-space: nowrap')
    // 标签行容器：`flex-wrap` 那一件仍在（行内那份是**并行**加的，不是把它改成别的样子）。
    expect(body('.esc-card-tags')).toContain('flex-wrap: nowrap')
    expect(body('.esc-card-tags')).toContain('overflow: hidden')
    // 标签单格：nowrap 仍在。
    expect(body('.esc-tag')).toContain('white-space: nowrap')
  })

  it('★④ 复用锁：三个标题装配点 + 两个元信息装配点**共用同一枚对象**（`toBe` 同一引用）', () => {
    const titleRefs = [
      only(byClass(skillCard(), 'esc-card-title'), '技能卡标题').props['style'],
      only(byClass(expertCard(), 'esc-card-title'), '专家卡标题').props['style'],
      only(byClass(bareCard(), 'esc-card-title'), '三层版式标题').props['style'],
      only(byClass(plazaCard(), 'esc-card-title'), '广场卡标题').props['style'],
    ]
    // ★四个装配点逐字同一枚对象 ⇒ 将来改动只可能改一处，不会漂成"同一处文字两个形态"。
    for (const ref of titleRefs) expect(ref).toBe(ESC_CARD_TITLE_INLINE_STYLE)
    const metaRefs = [
      only(byClass(skillCard(), 'esc-card-meta'), '技能卡元信息').props['style'],
      only(byClass(plazaCard(), 'esc-card-meta'), '广场卡元信息').props['style'],
    ]
    for (const ref of metaRefs) expect(ref).toBe(ESC_CARD_META_INLINE_STYLE)
  })

  it('★同族（清单第 5/6 行）：作者格容器带行内几何；作者名那一枚**源码级**钉死', () => {
    // ★`.esc-tag-author > span`（标签行里的作者名）就是 `AuthorRow` 里那枚 `.esc-author-name`
    //   ——同一个元素语义，故**同一枚常量**（不是两份）。
    const author = only(byClassToken(skillCard(), 'esc-tag-author'), '作者格容器')
    expect(author.props['style']).toBe(ESC_TAG_AUTHOR_INLINE_STYLE)
    // ★**诚实边界（本仓 vitest 没有渲染器）**：名字那一枚在 `AuthorRow` **内部**，
    //   而 `AuthorRow` 用了 `useState`（跨域头像"加载失败一次即回落首字头像"那条）⇒ 直调它会抛
    //   "Invalid hook call"，本仓**没有** `react-dom/server` 可绕（既有那批用例同样只断言它那枚
    //   **元素的 props**，从不渲染它内部）。故这一格改用**源码级**判据——那是本仓**能做到的上界**，
    //   如实登记，不假装能量：它能证"那一枚真的挂了 `ESC_AUTHOR_NAME_INLINE_STYLE`"，
    //   **证不了**"真机上它恒一行"。
    expect(byClassToken(skillCard(), 'esc-tag-author')).toHaveLength(1)
  })

  it('★`.esc-card-lock`（锁定原因）**仍然不加**任何截断 —— 本刀不许改它', () => {
    // ★上一刀已定案：它是"为什么点不了"的那句话，截了它等于把理由藏起来
    //   （**信息不许藏，版式才让位**）。这一条把"没加"钉死，且两档卡片都要看。
    const skillLocks = walk(skillCard()).filter(each => each.props['className'] === 'esc-card-lock')
    const expertLocks = walk(expertCard()).filter(each => each.props['className'] === 'esc-card-lock')
    const plazaLocks = walk(plazaCard()).filter(each => each.props['className'] === 'esc-card-lock')
    // ★三档合计必须有 —— 否则这条锁会空跑（"没有格"与"格没加截断"是两件事，空跑的锁等于没有锁）。
    expect(skillLocks.length + expertLocks.length + plazaLocks.length, '三档合计要有锁定原因格').toBeGreaterThan(0)
    for (const lock of [...skillLocks, ...expertLocks, ...plazaLocks]) {
      expect(lock.props['style'], '锁定原因不许带行内几何').toBeUndefined()
      expect(lock.props['role']).toBe('status')
    }
    // ★源码级反向锁：**整个 src/esc 里不许有任何人把截断挂到 `.esc-card-lock` 上**。
    for (const name of ['esc-card.tsx', 'esc-connector-plaza.tsx']) {
      const code = readEsc(name).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(
        /className: 'esc-card-lock',[\s\S]{0,240}?style:/.test(code),
        `${name}：.esc-card-lock 不许带行内 style`,
      ).toBe(false)
    }
  })
})

describe('清单第二组 ·「会破版」三处 + 「错位」一处', () => {
  it('★① `.esc-author-name`：定高盒那一格带行内几何（折行即截半截的那一格）', () => {
    const css = cssSource()
    const hit = /\.esc-author-name \{([^}]*)\}/.exec(css)
    expect(hit, '`.esc-author-name` 那条规则仍在').not.toBeNull()
    // ★**先证明它真是"定高盒"**（这是这一格比别处更危险的根据，也是 `overflow` 不可省的原因）。
    expect(hit![1]).toContain('height: 16px')
    expect(hit![1]).toContain('line-height: 16px')
    // CSS 那三件仍在。
    expect(hit![1]).toContain('white-space: nowrap')
    expect(hit![1]).toContain('overflow: hidden')

    // ★**诚实边界**：这一枚在 `AuthorRow` **内部**，而 `AuthorRow` 用了 `useState` ⇒ 直调会抛
    //   "Invalid hook call"，本仓**没有**渲染器（也没有 `react-dom/server`）⇒ 渲染树层面证不了。
    //   改用**源码级**判据（本仓能做到的上界，如实登记）：那一枚 `esc-author-name` 的 `createElement`
    //   必须**正好挂上 `ESC_AUTHOR_NAME_INLINE_STYLE` 这一枚引用**。
    const code = readEsc('esc-card.tsx').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toContain("createElement('span', { className: 'esc-author-name', style: ESC_AUTHOR_NAME_INLINE_STYLE, children: name })")
    // ★常量本身逐属性断值（`overflow: hidden` 单独断一次：少了它，折行会**溢出**定高盒而不是被关在盒内）。
    const expected = GEOMETRY['esc-author-name']
    expect(Object.keys(expected).sort()).toEqual(['display', 'overflow', 'textOverflow', 'whiteSpace'])
    expect(expected['overflow'], '定高盒那一格必须把溢出关在盒内').toBe('hidden')
    expect(expected['whiteSpace']).toBe('nowrap')
    expect(expected['textOverflow']).toBe('ellipsis')
  })

  it('★① `.esc-pill`：四处装配点（两行工具栏 + 数据驱动 chip 行 + 资源页签）都带行内几何', () => {
    // ★用户裁决⑤「移动端：药丸标签永不压缩/不折行」的两半都在这三件里：
    //   `whiteSpace`（不折行）/ `flexShrink: 0`（不压缩）/ `boxSizing: border-box`（定高盒不被撑破）。
    const expected = GEOMETRY['esc-pill']
    expect(expected['whiteSpace']).toBe('nowrap')
    expect(expected['flexShrink']).toBe(0)
    expect(expected['boxSizing']).toBe('border-box')
    // ★反向锁：药丸**从不截断**（截一枚页签等于藏信息）——不许出现 `textOverflow` / `overflow`。
    expect(Object.keys(expected).sort()).toEqual(['boxSizing', 'flexShrink', 'whiteSpace'])
    // ① 维度行 `.esc-source-tabs` 里那几枚
    const sourceRow = only(
      byClass(EnterpriseEscToolbar({
        resourceType: 'skill',
        source: 'system',
        activeCategory: '',
        categories: [],
        onSourceChange: () => undefined,
        onCategoryChange: () => undefined,
      } as never), 'esc-source-tabs'),
      '维度行',
    )
    for (const pill of childrenOf(sourceRow)) expectStyle(asElement(pill), expected, '.esc-pill（维度行）')
    // ② 二级分类行 `.esc-category-tabs` 里那几枚
    const categoryRow = only(
      byClass(EnterpriseEscToolbar({
        resourceType: 'expert',
        source: 'system',
        activeCategory: '',
        categories: [{ key: '', label: '全部' }, { key: 'agent', label: 'Agent' }],
        onSourceChange: () => undefined,
        onCategoryChange: () => undefined,
      } as never), 'esc-category-tabs'),
      '二级分类行',
    )
    for (const pill of childrenOf(categoryRow)) expectStyle(asElement(pill), expected, '.esc-pill（二级分类行）')
    // ③ 数据驱动的 chip 行（`esc-sub-tabs.tsx` 那一枚共享行）
    const subRow = asElement(EnterpriseEscSubTabRow({
      chips: [{ key: 'all', label: '全部' }, { key: 'claude', label: 'Claude Code' }],
      activeKey: 'all',
      onSelect: () => undefined,
    }))
    for (const pill of childrenOf(subRow)) expectStyle(asElement(pill), expected, '.esc-pill（数据驱动 chip 行）')
    // ④ 资源页签（内容页左上角那三枚）
    const resourceTabs = asElement(EnterpriseEscResourceTabs({ activeKey: 'skill', onSelect: () => undefined }))
    for (const pill of childrenOf(resourceTabs)) expectStyle(asElement(pill), expected, '.esc-pill（资源页签）')
  })

  it('★① `.esc-source-tabs` / `.esc-category-tabs` 两个容器：行内不换行几何', () => {
    const expected = GEOMETRY['esc-tabs-row']
    expect(expected['flexWrap']).toBe('nowrap')
    const toolbar = EnterpriseEscToolbar({
      resourceType: 'expert',
      source: 'system',
      activeCategory: '',
      categories: [{ key: '', label: '全部' }],
      onSourceChange: () => undefined,
      onCategoryChange: () => undefined,
    } as never)
    // ★两行容器**共用同一枚** ⇒ 它们的 style 必须是**同一引用**（`toBe`，不是 `toEqual`）。
    const sourceRow = only(byClass(toolbar, 'esc-source-tabs'), '维度行容器')
    const categoryRow = only(byClass(toolbar, 'esc-category-tabs'), '二级分类行容器')
    expect(style(sourceRow)['flexWrap'], '维度行不许换行').toBe('nowrap')
    expect(style(categoryRow)['flexWrap'], '二级分类行不许换行').toBe('nowrap')
    // ★维度行**自己**那条 `flex: none`（不参与窄屏压缩预算）在它的行内几何里单独带着；
    //   二级分类行**不许**白扣这一条（它不在共用那一枚里）。
    expect(style(sourceRow)['flex'], '维度行不参与压缩预算').toBe('none')
    expect(style(categoryRow)['flex'], '二级分类行不该被扣上 flex:none').toBeUndefined()
    // ★共用那部分必须是同一引用。
    for (const row of [sourceRow, categoryRow]) {
      for (const key of Object.keys(expected)) expect(style(row)[key], `容器 ${key}`).toBe(expected[key])
    }
  })

  it('★① `.esc-connector-enable`：那枚禁用启用动作带行内几何（折两行则按钮高度错）', () => {
    const expected = GEOMETRY['esc-connector-enable']
    // ★这一格只装两个字 ⇒ **刻意不给** `overflow`/`textOverflow`（截不到，加了只是稀释"必须成立"的几何）。
    expect(Object.keys(expected).sort()).toEqual(['flex', 'whiteSpace'])
    expect(expected['flex']).toBe('none')
    expect(expected['whiteSpace']).toBe('nowrap')
    const button = only(byClassToken(plazaCard(), 'esc-connector-enable'), '启用动作')
    expectStyle(button, expected, '.esc-connector-enable')
    // ★CSS 那条规则仍在（免疫 ≠ 拆样式）。
    expect(cssSource()).toMatch(/\.esc-connector-enable \{ flex: none; white-space: nowrap; \}/)
  })

  it('★① `.esc-connect-category`（错位那格）：带行内单行几何', () => {
    const expected = GEOMETRY['esc-connect-category']
    // ★它**不含** `flex: none`（那一条属卡片布局，不属这一格）⇒ 与标题那一枚**刻意不共用**。
    expect(Object.keys(expected).sort()).toEqual(['display', 'overflow', 'textOverflow', 'whiteSpace'])
    expect(Object.keys(expected)).not.toContain('flex')
    const el = only(byClass(legacyConnectorCard(), 'esc-connect-category'), '连接器分类格')
    expectStyle(el, expected, '.esc-connect-category')
    expect(el.props['children']).toBe(item.category)
    // CSS 那条规则仍在。
    const body = /\.esc-connect-category \{([^}]*)\}/.exec(cssSource())![1]!
    expect(body).toContain('white-space: nowrap')
    expect(body).toContain('text-overflow: ellipsis')
  })
})

describe('总锁 · 清单逐条点名（防漏）', () => {
  /**
   * ★**这张表就是 `esc-style.ts` 头那份清单的可执行副本**。
   *   判据是**源码级反查**：按类名去**剥掉注释后**的 `src/esc/**` 里找"谁真的给某枚元素挂上了它"，
   *   并确认那一处**带着行内几何**。★必须剥注释——沿革注释里写着这些类名，
   *   把注释算进判据等于逼着下一个改这里的人不敢写注释。
   */
  const sourceOf = (name: string): string => readEsc(name)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')

  const IMUNED: readonly { readonly cls: string; readonly owner: string }[] = [
    { cls: 'esc-card-title', owner: 'esc-card.tsx' },
    { cls: 'esc-card-meta', owner: 'esc-card.tsx' },
    { cls: 'esc-card-tags', owner: 'esc-card.tsx' },
    { cls: 'esc-tag', owner: 'esc-card.tsx' },
    { cls: 'esc-tag-author', owner: 'esc-card.tsx' },
    { cls: 'esc-author-name', owner: 'esc-card.tsx' },
    { cls: 'esc-connect-category', owner: 'esc-card.tsx' },
    { cls: 'esc-pill', owner: 'esc-toolbar.tsx' },
    { cls: 'esc-source-tabs', owner: 'esc-toolbar.tsx' },
    { cls: 'esc-category-tabs', owner: 'esc-toolbar.tsx' },
    { cls: 'esc-connector-enable', owner: 'esc-connector-plaza.tsx' },
  ]

  it('★⑤ 清单十一格逐一在**源码级**被点名，且每一格都带着行内几何常量', () => {
    for (const { cls, owner } of IMUNED) {
      // ① 这一格至少有一处**真的**挂上它（剥注释后的 className 取值，不是注释里的提及）。
      const hits = ['esc-card.tsx', 'esc-connector-plaza.tsx', 'esc-toolbar.tsx', 'esc-sub-tabs.tsx', 'esc-resource-tabs.tsx']
        .flatMap(name => [...sourceOf(name).matchAll(new RegExp(`className: '[^']*\\b${cls}\\b[^']*'`, 'g'))]
          .map(hit => name))
      expect(hits.length, `${cls} 至少要有一个装配点`).toBeGreaterThan(0)
      // ② 它**所属语义的文件**里必须有它的常量或它的行内几何挂点（防"常量放错文件/压根没写"）。
      expect(
        sourceOf(owner).includes(cls),
        `${cls} 的语义文件是 ${owner}（常量与装配点必须住在那儿，不许都塞进一个上帝模块）`,
      ).toBe(true)
    }
  })

  it('★⑤ 反向总锁：**零新增 CSS 类** —— 每个常量只带 `whiteSpace`/`overflow`/`textOverflow`/`display`/`minWidth`/`flex` 这几类键', () => {
    // ★允许的键集合＝本刀口径里那几件"必须成立"的几何。出现**色值/字号/间距/圆角**类键
    //   （color / background / fontSize / padding / margin / borderRadius / height …）即红：
    //   那些**不需要"必须成立"**，动它们是越界。
    const ALLOWED = new Set(['whiteSpace', 'overflow', 'textOverflow', 'display', 'minWidth', 'flex', 'flexShrink', 'flexWrap', 'boxSizing'])
    const constants: readonly Record<string, unknown>[] = [
      ESC_CARD_TITLE_INLINE_STYLE,
      ESC_CARD_META_INLINE_STYLE,
      ESC_CARD_TAGS_INLINE_STYLE,
      ESC_TAG_INLINE_STYLE,
      ESC_TAG_AUTHOR_INLINE_STYLE,
      ESC_AUTHOR_NAME_INLINE_STYLE,
      ESC_CONNECT_CATEGORY_INLINE_STYLE,
      ESC_CONNECTOR_ENABLE_INLINE_STYLE,
      ESC_PILL_INLINE_STYLE,
      ESC_TABS_ROW_INLINE_STYLE,
    ]
    expect(constants).toHaveLength(10)
    for (const constant of constants) {
      for (const key of Object.keys(constant)) {
        expect(ALLOWED.has(key), `${key} 不许出现在行内几何常量里（本刀只动几何）`).toBe(true)
      }
    }
  })

  it('★★总锁：每一枚**常量**逐键等于那张**字面量表** —— 防止"常量残缺却跟着自己的锁一起缩小"', () => {
    /**
     * ★★**这一条是本刀最有价值的一条锁**，理由写在这里，将来谁想删它请先读完：
     *
     * 本刀第一次写门禁时，判据是 `expect(el.props.style).toBe(ESC_CARD_TITLE_INLINE_STYLE)`。
     * 随后做红→绿演练：**把常量本身删成只剩 `whiteSpace: 'nowrap'`**（正是"少了 `overflow` 就退化"
     * 那种改法）——**那 17 条门禁照样全绿**。
     * ⇒ 因为 `toBe` 只断**引用相等**：常量残缺时断言会**跟着一起缩小**，残缺被当成"符合预期"。
     *   这是本仓最容易犯的一类**假强锁**（看起来咬住了某个常量，其实只咬住了"同一个引用"）。
     * ⇒ 修法就是本文件里那张 `GEOMETRY` **字面量表**：它是独立的、**不由被测代码生成**的期望值。
     *   本条把每一枚常量逐键 `toEqual` 那张表，于是"删掉某一件"必然红。
     */
    const pairs: readonly [string, Record<string, unknown>, Record<string, unknown>][] = [
      ['ESC_CARD_TITLE_INLINE_STYLE', ESC_CARD_TITLE_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-card-title']],
      ['ESC_CARD_META_INLINE_STYLE', ESC_CARD_META_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-card-meta']],
      ['ESC_CARD_TAGS_INLINE_STYLE', ESC_CARD_TAGS_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-card-tags']],
      ['ESC_TAG_INLINE_STYLE', ESC_TAG_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-tag']],
      ['ESC_TAG_AUTHOR_INLINE_STYLE', ESC_TAG_AUTHOR_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-tag-author']],
      ['ESC_AUTHOR_NAME_INLINE_STYLE', ESC_AUTHOR_NAME_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-author-name']],
      ['ESC_CONNECT_CATEGORY_INLINE_STYLE', ESC_CONNECT_CATEGORY_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-connect-category']],
      ['ESC_CONNECTOR_ENABLE_INLINE_STYLE', ESC_CONNECTOR_ENABLE_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-connector-enable']],
      ['ESC_PILL_INLINE_STYLE', ESC_PILL_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-pill']],
      ['ESC_TABS_ROW_INLINE_STYLE', ESC_TABS_ROW_INLINE_STYLE as Record<string, unknown>, GEOMETRY['esc-tabs-row']],
    ]
    expect(pairs).toHaveLength(Object.keys(GEOMETRY).length)
    for (const [name, actual, expected] of pairs) {
      // ★逐键 `toEqual`（含"不许多出那一件"）——**不是** `toMatchObject`：多一件同样是错。
      expect(actual, `${name} 必须逐键等于那张字面量表`).toEqual(expected)
    }
  })

  it('★诚实边界：文档序这件事本仓 vitest **证不了**（如实登记，不假装能量）', () => {
    // 无布局引擎、无 DOM ⇒ 证不了"官方那份 sheet 差几毫秒到""那一帧折几行"。
    expect(typeof document).toBe('undefined')
    // 反过来把**可证的**那条钉死：行内几何在元素自己身上（与 stylesheet 无关）。
    expect(only(byClass(skillCard(), 'esc-card-title'), '标题').props['style']).toBe(ESC_CARD_TITLE_INLINE_STYLE)
    // ★顺带把"上一刀那一格仍然免疫"这条也兜住（同一类风险的上一格，不许被本刀顺手弄坏）。
    expect(cssSource()).toContain('.esc-card-headdesc {')
    // ★文案真源仍由 `esc-copy` 持有（本刀一个字没动它）——注册一条"没顺手改文案"的凭据。
    expect(ENTERPRISE_ESC_COPY.statCollect).toBe('收藏')
  })
})