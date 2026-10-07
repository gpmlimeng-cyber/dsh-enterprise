/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与稳定码→HTTP 状态唯一映射 `enterpriseLocalErrorStatus`、本包 `./nuwax-auth.js` 的会话持有者（票据唯一来源）与 `resolveNuwaxOrigin`
 * [OUTPUT]: 对外提供 `registerEnterpriseEscReadRoute`（**三条** exact 路由：`POST …/esc/read` 只读取数 + `GET …/esc/image` 图片代理 + `GET …/esc/mock` 演示数据开关状态）、路径常量、上限常量、**只读端点闭集** `ENTERPRISE_ESC_READ_ENDPOINTS` 与**图片路径闭集** `ENTERPRISE_ESC_IMAGE_PATH_PREFIXES`
 * [POS]: 「专家·技能·连接器」页面的**宿主只读代理面**（口径 31）——浏览器只打同源本机路由，宿主带着**进程内那枚员工票据**去 NUWAX 取数，再把平台信封**原样**交回页面（原页面的取数口径因此一字不改）。
 *   ★只读是**结构性**的：闭集六个端点全是"读"，没有任何写端点；平台路径必须**逐字命中**闭集（不做前缀匹配），故本路由无法被拿去打平台别的接口。
 *   ★取数面的闸门**有先后**：① 部署配置 ⇒ ② 演示数据（口径 32，默认关，见 `esc-mock.ts`）⇒ ③ 会话。
 *   演示数据**排在会话之前**是有意的：它不来自平台，就不该要平台会话；而它**只在组合层注入了开关读取器、
 *   且读取器说开着时**才存在，故真实部署里这条分支默认走不到（端口不给 `mock` ⇒ 恒回 `absent`）。
 *   ★票据仍不出宿主：`cookie` 由宿主拼；响应里没有任何凭据字段，平台信封原样回。
 *   ★**图标与头像也要经这里**（本轮补）：平台交给页面的图片 URL **全是要票据的**——实测技能图标
 *   `…/api/logo/skill/<slug>` 无票据回 **HTTP 401**、头像 `…/api/f/local/...` 无票据回 **HTTP 200 + `{"code":"4010"}`**
 *   （专家图标那条带 `?ak=` 的能直接显示，属例外）。浏览器手里没有票据（票据只在宿主）⇒ 直连必破图。
 *   故新增 `GET …/esc/image?src=<平台绝对 URL>`：宿主带票据取字节再交给页面。
 *   ★它是本面**唯一形如"取一个调用方给的 URL"**的缝，故三道闸同时上：① `src` 必须与会话 origin **逐字同一台**；
 *   ② 路径必须落在两条前缀闭集内（`/api/logo/`、`/api/f/`）；③ 只回 `image/*`（平台回 JSON 时按业务码判：
 *   `4010` ⇒ 请重新登录，其余 ⇒ 协议错）。三条红线（不跟随重定向 / 有界读 / 全程超时）逐字照旧。
 *   ★**票据只发回签发它的那一台**：请求 origin 取自会话自身的 `origin`（登录时冻结），**不是**"按当前配置
 *   重新决议"——配置在登录之后被指到另一个域时，重新决议就等于把员工的票据交给第二个域（测试有锁）。
 *   ★部署配置闸门仍在本面：显式停用 / 形状非法 ⇒ 503（本机部署问题），它比"请先登录"更靠前。
 *   ★与另两个 HTTP 面的关系（这是**第三个面**，差异是刻意的）：`skill-online.ts` 是无凭据公开取数面；`nuwax-auth.ts` 的 `send` 是**登录面**——它把**所有** 4xx 折成 `ENT_NUWAX_REJECTED`（登录时 4xx 确实就是"平台拒绝"）。本面**不能**照抄那条判决：票据过期时平台回 401，如实说成"需要重新登录"才是对的下一步，折成"平台拒绝"会把用户引向死路。故本面自持状态判决（401→`ENT_AUTH_REQUIRED`、其余 4xx→`ENT_NUWAX_REJECTED`、5xx→`ENT_NUWAX_UNAVAILABLE`），而**三条红线逐字相同**：不跟随重定向（3xx 即协议错）、有界读正文、全程超时。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_ESC_MOCK_CATEGORY_PATH,
  ENTERPRISE_ESC_MOCK_ENDPOINTS,
  type EscMockSwitch,
  resolveEscMockPayload,
} from './esc-mock.js'
import { resolveNuwaxOrigin, type NuwaxSessionHolder } from './nuwax-auth.js'

/** 本机 esc 只读代理的公共前缀（路径常量由它派生）。 */
export const ENTERPRISE_ESC_LOCAL_PREFIX = '/enterprise/api/v1/local/esc'

/** `POST`：把一次**只读**平台取数代理出去（正文 `{path, params}`）。 */
export const ENTERPRISE_ESC_READ_LOCAL_PATH = `${ENTERPRISE_ESC_LOCAL_PREFIX}/read`

/** `GET`：把一张**平台图片**（资源图标 / 头像）代理回浏览器（查询参数 `src`）。 */
export const ENTERPRISE_ESC_IMAGE_LOCAL_PATH = `${ENTERPRISE_ESC_LOCAL_PREFIX}/image`

/**
 * `GET`：只读地报一句"演示数据开关开着没有"（界面据此挂那条「模拟数据」横幅）。
 *
 * ★它**不返回**开关文件的绝对路径：浏览器不需要知道本机文件在哪，只需要知道"现在看到的是不是演示数据"。
 */
export const ENTERPRISE_ESC_MOCK_LOCAL_PATH = `${ENTERPRISE_ESC_LOCAL_PREFIX}/mock`

/** 图片 `src` 的长度上限：它只是一枚 URL，2 KiB 足够（超限即 400，不把超长串读进 URL 解析）。 */
export const ENTERPRISE_ESC_MAX_IMAGE_URL_LENGTH = 2048

/** 图片响应上限：图标/头像本来只有几百 KiB；与 JSON 面同档的硬上限（声明超限即早退）。 */
export const ENTERPRISE_ESC_MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * 图片代理的路径**闭集**（前缀白名单，两条都是实测见过的家族）：
 *  · `/api/logo/`：资源图标（技能 `…/api/logo/skill/<slug>`）；
 *  · `/api/f/`：静态文件（头像与专家图标 `…/api/f/local/...`）。
 *
 * ★为什么不放成"任意 `/api/`"：这条路线**带着票据**去取，放开就等于"平台所有要登录的接口都成了浏览器的可读面"。
 * 与 `esc/read` 那条逐字闭集是同一条纪律：要加新家族，先想清楚那张图为什么必须经这里。
 */
export const ENTERPRISE_ESC_IMAGE_PATH_PREFIXES: readonly string[] = ['/api/logo/', '/api/f/']

/** 请求体上限：只装一个平台路径与一份扁平查询参数，64 KiB 是传输层早退闸。 */
export const ENTERPRISE_ESC_MAX_BODY_BYTES = 64 * 1024

/**
 * 平台响应上限：目录类接口可能上百条记录（连接器提供方带 `tags`/`authConfig` 摘要），
 * 故比登录面的 256 KiB 宽；**仍是硬上限**——平台回了个巨型正文一律判协议错，不把它读进内存。
 */
export const ENTERPRISE_ESC_MAX_RESPONSE_BYTES = 4 * 1024 * 1024

/** 单次取数超时：比登录面（15s）宽一点，目录页偶发慢查询不该被登录的档位卡住。 */
export const ENTERPRISE_ESC_REQUEST_TIMEOUT_MS = 20_000

/** 平台端点的方法（本面只认这两个：闭集里没有写语义的端点）。 */
export type EnterpriseEscPlatformMethod = 'GET' | 'POST'

/**
 * **只读端点闭集**：平台路径 → 该方法。
 *
 * 六条全部来自原页面 `useResourceList` / `useResourceCategories` 的取数点（逐字对齐 NUWAX `services/*` 里那六个函数）：
 *  · `GET /api/published/category/list`（二级分类字典）
 *  · `GET /api/space/list`（团队空间维度即空间列表）
 *  · `GET /api/connector/providers`（官方目录 / 空间维度 / 已连接的 / 我启用的，四个口径同一端点、参数不同）
 *  · `POST /api/published/agent/list`（专家：系统广场 + 团队空间）
 *  · `POST /api/published/skill/list`（技能：系统广场 + 团队空间）
 *  · `POST /api/published/skill/enable/list`（技能：我启用的）
 *
 * ★三条 `POST` 是**读语义**的端点（平台的查询接口用 POST 传查询体），闭集里没有任何一条会改平台状态——
 * 收藏、启用/停用、连接器建连/断开这些写动作本刀不做，故**不在**闭集里（想加就得先想清楚那次改动的后果）。
 *
 * ★**本刀新增第七条**（内容区那一行「精选技能」）：
 *  · `POST /api/system/display/recommend/list`（`recType=Official` + `targetType=Skill`）
 *
 *   证据来自 NUWAX 前端源码（`feat-2026.9.30`）：
 *   · 端点与服务函数：`src/pages/SystemManagement/RecommendManage/services/recomment.ts:52`
 *     `apiSystemGetDisplayRecommendList` → `POST /api/system/display/recommend/list`；
 *   · 「官方推荐」页的实调参数：`RecommendListPage/index.tsx:190-198`，即
 *     `{pageNo:1, pageSize:LIST_PAGE_SIZE, recType:'Official', targetType:<枚举>}`；
 *   · `Skill` 是官方推荐页**真实支持**的档位：`constants.ts:25-37` 的 `OFFICIAL_RECOMMEND_CONFIG`
 *     里含 `DisplayRecommendTargetTypeEnum.Skill`（枚举本体 `types/interfaces/displayRecommend.ts:13-20`）；
 *   · ★**平台成功码是 `'0000'`（字符串）**——`src/constants/codes.constants.ts:11`
 *     `export const SUCCESS_CODE = '0000'`。此前那份手写契约里写的 `"code": 0` 是**笔误**，
 *     本仓 `ESC_SUCCESS_CODE='0000'` 无需改动；本面不做成功判定（透传信封），故这一条只是记录。
 *
 *   ★**为什么它与前六条不是一回事**（这是接之前查实的事实，不是猜测）：这条是**管理端**接口
 *   （前端仅 `RecommendManage` 后台页在调，`/api/system/**` 且带 `@RequireResource` 权限注解），
 *   而前六条是**员工端**目录接口。两者同走本机路由、同用 NUWAX 会话票据，但**员工账号是否有
 *   `display_recommend_query` 权限未验** ⇒ 403 是可能的，界面必须如实出失败态而不是假装没有数据。
 */
export const ENTERPRISE_ESC_READ_ENDPOINTS: Readonly<Record<string, EnterpriseEscPlatformMethod>> = {
  '/api/system/display/recommend/list': 'POST',
  '/api/published/category/list': 'GET',
  '/api/space/list': 'GET',
  '/api/connector/providers': 'GET',
  '/api/published/agent/list': 'POST',
  '/api/published/skill/list': 'POST',
  '/api/published/skill/enable/list': 'POST',
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/**
 * 平台"未登录/会话过期"的业务码（实测：图片面在没票据时回 **HTTP 200 + `{"code":"4010"}`**）。
 * ★图片面与 JSON 面的判决**不能共用**：JSON 面平台回 HTTP 401，图片面回 200 + 业务码——
 * 只看 HTTP 状态就会把一张"未登录"的 JSON 当图片发给浏览器。
 */
const PLATFORM_UNAUTHORIZED_CODE = '4010'

/** 取数正文**关闭键集**：多一个键就拒（不把没约定的字段当输入）。 */
const READ_BODY_KEYS: readonly string[] = ['path', 'params']

/** 查询参数键数上限（原页面最多传 `page/pageSize/category/kw/targetType/targetSubType/official` 七个）。 */
const MAX_PARAM_KEYS = 32

/** 本机取数面的稳定码：上游是 NUWAX，故上游故障沿用 NUWAX 那族码；"没登录"用全仓既有的 `ENT_AUTH_REQUIRED`。 */
export type EnterpriseEscReadErrorCode =
  | 'ENT_AUTH_REQUIRED'
  | 'ENT_NUWAX_PROTOCOL'
  | 'ENT_NUWAX_UNAVAILABLE'
  | 'ENT_NUWAX_TIMEOUT'
  | 'ENT_NUWAX_REJECTED'

/** 只带稳定码的取数面异常（`enterpriseLocalErrorStatus` 只读 `.code`，与全仓同约定）。 */
class EscReadError extends Error {
  constructor(
    readonly code: EnterpriseEscReadErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'EscReadError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

/** 路由端口：会话持有者（票据唯一来源）+ 可注入的 `fetch`/配置/上限 + 失败留痕。 */
export interface EnterpriseEscReadRoutePort {
  /** 会话持有者；由组合层在 `apply()` 里造一次（进程内唯一，与登录面同一个实例）。 */
  readonly holder: NuwaxSessionHolder
  /** 平台请求实现（默认宿主全局 `fetch`；测试注入假实现）。 */
  readonly fetch?: ((input: string, init?: RequestInit) => Promise<Response>) | undefined
  /** NUWAX origin 的**配置**来源（默认 `process.env`）：只用来判"本能力是否开着"；真正的请求 origin 取自会话自身。 */
  readonly env?: Record<string, string | undefined> | undefined
  /** 覆盖单次取数超时（测试用）。 */
  readonly timeoutMs?: number | undefined
  /** 覆盖平台响应上限（测试用）。 */
  readonly maxBytes?: number | undefined
  /** 覆盖**图片**响应上限（测试用；未给时用 {@link ENTERPRISE_ESC_MAX_IMAGE_BYTES}）。 */
  readonly maxImageBytes?: number | undefined
  /**
   * 演示数据开关读取器（口径 32）。**不给就是没有演示数据**——由组合层（`index.ts`）注入真的读文件那只手。
   *
   * ★为什么做成注入而不是在这里直接读 `process.env`：这会是一条**取数面**上的行为开关，
   * 让"本机碰巧有个开关文件"能改变路由行为，是最难查的一类串台；显式注入后，
   * 只有组合层那一处能打开它，测试与其它调用方默认拿到"关"。
   */
  readonly mock?: (() => EscMockSwitch) | undefined
  /** 失败留痕（操作名 / 原始 error）；不改变任何响应语义。 */
  readonly onError?: ((message: string, error: unknown) => void) | undefined
}

/**
 * 挂 esc 的两条本机路由（**都挂在同一个注册入口上**，因为它们共用同一个会话持有者与同一套判决）。
 *
 * @param webServer - bundle 顶层注入的 `ctx.webServer` route port。
 * @param port - 见 {@link EnterpriseEscReadRoutePort}。
 * @returns 注销函数（Cordis `ctx.effect` 的清理口；两条一起撤）。
 */
export function registerEnterpriseEscReadRoute(
  webServer: WebServerRoutePort,
  port: EnterpriseEscReadRoutePort,
): () => void {
  const disposeRead = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_ESC_READ_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      try {
        const body = asRecord(await readJsonBody(request, ENTERPRISE_ESC_MAX_BODY_BYTES))
        requireClosedKeySet(body, READ_BODY_KEYS)
        const endpoint = requireEndpoint(body)
        const params = readParams(body)
        // ① 部署配置闸门：显式停用 / 形状非法 ⇒ 503（**本机部署问题**，比"请先登录"更靠前的那一条事实）
        resolveNuwaxOrigin(port.env ?? process.env)
        // ② 演示数据闸门（口径 32；**默认关**，只有组合层注入了开关读取器、且它说开着才进得来）：
        //    开则只服务被模拟的那三个端点，且**比会话闸门更靠前**——演示数据不来自平台，
        //    自然也不需要平台会话（于是"没登录也能看连接器这一栏长什么样"）。
        //    响应多一枚 `mock: true`（页面的解码只读 `data`，多这一格不影响任何既有判据）。
        const mock = readMockSwitch(port)
        if (mock.enabled) {
          const payload = resolveEscMockPayload(endpoint, params)
          if (payload !== undefined) {
            // ★分类树是**拼装**、不是替换（口径 34）：平台真树（`Agent` 7 个子分类 / `Skill` 12 个 ……）
            //   + 演示补的 `Connector` 一根（平台没有连接器域，连接器栏的二级分类只能靠它）。
            //   真树取不到（没会话 / 平台拒绝 / 超时 / 形状不是数组）⇒ 退回"只有 Connector"那一棵，
            //   并把失败交给 `onError` 记一笔（不静默吞掉；这条兜底本身也不是平台数据，信封上带 `mock: true`）。
            if (endpoint === ENTERPRISE_ESC_MOCK_CATEGORY_PATH) {
              const merged = await mergeMockCategoryTree(port, payload)
              if (merged !== undefined) {
                writeJson(response, 200, { data: merged, mock: true })
                return
              }
            }
            writeJson(response, 200, { data: payload, mock: true })
            return
          }
        }
        // ③ 会话闸门：没登录就**必须**说"请先登录"，而不是替用户打一趟平台（那趟必然 401，
        //    还会把"没登录"说成"平台拒绝"）
        const session = port.holder.current()
        if (session === undefined) {
          throw new EscReadError('ENT_AUTH_REQUIRED', 'no NUWAX session in this process')
        }
        // ④ 请求 origin 取自**会话自己**（签发这枚票据的那一台）——绝不按当前配置重新决议：
        //    配置若在登录之后被指到另一个域，重新决议就是把员工的票据交给第二个域。
        const payload = await fetchPlatformEnvelope({
          fetchImpl: port.fetch ?? defaultFetch(),
          origin: session.origin,
          endpoint,
          params,
          ticket: session.ticket,
          timeoutMs: port.timeoutMs ?? ENTERPRISE_ESC_REQUEST_TIMEOUT_MS,
          maxBytes: port.maxBytes ?? ENTERPRISE_ESC_MAX_RESPONSE_BYTES,
        })
        writeJson(response, 200, { data: payload })
      } catch (error) {
        port.onError?.(`POST ${ENTERPRISE_ESC_READ_LOCAL_PATH} failed`, error)
        writeJson(response, enterpriseLocalErrorStatus(error), { error: { code: errorCode(error) } })
      }
    },
  })
  const disposeImage = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_ESC_IMAGE_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      try {
        // 两道闸与取数面逐字相同：部署配置 ⇒ 会话。图片是"页面上的皮"，更不该绕过登录态。
        resolveNuwaxOrigin(port.env ?? process.env)
        const session = port.holder.current()
        if (session === undefined) {
          throw new EscReadError('ENT_AUTH_REQUIRED', 'no NUWAX session in this process')
        }
        const target = requireImageTarget(request, session.origin)
        const image = await fetchPlatformImage({
          fetchImpl: port.fetch ?? defaultFetch(),
          target,
          ticket: session.ticket,
          timeoutMs: port.timeoutMs ?? ENTERPRISE_ESC_REQUEST_TIMEOUT_MS,
          maxBytes: port.maxImageBytes ?? ENTERPRISE_ESC_MAX_IMAGE_BYTES,
        })
        writeImage(response, image)
      } catch (error) {
        port.onError?.(`GET ${ENTERPRISE_ESC_IMAGE_LOCAL_PATH} failed`, error)
        writeJson(response, enterpriseLocalErrorStatus(error), { error: { code: errorCode(error) } })
      }
    },
  })
  const disposeMock = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_ESC_MOCK_LOCAL_PATH,
    handler: (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      // 开关状态是**只读事实**（不查会话、不碰平台、也不因为开关坏了而报错）：
      // 页面拿它决定挂不挂那条「模拟数据」横幅；挂不上最多是横幅不出现，绝不影响取数。
      const mock = readMockSwitch(port)
      writeJson(response, 200, {
        data: mock.enabled
          ? { enabled: true, reason: 'enabled', endpoints: ENTERPRISE_ESC_MOCK_ENDPOINTS }
          : { enabled: false, reason: mock.reason, endpoints: [] },
      })
    },
  })
  return () => {
    disposeRead()
    disposeImage()
    disposeMock()
  }
}

/** 宿主全局 `fetch`（只在真要发请求时取；测试可经 port 覆盖）。 */
function defaultFetch(): (input: string, init?: RequestInit) => Promise<Response> {
  return (input, init) => fetch(input, init)
}

/**
 * 读演示数据开关（口径 32）。
 *
 * ★端口**没注入读取器**时恒回 `{enabled:false, reason:'absent'}`——"这台部署没有配演示数据"这个判定结果，
 * 不是"读不到文件的默认值"：路由这一层不该知道开关存在哪儿，那是组合层的事实。
 */
function readMockSwitch(port: EnterpriseEscReadRoutePort): EscMockSwitch {
  return port.mock?.() ?? { enabled: false, reason: 'absent' }
}

/** 一次平台取数的入参（已过形状门禁）。 */
/**
 * 把演示补的 `Connector` 根**拼进平台真树**（口径 34；只在演示开关开着时走这条路）。
 *
 * 平台 3.0.2 没有连接器域 ⇒ 真树里没有 `Connector` 根，而连接器栏的二级分类按 `key === 'Connector'`
 * 取子节点；反过来，真树里的 `Agent`（本机 7 个子分类）/`Skill`（12 个）两棵才是专家/技能两栏该用的东西。
 * 于是这里**只补一根**、不整棵替换 —— 用户裁决「补上专家的官方」在分类这一格上的落实。
 *
 * @returns 拼好的平台信封；没会话 / 取不到 / 形状不对 ⇒ `undefined`（调用方退回演示那一棵，并把失败交给 onError）。
 */
async function mergeMockCategoryTree(
  port: EnterpriseEscReadRoutePort,
  demo: unknown,
): Promise<unknown | undefined> {
  const session = port.holder.current()
  if (session === undefined) return undefined
  try {
    const real = await fetchPlatformEnvelope({
      fetchImpl: port.fetch ?? defaultFetch(),
      origin: session.origin,
      endpoint: ENTERPRISE_ESC_MOCK_CATEGORY_PATH,
      params: {},
      ticket: session.ticket,
      timeoutMs: port.timeoutMs ?? ENTERPRISE_ESC_REQUEST_TIMEOUT_MS,
      maxBytes: port.maxBytes ?? ENTERPRISE_ESC_MAX_RESPONSE_BYTES,
    })
    const realRoots = (real as { readonly data?: unknown } | undefined)?.data
    const demoRoots = (demo as { readonly data?: unknown } | undefined)?.data
    if (!Array.isArray(realRoots) || !Array.isArray(demoRoots)) return undefined
    // 幂等：平台哪天自己补上连接器域，就直接用平台那一棵，不再追加演示根。
    if (realRoots.some(root => (root as { readonly key?: unknown } | undefined)?.key === 'Connector')) return real
    return { ...(real as Record<string, unknown>), data: [...realRoots, ...demoRoots] }
  } catch (error) {
    port.onError?.('GET/POST esc/read (mock category tree merge) failed', error)
    return undefined
  }
}

interface PlatformFetchInput {
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly origin: string
  readonly endpoint: string
  readonly params: Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[]>>
  readonly ticket: string
  readonly timeoutMs: number
  readonly maxBytes: number
}

/**
 * 带票据打一趟平台**只读**端点，回平台信封（原样，不做投影）。
 *
 * 判决顺序固定：3xx 已在传输层判协议错 → 401 判"需要重新登录" → 5xx 判上游不可用 →
 * 其余非 2xx 判"平台拒绝" → 2xx 才解析信封（无 `code` 判协议错）。
 */
async function fetchPlatformEnvelope(input: PlatformFetchInput): Promise<unknown> {
  const method = ENTERPRISE_ESC_READ_ENDPOINTS[input.endpoint]
  if (method === undefined) {
    // 闭集已在入口判过，这里只是把"表里没有"变成编译期就看得见的穷尽检查
    throw new EscReadError('ENT_NUWAX_PROTOCOL', `endpoint ${input.endpoint} is not in the read-only set`)
  }
  const url = new URL(input.endpoint, input.origin)
  const init: RequestInit = {
    method,
    headers:
      method === 'GET'
        ? { accept: 'application/json', cookie: `ticket=${input.ticket}` }
        : {
            accept: 'application/json',
            'content-type': 'application/json',
            cookie: `ticket=${input.ticket}`,
          },
  }
  if (method === 'GET') {
    for (const [key, value] of Object.entries(input.params)) {
      if (Array.isArray(value)) {
        for (const each of value) url.searchParams.append(key, String(each))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  } else {
    init.body = JSON.stringify(input.params)
  }
  const { status, bytes } = await sendEscPlatformRequest(
    input.fetchImpl,
    url.toString(),
    init,
    input.timeoutMs,
    input.maxBytes,
  )
  if (status === 401) {
    throw new EscReadError('ENT_AUTH_REQUIRED', 'the platform rejected the ticket')
  }
  if (status >= 500) {
    throw new EscReadError('ENT_NUWAX_UNAVAILABLE', `the platform answered HTTP ${status}`)
  }
  if (status < 200 || status >= 300) {
    throw new EscReadError('ENT_NUWAX_REJECTED', `the platform answered HTTP ${status}`)
  }
  return parseEnvelope(bytes)
}

/**
 * 校验图片代理的 `src`（查询串键集**恰好** `{src}`）：必须与会话 origin 同一台、路径落在图片前缀闭集内。
 *
 * ★这三条是本面唯一"调用方给 URL"那条缝的闸门：origin 逐字相等 ⇒ 票据不会被带去第二个域；
 * 前缀闭集 ⇒ 这条路线不会变成"平台任意接口的可读面"。任何一条不满足都只是 400（形状问题），
 * 且**一次平台都不打**。
 */
function requireImageTarget(request: IncomingMessage, origin: string): string {
  const url = new URL(request.url ?? '/', 'http://dsh.invalid')
  const values = url.searchParams.getAll('src')
  if (values.length !== 1) throw new TypeError('src must appear exactly once')
  const raw = values[0] ?? ''
  if (raw.length === 0 || raw.length > ENTERPRISE_ESC_MAX_IMAGE_URL_LENGTH) {
    throw new TypeError('src must be a non-empty URL within the length limit')
  }
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    throw new TypeError('src must be an absolute URL')
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new TypeError('src must be an absolute HTTP(S) URL')
  }
  if (target.username !== '' || target.password !== '') {
    throw new TypeError('src must not carry credentials')
  }
  if (target.origin !== origin) throw new TypeError('src must belong to the session origin')
  if (!ENTERPRISE_ESC_IMAGE_PATH_PREFIXES.some(prefix => target.pathname.startsWith(prefix))) {
    throw new TypeError('src path is not in the image path set')
  }
  return target.toString()
}

/** 一张取回来的图片（调用方已判过 `image/*`）。 */
interface PlatformImage {
  readonly bytes: Buffer
  readonly contentType: string
}

/** 图片取数入参（`origin` 不在里面：目标 URL 已在入口按会话 origin 校验过）。 */
interface PlatformImageInput {
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly target: string
  readonly ticket: string
  readonly timeoutMs: number
  readonly maxBytes: number
}

/**
 * 带票据取一张平台图片。
 *
 * ★与 JSON 面唯一的判决差异（**必须**）：图片面在未登录时平台回 **HTTP 200 + 业务码 `4010`**，
 * 所以先看 content-type——是 `image/*` 才回字节；不是图片就按业务码再判一次，`4010` 如实说成
 * "请重新登录"，其余判协议错。只按 HTTP 状态判，就会把一张"未登录"的 JSON 当图片发给浏览器。
 */
async function fetchPlatformImage(input: PlatformImageInput): Promise<PlatformImage> {
  const { status, bytes, contentType } = await sendEscPlatformRequest(
    input.fetchImpl,
    input.target,
    { method: 'GET', headers: { accept: 'image/*', cookie: `ticket=${input.ticket}` } },
    input.timeoutMs,
    input.maxBytes,
  )
  if (status === 401) {
    throw new EscReadError('ENT_AUTH_REQUIRED', 'the platform rejected the ticket')
  }
  if (status >= 500) {
    throw new EscReadError('ENT_NUWAX_UNAVAILABLE', `the platform answered HTTP ${status}`)
  }
  if (status < 200 || status >= 300) {
    throw new EscReadError('ENT_NUWAX_REJECTED', `the platform answered HTTP ${status}`)
  }
  const type = (contentType.split(';', 1)[0] ?? '').trim().toLowerCase()
  if (type.startsWith('image/')) return { bytes, contentType: type }
  if (platformCodeOf(bytes) === PLATFORM_UNAUTHORIZED_CODE) {
    throw new EscReadError('ENT_AUTH_REQUIRED', 'the platform answered an unauthenticated body instead of an image')
  }
  throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform answered a body that is not an image')
}

/** 从非图片正文里取业务码（只认 `{code}`；取不到交回 `undefined`）。 */
function platformCodeOf(bytes: Buffer): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown
  } catch {
    return undefined
  }
  const code = asRecordOrUndefined(parsed)?.['code']
  if (typeof code === 'string') return code
  return typeof code === 'number' && Number.isFinite(code) ? String(code) : undefined
}

/** 回一张图片：`image/*` 已在取数层判过；`nosniff` 防浏览器把非图片内容当图片解释。 */
function writeImage(response: ServerResponse, image: PlatformImage): void {
  response.writeHead(200, {
    'content-type': image.contentType,
    'content-length': String(image.bytes.byteLength),
    // 图标/头像换得很慢，但它们是**带登录态**取回来的 ⇒ 只允许浏览器私有缓存，不进任何共享缓存。
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
  })
  response.end(image.bytes)
}

/**
 * 发一次平台请求并读完正文（**只做机制、不做判决**）。
 *
 * 三条红线：不跟随重定向（3xx 即 `ENT_NUWAX_PROTOCOL`，凭据绝不交给第二个域）、
 * 有界读（声明超限即早退，读的过程中超限立刻放弃）、全程超时（超时与不可达分开）。
 */
async function sendEscPlatformRequest(
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ readonly status: number; readonly bytes: Buffer; readonly contentType: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetchImpl(url, { ...init, redirect: 'manual', signal: controller.signal })
    } catch (error) {
      throw transportError(error)
    }
    if (response.status >= 300 && response.status < 400) {
      await cancelBody(response)
      throw new EscReadError('ENT_NUWAX_PROTOCOL', `the platform redirected (HTTP ${response.status})`)
    }
    return {
      status: response.status,
      bytes: await readBoundedBytes(response, maxBytes),
      // 图片面要按 content-type 判"这到底是不是一张图"，故这里如实带上（JSON 面不看它）。
      contentType: response.headers.get('content-type') ?? '',
    }
  } finally {
    clearTimeout(timer)
  }
}

/** 有界读正文：声明超限即早退，读的过程中超限立刻放弃（不是读完整段再判）。 */
async function readBoundedBytes(response: Response, limit: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    await cancelBody(response)
    throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform response declares more bytes than the limit')
  }
  const body = response.body
  if (body === null) throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform answered without a body')
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    for (;;) {
      const step = await reader.read()
      if (step.done === true) break
      const chunk = step.value
      if (chunk === undefined) continue
      total += chunk.byteLength
      if (total > limit) {
        await reader.cancel().catch(() => undefined)
        throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform response is larger than the limit')
      }
      chunks.push(Buffer.from(chunk))
    }
  } catch (error) {
    if (error instanceof EscReadError) throw error
    throw transportError(error)
  }
  return Buffer.concat(chunks)
}

/** 把传输层异常收敛成稳定码（超时与不可达分开，界面给的下一步不同）。 */
function transportError(error: unknown): EscReadError {
  if (error instanceof EscReadError) return error
  if (isAbortError(error)) return new EscReadError('ENT_NUWAX_TIMEOUT', 'the platform request timed out', error)
  return new EscReadError('ENT_NUWAX_UNAVAILABLE', 'the platform request failed', error)
}

/** `AbortController.abort()` 在不同运行时抛 `AbortError`（名字固定）；只按名字判。 */
function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/** 主动放掉一个我们不读的正文（避免连接被吊住）；失败无所谓，绝不因此改判。 */
async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // 放不掉就算了：这条路径只发生在"我们已经决定拒绝"之后，取消失败不改变判决。
  }
}

/**
 * 解析平台信封并**原样**交出。
 *
 * ★这里与登录面的 `parseEnvelope` 刻意不同：登录面把信封**收窄**成 `{code, data}`（它只需要两格），
 * 而本面要的是"原页面的取数口径一字不改"——原页面读的是 `{code, message, data, success}` 整套
 * （`res?.code === SUCCESS_CODE` 判成功、`res?.message` 直接进提示）。故这里只做**最小**校验：
 * 必须是一个带 `code` 的 JSON 对象（否则判协议错），其余字段一律原样交给页面。
 */
function parseEnvelope(bytes: Buffer): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform answered a body that is not JSON', error)
  }
  const record = asRecordOrUndefined(parsed)
  if (record === undefined) {
    throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform answered a body that is not a JSON object')
  }
  const raw = record['code']
  const hasCode = typeof raw === 'string' || (typeof raw === 'number' && Number.isFinite(raw))
  if (!hasCode) {
    throw new EscReadError('ENT_NUWAX_PROTOCOL', 'the platform answered without a business code')
  }
  return record
}

/** 取平台路径：必须**逐字**命中闭集。 */
function requireEndpoint(body: Record<string, unknown>): string {
  const value = body['path']
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('path must be a non-empty string')
  }
  if (!Object.prototype.hasOwnProperty.call(ENTERPRISE_ESC_READ_ENDPOINTS, value)) {
    throw new TypeError('path is not in the read-only endpoint set')
  }
  return value
}

/**
 * 取查询参数：可缺席；在场必须是**扁平**对象（标量或标量数组）。
 *
 * 平台的查询体就是扁平的（`page/pageSize/category/kw/...`），故嵌套对象一律 400——
 * 那说明调用方想传的东西不在本面的契约里，宁可拒掉也不替它猜。
 */
function readParams(
  body: Record<string, unknown>,
): Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[]>> {
  const value = body['params']
  if (value === undefined) return {}
  const record = asRecord(value)
  const keys = Object.keys(record)
  if (keys.length > MAX_PARAM_KEYS) throw new RangeError('params has too many keys')
  const out: Record<string, string | number | boolean | readonly (string | number | boolean)[]> = {}
  for (const key of keys) {
    const each = record[key]
    if (typeof each === 'string' || typeof each === 'number' || typeof each === 'boolean') {
      out[key] = each
      continue
    }
    // 数组只收**同质标量**数组（团队维度「全部」页签的 `spaceIds` 就是数字数组，平台按重复查询参数收）
    if (
      Array.isArray(each) &&
      each.every(
        (item: unknown) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
      )
    ) {
      out[key] = each as readonly (string | number | boolean)[]
      continue
    }
    throw new TypeError(`params.${key} must be a scalar or a scalar array`)
  }
  return out
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

/** 方法不符：405 + `Allow`（与全仓本机路由同判）。 */
function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

/** 有界读 JSON 正文：形状问题抛 `TypeError`→400、超限抛 `RangeError`→413。 */
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
  const record = asRecordOrUndefined(value)
  if (record === undefined) throw new TypeError('request body must be a JSON object')
  return record
}

/** 只认真对象，但不是就回 `undefined`（给"解析平台信封"那条路径用：不合法要判协议错，不是 400）。 */
function asRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/** 关闭键集门禁：出现约定外的键即拒（含 `__proto__` 这类会被原型链吃掉的怪名）。 */
function requireClosedKeySet(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw new TypeError(`unexpected field ${key}`)
  }
}

/** 从异常里取稳定码（只认字符串 `code`；取不到就交回 `ENT_INVALID_REQUEST`）。 */
function errorCode(error: unknown): string {
  const code: unknown = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.length > 0 ? code : 'ENT_INVALID_REQUEST'
}
