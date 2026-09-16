/**
 * [INPUT]: 依赖 React、Lucide、Harness Button/Settings close、ConfirmAction、DSH Enterprise 鲸图与 EnterpriseAccountStore 的脱敏 snapshot 和动作
 * [OUTPUT]: 提供只读账号设置、插件/配方 tabs、共享登出确认与全局门禁；Server 仅在无活动会话的门禁中编辑，保存成功才收起
 * [POS]: dsh-ui 的账号设置与门禁呈现层，和 account-footer 复用品牌资源且不接触 Host Context、Token 或执行细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Building2,
  CircleAlert,
  CircleCheck,
  Laptop,
  LoaderCircle,
  LogIn,
  LogOut,
  Package,
  Pencil,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseAccountSnapshot } from './account-store.js'
import { EnterpriseAccountStore } from './account-store.js'
import { ConfirmAction } from './confirm-action.js'
import { EnterprisePluginMarket } from './plugin-market.js'
export { enterprisePluginStatePresentation } from './plugin-market.js'
import { EnterprisePresetMarket } from './preset-market.js'
import { EnterpriseSessionSyncView } from './session-view.js'
import type {
  EnterpriseConnectionState,
} from './local-api.js'

export const DSHENT_ICON = 'data:image/png;base64,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'

const DSHENT_ANIMATED_ICON = 'data:image/png;base64,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'

export interface EnterpriseStoreInjected {
  readonly store: EnterpriseAccountStore
}

export interface EnterpriseSettingsSectionProps extends EnterpriseStoreInjected {
  readonly close: () => void
}

export interface EnterpriseAccessGateProps extends EnterpriseStoreInjected {}

interface StatePresentation {
  readonly title: string
  readonly description: string
  readonly color: string
  readonly icon: 'building' | 'success' | 'progress' | 'warning' | 'error'
}

const CONNECTION_PRESENTATION: Record<EnterpriseConnectionState, StatePresentation> = {
  UNCONFIGURED: {
    title: '配置企业服务',
    description: '设置 DSH Enterprise Server 地址后即可登录',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'building',
  },
  SIGNED_OUT: {
    title: '未登录',
    description: '尚未连接企业服务',
    color: 'var(--dsw-alias-label-tertiary, #667085)',
    icon: 'building',
  },
  AUTHORIZING: {
    title: '等待授权',
    description: '请在系统浏览器中完成企业登录',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'progress',
  },
  ENROLLING: {
    title: '正在注册设备',
    description: '正在建立此设备的独立企业会话',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'progress',
  },
  BOOTSTRAPPING: {
    title: '正在同步配置',
    description: '正在读取账号与设备策略',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'progress',
  },
  READY: {
    title: '已登录',
    description: '企业账号和设备会话均可用',
    color: 'var(--dsw-alias-state-success-primary, #16803c)',
    icon: 'success',
  },
  CANCELLED: {
    title: '登录已取消',
    description: '本次授权未产生企业会话',
    color: 'var(--dsw-alias-label-tertiary, #667085)',
    icon: 'building',
  },
  FAILED: {
    title: '登录失败',
    description: '企业服务未能完成本次登录',
    color: 'var(--dsw-alias-status-error, #c4320a)',
    icon: 'error',
  },
  REFRESHING: {
    title: '正在刷新',
    description: '现有会话可用，正在同步最新策略',
    color: 'var(--dsw-alias-status-warning, #b54708)',
    icon: 'progress',
  },
  AUTH_EXPIRED: {
    title: '登录已过期',
    description: '企业会话已失效，请重新登录',
    color: 'var(--dsw-alias-status-warning, #b54708)',
    icon: 'warning',
  },
  DEVICE_REVOKED: {
    title: '设备已撤销',
    description: '此设备不再具有企业访问权限',
    color: 'var(--dsw-alias-status-error, #c4320a)',
    icon: 'error',
  },
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ENT_INVALID_REQUEST: '请输入有效的 HTTP 或 HTTPS Server 地址。',
  ENT_AUTH_CANCELLED: '登录已取消。',
  ENT_AUTH_REQUIRED: '需要重新登录企业账号。',
  ENT_AUTH_SESSION_EXPIRED: '企业登录已过期。',
  ENT_AUTH_TIMEOUT: '登录等待超时，请重试。',
  ENT_DEVICE_REVOKED: '此设备已被管理员撤销。',
  ENT_LOCAL_RESPONSE_INVALID: '本地企业服务返回了无效数据。',
  ENT_PLATFORM_UNAVAILABLE: '暂时无法连接企业服务。',
  ENT_LOCAL_UNAVAILABLE: '暂时无法连接本机 Harness，请重试。',
}

const page: CSSProperties = {
  color: 'var(--dsw-alias-label-primary, #101828)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  letterSpacing: 0,
  maxWidth: 680,
  minWidth: 0,
}

const panel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  minWidth: 0,
}

const heading: CSSProperties = { fontSize: 18, fontWeight: 600, lineHeight: '26px', margin: 0 }

const tabs: CSSProperties = {
  alignItems: 'flex-end',
  borderBottom: '1px solid var(--dsw-alias-border-l2, #e4e7ec)',
  display: 'flex',
  gap: 22,
  marginTop: 2,
}

const tab: CSSProperties = {
  background: 'transparent',
  border: 0,
  borderBottom: '2px solid transparent',
  color: 'var(--dsw-alias-label-tertiary, #667085)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '20px',
  marginBottom: -1,
  padding: '7px 1px 8px',
}

function tabStyle(active: boolean): CSSProperties {
  return active ? {
    ...tab,
    borderBottomColor: 'var(--dsw-alias-label-primary, #101828)',
    color: 'var(--dsw-alias-label-primary, #101828)',
  } : { ...tab, borderBottomColor: 'transparent' }
}

const detailList: CSSProperties = {
  // 宿主超椭圆边角需要实体底色，避免半透明边框在透明层上画出直角残影。
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  border: '1px solid var(--dsw-alias-border-l2, #e4e7ec)',
  borderRadius: 10,
  display: 'flex',
  flexDirection: 'column',
  marginTop: 14,
  overflow: 'hidden',
}

const detailRow: CSSProperties = {
  alignItems: 'center',
  boxSizing: 'border-box',
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'clamp(76px, 22%, 110px) minmax(0, 1fr)',
  minHeight: 50,
  padding: '10px 12px',
}

const detailLabel: CSSProperties = {
  alignItems: 'center',
  color: 'var(--dsw-alias-label-secondary, #475467)',
  display: 'flex',
  fontSize: 13,
  gap: 8,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
}

const detailValue: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  lineHeight: '20px',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const actions: CSSProperties = { alignItems: 'center', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingTop: 16 }

const baseButton: CSSProperties = {
  alignItems: 'center',
  border: '1px solid transparent',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'inline-flex',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  gap: 7,
  height: 34,
  justifyContent: 'center',
  padding: '0 14px',
}

const primaryButton: CSSProperties = {
  ...baseButton,
  background: 'var(--dsw-alias-accent-primary, #2563eb)',
  color: 'var(--dsw-alias-label-on-primary, #fff)',
}

const secondaryButton: CSSProperties = {
  ...baseButton,
  background: 'var(--dsw-alias-bg-layer-2, #fff)',
  borderColor: 'var(--dsw-alias-stroke-border-2, #d0d5dd)',
  color: 'var(--dsw-alias-label-primary, #101828)',
}

const accessGate: CSSProperties = {
  alignItems: 'center',
  background: 'var(--dsw-alias-bg-layer-2, #fff)',
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-primary, #101828)',
  display: 'flex',
  inset: 0,
  justifyContent: 'center',
  overflowY: 'auto',
  padding: 'clamp(28px, 6vh, 64px) 24px',
  pointerEvents: 'auto',
  position: 'absolute',
}

const accessContent: CSSProperties = {
  alignItems: 'center',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 440,
  textAlign: 'center',
  width: '100%',
}

const serverInput: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2, #fff)',
  border: '1px solid var(--dsw-alias-stroke-border-2, #d0d5dd)',
  borderRadius: 8,
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-primary, #101828)',
  font: 'inherit',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 14,
  height: 40,
  minWidth: 0,
  outlineColor: 'var(--dsw-alias-accent-primary, #2563eb)',
  padding: '0 38px 0 13px',
  width: '100%',
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function gateFocusables(root: HTMLElement): readonly HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element => !element.hidden)
}

function trapGateTab(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return
  const root = event.currentTarget
  const focusable = gateFocusables(root)
  if (focusable.length === 0) {
    event.preventDefault()
    root.focus()
    return
  }
  const first = focusable[0]
  const last = focusable.at(-1)
  if (first === undefined || last === undefined) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function useAccount(store: EnterpriseAccountStore): EnterpriseAccountSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/** 状态文案是固定产品词汇，不透传服务端 message。 */
export function enterpriseStatePresentation(state: EnterpriseConnectionState): StatePresentation {
  return CONNECTION_PRESENTATION[state]
}

export function enterpriseErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? '企业服务操作失败。'
}

export function enterpriseAccessBlocked(state?: EnterpriseConnectionState): boolean {
  return state !== 'READY' && state !== 'REFRESHING'
}

export function enterpriseServerEditable(state?: EnterpriseConnectionState): boolean {
  return state !== undefined && ['UNCONFIGURED', 'SIGNED_OUT', 'CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED'].includes(state)
}

/** 两个账号入口共享页面确认，取消时不触发任何认证状态变更。 */
export function LogoutConfirmation({ store, disabled, children }: {
  store: Pick<EnterpriseAccountStore, 'logout'>
  disabled: boolean
  children: (open: () => void) => ReactNode
}): ReactNode {
  return <ConfirmAction title="退出 DSH Enterprise" description="确定退出 DSH Enterprise 吗？" confirmLabel="退出登录"
    disabled={disabled} onConfirm={() => { void store.logout() }}>{children}</ConfirmAction>
}

function StateIcon({ presentation, size = 20 }: { presentation: StatePresentation; size?: number }): ReactNode {
  const props = { 'aria-hidden': true, color: presentation.color, size, strokeWidth: 2 }
  if (presentation.icon === 'success') return createElement(CircleCheck, props)
  if (presentation.icon === 'progress') return createElement(LoaderCircle, props)
  if (presentation.icon === 'warning') return createElement(ShieldAlert, props)
  if (presentation.icon === 'error') return createElement(CircleAlert, props)
  return createElement(Building2, props)
}

function LoginActions({ store, snapshot }: { store: EnterpriseAccountStore; snapshot: EnterpriseAccountSnapshot }): ReactNode {
  const state = snapshot.status?.state
  const disabled = snapshot.busy !== undefined
  const authenticating = state === 'AUTHORIZING' || state === 'ENROLLING' || state === 'BOOTSTRAPPING'
  const connected = state === 'READY' || state === 'REFRESHING'
  if (state === 'UNCONFIGURED') return null
  if (authenticating) {
    return <button type="button" style={secondaryButton} disabled={disabled} onClick={() => { void store.cancelLogin() }}>
      <X aria-hidden size={15} />{snapshot.busy === 'cancel' ? '正在取消' : '取消登录'}
    </button>
  }
  if (connected) {
    return <LogoutConfirmation store={store} disabled={disabled}>{open => <Button variant="outline" size="sm"
      icon={<LogOut aria-hidden size={14} />} disabled={disabled} onClick={open}>
      {snapshot.busy === 'logout' ? '正在退出' : '退出登录'}
    </Button>}</LogoutConfirmation>
  }
  return <button type="button" style={primaryButton} disabled={disabled} onClick={() => { void store.startLogin() }}>
    <LogIn aria-hidden size={15} />{snapshot.busy === 'login' ? '正在启动' : '登录企业账号'}
  </button>
}

function UninstallAction({ store, snapshot, quiet = false }: { store: EnterpriseAccountStore; snapshot: EnterpriseAccountSnapshot; quiet?: boolean }): ReactNode {
  return <ConfirmAction title="卸载 DSH Enterprise" description="将移除 DSH Enterprise 与全部受管插件。确定继续吗？" confirmLabel="确认卸载"
    disabled={snapshot.busy !== undefined} onConfirm={() => { void store.uninstall() }}>{open => <Button
    variant={quiet ? 'ghost' : 'outline'} size={quiet ? 'sm' : 'md'}
    className={quiet ? 'own-account-uninstall' : undefined}
    style={quiet ? undefined : { color: 'var(--dsw-alias-state-error-primary, #c4320a)' }}
    icon={<Trash2 aria-hidden size={14} />}
    disabled={snapshot.busy !== undefined}
    onClick={open}
  >
    {snapshot.busy === 'uninstall' ? '正在卸载' : '卸载 DSH Enterprise'}
  </Button>}</ConfirmAction>
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }): ReactNode {
  return <div style={detailRow} className="own-account-row">
    <div style={detailLabel}>{icon}{label}</div>
    <div style={{ alignItems: 'center', display: 'flex', gap: 8, minWidth: 0 }}>
      <div style={detailValue} title={value}>{value}</div>
    </div>
  </div>
}

function ServerUrlEditor({
  store,
  snapshot,
  onSaved,
}: { store: EnterpriseAccountStore; snapshot: EnterpriseAccountSnapshot; onSaved?: () => void }): ReactNode {
  const current = snapshot.status?.platformUrl ?? ''
  const [serverUrl, setServerUrl] = useState(current)
  useEffect(() => { setServerUrl(current) }, [current])

  return <form
    style={{ display: 'flex', gap: 8, minWidth: 0, width: '100%' }}
    onSubmit={(event) => {
      event.preventDefault()
      void store.setServerUrl(serverUrl.trim()).then(saved => { if (saved) onSaved?.() })
    }}
  >
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <input
        aria-label="DSH Enterprise Server 地址"
        autoComplete="url"
        disabled={snapshot.busy !== undefined}
        onChange={event => { setServerUrl(event.currentTarget.value) }}
        placeholder="http://owndsh.example.com"
        required spellCheck={false} style={serverInput} type="url" value={serverUrl}
      />
      {serverUrl === '' ? null : <button
        aria-label="清空 Server 地址" disabled={snapshot.busy !== undefined} onClick={() => { setServerUrl('') }}
        style={{ background: 'transparent', border: 0, color: 'var(--dsw-alias-label-tertiary, #98a2b3)', cursor: 'pointer', padding: 5, position: 'absolute', right: 7, top: 7 }}
        title="清空" type="button"
      ><X aria-hidden size={16} /></button>}
    </div>
    <button type="submit" style={{ ...primaryButton, height: 40, padding: '0 16px' }} disabled={snapshot.busy !== undefined || serverUrl.trim() === ''}>
      {snapshot.busy === 'configure'
        ? <><LoaderCircle aria-hidden size={15} />正在保存</>
        : <><Save aria-hidden size={15} />保存</>}
    </button>
  </form>
}

function EnterpriseAccountContent({ store }: EnterpriseStoreInjected): ReactNode {
  const snapshot = useAccount(store)
  const status = snapshot.status
  const presentation = status === undefined
    ? { title: '正在连接', description: '正在读取本地企业服务状态', color: '#667085', icon: 'progress' as const }
    : enterpriseStatePresentation(status.state)
  const bootstrap = snapshot.bootstrap
  const user = bootstrap?.user ?? status?.user
  const username = user === undefined ? '企业账号' : user.displayName === user.username ? user.displayName : `${user.displayName} (${user.username})`
  const error = snapshot.errorCode ?? status?.errorCode

  return <div style={panel} className="own-account">
    {error === undefined ? null : <div role="alert" style={{ color: 'var(--dsw-alias-status-error, #c4320a)', fontSize: 13, lineHeight: '20px', paddingBottom: 12 }}>
      {enterpriseErrorMessage(error)} <code>{error}</code>
    </div>}
    <div className="own-account-summary" style={{ alignItems: 'center', background: 'var(--dsw-alias-bg-layer-1, #f8fafc)', border: '1px solid var(--dsw-alias-border-l2, #e4e7ec)', borderRadius: 10, display: 'flex', gap: 10, padding: 12 }}>
      <div style={{ alignItems: 'center', background: 'var(--dsw-alias-bg-layer-2, #f2f4f7)', borderRadius: '50%', color: 'var(--dsw-alias-label-secondary, #475467)', display: 'flex', flexShrink: 0, height: 34, justifyContent: 'center', width: 34 }}>
        <UserRound aria-hidden size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div title={username} style={{ ...detailValue, fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>{username}</div>
        <div title={presentation.description} style={{ ...detailValue, color: 'var(--dsw-alias-label-tertiary, #667085)', fontFamily: 'inherit', fontSize: 11 }}>{presentation.description}</div>
      </div>
      <span role="status" title={presentation.description} data-enterprise-state={status?.state ?? snapshot.phase}
        style={{ alignItems: 'center', background: 'var(--dsw-alias-bg-layer-2, #fff)', border: '1px solid var(--dsw-alias-border-l2, #e4e7ec)', borderRadius: 999, color: 'var(--dsw-alias-label-secondary, #475467)', display: 'inline-flex', flexShrink: 0, gap: 4, fontSize: 11, lineHeight: '18px', padding: '3px 8px', whiteSpace: 'nowrap' }}>
        <StateIcon presentation={presentation} size={13} />{presentation.title}
      </span>
    </div>
    <div style={detailList}>
      <Detail icon={<Server aria-hidden size={14} />} label="平台地址" value={status?.platformUrl ?? '未配置'} />
      <Detail icon={<Laptop aria-hidden size={14} />} label="设备" value={bootstrap === undefined ? '登录后可用' : `${bootstrap.device.id} · ${bootstrap.device.installationId}`} />
      <Detail icon={<Package aria-hidden size={14} />} label="插件版本" value={status?.bundleVersion ?? '正在读取'} />
    </div>
    <div style={actions}>
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="outline" size="sm" title="获取最新账号、设备和企业配置" icon={<RefreshCw aria-hidden size={14} />}
          disabled={snapshot.busy !== undefined} onClick={() => { void store.refresh(true) }}>刷新配置</Button>
        <LoginActions store={store} snapshot={snapshot} />
      </div>
      <UninstallAction store={store} snapshot={snapshot} quiet />
    </div>
    {snapshot.uninstallRestartRequested === false ? <div role="status" style={{ color: 'var(--dsw-alias-status-warning, #b54708)', fontSize: 13 }}>
      DSH Enterprise 已卸载，请手动重启 Harness。
    </div> : null}
  </div>
}

/** 官方 `settings.section` 内的 DSH Enterprise 账号、插件与配方 tabs。 */
export function EnterpriseSettingsSection(props: EnterpriseSettingsSectionProps): ReactNode {
  useEffect(() => { void props.store.refresh(true) }, [props.store])
  const state = useAccount(props.store).status?.state
  useEffect(() => {
    if (state !== undefined && enterpriseAccessBlocked(state)) props.close()
  }, [state, props.close])
  const headingId = useId()
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeTab, setActiveTab] = useState<'account' | 'plugins' | 'presets' | 'sessions'>('account')
  const snapshot = useAccount(props.store)
  const sessionSyncEnabled = snapshot.bootstrap?.sessionPolicyEnabled === true
  const rows = [
    { id: 'account', label: '账号' },
    { id: 'plugins', label: '插件' },
    { id: 'presets', label: '配方' },
    ...(sessionSyncEnabled ? [{ id: 'sessions' as const, label: '会话同步' }] : []),
  ] as const
  useEffect(() => {
    if (!sessionSyncEnabled && activeTab === 'sessions') setActiveTab('account')
  }, [sessionSyncEnabled, activeTab])
  return <section className="own-settings" style={page} aria-labelledby={headingId}>
    <style>{`
      .own-account button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 2px; }
      .own-account-row + .own-account-row { border-top: 1px solid var(--dsw-alias-border-l2, #e4e7ec); }
      .own-account .own-account-uninstall { color: var(--dsw-alias-label-tertiary, #667085); }
      .own-account .own-account-uninstall:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary, #c4320a); }
      @media (max-width: 600px) {
        [role="dialog"]:has(.own-settings) { flex-direction: column; width: calc(100vw - 24px); max-width: calc(100vw - 24px); }
        [role="dialog"]:has(.own-settings) > nav { width: 100%; padding: 12px 12px 0; gap: 8px; }
        [role="dialog"]:has(.own-settings) > nav > div:last-child { flex-direction: row; overflow-x: auto; }
        [role="dialog"]:has(.own-settings) > nav button { flex: none; }
        [role="dialog"]:has(.own-settings) > nav + div { min-height: 0; }
        [role="dialog"]:has(.own-settings) > nav + div > div:first-child { height: 36px; padding: 4px 12px; }
        [role="dialog"]:has(.own-settings) > nav + div > div:last-child { padding: 0 16px 16px; }
      }
    `}</style>
    <h2 id={headingId} style={{ ...heading, alignItems: 'center', display: 'flex', gap: 9 }}>
      <img alt="" aria-hidden src={DSHENT_ICON} style={{ borderRadius: 6, height: 24, width: 24 }} />
      DSH Enterprise 设置
    </h2>
    <div role="tablist" aria-label="DSH Enterprise 设置" style={tabs}>
      {rows.map((row, index) => {
        const selected = activeTab === row.id
        return <button
          key={row.id}
          ref={(element) => { tabRefs.current[index] = element }}
          id={`${tabsId}-tab-${row.id}`}
          role="tab"
          aria-controls={`${tabsId}-panel-${row.id}`}
          aria-selected={selected}
          tabIndex={selected ? 0 : -1}
          type="button"
          style={tabStyle(selected)}
          onClick={() => {
            setActiveTab(row.id)
            if (row.id === 'plugins') void props.store.refreshPlugins()
          }}
          onKeyDown={(event) => {
            let nextIndex: number
            switch (event.key) {
              case 'ArrowRight': nextIndex = (index + 1) % rows.length; break
              case 'ArrowLeft': nextIndex = (index - 1 + rows.length) % rows.length; break
              case 'Home': nextIndex = 0; break
              case 'End': nextIndex = rows.length - 1; break
              default: return
            }
            event.preventDefault()
            const next = rows[nextIndex]
            if (next === undefined) return
            setActiveTab(next.id)
            if (next.id === 'plugins') void props.store.refreshPlugins()
            tabRefs.current[nextIndex]?.focus()
          }}
        >{row.label}</button>
      })}
    </div>
    <div id={`${tabsId}-panel-account`} role="tabpanel" aria-labelledby={`${tabsId}-tab-account`} hidden={activeTab !== 'account'}>
      <EnterpriseAccountContent store={props.store} />
    </div>
    <div id={`${tabsId}-panel-plugins`} role="tabpanel" aria-labelledby={`${tabsId}-tab-plugins`} hidden={activeTab !== 'plugins'}>
      {activeTab === 'plugins' ? <EnterprisePluginMarket store={props.store} /> : null}
    </div>
    <div id={`${tabsId}-panel-presets`} role="tabpanel" aria-labelledby={`${tabsId}-tab-presets`} hidden={activeTab !== 'presets'}>
      {activeTab === 'presets' ? <EnterprisePresetMarket store={props.store} /> : null}
    </div>
    {sessionSyncEnabled ? <div id={`${tabsId}-panel-sessions`} role="tabpanel" aria-labelledby={`${tabsId}-tab-sessions`} hidden={activeTab !== 'sessions'}>
      {activeTab === 'sessions' ? <EnterpriseSessionSyncView store={props.store} /> : null}
    </div> : null}
  </section>
}

/** 官方 `shell.overlay` 全局门禁；未配置、未登录和失效状态都阻断宿主交互。 */
export function EnterpriseAccessGate(props: EnterpriseAccessGateProps): ReactNode {
  const snapshot = useAccount(props.store)
  const status = snapshot.status
  const [editingServer, setEditingServer] = useState(false)
  const gateRef = useRef<HTMLElement | null>(null)
  const blocked = enterpriseAccessBlocked(status?.state)
  const canEditServer = enterpriseServerEditable(status?.state)
  useEffect(() => { if (!canEditServer) setEditingServer(false) }, [canEditServer])
  useEffect(() => {
    if (!blocked) return
    const root = gateRef.current
    if (root === null) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const keepInside = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('[data-enterprise-confirmation]')) return
      if (event.target instanceof Node && !root.contains(event.target)) {
        const first = gateFocusables(root)[0] ?? root
        first.focus()
      }
    }
    const first = gateFocusables(root)[0] ?? root
    first.focus()
    document.addEventListener('focusin', keepInside)
    return () => {
      document.removeEventListener('focusin', keepInside)
      if (previous?.isConnected === true) previous.focus()
    }
  }, [blocked, status?.state])
  if (!blocked) return null

  const presentation = status === undefined
    ? { title: '正在启动', description: '正在读取本地企业服务状态', color: '#667085', icon: 'progress' as const }
    : enterpriseStatePresentation(status.state)
  const error = snapshot.errorCode ?? status?.errorCode
  const showServerEditor = canEditServer && (status?.state === 'UNCONFIGURED' || editingServer)

  return <section ref={gateRef} style={accessGate} role="dialog" aria-modal="true"
    aria-labelledby="enterprise-access-title" tabIndex={-1} onKeyDown={trapGateTab}>
    <div style={accessContent} data-enterprise-access-state={status?.state ?? snapshot.phase}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={DSHENT_ICON} />
        <img alt="" aria-hidden height={48} src={DSHENT_ANIMATED_ICON} style={{ borderRadius: 12, boxShadow: '0 1px 2px rgba(16, 24, 40, 0.08)', display: 'block' }} width={48} />
      </picture>
      <h1 id="enterprise-access-title" style={{ fontSize: 28, fontWeight: 650, lineHeight: '36px', margin: '18px 0 0' }}>
        DSH Enterprise
      </h1>
      <p style={{ color: 'var(--dsw-alias-label-secondary, #475467)', fontSize: 13, lineHeight: '20px', margin: '5px 0 0' }}>
        DSH Enterprise - Truly Own Your DeepSeek-Harness
      </p>
      <div style={{ marginTop: 38, width: '100%' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 7, justifyContent: 'center' }}>
          <StateIcon presentation={presentation} size={16} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{presentation.title}</span>
        </div>
        <p style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12, lineHeight: '18px', margin: '6px 0 16px' }}>
          {presentation.description}
        </p>
        {error === undefined ? null : <p role="alert" style={{ color: 'var(--dsw-alias-status-error, #c4320a)', fontSize: 13, lineHeight: '20px', margin: '0 0 16px' }}>
          {enterpriseErrorMessage(error)} <code>{error}</code>
        </p>}
        {showServerEditor
          ? <ServerUrlEditor store={props.store} snapshot={snapshot} onSaved={() => { setEditingServer(false) }} />
          : <LoginActions store={props.store} snapshot={snapshot} />}
        {!canEditServer || status?.platformUrl === null || showServerEditor ? null : <button
          type="button"
          disabled={snapshot.busy !== undefined}
          onClick={() => { setEditingServer(true) }}
          style={{ ...secondaryButton, border: 0, marginTop: 10 }}
        >
          <Pencil aria-hidden size={14} />修改 Server 地址
        </button>}
      </div>
      <div style={{
        alignItems: 'center', borderTop: '1px solid var(--dsw-alias-stroke-border-2, #e4e7ec)',
        color: 'var(--dsw-alias-label-tertiary, #667085)', display: 'flex', fontSize: 12,
        justifyContent: 'space-between', marginTop: 28, paddingTop: 14, width: '100%',
      }}>
        <span style={{ alignItems: 'center', display: 'flex', gap: 8, minWidth: 0 }}>
          <span aria-hidden style={{ background: status?.platformUrl === null ? 'var(--dsw-alias-label-disabled, #d0d5dd)' : presentation.color, borderRadius: '50%', flex: 'none', height: 6, width: 6 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={status?.platformUrl ?? undefined}>
            {status?.platformUrl ?? '尚未配置 Server'}
          </span>
        </span>
        <span style={{ flex: 'none' }}>v{status?.bundleVersion ?? '0.1.0'}</span>
      </div>
      <div style={{ marginTop: 16 }}><UninstallAction store={props.store} snapshot={snapshot} /></div>
      {snapshot.uninstallRestartRequested === false ? <p role="status" style={{ color: 'var(--dsw-alias-status-warning, #b54708)', fontSize: 13, margin: '12px 0 0' }}>
        DSH Enterprise 已卸载，请手动重启 Harness。
      </p> : null}
    </div>
  </section>
}
