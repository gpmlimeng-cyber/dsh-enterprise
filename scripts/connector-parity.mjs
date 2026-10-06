#!/usr/bin/env node
/**
 * [INPUT]: 读仓内两处真源文件——宿主侧内核 `plugin/packages/bundle/src/connector/{capability,bundle}.ts` 与
 *          服务端闸门 `server/.../connector/application/ConnectorDescriptorGate.java`（+ `domain/ConnectorEntry.java`）。
 * [OUTPUT]: 逐项比对**同一套规则的两次落地**是否仍是同一把尺（词表 / 必需字段 / 关闭键集 / 层级自贴判据 /
 *           明文键名正则 / 三枚形状正则），一致才返回 0；不一致逐项打印两侧原文与差异并返回 1。
 * [POS]: scripts 的**跨语言一致性静态门禁**。连接器纵深刻意做了双实现（宿主内核保护"本机生成的 bundle"，
 *        服务端闸门保护"库里那一行 + 下发给所有员工的目录"，两者输入来源不同、不能互相代替），
 *        代价就是**可能漂移** —— 第二十二刀就是靠这份比对抓到一次真实漂移（层级自贴：宿主按"键名含 level/
 *        permission/tier"判，服务端按"精确相等"判 ⇒ 同一份声明两侧给出**不同的稳定码**）。不需要 JVM/DB，
 *        因此在这台机器上也能跑；建议在连接器接线进 CI 时挂到 plugin-check 之后。
 * [PROTOCOL]: 变更时更新此头部，然后检查 scripts/CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TS_DIR = resolve(ROOT, 'plugin/packages/bundle/src/connector')
const JAVA_DIR = resolve(ROOT, 'server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/connector')

const capabilityTs = readFileSync(resolve(TS_DIR, 'capability.ts'), 'utf8')
const bundleTs = readFileSync(resolve(TS_DIR, 'bundle.ts'), 'utf8')
const gateJava = readFileSync(resolve(JAVA_DIR, 'application/ConnectorDescriptorGate.java'), 'utf8')
const entryJava = readFileSync(resolve(JAVA_DIR, 'domain/ConnectorEntry.java'), 'utf8')

/** 取 TS 的 `export const X = [...] as const`，并解析 `...OTHER` 展开（第二十二刀踩过：不展开会误报差异）。 */
function tsArray(source, name) {
  const block = (source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`)) ??
    source.match(new RegExp(`const ${name}(?::[^=]+)? = \\[([\\s\\S]*?)\\n\\]`)))?.[1]
  if (block === undefined) return undefined
  const literals = [...block.matchAll(/'([^']+)'/g)].map(match => match[1])
  const spreads = [...block.matchAll(/\.\.\.([A-Z_]+)/g)].map(match => match[1])
  const resolved = spreads.flatMap(spread => tsArray(source, spread) ?? [])
  return [...literals, ...resolved]
}

const javaLiterals = (source, name) => {
  const block = source.match(new RegExp(`${name} = (?:List\\.of|Set\\.of)\\(([\\s\\S]*?)\\);`))?.[1]
  return block === undefined ? undefined : [...block.matchAll(/"([^"]+)"/g)].map(match => match[1])
}

/** 把两种写法的正则归一化到可比形态（去掉 TS 的 `/`，把 `\d` 统一、去掉 Java 的 `(?i)` 位置差异）。 */
const normalizePattern = value => {
  if (value === undefined) return undefined
  let body = value
  let flags = ''
  // TS 字面量 `/body/flags`
  const literal = value.match(/^\/(.*)\/([a-z]*)$/)
  if (literal !== null) {
    body = literal[1]
    flags = literal[2]
  }
  // Java 风格 `(?i)body`
  const inline = body.match(/^\(\?([a-z]+)\)(.*)$/)
  if (inline !== null) {
    flags += inline[1]
    body = inline[2]
  }
  let normalized = body.replace(/\\d/g, '0-9').replace(/\(\?:/g, '(')
  // 去掉"整段被一对括号包住"的冗余外壳：`(?i)a|b` 与 `(?i)(a|b)` 在本用途（`find`/`test` 的"包含即命中"）
  // 下完全等价 —— 只在这一对括号恰好首尾配对时才剥，避免把 `(a)|b` 这种真差异也抹平。
  while (normalized.startsWith('(') && normalized.endsWith(')')) {
    let depth = 0
    let closesAtEnd = false
    for (let index = 0; index < normalized.length; index += 1) {
      if (normalized[index] === '(') depth += 1
      else if (normalized[index] === ')') {
        depth -= 1
        if (depth === 0) { closesAtEnd = index === normalized.length - 1; break }
      }
    }
    if (!closesAtEnd) break
    normalized = normalized.slice(1, -1)
  }
  return (flags.includes('i') ? '(?i)' : '') + normalized
}

const sameSet = (left, right) =>
  left !== undefined && right !== undefined && left.length === right.length &&
  [...left].sort().join('\u0000') === [...right].sort().join('\u0000')

const results = []
const check = (label, left, right, compare = sameSet, extra = '') => {
  const ok = compare(left, right)
  results.push({ label, ok, extra })
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    console.log(`    宿主侧: ${JSON.stringify(left)}`)
    console.log(`    服务端: ${JSON.stringify(right)}`)
  }
  return ok
}

const javaTransports = [...entryJava.matchAll(/^\s{8}([A-Z][A-Z0-9_]+)\("([a-z0-9-]+)"\)/gm)].map(match => match[2])

check('传输词表（九枚，宿主小写线值 ↔ Java 枚举的 wireValue）',
  tsArray(capabilityTs, 'CONNECTOR_TRANSPORTS'), javaTransports)
check('能力声明的必填九枚',
  tsArray(capabilityTs, 'CONNECTOR_REQUIRED_DECLARATION_FIELDS'), javaLiterals(gateJava, 'REQUIRED_CAPABILITY_FIELDS'))
check('认得的声明键（关闭键集；TS 侧会展开 spread）',
  tsArray(capabilityTs, 'DECLARATION_KEYS'),
  javaLiterals(gateJava, 'CAPABILITY_KEYS'))
// ★ 第二十三刀补：这一组是"规则**覆盖**"比对 —— 起初本闸门只查 `effects` 是不是非空数组，其余取值域
// 一个都没查（宿主那边一直都查），于是服务端能存进没人能求值的声明。现在两侧词表逐一比对。
for (const [label, tsName, javaName] of [
  ['effects 词表', 'CONNECTOR_EFFECTS', 'EFFECTS'],
  ['reversibility 词表', 'CONNECTOR_REVERSIBILITIES', 'REVERSIBILITIES'],
  ['blastRadius 词表', 'CONNECTOR_BLAST_RADII', 'BLAST_RADII'],
  ['inbound 词表', 'CONNECTOR_INBOUNDS', 'INBOUNDS'],
  ['discovery 词表', 'CONNECTOR_DISCOVERIES', 'DISCOVERIES'],
  ['stateAddress.kind 词表', 'CONNECTOR_STATE_ADDRESS_KINDS', 'STATE_ADDRESS_KINDS'],
  ['宿主平台词表', 'CONNECTOR_HOST_PLATFORMS', 'HOST_PLATFORMS'],
  ['平台三态词表', 'CONNECTOR_PLATFORM_SUPPORTS', 'PLATFORM_SUPPORTS'],
]) {
  check(label, tsArray(capabilityTs, tsName), javaLiterals(gateJava, javaName))
}

check('明文键名正则（值/密钥/令牌…）',
  normalizePattern(bundleTs.match(/if \((\/[^/]+\/[a-z]*)\.test\(key\)\)/)?.[1]),
  normalizePattern(gateJava.match(/SECRET_ISH_KEY = Pattern\.compile\("([^"]+)"\)/)?.[1]))
check('自贴层级的键判据（第二十二刀抓到的漂移点）',
  normalizePattern(capabilityTs.match(/LEVEL_CLAIM_PATTERN = (\/[^/]+\/[a-z]*)/)?.[1]),
  normalizePattern(gateJava.match(/LEVEL_CLAIM = Pattern\.compile\("([^"]+)"\)/)?.[1]))
for (const [label, javaName] of [['CREDENTIAL_KEY', 'CREDENTIAL_KEY'], ['ENV_NAME', 'ENV_NAME'], ['HEADER_NAME', 'HEADER_NAME']]) {
  const tsName = label === 'CREDENTIAL_KEY' ? 'CONNECTOR_CREDENTIAL_KEY_PATTERN' : `${label}_PATTERN`
  const tsSource = capabilityTs + bundleTs
  check(`${label} 形状正则`,
    normalizePattern(tsSource.match(new RegExp(`${tsName} = (\\/[^/]+\\/)`))?.[1]),
    normalizePattern(gateJava.match(new RegExp(`${javaName} = Pattern\\.compile\\("([^"]+)"\\)`))?.[1]))
}

// ★ 第二十六刀补：**数值上限**也逐一比对 —— 上限是最爱悄悄漂移的一类（改一侧忘另一侧，
// 两侧就变成"一个收一个拒"）。只比两侧都有**具名常量**的那些；Java 侧仍用字面量的（connectorId/
// capabilityId 的 64）由 §7 的人工对照表覆盖。
const tsNumber = (source, name) => {
  const value = source.match(new RegExp(`const ${name} = (\\d+)`))?.[1]
  return value === undefined ? undefined : Number(value)
}
const javaNumber = (source, name) => {
  const value = source.match(new RegExp(`static final int ${name} = (\\d+);`))?.[1]
  return value === undefined ? undefined : Number(value)
}
const LIMITS = [
  ['MAX_TITLE', 'MAX_TITLE_LENGTH', capabilityTs],
  ['MAX_SUMMARY', 'MAX_SUMMARY_LENGTH', capabilityTs],
  ['MAX_STATE_PATH', 'MAX_STATE_PATH_LENGTH', capabilityTs],
  ['MAX_EGRESS_ENTRIES', 'MAX_EGRESS_ENTRIES', capabilityTs],
  ['MAX_AUDIT_EVENTS', 'MAX_AUDIT_EVENTS', capabilityTs],
  ['MAX_CONNECTOR_ID', 'MAX_CONNECTOR_ID_LENGTH', bundleTs],
  ['MAX_CAPABILITY_ID', 'MAX_CAPABILITY_ID_LENGTH', capabilityTs],
  ['MAX_DISPLAY_NAME', 'MAX_DISPLAY_NAME_LENGTH', bundleTs],
  ['MAX_COMMAND', 'MAX_COMMAND_LENGTH', bundleTs],
  ['MAX_URL', 'MAX_URL_LENGTH', bundleTs],
  ['MAX_ARGS', 'MAX_ARGS', bundleTs],
  ['MAX_ARG', 'MAX_ARG_LENGTH', bundleTs],
  ['MAX_REFS', 'MAX_REFS', bundleTs],
]
for (const [javaName, tsName, source] of LIMITS) {
  check(`数值上限 ${tsName}`, tsNumber(source, tsName), javaNumber(gateJava, javaName), (left, right) => left === right)
}

const failed = results.filter(result => !result.ok)
console.log(`\n比对 ${results.length} 项，通过 ${results.length - failed.length} 项`)
if (failed.length > 0) {
  console.error(`跨语言漂移：${failed.map(result => result.label).join('、')}`)
  process.exitCode = 1
}
