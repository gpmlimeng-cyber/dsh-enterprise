/**
 * [INPUT]: 只依赖 `list-state` 的四态类型、`skill-api-decode` 的在线搜索投影类型、`online-search.ts` 的**既有**查询档位判据与行投影、`esc-card` 的【＋】终态类型、`esc-copy` 的文案真源与 `esc-types` 的卡片数据形状（`ResourceItem`）——大多是**类型导入**（不依赖 React、不依赖任何宿主 API、不发请求、不认识路径）
 * [OUTPUT]: 对外提供技能页第四枚维度「SkillHub」（本刀 ③）的**纯事实层**：来源 id 常量 `ENTERPRISE_SKILLHUB_SOURCE_ID`、可见文案（标题 / 页内说明 / 查询档位两句 / 加载 / 两句不同的"为什么空" / 安装三段 / 在途与两档禁用原因 / 安装落地那句）、结果面的唯一状态投影 `enterpriseSkillHubFace`（四态 → loading / failed / empty / ready，**互斥**）、以及两枚与卡片对接的纯投影 `enterpriseSkillHubCardItem`（那条结果 → 卡片 `item`）与 `enterpriseSkillHubCardInstall`（那条结果 → 卡片【＋】终态）
 * [POS]: dsh-ui 技能页**第四枚**维度「SkillHub」的**唯一判定与文案真源**（视图只画、聚合层只接线）。
 *   ★★**这一维是"换"不是"加"**：用户裁决「那一枚的名字与来源都换」——技能页第四枚维度由
 *     「企业技能」换成 `SkillHub`（位次与数量一字未动，仍是四枚）。★「企业技能」**维度整枚撤掉**，
 *     但它的**内容不丢**：`esc-catalog-list.tsx` / `esc-catalog.ts` 那一面本刀按 ① 明令**不动**
 *     （与「已安装」并列登记为"下一刀收编"），而它在技能页的**入口页签**换成这一枚；
 *     「应用商店 → 企业技能」与企业设置 → 技能两处照旧是它的落点。
 *
 *   ★★**数据源 = 既有的在线搜索本机路由**（`GET /skills/online-search?q=…`，四源 fan-out），
 *     `esc-api.ts` 那一格是**委托**（同一份 `requestJson` + 同一个严格解码器）——本文件一个新路径、
 *     一次 fetch、一个解码器都没有。★**v1 只投影 `sourceId === 'skillhub.cn'` 那批**：另三源的结果
 *     在界面侧被**丢掉**。★这是**如实认下的浪费**，不是"顺手滤一下"：那条路由是四源 fan-out，
 *     要省掉这笔浪费只能给它加一个 `source` 参数（让它只 fan-out 一个源），而那要动
 *     `platform-client`（本刀禁改：bundle 有另一个写者）。★**绝不在界面侧另造一条"只取一源"的路由**
 *     —— 那才是第二份真值（同一个能力两条通路，迟早漂）。将来那条参数落地时，改动点是**这一处过滤**
 *     （与 `esc-api.ts` 那一格），视图一个字都不用动。
 *
 *   ★**形状 = 搜索框 + 结果卡 + 四态**：搜索框是工具栏那一枚（本页只有它一枚输入框，不新造第二个
 *     —— 同一屏两个搜索框是"哪个在搜什么"的经典歧义）；结果用**广场同一张卡**
 *     （`esc-skill-card.ts` 的 `enterpriseEscSkillCardSpec`，四个面共用一枚装配）；
 *     四态 = 加载 / 空（**两句不同的"为什么空"**）/ 失败可重试 / 就绪。
 *   ★**不做**（本刀明令）：不做分类 chip（skillhub 的分类 v1 不引入，故本维度**不铺 chip 行**）、
 *     不做分页（那条路由是"搜一次给一批"）。
 *   ★**界面不拼路径**：搜索结果给回来的只有那枚不透明坐标 `installSource`，界面**原样收下、原样回传**
 *     （`POST /skills/install-from-result` 正文关闭键集恰好 `{source}`），**不接受任何用户输入**、
 *     不拼路径、不解析它 —— 与「本地三方」那枚 `id` 同一条纪律，另有源码级反向锁盯着这一族文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseListState } from '../list-state.js'
import type { EnterpriseOnlineSkillResult, EnterpriseOnlineSkillSearch } from '../skill-api-decode.js'
import type { EscCardInstall } from './esc-card.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { ResourceItem } from './esc-types.js'
import {
  ENTERPRISE_ONLINE_QUERY_MIN,
  enterpriseOnlineQueryState,
  enterpriseOnlineResultRow,
  type EnterpriseOnlineResultRow,
} from '../online-search.js'

/**
 * 这一维只投影哪一个来源（**唯一判据的取值口**）。
 *
 * ★为什么是一枚常量而不是散在视图里的字面量：它是"这一维是谁"这件事的落点——将来那条
 *   `source` 参数落地时，改的是**路由侧与这一处**，视图那一侧一个字都不用动。
 */
export const ENTERPRISE_SKILLHUB_SOURCE_ID = 'skillhub.cn'

/** 这一维度的**完整说法**（`SkillHub` 一个词读不出"从哪来"，故完整说法进悬浮说明与页内说明句）。 */
export const ENTERPRISE_SKILLHUB_SOURCE_TITLE = ENTERPRISE_ESC_LOCAL_COPY.skillHubSourceTitle
/**
 * 页内说明句：说清这一面在搜什么、以及【安装】会做什么。
 *
 * ★措辞**如实**：v1 只搜 skillhub.cn 一个来源（四源 fan-out 里我们只用这一源），故不写"搜遍全网"。
 */
export const ENTERPRISE_SKILLHUB_NOTE = '从公开技能市场 skillhub.cn 搜索技能；安装会把这条结果装到本机。'
/** 查询档位的两句（与 `online-search.ts` 那面**刻意同判**：同一个下限、同一种"还没到门槛"的交代）。 */
export const ENTERPRISE_SKILLHUB_IDLE = '在右上角的搜索框里输入关键词，开始搜索 SkillHub。'
export const ENTERPRISE_SKILLHUB_TOO_SHORT = `请至少输入 ${ENTERPRISE_ONLINE_QUERY_MIN} 个字再搜索。`
/** 搜索中（`role="status"`）。 */
export const ENTERPRISE_SKILLHUB_LOADING = '正在搜索 SkillHub…'
/**
 * ★**两句不同的"为什么空"**（本刀 ③ 明令不许合成一句）——它们回答的是两个不同的问题、
 *   补救动作也不同：
 *   · `no-query`（含"太短"那一档）：**员工还没搜**（没输关键词 / 输得不够）⇒ 下一步是去搜；
 *   · `no-result`：**搜过了、这个来源里没有匹配** ⇒ 下一步是换关键词。
 *   合成一句「暂无数据」就把"我没搜"与"它没有"糊成一件事（本仓第一版口径 31 正是被这条否掉的）。
 */
export const ENTERPRISE_SKILLHUB_EMPTY_NO_QUERY = ENTERPRISE_SKILLHUB_IDLE
export const ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT = 'SkillHub 里没有匹配的技能，换几个关键词再试试。'
/**
 * skillhub.cn 这一个源**这次没取到**时那句（`sources[]` 里它 `ok:false`）。
 *
 * ★它与上面那句"没有结果"**刻意分开**：那一条路由是四源 fan-out，某**一**源失败**不等于**整次失败
 *   （整次失败走 `failed` 那一档，出唯一提示组件 + 真重发）；把"这个源没取到"说成"没有结果"就是撒谎。
 */
export const ENTERPRISE_SKILLHUB_SOURCE_DOWN = '「skillhub.cn」这个来源这次没有取到。'
/** 安装三段文案 + 落地那句 + 失败前缀（与另两族安装通路**刻意同词**：同一个动词、同一个落点）。 */
export const ENTERPRISE_SKILLHUB_INSTALL = '安装'
export const ENTERPRISE_SKILLHUB_INSTALLING = '正在安装…'
export const ENTERPRISE_SKILLHUB_INSTALL_TITLE = '把这条结果装到本机。'
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
export const ENTERPRISE_SKILLHUB_BLOCKED_BY_BUSY = '另一条结果正在安装，稍后再试。'
export const ENTERPRISE_SKILLHUB_INSTALL_NOT_PORTED = '这台机器还没有接上在线安装的接口。'

/** 正在安装某一条那行 `role="status"` 里那一整句（说清正在装谁）。 */
export function enterpriseSkillHubInstallingText(name: string): string {
  return `正在${ENTERPRISE_SKILLHUB_INSTALL}「${name}」…`
}

/** 装好一条那一行 `role="status"` 里那一整句。 */
export function enterpriseSkillHubInstalledText(name: string): string {
  return `已${ENTERPRISE_SKILLHUB_INSTALL}「${name}」。`
}

/* ══════════════ 结果面的唯一状态投影 ══════════════ */

/** 空态到底空在哪（三类，两句措辞与一处判据）。 */
export type EnterpriseSkillHubEmptyReason =
  /** 员工还没输关键词（下一步：去搜）。 */
  | 'no-query'
  /** 关键词没到下限（下一步：再输几个字）。 */
  | 'too-short'
  /** 搜过了、skillhub.cn 里没有匹配（下一步：换关键词）。 */
  | 'no-result'

/** 结果面的**唯一状态投影**（四态 → 视图该画什么；同一时刻只可能命中一档）。 */
export interface EnterpriseSkillHubFace {
  readonly kind: 'loading' | 'failed' | 'empty' | 'ready'
  /** 失败态那枚稳定码（人话与下一步由唯一映射给）。 */
  readonly failedCode?: string | undefined
  /** 这一维真的能画的那批（**已按来源过滤**；顺序＝响应给的顺序，不重排、不去重）。 */
  readonly rows: readonly EnterpriseOnlineResultRow[]
  /** 空态那一句「为什么空」（就绪态缺席）——两句不同的话由 `emptyReason` 选。 */
  readonly emptyNote?: string | undefined
  readonly emptyReason?: EnterpriseSkillHubEmptyReason | undefined
  /** ★**这个来源自己那句坏消息**（`ok:false` 时）：与"空"分开说，且**任何一档都可能在场**。 */
  readonly sourceNote?: string | undefined
}

/**
 * 查询 + 取数四态 → 结果面（纯函数，唯一判定点）。
 *
 * 四条口径（逐条都有理由）：
 *  ① **查询没到门槛时不铺上一次的结果**（判据复用 `online-search.ts` 的 `enterpriseOnlineQueryState`，
 *     同一个下限 `ENTERPRISE_ONLINE_QUERY_MIN`）：员工改了关键词就该看到"现在的输入还不足"，
 *     而不是一批已经不对应的旧结果；
 *  ② **够长时照四态铺**：加载 / 失败（唯一提示组件 + 真重发）/ 就绪；
 *  ③ **只投影 `sourceId === 'skillhub.cn'` 那批**（判据就在这一行）：另三源的结果**如实丢掉**
 *     （v1 的已知浪费，见文件头那段——省掉它要动 `platform-client`）；
 *  ④ **这个源自己那句坏消息在任何一档都照铺**：`ok:false` 是"这一源这次没取到"，与整次失败是两件事。
 *
 * @param input - 搜索取数的四态、搜索框里的当前文本、本次会话里已经装好的那些坐标。
 * @returns 视图所需的全部事实（loading / failed+码 / empty+那句为什么空 / ready+结果行）。
 */
export function enterpriseSkillHubFace(
  state: EnterpriseListState<EnterpriseOnlineSkillSearch>,
  query: string,
  installedSources: readonly string[] = [],
): EnterpriseSkillHubFace {
  const queryState = enterpriseOnlineQueryState(query)
  if (queryState === 'idle') {
    return { kind: 'empty', rows: [], emptyReason: 'no-query', emptyNote: ENTERPRISE_SKILLHUB_EMPTY_NO_QUERY }
  }
  if (queryState === 'too-short') {
    return { kind: 'empty', rows: [], emptyReason: 'too-short', emptyNote: ENTERPRISE_SKILLHUB_TOO_SHORT }
  }
  if (state.kind === 'loading') return { kind: 'loading', rows: [] }
  if (state.kind === 'failed') return { kind: 'failed', failedCode: state.code, rows: [] }
  // ★判据只有这一处：`sourceId` 与那枚常量逐字相等。★行投影复用既有那枚（不写第二份）。
  const skillHubResults: readonly EnterpriseOnlineSkillResult[] =
    state.value.results.filter(result => result.sourceId === ENTERPRISE_SKILLHUB_SOURCE_ID)
  const rows = skillHubResults.map(result => enterpriseOnlineResultRow(result, installedSources))
  const source = state.value.sources.find(each => each.id === ENTERPRISE_SKILLHUB_SOURCE_ID)
  const sourceNote = source !== undefined && !source.ok ? ENTERPRISE_SKILLHUB_SOURCE_DOWN : undefined
  if (rows.length > 0) {
    return { kind: 'ready', rows, ...(sourceNote === undefined ? {} : { sourceNote }) }
  }
  return {
    kind: 'empty',
    rows,
    emptyReason: 'no-result',
    emptyNote: ENTERPRISE_SKILLHUB_EMPTY_NO_RESULT,
    ...(sourceNote === undefined ? {} : { sourceNote }),
  }
}

/* ══════════════ 与广场**同一张卡**：两枚纯投影 ══════════════ */

/**
 * 一条搜索结果 → 那张卡的 `item`（纯投影，可直调取证）。
 *
 * ★**只映射卡片真的会读的三件**（与「本地三方」那一枚逐条同判）：`id` / `name` / `description`。
 *   `id` 取那枚**不透明坐标** `installSource`（它是这一条在结果集里的唯一身份，也是 React key 的
 *   取值口）；来源名、作者、星标、安装量这些 facts **不进卡片**（卡片那三格是作者头像 + 统计，
 *   而这一面的"来源/计数"是另一件事，塞进去会让卡片画出一枚空头像位）。
 */
export function enterpriseSkillHubCardItem(row: EnterpriseOnlineResultRow): ResourceItem {
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
  readonly row: EnterpriseOnlineResultRow
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
