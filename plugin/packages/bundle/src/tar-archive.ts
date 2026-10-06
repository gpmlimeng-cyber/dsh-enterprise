/**
 * [INPUT]: 只依赖 Node `zlib.gunzipSync`、`Buffer`，以及共享 ZIP 内核 `zip-archive.ts` 的 **`validateArchiveEntryPath`**（路径门禁只有一份，绝不在这里再写第二套）
 * [OUTPUT]: 对外提供 `readTarGzipEntries(gzip, limits)`（gzip 解压 + tar 读取）与 `readTarEntries(bytes, limits)`（POSIX ustar / GNU longname / PAX 扩展头；只交回**常规文件**，路径逃逸与链接一律拒）以及 `TarArchiveError`
 * [POS]: bundle 的**唯一** tar 读取内核（本刀「在线搜索 → 从结果安装」用：上游 `codeload.github.com` 给的是整仓 `tar.gz`）。本文件只做**容器**层：不认识 `SKILL.md`、不认识技能目录布局，只交回逐条 `{path, bytes}`；错误一律抛 `TarArchiveError`，由调用方翻成自己的稳定码。★**符号链接/硬链接一律拒**（`lstat` 之后不会有链接类型进到落盘层）；★压缩与解压两侧都有**独立上限**（tar 炸弹）；★**不新增依赖**（仓内没有 tar 包，这是手写的最小只读实现，风格与 `zip-archive.ts` 同）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { gunzipSync } from 'node:zlib'
import { validateArchiveEntryPath, ZipArchiveError } from './zip-archive.js'

/** tar 容器层的失败；消息面向日志与测试，业务码由调用方决定。 */
export class TarArchiveError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TarArchiveError'
  }
}

/**
 * 体量超限（条目/单文件/解压后总量）：**必须与「结构非法」分开** —— 前者在上游那侧是 413「太大了」，
 * 后者是 400「这个包不合法」，调用方要靠类型分辨（消息文本不该被用来判分支）。
 */
export class TarArchiveTooLargeError extends TarArchiveError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TarArchiveTooLargeError'
  }
}

/** 调用方给的两条上限（压缩侧由取数层自己按 content-length/累计字节把关，这里管条目数与解压后总量）。 */
export interface TarArchiveLimits {
  /** 条目数上限（含目录与扩展头）。 */
  readonly maxEntries: number
  /** **解压后**总字节上限（tar 炸弹的闸门）。 */
  readonly maxUncompressedBytes: number
  /** 单条目字节上限。 */
  readonly maxEntryBytes: number
}

/** 一条 tar 条目的类型（**读取器只分类，不替调用方定策略**）。 */
export type TarArchiveEntryKind = 'file' | 'directory' | 'link' | 'other'

/**
 * 一条已通过容器层校验的 tar 条目；`path` 是 `/` 分隔的包内相对路径。
 *
 * ★读取器**不**因为包里出现链接就整包拒绝：整仓 tar 里别处有链接是常态（线上实测
 * `nextlevelbuilder/ui-ux-pro-max-skill` 的 `gallery/data/styles.csv` 就是符号链接），而调用方往往
 * 只提取其中**一个子目录** —— 那种链接与本次落盘毫无关系。策略（「目标目录里必须是常规文件」）
 * 由调用方在选择阶段判定，见 `skill-online.ts` 的 `collectDirectory`。
 */
export interface TarArchiveEntry {
  readonly path: string
  readonly kind: TarArchiveEntryKind
  /** `kind === 'link'` 时的链接目标（**只用于诊断**，绝不跟随）。 */
  readonly linkname?: string
  /** `kind === 'file'` 时的正文；其余类型为 undefined。 */
  readonly bytes?: Buffer | undefined
}

const BLOCK_BYTES = 512
const NAME_BYTES = 100
const PREFIX_BYTES = 155
const SIZE_OFFSET = 124
const SIZE_BYTES = 12
const CHECKSUM_OFFSET = 148
const CHECKSUM_BYTES = 8
const TYPEFLAG_OFFSET = 156
const MAGIC_OFFSET = 257
const PREFIX_OFFSET = 345
const GZIP_MAGIC = [0x1f, 0x8b]

function invalid(message: string, cause?: unknown): TarArchiveError {
  return cause === undefined ? new TarArchiveError(message) : new TarArchiveError(message, { cause })
}

/** 体量类失败走独立的类型（见 {@link TarArchiveTooLargeError}）。 */
function tooLarge(message: string, cause?: unknown): TarArchiveTooLargeError {
  return cause === undefined ? new TarArchiveTooLargeError(message) : new TarArchiveTooLargeError(message, { cause })
}

/** 取以一个 NUL 结尾的定长字段的**原始字节**（不含 NUL）。 */
function nulTerminated(field: Buffer): Buffer {
  const end = field.indexOf(0)
  return end < 0 ? field : field.subarray(0, end)
}

/** 读一个八进制字段（tar 的标准数值编码）；GNU base-256（最高位为 1）显式拒绝而不是猜着读。 */
function readOctal(block: Buffer, offset: number, length: number, label: string): number {
  const first = block[offset] ?? 0
  if ((first & 0x80) !== 0) throw invalid(`archive ${label} uses an unsupported base-256 encoding`)
  const text = block.subarray(offset, offset + length).toString('latin1').replace(/\0.*$/s, '').trim()
  if (text.length === 0) return 0
  if (!/^[0-7]+$/.test(text)) throw invalid(`archive ${label} is not a valid octal number`)
  const value = Number.parseInt(text, 8)
  if (!Number.isSafeInteger(value) || value < 0) throw invalid(`archive ${label} is out of range`)
  return value
}

/** 头校验和：无符号与有符号两种累加都要认（不同 tar 生产者写法不同）。 */
function verifyChecksum(block: Buffer, declared: number): void {
  let unsigned = 0
  let signed = 0
  for (let index = 0; index < BLOCK_BYTES; index += 1) {
    const byte = index >= CHECKSUM_OFFSET && index < CHECKSUM_OFFSET + CHECKSUM_BYTES ? 0x20 : (block[index] ?? 0)
    unsigned += byte
    signed += byte < 0x80 ? byte : byte - 0x100
  }
  if (unsigned !== declared && signed !== declared) throw invalid('archive header checksum does not match')
}

/** 把 tar 里的名字交给**共享的那一份**路径门禁（ZIP 内核同一函数），并翻成本文件的错误类型。 */
function validatePath(rawName: Buffer, decoded: string): readonly string[] {
  try {
    return validateArchiveEntryPath(rawName, decoded)
  } catch (error) {
    throw invalid(error instanceof ZipArchiveError ? error.message : 'archive entry path is invalid', error)
  }
}

/** 解析 PAX 扩展头正文（形如 `<十进制长度> <键>=<值>\n` 的记录流），只取我们认识的键。 */
function readPaxRecords(payload: Buffer, keys: readonly string[]): Map<string, string> {
  const records = new Map<string, string>()
  const text = payload.toString('utf8')
  let cursor = 0
  while (cursor < text.length) {
    const space = text.indexOf(' ', cursor)
    if (space < 0) break
    const length = Number.parseInt(text.slice(cursor, space), 10)
    if (!Number.isSafeInteger(length) || length <= 0 || cursor + length > text.length) {
      throw invalid('archive PAX extended header is malformed')
    }
    const record = text.slice(space + 1, cursor + length).replace(/\n$/, '')
    const equals = record.indexOf('=')
    if (equals > 0) {
      const key = record.slice(0, equals)
      if (keys.includes(key)) records.set(key, record.slice(equals + 1))
    }
    cursor += length
  }
  return records
}

/**
 * 读一份**未压缩**的 tar；任何不合规都抛 `TarArchiveError`。
 *
 * 支持范围（够用且只多不少）：POSIX `ustar`（含 `prefix` 字段拼长名）、GNU 长名（`L`）、PAX 扩展头（`x`/`g`，
 * GitHub `codeload` 的 `tar.gz` 用的就是 PAX）；**逐条分类**为 `file`/`directory`/`link`/`other`，
 * 由调用方决定「哪些类型可以进落盘」—— 读取器只保证：路径合法、无重复、头校验和正确、体量有界。
 *
 * @param bytes - tar 字节（gzip 由 {@link readTarGzipEntries} 先解开）。
 * @param limits - 条目数与体积上限。
 * @returns 逐条 `{path, bytes}`（顺序即 tar 内顺序）。
 * @throws {TarArchiveError} 容器层任何不合规。
 */
export function readTarEntries(bytes: Buffer, limits: TarArchiveLimits): readonly TarArchiveEntry[] {
  const entries: TarArchiveEntry[] = []
  const seen = new Set<string>()
  let longName: string | undefined
  let paxPath: string | undefined
  let cursor = 0
  let declaredEntries = 0
  let totalBytes = 0
  while (cursor + BLOCK_BYTES <= bytes.byteLength) {
    const header = bytes.subarray(cursor, cursor + BLOCK_BYTES)
    // 结尾是两个全零块（单块全零也见得多了，按结尾处理）。
    if (header.every(byte => byte === 0)) break
    declaredEntries += 1
    if (declaredEntries > limits.maxEntries) throw invalid('archive has too many entries')
    verifyChecksum(header, readOctal(header, CHECKSUM_OFFSET, CHECKSUM_BYTES, 'checksum'))
    const size = readOctal(header, SIZE_OFFSET, SIZE_BYTES, 'entry size')
    if (size > limits.maxEntryBytes) throw tooLarge('archive entry is larger than the per-entry limit')
    const dataStart = cursor + BLOCK_BYTES
    const dataEnd = dataStart + size
    if (size > 0 && dataEnd > bytes.byteLength) throw invalid('archive entry data is truncated')
    const payload = bytes.subarray(dataStart, dataEnd)
    const typeflag = String.fromCharCode(header[TYPEFLAG_OFFSET] ?? 0)
    const magic = header.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6).toString('latin1')

    if (typeflag === 'x' || typeflag === 'g') {
      const records = readPaxRecords(payload, ['path', 'linkpath'])
      const path = records.get('path')
      if (typeflag === 'x' && path !== undefined) paxPath = path
      cursor = dataStart + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES
      continue
    }
    if (typeflag === 'L' || typeflag === 'K') {
      const value = payload.toString('utf8').replace(/\0.*$/s, '')
      if (typeflag === 'L') longName = value
      cursor = dataStart + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES
      continue
    }
    // 名字优先级：PAX `path=` > GNU 长名 > ustar `prefix`+`name`。
    // ★原始字节必须一路带着走：共享门禁会做「UTF-8 解码必须无损往返」的判定，先按 latin1 把名字读成
    //   字符串再重编码会让任何非 ASCII 名在门禁那里被判非法（而 tar 名本来就是 UTF-8 字节）。
    const rawShort = nulTerminated(header.subarray(0, NAME_BYTES))
    const rawPrefix = magic.startsWith('ustar') ? nulTerminated(header.subarray(PREFIX_OFFSET, PREFIX_OFFSET + PREFIX_BYTES)) : Buffer.alloc(0)
    const rawName = paxPath !== undefined
      ? Buffer.from(paxPath, 'utf8')
      : longName !== undefined
        ? Buffer.from(longName, 'utf8')
        : rawPrefix.byteLength === 0
          ? rawShort
          : Buffer.concat([rawPrefix, Buffer.from('/'), rawShort])
    const decoded = rawName.toString('utf8')
    longName = undefined
    paxPath = undefined
    const segments = validatePath(rawName, decoded)
    const path = segments.join('/')
    if (seen.has(path)) throw invalid('archive contains a duplicate path')
    seen.add(path)
    cursor = dataStart + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES

    // 类型只**分类**、不在这里判策略：链接/设备/FIFO 进不了 entries 的 file 分支，调用方按需拒。
    if (typeflag === '5') {
      entries.push({ path, kind: 'directory' })
      continue
    }
    if (typeflag === '2' || typeflag === '1') {
      const linkname = nulTerminated(header.subarray(157, 157 + 100)).toString('utf8')
      entries.push({ path, kind: 'link', linkname })
      continue
    }
    if (typeflag !== '0' && typeflag !== '\0') {
      entries.push({ path, kind: 'other' })
      continue
    }
    totalBytes += size
    if (totalBytes > limits.maxUncompressedBytes) throw tooLarge('archive expands beyond the uncompressed size limit')
    entries.push({ path, kind: 'file', bytes: Buffer.from(payload) })
  }
  return entries
}

/**
 * 解开一份 `tar.gz`（上游 `codeload.github.com/{owner}/{repo}/tar.gz/refs/heads/{ref}` 给的就是它）。
 *
 * gzip 侧两道闸门：先看 trailer 里的 ISIZE（解压后大小 mod 2³²）粗筛，再交给 `gunzipSync` 的
 * `maxOutputLength` 硬限 —— 只靠前者会被 >4 GiB 的炸弹绕过去，只靠后者则要多分配一次内存。
 *
 * @param gzip - 压缩字节（必须是 gzip，magic `1f 8b`）。
 * @param limits - 条目数与体积上限。
 * @returns 逐条 `{path, bytes}`。
 * @throws {TarArchiveError} 不是 gzip / 解压超限 / tar 层任何不合规。
 */
export function readTarGzipEntries(gzip: Buffer, limits: TarArchiveLimits): readonly TarArchiveEntry[] {
  if (gzip.byteLength < 18 || gzip[0] !== GZIP_MAGIC[0] || gzip[1] !== GZIP_MAGIC[1]) {
    throw invalid('archive is not a gzip stream')
  }
  const declaredUncompressed = gzip.readUInt32LE(gzip.byteLength - 4)
  if (declaredUncompressed > limits.maxUncompressedBytes) {
    throw tooLarge('archive expands beyond the uncompressed size limit')
  }
  let raw: Buffer
  try {
    raw = gunzipSync(gzip, { maxOutputLength: limits.maxUncompressedBytes })
  } catch (error) {
    throw tooLarge('archive could not be decompressed within the uncompressed size limit', error)
  }
  return readTarEntries(raw, limits)
}
