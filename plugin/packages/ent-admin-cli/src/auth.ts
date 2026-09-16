/**
 * [INPUT]: 依赖 config/installation/credentials/pkce/browser/http 与 contracts Token DTO
 * [OUTPUT]: 对外提供 login、ensureAccessToken、logout、statusSnapshot
 * [POS]: ent-admin-cli 的认证会话内核；Access 只在内存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomBytes } from 'node:crypto'
import { platform as hostPlatform } from 'node:os'
import {
  decodeEnterpriseError,
  zDeviceResponse,
  zTokenResponse,
  type TokenRequest,
} from '@dshent/contracts'
import { loadConfig, saveConfig, normalizeServerOrigin } from './config.js'
import {
  deleteCredentials,
  loadCredentials,
  saveCredentials,
  type CredentialRecord,
} from './credentials.js'
import { loadOrCreateInstallation } from './installation.js'
import { openSystemBrowser } from './browser.js'
import { createPkceS256, startLoopbackCallback } from './pkce.js'
import { EntAdminHttpError } from './http.js'

const AUTH_PATH = '/enterprise/auth/v1'
const API_PATH = '/enterprise/api/v1'
const CLIENT_ID = 'ent-admin-cli'
const CLI_VERSION = '0.1.0'
const CLI_HARNESS_VERSION = 'ent-admin-cli'

interface MemorySession {
  accessToken: string
  accessExpiresAt: number
  serverUrl: string
}

const memory = new Map<string, MemorySession>()

export function clearMemorySession(serverUrl: string): void {
  memory.delete(serverUrl)
}

export function setMemorySession(serverUrl: string, session: MemorySession): void {
  memory.set(serverUrl, session)
}

export function getMemorySession(serverUrl: string): MemorySession | undefined {
  return memory.get(serverUrl)
}

async function postPublicJson(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
    if (signal !== undefined) init.signal = signal
    response = await fetch(path, init)
  } catch {
    throw new EntAdminHttpError('ENT_PLATFORM_UNAVAILABLE', true, 0, null)
  }
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    throw new EntAdminHttpError(
      'ENT_PLATFORM_UNAVAILABLE',
      true,
      response.status,
      response.headers.get('x-request-id'),
    )
  }
  if (!response.ok) {
    try {
      const error = decodeEnterpriseError(parsed)
      throw new EntAdminHttpError(error.code, error.retryable, response.status, error.requestId)
    } catch (error) {
      if (error instanceof EntAdminHttpError) throw error
      if (response.status === 401) {
        throw new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, response.headers.get('x-request-id'))
      }
      throw new EntAdminHttpError(
        'ENT_PLATFORM_UNAVAILABLE',
        true,
        response.status,
        response.headers.get('x-request-id'),
      )
    }
  }
  return parsed
}

async function exchangeToken(
  serverUrl: string,
  request: TokenRequest,
  signal?: AbortSignal,
): Promise<ReturnType<typeof zTokenResponse.parse>['data']> {
  const parsed = await postPublicJson(new URL(`${AUTH_PATH}/token`, serverUrl).toString(), request, signal)
  return zTokenResponse.parse(parsed).data
}

async function enrollDevice(
  serverUrl: string,
  accessToken: string,
  installationId: string,
  name: string,
): Promise<void> {
  const response = await fetch(new URL(`${API_PATH}/devices/enroll`, serverUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      installationId,
      name,
      platform: hostPlatform(),
      harnessVersion: CLI_HARNESS_VERSION,
      enterpriseBundleVersion: CLI_VERSION,
    }),
  })
  const text = await response.text()
  let parsed: unknown = {}
  try {
    parsed = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    // fall through to status handling
  }
  if (response.status === 409) return
  if (!response.ok) {
    try {
      const error = decodeEnterpriseError(parsed)
      throw new EntAdminHttpError(error.code, error.retryable, response.status, error.requestId)
    } catch (error) {
      if (error instanceof EntAdminHttpError) throw error
      throw new EntAdminHttpError(
        'ENT_PLATFORM_UNAVAILABLE',
        true,
        response.status,
        response.headers.get('x-request-id'),
      )
    }
  }
  zDeviceResponse.parse(parsed)
}

export interface LoginOptions {
  server: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  openBrowser?: (url: string, signal: AbortSignal) => Promise<void>
  log?: (message: string) => void
}

export async function login(options: LoginOptions): Promise<{ serverUrl: string; installationId: string }> {
  const env = options.env ?? process.env
  const serverUrl = normalizeServerOrigin(options.server)
  const timeoutMs = options.timeoutMs ?? 330_000
  const installation = await loadOrCreateInstallation(env)
  const pkce = createPkceS256()
  const state = randomBytes(16).toString('base64url')
  const abort = new AbortController()
  const callback = await startLoopbackCallback({ expectedState: state, timeoutMs, signal: abort.signal })

  const authorizeUrl = new URL(`${AUTH_PATH}/authorize`, serverUrl)
  authorizeUrl.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: callback.redirectUri,
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
    installation_id: installation.installationId,
  }).toString()

  options.log?.(`Open browser to complete login: ${authorizeUrl.toString()}`)
  const open = options.openBrowser ?? openSystemBrowser
  try {
    await open(authorizeUrl.toString(), abort.signal)
  } catch {
    options.log?.('Could not open system browser; open the URL manually.')
  }

  try {
    const { code } = await callback.result
    const token = await exchangeToken(
      serverUrl,
      {
        grantType: 'authorization_code',
        code,
        clientId: CLIENT_ID,
        redirectUri: callback.redirectUri,
        codeVerifier: pkce.verifier,
        installationId: installation.installationId,
      },
      abort.signal,
    )

    await enrollDevice(serverUrl, token.accessToken, installation.installationId, installation.name)
    await saveConfig({ serverUrl }, env)
    await saveCredentials(
      {
        serverUrl,
        installationId: installation.installationId,
        refreshToken: token.refreshToken,
        refreshExpiresAt: Date.now() + token.refreshExpiresIn * 1_000,
      },
      env,
    )
    setMemorySession(serverUrl, {
      accessToken: token.accessToken,
      accessExpiresAt: Date.now() + token.expiresIn * 1_000,
      serverUrl,
    })
    return { serverUrl, installationId: installation.installationId }
  } finally {
    callback.cancel()
    abort.abort()
  }
}

export async function ensureAccessToken(
  serverUrl: string,
  env?: NodeJS.ProcessEnv,
  options: { marginMs?: number; force?: boolean } = {},
): Promise<string> {
  const origin = normalizeServerOrigin(serverUrl)
  const marginMs = options.marginMs ?? 60_000
  const cached = getMemorySession(origin)
  if (options.force !== true && cached !== undefined && Date.now() < cached.accessExpiresAt - marginMs) {
    return cached.accessToken
  }

  const credentials = await loadCredentials(env)
  if (
    credentials === undefined ||
    credentials.serverUrl !== origin ||
    Date.now() >= credentials.refreshExpiresAt - marginMs
  ) {
    clearMemorySession(origin)
    throw new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, null)
  }

  const token = await exchangeToken(origin, {
    grantType: 'refresh_token',
    refreshToken: credentials.refreshToken,
    clientId: CLIENT_ID,
    installationId: credentials.installationId,
  })

  const next: CredentialRecord = {
    serverUrl: origin,
    installationId: credentials.installationId,
    refreshToken: token.refreshToken,
    refreshExpiresAt: Date.now() + token.refreshExpiresIn * 1_000,
  }
  await saveCredentials(next, env)
  setMemorySession(origin, {
    accessToken: token.accessToken,
    accessExpiresAt: Date.now() + token.expiresIn * 1_000,
    serverUrl: origin,
  })
  return token.accessToken
}

export async function logout(serverUrl: string | undefined, env?: NodeJS.ProcessEnv): Promise<void> {
  const credentials = await loadCredentials(env)
  const target = serverUrl ?? credentials?.serverUrl
  if (target !== undefined) clearMemorySession(normalizeServerOrigin(target))
  await deleteCredentials(env)
}

export async function statusSnapshot(
  serverUrl: string,
  env?: NodeJS.ProcessEnv,
): Promise<{
  serverUrl: string
  authenticated: boolean
  installationId: string
  accessInMemory: boolean
  refreshExpiresAt: number | null
}> {
  const origin = normalizeServerOrigin(serverUrl)
  const credentials = await loadCredentials(env)
  const installation = await loadOrCreateInstallation(env)
  const session = getMemorySession(origin)
  const refreshUsable =
    credentials !== undefined && credentials.serverUrl === origin && credentials.refreshExpiresAt > Date.now()
  return {
    serverUrl: origin,
    authenticated: refreshUsable,
    installationId: installation.installationId,
    accessInMemory: session !== undefined && Date.now() < session.accessExpiresAt,
    refreshExpiresAt: refreshUsable && credentials !== undefined ? credentials.refreshExpiresAt : null,
  }
}
