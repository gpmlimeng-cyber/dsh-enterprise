/**
 * [INPUT]: 只依赖 `list-state` 的四态类型、`skill-api-decode` 的在线搜索投影类型与 `display-format` 的
 *   计数格式化（不依赖 React、不依赖宿主 API）
 * [OUTPUT]: 对外提供「添加技能 → 在线搜索」这一面（查询框 → 三源结果 → 安装）的**纯事实层**：全部文案
 *   （标题 / 说明 / 返回 / 查询框 / 搜索 / 空闲 / 过短 / 加载 / 空结果 / 安装三段 / 来源与计数标签 /
 *   **结果计数与就绪播报**、结果面的**节名**与行上的**「已装」态**）、
 *   防抖与最短查询长度的常量、逐源**两种坏消息**的投影 `enterpriseOnlineSourceNotes`
 *   （`ok:false` = 这个源这次没取到；`dropped>0` = 取到了但有 N 条装不出来被丢掉——**分开说**）、
 *   单条结果的行投影 `enterpriseOnlineResultRow`（标题 / 描述 / 来源 + 作者 + 星标 + 安装量 / 可安装性）
 *   与整面的唯一状态投影 `enterpriseOnlineFace`
 * [POS]: dsh-ui 在线搜索那一面的**唯一判定与文案真源**（页面只画、控制器只接线）；真源是本刀冻结契约
 *   （`GET /skills/online-search` 的逐源状态 + `POST /skills/install-from-result`）与口径 15/26
 *   （**结果面是页内视图、不是弹窗**）。★本文件里没有一次 fetch、没有一处 React、没有第二份错误码表。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { formatCount } from './display-format.js'
import type { EnterpriseListState } from './list-state.js'
import type { EnterpriseOnlineSkillResult, EnterpriseOnlineSkillSearch, EnterpriseOnlineSkillSource } from './skill-api-decode.js'

/** 结果面标题与它下面那句人话（与技能/配方/系统搜索那几面同一形制）。 */
export const ENTERPRISE_ONLINE_TITLE = '在线搜索技能'
export const ENTERPRISE_ONLINE_NOTE = '从公开的技能来源里搜索，找到合适的可以装到本机。'
/**
 * 结果**列表那一节**的名字（≠ 页名）。
 *
 * ★ 为什么不能再用页名：这一节的标题原先与页名是**同一个常量**，真机上就是「在线搜索技能」上下各一次
 *   （页标题 h3 + 节标题 h4），而节的无障碍名又与外层 `role="region"` 同名 ⇒ 读屏在同一屏连报三遍
 *   同一个名字、眼睛也读到两遍。节名改说「这一节装的是什么」，两个 landmark 的名字因此不再相同。
 */
export const ENTERPRISE_ONLINE_RESULTS_TITLE = '搜索结果'
/** 面包屑（可见文案）与它的完整无障碍名。 */
export const ENTERPRISE_ONLINE_BACK_TEXT = '返回技能列表'
export const ENTERPRISE_ONLINE_BACK_LABEL = '返回技能列表'
/** 查询框：无障碍名 / 占位 / 搜索按钮的可见文案与完整无障碍名。 */
export const ENTERPRISE_ONLINE_QUERY_LABEL = '搜索在线技能'
export const ENTERPRISE_ONLINE_QUERY_PLACEHOLDER = '输入技能名或关键词'
export const ENTERPRISE_ONLINE_SEARCH = '搜索'
export const ENTERPRISE_ONLINE_SEARCH_LABEL = '按关键词搜索在线技能'
/**
 * 输入后**自动搜索**的防抖时长（照上游 300ms 的体感；取值写在这里，界面不各写一份）。
 *
 * 为什么要有它：三个源是**真的出网**（每源一次取数、15s 超时），逐字敲一下搜一次既慢又浪费；
 * 300ms 是「停手就搜」的常见取值。用户也可以随时按【搜索】/ 回车**立刻**搜（不等防抖）。
 */
export const ENTERPRISE_ONLINE_DEBOUNCE_MS = 300
/**
 * 最短查询长度：2 个字。
 *
 * Host 侧只要求「非空」（形状收窄），但一个字符就去打三个源既慢又几乎必然空手 ⇒ 界面这一层给一条
 * 更实用的下限，并**如实说出**为什么没搜（`ENTERPRISE_ONLINE_TOO_SHORT`），而不是静默不动。
 */
export const ENTERPRISE_ONLINE_QUERY_MIN = 2
/** 还没输入够时的两句人话（空 = 请他输入；过短 = 说清下限）。 */
export const ENTERPRISE_ONLINE_IDLE = '输入关键词后开始搜索。'
export const ENTERPRISE_ONLINE_TOO_SHORT = `请至少输入 ${ENTERPRISE_ONLINE_QUERY_MIN} 个字再搜索。`
/** 搜索中（`role="status"`）。 */
export const ENTERPRISE_ONLINE_LOADING = '正在搜索…'
/** 搜到但没有结果时的那一句（不是空白，也不是失败）。 */
export const ENTERPRISE_ONLINE_EMPTY = '没有找到匹配的技能，换几个关键词再试试。'
/** 安装动作三段文案：可点 / 在途 / 成功；外加一次只允许一条时那句可见原因。 */
export const ENTERPRISE_ONLINE_INSTALL = '安装'
export const ENTERPRISE_ONLINE_INSTALLING = '正在安装…'
export const ENTERPRISE_ONLINE_INSTALL_BUSY_SUFFIX = '完成前不能安装别的结果。'
/**
 * 这一次会话里**已经装好**的那一条，行上替换动作按钮的**状态词**。
 *
 * ★ 为什么要有它：装成功原先只多出一句「已安装「x」。」，而那一行的【安装】按钮**照旧可点**
 *   ⇒ 同一条结果会被反复装。本仓的产品宪法是「能走的路才画、禁用须有可见说明」，故这一行的
 *   可走之路已经走完 ⇒ 不再画按钮，改画这枚**看得见的状态词**（与系统搜索那一面「已装」同一形制）。
 */
export const ENTERPRISE_ONLINE_INSTALLED = '已装'
/** 失败提示的动作前缀（人话与下一步由唯一映射给）。 */
export const ENTERPRISE_ONLINE_INSTALL_FAILED_PREFIX = '安装失败'
/** 行上那句 facts 的标签（来源名 + 可选三枚计数）。 */
export const ENTERPRISE_ONLINE_SOURCE_PREFIX = '来源：'
export const ENTERPRISE_ONLINE_AUTHOR_PREFIX = '作者：'
export const ENTERPRISE_ONLINE_STARS_PREFIX = '星标：'
export const ENTERPRISE_ONLINE_INSTALLS_PREFIX = '安装量：'

/** 安装中那一行（`role="status"`）：说清正在装谁 + 为什么别处这会儿不能点。 */
export function enterpriseOnlineInstallingText(name: string): string {
  return `正在${ENTERPRISE_ONLINE_INSTALL}「${name}」…${ENTERPRISE_ONLINE_INSTALL_BUSY_SUFFIX}`
}

/** 安装成功那一行（`role="status"`）。 */
export function enterpriseOnlineInstalledText(name: string): string {
  return `已${ENTERPRISE_ONLINE_INSTALL}「${name}」。`
}

/**
 * 结果计数（结果面节头那枚）：**零结果时整枚缺席**（返回 `undefined`），不说「0 条结果」、也不另说
 * 「没有搜索结果」——那时下面那句 `ENTERPRISE_ONLINE_EMPTY` 已经把结论与下一步都说了，再叠一句
 * 只是同屏两句同义话（本刀之前正是如此）。有结果时给「N 条结果」。
 *
 * ★ 界面**不许**再自己拼 `${rows.length} 条结果`（本刀之前就是在视图层内联拼的：既没有测试锁它，
 *   又比同族 `enterpriseSystemCountText` 多一套写法）。
 * ★ 与同族那枚的口径差别是有意的：系统搜索那面的节头是**一个根**（「这个位置有没有东西」需要一个
 *   数量结论），而这一面的节头就是**整面结果**，零结果由那句空话承担。
 */
export function enterpriseOnlineCountText(count: number): string | undefined {
  return count === 0 ? undefined : `${count} 条结果`
}

/**
 * 就绪那一句 `role="status"` **播报**：说清「这一趟搜完了、搜到多少」。
 *
 * 为什么必须有它：加载态有一句 `role="status"` 的「正在搜索…」，转就绪后那行**消失**、结果区又不是
 * live region ⇒ 读屏用户根本不知道搜完了（这是一个真缺口，不是洁癖）。有结果时由本节头补上这句；
 * **零结果时不走它**——那时由 `ENTERPRISE_ONLINE_EMPTY` 那句自己带 `role="status"` 播报（同屏不叠三句
 * 都在说「零」）。
 */
export function enterpriseOnlineReadyText(count: number): string {
  return `找到 ${count} 条结果。`
}

/** 查询框此刻处于哪一档（空闲 / 太短 / 可以搜）——纯判定，界面据此说三种不同的话。 */
export type EnterpriseOnlineQueryState = 'idle' | 'too-short' | 'ready'

/**
 * 查询串 → 这一档（唯一判定点）。
 *
 * 判据只在**去空白之后**：全空白 = 空闲；长度不足 `ENTERPRISE_ONLINE_QUERY_MIN` = 太短；否则可搜。
 */
export function enterpriseOnlineQueryState(query: string): EnterpriseOnlineQueryState {
  const trimmed = query.trim()
  if (trimmed.length === 0) return 'idle'
  return trimmed.length < ENTERPRISE_ONLINE_QUERY_MIN ? 'too-short' : 'ready'
}

/**
 * 逐源的**两种坏消息**（本刀最要紧的呈现口径）。
 *
 * `ok:false` 与 `dropped>0` **绝不合并成一句「部分失败」**：前者是「这个源这次没取到」（网络/上游），
 * 后者是「取到了，但有 N 条装不出来、被如实丢掉了」。两句都**带上源名**，用户因此知道是哪几个源。
 * 两个都没有（`ok:true` 且没有 `dropped`）的源**不产出任何一行**（成功不报喜，页面不加噪音）。
 */
export interface EnterpriseOnlineSourceNote {
  readonly id: string
  readonly kind: 'failed' | 'dropped'
  readonly text: string
}

export function enterpriseOnlineSourceNotes(
  sources: readonly EnterpriseOnlineSkillSource[],
): readonly EnterpriseOnlineSourceNote[] {
  const notes: EnterpriseOnlineSourceNote[] = []
  for (const source of sources) {
    if (!source.ok) {
      notes.push({ id: source.id, kind: 'failed', text: `「${source.id}」这个来源这次没有取到。` })
      continue
    }
    // `dropped` 只可能是正数（解码层保证），故这里不必再判 0。
    if (source.dropped !== undefined) {
      notes.push({
        id: source.id,
        kind: 'dropped',
        text: `「${source.id}」有 ${source.dropped} 条结果不提供可安装的来源，已跳过。`,
      })
    }
  }
  return notes
}

/** 一条搜索结果在结果面上的**全部呈现事实**（唯一投影：界面不许再自己拼标题、facts 或「已装」态）。 */
export interface EnterpriseOnlineResultRow {
  /** 来源 id（今天就是 `skills.sh` / `claude-plugins.dev` / `clawhub.ai`，直接当来源名，不编人话名）。 */
  readonly sourceId: string
  readonly name: string
  readonly description?: string | undefined
  /** 标题那一行下面那句 facts：`来源：x · 作者：y · 星标：n · 安装量：m`（缺席的那几段不画）。 */
  readonly note: string
  /** 回传给 Host 的那条坐标（**不透明值**：原样收下、原样回传）。 */
  readonly installSource: string
  /**
   * 这一条在**本次会话里已经装好**了（判据是调用方给的那份坐标清单）。
   *
   * ★ 只有真值来源（Host 收下了那次安装）才能把它置真——界面**不乐观切换**（与系统搜索那一面
   *   「成功不自己改 state、重新盘点让 Host 回真值」同一条纪律）。为真时行上**不画**动作按钮，
   *   改画 `ENTERPRISE_ONLINE_INSTALLED` 那枚状态词：这一行的可走之路已经走完，再画一枚按钮就是
   *   让用户反复装同一条。
   */
  readonly installed: boolean
}

/**
 * 一条搜索结果 → 行投影（唯一判定点）。
 *
 * @param result - 归一化后的一条结果。
 * @param installedSources - 本次会话里已经装好的那些坐标（缺省空数组 = 一条都还没装）。
 */
export function enterpriseOnlineResultRow(
  result: EnterpriseOnlineSkillResult,
  installedSources: readonly string[] = [],
): EnterpriseOnlineResultRow {
  const segments = [`${ENTERPRISE_ONLINE_SOURCE_PREFIX}${result.sourceId}`]
  if (result.author !== undefined) segments.push(`${ENTERPRISE_ONLINE_AUTHOR_PREFIX}${result.author}`)
  // 两枚计数是**给定的第三方事实**（真机上到过 963199）：照本包展示口径加千分位，别把六位数原样怼上屏。
  if (result.stars !== undefined) segments.push(`${ENTERPRISE_ONLINE_STARS_PREFIX}${formatCount(result.stars)}`)
  if (result.installs !== undefined) segments.push(`${ENTERPRISE_ONLINE_INSTALLS_PREFIX}${formatCount(result.installs)}`)
  return {
    sourceId: result.sourceId,
    name: result.name,
    ...(result.description === undefined ? {} : { description: result.description }),
    note: segments.join(' · '),
    installSource: result.installSource,
    installed: installedSources.includes(result.installSource),
  }
}

/** 结果面的**唯一状态投影**（查询档位 + 取数四态 → 页面该画什么）。 */
export interface EnterpriseOnlineFace {
  readonly kind: 'idle' | 'too-short' | 'loading' | 'failed' | 'ready'
  /** 失败态那枚稳定码（人话与下一步由唯一映射给）。 */
  readonly failedCode?: string | undefined
  /** 逐源的两种坏消息（**任何一档都可能为空数组**：没有坏消息就不出那些行）。 */
  readonly notes: readonly EnterpriseOnlineSourceNote[]
  readonly rows: readonly EnterpriseOnlineResultRow[]
  /** 零结果时那一句人话（有结果时缺席）。 */
  readonly emptyNote?: string | undefined
}

/**
 * 查询档位 + 取数四态 → 结果面（纯函数，唯一判定点）。
 *
 * 三条口径：
 *  ① 查询还没到长度门槛时**看查询档位**（空闲 / 太短各一句人话）——此时**不**铺上一次的结果：
 *     用户改了关键词就该看到「现在的输入还不足」而不是一批已经不对应的旧结果；
 *  ② 够长时照取数四态铺：加载 / 失败（唯一提示组件 + 真重发）/ 就绪（含「零结果」那句人话）；
 *  ③ 逐源的两句坏消息**在就绪档照铺**（含零结果——那时更要铺，否则用户会以为三个源本来就没东西）；
 *     档位（空闲 / 太短）与加载 / 失败三档为空数组：那会儿**一条真值都还没有**，铺上一次的坏消息是说谎。
 *
 * @param state - 搜索取数的四态（`list-state` 的唯一状态机）。
 * @param query - 查询框里的当前文本。
 * @param installedSources - 本次会话里已经装好的那些坐标（透传给行投影，决定行上画按钮还是「已装」）。
 */
export function enterpriseOnlineFace(
  state: EnterpriseListState<EnterpriseOnlineSkillSearch>,
  query: string,
  installedSources: readonly string[] = [],
): EnterpriseOnlineFace {
  const queryState = enterpriseOnlineQueryState(query)
  if (queryState === 'idle') return { kind: 'idle', notes: [], rows: [] }
  if (queryState === 'too-short') return { kind: 'too-short', notes: [], rows: [] }
  if (state.kind === 'loading') return { kind: 'loading', notes: [], rows: [] }
  if (state.kind === 'failed') return { kind: 'failed', failedCode: state.code, notes: [], rows: [] }
  const notes = enterpriseOnlineSourceNotes(state.value.sources)
  const rows = state.value.results.map(result => enterpriseOnlineResultRow(result, installedSources))
  return state.kind === 'empty'
    ? { kind: 'ready', notes, rows, emptyNote: ENTERPRISE_ONLINE_EMPTY }
    : { kind: 'ready', notes, rows }
}
