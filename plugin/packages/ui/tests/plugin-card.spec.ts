/**
 * [INPUT]: 依赖叶子 `enterprise-card-text.tsx`（「企业」签 / 版本签字面 / 标题取值 `enterprisePluginDisplayName` /
 *          描述降级句）、`plugin-market.tsx` 的卡片标题行+第二行纯组件 `EnterprisePluginCardHead` 与标题按钮
 *          `EnterprisePluginCardTitle`、**详情子页面 `EnterprisePluginDetailPage` 与内容区容器
 *          `EnterprisePluginContentRegion`**、`marketplace-entry.tsx` 的插件行渲染（两套外壳），
 *          以及两个源文件的原文（源码级反向锁）；无 DOM（与 marketplace-entry.spec 同一套树工具）。
 * [OUTPUT]: 锁七件事——① **描述投影两态**：有描述原样说、没有（缺席/null/空串/纯空白）如实说「暂无描述」，
 *          不空白、不编造、不拿版本充数；② **卡片标题行 = 标题 + 「企业」签 + 版本短号签**，标签用的是
 *          官方 `Tag` **原语本体** + 技能行**同一串类名**（`own-market-tag` / `own-market-skillVersionTag`）+
 *          同一个 tone（企业=info、版本=neutral），字面仍是 `v{version}`；③ **第二行 = 插件描述**，
 *          在**两个表面**上都成立（企业设置 → 插件卡片 / 插件市场页的插件行），且版本信息一个字没丢
 *          （从第二行搬到标题签；已下架行照旧说「已不在企业目录中」）；④ **反向锁**：两个消费面
 *          **一个新 CSS 类都没加**（`plugin-market.tsx` 的 `<style>` 长度+FNV-1a 两道字节级判据 +
 *          「文件里出现的 className 字面量必须都已被本文件的 `<style>` 声明（或那串复用的签类）」这条集合判据、
 *          `.own-market-tag` 只由 `marketplace-entry.tsx` 声明一处、叶子模块零 CSS、
 *          旧第二行那句「企业发布 · v…」作为**行上文案**退场）；⑤ **标题 = 插件名称**（显示名两态：
 *          有值原样用 / 缺席·null·空串·纯空白一律回退包名，不空白不编造），三个渲染面同一枚投影；
 *          ⑥ **点标题进详情**：标题是**真 `<button>`**（不是 span）、无障碍名「查看 <名称> 的详情」、
 *          点击回调把**本行**包名回传；反向锁——没有详情页的市场插件行**不许**出现假入口/假按钮，
 *          有详情的技能/配方行仍是一枚带同款无障碍名的真 `<button>`；
 *          ⑦ **详情是子页面、不是弹窗**（本刀）：详情事实表与改动前弹窗**逐字段逐顺序**相同、
 *          整支没有 `<Modal>`/`role="dialog"`/`aria-modal`/portal；列表与详情在**同一个**内容区容器里互斥
 *          （详情在场 ⇒ 列表那棵树一个元素都不在）；返回按钮带完整动作语义、标题是程序化聚焦点；
 *          标题按钮**不再**挂 `aria-haspopup`；返回后的滚动位置与焦点还原、Esc 接线、
 *          且**不假装有路由**（源码里一个 `pushState`/`popstate`/`history.` 都没有）；
 *          ⑧ **详情补描述（用户口径第 19 条）**：`description` 是 **additive** 可选 prop——**不传时详情大纲
 *          与改动前逐字相同**（本文件内嵌的那份 pre-change 逐行快照 + 长度 + FNV-1a 三重判据）、
 *          传真值时描述排布在**事实表之后**、原样显示那条真值（含 347 字的真实制品描述）、
 *          纯文本子节点渲染（全树与两份源码都无 `dangerouslySetInnerHTML`）、`pre-wrap` 保留原始换行、
 *          `overflow-wrap:anywhere` 挡长串英文、高度上限 12 行×20px=240px 且超出在块内滚动（**不截断**，
 *          1000 字的契约上限照旧一个字不丢）、缺失（undefined/null/空串/纯空白）⇒ **整段不进 DOM**（不留空壳）；
 *          ⑨ **口径 20（描述来自 README）**：这一段的**内容来源**换成制品里的 README——face B 传的是唯一那枚
 *          纯投影 `enterpriseMarketPluginDetailBody(readme, description)`（README 优先、短描述回落），
 *          face A **仍不传**（源码级锁：那唯一一处渲染点里既没有 `description` 也没有 `readme`）
 *          ⇒ 上面⑧那条 pre-change 逐字大纲快照**原样通过**，本文件的渲染方式/版式/CSS 一个字未改。
 * **本刀（Codex 插件商店口径）**：市场面插件行的标题行**零签**（企业签与版本短号签都撤下卡片）、
 *   每张卡 `cardHead` 只有标题一枚子节点、正文里不再出现 `v{version}`，版本信息改到详情子页面看
 *   （该用例由「三枚标题签」改写为「零签 + 两行」）。设置页那一面的卡片标题行（face A）不受影响。
 * [POS]: 本刀（详情从弹窗改成子页面）的机械门禁：把「不是浮层、是内容区切换」「字段一个不少、顺序不变」
 *        「不再有 dialog 语义」从口号变成可执行断言。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement as h, isValidElement, type ReactNode } from 'react'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { Button, Modal, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY,
  EnterpriseMarketBadgeTag,
  enterpriseMarketVersionTag,
  enterprisePluginDescriptionText,
  enterprisePluginDisplayName,
} from '../src/enterprise-card-text.js'
import { EnterpriseMarketLegacyShell } from '../src/marketplace-entry.js'
import {
  ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL,
  ENTERPRISE_PLUGIN_DETAIL_BACK_TEXT,
  ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LABEL,
  ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LINE_HEIGHT,
  ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_HEIGHT,
  ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_LINES,
  ENTERPRISE_PLUGIN_DETAIL_NOT_INSTALLED,
  ENTERPRISE_PLUGIN_DETAIL_PUBLISHER,
  ENTERPRISE_PLUGIN_DETAIL_TITLE,
  EnterprisePluginCardHead,
  EnterprisePluginCardTitle,
  EnterprisePluginContentRegion,
  EnterprisePluginDetailPage,
  enterprisePluginDetailDescription,
} from '../src/plugin-market.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Modal: vi.fn(),
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
}))

/* ───────────────────────── 无 DOM 的树工具（与 marketplace-entry.spec 同一口径） ───────────────────────── */

/** 收集元素树里的可见文本；跳过 `<style>` 内容，`vi.fn()` mock 原语产出 undefined 时退回读它的 children。 */
function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).filter(part => part !== '').join(' ')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return ''
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 真函数组件（本仓的卡片子块 / 行子块）必须就地渲染一次才看得到它产出的文本；
    // `vi.fn()` mock（官方 Tag/Switch/StateDot）产出 undefined，退回读它的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return textOf(rendered as ReactNode)
  }
  return textOf(node.props.children as ReactNode)
}

/** 收集 `className` 命中的元素 props（按空格分隔的类名之一匹配）。 */
function collectByClassName(node: ReactNode, name: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByClassName(child, name, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const className = props['className']
  if (typeof className === 'string' && className.split(/\s+/).includes(name)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByClassName(rendered as ReactNode, name, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByClassName(value as ReactNode, name, acc)
  }
  return acc
}

/** 收集树里官方 `Tag` **原语本体**的 props（按 `node.type === Tag` 取证，不看 className 猜）。 */
function collectOfficialTagProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectOfficialTagProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === (Tag as unknown)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectOfficialTagProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectOfficialTagProps(value as ReactNode, acc)
  }
  return acc
}

/** 收集某一个**宿主标签**（`dt`/`dd`/`h3`/`button`…）的 props——事实表的字段名与顺序就是从这里取的。 */
function collectByTagName(node: ReactNode, tag: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByTagName(child, tag, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === tag) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByTagName(rendered as ReactNode, tag, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByTagName(value as ReactNode, tag, acc)
  }
  return acc
}

/** 收集树里**元素身份**命中的 props（按 `node.type === type` 取证，官方原语看本体不看类名）。 */
function collectByType(node: ReactNode, type: unknown, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByType(child, type, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === type) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByType(rendered as ReactNode, type, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByType(value as ReactNode, type, acc)
  }
  return acc
}

/** 收集树上每一个元素的某个 prop 值（用来证「全树没有 `role="dialog"` / `aria-modal`」这类反面事实）。 */
function collectPropValues(node: ReactNode, key: string, acc: unknown[] = []): unknown[] {
  if (Array.isArray(node)) { for (const child of node) collectPropValues(child, key, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (key in props) acc.push(props[key])
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectPropValues(rendered as ReactNode, key, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectPropValues(value as ReactNode, key, acc)
  }
  return acc
}

/** `<style>` 文本的 FNV-1a 校验和（与 marketplace-entry.spec 同一套算法，故两边基线可比）。 */
function styleChecksum(text: string): number {
  let hash = 2166136261
  for (const char of text) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 16777619) >>> 0 }
  return hash
}

/** 从源文件里抽出 `const styles = \`…\`` 的模板字面量正文（plugin-market 那份全局 CSS）。 */
function templateLiteralAfter(source: string, marker: string): string {
  const pattern = new RegExp(`${marker} = \`([\\s\\S]*?)\``)
  const match = pattern.exec(source)
  if (match === null) throw new Error(`源码里找不到模板字面量：${marker}`)
  return match[1] ?? ''
}

/** 按模板字面量抽取被**声明**的类名（与 marketplace-entry.spec 的抽取器同一口径）。 */
function declaredClassNames(source: string): Set<string> {
  const blocks = [...source.matchAll(/`([^`]*?)`/gs)]
    .map(match => match[1] ?? '')
    .filter(block => block.includes('{') && block.includes('}') && block.includes(':'))
  const css = blocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  return new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)\s*[,:{[\s>]/g)].map(match => match[1]!))
}

const UI_SRC = new URL('../src/', import.meta.url)
const PLAIN_TAGS = 'own-market-tag own-market-skillVersionTag'

/* ───────────────────────── ① 描述投影两态 ───────────────────────── */

describe('plugin description projection', () => {
  it('keeps a real description verbatim and degrades every missing form to one honest sentence', () => {
    expect(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY).toBe('暂无描述')
    // 有描述：原样说，不加工（不 trim、不加标点、不截断）。
    expect(enterprisePluginDescriptionText('把代码审查规则带进新会话。')).toBe('把代码审查规则带进新会话。')
    expect(enterprisePluginDescriptionText('  两边留白  ')).toBe('  两边留白  ')
    // 四种缺失形态**同一个**降级句：缺席 / null / 空串 / 纯空白。
    expect(enterprisePluginDescriptionText(undefined)).toBe(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY)
    expect(enterprisePluginDescriptionText(null)).toBe(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY)
    expect(enterprisePluginDescriptionText('')).toBe(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY)
    expect(enterprisePluginDescriptionText('   ')).toBe(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY)
    // 降级句是**人话**：不含技术词、不空白、不等于空串。
    expect(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY.trim()).not.toBe('')
    expect(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY).not.toMatch(/undefined|null|package\.json/i)
  })

  it('keeps the version tag literal at the official v{version} shape with deterministic boundaries', () => {
    // 「企业」签的唯一文案（与 DOM 装饰那条路、详情徽章共用同一份常量）。
    expect(ENTERPRISE_MARKET_BADGE_TEXT).toBe('企业')
    expect(enterpriseMarketVersionTag('1.2.3')).toBe('v1.2.3')
    expect(enterpriseMarketVersionTag('0.2.0-rc.2')).toBe('v0.2.0-rc.2')
    // 没有版本 = 不出签（缺席与空串两种形态都不产出空药丸）。
    expect(enterpriseMarketVersionTag(undefined)).toBeUndefined()
    expect(enterpriseMarketVersionTag('')).toBeUndefined()
  })

  it('renders the enterprise badge with the official Tag primitive and nothing else', () => {
    const props = collectOfficialTagProps(EnterpriseMarketBadgeTag())
    expect(props).toHaveLength(1)
    expect(props[0]).toEqual({ className: 'own-market-tag', tone: 'info', children: ENTERPRISE_MARKET_BADGE_TEXT })
    // 官方公开面之外一个属性都不给（tone/className/children 三件）。
    expect(Object.keys(props[0] ?? {}).sort()).toEqual(['children', 'className', 'tone'])
  })
})

/* ───────────────────────── ②③ 面 A：企业设置 → 插件卡片 ───────────────────────── */

describe('enterprise plugin card head (企业设置 → 插件)', () => {
  it('renders 标题 + 企业签 + 版本短号签 in the title row and the description on the second line', () => {
    const head = EnterprisePluginCardHead({
      packageName: '@example/acme-tools',
      version: '1.2.3',
      description: '把代码审查规则带进新会话。',
    })
    const tags = collectOfficialTagProps(head)
    // 两枚签：第 1 枚「企业」（info）、第 2 枚版本短号（neutral）——顺序即位置（标题之后）。
    expect(tags.map(props => props['children'])).toEqual([ENTERPRISE_MARKET_BADGE_TEXT, 'v1.2.3'])
    expect(tags.map(props => props['tone'])).toEqual(['info', 'neutral'])
    // **照技能卡片复用**：版本签的类名与技能行那枚**逐字相同**（同一个官方原语、同一串类名）。
    expect(tags[1]?.['className']).toBe(PLAIN_TAGS)
    expect(tags[0]?.['className']).toBe('own-market-tag')
    // 可见文本：标题 → 企业签 → 版本签 → **第二行描述**；旧第二行那句「企业发布 · v…」一个字都没有。
    expect(textOf(head)).toBe('@example/acme-tools 企业 v1.2.3 把代码审查规则带进新会话。')
    expect(textOf(head)).not.toContain('企业发布')
    expect(textOf(head)).not.toContain('undefined')
  })

  it('degrades the second line honestly when the package has no description', () => {
    const head = EnterprisePluginCardHead({ packageName: '@example/acme-tools', version: '1.2.3', description: undefined })
    // 版本没丢（它仍在标题签上）：第二行没有描述就只能说「暂无描述」。
    expect(collectOfficialTagProps(head).map(props => props['children'])).toEqual([ENTERPRISE_MARKET_BADGE_TEXT, 'v1.2.3'])
    expect(textOf(head)).toBe('@example/acme-tools 企业 v1.2.3 暂无描述')
    // 空白描述与 null 同一个降级句。
    for (const description of ['', '   ', null]) {
      expect(textOf(EnterprisePluginCardHead({ packageName: 'ent-a', version: '1.2.3', description })))
        .toBe('ent-a 企业 v1.2.3 暂无描述')
    }
  })

  it('drops the version tag entirely when there is no version (never an empty pill)', () => {
    for (const version of [null, undefined, '']) {
      const head = EnterprisePluginCardHead({ packageName: 'ent-a', version, description: '描述。' })
      // 只剩「企业」签：版本签整枚不渲染，第二行照旧是描述。
      expect(collectOfficialTagProps(head).map(props => props['children'])).toEqual([ENTERPRISE_MARKET_BADGE_TEXT])
      expect(textOf(head)).toBe('ent-a 企业 描述。')
    }
  })

  it('keeps the tag texts and the degraded line free of technical words', () => {
    const head = EnterprisePluginCardHead({ packageName: 'ent-a', version: '1.2.3', description: undefined })
    // 两枚签的可见文案只有「企业」与版本短号——没有状态码、没有模块路径、没有字段名。
    expect(collectOfficialTagProps(head).map(props => String(props['children'])))
      .toEqual([ENTERPRISE_MARKET_BADGE_TEXT, 'v1.2.3'])
    // 我们**自己写**的那句降级话（不含发布方提供的描述）不许出现技术词、也不许把缺失渲染成 undefined/null。
    const downgraded = textOf(head).toLowerCase()
    for (const banned of ['undefined', 'null', 'package.json', 'manifest', 'json', 'sha256', 'ent_', 'http']) {
      expect(downgraded, banned).not.toContain(banned)
    }
  })
})

/* ───────────────────────── ②③ 面 B：插件市场页的插件行 ───────────────────────── */

describe('enterprise plugin rows in the plugin market page', () => {
  const rows = [
    { packageName: 'ent-a', version: '1.2.0', description: '甲的描述。', state: 'ACTIVE', inCatalog: true },
    { packageName: 'ent-b', version: '2.0.0', state: 'EXPECTED', inCatalog: true },
    { packageName: 'ent-c', version: null, state: 'FAILED', inCatalog: false },
  ] as never

  const shell = () => EnterpriseMarketLegacyShell({
    view: 'page',
    activeTab: 'plugins',
    sessionUsable: true,
    enterprisePlugins: rows,
    onTogglePlugin: () => undefined,
  })

  it('keeps the market plugin card to two lines with no title tags, and moves the version into the detail', () => {
    const tree = shell()
    // 标题行：三行都改成 cardHead（技能行/配方行同一枚结构）。
    const heads = collectByClassName(tree, 'own-market-cardHead')
    expect(heads).toHaveLength(3)
    // **本刀（分组卡片重构）**：标题行不再挂任何签——「企业」签与版本短号签都撤下卡片
    //（用户口径：两行结构、标题行不留多余标签），故市场面**一枚官方 Tag 都没有**。
    expect(collectOfficialTagProps(tree)).toEqual([])
    for (const head of heads) {
      // 只有一个子节点时 `children` 是**单个元素**而不是数组，故先归一成数组再数。
      const kids = head['children'] as ReactNode
      expect(Array.isArray(kids) ? kids : [kids]).toHaveLength(1)
    }
    // 第二行：有描述说描述、没有描述说「暂无描述」、已下架说「已不在企业目录中」（既有口径不丢）。
    expect(collectByClassName(tree, 'own-market-cardDesc').map(props => textOf(props['children'])))
      .toEqual(['甲的描述。', '暂无描述', '已不在企业目录中'])
    // **版本信息一个字都没丢**：它搬到**详情子页面**去看（同一枚 facts 供两处，由 marketplace-entry.spec 锁着）；
    // 行上不再有 `v{version}`，也没有旧第二行那句「企业发布 · v…」。
    const text = textOf(tree)
    expect(text).not.toContain('v1.2.0')
    expect(text).not.toContain('v2.0.0')
    expect(text).not.toContain('企业发布 · v')
  })
})

/* ───────────────────────── ④ 反向锁：一个新 CSS 类都没加 ───────────────────────── */

describe('no new CSS class on either card surface', () => {
  it('keeps the plugin-market stylesheet byte-identical (length + FNV-1a) and declares no tag class itself', async () => {
    const source = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    const styles = templateLiteralAfter(source, 'const styles')
    // **本刀 CSS 一字未动**：两道字节级判据锁着同一份基线（改一字节就红）。
    expect(styles.length).toBe(5345)
    expect(styleChecksum(styles)).toBe(1754276488)
    // 标签的类名是**复用**技能那一枚，本文件不许自己声明它们（否则就是同一页第二套样式）。
    const declared = declaredClassNames(source)
    expect(declared.has('own-market-tag')).toBe(false)
    expect(declared.has('own-market-skillVersionTag')).toBe(false)
    // 卡片两行确实走同一枚纯组件 + 叶子里的两个投影（标题签与描述都不是本文件自己拼的字面）。
    expect(source).toContain('<EnterprisePluginCardHead')
    expect(source).toContain('own-market-tag own-market-skillVersionTag')
    expect(source).toContain("from './enterprise-card-text.js'")
  })

  it('keeps the 企业 tag declared in exactly one place and removes the old second-line literal from the row', async () => {    const source = await readFile(new URL('marketplace-entry.tsx', UI_SRC), 'utf8')
    // `.own-market-tag` 仍只有一处声明（那条规则给「企业」签与版本签共用，本刀没有为它们另开规则）。
    expect(source.match(/\.own-market-tag\{/g)).toHaveLength(1)
    // 插件行标题行照技能行用同一串类名；旧第二行那句「企业发布 · v…」作为**行上文案**退场
    // （注释里留痕说明改动理由是允许的，故先剥注释再断可见代码）。
    expect(source).toContain('own-market-tag own-market-skillVersionTag')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(code).not.toContain('企业发布 · v')
  })

  it('keeps the shared leaf module free of any CSS declaration', async () => {
    const source = await readFile(new URL('enterprise-card-text.tsx', UI_SRC), 'utf8')
    // 叶子只管词与投影，一个 CSS 类都不声明（类名一律由两个消费侧的既有样式提供）。
    expect([...declaredClassNames(source)]).toEqual([])
    expect(source).not.toContain('{display:')
    expect(source).not.toContain('<style>')
  })

  /**
   * ★**本刀（详情子页面）最硬的那一条**：不只两根基线数字没动，而是**文件里出现的每一个 className 字面量
   * 都已经被本文件的 `<style>` 声明过**（唯一例外是那两个从技能行复用的签类，它们由 `marketplace-entry.tsx`
   * 声明、本文件一个字节都不声明）。新增的详情子页面与内容区容器因此**不可能**偷偷带上一个新类——
   * 「本刀零新增 CSS 类」这句话由集合判据兜底，改一个类名就红。
   */
  it('declares nothing new: every className literal in the file is already declared here or is the reused tag pair', async () => {
    const raw = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    // 先剥注释再抽（注释里出现的 `className="install"` 是抄 workdsh 的说明，不是本文件的类）。
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const declared = declaredClassNames(code)
    const used = new Set(
      [...code.matchAll(/className="([^"]*)"/g)]
        .flatMap(match => (match[1] ?? '').split(/\s+/))
        .filter(name => name !== ''),
    )
    // 判据本身不许空转：至少要真的抽到若干类名（否则这条会退化成永真）。
    expect(used.size).toBeGreaterThan(8)
    for (const name of used) {
      expect(declared.has(name) || PLAIN_TAGS.split(' ').includes(name), `未声明的新类：${name}`).toBe(true)
    }
    // 详情这一刀没有新造任何类（连一个 own-plugin-detail 之类的名字都不许有）。
    expect(declared.has('own-plugin-detail')).toBe(false)
    expect(code).toContain('data-enterprise-plugin-detail')
  })
})

/* ───────────────────────── ⑤ 标题 = 插件名称（显示名 → 缺省回退包名） ───────────────────────── */

describe('plugin card title = plugin display name with package-name fallback', () => {
  it('keeps a real display name verbatim and falls back to the package name for every missing form', () => {
    // 有显示名：原样用（不 trim、不加工、不截断）。
    expect(enterprisePluginDisplayName('Acme 工具箱', '@example/acme-tools')).toBe('Acme 工具箱')
    expect(enterprisePluginDisplayName('  两边留白  ', '@example/acme-tools')).toBe('  两边留白  ')
    // 缺席 / null / 空串 / 纯空白四种形态**同一个**回退值 = 包名（标题绝不允许空白、绝不编造人话名）。
    for (const displayName of [undefined, null, '', '   ']) {
      expect(enterprisePluginDisplayName(displayName, '@example/acme-tools'), String(displayName))
        .toBe('@example/acme-tools')
    }
    const fallback = enterprisePluginDisplayName(undefined, 'ent-a')
    expect(fallback.trim()).not.toBe('')
    expect(fallback).not.toMatch(/undefined|null|packageName/i)
  })

  it('renders the display name as the card title and falls back to the package name when absent', () => {
    const named = EnterprisePluginCardHead({
      displayName: 'Acme 工具箱',
      packageName: '@example/acme-tools',
      version: '1.2.3',
      description: '把代码审查规则带进新会话。',
    })
    expect(textOf(named)).toBe('Acme 工具箱 企业 v1.2.3 把代码审查规则带进新会话。')
    // 标题换了名，两枚签与位置一字未动（版本信息照旧在标题签上）。
    expect(collectOfficialTagProps(named).map(props => props['children']))
      .toEqual([ENTERPRISE_MARKET_BADGE_TEXT, 'v1.2.3'])
    // 缺省 / null / 空串 / 纯空白四种形态 → 标题回落包名（可见文本其余部分不变）。
    for (const displayName of [undefined, null, '', '   ']) {
      const head = EnterprisePluginCardHead({
        displayName,
        packageName: '@example/acme-tools',
        version: '1.2.3',
        description: '把代码审查规则带进新会话。',
      })
      expect(textOf(head), String(displayName)).toBe('@example/acme-tools 企业 v1.2.3 把代码审查规则带进新会话。')
    }
  })
})

/* ───────────────────────── ⑥ 点标题进详情（真 button + 无障碍名 + 回调归本行） ───────────────────────── */

describe('plugin card title is a real button that opens the detail subpage', () => {
  /** 标题按钮的直调入口（纯函数、无 hook）：只覆盖本用例要动的那一件 prop。 */
  const title = (overrides: Partial<Parameters<typeof EnterprisePluginCardTitle>[0]> = {}) =>
    EnterprisePluginCardTitle({
      name: '@example/acme-tools',
      displayName: 'Acme 工具箱',
      packageName: '@example/acme-tools',
      version: '1.2.3',
      description: '把代码审查规则带进新会话。',
      onOpen: () => undefined,
      ...overrides,
    })

  it('renders the title row as a real <button> (not a plain <span>) with the required accessible name', () => {
    const node = title()
    expect(isValidElement(node)).toBe(true)
    const element = node as unknown as { type: unknown; props: Record<string, unknown> }
    // ★真 `<button>`：键盘可达与焦点环走**浏览器原生语义**（没有自造 keydown/tabIndex 那第二套键盘实现）。
    expect(element.type).toBe('button')
    expect(element.props['type']).toBe('button')
    // ★**本刀**：详情已经不是弹窗而是子页面 ⇒ `aria-haspopup="dialog"` **必须不在**（它先前挂在这里）。
    expect(element.props['aria-haspopup']).toBeUndefined()
    // 反向锁：整份源码里一个 `aria-haspopup` 都没有（不许换一个说法继续谎称弹层）。
    // （断言在 ⑦ 那组源码级用例里。）
    // ★无障碍名「查看 <名称> 的详情」——名称与可见标题是**同一枚投影**。
    expect(element.props['aria-label']).toBe('查看 Acme 工具箱 的详情')
    expect(textOf(node)).toContain('Acme 工具箱')
    expect(element.props['disabled']).toBe(false)
  })

  it('derives the accessible name from the same fallback as the visible title (never blank, never undefined)', () => {
    const node = title({ displayName: undefined })
    const element = node as unknown as { props: Record<string, unknown> }
    expect(element.props['aria-label']).toBe('查看 @example/acme-tools 的详情')
    expect(textOf(node)).toContain('@example/acme-tools')
    expect(String(element.props['aria-label'])).not.toContain('undefined')
  })

  it('invokes the row opener with its own package name so the click lands on this row', () => {
    const onOpen = vi.fn()
    const node = title({ name: 'ent-b', packageName: 'ent-b', displayName: '乙插件', onOpen })
    ;(node as unknown as { props: { onClick: () => void } }).props.onClick()
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('ent-b')
  })

  it('degrades to a disabled button that explains itself when no opener is wired (never a dead control)', () => {
    const node = title({ onOpen: undefined })
    const element = node as unknown as { props: Record<string, unknown> }
    expect(element.props['disabled']).toBe(true)
    expect(element.props['title']).toBe('详情入口未接通')
    expect(() => (element.props['onClick'] as () => void)()).not.toThrow()
  })
})

/* ───────────────────────── ⑥ 反向锁：有详情才可点 / 没详情不许假装可点 ───────────────────────── */

describe('detail entry reverse locks', () => {
  it('gives the market plugin row a real detail entry — an in-page subpage, never a dialog', () => {
    const rows = [{
      packageName: 'ent-a', displayName: '甲插件', version: '1.2.0', description: '甲的描述。',
      state: 'ACTIVE', inCatalog: true,
    }] as never
    const tree = EnterpriseMarketLegacyShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: rows, onTogglePlugin: () => undefined,
    })
    // 标题 = 插件名称（不是包名）；第二行仍是描述（两件事各归各的投影）。
    expect(collectByClassName(tree, 'own-market-cardId').map(props => props['children'])).toEqual(['甲插件'])
    expect(collectByClassName(tree, 'own-market-cardDesc').map(props => props['children'])).toEqual(['甲的描述。'])
    // ★**用户口径第 16 条推翻了这里的旧反向锁**（原先断言「这一面 0 枚详情入口」）：插件行现在**有**
    // 详情**子页面**——行本体是一枚真 `<button>`（与同面技能/配方行同款同枚），无障碍名是完整句式，
    // 点击键是本行包名，「未接线」时是禁用 + 说明而不是一枚点了没反应的假按钮。
    const openers = collectByClassName(tree, 'own-market-rowOpen')
    expect(openers).toHaveLength(1)
    expect(openers[0]?.['type']).toBe('button')
    expect(openers[0]?.['aria-label']).toBe('查看企业插件 甲插件 详情')
    expect(collectPropValues(tree, 'data-enterprise-plugin-open')).toEqual(['ent-a'])
    expect(openers[0]?.['disabled']).toBe(true)
    expect(openers[0]?.['title']).toBe('详情入口未接通')
    // ★**子页面不是弹窗**：整棵树没有 `aria-haspopup`（它开的不是浮层）、没有 `role="dialog"`、
    // 没有 `aria-modal`、也没有官方 `Modal` 原语（有就是覆盖层/portal，就不是子页面了）。
    expect(collectPropValues(tree, 'aria-haspopup')).toEqual([])
    expect(collectPropValues(tree, 'aria-modal')).toEqual([])
    expect(collectByType(tree, Modal as unknown)).toEqual([])
    expect(collectPropValues(tree, 'role').filter(role => role === 'dialog')).toEqual([])
    // 设置页那枚标题类（`.own-market-title`，face A 的卡片标题按钮）不在这棵树里：两面的入口各归各的。
    expect(collectByClassName(tree, 'own-market-title')).toHaveLength(0)
  })

  it('keeps every row that has a detail page clickable, and wires the plugin row into that same mechanism', async () => {
    const source = await readFile(new URL('marketplace-entry.tsx', UI_SRC), 'utf8')
    // 有详情页的三行（技能 / 配方 / **插件**）行本体都是**真 `<button>`** + 「查看…详情」无障碍名 + 各归各的点击键。
    expect(source).toContain('aria-label={`查看企业技能 ${skill.displayName} 详情`}')
    expect(source).toContain('aria-label={`查看企业配方 ${preset.displayName} 详情`}')
    expect(source)
      .toContain('aria-label={`查看企业插件 ${enterprisePluginDisplayName(plugin.displayName, plugin.packageName)} 详情`}')
    expect(source).toContain('data-enterprise-skill-open={skill.id}')
    expect(source).toContain('data-enterprise-preset-open={preset.id}')
    expect(source).toContain('data-enterprise-plugin-open={plugin.packageName}')
    // 焦点环不由本仓自造：`<button>` 原生的 `:focus-visible` 那条规则就是唯一一处（键盘可达的证据）。
    expect(source).toContain('.own-market-rowOpen:focus-visible{outline:')
    // ★**不发明第二套插件详情**：正文**原样复用** face A 那枚纯组件（只 import 一次、只渲染一处），
    // 本文件里没有第二份事实表、也没有第二个详情容器钩子。
    expect(source).toContain('data-enterprise-plugin-detail')
    expect((source.match(/<EnterprisePluginDetailPage/g) ?? []).length).toBe(1)
    expect(source).not.toContain('data-enterprise-plugin-detail=')
    // 设置页那枚标题按钮：真 `<button class="own-market-title">` + 「查看 <名称> 的详情」+ 未接线时的降级。
    const card = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    expect(card).toContain('className="own-market-title"')
    expect(card).toContain('aria-label={`查看 ${title} 的详情`}')
    expect(card).toContain('disabled={onOpen === undefined}')
    // 标题不再是纯文本 span：投影出来的名称挂在一枚 `strong` 里，而它在标题按钮内部。
    expect(card).toContain('<strong style={{ minWidth: 0 }}>{title}</strong>')
  })
})

/* ───────────────────────── ⑦ 详情 = 子页面（不是弹窗、不是浮层） ───────────────────────── */

describe('plugin detail is an in-page subpage, never a dialog', () => {
  /** 详情子页面的直调入口（纯函数、无 hook）：只覆盖本用例要动的那几件 prop。 */
  const detail = (overrides: Partial<Parameters<typeof EnterprisePluginDetailPage>[0]> = {}) =>
    EnterprisePluginDetailPage({
      packageName: '@example/acme-tools',
      displayName: 'Acme 工具箱',
      catalogVersionText: '1.2.3',
      installed: true,
      installedVersion: '1.2.3',
      sizeBytes: 2048,
      onBack: () => undefined,
      actions: h('div', { className: 'own-market-actions' }, '更新版本'),
      ...overrides,
    })

  it('renders the very same fact list as the removed dialog, field for field and in the same order', () => {
    // ★「原样复用」的机器判据：事实表的字段名与**顺序**逐步等于改动前那份弹窗正文。
    const bare = detail()
    expect(collectByClassName(bare, 'own-market-facts')).toHaveLength(1)
    expect(collectByTagName(bare, 'dt').map(props => props['children']))
      .toEqual(['插件', '企业版本', '本机版本', '发布方', '大小'])
    expect(collectByTagName(bare, 'dd').map(props => textOf(props['children'] as ReactNode)))
      .toEqual(['Acme 工具箱', '1.2.3', '1.2.3', ENTERPRISE_PLUGIN_DETAIL_PUBLISHER, '2 KiB'])
    // 目录判定与门禁那两格：有才出（与改动前那两条条件渲染逐字同构），顺序仍在最后。
    const full = detail({ installErrorCode: 'ENT_PLUGIN_INSTALL_UNSUPPORTED', installLockNotice: '这台设备暂时装不了。' })
    expect(collectByTagName(full, 'dt').map(props => props['children']))
      .toEqual(['插件', '企业版本', '本机版本', '发布方', '大小', '安装状态', '暂时不能安装'])
    expect(textOf(full)).toContain('这台设备暂时装不了。')
  })

  it('keeps every fact honest when the plugin is delisted and not installed (never a blank, never a lie)', () => {
    const page = detail({ displayName: undefined, installed: false, installedVersion: undefined, sizeBytes: undefined })
    // 已下架（目录里没有这一版）⇒ 「大小」整格不出；未安装 ⇒ 如实说「未安装」；没有显示名 ⇒ 回退包名。
    expect(collectByTagName(page, 'dt').map(props => props['children']))
      .toEqual(['插件', '企业版本', '本机版本', '发布方'])
    expect(collectByTagName(page, 'dd').map(props => textOf(props['children'] as ReactNode)))
      .toEqual(['@example/acme-tools', '1.2.3', ENTERPRISE_PLUGIN_DETAIL_NOT_INSTALLED, ENTERPRISE_PLUGIN_DETAIL_PUBLISHER])
  })

  it('has no dialog semantics anywhere in the tree and mounts no Modal (no portal, no overlay)', () => {
    const page = detail()
    const region = page as unknown as { props: Record<string, unknown> }
    // 整块就是一枚普通的内容区节点：`role="region"` + 「插件详情：<名称>」的无障碍名。
    expect(region.props['role']).toBe('region')
    expect(region.props['aria-label']).toBe(`${ENTERPRISE_PLUGIN_DETAIL_TITLE}：Acme 工具箱`)
    // ★全树**没有** dialog 语义：`role` 只有 region 这一枚（连 progressbar/alert 都没有，因为默认没有进度与失败）。
    expect(collectPropValues(page, 'role')).toEqual(['region'])
    // ★`aria-modal` 一个都没有、`Modal` 原语一个都没挂（有就是浮层/portal，就不是子页面了）。
    expect(collectPropValues(page, 'aria-modal')).toEqual([])
    expect(collectByType(page, Modal as unknown)).toEqual([])
  })

  it('gives the back button a full-action aria-label and lands focus on the detail heading', () => {
    const onBack = vi.fn()
    const page = detail({ onBack })
    // ① 返回：真按钮 + 完整动作语义的无障碍名 + 可见文案（动词在无障碍名里，与技能/配方详情同口径）。
    const back = collectByType(page, Button as unknown).find(props => props['aria-label'] === ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL)
    expect(back, '缺一枚带「返回插件列表」无障碍名的返回按钮').toBeDefined()
    expect(back?.['title']).toBe(ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL)
    expect(textOf(back?.['children'] as ReactNode)).toBe(ENTERPRISE_PLUGIN_DETAIL_BACK_TEXT)
    ;(back?.['onClick'] as () => void)()
    expect(onBack).toHaveBeenCalledTimes(1)
    // ② 焦点落点：详情标题带 `tabIndex={-1}`（程序化聚焦点，不进 Tab 序）+ 供 effect 定位的稳定钩子。
    const heading = collectByTagName(page, 'h3')[0]
    expect(heading?.['tabIndex']).toBe(-1)
    expect(heading?.['data-enterprise-plugin-detail-title']).toBe('')
    expect(textOf(heading?.['children'] as ReactNode)).toBe(ENTERPRISE_PLUGIN_DETAIL_TITLE)
  })

  it('rides the action area (update / uninstall) inside the same subpage container', () => {
    const actions = h('div', { className: 'own-market-actions', 'data-enterprise-test-actions': 'sentinel' }, '更新版本')
    const page = detail({ actions, installLockNotice: undefined })
    // 注入的动作区就在这一支的返回节点里（不是另开一层浮层）——卸载入口与二次确认照旧走它。
    expect(collectPropValues(page, 'data-enterprise-test-actions')).toEqual(['sentinel'])
    expect(textOf(page)).toContain('更新版本')
    expect((page as unknown as { props: Record<string, unknown> }).props['children']).toBeDefined()
  })

  it('swaps the whole list out for the detail inside one shared container (never a layer)', () => {
    const withDetail = EnterprisePluginContentRegion({
      list: h('div', { className: 'own-market-grid' }, '列表'),
      detail: h('div', { 'data-enterprise-plugin-detail': 'ent-a' }, '详情'),
    })
    // 两个分支共用**同一个**返回节点 ⇒ 这就是「列表区域被详情子页面替换」。
    expect((withDetail as unknown as { props: Record<string, unknown> }).props['data-enterprise-plugin-region']).toBe('detail')
    expect(textOf(withDetail)).toBe('详情')
    expect(collectByClassName(withDetail, 'own-market-grid')).toHaveLength(0)
    const withList = EnterprisePluginContentRegion({ list: h('div', { className: 'own-market-grid' }, '列表') })
    expect((withList as unknown as { props: Record<string, unknown> }).props['data-enterprise-plugin-region']).toBe('list')
    expect(textOf(withList)).toBe('列表')
    // 列表那一支同样一个 dialog 语义都没有（容器两侧都不是浮层）。
    expect(collectPropValues(withList, 'role')).toEqual([])
  })

  it('wires the return paths it really has (button + Esc) and refuses to fake a router it does not have', async () => {
    const raw = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    // 只断**真代码**、剥掉注释（注释里为了让读者看懂会把这些词写出来，那是说明不是实现）。
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // ★本刀删掉的两样东西：`Modal` 元素（确认框那枚在 confirm-action.tsx 里，不在本文件）与 `aria-haspopup`。
    expect(code).not.toContain('<Modal')
    expect(code).not.toContain('aria-haspopup')
    expect(code).not.toContain('role="dialog"')
    // 返回的两条真路径：返回按钮（`onBack` → `closeDetail`）与 Esc（命中即停冒泡，别把整个设置页也关掉）。
    expect(code).toContain('onBack={closeDetail}')
    expect(code).toContain("event.key !== 'Escape'")
    expect(code).toContain('event.stopPropagation()')
    // 返回后还原：点击那一刻读滚动位置、按包名把焦点还给那一枚标题按钮、`useLayoutEffect` 在绘制前落定。
    expect(code).toContain('scrollTop')
    expect(code).toContain('useLayoutEffect')
    expect(code).toContain("querySelectorAll<HTMLElement>('[data-enterprise-plugin-open]')")
    // ★**不假装有路由**：本页是官方 `plugins.item` 的 page 视图，硬造 history 会与宿主打架，故一个都没有。
    expect(code).not.toContain('pushState')
    expect(code).not.toContain('popstate')
    expect(code).not.toContain('history.')
  })

  it('keeps the uninstall confirmation a dialog (the only dialog left on this page)', async () => {
    const raw = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // 用户要改的是【详情】，不是确认框：卸载的二次确认照旧是 `ConfirmAction` + 官方 `Modal`，影响说明一字未动。
    expect(code).toContain("from './confirm-action.js'")
    expect(code).toContain('<ConfirmAction')
    expect(code).toContain('ENTERPRISE_PLUGIN_UNINSTALL_TITLE')
    expect(code).toContain('ENTERPRISE_PLUGIN_UNINSTALL_IMPACT')
    expect(code).toContain('onConfirm={() => { setSelected(undefined); void store.removePlugin(name) }}')
    // 二次确认那枚弹窗在确认组件里（本页只是用它），故本页自己一个 Modal 元素都不渲染。
    const confirm = await readFile(new URL('confirm-action.tsx', UI_SRC), 'utf8')
    expect(confirm).toContain('<Modal')
    expect(confirm).toContain('dataset.enterpriseConfirmation')
  })
})

/* ───────────────────────── ⑧ 插件市场详情补描述（用户口径第 19 条） ───────────────────────── */

/**
 * 官方原语的 mock 身份表：`vi.fn()` 被调用只会产出 `undefined`，故大纲按**身份**记名再展开它的 children
 * （与 `marketplace-entry.spec.ts` 的 `domOutline` / `MOCK_PRIMITIVES` 同一口径）。
 */
const DETAIL_MOCK_PRIMITIVES: readonly [unknown, string][] = [
  [Button as unknown, 'Button'],
  [Modal as unknown, 'Modal'],
  [Tag as unknown, 'Tag'],
]

/**
 * 详情子页面的**逐字大纲**（纯函数树 → 逐行字符串）：`undefined/null/false/true` 与空数组不出行，
 * 字符串/数字出行，Fragment 透明下钻，函数组件就地渲染一次，官方原语按身份记名。
 */
function detailOutline(node: ReactNode, depth = 0): string[] {
  const pad = '  '.repeat(depth)
  if (node === null || node === undefined || node === false || node === true) return []
  if (typeof node === 'string' || typeof node === 'number') return [`${pad}#text:${String(node)}`]
  if (Array.isArray(node)) return node.flatMap(child => detailOutline(child, depth))
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  const type = node.type as unknown
  const attrs = Object.entries(props)
    .filter(([key, value]) => key !== 'children' && value !== undefined && value !== null)
    .map(([key, value]) => `[${key}=${typeof value === 'function' ? '[fn]' : String(value)}]`)
    .join('')
  for (const [mock, name] of DETAIL_MOCK_PRIMITIVES) {
    if (type === mock) return [`${pad}${name}${attrs}`, ...detailOutline(props['children'] as ReactNode, depth + 1)]
  }
  if (typeof type === 'function') return detailOutline((type as (p: unknown) => ReactNode)(props), depth)
  if (type === Symbol.for('react.fragment')) return detailOutline(props['children'] as ReactNode, depth)
  if (typeof type !== 'string') return [`${pad}#opaque:${String(type)}`]
  return [`${pad}${type}${attrs}`, ...detailOutline(props['children'] as ReactNode, depth + 1)]
}

/**
 * ★**本刀最硬的那一条**：**不传 `description` 时，详情渲染树与改动前逐字相同**。
 *
 * 这份大纲是**改动落定之前**（同一枚纯组件、同一组 props）跑出来的逐行快照；本刀只往那一支里加了
 * 「有描述才多一段」的**条件分支**，缺省路径一个节点、一个属性、一个字都没动 ⇒ 它必须原样通过。
 * 它同时把「face A 不受影响」从口号变成可执行的字节级判据（face A 永远不传这个 prop）。
 */
const LEGACY_PLUGIN_DETAIL_OUTLINE: readonly string[] = [
  'div[data-enterprise-plugin-detail=@example/acme-tools][role=region][aria-label=插件详情：Acme 工具箱]',
  '  div[className=own-market-toolbar]',
  '    Button[size=sm][variant=ghost][icon=[object Object]][aria-label=返回插件列表][title=返回插件列表][data-enterprise-plugin-detail-back=][onClick=[fn]]',
  '      #text:插件列表',
  '  h3[tabIndex=-1][data-enterprise-plugin-detail-title=][style=[object Object]]',
  '    #text:插件详情',
  '  dl[className=own-market-facts]',
  '    dt',
  '      #text:插件',
  '    dd',
  '      #text:Acme 工具箱',
  '    dt',
  '      #text:企业版本',
  '    dd',
  '      #text:1.2.3',
  '    dt',
  '      #text:本机版本',
  '    dd',
  '      #text:1.2.3',
  '    dt',
  '      #text:发布方',
  '    dd',
  '      #text:企业管理员',
  '    dt',
  '      #text:大小',
  '    dd',
  '      #text:2 KiB',
  '  div[className=own-market-actions]',
  '    #text:更新版本',
]

/**
 * 企业目录里**最长的那条真实描述**（347 字）：真值来自真实上架制品
 * `@mengli114/dsh-settings-nav-collapse` 的 `package.json`（与 `platform-client` / `ui` 解码层
 * 那两条用例里用的是**同一串字节**，故「真值」这条链在四个包里说的是同一句话）。
 */
const REAL_PLUGIN_DESCRIPTION = 'DSH web client plugin: one toggle in the settings panel header collapses the settings navigation'
  + ' column into a narrow icon rail, so the settings content keeps a readable width on phones and other narrow'
  + " viewports. The panel is located at runtime from the plugin's own node (no package-internal attribute), and"
  + ' the choice is remembered per browser.'

describe('plugin detail description (口径 19): face B gains it, face A output stays byte-identical', () => {
  /** 详情子页面直调入口（与 ⑦ 那组**同一组 props**：本组的大纲快照必须与它可比）。 */
  const detail = (overrides: Partial<Parameters<typeof EnterprisePluginDetailPage>[0]> = {}) =>
    EnterprisePluginDetailPage({
      packageName: '@example/acme-tools',
      displayName: 'Acme 工具箱',
      catalogVersionText: '1.2.3',
      installed: true,
      installedVersion: '1.2.3',
      sizeBytes: 2048,
      onBack: () => undefined,
      actions: h('div', { className: 'own-market-actions' }, '更新版本'),
      ...overrides,
    })

  /** 描述段的容器 props（`undefined` = 整段不在树里）。 */
  const descriptionSection = (page: ReactNode): Record<string, any> | undefined =>
    collectByClassName(page, 'own-market-notice')[0]

  /** 描述**正文**那一枚节点的 props（纯文本子节点挂在它的 `children` 上）。 */
  const descriptionBody = (page: ReactNode): Record<string, any> => {
    const section = descriptionSection(page)
    expect(section, '描述段不在树里').toBeDefined()
    const children = section?.['children'] as ReactNode[]
    expect(Array.isArray(children), '描述段应当同时带小标题与正文两枚节点').toBe(true)
    return (children[1] as unknown as { props: Record<string, any> }).props
  }

  it('derives the description through an additive projection that has no placeholder for the missing case', () => {
    // 有描述：**原样**返回（不 trim、不截断、不改写）——与行上那枚投影的「有值」口径一致。
    expect(enterprisePluginDetailDescription(REAL_PLUGIN_DESCRIPTION)).toBe(REAL_PLUGIN_DESCRIPTION)
    expect(enterprisePluginDetailDescription('  两边留白  ')).toBe('  两边留白  ')
    // 缺失：`undefined`（**不是**「暂无描述」）——详情里缺描述是整段不出现，那才是本投影与行上那枚的差别。
    for (const missing of [undefined, null, '', '   ']) {
      expect(enterprisePluginDetailDescription(missing), String(missing)).toBeUndefined()
    }
    expect(enterprisePluginDetailDescription(undefined)).not.toBe(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY)
    // 小标题与上限：12 行 × 20px（与复用的既有文案类 `.own-market-notice` 的 line-height 同值）。
    expect(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LABEL).toBe('描述')
    expect(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_LINES).toBe(12)
    expect(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LINE_HEIGHT).toBe(20)
    expect(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_HEIGHT).toBe('240px')
  })

  it('shows the row\'s real description verbatim, after the fact list and before the action area', () => {
    expect(REAL_PLUGIN_DESCRIPTION).toHaveLength(347)
    const page = detail({ description: REAL_PLUGIN_DESCRIPTION })
    // 那段真值**一个字不少**地上屏（不是截断值、不是摘要）。
    expect(textOf(page)).toContain(REAL_PLUGIN_DESCRIPTION)
    expect(textOf(page)).toContain(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LABEL)
    expect(descriptionBody(page)['children']).toBe(REAL_PLUGIN_DESCRIPTION)
    // 排布：事实表 `<dl>` **之后**、动作区之前（既有版式一字不动，只多这一段）。
    const root = (page as unknown as { props: { children: ReactNode[] } }).props
    const kinds = (root.children as ReactNode[])
      .map(child => (isValidElement(child) ? String((child.type as unknown)) : ''))
    expect(kinds.indexOf('dl')).toBeGreaterThan(-1)
    expect(kinds.indexOf('section')).toBeGreaterThan(kinds.indexOf('dl'))
    expect(kinds.indexOf('section')).toBeLessThan(kinds.lastIndexOf('div'))
  })

  it('keeps face A byte-identical when no description is passed (pre-change outline snapshot, triple lock)', () => {
    // ① 不传 ⇒ 与改动前逐行相同（这份快照取自改动落定之前）。
    const outline = detailOutline(detail())
    expect(outline).toEqual(LEGACY_PLUGIN_DETAIL_OUTLINE)
    // ② 显式传 `undefined` 与「根本不传」是**同一棵树**（additive 的缺省路径只有一条）。
    expect(detailOutline(detail({ description: undefined }))).toEqual(LEGACY_PLUGIN_DETAIL_OUTLINE)
    // ③ 读一份压缩读数（长度 + FNV-1a），便于在汇报里一眼核对；比字符串数组更省地方，且同样字节级。
    const joined = LEGACY_PLUGIN_DETAIL_OUTLINE.join('\n')
    expect(joined.length).toBe(708)
    expect(styleChecksum(joined)).toBe(2780040711)
    expect(detailOutline(detail()).join('\n')).toBe(joined)
    // ④ 传了描述确实**多出**一段（证明缺省那条路径的「不变」不是因为分支根本没接上）。
    expect(detailOutline(detail({ description: '有描述。' })).length).toBeGreaterThan(outline.length)
  })

  it('keeps face A out of it at the source level, and never injects HTML anywhere', async () => {
    const source = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    // face A（企业设置 → 插件）那**唯一一处**渲染点不传 `description`：它渲染出的东西因此与改动前逐字相同。
    const start = source.indexOf('<EnterprisePluginDetailPage')
    expect(start).toBeGreaterThan(-1)
    const callSite = source.slice(start, source.indexOf('/>', start))
    expect(callSite).not.toContain('description')
    // 口径 20 起再加一条：face A 也**不传** `readme`（README 只喂 face B 的详情，face A 那一段整段不出）。
    expect(callSite).not.toContain('readme')
    // 两面都不许有 HTML 注入口（描述是纯文本子节点渲染的源码级证据）。
    const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(strip(source)).not.toContain('dangerouslySetInnerHTML')
    const market = await readFile(new URL('marketplace-entry.tsx', UI_SRC), 'utf8')
    // face B 那一面确实把真值传进详情，而且**口径 20 起它的来源是 README 优先、短描述回落**：
    // 传的是**唯一那一枚**纯投影 `enterpriseMarketPluginDetailBody(row.readme, row.description)`——
    // 不许退回成"只看 description"（那样 README 永远上不了屏），也不许在这里内联三元表达式（那会造出第二套口径）。
    expect(market).toContain('description={enterpriseMarketPluginDetailBody(page.row.readme, page.row.description)}')
    expect(market).toContain('export function enterpriseMarketPluginDetailBody(')
    // face B 的行投影确实把目录里那枚 README 带上来（只有真拿到非空串才产出该键）。
    expect(market).toContain('...(cat?.readme === undefined ? {} : { readme: cat.readme })')
    expect(strip(market)).not.toContain('dangerouslySetInnerHTML')
  })

  it('renders the description as a plain text node (never HTML) and keeps its original line breaks', () => {
    const multiline = '第一行：把代码审查规则带进新会话。\n第二行：<b>这不是 HTML</b>，原样显示。'
    const page = detail({ description: multiline })
    const body = descriptionBody(page)
    // ★纯文本子节点：正文就是**一个字符串**（不是元素、不是数组、更不是 innerHTML）。
    expect(body['children']).toBe(multiline)
    expect(body['dangerouslySetInnerHTML']).toBeUndefined()
    expect(collectPropValues(page, 'dangerouslySetInnerHTML')).toEqual([])
    // 原始换行照旧（`pre-wrap`），长串英文不撑破（`anywhere`）。
    const style = body['style'] as Record<string, unknown>
    expect(style['whiteSpace']).toBe('pre-wrap')
    expect(style['overflowWrap']).toBe('anywhere')
    expect(textOf(page)).toContain('第一行：把代码审查规则带进新会话。')
    expect(textOf(page)).toContain('<b>这不是 HTML</b>，原样显示。')
  })

  it('caps the block at 12 lines with in-block scrolling, without ever truncating the text', () => {
    const contractMax = 'y'.repeat(1000)
    const page = detail({ description: contractMax })
    const body = descriptionBody(page)
    const style = body['style'] as Record<string, unknown>
    // 限长是**版式**上的（高度上限 + 块内滚动），不是把字删掉：契约上限 1000 字整串照旧在树里。
    expect(style['maxHeight']).toBe('240px')
    expect(style['overflowY']).toBe('auto')
    expect(style['maxHeight']).toBe(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_MAX_HEIGHT)
    expect(body['children']).toBe(contractMax)
    expect(String(body['children']).length).toBe(1000)
    // 正文那一枚节点不是死滚动区：它可聚焦（键盘用户能滚着读全，不用鼠标）。
    expect(body['tabIndex']).toBe(0)
  })

  it('omits the whole block when there is nothing honest to show (no shell, no 暂无描述 placeholder)', () => {
    for (const missing of [undefined, '', '   ']) {
      const page = detail({ description: missing })
      expect(descriptionSection(page), String(missing)).toBeUndefined()
      expect(collectPropValues(page, 'data-enterprise-plugin-detail-description')).toEqual([])
      expect(textOf(page)).not.toContain(ENTERPRISE_PLUGIN_DETAIL_DESCRIPTION_LABEL)
    }
    // 「暂无描述」是**行上第二行**的口径，不许被搬到详情里当占位（那是行上那句话，不是这里的）。
    expect(textOf(detail({ description: undefined }))).not.toContain(ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY)
  })
})
