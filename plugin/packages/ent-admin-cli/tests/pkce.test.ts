/**
 * [INPUT]: 依赖 vitest 与 src/pkce
 * [OUTPUT]: 验证 PKCE S256 与 loopback state 失败路径
 * [POS]: ent-admin-cli 认证原语测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createPkceS256, PkceLoopbackError, startLoopbackCallback } from '../src/pkce.js'

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
})

