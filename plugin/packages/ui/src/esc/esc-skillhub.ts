/**
 * [INPUT]: 只依赖 `list-state` 的四态类型、`skill-api-decode` 的**浏览面**投影类型（`EnterpriseSkillhubSkill`/`EnterpriseSkillhubCategory`/`EnterpriseSkillhubBrowse`）、`esc-card` 的【＋】终态类型、`esc-copy` 的文案真源与 `esc-types` 的卡片数据形状（`ResourceItem`）、以及 `esc-sub-tabs` 那枚**既有的** chip 机制（`EnterpriseEscSubTab` 与「全部」空 key 约定）——**不依赖 React、不依赖任何宿主 API、不发请求、不认识路径**
 * [OUTPUT]: 对外提供技能页第四枚维度「SkillHub」的**纯事实层**：来源 id 常量 `ENTERPRISE_SKILLHUB_SOURCE_ID`、默认排序与页码常量（`ENTERPRISE_SKILLHUB_DEFAULT_SORT` / `ENTERPRISE_SKILLHUB_FIRST_PAGE` / `ENTERPRISE_SKILLHUB_PAGE_MAX`）、可见文案（标题 / 页内说明 / 加载 / **三句互不相同的"为什么空"** / 安装三段 / 在途与两档禁用原因 / 安装落地那句 / 翻页一句）、分类 chip 的唯一投影 `enterpriseSkillHubCategoryChips`（**缺席 ⇒ 整排不画且选中回「全部」**）、单条结果行的投影 `enterpriseSkillHubSkillRow`、结果面的唯一状态投影 `enterpriseSkillHubFace`（四态 → loading / failed / empty / ready，**互斥**）、翻页判据 `enterpriseSkillHubHasNextPage`（**`hasMore === false` ⇒ 一次都不再取**），以及两枚与卡片对接的纯投影 `enterpriseSkillHubCardItem`（那条结果 → 卡片 `item`）与 `enterpriseSkillHubCardInstall`（那条结果 → 卡片【＋】终态）
 * [POS]: dsh-ui 技能页**第四枚**维度「SkillHub」的**唯一判定与文案真源**（视图只画、聚合层只接线）。
 *   ★★**这一刀是一次定义变更**（用户裁决四件）：① **进页面自动显示**（挂载即按
 *     `sort=downloads&page=1` 取一页，**不带 `q`** ⇒ 无需先搜就有内容）；② **下级用它自己的分类标签**
 *     （chip 全部来自响应里的 `categories`，顺序照宿主给的）；③ **默认按下载量**；④ 翻页。
 *
 *   ★★**数据源换成了宿主上一刀交付的那条单源浏览路由**（`GET /skills/skillhub?q=&category=&sort=&page=`）：
 *     这一维**不再**用 `/skills/online-search`（四源 fan-out、`q` 必填、响应带 `sources[]`）⇒
 *     「只投影 `skillhub.cn` 那一批」那个**过滤**与相关投影**已整体删除**（单源面里没有"别的源"
 *     可滤，过滤留下来就是一句永远为真的死代码）。★`online-search` 那条路由与 `online-search.ts`
 *     **一字未动**：「添加技能 → 在线搜索」那一面仍在用它（`marketplace-entry.tsx`）。
 *
 *   ★★**两条与上游口径直接相关的诚实边界**（都不是"防御性编程"，是这两枚键**真的**可能缺席）：
 *     · `categories` **可能整键缺席**（宿主读不到那张分类表）⇒ 那一排 chip **整排不画**，
 *       **且当前选中回到「全部」** —— 如实，不留一个"选中了但看不见自己选了哪一枚"的过滤态
 *       （那会让员工看到一份被筛过、却看不出被什么筛过的清单）；
 *     · 每条技能上的 `description`/`category`/`downloads`/`installs`/`stars` **可能整键缺席**
 *       —— **"上游没说" ≠ "说是 0"**，故行投影**缺席即不产出那一格**，界面不编占位句。
 *
 *   ★**形状 = 标题 + 分类 chip 行 + 结果卡 + 四态 + 翻页**：结果用**广场同一张卡**
 *   （`esc-skill-card.ts` 的 `enterpriseEscSkillCardSpec`，四个面共用一枚装配）；
 *   四态 = 加载 / 空（**三句互不相同的"为什么空"**）/ 失败可重试 / 就绪。
 *   ★**本刀不做**（YAGNI）：**不做排序控件**（只认默认那一档 `downloads`；三档排序控件登记在下一版）、
 *     不做每页条数控件（`pageSize` 由宿主定）。
 *   ★**界面不拼路径**：结果里唯一能回传的只有那枚**不透明坐标** `installSource`（逐字
 *     `skillhub.cn:<slug>@<version>`），界面**原样收下、原样回传**给既有
 *     `POST /skills/install-from-result`（那条链路与解码器一个字都没动），**不接受任何用户输入**、
 *     不拼路径、不解析它 —— 与「本地三方」那枚 `id` 同一条纪律，另有源码级反向锁盯着这一族文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseListState } from '../list-state.js'
import type { EnterpriseSkillhubBrowse, EnterpriseSkillhubSkill } from '../skill-api-decode.js'
import type { EscCardInstall } from './esc-card.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { ENTERPRISE_ESC_SUB_TAB_ALL_KEY, ENTERPRISE_ESC_SUB_TAB_ALL_LABEL, type EnterpriseEscSubTab } from './esc-sub-tabs.js'
import type { ResourceItem } from './esc-types.js'

/**
 * 这一维只服务哪一个来源（**唯一判据的取值口**；单源响应里已没有 `sourceId`，故它只作文案与说明用）。
 */
export const ENTERPRISE_SKILLHUB_SOURCE_ID = 'skillhub.cn'

/** 这一维度的**完整说法**（`SkillHub` 一个词读不出"从哪来"，故完整说法进悬浮说明与页内说明句）。 */
export const ENTERPRISE_SKILLHUB_SOURCE_TITLE = ENTERPRISE_ESC_LOCAL_COPY.skillHubSourceTitle
/**
 * 页内说明句：说清这一面在铺什么、以及【安装】会做什么。
 *
 * ★措辞**如实**：这一版只取 skillhub.cn 一个来源、**且默认按下载量排**，故不写"搜遍全网"。
 */
export const ENTERPRISE_SKILLHUB_NOTE = '浏览公开技能市场 skillhub.cn 上的技能，默认按下载量排序；安装会把这一条装到本机。'
/** 取数中（`role="status"`）。 */
export const ENTERPRISE_SKILLHUB_LOADING = '正在读取 SkillHub…'
/**
 * ★**三句互不相同的"为什么空"**（本刀明令不许合成一句）——它们回答的是三个不同的问题、
 *   补救动作也不同，合成一句「暂无数据」就是把三件事糊成一件事：
 *   · `no-result`：**看了这一片、没有匹配**（带关键词搜过，或浏览下来这一片真的空）⇒ 下一步是换关键词；
 *   · `empty-category`：**选中了一枚下级分类、而那一类下这一次没有内容** ⇒ 下一步是回「全部」或换一枚；
 *     ★**分类有内容时这句话一次都不许出现**（判据在 `enterpriseSkillHubFace` 里，与 `category` 一起判）。
 *   ★**"还没搜"那一档本刀已整族删除**：进页面自动显示 ⇒ 空输入是**浏览**而不是"没搜"，
 *     那两句（`no-query`/`too-short`）从此**不可达**，故本仓**不留死句子**。
 *   ★**输入 1 个字不许把已有内容清空**：那一档由**聚合层**不发起取数解决（见 `esc-aggregation.tsx`），
 *     本文件这一层因此永远拿不到"半截查询"这个状态。
 */
export const ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT = 'SkillHub 里没有匹配的技能，换几个关键词再试试。'
export const ENTERPRISE_SKILLHUB_EMPTY_CATEGORY = '这个分类下暂时没有技能，换一枚分类或回到「全部」看看。'
/** 翻页那一枚（`hasMore` 为真时才画；点它真的再取一页）。 */
export const ENTERPRISE_SKILLHUB_LOAD_MORE = '加载更多'
/** 安装三段文案 + 落地那句 + 失败前缀（与另两族安装通路**刻意同词**：同一个动词、同一个落点）。 */
export const ENTERPRISE_SKILLHUB_INSTALL = '安装'
export const ENTERPRISE_SKILLHUB_INSTALLING = '正在安装…'
export const ENTERPRISE_SKILLHUB_INSTALL_TITLE = '把这一条装到本机。'
export const ENTERPRISE_SKILLHUB_INSTALLED_NOTICE = '已安装'
export const ENTERPRISE_SKILLHUB_INSTALL_FAILED_PREFIX = '安装失败'
/**
 * ★**一次一条在途**那两档的**可见原因**（产品宪法：禁用控件不许只挂一句 `title`）。
 *
 * · `BLOCKED_BY_BUSY` 写在**被挡住的那一枚**自己的位置（说的是"不是这条有问题，是另一条正在装"）；
 * · `NOT_PORTED` 是**端口整条不在场**（这一版部署没接上在线安装那条路由）。
 * ★两句与「本地三方」那两句**刻意不同词**：那一面的动作是"复制本机另一个库"，这一面是"从公开市场
 *   装"，两句话里的动词与后果都不同 —— 借过来就会让员工以为按的是另一个按钮。
 */
export const ENTERPRISE_SKILLHUB_BLOCKED_BY_BUSY = '另一条技能正在安装，稍后再试。'
export const ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED = '这台机器还没有接上在线安装的接口。'

/**
 * ★**默认排序档**（用户裁决「默认按下载量」）。
 *
 * ★**本刀不做排序控件**（YAGNI），故它是本维**唯一**会发出去的那一档；宿主只认
 * `downloads|installs|score` 三档，**多一档即 400**。★**界面显式传**它（宿主不替你选）：
 * "不发 `sort` 就默认 downloads"这件事是宿主的隐式行为，而界面上"我看到的顺序"必须是**我们自己写下来**的那一句。
 * 三档排序控件登记在**下一版**（届时 `sort` 与 `page` 走同一枚状态，控件与请求不会分叉）。
 */
export const ENTERPRISE_SKILLHUB_DEFAULT_SORT = 'downloads'
/** 首页页码（宿主收窄 1..20）。 */
export const ENTERPRISE_SKILLHUB_FIRST_PAGE = 1
/**
 * ★**关键词下限：2 个字**（与既有在线搜索那枚同一个数字，故员工在两处得到同一条边界）。
 *
 * ★**关键口径是"不足就什么都不做"**：输入 1 个字时**既不发请求、也不清空已有内容**
 * —— 屏上继续铺着上一次那批（浏览结果或上一次搜索的结果）。★**本刀没有"请先输入关键词"那一档**：
 *   空输入是**浏览**（默认形态），而半截输入的正确处理是"先别动"；把它做成一句空态，
 *   等于用一句话把员工**已经看得见的内容**弄没了。
 */
export const ENTERPRISE_SKILLHUB_QUERY_MIN = 2
/**
 * 页码上限（与宿主侧 `SKILLHUB_BROWSE_MAX_PAGE` 逐字同值）。
 *
 * ★它在**这一层**是为了让"还能不能翻"这件事有唯一答案：`page >= 上限` ⇒ 界面**不再**发请求
 * （宿主那边会判 400；"不发那个一定会失败的请求"是这条常量的唯一职责）。
 */
export const ENTERPRISE_SKILLHUB_PAGE_MAX = 20

/** 正在安装某一条那行 `role="status"` 里那一整句（说清正在装谁）。 */
export function enterpriseSkillHubInstallingText(name: string): string {
  return `正在${ENTERPRISE_SKILLHUB_INSTALL}「${name}」…`
}

/** 装好一条那一行 `role="status"` 里那一整句。 */
export function enterpriseSkillHubInstalledText(name: string): string {
  return `已${ENTERPRISE_SKILLHUB_INSTALL}「${name}」。`
}

/* ══════════════ 分类 chip：唯一的投影点 ══════════════ */

/**
 * 响应里的 `categories` → **要渲染的那一排 chip**（含「全部」，恒在首位）。
 *
 * ★**三条口径，逐条都有理由**：
 *  ① **缺席 ⇒ 整排不画**：回 `[]`（`EnterpriseEscSubTabRow` 对空清单返回 `null`）。宿主读不到那张
 *     分类表**不是**"这个市场没有分类" —— 画一排空胶囊是"看着还能用"的死控件，不画才是如实的。
 *     ★**在场时顺序照宿主给的原样**（宿主已按上游 `sortOrder` 排过），**界面不重排**：
 *     多一处排序就多一处"两边不一样"的漂移口，而用户要的就是市场自己给的那一列。
 *  ② **选中态回落**：`categories` 缺席时，`selected` 无论是什么都**回到「全部」**（空 key）。
 *     ★**唯一判据就是"它还在不在这一排里"** —— 分类表读不到、或某一枚这轮没出现在表里，
 *     都归到同一条纪律：**一个不存在的 key 不许继续过滤一份清单**。
 *  ③ **零编造**：文案与 key 全部来自响应（中文名由市场自己给）；`nameEn` 那格**不收**（冻结键集里没有它）。
 *
 * @param categories - 这次响应里的分类表（**可能缺席**）。
 * @param selected - 当前选中的那一枚 key（「全部」即空串）。
 * @returns 渲染清单 + **生效的**选中 key（两者同源，视图不许再自己判一次）。
 */
export function enterpriseSkillHubCategoryChips(
  categories: readonly { readonly key: string; readonly name: string }[] | undefined,
  selected: string,
): { readonly chips: readonly EnterpriseEscSubTab[]; readonly activeKey: string } {
  // ★**缺席 ⇒ 连「全部」都不给**（`chips` 是空清单 ⇒ `EnterpriseEscSubTabRow` 返回 `null` ⇒ **整排不画**）。
  //   这是与另两枚维度**刻意不同**的一条：「本地三方」「企业技能」的「全部」是一枚**永远在场**的退路，
  //   而这一维的「全部」只在**真的有那张分类表**时才有意义 —— 宿主读不到分类表时，一枚孤零零的
  //   「全部」胶囊会让人以为"点它能回到某个完整的列表"，而那时我们手上**没有任何分类可选**。
  //   ★这是**缺席 ≠ 零**那条纪律的最后一格：**没证据说有，就不画**（而不是画一枚空的）。
  if (categories === undefined || categories.length === 0) {
    return { chips: [], activeKey: ENTERPRISE_ESC_SUB_TAB_ALL_KEY }
  }
  const chips: EnterpriseEscSubTab[] = [
    // ★「全部」那一枚的**文案复用既有那枚常量**（`esc-sub-tabs.ts` 已导出它，另两枚维度也在用），
    //   这里不另抄一个字面 —— 两处各写一个「全部」是那种"迟早漂成两种文案"的缝。
    { key: ENTERPRISE_ESC_SUB_TAB_ALL_KEY, label: ENTERPRISE_ESC_SUB_TAB_ALL_LABEL },
    ...categories.map(each => ({ key: each.key, label: each.name })),
  ]
  return {
    chips,
    /** ★**唯一判据是"它还在不在这一排里"**：不在（分类表变了 / 那一枚这轮没出现）⇒ 回落「全部」。 */
    activeKey: categories.some(each => each.key === selected) ? selected : ENTERPRISE_ESC_SUB_TAB_ALL_KEY,
  }
}

/* ══════════════ 单条结果的行投影 ══════════════ */

/** 一条浏览结果在结果面上的**全部呈现事实**（唯一投影：界面不许再自己拼任何一格）。 */
export interface EnterpriseSkillHubRow {
  readonly name: string
  /** 回传给宿主的那条**不透明坐标**（原样收下、原样回传；界面**从不**解析它）。 */
  readonly installSource: string
  readonly description?: string | undefined
  /**
   * 这一条在**本次会话里已经装好**了（判据是调用方给的那份坐标清单，不是技能名）。
   *
   * ★只有真值来源（宿主收下了那次安装）才能把它置真 —— 界面**不乐观切换**。
   */
  readonly installed: boolean
}

/**
 * 一条浏览结果 → 行投影（纯函数，唯一判定点）。
 *
 * ★**只投影卡片与"已装"判定真的会读的那几件**：`name` / `installSource` / `description`（缺席即不产出）/
 *   `installed`。★**下载量/安装量/星标一律不进这一格**：那一行版式与「广场」那张卡是同一张，
 *   它画的是作者头像与平台统计，而这三枚是**这个市场的事实** —— 塞进去会让同一张卡在两处长得不一样
 *   （而这三个数在界面这一侧**也不参与任何判定**，抄进来就是一笔永远不被读的字段）。
 *
 * @param skill - 归一化后的一条技能（`skills[]` 的一枚）。
 * @param installedSources - 本次会话里已经装好的那些坐标（缺省空数组 = 一条都还没装）。
 */
export function enterpriseSkillHubSkillRow(
  skill: EnterpriseSkillhubSkill,
  installedSources: readonly string[] = [],
): EnterpriseSkillHubRow {
  return {
    name: skill.name,
    installSource: skill.installSource,
    ...(skill.description === undefined ? {} : { description: skill.description }),
    installed: installedSources.includes(skill.installSource),
  }
}

/* ══════════════ 结果面的唯一状态投影 ══════════════ */

/** 空态到底空在哪（两档，两句措辞与一处判据）。 */
export type EnterpriseSkillHubEmptyReason =
  /** 看了这一片、没有匹配（下一步：换关键词）。 */
  | 'no-result'
  /** 选中了一枚下级分类，而那一类下这一次没有内容（下一步：换一枚或回「全部」）。 */
  | 'empty-category'

/** 结果面的**唯一状态投影**（四态 → 视图该画什么；同一时刻只可能命中一档）。 */
export interface EnterpriseSkillHubFace {
  readonly kind: 'loading' | 'failed' | 'empty' | 'ready'
  /** 失败态那枚稳定码（人话与下一步由唯一映射给）。 */
  readonly failedCode?: string | undefined
  /** 这一维真的能画的那批（顺序＝响应给的顺序，不重排、不去重）。 */
  readonly rows: readonly EnterpriseSkillHubRow[]
  /** 空态那一句「为什么空」（就绪态缺席）——两句不同的话由 `emptyReason` 选。 */
  readonly emptyNote?: string | undefined
  readonly emptyReason?: EnterpriseSkillHubEmptyReason | undefined
  /** ★**还能不能翻**（`hasMore` 为真且页码未触上限 ⇒ 那枚【加载更多】该画）。 */
  readonly hasMore?: boolean | undefined
}

/**
 * 取数四态 → 结果面（纯函数，唯一判定点）。
 *
 * 四条口径（逐条都有理由）：
 *  ① **四态互斥**：加载 / 失败（唯一提示组件 + 真重发）/ 空 / 就绪；
 *  ② **单源 ⇒ 没有"这一源自己没取到"那一档**：上一刀那一格是四源 fan-out 的产物
 *     （某**一**源 `ok:false` 与整次失败是两件事）；单源浏览面里"这一源没取到"**就是**整次失败，
 *     已经由 `failed` 那一档承担 ⇒ 那一格与它的投影**已整体删除**，不留一句永远为真的旁白。
 *  ③ **两句"为什么空"由"选中了一枚分类吗"唯一区分**：选中分类 ⇒ `empty-category`（「全部」那一枚不算
 *     ——它就是"这一片整体为空"，那句话是诚实的）；未选分类 ⇒ `no-result`。
 *     ★**分类有内容时这句话一次都不许出现**（判据就在这一行：有内容直接走 `ready`，没有分支能到那句）。
 *  ④ **翻页判据**：`hasMore` 与页码一并给（`enterpriseSkillHubHasNextPage` 是唯一点）。
 *
 * @param input - 搜索取数的四态、本次会话里已经装好的那些坐标、当前选中的分类 key、当前页码。
 * @returns 视图所需的全部事实（loading / failed+码 / empty+那句为什么空 / ready+结果行+还能不能翻）。
 */
export function enterpriseSkillHubFace(input: {
  readonly state: EnterpriseListState<EnterpriseSkillhubBrowse>
  readonly installedSources?: readonly string[] | undefined
  /** 当前选中的下级分类 key（「全部」即空串）。 */
  readonly category?: string | undefined
  /** 当前页码（1..`ENTERPRISE_SKILLHUB_PAGE_MAX`）。 */
  readonly page?: number | undefined
}): EnterpriseSkillHubFace {
  const state = input.state
  if (state.kind === 'loading') return { kind: 'loading', rows: [] }
  if (state.kind === 'failed') return { kind: 'failed', failedCode: state.code, rows: [] }
  const rows = state.value.skills.map(skill => enterpriseSkillHubSkillRow(skill, input.installedSources ?? []))
  const hasMore = enterpriseSkillHubHasNextPage({ hasMore: state.value.hasMore, page: input.page })
  if (rows.length > 0) return { kind: 'ready', rows, hasMore }
  const byCategory = (input.category ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY) !== ENTERPRISE_ESC_SUB_TAB_ALL_KEY
  return {
    kind: 'empty',
    rows,
    hasMore,
    emptyReason: byCategory ? 'empty-category' : 'no-result',
    emptyNote: byCategory ? ENTERPRISE_SKILLHUB_EMPTY_CATEGORY : ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT,
  }
}

/**
 * 还能不能翻（**唯一判据**，纯函数、可直调取证）。
 *
 * 两条：`hasMore` 必为真（★宿主那边 `total` 缺席时它**恒 `false`** —— "没证据说还有"不是乐观说有）；
 * 且当前页**没触上限**（触了就 400 —— 不发那个注定失败的请求，与 `hasMore` 是同一条纪律的两面）。
 *
 * @param input - 响应给的 `hasMore` 与当前页码。
 * @returns 该不该画那枚【加载更多】。
 */
export function enterpriseSkillHubHasNextPage(input: {
  readonly hasMore: boolean
  readonly page: number | undefined
}): boolean {
  if (!input.hasMore) return false
  const page = input.page ?? ENTERPRISE_SKILLHUB_FIRST_PAGE
  return page < ENTERPRISE_SKILLHUB_PAGE_MAX
}

/* ══════════════ 与广场**同一张卡**：两枚纯投影 ══════════════ */

/**
 * 一条结果 → 那张卡的 `item`（纯投影，可直调取证）。
 *
 * ★**只映射卡片真的会读的三件**（与「本地三方」那一枚逐条同判）：`id` / `name` / `description`。
 *   `id` 取那枚**不透明坐标** `installSource`（它是这一条在结果集里的唯一身份，也是 React key 的
 *   取值口）；来源名、作者、星标、下载量这些 facts **不进卡片**（卡片那三格是作者头像 + 统计，
 *   而这一面的"来源/计数"是另一件事，塞进去会让卡片画出一枚空头像位）。
 */
export function enterpriseSkillHubCardItem(row: EnterpriseSkillHubRow): ResourceItem {
  return {
    id: row.installSource,
    name: row.name,
    ...(row.description === undefined ? {} : { description: row.description }),
  }
}

/**
 * 一条结果 → 那枚【＋】的终态（纯投影，唯一判定点；四档互斥）。
 *
 * 判据只有三件事实：**这一条是不是在途那一条**、**有没有别的条在途**、**端口在不在场**。
 * 优先级刻意定成"在途 > 其余在途 > 端口"：正在装的那一条才是当下最要紧的事实。
 *
 * ★**可点那一档才挂 `onInstall`**（禁用即无写入口，这是结构事实而不是"挂一枚不会被调的回调"）；
 * ★**三档禁用各自带一句行上可见的原因**（卡片把它画在 `.esc-card-lock`，与广场那几档同一条落点）。
 *
 * @param input - 这一条的行投影、端口在不在场、在途的那一条（**按坐标认**，不是按名字）、点它干什么。
 * @returns 卡片那枚【＋】的终态（七格）。
 */
export function enterpriseSkillHubCardInstall(input: {
  readonly row: EnterpriseSkillHubRow
  readonly wired: boolean
  readonly busy?: { readonly source: string; readonly name: string } | undefined
  readonly onInstall: () => void
}): EscCardInstall {
  const ariaLabel = `${ENTERPRISE_SKILLHUB_INSTALL}${input.row.name}`
  if (input.busy !== undefined && input.busy.source === input.row.installSource) {
    return {
      text: ENTERPRISE_SKILLHUB_INSTALLING,
      disabled: true,
      busy: true,
      title: ENTERPRISE_SKILLHUB_INSTALLING,
      ariaLabel,
    }
  }
  if (input.busy !== undefined) {
    return {
      text: ENTERPRISE_SKILLHUB_INSTALL,
      disabled: true,
      title: ENTERPRISE_SKILLHUB_BLOCKED_BY_BUSY,
      ariaLabel,
      reason: ENTERPRISE_SKILLHUB_BLOCKED_BY_BUSY,
    }
  }
  if (!input.wired) {
    return {
      text: ENTERPRISE_SKILLHUB_INSTALL,
      disabled: true,
      title: ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED,
      ariaLabel,
      reason: ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED,
    }
  }
  return {
    text: ENTERPRISE_SKILLHUB_INSTALL,
    disabled: false,
    title: ENTERPRISE_SKILLHUB_INSTALL_TITLE,
    ariaLabel,
    onInstall: input.onInstall,
  }
}