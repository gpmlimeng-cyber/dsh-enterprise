/**
 * [INPUT]: 只依赖 Node `zlib.inflateRawSync`、`Buffer` 与企业技能包契约（`.dshskill` = 根 `manifest.json` + `skills/<name>/SKILL.md`，真源见 `docs/compose/spec/skill-catalog.md` S2.2）
 * [OUTPUT]: 对外提供 `decodeDshSkillArchive(bytes)`（严格 ZIP 中央目录解析 + 包契约核对 + 全部上限门禁）、`manifestSkillId`、上限常量与 `EnterpriseSkillArchive` 形状
 * [POS]: bundle 技能纵深的**制品解包边界**——解压前完成路径逃逸（`..`/绝对路径/盘符/反斜杠/控制字符/重复路径）与符号链接拒绝，解压中完成 CRC32/大小/解压上限门禁，之后才可能有字节落到磁盘；不解析 SKILL.md 正文（正文语义由官方 `skill-filesystem` 在发现时自行校验），也不执行包内任何内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { inflateRawSync } from 'node:zlib'
import { EnterpriseSkillInstallError } from './skill-errors.js'

/** 压缩包字节上限：与中心验包口径逐字相同（50 MiB）。 */
export const SKILL_ARCHIVE_MAX_BYTES = 52_428_800
/** 解压后总字节上限：与中心验包口径逐字相同（200 MiB）。 */
export const SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 209_715_200
/** 中央目录条目数上限：与中心验包口径逐字相同。 */
export const SKILL_ARCHIVE_MAX_ENTRIES = 10_000
/** 一包最多技能条目数：与契约 `RuntimeSkillDetail.skills` 的 maxItems 同源。 */
export const SKILL_ARCHIVE_MAX_SKILLS = 200
/** 单个 SKILL.md 字节上限：与中心验包口径逐字相同（256 KiB）。 */
export const SKILL_MD_MAX_BYTES = 262_144
/** 单条路径长度上限，避免病态长名把落盘路径撑爆。 */
const SKILL_PATH_MAX_LENGTH = 1024
/** 单段路径长度上限（多数文件系统的 NAME_MAX）。 */
const SKILL_PATH_SEGMENT_MAX_LENGTH = 255

/** 技能目录名（= 官方 `dsh-skill` 的 skill name）规约：严格 kebab-case。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** `manifest.json` 的 `id` 规约：与契约 `SkillPackageRef` 同源。 */
const SKILL_PACKAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

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

function invalid(message: string, cause?: unknown): EnterpriseSkillInstallError {
  return cause === undefined
    ? new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message)
    : new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message, { cause })
}

/** 包内一个已解出且通过校验的文件；`path` 是**相对所属技能目录**的 `/` 分隔路径。 */
export interface SkillArchiveFile {
  readonly path: string
  readonly bytes: Buffer
}

/** 一个已通过校验的技能条目：目录名（= 技能名）与它名下的全部文件（含 `SKILL.md`）。 */
export interface SkillArchiveEntry {
  readonly name: string
  readonly files: readonly SkillArchiveFile[]
}

/** 一个已通过全部门禁的 `.dshskill` 包。 */
export interface EnterpriseSkillArchive {
  /** `manifest.json` 的 `id`；与中心详情的 `skillId` 同源。 */
  readonly skillId: string
  readonly skills: readonly SkillArchiveEntry[]
}

interface RawZipEntry {
  readonly path: string
  readonly isDirectory: boolean
  readonly bytes: Buffer | undefined
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
  if (decoded.length === 0 || decoded.length > SKILL_PATH_MAX_LENGTH) throw invalid('archive entry path length is invalid')
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
    if (segment.length > SKILL_PATH_SEGMENT_MAX_LENGTH) throw invalid('archive entry path segment is too long')
    for (let index = 0; index < segment.length; index += 1) {
      const code = segment.charCodeAt(index)
      if (code < 0x20 || code === 0x7f) throw invalid('archive entry path contains a control character')
    }
  }
  return segments
}

/** 定位并读取 ZIP 的中央目录（忽略本地头的压缩后大小，故兼容数据描述符写法）。 */
function readCentralDirectory(bytes: Buffer): readonly RawZipEntry[] {
  if (bytes.byteLength < EOCD_MIN_BYTES || bytes.byteLength > SKILL_ARCHIVE_MAX_BYTES) {
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
  if (totalEntries > SKILL_ARCHIVE_MAX_ENTRIES) throw invalid('archive has too many entries')
  if (centralDirectoryOffset + centralDirectoryBytes > eocd) throw invalid('archive central directory is out of bounds')

  const entries: RawZipEntry[] = []
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
    if (declaredUncompressedBytes > SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
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

/** 读 `manifest.json` 的 `id`；本包只认 `format=dsh-skill` 且 `version=1`。 */
function manifestSkillId(text: string): string {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw invalid('manifest.json is not valid JSON', error)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid('manifest.json is not an object')
  const manifest = value as Record<string, unknown>
  // 中心与服务端 SkillArtifactInspector 一致：version 是【字符串】"1"（服务端用
  // "1".equals(version) 判定）。此前这里比的是数字 1，导致所有真实制品被判非法。
  if (manifest['format'] !== 'dsh-skill' || manifest['version'] !== '1') {
    throw invalid('manifest.json is not a dsh-skill v1 manifest')
  }
  const id = manifest['id']
  if (typeof id !== 'string' || id.length === 0 || id.length > 128 || !SKILL_PACKAGE_REF_PATTERN.test(id)) {
    throw invalid('manifest.json has an invalid id')
  }
  return id
}

/**
 * 解出一个 `.dshskill` 包的技能树；任何不合规都抛 `ENT_SKILL_ARCHIVE_INVALID`。
 *
 * 布局判定（与中心验包口径一致）：根只允许 `manifest.json` 与 `skills/` 子树；
 * `skills/<kebab-name>/SKILL.md` 必须存在；不解析 frontmatter 正文语义（那是官方
 * `skill-filesystem` 的职责，且它的发现失败只会跳过该技能而不是破坏目录）。
 *
 * @param bytes - 已通过大小/SHA-256 校验的压缩包字节。
 * @returns `manifest.json` 的 `id` 与每个技能目录下的全部文件（路径相对技能目录）。
 */
export function decodeDshSkillArchive(bytes: Buffer): EnterpriseSkillArchive {
  const entries = readCentralDirectory(bytes)
  const manifest = entries.find(entry => entry.path === 'manifest.json' && entry.isDirectory === false)
  if (manifest === undefined || manifest.bytes === undefined) throw invalid('archive is missing manifest.json')
  const skillId = manifestSkillId(manifest.bytes.toString('utf8'))

  const skills = new Map<string, SkillArchiveFile[]>()
  for (const entry of entries) {
    if (entry.path === 'manifest.json') continue
    // `zip -r` 打包目录树时会显式写入父目录条目 `skills/`：它不是技能条目，
    // 若照常按 `/` 切分会得到空技能名而被 kebab 正则误判为非法（真实制品复现过）。
    if (entry.path === 'skills/' || entry.path === 'skills') continue
    const segments = entry.path.split('/')
    if (segments[0] !== 'skills' || segments.length < 2) {
      throw invalid('archive contains a path outside manifest.json and skills/')
    }
    const name = segments[1]
    if (name === undefined || name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
      throw invalid('archive contains an invalid skill directory name')
    }
    if (entry.isDirectory) continue
    const relative = segments.slice(2).join('/')
    if (relative.length === 0 || entry.bytes === undefined) throw invalid('archive contains an invalid skill file path')
    if (relative === 'SKILL.md' && entry.bytes.byteLength > SKILL_MD_MAX_BYTES) {
      throw invalid('archive contains an oversized SKILL.md')
    }
    const files = skills.get(name) ?? []
    files.push({ path: relative, bytes: entry.bytes })
    skills.set(name, files)
  }

  if (skills.size === 0) throw invalid('archive contains no skill')
  if (skills.size > SKILL_ARCHIVE_MAX_SKILLS) throw invalid('archive contains too many skills')
  const result: SkillArchiveEntry[] = []
  for (const [name, files] of skills) {
    if (!files.some(file => file.path === 'SKILL.md')) throw invalid(`skill ${name} is missing SKILL.md`)
    result.push({ name, files })
  }
  result.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return { skillId, skills: result }
}
