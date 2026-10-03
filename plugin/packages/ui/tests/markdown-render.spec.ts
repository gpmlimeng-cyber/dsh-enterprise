/**
 * [INPUT]: 只依赖 `react`（`isValidElement`）+ vitest + 同包新叶 `../src/markdown-render.js`（自写的最小安全渲染器）
 * [OUTPUT]: 口径 22 的渲染器门禁（**无 DOM**，与全仓同一套「纯函数树取证」手法）——
 *   ① 链接协议白名单（只放行 http/https/mailto，`javascript:`/`data:`/`vbscript:`/控制字符绕写/相对路径一律拒）；
 *   ② 块级语法逐条（ATX 标题 / 段落 / 无序·有序列表 / 一层嵌套 / 围栏代码块（语言名保留）/ 引用 / 水平线）；
 *   ③ 行内语法逐条（行内代码 / 粗体 / 斜体 / 删除线 / 链接 / 硬换行）；
 *   ④ 降级表（表格当段落、HTML 标签当纯文本、图片语法**绝不**变 `<img>`）；
 *   ⑤ **安全三连**（`<script>` / `<img onerror>` / `[x](javascript:…)` 断言无 script 标签、无 onerror 属性、
 *      无 `javascript:` 链接，且原文仍在可见文本里）；
 *   ⑥ 非法 / 病态 / 超大输入**不抛错且有界**（元素数不超过输入长度；深度与步数预算锁住病态输入）。
 * [POS]: README 一律当**数据**这条红线在渲染层的机械判据——本仓没有 DOM 渲染测试，故取证全部落在
 *        「React 元素树的标签名 / 属性 / 子节点字符串」上。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
  MARKDOWN_INLINE_BUDGET_BASE,
  MARKDOWN_INLINE_BUDGET_FACTOR,
  MARKDOWN_LINK_REL,
  MARKDOWN_LINK_TARGET,
  markdownLinkHref,
  parseMarkdownBlocks,
  renderMarkdown,
} from '../src/markdown-render.js'

/** 先序展开整棵树（函数组件不在此列：渲染器只产出宿主元素与字符串）。 */
function elements(node: ReactNode, acc: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) { for (const child of node) elements(child, acc); return acc }
  if (!isValidElement(node)) return acc
  acc.push(node)
  elements((node.props as Record<string, unknown>)['children'] as ReactNode, acc)
  return acc
}

/** 树里所有宿主标签名（字符串 type）。 */
function tagNames(node: ReactNode): string[] {
  return elements(node).map(element => element.type).filter((type): type is string => typeof type === 'string')
}

/** 可见文本（字符串子节点原样拼接）。 */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isValidElement(node)) return ''
  return textOf((node.props as Record<string, unknown>)['children'] as ReactNode)
}

/** 某个标签的全部 props（如 `a` / `code` / `li`）。 */
function propsOf(node: ReactNode, tag: string): Record<string, any>[] {
  return elements(node)
    .filter(element => element.type === tag)
    .map(element => element.props as Record<string, any>)
}

/** 某个标签的**可见文本**逐份取出（列表项/标题用）。 */
function textsOf(node: ReactNode, tag: string): string[] {
  return elements(node)
    .filter(element => element.type === tag)
    .map(element => textOf((element.props as Record<string, unknown>)['children'] as ReactNode))
}

/** 全树递归找有没有某个属性键（含值为 `undefined` 的键也不放过——`onerror` 这类一个都不许有）。 */
function hasProp(node: ReactNode, key: string): boolean {
  if (Array.isArray(node)) return node.some(child => hasProp(child, key))
  if (!isValidElement(node)) return false
  const props = node.props as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(props, key)) return true
  return hasProp(props['children'] as ReactNode, key)
}

describe('markdown link gate (口径 22 安全红线)', () => {
  it('allows only http/https/mailto and rejects every other scheme as plain text', () => {
    // ① 放行（大小写不敏感、首尾空白与 `<>` 包裹都归一）
    expect(markdownLinkHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(markdownLinkHref('HTTP://EXample.com')).toBe('HTTP://EXample.com')
    expect(markdownLinkHref('  https://example.com  ')).toBe('https://example.com')
    expect(markdownLinkHref('<https://example.com>')).toBe('https://example.com')
    expect(markdownLinkHref('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(markdownLinkHref('https://example.com "标题"')).toBe('https://example.com')
    // ② 拒绝：可执行协议 / 数据协议 / 相对路径 / 空串 / 只有空白
    for (const bad of [
      'javascript:alert(1)', 'JavaScript:alert(1)', 'vbscript:msgbox(1)',
      'data:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd', '/relative/path',
      './x', 'example.com', '', '   ', '#anchor',
    ]) {
      expect(markdownLinkHref(bad), bad).toBeUndefined()
    }
    // ③ 控制字符绕写（协议名里夹换行/制表）一律拒——否则 `java\nscript:` 会绕过前缀判定
    for (const bad of ['java\nscript:alert(1)', 'java\tscript:alert(1)', 'jav\u0000ascript:alert(1)']) {
      expect(markdownLinkHref(bad), JSON.stringify(bad)).toBeUndefined()
    }
  })
})

describe('markdown block syntax → the matching host tag', () => {
  it('renders ATX headings h1..h6 and refuses seven hashes', () => {
    const tree = renderMarkdown('# 一\n\n## 二\n\n### 三\n\n#### 四\n\n##### 五\n\n###### 六\n')
    expect(textsOf(tree, 'h1')).toEqual(['一'])
    expect(textsOf(tree, 'h2')).toEqual(['二'])
    expect(textsOf(tree, 'h3')).toEqual(['三'])
    expect(textsOf(tree, 'h4')).toEqual(['四'])
    expect(textsOf(tree, 'h5')).toEqual(['五'])
    expect(textsOf(tree, 'h6')).toEqual(['六'])
    // 七个井号不是标题（CommonMark 口径）：整行仍是段落文字，一个字都不丢。
    const seven = renderMarkdown('####### 七\n')
    expect(tagNames(seven)).toEqual(['p'])
    expect(textOf(seven)).toContain('####### 七')
    // 标题的字号/间距是**内联样式**（不新增 CSS 类）：h1 比 h2 大，且首块没有顶部外边距。
    const h1Style = propsOf(tree, 'h1')[0]!['style'] as Record<string, unknown>
    const h2Style = propsOf(tree, 'h2')[0]!['style'] as Record<string, unknown>
    expect(Number(h1Style['fontSize'])).toBeGreaterThan(Number(h2Style['fontSize']))
    expect(h1Style['margin']).toBe('0 0 8px')
    expect(h2Style['margin']).toBe('12px 0 8px')
    expect(elements(tree).every(element => (element.props as Record<string, unknown>)['className'] === undefined)).toBe(true)
  })

  it('renders paragraphs, unordered and ordered lists, and one level of nesting', () => {
    const plain = renderMarkdown('第一段。\n第二行继续。\n\n第二段。\n')
    expect(tagNames(plain)).toEqual(['p', 'p'])
    expect(textOf(plain)).toContain('第一段。 第二行继续。')
    expect(textOf(plain)).toContain('第二段。')

    const unordered = renderMarkdown('- 甲\n- 乙\n')
    expect(tagNames(unordered)).toEqual(['ul', 'li', 'li'])
    expect(textsOf(unordered, 'li')).toEqual(['甲', '乙'])

    const ordered = renderMarkdown('3. 丙\n4. 丁\n')
    expect(tagNames(ordered)).toEqual(['ol', 'li', 'li'])
    expect(propsOf(ordered, 'ol')[0]!['start']).toBe(3)

    const nested = renderMarkdown('- 父\n  - 子一\n  - 子二\n- 叔\n')
    expect(tagNames(nested)).toEqual(['ul', 'li', 'ul', 'li', 'li', 'li'])
    // `textsOf` 取的是**子树拼接**的可见文本：外层 `li` 的读数因此带上它里面的子列表，属预期。
    expect(textsOf(nested, 'li')).toEqual(['父子一子二', '子一', '子二', '叔'])
  })

  it('renders fenced code blocks verbatim and keeps the optional language name', () => {
    const tree = renderMarkdown('说明：\n\n```ts\nconst a = 1\n  const b = 2\n```\n\n结束。\n')
    expect(tagNames(tree)).toEqual(['p', 'pre', 'code', 'p'])
    const code = propsOf(tree, 'code')[0]!
    expect(code['children']).toBe('const a = 1\n  const b = 2')
    expect(code['data-markdown-language']).toBe('ts')
    // 语言名可选：没有就整枚属性不出现（不是空串）
    const bare = renderMarkdown('```\nplain\n```\n')
    expect(propsOf(bare, 'code')[0]!['data-markdown-language']).toBeUndefined()
    expect(textOf(bare)).toContain('plain')
    // 代码块按 `pre` 原样排（空白不塌），语言名只挂在属性上、不上屏
    expect((propsOf(tree, 'pre')[0]!['style'] as Record<string, unknown>)['whiteSpace']).toBe('pre')
    expect(textOf(tree)).not.toContain('ts\n')
  })

  it('renders blockquotes and horizontal rules', () => {
    const tree = renderMarkdown('> 引用第一行\n> 引用第二行\n\n---\n')
    expect(tagNames(tree)).toEqual(['blockquote', 'hr'])
    expect(textOf(tree)).toContain('引用第一行 引用第二行')
    const quoteStyle = propsOf(tree, 'blockquote')[0]!['style'] as Record<string, unknown>
    expect(String(quoteStyle['borderLeft'])).toContain('3px solid')
    expect((propsOf(tree, 'hr')[0]!['style'] as Record<string, unknown>)['border']).toBe(0)
  })
})

describe('markdown inline syntax → the matching host tag', () => {
  it('renders inline code, bold, italic, strikethrough, links and hard breaks', () => {
    const tree = renderMarkdown('**粗** 与 *斜* 与 ~~删~~ 与 `code` 与 [点我](https://example.com) 收尾\n')
    expect(tagNames(tree)).toEqual(['p', 'strong', 'em', 'del', 'code', 'a'])
    expect(textOf(tree)).toContain('粗 与 斜 与 删 与 code 与 点我 收尾')
    const link = propsOf(tree, 'a')[0]!
    expect(link['href']).toBe('https://example.com')
    expect(link['rel']).toBe(MARKDOWN_LINK_REL)
    expect(link['target']).toBe(MARKDOWN_LINK_TARGET)
    // 行内代码是等宽内联样式（不新增 CSS 类）
    expect((propsOf(tree, 'code')[0]!['style'] as Record<string, unknown>)['fontFamily']).toBeDefined()
    expect(elements(tree).every(element => (element.props as Record<string, unknown>)['className'] === undefined)).toBe(true)
  })

  it('supports explicit hard breaks (two trailing spaces or a backslash) without turning soft wraps into breaks', () => {
    const hard = renderMarkdown('第一行  \n第二行\n')
    expect(tagNames(hard)).toEqual(['p', 'br'])
    const soft = renderMarkdown('第一行\n第二行\n')
    expect(tagNames(soft)).toEqual(['p'])
    // 反斜杠转义：`\*` 是字面星号（不是斜体起点）
    expect(textOf(renderMarkdown('\\*不是斜体\\*\n'))).toContain('*不是斜体*')
    expect(tagNames(renderMarkdown('\\*不是斜体\\*\n'))).toEqual(['p'])
  })
})

describe('markdown degradation: unsupported syntax becomes plain text, never markup', () => {
  it('keeps tables as ordinary paragraph text', () => {
    const tree = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
    expect(tagNames(tree)).toEqual(['p'])
    expect(textOf(tree)).toContain('| a | b |')
    expect(textOf(tree)).toContain('| 1 | 2 |')
  })

  it('shows raw HTML as text and never as markup', () => {
    const source = '<b>加粗</b> 与 <script>alert(1)</script> 与 <iframe src=x></iframe>'
    const tree = renderMarkdown(source)
    expect(textOf(tree)).toBe(source)
    expect(tagNames(tree)).toEqual(['p'])
    expect(tagNames(tree)).not.toContain('script')
    expect(tagNames(tree)).not.toContain('iframe')
    expect(tagNames(tree)).not.toContain('b')
    expect(hasProp(tree, 'dangerouslySetInnerHTML')).toBe(false)
  })

  it('renders image syntax as `[图片: alt]` plus a link, and never as an <img>', () => {
    const tree = renderMarkdown('![架构图](https://example.com/a.png)\n')
    expect(tagNames(tree)).not.toContain('img')
    expect(textOf(tree)).toContain('[图片: 架构图]')
    const link = propsOf(tree, 'a')[0]!
    expect(link['href']).toBe('https://example.com/a.png')
    expect(link['rel']).toBe(MARKDOWN_LINK_REL)
    // 协议不合规的图片：文字照出，链接整枚不生（更不加载图片）
    const bad = renderMarkdown('![架构图](javascript:alert(1))\n')
    expect(tagNames(bad)).not.toContain('img')
    expect(propsOf(bad, 'a')).toEqual([])
    expect(textOf(bad)).toContain('[图片: 架构图]')
  })
})

describe('markdown security trio (口径 22 硬红线)', () => {
  const READMES = [
    '# 标题\n\n<script>alert(1)</script>\n',
    '正文 <img src=x onerror="alert(1)"> 收尾\n',
    '[点我](javascript:alert(1))\n',
    '[点我](JaVaScRiPt:alert(1)) 与 [数据](data:text/html;base64,PHNjcmlwdD4=)\n',
  ] as const

  it('never produces a script/img element, an onerror attribute, or a javascript: link', () => {
    for (const readme of READMES) {
      const tree = renderMarkdown(readme)
      const tags = tagNames(tree)
      expect(tags, readme).not.toContain('script')
      expect(tags, readme).not.toContain('img')
      expect(hasProp(tree, 'onerror'), readme).toBe(false)
      expect(hasProp(tree, 'onError'), readme).toBe(false)
      expect(hasProp(tree, 'dangerouslySetInnerHTML'), readme).toBe(false)
      for (const link of propsOf(tree, 'a')) {
        expect(String(link['href']).toLowerCase().startsWith('javascript:'), readme).toBe(false)
        expect(String(link['href']).toLowerCase().startsWith('data:'), readme).toBe(false)
      }
    }
  })

  it('keeps the hostile source visible as text instead of dropping it', () => {
    expect(textOf(renderMarkdown('<script>alert(1)</script>'))).toBe('<script>alert(1)</script>')
    expect(textOf(renderMarkdown('<img src=x onerror="alert(1)">'))).toBe('<img src=x onerror="alert(1)">')
    expect(textOf(renderMarkdown('[点我](javascript:alert(1))'))).toBe('[点我](javascript:alert(1))')
  })
})

describe('markdown bounds: malformed or huge input never throws and stays bounded', () => {
  it('handles the empty / whitespace / malformed inputs without throwing', () => {
    for (const input of ['', '   ', '\n\n\n', '```\n没有收尾的代码块\n', '- 没有闭合的列表\n- 第二条\n', '[没有闭合](', '*****', '~~~\n', '#\n', '> \n']) {
      const tree = renderMarkdown(input)
      expect(textOf(tree), JSON.stringify(input)).toBeTypeOf('string')
    }
    expect(textOf(renderMarkdown(''))).toBe('')
    // 空代码块开头也没问题：收尾围栏缺失时整段当代码块（不抛错、不吞字）
    expect(textOf(renderMarkdown('```\n没有收尾的代码块\n'))).toContain('没有收尾的代码块')
  })

  it('stays bounded on pathological input (element count ≤ input length, deep nesting capped)', () => {
    const cases = [
      '['.repeat(20_000) + ']'.repeat(20_000),
      '*'.repeat(30_000),
      '**'.repeat(20_000),
      '`'.repeat(20_000),
      ('- 项\n').repeat(5_000),
      '#'.repeat(50_000),
      ('a'.repeat(63) + '\n').repeat(1_000),
    ] as const
    for (const input of cases) {
      const tree = renderMarkdown(input)
      expect(elements(tree).length, `elements for ${input.length} chars`).toBeLessThanOrEqual(input.length + 1)
    }
    // 深度上限：50 层成对星号不会无限递归，正文仍在（降级为文字/有限层强调）
    const deep = '**'.repeat(50) + '深处的字' + '**'.repeat(50)
    expect(textOf(renderMarkdown(deep))).toContain('深处的字')
    // 步数预算确实是「按长度给的」（这一条锁住常量不会被悄悄调成 0 或定值）
    expect(MARKDOWN_INLINE_BUDGET_BASE).toBeGreaterThan(0)
    expect(MARKDOWN_INLINE_BUDGET_FACTOR).toBeGreaterThan(1)
  })
})

describe('markdown parser surface (块级 AST，纯函数)', () => {
  it('exposes the block AST so the样式/结构 can be asserted without rendering', () => {
    const blocks = parseMarkdownBlocks('# 标题\n\n- 甲\n- 乙\n\n```js\nx\n```\n\n> 引用\n\n---\n')
    expect(blocks.map(block => block.kind)).toEqual(['heading', 'list', 'code', 'quote', 'rule'])
    const list = blocks[1]
    expect(list?.kind === 'list' && list.ordered).toBe(false)
    expect(list?.kind === 'list' ? list.items.length : -1).toBe(2)
    // 同一个输入两次解析结果结构一致（纯函数、无隐藏状态）
    expect(parseMarkdownBlocks('# 标题\n\n- 甲\n- 乙\n\n```js\nx\n```\n\n> 引用\n\n---\n')).toEqual(blocks)
  })
})
