/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useState、lucide-react 的 `RefreshCw`、`esc-api` 的 `EnterpriseEscApi`、
 *   `esc-constants` 的成功码、`esc-copy` 的文案、`esc-types` 的推荐记录与归一化卡片类型、
 *   **`esc-card` 的 `EnterpriseEscCard`（精选卡就是广场那张卡）**、`esc-list` 的适配器表与回查键
 * [OUTPUT]: 对外提供 `EnterpriseEscFeatured`——内容区第一行「精选技能 / 精选专家」（含标题栏、「换一批」、
 *   卡片网格、加载/失败/空四态），另导出纯渲染体 `enterpriseEscFeaturedBody`、状态类型 `EnterpriseEscFeaturedState`，
 *   以及口径 43 的回查三件套（`loadEnterpriseEscFeaturedLookup` / `enterpriseEscFeaturedItem` /
 *   `EnterpriseEscFeaturedLookup`）与上限常量
 * [POS]: esc 页面的**精选行**，数据源是 NUWAX 的官方推荐接口（`POST /api/system/display/recommend/list`，
 *   `recType=Official` + `targetType=Skill|Agent`），由 `esc-aggregation` 经工具栏**第二栏**（`belowLeading`）
 *   挂一次：**专家页与技能页都挂**（两页只有 `targetType` 不同），连接器页不挂。
 *   ★**本刀（口径 43，用户裁决「精选的卡片调整成和非精选的一致」）**：这一行的卡片从"薄壳"换成**广场那张卡**。
 *   ① **为什么以前是薄壳、现在能不是了**：那条推荐接口的 `DisplayRecommendInfo` 只有
 *      `label`/`icon`/`placeholder`/`category`/`prompts`/`targetId` 六格，**没有**描述、作者、收藏量、
 *      安装量、使用量——而广场卡片要的正是后面这些。先前记为「拿 `targetId` 回查 `published/agent|skill/list`
 *      理论上能补齐字段，但两套坐标系**是否同一套**在源码里查不到、必须实跑，未验就接 = 可能静默取错技能」，
 *      故当时刻意退成薄壳（宁可简，不编字段）。
 *      **本刀实跑验过**（本机现役宿主，同一刻两条取数，逐条列在 `esc-list.ts` 的 `escPublishedTargetIdOf` 上）：
 *      推荐 `targetId=158` ↔ 广场 `targetId=158`（**同一套坐标系**；广场那条的平台 `id` 是 4194，**不是**它），
 *      技能 7 条、专家 7 条**逐条命中**，`label` 与 `name` 亦逐字相同。
 *   ② **回查怎么发**：走**广场那一档的同一个适配器**（`escResourceAdapters(api)[expert|skill].system`）——
 *      取数参数与归一化投影都是**同一份代码**，不另写一套（口径 40 那条"同一个函数画出来"的同类手法）。
 *      回查是**有界**的（一页 50 条、最多 4 页；候选全部命中就提前停手），且**只在这一行自己发**，
 *      不依赖广场列表当前选中的分类/关键词（用户搜了个词不该把精选卡的描述也搜没）。⚠底层请求**不带 signal**
 *      （适配器的 `fetchPage` 没有这个口），故卸载只是丢弃迟到结果，请求本身会跑完——如实记在这里。
 *   ③ **回查失败/没命中怎么办**：**不**编字段、也**不**把整行拖进失败态（推荐那一批是真拿到的，四态说的是它）。
 *      没命中的那条按"推荐记录自己有的两格"画（`label` + `icon`），卡片的下半截如实留空/短横——
 *      与广场卡片对"平台没给这一格"的处理**同一个形态**。要看清这一点，看 `enterpriseEscFeaturedItem`。
 *   ④ **卡片与广场逐格同形**：图标形状（专家裁圆）、右上角动作（技能＝常驻「+」，专家＝默认收起、
 *      hover 才展开的「召唤」）、描述独立一行、底部标签行（作者 + 三格统计）——全部由 `EnterpriseEscCard`
 *      按 `showUse`/`showSummon` 决定，本文件不自画一格卡片内部结构。
 *   ★四态与列表页同纪律：失败**说出来**（人话 + 下一步 + 稳定码 + **只在可重试时**才画「重试」），
 *     未登录单独成一态，空态用官方那一句「暂无数据」——**绝不**把失败画成「今天没有精选」。
 *   ★平台业务码经 `escPlatformErrorCode` 归一（`4040` ⇒ `ENT_ESC_RECOMMEND_UNAVAILABLE`），平台原话一个字不上屏。
 *   ★两处失败面（列表 / 精选）的标记仍未合并成同一个组件（列表面是 state 块、这里是 note 块），
 *     与全仓 `EnterpriseErrorNotice` 的合并属**独立一刀**，不在本刀夹带。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { RefreshCw } from 'lucide-react'
import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react'
import { enterpriseErrorAction, enterpriseErrorMessage, enterpriseErrorRetryable } from '../error-messages.js'
import {
  ESC_MISSING_ENDPOINT_CODES,
  escErrorCodeOf,
  escPlatformErrorCode,
  type EnterpriseEscApi,
} from './esc-api.js'
import { EnterpriseEscCard } from './esc-card.js'
import { ESC_SUCCESS_CODE } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { escPublishedTargetIdOf, escResourceAdapters } from './esc-list.js'
import type {
  EscRecommendRecord,
  EscRecommendTargetTypeEnum,
  ResourceItem,
  ResourceTypeEnum,
} from './esc-types.js'

/**
 * 「精选」这一行**最多画几枚**（用户原话「精选最多显示六个」）。
 *
 * 是**展示上限**，不是取数上限：平台给多少照旧原样进状态（本机实测 `total: 7`），
 * 只有这一行截前六枚 ⇒ "平台给了 7 条"这件事在任何地方都不会被说成"只有 6 条"。
 * 取 6 也是版式上的一个整档：宽屏三列 ⇒ 两行收满，窄屏两列 ⇒ 三行收满，不会出现半行孤卡。
 */
export const ENTERPRISE_ESC_FEATURED_MAX = 6

/**
 * 精选行入参。
 */
export interface EnterpriseEscFeaturedProps {
  readonly api: EnterpriseEscApi
  /**
   * ★用户裁决：专家页也挂精选区，**逻辑与技能页完全一致**，只有 `targetType` 那一档不同
   * （官方推荐页本身就支持 Agent 与 Skill 两档，见 `OFFICIAL_RECOMMEND_CONFIG`）。
   */
  readonly targetType: EscRecommendTargetTypeEnum
  /**
   * 已装技能名集合（技能页由聚合区给出，与广场卡片**同一份**真值）。
   *
   * 缺省＝读不到 ⇒ 卡片按「未装」画那枚「+」——与广场卡片同一条口径（`installed: undefined` 与
   * `false` 在卡片层是同一形态，而工具栏那一行另有「已安装（？）」的缺口标记）。
   */
  readonly installedSkillNames?: ReadonlySet<string> | undefined
}

/** 精选行内部状态（成功/失败/空/加载四态互斥，避免出现「空数组 + 没报错」那种空白态）。 */
export type EnterpriseEscFeaturedState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly items: readonly EscRecommendRecord[] }
  | { readonly kind: 'empty' }
  /** ★失败只带**稳定码**：人话与下一步由唯一码表给，平台原话不上屏（见文件头那段）。 */
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'unauthenticated' }

/* ══════════════ 口径 43：用 `targetId` 回查广场目录，把精选卡补齐成广场那张卡 ══════════════ */

/** 回查索引：平台 `targetId` → 归一化后的卡片数据。 */
export type EnterpriseEscFeaturedLookup = ReadonlyMap<number, ResourceItem>

/**
 * 空索引（**常量**：同一引用喂给 `useState`，`setState` 同值时 React 直接 bail out，不会多渲染一轮）。
 */
export const ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY: EnterpriseEscFeaturedLookup = new Map()

/**
 * 回查目录**一页取几条**：只要够一次装下官方目录即可（本机实测专家 7 条 / 技能 7 条，一页收满）。
 * 它跟"精选只画 6 枚"不是一回事——回查要覆盖的是**平台那份目录**，不是那 6 枚卡片。
 */
export const ENTERPRISE_ESC_FEATURED_LOOKUP_PAGE_SIZE = 50

/**
 * 回查**最多翻几页**（有界）。
 *
 * 为什么要有界：回查是"为 6 枚卡片补字段"，目录很长时不许为了它们把整本目录拉光——
 * 翻到上限就用手上已有的那份，没命中的那几条照 `enterpriseEscFeaturedItem` 如实画。
 */
export const ENTERPRISE_ESC_FEATURED_LOOKUP_MAX_PAGES = 4

/** 回查入参。 */
export interface EnterpriseEscFeaturedLookupInput {
  readonly api: EnterpriseEscApi
  /** 推荐目标档：`Agent` ⇒ 专家目录，其余（本页只会有 `Skill`）⇒ 技能目录。 */
  readonly targetType: EscRecommendTargetTypeEnum | string
  /** 要回查的目标 id（推荐记录的 `targetId` 那一格）。 */
  readonly wanted: readonly number[]
}

/**
 * 按推荐记录的 `targetId` 去广场目录里回查，产出 {@link EnterpriseEscFeaturedLookup}。
 *
 * ★**走广场那一档的同一个适配器**（见文件头②）：取数参数与归一化投影都是同一份代码。
 * ★三条早退：候选为空 ⇒ 一条请求都不发；某一页平台说不是成功码 ⇒ 就用手上已有的（不把回查的失败
 *   升级成整行的失败态，理由见文件头③）；候选全部命中 ⇒ 不再往下翻页。
 */
export async function loadEnterpriseEscFeaturedLookup(
  input: EnterpriseEscFeaturedLookupInput,
): Promise<EnterpriseEscFeaturedLookup> {
  const wanted = new Set(input.wanted)
  if (wanted.size === 0) return ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY
  // `Agent` 是专家档；其余目标档（本页只会传 `Skill`）都按技能档回查——与 `targetType` 的取值面一致。
  const resourceType: ResourceTypeEnum = input.targetType === 'Agent' ? 'expert' : 'skill'
  const adapter = escResourceAdapters(input.api)[resourceType].system
  // 该档没有服务端适配器（当前不存在）⇒ 空索引，卡片退回"只有 label + icon"那一形态
  if (adapter === undefined || adapter.mode !== 'server') return ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY
  const index = new Map<number, ResourceItem>()
  for (let page = 1; page <= ENTERPRISE_ESC_FEATURED_LOOKUP_MAX_PAGES; page += 1) {
    const response = await adapter.fetchPage({
      page,
      pageSize: ENTERPRISE_ESC_FEATURED_LOOKUP_PAGE_SIZE,
      // 空分类 + 空关键字：回查要的是**整份官方目录**，与广场当前选中的分类/搜索词无关（文件头②）
      category: '',
      keyword: '',
    })
    if (response?.code !== ESC_SUCCESS_CODE) break
    const { items, hasMore } = adapter.extract(response, page, ENTERPRISE_ESC_FEATURED_LOOKUP_PAGE_SIZE)
    for (const item of items) {
      const targetId = escPublishedTargetIdOf(item)
      if (targetId !== undefined && wanted.has(targetId)) index.set(targetId, item)
    }
    if ([...wanted].every(id => index.has(id))) break
    if (!hasMore) break
  }
  return index
}

/**
 * 一条推荐记录 → 卡片数据（**纯投影**，导出给测试直调：本仓 vitest 没有 DOM）。
 *
 * ★**命中**（推荐 `targetId` 与广场那条的 `targetId` 同一套坐标系，文件头①）：直接用广场那份
 *   `ResourceItem` ⇒ 描述/作者/收藏/安装/使用**全是广场上那一份真值**，两张卡逐格同形。
 * ★**没命中**：只产出**推荐记录自己有的那两格**（`label` + `icon`），其余**一格都不编**——
 *   `description`/`publishUser`/`stats` 全部缺席 ⇒ 卡片按既有规则不画描述行、不画作者格、
 *   三格统计画缺口短横（`ENTERPRISE_ESC_LOCAL_COPY.statUnavailable`）。
 *   这与广场卡片对"平台没给这一格"的处理是**同一个形态**，不是另造一种"精选专供"的样式。
 */
export function enterpriseEscFeaturedItem(
  record: EscRecommendRecord,
  lookup: EnterpriseEscFeaturedLookup,
): ResourceItem {
  const joined = lookup.get(record.targetId)
  if (joined !== undefined) return joined
  // ⚠id 用 `recommend-${record.id}` 前缀：它与广场那套 `agent-4087` / `skill-4055` **不可能撞**，
  //   将来若有人拿这张卡去做 `updateItem` 那类寻址，也不会误改到广场上的另一条。
  return { id: `recommend-${record.id}`, name: record.label, icon: record.icon }
}

/** 内容区第一行「精选技能 / 精选专家」。 */
export function EnterpriseEscFeatured({ api, targetType, installedSkillNames }: EnterpriseEscFeaturedProps): ReactNode {
  const [state, setState] = useState<EnterpriseEscFeaturedState>({ kind: 'loading' })
  /**
   * 口径 43 的回查索引。它**不参与**上面那四态：推荐记录是真拿到的，回查只是把卡片补成广场那张卡。
   */
  const [lookup, setLookup] = useState<EnterpriseEscFeaturedLookup>(ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY)
  /**
   * 「换一批」令牌：官方那枚按钮是纯前端动作（源码里「精选」这两个字在 NUWAX 全树零命中，
   * 它是 workbuddy 的版式）。本刀让它做**如实**的事——重发一次同一个请求；
   * 若平台对同一入参返回同一批，那「换一批」就如实是这一批，绝不本地假换序。
   */
  const [batch, setBatch] = useState<number>(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    api
      .officialRecommended(targetType, controller.signal)
      .then(envelope => {
        if (controller.signal.aborted) return
        // 与 `esc-list` 同一判据：成功码是 `'0000'`（NUWAX `codes.constants.ts:11`）。
        if (envelope.code !== ESC_SUCCESS_CODE) {
          // ★平台业务码先归一（`4040` ⇒ 本面那枚"这台部署没有提供推荐内容"的码）；
          //   **只把码交给状态**：平台原话一个字都不进 DOM（见文件头本刀那段）。
          setState({ kind: 'failed', code: escPlatformErrorCode(envelope.code, ESC_MISSING_ENDPOINT_CODES.recommend) })
          return
        }
        const records = envelope.data?.records
        if (!Array.isArray(records) || records.length === 0) {
          setState({ kind: 'empty' })
          return
        }
        setState({ kind: 'ready', items: records })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // 未登录单独成一态：不拿「精选为空」假装"平台没有内容"。
        const code = escErrorCodeOf(error)
        if (code === 'ENT_AUTH_REQUIRED') {
          setState({ kind: 'unauthenticated' })
          return
        }
        // 同上：只带稳定码；取不到码时 `escErrorCodeOf` 交回本机兜底码（不再是那句「加载失败」前缀）。
        setState({ kind: 'failed', code: escPlatformErrorCode(code, ESC_MISSING_ENDPOINT_CODES.recommend) })
      })
    return () => controller.abort()
  }, [api, batch, targetType])

  /**
   * 口径 43：推荐那一批到手之后，再去广场目录把它们补齐成广场那张卡。
   *
   * ★依赖里放的是 `state`（`useState` 的引用在两次渲染之间是稳的）而**不是** `state.items`——
   *   `items` 每次渲染都是新数组/新 map 结果，拿它当依赖会把这条 effect 变成每渲染一次发一趟请求。
   *   effect 里只写 `lookup`，不回写 `state` ⇒ 不构成环。
   * ★回查失败**不改变四态**（推荐那一批是真好到的，见文件头③）：`.catch` 里只留一句注释，
   *   卡片的可见后果是"下半截留空/短横"——与广场卡片对缺口的表现同一个形态。
   */
  useEffect(() => {
    if (state.kind !== 'ready') {
      setLookup(ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY)
      return
    }
    let live = true
    void loadEnterpriseEscFeaturedLookup({
      api,
      targetType,
      wanted: state.items.map(record => record.targetId),
    })
      .then(index => {
        // 卸载/换档后的迟到结果丢弃（底层请求不带 signal，见文件头②）
        if (live) setLookup(index)
      })
      .catch(() => {
        // 回查失败 ⇒ 卡片只画推荐记录自己有的那两格（label / icon），四态不受影响（文件头③）
      })
    return () => {
      live = false
    }
  }, [api, state, targetType])

  const retry = useCallback(() => setBatch(current => current + 1), [])

  // 标题随 targetType 变：技能页「精选技能」、专家页「精选专家」（真机截图里两处都写"精选技能"，
  // 那是同词复用导致的错读——两页的数据源不同，标题也该不同）。
  const title = targetType === 'Agent'
    ? ENTERPRISE_ESC_COPY.featuredTitleAgent
    : ENTERPRISE_ESC_COPY.featuredTitle
  return createElement(
    'section',
    { className: 'esc-featured', 'aria-label': title },
    createElement(
      'div',
      { className: 'esc-featured-head' },
      createElement('h2', { className: 'esc-featured-title', children: title }),
      state.kind === 'ready' && state.items.length > 0
        ? createElement(
            'button',
            { type: 'button', className: 'esc-featured-refresh', onClick: retry },
            createElement(RefreshCw, { size: 13, 'aria-hidden': true }),
            ENTERPRISE_ESC_COPY.refreshBatch,
          )
        : null,
    ),
    createElement(
      'div',
      { className: 'esc-featured-body' },
      enterpriseEscFeaturedBody(state, retry, { lookup, targetType, installedSkillNames }),
    ),
  )
}

/**
 * 四态 → 具体呈现（与下方列表页同一纪律：失败说出来、空态用官方那一句）。
 *
 * ★**导出给测试直调**（本仓 vitest 没有 DOM，而这条行是要 use* 的组件）：四态各自的标记树因此
 * 可以被逐条核对，不必起 React —— 与 `escResourceAdapters` 那类纯投影同一个做法。
 * ★第三个入参是口径 43 那三格（回查索引 / 目标档 / 已装技能名）。**全部可选**：
 *   不带时按"技能档 + 空索引"画 ⇒ 与两参直调完全等价，既有用例一字不改。
 */
export interface EnterpriseEscFeaturedBodyOptions {
  readonly lookup?: EnterpriseEscFeaturedLookup | undefined
  readonly targetType?: EscRecommendTargetTypeEnum | string | undefined
  readonly installedSkillNames?: ReadonlySet<string> | undefined
}

export function enterpriseEscFeaturedBody(
  state: EnterpriseEscFeaturedState,
  retry: () => void,
  options: EnterpriseEscFeaturedBodyOptions = {},
): ReactNode {
  switch (state.kind) {
    case 'loading':
      return createElement('div', { className: 'esc-loading', children: ENTERPRISE_ESC_COPY.loading })
    case 'empty':
      return createElement('div', { className: 'esc-empty', children: ENTERPRISE_ESC_COPY.emptyData })
    case 'unauthenticated':
      return createElement(
        'div',
        { className: 'esc-featured-note' },
        createElement('p', { children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle }),
        createElement('p', { className: 'esc-sub', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody }),
      )
    case 'failed':
      /* ★失败这一态与列表页 `ErrorRow` **同一套判据**（见文件头）：
         ① 人话与下一步取自唯一码表 `error-messages.ts`（`state.code` 是**稳定码**，不是平台原话）；
         ② 稳定码本身照旧上屏（可检索、能定位、不含实现细节）；
         ③ **只有可重试的码才画「重试」** —— 对"这台部署没有这个端点"这类终态，重试永远无效，
            画一枚只会把人引向死路（全仓 error-messages 的 retryable 纪律）。
         ★平台那句自由文本（`No static resource …`）**在这里被丢掉**：它是上游实现细节，
         员工读不出下一步，而稳定码已经足够定位。 */
      return createElement(
        'div',
        { className: 'esc-featured-note', role: 'alert' },
        createElement('p', null, enterpriseErrorMessage(state.code)),
        createElement('p', { className: 'esc-sub', children: enterpriseErrorAction(state.code) }),
        createElement('p', { className: 'esc-state-code', children: state.code }),
        enterpriseErrorRetryable(state.code)
          ? createElement(
              'button',
              { type: 'button', className: 'esc-retry', onClick: retry },
              ENTERPRISE_ESC_LOCAL_COPY.retry,
            )
          : null,
      )
    case 'ready': {
      /* ★用户原话「精选最多显示六个」：**展示上限**，不是把平台的条数改掉——
         状态里仍然如实留着平台给的这一批（本机实测 `total: 7`），只有这一行**画**前六枚。
         所以这是"页面只展示六枚"，不是"平台只给了六枚"，两者不许混为一谈
         （"换一批"照旧重发同一个请求，也不本地补位凑数）。 */
      const lookup = options.lookup ?? ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY
      // 与 `esc-aggregation` 给广场卡片的开关**逐格相同**（同一资源类型 ⇒ 同一组 props）：
      // 专家走 showSummon（召唤默认收起、hover 才展开），技能走 showUse（常驻「+」/ 已装「更多 + 去试试」）。
      const expert = (options.targetType ?? 'Skill') === 'Agent'
      return createElement(
        'div',
        { className: 'esc-featured-grid' },
        state.items.slice(0, ENTERPRISE_ESC_FEATURED_MAX).map(record => {
          const item = enterpriseEscFeaturedItem(record, lookup)
          return createElement(EnterpriseEscCard, {
            // key 用**推荐记录自己的 id**（不是回查命中那条的 id）——同一条推荐在命中/未命中两态下
            // 都是同一枚 key，回查前后 React 复用同一个节点，不会整格重建闪一下。
            // ★**卡片直接挂在树上**（不再包一层本文件的私有组件）：于是"精选卡就是广场那张卡"
            //   在渲染树里是 `element.type === EnterpriseEscCard` 这条**结构事实**，
            //   而不是"看起来像"（门禁正是这么核的）。
            key: String(record.id),
            item,
            iconShape: expert ? 'circle' : 'square',
            showSummon: expert,
            showStats: expert,
            showUse: !expert,
            // 已装分流与广场同一条口径：命中已装清单 ⇒ 「更多 + 去试试」，否则「+」
            // （读不到清单时按未装画 —— 宁可少给一次「更多」，也不谎称已装）
            installed: expert ? undefined : options.installedSkillNames?.has(item.name) === true,
          })
        }),
      )
    }
  }
}
