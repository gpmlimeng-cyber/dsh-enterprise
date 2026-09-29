/**
 * [INPUT]: 依赖 React、Lucide Globe/Save/LoaderCircle、CSS 语法类型与 local-api 的 accountOrigin/setAccountOrigin 契约
 * [OUTPUT]: 提供账户后台地址编辑器与客户端侧 origin 预校验 resolveAccountOrigin、错误码文案表
 * [POS]: dsh-ui 账户设置里唯一的地址输入面，地址只在本组件与 Host 之间往返，不写任何浏览器存储也不回显未解码字符串
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Globe, LoaderCircle, Save } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { EnterpriseAccountOrigin, EnterpriseLocalApi } from './local-api.js'
import { EnterpriseLocalApiError } from './local-api.js'

type AccountOriginTarget = 'platform' | 'inference'

export type AccountOriginResolution =
  | { readonly kind: 'origin'; readonly origin: string }
  | { readonly kind: 'invalid'; readonly target: AccountOriginTarget }
  | { readonly kind: 'missing'; readonly targets: readonly AccountOriginTarget[] }

const TARGETS = {
  platform: { label: '账户后台地址（platformOrigin）', key: 'platformOrigin' as const },
  inference: { label: '推理后台地址（inferenceOrigin）', key: 'inferenceOrigin' as const },
}

/** 与 Host 侧 platformOrigin() 一致的 loopback 白名单；此外的明文 HTTP 就地拦截，不发请求。 */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/**
 * 客户端侧轻量预校验：地址必须是显式 `http(s)://` origin，http 仅允许 loopback，
 * 且不含用户名、密码、路径、查询与片段；返回的已是 Host 会保存的归一化形式。
 * 前缀检查是刻意的——浏览器里 `new URL('a.example.com')` 会相对当前页面解析成合法 URL。
 */
export function resolveAccountOrigin(
  platformOrigin?: string,
  inferenceOrigin?: string,
): AccountOriginResolution {
  const inputs = [
    { target: 'platform' as const, value: platformOrigin },
    { target: 'inference' as const, value: inferenceOrigin },
  ]
  const targets = inputs.filter(input => input.value === undefined || input.value.trim() === '')
    .map(input => input.target)
  if (targets.length > 0) return { kind: 'missing', targets }
  /** 逐字段校验并按 `platform → inference` 顺序归一化；任一字段非法即停在它上面就地提示。 */
  const origins: Partial<Record<AccountOriginTarget, string>> = {}
  for (const input of inputs) {
    const value = (input.value as string).trim()
    if (!/^https?:\/\//i.test(value)) return { kind: 'invalid', target: input.target }
    try {
      const url = new URL(value)
      const loopback = LOOPBACK_HOSTS.includes(url.hostname)
      if ((url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) && url.hostname !== ''
        && url.username === '' && url.password === '' && (url.pathname === '' || url.pathname === '/')
        && url.search === '' && url.hash === '') {
        origins[input.target] = url.origin
        continue
      }
    } catch {
      // 非法 URL 与不合规 URL 走同一条就地提示，不把原文带到任何地方。
    }
    return { kind: 'invalid', target: input.target }
  }
  const platform = origins.platform
  if (platform === undefined) return { kind: 'missing', targets: ['platform'] }
  return { kind: 'origin', origin: platform }
}

/** 未命中的错误码回落到通用兜底，绝不透传服务端 message。 */
const ERRORS: Readonly<Record<string, string>> = {
  ENT_INVALID_REQUEST: '地址必须是 HTTPS，或指向本机的 loopback HTTP 地址。',
  ENT_INVALID_ACCOUNT_ORIGIN: '地址必须是 HTTPS，或指向本机的 loopback HTTP 地址。',
  ENT_ACCOUNT_ORIGIN_WRITE_FAILED: '账户后台地址写入失败，请检查 Harness 配置目录权限后重试。',
  ENT_ACCOUNT_REMOUNT_FAILED: '地址已保存，但官方账户行未能重新挂载，请重启 Harness。',
  ENT_AUTH_REQUIRED: '需要重新登录企业账号。',
  ENT_PERMISSION_DENIED: '当前账号无权修改账户后台地址。',
}

const input: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2, #fff)',
  border: '1px solid var(--dsw-alias-stroke-border-2, #d0d5dd)',
  borderRadius: 8,
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-primary, #101828)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  height: 40,
  minWidth: 0,
  outlineColor: 'var(--dsw-alias-accent-primary, #2563eb)',
  padding: '0 13px',
  width: '100%',
}

const saveButton: CSSProperties = {
  alignItems: 'center',
  background: 'var(--dsw-alias-accent-primary, #2563eb)',
  border: '1px solid transparent',
  borderRadius: 8,
  color: 'var(--dsw-alias-label-on-primary, #fff)',
  cursor: 'pointer',
  display: 'inline-flex',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  gap: 7,
  height: 40,
  justifyContent: 'center',
  padding: '0 16px',
}

/**
 * 账户后台地址编辑器：两个 origin 输入框、占位符回显 Host 默认值、就地校验与结果提示。
 * 服务端字符串只在 local-api 严格解码通过后进入输入框；任何内容都不进 localStorage/sessionStorage。
 */
export function AccountOriginEditor({ api, disabled = false }: {
  readonly api: Pick<EnterpriseLocalApi, 'accountOrigin' | 'setAccountOrigin'>
  readonly disabled?: boolean
}): ReactNode {
  const [origin, setOrigin] = useState<EnterpriseAccountOrigin>()
  const [values, setValues] = useState({ platform: '', inference: '' })
  const [saving, setSaving] = useState(false)
  const [errorCode, setErrorCode] = useState<string>()
  const [localError, setLocalError] = useState<string>()
  const [remounted, setRemounted] = useState<boolean>()
  const requestRef = useRef<AbortController>()
  const platformId = useId()
  const inferenceId = useId()
  const statusId = useId()

  useEffect(() => {
    const controller = new AbortController()
    requestRef.current = controller
    void api.accountOrigin(controller.signal).then((loaded) => {
      if (controller.signal.aborted) return
      setOrigin(loaded)
      setValues({ platform: loaded.platformOrigin, inference: loaded.inferenceOrigin })
      setErrorCode(undefined)
    }, (error: unknown) => {
      if (controller.signal.aborted) return
      setErrorCode(error instanceof EnterpriseLocalApiError ? error.code : 'ENT_LOCAL_UNAVAILABLE')
    })
    return () => { controller.abort() }
  }, [api])

  const busy = saving || disabled
  const notice = localError
    ?? (errorCode === undefined ? undefined : ERRORS[errorCode] ?? '账户后台地址保存失败。')

  const submit = (): void => {
    const resolution = resolveAccountOrigin(values.platform, values.inference)
    setRemounted(undefined)
    setErrorCode(undefined)
    if (resolution.kind !== 'origin') {
      setLocalError(resolution.kind === 'missing'
        ? `请填写${resolution.targets.map(target => TARGETS[target].label).join('与')}。`
        : `请输入有效的 HTTPS 地址；明文 HTTP 仅允许本机 loopback 地址。${TARGETS[resolution.target].label}`)
      return
    }
    setLocalError(undefined)
    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setSaving(true)
    void api.setAccountOrigin({ platformOrigin: resolution.origin, inferenceOrigin: resolution.origin },
      controller.signal).then((updated) => {
      if (controller.signal.aborted) return
      setOrigin(current => ({ ...updated, defaults: current?.defaults ?? updated }))
      setValues({ platform: updated.platformOrigin, inference: updated.inferenceOrigin })
      setRemounted(updated.remounted)
    }, (error: unknown) => {
      if (controller.signal.aborted) return
      setErrorCode(error instanceof EnterpriseLocalApiError ? error.code : 'ENT_LOCAL_UNAVAILABLE')
    }).finally(() => {
      if (!controller.signal.aborted) setSaving(false)
    })
  }

  return <form className="own-account-origin" onSubmit={(event) => { event.preventDefault(); submit() }}
    style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
    <div style={{ alignItems: 'center', display: 'flex', gap: 7 }}>
      <Globe aria-hidden color="var(--dsw-alias-label-secondary, #475467)" size={15} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>账户后台地址</span>
    </div>
    <p style={{ color: 'var(--dsw-alias-label-tertiary, #667085)', fontSize: 12, lineHeight: '18px', margin: 0 }}>
      官方账户登录与 token 使用的后台；默认使用 Host 当前地址，保存后生效。
    </p>
    {(['platform', 'inference'] as const).map(target => <div key={target}
      style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={target === 'platform' ? platformId : inferenceId}
        style={{ color: 'var(--dsw-alias-label-secondary, #475467)', fontSize: 12, lineHeight: '18px' }}>
        {TARGETS[target].label}
      </label>
      <input
        id={target === 'platform' ? platformId : inferenceId}
        aria-describedby={statusId}
        autoComplete="off"
        disabled={busy}
        inputMode="url"
        onChange={(event) => {
          const value = event.currentTarget.value
          setRemounted(undefined)
          setLocalError(undefined)
          setErrorCode(undefined)
          setValues(current => ({ ...current, [target]: value }))
        }}
        placeholder={origin?.defaults[TARGETS[target].key] ?? 'https://account.example.com'}
        spellCheck={false}
        style={input}
        type="text"
        value={values[target]}
      />
    </div>)}
    <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
      <button type="submit" disabled={busy} style={saveButton}>
        {saving ? <><LoaderCircle aria-hidden size={15} />正在保存</> : <><Save aria-hidden size={15} />保存</>}
      </button>
      <span id={statusId} role="status" style={{
        color: notice !== undefined
          ? 'var(--dsw-alias-status-error, #c4320a)'
          : remounted === false
            ? 'var(--dsw-alias-status-warning, #b54708)'
            : 'var(--dsw-alias-state-success-primary, #16803c)',
        fontSize: 13,
        lineHeight: '20px',
      }}>
        {notice ?? (remounted === undefined ? '' : remounted ? '已生效' : '重启后生效')}
      </span>
    </div>
  </form>
}
