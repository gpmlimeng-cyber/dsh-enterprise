/**
 * [INPUT]: 依赖 node:crypto/fs/path、platform-client 的 `resolveEnterpriseDshHome`，以及配方包里的三样事实——`manifest.json` 的 id/name/description（+ 可选 version/order）、可选的 `preset/preset.yml` 显示元数据（`PresetRecipe.localMetadata`）、`preset/agent.cordis.yml` 的正文（**根级 entry list** 或**根 mapping**）
 * [OUTPUT]: 对外提供 `normalizePresetId`/`presetRowId`/`presetBundlePackageName`、形状判定 `readPresetAgentComposition`、纯函数 `renderPresetBundle`（逐字节产出 `package.json` + `cordis.patch.yml`）、落盘函数 `synthesizePresetBundle`（原子、幂等、可枚举）、`extractPresetMounts` 与 `presetBundleSet`
 * [POS]: bundle 配方一键启用纵深的**合成段**——把一份企业配方变成官方唯一安装面认识的**最小 bundle**（恰好两个文件：`package.json` 带 `dsh.bundle.patch`、`cordis.patch.yml` 里 insert 一条 `@deepseek-ai/dsh-agent-preset`）。**同时接受官方两种真实形状**：① 根级 entry list（官方 preset 目录格式的 composition，写法逐字对照 spike 实样 `docs/notes/preset-bundle-spike.md` §1.1/§1.2，`!!js`/`cordis:group`+`isolate`/嵌套 config 一个字符都不丢）；② 根 mapping（真机上那份企业制品的样子：`name`/`description`/`order`/`plugins`/`skills`），其中 `skills` **绝不进 bundle**（规划 §K2「不把技能/插件内嵌进配方包」，那些技能由我们自己的技能管线按引用分发），只作为 `declaredSkills` 交回调用方。字段优先级 `manifest.json`（容器权威）> `preset/preset.yml`（官方显示元数据文件）> 根 mapping（组合内标签）；官方 preset `config` schema 只有 `id`/`name`/`description`/`order`/`plugins`（`@deepseek-ai/dsh-agent-preset/lib/index.js:13-19`），故**不自创字段**。Loader row id 一律 `preset-<id>`，entry list **整段按相对缩进搬进 `config.plugins`**。落点 `<dshHome>/enterprise/preset-bundles/<配方 id>/<内容摘要>/`，路径与权限照本包既有纪律（0700/0600、同目录临时件 + rename、realpath 三重等式）。**本段只合成、不安装、不联网**
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterprisePresetError, presetBadRequest, presetError } from './errors.js'

/** 企业配方合成的最小 bundle 落根（`<dshHome>` 下），与技能纵深的 `enterprise/skill-*` 同级。 */
export const PRESET_BUNDLE_ROOT_SEGMENTS = ['enterprise', 'preset-bundles'] as const
/** 最小 bundle 里**恰好**这两个文件；顺序即磁盘上应有的全集。 */
export const PRESET_BUNDLE_FILENAMES = ['cordis.patch.yml', 'package.json'] as const
/** 官方出厂 preset 的四个 id；与它们撞 id 会 `Duplicate preset IDs fail declaration loading`，一律 fail-closed。 */
export const FACTORY_PRESET_IDS = ['standard', 'ptc', 'minimal', 'cordis'] as const
/** 官方 agent preset 声明的包名（本 bundle 的 patch 只 insert 这一条）。 */
export const AGENT_PRESET_MODULE = '@deepseek-ai/dsh-agent-preset' as const
/**
 * 根 mapping 形状里**认得的全部键**；未知键一律拒。
 *
 * 理由：未知键可能正是承载 row 的那个键（`rows`/`entries`/`include`…），静默丢掉它就是"悄悄少装能力"，
 * 比拒更危险。清单只有两处出处：官方 preset `config` schema 的五个字段（`id`/`name`/`description`/
 * `order`/`plugins`，`@deepseek-ai/dsh-agent-preset/lib/index.js:13-19`）＋ 官方 composition 里合法但
 * **不进 config** 的 `skills`（真机制品 `preset/agent.cordis.yml` 实测有此键；按规划 §K2 不内嵌）。
 */
export const PRESET_AGENT_MAPPING_KEYS = ['id', 'name', 'description', 'order', 'plugins', 'skills'] as const
/** 摘要域前缀：内容变了但域仍是 v1，未来改写成 v2 可让旧目录名自然失效。 */
const BUNDLE_DIGEST_DOMAIN = 'dsh-ent-preset-bundle/v1'
const PRESET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const MAX_PRESET_ID_LENGTH = 64
const MAX_DISPLAY_NAME_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 2000

/** 配方包里我们真正需要的事实；其余（附件、技能、许可）不进最小 bundle。 */
export interface PresetRecipeManifest {
  /** 配方 id（官方 `config.id`）；小写字母/数字/连字符，不能与出厂四份撞。 */
  readonly id: string
  /** 员工在官方 picker 里看到的显示名（官方 `config.name`）。 */
  readonly name: string
  /** 一句话说明（官方 `config.description`）；不写官方显示「暂无描述。」。 */
  readonly description?: string
  /** picker 排序位（官方 `config.order`）；出厂 1/2/3/4，建议从 50 起。 */
  readonly order?: number
  /** 配方版本坐标；只进我们自己的 `package.json.version`，官方 preset schema 没有版本字段。 */
  readonly version?: string
}

/**
 * `preset/preset.yml`（官方 preset 目录格式里的**显示元数据文件**）抄下来的事实。
 *
 * 出处：`@deepseek-ai/dsh-agent-presets/lib/index.js:36`（`METADATA_FILE = "preset.yml"`）、`:83-86`
 * （`renderPresetMetadata` 只写 name/description/order）。官方读它时**只按名取这三个键**且
 * "Every read failure degrades to no metadata"（同文件 `:30`），所以这里也一律**按名取、缺省不报错**；
 * 真机制品里那份 `preset.yml` 写的是 `version: 1` + `id: <配方 id>`（`version` 不是官方元数据键 → 忽略，
 * 配方版本坐标按 §5.2 第 16 条只认企业 `manifest.json`）。
 */
export interface PresetRecipeLocalMetadata {
  /** 元数据里自报的配方 id（官方元数据文件本没有这个键，真机制品有）；只用于与 manifest id 对齐。 */
  readonly id?: string
  readonly name?: string
  readonly description?: string
  readonly order?: number
}

/** 一份待合成的配方：manifest 事实 + 可选的 `preset/preset.yml` 元数据 + `preset/agent.cordis.yml` 的**正文**。 */
export interface PresetRecipe {
  readonly manifest: PresetRecipeManifest
  readonly agentCordisYml: string
  readonly localMetadata?: PresetRecipeLocalMetadata
}

/** `preset/agent.cordis.yml` 的两种官方真实形状。 */
export type PresetAgentShape = 'entry-list' | 'mapping'

/** 根 mapping 形状解析出的事实；`entryList` 是 `plugins:` 的正文（该键缺省 = 这份配方不声明任何 row）。 */
export interface PresetAgentMapping {
  readonly id?: string
  readonly name?: string
  readonly description?: string
  readonly order?: number
  /** `plugins:` 的 entry list 正文（已去公共缩进、保留相对缩进）；缺省为 `[]`。 */
  readonly entryList: readonly string[]
  /** 根 mapping 声明的技能名；**不进 bundle**（K2），只交回调用方做披露/依赖核对。 */
  readonly skills: readonly string[]
}

/** 形状判定的结果：根级 entry list，或根 mapping。 */
export type PresetAgentComposition =
  | { readonly shape: 'entry-list'; readonly lines: readonly string[] }
  | { readonly shape: 'mapping'; readonly mapping: PresetAgentMapping }

/** 披露/指纹用的一个集合项：kind=bundle 是我们真正要装的，kind=mount 是配方会挂载的模块。 */
export interface PresetBundleSetItem {
  readonly kind: 'bundle' | 'mount'
  readonly name: string
  readonly summary: string
  /** 仅 kind=bundle 有：这个 bundle 的内容摘要（内容变 = 重新确认）。 */
  readonly digest?: string
}

/** `extractPresetMounts` 的一条结果（Loader row 的 id 与其 `name:` 模块名）。 */
export interface PresetMount {
  readonly id: string
  readonly name: string
}

/** 纯函数的产物：两个文件的完整正文 + 一切可用来做幂等与展示的稳定派生值。 */
export interface RenderedPresetBundle {
  readonly declarationId: string
  readonly rowId: string
  readonly packageName: string
  readonly displayName: string
  readonly version: string
  /** `package.json` 的完整正文（含结尾换行）。 */
  readonly packageJson: string
  /** `cordis.patch.yml` 的完整正文（含结尾换行）。 */
  readonly cordisPatch: string
  /** 两个文件正文的稳定内容摘要（64 位小写十六进制）。 */
  readonly digest: string
  /** 这次吃进来的 `agent.cordis.yml` 是哪种形状（诊断/回归用；不进产物）。 */
  readonly agentShape: PresetAgentShape
  /**
   * 根 mapping 声明、但**刻意不装**的技能名（K2）。
   *
   * 它们不会出现在 `bundleSet`（因此不改变指纹、也不进披露弹层）——按规划 §B.2，技能是**引用**：
   * 由我们自己的技能管线按中心已发布的技能包安装；这里只把事实交回调用方，绝不静默丢失信息。
   */
  readonly declaredSkills: readonly string[]
  readonly bundleSet: readonly PresetBundleSetItem[]
  readonly mounts: readonly PresetMount[]
}

/** 落盘后的合成结果。 */
export interface SynthesizedPresetBundle extends RenderedPresetBundle {
  readonly bundleDir: string
  readonly fileNames: readonly string[]
}

export interface SynthesizePresetBundleOptions {
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  readonly env?: NodeJS.ProcessEnv
}

/** 归一化配方 id：小写、非法字符折叠成 `-`、去首尾 `-`；空或超长一律 `ENT_PRESET_RECIPE_INVALID`。 */
export function normalizePresetId(value: unknown): string {
  if (typeof value !== 'string') throw presetBadRequest('preset id must be a string')
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (normalized.length === 0 || normalized.length > MAX_PRESET_ID_LENGTH || !PRESET_ID_PATTERN.test(normalized)) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'preset id is not a lowercase kebab identifier')
  }
  if ((FACTORY_PRESET_IDS as readonly string[]).includes(normalized)) {
    // 覆盖出厂 preset 的 config 是**整体替换**，且声明加载会因重复 id 失败 —— 绝不就地半覆盖。
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'preset id collides with a shipped preset id')
  }
  return normalized
}

/** 官方 Loader row id 约定：`preset-<配方 id>`（spike §5.1 第 ① 条）。 */
export function presetRowId(declarationId: string): string {
  return `preset-${declarationId}`
}

/** 本机最小 bundle 的包名：不带 scope，避免多一层 `node_modules/@scope` 残壳。 */
export function presetBundlePackageName(declarationId: string): string {
  return `dsh-ent-preset-${declarationId}`
}

/** 把 YAML 纯量安全地写进块上下文：能裸写就裸写（与 spike 实样逐字一致），否则退化成双引号 JSON 标量。 */
function yamlScalar(value: string): string {
  if (value.length > 0
    && !/[\n\r\t]/.test(value)
    && /^[^\s\-?:,[\]{}#&*!|>'"%@`]/.test(value)
    && !/[:#]\s/.test(value)
    && !/:\s*$/.test(value)) {
    return value
  }
  return JSON.stringify(value)
}

/** 归一化正文行：LF 化、非空行去尾空格、去首尾空行；空正文一律 `ENT_PRESET_RECIPE_INVALID`。 */
function normalizeAgentLines(text: string): string[] {
  if (typeof text !== 'string') throw presetBadRequest('agent.cordis.yml must be a string')
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[ \t]+$/g, ''))
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length === 0) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'agent.cordis.yml is empty')
  }
  return lines
}

/** 两种形状都不成立时的唯一一句话；"既不是根 list 也不是根 mapping"就是真·非法输入。 */
const AGENT_SHAPE_PROBLEM = 'agent.cordis.yml must be a root-level Cordis entry list or a root mapping'
/** 根 mapping 的键行：`key:` 或 `key: value`，键必须顶格（缩进行只可能是上一个键的块）。 */
const AGENT_ROOT_KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*)[ \t]*:(.*)$/
/** 块标量指示符：`|`/`>` + 可选 chomping；带显式缩进数字的形式不认（fail-closed）。 */
const AGENT_BLOCK_SCALAR_PATTERN = /^([|>])([+-]?)$/

function agentIndentOf(line: string): number {
  return /^ */.exec(line)?.[0].length ?? 0
}

/** 空行与 `#` 注释行：形状判定与块收集都跳过它们。 */
function isAgentBlankOrComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#')
}

/** 第一条有意义（非空、非注释）的行及其缩进；注释与空行两边都不算形状依据。 */
function firstAgentMeaningful(lines: readonly string[]): { readonly line: string; readonly indent: number } | undefined {
  for (const line of lines) {
    if (isAgentBlankOrComment(line)) continue
    return { line, indent: agentIndentOf(line) }
  }
  return undefined
}

/**
 * 一个块（某个键的缩进行）去掉公共缩进；相对缩进逐字保留，因此官方 Loader 方言一个字节都不丢。
 *
 * 公共缩进只在**有内容的行**（非空、非注释）上算：顶格注释不算块内容（`# …` 在 YAML 里哪一层都不算数据），
 * 否则一条块后的顶格注释会把整块缩进算成 0，进而把合法配方误判成非法。
 */
function stripAgentBlockIndent(block: readonly string[]): string[] {
  const content = [...block]
  while (content.length > 0 && content[0]!.trim() === '') content.shift()
  while (content.length > 0 && content[content.length - 1]!.trim() === '') content.pop()
  const indents = content
    .filter(line => line.trim() !== '' && !line.trim().startsWith('#'))
    .map(line => agentIndentOf(line))
  const common = indents.length === 0 ? 0 : Math.min(...indents)
  return content
    .filter(line => !(line.trim().startsWith('#') && agentIndentOf(line) < common))
    .map(line => (line.trim() === '' ? '' : line.slice(common)))
}

/**
 * **形状判定**：`agent.cordis.yml` 是根级 entry list 还是根 mapping。
 *
 * 判据只看第一条有意义行的首字符：`-` ⇒ entry list（官方 preset 目录格式的 composition，逐字搬）；
 * 顶格 `key:` ⇒ 根 mapping（真机制品形状）。其余（根标量、流式 `{…}`/`[…]`、首个键就不顶格…）一律
 * `ENT_PRESET_RECIPE_INVALID` —— **不猜**。
 */
export function readPresetAgentComposition(text: string): PresetAgentComposition {
  const lines = normalizeAgentLines(text)
  const first = firstAgentMeaningful(lines)
  if (first === undefined) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'agent.cordis.yml has no content')
  }
  if (first.line.startsWith('-')) return { shape: 'entry-list', lines }
  if (first.indent === 0 && AGENT_ROOT_KEY_PATTERN.test(first.line)) {
    return { shape: 'mapping', mapping: readPresetAgentMapping(lines) }
  }
  throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', AGENT_SHAPE_PROBLEM)
}

/**
 * 读根 mapping。只认 {@link PRESET_AGENT_MAPPING_KEYS}；每个键的取值规则见下，任一条不合规都 fail-closed。
 *
 * 文本规则（与 entry list 一样**不是 YAML 语义权威**，只覆盖真实制品用到的保守子集）：
 * 纯量字段 = 行内纯量或 `|`/`>` 块标量；`order` = 行内十进制整数；`plugins`/`skills` = 块序列
 * （`plugins: []`/`skills: [a, b]` 也认）。
 */
function readPresetAgentMapping(lines: readonly string[]): PresetAgentMapping {
  const fields = new Map<string, { readonly inline: string; readonly block: readonly string[] }>()
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (isAgentBlankOrComment(line)) {
      index += 1
      continue
    }
    if (agentIndentOf(line) !== 0) {
      throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', AGENT_SHAPE_PROBLEM)
    }
    if (line.startsWith('-')) {
      throw new EnterprisePresetError(
        'ENT_PRESET_RECIPE_INVALID',
        'agent.cordis.yml mixes a root mapping with a root list',
      )
    }
    const key = AGENT_ROOT_KEY_PATTERN.exec(line)
    if (key === null) {
      throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', AGENT_SHAPE_PROBLEM)
    }
    const name = key[1]!
    if (!(PRESET_AGENT_MAPPING_KEYS as readonly string[]).includes(name)) {
      // 未知键可能正是承载 row 的那个键 —— 静默丢掉它就是悄悄少装能力，故拒。
      throw new EnterprisePresetError(
        'ENT_PRESET_RECIPE_INVALID',
        `agent.cordis.yml root mapping key "${name}" is not one this synthesizer can map`,
      )
    }
    if (fields.has(name)) {
      throw new EnterprisePresetError(
        'ENT_PRESET_RECIPE_INVALID',
        `agent.cordis.yml repeats the root mapping key "${name}"`,
      )
    }
    const block: string[] = []
    let cursor = index + 1
    // 该键的块 = 其后所有缩进行（空行/注释行算块内，YAML 也允许）。
    while (cursor < lines.length) {
      const candidate = lines[cursor]!
      if (isAgentBlankOrComment(candidate)) {
        block.push(candidate)
        cursor += 1
        continue
      }
      if (agentIndentOf(candidate) === 0) break
      block.push(candidate)
      cursor += 1
    }
    fields.set(name, { inline: key[2] ?? '', block })
    index = cursor
  }

  const text = (name: string): string | undefined => {
    const field = fields.get(name)
    if (field === undefined) return undefined
    const value = agentScalarText(`agent.cordis.yml ${name}`, field.inline, field.block)
    // 显式空串与 YAML 的 null 一样按"没写"处理：本合成器绝不会把它们写进产物。
    return value === undefined || value === '' ? undefined : value
  }
  const orderField = fields.get('order')
  const pluginsField = fields.get('plugins')
  const skillsField = fields.get('skills')
  const id = text('id')
  const name = text('name')
  const description = text('description')
  const order = orderField === undefined
    ? undefined
    : agentIntegerField('agent.cordis.yml order', orderField.inline, orderField.block)
  const entryList = pluginsField === undefined
    ? []
    : agentEntryListField(pluginsField.inline, pluginsField.block)
  const skills = skillsField === undefined ? [] : agentSkillNamesField(skillsField.inline, skillsField.block)
  return {
    ...(id === undefined ? {} : { id }),
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
    ...(order === undefined ? {} : { order }),
    entryList,
    skills,
  }
}

/** 纯量字段：行内纯量（裸写/单双引号）或 `|`/`>` 块标量；流式/锚点/标签一律拒（我们无法忠实搬运）。 */
function agentScalarText(label: string, inline: string, block: readonly string[]): string | undefined {
  const trimmed = inline.trim()
  const indicator = AGENT_BLOCK_SCALAR_PATTERN.exec(trimmed)
  if (indicator !== null) {
    return foldAgentBlockScalar(block, indicator[1] === '>')
  }
  if (trimmed === '') {
    if (block.length === 0) return undefined
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', `${label} must be a plain or block scalar`)
  }
  if (/^[\[{&*!]/.test(trimmed)) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', `${label} uses a YAML form this synthesizer cannot map`)
  }
  return unquoteScalar(trimmed)
}

/** 块标量正文：去公共缩进、去首尾空行；`|` 逐行连接（`\n`），`>` 折行（空格）。 */
function foldAgentBlockScalar(block: readonly string[], folded: boolean): string {
  const content = stripAgentBlockIndent(block)
  if (content.length === 0) return ''
  return content.join(folded ? ' ' : '\n')
}

/** 整数字段：只认行内十进制整数（不认块、不认十六进制/浮点/表达式）。 */
function agentIntegerField(label: string, inline: string, block: readonly string[]): number | undefined {
  const trimmed = inline.trim()
  if (trimmed === '') {
    if (block.length === 0) return undefined
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', `${label} must be a plain decimal integer`)
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', `${label} must be a plain decimal integer`)
  }
  return requireOrder(Number(trimmed))
}

/** `plugins:`：块序列（取相对缩进正文）或 `[]`；内容语义仍是官方 Loader 的权威，这里只判"是不是序列"。 */
function agentEntryListField(inline: string, block: readonly string[]): readonly string[] {
  const trimmed = inline.trim()
  if (trimmed === '[]') return []
  if (trimmed !== '') {
    throw new EnterprisePresetError(
      'ENT_PRESET_RECIPE_INVALID',
      'agent.cordis.yml plugins must be a block sequence of Cordis rows',
    )
  }
  const content = stripAgentBlockIndent(block)
  const first = firstAgentMeaningful(content)
  if (first === undefined) return []
  if (!first.line.startsWith('-')) {
    throw new EnterprisePresetError(
      'ENT_PRESET_RECIPE_INVALID',
      'agent.cordis.yml plugins must be a block sequence of Cordis rows',
    )
  }
  return content
}

/**
 * `skills:`：**只登记名字，绝不进 bundle**。
 *
 * 遵守规划 §K2「不把技能/插件内嵌进配方包」：官方 preset 的 `config` schema 里**没有**任何技能字段
 * （只有 `id`/`name`/`description`/`order`/`plugins`，`@deepseek-ai/dsh-agent-preset/lib/index.js:13-19`），
 * 官方唯一表达技能的方式是挂一条 `skill-filesystem` 并给 `customSkillDirs` 一个指向包内 `skills/` 的
 * 绝对路径（官方 `standard.patch.yml:34-37`、本机 `…/.agent-presets/phone-control/agent.cordis.yml:84-88`
 * 的 `!!js … new URL('skills/', baseUrl)`）——而那要求我们把技能文件抄进这个最小 bundle，正是"内嵌"：
 * 同一份 SKILL.md 在中心与本机各存一份必然漂移，且技能有自己的安装管线与 watcher（§B.2）。
 * 所以这里只登记、不搬运；技能由我们自己的技能管线按**引用**分发。为了一个我们不使用的字段去拒整份
 * 配方没有道理，故取值宽松：能读出名字就登记，读不出就空。
 */
function agentSkillNamesField(inline: string, block: readonly string[]): readonly string[] {
  const names: string[] = []
  const push = (value: string): void => {
    const name = unquoteScalar(value.trim())
    if (name !== '') names.push(name)
  }
  const trimmed = inline.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    for (const item of trimmed.slice(1, -1).split(',')) {
      if (item.trim() !== '') push(item)
    }
  } else if (trimmed !== '') {
    push(trimmed)
  }
  for (const line of stripAgentBlockIndent(block)) {
    const item = /^-[ \t]*(.*)$/.exec(line)
    if (item !== null) push(item[1] ?? '')
  }
  return names
}

/** 从"已归一化的行"里按行扫出每一条 row 的 id 与它自己的 `name:` 模块名（保守文本规则）。 */
function scanPresetMounts(lines: readonly string[]): PresetMount[] {
  const mounts: PresetMount[] = []
  let pendingId: string | undefined
  let pendingIndent = -1
  for (const line of lines) {
    const item = /^(\s*)-\s+id\s*:\s*(.+)$/.exec(line)
    if (item !== null) {
      pendingId = unquoteScalar(item[2] ?? '')
      pendingIndent = (item[1] ?? '').length
      continue
    }
    if (pendingId === undefined) continue
    const named = /^(\s*)name\s*:\s*(.+)$/.exec(line)
    if (named === null) continue
    if ((named[1] ?? '').length <= pendingIndent) continue
    const name = unquoteScalar(named[2] ?? '')
    const id = pendingId
    pendingId = undefined
    if (isMountModuleName(name)) mounts.push({ id, name })
  }
  return mounts
}

/** 一份配方会挂载的模块：根级 entry list 直接扫；根 mapping 扫它的 `plugins:` 正文（没写就是空）。 */
export function extractPresetMounts(text: string): PresetMount[] {
  const composition = readPresetAgentComposition(text)
  return scanPresetMounts(
    composition.shape === 'entry-list' ? composition.lines : composition.mapping.entryList,
  )
}

function unquoteScalar(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2
    && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"')))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/** 只认普通包 specifier：不带冒号（`cordis:group`/`cordis:include` 自然被排除）、不含表达式。 */
function isMountModuleName(name: string): boolean {
  return name.length > 0 && name.length <= 128 && /^@?[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)
}

/** 披露/指纹项：我们的 bundle + 配方会挂载的模块名；按 kind+name 确定性排序。 */
export function presetBundleSet(rendered: {
  readonly packageName: string
  readonly digest: string
  readonly mounts: readonly PresetMount[]
  readonly manifest: PresetRecipeManifest
}): readonly PresetBundleSetItem[] {
  const items = new Map<string, PresetBundleSetItem>()
  items.set(`bundle:${rendered.packageName}`, {
    kind: 'bundle',
    name: rendered.packageName,
    summary: rendered.manifest.description ?? rendered.manifest.name,
    digest: rendered.digest,
  })
  for (const mount of rendered.mounts) {
    const key = `mount:${mount.name}`
    if (items.has(key)) continue
    items.set(key, { kind: 'mount', name: mount.name, summary: `挂载行 ${mount.id}` })
  }
  return [...items.values()].sort((left, right) => (
    left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind.localeCompare(right.kind)
  ))
}

/**
 * **纯函数**：把一份配方渲染成恰好两个文件的完整正文。
 *
 * 字段映射（优先级自上而下，**manifest.json 是企业容器里唯一被中心校验并绑定 sha256 的身份/门面**，
 * 故它永远压过另两处自报值）：
 *
 * | 目标（官方 `@deepseek-ai/dsh-agent-preset` `config`） | 第 1 优先 | 第 2 优先 | 第 3 优先 | 理由 |
 * |---|---|---|---|---|
 * | `config.id` + Loader row id `preset-<id>` | `manifest.json.id` | — | — | 中心详情按它对齐（`preset-source.ts` 的 `presetId` 比对），sha256 已绑死 |
 * | `config.name` | `manifest.json.name` | `preset/preset.yml.name` | 根 mapping `name` | 员工看到的唯一门面（spike §3②）；真机制品里 mapping 的 `name` 是**机器标签**（`demo-weekly-report`），让位后员工才看到「示例·周报助手」 |
 * | `config.description` | `manifest.json.description` | `preset.yml.description` | 根 mapping `description` | 同上；都缺省就不写（官方显示「暂无描述。」） |
 * | `config.order` | `manifest.json.order` | `preset.yml.order` | 根 mapping `order` | 纯排序位，谁先写谁算 |
 * | `config.plugins` | 根级 entry list 整段 | 根 mapping `plugins:` 整段 | （都缺省）`[]` | 官方的 composition 只有一处：`agent.cordis.yml`；空 row 列表是合法的（`z.array().required()` 认 `[]`） |
 * | （不进 config）`skills` | — | — | — | 规划 §K2：不内嵌技能；官方面没有这个字段 → 只登记为 `declaredSkills`、绝不写进产物 |
 *
 * `id` 是**唯一**不按优先级、而是按"必须一致"处理的字段：`preset.yml.id` 与根 mapping `id` 自报的
 * 值经 `normalizePresetId` 归一化后必须等于 manifest id，否则两份身份在同一份制品里打架 ⇒ fail-closed。
 */
export function renderPresetBundle(recipe: PresetRecipe): RenderedPresetBundle {
  if (typeof recipe !== 'object' || recipe === null) throw presetBadRequest('recipe must be an object')
  const manifest = recipe.manifest
  if (typeof manifest !== 'object' || manifest === null) throw presetBadRequest('recipe manifest must be an object')
  const composition = readPresetAgentComposition(recipe.agentCordisYml)
  const mapping = composition.shape === 'mapping' ? composition.mapping : undefined
  const local = recipe.localMetadata
  const declarationId = normalizePresetId(manifest.id)
  // 身份必须唯一：`preset/preset.yml` 与根 mapping 自报的 id 若归一化后不是同一个，就是同一份制品里两个身份。
  for (const claimed of [local?.id, mapping?.id]) {
    if (claimed === undefined) continue
    if (normalizePresetId(claimed) !== declarationId) {
      throw new EnterprisePresetError(
        'ENT_PRESET_RECIPE_INVALID',
        'the recipe declares a preset id that differs from manifest.json',
      )
    }
  }
  const displayName = pickPresetText('recipe name', MAX_DISPLAY_NAME_LENGTH, manifest.name, local?.name, mapping?.name)
  const description = pickOptionalPresetText(
    'recipe description',
    MAX_DESCRIPTION_LENGTH,
    manifest.description,
    local?.description,
    mapping?.description,
  )
  const order = manifest.order !== undefined ? requireOrder(manifest.order) : (local?.order ?? mapping?.order)
  const version = requireVersion(manifest.version)
  const lines = composition.shape === 'entry-list' ? composition.lines : mapping?.entryList ?? []
  const declaredSkills = mapping?.skills ?? []
  const patchLines = [
    '# generated by dshent-plugin preset synthesis: one @deepseek-ai/dsh-agent-preset declaration.',
    `# 企业配方 ${declarationId}：字段映射见 docs/notes/preset-bundle-spike.md §5；请勿手改。`,
    '- insert:',
    `    - id: ${presetRowId(declarationId)}`,
    `      name: '${AGENT_PRESET_MODULE}'`,
    '      config:',
    `        id: ${declarationId}`,
    `        name: ${yamlScalar(displayName)}`,
    ...(description === undefined ? [] : [`        description: ${yamlScalar(description)}`]),
    ...(order === undefined ? [] : [`        order: ${order}`]),
    // 空 row 列表必须写成 `[]` 而不是留空：官方 schema 要求 `plugins` 是数组，留空即 null。
    ...(lines.length === 0
      ? ['        plugins: []']
      : ['        plugins:', lines.map(line => (line === '' ? '' : `          ${line}`)).join('\n')]),
    '',
  ]
  const cordisPatch = patchLines.join('\n')
  const packageJson = `${JSON.stringify({
    name: presetBundlePackageName(declarationId),
    version,
    private: true,
    type: 'module',
    description: description ?? displayName,
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2)}\n`
  const digest = bundleDigest(packageJson, cordisPatch)
  const mounts = scanPresetMounts(lines)
  const bundleSet = presetBundleSet({
    packageName: presetBundlePackageName(declarationId),
    digest,
    mounts,
    manifest: { id: declarationId, name: displayName, ...(description === undefined ? {} : { description }) },
  })
  return {
    declarationId,
    rowId: presetRowId(declarationId),
    packageName: presetBundlePackageName(declarationId),
    displayName,
    version,
    packageJson,
    cordisPatch,
    digest,
    agentShape: composition.shape,
    declaredSkills,
    bundleSet,
    mounts,
  }
}

/**
 * 按优先级取第一个"写过"的值（`undefined` = 没写，空串已在根 mapping 解析时折成没写）。
 *
 * 刻意**只跳过 undefined**：某个候选写了但不合法（空串/超长/非字符串）就必须当场拒，
 * 不许悄悄降级到下一个候选 —— 否则"中心发布的门面名坏了"会被下层的机器标签顶替而不留痕。
 */
function pickPresetText(label: string, max: number, ...candidates: readonly unknown[]): string {
  const value = candidates.find(candidate => candidate !== undefined)
  if (value === undefined) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', `${label} is missing or too long`)
  }
  return requireBoundedText(value, label, max)
}

/** 同 {@link pickPresetText}，但一个候选都没写就返回 `undefined`（可选字段）。 */
function pickOptionalPresetText(label: string, max: number, ...candidates: readonly unknown[]): string | undefined {
  const value = candidates.find(candidate => candidate !== undefined)
  return value === undefined ? undefined : requireBoundedText(value, label, max)
}

function requireBoundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', `${label} is missing or too long`)
  }
  return value
}

function requireOrder(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'recipe order is not a safe non-negative integer')
  }
  return value
}

function requireVersion(value: unknown): string {
  if (value === undefined) return '1.0.0'
  if (typeof value !== 'string' || !SEMVER_PATTERN.test(value)) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'recipe version is not a semver string')
  }
  return value
}

/** 两个文件正文的稳定摘要；换行/空白差异不影响（正文在渲染期已归一化）。 */
export function bundleDigest(packageJson: string, cordisPatch: string): string {
  return createHash('sha256')
    .update(`${BUNDLE_DIGEST_DOMAIN}\n`)
    .update(packageJson)
    .update('\u0000')
    .update(cordisPatch)
    .digest('hex')
}

/** 最小 bundle 的落根：`<dshHome>/enterprise/preset-bundles`。 */
export function presetBundleRoot(options: SynthesizePresetBundleOptions = {}): string {
  return join(resolveEnterpriseDshHome(options), ...PRESET_BUNDLE_ROOT_SEGMENTS)
}

/**
 * 落盘合成：**幂等、原子、可枚举**。
 *
 * 同一份配方 + 同一版本 ⇒ 同一摘要 ⇒ 同一目录（已存在且逐字节相同即直接复用，不重写）；
 * 写盘走 `<declRoot>/.staging-<uuid>` + `rename`，并做 realpath 三重等式（落根 / 配方目录 / 摘要目录）。
 *
 * @throws {EnterprisePresetError} `ENT_PRESET_RECIPE_INVALID`（配方形状）或 `ENT_PRESET_BUNDLE_WRITE_FAILED`（落盘/路径）。
 */
export async function synthesizePresetBundle(
  options: SynthesizePresetBundleOptions,
  recipe: PresetRecipe,
): Promise<SynthesizedPresetBundle> {
  const rendered = renderPresetBundle(recipe)
  const home = resolveEnterpriseDshHome(options)
  const root = join(home, ...PRESET_BUNDLE_ROOT_SEGMENTS)
  try {
    // `home` 本身可能经符号链接（Android 上 `/data/user/0` ↔ `/data/data`），故等式一律拿 realpath 比 realpath。
    await mkdir(home, { recursive: true, mode: 0o700 })
    const realHome = await realpath(home)
    await mkdir(root, { recursive: true, mode: 0o700 })
    const realRoot = await realpath(root)
    if (realRoot !== join(realHome, ...PRESET_BUNDLE_ROOT_SEGMENTS)) {
      throw new Error('preset bundle root escapes the harness home')
    }
    const declRoot = join(root, rendered.declarationId)
    await mkdir(declRoot, { recursive: true, mode: 0o700 })
    const realDeclRoot = await realpath(declRoot)
    if (realDeclRoot !== join(realRoot, rendered.declarationId)) {
      throw new Error('preset bundle directory escapes the bundle root')
    }
    const target = join(realDeclRoot, rendered.digest)
    const existing = await readBundleDirectory(target)
    if (existing !== undefined) {
      if (existing.packageJson !== rendered.packageJson || existing.cordisPatch !== rendered.cordisPatch) {
        throw new Error('preset bundle digest directory holds different bytes')
      }
      return { ...rendered, bundleDir: target, fileNames: [...PRESET_BUNDLE_FILENAMES] }
    }
    const staging = join(realDeclRoot, `.staging-${randomUUID()}`)
    await mkdir(staging, { recursive: false, mode: 0o700 })
    try {
      await writeFile(join(staging, 'package.json'), rendered.packageJson, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      await writeFile(join(staging, 'cordis.patch.yml'), rendered.cordisPatch, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      const entries = (await readdir(staging)).sort()
      if (entries.join(',') !== PRESET_BUNDLE_FILENAMES.join(',')) {
        throw new Error('preset bundle staging does not hold exactly the two expected files')
      }
      try {
        await rename(staging, target)
      } catch (error) {
        // 只有并发者先我们一步放好**同样内容**时才接受；否则原样抛。
        const raced = await readBundleDirectory(target)
        if (raced === undefined
          || raced.packageJson !== rendered.packageJson
          || raced.cordisPatch !== rendered.cordisPatch) throw error
      }
    } catch (error) {
      await rm(staging, { force: true, recursive: true }).catch(() => undefined)
      throw error
    }
    const realTarget = await realpath(target)
    if (realTarget !== join(realDeclRoot, rendered.digest) || !realTarget.startsWith(realRoot + sep)) {
      throw new Error('preset bundle directory failed the realpath equality check')
    }
    return { ...rendered, bundleDir: realTarget, fileNames: [...PRESET_BUNDLE_FILENAMES] }
  } catch (error) {
    throw presetError(error, 'ENT_PRESET_BUNDLE_WRITE_FAILED', 'preset bundle could not be written')
  }
}

interface BundleDirectoryBytes {
  readonly packageJson: string
  readonly cordisPatch: string
}

/** 读一个已存在的摘要目录；目录不存在返回 undefined，多一个文件即视为可疑（返回一次性比对用字节）。 */
async function readBundleDirectory(dir: string): Promise<BundleDirectoryBytes | undefined> {
  let entries: string[]
  try {
    entries = (await readdir(dir)).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  if (entries.join(',') !== PRESET_BUNDLE_FILENAMES.join(',')) {
    throw new Error('preset bundle directory does not hold exactly the two expected files')
  }
  return {
    packageJson: await readFile(join(dir, 'package.json'), 'utf8'),
    cordisPatch: await readFile(join(dir, 'cordis.patch.yml'), 'utf8'),
  }
}
