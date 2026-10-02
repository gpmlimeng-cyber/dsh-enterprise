/**
 * [INPUT]: 依赖 branding 的同源 LOGO 来源门禁与 `EnterpriseBrandingDocument` 形状、decode-primitives 的严格解码内核、skill-api-decode 的技能 DTO 与解码
 * [OUTPUT]: 对外提供连接/受管插件状态枚举、本地 API DTO 类型与严格解码（账号、品牌、插件、配方、Session、四窗口用量、反馈回执、原生登录的来源列表与凭证/改密结果、**企业技能已装态与已装正文**）、`EnterpriseLocalApi` 契约、失败码投影 `enterpriseLocalErrorCode`，并再导出 `EnterpriseLocalApiError` 与 skill-api-decode 的全部技能契约
 * [POS]: dsh-ui 的浏览器取数契约层——只定义「主机可以说什么」与「什么不许说」，不含任何 fetch；网络执行留在 local-api.ts，界面只消费本文件的投影结果。逼近 800 行后按业务纵切出技能分片与共享内核，本文件仍是唯一对外真源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { enterpriseBrandingLogoUrl } from './branding.js'
import type { EnterpriseBrandingDocument } from './branding.js'
import {
  EnterpriseLocalApiError,
  enterpriseId,
  hasExactKeys,
  nonEmptyString,
  nullableTimestamp,
  record,
  timestamp,
} from './decode-primitives.js'
import type { JsonRecord } from './decode-primitives.js'
import type { EnterpriseInstalledSkill, EnterpriseInstalledSkillContent, EnterpriseRuntimeSkill } from './skill-api-decode.js'

export { EnterpriseLocalApiError } from './decode-primitives.js'
export * from './skill-api-decode.js'

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
  /**
   * 宿主交浏览器半打开时下发的授权 URL（仅 AUTHORIZING 窗口内出现）。
   *
   * 存在即代表「宿主没有打开，由你打开」；缺失代表宿主已经打开。
   */
  readonly authorizeUrl?: string
  /** 授权页交接方（宿主下发）：native 时渲染原生表单。未下发（旧宿主半）时客户端退回平台判断。 */
  readonly loginMode?: 'browser' | 'native'
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

/** 账户后台与推理后台地址；defaults 是 Host 当前默认值，只用于占位与回退。 */
export interface EnterpriseAccountOrigin {
  readonly platformOrigin: string
  readonly inferenceOrigin: string
  readonly defaults: {
    readonly platformOrigin: string
    readonly inferenceOrigin: string
  }
}

export interface EnterpriseAccountOriginUpdate {
  readonly platformOrigin: string
  readonly inferenceOrigin: string
  /** false 表示官方账户行需重启 Harness 才重新挂载。 */
  readonly remounted: boolean
}

/**
 * 中心 `GET /enterprise/api/v1/usage/me` 的单个 token 窗口。
 *
 * `limit`/`resetsAt` 在契约与当前服务端 DTO 里都是必填，这里仍接受 `null`：
 * 它表示「该窗口没有上限」或「重置时刻未知」，与 client-plugin 的用量投影保持同一口径，
 * 界面因此不必为无上限场景凭空造一个数字。
 */
export interface EnterpriseTokenWindowUsage {
  readonly limit: number | null
  readonly usedTokens: number
  readonly reservedTokens: number
  readonly resetsAt: string | null
}

/**
 * 一条生效配额策略的实时用量；四窗口键与中心固定顺序一致，窗口为 null 表示该窗口未生效
 * （UI 不得补零造成「有额度」的错觉）。rpm/concurrency 是请求级限制，不进本投影。
 */
export interface EnterpriseQuotaUsagePolicy {
  readonly policyId: string
  readonly name: string
  readonly resourceName: string | null
  readonly fiveHours: EnterpriseTokenWindowUsage | null
  readonly daily: EnterpriseTokenWindowUsage | null
  readonly weekly: EnterpriseTokenWindowUsage | null
  readonly monthly: EnterpriseTokenWindowUsage | null
}

/**
 * 浏览器要提交的反馈草稿。
 *
 * 刻意**没有** `diagnostics`：该字段由 Host 采集权威事实（插件/Host 版本、OS、installationId、
 * 最近错误码）并在转发时覆盖同名键，浏览器伪造的诊断没有落点。
 */
export interface EnterpriseFeedbackDraft {
  readonly type: 'issue' | 'suggestion'
  readonly description: string
  /** 仅 `type === 'issue'` 时提交；ISO-8601 带时区。 */
  readonly occurredAt?: string | undefined
  /** 选填邮箱或手机号。 */
  readonly contact?: string | undefined
  readonly consent: true
  readonly attachments: readonly File[]
}

/** 中心回执里界面真正需要的六个事实；其余字段（含 requestId）止步于 Host。 */
export interface EnterpriseFeedbackReceipt {
  readonly id: string
  readonly type: 'issue' | 'suggestion'
  readonly status: EnterpriseFeedbackStatus
  readonly occurredAt: string
  readonly attachmentCount: number
  readonly createdAt: string
}

export type EnterpriseFeedbackStatus = 'new' | 'triaged' | 'resolved' | 'ignored'
export const ENTERPRISE_FEEDBACK_STATUSES = ['new', 'triaged', 'resolved', 'ignored'] as const

export interface EnterpriseLocalApi {
  status(signal: AbortSignal): Promise<EnterpriseLocalStatus>
  refresh(signal: AbortSignal): Promise<EnterpriseLocalStatus>
  /** Host 缓存的品牌投影；企业未配置或取数失败时是 null，界面据此回落内置默认。 */
  branding(signal: AbortSignal): Promise<EnterpriseBrandingDocument | null>
  setServerUrl(serverUrl: string, signal: AbortSignal): Promise<{ readonly serverUrl: string }>
  accountOrigin(signal: AbortSignal): Promise<EnterpriseAccountOrigin>
  setAccountOrigin(
    origin: { readonly platformOrigin?: string; readonly inferenceOrigin?: string },
    signal: AbortSignal,
  ): Promise<EnterpriseAccountOriginUpdate>
  bootstrap(signal: AbortSignal): Promise<EnterpriseAccountBootstrap | undefined>
  /** 本人四窗口 Token 用量；Host 代取中心 `usage/me`，浏览器不接触 Access Token。 */
  usage(signal: AbortSignal): Promise<readonly EnterpriseQuotaUsagePolicy[]>
  /**
   * 请 Host 用系统浏览器打开帮助中心（与 PKCE 登录同一条通道）。
   *
   * 浏览器只发一条无正文的同源 POST，地址由 Host 按自己配置的平台地址加固定 `/help/` 派生：
   * 因此这里没有 URL 参数，也没有新的响应 DTO——成不成只看响应是否 2xx。
   */
  openHelp(signal: AbortSignal): Promise<void>
  /**
   * 提交一条反馈；Host 以 multipart 透传到中心并就地做附件限流。
   *
   * `idempotencyKey` 选填 UUID v4：重试同一草稿复用同一个键，中心据此返回既有反馈而不新建行。
   */
  submitFeedback(
    draft: EnterpriseFeedbackDraft,
    signal: AbortSignal,
    idempotencyKey?: string,
  ): Promise<EnterpriseFeedbackReceipt>
  plugins(signal: AbortSignal): Promise<EnterprisePluginStatus>
  presets(signal: AbortSignal): Promise<readonly EnterpriseRuntimePreset[]>
  presetDetail(packageId: string, signal: AbortSignal): Promise<EnterpriseRuntimePreset>
  /** 可见技能包摘要；Host 代取中心 `/skills`，条目只含 frontmatter 脱敏事实。 */
  skills(signal: AbortSignal): Promise<readonly EnterpriseRuntimeSkill[]>
  /** 单个技能包详情（含包内条目与 versionId）；下载仍由 Host 代取，浏览器只拿投影。 */
  skillDetail(packageId: string, signal: AbortSignal): Promise<EnterpriseRuntimeSkill>
  /** 本机已装技能清单；Host 读自己的落盘状态文件并核对技能目录是否仍在。 */
  installedSkills(signal: AbortSignal): Promise<readonly EnterpriseInstalledSkill[]>
  /**
   * 读一条**已装**技能的 `SKILL.md` 正文（点技能行看详情时才发这一条请求）。
   *
   * 只传包 id 与技能目录名，**不传任何路径**：名字在本机已装记录里找不到就得到 404，
   * 符号链接逃逸 / 超 256 KiB / 非 UTF-8 各有稳定错误码；未安装的行根本不发这条请求。
   */
  skillContent(packageId: string, name: string, signal: AbortSignal): Promise<EnterpriseInstalledSkillContent>
  /** 一键安装一个技能包；返回安装后的最新已装态（一次往返拿到真值）。 */
  installSkill(packageId: string, signal: AbortSignal): Promise<readonly EnterpriseInstalledSkill[]>
  /** 卸载一个已装技能包；返回卸载后的最新已装态。 */
  uninstallSkill(packageId: string, signal: AbortSignal): Promise<readonly EnterpriseInstalledSkill[]>
  installPlugin(packageName: string, pluginVersionId: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  removePlugin(packageName: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  startLogin(signal: AbortSignal): Promise<{ readonly flowId: string }>
  cancelLogin(signal: AbortSignal): Promise<{ readonly cancelled: boolean }>
  /** 原生登录（安卓）本轮的认证来源；没有进行中的原生事务时按 400 拒绝。 */
  loginForm(signal: AbortSignal): Promise<EnterpriseLoginForm>
  /** 代提交账号密码；成功即 Host 已在后台继续登录。 */
  submitCredentials(
    input: { readonly sourceId: string; readonly username: string; readonly password: string },
    signal: AbortSignal,
  ): Promise<EnterpriseCredentialResult>
  /** 「需改密」分支的第二次提交。 */
  submitPasswordChange(
    input: { readonly challenge: string; readonly newPassword: string },
    signal: AbortSignal,
  ): Promise<EnterpriseCredentialResult>
  logout(signal: AbortSignal): Promise<{ readonly loggedOut: true }>
  uninstall(signal: AbortSignal): Promise<{ readonly uninstalled: true; readonly restartRequested: boolean }>
  sessionSyncStatus(signal: AbortSignal): Promise<EnterpriseSessionSyncStatus>
  listSessions(signal: AbortSignal): Promise<readonly EnterpriseRemoteSession[]>
  restoreSession(sourceSessionId: string, cwd: string, signal: AbortSignal): Promise<{
    readonly restoredSessionId: string
    readonly sourceSessionId: string
  }>
}

/**
 * 本地取数的稳定失败码：本地 API 错误取其码，其余（网络中断、Host 未起等）统一为
 * `ENT_LOCAL_UNAVAILABLE`。状态控制器与用量弹窗共用这一条规则，不各写一份。
 */
export function enterpriseLocalErrorCode(error: unknown): string {
  return error instanceof EnterpriseLocalApiError ? error.code : 'ENT_LOCAL_UNAVAILABLE'
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

function safeAuthorizeUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false
  try {
    const url = new URL(value)
    // 与平台地址不同：授权 URL 必须带 PKCE 查询串，故这里放行 search，仍拒绝凭据与片段。
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.username === '' && url.password === '' && url.hash === ''
  } catch {
    return false
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

/** 与上游 platformOrigin() 一致的 loopback 白名单；此外的明文 HTTP 一律拒绝。 */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** 严格解码 Server 地址写入回执：地址必须与入参同口径（绝对 HTTP(S)、无凭据/查询/片段）。 */
export function decodeEnterpriseServerUrl(value: unknown): { readonly serverUrl: string } {
  const data = record(value)
  if (data === undefined || !hasExactKeys(data, ['serverUrl']) || !safePlatformUrl(data['serverUrl'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { serverUrl: data['serverUrl'] }
}

/**
 * 账户后台地址比 Server 地址更严：只接受 HTTPS origin 或 loopback HTTP origin，
 * 且必须是 ASCII，避免同形字地址被回显进输入框。
 */
function accountOrigin(value: unknown): value is string {
  if (!nonEmptyString(value) || value.length > 512 || !/^[\x21-\x7e]+$/.test(value)) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname)))
      && url.hostname !== '' && url.username === '' && url.password === ''
      && (url.pathname === '' || url.pathname === '/') && url.search === '' && url.hash === ''
  } catch {
    return false
  }
}

function decodeAccountOriginDefaults(value: unknown): EnterpriseAccountOrigin['defaults'] {
  const defaults = record(value)
  if (defaults === undefined || !hasExactKeys(defaults, ['platformOrigin', 'inferenceOrigin'])
    || !accountOrigin(defaults['platformOrigin']) || !accountOrigin(defaults['inferenceOrigin'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { platformOrigin: defaults['platformOrigin'], inferenceOrigin: defaults['inferenceOrigin'] }
}

/** 严格解码 Host 的账户后台地址投影；缺字段、类型不符或非 HTTPS/loopback 地址都抛稳定错误。 */
export function decodeEnterpriseAccountOrigin(value: unknown): EnterpriseAccountOrigin {
  const source = record(value)
  if (source === undefined || !hasExactKeys(source, ['platformOrigin', 'inferenceOrigin', 'defaults'])
    || !accountOrigin(source['platformOrigin']) || !accountOrigin(source['inferenceOrigin'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    platformOrigin: source['platformOrigin'],
    inferenceOrigin: source['inferenceOrigin'],
    defaults: decodeAccountOriginDefaults(source['defaults']),
  }
}

/** 严格解码账户后台地址写入回执：两个 origin 必须与入参同口径（HTTPS 或 loopback HTTP）。 */
export function decodeEnterpriseAccountOriginUpdate(value: unknown): EnterpriseAccountOriginUpdate {
  const source = record(value)
  if (source === undefined || !hasExactKeys(source, ['platformOrigin', 'inferenceOrigin', 'remounted'])
    || !accountOrigin(source['platformOrigin']) || !accountOrigin(source['inferenceOrigin'])
    || typeof source['remounted'] !== 'boolean') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    platformOrigin: source['platformOrigin'],
    inferenceOrigin: source['inferenceOrigin'],
    remounted: source['remounted'],
  }
}

/** 严格解码本地 JSON response 内的脱敏状态。 */
export function decodeEnterpriseLocalStatus(value: unknown): EnterpriseLocalStatus {
  const status = record(value)
  const allowedOptional = ['flowId', 'user', 'revision', 'connectedAt', 'errorCode', 'authorizeUrl', 'loginMode']
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
  if (status['loginMode'] !== undefined && status['loginMode'] !== 'browser' && status['loginMode'] !== 'native') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if (status['authorizeUrl'] !== undefined && !safeAuthorizeUrl(status['authorizeUrl'])) {
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
    ...(status['authorizeUrl'] === undefined ? {} : { authorizeUrl: status['authorizeUrl'] as string }),
    ...(status['loginMode'] === undefined ? {} : { loginMode: status['loginMode'] as 'browser' | 'native' }),
  }
}

/** 企业认证来源（服务端 `/sources` 返回的一条）。 */
export interface EnterpriseAuthSource {
  readonly id: string
  readonly name: string
  readonly type: 'LOCAL' | 'OIDC'
}

/** 原生登录表单的数据面：本轮事务可用的来源（服务端已关验证码，故不含验证码面）。 */
export interface EnterpriseLoginForm {
  readonly sources: readonly EnterpriseAuthSource[]
}

/** 原生凭证提交结果：`redirect` = 已在后台继续登录；`change-password` = 服务端要求先改密。 */
export type EnterpriseCredentialResult =
  | { readonly next: 'redirect' }
  | { readonly next: 'change-password'; readonly challenge: string; readonly rejected: boolean }

function decodeAuthSource(value: unknown): EnterpriseAuthSource {
  const source = record(value)
  if (source === undefined
    || !hasExactKeys(source, ['id', 'name', 'type'])
    || !nonEmptyString(source['id'])
    || !nonEmptyString(source['name'])
    || (source['type'] !== 'LOCAL' && source['type'] !== 'OIDC')) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { id: source['id'], name: source['name'], type: source['type'] }
}

export function decodeEnterpriseLoginForm(value: unknown): EnterpriseLoginForm {
  const payload = record(value)
  const sources = payload?.['sources']
  if (payload === undefined || !hasExactKeys(payload, ['sources']) || !Array.isArray(sources)) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { sources: sources.map(decodeAuthSource) }
}

export function decodeEnterpriseCredentialResult(value: unknown): EnterpriseCredentialResult {
  const result = record(value)
  if (result === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  if (result['next'] === 'redirect' && hasExactKeys(result, ['next'])) return { next: 'redirect' }
  if (result['next'] === 'change-password'
    && hasExactKeys(result, ['next', 'challenge', 'rejected'])
    && nonEmptyString(result['challenge'])
    && typeof result['rejected'] === 'boolean') {
    return { next: 'change-password', challenge: result['challenge'], rejected: result['rejected'] }
  }
  throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
}

export function decodeBootstrap(value: unknown): EnterpriseAccountBootstrap | undefined {
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

/**
 * 严格解码 Host 的品牌投影。形状不符一律抛稳定错误（读取层再回落内置）；
 * 单个 LOGO 来源不是同源本地副本时只丢该槽位，不牵连名称与欢迎语。
 */
export function decodeEnterpriseBranding(value: unknown): EnterpriseBrandingDocument | null {
  if (value === null) return null
  const source = record(value)
  const logo = record(source?.['logo'])
  const welcome = record(source?.['welcome'])
  if (source === undefined || logo === undefined || welcome === undefined
    || !hasExactKeys(source, ['revision', 'name', 'shortName', 'logo', 'welcome', 'updatedAt'])
    || !hasExactKeys(logo, ['light', 'dark', 'square'])
    || !hasExactKeys(welcome, ['headline', 'editionLabel'])
    || !Number.isSafeInteger(source['revision']) || (source['revision'] as number) < 0
    || typeof source['name'] !== 'string' || source['name'].length > 120
    || typeof source['shortName'] !== 'string' || source['shortName'].length > 120
    || typeof source['updatedAt'] !== 'string' || source['updatedAt'].length > 64
    || typeof welcome['headline'] !== 'string' || welcome['headline'].length > 200
    || typeof welcome['editionLabel'] !== 'string' || welcome['editionLabel'].length > 40) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    logo: {
      dark: enterpriseBrandingLogoUrl(logo['dark']) ?? null,
      light: enterpriseBrandingLogoUrl(logo['light']) ?? null,
      square: enterpriseBrandingLogoUrl(logo['square']) ?? null,
    },
    name: source['name'],
    revision: source['revision'] as number,
    shortName: source['shortName'],
    updatedAt: source['updatedAt'],
    welcome: { editionLabel: welcome['editionLabel'], headline: welcome['headline'] },
  }
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

/** 配额策略的枚举字段在浏览器边界只做「受控大写标识符」形状校验：取值映射归展示层，形状门禁归这里。 */
const QUOTA_ENUM_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

function quotaWindowUsage(value: unknown): EnterpriseTokenWindowUsage | null {
  if (value === null) return null
  const window = record(value)
  if (window === undefined
    || !hasExactKeys(window, ['limit', 'usedTokens', 'reservedTokens', 'resetsAt'])
    || !(window['limit'] === null || (Number.isSafeInteger(window['limit']) && Number(window['limit']) >= 0))
    || !Number.isSafeInteger(window['usedTokens']) || Number(window['usedTokens']) < 0
    || !Number.isSafeInteger(window['reservedTokens']) || Number(window['reservedTokens']) < 0
    || !(window['resetsAt'] === null || timestamp(window['resetsAt']))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    limit: window['limit'] as number | null,
    usedTokens: Number(window['usedTokens']),
    reservedTokens: Number(window['reservedTokens']),
    resetsAt: window['resetsAt'] as string | null,
  }
}

/**
 * 严格解码 Host 代取的四窗口用量，只保留展示所需字段（策略枚举、rpm 与并发只校验形状）。
 *
 * 未知字段、缺窗口键、负计数、非法时间戳或策略数超过 50 一律抛
 * `ENT_LOCAL_RESPONSE_INVALID`：界面据此显示失败态，而不是画出半份用量。
 */
export function decodeEnterpriseUsage(value: unknown): readonly EnterpriseQuotaUsagePolicy[] {
  if (!Array.isArray(value) || value.length > 50) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  return value.map(item => {
    const policy = record(item)
    if (policy === undefined
      || !hasExactKeys(policy, [
        'policyId', 'name', 'scope', 'subjectId', 'resourceType', 'resourceId', 'resourceName',
        'fiveHours', 'daily', 'weekly', 'monthly', 'rpm', 'concurrency',
      ])
      || !enterpriseId(policy['policyId'])
      || !nonEmptyString(policy['name']) || policy['name'].length > 120
      || !(policy['subjectId'] === null || enterpriseId(policy['subjectId']))
      || !(policy['resourceId'] === null || enterpriseId(policy['resourceId']))
      || !(policy['resourceName'] === null
        || (typeof policy['resourceName'] === 'string' && policy['resourceName'].length <= 200))
      || !QUOTA_ENUM_SHAPE.test(String(policy['scope']))
      || !QUOTA_ENUM_SHAPE.test(String(policy['resourceType']))
      || !(policy['rpm'] === null || record(policy['rpm']) !== undefined)
      || !(policy['concurrency'] === null || record(policy['concurrency']) !== undefined)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return {
      policyId: policy['policyId'],
      name: policy['name'],
      resourceName: policy['resourceName'] as string | null,
      fiveHours: quotaWindowUsage(policy['fiveHours']),
      daily: quotaWindowUsage(policy['daily']),
      weekly: quotaWindowUsage(policy['weekly']),
      monthly: quotaWindowUsage(policy['monthly']),
    }
  })
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

export function decodeSessionSyncStatus(value: unknown): EnterpriseSessionSyncStatus {
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

export function decodeRemoteSessions(value: unknown): readonly EnterpriseRemoteSession[] {
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

/**
 * 严格解码中心回执 `FeedbackSubmissionData`。
 *
 * 只投影界面需要的六个事实：`status` 必须命中契约枚举，时间戳必须带时区，
 * `attachmentCount` 超出 0..3 即视为畸形——服务端的其余字段（含 requestId）已在 Host 剥掉。
 */
export function decodeEnterpriseFeedbackReceipt(value: unknown): EnterpriseFeedbackReceipt {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['id', 'type', 'status', 'occurredAt', 'attachmentCount', 'createdAt'])
    || !enterpriseId(row['id'])
    || !(row['type'] === 'issue' || row['type'] === 'suggestion')
    || !ENTERPRISE_FEEDBACK_STATUSES.includes(row['status'] as EnterpriseFeedbackStatus)
    || !timestamp(row['occurredAt'])
    || !Number.isSafeInteger(row['attachmentCount'])
    || Number(row['attachmentCount']) < 0 || Number(row['attachmentCount']) > 3
    || !timestamp(row['createdAt'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    id: row['id'],
    type: row['type'],
    status: row['status'] as EnterpriseFeedbackStatus,
    occurredAt: row['occurredAt'],
    attachmentCount: Number(row['attachmentCount']),
    createdAt: row['createdAt'],
  }
}

/** 严格解码 `/auth/start` 的流程号；缺字段或空串即畸形。 */
export function decodeEnterpriseLoginStart(value: unknown): { readonly flowId: string } {
  const data = record(value)
  if (data === undefined || !hasExactKeys(data, ['flowId']) || !nonEmptyString(data['flowId'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { flowId: data['flowId'] }
}

/** 严格解码 `/auth/cancel` 的取消结论。 */
export function decodeEnterpriseLoginCancel(value: unknown): { readonly cancelled: boolean } {
  const data = record(value)
  if (data === undefined || !hasExactKeys(data, ['cancelled']) || typeof data['cancelled'] !== 'boolean') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { cancelled: data['cancelled'] }
}

/** 严格解码 `/logout`：只有显式 `true` 才算登出成功。 */
export function decodeEnterpriseLogout(value: unknown): { readonly loggedOut: true } {
  const data = record(value)
  if (data === undefined || !hasExactKeys(data, ['loggedOut']) || data['loggedOut'] !== true) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { loggedOut: true }
}

/** 严格解码 `/uninstall` 的卸载结论与是否需要重启。 */
export function decodeEnterpriseUninstall(value: unknown): { readonly uninstalled: true; readonly restartRequested: boolean } {
  const data = record(value)
  if (data === undefined || !hasExactKeys(data, ['uninstalled', 'restartRequested'])
    || data['uninstalled'] !== true || typeof data['restartRequested'] !== 'boolean') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { uninstalled: true, restartRequested: data['restartRequested'] }
}

/** 严格解码 Session 复制结果：源 id 与新 id 都必须回显且非空。 */
export function decodeEnterpriseRestoredSession(value: unknown): {
  readonly restoredSessionId: string
  readonly sourceSessionId: string
} {
  const data = record(value)
  if (data === undefined || !hasExactKeys(data, ['restoredSessionId', 'sourceSessionId'])
    || !nonEmptyString(data['restoredSessionId']) || !nonEmptyString(data['sourceSessionId'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { restoredSessionId: data['restoredSessionId'], sourceSessionId: data['sourceSessionId'] }
}

/** 从本地错误响应体里取稳定错误码；缺字段、空串或非字符串一律返回 undefined（调用方给兜底码）。 */
export function decodeEnterpriseErrorCode(value: unknown): string | undefined {
  const code = record(record(value)?.['error'])?.['code']
  return nonEmptyString(code) ? code : undefined
}

/** 本地单键信封 `{data}` 的提取；缺键、多键或非对象一律返回 undefined（畸形正文不进入界面）。 */
export function decodeEnterpriseDataEnvelope(value: unknown): unknown {
  const envelope = record(value)
  return envelope !== undefined && hasExactKeys(envelope, ['data']) ? envelope['data'] : undefined
}
