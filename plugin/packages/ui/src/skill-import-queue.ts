/**
 * [INPUT]: 只依赖同一叶片的纯事实层 `skill-import`（尺寸预检 `enterpriseSkillImportRejectReason`、成功那句
 *   `enterpriseSkillImportNotice`、动词 `ENTERPRISE_SKILL_IMPORT_DONE`）与唯一码表 `error-messages` 的
 *   `enterpriseErrorMessage`（把稳定码翻成人话；**不新写第二句失败文案**）
 * [OUTPUT]: 对外提供口径 60 的**队列纯投影**：类型 `EnterpriseSkillImportItem` / `EnterpriseSkillImportQueue` /
 *   `EnterpriseSkillImportItemResult` / `EnterpriseSkillImportOutcome`、空队列常量
 *   `ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE`、逐项状态词五枚、四枚纯函子（`…QueueOf` 入队 / `…QueueStart` 交棒 /
 *   `…QueueSettle` 收束 / `…QueueSummary` 摘要句）、装中禁关的唯一判据 `…QueueClosable`、
 *   收束裁决 `…QueueOutcome` 与逐项可见状态句 `…ItemStatusText` / `…ItemErrorText`
 * [POS]: 本地上传通路的**队列事实层**（无 React、无 DOM、无 I/O、无第二个上传器）。它与
 *   `skill-import-port.tsx` 分工：那边是"怎么真的发出去"（复用既有单件状态机），这边是"多份文件排队时
 *   状态怎么迁移、摘要怎么说、什么时候不许关窗"——**这一层可脱 DOM 直测**，故口径 60 的四条硬判据
 *   （串行 / 单项失败不中断 / 摘要逐字 / 装中禁关）全部落在纯函数上，而不是落在渲染里。
 *   ★它**不**判内容、**不**判扩展名：尺寸预检复用既有那一枚 `enterpriseSkillImportRejectReason`（同一条规则、
 *   同一个码），别的一律交给 Host 的闸门——这也是本刀**没有**照抄 Cherry「非 zip 文件当场记一条错误」的原因。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { enterpriseErrorMessage } from './error-messages.js'
import {
  ENTERPRISE_SKILL_IMPORT_DONE,
  enterpriseSkillImportNotice,
  enterpriseSkillImportRejectReason,
} from './skill-import.js'

/**
 * 逐项状态（四态，互斥）：
 *   · `pending` 排队中（还没轮到它）
 *   · `installing` 进行中（**同一时刻至多一项**——串行纪律，门禁直测）
 *   · `success` 成功（带自装清单里读到的技能目录名）
 *   · `failed` 失败（带稳定码：前端尺寸预检那一枚，或 Host 回的任意码）
 */
export type EnterpriseSkillImportItemStatus = 'pending' | 'installing' | 'success' | 'failed'

/** 队列里的一项（一件文件 = 一项；顺序 = 用户的选择顺序）。 */
export interface EnterpriseSkillImportItem {
  readonly id: string
  readonly name: string
  readonly bytes: number
  readonly status: EnterpriseSkillImportItemStatus
  /** 失败项：稳定码（原文进 `title`，人话由 `enterpriseErrorMessage` 唯一映射给）。 */
  readonly code?: string | undefined
  /** 成功项：这次装好的技能目录名（自装清单按**用户原始文件名**精确匹配的那一枚记录）。 */
  readonly names?: readonly string[] | undefined
  /** 成功项：自装清单读到了没有（`false` ⇒ 逐项行如实补半句，不是失败）。 */
  readonly listed?: boolean | undefined
}

/**
 * 一批导入的**全部事实**（纯数据，可序列化比对）。
 *
 * ★`attempted` 这一格是「全部预失败 ⇒ 直接返回不干活」那条判据的**唯一**依据：它数是"真的被送去上传过"的项，
 *   而尺寸预检当场失败的项**不算尝试过**（一个字节都没发出去）。少了这一格，"全部预失败"与"跑了一圈全失败"
 *   在收束时长得一模一样，而用户看到的界面**应当不同**（前者一条批量摘要都不该出，错误已经在逐项行上）。
 */
export interface EnterpriseSkillImportQueue {
  readonly items: readonly EnterpriseSkillImportItem[]
  /** 下一个要处理的下标（`undefined` = 这一批没有待处理项了）。 */
  readonly active: number | undefined
  /** 这一批里真的被送去上传过的项数。 */
  readonly attempted: number
}

/** 空队列（关闭弹窗/重开时回到它；同一枚常量 ⇒ 重复 reset 不会引起重渲染）。 */
export const ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE: EnterpriseSkillImportQueue = { items: [], active: undefined, attempted: 0 }

/** 逐项状态的可见词（口径 60 逐字：排队中 / 进行中 / 成功 / 失败）。 */
export const ENTERPRISE_SKILL_IMPORT_STATUS_PENDING = '排队中'
export const ENTERPRISE_SKILL_IMPORT_STATUS_INSTALLING = '进行中'
export const ENTERPRISE_SKILL_IMPORT_STATUS_SUCCESS = '成功'
export const ENTERPRISE_SKILL_IMPORT_STATUS_FAILED = '失败'
/** 逐项状态词与后面那句话之间的分隔（明细行逐字：`失败：<人话>`）。 */
export const ENTERPRISE_SKILL_IMPORT_STATUS_SEPARATOR = '：'

/** 批量摘要句的三个词（口径 60 逐字：`失败 N / 成功 M / 共 K`）。 */
export const ENTERPRISE_SKILL_IMPORT_SUMMARY_FAILED = '失败'
export const ENTERPRISE_SKILL_IMPORT_SUMMARY_SUCCESS = '成功'
export const ENTERPRISE_SKILL_IMPORT_SUMMARY_TOTAL = '共'
/** 摘要句的段间分隔（逐字，两侧各一个空格）。 */
export const ENTERPRISE_SKILL_IMPORT_SUMMARY_SEPARATOR = ' / '

/** 多份全成功时 toast 那句的量词尾巴（动词复用既有那枚 `ENTERPRISE_SKILL_IMPORT_DONE`，不新造动词）。 */
export const ENTERPRISE_SKILL_IMPORT_BATCH_SUFFIX = ' 个技能包。'

/** 一项的终局（由**既有单件状态机**的结果投影而来：`done` → success，`failed` → failed）。 */
export type EnterpriseSkillImportItemResult =
  | { readonly kind: 'success'; readonly names: readonly string[]; readonly listed: boolean }
  | { readonly kind: 'failed'; readonly code: string }

/** 下一枚待处理下标（`pending` 才算；预检就失败的项**跳过**——这正是"不干活"那条早退判据的一半）。 */
function nextPending(items: readonly EnterpriseSkillImportItem[], from: number): number | undefined {
  for (let index = from; index < items.length; index += 1) {
    const item = items[index]
    if (item !== undefined && item.status === 'pending') return index
  }
  return undefined
}

/**
 * 入队（纯函数）：一批文件 → 一批队列项，**顺序 = 选择顺序**（下标即交棒时用的那把钥匙）。
 *
 * ★尺寸预检在这里就做完（复用既有那一枚 `enterpriseSkillImportRejectReason`：同一条规则、同一个码）：
 *   超限的项**当场**就是 `failed`，一个字节都不会发出去，也不会占 `attempted` 的位。
 *   这就是 Cherry 那句 `preErrorCount === total` 早退判据在本仓的等价物。
 *
 * @param files - 用户这一次选/拖进来的文件（只要 `name`/`size` 两件事实；`File` 天然满足）。
 * @returns 新队列（`active` = 第一枚待处理项；全部预失败时是 `undefined`）。
 */
export function enterpriseSkillImportQueueOf(
  files: readonly { readonly name: string; readonly size: number }[],
): EnterpriseSkillImportQueue {
  const items: readonly EnterpriseSkillImportItem[] = files.map((file, index) => {
    const rejected = enterpriseSkillImportRejectReason(file)
    const id = `${index}:${file.name}:${file.size}`
    return rejected === undefined
      ? { id, name: file.name, bytes: file.size, status: 'pending' }
      : { id, name: file.name, bytes: file.size, status: 'failed', code: rejected }
  })
  return { items, active: nextPending(items, 0), attempted: 0 }
}

/**
 * 交棒（纯函数）：把 `index` 那一项推进到 `installing`，并把 `attempted` 加一。
 *
 * ★只有 `pending` 能被交棒（其余状态原样返回 —— 状态迁移是单向的，重复交棒不会把一项装两次）。
 * ★**串行纪律**就在这里：交棒只碰**项**，`active` 仍是这一项（推进只发生在 `…QueueSettle`）⇒
 *   同一时刻至多一项 `installing`，由构造保证（门禁直测）。
 */
export function enterpriseSkillImportQueueStart(
  queue: EnterpriseSkillImportQueue,
  index: number,
): EnterpriseSkillImportQueue {
  const item = queue.items[index]
  if (item === undefined || item.status !== 'pending') return queue
  return {
    items: queue.items.map((each, at) => (at === index ? { ...each, status: 'installing' as const } : each)),
    active: index,
    attempted: queue.attempted + 1,
  }
}

/**
 * 收束（纯函数）：一项有结果了 ⇒ 落状态、把 `active` 推到**下一个待处理项**。
 *
 * ★**单项失败不中断其余**：成功与失败**走同一条推进**（都是 `nextPending(items, index + 1)`）——
 *   失败不写 `active: undefined`、也不把后面的项标成"放弃"。这正是 Cherry `for` 循环里那个
 *   `catch` 只落一项、不 `break` 的口径（门禁：三项里第二项失败时第三项仍被处理）。
 *
 * @param queue - 当前队列。
 * @param index - 刚有结果的那一项（必须正处 `installing`，否则原样返回）。
 * @param result - 那一项的终局。
 */
export function enterpriseSkillImportQueueSettle(
  queue: EnterpriseSkillImportQueue,
  index: number,
  result: EnterpriseSkillImportItemResult,
): EnterpriseSkillImportQueue {
  const item = queue.items[index]
  if (item === undefined || item.status !== 'installing') return queue
  const items = queue.items.map((each, at) => {
    if (at !== index) return each
    return result.kind === 'success'
      ? { ...each, status: 'success' as const, names: result.names, listed: result.listed }
      : { ...each, status: 'failed' as const, code: result.code }
  })
  return { items, active: nextPending(items, index + 1), attempted: queue.attempted }
}

/** 一项的可见状态句（纯投影，可脱 DOM 直测）。 */
export function enterpriseSkillImportItemStatusText(item: EnterpriseSkillImportItem): string {
  if (item.status === 'pending') return ENTERPRISE_SKILL_IMPORT_STATUS_PENDING
  if (item.status === 'installing') return ENTERPRISE_SKILL_IMPORT_STATUS_INSTALLING
  if (item.status === 'success') {
    const names = item.names ?? []
    return names.length === 0
      ? ENTERPRISE_SKILL_IMPORT_STATUS_SUCCESS
      : `${ENTERPRISE_SKILL_IMPORT_STATUS_SUCCESS}${ENTERPRISE_SKILL_IMPORT_STATUS_SEPARATOR}${names.join('、')}`
  }
  const human = enterpriseSkillImportItemErrorText(item)
  return human === undefined
    ? ENTERPRISE_SKILL_IMPORT_STATUS_FAILED
    : `${ENTERPRISE_SKILL_IMPORT_STATUS_FAILED}${ENTERPRISE_SKILL_IMPORT_STATUS_SEPARATOR}${human}`
}

/**
 * 失败项的**人话**（唯一来源：`error-messages` 那张表）。
 *
 * ★本文件**不写**失败文案，只把它从唯一码表取出来——所以"同一枚码在别处长出第二句话"这件事在这里不可能发生。
 *   码本身（原文）由界面挂进 `title`（口径 60：可读错误上屏、原文进 `title`）。
 */
export function enterpriseSkillImportItemErrorText(item: EnterpriseSkillImportItem): string | undefined {
  return item.code === undefined ? undefined : enterpriseErrorMessage(item.code)
}

/** 三枚计数（纯投影；三处消费方——摘要句、收束裁决、逐项渲染——从同一处算，不各数一遍）。 */
export function enterpriseSkillImportQueueCounts(
  queue: EnterpriseSkillImportQueue,
): { readonly failed: number; readonly success: number; readonly total: number } {
  let failed = 0
  let success = 0
  for (const item of queue.items) {
    if (item.status === 'failed') failed += 1
    if (item.status === 'success') success += 1
  }
  return { failed, success, total: queue.items.length }
}

/**
 * 批量摘要句（纯投影，逐字 `失败 N / 成功 M / 共 K`）。
 *
 * 两档由**构造**给出：
 *   · **0 失败** ⇒ `undefined`（没有失败就没有摘要句 —— 这一档由"全成功 ⇒ toast + 关窗"接管）；
 *   · **全失败** ⇒ 照常出句（`失败 3 / 成功 0 / 共 3`），与"部分失败"同一套拼法，不特判、不换格式。
 * 单项（`total === 1`）不出摘要句：那一项的错误已经在逐项行上说清楚了，再顶一句"失败 1 / 共 1"是噪音
 * （与 Cherry「批量失败横幅只在多项时出现」同判）。
 */
export function enterpriseSkillImportQueueSummary(queue: EnterpriseSkillImportQueue): string | undefined {
  const { failed, success, total } = enterpriseSkillImportQueueCounts(queue)
  if (total <= 1 || failed === 0) return undefined
  return [
    `${ENTERPRISE_SKILL_IMPORT_SUMMARY_FAILED} ${failed}`,
    `${ENTERPRISE_SKILL_IMPORT_SUMMARY_SUCCESS} ${success}`,
    `${ENTERPRISE_SKILL_IMPORT_SUMMARY_TOTAL} ${total}`,
  ].join(ENTERPRISE_SKILL_IMPORT_SUMMARY_SEPARATOR)
}

/**
 * **装中禁关的唯一判据**（纯函数）：还有排队中/进行中的项 ⇒ `false`（关闭请求被拒）。
 *
 * ★为什么 `pending` 也算"装中"：队列一入队就会立刻交棒，`pending` 只出现在"前面那一项还在装"的窗口里
 *   ——那正是用户最不该关窗的时刻（关掉就等于丢掉后面那几份的进度，而界面上已经把它们列出来了）。
 */
export function enterpriseSkillImportQueueClosable(queue: EnterpriseSkillImportQueue): boolean {
  return !queue.items.some(item => item.status === 'pending' || item.status === 'installing')
}

/** 收束之后该做什么（纯投影；React 层只**执行**，不再自己判断一遍）。 */
export type EnterpriseSkillImportOutcome =
  /** 空批次：什么都不做（弹窗里没有队列）。 */
  | { readonly kind: 'idle' }
  /** 还有项在跑：留着弹窗。 */
  | { readonly kind: 'running' }
  /** 全成功 ⇒ toast 那一句 + 自动关窗。 */
  | { readonly kind: 'success'; readonly toast: string }
  /** 多项且有失败 ⇒ 顶部摘要句，**不关窗**（可重选文件）。 */
  | { readonly kind: 'partial'; readonly summary: string }
  /** 单项失败 ⇒ 不关窗（错误在那一项上），也不出摘要句。 */
  | { readonly kind: 'failed' }
  /** 全部预失败（一个字节都没发出去）⇒ **直接返回不干活**：不出摘要、不 toast、不关窗。 */
  | { readonly kind: 'nothing' }

/**
 * 一批跑完之后该做什么（纯函数，页面照它执行）。
 *
 * @param queue - 当前队列。
 * @returns 见 `EnterpriseSkillImportOutcome`。
 */
export function enterpriseSkillImportQueueOutcome(queue: EnterpriseSkillImportQueue): EnterpriseSkillImportOutcome {
  if (queue.items.length === 0) return { kind: 'idle' }
  if (!enterpriseSkillImportQueueClosable(queue)) return { kind: 'running' }
  const { failed, total } = enterpriseSkillImportQueueCounts(queue)
  if (failed === 0) {
    const toast = enterpriseSkillImportQueueToast(queue)
    return toast === undefined ? { kind: 'nothing' } : { kind: 'success', toast }
  }
  // ★「全部预失败 ⇒ 直接返回不干活」：一个字节都没发出去时，逐项行已经把每一份为什么不行说清楚了，
  //   再顶一条摘要句就是重复；而"跑了一圈但都失败"（`attempted > 0`）照常出摘要句。
  if (queue.attempted === 0 && failed === total) return { kind: 'nothing' }
  const summary = enterpriseSkillImportQueueSummary(queue)
  return summary === undefined ? { kind: 'failed' } : { kind: 'partial', summary }
}

/**
 * 全成功那一句 toast（纯投影）。
 *
 * ★**单项成功复用既有那句**（`enterpriseSkillImportNotice` 的 `done`，含"清单读不到"时那半句如实的交代）
 *   —— 成功文案在本仓仍然只有一处实现，队列不新写第二句。
 * ★多项全成功时，动词仍复用既有那枚 `ENTERPRISE_SKILL_IMPORT_DONE`，只换成数量（Cherry 的
 *   `batchInstallComplete` 同判）；**不**把 N 个技能名拼进 toast（那会撑爆一行通知）。
 */
export function enterpriseSkillImportQueueToast(queue: EnterpriseSkillImportQueue): string | undefined {
  const succeeded = queue.items.filter(item => item.status === 'success')
  const first = succeeded[0]
  if (first === undefined) return undefined
  if (queue.items.length === 1) {
    const notice = enterpriseSkillImportNotice({
      kind: 'done',
      name: first.name,
      bytes: first.bytes,
      names: first.names ?? [],
      listed: first.listed === true,
    })
    // 入参是 `done` 那一支，故这里按 `kind` 收窄一次（函数返回的是三态联合）。
    return notice.kind === 'done' ? notice.text : undefined
  }
  return `${ENTERPRISE_SKILL_IMPORT_DONE}${succeeded.length}${ENTERPRISE_SKILL_IMPORT_BATCH_SUFFIX}`
}
