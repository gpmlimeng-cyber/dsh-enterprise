/**
 * [INPUT]: 依赖 React、Harness Button、ConfirmAction 与 EnterpriseAccountStore 的 logout/uninstall 动作
 * [OUTPUT]: **本刀（登录入口换成 NUWAX）**：`LogoutConfirmation` 多一枚 `target`（`'enterprise'` 默认＝与改前逐字相同；`'nuwax'` 走 `store.nuwaxLogout()` 并配自己的确认文案——退 NUWAX 只是要重新输一次账号口令）。提供 LogoutConfirmation 与 UninstallAction 两个 store 绑定的危险动作确认
 * [POS]: dsh-ui 的账号危险动作确认边界，被个人中心菜单、账号设置与登录弹窗三处共用，避免每个入口各写一份确认
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import { ConfirmAction } from './confirm-action.js'

/**
 * 所有账号入口共享同一页面确认，取消时不触发任何认证状态变更。
 *
 * `target` 选**退出哪一个会话**：企业会话（默认，行为与本刀之前逐字相同）或 NUWAX 会话
 * （本刀新增——登录入口换成 NUWAX 之后，那一页的「退出登录」退出的就是 NUWAX 会话）。
 * 两句确认文案刻意不同：退企业会话会丢掉设备登记与受管配置，退 NUWAX 只是要重新输一次账号口令。
 */
export function LogoutConfirmation({ store, disabled, children, target = 'enterprise' }: {
  store: Pick<EnterpriseAccountStore, 'logout' | 'nuwaxLogout'>
  disabled: boolean
  children: (open: () => void) => ReactNode
  readonly target?: 'enterprise' | 'nuwax'
}): ReactNode {
  const nuwax = target === 'nuwax'
  return <ConfirmAction
    title={nuwax ? '退出 NUWAX 登录' : '退出 DSH Enterprise'}
    description={nuwax ? '确定退出 NUWAX 账号吗？退出后需要重新输入账号与口令。' : '确定退出 DSH Enterprise 吗？'}
    confirmLabel="退出登录"
    disabled={disabled}
    onConfirm={() => { void (nuwax ? store.nuwaxLogout() : store.logout()) }}
  >{children}</ConfirmAction>
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
