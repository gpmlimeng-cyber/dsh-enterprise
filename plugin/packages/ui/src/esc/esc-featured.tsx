/**
 * [INPUT]: 依赖 React 的 createElement/useCallback/useEffect/useRef/useState、lucide-react 的 `RefreshCw`、
 *   `esc-api` 的 `EnterpriseEscApi`、
 *   `esc-constants` 的成功码、`esc-copy` 的文案、`esc-types` 的推荐记录与归一化卡片类型、
 *   **`esc-card` 的 `EnterpriseEscCard`（精选卡就是广场那张卡）**、`esc-more-menu` 的「更多」计划类型
 *   （**类型**导入）、`esc-list` 的适配器表与回查键，
 *   以及宿主 DOM **两处**（口径 50 的窗口步长：组件里那一次 `section.querySelector` 取网格元素 +
 *   薄适配器 `enterpriseEscFeaturedColumnCount` 读 `getComputedStyle(grid).gridTemplateColumns` 数轨道；
 *   读不到一律兜底 1、绝不抛）——除这两处外全文件零 DOM
 * [OUTPUT]: 对外提供 `EnterpriseEscFeatured`——内容区第一行「精选技能 / 精选专家」（含标题栏、「换一批」、
 *   卡片网格、加载/失败/空四态），另导出纯渲染体 `enterpriseEscFeaturedBody`、状态类型 `EnterpriseEscFeaturedState`，
 *   口径 43 的回查三件套（`loadEnterpriseEscFeaturedLookup` / `enterpriseEscFeaturedItem` /
 *   `EnterpriseEscFeaturedLookup`）与上限常量，以及**口径 50 的窗口三件套**——
 *   纯投影 `enterpriseEscFeaturedWindow`（按 offset 旋转）、`enterpriseEscFeaturedNextOffset`（推进 + 钳制，
 *   同样纯、同样可直测）、薄 DOM 适配器 `enterpriseEscFeaturedColumnCount`（点按那一刻读渲染出的列数，
 *   与它那枚纯解析器 `enterpriseEscFeaturedTrackCount`）与兜底常量
 *   `ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK` / `ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL` /
 *   网格类名 `ENTERPRISE_ESC_FEATURED_GRID_CLASS`
 * [POS]: esc 页面的**精选行**，数据源是 NUWAX 的官方推荐接口（`POST /api/system/display/recommend/list`，
 *   `recType=Official` + `targetType=Skill|Agent`），由 `esc-aggregation` 经工具栏**第二栏**（`belowLeading`）
 *   挂一次：**专家页与技能页都挂**（两页只有 `targetType` 不同），连接器页不挂。
 *   ★**本刀（S5a）**：新增可选 prop / 可选 option `moreOf`（技能卡「更多」那两枚本机管理动作的计划工厂）
 *   ——**additive**：不传时逐字回到改前那一态（卡片那枚 `⋯` 整枚不画）。它必须与 `installedSkillNames`
 *   **同源**（同一枚卡片在两处只能有一个答案），故由聚合层把**同一个** `moreOf` 同时交给广场网格与本行。
 *   ★**本刀（S5b）**：同一条手法再加可选 prop / 可选 option `tryOf`（技能卡那枚「去试试」的计划工厂，
 *   纯投影 `enterpriseEscSkillTryPlan`）——**additive**（不传时卡片逐字回到改前那一态）。
 *   本行把「这一枚装没装」**只算一次**（`skillInstalled`）并同时交给卡片与计划：两处各算一遍就会出现
 *   "卡片画着已装、按钮却说还没装"那种自相矛盾；工厂本身**仍由聚合层持有**（与本行同一份状态）。
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
 *   ★**口径 50（用户裁决）：「换一批」＝在已取到的那一批上做本地窗口并循环，不重发请求。**
 *     ① 为什么：`esc-api.ts` 的 `officialRecommended` 把 `pageNo`/`pageSize`/`recType` 写死在自己身上
 *        （`ENTERPRISE_ESC_RECOMMEND_PAGE_NO` 是常量），点「换一批」发出去的是**与首次逐字相同**的请求，
 *        平台按同一入参返回同一批（实机实测：点前后精选行标题逐字相同，4 枚一字未变）；
 *        平台给 7 条、精选只显示一行（这台屏 4 列），于是**另 3 条永不可达**——这就是用户报的缺口。
 *        上游成因是那条 `pageNo` 钉死，本刀**不动它**（非目标）。
 *     ② 怎么换：把已取到的那一批按 offset **旋转**一次（`enterpriseEscFeaturedWindow`），
 *        于是网格第一行显示的就是 `items[offset..offset+列数-1]`（取模）——
 *        **不需要知道列数就能决定"先显示谁"**，这是本方案最要紧的一点。
 *     ③ 为什么旋转、不截断：尾部窗口永远**填满一行**（`[...slice(offset), ...slice(0, offset)]` 长度恒等于 N），
 *        绝不会只剩 2 枚半行；也**绝不**在数据层截断（`state.items` 仍是平台给的整批）。
 *     ④ 步长＝**点按那一刻**从网格元素读到的渲染列数（`getComputedStyle(...).gridTemplateColumns` 的轨道数），
 *        读不到/非法 ⇒ 兜底 **1**（最保守：一枚一枚翻，绝不跳过任何一枚），并钳制到 `[1, items.length]`。
 *        **不写死 4**：4 只对这台屏对，窄屏（2–3 列）下固定 4 会**跳过**若干枚（gcd 不保证覆盖），
 *        那是"已知会丢内容"，不做。
 *     ⑤ 归零时机：新一批到达（取数 effect 一进来）、切页 / `targetType` 变；其余状态照旧不显示「换一批」。
 *        取数链、口径 43 回查链、精选"恒一行"的 CSS 三样**一字未动**（首屏那一次取数照旧）。
 *   ★四态与列表页同纪律：失败**说出来**（人话 + 下一步 + 稳定码 + **只在可重试时**才画「重试」），
 *     未登录单独成一态，空态用官方那一句「暂无数据」——**绝不**把失败画成「今天没有精选」。
 *   ★平台业务码经 `escPlatformErrorCode` 归一（`4040` ⇒ `ENT_ESC_RECOMMEND_UNAVAILABLE`），平台原话一个字不上屏。
 *   ★两处失败面（列表 / 精选）的标记仍未合并成同一个组件（列表面是 state 块、这里是 note 块），
 *     与全仓 `EnterpriseErrorNotice` 的合并属**独立一刀**，不在本刀夹带。
 *
 *   ★**本刀（用户冻结规格 §1①②/§2：已安装的不出现 · 刚装那枚例外 · 精选与广场逐项同源）**——
 *     这一行**逐条**接上与广场**同一份**事实（三件都只调 `esc-skill-card.ts` 里那唯一一份实现）：
 *     ① **已装的不出现**：`enterpriseEscSkillCardHidden`（磁盘上已有同名技能 ⇒ 滤掉；**不是**灰化/打标），
 *        过滤发生在"换一批"那次**旋转之前**（否则转一圈会把已装的转回来）；判据键是回查后的
 *        `item.name`（与广场同一把键）——专家档传空集合（那一档没有"已装"这件事实）。
 *     ② **刚装那一枚留在原地**：`justInstalledSkillName`（聚合层那枚纯 reducer 给的标记）既让隐藏规则
 *        放它一马，又让下面那枚共享投影把 `more`/`install` 两格摘掉（**只显示「去试试」**）。
 *     ③ **精选卡接同一份安装计划**（这就是用户看到"描述三行"的**根因**）：新增可选 prop / option
 *        `installOf` —— **就是**广场网格那一枚（内部只调 `escSystemInstallPlan` +
 *        `enterpriseEscSystemCardInstall`）。改前精选行**少递**这一格 ⇒ 卡片退回兜底形态、把
 *        「这类技能没有可下载的技能包…」铺成**独立一行**、卡片被撑高。同源之后，技能档的卡片入参
 *        **只**从共享投影 `enterpriseEscSkillCardParams` 来（广场调的是同一个函数）⇒
 *        同一份夹具下两处拿到的入参**逐键相等**（门禁有一条逐键比对锁）。
 *        ⚠**如实边界**：另几枚维度（团队空间 / 企业技能 / 本地三方）在广场那一侧本来就没有安装计划
 *        （口径 64 只给"系统广场×技能"这一格构造终态）⇒ 精选这一侧也照旧没有（同一条判据），
 *        故那几档两处**仍然同形**，只是都没有计划——同源是判据，兜底那行出不出现是它的结果。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { RefreshCw } from 'lucide-react'
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { enterpriseErrorAction, enterpriseErrorMessage, enterpriseErrorRetryable } from '../error-messages.js'
import {
  ESC_MISSING_ENDPOINT_CODES,
  escErrorCodeOf,
  escPlatformErrorCode,
  type EnterpriseEscApi,
} from './esc-api.js'
import { EnterpriseEscCard } from './esc-card.js'
import type { EscCardInstall, EscCardTryNow } from './esc-card.js'
import type { EscCardMore } from './esc-more-menu.js'
import { ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED, enterpriseEscSkillCardHidden, enterpriseEscSkillCardParams } from './esc-skill-card.js'
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
 * 精选行**不设枚数上限**，也**不在取数层截断**：平台给多少条就多少条进状态
 * （本机实测 `total: 7`），"只显示一行、能排几个排几个"由**样式层**实现
 * （`.esc-featured-grid` 的 `grid-auto-rows: 0` + `row-gap: 0` + `overflow: hidden`，
 * 见 `esc-style.ts` 口径 48）——列数由容器宽与 `--esc-grid-min` 决定，JS 不猜。
 * 被样式裁掉的那些卡片**仍在 DOM 里**，故它们的整份数据（描述/作者/统计）照旧是真值。
 *
 * ⚠**已实测的缺口（2026-10-08，本机现役宿主）**：右上角「换一批」以前**换不出下一批**——
 * `esc-api.ts` 的 `officialRecommended` 把 `pageNo`/`pageSize`/`recType` 三格写死在自己身上
 * （`ENTERPRISE_ESC_RECOMMEND_PAGE_NO` 是常量），所以点它发出的是**与首次逐字相同**的请求，
 * 平台按同一入参返回同一批 ⇒ 7 条里那 3 条永不可达（点前后精选行的标题实测逐字相同）。
 *
 * ★**本刀（口径 50）落了用户裁决的第 ② 条**：在**已取到的那一批**上做本地窗口（第 5..7 条 → 循环）——
 * 那是"对已有数据分页"，不是编造内容，也不是把顺序本地打乱来假装换了一批（两条纪律都写在文件头）。
 * 第 ① 条（让 `pageNo` 随点击递增）**刻意不做**：那要改取数参数，而"平台到底按不按页返回不同内容"
 * 还没验过；何况同一入参重发本身就是纯浪费。
 */


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
  /**
   * ★**本刀（S5a）**：技能卡「更多」那两枚本机管理动作的**计划工厂**（页面层给的纯投影）。
   *
   * 与上面 `installedSkillNames` **必须同源**（都是聚合层那一份真值）：精选行与广场是同一枚卡片，
   * 故"这一枚能不能卸 / 能不能打开文件夹"两处只能是同一个答案。缺席 ⇒ 卡片那枚 `⋯` 整枚不画
   * （本行今天不接那两枚动作时即此形态，逐字不变）。
   * ★它**只对技能卡**（`showUse`）有意义；专家卡那一档不看它。
   */
  readonly moreOf?: ((name: string) => EscCardMore | undefined) | undefined
  /**
   * ★**本刀（S5b）**：技能卡那枚「去试试」的**计划工厂**（页面层给的纯投影）。
   *
   * 与 `installedSkillNames` / `moreOf` **必须同源**（都是聚合层那一份真值）：精选行与广场是同一枚卡片，
   * 故"这一枚能不能试"两处只能是同一个答案。缺席 ⇒ 卡片逐字回到改前那一态
   * （禁用 + `title = actionNotPorted`；本行今天不接这条动作时即此形态）。
   * ★入参是**装没装**（由本行那份 `installedSkillNames` 判）——计划的可用性判据要它。
   * ★它**只对技能卡**（`showUse`）有意义；专家卡那一档不看它。
   */
  readonly tryOf?: ((name: string, installed: boolean) => EscCardTryNow) | undefined
  /**
   * ★**本刀（用户冻结规格 §2：「精选卡与广场卡接同一份安装计划」）**：技能卡那枚【＋】的**计划工厂**。
   *
   * ★**它就是广场网格那一枚**（聚合层那唯一一个 `installOf`，内部只调 `escSystemInstallPlan` +
   *   `enterpriseEscSystemCardInstall`）——精选行**不再少递**这一格。
   * ★**为什么这一格缺席就是"描述三行"那个 bug**（用户真机看到的那一版）：卡片在 `install` 缺席时
   *   走**兜底那一档**（禁用 + `title = actionNotPorted` + **行上可见**一句
   *   `skillInstallUnavailable`「这类技能没有可下载的技能包…」）——那句话是**独立一行**，
   *   于是精选卡的描述下面凭空多出一行、卡片被撑高，与广场卡不再同形。
   *   同源之后：广场那一档有计划的，精选这一档也有；广场没有的（另几枚维度），精选也没有
   *   （同一条判据 ⇒ 形态仍然一致，不是"精选又少递了一格"）。
   * ★**它只对技能卡**（`showUse`）有意义；专家卡那一档不看它。
   */
  readonly installOf?: ((item: ResourceItem) => EscCardInstall | undefined) | undefined
  /**
   * ★**本刀（用户冻结规格 §1②：「刚装的那一枚留在原地」）**：本页本次会话里刚安装成功的那一枚
   * （标记由聚合层那枚纯 reducer `enterpriseEscSkillCardMarkState` 说）。
   *
   * ★它做两件事，且两件都由**同一个** `enterpriseEscSkillCardHidden` / `enterpriseEscSkillCardParams`
   *   判：① 隐藏规则放它一马（它留在精选行里）；② 卡片入参里**没有** `more`、**没有** `install`
   *   —— 只显示「去试试」（规格 §1③）。
   * ★缺席 = 没有刚装的（本轮没装过、或列表已重读/切过维度 ⇒ 标记已撤）。
   */
  readonly justInstalledSkillName?: string | undefined
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

/* ══════════════ 口径 50：「换一批」＝在已取到的那一批上做本地窗口（循环），不重发请求 ══════════════ */

/**
 * 精选行网格的类名（**唯一字面**）：渲染体与"点按那一刻读列数"的适配器共用这一格。
 * 两处各写一串 `esc-featured-grid` 的话，改了一处另一处就静默读不到列数（退成兜底 1，界面看着还对）。
 */
export const ENTERPRISE_ESC_FEATURED_GRID_CLASS = 'esc-featured-grid'

/** 窗口起点（＝平台给的原顺序）。新一批 / 切页 / 换档都回到它。 */
export const ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL = 0

/**
 * 读不到 / 非法列数时的兜底步长：**1**。
 *
 * ★为什么兜底是 1 而不是 4：步长是"一次翻几枚"的**上界**，兜错方向时 1 只会多翻几次，
 *   而 4 在窄屏（2–3 列）下会**跳过**若干枚（gcd 不保证覆盖）⇒ 那是"已知会丢内容"。保守优先。
 */
export const ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK = 1

/**
 * 把 offset 归一到 `[0, length)`（**纯函数**，`NaN`/非有限值/负数/越界一律收敛，绝不抛）。
 * 旋转与推进共用这一格，免得两处各写一份取模（负数的 `%` 在 JS 里是负的，抄错就循环不动）。
 */
function normalizeEnterpriseEscOffset(value: number, length: number): number {
  if (length <= 0 || !Number.isFinite(value)) return ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL
  const whole = Math.trunc(value)
  return ((whole % length) + length) % length
}

/**
 * 把 stride 钳到 `[1, length]`（**纯函数**）：0 / 负数 / 小数 / 越界 / 非有限值都有确定结果。
 */
function clampEnterpriseEscStride(stride: number, length: number): number {
  if (!Number.isFinite(stride) || !Number.isFinite(length)) return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
  const ceiling = Math.trunc(length)
  if (ceiling < ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK) return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
  return Math.min(Math.max(ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK, Math.trunc(stride)), ceiling)
}

/**
 * 窗口投影（**纯投影**，无 DOM、无 React，测试直调）：`[...items.slice(offset), ...items.slice(0, offset)]`。
 *
 * ★这是口径 50 的**核心不变量**：结果永远是入参那一批的一个**排列**——长度恒等于 N、一枚不丢、一枚不重。
 *   因为网格只显示第一行，可见的首屏于是恰好是 `items[offset..offset+列数-1]`（取模）——
 *   **渲染层不需要知道列数就能决定"先显示谁"**。
 * ★旋转而**不**截断：尾部窗口照样填满一行（截断会留下"只剩 2 枚"的半行）。
 * ★`length === 0` 原样交回（连新数组都不造：空态那份引用稳定，省掉一次无谓渲染）。
 */
export function enterpriseEscFeaturedWindow<T>(items: readonly T[], offset: number): readonly T[] {
  const length = items.length
  if (length === 0) return items
  const start = normalizeEnterpriseEscOffset(offset, length)
  if (start === ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL) return items
  return [...items.slice(start), ...items.slice(0, start)]
}

/**
 * 「换一批」推进一格（**纯投影**，无 DOM）：`(current + stride) mod length`，stride 先钳到 `[1, length]`。
 *
 * ★步长由调用方给（组件传的是**点按那一刻**读到的列数，见适配器）；本函数只管推进、循环与钳制。
 * ★`length === 0` ⇒ 恒 0（没有一批可翻；调用点那一态也根本不画「换一批」）。
 */
export function enterpriseEscFeaturedNextOffset(current: number, stride: number, length: number): number {
  const size = Math.trunc(length)
  if (!Number.isFinite(length) || size <= 0) return ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL
  const step = clampEnterpriseEscStride(stride, size)
  return (normalizeEnterpriseEscOffset(current, size) + step) % size
}

/**
 * 把 `getComputedStyle(grid).gridTemplateColumns` 的**读数**切成渲染出的轨道数（**纯解析器**，无 DOM）。
 *
 * ★读数长这样（Chromium/Firefox 对 grid 容器给的是**已解析的轨道尺寸**）：`331.925px 331.925px …`。
 *   行名（`[full-start]`）不是轨道，先剥掉再按空白分段。
 * ★**非法一律兜底 1**：空串 / `none` / 非字符串 / 分段里有不认识的字（`banana`）——包括**函数式写法**
 *   （`repeat(` / `minmax(` / `fit-content(`）：那是**声明原文**、不是渲染读数，本函数不做 CSS 求值，
 *   而它每一段都带括号 ⇒ 过不了下面那枚"必须是已解析尺寸"的形状判据，自然落回兜底 1。
 *   ⚠所以这里**没有**另写一条"含括号就退"的快速判断：那条判断在效果上是**死代码**
 *   （形状判据已经把同一批输入全挡住），留着只会让人以为它在承担什么。
 *   宁可退成"一枚一枚翻"，也不拿一个可能大于真实列数的数字去跳着翻。
 */
export function enterpriseEscFeaturedTrackCount(readout: unknown): number {
  if (typeof readout !== 'string') return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
  const declaration = readout.trim()
  if (declaration.length === 0 || declaration === 'none') return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
  const tracks = declaration
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter(track => track.length > 0)
  if (tracks.length === 0) return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
  return tracks.every(track => RESOLVED_TRACK_SIZE.test(track))
    ? tracks.length
    : ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
}

/** 一条**已解析**轨道尺寸的形状：`331.925px` / `25%` / `0` / `1fr` …（带括号/逗号的写法都过不了它）。 */
const RESOLVED_TRACK_SIZE = /^(?:(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|fr|em|rem|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in|q)?)$/i

/**
 * **薄 DOM 适配器**（照 `market-entry-badge.ts` 的先例：适配器薄、纯逻辑厚）：点按那一刻读网格元素
 * 渲染出的列数。口径 50 的 DOM **读取**只有这一处（元素由调用方 `querySelector` 取好后传进来），
 * 且**绝不抛**——读不到（元素/文档/视图缺席、`getComputedStyle` 不是函数、宿主实现自己抛）
 * 一律交回兜底 {@link ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK}（1）。
 *
 * ★为什么是"点按那一刻读"而不是渲染时读：容器宽、断点、面板开合都可能变过；
 *   缓存一个渲染期读到的列数，窗口就会按一个**过期**的步长跳（这台上是 4、现在是 3 列时就跳过一枚）。
 */
export function enterpriseEscFeaturedColumnCount(grid: Element | null | undefined): number {
  try {
    if (grid === null || grid === undefined) return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
    const view = grid.ownerDocument?.defaultView
    if (view === null || view === undefined) return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
    if (typeof view.getComputedStyle !== 'function') return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
    return enterpriseEscFeaturedTrackCount(view.getComputedStyle(grid).gridTemplateColumns)
  } catch {
    return ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK
  }
}

/**
 * 「换一批」那一下的**唯一推进口径**：读列数（薄适配器）× 推进（纯投影）。
 *
 * ★把它单独导出，是为了让"点一下换一批"这件事本身可直测（`grid` 传 `null` ⇒ 兜底 1 那条路也能测），
 *   而不是只能靠源码级锁去猜。它不碰 `api`、不碰 React state——**结构上就发不出请求**。
 */
export function enterpriseEscFeaturedAdvanceOffset(
  current: number,
  grid: Element | null | undefined,
  length: number,
): number {
  return enterpriseEscFeaturedNextOffset(current, enterpriseEscFeaturedColumnCount(grid), length)
}

/** 内容区第一行「精选技能 / 精选专家」。 */
export function EnterpriseEscFeatured({ api, targetType, installedSkillNames, moreOf, tryOf, installOf, justInstalledSkillName }: EnterpriseEscFeaturedProps): ReactNode {
  const [state, setState] = useState<EnterpriseEscFeaturedState>({ kind: 'loading' })
  /**
   * 口径 43 的回查索引。它**不参与**上面那四态：推荐记录是真拿到的，回查只是把卡片补成广场那张卡。
   */
  const [lookup, setLookup] = useState<EnterpriseEscFeaturedLookup>(ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY)
  /**
   * ★**本刀第 ④ 条（用户原话「换一批只刷新精选区域，不整页刷新」）的取证与结构锁**：
   *
   * **取证结论：这一刀不需要改取数链，现状已经是"只刷精选"**。逐条追下来：
   *   · 「换一批」的回调是这一枚组件**自己**的 `rotate`（口径 50 起，见下方），
   *     它**只写本组件自己的 `offset` 那一格 state**，连取数 effect 的依赖都不碰；
   *   · 失败态那枚「重试」走 `retry` = `setAttempt(+1)`，它进 `useEffect(..., [api, attempt, targetType])`
   *     ⇒ **只重发一次 `api.officialRecommended`** 与随之那次回查（`loadEnterpriseEscFeaturedLookup`）；
   *   · 页面壳 `esc-page.tsx` 那个会把内容区**整棵 remount** 的 `refreshToken`，
   *     **只在页签点击**（`onResourceTypeChange`）时 +1，与本组件**没有任何数据通路**（无 prop、无回调、无 context）；
   *   · 同理，列表（`useEnterpriseEscResourceList`）、维度/分类/搜索（`esc-aggregation` 的那几份 state）
   *     都不读本组件的任何 state ⇒ 点一下不会动它们、不会重置已选的分类与关键字、也不会重挂三页签。
   *
   * ⇒ 所以那一刀在这里**只做两件事**：① 补上下面那段说明（把"为什么它已经是局部的"写成可回溯的根据，
   * 而不是靠"我记得是这样"）；② 在门禁里加**反向锁**（见 tests/esc.spec.ts），把这条局部性钉死——
   *   判据是"本文件不许出现任何把刷新交上去的出口"（没有 prop 叫 onRefresh、没有 `key=`、没有 `onResourceTypeChange`），
   *   外加"页面那个 refreshToken 只能由页签点击改"那条源码锁。
   * ★**刻意不做的**：把 featured 提到页面层、或给它造一个全局刷新出口——那会把这一行重新焊回
   *   整棵内容区的生命周期，正是用户点名不要的"整页刷新"。
   *
   * ★**口径 50 重新基线化**：这一格原先叫 `batch`，是「换一批」与失败「重试」**共用**的重发令牌。
   *   现在「换一批」**不再重发请求**（见文件头：上游把 `pageNo` 钉死，重发是纯浪费），
   *   于是这枚令牌只剩一个用途——失败态那枚「重试」真的再发一次。名字改成 `attempt` 是为了让这一点
   *   在源码里读得出来：**唯一能触发第二次取数的入口就是它**（门禁里有一条 `setAttempt(` 恰好一处的反向锁）。
   */
  const [attempt, setAttempt] = useState<number>(0)
  /**
   * ★口径 50：窗口在**已取到的那一批**上的起始下标（0 ＝ 平台给的原顺序）。
   *   它不是取数参数、也不改数据——只是"从第几枚开始画"（见 `enterpriseEscFeaturedWindow`）。
   */
  const [offset, setOffset] = useState<number>(ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL)
  /** 点按那一刻读列数的那个盒子（`.esc-featured` 这一节；网格在它里面，且只在 ready 态存在）。 */
  const section = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    /**
     * ★口径 50 的**归零时机**：新一批 / 切页 / 换档都回到第一屏。
     *   放在**取数之前**而不是成功分支里：这一态根本不画「换一批」（loading/empty/failed/unauthenticated
     *   四态都不画，见返回体那一行），两种写法对用户等价，而这里少一个"失败了 offset 还悬在半路"的中间态。
     */
    setOffset(ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL)
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
  }, [api, attempt, targetType])

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

  /**
   * 失败态那枚「重试」：真的重发一次请求。
   * ★口径 50 起它**不再**是「换一批」的同一条路——「换一批」只平移窗口，一次请求都不发。
   */
  const retry = useCallback(() => setAttempt(current => current + 1), [])

  /** ready 态下的批长度（其余三态没有「换一批」，长度按 0 交给纯投影 ⇒ 恒归零）。 */
  const featuredLength = state.kind === 'ready' ? state.items.length : 0
  /**
   * 「换一批」：**不重发请求**，把窗口在已取到的那一批上向后平移一个"满屏"。
   *
   * ★点按那一刻才去读列数（容器宽/断点/面板开合都可能变过，缓存一个渲染期读数会按过期步长跳）；
   *   读不到或读到非法值 ⇒ 兜底 1（一枚一枚翻，绝不跳过任何一枚）——两条都在那个薄适配器里。
   * ★回调体里没有 `api`、没有 `setAttempt`：**结构上就发不出请求**（门禁里另有源码级反向锁）。
   */
  const rotate = useCallback(() => {
    setOffset(current => enterpriseEscFeaturedAdvanceOffset(
      current,
      section.current?.querySelector(`.${ENTERPRISE_ESC_FEATURED_GRID_CLASS}`) ?? null,
      featuredLength,
    ))
  }, [featuredLength])

  // 标题随 targetType 变：技能页「精选技能」、专家页「精选专家」（真机截图里两处都写"精选技能"，
  // 那是同词复用导致的错读——两页的数据源不同，标题也该不同）。
  const title = targetType === 'Agent'
    ? ENTERPRISE_ESC_COPY.featuredTitleAgent
    : ENTERPRISE_ESC_COPY.featuredTitle
  return createElement(
    'section',
    // ★口径 50：这一节是**点按那一刻读列数**的落点（网格就在它里面）。ref 只读，不参与渲染差异。
    { className: 'esc-featured', 'aria-label': title, ref: section },
    createElement(
      'div',
      { className: 'esc-featured-head' },
      createElement('h2', { className: 'esc-featured-title', children: title }),
      state.kind === 'ready' && state.items.length > 0
        ? createElement(
            'button',
            // ★口径 50：这一枚**只平移本地窗口**（rotate），不再重发请求；失败态那枚「重试」才走 retry。
            { type: 'button', className: 'esc-featured-refresh', onClick: rotate },
            createElement(RefreshCw, { size: 13, 'aria-hidden': true }),
            ENTERPRISE_ESC_COPY.refreshBatch,
          )
        : null,
    ),
    createElement(
      'div',
      { className: 'esc-featured-body' },
      // 四态那一枚 retry 仍交给失败态那枚「重试」用（ready 态用不到它）；窗口下标从这一格进。
      enterpriseEscFeaturedBody(state, retry, {
        lookup,
        targetType,
        installedSkillNames,
        offset,
        ...(moreOf === undefined ? {} : { moreOf }),
        ...(tryOf === undefined ? {} : { tryOf }),
        // ★本刀：那枚【＋】的计划工厂（与广场**同一枚** ⇒ 精选卡不再退回"兜底那句长说明"那一形态）。
        ...(installOf === undefined ? {} : { installOf }),
        // ★本刀：刚装那一枚（隐藏规则的唯一例外 + 卡片只显示「去试试」的判据）。
        ...(justInstalledSkillName === undefined ? {} : { justInstalledSkillName }),
      }),
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
 * ★口径 50 再加一枚**可选**的 `offset`（窗口起点，缺省 0 ⇒ 与改动前逐字相同）。
 */
export interface EnterpriseEscFeaturedBodyOptions {
  readonly lookup?: EnterpriseEscFeaturedLookup | undefined
  readonly targetType?: EscRecommendTargetTypeEnum | string | undefined
  readonly installedSkillNames?: ReadonlySet<string> | undefined
  /**
   * ★**本刀（S5a）**：技能卡「更多」那两枚本机管理动作的计划工厂（与 `installedSkillNames` 同源）。
   *
   * 缺席 ⇒ 卡片那枚 `⋯` 整枚不画（与"不传已装名字"同一条口径：宁可少给一次入口，也不谎称能卸）。
   * 它的形状与用法在 `esc-aggregation.tsx` 的交点上一句话说完（那边是唯一构造点）。
   */
  readonly moreOf?: ((name: string) => EscCardMore | undefined) | undefined
  /**
   * ★**本刀（S5b）**：技能卡那枚「去试试」的计划工厂（与 `installedSkillNames` / `moreOf` 同源）。
   *
   * 缺席 ⇒ 卡片逐字回到改前那一态（禁用 + `title = actionNotPorted`）。它的形状与用法在
   * `esc-aggregation.tsx` 的交点上一句话说完（那边是唯一构造点）。
   */
  readonly tryOf?: ((name: string, installed: boolean) => EscCardTryNow) | undefined
  /**
   * ★**本刀**：技能卡那枚【＋】的计划工厂（**与广场同一枚** —— 见 `EnterpriseEscFeaturedProps.installOf`
   * 那段：它就是"描述三行"那个 bug 的根因所在那一格）。
   */
  readonly installOf?: ((item: ResourceItem) => EscCardInstall | undefined) | undefined
  /** ★**本刀**：刚装那一枚的名字（隐藏规则的唯一例外，见 `EnterpriseEscFeaturedProps.justInstalledSkillName`）。 */
  readonly justInstalledSkillName?: string | undefined
  /** ★口径 50：窗口起点（0 或负数/越界都会被纯投影归一到 `[0, N)`）。 */
  readonly offset?: number | undefined
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
      /* ★口径 48 起这一行**不设枚数上限**、也**不在取数层截断**：平台给多少条就画多少条进 DOM
         （本机实测 `total: 7`），"只显示一行、能排几个排几个"由**样式层**实现（见 `esc-style.ts`）；
         被裁掉的那些卡片**仍在 DOM 里**，它们的整份数据照旧是真值。
         ★口径 50：画之前先把窗口**旋转**到 `offset`（一枚不删、一枚不重、长度不变）。
         于是可见的第一行恰好是 `items[offset..offset+列数-1]`（取模）——
         这是"不需要知道列数就能决定先显示谁"的落点；也**不**本地打乱顺序、**不**补位凑数。
         （旧注释里那句"只画前六枚 / 换一批照旧重发同一个请求"是本文件早先的形态，已随口径 48/50 退场。） */
      const lookup = options.lookup ?? ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY
      // 与 `esc-aggregation` 给广场卡片的开关**逐格相同**（同一资源类型 ⇒ 同一组 props）：
      // 专家走 showSummon（召唤默认收起、hover 才展开），技能走 showUse（常驻「+」/ 已装「更多 + 去试试」）。
      const expert = (options.targetType ?? 'Skill') === 'Agent'
      /**
       * ★**本刀（用户冻结规格 §1①/§2：「已安装的从列表里去掉」，精选行与广场**同一条规则**）**：
       *   隐藏判据是**同一个函数** `enterpriseEscSkillCardHidden`（广场网格那一处调的也是它）——
       *   磁盘上已有同名技能（官方发现面给的 `installedNames`）就不出现；刚装那一枚例外（留在原地）。
       *
       * ★**过滤发生在旋转之前**：`enterpriseEscFeaturedWindow` 是"在**要看的那一批**上循环"，
       *   先把不该出现的滤掉，旋转出来的每一屏才都是该出现的那些（否则"换一批"会把已装的转回来）。
       * ★**名字取回查之后的 `item.name`**（与广场卡片同一把键 `ResourceItem.name`）：推荐记录自己的
       *   `label` 在技能档虽然逐字相同，但键必须与判据同源 —— 拿它当键就是第二把坐标系。
       * ★专家档**不走这条规则**（那一档没有"已装"这件事实）⇒ 传空集合（判据恒 false）。
       */
      const resolved = state.items.map(record => ({ record, item: enterpriseEscFeaturedItem(record, lookup) }))
      const visible = resolved.filter(each => !enterpriseEscSkillCardHidden({
        name: each.item.name,
        installedNames: expert ? ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED : options.installedSkillNames ?? ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED,
        justInstalledSkillName: expert ? undefined : options.justInstalledSkillName,
      }))
      const windowed = enterpriseEscFeaturedWindow(
        visible,
        options.offset ?? ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL,
      )
      return createElement(
        'div',
        // ★类名走**唯一字面**常量：读列数那个适配器按同一个常量去 `querySelector`，两处不可能漂。
        { className: ENTERPRISE_ESC_FEATURED_GRID_CLASS },
        windowed.map(({ record, item }) => {
          /**
           * ★**本刀（S5a）**：这一枚技能卡的「更多」计划（算不出来 ⇒ 卡片那枚 `⋯` 整枚不画）。
           *
           * 走的是聚合层交下来的**同一个** `moreOf`（可用性判据只认自装记录的 `names[]`，
           * 端口在不在场也在那一处判）——精选行因此与广场卡片逐字同源，不是各判一套。
           */
          const more = expert ? undefined : options.moreOf?.(item.name)
          /**
           * ★**本刀（S5b）**：这一枚技能卡的「去试试」计划。
           *
           * ★**已装判据只算一次**（`skillInstalled`）并同时交给卡片与计划：两处各算一遍就会出现
           *   "卡片画着已装、按钮却说还没装"那种自相矛盾（判据本身是同一条，但读的是同一份
           *   `installedSkillNames`，故这里抽一个局部量就够了）。
           */
          const skillInstalled = expert ? false : options.installedSkillNames?.has(item.name) === true
          const tryNow = expert ? undefined : options.tryOf?.(item.name, skillInstalled)
          /**
           * ★**本刀（用户冻结规格 §2）**：那枚【＋】的计划 —— 与广场网格**同一枚工厂**
           *   （聚合层那唯一一个 `installOf`）。★这就是"描述三行"的修法：改前精选卡拿不到计划 ⇒
           *   卡片走兜底那一档、把「这类技能没有可下载的技能包…」铺成**独立一行**、把卡片撑高。
           */
          const install = expert ? undefined : options.installOf?.(item)
          /**
           * ★**本刀（用户冻结规格 §1②/③ + §2）**：技能档的卡片入参**只**从这一枚共享投影来
           *   （`enterpriseEscSkillCardParams`，广场网格调的是**同一个函数**）⇒ 同一份夹具下
           *   精选卡与广场卡拿到的入参**逐键相等**；而"刚装那一枚"在这一处就把 `more`/`install`
           *   两格摘掉（只留「去试试」）。
           */
          const cardProps = expert
            ? {
                iconShape: 'circle' as const,
                showSummon: true,
                showStats: true,
                showUse: false,
                // 专家档不给已装那位（这一档没有"已装"这件事实）——与广场专家卡那一格逐字同形。
                installed: undefined,
              }
            : enterpriseEscSkillCardParams({
                installed: skillInstalled,
                justInstalled: options.justInstalledSkillName !== undefined
                  && options.justInstalledSkillName === item.name,
                ...(install === undefined ? {} : { install }),
                ...(more === undefined ? {} : { more }),
                ...(tryNow === undefined ? {} : { tryNow }),
              })
          return createElement(EnterpriseEscCard, {
            // key 用**推荐记录自己的 id**（不是回查命中那条的 id）——同一条推荐在命中/未命中两态下
            // 都是同一枚 key，回查前后 React 复用同一个节点，不会整格重建闪一下。
            // ★**卡片直接挂在树上**（不再包一层本文件的私有组件）：于是"精选卡就是广场那张卡"
            //   在渲染树里是 `element.type === EnterpriseEscCard` 这条**结构事实**，
            //   而不是"看起来像"（门禁正是这么核的）。
            key: String(record.id),
            item,
            // ★口径 43 那条"卡片开关与广场逐格相同"仍成立：这里铺的正是上面那份入参
            //   （技能档 = 共享投影的原样结果；专家档 = 与广场专家卡同一组开关）。
            ...cardProps,
          })
        }),
      )
    }
  }
}
