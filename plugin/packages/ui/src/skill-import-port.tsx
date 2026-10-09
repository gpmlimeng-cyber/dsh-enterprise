/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useRef/useState（含 `RefObject`/`CSSProperties`/`ReactNode` 类型）、官方原语 `Button`，`error-notice` 的唯一失败提示件、`local-api` 的稳定码取值口，以及纯事实层 `skill-import` 的 accept/预检/三态文案、`skill-import-queue` 的四态队列投影与 `skill-api-decode` 的两份记录类型
 * [OUTPUT]: 对外提供本地导入的**唯一实现**——接线面 `EnterpriseSkillImportPort`、状态机 `useEnterpriseSkillImport`、可见反馈 `EnterpriseSkillImportNotice`、页面级落点 `EnterpriseSkillImportChrome`、恒不可见选择器那套行内样式 `ENTERPRISE_SKILL_IMPORT_INPUT_STYLE`，以及**口径 60** 的队列接线面 `EnterpriseSkillImportQueuePort` 与串行驱动器 `useEnterpriseSkillImportQueue`
 * [POS]: 本地导入的**视图与副作用层**（纯事实在 `skill-import.ts`、队列状态迁移在 `skill-import-queue.ts`，运输层在 `local-api.ts` 的 `uploadSkill`/`selfInstalledSkills`，落盘闸门在宿主）。它此前整份住在企业市场页里（`marketplace-entry.tsx`），本刀把它**抽成独立叶片**，因为「专家·技能·连接器」页的「添加技能」要**照同一套机制**做：两面各 import 同一个 hook 与同一枚反馈件，**不可能**再长出第二套状态机或第二份文案。
 *   ★三件事实**必须同源**才对：① 状态机（换文件即中止在途那次、离开页面即中止、超限一个字节都不发）；
 *     ② 可见反馈（进行中/成功各一句 `role="status"`、失败走唯一提示组件 + 真能点的「重新选择文件」）；
 *     ③ 隐藏选择器的属性（accept 串、单文件、选完清空 value）。任何一面自己再写一遍，就会出现
 *     「商城能选的文件在这里选不了」这类**同页两种规矩**的漂移。
 *   ★**口径 60（本刀）的队列是"驱动器"而不是"第二个上传器"**：`useEnterpriseSkillImportQueue` 内部
 *     **直接持有**上面那枚 `useEnterpriseSkillImport`，把一份文件一份文件地**交棒**给它
 *     （`port.onSelect`），自己只做四件事：按选择顺序入队、串行推进、把结果落回队列项、算出收束裁决。
 *     故「预检 / multipart / 自装清单 / `onInstalled` 刷新」这些机制在本仓仍然**只有一处实现**
 *     （门禁：全 `src` 里 `await uploadSkill(file, controller.signal)` 恰好出现在本文件一处）。
 *     队列**不判断**一项装到哪一步——它只认"交棒前那一件结果对象"与"交棒后新来的结果对象"是不是同一枚
 *     （收束判据是**对象身份**，不是时间/计数：这样上一项的 `done` 绝不可能被读成下一项的结果）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { FolderSearch } from 'lucide-react'
import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { EnterpriseErrorNotice } from './error-notice.js'
import { enterpriseLocalErrorCode } from './local-api.js'
import type { EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from './skill-api-decode.js'
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_INPUT_LABEL,
  ENTERPRISE_SKILL_IMPORT_RESELECT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
  enterpriseSkillImportNames,
  enterpriseSkillImportNotice,
  enterpriseSkillImportRejectReason,
  type EnterpriseSkillImportState,
} from './skill-import.js'
import {
  ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE,
  enterpriseSkillImportQueueClosable,
  enterpriseSkillImportQueueOf,
  enterpriseSkillImportQueueSettle,
  enterpriseSkillImportQueueStart,
  type EnterpriseSkillImportQueue,
} from './skill-import-queue.js'

/**
 * 本地导入的接线面（**商城页与 esc 页共用同一副形状**）。
 *
 * ★ 为什么引用（`inputRef`）也要从状态机**传下来**、而不是让页面那一侧自己 `useRef`：
 *   触发它的东西住在**另一棵树**里（商城是官方标题行槽 `plugins.detail.badge`，esc 是工具栏右块），
 *   它够不到页面树里的任何 hook —— 两棵树之间只有回调这条路。
 *   于是 `<input type="file">` 挂在页面这棵树上、引用由状态机持有，回调一点就点得着它。
 * ★ 为什么 `onOpen`（打开选择器）与 `onSelect`（选到了文件）要分开：前者是**无输入**的用户手势
 *   （菜单项、失败后那枚「重新选择文件」都调它），后者才带着浏览器交出来的 `File` 字节进入上传状态机。
 */
export interface EnterpriseSkillImportPort {
  /** 三态状态机（`undefined` = 空闲 ⇒ 反馈整段不进 DOM）。 */
  readonly state: EnterpriseSkillImportState | undefined
  /** 那个恒不可见的文件选择器的 DOM 引用（状态机持有；`RefObject` 的 `current` 天然可空）。 */
  readonly inputRef: RefObject<HTMLInputElement>
  /** 打开文件选择器（状态机里就是 `inputRef.current?.click()` 这一件事）。 */
  readonly onOpen: () => void
  /** 用户选中了一个文件（状态机先做尺寸预检，再发同源 multipart 上传）。 */
  readonly onSelect: (file: File) => void
}

/** 状态机的两个写入口（都缺席 ⇒ 整条导入**不可用**，调用方据此不画任何东西）。 */
export interface EnterpriseSkillImportOptions {
  /** 同源 `POST …/skills/upload`（multipart，字段名固定 `artifact`）。 */
  readonly uploadSkill?: ((file: File, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>) | undefined
  /** 同源 `GET …/skills/self-installed`：自装清单，用来把「这次装好了哪几个技能」说出来。 */
  readonly selfInstalledSkills?: ((signal: AbortSignal) => Promise<readonly EnterpriseSelfInstalledSkill[]>) | undefined
  /**
   * 上传成功那一下要刷新什么（**各面各自的真值**，状态机不替调用方猜）。
   *
   * 商城面把自己的已装态覆盖掉再请目录取数源重取；esc 面没有目录源，只把「已安装(N)」那一次读重跑。
   * 收下的是上传响应里那份**最新企业已装态**（与 `/skills/install` 逐字同形）。
   */
  readonly onInstalled?: ((items: readonly EnterpriseInstalledSkill[]) => void) | undefined
}

/**
 * 本地导入的**唯一状态机**（select → 预检 → 上传 → 说出来）。
 *
 * ★ 为什么是 hook 而不是纯函数：它本身就是**有状态 + 有副作用**的一整条通路（在途 `AbortController`、
 *   三态、次级读取）。它不碰任何页面私有状态——成功之后要刷什么，由调用方经 `onInstalled` 决定。
 * ★ 并发纪律与行上装/卸同一条：**换文件即中止在途那一次**，卸载即中止（迟到结果一律丢弃）。
 *
 * @param options - 见 `EnterpriseSkillImportOptions`。
 * @returns 接线面；`uploadSkill` 缺席时为 `undefined`（**一枚元素都不该画**：不画点了没反应的选择器）。
 */
export function useEnterpriseSkillImport(options: EnterpriseSkillImportOptions): EnterpriseSkillImportPort | undefined {
  const { uploadSkill, selfInstalledSkills, onInstalled } = options
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [state, setState] = useState<EnterpriseSkillImportState>()
  // 离开页面即中止在途的上传（与资料库面板那条 `inFlight` 纪律同款：迟到结果不回填）。
  useEffect(() => () => { abortRef.current?.abort() }, [])
  if (uploadSkill === undefined) return undefined
  return {
    state,
    inputRef,
    onOpen: () => { inputRef.current?.click() },
    onSelect: (file) => {
      abortRef.current?.abort()
      const rejected = enterpriseSkillImportRejectReason(file)
      if (rejected !== undefined) {
        // 超限就地拦下：**一个字节都不发出去**（前端带上了文件名与大小，员工一眼看得出是哪一份、多大）。
        setState({ kind: 'failed', name: file.name, bytes: file.size, code: rejected })
        return
      }
      const controller = new AbortController()
      abortRef.current = controller
      setState({ kind: 'uploading', name: file.name, bytes: file.size })
      void (async () => {
        try {
          const items = await uploadSkill(file, controller.signal)
          if (controller.signal.aborted) return
          onInstalled?.(items)
          // 自装清单是**另一份**记录（企业已装清单里不含自装包）⇒「装好了哪几个技能」只能从它读。
          // 它读不到**不影响**成功这件事：`listed:false` 就是那句如实的交代（不是静默吞掉）。
          let names: readonly string[] = []
          let listed = false
          try {
            const records = selfInstalledSkills === undefined ? [] : await selfInstalledSkills(controller.signal)
            if (controller.signal.aborted) return
            names = enterpriseSkillImportNames(records, file.name)
            listed = true
          } catch {
            // 次级事实读不到：如实记成「没读到」，绝不把一次**已经成功**的导入改判成失败。
            listed = false
          }
          if (controller.signal.aborted) return
          setState({ kind: 'done', name: file.name, bytes: file.size, names, listed })
        } catch (error) {
          if (controller.signal.aborted) return
          setState({ kind: 'failed', name: file.name, bytes: file.size, code: enterpriseLocalErrorCode(error) })
        }
      })()
    },
  }
}

/**
 * **口径 60**：多份文件的本地导入接线面（弹窗只消费这三件）。
 *
 * 与单件那枚 `EnterpriseSkillImportPort` 的关系：**同一套机制的两个入口**——单件那枚是商城页的
 * 「选一个文件」，本枚是技能页弹窗的「选/拖一批文件，串行装」。两者共用同一个上传实现
 * （本 hook 内部就是它），差别只在"队列"这一层。
 */
export interface EnterpriseSkillImportQueuePort {
  /** 四态队列（纯数据；状态迁移全部由 `skill-import-queue.ts` 的纯函数算）。 */
  readonly queue: EnterpriseSkillImportQueue
  /** 用户选/拖进来一批文件（**装中不受理**：在途那批没跑完就不再叠一批）。 */
  readonly enqueue: (files: readonly File[]) => void
  /** 关窗即清空（重开时是一张白纸；与 Cherry 在 `open=false` 时清 items 同判）。 */
  readonly reset: () => void
}

/**
 * **口径 60**：本地导入的**串行队列驱动器**（不是第二个上传器）。
 *
 * ★为什么是"驱动器"：`useEnterpriseSkillImport` 已经把事情做全了（尺寸预检、abort、multipart、
 *   自装清单、`onInstalled` 刷新）。队列要补的只有一件事——**一次只喂一份**，并把这一份的结果落回队列项。
 *   于是这里**直接持有**那枚 hook（`single`），把每一份文件经它的 `onSelect` 交棒出去；本文件里
 *   一个 `fetch`、一个 `FormData`、一次 `uploadSkill` 调用都没有（门禁盯着这一条）。
 * ★**收束判据是对象身份**（`handedOff`）：交棒前把 `single.state` 那枚对象记下来，只有出现**另一枚**
 *   终态对象时才算"这一项出结果了"。用时间戳/计数做不到这一点——上一项的 `done` 会被读成下一项的结果，
 *   于是 B 项会拿着 A 项的技能名字报成功（这正是把单件状态机改造成驱动器时唯一的真陷阱）。
 * ★**串行**由构造保证：交棒只标记当前项 `installing`（`active` 不动），推进只发生在收束那一拍。
 *   `pending` 项在同一时刻只可能是"排在前一项后面"，故永不并发。
 *
 * @param options - 与单件那枚**同一份入参**（写入口、自装清单、安装后刷新）。
 * @returns 队列接线面；`uploadSkill` 缺席时为 `undefined`（**一枚元素都不该画**）。
 */
export function useEnterpriseSkillImportQueue(
  options: EnterpriseSkillImportOptions,
): EnterpriseSkillImportQueuePort | undefined {
  const single = useEnterpriseSkillImport(options)
  const [queue, setQueue] = useState<EnterpriseSkillImportQueue>(ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE)
  /** 这一批文件本体（下标与队列项**一一对应**；队列项只带 `name`/`size` 两件可展示事实）。 */
  const selected = useRef<readonly File[]>([])
  /** 交棒那一刻 `single.state` 的**对象身份**（见上面那段：收束判据不是时间/计数）。 */
  const handedOff = useRef<EnterpriseSkillImportState | undefined>(undefined)
  const singleRef = useRef(single)
  const singleState = single === undefined ? undefined : single.state
  // 每拍把最新那枚接线面记下来：effect 的依赖只跟队列走，不因为"每次渲染都新建一枚 port 对象"而空转。
  useEffect(() => { singleRef.current = single })
  /**
   * ① 交棒：把 `active` 那一项推进到 `installing`，并把文件交给**既有单件状态机**。
   *    `selected.current[index]` 与队列项同下标 —— 这就是"文件本体不进队列状态"的落点（队列可序列化）。
   */
  useEffect(() => {
    const port = singleRef.current
    const index = queue.active
    const item = index === undefined ? undefined : queue.items[index]
    if (port === undefined || index === undefined || item === undefined || item.status !== 'pending') return
    const file = selected.current[index]
    if (file === undefined) return
    handedOff.current = port.state
    setQueue(previous => enterpriseSkillImportQueueStart(previous, index))
    port.onSelect(file)
  }, [queue])
  /**
   * ② 收束：单件状态机给出**新的一枚终态对象**时，把结果落回这一项并推进到下一项。
   *    `uploading` 是在途态、`undefined` 是"还没交棒"、与 `handedOff` 同一是"还没出结果"。
   */
  useEffect(() => {
    const port = singleRef.current
    const index = queue.active
    const item = index === undefined ? undefined : queue.items[index]
    if (port === undefined || index === undefined || item === undefined || item.status !== 'installing') return
    const state = port.state
    if (state === undefined || state === handedOff.current || state.kind === 'uploading') return
    setQueue(previous => enterpriseSkillImportQueueSettle(previous, index, state.kind === 'done'
      ? { kind: 'success', names: state.names, listed: state.listed }
      : { kind: 'failed', code: state.code }))
  }, [queue, singleState])
  if (single === undefined) return undefined
  const busy = !enterpriseSkillImportQueueClosable(queue)
  return {
    queue,
    enqueue: (files) => {
      // 装中不受理新一批（与本仓"在途不叠加"同一条纪律）；空选择也不动队列。
      if (busy || files.length === 0) return
      selected.current = files
      setQueue(enterpriseSkillImportQueueOf(files))
    },
    reset: () => {
      selected.current = []
      handedOff.current = undefined
      setQueue(ENTERPRISE_SKILL_IMPORT_EMPTY_QUEUE)
    },
  }
}

/**
 * 原生文件选择器的**样式**：行内**视觉隐藏**（「1px 剪裁」那一套），不新增任何 CSS 类。
 *
 * ★ 为什么不用类名：原生 file input 的外观**根本不该参与产品版面**——它是一枚只被脚本点开的能力，
 *   给这样一个元素新造一个类，等于为一件看不见的东西付一份可被覆盖的全局样式债。
 * ★ 为什么用「1px 剪裁」而不是 `display:none`：**照本仓既有那一枚**（`library-panel.tsx` 的
 *   `.own-library-file` 就是这个手法 —— 它在本应用里已经跑过真机）。两者对「脚本点开选择器」都可行，
 *   但沿用同一套手法就不必让下一个人去论证「这一枚为什么和另一枚不一样」；差别只在**行内 vs 类名**。
 */
export const ENTERPRISE_SKILL_IMPORT_INPUT_STYLE: CSSProperties = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
}

/**
 * 本地导入的**可见反馈**（唯一落点；三态互斥，空闲时整段不进 DOM）。
 *
 * 两种形态刻意分开：
 *   · 进行中 / 成功 ⇒ 一句人话（`role="status"`：不打断读屏，等它把手上的话说完再播报）；
 *   · 失败 ⇒ 复用**唯一**的失败提示组件 `EnterpriseErrorNotice`（`role="alert"` + 人话 + 「下一步：」+
 *     折进「技术信息」的稳定码），后面再跟一枚**真能走**的「重新选择文件」。
 *
 * ★ 为什么失败多那枚按钮、而不是只写一句「请重试」：上传失败的正确下一步**不是**原地重发同一份字节
 *   （超限、不是有效技能包这两类再发一百次也一样），而是**换一份文件**——那就必须给一枚真按钮，
 *   不能只在文案里说一句。它的动作就是重新打开同一个选择器（`onReselect`）。
 * ★ 不给「重试」那枚：本状态机没有「保留上次那份 File 再发一次」的能力，画了就是死控件。
 * ★ 两枚类名是**参数**：商城页那两份 `own-market-*` 是它自己 `<style>` 里的类；esc 页没有那两个类，
 *   传自己那一份（`.esc-toolbar-note`）才不会把一条反馈渲染成裸 `<p>`。默认值就是商城页那两个，
 *   故商城面**一个字节都没变**。
 *
 * @param props.state - 三态状态机（不是 `undefined`：空闲时调用方整段不渲染）。
 * @param props.onReselect - 重新选择文件（缺席 ⇒ 不画那枚按钮，只出人话与下一步）。
 * @returns 一句 `role="status"` 人话，或「唯一提示组件 + 重新选择文件」。
 */
export function EnterpriseSkillImportNotice({ state, onReselect, noteClassName = 'own-market-rowNote', errorClassName = 'own-market-inlineError' }: {
  readonly state: EnterpriseSkillImportState
  readonly onReselect?: (() => void) | undefined
  readonly noteClassName?: string | undefined
  readonly errorClassName?: string | undefined
}): ReactNode {
  const notice = enterpriseSkillImportNotice(state)
  if (notice.kind === 'failed') {
    return (
      <>
        {/* `flow="local-upload"` 是**必须**的：这枚码可能同时来自中心安装流，而那一条流的下一步（「重新下载」）
            在这一条流里是错的 —— 技能包就是员工手里那份文件，他只能换一份（见 error-messages 的表注）。 */}
        <EnterpriseErrorNotice className={errorClassName} code={notice.code} prefix={notice.prefix} flow="local-upload" />
        {onReselect === undefined ? null : (
          <Button
            size="sm"
            icon={<FolderSearch aria-hidden size={14} />}
            aria-label={ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL}
            onClick={() => { onReselect() }}
          >{ENTERPRISE_SKILL_IMPORT_RESELECT}</Button>
        )}
      </>
    )
  }
  return (
    <p className={noteClassName} role="status" data-enterprise-skill-import={notice.kind}>
      {notice.text}
    </p>
  )
}

/**
 * 本地导入的**页面级落点**：那枚恒不可见的文件选择器 + 它的反馈。
 *
 * ★ 为什么 `port` 缺席就整段不渲染：没有写入口（没有 store / 纯函数直调）时**一枚元素都不画**——
 *   不画一枚点了没反应的选择器，也不画一句没人能触发出来的反馈。
 * ★ 它必须挂在**触发钮同一棵树**能触达的地方（商城的「添加」下拉在官方标题行槽里，故三支视图都挂；
 *   esc 的触发钮在工具栏里，故挂在工具栏下方那一格）——少挂一处就是「点了没反应」的死控件。
 *
 * @param props.port - 状态机给的接线面；缺席即整段不渲染。
 * @returns 隐藏的 `<input type="file">`（可能还有一条反馈）。
 */
export function EnterpriseSkillImportChrome({ port, noteClassName, errorClassName }: {
  readonly port?: EnterpriseSkillImportPort | undefined
  readonly noteClassName?: string | undefined
  readonly errorClassName?: string | undefined
}): ReactNode {
  if (port === undefined) return null
  return (
    <>
      <input
        ref={port.inputRef}
        type="file"
        accept={ENTERPRISE_SKILL_IMPORT_ACCEPT}
        aria-label={ENTERPRISE_SKILL_IMPORT_INPUT_LABEL}
        style={ENTERPRISE_SKILL_IMPORT_INPUT_STYLE}
        onChange={(event) => {
          const file = event.currentTarget.files?.item(0) ?? null
          // ★ 选完**立刻清空** input 的 value：不清的话「同一个文件再选一次」不会触发 change
          //   （浏览器认为值没变）——那就是本仓最恨的「点了没反应」。清空是唯一让重选可用的做法。
          event.currentTarget.value = ''
          if (file !== null) port.onSelect(file)
        }}
      />
      {port.state === undefined ? null : (
        <EnterpriseSkillImportNotice state={port.state} onReselect={port.onOpen} noteClassName={noteClassName} errorClassName={errorClassName} />
      )}
    </>
  )
}
