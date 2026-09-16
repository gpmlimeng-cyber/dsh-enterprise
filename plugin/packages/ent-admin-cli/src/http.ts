/**
 * [INPUT]: 依赖 @owndsh/contracts 错误解码与 fetch
 * [OUTPUT]: 对外提供 EntAdminHttpError、createAuthedFetch、requestJson
 * [POS]: ent-admin-cli 的 HTTP 边界；只暴露稳定 error code/retryable/requestId
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { decodeEnterpriseError, type EnterpriseError, type EnterpriseErrorCode } from '@owndsh/contracts'

export class EntAdminHttpError extends Error {
  constructor(
    readonly code: EnterpriseErrorCode | 'ENT_PLATFORM_UNAVAILABLE' | 'ENT_INVALID_REQUEST',
    readonly retryable: boolean,
    readonly status: number,
    readonly requestId: string | null,
  ) {
    super(code)
    this.name = 'EntAdminHttpError'
  }

  toJSON(): { code: string; retryable: boolean; status: number; requestId: string | null } {
    return {
      code: this.code,
      retryable: this.retryable,
      status: this.status,
      requestId: this.requestId,
    }
  }
}

export type AccessTokenProvider = () => Promise<string | undefined>

async function parseErrorEnvelope(response: Response): Promise<EnterpriseError | undefined> {
  const text = await response.text()
  if (text.length === 0) return undefined
  try {
    return decodeEnterpriseError(JSON.parse(text))
  } catch {
    return undefined
  }
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST'
    query?: Record<string, string | number | undefined>
    accessToken: AccessTokenProvider
    signal?: AbortSignal
  },
): Promise<T> {
  const url = new URL(path, baseUrl)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const token = await options.accessToken()
  if (token === undefined) {
    throw new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, null)
  }

  let response: Response
  try {
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
    if (options.signal !== undefined) init.signal = options.signal
    response = await fetch(url, init)
  } catch {
    throw new EntAdminHttpError('ENT_PLATFORM_UNAVAILABLE', true, 0, null)
  }

  if (response.ok) {
    return (await response.json()) as T
  }

  const envelope = await parseErrorEnvelope(response)
  const requestId = response.headers.get('x-request-id')
  if (envelope !== undefined) {
    throw new EntAdminHttpError(envelope.code, envelope.retryable, response.status, envelope.requestId ?? requestId)
  }
  if (response.status === 401) {
    throw new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, requestId)
  }
  if (response.status === 403) {
    throw new EntAdminHttpError('ENT_PERMISSION_DENIED', false, 403, requestId)
  }
  if (response.status === 404) {
    throw new EntAdminHttpError('ENT_RESOURCE_NOT_FOUND', false, 404, requestId)
  }
  throw new EntAdminHttpError('ENT_PLATFORM_UNAVAILABLE', true, response.status, requestId)
}
