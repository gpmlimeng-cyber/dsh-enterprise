/**
 * [INPUT]: 只依赖 node:crypto（稳定指纹）与 ./errors.js；**不 import 任何 `@deepseek-ai/*`、不碰 fs / 网络 / 环境变量**
 * [OUTPUT]: 对外提供连接器能力声明的字段模型（§3.1 的 14 个字段 + 最少必填集）、严格读取 `readConnectorCapabilityDeclaration`、稳定指纹 `connectorCapabilityFingerprint`、惰性默认投影 `connectorInboundKind` 与注册表 `createConnectorCapabilityRegistry`
 * [POS]: bundle 连接器纵深的**纯内核**（P0-1 的「模型 + 注册表」段）——`docs/plan/connector-architecture.md` §3.1 是字段的唯一真源，本文件只把那份草案变成**可校验、可指纹、可查表**的数据结构；**权限判定不在这里**（在 ./policy.ts），也不含任何平台 API（公理 7「内核必须无平台」）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { EnterpriseConnectorError, connectorBadRequest } from './errors.js'

/** 效果类型（§3.1 `effects`）。 */
export const CONNECTOR_EFFECTS = ['read', 'observe', 'write', 'send', 'actuate'] as const
export type ConnectorEffect = (typeof CONNECTOR_EFFECTS)[number]

/** 可逆性（§3.1 `reversibility`）：L1/L3 判据的第一轴。 */
export const CONNECTOR_REVERSIBILITIES = ['reversible', 'compensable', 'irreversible'] as const
export type ConnectorReversibility = (typeof CONNECTOR_REVERSIBILITIES)[number]

/** 影响半径（§3.1 `blastRadius`）：L2/L3 判据的第二轴。 */
export const CONNECTOR_BLAST_RADII = ['self', 'org', 'external'] as const
export type ConnectorBlastRadius = (typeof CONNECTOR_BLAST_RADII)[number]

/** 传输（§3.1 `transport`）：传输是**可替换细节**（公理 3），故它不参与任何权限判据。 */
export const CONNECTOR_TRANSPORTS = [
  'mcp',
  'http',
  'openapi',
  'a2a',
  'acp',
  'im-webhook',
  'smtp',
  'imap',
  'mqtt',
] as const
export type ConnectorTransport = (typeof CONNECTOR_TRANSPORTS)[number]

/** 入站形态（§3.1 `inbound`）；缺省一律 `none`（见 {@link connectorInboundKind}）。 */
export const CONNECTOR_INBOUNDS = ['none', 'webhook', 'long-poll', 'callback'] as const
export type ConnectorInbound = (typeof CONNECTOR_INBOUNDS)[number]

/** 发现方式（§3.1 `discovery`）：公理 6「没有发现方式不许上线」，故它是必填且不得为空。 */
export const CONNECTOR_DISCOVERIES = [
  'mdns',
  'ssdp',
  'netscan',
  'ble-scan',
  'nfc-tap',
  'catalog',
  'manual',
] as const
export type ConnectorDiscovery = (typeof CONNECTOR_DISCOVERIES)[number]

/**
 * 宿主平台词表（`platformRequired` 的键）。
 *
 * 取值出处：`android`/`linux`/`darwin`/`win32` 就是 Node 的 `process.platform` 四值（本仓既有用法：
 * `bundle/src/index.ts:798` 直接判 `process.platform === 'android'`，`:220` 的 `resolveDesktopPlatform`
 * 返回 `'darwin' | 'win32' | null`）。★ 与 contracts 的 `PluginOperatingSystem`（`'darwin' | 'linux' | 'win32'`）
 * **不是同一张表**：那张表描述的是**插件制品**可在哪些桌面系统上装，本文这张描述的是**能力宿主**在哪跑，
 * 手机宿主（android）在能力面里是一等公民，故这里**不**复用它、也不改写它。
 */
export const CONNECTOR_HOST_PLATFORMS = ['android', 'darwin', 'linux', 'win32'] as const
export type ConnectorHostPlatform = (typeof CONNECTOR_HOST_PLATFORMS)[number]

/** 平台三态（§3.1 `platformRequired` 的值；也是 P0-5 行上「可用 / 需确认 / 不支持」的来源）。 */
export const CONNECTOR_PLATFORM_SUPPORTS = ['supported', 'needs-confirm', 'unsupported'] as const
export type ConnectorPlatformSupport = (typeof CONNECTOR_PLATFORM_SUPPORTS)[number]

/** 状态寻址的种类（§3.1 `stateAddress`）。 */
export const CONNECTOR_STATE_ADDRESS_KINDS = ['object', 'device', 'field', 'resource'] as const
export type ConnectorStateAddressKind = (typeof CONNECTOR_STATE_ADDRESS_KINDS)[number]

/** 状态寻址：读/写的到底是哪个状态（公理 1「能力 = 可读写状态集合」，没有寻址就没有能力）。 */
export interface ConnectorStateAddress {
  readonly kind: ConnectorStateAddressKind
  /** 结构化路径（对象名/设备 id/字段路径/资源路径）；**不是** URL，不带 scheme。 */
  readonly path: string
}

/** 平台要求的一行。 */
export interface ConnectorPlatformRequirement {
  readonly platform: ConnectorHostPlatform
  readonly support: ConnectorPlatformSupport
}

/** 限额（§3.1 `quota`）：次数 / 窗口 / 并发 / 字节，至少写一项，否则它就不是一条限额。 */
export interface ConnectorQuota {
  readonly maxCalls?: number
  readonly windowSeconds?: number
  readonly maxConcurrency?: number
  readonly maxBytes?: number
}

/**
 * 一条能力声明（§3.1 的 14 个字段）。
 *
 * ★ **没有 `level` / `permission` / `tier` 之类的字段，这一条是刻意的**：L1/L2/L3 是求值器算出来的
 * （§3.2 纪律 2）。任何人给声明塞这类键都会在 {@link readConnectorCapabilityDeclaration} 被当场拒。
 */
export interface ConnectorCapabilityDeclaration {
  /** 稳定标识，进会话历史与权限规则；小写字母/数字/连字符。 */
  readonly capabilityId: string
  /** 人话名（员工侧只出现 title 与 summary）。 */
  readonly title: string
  /** 一句话说明；缺省则不写（界面不替它编一句）。 */
  readonly summary?: string
  readonly stateAddress: ConnectorStateAddress
  /** 效果类型集合；**不得为空**（空集会让 L1 判据空集真）。 */
  readonly effects: readonly ConnectorEffect[]
  readonly reversibility: ConnectorReversibility
  readonly blastRadius: ConnectorBlastRadius
  readonly transport: ConnectorTransport
  /** 认证引用：**只写凭据键名，绝不写值**（§3.1 `authRef`；官方 `ctx.credentials`）。 */
  readonly authRef?: string
  /** 出站白名单：能访问的域名/网段，显式声明；不许写裸 `*`（那等于没有白名单）。 */
  readonly egressAllowlist?: readonly string[]
  readonly quota?: ConnectorQuota
  /** 入站形态；缺省 = 不支持入站（{@link connectorInboundKind}）。 */
  readonly inbound?: ConnectorInbound
  /** 会产生哪些审计事件（`SCREAMING_SNAKE` 形状；**封闭枚举的成员校验在持有该枚举的一侧**，不在这里假装做过）。 */
  readonly auditEvents?: readonly string[]
  /** 平台要求；**未列出的平台一律判「不支持」**（不许静默当作可用）。 */
  readonly platformRequired: readonly ConnectorPlatformRequirement[]
  readonly discovery: readonly ConnectorDiscovery[]
}

/** §3.1「最少必填集（硬性）」的九个字段；`auditEvents`/`summary`/`inbound`/`authRef`/`egressAllowlist`/`quota` 可缺省。 */
export const CONNECTOR_REQUIRED_DECLARATION_FIELDS = [
  'capabilityId',
  'title',
  'stateAddress',
  'effects',
  'reversibility',
  'blastRadius',
  'transport',
  'platformRequired',
  'discovery',
] as const

/** 认得的全部键；**未知键一律拒**（见 {@link rejectUnknownKeys}）。 */
const DECLARATION_KEYS: readonly string[] = [
  ...CONNECTOR_REQUIRED_DECLARATION_FIELDS,
  'summary',
  'authRef',
  'egressAllowlist',
  'quota',
  'inbound',
  'auditEvents',
]

/** 自贴权限等级的键名特征：命中就抛 `ENT_CONNECTOR_LEVEL_DECLARED` 而不是笼统的"未知键"。 */
const LEVEL_CLAIM_PATTERN = /level|permission|tier/i

const CAPABILITY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/**
 * 凭据键名（`authRef` 与配置型 bundle 的引用键）——只允许标识符形状，故 `Bearer sk-…` 这类值写不进来。
 *
 * ★ 本刀起**唯一一份**：`connector/bundle.ts` 与 `connector/credentials.ts` 都 import 这里，
 * 不再各留一份（同一把尺写三遍，迟早有一处漂移）。
 */
/**
 * 凭据键名的语法：**逐字对齐官方** `dsh-credentials/lib/index.js:13` 的 `REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/`
 * （"POSIX-style environment-variable name"，见 `lib/types/types.d.ts:11`）。
 *
 * ★ 2026-10-06（第十八刀）**收紧**：原来允许 `-` 与 `.`，那有两个后果，都是真问题：
 * ① **正确性**：我们的配置型 bundle 写的是 `env: { KEY: !!js process.env.<键名> }` —— 键名带 `-` 时
 *    JS 把 `process.env.a-b` 解析成**减法**（`NaN`/ReferenceError），http 头那条模板 `` `Bearer ${process.env.a-b}` ``
 *    会送出 `Bearer NaN`。也就是说旧语法**能生成一个坏配置**。
 * ② 顺带堵住"把密钥粘进键名位置"的常见误操作形状（`sk-...`/`ghp_...` 这类带 `-` 的值以前**会被接受**）。
 * ⇒ 现在与官方同一把尺；（残留：不带连字符的密钥形状仍可能被当成"名字"，那条要靠"引用必须已在声明里
 *   的 `authRef` 里出现"来根治，属后续刀，见方案 §4.1 的登记）。
 */
export const CONNECTOR_CREDENTIAL_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
export const MAX_CONNECTOR_CREDENTIAL_KEY_LENGTH = 64
const CREDENTIAL_KEY_PATTERN = CONNECTOR_CREDENTIAL_KEY_PATTERN
/** 审计动作名（`SCREAMING_SNAKE`）。 */
const AUDIT_ACTION_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/
const MAX_CAPABILITY_ID_LENGTH = 64
const MAX_TITLE_LENGTH = 120
const MAX_SUMMARY_LENGTH = 2000
const MAX_STATE_PATH_LENGTH = 512
const MAX_EGRESS_ENTRIES = 64
const MAX_AUDIT_EVENTS = 64
const MAX_DISCOVERIES = 7
const FINGERPRINT_DOMAIN = 'dsh-ent-connector-capability/v1'

/**
 * 严格读取一条能力声明：形状不对**当场抛**，形状对则返回**规范化**后的冻结对象。
 *
 * 规范化只做两件事，都是为了让指纹与下游判据**与书写顺序无关**：① 集合字段按字典序排序并去重（重复项直接拒，
 * 不静默折叠——重复说明声明本身有问题）；② 缺省的可选键**不产出该键**（而不是产出空串/`undefined`）。
 */
export function readConnectorCapabilityDeclaration(value: unknown): ConnectorCapabilityDeclaration {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw declarationInvalid('capability declaration must be an object')
  }
  const raw = value as Record<string, unknown>
  rejectUnknownKeys(raw)
  const capabilityId = requirePatternText(
    'capabilityId',
    raw['capabilityId'],
    CAPABILITY_ID_PATTERN,
    MAX_CAPABILITY_ID_LENGTH,
  )
  const title = requireText('title', raw['title'], MAX_TITLE_LENGTH)
  const summary = optionalText('summary', raw['summary'], MAX_SUMMARY_LENGTH)
  const stateAddress = readStateAddress(raw['stateAddress'])
  const effects = requireEnumSet('effects', raw['effects'], CONNECTOR_EFFECTS, CONNECTOR_EFFECTS.length)
  const reversibility = requireEnum('reversibility', raw['reversibility'], CONNECTOR_REVERSIBILITIES)
  const blastRadius = requireEnum('blastRadius', raw['blastRadius'], CONNECTOR_BLAST_RADII)
  const transport = requireEnum('transport', raw['transport'], CONNECTOR_TRANSPORTS)
  const authRef = optionalPatternText('authRef', raw['authRef'], CREDENTIAL_KEY_PATTERN, 64)
  const egressAllowlist = optionalEgressAllowlist(raw['egressAllowlist'])
  const quota = readQuota(raw['quota'])
  const inbound = optionalEnum('inbound', raw['inbound'], CONNECTOR_INBOUNDS)
  const auditEvents = optionalPatternSet('auditEvents', raw['auditEvents'], AUDIT_ACTION_PATTERN, MAX_AUDIT_EVENTS)
  const platformRequired = readPlatformRequirements(raw['platformRequired'])
  const discovery = requireEnumSet('discovery', raw['discovery'], CONNECTOR_DISCOVERIES, MAX_DISCOVERIES)
  return Object.freeze({
    capabilityId,
    title,
    ...(summary === undefined ? {} : { summary }),
    stateAddress,
    effects,
    reversibility,
    blastRadius,
    transport,
    ...(authRef === undefined ? {} : { authRef }),
    ...(egressAllowlist === undefined ? {} : { egressAllowlist }),
    ...(quota === undefined ? {} : { quota }),
    ...(inbound === undefined ? {} : { inbound }),
    ...(auditEvents === undefined ? {} : { auditEvents }),
    platformRequired,
    discovery,
  })
}

/**
 * 稳定指纹：同一条声明的**任何等价书写**都必须给出同一枚指纹。
 *
 * 用途是「一次授权、集合变化重确认」（§3.2 L2 默认处置）：员工那次同意绑的是**这枚指纹**，
 * 声明改一个字符（哪怕只是把 `effects` 换个顺序不会、但增减一项会）就必须重新确认。
 */
export function connectorCapabilityFingerprint(declaration: ConnectorCapabilityDeclaration): string {
  return createHash('sha256').update(`${FINGERPRINT_DOMAIN}\n`).update(canonicalJson(declaration)).digest('hex')
}

/**
 * 入站形态的**惰性默认**：声明里没写 `inbound` 就是「不支持入站」。
 *
 * ★ 这里只给纯内核可断言的默认值。宪法「默认值必须可见」（`docs/notes/product-charter.md:28`）要求
 * **界面**把这条默认说出来，那是 P0-5 的事，不在本文件。
 */
export function connectorInboundKind(declaration: ConnectorCapabilityDeclaration): ConnectorInbound {
  return declaration.inbound ?? 'none'
}

/** 能力注册表：`capabilityId` 全局唯一，查表与列举都在这一处。 */
export interface ConnectorCapabilityRegistry {
  readonly size: number
  readonly capabilityIds: readonly string[]
  list(): readonly ConnectorCapabilityDeclaration[]
  get(capabilityId: string): ConnectorCapabilityDeclaration | undefined
}

/**
 * 建档：逐条严格读取（形状不对当场抛），`capabilityId` 撞车一律 `ENT_CONNECTOR_ID_DUPLICATE`。
 *
 * 撞车**不**允许"后者覆盖前者"：`capabilityId` 进会话历史与权限规则，静默覆盖等于悄悄改掉一条已授权的能力。
 */
export function createConnectorCapabilityRegistry(
  declarations: readonly unknown[],
): ConnectorCapabilityRegistry {
  if (!Array.isArray(declarations)) throw connectorBadRequest('connector declarations must be an array')
  const byId = new Map<string, ConnectorCapabilityDeclaration>()
  for (const entry of declarations) {
    const declaration = readConnectorCapabilityDeclaration(entry)
    if (byId.has(declaration.capabilityId)) {
      throw new EnterpriseConnectorError(
        'ENT_CONNECTOR_ID_DUPLICATE',
        `duplicate connector capabilityId: ${declaration.capabilityId}`,
      )
    }
    byId.set(declaration.capabilityId, declaration)
  }
  const list = Object.freeze([...byId.values()])
  const ids = Object.freeze([...byId.keys()])
  return Object.freeze({
    size: byId.size,
    capabilityIds: ids,
    list: () => list,
    get: (capabilityId: string) => byId.get(capabilityId),
  })
}

/** 稳定序列化：键按固定顺序（= 接口声明顺序）、集合已排序，故同一语义只有一种正文。 */
function canonicalJson(declaration: ConnectorCapabilityDeclaration): string {
  return JSON.stringify({
    capabilityId: declaration.capabilityId,
    title: declaration.title,
    summary: declaration.summary ?? null,
    stateAddress: { kind: declaration.stateAddress.kind, path: declaration.stateAddress.path },
    effects: declaration.effects,
    reversibility: declaration.reversibility,
    blastRadius: declaration.blastRadius,
    transport: declaration.transport,
    authRef: declaration.authRef ?? null,
    egressAllowlist: declaration.egressAllowlist ?? null,
    quota: declaration.quota ?? null,
    inbound: declaration.inbound ?? null,
    auditEvents: declaration.auditEvents ?? null,
    platformRequired: declaration.platformRequired,
    discovery: declaration.discovery,
  })
}

function rejectUnknownKeys(raw: Record<string, unknown>): void {
  for (const key of Object.keys(raw)) {
    if (DECLARATION_KEYS.includes(key)) continue
    if (LEVEL_CLAIM_PATTERN.test(key)) {
      throw new EnterpriseConnectorError(
        'ENT_CONNECTOR_LEVEL_DECLARED',
        `capability declaration must not carry a permission level (${key}); levels are computed from effects/reversibility/blastRadius`,
      )
    }
    throw declarationInvalid(`capability declaration carries an unknown key: ${key}`)
  }
}

function readStateAddress(value: unknown): ConnectorStateAddress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw declarationInvalid('stateAddress must be an object')
  }
  const raw = value as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (key !== 'kind' && key !== 'path') throw declarationInvalid(`stateAddress carries an unknown key: ${key}`)
  }
  const kind = requireEnum('stateAddress.kind', raw['kind'], CONNECTOR_STATE_ADDRESS_KINDS)
  const path = requireText('stateAddress.path', raw['path'], MAX_STATE_PATH_LENGTH)
  return Object.freeze({ kind, path })
}

function readPlatformRequirements(value: unknown): readonly ConnectorPlatformRequirement[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw declarationInvalid('platformRequired must be a non-empty array')
  }
  const seen = new Set<ConnectorHostPlatform>()
  const rows: ConnectorPlatformRequirement[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw declarationInvalid('platformRequired entries must be objects')
    }
    const raw = entry as Record<string, unknown>
    for (const key of Object.keys(raw)) {
      if (key !== 'platform' && key !== 'support') {
        throw declarationInvalid(`platformRequired entry carries an unknown key: ${key}`)
      }
    }
    const platform = requireEnum('platformRequired.platform', raw['platform'], CONNECTOR_HOST_PLATFORMS)
    if (seen.has(platform)) throw declarationInvalid(`platformRequired lists ${platform} twice`)
    seen.add(platform)
    const support = requireEnum('platformRequired.support', raw['support'], CONNECTOR_PLATFORM_SUPPORTS)
    rows.push(Object.freeze({ platform, support }))
  }
  return Object.freeze(rows.sort((left, right) => left.platform.localeCompare(right.platform)))
}

function readQuota(value: unknown): ConnectorQuota | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw declarationInvalid('quota must be an object')
  }
  const raw = value as Record<string, unknown>
  const keys = ['maxCalls', 'windowSeconds', 'maxConcurrency', 'maxBytes'] as const
  for (const key of Object.keys(raw)) {
    if (!(keys as readonly string[]).includes(key)) throw declarationInvalid(`quota carries an unknown key: ${key}`)
  }
  const quota: Record<string, number> = {}
  for (const key of keys) {
    const candidate = raw[key]
    if (candidate === undefined) continue
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate <= 0) {
      throw declarationInvalid(`quota.${key} must be a positive safe integer`)
    }
    quota[key] = candidate
  }
  if (Object.keys(quota).length === 0) throw declarationInvalid('quota must constrain at least one of calls/window/concurrency/bytes')
  return Object.freeze(quota) as ConnectorQuota
}

function optionalEgressAllowlist(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length === 0) {
    throw declarationInvalid('egressAllowlist must be a non-empty array when present')
  }
  if (value.length > MAX_EGRESS_ENTRIES) throw declarationInvalid('egressAllowlist is too long')
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw declarationInvalid('egressAllowlist entries must be non-empty strings')
    }
    const host = entry.trim().toLowerCase()
    if (host !== entry) throw declarationInvalid('egressAllowlist entries must be lowercase and unpadded')
    if (host === '*' || host.includes('*')) {
      // 裸通配等于没有白名单，而"显式声明"是 §3.1 对这一项的硬要求 ⇒ fail-closed，不静默放宽。
      throw declarationInvalid('egressAllowlist must not use wildcards')
    }
    if (/[\s/\\@]/.test(host) || host.includes('://')) {
      throw declarationInvalid('egressAllowlist entries must be bare hosts or CIDRs (no scheme, path or credentials)')
    }
    if (seen.has(host)) throw declarationInvalid(`egressAllowlist lists ${host} twice`)
    seen.add(host)
  }
  return Object.freeze([...seen].sort())
}

function requireEnum<T extends string>(label: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw declarationInvalid(`${label} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function optionalEnum<T extends string>(label: string, value: unknown, allowed: readonly T[]): T | undefined {
  return value === undefined ? undefined : requireEnum(label, value, allowed)
}

function requireEnumSet<T extends string>(label: string, value: unknown, allowed: readonly T[], max: number): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) throw declarationInvalid(`${label} must be a non-empty array`)
  if (value.length > max) throw declarationInvalid(`${label} is too long`)
  const seen = new Set<T>()
  for (const entry of value) {
    const item = requireEnum(`${label} entries`, entry, allowed)
    if (seen.has(item)) throw declarationInvalid(`${label} lists ${item} twice`)
    seen.add(item)
  }
  return Object.freeze([...seen].sort())
}

function optionalPatternSet(label: string, value: unknown, pattern: RegExp, max: number): readonly string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length === 0) throw declarationInvalid(`${label} must be a non-empty array when present`)
  if (value.length > max) throw declarationInvalid(`${label} is too long`)
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string' || !pattern.test(entry)) {
      throw declarationInvalid(`${label} entries must match ${String(pattern)}`)
    }
    if (seen.has(entry)) throw declarationInvalid(`${label} lists ${entry} twice`)
    seen.add(entry)
  }
  return Object.freeze([...seen].sort())
}

function requireText(label: string, value: unknown, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw declarationInvalid(`${label} must be a non-empty string of at most ${max} characters`)
  }
  return value
}

function optionalText(label: string, value: unknown, max: number): string | undefined {
  return value === undefined ? undefined : requireText(label, value, max)
}

function requirePatternText(label: string, value: unknown, pattern: RegExp, max: number): string {
  const text = requireText(label, value, max)
  if (!pattern.test(text)) throw declarationInvalid(`${label} must match ${String(pattern)}`)
  return text
}

function optionalPatternText(label: string, value: unknown, pattern: RegExp, max: number): string | undefined {
  return value === undefined ? undefined : requirePatternText(label, value, pattern, max)
}

function declarationInvalid(message: string): EnterpriseConnectorError {
  return new EnterpriseConnectorError('ENT_CONNECTOR_DECLARATION_INVALID', message)
}
