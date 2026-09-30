/**
 * [INPUT]: 依赖 platform-client PKCE 公开入口与 Node fetch/crypto 测试运行时
 * [OUTPUT]: 验证 S256、127.0.0.1 callback、state、取消、超时与浏览器结果页（缺省中文/明确英文/品牌/失败态/诊断端口）的自动化证据
 * [POS]: platform-client 登录事务回归测试，锁定系统浏览器回环协议的安全边界与可见结果面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { get } from 'node:http'
import { describe, expect, it } from 'vitest'
import {
  createPkceS256,
  PkceLoopbackError,
  startLoopbackCallback,
  type CallbackRequestDiagnostics,
} from '../src/index.js'

/**
 * 不带任何请求头的 GET：内置 fetch 会默认补 `accept-language: *`，
 * 只有裸 node:http 才能复现「浏览器/客户端完全没送 Accept-Language」这一路径。
 */
const bareGet = (url: string): Promise<string> => new Promise((resolve, reject) => {
  get(url, response => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', chunk => { body += chunk as string })
    response.on('end', () => resolve(body))
  }).on('error', reject)
})

describe('PKCE S256', () => {
  it('derives a standards-compliant verifier and challenge', () => {
    const pair = createPkceS256(new Uint8Array(32).fill(7))
    expect(pair.method).toBe('S256')
    expect(pair.verifier).toHaveLength(43)
    expect(pair.challenge).toBe(
      createHash('sha256').update(pair.verifier, 'ascii').digest('base64url'),
    )
  })

  it('accepts one exact loopback callback with the expected state', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'state-1', timeoutMs: 1_000 })
    expect(callback.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    const response = await fetch(`${callback.redirectUri}?code=code-1&state=state-1`)
    expect(response.status).toBe(200)
    await expect(callback.result).resolves.toEqual({ code: 'code-1', state: 'state-1' })
  })

  it('rejects a mismatched state and closes the transaction', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 1_000 })
    const result = callback.result.catch((error: unknown) => error)
    expect((await fetch(`${callback.redirectUri}?code=code-1&state=forged`)).status).toBe(400)
    const error = await result
    expect(error).toBeInstanceOf(PkceLoopbackError)
    expect((error as PkceLoopbackError).code).toBe('ENT_AUTH_STATE_INVALID')
  })

  it('settles cancellation and timeout with stable codes', async () => {
    const cancelled = await startLoopbackCallback({ expectedState: 'state', timeoutMs: 1_000 })
    const cancelledResult = cancelled.result.catch((error: unknown) => error)
    cancelled.cancel()
    expect((await cancelledResult as PkceLoopbackError).code).toBe('ENT_AUTH_CANCELLED')

    const timedOut = await startLoopbackCallback({ expectedState: 'state', timeoutMs: 10 })
    await expect(timedOut.result).rejects.toMatchObject({ code: 'ENT_AUTH_TIMEOUT' })
  })
})

describe('loopback callback page', () => {
  it('answers a successful login with the localised branded HTML page', async () => {
    const callback = await startLoopbackCallback({
      expectedState: 'state-1',
      timeoutMs: 1_000,
      branding: async () => ({
        name: 'Acme <script>alert(1)</script> & "Co"',
        shortName: 'ignored',
        welcome: { headline: '', editionLabel: '企业版<&"' },
      }),
    })
    const response = await fetch(`${callback.redirectUri}?code=code-1&state=state-1`, {
      headers: { 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    })
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('登录已完成，可以关闭此窗口。')
    expect(html).toContain('Acme &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;')
    expect(html).toContain('企业版&lt;&amp;&quot;')
    // 品牌来自企业后台：页面里只能有本页自己的那一个 script 标签。
    expect(html.match(/<script/g)).toHaveLength(1)
    await expect(callback.result).resolves.toEqual({ code: 'code-1', state: 'state-1' })
  })

  it('uses the default Chinese page and the built-in brand when no header or brand is available', async () => {
    // 产品要求缺省中文（需求变更）：没有 Accept-Language 时结果页必须是中文，不再是英文。
    const callback = await startLoopbackCallback({ expectedState: 'state-2', timeoutMs: 1_000 })
    const html = await (await fetch(`${callback.redirectUri}?code=code-2&state=state-2`)).text()
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('登录已完成，可以关闭此窗口。')
    expect(html).toContain('DSH Enterprise')
    await expect(callback.result).resolves.toEqual({ code: 'code-2', state: 'state-2' })
  })

  it('still answers in English for a browser that explicitly prefers English', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'state-en', timeoutMs: 1_000 })
    const html = await (await fetch(`${callback.redirectUri}?code=code-en&state=state-en`, {
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    })).text()
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Login completed. You can close this window.')
    await expect(callback.result).resolves.toEqual({ code: 'code-en', state: 'state-en' })
  })

  it('reports the truncated Accept-Language and the chosen locale to the diagnostics port', async () => {
    const seen: CallbackRequestDiagnostics[] = []
    const callback = await startLoopbackCallback({
      expectedState: 'state-log',
      timeoutMs: 1_000,
      onCallbackRequest: info => seen.push(info),
    })
    // 超过 200 字符的畸形长头也必须只留前 200 字符；best q 是 en。
    const long = `${'en-US,en;q=0.9,'.repeat(20)}zh;q=0.1`
    await fetch(`${callback.redirectUri}?code=code-log&state=state-log`, {
      headers: { 'accept-language': long },
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.locale).toBe('en')
    expect(seen[0]?.acceptLanguage).toBe(long.slice(0, 200))
    expect(seen[0]?.acceptLanguage).toHaveLength(200)
    await expect(callback.result).resolves.toEqual({ code: 'code-log', state: 'state-log' })
  })

  it('reports an absent Accept-Language as an empty string and the Chinese default', async () => {
    const seen: CallbackRequestDiagnostics[] = []
    const callback = await startLoopbackCallback({
      expectedState: 'state-log-2',
      timeoutMs: 1_000,
      onCallbackRequest: info => seen.push(info),
    })
    // Node 内置 fetch 会自带 `accept-language: *`；这里用裸 node:http 才拿得到真正缺失的请求头。
    await bareGet(`${callback.redirectUri}?code=code-log-2&state=state-log-2`)
    expect(seen).toEqual([{ acceptLanguage: '', locale: 'zh' }])
    await expect(callback.result).resolves.toEqual({ code: 'code-log-2', state: 'state-log-2' })
  })

  it('defaults to Chinese for the wildcard header Node fetch sends by itself', async () => {
    // 实测：undici/内置 fetch 默认发 `accept-language: *`。旧规则把通配符算作「无法识别」而回落英文，
    // 正是企业页显示英文的通道之一；现在通配符一律走缺省中文。
    const seen: CallbackRequestDiagnostics[] = []
    const callback = await startLoopbackCallback({
      expectedState: 'state-log-3',
      timeoutMs: 1_000,
      onCallbackRequest: info => seen.push(info),
    })
    const html = await (await fetch(`${callback.redirectUri}?code=code-log-3&state=state-log-3`)).text()
    expect(seen).toEqual([{ acceptLanguage: '*', locale: 'zh' }])
    expect(html).toContain('<html lang="zh-CN">')
    await expect(callback.result).resolves.toEqual({ code: 'code-log-3', state: 'state-log-3' })
  })

  it('renders a redacted failure page but keeps the stable error code', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 1_000 })
    const result = callback.result.catch((error: unknown) => error)
    const response = await fetch(`${callback.redirectUri}?code=code-1&state=forged`, {
      headers: { 'accept-language': 'zh-CN' },
    })
    const html = await response.text()
    expect(response.status).toBe(400)
    expect(html).toContain('登录会话已失效。')
    expect(html).toContain('请回到客户端重试。')
    expect(html).not.toContain('forged')
    expect(html).not.toContain('ENT_AUTH_STATE_INVALID')
    expect((await result as PkceLoopbackError).code).toBe('ENT_AUTH_STATE_INVALID')
  })

  it('treats an authorization error response as a failure without echoing it', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 1_000 })
    const result = callback.result.catch((error: unknown) => error)
    const url = new URL(callback.redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('state', 'expected')
    const html = await (await fetch(url, { headers: { 'accept-language': 'zh-CN' } })).text()
    expect(html).toContain('身份认证未通过。')
    expect(html).not.toContain('access_denied')
    expect((await result as PkceLoopbackError).code).toBe('ENT_AUTH_CALLBACK_INVALID')
  })

  it('still renders a page when the branding source throws', async () => {
    const callback = await startLoopbackCallback({
      expectedState: 'state-3',
      timeoutMs: 1_000,
      branding: async () => { throw new Error('branding cache exploded') },
    })
    const html = await (await fetch(`${callback.redirectUri}?code=code-3&state=state-3`)).text()
    expect(html).toContain('DSH Enterprise')
    // 产品要求缺省中文：品牌故障不影响语言，无头请求仍是中文结果页。
    expect(html).toContain('登录已完成，可以关闭此窗口。')
    await expect(callback.result).resolves.toEqual({ code: 'code-3', state: 'state-3' })
  })
})
