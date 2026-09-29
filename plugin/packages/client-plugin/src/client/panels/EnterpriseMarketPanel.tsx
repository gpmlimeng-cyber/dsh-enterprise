/**
 * [INPUT]: 依赖 ui-primitives 的 Button/Tag、react 的 hooks、client/index 的取数口与共用骨架、client/messages 的动作文案
 * [OUTPUT]: 对外提供 EnterpriseMarketPanel（分配列表 + 动作 + 阻塞原因 + 安装/卸载，开关关闭时只读）
 * [POS]: 设置分区「企业市场」的实现；是否真正执行安装由 Host 的 installer 与配置开关决定，本面板只发起与呈现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useCallback, useEffect, useState } from 'react'

import {
  EnterpriseErrorNotice,
  EnterpriseSection,
  enterpriseApi,
  type EnterpriseMarketView,
  type EnterpriseRouteMarketEntry,
} from '../index.js'
import { describeMarketAction } from '../messages.js'

/** 单个条目的动作按钮变体：安装/升级为主操作，卸载为危险侧操作。 */
function actionVariant(action: EnterpriseRouteMarketEntry['action']): 'primary' | 'outline' | 'ghost' {
  if (action === 'INSTALL' || action === 'UPGRADE') return 'primary'
  if (action === 'UNINSTALL') return 'outline'
  return 'ghost'
}

/** 条目行：包名、版本、当前状态、阻塞原因与动作按钮。 */
function MarketEntryRow(props: {
  entry: EnterpriseRouteMarketEntry
  busy: boolean
  readOnly: boolean
  onApply: (packageName: string) => void
}) {
  const { entry } = props
  const installedVersion = entry.installed?.version ?? null
  const blocked = entry.blockedReason ?? null
  const disabled = props.busy || props.readOnly || entry.action === 'NONE' || blocked !== null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontWeight: 600 }}>{entry.assignment.packageName}</strong>
        <Tag tone="neutral">{entry.assignment.version}</Tag>
        {entry.assignment.required ? <Tag tone="info">企业必需</Tag> : null}
        <Tag tone={entry.action === 'NONE' ? 'quiet' : 'outline'}>{describeMarketAction(entry.action)}</Tag>
        {entry.installed === null ? null : (
          <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' }}>
            本机已装 {installedVersion}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <Button
            variant={actionVariant(entry.action)}
            size="sm"
            disabled={disabled}
            title={blocked ?? undefined}
            onClick={() => props.onApply(entry.assignment.packageName)}
          >
            {entry.action === 'NONE' ? '无需操作' : describeMarketAction(entry.action)}
          </Button>
        </span>
      </div>
      {blocked === null ? null : (
        <span style={{ fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)' }}>已阻止：{blocked}</span>
      )}
      {entry.installed === null || entry.installed.sha256 === entry.assignment.sha256 ? null : (
        <span style={{ fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>
          本机制品指纹与分配不一致，将升级为分配版本。
        </span>
      )}
    </div>
  )
}

export function EnterpriseMarketPanel() {
  const [view, setView] = useState<EnterpriseMarketView | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const result = await enterpriseApi<EnterpriseMarketView>('/market')
    if (result.ok && result.data && Array.isArray(result.data.entries)) {
      setView(result.data)
      setErrorCode(null)
    } else if (result.ok) {
      setErrorCode('ENT_RESPONSE_INVALID')
    } else {
      setErrorCode(result.code)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const apply = async (packageName: string): Promise<void> => {
    setBusy(true)
    setErrorCode(null)
    setNotice(null)
    const result = await enterpriseApi('/market/apply', { method: 'POST', body: { packageName } })
    if (result.ok) {
      setNotice(`已提交 ${packageName} 的插件动作，完成情况以列表刷新结果为准。`)
    } else {
      setErrorCode(result.code)
    }
    setBusy(false)
    await load()
  }

  const readOnly = view !== null && !view.marketInstallEnabled
  const entries = view?.entries ?? []

  return (
    <EnterpriseSection
      title="企业市场"
      hint="这里只呈现企业中心分配给当前账号的插件；安装与卸载均在本机执行，指纹与大小会再次校验。"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button variant="outline" size="sm" disabled={loading || busy} onClick={() => void load()}>
          {loading ? '读取中…' : '刷新列表'}
        </Button>
        {readOnly ? <Tag tone="warning">只读模式</Tag> : null}
      </div>

      {readOnly ? (
        <span style={{ fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>
          管理员已关闭本地安装开关（marketInstallEnabled=false），当前仅可浏览分配情况。
        </span>
      ) : null}

      {notice === null ? null : (
        <div style={{ fontSize: '12px', color: 'var(--dsw-alias-state-success-primary)' }}>{notice}</div>
      )}
      <EnterpriseErrorNotice code={errorCode} />

      {view === null ? (
        <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>{loading ? '正在读取插件分配…' : '暂无数据'}</span>
      ) : entries.length === 0 ? (
        <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>企业中心当前没有给本账号分配插件。</span>
      ) : (
        entries.map((entry) => (
          <MarketEntryRow
            key={entry.assignment.pluginVersionId}
            entry={entry}
            busy={busy}
            readOnly={readOnly}
            onApply={(packageName) => void apply(packageName)}
          />
        ))
      )}
    </EnterpriseSection>
  )
}
