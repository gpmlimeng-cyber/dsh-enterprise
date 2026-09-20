/**
 * [INPUT]: 依赖 @dshent/contracts 错误解码与 fetch
 * [OUTPUT]: 对外提供 EntAdminHttpError、requestJson、requestBody
 * [POS]: ent-admin-cli 的 HTTP 边界；只暴露稳定 error code/retryable/requestId
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { decodeEnterpriseError, type EnterpriseError, type EnterpriseErrorCode } from '@dshent/contracts'

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

function mapHttpError(response: Response, envelope: EnterpriseError | undefined): EntAdminHttpError {
  const requestId = response.headers.get('x-request-id')
  if (envelope !== undefined) {
    return new EntAdminHttpError(envelope.code, envelope.retryable, response.status, envelope.requestId ?? requestId)
  }
  if (response.status === 401) return new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, requestId)
  if (response.status === 403) return new EntAdminHttpError('ENT_PERMISSION_DENIED', false, 403, requestId)
  if (response.status === 404) return new EntAdminHttpError('ENT_RESOURCE_NOT_FOUND', false, 404, requestId)
  if (response.status === 409) return new EntAdminHttpError('ENT_REVISION_CONFLICT', false, 409, requestId)
  return new EntAdminHttpError('ENT_PLATFORM_UNAVAILABLE', true, response.status, requestId)
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: Record<string, string | number | undefined>
    headers?: Record<string, string>
    body?: unknown
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
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    }
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.body)
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
  throw mapHttpError(response, envelope)
}

export async function requestMultipart(
  baseUrl: string,
  path: string,
  options: {
    file: Blob
    filename: string
    metadata?: unknown
    headers?: Record<string, string>
    accessToken: AccessTokenProvider
  },
): Promise<unknown> {
  const url = new URL(path, baseUrl)
  const token = await options.accessToken()
  if (token === undefined) {
    throw new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, null)
  }

  const form = new FormData()
  form.append('artifact', options.file, options.filename)
  if (options.metadata !== undefined) {
    form.append('metadata', new Blob([JSON.stringify(options.metadata)], { type: 'application/json' }), 'metadata.json')
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
      body: form,
    })
  } catch {
    throw new EntAdminHttpError('ENT_PLATFORM_UNAVAILABLE', true, 0, null)
  }

  if (response.ok) return (await response.json()) as unknown
  const envelope = await parseErrorEnvelope(response)
  throw mapHttpError(response, envelope)
}
