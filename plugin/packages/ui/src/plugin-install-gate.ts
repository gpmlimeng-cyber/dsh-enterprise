/**
 * [INPUT]: 只读渲染现场已经拿到的两件事实——目录行给的 `installErrorCode`（带稳定码的目录判定）、以及「为什么现在动不了」的几件现场（写入口缺席 / 在途 / 等重启 / 别的操作用着 / 状态读不到）
 * [OUTPUT]: 插件行动作控件「为什么现在动不了」的唯一判定 `enterprisePluginLockReason` 与唯一一份可见解释/悬浮说明词表 `ENTERPRISE_PLUGIN_LOCK_NOTICE` / `enterprisePluginLockNotice` / `ENTERPRISE_PLUGIN_LOCK_TITLE` / `enterprisePluginSwitchTitle`
 * [POS]: ui 员工侧的**插件行锁定解释**唯一真源——行内开关（`marketplace-entry.tsx`）与「企业设置 → 插件」（`plugin-market.tsx`）两处渲染共用这一份，措辞与判定都不存在第二套；产品宪法「禁用控件不能只挂一句 title」的机械落点。**平台（操作系统）已彻底退出本层与决策面**：这里不读设备系统、也不读目录声明的 `operatingSystems`，插件行的可拨性与文案与系统声明**完全无关**（数据面的 `operatingSystems` 仍随行携带，但不参与任何判断）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { enterpriseErrorMessage } from './error-messages.js'
import type { ManagedPluginState } from './local-api-decode.js'

/** 本机受管态里「这一行正在忙」的那几个（与既有开关禁用口径一字不差）。 */
export const ENTERPRISE_PLUGIN_IN_FLIGHT_STATES: readonly ManagedPluginState[] = [
  'INSTALLING', 'DOWNLOADING', 'REMOVING', 'ROLLBACK',
]

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

/** 开关可用时的两句话（与既有口径一字不差）。 */
export const ENTERPRISE_PLUGIN_SWITCH_TITLE_ON = '点此安装'
export const ENTERPRISE_PLUGIN_SWITCH_TITLE_OFF = '点此卸载'
/** 目录判定不可安装时，悬浮说明的前缀（后面接该码的人话）。 */
export const ENTERPRISE_PLUGIN_TITLE_BLOCKED_PREFIX = '不可安装：'

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
 * 动作控件的悬浮说明（`title`）：可用就说「点它做什么」，不可用就说「为什么不可用」。
 *
 * 它只是**补充**——可见那句话由 `enterprisePluginLockNotice` / 唯一提示组件负责渲染，
 * 任何情况下都不允许把原因只留在这里。
 */
export function enterprisePluginSwitchTitle(input: {
  readonly enabled: boolean
  readonly lockReason?: EnterprisePluginLockReason | undefined
  readonly installErrorCode?: string | undefined
}): string {
  if (input.installErrorCode !== undefined) {
    return `${ENTERPRISE_PLUGIN_TITLE_BLOCKED_PREFIX}${enterpriseErrorMessage(input.installErrorCode)}`
  }
  if (input.lockReason !== undefined) return ENTERPRISE_PLUGIN_LOCK_TITLE[input.lockReason]
  return input.enabled ? ENTERPRISE_PLUGIN_SWITCH_TITLE_OFF : ENTERPRISE_PLUGIN_SWITCH_TITLE_ON
}
