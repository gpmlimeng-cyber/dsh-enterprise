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
 *   ★`react-infinite-scroll-component` 换成容器自身的 `onScroll` 判据。
 *   ★**本刀（用户裁决「移动端页面不要冻结、支持全屏滚动」）**：滚动面在两种档位下**不是同一个元素**——
 *   桌面档是列表（`.esc-scroll`，工具栏钉死）；移动档（触屏/窄/矮）整个内容区（`.esc-content`）才是滚动面
 *   （样式表那条 @media 定的）。因此触底加载与「不满屏自动补拉」都改成**问真正在滚的那一个**
 *   （`activeScroller()`：判据是真实溢出，不是 `matchMedia`——断点只有一个真源）。
 *   ★**本刀（用户裁决②③⑧ + 补半成品）**：① 顶栏「已安装(N)」的计数**真正接线**了——上一刀只定义了
 *   `installedCount` 这个 prop 却没人去读那份清单，真机截图里「已安装」光秃秃没有数字。
 *   本刀经 `api.installedSkills()`（复用 `GET /skills/installed` 那份**既有真值**，不是新接口）读一次，
 *   **只在技能页读**；`undefined`＝读不到（顶栏出 `？`）、数字＝真读到了，**绝不用 0 顶替"读不到"**。
 *   ② 技能卡的「+」与「更多+去试试」按**已装清单**分流。★**匹配键是名字，不是 id**（实测纠正）：
 *   已装那份的 `packageId` 是雪花号（实测 `2105915576743428098`）、广场那条的 `id` 是 `4194`，
 *   两套坐标系对不上；真正的公共键是 kebab 名（已装 `skillId` / 广场 `name`）。
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
import { enterpriseErrorMessage, enterpriseErrorRetryable } from '../error-messages.js'
import { EnterpriseEscFeatured } from './esc-featured.js'
import { EnterpriseEscResourceTabs } from './esc-resource-tabs.js'
import { EnterpriseEscToolbar } from './esc-toolbar.js'
import type { ResourceSourceEnum, ResourceTypeEnum } from './esc-types.js'

/** 触底判据的提前量：距底 80px 就拉下一页（原 `InfiniteScroll` 的默认手感）。 */
const SCROLL_THRESHOLD_PX = 80

/**
 * 触底判据（纯函数，`handleScroll` 与门禁共用同一条）。
 *
 * ★**本刀修的就是这里**（真机故障「下滑加载中不起作用、会一直闪屏」）。原判据只看"离底多近"，
 *   **从不问 `hasMore`**：平台已经回过"没有下一页"（实测 `/api/published/skill/list` ⇒ `current:1
 *   pages:1 total:7`，本页 7 条；再要第 2 页 ⇒ `records: []` 且 `pages: 1`），可手指一到底部就一遍遍
 *   发同一条取不到东西的请求（Android 在回弹/按压期间**会持续发 scroll**），每次都在列表末尾插一行
 *   「加载中…」再拆掉 ⇒ 看到的正是"加载不起作用"+"一直闪"。
 *   上一刀把滚动面从列表那口小格子挪到整页（用户裁决「不要冻结、支持全屏滚动」）之后，手指才**够得着**
 *   这个触发点——所以它是那一刀**暴露**出来的老洞，不是新写坏的。
 * ★另外两条同源纪律：请求在途时不再叠加（`loading`）；本筛选集下已判定"补拉无进展"时不再自动重试
 *   （`suppressed`，见 `decideAutoFill`）。用户换筛选条件/点重试会解闩。
 */
export function shouldTriggerBottomLoad(input: {
  readonly scrollHeight: number
  readonly scrollTop: number
  readonly clientHeight: number
  readonly hasMore: boolean
  readonly loading: boolean
  readonly suppressed: boolean
}): boolean {
  if (!input.hasMore || input.loading || input.suppressed) return false
  return input.scrollHeight - input.scrollTop - input.clientHeight <= SCROLL_THRESHOLD_PX
}

/** 「不满屏自动补拉」的三态裁决（纯函数）。 */
export type AutoFillDecision =
  /** 滚动面确实不满屏且还有下一页 ⇒ 补一页。 */
  | 'pull'
  /** 不需要补（已经能滚 / 没有下一页 / 正在加载 / 列表还空着）。 */
  | 'idle'
  /** 上一次补拉**没有让列表变长** ⇒ 上闩停手（否则每 100ms 一次，就是"一直闪"）。 */
  | 'suppress'

/**
 * 「列表没填满滚动面 ⇒ 自动补拉」判据。**上一刀把滚动面挪到整页时这里踩了两个洞，本刀一起堵：**
 *
 * ① **两个高度必须来自同一个盒子**。旧写法是「卡片区 `.esc-list-section` 的 scrollHeight」比
 *    「滚动面的 clientHeight」。桌面档滚动面就是那口格子、里面只装卡片，比得公平；手机档滚动面是
 *    **整页** `.esc-content`（工具栏/精选/维度/分类全在里面），卡片区只是它的一部分 ⇒ 卡片**永远**
 *    比"视口"矮 ⇒ 判据恒真，一路把页拉光（问错了盒子）。
 *    现在问滚动面**它自己**：`scrollHeight <= clientHeight + 1` 就是"这个面没东西可滚"。
 * ② **补拉必须有进展**。列表长度与上次补拉时相同（空页、同批页、或请求失败）⇒ 再补也是同一结果，
 *    直接上闩（返回 `suppress`），由调用方置位并停止自动补拉。
 */
export function decideAutoFill(input: {
  readonly scrollerScrollHeight: number
  readonly scrollerClientHeight: number
  readonly hasMore: boolean
  readonly loading: boolean
  readonly listLength: number
  /** 上一次补拉发起时的列表长度（-1 = 本筛选集下还没补拉过）。 */
  readonly previousLength: number
  readonly suppressed: boolean
}): AutoFillDecision {
  if (input.suppressed) return 'idle'
  if (input.loading || !input.hasMore || input.listLength === 0) return 'idle'
  // 补过一轮但列表没长 ⇒ 空页/同批页/失败，再补也是同一结果
  if (input.previousLength >= 0 && input.listLength === input.previousLength) return 'suppress'
  return input.scrollerScrollHeight <= input.scrollerClientHeight + 1 ? 'pull' : 'idle'
}

/** 内容区入参。 */
export interface EnterpriseEscAggregationProps {
  readonly api: EnterpriseEscApi
  /** 资源类型（左栏选中项）。 */
  readonly resourceType: ResourceTypeEnum
  /**
   * ★用户裁决④：切换资源类型（**含「重复点当前项也要重拉**，与原页面那个 `_t` 令牌同义**）。
   * 由 `esc-page` 持有状态与刷新令牌，本层只负责把页签的点击交上去。
   */
  readonly onResourceTypeChange?: ((code: ResourceTypeEnum) => void) | undefined
}

/** 工具栏下方那句如实说明（本页新增，不是原文的一部分）。 */

/** 资源聚合内容区。 */
export function EnterpriseEscAggregation({ api, resourceType, onResourceTypeChange }: EnterpriseEscAggregationProps): ReactNode {
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

  // 滚动容器，用于不满屏自动补拉
  const containerRef = useRef<HTMLDivElement | null>(null)
  /**
   * ★移动端那一档（触屏/窄/矮，见 `esc-style.ts` 里同名的那条 @media）把**滚动面从列表挪到了内容区**：
   *   `.esc-content` 成为滚动容器、`.esc-scroll` 退回普通块。于是"到底谁在滚"在两种档位下不同，
   *   而「不满屏自动补拉」必须问**真正在滚的那一个**要 `clientHeight`
   *   （问错了的后果：手机上一口气把所有页都拉光）。
   *   ★判据取真实溢出（`scrollHeight > clientHeight`）而不是 `matchMedia`：断点只有一个真源（样式表），
   *     JS 不另立一套断点，两边不可能漂移；样式改档位时这里自动跟随。
   *   ★本刀补一句：**两个高度必须来自同一个盒子**——旧写法拿"卡片区高度"比"滚动面视口高"，
   *     手机档必然误判（详见 `decideAutoFill` 的注释）。
   */
  const boxRef = useRef<HTMLDivElement | null>(null)
  const activeScroller = useCallback((): HTMLDivElement | null => {
    const box = boxRef.current
    if (box !== null && box.scrollHeight > box.clientHeight + 1) return box
    return containerRef.current
  }, [])

  /**
   * ★本刀：「补拉无进展」闩锁 + 上次补拉发起时的列表长度（判据见文件头的 `decideAutoFill`）。
   * `lastFillLengthRef === -1` 表示本筛选集下还没补拉过——不能拿它当"没进展"。
   */
  const suppressedRef = useRef<boolean>(false)
  const lastFillLengthRef = useRef<number>(-1)
  const clearFillLatch = useCallback((): void => {
    suppressedRef.current = false
    lastFillLengthRef.current = -1
  }, [])

  // 换资源类型/换维度/换分类/换关键字 ⇒ 这是**新查询**，解闩（"补过了没进展"只对同一批数据成立）
  useEffect(() => {
    clearFillLatch()
  }, [clearFillLatch, resourceType, source, category, keyword, listSpaceId, teamSpaceIds])

  /** 列表没填满滚动面且还有更多 ⇒ 自动补拉（100ms 延迟照原文；判据见 `decideAutoFill`）。 */
  const checkAndAutoFill = useCallback(() => {
    const scroller = activeScroller()
    if (scroller === null) return
    const decision = decideAutoFill({
      scrollerScrollHeight: scroller.scrollHeight,
      scrollerClientHeight: scroller.clientHeight,
      hasMore,
      loading,
      listLength: list.length,
      previousLength: lastFillLengthRef.current,
      suppressed: suppressedRef.current,
    })
    if (decision === 'suppress') {
      // 补过一轮而列表没长（空页/同批页/失败）⇒ **停手**：再补也是同一结果，而每 100ms 重来一次
      // 就是用户看见的"一直闪"。要解闩得换筛选条件、换页签，或点失败行上的「重试」。
      suppressedRef.current = true
      return
    }
    if (decision !== 'pull') return
    lastFillLengthRef.current = list.length
    loadMore()
  }, [activeScroller, loading, hasMore, list, loadMore])

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
      // ★判据收进纯函数（`shouldTriggerBottomLoad`）：它必须问 `hasMore`——见那里的注释，
      //   "平台说没有下一页了还一遍遍发请求"正是真机上"一直闪、加载不起作用"的来处。
      if (
        !shouldTriggerBottomLoad({
          scrollHeight: el.scrollHeight,
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
          hasMore,
          loading,
          suppressed: suppressedRef.current,
        })
      ) {
        return
      }
      loadMore()
    },
    [loadMore, hasMore, loading],
  )

  /** 「重试」：解闩后再重拉（失败/空页之后用户明确要求再试一次，闩锁不该拦着）。 */
  const retry = useCallback((): void => {
    clearFillLatch()
    reload()
  }, [clearFillLatch, reload])

  // 团队空间维度等待空间数据就绪（专家/技能「全部」页签需 spaceIds、具体空间页签需 spaceId）；
  // 连接器维度「全部」页签无 spaceId 也可请求（scope 聚合），不等待
  const waitingSpace =
    source === 'team' && resourceType !== 'connector' && !listSpaceId && !(teamSpaceIds && teamSpaceIds.length > 0)
  // 首屏加载（非滚动加载更多）才显示整屏骨架
  const initialLoading = (loading || waitingSpace) && list.length === 0
  const signedOut = error?.code === 'ENT_AUTH_REQUIRED'

  /**
   * ★本刀补上：顶栏那枚「已安装(N)」的计数。
   *
   * 上一刀把 `installedCount` 这个 prop **定义好了却没接线**——真机截图里「已安装」光秃秃没有数字，
   * 就是因为没人去读那份清单。这一刀补上，并守住两条纪律：
   * ① **只有技能页读**（专家/连接器页顶栏不显示这枚控件，读了就是白白发一条请求）；
   * ② `installedCount` 三态分明——`undefined`＝**读不到**（工具栏出「已安装」不带数字、另缀一枚 `？`），
   *    数字＝真读到了（哪怕是 0，那也是"确实一个都没装"）；**绝不用 0 顶替"读不到"**，
   *    写 0 等于对用户谎称「这台机器上一个技能都没装」。
   */
  const [installedCount, setInstalledCount] = useState<number | undefined>(undefined)
  const [installedReadFailed, setInstalledReadFailed] = useState(false)
  /** 已装包 id 集合（卡片据此在「+」与「更多+去试试」之间分流）。读不到时是空集 ⇒ 按"未装"画「+」。 */
  const [installedIds, setInstalledIds] = useState<ReadonlySet<string>>(new Set<string>())
  useEffect(() => {
    if (resourceType !== 'skill') return
    const controller = new AbortController()
    setInstalledCount(undefined)
    setInstalledReadFailed(false)
    setInstalledIds(new Set<string>())
    api
      .installedSkills(controller.signal)
      .then(list => {
        if (controller.signal.aborted) return
        setInstalledCount(list.length)
        // ★**实测纠正**（别照我上一版的猜测）：已装清单的 `packageId` 是雪花号
        //   （实测 `2105915576743428098`），而广场列表那条的 `id` 是 `4194` —— **两套坐标系对不上**。
        //   真正的公共键是**名字**：已装那份有 `skillId`（kebab 名，如 `interactive-architecture-diagram`），
        //   广场那份有 `name`（同为 kebab 名，如 `dev-engineer-toolkit`）。
        //   故这里收**名字集合**，不去收 packageId（收了就永远命中不了）。
        setInstalledIds(new Set(list.map(each => each.skillId)))
      })
      .catch(() => {
        // ★读不到就如实说读不到（交工具栏出那枚 `？`），**不回落成 0**、也不把整页拖进失败态。
        if (controller.signal.aborted) return
        setInstalledReadFailed(true)
      })
    return () => controller.abort()
  }, [api, resourceType])

  return createElement(
    'div',
    // ★本刀（用户裁决「移动端不要冻结、支持全屏滚动」）：内容区自己也是**滚动面**——
    //   桌面档它是 `overflow: hidden`（滚动在下面那口 `.esc-scroll` 格子里，工具栏钉死）；
    //   移动档（触屏/窄/矮）由样式表把它变成滚动容器 ⇒ 工具栏/精选/维度/分类与卡片一起滚。
    //   所以 `onScroll` 这里也挂一份：挪了滚动面之后，触底加载必须跟着挪（同一条 `handleScroll`，
    //   判据读 `currentTarget`，两档各自成立）。
    { className: 'esc-content', ref: boxRef, onScroll: handleScroll },
    // ★用户裁决④ + 本刀：三页签排进**工具栏第一栏左侧**（与「更多/搜索/已安装/添加」同处那一行
    //   ⇒ 同排由 flex 保证）；「精选」那一行走工具栏**第二栏**（`belowLeading`：三页签之下、
    //   维度标签之上），**专家页与技能页都挂**（两页只有 `targetType` 不同），连接器页不挂。
    //   ★原先这段注释写的是"精选只在技能页出现"——与实现不符，本刀按实现改正。
    createElement(EnterpriseEscToolbar, {
      // ★用户裁决④：三页签作为**主行左侧插槽**进去（与右块同一个 flex 行），不再是兄弟元素
      leading: onResourceTypeChange === undefined
        ? undefined
        : createElement(EnterpriseEscResourceTabs, {
            activeKey: resourceType,
            onSelect: onResourceTypeChange,
          }),
      // ★用户裁决：「精选」排在**第二栏**（三页签那一行之下、维度标签之上）
      belowLeading:
        resourceType === 'skill' || resourceType === 'expert'
          ? createElement(EnterpriseEscFeatured, {
              api,
              targetType: resourceType === 'skill' ? 'Skill' : 'Agent',
            })
          : undefined,
      resourceType,
      installedCount,
      installedCountFailed: installedReadFailed,
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
    signedOut === true
      ? createElement(
          'div',
          { className: 'esc-gate' },
          createElement('div', { className: 'esc-gate-title', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle }),
          createElement('div', { className: 'esc-gate-body', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody }),
          createElement(Button, { variant: 'outline', size: 'sm', onClick: retry, children: ENTERPRISE_ESC_LOCAL_COPY.retry }),
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
                { className: 'esc-list-section' },
                list.map(item =>
                  createElement(EnterpriseEscCard, {
                    key: item.id,
                    item,
                    // 专家&专家团卡片图标裁圆（技能/连接器保持方形口径）
                    iconShape: resourceType === 'expert' ? 'circle' : 'square',
                    showSummon: resourceType === 'expert',
                    showUse: resourceType === 'skill',
                    // ★本刀：技能卡按「这个技能在不在已装清单里」在两种动作形态间分流。
                    //   匹配键是**名字**（见上面那段实测纠正：packageId 与广场 id 不是一套坐标系）。
                    //   命中不到就按未装画「+」——宁可少给一次「更多」，也不谎称已装。
                    installed: resourceType === 'skill' && installedIds.has(item.name),
                    // 底部统计行仅专家卡片展示（技能本就无统计；连接器工具数统计已下线）
                    showStats: resourceType === 'expert',
                    showConnect: resourceType === 'connector',
                  }),
                ),
              ),
              // 触底加载中的提示 + 追加加载失败的如实行（原文只有 loader）
              // ★本刀：这行原先复用整屏态那枚 `.esc-state`（内衬 20px ⇒ 出现/消失会把列表顶一下，
              //   在"一遍遍空补拉"的场景里就是看得见的闪）。换成**定高紧凑行** `.esc-scroll-loader`。
              loading ? createElement('div', { className: 'esc-scroll-loader', children: '加载中…' }) : null,
              error !== undefined
                ? createElement(ErrorRow, { code: error.code, message: error.message, onRetry: retry })
                : null,
            )
          : error !== undefined
            ? createElement(ErrorRow, { code: error.code, message: error.message, onRetry: retry })
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
  /** 上游自由文本。★**故意不渲染**（见下面那行注释）——保留入参是为了调用方不必改签名。 */
  readonly message: string
  readonly onRetry: () => void
}): ReactNode {
  return createElement(
    'div',
    { className: 'esc-state' },
    createElement('div', { className: 'esc-state-title esc-state-error', children: enterpriseErrorMessage(code) }),
    /* ★平台那句**自由文本不再直接上屏**。真机截图里那行英文原话（`No static resource
       api/connector/providers.` 之类）被人直接读到了——那是**上游的实现细节**，不是给用户看的话，
       而且它其实在说「NUWAX 那边没有这个端点」，用户读不出下一步该做什么。
       **保留**的是那一枚稳定码（`4040` 这类）：它可检索、能定位，且不含任何实现细节。
       这一条纪律与全仓 `no-silent-swallow` 那条一致——**说出来，但只说人话 + 稳定码**。 */
    createElement('div', { className: 'esc-state-code', children: code }),
    // ★不可重试的失败（部署缺能力那类）**不画「重试」**——重试对它永远无效，
    //   画一枚只会把人引向死路（全仓 error-messages 的 retryable 纪律）。
    enterpriseErrorRetryable(code)
      ? createElement(Button, { variant: 'outline', size: 'sm', onClick: onRetry, children: ENTERPRISE_ESC_LOCAL_COPY.retry })
      : null,
  )
}
