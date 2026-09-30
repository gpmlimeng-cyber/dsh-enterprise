/**
 * [INPUT]: 依赖假的官方 Loader `configEditor`/logger、内存平台端口与官方 pi-ai route 类型
 * [OUTPUT]: 验证企业 routes 合并进**已挂载**的官方 pi-ai entry，用户 provider 保留，释放时撤回
 * [POS]: llm-gateway 的组合回归，锁住「复用已挂载实例、不再挂第二份 pi-ai」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { BootstrapSnapshot } from '@dshent/platform-client'
import { registerEnterpriseGateway } from '../src/index.js'

/** 一份最小但合法的 bootstrap 快照：三种 wire API 各一个模型，第二个为默认。 */
const SNAPSHOT: BootstrapSnapshot = {
  revision: 1,
  user: { id: '1', username: 'linus', displayName: 'Linus', departmentId: null },
  device: { id: '2', installationId: '3f1a5e2c-1b4d-4a9e-8c7f-2d5b6a9c8e10', status: 'ACTIVE' },
  models: [
    { alias: 'ent-chat', name: 'Ent Chat', apiProtocol: 'openai-completions', isDefault: false },
    { alias: 'ent-default', name: 'Ent Default', apiProtocol: 'openai-responses', isDefault: true },
    { alias: 'ent-claude', name: 'Ent Claude', apiProtocol: 'anthropic-messages', isDefault: false },
  ],
  quotas: [],
  plugins: { revision: 1, assignments: [] },
  sessionPolicy: { enabled: false, retentionDays: 30, maxBatchBytes: 1024 },
}

interface FakeEntry {
  readonly options: { readonly id: string, readonly name: string, readonly config: Record<string, unknown> }
  update(options: { readonly config: unknown }): Promise<void>
}

/** 官方 Loader owner row 的替身：`update` 只改内存配置，等价于 volatile-only 提交。 */
function createHarness(initialProviders: Record<string, unknown> = {}): {
  ctx: Context
  entry: FakeEntry
  writes: Record<string, unknown>[]
} {
  const writes: Record<string, unknown>[] = []
  const entry: FakeEntry = {
    options: { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: initialProviders } },
    async update(options) {
      entry.options.config = options.config as Record<string, unknown>
      writes.push(entry.options.config)
    },
  }
  const ctx = {
    get: (name: string) => (name === 'configEditor' ? { entries: () => [entry] } : undefined),
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as Context
  return { ctx, entry, writes }
}

describe('registerEnterpriseGateway', () => {
  const disposers: (() => Promise<void>)[] = []

  afterEach(async () => {
    await Promise.all(disposers.splice(0).map(dispose => dispose()))
  })

  it('merges the enterprise routes into the mounted pi-ai entry and keeps the user providers', async () => {
    const { ctx, entry, writes } = createHarness({ 'xiaomi-token-plan-cn': { apiKeyEnv: 'XIAOMI_TOKEN_PLAN_CN_API_KEY' } })
    const dispose = await registerEnterpriseGateway(ctx, {
      platform: {
        request: async () => new Response('{}'),
        bootstrap: () => SNAPSHOT,
        subscribe: () => () => {},
      },
      harnessVersion: '0.1.7-rc.2',
      bundleVersion: '0.1.0',
    })
    disposers.push(dispose)

    const providers = entry.options.config['providers'] as Record<string, { baseURL?: string }>
    // 产品裁决（2026-09-30，去重）：默认模型不进协议组 → openai-responses 组不产出（5 → 4）。
    expect(Object.keys(providers).sort()).toEqual([
      'enterprise',
      'enterprise-anthropic-messages',
      'enterprise-openai-completions',
      'xiaomi-token-plan-cn',
    ])
    // 企业 route 指向 Host 私有回环代理，用户自己的 provider 逐字保留。
    expect(providers['enterprise']?.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v1$/u)
    expect(providers['xiaomi-token-plan-cn']).toEqual({ apiKeyEnv: 'XIAOMI_TOKEN_PLAN_CN_API_KEY' })
    expect(writes).toHaveLength(1)

    // 释放：只撤回企业键空间，用户 provider 仍在。
    await dispose()
    expect(entry.options.config['providers']).toEqual({ 'xiaomi-token-plan-cn': { apiKeyEnv: 'XIAOMI_TOKEN_PLAN_CN_API_KEY' } })
  })

  it('reports a missing official row instead of mounting a second pi-ai instance', async () => {
    const errors: string[] = []
    const ctx = {
      get: () => undefined,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: (message: string) => { errors.push(message) } },
    } as unknown as Context
    const dispose = await registerEnterpriseGateway(ctx, {
      platform: { request: async () => new Response('{}'), bootstrap: () => undefined, subscribe: () => () => {} },
      harnessVersion: '0.1.7-rc.2',
      bundleVersion: '0.1.0',
    })
    disposers.push(dispose)
    expect(errors.join('\n')).toContain('is not mounted in this profile')
  })
})
