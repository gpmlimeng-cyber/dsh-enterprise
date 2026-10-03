/**
 * [INPUT]: 依赖 zod、生成契约、官方 settings 的 volatile Config 引用形状、installation 与本地 API 端口
 * [OUTPUT]: 对外提供 BootstrapSnapshot、平台状态/错误（含安卓授权页交接时随 AUTHORIZING 下发的 `authorizeUrl`）、volatile 引用识别与无验收探针的 Service 配置（含 `browserHandoff` 开关，以及组合层注入的企业插件动作端口 `pluginAction`/`pluginStatus`、企业技能安装端口 `skillAction`/`skillStatus` 与只读正文端口 `skillContent`）
 * [POS]: platform-client 的公共契约层，隔离中心 HTTP 输入、Host 运行参数、官方 settings 引用与无秘密界面状态
 * **本刀（插件行动分流）**：`EnterprisePlatformServiceInternals` 新增 `pluginSetEnabled`（组合层注入的启用/停用端口），
 *   缺席即那两条路由按「分发不可用」如实拒——与 `pluginAction`/`pluginCancel` 同一条接线手法。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from 'zod'
import { zBootstrapQuota, zRequestId, zRevision, type EnterpriseErrorCode } from '@dshent/contracts'
import type { InstallationOptions } from './installation.js'
import type { EnterpriseLocalApiOptions } from './local-api.js'

/** 不携带响应主体或凭据的稳定 Service 失败，并保留经过 Fetch 校验的 Retry-After。 */
export class EnterprisePlatformError extends Error {
  constructor(
    readonly code: EnterpriseErrorCode
      | 'ENT_AUTH_CANCELLED'
      | 'ENT_AUTH_TIMEOUT'
      | 'ENT_PLATFORM_DISPOSED'
      | 'ENT_SETTINGS_UNAVAILABLE',
    message: string,
    readonly retryable = false,
    readonly httpStatus?: number,
    readonly requestId?: string,
    readonly retryAfter?: string,
  ) {
    super(message)
    this.name = 'EnterprisePlatformError'
  }
}

/** 官方 settings 投影出的 volatile Config 引用读面；官方 `Volatile<T>` 的结构等价面。 */
export interface SettingsReference<T> {
  /** @returns 引用的当前值。 */
  get(): T
}

/**
 * 识别官方 volatile Config 引用。组合层把声明为 volatile 的字段引用交给本 Service，
 * 未声明 volatile 的字段解析为普通值，因此这里按结构判定，让写入侧以语义准确的码拒绝，
 * 而不是在运行期按错误的方法名抛异常。
 *
 * @param value - 组合层传入的字段值。
 * @returns 可读引用；普通值、空值或缺 `get()` 时 undefined。
 */
export function settingsReference<T>(value: unknown): SettingsReference<T> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const read: unknown = Reflect.get(value, 'get')
  if (typeof read !== 'function') return undefined
  return { get: () => Reflect.apply(read, value, []) }
}

/** 平台客户端所需的部署时与 Host 版本事实。 */
export interface EnterprisePlatformConfig {
  readonly baseUrl?: string
  /** 官方 settings 中用户持久化的 Server 地址引用；缺省时地址只读，写入以 `ENT_SETTINGS_UNAVAILABLE` 拒绝。 */
  readonly serverUrl?: SettingsReference<string | undefined> | undefined
  readonly harnessVersion: string
  readonly bundleVersion: string
  readonly requestTimeoutMs?: number
  readonly disposeTimeoutMs?: number
  readonly callbackTimeoutMs?: number
  readonly dshHome?: string
  readonly installationName?: string
}

/** 不进入可序列化 bundle Config 的测试与 carrier seam。 */
export interface EnterprisePlatformInternals {
  readonly fetch?: typeof globalThis.fetch
  readonly openBrowser?: (url: string, signal: AbortSignal) => Promise<void>
  /**
   * 授权页交接方，默认 `host`（宿主进程自己打开系统浏览器）。
   *
   * 安卓必须传 `client`：宿主进程没有任何可用的开源路径——Termux 与系统的 `am` 都会被
   * `ActivityTaskManagerService.assertPackageMatchesCallerUid` 以「包名不属于调用 uid」拒绝，
   * 实测壳注入的 `window.androidBridge` 在 WebView 里也取不到。此时授权 URL 随状态下发，
   * 由登录弹窗用 iframe 直接渲染授权页（实测服务端未设 `X-Frame-Options`/`frame-ancestors`，
   * 且宿主页面本身是非安全上下文、混合内容不拦），登录成功后的重定向仍命中宿主本机回调，
   * PKCE 链路照常闭合。
   */
  readonly browserHandoff?: 'host' | 'client'
  readonly now?: () => Date
  readonly createFlowId?: () => string
  readonly createState?: () => string
  /** 官方 settings 命名空间；生产由 owner Loader entry id 决定，非 Loader carrier 与测试在此显式指定。 */
  readonly settingsNamespace?: string
  readonly installation?: Omit<InstallationOptions, 'dshHome' | 'name'>
  readonly pluginStatus?: () => unknown
  readonly pluginAction?: EnterpriseLocalApiOptions['pluginAction']
  /** 受管插件**取消**（bundle 侧转官方 `pluginManager.cancelInstall`）；缺席时那条动作路由如实拒。 */
  readonly pluginCancel?: EnterpriseLocalApiOptions['pluginCancel']
  /** 启用 / 停用端口（bundle 组合层注入；缺席即那两条路由按「分发不可用」如实拒）。 */
  readonly pluginSetEnabled?: EnterpriseLocalApiOptions['pluginSetEnabled']
  /** 企业技能安装/卸载（由 bundle 侧实现），返回安装后的最新已装态。 */
  readonly skillAction?: EnterpriseLocalApiOptions['skillAction']
  /** 企业技能已装清单；界面列表加载时读一次。 */
  readonly skillStatus?: EnterpriseLocalApiOptions['skillStatus']
  /** 读一条**已装**技能的 SKILL.md 正文（点技能行看详情时用）；缺席即不注册那条只读路由。 */
  readonly skillContent?: EnterpriseLocalApiOptions['skillContent']
  /** 企业配方一键启用（由 bundle 侧实现）；缺席时 `/presets/<id>/enable` 如实按非法请求拒。 */
  readonly presetEnable?: EnterpriseLocalApiOptions['presetEnable']
  /** 企业配方停用（按**声明 id**）；缺席时 `/presets/<id>/disable` 如实按非法请求拒。 */
  readonly presetDisable?: EnterpriseLocalApiOptions['presetDisable']
  /** 配方启用前的真值（三态授权 / 进行中 / 披露清单）；缺席时 `/presets/<id>/status` 如实按非法请求拒。 */
  readonly presetStatus?: EnterpriseLocalApiOptions['presetStatus']
  readonly uninstallPlugin?: () => Promise<{ readonly restart?: () => void }>
  readonly sessionSync?: EnterpriseLocalApiOptions['sessionSync']
}

/** 本地 Client 界面渲染的固定生命周期。 */
export type EnterpriseConnectionState =
  | 'UNCONFIGURED'
  | 'SIGNED_OUT'
  | 'AUTHORIZING'
  | 'ENROLLING'
  | 'BOOTSTRAPPING'
  | 'READY'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFRESHING'
  | 'AUTH_EXPIRED'
  | 'DEVICE_REVOKED'

const numericId = z.string().regex(/^[1-9][0-9]{0,18}$/)
const revision = zRevision
const pluginVersionId = numericId
const pluginPackageName = z.string().min(1).max(214)
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/)
const pluginVersion = z.string().min(1).max(64)
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/)
const pluginSha256 = z.string().regex(/^[0-9a-f]{64}$/)
const pluginCompatibility = z.object({
  harnessCommits: z.array(z.string().regex(/^[0-9a-f]{40}$/)).min(1).max(20),
  enterpriseBundleRange: z.string().min(1).max(120),
  operatingSystems: z.array(z.enum(['darwin', 'linux', 'win32'])).min(1).max(3),
}).strict()
const installationId = z.uuid().regex(
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/,
)
const reasoningEfforts = z.object({
  off: z.string().min(1).max(255).nullable().optional(),
  minimal: z.string().min(1).max(255).optional(),
  low: z.string().min(1).max(255).optional(),
  medium: z.string().min(1).max(255).optional(),
  high: z.string().min(1).max(255).optional(),
  xhigh: z.string().min(1).max(255).optional(),
  max: z.string().min(1).max(255).optional(),
}).strict()
const reasoningCompat = z.object({
  thinkingFormat: z.enum([
    'openai', 'qwen', 'qwen-chat-template', 'deepseek', 'zai', 'minimax', 'kimi', 'longcat',
  ]).optional(),
  supportsReasoningEffort: z.boolean().optional(),
}).strict()
const tokenLimitKeys = [
  'fiveHourTokenLimit', 'dailyTokenLimit', 'weeklyTokenLimit', 'monthlyTokenLimit',
] as const
const bootstrapQuota = zBootstrapQuota
  .refine(quota => tokenLimitKeys.every(key => quota[key] === null
    || quota[key] <= BigInt(Number.MAX_SAFE_INTEGER)), 'quota token limit exceeds the client safe integer range')
  .transform(quota => ({
    ...quota,
    fiveHourTokenLimit: quota.fiveHourTokenLimit === null ? null : Number(quota.fiveHourTokenLimit),
    dailyTokenLimit: quota.dailyTokenLimit === null ? null : Number(quota.dailyTokenLimit),
    weeklyTokenLimit: quota.weeklyTokenLimit === null ? null : Number(quota.weeklyTokenLimit),
    monthlyTokenLimit: quota.monthlyTokenLimit === null ? null : Number(quota.monthlyTokenLimit),
  }))

/** 严格脱敏 bootstrap 响应主体；凭据和 Session 正文没有 schema 席位。 */
export const zBootstrapSnapshot = z.object({
  revision,
  user: z.object({
    id: numericId,
    username: z.string().min(1).max(100),
    displayName: z.string().min(1).max(120),
    departmentId: numericId.nullable(),
  }).strict(),
  device: z.object({
    id: numericId,
    installationId,
    status: z.literal('ACTIVE'),
  }).strict(),
  models: z.array(z.object({
    alias: z.string().min(1).max(120),
    name: z.string().min(1).max(120).optional(),
    apiProtocol: z.enum(['openai-completions', 'openai-responses', 'anthropic-messages']),
    contextWindow: z.number().int().positive().safe().optional(),
    maxTokens: z.number().int().positive().safe().optional(),
    reasoningEfforts: z.union([z.literal(false), reasoningEfforts]).optional(),
    compat: reasoningCompat.optional(),
    isDefault: z.boolean(),
  }).strict()),
  quotas: z.array(bootstrapQuota),
  plugins: z.object({
    revision,
    assignments: z.array(z.object({
      pluginVersionId,
      packageName: pluginPackageName,
      version: pluginVersion,
      // 制品 package.json 的 description（契约 `PluginDescription`，**可选**）：
      // 服务端读不到就**整个键缺席**（绝不发 null/空串），故这里 `.optional()` 两种形态都收；
      // 这一份是 `.strict()` 的，服务端先发这个键而这里不认就会让整条 bootstrap 失败——两侧同批上线。
      // 上限跟契约 `PluginDescription.maxLength` 走（V41 由 300 提到 1000）：真实制品里有 347 字符的描述。
      description: z.string().min(1).max(1000).optional(),
      sizeBytes: z.number().int().positive().safe(),
      sha256: pluginSha256,
      signatureBase64: z.union([z.literal(''), z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/)]),
      compatibility: pluginCompatibility,
      downloadUrl: z.string().min(1).max(2048).nullable(),
      required: z.boolean(),
      desiredState: z.enum(['INSTALLED', 'ABSENT']),
    }).strict()),
  }).strict(),
  sessionPolicy: z.object({
    enabled: z.boolean(),
    retentionDays: z.number().int().positive().safe(),
    maxBatchBytes: z.number().int().positive().safe(),
  }).strict(),
}).strict()

export type BootstrapSnapshot = z.infer<typeof zBootstrapSnapshot>

/** bootstrap 快照的标准平台响应 envelope。 */
export const zBootstrapResponse = z.object({
  data: zBootstrapSnapshot,
  requestId: zRequestId,
}).strict()

/** 从当前 bootstrap 拷贝的浏览器安全用户事实。 */
export interface EnterpriseStatusUser {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly departmentId: string | null
}

/** 同时通过 ctx.enterprisePlatform 与本地 API 暴露的脱敏状态。 */
export interface EnterprisePlatformStatus {
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
   * 仅 `browserHandoff: 'client'` 且处于 AUTHORIZING 时下发：宿主已用这条授权 URL 在服务端
   * 开了事务（自己 GET，不交给浏览器）。
   *
   * 客户端把它当「本轮是原生表单登录」的信号，据 `/local/auth/form` 渲染账号表单；
   * `host` 模式下宿主自己打开系统浏览器，故该字段永不出现。
   */
  readonly authorizeUrl?: string
  /** 授权页交接方：native = 客户端渲染原生表单；browser = 宿主自己打开系统浏览器。客户端据此决定是否渲染原生表单，不必再用 UA 猜测。 */
  readonly loginMode?: 'browser' | 'native'
}

/** 浏览器登录事务启动后立即返回的结果。 */
export interface EnterpriseLoginFlow {
  readonly flowId: string
}

/** 服务端 `/sources` 返回的一条企业认证来源。 */
export interface EnterpriseAuthSource {
  readonly id: string
  readonly name: string
  readonly type: 'LOCAL' | 'OIDC'
}

/** 原生登录表单的数据面：本轮事务可用的来源（服务端已关闭验证码，故不含验证码面）。 */
export interface EnterpriseLoginForm {
  readonly sources: readonly EnterpriseAuthSource[]
}

/** 原生登录的凭证入参；密码只在内存中转发给企业服务器，绝不落盘、绝不进日志。 */
export interface EnterpriseCredentialsInput {
  readonly sourceId: string
  readonly username: string
  readonly password: string
}

/** 「需先改密」分支的入参：challenge 来自服务端 409 响应，一次性使用。 */
export interface EnterprisePasswordChangeInput {
  readonly challenge: string
  readonly newPassword: string
}

/** 原生凭证提交结果：`redirect` = 已驱动本机回调、登录在后台继续；`change-password` = 服务端要求先改密。 */
export type EnterpriseCredentialResult =
  | { readonly next: 'redirect' }
  | { readonly next: 'change-password'; readonly challenge: string; readonly rejected: boolean }
