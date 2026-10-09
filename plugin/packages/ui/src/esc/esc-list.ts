/**
 * [INPUT]: 依赖 React 的 hook 原语、`esc-api` 的 `EnterpriseEscApi` 契约、`esc-constants` 的成功码与分类根映射、`esc-types` 的归一化类型与 `mapPublishedStats`
 * [OUTPUT]: 对外提供 `useEnterpriseEscResourceList`（`{list, loading, hasMore, error, loadMore, updateItem, reload}`）、`escResourceAdapters` 适配器表（各资源类型 × 数据源的取数与提取口径）、`escPublishedTargetIdOf`（精选行回查的公共键，口径 43）与 `escSafeTargetId`（安装坐标的安全整数门禁，口径 64）
 * [POS]: esc 页面的**归一化数据层**，逐字移植自 NUWAX `ResourceAggregation/hooks/useResourceList.ts`（574 行）。
 *   ★改动的只有三处**注入点**，判定逻辑一字未动：① `@/services/*` 那六个函数 → `EnterpriseEscApi` 的六个同签名方法；
 *   ② `SUCCESS_CODE` → `ESC_SUCCESS_CODE`；③ umi 的类型 → 本包 `esc-types`。
 *   ★**新增一处如实缺口**（原文件没有）：失败不再静默画空态——`code !== '0000'` 或请求抛错时把稳定码与平台原文
 *   记进 `error`，由页面说出来（仓库的 no-silent-swallow 门禁也要求如此；原页面"读失败=空列表"会让员工以为"平台没有东西"）。
 *   ★原有纪律逐条保留：过期响应丢弃（`requestIdRef`）、重置加载必须放行（否则新条件的请求发不出去）、
 *   全量接口的内存切片与双击防重入、`updateItem` 的两层缓存同步。
 *   ★**口径 43（本刀）**：新增 `escPublishedTargetIdOf` —— 精选行（官方推荐）回查广场目录的那个**公共键**。
 *     真机实测（本机现役宿主，同一刻两条取数）：推荐记录 `targetId=158` 的那条 `dev-engineer-toolkit`，
 *     广场那条是**平台 `id=4194` / `targetId=158`** —— `id` 与 `targetId` 是**两套坐标系**，
 *     同一套的是 `targetId`（7 条技能 + 7 条专家逐条命中，`label` 与 `name` 亦逐字相同）。
 *     ⇒ 这一格就是「验过之后才敢接」的那一格（`esc-featured.tsx` 文件头早先记为待验）。
 *   ★**口径 55（本刀）**：技能那一支的 `enabled` 适配器（读 `POST /api/published/skill/enable/list`）随
 *     「我启用的」维度**整支删除**（不可达）；`missingEndpointCodeOf` 收成**两枚**面级码（连接器目录 /
 *     这一类目录），`mapPublishedItem` 的 `'enabled-skill'` 前缀退场；并**顺手清掉一处既有死代码** ——
 *     连接器那一支的 `enabled`（`connectionEnabled:'true'` + `'enabled-conn'`）**从落地起就不可达**
 *     （连接器页第三枚维度是 `'connected'`，而 `'enabled'` 只由技能页产出），删除处逐条写明了这条推理。
 *   ★**口径 64（本刀）**：`mapPublishedItem` **就地**多投两格事实——`targetId`（先过
 *     `escSafeTargetId` 的安全整数门禁）与 `allowCopy`（原值；非数字归一成缺席）——供系统广场
 *     那批已发布技能的【＋】做**安装坐标 + 授权预判**。★**没有第二条取值路径**：本文件仍是
 *     "广场记录 → `ResourceItem`"的唯一投影，故系统广场 / 团队空间 / 精选回查三处的这两格
 *     不可能各说一套（本刀不新造取数器、不加路由、不加解码器）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ESC_MISSING_ENDPOINT_CODES, escErrorCodeOf, escPlatformErrorCode } from './esc-api.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { ESC_CONNECTOR_CATEGORY_ROOT_KEY, ESC_SUCCESS_CODE } from './esc-constants.js'
import type {
  EscCategoryNode,
  EscConnectorProvider,
  EscPage,
  EscPlatformEnvelope,
  EscPublishedItem,
} from './esc-types.js'
import { mapPublishedStats } from './esc-types.js'
import type { ResourceItem, ResourceSourceEnum, ResourceTypeEnum } from './esc-types.js'

/**
 * 本面在「这台部署没有这个端点」（平台 `4040`）时该说的那枚稳定码。
 *
 * ★按**取数面**分：连接器面缺的是连接器目录，专家/技能面缺的是"这一类目录"。
 *   上一刀那条映射**不看面**、对任何一面都说"没有连接器目录"——专家/技能面一旦也回 `4040`，
 *   那就是在跟员工说假话；后来按面分开时还多分出一枚「技能启停清单」（`skill/enable/list`）。
 *   ★**口径 55（用户裁决）**：那一枚随「我启用的」这个维度**整枚退场** —— 该维度已删，
 *   不会再有任何请求打到 `skill/enable/list`，留一枚"这一面缺的是启停清单"的码就是在描述
 *   一个本仓已经不存在的数据面（`ESC_MISSING_ENDPOINT_CODES.enabled` 与
 *   `ENT_ESC_ENABLE_LIST_UNAVAILABLE` 两句一并删除）。今天这里只剩**两枚**面级码：
 *   连接器目录 / 这一类目录。
 *   ★导出是为了让测试直调核对**每一面各自那一枚**（与 `escCategoryChildrenOf` 同一个做法）。
 */
export function missingEndpointCodeOf(resourceType: ResourceTypeEnum, source: ResourceSourceEnum): string {
  // `source` 仍留在签名里：它今天不改变结果，但"按面取码"这件事的判据是**资源类型 + 维度**这一对，
  // 收掉参数会让下一个面（例如将来某个维度有自己的端点）只能靠改签名来接——那是接口倒退，不是简化。
  void source
  return resourceType === 'connector'
    ? ESC_MISSING_ENDPOINT_CODES.connector
    : ESC_MISSING_ENDPOINT_CODES.directory
}

/** 服务端分页请求参数（逐字对齐原文件）。 */
export interface EscServerFetchParams {
  readonly page: number
  readonly pageSize: number
  readonly category: string
  readonly keyword: string
  readonly spaceId?: number | undefined
  /** 团队维度「全部」页签的聚合参数：全部空间 ID（具体空间页签用 `spaceId`）。 */
  readonly spaceIds?: readonly number[] | undefined
}

/** 服务端分页适配器。 */
interface EscServerAdapter {
  readonly mode: 'server'
  readonly fetchPage: (params: EscServerFetchParams) => Promise<EscPlatformEnvelope<unknown>>
  readonly extract: (
    res: EscPlatformEnvelope<unknown>,
    page: number,
    pageSize: number,
  ) => { readonly items: ResourceItem[]; readonly hasMore: boolean }
}

/** 全量数组适配器。 */
interface EscClientAdapter {
  readonly mode: 'client'
  /** 接口侧已按 keyword 过滤时置 true：本地跳过关键字筛选（避免与接口口径不一致造成双重收窄）。 */
  readonly serverKeyword?: boolean | undefined
  /** 接口侧已按 category 过滤时置 true：本地跳过分类筛选。 */
  readonly serverCategory?: boolean | undefined
  readonly fetchAll: (
    params: Pick<EscServerFetchParams, 'spaceId' | 'keyword' | 'category'>,
  ) => Promise<EscPlatformEnvelope<unknown>>
  readonly extractAll: (res: EscPlatformEnvelope<unknown>) => ResourceItem[]
}

/** 各资源类型 × 数据源的适配器表（`Partial`：已连接的维度仅连接器配置）。 */
export type EscResourceAdapters = Readonly<
  Record<ResourceTypeEnum, Readonly<Partial<Record<ResourceSourceEnum, EscServerAdapter | EscClientAdapter>>>>
>

/**
 * 广场已发布条目（智能体/技能）归一化（逐字对齐原文件，含"哪些维度填 agentId/skillId"的判据）。
 *
 * ★**口径 64（本刀）**：多解码两格事实——`targetId`（经 {@link escSafeTargetId} 的安全整数门禁）
 *   与 `allowCopy`（**原值**：只有数字 `1` 才算允许复制，判据在 `esc-system.tsx`）。
 *   ★**就地扩投影、不新造第二个目录取数器**：系统广场、团队空间、精选回查三处读的都是**这一份**
 *   `mapPublishedItem`，故"这条记录能不能装"的事实只可能有一处取值口（三处各抄一份必然会漂）。
 *   ★`allowCopy` 只收**数字**：非数字（`true` / `'1'` / 畸形）归一成**缺席**——于是它落到下游那条
 *   "只有 `=== 1` 才算允许"的 fail-closed 判据里，与"平台没给这个字段"**同判**（都装不了）。
 *   这与旁边 `mapPublishedStats` 的口径同一条：**不把"没给"伪造成一个值**。
 */
const mapPublishedItem = (item: EscPublishedItem, idPrefix: string): ResourceItem => ({
  id: `${idPrefix}-${item.id}`,
  agentId: idPrefix === 'agent' || idPrefix === 'space-agent' ? item.targetId : undefined,
  // ★口径 55：`'enabled-skill'` 这一格随技能页那枚维度一起退场 —— 前缀是**由适配器给**的，
  //   而唯一给出它的那一支（`adapters.skill.enabled`）已删 ⇒ 留着它就是在枚举一个不可能出现的值。
  skillId: idPrefix === 'skill' || idPrefix === 'space-skill' ? item.targetId : undefined,
  // ★口径 64：安装坐标（安全整数门禁）与发布者授权（原值，下游只认 1）——两格都是**这一处**投出来的。
  targetId: escSafeTargetId(item.targetId),
  allowCopy: typeof item.allowCopy === 'number' ? item.allowCopy : undefined,
  name: item.name,
  description: item.description,
  icon: item.icon,
  category: item.category || undefined,
  publishUser: item.publishUser,
  collected: item.collect === true,
  skillEnabled: item.enabled === true,
  paymentRequired: item.paymentRequired === true,
  subscribed: item.subscribed === true,
  stats: mapPublishedStats(item.statistics),
})

/**
 * ★**口径 64（本刀）**：安装坐标的**唯一门禁**——平台那枚 `targetId` 只有真的是
 * **安全整数且 `>= 1`** 时才交出去，其余一律 `undefined`（fail-closed）。
 *
 * 三条判据逐条都有理由（宿主那条路由的正文门禁就是这四条之和）：
 *   · `typeof === 'number'`：字符串 id / 数字字符串一律不要（宿主只收 JSON number）；
 *   · `Number.isSafeInteger`：小数、`NaN`、`Infinity`、超出 `2^53-1` 的雪花号一律不要
 *     （`Number.isSafeInteger` 一次挡掉这四种，且**不**接受 `'158'`）；
 *   · `>= 1`：宿主那侧的下界是 `1`（`0` 与负数不进上游）。
 * ⇒ 判不过时**整格缺席**，界面据此把那枚【＋】**禁用 + 行上可见原因**（绝不发一条注定 400 的请求）。
 * ★它是**纯函数**：门禁可以逐档直调取证（`158` 过；`0`/`-1`/`1.5`/`NaN`/`Infinity`/`2**53`/`'158'`/
 *   `true`/`null`/缺席全部不过），不需要起渲染器——本仓 vitest 没有 DOM。
 *
 * @param value - 平台记录里的 `targetId`（**未知形状**：原始响应只是类型断言，没有运行时校验）。
 * @returns 安全整数坐标；任何不合规形状一律 `undefined`。
 */
export function escSafeTargetId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : undefined
}

/**
 * 精选行（官方推荐）回查广场目录用的**公共键**：平台已发布条目的 `targetId`（口径 43）。
 *
 * 为什么不是 `ResourceItem.id`：那是本页拼出来的 `${前缀}-${平台 id}` 字符串，而推荐记录给的
 * `targetId` 指向平台坐标里的**另一枚号**。真机实测（本机现役宿主、同一刻两条取数）：
 *
 * ```text
 * 推荐  targetId=158 label=dev-engineer-toolkit
 * 广场  平台 id=4194  targetId=158  name=dev-engineer-toolkit   ← 逐字同上
 * ```
 *
 * ⇒ `id`（4194）与 `targetId`（158）**不是一套坐标系**；同一套的是 `targetId`
 * （7 条技能 + 7 条专家**逐条命中**，`label` 与 `name` 亦逐字相同）。
 * 这就是 `esc-featured.tsx` 文件头早先记为「与那份列表是否同一套坐标系在源码里查不到、必须实跑」
 * 的那一格——本刀实跑过，故回查接得上。
 *
 * 取值口：`mapPublishedItem` 把平台 `targetId` 分别写进 `agentId`（专家）或 `skillId`（技能），
 * 两者**互斥**（按 `idPrefix` 二选一），故这里取并集的那一枚即是它。
 */
export function escPublishedTargetIdOf(item: ResourceItem): number | undefined {
  return item.agentId ?? item.skillId
}

/** 连接器提供方归一化（逐字对齐原文件）。 */
const mapConnectorItem = (item: EscConnectorProvider, idPrefix: string): ResourceItem => ({
  id: `${idPrefix}-${item.service || item.id}`,
  service: item.service,
  connectionId: item.connectionId,
  spaceId: item.spaceId,
  name: item.displayName || item.service,
  description: item.description,
  icon: item.icon,
  category: item.category || undefined,
  tags: item.tags,
  connected: item.connected,
  connectionEnabled: item.connectionEnabled,
  authType: item.authType,
})

/** 已发布接口响应提取（`Page` 分页结构）。 */
const extractPublishedPage = (
  res: EscPlatformEnvelope<unknown>,
  page: number,
  idPrefix: string,
): { readonly items: ResourceItem[]; readonly hasMore: boolean } => {
  const data = res.data as EscPage<EscPublishedItem> | null | undefined
  const records = data?.records ?? []
  const current = data?.current ?? page
  const pages = data?.pages ?? 1
  return { items: records.map(item => mapPublishedItem(item, idPrefix)), hasMore: current < pages }
}

/** 连接器接口响应提取（`GET /api/connector/providers` 的分页结构，无总页数字段）。 */
const extractConnectorPage = (
  res: EscPlatformEnvelope<unknown>,
  page: number,
  pageSize: number,
  idPrefix: string,
): { readonly items: ResourceItem[]; readonly hasMore: boolean } => {
  const data = res.data as (EscPage<EscConnectorProvider> & { readonly pageNum?: number }) | null | undefined
  const records = data?.records ?? []
  const current = data?.pageNum ?? page
  return {
    items: records.map(item => mapConnectorItem(item, idPrefix)),
    // 该接口无总页数字段，按"本页取满"判断是否还有下一页（原文件同口径）
    hasMore: current === page && records.length >= pageSize,
  }
}

/**
 * 造适配器表（原文件是模块级常量；这里收成工厂，唯一原因是取数面要**注入**而不是 import）。
 *
 * 每个 `fetchPage`/`fetchAll` 的参数逐条照抄原文件——包括"系统广场只查官方（`official: true`）"、
 * "团队空间带 `justReturnSpaceData` 且不传 official"、"连接器官方目录 `scope=official` / 空间维度 `scope=space`"、
 * "已连接的 `connected=true` / 我启用的 `connectionEnabled=true`"这几个**口径差异**。
 */
export function escResourceAdapters(api: EnterpriseEscApi): EscResourceAdapters {
  return {
    expert: {
      system: {
        mode: 'server',
        fetchPage: ({ page, pageSize, category, keyword }) =>
          api.publishedAgentList({
            page,
            pageSize,
            category,
            kw: keyword || undefined,
            // 查询智能体需设置目标子类型：ChatBot 含对话型与通用型，排除网页应用
            targetType: 'Agent',
            targetSubType: 'ChatBot',
            // 仅展示官方智能体
            official: true,
          }),
        extract: (res, page) => extractPublishedPage(res, page, 'agent'),
      },
      team: {
        mode: 'server',
        fetchPage: ({ page, pageSize, keyword, spaceId, spaceIds }) =>
          api.publishedAgentList({
            page,
            pageSize,
            kw: keyword || undefined,
            category: 'Agent',
            justReturnSpaceData: true,
            ...spaceScopeParams(spaceId, spaceIds),
          }),
        extract: (res, page) => extractPublishedPage(res, page, 'space-agent'),
      },
    },
    skill: {
      system: {
        mode: 'server',
        fetchPage: ({ page, pageSize, category, keyword }) =>
          api.publishedSkillList({ page, pageSize, category, kw: keyword || undefined, official: true }),
        extract: (res, page) => extractPublishedPage(res, page, 'skill'),
      },
      team: {
        mode: 'server',
        fetchPage: ({ page, pageSize, keyword, spaceId, spaceIds }) =>
          api.publishedSkillList({
            page,
            pageSize,
            kw: keyword || undefined,
            category: 'Skill',
            justReturnSpaceData: true,
            ...spaceScopeParams(spaceId, spaceIds),
          }),
        extract: (res, page) => extractPublishedPage(res, page, 'space-skill'),
      },
    },
    connector: {
      system: {
        mode: 'server',
        fetchPage: ({ page, pageSize, category, keyword }) =>
          api.connectorProviderPageList({
            pageNum: page,
            pageSize,
            scope: 'official',
            category: category || undefined,
            keyword: keyword || undefined,
          }),
        extract: (res, page, pageSize) => extractConnectorPage(res, page, pageSize, 'system-conn'),
      },
      team: {
        mode: 'server',
        fetchPage: ({ page, pageSize, keyword, spaceId }) =>
          api.connectorProviderPageList({
            pageNum: page,
            pageSize,
            scope: 'space',
            ...(spaceId ? { spaceId } : {}),
            keyword: keyword || undefined,
          }),
        extract: (res, page, pageSize) => extractConnectorPage(res, page, pageSize, 'space-conn'),
      },
      connected: {
        mode: 'client',
        serverKeyword: true,
        serverCategory: true,
        fetchAll: ({ keyword, category }) =>
          api.connectorProviderPageList({
            connected: 'true',
            category: category || undefined,
            keyword: keyword || undefined,
          }),
        extractAll: res => {
          const data = res.data
          const records = Array.isArray(data)
            ? (data as readonly EscConnectorProvider[])
            : ((data as EscPage<EscConnectorProvider> | null | undefined)?.records ?? [])
          return records.map(item => mapConnectorItem(item, 'connected-conn'))
        },
      },
      /**
       * ★**口径 55 顺手清掉的既有死代码（如实写明"为什么不可达"，不是悄悄删）**。
       *
       * 这里原先还有一支 `enabled`：`fetchAll` 打 `connectionEnabled: 'true'`、把记录映成
       * `'enabled-conn'` 前缀。它**从落地那天起就一次都没被选中过**，理由是纯结构性的：
       *   ① 适配器由 `load()` 按 `adapters[resourceType][source]` 取，`source` 只可能来自
       *      `esc-toolbar.tsx` 的 `sourceOptionsOf`；
       *   ② 而连接器页那一支产出的第三枚维度是 `value: 'connected'`（文案「已连接的」，
       *      走的是**上面那一支** `connected=true`）—— 连接器页**从来没有**产出过 `'enabled'`；
       *   ③ 全仓唯一的 `'enabled'` 产出点是技能页那枚维度，而技能页的 source 只会落到
       *      `adapters.skill.enabled`，**落不到** `adapters.connector.enabled` 上。
       * ⇒ 也就是说，连接器这一支早在口径 55 之前就是死代码。按"不留死代码"的纪律本刀一并清掉；
       *   平台那侧 `connectionEnabled: 'true'` 这个查询参数本身仍然存在（它是平台面的事实），
       *   只是本仓**没有任何页面维度**会去用它 —— 若将来真要做"我启用的连接器"那一维，
       *   新加一支时必须同时把维度的产出点接上，否则又会变回今天这支死代码。
       */
    },
  }
}

/** 团队空间维度「全部」页签经 `spaceIds` 聚合、具体空间页签用 `spaceId`（原文件的展开式逐字保留）。 */
function spaceScopeParams(
  spaceId: number | undefined,
  spaceIds: readonly number[] | undefined,
): { readonly spaceId?: number; readonly spaceIds?: readonly number[] } {
  if (spaceIds && spaceIds.length > 0) {
    const first = spaceIds[0]
    // 单元素回退 `spaceId`（原文口径：平台按 spaceId 单查比按 spaceIds 聚合更省）
    return spaceIds.length === 1 && first !== undefined ? { spaceId: first } : { spaceIds }
  }
  // ★`exactOptionalPropertyTypes`：缺席就是**不给这个键**，不是"给一个 undefined 值"
  return spaceId === undefined ? {} : { spaceId }
}

/** 列表取数失败的可读事实（原文件没有这一格：它把失败折叠成空列表，本刀如实说出来）。 */
export interface EnterpriseEscListError {
  /** 稳定码（本地码或平台码原样）。 */
  readonly code: string
  /** 平台/本机的原话（可为空串；界面在空串时只显示稳定码）。 */
  readonly message: string
}

/** 入参（与原文件的 `UseResourceListParams` 同形，多一个取数面）。 */
export interface UseEnterpriseEscResourceListParams {
  readonly api: EnterpriseEscApi
  readonly resourceType: ResourceTypeEnum
  readonly source: ResourceSourceEnum
  /** 二级分类 key，空串表示全部。 */
  readonly category: string
  /** 搜索关键字（已防抖）。 */
  readonly keyword: string
  readonly spaceId?: number | undefined
  readonly spaceIds?: readonly number[] | undefined
  readonly pageSize?: number | undefined
}

/**
 * 归一化资源列表 hook（逐字移植 `useResourceList`）。
 */
export function useEnterpriseEscResourceList({
  api,
  resourceType,
  source,
  category,
  keyword,
  spaceId,
  spaceIds,
  pageSize = 20,
}: UseEnterpriseEscResourceListParams): {
  readonly list: readonly ResourceItem[]
  readonly loading: boolean
  readonly hasMore: boolean
  readonly error: EnterpriseEscListError | undefined
  readonly loadMore: () => void
  readonly updateItem: (id: string, patch: Partial<ResourceItem>) => void
  readonly reload: () => void
} {
  const [list, setList] = useState<readonly ResourceItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [error, setError] = useState<EnterpriseEscListError | undefined>(undefined)

  const adapters = useMemo(() => escResourceAdapters(api), [api])
  // 当前页码（0 表示尚未加载）
  const pageRef = useRef<number>(0)
  // 全量数组接口的原始数据缓存
  const rawListRef = useRef<ResourceItem[] | null>(null)
  // 全量数组接口按筛选条件计算后的视图缓存
  const filteredListRef = useRef<ResourceItem[]>([])
  // 进行中的请求标识（过期响应丢弃）
  const requestIdRef = useRef<number>(0)
  const loadingRef = useRef<boolean>(false)
  /** `hasMore` 的 ref 镜像：`loadMore` 用 `[]` 依赖，读不到 state，故在渲染期同步一次（同 `loadRef` 手法）。 */
  const hasMoreRef = useRef<boolean>(true)
  hasMoreRef.current = hasMore

  const load = useCallback(
    async (reset: boolean) => {
      // 防重入：仅拦截追加加载（loadMore 双触发）。重置加载（tab/筛选条件变化）必须放行——
      // 放行后 ++requestId 会让在途旧请求的响应因过期被丢弃；若此处一并拦截，新条件的请求发不出去、
      // requestId 不前进，旧 tab 在途响应反而被判定为最新，数据会串到切换后的 tab 上（原文件注释逐字保留）
      if (loadingRef.current && !reset) return
      // 团队空间维度依赖空间寻址：专家/技能需 spaceId 或 spaceIds 其一；连接器例外——
      // "全部"页签经 scope=space 聚合全部空间（不带 spaceId 也要发请求），具体空间页签才带 spaceId
      if (source === 'team' && resourceType !== 'connector' && !spaceId && !(spaceIds && spaceIds.length > 0)) {
        return
      }
      const adapter = adapters[resourceType][source]
      // 该维度未配置数据源（专家/技能无"已连接的"tab，正常不会走到）
      if (!adapter) return
      const requestId = ++requestIdRef.current
      const nextPage = reset ? 1 : pageRef.current + 1
      loadingRef.current = true
      setLoading(true)
      try {
        if (adapter.mode === 'server') {
          const res = await adapter.fetchPage({ page: nextPage, pageSize, category, keyword, spaceId, spaceIds })
          // 过期响应丢弃（筛选条件已变化）
          if (requestIdRef.current !== requestId) return
          if (res?.code === ESC_SUCCESS_CODE) {
            const { items, hasMore: more } = adapter.extract(res, nextPage, pageSize)
            setList(prev => (reset ? items : [...prev, ...items]))
            pageRef.current = nextPage
            setHasMore(more)
            setError(undefined)
          } else {
            // ★与原文的差异：原文件只在 reset 时清空列表、**不说明为什么**；这里如实记下码与原话
            setError({ code: escPlatformErrorCode(res?.code, missingEndpointCodeOf(resourceType, source)), message: typeof res?.message === 'string' ? res.message : '' })
            if (reset) {
              setList([])
              setHasMore(false)
            }
          }
        } else {
          if (reset || rawListRef.current === null) {
            const res = await adapter.fetchAll({ spaceId, keyword, category })
            if (requestIdRef.current !== requestId) return
            if (res?.code === ESC_SUCCESS_CODE) {
              rawListRef.current = adapter.extractAll(res)
              setError(undefined)
            } else {
              rawListRef.current = []
              setError({ code: escPlatformErrorCode(res?.code, missingEndpointCodeOf(resourceType, source)), message: typeof res?.message === 'string' ? res.message : '' })
            }
          }
          // 全量数据按分类/关键字做客户端筛选后内存切片；
          // serverKeyword/serverCategory 的维度接口已按对应条件过滤，本地跳过相应筛选
          const kw = adapter.serverKeyword === true ? '' : keyword.trim().toLowerCase()
          const cat = adapter.serverCategory === true ? '' : category
          filteredListRef.current = (rawListRef.current ?? []).filter(item => {
            const categoryMatched = !cat || (!!item.category && item.category === cat)
            const keywordMatched =
              !kw ||
              (item.name ?? '').toLowerCase().includes(kw) ||
              (item.description ?? '').toLowerCase().includes(kw)
            return categoryMatched && keywordMatched
          })
          const start = (nextPage - 1) * pageSize
          const slice = filteredListRef.current.slice(start, start + pageSize)
          setList(prev => (reset ? slice : [...prev, ...slice]))
          pageRef.current = nextPage
          setHasMore(start + pageSize < filteredListRef.current.length)
        }
      } catch (caught) {
        if (requestIdRef.current !== requestId) return
        // ★与原文的差异：请求抛错（本机 401 / 上游故障 / 网络断）在原文里会变成"空列表"；
        // 这里记成可读事实，由页面说出来（本行也是本文件唯一一处 catch，不吞不默认）
        setError({
          code: escErrorCodeOf(caught),
          message: caught instanceof Error ? caught.message : '',
        })
        if (reset) {
          setList([])
          setHasMore(false)
        }
      } finally {
        // 仅最新请求允许复位加载标记（过期请求属于已被替代的查询）
        if (requestIdRef.current === requestId) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [adapters, resourceType, source, category, keyword, spaceId, spaceIds, pageSize],
  )

  const loadRef = useRef(load)
  loadRef.current = load

  // 筛选条件变化时重置加载
  useEffect(() => {
    pageRef.current = 0
    rawListRef.current = null
    filteredListRef.current = []
    setList([])
    setHasMore(true)
    setError(undefined)
    void loadRef.current(true)
  }, [resourceType, source, category, keyword, spaceId, spaceIds])

  /** 滚动触底加载下一页。
   *
   * ★**本刀补上 `hasMore` 这道闸**（真机故障「下滑加载中不起作用、会一直闪屏」的根因之一）：
   *   这条不变量此前只写在"不满屏自动补拉"那一侧，触底入口**没有**——于是平台已经回过
   *   「没有下一页」时（实测 `/api/published/skill/list` ⇒ `current:1 pages:1 total:7`，第 2 页
   *   `records: []` 且 `pages: 1`），手指一到底部仍会一遍遍发同一条取不到东西的请求，每次在底部
   *   插一行「加载中…」再拆掉。收在这里之后两条入口（触底 + 自动补拉）都带这道闸，
   *   以后新增调用点也自动带上。
   */
  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return
    void loadRef.current(false)
  }, [])

  /** 就地更新单条卡片（不动筛选与分页，避免整页重拉丢失滚动加载位置）。 */
  const updateItem = useCallback((id: string, patch: Partial<ResourceItem>) => {
    const apply = (item: ResourceItem): ResourceItem => (item.id === id ? { ...item, ...patch } : item)
    setList(prev => prev.map(apply))
    // 客户端筛选模式的两层缓存同步更新，避免重新筛选后旧状态复活
    if (rawListRef.current) rawListRef.current = rawListRef.current.map(apply)
    filteredListRef.current = filteredListRef.current.map(apply)
  }, [])

  /** 整区刷新：重置分页与缓存后重拉第一页（与筛选条件变化触发的重置同流程）。 */
  const reload = useCallback(() => {
    pageRef.current = 0
    rawListRef.current = null
    filteredListRef.current = []
    setList([])
    setHasMore(true)
    setError(undefined)
    void loadRef.current(true)
  }, [])

  return { list, loading, hasMore, error, loadMore, updateItem, reload }
}

/**
 * 分类字典取数的纯投影（原文件里"按资源类型找根节点"的那三行判据）。
 *
 * 单独提出来是为了让"连接器按 `key === 'Connector'`、专家/技能按根节点 `type`"这条**口径差异**只写一次，
 * 且可以被测试直接盯住（不用起 React）。
 */
export function escCategoryChildrenOf(
  tree: readonly EscCategoryNode[] | undefined,
  rootType: string | undefined,
): readonly { readonly key: string; readonly label: string }[] {
  const list = tree ?? []
  const root = list.find(item =>
    rootType === undefined ? item.key === ESC_CONNECTOR_CATEGORY_ROOT_KEY : item.type === rootType,
  )
  const children = root?.children ?? []
  return children
    .filter(item => Boolean(item?.key))
    .map(item => ({ key: item.key, label: item.label || item.key }))
}
