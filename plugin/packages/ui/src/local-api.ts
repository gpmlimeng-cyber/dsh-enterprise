/**
 * [INPUT]: 依赖浏览器 fetch 与 platform-client 的按需同源 JSON 协议
 * [OUTPUT]: 对外提供严格账号/插件/配方状态解码、Server 地址/登录/整包卸载动作、配方下载 URL 构造和显式刷新端口
 * [POS]: dsh-ui 的浏览器网络边界，只投影 Settings 所需事实并拒绝秘密、正文、SHA 与本地执行细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const LOCAL_API_PREFIX = '/enterprise/api/v1/local'

export const ENTERPRISE_CONNECTION_STATES = [
  'UNCONFIGURED',
  'SIGNED_OUT',
  'AUTHORIZING',
  'ENROLLING',
  'BOOTSTRAPPING',
  'READY',
  'CANCELLED',
  'FAILED',
  'REFRESHING',
  'AUTH_EXPIRED',
  'DEVICE_REVOKED',
] as const

export type EnterpriseConnectionState = typeof ENTERPRISE_CONNECTION_STATES[number]

export const MANAGED_PLUGIN_STATES = [
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
] as const

export type ManagedPluginState = typeof MANAGED_PLUGIN_STATES[number]

export interface EnterpriseStatusUser {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly departmentId: string | null
}

export interface EnterpriseLocalStatus {
  readonly state: EnterpriseConnectionState
  readonly bundleVersion: string
  readonly platformUrl: string | null
  readonly transport: 'webServer.register'
  readonly flowId?: string
  readonly user?: EnterpriseStatusUser
  readonly revision?: number
  readonly connectedAt?: string
  readonly errorCode?: string
}

export interface EnterpriseAccountBootstrap {
  readonly user: EnterpriseStatusUser
  readonly device: {
    readonly id: string
    readonly installationId: string
    readonly status: 'ACTIVE'
  }
  /** 仅投影 enabled 布尔；默认 false。 */
  readonly sessionPolicyEnabled?: boolean
}

export interface EnterprisePluginItem {
  readonly packageName: string
  readonly version: string | null
  readonly desiredRevision: number
  readonly desiredState: 'INSTALLED' | 'ABSENT'
  readonly state: ManagedPluginState
  readonly lastErrorCode: string | null
}

export interface EnterprisePluginStatus {
  readonly assignmentRevision: number
  readonly plugins: readonly EnterprisePluginItem[]
  readonly catalog?: readonly EnterprisePluginCatalogItem[]
  readonly fatalErrorCode?: string
  readonly lastReportErrorCode?: string
}

export interface EnterprisePluginCatalogItem {
  readonly pluginVersionId: string
  readonly packageName: string
  readonly version: string
  readonly sizeBytes: number
  readonly operatingSystems: readonly string[]
  readonly installErrorCode?: string
}

export interface EnterpriseRuntimePreset {
  readonly id: string
  readonly presetId: string
  readonly displayName: string
  readonly description: string
  readonly sourceDshVersion: string
  readonly sizeBytes: number
  readonly updatedAt: string
  readonly versionId: string
}

export interface EnterpriseSessionSyncStatus {
  readonly enabled: boolean
  readonly deviceId: string | null
  readonly pendingSessionIds: readonly string[]
  readonly lastError: string | null
}

export interface EnterpriseRemoteSession {
  readonly id: string
  readonly title: string | null
  readonly lastSeq: number
  readonly eventCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface EnterpriseLocalApi {
  status(signal: AbortSignal): Promise<EnterpriseLocalStatus>
  refresh(signal: AbortSignal): Promise<EnterpriseLocalStatus>
  setServerUrl(serverUrl: string, signal: AbortSignal): Promise<{ readonly serverUrl: string }>
  bootstrap(signal: AbortSignal): Promise<EnterpriseAccountBootstrap | undefined>
  plugins(signal: AbortSignal): Promise<EnterprisePluginStatus>
  presets(signal: AbortSignal): Promise<readonly EnterpriseRuntimePreset[]>
  presetDetail(packageId: string, signal: AbortSignal): Promise<EnterpriseRuntimePreset>
  installPlugin(packageName: string, pluginVersionId: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  removePlugin(packageName: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  startLogin(signal: AbortSignal): Promise<{ readonly flowId: string }>
  cancelLogin(signal: AbortSignal): Promise<{ readonly cancelled: boolean }>
  logout(signal: AbortSignal): Promise<{ readonly loggedOut: true }>
  uninstall(signal: AbortSignal): Promise<{ readonly uninstalled: true; readonly restartRequested: boolean }>
  sessionSyncStatus(signal: AbortSignal): Promise<EnterpriseSessionSyncStatus>
  listSessions(signal: AbortSignal): Promise<readonly EnterpriseRemoteSession[]>
  restoreSession(sourceSessionId: string, cwd: string, signal: AbortSignal): Promise<{
    readonly restoredSessionId: string
    readonly sourceSessionId: string
  }>
}

export class EnterpriseLocalApiError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super(code)
    this.name = 'EnterpriseLocalApiError'
  }
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

function hasExactKeys(value: JsonRecord, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value)
  return required.every(key => keys.includes(key))
    && keys.every(key => required.includes(key) || optional.includes(key))
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function decodeUser(value: unknown): EnterpriseStatusUser | undefined {
  const user = record(value)
  if (user === undefined || !hasExactKeys(user, ['id', 'username', 'displayName', 'departmentId'])
    || !nonEmptyString(user['id']) || !nonEmptyString(user['username'])
    || !nonEmptyString(user['displayName'])
    || !(user['departmentId'] === null || nonEmptyString(user['departmentId']))) return undefined
  return {
    id: user['id'],
    username: user['username'],
    displayName: user['displayName'],
    departmentId: user['departmentId'],
  }
}

function safePlatformUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.username === '' && url.password === '' && url.search === '' && url.hash === ''
  } catch {
    return false
  }
}

/** 严格解码本地 JSON response 内的脱敏状态。 */
export function decodeEnterpriseLocalStatus(value: unknown): EnterpriseLocalStatus {
  const status = record(value)
  const allowedOptional = ['flowId', 'user', 'revision', 'connectedAt', 'errorCode']
  if (status === undefined
    || !hasExactKeys(status, ['state', 'bundleVersion', 'platformUrl', 'transport'], allowedOptional)
    || !ENTERPRISE_CONNECTION_STATES.includes(status['state'] as EnterpriseConnectionState)
    || !nonEmptyString(status['bundleVersion'])
    || !(status['platformUrl'] === null || safePlatformUrl(status['platformUrl']))
    || status['transport'] !== 'webServer.register') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if ((status['state'] === 'UNCONFIGURED') !== (status['platformUrl'] === null)) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if (status['flowId'] !== undefined && !nonEmptyString(status['flowId'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const user = status['user'] === undefined ? undefined : decodeUser(status['user'])
  if (status['user'] !== undefined && user === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  if (status['revision'] !== undefined
    && (!Number.isSafeInteger(status['revision']) || (status['revision'] as number) < 0)) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if (status['connectedAt'] !== undefined && !nonEmptyString(status['connectedAt'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if (status['errorCode'] !== undefined && !nonEmptyString(status['errorCode'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    state: status['state'] as EnterpriseConnectionState,
    bundleVersion: status['bundleVersion'],
    platformUrl: status['platformUrl'] as string | null,
    transport: 'webServer.register',
    ...(status['flowId'] === undefined ? {} : { flowId: status['flowId'] as string }),
    ...(user === undefined ? {} : { user }),
    ...(status['revision'] === undefined ? {} : { revision: status['revision'] as number }),
    ...(status['connectedAt'] === undefined ? {} : { connectedAt: status['connectedAt'] as string }),
    ...(status['errorCode'] === undefined ? {} : { errorCode: status['errorCode'] as string }),
  }
}

function decodeBootstrap(value: unknown): EnterpriseAccountBootstrap | undefined {
  if (value === null) return undefined
  const source = record(value)
  const user = decodeUser(source?.['user'])
  const device = record(source?.['device'])
  const sessionPolicy = record(source?.['sessionPolicy'])
  if (source === undefined || user === undefined || device === undefined
    || !hasExactKeys(device, ['id', 'installationId', 'status'])
    || !nonEmptyString(device['id']) || !nonEmptyString(device['installationId'])
    || device['status'] !== 'ACTIVE') throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  const sessionPolicyEnabled = sessionPolicy === undefined
    ? undefined
    : sessionPolicy['enabled']
  if (sessionPolicyEnabled !== undefined && typeof sessionPolicyEnabled !== 'boolean') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    user,
    device: { id: device['id'], installationId: device['installationId'], status: 'ACTIVE' },
    ...(sessionPolicyEnabled === undefined ? {} : { sessionPolicyEnabled }),
  }
}

function nullableString(value: unknown): value is string | null {
  return value === null || nonEmptyString(value)
}

const RFC_3339_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function timestamp(value: unknown): value is string {
  return nonEmptyString(value) && value.length <= 64
    && RFC_3339_PATTERN.test(value) && Number.isFinite(Date.parse(value))
}

function nullableTimestamp(value: unknown): value is string | null {
  return value === null || timestamp(value)
}

function enterpriseId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value)
}

function decodePluginItem(value: unknown): EnterprisePluginItem | undefined {
  const item = record(value)
  if (item === undefined
    || !hasExactKeys(item, [
      'packageName', 'version', 'sha256', 'desiredRevision', 'desiredState', 'state',
      'lastErrorCode', 'restartMarker',
    ])
    || !nonEmptyString(item['packageName'])
    || !nullableString(item['version'])
    || !(item['sha256'] === null || (typeof item['sha256'] === 'string' && /^[0-9a-f]{64}$/.test(item['sha256'])))
    || !Number.isSafeInteger(item['desiredRevision']) || Number(item['desiredRevision']) < 0
    || !(item['desiredState'] === 'INSTALLED' || item['desiredState'] === 'ABSENT')
    || !MANAGED_PLUGIN_STATES.includes(item['state'] as ManagedPluginState)
    || !nullableString(item['lastErrorCode'])
    || !nullableString(item['restartMarker'])) return undefined
  return {
    packageName: item['packageName'],
    version: item['version'],
    desiredRevision: Number(item['desiredRevision']),
    desiredState: item['desiredState'],
    state: item['state'] as ManagedPluginState,
    lastErrorCode: item['lastErrorCode'],
  }
}

/** 严格校验 Host 分发状态，并删除 SHA、进程 marker 与任何未声明字段。 */
export function decodeEnterprisePluginStatus(value: unknown): EnterprisePluginStatus {
  const source = record(value)
  if (source === undefined
    || !hasExactKeys(source, ['assignmentRevision', 'plugins'], ['catalog', 'fatalErrorCode', 'lastReportErrorCode'])
    || !Number.isSafeInteger(source['assignmentRevision']) || Number(source['assignmentRevision']) < 0
    || !Array.isArray(source['plugins']) || source['plugins'].length > 500
    || (source['fatalErrorCode'] !== undefined && !nonEmptyString(source['fatalErrorCode']))
    || (source['lastReportErrorCode'] !== undefined && !nonEmptyString(source['lastReportErrorCode']))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const plugins = source['plugins'].map(decodePluginItem)
  if (plugins.some(item => item === undefined)) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  const catalog = source['catalog'] ?? []
  if (!Array.isArray(catalog) || catalog.length > 500) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  const entries = catalog.map(value => {
    const item = record(value)
    if (item === undefined || !hasExactKeys(item,
      ['pluginVersionId', 'packageName', 'version', 'sizeBytes', 'operatingSystems'], ['installErrorCode'])
      || !enterpriseId(item['pluginVersionId']) || !nonEmptyString(item['packageName'])
      || !nonEmptyString(item['version']) || !Number.isSafeInteger(item['sizeBytes']) || Number(item['sizeBytes']) <= 0
      || !Array.isArray(item['operatingSystems']) || item['operatingSystems'].some(os => !['darwin', 'linux', 'win32'].includes(os))
      || item['installErrorCode'] !== undefined && !nonEmptyString(item['installErrorCode'])) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return item as unknown as EnterprisePluginCatalogItem
  })
  if (new Set(entries.map(item => item.packageName)).size !== entries.length) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  return {
    assignmentRevision: Number(source['assignmentRevision']),
    plugins: plugins as EnterprisePluginItem[],
    ...(source['catalog'] === undefined ? {} : { catalog: entries }),
    ...(source['fatalErrorCode'] === undefined ? {} : { fatalErrorCode: source['fatalErrorCode'] as string }),
    ...(source['lastReportErrorCode'] === undefined
      ? {}
      : { lastReportErrorCode: source['lastReportErrorCode'] as string }),
  }
}

/** 严格解码可见企业配方摘要；不投影 SHA、artifact 路径或包内 YAML。 */
export function decodeEnterprisePresets(value: unknown): readonly EnterpriseRuntimePreset[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return value.map(item => {
    const row = record(item)
    if (row === undefined
      || !hasExactKeys(row, [
        'id', 'presetId', 'displayName', 'description', 'sourceDshVersion', 'sizeBytes', 'updatedAt',
      ], ['versionId', 'sha256'])
      || !enterpriseId(row['id']) || !nonEmptyString(row['presetId'])
      || !nonEmptyString(row['displayName']) || !nonEmptyString(row['description'])
      || !nonEmptyString(row['sourceDshVersion'])
      || !Number.isSafeInteger(row['sizeBytes']) || Number(row['sizeBytes']) > 0
      || !timestamp(row['updatedAt'])
      || (row['versionId'] !== undefined && !enterpriseId(row['versionId']))) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return {
      id: row['id'],
      presetId: row['presetId'],
      displayName: row['displayName'],
      description: row['description'],
      sourceDshVersion: row['sourceDshVersion'],
      sizeBytes: Number(row['sizeBytes']),
      updatedAt: row['updatedAt'],
      versionId: typeof row['versionId'] === 'string' ? row['versionId'] : '',
    }
  })
}

function decodeSessionSyncStatus(value: unknown): EnterpriseSessionSyncStatus {
  const row = record(value)
  if (row === undefined || !hasExactKeys(row, ['enabled', 'deviceId', 'pendingSessionIds', 'lastError'])
    || typeof row['enabled'] !== 'boolean'
    || !(row['deviceId'] === null || nonEmptyString(row['deviceId']))
    || !Array.isArray(row['pendingSessionIds'])
    || row['pendingSessionIds'].some(id => !nonEmptyString(id))
    || !(row['lastError'] === null || nonEmptyString(row['lastError']))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    enabled: row['enabled'],
    deviceId: row['deviceId'] as string | null,
    pendingSessionIds: row['pendingSessionIds'] as string[],
    lastError: row['lastError'] as string | null,
  }
}

function decodeRemoteSessions(value: unknown): readonly EnterpriseRemoteSession[] {
  const items = record(value)?.['items']
  if (!Array.isArray(items) || items.length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return items.map(item => {
    const row = record(item)
    if (row === undefined || !hasExactKeys(row, [
      'id', 'title', 'lastSeq', 'eventCount', 'createdAt', 'updatedAt',
    ])
      || !nonEmptyString(row['id'])
      || !(row['title'] === null || nonEmptyString(row['title']))
      || !Number.isSafeInteger(row['lastSeq']) || Number(row['lastSeq']) < 0
      || !Number.isSafeInteger(row['eventCount']) || Number(row['eventCount']) < 0
      || !nonEmptyString(row['createdAt']) || !nonEmptyString(row['updatedAt'])) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return {
      id: row['id'],
      title: row['title'] as string | null,
      lastSeq: Number(row['lastSeq']),
      eventCount: Number(row['eventCount']),
      createdAt: row['createdAt'],
      updatedAt: row['updatedAt'],
    }
  })
}

function errorCode(value: unknown): string {
  const code = record(record(value)?.['error'])?.['code']
  return nonEmptyString(code) ? code : 'ENT_PLATFORM_UNAVAILABLE'
}

async function requestJson(
  path: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(`${LOCAL_API_PREFIX}${path}`, init)
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  }
  if (!response.ok) throw new EnterpriseLocalApiError(errorCode(payload), response.status)
  const envelope = record(payload)
  if (envelope === undefined || !hasExactKeys(envelope, ['data'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  }
  return envelope['data']
}

function getInit(signal: AbortSignal): RequestInit {
  return { cache: 'no-store', headers: { accept: 'application/json' }, signal }
}

function postInit(signal: AbortSignal): RequestInit {
  return {
    body: '{}',
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    method: 'POST',
    signal,
  }
}

function jsonInit(method: 'POST', body: unknown, signal: AbortSignal): RequestInit {
  return {
    body: JSON.stringify(body),
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    method,
    signal,
  }
}

/** 创建只访问同源固定路径的浏览器 API；调用方无法注入平台 origin 或 Authorization。 */
export function createEnterpriseLocalApi(
  fetcher: typeof fetch = fetch,

): EnterpriseLocalApi {
  return {
    status: async signal => decodeEnterpriseLocalStatus(await requestJson('/status', getInit(signal), fetcher)),
    refresh: async signal => decodeEnterpriseLocalStatus(await requestJson('/refresh', jsonInit('POST', {}, signal), fetcher)),
    setServerUrl: async (serverUrl, signal) => {
      const data = record(await requestJson('/server', jsonInit('POST', { serverUrl }, signal), fetcher))
      if (data === undefined || !hasExactKeys(data, ['serverUrl']) || !safePlatformUrl(data['serverUrl'])) {
        throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
      }
      return { serverUrl: data['serverUrl'] }
    },
    bootstrap: async signal => decodeBootstrap(await requestJson('/bootstrap', getInit(signal), fetcher)),
    plugins: async signal => decodeEnterprisePluginStatus(await requestJson('/plugins', getInit(signal), fetcher)),
    presets: async signal => decodeEnterprisePresets(await requestJson('/presets', getInit(signal), fetcher)),
    presetDetail: async (packageId, signal) => {
      const items = decodeEnterprisePresets([await requestJson(`/presets/${packageId}`, getInit(signal), fetcher)])
      return items[0]!
    },
    installPlugin: async (packageName, pluginVersionId, signal) => decodeEnterprisePluginStatus(
      await requestJson('/plugins/install', jsonInit('POST', { packageName, pluginVersionId }, signal), fetcher),
    ),
    removePlugin: async (packageName, signal) => decodeEnterprisePluginStatus(
      await requestJson('/plugins/remove', jsonInit('POST', { packageName }, signal), fetcher),
    ),
    startLogin: async (signal) => {
      const data = record(await requestJson('/auth/start', postInit(signal), fetcher))
      if (data === undefined || !hasExactKeys(data, ['flowId']) || !nonEmptyString(data['flowId'])) {
        throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
      }
      return { flowId: data['flowId'] }
    },
    cancelLogin: async (signal) => {
      const data = record(await requestJson('/auth/cancel', postInit(signal), fetcher))
      if (data === undefined || !hasExactKeys(data, ['cancelled']) || typeof data['cancelled'] !== 'boolean') {
        throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
      }
      return { cancelled: data['cancelled'] }
    },
    logout: async (signal) => {
      const data = record(await requestJson('/logout', postInit(signal), fetcher))
      if (data === undefined || !hasExactKeys(data, ['loggedOut']) || data['loggedOut'] !== true) {
        throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
      }
      return { loggedOut: true }
    },
    uninstall: async (signal) => {
      const data = record(await requestJson('/uninstall', postInit(signal), fetcher))
      if (data === undefined || !hasExactKeys(data, ['uninstalled', 'restartRequested'])
        || data['uninstalled'] !== true || typeof data['restartRequested'] !== 'boolean') {
        throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
      }
      return { uninstalled: true, restartRequested: data['restartRequested'] }
    },
    sessionSyncStatus: async signal => decodeSessionSyncStatus(
      await requestJson('/sessions/sync', getInit(signal), fetcher),
    ),
    listSessions: async signal => decodeRemoteSessions(
      await requestJson('/sessions', getInit(signal), fetcher),
    ),
    restoreSession: async (sourceSessionId, cwd, signal) => {
      const data = record(await requestJson(
        `/sessions/${encodeURIComponent(sourceSessionId)}/copies`,
        jsonInit('POST', { cwd }, signal),
        fetcher,
      ))
      if (data === undefined || !hasExactKeys(data, ['restoredSessionId', 'sourceSessionId'])
        || !nonEmptyString(data['restoredSessionId']) || !nonEmptyString(data['sourceSessionId'])) {
        throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
      }
      return {
        restoredSessionId: data['restoredSessionId'],
        sourceSessionId: data['sourceSessionId'],
      }
    },
  }
}
