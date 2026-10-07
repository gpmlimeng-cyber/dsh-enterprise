/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与稳定码→HTTP 状态唯一映射 `enterpriseLocalErrorStatus`、本包 `./nuwax-auth.js` 的会话持有者与形状上限
 * [OUTPUT]: 对外提供 `registerEnterpriseNuwaxRoutes`（三条 exact 路由：`POST /nuwax/login`、`POST /nuwax/logout`、`GET /nuwax/status`）、三条路径常量与正文上限常量
 * [POS]: NUWAX 员工登录的**本机 HTTP 面**——只做「形状门禁 + 分派 + 投影」：认证语义全在 `nuwax-auth.ts`，本层不写第二套判定。
 *   ★安全红线（有测试锁）：响应体**只回** `{state, origin?, principal?, expiresAt?}`，**绝不回票据**（票据只在宿主进程里）；
 *   其中 `origin` 是部署配置决议出的 NUWAX **服务地址**（界面用它显示「登录到哪台」）——是**地址不是凭据**；
 *   错误体只回稳定码（`{error:{code}}`，与全仓本机路由同一形状），平台原文与口令都不外传。
 *   ★三条路径注册成 **exact**：形状与 `library/route.ts` 同一条纪律（引擎 `exact` 表整路径优先），
 *   且三条互不为前缀，不存在 prefix 抢路由的问题。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'
import {
  NUWAX_MAX_ACCOUNT_LENGTH,
  NUWAX_MAX_PASSWORD_LENGTH,
  type NuwaxAuthStatus,
  type NuwaxSessionHolder,
} from './nuwax-auth.js'

/** 本机 NUWAX 认证路由的公共前缀（三条 exact 路径都由它派生）。 */
export const ENTERPRISE_NUWAX_LOCAL_PREFIX = '/enterprise/api/v1/local/nuwax'

/** `POST`：用员工自己的 NUWAX 账号/口令登录。 */
export const ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH = `${ENTERPRISE_NUWAX_LOCAL_PREFIX}/login`

/** `POST`：丢弃宿主进程内的会话（无网络调用）。 */
export const ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH = `${ENTERPRISE_NUWAX_LOCAL_PREFIX}/logout`

/** `GET`：读当前登录态（**不含票据**）。 */
export const ENTERPRISE_NUWAX_STATUS_LOCAL_PATH = `${ENTERPRISE_NUWAX_LOCAL_PREFIX}/status`

/** 登录正文上限：只装 `{account, password}` 两个短字符串，256 KiB 是传输层的早退闸（与全仓 JSON 本机路由同一档）。 */
export const ENTERPRISE_NUWAX_MAX_BODY_BYTES = 256 * 1024

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 登录正文**关闭键集**：多一个键就拒（宁可 400，也不把没约定的字段当输入）。 */
const LOGIN_BODY_KEYS: readonly string[] = ['account', 'password']

/** 路由端口：会话持有者（唯一真源）+ 失败留痕。 */
export interface EnterpriseNuwaxRoutePort {
  /** 会话持有者；由组合层在 `apply()` 里造一次（进程内唯一）。 */
  readonly holder: NuwaxSessionHolder
  /** 失败留痕（操作名 / 判定点 / 原始 error）；不改变任何响应语义。 */
  readonly onError?: ((message: string, error: unknown) => void) | undefined
}

/**
 * 挂三条 NUWAX 认证路由。
 *
 * @param webServer - bundle 顶层注入的 `ctx.webServer` route port。
 * @param port - 见 {@link EnterpriseNuwaxRoutePort}。
 * @returns 注销函数（Cordis `ctx.effect` 的清理口）。
 */
export function registerEnterpriseNuwaxRoutes(
  webServer: WebServerRoutePort,
  port: EnterpriseNuwaxRoutePort,
): () => void {
  const report = (operation: string, error: unknown): void => {
    port.onError?.(`${operation} failed`, error)
  }
  const disposeLogin = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      try {
        const body = asRecord(await readJsonBody(request, ENTERPRISE_NUWAX_MAX_BODY_BYTES))
        requireClosedKeySet(body, LOGIN_BODY_KEYS)
        const account = requireBoundedString(body, 'account', NUWAX_MAX_ACCOUNT_LENGTH)
        const password = requireBoundedString(body, 'password', NUWAX_MAX_PASSWORD_LENGTH)
        const status = await port.holder.login(account, password)
        writeJson(response, 200, { data: project(port, status) })
      } catch (error) {
        report(`POST ${ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH}`, error)
        writeJson(response, enterpriseLocalErrorStatus(error), { error: { code: errorCode(error) } })
      }
    },
  })
  const disposeLogout = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH,
    handler: (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      // 无网络调用、无正文要求：登出就是丢掉进程内那一份会话（平台的登出会把别的端也踢下线，本刀不做）。
      try {
        port.holder.logout()
        writeJson(response, 200, { data: project(port, port.holder.status()) })
      } catch (error) {
        report(`POST ${ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH}`, error)
        writeJson(response, enterpriseLocalErrorStatus(error), { error: { code: errorCode(error) } })
      }
    },
  })
  const disposeStatus = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_NUWAX_STATUS_LOCAL_PATH,
    handler: (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      try {
        writeJson(response, 200, { data: project(port, port.holder.status()) })
      } catch (error) {
        report(`GET ${ENTERPRISE_NUWAX_STATUS_LOCAL_PATH}`, error)
        writeJson(response, enterpriseLocalErrorStatus(error), { error: { code: errorCode(error) } })
      }
    },
  })
  return () => {
    disposeStatus()
    disposeLogout()
    disposeLogin()
  }
}

/**
 * 响应投影：**登录态 + 服务地址**。
 *
 * ★`origin` = 部署配置决议出的 NUWAX **服务地址**（`DSHENT_NUWAX_ORIGIN`，缺配置时是企业默认值），
 * 界面用它显示「这次登录打到哪台」。它是**地址不是凭据**：票据、口令、Cookie 一个都不在这里。
 * ★配置被显式停用或形状非法时 `origin` 缺席（`serviceOrigin()` 回 `undefined`）——如实缺席，
 * 界面那边画占位，**绝不**编一个地址出来。
 */
function project(
  port: EnterpriseNuwaxRoutePort,
  status: NuwaxAuthStatus,
): NuwaxAuthStatus & { readonly origin?: string | undefined } {
  const origin = port.holder.serviceOrigin()
  return origin === undefined ? { ...status } : { ...status, origin }
}

/** 写一个 JSON 响应（与全仓本机路由同一形状：无缓存、UTF-8）。 */
function writeJson(response: ServerResponse, status: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  response.writeHead(status, {
    'content-type': JSON_CONTENT_TYPE,
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  })
  response.end(body)
}

/** 方法不符：405 + `Allow`（与全仓本机路由同判，异常体只回稳定码）。 */
function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

/** 有界读 JSON 正文：形状问题抛 `TypeError`→400、超限抛 `RangeError`→413（走同一张码→状态表）。 */
async function readJsonBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += bytes.byteLength
    if (total > limit) throw new RangeError('request body is too large')
    chunks.push(bytes)
  }
  if (total === 0) throw new TypeError('request body must be a JSON object')
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** 只认真对象（数组与 null 都不算）。 */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('request body must be a JSON object')
  }
  return value as Record<string, unknown>
}

/** 关闭键集门禁：出现约定外的键即拒（含 `__proto__` 这类会被原型链吃掉的怪名）。 */
function requireClosedKeySet(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw new TypeError(`unexpected field ${key}`)
  }
}

/** 取一个有界非空字符串字段（长度上限由调用方给：账号与口令各一条）。 */
function requireBoundedString(body: Record<string, unknown>, key: string, maxLength: number): string {
  const value = body[key]
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${key} must be a non-empty string`)
  if (value.length > maxLength) throw new TypeError(`${key} is longer than the limit`)
  return value
}

/** 从异常里取稳定码（只认字符串 `code`；取不到就交回 `ENT_INVALID_REQUEST`）。 */
function errorCode(error: unknown): string {
  const code: unknown = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.length > 0 ? code : 'ENT_INVALID_REQUEST'
}
