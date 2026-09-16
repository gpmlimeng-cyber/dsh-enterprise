/**
 * [INPUT]: 依赖共享 EnterpriseAccountStore、Harness Modal/Button、Lucide 图标与同源配方 API
 * [OUTPUT]: 提供设置页内的企业配方列表、详情安全提示与复制导入指令（不自动下载/导入）
 * [POS]: ui 的员工配方广场视图，由 OwnDsh 设置的配方 tab 承载；一期不扩展 plugin-distribution 状态机
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { BookOpen, Copy, LoaderCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { EnterpriseAccountStore } from './account-store.js'
import type { EnterpriseRuntimePreset } from './local-api.js'
import { createEnterpriseLocalApi } from './local-api.js'

const styles = `
.own-preset{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-preset *{box-sizing:border-box}
.own-preset-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.own-preset-search{display:flex;align-items:center;gap:8px;flex:1;min-width:160px;border:1px solid var(--dsw-alias-stroke-border-2,#d0d5dd);border-radius:6px;padding:0 10px;height:36px}
.own-preset-search input{width:100%;min-width:0;border:0;background:none;color:inherit;font:inherit;outline:none}
.own-preset-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}
.own-preset-card{display:flex;flex-direction:column;gap:12px;min-width:0;padding:16px;border:1px solid var(--dsw-alias-stroke-border-2,#e4e7ec);border-radius:8px;background:var(--dsw-alias-background-primary,transparent)}
.own-preset-card:hover,.own-preset-card:focus-within{border-color:var(--dsw-alias-accent-primary,#2563eb)}
.own-preset-title{display:flex;align-items:flex-start;gap:10px;color:inherit;text-align:left;border:0;padding:0;background:none;cursor:pointer;font:inherit;width:100%}
.own-preset-glyph{display:grid;place-items:center;width:36px;height:36px;flex-shrink:0;border-radius:6px;background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-label-secondary,#475467)}
.own-preset-title strong{display:block;font-size:14px;line-height:21px;overflow-wrap:anywhere}
.own-preset-sub{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-preset-meta{margin-top:auto;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:11px}
.own-preset-empty,.own-preset-error{text-align:center;padding:44px 12px;color:var(--dsw-alias-label-secondary,#667085)}
.own-preset-error{color:var(--dsw-alias-state-error-primary,#c4320a)}
.own-preset-trust{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12.5px;line-height:19px}
.own-preset-copy{width:100%;min-height:140px;resize:vertical;border:1px solid var(--dsw-alias-stroke-border-2,#d0d5dd);border-radius:8px;padding:12px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-primary,#101828);background:var(--dsw-alias-background-primary,#fff)}
`

function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`
}

export function buildPresetImportInstruction(
  preset: EnterpriseRuntimePreset,
  platformUrl: string | null,
): string {
  const base = (platformUrl ?? '').replace(/\/$/, '')
  const downloadUrl = preset.versionId
    ? `${base}/enterprise/api/v1/presets/versions/${preset.versionId}/download`
    : `${base}/enterprise/api/v1/presets/${preset.id}`
  return [
    '请先读取并遵循 Preset Square Skill，然后从 DSH Enterprise 下载并导入下面这个 Preset。',
    '读取详情并检查安全信息后，在实际下载和导入前向我确认。',
    `Preset：${downloadUrl}`,
    `名称：${preset.displayName}`,
    `预设 ID：${preset.presetId}`,
    `建议目标标识：${preset.presetId}-ent`,
  ].join('\n')
}

export function EnterprisePresetMarket({ store }: {
  readonly store: EnterpriseAccountStore
}): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const platformUrl = snapshot.status?.platformUrl ?? null
  const connected = snapshot.status?.state === 'READY' || snapshot.status?.state === 'REFRESHING'
  const [items, setItems] = useState<readonly EnterpriseRuntimePreset[] | undefined>()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorCode, setErrorCode] = useState<string>()
  const [selected, setSelected] = useState<EnterpriseRuntimePreset>()
  const [detail, setDetail] = useState<EnterpriseRuntimePreset>()
  const [copied, setCopied] = useState(false)
  const details = useRef<HTMLDivElement>(null)
  const api = createEnterpriseLocalApi()

  const load = async () => {
    if (!connected) {
      setItems(undefined)
      return
    }
    setLoading(true)
    setErrorCode(undefined)
    try {
      const signal = AbortSignal.timeout(8000)
      setItems(await api.presets(signal))
    } catch (error) {
      setErrorCode(error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'ENT_PLATFORM_UNAVAILABLE')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [connected])

  useEffect(() => {
    if (selected === undefined) {
      setDetail(undefined)
      setCopied(false)
      return
    }
    const root = details.current?.closest<HTMLElement>('[role="dialog"]')
    root?.querySelector<HTMLButtonElement>('button')?.focus()
    const signal = AbortSignal.timeout(8000)
    void api.presetDetail(selected.id, signal)
      .then(value => setDetail(value))
      .catch(() => setDetail(selected))
  }, [selected])

  const filtered = (items ?? []).filter(item => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return item.displayName.toLowerCase().includes(needle)
      || item.presetId.toLowerCase().includes(needle)
      || item.description.toLowerCase().includes(needle)
  })

  const instruction = detail ? buildPresetImportInstruction(detail, platformUrl) : ''

  return <>
    <style>{styles}</style>
    <div className="own-preset">
      <div className="own-preset-toolbar">
        <div className="own-preset-search">
          <Search aria-hidden size={14} />
          <input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="搜索企业配方" />
        </div>
        <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => void load()} disabled={loading || !connected}>
          {loading ? '加载中' : '刷新'}
        </Button>
      </div>
      {!connected ? (
        <div className="own-preset-empty">登录企业账号后可浏览已批准配方。</div>
      ) : loading && items === undefined ? (
        <div className="own-preset-empty"><LoaderCircle aria-hidden size={16} /> 正在加载企业配方</div>
      ) : errorCode !== undefined ? (
        <div className="own-preset-error" role="alert">配方目录加载失败 <code>{errorCode}</code></div>
      ) : filtered.length === 0 ? (
        <div className="own-preset-empty">暂无可见配方</div>
      ) : (
        <div className="own-preset-grid">
          {filtered.map(item => (
            <article key={item.id} className="own-preset-card">
              <button type="button" className="own-preset-title" onClick={() => setSelected(item)}>
                <span className="own-preset-glyph"><BookOpen aria-hidden size={16} /></span>
                <span style={{ minWidth: 0 }}>
                  <strong>{item.displayName}</strong>
                  <span className="own-preset-sub">{item.description}</span>
                </span>
              </button>
              <div className="own-preset-meta">DSH {item.sourceDshVersion} · {bytes(item.sizeBytes)}</div>
            </article>
          ))}
        </div>
      )}
      {selected !== undefined ? (
        <Modal open onClose={() => setSelected(undefined)} closeLabel="关闭" title={detail?.displayName ?? selected.displayName}>
          <div ref={details} style={{ display: 'grid', gap: 12, padding: 12 }}>
            <div className="own-preset-trust">
              <ShieldAlert aria-hidden size={16} />
              <span>自定义 Preset 是可执行配置，可能加载插件并以 Agent 权限访问文件。仅导入企业管理员批准的配方，并在导入前确认安全提示。</span>
            </div>
            <div className="own-preset-sub">{detail?.description ?? selected.description}</div>
            <div className="own-preset-sub">预设 ID：{detail?.presetId ?? selected.presetId}</div>
            <textarea className="own-preset-copy" readOnly value={instruction} aria-label="导入指令" />
            <Button
              size="sm"
              icon={<Copy aria-hidden size={14} />}
              onClick={() => {
                void navigator.clipboard.writeText(instruction).then(() => setCopied(true))
              }}
            >
              {copied ? '已复制' : '复制导入指令'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  </>
}
