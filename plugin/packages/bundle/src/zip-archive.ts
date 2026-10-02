/**
 * [INPUT]: 只依赖 Node `zlib.inflateRawSync` 与 `Buffer`，加上调用方给出的三条体积/条目上限
 * [OUTPUT]: 对外提供 `readZipEntries(bytes, limits)`（严格 ZIP 中央目录解析：解压前的路径逃逸/符号链接/加密/ZIP64 拒绝 + 解压中的 CRC32/大小/上限门禁）与 `ZipArchiveError`
 * [POS]: bundle 的**唯一** ZIP 解包内核——技能包（`.dshskill`，`skill-archive.ts`）与配方包（`.dshpreset`，`preset-archive.ts`）两份**布局校验**共用它，绝不各自再写第二个 ZIP 解析器（与「不新造第二个下载通道」同一条纪律）。本文件只做**容器**层：不认识技能目录名、不认识 `manifest.json` 的业务字段，只交回逐条 `{path, isDirectory, bytes}`；错误一律抛 `ZipArchiveError`（不带业务错误码），由各自的布局层翻成自己的稳定码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { inflateRawSync } from 'node:zlib'

/** ZIP 容器层的失败；消息面向日志与测试，业务码由调用方（技能/配方布局层）决定。 */
export class ZipArchiveError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ZipArchiveError'
  }
}

/** 调用方给的三条上限（与中心验包口径同源：技能 50 MiB / 1 万条目 / 解压 200 MiB，配方同量级）。 */
export interface ZipArchiveLimits {
  /** 压缩包字节上限。 */
  readonly maxBytes: number
  /** 中央目录条目数上限。 */
  readonly maxEntries: number
  /** 解压后总字节上限。 */
  readonly maxUncompressedBytes: number
}

/** 一条已解出且通过容器层校验的条目；`path` 是 `/` 分隔的包内相对路径（目录条目去掉尾斜杠）。 */
export interface ZipArchiveEntry {
  readonly path: string
  readonly isDirectory: boolean
  /** 目录条目为 undefined；文件条目为已通过 CRC/大小校验的正文。 */
  readonly bytes: Buffer | undefined
}

/** 单条路径长度上限，避免病态长名把落盘路径撑爆。 */
const PATH_MAX_LENGTH = 1024
/** 单段路径长度上限（多数文件系统的 NAME_MAX）。 */
const PATH_SEGMENT_MAX_LENGTH = 255

const EOCD_SIGNATURE = 0x06054b50
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const EOCD_MIN_BYTES = 22
const MAX_ZIP_COMMENT_BYTES = 0xffff
const CENTRAL_DIRECTORY_HEADER_BYTES = 46
const LOCAL_FILE_HEADER_BYTES = 30
/** ZIP 压缩方法：0 = 存储、8 = deflate；其余（bzip2/lzma/zstd…）一律拒绝。 */
const ZIP_METHOD_STORE = 0
const ZIP_METHOD_DEFLATE = 8
/** 通用位标记：bit0 加密、bit3 数据描述符（大小以中央目录为准，故这里放行）、bit11 UTF-8 文件名。 */
const ZIP_FLAG_ENCRYPTED = 0x0001
/** 扩展属性高位是 Unix 模式时，文件类型段（S_IFMT）。 */
const UNIX_FILE_TYPE_MASK = 0o170000
const UNIX_TYPE_REGULAR = 0o100000
const UNIX_TYPE_DIRECTORY = 0o040000

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0)
  return (crc ^ 0xffffffff) >>> 0
}

function invalid(message: string, cause?: unknown): ZipArchiveError {
  return cause === undefined ? new ZipArchiveError(message) : new ZipArchiveError(message, { cause })
}

/**
 * 校验一条中央目录路径并返回它的分段。
 *
 * 这是**解压前**的唯一判定点：任何逃逸形状都在读数据之前就被拒，因此不可能有字节落到目标目录之外。
 * 拒绝清单与中心验包口径一致：绝对路径（前导 `/`）、Windows 盘符、反斜杠、`..`/`.` 段、空段、
 * 控制字符、超长路径与超长段；重复路径由调用方在收集时判定。
 *
 * @param rawPath - 中央目录里的路径原文（未解码）。
 * @param decoded - 按 UTF-8 解出的路径。
 * @returns 去掉目录尾斜杠后的分段；目录条目返回的分段不含末尾空段。
 */
function validateEntryPath(rawPath: Buffer, decoded: string): readonly string[] {
  if (decoded.length === 0 || decoded.length > PATH_MAX_LENGTH) throw invalid('archive entry path length is invalid')
  if (decoded.includes('\u0000')) throw invalid('archive entry path contains a NUL byte')
  if (decoded.includes('\\')) throw invalid('archive entry path contains a backslash')
  if (decoded.startsWith('/')) throw invalid('archive entry path is absolute')
  if (/^[A-Za-z]:/.test(decoded)) throw invalid('archive entry path starts with a drive letter')
  // 解码必须是无损 UTF-8 往返：否则非 ASCII 名会被静默改写成另一个文件，落盘名与包内名不再一致。
  if (!Buffer.from(decoded, 'utf8').equals(rawPath)) throw invalid('archive entry path is not valid UTF-8')
  const isDirectory = decoded.endsWith('/')
  const trimmed = isDirectory ? decoded.slice(0, -1) : decoded
  if (trimmed.length === 0) throw invalid('archive entry path is empty')
  const segments = trimmed.split('/')
  for (const segment of segments) {
    if (segment.length === 0) throw invalid('archive entry path has an empty segment')
    if (segment === '.' || segment === '..') throw invalid('archive entry path escapes the archive root')
    if (segment.length > PATH_SEGMENT_MAX_LENGTH) throw invalid('archive entry path segment is too long')
    for (let index = 0; index < segment.length; index += 1) {
      const code = segment.charCodeAt(index)
      if (code < 0x20 || code === 0x7f) throw invalid('archive entry path contains a control character')
    }
  }
  return segments
}

/**
 * 定位并读取 ZIP 的中央目录（忽略本地头的压缩后大小，故兼容数据描述符写法）。
 *
 * @param bytes - 已通过大小/SHA-256 校验的压缩包字节。
 * @param limits - 调用方格式的三条上限。
 * @returns 逐条 `{path, isDirectory, bytes}`（顺序即中央目录顺序）。
 * @throws {ZipArchiveError} 容器层任何不合规。
 */
export function readZipEntries(bytes: Buffer, limits: ZipArchiveLimits): readonly ZipArchiveEntry[] {
  if (bytes.byteLength < EOCD_MIN_BYTES || bytes.byteLength > limits.maxBytes) {
    throw invalid('archive size is invalid')
  }
  let eocd = -1
  const lowest = Math.max(0, bytes.byteLength - EOCD_MIN_BYTES - MAX_ZIP_COMMENT_BYTES)
  for (let offset = bytes.byteLength - EOCD_MIN_BYTES; offset >= lowest; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== EOCD_SIGNATURE) continue
    const commentLength = bytes.readUInt16LE(offset + 20)
    if (offset + EOCD_MIN_BYTES + commentLength !== bytes.byteLength) continue
    eocd = offset
    break
  }
  if (eocd < 0) throw invalid('archive is not a ZIP file')
  // ZIP64 用 32 位字段全 1 作哨兵；本包格式上限 50 MiB / 1 万条目，故显式拒绝而不是猜着读。
  if (eocd >= 20 && bytes.readUInt32LE(eocd - 20) === ZIP64_EOCD_LOCATOR_SIGNATURE) {
    throw invalid('ZIP64 archives are not supported')
  }
  const diskNumber = bytes.readUInt16LE(eocd + 4)
  const centralDirectoryDisk = bytes.readUInt16LE(eocd + 6)
  const entriesOnDisk = bytes.readUInt16LE(eocd + 8)
  const totalEntries = bytes.readUInt16LE(eocd + 10)
  const centralDirectoryBytes = bytes.readUInt32LE(eocd + 12)
  const centralDirectoryOffset = bytes.readUInt32LE(eocd + 16)
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw invalid('multi-disk archives are not supported')
  }
  if (totalEntries === 0xffff || centralDirectoryBytes === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw invalid('ZIP64 archives are not supported')
  }
  if (totalEntries > limits.maxEntries) throw invalid('archive has too many entries')
  if (centralDirectoryOffset + centralDirectoryBytes > eocd) throw invalid('archive central directory is out of bounds')

  const entries: ZipArchiveEntry[] = []
  const seen = new Set<string>()
  let cursor = centralDirectoryOffset
  let declaredUncompressedBytes = 0
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + CENTRAL_DIRECTORY_HEADER_BYTES > bytes.byteLength
      || bytes.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw invalid('archive central directory entry is malformed')
    }
    const versionMadeBy = bytes.readUInt16LE(cursor + 4)
    const flags = bytes.readUInt16LE(cursor + 8)
    const method = bytes.readUInt16LE(cursor + 10)
    const declaredCrc = bytes.readUInt32LE(cursor + 16)
    const compressedBytes = bytes.readUInt32LE(cursor + 20)
    const uncompressedBytes = bytes.readUInt32LE(cursor + 24)
    const nameBytes = bytes.readUInt16LE(cursor + 28)
    const extraBytes = bytes.readUInt16LE(cursor + 30)
    const commentBytes = bytes.readUInt16LE(cursor + 32)
    const diskStart = bytes.readUInt16LE(cursor + 34)
    const externalAttributes = bytes.readUInt32LE(cursor + 38)
    const localHeaderOffset = bytes.readUInt32LE(cursor + 42)
    const nameStart = cursor + CENTRAL_DIRECTORY_HEADER_BYTES
    const next = nameStart + nameBytes + extraBytes + commentBytes
    if (next > bytes.byteLength) throw invalid('archive central directory entry is truncated')
    cursor = next
    if ((flags & ZIP_FLAG_ENCRYPTED) !== 0) throw invalid('encrypted archive entries are not supported')
    if (diskStart !== 0) throw invalid('multi-disk archives are not supported')
    if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw invalid('ZIP64 archives are not supported')
    }
    if (method !== ZIP_METHOD_STORE && method !== ZIP_METHOD_DEFLATE) {
      throw invalid('archive entry uses an unsupported compression method')
    }
    // Unix 生产者会在扩展属性高位写 st_mode；符号链接/设备/FIFO 一律拒绝（本实现也永不创建链接）。
    const hostSystem = versionMadeBy >>> 8
    if (hostSystem === 3) {
      const type = (externalAttributes >>> 16) & UNIX_FILE_TYPE_MASK
      const isDirectory = type === UNIX_TYPE_DIRECTORY
      if (type !== 0 && type !== UNIX_TYPE_REGULAR && !isDirectory) {
        throw invalid('archive entry is not a regular file')
      }
    }
    const rawName = bytes.subarray(nameStart, nameStart + nameBytes)
    const decodedName = rawName.toString('utf8')
    const segments = validateEntryPath(rawName, decodedName)
    const isDirectory = decodedName.endsWith('/')
    const path = segments.join('/')
    if (seen.has(path)) throw invalid('archive contains a duplicate path')
    seen.add(path)
    if (isDirectory) {
      entries.push({ path, isDirectory: true, bytes: undefined })
      continue
    }
    declaredUncompressedBytes += uncompressedBytes
    if (declaredUncompressedBytes > limits.maxUncompressedBytes) {
      throw invalid('archive expands beyond the uncompressed size limit')
    }
    if (localHeaderOffset + LOCAL_FILE_HEADER_BYTES > bytes.byteLength
      || bytes.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw invalid('archive local header is malformed')
    }
    const localNameBytes = bytes.readUInt16LE(localHeaderOffset + 26)
    const localExtraBytes = bytes.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + LOCAL_FILE_HEADER_BYTES + localNameBytes + localExtraBytes
    if (dataStart + compressedBytes > bytes.byteLength) throw invalid('archive entry data is truncated')
    const compressed = bytes.subarray(dataStart, dataStart + compressedBytes)
    let content: Buffer
    if (method === ZIP_METHOD_STORE) {
      if (compressedBytes !== uncompressedBytes) throw invalid('stored archive entry has inconsistent sizes')
      content = Buffer.from(compressed)
    } else {
      try {
        content = inflateRawSync(compressed)
      } catch (error) {
        throw invalid('archive entry could not be inflated', error)
      }
    }
    if (content.byteLength !== uncompressedBytes) throw invalid('archive entry size does not match its header')
    if (crc32(content) !== declaredCrc) throw invalid('archive entry failed its CRC check')
    entries.push({ path, isDirectory: false, bytes: content })
  }
  return entries
}
