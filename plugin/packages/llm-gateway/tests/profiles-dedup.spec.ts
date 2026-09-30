import { describe, expect, it } from 'vitest'
import { buildEnterpriseProfiles } from '../src/profiles.js'

/** 最小可用快照：字段按 BootstrapSnapshot['models'] 元素所需。 */
const model = (over: Record<string, unknown>): never => ({ alias: 'deepseek-flash', apiProtocol: 'openai-completions', ...over }) as never
const snap = (models: readonly never[]): never => ({ models } as never)

describe('企业模型 provider 去重', () => {
  it('单模型且它是默认时，只产出一个 provider（视觉上不再出现两次）', () => {
    const got = buildEnterpriseProfiles(snap([model({ isDefault: true })]), 'http://proxy', 'Bearer x')
    expect(Object.keys(got)).toEqual(['enterprise'])
    // 按结构断言：该 provider 只有一个模型，且用的是**真实 alias**（不再改写成 enterprise/default）
    expect(got['enterprise']?.models).toHaveLength(1)
    expect(got['enterprise']?.models?.[0]).toMatchObject({ id: 'deepseek-flash' })
  })

  it('两个模型（其一为默认）时：协议组 1 个 + 默认入口 1 个，合计不重复', () => {
    const got = buildEnterpriseProfiles(snap([
      model({ alias: 'deepseek-flash', isDefault: true }),
      model({ alias: 'deepseek-v4-pro', isDefault: false }),
    ]), 'http://proxy', 'Bearer x')
    expect(Object.keys(got)).toEqual(['enterprise-openai-completions', 'enterprise'])
    // 默认模型只在稳定入口出现（id 被改写为 enterprise/default），协议组只剩另一个
    expect(JSON.stringify(got['enterprise'])).toContain('deepseek-flash')
    expect(got['enterprise-openai-completions']?.models).toHaveLength(1)
    expect(JSON.stringify(got['enterprise-openai-completions'])).toContain('deepseek-v4-pro')
    expect(JSON.stringify(got['enterprise-openai-completions'])).not.toContain('deepseek-flash')
  })

  it('没有默认模型时，协议组保留全部（不因去重丢模型）', () => {
    const got = buildEnterpriseProfiles(snap([model({ alias: 'a', isDefault: false })]), 'http://proxy', 'Bearer x')
    expect(Object.keys(got)).toEqual(['enterprise-openai-completions'])
    expect(JSON.stringify(got)).toContain('"a"')
  })
})
