/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useRef/useState（含 `RefObject`/`CSSProperties`/`ReactNode` 类型）、官方原语 `Button`，`error-notice` 的唯一失败提示件、`local-api` 的稳定码取值口，以及纯事实层 `skill-import` 的 accept/预检/三态文案与 `skill-api-decode` 的两份记录类型
 * [OUTPUT]: 对外提供本地导入的**唯一实现**——接线面 `EnterpriseSkillImportPort`、状态机 `useEnterpriseSkillImport`、可见反馈 `EnterpriseSkillImportNotice`、页面级落点 `EnterpriseSkillImportChrome`，以及恒不可见选择器那套行内样式 `ENTERPRISE_SKILL_IMPORT_INPUT_STYLE`
 * [POS]: 本地导入的**视图与副作用层**（纯事实在 `skill-import.ts`，运输层在 `local-api.ts` 的 `uploadSkill`/`selfInstalledSkills`，落盘闸门在宿主）。它此前整份住在企业市场页里（`marketplace-entry.tsx`），本刀把它**抽成独立叶片**，因为「专家·技能·连接器」页的「添加技能」要**照同一套机制**做：两面各 import 同一个 hook 与同一枚反馈件，**不可能**再长出第二套状态机或第二份文案。
 *   ★三件事实**必须同源**才对：① 状态机（换文件即中止在途那次、离开页面即中止、超限一个字节都不发）；
 *     ② 可见反馈（进行中/成功各一句 `role="status"`、失败走唯一提示组件 + 真能点的「重新选择文件」）；
 *     ③ 隐藏选择器的属性（accept 串、单文件、选完清空 value）。任何一面自己再写一遍，就会出现
 *     「商城能选的文件在这里选不了」这类**同页两种规矩**的漂移。
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
