/**
 * [INPUT]: 只依赖 `list-state` 的四态类型、`skill-api-decode` 的三方候选投影类型、`esc-third-party-install` 的在途类型、`esc-types` 的卡片数据形状（`ResourceItem`）与 `esc-card` 的【＋】终态类型（`EscCardInstall`）——**全是类型导入**（不依赖 React、不依赖任何宿主 API、不发请求）
 * [OUTPUT]: 对外提供「本地三方 Agent 技能源」（口径 62）这一面的**纯事实层**：可见文案（页内说明 / 加载 / 失败前后缀 / **两句不同的空话** / 三态中文 / 安装动作与它在途·成功文案 / 在途禁用原因）、唯一状态投影 `enterpriseThirdPartyFace`（四态 → loading / failed / empty / ready，**互斥**）、按根分组的 `enterpriseThirdPartyRootGroups`（含未检测到的根）、单条候选的行投影 `enterpriseThirdPartySkillRow`（可安装性 + 可见原因）、一次一条的**按钮终态** `enterpriseThirdPartyActionPlan`（可点 / 在途 / 被别人的在途挡住 / 端点缺席，四档各有可见文案），**本刀（②）再加两枚**：卡片 `item` 投影 `enterpriseThirdPartyCardItem` 与【＋】终态的**纯适配器** `enterpriseThirdPartyCardInstall`（把上面那枚既有计划映成 `EscCardInstall`；**既有计划一个字不改**）
 * [POS]: dsh-ui 技能页第三枚维度的**唯一判定与文案真源**（页面只画、控制器只接线）。真源是冻结契约
 *   `analysis/esc-third-party-skills-spec.md` §3.2/§3.3（`GET /skills/third-party` +
 *   `POST /skills/third-party/install`）。
 *   ★**本刀（② 本地三方换成与广场同一张卡 + 同一骨架）**：这一面的**版式整体退场**
 *     （`.esc-third-party-row` / `-rowline` / `-rowmain` / `-name` / `-desc` / `-meta` / `-action` /
 *     `-install` / `-lock` 那一套**行 CSS 一并删掉，不留死规则**），换成与广场逐字同构的
 *     `.esc-list-section > .esc-catalog-cell > 同一张卡`。★**为什么非换不可**：同一个页面上两张卡
 *     两种版式，就是用户已经报过的那类"同一件东西两种形态"；而"哪一枚卡片拿到哪些入参"这件事
 *     一旦散成两份实现，注定会漂（本仓已被咬过三次）。★**换卡不丢东西**（逐件保留）：按来源根
 *     分组的组标题、根汇总那句、二级 chip 行（`esc-sub-tabs.ts`）、**两句不同的"为什么空"**、
 *     失败态与真重发、在途与禁用原因 —— 全部照旧，只是"行"换成"卡片"。
 *   ★它与 `esc-third-party-install.ts` 的分工：那个对象只管「**一次只允许一条在途**」这条动作纪律
 *     （可直调取证、不需要 DOM），本文件只管「收回来之后说什么、哪几条能点、为什么不能点」。
 *   ★**二级 chip 行那一层不在本文件**：`esc-sub-tabs.ts` 是「维度 → 二级 chip 行 → 内容过滤」这条机制
 *     的**唯一真源**（含选中的 chip 消失时回落「全部」、按 key 过滤这两条判据）；本文件只负责
 *     “由**这一维度的真响应**投出哪几枚 chip”（`enterpriseThirdPartySubChips`）。下一个维度
 *     （SkillHub 的市场来源）复用那一份机制，不重写第二套。
 *   ★它与系统搜索那一面（`system-search.ts`）的**关系**：结构照它抄（四态 + 按根分组 + 三态行投影
 *     + 只有可装那一态画按钮），但**语义不同、故文案与判据都另立一套**：
 *     · 那一面扫的是**官方**技能根（`~/.dsh/skills`），动作是「纳入」（只登记，目录本来就在加载的根里）；
 *     · 这一面扫的是**别的 Agent CLI 的库**（`~/.claude/skills`、`~/.codex`…），动作是「安装」
 *       （**把目录复制进** `<dshHome>/skills`——那些根不在官方扫描范围里，光登记 Agent 加载不到）。
 *     两套语义并存但各自有名字，谁也不冒充谁（契约 §3.2 末尾那条明令）。
 *   ★**为什么界面里没有一处能拼路径**：三方投影的形状里**根本没有 path**（宿主绝对路径不进浏览器），
 *     每条候选只有一枚不透明 `id`；安装时回传的就是它。这条纪律在**类型层**成立，门禁另有一条
 *     源码级反向锁盯着本面相关文件（不许出现 `join(`、不许用模板串把 `~` 与目录名拼起来）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseListState } from '../list-state.js'
import type { EnterpriseThirdPartyRoot, EnterpriseThirdPartySkill, EnterpriseThirdPartySkills } from '../skill-api-decode.js'
import type { EscCardInstall } from './esc-card.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { ResourceItem } from './esc-types.js'

/**
 * 这一维度的**完整说法**（「本地三方 Agent 技能源」）。
 *
 * ★它是 `esc-copy.ts` 那一格的**唯一再出口**（不在这里另写一份字面量）：本文件的页内说明句与
 *   工具栏那一枚标签的悬浮说明都引它 ⇒ "悬浮说明"与"页内说明"不可能各说各的。
 */
export const ENTERPRISE_THIRD_PARTY_SOURCE_TITLE = ENTERPRISE_ESC_LOCAL_COPY.thirdPartySourceTitle
/** 页内说明句：这一面在干什么、以及【安装】到底做了什么（"复制"这件事必须说出来，见文件头那段）。 */
export const ENTERPRISE_THIRD_PARTY_NOTE = '这里列出本机其它 Agent CLI 技能库里的技能；安装会把技能复制进 DSH，源目录不动。'
/** 在途那一句（`role="status"`）。 */
export const ENTERPRISE_THIRD_PARTY_LOADING = '正在扫描本机的三方技能源…'
/**
 * ★**两句不同的「为什么空」**（口径 62 明令：不许合成一句）。
 *
 * 它们回答的是两个不同的问题，补救动作也不同：
 *   · `NO_SOURCE`：**这台机器上一枚三方技能源都没检测到** —— 员工该做的事是"先装一个别的 Agent CLI"，
 *     或者确认那几个 `~/.claude`、`~/.codex` 之类的目录确实存在（下一步完全不同）；
 *   · `NO_SKILL`：**检测到了技能源、但里面一枚技能都没有** —— 员工该做的事是"往那个库放技能"，
 *     或者确认那些目录里是不是少了 `SKILL.md`。
 * 合起来说成一句「暂无数据」就等于把这两种情况都糊掉了（本页第一版口径 31 正是被这条纪律否掉的）。
 */
export const ENTERPRISE_THIRD_PARTY_EMPTY_NO_SOURCE = '本机未检测到任何三方技能源。'
export const ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL = '检测到技能源，但里面没有技能。'
/** 根不存在（`present: false`）时那一句：**不是错误**，是这个位置本来就没有那个库。 */
export const ENTERPRISE_THIRD_PARTY_ROOT_ABSENT = '这个位置没有检测到技能源。'
/** 根在、但一枚候选都没有时那一句：与上面那句**刻意不同**（一个是位置不存在、一个是位置里没东西）。 */
export const ENTERPRISE_THIRD_PARTY_ROOT_EMPTY = '这个位置里没有技能。'
/**
 * 根在一枚技能都没有、但**整台机器上别处有**时那句（每组的空话）。
 *
 * 与 `ROOT_EMPTY` 分开是"零编造"的另一半：`ROOT_EMPTY` 说的是"这个位置里没有技能"，
 * 而这一句说的是"这个位置里没有技能**（别的源里有）**"——只有后者能解释"为什么整台机器不空、
 * 这一节却是空的"，否则员工会以为就这一枚源。
 * ★措辞不指方向（不写"上面/下面"）：这一句在**就绪态**（这一节夹在别的节之间）与**空态**
 *   （各节挨着铺）两处都出现，指方向的词在其中一处必然是错的。
 */
export const ENTERPRISE_THIRD_PARTY_ROOT_EMPTY_OTHERS = '这个位置里没有技能；其它来源里有。'
/** 未检测到的根在列表里照旧显示（口径 62：未检测到的根也可显示为"未检测到"）。 */
export const ENTERPRISE_THIRD_PARTY_ABSENT_TAG = '未检测到'
/**
 * 就绪态与空态那枚**重新扫描**钮（本机那几枚源是**外部可变**的：员工刚往 `~/.claude/skills`
 * 里放了一枚技能、或刚装了另一个 Agent CLI，这一面必须能重取）。
 *
 * ★为什么空态也要给这一枚：空态恰恰是最需要"再扫一次"的时候（刚把技能放进去）。失败态那枚是
 * 「重试」（`ENTERPRISE_LIST_RETRY`，四个列表共用），与它**刻意不同词**：一个说"再试一次那条
 * 失败的请求"，一个说"重新扫一遍本机"——两件事、两个词，不许共用一枚（否则读起来像是同一个动作）。
 */
export const ENTERPRISE_THIRD_PARTY_REFRESH = '重新扫描'
export const ENTERPRISE_THIRD_PARTY_REFRESH_LABEL = '重新扫描本机三方技能源'
/** 三态的中文（唯一映射：Host 的三态字面 → 员工可读的词，别处不许再翻一遍）。 */
export const ENTERPRISE_THIRD_PARTY_STATE_INSTALLED = '已安装'
export const ENTERPRISE_THIRD_PARTY_STATE_CONFLICT = '命名冲突'
export const ENTERPRISE_THIRD_PARTY_STATE_AVAILABLE = '可安装'
/**
 * 后两态**不画按钮**，故必须各自带一句可见原因（产品宪法：禁用即须有可见说明）。
 *
 * 与系统搜索那两句**刻意不同**：那一面「已装」说的是"这个目录已经在本机登记过、不用再纳入"，
 * 这一面说的是"**DSH 里已经有一枚同名技能**了，复制过去会覆盖它"。两件事的后果完全不同
 * （一个是重复登记、一个是覆盖数据），故不许共用一句话。
 */
export const ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE = 'DSH 里已经有一枚同名技能，不用再安装。'
export const ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE = '同名目录已被另一枚技能占用，复制过去会覆盖它。'
/** 行上那一句里「目录名」的标签（只在技能名与目录名不同时才出现，见行投影）。 */
export const ENTERPRISE_THIRD_PARTY_DIRECTORY_PREFIX = '目录名：'
/** 安装动作的三段可见文案：可点 / 在途 / 成功，以及失败提示的动作前缀。 */
export const ENTERPRISE_THIRD_PARTY_INSTALL = '安装'
export const ENTERPRISE_THIRD_PARTY_INSTALLING = '正在安装…'
export const ENTERPRISE_THIRD_PARTY_INSTALLED_NOTICE = '已安装'
export const ENTERPRISE_THIRD_PARTY_INSTALL_FAILED_PREFIX = '安装失败'
/**
 * ★**本刀（② 本地三方换成与广场同一张卡）**：那枚【＋】**可点**时的悬浮说明。
 *
 * ★为什么本刀才需要它：旧行版式那枚 `Button` 只有 `aria-label`（没有 `title`），而**广场那张卡**
 *   的 `EscCardInstall.title` 是**必填**（它在两种禁用档里承担"为什么按不动"的悬浮说明）。
 *   可点那一档必须给一句"会发生什么"，否则卡片会拿到一枚空串——那比不画还糟。
 * ★措辞与页内说明句（`ENTERPRISE_THIRD_PARTY_NOTE`）**同一条事实**：这一面说的就是"复制进来"，
 *   故这里逐字说"复制"，不写"下载"（这一条通路一份制品都不下载）。
 */
export const ENTERPRISE_THIRD_PARTY_INSTALL_TITLE = '把这枚技能复制进 DSH；源目录不动。'
/**
 * ★**一次一条在途**那条纪律的**可见原因**（写在正在安装那一行里）。
 *
 * 与系统搜索那句同判但另立一格：那里的动作叫「纳入」、这里叫「安装」，两句话里的动词必须与
 * 按钮上的词逐字相同 —— 否则员工读到的说明指的是另一个按钮。
 */
export const ENTERPRISE_THIRD_PARTY_BUSY_SUFFIX = '完成前不能安装别的技能。'
/**
 * 在途时**其余**每一枚安装按钮的可见原因（这些按钮会 `disabled`，故必须各有一句可见说明）。
 *
 * ★它**不是** `BUSY_SUFFIX` 的复制：那一句写在"正在安装「X」…"那一行里（说的是"为什么别的按钮
 *   这会儿不能点"），而这一句写在**被禁用的那一枚按钮自己**的位置上（说的是"不是这一条有问题，
 *   是另一条正在装"）。产品宪法要的是后者：一枚禁用的控件旁边必须能读出它为什么按不动。
 */
export const ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY = '另一枚技能正在安装，稍后再试。'
/**
 * 写入口**整条缺席**时那枚按钮的可见原因（纯函数直调 / 宿主那半边没接线）。
 *
 * 判据是**端口在不在场**，不是写死的 `disabled`（本仓既有那几枚按钮同一条纪律）。
 */
export const ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED = '这台机器还没有接上三方技能源的安装接口。'

/* ══════════════ 四态投影 ══════════════ */

/** 一条候选在结果面上的**全部呈现事实**（唯一投影：界面不许再自己拼标题或状态词）。 */
export interface EnterpriseThirdPartySkillRow {
  /** ★回传给宿主的那枚**不透明值**（上次响应里原样给来的 `id`；界面从不拼、从不改）。 */
  readonly id: string
  /** 技能名（frontmatter 的 `name`）。 */
  readonly name: string
  /** 描述**首行**（口径 62 明令只显示首行）：读不到就**没有这一行**（不是空串、不是占位句）。 */
  readonly description?: string | undefined
  /** 来源的人话根名（与分组头同一个取值口：`sourceName`）。 */
  readonly sourceName: string
  /** 目录名（与 `name` 可能不同：frontmatter 改过名的那一枚）。 */
  readonly directory: string
  readonly status: EnterpriseThirdPartySkill['status']
  /** 三态中文。 */
  readonly statusLabel: string
  /** 状态为非可安装时的**可见原因**（可安装时缺席）。 */
  readonly statusNote?: string | undefined
  /** 行上那一句可见 note（恒有）：只在技能名不是目录名时带「目录名：X · 」，后面接状态与原因。 */
  readonly note: string
  /** 能不能点那枚【安装】（只有 `available` 为真；另两态**不画**按钮）。 */
  readonly installable: boolean
}

/**
 * 描述取**首行**（口径 62 逐字要求"描述首行"）。
 *
 * 为什么在**投影**里切而不是在渲染时 `slice`：切法只有一处，锁就只需要盯一处；而且"首行"这个
 * 口径将来若要改（比如改成前 80 字），改一处即可，界面不会残留第二套切法。
 * 只有真的含换行时才切；**不 trim**（前导空格是作者的原意，原样保留），空行在前导时切出空串
 * ——那时归一成"没有描述"（与"缺席"同形，不画一个空行）。
 */
export function enterpriseThirdPartyDescriptionFirstLine(description: string | undefined): string | undefined {
  if (description === undefined) return undefined
  const first = description.split(/\r?\n/, 1)[0] ?? ''
  return first.trim() === '' ? undefined : first
}

/**
 * 一条候选 → 行投影（唯一判定点）。
 *
 * ★ 为什么「已安装 / 命名冲突」**不画按钮**而不是画一枚禁用的：这两种状态下**没有任何**能做的动作
 *   （可做的是「别的技能」），画一枚灰按钮等于给一个不存在的动作留位置。故按既有口径「能走的路才画」，
 *   并在行上写清**为什么这条没有动作**——这正是"不许死控件"在每行上的落点。
 */
export function enterpriseThirdPartySkillRow(skill: EnterpriseThirdPartySkill): EnterpriseThirdPartySkillRow {
  const statusLabel = skill.status === 'installed'
    ? ENTERPRISE_THIRD_PARTY_STATE_INSTALLED
    : skill.status === 'conflict'
      ? ENTERPRISE_THIRD_PARTY_STATE_CONFLICT
      : ENTERPRISE_THIRD_PARTY_STATE_AVAILABLE
  const statusNote = skill.status === 'installed'
    ? ENTERPRISE_THIRD_PARTY_INSTALLED_NOTE
    : skill.status === 'conflict'
      ? ENTERPRISE_THIRD_PARTY_CONFLICT_NOTE
      : undefined
  // 技能名就是目录名时不再重复一遍（「目录名：x」只补在两者不同的情形）。
  const directory = skill.name === skill.directory ? '' : `${ENTERPRISE_THIRD_PARTY_DIRECTORY_PREFIX}${skill.directory} · `
  const note = `${directory}${statusLabel}${statusNote === undefined ? '' : `：${statusNote}`}`
  const description = enterpriseThirdPartyDescriptionFirstLine(skill.description)
  return {
    id: skill.id,
    name: skill.name,
    ...(description === undefined ? {} : { description }),
    sourceName: skill.sourceName,
    directory: skill.directory,
    status: skill.status,
    statusLabel,
    ...(statusNote === undefined ? {} : { statusNote }),
    note,
    installable: skill.status === 'available',
  }
}

/** 结果面上的一个根分组（根 + 它的候选 + 该根为空时那句人话）。 */
export interface EnterpriseThirdPartyRootGroup {
  readonly root: EnterpriseThirdPartyRoot
  /** 人话根名（`root.name` 原样；缺人话名时退到 `id`，见 `enterpriseThirdPartyRootLabel`）。 */
  readonly label: string
  /** 这个根**没被检测到**（`present === false`）：节头右边会写明「未检测到」。 */
  readonly absent: boolean
  /** 这个根下的候选（保持 Host 给的顺序，不重排）。 */
  readonly skills: readonly EnterpriseThirdPartySkill[]
  /** 这个根没有候选时那句人话（区分「位置不存在」「位置里没东西」「这一节空但别处有」三种）。 */
  readonly emptyNote?: string | undefined
}

/** 一个人话根名：`name` 非空就用它，否则退到 `id`（不编名字、也不留空白）。 */
export function enterpriseThirdPartyRootLabel(root: EnterpriseThirdPartyRoot): string {
  return root.name.trim() === '' ? root.id : root.name
}

/**
 * ★**口径 62（用户修正：二级 chip 行数据驱动）**：由扫描响应的**根表**投影出这一维度的 chip 行。
 *
 * 三条判据，逐条都有理由（不是"顺手滤一下"）：
 *  ① **`count === 0` 的根不出 chip**：本机真实的根表里绝大多数是 0 枚（`~/.codex`、`~/.qoder`…），
 *     全铺出来 chip 行会爆成几十枚，而"哪些源里真的有东西"才是员工要选的东西。
 *  ② **`aliasOf` 的根不出 chip**：本机真实形态里 `~/.qwen/skills`、`~/.junie/skills`… 40+ 个都是
 *     **指向 `~/.agents/skills` 的符号链接**（同一份库）⇒ 不过滤的话同一批技能会出现几十枚 chip，
 *     点哪一枚看到的东西都一样。它们**照旧留在 `roots` 里**（分组与"已检测到 N 个源"那句要用）。
 *  ③ **`present === false` 的根不出 chip**（它必然 `count: 0`，是被 ① 顺带覆盖的那一支；
 *     这里显式写出来是为了让"未检测到的位置不当筛选项"这条意图可读）。
 *
 * ★**文案与 key 都取自响应**（`name` / `id`）：界面**不消费后端目录那套静态分类**，也**不写死任何
 *   清单**——宿主加一枚根、改一个名字，这一行自动跟着变。
 * ★**谁有技能**由 `skills` 里真的有条目的根决定（而不是信 `count`）：`count` 在解码层已被钉成与
 *   条数逐字相等，两者同真；这里用 `skills` 是因为它是**渲染真源**（列表就是它铺出来的）。
 *
 * @param value - 一次扫描的真响应。
 * @returns chip 行数据（**不含**「全部」——那一枚由 `esc-sub-tabs.ts` 统一加，两处不可能漂）。
 */
export function enterpriseThirdPartySubChips(
  value: EnterpriseThirdPartySkills,
): readonly { readonly key: string; readonly label: string }[] {
  const withSkills = new Set(value.skills.map(skill => skill.rootId))
  return value.roots
    .filter(root => root.present && root.aliasOf === undefined && withSkills.has(root.id))
    .map(root => ({ key: root.id, label: enterpriseThirdPartyRootLabel(root) }))
}

/**
 * ★**口径 62**：这一维度"检测到几个源、其中几个有技能"那一句（页面在别处说明用）。
 *
 * 为什么需要它：0 枚的根与别名根**不进 chip 行**（见上一条的三条判据），于是员工看不到它们——
 * 若不给出一个总数，那些"本机确实存在但一枚技能都没有"的位置就**没有任何交代**了。
 * 这正是"零编造"的另一面：**该说的缺口要主动说出来**，而不是让人以为本机就那几枚源。
 *
 * ★三个数都**不数别名**（连 `skipped` 也只算非别名的根）：别名根（`aliasOf`，40+ 个指向 `~/.agents/skills` 的符号链接）是**同一个库**，
 *   把它们算成"11 个源里有 10 个有技能"是**替同一份东西报十次**——那正是本仓不许的编造。
 *   故这里与 chip 行同一把尺子：`present`（检测到）且**不是别名**。
 *
 * @param value - 一次扫描的真响应。
 * @returns 人话一句（如「已检测到 11 个技能源，其中 3 个有技能。」）。
 */
export function enterpriseThirdPartySourceSummary(value: EnterpriseThirdPartySkills): string {
  const real = value.roots.filter(root => root.present && root.aliasOf === undefined)
  const withSkills = new Set(value.skills.map(skill => skill.rootId))
  const nonEmpty = real.filter(root => withSkills.has(root.id)).length
  /**
   * ★**被跳过的目录数**（口径 62 用户决定）：各根 `skipped` 之和。
   *   本仓纪律是**丢弃不许静默**（本机实测 796 枚里 26 枚过不了我们自己的闸门）
   *   —— 不说就是把那 26 枚当成不存在。
   *   ★只数**非别名的根**：别名根与被指向的那枚是**同一份库**，算进去就是替同一份东西报十次。
   *   ★**K === 0 时整句不出**（不写“另有 0 个”）—— 一句没信息量的话只会让真有缺口的那句失去分量。
   */
  const skipped = real.reduce((sum, root) => sum + root.skipped, 0)
  const tail = skipped === 0 ? '' : `，另有 ${skipped} 个目录不符合技能规范`
  return `已检测到 ${real.length} 个技能源，其中 ${nonEmpty} 个有技能${tail}。`
}

/** 一个根下的候选计数（0 说「没有技能」，不说「0 枚」）。 */
export function enterpriseThirdPartyCountText(count: number): string {
  return count === 0 ? '没有技能' : `${count} 枚技能`
}

/**
 * 按根分组（顺序 = Host 给的根顺序；每组内保持候选原序）。
 *
 * ★**未检测到的根照样成组**（口径 62：未检测到的根也可显示为"未检测到"）——不把它们滤掉，
 *   否则员工根本不知道"这台机器上本该有哪些源"。
 * ★解码层已保证「每条候选的 `rootId` 必在 `roots` 里」（且每根的 `count` 与条数逐字相等），
 *   故这里不存在「无家可归的候选」这种分支。
 * ★三种空话的判据只有一条：**这个根在不在** + **整台机器上有没有别的候选**。
 */
export function enterpriseThirdPartyRootGroups(
  value: EnterpriseThirdPartySkills,
): readonly EnterpriseThirdPartyRootGroup[] {
  const anySkill = value.skills.length > 0
  return value.roots.map((root) => {
    const skills = value.skills.filter(skill => skill.rootId === root.id)
    const label = enterpriseThirdPartyRootLabel(root)
    if (skills.length > 0) return { root, label, absent: !root.present, skills }
    return {
      root,
      label,
      absent: !root.present,
      skills,
      emptyNote: !root.present
        ? ENTERPRISE_THIRD_PARTY_ROOT_ABSENT
        : anySkill ? ENTERPRISE_THIRD_PARTY_ROOT_EMPTY_OTHERS : ENTERPRISE_THIRD_PARTY_ROOT_EMPTY,
    }
  })
}

/** 结果面的**唯一状态投影**（四态 → 页面该画什么；同一时刻只可能命中一档）。 */
export interface EnterpriseThirdPartyFace {
  readonly kind: 'loading' | 'failed' | 'empty' | 'ready'
  /** 失败态那枚稳定码（人话与下一步由唯一映射给）。 */
  readonly failedCode?: string | undefined
  /** 按根分组（loading / failed 时为空数组——那两态下还没有任何**可信**真值可铺）。 */
  readonly groups: readonly EnterpriseThirdPartyRootGroup[]
  /** 空态那一句「为什么空」（有候选时缺席）——两句不同的话由 `noSource` 选（见那两枚常量）。 */
  readonly emptyNote?: string | undefined
  /** 空态到底空在哪（`true` = 一枚源都没检测到；`false` = 检测到了、但里面没技能）。 */
  readonly noSource?: boolean | undefined
}

/**
 * 四态 → 结果面（纯函数，唯一判定点）。
 *
 * ★**四态互斥**由 `EnterpriseListState` 的单字段联合保证，本函数只是把它翻译成页面语言；
 *   故**不可能**出现"空又不加载又无错误"那种空白态（那正是本仓 `list-state.ts` 头注里被否掉的形态）。
 * ★**失败态绝不回落空列表**：`failed` 分支返回的 `groups` 恒是空数组、且**不带** `emptyNote`
 *   —— 扫描读不到时画一句"没有检测到技能源"就是**撒谎**（口径 62 明令：失败时不许显示空列表）。
 * ★**空态也有真值**（`state.value` 里那些根）：两句空话的判据是"**有没有任何 present 的根**"，
 *   而不是"列表长不长"——它们回答的是两个不同的问题（一台机器上有没有源 vs 那些源里有没有东西）。
 *
 * @param state - 扫描取数的四态（`list-state` 的唯一状态机）。
 * @returns 页面所需的全部事实（loading / failed+码 / empty+那句为什么空 / ready+分组）。
 */
export function enterpriseThirdPartyFace(
  state: EnterpriseListState<EnterpriseThirdPartySkills>,
): EnterpriseThirdPartyFace {
  if (state.kind === 'loading') return { kind: 'loading', groups: [] }
  if (state.kind === 'failed') return { kind: 'failed', failedCode: state.code, groups: [] }
  const groups = enterpriseThirdPartyRootGroups(state.value)
  if (state.kind === 'ready') return { kind: 'ready', groups }
  // `empty`：取数成功、但那台机器上一枚候选都没有 ⇒ 必须说清是哪一种"空"。
  const noSource = !state.value.roots.some(root => root.present)
  return {
    kind: 'empty',
    groups,
    noSource,
    emptyNote: noSource ? ENTERPRISE_THIRD_PARTY_EMPTY_NO_SOURCE : ENTERPRISE_THIRD_PARTY_EMPTY_NO_SKILL,
  }
}

/* ══════════════ 安装动作的按钮终态（一次一条的可见面）══════════════ */

/** 那一枚【安装】当前处在哪一档（四档互斥，各有自己的可见文案）。 */
export type EnterpriseThirdPartyActionKind =
  /** 这一行的技能正在装（按钮文案变「正在安装…」、禁用）。 */
  | 'this-busy'
  /** 别的行正在装（按钮禁用 + **行上可见原因**，不是只挂 title）。 */
  | 'blocked'
  /** 这一次真的可以点。 */
  | 'install'
  /** 写入口整条缺席（本部署还没接上这条接口）；按钮禁用 + 可见原因。 */
  | 'not-ported'

/** 一枚安装按钮的**终态**（渲染层唯一的输入：文案 / 能不能点 / 为什么不能点 / 无障碍名）。 */
export interface EnterpriseThirdPartyActionPlan {
  readonly kind: EnterpriseThirdPartyActionKind
  /** 按钮上的可见文案。 */
  readonly text: string
  readonly disabled: boolean
  /** 禁用时的**可见原因**（可点时缺席）——产品宪法：禁用控件不许只挂一句 `title`。 */
  readonly reason?: string | undefined
  /** 无障碍名（读屏听到的是「安装 X」/「正在安装 X」）。 */
  readonly ariaLabel: string
}

/**
 * 一枚安装按钮的终态（唯一判定点）。
 *
 * 判据只有三件事实：**这一行是不是在途那一行**、**有没有别的行在途**、**端口在不在场**。
 * 优先级刻意定成"在途 > 其余在途 > 端口"：正在装的那一行才是当下最要紧的事实，
 * 它的文案必须说"正在安装"，而不是被一句"另一枚正在安装"顶掉（那会让员工找不到自己的那一条）。
 *
 * @param input - 端口在不在场、这一行的 id 与名字、在途的那一条。
 * @returns 按钮终态（文案 + 可点性 + 可见原因 + 无障碍名）。
 */
export function enterpriseThirdPartyActionPlan(input: {
  readonly wired: boolean
  readonly id: string
  readonly name: string
  readonly busy?: { readonly id: string; readonly title: string } | undefined
}): EnterpriseThirdPartyActionPlan {
  const ariaLabel = `${ENTERPRISE_THIRD_PARTY_INSTALL}${input.name}`
  if (input.busy !== undefined && input.busy.id === input.id) {
    return { kind: 'this-busy', text: ENTERPRISE_THIRD_PARTY_INSTALLING, disabled: true, ariaLabel }
  }
  if (input.busy !== undefined) {
    return {
      kind: 'blocked',
      text: ENTERPRISE_THIRD_PARTY_INSTALL,
      disabled: true,
      reason: ENTERPRISE_THIRD_PARTY_BLOCKED_BY_BUSY,
      ariaLabel,
    }
  }
  if (!input.wired) {
    return {
      kind: 'not-ported',
      text: ENTERPRISE_THIRD_PARTY_INSTALL,
      disabled: true,
      reason: ENTERPRISE_THIRD_PARTY_INSTALL_NOT_PORTED,
      ariaLabel,
    }
  }
  return { kind: 'install', text: ENTERPRISE_THIRD_PARTY_INSTALL, disabled: false, ariaLabel }
}

/** 正在安装某一条那行 `role="status"` 里那一整句（说清正在装谁 + 为什么别的按钮这会儿不能点）。 */
export function enterpriseThirdPartyInstallingText(name: string): string {
  return `正在${ENTERPRISE_THIRD_PARTY_INSTALL}「${name}」…${ENTERPRISE_THIRD_PARTY_BUSY_SUFFIX}`
}

/** 装好一条那一行 `role="status"` 里那一整句（说清刚刚装了谁）。 */
export function enterpriseThirdPartyInstalledText(name: string): string {
  return `已${ENTERPRISE_THIRD_PARTY_INSTALL}「${name}」。`
}

/* ══════════════ 与广场**同一张卡**（本刀 ②）：两枚纯投影 ══════════════ */

/**
 * ★**本刀（② 本地三方换成与广场同一张卡 + 同一骨架）之一**：一条三方候选 → 那张卡的 `item`。
 *
 * ★**为什么需要这一枚**：广场那张卡吃的是归一化后的 `ResourceItem`，而三方候选是另一族的形状
 *   （`EnterpriseThirdPartySkill`：`id` / `name` / `rootId` / `sourceName` / `directory` / `status`）。
 *   改前这一面**自己手写行版式**（`.esc-third-party-row*` 那一套），故不需要这一步；本刀要求它
 *   与广场**逐字同构**（`.esc-list-section > .esc-catalog-cell > 同一张卡`），就必须先把候选归一成
 *   卡片认识的那一格 —— 这一步是**纯投影**（可直调取证），不是"在渲染里顺手拼"。
 *
 * ★**只映射卡片真的会读的三件**（`id` / `name` / `description`）：
 *   · `id` —— `key` 与那枚 `data-enterprise-third-party-skill` 钩子的取值口（**不透明值原样用**，
 *     界面一个字节都不加工，见文件头"界面里没有一处能拼路径"那段）；
 *   · `name` —— 卡片标题；
 *   · `description` —— **首行**（`enterpriseThirdPartySkillRow` 已经切过；缺席即整行不出）。
 * ★**来源根名与状态词不进卡片**：它们由**分组标题 / 根汇总 / 那枚【＋】的禁用原因**承担
 *   （本刀 ② 明令保留的那几件），在卡片上再铺一遍就是同一件事说两处。
 */
export function enterpriseThirdPartyCardItem(row: EnterpriseThirdPartySkillRow): ResourceItem {
  return {
    id: row.id,
    name: row.name,
    ...(row.description === undefined ? {} : { description: row.description }),
  }
}

/**
 * ★**本刀（②）之二**：那枚【＋】的终态 —— 把**既有**的 `enterpriseThirdPartyActionPlan`
 *   （纯投影，**一个字不改**）**纯适配**成卡片认识的 `EscCardInstall` 形态。
 *
 * ★**为什么必须走适配器、而不是让卡片认识我们的计划**：`esc-card.tsx` 是本页最底那层展示件，
 *   它**不认识任何数据形状**（`EscCardInstall` 的说明写着这条）。适配只能发生在我们这一侧：
 *   一枚纯函数，输入是"既有计划 + 这一条 + 写入口"，输出是卡片要的那七格。
 *
 * ★**两档的形态与理由**：
 *   · `available`（`row.installable`）⇒ 调**既有**那枚四档计划（可点 / 本枚在途 / 被别的在途挡住 /
 *     端口缺席），逐档映成 `EscCardInstall`：`busy` 由计划**显式**给（口径 53：不许从 `disabled` 推，
 *     否则"端口缺席"也会冒出「安装中…」那句假话）；`reason` 原样带上 ⇒ 卡片把它画成**行上可见**
 *     的原因（`.esc-card-lock`，与广场那几档同一条落点）；**可点那一档才挂 `onInstall`**
 *     （禁用即无写入口，这是结构事实，不是"挂一枚不会被调的回调"）。
 *   · `installed` / `conflict` ⇒ **不调计划**（那枚计划只回答"这一枚能不能按"，而这两态问的是
 *     "这一条根本没有能做的动作"）——直接给一枚**禁用**的【＋】并把 `row.note`
 *     （＝`状态：原因`，含「已安装 / 命名冲突」那两个词与"目录名"那句）当**行上可见原因**。
 *     ★这与改前"另两态**不画**按钮"**形态不同、交代相同**：改前是"整枚按钮不出现 + 行上一句 note"，
 *       本刀是"按钮恒在（卡片版式的一部分）+ 禁用 + 同一句 note 行上可见"——产品宪法要的
 *       "禁用必须能读出为什么"在**两种形态下都成立**，而卡片的版式要求【＋】恒在（规格 §1③/§2）。
 *
 * @param input - 这一条的行投影、写入口在不在场、在途的那一条、以及点它干什么。
 * @returns 卡片那枚【＋】的终态（七格，逐档互斥）。
 */
export function enterpriseThirdPartyCardInstall(input: {
  readonly row: EnterpriseThirdPartySkillRow
  readonly wired: boolean
  readonly busy?: { readonly id: string; readonly title: string } | undefined
  readonly onInstall: () => void
}): EscCardInstall {
  if (!input.row.installable) {
    return {
      text: ENTERPRISE_THIRD_PARTY_INSTALL,
      disabled: true,
      title: input.row.note,
      ariaLabel: `${ENTERPRISE_THIRD_PARTY_INSTALL}${input.row.name}`,
      reason: input.row.note,
    }
  }
  const plan = enterpriseThirdPartyActionPlan({
    wired: input.wired,
    id: input.row.id,
    name: input.row.name,
    ...(input.busy === undefined ? {} : { busy: input.busy }),
  })
  return {
    text: plan.text,
    disabled: plan.disabled,
    busy: plan.kind === 'this-busy',
    title: plan.reason ?? ENTERPRISE_THIRD_PARTY_INSTALL_TITLE,
    ariaLabel: plan.ariaLabel,
    ...(plan.reason === undefined ? {} : { reason: plan.reason }),
    ...(plan.disabled ? {} : { onInstall: input.onInstall }),
  }
}
