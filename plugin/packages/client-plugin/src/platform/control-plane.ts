/**
 * [INPUT]: 依赖 protocol/http(EnterpriseHttpClient) 与 protocol/envelope，依赖 platform 的 storage/installation/pkce/auth/device
 * [OUTPUT]: 对外提供 EnterpriseControlPlane：连接状态机、bootstrap 快照、状态订阅、令牌轮换与网关透传 request
 * [POS]: platform 层的编排核心与内存 access token 的唯一所有者；把浏览器 PKCE、设备注册与 bootstrap 收敛成单一状态机
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { platform as osPlatform } from 'node:os'

import { EnterprisePlatformError, toPlatformError, unwrapEnvelope } from '../protocol/envelope.js'
import { EnterpriseHttpClient, normalizeServerUrl, type EnterpriseRequestInit } from '../protocol/http.js'
import type {
  EnterpriseBootstrapModel, EnterpriseBootstrapQuota, EnterpriseBootstrapSnapshot,
  EnterpriseConnectionState, EnterpriseLoginFlow, EnterprisePlatformStatus, EnterprisePluginAssignment,
  EnterprisePluginCompatibility, EnterpriseStatusUser, EnterpriseTokenData,
} from '../protocol/types.js'
import { EnterpriseAuthClient, ENTERPRISE_DESKTOP_CLIENT_ID } from './auth.js'
import { EnterpriseDeviceClient, type EnterpriseDeviceView } from './device.js'
import { defaultDeviceName, resolveInstallationId } from './installation.js'
import {
  ENTERPRISE_CALLBACK_PATH, codeChallengeS256, createCodeVerifier, createState,
  startLoopbackCallback, type EnterpriseLoopbackCallback,
} from './pkce.js'
import { EnterpriseStore } from './storage.js'

const AUTHORIZE_PATH = '/enterprise/auth/v1/authorize'
const BOOTSTRAP_PATH = '/enterprise/api/v1/bootstrap'
/** access token 的提前过期窗口：60 秒余量吸收本机与服务端时钟偏差。 */
const EXPIRY_MARGIN_MS = 60_000
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_CALLBACK_TIMEOUT_MS = 300_000
/** dispose 的收尾上限：在途网络任务不得无限拖住宿主卸载。 */
const DISPOSE_DEADLINE_MS = 3_000
const UUID_V4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/
/** 认证类失败：本地凭据立即作废，必须重新登录。 */
const AUTH_FAILURES = new Set<string>(['ENT_AUTH_REQUIRED', 'ENT_AUTH_SESSION_EXPIRED', 'ENT_AUTH_CODE_INVALID'])
/** 已有活动会话（或正在建会话）时禁止改地址，避免把旧会话凭据带到新中心。 */
const SESSION_STATES = new Set<EnterpriseConnectionState>(
  ['AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING', 'REFRESHING', 'READY'],
)
const API_PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const
const QUOTA_SCOPES = ['ORGANIZATION', 'DEPARTMENT', 'USER', 'ACCESS_GROUP'] as const
const RESOURCE_TYPES = ['ALL_MODELS', 'MODEL_SET', 'MODEL'] as const
const DESIRED_STATES = ['INSTALLED', 'ABSENT'] as const
const OPERATING_SYSTEMS = ['darwin', 'linux', 'win32'] as const
const THINKING_FORMATS = [
  'openai', 'qwen', 'qwen-chat-template', 'deepseek', 'zai', 'minimax', 'kimi', 'longcat',
] as const
const REASONING_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/**
 * 回环回调工厂。生产路径为 pkce.startLoopbackCallback（真开 127.0.0.1 随机端口）；
 * 无浏览器/无端口的宿主（单测、CI）注入假实现即可走完整个登录状态机。
 */
export type EnterpriseStartCallback = (options: {
  readonly expectedState: string
  readonly timeoutMs: number
  readonly path: string
}) => Promise<EnterpriseLoopbackCallback>

export interface EnterpriseControlPlaneOptions {
  dshHome: string
  harnessVersion: string
  bundleVersion: string
  requestTimeoutMs?: number
  callbackTimeoutMs?: number
  fetch?: typeof globalThis.fetch
  openBrowser?: (url: string) => Promise<void> | void
  now?: () => Date
  store?: EnterpriseStore
  startCallback?: EnterpriseStartCallback
}

/** 一次浏览器登录事务；cancelled 与 abort 分离，避免把「打开浏览器失败」误判成用户取消。 */
interface LoginTransaction {
  readonly flowId: string
  readonly abort: AbortController
  cancelled: boolean
  callback?: EnterpriseLoopbackCallback | undefined
}

// ------------------------------------------------------------------ 输入守卫（中心主体是外部输入，编译期类型不足以信任）
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const asText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
const asEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(value as T) ? (value as T) : null
const asRevision = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
const asPositiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
const asLimit = (value: unknown): number | null =>
  value === null || value === undefined ? null
    : typeof value === 'number' && Number.isSafeInteger(value) ? value : null
const positiveOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback
const hasStreamBody = (body: BodyInit | null | undefined): boolean =>
  typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
/** 逐项转换；任一项非法即整包拒绝，避免半截目录进入 provider 投影。 */
const mapAll = <T>(value: unknown, convert: (item: unknown) => T | null): T[] | null => {
  if (!Array.isArray(value)) return null
  const out: T[] = []
  for (const item of value) {
    const converted = convert(item)
    if (converted === null) return null
    out.push(converted)
  }
  return out
}
const toStatusUser = (value: unknown): EnterpriseStatusUser | null => {
  if (!isRecord(value)) return null
  const id = asText(value['id'], 19)
  const username = asText(value['username'], 100)
  const displayName = asText(value['displayName'], 120)
  const departmentId = value['departmentId']
  if (id === null || username === null || displayName === null) return null
  if (departmentId !== null && asText(departmentId, 19) === null) return null
  return { id, username, displayName, departmentId: departmentId === null ? null : (departmentId as string) }
}
const toCompat = (value: unknown): EnterpriseBootstrapModel['compat'] => {
  if (!isRecord(value)) return undefined
  const thinkingFormat = asEnum(value['thinkingFormat'], THINKING_FORMATS)
  const supports = value['supportsReasoningEffort']
  if (thinkingFormat === null && typeof supports !== 'boolean') return undefined
  return {
    ...(thinkingFormat === null ? {} : { thinkingFormat }),
    ...(typeof supports === 'boolean' ? { supportsReasoningEffort: supports } : {}),
  }
}
const toBootstrapModel = (value: unknown): EnterpriseBootstrapModel | null => {
  if (!isRecord(value)) return null
  const alias = asText(value['alias'], 120)
  const apiProtocol = asEnum(value['apiProtocol'], API_PROTOCOLS)
  const isDefault = value['isDefault']
  if (alias === null || apiProtocol === null || typeof isDefault !== 'boolean') return null
  const name = asText(value['name'], 120)
  const contextWindow = asPositiveInt(value['contextWindow'])
  const maxTokens = asPositiveInt(value['maxTokens'])
  const reasoning = value['reasoningEfforts']
  const reasoningEfforts = reasoning === false
    ? false
    : isRecord(reasoning)
      ? {
          ...(typeof reasoning['off'] === 'string' ? { off: reasoning['off'] as string }
            : reasoning['off'] === null ? { off: null } : {}),
          ...pickStrings(reasoning, REASONING_LEVELS),
        }
      : undefined
  const compat = toCompat(value['compat'])
  return {
    alias, apiProtocol, isDefault,
    ...(name === null ? {} : { name }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(reasoningEfforts === undefined ? {} : { reasoningEfforts }),
    ...(compat === undefined ? {} : { compat }),
  }
}
const pickStrings = (value: Record<string, unknown>, keys: readonly string[], max = 255): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const key of keys) {
    const raw = value[key]
    if (typeof raw === 'string' && raw.length > 0 && raw.length <= max) out[key] = raw
  }
  return out
}
const toBootstrapQuota = (value: unknown): EnterpriseBootstrapQuota | null => {
  if (!isRecord(value)) return null
  const policyId = asText(value['policyId'], 19)
  const scope = asEnum(value['scope'], QUOTA_SCOPES)
  const resourceType = asEnum(value['resourceType'], RESOURCE_TYPES)
  const resourceId = value['resourceId']
  if (policyId === null || scope === null || resourceType === null) return null
  if (resourceId !== null && asText(resourceId, 19) === null) return null
  return {
    policyId, scope, resourceType, resourceId: resourceId === null ? null : (resourceId as string),
    fiveHourTokenLimit: asLimit(value['fiveHourTokenLimit']),
    dailyTokenLimit: asLimit(value['dailyTokenLimit']),
    weeklyTokenLimit: asLimit(value['weeklyTokenLimit']),
    monthlyTokenLimit: asLimit(value['monthlyTokenLimit']),
  }
}
const toCompatibility = (value: unknown): EnterprisePluginCompatibility | null => {
  if (!isRecord(value)) return null
  const range = asText(value['enterpriseBundleRange'], 120)
  const commits = mapAll(value['harnessCommits'], (item) =>
    typeof item === 'string' && /^[0-9a-f]{40}$/.test(item) ? item : null)
  const systems = mapAll(value['operatingSystems'], (item) => asEnum(item, OPERATING_SYSTEMS))
  if (range === null || commits === null || systems === null || commits.length === 0 || systems.length === 0) {
    return null
  }
  return { harnessCommits: commits, enterpriseBundleRange: range, operatingSystems: systems }
}
const toAssignment = (value: unknown): EnterprisePluginAssignment | null => {
  if (!isRecord(value)) return null
  const pluginVersionId = asText(value['pluginVersionId'], 19)
  const packageName = asText(value['packageName'], 214)
  const version = asText(value['version'], 64)
  const sizeBytes = asPositiveInt(value['sizeBytes'])
  const sha256 = value['sha256']
  const signatureBase64 = value['signatureBase64']
  const desiredState = asEnum(value['desiredState'], DESIRED_STATES)
  const downloadUrl = value['downloadUrl']
  const compatibility = toCompatibility(value['compatibility'])
  if (pluginVersionId === null || packageName === null || version === null || sizeBytes === undefined
    || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)
    || typeof signatureBase64 !== 'string' || compatibility === null || desiredState === null
    || typeof value['required'] !== 'boolean' || (downloadUrl !== null && asText(downloadUrl, 2048) === null)) {
    return null
  }
  return {
    pluginVersionId, packageName, version, sizeBytes, sha256, signatureBase64, compatibility,
    downloadUrl: downloadUrl === null ? null : (downloadUrl as string),
    required: value['required'] as boolean, desiredState,
  }
}
/** bootstrap 是外部输入：逐字段守卫（未知字段忽略），任何必需字段非法即整包拒绝。 */
const toBootstrapSnapshot = (value: unknown): EnterpriseBootstrapSnapshot | null => {
  if (!isRecord(value)) return null
  const revision = asRevision(value['revision'])
  const user = toStatusUser(value['user'])
  const device = isRecord(value['device']) ? value['device'] : undefined
  const plugins = isRecord(value['plugins']) ? value['plugins'] : undefined
  const policy = isRecord(value['sessionPolicy']) ? value['sessionPolicy'] : undefined
  if (revision === null || user === null || device === undefined || plugins === undefined
    || policy === undefined || device['status'] !== 'ACTIVE') return null
  const deviceId = asText(device['id'], 19)
  const installationId = device['installationId']
  const models = mapAll(value['models'], toBootstrapModel)
  const quotas = mapAll(value['quotas'], toBootstrapQuota)
  const pluginsRevision = asRevision(plugins['revision'])
  const assignments = mapAll(plugins['assignments'], toAssignment)
  const retentionDays = asPositiveInt(policy['retentionDays'])
  const maxBatchBytes = asPositiveInt(policy['maxBatchBytes'])
  if (deviceId === null || typeof installationId !== 'string' || !UUID_V4.test(installationId)
    || models === null || quotas === null || pluginsRevision === null || assignments === null
    || typeof policy['enabled'] !== 'boolean' || retentionDays === undefined || maxBatchBytes === undefined) {
    return null
  }
  return {
    revision, user, models, quotas,
    device: { id: deviceId, installationId, status: 'ACTIVE' },
    plugins: { revision: pluginsRevision, assignments },
    sessionPolicy: { enabled: policy['enabled'], retentionDays, maxBatchBytes },
  }
}
// ------------------------------------------------------------------ 浏览器交接

/** 无 shell 的系统浏览器交接；spawn 失败必须显式拒绝，否则登录会静默挂到超时。 */
const defaultOpenBrowser = (url: string): Promise<void> => new Promise<void>((resolve, reject) => {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['explorer.exe', [url]]
      : ['xdg-open', [url]]
  let child: ChildProcess
  try {
    child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
  } catch (error) {
    reject(error instanceof Error ? error : new Error('cannot spawn browser'))
    return
  }
  child.once('error', reject)
  child.once('spawn', () => {
    child.unref()
    resolve()
  })
})

const cancelledError = (): EnterprisePlatformError =>
  new EnterprisePlatformError('ENT_AUTH_CANCELLED', '企业登录已取消')

/**
 * 企业控制面状态机。不变量：
 * 1. 状态只能按 UNCONFIGURED/SIGNED_OUT → AUTHORIZING → ENROLLING → BOOTSTRAPPING → READY 推进，
 *    失败落 FAILED/CANCELLED/DEVICE_REVOKED/AUTH_EXPIRED，且只携带稳定错误码（绝不携带令牌与中心原文）；
 * 2. access token 只存在内存与凭据文件；轮换出的新 refreshToken 在交给调用方之前立即原子落盘；
 * 3. accessTokenExpiresAt 提前 60 秒过期；401 由本类做一次「续期 + 重放」，且只做一次；
 * 4. setServerUrl 变更地址时清空旧凭据，有活动会话时拒绝改地址；
 * 5. 网络/文件/子进程操作都收敛为 EnterprisePlatformError 或状态码，绝不 process.exit、绝不抛到 Cordis 顶层。
 */
export class EnterpriseControlPlane {
  private readonly store: EnterpriseStore
  private readonly now: () => Date
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly openBrowser: (url: string) => Promise<void> | void
  private readonly startCallback: EnterpriseStartCallback
  private readonly requestTimeoutMs: number
  private readonly callbackTimeoutMs: number
  private readonly harnessVersion: string
  private readonly bundleVersion: string
  private readonly installationId: string
  private readonly deviceName: string
  private readonly listeners = new Set<(status: EnterprisePlatformStatus) => void>()
  private baseUrl: string | null = null
  private http: EnterpriseHttpClient | undefined
  private auth: EnterpriseAuthClient | undefined
  private device: EnterpriseDeviceClient | undefined
  private accessTokenValue: string | null = null
  private accessTokenExpiresAtMs = 0
  private refreshTokenValue: string | null = null
  private refreshExpiresInValue: number | null = null
  private lastRotationError: EnterprisePlatformError | undefined
  private currentStatus: EnterprisePlatformStatus
  private snapshot: EnterpriseBootstrapSnapshot | undefined
  private connectedAt: string | undefined
  private login: LoginTransaction | undefined
  private loginTask: Promise<void> | undefined
  private refreshTask: Promise<void> | undefined
  private rotateTask: Promise<string | null> | undefined
  private sessionGeneration = 0
  private disposed = false
  constructor(options: EnterpriseControlPlaneOptions) {
    this.harnessVersion = options.harnessVersion
    this.bundleVersion = options.bundleVersion
    this.requestTimeoutMs = positiveOr(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS)
    this.callbackTimeoutMs = positiveOr(options.callbackTimeoutMs, DEFAULT_CALLBACK_TIMEOUT_MS)
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.openBrowser = options.openBrowser ?? defaultOpenBrowser
    this.now = options.now ?? ((): Date => new Date())
    this.startCallback = options.startCallback ?? ((callbackOptions) => startLoopbackCallback({
      timeoutMs: callbackOptions.timeoutMs,
      path: callbackOptions.path,
    }))
    const now = options.now
    this.store = options.store ?? new EnterpriseStore(
      now === undefined ? { dshHome: options.dshHome } : { dshHome: options.dshHome, now },
    )
    this.installationId = resolveInstallationId(this.store)
    const config = this.store.readConfig()
    this.deviceName = config.deviceName ?? defaultDeviceName()
    const credentials = this.store.readCredentials()
    this.refreshTokenValue = credentials.refreshToken
    this.refreshExpiresInValue = credentials.refreshExpiresIn
    // 进程重启后的静默恢复：未过期的 access token 直接进内存，否则留给 refresh() 轮换。
    if (credentials.accessToken !== null && credentials.accessTokenExpiresAt !== null) {
      const expiresAt = Date.parse(credentials.accessTokenExpiresAt)
      if (Number.isFinite(expiresAt) && this.now().getTime() < expiresAt - EXPIRY_MARGIN_MS) {
        this.accessTokenValue = credentials.accessToken
        this.accessTokenExpiresAtMs = expiresAt
      }
    }
    this.applyBaseUrl(this.readStoredServerUrl(config.serverUrl))
    this.currentStatus = {
      state: this.baseUrl === null ? 'UNCONFIGURED' : 'SIGNED_OUT',
      bundleVersion: this.bundleVersion,
      platformUrl: this.baseUrl,
    }
  }
  /** 浏览器安全连接事实的副本；永远不含令牌或中心原文。 */
  status(): EnterprisePlatformStatus {
    const { user, ...rest } = this.currentStatus
    return { ...rest, ...(user === undefined ? {} : { user: { ...user } }) }
  }
  /** 订阅状态快照；返回幂等退订器，监听器异常不会影响状态机。 */
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  /** 最新已校验 bootstrap 副本；未就绪时为 undefined。 */
  bootstrap(): EnterpriseBootstrapSnapshot | undefined {
    return this.snapshot === undefined ? undefined : structuredClone(this.snapshot)
  }
  serverUrl(): string | null { return this.baseUrl }
  /** 当前内存 access token；只供本机网关代理注入 Bearer，绝不外发给浏览器。 */
  accessToken(): string | null { return this.accessTokenValue }
  /**
   * 设定中心地址；地址变更即清空旧凭据，有活动会话时拒绝（必须先 logout）。
   * @throws EnterprisePlatformError ENT_SERVER_URL_INVALID / ENT_PERMISSION_DENIED / ENT_PLATFORM_DISPOSED
   */
  async setServerUrl(url: string): Promise<{ serverUrl: string }> {
    this.assertOpen()
    if (SESSION_STATES.has(this.currentStatus.state)) {
      throw new EnterprisePlatformError('ENT_PERMISSION_DENIED', '请先退出登录再修改企业服务地址')
    }
    const resolved = normalizeServerUrl(url)
    this.cancelLogin()
    await this.settle(this.loginTask)
    if (resolved !== this.baseUrl) {
      this.clearSession()
      this.applyBaseUrl(resolved)
    }
    this.store.writeConfig({ serverUrl: resolved })
    this.transition('SIGNED_OUT')
    return { serverUrl: resolved }
  }
  /** 幂等启动一次浏览器 PKCE 登录；立即返回 flowId，进度经 subscribe 推送。 */
  async startLogin(): Promise<EnterpriseLoginFlow> {
    this.assertOpen()
    if (this.baseUrl === null) throw new EnterprisePlatformError('ENT_INVALID_REQUEST', '请先配置企业服务地址')
    const running = this.login
    if (running !== undefined) return { flowId: running.flowId }
    if (SESSION_STATES.has(this.currentStatus.state)) {
      throw new EnterprisePlatformError('ENT_INVALID_REQUEST', '请先退出登录再重新登录')
    }
    this.resetTransientState()
    const transaction: LoginTransaction = {
      flowId: `flow_${createState()}`, abort: new AbortController(), cancelled: false,
    }
    this.login = transaction
    this.transition('AUTHORIZING')
    this.loginTask = this.runLogin(transaction)
      .catch((error: unknown) => {
        this.finishLoginFailure(transaction, error)
      })
      .finally(() => {
        void this.closeCallback(transaction)
        if (this.login === transaction) this.login = undefined
      })
    return { flowId: transaction.flowId }
  }
  /** 显式刷新：重启后的静默恢复与目录刷新共用同一入口（一次请求，不做定时轮询）。 */
  async refresh(): Promise<EnterprisePlatformStatus> {
    if (this.disposed || this.baseUrl === null) return this.status()
    const running = this.refreshTask
    if (running !== undefined) {
      await this.settle(running)
      return this.status()
    }
    const task = this.performRefresh()
    this.refreshTask = task
    try {
      await this.settle(task)
    } finally {
      if (this.refreshTask === task) this.refreshTask = undefined
    }
    return this.status()
  }
  /** 登出：中心可达时先撤销令牌，无论成败都清空本地认证态；本方法不抛异常。 */
  async logout(): Promise<void> {
    if (this.disposed) return
    this.cancelLogin()
    await this.settle(this.loginTask)
    if (this.baseUrl !== null && this.accessTokenValue !== null && this.auth !== undefined) {
      try {
        await this.auth.logout()
      } catch {
        // 中心不可达也必须完成本地登出，否则用户无法切换账号或地址。
      }
    }
    this.clearSession()
    this.transition(this.baseUrl === null ? 'UNCONFIGURED' : 'SIGNED_OUT')
  }
  /** 同源带 Bearer 的平台请求；非 2xx 原样返回 Response，由调用方决定如何解码。 */
  async request(path: string, init: EnterpriseRequestInit = {}): Promise<Response> {
    this.assertOpen()
    if (this.baseUrl === null) throw new EnterprisePlatformError('ENT_INVALID_REQUEST', '企业服务地址未配置')
    const token = await this.ensureAccessToken(false)
    if (token === null) {
      throw this.lastRotationError
        ?? new EnterprisePlatformError('ENT_AUTH_REQUIRED', '企业登录状态不可用，请重新登录')
    }
    const http = this.requireHttp()
    const first = await http.requestResponse(path, init)
    if (first.status !== 401 || hasStreamBody(init.body)) return first
    // EnterpriseHttpClient 的 raw 出口不做 401 重放，这里补齐：续期成功才重放，且只重放一次。
    const generation = this.sessionGeneration
    const refreshed = await this.rotateRefreshToken()
    if (refreshed === null || generation !== this.sessionGeneration) return first
    try {
      await first.body?.cancel()
    } catch {
      // 正文已消费或不可取消都不影响重放本身。
    }
    return await http.requestResponse(path, init)
  }
  /** 中止登录与在途任务、关闭回环端口并清空内存令牌；不动磁盘上的会话凭据。 */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.cancelLogin()
    this.listeners.clear()
    this.resetTransientState()
    let timer: NodeJS.Timeout | undefined
    const deadline = new Promise<void>((resolve) => { timer = setTimeout(resolve, DISPOSE_DEADLINE_MS) })
    try {
      const pending = [this.loginTask, this.refreshTask, this.rotateTask]
      await Promise.race([Promise.all(pending.map((task) => this.settle(task))), deadline])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
    this.http?.dispose()
  }

  // ---------------------------------------------------------------- 登录流程
  private async runLogin(transaction: LoginTransaction): Promise<void> {
    const { baseUrl } = this
    const { auth, device } = this
    if (baseUrl === null || auth === undefined || device === undefined) {
      throw new EnterprisePlatformError('ENT_INVALID_REQUEST', '企业服务不可用')
    }
    const installationId = this.installationId
    const state = createState()
    const verifier = createCodeVerifier()
    const callback = await this.startCallback({
      expectedState: state, timeoutMs: this.callbackTimeoutMs, path: ENTERPRISE_CALLBACK_PATH,
    })
    transaction.callback = callback
    transaction.abort.signal.throwIfAborted()
    const query = new URLSearchParams({
      client_id: ENTERPRISE_DESKTOP_CLIENT_ID, redirect_uri: callback.redirectUri, state,
      code_challenge: codeChallengeS256(verifier), code_challenge_method: 'S256', installation_id: installationId,
    })
    // 契约 paths/auth.yaml#Authorize：GET authorize 声明 accept:application/json(且不接受
    // HTML)时回 200 JSON(登录事务+身份源)。这里匿名 HTTP 打一次 authorize 走同源 JSON 启动
    // 面(与 Token 面接受 DSH_DESKTOP 的口径一致)。★不 await：这是一次旁路打点,登录的关键
    // 路径仍由下面 openBrowser + waitForCode 那条 PKCE 浏览器路决定——打点失败(含只 stub 了
    // token 的测试夹具、网络抖动)不得改变登录的失败语义,故接住失败不进主流程;loginTask 的
    // 失败面仍由 token/enroll/bootstrap 各步自身决定,不因这一跳而改变。
    void auth.createTransaction({
      redirectUri: callback.redirectUri, state,
      codeChallenge: codeChallengeS256(verifier), installationId,
    }).catch(() => undefined)
    let result: { code: string; state: string }
    try {
      const settled = await Promise.all([
        this.openInBrowser(`${baseUrl}${AUTHORIZE_PATH}?${query.toString()}`),
        callback.waitForCode(transaction.abort.signal),
      ])
      result = settled[1]
    } catch (error) {
      transaction.abort.abort() // 打开浏览器失败或回调失败都必须立刻释放监听端口，避免悬挂。
      throw error
    }
    // state 相等性由本编排层裁决，pkce 层只负责取回原始回调参数。
    if (transaction.cancelled) throw cancelledError()
    if (result.state !== state) {
      throw new EnterprisePlatformError('ENT_AUTH_CODE_INVALID', '企业登录回调 state 校验失败')
    }
    const tokenData = await auth.exchangeToken({
      grantType: 'authorization_code', code: result.code, clientId: ENTERPRISE_DESKTOP_CLIENT_ID,
      redirectUri: callback.redirectUri, codeVerifier: verifier, installationId,
    })
    if (transaction.cancelled) throw cancelledError()
    this.applyTokenData(tokenData)
    this.persistCredentials()
    this.transition('ENROLLING')
    const enrolled: EnterpriseDeviceView = await device.enroll({
      installationId, name: this.deviceName, platform: osPlatform(),
      harnessVersion: this.harnessVersion, enterpriseBundleVersion: this.bundleVersion,
    })
    if (enrolled.status !== 'ACTIVE') {
      throw new EnterprisePlatformError('ENT_DEVICE_REVOKED', '企业设备未处于 ACTIVE 状态')
    }
    this.transition('BOOTSTRAPPING')
    await this.loadBootstrap()
    this.transition('READY')
  }
  private finishLoginFailure(transaction: LoginTransaction, error: unknown): void {
    if (this.disposed || this.login !== transaction) return
    const code = error instanceof EnterprisePlatformError ? error.code : 'ENT_NETWORK_ERROR'
    if (code === 'ENT_DEVICE_REVOKED') {
      this.expireDevice()
      return
    }
    this.resetTransientState()
    if (transaction.cancelled || code === 'ENT_AUTH_CANCELLED') {
      this.transition('CANCELLED', { errorCode: 'ENT_AUTH_CANCELLED' })
      return
    }
    this.transition('FAILED', { errorCode: code })
  }

  // ---------------------------------------------------------------- 令牌
  private isAccessTokenFresh(): boolean {
    return this.accessTokenValue !== null
      && this.now().getTime() < this.accessTokenExpiresAtMs - EXPIRY_MARGIN_MS
  }
  /** 取可用 access token；必要时做单次 refresh_token 轮换。返回 null 表示必须重新登录。 */
  private async ensureAccessToken(force: boolean): Promise<string | null> {
    if (!force && this.isAccessTokenFresh()) return this.accessTokenValue
    if (this.refreshTokenValue === null) return null
    return await this.rotateRefreshToken()
  }
  /** 并发去重的令牌轮换：同一时刻最多一个 refresh 在途，避免轮换风暴互相作废新令牌。 */
  private async rotateRefreshToken(): Promise<string | null> {
    const running = this.rotateTask
    if (running !== undefined) return await running
    const task = this.performRotation()
    this.rotateTask = task
    try {
      return await task
    } finally {
      if (this.rotateTask === task) this.rotateTask = undefined
    }
  }
  private async performRotation(): Promise<string | null> {
    const { auth, refreshTokenValue: refreshToken, baseUrl } = this
    if (auth === undefined || refreshToken === null || baseUrl === null) return null
    const generation = this.sessionGeneration
    try {
      const data = await auth.exchangeToken({
        grantType: 'refresh_token', refreshToken,
        clientId: ENTERPRISE_DESKTOP_CLIENT_ID, installationId: this.installationId,
      })
      if (generation !== this.sessionGeneration) return null
      this.applyTokenData(data)
      // 旧 refreshToken 在服务端即刻作废，必须先原子落盘新值再交给调用方使用。
      this.persistCredentials()
      this.lastRotationError = undefined
      return this.accessTokenValue
    } catch (error) {
      if (generation !== this.sessionGeneration) return null
      const platformError = error instanceof EnterprisePlatformError
        ? error
        : new EnterprisePlatformError('ENT_NETWORK_ERROR', '企业令牌续期失败', { retryable: true })
      this.lastRotationError = platformError
      if (platformError.code === 'ENT_DEVICE_REVOKED') this.expireDevice()
      else if (AUTH_FAILURES.has(platformError.code)) this.expireAuthentication(platformError.code)
      return null
    }
  }
  private applyTokenData(data: EnterpriseTokenData): void {
    this.accessTokenValue = data.accessToken
    this.accessTokenExpiresAtMs = this.now().getTime() + data.expiresIn * 1_000
    this.refreshTokenValue = data.refreshToken
    this.refreshExpiresInValue = data.refreshExpiresIn
  }
  private persistCredentials(): void {
    const { accessTokenValue: accessToken, refreshTokenValue: refreshToken } = this
    if (refreshToken === null) return
    this.store.writeCredentials({
      accessToken, refreshToken, clientId: ENTERPRISE_DESKTOP_CLIENT_ID,
      accessTokenExpiresAt: accessToken === null ? null : new Date(this.accessTokenExpiresAtMs).toISOString(),
      refreshExpiresIn: this.refreshExpiresInValue,
    })
  }

  // ---------------------------------------------------------------- 刷新与 bootstrap
  private async performRefresh(): Promise<void> {
    if (this.accessTokenValue === null && this.refreshTokenValue === null) {
      // 无凭据可恢复：保留 DEVICE_REVOKED/AUTH_EXPIRED 等终态，只把活动态收敛回登出。
      if (SESSION_STATES.has(this.currentStatus.state)) this.transition('SIGNED_OUT')
      return
    }
    const generation = this.sessionGeneration
    this.transition('REFRESHING')
    const token = await this.ensureAccessToken(false)
    if (generation !== this.sessionGeneration) return
    if (token === null) {
      if (this.currentStatus.state === 'REFRESHING') {
        this.transition('AUTH_EXPIRED', { errorCode: this.lastRotationError?.code ?? 'ENT_AUTH_REQUIRED' })
      }
      return
    }
    try {
      await this.loadBootstrap()
      if (generation !== this.sessionGeneration) return
      this.transition('READY')
    } catch (error) {
      if (generation !== this.sessionGeneration) return
      this.applySessionFailure(error)
    }
  }
  /** 会话期失败的统一映射：设备撤销与认证失败必须作废凭据，其余保留 Grant 并停在可重试态。 */
  private applySessionFailure(error: unknown): void {
    const code = error instanceof EnterprisePlatformError ? error.code : 'ENT_NETWORK_ERROR'
    if (code === 'ENT_DEVICE_REVOKED') {
      this.expireDevice()
      return
    }
    if (AUTH_FAILURES.has(code)) {
      this.expireAuthentication(code)
      return
    }
    this.transition('REFRESHING', { errorCode: code })
  }
  private async loadBootstrap(): Promise<void> {
    const response = await this.request(BOOTSTRAP_PATH, { method: 'GET', headers: { accept: 'application/json' } })
    if (!response.ok) throw await this.decodeFailure(response)
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new EnterprisePlatformError(
        'ENT_RESPONSE_INVALID', '企业 bootstrap 响应不是合法 JSON', { httpStatus: response.status },
      )
    }
    const snapshot = toBootstrapSnapshot(unwrapEnvelope(payload))
    if (snapshot === null) {
      throw new EnterprisePlatformError('ENT_RESPONSE_INVALID', '企业 bootstrap 响应结构不合法')
    }
    if (snapshot.device.installationId !== this.installationId) {
      throw new EnterprisePlatformError('ENT_DEVICE_REVOKED', '企业 bootstrap 设备与本地 installation 不一致')
    }
    this.snapshot = snapshot
    this.connectedAt = this.now().toISOString()
  }
  private async decodeFailure(response: Response): Promise<EnterprisePlatformError> {
    let payload: unknown
    try { payload = await response.clone().json() } catch { payload = undefined }
    return toPlatformError(payload, response.status, response.headers)
  }

  // ---------------------------------------------------------------- 状态机内部
  private applyBaseUrl(url: string | null): void {
    this.baseUrl = url
    if (url === null) {
      this.http = undefined
      this.auth = undefined
      this.device = undefined
      return
    }
    // 刻意不注册 onUnauthorized：续期只由本类 request() 做一次，否则 refresh_token grant 自身的 401 会重入轮换并自锁。
    const http = new EnterpriseHttpClient({
      baseUrl: url, timeoutMs: this.requestTimeoutMs, fetch: this.fetchImpl,
      accessToken: () => this.accessTokenValue, clientId: ENTERPRISE_DESKTOP_CLIENT_ID,
    })
    this.http = http
    this.auth = new EnterpriseAuthClient(http)
    this.device = new EnterpriseDeviceClient(http)
  }
  private readStoredServerUrl(raw: string | null): string | null {
    if (raw === null) return null
    try { return normalizeServerUrl(raw) } catch { return null } // 历史脏地址视为未配置
  }
  private requireHttp(): EnterpriseHttpClient {
    const http = this.http
    if (http === undefined) throw new EnterprisePlatformError('ENT_INVALID_REQUEST', '企业服务地址未配置')
    return http
  }
  /**
   * 只清内存态：作废在途异步任务的会话代次，但保留磁盘上的 Grant。
   * 用于「开始新登录」「登录失败」「dispose」——用户没有显式登出，未过期的 refresh token 必须留得住。
   */
  private resetTransientState(): void {
    this.sessionGeneration++
    this.accessTokenValue = null
    this.accessTokenExpiresAtMs = 0
    this.lastRotationError = undefined
    this.snapshot = undefined
    this.connectedAt = undefined
  }
  /** 清内存态 + 磁盘凭据：用户登出、地址变更或中心判定凭据失效时使用。 */
  private clearSession(): void {
    this.resetTransientState()
    this.refreshTokenValue = null
    this.refreshExpiresInValue = null
    this.store.clearCredentials()
  }
  private expireAuthentication(errorCode: string): void {
    this.clearSession()
    this.transition('AUTH_EXPIRED', { errorCode })
  }
  private expireDevice(): void {
    this.clearSession()
    this.transition('DEVICE_REVOKED', { errorCode: 'ENT_DEVICE_REVOKED' })
  }
  private cancelLogin(): boolean {
    const transaction = this.login
    if (transaction === undefined) return false
    transaction.cancelled = true
    transaction.abort.abort()
    return true
  }
  private async openInBrowser(url: string): Promise<void> {
    try { await this.openBrowser(url) } catch {
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', '无法打开系统浏览器完成企业登录', {
        retryable: true,
      })
    }
  }
  private async closeCallback(transaction: LoginTransaction): Promise<void> {
    const callback = transaction.callback
    transaction.callback = undefined
    if (callback === undefined) return
    try { await callback.close() } catch { /* 关闭失败已由 pkce 层兜底释放端口，这里不再上抛 */ }
  }
  private transition(state: EnterpriseConnectionState, detail: { errorCode?: string } = {}): void {
    if (this.disposed) return
    const snapshot = this.snapshot
    this.currentStatus = {
      state,
      bundleVersion: this.bundleVersion,
      platformUrl: this.baseUrl,
      ...(detail.errorCode === undefined ? {} : { errorCode: detail.errorCode }),
      ...(snapshot === undefined ? {} : {
        user: snapshot.user,
        revision: snapshot.revision,
        ...(this.connectedAt === undefined ? {} : { connectedAt: this.connectedAt }),
      }),
    }
    const published = this.status()
    for (const listener of this.listeners) {
      try { listener(published) } catch { /* 单个订阅者异常不得打断状态机或影响其他订阅者 */ }
    }
  }
  private assertOpen(): void {
    if (this.disposed) throw new EnterprisePlatformError('ENT_PLATFORM_DISPOSED', '企业平台客户端已释放')
  }
  private async settle(task: Promise<unknown> | undefined): Promise<void> {
    if (task === undefined) return
    try { await task } catch { /* 各任务的失败已在自身 catch 中转为状态码，这里只负责等待其结束 */ }
  }
}