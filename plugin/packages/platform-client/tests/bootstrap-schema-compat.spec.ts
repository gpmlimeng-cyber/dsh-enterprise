/**
 * [INPUT]: 依赖 platform-client 手写 BootstrapSnapshot schema 与新旧两种服务端负载形状。
 * [OUTPUT]: 验证旧服务端（无 cloudWorkspace 字段）可解析、新服务端字段仍严格、畸形字段仍拒绝。
 * [POS]: 版本偏差回归门禁；cloudWorkspace 曾被设为必填，导致旧 Server 上 ENT_PLATFORM_UNAVAILABLE 使全部企业功能瘫痪。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, it } from 'vitest'
import { zBootstrapResponse } from '../src/types.js'

/** 旧版企业 Server 的 bootstrap 形状：没有 cloudWorkspace 字段。 */
const legacyPayload = {
  data: {
    revision: 7,
    user: { id: '10031', username: 'u', displayName: 'U', departmentId: null },
    device: { id: '90018', installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a', status: 'ACTIVE' },
    models: [],
    quotas: [],
    plugins: { revision: 1, assignments: [] },
    sessionPolicy: { enabled: false, retentionDays: 90, maxBatchBytes: 1048576 },
  },
  requestId: 'req_01K2W3V4X5Y6Z7A8B9C0D1E2F3',
}

describe('bootstrap schema version tolerance', () => {
  it('accepts a legacy server response that omits cloudWorkspace', () => {
    const parsed = zBootstrapResponse.safeParse(legacyPayload)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.data.cloudWorkspace).toBeUndefined()
  })

  it('still accepts a modern server response with cloudWorkspace', () => {
    const parsed = zBootstrapResponse.safeParse({
      ...legacyPayload,
      data: { ...legacyPayload.data, cloudWorkspace: { enabled: true } },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.data.cloudWorkspace?.enabled).toBe(true)
  })

  it('rejects a malformed cloudWorkspace payload so strictness is not lost', () => {
    for (const cloudWorkspace of [{ enabled: 'yes' }, {}, 'on']) {
      const parsed = zBootstrapResponse.safeParse({
        ...legacyPayload,
        data: { ...legacyPayload.data, cloudWorkspace },
      })
      expect(parsed.success).toBe(false)
    }
  })
})
