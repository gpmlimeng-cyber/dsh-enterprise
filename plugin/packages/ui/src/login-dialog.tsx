/**
 * [INPUT]: 依赖 React、Lucide、Harness Modal/Button、account-state 的状态文案、branding 的品牌读取层与 EnterpriseAccountStore 的脱敏快照和动作，正文来自 login-page 的原登录页内容
 * [OUTPUT]: 对外提供登录弹窗状态机 enterpriseLoginDialogReducer、入口投影 enterpriseLoginEntry、关闭语义 enterpriseLoginDialogCloseAction、提交计划 enterpriseLoginSubmitPlan 与 useEnterpriseLoginDialog/EnterpriseLoginDialog
 * [POS]: dsh-ui 唯一的登录弹窗壳，持有弹窗尺寸、焦点封闭、取消语义与提交计划，标题与说明取企业品牌（缺省内置），正文交给 login-page；弹窗关闭即结束本次登录，不再阻断宿主
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { LoaderCircle } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  enterpriseLoginInFlight,
  enterpriseServerEditable,
  enterpriseSessionUsable,
  useAccount,
} from './account-state.js'
import type { EnterpriseAccountAction, EnterpriseAccountStore } from './account-store.js'
import { useEnterpriseBranding } from './branding.js'
import type { EnterpriseConnectionState } from './local-api.js'
import { enterpriseLoginServerEditorVisible, EnterpriseLoginPage } from './login-page.js'

/** 弹窗开关是唯一状态；账号事实全部来自共享 store，此机不复制任何快照字段。 */
export interface EnterpriseLoginDialogState {
  readonly open: boolean
}

export const ENTERPRISE_LOGIN_DIALOG_CLOSED: EnterpriseLoginDialogState = { open: false }

export type EnterpriseLoginDialogAction =
  | { readonly type: 'open' }
  | { readonly type: 'close' }
  | { readonly type: 'status'; readonly state: EnterpriseConnectionState | undefined }

/**
 * 纯状态机：打开由入口触发，关闭由取消/Esc/遮罩触发；
 * 企业会话一旦可用即自动关闭，登录成功不需要额外命令。
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
    case 'status':
      return enterpriseSessionUsable(action.state) ? ENTERPRISE_LOGIN_DIALOG_CLOSED : state
  }
}

export type EnterpriseLoginEntryAction = 'open-login' | 'logout'

export interface EnterpriseLoginEntry {
  readonly action: EnterpriseLoginEntryAction
  readonly label: string
  readonly disabled: boolean
}

/** 账号区与侧栏共用的入口投影：未登录一律给登录入口，已连接才是退出登录。 */
export function enterpriseLoginEntry(
  state: EnterpriseConnectionState | undefined,
  busy: EnterpriseAccountAction | undefined,
): EnterpriseLoginEntry {
  const disabled = busy !== undefined
  if (enterpriseSessionUsable(state)) return { action: 'logout', label: '退出登录', disabled }
  if (enterpriseLoginInFlight(state)) return { action: 'open-login', label: '登录进行中', disabled }
  return { action: 'open-login', label: '登录', disabled }
}

/**
 * 关闭语义：正在授权/注册/同步时关闭弹窗即调用既有取消路径，避免留下无人认领的登录窗口；
 * 已在取消中就不再重复提交，其余状态关闭不触碰任何认证状态。
 */
export function enterpriseLoginDialogCloseAction(
  state: EnterpriseConnectionState | undefined,
  busy: EnterpriseAccountAction | undefined,
): 'cancel' | 'none' {
  return busy !== 'cancel' && enterpriseLoginInFlight(state) ? 'cancel' : 'none'
}

export type EnterpriseLoginSubmitPlan =
  | { readonly kind: 'reject'; readonly errorCode: string }
  | { readonly kind: 'login' }
  | { readonly kind: 'save-then-login'; readonly serverUrl: string }

/** 提交决策：留空沿用已保存地址，地址变化先保存再登录，两者都没有则拒绝。 */
export function enterpriseLoginSubmitPlan(input: string, savedUrl: string | null): EnterpriseLoginSubmitPlan {
  const target = input.trim() === '' ? (savedUrl ?? '') : input.trim()
  if (target === '') return { kind: 'reject', errorCode: 'ENT_INVALID_REQUEST' }
  if (target === savedUrl) return { kind: 'login' }
  return { kind: 'save-then-login', serverUrl: target }
}

export interface EnterpriseLoginDialogController {
  readonly open: boolean
  readonly openDialog: () => void
  readonly closeDialog: () => void
}

/**
 * 入口与弹窗共享的控制器；关闭时按关闭语义取消进行中的登录。
 * 快照始终取自 store，因此弹窗与账号区在同一提交里同步。
 */
export function useEnterpriseLoginDialog(store: EnterpriseAccountStore): EnterpriseLoginDialogController {
  const snapshot = useAccount(store)
  const [dialog, dispatch] = useReducer(enterpriseLoginDialogReducer, ENTERPRISE_LOGIN_DIALOG_CLOSED)
  const state = snapshot.status?.state
  const busy = snapshot.busy
  useEffect(() => { dispatch({ type: 'status', state }) }, [state])
  const openDialog = useCallback(() => { dispatch({ type: 'open' }) }, [])
  const closeDialog = useCallback(() => {
    if (enterpriseLoginDialogCloseAction(state, busy) === 'cancel') void store.cancelLogin()
    dispatch({ type: 'close' })
  }, [store, state, busy])
  return { open: dialog.open, openDialog, closeDialog }
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
/** 正文首个可操作控件：地址输入框优先，其次是正文动作按钮，最后才落到弹窗头部。 */
const PAGE_FOCUS = 'input:not([disabled]), .own-login button:not([disabled])'
/** 嵌套确认（登出/卸载）走自己的弹窗与焦点陷阱，弹窗壳在这一层让位。 */
const NESTED_CONFIRMATION = '[data-enterprise-confirmation]'

const footer: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }

/** 弹窗卡片尺寸与键位动画；正文仍由 login-page 自持样式。 */
const style = `
  [role="dialog"]:has(.own-login) { box-sizing: border-box; max-height: calc(100vh - 48px); width: min(440px, calc(100vw - 48px)); }
  .own-login-content { min-height: 0; overflow-y: auto; }
  [role="dialog"]:has(.own-login) .own-login-spin { animation: own-login-rotate 1s linear infinite; }
  @keyframes own-login-rotate { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { [role="dialog"]:has(.own-login) .own-login-spin { animation: none; } }
`

export interface EnterpriseLoginDialogProps {
  readonly store: EnterpriseAccountStore
  readonly open: boolean
  readonly onClose: () => void
}

/**
 * 唯一登录弹窗：正文是原全屏登录页的内容，壳只负责弹窗语义。
 * Esc、遮罩、取消按钮都走同一个 onClose，焦点封闭在弹窗内并在关闭后归还；
 * 地址变化时页脚的登录先保存再登录，正文已有登录入口时页脚不再重复一个主按钮。
 */
export function EnterpriseLoginDialog(props: EnterpriseLoginDialogProps): ReactNode {
  const snapshot = useAccount(props.store)
  // 标题与说明即企业名称与欢迎语；后台未配置或不可达时是内置默认，弹窗照常打开。
  const branding = useEnterpriseBranding(props.store)
  const status = snapshot.status
  const state = status?.state
  const busy = snapshot.busy
  const savedUrl = status?.platformUrl ?? null
  const editable = enterpriseServerEditable(state)
  const inFlight = enterpriseLoginInFlight(state)
  const [serverUrl, setServerUrl] = useState('')
  const [editingServer, setEditingServer] = useState(false)
  const [localError, setLocalError] = useState<string>()
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(props.onClose)
  /** 本次打开是否已经自动起跳过授权（防止取消后被 effect 立刻重启）。 */
  const autoStarted = useRef(false)
  const error = localError ?? snapshot.errorCode ?? status?.errorCode
  const submitting = busy !== undefined || inFlight
  const showServerEditor = enterpriseLoginServerEditorVisible(state, editingServer)

  useEffect(() => { closeRef.current = props.onClose }, [props.onClose])
  useEffect(() => {
    if (!props.open) return
    setServerUrl(savedUrl ?? '')
    setEditingServer(false)
    setLocalError(undefined)
  }, [props.open, savedUrl])
  /**
   * 打开即进入授权：地址已配置但未登录时，弹窗出来就该直接能输账号密码，
   * 不该再要求用户点一次「登录企业账号」；上一轮被用户取消（CANCELLED）同样如此。
   *
   * **必须用 useLayoutEffect**：useEffect 晚于首次绘制，会先画出一帧「未登录 + 登录企业账号」
   * 的旧视图，再被自动登录换成表单——那正是用户看到的"两个页面"。layout effect 在绘制前跑完，
   * startLogin 又是同步置 busy 的，于是首帧就已经是原生表单。
   *
   * 用 `autoStarted` 保证**每次打开只自动起跳一次**：否则对话框开着时点「取消登录」，
   * 状态一变成 CANCELLED 就会被这个 effect 立刻重启，取消按钮等于失效。
   * FAILED 刻意不自动重开——中心不可达时的自动重试只会变成打点循环，交回按钮由用户决定。
   */
  useLayoutEffect(() => {
    if (!props.open) {
      autoStarted.current = false
      return
    }
    if (autoStarted.current) return
    if (state !== 'SIGNED_OUT' && state !== 'CANCELLED') return
    autoStarted.current = true
    void (async () => {
      await props.store.startLogin()
      /**
       * 授权事务在宿主侧是后台建立的（要先 GET 授权 URL、再取来源，两次往返），
       * 而 store 的常规轮询是 1 秒一拍——只靠它，弹窗出来后输入控件要等一下才出现。
       * 这里在登录刚发起后做一段**有界**的快速追赶：命中即退出，最坏 1.8 秒后交回常规轮询。
       */
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (props.store.getSnapshot().status?.authorizeUrl !== undefined) return
        await new Promise(resolve => { setTimeout(resolve, 150) })
        await props.store.refresh()
      }
    })()
  }, [props.open, state, props.store])
  useEffect(() => { if (!editable) setEditingServer(false) }, [editable])
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

  const submit = () => {
    if (submitting) return
    const plan = enterpriseLoginSubmitPlan(serverUrl, savedUrl)
    if (plan.kind === 'reject') { setLocalError(plan.errorCode); return }
    setLocalError(undefined)
    void (async () => {
      // store 已把失败收敛成错误码；这里只兜住意外抛出，绝不把异常抛到顶层。
      try {
        if (plan.kind === 'save-then-login') {
          const saved = await props.store.setServerUrl(plan.serverUrl)
          if (!saved) return
        }
        await props.store.startLogin()
      } catch {
        setLocalError('ENT_LOCAL_UNAVAILABLE')
      }
    })()
  }

  return <Modal
    contentClassName="own-login-content"
    open={props.open}
    onClose={props.onClose}
    closeLabel="关闭"
    title={branding.name}
    description={branding.headline}
    // 页脚只在「用户主动点进修改地址」时出现：那里需要「存了再登录」这个合并动作。
    // 首次为空的引导步不算——那一步输入框旁的「保存」就够，页脚只会多出一个与 X 同义的
    // 「取消」和一个提前的「登录」。
    footer={editingServer ? <div style={footer}>
      <Button variant="outline" disabled={busy === 'cancel'} onClick={props.onClose}>取消</Button>
      <Button
        variant="primary"
        disabled={submitting || !editable}
        icon={submitting ? <LoaderCircle aria-hidden className="own-login-spin" size={15} /> : undefined}
        onClick={submit}
      >{busy === 'configure' ? '正在保存' : submitting ? '正在登录' : '登录'}</Button>
    </div> : undefined}
  >
    <div ref={bodyRef}>
      <style>{style}</style>
      <EnterpriseLoginPage
        branding={branding}
        errorCode={error}
        onLogin={submit}
        onServerEditingChange={setEditingServer}
        onServerUrlChange={(value) => { setServerUrl(value); setLocalError(undefined) }}
        serverUrl={serverUrl}
        showServerEditor={showServerEditor}
        snapshot={snapshot}
        store={props.store}
      />
    </div>
  </Modal>
}
