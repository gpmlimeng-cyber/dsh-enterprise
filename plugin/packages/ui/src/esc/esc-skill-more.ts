/**
 * [INPUT]: 只依赖 `esc-more-menu.tsx` 的 `EscCardMore`/`SkillMoreEntry`（**类型**导入）与
 *   `skill-api-decode.ts` 的自装记录类型（**类型**导入），以及 `esc-system.ts` 那条既有的
 *   "自装记录 → 已装名字并集"投影（**复用**，见下面那条说明）；不依赖 React、不依赖官方原语、
 *   不发请求、不认识任何路由
 * [OUTPUT]: 对外提供技能卡「更多」下拉里那几枚**本机/本会话动作**的唯一事实层——可见文案（二次确认三句 /
 *   在途一张**按动作全量**的表 / 失败前缀同构的表 / 两句成功交代）、一次动作的**超时**、
 *   **可用性判据的唯一实现** `enterpriseEscSelfInstalledNames`（`names[]` 并集）与唯一计划投影
 *   `enterpriseEscSkillMorePlan`
 * [POS]: dsh-ui 技能页「更多」下拉（`esc-more-menu.tsx` 是它的呈现层）的**唯一判定与文案真源**：
 *   页面只画、聚合层只接线。冻结契约（宿主侧 `bundle/src/skill-self-installed-route.ts` +
 *   `skill-self-installed.ts`）：`POST …/local/skills/self-installed/{uninstall,reveal,edit}`，
 *   正文关闭键集恰好 `{name}`。
 *
 *   ★**本刀（用户冻结规格 §3：「…」菜单四行）**：计划从"两行"扩到**四行**（`去对话` / `编辑` /
 *     打开文件夹 / 卸载），三件事各归各的：
 *     ① **`去对话` 与卡片那枚「去试试」是同一个动作** ⇒ 那一行由**同一枚**「去试试」计划整份带下来
 *        （`gotoChat` 那一格）：可点性取它的 `disabled`、动作取它的 `onTry` —— 本文件那一行**自己没有实现**；
 *        它的在途与失败也**不**走本文件那两张表（同一件事只说一遍，由「去试试」那一枚计划上屏）；
 *     ② **`编辑`**（用系统默认应用打开 `SKILL.md`）：★**本刀（A2.1）起路由与端口都在场**，故那一格
 *        真的进计划、**画在第二格**；而它当初的 fail-closed 形状**一字未改**（判据始终是"端口在不在场"：
 *        路由未落地/界面未接线那两天，`wired.edit` 与 `onEdit` 同时缺席 ⇒ `escCardMoreRows` 整行丢掉，
 *        它那两句文案也一直备在表里——这正是"接线那天不用补文案"的落点）；
 *     ③ `wired` 扩成**三格**（`edit`/`uninstall`/`reveal` —— `gotoChat` 不在这里，见 ①）——判据仍是
 *        「端口在不在场」，缺席的行**不画**（不是画成禁用：官方 `MenuItem` 没有 `title` 位，说不出为什么按不动）。
 *
 *   ★**可用性判据只有一条**：`name` 出现在 `GET /skills/self-installed` 某条记录的 `names[]` 里
 *     （`names[]` 是**真正的落盘目录名**）。**不许猜、不许按 `displayName` 猜、不许认 `skillId`** ——
 *     后者跨四条安装通路的语义并不统一（本地上传是 `manifest.id`、广场/skillhub 那批是技能名或 slug），
 *     拿它当键必然错配（`skill-self-installed.ts` 头注逐字写着这条）。
 *   ★**归属的权威在宿主**：被中心 `installed.json` 认领 ⇒ 404 `ENT_RESOURCE_NOT_FOUND`、两条自装记录
 *     都认领 ⇒ 409 `ENT_SKILL_NAME_CONFLICT`（fail-closed，零删除）。界面**不写第二套判据**，
 *     只按宿主回的稳定码出人话 ⇒ 于是"命中 `names[]` 但宿主仍拒"这一种边缘会**如实失败一次**
 *     （那是宿主的判决，不是界面的猜测）。
 *   ★**零编造**：本文件不产生任何技能名、目录名或"装没装"的判定——名字来自 Host 回传的记录与卡片本身，
 *     界面从不乐观改本地（成功只认 Host 那一次回执）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import type { EscCardMore, SkillMoreEntry } from './esc-more-menu.js'
import { enterpriseEscPlanTable } from './esc-plan-table.js'
import type { EnterpriseEscSkillTryPlan } from './esc-skill-try.js'
import { enterpriseEscSystemInstalledNames } from './esc-system.js'

/**
 * 两枚动作的 id（**与 `esc-more-menu.tsx` 那几行同域**：`SkillMoreEntry['id']` 是唯一真源，
 * 这里只给它一个本域的名字，改行名时编译期就会红）。
 *
 * ★**本刀（用户冻结规格 §3）**：`goto-chat`（「去对话」）**刻意排除在外**——它与卡片上那枚
 *   「去试试」是**同一个动作**（新会话 + 填好草稿、**绝不自动发送**）⇒ 它的在途与失败由**那一枚计划**
 *   （`esc-skill-try.ts` 的 `enterpriseEscSkillTryPlan`）承载：同一时刻、同一件事**只说一遍**
 *   （两处各写一份，卡片上就会冒出两行一模一样的字）。故本文件这套 `pending` / `failure` 只管
 *   **本菜单自己**那几枚动作；`goto-chat` 那一行的**可点性**与**动作**都取自**同一枚**「去试试」计划
 *   （`gotoChat` 那一格，见计划投影）。
 */
export type EnterpriseEscSkillMoreAction = Exclude<SkillMoreEntry['id'], 'goto-chat'>

/** 在途的那一次动作（`name` = 技能目录名；同一枚技能上不并存两个动作）。 */
export interface EnterpriseEscSkillMorePending {
  readonly name: string
  readonly action: EnterpriseEscSkillMoreAction
}

/** 失败的那一次动作（`name` + 稳定码 + 是哪一枚动作失败的）。 */
export interface EnterpriseEscSkillMoreFailure {
  readonly name: string
  readonly action: EnterpriseEscSkillMoreAction
  readonly code: string
}
/* ────────────────────────── 一、可见文案（唯一一份） ────────────────────────── */

/**
 * 二次确认的**标题**（说清这是一次本机动作，不是平台动作）。
 */
export const ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM_TITLE = '卸载这枚本机自装技能'
/**
 * 二次确认的**影响句**（破坏性动作必须说清影响）。
 *
 * 两个半句缺一不可：① 本机会发生什么（这份技能目录被删掉、本机不再加载它）；
 * ② 哪里**不会**受影响（平台与企业中心那边的东西照旧）——员工要据此判断"我是不是在删平台上的东西"，
 * 而那正是最容易误判的一点。措辞与插件卸载那枚 `ENTERPRISE_PLUGIN_UNINSTALL_IMPACT` **刻意不共用**
 * （那是受管插件、会动本机运行与已装状态；这一枚只删本机一份技能目录）。
 */
export const ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT =
  '卸载会删掉本机这份技能目录（本机不再加载它）；平台与企业中心那边的东西不受影响，以后可以重新安装。'
/** 确认框里那枚红色按钮上的字（与插件卸载**刻意同词**：同一种不可逆动作）。 */
export const ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM = '确认卸载'
/**
 * 卸载在途那三个字（`role="status"`，按既有 `.esc-card-lock` 落点**行上可见**）。
 *
 * ★与安装那三枚（`安装中…`）**刻意同词根**：同一件事（本机这一份正在变），没有理由长出第二种说法。
 */
export const ENTERPRISE_ESC_MORE_UNINSTALLING = '卸载中…'
/**
 * 打开文件夹在途那一句（同样行上可见：那是一次**异步动作**，界面必须说它正在做）。
 *
 * ★非破坏性、无确认，但**不等于不需要交代**：系统文件管理器这一跳可能要一两秒，
 * 静默期间用户只会以为"点了没反应"。
 */
export const ENTERPRISE_ESC_MORE_REVEALING = '正在打开所在文件夹…'
/**
 * **编辑**在途那一句（`role="status"`，同样行上可见）。
 *
 * ★**今天画不到**（「编辑」那一行在端口缺席时**整行不画**，见 `esc-more-menu.tsx` 的文件头）；
 *   它在这里的理由只有一条：`busyText` 与失败前缀那两张表是**按动作全量**的（`edit` 是本菜单自己的
 *   动作之一）——少一格就是"那条路由落地那天，在途/失败没有话说"，而那正是本仓最不肯留的口子。
 */
export const ENTERPRISE_ESC_MORE_EDITING = '正在用系统默认应用打开这枚技能的文件…'
/** 卸载失败提示的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射按稳定码给）。 */
export const ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX = '卸载失败'
/** 打开文件夹失败提示的动作前缀（同上）。 */
export const ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX = '打开文件夹失败'
/** 编辑失败提示的动作前缀（同上；今天同样画不到，理由见 `ENTERPRISE_ESC_MORE_EDITING`）。 */
export const ENTERPRISE_ESC_MORE_EDIT_FAILED_PREFIX = '编辑失败'
/**
 * 在途交代的**唯一取值口**（按动作取；`goto-chat` 不在表里 —— 它由「去试试」那一枚计划说）。
 *
 * ★为什么做成一张表而不是一串三元：四行之后"哪一行在途说什么"必须**逐行可查**，
 *   而三元链漏一行在类型上不会红（表是全量的，`EnterpriseEscSkillMoreAction` 增一枚就必须补一格）。
 */
export const ENTERPRISE_ESC_MORE_BUSY_TEXT: Readonly<Record<EnterpriseEscSkillMoreAction, string>> = {
  edit: ENTERPRISE_ESC_MORE_EDITING,
  'open-folder': ENTERPRISE_ESC_MORE_REVEALING,
  uninstall: ENTERPRISE_ESC_MORE_UNINSTALLING,
}
/**
 * 失败前缀的**唯一取值口**（按动作取）。
 *
 * ★`edit` 那一格与上面同一条理由（表是全量的）；它不会与别的动作混用——一个动作一句话。
 */
export const ENTERPRISE_ESC_MORE_FAILED_PREFIX: Readonly<Record<EnterpriseEscSkillMoreAction, string>> = {
  edit: ENTERPRISE_ESC_MORE_EDIT_FAILED_PREFIX,
  'open-folder': ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX,
  uninstall: ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX,
}
/**
 * 一次本机动作的**超时**（30s）。
 *
 * 两条都不是"下载 + 校验 + 解包"那种量级：卸载是一次 `rename` + 一次原子写记录 + 一次有界递归删除，
 * 打开文件夹是一次 `execFile`。故它比安装那三处（120s）**短**——不是为了"更严格"，
 * 而是超时口径该与这件事的真实量级相称（装一个包等两分钟是对的，删一个目录等两分钟则说明出事了）。
 */
export const ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS = 30_000

/* ────────────────────────── 二、可用性判据（唯一实现） ────────────────────────── */

/**
 * 自装记录 → **已装名字集合**（`names[]` 的并集）——**可用性判据的唯一实现**。
 *
 * ★**为什么复用 `esc-system.ts` 那一枚**：它就是把自装记录折成名字并集的**同一份**投影
 * （`enterpriseEscSystemInstalledNames`，为广场安装回执而写）。在这里再抄一遍 `for … record.names`
 * 就是第二处"哪些名字算数"的判据，两处迟早会在"去重 / 保序 / 只认 `names`"这些细节上漂。
 * 本刀只把它包成 `Set`（判据要的是成员关系，不是顺序）。
 *
 * ★**只认 `names[]`**：`displayName`（人类可读名）与 `skillId`（跨通路语义不统一）在这条判据里
 *   一个都不参与——按它们猜会把这些技能错判成"本机自装的、可以卸"。
 *
 * @param records - `GET /skills/self-installed` 的投影（读不到时是空数组 ⇒ 一枚动作都不给，见计划投影）。
 * @returns 真正落盘的技能目录名集合。
 */
export function enterpriseEscSelfInstalledNames(
  records: readonly EnterpriseSelfInstalledSkill[],
): ReadonlySet<string> {
  return new Set(enterpriseEscSystemInstalledNames(records))
}

/* ────────────────────────── 三、计划投影（唯一入口） ────────────────────────── */

/**
 * 一枚技能卡上的「更多」计划（**唯一判定点**）。
 *
 * 四档事实各归各的：
 *   · **归属**（这一枚是不是本机自装的）—— `selfInstalledNames` 里有没有 `name`；没有 ⇒ 返回
 *     `undefined` ⇒ 卡片**连 `⋯` 都不画**（"已装但不是自装"那一批：中心装下来的、官方内置的，
 *     这一条路由管不着它们，画一枚就是在暗示能卸）；
 *   · **端口**（本部署接没接上这两条路由）—— `wired`；两枚都没接 ⇒ 同样返回 `undefined`
 *     （判据是"端口在不在场"，不是写死的 disabled；与全仓那几枚按钮同一条纪律）；
 *   · **在途**（同一枚技能上不并存两个动作）—— `pending` 命中这一枚时**两行都禁用**，
 *     并把在途那句（`busyText`）交给卡片**行上可见**地说出来；
 *   · **失败**（只落在**失败的那一行**上）—— `failure` 命中这一枚时把唯一提示件要的两件
 *     （稳定码 + 动作前缀）交给卡片；失败**不翻任何本地状态**。
 *
 * ★**成功不在这里**：成功之后要写回什么（`skills` 覆盖 + 计数刷新）由调用方按 Host 回执做——
 *   本文件是纯函数，一个字节的本地状态都不改（也就没有"乐观切换"可写）。
 *
 * @param input - 已建好的自装名字集合、这一枚的名字、端口在不在场、在途与失败、两枚真写入口。
 * @returns 卡片那枚「更多」的计划；`undefined` = 这一枚**不画**（不是画成禁用）。
 */
export function enterpriseEscSkillMorePlan(input: {
  /**
   * 自装记录折成的**已装名字集合**（唯一实现 `enterpriseEscSelfInstalledNames` 的产物；
   * 读不到时是空集合 —— 那时一枚动作都不给）。
   *
   * ★**本刀（技能页性能）：入参由"记录数组"改成"已建好的集合"**——这一格就是那次改动的全部：
   *   · 旧形态是本函数**每次调用**都 `new Set(...)` 折一遍记录：610 张卡 = 610 次（且每次渲染都重来）；
   *   · 新形态由调用方**在 `useMemo` 里建一次**（`enterpriseEscSelfInstalledNames(records)` 仍只有
   *     一处实现），本函数只做成员判定。
   *   ★**判据仍然只有一处**：`.has(name)` 这件事在全 `src` 里只在本函数里出现 —— 调用方
   *     **不**先自己 `set.has(name)` 再调本函数（那就成了两处各判一次归属）。
   */
  readonly selfInstalledNames: ReadonlySet<string>
  /** 这一枚技能在本机的目录名（卡片给的就是它；判据只认它）。 */
  readonly name: string
  /**
   * 三条路由的端口在不在场（缺席 ⇒ 那一行**不画**）。
   *
   * ★**「去对话」不在这里**：它与卡片那枚「去试试」共用同一条通路，故它要的那一整件事实由
   *   `gotoChat` 那一格（**同一枚计划**）整份带下来 —— 见下面那格的长注释。
   * ★`edit`（「编辑」：用系统默认应用打开 `SKILL.md`）：宿主路由与界面端口**都已落地（A2.1）**，
   *   故这一格今天为 `true`；判据仍是"端口在不在场"（不是界面写死的常量）——那条路由若哪天下线，
   *   这里会自己变回 `false`、那一行随之消失（用户冻结规格 §3 的 ★ 说的就是这条 fail-closed 形状）。
   */
  readonly wired: {
    readonly edit: boolean
    readonly uninstall: boolean
    readonly reveal: boolean
  }
  /** 在途的那一次动作（缺席 = 没有动作在跑）；只覆盖**本菜单自己**那几枚（`goto-chat` 见下）。 */
  readonly pending?: EnterpriseEscSkillMorePending | undefined
  /**
   * ★**本刀（用户冻结规格 §3：`去对话` 与 `去试试` 是**同一个动作**）**：「去对话」那一行要的
   * **一整件事实** —— **就是**卡片上那枚「去试试」的那一枚计划（`esc-skill-try.ts` 的
   * `EnterpriseEscSkillTryPlan`，**类型**导入）：
   *   · **按不按得动** = `plan.disabled`（那条通路在途 / 这枚名字写不出指令 / 端口没接上）；
   *   · **按下去干什么** = `plan.onTry` —— **同一个闭包**：卡片那枚按钮按的也是它。
   * ⇒ "两个入口、一份实现"在**结构上**成立：本文件那一行**自己没有实现**，只是把那一枚计划的
   *   两个面原样摊到菜单行上（`onSelect` 与 `disabled`）。两处各写一遍长得像的代码那种漂法，
   *   在这里物理上写不出来。
   * ★**在场判据只有这一格**：有 ⇒ 那一行在场（技能卡那一档恒给；别的调用方不给 ⇒ 不画）。
   */
  readonly gotoChat?: EnterpriseEscSkillTryPlan | undefined
  /** 上一次失败（只对命中同一个名字的那一枚生效）。 */
  readonly failure?: EnterpriseEscSkillMoreFailure | undefined
  /** 真写入口：卸载（**确认之后**才会被调到）。 */
  readonly onUninstall: (name: string) => void
  /** 真写入口：打开所在文件夹（点了就跑）。 */
  readonly onReveal: (name: string) => void
  /**
   * ★**本刀**：真写入口「编辑」（宿主那条"用系统默认应用打开 `SKILL.md`"的路由落地后才会有人接）。
   *
   * ★**可选**，且那一行的判据是"`wired.edit` **与** 本格**都在场**"（见计划投影②）：两格都由视图从
   *   **同一个端口**（`EnterpriseEscSkillPort.editSkillFile`）算出来 ⇒ 今天同时缺席、那一行整行不画。
   *   两格都查是刻意的：只查 `wired.edit` 会在"路由有了、界面还没接"那天画出一枚死行；
   *   只查本格则会让"判据是端口在不在场"这条既有口径在这一行上消失（写成一个恒 `undefined` 的实参）。
   */
  readonly onEdit?: ((name: string) => void) | undefined
}): EscCardMore | undefined {
  // ① 可用性判据：这个名字必须真的在本机自装清单的 `names[]` 里（唯一判据，不猜）。
  if (!input.selfInstalledNames.has(input.name)) return undefined
  const busy = input.pending !== undefined && input.pending.name === input.name
  const onEdit = input.onEdit
  const gotoChat = input.gotoChat
  const actions: Partial<Record<SkillMoreEntry['id'], {
    readonly disabled: boolean
    readonly confirm?: { readonly title: string; readonly impact: string; readonly confirmLabel: string } | undefined
    readonly onSelect: () => void
  }>> = {}
  // ② 端口在不在场：缺席的行不画（不是画成禁用）。次序＝版式真源 `SKILL_MORE_ENTRIES` 的次序
  //    （去对话 / 编辑 / 打开文件夹 / 卸载），这里只负责"哪几格在场"。
  if (gotoChat !== undefined) {
    actions['goto-chat'] = {
      // ★两个面都取自那一枚计划：可点性与动作同生同死（不可能出现"能点但没动作"或反之）。
      disabled: gotoChat.disabled === true,
      onSelect: () => { gotoChat.onTry?.() },
    }
  }
  // ★`编辑` 那一行：**宿主路由**（`wired.edit`）与**真的写入口**（`onEdit`）都在场才画 —— 本刀（A2.1）
  //   起两者都在场 ⇒ 那一行真的画出来；这两个格子哪天有一个不在场，它就整行不画（规格 §3 的 ★）。
  if (input.wired.edit && onEdit !== undefined) {
    actions.edit = { disabled: busy, onSelect: () => { onEdit(input.name) } }
  }
  if (input.wired.reveal) {
    actions['open-folder'] = { disabled: busy, onSelect: () => { input.onReveal(input.name) } }
  }
  if (input.wired.uninstall) {
    actions.uninstall = {
      disabled: busy,
      // ★危险行的确认文案随计划一起交下去：卡片那枚 `ConfirmAction` 的入参就是它（界面不写第二份口径）。
      confirm: {
        title: ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM_TITLE,
        impact: ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT,
        confirmLabel: ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM,
      },
      onSelect: () => { input.onUninstall(input.name) },
    }
  }
  // ③ **一行都画不出来** ⇒ 整枚不画（宁可没有入口，也不留一枚点了没反应的 `⋯`）——
  //    判据是"计划里到底有没有格"，不是数某两行（四行之后前者才是对的）。
  if (Object.keys(actions).length === 0) return undefined
  const failure = input.failure !== undefined && input.failure.name === input.name ? input.failure : undefined
  return {
    actions,
    // 在途那句按动作从**全量表**取（`goto-chat` 不在表里：它的在途由「去试试」那一枚计划说，
    // 见 `gotoChat` 那格——同一件事只说一遍）。
    ...(busy && input.pending !== undefined ? { busyText: ENTERPRISE_ESC_MORE_BUSY_TEXT[input.pending.action] } : {}),
    ...(failure === undefined
      ? {}
      : { failure: { code: failure.code, prefix: ENTERPRISE_ESC_MORE_FAILED_PREFIX[failure.action] } }),
  }
}

/* ───────────────────── 三之二、计划表（按名取，唯一构造点） ───────────────────── */

/**
 * 某一面（一份自装真值 + 一份状态）的「更多」计划表 —— **`enterpriseEscSkillMorePlan` 在 `src` 里的唯一调用点**。
 *
 * ★**为什么要有表**（与 `esc-skill-try.ts` 那一张逐字同因）：卡片由 `memo` 包着，memo 的判据是 props
 *   逐键浅相等 ⇒ 逐卡现造的计划对象等于"每张卡每次渲染都变了"；表把同一枚名字的计划**存住**，
 *   同一份状态下取到的永远是**同一枚**（`enterpriseEscPlanTable` 是那条性质的唯一实现）。
 * ★**"这一枚没有计划"也要存住**：`undefined` 是"这张卡连 `⋯` 都不画"这个结论本身
 *   （判据＝归属 + 端口在不在场），每渲染一次重跑一遍就是白算 —— 表连这个结论一起缓存。
 * ★**「去对话」那一格按对象身份分表**：同一枚技能在广场网格里**带**那一枚计划（画得出「去对话」）、
 *   在精选行里**不带**（那一行只递名字 ⇒ 画不出来）——两处本来就该拿到**不同**的计划。
 *   若共用一张按名字的表，后问的那一处会拿到前一处存下的答案（一个入口凭空多出/少掉一行）。
 *   `gotoChat` 是**稳定对象**（来自上面那张 try 表），故按它的身份分表既准确、又照样命中缓存。
 *
 * @param input - 这一份状态：已建好的自装名字集合、三条端口在不在场、在途与失败、两枚真写入口。
 * @returns `get(name, gotoChat)` —— 同一份状态下、同名同档取两次是**同一枚计划**。
 */
export function enterpriseEscSkillMoreTable(input: {
  /** 已建好的自装名字集合（唯一实现 `enterpriseEscSelfInstalledNames` 的产物，见计划投影那一格）。 */
  readonly selfInstalledNames: ReadonlySet<string>
  /** 三条端口的在不在场（缺席的那一行不画）。 */
  readonly wired: {
    readonly edit: boolean
    readonly uninstall: boolean
    readonly reveal: boolean
  }
  /** 在途的那一次动作（缺席 = 没有动作在跑）。 */
  readonly pending?: EnterpriseEscSkillMorePending | undefined
  /** 上一次失败（只对命中同一个名字的那一枚生效）。 */
  readonly failure?: EnterpriseEscSkillMoreFailure | undefined
  /** 真写入口：卸载（**确认之后**才会被调到）。 */
  readonly onUninstall: (name: string) => void
  /** 真写入口：打开所在文件夹（点了就跑）。 */
  readonly onReveal: (name: string) => void
  /** 真写入口：编辑（宿主路由落地后才会有人接；今天与 `wired.edit` 一起缺席）。 */
  readonly onEdit?: ((name: string) => void) | undefined
}): (name: string, gotoChat?: EnterpriseEscSkillTryPlan | undefined) => EscCardMore | undefined {
  /** 唯一构造点（`enterpriseEscSkillMorePlan(` 在本文件之外**一次都不许出现**，门禁逐文件计数锁着）。 */
  const buildPlan = (name: string, gotoChat: EnterpriseEscSkillTryPlan | undefined): EscCardMore | undefined =>
    enterpriseEscSkillMorePlan({
      selfInstalledNames: input.selfInstalledNames,
      name,
      wired: input.wired,
      ...(input.pending === undefined ? {} : { pending: input.pending }),
      ...(gotoChat === undefined ? {} : { gotoChat }),
      ...(input.failure === undefined ? {} : { failure: input.failure }),
      onUninstall: input.onUninstall,
      onReveal: input.onReveal,
      ...(input.onEdit === undefined ? {} : { onEdit: input.onEdit }),
    })
  /** 「去对话」那张计划的身份 ⇒ 一张按名字的表（两级键：先按计划对象，再按名字）。 */
  const byChat = new Map<EnterpriseEscSkillTryPlan | undefined, (name: string) => EscCardMore | undefined>()
  return (name, gotoChat) => {
    let table = byChat.get(gotoChat)
    if (table === undefined) {
      table = enterpriseEscPlanTable<string, EscCardMore | undefined>(each => buildPlan(each, gotoChat))
      byChat.set(gotoChat, table)
    }
    return table(name)
  }
}

/* ────────────────────────── 四、成功交代（两句，各说各的事） ────────────────────────── */

/** 卸载成功那行 `role="status"` 里那一整句（说清刚刚卸了谁、以及本机发生了什么）。 */
export function enterpriseEscSkillMoreUninstalledText(name: string): string {
  return `已卸载「${name}」，本机这份技能目录已移除。`
}

/** 打开文件夹成功那行 `role="status"` 里那一整句（系统那一跳已经交出去了）。 */
export function enterpriseEscSkillMoreRevealedText(name: string): string {
  return `已在系统文件管理器中打开「${name}」的所在文件夹。`
}

/**
 * ★**本刀（A2.1）**：编辑成功那行 `role="status"` 里那一整句。
 *
 * ★与上一条**刻意分开写**（不是同一句套模板）：两者交给系统的是**不同的东西**——一个**目录**
 *   （文件管理器打开它）、一个**文档**（默认应用打开它）。合成一句就得说"交给系统了"这种含糊话，
 *   而员工要判断的正是"它到底把什么交出去了"。
 */
export function enterpriseEscSkillMoreEditedText(name: string): string {
  return `已把「${name}」的 SKILL.md 交给系统默认应用打开。`
}
