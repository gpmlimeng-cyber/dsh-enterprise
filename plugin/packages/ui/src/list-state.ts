/**
 * [INPUT]: 只依赖一个注入的取数回调（`load(signal)`）与失败码投影 `enterpriseLocalErrorCode`；不依赖 React、不发请求
 * [OUTPUT]: 提供列表取数的**唯一四态投影** `EnterpriseListState`（loading / empty / ready / failed——单字段联合，故三态天然互斥）、把「点重试 = 真的重发一次请求」变成可测对象的 `createEnterpriseListSource`（含 `requests()` 请求轮次取证）、次级取数的显式降级包装 `enterpriseDegradedRead`，以及四个列表共用的重试文案常量
 * [POS]: ui「列表三态」的唯一词汇与唯一取数实现——技能目录 / 插件目录 / 配方目录 / 文件树的状态与重试语义都从这里取；各页不许再自己写「取数失败就回落空数组」这类静默默认值（那正是本刀要消灭的静默吞失败）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { enterpriseLocalErrorCode } from './local-api.js'

/**
 * 一个列表在任何时刻的**唯一**状态（四态联合体：同一时刻只可能命中一个成员，故「加载/空/失败」不可能同时出现，
 * 也不可能像 `items=[] + loading=false + errorCode=undefined` 那样出现「三者都不像」的空白态）。
 *
 * `ready` 与 `empty` 都携带取数结果：`empty` 不是「没有数据」的第二种说法，而是**取数成功且列表确实为空**——
 * 界面据此说清「为什么空」+ 下一步，绝不与失败混同（失败必须显式、必须可重试）。
 */
export type EnterpriseListState<T> =
  /** 首帧与在途都算「加载中」（含重试在途）：界面据此出骨架/轻提示，绝不空白。 */
  | { readonly kind: 'loading' }
  /** 取数成功、列表本身为空：说清「为什么空」+ 下一步。 */
  | { readonly kind: 'empty'; readonly value: T }
  /** 取数成功且有内容。 */
  | { readonly kind: 'ready'; readonly value: T }
  /** 取数失败：稳定错误码原样保留（人话与下一步由 `error-messages.ts` 的唯一映射给，界面不自造文案）。 */
  | { readonly kind: 'failed'; readonly code: string }

/** 列表失败态那枚重试按钮的文案（四个列表共用同一个词，不各写一套）。 */
export const ENTERPRISE_LIST_RETRY = '重试'
/** 重试按钮的无障碍名（读屏听到的是「做什么」，不是「重试」两个字）。 */
export const ENTERPRISE_LIST_RETRY_LABEL = '重新加载这个列表'

/** 一个列表取数源的可注入依赖：怎么取、什么算空、怎么把异常翻成稳定码。 */
export interface EnterpriseListSourceOptions<T> {
  /** 真正发请求的那一步；失败**原样抛出**（由本源收敛成 `failed` 态，而不是回落成空列表）。 */
  readonly load: (signal: AbortSignal) => Promise<T>
  /** 取数成功但「列表是空的」的判定（空 ≠ 失败）。 */
  readonly isEmpty: (value: T) => boolean
  /** 异常 → 稳定错误码（默认走唯一的失败码投影）。 */
  readonly errorCode?: ((error: unknown) => string) | undefined
}

/**
 * 一个列表取数源（非 React 的薄外部 store，形状与 `account-store`/`useAccount` 一致：`subscribe` + `getSnapshot`）。
 *
 * 为什么把它做成非 React 对象：本仓的 vitest 没有 DOM，「点重试是否真的重发了请求」这类行为只能在
 * **不依赖渲染**的地方被测到。组件只是 `useSyncExternalStore(source.subscribe, source.getSnapshot)` 的订户，
 * 重试按钮只是调 `source.retry()`——因此测试对同一个 `retry()` 数请求次数，就等价于数了那次点击。
 */
export interface EnterpriseListSource<T> {
  /** 当前状态；引用恒稳定（变了才换对象），可直接喂 `useSyncExternalStore`。 */
  readonly getSnapshot: () => EnterpriseListState<T>
  readonly subscribe: (listener: () => void) => () => void
  /** 幂等启动：已在途 / 已有结果（ready/empty）/ 已失败都不动——重试必须显式走 `retry()`。 */
  load(): void
  /** 重试：先中止在途，再**真的**重发一次请求；失败后仍可再点（状态回到 `failed` 即可再重试）。 */
  retry(): void
  /** 中止在途并回到初始 `loading`（离开页面 / 会话不可用时调用）；已发请求轮次计数保留。 */
  reset(): void
  /** 取证：本实例已发出的请求轮次（重试必须让它真的 +1）。 */
  requests(): number
}

/**
 * 建一个列表取数源。
 *
 * 三条硬口径（逐条都有 `tests/list-state.spec.ts` 的机械复核）：
 *  ① **失败不吞**：`load` 抛出的异常一定收敛成 `{kind:'failed', code}`，绝不回落成空列表；
 *  ② **重试真发**：`retry()` 一定发一条新请求（在途中点也只是「中止旧的 + 发一条新的」），`requests()` 随之 +1；
 *  ③ **迟到结果不回填**：中止（或新一轮请求）之后到达的旧结果被丢弃，状态不会被旧请求改回去。
 */
export function createEnterpriseListSource<T>(options: EnterpriseListSourceOptions<T>): EnterpriseListSource<T> {
  const code = options.errorCode ?? enterpriseLocalErrorCode
  let snapshot: EnterpriseListState<T> = { kind: 'loading' }
  let controller: AbortController | undefined
  let attempts = 0
  const listeners = new Set<() => void>()

  const emit = (next: EnterpriseListState<T>): void => {
    snapshot = next
    // 逐个复制：订阅者在回调里注销自己也不影响本轮派发。
    for (const listener of [...listeners]) listener()
  }

  const run = (): void => {
    // 中止在途：换会话 / 连点重试都只认最后一次请求的结果（迟到的旧结果不回填）。
    controller?.abort()
    const current = new AbortController()
    controller = current
    attempts += 1
    if (snapshot.kind !== 'loading') emit({ kind: 'loading' })
    void options.load(current.signal).then(
      (value) => {
        if (controller !== current || current.signal.aborted) return
        controller = undefined
        emit(options.isEmpty(value) ? { kind: 'empty', value } : { kind: 'ready', value })
      },
      (error: unknown) => {
        if (controller !== current || current.signal.aborted) return
        controller = undefined
        emit({ kind: 'failed', code: code(error) })
      },
    )
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    load: () => {
      // 幂等：初始 loading 且没有在途请求时才真正发（React 严格模式/重复 effect 不会打出两条请求）；
      // 失败后不会自动重发（要显式 retry()），避免失败态自己打转。
      if (controller !== undefined || snapshot.kind !== 'loading') return
      run()
    },
    retry: () => { run() },
    reset: () => {
      controller?.abort()
      controller = undefined
      if (snapshot.kind !== 'loading') emit({ kind: 'loading' })
    },
    requests: () => attempts,
  }
}

/**
 * **次级取数的显式降级**：主列表取数之外的可选事实（如「本机已装清单」）允许降级，
 * 但降级必须**如实交出失败码**，由界面出「降级说明 + 重试」——绝不 `catch(() => [])` 把失败变成默认值。
 *
 * @param read - 那次可选取数。
 * @param fallback - 降级时给界面的安全默认值（例如空清单；界面必须能据此如实说明「这份事实没读出来」）。
 * @returns 取到的值，或降级后的默认值 + 稳定错误码（未失败时 `code` 缺席）。
 */
export async function enterpriseDegradedRead<T>(
  read: Promise<T>,
  fallback: T,
): Promise<{ readonly value: T; readonly code?: string | undefined }> {
  try {
    return { value: await read }
  } catch (error) {
    return { value: fallback, code: enterpriseLocalErrorCode(error) }
  }
}

/** 详情取数（点开一条卡片后的那一次按需取数）的**四态**。 */
export type EnterpriseDetailState =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading' }
  /** **列表级信息**：详情这次没取到，弹窗里显示的是列表投影，必须如实说明并给重试。 */
  | { readonly kind: 'list-level'; readonly code: string }
  | { readonly kind: 'detail' }

/**
 * 由「有没有选中 + 详情是否在途 / 失败 / 已到」投影出详情该说什么（技能与配方两个详情弹窗共用同一份判定）。
 *
 * 优先级写死为**没选 → 真详情 → 详情失败（列表级信息）→ 读取中**：
 * 「详情失败」必须压过「读取中」，否则一次失败会被下一轮 loading 盖住，用户看不到失败码；
 * 而「真详情」压过「失败」是为了让重试成功后的新详情立刻生效（失败码在新一轮取数时已被清掉）。
 */
export function enterpriseDetailState(input: {
  readonly selected: boolean
  readonly loading: boolean
  readonly hasDetail: boolean
  readonly errorCode?: string | undefined
}): EnterpriseDetailState {
  if (!input.selected) return { kind: 'none' }
  if (input.hasDetail) return { kind: 'detail' }
  if (input.errorCode !== undefined) return { kind: 'list-level', code: input.errorCode }
  return { kind: 'loading' }
}

/** 详情弹窗里「你现在看到的是列表级信息」这句如实交代（技能 / 配方共用同一句，不各写一套）。 */
export const ENTERPRISE_DETAIL_LIST_LEVEL = '以下是列表里的信息，这条内容的详情暂时没有读取到。'
/** 详情取数失败提示的动作前缀。 */
export const ENTERPRISE_DETAIL_FAILED = '详情加载失败'
