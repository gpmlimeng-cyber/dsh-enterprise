/**
 * [INPUT]: 依赖本包 `local-api-decode` 的唯一错误类 `EnterpriseLocalApiError` 与 `esc-types` 的平台响应类型
 * [OUTPUT]: 对外提供 `createEnterpriseEscApi`（六个取数方法，签名与 NUWAX `services/{square,systemManage,workspace}` 里那六个函数**逐条同名同参**，外加一条信息性的 `escMockStatus`）、
 *   路径常量 `ENTERPRISE_ESC_READ_LOCAL_PATH`、图片代理路径常量 `ENTERPRISE_ESC_IMAGE_LOCAL_PATH`、
 *   演示数据开关路径常量 `ENTERPRISE_ESC_MOCK_LOCAL_PATH`、
 *   图片地址改写器 `enterpriseEscImageSrc`、平台业务码归一器 `escPlatformErrorCode`/`escErrorCodeOf`、
 *   「本部署没有这个端点」的**面级**稳定码真源 `ESC_MISSING_ENDPOINT_CODES`，
 *   以及 `EnterpriseEscApi`/`EnterpriseEscMockStatus` 契约类型
 * [POS]: esc 页面的**浏览器取数面**——只打同源本机路由 `POST {前缀}/esc/read`，正文 `{path, params}`；
 *   平台路径与方法由**宿主**的只读闭集裁决（浏览器这边连 URL 都拼不出来）。故原页面的取数逻辑
 *   （`useResourceList` 那套适配器）可以**一字不改**地移植过来，只是把 `apiXxx(...)` 的注入源从
 *   "NUWAX 那套 umi request"换成这里的六个同签名方法。
 *   ★为什么不复用 `local-api.ts` 的 `requestJson`：它是那个工厂内部私有的（只服务固定的那几条本机路径），
 *   而本面要的是"平台路径由调用方给、由宿主闭集裁决"这一条**通用取数**语义。两处共用的是
 *   `EnterpriseLocalApiError`（全包唯一错误类）与"同源固定前缀 + 只认 `{data}` 信封"这两条约定。
 *   ★回的是**平台信封本身**（`{code, message, data, success}`），不做本地投影：原页面读 `res.code`/`res.message`，
 *   投影掉任何一格都会让移植后的页面与原页面行为分叉。
 *   ★**图片不走这条面**：平台在信封里给的图标/头像 URL 是**绝对地址且要票据**（实测技能图标无票据回 HTTP 401、
 *   头像回 HTTP 200+`{"code":"4010"}`），而浏览器手里没有票据（票据只在宿主）——直连必破图。故另有一条
 *   `GET …/esc/image?src=<平台绝对 URL>` 由宿主带票据取字节，页面侧只用 `enterpriseEscImageSrc` 把地址换过去。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ENTERPRISE_ESC_RECOMMEND_PAGE_NO,
  ENTERPRISE_ESC_RECOMMEND_PAGE_SIZE,
  ENTERPRISE_ESC_RECOMMEND_PATH,
  ENTERPRISE_ESC_RECOMMEND_REC_TYPE,
  ENTERPRISE_ESC_RECOMMEND_TARGET_TYPE,
} from './esc-constants.js'
import { EnterpriseLocalApiError } from '../local-api-decode.js'
import { decodeEnterpriseInstalledSkills, type EnterpriseInstalledSkill } from '../skill-api-decode.js'
import type {
  EscCategoryNode,
  EscConnectorProvider,
  EscPage,
  EscPlatformEnvelope,
  EscPublishedItem,
  EscRecommendPage,
  EscRecommendTargetTypeEnum,
  EscRecommendType,
  EscSpace,
} from './esc-types.js'

/** 本机 esc 取数路由（相对前缀的路径字面量只出现一次；与宿主 exact 注册面逐字同值）。 */
export const ENTERPRISE_ESC_READ_LOCAL_PATH = '/esc/read'

/** 本机路由公共前缀（与 `local-api.ts` 同值：全包只有一份前缀约定）。 */
const LOCAL_API_PREFIX = '/enterprise/api/v1/local'

/** 本机 esc 图片代理路由（与宿主 exact 注册面逐字同值）。 */
export const ENTERPRISE_ESC_IMAGE_LOCAL_PATH = '/esc/image'

/** 本机 esc 演示数据开关状态路由（与宿主 exact 注册面逐字同值）。 */
export const ENTERPRISE_ESC_MOCK_LOCAL_PATH = '/esc/mock'

/**
 * 把平台给的**绝对图片 URL** 换成本机图片代理 URL（宿主带票据去取那张图）。
 *
 * ★为什么必须换：平台那几张图都要票据——技能图标 `…/api/logo/skill/<slug>` 无票据回 **HTTP 401**、
 * 头像 `…/api/f/local/...` 无票据回 **HTTP 200 + `{"code":"4010"}`**（实测）。浏览器手里没有票据，
 * 直连必然破图；换成本机代理后浏览器这一侧**始终不接触平台 origin**。
 * ★换不了的**如实返回 `undefined`**（空串、相对路径、非 http(s) 协议）：本页没有平台 origin，拼不出来就是拼不出来，
 * 不猜、不硬接一个域名上去——调用方据此画兜底图标/字母头像。
 * ★origin 与路径闭集的裁决在**宿主**（`requireImageTarget`），这边只是拼一个 URL，不做安全判断。
 */
export function enterpriseEscImageSrc(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined || raw.length === 0) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  return `${LOCAL_API_PREFIX}${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}?src=${encodeURIComponent(raw)}`
}

/**
 * 平台把「本部署没有这个端点」翻成的那枚业务码。
 *
 * 实测：打一个这台部署**不存在的路径**时，平台走到静态资源兜底，回 `code: '4040'` + 一句
 * `No static resource …`（首例是 `/api/connector/providers`）。
 */
export const ESC_PLATFORM_MISSING_ENDPOINT_CODE = '4040'

/**
 * **面级**稳定码真源：同一枚平台 `4040` 在不同的取数面上该说的话不同 ——
 * 缺的到底是连接器目录、这一类目录、还是推荐内容，只有**发起那次请求的那一面**知道。
 *
 * ★上一刀只有一条「`4040` ⇒ 连接器目录不存在」的映射，且**不看是哪个面**：于是专家 / 技能目录
 *   或精选行一旦也回 `4040`，界面对员工说的是「没有连接器目录」——那是一句**假话**。
 *   本刀把这句话交回给取数面自己（三枚码都在 `error-messages.ts` 那张唯一码表里）。
 */
export const ESC_MISSING_ENDPOINT_CODES = {
  /** 连接器列表（`GET /api/connector/providers`，实测这台部署缺它）。 */
  connector: 'ENT_ESC_CONNECTOR_UNAVAILABLE',
  /** 专家 / 技能目录（`POST /api/published/{agent,skill}/list`）。 */
  directory: 'ENT_ESC_DIRECTORY_UNAVAILABLE',
  /** 精选行（`POST /api/system/display/recommend/list`）。 */
  recommend: 'ENT_ESC_RECOMMEND_UNAVAILABLE',
} as const

/**
 * 平台业务码 → 界面用的稳定码（**只归一 `4040` 这一枚**，其余原样透传）。
 *
 * `missingEndpointCode` 由调用方按**自己的取数面**给（见 `ESC_MISSING_ENDPOINT_CODES`）。
 * 平台原话（`No static resource …`）**一律不上屏** —— 那是上游实现细节，员工读不出下一步；
 * 界面上只出「人话 + 稳定码」。
 */
export function escPlatformErrorCode(code: unknown, missingEndpointCode: string): string {
  const raw = String(code ?? '')
  return raw === ESC_PLATFORM_MISSING_ENDPOINT_CODE ? missingEndpointCode : raw
}

/**
 * 取异常里的稳定码（本机路由抛的 `EnterpriseLocalApiError` 带 `code`；取不到交回本机兜底码）。
 *
 * 与 `esc-list.ts` 原先那份私有实现同值 —— 本刀把它提到边界层，让列表与精选两处**共用一份**。
 */
export function escErrorCodeOf(error: unknown): string {
  const code: unknown = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.length > 0 ? code : 'ENT_LOCAL_RESPONSE_INVALID'
}

/** 单个查询参数值的形状（扁平标量或**同质标量数组**；团队维度「全部」页签就传数字数组 `spaceIds`）。 */
export type EnterpriseEscQueryParamValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | readonly boolean[]
  | undefined

/** 取数接口的请求参数：扁平标量或标量数组（与宿主闭集的形状门禁同一条契约）。 */
export type EnterpriseEscQueryParams = Readonly<Record<string, EnterpriseEscQueryParamValue>>

/** 连接器目录的查询参数（逐字对齐 NUWAX `ConnectorProviderPageParams`）。 */
export interface EnterpriseEscConnectorParams extends EnterpriseEscQueryParams {
  readonly spaceId?: number | string | undefined
  readonly pageNum?: number | undefined
  readonly pageSize?: number | undefined
  readonly scope?: string | undefined
  readonly status?: string | undefined
  readonly connected?: string | undefined
  readonly connectionEnabled?: string | undefined
  readonly keyword?: string | undefined
  readonly category?: string | undefined
}

/** 已发布列表的查询参数（逐字对齐 NUWAX `SquarePublishedListParams` 里原页面用到的那几格）。 */
export interface EnterpriseEscPublishedParams extends EnterpriseEscQueryParams {
  readonly page?: number | undefined
  readonly pageSize?: number | undefined
  readonly category?: string | undefined
  readonly kw?: string | undefined
  readonly targetType?: string | undefined
  readonly targetSubType?: string | undefined
  readonly official?: boolean | undefined
  readonly justReturnSpaceData?: boolean | undefined
  readonly spaceId?: number | undefined
  readonly spaceIds?: readonly number[] | undefined
}

/** esc 页面的六个取数方法（与原页面的 `apiXxx` 同名同参同返回形状）。 */
export interface EnterpriseEscApi {
  /** 广场分类树（`GET /api/published/category/list`）。 */
  publishedCategoryList(signal?: AbortSignal | undefined): Promise<EscPlatformEnvelope<readonly EscCategoryNode[]>>
  /** 当前用户空间列表（`GET /api/space/list`）。 */
  spaceList(signal?: AbortSignal | undefined): Promise<EscPlatformEnvelope<readonly EscSpace[]>>
  /** 已发布智能体列表（`POST /api/published/agent/list`）。 */
  publishedAgentList(
    params: EnterpriseEscPublishedParams,
    signal?: AbortSignal | undefined,
  ): Promise<EscPlatformEnvelope<EscPage<EscPublishedItem>>>
  /** 已发布技能列表（`POST /api/published/skill/list`）。 */
  publishedSkillList(
    params: EnterpriseEscPublishedParams,
    signal?: AbortSignal | undefined,
  ): Promise<EscPlatformEnvelope<EscPage<EscPublishedItem>>>
  /** 当前用户已启用的技能（`POST /api/published/skill/enable/list`，不带分页参数时全量返回）。 */
  publishedSkillEnableList(
    params: EnterpriseEscPublishedParams,
    signal?: AbortSignal | undefined,
  ): Promise<EscPlatformEnvelope<readonly EscPublishedItem[] | EscPage<EscPublishedItem>>>
  /** 连接器提供方目录（`GET /api/connector/providers`）。 */
  connectorProviderPageList(
    params: EnterpriseEscConnectorParams,
    signal?: AbortSignal | undefined,
  ): Promise<EscPlatformEnvelope<readonly EscConnectorProvider[] | EscPage<EscConnectorProvider>>>
  /**
   * 本机**演示数据**开关状态（`GET …/esc/mock`，口径 32）。
   *
   * ★它是**信息性**读取，故与上面六个取数方法有一条刻意不同的约定：**不抛**。读不到就回
   * `{enabled:false}`（横幅不出现），因为"横幅挂不上"绝不该把整页拖进失败态——它不是页面在取的数据。
   */
  escMockStatus(signal?: AbortSignal | undefined): Promise<EnterpriseEscMockStatus>
  /**
   * ★本刀补上（上一刀定义了 prop 却**没接线**，真机截图里「已安装」不带计数就是这个）：
   * 本机**已装技能清单**（`GET /skills/installed`，走本包既有的 `EnterpriseLocalApi` 那一族同源路由）。
   *
   * ★**不是新接口**：`skill-market.tsx` 早就在消费这份清单（安装/卸载后的真值也来自它），
   *   本页只是**再读一次同一份**——两个页面各读一次，比造第二份缓存更简单也更不会漂。
   *   同源、同样只读、同样不出浏览器。
   */
  installedSkills(signal?: AbortSignal | undefined): Promise<readonly EnterpriseInstalledSkill[]>
  /**
   * ★**本刀新增**：「精选技能」那一行的取数（`POST /api/system/display/recommend/list`，
   * `recType=Official` + `targetType=Skill`）。
   *
   * 与上面六个方法**同一套取数面**（同一条本机 `/esc/read` 路由、同一份关闭键集、同一枚
   * `EnterpriseLocalApiError`），所以它同样**失败必抛**：精选行读不到就该出失败态，
   * 不能悄悄画成「今天没有精选」。
   *
   * ★参数是**本方法自己封死**的（调用方只传 signal）：`pageNo`/`pageSize`/`recType`/`targetType`
   * 四格都由这里给定，页面**无法**改它们——避免「筛选条件由 UI 拼、拼错了没人知道」。
   */
  officialRecommended(
    targetType: EscRecommendTargetTypeEnum,
    signal?: AbortSignal | undefined,
  ): Promise<EscPlatformEnvelope<EscRecommendPage>>
}

/** 本机演示数据开关状态（`GET …/esc/mock` 的 `data`）。 */
export interface EnterpriseEscMockStatus {
  /** 开关是否打开（打开 ⇒ 页面顶部要挂「模拟数据」横幅）。 */
  readonly enabled: boolean
  /** 没打开的原因（`no-home`/`absent`/`unreadable`/`malformed`/`disabled`）；打开时是 `'enabled'`。 */
  readonly reason?: string | undefined
  /** 被模拟的平台路径（打开时非空）。 */
  readonly endpoints?: readonly string[] | undefined
}

/**
 * 造一份 esc 取数面。
 *
 * @param fetcher - 浏览器 `fetch`（测试注入假实现；页面侧从不让调用方指定 origin 或请求头）。
 */
export function createEnterpriseEscApi(fetcher: typeof fetch): EnterpriseEscApi {
  const read = async (
    path: string,
    params: EnterpriseEscQueryParams,
    signal?: AbortSignal | undefined,
  ): Promise<EscPlatformEnvelope<unknown>> => {
    const response = await fetcher(`${LOCAL_API_PREFIX}${ENTERPRISE_ESC_READ_LOCAL_PATH}`, {
      method: 'POST',
      // 关闭键集：恰好 `{path, params}`（宿主那边同样按关闭键集门禁，多一格即 400）
      body: JSON.stringify({ path, params: pruneUndefined(params) }),
      headers: { 'content-type': 'application/json' },
      ...(signal === undefined ? {} : { signal }),
    })
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
    }
    if (!response.ok) throw new EnterpriseLocalApiError(errorCodeOf(payload), response.status)
    const data = asEnvelopeData(payload)
    if (data === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
    if (!isPlatformEnvelope(data)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
    }
    return data
  }
  return {
    publishedCategoryList: async signal =>
      (await read('/api/published/category/list', {}, signal)) as EscPlatformEnvelope<readonly EscCategoryNode[]>,
    spaceList: async signal => (await read('/api/space/list', {}, signal)) as EscPlatformEnvelope<readonly EscSpace[]>,
    publishedAgentList: async (params, signal) =>
      (await read(
        '/api/published/agent/list',
        params,
        signal,
      )) as EscPlatformEnvelope<EscPage<EscPublishedItem>>,
    publishedSkillList: async (params, signal) =>
      (await read(
        '/api/published/skill/list',
        params,
        signal,
      )) as EscPlatformEnvelope<EscPage<EscPublishedItem>>,
    publishedSkillEnableList: async (params, signal) =>
      (await read(
        '/api/published/skill/enable/list',
        params,
        signal,
      )) as EscPlatformEnvelope<readonly EscPublishedItem[] | EscPage<EscPublishedItem>>,
    connectorProviderPageList: async (params, signal) =>
      (await read(
        '/api/connector/providers',
        params,
        signal,
      )) as EscPlatformEnvelope<readonly EscConnectorProvider[] | EscPage<EscConnectorProvider>>,
    escMockStatus: async signal => {
      // ★这里**是**唯一一处"失败即回默认值"，且是刻意的：开关状态不是页面在取的数据，读不到就是"没开"。
      //   与六个取数方法（失败必抛、由页面画失败态 + 重试）是两码事。
      try {
        const response = await fetcher(`${LOCAL_API_PREFIX}${ENTERPRISE_ESC_MOCK_LOCAL_PATH}`, {
          method: 'GET',
          ...(signal === undefined ? {} : { signal }),
        })
        if (!response.ok) return { enabled: false }
        const payload: unknown = await response.json()
        const data = asEnvelopeData(payload)
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return { enabled: false }
        const record = data as Record<string, unknown>
        const endpoints = record['endpoints']
        return {
          enabled: record['enabled'] === true,
          reason: typeof record['reason'] === 'string' ? record['reason'] : undefined,
          endpoints: Array.isArray(endpoints)
            ? endpoints.filter((each): each is string => typeof each === 'string')
            : undefined,
        }
      } catch {
        return { enabled: false }
      }
    },
    // ★本刀补上：已装技能清单。与 `local-api.ts` 里那一族同源路由同款（GET + 无正文 + 同一个解码器），
    //   形状自然逐字同形（都是那个**严格八键**的中心口径）。
    installedSkills: async signal =>
      decodeEnterpriseInstalledSkills(
        await (
          await fetcher('/enterprise/api/v1/local/skills/installed', {
            method: 'GET',
            ...(signal === undefined ? {} : { signal }),
          })
        ).json(),
      ),
    // ★「精选」那一行（用户裁决：专家页与技能页同一套逻辑，只有 targetType 不同）。
    //   pageNo/pageSize/recType 三格在本方法里封死；targetType 由调用方给（Agent / Skill 两档）。
    officialRecommended: async (targetType, signal) =>
      read(
        ENTERPRISE_ESC_RECOMMEND_PATH,
        {
          pageNo: ENTERPRISE_ESC_RECOMMEND_PAGE_NO,
          pageSize: ENTERPRISE_ESC_RECOMMEND_PAGE_SIZE,
          recType: ENTERPRISE_ESC_RECOMMEND_REC_TYPE,
          targetType,
        },
        signal,
      ) as Promise<EscPlatformEnvelope<EscRecommendPage>>,
  }
}

/** 去掉 `undefined` 的键：JSON 里本来就没有它，显式清掉让"缺席"这件事在两侧完全一致。 */
function pruneUndefined(params: EnterpriseEscQueryParams): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

/** 取本机信封的 `data`（只认对象/数组都在 `data` 里的那一层）。 */
function asEnvelopeData(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  return (payload as Record<string, unknown>)['data']
}

/** 平台信封判据：对象且带一个字符串/数字 `code`（与宿主出口处的判据同一条）。 */
function isPlatformEnvelope(value: unknown): value is EscPlatformEnvelope<unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const code = (value as Record<string, unknown>)['code']
  return typeof code === 'string' || typeof code === 'number'
}

/** 从本机错误体里取稳定码（只认 `{error:{code}}`；取不到交回兜底码）。 */
function errorCodeOf(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return 'ENT_LOCAL_RESPONSE_INVALID'
  const error = (payload as Record<string, unknown>)['error']
  if (typeof error !== 'object' || error === null) return 'ENT_LOCAL_RESPONSE_INVALID'
  const code = (error as Record<string, unknown>)['code']
  return typeof code === 'string' && code.length > 0 ? code : 'ENT_LOCAL_RESPONSE_INVALID'
}
