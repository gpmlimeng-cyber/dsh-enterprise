/**
 * [INPUT]: 依赖 React（useSyncExternalStore/useRef/useState）、Harness 共享 Modal/Button、desktop-runtime 的能力面与更新状态源，以及调用方提供的官方动作面
 * [OUTPUT]: 对外提供维护反馈弹窗 `EnterpriseMaintenanceNotice` 与开关控制器 `useEnterpriseMaintenance`（重载/重启的唯一触发点，含可见反馈与超时）、相位文案投影 `enterpriseMaintenanceNotice`，以及菜单行右侧「状态标签 + 快捷按钮」控件 `EnterpriseUpdateTrailingControl` 与更新订阅 `useEnterpriseUpdate`
 * [POS]: dsh-ui 的桌面维护视图层。触发与反馈在这里成对出现：官方 `app.relaunch` 的 spawn 失败只写 stderr，所以「已请求重启」必须可见并带超时提示，而不是 8 秒后静默；弹窗开关与弹窗元素同在 account-menu 的同一棵树里渲染
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  ENTERPRISE_UPDATE_ABSENT,
  runEnterpriseReload,
  runEnterpriseRestart,
  type EnterpriseDesktopActions,
  type EnterpriseUpdatePresentation,
  type EnterpriseUpdateSource,
  type EnterpriseUpdateTrailing as EnterpriseUpdateTrailingModel,
} from './desktop-runtime.js'

/** 维护动作只有两项：重载页面与重启应用。 */
export type EnterpriseMaintenanceKind = 'reload' | 'restart'

/** 反馈三态：请求中、超时（官方 8s 静默那一格）与请求被拒绝。 */
export type EnterpriseMaintenanceOutcome = 'requested' | 'timeout' | 'failed'

export interface EnterpriseMaintenanceNoticeState {
  readonly kind: EnterpriseMaintenanceKind
  readonly outcome: EnterpriseMaintenanceOutcome
}

export interface EnterpriseMaintenanceNoticeView {
  readonly title: string
  readonly description: string
  readonly tone: 'progress' | 'warning'
}

/**
 * 超时阈值：重启取 10 秒（官方客户端 8 秒静默退回，我们多给 2 秒再报「仍未检测到重启」），
 * 重载取 5 秒（官方 `reloadIgnoringCache` 是同步的，超过这个时间说明压根没生效）。
 */
export const ENTERPRISE_MAINTENANCE_TIMEOUT_MS: Readonly<Record<EnterpriseMaintenanceKind, number>> = {
  reload: 5_000,
  restart: 10_000,
}

/** 文案里出现的秒数一律由阈值推导，改阈值不会留下对不上的提示。 */
function secondsOf(kind: EnterpriseMaintenanceKind): number {
  return ENTERPRISE_MAINTENANCE_TIMEOUT_MS[kind] / 1000
}

/** 三态 × 两动作的可见反馈投影；不新增第二套词汇，全部是给用户看的动作说明。 */
export function enterpriseMaintenanceNotice(
  state: EnterpriseMaintenanceNoticeState,
): EnterpriseMaintenanceNoticeView {
  const seconds = secondsOf(state.kind)
  if (state.kind === 'reload') {
    if (state.outcome === 'failed') {
      return { description: '请手动重新载入页面，或退出后重开客户端。', title: '重新载入未生效', tone: 'warning' }
    }
    if (state.outcome === 'timeout') {
      return {
        description: `超过 ${seconds} 秒仍未看到页面重新载入，请手动重新载入页面或重开客户端。`,
        title: '重新载入尚未生效',
        tone: 'warning',
      }
    }
    return {
      description: `已请求重新载入页面；若 ${seconds} 秒内没有反应，请手动重新载入页面或重开客户端。`,
      title: '正在重新载入页面',
      tone: 'progress',
    }
  }
  if (state.outcome === 'failed') {
    return { description: '请手动退出客户端并重新打开。', title: '重启请求未被接受', tone: 'warning' }
  }
  if (state.outcome === 'timeout') {
    return { description: '请手动退出客户端并重新打开。', title: '仍未检测到重启', tone: 'warning' }
  }
  return {
    description: `已请求重启应用；若 ${seconds} 秒内没有反应，请手动退出并重开客户端。`,
    title: '已请求重启应用',
    tone: 'progress',
  }
}

export interface EnterpriseMaintenanceController {
  readonly notice: EnterpriseMaintenanceNoticeState | undefined
  readonly requestReload: () => void
  readonly requestRestart: () => void
  readonly close: () => void
}

/**
 * 维护动作的唯一触发点：先亮出可见反馈，再调官方动作面，最后按超时阈值翻成提示。
 * 重启没有官方动作面时**什么都不做**（行项本身已隐藏），绝不退回自造通道。
 */
export function useEnterpriseMaintenance(
  actions: EnterpriseDesktopActions | undefined,
): EnterpriseMaintenanceController {
  const [notice, setNotice] = useState<EnterpriseMaintenanceNoticeState>()
  const timer = useRef<number>()
  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined }
  }, [])
  useEffect(() => clearTimer, [clearTimer])
  const start = useCallback((kind: EnterpriseMaintenanceKind) => {
    clearTimer()
    setNotice({ kind, outcome: 'requested' })
    timer.current = window.setTimeout(() => {
      timer.current = undefined
      setNotice(current => current !== undefined && current.outcome === 'requested'
        ? { ...current, outcome: 'timeout' }
        : current)
    }, ENTERPRISE_MAINTENANCE_TIMEOUT_MS[kind])
  }, [clearTimer])
  const requestReload = useCallback(() => {
    start('reload')
    // 有官方动作面就走 invoke('reload')，否则页面重载；两者都不加二次确认。
    runEnterpriseReload(actions, () => { globalThis.location.reload() })
  }, [actions, start])
  const requestRestart = useCallback(() => {
    if (actions === undefined) return
    start('restart')
    runEnterpriseRestart(actions, () => {
      setNotice(current => current === undefined ? current : { ...current, outcome: 'failed' })
    })
  }, [actions, start])
  const close = useCallback(() => { clearTimer(); setNotice(undefined) }, [clearTimer])
  return { close, notice, requestReload, requestRestart }
}

/** 弹窗自持排版；官方 Modal 给外框与键盘，颜色用官方 token 并带中性兜底。 */
const NOTICE_STYLES = `
      [role="dialog"]:has(.own-maintenance-body) { box-sizing: border-box; width: min(420px, calc(100vw - 48px)); }
      .own-maintenance-content { min-height: 0; overflow-y: auto; }
      .own-maintenance-text { color: var(--dsw-alias-label-secondary, #475467); font-size: 13px; line-height: 20px; margin: 0; }
      .own-maintenance-text[data-tone='warning'] { color: var(--dsw-alias-status-warning, #b54708); }
`

const FOOTER_STYLE: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }

export interface EnterpriseMaintenanceNoticeProps {
  readonly notice: EnterpriseMaintenanceNoticeState | undefined
  readonly onClose: () => void
}

/**
 * 维护反馈弹窗。它不是二次确认：请求已经发出，这里只说清「已请求什么、多久没反应该怎么办」，
 * 唯一按钮是关闭；开关状态由 `useEnterpriseMaintenance` 持有，元素必须在同一棵树里渲染。
 */
export function EnterpriseMaintenanceNotice(props: EnterpriseMaintenanceNoticeProps): ReactNode {
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(props.onClose)
  const view = props.notice === undefined ? undefined : enterpriseMaintenanceNotice(props.notice)
  useEffect(() => { closeRef.current = props.onClose }, [props.onClose])
  // 官方 Modal 已给初始焦点、Tab 与遮罩关闭；这里只隔离外层 Settings 的 Escape，与本包其它弹窗同一处理。
  useEffect(() => {
    if (props.notice === undefined) return
    const root = bodyRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (root === null || root === undefined) return
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeRef.current()
    }
    root.addEventListener('keydown', onKeyDown)
    return () => { root.removeEventListener('keydown', onKeyDown) }
  }, [props.notice])
  return <Modal
    closeLabel="关闭"
    contentClassName="own-maintenance-content"
    description={view?.description ?? ''}
    footer={<div style={FOOTER_STYLE}><Button onClick={props.onClose} variant="outline">关闭</Button></div>}
    onClose={props.onClose}
    open={props.notice !== undefined}
    title={view?.title ?? ''}
  >
    <div className="own-maintenance-body" ref={bodyRef}>
      <style>{NOTICE_STYLES}</style>
      {view === undefined ? null : <p className="own-maintenance-text" data-tone={view.tone} role="status">{view.description}</p>}
    </div>
  </Modal>
}

/** 菜单行右侧状态控件：状态标签（弱化色）恒在，快捷按钮按相位出现。 */
export interface EnterpriseUpdateTrailingControlProps {
  readonly trailing: EnterpriseUpdateTrailingModel
  readonly onOpen: () => void
}

/**
 * 右侧控件的唯一职责：把「状态标签 + 快捷按钮」摆在同一行，按钮是行点击之外的第二条入口。
 * 它嵌在官方行项（`role=menuitem` 的 button）里，所以点击必须 `stopPropagation`，
 * 否则一次点击会同时触发行点击（关菜单 + open()）与按钮本身。
 *
 * 状态标签与按钮文案都不重复行标签「检查更新」；忙相位（checking/downloading/…）只有只读状态。
 */
export function EnterpriseUpdateTrailingControl(props: EnterpriseUpdateTrailingControlProps): ReactElement {
  const { trailing } = props
  return <span className="own-update-trailing">
    <span className="own-update-state" title={trailing.stateTitle}>{trailing.state}</span>
    {trailing.action === 'none' || trailing.actionLabel === undefined
      ? null
      : <span
        className="own-update-action"
        onClick={(event) => { event.stopPropagation(); props.onOpen() }}
        role="button"
        tabIndex={-1}
      >{trailing.actionLabel}</span>}
  </span>
}

/** 更新状态订阅；没有桌面更新面时恒为 undefined，菜单里的更新行随之隐藏。 */
export function useEnterpriseUpdate(
  source: EnterpriseUpdateSource | undefined,
): EnterpriseUpdatePresentation | undefined {
  const resolved = source ?? ENTERPRISE_UPDATE_ABSENT
  return useSyncExternalStore(resolved.subscribe, resolved.getSnapshot, resolved.getSnapshot)
}
