/**
 * [INPUT]: 依赖 EnterpriseLocalApi 的云端项目方法与设置页视觉 token。
 * [OUTPUT]: 对外提供云端项目列表、创建、映射与 pull/commit/push 操作视图。
 * [POS]: ui 的云端工作空间设置 tab；只走本地 API，不持有 Access Token。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import type { EnterpriseCloudProject, EnterpriseLocalApiError } from './local-api.js'

interface EnterpriseCloudProjectsViewProps {
  readonly store: EnterpriseAccountStore
}

function useStore(store: EnterpriseAccountStore): EnterpriseAccountSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function errorMessage(error: unknown): string {
  const code = (error as EnterpriseLocalApiError | undefined)?.code
  if (typeof code === 'string' && code.length > 0) return code
  return error instanceof Error ? error.message : String(error)
}

/** 「云端项目」tab：列表 + 创建 + 映射/同步。 */
export function EnterpriseCloudProjectsView(props: EnterpriseCloudProjectsViewProps): ReactNode {
  const snapshot = useStore(props.store)
  const [projects, setProjects] = useState<readonly EnterpriseCloudProject[]>([])
  const [name, setName] = useState('')
  const [rootDir, setRootDir] = useState('')
  const [message, setMessage] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (snapshot.status?.state !== 'READY') return
    try {
      setError(null)
      setProjects(await props.store.listCloudProjects())
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }, [props.store, snapshot.status?.state])

  useEffect(() => { void reload() }, [reload])

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      await reload()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [reload])

  if (snapshot.bootstrap?.cloudWorkspaceEnabled !== true) {
    return <div style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 13, padding: 12 }}>
      云端工作空间未启用。请检查企业 Server 配置 enterprise.cloud-workspace.enabled。
    </div>
  }

  return (
    <div className="own-cloud-workspace" style={{ display: 'grid', gap: 12, padding: 12 }}>
      <form
        style={{ display: 'grid', gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            await props.store.createCloudProject(name.trim(), null)
            setName('')
            setNotice('已创建云端项目')
          })
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          项目名称
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Team Docs"
            style={{ padding: '6px 8px' }}
          />
        </label>
        <button type="submit" disabled={busy || name.trim().length === 0}>
          创建云端项目
        </button>
      </form>

      <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
        本地根目录（绝对路径）
        <input
          value={rootDir}
          onChange={event => setRootDir(event.target.value)}
          placeholder="/Users/you/workspace"
          style={{ padding: '6px 8px' }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
        提交说明
        <input
          value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder="update docs"
          style={{ padding: '6px 8px' }}
        />
      </label>

      {notice === null ? null : <div role="status" style={{ color: 'var(--dsw-alias-state-success-primary, #027a48)', fontSize: 13 }}>{notice}</div>}
      {error === null ? null : <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #c4320a)', fontSize: 13 }}>{error}</div>}

      <ul style={{ display: 'grid', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
        {projects.map(project => (
          <li
            key={project.id}
            style={{
              border: '1px solid var(--dsw-alias-border-l2, #e4e7ec)',
              borderRadius: 8,
              display: 'grid',
              gap: 8,
              padding: 10,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
              <strong>{project.name}</strong>
              <span style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12 }}>
                {project.role} · {project.defaultBranch}
              </span>
            </div>
            <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{project.cloneUrl}</code>
            <div style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12 }}>
              {project.mapping === null ? '未映射本地目录' : `本地：${project.mapping.path}`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                disabled={busy || rootDir.trim().length === 0}
                onClick={() => {
                  setActiveId(project.id)
                  void run(async () => {
                    await props.store.cloneCloudProject(project.id, rootDir.trim())
                    setNotice('已克隆到本地映射目录')
                  }).finally(() => setActiveId(null))
                }}
              >
                映射本地
              </button>
              <button
                type="button"
                disabled={busy || project.mapping === null}
                onClick={() => {
                  void run(async () => {
                    const result = await props.store.pullCloudProject(project.id)
                    setNotice(result.message)
                  })
                }}
              >
                拉取
              </button>
              <button
                type="button"
                disabled={busy || project.mapping === null || message.trim().length === 0}
                onClick={() => {
                  void run(async () => {
                    const result = await props.store.commitCloudProject(project.id, message.trim())
                    setNotice(result.committed ? '已提交本地变更' : '没有需要提交的变更')
                  })
                }}
              >
                提交
              </button>
              <button
                type="button"
                disabled={busy || project.mapping === null}
                onClick={() => {
                  void run(async () => {
                    await props.store.pushCloudProject(project.id)
                    setNotice('已推送到云端')
                  })
                }}
              >
                推送
              </button>
            </div>
            {activeId === project.id ? <div style={{ fontSize: 12 }}>处理中…</div> : null}
          </li>
        ))}
        {projects.length === 0 ? (
          <li style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 13 }}>
            暂无云端项目。先创建一个，再映射本地目录。
          </li>
        ) : null}
      </ul>
    </div>
  )
}
