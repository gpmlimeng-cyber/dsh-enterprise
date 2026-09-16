/**
 * [INPUT]: 依赖 EnterpriseAccountStore 会话状态与 ConfirmAction 确认对话框
 * [OUTPUT]: 提供 EnterpriseSessionSyncView：远端列表、恢复目录确认与错误呈现
 * [POS]: OwnDsh 设置「会话同步」tab；仅 enabled 时由父级渲染
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ConfirmAction } from './confirm-action.js'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import type { EnterpriseRemoteSession } from './local-api.js'

const rowStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: 12,
  justifyContent: 'space-between',
  padding: '10px 0',
} as const

const muted = { color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 13 } as const

function useStore(store: EnterpriseAccountStore): EnterpriseAccountSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function EnterpriseSessionSyncView({ store }: { store: EnterpriseAccountStore }): ReactNode {
  const snapshot = useStore(store)
  const cwdId = useId()
  const [cwd, setCwd] = useState('')
  const sessions = snapshot.remoteSessions
  const syncStatus = snapshot.sessionSync

  useEffect(() => {
    void store.refreshSessions()
  }, [store])

  if (snapshot.sessionLoading === true) {
    return <div style={muted} role="status">正在加载会话同步状态…</div>
  }
  if (syncStatus === undefined) {
    return <div style={muted} role="status">正在加载会话同步状态…</div>
  }
  if (!syncStatus.enabled) {
    return <div style={muted} role="status">企业未启用会话同步。</div>
  }
  if (snapshot.sessionErrorCode !== undefined) {
    return <div style={{ color: 'var(--dsw-alias-state-error-primary, #c4320a)', fontSize: 13 }} role="alert">
      会话同步失败：{snapshot.sessionErrorCode}
    </div>
  }

  return <div className="own-session-sync" aria-label="会话同步">
    <div style={{ ...muted, marginBottom: 12 }}>
      设备 {syncStatus.deviceId ?? '—'} · 待同步 {syncStatus.pendingSessionIds.length}
      {syncStatus.lastError === null ? '' : ` · 最近错误 ${syncStatus.lastError}`}
    </div>
    <div style={{ display: 'grid', gap: 8 }}>
      {(sessions ?? []).map((item: EnterpriseRemoteSession) => <div key={item.id} style={{ ...rowStyle, borderTop: '1px solid var(--dsw-alias-border-l2, #e4e7ec)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{item.title ?? item.id}</div>
          <div style={muted}>{item.id} · {item.eventCount} 事件 · seq {item.lastSeq}</div>
        </div>
        <ConfirmAction
          title="恢复会话副本"
          description={`将在 ${cwd.trim() || '（尚未填写目录）'} 创建新本地会话，不会改写源会话 ${item.id}。`}
          confirmLabel="确认恢复"
          disabled={cwd.trim().length === 0}
          onConfirm={() => { void store.restoreSession(item.id, cwd.trim()) }}
        >
          {open => <button type="button" onClick={open}>恢复到目录</button>}
        </ConfirmAction>
      </div>)}
      {(sessions ?? []).length === 0 ? <div style={muted}>暂无远端会话。</div> : null}
    </div>
    <label htmlFor={cwdId} style={{ display: 'block', marginTop: 16, ...muted }}>本地工作目录（绝对路径）</label>
    <input
      id={cwdId}
      value={cwd}
      onChange={event => setCwd(event.target.value)}
      placeholder="/Users/you/project"
      style={{ marginTop: 6, width: '100%' }}
    />
    {snapshot.restoreResult === undefined ? null : <div role="status" style={{ marginTop: 12, color: 'var(--dsw-alias-state-success-primary, #079455)', fontSize: 13 }}>
      已恢复为本地会话 {snapshot.restoreResult.restoredSessionId}
    </div>}
  </div>
}
