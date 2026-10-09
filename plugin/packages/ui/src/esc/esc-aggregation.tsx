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
 *   **只在技能页读**；`undefined`＝没读到真值（工具栏按用户裁决把数字位画 `(0)`，并用 `title` 说清
 *   "这是暂定值"）、数字＝真读到了。★**用户裁决（读不到 ⇒ 0）**：这两态在按钮上同形，如实交代全在 title。
 *   ② 技能卡的「+」与「更多+去试试」按**已装清单**分流。★**匹配键是名字，不是 id**（实测纠正）：
 *   已装那份的 `packageId` 是雪花号（实测 `2105915576743428098`）、广场那条的 `id` 是 `4194`，
 *   两套坐标系对不上；真正的公共键是 kebab 名（已装 `skillId` / 广场 `name`）。
 *   ★**口径 43（本刀）**：这份 `installedIds` 现在也交给**精选行**（技能页）——那一行的卡片已改成
 *   广场那张卡，已装分流必须同源，否则同一条技能在上面写「+」、下面写「更多 + 去试试」。
 *   ★**口径 46/47**：新增 `skillPort`（本机技能写入口）与 `onOpenInstalled`；本地导入走**与商城页同一枚**
 *   `useEnterpriseSkillImport`，隐藏选择器与三态反馈挂在工具栏下方一格（触发钮在哪棵树，落点就在哪棵树）。
 *   ★**口径 60（本刀）**：技能页那条本地导入通路改走**队列驱动器** `useEnterpriseSkillImportQueue`
 *   （内部仍持同一枚单件状态机，见 `skill-import-port.tsx` 的长注释）＋**导入弹窗**
 *   `EnterpriseSkillImportDialog`（官方 Modal；拖拽区 + 多选按钮 + 逐项状态 + 批量摘要 + 装中禁关 +
 *   成功 toast/自动关闭）。`onAddSkill` 从此只**开窗**（不再点隐藏选择器）；本层新增的那一格状态
 *   `skillImportOpen` 就是这枚弹窗的开合。★**恒不可见选择器这张叶子仍在**（商城页照旧用它，一字未动）
 *   —— 本刀只换掉技能页这一条的入口形态，不删任何既有实现（门禁有反向锁盯着这条）。
 *   ★**口径 49（本刀）**：新增 `draftPort`（技能页下拉里「查找技能 / 创建技能」的实现面）——
 *   本层持那枚下拉的**开合态**与**预填失败态**（工具栏是纯投影、不持 hook），失败走唯一提示组件 +
 *   稳定码 `ENT_ESC_DRAFT_UNAVAILABLE`（人话 + 下一步在唯一码表里）；两项的调用**只有** `draftPort.launch`
 *   这一个出口，它内部就是 `preset-launch.ts` 的"跳新会话 + setDraft、**不发送**"——本层没有第二个开会话端口，
 *   也没有任何发送出口（门禁源码级反向锁）。
 *   ★**口径 51**：新增 `onOpenMyExperts`（专家页那枚「我的专家」切子页的入口，由页壳持有视图状态）
 *   ——本层只是把它原样交给工具栏（与 `onOpenInstalled` 同一条注入范式）。
 *   ★**用户裁决（读不到 ⇒ 0）**：顶栏计数读不到时，本层**照旧**把 `installedCount: undefined` +
 *   `installedCountFailed: true` 交上去（**计数来源与请求次数/时机一字未动**），由工具栏把数字位画成
 *   `(0)` 并在 title 里说明"这是暂定值"——本层不写假数、不吞失败，也不新增请求。
 *   ★**口径 54（本刀）**：「已安装」真源换成**官方发现面**（`api.discoveredSkills()`）—— 顶栏计数与
 *     广场/精选卡片的已装判定键由**同一处纯投影** `installedSnapshotFacts(snapshot)` 给出（`count` /
 *     `names` / `discovering` 三件事实同源，这是"计数与列表说的是同一件事"唯一可被机器判据证明的形态）；
 *     两份老记录**退出计数链**（降级为子页的来源/元信息）。三态纪律保留，`complete === false` 是第四态。
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
import { ENTERPRISE_ESC_DRAFT_FAILED_CODE, enterpriseErrorMessage, enterpriseErrorRetryable } from '../error-messages.js'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { EnterpriseEscFeatured } from './esc-featured.js'
import { EnterpriseEscResourceTabs } from './esc-resource-tabs.js'
import { EnterpriseEscToolbar } from './esc-toolbar.js'
import { EnterpriseSkillImportDialog } from '../skill-import-dialog.js'
import { useEnterpriseSkillImportQueue } from '../skill-import-port.js'
import type {
  EnterpriseEscAddSkillLock,
  EnterpriseEscDraftKind,
  EnterpriseEscDraftPort,
  EnterpriseEscSkillPort,
  ResourceSourceEnum,
  ResourceTypeEnum,
} from './esc-types.js'



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

/**
 * ★**口径 54**：官方发现面的一次快照 → 顶栏与广场卡片要用的**三件事实**（唯一投影）。
 *
 * 为什么非要抽成纯函数：本仓 vitest 跑不了 hook，而"计数"与"已装判定键"这两件事
 * **必须同源**（同一份假响应喂进去，两侧必须得到同一个数）—— 只有把这条投影抽出来，
 * "同源"才能被机器判据证明，而不是靠"看代码里两处写的都是 snapshot"。
 *
 * 三件事实：
 *   · `count` —— 顶栏「已安装(N)」画的那个数（**官方说几枚就几枚**，不是任何"两份之和"）；
 *   · `names` —— 广场卡片/精选行判"已装"用的**名字集合**（口径 47 那把公共键，口径 54 起
 *     对撞的是**磁盘真值**：报告里有这个名字就是真的装着）；
 *   · `discovering` —— 官方自己说"还没发现完"（`complete === false`）：这个数**还会变**，
 *     工具栏据此换掉 title（**不许当 0、不许写死数字**）。
 *
 * @param snapshot - `api.discoveredSkills()` 的返回值。
 * @returns 计数 / 名字集合 / 是否还在发现中。
 */
export function installedSnapshotFacts(snapshot: {
  readonly skills: readonly { readonly name: string }[]
  readonly complete: boolean
}): { readonly count: number; readonly names: ReadonlySet<string>; readonly discovering: boolean } {
  return {
    count: snapshot.skills.length,
    names: new Set(snapshot.skills.map(each => each.name)),
    discovering: snapshot.complete === false,
  }
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
  /**
   * ★口径 46：本机技能写入口（本地导入 + 自装清单 + 卸载）。
   *
   * 缺席 ⇒ 工具栏那枚「添加技能」回到"置灰 + 写明原因"那一态（不画一枚点了没反应的选择器）。
   * ★它**不进** `api`（那一面是结构性只读的，见 `esc-types.ts` 的长注释）。
   */
  readonly skillPort?: EnterpriseEscSkillPort | undefined
  /** ★口径 47：「已安装」那枚的入口（由页壳切视图；缺席即置灰写明原因）。 */
  readonly onOpenInstalled?: (() => void) | undefined
  /**
   * ★**口径 51**：专家页那枚「我的专家」的入口（由页壳切到「我的专家」子页）。
   *
   * 与 `onOpenInstalled` 同一条：缺席即置灰 + 行上写明原因（判据是端口，不是写死的 disabled）。
   * ★它**不带数据面**：子页今天要不到清单（本部署没有那条只读接口），内容区是一句如实交代
   *   （见 `esc-my-experts.tsx` 的头注）——故这里就**没有**第二枚端口要往下传。
   */
  readonly onOpenMyExperts?: (() => void) | undefined
  /**
   * ★**口径 49**：技能页主按钮下拉里「查找技能 / 创建技能」那两项的**实现面**
   * （跳新会话 + 把提示词预填进输入框、**不发送**）。
   *
   * 缺席 ⇒ 那两项置灰 + 写明原因（`esc-toolbar` 那一侧按"端口在不在场"判，不写死 disabled）。
   * ★它**不进** `api`（那一面是结构性只读的），也**不是**第二套开会话机制——
   *   真实现在 `preset-launch.ts`，由 `client.tsx` 用同一个 `createEnterprisePresetLauncher` 建。
   */
  readonly draftPort?: EnterpriseEscDraftPort | undefined
}

/** 工具栏下方那句如实说明（本页新增，不是原文的一部分）。 */

/** 资源聚合内容区。 */
export function EnterpriseEscAggregation({ api, resourceType, onResourceTypeChange, skillPort, onOpenInstalled, onOpenMyExperts, draftPort }: EnterpriseEscAggregationProps): ReactNode {
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
   * ② `installedCount` **四态**分明——`undefined`＝**没读到真值**、数字＝真读到了（哪怕是 0，那也是
   *    "确实一个都没装"）；★**用户裁决（读不到 ⇒ 0）**：界面上前两态**同一个形状**（都画 `(0)`，
   *    代价用户已接受），差别由工具栏那一侧写在 `title` 上（读不到 ⇒ `installedCountUnreadable`）
   *    —— 这是"不许静默吞掉读不到"的落点；本层只管如实把"读失败"这个事实交上去，不改数、不写 0。
   * ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：这一趟改读
   *    **官方发现面**（`api.discoveredSkills`，宿主 `ctx.get('skills')` 的快照 = 磁盘/运行时真值），
   *    不再读我们那两份记录。理由有一次真机取证：`~/.dsh/skills/` 上实有 **7** 枚技能，
   *    而企业那份记录只认 **1** 枚 —— "装了多少"这个问题，两份记录的回答必然是错的。
   *    ★两份老记录**降级为来源/元信息**（子页里用），**不再作"是否已装"的判据**（故本层不再读它们）。
   * ★**第四态（`complete === false`）**：官方自己说"还没发现完" ⇒ 数字位画的是**真的读到的那几个**
   *    （**不许当 0、不许写死数字**），同时把这件事交上去（`installedCountDiscovering`），
   *    由工具栏写成 title 那句「本机技能还在发现中，这个数字还会变」。
   */
  const [installedCount, setInstalledCount] = useState<number | undefined>(undefined)
  const [installedReadFailed, setInstalledReadFailed] = useState(false)
  /** ★口径 54 第四态：官方说它还没发现完。 */
  const [installedDiscovering, setInstalledDiscovering] = useState(false)
  /** 已装技能**名**集合（卡片据此在「+」与「更多+去试试」之间分流）。读不到时是空集 ⇒ 按"未装"画「+」。 */
  const [installedIds, setInstalledIds] = useState<ReadonlySet<string>>(new Set<string>())
  /**
   * ★口径 46：**本地导入成功之后**请上面那次读重跑一遍。
   *
   * ★口径 54 起它重跑的是**官方发现面**那一趟（导入真的落了盘 ⇒ 发现面该看到它；
   *   官方 watcher 是即时发现的，这一趟重读就是"新装的那枚出现在计数里"的机制）。
   */
  const [installedRefreshToken, setInstalledRefreshToken] = useState(0)
  useEffect(() => {
    if (resourceType !== 'skill') return
    const controller = new AbortController()
    setInstalledCount(undefined)
    setInstalledReadFailed(false)
    setInstalledDiscovering(false)
    setInstalledIds(new Set<string>())
    void (async () => {
      try {
        const snapshot = await api.discoveredSkills(controller.signal)
        if (controller.signal.aborted) return
        /**
         * ★**实测纠正**（沿革，仍然是这条键的由来）：中心已装清单的 `packageId` 是雪花号
         *   （实测 `2105915576743421088` 那一族），而广场列表那条的 `id` 是 `4194` ——
         *   **两套坐标系对不上**。真正的公共键是**名字**。口径 54 把这把公共键**升级为磁盘真值**：
         *   `installedSnapshotFacts` 收的就是发现面给的 kebab `name`（广场那份的 `name` 与它
         *   同一套命名），故命中率由真值决定。
         * ★三件事实**出自同一处投影**（`installedSnapshotFacts`）—— 计数、已装判定键、"还没发现完"
         *   不许各算一遍：它们必须同源，同源才谈得上"计数与列表说的是同一件事"。
         */
        const facts = installedSnapshotFacts(snapshot)
        setInstalledIds(facts.names)
        // ★**真值优先**：数字就是发现面报的那几个（不是两份记录长度相加 —— 那是"我们的账"）。
        setInstalledCount(facts.count)
        // ★官方自己说还没发现完 ⇒ 这一个数**还会变**：如实置旗（工具栏据此写 title 那句）。
        setInstalledDiscovering(facts.discovering)
      } catch {
        // ★读不到就如实说读不到（`installedCount` 留在 `undefined` + 置 `installedReadFailed`，
        //   工具栏据此把 `(0)` 的 title 写成"暂定值"那句），**不回落成 0**（本层不写假数）、
        //   也不把整页拖进失败态。
        if (controller.signal.aborted) return
        setInstalledReadFailed(true)
      }
    })()
    return () => controller.abort()
  }, [api, resourceType, installedRefreshToken])
  /**
   * ★口径 46：本地导入那台状态机（**与商城页同一枚 `useEnterpriseSkillImport`**）。
   *
   * ★**口径 60**：技能页那条路现在走**队列驱动器** `useEnterpriseSkillImportQueue`——它内部持的仍是
   *   上面那同一枚单件状态机（一份文件一份文件地交棒），故「预检 / multipart / 自装清单 / `onInstalled` 刷新」
   *   在本仓仍然只有一处实现；本层多出来的只有"一批文件排队"这一层（纯投影在 `skill-import-queue.ts`）。
   *   写入口缺席（没有本机写面）⇒ hook 返回 `undefined` ⇒ 菜单项置灰写明原因、弹窗一枚都不画。
   */
  const skillImportPort = useEnterpriseSkillImportQueue({
    uploadSkill: skillPort === undefined ? undefined : (file, signal) => skillPort.uploadSkill(file, signal),
    selfInstalledSkills: skillPort === undefined ? undefined : signal => skillPort.selfInstalledSkills(signal),
    // 导入成功后只做一件事：请"本机已装"那一趟读重跑（真值仍由它说，不在这里自己加减）。
    onInstalled: () => setInstalledRefreshToken(token => token + 1),
  })
  /**
   * ★**口径 60**：导入弹窗的开合态。
   *
   * 触发钮在工具栏里、弹窗挂在这一层（与口径 46 那枚隐藏选择器同一个落点：**触发钮在哪棵树，
   * 落点就在哪棵树**）。`onAddSkill` 从此只**开窗**——上传那件事由用户在弹窗里发起（拖入或选文件）。
   */
  const [skillImportOpen, setSkillImportOpen] = useState(false)

  /**
   * ★**口径 49**：技能页那枚主按钮下拉的**开合态**与**预填失败态**。
   *
   * 为什么这两件事住在这里而不是工具栏里：`esc-toolbar.tsx` 是**纯投影**（不持 hook、可直调，
   * 既有那一批结构锁正是靠这一点才成立）；开合是交互状态、预填是异步动作，两者都需要 hook
   * ⇒ 落在这一层，由它把「哪一项、什么状态」当 props 交上去。这也是"失败要可见"的落点：
   * 唯一提示组件（`EnterpriseErrorNotice`）挂在本层，人话 + 下一步 + 稳定码都走 `error-messages.ts`
   * 那张唯一码表 —— **绝不静默失败**。
   */
  const [addSkillMenuOpen, setAddSkillMenuOpen] = useState(false)
  const [draftFailure, setDraftFailure] = useState<EnterpriseEscDraftKind | undefined>(undefined)
  /**
   * 走会话的那两项：把**已经写好的那句提示词**交给 `preset-launch.ts` 那条唯一实现
   * （跳新会话 + `setDraft` 预填、**不发送**）。
   *
   * 三条诚实边界：
   *   ① 端口缺席或这次没走成（`false` / reject）⇒ 记下是哪一项，由下面那枚提示件说出来；
   *   ② 成功**什么都不做**：官方会把主视图切到那个新会话，草稿躺在输入框里等用户按发送——
   *      那才是这件事的反馈（与商城页"通过 Agent 创建"那条同判，见 `marketplace-entry.tsx`）；
   *   ③ 这条路径**一个发送出口都没有**：`launch` 是唯一的调用，它的实现在 `preset-launch.ts` 里
   *      只调官方 `setDraft`（门禁有一条源码级反向锁盯住这一点）。
   */
  const runDraftWithAgent = useCallback((kind: EnterpriseEscDraftKind): void => {
    const prompt = kind === 'find' ? ENTERPRISE_ESC_LOCAL_COPY.skillFindPrompt : ENTERPRISE_ESC_LOCAL_COPY.skillCreatePrompt
    setDraftFailure(undefined)
    if (draftPort === undefined) {
      // 端口缺席 = 这一级不可用（菜单项已置灰 + 写明原因，正常路径点不到这里）。
      setDraftFailure(kind)
      return
    }
    void draftPort.launch(prompt).then(
      (ok) => { if (!ok) setDraftFailure(kind) },
      // 端口抛错与返回 false 同一条收束（都是"这一级没走成"），绝不静默。
      () => { setDraftFailure(kind) },
    )
  }, [draftPort])
  /** 按下的那一项渲染成提示件的**动作前缀**（说清是「查找技能」还是「创建技能」没成）。 */
  const draftFailureLabel = draftFailure === undefined
    ? undefined
    : draftFailure === 'find' ? ENTERPRISE_ESC_COPY.addSkillFind : ENTERPRISE_ESC_COPY.addSkillCreate

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
      //   ★口径 43：这一行的卡片改用**广场那张卡**，故已装技能名集合要一并交下去——
      //     否则精选里的技能卡只会画「+」，而同一条技能在下面广场里却画成「更多 + 去试试」，
      //     同一屏里同一件东西两种形态。用的是**同一份** `installedIds`（只读集合，不复制）。
      belowLeading:
        resourceType === 'skill' || resourceType === 'expert'
          ? createElement(EnterpriseEscFeatured, {
              api,
              targetType: resourceType === 'skill' ? 'Skill' : 'Agent',
              installedSkillNames: resourceType === 'skill' ? installedIds : undefined,
            })
          : undefined,
      resourceType,
      installedCount,
      installedCountFailed: installedReadFailed,
      // ★口径 54 第四态：官方发现面自己说"还没发现完" ⇒ 工具栏据此换掉 title 那一句。
      installedCountDiscovering: installedDiscovering,
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
      // ★口径 46/60：那枚「上传技能」的**开窗**入口（写入口缺席时 `undefined` ⇒ 该项置灰 + 写明原因）。
      onAddSkill: skillImportPort === undefined ? undefined : () => { setSkillImportOpen(true) },
      // ★口径 47：那枚「已安装」的入口（切视图由页壳做）。
      onOpenInstalled,
      // ★口径 51：专家页那枚「我的专家」的入口（切视图由页壳做，本层只把它交上去）。
      //   ★连接器页那枚「自定义连接器」**没有对应的一位**：本部署没有自定义连接器管理接口，
      //     全仓也没有任何调用方会传 `onCustomConnectors` ⇒ 那一页的按钮恒置灰 + 行上写明原因
      //     （这不是"忘了接线"，是"没有这条能力"，故不在这里编一个假端口）。
      onOpenMyExperts,
      // ★口径 49：技能页那枚主按钮变成一个三项下拉——下面三件就是它的输入：
      //   ① 开合态与开合动作（本层持有，工具栏是纯投影）；
      //   ② 两项走会话的动作（各调各的、都由同一个 `runDraftWithAgent` 分派）；
      //   ③ 失败上报（真实失败原因落在下面那枚唯一提示件 + 稳定码上）。
      //   ★这三件**只在技能页给**：WorkBuddy 的专家页/连接器页那两枚根本不是下拉（进子页 / 开 MCP 弹窗），
      //     本刀按用户裁决只对齐那两页的尺寸与形态。工具栏那一侧也自带同一道闸（双保险，不是两份判据）：
      //     它只认 `resourceType === 'skill'`，其余页即便拿到这枚配置也不建 Menu。
      ...(resourceType !== 'skill' ? {} : {
        addSkillMenu: {
          open: addSkillMenuOpen,
          onClose: () => setAddSkillMenuOpen(false),
          onToggle: () => setAddSkillMenuOpen(open => !open),
        },
        onFindSkill: () => runDraftWithAgent('find'),
        onCreateSkill: () => runDraftWithAgent('create'),
        // 上报与"直接点那一项"走**同一枚**执行器（不是第二条通路），只是入口不同：
        // 前者给"键盘/程序触发到一枚 disabled 项"兜底，后者是菜单项自己的 onSelect。
        onSkillDraftFailure: (kind: EnterpriseEscDraftKind) => runDraftWithAgent(kind),
      }),
    }),
    // ★口径 60：本地导入那枚**导入弹窗**（挂在工具栏下方一格，与口径 46 那枚选择器同一个落点）。
    //   与商城页那三处落点同一条纪律：**触发钮在哪个视图里，落点就得在哪个视图里**——少挂一处
    //   就是"点了没反应"的死控件。★它换掉了口径 46 那枚恒不可见选择器（那枚仍活在商城页，一字未动）。
    createElement(EnterpriseSkillImportDialog, {
      open: skillImportOpen,
      onOpenChange: setSkillImportOpen,
      port: skillImportPort,
    }),
    /**
     * ★**口径 49**：下拉里「查找技能 / 创建技能」**没把话填进新会话**时的可见交代。
     *
     * 走**唯一**提示组件（人话 + 下一步 + 收进「技术信息」的稳定码 `ENT_ESC_DRAFT_UNAVAILABLE`），
     * `prefix` 说清是哪一项（查找技能 / 创建技能）没成 —— 不静默、也不把裸码砸在员工脸上。
     * 落点复用本页既有那枚错误类名 `esc-import-error`（与本地导入失败同一个视觉层，不新造样式）。
     */
    draftFailure === undefined
      ? null
      : createElement(EnterpriseErrorNotice, {
          className: 'esc-import-error',
          code: ENTERPRISE_ESC_DRAFT_FAILED_CODE,
          prefix: draftFailureLabel,
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
                    // 底部那一行：★**口径 42** 起**专家卡也走标签行**（作者 + 三格统计，与技能卡同一行，
                    //   见 esc-card.tsx 的 tagRowLayout）⇒ 这一位现在只对**旧三层版式**生效：
                    //   连接器靠它不画那条空页脚（技能卡本就靠标签行、不看它）。
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
