/**
 * [INPUT]: 依赖 Cordis Service/WebServer/settings、官方 settings 投影的 volatile Config 引用、configEditor 的只读 entry 读面、credentials、T02 contracts、PKCE/installation/browser 原语与 Node fetch
 * [OUTPUT]: 提供 ctx.enterprisePlatform、启动恢复、按需刷新/Token 轮换、品牌缓存的三个取数时机与地址写入失败的结构化诊断日志；仅无活动会话时允许清理凭据并修改 Server
 * [POS]: platform-client 的 Host 业务核心，跨 Web/Desktop 复用官方凭据平面且不向 Client UI 暴露任何 Token；品牌缓存在这里装配（构造、登录成功、Server 切换各刷新一次），每个 `ENT_SETTINGS_UNAVAILABLE` 抛出点都留痕
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { platform as hostPlatform } from 'node:os'
import { Context, Service } from '@deepseek-ai/cordis'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import {
  decodeEnterpriseError,
  zDeviceResponse,
  zTokenResponse,
  type DeviceEnrollRequest,
  type EnterpriseErrorCode,
  type TokenRequest,
} from '@dshent/contracts'
import { EnterpriseBrandingCache } from './branding.js'
import { openSystemBrowser } from './browser.js'
import {
  loadOrCreateInstallation,
  type InstallationRecord,
} from './installation.js'
import {
  registerEnterpriseLocalApi,
  type WebServerRoutePort,
} from './local-api.js'
import { createPkceS256, PkceLoopbackError, startLoopbackCallback, type LoopbackCallback } from './pkce.js'
import { PlatformCredentialManager } from './platform-credentials.js'
import { settingsDiagnostics, thrownErrorDiagnostics } from './settings-diagnostics.js'
import {
  EnterprisePlatformError,
  settingsReference,
  zBootstrapResponse,
  type BootstrapSnapshot,
  type EnterpriseLoginFlow,
  type EnterprisePlatformConfig,
  type EnterprisePlatformInternals,
  type EnterprisePlatformStatus,
  type SettingsReference,
} from './types.js'

const AUTH_PATH = '/enterprise/auth/v1'
const API_PATH = '/enterprise/api/v1'
const TRANSITIONAL_REQUEST_PATHS = new Set([
  `${AUTH_PATH}/logout`,
  `${API_PATH}/bootstrap`,
  `${API_PATH}/devices/enroll`,
])

declare module '@deepseek-ai/dsh-settings' {
  interface SettingsProvider {
    /**
     * 声明本插件实例的设置页策略。官方 0.1.7-rc.2 的 `SettingsForms.configure`
     * (`dsh-settings/lib/index.js:370`，`docs/subsystems/settings.md`) 取代了 0.1.5-rc.2 的
     * 命名空间注册面；本 workspace 的官方依赖基线仍是 0.1.5-rc.2，故在此补齐该成员。
     *
     * @param presentation - 自动页面策略；`auto` 默认 true。
     * @param owner - 策略归属的插件实例；缺省为调用方 fiber。
     * @returns 撤销策略的 disposer。
     */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    enterprisePlatform: EnterprisePlatformService
  }
}

interface ResolvedConfig {
  readonly harnessVersion: string
  readonly bundleVersion: string
  readonly requestTimeoutMs: number
  readonly disposeTimeoutMs: number
  readonly callbackTimeoutMs: number
  readonly dshHome?: string
  readonly installationName?: string
}

interface LoginTransaction {
  readonly flowId: string
  readonly abort: AbortController
  callback?: LoopbackCallback
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved <= 0) throw new TypeError(`${name} must be a positive safe integer`)
  return resolved
}

function resolveBaseUrl(value: string | undefined): URL | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const baseUrl = new URL(value.trim())
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new TypeError('baseUrl must use http or https')
  }
  if (baseUrl.username !== '' || baseUrl.password !== '' || baseUrl.search !== '' || baseUrl.hash !== ''
    || (baseUrl.pathname !== '' && baseUrl.pathname !== '/')) {
    throw new TypeError('baseUrl must be an origin without credentials, query, fragment, or path')
  }
  baseUrl.pathname = '/'
  return baseUrl
}

function resolveConfig(config: EnterprisePlatformConfig): ResolvedConfig {
  if (typeof config.harnessVersion !== 'string' || config.harnessVersion.length === 0
    || typeof config.bundleVersion !== 'string' || config.bundleVersion.length === 0) {
    throw new TypeError('harnessVersion and bundleVersion are required')
  }
  return {
    harnessVersion: config.harnessVersion,
    bundleVersion: config.bundleVersion,
    requestTimeoutMs: positiveInteger(config.requestTimeoutMs, 30_000, 'requestTimeoutMs'),
    disposeTimeoutMs: positiveInteger(config.disposeTimeoutMs, 3_000, 'disposeTimeoutMs'),
    callbackTimeoutMs: positiveInteger(config.callbackTimeoutMs, 5 * 60_000, 'callbackTimeoutMs'),
    ...(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
    ...(config.installationName === undefined ? {} : { installationName: config.installationName }),
  }
}

function cloneStatus(status: EnterprisePlatformStatus): EnterprisePlatformStatus {
  return structuredClone(status)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * 读取 owner Loader entry 的本地 id。官方 settings 的表单命名空间就是活动 profile entry 的 id，
 * 而 entry 由官方 Loader 增广到 fiber 上；platform-client 不依赖 loader 包的类型，故按结构读取。
 *
 * @param ctx - 创建本 Service 的上下文。
 * @returns owner entry id；非 Loader 组合下 undefined。
 */
function ownerSettingsNamespace(ctx: Context): string | undefined {
  const entry: unknown = Reflect.get(ctx.fiber, 'entry')
  if (typeof entry !== 'object' || entry === null) return undefined
  const options: unknown = Reflect.get(entry, 'options')
  if (typeof options !== 'object' || options === null) return undefined
  const id: unknown = Reflect.get(options, 'id')
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/** 官方 Loader owner entry 的窄视图；settings 文档刚写入的原始配置就在 `options.config`。 */
interface OwnerEntryPort {
  readonly options: { readonly id?: unknown, readonly config?: unknown }
}

/** 官方 `ctx.configEditor`：活动 profile 里可寻址的配置行。 */
interface ConfigEditorPort {
  entries(): readonly OwnerEntryPort[]
}

/**
 * 读取官方 settings 文档里 owner entry 的原始配置。
 *
 * 官方「写文档 → 广播 `settings/document-updated` → 提交 volatile 引用」不是同一个同步段，
 * 广播时 volatile 引用可能还是上一份值；Loader 的 entry 视图在广播前已带上新配置。
 *
 * @param ctx - 创建本 Service 的上下文。
 * @param entryId - owner profile entry 的 id。
 * @returns 该 entry 的组合配置；非 Loader 组合或读不到时返回 undefined。
 */
function ownerEntryConfig(ctx: Context, entryId: string): Record<string, unknown> | undefined {
  const editor = ctx.get('configEditor') as ConfigEditorPort | undefined
  const row = editor?.entries().find(entry => entry.options.id === entryId)
  const config: unknown = row?.options.config
  return typeof config === 'object' && config !== null && !Array.isArray(config)
    ? config as Record<string, unknown>
    : undefined
}

/** Host 独占的企业控制面，也是内存平台 Token 的唯一读取者。 */
export class EnterprisePlatformService extends Service {
  static inject = ['webServer', 'credentials']

  private readonly config: ResolvedConfig
  private readonly fetch: typeof globalThis.fetch
  private readonly platformCredentials: PlatformCredentialManager
  private readonly branding: EnterpriseBrandingCache
  private readonly openBrowser: (url: string, signal: AbortSignal) => Promise<void>
  private readonly now: () => Date
  private readonly createFlowId: () => string
  private readonly createState: () => string
  private readonly installation: Promise<InstallationRecord>
  private readonly lifetime = new AbortController()
  private readonly activeRequests = new Set<AbortController>()
  private readonly listeners = new Set<(status: EnterprisePlatformStatus) => void>()
  private readonly disposeLocalApi: () => void
  private readonly logger: Context['logger']
  private readonly compositionServerUrl: string
  private readonly serverUrlReference: SettingsReference<string> | undefined
  private readonly settingsNamespace: string | undefined
  /** 组合根上下文；诊断只在失败路径上按结构读 `configEditor`/settings，不做任何写入。 */
  private readonly ownerContext: Context
  /** 官方 settings 实例；仅用于失败时记录其可写能力位，不调用会广播的 `describe()`。 */
  private settingsService: unknown

  private currentStatus: EnterprisePlatformStatus
  private baseUrl: URL | undefined
  /** 官方 settings 的写入端口；owner entry 未声明 volatile 地址字段或 settings 缺席时保持 undefined。 */
  private settingsWrite: ((serverUrl: string) => Promise<void>) | undefined
  private bootstrapSnapshot: BootstrapSnapshot | undefined
  private connectedAt: string | undefined
  private login: LoginTransaction | undefined
  private loginTask: Promise<void> | undefined
  private refreshTask: Promise<void> | undefined
  private restoreOrigin: string | undefined
  private sessionGeneration = 0
  private loggingOut = false
  private configuring: string | undefined
  private disposed = false
  private disposeTask: Promise<void> | undefined

  constructor(
    ctx: Context & { readonly webServer: WebServerRoutePort, readonly credentials: CredentialProvider },
    config: EnterprisePlatformConfig,
    internals: EnterprisePlatformInternals = {},
  ) {
    const resolvedConfig = resolveConfig(config)
    const baseUrl = resolveBaseUrl(config.baseUrl)
    super(ctx, 'enterprisePlatform')
    this.config = resolvedConfig
    this.baseUrl = baseUrl
    this.compositionServerUrl = baseUrl?.origin ?? ''
    this.serverUrlReference = settingsReference<string>(config.serverUrl)
    this.fetch = internals.fetch ?? globalThis.fetch
    this.openBrowser = internals.openBrowser ?? openSystemBrowser
    this.logger = ctx.logger
    this.now = internals.now ?? (() => new Date())
    this.createFlowId = internals.createFlowId ?? randomUUID
    this.createState = internals.createState ?? (() => randomBytes(32).toString('base64url'))
    this.currentStatus = {
      state: baseUrl === undefined ? 'UNCONFIGURED' : 'SIGNED_OUT',
      bundleVersion: this.config.bundleVersion,
      platformUrl: baseUrl?.origin ?? null,
      transport: 'webServer.register',
    }
    this.installation = loadOrCreateInstallation({
      ...(this.config.dshHome === undefined ? {} : { dshHome: this.config.dshHome }),
      ...(this.config.installationName === undefined ? {} : { name: this.config.installationName }),
      ...internals.installation,
    })
    this.platformCredentials = new PlatformCredentialManager(
      ctx.credentials,
      this.installation,
      this.now,
      async (refreshBaseUrl, request, signal) => {
        const parsed = zTokenResponse.safeParse(await this.fetchPublicJsonAt(
          refreshBaseUrl,
          `${AUTH_PATH}/token`,
          { body: JSON.stringify(request), headers: { 'content-type': 'application/json' }, method: 'POST' },
          signal,
        ))
        if (!parsed.success) {
          throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'platform returned an invalid token', true)
        }
        return parsed.data.data
      },
      origin => !this.disposed && this.baseUrl?.origin === origin,
      () => { this.logger.warn('enterprise platform: failed to remove rejected refresh credential') },
    )
    void this.installation.catch(() => {
      this.transition('FAILED', { errorCode: 'ENT_PLATFORM_UNAVAILABLE' })
    })
    // 品牌走免登录取数：接口不存在/离线/超时都只是没有企业品牌，ui 回落内置默认，绝不阻断界面。
    this.branding = new EnterpriseBrandingCache({
      fetch: (input, init) => this.executeFetch(input, init),
      ...(this.config.dshHome === undefined ? {} : { dshHome: this.config.dshHome }),
      onFailure: (operation, error) => {
        this.logger.warn(`enterprise platform: enterprise branding is unavailable [operation=${operation}]`, error)
      },
      serverUrl: () => this.baseUrl,
    })
    this.disposeLocalApi = registerEnterpriseLocalApi(ctx.webServer, {
      platform: {
        status: () => this.status(),
        refresh: () => this.refresh(),
        setServerUrl: serverUrl => this.setServerUrl(serverUrl),
        startLogin: () => this.startLogin(),
        cancelLogin: () => this.cancelLogin(),
        logout: () => this.logout(),
        bootstrap: () => this.bootstrap(),
        listPresets: signal => this.listPresets(signal),
        getPreset: (packageId, signal) => this.getPreset(packageId, signal),
      },
      pluginStatus: internals.pluginStatus ?? (() => ({ assignmentRevision: 0, plugins: [] })),
      branding: {
        asset: slot => this.branding.asset(slot),
        document: () => this.branding.document(),
      },
      ...(internals.pluginAction === undefined ? {} : { pluginAction: internals.pluginAction }),
      ...(internals.uninstallPlugin === undefined ? {} : { uninstallPlugin: internals.uninstallPlugin }),
      ...(internals.sessionSync === undefined ? {} : { sessionSync: internals.sessionSync }),
      // 本地路由把异常投影成 HTTP 状态码时留痕：这是前端拿到的 `error.code` 与 Host 侧原始异常的接缝。
      onError: (operation, error, status) => {
        this.logger.warn(`enterprise platform: local route rejected the request [operation=${operation} status=${status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      },
    })
    const settingsNamespace = internals.settingsNamespace ?? ownerSettingsNamespace(ctx)
    this.settingsNamespace = settingsNamespace
    this.ownerContext = ctx
    if (settingsNamespace === undefined) {
      // 「不可持久化」的第 1 个判定点：owner Loader entry 读不到，命名空间无从推导。
      this.logger.warn('enterprise platform: no owning profile entry; the Server address cannot be persisted'
        + ` [operation=construct step=owner-entry-id-missing ${settingsDiagnostics(ctx, undefined)}]`)
    } else {
      if (this.serverUrlReference === undefined) {
        // 「不可持久化」的第 2 个判定点：组合层未把 volatile 地址字段投影成引用。
        this.logger.warn('enterprise platform: the volatile Server address reference is missing;'
          + ' the Server address cannot be persisted'
          + ` [operation=construct step=volatile-reference-missing ${settingsDiagnostics(ctx, settingsNamespace)}]`)
      }
      // 官方 rc.2 的 settings 只投影活动 profile entry 自身的 volatile Config 字段：命名空间即 owner entry 的 id，
      // 注册面收敛为页面策略（官方 Settings 不生成 Server 页），地址字段由组合层声明为 volatile。
      ctx.inject(['settings'], settingsContext => {
        this.settingsService = settingsContext.settings
        try {
          settingsContext.effect(() => settingsContext.settings.configure({ auto: false }, ctx.fiber))
        } catch (error) {
          // 「不可持久化」的第 3 个判定点：官方页面策略注册失败时 `settings.update` 端口根本不会被装配。
          this.logger.error('enterprise platform: settings.configure({auto:false}) failed;'
            + ' the Server address cannot be persisted'
            + ` [operation=construct step=configure-threw ${settingsDiagnostics(ctx, settingsNamespace, settingsContext.settings)}]`
            + ` ${thrownErrorDiagnostics(error)}`, error)
          throw error
        }
        this.settingsWrite = async serverUrl => {
          try {
            await settingsContext.settings.update(settingsNamespace, { serverUrl })
          } catch (error) {
            // 「不可持久化」的第 5 个判定点：官方 settings 自己拒绝了这次写入（entry 缺失 / 无 volatile form / 被覆盖）。
            this.logger.error('enterprise platform: settings.update rejected the Server address'
              + ` [operation=setServerUrl step=settings-update-threw entryId=${settingsNamespace} serverUrl=${serverUrl}`
              + ` ${settingsDiagnostics(ctx, settingsNamespace, settingsContext.settings)}]`
              + ` ${thrownErrorDiagnostics(error)}`, error)
            throw error
          }
        }
        this.logger.warn('enterprise platform: Server address write port wired'
          + ` [operation=construct step=wired entryId=${settingsNamespace}`
          + ` ${settingsDiagnostics(ctx, settingsNamespace, settingsContext.settings)}]`)
      })
      ctx.on('settings/document-updated', namespace => {
        if (String(namespace) === settingsNamespace) this.reconcileServerUrl()
      })
    }
    ctx.effect(() => () => this.dispose(), 'enterprisePlatform.dispose()')
    this.applyServerUrl(this.initialServerUrl())
    // 启动即拉一次（Server 未配置时是空操作）；此后只在登录成功与切换 Server 时各拉一次，不轮询。
    void this.branding.refresh()
    this.startSessionRestore()
  }

  /** 无活动会话时清理残留凭据并写入官方 settings；保存期间禁止开始登录。 */
  async setServerUrl(serverUrl: string): Promise<{ readonly serverUrl: string }> {
    this.assertOpen()
    if (this.configuring !== undefined || this.loggingOut || this.login !== undefined
      || ['READY', 'REFRESHING', 'BOOTSTRAPPING'].includes(this.currentStatus.state)) {
      throw new EnterprisePlatformError('ENT_PERMISSION_DENIED', 'logout before changing the server')
    }
    const resolved = resolveBaseUrl(serverUrl)
    if (resolved === undefined) throw new TypeError('serverUrl is required')
    // 先判定可写性：地址不可持久化时不得先清掉凭据再失败。
    if (this.settingsWrite === undefined || this.serverUrlReference === undefined) {
      // 「不可持久化」的第 4 个判定点：本次保存请求撞上未装配的 settings 写入端口。
      const step = this.settingsWrite === undefined ? 'settings-write-port-missing' : 'volatile-reference-missing'
      this.logger.error('enterprise platform: refusing to save the Server address'
        + ` [operation=setServerUrl step=${step} serverUrl=${resolved.origin}`
        + ` settingsWrite=${this.settingsWrite === undefined ? 'absent' : 'ready'}`
        + ` serverUrlReference=${this.serverUrlReference === undefined ? 'absent' : 'ready'}`
        + ` ${settingsDiagnostics(this.ownerContext, this.settingsNamespace, this.settingsService)}]`)
      throw new EnterprisePlatformError(
        'ENT_SETTINGS_UNAVAILABLE',
        'Harness settings do not expose the enterprise Server address on this profile',
      )
    }
    this.configuring = resolved.origin
    try {
      await this.platformCredentials.delete()
      await this.persistServerUrl(resolved.origin)
      this.applyServerUrl(resolved.origin)
      return { serverUrl: resolved.origin }
    } finally { this.configuring = undefined }
  }

  /** 幂等启动一个浏览器 PKCE 流程，并在浏览器完成前返回。 */
  async startLogin(): Promise<EnterpriseLoginFlow> {
    this.assertOpen()
    if (this.configuring !== undefined || this.loggingOut) {
      throw new EnterprisePlatformError('ENT_AUTH_REQUIRED', 'authentication transition is in progress')
    }
    this.requireBaseUrl()
    if (this.login !== undefined) return { flowId: this.login.flowId }
    if (['READY', 'REFRESHING', 'BOOTSTRAPPING'].includes(this.currentStatus.state)) {
      throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'logout before starting another login')
    }
    this.clearSession()
    const transaction: LoginTransaction = {
      flowId: this.createFlowId(),
      abort: new AbortController(),
    }
    this.login = transaction
    this.transition('AUTHORIZING', { flowId: transaction.flowId })
    this.loginTask = this.runLogin(transaction)
      .catch(error => { this.finishLoginFailure(transaction, error) })
      .finally(() => {
        transaction.callback?.cancel()
        if (this.login === transaction) this.login = undefined
      })
    return { flowId: transaction.flowId }
  }

  /** 中心可达时撤销当前会话，之后始终清空全部本地认证状态。 */
  async logout(): Promise<void> {
    this.assertOpen()
    this.loggingOut = true
    this.cancelLogin()
    await this.loginTask
    let failure: unknown
    if (this.currentStatus.state !== 'SIGNED_OUT' && this.currentStatus.state !== 'UNCONFIGURED') {
      try {
        await (await this.request(`${AUTH_PATH}/logout`, { method: 'POST' })).body?.cancel()
      } catch (error) {
        if (!(error instanceof EnterprisePlatformError)
          || (error.code !== 'ENT_AUTH_REQUIRED' && error.code !== 'ENT_AUTH_SESSION_EXPIRED')) failure = error
      }
    }
    try {
      await this.platformCredentials.delete()
    } catch (error) {
      failure ??= error
    }
    this.clearSession()
    this.transition(this.baseUrl === undefined ? 'UNCONFIGURED' : 'SIGNED_OUT')
    this.loggingOut = false
    if (failure !== undefined) throw failure
  }

  /** 返回浏览器安全连接事实的副本。 */
  status(): EnterprisePlatformStatus {
    return cloneStatus(this.currentStatus)
  }

  /** 返回最新已校验 bootstrap 副本，永不返回平台凭据。 */
  bootstrap(): BootstrapSnapshot | undefined {
    return this.bootstrapSnapshot === undefined ? undefined : structuredClone(this.bootstrapSnapshot)
  }

  /** 拉取当前用户可见的企业配方目录；一次请求，不缓存 Token。 */
  async listPresets(signal?: AbortSignal): Promise<unknown> {
    return this.fetchPresetJson(`${API_PATH}/presets?sort=newest`, signal)
  }

  /** 拉取单个可见配方详情（含 versionId，供复制导入指令构造下载 URL）。 */
  async getPreset(packageId: string, signal?: AbortSignal): Promise<unknown> {
    return this.fetchPresetJson(`${API_PATH}/presets/${packageId}`, signal)
  }

  private async fetchPresetJson(path: string, signal?: AbortSignal): Promise<unknown> {
    const response = await this.request(path, signal === undefined ? {} : { signal })
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'platform returned invalid preset JSON', true)
    }
    const envelope = typeof payload === 'object' && payload !== null
      ? (payload as { data?: unknown }).data
      : undefined
    if (envelope === undefined) {
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'platform returned an invalid preset payload', true)
    }
    return envelope
  }

  /** 用户打开设置或刷新目录时调用；并发刷新共享任务，闲置时没有定时请求。 */
  async refresh(): Promise<EnterprisePlatformStatus> {
    this.assertOpen()
    if (this.refreshTask !== undefined) {
      await this.refreshTask
    } else if (!this.loggingOut && (this.currentStatus.state === 'READY' || this.currentStatus.state === 'REFRESHING')) {
      const task = this.bootstrapSnapshot === undefined
        ? this.restoreSession(this.requireBaseUrl()) : this.refreshBootstrap()
      this.refreshTask = task
      try { await task } finally { if (this.refreshTask === task) this.refreshTask = undefined }
    }
    return this.status()
  }

  /** 订阅 Host 内存状态快照；disposer 幂等移除监听器且不会暴露 Token。 */
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void {
    this.assertOpen()
    this.listeners.add(listener)
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      this.listeners.delete(listener)
    }
  }

  /**
   * 执行一次同源带认证的平台请求。
   * 该方法是唯一读取内存 Token 的代码路径。
   */
  async request(input: string | URL, init: RequestInit = {}): Promise<Response> {
    this.assertOpen()
    const baseUrl = this.requireBaseUrl()
    const url = new URL(input.toString(), baseUrl)
    const generation = this.sessionGeneration
    if (this.loggingOut && url.pathname !== `${AUTH_PATH}/logout`) {
      throw new EnterprisePlatformError('ENT_AUTH_REQUIRED', 'logout is in progress')
    }
    if (url.origin !== baseUrl.origin || url.username !== '' || url.password !== '') {
      throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'authenticated requests must stay on the platform origin')
    }
    if (!TRANSITIONAL_REQUEST_PATHS.has(url.pathname)
      && this.currentStatus.state !== 'READY'
      && this.currentStatus.state !== 'REFRESHING') {
      throw new EnterprisePlatformError('ENT_AUTH_REQUIRED', 'enterprise platform is not ready')
    }
    await this.ensureAccessToken()
    if (generation !== this.sessionGeneration) throw new DOMException('enterprise session changed', 'AbortError')
    const headers = new Headers(init.headers)
    if (headers.has('authorization')) {
      throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'authorization header is managed by enterprisePlatform')
    }
    for (let attempt = 0; ; attempt++) {
      init.signal?.throwIfAborted()
      const token = this.platformCredentials.accessToken()
      if (token === undefined) throw new EnterprisePlatformError('ENT_AUTH_REQUIRED', 'platform login is required')
      headers.set('authorization', `Bearer ${token}`)
      const response = await this.executeFetch(url, { ...init, headers, redirect: 'error' })
      if (generation !== this.sessionGeneration) {
        await response.body?.cancel()
        throw new DOMException('enterprise session changed', 'AbortError')
      }
      if (response.ok) return response
      const error = await this.decodeResponseError(response)
      if (generation !== this.sessionGeneration) throw new DOMException('enterprise session changed', 'AbortError')
      // 服务端时钟或提前失效可先于本机期限；只在认证拒绝后续期并重放一次。
      if (response.status === 401 && attempt === 0 && !(init.body instanceof ReadableStream)
        && (error.code === 'ENT_AUTH_REQUIRED' || error.code === 'ENT_AUTH_SESSION_EXPIRED')) {
        if (this.platformCredentials.accessToken() === token) await this.ensureAccessToken(true)
        if (generation !== this.sessionGeneration) throw new DOMException('enterprise session changed', 'AbortError')
        continue
      }
      if (error.code === 'ENT_DEVICE_REVOKED') this.expireDevice()
      else if (error.code === 'ENT_AUTH_REQUIRED' || error.code === 'ENT_AUTH_SESSION_EXPIRED') {
        this.expireAuthentication(error.code)
      }
      throw error
    }
  }

  /** 中止登录、按需刷新与 fetch，关闭本地路由并等待停稳。 */
  dispose(): Promise<void> {
    if (this.disposeTask !== undefined) return this.disposeTask
    this.disposed = true
    this.disposeTask = this.performDispose()
    return this.disposeTask
  }

  private async performDispose(): Promise<void> {
    this.cancelLogin()
    this.lifetime.abort(new DOMException('enterprise platform disposed', 'AbortError'))
    for (const controller of this.activeRequests) controller.abort()
    this.disposeLocalApi()
    this.branding.dispose()
    this.listeners.clear()
    this.clearSession()
    const pending = Promise.allSettled([
      this.installation,
      ...(this.loginTask === undefined ? [] : [this.loginTask]),
      ...(this.refreshTask === undefined ? [] : [this.refreshTask]),
      ...this.platformCredentials.pending(),
    ])
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new EnterprisePlatformError(
        'ENT_PLATFORM_DISPOSED', 'enterprise platform disposal timed out', true,
      )), this.config.disposeTimeoutMs)
      timer.unref()
    })
    try {
      await Promise.race([pending, timeout])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  private async runLogin(transaction: LoginTransaction): Promise<void> {
    const baseUrl = this.requireBaseUrl()
    const installation = await this.installation
    transaction.abort.signal.throwIfAborted()
    const state = this.createState()
    const pkce = createPkceS256()
    const callback = await startLoopbackCallback({
      expectedState: state,
      timeoutMs: this.config.callbackTimeoutMs,
      signal: transaction.abort.signal,
      // 只读已缓存品牌：登录开始时不再发新请求，取不到就由结果页回落内置名。
      branding: () => this.branding.document(),
      // 语言已按企业缺省规则判定：原文截断后留痕，下次「页面为何不是中文」可直接定性。
      onCallbackRequest: ({ acceptLanguage, locale }) => {
        this.logger.warn('enterprise platform: loopback callback language'
          + ` [accept-language="${acceptLanguage}" locale=${locale}]`)
      },
    })
    transaction.callback = callback
    const authorizeUrl = new URL(`${AUTH_PATH}/authorize`, baseUrl)
    authorizeUrl.search = new URLSearchParams({
      client_id: 'dsh-desktop',
      redirect_uri: callback.redirectUri,
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
      installation_id: installation.installationId,
    }).toString()
    const [, result] = await Promise.all([
      this.openBrowser(authorizeUrl.toString(), transaction.abort.signal),
      callback.result,
    ])
    transaction.abort.signal.throwIfAborted()

    const tokenRequest: TokenRequest = {
      grantType: 'authorization_code',
      code: result.code,
      clientId: 'dsh-desktop',
      redirectUri: callback.redirectUri,
      codeVerifier: pkce.verifier,
      installationId: installation.installationId,
    }
    const tokenResponse = zTokenResponse.parse(await this.fetchPublicJson(
      `${AUTH_PATH}/token`,
      { body: JSON.stringify(tokenRequest), headers: { 'content-type': 'application/json' }, method: 'POST' },
      transaction.abort.signal,
    ))
    transaction.abort.signal.throwIfAborted()
    await this.platformCredentials.store(tokenResponse.data, baseUrl.origin)
    transaction.abort.signal.throwIfAborted()
    this.transition('ENROLLING', { flowId: transaction.flowId })

    const enrollRequest: DeviceEnrollRequest = {
      installationId: installation.installationId,
      name: installation.name,
      platform: hostPlatform(),
      harnessVersion: this.config.harnessVersion,
      enterpriseBundleVersion: this.config.bundleVersion,
    }
    const enrolled = zDeviceResponse.parse(await (await this.request(`${API_PATH}/devices/enroll`, {
      body: JSON.stringify(enrollRequest),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: transaction.abort.signal,
    })).json())
    if (enrolled.data.status !== 'ACTIVE') {
      throw new EnterprisePlatformError('ENT_DEVICE_REVOKED', 'enterprise device is revoked')
    }
    this.transition('BOOTSTRAPPING', { flowId: transaction.flowId })
    await this.loadBootstrap(transaction.abort.signal)
    transaction.abort.signal.throwIfAborted()
    this.transition('READY')
    // 登录后再拉一次：管理员改过品牌时不必等下一次重启。
    void this.branding.refresh()
  }

  private async ensureAccessToken(force = false): Promise<void> {
    if (!force && !this.platformCredentials.needsRefresh(0)) return
    const generation = this.sessionGeneration
    try {
      const refreshed = await this.platformCredentials.refresh(this.requireBaseUrl(), this.lifetime.signal)
      if (generation !== this.sessionGeneration) throw new DOMException('enterprise session changed', 'AbortError')
      if (refreshed) return
    } catch (error) {
      if (generation !== this.sessionGeneration) throw error
      if (error instanceof EnterprisePlatformError && error.code === 'ENT_DEVICE_REVOKED') {
        this.expireDevice()
      } else if (error instanceof EnterprisePlatformError
        && (error.code === 'ENT_AUTH_REQUIRED' || error.code === 'ENT_AUTH_SESSION_EXPIRED')) {
        this.expireAuthentication(error.code)
      }
      throw error
    }
    this.expireAuthentication('ENT_AUTH_SESSION_EXPIRED')
    throw new EnterprisePlatformError('ENT_AUTH_SESSION_EXPIRED', 'platform session expired')
  }

  private startSessionRestore(): void {
    const baseUrl = this.baseUrl
    if (this.disposed || baseUrl === undefined || this.restoreOrigin === baseUrl.origin) return
    this.restoreOrigin = baseUrl.origin
    this.transition('BOOTSTRAPPING')
    const task = this.restoreSession(baseUrl)
    this.refreshTask = task
    void task.then(
      () => { if (this.refreshTask === task) this.refreshTask = undefined },
      () => { if (this.refreshTask === task) this.refreshTask = undefined },
    )
  }

  private async restoreSession(baseUrl: URL): Promise<void> {
    const generation = this.sessionGeneration
    try {
      const restored = this.platformCredentials.accessToken() === undefined
        ? await this.platformCredentials.refresh(baseUrl, this.lifetime.signal) : true
      if (this.disposed || generation !== this.sessionGeneration || this.baseUrl?.origin !== baseUrl.origin) return
      if (!restored) { this.transition('SIGNED_OUT'); return }
      this.transition('BOOTSTRAPPING')
      await this.loadBootstrap(this.lifetime.signal)
      if (this.disposed || generation !== this.sessionGeneration || this.baseUrl?.origin !== baseUrl.origin) return
      this.transition('READY')
    } catch (error) {
      if (this.disposed || isAbort(error) || generation !== this.sessionGeneration || this.baseUrl?.origin !== baseUrl.origin) return
      if (error instanceof EnterprisePlatformError && error.code === 'ENT_DEVICE_REVOKED') {
        this.expireDevice()
        return
      }
      if (error instanceof EnterprisePlatformError
        && (error.code === 'ENT_AUTH_REQUIRED' || error.code === 'ENT_AUTH_SESSION_EXPIRED')) {
        this.expireAuthentication(error.code)
        return
      }
      const code = error instanceof EnterprisePlatformError ? error.code : 'ENT_PLATFORM_UNAVAILABLE'
      this.transition('REFRESHING', { errorCode: code })
    }
  }

  private async fetchPublicJson(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
    return this.fetchPublicJsonAt(this.requireBaseUrl(), path, init, signal)
  }

  private async fetchPublicJsonAt(
    baseUrl: URL,
    path: string,
    init: RequestInit,
    signal: AbortSignal,
  ): Promise<unknown> {
    const response = await this.executeFetch(new URL(path, baseUrl), { ...init, signal, redirect: 'error' })
    if (!response.ok) throw await this.decodeResponseError(response)
    try {
      return await response.json()
    } catch {
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'platform returned invalid JSON', true, response.status)
    }
  }

  private async loadBootstrap(signal?: AbortSignal): Promise<void> {
    const generation = this.sessionGeneration
    const response = await this.request(`${API_PATH}/bootstrap`, signal === undefined ? {} : { signal })
    let value: unknown
    try {
      value = await response.json()
    } catch {
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'platform returned invalid bootstrap JSON', true)
    }
    const parsed = zBootstrapResponse.safeParse(value)
    if (!parsed.success) {
      this.logger.warn(
        'enterprise platform: invalid bootstrap schema %o',
        parsed.error.issues.map(issue => ({ code: issue.code, path: issue.path })),
      )
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'platform returned an invalid bootstrap', true)
    }
    const installation = await this.installation
    if (generation !== this.sessionGeneration) throw new DOMException('enterprise session changed', 'AbortError')
    if (parsed.data.data.device.installationId !== installation.installationId) {
      throw new EnterprisePlatformError('ENT_DEVICE_REVOKED', 'bootstrap device does not match this installation')
    }
    this.bootstrapSnapshot = parsed.data.data
    this.connectedAt = this.now().toISOString()
  }

  private async refreshBootstrap(): Promise<void> {
    if (this.disposed) return
    const generation = this.sessionGeneration
    const previousRevision = this.bootstrapSnapshot?.revision
    try {
      await this.ensureAccessToken()
      await this.loadBootstrap(this.lifetime.signal)
      if (this.currentStatus.state !== 'READY' || this.bootstrapSnapshot?.revision !== previousRevision) {
        this.transition('READY')
      }
    } catch (error) {
      if (this.disposed || isAbort(error) || generation !== this.sessionGeneration) return
      if (error instanceof EnterprisePlatformError && error.code === 'ENT_DEVICE_REVOKED') {
        this.expireDevice()
        return
      }
      if (error instanceof EnterprisePlatformError
        && (error.code === 'ENT_AUTH_REQUIRED' || error.code === 'ENT_AUTH_SESSION_EXPIRED')) {
        this.expireAuthentication(error.code)
        return
      }
      const code = error instanceof EnterprisePlatformError ? error.code : 'ENT_PLATFORM_UNAVAILABLE'
      this.transition('REFRESHING', { errorCode: code })
    }
  }

  private async executeFetch(input: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    this.activeRequests.add(controller)
    const signals = [controller.signal, this.lifetime.signal]
    if (init.signal !== null && init.signal !== undefined) signals.push(init.signal)
    const isEventStream = new Headers(init.headers).get('accept')?.toLowerCase().includes('text/event-stream') === true
    const timeout = isEventStream ? undefined : setTimeout(
      () => controller.abort(new DOMException('platform request timed out', 'TimeoutError')),
      this.config.requestTimeoutMs,
    )
    timeout?.unref()
    try {
      return await this.fetch(input, { ...init, signal: AbortSignal.any(signals) })
    } catch (error) {
      if (init.signal?.aborted === true || this.lifetime.signal.aborted || isAbort(error)) throw error
      throw new EnterprisePlatformError('ENT_PLATFORM_UNAVAILABLE', 'enterprise platform is unavailable', true)
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
      this.activeRequests.delete(controller)
    }
  }

  private async decodeResponseError(response: Response): Promise<EnterprisePlatformError> {
    try {
      const error = decodeEnterpriseError(await response.json())
      return new EnterprisePlatformError(
        error.code,
        'enterprise platform request failed',
        error.retryable,
        response.status,
        String(error.requestId),
        response.headers.get('retry-after') ?? undefined,
      )
    } catch {
      const code: EnterpriseErrorCode = response.status === 401
        ? 'ENT_AUTH_REQUIRED'
        : response.status === 403
          ? 'ENT_PERMISSION_DENIED'
          : response.status === 400
            ? 'ENT_INVALID_REQUEST'
            : 'ENT_PLATFORM_UNAVAILABLE'
      return new EnterprisePlatformError(
        code,
        'enterprise platform returned an invalid error',
        response.status >= 500,
        response.status,
        undefined,
        response.headers.get('retry-after') ?? undefined,
      )
    }
  }

  private finishLoginFailure(transaction: LoginTransaction, error: unknown): void {
    if (this.disposed || this.login !== transaction) return
    this.clearSession()
    if (transaction.abort.signal.aborted
      || error instanceof PkceLoopbackError && error.code === 'ENT_AUTH_CANCELLED'
      || isAbort(error)) {
      this.transition('CANCELLED', { flowId: transaction.flowId, errorCode: 'ENT_AUTH_CANCELLED' })
      return
    }
    if (error instanceof PkceLoopbackError && error.code === 'ENT_AUTH_TIMEOUT') {
      this.transition('FAILED', { flowId: transaction.flowId, errorCode: 'ENT_AUTH_TIMEOUT' })
      return
    }
    if (error instanceof PkceLoopbackError) {
      this.transition('FAILED', { flowId: transaction.flowId, errorCode: error.code })
      return
    }
    const code = error instanceof EnterprisePlatformError ? error.code : 'ENT_PLATFORM_UNAVAILABLE'
    if (code === 'ENT_DEVICE_REVOKED') this.transition('DEVICE_REVOKED', { errorCode: code })
    else this.transition('FAILED', { flowId: transaction.flowId, errorCode: code })
  }

  private cancelLogin(silent = false): boolean {
    const transaction = this.login
    if (transaction === undefined) return false
    if (silent) this.login = undefined
    transaction.abort.abort(new DOMException('login cancelled', 'AbortError'))
    transaction.callback?.cancel()
    return true
  }

  private expireAuthentication(code: 'ENT_AUTH_REQUIRED' | 'ENT_AUTH_SESSION_EXPIRED'): void {
    this.platformCredentials.discard()
    this.clearSession()
    this.transition('AUTH_EXPIRED', { errorCode: code })
  }

  private expireDevice(): void {
    this.platformCredentials.discard()
    this.clearSession()
    this.transition('DEVICE_REVOKED', { errorCode: 'ENT_DEVICE_REVOKED' })
  }

  private clearSession(): void {
    this.sessionGeneration++
    this.platformCredentials.clearAccess()
    this.bootstrapSnapshot = undefined
    this.connectedAt = undefined
  }

  /**
   * 官方 settings 生效的 Server 地址；用户未覆盖时回落到组合层 baseUrl（旧 `base` 层的等价语义）。
   *
   * @returns 已 trim 的地址字符串；空串表示组合层也未提供地址。
   */
  private settingsServerUrl(): string {
    const stored = this.writtenServerUrl()
    return stored.trim() === '' ? this.compositionServerUrl : stored.trim()
  }

  /**
   * 本次写入后的地址原始值。
   *
   * 优先读 Loader owner entry 的配置：官方广播 `settings/document-updated` 时 volatile 引用可能
   * 还没提交新值，读引用会把「刚写入的值」看成上一份值，从而既不拒绝非法改址、也无法写回保护。
   * 拿不到 entry 视图（非 Loader 组合）时回落到 volatile 引用。
   *
   * @returns 文档里的地址字符串；两处都读不到时为空串。
   */
  private writtenServerUrl(): string {
    const namespace = this.settingsNamespace
    if (namespace !== undefined) {
      const config = ownerEntryConfig(this.ctx, namespace)
      const value: unknown = config?.['serverUrl']
      if (typeof value === 'string') return value
    }
    return this.serverUrlReference?.get() ?? ''
  }

  /**
   * 启动时采用的地址；持久化值非法时回落到组合层 baseUrl，一次手改的文档不会阻断开机。
   *
   * @returns 组合层已校验过的地址或持久化地址。
   */
  private initialServerUrl(): string {
    const stored = this.settingsServerUrl()
    try {
      resolveBaseUrl(stored)
      return stored
    } catch {
      this.logger.warn('enterprise platform: ignoring an invalid persisted Server address')
      return this.compositionServerUrl
    }
  }

  /**
   * 官方 rc.2 的 settings 没有 per-namespace `validate` 钩子，落盘前无法拒绝一次外部改址；
   * 因此广播后立即把文档写回最近一次**有效**地址，保持「退出登录后才能改 Server」的既有契约。
   *
   * 判定对象是**本次写入的值**（见 {@link writtenServerUrl}），而不是「已存的旧值」：
   * 首次配置前该字段就是空串，把空串当成非法地址会立刻把刚写入的有效地址写回空值
   * （rc.2 的写回即刻生效），用户于是永远配不上 Server。空串在这里只表示「未设置」，
   * 不拒绝、也不写回；显式保存（`configuring`）期间读到空串同样不写回。
   */
  private reconcileServerUrl(): void {
    const next = this.settingsServerUrl()
    if (next.trim() === '') {
      if (this.configuring !== undefined || this.baseUrl === undefined) return
      // 已生效过一个有效地址却被清空：仍按一次地址变更处理，写回该有效地址。
      this.refuseServerUrl('the stored address is empty')
      return
    }
    let origin: string | undefined
    try {
      origin = resolveBaseUrl(next)?.origin
    } catch {
      origin = undefined
    }
    if (origin === undefined) {
      this.refuseServerUrl('the stored address is not an HTTP(S) origin')
      return
    }
    if (origin === this.baseUrl?.origin) return
    if (origin !== this.configuring && this.hasActiveSession()) {
      this.refuseServerUrl('a session is active')
      return
    }
    this.applyServerUrl(next)
  }

  /** 写入官方 settings；不可写时以语义准确的码拒绝，而不是误导性的平台不可用。 */
  private async persistServerUrl(serverUrl: string): Promise<void> {
    const write = this.settingsWrite
    if (write === undefined) {
      this.logger.error('enterprise platform: refusing to persist the Server address'
        + ` [operation=setServerUrl step=settings-write-port-missing serverUrl=${serverUrl}`
        + ` ${settingsDiagnostics(this.ownerContext, this.settingsNamespace, this.settingsService)}]`)
      throw new EnterprisePlatformError(
        'ENT_SETTINGS_UNAVAILABLE',
        'Harness settings do not expose the enterprise Server address on this profile',
      )
    }
    // 写入端口自身已在装配处记录 `settings.update` 抛出的原始 error；这里不再吞错。
    await write(serverUrl)
  }

  /**
   * 把官方 settings 写回最近一次被接受的有效地址，并保留一次警告。
   *
   * `this.baseUrl` 只在地址通过 {@link resolveBaseUrl} 校验后被赋值，因此它就是「上一个有效值」；
   * 从未有过有效地址时写回空串，等于把文档还原成「未设置」，而不是保留一个非法字面量。
   *
   * 广播是在官方 `configEditor.edit` 的 HMR 事务内发出的（`SettingsForms.invalidate()` →
   * `app-boot/config-reload`），而 `dsh-hmr` 用 AsyncLocalStorage 判定嵌套事务，从该上下文里再写一次
   * 文档必然被 `HMR transactions cannot be nested` 拒绝——换用定时器重试也躲不开（定时器继承同一
   * async 上下文）。因此这一写回只在**启动读回**那一次真正落到文档上；运行期它至少留下两条警告，
   * 而不是静默丢弃外部非法改址。
   *
   * @param reason - 拒绝原因，只进入 Host 日志。
   */
  private refuseServerUrl(reason: string): void {
    const write = this.settingsWrite
    if (write === undefined) {
      // 曾经静默的「不可持久化」分支：连写回端口都没有，外部非法改址只会被丢弃。
      this.logger.warn(`enterprise platform: refused a Server address change but cannot persist any address: ${reason}`
        + ` [operation=reconcile step=settings-write-port-missing`
        + ` ${settingsDiagnostics(this.ownerContext, this.settingsNamespace, this.settingsService)}]`)
      return
    }
    this.logger.warn(`enterprise platform: refused a Server address change: ${reason}`)
    const previous = this.baseUrl?.origin ?? ''
    void write(previous).catch(error => {
      this.logger.warn('enterprise platform: failed to restore the persisted Server address'
        + ` [operation=reconcile step=restore-write-threw serverUrl=${previous}]`
        + ` ${thrownErrorDiagnostics(error)}`, error)
    })
  }

  /** 是否持有活动会话或正在登录/登出；这些状态下地址不得变化。 */
  private hasActiveSession(): boolean {
    return this.login !== undefined || this.loggingOut
      || this.currentStatus.state === 'READY'
      || this.currentStatus.state === 'REFRESHING'
      || this.currentStatus.state === 'BOOTSTRAPPING'
  }

  private applyServerUrl(serverUrl: string): void {
    const next = resolveBaseUrl(serverUrl)
    if (next?.origin === this.baseUrl?.origin) return
    this.cancelLogin(true)
    this.clearSession()
    for (const controller of this.activeRequests) {
      controller.abort(new DOMException('enterprise server changed', 'AbortError'))
    }
    this.baseUrl = next
    this.restoreOrigin = undefined
    this.transition(next === undefined ? 'UNCONFIGURED' : 'SIGNED_OUT')
    this.startSessionRestore()
    void this.branding.refresh()
  }

  private requireBaseUrl(): URL {
    if (this.baseUrl === undefined) {
      throw new EnterprisePlatformError('ENT_INVALID_REQUEST', 'enterprise server is not configured')
    }
    return this.baseUrl
  }

  private transition(
    state: EnterprisePlatformStatus['state'],
    detail: { readonly flowId?: string; readonly errorCode?: string } = {},
  ): void {
    if (this.disposed) return
    const snapshot = this.bootstrapSnapshot
    this.currentStatus = {
      state,
      bundleVersion: this.config.bundleVersion,
      platformUrl: this.baseUrl?.origin ?? null,
      transport: 'webServer.register',
      ...detail,
      ...(snapshot === undefined ? {} : {
        user: snapshot.user,
        revision: snapshot.revision,
        ...(this.connectedAt === undefined ? {} : { connectedAt: this.connectedAt }),
      }),
    }
    const published = this.status()
    for (const listener of this.listeners) {
      try {
        listener(published)
      } catch {
        this.logger.warn('enterprise platform: status subscriber failed')
      }
    }
  }

  private assertOpen(): void {
    if (this.disposed) throw new EnterprisePlatformError('ENT_PLATFORM_DISPOSED', 'enterprise platform is disposed')
  }
}
