/**
 * [INPUT]: 依赖 protocol/http 的 EnterpriseHttpClient（唯一 HTTP 出口）与 protocol/types 的认证/令牌窄类型
 * [OUTPUT]: 对外提供 EnterpriseAuthClient：authorize 事务、sources、password(表单)、token(JSON 两 grant)、logout
 * [POS]: platform 层的纯协议客户端；不做状态机、不落盘、不读取令牌，409 首登改密按正常结果返回而不是错误
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterprisePlatformError } from '../protocol/envelope.js'
import type { EnterpriseHttpClient } from '../protocol/http.js'
import type {
  EnterpriseAuthSource,
  EnterpriseAuthSourcesData,
  EnterpriseClientId,
  EnterprisePasswordLoginRequest,
  EnterprisePasswordStepData,
  EnterpriseTokenData,
  EnterpriseTokenRequest,
} from '../protocol/types.js'

const AUTH_PATH = '/enterprise/auth/v1'
const AUTH_SOURCE_TYPES: readonly EnterpriseAuthSource['type'][] = ['OIDC', 'LDAP', 'LOCAL']
const CLIENT_IDS: readonly EnterpriseClientId[] = ['dsh-desktop', 'enterprise-admin', 'ent-admin-cli']
const OPAQUE = /^[A-Za-z0-9_-]{32,64}$/
const NUMERIC_ID = /^[1-9][0-9]{0,18}$/
const REFRESH_TOKEN = /^dshr_[A-Za-z0-9_-]{43}$/
const ACCESS_TOKEN = /^\S{16,512}$/
/** 桌面客户端在契约里的固定 PlatformClient 值。 */
export const ENTERPRISE_DESKTOP_CLIENT_ID: EnterpriseClientId = 'dsh-desktop'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asOpaque(value: unknown): string | null {
  return typeof value === 'string' && OPAQUE.test(value) ? value : null
}

function asNumericId(value: unknown): string | null {
  return typeof value === 'string' && NUMERIC_ID.test(value) ? value : null
}

function asText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

function invalid(message: string): EnterprisePlatformError {
  return new EnterprisePlatformError('ENT_RESPONSE_INVALID', message)
}

/** 运行时守卫：中心主体是外部输入，编译期类型不足以信任。 */
function toAuthSources(payload: unknown): EnterpriseAuthSourcesData {
  if (!isRecord(payload)) throw invalid('企业登录事务响应不是对象')
  const transactionId = asOpaque(payload['transactionId'])
  const csrfToken = asOpaque(payload['csrfToken'])
  const rawSources = payload['sources']
  if (transactionId === null || csrfToken === null || !Array.isArray(rawSources)) {
    throw invalid('企业登录事务响应缺少 transactionId/csrfToken/sources')
  }
  const sources: EnterpriseAuthSource[] = []
  for (const item of rawSources) {
    if (!isRecord(item)) throw invalid('企业登录身份源条目不是对象')
    const id = asNumericId(item['id'])
    const name = asText(item['name'], 120)
    const type = item['type']
    if (id === null || name === null || !AUTH_SOURCE_TYPES.includes(type as EnterpriseAuthSource['type'])) {
      throw invalid('企业登录身份源条目字段不合法')
    }
    sources.push({ id, name, type: type as EnterpriseAuthSource['type'] })
  }
  return { transactionId, csrfToken, sources }
}

/** 运行时守卫：令牌主体永远不进日志，字段非法即拒绝，避免脏令牌写进凭据文件。 */
function toTokenData(payload: unknown): EnterpriseTokenData {
  if (!isRecord(payload)) throw invalid('企业令牌响应不是对象')
  const accessToken = payload['accessToken']
  const refreshToken = payload['refreshToken']
  const expiresIn = payload['expiresIn']
  const refreshExpiresIn = payload['refreshExpiresIn']
  const clientId = payload['clientId']
  if (payload['tokenType'] !== 'Bearer'
    || typeof accessToken !== 'string' || !ACCESS_TOKEN.test(accessToken)
    || typeof refreshToken !== 'string' || !REFRESH_TOKEN.test(refreshToken)
    || typeof expiresIn !== 'number' || !Number.isSafeInteger(expiresIn) || expiresIn <= 0
    || typeof refreshExpiresIn !== 'number' || !Number.isSafeInteger(refreshExpiresIn) || refreshExpiresIn <= 0
    || !CLIENT_IDS.includes(clientId as EnterpriseClientId)) {
    throw invalid('企业令牌响应字段不合法')
  }
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    clientId: clientId as EnterpriseClientId,
    refreshToken,
    refreshExpiresIn,
  }
}

function encodeTokenRequest(request: EnterpriseTokenRequest): string {
  if (request.grantType === 'authorization_code') {
    return JSON.stringify({
      grantType: 'authorization_code',
      code: request.code,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      codeVerifier: request.codeVerifier,
      installationId: request.installationId,
    })
  }
  return JSON.stringify({
    grantType: 'refresh_token',
    refreshToken: request.refreshToken,
    clientId: request.clientId,
    installationId: request.installationId,
  })
}

/** 契约 PasswordStepData → 冻结的客户端步骤视图（只保留调用方需要的字段）。 */
function toPasswordStep(payload: unknown, transactionId: string): EnterprisePasswordStepData {
  const data = isRecord(payload) ? payload : {}
  const redirectUri = data['redirectUri']
  const challenge = data['passwordChangeChallenge']
  return {
    transactionId,
    ...(typeof redirectUri === 'string' && redirectUri.length > 0 ? { redirectTo: redirectUri } : {}),
    ...(typeof challenge === 'string' && challenge.length > 0 ? { passwordChangeChallenge: challenge } : {}),
  }
}

function encodeForm(request: EnterprisePasswordLoginRequest): string {
  const form = new URLSearchParams()
  form.set('transactionId', request.transactionId)
  form.set('sourceId', request.sourceId)
  form.set('csrfToken', request.csrfToken)
  form.set('username', request.username)
  form.set('password', request.password)
  if (request.captchaId !== undefined) form.set('captchaId', request.captchaId)
  if (request.captchaCode !== undefined) form.set('captchaCode', request.captchaCode)
  return form.toString()
}

/**
 * 企业公开认证端点客户端。
 *
 * 端点（契约 paths/auth.yaml）：
 * `GET /enterprise/auth/v1/authorize`、`GET /enterprise/auth/v1/sources`、
 * `POST /enterprise/auth/v1/password`（form-urlencoded）、`POST /enterprise/auth/v1/token`（JSON）、
 * `POST /enterprise/auth/v1/logout`。
 */
export class EnterpriseAuthClient {
  constructor(private readonly http: EnterpriseHttpClient) {}

  /** 创建五分钟登录事务并取回公开身份源（client_id 固定 dsh-desktop）。 */
  async createTransaction(params: {
    redirectUri: string
    state: string
    codeChallenge: string
    installationId: string
  }): Promise<EnterpriseAuthSourcesData> {
    const query = new URLSearchParams({
      client_id: ENTERPRISE_DESKTOP_CLIENT_ID,
      redirect_uri: params.redirectUri,
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
      installation_id: params.installationId,
    })
    const payload = await this.http.request<unknown>(`${AUTH_PATH}/authorize?${query.toString()}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
    return toAuthSources(payload)
  }

  /** 在既有事务内查询公开身份源（浏览器侧选源后的页面客户端路径）。 */
  async listSources(transactionId: string): Promise<EnterpriseAuthSourcesData> {
    const query = new URLSearchParams({ transaction_id: transactionId })
    const payload = await this.http.request<unknown>(`${AUTH_PATH}/sources?${query.toString()}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
    return toAuthSources(payload)
  }

  /**
   * LOCAL 口令登录；契约 409 表示「首登必须改密」，属于**正常结果**而不是失败。
   *
   * 说明：EnterpriseHttpClient 是冻结实现，会把所有非 2xx 折叠为 EnterprisePlatformError，
   * 因此 409 只能靠捕获错误识别；被折叠层丢弃的 passwordChangeChallenge 也无法取回，
   * 且冻结的 EnterprisePasswordLoginRequest 没有提交新口令的字段，故此处只表达「需要改密」。
   */
  async passwordLogin(request: EnterprisePasswordLoginRequest): Promise<EnterprisePasswordStepData> {
    try {
      const payload = await this.http.request<unknown>(`${AUTH_PATH}/password`, {
        method: 'POST',
        body: encodeForm(request),
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      })
      return toPasswordStep(payload, request.transactionId)
    } catch (error) {
      if (error instanceof EnterprisePlatformError && error.httpStatus === 409) {
        return { transactionId: request.transactionId }
      }
      throw error
    }
  }

  /** 消费一次性授权码或轮换 installation 绑定的 refresh token。 */
  async exchangeToken(request: EnterpriseTokenRequest): Promise<EnterpriseTokenData> {
    const payload = await this.http.request<unknown>(`${AUTH_PATH}/token`, {
      method: 'POST',
      body: encodeTokenRequest(request),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
    })
    return toTokenData(payload)
  }

  /** 注销当前平台令牌；中心不可达由编排层决定是否仍然完成本地登出。 */
  async logout(): Promise<void> {
    await this.http.request<unknown>(`${AUTH_PATH}/logout`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    })
  }
}
