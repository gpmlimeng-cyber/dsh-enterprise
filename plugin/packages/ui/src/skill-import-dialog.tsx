/**
 * [INPUT]: 依赖 React 的 createElement/Fragment/useEffect/useRef/useState（含 `DragEvent`/`ReactNode`/`RefObject` 类型）、
 *   官方原语 `Button`/`Modal`/`Toast`（与登录弹窗、卸载确认、反馈弹窗**同一枚** Modal）、lucide 的 `CircleAlert`/`CheckCircle2`/`Loader2`/`Upload`，
 *   纯事实层 `skill-import`（accept / 形态人话 / 弹窗文案 / 隐藏选择器样式）、`skill-import-queue` 的四态队列投影，
 *   以及 `skill-import-port` 的队列接线面类型与隐藏选择器样式
 * [OUTPUT]: 对外提供口径 60 的导入弹窗：`EnterpriseSkillImportDialog`（官方 Modal 外壳 + 成功 toast）、
 *   三枚**无 hook、可直调**的纯视图 `EnterpriseSkillImportView` / `EnterpriseSkillImportDropzone` /
 *   `EnterpriseSkillImportQueueList` / `EnterpriseSkillImportBatchSummary`，与它自己的排版串
 *   `ENTERPRISE_SKILL_IMPORT_DIALOG_STYLES`
 * [POS]: 「添加技能 → 上传技能」这条通路的**输入面**（用户主动发起的动作面，不是结果面/详情面）。
 *   它把口径 46 那枚**恒不可见的文件选择器**换成 Cherry `ImportSkillDialog` 那样的弹窗：
 *   拖拽区（虚线框 + 图标 + 两行提示）＋ 一枚显式「选择 ZIP 文件（多选）」按钮 ＋ 逐项状态列表 ＋ 批量摘要。
 *   ★**纯投影优先**：队列状态机 / 逐项状态迁移 / 摘要句 / "装中能否关闭"的判据**全部**住在
 *   `skill-import-queue.ts`（无 React、无 DOM、本仓 vitest 无 DOM 也能直测）；本文件只做两件事——
 *   把那些事实画出来、把用户的手势（拖入/选中/关闭）交回去。
 *   ★**照 Cherry 的哪几处**：弹窗形态（拖拽区 + 显式按钮）、串行队列 + 逐项状态、批量失败摘要、
 *   安装中禁止关闭（遮罩点击与 Esc 都拦）、成功 toast + 自动关闭。
 *   ★**没有照抄什么**：① 限额数字（Cherry 走的是**另一个数量级**——三位数 MB 与上万条目；本仓逐字用
 *   Host 侧那枚 50 MiB 预检常量，见 `skill-import.ts`）；② **目录/文件夹导入**（Cherry 的第二枚按钮 +
 *   它那次目录探测是 Electron 特性；本仓的目录导入走 Phase 2 的**宿主侧** `pickDirectory` → 就地校验 +
 *   加固拷贝，故本文件里一枚目录选择入口都没有——门禁在全 `src` 上剥注释后逐字扫 `webkitdirectory` /
 *   `webkitGetAsEntry` / `showDirectoryPicker` 这些 API 名，一个都不许出现）；
 *   ③ 「非 zip 文件当场记一条错误」那条前端格式判定——本仓的格式/结构判定**只有** Host 那一道闸门，
 *   前端再猜一遍只会让一份合法文件被它挡在门外（同 `skill-import.ts` 里那段"为什么只判尺寸"）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Modal, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { CheckCircle2, CircleAlert, Loader2, Upload } from 'lucide-react'
import { createElement, Fragment, useEffect, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react'
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_DIALOG_SUBTITLE,
  ENTERPRISE_SKILL_IMPORT_DIALOG_TITLE,
  ENTERPRISE_SKILL_IMPORT_DROP_HINT,
  ENTERPRISE_SKILL_IMPORT_FORMATS_TEXT,
  ENTERPRISE_SKILL_IMPORT_PICK_ARIA,
  ENTERPRISE_SKILL_IMPORT_PICK_LABEL,
  ENTERPRISE_SKILL_IMPORT_RESELECT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
  enterpriseSkillImportLabel,
} from './skill-import.js'
import {
  ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE,
  enterpriseSkillImportItemStatusText,
  enterpriseSkillImportQueueClosable,
  enterpriseSkillImportQueueOutcome,
  enterpriseSkillImportQueueSummary,
  type EnterpriseSkillImportItem,
  type EnterpriseSkillImportQueue,
} from './skill-import-queue.js'
import { ENTERPRISE_SKILL_IMPORT_INPUT_STYLE, type EnterpriseSkillImportQueuePort } from './skill-import-port.js'

/**
 * 弹窗自持排版（与反馈弹窗同一条：官方 Modal 给外框/键盘/遮罩，几何与颜色用官方 token 并带中性兜底）。
 *
 * ★**不新增任何 esc 全局类**：这份排版只属于这一枚弹窗，故随组件走（`<style>` 挂在弹窗体上），
 *   `esc-style.ts` 那个模板串**一个字节都没动**（它整段在一枚模板字符串内，注释里不许出现反引号）。
 */
export const ENTERPRISE_SKILL_IMPORT_DIALOG_STYLES = `
  [role="dialog"]:has(.own-skill-import-body) { box-sizing: border-box; width: min(560px, calc(100vw - 48px)); }
  .own-skill-import-content { min-height: 0; overflow-y: auto; }
  .own-skill-import-body { display: flex; flex-direction: column; gap: 12px; }
  .own-skill-import-summary { color: var(--dsw-alias-state-error-primary, #c4320a); font-size: 13px; line-height: 20px; margin: 0; }
  .own-skill-import-drop { align-items: center; background: transparent; border: 1px dashed var(--dsw-alias-border-l2, #d0d5dd); border-radius: var(--dsw-radius-md, 8px); box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: 4px; padding: 24px 16px; text-align: center; }
  .own-skill-import-drop[data-busy='true'] { cursor: not-allowed; opacity: 0.6; }
  .own-skill-import-drop-icon { color: var(--dsw-alias-label-tertiary, #667085); }
  .own-skill-import-hint { color: var(--dsw-alias-label-secondary, #475467); font-size: 13px; line-height: 20px; margin: 0; }
  .own-skill-import-formats { color: var(--dsw-alias-label-tertiary, #667085); font-size: 12px; line-height: 18px; margin: 0; }
  .own-skill-import-actions { align-items: center; display: flex; gap: 8px; }
  .own-skill-import-list { border: 1px solid var(--dsw-alias-border-l2, #d0d5dd); border-radius: var(--dsw-radius-md, 8px); display: flex; flex-direction: column; list-style: none; margin: 0; max-height: 176px; overflow-y: auto; padding: 0; }
  .own-skill-import-item { border-top: 1px solid var(--dsw-alias-border-l1, #eaecf0); display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; }
  .own-skill-import-item:first-child { border-top: 0; }
  .own-skill-import-name { color: var(--dsw-alias-label-primary, #101828); font-size: 12px; line-height: 18px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .own-skill-import-state { align-items: center; color: var(--dsw-alias-label-tertiary, #667085); display: flex; font-size: 12px; gap: 6px; line-height: 18px; overflow-wrap: anywhere; }
  .own-skill-import-icon { align-items: center; display: inline-flex; flex: none; }
  .own-skill-import-dot { background: var(--dsw-alias-border-l2, #d0d5dd); border-radius: 999px; display: inline-block; height: 6px; width: 6px; }
  .own-skill-import-spin { animation: own-skill-import-rotate 1s linear infinite; }
  @keyframes own-skill-import-rotate { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .own-skill-import-spin { animation: none; } }
  .own-skill-import-state[data-status='failed'] { color: var(--dsw-alias-state-error-primary, #c4320a); }
  .own-skill-import-state[data-status='success'] { color: var(--dsw-alias-state-success-primary, #16803c); }
`

/** 拖拽区那一枚图标（Cherry 用的是 `Import` 字形；本仓技能通路一直用 `Upload`，取同一枚以免出现两套图标语汇）。 */
const DROP_ICON_SIZE = 26

/** 逐项状态图标（与 Cherry 逐项同形：转圈 / 对勾 / 警告；`pending` 是一枚中性圆点）。 */
function StateIcon({ status }: { readonly status: EnterpriseSkillImportItem['status'] }): ReactNode {
  if (status === 'installing') return createElement(Loader2, { 'aria-hidden': true, className: 'own-skill-import-spin', size: 14 })
  if (status === 'success') return createElement(CheckCircle2, { 'aria-hidden': true, size: 14 })
  if (status === 'failed') return createElement(CircleAlert, { 'aria-hidden': true, size: 14 })
  return createElement('span', { 'aria-hidden': true, className: 'own-skill-import-dot' })
}

/**
 * 逐项状态列表（纯视图，无 hook、可直调）。
 *
 * 一项两行：上面是 `「文件名」（大小）`（与反馈那三处**同一枚**拼法 `enterpriseSkillImportLabel`），
 * 下面是状态句（排队中 / 进行中 / 成功：技能名 / 失败：人话）。失败那一行的 `title` 是**原文**
 * （稳定码本身）——口径 60 逐字要求「可读错误上屏、原文进 `title`」。
 */
export function EnterpriseSkillImportQueueList({ items }: { readonly items: readonly EnterpriseSkillImportItem[] }): ReactNode {
  return createElement(
    'ul',
    { className: 'own-skill-import-list', 'data-enterprise-skill-import-list': '' },
    items.map(item => createElement(
      'li',
      { className: 'own-skill-import-item', 'data-enterprise-skill-import-item': item.id, key: item.id },
      createElement('span', { className: 'own-skill-import-name', title: item.name, children: enterpriseSkillImportLabel(item.name, item.bytes) }),
      createElement('span', {
        className: 'own-skill-import-state',
        'data-status': item.status,
        // ★失败项：稳定码（原文）进 title；上屏的是唯一码表给的那句人话（见 `enterpriseSkillImportItemStatusText`）。
        title: item.status === 'failed' ? item.code : undefined,
        children: [
          createElement('span', { key: 'icon', className: 'own-skill-import-icon' }, createElement(StateIcon, { status: item.status })),
          enterpriseSkillImportItemStatusText(item),
        ],
      }),
    )),
  )
}

/**
 * 批量摘要（纯视图）：**多项且有失败**时顶部那一句「失败 N / 成功 M / 共 K」＋ 可重选的下一步。
 *
 * ★为什么摘要句由 `enterpriseSkillImportQueueSummary` 算（而不是在这里拼）：那是"逐字"这条判据的
 *   唯一真源，本文件只把它画出来。
 * ★为什么重选那枚文案逐字复用 `ENTERPRISE_SKILL_IMPORT_RESELECT`：失败后正确的下一步**不是原地重发**
 *   同一份字节（超限/形状不对这两类再发一百次也一样），而是换一份文件——这句话在本仓已经有一处实现。
 */
export function EnterpriseSkillImportBatchSummary({
  queue,
  onReselect,
}: {
  readonly queue: EnterpriseSkillImportQueue
  readonly onReselect: () => void
}): ReactNode {
  const summary = enterpriseSkillImportQueueSummary(queue)
  if (summary === undefined) return null
  return createElement(
    'div',
    { className: 'own-skill-import-summary-wrap', 'data-enterprise-skill-import-summary': '' },
    createElement('p', { className: 'own-skill-import-summary', role: 'alert', children: summary }),
    createElement(Button, {
      size: 'sm',
      icon: createElement(Upload, { 'aria-hidden': true, size: 14 }),
      'aria-label': ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
      onClick: () => { onReselect() },
      children: ENTERPRISE_SKILL_IMPORT_RESELECT,
    }),
  )
}

/**
 * 拖拽区 + 显式按钮 + 恒不可见的原生选择器（纯视图，无 hook、可直调）。
 *
 * ★`onDrop` 只认 `dataTransfer.files`**文件**这一条路（**不**碰 `items`/`webkitGetAsEntry`/`entries`：
 *   目录导入是 Phase 2 的宿主侧通路，见文件头那段）。
 * ★拖入的文件**不在这里筛格式**：只把 `File` 原样交出去，尺寸与形状由既有那一条预检 + Host 闸门判。
 */
export function EnterpriseSkillImportDropzone({
  inputRef,
  busy,
  onPick,
  onFiles,
}: {
  readonly inputRef: RefObject<HTMLInputElement>
  readonly busy: boolean
  readonly onPick: () => void
  readonly onFiles: (files: readonly File[]) => void
}): ReactNode {
  const takeFromList = (list: FileList | null): void => { onFiles(list === null ? [] : Array.from(list)) }
  return createElement(
    Fragment,
    null,
    createElement(
      'div',
      {
        className: 'own-skill-import-drop',
        'data-enterprise-skill-import-drop': '',
        'data-busy': busy ? 'true' : 'false',
        // 拖入即"用户手势"：点一下等于重开选择器（没有可点性也不至于成为一枚死区）。
        onClick: () => { if (!busy) onPick() },
        onDragOver: (event: DragEvent<HTMLDivElement>) => { event.preventDefault() },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
          event.preventDefault()
          if (busy) return
          takeFromList(event.dataTransfer.files)
        },
      },
      createElement(Upload, { 'aria-hidden': true, className: 'own-skill-import-drop-icon', size: DROP_ICON_SIZE, strokeWidth: 1.2 }),
      createElement('p', { className: 'own-skill-import-hint', children: ENTERPRISE_SKILL_IMPORT_DROP_HINT }),
      // ★第二行 = 接受格式与上限：**逐字**来自 `skill-import.ts`（accept 派生形态 + 那枚 50 MiB 常量）。
      createElement('p', { className: 'own-skill-import-formats', children: ENTERPRISE_SKILL_IMPORT_FORMATS_TEXT }),
    ),
    createElement(
      'div',
      { className: 'own-skill-import-actions' },
      createElement(Button, {
        size: 'sm',
        icon: createElement(Upload, { 'aria-hidden': true, size: 14 }),
        disabled: busy,
        'aria-label': ENTERPRISE_SKILL_IMPORT_PICK_ARIA,
        // 官方 Button 的 props 是**封闭形状**（不含任意 data-*）：与 esc-toolbar 同一条手法，用展开绕过
        // 编译期的多余属性检查 —— 这是门禁稳定取到「那枚显式按钮」的钩子，不给它新造类名。
        ...{ 'data-enterprise-skill-import-pick': '' },
        onClick: () => { onPick() },
        children: ENTERPRISE_SKILL_IMPORT_PICK_LABEL,
      }),
      createElement('input', {
        ref: inputRef,
        type: 'file',
        // ★多选（口径 60 第 1/2 条）：一次选多份 ⇒ 入队顺序 = 选择顺序 ⇒ 串行装。
        multiple: true,
        accept: ENTERPRISE_SKILL_IMPORT_ACCEPT,
        'aria-label': ENTERPRISE_SKILL_IMPORT_PICK_ARIA,
        style: ENTERPRISE_SKILL_IMPORT_INPUT_STYLE,
        onChange: (event: { currentTarget: HTMLInputElement }) => {
          const files = Array.from(event.currentTarget.files ?? [])
          // ★选完立刻清空 value（与商城那枚同一条口径）：不清的话"同一批文件再选一次"不触发 change。
          event.currentTarget.value = ''
          onFiles(files)
        },
      }),
    ),
  )
}

/**
 * 弹窗体（纯视图，无 hook、可直调）：摘要句在最上（口径 60 第 3 条「顶部一句」），
 * 然后是拖拽区 + 显式按钮，最后是逐项状态列表。
 */
export function EnterpriseSkillImportView({
  queue,
  inputRef,
  busy,
  onPick,
  onFiles,
  onReselect,
}: {
  readonly queue: EnterpriseSkillImportQueue
  readonly inputRef: RefObject<HTMLInputElement>
  readonly busy: boolean
  readonly onPick: () => void
  readonly onFiles: (files: readonly File[]) => void
  readonly onReselect: () => void
}): ReactNode {
  return createElement(
    'div',
    { className: 'own-skill-import-body' },
    createElement('style', null, ENTERPRISE_SKILL_IMPORT_DIALOG_STYLES),
    createElement(EnterpriseSkillImportBatchSummary, { queue, onReselect }),
    createElement(EnterpriseSkillImportDropzone, { inputRef, busy, onPick, onFiles }),
    queue.items.length === 0 ? null : createElement(EnterpriseSkillImportQueueList, { items: queue.items }),
  )
}

/** 导入弹窗的入参（`port` 缺席 ⇒ 整段不渲染：没有写入口就不画一枚点了没反应的弹窗）。 */
export interface EnterpriseSkillImportDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly port?: EnterpriseSkillImportQueuePort | undefined
}

/**
 * **口径 60**：技能页「添加技能 → 上传技能」的导入弹窗（官方 `Modal`，与登录弹窗/卸载确认同一原语）。
 *
 * 三条行为在这里收口（判据本身都在纯投影里，这里只**执行**）：
 *   · **装中禁关**：`enterpriseSkillImportQueueClosable` 为假时，`onClose` 直接早退 —— 官方 Modal 的
 *     遮罩点击、Esc、右上角关闭按钮**三条路都走同一个 `onClose`**，故三条一起被拦（不需要另接键盘监听）。
 *   · **成功 ⇒ toast + 自动关闭**：收束裁决是 `success` 时**一次性**弹官方 `Toast` 并关窗；
 *     `Toast` 挂在本组件（而不是 Modal 内），故关窗之后那条通知仍活得下来，`onDone` 到点自己摘掉。
 *   · **失败 ⇒ 留着**：`partial` / `failed` / `nothing` 三档都不关窗，错误在逐项行与摘要句上。
 * `open` 为假时清空队列（重开是一张白纸；与 Cherry 在 `open=false` 清 items 同判）。
 */
export function EnterpriseSkillImportDialog(props: EnterpriseSkillImportDialogProps): ReactNode {
  const port = props.port
  const queue = port === undefined ? ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE : port.queue
  const inputRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<{ readonly text: string; readonly seq: number } | undefined>(undefined)
  const seq = useRef(0)
  const portRef = useRef(port)
  const openChangeRef = useRef(props.onOpenChange)
  portRef.current = port
  openChangeRef.current = props.onOpenChange
  const outcome = enterpriseSkillImportQueueOutcome(queue)
  /**
   * 成功那句话（`undefined` = 这一刻没有"刚跑完全成功"这件事）。
   *
   * ★它是一枚**字符串**：同一批跑完之后不会因为重渲染而反复弹（effect 的依赖是这句文本本身）；
   *   而"再导入一次同一批"必然先经过 `running`（那句变回 `undefined`）⇒ 依赖真的变了、toast 照常再弹一次。
   */
  const successToast = outcome.kind === 'success' ? outcome.toast : undefined
  useEffect(() => {
    if (props.open) return
    // 关窗即清空（重开是白纸；`reset()` 落到同一枚空队列常量 ⇒ 重复调用不会引起重渲染）。
    // ★只在**开合翻转**时走一次：`port` 的读取经 ref（它每渲染都是一枚新对象，放进依赖会空转）。
    portRef.current?.reset()
  }, [props.open])
  useEffect(() => {
    if (successToast === undefined) return
    seq.current += 1
    setToast({ text: successToast, seq: seq.current })
    openChangeRef.current(false)
  }, [successToast])
  if (port === undefined) return null
  const busy = !enterpriseSkillImportQueueClosable(queue)
  const close = (): void => {
    // ★装中禁关：遮罩点击 / Esc / 关闭按钮三条路都从这里过，判据为真时**关闭请求被拒**。
    if (!enterpriseSkillImportQueueClosable(queue)) return
    props.onOpenChange(false)
  }
  const pick = (): void => { inputRef.current?.click() }
  return createElement(
    Fragment,
    null,
    createElement(
      Modal,
      {
        open: props.open,
        onClose: close,
        closeLabel: '关闭',
        title: ENTERPRISE_SKILL_IMPORT_DIALOG_TITLE,
        description: ENTERPRISE_SKILL_IMPORT_DIALOG_SUBTITLE,
        contentClassName: 'own-skill-import-content',
      },
      createElement(EnterpriseSkillImportView, {
        queue,
        inputRef,
        busy,
        onPick: pick,
        onFiles: (files) => { port.enqueue(files) },
        onReselect: pick,
      }),
    ),
    // ★toast 在 Modal **之外**：关窗之后那半秒的消失动画仍要走完（`onDone` 到点自己摘）。
    toast === undefined ? null : createElement(Toast, {
      key: toast.seq,
      text: toast.text,
      onDone: () => { setToast(undefined) },
    }),
  )
}
