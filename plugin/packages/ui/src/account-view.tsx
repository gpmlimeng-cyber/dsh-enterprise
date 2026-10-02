/**
 * [INPUT]: 依赖 React、Lucide、Harness Button、AccountOriginEditor、brand 品牌位图、account-actions 的登出与卸载确认、account-state 的共享投影与 login-dialog 的弹窗入口、plugin/preset/skill 三个市场视图，以及 EnterpriseAccountStore 的脱敏 snapshot
 * [OUTPUT]: 提供账号设置区（账号状态/登录入口/插件/配方/技能 tabs）、只读账号信息投影与共享登出确认；不再提供任何全屏门禁。**本刀（失败文案降维）**：账号区的失败提示改渲染 `EnterpriseErrorNotice`（人话 + 「下一步：」+「技术信息」折叠区里的稳定码），码表唯一真源搬到 `error-messages.ts` **本刀（品牌读取失败的唯一可见交代）**：账号信息区新增「企业标识」只读行（`enterpriseBrandingIdentityValue`）与 `unavailable` 时的一句中性提示 + 真重发的重试（唯一提示组件 + `branding.retry()`）。
 * [POS]: dsh-ui 的账号设置呈现层，官方账号区缺席时账号信息在本层自洽，登录统一交给登录弹窗，不接触 Host Context、Token 或执行细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Building2,
  Laptop,
  LogIn,
  LogOut,
  Package,
  RefreshCw,
  Server,
  Sparkles,
  UserRound,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { LogoutConfirmation, UninstallAction } from './account-actions.js'
import { AccountOriginEditor } from './account-origin.js'
export { AccountOriginEditor, resolveAccountOrigin } from './account-origin.js'
import {
  ENTERPRISE_LOADING_PRESENTATION,
  enterpriseAccountIdentity,
  enterpriseErrorDisplay,
  enterpriseSessionUsable,
  enterpriseStateIcon,
  enterpriseStatePresentation,
  useAccount,
} from './account-state.js'
export {
  enterpriseAccountIdentity,
  enterpriseErrorDisplay,
  enterpriseErrorMessage,
  enterpriseServerEditable,
  enterpriseSessionUsable,
  enterpriseStatePresentation,
  useAccount,
} from './account-state.js'
export type { EnterpriseAccountIdentity, StatePresentation } from './account-state.js'
import type { EnterpriseAccountSnapshot } from './account-store.js'
export { LogoutConfirmation, UninstallAction } from './account-actions.js'
export { DSHENT_ANIMATED_ICON, DSHENT_ICON } from './brand.js'
import { EnterpriseAccountStore } from './account-store.js'
import { DSHENT_ICON } from './brand.js'
import {
  ENTERPRISE_BRANDING_IDENTITY_LABEL,
  ENTERPRISE_BRANDING_READ_FAILED,
  enterpriseBrandingIdentityValue,
  useEnterpriseBranding,
} from './branding.js'
import { ENTERPRISE_ERROR_ACTIONS } from './error-messages.js'
import { EnterpriseErrorNotice } from './error-notice.js'
import { enterpriseLoginEntry, EnterpriseLoginDialog, useEnterpriseLoginDialog } from './login-dialog.js'
import { EnterprisePluginMarket } from './plugin-market.js'
export { enterprisePluginStatePresentation } from './plugin-market.js'
import { EnterprisePresetMarket } from './preset-market.js'
import { EnterpriseSessionSyncView } from './session-view.js'
import { EnterpriseSkillMarket } from './skill-market.js'


export interface EnterpriseStoreInjected {
  readonly store: EnterpriseAccountStore
}

export interface EnterpriseSettingsSectionProps extends EnterpriseStoreInjected {}

/** 账号设置内部 tab；受管动作 tab 只在企业会话可用时出现在 tablist 中。 */
type SettingsTab = 'account' | 'plugins' | 'presets' | 'skills' | 'sessions'

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

/** 账号区的登录入口：未登录与登录中都打开同一个弹窗，只有已连接才是退出登录。 */
function LoginEntry({ store, snapshot }: { store: EnterpriseAccountStore; snapshot: EnterpriseAccountSnapshot }): ReactNode {
  const dialog = useEnterpriseLoginDialog(store)
  const entry = enterpriseLoginEntry(snapshot.status?.state, snapshot.busy)
  const disabled = entry.disabled
  return <>
    {entry.action === 'logout'
      ? <LogoutConfirmation store={store} disabled={disabled}>{open => <Button variant="outline" size="sm"
        icon={<LogOut aria-hidden size={14} />} disabled={disabled} onClick={open}>
        {snapshot.busy === 'logout' ? '正在退出' : entry.label}
      </Button>}</LogoutConfirmation>
      : <button type="button" style={primaryButton} disabled={disabled} onClick={dialog.openDialog}>
        <LogIn aria-hidden size={15} />{entry.label}
      </button>}
    <EnterpriseLoginDialog store={store} open={dialog.open} onClose={dialog.closeDialog} />
  </>
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }): ReactNode {
  return <div style={detailRow} className="own-account-row">
    <div style={detailLabel}>{icon}{label}</div>
    <div style={{ alignItems: 'center', display: 'flex', gap: 8, minWidth: 0 }}>
      <div style={detailValue} title={value}>{value}</div>
    </div>
  </div>
}

function EnterpriseAccountContent({ store }: EnterpriseStoreInjected): ReactNode {
  const snapshot = useAccount(store)
  const status = snapshot.status
  const branding = useEnterpriseBranding(store)
  const presentation = status === undefined
    ? ENTERPRISE_LOADING_PRESENTATION
    : enterpriseStatePresentation(status.state)
  const identity = enterpriseAccountIdentity(snapshot)
  const username = identity.loginName === '' || identity.displayName === identity.loginName
    ? identity.displayName
    : `${identity.displayName} (${identity.loginName})`
  const error = snapshot.errorCode ?? status?.errorCode
  const errorDisplay = error === undefined ? undefined : enterpriseErrorDisplay(error)

  return <div style={panel} className="own-account">
    {errorDisplay === undefined ? null : errorDisplay.code === undefined
      ? <div role="alert" style={{ color: 'var(--dsw-alias-status-error, #c4320a)', fontSize: 13, lineHeight: '20px', paddingBottom: 12 }}>
        {errorDisplay.message}
      </div>
      : <EnterpriseErrorNotice code={errorDisplay.code} style={{ color: 'var(--dsw-alias-status-error, #c4320a)', fontSize: 13, lineHeight: '20px', paddingBottom: 12 }} />}
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
        {enterpriseStateIcon(presentation, 13)}{presentation.title}
      </span>
    </div>
    <div style={detailList}>
      <Detail icon={<UserRound aria-hidden size={14} />} label="登录名" value={identity.loginName === '' ? '登录后可用' : identity.loginName} />
      <Detail icon={<Building2 aria-hidden size={14} />} label="部门" value={identity.department} />
      {/*
       * 「企业标识」：这是**唯一**一处把「品牌读不到」如实说出来的地方（非打扰但可见）。
       * 侧栏 / 登录弹窗继续静默回落官方标识（视觉不闪、不叠错误、不在登录时打断）；
       * 员工若怀疑「是不是公司没配」，到账号页这里能看到三态的区别：
       * 已配置 = 企业名；未配置 = 默认标识（企业未配置）；取数失败 = 暂时无法读取 + 重试。
       */}
      <Detail icon={<Sparkles aria-hidden size={14} />} label={ENTERPRISE_BRANDING_IDENTITY_LABEL}
        value={enterpriseBrandingIdentityValue(branding.readState, branding.name)} />
      <Detail icon={<Server aria-hidden size={14} />} label="平台地址" value={identity.platformUrl} />
      <Detail icon={<Laptop aria-hidden size={14} />} label="设备" value={identity.deviceLabel} />
      <Detail icon={<Package aria-hidden size={14} />} label="插件版本" value={identity.versionLabel} />
    </div>
    {/* 品牌取数失败：**非打扰但可见**——中性色（不是错误红）、不是弹窗、不打断登录；给稳定码的技术信息与重试。 */}
    {branding.readState === 'unavailable' ? (
      <div style={{ display: 'grid', gap: 8, paddingBottom: 12 }}>
        <EnterpriseErrorNotice
          code={branding.code ?? ''}
          prefix={ENTERPRISE_BRANDING_READ_FAILED}
          style={{ color: 'var(--dsw-alias-label-secondary, #475467)', fontSize: 12.5, lineHeight: '19px' }}
        />
        <div>
          <Button variant="outline" size="sm" icon={<RefreshCw aria-hidden size={14} />}
            onClick={() => { branding.retry() }}>
            {ENTERPRISE_ERROR_ACTIONS.retry}
          </Button>
        </div>
      </div>
    ) : null}
    <div style={actions}>
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="outline" size="sm" title="获取最新账号、设备和企业配置" icon={<RefreshCw aria-hidden size={14} />}
          disabled={snapshot.busy !== undefined} onClick={() => { void store.refresh(true) }}>刷新配置</Button>
        <LoginEntry store={store} snapshot={snapshot} />
      </div>
      <UninstallAction store={store} snapshot={snapshot} quiet />
    </div>
    {snapshot.uninstallRestartRequested === false ? <div role="status" style={{ color: 'var(--dsw-alias-status-warning, #b54708)', fontSize: 13 }}>
      DSH Enterprise 已卸载，请手动重启 Harness。
    </div> : null}
  </div>
}

/** 官方 `settings.section` 内的 DSH Enterprise 账号、插件与配方 tabs；登录状态变化不再关闭设置页。 */
export function EnterpriseSettingsSection(props: EnterpriseSettingsSectionProps): ReactNode {
  useEffect(() => { void props.store.refresh(true) }, [props.store])
  const state = useAccount(props.store).status?.state
  const headingId = useId()
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const snapshot = useAccount(props.store)
  const sessionSyncEnabled = snapshot.bootstrap?.sessionPolicyEnabled === true
  // 没有企业会话时只留账号 tab：其余 tab 的数据与动作都需要登录，账号 tab 内的登录入口负责建立会话。
  const sessionUsable = enterpriseSessionUsable(state)
  const rows = useMemo<readonly { readonly id: SettingsTab; readonly label: string }[]>(() => [
    { id: 'account', label: '账号' },
    ...(sessionUsable ? [
      { id: 'plugins' as const, label: '插件' },
      { id: 'presets' as const, label: '配方' },
      { id: 'skills' as const, label: '技能' },
      ...(sessionSyncEnabled ? [{ id: 'sessions' as const, label: '会话同步' }] : []),
    ] : []),
  ], [sessionUsable, sessionSyncEnabled])
  useEffect(() => {
    if (rows.every(row => row.id !== activeTab)) setActiveTab('account')
  }, [activeTab, rows])
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
      企业设置
    </h2>
    <div role="tablist" aria-label="企业设置" style={tabs}>
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
      <AccountOriginEditor api={props.store.api} disabled={snapshot.busy !== undefined} />
    </div>
    <div id={`${tabsId}-panel-plugins`} role="tabpanel" aria-labelledby={`${tabsId}-tab-plugins`} hidden={activeTab !== 'plugins'}>
      {activeTab === 'plugins' ? <EnterprisePluginMarket store={props.store} /> : null}
    </div>
    <div id={`${tabsId}-panel-presets`} role="tabpanel" aria-labelledby={`${tabsId}-tab-presets`} hidden={activeTab !== 'presets'}>
      {activeTab === 'presets' ? <EnterprisePresetMarket store={props.store} /> : null}
    </div>
    <div id={`${tabsId}-panel-skills`} role="tabpanel" aria-labelledby={`${tabsId}-tab-skills`} hidden={activeTab !== 'skills'}>
      {activeTab === 'skills' ? <EnterpriseSkillMarket store={props.store} /> : null}
    </div>
    {sessionSyncEnabled ? <div id={`${tabsId}-panel-sessions`} role="tabpanel" aria-labelledby={`${tabsId}-tab-sessions`} hidden={activeTab !== 'sessions'}>
      {activeTab === 'sessions' ? <EnterpriseSessionSyncView store={props.store} /> : null}
    </div> : null}
  </section>
}
