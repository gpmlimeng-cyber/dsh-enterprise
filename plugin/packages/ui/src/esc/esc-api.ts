/**
 * [INPUT]: 依赖本包 `local-api-decode` 的唯一错误类 `EnterpriseLocalApiError` 与 `esc-types` 的平台响应类型
 * [OUTPUT]: 对外提供 `createEnterpriseEscApi`（六个平台取数方法，签名与 NUWAX `services/{square,systemManage,workspace}` 里那六个函数**逐条同名同参**，外加一条信息性的 `escMockStatus` 与**六条委托出去**的本机只读方法 `installedSkills`/`discoveredSkills`/`selfInstalledSkills`/`thirdPartySkills`/`installThirdPartySkill`/`skills`/`browseSkillhubSkills`；第二参数是本机只读取数面 `EnterpriseEscLocalReads`）、
 *   路径常量 `ENTERPRISE_ESC_READ_LOCAL_PATH`、图片代理路径常量 `ENTERPRISE_ESC_IMAGE_LOCAL_PATH`、
 *   演示数据开关路径常量 `ENTERPRISE_ESC_MOCK_LOCAL_PATH`、
 *   图片地址改写器 `enterpriseEscImageSrc`、平台业务码归一器 `escPlatformErrorCode`/`escErrorCodeOf`、
 *   「本部署没有这个端点」的**面级**稳定码真源 `ESC_MISSING_ENDPOINT_CODES`，
 *   以及 `EnterpriseEscApi`/`EnterpriseEscMockStatus` 契约类型
 * [POS]: esc 页面的**浏览器取数面**——只打同源本机路由 `POST {前缀}/esc/read`，正文 `{path, params}`；
 *   ★**本刀（SkillHub 维度：单源浏览面）**：那一格**换掉了**：第四枚维度 `SkillHub` 的数据面从
 *     `onlineSearchSkills`（四源 fan-out、`q` 必填、响应带 `sources[]`）换成 `browseSkillhubSkills`
 *     （宿主那条**单源**只读路由 `/skills/skillhub`）。★**为什么换**：用户裁决「进页面自动显示」
 *     在旧那条上**表达不了**（没 `q` 整条 400），而"这一维只投影 `skillhub.cn`、另三源被界面侧丢掉"
 *     那笔已知浪费随之**整体消失**（单源面里没有别的源可滤，过滤留着就是一句永远为真的死代码）。
 *     ★**旧那枚 `onlineSearchSkills` 因本仓再无消费者已整格删除**（不留死代码）；★**它在本包里的那条
 *     取数通路 `local-api.ts` 的 `onlineSearchSkills` 一字未动**——「添加技能 → 在线搜索」那一面
 *     （`marketplace-entry.tsx`）仍在用它，那是应用商店的路径，用户明令不许动。
 *     仍是**委托**：同一个 `localReads`、同一份 `requestJson`、唯一一个严格解码器；`query` 由
 *     `local-api.ts` 的 `skillhubBrowseQuery` 那枚唯一构造器产出，本文件**不**拼查询串。
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
 *   ★**本刀（根因修复：已装清单永远读不到）**：`installedSkills` 从"自己 `fetch().json()` 再喂
 *   `decodeEnterpriseInstalledSkills`"改成**委托**注入的本机只读取数面 `EnterpriseEscLocalReads`
 *   （缺省即 `createEnterpriseLocalApi(fetcher)`，也就是 `local-api.ts` 那**唯一**一份
 *   `requestJson`）——旧写法把**整只信封** `{data:{skills:[…]}}` 交给了只认拆封体 `{skills:[…]}`
 *   的解码器，**必抛** `ENT_LOCAL_RESPONSE_INVALID`，故口径 47 起顶栏计数一直 `undefined`。
 *   本文件因此**不再** import 任何 `decodeEnterprise*`（"拆信封 + 翻错误码"全包只有一份实现）。
 *   ★**口径 54/55（本刀）**：`ESC_MISSING_ENDPOINT_CODES` 由四枚收成**三枚**（删 `enabled` —— 那枚码
 *     永远取不到）；`EnterpriseEscLocalReads` 由一格扩成**三格**（`installedSkills` / `selfInstalledSkills`
 *     / `discoveredSkills`，仍是结构性只读）；`EnterpriseEscApi` 新增 `discoveredSkills`（**「已安装」的
 *     真源** = 宿主官方发现面）与 `selfInstalledSkills`（**只作来源/元信息**）。★`publishedSkillEnableList`
 *     这个**取数方法**保留（页面已无消费方；它是平台面镜像的一格、宿主只读闭集里仍列着那条端点，
 *     单独删 ui 这一半会让两张表不再一一对应 —— 理由写在该方法自己的注释里）。
 *   ★**口径 62**：`EnterpriseEscLocalReads` 由三格扩成**五格**（加 `thirdPartySkills` /
 *     `installThirdPartySkill`），`EnterpriseEscApi` 同步新增这两枚方法——技能页第三枚维度
 *     「本地三方」（本地三方 Agent 技能源）的扫描与**复制安装**。★边界写清：那一格安装动作走的是
 *     **同一份 `requestJson` 委托**（正文只有一枚从上次响应里原样回传的不透明 `id`，浏览器提供不了
 *     任何新信息），与 `EnterpriseEscSkillPort` 那族"交文件字节 / 交包 id"的写入口**不是一回事**。
 *   ★**口径 53（本刀）**：`EnterpriseEscLocalReads` 再收一格 `skills`（`GET /skills`，
 *     `local-api.ts` 既有那一枚，"企业设置 → 技能"一直在用的同一个），`EnterpriseEscApi` 同步
 *     新增 `skills`——技能页**第四枚**维度「企业技能」的目录面。★**安装那一半不进这一面**：
 *     它走 `EnterpriseEscSkillPort.installSkill`（要动本机落盘与制品校验，是**写**），
 *     混进只读面会让"esc 只读"这条不变式名存实亡（边界见 `EnterpriseEscLocalReads` 那段的说明）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ENTERPRISE_ESC_RECOMMEND_PAGE_NO,
  ENTERPRISE_ESC_RECOMMEND_PAGE_SIZE,
  ENTERPRISE_ESC_RECOMMEND_PATH,
  ENTERPRISE_ESC_RECOMMEND_REC_TYPE,
  ENTERPRISE_ESC_RECOMMEND_TARGET_TYPE,
} from './esc-constants.js'
import { EnterpriseLocalApiError, type EnterpriseLocalApi } from '../local-api-decode.js'
import { createEnterpriseLocalApi } from '../local-api.js'
import type {
  EnterpriseDiscoveredSkills,
  EnterpriseInstalledSkill,
  EnterpriseRuntimeSkill,
  EnterpriseSelfInstalledSkill,
  EnterpriseSkillhubBrowse,
  EnterpriseThirdPartySkills,
} from '../skill-api-decode.js'
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
 * 缺的到底是连接器目录、还是这一类目录，只有**发起那次请求的那一面**知道。
 *
 * ★上一刀只有一条「`4040` ⇒ 连接器目录不存在」的映射，且**不看是哪个面**：于是专家 / 技能目录
 *   或精选行一旦也回 `4040`，界面对员工说的是「没有连接器目录」——那是一句**假话**。
 *   本刀把这句话交回给取数面自己。
 * ★**口径 55（用户裁决）**：这里原先还有第四枚 `enabled`（`ENT_ESC_ENABLE_LIST_UNAVAILABLE`）——
 *   它只为技能页那枚「我启用的」维度（`POST /api/published/skill/enable/list`）存在。
 *   维度整枚删除 ⇒ 本仓不会再有任何请求打到那条端点 ⇒ 留一枚"这一面缺的是启停清单"的码，
 *   就是在描述一个**本仓已经不存在的数据面**（一枚永远取不到的码）。故这一格连同
 *   `error-messages.ts` 里它那句人话一并删除。今天这里只剩**三枚**：连接器目录 / 这一类目录 / 推荐。
 *   ★`publishedSkillEnableList` 那个**取数方法**仍在（见 `EnterpriseEscApi` 里的说明）：
 *     端点镜像与"页面维度"是两件事，本刀删的是后者。
 */
export const ESC_MISSING_ENDPOINT_CODES = {
  /** 连接器列表（`GET /api/connector/providers`）。 */
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
  /**
   * 当前用户已启用的技能（`POST /api/published/skill/enable/list`，不带分页参数时全量返回）。
   *
   * ★**口径 55（用户裁决）之后，这一枚在页面里已经没有消费方**：技能页那枚「我启用的」维度
   *   整枚删除，而它是**唯一**的调用方。**为什么仍然留着**（这是判断，不是疏忽，请下一位读者照此复核）：
   *   · 它不是一个"不可达的分支"，而是 `EnterpriseEscApi` 这条**平台面镜像**的一格：宿主
   *     `bundle/src/esc-route.ts` 的只读闭集 `ENTERPRISE_ESC_READ_ENDPOINTS` 里**仍列着**
   *     `/api/published/skill/enable/list`（那是宿主侧的取数白名单，本刀明令不碰），
   *     ui 侧删掉这一格会让"浏览器能打的路径"与"宿主放行的路径"两张表**不再一一对应**；
   *   · 本刀删的是**页面维度**（"我启用的"这枚页签 + 它的取数分支），不是这个平台端点本身。
   *   ★因此它**不是第二真源**：没有任何界面路径会调它，也没有一枚码/一句文案引用它的失败。
   *   若 Lead 裁决要连端点镜像一起收掉，正确做法是**两侧同时**收（宿主闭集 + ui 这一格 +
   *   两条结构锁的清单），而不是只删 ui 这一半。
   */
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
   * ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：
   * 本机**官方发现面**快照（`GET /skills/discovered`）——「已安装」的**真源**。
   *
   * ★**为什么换真源**：老那两份记录（企业中心 `installed.json`、本机自装 `self-installed.json`）
   *   是**我们自己**写的账，它与磁盘真值**必然可能不一致**（真机取证：`~/.dsh/skills/` 上实有
   *   7 枚技能，而企业那份记录只认 1 枚）。"我装了哪些技能"这件事唯一有资格回答的是**官方自己的
   *   发现面**（`ctx.get('skills')`：运行时真正加载的那一份），故计数、子页、广场卡片三处都改读它。
   *   ★老两份记录**降级为来源/元信息**（版本号 / 校验和 / 卸载用的中心包 id），**不再作"是否已装"的判据**。
   * ★`complete: false` = 官方**还没发现完** ⇒ 界面如实说"还在发现中"，**不许当 0、不许写死数字**。
   *   读不到（非 2xx / 解码失败）仍走三态纪律：`installedCount` 留 `undefined` + `installedCountFailed`。
   */
  discoveredSkills(signal?: AbortSignal | undefined): Promise<EnterpriseDiscoveredSkills>
  /**
   * ★**口径 54**：本机**自装清单**（`GET /skills/self-installed`）——**只作元信息**用。
   *
   * 它**不再**参与"是否已装"的判定（那是上一条发现面的事）。子页读它只为说出这条记录里的
   * **版本/摘要/落盘时刻/原始文件名**（`sha256`/`names`/`installedAt`/`sourceInput`），
   * 以及"这枚是不是本机导入的那一枚"。
   * ★它与写入口 `EnterpriseEscSkillPort.selfInstalledSkills` 是**同一份实现**（同一个
   *   `local-api.ts` 的函数）：这里进只读面是为了让子页的**三份读**（发现面 + 两份元信息）
   *   都从这条结构性只读的 `api` 走，写入口那一侧只管写与"导入后念名字"。
   */
  selfInstalledSkills(signal?: AbortSignal | undefined): Promise<readonly EnterpriseSelfInstalledSkill[]>
  /**
   * ★**口径 62（本刀）**：**本地三方 Agent 技能源**的扫描（`GET /skills/third-party`）——本页第三枚
   *   维度「本地三方」的内容区就铺它。
   *
   * ★它与上面那三格**不是同一族事实**：那三格答的是"**我这台 DSH** 里装了什么"（企业记录 / 自装记录 /
   *   官方发现面），这一格答的是"**别人家的 Agent CLI 库里**有什么、能不能复制进来"。
   *   两者唯一的交点是每条候选自己的 `status`（`installed` 就是"复制过来会撞上已有技能"），
   *   而这枚状态是**宿主算好的**——界面只翻译，绝不自己再算一遍。
   * ★它**没有 `path`**：宿主绝对路径不进浏览器（冻结契约 §3.2）。每条候选只带一枚不透明 `id`，
   *   界面在安装时把它原样回传（见下一条）。
   */
  thirdPartySkills(signal?: AbortSignal | undefined): Promise<EnterpriseThirdPartySkills>
  /**
   * ★**口径 62（本刀）**：把一条本地三方候选**复制**进本机 DSH 的技能根
   *   （`POST /skills/third-party/install`，正文关闭键集恰好 `{path}`）。
   *
   * ★`path` 只可能是 `thirdPartySkills()` 那次投影里给过的那枚 `id`——界面把它当**不透明值**
   *   原样回传（Host 侧再 `realpath` + 在本次候选集里逐字比对）。**界面绝不拼路径**：这条不变式
   *   在类型层就成立（响应形状里没有 path 可拼），门禁另有一条源码级反向锁盯着它。
   * ★响应（自装清单）**只用来念一句结果**，界面不拿它改状态：真值靠**重新扫描**（不乐观切换）。
   */
  installThirdPartySkill(path: string, signal?: AbortSignal | undefined): Promise<readonly EnterpriseSelfInstalledSkill[]>
  /**
   * ★**口径 53（本刀）**：**企业中心注册的技能包目录**（`GET /skills`）——技能页第四枚维度
   *   「企业技能」的**唯一**数据面。
   *
   * ★为什么它进这条**只读**面、而不是新造一条路由：`local-api.ts` 早就有这一枚
   *   （`skills`：同源 GET、严格解码 `decodeEnterpriseSkills`），「企业设置 → 技能」那一页
   *   一直在用它。本页只是**再读一次同一份**——两颗页面各读一次，比造第二份缓存更简单也更不会漂。
   * ★它与本面的 `discoveredSkills` **不是一件事**：那一格答的是"本机磁盘上真的装着什么"，
   *   这一格答的是"企业中心**发布了什么**、能不能装"；两件事的交点是每条的 `id`（= 已装清单的
   *   `packageId`），口径 53 的已装判定正是用这枚键**精确命中**。
   */
  skills(signal?: AbortSignal | undefined): Promise<readonly EnterpriseRuntimeSkill[]>
  /**
   * ★**本刀（SkillHub 浏览面）**：第四枚维度 `SkillHub` 的**唯一数据面**
   *   （`GET /skills/skillhub?q=&category=&sort=&page=`，只读、**单源**）。
   *
   * ★**它替掉的是上面那枚 `onlineSearchSkills`**（本刀已删）：那条是**四源 fan-out**、`q` **必填**、
   *   响应带 `sources[]` 的逐源状态 —— 「进页面自动显示」在它上面**表达不了**（没 `q` 就 400），
   *   而"这一维只投影 `skillhub.cn`、另三源被界面侧丢掉"那笔浪费也随之消失。
   * ★`query` 是**已经拼好的查询串**（由 `local-api.ts` 的 `skillhubBrowseQuery` 那枚唯一构造器产出）：
   *   本文件**不**拼查询串、不 `encodeURIComponent`、不决定"哪些键该出现" —— 那是那一处的职责。
   * ★**委托**，不是第二份实现：同一个 `localReads`、同一份 `requestJson`、同一个严格解码器。
   */
  browseSkillhubSkills(query: string, signal?: AbortSignal | undefined): Promise<EnterpriseSkillhubBrowse>
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
 * ★**本刀（根因修复）**：esc 页要用的**本机只读取数面**。
 *
 * 收 `.installedSkills` / `.selfInstalledSkills` / `.discoveredSkills` 三格 —— `escApi` 仍是
 * **结构性只读**的：本机的**写入口**（本地导入与卸载）走独立的 `EnterpriseEscSkillPort`
 * （见 `esc-types.ts`），一格都不许混进这一面。
 * ★它们的**唯一**合法实现是 `local-api.ts` 造出来的那一份（同一个 `requestJson`）：拆 `{data}` 信封、
 *   错误信封翻 `EnterpriseLocalApiError`、非 JSON / 非 2xx / 空体各有处置 —— 那些事**只有一处实现**。
 * ★**口径 54**：新增的 `discoveredSkills` 是「已安装」的**真源**；`installedSkills` 与
 *   `selfInstalledSkills` 降级为**来源/元信息**（版本号 / 校验和 / 卸载用的中心包 id）。
 *   ★`selfInstalledSkills` 进这一面之后，esc 的两条只读真源（发现面 + 两份元信息）走的是
 *   **同一条** `requestJson`，不再有"从哪读"的分叉（写入口仍只在 `EnterpriseEscSkillPort`）。
 * ★**口径 62（本刀）**：再收两格 `thirdPartySkills` / `installThirdPartySkill`——第三枚维度
 *   「本地三方」的扫描与**复制安装**。★这里第一次出现"只读面里带一个**写**动作"的形态，
 *   故把边界写清：它**不是** `EnterpriseEscSkillPort` 那种"本机导入/卸载"写入口（那条要求浏览器
 *   交上文件字节或包 id），而是**同一条只读路由族里的一个动作**（正文只有一枚从上次响应里
 *   原样回传的不透明 `id`，浏览器提供不了任何新信息、也拼不出任何路径）。它与既有通路二
 *   （`system-search`/`adopt`）**语义不同**：那条是"只登记"，这条是"复制进来"。
 * ★**口径 53（本刀）**：再收一格 `skills`——技能页第四枚维度「企业技能」的目录面
 *   （`GET /skills`，`local-api.ts` 既有那一枚，"企业设置 → 技能"一直在用的同一个）。
 *   ★相应地：**安装**那一半`installSkill`**不进**这一面 —— 它走 `EnterpriseEscSkillPort`
 *     （见 `esc-types.ts`）：那是一条**写**（要动本机落盘与制品校验），与 `thirdPartySkills` 那条
 *     "只回传一枚不透明 id"的动作**不是一回事**，混进只读面会让"esc 只读"这条不变式名存实亡。
 */
export type EnterpriseEscLocalReads = Pick<
  EnterpriseLocalApi,
  'installedSkills' | 'selfInstalledSkills' | 'discoveredSkills' | 'thirdPartySkills' | 'installThirdPartySkill' | 'skills' | 'browseSkillhubSkills'
>

/**
 * 造一份 esc 取数面。
 *
 * @param fetcher - 浏览器 `fetch`（测试注入假实现；页面侧从不让调用方指定 origin 或请求头）。
 * @param localReads - 本机只读取数面（`local-api.ts` 那一份）。**缺省**就用同一只 `fetcher` 现造一份
 *   `createEnterpriseLocalApi(fetcher)` —— 缺省之所以**不是**"自己拆信封"，是因为那正是本刀要修掉的那个
 *   bug 的形状：同一件事一旦有第二份实现，就一定会漂（口径 47 起已装清单永远读不到就是这条缝）。
 */
export function createEnterpriseEscApi(
  fetcher: typeof fetch,
  localReads: EnterpriseEscLocalReads = createEnterpriseLocalApi(fetcher),
): EnterpriseEscApi {
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
    /**
     * ★**本刀（根因修复）**：已装技能清单 —— **原样委托**给注入进来的本机只读取数面
     * （`local-api.ts` 的 `installedSkills`，走那唯一的 `requestJson`）。
     *
     * ★口径 47 起这里写的是 `decodeEnterpriseInstalledSkills(await (await fetcher(url)).json())`：
     *   `fetcher` 回的是**整只**本机信封 `{data:{skills:[…]}}`，而那个解码器要的是**拆封后的**
     *   `{skills:[…]}`（判据 `hasExactKeys(row,['skills'])`）⇒ **必抛** `ENT_LOCAL_RESPONSE_INVALID`
     *   ⇒ 顶栏计数**从那天起就没读到过**（真机上那枚 `？` 指的就是这件事，而不是"服务读不到"）。
     *   两条腿（企业已装、本机自装）都吞进同一个 `catch`，所以一直没人发现 —— 教训是
     *   **不许有第二套"拆信封 + 翻错误码"**：故这里不再自己碰 `.json()`，连 `decodeEnterprise*`
     *   都不 import（门禁有源码级反向锁盯住这一点，见 `tests/esc.spec.ts` 的取数面那组）。
     * ★`signal` 可缺（与 `EnterpriseEscApi` 其余方法同形）：缺席即"不可取消"，
     *   给一枚永不 abort 的 signal 与 `fetch` 自己的语义等价。
     */
    installedSkills: async signal =>
      localReads.installedSkills(signal ?? new AbortController().signal),
    /**
     * ★**口径 54**：本机官方发现面 —— 与上一条**同一份委托**（同一个 `localReads`、同一个
     * `requestJson`、同一套错误码），只是读的是**另一条**同源路由。
     *
     * ★它是「已安装」的**真源**（见 `EnterpriseEscApi.discoveredSkills` 的说明）。
     *   两份老记录仍读（`installedSkills` / `selfInstalledSkills`），但**只用于来源/元信息**。
     */
    discoveredSkills: async signal =>
      localReads.discoveredSkills(signal ?? new AbortController().signal),
    /**
     * ★**口径 54**：本机自装清单 —— 与上面两条同一份委托。
     *
     * ★它**不再**参与"是否已装"的判定（那是发现面的事），只贡献**元信息**：这条记录里有
     *   `sha256`（制品摘要）、`names`（包内技能目录名）、`installedAt`（落盘时刻）与
     *   `sourceInput`（用户原始文件名）⇒ 子页据此说清"这枚是本机导入的、摘要是 …"。
     */
    selfInstalledSkills: async signal =>
      localReads.selfInstalledSkills(signal ?? new AbortController().signal),
    /**
     * ★**口径 62（本刀）**：本地三方扫描与复制安装 —— 与上面三格**同一份委托**（同一个
     * `localReads`，也就是 `local-api.ts` 那唯一一份 `requestJson`）。
     *
     * 为什么连"安装"这个动作也走这条只读面：它**不携带任何浏览器侧的新信息**（正文只有一枚
     * 从上次响应里原样回传的不透明 `id`），与 `EnterpriseEscSkillPort` 那族"浏览器交文件字节 /
     * 交包 id"的写入口不是一回事 —— 后者要动本机落盘与制品校验，故仍留在独立端口上。
     * `signal` 缺席时给一枚不会被 abort 的信号（与上面三格逐字同一行写法）。
     */
    thirdPartySkills: async signal =>
      localReads.thirdPartySkills(signal ?? new AbortController().signal),
    installThirdPartySkill: async (path, signal) =>
      localReads.installThirdPartySkill(path, signal ?? new AbortController().signal),
    /**
     * ★**口径 53（本刀）**：企业技能目录（`GET /skills`）—— 与上面几格**同一份委托**
     *   （同一个 `localReads`，也就是 `local-api.ts` 那唯一一份 `requestJson` + 严格解码器）。
     *
     * ★为什么是"委托"而不是在这里 `fetch().json()`：口径 47 那个 bug 的**全部教训**就是
     *   "同一件事的第二份实现必然漂"——这一条读的是同一份信封、同一个解码器，故一行都不许自己拆。
     */
    skills: async signal => localReads.skills(signal ?? new AbortController().signal),
    /**
     * ★**本刀 ③**：在线搜索（`GET /skills/online-search?q=…`）—— 与上面几格**同一份委托**
     *   （同一个 `localReads`、同一个 `requestJson`、同一个严格解码器）。
     *
     * ★`query` **原样**交给 `local-api.ts`（编码那一件事只有一处实现：`encodeURIComponent` 在
     *   那条路径模板里），本文件不 trim、不改写、不拼查询串 —— 查询串是"用户输入"，
     *   凡是我们这一侧加工过一格，界面上"我搜的是什么"与"实际搜的是什么"就会分叉。
     */
    /**
     * ★**本刀**：SkillHub 浏览（`GET /skills/skillhub?q=&category=&sort=&page=`）—— 与上面几格
     *   **同一份委托**（同一个 `localReads`、同一个 `requestJson`、同一个严格解码器
     *   `decodeEnterpriseSkillhubBrowse`，**关闭键集**）。
     *
     * ★`query` **原样**交给 `local-api.ts`（拼串与编码那一件事只有它一处实现），本文件不加工一格。
     */
    browseSkillhubSkills: async (query, signal) =>
      localReads.browseSkillhubSkills(query, signal ?? new AbortController().signal),
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
