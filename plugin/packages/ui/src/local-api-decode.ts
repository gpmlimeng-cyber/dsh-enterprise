/**
 * [INPUT]: 依赖 branding 的同源 LOGO 来源门禁与 `EnterpriseBrandingDocument` 形状、decode-primitives 的严格解码内核、skill-api-decode 的技能 DTO 与解码 **本刀**：修 `decodeEnterprisePresets` 的 `sizeBytes` 上界判定写反（原先任何非零大小的配方都被判畸形），改为与插件目录同款的 `<= 0`；**配方收尾刀**：`decodeEnterprisePresets` 补契约切片 B 的 `dependencies`（放**可选位**，旧服务端不输出也照旧可解），按契约 `PresetDependency` 逐条校验并把键集抽成导出的常量供漂移门禁比对。
 * [OUTPUT]: 对外提供连接/受管插件状态枚举、本地 API DTO 类型与严格解码（账号、品牌、插件、配方、Session、四窗口用量、反馈回执、原生登录的来源列表与凭证/改密结果、**企业技能已装态 / 已装正文 / 本机文件树 / 树里单个文本文件**）、配方引用 `EnterpriseRuntimePresetDependency` 与四份**运行时键集常量**（`ENTERPRISE_PRESET_ROW_REQUIRED_KEYS` / `ENTERPRISE_PRESET_ROW_OPTIONAL_KEYS` / `ENTERPRISE_PRESET_DEPENDENCY_KEYS` / `ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL_KEYS`，是 `tests/preset-decode.spec.ts` 契约漂移门禁的被测真源）、`EnterpriseLocalApi` 契约（含本刀新增的**取消**端口 `cancelPlugin(packageName, signal)`——响应与只读 `GET /plugins` 同形，故复用同一个严格解码器、**零新增字段**）、失败码投影 `enterpriseLocalErrorCode`，并再导出 `EnterpriseLocalApiError` 与 skill-api-decode 的全部技能契约 **本刀（配方一键启用）**：新增 `decodeEnterprisePresetEnable` / `decodeEnterprisePresetDisable` / `decodeEnterprisePresetStatus` 与它们的 DTO（披露清单 `EnterprisePresetDisclosure`、已装记录 `EnterpriseInstalledPreset`、授权三态 `EnterprisePresetAuthorization`、官方原值 `EnterprisePresetOfficialApplication`）与九份**键集常量**（enable/disable 的必填+可选、status 的必填、已装八键、披露三件、`officialError` 的两键）——形状真源是 Host 的 `bundle/src/preset-service.ts` 三个脱敏视图，未知键一律拒，`status.installed` 是**必填位上的可空值**。
 * [POS]: dsh-ui 的浏览器取数契约层——只定义「主机可以说什么」与「什么不许说」，不含任何 fetch；网络执行留在 local-api.ts，界面只消费本文件的投影结果。逼近 800 行后按业务纵切出技能分片与共享内核，本文件仍是唯一对外真源 **本刀**：这三条是**本机动作**（不是中心契约），故键集常量单独导出、由 `tests/preset-enable-decode.spec.ts` 做封闭键集断言；本文件仍是唯一 DTO 真源。
 * **本刀（插件行动分流）**：`EnterprisePluginItem` 新增那一枚**启停位** `enabled`（与「装没装」正交；
 *   解码白名单把它放在**可选键**位、缺席时归一成 `true`——旧 Host 那一半不发这个键也照旧解得开，
 *   绝不存在「服务端先发、客户端不认」的中间态；形状不是布尔照样判畸形）。`EnterpriseLocalApi` 相应新增
 *   `setPluginEnabled(packageName, enabled, signal)`。
 * **本刀（卡片标题 = 插件名称）**：`EnterprisePluginCatalogItem` 新增 `displayName`（契约 `PluginDisplayName`，
 *   1..120）——卡片**标题**取值；白名单把它放在**可选键**位（缺席 / JSON null / 非空串 ≤120 三种合法形态，
 *   其余一律判畸形），投影时只有真拿到非空串才产出该键。缺席 = 旧 Host（这一刀之前那批 bootstrap 不带它），
 *   渲染层据此**回退成包名**（不空白、不编造）——与同侧可选 `description` 逐条同口径。
 * **本刀（口径 20：描述来自 README）**：`EnterprisePluginCatalogItem` 再新增**可选** `readme`
 *   （契约 `PluginReadme`，1..65536）——插件详情「描述」段的**首选**取值。白名单把它放在**可选键**位
 *   （缺席 / JSON null / 非空串 ≤65536 三种合法形态，其余一律判畸形），投影时只有真拿到非空串才产出该键；
 *   本层**只看形状、不解析内容**（README 是数据：不解析 Markdown、不查标签、不 trim、绝不注入 HTML）。
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
import type { EnterpriseInstalledSkill, EnterpriseInstalledSkillContent, EnterpriseInstalledSkillFile, EnterpriseRuntimeSkill, EnterpriseSkillFiles } from './skill-api-decode.js'
import type {
  EnterpriseLibraryHit,
  EnterpriseLibraryImportResult,
  EnterpriseLibrarySpace,
  EnterpriseLibraryText,
} from './library-api-decode.js'

export { EnterpriseLocalApiError } from './decode-primitives.js'
export * from './skill-api-decode.js'
export * from './library-api-decode.js'

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
  /**
   * 这一枚本机**启用着吗**（用户显式停用后为 `false`）。
   *
   * 它是「已安装」那一行那枚【开关】的 `checked` 真源；**与「装没装」正交**：装没装只认
   * `desiredState`（`INSTALLED`）。**为缺失设计**：Host 的旧投影不带这个键时按 `true` 归一
   * （缺省就是启用），故新旧两半都解得开，不存在「服务端先发、客户端不认」的中间态；
   * 客户端**绝不**从 `state` 反推它（`ACTIVE` 只说明落盘与加载，不说明启停）。
   */
  readonly enabled: boolean
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
  /**
   * 制品 `package.json` 的 `displayName`（契约 `PluginDisplayName`，1..120）——卡片**标题**取值。
   *
   * **可为缺失**：服务端/新 Host 永远带它（验包器缺省回退包名），只有**旧 Host**（这一刀之前那批
   * bootstrap 不带该键）才缺席。本层把缺席 / JSON null / 空串一律归一成「没有这个键」，
   * 渲染层据此**回退成包名**（不空白、不编造）——这是刻意的兼容窗口，绝不是本层吞字段。
   */
  readonly displayName?: string
  /**
   * 制品 `package.json` 的 `description`（契约 `PluginDescription`，≤1000）。
   * **为缺失设计**：本层把缺席 / JSON null / 空串一律归一成「没有这个键」（与技能侧可选
   * `category` 同一口径），卡片第二行据此如实降级成「暂无描述」——绝不塞占位、绝不编造。
   */
  readonly description?: string
  /**
   * 制品 tar 里那份 README 的纯文本（契约 `PluginReadme`，≤65536）——插件**详情「描述」段**的
   * 首选取值（口径 20：描述来自 README，没有才回落到上面那一枚短 `description`）。
   *
   * **为缺失设计**：本层把缺席 / JSON null / 空串一律归一成「没有这个键」（与 `description`
   * 同一口径），渲染层据此回落到短描述——绝不塞占位、绝不编造。
   * **它是数据不是指令**：本层与渲染层都不解析 Markdown、不执行、绝不注入 HTML。
   * 上限与契约 `PluginReadme.maxLength` 同值（65536）：服务端按 UTF-8 字节截断，
   * 字符数不可能超过它，故这里用同一个上界；越界整条判畸形（不静默截断）。
   */
  readonly readme?: string
  readonly sizeBytes: number
  readonly operatingSystems: readonly string[]
  readonly installErrorCode?: string
}

/**
 * 一份配方引用的一项技能或插件（契约 `PresetDependency` 的员工端只读投影）。
 *
 * 名字带 `Runtime` 前缀是刻意的：marketplace-entry 的「包含内容」投影另有一份从 `unknown` 读原始结构的
 * `EnterpriseMarketPresetDependency`（宽口径、`kind`/`mode` 都是 string），而 client.tsx 同时 `export *`
 * 这两个模块。两份类型各占一个不会被对方抢走的名字，整个出口因此不可能出现同名歧义（TS2308）。
 *
 * 只保留作者面的五个字段：`kind`/`id`/`mode`/`required` 与钉版本的 `versionId`。
 * 契约里的留位第 6 键 `resolvedVersionId`（二期发布口解析"当时最新"后才填）本层**校验形状后丢弃**，
 * 照「sha256 校验后不投影」的既有策略——它不是运行时真源，界面也不需要它。
 */
export interface EnterpriseRuntimePresetDependency {
  readonly kind: 'skill' | 'plugin'
  readonly id: string
  readonly mode: 'pinned' | 'latest'
  /** 只有服务端真带出雪花时才产出该键（`latest` 或缺席都不产出）。 */
  readonly versionId?: string
  readonly required: boolean
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
  /**
   * 这份配方引用的技能/插件清单（契约 `RuntimePresetSummary.dependencies`，详情经 allOf 继承同一字段）。
   *
   * **为缺失设计**（照 `category` / `whenToUse` 的同一策略）：旧服务端不输出这个键时**不产出该键**，
   * 而不是补一个空数组——"字段缺席"与"确实没有引用"是两件事，界面据此分别说「暂时无法读取包含内容」
   * 与「不包含任何内容」，不把读不到说成没有。于是「先发 plugin 再发 server」的窗口里列表与详情照旧可解。
   * 数组长度上限与契约 `maxItems` 一致（超 200 条整条失败，不截断）。
   */
  readonly dependencies?: readonly EnterpriseRuntimePresetDependency[]
}

/**
 * 配方 runtime 行的键集真源：列表与详情共用同一份解码，所以这里是两者的**并集**。
 *
 * 导出是给契约漂移门禁用的——`tests/preset-decode.spec.ts` 逐字比对
 * 「解码器白名单键集 == `contracts/generated/schemas/RuntimePresetSummary` ∪ `RuntimePresetDetail` 声明的键集」。
 * 解码器必须使用这两份常量而不是内联数组，否则常量会与真正的白名单脱钩、门禁形同虚设。
 *
 * 「必填/可选」有意比契约松（契约里 `dependencies` 必填、详情的 `versionId`/`sha256` 必填）：
 * 一个函数同时服务列表与详情、且要兼容旧服务端，把它们放可选位才能两种行都解得出；
 * 漂移门禁锁的是**键集**（白名单不能多也不能少），必填性是单独的、写在测试里的显式错位断言。
 */
export const ENTERPRISE_PRESET_ROW_REQUIRED_KEYS = [
  'id', 'presetId', 'displayName', 'description', 'sourceDshVersion', 'sizeBytes', 'updatedAt',
] as const

export const ENTERPRISE_PRESET_ROW_OPTIONAL_KEYS = ['versionId', 'sha256', 'dependencies'] as const

/**
 * 单条配方引用的键集真源（契约 `PresetDependency`）。
 *
 * `resolvedVersionId` 是契约声明的留位键：本切片服务端不输出它，但**契约声明了它**，
 * 而员工端解码器是关闭键集——把它放进可选位，二期服务端开始输出时才不会让整条响应判畸形
 * （这正是"员工端比服务端严 ⇒ 静默炸"那三起事故的同一种病）。
 */
export const ENTERPRISE_PRESET_DEPENDENCY_KEYS = ['kind', 'id', 'mode', 'required'] as const

export const ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL_KEYS = ['versionId', 'resolvedVersionId'] as const

/** 契约 `RuntimePresetSummary.dependencies.maxItems`；超限按既有稳定码整条失败，绝不静默截断。 */
const PRESET_MAX_DEPENDENCIES = 200

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
  /**
   * 配方**启用前的真值**（授权三态 / 是否进行中 / 披露清单 / 已装记录）。
   *
   * 只发一条同源 GET（`/presets/<雪花 id>/status`），只读、不写任何授权；
   * 授权弹层与行上开关的三态都从它算——因此「员工确认过的那份披露」与「随后真正会装的东西」
   * 来自 Host 的**同一次渲染**，不可能各说一套。
   */
  presetStatus(presetPackageId: string, signal: AbortSignal): Promise<EnterprisePresetStatus>
  /**
   * **一键启用**一条配方。
   *
   * @param presetPackageId - 中心配方包雪花 id。
   * @param confirmFingerprint - 员工在披露弹层确认过的那一枚集合指纹；**缺席**表示只按已授权状态尝试
   *   （未授权 / 指纹已变由 Host 如实拒，绝不替用户顺手授权）；传了就要求它与 Host 当前指纹逐字相等，
   *   否则回 `ENT_PRESET_AUTHORIZATION_STALE`。请求体是**关闭键集**：`{}` 或恰好 `{confirmFingerprint}`。
   */
  enablePreset(
    presetPackageId: string,
    confirmFingerprint: string | undefined,
    signal: AbortSignal,
  ): Promise<EnterprisePresetEnableResult>
  /**
   * **停用**一条配方；`declarationId` 是 Host 归一化后的声明 id（kebab，来自 status / enable 回执），
   * 不是雪花包 id。请求体恒为 `{}`（关闭键集）。
   */
  disablePreset(declarationId: string, signal: AbortSignal): Promise<EnterprisePresetDisableResult>
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
  /**
   * 列一条**已装**技能包在本机真树上的条目（详情子页面的**左文件树**用它）。
   *
   * 只传包 id：Host 从自己的已装记录出发读真目录，未装 / 记录不符一律 404；界面自己从不编树。
   */
  skillFiles(packageId: string, signal: AbortSignal): Promise<EnterpriseSkillFiles>
  /**
   * 读该树里的一个**文本**文件（详情子页面的**右文件预览**用它；默认那个就是 `SKILL.md`）。
   *
   * `path` 只能来自 `skillFiles` 回传的条目——界面从不拼路径，也不接受用户输入；
   * 二进制 / 超 256 KiB / 符号链接逃逸在 Host 侧各有稳定错误码。
   */
  skillFile(packageId: string, path: string, signal: AbortSignal): Promise<EnterpriseInstalledSkillFile>
  /** 一键安装一个技能包；返回安装后的最新已装态（一次往返拿到真值）。 */
  installSkill(packageId: string, signal: AbortSignal): Promise<readonly EnterpriseInstalledSkill[]>
  /** 卸载一个已装技能包；返回卸载后的最新已装态。 */
  uninstallSkill(packageId: string, signal: AbortSignal): Promise<readonly EnterpriseInstalledSkill[]>
  installPlugin(packageName: string, pluginVersionId: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  removePlugin(packageName: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  /**
   * 把一枚**已安装**的企业插件置为启用 / 停用（`POST /plugins/enable` / `/plugins/disable`）。
   *
   * 语义（用户明确纠正过）：`enabled: false` = **停用**，**不是**卸载——依赖仍在本机、记录仍是
   * `desiredState: 'INSTALLED'`，只是这枚插件不再参与运行；卸载是另一条路（`removePlugin`），
   * 只在详情页给。响应的形状与只读 `GET /plugins` **完全同形**（零新增字段 ⇒ 解码器复用同一个），
   * `enabled` 那一枚启停位就在响应里，界面收下即得真值、不自行宣判。
   */
  setPluginEnabled(packageName: string, enabled: boolean, signal: AbortSignal): Promise<EnterprisePluginStatus>
  /**
   * 取消**在途**的企业插件安装。
   *
   * 只发一条同源 POST（`/plugins/cancel`，正文关闭键集恰好 `{packageName}`）；**响应与只读 `GET /plugins`
   * 完全同形**（`{data: pluginStatus()}`，零新增字段 ⇒ 解码器不用改），故这里复用同一个严格解码器。
   * 真的取消掉时 Host 已把本机记录**回到安装前那一条**（本次安装请求会以 `ENT_PLUGIN_INSTALL_CANCELLED`
   * 收束，那条失败由唯一提示组件显示）；「没有在跑的东西可取消」也如实回 200 + 当前状态，不假装成功。
   */
  cancelPlugin(packageName: string, signal: AbortSignal): Promise<EnterprisePluginStatus>
  /**
   * 资料库目录（根标题 + 全部树节点 + 全部资产；界面自己拼树）。
   *
   * 只发一条同源 POST（`/library` 的单入口，`{endpoint:'space'}`）；`{error:{code}}` 非 2xx 时
   * 按受控码抛（未登录 / 宿主还没接线是 `ENT_LIBRARY_UNAVAILABLE`）。
   */
  librarySpace(signal: AbortSignal): Promise<EnterpriseLibrarySpace>
  /** 导入一份 md/txt（正文以文本过桥；文件名决定格式，不认的扩展名由 Host 拒）。 */
  libraryImport(
    input: { readonly name: string; readonly content: string; readonly parentId?: string | null },
    signal: AbortSignal,
  ): Promise<EnterpriseLibraryImportResult>
  /** 检索（空查询＝按最近更新列出，最多 50 条）。 */
  librarySearch(query: string, signal: AbortSignal): Promise<readonly EnterpriseLibraryHit[]>
  /** 读一份资料的正文（当前版本；正文一次给全，超大正文由 Host 的文件上限拒）。 */
  libraryReadText(assetId: string, signal: AbortSignal): Promise<EnterpriseLibraryText>
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
    ], ['enabled'])
    || !nonEmptyString(item['packageName'])
    || !nullableString(item['version'])
    || !(item['sha256'] === null || (typeof item['sha256'] === 'string' && /^[0-9a-f]{64}$/.test(item['sha256'])))
    || !Number.isSafeInteger(item['desiredRevision']) || Number(item['desiredRevision']) < 0
    || !(item['desiredState'] === 'INSTALLED' || item['desiredState'] === 'ABSENT')
    || !MANAGED_PLUGIN_STATES.includes(item['state'] as ManagedPluginState)
    || !nullableString(item['lastErrorCode'])
    || !nullableString(item['restartMarker'])
    || (item['enabled'] !== undefined && typeof item['enabled'] !== 'boolean')) return undefined
  return {
    packageName: item['packageName'],
    version: item['version'],
    desiredRevision: Number(item['desiredRevision']),
    desiredState: item['desiredState'],
    state: item['state'] as ManagedPluginState,
    lastErrorCode: item['lastErrorCode'],
    // 键缺席 = 旧 Host（那一半还没有启停位）⇒ 按「启用」归一，绝不从 `state` 反推。
    enabled: item['enabled'] === undefined ? true : item['enabled'] === true,
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
      ['pluginVersionId', 'packageName', 'version', 'sizeBytes', 'operatingSystems'],
      ['displayName', 'description', 'readme', 'installErrorCode'])
      || !enterpriseId(item['pluginVersionId']) || !nonEmptyString(item['packageName'])
      || !nonEmptyString(item['version']) || !Number.isSafeInteger(item['sizeBytes']) || Number(item['sizeBytes']) <= 0
      || !Array.isArray(item['operatingSystems']) || item['operatingSystems'].some(os => !['darwin', 'linux', 'win32'].includes(os))
      // 显示名与技能侧可选 `category`、同侧可选 `description` **同一口径**：缺席 / JSON null / 非空串
      // ≤120 三种合法形态；非 string 非 null 或超过契约上限（`PluginDisplayName.maxLength`）一律判畸形。
      || !(item['displayName'] === undefined || item['displayName'] === null
        || (typeof item['displayName'] === 'string' && item['displayName'].length <= 120))
      // 描述与技能侧可选 `category` **同一口径**：缺席 / JSON null / 非空串 ≤1000 三种合法形态，
      // 非 string 非 null 或超过契约上限一律判畸形（不静默截断、不猜）。
      // 上限与契约 `PluginDescription.maxLength` 同值（V41 由 300 提到 1000：真实制品有 347 字符的描述）。
      || !(item['description'] === undefined || item['description'] === null
        || (typeof item['description'] === 'string' && item['description'].length <= 1000))
      // README（口径 20）与同侧 `description` **同一口径**：缺席 / JSON null / 非空串 ≤65536 三种合法形态，
      // 非 string 非 null 或超契约上限一律判畸形。**内容一个字符都不看**：它是数据，本层不解析 Markdown、
      // 不查 HTML 标签、不 trim（换行与记号原样交给渲染层当纯文本子节点）。
      || !(item['readme'] === undefined || item['readme'] === null
        || (typeof item['readme'] === 'string' && item['readme'].length <= 65_536))
      || item['installErrorCode'] !== undefined && !nonEmptyString(item['installErrorCode'])) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return {
      pluginVersionId: item['pluginVersionId'] as string,
      packageName: item['packageName'] as string,
      version: item['version'] as string,
      sizeBytes: Number(item['sizeBytes']),
      operatingSystems: item['operatingSystems'] as readonly string[],
      // 只有真拿到非空串才产出这个键；缺席/null/空串一概不产出（渲染层据此**回退包名**，不是画空白标题）。
      ...(nonEmptyString(item['displayName']) ? { displayName: item['displayName'] } : {}),
      // 只有真拿到非空串才产出这个键；缺席/null/空串一概不产出（卡片据此说「暂无描述」，不是空白）。
      ...(nonEmptyString(item['description']) ? { description: item['description'] } : {}),
      // 只有真拿到非空串才产出这个键；缺席/null/空串一概不产出（详情据此**回落短描述**，不是画空白）。
      ...(nonEmptyString(item['readme']) ? { readme: item['readme'] } : {}),
      ...(item['installErrorCode'] === undefined ? {} : { installErrorCode: item['installErrorCode'] as string }),
    }
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

/**
 * 严格解码一份配方的引用清单（契约 `PresetDependency` 数组）。
 *
 * 与契约逐字对齐的三条硬校验：`kind ∈ {skill,plugin}`、`mode ∈ {pinned,latest}`、`required` 是布尔；
 * `versionId` / `resolvedVersionId` 可缺席，一旦出现就必须是雪花 ID。`id` 只按契约的
 * `minLength 1 / maxLength 214` 收口（技能 id 与 npm 包名共用同一形状，按 kind 各写一套正则
 * 就是自己加严）。长度超 200 按既有稳定码整条失败。
 *
 * **刻意不加严**：契约没有"pinned 必带 versionId""latest 不许带 versionId"这类条件约束，
 * 员工端自己补一条就会重演三起契约漂移事故（员工端比服务端严 ⇒ 整条响应判畸形）。
 */
function decodePresetDependencies(value: unknown): readonly EnterpriseRuntimePresetDependency[] {
  if (!Array.isArray(value) || value.length > PRESET_MAX_DEPENDENCIES) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return value.map(item => {
    const row = record(item)
    if (row === undefined
      || !hasExactKeys(row, ENTERPRISE_PRESET_DEPENDENCY_KEYS, ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL_KEYS)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    const kind = row['kind']
    const id = row['id']
    const mode = row['mode']
    const required = row['required']
    const versionId = row['versionId']
    if ((kind !== 'skill' && kind !== 'plugin')
      || !nonEmptyString(id) || id.length > 214
      || (mode !== 'pinned' && mode !== 'latest')
      || typeof required !== 'boolean'
      || (versionId !== undefined && !enterpriseId(versionId))
      || (row['resolvedVersionId'] !== undefined && !enterpriseId(row['resolvedVersionId']))) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return {
      kind,
      id,
      mode,
      // 只有真拿到雪花才产出这个键；latest（服务端下发 null）与旧服务端缺席都不产出，界面据此不渲染钉版本。
      ...(nonEmptyString(versionId) && enterpriseId(versionId) ? { versionId } : {}),
      required,
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
      || !hasExactKeys(row, ENTERPRISE_PRESET_ROW_REQUIRED_KEYS, ENTERPRISE_PRESET_ROW_OPTIONAL_KEYS)
      || !enterpriseId(row['id']) || !nonEmptyString(row['presetId'])
      || !nonEmptyString(row['displayName']) || !nonEmptyString(row['description'])
      || !nonEmptyString(row['sourceDshVersion'])
      || !Number.isSafeInteger(row['sizeBytes']) || Number(row['sizeBytes']) <= 0
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
      // 缺这个键就是旧服务端（切片 B 之前）：不补空数组也不编，如实"没有这个键"——
      // 与 `category`/`whenToUse` 的归一策略一致，"读不到"和"确实为空"必须可区分。
      ...(row['dependencies'] === undefined
        ? {}
        : { dependencies: decodePresetDependencies(row['dependencies']) }),
    }
  })
}

/* ══════════════════════════ 配方一键启用（enable / disable / status） ══════════════════════════
 *
 * 这三条响应的**形状真源**不是中心契约（那是配方目录），而是 Host 侧 `bundle/src/preset-service.ts`
 * 的三个脱敏视图（`EnterprisePresetEnableView` / `EnterprisePresetDisableView` / `EnterprisePresetStatusView`）。
 * 因此键集必须与那三个 interface **逐字同形**：员工端的关闭键集比 Host 严一格，
 * 整条响应就判 `ENT_LOCAL_RESPONSE_INVALID`（本仓已踩三次的同一种病）。
 *
 * 键集常量导出给 `tests/preset-enable-decode.spec.ts` 做**封闭键集断言**。
 */

/** 授权三态（与 Host 侧 `PresetAuthorizationState` 逐字同形）。 */
export const ENTERPRISE_PRESET_AUTHORIZATIONS = ['needs-authorization', 'authorized', 'fingerprint-changed'] as const
export type EnterprisePresetAuthorization = typeof ENTERPRISE_PRESET_AUTHORIZATIONS[number]

/** 官方落地结果给界面的三态（`hot` = 官方 `applied`；官方原值另存 `officialApplication`）。 */
export const ENTERPRISE_PRESET_APPLICATIONS = ['hot', 'restart-required', 'other'] as const
export type EnterprisePresetApplicationKind = typeof ENTERPRISE_PRESET_APPLICATIONS[number]

/** 官方 `ChangeResult.application` 的五个原值（「到底怎么生效的」这一手事实只在这里）。 */
export const ENTERPRISE_PRESET_OFFICIAL_APPLICATIONS = [
  'applied', 'restart-required', 'overridden', 'failed', 'cancelled',
] as const
export type EnterprisePresetOfficialApplication = typeof ENTERPRISE_PRESET_OFFICIAL_APPLICATIONS[number]

/** 披露弹层里「这次会装」的一条（我们合成的最小 bundle）。 */
export interface EnterprisePresetDisclosureBundle {
  readonly name: string
  readonly summary: string
  /** bundle 内容摘要（内容变 = 指纹变 = 必须重新确认）。 */
  readonly digest: string
}

/** 披露弹层里「这份配方会挂载」的一条。 */
export interface EnterprisePresetDisclosureMount {
  readonly name: string
  readonly summary: string
}

/** 披露清单：弹层逐项列给它，`fingerprint` 就是员工确认后回传的那一枚。 */
export interface EnterprisePresetDisclosure {
  readonly fingerprint: string
  readonly bundles: readonly EnterprisePresetDisclosureBundle[]
  readonly mounts: readonly EnterprisePresetDisclosureMount[]
}

/** 一条**已装**配方（Host 侧脱敏投影：只有 `bundleDir` 被拿掉，其余逐字保留）。 */
export interface EnterpriseInstalledPreset {
  /** 归一化声明 id（kebab）；停用用**它**而不是包 id。 */
  readonly declarationId: string
  readonly recipeId: string
  readonly displayName: string
  readonly packageName: string
  readonly fingerprint: string
  readonly version: string
  readonly installedAt: string
  /** 官方原值（`applied` / `restart-required` / …）。 */
  readonly officialApplication: EnterprisePresetOfficialApplication
}

/** `POST <local>/presets/<雪花 id>/enable` 的 200 响应体。 */
export interface EnterprisePresetEnableResult {
  readonly application: EnterprisePresetApplicationKind
  /** 官方原值；Host 只在拿到时才产出这个键。 */
  readonly officialApplication?: EnterprisePresetOfficialApplication
  readonly installedNames: readonly string[]
  readonly needsNewSession: boolean
  readonly declarationId: string
  readonly fingerprint: string
  readonly disclosure: EnterprisePresetDisclosure
  /** 同配方同指纹且 link 仍在：本次没有真的再装一遍。 */
  readonly alreadyInstalled?: boolean
  /** 官方失败的**受控**码（自由文本诊断只进 Host 日志）。 */
  readonly officialError?: { readonly code?: string }
}

/** `POST <local>/presets/<声明 id>/disable` 的 200 响应体。 */
export interface EnterprisePresetDisableResult {
  readonly application: EnterprisePresetApplicationKind
  readonly officialApplication?: EnterprisePresetOfficialApplication
  readonly declarationId: string
  readonly removedNames: readonly string[]
  readonly linkRemoved: boolean
}

/** `GET <local>/presets/<雪花 id>/status` 的 200 响应体（授权弹层的真值来源）。 */
export interface EnterprisePresetStatus {
  readonly presetPackageId: string
  readonly declarationId: string
  readonly fingerprint: string
  readonly authorization: EnterprisePresetAuthorization
  readonly inFlight: boolean
  readonly disclosure: EnterprisePresetDisclosure
  /** 未装即 `null`（**必填位**上的可空值，不是「可缺席」）。 */
  readonly installed: EnterpriseInstalledPreset | null
}

/** enable 响应的键集真源（必填 / 可选）。 */
export const ENTERPRISE_PRESET_ENABLE_REQUIRED_KEYS = [
  'application', 'installedNames', 'needsNewSession', 'declarationId', 'fingerprint', 'disclosure',
] as const
export const ENTERPRISE_PRESET_ENABLE_OPTIONAL_KEYS = [
  'officialApplication', 'alreadyInstalled', 'officialError',
] as const

/** disable 响应的键集真源（必填 / 可选）。 */
export const ENTERPRISE_PRESET_DISABLE_REQUIRED_KEYS = [
  'application', 'declarationId', 'removedNames', 'linkRemoved',
] as const
export const ENTERPRISE_PRESET_DISABLE_OPTIONAL_KEYS = ['officialApplication'] as const

/** status 响应的键集真源（七键全部必填；`installed` 的值可以为 null）。 */
export const ENTERPRISE_PRESET_STATUS_REQUIRED_KEYS = [
  'presetPackageId', 'declarationId', 'fingerprint', 'authorization', 'inFlight', 'disclosure', 'installed',
] as const

/** 已装记录的键集真源（八键全部必填）。 */
export const ENTERPRISE_PRESET_INSTALLED_KEYS = [
  'declarationId', 'recipeId', 'displayName', 'packageName', 'fingerprint', 'version', 'installedAt', 'officialApplication',
] as const

/** 披露清单的键集真源。 */
export const ENTERPRISE_PRESET_DISCLOSURE_KEYS = ['fingerprint', 'bundles', 'mounts'] as const
export const ENTERPRISE_PRESET_DISCLOSURE_BUNDLE_KEYS = ['name', 'summary', 'digest'] as const
export const ENTERPRISE_PRESET_DISCLOSURE_MOUNT_KEYS = ['name', 'summary'] as const
/** `officialError`：Host 侧类型里 `code` 是**可选**的（结构上允许空对象），故放可选位。 */
export const ENTERPRISE_PRESET_OFFICIAL_ERROR_REQUIRED_KEYS = [] as const
export const ENTERPRISE_PRESET_OFFICIAL_ERROR_OPTIONAL_KEYS = ['code'] as const

/** 一枚集合指纹：64 位小写十六进制（与 Host 的 `HEX64_PATTERN` 同形）。 */
const PRESET_FINGERPRINT_SHAPE = /^[0-9a-f]{64}$/
/** 归一化声明 id：小写 kebab（与 Host 的 `DECLARATION_ID_PATTERN` 同形）。 */
const PRESET_DECLARATION_ID_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 官方失败码的受控形状（Host 的 `readOfficialError` 就是这么收窄的）。 */
const PRESET_OFFICIAL_CODE_SHAPE = /^[a-z][a-z0-9-]{0,63}$/
/** npm 包名形状（`installedNames` / `removedNames` / `packageName` 共用）。 */
const PRESET_PACKAGE_NAME_SHAPE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
/** 披露清单的条数上限（列表同族的 200 口径）。 */
const PRESET_MAX_DISCLOSURE_ITEMS = 200
/** 披露条目文本上限（Host 的配方描述上限是 2000，留一点余量）。 */
const PRESET_MAX_DISCLOSURE_TEXT = 2048
/** 名字类字段上限（与协议里 `installedNames` 同族）。 */
const PRESET_MAX_NAME_LENGTH = 214

function presetInvalid(): never {
  throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
}

function presetFingerprint(value: unknown): value is string {
  return typeof value === 'string' && PRESET_FINGERPRINT_SHAPE.test(value)
}

function presetDeclarationId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && PRESET_DECLARATION_ID_SHAPE.test(value)
}

/** 一个包名（非空、有界、形状受控）。 */
function presetPackageName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PRESET_MAX_NAME_LENGTH && PRESET_PACKAGE_NAME_SHAPE.test(value)
}

/** 一组名字（`installedNames` / `removedNames`）：每一项都是包名，条数有界。 */
function decodePresetNames(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > PRESET_MAX_DISCLOSURE_ITEMS) presetInvalid()
  if (!value.every(item => presetPackageName(item))) presetInvalid()
  return value as string[]
}

/** 披露清单里的一段人话（`summary`）：允许空串（Host 侧用 manifest.name 兜底，但空串不是畸形）。 */
function presetSummary(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PRESET_MAX_DISCLOSURE_TEXT
}

/**
 * 逐项校验披露清单。
 *
 * `bundles[].digest` 按 **64 位小写十六进制**收口：Host 的 `presetDisclosure` 只在
 * `presetBundleSetFingerprint` 已经校验过 bundle digest 的前提下产出它，故这里出现别的形状
 * 就是「Host 说了它自己保证不会说的话」——判畸形而不是放行一个假摘要。
 */
function decodePresetDisclosure(value: unknown): EnterprisePresetDisclosure {
  const row = record(value)
  if (row === undefined || !hasExactKeys(row, ENTERPRISE_PRESET_DISCLOSURE_KEYS)
    || !presetFingerprint(row['fingerprint'])) presetInvalid()
  const bundlesValue = row['bundles']
  const mountsValue = row['mounts']
  if (!Array.isArray(bundlesValue) || bundlesValue.length > PRESET_MAX_DISCLOSURE_ITEMS
    || !Array.isArray(mountsValue) || mountsValue.length > PRESET_MAX_DISCLOSURE_ITEMS) presetInvalid()
  const bundles = bundlesValue.map((item) => {
    const bundle = record(item)
    if (bundle === undefined || !hasExactKeys(bundle, ENTERPRISE_PRESET_DISCLOSURE_BUNDLE_KEYS)
      || !presetPackageName(bundle['name'])
      || !presetSummary(bundle['summary'])
      || !presetFingerprint(bundle['digest'])) presetInvalid()
    return {
      name: bundle['name'] as string,
      summary: bundle['summary'] as string,
      digest: bundle['digest'] as string,
    }
  })
  const mounts = mountsValue.map((item) => {
    const mount = record(item)
    if (mount === undefined || !hasExactKeys(mount, ENTERPRISE_PRESET_DISCLOSURE_MOUNT_KEYS)
      || !nonEmptyString(mount['name']) || mount['name'].length > PRESET_MAX_NAME_LENGTH
      || !presetSummary(mount['summary'])) presetInvalid()
    return { name: mount['name'] as string, summary: mount['summary'] as string }
  })
  return { fingerprint: row['fingerprint'] as string, bundles, mounts }
}

/** `application` 三态（Host 的 `PresetApplicationKind`）。 */
function decodePresetApplicationKind(value: unknown): EnterprisePresetApplicationKind {
  if (!(ENTERPRISE_PRESET_APPLICATIONS as readonly unknown[]).includes(value)) presetInvalid()
  return value as EnterprisePresetApplicationKind
}

/** 官方原值（只有拿到时才产出键；形状不认识**不**降级成 `other`——那会把 Host 的畸形说成事实）。 */
function decodePresetOfficialApplication(
  value: unknown,
): EnterprisePresetOfficialApplication | undefined {
  if (value === undefined) return undefined
  if (!(ENTERPRISE_PRESET_OFFICIAL_APPLICATIONS as readonly unknown[]).includes(value)) presetInvalid()
  return value as EnterprisePresetOfficialApplication
}

/** 官方失败的受控码（`{code}` 或空对象）。 */
function decodePresetOfficialError(value: unknown): { readonly code?: string } | undefined {
  if (value === undefined) return undefined
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ENTERPRISE_PRESET_OFFICIAL_ERROR_REQUIRED_KEYS, ENTERPRISE_PRESET_OFFICIAL_ERROR_OPTIONAL_KEYS)) {
    presetInvalid()
  }
  const code = row['code']
  if (code === undefined) return {}
  if (typeof code !== 'string' || !PRESET_OFFICIAL_CODE_SHAPE.test(code)) presetInvalid()
  return { code }
}

/** 一条已装记录（八键必填；`version` 只按非空有界字符串收口，不在这里复刻 semver 判据）。 */
function decodeInstalledPreset(value: unknown): EnterpriseInstalledPreset {
  const row = record(value)
  if (row === undefined || !hasExactKeys(row, ENTERPRISE_PRESET_INSTALLED_KEYS)
    || !presetDeclarationId(row['declarationId'])
    || !presetDeclarationId(row['recipeId'])
    || !nonEmptyString(row['displayName']) || row['displayName'].length > 120
    || !presetPackageName(row['packageName'])
    || !presetFingerprint(row['fingerprint'])
    || !nonEmptyString(row['version']) || row['version'].length > 64
    || !timestamp(row['installedAt'])
    || !(ENTERPRISE_PRESET_OFFICIAL_APPLICATIONS as readonly unknown[]).includes(row['officialApplication'])) {
    presetInvalid()
  }
  return {
    declarationId: row['declarationId'] as string,
    recipeId: row['recipeId'] as string,
    displayName: row['displayName'] as string,
    packageName: row['packageName'] as string,
    fingerprint: row['fingerprint'] as string,
    version: row['version'] as string,
    installedAt: row['installedAt'] as string,
    officialApplication: row['officialApplication'] as EnterprisePresetOfficialApplication,
  }
}

/**
 * 严格解码 **一键启用** 的 200 响应。
 *
 * 必填位是 Host 侧 `EnterprisePresetEnableView` 的必填六键；`officialApplication` / `alreadyInstalled` /
 * `officialError` 在 Host 侧就是可选（缺席即**不产出那个键**，而不是补一个假值）。
 */
export function decodeEnterprisePresetEnable(value: unknown): EnterprisePresetEnableResult {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ENTERPRISE_PRESET_ENABLE_REQUIRED_KEYS, ENTERPRISE_PRESET_ENABLE_OPTIONAL_KEYS)
    || !presetDeclarationId(row['declarationId'])
    || !presetFingerprint(row['fingerprint'])
    || typeof row['needsNewSession'] !== 'boolean'
    || (row['alreadyInstalled'] !== undefined && typeof row['alreadyInstalled'] !== 'boolean')) {
    presetInvalid()
  }
  const application = decodePresetApplicationKind(row['application'])
  const officialApplication = decodePresetOfficialApplication(row['officialApplication'])
  const officialError = decodePresetOfficialError(row['officialError'])
  return {
    application,
    ...(officialApplication === undefined ? {} : { officialApplication }),
    installedNames: decodePresetNames(row['installedNames']),
    needsNewSession: row['needsNewSession'] as boolean,
    declarationId: row['declarationId'] as string,
    fingerprint: row['fingerprint'] as string,
    disclosure: decodePresetDisclosure(row['disclosure']),
    ...(row['alreadyInstalled'] === undefined ? {} : { alreadyInstalled: row['alreadyInstalled'] as boolean }),
    ...(officialError === undefined ? {} : { officialError }),
  }
}

/** 严格解码 **停用** 的 200 响应（必填四键 + 可选 `officialApplication`）。 */
export function decodeEnterprisePresetDisable(value: unknown): EnterprisePresetDisableResult {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ENTERPRISE_PRESET_DISABLE_REQUIRED_KEYS, ENTERPRISE_PRESET_DISABLE_OPTIONAL_KEYS)
    || !presetDeclarationId(row['declarationId'])
    || typeof row['linkRemoved'] !== 'boolean') {
    presetInvalid()
  }
  const application = decodePresetApplicationKind(row['application'])
  const officialApplication = decodePresetOfficialApplication(row['officialApplication'])
  return {
    application,
    ...(officialApplication === undefined ? {} : { officialApplication }),
    declarationId: row['declarationId'] as string,
    removedNames: decodePresetNames(row['removedNames']),
    linkRemoved: row['linkRemoved'] as boolean,
  }
}

/**
 * 严格解码 **启用前真值**（`status`）：授权三态 + 进行中 + 披露清单 + 已装记录。
 *
 * `installed` 是**必填位上的可空值**（`null` = 本机没装）——这与 `dependencies` 那种
 * 「可选 = 键可以缺席」是两件事：主机一定回这个键，只是值可以是 null。
 */
export function decodeEnterprisePresetStatus(value: unknown): EnterprisePresetStatus {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ENTERPRISE_PRESET_STATUS_REQUIRED_KEYS)
    || !enterpriseId(row['presetPackageId'])
    || !presetDeclarationId(row['declarationId'])
    || !presetFingerprint(row['fingerprint'])
    || !(ENTERPRISE_PRESET_AUTHORIZATIONS as readonly unknown[]).includes(row['authorization'])
    || typeof row['inFlight'] !== 'boolean') {
    presetInvalid()
  }
  const installed = row['installed']
  return {
    presetPackageId: row['presetPackageId'] as string,
    declarationId: row['declarationId'] as string,
    fingerprint: row['fingerprint'] as string,
    authorization: row['authorization'] as EnterprisePresetAuthorization,
    inFlight: row['inFlight'] as boolean,
    disclosure: decodePresetDisclosure(row['disclosure']),
    installed: installed === null ? null : decodeInstalledPreset(installed),
  }
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
