/**
 * [INPUT]: 依赖 `skill-online.ts` 的**四个出口**——`fetchOnlineJson`（薄包装既有 `fetchSearchJson`/`fetchWithinLimit`：同一份 SSRF 白名单、同一个 `AbortController`+`setTimeout`、同一条 `ONLINE_SEARCH_MAX_BYTES` 有界读、同一个 `ENT_SKILL_SOURCE_UNREACHABLE`）、`onlineFetchDeps`（依赖装配的只读出口）、`onlineCountOf`（「平台没说」vs「平台说 0」的那把尺）、`MAX_QUERY_LENGTH`（两条技能面共用的搜索串上限），以及 `skill-skillhub.ts` 的 `requireSkillhubParts`（坐标两段**唯一**的收窄判据）与 `skill-errors.ts` 的 `EnterpriseSkillInstallError`
 * [OUTPUT]: 对外提供 `browseSkillhubCatalog(options, request)`——SkillHub 维度的**只读浏览**内核，以及形状 `EnterpriseSkillhubBrowseRequest`/`EnterpriseSkillhubBrowse`/`EnterpriseSkillhubSkill`/`EnterpriseSkillhubCategory` 与五条上限常量 `SKILLHUB_BROWSE_PAGE_SIZE`/`SKILLHUB_BROWSE_MAX_PAGE`/`SKILLHUB_BROWSE_MAX_Q_LENGTH`/`SKILLHUB_BROWSE_SORTS`/`SKILLHUB_BROWSE_CATEGORY_TTL_MS`
 * [POS]: bundle 技能纵深里**与在线搜索并列的第二条技能面**——`skill-online.ts` 那条是「四源聚在一起按查询串搜」，
 *   本文件这条是「**只** skillhub.cn 一个来源、**进页面自动显示**（不搜也有内容）、下级用它自己的分类标签、
 *   **默认按下载量**」。★**为什么不改既有 `/skills/online-search` 而新开一条**：那条是**四源 fan-out**，
 *   `q` 是**必填**且四源**并发**、逐源 `ok`/`dropped` 如实上报、失败是「部分成功保留、全失败才 502」——
 *   「进页面自动显示」在它上面**表达不了**（没有 q 就整条抛 `ENT_INVALID_REQUEST`，没有浏览模式这个概念），
 *   把它改成兼得，就等于给另一条面引入「有哪些源、各源成没成」的响应语义，那是**跨包契约**（界面那一刀
 *   按同一份顺序渲染来源 chip）。★**为什么不共用响应形状**：那条的结果键是 `{sourceId,name,description?,author?,
 *   stars?,installs?,installSource}`（带 `sourceId` 因为四源可能给同一条技能），本条是**单源**（`sourceId` 恒定、
 *   对界面零信息量，且要额外产出 `total`/`categories`/`page`/`hasMore` 这四格分页与下级标签事实）⇒
 *   合并形状会让两条面**互相拖累**。⇒ **同一把尺、不同的一张脸**：取数、坐标收窄、计数判据、超时与字节上限
 *   全部复用既有实现（**零新增 HTTP 通道**：共用同一份注入 `fetch`；**零新增依赖**、零 exec/spawn）。
 *
 * ── 真机读数（2026-10-10，全部自己 curl 量过；这一段是本文件所有判据的出处） ──
 *  ① **进页面自动显示成立**：`GET https://api.skillhub.cn/api/skills?page=1&pageSize=100&sortBy=downloads`
 *     **不带 `keyword` 直接列**，`code=0`、`data.skills` 100 行、`data.total` = **188,534**（另一次读数 188,535，
 *     站点在长）⇒ 不传 `q` 就是浏览模式，不需要任何「空查询」回退。
 *  ② **`sortBy` 只认三档**：`downloads` / `installs` / `score`；`downloadCount`、`hot`、`newest`、`name` **全 400**
 *     （`{"code":400,"data":null,"message":"参数错误：..."}`）。★**三档顺序真的互不相同**（`pageSize=20` 前 6 条 slug 序列）：
 *     downloads = `dev-expert, parenting-expert, dev-expert, tencent-docs, self-improving-agent, find-skills`；
 *     installs  = `self-improving-agent, find-skills, self-improving, summarize, skill-vetter, agent-browser`；
 *     score     = `dev-expert, parenting-expert, dev-expert, tencent-docs, anti-fraud, multi-search-engine`。
 *     ⇒ 分档用例能锁住**真区分度**（三档两两不同），不是三份一样的顺序。★**不传 `sortBy` 上游也回 200**，
 *     但那是**它自己的**默认序、与三档都不同（实测 `duplicate-file-cleaner, architecture-decision-records,
 *     document-pdf, hot-topic-content-maker, …`）⇒ **必须显式传**，绝不靠上游默认。
 *  ③ **`pageSize` 上限 100**（上游原话 `参数错误：pageSize 超出范围（1~100）`；200/500/1000 全 400）；
 *     `page` 必须 ≥1（`0`/`-1`/`abc` 全 400，`参数错误：page 必须 >= 1`）。
 *     ★**`page=999999` 回 200 + `code=0` + `skills: []`**（`total` 仍是 188,535）⇒ ★**`hasMore` 只能按
 *     `page * pageSize < total` 自己算**，绝不能按「数组为空」判（那会把最后一页之后的空页与真正的尾页混成一件）。
 *  ④ **`category=` 是真过滤、不是装饰**：`dev-programming` → total **20,378**、`ai-agent` → **21,826**、
 *     `education` → **8,587**，三条样本里返回行的 `category` **全部等于**请求值。
 *     ★**不合法值上游回 400**（`参数错误：category 不合法`）⇒ 非法值**必须本地先拒、一次都不打上游**
 *     （否则就是拿一个用户能随手敲出来的串去打公网）。
 *     ★**`keyword` 与 `category` 能同时用**：`keyword=pdf` total=4,257（7 个分类）、再加
 *     `category=dev-programming` total=**126**（1 个分类）⇒ 两个筛选是**可组合**的，不是互斥。
 *  ⑤ **分类标签来自 `/api/v1/categories`**（`GET` → 200、1,632 B、`{count:13,items:[{key,name,nameEn,sortOrder,level,active}]}`）：
 *     真机 13 枚 —— `pay-skill`/`Pay Skill`(0)、`office-efficiency`/`办公效率`(10)、`content-creation`/`内容创作`(20)、
 *     `dev-programming`/`开发编程`(30)、`data-analysis`/`数据分析`(40)、`design-media`/`设计多媒体`(50)、
 *     `ai-agent`/`AI Agent`(60)、`knowledge-management`/`知识管理`(70)、`business-ops`/`商业运营`(80)、
 *     `education`/`教育学习`(90)、`professional`/`行业专业`(100)、`it-ops-security`/`IT 运维与安全`(110)、
 *     `life-service`/`生活服务`(120)。★**`name` 是中文显示名** —— 这是行里**没有**的东西：
 *     `pageSize=100` 连翻 6 页共 **600 行**里 `category` 恒为**非空英文字符串**（12 个不同 key，无 null/无数组），
 *     12 ≠ 13 那个差额是 **`pay-skill`**：它在按 downloads 排序的热门 600 行里**一行都没出现**。
 *     ★**但它不是空分类**（本仓一度这么写过，已被实测推翻）：`GET /api/skills?category=pay-skill`
 *     回 `code=0` · **`total=18,005`** · 5 行 —— 它只是**下载量排不进热门页**，内容实实在在存在
 *     ⇒ 界面那 13 枚分类**每一枚都点得进去、都有内容**（这一类尤其不能从热门页反推有没有东西）。
 *     ★**为什么走接口而不是行内并集**：用户裁决要的是「**skillhub.cn 自己的**分类标签」，而它自己的标签
 *     **就是这 13 枚带中文名的**；行内并集给的是「我们从热门行里扫出来的 12 个英文 key」——第二手，且**丢了 12 个中文名**。
 *  ⑥ **刻意不出厂的两个字段**：`tags` 在 600 行里 **551 行是 `null`**，其余是自由文本字符串数组、含
 *     `"https"`、`"白领人员版"`、`"https"` 这类脏值 ⇒ 出厂即噪声；`labels` 是**对象**（596 行
 *     `{requires_api_key:"false"}`、4 行 `{pricing_type,requires_api_key}`），**无中文名、无产品价值** ⇒ 两者都不出厂。
 *  ⑦ **登记为「下一版可做」而本刀不做**：`subCategories` 是 `{key,name}` 数组、**name 是中文**
 *     （600 行里 94 个不同 key，`{"key":"dev-code-gen","name":"代码生成"}`）—— 它是天然的下下级筛选，
 *     但本刀冻结的响应契约里没有它（YAGNI：没有第二处消费就不预留字段）。
 *
 * ── 有界与代价（逐条如实登记） ──
 *  · `pageSize` 收窄到 **100**（上游硬上限）：一次浏览最多 100 行。
 *  · `page` 收窄到 **1..20**（`SKILLHUB_BROWSE_MAX_PAGE`）：上游对深翻页没有上限（`page=999999` 也回 200），
 *    **无界翻页**等于让一条 GET 变成"可以一直往深处钻"；20 页 × 100 行 = 前 2,000 条，覆盖面远超一屏，
 *    再深的那 18 万条要留给关键词筛选（那才是找特定技能的入口）。**代价如实登记**：想看第 2,100 条就得先加关键词。
 *  · **分类表有缓存**（`SKILLHUB_BROWSE_CATEGORY_TTL_MS`）——★**每翻一页打一次分类接口是错的设计**：那 13 枚
 *    是**静态元数据**（几乎不变）、正文只有 1.6 KB，而一个用户连翻 10 页就会打 10 次。TTL 取 **1 小时**的出处：
 *    分类增删是**低频事件**（13 枚主体的产品级元数据），而 1 小时对「新建的分类最迟 1 小时后出现在下拉里」
 *    这个代价来说完全可接受，换来的是**绝大多数会话里分类表只取一次**；进程内缓存 ⇒ 重启即失效，
 *    没有任何跨进程状态文件、不进 `~/.dsh/**`、不写盘。
 *  · 分类表**读不到 / 形状读不懂 ⇒ `categories` 整键不产出**，且**绝不影响列表本身**（列表照常出）。
 *    ★**不回落成空数组**：空数组 = 谎称「skillhub 没有分类」；**不编**：宁可下拉为空，也不用硬编码一份会过期的表。
 *  · 总字节**复用既有配额**（`ONLINE_SEARCH_MAX_BYTES`，走 `fetchOnlineJson` 内部那一份，本文件不再引入新上限）。
 *
 * ── 失败绝不静默（空列表 = 谎称「skillhub 没有技能」） ──
 *  · **列表**读不到/非 200/不是 JSON/`code !== 0`/`data.skills` 不是数组 ⇒ `ENT_SKILL_SOURCE_UNREACHABLE`（既有码，
 *    `enterpriseLocalErrorStatus` 判 **502**「上游这次没给到」）。**绝不**折成 `{skills:[]}`。
 *  · **入参形状**非法（`sort` 不在三档内 / `page` 非 1..20 / `q` 超长或含控制字符 / `category` 不在那 13 枚里）
 *    ⇒ `ENT_INVALID_REQUEST`（既有码，判 **400**），且**一次都不打上游**。
 *  · **分类表**失败**不抛**（它是附属事实，不该拖垮列表）——只留一条 `onError` 痕 + `categories` 整键不产出。
 *  · **按条丢弃**与在线搜索**同一把尺**：`requireSkillhubParts`（坐标两段形状不合 ⇒ 这条装不出来）⇒
 *    丢并**经 `onError` 计数留痕**（`dropped` 只进日志，**不进响应**——响应键集是**冻结**的，多一枚键就判畸形）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterpriseSkillInstallError } from './skill-errors.js'
import { requireSkillhubParts } from './skill-skillhub.js'
import {
  fetchOnlineJson,
  MAX_QUERY_LENGTH,
  onlineCountOf,
  onlineFetchDeps,
  type EnterpriseSkillOnlineOptions,
} from './skill-online.js'

/** 上游枚举本体：`https://api.skillhub.cn`（与 `skill-online.ts` 的第四源**同一台 host**，走同一份白名单）。 */
const SKILLHUB_API_BASE = 'https://api.skillhub.cn'
/**
 * ★**分类标签表**（真机 `GET /api/v1/categories` = 200、1,632 B、13 枚，形状见文件头 ⑤）。
 *
 * ★**为什么是 `v1` 这条而不是 `/api/skills` 那些被 405 的路径**：那批（`/api/categories`、
 * `/api/skill/categories`、`/api/category/list`、`/api/skills/category/list`、`POST /api/skills/list`）
 * 真机**实测全部 405**；而 `/api/v1/categories` 是**独立端点**，不在那条被禁的 `/api/v1/search` 家族里。
 * 它与在线搜索那条 `GET /api/skills?…` **端点不同、互不干扰**。
 */
const SKILLHUB_CATEGORIES_ENDPOINT = `${SKILLHUB_API_BASE}/api/v1/categories`

/**
 * 一次浏览最多带多少行（**上游硬上限就是 100**，见文件头 ③）。
 *
 * ★`pageSize=200/500/1000` 上游**全 400**（`参数错误：pageSize 超出范围（1~100）`）⇒ 本常量取上游上限本身，
 * 不多要一字节（多要就是拿 400 换一次失败）。
 */
export const SKILLHUB_BROWSE_PAGE_SIZE = 100

/**
 * 页码上限（上游**没有**这个上限，`page=999999` 也回 200 —— 那是本条路由**自己**加的闸门）。
 *
 * ★**为什么要有**：一条 GET 若允许 `page` 无界，就等于把「翻页」变成一个可以一直往深处钻的黑洞；
 * 20 × 100 = 前 2,000 条已覆盖一屏交互的全部需要，再深的 18 万条属于「找特定技能」，那是**关键词**的活。
 * ★**代价如实登记**：想看第 2,100 条只能先加关键词 —— 这是有意的取舍，不是漏做。
 */
export const SKILLHUB_BROWSE_MAX_PAGE = 20

/**
 * 搜索串上限（**直接复用** `skill-online.ts` 的 `MAX_QUERY_LENGTH`，本文件**不**另立一份）。
 *
 * ★导出的理由只有一个：让「这个界面上能敲多少字」在**两条技能面**（在线搜索 / 本条浏览）上只有**一个答案**；
 * 两个包各写一份 `128` 迟早会在某次改动里分叉，而分叉后的表现是「同一个框在两个页面上长度不一样」。
 */
export const SKILLHUB_BROWSE_MAX_Q_LENGTH = MAX_QUERY_LENGTH

/**
 * 三档排序（**逐一对应上游真实接受的 `sortBy` 取值**，见文件头 ②）。
 *
 * ★**为什么是这三个、且一字不多**：多写一档就是拿上游的 400 换一次失败（`downloadCount`/`hot`/`newest`/`name`
 * 实测全 400）；少写一档则界面上会少一个真能用的排序。
 */
export const SKILLHUB_BROWSE_SORTS = ['downloads', 'installs', 'score'] as const
export type SkillhubBrowseSort = (typeof SKILLHUB_BROWSE_SORTS)[number]

/**
 * 分类标签的进程内缓存时长（**1 小时**）。
 *
 * ★**取值理由**：那 13 枚是**静态元数据**（产品级分类表，几乎不变）、正文只有 **1.6 KB**。
 * ★**为什么必须有缓存**：翻页是**每一次**交互，而分类表对**所有页、所有查询**都是同一份 ——
 * 不缓存就等于「每翻一页打一次分类接口」，一个连翻 10 页的用户会打 10 次。
 * ★**为什么是 1 小时而不是更长/更短**：更短（如 1 分钟）等于没缓存；更长（如 1 天）会让新上线/下线的分类
 * 最迟一天才出现在下拉里。分类增删是低频事件，**1 小时**是「几乎所有会话只取一次」与「新增分类最迟 1 小时可见」
 * 之间的平衡点。★**进程内 ⇒ 重启即失效**，无任何跨进程状态文件、不进 `~/.dsh/**`、**一个字节都不写盘**。
 */
export const SKILLHUB_BROWSE_CATEGORY_TTL_MS = 60 * 60 * 1000

/** 一枚分类标签（**逐字从上游那 13 枚里挑出来的五格**，上游其余字段一律不读）。 */
export interface EnterpriseSkillhubCategory {
  /** 上游 `key`（如 `dev-programming`）——★**这一格同时是 `category` 过滤参数的合法取值集**。 */
  readonly key: string
  /** 上游 `name`（**中文显示名**，如 `开发编程`）。 */
  readonly name: string
  /** 上游 `nameEn`（英文名，如 `Development`）—— 界面上想并排中英时用；缺省不产出。 */
  readonly nameEn?: string
}

/** 一次浏览的入参（**四个都可选**，全缺即「浏览模式」）。 */
export interface EnterpriseSkillhubBrowseRequest {
  /** 关键词（**可缺省**：缺省/空串 = 浏览模式 = 进页面自动显示）。 */
  readonly q?: unknown
  /** 分类过滤（**可缺省**；给了就必须在那 13 枚 `key` 里，否则本地 400 且**一次都不打上游**）。 */
  readonly category?: unknown
  /** 排序（**可缺省 = `downloads`**，用户裁决「默认按下载量」）。 */
  readonly sort?: unknown
  /** 页码（**可缺省 = 1**，上限见 `SKILLHUB_BROWSE_MAX_PAGE`）。 */
  readonly page?: unknown
}

/** 归一化后的一条技能（**从零构造**，宿主绝对路径与上游原始字段**一律不出厂**）。 */
export interface EnterpriseSkillhubSkill {
  readonly name: string
  readonly slug: string
  readonly description?: string
  readonly category?: string
  readonly downloads?: number
  readonly installs?: number
  readonly stars?: number
  readonly version?: string
  /** **逐字** `skillhub.cn:<slug>@<version>` —— 界面把它原样回传给既有 `POST /skills/install-from-result`。 */
  readonly installSource: string
}

/** 一次浏览的产出（★响应键集**冻结**，见 `browseSkillhubCatalog` 的注释）。 */
export interface EnterpriseSkillhubBrowse {
  readonly skills: readonly EnterpriseSkillhubSkill[]
  readonly total?: number
  readonly categories?: readonly EnterpriseSkillhubCategory[]
  readonly page: number
  readonly hasMore: boolean
}

/** 上游那枚信封的读法：`{code,data,message}`，`data = {skills, total}`。 */
interface SkillhubEnvelope {
  readonly data: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function invalid(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', message)
}

function upstream(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_SOURCE_UNREACHABLE', message)
}

/** 只读非空字符串（与 `skill-online.ts` 的 `optionalString` **同一判据**：空白串当没说）。 */
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

/** 分类 `key` 的形状：上游实测全是小写 kebab（`ai-agent`/`it-ops-security`/…），长度有界。 */
const CATEGORY_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_CATEGORY_KEY_LENGTH = 64
const MAX_CATEGORY_NAME_LENGTH = 64

/**
 * 一行 `category` 标签的收窄：**只认** `key`/`name` 两个必需格 + `nameEn` 一个可选格。
 *
 * ★**为什么多一个键就整枚丢掉**（而不是"取认识的、忽略不认识的"）：那会让 `key` 形状不合的那枚**混进
 * 下拉**，而界面随后会拿它当 `category` 参数回传 ⇒ 那一次就是**拿一个非法值去打上游**（上游回 400）。
 * 在这里丢掉它，下拉里就不会出现点下去必然失败的项。
 */
function requireCategory(value: unknown): EnterpriseSkillhubCategory | undefined {
  const entry = asRecord(value)
  const key = optionalString(entry?.['key'])
  const name = optionalString(entry?.['name'])
  if (entry === undefined || key === undefined || name === undefined) return undefined
  if (key.length > MAX_CATEGORY_KEY_LENGTH || !CATEGORY_KEY_PATTERN.test(key)) return undefined
  if (name.length > MAX_CATEGORY_NAME_LENGTH) return undefined
  const nameEn = optionalString(entry['nameEn'])
  return { key, name, ...(nameEn === undefined ? {} : { nameEn: nameEn.slice(0, MAX_CATEGORY_NAME_LENGTH) }) }
}

/**
 * ★**进程内分类表缓存**（**模块级一份**，全宿主共用；不是每请求一份）。
 *
 * ★结构：一次 `Promise` + 一个到期时刻 —— 并发请求**共用同一次取数**（不出现「两个请求各打一次」）。
 * ★失败**不缓存**：一次读不到就让下一次重试（分类接口是稳定的，读不到多半是这一次网络的问题）。
 */
let categoryCache: { readonly promise: Promise<readonly EnterpriseSkillhubCategory[]>, readonly expiresAt: number } | undefined

/**
 * 取那 13 枚分类标签（带 TTL 缓存）。**读不懂/失败 ⇒ 返回 `undefined`**（调用方据此整键不产出）。
 *
 * ★**本函数永不抛出**：分类表是**附属事实**，它读不到绝不该把技能列表一起拖垮（否则一次网络抖动会让整个
 * 页面变成错误页）。失败经 `onError` 留痕后返回 `undefined`，界面那次拿到的响应**只是没有 `categories` 键**。
 */
async function loadCategories(
  deps: Pick<ReturnType<typeof onlineFetchDeps>, 'fetch' | 'onError'>,
  now: () => number,
): Promise<readonly EnterpriseSkillhubCategory[] | undefined> {
  const current = categoryCache
  if (current !== undefined && current.expiresAt > now()) {
    try {
      return await current.promise
    } catch {
      return undefined
    }
  }
  // ★**不缓存失败**：promise 的 rejected 状态走下面的 catch，`categoryCache` 只在成功时被替换。
  const startedAt = now()
  const promise = (async (): Promise<readonly EnterpriseSkillhubCategory[]> => {
    const value = await fetchOnlineJson(deps, SKILLHUB_CATEGORIES_ENDPOINT, 'skillhub.cn')
    const record = asRecord(value)
    const list = record?.['items']
    if (record === undefined || !Array.isArray(list)) {
      throw upstream('skillhub.cn answered an invalid category response')
    }
    const categories: EnterpriseSkillhubCategory[] = []
    const seen = new Set<string>()
    for (const item of list) {
      const category = requireCategory(item)
      // ★形状不合的**按枚丢掉**（不编、不猜）：`items[]` 是元数据表，一枚坏的不该拖垮整张表。
      if (category === undefined || seen.has(category.key)) continue
      seen.add(category.key)
      categories.push(category)
    }
    if (categories.length === 0) throw upstream('skillhub.cn answered an empty category table')
    // 上游给了 `sortOrder`，接口文档化；我们**不读**它（响应键集冻结），出厂按 `key` 的出现序（上游已排序）。
    return categories
  })()
  categoryCache = { promise, expiresAt: startedAt + SKILLHUB_BROWSE_CATEGORY_TTL_MS }
  try {
    return await promise
  } catch (error) {
    deps.onError?.('enterprise skillhub browse category table is unavailable (categories key omitted)', error)
    return undefined
  }
}

/** 一条 `q` 的形状收窄：非空、无控制字符、有界（**与在线搜索 `q` 同一把尺**，见 `MAX_QUERY_LENGTH`）。 */
function requireQuery(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw invalid('the skillhub browse query is invalid')
  // ★空串 = 浏览模式（**不是** 0 条结果）：界面「清空搜索框」应当回到浏览，而不是报错。
  if (value.length === 0) return undefined
  if (value.length > MAX_QUERY_LENGTH) throw invalid('the skillhub browse query is too long')
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) throw invalid('the skillhub browse query is invalid')
  }
  return value
}

/** 一条 `page` 的形状收窄：缺省 1；必须是 1..`SKILLHUB_BROWSE_MAX_PAGE` 的**安全整数**。 */
function requirePage(value: unknown): number {
  if (value === undefined || value === null || value === '') return 1
  // ★只认**规范十进制**的页码：空串已在上一步当"没给"处理。
  //   `'01'`/`'1.5'`/`'1e3'`/`' 1'`/`'+1'` 一律拒 —— 我们**不替上游猜**它在想什么
  //   （上游那侧我们只发自己拼好的 `page=<n>`，所以永远走不到这些形状；判它们非法是为了
  //   **界面上不会把一个我们没准备好的值原样转出去**）。
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined
  if (text === undefined || !/^[1-9][0-9]{0,4}$/.test(text)) throw invalid('the skillhub browse page is invalid')
  const page = Number(text)
  if (!Number.isSafeInteger(page) || page < 1 || page > SKILLHUB_BROWSE_MAX_PAGE) {
    throw invalid('the skillhub browse page is out of range')
  }
  return page
}

/** 一条 `sort` 的形状收窄：缺省 **`downloads`**；只认那三档（**不多写一档**）。 */
function requireSort(value: unknown): SkillhubBrowseSort {
  if (value === undefined || value === null || value === '') return 'downloads'
  if (typeof value !== 'string' || !SKILLHUB_BROWSE_SORTS.includes(value as SkillhubBrowseSort)) {
    throw invalid('the skillhub browse sort is invalid')
  }
  return value as SkillhubBrowseSort
}

/** 上游那枚信封：`code` 必须**逐字等于数值 0**（照 `skill-online.ts` 的 `normalizeSkillhub` 同一把尺）。 */
function requireEnvelope(value: unknown): SkillhubEnvelope {
  const record = asRecord(value)
  const data = asRecord(record?.['data'])
  if (record === undefined || data === undefined || record['code'] !== 0) {
    throw upstream('skillhub.cn answered an invalid response')
  }
  return { data }
}

/**
 * 归一化一页：★**从零构造**每一行（宿主绝对路径、上游的 `namespace`/`homepage`/`iconUrl`/`claim_state`/
 * `upstream_url`/`tags`/`labels`/`subCategories` 等**一律不出厂**，见文件头 ⑥⑦）。
 *
 * ★**坐标用 `requireSkillhubParts`** —— 与在线搜索的 `normalizeSkillhub`、与安装侧的 `parseSkillhubReference`
 * 是**同一把尺**（`skill-skillhub.ts` 的定义处就是这么写的：两处各写一套迟早出现「搜索敢交出去、安装不认」）。
 * ★`installSource` 因此**逐字**是 `skillhub.cn:<slug>@<version>`，与既有 `POST /skills/install-from-result`
 * 接的那条坐标串**同一个形态**（那条路由与 `installSkillFromResult` 一个字节都不用改）。
 *
 * @returns 留下来的行 + 被丢弃的条数（后者只进 `onError`，**不进响应**）+ 上游报的 `total`（读不懂即 `undefined`）。
 */
function normalizePage(
  value: unknown,
): { readonly skills: EnterpriseSkillhubSkill[], readonly dropped: number, readonly total: number | undefined } {
  const { data } = requireEnvelope(value)
  const list = data['skills']
  if (!Array.isArray(list)) throw upstream('skillhub.cn answered an invalid skill list')
  const skills: EnterpriseSkillhubSkill[] = []
  let dropped = 0
  for (const item of list) {
    const entry = asRecord(item)
    const name = optionalString(entry?.['name'])
    if (entry === undefined || name === undefined) {
      throw upstream('skillhub.cn answered an invalid skill entry')
    }
    const parts = requireSkillhubParts(optionalString(entry['slug']), optionalString(entry['version']))
    // ★装不出来就丢（**与在线搜索同一把尺、同一处置**），并**计数**留痕 —— 不静默丢字节。
    if (parts === undefined) {
      dropped += 1
      continue
    }
    // ★`description` **优先 `description_zh`**（中文站点、界面面向中文员工），与 `normalizeSkillhub` 同款。
    const description = optionalString(entry['description_zh']) ?? optionalString(entry['description'])
    const category = optionalString(entry['category'])
    const downloads = onlineCountOf(entry['downloads'])
    const installs = onlineCountOf(entry['installs'])
    const stars = onlineCountOf(entry['stars'])
    skills.push({
      name,
      slug: parts.slug,
      ...(description === undefined ? {} : { description }),
      ...(category === undefined ? {} : { category }),
      ...(downloads === undefined ? {} : { downloads }),
      ...(installs === undefined ? {} : { installs }),
      ...(stars === undefined ? {} : { stars }),
      // ★**版本**也出厂：它就是坐标里 `@` 后面那一段，界面可以显示「v2.0.3」，且这条版本与
      //   装的时候取的那一版**必然是同一版**（坐标里带的就是它）。
      version: parts.version,
      installSource: `skillhub.cn:${parts.slug}@${parts.version}`,
    })
  }
  // ★`total` 用 `onlineCountOf`（**同一把尺**）：上游说"没这个数"就整键不产出，绝不编一个 `0`。
  //   ★连带 `hasMore` 也就无从算（算式缺一半）⇒ 那种情况下它恒 `false`（"没证据说还有，就当没有"），
  //   而**不是**乐观地编成 `true` 让界面去翻一页空页。
  return { skills, dropped, total: onlineCountOf(data['total']) }
}

/**
 * ★**本刀唯一的对外出口**：SkillHub 维度的只读浏览。
 *
 * ★**响应键集冻结**（`{skills, total?, categories?, page, hasMore}`）—— 多一枚键界面那份封闭解码器就判畸形。
 * 因此 `dropped` 那个计数**只进 `onError`、绝不进响应**（与 `/skills/third-party` 把 `skipped` 放进
 * `roots[]` 不同：那条的计数在**根**上、界面上有地方放，这条的行形状是冻结的、插不进去）。
 *
 * ★**取数顺序（为什么先取列表再取分类）**：列表是**主事实**，分类是**附属事实**。反过来先取分类的话，
 * 一次网络抖动会让页面整体变成错误页，而分类只影响下拉那一档 —— 主次不能倒。
 *
 * @param options - 与在线搜索**共用**的无凭据取数面与留痕端口（同一次依赖注入 ⇒ 零新增 HTTP 通道）。
 * @param request - `q?`/`category?`/`sort?`/`page?`，四个都可缺省。
 * @returns 归一化后的列表 + 这次真见过的分类标签（**取不到就不产这一键**）+ 分页事实。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`（入参形状非法，**一次都不打上游**）、
 *   `ENT_SKILL_SOURCE_UNREACHABLE`（上游读不到/形状读不懂 ⇒ **502，绝不折成空列表**）。
 */
export async function browseSkillhubCatalog(
  options: EnterpriseSkillOnlineOptions,
  request: EnterpriseSkillhubBrowseRequest = {},
): Promise<EnterpriseSkillhubBrowse> {
  // ★**入参先判、一次都不打上游**：非法 sort / 非法 page / 超长 q / 不在表内的 category 全在这一步变 400。
  const query = requireQuery(request.q)
  const sort = requireSort(request.sort)
  const page = requirePage(request.page)

  const deps = onlineFetchDeps(options)
  const now = options.now ?? ((): Date => new Date())
  const monotonic = (): number => now().getTime()

  // ★**分类先决议**（要拿它的合法取值集去判 `category`），但**它的失败不阻断任何东西**。
  const categories = await loadCategories(deps, monotonic)

  // `category` 必须在**本地**按"这次真见到的取值"收窄 —— ★绝不把用户随手敲的串原样打到公网。
  // ★`categories === undefined`（这次没取到那张表）时**不拒**：那时我们手上没有合法取值集，
  //   若照样拒就等于「分类接口一抖，浏览整个不可用」。放行它 = 让上游自己判（它对非法值回 400，
  //   那时我们如实报 `ENT_SKILL_SOURCE_UNREACHABLE`），比本地瞎猜一个取值集更诚实。
  const rawCategory = request.category
  let category: string | undefined
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== '') {
    category = optionalString(rawCategory)
    if (category === undefined) throw invalid('the skillhub browse category is invalid')
    if (categories !== undefined && !categories.some(entry => entry.key === category)) {
      throw invalid(`the skillhub browse category is not one of the ${categories.length} known categories`)
    }
  }

  // ★**URL 从零拼**：排序/分类/关键词/分页四个键**显式**给出，不靠上游默认（见文件头 ②）。
  const parameters = [
    `page=${page}`,
    `pageSize=${SKILLHUB_BROWSE_PAGE_SIZE}`,
    `sortBy=${sort}`,
    ...(query === undefined ? [] : [`keyword=${encodeURIComponent(query)}`]),
    ...(category === undefined ? [] : [`category=${encodeURIComponent(category)}`]),
  ]
  const url = `${SKILLHUB_API_BASE}/api/skills?${parameters.join('&')}`
  const value = await fetchOnlineJson(deps, url, 'skillhub.cn')
  const { skills, dropped, total } = normalizePage(value)
  if (dropped > 0) {
    deps.onError?.(
      `enterprise skillhub browse dropped ${dropped} result(s) on page ${page}:`
      + ' a result without a well-formed slug@version cannot be installed from this host',
      undefined,
    )
  }
  // ★`hasMore` **只按 `page * pageSize < total` 判**（文件头 ③）：上游 `page=999999` 回的是
  //   `code=0` + `skills:[]`（**不是**错误），所以「数组为空」既可能是尾页、也可能是越过末尾 —— 只有算术分得开。
  return {
    skills,
    page,
    hasMore: total !== undefined && page * SKILLHUB_BROWSE_PAGE_SIZE < total,
    ...(total === undefined ? {} : { total }),
    ...(categories === undefined ? {} : { categories }),
  }
}
