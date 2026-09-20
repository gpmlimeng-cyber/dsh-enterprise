/**
 * [INPUT]: 依赖企业内置模型的纯行投影与列表工具
 * [OUTPUT]: 验证只读行字段映射、默认标记、上下文窗口缺省与空值降级
 * [POS]: 官方模型配置页内置区块的词汇门禁；DOM 与视觉由 Harness snapshot 覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, it } from 'vitest'
import { builtinModelRows } from '../src/builtin-models-section.js'
import type { EnterpriseBuiltinModel } from '../src/local-api.js'

function model(partial: Partial<EnterpriseBuiltinModel> = {}): EnterpriseBuiltinModel {
  return {
    alias: 'deepseek-flash',
    name: 'Flash',
    apiProtocol: 'openai-completions',
    isDefault: false,
    ...partial,
  }
}

describe('builtinModelRows', () => {
  it('maps every model to a read-only row with protocol and default flag', () => {
    const rows = builtinModelRows([
      model(),
      model({ alias: 'deepseek-plus', name: 'Plus', isDefault: true, contextWindow: 131_072 }),
    ])

    expect(rows).toEqual([
      { alias: 'deepseek-flash', label: 'Flash', protocol: 'openai-completions', isDefault: false, contextWindow: undefined },
      { alias: 'deepseek-plus', label: 'Plus', protocol: 'openai-completions', isDefault: true, contextWindow: 131_072 },
    ])
  })

  it('degrades an absent catalog to an empty list', () => {
    expect(builtinModelRows(undefined)).toEqual([])
    expect(builtinModelRows([])).toEqual([])
  })

  it('carries no edit affordance fields — rows are pure display facts', () => {
    const row = builtinModelRows([model()])[0]!
    expect(Object.keys(row).sort()).toEqual([
      'alias', 'contextWindow', 'isDefault', 'label', 'protocol',
    ])
  })
})
