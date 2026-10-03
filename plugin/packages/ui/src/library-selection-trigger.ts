/**
 * [INPUT]: 只依赖 library-panel 的目录行类型 `EnterpriseLibraryItem` 与本包 `library-selection.js` 的 store；**不 import 任何 `@deepseek-ai/*`**（input-trigger 不在本包依赖里，故按契约写结构镜像的窄类型），不依赖 React、不发网络请求
 * [OUTPUT]: 官方输入框 `@` 触发器的**资料库源**——常量（`ENTERPRISE_LIBRARY_TRIGGER_CHAR`/`NAME`/`ORDER`/`LABEL`/`SELECTED_HINT`/`EMPTY`/`LIMIT`）、窄类型（候选 `EnterpriseLibraryTriggerCandidate`、会话投影 `EnterpriseLibraryTriggerSession`、请求 `EnterpriseLibraryTriggerRequest`、拾取 `EnterpriseLibraryTriggerPick`、结局 `EnterpriseLibraryTriggerOutcome`、源 `EnterpriseLibraryTriggerSource`）、纯函数 `enterpriseLibraryTriggerCandidates`（目录行 → 候选，含过滤/排序/上限）与 `enterpriseLibraryTriggerInsertion`（草稿 + 插入点 → 该插入 `'@'` 还是 `' @'`），以及工厂 `createEnterpriseLibraryTriggerSource`
 * [POS]: 「把资料加入当前对话」的**产生入口**（方案 §2.5 的 ⑤-4，逐字照 0.2.0-rc.2 的 `InputTriggerSource`）。三条刻意的取舍：① `onPick` 是**同步**契约（官方 `settle()` 直接拿返回值），故写集合只能 fire-and-forget——写失败由 store 的快照与留痕承担，界面上体现为那条"读不到"的提示，绝不在这里 await 出一个假成功；② 拾取后返回 `{text:''}`：官方把 `@查询` 那段 span **原地换成空串**（`slash/input-insert-text`），于是草稿里不留一个既不是路径也不是引用的孤儿 token；③ 候选**不排除已选的**——再点一次就是取消（与 store.toggle 的语义同一条），已选那些在行上标 `已在当前对话`。④ 取候选失败**原样抛**给官方管线（不留痕成空列表——那正是本仓机械门禁禁止的"静默吞失败"），代价如实记在 `candidates` 的注释里：官方菜单对失败组没有可见失败行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseLibraryItem } from './library-panel.js'
import type { EnterpriseLibrarySelectionStore } from './library-selection.js'

/** 触发器字符（官方只认 `/` 与 `@` 两个）。 */
export const ENTERPRISE_LIBRARY_TRIGGER_CHAR = '@'

/** 源的组名（官方按 `trigger/name` 去重：重名注册会抛）。 */
export const ENTERPRISE_LIBRARY_TRIGGER_NAME = 'dshent-library'

/**
 * 组内排序：官方既有的 `@` 源（文件那一个）默认 0，资料库排在它后面。
 * 与方案 §2.5 里 workdsh 的 `order:30` 同值（它当时也是这么排的）。
 */
export const ENTERPRISE_LIBRARY_TRIGGER_ORDER = 30

/** 组的可见标题（`showGroupTitle:false` 时不用它，保留给未来的分组视图与测试取证）。 */
export const ENTERPRISE_LIBRARY_TRIGGER_LABEL = '资料库'

/** 已在当前对话里的那一行给的状态提示。 */
export const ENTERPRISE_LIBRARY_TRIGGER_SELECTED_HINT = '已在当前对话'

/** 候选数量的上限（与 `search` 端点的 50 条同一量级；超出的部分由用户继续打字收窄）。 */
export const ENTERPRISE_LIBRARY_TRIGGER_LIMIT = 50

/** 一条候选：字段名与官方 `InputTriggerCandidate` 逐字同形（本包不 import 那个包）。 */
export interface EnterpriseLibraryTriggerCandidate {
  readonly name: string
  readonly label?: string | undefined
  readonly description?: string | undefined
  readonly icon?: 'file' | 'folder' | 'session' | undefined
  readonly hint?: string | undefined
  readonly value?: string | undefined
}

/** 官方每次回调给源的会话投影（**这就是取会话 id 的正规口子**：`ClientSessionContext.sessionId`）。 */
export interface EnterpriseLibraryTriggerSession {
  readonly sessionId: unknown
}

/** 取候选时的请求（只用得到查询串与取消信号）。 */
export interface EnterpriseLibraryTriggerRequest {
  readonly query: string
  readonly signal: AbortSignal
}

/** 一次拾取（本层只需要候选与会话）。 */
export interface EnterpriseLibraryTriggerPick {
  readonly candidate: EnterpriseLibraryTriggerCandidate
  readonly session: EnterpriseLibraryTriggerSession
}

/**
 * 拾取结局。
 *
 * `{text:''}` = 把 `@查询` 那段原地换成空串（官方 `slash/input-insert-text`）；`undefined` = 不认这次拾取。
 */
export type EnterpriseLibraryTriggerOutcome = { readonly text: string } | 'handled' | undefined

/** 官方 `InputTriggerSource` 的窄类型镜像（只声明本层真用到的成员）。 */
export interface EnterpriseLibraryTriggerSource {
  readonly trigger: string
  readonly name: string
  readonly order: number
  readonly showGroupTitle: boolean
  candidates(session: EnterpriseLibraryTriggerSession, req: EnterpriseLibraryTriggerRequest): Promise<readonly EnterpriseLibraryTriggerCandidate[]>
  onPick(pick: EnterpriseLibraryTriggerPick): EnterpriseLibraryTriggerOutcome
}

/**
 * 目录行 → 候选（**纯函数**）。
 *
 * 三条口径：① 只要**文件**行、且**未停用**（停用的资料 Host 侧就在选中集合里剔了，摆出来只会让人点了个空）；
 * ② 查询串按 `zh-CN` 大小写无关的子串匹配（不 trim 查询：用户打的空格是他自己的事，Host 的 search 也照原样收）；
 * ③ 上限 `ENTERPRISE_LIBRARY_TRIGGER_LIMIT`，顺序**保持目录树先序**（同一份资料每次出现在同一个位置）。
 *
 * @param items - `enterpriseLibraryItems(space)` 的树行。
 * @param query - `@` 之后到光标之间的原文。
 * @param selectedNodeIds - 该会话当前已选的节点 id（只为给出行上的"已在当前对话"）。
 * @returns 候选（可能为空）。
 */
export function enterpriseLibraryTriggerCandidates(
  items: readonly EnterpriseLibraryItem[],
  query: string,
  selectedNodeIds: readonly string[],
): readonly EnterpriseLibraryTriggerCandidate[] {
  const needle = query.toLowerCase()
  const selected = new Set(selectedNodeIds)
  const candidates: EnterpriseLibraryTriggerCandidate[] = []
  for (const item of items) {
    if (item.kind !== 'asset') continue
    if (item.status === 'disabled') continue
    if (needle.length > 0 && !item.title.toLowerCase().includes(needle)) continue
    candidates.push({
      name: item.title,
      label: item.title,
      description: ENTERPRISE_LIBRARY_TRIGGER_LABEL,
      icon: 'file',
      value: item.id,
      ...(selected.has(item.id) ? { hint: ENTERPRISE_LIBRARY_TRIGGER_SELECTED_HINT } : {}),
    })
    if (candidates.length >= ENTERPRISE_LIBRARY_TRIGGER_LIMIT) break
  }
  return candidates
}

/**
 * 点「@ 资料库」按钮时，往草稿里插什么（**纯函数**，可直测）。
 *
 * 为什么不是恒插 `'@'`：官方 `detectTrigger` 的 `@` 只认"行首或空白之后"
 * （`/(?:^|\s)(@([^\s]*))$/u`）——紧贴在字后面的 `@` 根本不会打开菜单，按钮就成了死键。
 * 故插入点前面还有非空白字符时必须补一个空格；插入点在 0（草稿为空，或光标在最前）就直接插 `'@'`，
 * 不凭空给用户加一个前导空格。
 *
 * @param draft - 当前草稿（`InputState.draft`，即剪贴板投影）。
 * @param start - 插入点在草稿里的偏移（官方 `captureInsertion()` 的 `span.start`）。
 * @returns 要插进草稿的字符串（恒为 `'@'` 或 `' @'`）。
 */
export function enterpriseLibraryTriggerInsertion(draft: string, start: number): string {
  if (start <= 0) return ENTERPRISE_LIBRARY_TRIGGER_CHAR
  const previous = draft.slice(0, start)
  return /\s$/u.test(previous) ? ENTERPRISE_LIBRARY_TRIGGER_CHAR : ` ${ENTERPRISE_LIBRARY_TRIGGER_CHAR}`
}

/**
 * 建 `@` 触发器的资料库源。
 *
 * @param deps.store - 选中集合 store（拾取时写它）。
 * @param deps.loadCatalog - 目录取数（与页面同一份 `space` 投影；信号由官方在每次取候选时给）。
 * @param deps.warn - 留痕（取目录失败时用；**不**把失败翻成"资料库是空的"）。
 * @returns 官方 `InputTriggerSource`（由 `ctx.inputTriggers.registerSource` 注册）。
 */
export function createEnterpriseLibraryTriggerSource(deps: {
  readonly store: EnterpriseLibrarySelectionStore
  readonly loadCatalog: (signal: AbortSignal) => Promise<readonly EnterpriseLibraryItem[]>
  readonly warn: (message: string, error?: unknown) => void
}): EnterpriseLibraryTriggerSource {
  return {
    trigger: ENTERPRISE_LIBRARY_TRIGGER_CHAR,
    name: ENTERPRISE_LIBRARY_TRIGGER_NAME,
    order: ENTERPRISE_LIBRARY_TRIGGER_ORDER,
    // 组标题不出：这一组就是"资料库"，多一行标题只占地方（与 workdsh 的 `showGroupTitle:false` 同口径）。
    showGroupTitle: false,

    candidates: async (session, req) => {
      const sessionId = session.sessionId === undefined || session.sessionId === null ? undefined : String(session.sessionId)
      try {
        const items = await deps.loadCatalog(req.signal)
        if (req.signal.aborted) return []
        const selected = sessionId === undefined ? [] : deps.store.getSnapshot(sessionId).nodeIds
        return enterpriseLibraryTriggerCandidates(items, req.query, selected)
      } catch (error) {
        // 取目录失败**原样抛**（本仓硬口径：catch 里返回 `[]` 就是把失败写成"没有数据"，机械门禁直接判红）。
        // 官方管线接住这个 rejection 会把这一组标成 failed 并打一条 console.error；我们的留痕在这里。
        // 取消（换查询/关菜单时官方会 abort）不当作失败，故不记。
        // 如实记：官方 `@` 菜单对 failed 组**没有可见失败行**（它把该组从菜单移除），用户侧只看到菜单收起；
        // 真正可见的失败态在"本轮已加入的资料"那条（读不到 + 稳定码 + 重试）。
        if (!req.signal.aborted) deps.warn('owndsh: library trigger candidates could not be loaded', error)
        throw error
      }
    },

    onPick: pick => {
      const nodeId = pick.candidate.value
      const sessionId = pick.session.sessionId
      if (nodeId === undefined || nodeId.length === 0) return undefined
      if (sessionId === undefined || sessionId === null) return undefined
      // 官方 `onPick` 是同步契约：写集合只能 fire-and-forget（store 自己收失败码并留痕）。
      void deps.store.toggle(String(sessionId), nodeId)
      // 清掉草稿里的 `@查询`：它既不是工作区路径也不是引用，留着就是一句会让模型误读的孤儿文本。
      return { text: '' }
    },
  }
}
