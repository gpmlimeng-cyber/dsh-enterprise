/**
 * [INPUT]: 只读渲染现场已经拿到的几件事实——目录行给的 `installErrorCode`（带稳定码的目录判定）、本机受管态与 `desiredState`（「装没装」）、那一行的启停位 `enabled`、以及「为什么现在动不了」的几件现场（写入口缺席 / 在途 / 等重启 / 别的操作用着 / 状态读不到）
 * [OUTPUT]: 插件行动作区的**全部**口径真源——① 分流 `enterprisePluginRowAction`/`enterprisePluginInstalled`（未安装⇒【＋ 安装】、已安装⇒【开关】＝启用/停用）；② 「为什么动不了」的唯一判定 `enterprisePluginLockReason` 与唯一一份可见解释/悬浮说明词表 `ENTERPRISE_PLUGIN_LOCK_NOTICE`/`enterprisePluginLockNotice`/`ENTERPRISE_PLUGIN_LOCK_TITLE`；③ 三枚动作控件的悬浮说明 `enterprisePluginInstallTitle`/`enterprisePluginSwitchTitle` 与**四态词表**（未安装 / 已安装启用 / 已安装停用 / 进行中 / 失败）里属于本层的那几句 `ENTERPRISE_PLUGIN_{INSTALLED,ENABLED,DISABLED}_LABEL` + `enterprisePluginInstalledStatusLabel`；④ 【卸载】只在详情页那一枚的文案与影响说明 `ENTERPRISE_PLUGIN_UNINSTALL_{TITLE,IMPACT}`
 * [POS]: ui 员工侧的**插件行动作分流 + 锁定解释 + 词表**唯一真源——行内动作区（`marketplace-entry.tsx` 的插件行）与「企业设置 → 插件」（`plugin-market.tsx` 的卡片行与详情弹窗）三处渲染共用这一份，措辞、判定与「哪一格给哪种控件」都不存在第二套；产品宪法「禁用控件不能只挂一句 title」的机械落点。**平台（操作系统）已彻底退出本层与决策面**：这里不读设备系统、也不读目录声明的 `operatingSystems`，插件行的可拨性与文案与系统声明**完全无关**（数据面的 `operatingSystems` 仍随行携带，但不参与任何判断）。
 *
 * **启停语义（用户明确纠正过，写死在这里）**：已安装那一行的【开关】＝**启用 / 停用**，
 * **关闭「绝不」等于卸载**（词条里因此不存在「点此卸载」这种行上说法）；【卸载】是**破坏性**操作，
 * 只在**详情页**给（带确认 + 说清影响），列表行一个卸载入口都不许有。
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { enterpriseErrorMessage } from './error-messages.js'
import type { ManagedPluginState } from './local-api-decode.js'

/** 本机受管态里「这一行正在忙」的那几个（与既有开关禁用口径一字不差）。 */
export const ENTERPRISE_PLUGIN_IN_FLIGHT_STATES: readonly ManagedPluginState[] = [
  'INSTALLING', 'DOWNLOADING', 'REMOVING', 'ROLLBACK',
]

/* ────────────────────────── 一、动作区分流（＋ 还是开关） ────────────────────────── */

/**
 * 一行插件该给哪一枚动作控件。
 *
 * · `'install'` —— 未安装：一枚【＋】图标按钮（点 = 安装）。
 * · `'switch'` —— 已安装：一枚【开关】（开 = 启用、关 = 停用；**关掉绝不卸载**）。
 */
export type EnterprisePluginRowAction = 'install' | 'switch'

/**
 * 「这一行装没装」的**唯一**判定。
 *
 * 两件真源，缺一不可：
 *  ① 本机记录的 `desiredState === 'INSTALLED'`（中心要它装着）；
 *  ② 本机记录里有**已落盘的版本**（`version != null`）——装到手才有。
 * 只看 ①不够：一次**失败**的首次安装留下的正是 `desiredState: 'INSTALLED'` + `state: 'FAILED'` +
 * `version: null`（`service.ts:854-863` 的 `put` 原样写 assignment 的 desiredState），那一行要给的
 * 是「重试安装」（＝【＋】那一格），**不是**一枚看起来装着却没在跑的开关。
 * 只看 `state` 也不够：「卸载待重启」与「安装待重启」都是 `RESTART_REQUIRED`，二者该给的控件相反。
 *
 * 两件真源都缺席时（旧 Host 的投影、或测试里直接构造的行）退回既有口径
 * 「本机受管态不是 `EXPECTED`」（`EXPECTED` 是「本机还没有这条记录」的既有说法）——
 * 这是**为缺失设计的降级**，不是第二套判定：字段在场时永远只认字段。
 */
export function enterprisePluginInstalled(input: {
  /** 本机记录说的「该装着吗」；缺席 = 退回受管态口径。 */
  readonly desiredState?: 'INSTALLED' | 'ABSENT' | undefined
  /** 本机记录里的**已落盘版本**；`null` = 还没有制品落到本机（进行中 / 失败）。 */
  readonly version?: string | null | undefined
  /** 本机受管态（无记录按 `EXPECTED`）。 */
  readonly state: ManagedPluginState
}): boolean {
  if (input.desiredState !== undefined) {
    if (input.desiredState !== 'INSTALLED') return false
    // 版本那一件同样为缺失设计：调用方**根本没有**这份事实时只认 desiredState；
    // 给了（哪怕是 null）就严格按「装到手过」判——失败的首装正是 null 那一支。
    return input.version === undefined || input.version !== null
  }
  return input.state !== 'EXPECTED'
}

/** 行上动作控件分流的唯一入口：未安装 ⇒ `'install'`（＋），已安装 ⇒ `'switch'`（启用/停用）。 */
export function enterprisePluginRowAction(input: {
  readonly desiredState?: 'INSTALLED' | 'ABSENT' | undefined
  readonly version?: string | null | undefined
  readonly state: ManagedPluginState
}): EnterprisePluginRowAction {
  return enterprisePluginInstalled(input) ? 'switch' : 'install'
}

/* ────────────────────────── 二、词表（唯一一份） ────────────────────────── */

/** 未安装那一格的可见状态词（既有官方状态词表里 `EXPECTED` 的同一句话）。 */
export const ENTERPRISE_PLUGIN_ABSENT_LABEL = '未安装'
/** 已安装那一格的可见状态词（启停位单独接在后面）。 */
export const ENTERPRISE_PLUGIN_INSTALLED_LABEL = '已安装'
/** 已安装 + 开着的可见说法。 */
export const ENTERPRISE_PLUGIN_ENABLED_LABEL = '已启用'
/** 已安装 + 关掉的可见说法——用户口径的词是**停用**，不是「卸载」。 */
export const ENTERPRISE_PLUGIN_DISABLED_LABEL = '已停用'

/** 启停位 → 可见词（两处渲染取的是这一份，不会一处说「已启用」另一处说「未启用」）。 */
export function enterprisePluginEnabledLabel(enabled: boolean): string {
  return enabled ? ENTERPRISE_PLUGIN_ENABLED_LABEL : ENTERPRISE_PLUGIN_DISABLED_LABEL
}

/**
 * 「已安装」那一行的完整可见状态词：`已安装 · 已启用` / `已安装 · 已停用`。
 *
 * 未安装那一格不走这里（它由唯一那份官方状态词表说「未安装」，并且那枚控件是 ＋ 而不是开关）。
 */
export function enterprisePluginInstalledStatusLabel(enabled: boolean): string {
  return `${ENTERPRISE_PLUGIN_INSTALLED_LABEL} · ${enterprisePluginEnabledLabel(enabled)}`
}

/* ────────────────────────── 三、卸载（只在详情页） ────────────────────────── */

/**
 * 详情页那枚【卸载】的悬浮说明与无障碍名。
 *
 * 它在**详情页**，不在列表行：破坏性操作要用户先看清这是什么、会造成什么，再确认一次。
 */
export const ENTERPRISE_PLUGIN_UNINSTALL_TITLE = '卸载这个插件'
/** 卸载按钮的无障碍名（带主体，见 `enterprisePluginUninstallLabel`）。 */
export function enterprisePluginUninstallLabel(subject: string): string {
  return `卸载 ${subject}`
}

/** 详情页【卸载】的悬浮说明：不可用时说为什么，可用时就是「卸载这个插件」。 */
export function enterprisePluginUninstallTitle(input: {
  readonly lockReason?: EnterprisePluginLockReason | undefined
}): string {
  if (input.lockReason !== undefined) return ENTERPRISE_PLUGIN_LOCK_TITLE[input.lockReason]
  return ENTERPRISE_PLUGIN_UNINSTALL_TITLE
}

/**
 * 详情页确认卸载时**说清影响**的那一句（唯一一份，两处详情共用同一句）。
 *
 * 说的是这台设备上真实会发生什么：依赖与运行一起消失、企业侧的分配不受影响、
 * 下次要装得重新下载。不吓唬也不含糊。
 */
export const ENTERPRISE_PLUGIN_UNINSTALL_IMPACT =
  '卸载会把这枚插件从这台设备上移除：它本机的运行与已装状态会一起消失，企业侧的分配不会因此改变。'
  + '以后要再用，需要重新下载安装。'

/* ────────────────────────── 四、动不了时为什么（既有口径，一字未改） ────────────────────────── */

/**
 * 插件行的动作控件**动不了**的全部原因（唯一一份词表）。
 *
 * `incompatible` 是目录给的判定（带稳定码）：它的可见交代由唯一提示组件连原因带下一步一起渲染，
 * 所以它没有 `ENTERPRISE_PLUGIN_LOCK_NOTICE` 那一句（见 `enterprisePluginLockNotice`）。
 */
export type EnterprisePluginLockReason = 'no-entry' | 'in-progress' | 'restart' | 'busy' | 'fatal' | 'incompatible'

/**
 * 「为什么动不了」的**可见**一句话。
 *
 * 这一份存在的理由就是产品宪法那条门禁：**禁用控件不许只挂一句 `title`**——每一句都在行上看得见，
 * 行内开关与「企业设置 → 插件」两处渲染读的是同一份措辞。
 */
export const ENTERPRISE_PLUGIN_LOCK_NOTICE: Readonly<Record<Exclude<EnterprisePluginLockReason, 'incompatible'>, string>> = {
  'no-entry': '这里暂时不能安装，请重新打开应用后再试。',
  'in-progress': '安装或卸载正在进行，完成后就能继续操作。',
  restart: '安装已经完成，重新打开客户端后生效。',
  busy: '另一项插件操作正在进行，请等它结束后再试。',
  fatal: '插件状态暂时读不到，请刷新后重试。',
}

/** 锁定原因的可见一句话；`undefined` 或 `incompatible` 时没有（后者由唯一提示组件说）。 */
export function enterprisePluginLockNotice(reason: EnterprisePluginLockReason | undefined): string | undefined {
  if (reason === undefined || reason === 'incompatible') return undefined
  return ENTERPRISE_PLUGIN_LOCK_NOTICE[reason]
}

/** 锁定原因的悬浮说明（`title`）——**补充**可见那句话，不替代它。 */
export const ENTERPRISE_PLUGIN_LOCK_TITLE: Readonly<Record<EnterprisePluginLockReason, string>> = {
  'no-entry': '这里暂时不能安装',
  'in-progress': '正在处理，请稍候',
  restart: '重新打开客户端后生效',
  busy: '另一项插件操作正在进行',
  fatal: '插件状态暂时读不到',
  incompatible: '该插件当前不可安装',
}

/**
 * 未安装那一行那枚【＋】的悬浮说明。
 *
 * 图标按钮的可见文案只有一枚 ＋，它的语义全部由无障碍名承载
 * （`enterprisePluginInstallLabel`），`title` 只是鼠标悬停时的补充。
 */
export const ENTERPRISE_PLUGIN_INSTALL_TITLE = '点此安装'

/**
 * 已安装那一行那枚【开关】的悬浮说明：**开 = 点它就是停用，关 = 点它就是启用**。
 *
 * 「点此卸载」这种说法在本层**不存在**——用户明确纠正过：关掉开关是停用，不是卸载。
 */
export const ENTERPRISE_PLUGIN_DISABLE_TITLE = '点此停用'
export const ENTERPRISE_PLUGIN_ENABLE_TITLE = '点此启用'

/** 【＋】按钮的无障碍名（唯一一份，行上与卡片行同源）。 */
export function enterprisePluginInstallLabel(subject: string): string {
  return `安装 ${subject}`
}

/** 目录判定不可安装时，悬浮说明的前缀（后面接该码的人话）。 */
export const ENTERPRISE_PLUGIN_TITLE_BLOCKED_PREFIX = '不可安装：'

/* ────────────────────────── 五、动不了的唯一判定 ────────────────────────── */

/** 判定这一行为什么动不了；`undefined` = 可以动。 */
export interface EnterprisePluginLockInput {
  /** 这一行的动作写入口在不在（`onTogglePlugin` / `store.installPlugin`）。 */
  readonly hasAction: boolean
  /** 本机受管态。 */
  readonly state: ManagedPluginState
  /** 目录给的不可安装判定（有码即不可安装）。 */
  readonly installErrorCode?: string | undefined
  /** 本机已装好、等重启生效。 */
  readonly restartPending?: boolean | undefined
  /** 有别的插件操作（或账号动作）在途。 */
  readonly busy?: boolean | undefined
  /** 插件状态投影本身读不到。 */
  readonly fatal?: boolean | undefined
}

/**
 * 「为什么动不了」的**唯一判定**（纯投影）。
 *
 * 优先级是有意的：目录判定（带稳定码、带下一步）> 写入口缺席 > 状态读不到 > 这一行在途 >
 * 等重启 > 别的操作用着。行内开关与「企业设置 → 插件」都只调这一处，两处的禁用口径因此不可能分叉。
 *
 * 注意：**目录判定只拦「安装」，不拦「停用」**——已安装的行即使目录里已下架或判不可安装，
 * 用户仍要能把本机这一枚停掉（那是他的自救动作）；这一条由调用方按 `rowAction` 选传入的码来落地
 * （见两处渲染与反向锁用例）。
 */
export function enterprisePluginLockReason(input: EnterprisePluginLockInput): EnterprisePluginLockReason | undefined {
  if (input.installErrorCode !== undefined) return 'incompatible'
  if (!input.hasAction) return 'no-entry'
  if (input.fatal === true) return 'fatal'
  if (ENTERPRISE_PLUGIN_IN_FLIGHT_STATES.includes(input.state)) return 'in-progress'
  if (input.restartPending === true) return 'restart'
  if (input.busy === true) return 'busy'
  return undefined
}

/**
 * 【＋】的悬浮说明：可用就说「点此安装」，不可用就说「为什么不可用」。
 *
 * 它只是**补充**——可见那句话由 `enterprisePluginLockNotice` / 唯一提示组件负责渲染，
 * 任何情况下都不允许把原因只留在这里。
 */
export function enterprisePluginInstallTitle(input: {
  readonly lockReason?: EnterprisePluginLockReason | undefined
  readonly installErrorCode?: string | undefined
}): string {
  if (input.installErrorCode !== undefined) {
    return `${ENTERPRISE_PLUGIN_TITLE_BLOCKED_PREFIX}${enterpriseErrorMessage(input.installErrorCode)}`
  }
  if (input.lockReason !== undefined) return ENTERPRISE_PLUGIN_LOCK_TITLE[input.lockReason]
  return ENTERPRISE_PLUGIN_INSTALL_TITLE
}

/**
 * 【开关】的悬浮说明：可用时按启停位说「点此停用 / 点此启用」，不可用时说「为什么不可用」。
 *
 * `enabled` 是这枚插件**此刻的启停位**（不是「装没装」——开关只在已安装的行上出现）。
 */
export function enterprisePluginSwitchTitle(input: {
  readonly enabled: boolean
  readonly lockReason?: EnterprisePluginLockReason | undefined
}): string {
  if (input.lockReason !== undefined) return ENTERPRISE_PLUGIN_LOCK_TITLE[input.lockReason]
  return input.enabled ? ENTERPRISE_PLUGIN_DISABLE_TITLE : ENTERPRISE_PLUGIN_ENABLE_TITLE
}
