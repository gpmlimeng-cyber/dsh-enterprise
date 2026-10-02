/**
 * [INPUT]: 依赖 node:fs/path、platform-client 的 `resolveEnterpriseDshHome`、bundle.ts 的合成结果、authorization.ts 的三态查询，以及一个**可注入的安装端口** `PresetInstallPort`
 * [OUTPUT]: 对外提供安装端口契约与官方默认实现（`officialPresetInstallPort` / `presetPluginManagerFromContext` / `presetProfileDirFromContext`）、安装器 `createEnterprisePresetInstall`（幂等 + 并发拒绝 + 三态透出 + 统一结果对象 `{ok, application, installedNames, needsNewSession, errorCode?}`）、卸载与 `node_modules/<pkg>` link 残壳清理 `cleanPresetBundleLink`
 * [POS]: bundle 配方一键启用纵深的**安装段**——官方唯一安装面是 `ctx.pluginManager.installBundle(spec)`（`docs/notes/preset-approval-spike.md` §4 实证：普通 Host 插件 `inject: ['pluginManager']` 即可达，服务面**零弹层**、自带进度与取消）。本文件只把这条面**端口化**便于测试与替换：默认实现照原样转发官方服务、失败原样抛出（`cause` 保留官方错误），编排层负责稳定码、幂等、并发与 `application` 三态。卸载走官方 `removeBundle`，随后**自己**清掉官方不动的 `node_modules/<pkg>` link 残壳（spike §3⑤ 实证），且**绝不**删官方 `.plugin-manager/logs/*` 审计
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterprisePresetError, presetBadRequest, presetError } from './errors.js'
import {
  PRESET_BUNDLE_FILENAMES,
  presetBundleRoot,
  presetBundlePackageName,
  renderPresetBundle,
  synthesizePresetBundle,
  type PresetRecipe,
} from './bundle.js'
import {
  presetDisclosure,
  presetBundleSetFingerprint,
  resolvePresetAuthorization,
  type PresetDisclosure,
} from './authorization.js'

/** 本机已装记录落点（`<dshHome>/enterprise/` 下）。 */
const PRESET_INSTALL_DIR_SEGMENTS = ['enterprise', 'preset-installs'] as const
const PRESET_INSTALL_FILENAME = 'installed.json'
const DECLARATION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const HEX64_PATTERN = /^[0-9a-f]{64}$/
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const MAX_DISPLAY_NAME_LENGTH = 120

/** 官方 `ChangeResult.application` 的完整取值；**原样透出**，不由我们折叠。 */
export type PresetApplication = 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'

/** 给 UI 的三态（`hot` = 官方 `applied`；官方原值另存 `officialApplication`）。 */
export type PresetApplicationKind = 'hot' | 'restart-required' | 'other'

/** 官方安装/卸载结果的**受控投影**：只保留稳定字段，不放 pnpm 输出与宿主路径。 */
export interface PresetBundleApplication {
  readonly target: string
  readonly changed: boolean
  readonly application: PresetApplication
  readonly stage?: string
  readonly enabled?: boolean
  readonly warnings?: readonly string[]
  readonly failedAt?: 'registry' | 'spec-host'
  readonly error?: { readonly code?: string; readonly diagnostic?: string }
}

/** 注入式安装端口；默认实现直接转发官方 `ctx.pluginManager`。 */
export interface PresetInstallPort {
  installBundle(spec: string, options?: { readonly enabled?: boolean; readonly requestId?: string }): Promise<PresetBundleApplication>
  removeBundle(name: string): Promise<PresetBundleApplication>
}

/** 官方 `PluginManager` 的结构面（不 import 官方包，保持 bundle 的 peer 边界）。 */
export interface OfficialPluginManagerLike {
  installBundle(spec: string, options?: unknown): Promise<unknown>
  removeBundle(name: string): Promise<unknown>
}

const PRESET_APPLICATIONS: readonly PresetApplication[] = ['applied', 'restart-required', 'overridden', 'failed', 'cancelled']

function readApplication(value: unknown): PresetApplication {
  return typeof value === 'string' && (PRESET_APPLICATIONS as readonly string[]).includes(value)
    ? value as PresetApplication
    : 'failed'
}

function readWarnings(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const warnings = value.filter((item): item is string => typeof item === 'string')
  return warnings.length === 0 ? undefined : warnings
}

function readOfficialError(value: unknown): PresetBundleApplication['error'] {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const code = typeof row['code'] === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(row['code']) ? row['code'] : undefined
  const diagnostic = typeof row['diagnostic'] === 'string' && row['diagnostic'].length <= 512 ? row['diagnostic'] : undefined
  if (code === undefined && diagnostic === undefined) return undefined
  return { ...(code === undefined ? {} : { code }), ...(diagnostic === undefined ? {} : { diagnostic }) }
}

/** 把一个官方 `ChangeResult` 逐字段投影成 `PresetBundleApplication`（缺失字段不伪造）。 */
function projectOfficialResult(target: string, value: unknown): PresetBundleApplication {
  if (typeof value !== 'object' || value === null) {
    return { target, changed: false, application: 'failed' }
  }
  const row = value as Record<string, unknown>
  const failedAt = row['failedAt'] === 'registry' || row['failedAt'] === 'spec-host' ? row['failedAt'] : undefined
  const error = readOfficialError(row['error'])
  const warnings = readWarnings(row['warnings'])
  return {
    target: typeof row['target'] === 'string' ? row['target'] : target,
    changed: row['changed'] === true,
    application: readApplication(row['application']),
    ...(typeof row['stage'] === 'string' ? { stage: row['stage'] } : {}),
    ...(typeof row['enabled'] === 'boolean' ? { enabled: row['enabled'] } : {}),
    ...(warnings === undefined ? {} : { warnings }),
    ...(failedAt === undefined ? {} : { failedAt }),
    ...(error === undefined ? {} : { error }),
  }
}

/** 官方默认安装端口：**原样转发**，不吞任何异常（官方错误由编排层当 `cause` 保留）。 */
export function officialPresetInstallPort(manager: OfficialPluginManagerLike): PresetInstallPort {
  if (typeof manager !== 'object' || manager === null
    || typeof manager.installBundle !== 'function' || typeof manager.removeBundle !== 'function') {
    throw presetBadRequest('official plugin manager does not expose installBundle/removeBundle')
  }
  return {
    async installBundle(spec, options) {
      const result = await manager.installBundle(spec, options ?? {})
      return projectOfficialResult(spec, result)
    },
    async removeBundle(name) {
      const result = await manager.removeBundle(name)
      return projectOfficialResult(name, result)
    },
  }
}

/** 官方服务可达性：普通 Host 插件 `ctx.get('pluginManager')` 即可（spike §4 实证）。 */
export function presetPluginManagerFromContext(ctx: { get(name: string): unknown }): OfficialPluginManagerLike | undefined {
  const manager = ctx.get('pluginManager')
  if (typeof manager !== 'object' || manager === null) return undefined
  const candidate = manager as Record<string, unknown>
  if (typeof candidate['installBundle'] !== 'function' || typeof candidate['removeBundle'] !== 'function') return undefined
  return manager as OfficialPluginManagerLike
}

/** 当前 profile 目录（`profileContext.dir`）；不在 profile 启动的进程里返回 undefined。 */
export function presetProfileDirFromContext(ctx: { get(name: string): unknown }): string | undefined {
  const profile = ctx.get('profileContext')
  if (typeof profile !== 'object' || profile === null) return undefined
  const dir = (profile as Record<string, unknown>)['dir']
  return typeof dir === 'string' && dir.length > 0 ? dir : undefined
}

/** Host 组合层一行接线：`ctx.get('pluginManager')` 在就给官方安装端口，缺席即 undefined（fail-closed，不猜）。 */
export function officialPresetInstallPortFromContext(
  ctx: { get(name: string): unknown },
): PresetInstallPort | undefined {
  const manager = presetPluginManagerFromContext(ctx)
  return manager === undefined ? undefined : officialPresetInstallPort(manager)
}

/** 一条已落盘的配方安装记录；只保存脱敏事实，不保存配方正文。 */
export interface InstalledPresetRecord {
  readonly declarationId: string
  readonly recipeId: string
  readonly displayName: string
  readonly packageName: string
  readonly bundleDir: string
  readonly fingerprint: string
  readonly version: string
  readonly installedAt: string
  readonly officialApplication: PresetApplication
}

export interface PresetInstallStateOptions {
  readonly dshHome?: string
  readonly env?: NodeJS.ProcessEnv
}

export interface EnterprisePresetInstallOptions extends PresetInstallStateOptions {
  readonly port: PresetInstallPort
  /** 目标 profile 目录（`node_modules` 的父目录）；Host 侧用 `presetProfileDirFromContext(ctx)`。 */
  readonly profileDir: string
  readonly now?: () => Date
  readonly onError?: (message: string, error: unknown) => void
}

export interface EnterprisePresetEnableResult {
  readonly ok: boolean
  readonly application: PresetApplicationKind
  readonly officialApplication?: PresetApplication
  readonly installedNames: readonly string[]
  readonly needsNewSession: boolean
  readonly errorCode?: EnterprisePresetError['code']
  readonly declarationId?: string
  readonly rowId?: string
  readonly bundleDir?: string
  readonly fingerprint?: string
  readonly disclosure?: PresetDisclosure
  readonly alreadyInstalled?: boolean
  readonly officialError?: { readonly code?: string }
  readonly warnings?: readonly string[]
}

export interface EnterprisePresetDisableResult {
  readonly ok: boolean
  readonly application: PresetApplicationKind
  readonly officialApplication?: PresetApplication
  readonly declarationId: string
  readonly removedNames: readonly string[]
  readonly linkRemoved: boolean
  readonly errorCode?: EnterprisePresetError['code']
  readonly warnings?: readonly string[]
}

export interface EnterprisePresetInstallStatus {
  readonly installs: readonly InstalledPresetRecord[]
  readonly busy: readonly string[]
}

/** 安装器：同一实例内做「重复点不重装、进行中拒绝、失败不禁用」的全部编排。 */
export interface EnterprisePresetInstall {
  status(): Promise<EnterprisePresetInstallStatus>
  enable(recipe: PresetRecipe): Promise<EnterprisePresetEnableResult>
  disable(declarationId: string): Promise<EnterprisePresetDisableResult>
  busy(declarationId?: string): boolean
}

function applicationKind(application: PresetApplication): PresetApplicationKind {
  if (application === 'applied') return 'hot'
  if (application === 'restart-required') return 'restart-required'
  return 'other'
}

/** 读本机已装清单；不存在即空，损坏一律 fail-closed。 */
export async function readInstalledPresets(
  options: PresetInstallStateOptions = {},
): Promise<readonly InstalledPresetRecord[]> {
  let text: string
  try {
    text = await readFile(installedStatePath(options), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw presetError(error, 'ENT_PRESET_STATE_INVALID', 'installed preset state could not be read')
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'installed preset state is not valid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'records'
    || !Array.isArray((value as { records?: unknown }).records)) {
    throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'installed preset state has an invalid shape')
  }
  const records: InstalledPresetRecord[] = []
  for (const item of (value as { records: unknown[] }).records) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'installed preset record is not an object')
    }
    const row = item as Record<string, unknown>
    const declarationId = row['declarationId']
    if (Object.keys(row).sort().join(',') !== 'bundleDir,declarationId,displayName,fingerprint,installedAt,officialApplication,packageName,recipeId,version'
      || typeof declarationId !== 'string' || !DECLARATION_ID_PATTERN.test(declarationId)
      || typeof row['recipeId'] !== 'string' || !DECLARATION_ID_PATTERN.test(row['recipeId'])
      || typeof row['displayName'] !== 'string' || row['displayName'].length === 0 || row['displayName'].length > MAX_DISPLAY_NAME_LENGTH
      || row['packageName'] !== presetBundlePackageName(declarationId)
      || typeof row['bundleDir'] !== 'string' || !isAbsolute(row['bundleDir'])
      || typeof row['fingerprint'] !== 'string' || !HEX64_PATTERN.test(row['fingerprint'])
      || typeof row['version'] !== 'string' || !SEMVER_PATTERN.test(row['version'])
      || typeof row['installedAt'] !== 'string' || !Number.isFinite(Date.parse(row['installedAt']))
      || !(PRESET_APPLICATIONS as readonly unknown[]).includes(row['officialApplication'])) {
      throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'installed preset record has invalid fields')
    }
    records.push({
      declarationId,
      recipeId: row['recipeId'],
      displayName: row['displayName'],
      packageName: row['packageName'],
      bundleDir: row['bundleDir'],
      fingerprint: row['fingerprint'],
      version: row['version'],
      installedAt: row['installedAt'],
      officialApplication: row['officialApplication'] as PresetApplication,
    })
  }
  return records
}

/** 原子写已装清单：同目录临时件 + rename（与 skill-install 同一套纪律）。 */
export async function writeInstalledPresets(
  options: PresetInstallStateOptions,
  records: readonly InstalledPresetRecord[],
): Promise<void> {
  const path = installedStatePath(options)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(temporary, JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw presetError(error, 'ENT_PRESET_STATE_INVALID', 'installed preset state could not be written')
  }
}

function installedStatePath(options: PresetInstallStateOptions): string {
  return join(resolveEnterpriseDshHome(options), ...PRESET_INSTALL_DIR_SEGMENTS, PRESET_INSTALL_FILENAME)
}

/** 目标 profile 下的 `node_modules/<包名>` 落点。 */
export function presetLinkPath(profileDir: string, packageName: string): string {
  return join(profileDir, 'node_modules', ...packageName.split('/'))
}

/** link 是否仍然存在（不跟随符号链接）。 */
export async function presetLinkExists(profileDir: string, packageName: string): Promise<boolean> {
  try {
    await lstat(presetLinkPath(profileDir, packageName))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export type PresetLinkCleanupReason = 'removed' | 'absent' | 'not-a-symbolic-link' | 'foreign-target' | 'failed'

export interface PresetLinkCleanupOptions extends PresetInstallStateOptions {
  readonly profileDir: string
  readonly onError?: (message: string, error: unknown) => void
}

export interface PresetLinkCleanupResult {
  readonly removed: boolean
  readonly reason: PresetLinkCleanupReason
}

/**
 * 清掉官方 `removeBundle` **不会**清的那一枚 `node_modules/<pkg>` link 残壳（spike §3⑤ 实证）。
 *
 * 三道 fail-closed：① 只认符号链接（真实目录/文件一律不碰）；② 符号链接的**解析目标**必须落在
 * 我们的 `<dshHome>/enterprise/preset-bundles` 内；③ 目标校验用的是符号链接本体解析值，
 * 不看包名猜。清理范围**只**是 `node_modules`，`.plugin-manager/logs/*` 是官方审计，绝不触碰。
 */
export async function cleanPresetBundleLink(
  options: PresetLinkCleanupOptions,
  packageName: string,
): Promise<PresetLinkCleanupResult> {
  if (typeof packageName !== 'string' || !PACKAGE_NAME_PATTERN.test(packageName) || packageName.length > 128) {
    throw presetBadRequest('package name is invalid')
  }
  const linkPath = presetLinkPath(options.profileDir, packageName)
  let info
  try {
    info = await lstat(linkPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { removed: false, reason: 'absent' }
    return { removed: false, reason: 'failed' }
  }
  if (!info.isSymbolicLink()) return { removed: false, reason: 'not-a-symbolic-link' }
  let target: string
  try {
    const raw = await readlink(linkPath)
    target = isAbsolute(raw) ? resolve(raw) : resolve(dirname(linkPath), raw)
  } catch {
    return { removed: false, reason: 'failed' }
  }
  if (!await isInsidePresetBundleRoot(options, target)) return { removed: false, reason: 'foreign-target' }
  try {
    await rm(linkPath, { force: false })
    const parent = dirname(linkPath)
    if (parent !== join(options.profileDir, 'node_modules')) {
      const siblings = await readdir(parent).catch(() => ['keep'])
      if (siblings.length === 0) await rm(parent, { force: true, recursive: false }).catch(() => undefined)
    }
    return { removed: true, reason: 'removed' }
  } catch (error) {
    options.onError?.('preset link cleanup failed', error)
    return { removed: false, reason: 'failed' }
  }
}

/** 落点是否落在我们的 bundle 根内（raw 与 realpath 两种写法都认，Android 符号链接不误判）。 */
async function isInsidePresetBundleRoot(options: PresetInstallStateOptions, candidate: string): Promise<boolean> {
  const roots = new Set<string>([resolve(presetBundleRoot(options))])
  try {
    roots.add(resolve(await realpath(presetBundleRoot(options))))
  } catch {
    // 根不存在时只按字面路径判定。
  }
  let real: string | undefined
  try {
    real = resolve(await realpath(candidate))
  } catch {
    real = undefined
  }
  for (const root of roots) {
    const normalized = resolve(root)
    if (candidate === normalized || candidate.startsWith(normalized + sep)) return true
    if (real !== undefined && (real === normalized || real.startsWith(normalized + sep))) return true
  }
  return false
}

/** 组装安装器；`port` 是唯一外部依赖，测试用假端口即可覆盖全部分支。 */
export function createEnterprisePresetInstall(options: EnterprisePresetInstallOptions): EnterprisePresetInstall {
  const inFlight = new Set<string>()
  const report = (message: string, error: unknown): void => {
    options.onError?.(message, error)
  }

  async function status(): Promise<EnterprisePresetInstallStatus> {
    return { installs: await readInstalledPresets(options), busy: [...inFlight].sort() }
  }

  async function enable(recipe: PresetRecipe): Promise<EnterprisePresetEnableResult> {
    let rendered
    try {
      rendered = renderPresetBundle(recipe)
    } catch (error) {
      const failure = presetError(error, 'ENT_PRESET_RECIPE_INVALID', 'preset recipe is not installable')
      report('preset recipe rejected', failure)
      return { ok: false, application: 'other', installedNames: [], needsNewSession: false, errorCode: failure.code }
    }
    const declarationId = rendered.declarationId
    const fingerprint = presetBundleSetFingerprint(rendered.bundleSet)
    const disclosure = presetDisclosure(rendered.bundleSet)
    const base = {
      declarationId,
      rowId: rendered.rowId,
      fingerprint,
      disclosure,
    }
    // 幂等/并发：同一配方重复点不重装；进行中再点**拒绝**（不排队），并让调用方去 status() 看进度。
    if (inFlight.has(declarationId)) {
      return {
        ...base,
        ok: false,
        application: 'other',
        installedNames: [],
        needsNewSession: false,
        errorCode: 'ENT_PRESET_INSTALL_IN_PROGRESS',
      }
    }
    inFlight.add(declarationId)
    try {
      const authorization = await resolvePresetAuthorization(options, declarationId, fingerprint)
      if (authorization.state !== 'authorized') {
        return {
          ...base,
          ok: false,
          application: 'other',
          installedNames: [],
          needsNewSession: false,
          errorCode: authorization.state === 'needs-authorization'
            ? 'ENT_PRESET_AUTHORIZATION_REQUIRED'
            : 'ENT_PRESET_AUTHORIZATION_STALE',
        }
      }
      const installs = await readInstalledPresets(options)
      const existing = installs.find(item => item.declarationId === declarationId)
      if (existing !== undefined
        && existing.fingerprint === fingerprint
        && await presetLinkExists(options.profileDir, existing.packageName)) {
        return {
          ...base,
          ok: true,
          application: applicationKind(existing.officialApplication),
          officialApplication: existing.officialApplication,
          installedNames: [existing.packageName],
          needsNewSession: true,
          alreadyInstalled: true,
          bundleDir: existing.bundleDir,
        }
      }
      const synthesized = await synthesizePresetBundle(options, recipe)
      let applied: PresetBundleApplication
      try {
        applied = await options.port.installBundle(synthesized.bundleDir, { enabled: true })
      } catch (error) {
        // 官方失败**原样**保留在 cause 与 onError 里，界面只拿稳定码。
        report('preset bundle install failed', error)
        return {
          ...base,
          ok: false,
          application: 'other',
          officialApplication: 'failed',
          installedNames: [],
          needsNewSession: false,
          errorCode: 'ENT_PRESET_INSTALL_FAILED',
          bundleDir: synthesized.bundleDir,
        }
      }
      if (applied.application === 'failed') {
        report('preset bundle install reported failure', applied.error)
        return {
          ...base,
          ok: false,
          application: 'other',
          officialApplication: 'failed',
          installedNames: [],
          needsNewSession: false,
          errorCode: 'ENT_PRESET_INSTALL_FAILED',
          bundleDir: synthesized.bundleDir,
          ...(applied.error?.code === undefined ? {} : { officialError: { code: applied.error.code } }),
        }
      }
      if (applied.application === 'cancelled') {
        return {
          ...base,
          ok: false,
          application: 'other',
          officialApplication: 'cancelled',
          installedNames: [],
          needsNewSession: false,
          errorCode: 'ENT_PRESET_INSTALL_CANCELLED',
          bundleDir: synthesized.bundleDir,
        }
      }
      const record: InstalledPresetRecord = {
        declarationId,
        recipeId: declarationId,
        displayName: rendered.displayName,
        packageName: rendered.packageName,
        bundleDir: synthesized.bundleDir,
        fingerprint,
        version: rendered.version,
        installedAt: (options.now ?? (() => new Date()))().toISOString(),
        officialApplication: applied.application,
      }
      await writeInstalledPresets(
        options,
        [...installs.filter(item => item.declarationId !== declarationId), record]
          .sort((left, right) => left.declarationId.localeCompare(right.declarationId)),
      )
      return {
        ...base,
        ok: true,
        application: applicationKind(applied.application),
        officialApplication: applied.application,
        installedNames: [rendered.packageName],
        needsNewSession: true,
        bundleDir: synthesized.bundleDir,
        ...(applied.warnings === undefined ? {} : { warnings: applied.warnings }),
      }
    } finally {
      inFlight.delete(declarationId)
    }
  }

  async function disable(declarationId: string): Promise<EnterprisePresetDisableResult> {
    const id = typeof declarationId === 'string' && DECLARATION_ID_PATTERN.test(declarationId) ? declarationId : undefined
    if (id === undefined) {
      return {
        ok: false,
        application: 'other',
        declarationId: String(declarationId),
        removedNames: [],
        linkRemoved: false,
        errorCode: 'ENT_INVALID_REQUEST',
      }
    }
    if (inFlight.has(id)) {
      return {
        ok: false,
        application: 'other',
        declarationId: id,
        removedNames: [],
        linkRemoved: false,
        errorCode: 'ENT_PRESET_INSTALL_IN_PROGRESS',
      }
    }
    inFlight.add(id)
    try {
      const installs = await readInstalledPresets(options)
      const record = installs.find(item => item.declarationId === id)
      if (record === undefined) {
        return {
          ok: false,
          application: 'other',
          declarationId: id,
          removedNames: [],
          linkRemoved: false,
          errorCode: 'ENT_RESOURCE_NOT_FOUND',
        }
      }
      let removed: PresetBundleApplication
      try {
        removed = await options.port.removeBundle(record.packageName)
      } catch (error) {
        report('preset bundle removal failed', error)
        return {
          ok: false,
          application: 'other',
          officialApplication: 'failed',
          declarationId: id,
          removedNames: [],
          linkRemoved: false,
          errorCode: 'ENT_PRESET_UNINSTALL_FAILED',
        }
      }
      if (removed.application === 'failed') {
        report('preset bundle removal reported failure', removed.error)
        return {
          ok: false,
          application: 'other',
          officialApplication: 'failed',
          declarationId: id,
          removedNames: [],
          linkRemoved: false,
          errorCode: 'ENT_PRESET_UNINSTALL_FAILED',
        }
      }
      const cleanup = await cleanPresetBundleLink(options, record.packageName)
      await writeInstalledPresets(options, installs.filter(item => item.declarationId !== id))
      const warnings = [
        ...(removed.warnings ?? []),
        ...(cleanup.removed || cleanup.reason === 'absent' ? [] : [`node_modules link not removed: ${cleanup.reason}`]),
      ]
      return {
        ok: true,
        application: applicationKind(removed.application),
        officialApplication: removed.application,
        declarationId: id,
        removedNames: [record.packageName],
        linkRemoved: cleanup.removed,
        ...(warnings.length === 0 ? {} : { warnings }),
      }
    } finally {
      inFlight.delete(id)
    }
  }

  return {
    status,
    enable,
    disable,
    busy: (declarationId?: string) => declarationId === undefined ? inFlight.size > 0 : inFlight.has(declarationId),
  }
}

/** 读取一个已合成 bundle 目录里恰好两个文件的正文（测试与诊断用；形状不符即拒）。 */
export async function readPresetBundleDirectory(
  bundleDir: string,
): Promise<{ readonly packageJson: string; readonly cordisPatch: string }> {
  const entries = (await readdir(bundleDir)).sort()
  if (entries.join(',') !== PRESET_BUNDLE_FILENAMES.join(',')) {
    throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'preset bundle directory does not hold exactly the two files')
  }
  return {
    packageJson: await readFile(join(bundleDir, 'package.json'), 'utf8'),
    cordisPatch: await readFile(join(bundleDir, 'cordis.patch.yml'), 'utf8'),
  }
}
