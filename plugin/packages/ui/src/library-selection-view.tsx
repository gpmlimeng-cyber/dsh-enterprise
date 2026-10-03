/**
 * [INPUT]: 依赖 React（useCallback/useEffect/useSyncExternalStore）、官方 ui-primitives 的 Button、本包 `library-selection.js` 的快照与文案常量、`library-selection-trigger.js` 的 `enterpriseLibraryTriggerInsertion`；不 import 官方 input-trigger / conversation 包（本包依赖里没有，故按契约写窄类型）
 * [OUTPUT]: 两处**真实座位**的占用者与注册选项工厂——① `conversation.input.dock` 的「本轮已加入的资料」条（纯呈现 `EnterpriseLibrarySelectionView` + 订阅壳 `EnterpriseLibrarySelectionDock` + `enterpriseLibrarySelectionDockOptions`）：可见、可逐份移除、可清空、失败可重试；② `conversation.input.left` 的「@ 资料库」按钮（纯呈现 `EnterpriseLibraryTriggerButtonView` + 取草稿壳 `EnterpriseLibraryTriggerButton` + `enterpriseLibraryTriggerButtonOptions`）：点它把 `@` 送进输入框，官方菜单随即带出资料库候选
 * [POS]: 资料库 P1-A 的**界面落点**（方案 §2.5 的 ⑤-4b 与"已选可见可移除"）。三条硬口径：① **未选中就什么都不渲染**（快照空/未读 ⇒ `null`），既有输入区一个节点都不变——「不改既有输入区行为」是这条座位的第一约束；② 两枚组件的**纯呈现**与**订阅壳**分开（本仓 vitest 无 DOM，纯函数直调是既有手法，见 `library-panel.tsx` 的 View/Host 分法）；③ 移除走 store 的**覆盖写完整集合**，不是本地删一格（Host 才是真源）；失败一律出可见说明 + 重试，绝不显示成"没有资料"
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import { createElement, useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  ENTERPRISE_LIBRARY_SELECTION_EMPTY,
  ENTERPRISE_LIBRARY_SELECTION_FAILED,
  ENTERPRISE_LIBRARY_SELECTION_REMOVE_PREFIX,
  ENTERPRISE_LIBRARY_SELECTION_RETRY,
  ENTERPRISE_LIBRARY_SELECTION_TITLE,
  type EnterpriseLibrarySelectionSnapshot,
  type EnterpriseLibrarySelectionStore,
} from './library-selection.js'
import { enterpriseLibraryTriggerInsertion } from './library-selection-trigger.js'

/** 已选条目条的 id（`conversation.input.dock` 是 list 槽，id 必须自造且唯一）。 */
export const ENTERPRISE_LIBRARY_SELECTION_DOCK_ID = 'dshent-library-selection'

/** 已选条目条在 dock 里的排序（官方既有三格是 queue/todo/goal，goal=10 ⇒ 我们排它们之后）。 */
export const ENTERPRISE_LIBRARY_SELECTION_DOCK_ORDER = 30

/** 「全部移除」的可见文案（清空整条集合，走同一条覆盖写）。 */
export const ENTERPRISE_LIBRARY_SELECTION_CLEAR = '全部移除'

/** `conversation.input.left` 那枚按钮的 id。 */
export const ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ID = 'dshent-library-trigger'

/** 按钮在输入框左侧工具行里的排序。 */
export const ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ORDER = 30

/** 按钮的可见文案（用户一眼知道点它是把资料加进这一轮）。 */
export const ENTERPRISE_LIBRARY_TRIGGER_BUTTON_LABEL = '@ 资料库'

/** 按钮的无障碍名（可见文案只是符号化的 `@`，读屏需要一句人话）。 */
export const ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ARIA = '把资料加入当前对话'

/** 已选条目条里那一行说明的可见文案。 */
export const ENTERPRISE_LIBRARY_SELECTION_HINT = '这些资料会随本轮提问一起交给模型。'

/** 已选条目条的**纯呈现**（无 hook，测试直调；文案与结构都由这里定）。 */
export interface EnterpriseLibrarySelectionViewProps {
  readonly snapshot: EnterpriseLibrarySelectionSnapshot
  readonly onRemove: (nodeId: string) => void
  readonly onClear: () => void
  readonly onRetry: () => void
}

/**
 * 渲染已选条目条。
 *
 * 三态各自诚实：**失败**出一行说明 + 能点动的重试（绝不说"没有资料"）；**没有条目**返回 `null`
 * （未选中 ⇒ 输入区一个节点都不多）；有条目则逐份出名称 + 一枚带无障碍名的移除按钮，并给一枚「全部移除」。
 */
export function EnterpriseLibrarySelectionView(props: EnterpriseLibrarySelectionViewProps): ReactNode {
  const { snapshot } = props
  if (snapshot.status === 'failed') {
    return createElement(
      'div',
      { role: 'status', style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', lineHeight: '18px' } },
      createElement('span', null, `${ENTERPRISE_LIBRARY_SELECTION_FAILED}（${snapshot.code ?? 'ENT_LOCAL_UNAVAILABLE'}）`),
      createElement(
        Button,
        { size: 'sm', ['aria-label' as string]: ENTERPRISE_LIBRARY_SELECTION_RETRY, onClick: props.onRetry },
        ENTERPRISE_LIBRARY_SELECTION_RETRY,
      ),
    )
  }
  if (snapshot.items.length === 0) return null
  return createElement(
    'div',
    {
      role: 'group',
      'aria-label': ENTERPRISE_LIBRARY_SELECTION_TITLE,
      style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '12px', lineHeight: '18px' },
    },
    createElement('span', null, `${ENTERPRISE_LIBRARY_SELECTION_TITLE}（${snapshot.items.length}）`),
    ...snapshot.items.map(item => createElement(
      'span',
      { key: item.nodeId, style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
      createElement('span', null, item.name),
      createElement(
        Button,
        {
          size: 'sm',
          ['aria-label' as string]: `${ENTERPRISE_LIBRARY_SELECTION_REMOVE_PREFIX}${item.name}`,
          ['data-enterprise-library-selection-remove' as string]: item.nodeId,
          onClick: () => { props.onRemove(item.nodeId) },
        },
        '移除',
      ),
    )),
    createElement(
      Button,
      {
        size: 'sm',
        ['data-enterprise-library-selection-clear' as string]: ENTERPRISE_LIBRARY_SELECTION_DOCK_ID,
        onClick: props.onClear,
      },
      ENTERPRISE_LIBRARY_SELECTION_CLEAR,
    ),
  )
}

/** `conversation.input.dock` 的 inject 面（官方对 session 作用域座位把 sessionId 交给 inject）。 */
export interface EnterpriseLibrarySelectionDockProps {
  readonly sessionId?: string | undefined
  readonly selection?: EnterpriseLibrarySelectionStore | undefined
}

/**
 * 已选条目条的**订阅壳**（`conversation.input.dock` 的占用者）。
 *
 * 订阅按会话分键（`useSyncExternalStore`），挂载时 `ensure` 一次——这就是"新会话 ⇒ 问一次 Host 它选了什么"
 * 的唯一时点；Host 里没有这条记录，答案是空集合，于是新会话天然是空的。缺失 inject（本机没接线）时渲染 `null`。
 */
export function EnterpriseLibrarySelectionDock(props: EnterpriseLibrarySelectionDockProps): ReactNode {
  const sessionId = props.sessionId
  const store = props.selection
  const subscribe = useCallback(
    (listener: () => void) => (sessionId === undefined || store === undefined ? () => undefined : store.subscribe(sessionId, listener)),
    [sessionId, store],
  )
  const getSnapshot = useCallback(
    () => (sessionId === undefined || store === undefined ? ENTERPRISE_LIBRARY_SELECTION_EMPTY : store.getSnapshot(sessionId)),
    [sessionId, store],
  )
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => {
    if (sessionId === undefined || store === undefined) return
    store.ensure(sessionId)
  }, [sessionId, store])
  if (sessionId === undefined || store === undefined) return null
  return EnterpriseLibrarySelectionView({
    snapshot,
    onRemove: nodeId => { void store.remove(sessionId, nodeId) },
    onClear: () => { void store.clear(sessionId) },
    onRetry: () => { void store.refresh(sessionId) },
  })
}

/**
 * `conversation.input.dock` 的注册选项。
 *
 * `inject` 的面里带 `sessionId`：官方对 `scope:'session'` 的座位以 `inject(sessionId)` 调用，
 * 这就是界面侧**正规**拿到当前会话 id 的口子（不需要去反解任何不透明的 scope）。
 *
 * @param store - 选中集合 store（与触发器源共用同一个实例）。
 * @returns 注册选项（type-erased，与 `library-entry.tsx` 的选项工厂同一手法）。
 */
export function enterpriseLibrarySelectionDockOptions(
  store: EnterpriseLibrarySelectionStore,
): Readonly<Record<string, unknown>> {
  return {
    name: 'conversation.input.dock',
    id: ENTERPRISE_LIBRARY_SELECTION_DOCK_ID,
    order: ENTERPRISE_LIBRARY_SELECTION_DOCK_ORDER,
    inject: (sessionId: unknown) => ({
      sessionId: sessionId === undefined || sessionId === null ? undefined : String(sessionId),
      selection: store,
    }),
  }
}

/** `@ 资料库` 按钮的**纯呈现**（无 hook）。 */
export interface EnterpriseLibraryTriggerButtonViewProps {
  readonly disabled: boolean
  readonly onOpen: () => void
}

/** 渲染按钮；`disabled`（拿不到官方输入动作时）出真禁用态，不给死按钮。 */
export function EnterpriseLibraryTriggerButtonView(props: EnterpriseLibraryTriggerButtonViewProps): ReactNode {
  return createElement(
    Button,
    {
      size: 'sm',
      disabled: props.disabled,
      'aria-label': ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ARIA,
      ['data-enterprise-library-trigger' as string]: ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ID,
      onClick: props.onOpen,
    },
    ENTERPRISE_LIBRARY_TRIGGER_BUTTON_LABEL,
  )
}

/** 官方输入面板的窄类型（`conversation.input.left` 的标准 props 里就是这两件）。 */
export interface EnterpriseLibraryTriggerInputActions {
  captureInsertion(): { readonly start: number }
  insertText(text: string, span: unknown): boolean
}

/** `@ 资料库` 按钮的 props：官方标准 props 里的 `useInput`（读草稿）+ `inputActions`（往草稿里插）。 */
export interface EnterpriseLibraryTriggerButtonProps {
  readonly inputActions?: EnterpriseLibraryTriggerInputActions | undefined
  readonly useInput: (selector: (state: { readonly draft: string }) => string) => string
}

/**
 * `@ 资料库` 按钮的**取草稿壳**（`conversation.input.left` 的占用者）。
 *
 * 为什么先读草稿再插：官方 `@` 只认"行首或空白之后"的 `@`（`detectTrigger` 的 `/(?:^|\s)(@([^\s]*))$/u`），
 * 而按钮点下去时插入点前面很可能是个字——那就必须补一个空格，否则按钮按了菜单不出来（详见
 * `enterpriseLibraryTriggerInsertion`）。**走 `insertText` 而不是 `setDraft`**：`setDraft` 是整份草稿替换，
 * 而 `InputState.draft` 是剪贴板投影（引用芯片已被展开成文本）——那样会把用户已有的引用芯片压平，
 * 属于"改了既有输入区行为"；`insertText` 只在插入点落一次编辑，别处一个节点都不动。
 *
 * `useInput` 是 `conversation.input.left` 声明的标准 props（官方 slot 目录里逐字有），故这里按必填读。
 */
export function EnterpriseLibraryTriggerButton(props: EnterpriseLibraryTriggerButtonProps): ReactNode {
  const draft = props.useInput(state => state.draft)
  const actions = props.inputActions
  return EnterpriseLibraryTriggerButtonView({
    disabled: actions === undefined,
    onOpen: () => {
      if (actions === undefined) return
      const span = actions.captureInsertion()
      actions.insertText(enterpriseLibraryTriggerInsertion(draft, span.start), span)
    },
  })
}

/** `conversation.input.left` 的注册选项（list 槽：只需 id / order / label）。 */
export function enterpriseLibraryTriggerButtonOptions(): Readonly<Record<string, unknown>> {
  return {
    name: 'conversation.input.left',
    id: ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ID,
    order: ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ORDER,
    label: ENTERPRISE_LIBRARY_TRIGGER_BUTTON_LABEL,
  }
}
