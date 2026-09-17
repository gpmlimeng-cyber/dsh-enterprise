/**
 * [INPUT]: 依赖 Harness `ctx.webServer.register()` route port、平台操作端口及组合层注入的插件动作端口
 * [OUTPUT]: 提供账号/配置按需刷新与插件操作的严格同源 JSON 路由，无常驻状态连接
 * [POS]: platform-client 的 Host/Client 同源协作边界，只序列化脱敏 DTO 并把认证 HTTP 留在 Host Service
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  BootstrapSnapshot,
  EnterpriseLoginFlow,
  EnterprisePlatformStatus,
} from './types.js'

const LOCAL_API_PREFIX = '/enterprise/api/v1/local'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const MAX_LOCAL_BODY_BYTES = 256 * 1024

/** Harness `ctx.webServer` Service 公开的 route 结构。 */
export interface WebServerRoutePort {
  readonly host: '127.0.0.1' | '0.0.0.0'
  readonly port: number
  register(route: {
    readonly kind: 'exact' | 'prefix'
    readonly path: string
    readonly handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

/** 挂载到本地同源 API 的脱敏 Service 操作端口。 */
export interface EnterpriseLocalPlatformPort {
  status(): EnterprisePlatformStatus
  refresh(): Promise<EnterprisePlatformStatus>
  setServerUrl(serverUrl: string): Promise<{ readonly serverUrl: string }>
  startLogin(): Promise<EnterpriseLoginFlow>
  cancelLogin(): boolean
  logout(): Promise<void>
  bootstrap(): BootstrapSnapshot | undefined
  listPresets(signal?: AbortSignal): Promise<unknown>
  getPreset(packageId: string, signal?: AbortSignal): Promise<unknown>
}

/** 会话同步本地投影端口；由 session-sync host-bridge 注入，避免反向依赖。 */
export interface EnterpriseLocalSessionPort {
  status(): {
    readonly enabled: boolean
    readonly deviceId: string | null
    readonly pendingSessionIds: readonly string[]
    readonly lastError: string | null
  }
  list(signal?: AbortSignal): Promise<unknown>
  restore(sourceSessionId: string, cwd: string, signal?: AbortSignal): Promise<{
    readonly restoredSessionId: string
    readonly sourceSessionId: string
  }>
}

export interface EnterpriseLocalApiOptions {
  readonly platform: EnterpriseLocalPlatformPort
  /** 由组合层绑定 distribution，避免 platform-client 反向依赖具体插件包。 */
  readonly pluginStatus: () => unknown
  readonly pluginAction?: (action: 'install' | 'remove', packageName: string, pluginVersionId?: string) => Promise<void>
  /** 由组合层绑定整包卸载；返回的重启动作必须在 HTTP 成功响应写出后才执行。 */
  readonly uninstallPlugin?: () => Promise<{ readonly restart?: () => void }>
  /** 由组合层绑定会话同步；缺省时不注册 /sessions* 路由。 */
  readonly sessionSync?: EnterpriseLocalSessionPort
  /** 由组合层绑定云端工作空间；缺省时不注册 /cloud-projects* 路由。 */
  readonly cloudWorkspace?: EnterpriseLocalCloudWorkspacePort
}

/** 云端工作空间本地投影端口；由 cloud-workspace 包注入，避免反向依赖。 */
export interface EnterpriseLocalCloudWorkspacePort {
  list(): Promise<unknown>
  create(body: { name: string; description?: string | null }): Promise<unknown>
  clone(projectId: string, body: { rootDir: string }): Promise<unknown>
  pull(projectId: string): Promise<unknown>
  commit(projectId: string, body: { message: string }): Promise<unknown>
  push(projectId: string): Promise<unknown>
  status(projectId: string): Promise<unknown>
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return 'ENT_PLATFORM_UNAVAILABLE'
}

function actionErrorStatus(error: unknown): number {
  if (error instanceof RangeError) return 413
  if (error instanceof SyntaxError || error instanceof TypeError) return 400
  const code = errorCode(error)
  if (code === 'ENT_INVALID_REQUEST') return 400
  if (code === 'ENT_PLUGIN_BUSY') return 409
  if (code === 'ENT_AUTH_REQUIRED' || code === 'ENT_AUTH_SESSION_EXPIRED') return 401
  if (code === 'ENT_DEVICE_REVOKED' || code === 'ENT_PERMISSION_DENIED') return 403
  if (code === 'ENT_RESOURCE_NOT_FOUND') return 404
  if (code === 'ENT_SESSION_SYNC_DISABLED') return 403
  return 503
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_LOCAL_BODY_BYTES) throw new RangeError('request body is too large')
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

async function requireEmptyObject(request: IncomingMessage): Promise<void> {
  const value = await readJson(request)
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value as Record<string, unknown>).length !== 0) {
    throw new TypeError('action body must be an empty object')
  }
}

function parseServerUrlInput(value: unknown): { readonly serverUrl: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('server URL body must be an object')
  }
  const body = value as Record<string, unknown>
  if (Object.keys(body).join(',') !== 'serverUrl'
    || typeof body['serverUrl'] !== 'string'
    || body['serverUrl'].length === 0
    || body['serverUrl'].length > 2048) {
    throw new TypeError('server URL body is invalid')
  }
  return { serverUrl: body['serverUrl'] }
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? '/', 'http://enterprise.local')
}

function registerJsonAction(
  webServer: WebServerRoutePort,
  path: string,
  action: () => Promise<unknown>,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: `${LOCAL_API_PREFIX}${path}`,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      try {
        await requireEmptyObject(request)
        writeJson(response, 200, { data: await action() })
      } catch (error) {
        const status = actionErrorStatus(error)
        writeJson(response, status, {
          error: { code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
        })
      }
    },
  })
}

/** 以单一事务注册 T06 本地路由，并返回合并 disposer。 */
export function registerEnterpriseLocalApi(
  webServer: WebServerRoutePort,
  options: EnterpriseLocalApiOptions,
): () => void {
  const disposers: (() => void)[] = []

  try {
    disposers.push(registerJsonAction(webServer, '/refresh', () => options.platform.refresh()))
    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/status`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        writeJson(response, 200, { data: options.platform.status() })
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/server`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }
        try {
          const input = parseServerUrlInput(await readJson(request))
          writeJson(response, 200, { data: await options.platform.setServerUrl(input.serverUrl) })
        } catch (error) {
          const status = actionErrorStatus(error)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
          })
        }
      },
    }))

    disposers.push(registerJsonAction(webServer, '/auth/start', async () => options.platform.startLogin()))
    disposers.push(registerJsonAction(webServer, '/auth/cancel', async () => ({
      cancelled: options.platform.cancelLogin(),
    })))
    disposers.push(registerJsonAction(webServer, '/logout', async () => {
      await options.platform.logout()
      return { loggedOut: true }
    }))

    if (options.uninstallPlugin !== undefined) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/uninstall`,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          try {
            await requireEmptyObject(request)
            const result = await options.uninstallPlugin?.()
            const restart = result?.restart
            writeJson(response, 200, { data: { uninstalled: true, restartRequested: restart !== undefined } })
            restart?.()
          } catch (error) {
            const status = actionErrorStatus(error)
            writeJson(response, status, {
              error: { code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
            })
          }
        },
      }))
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/bootstrap`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        writeJson(response, 200, { data: options.platform.bootstrap() ?? null })
      },
    }))

    for (const action of ['install', 'remove'] as const) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/plugins/${action}`,
        handler: async (request, response) => {
          if (request.method !== 'POST') { methodNotAllowed(response, 'POST'); return }
          try {
            const value = await readJson(request)
            if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid plugin action')
            const body = value as Record<string, unknown>
            if (Object.keys(body).sort().join(',') !== (action === 'install' ? 'packageName,pluginVersionId' : 'packageName')
              || typeof body['packageName'] !== 'string' || body['packageName'].length > 214
              || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(body['packageName'])
              || action === 'install' && (typeof body['pluginVersionId'] !== 'string' || !/^[1-9][0-9]{0,18}$/.test(body['pluginVersionId']))) {
              throw new TypeError('invalid plugin action')
            }
            if (options.pluginAction === undefined) throw new Error('plugin distribution is unavailable')
            await options.pluginAction(action, body['packageName'], body['pluginVersionId'] as string | undefined)
            writeJson(response, 200, { data: options.pluginStatus() })
          } catch (error) {
            const status = actionErrorStatus(error)
            writeJson(response, status, { error: {
              code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
            } })
          }
        },
      }))
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/plugins`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        writeJson(response, 200, { data: options.pluginStatus() })
      },
    }))

    if (options.sessionSync !== undefined) {
      const sessionSync = options.sessionSync
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/sessions/sync`,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          writeJson(response, 200, { data: sessionSync.status() })
        },
      }))
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/sessions`,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: { items: await sessionSync.list() } })
          } catch (error) {
            const status = actionErrorStatus(error)
            writeJson(response, status, { error: {
              code: errorCode(error) === 'ENT_SESSION_SYNC_DISABLED' ? 'ENT_SESSION_SYNC_DISABLED' : errorCode(error),
            } })
          }
        },
      }))
      disposers.push(webServer.register({
        kind: 'prefix',
        path: `${LOCAL_API_PREFIX}/sessions/`,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          const rest = requestUrl(request).pathname.slice(`${LOCAL_API_PREFIX}/sessions/`.length)
          const match = /^([^/]+)\/copies$/.exec(rest)
          if (match === null) {
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
            return
          }
          const sourceSessionId = decodeURIComponent(match[1]!)
          try {
            const body = await readJson(request)
            const cwd = typeof body === 'object' && body !== null && !Array.isArray(body)
              ? (body as { cwd?: unknown }).cwd
              : undefined
            if (typeof cwd !== 'string' || !cwd.startsWith('/') || cwd.length > 4096) {
              throw new TypeError('invalid restore cwd')
            }
            const result = await sessionSync.restore(sourceSessionId, cwd)
            writeJson(response, 200, {
              data: {
                restoredSessionId: result.restoredSessionId,
                sourceSessionId: result.sourceSessionId,
              },
            })
          } catch (error) {
            const status = actionErrorStatus(error)
            writeJson(response, status, {
              error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
            })
          }
        },
      }))
    }

    if (options.cloudWorkspace !== undefined) {
      const cloudWorkspace = options.cloudWorkspace
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/cloud-projects`,
        handler: async (request, response) => {
          if (request.method === 'GET') {
            try {
              writeJson(response, 200, { data: await cloudWorkspace.list() })
            } catch (error) {
              const status = actionErrorStatus(error)
              writeJson(response, status, { error: { code: errorCode(error) } })
            }
            return
          }
          if (request.method === 'POST') {
            try {
              const body = await readJson(request)
              if (typeof body !== 'object' || body === null || Array.isArray(body)) {
                throw new TypeError('invalid create body')
              }
              const input = body as { name?: unknown; description?: unknown }
              if (typeof input.name !== 'string' || input.name.length === 0 || input.name.length > 120) {
                throw new TypeError('invalid project name')
              }
              if (input.description !== undefined && input.description !== null && typeof input.description !== 'string') {
                throw new TypeError('invalid description')
              }
              const description = input.description === undefined || input.description === null
                ? null
                : input.description
              writeJson(response, 200, {
                data: await cloudWorkspace.create({
                  name: input.name,
                  description,
                }),
              })
            } catch (error) {
              const status = actionErrorStatus(error)
              writeJson(response, status, { error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) } })
            }
            return
          }
          methodNotAllowed(response, 'GET,POST')
        },
      }))
      disposers.push(webServer.register({
        kind: 'prefix',
        path: `${LOCAL_API_PREFIX}/cloud-projects/`,
        handler: async (request, response) => {
          const rest = requestUrl(request).pathname.slice(`${LOCAL_API_PREFIX}/cloud-projects/`.length)
          const actionMatch = /^([^/]+)(?:\/(clone|pull|commit|push|status))?$/.exec(rest)
          if (actionMatch === null) {
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
            return
          }
          const projectId = decodeURIComponent(actionMatch[1]!)
          const action = actionMatch[2]
          try {
            if (request.method === 'GET' && action === undefined) {
              writeJson(response, 200, { data: await cloudWorkspace.list() })
              return
            }
            if (request.method !== 'POST' || action === undefined) {
              methodNotAllowed(response, action === undefined ? 'GET,POST' : 'POST')
              return
            }
            if (action === 'clone') {
              const body = await readJson(request)
              const rootDir = typeof body === 'object' && body !== null && !Array.isArray(body)
                ? (body as { rootDir?: unknown }).rootDir
                : undefined
              if (typeof rootDir !== 'string') throw new TypeError('invalid rootDir')
              writeJson(response, 200, { data: await cloudWorkspace.clone(projectId, { rootDir }) })
              return
            }
            if (action === 'pull') {
              writeJson(response, 200, { data: await cloudWorkspace.pull(projectId) })
              return
            }
            if (action === 'status') {
              writeJson(response, 200, { data: await cloudWorkspace.status(projectId) })
              return
            }
            if (action === 'push') {
              writeJson(response, 200, { data: await cloudWorkspace.push(projectId) })
              return
            }
            const body = await readJson(request)
            const message = typeof body === 'object' && body !== null && !Array.isArray(body)
              ? (body as { message?: unknown }).message
              : undefined
            if (typeof message !== 'string' || message.trim().length === 0) throw new TypeError('invalid message')
            writeJson(response, 200, { data: await cloudWorkspace.commit(projectId, { message }) })
          } catch (error) {
            const status = actionErrorStatus(error)
            writeJson(response, status, { error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) } })
          }
        },
      }))
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/presets`,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        try {
          const value = await options.platform.listPresets()
          writeJson(response, 200, { data: value })
        } catch (error) {
          const status = actionErrorStatus(error)
          writeJson(response, status, { error: { code: errorCode(error) } })
        }
      },
    }))

    disposers.push(webServer.register({
      kind: 'prefix',
      path: `${LOCAL_API_PREFIX}/presets/`,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        try {
          const packageId = requestUrl(request).pathname.slice(`${LOCAL_API_PREFIX}/presets/`.length)
          if (!/^[1-9][0-9]{0,18}$/.test(packageId)) throw new TypeError('invalid preset package id')
          const value = await options.platform.getPreset(packageId)
          writeJson(response, 200, { data: value })
        } catch (error) {
          const status = actionErrorStatus(error)
          writeJson(response, status, { error: { code: errorCode(error) } })
        }
      },
    }))

  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
