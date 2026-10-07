/**
 * [INPUT]: 依赖 React 的 hook 原语、`esc-api` 的 `EnterpriseEscApi` 契约、`esc-constants` 的成功码与分类根映射、`esc-types` 的归一化类型与 `mapPublishedStats`
 * [OUTPUT]: 对外提供 `useEnterpriseEscResourceList`（`{list, loading, hasMore, error, loadMore, updateItem, reload}`）与 `escResourceAdapters` 适配器表（各资源类型 × 数据源的取数与提取口径）
 * [POS]: esc 页面的**归一化数据层**，逐字移植自 NUWAX `ResourceAggregation/hooks/useResourceList.ts`（574 行）。
 *   ★改动的只有三处**注入点**，判定逻辑一字未动：① `@/services/*` 那六个函数 → `EnterpriseEscApi` 的六个同签名方法；
 *   ② `SUCCESS_CODE` → `ESC_SUCCESS_CODE`；③ umi 的类型 → 本包 `esc-types`。
 *   ★**新增一处如实缺口**（原文件没有）：失败不再静默画空态——`code !== '0000'` 或请求抛错时把稳定码与平台原文
 *   记进 `error`，由页面说出来（仓库的 no-silent-swallow 门禁也要求如此；原页面"读失败=空列表"会让员工以为"平台没有东西"）。
 *   ★原有纪律逐条保留：过期响应丢弃（`requestIdRef`）、重置加载必须放行（否则新条件的请求发不出去）、
 *   全量接口的内存切片与双击防重入、`updateItem` 的两层缓存同步。
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
 * ★按**取数面**分（本刀纠正）：连接器面缺的是连接器目录，专家/技能面缺的是"这一类目录"。
 *   上一刀那条映射**不看面**、对任何一面都说"没有连接器目录"——专家/技能面一旦也回 `4040`，
 *   那就是在跟员工说假话。三枚码本身仍在 `error-messages.ts` 那张唯一码表里，
 *   这里只决定"哪一面取哪一枚"。
 *   ★导出是为了让测试直调核对**每一面各自那一枚**（与 `escCategoryChildrenOf` 同一个做法）。
 */
export function missingEndpointCodeOf(resourceType: ResourceTypeEnum): string {
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

/** 广场已发布条目（智能体/技能）归一化（逐字对齐原文件，含"哪些维度填 agentId/skillId"的判据）。 */
const mapPublishedItem = (item: EscPublishedItem, idPrefix: string): ResourceItem => ({
  id: `${idPrefix}-${item.id}`,
  agentId: idPrefix === 'agent' || idPrefix === 'space-agent' ? item.targetId : undefined,
  skillId:
    idPrefix === 'skill' || idPrefix === 'space-skill' || idPrefix === 'enabled-skill' ? item.targetId : undefined,
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
      enabled: {
        mode: 'client',
        fetchAll: async () => api.publishedSkillEnableList({}),
        extractAll: res => {
          const data = res.data
          // 不带分页参数时后端可能直接回数组、也可能仍套 records 分页壳，两者兼容（原文件同口径）
          const records = Array.isArray(data)
            ? (data as readonly EscPublishedItem[])
            : ((data as EscPage<EscPublishedItem> | null | undefined)?.records ?? [])
          return records.map(item => mapPublishedItem(item, 'enabled-skill'))
        },
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
      enabled: {
        mode: 'client',
        serverKeyword: true,
        serverCategory: true,
        fetchAll: ({ keyword, category }) =>
          api.connectorProviderPageList({
            connectionEnabled: 'true',
            category: category || undefined,
            keyword: keyword || undefined,
          }),
        extractAll: res => {
          const data = res.data
          const records = Array.isArray(data)
            ? (data as readonly EscConnectorProvider[])
            : ((data as EscPage<EscConnectorProvider> | null | undefined)?.records ?? [])
          return records.map(item => mapConnectorItem(item, 'enabled-conn'))
        },
      },
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
            setError({ code: escPlatformErrorCode(res?.code, missingEndpointCodeOf(resourceType)), message: typeof res?.message === 'string' ? res.message : '' })
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
              setError({ code: escPlatformErrorCode(res?.code, missingEndpointCodeOf(resourceType)), message: typeof res?.message === 'string' ? res.message : '' })
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

  /** 滚动触底加载下一页。 */
  const loadMore = useCallback(() => {
    if (loadingRef.current) return
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
