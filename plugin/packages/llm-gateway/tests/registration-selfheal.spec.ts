import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { registerEnterpriseGateway } from '../src/index.js'

const XIAOMI = { 'xiaomi-token-plan-cn': { apiKeyEnv: 'XIAOMI_TOKEN_PLAN_CN_API_KEY' } }
const SNAPSHOT = {
  models: [{ alias: 'deepseek-flash', apiProtocol: 'openai-completions', isDefault: true }],
  quotas: [], plugins: { revision: 1, assignments: [] },
  sessionPolicy: { enabled: false, retentionDays: 90, maxBatchBytes: 1024 },
} as never

const tick = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 25) })

/** 夹具：entry 可被外部整体重写（模拟官方重提交 config），ctx 带 on/effect。 */
function harness(): { ctx: Context; entry: { options: { id: string; name: string; config: Record<string, unknown> } } } {
  const entry = {
    options: { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { ...XIAOMI } } },
    // 官方 Loader entry 的写入面：整体替换 config（真实语义）
    async update(options: { config: Record<string, unknown> }): Promise<void> {
      entry.options.config = options.config
    },
  }
  const handlers: (() => void)[] = []
  const ctx = {
    get: (name: string) => (name === 'configEditor' ? { entries: () => [entry] } : undefined),
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    on: (_event: string, handler: () => void) => { handlers.push(handler); return () => {} },
    effect: (register: () => unknown) => { register(); return () => {} },
  } as unknown as Context
  return { ctx, entry: Object.assign(entry, { handlers }) }
}

describe('企业 route 注入自愈', () => {
  it('官方整体重提交 config 抹掉贡献后，settings 变更即补回', async () => {
    const { ctx, entry } = harness()
    const dispose = await registerEnterpriseGateway(ctx, {
      platform: { request: async () => new Response('{}'), bootstrap: () => SNAPSHOT, subscribe: () => () => {} },
      harnessVersion: '0.2.0-rc.2',
      bundleVersion: '0.1.0',
    })
    const keys = (): string[] => Object.keys((entry.options.config['providers'] ?? {}) as Record<string, unknown>)
    expect(keys()).toContain('enterprise')

    // 模拟官方把这一行 config 整体重提交（只剩下用户自己的 provider）
    entry.options.config = { providers: { ...XIAOMI } }
    expect(keys()).not.toContain('enterprise')

    // 触发 settings 文档更新 → 应自愈补回
    const handlers = (entry as unknown as { handlers: (() => void)[] }).handlers
    for (const handler of handlers) handler()
    await tick()
    expect(keys()).toContain('enterprise')
    await dispose()
  })
})
