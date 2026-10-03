/**
 * [INPUT]: 只依赖 local-api-decode 的会话选中集合 DTO 与 `enterpriseLocalErrorCode`、local-api 的 `EnterpriseLocalApi` 两条方法（读 `libraryTaskSelection` / 写 `librarySetTaskSelection`）；不依赖 React、不依赖任何宿主面、不发网络请求（网络全在注入的 api 端口后面）
 * [OUTPUT]: 「把资料加入当前对话」的**唯一状态真源**——非 React 薄外部 store `createEnterpriseLibrarySelectionStore`（按会话分键：`getSnapshot`/`subscribe`/`ensure`/`refresh`/`toggle`/`remove`/`clear`）、快照类型 `EnterpriseLibrarySelectionSnapshot` 与四态联合、稳定空快照 `ENTERPRISE_LIBRARY_SELECTION_EMPTY`，以及文案常量 `ENTERPRISE_LIBRARY_SELECTION_TITLE` / `ENTERPRISE_LIBRARY_SELECTION_REMOVE_PREFIX` / `ENTERPRISE_LIBRARY_SELECTION_FAILED` / `ENTERPRISE_LIBRARY_SELECTION_RETRY`
 * [POS]: 资料库 P1-A 的**写侧收束点**：宿主早已有 `set-task-selection`（覆盖式完整集合）与 `task-selection`（物化条目），缺的只是"谁在什么时候去写它"。本文件把「点击 ⇒ 下一次完整集合」算清楚并只发两条请求（写 + 紧接着读），界面只读快照。三条硬口径：① **绝不用未知状态去写**——当前集合没读成功过就先读，读不到就一个字节都不写（否则一次点击会把用户原先选的一堆资料覆盖成一份）；② 写回执**不含条目**，故写完必须再读一次，条目只认读的结果（Host 读侧已把停用/已删的节点剔掉，界面因此不见"选了但读不出来"的悬空项）；③ 新会话 = 从未写过记录 = 空集合（合法态，不是错误），失败一律留稳定码并保留重试，绝不静默吞成空
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseLibrarySelectionItem } from './library-api-decode.js'
import { enterpriseLocalErrorCode, type EnterpriseLocalApi } from './local-api.js'

/** 空集合那一段的标题（可见文案）。 */
export const ENTERPRISE_LIBRARY_SELECTION_TITLE = '本轮已加入的资料'

/** 移除按钮的可见名后缀（无障碍名 = 前缀 + 资料名，读屏能听出移除的是哪一份）。 */
export const ENTERPRISE_LIBRARY_SELECTION_REMOVE_PREFIX = '从本轮移除：'

/** 读不到时的可见说明（**不**说"没有资料"——那是在替 Host 撒谎）。 */
export const ENTERPRISE_LIBRARY_SELECTION_FAILED = '本轮已加入的资料暂时读不到，请重试。'

/** 失败后的重试动作文案。 */
export const ENTERPRISE_LIBRARY_SELECTION_RETRY = '重试'

/** 选中集合的四态（`idle` = 这个会话还一次都没读过；`ready` 可以是空集合）。 */
export type EnterpriseLibrarySelectionStatus = 'idle' | 'loading' | 'ready' | 'failed'

/** 一个会话的选中集合快照（**引用稳定**：没变化时 `getSnapshot` 返回同一个对象，供 `useSyncExternalStore` 判等）。 */
export interface EnterpriseLibrarySelectionSnapshot {
  readonly status: EnterpriseLibrarySelectionStatus
  /** Host 物化后的条目（**只有它用于渲染**；停用 / 已删的节点不在这里面）。 */
  readonly items: readonly EnterpriseLibrarySelectionItem[]
  /**
   * 写回时用的集合（= Host 读投影里那条 `nodeIds`，与 `items` 同源）。
   *
   * **注意**：它不是 Host 选中记录里的原始 id 清单。Host 的 `task-selection` 按 `items.map(item => item.nodeId)`
   * 出这个键，故停用 / 已删的节点在这里**也不会出现**（它们只在记录里躺着，不再产出任何东西）。
   * 界面据此写回的集合天然不含悬空 id。
   */
  readonly nodeIds: readonly string[]
  /** 失败稳定码（只有 `failed` 时非空）。 */
  readonly code: string | undefined
}

/**
 * 稳定空快照：**同一个对象**给所有还没读过的会话用。
 *
 * 为什么必须是常量：`useSyncExternalStore` 用 `Object.is` 判"变没变"，每次新建对象会让订阅者
 * 陷入无限重渲染。`idle` 与"读到了空集合"（`ready` + `[]`）**刻意分开**——前者是"还没问过 Host"，
 * 后者是"Host 说这个会话什么都没选"。
 */
export const ENTERPRISE_LIBRARY_SELECTION_EMPTY: EnterpriseLibrarySelectionSnapshot = Object.freeze({
  status: 'idle',
  items: Object.freeze([]) as readonly EnterpriseLibrarySelectionItem[],
  nodeIds: Object.freeze([]) as readonly string[],
  code: undefined,
})

/** 本层用到的两条同源方法（从 `EnterpriseLocalApi` 取，形状不可能漂移）。 */
export type EnterpriseLibrarySelectionApi =
  Pick<EnterpriseLocalApi, 'libraryTaskSelection' | 'librarySetTaskSelection'>

/** 存储端口（与 `library-panel` 的 `EnterpriseLibrarySource` 同一手法：非 React，测试可直调）。 */
export interface EnterpriseLibrarySelectionStore {
  /** 读某个会话的快照；从未读过 ⇒ 稳定的空快照。 */
  getSnapshot(sessionId: string): EnterpriseLibrarySelectionSnapshot
  /** 订阅某个会话（返回退订器）。 */
  subscribe(sessionId: string, listener: () => void): () => void
  /**
   * 首次挂载时读一次（幂等：已经读过或正在读就不重复发）。
   *
   * 为什么要有它：会话作用域的座位每次切会话都会挂一次，这里就是"新会话 ⇒ 问一次 Host 它选了什么"的
   * 唯一入口——新会话的答案必然是一条空集合（Host 里根本没有这条记录），故"新会话为空"是**读**出来的，不是本地假定的。
   */
  ensure(sessionId: string): void
  /** 强制重读（失败后的重试、以及需要跟 Host 对齐时用）。 */
  refresh(sessionId: string): Promise<void>
  /** 点一份资料：已在集合里就移除，不在就加入（一次点击 = 一次完整集合的覆盖写）。 */
  toggle(sessionId: string, nodeId: string): Promise<void>
  /** 移除一份资料（不存在就是无操作，不报错）。 */
  remove(sessionId: string, nodeId: string): Promise<void>
  /** 清空该会话的集合（写一条空集合；"清空"是同一条覆盖写路径，不是第三条 endpoint）。 */
  clear(sessionId: string): Promise<void>
  /** 退订所有订阅者并中止在途请求（插件卸载）。 */
  dispose(): void
}

interface SessionState {
  snapshot: EnterpriseLibrarySelectionSnapshot
  readonly listeners: Set<() => void>
  controller: AbortController | undefined
}

/**
 * 建选中集合 store。
 *
 * @param deps.api - 两条同源方法（读 / 写完整集合）。
 * @param deps.warn - 留痕（绝不改变任何界面语义）。
 * @returns 见 `EnterpriseLibrarySelectionStore`。
 */
export function createEnterpriseLibrarySelectionStore(deps: {
  readonly api: EnterpriseLibrarySelectionApi
  readonly warn: (message: string, error?: unknown) => void
}): EnterpriseLibrarySelectionStore {
  const sessions = new Map<string, SessionState>()
  let disposed = false

  const stateOf = (sessionId: string): SessionState => {
    const existing = sessions.get(sessionId)
    if (existing !== undefined) return existing
    const created: SessionState = {
      snapshot: ENTERPRISE_LIBRARY_SELECTION_EMPTY,
      listeners: new Set(),
      controller: undefined,
    }
    sessions.set(sessionId, created)
    return created
  }

  const publish = (state: SessionState, next: EnterpriseLibrarySelectionSnapshot): void => {
    if (next === state.snapshot) return
    state.snapshot = next
    for (const listener of [...state.listeners]) listener()
  }

  /** 一次会话操作的公共壳：独占该会话的在途请求（后发先至一律作废），结束时不复活已卸载的 store。 */
  const run = async <T>(sessionId: string, task: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
    const state = stateOf(sessionId)
    state.controller?.abort()
    const controller = new AbortController()
    state.controller = controller
    try {
      const result = await task(controller.signal)
      if (controller.signal.aborted || disposed) return undefined
      return result
    } catch (error) {
      if (controller.signal.aborted || disposed) return undefined
      publish(state, {
        status: 'failed',
        // 失败时**不保留**旧条目：界面宁可知情地空着，也不拿一份可能已经过期的清单冒充现状。
        items: Object.freeze([]) as readonly EnterpriseLibrarySelectionItem[],
        nodeIds: state.snapshot.nodeIds,
        code: enterpriseLocalErrorCode(error),
      })
      deps.warn('owndsh: library selection request failed', error)
      return undefined
    } finally {
      if (state.controller === controller) state.controller = undefined
    }
  }

  /** 读一次并落地；返回是否读成功（写路径据此决定"敢不敢写"）。 */
  const read = async (sessionId: string, signal: AbortSignal): Promise<boolean> => {
    const state = stateOf(sessionId)
    publish(state, {
      status: 'loading',
      items: state.snapshot.items,
      nodeIds: state.snapshot.nodeIds,
      code: undefined,
    })
    const view = await deps.api.libraryTaskSelection(sessionId, signal)
    publish(state, {
      status: 'ready',
      items: view.items,
      nodeIds: view.nodeIds,
      code: undefined,
    })
    return true
  }

  /**
   * 算下一次要写的完整集合。
   *
   * **绝不用未知状态去写**：只有当前快照是 `ready` 才拿它当底；否则先读一次（Host 是唯一真源）。
   * 读不出来 ⇒ 返回 `undefined`，调用方一个字节都不写——一次"加入一份"的点击绝不会把用户原先
   * 选的一堆资料覆盖掉。
   */
  const baseNodeIds = async (sessionId: string, signal: AbortSignal): Promise<readonly string[] | undefined> => {
    const state = stateOf(sessionId)
    if (state.snapshot.status === 'ready') return state.snapshot.nodeIds
    try {
      await read(sessionId, signal)
    } catch (error) {
      deps.warn('owndsh: library selection could not be read before writing', error)
      throw error
    }
    // 重新取一次快照：`read` 刚刚把它换成了别的对象（上面的读法保留的是 await 之前的收窄，不能用）。
    const after = stateOf(sessionId).snapshot
    return after.status === 'ready' ? after.nodeIds : undefined
  }

  /** 覆盖写 + 紧接一次读（写回执不含条目，条目只认读）。**必须在 `run` 的 task 里调**，自己不再入队。 */
  const write = async (sessionId: string, signal: AbortSignal, next: readonly string[]): Promise<void> => {
    await deps.api.librarySetTaskSelection(sessionId, next, signal)
    await read(sessionId, signal)
  }

  return {
    getSnapshot: sessionId => sessions.get(sessionId)?.snapshot ?? ENTERPRISE_LIBRARY_SELECTION_EMPTY,

    subscribe: (sessionId, listener) => {
      const state = stateOf(sessionId)
      state.listeners.add(listener)
      return () => {
        state.listeners.delete(listener)
      }
    },

    ensure: sessionId => {
      if (disposed) return
      const state = stateOf(sessionId)
      if (state.snapshot.status !== 'idle') return
      void run(sessionId, signal => read(sessionId, signal))
    },

    refresh: async sessionId => {
      if (disposed) return
      await run(sessionId, signal => read(sessionId, signal))
    },

    toggle: async (sessionId, nodeId) => {
      if (disposed) return
      await run(sessionId, async signal => {
        const base = await baseNodeIds(sessionId, signal)
        if (base === undefined) return
        const next = base.includes(nodeId) ? base.filter(id => id !== nodeId) : [...base, nodeId]
        await write(sessionId, signal, next)
      })
    },

    remove: async (sessionId, nodeId) => {
      if (disposed) return
      await run(sessionId, async signal => {
        const base = await baseNodeIds(sessionId, signal)
        if (base === undefined) return
        if (!base.includes(nodeId)) return
        await write(sessionId, signal, base.filter(id => id !== nodeId))
      })
    },

    clear: async sessionId => {
      if (disposed) return
      await run(sessionId, signal => write(sessionId, signal, []))
    },

    dispose: () => {
      disposed = true
      for (const state of sessions.values()) {
        state.controller?.abort()
        state.controller = undefined
        state.listeners.clear()
      }
      sessions.clear()
    },
  }
}
