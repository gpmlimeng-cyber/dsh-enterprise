/**
 * [INPUT]: 依赖 node:crypto 的 createHash/randomUUID、node:fs/promises、node:path、platform-client 的 `resolveEnterpriseDshHome`、本包的 `decodeDshSkillArchive`（ZIP/manifest 闸门）、`validateSkillFrontmatter`（§D.4 正文闸门）、`parseFeedbackMultipart`（**复用反馈那条 multipart 解析器，绝不新造第二个**）、`placeEnterpriseSkillArchive`（**复用中心安装那条加固落盘**）与稳定错误码
 * [OUTPUT]: 对外提供通路一「本地上传」的 Host 侧全流程 `uploadSkillArchive(options, body, boundary)`、只读投影 `installedSelfSkills(options)`、把一条记录并入自装清单的 `upsertSelfInstalledRecord(options, record)`（供通路二「系统搜索 → 纳入」复用同一份七键记录与 0600 原子写）、**用一整份清单原子替换自装清单的 `replaceSelfInstalledRecords(options, records)`**（本刀新增：自装技能卸载要"改短名单 / 整条移除"，`upsert` 的"并入"表达不了；形状 / 权限 / 0600 原子写仍是下面那两个函数的同一份实现 —— **`self-installed.json` 的写入口仍然只有这一处**），以及 `SelfInstalledSkillRecord`/`EnterpriseSelfInstalledSkills` 形状、`SYSTEM_ADOPT_SOURCE_TYPE` 取值与自装状态文件常量
 * [POS]: bundle 技能纵深的**第二份记录**所有者（真源 `docs/plan/skill-install-sources.md` §B.1 方案甲 + §E.2③）——浏览器 multipart 字节进到 Host 后：**先闸门**（ZIP 结构 → manifest → frontmatter）、算 sha256、按内容寻址写进 `<dshHome>/enterprise/skill-uploads/<sha256>.dshskill`，再从 `decodeDshSkillArchive` 起的下游**一字不改**地交给 `placeEnterpriseSkillArchive`（与中心安装同一套落点冲突预检 / 暂存 / 逐个原子改名 / 失败整体回滚），最后原子写**独立**的自装清单 `<dshHome>/enterprise/skill-installs/self-installed.json`。★自装记录**不写进** `installed.json`（那份是严格八键 + 雪花 id 的中心口径，塞进去只能伪造 id 或放宽形状）；**★自装卸载与「打开所在文件夹」已由 `skill-self-installed.ts` 补上**（它只调本文件的 `readSelfInstalledRecords`/`replaceSelfInstalledRecords`，一个字节的落盘动作都不自己写），自装上传的孤儿清理改走 `skill-install.ts` 的**唯一**删除入口 `deleteOwnedSkillDirectory`（本文件不再有第二个 `rm(recursive)`）；★全程零 exec/spawn、不做动态 import，只落 0o600 文件与 0o700 目录
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { decodeDshSkillArchive } from './skill-archive.js'
import { EnterpriseSkillInstallError, skillInstallError } from './skill-errors.js'
import { parseFeedbackMultipart } from './feedback-route.js'
import { validateSkillFrontmatter } from './skill-frontmatter.js'
import {
  deleteOwnedSkillDirectory,
  installedSkillStatus,
  placeEnterpriseSkillArchive,
  readInstalledSkillRecords,
  SKILL_CONTENT_FILENAME,
  SKILL_LOCAL_ROOT_SEGMENTS,
  type EnterpriseInstalledSkills,
  type EnterpriseSkillInstallOptions,
} from './skill-install.js'

/** 上传制品的内容寻址落点（§B.1 步骤 5 的固定目录；**文件名只由 sha256 合成**，用户输入永远拼不进路径）。 */
export const SKILL_UPLOAD_ARTIFACT_DIR_SEGMENTS = ['enterprise', 'skill-uploads'] as const
/** 自装清单的独立状态文件（§E.2③：与中心 `installed.json` **并列**、绝不混写）。 */
export const SELF_INSTALLED_STATE_FILENAME = 'self-installed.json'

const SELF_INSTALL_DIR_SEGMENTS = ['enterprise', 'skill-installs'] as const
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKILL_PACKAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const MAX_SKILLS_PER_PACKAGE = 200
const MAX_DISPLAY_NAME_LENGTH = 120
const MAX_SOURCE_INPUT_LENGTH = 1024
const MAX_SOURCE_TYPE_LENGTH = 32
/** multipart 里那个唯一的文件字段名（冻结契约；UI 侧只发这一个）。 */
const UPLOAD_PART_NAME = 'artifact'

/**
 * 通路二「系统搜索 → 纳入」写进自装记录的 `sourceType` 取值。
 *
 * ★取值与上游逐字同源：Cherry（tag `v2.1.4`）`src/main/ai/skills/SkillService.ts:419` 把
 * `installSkillDir(canonicalPath, 'system', pathToFileURL(canonicalPath).href, …)` 传下去，即「系统搜索 → 导入」
 * 的来源标签就是 `'system'`（本仓由 Lead 裁决沿用该词；`sourceType` 是自由字符串，见本文件 `:63`，
 * 加取值**不改**那份记录的逐字七键键集）。它同时也是 `installedSelfSkills` 判「这条路的存在性该怎么看」
 * 的判据（见那里），所以它必须住在**记录所有者**这一侧、与 `SelfInstalledSkillRecord` 同一个文件。
 */
export const SYSTEM_ADOPT_SOURCE_TYPE = 'system'

/**
 * 一条**本机自装**技能记录（`GET /enterprise/api/v1/local/skills/self-installed` 的条目）。
 *
 * 五枚必备键由 Lead 冻结：`skillId`（= `manifest.json` 的 `id`，自装**没有**中心雪花 id，这就是唯一的
 * 包标识）/ `displayName` / `sha256` / `names` / `installedAt`；另两枚是本通路可如实填的 §F.4 provenance
 * （`sourceType` / `sourceInput`）。§F.4 的 `resolvedUrl`/`coordinate`/`fetchedAt`/`containerSha256`/
 * `upstreamDigest`/`license`/`toolVersion`/`dshVersion`/`resultCode` 对「用户自己选的文件」不适用
 * （没有取包、没有许可取证），本刀**不编造**它们。
 */
export interface SelfInstalledSkillRecord {
  /** `manifest.json` 的 `id`（≤128，`^[A-Za-z0-9][A-Za-z0-9._-]*$`）。 */
  readonly skillId: string
  /** 显示名：`manifest.json` 的 `name`，缺失时回落该包第一个技能目录名（绝不空白、绝不编造）。 */
  readonly displayName: string
  /** 我们对**最终接受的 `.dshskill` 字节**算的摘要（唯一权威摘要，也是制品落点的文件名）。 */
  readonly sha256: string
  /** 本包落盘的技能目录名（kebab，已按官方规约重新收窄）。 */
  readonly names: readonly string[]
  /** 记录写入时间（ISO 8601）。 */
  readonly installedAt: string
  /** 来源类型：本通路恒为 `upload`（`skillhub`/`github`/`npm` 是通路二的取值）。 */
  readonly sourceType: string
  /** 用户原始文件名（已去路径与控制字符、截断到 1024 字）；没有文件名时为空串。 */
  readonly sourceInput: string
}

/** `GET /enterprise/api/v1/local/skills/self-installed` 的本地投影。 */
export interface EnterpriseSelfInstalledSkills {
  /** 只列**目录仍在**的记录（与 `installedSkillStatus` 同口径：绝不给「假已装态」）。 */
  readonly skills: readonly SelfInstalledSkillRecord[]
}

/** 自装侧需要的最小依赖（与中心安装同一套优先级：显式 → `$DSH_HOME` → `~/.dsh`）。 */
interface UploadDependencies {
  readonly dshHome: string
  readonly now: () => Date
  readonly onError: ((message: string, error: unknown) => void) | undefined
}

function resolveUploadDependencies(options: EnterpriseSkillInstallOptions): UploadDependencies {
  return {
    dshHome: resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    now: options.now ?? (() => new Date()),
    onError: options.onError,
  }
}

function selfInstalledStatePath(deps: UploadDependencies): string {
  return join(deps.dshHome, ...SELF_INSTALL_DIR_SEGMENTS, SELF_INSTALLED_STATE_FILENAME)
}

function skillRoot(deps: UploadDependencies): string {
  return join(deps.dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS)
}

function invalid(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_UPLOAD_INVALID', message)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** 落盘的文件名只当**数据**：去目录部分、去控制字符、按字符截断；绝不用它拼任何路径。 */
function sanitizeSourceInput(filename: string | undefined): string {
  if (filename === undefined) return ''
  const base = basename(filename.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '')
  return base.length > MAX_SOURCE_INPUT_LENGTH ? base.slice(0, MAX_SOURCE_INPUT_LENGTH) : base
}

function requireSkillName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || !SKILL_NAME_PATTERN.test(value)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'self-installed skill name is invalid')
  }
  return value
}

/**
 * 严格读自装清单；文件不存在是合法空状态，损坏一律 fail-closed 而不是当成空清单覆盖。
 *
 * 键集**逐字定死**这七枚（与既有 `installed.json` 的严格八键同一纪律）：文件形状与出网投影是同一个，
 * 未来要给 §F.4 补字段时必须两侧同批改，不允许「盘上有、投影没有」的静默丢字段。
 */
export async function readSelfInstalledRecords(
  options: EnterpriseSkillInstallOptions,
): Promise<readonly SelfInstalledSkillRecord[]> {
  const deps = resolveUploadDependencies(options)
  let text: string
  try {
    text = await readFile(selfInstalledStatePath(deps), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw skillInstallError(error, 'ENT_SKILL_STATE_INVALID', 'self-installed skill state could not be read')
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'self-installed skill state is not valid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'records'
    || !Array.isArray((value as { records?: unknown }).records)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'self-installed skill state has an invalid shape')
  }
  const records: SelfInstalledSkillRecord[] = []
  for (const item of (value as { records: unknown[] }).records) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'self-installed skill record is not an object')
    }
    const row = item as Record<string, unknown>
    const names = row['names']
    if (Object.keys(row).sort().join(',') !== 'displayName,installedAt,names,sha256,skillId,sourceInput,sourceType'
      || typeof row['skillId'] !== 'string' || row['skillId'].length > 128 || !SKILL_PACKAGE_REF_PATTERN.test(row['skillId'])
      || typeof row['displayName'] !== 'string' || row['displayName'].length === 0
      || row['displayName'].length > MAX_DISPLAY_NAME_LENGTH
      || typeof row['sha256'] !== 'string' || !SHA256_PATTERN.test(row['sha256'])
      || typeof row['installedAt'] !== 'string' || !Number.isFinite(Date.parse(row['installedAt']))
      || typeof row['sourceType'] !== 'string' || row['sourceType'].length === 0
      || row['sourceType'].length > MAX_SOURCE_TYPE_LENGTH
      || typeof row['sourceInput'] !== 'string' || row['sourceInput'].length > MAX_SOURCE_INPUT_LENGTH
      || !Array.isArray(names) || names.length === 0 || names.length > MAX_SKILLS_PER_PACKAGE) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'self-installed skill record has invalid fields')
    }
    records.push({
      skillId: row['skillId'],
      displayName: row['displayName'],
      sha256: row['sha256'],
      // 状态文件是磁盘输入：先用 kebab 规约重新收窄，才允许它参与任何路径构造。
      names: names.map(requireSkillName),
      installedAt: row['installedAt'],
      sourceType: row['sourceType'],
      sourceInput: row['sourceInput'],
    })
  }
  return records
}

/** 原子写自装清单：同目录临时件 + rename（与既有 `writeRecords` 同一套纪律）。 */
async function writeSelfInstalledRecords(
  deps: UploadDependencies,
  records: readonly SelfInstalledSkillRecord[],
): Promise<void> {
  const path = selfInstalledStatePath(deps)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(temporary, JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw skillInstallError(error, 'ENT_SKILL_STATE_INVALID', 'self-installed skill state could not be written')
  }
}

/**
 * 本机自装清单（只读投影）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @returns 目录仍完整的自装记录。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_STATE_INVALID`：自装清单损坏或形状非法。
 */
export async function installedSelfSkills(
  options: EnterpriseSkillInstallOptions,
): Promise<EnterpriseSelfInstalledSkills> {
  const deps = resolveUploadDependencies(options)
  const skills: SelfInstalledSkillRecord[] = []
  for (const record of await readSelfInstalledRecords(options)) {
    if (await selfInstalledRecordPresent(deps, record)) skills.push(record)
  }
  return { skills }
}

/**
 * 一条自装记录的**存在性判据**（界面读的就是这份投影，判错会让记录凭空消失）。
 *
 * `names` 里装的是**技能名**（kebab，读盘时按官方规约重新收窄）。通路一（本地上传）的落盘目录名与技能名
 * 相同，故常态就是「`<root>/<name>/SKILL.md` 在不在」。
 *
 * ★通路二（系统纳入）**必须**例外：官方 watcher 的判定门在 frontmatter 的 `name` 上、**不在目录名上**
 * （`@deepseek-ai/dsh-skill-filesystem/lib/index.js:584-597` 逐目录取 `<dir>/SKILL.md`，`:679`/`:685` 只看
 * frontmatter 的 `name`）⇒ 目录名可以完全不同于技能名（`My Skill/` 里声明 `name: my-skill` 也是一条活技能）。
 * 那时 `names` 里那个 kebab 名**根本不会**是磁盘上的目录名，只按 `names` 判存在会把**刚纳入**的记录立刻
 * 判成「目录没了」：界面看不到它、用户也没法再纳入一次。故 `sourceType === 'system'` 的记录改为按它自己的
 * `sourceInput`（通路二写的就是那条目录的 **canonical 绝对路径**）判定；相对串一律不参与存在性判定。
 */
async function selfInstalledRecordPresent(
  deps: UploadDependencies,
  record: SelfInstalledSkillRecord,
): Promise<boolean> {
  const root = skillRoot(deps)
  const present = await Promise.all(record.names.map(name => exists(join(root, name, SKILL_CONTENT_FILENAME))))
  if (present.every(Boolean)) return true
  return record.sourceType === SYSTEM_ADOPT_SOURCE_TYPE
    && isAbsolute(record.sourceInput)
    && await exists(join(record.sourceInput, SKILL_CONTENT_FILENAME))
}

/**
 * 把一条自装记录**并入**清单（同 `skillId` 覆盖，其余保序），供通路二「系统搜索 → 纳入」复用。
 *
 * ★为什么要有这个薄入口、而不是让 `skill-system.ts` 自己读写那份文件：自装清单的**七键形状**
 * （`readSelfInstalledRecords` 的逐字键集比对）与 **0600 原子写**纪律只能有一份实现 —— 两处各写一遍
 * 迟早会出现「一条能写、读回来被判损坏」的静默分裂。这里只做读—替换—写，形状与权限全在下面那两个函数里。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param record - 待写入的完整七键记录（调用方负责每一枚字段都已按契约收窄）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_STATE_INVALID`：清单损坏或写盘失败。
 */
export async function upsertSelfInstalledRecord(
  options: EnterpriseSkillInstallOptions,
  record: SelfInstalledSkillRecord,
): Promise<void> {
  const deps = resolveUploadDependencies(options)
  const records = await readSelfInstalledRecords(options)
  await writeSelfInstalledRecords(deps, [...records.filter(item => item.skillId !== record.skillId), record])
}

/**
 * 用**一整份**记录清单原子替换自装清单（本文件与 `skill-self-installed.ts` 的**唯一**写入口）。
 *
 * ★为什么这条入口必须住在**记录所有者**这一侧（本刀）：卸载那条路要的是「精确地把一条记录改成短名单 /
 * 整条移除」，`upsertSelfInstalledRecord` 的「并入」表达不了它。两处各写一遍「读—过滤—0600 原子写」
 * 迟早会出现「一处写得进、另一处读回来判损坏」的静默分裂，更糟的是会多出**第二个**
 * `self-installed.json` 写者。故对外只多这一个薄入口：形状、权限与原子写仍是下面那两个函数的同一份
 * 实现（`readSelfInstalledRecords` 的键集闸门 + `writeSelfInstalledRecords` 的 0o700/0o600/临时件 `rename`），
 * `skill-self-installed.ts` 一个字节的落盘动作都不做。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param records - **完整**的七键记录清单（调用方负责每条都已按契约收窄；`[]` 是合法空状态）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_STATE_INVALID`：写盘失败。
 */
export async function replaceSelfInstalledRecords(
  options: EnterpriseSkillInstallOptions,
  records: readonly SelfInstalledSkillRecord[],
): Promise<void> {
  await writeSelfInstalledRecords(resolveUploadDependencies(options), records)
}

/**
 * 从 multipart 正文里取**恰好一个** `artifact` 文件 part 的字节（冻结契约，§B.1 步骤 3/4）。
 *
 * 解析器复用反馈那条 `parseFeedbackMultipart`（本仓只有这一份 multipart 分帧实现，不新造第二个）；
 * 本函数只做**表单形状**判定：非畸形分帧、part 数恰好 1、名字恰好 `artifact`、正文非空。
 *
 * @param body - 已按 50 MiB 配额有界读取的 multipart 正文（由本机路由负责）。
 * @param boundary - 同一请求 `content-type` 里的 boundary。
 * @returns 制品字节与原始文件名（filename 可能没有）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_UPLOAD_INVALID`：形状任一条不满足。
 */
export function readSkillUploadArtifact(
  body: Buffer,
  boundary: string,
): { readonly bytes: Buffer; readonly filename: string | undefined } {
  const parts = parseFeedbackMultipart(body, boundary)
  if (parts === undefined || parts.length !== 1) {
    throw invalid('the upload body must be a multipart form with exactly one part')
  }
  const part = parts[0]!
  if (part.name !== UPLOAD_PART_NAME) throw invalid(`the upload part must be named ${UPLOAD_PART_NAME}`)
  if (part.data.byteLength === 0) throw invalid('the uploaded artifact is empty')
  return { bytes: part.data, filename: part.filename }
}

/** 上传制品的落点：`<dshHome>/enterprise/skill-uploads/<sha256>.dshskill`（内容寻址，文件名与用户输入无关）。 */
function uploadArtifactPath(deps: UploadDependencies, sha256: string): string {
  return join(deps.dshHome, ...SKILL_UPLOAD_ARTIFACT_DIR_SEGMENTS, `${sha256}.dshskill`)
}

/** `.part` → 原子 rename 落一份内容寻址制品（失败收敛成 `ENT_SKILL_UPLOAD_FAILED`，不留半截文件）。 */
async function storeUploadedArtifact(deps: UploadDependencies, sha256: string, bytes: Buffer): Promise<void> {
  const path = uploadArtifactPath(deps, sha256)
  const temporary = `${path}.${randomUUID()}.part`
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(temporary, bytes, { mode: 0o600 })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw skillInstallError(error, 'ENT_SKILL_UPLOAD_FAILED', 'the uploaded skill artifact could not be stored')
  }
}

/**
 * 通路一「本地上传」：把浏览器 multipart 里那一个 `.dshskill` 装进本机技能目录。
 *
 * 顺序（§B.1 的步骤 4→9；任一步失败都不改变磁盘上的既有技能与本机自装清单）：
 *  ① multipart 形状（恰好一个 `artifact` part）；
 *  ② 闸门：`decodeDshSkillArchive`（ZIP 结构 / 路径 / 上限 / manifest）→ 每个 `SKILL.md` 过
 *     `validateSkillFrontmatter`（§D.4 全套，**整包拒绝**，不留半个目录）；
 *  ③ 算 sha256 + 两个清单 fail-closed 读入 + 幂等判定（同 `skillId` 同 sha256 且目录仍在 ⇒ 回当前态）；
 *  ④ 写 `<dshHome>/enterprise/skill-uploads/<sha256>.dshskill`（内容寻址，`.part` → 原子 rename）；
 *  ⑤ 落点冲突预检（**企业记录 ∪ 自装记录 − 自己**）→ 暂存 → 逐个原子改名 → 原子写自装清单；
 *  ⑥ 回读**企业**已装态作为响应（冻结契约：与 `POST /skills/install` 的 `data` 逐字同形，
 *     自装记录**不进**那一份，见 §E.2③）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param body - multipart 正文（本机路由已做 content-length 预检与 50 MiB 有界读取）。
 * @param boundary - 同一请求的 multipart boundary。
 * @returns 安装后的最新**企业**已装态（与 `/skills/install` 同形）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_UPLOAD_INVALID` / `ENT_SKILL_ARCHIVE_INVALID` /
 *   `ENT_SKILL_SKILLMD_INVALID` / `ENT_SKILL_NAME_CONFLICT` / `ENT_SKILL_UPLOAD_FAILED` /
 *   `ENT_SKILL_STATE_INVALID`。
 */
export async function uploadSkillArchive(
  options: EnterpriseSkillInstallOptions,
  body: Buffer,
  boundary: string,
): Promise<EnterpriseInstalledSkills> {
  const deps = resolveUploadDependencies(options)
  const artifact = readSkillUploadArtifact(body, boundary)
  const archive = decodeDshSkillArchive(artifact.bytes)
  for (const entry of archive.skills) {
    const markdown = entry.files.find(file => file.path === SKILL_CONTENT_FILENAME)
    if (markdown === undefined) {
      // `decodeDshSkillArchive` 已保证每条技能都有 SKILL.md；这里只是让「闸门必须逐条跑」不会被静默跳过。
      throw invalid(`the uploaded archive is missing ${SKILL_CONTENT_FILENAME} for ${entry.name}`)
    }
    const facts = validateSkillFrontmatter(markdown.bytes, entry.name)
    // D4-10「未知键：容忍但留痕」——这里就是那条留痕（走组合层的 warn 端口，不改任何判定）。
    if (facts.unknownKeys.length > 0) {
      deps.onError?.(`enterprise skill upload ignored unknown frontmatter keys [${entry.name}: ${facts.unknownKeys.join(',')}]`, undefined)
    }
  }
  const sha256 = createHash('sha256').update(artifact.bytes).digest('hex')
  // 两个清单**先** fail-closed 读完（损坏即拒），再动磁盘：这样「闸门/清单任一不过」都**一个字节都不落**。
  // 制品落盘因此排在闸门与清单读取之后（比方案 §B.1 的步骤 5/6 顺序更保守：被拒的包不进制品缓存）。
  const selfRecords = await readSelfInstalledRecords(options)
  const enterpriseRecords = await readInstalledSkillRecords(options)
  const existing = selfRecords.find(record => record.skillId === archive.skillId)
  // 幂等（§B.1 步骤 7）：同一个包再传一次不报冲突、不重写，直接回当前态。
  if (existing !== undefined && existing.sha256 === sha256) {
    const present = await Promise.all(existing.names.map(name => exists(join(skillRoot(deps), name, SKILL_CONTENT_FILENAME))))
    if (present.every(Boolean)) return await installedSkillStatus(options)
  }
  await storeUploadedArtifact(deps, sha256, artifact.bytes)

  // 落点冲突预检的判据是「企业记录 ∪ 自装记录 − 自己」（Lead 冻结；`docs/plan/cherry-skill-add-port.md` §2
  // 把它列在「三条绝不移」里）：企业包占用同名 → 拒；**别的**自装包占用同名 → 拒；本包旧版本才可原地替换。
  const ownedElsewhere = new Set<string>([
    ...enterpriseRecords.flatMap(record => [...record.names]),
    ...selfRecords
      .filter(record => record.skillId !== archive.skillId)
      .flatMap(record => [...record.names]),
  ])
  const ownNames = new Set(existing?.names ?? [])
  const displayName = archive.displayName ?? archive.skills[0]!.name
  await placeEnterpriseSkillArchive(options, {
    archive,
    ownNames,
    ownedElsewhere,
    failureCode: 'ENT_SKILL_UPLOAD_FAILED',
    commit: async () => {
      const record: SelfInstalledSkillRecord = {
        skillId: archive.skillId,
        displayName,
        sha256,
        names: archive.skills.map(entry => entry.name),
        installedAt: deps.now().toISOString(),
        sourceType: 'upload',
        sourceInput: sanitizeSourceInput(artifact.filename),
      }
      await writeSelfInstalledRecords(deps, [...selfRecords.filter(item => item.skillId !== archive.skillId), record])
      // 同一个 skillId 重传时不再被本包引用的旧目录随之清掉（与中心安装的孤儿清理同口径）。
      // 删除走**唯一**那一处实现（`deleteOwnedSkillDirectory`：lstat 拒符号链接 + realpath 落点等式），
      // 本文件不写第二个递归删除。
      const newNames = new Set(archive.skills.map(entry => entry.name))
      for (const name of ownNames) {
        if (newNames.has(name) || ownedElsewhere.has(name)) continue
        await deleteOwnedSkillDirectory(options, name).catch((error: unknown) => {
          deps.onError?.(`enterprise skill upload left a stale directory ${name}`, error)
        })
      }
    },
  })
  // 冻结契约：响应 data 与 `POST /skills/install` 逐字同形（自装记录不在这一份里）。
  return await installedSkillStatus(options)
}
