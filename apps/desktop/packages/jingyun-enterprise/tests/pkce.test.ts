/**
 * [INPUT]: 依赖 vitest，依赖 src/platform/pkce 的纯函数（不开启任何真实监听端口）
 * [OUTPUT]: 对外提供 RFC 7636 S256 向量、verifier/state/transaction 字符集与长度、非法输入拒绝的验收
 * [POS]: platform 层登录原语的裁判；回调服务器只测参数守卫，真实回环行为留给 Host 集成测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'

import {
  ENTERPRISE_CALLBACK_PATH,
  codeChallengeS256,
  createCodeVerifier,
  createState,
  createTransactionId,
  startLoopbackCallback,
} from '../src/platform/pkce.js'

/** RFC 7636 §4.1 unreserved 字符集。 */
const VERIFIER_CHARSET = /^[A-Za-z0-9._~-]+$/
/** state/transactionId 使用 URL 安全子集。 */
const OPAQUE_CHARSET = /^[A-Za-z0-9_-]+$/

describe('pkce 纯函数', () => {
  it('codeChallengeS256 与 RFC 7636 附录 B 向量一致', () => {
    // RFC 7636 Appendix B 官方样例（verifier 43 字符，challenge 为 base64url 无 padding）。
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(verifier).toHaveLength(43)
    expect(codeChallengeS256(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('codeChallengeS256 是 sha256 的 base64url 投影（第二组独立向量）', () => {
    // sha256('a'.repeat(43)) 的 base64url，无 padding 且不含 "="。
    const verifier = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const challenge = codeChallengeS256(verifier)
    expect(challenge).toBe('ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA')
    expect(challenge).not.toContain('=')
    expect(challenge).toHaveLength(43)
  })

  it('codeChallengeS256 对非法 verifier 抛协议错误', () => {
    expect(() => codeChallengeS256('too-short')).toThrowError(/verifier/)
    expect(() => codeChallengeS256(`${'a'.repeat(42)}*`)).toThrowError(/verifier/)
    expect(() => codeChallengeS256('a'.repeat(129))).toThrowError(/verifier/)
  })

  it('createCodeVerifier 落在 RFC 7636 字符集与长度区间内且每次不同', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 32; i++) {
      const verifier = createCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier.length).toBeLessThanOrEqual(128)
      expect(VERIFIER_CHARSET.test(verifier)).toBe(true)
      seen.add(verifier)
    }
    expect(seen.size).toBe(32)
  })

  it('createState / createTransactionId 落在 32–64 字符 URL 安全集内', () => {
    for (let i = 0; i < 16; i++) {
      const state = createState()
      const transactionId = createTransactionId()
      expect(state.length).toBeGreaterThanOrEqual(32)
      expect(state.length).toBeLessThanOrEqual(64)
      expect(OPAQUE_CHARSET.test(state)).toBe(true)
      expect(transactionId.length).toBeGreaterThanOrEqual(32)
      expect(transactionId.length).toBeLessThanOrEqual(64)
      expect(OPAQUE_CHARSET.test(transactionId)).toBe(true)
      expect(state).not.toBe(transactionId)
    }
  })

  it('默认回调路径与契约 redirect_uri 约定一致', () => {
    expect(ENTERPRISE_CALLBACK_PATH).toBe('/enterprise/auth/callback')
  })

  it('startLoopbackCallback 在开端口前拒绝非法参数（不占用任何端口）', async () => {
    await expect(startLoopbackCallback({ timeoutMs: 0 })).rejects.toThrowError(/timeoutMs/)
    await expect(startLoopbackCallback({ timeoutMs: 1.5 })).rejects.toThrowError(/timeoutMs/)
    await expect(startLoopbackCallback({ timeoutMs: 1_000, port: 70_000 })).rejects.toThrowError(/port/)
    await expect(startLoopbackCallback({ timeoutMs: 1_000, path: 'callback' })).rejects.toThrowError(/回调路径/)
  })
})
