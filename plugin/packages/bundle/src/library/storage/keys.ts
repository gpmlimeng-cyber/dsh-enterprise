/**
 * [INPUT]: 依赖 node:crypto 的 sha256（超长折叠）与本包 `../errors.js` 的稳定码
 * [OUTPUT]: 对外提供资料库主键的**纯函数层**：`sanitizeLibraryKeyPart`（非法字符归一为 `-`）、`normalizeLibraryKey`（多段组合 + 强制 ≤200）、`libraryRecordKey`（scope/ownerId/id 三元组）、`foldLibraryKey`（确定性折叠）、`isLibraryKeySafe`（字符集 + 长度门禁），以及四个常量（官方安全字符集、官方域/表名规约、key 上限、分隔符）
 * [POS]: bundle 资料库纵深的**第一道门禁**——官方 `dsh-storage-json` 把 per-record 主键直接当路径段（`lib/index.js:302` 的 `SAFE_KEY_RE = /^[a-zA-Z0-9_-]+$/`，写入前在 `:534-536` 的 `assertSafeKey` 强制），所以键必须在**进存储之前**就是路径安全的；本文件是唯一一处做归一化的地方，服务层/路由层/工具层不许再写第二套
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { LibraryError, badRequest } from '../errors.js'

/**
 * 官方 per-record 后端的安全主键字符集（`dsh-storage-json/lib/index.js:302` 逐字照抄）。
 * 不在这个集合里的字符（`:` `/` `.` 空白、CJK、控制字符……）会被官方 `assertSafeKey` 拒，且拒法是**抛错**。
 */
export const LIBRARY_SAFE_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/

/**
 * 官方域名/表名规约（`dsh-storage/lib/index.js:80` 的 `UNIT_NAME_RE`；`dsh-storage-domain/lib/index.js:62,73`
 * 在 `defineDomain` 里对域名与每个表名强制）。本仓的域 `dshent_library` 与四张表名都命中它。
 */
export const LIBRARY_UNIT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

/** 组合形状的分隔符（勘误 B1：`<scope>:<ownerId>:<id>` 写入即抛，冒号非法 ⇒ 改用 `_`）。 */
export const LIBRARY_KEY_SEPARATOR = '_'

/** 我们自定的主键长度上限（勘误 B1：实测 240 能写、300 抛 `ENAMETOOLONG`，文件名实际占 `key + ".json"`）。 */
export const LIBRARY_KEY_MAX_LENGTH = 200

/** 折叠件三段长度：96 + 1 + 16 + 1 + 86 = 200，恒等于上限。 */
const LIBRARY_KEY_FOLD_HEAD = 96
const LIBRARY_KEY_FOLD_DIGEST = 16
const LIBRARY_KEY_FOLD_TAIL = 86

/** 一个记录的三元组身份；`id` 在四张表里分别是 nodeId / assetId / revisionId / sessionId。 */
export interface LibraryKeyTriple {
  readonly scope: string
  readonly ownerId: string
  readonly id: string
}

/**
 * 主键归一化：任意输入 → 一条**路径安全**的键。三条设计决定写在这里，理由逐条：
 *
 * **① 形状**：`<scope>_<ownerId>_<id>`（下划线连接）。勘误 B1 明确原来的 `<scope>:<ownerId>:<id>`
 * 写法不可用（官方字符集不含冒号，写入即抛）。
 *
 * **② 非法字符归一为 `-`，一字一替换、不做折叠**。逐 Unicode 码点扫描，命中官方字符集的字符原样保留，
 * 否则替换为一枚 `-`（代理对算一个字符，替换成一枚 `-`）。
 * 不折叠（不把连续非法字符合并成一枚 `-`）的理由：折叠会把「一个 `:`」与「两个 `:`」压成同一个键，
 * 保留"非法字符个数"这一位信息能显著缩小碰撞面。代价是键可能更长，由 ③ 处理。
 *
 * **③ `_` 既是合法字符又是分隔符** ⇒ 单段里出现 `_` 时，键的段边界在纯字符串上**不可反解**
 * （`['a_b','c']` 与 `['a','b_c']` 同一个键）。这一条不用字符串魔法（转义）解决，而是交给服务层用
 * **记录自身的 `scope/ownerId/id` 字段**做归属校验：写时冲突 ⇒ `library/key-collision`（fail-closed，绝不覆盖），
 * 读时归属不符 ⇒ `library/not-found`（对齐 §4.4 A8「主体隔离」）。**键只是定位符，记录里的三元组才是真源。**
 *
 * **④ 超长（>200）的行为：确定性折叠，既不裸截断也不报错。**
 * · 裸截断：`aaaa…(240)A` 与 `aaaa…(240)B` 截断后同键 ⇒ 两个不同主体静默串在同一条记录上（比碰撞更糟的是**静默**）；
 * · 报错：`sessionId`/主体 id 由宿主给出、长度不受我们控制，报错等于把"键太长"变成员工可见的失败；
 * · 折叠：`<前 96 字符>-<sha256(整键) 前 16 位十六进制>-<后 86 字符>`，恒为 200 字符、字符集仍然安全、
 *   且把区分度提升到 64 bit（前缀相同、后缀也相同的两个键仍会被摘要区分开）。
 *   折叠仍不是单射，所以 ③ 的归属校验是最后一道闸。
 * · 为什么上限取 200（而不是官方的可写上限 240）：给文件名后缀 `.json`、后端可能的 `.bak.<stamp>` 与
 *   将来加一级子目录留出余量；勘误 B1 的建议值也是 200。
 */
export function normalizeLibraryKey(parts: readonly string[]): string {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new LibraryError('library/invalid-key', 'library key needs at least one part')
  }
  const sanitized: string[] = []
  for (const part of parts) {
    if (typeof part !== 'string') throw badRequest('library key parts must be strings')
    // 空段一律拒（而不是归一成一枚 `-`）：四张表的三元组每一段都是**必有身份**，
    // 空段只可能来自调用方漏传主体/会话，静默补 `-` 会把「身份缺失」伪装成一条合法键。
    if (part.length === 0) throw new LibraryError('library/invalid-key', 'library key parts must not be empty')
    sanitized.push(sanitizeLibraryKeyPart(part))
  }
  const key = sanitized.join(LIBRARY_KEY_SEPARATOR)
  return key.length > LIBRARY_KEY_MAX_LENGTH ? foldLibraryKey(key) : key
}

/** 单段归一化：官方字符集之外一律替换为 `-`（可能返回空串——空串由 `normalizeLibraryKey` 拒）。 */
export function sanitizeLibraryKeyPart(raw: string): string {
  let out = ''
  for (const character of raw) {
    out += LIBRARY_SAFE_KEY_PATTERN.test(character) ? character : '-'
  }
  return out
}

/** 三元组 → 记录键（四张表共用同一条形状）。 */
export function libraryRecordKey(triple: LibraryKeyTriple): string {
  return normalizeLibraryKey([triple.scope, triple.ownerId, triple.id])
}

/** 超长键的确定性折叠（见 `normalizeLibraryKey` 第 ④ 条）；只在键长 > 200 时被调用，输出恒为 200 字符。 */
export function foldLibraryKey(key: string): string {
  const digest = createHash('sha256').update(key, 'utf8').digest('hex').slice(0, LIBRARY_KEY_FOLD_DIGEST)
  const head = key.slice(0, LIBRARY_KEY_FOLD_HEAD)
  const tail = key.slice(-LIBRARY_KEY_FOLD_TAIL)
  return `${head}-${digest}-${tail}`
}

/**
 * 键门禁（写库前的最后一道自检）：字符集按官方、长度按我们自己的 ≤200。
 * 服务层每次落表前都拿它复核一遍，保证「我们自己生成的键」也真的能过官方后端。
 */
export function isLibraryKeySafe(key: unknown): key is string {
  return typeof key === 'string'
    && key.length > 0
    && key.length <= LIBRARY_KEY_MAX_LENGTH
    && LIBRARY_SAFE_KEY_PATTERN.test(key)
}
