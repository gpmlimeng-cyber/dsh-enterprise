/**
 * [INPUT]: 依赖 React、Lucide、Harness Input/Button、branding 的品牌视图与元素工厂、account-state 的共享状态图标与状态呈现类型、error-notice 的唯一失败提示组件、account-actions 的退出与卸载确认，以及 EnterpriseAccountStore 的脱敏 snapshot 与 NUWAX 动作
 * [OUTPUT]: 对外提供登录弹窗正文 EnterpriseNuwaxLoginPage、四个纯投影 enterpriseLoginPageAction/enterpriseNuwaxPresentation/enterpriseNuwaxCredentialError/enterpriseNuwaxServiceAddress，以及正文里那面 NUWAX 账号口令表单与页脚动作
 * [POS]: dsh-ui **登录入口的正文呈现层**——**本刀把原企业登录入口整面换成 NUWAX**：收员工自己的 NUWAX 账号与口令，经本机回环交给宿主转发，本层不落盘、不记日志、不回显；只说 NUWAX 登录态（登录中 / 已登录 / 未登录 / 退出中），不再有 Server 地址编辑器、不再有 PKCE 授权等待、也不再有改密分支（口令策略是 NUWAX 平台的规则，本层不猜）。企业连接那份事实仍归账号设置页与市场门禁，本层一个字节都不碰
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { LogoutConfirmation, UninstallAction } from './account-actions.js'
import {
  enterpriseStateIcon,
  type StatePresentation,
} from './account-state.js'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from './brand.js'
import { EnterpriseBrandMark, type EnterpriseBrandingView } from './branding.js'
import { EnterpriseErrorNotice } from './error-notice.js'
import type { EnterpriseNuwaxStatus } from './local-api.js'

/** 本机 NUWAX 动作的在途事实（与 store 的 `nuwaxBusy` 同域，只有两个方向）。 */
export type EnterpriseNuwaxBusy = 'login' | 'logout'

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

/** 账号口令表单：NUWAX 是本层唯一的凭证输入面。 */
const credentialForm: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, margin: '0 0 16px', width: '100%' }

const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }

const fieldLabel: CSSProperties = { color: 'var(--dsw-alias-label-secondary, #475467)', fontSize: 12 }

/** 已登录时的主体块：昵称大字 + 账号小字，与表单同宽同处，不跳版。 */
const accountRow: CSSProperties = { alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 2, margin: '0 0 16px', width: '100%' }

const accountName: CSSProperties = { fontSize: 14, fontWeight: 600, lineHeight: '22px' }

const accountDetail: CSSProperties = { color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12, lineHeight: '18px', overflowWrap: 'anywhere' }

const alert: CSSProperties = {
  color: 'var(--dsw-alias-state-error-primary, #c4320a)',
  fontSize: 13,
  lineHeight: '20px',
  margin: '0 0 16px',
  overflowWrap: 'anywhere',
}

const meta: CSSProperties = {
  alignItems: 'center',
  borderTop: '1px solid var(--dsw-alias-border-l2, #e4e7ec)',
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

const restart: CSSProperties = { color: 'var(--dsw-alias-state-warn-primary, #b54708)', fontSize: 13, margin: '12px 0 0' }

/** 弹窗正文的样式块与原件同源；档位/焦点环都取自宿主 token，键位动画由弹窗壳统一提供。 */
const style = `
  /* 聚焦环保留可访问性（仍是 2px 清晰可见），但改成贴合控件的圆角主题色环。 */
  .own-login input:focus-visible, .own-login button:focus-visible { border-radius: 8px; outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 1px; }
  .own-login .own-login-field { height: 36px; width: 100%; }
  .own-login .own-account-uninstall { color: var(--dsw-alias-label-tertiary, #667085); }
  .own-login .own-account-uninstall:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary, #c4320a); }
`

/** NUWAX 登录态的呈现（**不画企业那套 11 态**：本页说的是员工与 NUWAX 平台之间的事）。 */
export function enterpriseNuwaxPresentation(
  nuwax: EnterpriseNuwaxStatus | undefined,
  busy: EnterpriseNuwaxBusy | undefined,
): StatePresentation {
  if (busy === 'login') {
    return {
      title: '正在登录',
      description: '正在向 NUWAX 平台核对账号与口令',
      color: 'var(--dsw-alias-brand-primary, #2563eb)',
      icon: 'progress',
    }
  }
  if (busy === 'logout') {
    return {
      title: '正在退出',
      description: '正在丢弃本机的 NUWAX 会话',
      color: 'var(--dsw-alias-state-warn-primary, #b54708)',
      icon: 'progress',
    }
  }
  if (nuwax?.state === 'signed-in') {
    return {
      title: '已登录',
      description: 'NUWAX 会话可用',
      color: 'var(--dsw-alias-state-success-primary, #16803c)',
      icon: 'success',
    }
  }
  return {
    title: '未登录',
    description: '请使用你的 NUWAX 账号登录',
    color: 'var(--dsw-alias-label-tertiary, #667085)',
    icon: 'building',
  }
}

/** 正文动作分支：**只有**已登录才是退出，其余（含还没读到状态）一律给登录表单。 */
export type EnterpriseLoginPageAction = 'login' | 'logout'

export function enterpriseLoginPageAction(
  nuwax: EnterpriseNuwaxStatus | undefined,
  _busy?: EnterpriseNuwaxBusy,
): EnterpriseLoginPageAction {
  return nuwax?.state === 'signed-in' ? 'logout' : 'login'
}

/**
 * 本地先判：两项都要填，避免白跑一次往返。
 *
 * 三条**刻意不做**的事：不判口令复杂度（那是 NUWAX 平台的规则，猜错了会拦下合法口令）、
 * 不 trim 口令（首尾空白可能是口令的一部分）、不把账号里的空白当合法输入。
 */
export function enterpriseNuwaxCredentialError(account: string, password: string): string | undefined {
  if (account.trim() === '') return '请输入 NUWAX 账号'
  if (password === '') return '请输入 NUWAX 口令'
  return undefined
}

export interface EnterpriseNuwaxLoginPageProps {
  readonly store: EnterpriseAccountStore
  readonly snapshot: EnterpriseAccountSnapshot
  /** 企业品牌视图；未配置/离线时就是内置默认，本页不需要知道来源。 */
  readonly branding: EnterpriseBrandingView
}

/**
 * NUWAX 账号口令表单（**登录入口唯一的凭证输入面**）。
 *
 * 凭证只经本机回环交给宿主转发给 NUWAX 平台——不落盘、不进日志、不回显；失败一律由
 * store 收敛成稳定码（唯一提示组件出人话 + 下一步），本组件只管本地校验与在途事实。
 * 口令在**每次提交收束后**清空（成功与失败都清）：口令不该在画面上多停一拍。
 */
function NuwaxCredentialForm({ store }: {
  readonly store: EnterpriseAccountStore
}): ReactNode {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const submit = (): void => {
    if (busy) return
    const invalid = enterpriseNuwaxCredentialError(account, password)
    if (invalid !== undefined) { setError(invalid); return }
    setError(undefined)
    setBusy(true)
    void (async () => {
      try {
        await store.nuwaxLogin(account.trim(), password)
      } finally {
        // 无论成败都把口令从这一层的状态里抹掉（失败提示由 store 的稳定码负责说）。
        setBusy(false)
        setPassword('')
      }
    })()
  }

  return <div style={credentialForm}>
    <label style={field}>
      <span style={fieldLabel}>NUWAX 账号</span>
      <Input
        autoComplete="username"
        className="own-login-field"
        disabled={busy}
        onChange={event => { setAccount(event.currentTarget.value) }}
        value={account}
      />
    </label>
    <label style={field}>
      <span style={fieldLabel}>口令</span>
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
    {error === undefined ? null : <p role="alert" style={alert}>{error}</p>}
    <Button
      variant="primary"
      disabled={busy}
      icon={busy ? <LoaderCircle aria-hidden className="own-login-spin" size={15} /> : <LogIn aria-hidden size={15} />}
      onClick={submit}
    >{busy ? '正在登录' : '登录'}</Button>
  </div>
}

/**
 * 页脚那行「这次登录打到哪台服务器」的**唯一**来源：宿主投影的 **NUWAX 服务地址**。
 *
 * ★三条纪律（第①条就是这个函数的全部理由）：
 *  ① **绝不**回落到企业平台地址 —— 「登录入口换成 NUWAX、页脚却显示企业服务器」会被员工读成
 *     「这个登录要连的是那台机器」，是纯粹的误导（本函数的第一条用例就是钉这一条）；
 *  ② 界面**不自己拼**地址、**不**硬编码默认域：部署可用 `DSHENT_NUWAX_ORIGIN` 换台，
 *     界面只如实反映宿主决议出的那一台；
 *  ③ 读不到就是读不到（回 `undefined`，由调用方画占位）——宁可写「不知道」，也不编一个地址。
 */
export function enterpriseNuwaxServiceAddress(nuwax: EnterpriseNuwaxStatus | undefined): string | undefined {
  const origin = nuwax?.origin
  return typeof origin === 'string' && origin.length > 0 ? origin : undefined
}

/** 页脚服务地址读不到时的占位（**不是**企业地址，也不是任何猜出来的地址）。 */
const NUWAX_SERVICE_ADDRESS_UNKNOWN = 'NUWAX 服务地址未知'

/**
 * 登录弹窗的正文：品牌图、NUWAX 登录态与说明、账号口令表单（或已登录主体）、失败提示、
 * 页脚元信息与卸载。只读快照 + store 动作，不发企业请求、不开弹窗、也不关闭宿主任何界面。
 */
export function EnterpriseNuwaxLoginPage(props: EnterpriseNuwaxLoginPageProps): ReactNode {
  const nuwax = props.snapshot.nuwax
  const busy = props.snapshot.nuwaxBusy
  const presentation = enterpriseNuwaxPresentation(nuwax, busy)
  const action = enterpriseLoginPageAction(nuwax, busy)
  const errorCode = props.snapshot.nuwaxErrorCode
  const running = busy !== undefined
  const principal = nuwax?.state === 'signed-in' ? nuwax.principal : undefined
  /** 页脚那行是本机登录**实际打到的那台 NUWAX 服务**（企业平台地址不属于这一页：本页只说 NUWAX）。 */
  const serviceAddress = enterpriseNuwaxServiceAddress(nuwax)

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
    <div data-enterprise-nuwax-state={busy ?? nuwax?.state ?? 'unknown'} role="status" style={stateRow}>
      {enterpriseStateIcon(presentation, 16, presentation.icon === 'progress' ? 'own-login-spin' : undefined)}
      <span style={stateTitle}>{presentation.title}</span>
    </div>
    <p style={stateDescription} title={presentation.description}>{presentation.description}</p>
    <p data-enterprise-brand={props.branding.custom ? 'configured' : 'builtin'} style={brandLine}>
      {props.branding.headline}
    </p>
    {principal === undefined
      ? <NuwaxCredentialForm store={props.store} />
      : <div data-enterprise-nuwax-principal={principal.userName} style={accountRow}>
        <span style={accountName}>{principal.nickName}</span>
        <span style={accountDetail}>{principal.userName} · 租户 {principal.tenantId}</span>
      </div>}
    {errorCode === undefined ? null : <EnterpriseErrorNotice code={errorCode} style={alert} />}
    {action === 'logout' ? <LogoutConfirmation disabled={running} store={props.store} target="nuwax">{open => <Button
      variant="outline"
      disabled={running}
      icon={<LogOut aria-hidden size={14} />}
      onClick={open}
    >{busy === 'logout' ? '正在退出' : '退出登录'}</Button>}</LogoutConfirmation> : null}
    <div style={meta}>
      <span style={metaSource}>
        <span aria-hidden style={{ background: serviceAddress === undefined ? 'var(--dsw-alias-label-dimmed, #d0d5dd)' : presentation.color, borderRadius: '50%', flex: 'none', height: 6, width: 6 }} />
        <span data-enterprise-nuwax-origin={serviceAddress} style={metaValue} title={serviceAddress ?? undefined}>{serviceAddress ?? NUWAX_SERVICE_ADDRESS_UNKNOWN}</span>
      </span>
      <span style={versionRow}>
        <span style={{ flex: 'none' }}>v{props.snapshot.status?.bundleVersion ?? '0.1.0'}</span>
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
        disabled={running}
        icon={<RefreshCw aria-hidden size={14} />}
        onClick={() => {
          // 两件事各自独立：企业配置刷新照旧，NUWAX 登录态也重读一次（读不到不影响前一条上屏）。
          void props.store.refresh(true)
          void props.store.refreshNuwax()
        }}
        title="重读本机服务状态与 NUWAX 登录态"
      >刷新配置</Button>
      <UninstallAction quiet snapshot={props.snapshot} store={props.store} />
    </div>
    {props.snapshot.uninstallRestartRequested === false ? <p role="status" style={restart}>
      DSH Enterprise 已卸载，请手动重启 Harness。
    </p> : null}
  </div>
}
