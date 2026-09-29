/**
 * [INPUT]: 依赖 React、Lucide、Harness Input/Button、brand 的品牌位图、account-state 的状态/错误/可编辑投影、account-actions 的登出与卸载确认，以及 EnterpriseAccountStore 的脱敏 snapshot 和动作
 * [OUTPUT]: 对外提供登录页正文 EnterpriseLoginPage 与两条纯投影 enterpriseLoginServerEditorVisible/enterpriseLoginPageAction
 * [POS]: dsh-ui 登录弹窗的正文呈现层，照搬原全屏登录页的内容与信息架构（品牌、状态、错误、Server 编辑、动作、页脚元信息、卸载），只被 login-dialog 组合，自身不含遮罩、焦点陷阱或任何阻断宿主的效果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  LoaderCircle,
  LogIn,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  Server,
  X,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { LogoutConfirmation, UninstallAction } from './account-actions.js'
import {
  ENTERPRISE_LOADING_PRESENTATION,
  enterpriseErrorDisplay,
  enterpriseLoginInFlight,
  enterpriseServerEditable,
  enterpriseSessionUsable,
  enterpriseStateIcon,
  enterpriseStatePresentation,
} from './account-state.js'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from './brand.js'
import type { EnterpriseConnectionState } from './local-api.js'

/**
 * 原件门禁的 Server 编辑时机（account-view.tsx:635）：只有可编辑且未配置、或用户显式点了「修改 Server 地址」时才展开编辑器。
 */
export function enterpriseLoginServerEditorVisible(state: EnterpriseConnectionState | undefined, editing: boolean): boolean {
  return enterpriseServerEditable(state) && (state === 'UNCONFIGURED' || editing)
}

/** 原件动作分支（account-view.tsx:376-396）：未配置无入口，迁移中取消，可用会话退出，其余登录。 */
export type EnterpriseLoginPageAction = 'none' | 'cancel-login' | 'logout' | 'login'

export function enterpriseLoginPageAction(state?: EnterpriseConnectionState): EnterpriseLoginPageAction {
  if (state === 'UNCONFIGURED') return 'none'
  if (enterpriseLoginInFlight(state)) return 'cancel-login'
  if (enterpriseSessionUsable(state)) return 'logout'
  return 'login'
}

const page: CSSProperties = {
  alignItems: 'center',
  color: 'var(--dsw-alias-label-primary, #101828)',
  display: 'flex',
  flexDirection: 'column',
  letterSpacing: 0,
  minWidth: 0,
  textAlign: 'center',
  width: '100%',
}

const brandIcon: CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.08)',
  display: 'block',
}

const stateRow: CSSProperties = { alignItems: 'center', display: 'flex', gap: 7, justifyContent: 'center', marginTop: 18 }

const stateTitle: CSSProperties = { fontSize: 13, fontWeight: 600, lineHeight: '20px' }

const stateDescription: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary, #667085)',
  fontSize: 12,
  lineHeight: '18px',
  margin: '6px 0 16px',
}

const alert: CSSProperties = {
  color: 'var(--dsw-alias-status-error, #c4320a)',
  fontSize: 13,
  lineHeight: '20px',
  margin: '0 0 16px',
  overflowWrap: 'anywhere',
}

const editor: CSSProperties = { alignItems: 'center', display: 'flex', gap: 8, minWidth: 0, width: '100%' }

const editorField: CSSProperties = { display: 'flex', flex: 1, minWidth: 0, position: 'relative' }

const editServer: CSSProperties = { marginTop: 10 }

const meta: CSSProperties = {
  alignItems: 'center',
  borderTop: '1px solid var(--dsw-alias-stroke-border-2, #e4e7ec)',
  color: 'var(--dsw-alias-label-tertiary, #667085)',
  display: 'flex',
  fontSize: 12,
  gap: 8,
  justifyContent: 'space-between',
  marginTop: 20,
  paddingTop: 14,
  width: '100%',
}

const metaSource: CSSProperties = { alignItems: 'center', display: 'flex', gap: 8, minWidth: 0 }

const metaValue: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const actions: CSSProperties = { alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 14, width: '100%' }

const restart: CSSProperties = { color: 'var(--dsw-alias-status-warning, #b54708)', fontSize: 13, margin: '12px 0 0' }

/** 弹窗正文的样式块与原件同源；档位/焦点环都取自宿主 token，键位动画由弹窗壳统一提供。 */
const style = `
  .own-login input:focus-visible, .own-login button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 2px; }
  .own-login .own-login-field { height: 36px; width: 100%; }
  .own-login .own-login-url input { padding-right: 22px; }
  .own-login .own-login-clear { align-items: center; background: transparent; border: 0; color: var(--dsw-alias-label-tertiary, #98a2b3); cursor: pointer; display: inline-flex; justify-content: center; padding: 3px; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
  .own-login .own-account-uninstall { color: var(--dsw-alias-label-tertiary, #667085); }
  .own-login .own-account-uninstall:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary, #c4320a); }
`

export interface EnterpriseLoginPageProps {
  readonly store: EnterpriseAccountStore
  readonly snapshot: EnterpriseAccountSnapshot
  /** 受控字段值由弹窗壳持有，弹窗页脚的提交计划与之一致。 */
  readonly serverUrl: string
  readonly errorCode: string | undefined
  readonly showServerEditor: boolean
  readonly onServerUrlChange: (value: string) => void
  readonly onServerEditingChange: (editing: boolean) => void
  readonly onLogin: () => void
}

/** Server 地址编辑器：原件 account-view.tsx:421-458 的字段、清空按钮与保存动作。 */
function ServerUrlEditor({ store, serverUrl, busy, saving, onServerUrlChange, onSaved }: {
  store: EnterpriseAccountStore
  serverUrl: string
  busy: boolean
  saving: boolean
  onServerUrlChange: (value: string) => void
  onSaved: () => void
}): ReactNode {
  return <form
    style={editor}
    onSubmit={(event) => {
      event.preventDefault()
      void store.setServerUrl(serverUrl.trim()).then(saved => { if (saved) onSaved() })
    }}
  >
    <span className="own-login-url" style={editorField}>
      <Input
        aria-label="DSH Enterprise Server 地址"
        autoComplete="url"
        className="own-login-field"
        disabled={busy}
        icon={<Server aria-hidden size={14} />}
        onChange={event => { onServerUrlChange(event.currentTarget.value) }}
        placeholder="http://owndsh.example.com"
        required
        spellCheck={false}
        type="url"
        value={serverUrl}
      />
      {serverUrl === '' ? null : <button
        aria-label="清空 Server 地址" className="own-login-clear" disabled={busy}
        onClick={() => { onServerUrlChange('') }} title="清空" type="button"
      ><X aria-hidden size={16} /></button>}
    </span>
    <Button
      variant="primary"
      disabled={busy || serverUrl.trim() === ''}
      icon={saving ? <LoaderCircle aria-hidden className="own-login-spin" size={15} /> : <Save aria-hidden size={15} />}
      type="submit"
    >{saving ? '正在保存' : '保存'}</Button>
  </form>
}

/** 原件登录/取消/登出动作（account-view.tsx:376-396），登录统一走弹窗的提交计划。 */
function LoginActions({ store, snapshot, action, onLogin }: {
  store: EnterpriseAccountStore
  snapshot: EnterpriseAccountSnapshot
  action: EnterpriseLoginPageAction
  onLogin: () => void
}): ReactNode {
  const busy = snapshot.busy !== undefined
  if (action === 'none') return null
  if (action === 'cancel-login') return <Button
    variant="outline"
    disabled={busy}
    icon={<X aria-hidden size={15} />}
    onClick={() => { void store.cancelLogin() }}
  >{snapshot.busy === 'cancel' ? '正在取消' : '取消登录'}</Button>
  if (action === 'logout') return <LogoutConfirmation store={store} disabled={busy}>{open => <Button
    variant="outline"
    disabled={busy}
    icon={<LogOut aria-hidden size={14} />}
    onClick={open}
  >{snapshot.busy === 'logout' ? '正在退出' : '退出登录'}</Button>}</LogoutConfirmation>
  return <Button
    variant="primary"
    disabled={busy}
    icon={<LogIn aria-hidden size={15} />}
    onClick={onLogin}
  >{snapshot.busy === 'login' ? '正在启动' : '登录企业账号'}</Button>
}

/**
 * 登录弹窗的正文：品牌图、状态与说明、错误、Server 编辑器或登录动作、页脚元信息与卸载。
 * 只读快照 + 回调，不发请求、不开弹窗，也不关闭宿主任何界面。
 */
export function EnterpriseLoginPage(props: EnterpriseLoginPageProps): ReactNode {
  const status = props.snapshot.status
  const state = status?.state
  const busy = props.snapshot.busy !== undefined
  const action = enterpriseLoginPageAction(state)
  const presentation = state === undefined ? ENTERPRISE_LOADING_PRESENTATION : enterpriseStatePresentation(state)
  const errorDisplay = props.errorCode === undefined ? undefined : enterpriseErrorDisplay(props.errorCode)
  const canEditServer = enterpriseServerEditable(state)
  const configured = status?.platformUrl ?? null

  return <div className="own-login" style={page}>
    <style>{style}</style>
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={DSHENT_ICON} />
      <img alt="" aria-hidden height={48} src={DSHENT_ANIMATED_ICON} style={brandIcon} width={48} />
    </picture>
    <div data-enterprise-state={state ?? props.snapshot.phase} role="status" style={stateRow}>
      {enterpriseStateIcon(presentation, 16, presentation.icon === 'progress' ? 'own-login-spin' : undefined)}
      <span style={stateTitle}>{presentation.title}</span>
    </div>
    <p style={stateDescription} title={presentation.description}>{presentation.description}</p>
    {errorDisplay === undefined ? null : <p role="alert" style={alert}>
      {errorDisplay.message}{errorDisplay.code === undefined ? null : <> <code>{errorDisplay.code}</code></>}
    </p>}
    {props.showServerEditor
      ? <ServerUrlEditor
        busy={busy}
        onSaved={() => { props.onServerEditingChange(false) }}
        onServerUrlChange={props.onServerUrlChange}
        saving={props.snapshot.busy === 'configure'}
        serverUrl={props.serverUrl}
        store={props.store}
      />
      : <LoginActions action={action} onLogin={props.onLogin} snapshot={props.snapshot} store={props.store} />}
    {!canEditServer || configured === null || props.showServerEditor ? null : <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      icon={<Pencil aria-hidden size={14} />}
      onClick={() => { props.onServerEditingChange(true) }}
      style={editServer}
    >修改 Server 地址</Button>}
    <div style={meta}>
      <span style={metaSource}>
        <span aria-hidden style={{ background: configured === null ? 'var(--dsw-alias-label-disabled, #d0d5dd)' : presentation.color, borderRadius: '50%', flex: 'none', height: 6, width: 6 }} />
        <span style={metaValue} title={configured ?? undefined}>{configured ?? '尚未配置 Server'}</span>
      </span>
      <span style={{ flex: 'none' }}>v{status?.bundleVersion ?? '0.1.0'}</span>
    </div>
    <div style={actions}>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        icon={<RefreshCw aria-hidden size={14} />}
        onClick={() => { void props.store.refresh(true) }}
        title="获取最新账号、设备和企业配置"
      >刷新配置</Button>
      <UninstallAction quiet snapshot={props.snapshot} store={props.store} />
    </div>
    {props.snapshot.uninstallRestartRequested === false ? <p role="status" style={restart}>
      DSH Enterprise 已卸载，请手动重启 Harness。
    </p> : null}
  </div>
}
