/**
 * [INPUT]: 无外部依赖；字段形状对齐企业契约真源 contracts/generated/schemas/*.schema.json 与 54 个 fixture
 * [OUTPUT]: 对外提供 E1–E4 客户端可见报文的窄类型：登录/令牌/设备/bootstrap/模型/配额/插件分配
 * [POS]: protocol 层的类型真源，被 envelope/http/platform/gateway/market/usage/routes 共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 企业网关支持的三条上游协议；决定 pi-ai provider 的 api 字段。 */
export type EnterpriseApiProtocol =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages'

/**
 * 连接状态机。与契约的语义边界一致：
 * 只有 READY 才允许发起网关请求；AUTH_EXPIRED / DEVICE_REVOKED 必须重新登录。
 */
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

/** 浏览器安全用户事实；不含任何凭据。 */
export interface EnterpriseStatusUser {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly departmentId: string | null
}

/** 本地 UI 与网关共用的脱敏平台状态。 */
export interface EnterprisePlatformStatus {
  readonly state: EnterpriseConnectionState
  readonly bundleVersion: string
  readonly platformUrl: string | null
  readonly user?: EnterpriseStatusUser
  readonly revision?: number
  readonly connectedAt?: string
  readonly errorCode?: string
  readonly errorMessage?: string
}

/** 登录事务启动后的即时返回。 */
export interface EnterpriseLoginFlow {
  readonly flowId: string
}

/** `GET /enterprise/auth/v1/authorize` 与 `sources` 的公共主体。 */
export interface EnterpriseAuthSource {
  readonly id: string
  readonly name: string
  readonly type: 'OIDC' | 'LDAP' | 'LOCAL'
}

export interface EnterpriseAuthSourcesData {
  readonly transactionId: string
  readonly csrfToken: string
  readonly sources: readonly EnterpriseAuthSource[]
}

/** LOCAL 账号口令登录请求（省略验证码字段；口令为 writeOnly，不落盘）。 */
export interface EnterprisePasswordLoginRequest {
  readonly transactionId: string
  readonly sourceId: string
  readonly csrfToken: string
  readonly username: string
  readonly password: string
  readonly captchaId?: string
  readonly captchaCode?: string
}

/** `password` 步骤结果：通常 200（可继续换码）或 409（首登强制改密挑战）。 */
export interface EnterprisePasswordStepData {
  readonly transactionId: string
  readonly redirectTo?: string
  readonly passwordChangeChallenge?: string
}

/** `POST /enterprise/auth/v1/token` 的两个 grant 变体。 */
export interface EnterpriseAuthorizationCodeGrant {
  readonly grantType: 'authorization_code'
  readonly code: string
  readonly clientId: EnterpriseClientId
  readonly redirectUri: string
  readonly codeVerifier: string
  readonly installationId: string
}

export interface EnterpriseRefreshTokenGrant {
  readonly grantType: 'refresh_token'
  readonly refreshToken: string
  readonly clientId: EnterpriseClientId
  readonly installationId: string
}

export type EnterpriseTokenRequest =
  | EnterpriseAuthorizationCodeGrant
  | EnterpriseRefreshTokenGrant

/** 仅存在于 Host 内存的令牌交换结果；refreshToken 只进凭据存储。 */
export interface EnterpriseTokenData {
  readonly accessToken: string
  readonly tokenType: 'Bearer'
  readonly expiresIn: number
  readonly clientId: EnterpriseClientId
  readonly refreshToken: string
  readonly refreshExpiresIn: number
}

export type EnterpriseClientId = 'dsh-desktop' | 'enterprise-admin' | 'ent-admin-cli'

/** 设备注册。 */
export interface EnterpriseDeviceEnrollRequest {
  readonly installationId: string
  readonly name: string
  readonly platform: string
  readonly harnessVersion: string
  readonly enterpriseBundleVersion: string
}

export interface EnterpriseDeviceEnrollData {
  readonly id: string
  readonly installationId: string
  readonly status: 'ACTIVE'
}

/** 心跳：desiredRevision 为 CAS 游标，pluginInventoryDigest 为本地插件清单摘要。 */
export interface EnterpriseDeviceHeartbeatRequest {
  readonly harnessVersion: string
  readonly enterpriseBundleVersion: string
  readonly desiredRevision: number
  readonly pluginInventoryDigest: string
  readonly pendingSessionEvents: number
  readonly lastSuccessfulSyncAt: string | null
}

/** bootstrap 模型目录条目。 */
export interface EnterpriseBootstrapModel {
  readonly alias: string
  readonly name?: string
  readonly apiProtocol: EnterpriseApiProtocol
  readonly contextWindow?: number
  readonly maxTokens?: number
  readonly reasoningEfforts?:
    | false
    | {
        readonly off?: string | null
        readonly minimal?: string
        readonly low?: string
        readonly medium?: string
        readonly high?: string
        readonly xhigh?: string
        readonly max?: string
      }
  readonly compat?: {
    readonly thinkingFormat?:
      | 'openai'
      | 'qwen'
      | 'qwen-chat-template'
      | 'deepseek'
      | 'zai'
      | 'minimax'
      | 'kimi'
      | 'longcat'
    readonly supportsReasoningEffort?: boolean
  }
  readonly isDefault: boolean
}

/** bootstrap 中的配额策略（已由服务端折算为客户端安全整数）。 */
export interface EnterpriseBootstrapQuota {
  readonly policyId: string
  readonly scope: 'ORGANIZATION' | 'DEPARTMENT' | 'USER' | 'ACCESS_GROUP'
  readonly resourceType: 'ALL_MODELS' | 'MODEL_SET' | 'MODEL'
  readonly resourceId: string | null
  readonly fiveHourTokenLimit: number | null
  readonly dailyTokenLimit: number | null
  readonly weeklyTokenLimit: number | null
  readonly monthlyTokenLimit: number | null
}

/** 插件兼容性声明；harnessCommits 为 40 位十六进制提交。 */
export interface EnterprisePluginCompatibility {
  readonly harnessCommits: readonly string[]
  readonly enterpriseBundleRange: string
  readonly operatingSystems: readonly ('darwin' | 'linux' | 'win32')[]
}

/** 一条插件分配（bootstrap.plugins.assignments 与市场列表共用）。 */
export interface EnterprisePluginAssignment {
  readonly pluginVersionId: string
  readonly packageName: string
  readonly version: string
  readonly sizeBytes: number
  readonly sha256: string
  readonly signatureBase64: string
  readonly compatibility: EnterprisePluginCompatibility
  readonly downloadUrl: string | null
  readonly required: boolean
  readonly desiredState: 'INSTALLED' | 'ABSENT'
}

/** 会话同步策略；E1–E4 不做同步实现，但必须读取以正确降级。 */
export interface EnterpriseSessionPolicy {
  readonly enabled: boolean
  readonly retentionDays: number
  readonly maxBatchBytes: number
}

/** `GET /enterprise/api/v1/bootstrap` 的严格脱敏快照。 */
export interface EnterpriseBootstrapSnapshot {
  readonly revision: number
  readonly user: EnterpriseStatusUser
  readonly device: {
    readonly id: string
    readonly installationId: string
    readonly status: 'ACTIVE'
  }
  readonly models: readonly EnterpriseBootstrapModel[]
  readonly quotas: readonly EnterpriseBootstrapQuota[]
  readonly plugins: {
    readonly revision: number
    readonly assignments: readonly EnterprisePluginAssignment[]
  }
  readonly sessionPolicy: EnterpriseSessionPolicy
}

/** `GET /enterprise/api/v1/usage/me` 的单个配额窗口。 */
export interface EnterpriseTokenWindowUsage {
  readonly limit: number | null
  readonly usedTokens: number
  readonly reservedTokens: number
  readonly resetsAt: string | null
}

/** 单条配额策略的实时用量。 */
export interface EnterpriseQuotaUsagePolicy {
  readonly policyId: string
  readonly name: string
  readonly scope: 'ORGANIZATION' | 'DEPARTMENT' | 'USER' | 'ACCESS_GROUP'
  readonly subjectId: string | null
  readonly resourceType: 'ALL_MODELS' | 'MODEL_SET' | 'MODEL'
  readonly resourceId: string | null
  readonly resourceName: string
  readonly fiveHours: EnterpriseTokenWindowUsage | null
  readonly daily: EnterpriseTokenWindowUsage | null
  readonly weekly: EnterpriseTokenWindowUsage | null
  readonly monthly: EnterpriseTokenWindowUsage | null
}

/** 企业配方（E4 的并列资产，只读浏览 + 下载授权）。 */
export interface EnterprisePresetVersion {
  readonly presetVersionId: string
  readonly packageName: string
  readonly version: string
  readonly sizeBytes: number
  readonly sha256: string
  readonly signatureBase64: string
  readonly downloadUrl: string | null
  readonly desiredState: 'INSTALLED' | 'ABSENT'
}

/** 网关可见的路由前缀；与契约 paths/gateway.yaml 三类端点一一对应。 */
export const ENTERPRISE_GATEWAY_ROUTES: Readonly<Record<EnterpriseApiProtocol, string>> = {
  'openai-completions': '/enterprise/gateway/v1/chat/completions',
  'openai-responses': '/enterprise/gateway/v1/responses',
  'anthropic-messages': '/enterprise/gateway/v1/messages',
}

/** 企业默认 provider / 模型哨兵（与 dshent 契约保持一致）。 */
export const ENTERPRISE_PROVIDER = 'enterprise'
export const ENTERPRISE_DEFAULT_MODEL = 'enterprise/default'
