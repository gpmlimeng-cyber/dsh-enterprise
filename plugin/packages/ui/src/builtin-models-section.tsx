/**
 * [INPUT]: 依赖 EnterpriseAccountStore 的只读模型目录与设置页视觉 token。
 * [OUTPUT]: 对外提供企业内置模型只读区块（内置标签、无任何编辑入口）与纯行投影。
 * [POS]: 官方模型配置页 settings.models.footer 扩展位的伴随插件区块；企业模型一律只读。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import type { EnterpriseBuiltinModel, EnterpriseLocalApiError } from './local-api.js'

/** 只读列表行的纯投影；便于脱离 DOM 做词汇门禁。 */
export interface BuiltinModelRow {
  readonly alias: string
  readonly label: string
  readonly protocol: string
  readonly isDefault: boolean
  readonly contextWindow: number | undefined
}

export function builtinModelRows(
  models: readonly EnterpriseBuiltinModel[] | undefined,
): readonly BuiltinModelRow[] {
  if (models === undefined) return []
  return models.map(model => ({
    alias: model.alias,
    label: model.name,
    protocol: model.apiProtocol,
    isDefault: model.isDefault,
    contextWindow: model.contextWindow,
  }))
}

function errorMessage(error: unknown): string {
  const code = (error as EnterpriseLocalApiError | undefined)?.code
  if (typeof code === 'string' && code.length > 0) return code
  return error instanceof Error ? error.message : String(error)
}

function useStore(store: EnterpriseAccountStore): EnterpriseAccountSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/**
 * 官方模型配置页 footer 扩展区块：列出企业受管模型，带「内置」标签，全程只读。
 * 不提供任何添加/编辑/删除入口——企业模型只能在 DSH Enterprise 控制台变更。
 */
export function EnterpriseBuiltinModelsSection(
  props: { readonly store: EnterpriseAccountStore },
): ReactNode {
  const snapshot = useStore(props.store)
  const [models, setModels] = useState<readonly EnterpriseBuiltinModel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const ready = snapshot.status?.state === 'READY' || snapshot.status?.state === 'REFRESHING'

  const reload = useCallback(async () => {
    if (!ready) return
    try {
      setError(null)
      setModels(await props.store.listBuiltinModels())
      setLoaded(true)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }, [props.store, ready])

  useEffect(() => { void reload() }, [reload])

  // 未登录企业会话时不渲染此区块（与访问门禁一致）。
  if (snapshot.bootstrap?.user === undefined && !loaded) return null
  if (snapshot.bootstrap?.user === undefined && loaded && models.length === 0) return null

  const rows = builtinModelRows(models)

  return (
    <section
      aria-label="企业内置模型"
      style={{
        border: '1px solid var(--dsw-alias-border-l2, #e4e7ec)',
        borderRadius: 8,
        display: 'grid',
        gap: 8,
        marginTop: 16,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 14 }}>企业内置模型</strong>
        <span style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12 }}>
          由企业控制台管理，此处仅查看
        </span>
      </div>

      {error !== null ? (
        <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #c4320a)', fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {rows.length === 0 && error === null ? (
        <div style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 13 }}>
          {loaded ? '暂无企业内置模型' : '加载中…'}
        </div>
      ) : null}

      <ul style={{ display: 'grid', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map(row => (
          <li
            key={row.alias}
            style={{
              alignItems: 'center',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <span
                style={{
                  background: 'var(--dsw-alias-state-business-primary, #4d6bfe)',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: '16px',
                  padding: '0 6px',
                }}
              >
                内置
              </span>
              <span style={{ fontSize: 13, wordBreak: 'break-all' }}>{row.label}</span>
              {row.isDefault ? (
                <span
                  style={{
                    border: '1px solid var(--dsw-alias-border-l2, #e4e7ec)',
                    borderRadius: 4,
                    color: 'var(--dsw-alias-label-tertiary, #667085)',
                    fontSize: 11,
                    lineHeight: '16px',
                    padding: '0 6px',
                  }}
                >
                  默认
                </span>
              ) : null}
            </span>
            <span style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12 }}>
              {row.protocol}
              {row.contextWindow === undefined ? '' : ` · ${row.contextWindow.toLocaleString()} ctx`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
