/**
 * [INPUT]: 只依赖 `esc-more-menu.tsx` 的 `EscCardMore`/`SkillMoreEntry`（**类型**导入）与
 *   `skill-api-decode.ts` 的自装记录类型（**类型**导入），以及 `esc-system.ts` 那条既有的
 *   "自装记录 → 已装名字并集"投影（**复用**，见下面那条说明）；不依赖 React、不依赖官方原语、
 *   不发请求、不认识任何路由
 * [OUTPUT]: 对外提供技能卡「更多」下拉里那两枚**本机管理动作**的唯一事实层——可见文案（二次确认三句 /
 *   在途两句 / 两种失败前缀 / 两句成功交代）、一次动作的**超时**、**可用性判据的唯一实现**
 *   `enterpriseEscSelfInstalledNames`（`names[]` 并集）与唯一计划投影 `enterpriseEscSkillMorePlan`
 * [POS]: dsh-ui 技能页「更多」下拉（`esc-more-menu.tsx` 是它的呈现层）的**唯一判定与文案真源**：
 *   页面只画、聚合层只接线。冻结契约（宿主侧 `bundle/src/skill-self-installed-route.ts` +
 *   `skill-self-installed.ts`）：`POST …/local/skills/self-installed/{uninstall,reveal}`，
 *   正文关闭键集恰好 `{name}`。
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
import { enterpriseEscSystemInstalledNames } from './esc-system.js'

/**
 * 两枚动作的 id（**与 `esc-more-menu.tsx` 那两行同域**：`SkillMoreEntry['id']` 是唯一真源，
 * 这里只给它一个本域的名字，改行名时编译期就会红）。
 */
export type EnterpriseEscSkillMoreAction = SkillMoreEntry['id']

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
/** 卸载失败提示的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射按稳定码给）。 */
export const ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX = '卸载失败'
/** 打开文件夹失败提示的动作前缀（同上）。 */
export const ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX = '打开文件夹失败'
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
 *   · **归属**（这一枚是不是本机自装的）—— `selfInstalled` 的 `names[]` 里有没有 `name`；没有 ⇒ 返回
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
 * @param input - 自装清单、这一枚的名字、端口在不在场、在途与失败、两枚真写入口。
 * @returns 卡片那枚「更多」的计划；`undefined` = 这一枚**不画**（不是画成禁用）。
 */
export function enterpriseEscSkillMorePlan(input: {
  /** `GET /skills/self-installed` 的当前真值（读不到时是空数组 —— 那时一枚动作都不给）。 */
  readonly selfInstalled: readonly EnterpriseSelfInstalledSkill[]
  /** 这一枚技能在本机的目录名（卡片给的就是它；判据只认它）。 */
  readonly name: string
  /** 两条路由的端口在不在场（缺席 ⇒ 那一行不画）。 */
  readonly wired: { readonly uninstall: boolean; readonly reveal: boolean }
  /** 在途的那一次动作（缺席 = 没有动作在跑）。 */
  readonly pending?: EnterpriseEscSkillMorePending | undefined
  /** 上一次失败（只对命中同一个名字的那一枚生效）。 */
  readonly failure?: EnterpriseEscSkillMoreFailure | undefined
  /** 真写入口：卸载（**确认之后**才会被调到）。 */
  readonly onUninstall: (name: string) => void
  /** 真写入口：打开所在文件夹（点了就跑）。 */
  readonly onReveal: (name: string) => void
}): EscCardMore | undefined {
  // ① 可用性判据：这个名字必须真的在本机自装清单的 `names[]` 里（唯一判据，不猜）。
  if (!enterpriseEscSelfInstalledNames(input.selfInstalled).has(input.name)) return undefined
  const busy = input.pending !== undefined && input.pending.name === input.name
  const actions: Partial<Record<SkillMoreEntry['id'], {
    readonly disabled: boolean
    readonly confirm?: { readonly title: string; readonly impact: string; readonly confirmLabel: string } | undefined
    readonly onSelect: () => void
  }>> = {}
  // ② 端口在不在场：缺席的行不画（不是画成禁用）。
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
  // ③ 两行都画不出来 ⇒ 整枚不画（宁可没有入口，也不留一枚点了没反应的 `⋯`）。
  if (actions['open-folder'] === undefined && actions.uninstall === undefined) return undefined
  const failure = input.failure !== undefined && input.failure.name === input.name ? input.failure : undefined
  return {
    actions,
    ...(busy && input.pending !== undefined
      ? { busyText: input.pending.action === 'uninstall' ? ENTERPRISE_ESC_MORE_UNINSTALLING : ENTERPRISE_ESC_MORE_REVEALING }
      : {}),
    ...(failure === undefined
      ? {}
      : {
          failure: {
            code: failure.code,
            prefix: failure.action === 'uninstall'
              ? ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX
              : ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX,
          },
        }),
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
