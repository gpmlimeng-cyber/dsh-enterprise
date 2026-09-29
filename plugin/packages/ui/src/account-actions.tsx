/**
 * [INPUT]: 依赖 React、Harness Button、ConfirmAction 与 EnterpriseAccountStore 的 logout/uninstall 动作
 * [OUTPUT]: 提供 LogoutConfirmation 与 UninstallAction 两个 store 绑定的危险动作确认
 * [POS]: dsh-ui 的账号危险动作确认边界，被个人中心菜单、账号设置与登录弹窗三处共用，避免每个入口各写一份确认
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import { ConfirmAction } from './confirm-action.js'

/** 所有账号入口共享同一页面确认，取消时不触发任何认证状态变更。 */
export function LogoutConfirmation({ store, disabled, children }: {
  store: Pick<EnterpriseAccountStore, 'logout'>
  disabled: boolean
  children: (open: () => void) => ReactNode
}): ReactNode {
  return <ConfirmAction title="退出 DSH Enterprise" description="确定退出 DSH Enterprise 吗？" confirmLabel="退出登录"
    disabled={disabled} onConfirm={() => { void store.logout() }}>{children}</ConfirmAction>
}

/** 卸载是不可逆动作，静默档（quiet）用于账号页与登录弹窗的次级行，正文档用于显式入口。 */
export function UninstallAction({ store, snapshot, quiet = false }: {
  store: EnterpriseAccountStore
  snapshot: EnterpriseAccountSnapshot
  quiet?: boolean
}): ReactNode {
  const busy = snapshot.busy !== undefined
  return <ConfirmAction title="卸载 DSH Enterprise" description="将移除 DSH Enterprise 与全部受管插件。确定继续吗？" confirmLabel="确认卸载"
    disabled={busy} onConfirm={() => { void store.uninstall() }}>{open => <Button
    variant={quiet ? 'ghost' : 'outline'} size={quiet ? 'sm' : 'md'}
    className={quiet ? 'own-account-uninstall' : undefined}
    style={quiet ? undefined : { color: 'var(--dsw-alias-state-error-primary, #c4320a)' }}
    icon={<Trash2 aria-hidden size={14} />}
    disabled={busy}
    onClick={open}
  >
    {snapshot.busy === 'uninstall' ? '正在卸载' : '卸载 DSH Enterprise'}
  </Button>}</ConfirmAction>
}
