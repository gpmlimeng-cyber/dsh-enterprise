/**
 * [INPUT]: 依赖 node:fs 读取仓库契约真源（contracts/plugin-core-packages.json、generated/enterprise-openapi.json、protocol-sha256.txt）
 * [OUTPUT]: 契约漂移门禁：错误码集合、核心包名单与协议哈希必须与中心真源一致；真源缺失时明确 skip 而非静默通过
 * [POS]: 移植件与契约真源之间的唯一桥梁；这是"原生移植"不会随时间悄悄跑偏的保证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { ENTERPRISE_ERROR_CODES } from '../src/protocol/error-codes.js'
import { ENTERPRISE_CORE_PACKAGES } from '../src/market/core-packages.js'

/**
 * 向上搜索仓库契约真源：本文件在 monorepo 里的深度会随落点变化
 * （staging 是 apps/desktop/packages/<pkg>，发布位置是 plugin/packages/<pkg>），
 * 固定相对层级必然写死一个位置，因此按"是否含契约真源"搜索。
 * 发布包内不存在该目录，相关断言会 skip 而不是误报通过。
 */
function findContractsRoot(): string | null {
  let current = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, 'contracts')
    if (existsSync(join(candidate, 'generated', 'enterprise-openapi.json'))) {
      return candidate
    }
    const parent = resolve(current, '..')
    if (parent === current) return null
    current = parent
  }
  return null
}

/** 仓库契约真源根目录（发布包内为 null，此时相关断言跳过）。 */
const CONTRACTS_ROOT = findContractsRoot()

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

const hasContracts = CONTRACTS_ROOT !== null

describe('契约漂移门禁', () => {
  it.skipIf(!hasContracts)('46 个稳定错误码与 OpenAPI 枚举逐字同序', () => {
    const spec = readJson(join(CONTRACTS_ROOT ?? '', 'generated/enterprise-openapi.json')) as {
      components: { schemas: { EnterpriseErrorCode: { enum: string[] } } }
    }
    const truth = spec.components.schemas.EnterpriseErrorCode.enum
    expect(truth).toHaveLength(46)
    // 顺序也断言：生成脚本是机械复制，重新排序即说明有人手改了生成物
    expect([...ENTERPRISE_ERROR_CODES]).toEqual(truth)
  })

  it.skipIf(!hasContracts)('核心包保护名单以契约真源 6 项同序开头', () => {
    const truth = readJson(join(CONTRACTS_ROOT ?? '', 'plugin-core-packages.json')) as {
      packages: string[]
    }
    expect(truth.packages).toHaveLength(6)
    expect(ENTERPRISE_CORE_PACKAGES.slice(0, truth.packages.length)).toEqual(truth.packages)
    // 追加项只允许是客户端自保护，必须是本插件自身
    expect(ENTERPRISE_CORE_PACKAGES).toContain('dshent-client-plugin')
  })

  it.skipIf(!hasContracts)('协议哈希真源存在且形态正确（用于人工比对发布物）', () => {
    const raw = readFileSync(
      join(CONTRACTS_ROOT ?? '', 'generated/protocol-sha256.txt'),
      'utf8',
    ).trim()
    expect(raw).toMatch(/^[0-9a-f]{64}\b/)
  })

  it('测试内的 core-packages fixture 与运行时名单自洽', () => {
    const fixture = readJson(
      fileURLToPath(new URL('./fixtures/plugin-core-packages.json', import.meta.url)),
    ) as { packages: string[] }
    expect(ENTERPRISE_CORE_PACKAGES.slice(0, fixture.packages.length)).toEqual(fixture.packages)
  })
})
