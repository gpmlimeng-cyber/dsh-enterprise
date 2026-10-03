/**
 * [INPUT]: 只依赖 `react` 的类型与 JSX 自动运行时（本文件 `import type` 之外不 import 任何东西），
 *          **不引入任何第三方 Markdown 库**（全仓没有既有渲染器，且依赖纪律禁止新增 package.json 依赖）。
 * [OUTPUT]: 一个最小、**可证明有界**的 Markdown → React 元素渲染器：
 *   ① `parseMarkdownBlocks(source)`——**按行扫描**的块级解析（纯函数，可直调）：
 *      ATX 标题 `#`~`######` / 段落 / 无序·有序列表（含最多 `MARKDOWN_MAX_BLOCK_DEPTH` 层嵌套）/
 *      围栏代码块 ``` 或 ~~~（语言名可选、原样保留）/ 引用 `>` / 水平线 `---`；
 *   ② 行内解析（`parseInlineBlocks` 内部使用）：行内代码 `` ` `` / 粗体 `**`·`__` / 斜体 `*`·`_` /
 *      删除线 `~~` / 链接 `[文字](地址)` / 图片 `![alt](地址)` / 反斜杠转义 / 行内硬换行（行尾两空格或 `\`）；
 *   ③ `renderMarkdown(source)`——块与行内一律翻成 **React 元素**（字符串子节点交给 React 自己转义）；
 *   ④ `markdownLinkHref(raw)`——链接协议的**唯一闸门**：只放行 `http:`/`https:`/`mailto:`；
 *      其余（`javascript:`/`data:`/`vbscript:`/相对路径/带控制字符的绕写）一律返回 `undefined` ⇒ 降级为纯文本。
 * [POS]: face B（插件市场）插件详情「描述」段的**版式层**（用户口径第 22 条）。README 一律当**数据**：
 *   ① 全文件**没有任何 HTML 注入口**（React 那两枚危险注入 API 一个都没用，由 `src/` 的源码级反向锁守着）——
 *      raw HTML（`<script>`/`<img onerror=…>`/`<iframe>`）原样当纯文本显示，不解析、不注入；
 *  ② 图片语法**绝不**渲染 `<img>`（不自动加载外链图片），只出文字 `[图片: alt]` +（协议合规时）一枚链接；
 *  ③ 不支持也不报错（降级为文字）：表格（按普通段落排版）、HTML 标签、脚注、任务列表等；
 *  ④ **绝不抛错**：非法/畸形/超长输入一律降级为原样文字——本文件既没有异常抛出语句、也没有任何异常捕获语句，
 *     「解析失败」这条路径由**结构上不产生异常**保证，而不是靠兜住异常（故它也不进 `no-silent-swallow` 那张清单）。
 *
 * **为什么不会灾难性回溯**（口径 22 的安全红线之一）：
 *   · 块级是**逐行**判定的，且每一条判定都是「剥掉前导空格后看第一个/前几个字符」的手写扫描或
 *     **单个**量词的正则（没有嵌套量词、没有可选分支互相吞并）；
 *   · 行内是**单遍线性扫描**：每个字符只看一次，`*`/`` ` ``/`[` 的「往后找配对的收尾符」不是对剩余整串
 *     反复做正则，而是先用一趟 `indexPositions()` 把每个字符的出现位置收成有序数组，再用**二分查找**
 *     取「≥ 某位置的下一个出现」（`nextFrom`/`nextRun`）——故查找是 O(log n)，整趟是 O(n)；
 *   · 再加一枚**步数预算**（`MARKDOWN_INLINE_BUDGET_BASE + 长度 × MARKDOWN_INLINE_BUDGET_FACTOR`）：
 *     预算用尽就把余下内容整段当纯文本输出——即使遇到刻意构造的病态输入，工作量与内存也有硬上界；
 *   · 嵌套（粗体套斜体、列表套列表）各有一枚深度上限，超过即降级为文字，递归深度不可能失控。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from 'react'

/** 外链关系：一律不带 opener（新标签打开也不把 `window.opener` 交出去）。 */
export const MARKDOWN_LINK_REL = 'noopener noreferrer'
/** 外链一律新标签打开（不离开当前企业页面）。 */
export const MARKDOWN_LINK_TARGET = '_blank'
/** 行内解析的**步数预算基数**：与长度项相加后再开始扫描（见文件头的「为什么不会灾难性回溯」）。 */
export const MARKDOWN_INLINE_BUDGET_BASE = 1024
/** 行内解析的**步数预算长度系数**：预算 = 基数 + 字符数 × 本系数。 */
export const MARKDOWN_INLINE_BUDGET_FACTOR = 8
/** 行内嵌套最大深度（粗体套斜体…）：超过即把余下内容当纯文本，不再递归。 */
export const MARKDOWN_MAX_INLINE_DEPTH = 8
/** 块级嵌套最大深度（列表套列表…）：超过即把余下内容当普通段落。 */
export const MARKDOWN_MAX_BLOCK_DEPTH = 4
/** 反斜杠可转义的字符集（其它字符前的 `\` 原样保留）。 */
const MARKDOWN_ESCAPABLE = '\\`*_{}[]()#+-.!>~|'
/** 链接协议白名单（小写比较）：只有这三条能变成 `<a>`。 */
const MARKDOWN_ALLOWED_SCHEMES: readonly string[] = ['http', 'https', 'mailto']

/* ────────────────────────────── 链接闸门 ────────────────────────────── */

/**
 * 链接地址的**唯一闸门**（纯函数，测试直调）：返回可以渲染成 `<a href>` 的地址，否则 `undefined`
 * （调用方据此**降级为纯文本**，绝不渲染 `<a>`）。
 *
 * 放行：`http:` / `https:` / `mailto:`（大小写不敏感）；
 * 拒绝：其它一切（`javascript:` / `data:` / `vbscript:` / 相对路径 / 空串 / 带控制字符或空白的绕写）。
 * 拒绝控制字符是刻意的：`java\nscript:` 这类「协议名里夹换行」的绕写在这里就断掉。
 */
export function markdownLinkHref(raw: string): string | undefined {
  // ① 去掉首尾空白与 Markdown 惯用的尖括号包裹；② 丢掉 `(地址 "标题")` 里的标题部分。
  const stripped = raw.trim().replace(/^</, '').replace(/>$/, '').trim()
  if (stripped === '') return undefined
  const target = stripped.split(/[ \t]+/)[0]
  if (target === undefined || target === '') return undefined
  // 控制字符（含 \n \t \r）与空格一律拒——地址里出现它们只可能是绕写或畸形。
  for (const ch of target) {
    const code = ch.codePointAt(0)
    if (code !== undefined && (code < 0x20 || code === 0x7f)) return undefined
  }
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(target)?.[1]?.toLowerCase()
  if (scheme === undefined) return undefined
  return MARKDOWN_ALLOWED_SCHEMES.includes(scheme) ? target : undefined
}

/* ────────────────────────────── 类型 ────────────────────────────── */

/** 行内节点（渲染器只认这些形状，**没有** raw HTML 这一支）。 */
export type MarkdownInline =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'strong'; readonly children: readonly MarkdownInline[] }
  | { readonly kind: 'em'; readonly children: readonly MarkdownInline[] }
  | { readonly kind: 'del'; readonly children: readonly MarkdownInline[] }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly MarkdownInline[] }
  /** 图片语法：**不加载图片**，只出文字 `[图片: alt]`（协议合规时另挂一枚链接）。 */
  | { readonly kind: 'image'; readonly alt: string; readonly href: string | undefined }
  | { readonly kind: 'break' }

/** 列表的一条（`blocks` 里第一段若是段落，渲染成「行内文字 + 嵌套块」的紧列表形态）。 */
export interface MarkdownListItem {
  readonly blocks: readonly MarkdownBlock[]
}

/** 块级节点。 */
export type MarkdownBlock =
  | { readonly kind: 'heading'; readonly level: number; readonly children: readonly MarkdownInline[] }
  | { readonly kind: 'paragraph'; readonly children: readonly MarkdownInline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly start: number; readonly items: readonly MarkdownListItem[] }
  | { readonly kind: 'code'; readonly language: string | undefined; readonly code: string }
  | { readonly kind: 'quote'; readonly children: readonly MarkdownInline[] }
  | { readonly kind: 'rule' }

/* ────────────────────────────── 行内扫描 ────────────────────────────── */

interface InlineState {
  readonly text: string
  /** 每个字符 → 它在本文里出现的**有序**位置数组（一趟收集，之后全是二分查找）。 */
  readonly positions: ReadonlyMap<string, readonly number[]>
  /** 剩余步数：用尽即把余下内容当纯文本（硬上界，见文件头）。 */
  budget: number
}

/** 一趟收集每个字符的出现位置（O(n)，n = 这一段文字的字符数）。 */
function indexPositions(text: string): ReadonlyMap<string, readonly number[]> {
  const positions = new Map<string, number[]>()
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i)
    const list = positions.get(ch)
    if (list === undefined) positions.set(ch, [i])
    else list.push(i)
  }
  return positions
}

/** 二分查找：`positions` 里**第一个 ≥ from** 的位置（没有则 `undefined`）。 */
function nextFrom(state: InlineState, ch: string, from: number): number | undefined {
  const list = state.positions.get(ch)
  if (list === undefined) return undefined
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((list[mid] ?? -1) < from) lo = mid + 1
    else hi = mid
  }
  const found = list[lo]
  return found
}

/**
 * 二分 + 线性推进：`[from, end)` 里**第一个**「连续 `run` 个 `ch`」的位置（没有则 `undefined`）。
 * 只认收尾在 `end` 之前的那一种（跨出行内区间的不算配对，避免把后面的内容吸进来）。
 */
function nextRun(state: InlineState, ch: string, from: number, end: number, run: number): number | undefined {
  const list = state.positions.get(ch)
  if (list === undefined) return undefined
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((list[mid] ?? -1) < from) lo = mid + 1
    else hi = mid
  }
  for (let index = lo; index < list.length; index += 1) {
    if (state.budget <= 0) return undefined
    state.budget -= 1
    const at = list[index]
    if (at === undefined || at + run > end) return undefined
    let matched = true
    for (let offset = 1; offset < run; offset += 1) {
      if (state.text.charAt(at + offset) !== ch) { matched = false; break }
    }
    if (matched) return at
  }
  return undefined
}

/** 一行/一段文字的**入口**：拿文本建状态后整趟扫描一次。 */
function parseInline(text: string): readonly MarkdownInline[] {
  const state: InlineState = {
    text,
    positions: indexPositions(text),
    budget: MARKDOWN_INLINE_BUDGET_BASE + text.length * MARKDOWN_INLINE_BUDGET_FACTOR,
  }
  return parseInlineRange(state, 0, text.length, 0)
}

/** 多行拼成一段时用：逐行解析，行尾是硬换行（两空格或 `\`）就插一枚 `<br>`，否则插一个空格。 */
function parseInlineLines(lines: readonly string[]): readonly MarkdownInline[] {
  const out: MarkdownInline[] = []
  lines.forEach((line, index) => {
    const withoutTrailing = line.replace(/[ \t]+$/, '')
    const hard = line.length - withoutTrailing.length >= 2 || withoutTrailing.endsWith('\\')
    const body = hard ? withoutTrailing.slice(0, -1) : withoutTrailing
    out.push(...parseInline(body))
    if (index < lines.length - 1) out.push(hard ? { kind: 'break' } : { kind: 'text', value: ' ' })
  })
  return out
}

/** `[start, end)` 区间的行内扫描（递归只发生在 `parseInlineRange` 自己身上，且受深度/预算双重约束）。 */
function parseInlineRange(state: InlineState, start: number, end: number, depth: number): readonly MarkdownInline[] {
  const out: MarkdownInline[] = []
  const { text } = state
  let buffer = ''
  let i = start
  const flush = (): void => {
    if (buffer !== '') { out.push({ kind: 'text', value: buffer }); buffer = '' }
  }
  while (i < end) {
    if (state.budget <= 0) { buffer += text.slice(i, end); break }
    state.budget -= 1
    const ch = text.charAt(i)
    // ① 反斜杠转义
    if (ch === '\\' && i + 1 < end && MARKDOWN_ESCAPABLE.includes(text.charAt(i + 1))) {
      buffer += text.charAt(i + 1)
      i += 2
      continue
    }
    // ② 行内代码：到下一条反引号为止，里面**不解析**任何记号
    if (ch === '`') {
      const close = nextFrom(state, '`', i + 1)
      if (close !== undefined && close < end) {
        flush()
        out.push({ kind: 'code', value: text.slice(i + 1, close) })
        i = close + 1
        continue
      }
      buffer += ch
      i += 1
      continue
    }
    // ③ 图片 `![alt](url)`：识别成文字 + 可选链接，**绝不**变成 <img>
    if (ch === '!' && text.charAt(i + 1) === '[') {
      const image = imageAt(state, i, end)
      if (image !== undefined) {
        flush()
        out.push(image.node)
        i = image.next
        continue
      }
      buffer += ch
      i += 1
      continue
    }
    // ④ 链接 `[文字](地址)`
    if (ch === '[') {
      const link = linkAt(state, i, end, depth)
      if (link !== undefined) {
        flush()
        out.push(link.node)
        i = link.next
        continue
      }
      buffer += ch
      i += 1
      continue
    }
    // ⑤ 强调/删除线（`~` 只认成对的 `~~`）
    if ((ch === '*' || ch === '_' || ch === '~') && depth < MARKDOWN_MAX_INLINE_DEPTH) {
      const doubled = text.startsWith(ch + ch, i)
      if (doubled) {
        const close = nextRun(state, ch, i + 2, end, 2)
        if (close !== undefined && close > i + 2) {
          flush()
          const children = parseInlineRange(state, i + 2, close, depth + 1)
          out.push(ch === '~' ? { kind: 'del', children } : { kind: 'strong', children })
          i = close + 2
          continue
        }
      }
      if (ch !== '~') {
        const close = nextRun(state, ch, i + 1, end, 1)
        if (close !== undefined && close > i + 1) {
          flush()
          out.push({ kind: 'em', children: parseInlineRange(state, i + 1, close, depth + 1) })
          i = close + 1
          continue
        }
      }
      buffer += ch
      i += 1
      continue
    }
    buffer += ch
    i += 1
  }
  flush()
  return out
}

/** `![alt](url)`：找到就返回节点与下一个扫描位置。 */
function imageAt(state: InlineState, at: number, end: number): { node: MarkdownInline; next: number } | undefined {
  const { text } = state
  const closeLabel = nextFrom(state, ']', at + 2)
  if (closeLabel === undefined || closeLabel >= end || text.charAt(closeLabel + 1) !== '(') return undefined
  const closeHref = nextFrom(state, ')', closeLabel + 2)
  if (closeHref === undefined || closeHref >= end) return undefined
  const alt = text.slice(at + 2, closeLabel)
  const href = markdownLinkHref(text.slice(closeLabel + 2, closeHref))
  return { node: { kind: 'image', alt, href }, next: closeHref + 1 }
}

/** `[文字](地址)`：协议白名单之外的地址**仍算链接语法**，但整条降级为纯文本（连方括号一起原样显示）。 */
function linkAt(state: InlineState, at: number, end: number, depth: number): { node: MarkdownInline; next: number } | undefined {
  const { text } = state
  if (depth >= MARKDOWN_MAX_INLINE_DEPTH) return undefined
  const closeLabel = nextFrom(state, ']', at + 1)
  if (closeLabel === undefined || closeLabel >= end || text.charAt(closeLabel + 1) !== '(') return undefined
  const closeHref = nextFrom(state, ')', closeLabel + 2)
  if (closeHref === undefined || closeHref >= end) return undefined
  const href = markdownLinkHref(text.slice(closeLabel + 2, closeHref))
  if (href === undefined) return undefined
  const children = parseInlineRange(state, at + 1, closeLabel, depth + 1)
  return { node: { kind: 'link', href, children }, next: closeHref + 1 }
}

/* ────────────────────────────── 块级扫描 ────────────────────────────── */

/** 剥掉最多 3 个前导空格（CommonMark 的块级缩进边界），返回缩进数与剩余文本。 */
function stripUpToThree(line: string): { readonly indent: number; readonly rest: string } {
  let indent = 0
  while (indent < 3 && line.charAt(indent) === ' ') indent += 1
  return { indent, rest: line.slice(indent) }
}

/** 围栏代码块的开头：``` 或 ~~~（≥3 个，后随可选语言名）。 */
function fenceOf(line: string): { readonly marker: string; readonly language: string | undefined } | undefined {
  const { rest } = stripUpToThree(line)
  const ch = rest.charAt(0)
  if (ch !== '`' && ch !== '~') return undefined
  let size = 0
  while (rest.charAt(size) === ch) size += 1
  if (size < 3) return undefined
  const info = rest.slice(size).trim()
  const language = info === '' ? undefined : info.split(/[ \t]+/)[0]
  return { marker: ch.repeat(size), language }
}

/** 水平线：`---` / `***` / `___`（≥3 个同一字符，可夹空格）。 */
function isRule(line: string): boolean {
  const { rest } = stripUpToThree(line)
  const compact = rest.replace(/[ \t]/g, '')
  if (compact.length < 3) return false
  const ch = compact.charAt(0)
  if (ch !== '-' && ch !== '*' && ch !== '_') return false
  for (const one of compact) if (one !== ch) return false
  return true
}

/** ATX 标题：`#`~`######`，井号后必须是行尾或空白。 */
function headingOf(line: string): { readonly level: number; readonly body: string } | undefined {
  const { rest } = stripUpToThree(line)
  let level = 0
  while (level < 6 && rest.charAt(level) === '#') level += 1
  if (level === 0) return undefined
  const after = rest.charAt(level)
  if (after !== '' && after !== ' ' && after !== '\t') return undefined
  const body = rest.slice(level).trim()
  return { level, body }
}

/** 引用行：`>` + 一个可选空格。 */
function quoteOf(line: string): string | undefined {
  const { rest } = stripUpToThree(line)
  if (rest.charAt(0) !== '>') return undefined
  const body = rest.slice(1)
  return body.startsWith(' ') ? body.slice(1) : body
}

/** 列表项：`-`/`*`/`+` 或 `1.`/`1)`，记号后至少一个空白。 */
function listItemOf(line: string): { readonly indent: number; readonly ordered: boolean; readonly marker: string; readonly body: string } | undefined {
  let indent = 0
  while (indent < 64 && line.charAt(indent) === ' ') indent += 1
  const rest = line.slice(indent)
  const first = rest.charAt(0)
  let marker = ''
  if (first === '-' || first === '*' || first === '+') marker = first
  else {
    let digits = 0
    while (digits < 9 && rest.charAt(digits) >= '0' && rest.charAt(digits) <= '9') digits += 1
    if (digits === 0) return undefined
    const dot = rest.charAt(digits)
    if (dot !== '.' && dot !== ')') return undefined
    marker = rest.slice(0, digits + 1)
  }
  const afterMarker = rest.charAt(marker.length)
  if (afterMarker !== ' ' && afterMarker !== '\t') return undefined
  return { indent, ordered: /[.)]/.test(marker), marker, body: rest.slice(marker.length + 1) }
}

/** 段落续行：非空、且不开启任何新块（标题/围栏/水平线/引用/列表项）。 */
function isParagraphContinuation(line: string): boolean {
  if (line.trim() === '') return false
  if (fenceOf(line) !== undefined) return false
  if (isRule(line)) return false
  if (headingOf(line) !== undefined) return false
  if (quoteOf(line) !== undefined) return false
  if (listItemOf(line) !== undefined) return false
  return true
}

/**
 * 源码 → 块级节点（纯函数，测试直调）：**逐行**扫描，一次成型，不做全文级正则。
 * 非法/不认识的写法一律当普通段落文字（不抛错、不丢字）。
 */
export function parseMarkdownBlocks(source: string): readonly MarkdownBlock[] {
  const withoutBom = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source
  return parseBlockLines(withoutBom.split(/\r\n|\r|\n/), 0)
}

function parseBlockLines(lines: readonly string[], depth: number): readonly MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() === '') { i += 1; continue }

    const fence = fenceOf(line)
    if (fence !== undefined) {
      const code: string[] = []
      i += 1
      while (i < lines.length) {
        const inner = lines[i] ?? ''
        const closing = fenceOf(inner)
        if (closing !== undefined && closing.marker.charAt(0) === fence.marker.charAt(0) && closing.marker.length >= fence.marker.length && closing.language === undefined) break
        code.push(inner)
        i += 1
      }
      if (i < lines.length) i += 1 // 吃掉收尾围栏（没有收尾就吃到文件末尾，照常成一个代码块）
      blocks.push({ kind: 'code', language: fence.language, code: code.join('\n') })
      continue
    }

    if (isRule(line)) { blocks.push({ kind: 'rule' }); i += 1; continue }

    const heading = headingOf(line)
    if (heading !== undefined) {
      blocks.push({ kind: 'heading', level: heading.level, children: parseInline(heading.body) })
      i += 1
      continue
    }

    const quote = quoteOf(line)
    if (quote !== undefined) {
      const parts: string[] = [quote]
      i += 1
      while (i < lines.length) {
        const next = quoteOf(lines[i] ?? '')
        if (next === undefined) break
        parts.push(next)
        i += 1
      }
      blocks.push({ kind: 'quote', children: parseInline(parts.join(' ').trim()) })
      continue
    }

    const item = listItemOf(line)
    if (item !== undefined && depth < MARKDOWN_MAX_BLOCK_DEPTH) {
      const collected = collectList(lines, i, item, depth)
      if (collected.block.kind === 'list' && collected.block.items.length > 0) {
        blocks.push(collected.block)
        i = collected.next
        continue
      }
    }

    // 普通段落：一路吃到空行或下一个块的起始行。
    const paragraph: string[] = []
    while (i < lines.length && isParagraphContinuation(lines[i] ?? '')) { paragraph.push(lines[i] ?? ''); i += 1 }
    blocks.push({ kind: 'paragraph', children: parseInlineLines(paragraph) })
  }
  return blocks
}

/** 从 `start` 起收集一整个列表（同类记号 + 比基准缩进更深的续行/子列表）。 */
function collectList(
  lines: readonly string[],
  start: number,
  first: { readonly indent: number; readonly ordered: boolean; readonly marker: string; readonly body: string },
  depth: number,
): { readonly block: MarkdownBlock; readonly next: number } {
  const items: MarkdownListItem[] = []
  const baseIndent = first.indent
  const ordered = first.ordered
  let cursor = start
  let number = Number.parseInt(first.marker, 10)
  const startNumber = Number.isNaN(number) ? 1 : number

  while (cursor < lines.length) {
    const line = lines[cursor] ?? ''
    if (line.trim() === '') {
      // 空行只有「后面还有本列表的下一项」时才允许跨过（松散列表），否则列表到此结束。
      const after = lines[cursor + 1]
      const nextItem = after === undefined ? undefined : listItemOf(after)
      if (nextItem === undefined || nextItem.indent !== baseIndent || nextItem.ordered !== ordered) break
      cursor += 1
      continue
    }
    const item = listItemOf(line)
    if (item === undefined || item.indent !== baseIndent || item.ordered !== ordered) break

    // 这一项自己的行：首行去掉记号，后续行比基准缩进更深（或空行）都算这一项的内容。
    const contentLines: string[] = [item.body]
    const continuationGuide = item.indent + item.marker.length + 1
    cursor += 1
    while (cursor < lines.length) {
      const next = lines[cursor] ?? ''
      if (next.trim() === '') {
        const peek = lines[cursor + 1]
        if (peek === undefined || peek.trim() === '') break
        const peekIndent = peek.length - peek.trimStart().length
        if (peekIndent <= baseIndent) break
        contentLines.push('')
        cursor += 1
        continue
      }
      const indent = next.length - next.trimStart().length
      if (indent <= baseIndent) break
      const cut = Math.min(indent, continuationGuide)
      contentLines.push(next.slice(cut))
      cursor += 1
    }
    items.push({ blocks: parseBlockLines(contentLines, depth + 1) })
  }

  return { block: { kind: 'list', ordered, start: startNumber, items }, next: cursor }
}

/* ────────────────────────────── 渲染 ────────────────────────────── */

/** 外层滚动区（`.own-market-notice`）的行高口径：段落与列表项的间距都按它取整。 */
const PARAGRAPH_STYLE = { margin: '0 0 8px' } as const
const LIST_STYLE = { margin: '0 0 8px', paddingLeft: 22 } as const
const NESTED_LIST_STYLE = { margin: '4px 0 0', paddingLeft: 20 } as const
const QUOTE_STYLE = {
  margin: '0 0 8px',
  paddingLeft: 10,
  borderLeft: '3px solid var(--dsw-alias-border-l2,#eaecf0)',
  color: 'var(--dsw-alias-label-secondary,#667085)',
} as const
const RULE_STYLE = { margin: '12px 0', border: 0, borderTop: '1px solid var(--dsw-alias-border-l2,#eaecf0)' } as const
const PRE_STYLE = {
  margin: '0 0 8px',
  padding: '8px 10px',
  overflowX: 'auto',
  whiteSpace: 'pre',
  background: 'var(--dsw-alias-background-secondary,#f2f4f7)',
  borderRadius: 'var(--dsw-radius-sm,6px)',
} as const
const CODE_STYLE = {
  fontFamily: 'var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)',
  fontSize: 12,
} as const
const INLINE_CODE_STYLE = {
  ...CODE_STYLE,
  padding: '1px 4px',
  background: 'var(--dsw-alias-background-secondary,#f2f4f7)',
  borderRadius: 'var(--dsw-radius-sm,6px)',
} as const
const LINK_STYLE = { color: 'var(--dsw-alias-brand-primary,#1570ef)', textDecoration: 'underline' } as const
/** 标题字号（h1…h6，逐级缩小；行高与字号同源，单位 px）。 */
const HEADING_STYLES = [
  { fontSize: 18, lineHeight: '26px' },
  { fontSize: 16, lineHeight: '24px' },
  { fontSize: 15, lineHeight: '22px' },
  { fontSize: 14, lineHeight: '22px' },
  { fontSize: 13, lineHeight: '20px' },
  { fontSize: 13, lineHeight: '20px' },
] as const

/** 行内节点 → React 元素（字符串子节点交给 React 转义；图片**不是** `<img>`）。 */
function renderInline(nodes: readonly MarkdownInline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case 'text': return node.value
      case 'code': return <code key={index} style={INLINE_CODE_STYLE}>{node.value}</code>
      case 'strong': return <strong key={index}>{renderInline(node.children)}</strong>
      case 'em': return <em key={index}>{renderInline(node.children)}</em>
      case 'del': return <del key={index}>{renderInline(node.children)}</del>
      case 'link': return (
        <a key={index} href={node.href} style={LINK_STYLE} target={MARKDOWN_LINK_TARGET} rel={MARKDOWN_LINK_REL}>
          {renderInline(node.children)}
        </a>
      )
      case 'image': return (
        <span key={index}>
          {`[图片: ${node.alt}]`}
          {node.href === undefined ? null : <> <a href={node.href} style={LINK_STYLE} target={MARKDOWN_LINK_TARGET} rel={MARKDOWN_LINK_REL}>{node.href}</a></>}
        </span>
      )
      case 'break': return <br key={index} />
      default: return null
    }
  })
}

/** 一个块 → React 元素（`first` 为真时省掉顶部外边距，避免第一块与上方留白叠一起）。 */
function renderBlock(block: MarkdownBlock, key: number, first: boolean): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const style = HEADING_STYLES[block.level - 1] ?? HEADING_STYLES[HEADING_STYLES.length - 1]
      const level = Math.min(Math.max(block.level, 1), 6)
      const headingStyle = {
        margin: first ? '0 0 8px' : '12px 0 8px',
        fontSize: style?.fontSize,
        lineHeight: style?.lineHeight,
        fontWeight: 600,
      }
      const children = renderInline(block.children)
      if (level === 1) return <h1 key={key} style={headingStyle}>{children}</h1>
      if (level === 2) return <h2 key={key} style={headingStyle}>{children}</h2>
      if (level === 3) return <h3 key={key} style={headingStyle}>{children}</h3>
      if (level === 4) return <h4 key={key} style={headingStyle}>{children}</h4>
      if (level === 5) return <h5 key={key} style={headingStyle}>{children}</h5>
      return <h6 key={key} style={headingStyle}>{children}</h6>
    }
    case 'paragraph': return <p key={key} style={PARAGRAPH_STYLE}>{renderInline(block.children)}</p>
    case 'code': return (
      <pre key={key} style={PRE_STYLE}>
        {/* 语言名（可选）**原样保留**在这一枚属性上，不上屏、不改写代码正文一个字符。 */}
        <code style={CODE_STYLE} data-markdown-language={block.language}>{block.code}</code>
      </pre>
    )
    case 'quote': return <blockquote key={key} style={QUOTE_STYLE}>{renderInline(block.children)}</blockquote>
    case 'rule': return <hr key={key} style={RULE_STYLE} />
    case 'list': {
      const listStyle = first ? LIST_STYLE : NESTED_LIST_STYLE
      const items = block.items.map((item, index) => <li key={index}>{renderListItem(item)}</li>)
      return block.ordered
        ? <ol key={key} start={block.start} style={listStyle}>{items}</ol>
        : <ul key={key} style={listStyle}>{items}</ul>
    }
    default: return null
  }
}

/** 列表项的紧列表形态：首段直接铺在 `<li>` 的文字里（不套 `<p>`），其余块（嵌套列表/代码块…）跟在后面。 */
function renderListItem(item: MarkdownListItem): ReactNode {
  const first = item.blocks[0]
  if (first !== undefined && first.kind === 'paragraph') {
    return [
      ...renderInline(first.children),
      ...item.blocks.slice(1).map((block, index) => renderBlock(block, index, false)),
    ]
  }
  return item.blocks.map((block, index) => renderBlock(block, index, index === 0))
}

/** 块列表 → React 元素。 */
export function renderMarkdownBlocks(blocks: readonly MarkdownBlock[]): ReactNode {
  return blocks.map((block, index) => renderBlock(block, index, index === 0))
}

/**
 * **唯一入口**：README 纯文本 → React 元素。
 *
 * 契约：① 绝不抛错（空串/纯空白/畸形/超长都返回一个可渲染的 ReactNode）；② 输出全部由 React 元素与
 * 字符串子节点构成（React 自己转义，不使用任何 HTML 注入口）；③ 输入一律当**数据**，不解析其中的 HTML。
 */
export function renderMarkdown(source: string): ReactNode {
  return renderMarkdownBlocks(parseMarkdownBlocks(source))
}
