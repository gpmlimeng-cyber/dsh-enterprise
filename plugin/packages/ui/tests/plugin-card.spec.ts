/**
 * [INPUT]: 依赖叶子 `enterprise-card-text.tsx`（「企业」签 / 版本签字面 / 标题取值 `enterprisePluginDisplayName` /
 *          描述降级句）、`plugin-market.tsx` 的卡片标题行+第二行纯组件 `EnterprisePluginCardHead` 与标题按钮
 *          `EnterprisePluginCardTitle`、`marketplace-entry.tsx` 的插件行渲染（两套外壳），
 *          以及两个源文件的原文（源码级反向锁）；无 DOM（与 marketplace-entry.spec 同一套树工具）。
 * [OUTPUT]: 锁六件事——① **描述投影两态**：有描述原样说、没有（缺席/null/空串/纯空白）如实说「暂无描述」，
 *          不空白、不编造、不拿版本充数；② **卡片标题行 = 标题 + 「企业」签 + 版本短号签**，标签用的是
 *          官方 `Tag` **原语本体** + 技能行**同一串类名**（`own-market-tag` / `own-market-skillVersionTag`）+
 *          同一个 tone（企业=info、版本=neutral），字面仍是 `v{version}`；③ **第二行 = 插件描述**，
 *          在**两个表面**上都成立（企业设置 → 插件卡片 / 插件市场页的插件行），且版本信息一个字没丢
 *          （从第二行搬到标题签；已下架行照旧说「已不在企业目录中」）；④ **反向锁**：两个消费面
 *          **一个新 CSS 类都没加**（`plugin-market.tsx` 的 `<style>` 长度+FNV-1a 两道字节级判据、
 *          `.own-market-tag` 只由 `marketplace-entry.tsx` 声明一处、叶子模块零 CSS、
 *          旧第二行那句「企业发布 · v…」作为**行上文案**退场）；⑤ **标题 = 插件名称**（本刀）：显示名两态
 *          （有值原样用 / 缺席·null·空串·纯空白一律回退包名，不空白不编造），三个渲染面同一枚投影；
 *          ⑥ **点标题进详情**：标题是**真 `<button>`**（不是 span）、无障碍名「查看 <名称> 的详情」、
 *          点击回调把**本行**包名回传；反向锁——没有详情页的市场插件行**不许**出现假入口/假按钮，
 *          有详情的技能/配方行仍是一枚带同款无障碍名的真 `<button>`。
 * [POS]: 本刀（卡片第二行改描述 + 插件卡片标题行标签照技能 + 标题改插件名称并可点进详情）的机械门禁：
 *        把「照技能复用那一枚签、而不是自造第二套样式」「描述/名称缺失如实降级」「键盘可达不自造第二套实现」
 *        从口号变成可执行断言。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement, type ReactNode } from 'react'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY,
  EnterpriseMarketBadgeTag,
  enterpriseMarketVersionTag,
  enterprisePluginDescriptionText,
  enterprisePluginDisplayName,
} from '../src/enterprise-card-text.js'
import { EnterpriseMarketLegacyShell } from '../src/marketplace-entry.js'
import { EnterprisePluginCardHead, EnterprisePluginCardTitle } from '../src/plugin-market.js'

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

  it('gives every plugin row the same title tags as the skill rows and the description as its second line', () => {
    const tree = shell()
    // 标题行：三行都改成 cardHead（技能行/配方行同一枚结构），标题后紧跟「企业」签。
    const heads = collectByClassName(tree, 'own-market-cardHead')
    expect(heads).toHaveLength(3)
    const tags = collectOfficialTagProps(tree)
    // ent-a / ent-b 有版本 → 「企业」+ 版本短号；ent-c 没有版本 → 只剩「企业」签。
    expect(tags.map(props => props['children'])).toEqual(['企业', 'v1.2.0', '企业', 'v2.0.0', '企业'])
    expect(tags.map(props => props['tone'])).toEqual(['info', 'neutral', 'info', 'neutral', 'info'])
    for (const tag of [tags[1], tags[3]]) expect(tag?.['className']).toBe(PLAIN_TAGS)
    // 第二行：有描述说描述、没有描述说「暂无描述」、已下架说「已不在企业目录中」（既有口径不丢）。
    expect(collectByClassName(tree, 'own-market-cardDesc').map(props => textOf(props['children'])))
      .toEqual(['甲的描述。', '暂无描述', '已不在企业目录中'])
    // **版本信息一个字都没丢**：`v{version}` 仍在行上（只是从第二行搬到了标题签）。
    const text = textOf(tree)
    expect(text).toContain('v1.2.0')
    expect(text).toContain('v2.0.0')
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

  it('keeps the 企业 tag declared in exactly one place and removes the old second-line literal from the row', async () => {
    const source = await readFile(new URL('marketplace-entry.tsx', UI_SRC), 'utf8')
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

describe('plugin card title is a real button that opens the detail dialog', () => {
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
    expect(element.props['aria-haspopup']).toBe('dialog')
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
  it('shows the plugin name on the market plugin row and keeps it honest about having no detail page', () => {
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
    // ★市场面插件行**没有详情页**（企业插件的详情在「企业设置 → 插件」那一面）⇒ 这一面一个详情入口都不许有：
    // 没有 `.own-market-rowOpen`（那是技能/配方行的详情按钮）——「有详情却不可点」的行在这里不可能存在。
    expect(collectByClassName(tree, 'own-market-rowOpen')).toHaveLength(0)
  })

  it('keeps every row that does have a detail page clickable, and never invents a plugin detail page', async () => {
    const source = await readFile(new URL('marketplace-entry.tsx', UI_SRC), 'utf8')
    // 有详情页的两行（技能/配方）行本体是**真 `<button>`** + 「查看…详情」无障碍名——同款参照就在这里。
    expect(source).toContain('aria-label={`查看企业技能 ${skill.displayName} 详情`}')
    expect(source).toContain('aria-label={`查看企业配方 ${preset.displayName} 详情`}')
    expect(source).toContain('data-enterprise-skill-open={skill.id}')
    expect(source).toContain('data-enterprise-preset-open={preset.id}')
    // 焦点环不由本仓自造：`<button>` 原生的 `:focus-visible` 那条规则就是唯一一处（键盘可达的证据）。
    expect(source).toContain('.own-market-rowOpen:focus-visible{outline:')
    // ★没有发明「插件详情页」：这条回调/这条 DOM 键在整棵树里都不存在。
    expect(source).not.toContain('onOpenPluginDetail')
    // 设置页那枚标题按钮：真 `<button class="own-market-title">` + 「查看 <名称> 的详情」+ 未接线时的降级。
    const card = await readFile(new URL('plugin-market.tsx', UI_SRC), 'utf8')
    expect(card).toContain('className="own-market-title"')
    expect(card).toContain('aria-label={`查看 ${title} 的详情`}')
    expect(card).toContain('disabled={onOpen === undefined}')
    // 标题不再是纯文本 span：投影出来的名称挂在一枚 `strong` 里，而它在标题按钮内部。
    expect(card).toContain('<strong style={{ minWidth: 0 }}>{title}</strong>')
  })
})
