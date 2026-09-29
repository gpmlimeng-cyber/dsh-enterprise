/**
 * [INPUT]: 依赖 ui-primitives 的 Button/Input、react 的 hooks、client/index 的取数口与共用骨架、client/messages 的文案映射
 * [OUTPUT]: 对外提供 EnterpriseSettingsPanel（服务地址 + 登录/登出/刷新 + 状态、错误与当前用户）
 * [POS]: 设置分区「企业版」的实现，是三块面板中唯一触发写动作的一块；凭据一律不经此界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState } from 'react'

import {
  EnterpriseErrorNotice,
  EnterpriseSection,
  EnterpriseStatusLine,
  enterpriseApi,
  type EnterpriseApiResult,
  useEnterpriseStatus,
} from '../index.js'

/** 登录流程启动结果；仅用于提示，flowId 不落任何持久化存储。 */
interface EnterpriseLoginFlowData {
  flowId: string
}

export function EnterpriseSettingsPanel() {
  const query = useEnterpriseStatus()
  const [serverUrl, setServerUrl] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // 首次拿到状态后用服务端地址回填输入框；用户已编辑则不再覆盖
  useEffect(() => {
    if (!dirty && query.status) {
      setServerUrl(query.status.platformUrl ?? '')
    }
  }, [dirty, query.status])

  const status = query.status
  const user = status?.user ?? null
  const activeError = errorCode ?? query.errorCode

  /** 串行执行一次写动作：清提示、记录稳定码、结束后刷新状态。 */
  const run = async (
    action: () => Promise<EnterpriseApiResult<unknown>>,
    successNotice: string,
  ): Promise<void> => {
    setBusy(true)
    setErrorCode(null)
    setNotice(null)
    const result = await action()
    if (result.ok) {
      setNotice(successNotice)
    } else {
      setErrorCode(result.code)
    }
    setBusy(false)
    await query.reload()
  }

  const saveAndLogin = async (): Promise<void> => {
    const target = serverUrl.trim()
    if (target.length === 0) {
      setErrorCode('ENT_SERVER_URL_INVALID')
      setNotice(null)
      return
    }
    setBusy(true)
    setErrorCode(null)
    setNotice(null)
    const saved = await enterpriseApi('/server-url', { method: 'POST', body: { serverUrl: target } })
    if (!saved.ok) {
      setErrorCode(saved.code)
      setBusy(false)
      await query.reload()
      return
    }
    setDirty(false)
    const login = await enterpriseApi<EnterpriseLoginFlowData>('/login', { method: 'POST' })
    if (login.ok) {
      setNotice('已发起登录，请在浏览器完成授权后回到本页')
    } else {
      setErrorCode(login.code)
    }
    setBusy(false)
    await query.reload()
  }

  return (
    <EnterpriseSection
      title="企业版"
      hint="连接企业中心后，模型与插件由企业统一分配；登录凭据只保存在本机 Host 内存与凭据文件中。"
    >
      <EnterpriseStatusLine status={status} errorCode={activeError} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="dshent-enterprise-server-url">服务地址</label>
        <Input
          id="dshent-enterprise-server-url"
          placeholder="https://enterprise.example.com:8443"
          value={serverUrl}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setServerUrl(event.currentTarget.value)
            setDirty(true)
          }}
        />
        <span style={{ fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>
          修改地址会清空当前登录凭据，需要重新登录。
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => void saveAndLogin()}>
          {busy ? '处理中…' : '保存并登录'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || (status?.platformUrl ?? '') === ''}
          onClick={() =>
            void run(
              () => enterpriseApi<EnterpriseLoginFlowData>('/login', { method: 'POST' }),
              '已重新发起登录，请在浏览器完成授权',
            )
          }
        >
          重新登录
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void run(() => enterpriseApi('/refresh', { method: 'POST' }), '已刷新企业连接状态')}
        >
          刷新状态
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || (status?.platformUrl ?? '') === ''}
          onClick={() => void run(() => enterpriseApi('/logout', { method: 'POST' }), '已退出企业登录')}
        >
          退出登录
        </Button>
      </div>

      {notice === null ? null : (
        <div style={{ fontSize: '12px', color: 'var(--dsw-alias-state-success-primary)' }}>{notice}</div>
      )}
      <EnterpriseErrorNotice code={errorCode} />

      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0 }}>
        <dt style={{ color: 'var(--dsw-alias-label-tertiary)' }}>状态机</dt>
        <dd style={{ margin: 0 }}>
          <Tag tone={status?.state === 'READY' ? 'success' : status?.state === 'FAILED' ? 'danger' : 'neutral'}>
            {status?.state ?? 'UNKNOWN'}
          </Tag>
        </dd>
        <dt style={{ color: 'var(--dsw-alias-label-tertiary)' }}>客户端版本</dt>
        <dd style={{ margin: 0 }}>{status?.bundleVersion ?? '—'}</dd>
        <dt style={{ color: 'var(--dsw-alias-label-tertiary)' }}>当前用户</dt>
        <dd style={{ margin: 0 }}>
          {user === null ? '未登录' : `${user.displayName}（${user.username}）`}
        </dd>
        <dt style={{ color: 'var(--dsw-alias-label-tertiary)' }}>部门</dt>
        <dd style={{ margin: 0 }}>{user?.departmentId ?? '—'}</dd>
        <dt style={{ color: 'var(--dsw-alias-label-tertiary)' }}>企业配置版本</dt>
        <dd style={{ margin: 0 }}>{status?.revision === undefined ? '—' : String(status.revision)}</dd>
      </dl>
    </EnterpriseSection>
  )
}
