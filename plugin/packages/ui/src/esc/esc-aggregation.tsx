/**
 * [INPUT]: 依赖 React 的 hook 原语、官方原语 `Button`、`esc-api` 的取数面、`esc-categories`/`esc-list` 两个数据 hook、`esc-card`/`esc-toolbar`/`esc-style` 的展示件与 `esc-copy` 的文案
 * [OUTPUT]: 对外提供 `EnterpriseEscAggregation`——工具栏 + 卡片网格 + 触底加载 + 三态（骨架/失败/空）
 * [POS]: esc 页面的**内容区**，移植自 NUWAX `ResourceAggregation/index.tsx`（831 行）里**本刀范围内**的那部分。
 *   ★留下了什么：主 tab 与二级分类状态、搜索 400ms 防抖、团队空间维度的两种寻址（具体空间 `spaceId` / 「全部」
 *   经 `spaceIds` 聚合）、`waitingSpace` 判定、首屏加载、触底加载、**不满屏自动补拉**（含窗口 resize 重判）、
 *   空态文案（`暂无数据`，原文如此）。
 *   ★**口径 35④**：首屏加载态与官方对齐——官方那一态是 `components/custom/Loading`（转圈 + 「加载中...」），
 *   本页原先自造了六张骨架卡；现换成同一枚（条件判据 `(loading || waitingSpace) && list.length === 0` 未变）。
 *   ★**没有**什么（A 档口径，逐条可查）：付费订阅拦截、专家召唤、技能立即使用、收藏/取消收藏、连接器连接/断开、
 *   连接启用开关、技能启用开关、四个业务弹窗（凭据/设备授权/统一专家卡/订阅套餐）。那些动作位在卡片上**置灰并在
 *   `title` 里写明原因**，不是删掉。
 *   ★三处**如实差异**：① 原页面把筛选状态同步到 URL（`history.replace`）以便刷新/分享还原——DSH 的独立页面
 *   没有这个页内 URL，故去掉（左栏重复点击驱动的整区刷新仍按原文用 `key` remount 实现）；
 *   ② 原页面读不到数据时静默画空态，这里画出**失败态 + 稳定码 + 重试**；
 *   ③ 未登录（平台回 401）单独成一态：写明"请先登录 NUWAX 账号"，而不是显示成"平台没有数据"。
 *   ★`react-infinite-scroll-component` 换成容器自身的 `onScroll` 判据（同一个容器、同一个滚动源，行为等价）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Inbox, LoaderCircle } from 'lucide-react'
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { EnterpriseEscApi } from './esc-api.js'
import { EnterpriseEscCard } from './esc-card.js'
import { useEnterpriseEscCategories } from './esc-categories.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { useEnterpriseEscResourceList } from './esc-list.js'
import { EnterpriseEscToolbar } from './esc-toolbar.js'
import type { ResourceSourceEnum, ResourceTypeEnum } from './esc-types.js'

/** 触底判据的提前量：距底 80px 就拉下一页（原 `InfiniteScroll` 的默认手感）。 */
const SCROLL_THRESHOLD_PX = 80

/** 内容区入参。 */
export interface EnterpriseEscAggregationProps {
  readonly api: EnterpriseEscApi
  /** 资源类型（左栏选中项）。 */
  readonly resourceType: ResourceTypeEnum
}

/** 工具栏下方那句如实说明（本页新增，不是原文的一部分）。 */
const READ_ONLY_NOTE = '动作按钮尚未在 DSH 侧接入，本页先只读展示目录'

/** 资源聚合内容区。 */
export function EnterpriseEscAggregation({ api, resourceType }: EnterpriseEscAggregationProps): ReactNode {
  // 主 tab：系统广场/团队空间（连接器另有"已连接的"、技能另有"我启用的"）
  const [source, setSource] = useState<ResourceSourceEnum>('system')
  // 二级分类 key（空串=全部；团队维度下它承载空间 id）
  const [category, setCategory] = useState<string>('')
  // 搜索关键字（输入值 + 防抖值）
  const [keywordInput, setKeywordInput] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')

  const { categories, unavailable } = useEnterpriseEscCategories(resourceType, source, api)

  // 团队维度「全部」页签的聚合查询参数：全部空间 ID（连接器走 scope=space 不消费；系统广场维度不依赖）
  const teamSpaceIds = useMemo(() => {
    if (source !== 'team' || resourceType === 'connector') return undefined
    return categories
      .map(item => Number(item.key))
      .filter(id => Number.isFinite(id) && id > 0)
  }, [source, resourceType, categories])

  // 列表请求用的空间 ID：团队维度选中具体空间时 = 该空间
  const listSpaceId = useMemo(() => {
    if (source !== 'team') return undefined
    const id = Number(category)
    return Number.isFinite(id) && id > 0 ? id : undefined
  }, [source, category])

  // 团队维度：分类（空间）key 不在空间列表中时回落「全部」（原文同判据）
  useEffect(() => {
    if (source !== 'team' || categories.length === 0) return
    if (!categories.some(item => item.key === category)) setCategory(categories[0]?.key ?? '')
  }, [source, categories, category])

  const { list, loading, hasMore, error, loadMore, reload } = useEnterpriseEscResourceList({
    api,
    resourceType,
    source,
    category: source === 'team' ? '' : category,
    keyword,
    spaceId: listSpaceId,
    // 「全部」页签：spaceIds 携带全部空间（具体空间页签不传）
    spaceIds: source === 'team' && !category ? teamSpaceIds : undefined,
    pageSize: 20,
  })

  // 搜索防抖 400ms（原文同值）
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput), 400)
    return () => window.clearTimeout(timer)
  }, [keywordInput])

  // 滚动容器与内容区，用于不满屏自动补拉
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  /** 列表内容没填满容器且还有更多 ⇒ 自动补拉（原文同判据，含 100ms 延迟）。 */
  const checkAndAutoFill = useCallback(() => {
    if (!containerRef.current || !contentRef.current || loading || !hasMore || list.length === 0) return
    if (contentRef.current.scrollHeight <= containerRef.current.clientHeight) loadMore()
  }, [loading, hasMore, list, loadMore])

  useEffect(() => {
    const timer = window.setTimeout(checkAndAutoFill, 100)
    return () => window.clearTimeout(timer)
  }, [list, checkAndAutoFill])

  // 窗口大小变化时重新检查（原文同）
  useEffect(() => {
    const handleResize = (): void => checkAndAutoFill()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [checkAndAutoFill])

  // 触底加载下一页（替换 react-infinite-scroll-component：同一个滚动容器、同一条判据）
  const handleScroll = useCallback(
    (event: { readonly currentTarget: HTMLDivElement }) => {
      const el = event.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX) loadMore()
    },
    [loadMore],
  )

  // 团队空间维度等待空间数据就绪（专家/技能「全部」页签需 spaceIds、具体空间页签需 spaceId）；
  // 连接器维度「全部」页签无 spaceId 也可请求（scope 聚合），不等待
  const waitingSpace =
    source === 'team' && resourceType !== 'connector' && !listSpaceId && !(teamSpaceIds && teamSpaceIds.length > 0)
  // 首屏加载（非滚动加载更多）才显示整屏骨架
  const initialLoading = (loading || waitingSpace) && list.length === 0
  const signedOut = error?.code === 'ENT_AUTH_REQUIRED'

  return createElement(
    'div',
    { className: 'esc-content' },
    createElement(EnterpriseEscToolbar, {
      resourceType,
      source,
      onSourceChange: next => {
        setSource(next)
        // 系统广场（分类 key）、团队空间（空间 id）、已连接的（分类 key）各维度 key 命名空间不同，
        // 切换后清空选中回到"全部"（原文同口径）
        setCategory('')
      },
      categories,
      activeCategory: category,
      onCategoryChange: setCategory,
      keyword: keywordInput,
      onKeywordChange: setKeywordInput,
      // 连接器页不展示"更多"入口（产品要求），专家/技能页保留
      showMore: resourceType !== 'connector',
      categoriesUnavailable: unavailable,
    }),
    createElement('div', { className: 'esc-toolbar-note', children: READ_ONLY_NOTE }),
    signedOut === true
      ? createElement(
          'div',
          { className: 'esc-gate' },
          createElement('div', { className: 'esc-gate-title', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle }),
          createElement('div', { className: 'esc-gate-body', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody }),
          createElement(Button, { variant: 'outline', size: 'sm', onClick: reload, children: ENTERPRISE_ESC_LOCAL_COPY.retry }),
        )
      : initialLoading
        ? createElement(
            // ★口径 35④：官方那一态画的是 `components/custom/Loading`（一枚转圈图标 + 「加载中...」，
            //   居中、色走主色、字号 12、间距 8px）。原先是本页自造的六张骨架卡，现按官方换成同一枚。
            'div',
            { className: 'esc-loading', 'aria-busy': true },
            createElement(LoaderCircle, { size: 16, className: 'esc-loading-icon', 'aria-hidden': true }),
            createElement('span', { children: ENTERPRISE_ESC_COPY.loading }),
          )
        : list.length > 0
          ? createElement(
              'div',
              { className: 'esc-scroll esc-scroll-hidden', ref: containerRef, onScroll: handleScroll },
              createElement(
                'div',
                { className: 'esc-list-section', ref: contentRef },
                list.map(item =>
                  createElement(EnterpriseEscCard, {
                    key: item.id,
                    item,
                    // 专家&专家团卡片图标裁圆（技能/连接器保持方形口径）
                    iconShape: resourceType === 'expert' ? 'circle' : 'square',
                    showSummon: resourceType === 'expert',
                    showUse: resourceType === 'skill',
                    // 底部统计行仅专家卡片展示（技能本就无统计；连接器工具数统计已下线）
                    showStats: resourceType === 'expert',
                    showConnect: resourceType === 'connector',
                  }),
                ),
              ),
              // 触底加载中的提示 + 追加加载失败的如实行（原文只有 loader）
              loading ? createElement('div', { className: 'esc-state', children: '加载中…' }) : null,
              error !== undefined
                ? createElement(ErrorRow, { code: error.code, message: error.message, onRetry: reload })
                : null,
            )
          : error !== undefined
            ? createElement(ErrorRow, { code: error.code, message: error.message, onRetry: reload })
            : createElement(EmptyBlock),
  )
}

/**
 * 空态：官方那一态画的是 antd `<Empty>`（一张插图 + 「暂无数据」四个字）。
 *
 * dsh 的原语里**没有** Empty/NoData 组件（清单见 `dsh-client-ui-primitives`），故按 dsh 的 token 画一张
 * 等价插图：一枚灰底圆角方块 + 里面的 lucide `Inbox`（与本页其它图标同一套图源）。文案仍**逐字**用官方那枚
 * `PC.Common.Global.emptyData`（`ENTERPRISE_ESC_COPY.emptyData`）——不翻译、不改写。
 */
function EmptyBlock(): ReactNode {
  return createElement(
    'div',
    { className: 'esc-state' },
    createElement(
      'div',
      { className: 'esc-empty-art', 'aria-hidden': 'true' },
      createElement(Inbox, { size: 28, strokeWidth: 1.5 }),
    ),
    createElement('div', { children: ENTERPRISE_ESC_COPY.emptyData }),
  )
}

/** 失败行：稳定码 + 平台原话 + 重试（原文在这一态画的是空态，故这是本页新增的一态）。 */
function ErrorRow({
  code,
  message,
  onRetry,
}: {
  readonly code: string
  readonly message: string
  readonly onRetry: () => void
}): ReactNode {
  return createElement(
    'div',
    { className: 'esc-state' },
    createElement('div', { className: 'esc-state-title esc-state-error', children: ENTERPRISE_ESC_LOCAL_COPY.loadFailed }),
    message.length > 0 ? createElement('div', { className: 'esc-state-code', children: message }) : null,
    createElement('div', { className: 'esc-state-code', children: code }),
    createElement(Button, { variant: 'outline', size: 'sm', onClick: onRetry, children: ENTERPRISE_ESC_LOCAL_COPY.retry }),
  )
}
