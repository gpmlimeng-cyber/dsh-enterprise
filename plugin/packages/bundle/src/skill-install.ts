/**
 * [INPUT]: 依赖 platform-client 的 `resolveEnterpriseDshHome`（与官方 `dsh-home-paths` 同一套 `显式 → $DSH_HOME → ~/.dsh` 优先级）、plugin-distribution 的 `downloadVerifiedArtifact`（size+SHA-256 强制校验 + `.part` 原子改名）、本包的 `projectSkillEnvelope` 与 `decodeDshSkillArchive`
 * [OUTPUT]: 对外提供 `createEnterpriseSkillInstall`（`status`/`action` 两个端口）与可单测的 `installedSkillStatus`/`installSkillPackage`（首次安装与**同包新版本原子升级**同一条路）/`uninstallSkillPackage`、`SKILL_LOCAL_ROOT_SEGMENTS` 与状态文件形状
 * [POS]: bundle 技能纵深的**落盘所有者**——中心详情给出权威 `versionId`/`sha256`/技能名集合，Host 代取令牌下载并校验，再解到 `<dshHome>/enterprise/skill-staging/<uuid>` 后逐个**原子改名**进 `<dshHome>/skills/`；本机已装**同一个 packageId 的旧版本**时同一条路就是**原子升级**（旧目录先挪到 `<staging>-previous/<name>` 备份位、新目录再改名到位、失败原样挪回、成功后清掉旧版本孤儿目录），落点冲突预检只拒「同名目录被**别的包**占用」与「同名目录存在但不在本包记录里」，绝不就地半覆盖；这条路径正是官方 `dsh-skill-filesystem` 的 `user-dsh` 根（rank 400），watcher 深度 1 直发现，因此装完无需重启。官方 0.2.0-rc.2 全量核对后**不存在** skills 安装 RPC（`docs/compose/spec/skill-catalog.md` S2.1 已冻结同一结论），故这里落盘不违背「复用官方能力」：官方对技能的唯一能力面就是这套发现契约，本文件只写它承认的形状，且不执行包内任何内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { downloadVerifiedArtifact } from '@dshent/plugin-distribution'
import { decodeDshSkillArchive, SKILL_ARCHIVE_MAX_BYTES } from './skill-archive.js'
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

/** bundle 注入 platform-client 的两个端口形状。 */
export interface EnterpriseSkillInstall {
  /** 已装技能清单。 */
  status(): Promise<EnterpriseInstalledSkills>
  /** 安装或卸载；两者都返回**动作后**的最新已装态。 */
  action(action: 'install' | 'uninstall', packageId: string): Promise<EnterpriseInstalledSkills>
}

/**
 * 构造技能安装端口（供 `registerEnterpriseLocalApi` 的 `skillStatus`/`skillAction` 注入）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口。
 * @returns 两个端口的实现。
 */
export function createEnterpriseSkillInstall(options: EnterpriseSkillInstallOptions): EnterpriseSkillInstall {
  return {
    status: () => installedSkillStatus(options),
    action: (action, packageId) => action === 'install'
      ? installSkillPackage(options, packageId)
      : uninstallSkillPackage(options, packageId),
  }
}
