/**
 * [INPUT]: 依赖默认模型同步的纯决策函数与 profiles 目录形状
 * [OUTPUT]: 验证占位桥接判定、模型归属解析、采纳决策（含用户自定义保护）与 adoptAdminDefault 写入语义
 * [POS]: llm-gateway 默认模型同步的单元门禁；不触及 Cordis、settings 或网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { BootstrapSnapshot } from '@dshent/platform-client'
import { describe, expect, it, vi } from 'vitest'
import {
  adoptAdminDefault,
  needsUnsyncedDefaultBridge,
  providerKeyForModel,
  shouldAdoptAdminDefault,
} from '../src/default-model.js'
import {
  ENTERPRISE_DEFAULT_MODEL,
  ENTERPRISE_DEFAULT_PROVIDER,
} from '../src/profiles.js'

const PLACEHOLDER = { provider: ENTERPRISE_DEFAULT_PROVIDER, model: ENTERPRISE_DEFAULT_MODEL }

describe('needsUnsyncedDefaultBridge', () => {
  it('treats a missing selection and the placeholder as bridged', () => {
    expect(needsUnsyncedDefaultBridge(undefined)).toBe(true)
    expect(needsUnsyncedDefaultBridge(PLACEHOLDER)).toBe(true)
  })

  it('treats any concrete selection as synced', () => {
    expect(needsUnsyncedDefaultBridge({ provider: 'enterprise', model: 'deepseek-flash' })).toBe(false)
    expect(needsUnsyncedDefaultBridge({ provider: 'enterprise-openai-completions', model: 'chat' })).toBe(false)
  })
})

describe('providerKeyForModel', () => {
  const single = {
    enterprise: { models: [{ id: 'deepseek-flash' }] },
  } as never
  const multi = {
    'enterprise-openai-completions': { models: [{ id: 'chat' }] },
    enterprise: { models: [{ id: ENTERPRISE_DEFAULT_MODEL }] },
  } as never

  it('resolves a model to its owning provider in both shapes', () => {
    expect(providerKeyForModel(single, 'deepseek-flash')).toBe('enterprise')
    expect(providerKeyForModel(multi, 'chat')).toBe('enterprise-openai-completions')
    expect(providerKeyForModel(multi, ENTERPRISE_DEFAULT_MODEL)).toBe('enterprise')
    expect(providerKeyForModel(multi, 'missing')).toBeUndefined()
  })
})

describe('shouldAdoptAdminDefault', () => {
  const admin = 'deepseek-flash'
  const provider = 'enterprise'

  it('adopts while still on the placeholder', () => {
    expect(shouldAdoptAdminDefault(PLACEHOLDER, undefined, admin, provider)).toBe(true)
  })

  it('keeps following while the selection is one we wrote', () => {
    expect(shouldAdoptAdminDefault(
      { provider, model: 'old-default' }, 'old-default', admin, provider,
    )).toBe(true)
  })

  it('never overwrites a user-chosen custom default', () => {
    expect(shouldAdoptAdminDefault(
      { provider, model: 'user-picked' }, 'old-default', admin, provider,
    )).toBe(false)
  })

  it('does not rewrite an already aligned selection', () => {
    expect(shouldAdoptAdminDefault({ provider, model: admin }, undefined, admin, provider)).toBe(false)
    expect(shouldAdoptAdminDefault({ provider, model: admin }, admin, admin, provider)).toBe(false)
  })

  it('refuses when the admin model has no owning provider', () => {
    expect(shouldAdoptAdminDefault(PLACEHOLDER, undefined, admin, undefined)).toBe(false)
  })
})

function bootstrap(defaultAlias: string): BootstrapSnapshot {
  return {
    revision: 1,
    user: { id: '1', username: 'u', displayName: 'U', departmentId: null },
    device: { id: '2', installationId: '123e4567-e89b-42d3-a456-426614174010', status: 'ACTIVE' },
    models: [
      { alias: defaultAlias, apiProtocol: 'openai-completions', isDefault: true },
      { alias: 'other', apiProtocol: 'openai-completions', isDefault: false },
    ],
    quotas: [],
    plugins: { revision: 1, assignments: [] },
    sessionPolicy: { enabled: false, retentionDays: 90, maxBatchBytes: 1_048_576 },
  }
}

describe('adoptAdminDefault', () => {
  const providers = { enterprise: { models: [{ id: 'deepseek-flash' }] } } as never

  it('writes the provider that owns the admin default when still on the placeholder', async () => {
    const saveSelection = vi.fn(async () => undefined)
    const port = { currentSelection: () => PLACEHOLDER, saveSelection }
    const result = await adoptAdminDefault(port, providers, bootstrap('deepseek-flash'), undefined)

    expect(result).toEqual({ changed: true, lastAdopted: 'deepseek-flash' })
    expect(saveSelection).toHaveBeenCalledWith({ provider: 'enterprise', model: 'deepseek-flash' })
  })

  it('returns unchanged when the port or default is missing', async () => {
    expect(await adoptAdminDefault(undefined, providers, bootstrap('deepseek-flash'), undefined))
      .toEqual({ changed: false, lastAdopted: undefined })
    const port = { currentSelection: () => PLACEHOLDER, saveSelection: async () => undefined }
    expect(await adoptAdminDefault(port, providers, undefined, undefined))
      .toEqual({ changed: false, lastAdopted: undefined })
  })

  it('records alignment without writing when settings already match', async () => {
    const saveSelection = vi.fn(async () => undefined)
    const port = {
      currentSelection: () => ({ provider: 'enterprise', model: 'deepseek-flash' }),
      saveSelection,
    }
    const result = await adoptAdminDefault(port, providers, bootstrap('deepseek-flash'), undefined)

    expect(result).toEqual({ changed: false, lastAdopted: 'deepseek-flash' })
    expect(saveSelection).not.toHaveBeenCalled()
  })

  it('leaves a user-chosen default alone', async () => {
    const saveSelection = vi.fn(async () => undefined)
    const port = {
      currentSelection: () => ({ provider: 'enterprise', model: 'user-picked' }),
      saveSelection,
    }
    const result = await adoptAdminDefault(port, providers, bootstrap('deepseek-flash'), 'old-default')

    expect(result).toEqual({ changed: false, lastAdopted: 'old-default' })
    expect(saveSelection).not.toHaveBeenCalled()
  })
})
