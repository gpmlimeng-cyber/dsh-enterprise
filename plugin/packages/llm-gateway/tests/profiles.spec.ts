/**
 * [INPUT]: 依赖 bootstrap 模型事实与 buildEnterpriseProfiles 的桥接/稳态两种投影
 * [OUTPUT]: 验证三协议 route、单协议合并、稳态不含哨兵、桥接态含哨兵且名称无“企业”后缀
 * [POS]: llm-gateway 的最小配置回归，阻止企业层重新引入消息或 SSE 转换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { BootstrapSnapshot } from '@dshent/platform-client'
import { describe, expect, it } from 'vitest'
import {
  buildEnterpriseProfiles,
  ENTERPRISE_DEFAULT_MODEL,
  ENTERPRISE_SENTINEL_DISPLAY_NAME,
} from '../src/index.js'

function snapshot(): BootstrapSnapshot {
  return {
    revision: 1,
    user: { id: '1', username: 'u', displayName: 'U', departmentId: null },
    device: { id: '2', installationId: '123e4567-e89b-42d3-a456-426614174010', status: 'ACTIVE' },
    models: [
      { alias: 'chat', apiProtocol: 'openai-completions', isDefault: false },
      {
        alias: 'gpt', name: 'GPT', apiProtocol: 'openai-responses', contextWindow: 128_000,
        maxTokens: 16_384, reasoningEfforts: { off: null, xhigh: 'xhigh' }, isDefault: true,
      },
      { alias: 'claude', apiProtocol: 'anthropic-messages', isDefault: false },
    ],
    quotas: [],
    plugins: { revision: 1, assignments: [] },
    sessionPolicy: { enabled: false, retentionDays: 90, maxBatchBytes: 1_048_576 },
    cloudWorkspace: { enabled: true },
  }
}

function singleProtocol(): BootstrapSnapshot {
  return {
    ...snapshot(),
    models: [
      { alias: 'deepseek-flash', apiProtocol: 'openai-completions', isDefault: true },
      { alias: 'deepseek-plus', apiProtocol: 'openai-completions', isDefault: false },
    ],
  }
}

function allModelIds(profiles: ReturnType<typeof buildEnterpriseProfiles>): string[] {
  return Object.values(profiles).flatMap(profile => (profile.models ?? []).map(model => model.id))
}

describe('buildEnterpriseProfiles', () => {
  it('projects three protocol routes in steady state with no default sentinel', () => {
    const profiles = buildEnterpriseProfiles(
      snapshot(),
      'http://127.0.0.1:3000/v1',
      'Bearer local-secret',
    )
    expect(Object.keys(profiles)).toEqual([
      'enterprise-openai-completions',
      'enterprise-openai-responses',
      'enterprise-anthropic-messages',
    ])
    expect(allModelIds(profiles)).not.toContain(ENTERPRISE_DEFAULT_MODEL)
    expect(profiles['enterprise-openai-responses']?.retryPolicy).toBeUndefined()
    expect(profiles['enterprise-openai-responses']?.baseURL).toBe('http://127.0.0.1:3000/v1')
    expect(profiles['enterprise-openai-responses']?.headers).toEqual({ authorization: 'Bearer local-secret' })
    expect(profiles['enterprise-anthropic-messages']?.baseURL).toBe('http://127.0.0.1:3000')
    expect(buildEnterpriseProfiles(undefined, 'http://127.0.0.1:3000/v1', 'Bearer local-secret')).toEqual({})
  })

  it('keeps the sentinel only while bridging an unsynced default', () => {
    const profiles = buildEnterpriseProfiles(
      snapshot(),
      'http://127.0.0.1:3000/v1',
      'Bearer local-secret',
      { includeUnsyncedDefault: true },
    )
    expect(Object.keys(profiles)).toEqual([
      'enterprise-openai-completions',
      'enterprise-openai-responses',
      'enterprise-anthropic-messages',
      'enterprise',
    ])
    expect(profiles['enterprise']?.models?.[0]).toMatchObject({
      id: ENTERPRISE_DEFAULT_MODEL,
      name: ENTERPRISE_SENTINEL_DISPLAY_NAME,
      reasoningEfforts: { off: null, xhigh: 'xhigh' },
    })
    expect(profiles['enterprise']?.models?.[0]?.name).not.toMatch(/企业/)
  })

  it('collapses a single-protocol snapshot into one provider group with only real models', () => {
    const profiles = buildEnterpriseProfiles(
      singleProtocol(),
      'http://127.0.0.1:3000/v1',
      'Bearer local-secret',
    )
    expect(Object.keys(profiles)).toEqual(['enterprise'])
    expect(profiles['enterprise']?.displayName).toBe('企业模型 · Chat Completions')
    const names = (profiles['enterprise']?.models ?? []).map(model => model.name ?? model.id)
    expect(names).toEqual(['deepseek-flash', 'deepseek-plus'])
    expect(allModelIds(profiles)).not.toContain(ENTERPRISE_DEFAULT_MODEL)
    for (const name of names) expect(name).not.toMatch(/企业/)
  })

  it('appends the bridge sentinel into the single group only when asked', () => {
    const profiles = buildEnterpriseProfiles(
      singleProtocol(),
      'http://127.0.0.1:3000/v1',
      'Bearer local-secret',
      { includeUnsyncedDefault: true },
    )
    const models = profiles['enterprise']?.models ?? []
    expect(models.map(model => model.id)).toContain(ENTERPRISE_DEFAULT_MODEL)
    expect(models.map(model => model.name)).toEqual([
      'deepseek-flash',
      'deepseek-plus',
      ENTERPRISE_SENTINEL_DISPLAY_NAME,
    ])
    for (const model of models) expect(model.name).not.toMatch(/企业/)
  })
})
