/**
 * [INPUT]: 依赖 Harness `ctx.webServer.register()` route port、平台操作端口、组合层注入的插件动作端口与技能安装端口、品牌只读端口与可选投影留痕端口
 * [OUTPUT]: 提供账号/配置按需刷新、插件操作、**企业技能安装/卸载/已装态**、本地品牌投影与原生登录（来源列表 / 凭证代提交 / 改密代提交）的严格同源 JSON 路由，无常驻状态连接；凭证正文只按固定键集读入并原样转发，绝不进日志；每个把异常投影成 HTTP 状态的回调都经 `onError` 上报操作名与原始 error；三条详情 prefix（品牌位图 / 会话恢复 / 配方详情）的注册 path 一律**不带尾斜杠**，技能三条动作路由是 `/skills` prefix 的 exact 子路径（`ENTERPRISE_SKILL_*_LOCAL_PATH`）
 * [POS]: platform-client 的 Host/Client 同源协作边界，只序列化脱敏 DTO 并把认证 HTTP 留在 Host Service；路由形状受引擎 `match()`（`lib/index.js:322`）约束——exact 表整路径优先、prefix 只认 `pathname === prefix` 或 `pathname.startsWith(prefix + '/')`、多条命中取最长，故带尾斜杠的 prefix 会在引擎层空体 404 而根本不进 handler，而 `/skills/install` 这类子路径动作必须靠 exact 表抢在 `/skills` prefix 之前
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  BRANDING_ASSET_LOCAL_PATH,
  BRANDING_ASSET_SLOTS,
  BRANDING_LOCAL_PATH,
  type BrandingAssetSlot,
  type EnterpriseBrandingPort,
} from './branding.js'
import type {
  BootstrapSnapshot,
  EnterpriseCredentialResult,
  EnterpriseCredentialsInput,
  EnterpriseLoginFlow,
  EnterpriseLoginForm,
  EnterprisePasswordChangeInput,
  EnterprisePlatformStatus,
} from './types.js'

const LOCAL_API_PREFIX = '/enterprise/api/v1/local'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const MAX_LOCAL_BODY_BYTES = 256 * 1024

/**
 * 三条 **prefix** 路由的注册 path：与各自的父路径（品牌文档 / 会话列表 / 配方列表）**逐字相同，不带尾斜杠**。
 *
 * 引擎 `dsh-host-webserver` 的 `match()`（`lib/index.js`）只做「路径段前缀」匹配：
 * `pathname === prefix || pathname.startsWith(`${prefix}/`)`；先查 exact 表（整路径命中即返回，不比长度），
 * miss 后才在 prefix 表里取**最长**命中。因此注册成 `${...}/asset/`、`${...}/sessions/`、`${...}/presets/`
 * 时，`/asset/light`、`/sessions/<id>/copies`、`/presets/<id>` 既不等于 prefix、也不以 `prefix + '/'` 开头，
 * 引擎层直接回 404（**空响应体，handler 根本不会被调用**）——这正是品牌位图、远端会话恢复与配方详情
 * 三条线空体 404 的根因，与 `bundle/src/skill-route.ts` 的详情路由同族（那里已修）。
 *
 * exact 与 prefix 是引擎里的**两张表**（`register()` 只对同 kind、同 path 抛重复），
 * 所以 `/sessions`、`/presets` 上「列表 exact + 详情 prefix」共用同一字符串并不冲突，且 exact 优先命中；
 * `/sessions/sync` 这条 sibling exact 同理不会被上面那条更短的 prefix 抢走。
 *
 * 下面这三条只用于 `register()`；handler 内 `slice()` 用的仍是**含斜杠**的边界串（`${...}/asset/` 等），
 * 二者不是同一条串，切勿为了「去重」把它们合并回带尾斜杠的形状。
 */
const BRANDING_ASSET_PREFIX_ROUTE = BRANDING_ASSET_LOCAL_PATH
const SESSION_RESTORE_PREFIX_ROUTE = `${LOCAL_API_PREFIX}/sessions`
const PRESET_DETAIL_PREFIX_ROUTE = `${LOCAL_API_PREFIX}/presets`

/**
 * 企业技能**安装动作**的三条 exact 注册 path。
 *
 * 技能目录的列表/详情在 `bundle/src/skill-route.ts` 里注册成「`/skills` exact 列表 + `/skills` prefix 详情」，
 * 本文件这第三条线是它的**子路径动作**：引擎 `match()`（`lib/index.js:322`）先查 exact 表整路径命中、
 * 再在 prefix 表里取最长，因此 `/skills/install`、`/skills/uninstall`、`/skills/installed` 一律由 exact 表
 * 优先命中，绝不会掉进 `/skills` 那条 prefix 被当成包 id。两条防线彼此独立：
 * 即便 exact 表整张消失，详情 handler 的 `^[1-9][0-9]{0,18}$` 也只会回 400，不会带着 `install` 打上游。
 */
export const ENTERPRISE_SKILL_INSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/install`
export const ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/uninstall`
export const ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/installed`

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
  /**
   * 原生登录（安卓）：宿主已自己开好服务端事务，这里交出可选认证来源供界面渲染表单。
   * 没有进行中的原生事务时抛 `ENT_INVALID_REQUEST`。
   */
  loginForm(): EnterpriseLoginForm
  /** 代提交账号密码；成功即已驱动本机回调，失败按中心错误码抛出。 */
  submitCredentials(input: EnterpriseCredentialsInput, signal?: AbortSignal): Promise<EnterpriseCredentialResult>
  /** 走完「需改密」分支；成功后同样已驱动本机回调（再次被策略拒时返回 change-password）。 */
  submitPasswordChange(input: EnterprisePasswordChangeInput, signal?: AbortSignal): Promise<EnterpriseCredentialResult>
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
  /**
   * 由组合层绑定企业技能安装器（bundle 的 `skill-install.ts`）；返回**安装后的最新已装态**，
   * 让界面一次往返就拿到真值而不是自行猜测。缺席时不注册 `/skills/install|uninstall`。
   */
  readonly skillAction?: (action: 'install' | 'uninstall', packageId: string) => Promise<unknown>
  /** 已装技能清单；缺席时不注册 `/skills/installed`。 */
  readonly skillStatus?: () => unknown | Promise<unknown>
  /** 由组合层绑定整包卸载；返回的重启动作必须在 HTTP 成功响应写出后才执行。 */
  readonly uninstallPlugin?: () => Promise<{ readonly restart?: () => void }>
  /** 由组合层绑定会话同步；缺省时不注册 /sessions* 路由。 */
  readonly sessionSync?: EnterpriseLocalSessionPort
  /** 由 platform-client 品牌缓存绑定；缺省时不注册 /branding* 路由。 */
  readonly branding?: EnterpriseBrandingPort
  /**
   * 本地路由把异常投影成 HTTP 状态码时的留痕端口；由组合层绑定 Host logger。
   * 只上报操作名、原始 error 与最终状态码，不改变任何响应语义。
   */
  readonly onError?: (operation: string, error: unknown, status: number) => void
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

/** 品牌位图是本地缓存副本：只回白名单 MIME 与长度，浏览器不需要任何解码逻辑。 */
function writeAsset(response: ServerResponse, contentType: string, bytes: Buffer): void {
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': String(bytes.byteLength),
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
  })
  response.end(bytes)
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
  // 技能落点已被同名技能目录占用：请求本身合法、本机状态冲突，故 409 而不是 400/503。
  if (code === 'ENT_SKILL_NAME_CONFLICT') return 409
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

/**
 * 逐字段读必填字符串：键集必须**完全一致**、每个值都是非空有界字符串，否则 TypeError（投影 400）。
 *
 * 原生登录的凭证正文走这里——多余键即拒，避免任何越界字段被顺手转发给企业服务器。
 */
function requiredStrings(value: unknown, keys: readonly string[], maxLength: number): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('body must be an object')
  const body = value as Record<string, unknown>
  const expected = [...keys].sort().join(',')
  if (Object.keys(body).sort().join(',') !== expected) throw new TypeError('unexpected body keys')
  const result: Record<string, string> = {}
  for (const key of keys) {
    const field = body[key]
    if (typeof field !== 'string' || field.length === 0 || field.length > maxLength) throw new TypeError(`invalid ${key}`)
    result[key] = field
  }
  return result
}

function registerJsonAction(
  webServer: WebServerRoutePort,
  path: string,
  action: () => Promise<unknown>,
  onError?: (operation: string, error: unknown, status: number) => void,
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
        onError?.(`POST ${LOCAL_API_PREFIX}${path}`, error, status)
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
    disposers.push(registerJsonAction(webServer, '/refresh', () => options.platform.refresh(), options.onError))
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
          options.onError?.(`POST ${LOCAL_API_PREFIX}/server`, error, status)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
          })
        }
      },
    }))

    disposers.push(registerJsonAction(webServer, '/auth/start', async () => options.platform.startLogin(), options.onError))
    disposers.push(registerJsonAction(webServer, '/auth/cancel', async () => ({
      cancelled: options.platform.cancelLogin(),
    }), options.onError))
    disposers.push(registerJsonAction(webServer, '/logout', async () => {
      await options.platform.logout()
      return { loggedOut: true }
    }, options.onError))

    // 原生登录（安卓）：宿主已自己开好服务端事务，界面直接收账号密码——凭证只在内存中转发，
    // 既不写盘也不进日志；成功后宿主自己把 redirectUri 走完（本机回调照常触发）。
    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/auth/form`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        try {
          writeJson(response, 200, { data: options.platform.loginForm() })
        } catch (error) {
          options.onError?.(`GET ${LOCAL_API_PREFIX}/auth/form`, error, actionErrorStatus(error))
          writeJson(response, actionErrorStatus(error), { error: { code: errorCode(error) } })
        }
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/auth/password`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }
        const operation = `POST ${LOCAL_API_PREFIX}/auth/password`
        try {
          const body = requiredStrings(await readJson(request), ['sourceId', 'username', 'password'], 512)
          writeJson(response, 200, { data: await options.platform.submitCredentials({
            sourceId: body['sourceId'] as string,
            username: body['username'] as string,
            password: body['password'] as string,
          }) })
        } catch (error) {
          const status = actionErrorStatus(error)
          // 凭证永不进日志：这里只留操作名、原始 error（不含正文）与状态码。
          options.onError?.(operation, error, status)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : status === 413 ? 'ENT_REQUEST_TOO_LARGE' : errorCode(error) },
          })
        }
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/auth/password-change`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }
        const operation = `POST ${LOCAL_API_PREFIX}/auth/password-change`
        try {
          const body = requiredStrings(await readJson(request), ['challenge', 'newPassword'], 512)
          writeJson(response, 200, { data: await options.platform.submitPasswordChange({
            challenge: body['challenge'] as string,
            newPassword: body['newPassword'] as string,
          }) })
        } catch (error) {
          const status = actionErrorStatus(error)
          options.onError?.(operation, error, status)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : status === 413 ? 'ENT_REQUEST_TOO_LARGE' : errorCode(error) },
          })
        }
      },
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

    if (options.branding !== undefined) {
      const branding = options.branding
      // 品牌是本地缓存投影：读失败也必须回一个可渲染的答案（null 由 ui 回落内置默认），故恒 200。
      disposers.push(webServer.register({
        kind: 'exact',
        path: BRANDING_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: await branding.document() })
          } catch (error) {
            options.onError?.(`GET ${BRANDING_LOCAL_PATH}`, error, 200)
            writeJson(response, 200, { data: null })
          }
        },
      }))
      disposers.push(webServer.register({
        kind: 'prefix',
        // 不带尾斜杠：引擎按「路径段前缀」匹配，带尾斜杠会让 /branding/asset/<slot> 在引擎层就 404。
        path: BRANDING_ASSET_PREFIX_ROUTE,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          const slot = requestUrl(request).pathname.slice(`${BRANDING_ASSET_LOCAL_PATH}/`.length)
          if (!BRANDING_ASSET_SLOTS.includes(slot as BrandingAssetSlot)) {
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
            return
          }
          try {
            const asset = await branding.asset(slot as BrandingAssetSlot)
            if (asset === undefined) {
              writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
              return
            }
            writeAsset(response, asset.contentType, asset.bytes)
          } catch (error) {
            options.onError?.(`GET ${BRANDING_ASSET_LOCAL_PATH}/${slot}`, error, 404)
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
          }
        },
      }))
    }

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

    if (options.skillStatus !== undefined) {
      const skillStatus = options.skillStatus
      disposers.push(webServer.register({
        kind: 'exact',
        path: ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: await skillStatus() })
          } catch (error) {
            const status = actionErrorStatus(error)
            options.onError?.(`GET ${ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH}`, error, status)
            writeJson(response, status, { error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) } })
          }
        },
      }))
    }

    if (options.skillAction !== undefined) {
      const skillAction = options.skillAction
      for (const action of ['install', 'uninstall'] as const) {
        const path = action === 'install'
          ? ENTERPRISE_SKILL_INSTALL_LOCAL_PATH
          : ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH
        disposers.push(webServer.register({
          kind: 'exact',
          path,
          handler: async (request, response) => {
            if (request.method !== 'POST') { methodNotAllowed(response, 'POST'); return }
            try {
              const value = await readJson(request)
              if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid skill action')
              const body = value as Record<string, unknown>
              // 与 `/plugins/{action}` 同一把尺：键集完全一致、packageId 是中心雪花 id 形状。
              // 越界字符串绝不进入 bundle 的路径构造（那里还会再校验一次 manifest 里的技能名）。
              if (Object.keys(body).sort().join(',') !== 'packageId'
                || typeof body['packageId'] !== 'string'
                || !/^[1-9][0-9]{0,18}$/.test(body['packageId'])) {
                throw new TypeError('invalid skill action')
              }
              writeJson(response, 200, { data: await skillAction(action, body['packageId']) })
            } catch (error) {
              const status = actionErrorStatus(error)
              options.onError?.(`POST ${path}`, error, status)
              writeJson(response, status, { error: {
                code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
              } })
            }
          },
        }))
      }
    }

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
        // 不带尾斜杠：否则 /sessions/<id>/copies 到不了本 handler（URL 里的 id 由下面的边界常量切出）。
        path: SESSION_RESTORE_PREFIX_ROUTE,
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
      // 不带尾斜杠：否则 /presets/<id> 到不了本 handler（`/presets` 裸路径由上面的 exact 路由优先命中）。
      path: PRESET_DETAIL_PREFIX_ROUTE,
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
