/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与 `openSystemBrowser`（PKCE 登录用的同一条系统浏览器通道）
 * [OUTPUT]: 对外提供帮助站地址派生 `enterpriseHelpTarget`、同源路由 `registerEnterpriseHelpRoute`（POST 无正文，Host 自行派生地址并用系统浏览器打开）与路径常量 ENTERPRISE_HELP_LOCAL_PATH/ENTERPRISE_HELP_PATH
 * [POS]: bundle 的帮助中心出口层——浏览器拿不到也不该拿 URL：地址由 Host 按**自己配置的平台地址**加固定 `/help/` 派生，因此「严格 allowlist」不是一次字符串比较，而是根本没有可注入的输入；失败只投影 503 + 判定点日志，绝不让异常逃到 Cordis 顶层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/** 同源路径：与 `ui/local-api.ts` 的 `ENTERPRISE_HELP_OPEN_LOCAL_PATH` 逐字相同。 */
export const ENTERPRISE_HELP_LOCAL_PATH = '/enterprise/api/v1/local/help/open'

/** 帮助站在后台 nginx 上的挂载路径（与 API 文档同源、共用会话门禁）。 */
export const ENTERPRISE_HELP_PATH = '/help/'

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 与 usage-route 等价的 20 行小工具；三份私有实现好过为复用而反向依赖。 */
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

/**
 * 平台地址 → 帮助站地址（严格 allowlist 的唯一实现）。
 *
 * 只接受可解析的 http(s) origin 并拼上固定 `/help/`：畸形、未配置或非 http(s) 一律 undefined，
 * 调用方据此投影 503，**绝不**回落到硬编码域名或任意客户端输入。
 *
 * @param platformOrigin - Host 当前生效的平台地址（`platformOrigin` 配置引用的读数）。
 * @returns 帮助站绝对地址，或 undefined（不可打开）。
 */
export function enterpriseHelpTarget(platformOrigin: string | null | undefined): string | undefined {
  if (platformOrigin === null || platformOrigin === undefined || platformOrigin === '') return undefined
  let parsed: URL
  try {
    parsed = new URL(platformOrigin)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined
  return new URL(ENTERPRISE_HELP_PATH, parsed.origin).toString()
}

/** 系统浏览器交接端口；组合层传 `openSystemBrowser`，测试注入 spy。 */
export interface EnterpriseHelpBrowserPort {
  open(url: string, signal: AbortSignal): Promise<void>
}

/**
 * 在 Harness `ctx.webServer` 上注册帮助中心的同源路由。
 *
 * 语义：只有 POST 一种方法（其它方法 405 且不产生副作用）；请求**无正文、无参数**——地址由
 * `enterpriseHelpTarget(origin())` 派生，所以浏览器无法把这里变成任意 URL 的打开器；
 * 成功回 `{data:{opened:true}}`（浏览器只认 2xx，不解析正文）；平台地址不可用或系统浏览器
 * 交接失败一律投影 503 `ENT_PLATFORM_UNAVAILABLE` 并经 `onError` 留下判定点与原始 error。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param origin - 当前平台地址的读数（组合层传账户地址控制器的 read 投影）。
 * @param browser - 系统浏览器交接端口。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseHelpRoute(
  webServer: WebServerRoutePort,
  origin: () => string | undefined,
  browser: EnterpriseHelpBrowserPort,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_HELP_LOCAL_PATH,
    handler: async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      let status = 200
      let body: unknown
      try {
        const target = enterpriseHelpTarget(origin())
        if (target === undefined) {
          throw new Error('enterprise help target is unavailable: the platform origin is not configured')
        }
        // 客户端在交接途中断开（`response` 未写完就 close）时中止系统交接，避免留下半开的子进程；
        // 请求流自己的 'close' 在无正文 POST 上几乎立刻触发，所以判据只能是响应是否已写完。
        const abort = new AbortController()
        response.on('close', () => { if (!response.writableEnded) abort.abort() })
        await browser.open(target, abort.signal)
        body = { data: { opened: true } }
      } catch (error) {
        status = 503
        body = { error: { code: 'ENT_PLATFORM_UNAVAILABLE' } }
        onError?.(`enterprise help open projected to ${status}`
          + ` [operation=POST ${ENTERPRISE_HELP_LOCAL_PATH} step=system-browser-failed status=${status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
      writeJson(response, status, body)
    },
  })
}
