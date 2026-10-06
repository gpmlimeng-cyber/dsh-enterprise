/**
 * [INPUT]: 依赖 vitest 与 `../src/connector/index.js`（模型 + 注册表）与 tests/connector-support 夹具
 * [OUTPUT]: 锁定能力声明的字段模型（最少必填集逐字段、取值域、集合的非空与不重复、未知键、**自贴权限等级被拒**）、规范化（顺序无关的指纹）与注册表（唯一性/查表/冻结）
 * [POS]: 连接器纵深 P0-1「模型 + 注册表」段门禁——断言的是**形状与失败码**，不是"看起来对"
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  EnterpriseConnectorError,
  CONNECTOR_REQUIRED_DECLARATION_FIELDS,
  connectorCapabilityFingerprint,
  connectorInboundKind,
  createConnectorCapabilityRegistry,
  readConnectorCapabilityDeclaration,
} from '../src/connector/index.js'
import { declarationFixture } from './connector-support.js'

/** 断言抛的是**本族**的某个 code（不关心 message 文案）。 */
function expectCode(run: () => unknown, code: string): void {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(EnterpriseConnectorError)
    expect((error as EnterpriseConnectorError).code).toBe(code)
    return
  }
  throw new Error(`expected ${code} to be thrown`)
}

describe('能力声明：最小合法形状', () => {
  it('夹具本身合法，且缺省的 inbound 归成「不支持入站」', () => {
    const withoutInbound = declarationFixture()
    delete withoutInbound['inbound']
    const declaration = readConnectorCapabilityDeclaration(withoutInbound)
    expect(declaration.capabilityId).toBe('ent-demo-read')
    expect(connectorInboundKind(declaration)).toBe('none')
    expect(declaration.inbound).toBeUndefined()
  })

  it('集合字段按字典序归一，且缺省的可选键不产出该键', () => {
    const declaration = readConnectorCapabilityDeclaration(declarationFixture({
      effects: ['observe', 'read'],
      auditEvents: ['CONNECTOR_CALL', 'CONNECTOR_READ'],
      platformRequired: [
        { platform: 'linux', support: 'supported' },
        { platform: 'android', support: 'supported' },
      ],
      summary: undefined,
      authRef: undefined,
      egressAllowlist: undefined,
      quota: undefined,
      inbound: undefined,
    }))
    expect(declaration.effects).toEqual(['observe', 'read'])
    expect(declaration.auditEvents).toEqual(['CONNECTOR_CALL', 'CONNECTOR_READ'])
    expect(declaration.platformRequired.map(row => row.platform)).toEqual(['android', 'linux'])
    expect('summary' in declaration).toBe(false)
    expect('authRef' in declaration).toBe(false)
    expect('egressAllowlist' in declaration).toBe(false)
    expect('quota' in declaration).toBe(false)
    expect('inbound' in declaration).toBe(false)
  })

  it('九枚必填字段逐一缺席都被拒（不是只测一个）', () => {
    for (const field of CONNECTOR_REQUIRED_DECLARATION_FIELDS) {
      const broken = declarationFixture()
      delete broken[field]
      expectCode(() => readConnectorCapabilityDeclaration(broken), 'ENT_CONNECTOR_DECLARATION_INVALID')
    }
  })

  it('非对象入参一律拒', () => {
    for (const value of [null, undefined, 42, 'x', [], true]) {
      expectCode(() => readConnectorCapabilityDeclaration(value), 'ENT_CONNECTOR_DECLARATION_INVALID')
    }
  })
})

describe('能力声明：效果集合（空集 = 自动放行，故必须拒）', () => {
  it('空集被拒', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ effects: [] })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
  })

  it('重复项被拒（不静默折叠）', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ effects: ['read', 'read'] })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
  })

  it('未知效果被拒', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ effects: ['read', 'delete'] })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
  })
})

describe('能力声明：自贴权限等级一律拒（§3.2 纪律 2）', () => {
  it('level / permissionLevel / tier 三种写法都抛专属码', () => {
    for (const key of ['level', 'permissionLevel', 'tier', 'permission']) {
      expectCode(
        () => readConnectorCapabilityDeclaration(declarationFixture({ [key]: 'L1' })),
        'ENT_CONNECTOR_LEVEL_DECLARED',
      )
    }
  })

  it('其它未知键抛的是形状码，不是等级码', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ danger: true })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
  })
})

describe('能力声明：取值域与边界', () => {
  it('capabilityId 必须是小写连字符形状', () => {
    for (const id of ['Ent-Demo', 'ent_demo', '-ent', 'ent-', '', 'a'.repeat(65)]) {
      expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ capabilityId: id })),
        'ENT_CONNECTOR_DECLARATION_INVALID')
    }
  })

  it('stateAddress 只认两种键、且路径非空', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ stateAddress: {} })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({
      stateAddress: { kind: 'resource', path: 'documents/readme', extra: 1 },
    })), 'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({
      stateAddress: { kind: 'file', path: 'x' },
    })), 'ENT_CONNECTOR_DECLARATION_INVALID')
    expect(readConnectorCapabilityDeclaration(declarationFixture()).stateAddress)
      .toEqual({ kind: 'resource', path: 'documents/readme' })
  })

  it('authRef 只收官方 POSIX 标识符形状 —— 「Bearer sk-…」与带 `-`/`.` 的都写不进来', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ authRef: 'Bearer sk-live-123' })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    // ★ 2026-10-06（第十八刀）收紧：官方 ref 语法是 `^[A-Za-z_][A-Za-z0-9_]*$`（`dsh-credentials/lib/index.js:13`），
    // 不含 `-`/`.` —— 旧实现允许它们，而键名会被我们写成 `!!js process.env.<键名>`，带 `-` 会被 JS 算成**减法**。
    for (const bad of ['ENT_DEMO.TOKEN-1', 'ENT-DEMO', 'ent.demo', 'sk-literal-1234']) {
      expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ authRef: bad })),
        'ENT_CONNECTOR_DECLARATION_INVALID')
    }
    expect(readConnectorCapabilityDeclaration(declarationFixture({ authRef: 'ENT_DEMO_TOKEN' })).authRef)
      .toBe('ENT_DEMO_TOKEN')
  })

  it('egressAllowlist 拒通配、拒大写、拒带 scheme 或路径、拒重复', () => {
    for (const list of [['*'], ['*.example.com'], ['Example.com'], ['https://example.com'], ['example.com/x'],
      ['user@example.com'], ['example.com', 'example.com'], []]) {
      expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ egressAllowlist: list })),
        'ENT_CONNECTOR_DECLARATION_INVALID')
    }
    expect(readConnectorCapabilityDeclaration(declarationFixture({
      egressAllowlist: ['B.example.com'.toLowerCase(), 'a.example.com'],
    })).egressAllowlist).toEqual(['a.example.com', 'b.example.com'])
  })

  it('quota 至少要约束一项，且每项是正整数', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ quota: {} })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ quota: { maxCalls: 0 } })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ quota: { maxCalls: -1 } })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ quota: { maxCalls: 1.5 } })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ quota: { calls: 1 } })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expect(readConnectorCapabilityDeclaration(declarationFixture({ quota: { maxBytes: 1024 } })).quota)
      .toEqual({ maxBytes: 1024 })
  })

  it('auditEvents 只收 SCREAMING_SNAKE；platformRequired 不许空、不许重复平台、不许未知平台', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ auditEvents: ['read'] })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ platformRequired: [] })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({
      platformRequired: [{ platform: 'android', support: 'supported' }, { platform: 'android', support: 'supported' }],
    })), 'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({
      platformRequired: [{ platform: 'ios', support: 'supported' }],
    })), 'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({
      platformRequired: [{ platform: 'android', support: 'maybe' }],
    })), 'ENT_CONNECTOR_DECLARATION_INVALID')
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({ discovery: [] })),
      'ENT_CONNECTOR_DECLARATION_INVALID')
  })
})

describe('指纹', () => {
  it('同一条声明的等价书写（集合顺序不同）给出同一枚指纹', () => {
    const left = readConnectorCapabilityDeclaration(declarationFixture({
      effects: ['read', 'observe'],
      discovery: ['catalog', 'manual'],
      platformRequired: [{ platform: 'linux', support: 'supported' }, { platform: 'android', support: 'supported' }],
    }))
    const right = readConnectorCapabilityDeclaration(declarationFixture({
      effects: ['observe', 'read'],
      discovery: ['manual', 'catalog'],
      platformRequired: [{ platform: 'android', support: 'supported' }, { platform: 'linux', support: 'supported' }],
    }))
    expect(connectorCapabilityFingerprint(left)).toBe(connectorCapabilityFingerprint(right))
    expect(connectorCapabilityFingerprint(left)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('任何一处事实变化都会改指纹（否则"集合变化重确认"就是空话）', () => {
    const base = readConnectorCapabilityDeclaration(declarationFixture())
    const cases: Record<string, unknown>[] = [
      { effects: ['read', 'observe'] },
      { reversibility: 'compensable' },
      { blastRadius: 'org' },
      { authRef: 'ENT_OTHER_TOKEN' },
      { quota: { maxCalls: 101, windowSeconds: 3600 } },
      { auditEvents: ['CONNECTOR_CALL', 'CONNECTOR_WRITE'] },
      { stateAddress: { kind: 'field', path: 'documents/readme' } },
      { platformRequired: [{ platform: 'android', support: 'supported' }] },
    ]
    for (const override of cases) {
      const other = readConnectorCapabilityDeclaration(declarationFixture(override))
      expect(connectorCapabilityFingerprint(other)).not.toBe(connectorCapabilityFingerprint(base))
    }
  })
})

describe('注册表', () => {
  it('建档、列举、查表；未知 id 返回 undefined（不抛）', () => {
    const registry = createConnectorCapabilityRegistry([
      declarationFixture(),
      declarationFixture({ capabilityId: 'ent-demo-write', effects: ['write'] }),
    ])
    expect(registry.size).toBe(2)
    expect(registry.capabilityIds).toEqual(['ent-demo-read', 'ent-demo-write'])
    expect(registry.list()).toHaveLength(2)
    expect(registry.get('ent-demo-write')?.effects).toEqual(['write'])
    expect(registry.get('nope')).toBeUndefined()
  })

  it('重复 capabilityId 抛专属码，而不是后者覆盖前者', () => {
    expectCode(() => createConnectorCapabilityRegistry([declarationFixture(), declarationFixture()]),
      'ENT_CONNECTOR_ID_DUPLICATE')
  })

  it('非数组入参抛 ENT_INVALID_REQUEST；成员形状错照样当场抛', () => {
    expectCode(() => createConnectorCapabilityRegistry(null as unknown as readonly unknown[]), 'ENT_INVALID_REQUEST')
    expectCode(() => createConnectorCapabilityRegistry([declarationFixture({ title: '' })]),
      'ENT_CONNECTOR_DECLARATION_INVALID')
  })

  it('登记后不可变（拿到手的声明与表都不许被改）', () => {
    const registry = createConnectorCapabilityRegistry([declarationFixture()])
    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.list())).toBe(true)
    expect(Object.isFrozen(registry.list()[0])).toBe(true)
    expect(Object.isFrozen(registry.get('ent-demo-read')?.effects)).toBe(true)
  })
  /**
   * **读取器变异审计**（fail-closed 边界）：对声明的 15 个字段逐个塞 16 种畸形值（含 null/0/-1/1.5/NaN/空串/
   * 空白串/真值/假值/空数组/含 null 数组/空对象/带杂键对象/超长串），再把每个字段**整键删除**，共 15×17 = 255 格。
   *
   * 断言的是**被接受的集合恰好等于**下面这 12 格 —— 双向锁死：
   * · 将来若开始接受某个畸形值 ⇒ 集合多一格 ⇒ 红（这是安全方向）；
   * · 将来若开始拒绝某个"合法的自由文本/可缺省键被删" ⇒ 集合少一格 ⇒ 也红（说明严过头了）。
   *
   * 12 格全是合法情形：`title`/`summary` 是自由文本（`x`、`Has Space` 都合规）、`capabilityId` 单字符是合法 kebab、
   * `authRef` 是可选键名、`egressAllowlist`/`quota`/`inbound`/`auditEvents` 四个可选键被删都合规。
   * ⇒ **必需字段上一个畸形值都不接受**（含 `effects` 空集、`platformRequired`/`discovery` 空集、`stateAddress` 空对象）。
   */
  it('变异审计：255 格里被接受的恰是那 12 个合法情形', () => {
    const BAD: readonly [string, unknown][] = [
      ['null', null], ['zero', 0], ['neg', -1], ['float', 1.5], ['NaN', Number.NaN],
      ['emptyStr', ''], ['blankStr', ' '], ['plainStr', 'x'], ['upperSpace', 'Has Space'],
      ['true', true], ['false', false], ['emptyArr', []], ['arrWithNull', [null]],
      ['obj', {}], ['objWithJunk', { a: 1 }], ['longStr', 'a'.repeat(5000)],
    ]
    const accepted: string[] = []
    for (const key of Object.keys(declarationFixture())) {
      for (const [label, bad] of BAD) {
        try {
          readConnectorCapabilityDeclaration({ ...declarationFixture(), [key]: bad })
          accepted.push(`${key} <- ${label}`)
        } catch {
          // 拒了才是预期
        }
      }
      const without = { ...declarationFixture() }
      delete (without as Record<string, unknown>)[key]
      try {
        readConnectorCapabilityDeclaration(without)
        accepted.push(`${key} <- (deleted)`)
      } catch {
        // 拒了才是预期
      }
    }
    expect(accepted.sort()).toEqual([
      'auditEvents <- (deleted)',
      'authRef <- (deleted)',
      'authRef <- plainStr',
      'capabilityId <- plainStr',
      'egressAllowlist <- (deleted)',
      'inbound <- (deleted)',
      'quota <- (deleted)',
      'summary <- (deleted)',
      'summary <- plainStr',
      'summary <- upperSpace',
      'title <- plainStr',
      'title <- upperSpace',
    ])
  })
})
