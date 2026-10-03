/**
 * [INPUT]: 只依赖本目录的记录类型（`./manager.js` 的节点/资产记录由调用方传入的普通字段）与 `./errors.js` 的稳定码；不 import 任何 `@deepseek-ai/*`、不碰盘、不发请求
 * [OUTPUT]: 对外提供检索语义的**纯函数唯一真源**——`librarySearchTerm`（查询归一化：trim + `toLocaleLowerCase`）、`librarySearchMatch`（三档打分 2/1/0 与命中偏移）、`librarySearchExcerpt`（`offset-80` 起 240 字符 + 空白折叠）、`librarySearchLocation`（命中前缀里最后一个 `^#{1,6}\s+` 的标题）、`compareLibrarySearchHits`（score desc → updatedAt desc → name `zh-CN`）、`LibrarySearchHit` 类型与四个上限/窗口常量
 * [POS]: 资料库检索的**语义层**（方案 §4.1 F5 的逐条口径）。刻意与存储解耦：三档分数、排序键、摘录窗口、位置标题这些"口径"只能在纯函数里被机械断言；`manager.ts` 的 `search()` 只负责把本主体的记录喂进来并读正文，路由与工具只做投影
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 一次检索最多返回多少条（§4.1 F5 的"硬截断 50"）。 */
export const LIBRARY_SEARCH_LIMIT = 50
/** 摘录窗口长度（字符）：`A26:165` 的 240。 */
export const LIBRARY_SEARCH_EXCERPT_LENGTH = 240
/** 摘录起点相对命中位置的提前量（字符）：`A26:165` 的 80（命中处不会顶在摘录第一格）。 */
export const LIBRARY_SEARCH_EXCERPT_LEAD = 80
/** 标题命中分（§4.1 F5 的三档之一）。 */
export const LIBRARY_SEARCH_TITLE_SCORE = 2
/** 正文命中分（三档之二）。 */
export const LIBRARY_SEARCH_BODY_SCORE = 1
/** 空查询分：空查询不筛掉任何当前修订，全部以 0 分进入（三档之三）。 */
export const LIBRARY_SEARCH_EMPTY_SCORE = 0
/** 命中位置之前的标题行（`^#{1,6}\s+`）——Markdown 的六级标题，与转换器产出同一套。 */
const LIBRARY_SEARCH_HEADING = /^#{1,6}[ \t]+(.+)$/gm

/**
 * 一条检索命中（路由与工具的**唯一**命中形状；工具层再按 §4.1 F6 把它投影成下划线字段）。
 *
 * `score` 只服务排序（工具输出里不出现：模型不需要知道"标题命中还是正文命中"这件事的内部记账）。
 */
export interface LibrarySearchHit {
  readonly assetId: string
  readonly revisionId: string
  readonly name: string
  readonly kind: string
  readonly source: string
  readonly updatedAt: string
  /** 该资料在树上所在文件夹的可读路径（`我的资料 / 项目甲`；直接在根下就是 `我的资料`）。 */
  readonly folderPath: string
  /** 排序分（2 标题 / 1 正文 / 0 空查询）。 */
  readonly score: number
  /** 命中位置之前的最后一个 Markdown 标题（没有则不出这个键）。 */
  readonly location?: string | undefined
  /** 摘录（`offset-80` 起 240 字符、空白折叠成单空格）。 */
  readonly excerpt: string
}

/** 查询归一化：与 workdsh 逐字一致（`query.trim().toLocaleLowerCase()`）。 */
export function librarySearchTerm(query: string): string {
  return query.trim().toLocaleLowerCase()
}

/**
 * 一条记录对一次查询的命中判定（§4.1 F5 的三档分数）。
 *
 * 顺序即优先级：标题命中优先于正文命中（同一份资料只出一次，分数取高者）。
 * 空查询恒命中（分数 0、偏移 0）——它表达的是"把当前修订列出来"。
 *
 * @param term - 已归一化的查询词（调用方用 `librarySearchTerm` 归一）。
 * @param name - 资料名（标题）。
 * @param text - 该修订的派生正文全文。
 * @returns 命中时的分数与正文里的偏移；不命中返回 `undefined`。
 */
export function librarySearchMatch(
  term: string,
  name: string,
  text: string,
): { readonly score: number; readonly offset: number } | undefined {
  if (term.length === 0) return { score: LIBRARY_SEARCH_EMPTY_SCORE, offset: 0 }
  const body = text.toLocaleLowerCase()
  const offset = body.indexOf(term)
  if (name.toLocaleLowerCase().includes(term)) {
    // 标题命中：正文里若也出现，摘录就从正文那处开始（读起来才知道为什么命中）；没出现就从开头摘。
    return { score: LIBRARY_SEARCH_TITLE_SCORE, offset: offset < 0 ? 0 : offset }
  }
  if (offset > -1) return { score: LIBRARY_SEARCH_BODY_SCORE, offset }
  return undefined
}

/** 摘录：从 `offset - 80` 起取 240 字符，并把连续空白折叠成一个空格（`A26:165`）。 */
export function librarySearchExcerpt(text: string, offset: number): string {
  const start = Math.max(0, offset - LIBRARY_SEARCH_EXCERPT_LEAD)
  return text.slice(start, start + LIBRARY_SEARCH_EXCERPT_LENGTH).replace(/\s+/gu, ' ')
}

/**
 * 命中位置所属的标题（`A26:171`）：取**命中前缀里最后一个** `^#{1,6}\s+` 的标题文本。
 * 前缀里没有标题 ⇒ 不出这个键（不假装"位置未知"，也不编一个）。
 */
export function librarySearchLocation(text: string, offset: number): string | undefined {
  const prefix = text.slice(0, Math.max(0, offset))
  let found: string | undefined
  for (const match of prefix.matchAll(LIBRARY_SEARCH_HEADING)) {
    const title = (match[1] ?? '').trim()
    if (title.length > 0) found = title
  }
  return found
}

/**
 * 命中排序（§4.1 F5）：分数高的在前 → `updatedAt` 新的在前 → 名字按 `zh-CN` 规则。
 * 三个键全同的两条按 `assetId` 收尾，保证同一份数据的排序**确定**（后端序不许泄漏）。
 */
export function compareLibrarySearchHits(a: LibrarySearchHit, b: LibrarySearchHit): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1
  const byName = a.name.localeCompare(b.name, 'zh-CN')
  if (byName !== 0) return byName
  return a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0
}
