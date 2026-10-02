/**
 * [INPUT]: 依赖 node:crypto/fs/path 与 platform-client 的 `resolveEnterpriseDshHome`，接收合成段给出的 bundle 集合项（`PresetBundleSetItem`）
 * [OUTPUT]: 对外提供 `presetBundleSetFingerprint`（集合稳定哈希，纯函数）、`presetDisclosure`（弹层逐项披露数据）、三态查询 `resolvePresetAuthorization` 与写入口 `authorizePreset`/`revokePresetAuthorization`
 * [POS]: bundle 配方一键启用的**授权门**——官方服务面【零弹层】（`docs/notes/preset-approval-spike.md` §5.1 结论 (a)），授权 UX 必须由我们造。这里只落**状态**：按插件/bundle 集合指纹一次授权，集合不变就不重复弹，集合变了（含 bundle 内容摘要变）必须重新确认；状态落在本机 `<dshHome>/enterprise/preset-authorizations/authorizations.json`（0700/0600、同目录临时件 + rename），**不上服务端、不碰任何令牌**
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterprisePresetError, presetBadRequest, presetError } from './errors.js'
import type { PresetBundleSetItem } from './bundle.js'

/** 授权状态的私有落点（`<dshHome>/enterprise/` 下，与 device.json / skill-installs 同级）。 */
const PRESET_AUTHORIZATION_DIR_SEGMENTS = ['enterprise', 'preset-authorizations'] as const
const PRESET_AUTHORIZATION_FILENAME = 'authorizations.json'
const FINGERPRINT_DOMAIN = 'dsh-ent-preset-fingerprint/v1'
const HEX64_PATTERN = /^[0-9a-f]{64}$/
const DECLARATION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** `needs-authorization` = 从未授权；`authorized` = 当前指纹已授权；`fingerprint-changed` = 授权过但集合已变。 */
export type PresetAuthorizationState = 'needs-authorization' | 'authorized' | 'fingerprint-changed'

/** 一条本机授权记录；只保存脱敏事实（配方 id、集合指纹、授权时间）。 */
export interface PresetAuthorizationRecord {
  readonly declarationId: string
  readonly fingerprint: string
  readonly authorizedAt: string
}

/** 三态查询结果；弹层据此决定是否还要确认。 */
export interface PresetAuthorizationStatus {
  readonly state: PresetAuthorizationState
  readonly declarationId: string
  readonly fingerprint: string
  readonly authorizedFingerprint?: string
  readonly authorizedAt?: string
}

/** 弹层要逐项列出的披露数据：我们真正会装的 bundle + 配方会挂载的模块。 */
export interface PresetDisclosure {
  readonly fingerprint: string
  readonly bundles: readonly { readonly name: string; readonly summary: string; readonly digest: string }[]
  readonly mounts: readonly { readonly name: string; readonly summary: string }[]
}

export interface PresetAuthorizationOptions {
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  readonly env?: NodeJS.ProcessEnv
  readonly now?: () => Date
}

/**
 * 集合稳定哈希：只吃能改变「会跑什么代码」的身份（kind/name/digest），**不吃**用于展示的 summary。
 *
 * 因此改一句描述不会让员工重新确认；改集合（增删插件行、换 bundle、bundle 内容变）一定会。
 */
export function presetBundleSetFingerprint(items: readonly PresetBundleSetItem[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    throw presetBadRequest('preset bundle set must be a non-empty array')
  }
  const canonical = items.map(item => {
    if (typeof item !== 'object' || item === null) throw presetBadRequest('preset bundle set item must be an object')
    if (item.kind !== 'bundle' && item.kind !== 'mount') throw presetBadRequest('preset bundle set item kind is invalid')
    if (typeof item.name !== 'string' || item.name.length === 0 || item.name.length > 128) {
      throw presetBadRequest('preset bundle set item name is invalid')
    }
    if (item.kind === 'bundle') {
      if (typeof item.digest !== 'string' || !HEX64_PATTERN.test(item.digest)) {
        throw presetBadRequest('preset bundle set item digest is invalid')
      }
      return { kind: item.kind, name: item.name, digest: item.digest }
    }
    if (item.digest !== undefined) throw presetBadRequest('preset mount item must not carry a digest')
    return { kind: item.kind, name: item.name }
  }).sort((left, right) => (
    left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind.localeCompare(right.kind)
  ))
  return createHash('sha256').update(`${FINGERPRINT_DOMAIN}\n`).update(JSON.stringify(canonical)).digest('hex')
}

/** 披露投影：items（集合，决定指纹）+ 逐项人话（弹层用）。 */
export function presetDisclosure(items: readonly PresetBundleSetItem[]): PresetDisclosure {
  const fingerprint = presetBundleSetFingerprint(items)
  const bundles: { name: string; summary: string; digest: string }[] = []
  const mounts: { name: string; summary: string }[] = []
  for (const item of items) {
    if (item.kind === 'bundle') {
      bundles.push({
        name: item.name,
        summary: item.summary,
        digest: item.digest ?? '',
      })
    } else {
      mounts.push({ name: item.name, summary: item.summary })
    }
  }
  const byName = (left: { name: string }, right: { name: string }): number => left.name.localeCompare(right.name)
  return { fingerprint, bundles: bundles.sort(byName), mounts: mounts.sort(byName) }
}

/** 授权状态文件路径。 */
export function presetAuthorizationPath(options: PresetAuthorizationOptions = {}): string {
  return join(resolveEnterpriseDshHome(options), ...PRESET_AUTHORIZATION_DIR_SEGMENTS, PRESET_AUTHORIZATION_FILENAME)
}

/** 严格读授权状态；文件不存在是合法空状态，损坏一律 fail-closed 而不是当成空清单覆盖。 */
export async function readPresetAuthorizations(
  options: PresetAuthorizationOptions = {},
): Promise<readonly PresetAuthorizationRecord[]> {
  let text: string
  try {
    text = await readFile(presetAuthorizationPath(options), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw presetError(error, 'ENT_PRESET_STATE_INVALID', 'preset authorization state could not be read')
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'preset authorization state is not valid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'records'
    || !Array.isArray((value as { records?: unknown }).records)) {
    throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'preset authorization state has an invalid shape')
  }
  const records: PresetAuthorizationRecord[] = []
  for (const item of (value as { records: unknown[] }).records) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'preset authorization record is not an object')
    }
    const row = item as Record<string, unknown>
    if (Object.keys(row).sort().join(',') !== 'authorizedAt,declarationId,fingerprint'
      || typeof row['declarationId'] !== 'string' || !DECLARATION_ID_PATTERN.test(row['declarationId'])
      || typeof row['fingerprint'] !== 'string' || !HEX64_PATTERN.test(row['fingerprint'])
      || typeof row['authorizedAt'] !== 'string' || !Number.isFinite(Date.parse(row['authorizedAt']))) {
      throw new EnterprisePresetError('ENT_PRESET_STATE_INVALID', 'preset authorization record has invalid fields')
    }
    records.push({
      declarationId: row['declarationId'],
      fingerprint: row['fingerprint'],
      authorizedAt: row['authorizedAt'],
    })
  }
  return records
}

/** 三态查询：从未授权 / 当前指纹已授权 / 授权过但指纹已变。 */
export async function resolvePresetAuthorization(
  options: PresetAuthorizationOptions,
  declarationId: string,
  fingerprint: string,
): Promise<PresetAuthorizationStatus> {
  const id = requireDeclarationId(declarationId)
  const print = requireFingerprint(fingerprint)
  const record = (await readPresetAuthorizations(options)).find(item => item.declarationId === id)
  if (record === undefined) return { state: 'needs-authorization', declarationId: id, fingerprint: print }
  if (record.fingerprint === print) {
    return {
      state: 'authorized',
      declarationId: id,
      fingerprint: print,
      authorizedFingerprint: record.fingerprint,
      authorizedAt: record.authorizedAt,
    }
  }
  return {
    state: 'fingerprint-changed',
    declarationId: id,
    fingerprint: print,
    authorizedFingerprint: record.fingerprint,
    authorizedAt: record.authorizedAt,
  }
}

/** 写入一次授权（覆盖同配方的旧指纹）；返回写后的三态（必为 `authorized`）。 */
export async function authorizePreset(
  options: PresetAuthorizationOptions,
  declarationId: string,
  fingerprint: string,
): Promise<PresetAuthorizationStatus> {
  const id = requireDeclarationId(declarationId)
  const print = requireFingerprint(fingerprint)
  const records = (await readPresetAuthorizations(options)).filter(item => item.declarationId !== id)
  const authorizedAt = (options.now ?? (() => new Date()))().toISOString()
  records.push({ declarationId: id, fingerprint: print, authorizedAt })
  records.sort((left, right) => left.declarationId.localeCompare(right.declarationId))
  await writePresetAuthorizations(options, records)
  return { state: 'authorized', declarationId: id, fingerprint: print, authorizedFingerprint: print, authorizedAt }
}

/** 撤销一个配方的授权；返回是否真的删掉了一条。 */
export async function revokePresetAuthorization(
  options: PresetAuthorizationOptions,
  declarationId: string,
): Promise<boolean> {
  const id = requireDeclarationId(declarationId)
  const records = await readPresetAuthorizations(options)
  const kept = records.filter(item => item.declarationId !== id)
  if (kept.length === records.length) return false
  await writePresetAuthorizations(options, kept)
  return true
}

/** 原子写授权状态：同目录临时件 + rename（与 skill-install 的已装清单同一套纪律）。 */
async function writePresetAuthorizations(
  options: PresetAuthorizationOptions,
  records: readonly PresetAuthorizationRecord[],
): Promise<void> {
  const path = presetAuthorizationPath(options)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(temporary, JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw presetError(error, 'ENT_PRESET_STATE_INVALID', 'preset authorization state could not be written')
  }
}

function requireDeclarationId(value: unknown): string {
  if (typeof value !== 'string' || !DECLARATION_ID_PATTERN.test(value) || value.length > 64) {
    throw presetBadRequest('preset declaration id is invalid')
  }
  return value
}

function requireFingerprint(value: unknown): string {
  if (typeof value !== 'string' || !HEX64_PATTERN.test(value)) throw presetBadRequest('preset fingerprint is invalid')
  return value
}
