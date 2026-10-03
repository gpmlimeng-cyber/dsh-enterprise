/**
 * [INPUT]: 依赖 Node fs/path/crypto 与受管状态契约，在 DSH_HOME 企业目录读写本地事实
 * [OUTPUT]: 对外提供 ManagedPluginStore、resolveManagedPluginsPath 与空状态工厂；读时把旧记录缺席的本机私有
 *           `enabled` 位归一为 `true`（两个合法键集：带/不带这一枚；不迁移、不重写文件）
 * [POS]: plugin-distribution 的唯一状态持久化边界，以严格 JSON 和 rename 原子替换防止半文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ManagedPluginState } from '@dshent/contracts'
import { PluginDistributionError } from './errors.js'
import type { ManagedPluginRecord, ManagedPluginsFile } from './types.js'

const STATES = new Set<ManagedPluginState>([
  'EXPECTED',
  'DOWNLOAD_PENDING',
  'DOWNLOADING',
  'VERIFIED',
  'INSTALLING',
  'RESTART_REQUIRED',
  'ACTIVE',
  'REMOVE_PENDING',
  'REMOVING',
  'FAILED',
  'ROLLBACK',
])
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const SHA256 = /^[0-9a-f]{64}$/
/** 旧记录（没有本机私有 `enabled` 位）的**唯一**合法键集；兼容口径见 `parsePlugin`。 */
const RECORD_KEYS = 'desiredRevision,desiredState,lastErrorCode,packageName,restartMarker,sha256,state,version'
/** 带 `enabled` 位的新记录键集。 */
const RECORD_KEYS_WITH_ENABLED =
  'desiredRevision,desiredState,enabled,lastErrorCode,packageName,restartMarker,sha256,state,version'

export function emptyManagedPluginsFile(): ManagedPluginsFile {
  return { formatVersion: 1, assignmentRevision: 0, plugins: [] }
}

export function resolveManagedPluginsPath(dshHome: string): string {
  return join(dshHome, 'enterprise', 'managed-plugins.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown, pattern?: RegExp): value is string | null {
  return value === null || typeof value === 'string' && (pattern === undefined || pattern.test(value))
}

function parsePlugin(value: unknown): ManagedPluginRecord {
  if (!isRecord(value)) {
    throw new PluginDistributionError('ENT_PLUGIN_STATE_INVALID', 'managed plugin record is invalid')
  }
  // `enabled` 是本机私有启停位：**旧记录没有这一枚键**（缺席 ⇒ 归一 `true`，见下面的返回值），
  // 新记录带上它。两个键集之外的任何形状一律判无效——兼容不是放宽形状门禁。
  const keys = Object.keys(value).sort().join(',')
  if ((keys !== RECORD_KEYS && keys !== RECORD_KEYS_WITH_ENABLED)
    || typeof value['packageName'] !== 'string' || !PACKAGE_NAME.test(value['packageName'])
    || !nullableString(value['version'], VERSION)
    || !nullableString(value['sha256'], SHA256)
    || (typeof value['enabled'] !== 'boolean' && value['enabled'] !== undefined)
    || !Number.isSafeInteger(value['desiredRevision']) || Number(value['desiredRevision']) < 0
    || value['desiredState'] !== 'INSTALLED' && value['desiredState'] !== 'ABSENT'
    || typeof value['state'] !== 'string' || !STATES.has(value['state'] as ManagedPluginState)
    || !nullableString(value['lastErrorCode']) || (value['lastErrorCode']?.length ?? 0) > 64
    || !nullableString(value['restartMarker'])) {
    throw new PluginDistributionError('ENT_PLUGIN_STATE_INVALID', 'managed plugin record is invalid')
  }
  return {
    packageName: value['packageName'],
    version: value['version'],
    sha256: value['sha256'],
    // 读时归一（**不迁移**：不因为缺这一枚就重写整份状态文件）：缺席与 `true` 同判。
    enabled: value['enabled'] !== false,
    desiredRevision: Number(value['desiredRevision']),
    desiredState: value['desiredState'],
    state: value['state'] as ManagedPluginState,
    lastErrorCode: value['lastErrorCode'],
    restartMarker: value['restartMarker'],
  }
}

function parseFile(text: string): ManagedPluginsFile {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new PluginDistributionError('ENT_PLUGIN_STATE_INVALID', 'managed plugin state is not JSON', { cause: error })
  }
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'assignmentRevision,formatVersion,plugins'
    || value['formatVersion'] !== 1
    || !Number.isSafeInteger(value['assignmentRevision']) || Number(value['assignmentRevision']) < 0
    || !Array.isArray(value['plugins'])) {
    throw new PluginDistributionError('ENT_PLUGIN_STATE_INVALID', 'managed plugin state root is invalid')
  }
  const plugins = value['plugins'].map(parsePlugin)
  if (new Set(plugins.map(plugin => plugin.packageName)).size !== plugins.length) {
    throw new PluginDistributionError('ENT_PLUGIN_STATE_INVALID', 'managed plugin packages must be unique')
  }
  return { formatVersion: 1, assignmentRevision: Number(value['assignmentRevision']), plugins }
}

/** 私有权限读写一个版本化状态文件；写入永远先落同目录临时文件再 rename。 */
export class ManagedPluginStore {
  readonly path: string

  constructor(dshHome: string) {
    this.path = resolveManagedPluginsPath(dshHome)
  }

  async read(): Promise<ManagedPluginsFile> {
    try {
      return parseFile(await readFile(this.path, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyManagedPluginsFile()
      throw error
    }
  }

  async write(value: ManagedPluginsFile): Promise<void> {
    const directory = dirname(this.path)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const temporary = join(directory, `.managed-plugins.${process.pid}.${randomUUID()}.tmp`)
    const normalized: ManagedPluginsFile = {
      formatVersion: 1,
      assignmentRevision: value.assignmentRevision,
      plugins: [...value.plugins].sort((left, right) => left.packageName.localeCompare(right.packageName)),
    }
    try {
      await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
      await rename(temporary, this.path)
    } finally {
      await rm(temporary, { force: true })
    }
  }
}
