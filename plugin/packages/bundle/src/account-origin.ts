/**
 * [INPUT]: 依赖 Node HTTP 类型与 platform-client 的 `ctx.webServer` route port、稳定本地错误码
 * [OUTPUT]: 对外提供企业账户后台默认域名、地址校验纯函数、同源 GET/POST 路由注册，以及地址不可持久化时的语义化 503 投影
 * [POS]: bundle 的账户后台地址语义层；地址的挂载、热重挂生命周期与官方 settings volatile 字段声明留在 src/index.ts，本文件只做校验与 HTTP 投影
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebServerRoutePort } from '@dshent/platform-client'

/** 企业账户后台默认 origin；两个地址留空或等值即回落到它。 */
export const DEFAULT_ACCOUNT_ORIGIN = 'https://meizhiyun.chat'

/**
 * 账户与推理两个后台地址。二者同源时账户凭据才会随推理请求发出，
 * 因此它们是官方 settings 里同一个 owner entry 的两个 volatile 字段，而不是两处独立配置。
 */
export interface AccountOrigin {
  readonly platformOrigin: string
  readonly inferenceOrigin: string
}

/** GET `/account-origin` 回显的企业默认地址。 */
export const ACCOUNT_ORIGIN_DEFAULTS: AccountOrigin = {
  platformOrigin: DEFAULT_ACCOUNT_ORIGIN,
  inferenceOrigin: DEFAULT_ACCOUNT_ORIGIN,
}

const ACCOUNT_ORIGIN_MAX_LENGTH = 2048
/** 明文回环名单与官方 `platformOrigin()` 完全一致；上游 flag 只解锁这一种明文。 */
const LOOPBACK_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

/**
 * 校验并规范化一个账户后台地址，是地址写入前的唯一判断点。
 *
 * 规则：必须是绝对 HTTP(S) origin；`https:` 一律放行，`http:` 仅放行回环；
 * 不得携带 userinfo、path、query 或 fragment——官方 `platformOrigin()` 同样拒绝它们，
 * 先在这里拒绝就不会把运行中的官方插件换成一个起不来的配置。
 *
 * @param value - 用户输入的地址；空串（含纯空白）表示回落企业默认。
 * @returns 归一化后的 `protocol//host[:port]`，已去掉大小写与默认端口差异。
 * @throws {TypeError} 地址非法。
 */
export function normalizeAccountOrigin(value: string): string {
  const text = value.trim()
  if (text.length === 0) return DEFAULT_ACCOUNT_ORIGIN
  if (text.length > ACCOUNT_ORIGIN_MAX_LENGTH) throw new TypeError('account origin is too long')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new TypeError('account origin must be an absolute URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('account origin must be an HTTP(S) origin')
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new TypeError('account origin must not carry credentials')
  }
  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new TypeError('account origin must not carry a path, query or fragment')
  }
  if (url.protocol === 'http:' && !LOOPBACK_HOSTNAMES.includes(url.hostname)) {
    throw new TypeError('plain HTTP account origins are limited to loopback')
  }
  return url.origin
}

/**
 * 把官方 settings 里读到的一对地址规范化。
 *
 * 官方 0.1.7-rc.2 的 settings 不再提供 per-namespace `validate` 钩子，因此本函数是
 * **读取与挂载前**的唯一判断点：非法地址既不会挂到运行中的官方账户插件上，
 * 也不会经本地路由写进用户文档（路由在解析正文时已调用 {@link normalizeAccountOrigin}）。
 *
 * @param value - owner entry 的 volatile 地址字段读出的 `{platformOrigin, inferenceOrigin}`。
 * @returns 两个规范化 origin。
 * @throws {TypeError} 任一地址非法。
 */
export function resolveAccountOrigins(value: AccountOrigin): AccountOrigin {
  return {
    platformOrigin: normalizeAccountOrigin(value.platformOrigin),
    inferenceOrigin: normalizeAccountOrigin(value.inferenceOrigin),
  }
}

/**
 * 地址对的稳定指纹，用于判断一次写入是否真的需要换掉官方插件实例。
 *
 * @param value - 已规范化的地址对。
 * @returns 可直接比较的字符串。
 */
export function accountOriginFingerprint(value: AccountOrigin): string {
  return `${value.platformOrigin}\n${value.inferenceOrigin}`
}

/**
 * 严格解析 POST 正文：只接受 `{ platformOrigin?, inferenceOrigin? }` 两个字符串字段。
 *
 * 未知字段、非字符串与非法地址都在这里抛错，路由据此在写入前返回 400。
 *
 * @param value - `readJson` 得到的原始正文。
 * @returns 只含已规范化字段的补丁；两个字段都缺省时为空对象。
 * @throws {TypeError} 正文非法。
 */
export function parseAccountOriginPatch(value: unknown): Partial<AccountOrigin> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('account origin body must be an object')
  }
  const body = value as Record<string, unknown>
  for (const key of Object.keys(body)) {
    if (key !== 'platformOrigin' && key !== 'inferenceOrigin') {
      throw new TypeError(`unknown account origin field: ${key}`)
    }
    if (typeof body[key] !== 'string') throw new TypeError(`${key} must be a string`)
  }
  const patch: { platformOrigin?: string, inferenceOrigin?: string } = {}
  const platformOrigin = body['platformOrigin']
  const inferenceOrigin = body['inferenceOrigin']
  if (typeof platformOrigin === 'string') patch.platformOrigin = normalizeAccountOrigin(platformOrigin)
  if (typeof inferenceOrigin === 'string') patch.inferenceOrigin = normalizeAccountOrigin(inferenceOrigin)
  return patch
}

/** 路由需要的地址读写端口；官方插件的挂载与重挂由组合层持有，本文件不感知 Cordis fiber。 */
export interface AccountOriginPort {
  /** 当前存储的地址（已规范化）。 */
  read(): AccountOrigin
  /** 当前已挂载地址的指纹；尚未挂载时为空串。 */
  mountedFingerprint(): string
  /** 写入设置并热重挂；实现自己吞掉失败，不向路由抛异常。 */
  write(patch: Partial<AccountOrigin>): Promise<void>
}

/** 一个已挂载的官方账户插件实例；`dispose` 必须释放全局唯一的 `deepseekAccount` 注册。 */
export interface AccountPlatformInstance {
  dispose(): Promise<void>
}

/**
 * 组合层绑定给控制器的端口。官方插件与官方 settings 都留在 src/index.ts，
 * 本文件只负责「什么时候需要换实例、换失败怎么办」这一件事。
 */
export interface AccountOriginControllerOptions {
  /** 读取当前存储的地址（已规范化）。 */
  read(): AccountOrigin
  /** 落盘一个地址补丁；非法地址必须在这里拒绝。 */
  write(patch: Partial<AccountOrigin>): Promise<void>
  /** 按地址挂载一个新的官方账户实现；失败必须 reject。 */
  mount(origins: AccountOrigin): Promise<AccountPlatformInstance>
  /** 收下重挂过程中被吞掉的异常。 */
  onError(message: string, error: unknown): void
}

/** 账户地址控制器：既是路由的读写端口，也拥有热重挂生命周期。 */
export interface AccountOriginController extends AccountOriginPort {
  /** 把一对地址落到运行中的官方插件：串行、幂等，失败回滚且不抛异常。 */
  apply(next: AccountOrigin): Promise<void>
  dispose(): Promise<void>
}

/**
 * 组装地址热重挂控制器。
 *
 * 官方实现注册的 `deepseekAccount` 是全局唯一 Service 名，新实例必须先让旧实例卸载才能注册，
 * 所以顺序只能是「先释放旧实例、再挂载新实例」，而"失败保留旧实例"只能靠用上一个地址重新挂载来实现。
 * 所有重挂请求串行化：并发的 settings watch 与显式 POST 只会真正换一次实例。
 *
 * @param options - 组合层绑定的读写、挂载与错误上报端口。
 * @returns 控制器；`apply` 永不 reject。
 */
export function createAccountOriginController(options: AccountOriginControllerOptions): AccountOriginController {
  let active: AccountPlatformInstance | undefined
  let mounted: { readonly origins: AccountOrigin, readonly fingerprint: string } | undefined
  let tail: Promise<void> = Promise.resolve()

  const retire = async (instance: AccountPlatformInstance): Promise<void> => {
    try {
      await instance.dispose()
    } catch (error) {
      // 卸载失败不阻断后续挂载；残留注册会由下一次 provide 冲突暴露，而不是静默吞掉。
      options.onError('official account platform disposal failed', error)
    }
  }

  const replace = async (next: AccountOrigin): Promise<void> => {
    const fingerprint = accountOriginFingerprint(next)
    if (fingerprint === mounted?.fingerprint) return
    const previous = mounted
    const retired = active
    active = undefined
    mounted = undefined
    if (retired !== undefined) await retire(retired)
    try {
      active = await options.mount(next)
      mounted = { origins: next, fingerprint }
    } catch (error) {
      options.onError(`official account platform rejected ${next.platformOrigin}; keeping the previous backend`, error)
      if (previous === undefined) return
      try {
        active = await options.mount(previous.origins)
        mounted = previous
      } catch (restoreError) {
        // 回滚也失败时账户页面保持不可用，但 bundle 其余部分必须照常运行。
        options.onError('official account platform rollback failed; the account page stays detached', restoreError)
      }
    }
  }

  const apply = (next: AccountOrigin): Promise<void> => {
    const run = tail.then(() => replace(next))
    tail = run.then(() => undefined, () => undefined)
    return run
  }

  return {
    read: () => options.read(),
    mountedFingerprint: () => mounted?.fingerprint ?? '',
    write: async (patch) => {
      // 路由在解析正文时已规范化地址；能到这里的补丁一定是可挂载的配置。
      await options.write(patch)
      await apply(options.read())
    },
    apply,
    async dispose() {
      await tail
      const retired = active
      active = undefined
      mounted = undefined
      if (retired !== undefined) await retire(retired)
    },
  }
}

const ACCOUNT_ORIGIN_PATH = '/enterprise/api/v1/local/account-origin'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const MAX_REQUEST_BODY_BYTES = 64 * 1024
/** 与 platform-client 同名的本地稳定码：地址在该 profile 上没有可持久化的 volatile 字段。 */
const SETTINGS_UNAVAILABLE_CODE = 'ENT_SETTINGS_UNAVAILABLE'

/** 与 platform-client 内部 helper 等价的 20 行小工具；两份私有实现好过为复用而反向依赖。 */
function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

/**
 * 结构判定「地址不可持久化」。组合层抛 platform-client 的稳定错误，
 * 这里只读 `code`，不为一个错误面反向依赖对方的类。
 *
 * @param error - 写入路径逃出来的异常。
 * @returns 是否应投影成 503 而不是 400。
 */
function settingsUnavailable(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { readonly code?: unknown }).code === SETTINGS_UNAVAILABLE_CODE
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_REQUEST_BODY_BYTES) throw new RangeError('request body is too large')
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/**
 * 在 Harness `ctx.webServer` 上注册账户后台地址的同源路由。
 *
 * 先算好响应体再写状态行：任一读取失败都只产生一次错误响应，
 * 不会出现半写响应，也不会有异常逃到 Cordis 顶层。
 * 用户输入问题与「该 profile 根本没有可持久化字段」是两件事：前者 400，
 * 后者沿用 platform-client 的稳定码返回 503。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 组合层提供的地址读写端口。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseAccountRoutes(
  webServer: WebServerRoutePort,
  port: AccountOriginPort,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ACCOUNT_ORIGIN_PATH,
    handler: async (request, response) => {
      let status = 200
      let body: unknown
      try {
        if (request.method === 'GET') {
          body = { data: { ...port.read(), defaults: ACCOUNT_ORIGIN_DEFAULTS } }
        } else if (request.method !== 'POST') {
          methodNotAllowed(response, 'GET, POST')
          return
        } else {
          const patch = parseAccountOriginPatch(await readJson(request))
          const mounted = port.mountedFingerprint()
          await port.write(patch)
          body = { data: { ...port.read(), remounted: port.mountedFingerprint() !== mounted } }
        }
      } catch (error) {
        if (settingsUnavailable(error)) {
          // 部署/组合层事实，不是用户输入问题；与 platform-client 的本地 API 同样报 503。
          status = 503
          body = { error: { code: SETTINGS_UNAVAILABLE_CODE } }
        } else {
          // 非法输入、超限正文与 settings 的其余拒绝收敛为同一个 400；本地 API 没有更细的错误面。
          status = 400
          body = { error: { code: 'ENT_INVALID_REQUEST' } }
        }
      }
      writeJson(response, status, body)
    },
  })
}
