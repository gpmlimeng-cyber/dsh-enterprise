/**
 * [INPUT]: 只依赖本包的 `EnterpriseSkillInstallError`；**零第三方解析器**（全仓没有可复用的 YAML 实现，见 [POS]）
 * [OUTPUT]: 对外提供 `parseSkillFrontmatter(bytes)`（把 `SKILL.md` 的 `---` 块解成五个字段 + 未知键清单，失败抛稳定码）与 `validateSkillFrontmatter(bytes, label?)`（判定闸门，成功回事实）
 * [POS]: bundle 技能纵深的**正文闸门**（真源 `docs/plan/skill-install-sources.md` §D.4）——本机安装没有服务端验包，而服务端 `SkillArtifactInspector.java:167-202` 是**整包拒绝级**的 frontmatter 校验，本文件就是那条规则在客户端的同一份实现（D4-1…D4-8 全做、D4-10 容忍未知键并回清单）。**为什么不复用**：`preset/bundle.ts:263-374` 那套是面向 `agent.cordis.yml` 的保守文本子集映射（自述「不是 YAML 语义权威」），且**未知键即拒**，与 D4-10 的「容忍但不透传」正好相反；`plugin/node_modules` 里没有 `yaml`/`js-yaml`，而本刀**不许新增依赖** ⇒ 按 §D4-3 的建议自写「与解析器无关的键扫描 + 只认保守子集的取值解码」，**任一不认识的形式一律 fail-closed 拒**（客户端只允许比服务端更严，绝不允许更松）。本文件不求值任何内容：不解 `!!js`、不碰自定义 tag、不做对象反序列化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterpriseSkillInstallError } from './skill-errors.js'

/** `name` 上限（与服务端 `requiredSkillText(data, "name", path, 64)` 逐字同值）。 */
const MAX_NAME_LENGTH = 64
/** `description` 上限（服务端 1024）。 */
const MAX_DESCRIPTION_LENGTH = 1024
/** `whenToUse` 上限（服务端 2048）。 */
const MAX_WHEN_TO_USE_LENGTH = 2048
/** 官方 `dsh-skill` 的技能名正则（与服务端 `SKILL_NAME` 逐字一致）。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 官方**明确拒收**的旧字段名 → 改名建议（与服务端 `LEGACY_FIELDS`（`SkillArtifactInspector.java:49-53`）逐字同源）。
 *
 * 服务端对它们是「含即拒」，因此这里也必须在**取值之前**判，且错误文案必须带改名建议（D4-8）。
 */
const LEGACY_FIELDS: readonly (readonly [string, string])[] = [
  ['modelInvocable', 'disable-model-invocation'],
  ['userInvocable', 'user-invocable'],
  ['disableModelInvocation', 'disable-model-invocation'],
]

/** 服务端按名读取的五个键；其余一律进 `unknownKeys`（D4-10「容忍但不透传」）。 */
const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'description',
  'whenToUse',
  'disable-model-invocation',
  'user-invocable',
])

/** 顶层映射的一行取值：块标量的指示符（`|`/`>`，可带缩进数字与 chomping 符号）。 */
const BLOCK_SCALAR_PATTERN = /^([|>])([0-9]?)([+-]?)$/
/** 顶层映射的一个键（YAML 的 plain key 不能含 `: `，这里按「非空白起头、到冒号止」收窄）。 */
const MAPPING_KEY_PATTERN = /^([^\s#][^:]*?)\s*:(?:\s|$)/
/** SnakeYAML 1.1 的布尔字面量（`y`/`n` **不在**其中，故意不认：认了就会比服务端更松）。 */
const YAML_BOOLEAN_PATTERN = /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/
/** SnakeYAML 1.1 的整数形态（十进制/下划线/十六进制/二进制/八进制/六十进制）。 */
const YAML_INTEGER_PATTERN = /^[-+]?(?:0b[01_]+|0x[0-9a-fA-F_]+|0o?[0-7_]+|(?:0|[1-9][0-9_]*)|[1-9][0-9_]*(?::[0-5]?[0-9])+)$/
/** SnakeYAML 1.1 的浮点形态（含 `.inf`/`.nan` 家族）。 */
const YAML_FLOAT_PATTERN = /^[-+]?(?:\.[0-9]+|[0-9][0-9_]*(?:\.[0-9_]*)?)(?:[eE][-+]?[0-9]+)?$|^[-+]?\.(?:inf|Inf|INF|nan|NaN|NAN)$/
/** SnakeYAML 1.1 的时间戳形态（隐式解析成 `java.util.Date` ⇒ **不是** String）。 */
const YAML_TIMESTAMP_PATTERN = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt ].*)?$/
/** 其余隐式非字符串标量（`=` 的 value tag、`<<` 的 merge key）。 */
const YAML_OTHER_SCALARS: readonly string[] = ['=', '<<']
/** 行首这些字符在 YAML 里都是**指示符**：出现在取值开头即本文件不支持的形式（fail-closed）。 */
const UNSUPPORTED_VALUE_PREFIXES: readonly string[] = ['{', '[', '&', '*', '!', '%', '@', '`']

/** 一个顶层键解出来的 YAML 取值：只区分「字符串 / 布尔 / 整数 / null / 其它」。 */
type FrontmatterValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'integer'; readonly value: number }
  | { readonly kind: 'null' }
  /** 非上述四种（映射/序列/浮点/时间戳/锚点/别名/标签…）：已知键遇到它一律按「必须是字符串」拒。 */
  | { readonly kind: 'other' }

/** `SKILL.md` frontmatter 的判定事实（服务端 `SkillEntry` 的四个分量 + 未知键留痕）。 */
export interface SkillFrontmatterFacts {
  /** 必填 kebab-case ≤64。 */
  readonly name: string
  /** 必填非空白 ≤1024。 */
  readonly description: string
  /** 可选 ≤2048（缺席即 undefined）。 */
  readonly whenToUse?: string
  /** `disable-model-invocation`（缺席与显式 null 都是 false，照服务端 `booleanField`）。 */
  readonly disableModelInvocation: boolean
  /** `user-invocable`（**缺席**才是 true；显式 null 是 false，照服务端 `data.containsKey` 判法）。 */
  readonly userInvocable: boolean
  /** 顶层出现但我们不认识的键（D4-10：容忍但不透传，只留痕）。 */
  readonly unknownKeys: readonly string[]
}

/** 本文件所有失败都收敛到同一枚稳定码（§D.4 的处置列：`ENT_SKILL_SKILLMD_INVALID`(400)）。 */
function invalid(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_SKILLMD_INVALID', message)
}

/**
 * 提取 `---` 起止的 frontmatter 块（与服务端 `extractFrontmatter`（`SkillArtifactInspector.java:204-214`）逐行同判定）。
 *
 * 服务端口径：去前导 BOM → 取**第一个** `---`，且它之前必须全是空白（否则「缺少 frontmatter」）→
 * 其后第一行起、到**第一个** `\n---` 之前（含那个换行）为块正文；找不到 `\n---` 即「未闭合」。
 * 官方运行时在缺 frontmatter 时只忽略该文件，**我们升级为整包拒绝**（与 D4-1 的处置一致）。
 */
function extractFrontmatterBlock(text: string): string {
  const normalized = text.startsWith('\uFEFF') ? text.slice(1) : text
  const start = normalized.indexOf('---')
  if (start < 0 || normalized.slice(0, start).trim() !== '') throw invalid('SKILL.md 缺少 YAML frontmatter')
  const lineStart = normalized.indexOf('\n', start)
  if (lineStart < 0) throw invalid('SKILL.md frontmatter 未闭合')
  const end = normalized.indexOf('\n---', lineStart)
  if (end < 0) throw invalid('SKILL.md frontmatter 未闭合')
  return normalized.slice(lineStart + 1, end + 1)
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#')
}

/** 前导空白宽度；出现制表符缩进即拒（YAML 禁止用制表符缩进，服务端解析器会直接报错）。 */
function indentationOf(line: string): number {
  const width = line.length - line.trimStart().length
  if (line.slice(0, width).includes('\t')) throw invalid('SKILL.md frontmatter 的缩进不能使用制表符')
  return width
}

/** 顶层映射的一个键：键名、行内取值原文与随后的块行（缩进深于本键的全部行，含空行/注释行）。 */
interface RawEntry {
  readonly key: string
  readonly inline: string
  readonly block: readonly string[]
  /** 该键所在映射的缩进（顶层键恒为 0；序列项里的键是项自身的缩进）。 */
  readonly indent: number
}

/** 同一映射内「同缩进同键」的作用域栈：用于与服务端 `allowDuplicateKeys=false` 对齐地拒重复键。 */
interface KeyScope {
  readonly indent: number
  readonly keys: Set<string>
}

/**
 * 扫一遍块正文：收集**顶层**键及其块行，并在所有映射作用域里拒重复键（D4-3）。
 *
 * 扫法（保守子集，不认识的形式一律拒而不是猜）：
 *  · 空行/整行注释跳过；缩进用制表符即拒；
 *  · 行首 `- ` 是序列项（顶层出现即「不是映射」；嵌套出现即开一个**新的**映射作用域 ——
 *    `- x: 1` 连续两项不算重复键，这与 YAML 语义一致）；
 *  · 其余必须匹配 `键:` 形状，否则拒（例如多行 plain 标量的续行，本文件按「不支持」拒，
 *    这正是「客户端只允许更严」的那一类，服务端 libyaml 会把它折成一行）；
 *  · 某个键的行内取值是块标量指示符（`|`/`>` 系）时，其后缩进更深的行整段算标量正文，不再当键扫。
 *
 * @param block - frontmatter 块正文（含末尾换行）。
 * @returns 顶层键的顺序化原文条目（块行已收进各自的 `block`）。
 */
function scanEntries(block: string): readonly RawEntry[] {
  const lines = block.split('\n').map(line => (line.endsWith('\r') ? line.slice(0, -1) : line))
  const scopes: KeyScope[] = []
  const entries: RawEntry[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (isBlankOrComment(line)) {
      index += 1
      continue
    }
    const indent = indentationOf(line)
    const rest = line.slice(indent)
    const sequenceEntry = rest === '-' || rest.startsWith('- ')
    // 顶层出现序列项 ⇒ 根是**列表**而不是映射（服务端 `!(loaded instanceof Map)` 同样拒）。
    if (sequenceEntry && indent === 0) throw invalid('SKILL.md frontmatter 必须是键值映射')
    const item = sequenceEntry ? rest.slice(1).replace(/^[ \t]+/, '') : rest
    const keyIndent = sequenceEntry ? indent + 2 : indent
    if (item === '') {
      // 裸 `-`（序列项名下没有键）：本文件不认这种取值形状。
      throw invalid('SKILL.md frontmatter 使用了不支持的 YAML 结构')
    }
    const match = MAPPING_KEY_PATTERN.exec(item)
    if (match === null) {
      // 顶层出现非键行 = 根不是映射（`- x` 的序列、多行 plain 标量的续行都归这里）⇒ 拒；
      // 嵌套里出现非键行（如未知键下的 `- x` 序列项）按 D4-10 容忍：服务端只按名取顶层五个键。
      if (indent === 0) throw invalid('SKILL.md frontmatter 必须是键值映射')
      index += 1
      continue
    }
    const key = match[1]!
    // 重复键：同一映射作用域里同缩进同键即拒（服务端 `LoaderOptions.setAllowDuplicateKeys(false)`）。
    if (sequenceEntry) {
      while (scopes.length > 0 && scopes[scopes.length - 1]!.indent >= keyIndent) scopes.pop()
      scopes.push({ indent: keyIndent, keys: new Set([key]) })
    } else {
      while (scopes.length > 0 && scopes[scopes.length - 1]!.indent > keyIndent) scopes.pop()
      const scope = scopes.length > 0 ? scopes[scopes.length - 1]! : undefined
      if (scope !== undefined && scope.indent === keyIndent) {
        if (scope.keys.has(key)) throw invalid(`SKILL.md frontmatter 存在重复键 "${key}"`)
        scope.keys.add(key)
      } else {
        scopes.push({ indent: keyIndent, keys: new Set([key]) })
      }
    }
    const inline = item.slice(match[0].length)
    const collectionStart = index + 1
    let cursor = collectionStart
    while (cursor < lines.length) {
      const candidate = lines[cursor]!
      if (isBlankOrComment(candidate)) {
        cursor += 1
        continue
      }
      if (indentationOf(candidate) <= keyIndent) break
      cursor += 1
    }
    const blockLines = lines.slice(collectionStart, cursor)
    // 顶层条目才进取值判定：嵌套映射的键由服务端「按名取五个」天然看不见（D4-10 的容忍）。
    if (indent === 0) entries.push({ key, inline, block: blockLines, indent: 0 })
    // 块标量的正文不是键：整段跳过上面的作用域扫描（下一条同缩进行才是下一个键）。
    index = BLOCK_SCALAR_PATTERN.test(inline.trim()) ? cursor : index + 1
  }
  return entries
}

/** 去掉 plain 标量尾部注释：YAML 要求 `#` 前有空白，故只找「空白 + #」。 */
function stripPlainComment(text: string): string {
  const match = /\s#/.exec(text)
  return (match === null ? text : text.slice(0, match.index)).trim()
}

/** 解双引号标量（只认标准转义；遇到不认识的转义即拒，绝不静默丢字符）。 */
function decodeDoubleQuoted(text: string): FrontmatterValue {
  let value = ''
  let index = 1
  while (index < text.length) {
    const character = text[index]!
    if (character === '"') {
      const rest = text.slice(index + 1).trim()
      if (rest !== '' && !rest.startsWith('#')) throw invalid('SKILL.md frontmatter 的引号标量尾部有多余内容')
      return { kind: 'string', value }
    }
    if (character !== '\\') {
      value += character
      index += 1
      continue
    }
    const escape = text[index + 1]
    if (escape === undefined) throw invalid('SKILL.md frontmatter 的引号标量未闭合')
    const simple: Readonly<Record<string, string>> = {
      '0': '\0', a: '\u0007', b: '\b', t: '\t', n: '\n', v: '\u000b', f: '\f', r: '\r', e: '\u001b',
      ' ': ' ', '"': '"', '/': '/', '\\': '\\',
    }
    const replacement = simple[escape]
    if (replacement !== undefined) {
      value += replacement
      index += 2
      continue
    }
    const width = escape === 'u' ? 4 : escape === 'x' ? 2 : escape === 'U' ? 8 : 0
    if (width === 0) throw invalid(`SKILL.md frontmatter 的引号标量使用了不支持的转义 \\${escape}`)
    const digits = text.slice(index + 2, index + 2 + width)
    if (digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) {
      throw invalid('SKILL.md frontmatter 的引号标量转义不完整')
    }
    value += String.fromCodePoint(Number.parseInt(digits, 16))
    index += 2 + width
  }
  throw invalid('SKILL.md frontmatter 的引号标量未闭合')
}

/** 解单引号标量（YAML 的 `''` 是一个字面单引号，没有其它转义）。 */
function decodeSingleQuoted(text: string): FrontmatterValue {
  let value = ''
  let index = 1
  while (index < text.length) {
    const character = text[index]!
    if (character !== "'") {
      value += character
      index += 1
      continue
    }
    if (text[index + 1] === "'") {
      value += "'"
      index += 2
      continue
    }
    const rest = text.slice(index + 1).trim()
    if (rest !== '' && !rest.startsWith('#')) throw invalid('SKILL.md frontmatter 的引号标量尾部有多余内容')
    return { kind: 'string', value }
  }
  throw invalid('SKILL.md frontmatter 的引号标量未闭合')
}

/**
 * 块标量正文：按公共缩进去外壳、去首尾空行；`|` 逐行连接、`>` 折行（空白行成段）。
 *
 * chomping 按 YAML 语义收尾（`-` strip / 缺省 clip / `+` keep 按 clip 处理并记为一处保守偏差）：
 * 这一步不是装饰 —— 服务端 `name: |` 解出来的是带尾换行的 `"name\n"`，kebab 判定会**同样拒**，
 * 因此尾换行必须与 libyaml 对齐，否则两侧对同一个包会给出不同结论。
 */
function decodeBlockScalar(rawLines: readonly string[], folded: boolean, chomping: string): FrontmatterValue {
  const content = rawLines.filter(line => !(line.trim() === ''))
  if (content.length === 0) return { kind: 'string', value: '' }
  const shared = Math.min(...content.map(line => indentationOf(line)))
  const lines = rawLines.map(line => (line.trim() === '' ? '' : line.slice(shared)))
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  let text: string
  if (!folded) {
    text = lines.join('\n')
  } else {
    const foldedLines: string[] = []
    for (const line of lines) {
      if (line === '' || foldedLines.length === 0 || foldedLines[foldedLines.length - 1] === '') foldedLines.push(line)
      else foldedLines[foldedLines.length - 1] += ` ${line}`
    }
    text = foldedLines.join('\n')
  }
  if (chomping === '-' || text === '') return { kind: 'string', value: text }
  return { kind: 'string', value: `${text}\n` }
}

/** 把 plain 标量按 SnakeYAML 1.1 的隐式解析分类；不认识的形态按字符串处理。 */
function classifyPlain(text: string): FrontmatterValue {
  if (text === '' || text === '~' || text === 'null' || text === 'Null' || text === 'NULL') return { kind: 'null' }
  if (YAML_BOOLEAN_PATTERN.test(text)) {
    return { kind: 'boolean', value: /^(?:yes|Yes|YES|true|True|TRUE|on|On|ON)$/.test(text) }
  }
  if (YAML_INTEGER_PATTERN.test(text)) {
    const normalized = text.replace(/_/g, '')
    if (/^[-+]?0x[0-9a-fA-F]+$/.test(normalized)) return { kind: 'integer', value: Number.parseInt(normalized, 16) }
    if (/^[-+]?0b[01]+$/.test(normalized)) return { kind: 'integer', value: Number.parseInt(normalized, 2) }
    if (/^[-+]?0o?[0-7]+$/.test(normalized)) return { kind: 'integer', value: Number.parseInt(normalized.replace(/o/, ''), 8) }
    if (normalized.includes(':')) return { kind: 'other' }
    return { kind: 'integer', value: Number(normalized) }
  }
  if (YAML_FLOAT_PATTERN.test(text) || YAML_TIMESTAMP_PATTERN.test(text) || YAML_OTHER_SCALARS.includes(text)) {
    return { kind: 'other' }
  }
  return { kind: 'string', value: text }
}

/**
 * 解一个键的取值。
 *
 * 形状判定顺序：块标量指示符 → 引号标量 → 行首指示符（flow/锚点/别名/标签一律「不支持」）→ plain 标量。
 * 「行内取值 + 更深的块内容」这种多行 plain 标量本文件**不支持**（服务端会把它折成一行）：
 * 这是「客户端更严」的显式一处，绝不猜折行结果。
 */
function decodeValue(entry: RawEntry): FrontmatterValue {
  const inline = entry.inline.trim()
  const hasBlockContent = entry.block.some(line => !isBlankOrComment(line))
  const indicator = BLOCK_SCALAR_PATTERN.exec(inline)
  if (indicator !== null) return decodeBlockScalar(entry.block, indicator[1] === '>', indicator[3]!)
  if (inline === '') {
    if (hasBlockContent) return { kind: 'other' }
    return { kind: 'null' }
  }
  if (hasBlockContent) throw invalid(`SKILL.md frontmatter 字段 "${entry.key}" 使用了不支持的 YAML 结构`)
  if (inline.startsWith('"')) return decodeDoubleQuoted(inline)
  if (inline.startsWith("'")) return decodeSingleQuoted(inline)
  if (inline.startsWith('|') || inline.startsWith('>')) {
    throw invalid(`SKILL.md frontmatter 字段 "${entry.key}" 的块标量指示符不合法`)
  }
  if (UNSUPPORTED_VALUE_PREFIXES.some(prefix => inline.startsWith(prefix))) {
    throw invalid(`SKILL.md frontmatter 字段 "${entry.key}" 使用了不支持的 YAML 形式`)
  }
  if (inline.startsWith('- ') || inline.startsWith('? ')) {
    throw invalid(`SKILL.md frontmatter 字段 "${entry.key}" 使用了不支持的 YAML 形式`)
  }
  return classifyPlain(stripPlainComment(inline))
}

/** 已知键的字符串取值；null 表示「没写」，其它类型一律按服务端 `optionalSkillText` 的口径拒。 */
function stringField(value: FrontmatterValue, key: string, path: string): string | null {
  if (value.kind === 'null') return null
  if (value.kind === 'string') return value.value
  throw invalid(`SKILL.md 字段 ${key} 必须是字符串：${path}`)
}

/** 必填、非空白、长度受限的字符串（服务端 `requiredSkillText`）。 */
function requiredText(value: FrontmatterValue, key: string, maxLength: number, path: string): string {
  const text = stringField(value, key, path)
  if (text === null || text.trim() === '') throw invalid(`SKILL.md 缺少 ${key}：${path}`)
  if (text.length > maxLength) throw invalid(`SKILL.md 字段 ${key} 过长：${path}`)
  return text
}

/** 可选、长度受限的字符串（服务端 `optionalSkillText`；空白串合法）。 */
function optionalText(value: FrontmatterValue, key: string, maxLength: number, path: string): string | undefined {
  const text = stringField(value, key, path)
  if (text === null) return undefined
  if (text.length > maxLength) throw invalid(`SKILL.md 字段 ${key} 过长：${path}`)
  return text
}

/**
 * 布尔字段（服务端 `booleanField`）：Boolean / Integer 0|1 / 字符串 `true/false/yes/no/on/off/1/0`。
 *
 * `null` 返回 false —— 服务端 `data.get(key) == null` 就走这条，而 `user-invocable` 是否缺席由调用方另判。
 */
function booleanField(value: FrontmatterValue, key: string, path: string): boolean {
  if (value.kind === 'null') return false
  if (value.kind === 'boolean') return value.value
  if (value.kind === 'integer') {
    if (value.value === 1) return true
    if (value.value === 0) return false
    throw invalid(`SKILL.md 字段 ${key} 必须是布尔值：${path}`)
  }
  if (value.kind === 'string') {
    const lowered = value.value.toLowerCase()
    if (lowered === 'true' || lowered === 'yes' || lowered === 'on' || lowered === '1') return true
    if (lowered === 'false' || lowered === 'no' || lowered === 'off' || lowered === '0') return false
  }
  throw invalid(`SKILL.md 字段 ${key} 必须是布尔值：${path}`)
}

/**
 * 解析一段 `SKILL.md` 字节的 frontmatter 并跑完 §D.4 的判定。
 *
 * @param bytes - 单个 `SKILL.md` 的原始字节（≤256 KiB 由制品闸门保证；此处按 UTF-8 宽松解码，与服务端 `new String(bytes, UTF_8)` 同口径）。
 * @param label - 出错时用于定位的技能路径/名字（只进 Host 侧日志与测试断言，不进响应体）。
 * @returns 五个字段的判定事实与未知键清单。
 * @throws {EnterpriseSkillInstallError} 一律 `ENT_SKILL_SKILLMD_INVALID`（D4-1…D4-8 任一条不过）。
 */
export function parseSkillFrontmatter(bytes: Buffer, label?: string): SkillFrontmatterFacts {
  const path = label === undefined ? 'SKILL.md' : `${label}/SKILL.md`
  const block = extractFrontmatterBlock(bytes.toString('utf8'))
  const entries = scanEntries(block)
  if (entries.length === 0) throw invalid(`SKILL.md frontmatter 必须是映射：${path}`)
  const values = new Map<string, FrontmatterValue>()
  const unknownKeys: string[] = []
  for (const entry of entries) {
    // 取值只对**认识的**键解：未知键原样跳过（D4-10 的「容忍但不透传」），
    // 这样未知键里出现了本文件不支持的 YAML 形式也不会误伤（服务端那边由 libyaml 兜住）。
    if (KNOWN_FIELDS.has(entry.key) || LEGACY_FIELDS.some(([name]) => name === entry.key)) {
      values.set(entry.key, decodeValue(entry))
    } else {
      unknownKeys.push(entry.key)
    }
  }
  for (const [legacy, replacement] of LEGACY_FIELDS) {
    if (values.has(legacy)) {
      throw invalid(`SKILL.md frontmatter 字段 "${legacy}" 不受支持，请改用 "${replacement}"`)
    }
  }
  const name = requiredText(values.get('name') ?? { kind: 'null' }, 'name', MAX_NAME_LENGTH, path)
  if (!SKILL_NAME_PATTERN.test(name)) throw invalid(`SKILL.md name 必须是 kebab-case：${name}`)
  const description = requiredText(
    values.get('description') ?? { kind: 'null' },
    'description',
    MAX_DESCRIPTION_LENGTH,
    path,
  )
  const whenToUse = optionalText(values.get('whenToUse') ?? { kind: 'null' }, 'whenToUse', MAX_WHEN_TO_USE_LENGTH, path)
  const disableModelInvocation = booleanField(
    values.get('disable-model-invocation') ?? { kind: 'null' },
    'disable-model-invocation',
    path,
  )
  // 注意这里的「缺席」判法：服务端是 `data.containsKey("user-invocable") ? booleanField(...) : true`，
  // 故显式写 `user-invocable:`（YAML null）得到 **false**，只有整键不写才是 true。
  const userInvocable = values.has('user-invocable')
    ? booleanField(values.get('user-invocable')!, 'user-invocable', path)
    : true
  return {
    name,
    description,
    ...(whenToUse === undefined ? {} : { whenToUse }),
    disableModelInvocation,
    userInvocable,
    unknownKeys,
  }
}

/**
 * §D.4 的闸门入口：判定不通过即抛稳定码（整包拒绝级别，调用方不得继续落盘）。
 *
 * @param bytes - 单个 `SKILL.md` 的原始字节。
 * @param label - 出错时用于定位的技能路径/名字。
 * @returns 判定事实（调用方目前只用它留痕未知键）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_SKILLMD_INVALID`。
 */
export function validateSkillFrontmatter(bytes: Buffer, label?: string): SkillFrontmatterFacts {
  return parseSkillFrontmatter(bytes, label)
}
