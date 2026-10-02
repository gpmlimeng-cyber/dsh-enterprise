/**
 * [INPUT]: 依赖浏览器 fetch 与 FormData/Blob、local-api-decode 的全部严格解码与失败码投影
 * [OUTPUT]: 对外提供 `createEnterpriseLocalApi`（固定同源路径的取数与动作，含请 Host 打开帮助中心的 `openHelp`）、两条同源路径常量（`ENTERPRISE_FEEDBACK_LOCAL_PATH`/`ENTERPRISE_HELP_OPEN_LOCAL_PATH`）与 local-api-decode 的全部导出
 * [POS]: dsh-ui 的浏览器网络边界——只发同源固定路径请求，调用方无法注入平台 origin 或 Authorization；DTO 契约与解码在 local-api-decode.ts，本文件只管发与收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  EnterpriseLocalApiError,
  decodeBootstrap,
  decodeEnterpriseAccountOrigin,
  decodeEnterpriseAccountOriginUpdate,
  decodeEnterpriseBranding,
  decodeEnterpriseFeedbackReceipt,
  decodeEnterpriseDataEnvelope,
  decodeEnterpriseCredentialResult,
  decodeEnterpriseErrorCode,
  decodeEnterpriseInstalledSkills,
  decodeEnterpriseLocalStatus,
  decodeEnterpriseLoginCancel,
  decodeEnterpriseLoginForm,
  decodeEnterpriseLoginStart,
  decodeEnterpriseLogout,
  decodeEnterprisePluginStatus,
  decodeEnterprisePresets,
  decodeEnterpriseRestoredSession,
  decodeEnterpriseServerUrl,
  decodeEnterpriseSkillDetail,
  decodeEnterpriseSkills,
  decodeEnterpriseUninstall,
  decodeEnterpriseUsage,
  decodeRemoteSessions,
  decodeSessionSyncStatus,
  type EnterpriseFeedbackDraft,
  type EnterpriseLocalApi,
} from './local-api-decode.js'
import type { EnterpriseBrandingDocument } from './branding.js'

export * from './local-api-decode.js'
export type { EnterpriseBrandingDocument }

const LOCAL_API_PREFIX = '/enterprise/api/v1/local'

function errorCode(value: unknown): string {
  const code = decodeEnterpriseErrorCode(value)
  return code ?? 'ENT_PLATFORM_UNAVAILABLE'
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
  const envelope = decodeEnterpriseDataEnvelope(payload)
  if (envelope === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  return envelope
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

/**
 * 无正文回执的同源 POST：只认「2xx 即成」，错误码仍走 `decodeEnterpriseErrorCode` 的受控投影。
 *
 * 「帮助与文档」用它请 Host 打开系统浏览器——地址由 Host 派生，浏览器既不给 URL 也不读正文，
 * 因此不引入任何新 DTO，也不把响应体回显到界面。
 */
async function postNoContent(
  path: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<void> {
  const response = await fetcher(`${LOCAL_API_PREFIX}${path}`, postInit(signal))
  if (response.ok) return
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  }
  throw new EnterpriseLocalApiError(errorCode(payload), response.status)
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

/**
 * 反馈草稿 → multipart 正文。
 *
 * 三处刻意的省略：不写 `diagnostics`（Host 采集）、`occurredAt` 只在问题态出现（建议态提交它会与
 * 产品口径矛盾）、空联系人不产生空 part。`content-type` 交给浏览器，boundary 由它生成。
 */
function feedbackForm(draft: EnterpriseFeedbackDraft): FormData {
  const form = new FormData()
  const occurredAt = draft.type === 'issue' ? draft.occurredAt : undefined
  const contact = draft.contact === undefined || draft.contact === '' ? undefined : draft.contact
  form.append('metadata', new Blob([JSON.stringify({
    consent: draft.consent,
    description: draft.description,
    type: draft.type,
    ...(occurredAt === undefined || occurredAt === '' ? {} : { occurredAt }),
    ...(contact === undefined ? {} : { contact }),
  })], { type: 'application/json' }))
  for (const attachment of draft.attachments) form.append('attachments', attachment, attachment.name)
  return form
}

/** 创建只访问同源固定路径的浏览器 API；调用方无法注入平台 origin 或 Authorization。 */
export function createEnterpriseLocalApi(
  fetcher: typeof fetch = fetch,

): EnterpriseLocalApi {
  return {
    status: async signal => decodeEnterpriseLocalStatus(await requestJson('/status', getInit(signal), fetcher)),
    branding: async signal => decodeEnterpriseBranding(await requestJson('/branding', getInit(signal), fetcher)),
    refresh: async signal => decodeEnterpriseLocalStatus(await requestJson('/refresh', jsonInit('POST', {}, signal), fetcher)),
    setServerUrl: async (serverUrl, signal) => decodeEnterpriseServerUrl(
      await requestJson('/server', jsonInit('POST', { serverUrl }, signal), fetcher),
    ),
    accountOrigin: async signal => decodeEnterpriseAccountOrigin(
      await requestJson('/account-origin', getInit(signal), fetcher),
    ),
    setAccountOrigin: async (origin, signal) => decodeEnterpriseAccountOriginUpdate(
      await requestJson('/account-origin', jsonInit('POST', {
        ...(origin.platformOrigin === undefined ? {} : { platformOrigin: origin.platformOrigin }),
        ...(origin.inferenceOrigin === undefined ? {} : { inferenceOrigin: origin.inferenceOrigin }),
      }, signal), fetcher),
    ),
    bootstrap: async signal => decodeBootstrap(await requestJson('/bootstrap', getInit(signal), fetcher)),
    usage: async signal => decodeEnterpriseUsage(await requestJson('/usage', getInit(signal), fetcher)),
    openHelp: async signal => postNoContent('/help/open', signal, fetcher),
    submitFeedback: async (draft, signal, idempotencyKey) => decodeEnterpriseFeedbackReceipt(
      await requestJson('/feedback', {
        body: feedbackForm(draft),
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
        },
        method: 'POST',
        signal,
      }, fetcher),
    ),
    plugins: async signal => decodeEnterprisePluginStatus(await requestJson('/plugins', getInit(signal), fetcher)),
    presets: async signal => decodeEnterprisePresets(await requestJson('/presets', getInit(signal), fetcher)),
    presetDetail: async (packageId, signal) => {
      const items = decodeEnterprisePresets([await requestJson(`/presets/${packageId}`, getInit(signal), fetcher)])
      return items[0]!
    },
    skills: async signal => decodeEnterpriseSkills(await requestJson('/skills', getInit(signal), fetcher)),
    skillDetail: async (packageId, signal) => decodeEnterpriseSkillDetail(
      await requestJson(`/skills/${packageId}`, getInit(signal), fetcher),
    ),
    installPlugin: async (packageName, pluginVersionId, signal) => decodeEnterprisePluginStatus(
      await requestJson('/plugins/install', jsonInit('POST', { packageName, pluginVersionId }, signal), fetcher),
    ),
    removePlugin: async (packageName, signal) => decodeEnterprisePluginStatus(
      await requestJson('/plugins/remove', jsonInit('POST', { packageName }, signal), fetcher),
    ),
    installedSkills: async signal => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/installed', getInit(signal), fetcher),
    ),
    installSkill: async (packageId, signal) => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/install', jsonInit('POST', { packageId }, signal), fetcher),
    ),
    uninstallSkill: async (packageId, signal) => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/uninstall', jsonInit('POST', { packageId }, signal), fetcher),
    ),
    startLogin: async signal => decodeEnterpriseLoginStart(
      await requestJson('/auth/start', postInit(signal), fetcher),
    ),
    cancelLogin: async signal => decodeEnterpriseLoginCancel(
      await requestJson('/auth/cancel', postInit(signal), fetcher),
    ),
    loginForm: async signal => decodeEnterpriseLoginForm(
      await requestJson('/auth/form', getInit(signal), fetcher),
    ),
    submitCredentials: async (input, signal) => decodeEnterpriseCredentialResult(
      await requestJson('/auth/password', jsonInit('POST', input, signal), fetcher),
    ),
    submitPasswordChange: async (input, signal) => decodeEnterpriseCredentialResult(
      await requestJson('/auth/password-change', jsonInit('POST', input, signal), fetcher),
    ),
    logout: async signal => decodeEnterpriseLogout(
      await requestJson('/logout', postInit(signal), fetcher),
    ),
    uninstall: async signal => decodeEnterpriseUninstall(
      await requestJson('/uninstall', postInit(signal), fetcher),
    ),
    sessionSyncStatus: async signal => decodeSessionSyncStatus(
      await requestJson('/sessions/sync', getInit(signal), fetcher),
    ),
    listSessions: async signal => decodeRemoteSessions(
      await requestJson('/sessions', getInit(signal), fetcher),
    ),
    restoreSession: async (sourceSessionId, cwd, signal) => decodeEnterpriseRestoredSession(
      await requestJson(
        `/sessions/${encodeURIComponent(sourceSessionId)}/copies`,
        jsonInit('POST', { cwd }, signal),
        fetcher,
      ),
    ),
  }
}

/** 保持在同源路径上的反馈提交路径常量；测试与文档用它核对 Host 的注册路径。 */
export const ENTERPRISE_FEEDBACK_LOCAL_PATH = `${LOCAL_API_PREFIX}/feedback`

/** 「帮助与文档」的同源路径常量：Host 侧同源路由的注册路径必须与它逐字相同。 */
export const ENTERPRISE_HELP_OPEN_LOCAL_PATH = `${LOCAL_API_PREFIX}/help/open`

/**
 * 企业技能一键安装的三条同源路径常量；Host 侧（platform-client 的 exact 路由）注册路径必须与它们逐字相同。
 *
 * 三条都是 `/skills` prefix 的**子路径**，靠引擎 exact 表优先命中；界面只发这三条，不发任何宿主路径。
 */
export const ENTERPRISE_SKILL_INSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/install`
export const ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/uninstall`
export const ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/installed`
