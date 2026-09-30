/**
 * [INPUT]: 依赖 vitest 与 src/pkce
 * [OUTPUT]: 验证 PKCE S256、loopback state/code 失败路径与浏览器结果页（缺省中文、明确英文、失败态、诊断端口留痕）
 * [POS]: ent-admin-cli 认证原语测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createPkceS256, PkceLoopbackError, startLoopbackCallback, type CallbackRequestDiagnostics } from '../src/pkce.js'

describe('createPkceS256', () => {
  it('produces S256 challenge from verifier', () => {
    const pair = createPkceS256(randomBytes(32))
    expect(pair.method).toBe('S256')
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43)
    expect(pair.challenge).toBe(createHash('sha256').update(pair.verifier, 'ascii').digest('base64url'))
  })
})

describe('startLoopbackCallback', () => {
  it('rejects state mismatch', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 2000 })
    const settled = callback.result.then(
      () => undefined,
      (error: unknown) => error,
    )
    const url = new URL(callback.redirectUri)
    url.searchParams.set('code', 'abc')
    url.searchParams.set('state', 'wrong')
    await expect(fetch(url)).resolves.toBeTruthy()
    await expect(settled).resolves.toMatchObject({ code: 'ENT_AUTH_STATE_INVALID' } satisfies Partial<PkceLoopbackError>)
  })

  it('rejects missing code', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 2000 })
    const settled = callback.result.then(
      () => undefined,
      (error: unknown) => error,
    )
    const url = new URL(callback.redirectUri)
    url.searchParams.set('state', 'expected')
    await expect(fetch(url)).resolves.toBeTruthy()
    await expect(settled).resolves.toMatchObject({ code: 'ENT_AUTH_CALLBACK_INVALID' })
  })

  it('answers success with the localised HTML page', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 2000 })
    const url = new URL(callback.redirectUri)
    url.searchParams.set('code', 'abc')
    url.searchParams.set('state', 'expected')
    const response = await fetch(url, { headers: { 'accept-language': 'en-US,en;q=0.9' } })
    const html = await response.text()
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Login completed. You can close this window.')
    expect(html).toContain('DSH Enterprise')
    await expect(callback.result).resolves.toEqual({ code: 'abc', state: 'expected' })
  })

  it('answers success with the default Chinese page when Accept-Language is absent', async () => {
    // 产品要求缺省中文（需求变更）：没有 Accept-Language 时结果页必须是中文，不再是英文。
    const callback = await startLoopbackCallback({ expectedState: 'expected-zh', timeoutMs: 2000 })
    const url = new URL(callback.redirectUri)
    url.searchParams.set('code', 'abc')
    url.searchParams.set('state', 'expected-zh')
    const html = await (await fetch(url)).text()
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('登录已完成，可以关闭此窗口。')
    await expect(callback.result).resolves.toEqual({ code: 'abc', state: 'expected-zh' })
  })

  it('reports the raw Accept-Language and the chosen locale to the diagnostics port', async () => {
    const seen: CallbackRequestDiagnostics[] = []
    const callback = await startLoopbackCallback({
      expectedState: 'expected-log',
      timeoutMs: 2000,
      onCallbackRequest: info => seen.push(info),
    })
    const url = new URL(callback.redirectUri)
    url.searchParams.set('code', 'abc')
    url.searchParams.set('state', 'expected-log')
    await fetch(url, { headers: { 'accept-language': 'fr-FR,fr;q=0.9' } })
    // 既非中文也非明确英文：判定结论回落中文，原文照留便于事后定性。
    expect(seen).toEqual([{ acceptLanguage: 'fr-FR,fr;q=0.9', locale: 'zh' }])
    await expect(callback.result).resolves.toEqual({ code: 'abc', state: 'expected-log' })
  })

  it('renders a redacted failure page for a mismatched state', async () => {
    const callback = await startLoopbackCallback({ expectedState: 'expected', timeoutMs: 2000 })
    const settled = callback.result.catch((error: unknown) => error)
    const url = new URL(callback.redirectUri)
    url.searchParams.set('code', 'abc')
    url.searchParams.set('state', 'wrong')
    const response = await fetch(url, { headers: { 'accept-language': 'zh-CN' } })
    const html = await response.text()
    expect(response.status).toBe(400)
    expect(html).toContain('登录会话已失效。')
    expect(html).toContain('请回到客户端重试。')
    expect(html).not.toContain('wrong')
    await expect(settled).resolves.toMatchObject({ code: 'ENT_AUTH_STATE_INVALID' })
  })
})

