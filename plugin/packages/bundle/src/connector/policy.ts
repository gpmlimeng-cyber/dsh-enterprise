/**
 * [INPUT]: 只依赖 ./capability.js 的声明类型与 ./errors.js；纯函数，无 I/O、无 `@deepseek-ai/*`
 * [OUTPUT]: 对外提供 L1/L2/L3 判据 `connectorPermissionLevel`、宽严取严 `connectorStrictestLevel`、上限折算 `connectorEffectiveLevel`、平台支持 `connectorPlatformSupport`、行上三态 `connectorCapabilityAvailability` 与决策函数 `connectorDecide`（+ 入参 `readConnectorPolicy`/`readConnectorConsent`）
 * [POS]: bundle 连接器纵深的**纯内核**（P0-1 的「策略求值器」段）——`docs/plan/connector-architecture.md` §3.2/§3.3 是唯一真源；本文件**不产生任何员工可见文案**（那是 P0-5 界面的事，且 §12.1 的词表还等用户裁决），只出稳定 reason / level / 平台三态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  connectorCapabilityFingerprint,
  type ConnectorCapabilityDeclaration,
  type ConnectorHostPlatform,
  type ConnectorPlatformSupport,
} from './capability.js'
import { connectorBadRequest } from './errors.js'

/** 权限三层（§3.2）。 */
export const CONNECTOR_PERMISSION_LEVELS = ['L1', 'L2', 'L3'] as const
export type ConnectorPermissionLevel = (typeof CONNECTOR_PERMISSION_LEVELS)[number]

const LEVEL_RANK: Record<ConnectorPermissionLevel, number> = { L1: 0, L2: 1, L3: 2 }

/** 企业策略（§6.3 的求值输入；**不是**员工的开关，也**不是**能力声明能自报的东西）。 */
export interface ConnectorPolicy {
  /** 这条能力对当前主体可见吗（`policy.visible`，§3.3 第二步）。 */
  readonly visible: boolean
  /** 可见但被策略挡住吗（`policy.allowed`，§3.3 第三步）。 */
  readonly allowed: boolean
  /** 管理员上限（§6.3）。缺席 = 这条能力没有被上限收紧，绝不等于"上限是 L1"。 */
  readonly ceiling?: ConnectorPermissionLevel
  /**
   * 管理员把 L3「锁死」（§3.2 L3 行的两种处置之一）⇒ 免逐次确认。
   *
   * ★ 命名取义写明：这里说的是**管理员预先授权**，不是"拒绝"。缺席 = 没锁死 ⇒ L3 每次调用都要确认。
   */
  readonly preAuthorized?: boolean
}

/** 一次「首次同意」的记录；绑的是**声明指纹**（§3.2 L2 的「集合变化重确认」）。 */
export interface ConnectorConsent {
  readonly capabilityId: string
  readonly fingerprint: string
}

/** 决策的现场事实：平台 + 策略 + 已有同意 + 限额可用性。 */
export interface ConnectorDecisionFacts {
  readonly platform: ConnectorHostPlatform
  readonly policy?: ConnectorPolicy
  readonly consent?: ConnectorConsent
  /**
   * 限额是否还有余量（§3.3 第四步）。**只对声明里写了 `quota` 的能力有约束**：
   * 缺席 ⇒ 拒绝（`quota-unknown`），而不是当成"还有余量"。
   */
  readonly quotaAvailable?: boolean
}

/** 行上三态（P0-5 的「可用 / 需确认 / 不支持」；§7 P0-5 那一行逐字）。 */
export type ConnectorCapabilityAvailability = 'ready' | 'needs-confirm' | 'unsupported'

/** 拒绝的稳定理由（员工可见文案由 P0-5 界面按它映射，本层不产出句子）。 */
export type ConnectorDenyReason =
  | 'unsupported-on-platform'
  | 'not-in-scope'
  | 'policy-blocked'
  | 'no-policy-for-l3'
  | 'quota-exceeded'
  | 'quota-unknown'

/** 需要一次显式同意的稳定理由。 */
export type ConnectorConsentReason = 'first-consent' | 'scope-changed' | 'platform-needs-confirm'

/** 决策结果。四态之间互斥，且 `allow` 是唯一会放行的形态。 */
export type ConnectorDecision =
  | { readonly kind: 'deny'; readonly capabilityId: string; readonly level: ConnectorPermissionLevel; readonly reason: ConnectorDenyReason }
  | { readonly kind: 'consent-required'; readonly capabilityId: string; readonly level: ConnectorPermissionLevel; readonly reason: ConnectorConsentReason }
  | { readonly kind: 'consent-per-call-required'; readonly capabilityId: string; readonly level: 'L3' }
  | { readonly kind: 'allow'; readonly capabilityId: string; readonly level: ConnectorPermissionLevel; readonly auditEvents: readonly string[] }

/**
 * L1/L2/L3 判据（§3.2 表 + §3.3 决策函数）。
 *
 * ★ **本实现把 L3 的两条轴判在 L1 之前**，这与 §3.3 伪代码的行序**相反**，是刻意的，理由如下：
 *
 * §3.3 写的是 `if 只读且可逆 -> L1; elif 不可逆或影响外部 -> L3; else -> L2`，而 §3.2 的两行判据
 * **可以同时成立**（`只读 + 可逆 + blastRadius=external` 两行都命中）。照伪代码的行序，这一格会被判 **L1
 * 并"可默认放行"** —— 那正是 §3.2 纪律 1 与 §8.2 第 5 条要堵的洞（影响外部的东西不许免确认）。
 * 故这里按 §3.2 纪律 3「宽严就近取严」取严的一侧：**先判 L3 的两条轴**。
 * 于是 `只读 + 可逆 + external` ⇒ L3，`只读 + irreversible` ⇒ L3。
 *
 * ★ 第二处两份真源不等价（同样必须如实登记）：§3.2 表的 L2 行除两轴外还要求
 * `effects ∩ {write,send,actuate} ≠ ∅`，而 §3.3 的 `else -> L2` 没有这一条。两者只在
 * 「只读效果 + `compensable`」这一格上分叉：表会判成**三层皆不命中**（无层级），而伪代码判 L2。
 * 本实现取 L2 —— 取严的一侧，且不留"无层级"这种必须靠调用方兜底的返回值。
 *
 * ⇒ 两处分叉都建议回写进 `docs/plan/connector-architecture.md`（该文 §3.2/§3.3 目前互相矛盾）。
 * ③ **决策函数的"同意"步**：§3.3 伪代码写的是 `if !consent.granted -> REQUIRE_CONSENT` **无条件**，
 *   而那与 §3.2 表 L1 行的"**可默认放行**"冲突（L1 若也要首次同意，就不叫默认放行了）。
 *   本实现按**表**走：L1 在支持平台上免同意；只有本平台 `needs-confirm` 时才要（此时 reason = `platform-needs-confirm`）。
 *   ⇒ 这也是"表与伪代码互相矛盾"的第三处（2026-10-06 第十六刀补登记；此前只写在 `connectorDecide` 的注释里）。
 * ★ **穷举审计（2026-10-06，第十五刀）**：把 §3.2 的三行谓词、§3.3 的伪代码、本实现三条都写成**可执行判据**，
 * 穷举 `effects` 非空子集 × `reversibility` × `blastRadius` 共 **279 格**，结论比原登记更准：
 *   · 表**唯一命中**的那 **270 格**里，本实现与表**零不一致** —— 方案判得出来的地方，我们判得一样；
 *   · 表**自身歧义 3 格**（`effects ⊆ {read,observe}` + `reversible` + `blastRadius = external`：L1 与 L3 两行都命中）
 *     —— 就是上面第 ① 处，本实现取 **L3**；
 *   · 表**未覆盖 6 格**（只读 + `compensable` + `self`/`org`）—— 就是上面第 ② 处，本实现取 **L2**；
 *   · 与 §3.3 伪代码的差异**恰为**那 3 格（family ①），**没有第三处未登记的分歧**。
 * ⇒ 所以准确的说法是：两处偏差合起来是 **9 格（3 歧义 + 6 未覆盖）**，且本文件的登记**是完备的**。
 */
export function connectorPermissionLevel(declaration: ConnectorCapabilityDeclaration): ConnectorPermissionLevel {
  if (declaration.reversibility === 'irreversible' || declaration.blastRadius === 'external') return 'L3'
  const readOnly = declaration.effects.every(effect => effect === 'read' || effect === 'observe')
  if (readOnly && declaration.reversibility === 'reversible') return 'L1'
  return 'L2'
}

/** 宽严就近取严（§3.2 纪律 3）：两个来源给不同层级时取更严的那个。 */
export function connectorStrictestLevel(
  left: ConnectorPermissionLevel,
  right: ConnectorPermissionLevel,
): ConnectorPermissionLevel {
  return LEVEL_RANK[left] >= LEVEL_RANK[right] ? left : right
}

/**
 * 折算出实际生效层级：声明算出的层级，再被管理员上限收紧（上限只可能更严，故就是取严）。
 *
 * 上限**不能**放宽声明算出的层级 —— 那等于让管理员替声明方"降级"，与纪律 2 冲突。
 *
 * ★ **方向必须说清（2026-10-06 第十六刀，穷举审计时我自己的审计脚本就被它骗过一次）**：
 * `ceiling` 读作「**至少这么严**」，**不是**「最多允许这么严」。故：
 * · `ceiling = 'L1'` ⇒ 什么都不改变（L1 声明仍 L1、L3 声明仍 L3）；
 * · `ceiling = 'L3'` ⇒ **所有**能力都被提到 L3（每条都要逐次确认）——这与"上限"这个词的直觉**相反**。
 * 依据是 §3.2 纪律 3「两个来源给不同层级时取更严的那个」；本实现照它走（fail-safe 方向）。
 * ⇒ **P0-5/P0-4 做策略界面时不能把它当"最高允许等级"来渲染**：若要表达"超过某级就不许用"，
 * 那是**另一个字段**（否决语义），不在本函数里，也不该借用 `ceiling` 的名字。
 */
export function connectorEffectiveLevel(
  declaration: ConnectorCapabilityDeclaration,
  policy?: ConnectorPolicy,
): ConnectorPermissionLevel {
  const declared = connectorPermissionLevel(declaration)
  const ceiling = policy?.ceiling
  return ceiling === undefined ? declared : connectorStrictestLevel(declared, ceiling)
}

/**
 * 本平台对这条能力的支持度（§3.3 第一步的 `host.support(cap)`）。
 *
 * ★ `platformRequired` **未列出的平台一律判 `unsupported`**：§3.1 要求显式声明，
 * §7 的「某平台今天做不到（必须显式标注，不许静默）」也要求漏声明必须显式失败，故这里 fail-closed。
 */
export function connectorPlatformSupport(
  declaration: ConnectorCapabilityDeclaration,
  platform: ConnectorHostPlatform,
): ConnectorPlatformSupport {
  return declaration.platformRequired.find(row => row.platform === platform)?.support ?? 'unsupported'
}

/**
 * 行上三态（P0-5）。
 *
 * 规则（逐条都能被下面的门禁断言）：
 * - 平台 `unsupported` ⇒ `unsupported`；
 * - **L3 且没有策略** ⇒ `unsupported`（§3.2 L3 行逐字「无策略时一律不可用」——不能显示成"需确认"，那会骗人）；
 * - 平台 `needs-confirm` ⇒ `needs-confirm`；
 * - 生效层级不是 L1（还要一次同意，L3 还要逐次确认/预授权）⇒ `needs-confirm`；
 * - 其余 ⇒ `ready`。
 *
 * ★ 三态**不看同意记录**：`connector-architecture.md` §3.1 给 `availability` 的定义是
 * 「本平台能力面 × 凭据是否可写 × 是否被分配」，不含"这个人同意过没有"；同意是决策层的事实
 * （{@link connectorDecide} 第 5 步），把它折进行上三态会让同一行在不同人眼里是两种状态。
 */
export function connectorCapabilityAvailability(
  declaration: ConnectorCapabilityDeclaration,
  facts: { readonly platform: ConnectorHostPlatform; readonly policy?: ConnectorPolicy },
): ConnectorCapabilityAvailability {
  // 与 `connectorDecide` 同一条纪律：坏策略对象**当场抛**，不许被当成真值往下算（否则一个拼错的 `ceiling` 会被静默忽略）。
  const policy = facts.policy === undefined ? undefined : readConnectorPolicy(facts.policy)
  const support = connectorPlatformSupport(declaration, facts.platform)
  if (support === 'unsupported') return 'unsupported'
  const level = connectorEffectiveLevel(declaration, policy)
  if (level === 'L3' && policy === undefined) return 'unsupported'
  if (support === 'needs-confirm') return 'needs-confirm'
  return level === 'L1' ? 'ready' : 'needs-confirm'
}

/**
 * 决策函数（§3.3）。
 *
 * 判定顺序逐字照 §3.3，并把两处它没写全的地方**按同一份文档的其它小节补严**（都在下面标了出处）：
 * 1. 平台不支持 ⇒ 拒；
 * 2. 策略不可见 ⇒ 拒；可见但不许 ⇒ 拒；
 * 3. **L3 且没有策略 ⇒ 拒**（§3.2 L3 行「无策略时一律不可用」；放在同意之前，免得让人先同意一个永远用不了的东西）；
 * 4. 声明写了限额：现场没给限额事实 ⇒ 拒（`quota-unknown`），事实说没了 ⇒ 拒（`quota-exceeded`）；
 * 5. 需要同意的（不是 L1，或本平台 `needs-confirm`）：没同意过 / 同意绑的指纹已变 ⇒ 要一次同意；
 * 6. L3 且**没**被管理员锁死 ⇒ 每次调用都要确认（§3.2 纪律 1，唯一豁免是 `preAuthorized`）；
 * 7. 放行，并把声明里的审计事件原样交回（没声明就是空表，**不替它编事件名**）。
 *
 * ★ 一处**本方案未定、我取了严**的语义（已登记给用户裁决）：L3 被管理员锁死时，**员工侧那次首次同意仍然要**。
 * 理由：P0-5 那句「首次同意 + 可撤回」是员工侧自己的门，管理员的预授权替代不了它。
 */
export function connectorDecide(
  declaration: ConnectorCapabilityDeclaration,
  facts: ConnectorDecisionFacts,
): ConnectorDecision {
  const capabilityId = declaration.capabilityId
  const policy = facts.policy === undefined ? undefined : readConnectorPolicy(facts.policy)
  const consent = facts.consent === undefined ? undefined : readConnectorConsent(facts.consent)
  const level = connectorEffectiveLevel(declaration, policy)
  const support = connectorPlatformSupport(declaration, facts.platform)
  if (support === 'unsupported') return { kind: 'deny', capabilityId, level, reason: 'unsupported-on-platform' }
  if (policy !== undefined && !policy.visible) return { kind: 'deny', capabilityId, level, reason: 'not-in-scope' }
  if (policy !== undefined && !policy.allowed) return { kind: 'deny', capabilityId, level, reason: 'policy-blocked' }
  if (level === 'L3' && policy === undefined) return { kind: 'deny', capabilityId, level, reason: 'no-policy-for-l3' }
  if (declaration.quota !== undefined) {
    if (facts.quotaAvailable === undefined) return { kind: 'deny', capabilityId, level, reason: 'quota-unknown' }
    if (!facts.quotaAvailable) return { kind: 'deny', capabilityId, level, reason: 'quota-exceeded' }
  }
  if (needsConsent(level, support)) {
    if (consent === undefined) {
      return {
        kind: 'consent-required',
        capabilityId,
        level,
        reason: support === 'needs-confirm' && level === 'L1' ? 'platform-needs-confirm' : 'first-consent',
      }
    }
    if (consent.capabilityId !== capabilityId) {
      return { kind: 'consent-required', capabilityId, level, reason: 'first-consent' }
    }
    if (consent.fingerprint !== connectorCapabilityFingerprint(declaration)) {
      return { kind: 'consent-required', capabilityId, level, reason: 'scope-changed' }
    }
  }
  if (level === 'L3' && policy?.preAuthorized !== true) {
    return { kind: 'consent-per-call-required', capabilityId, level: 'L3' }
  }
  return { kind: 'allow', capabilityId, level, auditEvents: declaration.auditEvents ?? [] }
}

/** 需不需要一次显式同意：L1 可默认放行（§3.2 L1 行），其余要；本平台 `needs-confirm` 也一并要。 */
function needsConsent(level: ConnectorPermissionLevel, support: ConnectorPlatformSupport): boolean {
  return level !== 'L1' || support === 'needs-confirm'
}

/** 严格读取策略对象（**关闭键集**）：多一个键就拒，免得调用方以为某个多余字段被读进去了。 */
export function readConnectorPolicy(value: unknown): ConnectorPolicy {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw connectorBadRequest('connector policy must be an object')
  }
  const raw = value as Record<string, unknown>
  const allowed = ['visible', 'allowed', 'ceiling', 'preAuthorized']
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) throw connectorBadRequest(`connector policy carries an unknown key: ${key}`)
  }
  if (typeof raw['visible'] !== 'boolean' || typeof raw['allowed'] !== 'boolean') {
    throw connectorBadRequest('connector policy requires boolean visible/allowed')
  }
  const ceiling = raw['ceiling']
  if (ceiling !== undefined && !(CONNECTOR_PERMISSION_LEVELS as readonly unknown[]).includes(ceiling)) {
    throw connectorBadRequest('connector policy ceiling must be one of: L1, L2, L3')
  }
  const preAuthorized = raw['preAuthorized']
  if (preAuthorized !== undefined && typeof preAuthorized !== 'boolean') {
    throw connectorBadRequest('connector policy preAuthorized must be a boolean when present')
  }
  return Object.freeze({
    visible: raw['visible'],
    allowed: raw['allowed'],
    ...(ceiling === undefined ? {} : { ceiling: ceiling as ConnectorPermissionLevel }),
    ...(preAuthorized === undefined ? {} : { preAuthorized }),
  })
}

/** 严格读取一条同意记录（关闭键集 + 非空串）。 */
export function readConnectorConsent(value: unknown): ConnectorConsent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw connectorBadRequest('connector consent must be an object')
  }
  const raw = value as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (key !== 'capabilityId' && key !== 'fingerprint') {
      throw connectorBadRequest(`connector consent carries an unknown key: ${key}`)
    }
  }
  for (const key of ['capabilityId', 'fingerprint'] as const) {
    const candidate = raw[key]
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      throw connectorBadRequest(`connector consent ${key} must be a non-empty string`)
    }
  }
  return Object.freeze({ capabilityId: raw['capabilityId'] as string, fingerprint: raw['fingerprint'] as string })
}
