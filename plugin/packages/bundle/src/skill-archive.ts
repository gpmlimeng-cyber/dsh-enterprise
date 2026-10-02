/**
 * [INPUT]: 只依赖共享 ZIP 内核 `zip-archive.ts`（`readZipEntries` + `ZipArchiveError`）与企业技能包契约（`.dshskill` = 根 `manifest.json` + `skills/<name>/SKILL.md`，真源见 `docs/compose/spec/skill-catalog.md` S2.2）
 * [OUTPUT]: 对外提供 `decodeDshSkillArchive(bytes)`（先在共享内核里完成容器层门禁，再做**技能布局**核对：只允许 `manifest.json` 与 `skills/` 子树、每条技能必须有 `SKILL.md`）、`manifestSkillId`、上限常量与 `EnterpriseSkillArchive` 形状
 * [POS]: bundle 技能纵深的**制品解包边界**——ZIP 容器层已抽到 `zip-archive.ts`（与配方包 `.dshpreset` 共用同一份解析器）；本文件只保留**技能布局**判定，解压前完成路径逃逸与符号链接拒绝这件事由共享内核承担，之后才可能有字节落到磁盘；不解析 SKILL.md 正文（正文语义由官方 `skill-filesystem` 在发现时自行校验），也不执行包内任何内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ZipArchiveError,
  readZipEntries,
  type ZipArchiveEntry,
  type ZipArchiveLimits,
} from './zip-archive.js'
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

/** 技能目录名（= 官方 `dsh-skill` 的 skill name）规约：严格 kebab-case。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** `manifest.json` 的 `id` 规约：与契约 `SkillPackageRef` 同源。 */
const SKILL_PACKAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** 交给共享内核的三条上限（技能包口径，与中心验包逐字相同）。 */
const SKILL_ZIP_LIMITS: ZipArchiveLimits = {
  maxBytes: SKILL_ARCHIVE_MAX_BYTES,
  maxEntries: SKILL_ARCHIVE_MAX_ENTRIES,
  maxUncompressedBytes: SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
}

function invalid(message: string, cause?: unknown): EnterpriseSkillInstallError {
  return cause === undefined
    ? new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message)
    : new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message, { cause })
}

/**
 * 跑一遍共享 ZIP 内核，并把容器层的失败翻成本包的稳定码 `ENT_SKILL_ARCHIVE_INVALID`。
 *
 * 消息逐字透传（内核的消息即本文件原先的消息），故既有单测的断言与线上日志口径都不变。
 *
 * @param bytes - 已通过大小/SHA-256 校验的压缩包字节。
 * @returns 逐条 `{path, isDirectory, bytes}`。
 */
function readCentralDirectory(bytes: Buffer): readonly ZipArchiveEntry[] {
  try {
    return readZipEntries(bytes, SKILL_ZIP_LIMITS)
  } catch (error) {
    throw invalid(error instanceof ZipArchiveError ? error.message : 'archive could not be parsed', error)
  }
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
