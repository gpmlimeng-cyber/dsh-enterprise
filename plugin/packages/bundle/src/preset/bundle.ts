/**
 * [INPUT]: 依赖 node:crypto/fs/path、platform-client 的 `resolveEnterpriseDshHome`，以及配方包里的两样事实——`manifest.json` 的 id/name/description（+ 可选 version/order）与 `preset/agent.cordis.yml` 的根级 entry list 正文
 * [OUTPUT]: 对外提供 `normalizePresetId`/`presetRowId`/`presetBundlePackageName`、纯函数 `renderPresetBundle`（逐字节产出 `package.json` + `cordis.patch.yml`）、落盘函数 `synthesizePresetBundle`（原子、幂等、可枚举）、`extractPresetMounts` 与 `presetBundleSet`
 * [POS]: bundle 配方一键启用纵深的**合成段**——把一份企业配方变成官方唯一安装面认识的**最小 bundle**（恰好两个文件：`package.json` 带 `dsh.bundle.patch`、`cordis.patch.yml` 里 insert 一条 `@deepseek-ai/dsh-agent-preset`）。写法逐字对照 spike 实样（`docs/notes/preset-bundle-spike.md` §1.1/§1.2）：不自创字段、Loader row id 一律 `preset-<id>`、`agent.cordis.yml` 的 entry list **整段按相对缩进搬进 `config.plugins`**（因此 `!!js`、`cordis:group`+`isolate`、嵌套 config 一个字符都不丢）。落点 `<dshHome>/enterprise/preset-bundles/<配方 id>/<内容摘要>/`，路径与权限照本包既有纪律（0700/0600、同目录临时件 + rename、realpath 三重等式）。**本段只合成、不安装、不联网**
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

/** 一份待合成的配方：manifest 事实 + `preset/agent.cordis.yml` 的**正文**（根级 entry list）。 */
export interface PresetRecipe {
  readonly manifest: PresetRecipeManifest
  readonly agentCordisYml: string
}

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

/** 归一化 entry list 正文：LF 化、去首尾空行、非空行去尾空格；空正文一律 `ENT_PRESET_RECIPE_INVALID`。 */
function normalizeEntryList(text: string): string[] {
  if (typeof text !== 'string') throw presetBadRequest('agent.cordis.yml must be a string')
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[ \t]+$/g, ''))
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length === 0) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'agent.cordis.yml is empty')
  }
  // 唯一接受的整体形状：根级 entry list。根级 mapping（`plugins:` 之类）我们不猜、直接拒。
  const firstMeaningful = lines.find(line => line.trim() !== '' && !line.trimStart().startsWith('#'))
  if (firstMeaningful === undefined || !firstMeaningful.startsWith('-')) {
    throw new EnterprisePresetError(
      'ENT_PRESET_RECIPE_INVALID',
      'agent.cordis.yml must be a root-level Cordis entry list',
    )
  }
  return lines
}

/** 从 entry list 正文里按行扫出**每一条 row 的 id 与它自己的 `name:` 模块名**（保守文本规则，不是 YAML 语义权威）。 */
export function extractPresetMounts(text: string): PresetMount[] {
  const lines = normalizeEntryList(text)
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
 * 字段映射逐条对照 spike §5.2；`config.plugins` 是 `agent.cordis.yml` 的 entry list 整体缩进搬入，
 * 因此官方 Loader 方言（`!!js`、`group: true` + `isolate`、嵌套 `config`）逐字保留。
 */
export function renderPresetBundle(recipe: PresetRecipe): RenderedPresetBundle {
  if (typeof recipe !== 'object' || recipe === null) throw presetBadRequest('recipe must be an object')
  const manifest = recipe.manifest
  if (typeof manifest !== 'object' || manifest === null) throw presetBadRequest('recipe manifest must be an object')
  const declarationId = normalizePresetId(manifest.id)
  const displayName = requireBoundedText(manifest.name, 'recipe name', MAX_DISPLAY_NAME_LENGTH)
  const description = manifest.description === undefined
    ? undefined
    : requireBoundedText(manifest.description, 'recipe description', MAX_DESCRIPTION_LENGTH)
  const order = manifest.order === undefined ? undefined : requireOrder(manifest.order)
  const version = requireVersion(manifest.version)
  const lines = normalizeEntryList(recipe.agentCordisYml)
  const plugins = lines.map(line => (line === '' ? '' : `          ${line}`)).join('\n')
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
    '        plugins:',
    plugins,
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
  const mounts = extractPresetMounts(recipe.agentCordisYml)
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
    bundleSet,
    mounts,
  }
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
