/**
 * [INPUT]: 依赖 dsh-ui 的严格解码器与**导出的运行时常量**（`local-api-decode` 的 `decodeEnterprisePresets` /
 *          `decodeEnterpriseSkills` / `decodeEnterpriseSkillDetail` / `EnterpriseLocalApiError` /
 *          `ENTERPRISE_PRESET_ROW_{REQUIRED,OPTIONAL}_KEYS` / `ENTERPRISE_PRESET_DEPENDENCY_{KEYS,OPTIONAL_KEYS}`），
 *          以及 contracts 真源（`generated/schemas/*.schema.json` 优先、缺席时退回自包含
 *          `generated/enterprise-openapi.json` 的 `components.schemas`；`fixtures/runtime-preset-*.json`、
 *          `fixtures/runtime-skill-detail-success.json`）
 * [OUTPUT]: 锁定配方 `dependencies`（契约切片 B）的整条解码行为——合法（空/单条 pinned/单条 latest/混排/恰好 200）、
 *           越界（201）与非法（kind/mode/required/versionId/id/未声明键）一律按既有稳定码 `ENT_LOCAL_RESPONSE_INVALID`
 *           整条失败、以及"旧服务端不发 dependencies"的先发 plugin 窗口仍能解码；并锁死
 *           「runtime 解码器白名单键集 == 契约声明键集」的漂移门禁（含未声明字段与必填/可选错位的显式断点）
 * [POS]: dsh-ui 与 contracts 之间**唯一**的键集漂移哨兵。三起已实证事故（配方 sizeBytes 判定写反 ⇒ 列表恒失败、
 *        服务端多发未声明字段 downloadPath ⇒ 详情恒失败、审计 action 枚举 35 vs 46）里前两类在这里被钉住：
 *        ① 真 fixture 逐条解码锁住值判定，② 键集相等锁住"员工端白名单不能多也不能少"。
 *        刻意用手写假体测的是"我以为的形状"，真 fixture 测的才是"服务端真的形状"
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  EnterpriseLocalApiError,
  decodeEnterprisePresets,
  decodeEnterpriseSkillDetail,
  decodeEnterpriseSkills,
  ENTERPRISE_PRESET_DEPENDENCY_KEYS,
  ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL_KEYS,
  ENTERPRISE_PRESET_ROW_OPTIONAL_KEYS,
  ENTERPRISE_PRESET_ROW_REQUIRED_KEYS,
} from '../src/local-api-decode.js'

type JsonObject = Record<string, unknown>

/**
 * 向上搜索仓库契约真源：本文件在 monorepo 里的深度会随落点变化（`plugin/packages/<pkg>/tests` 与
 * staging 的 `apps/desktop/packages/<pkg>/tests` 不同），固定相对层级必然写死一个位置；
 * 发布包内不存在该目录，相关断言会整体 skip 而不是误报通过（照 client-plugin/tests/contract-drift.test.ts 的既有风格）。
 */
function findContractsRoot(): string | null {
  let current = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, 'contracts')
    if (existsSync(join(candidate, 'generated', 'enterprise-openapi.json'))) return candidate
    const parent = resolve(current, '..')
    if (parent === current) return null
    current = parent
  }
  return null
}

const CONTRACTS_ROOT = findContractsRoot()
const HAS_CONTRACTS = CONTRACTS_ROOT !== null

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject
}

function fixture(name: string): JsonObject {
  return readJson(join(CONTRACTS_ROOT ?? '', 'fixtures', name))
}

/**
 * 取一份契约 schema：优先读**每投影一个文件**的自包含 JSON Schema；`RuntimeSkillSummary` / `PresetDependency`
 * 这类只作为 allOf 分支或引用存在的组件不单独出文件，此时退回自包含 `enterprise-openapi.json`
 * （与 Java 侧 T02/T13 及 client-plugin 漂移门禁消费的是同一个真源）。
 */
function contractSchema(name: string): JsonObject {
  const standalone = join(CONTRACTS_ROOT ?? '', 'generated', 'schemas', `${name}.schema.json`)
  if (existsSync(standalone)) return readJson(standalone)
  const spec = readJson(join(CONTRACTS_ROOT ?? '', 'generated', 'enterprise-openapi.json'))
  const components = (spec['components'] ?? {}) as { schemas?: Record<string, JsonObject> }
  const schema = components.schemas?.[name]
  if (schema === undefined) throw new Error(`契约里找不到 schema ${name}`)
  return schema
}

interface ContractKeySet {
  /** 声明的全部键（allOf 各分支并集）＝员工端白名单必须有的全集。 */
  readonly declared: readonly string[]
  /** 契约标为必填的键（只用于显式断点，不参与键集相等）。 */
  readonly required: readonly string[]
}

function contractKeySet(name: string): ContractKeySet {
  const declared = new Set<string>()
  const required = new Set<string>()
  const visit = (node: JsonObject): void => {
    if (Array.isArray(node['allOf'])) for (const branch of node['allOf'] as JsonObject[]) visit(branch)
    const properties = node['properties']
    if (properties !== undefined && typeof properties === 'object' && properties !== null) {
      for (const key of Object.keys(properties)) declared.add(key)
    }
    if (Array.isArray(node['required'])) for (const key of node['required'] as string[]) required.add(key)
  }
  visit(contractSchema(name))
  return { declared: [...declared], required: [...required] }
}

function declaredPropertySchema(schema: JsonObject, name: string): JsonObject | undefined {
  const properties = schema['properties']
  if (properties !== undefined && typeof properties === 'object' && properties !== null) {
    const found = (properties as JsonObject)[name]
    if (found !== undefined) return found as JsonObject
  }
  if (Array.isArray(schema['allOf'])) {
    for (const branch of schema['allOf'] as JsonObject[]) {
      const found = declaredPropertySchema(branch, name)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** 按契约 schema 造一个能过形状校验的探针值（只覆盖本文件用到的类型）。 */
function probeValue(schema: JsonObject): unknown {
  if (Array.isArray(schema['enum'])) return (schema['enum'] as unknown[])[0]
  const rawType = schema['type']
  const type = Array.isArray(rawType)
    ? (rawType as unknown[]).find(candidate => candidate !== 'null')
    : rawType
  if (type === 'string') {
    if (schema['format'] === 'date-time') return '2026-01-01T00:00:00Z'
    // 雪花 ID 的 pattern 必须给一个真雪花，否则探针会被形状门禁挡下、把"键在白名单里"误判成"不在"。
    return typeof schema['pattern'] === 'string' && schema['pattern'].includes('[1-9][0-9]{0,18}')
      ? '1901500000000000001'
      : 'x'
  }
  if (type === 'integer' || type === 'number') return schema['minimum'] ?? 1
  if (type === 'boolean') return true
  if (type === 'array') return []
  if (type === 'object') return {}
  return 'x'
}

/** 契约声明的键 → 探针：行里已有的键沿用真值，缺席的键按契约 schema 造一个合法值。 */
function declareProbes(schemaName: string, base: JsonObject): readonly { key: string, value: unknown }[] {
  const contract = contractKeySet(schemaName)
  const schema = contractSchema(schemaName)
  return contract.declared.map(key => ({
    key,
    value: key in base ? base[key] : probeValue(declaredPropertySchema(schema, key) ?? {}),
  }))
}

/**
 * 行为探针：把候选键逐个塞进基准行交给解码器；接受 ⇒ 该键坐在白名单里，抛 ⇒ 不在。
 *
 * 这是「解码器白名单 == 契约键集」在**技能解码器**上的等价断言方式：技能键集常量住在
 * skill-api-decode.ts 里、本刀不改那个分片，所以不走字面比对而走行为等价（配方解码器的键集
 * 已导出，另有一条字面比对）。
 */
function acceptedKeys(
  decodeRow: (row: JsonObject) => unknown,
  base: JsonObject,
  candidates: readonly { key: string, value: unknown }[],
): Set<string> {
  const accepted = new Set<string>()
  for (const { key, value } of candidates) {
    try {
      decodeRow({ ...base, [key]: value })
      accepted.add(key)
    } catch {
      // 拒绝即不在白名单；断言在调用处。
    }
  }
  return accepted
}

/** 未声明探针：三起事故里真实出现过的形状 + 常见的泄漏键名；解码器一律不许放它们进来。 */
const UNDECLARED_PROBES = [
  'downloadPath', 'downloadUrl', 'artifactPath', 'artifactRef', 'resolvedVersionId',
  'accessToken', 'accessTokenExpiresAt', 'authorization', 'signatureBase64', 'localPath', 'content',
] as const

function expectInvalid(run: () => unknown): void {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(EnterpriseLocalApiError)
    expect((error as EnterpriseLocalApiError).code).toBe('ENT_LOCAL_RESPONSE_INVALID')
    return
  }
  throw new Error('应当整条判 ENT_LOCAL_RESPONSE_INVALID，但没有抛')
}

const PRESET_SUMMARY = fixture('runtime-preset-summary-success.json')
const PRESET_DETAIL = fixture('runtime-preset-detail-success.json')
const PRESET_UNKNOWN_KIND = fixture('runtime-preset-summary-unknown-dependency-kind.json')
const SKILL_DETAIL = fixture('runtime-skill-detail-success.json')

/** 摘要行基准（fixture 真形状）；用例只改需要改的键。 */
function presetRow(overrides: JsonObject = {}): JsonObject {
  return { ...PRESET_SUMMARY, ...overrides }
}

function dependency(overrides: JsonObject = {}): JsonObject {
  return { kind: 'skill', id: 'code-review', mode: 'latest', required: true, ...overrides }
}

describe.skipIf(!HAS_CONTRACTS)('企业配方 dependencies 解码（契约切片 B）', () => {
  it('解出契约正例 fixture：混排 3 条（skill latest / skill pinned / plugin latest）', () => {
    const [preset] = decodeEnterprisePresets([PRESET_SUMMARY])
    expect(preset?.dependencies).toHaveLength(3)
    expect(preset?.dependencies.map(item => [item.kind, item.mode, item.required])).toEqual([
      ['skill', 'latest', true],
      ['skill', 'pinned', false],
      ['plugin', 'latest', false],
    ])
    // pinned 带出雪花；latest 不产出 versionId 键（界面据此不渲染钉版本，不是空串占位）。
    expect(preset?.dependencies[1]?.versionId).toBe('1901500000000000902')
    expect('versionId' in (preset?.dependencies[0] ?? {})).toBe(false)
    expect('versionId' in (preset?.dependencies[2] ?? {})).toBe(false)
  })

  it('解出详情 fixture（详情经 allOf 继承同一字段，走同一份解码）', () => {
    const [preset] = decodeEnterprisePresets([PRESET_DETAIL])
    expect(preset?.dependencies.map(item => [item.kind, item.mode])).toEqual([
      ['skill', 'pinned'],
      ['plugin', 'latest'],
    ])
    expect(preset?.versionId).toBe('1901500000000000101')
  })

  it('空数组解成空数组（契约：无引用即空数组）', () => {
    const [preset] = decodeEnterprisePresets([presetRow({ dependencies: [] })])
    expect(preset?.dependencies).toEqual([])
  })

  it('单条 pinned 带 versionId、单条 latest 不带', () => {
    const [pinned] = decodeEnterprisePresets([presetRow({
      dependencies: [dependency({ mode: 'pinned', versionId: '1901500000000000902' })],
    })])
    expect(pinned?.dependencies).toEqual([
      { kind: 'skill', id: 'code-review', mode: 'pinned', versionId: '1901500000000000902', required: true },
    ])
    const [latest] = decodeEnterprisePresets([presetRow({ dependencies: [dependency()] })])
    expect(latest?.dependencies).toEqual([
      { kind: 'skill', id: 'code-review', mode: 'latest', required: true },
    ])
  })

  it('契约没写条件约束的两条刻意不加严：pinned 缺 versionId、latest 带 versionId 都照旧解出', () => {
    // 契约没有"pinned 必带 versionId"（PresetDependency.required 里没有它），员工端自己补一条就是加严；
    // 加严正是三起契约漂移事故的同一病因，所以这里把"不加严"本身钉成用例。
    const [withoutVersion] = decodeEnterprisePresets([presetRow({
      dependencies: [dependency({ mode: 'pinned' })],
    })])
    expect(withoutVersion?.dependencies[0]?.versionId).toBeUndefined()
    const [withVersion] = decodeEnterprisePresets([presetRow({
      dependencies: [dependency({ mode: 'latest', versionId: '1901500000000000902' })],
    })])
    expect(withVersion?.dependencies[0]?.versionId).toBe('1901500000000000902')
  })

  it('恰好 200 条解出、201 条按稳定码整条失败（不静默截断）', () => {
    const many = (count: number): JsonObject[] => Array.from({ length: count }, (_, index) => dependency({
      kind: index % 2 === 0 ? 'skill' : 'plugin',
      id: `entry-${index}`,
      required: index % 2 === 0,
    }))
    const [full] = decodeEnterprisePresets([presetRow({ dependencies: many(200) })])
    expect(full?.dependencies).toHaveLength(200)
    expectInvalid(() => decodeEnterprisePresets([presetRow({ dependencies: many(201) })]))
  })

  it('【先发 plugin 场景】旧服务端不发 dependencies ⇒ 列表与详情都照旧解码成功（该键缺席、不补空数组）', () => {
    const legacy = { ...PRESET_DETAIL }
    delete legacy['dependencies']
    const [preset] = decodeEnterprisePresets([legacy])
    expect(preset?.presetId).toBe('weekly-digest')
    // 关键语义：缺席保持缺席。"读不到"与"确实没有引用"必须可区分，界面据此分别说
    // 「暂时无法读取包含内容」与「不包含任何内容」，不把读不到说成没有（照 category/whenToUse 的归一策略）。
    expect(preset !== undefined && 'dependencies' in preset).toBe(false)
    // 列表行（旧服务端）同样必须解出。
    const legacySummary = { ...PRESET_SUMMARY }
    delete legacySummary['dependencies']
    const [summaryRow] = decodeEnterprisePresets([legacySummary])
    expect(summaryRow !== undefined && 'dependencies' in summaryRow).toBe(false)
  })

  it('契约负例 fixture（kind=connector）被整条拒绝', () => {
    expectInvalid(() => decodeEnterprisePresets([PRESET_UNKNOWN_KIND]))
  })

  it('kind / mode / required / id / versionId 非法一律整条失败', () => {
    const invalidDependencies: JsonObject[][] = [
      [dependency({ kind: 'connector' })],
      [dependency({ kind: null })],
      [dependency({ kind: 'SKILL' })],
      [dependency({ mode: 'newest' })],
      [dependency({ required: 'true' })],
      [dependency({ required: 1 })],
      [dependency({ id: '' })],
      [dependency({ id: 'x'.repeat(215) })],
      [dependency({ versionId: 'abc' })],
      [dependency({ versionId: 123 })],
      // 契约留位键也在白名单里，但形状照样要过关。
      [dependency({ resolvedVersionId: 'abc' })],
    ]
    for (const dependencies of invalidDependencies) {
      expectInvalid(() => decodeEnterprisePresets([presetRow({ dependencies })]))
    }
    // 缺 kind / 缺 required 由关闭键集一并挡下。
    expectInvalid(() => decodeEnterprisePresets([presetRow({
      dependencies: [{ id: 'code-review', mode: 'latest', required: true }],
    })]))
    expectInvalid(() => decodeEnterprisePresets([presetRow({
      dependencies: [{ kind: 'skill', id: 'code-review', mode: 'latest' }],
    })]))
  })

  it('依赖项多一个未声明键、或 dependencies 不是数组，一律整条失败', () => {
    expectInvalid(() => decodeEnterprisePresets([presetRow({
      dependencies: [dependency({ artifactPath: 'presets/x.tgz' })],
    })]))
    expectInvalid(() => decodeEnterprisePresets([presetRow({
      dependencies: [dependency({ downloadPath: '/presets/1/download' })],
    })]))
    for (const dependencies of [null, 'x', 7, {}, [null], ['x']]) {
      expectInvalid(() => decodeEnterprisePresets([presetRow({ dependencies })]))
    }
  })

  it('契约留位键 resolvedVersionId：形状合法时接受（但按既有策略不投影）', () => {
    const [preset] = decodeEnterprisePresets([presetRow({
      dependencies: [dependency({ resolvedVersionId: '1901500000000000902' })],
    })])
    expect(preset?.dependencies[0]).toEqual({ kind: 'skill', id: 'code-review', mode: 'latest', required: true })
  })
})

describe.skipIf(!HAS_CONTRACTS)('契约漂移防线：runtime 解码器白名单键集 == 契约声明键集', () => {
  /** 契约 union：列表与详情共用一份解码，白名单因此是两份 schema 的并集。 */
  const presetContract: ContractKeySet = {
    declared: [...new Set([
      ...contractKeySet('RuntimePresetSummary').declared,
      ...contractKeySet('RuntimePresetDetail').declared,
    ])],
    required: [...new Set([
      ...contractKeySet('RuntimePresetSummary').required,
      ...contractKeySet('RuntimePresetDetail').required,
    ])],
  }

  it('配方行解码器键集（字面比对）== RuntimePresetSummary ∪ RuntimePresetDetail', () => {
    const decoderKeys = [...ENTERPRISE_PRESET_ROW_REQUIRED_KEYS, ...ENTERPRISE_PRESET_ROW_OPTIONAL_KEYS]
    expect([...decoderKeys].sort()).toEqual([...presetContract.declared].sort())
    // 契约真源自检：并集恰好是一个列表行 + 详情专有的 versionId/sha256。
    expect(presetContract.declared.filter(key => !contractKeySet('RuntimePresetSummary').declared.includes(key)).sort())
      .toEqual(['sha256', 'versionId'])
  })

  it('白名单"不能多"（行为复核）：未声明键塞进真 fixture 行必须整条拒绝', () => {
    const undeclared = UNDECLARED_PROBES.filter(key => presetContract.declared.includes(key))
    expect(undeclared).toEqual([])
    const accepted = acceptedKeys(
      row => decodeEnterprisePresets([row]),
      PRESET_DETAIL,
      [...declareProbes('RuntimePresetDetail', PRESET_DETAIL), ...UNDECLARED_PROBES.map(key => ({ key, value: 'probe' }))],
    )
    expect([...accepted].sort()).toEqual([...presetContract.declared].sort())
  })

  it('白名单"不能少"（行为复核）：契约每个键都在真 fixture 行上被接受', () => {
    const accepted = acceptedKeys(
      row => decodeEnterprisePresets([row]),
      PRESET_DETAIL,
      declareProbes('RuntimePresetDetail', PRESET_DETAIL),
    )
    expect([...accepted].sort()).toEqual([...presetContract.declared].sort())
  })

  it('必填/可选错位是显式的三处：dependencies（先发 plugin）+ 详情专有的 versionId/sha256', () => {
    const decoderRequired = new Set<string>(ENTERPRISE_PRESET_ROW_REQUIRED_KEYS)
    const contractRequired = new Set(presetContract.required)
    expect([...contractRequired].filter(key => !decoderRequired.has(key)).sort())
      .toEqual(['dependencies', 'sha256', 'versionId'])
    // 反向也必须为空：解码器的必填键不能有契约没标的（那就是员工端自己加严）。
    expect([...decoderRequired].filter(key => !contractRequired.has(key))).toEqual([])
  })

  it('单条引用解码器键集 == 契约 PresetDependency（含留位键 resolvedVersionId）', () => {
    const contract = contractKeySet('PresetDependency')
    const decoderKeys = [...ENTERPRISE_PRESET_DEPENDENCY_KEYS, ...ENTERPRISE_PRESET_DEPENDENCY_OPTIONAL_KEYS]
    expect([...decoderKeys].sort()).toEqual([...contract.declared].sort())
    expect([...new Set(ENTERPRISE_PRESET_DEPENDENCY_KEYS)].sort())
      .toEqual([...contract.required].sort())
    const base = (PRESET_DETAIL['dependencies'] as JsonObject[])[0]!
    const accepted = acceptedKeys(
      row => decodeEnterprisePresets([{ ...PRESET_DETAIL, dependencies: [row] }]),
      base,
      [...declareProbes('PresetDependency', base), ...UNDECLARED_PROBES.map(key => ({ key, value: 'probe' }))],
    )
    expect([...accepted].sort()).toEqual([...contract.declared].sort())
  })

  it('技能详情解码器键集 == 契约 RuntimeSkillDetail（行为等价）', () => {
    const contract = contractKeySet('RuntimeSkillDetail')
    const accepted = acceptedKeys(
      row => decodeEnterpriseSkillDetail(row),
      SKILL_DETAIL,
      [...declareProbes('RuntimeSkillDetail', SKILL_DETAIL), ...UNDECLARED_PROBES.map(key => ({ key, value: 'probe' }))],
    )
    expect([...accepted].sort()).toEqual([...contract.declared].sort())
  })

  it('技能列表解码器键集 == 契约 RuntimeSkillSummary（行为等价）', () => {
    const summary = contractKeySet('RuntimeSkillSummary')
    const detail = contractKeySet('RuntimeSkillDetail')
    // 契约结构自检：详情比摘要恰好多 versionId/sha256/skills，下面的行为断言据此成立。
    expect(detail.declared.filter(key => !summary.declared.includes(key)).sort())
      .toEqual(['sha256', 'skills', 'versionId'])
    const base: JsonObject = Object.fromEntries(
      Object.entries(SKILL_DETAIL).filter(([key]) => summary.declared.includes(key)),
    )
    const accepted = acceptedKeys(
      row => decodeEnterpriseSkills([row]),
      base,
      [
        ...declareProbes('RuntimeSkillSummary', base),
        // 详情专有键用详情 fixture 的**真值**回填：拒绝必须是因为"键不在列表白名单里"，而不是值不合法。
        ...['versionId', 'sha256', 'skills'].map(key => ({ key, value: SKILL_DETAIL[key] })),
        ...UNDECLARED_PROBES.map(key => ({ key, value: 'probe' })),
      ],
    )
    expect([...accepted].sort()).toEqual([...summary.declared].sort())
  })

  it('真 fixture 逐条解码：值判定漂移（如配方 sizeBytes 判定写反）也会在这里红', () => {
    // 键集比对看不见"值判定写反"；这条用手写真假体掩盖不了的真 fixture 把它钉住：
    // 三起事故的第一起（sizeBytes 反向判定 ⇒ 列表恒失败）在本行就会被拒。
    const presets = decodeEnterprisePresets([PRESET_SUMMARY, PRESET_DETAIL])
    expect(presets.map(preset => preset.sizeBytes)).toEqual([16384, 20480])
    const summaryKeys = contractKeySet('RuntimeSkillSummary').declared
    const summaryRow: JsonObject = Object.fromEntries(
      Object.entries(SKILL_DETAIL).filter(([key]) => summaryKeys.includes(key)),
    )
    expect(decodeEnterpriseSkills([summaryRow])[0]?.sizeBytes).toBe(40960)
    expect(decodeEnterpriseSkillDetail(SKILL_DETAIL).skillCount).toBe(2)
  })
})
