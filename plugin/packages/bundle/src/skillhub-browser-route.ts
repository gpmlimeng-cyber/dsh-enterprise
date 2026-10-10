/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、**唯一**的稳定码→状态码映射
 *   `enterpriseLocalErrorStatus` 与诊断串 `thrownErrorDiagnostics`，以及本包 `skillhub-browser.ts` 的
 *   `browseSkillhubCatalog` 与形状 `EnterpriseSkillhubBrowseRequest`/`EnterpriseSkillhubBrowse`
 * [OUTPUT]: 对外提供口径新增的**一条 exact 只读路由**注册器 `registerEnterpriseSkillhubBrowseRoute`、
 *   路径常量 `ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH`、端口形状 `EnterpriseSkillhubBrowsePort` 与失败投影
 *   `projectSkillhubBrowseFailure`（判定点 `browse-failed`）
 * [POS]: bundle 技能纵深里**与在线搜索并列的第二条技能面**的**本机 HTTP 面** —— 只读、免鉴权、**一个来源**
 *   （`skillhub.cn`）。注册成 **exact** sibling（引擎 `dsh-host-webserver` 是 exact / prefix 两张表、exact 整路径
 *   优先 ⇒ `skillhub` 不会被 `skill-route.ts` 那条 `/skills` prefix 当成包 id 判 400，与 `skill-third-party-route.ts`
 *   的 `third-party`、`skill-discovery.ts` 的 `discovered` 同一个坑、同一条解法）。
 *   ★**本层只做形状门禁 + 分派 + 投影**：取数、白名单、坐标收窄、分类缓存全在 `skillhub-browser.ts`
 *   （**不写第二套判定**）。
 *   ★**为什么新开一条而不是改既有 `/skills/online-search`**：那条是**四源 fan-out**、`q` **必填**、
 *   响应带 `sources[]` 的逐源 `ok`/`dropped`、「部分成功保留、全失败才 502」—— 「进页面自动显示」在它上面
 *   **表达不了**（没 `q` 就整条抛 `ENT_INVALID_REQUEST`），把它改成兼得就给另一条面塞进了「有哪些源」的响应语义
 *   （那是**跨包契约**，界面按同一份顺序渲染来源 chip）。⇒ **同一把尺、不同的一张脸**。
 *   ★**出厂纪律**：响应**从零构造**，宿主绝对路径与上游原始字段（`namespace`/`homepage`/`iconUrl`/`tags`/
 *   `labels`/`subCategories`/`claim_state`/`upstream_url` …）**一律不出厂**；响应键集**冻结**为
 *   `{skills, total?, categories?, page, hasMore}`。
 *   ★**失败绝不静默**：端口缺席 / 内核抛错 ⇒ 走 `enterpriseLocalErrorStatus`（`ENT_INVALID_REQUEST`→400、
 *   `ENT_SKILL_SOURCE_UNREACHABLE`→502），**绝不**回空列表（空列表 = 谎称「skillhub 没有技能」）。
 *   非 GET ⇒ 405 + `Allow: GET`，且**一次都不进端口**。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'
import {
  browseSkillhubCatalog,
  type EnterpriseSkillhubBrowse,
  type EnterpriseSkillhubBrowseRequest,
} from './skillhub-browser.js'

/**
 * 只读浏览的 exact 路由：`GET /enterprise/api/v1/local/skills/skillhub`。
 *
 * ★必须注册成 **exact**：`skill-route.ts` 持有 `/enterprise/api/v1/local/skills` 这条 prefix，
 * 而引擎 `match()` 是「exact 整路径优先、miss 后才取最长 prefix」⇒ 不注册 exact 的话 `skillhub`
 * 会被那条 prefix handler 当成包 id 去判 400。
 */
export const ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH = '/enterprise/api/v1/local/skills/skillhub'

/** 与既有本机技能路由同源：错误码只回显受控标识符，任意外字符串不进响应体。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 查询串形状上限（**只收这四枚**，多一枚/少一枚都 400 且**一次都不打上游**）。 */
const ALLOWED_QUERY_KEYS: readonly string[] = ['q', 'category', 'sort', 'page']

/**
 * 端口形状（由组合层绑定 `skillhub-browser.ts` 的真实内核）。
 *
 * ★形状故意最小：路由只负责「方法 + 查询键集 + 错误投影」，**语义全在内核那一份里**。
 * ★入参**原样转交**（四个键都可缺省 ⇒ 浏览模式），**不在这一层做形状判定**——
 * 形状判定在 `skillhub-browser.ts`，那里有真机读数支撑；这一层只挡「多一个查询键」这一种越界。
 */
export interface EnterpriseSkillhubBrowsePort {
  browse(request: EnterpriseSkillhubBrowseRequest): Promise<unknown>
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface SkillhubBrowseFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: 'browse-failed'
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

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/**
 * 失败投影的唯一判断点：状态码走 platform-client 的**唯一**那张表，响应体只回受控形状的稳定码；
 * 受控码之外一律回落 `ENT_SKILL_SOURCE_UNREACHABLE`（**绝不复述任意字符串**——那会把上游的自由文本
 * 或宿主路径泄进响应体）。
 *
 * ★**为什么回落是 502 那枚而不是 503**：上游读不到/形状读不懂是「**上游**这次没给到」，
 * 与既有在线搜索「全失败才 502」**同一判据**（`enterpriseLocalErrorStatus` 里它已钉成 502）。
 * 端口缺席也走这里 —— 那是本机装配问题，读起来同样是「这一面这次不可用、可重试」。
 *
 * @param error - 分派路径逃出来的异常。
 * @returns 状态码与响应体里的稳定码。
 */
export function projectSkillhubBrowseFailure(error: unknown): SkillhubBrowseFailureProjection {
  const code = errorCodeOf(error)
  const status = enterpriseLocalErrorStatus(error)
  return {
    status,
    code: status === 400
      ? 'ENT_INVALID_REQUEST'
      : code !== undefined && CODE_SHAPE.test(code) ? code : 'ENT_SKILL_SOURCE_UNREACHABLE',
    step: 'browse-failed',
  }
}

/**
 * 只读浏览的查询串判据：**键集恰好**是 `ALLOWED_QUERY_KEYS` 的子集（可缺省、可空串），
 * 值**原样转交**内核。
 *
 * ★**为什么只挡"多一个键"、不在这一层判值的形状**：值的形状（`sort` 三档 / `page` 1..20 / `q` 有界 /
 *   `category` 在表内）判定在 `skillhub-browser.ts`，那里才有真机读数；这一层只做**闭集**门禁 ——
 *   浏览器参数里多出 `foo=1`、`pageSize=9999` 这类我们**不打算实现**的能力时，在打上游之前就拒掉。
 * ★**同一枚键出现两次**（`?sort=a&sort=b`）也拒：`URLSearchParams.get` 只取第一个，第二个会被**静默忽略**
 *   —— 那是"用户以为生效了"的假象，必须 400。
 *
 * @param url - 请求 URL 的 `search` 部分。
 * @returns 转交内核的入参对象。
 * @throws {TypeError} 键集越界或重复（`enterpriseLocalErrorStatus` 判 **400**）。
 */
function requireQueryShape(request: IncomingMessage): EnterpriseSkillhubBrowseRequest {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const seen = new Set<string>()
  for (const [key] of url.searchParams) {
    if (!ALLOWED_QUERY_KEYS.includes(key)) throw new TypeError(`unexpected skillhub browse query key ${key}`)
    if (seen.has(key)) throw new TypeError(`duplicate skillhub browse query key ${key}`)
    seen.add(key)
  }
  const result: Record<string, string> = {}
  for (const key of ALLOWED_QUERY_KEYS) {
    // ★重复的 `?q=a&q=`：上面已按"键出现两次"拒，故这里 `get` 的第一个就是唯一的那一个。
    const value = url.searchParams.get(key)
    if (value !== null) result[key] = value
  }
  return result as EnterpriseSkillhubBrowseRequest
}

/**
 * 在 Harness `ctx.webServer` 上注册 SkillHub 维度的**一条 exact 只读路由**。
 *
 * 三条硬口径：① 非 GET ⇒ 405 + `Allow: GET`，**一次都不进端口**；② 查询键集越界/重复 ⇒ 400 + **一次都不打上游**；
 * ③ 端口缺席或抛错 ⇒ 经 `enterpriseLocalErrorStatus` 投影成明确状态码（500/502/503 视受控码而定），
 * **绝不**回空列表。异常一律在写状态行之前收敛成 `{error:{code}}`，绝不逃到 Cordis 顶层。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 组合层绑定的内核；缺席即本条路由 fail-closed（明确失败码，不是空列表）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销这条路由的 disposer。
 */
export function registerEnterpriseSkillhubBrowseRoute(
  webServer: WebServerRoutePort,
  port?: EnterpriseSkillhubBrowsePort | undefined,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      const operation = `GET ${ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH}`
      try {
        if (port === undefined) {
          throw Object.assign(new Error('the skillhub browse port is not wired'), { code: 'ENT_SKILL_SOURCE_UNREACHABLE' })
        }
        // ★形状门禁在**打上游之前**：键集越界 ⇒ 400 且 fetch 一次都不发生。
        const query = requireQueryShape(request)
        const value: EnterpriseSkillhubBrowse = await port.browse(query) as EnterpriseSkillhubBrowse
        writeJson(response, 200, { data: value })
      } catch (error) {
        const failure = projectSkillhubBrowseFailure(error)
        writeJson(response, failure.status, { error: { code: failure.code } })
        onError?.(`enterprise skillhub browse request projected to ${failure.status}`
          + ` [operation=${operation} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
    },
  })
}
