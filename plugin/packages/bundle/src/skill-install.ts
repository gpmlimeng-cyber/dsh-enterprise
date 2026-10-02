/**
 * [INPUT]: 依赖 platform-client 的 `resolveEnterpriseDshHome`（与官方 `dsh-home-paths` 同一套 `显式 → $DSH_HOME → ~/.dsh` 优先级）、plugin-distribution 的 `downloadVerifiedArtifact`（size+SHA-256 强制校验 + `.part` 原子改名）、本包的 `projectSkillEnvelope` 与 `decodeDshSkillArchive`
 * [OUTPUT]: 对外提供 `createEnterpriseSkillInstall`（`status`/`action`/**`content`/`files`/`file`** 五个端口）与可单测的 `installedSkillStatus`/`installSkillPackage`（首次安装与**同包新版本原子升级**同一条路）/`uninstallSkillPackage`/**`installedSkillContent`**（读一条已装技能的 SKILL.md 正文）/**`installedSkillFiles`**（列一条已装技能包在本机真树上的全部条目）/**`installedSkillFile`**（读已装技能里的文本文件），以及三者**共用**的路径实现 **`requireRelativeSkillPath`**（唯一的相对路径门禁）与 **`resolveInstalledSkillTarget`**（唯一的落点解析：记录归属 + `lstat` + `realpath` 三重等式 + 256 KiB 上限）、`SKILL_LOCAL_ROOT_SEGMENTS`/`SKILL_CONTENT_FILENAME`/`SKILL_FILE_MAX_ENTRIES`/`SKILL_FILE_MAX_DEPTH` 与状态文件形状
 * [POS]: bundle 技能纵深的**落盘所有者**——中心详情给出权威 `versionId`/`sha256`/技能名集合，Host 代取令牌下载并校验，再解到 `<dshHome>/enterprise/skill-staging/<uuid>` 后逐个**原子改名**进 `<dshHome>/skills/`；本机已装**同一个 packageId 的旧版本**时同一条路就是**原子升级**（旧目录先挪到 `<staging>-previous/<name>` 备份位、新目录再改名到位、失败原样挪回、成功后清掉旧版本孤儿目录），落点冲突预检只拒「同名目录被**别的包**占用」与「同名目录存在但不在本包记录里」，绝不就地半覆盖；这条路径正是官方 `dsh-skill-filesystem` 的 `user-dsh` 根（rank 400），watcher 深度 1 直发现，因此装完无需重启。官方 0.2.0-rc.2 全量核对后**不存在** skills 安装 RPC（`docs/compose/spec/skill-catalog.md` S2.1 已冻结同一结论），故这里落盘不违背「复用官方能力」：官方对技能的唯一能力面就是这套发现契约，本文件只写它承认的形状，且不执行包内任何内容。**另加一条只读家族（三个入口）**：技能详情子页面要读**已装**技能的本机文件——① `/skills/content` 读 `SKILL.md` 正文、② `/skills/<id>/files` 列本机真树、③ `/skills/<id>/file?path=` 读单个文本文件；客户端交来的永远只是**键形状**（包 id 雪花、相对路径），三者**共用同一份 `requireRelativeSkillPath` + `resolveInstalledSkillTarget` + 文本读取**：名字必须命中本包已装记录、落点由 Host 自己拼，再经 `lstat`（不跟随符号链接）+ `realpath` 逐字比对挡住符号链接逃逸，单文件复用包内 SKILL.md 的 256 KiB 上限，二进制（非法 UTF-8 或夹 NUL）按稳定码拒而不是丢进界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { downloadVerifiedArtifact } from '@dshent/plugin-distribution'
import { decodeDshSkillArchive, SKILL_ARCHIVE_MAX_BYTES, SKILL_MD_MAX_BYTES } from './skill-archive.js'
import { EnterpriseSkillInstallError, skillInstallError } from './skill-errors.js'
import { ENTERPRISE_SKILLS_LIST_PATH, projectSkillEnvelope } from './skill-route.js'

/** 官方技能**用户级**根在 `<dshHome>` 下的子目录名（`dsh-skill-filesystem` 的 `user-dsh` 根，rank 400）。 */
export const SKILL_LOCAL_ROOT_SEGMENTS = ['skills'] as const
/** 技能安装的私有状态与暂存区，统一挂在 `<dshHome>/enterprise/` 下（与 device.json / artifact 缓存同级）。 */
const SKILL_INSTALL_DIR_SEGMENTS = ['enterprise', 'skill-installs'] as const
const SKILL_ARTIFACT_DIR_SEGMENTS = ['enterprise', 'skill-artifacts'] as const
const SKILL_STAGING_DIR_SEGMENTS = ['enterprise', 'skill-staging'] as const
/** 已装清单文件名；与落盘技能同级目录但**不在**技能根内，因此不会出现在 watcher 的发现面。 */
const SKILL_STATE_FILENAME = 'installed.json'

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PACKAGE_ID_PATTERN = /^[1-9][0-9]{0,18}$/
const SKILL_PACKAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
/** 上游与本包错误码的受控形状；只有它认识的 code 才允许穿透到响应体。 */
const ERROR_CODE_PATTERN = /^ENT_[A-Z0-9_]{2,61}$/
const MAX_SKILLS_PER_PACKAGE = 200
const MAX_DISPLAY_NAME_LENGTH = 120

/** 代取令牌所需的最小平台面；`EnterprisePlatformService` 结构性满足它。 */
export interface EnterpriseSkillInstallPlatformPort {
  request(input: string, init?: RequestInit): Promise<Response>
}

/** 一条已落盘的技能包记录；只保存脱敏事实，不保存 SKILL.md 正文。 */
export interface InstalledSkillRecord {
  readonly packageId: string
  readonly skillId: string
  readonly displayName: string
  readonly versionId: string
  readonly sha256: string
  /** 本包落盘的技能目录名；**一律按 kebab 规约重新校验后才用于拼路径**。 */
  readonly names: readonly string[]
  readonly installedAt: string
}

/** `GET /enterprise/api/v1/local/skills/installed` 的本地投影。 */
export interface EnterpriseInstalledSkills {
  readonly skills: readonly InstalledSkillRecord[]
}

export interface EnterpriseSkillInstallOptions {
  readonly platform: EnterpriseSkillInstallPlatformPort
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  readonly now?: () => Date
  /** 判定点留痕；组合层接到 Host logger。 */
  readonly onError?: (message: string, error: unknown) => void
}

/** 读 `error.code`：只认受控 `ENT_*` 形状，Node 的 `Z_DATA_ERROR`/`ENOENT` 等内码不得穿透到响应体。 */
function upstreamCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && ERROR_CODE_PATTERN.test(code) ? code : undefined
}

function badRequest(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', message)
}

function requirePackageId(value: string): string {
  if (typeof value !== 'string' || !PACKAGE_ID_PATTERN.test(value)) throw badRequest('packageId must be a snowflake id')
  return value
}

function requireSkillName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || !SKILL_NAME_PATTERN.test(value)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'installed skill name is invalid')
  }
  return value
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

/** 中心详情里安装真正需要的几个事实；其余字段（描述、frontmatter 投影）一律不进落盘路径。 */
interface SkillDetailFacts {
  readonly skillId: string
  readonly displayName: string
  readonly versionId: string
  readonly sha256: string
  readonly sizeBytes: number
  readonly names: readonly string[]
}

function readSkillDetail(value: unknown, packageId: string): SkillDetailFacts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_PACKAGE_MISMATCH', 'skill detail is not an object')
  }
  const row = value as Record<string, unknown>
  const skillId = row['skillId']
  const displayName = row['displayName']
  const versionId = row['versionId']
  const sha256 = row['sha256']
  const sizeBytes = row['sizeBytes']
  const skills = row['skills']
  if (row['id'] !== packageId
    || typeof skillId !== 'string' || skillId.length > 128 || !SKILL_PACKAGE_REF_PATTERN.test(skillId)
    || typeof displayName !== 'string' || displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_LENGTH
    || typeof versionId !== 'string' || !PACKAGE_ID_PATTERN.test(versionId)
    || typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)
    || typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes)
    || sizeBytes <= 0 || sizeBytes > SKILL_ARCHIVE_MAX_BYTES
    || !Array.isArray(skills) || skills.length === 0 || skills.length > MAX_SKILLS_PER_PACKAGE) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_PACKAGE_MISMATCH', 'skill detail is not installable')
  }
  const names: string[] = []
  for (const entry of skills) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_PACKAGE_MISMATCH', 'skill detail entry is not an object')
    }
    const name = (entry as Record<string, unknown>)['name']
    if (typeof name !== 'string' || name.length === 0 || name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_PACKAGE_MISMATCH', 'skill detail entry name is invalid')
    }
    if (names.includes(name)) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_PACKAGE_MISMATCH', 'skill detail has duplicate entries')
    }
    names.push(name)
  }
  return { skillId, displayName, versionId, sha256, sizeBytes, names }
}

/**
 * 代取中心详情。
 *
 * 上游失败**原样穿透**：平台 Service 已把非 2xx 折叠成带受控 `code` 的 `EnterprisePlatformError`
 * （401 会话过期、403 不可见/已退休），platform-client 的路由投影表据此给出正确状态码；
 * 包成新的失败反而会丢掉这些可操作原因。
 */
async function fetchSkillDetail(deps: ResolvedDependencies, packageId: string): Promise<SkillDetailFacts> {
  const response = await deps.platform.request(`${ENTERPRISE_SKILLS_LIST_PATH}/${packageId}`, {
    headers: { accept: 'application/json' },
    method: 'GET',
    redirect: 'error',
  })
  if (!response.ok) {
    throw new EnterpriseSkillInstallError(
      'ENT_PLATFORM_UNAVAILABLE',
      'enterprise skills upstream refused the skill detail request',
    )
  }
  return readSkillDetail(projectSkillEnvelope(await response.json()), packageId)
}

interface ResolvedDependencies {
  readonly platform: EnterpriseSkillInstallPlatformPort
  readonly dshHome: string
  readonly now: () => Date
  readonly onError: ((message: string, error: unknown) => void) | undefined
}

function resolveDependencies(options: EnterpriseSkillInstallOptions): ResolvedDependencies {
  return {
    platform: options.platform,
    dshHome: resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    now: options.now ?? (() => new Date()),
    onError: options.onError,
  }
}

/** 技能落盘根：官方 `skill-filesystem` 的 `user-dsh` 根。 */
function skillRoot(deps: ResolvedDependencies): string {
  return join(deps.dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS)
}

function skillStatePath(deps: ResolvedDependencies): string {
  return join(deps.dshHome, ...SKILL_INSTALL_DIR_SEGMENTS, SKILL_STATE_FILENAME)
}

/** 严格读已装清单；文件不存在是合法空状态，损坏一律 fail-closed 而不是当成空清单覆盖。 */
async function readRecords(deps: ResolvedDependencies): Promise<InstalledSkillRecord[]> {
  let text: string
  try {
    text = await readFile(skillStatePath(deps), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw skillInstallError(error, 'ENT_SKILL_STATE_INVALID', 'installed skill state could not be read')
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'installed skill state is not valid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'records'
    || !Array.isArray((value as { records?: unknown }).records)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'installed skill state has an invalid shape')
  }
  const records: InstalledSkillRecord[] = []
  for (const item of (value as { records: unknown[] }).records) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'installed skill record is not an object')
    }
    const row = item as Record<string, unknown>
    const names = row['names']
    if (Object.keys(row).sort().join(',') !== 'displayName,installedAt,names,packageId,sha256,skillId,versionId'
      || typeof row['packageId'] !== 'string' || !PACKAGE_ID_PATTERN.test(row['packageId'])
      || typeof row['skillId'] !== 'string' || row['skillId'].length > 128 || !SKILL_PACKAGE_REF_PATTERN.test(row['skillId'])
      || typeof row['displayName'] !== 'string' || row['displayName'].length > MAX_DISPLAY_NAME_LENGTH
      || typeof row['versionId'] !== 'string' || !PACKAGE_ID_PATTERN.test(row['versionId'])
      || typeof row['sha256'] !== 'string' || !SHA256_PATTERN.test(row['sha256'])
      || typeof row['installedAt'] !== 'string' || !Number.isFinite(Date.parse(row['installedAt']))
      || !Array.isArray(names) || names.length === 0 || names.length > MAX_SKILLS_PER_PACKAGE) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'installed skill record has invalid fields')
    }
    records.push({
      packageId: row['packageId'],
      skillId: row['skillId'],
      displayName: row['displayName'],
      versionId: row['versionId'],
      sha256: row['sha256'],
      // 状态文件是磁盘输入：先用 kebab 规约重新收窄，才允许它参与任何路径构造。
      names: names.map(requireSkillName),
      installedAt: row['installedAt'],
    })
  }
  return records
}

/** 原子写已装清单：同目录临时件 + rename（与 platform-client 的 installation 同一套纪律）。 */
async function writeRecords(deps: ResolvedDependencies, records: readonly InstalledSkillRecord[]): Promise<void> {
  const path = skillStatePath(deps)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(temporary, JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw skillInstallError(error, 'ENT_SKILL_STATE_INVALID', 'installed skill state could not be written')
  }
}

/**
 * 读当前已装技能：状态文件里每条的技能目录都必须仍然存在，任何缺失都视为「未装」而不是回显假已装态。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @returns 仍然完整落盘的记录（顺序与状态文件一致）。
 */
export async function installedSkillStatus(
  options: EnterpriseSkillInstallOptions,
): Promise<EnterpriseInstalledSkills> {
  return await statusOf(resolveDependencies(options))
}

/** 已解析依赖上的同一份已装态实现，供动作完成后复用而不重算 dshHome。 */
async function statusOf(deps: ResolvedDependencies): Promise<EnterpriseInstalledSkills> {
  const records = await readRecords(deps)
  const root = skillRoot(deps)
  const skills: InstalledSkillRecord[] = []
  for (const record of records) {
    const present = await Promise.all(record.names.map(name => exists(join(root, name, 'SKILL.md'))))
    if (present.every(Boolean)) skills.push(record)
  }
  return { skills }
}

/**
 * 一键安装一个企业技能包；本机已装**同一个 packageId 的旧版本**时，这一步就是**原子升级**。
 *
 * 严格顺序（任一步失败都不改变磁盘上的既有技能）：详情取权威 `sha256`/`sizeBytes`/技能名集合 →
 * 代取令牌下载到 `.part` 并强制校验 size+SHA-256 → 解包（解压前路径逃逸/符号链接门禁）→
 * 包契约与详情逐项对齐 → 落点冲突预检（只拒**别的包**占用与来路不明的同名目录）→ 解到暂存区 →
 * 本包旧目录先整体挪到备份位、暂存目录再逐个原子改名进官方技能根 → 原子写状态文件 →
 * 清掉旧版本不再引用的孤儿目录；任何中途失败都把新目录撤掉、旧目录挪回原位。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param packageId - 中心技能包雪花 id（对应「技能」tab 行上的 `id`）。
 * @returns 安装后的最新已装态。
 * @throws {EnterpriseSkillInstallError} 下载/大小/hash/包契约/落点冲突/状态文件失败。
 */
export async function installSkillPackage(
  options: EnterpriseSkillInstallOptions,
  packageId: string,
): Promise<EnterpriseInstalledSkills> {
  const deps = resolveDependencies(options)
  const id = requirePackageId(packageId)
  const detail = await fetchSkillDetail(deps, id)

  const artifactPath = await downloadVerifiedArtifact({
    platform: deps.platform,
    downloadUrl: `${ENTERPRISE_SKILLS_LIST_PATH}/versions/${detail.versionId}/download`,
    sizeBytes: detail.sizeBytes,
    sha256: detail.sha256,
    directory: join(deps.dshHome, ...SKILL_ARTIFACT_DIR_SEGMENTS),
    extension: '.dshskill',
    accept: 'application/vnd.dsh.skill+zip',
    failure: (kind, message, cause) => {
      // 上游受控码（如 ENT_SKILL_VISIBILITY_DENIED）与本包既有码一律原样穿透，其余归到下载失败族。
      const upstream = upstreamCode(cause)
      if (cause instanceof Error && upstream !== undefined) return cause
      const code = kind === 'size' ? 'ENT_SKILL_SIZE_MISMATCH'
        : kind === 'hash' ? 'ENT_SKILL_HASH_MISMATCH'
          : 'ENT_SKILL_DOWNLOAD_FAILED'
      return cause === undefined
        ? new EnterpriseSkillInstallError(code, message)
        : new EnterpriseSkillInstallError(code, message, { cause })
    },
  })

  const bytes = await readFile(artifactPath)
  if (bytes.byteLength !== detail.sizeBytes) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_SIZE_MISMATCH', 'downloaded skill artifact changed size')
  }
  const archive = decodeDshSkillArchive(bytes)
  const archiveNames = archive.skills.map(entry => entry.name).sort().join(',')
  const detailNames = [...detail.names].sort().join(',')
  if (archive.skillId !== detail.skillId || archiveNames !== detailNames) {
    throw new EnterpriseSkillInstallError(
      'ENT_SKILL_PACKAGE_MISMATCH',
      'skill artifact does not match the published detail',
    )
  }

  const records = await readRecords(deps)
  const root = skillRoot(deps)
  // 同 sha256 且文件仍在即幂等成功：重复点「安装」不应报冲突，也不应重下或重写。
  const existing = records.find(record => record.packageId === id)
  if (existing !== undefined && existing.sha256 === detail.sha256) {
    const present = await Promise.all(existing.names.map(name => exists(join(root, name, 'SKILL.md'))))
    if (present.every(Boolean)) return await statusOf(deps)
  }
  await mkdir(root, { recursive: true, mode: 0o700 })
  const ownedElsewhere = new Set(records
    .filter(record => record.packageId !== id)
    .flatMap(record => [...record.names]))
  // 本包**自己**旧版本落下的技能目录：升级时由本包原地替换，不算落点冲突。
  const ownNames = new Set(existing?.names ?? [])
  for (const entry of archive.skills) {
    // 判据一：同名技能目录被**别的包**占用 → 拒绝（两个包的清单会各自指向不同内容，绝不覆盖）。
    if (ownedElsewhere.has(entry.name)) {
      throw new EnterpriseSkillInstallError(
        'ENT_SKILL_NAME_CONFLICT',
        `a skill directory named ${entry.name} is owned by another package`,
      )
    }
    // 判据二：同名目录存在但**不在本包记录里**（用户手工放的技能、或清单与磁盘不一致的残留）→ 一律拒绝，
    // 绝不拿它当「可以覆盖的旧版本」。本包记录里的同名目录才允许走下面的原子升级替换。
    if (!ownNames.has(entry.name) && await exists(join(root, entry.name))) {
      throw new EnterpriseSkillInstallError(
        'ENT_SKILL_NAME_CONFLICT',
        `a skill directory named ${entry.name} already exists`,
      )
    }
  }

  const staging = join(deps.dshHome, ...SKILL_STAGING_DIR_SEGMENTS, randomUUID())
  // 升级时本包旧目录的暂存位（与 staging 同父目录：同文件系统 rename 才原子，且 finally 一并清干净）。
  const backup = `${staging}-previous`
  const placed: string[] = []
  const replaced: { readonly name: string, readonly aside: string }[] = []
  try {
    await mkdir(staging, { recursive: true, mode: 0o700 })
    for (const entry of archive.skills) {
      const directory = join(staging, entry.name)
      for (const file of entry.files) {
        const target = join(directory, file.path)
        await mkdir(dirname(target), { recursive: true, mode: 0o700 })
        await writeFile(target, file.bytes, { mode: 0o600 })
      }
    }
    // 技能目录逐个原子改名：跨目录同文件系统 rename 是原子的，watcher 只会看到完整目录。
    // 升级（同名目录属于本包旧版本）时先把旧目录整体挪到备份位再放新目录——`rename` 不允许覆盖非空目录，
    // 也绝不能做「就地半覆盖」；挪走 → 放新 → 失败挪回，全程每一步都可回滚。
    for (const entry of archive.skills) {
      const target = join(root, entry.name)
      if (ownNames.has(entry.name) && await exists(target)) {
        const aside = join(backup, entry.name)
        await mkdir(backup, { recursive: true, mode: 0o700 })
        await rename(target, aside)
        replaced.push({ name: entry.name, aside })
      }
      await rename(join(staging, entry.name), join(root, entry.name))
      placed.push(entry.name)
    }
    const record: InstalledSkillRecord = {
      packageId: id,
      skillId: detail.skillId,
      displayName: detail.displayName,
      versionId: detail.versionId,
      sha256: detail.sha256,
      names: archive.skills.map(entry => entry.name),
      installedAt: deps.now().toISOString(),
    }
    await writeRecords(deps, [...records.filter(item => item.packageId !== id), record])
    // 清单已指向新版本：旧版本里不再被本包引用、也不被别的包引用的目录随之清掉，不留孤儿技能目录。
    const newNames = new Set(archive.skills.map(entry => entry.name))
    for (const name of ownNames) {
      if (newNames.has(name) || ownedElsewhere.has(name)) continue
      await rm(join(root, name), { force: true, recursive: true }).catch((error: unknown) => {
        // 清单已更新、装是成功的：孤儿目录清理失败只留痕，不把一次成功的升级报成失败。
        deps.onError?.(`enterprise skill upgrade left a stale directory ${name}`, error)
      })
    }
  } catch (error) {
    // 任何中途失败都回到动作前的磁盘状态：先撤掉本次放上的新目录，再把挪走的旧目录挪回原位。
    for (const name of placed) await rm(join(root, name), { force: true, recursive: true }).catch(() => undefined)
    for (const item of replaced) await rename(item.aside, join(root, item.name)).catch(() => undefined)
    throw skillInstallError(error, 'ENT_SKILL_INSTALL_FAILED', 'skill package could not be installed')
  } finally {
    await rm(staging, { force: true, recursive: true }).catch(() => undefined)
    await rm(backup, { force: true, recursive: true }).catch(() => undefined)
  }

  const status = await statusOf(deps)
  return status
}

/**
 * 卸载一个已装技能包：只删本包独占的技能目录，被别的包引用的同名目录一律保留。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param packageId - 要卸载的中心技能包雪花 id。
 * @returns 卸载后的最新已装态。
 * @throws {EnterpriseSkillInstallError} `ENT_RESOURCE_NOT_FOUND` 表示本机没有这个包的记录。
 */
export async function uninstallSkillPackage(
  options: EnterpriseSkillInstallOptions,
  packageId: string,
): Promise<EnterpriseInstalledSkills> {
  const deps = resolveDependencies(options)
  const id = requirePackageId(packageId)
  const records = await readRecords(deps)
  const record = records.find(item => item.packageId === id)
  if (record === undefined) {
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill package is not installed')
  }
  const shared = new Set(records
    .filter(item => item.packageId !== id)
    .flatMap(item => [...item.names]))
  const root = skillRoot(deps)
  for (const name of record.names) {
    if (shared.has(name)) continue
    await rm(join(root, name), { force: true, recursive: true }).catch((error: unknown) => {
      throw skillInstallError(error, 'ENT_SKILL_INSTALL_FAILED', 'installed skill directory could not be removed')
    })
  }
  await writeRecords(deps, records.filter(item => item.packageId !== id))
  return await statusOf(deps)
}

/**
 * 已装技能的正文文件名：官方 `skill-filesystem` 的发现面约定（`skills/<name>/SKILL.md`），
 * 同时是技能详情子页面**默认选中并预览**的那个文件（界面把已装记录的 `names[0]` 与它拼成默认路径）。
 */
export const SKILL_CONTENT_FILENAME = 'SKILL.md'

/** 相对路径总长上限（与包内制品路径上限 `SKILL_PATH_MAX_LENGTH` 同量级）。 */
const SKILL_FILE_PATH_MAX_LENGTH = 1024
/** 单段路径长度上限（多数文件系统的 NAME_MAX）。 */
const SKILL_FILE_SEGMENT_MAX_LENGTH = 255
/**
 * 一个已装技能包的**文件树条目数上限**：目录是磁盘输入，病态目录不该把响应体撑爆；
 * 超限复用既有的 `ENT_SKILL_CONTENT_TOO_LARGE`（413，与单文件超限同一族），不新增码。
 */
export const SKILL_FILE_MAX_ENTRIES = 1000
/** 相对技能目录的**嵌套深度上限**：超过即判本机落盘状态可疑（409），不给深目录留口子。 */
export const SKILL_FILE_MAX_DEPTH = 8

/** `GET /enterprise/api/v1/local/skills/<id>/files` 的一条**本机真实**条目。 */
export interface EnterpriseSkillFileEntry {
  /** 相对 `<dshHome>/skills` 的 `/` 分隔路径（目录不带尾斜杠）。 */
  readonly path: string
  readonly kind: 'file' | 'directory'
  /** 普通文件的真实字节数；目录恒 0（键集对三种消费者统一，界面不必分叉判形状）。 */
  readonly sizeBytes: number
}

/** `GET .../skills/<id>/files` 的本地投影（树来自本机真目录，未装即 404，绝不编造）。 */
export interface EnterpriseSkillFiles {
  readonly packageId: string
  /** 按 `path` 码元升序**确定性**排序（同一棵树两次请求逐字节相同）。 */
  readonly entries: readonly EnterpriseSkillFileEntry[]
}

/** `GET .../skills/<id>/file?path=` 的本地投影：**纯文本**约定（二进制一律拒，见 `readInstalledSkillText`）。 */
export interface EnterpriseInstalledSkillFile {
  readonly packageId: string
  readonly path: string
  readonly sizeBytes: number
  readonly text: string
}

/** `GET /enterprise/api/v1/local/skills/content` 的本地投影：一条已装技能的正文。 */
export interface EnterpriseInstalledSkillContent {
  readonly packageId: string
  readonly name: string
  readonly content: string
}

/** ENOENT 是「不在那儿」而不是故障：路径收窄时用它区分 404 与真正的 I/O 失败。 */
async function realpathOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the installed skill path could not be resolved')
  }
}

/**
 * **三个只读入口共用的相对路径门禁**（`/skills/content` 的 `name`、`/skills/<id>/file` 的 `path`、
 * 以及文件树里每一条路径的形状判定都只经它，路由层与界面层**不许再写第二套**）：
 *  ① 非字符串 / 空串 / 超过 1024 字 → 400；
 *  ② 反斜杠、以 `/` 开头、盘符开头（`C:`）→ 400（Windows 形状的路径永远不是本机技能树里的合法键）；
 *  ③ 一切控制字符（含 NUL，`<0x20` 与 `0x7f`）→ 400；
 *  ④ **URL 编码绕过**：查询串只 `decode` 一次，解码之后仍出现 `%` 说明请求方在二次编码
 *     （`%252e%252e` → `%2e%2e`）或文件名本身需要编码——两种都 fail-closed 拒掉，而不是「再解一次看看」；
 *     界面发送时用 `encodeURIComponent`，因此**正常路径解码后不含 `%`**；
 *  ⑤ 空段、`.`、`..` 段 → 400（规范化在这一步就完成，后面拼路径只吃已验证的段）；
 *  ⑥ 单段 >255、总长 >1024 → 400；
 *  ⑦ 首段必须是官方 kebab 技能目录名且 ≤64——「哪个技能目录」永远只能取本包已装记录里的键形状。
 *
 * @param value - 客户端交来的相对路径（`/` 分隔，**已由路由解码一次**）。
 * @returns 已验证的段数组（顺序原样）。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`：任一条不满足。
 */
export function requireRelativeSkillPath(value: unknown): readonly string[] {
  if (typeof value !== 'string' || value.length === 0 || value.length > SKILL_FILE_PATH_MAX_LENGTH) {
    throw badRequest('path must be a relative skill file path')
  }
  if (value.includes('\\')) throw badRequest('path must use forward slashes')
  if (value.startsWith('/')) throw badRequest('path must be relative')
  if (/^[A-Za-z]:/.test(value)) throw badRequest('path must not start with a drive letter')
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) throw badRequest('path must not contain control characters')
  }
  const segments = value.split('/')
  for (const segment of segments) {
    if (segment.length === 0) throw badRequest('path must not contain empty segments')
    if (segment === '.' || segment === '..') throw badRequest('path must not escape the skill directory')
    if (segment.length > SKILL_FILE_SEGMENT_MAX_LENGTH) throw badRequest('path segment is too long')
    if (segment.includes('%')) throw badRequest('path must not contain percent-encoded segments')
  }
  const skill = segments[0]!
  if (skill.length > 64 || !SKILL_NAME_PATTERN.test(skill)) {
    throw badRequest('path must start with a kebab-case skill directory name')
  }
  return segments
}

/**
 * `/skills/content` 的 `name` 参数契约：**仍是同一份门禁**，只额外要求恰好一段
 * （那个参数语义上是技能目录名而不是路径；两段以上在拼路径之前就拒，避免把路径语义悄悄带进来）。
 *
 * @param value - 客户端交来的技能目录名。
 * @returns 已验证的技能目录名。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`：形状非法或不是恰好一段。
 */
function requireSkillNameArgument(value: unknown): string {
  const segments = requireRelativeSkillPath(value)
  if (segments.length !== 1) throw badRequest('name must be a single kebab-case skill directory name')
  return segments[0]!
}

/** 已装技能包在磁盘上的根（记录 + 真实技能根），三个只读入口共用的第一层。 */
interface ResolvedSkillRoot {
  readonly packageId: string
  readonly record: InstalledSkillRecord
  /** `<dshHome>/skills`（未规范化，用于拼落点）。 */
  readonly root: string
  /** `realpath(<dshHome>/skills)`：下面一切落点等式都以它为准。 */
  readonly resolvedRoot: string
}

/** 解析「本包已装记录 + 真实技能根」；三者共用，故包未装 / 技能根不在都只有这一处判定。 */
async function resolveInstalledSkillRoot(
  deps: ResolvedDependencies,
  packageId: string,
): Promise<ResolvedSkillRoot> {
  const id = requirePackageId(packageId)
  const record = (await readRecords(deps)).find(item => item.packageId === id)
  if (record === undefined) {
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill package is not installed')
  }
  const root = skillRoot(deps)
  const resolvedRoot = await realpathOrUndefined(root)
  if (resolvedRoot === undefined) {
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'the installed skill root is missing')
  }
  return { packageId: id, record, root, resolvedRoot }
}

/** 已落盘的一个技能目录（记录里的名字 + 真实目录），三个只读入口共用的第二层。 */
interface ResolvedSkillDirectory {
  readonly packageId: string
  readonly skillName: string
  /** `<dshHome>/skills/<name>`（未规范化）。 */
  readonly absolutePath: string
  /** `realpath` 之后必须逐字等于它的那个落点。 */
  readonly resolvedDirectory: string
}

/**
 * 把一个技能目录解析成**已落盘的真实目录**：名字必须属于本包记录；目录必须真的存在、
 * 是普通目录（`lstat` 不跟随符号链接），且 `realpath` 逐字等于 `<真实技能根>/<name>`。
 */
async function resolveSkillDirectoryFromRoot(
  deps: ResolvedDependencies,
  base: ResolvedSkillRoot,
  skillName: string,
): Promise<ResolvedSkillDirectory> {
  // 名字只能来自**本包自己的已装记录**：不在记录里的名字按未找到处理，不做任何路径尝试。
  if (!base.record.names.includes(skillName)) {
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill does not belong to the installed package')
  }
  const absolutePath = join(base.root, skillName)
  const resolvedDirectory = join(base.resolvedRoot, skillName)
  let stats
  try {
    // lstat 不跟随符号链接：技能目录本身是符号链接即拒（下面那条 realpath 等式也会兜住）。
    stats = await lstat(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'the installed skill directory is missing')
    }
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the installed skill directory could not be inspected')
  }
  if (!stats.isDirectory()) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill path is not a directory')
  }
  const resolved = await realpathOrUndefined(absolutePath)
  if (resolved !== resolvedDirectory) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill directory escapes its skill root')
  }
  return { packageId: base.packageId, skillName, absolutePath, resolvedDirectory }
}

/** 一个已落盘、且已通过全部等式的技能文件（三个只读入口共用的第三层）。 */
export interface ResolvedSkillTarget {
  readonly packageId: string
  readonly skillName: string
  /** 相对 `<dshHome>/skills` 的规范路径。 */
  readonly relativePath: string
  readonly absolutePath: string
  readonly resolvedPath: string
  readonly resolvedDirectory: string
  readonly sizeBytes: number
}

/**
 * **三个只读入口共用的路径解析**：包 id + 相对路径 → 一件已落盘的真实文件。
 *
 * 路径安全全在这里完成、且是 fail-closed 的（客户端给的字符串永远只是**键形状**，不是路径片段）：
 *  ① 包 id 雪花门禁 + 相对路径门禁（见 `requireRelativeSkillPath`：`..`/绝对路径/盘符/反斜杠/控制字符/
 *     空段/超长/`%` 编码绕过一律在拼任何路径之前就被拒）；
 *  ② 首段（技能目录名）必须**出现在该包自己的已装记录里**（记录来自 Host 私有状态文件，读盘时已按 kebab
 *     规约重新校验过），记录里没有的名字一律 404——绝不拿调用方的字符串去拼文件系统；
 *  ③ 技能根与技能目录各自 `realpath`，且技能目录必须**逐字等于** `<真实技能根>/<name>`；
 *  ④ 落点由 Host 自己拼成 `<技能根>/<name>/<rest...>`，`lstat` 不跟随符号链接：不是普通文件即判
 *     本机状态可疑（目录也算，`file` 路由不冒充目录清单）；
 *  ⑤ 单文件大小上限复用包内 SKILL.md 的同一条常量（256 KiB），超限 413；
 *  ⑥ `realpath` 规范化后必须**逐字等于** `<真实技能目录>/<rest...>`——技能根、技能目录、文件任何一层
 *     出现符号链接逃逸都会让这条等式不成立（宁可拒读，也不把技能目录外的文件送给界面）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param packageId - 中心技能包雪花 id。
 * @param relativePath - 相对 `<dshHome>/skills` 的 `/` 分隔路径（首段是技能目录名）。
 * @returns 已验证的落点与字节数。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`（包 id / 路径形状非法）、
 *   `ENT_RESOURCE_NOT_FOUND`（本包未装 / 名字不属于本包 / 目录或文件不在）、
 *   `ENT_SKILL_CONTENT_TOO_LARGE`（>256 KiB）、`ENT_SKILL_CONTENT_INVALID`（非普通文件 / 逃逸）。
 */
export async function resolveInstalledSkillTarget(
  options: EnterpriseSkillInstallOptions,
  packageId: string,
  relativePath: string,
): Promise<ResolvedSkillTarget> {
  const deps = resolveDependencies(options)
  const segments = requireRelativeSkillPath(relativePath)
  const skillName = segments[0]!
  const rest = segments.slice(1)
  const directory = await resolveSkillDirectoryFromRoot(deps, await resolveInstalledSkillRoot(deps, packageId), skillName)
  const absolutePath = join(directory.absolutePath, ...rest)
  const resolvedPath = join(directory.resolvedDirectory, ...rest)
  let stats
  try {
    // lstat 不跟随符号链接：文件本身是符号链接即拒，绝不让它指到技能目录之外。
    stats = await lstat(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'the installed skill file is missing')
    }
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the installed skill file could not be inspected')
  }
  if (!stats.isFile()) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill file is not a regular file')
  }
  if (stats.size > SKILL_MD_MAX_BYTES) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_TOO_LARGE', 'the installed skill file is too large')
  }
  const resolved = await realpathOrUndefined(absolutePath)
  if (resolved !== resolvedPath) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill file escapes its skill directory')
  }
  return {
    packageId: directory.packageId,
    skillName,
    relativePath: [skillName, ...rest].join('/'),
    absolutePath,
    resolvedPath,
    resolvedDirectory: directory.resolvedDirectory,
    sizeBytes: stats.size,
  }
}

/**
 * 三个只读入口共用的**文本读取**（`/skills/content`、`/skills/<id>/file` 都只经它读字节）：
 * 读字节 → 按实际字节**再查一次** 256 KiB 上限（两次调用之间被换掉的文件也带不出超限正文）→
 * UTF-8 **fatal** 解码（非法字节一律判本机状态可疑，不让替换字符悄悄进界面）→
 * 拒绝解码后的 NUL：**这是纯文本约定**，能 fatal 解码但夹 NUL 的字节（位图/压缩包常见）仍按二进制拒，
 * 界面据此显示稳定错误码（`ENT_SKILL_CONTENT_INVALID`）而不是把半截二进制当正文渲染。
 */
async function readInstalledSkillText(target: ResolvedSkillTarget): Promise<string> {
  const bytes = await readFile(target.absolutePath)
  if (bytes.byteLength > SKILL_MD_MAX_BYTES) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_TOO_LARGE', 'the installed skill file is too large')
  }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw new EnterpriseSkillInstallError(
      'ENT_SKILL_CONTENT_INVALID',
      'the installed skill file is not valid UTF-8 text',
      { cause: error },
    )
  }
  if (text.includes('\u0000')) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill file is binary, not text')
  }
  return text
}

/** 路径码元升序比较（确定性排序的唯一依据）。 */
function compareEntryPath(left: EnterpriseSkillFileEntry, right: EnterpriseSkillFileEntry): number {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

/**
 * 递归收集一个技能目录下的条目（**树来自本机真目录**，不编造）。
 *
 * 每一层都用 `readdir(withFileTypes)` 拿名字、再用 `lstat` 拿真实类型（`readdir` 的 `dirent` 不参与类型判定，
 * 避免 TOCTOU）：**任何符号链接或既非普通文件也非目录的条目一律 409**（fail-closed，不给逃逸留口子），
 * 每个子项的 `realpath` 必须逐字等于 `<已规范化的父目录>/<name>`；目录按深度上限收敛，条目按总上限收敛。
 *
 * @param absolute - 当前目录的未规范化绝对路径。
 * @param resolved - 当前目录的 `realpath`。
 * @param relative - 当前目录相对 `<dshHome>/skills` 的路径。
 * @param depth - 当前目录相对技能目录的深度（技能目录本身为 0，其子项为 1）。
 * @param entries - 收集结果（调用方负责最终排序）。
 */
async function collectSkillEntries(
  absolute: string,
  resolved: string,
  relative: string,
  depth: number,
  entries: EnterpriseSkillFileEntry[],
): Promise<void> {
  if (depth > SKILL_FILE_MAX_DEPTH) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill directory is nested too deeply')
  }
  let items
  try {
    items = await readdir(absolute, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'the installed skill directory is missing')
    }
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the installed skill directory could not be listed')
  }
  const ordered = [...items].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  for (const item of ordered) {
    if (entries.length >= SKILL_FILE_MAX_ENTRIES) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_TOO_LARGE', 'the installed skill file tree is too large')
    }
    const path = `${relative}/${item.name}`
    const childAbsolute = join(absolute, item.name)
    const childResolved = join(resolved, item.name)
    let stats
    try {
      stats = await lstat(childAbsolute)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'an installed skill entry disappeared while listing')
      }
      throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'an installed skill entry could not be inspected')
    }
    if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile())) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the installed skill tree contains a non-regular entry')
    }
    const childReal = await realpathOrUndefined(childAbsolute)
    if (childReal !== childResolved) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'an installed skill entry escapes its skill directory')
    }
    if (stats.isDirectory()) {
      entries.push({ path, kind: 'directory', sizeBytes: 0 })
      await collectSkillEntries(childAbsolute, childResolved, path, depth + 1, entries)
    } else {
      entries.push({ path, kind: 'file', sizeBytes: stats.size })
    }
  }
}

/**
 * 列出一个**已装**技能包在本机真实目录里的全部条目（只读；界面详情子页面的文件树用它）。
 *
 * 树的根是本包记录里的技能目录（`record.names`），因此只可能看见**本包自己**落盘的目录；
 * 记录的每个名字都必须真的落盘（缺失即 404：本包落盘不完整，如实说而不是给半棵树）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param packageId - 中心技能包雪花 id。
 * @returns 包 id 与按路径确定性排序的条目清单。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`（包 id 形状非法）、
 *   `ENT_RESOURCE_NOT_FOUND`（本包未装 / 技能根或技能目录不在）、
 *   `ENT_SKILL_CONTENT_TOO_LARGE`（条目数超上限）、`ENT_SKILL_CONTENT_INVALID`（符号链接 / 非常规条目 / 嵌套过深）。
 */
export async function installedSkillFiles(
  options: EnterpriseSkillInstallOptions,
  packageId: string,
): Promise<EnterpriseSkillFiles> {
  const deps = resolveDependencies(options)
  const base = await resolveInstalledSkillRoot(deps, packageId)
  const entries: EnterpriseSkillFileEntry[] = []
  for (const name of base.record.names) {
    const directory = await resolveSkillDirectoryFromRoot(deps, base, name)
    if (entries.length >= SKILL_FILE_MAX_ENTRIES) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_TOO_LARGE', 'the installed skill file tree is too large')
    }
    entries.push({ path: name, kind: 'directory', sizeBytes: 0 })
    await collectSkillEntries(directory.absolutePath, directory.resolvedDirectory, name, 1, entries)
  }
  entries.sort(compareEntryPath)
  return { packageId: base.packageId, entries }
}

/**
 * 读一条**已装**技能里的**文本**文件（只读；界面点文件树时用它）。
 *
 * 路径解析与门禁全部复用 `resolveInstalledSkillTarget`，文本读取复用 `readInstalledSkillText`——
 * 与 `/skills/content` 是同一条路，唯一差别只是路径来自文件树里的真实条目而不是技能名。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param packageId - 中心技能包雪花 id。
 * @param path - 相对 `<dshHome>/skills` 的 `/` 分隔路径（首段是技能目录名）。
 * @returns 包 id、规范路径、字节数与文本正文。
 * @throws {EnterpriseSkillInstallError} 与 `resolveInstalledSkillTarget` / `readInstalledSkillText` 同族。
 */
export async function installedSkillFile(
  options: EnterpriseSkillInstallOptions,
  packageId: string,
  path: string,
): Promise<EnterpriseInstalledSkillFile> {
  const target = await resolveInstalledSkillTarget(options, packageId, path)
  const text = await readInstalledSkillText(target)
  return { packageId: target.packageId, path: target.relativePath, sizeBytes: target.sizeBytes, text }
}

/**
 * 读一条**已装**技能的 `SKILL.md` 正文（只读，界面点技能行看详情时用它）。
 *
 * 这是与上面两条同族的第三条只读入口：`name` 只是一个**单段技能目录名**，Host 自己把它与
 * `SKILL_CONTENT_FILENAME` 拼成相对路径后，**走同一份 `resolveInstalledSkillTarget` + `readInstalledSkillText`**——
 * 路径门禁、记录归属、lstat/realpath 三重等式、256 KiB 上限、UTF-8 fatal 都是那一份实现，本函数不再自写一套。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @param packageId - 中心技能包雪花 id（对应「企业技能」行上的 `id`）。
 * @param name - 技能目录名（kebab，恰好一段）；必须属于该包已装记录。
 * @returns 包 id、技能名与该技能的 SKILL.md 正文。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`（包 id / 技能名形状非法）、
 *   `ENT_RESOURCE_NOT_FOUND`（本包未装 / 名字不属于本包 / 文件不在）、
 *   `ENT_SKILL_CONTENT_TOO_LARGE`（超 256 KiB）、`ENT_SKILL_CONTENT_INVALID`（非普通文件 / 逃逸 / 非 UTF-8）。
 */
export async function installedSkillContent(
  options: EnterpriseSkillInstallOptions,
  packageId: string,
  name: string,
): Promise<EnterpriseInstalledSkillContent> {
  const skill = requireSkillNameArgument(name)
  const target = await resolveInstalledSkillTarget(options, packageId, `${skill}/${SKILL_CONTENT_FILENAME}`)
  const content = await readInstalledSkillText(target)
  return { packageId: target.packageId, name: target.skillName, content }
}

/** bundle 注入 platform-client 的三个端口形状。 */
export interface EnterpriseSkillInstall {
  /** 已装技能清单。 */
  status(): Promise<EnterpriseInstalledSkills>
  /** 安装或卸载；两者都返回**动作后**的最新已装态。 */
  action(action: 'install' | 'uninstall', packageId: string): Promise<EnterpriseInstalledSkills>
  /** 读一条**已装**技能的 SKILL.md 正文（只读；名字必须是该包已装记录里的一个，恰好一段）。 */
  content(packageId: string, name: string): Promise<EnterpriseInstalledSkillContent>
  /** 列一条**已装**技能包在本机真树上的全部条目（只读；树根是本包自己的已装技能目录）。 */
  files(packageId: string): Promise<EnterpriseSkillFiles>
  /** 读一条**已装**技能里的文本文件（只读；与 `content` 共用同一份路径解析与文本读取）。 */
  file(packageId: string, path: string): Promise<EnterpriseInstalledSkillFile>
}

/**
 * 构造技能安装端口（供 `registerEnterpriseLocalApi` 的 `skillStatus`/`skillAction`/`skillContent`
 * 与 `registerEnterpriseSkillRoutes` 的 `local.files`/`local.file` 注入）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @returns 五个端口的实现。
 */
export function createEnterpriseSkillInstall(options: EnterpriseSkillInstallOptions): EnterpriseSkillInstall {
  return {
    status: () => installedSkillStatus(options),
    action: (action, packageId) => action === 'install'
      ? installSkillPackage(options, packageId)
      : uninstallSkillPackage(options, packageId),
    content: (packageId, name) => installedSkillContent(options, packageId, name),
    files: packageId => installedSkillFiles(options, packageId),
    file: (packageId, path) => installedSkillFile(options, packageId, path),
  }
}
