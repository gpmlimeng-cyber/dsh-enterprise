/**
 * [INPUT]: 依赖 React、Lucide、Harness Input/Button、branding 的品牌视图与元素工厂、account-state 的状态/错误/可编辑投影、account-actions 的登出与卸载确认，以及 EnterpriseAccountStore 的脱敏 snapshot 和动作
 * [OUTPUT]: 对外提供登录页正文 EnterpriseLoginPage、原生登录表单与纯投影 enterpriseLoginServerEditorVisible/enterpriseLoginPageAction/enterprisePasswordPolicyError；AUTHORIZING 且状态带 `authorizeUrl`（安卓原生登录）时渲染账号密码/改密表单
 * [POS]: dsh-ui 登录弹窗的正文呈现层，照搬原全屏登录页的内容与信息架构（品牌、状态、错误、Server 编辑、动作、页脚元信息、卸载），只被 login-dialog 组合，自身不含遮罩、焦点陷阱或任何阻断宿主的效果；原生表单是本层唯一的凭证输入面，凭证经本机路由交给宿主转发，本层不落盘、不记日志
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
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { enterpriseLocalErrorCode } from './local-api.js'
import type { EnterpriseAuthSource, EnterpriseCredentialResult } from './local-api-decode.js'
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
import { EnterpriseBrandMark, type EnterpriseBrandingView } from './branding.js'
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

/** 欢迎语：品牌配置优先、缺省内置；与状态说明同处说明区，不替代任何功能性文案。 */
const brandLine: CSSProperties = {
  color: 'var(--dsw-alias-label-secondary, #475467)',
  fontSize: 12,
  lineHeight: '18px',
  margin: '-10px 0 14px',
}

/** 原生登录表单：安卓上宿主没有任何可用的开源路径，改由本页直接收账号密码。 */
const nativeForm: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, margin: '0 0 16px', width: '100%' }

const nativeSources: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }

const nativeField: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }

const nativeLabel: CSSProperties = { color: 'var(--dsw-alias-label-secondary, #475467)', fontSize: 12 }

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

/** 版本标识徽标：后台配置优先，缺省是内置的「预览版」；与页脚的插件版本同处一行。 */
const editionBadge: CSSProperties = {
  background: 'var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent))',
  borderRadius: 6,
  flex: 'none',
  fontSize: 11,
  lineHeight: '16px',
  padding: '1px 6px',
}

const versionRow: CSSProperties = { alignItems: 'center', display: 'flex', flex: 'none', gap: 6 }

const actions: CSSProperties = { alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 14, width: '100%' }

const restart: CSSProperties = { color: 'var(--dsw-alias-status-warning, #b54708)', fontSize: 13, margin: '12px 0 0' }

/** 弹窗正文的样式块与原件同源；档位/焦点环都取自宿主 token，键位动画由弹窗壳统一提供。 */
const style = `
  /* 聚焦环保留可访问性（仍是 2px 清晰可见），但改成贴合控件的圆角主题色环：
     原来是 2px 偏移的直角硬边，看起来像外挂在控件外面的一圈方框。 */
  .own-login input:focus-visible, .own-login button:focus-visible { border-radius: 8px; outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 1px; }
  /* 地址栏整条聚焦：高亮它自己的外框，而不是在已有边框外再套一层，避免"两层框"。 */
  .own-login .own-login-url { border-radius: 8px; }
  .own-login .own-login-url:focus-within { box-shadow: 0 0 0 2px var(--dsw-alias-state-business-primary, #4d6bfe); }
  .own-login .own-login-url input:focus-visible { outline: none; }
  .own-login .own-login-field { height: 36px; width: 100%; }
  .own-login .own-login-url input { padding-right: 22px; }
  .own-login .own-login-clear { align-items: center; background: transparent; border: 0; color: var(--dsw-alias-label-tertiary, #98a2b3); cursor: pointer; display: inline-flex; justify-content: center; padding: 3px; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
  .own-login .own-account-uninstall { color: var(--dsw-alias-label-tertiary, #667085); }
  .own-login .own-account-uninstall:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary, #c4320a); }
`

export interface EnterpriseLoginPageProps {
  readonly store: EnterpriseAccountStore
  readonly snapshot: EnterpriseAccountSnapshot
  /** 企业品牌视图；未配置/离线时就是内置默认，本页不需要知道来源。 */
  readonly branding: EnterpriseBrandingView
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
/** 服务端策略：≥14 位且含大写、小写、数字与符号；本地先判，避免白跑一次往返。 */
export function enterprisePasswordPolicyError(candidate: string, confirm: string): string | undefined {
  if (candidate !== confirm) return '两次输入的新密码不一致'
  if (candidate.length < 14) return '新密码至少 14 位'
  if (!/[a-z]/.test(candidate) || !/[A-Z]/.test(candidate)
    || !/[0-9]/.test(candidate) || !/[^A-Za-z0-9]/.test(candidate)) {
    return '新密码需同时包含大写、小写、数字与符号'
  }
  return undefined
}

/**
 * 原生登录表单（安卓）：宿主已代开服务端事务并交出认证来源，这里直接收账号密码。
 *
 * 凭证只经本机路由转发给企业服务器——不落盘、不进日志；「需改密」分支同样在此就地走完，
 * 成功后由宿主在后台继续换 token、注册设备与 bootstrap，状态轮询接管界面。
 */
function NativeLoginForm({ store, onEditServer }: {
  readonly store: EnterpriseAccountStore
  /** 切到 Server 地址编辑态：原生表单里必须留这个入口，否则地址配错就再也改不了。 */
  readonly onEditServer: () => void
}): ReactNode {
  const [sources, setSources] = useState<readonly EnterpriseAuthSource[]>()
  const [sourceId, setSourceId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [change, setChange] = useState<{ readonly challenge: string; readonly rejected: boolean }>()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      /**
       * 宿主是在**后台**建事务的（GET 授权 URL → GET 来源，两次往返后才置位 nativeLogin）。
       * 因此这里做有界快速重试：只要是「事务尚未就绪」（ENT_INVALID_REQUEST）就继续追，
       * 命中即绑定；其它错误立即定案。输入控件的出现因此不再依赖状态轮询那一拍。
       */
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const form = await store.api.loginForm(controller.signal)
          if (controller.signal.aborted) return
          setSources(form.sources)
          setSourceId(form.sources[0]?.id ?? '')
          return
        } catch (failure) {
          if (controller.signal.aborted) return
          const code = enterpriseLocalErrorCode(failure)
          if (code !== 'ENT_INVALID_REQUEST' || attempt === 7) {
            setError(enterpriseErrorDisplay(code).message)
            return
          }
          await new Promise(resolve => { setTimeout(resolve, 180) })
        }
      }
    })()
    return () => { controller.abort() }
  }, [store])

  const run = (operation: () => Promise<EnterpriseCredentialResult>): void => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    void (async () => {
      try {
        const result = await operation()
        if (result.next === 'change-password') {
          setChange({ challenge: result.challenge, rejected: result.rejected })
          setNewPassword('')
          setConfirmPassword('')
        }
        // redirect：已交给宿主在后台继续，这里不再有本地动作。
      } catch (failure) {
        const code = enterpriseLocalErrorCode(failure)
        setError(code === 'ENT_AUTH_REQUIRED'
          ? '账号或密码不正确'
          : enterpriseErrorDisplay(code).message)
        if (change === undefined) setPassword('')
      } finally {
        setBusy(false)
      }
    })()
  }

  const submit = (): void => {
    if (change === undefined) {
      if (username.length === 0 || password.length === 0) { setError('请输入企业账号与密码'); return }
      run(() => store.api.submitCredentials(
        { sourceId, username, password }, new AbortController().signal,
      ))
      return
    }
    const invalid = enterprisePasswordPolicyError(newPassword, confirmPassword)
    if (invalid !== undefined) { setError(invalid); return }
    run(() => store.api.submitPasswordChange(
      { challenge: change.challenge, newPassword }, new AbortController().signal,
    ))
  }

  /**
   * 尚未拿到来源时**也照常渲染输入控件**：账号密码是本地状态，用户马上就能输入；
   * 只有「登录」按钮等来源就绪。这样弹窗一出来就是完整表单，观感上控件与页面同时出现，
   * 不出现「转圈 → 突然变成表单」的跳变（来源其实几十毫秒后就到）。
   */
  const ready = sources !== undefined && sources.length > 0
  const emptySources = sources !== undefined && sources.length === 0

  return <div style={nativeForm}>
    <style>{style}</style>
    {/**
      * 「保存地址」之后的显式一步：宿主此时正在连企业服务（取品牌与认证来源），
      * 连通并拿到配置之前不假装可用——这就是"先确保服务连通、再取配置、最后登录"的中间态。
      * 已连接过的会话里 ready 早已为真，这一行不会出现，所以后续登录仍是直接进表单。
      */}
    {ready || error !== undefined ? null : <p style={stateDescription}>正在连接企业服务…</p>}
    {sources !== undefined && sources.length > 1 ? <div style={nativeSources}>
      {sources.map(source => <Button
        disabled={busy || change !== undefined}
        key={source.id}
        onClick={() => { setSourceId(source.id); setError(undefined) }}
        variant={source.id === sourceId ? 'primary' : 'outline'}
      >{source.name}</Button>)}
    </div> : null}
    {change === undefined
      ? <>
        <label style={nativeField}>
          <span style={nativeLabel}>企业账号</span>
          <Input
            autoComplete="username"
            className="own-login-field"
            disabled={busy}
            onChange={event => { setUsername(event.currentTarget.value) }}
            value={username}
          />
        </label>
        <label style={nativeField}>
          <span style={nativeLabel}>密码</span>
          <Input
            autoComplete="current-password"
            className="own-login-field"
            disabled={busy}
            onChange={event => { setPassword(event.currentTarget.value) }}
            onKeyDown={event => { if (event.key === 'Enter') submit() }}
            type="password"
            value={password}
          />
        </label>
      </>
      : <>
        <p style={stateDescription}>
          {change.rejected ? '新密码不符合安全要求，请重新输入。' : '首次登录必须先修改初始密码。'}
        </p>
        <label style={nativeField}>
          <span style={nativeLabel}>新密码</span>
          <Input
            autoComplete="new-password"
            className="own-login-field"
            disabled={busy}
            onChange={event => { setNewPassword(event.currentTarget.value) }}
            type="password"
            value={newPassword}
          />
        </label>
        <label style={nativeField}>
          <span style={nativeLabel}>确认新密码</span>
          <Input
            autoComplete="new-password"
            className="own-login-field"
            disabled={busy}
            onChange={event => { setConfirmPassword(event.currentTarget.value) }}
            onKeyDown={event => { if (event.key === 'Enter') submit() }}
            type="password"
            value={confirmPassword}
          />
        </label>
        <p style={stateDescription}>至少 14 位，且同时包含大写、小写、数字与符号。</p>
      </>}
    {error === undefined ? null : <p role="alert" style={alert}>{error}</p>}
    {emptySources ? <p role="alert" style={alert}>该企业未开放任何可用的登录方式，请联系管理员。</p> : null}
    <Button
      disabled={busy || !ready}
      icon={busy ? <LoaderCircle aria-hidden className="own-login-spin" size={15} /> : <LogIn aria-hidden size={15} />}
      onClick={submit}
      variant="primary"
    >{busy ? '正在登录' : change === undefined ? '登录' : '修改密码并登录'}</Button>
    {change === undefined ? <Button
      disabled={busy}
      icon={<Pencil aria-hidden size={15} />}
      onClick={onEditServer}
      variant="outline"
    >修改 Server 地址</Button> : null}
  </div>
}

export function EnterpriseLoginPage(props: EnterpriseLoginPageProps): ReactNode {
  const status = props.snapshot.status
  const state = status?.state
  const busy = props.snapshot.busy !== undefined
  const action = enterpriseLoginPageAction(state)
  const presentation = state === undefined ? ENTERPRISE_LOADING_PRESENTATION : enterpriseStatePresentation(state)
  const errorDisplay = props.errorCode === undefined ? undefined : enterpriseErrorDisplay(props.errorCode)
  const canEditServer = enterpriseServerEditable(state)
  const configured = status?.platformUrl ?? null
  // 宿主声明「该由你打开」（安卓）时把授权页直接渲染在本弹窗内：不跳系统浏览器；登录后服务端的
  // 重定向仍会命中宿主本机回调（同一台设备共享回环），整条 PKCE 链路照常闭合。
  const authorizeUrl = status?.authorizeUrl
  /**
   * 原生登录的挂载条件。三个入口合起来把「空窗」封死：
   *   ① authorizeUrl 已下发（事务就绪）
   *   ② busy==='login'（刚发起，宿主正在建事务）
   *   ③ state==='AUTHORIZING'（**关键**：POST 返回后 busy 已清、但 authorizeUrl 还要等宿主两次
   *      广域网往返才到；少了这一条，那一小段会退回「等待授权 + 转圈」，就是肉眼可见的第一屏）
   * 再加上打开即登录的 SIGNED_OUT / CANCELLED。
   *
   * `nativeShell` 是必须的门：桌面端等系统浏览器时同样是 AUTHORIZING，若不加这道门，
   * 桌面会被误判成原生表单（那边根本没有 /local/auth/form）。
   * 优先读宿主下发的 `loginMode`（native/browser）；只有旧宿主半没有这个字段时才退回 UA 判断兜底。
   */
  // 优先读宿主下发的交接模式；旧宿主半没有这个字段时才退回 UA 判断（兜底,不是长期方案）。
  const nativeShell = status?.loginMode === undefined
    ? (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent))
    : status.loginMode === 'native'
  const nativeLogin = nativeShell && (
    authorizeUrl !== undefined
    || props.snapshot.busy === 'login'
    || state === 'AUTHORIZING'
    || state === 'SIGNED_OUT'
    || state === 'CANCELLED'
    || state === 'UNCONFIGURED'
  )
  /**
   * 首次登录：地址还没配置时，正文先给地址编辑器、**不给账号密码**——
   * 没有地址，凭据提交无处可去。存下地址后 `platformUrl` 不再为 null，
   * 这一步自然消失，后续登录直接进表单（这就是"首次填、之后不用重复填"）。
   */
  const mustConfigure = nativeLogin && configured === null
  const description = mustConfigure
    ? '请先填写企业服务器地址'
    : nativeLogin ? '请直接在此登录企业账号' : presentation.description

  return <div className="own-login" style={page}>
    <style>{style}</style>
    <EnterpriseBrandMark
      fallback={DSHENT_ANIMATED_ICON}
      size={48}
      src={props.branding.logoSrc}
      staticFallback={DSHENT_ICON}
      staticSrc={props.branding.staticLogoSrc}
      style={brandIcon}
    />
    {/* 原生表单在场时不画状态行：「等待授权」配一个转圈图标与眼前可填的表单自相矛盾。 */}
    {nativeLogin ? null : <div data-enterprise-state={state ?? props.snapshot.phase} role="status" style={stateRow}>
      {enterpriseStateIcon(presentation, 16, presentation.icon === 'progress' ? 'own-login-spin' : undefined)}
      <span style={stateTitle}>{presentation.title}</span>
    </div>}
    <p style={stateDescription} title={description}>{description}</p>
    {/* 原生模式下不重复欢迎语：弹窗头部（Modal 的 description）已经写了同一句 headline。 */}
    {nativeLogin ? null : <p data-enterprise-brand={props.branding.custom ? 'configured' : 'builtin'} style={brandLine}>
      {props.branding.headline}
    </p>}
    {/* 编辑地址时让编辑器独占正文：表单与编辑器同时在画面里会互相稀释。 */}
    {nativeLogin && !props.showServerEditor && !mustConfigure ? <NativeLoginForm
      onEditServer={() => { props.onServerEditingChange(true) }}
      store={props.store}
    /> : null}
    {errorDisplay === undefined ? null : <p role="alert" style={alert}>
      {errorDisplay.message}{errorDisplay.code === undefined ? null : <> <code>{errorDisplay.code}</code></>}
    </p>}
    {props.showServerEditor || mustConfigure
      ? <ServerUrlEditor
        busy={busy}
        onSaved={() => { props.onServerEditingChange(false) }}
        onServerUrlChange={props.onServerUrlChange}
        saving={props.snapshot.busy === 'configure'}
        serverUrl={props.serverUrl}
        store={props.store}
      />
      : nativeLogin ? null : <LoginActions action={action} onLogin={props.onLogin} snapshot={props.snapshot} store={props.store} />}
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
      <span style={versionRow}>
        <span style={{ flex: 'none' }}>v{status?.bundleVersion ?? '0.1.0'}</span>
        {props.branding.editionLabel === '' ? null : <span
          data-enterprise-edition={props.branding.editionLabel}
          style={editionBadge}
          title={`版本标识：${props.branding.editionLabel}`}
        >{props.branding.editionLabel}</span>}
      </span>
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
    </div>    {props.snapshot.uninstallRestartRequested === false ? <p role="status" style={restart}>
      DSH Enterprise 已卸载，请手动重启 Harness。
    </p> : null}
  </div>
}
