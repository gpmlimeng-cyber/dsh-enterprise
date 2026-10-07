/**
 * [INPUT]: 依赖 React、Harness Modal、account-state 的共享订阅、branding 的品牌读取层、account-store 的脱敏快照与 NUWAX 动作，正文来自 login-page 的 NUWAX 登录页
 * [OUTPUT]: 对外提供登录弹窗状态机 enterpriseLoginDialogReducer、入口投影 enterpriseLoginEntry、控制器 useEnterpriseLoginDialog 与弹窗组件 EnterpriseLoginDialog
 * [POS]: dsh-ui 唯一的登录弹窗壳，持有弹窗尺寸与焦点封闭，正文交给 login-page；**本刀把入口整面换成 NUWAX** —— 打开即是一面 NUWAX 账号口令表单（不再自动起跳授权、不再有 Server 地址编辑器、不再有页脚「存了再登录」的合并动作），登录成功由 NUWAX 登录态自己把弹窗关掉；关闭弹窗**不**打断在途的那一次登录（它是一次单往返的本机 POST，宿主照旧把它做完、结果落在共享快照上）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { useEnterpriseBranding } from './branding.js'
import type { EnterpriseNuwaxStatus } from './local-api.js'
import { EnterpriseNuwaxLoginPage, type EnterpriseNuwaxBusy } from './login-page.js'

/** 弹窗开关是唯一状态；账号事实全部来自共享 store，此机不复制任何快照字段。 */
export interface EnterpriseLoginDialogState {
  readonly open: boolean
}

export const ENTERPRISE_LOGIN_DIALOG_CLOSED: EnterpriseLoginDialogState = { open: false }

export type EnterpriseLoginDialogAction =
  | { readonly type: 'open' }
  | { readonly type: 'close' }
  /** 宿主/本机把 NUWAX 登录态推过来了：已登录即关窗（登录成功不需要额外命令）。 */
  | { readonly type: 'nuwax'; readonly status: EnterpriseNuwaxStatus | undefined }

/**
 * 纯状态机：打开由入口触发，关闭由取消/Esc/遮罩触发；
 * **NUWAX 会话一旦可用即自动关闭**，这是"登录成功"唯一的那条收束路径。
 */
export function enterpriseLoginDialogReducer(
  state: EnterpriseLoginDialogState,
  action: EnterpriseLoginDialogAction,
): EnterpriseLoginDialogState {
  switch (action.type) {
    case 'open':
      return state.open ? state : { open: true }
    case 'close':
      return state.open ? ENTERPRISE_LOGIN_DIALOG_CLOSED : state
    case 'nuwax':
      return action.status?.state === 'signed-in' ? ENTERPRISE_LOGIN_DIALOG_CLOSED : state
  }
}

export type EnterpriseLoginEntryAction = 'open-login' | 'logout'

export interface EnterpriseLoginEntry {
  readonly action: EnterpriseLoginEntryAction
  readonly label: string
  readonly disabled: boolean
}

/**
 * 账号区与侧栏共用的入口投影：**由 NUWAX 登录态驱动**（本刀之前它读的是企业连接态）。
 *
 * 未登录（含在途、含还没读到状态）一律是「登录」且**恒可点**——点开就是那面表单或那枚转圈；
 * 只有真的已登录才是退出，且在途的那次退出把行置灰（防重复提交）。
 */
export function enterpriseLoginEntry(
  nuwax: EnterpriseNuwaxStatus | undefined,
  busy: EnterpriseNuwaxBusy | undefined,
): EnterpriseLoginEntry {
  if (nuwax?.state === 'signed-in') {
    return { action: 'logout', label: busy === 'logout' ? '正在退出' : '退出登录', disabled: busy !== undefined }
  }
  return { action: 'open-login', label: busy === 'login' ? '登录进行中' : '登录', disabled: false }
}

export interface EnterpriseLoginDialogController {
  readonly open: boolean
  readonly openDialog: () => void
  readonly closeDialog: () => void
}

/**
 * 入口与弹窗共享的控制器。
 *
 * 关闭**不**取消任何东西：NUWAX 登录是一条单往返的本机 POST，没有宿主侧事务可撤销，关窗只是
 * 收起界面；那次请求照旧把它自己的结果写进共享快照（登录成功时弹窗也已经关着了）。
 */
export function useEnterpriseLoginDialog(store: EnterpriseAccountStore): EnterpriseLoginDialogController {
  const snapshot = useAccount(store)
  const [dialog, dispatch] = useReducer(enterpriseLoginDialogReducer, ENTERPRISE_LOGIN_DIALOG_CLOSED)
  const status = snapshot.nuwax
  useEffect(() => { dispatch({ type: 'nuwax', status }) }, [status])
  const openDialog = useCallback(() => { dispatch({ type: 'open' }) }, [])
  const closeDialog = useCallback(() => { dispatch({ type: 'close' }) }, [])
  return { open: dialog.open, openDialog, closeDialog }
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
/** 正文首个可操作控件：账号输入框优先，其次是正文动作按钮，最后才落到弹窗头部。 */
const PAGE_FOCUS = 'input:not([disabled]), .own-login button:not([disabled])'
/** 嵌套确认（退出/卸载）走自己的弹窗与焦点陷阱，弹窗壳在这一层让位。 */
const NESTED_CONFIRMATION = '[data-enterprise-confirmation]'

/** 弹窗卡片尺寸与键位动画；正文仍由 login-page 自持样式。 */
const style = `
  [role="dialog"]:has(.own-login) { box-sizing: border-box; max-height: calc(100vh - 48px); width: min(440px, calc(100vw - 48px)); }
  .own-login-content { min-height: 0; overflow-y: auto; }
  [role="dialog"]:has(.own-login) .own-login-spin { animation: own-login-rotate 1s linear infinite; }
  @keyframes own-login-rotate { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { [role="dialog"]:has(.own-login) .own-login-spin { animation: none; } }
`

const body: CSSProperties = { display: 'flex', flexDirection: 'column', width: '100%' }

export interface EnterpriseLoginDialogProps {
  readonly store: EnterpriseAccountStore
  readonly open: boolean
  readonly onClose: () => void
}

/**
 * 唯一登录弹窗：正文是 NUWAX 登录页（账号 + 口令）。
 * Esc、遮罩、关闭按钮都走同一个 onClose，焦点封闭在弹窗内并在关闭后归还。
 */
export function EnterpriseLoginDialog(props: EnterpriseLoginDialogProps): ReactNode {
  const snapshot = useAccount(props.store)
  // 标题与说明即企业名称与欢迎语；后台未配置或不可达时是内置默认，弹窗照常打开。
  const branding = useEnterpriseBranding(props.store)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(props.onClose)

  useEffect(() => { closeRef.current = props.onClose }, [props.onClose])
  // 官方 Modal 只提供 Esc/遮罩关闭；这里封闭 Tab 与外部聚焦，并隔离外层 Settings 的 Escape。
  useEffect(() => {
    if (!props.open) return
    const root = bodyRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (root === null || root === undefined) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const focusables = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element => !element.hidden)
    const first = root.querySelector<HTMLElement>(PAGE_FOCUS) ?? focusables()[0] ?? root
    first.focus()
    const keepInside = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest(NESTED_CONFIRMATION) !== null) return
      if (event.target instanceof Node && !root.contains(event.target)) (focusables()[0] ?? root).focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = focusables()
      const head = items[0]
      const tail = items.at(-1)
      if (head === undefined || tail === undefined) { event.preventDefault(); root.focus(); return }
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus() }
      if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus() }
    }
    document.addEventListener('focusin', keepInside)
    root.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('focusin', keepInside)
      root.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected === true) previous.focus()
    }
  }, [props.open])

  return <Modal
    contentClassName="own-login-content"
    open={props.open}
    onClose={props.onClose}
    closeLabel="关闭"
    title={branding.name}
    description={branding.headline}
  >
    <div ref={bodyRef} style={body}>
      <style>{style}</style>
      <EnterpriseNuwaxLoginPage branding={branding} snapshot={snapshot} store={props.store} />
    </div>
  </Modal>
}
