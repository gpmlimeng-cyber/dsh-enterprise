/**
 * [INPUT]: 依赖 ui-primitives 的 Button/Tag、react 的 hooks、client/index 的取数口与共用骨架、client/messages 的窗口/数字文案
 * [OUTPUT]: 对外提供 EnterpriseUsagePanel（按策略展示四窗口进度、用量与重置时间）
 * [POS]: 设置分区「用量与配额」的实现；只读面板，不产生任何写动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useCallback, useEffect, useState } from 'react'

import {
  EnterpriseErrorNotice,
  EnterpriseSection,
  enterpriseApi,
  type EnterpriseRouteQuotaPolicy,
} from '../index.js'
import {
  describeQuotaWindow,
  formatResetTime,
  formatTokenCount,
} from '../messages.js'

/** 单窗口进度条；percent 为 null 表示无上限，用中性填充表示「不设限」。 */
function QuotaWindowRow(props: {
  windowKey: string
  label: string
  percent: number | null
  usedTokens: number
  reservedTokens: number
  limit: number | null
  resetsAt: string | null
  exhausted: boolean
}) {
  const percent = props.percent === null ? null : Math.max(0, Math.min(100, props.percent))
  const fillColor = props.exhausted
    ? 'var(--dsw-alias-state-error-primary)'
    : percent !== null && percent >= 80
      ? 'var(--dsw-alias-state-warn-primary)'
      : 'var(--dsw-alias-state-success-primary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ minWidth: '48px' }}>{describeQuotaWindow(props.windowKey, props.label)}</span>
        <span style={{ color: 'var(--dsw-alias-label-secondary)' }}>
          {formatTokenCount(props.usedTokens)}
          {props.reservedTokens > 0 ? `（在途 ${formatTokenCount(props.reservedTokens)}）` : ''}
          {' / '}
          {props.limit === null ? '不限' : formatTokenCount(props.limit)}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' }}>
          {percent === null ? '不设上限' : `${percent}%`}
        </span>
        {props.exhausted ? <Tag tone="danger">已用尽</Tag> : null}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 0}
        style={{
          height: '6px',
          borderRadius: '3px',
          backgroundColor: 'var(--dsw-alias-bg-layer-3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent ?? 100}%`,
            height: '100%',
            backgroundColor: fillColor,
            opacity: percent === null ? 0.25 : 1,
          }}
        />
      </div>
      <span style={{ fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>
        重置时间：{formatResetTime(props.resetsAt)}
      </span>
    </div>
  )
}

export function EnterpriseUsagePanel() {
  const [policies, setPolicies] = useState<EnterpriseRouteQuotaPolicy[] | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const result = await enterpriseApi<EnterpriseRouteQuotaPolicy[]>('/usage')
    if (result.ok) {
      setPolicies(Array.isArray(result.data) ? result.data : [])
      setErrorCode(null)
    } else {
      setErrorCode(result.code)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <EnterpriseSection
      title="用量与配额"
      hint="按企业配额策略汇总五小时、每日、每周与每月的令牌用量；在途预留在括号内单独标出。"
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          {loading ? '读取中…' : '刷新用量'}
        </Button>
      </div>

      <EnterpriseErrorNotice code={errorCode} />

      {policies === null ? (
        <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>{loading ? '正在读取用量…' : '暂无数据'}</span>
      ) : policies.length === 0 ? (
        <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>
          当前账号没有被分配配额策略，用量不受企业限制。
        </span>
      ) : (
        policies.map((policy) => (
          <div
            key={policy.policyId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontWeight: 600 }}>{policy.name}</strong>
              <Tag tone="neutral">{policy.resourceName}</Tag>
              <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' }}>
                {policy.scope} · {policy.resourceType}
              </span>
            </div>
            {policy.windows.length === 0 ? (
              <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' }}>
                该策略未设置任何用量窗口。
              </span>
            ) : (
              policy.windows.map((window) => (
                <QuotaWindowRow
                  key={window.key}
                  windowKey={window.key}
                  label={window.label}
                  percent={window.percent}
                  usedTokens={window.usedTokens}
                  reservedTokens={window.reservedTokens}
                  limit={window.limit}
                  resetsAt={window.resetsAt}
                  exhausted={window.exhausted}
                />
              ))
            )}
          </div>
        ))
      )}
    </EnterpriseSection>
  )
}
