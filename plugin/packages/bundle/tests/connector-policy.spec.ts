/**
 * [INPUT]: 依赖 vitest 与 `../src/connector/index.js`（求值器）与 tests/connector-support 夹具
 * [OUTPUT]: 锁定 L1/L2/L3 两轴判据（含"声明方不能自贴"、"宽严就近取严"）、平台三态（未声明平台 = 不支持）、决策函数的**逐步顺序**（平台 → 可见 → 允许 → L3 无策略 → 限额 → 同意 → L3 逐次确认 → 放行）、同意绑指纹（集合变化重确认）、限额缺席不等于有余量、行上三态与入参关闭键集
 * [POS]: 连接器纵深 P0-1「策略求值器」段门禁——断言的是**判定与稳定 reason**，不是文案（文案归 P0-5 界面）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  EnterpriseConnectorError,
  connectorCapabilityAvailability,
  connectorCapabilityFingerprint,
  connectorDecide,
  connectorEffectiveLevel,
  connectorPermissionLevel,
  connectorPlatformSupport,
  connectorStrictestLevel,
  readConnectorCapabilityDeclaration,
  readConnectorConsent,
  readConnectorPolicy,
  type ConnectorCapabilityDeclaration,
  type ConnectorDecisionFacts,
  type ConnectorPolicy,
} from '../src/connector/index.js'
import { declarationFixture, readDeclarationFixture } from './connector-support.js'

/** 已规范化声明 + 它自己的指纹 ⇒ 一条"同意过且声明没变"的记录。 */
function consentFor(declaration: ConnectorCapabilityDeclaration, overrides: Record<string, unknown> = {}) {
  return {
    capabilityId: declaration.capabilityId,
    fingerprint: connectorCapabilityFingerprint(declaration),
    ...overrides,
  }
}

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

describe('L1/L2/L3 判据：只依赖两轴与效果种类', () => {
  it('只读 + 可逆 ⇒ L1（多枚只读效果也算只读）', () => {
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['read'] }))).toBe('L1')
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['read', 'observe'] }))).toBe('L1')
  })

  it('不可逆 或 影响外部 ⇒ L3（任一轴命中即 L3）', () => {
    expect(connectorPermissionLevel(readDeclarationFixture({ reversibility: 'irreversible' }))).toBe('L3')
    expect(connectorPermissionLevel(readDeclarationFixture({ blastRadius: 'external' }))).toBe('L3')
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['read'], reversibility: 'irreversible' }))).toBe('L3')
  })

  it('★ 已登记的分叉①：只读 + 可逆 + external 判 L3（§3.3 的行序会判 L1 并默认放行，取严）', () => {
    expect(connectorPermissionLevel(readDeclarationFixture({
      effects: ['read', 'observe'],
      reversibility: 'reversible',
      blastRadius: 'external',
    }))).toBe('L3')
  })

  it('可逆/可补偿的写 ⇒ L2', () => {
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['write'] }))).toBe('L2')
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['read', 'send'], reversibility: 'compensable' }))).toBe('L2')
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['actuate'], blastRadius: 'org' }))).toBe('L2')
  })

  it('★ 已登记的 §3.2 表 / §3.3 伪代码分叉格：只读 + compensable 判 L2（取严、不留"无层级"）', () => {
    expect(connectorPermissionLevel(readDeclarationFixture({ effects: ['read'], reversibility: 'compensable' }))).toBe('L2')
  })

  it('宽严就近取严：上限只能收紧，不能放宽声明算出的层级', () => {
    expect(connectorStrictestLevel('L1', 'L2')).toBe('L2')
    expect(connectorStrictestLevel('L3', 'L1')).toBe('L3')
    const l3 = readDeclarationFixture({ reversibility: 'irreversible' })
    // 上限写 L1 也压不住 L3（声明侧更严）—— 否则管理员就成了"替声明方降级"的人。
    expect(connectorEffectiveLevel(l3, readConnectorPolicy({ visible: true, allowed: true, ceiling: 'L1' }))).toBe('L3')
    const l1 = readDeclarationFixture()
    expect(connectorEffectiveLevel(l1, readConnectorPolicy({ visible: true, allowed: true, ceiling: 'L3' }))).toBe('L3')
    expect(connectorEffectiveLevel(l1)).toBe('L1')
  })
})

describe('平台三态：未声明的平台一律「不支持」', () => {
  it('声明里列了就按它，没列就是 unsupported', () => {
    const declaration = readDeclarationFixture()
    expect(connectorPlatformSupport(declaration, 'android')).toBe('supported')
    expect(connectorPlatformSupport(declaration, 'linux')).toBe('supported')
    expect(connectorPlatformSupport(declaration, 'win32')).toBe('unsupported')
  })

  it('needs-confirm 原样透出（不是被折成 supported）', () => {
    const declaration = readDeclarationFixture({
      platformRequired: [{ platform: 'android', support: 'needs-confirm' }],
    })
    expect(connectorPlatformSupport(declaration, 'android')).toBe('needs-confirm')
  })
})

describe('决策函数：逐步顺序', () => {
  const l1 = readDeclarationFixture({ quota: undefined })
  const l2 = readDeclarationFixture({ effects: ['write'], quota: undefined })
  const l3 = readDeclarationFixture({ reversibility: 'irreversible', quota: undefined })
  const noQuotaFacts = (extra: Partial<ConnectorDecisionFacts> = {}): ConnectorDecisionFacts =>
    ({ platform: 'android', ...extra })

  it('第一步：平台不支持 ⇒ 拒（哪怕策略、同意、限额都齐）', () => {
    const decision = connectorDecide(l1, noQuotaFacts({
      platform: 'win32',
      policy: { visible: true, allowed: true },
      consent: consentFor(l1),
    }))
    expect(decision).toMatchObject({ kind: 'deny', reason: 'unsupported-on-platform' })
  })

  it('第二步 / 第三步：不可见 ⇒ not-in-scope；可见但不许 ⇒ policy-blocked', () => {
    expect(connectorDecide(l1, noQuotaFacts({ policy: { visible: false, allowed: true } })))
      .toMatchObject({ kind: 'deny', reason: 'not-in-scope' })
    expect(connectorDecide(l1, noQuotaFacts({ policy: { visible: true, allowed: false } })))
      .toMatchObject({ kind: 'deny', reason: 'policy-blocked' })
  })

  it('第三步半：L3 且没有策略 ⇒ 拒（"无策略时一律不可用"，且排在同意之前）', () => {
    const decision = connectorDecide(l3, noQuotaFacts({ consent: consentFor(l3) }))
    expect(decision).toMatchObject({ kind: 'deny', reason: 'no-policy-for-l3' })
  })

  it('L1：默认放行（仍带审计事件；没声明就是空表，不替它编）', () => {
    expect(connectorDecide(l1, noQuotaFacts())).toEqual({
      kind: 'allow', capabilityId: 'ent-demo-read', level: 'L1', auditEvents: ['CONNECTOR_CALL'],
    })
    const silent = readDeclarationFixture({ auditEvents: undefined, quota: undefined })
    expect(connectorDecide(silent, noQuotaFacts())).toMatchObject({ kind: 'allow', auditEvents: [] })
  })

  it('L2：先要一次同意；同意绑的指纹对上了才放行', () => {
    expect(connectorDecide(l2, noQuotaFacts())).toMatchObject({ kind: 'consent-required', reason: 'first-consent' })
    expect(connectorDecide(l2, noQuotaFacts({ consent: consentFor(l2) })))
      .toMatchObject({ kind: 'allow', level: 'L2' })
  })

  it('L2：声明变了 ⇒ scope-changed（同意绑的是指纹，不是 id）', () => {
    const granted = consentFor(l2)
    const changed = readDeclarationFixture({ effects: ['write', 'send'], quota: undefined })
    expect(connectorDecide(changed, noQuotaFacts({ consent: granted })))
      .toMatchObject({ kind: 'consent-required', reason: 'scope-changed' })
  })

  it('L2：同意记录是另一条能力的 ⇒ 当没同意过（不认"别人同意过"）', () => {
    expect(connectorDecide(l2, noQuotaFacts({
      consent: { capabilityId: 'ent-other', fingerprint: connectorCapabilityFingerprint(l2) },
    }))).toMatchObject({ kind: 'consent-required', reason: 'first-consent' })
  })

  it('L3：有策略但没锁死 ⇒ 每次调用都要确认（纪律 1）', () => {
    expect(connectorDecide(l3, noQuotaFacts({
      policy: { visible: true, allowed: true },
      consent: consentFor(l3),
    }))).toMatchObject({ kind: 'consent-per-call-required', level: 'L3' })
  })

  it('L3：管理员锁死后免逐次确认，但员工侧那次首次同意仍然要（本方案未定、取严的一侧）', () => {
    const locked: ConnectorPolicy = { visible: true, allowed: true, preAuthorized: true }
    expect(connectorDecide(l3, noQuotaFacts({ policy: locked })))
      .toMatchObject({ kind: 'consent-required', reason: 'first-consent' })
    expect(connectorDecide(l3, noQuotaFacts({ policy: locked, consent: consentFor(l3) })))
      .toMatchObject({ kind: 'allow', level: 'L3' })
  })

  it('本平台 needs-confirm ⇒ 连 L1 也要一次同意，理由单独给', () => {
    const gated = readDeclarationFixture({
      platformRequired: [{ platform: 'android', support: 'needs-confirm' }],
      quota: undefined,
    })
    expect(connectorDecide(gated, noQuotaFacts()))
      .toMatchObject({ kind: 'consent-required', reason: 'platform-needs-confirm' })
    expect(connectorDecide(gated, noQuotaFacts({ consent: consentFor(gated) })))
      .toMatchObject({ kind: 'allow' })
  })
})

describe('决策函数：限额', () => {
  const withQuota = readDeclarationFixture({ effects: ['read'], quota: { maxCalls: 10, windowSeconds: 60 } })
  const facts = (extra: Partial<ConnectorDecisionFacts> = {}): ConnectorDecisionFacts =>
    ({ platform: 'android', ...extra })

  it('声明了限额但现场没给事实 ⇒ 拒 quota-unknown（缺席不等于"还有余量"）', () => {
    expect(connectorDecide(withQuota, facts())).toMatchObject({ kind: 'deny', reason: 'quota-unknown' })
  })

  it('事实说没了 ⇒ quota-exceeded；事实说还有 ⇒ 放行', () => {
    expect(connectorDecide(withQuota, facts({ quotaAvailable: false })))
      .toMatchObject({ kind: 'deny', reason: 'quota-exceeded' })
    expect(connectorDecide(withQuota, facts({ quotaAvailable: true }))).toMatchObject({ kind: 'allow' })
  })

  it('声明里没有限额 ⇒ 限额事实给不给都不影响', () => {
    const free = readDeclarationFixture({ quota: undefined })
    expect(connectorDecide(free, facts())).toMatchObject({ kind: 'allow' })
    expect(connectorDecide(free, facts({ quotaAvailable: false }))).toMatchObject({ kind: 'allow' })
  })
})

describe('行上三态（P0-5 的「可用 / 需确认 / 不支持」）', () => {
  it('L1 + 平台 supported ⇒ ready', () => {
    expect(connectorCapabilityAvailability(readDeclarationFixture(), { platform: 'android' })).toBe('ready')
  })

  it('非 L1 或 平台 needs-confirm ⇒ needs-confirm', () => {
    expect(connectorCapabilityAvailability(readDeclarationFixture({ effects: ['write'] }), { platform: 'android' }))
      .toBe('needs-confirm')
    const gated = readDeclarationFixture({ platformRequired: [{ platform: 'android', support: 'needs-confirm' }] })
    expect(connectorCapabilityAvailability(gated, { platform: 'android' })).toBe('needs-confirm')
  })

  it('平台未声明 ⇒ unsupported；L3 无策略 ⇒ unsupported（不是"需确认"）', () => {
    expect(connectorCapabilityAvailability(readDeclarationFixture(), { platform: 'win32' })).toBe('unsupported')
    const l3 = readDeclarationFixture({ reversibility: 'irreversible' })
    expect(connectorCapabilityAvailability(l3, { platform: 'android' })).toBe('unsupported')
    expect(connectorCapabilityAvailability(l3, {
      platform: 'android',
      policy: readConnectorPolicy({ visible: true, allowed: true, preAuthorized: true }),
    })).toBe('needs-confirm')
  })
})

describe('入参关闭键集', () => {
  it('策略多一个键就拒（不许"以为读进去了"）', () => {
    const malformed = { visible: true, allowed: true, preauthorized: true }
    expectCode(() => readConnectorPolicy(malformed), 'ENT_INVALID_REQUEST')
    expectCode(() => readConnectorPolicy({ visible: 'true', allowed: true }), 'ENT_INVALID_REQUEST')
    expectCode(() => readConnectorPolicy({ visible: true, allowed: true, ceiling: 'L4' }), 'ENT_INVALID_REQUEST')
    expect(readConnectorPolicy({ visible: true, allowed: true }).allowed).toBe(true)
  })

  it('同意记录必须是两条非空串', () => {
    expectCode(() => readConnectorConsent({ capabilityId: 'a' }), 'ENT_INVALID_REQUEST')
    expectCode(() => readConnectorConsent({ capabilityId: 'a', fingerprint: '' }), 'ENT_INVALID_REQUEST')
    expectCode(() => readConnectorConsent({ capabilityId: 'a', fingerprint: 'f', extra: 1 }), 'ENT_INVALID_REQUEST')
    expect(readConnectorConsent({ capabilityId: 'a', fingerprint: 'f' })).toEqual({ capabilityId: 'a', fingerprint: 'f' })
  })

  it('决策函数本身也会校验传进来的策略/同意（坏对象不许被当成真值）', () => {
    const declaration = readDeclarationFixture({ quota: undefined })
    expectCode(() => connectorDecide(declaration, {
      platform: 'android',
      policy: { visible: true, allowed: true, oops: 1 } as unknown as ConnectorPolicy,
    }), 'ENT_INVALID_REQUEST')
    expectCode(() => connectorDecide(declaration, {
      platform: 'android',
      consent: { capabilityId: 'x' } as unknown as ReturnType<typeof readConnectorConsent>,
    }), 'ENT_INVALID_REQUEST')
    // 行上三态走的是同一把尺：拼错的 `ceiling` 不许被静默忽略。
    expectCode(() => connectorCapabilityAvailability(declaration, {
      platform: 'android',
      policy: { visible: true, allowed: true, ceiling: 'L2' , oops: 1 } as unknown as ConnectorPolicy,
    }), 'ENT_INVALID_REQUEST')
  })

  it('声明里的 platformRequired 支持度是封闭枚举（拼错的取值不会静默当成 supported）', () => {
    expectCode(() => readConnectorCapabilityDeclaration(declarationFixture({
      platformRequired: [{ platform: 'android', support: 'yes' }],
    })), 'ENT_CONNECTOR_DECLARATION_INVALID')
  })
  /**
   * 穷举合规审计（把方案 §3.2 的三行谓词与 §3.3 的伪代码都当**可执行判据**来比）：
   * `effects` 非空子集(31) × `reversibility`(3) × `blastRadius`(3) = **279 格**。
   *
   * ★ 这三枚计数（270 / 3 / 6，和恰为 279）是**断言的一部分**：它们同时钉住"方案哪里判得出来、哪里自己歧义/未覆盖"。
   * 方案一旦回写修好那 9 格，这个测试就会红 —— 那时应当同步改这里与 `policy.ts` 头部的审计段。
   */
  it('穷举 279 格：表唯一命中的每一格都与实现一致，歧义格取严、未覆盖格取 L2', () => {
    const EFFECTS = ['read', 'observe', 'write', 'send', 'actuate'] as const
    const REVERSIBILITIES = ['reversible', 'compensable', 'irreversible'] as const
    const BLAST_RADII = ['self', 'org', 'external'] as const
    const readOnly = (effects: readonly string[]): boolean =>
      effects.every(effect => effect === 'read' || effect === 'observe')
    const hasWrite = (effects: readonly string[]): boolean =>
      effects.some(effect => effect === 'write' || effect === 'send' || effect === 'actuate')

    const subsets: string[][] = []
    for (let mask = 1; mask < (1 << EFFECTS.length); mask += 1) {
      subsets.push(EFFECTS.filter((_, index) => (mask & (1 << index)) !== 0))
    }

    let determinate = 0
    let ambiguous = 0
    let uncovered = 0
    for (const effects of subsets) {
      for (const reversibility of REVERSIBILITIES) {
        for (const blastRadius of BLAST_RADII) {
          // §3.2 表的三行谓词逐字搬进来（表没写优先级，故可能多行命中、也可能一行都不命中）。
          const rows = [
            ...(readOnly(effects) && reversibility === 'reversible' ? ['L1'] : []),
            ...(hasWrite(effects)
              && (reversibility === 'reversible' || reversibility === 'compensable')
              && (blastRadius === 'self' || blastRadius === 'org') ? ['L2'] : []),
            ...(reversibility === 'irreversible' || blastRadius === 'external' ? ['L3'] : []),
          ]
          const actual = connectorPermissionLevel(readDeclarationFixture({ effects, reversibility, blastRadius }))
          const label = `effects={${effects.join(',')}} rev=${reversibility} blast=${blastRadius}`
          if (rows.length === 0) {
            uncovered += 1
            expect(actual, `${label}（表未覆盖 ⇒ 取 L2）`).toBe('L2')
          } else if (rows.length > 1) {
            ambiguous += 1
            expect(actual, `${label}（表歧义 ${rows.join('+')} ⇒ 取严 L3）`).toBe('L3')
          } else {
            determinate += 1
            expect(actual, `${label}（表唯一命中 ${rows[0]}）`).toBe(rows[0])
          }
        }
      }
    }
    expect({ determinate, ambiguous, uncovered }).toEqual({ determinate: 270, ambiguous: 3, uncovered: 6 })
  })
  /**
   * 决策函数的**支配性穷举**（1200 格）：不去"翻译"方案伪代码，而是断言**前一步挡住的格子里，
   * 后面的步骤一个都不许翻盘** —— 这就是"逐步顺序"的可断言形式，且不依赖我对 §3.3 的解读。
   *
   * 空格：5 种声明（L1 / L2写 / L2 compensable / L3 不可逆 / L3 外部只读）× 2 平台（支持的 / 未声明的）
   * × 5 策略（无 / 不可见 / 不允许 / 允许 / 预授权）× 有无限额 × 3 限额事实 × 4 同意（无 / 有效 / 过期 / 他能力）
   * = 1200。
   */
  it('决策函数支配性穷举：被前一步挡住的格子，后面的步骤不许翻盘', () => {
    const overrides = [
      { effects: ['read'], reversibility: 'reversible', blastRadius: 'self' },
      { effects: ['write'], reversibility: 'reversible', blastRadius: 'self' },
      { effects: ['read'], reversibility: 'compensable', blastRadius: 'self' },
      { effects: ['write'], reversibility: 'irreversible', blastRadius: 'self' },
      { effects: ['read'], reversibility: 'reversible', blastRadius: 'external' },
    ]
    let total = 0
    let unsupported = 0
    for (const override of overrides) {
      for (const platform of ['android', 'win32']) {
        for (const policy of ['none', 'hidden', 'blocked', 'ok', 'preAuthorized']) {
          for (const withQuota of [false, true]) {
            for (const quotaFact of [undefined, false, true]) {
              for (const consent of ['none', 'good', 'stale', 'other']) {
                total += 1
                // ★ 夹具**自带** quota，故"无限额"那一档必须显式置 undefined（读取器把 undefined 当缺省）。
                const declaration = readDeclarationFixture({
                  ...override,
                  quota: withQuota ? { maxCalls: 10, windowSeconds: 60 } : undefined,
                })
                // 上限固定 L1：`connectorEffectiveLevel` 取"声明 vs 上限"的更严者，L1 不改变声明层级的判定，
                // 于是这一条审计只看**决策顺序**（上限语义另有专门用例）。
                const facts: ConnectorDecisionFacts = {
                  platform,
                  ...(policy === 'none' ? {} : {
                    policy: {
                      ceiling: 'L1',
                      visible: policy !== 'hidden',
                      allowed: policy !== 'blocked',
                      ...(policy === 'preAuthorized' ? { preAuthorized: true } : {}),
                    },
                  }),
                  ...(withQuota ? { quotaAvailable: quotaFact } : {}),
                  ...(consent === 'none' ? {} : {
                    consent: {
                      capabilityId: consent === 'other' ? 'ent-other' : declaration.capabilityId,
                      fingerprint: consent === 'stale'
                        ? 'f'.repeat(64)
                        : connectorCapabilityFingerprint(declaration),
                    },
                  }),
                }
                const decision = connectorDecide(declaration, facts)
                const level = connectorPermissionLevel(declaration)
                // 第 1 步：平台不支持 ⇒ 永远只有这一种结局（后面全都不许翻盘）。
                if (platform === 'win32') {
                  unsupported += 1
                  expect(decision, `${platform}/${policy}`).toMatchObject({ kind: 'deny', reason: 'unsupported-on-platform' })
                  continue
                }
                // 第 2/3 步：不可见 / 不允许 各自独占。
                if (policy === 'hidden') {
                  expect(decision).toMatchObject({ kind: 'deny', reason: 'not-in-scope' })
                  continue
                }
                if (policy === 'blocked') {
                  expect(decision).toMatchObject({ kind: 'deny', reason: 'policy-blocked' })
                  continue
                }
                // 第 4 步：L3 且无策略 ⇒ 一律不可用（排在限额与同意之前）。
                if (level === 'L3' && policy === 'none') {
                  expect(decision).toMatchObject({ kind: 'deny', reason: 'no-policy-for-l3' })
                  continue
                }
                // 第 5 步：限额（声明了限额而现场没给事实 ⇒ quota-unknown；给了 false ⇒ quota-exceeded）。
                if (withQuota && quotaFact === undefined) {
                  expect(decision).toMatchObject({ kind: 'deny', reason: 'quota-unknown' })
                  continue
                }
                if (withQuota && quotaFact === false) {
                  expect(decision).toMatchObject({ kind: 'deny', reason: 'quota-exceeded' })
                  continue
                }
                // 第 6 步：同意（L1 在支持平台上免同意 = §3.2 L1 的"可默认放行"）。
                if (level !== 'L1') {
                  if (consent === 'none' || consent === 'other') {
                    expect(decision).toMatchObject({ kind: 'consent-required', reason: 'first-consent' })
                    continue
                  }
                  if (consent === 'stale') {
                    expect(decision).toMatchObject({ kind: 'consent-required', reason: 'scope-changed' })
                    continue
                  }
                }
                // 第 7 步：L3 逐次确认（唯一豁免 = 策略预授权）。
                if (level === 'L3' && policy !== 'preAuthorized') {
                  expect(decision).toMatchObject({ kind: 'consent-per-call-required' })
                  continue
                }
                // 第 8 步：放行。
                expect(decision, `${override.effects.join('+')}/${String(override.reversibility)}/${String(override.blastRadius)} | ${platform}/${policy}/quota=${String(withQuota)}:${String(quotaFact)}/${consent} | level=${level} | got=${JSON.stringify(decision)}`).toMatchObject({ kind: 'allow' })
              }
            }
          }
        }
      }
    }
    expect(total).toBe(1200)
    expect(unsupported).toBe(600)
  })
})
