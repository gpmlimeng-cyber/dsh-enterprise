/**
 * [INPUT]: 依赖 node:crypto 的 createHash、共享 ZIP 内核 `zip-archive.ts` 的 `readZipEntries`（+ `ZipArchiveError`/`ZipArchiveEntry`）、`skill-archive.ts` 的四条上限常量与技能文件形状、`skill-frontmatter.ts` 的 `validateSkillFrontmatter`、`skill-install.ts` 的 `placeEnterpriseSkillArchive`/`readInstalledSkillRecords`/`requireRelativeSkillPath`/`installedSkillStatus`/`SKILL_CONTENT_FILENAME`（+ 两个形状）、`skill-upload.ts` 的 `readSelfInstalledRecords`/`upsertSelfInstalledRecord`/`SYSTEM_ADOPT_SOURCE_TYPE`（+ 记录形状）与 `skill-errors.ts` 的 `EnterpriseSkillInstallError`
 * [OUTPUT]: 对外提供第四源（`skillhub.cn`）落装所需的四件事：`decodeBareSkillDirectory(bytes)`（**第三种布局**的布局边界）、`requireSkillhubParts`/`parseSkillhubReference`（坐标两段**唯一**的收窄判据）、`installSkillhubSkill(options, artifact)`（安装内核）与 `SKILLHUB_SOURCE_INPUT_PREFIX`，以及 `BareSkillTree`/`SkillhubArtifact` 形状
 * [POS]: bundle 技能纵深的**第六面**（在线搜索的第四源）——与「本地上传」「系统搜索」「本地三方」「已发布导出」并列，**共用**同一条加固落盘 `placeEnterpriseSkillArchive`、同一份七键自装记录与**同一个** ZIP 内核；本文件只多两件事：① **第三种布局**（`skill-published.ts` 认的是 `<技能名>/SKILL.md` 那种外层恰好一个目录的导出包，`.dshskill` 认的是 `manifest.json + skills/<kebab>/…`，而 skillhub 的制品是**裸技能目录**：真实三份包的形状是**根级 `SKILL.md`** + `references/*` + `_meta.json`，**没有**外层目录、**没有** `manifest.json`）；② 该源的**安装内核**（取数在 `skill-online.ts`，本文件**不碰网络**、不碰平台客户端、不引入任何新依赖）。
 *   ★**布局判定必须毫不含糊**（两种都认，但判据只有一条）：**包根有 `SKILL.md` ⇒ 按裸目录那一种**（所有条目都相对包根，`references/x.md` 这种子目录照样在里面）；
 *   **包根没有 `SKILL.md` ⇒ 必须恰好一个顶层目录**（`zip -r` 的父目录条目 `name/` 会被内核去掉尾斜杠，故按"首段集合"判），
 *   每个条目都得在那个目录**里面**（顶层裸文件 ⇒ 拒），且 `SKILL.md` 就在它下面。两条路都**只**落一个技能目录。
 *   混合形态（根级 `SKILL.md` + 另有一个装了 `SKILL.md` 的子目录）按第一条判成裸目录：**根级那个是这次落装的技能**，
 *   子目录里的文件如实一起落下（**不静默丢字节**），这条显式规则有用例钉住。
 *   ★**第三布局不是第二份解析器**：容器层四道门禁（路径逃逸/符号链接/条目数/解压总量）全部由共享内核 `readZipEntries` 承担；
 *   本文件只做"哪些条目算这个技能的文件"这一层判定，`SKILL.md` 的 256 KiB 与 `.dshskill`/导出包**同一把尺**。
 *   ★**落点名以 frontmatter 的 `name` 为准**（与官方 watcher、与三方那一面同一判据），frontmatter 过的是**同一份**
 *   `validateSkillFrontmatter`（不过即整次拒绝、**零落盘**）。
 *   ★**落盘与记账复用既有那两份**：`placeEnterpriseSkillArchive`（`ownNames` 恒空 ⇒ **绝不覆盖**）、
 *   七键自装记录（`sourceType: 'system'`、`sourceInput: 'skillhub:<slug>@<version>'` —— **不写 URL、不写宿主路径**；
 *   `sha256` 算在**这次接受的制品字节**上，它是唯一能与上游那份 ZIP 逐字节对照的事实）。
 *   ★全程零 `exec`/`spawn`、不做动态 import。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { EnterpriseSkillInstallError } from './skill-errors.js'
import { validateSkillFrontmatter } from './skill-frontmatter.js'
import {
  SKILL_ARCHIVE_MAX_BYTES,
  SKILL_ARCHIVE_MAX_ENTRIES,
  SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
  SKILL_MD_MAX_BYTES,
  type SkillArchiveFile,
} from './skill-archive.js'
import {
  installedSkillStatus,
  placeEnterpriseSkillArchive,
  readInstalledSkillRecords,
  requireRelativeSkillPath,
  SKILL_CONTENT_FILENAME,
  type EnterpriseInstalledSkills,
  type EnterpriseSkillInstallOptions,
} from './skill-install.js'
import {
  readSelfInstalledRecords,
  SYSTEM_ADOPT_SOURCE_TYPE,
  upsertSelfInstalledRecord,
  type SelfInstalledSkillRecord,
} from './skill-upload.js'
import { ZipArchiveError, readZipEntries, type ZipArchiveEntry } from './zip-archive.js'

/**
 * 自装记录 `sourceInput` 的来源前缀（**逐字冻结**：`skillhub:<slug>@<version>`）。
 *
 * ★三件事一起说清：① 前缀是上游站点的名字 `skillhub`（**不是**本仓的源 id `skillhub.cn`）——
 * 这一格记的是"这枚技能从哪个来源来"，不是"我们内部管它叫哪个源"；② 带上 `@<version>` 是因为
 * **搜索那一刻看到的那一版**才是这次装的东西（制品 URL 按版本取，见 `skill-online.ts` 的取数），
 * 不写版本就等于让记录对"到底装了哪一版"撒谎；③ ★**不写 URL、不写宿主路径**（脱敏纪律：
 * 制品 URL 自带签名授权，落进记录就是把一次性的授权面留在盘上）。
 */
export const SKILLHUB_SOURCE_INPUT_PREFIX = 'skillhub:'

/**
 * slug 的形状规约（`^[A-Za-z0-9][A-Za-z0-9._-]*$`，≤128）。
 *
 * ★与 `skill-upload.ts` 读自装记录时对 `skillId` 的规约**逐字同源**：slug 会**原样**写进那份记录的
 * `skillId`，这里放宽一个字节，写进去的记录就会在下次读取时被判 `ENT_SKILL_STATE_INVALID`
 * ⇒ 两处必须同一把尺（不是"差不多"就够）。
 */
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
/** 版本段形状：字母数字起头、`._-` 续（真机形如 `1.0.0`/`v2`/`2026.10.05`），≤100。 */
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const MAX_SLUG_LENGTH = 128
const MAX_VERSION_LENGTH = 100

/** 交给共享 ZIP 内核的三条上限：与 `.dshskill`/导出包**逐字同一把尺**（50 MiB / 1 万条 / 解压 200 MiB）。 */
const BARE_SKILL_ZIP_LIMITS = {
  maxBytes: SKILL_ARCHIVE_MAX_BYTES,
  maxEntries: SKILL_ARCHIVE_MAX_ENTRIES,
  maxUncompressedBytes: SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
} as const

function invalid(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_SOURCE_UNKNOWN', message)
}

function archiveInvalid(message: string, cause?: unknown): EnterpriseSkillInstallError {
  return cause === undefined
    ? new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message)
    : new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message, { cause })
}

/**
 * 把两段候选值收窄成 skillhub 坐标（slug + version）；任何不合规一律 `undefined`。
 *
 * ★这是**唯一**一把尺，两个调用点共用它：搜索侧（`skill-online.ts` 的 `normalizeSkillhub`）拿它决定
 * "这条结果装不装得出来"（`undefined` ⇒ 按条丢弃并计数），安装侧（`parseSkillhubReference`）拿它决定
 * "这个坐标认不认"（`undefined` ⇒ `ENT_SKILL_SOURCE_UNKNOWN`）。两处各写一套迟早会出现
 * "搜索敢交出去、安装不认"的坐标。
 */
export function requireSkillhubParts(
  slug: unknown,
  version: unknown,
): { readonly slug: string, readonly version: string } | undefined {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    return undefined
  }
  if (typeof version !== 'string' || version.length === 0 || version.length > MAX_VERSION_LENGTH
    || !VERSION_PATTERN.test(version)) {
    return undefined
  }
  return { slug, version }
}

/** 把坐标引用 `"<slug>@<version>"` 解成两段；形状不合一律 `undefined`（调用方决定丢还是拒）。 */
export function parseSkillhubReference(reference: string): { readonly slug: string, readonly version: string } | undefined {
  const parts = reference.split('@')
  if (parts.length !== 2) return undefined
  return requireSkillhubParts(parts[0], parts[1])
}

/** 一个**裸技能目录** ZIP 解出来的技能树（路径**相对技能目录**）。 */
export interface BareSkillTree {
  /** 布局形态：`root` = `SKILL.md` 就在包根（真机三份实测包的形状）；`wrapped` = 顶层恰好一个目录包着。 */
  readonly layout: 'root' | 'wrapped'
  /** `wrapped` 形态下那个顶层目录名（诊断用；落点名以 **frontmatter 的 `name`** 为准）。`root` 形态下整键不产出。 */
  readonly directory?: string
  /** 技能目录下的全部文件（含 `SKILL.md`；路径相对该技能目录，已过共享内核的路径门禁）。 */
  readonly files: readonly SkillArchiveFile[]
}

function regularFiles(entries: readonly ZipArchiveEntry[], label: string): SkillArchiveFile[] {
  const files: SkillArchiveFile[] = []
  for (const entry of entries) {
    if (entry.isDirectory) continue
    if (entry.bytes === undefined) throw archiveInvalid(`the ${label} contains an entry without bytes`)
    files.push({ path: entry.path, bytes: entry.bytes })
  }
  return files
}

/**
 * 解出一个**裸技能目录** ZIP（第四源 skillhub.cn 的制品布局）；任何不合规都抛 `ENT_SKILL_ARCHIVE_INVALID`。
 *
 * 判定顺序（判据只有一条分叉，见 [POS]）：
 *  ① 容器层四道门禁由共享内核 `readZipEntries` 全权负责（路径逃逸/符号链接/条目数/解压总量）——
 *    本函数**绝不自写第二个 ZIP 解析器**；
 *  ② **包根有 `SKILL.md`** ⇒ `layout: 'root'`：所有条目都相对包根（`references/x.md`、`_meta.json` 都在里面）；
 *  ③ 否则 ⇒ `layout: 'wrapped'`：顶层首段集合必须**恰好一个**（两个顶层目录、或"一个目录 + 一个顶层裸文件"都拒），
 *    每个条目都必须在那个目录**里面**（顶层裸文件拒），得到相对路径；
 *  ④ 两条路都必须有 `SKILL.md`，且它 ≤256 KiB（与 `.dshskill`/导出包同一把尺）。
 *
 * ★它**不解析 frontmatter**（那是 `skill-frontmatter.ts` 的职责、由 `installSkillhubSkill` 单独过闸），
 * 也**不执行包内任何内容**。
 *
 * @param bytes - 这次接受的制品字节（已按 50 MiB 配额有界读取）。
 * @returns 布局形态、可选的顶层目录名与逐条文件。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_ARCHIVE_INVALID`：容器层或布局层任一不合规。
 */
export function decodeBareSkillDirectory(bytes: Buffer): BareSkillTree {
  let entries: readonly ZipArchiveEntry[]
  try {
    entries = readZipEntries(bytes, BARE_SKILL_ZIP_LIMITS)
  } catch (error) {
    throw archiveInvalid(error instanceof ZipArchiveError ? error.message : 'archive could not be parsed', error)
  }
  if (entries.length === 0) throw archiveInvalid('the skill archive is empty')
  // ① 分叉：包根那一枚 `SKILL.md` 在不在。（`entries` 的路径已由内核去掉目录尾斜杠并逐段收窄。）
  const hasRootSkill = entries.some(entry => !entry.isDirectory && entry.path === SKILL_CONTENT_FILENAME)
  let tree: BareSkillTree
  if (hasRootSkill) {
    tree = { layout: 'root', files: regularFiles(entries, 'skill archive') }
  } else {
    const tops = new Set(entries.map(entry => entry.path.split('/')[0] ?? ''))
    if (tops.size !== 1) {
      throw archiveInvalid('the skill archive must keep every entry inside exactly one skill directory')
    }
    const directory = [...tops][0] ?? ''
    if (directory.length === 0) throw archiveInvalid('the skill archive has an empty skill directory')
    const files: SkillArchiveFile[] = []
    for (const entry of entries) {
      // 目录条目一律跳过：`name/`（那个外层目录本身，内核已去掉尾斜杠）与 `name/references/` 都不是文件。
      if (entry.isDirectory) continue
      const segments = entry.path.split('/')
      // 顶层裸**文件**：这份包不是"一个技能目录"，拒。
      if (segments.length < 2) {
        throw archiveInvalid('the skill archive must keep every entry inside the skill directory')
      }
      const relative = segments.slice(1).join('/')
      if (relative.length === 0 || entry.bytes === undefined) {
        throw archiveInvalid('the skill archive contains an invalid skill file path')
      }
      files.push({ path: relative, bytes: entry.bytes })
    }
    tree = { layout: 'wrapped', directory, files }
  }
  const markdown = tree.files.find(file => file.path === SKILL_CONTENT_FILENAME)
  if (markdown === undefined) throw archiveInvalid('the skill archive is missing SKILL.md')
  if (markdown.bytes.byteLength > SKILL_MD_MAX_BYTES) {
    throw archiveInvalid('the skill archive contains an oversized SKILL.md')
  }
  return tree
}

/** 这次接受的制品：字节 + 它在上游的坐标两段（`skill-online.ts` 取完数一起交进来）。 */
export interface SkillhubArtifact {
  /** 制品 ZIP 的字节（301 之后的正文；**不是**那个 302 的 `<a href=…>` 正文）。 */
  readonly bytes: Buffer
  /** 上游 slug（同时是本面自装记录的 `skillId`）。 */
  readonly slug: string
  /** 搜索那一刻看到的那一版（写进自装记录的 provenance）。 */
  readonly version: string
}

/**
 * 把一枚 skillhub.cn 制品装进本机官方技能根（第四源的安装内核）。
 *
 * 闸门顺序（缺一即停，每一步都可测）：
 *  ① **坐标形状**（`parseSkillhubReference` 已由调用方跑过；这里复核 slug/version，任何不合即 400 `ENT_SKILL_SOURCE_UNKNOWN`）；
 *  ② **布局**（`decodeBareSkillDirectory`：共享内核四道门禁 + 第三布局）⇒ `ENT_SKILL_ARCHIVE_INVALID`；
 *  ③ **frontmatter 闸门**（**同一份** `validateSkillFrontmatter`）⇒ `ENT_SKILL_SKILLMD_INVALID`；
 *  ④ 落点名复核（**同一份** `requireRelativeSkillPath`：frontmatter 的 `name` 必须是单独一段）；
 *  ⑤ 两条 fail-closed：已装过（同一 slug 的旧记录，或落点名字被**任何**归属占用）⇒ `ENT_SKILL_ALREADY_REGISTERED`、
 *     落点被别的归属占用 ⇒ `ENT_SKILL_NAME_CONFLICT`；★`ownNames` 恒空 ⇒ **绝不覆盖**；
 *  ⑥ 落盘（`placeEnterpriseSkillArchive`）→ 原子写七键自装记录（`sourceType: 'system'`、
 *     `sourceInput: 'skillhub:<slug>@<version>'`、`sha256` = 这次接受的制品字节摘要）。
 *
 * @param options - 平台面（本面**一个字节都不打**，只为满足既有落盘/记录入口的形状）、可选 dshHome/时钟/留痕端口。
 * @param artifact - 已取回并已按配额有界的制品字节 + 上游坐标两段。
 * @returns **与企业安装同形**的最新已装态（本面返回它与 `installSkillFromResult` 的其余源逐字同形）。
 * @throws {EnterpriseSkillInstallError} 上表逐条 + `ENT_SKILL_INSTALL_FAILED`/`ENT_SKILL_STATE_INVALID`（落盘与记账）。
 */
export async function installSkillhubSkill(
  options: EnterpriseSkillInstallOptions,
  artifact: SkillhubArtifact,
): Promise<EnterpriseInstalledSkills> {
  const parts = requireSkillhubParts(artifact.slug, artifact.version)
  if (parts === undefined) throw invalid('the skillhub.cn coordinate is invalid')
  // ② 布局（共享 ZIP 内核的四道门禁全在；本面只判"哪些条目算这个技能的文件"）。
  const tree = decodeBareSkillDirectory(artifact.bytes)
  // ③ frontmatter 闸门（与另几条通路**同一份**实现；不过即整次拒绝、零落盘）。
  const markdown = tree.files.find(file => file.path === SKILL_CONTENT_FILENAME)
  if (markdown === undefined) throw archiveInvalid('the skill archive is missing SKILL.md')
  const skillName = validateSkillFrontmatter(markdown.bytes, tree.directory ?? parts.slug).name
  // ④ 落点名与记录名必须是同一把尺：走过既有那份唯一的相对路径门禁（facts.name 必是 kebab，这里是复核）。
  const segments = requireRelativeSkillPath(skillName)
  if (segments.length !== 1 || segments[0] !== skillName) {
    throw new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'the skillhub.cn skill name is not a single segment')
  }
  // 两个清单先 fail-closed 读完（损坏即拒），再动磁盘。
  const selfRecords = await readSelfInstalledRecords(options)
  const enterpriseRecords = await readInstalledSkillRecords(options)
  const ownedElsewhere = new Set<string>([
    ...enterpriseRecords.flatMap(record => [...record.names]),
    ...selfRecords.flatMap(record => [...record.names]),
  ])
  // ⑤ 两条 fail-closed（顺序：先「已装过」，再「落点被别人占了」——与三方/导出那一面同款）。
  if (ownedElsewhere.has(skillName) || selfRecords.some(record => record.skillId === parts.slug)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_ALREADY_REGISTERED', 'this skillhub.cn skill is already installed')
  }
  await placeEnterpriseSkillArchive(options, {
    archive: {
      // 包标识 = 上游 slug（这一面没有 `manifest.json`，slug 就是它在来源那一侧的身份）。
      skillId: parts.slug,
      displayName: skillName,
      skills: [{ name: skillName, files: tree.files }],
    },
    // ★本面**绝不覆盖**：可替换集合恒空（同名目录存在 ⇒ 落点冲突预检直接 409）。
    ownNames: new Set<string>(),
    ownedElsewhere,
    failureCode: 'ENT_SKILL_INSTALL_FAILED',
    commit: async () => {
      const record: SelfInstalledSkillRecord = {
        skillId: parts.slug,
        displayName: skillName,
        // 摘要算在**这次接受的制品字节**上（与上游那份 ZIP 逐字节对照的唯一事实）。
        sha256: createHash('sha256').update(artifact.bytes).digest('hex'),
        names: [skillName],
        installedAt: (options.now ?? (() => new Date()))().toISOString(),
        // 沿用通路二那枚来源标签（`sourceType` 是自由字符串，加取值**不改**七键键集）。
        sourceType: SYSTEM_ADOPT_SOURCE_TYPE,
        sourceInput: `${SKILLHUB_SOURCE_INPUT_PREFIX}${parts.slug}@${parts.version}`,
      }
      await upsertSelfInstalledRecord(options, record)
    },
  })
  return await installedSkillStatus(options)
}
