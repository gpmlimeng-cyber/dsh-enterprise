/**
 * [INPUT]: 依赖 protocol/error-codes 的码集合与 protocol/types 的连接状态联合
 * [OUTPUT]: 对外提供错误码→中文人话映射、连接状态文案、配额窗口/市场动作文案与数字格式化
 * [POS]: 客户端半唯一的文案真源；任何错误码都不得在 panel 内直接拼接展示，必须经 describeEnterpriseError
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseClientErrorCode } from '../protocol/error-codes.js'
import type { EnterpriseConnectionState } from '../protocol/types.js'

/**
 * 契约 56 个稳定码 + 10 个客户端本地码的完整中文文案。
 * 用穷尽 Record 而不是 Partial：契约新增错误码时编译期即失败，逼迫在此补齐人话。
 */
export const ENTERPRISE_ERROR_MESSAGES: Readonly<Record<EnterpriseClientErrorCode, string>> = {
  // ── 请求与授权参数 ────────────────────────────────────────────
  ENT_INVALID_REQUEST: '请求参数不合法，请重试或联系管理员',
  ENT_INVALID_REDIRECT_URI: '登录回调地址不被信任，请更新客户端后重试',
  ENT_PKCE_REQUIRED: '登录请求缺少安全校验参数，请重新登录',
  ENT_PKCE_INVALID: '登录安全校验失败，请重新登录',
  ENT_AUTH_REQUIRED: '登录状态已失效，请重新登录',
  ENT_AUTH_CODE_INVALID: '登录凭据无效或已过期，请重新登录',
  ENT_AUTH_SESSION_EXPIRED: '登录会话已超时，请重新登录',
  ENT_SKILL_INVALID_PACKAGE: '技能包内容不合规，已阻止装配',
  ENT_BRANDING_ASSET_INVALID: '品牌图片不符合要求，已拒绝',
  ENT_FEEDBACK_INVALID: '反馈内容不合规，请修改后重试',
  ENT_FEEDBACK_ATTACHMENT_INVALID: '反馈附件格式或大小不合规，已拒绝',

  // ── 权限与设备 ────────────────────────────────────────────────
  ENT_PERMISSION_DENIED: '当前账号没有执行该操作的权限',
  ENT_DEVICE_REVOKED: '本设备已被管理员撤销授权，请联系管理员重新分配',
  ENT_DEVICE_ALREADY_BOUND: '该设备已绑定到其他账号，请联系管理员处理',
  ENT_IDENTITY_ALREADY_LINKED: '该身份已绑定其它账号，无法重复绑定',
  ENT_LAST_ENTERPRISE_ADMIN: '这是最后一名企业管理员，不能移除其权限',
  ENT_LAST_MEMBER_IDENTITY: '这是成员的最后一种登录方式，不能解绑',
  ENT_RESOURCE_NOT_OWNED: '该资源不属于当前账号，无法操作',

  // ── 资源与版本 ────────────────────────────────────────────────
  ENT_RESOURCE_NOT_FOUND: '未找到对应资源，请刷新后重试',
  ENT_MODEL_NOT_ASSIGNED: '当前账号未被分配该模型',
  ENT_PLUGIN_NOT_ASSIGNED: '该插件未分配给当前账号',
  ENT_PLUGIN_ARTIFACT_INVALID: '插件包内容不合规，已阻止安装',
  ENT_REVISION_CONFLICT: '配置已被其他设备更新，请刷新后重试',
  ENT_REQUEST_IN_PROGRESS: '上一次请求仍在处理中，请稍候',
  ENT_REQUEST_ALREADY_COMPLETED: '该请求已经完成，无需重复提交',

  // ── 体积上限 ──────────────────────────────────────────────────
  ENT_REQUEST_TOO_LARGE: '请求内容过大，已拒绝',
  ENT_PLUGIN_ARCHIVE_TOO_LARGE: '插件包超过企业允许的大小上限',
  ENT_PRESET_TOO_LARGE: '企业配方超过允许的大小上限',
  ENT_SKILL_TOO_LARGE: '企业技能包超过允许的大小上限',
  ENT_BRANDING_ASSET_TOO_LARGE: '品牌图片超过允许的大小上限',
  ENT_FEEDBACK_ATTACHMENT_TOO_LARGE: '反馈附件超过允许的大小上限',
  ENT_SESSION_BATCH_TOO_LARGE: '会话数据单批超过上限，正在自动分批重试',

  // ── 配额与上游 ────────────────────────────────────────────────
  ENT_QUOTA_FIVE_HOURS_EXCEEDED: '五小时用量额度已用尽，请稍后再试',
  ENT_QUOTA_DAILY_EXCEEDED: '今日用量额度已用尽，请明天再试',
  ENT_QUOTA_WEEKLY_EXCEEDED: '本周用量额度已用尽，请下周再试',
  ENT_QUOTA_MONTHLY_EXCEEDED: '本月用量额度已用尽，请联系管理员调整配额',
  ENT_QUOTA_RPM_EXCEEDED: '请求过于频繁，请稍后再试',
  ENT_QUOTA_CONCURRENCY_EXCEEDED: '并发请求数已达上限，请等待当前任务结束',
  ENT_UPSTREAM_RATE_LIMITED: '上游模型服务暂时限流，请稍后重试',
  ENT_UPSTREAM_QUOTA_EXCEEDED: '上游模型服务额度已用尽，请联系管理员',
  ENT_UPSTREAM_AUTH_FAILED: '上游模型服务鉴权失败，请联系管理员检查密钥',
  ENT_UPSTREAM_INVALID_RESPONSE: '上游模型服务返回异常内容，请重试',
  ENT_UPSTREAM_UNAVAILABLE: '上游模型服务暂时不可用，请稍后重试',
  ENT_UPSTREAM_TIMEOUT: '上游模型服务响应超时，请重试',
  ENT_PLATFORM_UNAVAILABLE: '企业中心暂时不可用，请稍后重试',
  ENT_PLATFORM_DISPOSED: '企业连接已关闭，请重启客户端后重试',

  // ── 企业配方 ──────────────────────────────────────────────────
  ENT_PRESET_INVALID_PACKAGE: '配方包内容不合规，已阻止导入',
  ENT_PRESET_NOT_PUBLISHED: '该配方已下架，无法导入',
  ENT_PRESET_VISIBILITY_DENIED: '当前账号无权使用该配方',

  // ── 企业技能目录 ──────────────────────────────────────────────
  ENT_SKILL_NOT_PUBLISHED: '该技能已下架，无法装配',
  ENT_SKILL_VISIBILITY_DENIED: '当前账号无权使用该技能',

  // ── 问题反馈 ──────────────────────────────────────────────────
  ENT_FEEDBACK_STATE_CONFLICT: '该反馈状态已被其他设备更新，请刷新后重试',

  // ── 会话同步 ──────────────────────────────────────────────────
  ENT_SESSION_FORMAT_UNSUPPORTED: '本机会话格式不受企业中心支持，请升级客户端',
  ENT_SESSION_CONTENT_EXPIRED: '会话正文已超过保留期，无法恢复',
  ENT_SESSION_SEQ_GAP: '会话数据存在缺号，已暂停同步并等待补传',
  ENT_SESSION_DIVERGED: '会话数据与云端不一致，已停止同步以避免覆盖',
  ENT_SESSION_SOURCE_DEVICE_CONFLICT: '同一会话被多台设备同时写入，请在其中一台继续',

  // ── 客户端本地码 ──────────────────────────────────────────────
  ENT_AUTH_CANCELLED: '登录已取消',
  ENT_AUTH_TIMEOUT: '等待浏览器授权超时，请重新登录',
  ENT_NETWORK_ERROR: '无法连接企业服务，请检查网络与服务地址',
  ENT_RESPONSE_INVALID: '企业服务返回的响应无法识别，请升级客户端后重试',
  ENT_SERVER_URL_INVALID: '服务地址格式不正确，请填写形如 https://主机:端口 的地址',
  ENT_ARTIFACT_INTEGRITY_FAILED: '插件包完整性校验失败，已阻止安装',
  ENT_ARTIFACT_UNSIGNED: '插件包缺少有效签名，按当前安全策略已阻止安装',
  ENT_ARTIFACT_CORE_PACKAGE: '核心插件受保护，不能安装或卸载',
  ENT_PLUGIN_COMMAND_FAILED: '调用宿主插件命令失败，请在插件管理中手动重试',
}

/** 未覆盖码（例如更高版本服务端新增）的统一兜底；绝不回显服务端原文。 */
export const ENTERPRISE_UNKNOWN_ERROR_MESSAGE = '操作失败，请稍后重试或联系管理员'

/**
 * 错误码 → 中文人话。未知码/空值一律走兜底，因此服务端返回的任意字符串都不会被渲染出来。
 */
export function describeEnterpriseError(code?: string | null): string {
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(ENTERPRISE_ERROR_MESSAGES, code)) {
    return ENTERPRISE_ERROR_MESSAGES[code as EnterpriseClientErrorCode]
  }
  return ENTERPRISE_UNKNOWN_ERROR_MESSAGE
}

/** 连接状态 → 中文短标签。 */
export function describeEnterpriseState(state: EnterpriseConnectionState | string | null | undefined): string {
  switch (state) {
    case 'UNCONFIGURED':
      return '未配置服务地址'
    case 'SIGNED_OUT':
      return '未登录'
    case 'AUTHORIZING':
      return '等待浏览器授权'
    case 'ENROLLING':
      return '正在注册设备'
    case 'BOOTSTRAPPING':
      return '正在拉取企业配置'
    case 'READY':
      return '已连接'
    case 'REFRESHING':
      return '正在刷新登录'
    case 'AUTH_EXPIRED':
      return '登录已过期'
    case 'DEVICE_REVOKED':
      return '设备已被撤销'
    case 'CANCELLED':
      return '登录已取消'
    case 'FAILED':
      return '连接失败'
    default:
      return '状态未知'
  }
}

/** 连接状态 → 状态点语义（与 ui-primitives 的 StateDot 取值一致）。 */
export type EnterpriseStateTone = 'done' | 'warning' | 'ongoing' | 'error' | 'idle'

/** 连接状态 → 状态点颜色语义。 */
export function describeEnterpriseStateTone(
  state: EnterpriseConnectionState | string | null | undefined,
): EnterpriseStateTone {
  switch (state) {
    case 'READY':
      return 'done'
    case 'AUTHORIZING':
    case 'ENROLLING':
    case 'BOOTSTRAPPING':
    case 'REFRESHING':
      return 'ongoing'
    case 'AUTH_EXPIRED':
    case 'DEVICE_REVOKED':
    case 'CANCELLED':
      return 'warning'
    case 'FAILED':
      return 'error'
    default:
      return 'idle'
  }
}

/** 需要继续轮询的过渡态：只在登录/刷新进行中查询，闲置时绝不轮询。 */
export function isTransientEnterpriseState(state: EnterpriseConnectionState | string | null | undefined): boolean {
  return (
    state === 'AUTHORIZING' || state === 'ENROLLING' || state === 'BOOTSTRAPPING' || state === 'REFRESHING'
  )
}

const QUOTA_WINDOW_LABELS: Readonly<Record<string, string>> = {
  fiveHours: '五小时',
  daily: '今日',
  weekly: '本周',
  monthly: '本月',
}

/** 配额窗口中文标签；服务端 label 缺失或为空时兜底。 */
export function describeQuotaWindow(key: string, label?: string | null): string {
  if (typeof label === 'string' && label.trim().length > 0) return label
  return QUOTA_WINDOW_LABELS[key] ?? key
}

/** 市场动作 → 中文按钮文案。 */
export function describeMarketAction(action: string | null | undefined): string {
  switch (action) {
    case 'INSTALL':
      return '安装'
    case 'UPGRADE':
      return '升级'
    case 'UNINSTALL':
      return '卸载'
    case 'NONE':
      return '无需操作'
    default:
      return '未知动作'
  }
}

/** 令牌数量 → 紧凑中文计数（万/亿），避免长串数字撑破面板。 */
export function formatTokenCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—'
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)} 亿`
  if (value >= 10_000) return `${(value / 10_000).toFixed(2)} 万`
  return value.toLocaleString('zh-CN')
}

/** ISO8601 → 本地时间短文案；无法解析时原样给出 `—`，绝不抛异常。 */
export function formatResetTime(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.length === 0) return '—'
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '—'
  try {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return '—'
  }
}
