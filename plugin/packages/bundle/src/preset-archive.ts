/**
 * [INPUT]: 依赖共享 ZIP 内核 `zip-archive.ts`（`readZipEntries` + `ZipArchiveError`）、核心的 `PresetRecipe`/`PresetRecipeManifest`/`PresetRecipeLocalMetadata` 形状与 `ENT_PRESET_RECIPE_INVALID` 稳定码
 * [OUTPUT]: 对外提供 `decodeDshPresetArchive(bytes)`（在共享内核之上做 **`.dshpreset` 布局** 判定：根 `manifest.json`（`format=dsh-preset`/`version=1`）+ `preset/agent.cordis.yml|yaml` 正文 + **可选** `preset/preset.yml` 显示元数据，直接产出核心可直接安装的 `PresetRecipe`）与三条上限常量
 * [POS]: bundle 配方纵深的**制品解包边界**——容器层的路径逃逸/符号链接/CRC/ZIP64 门禁全在 `zip-archive.ts`（与技能包共用同一份解析器，绝不新造第二个 ZIP 解析器），本文件只认配方的包内布局。布局真源：`docs/compose/spec/preset-square.md:46-51`、服务端 `PresetArtifactInspector`（只允许根与 `preset/` 下路径、`agent.cordis.yml|yaml` 必须存在）；**这里不解析 YAML 方言**（`!!js`/`cordis:group` 的语义权威是官方 Loader，核心只按相对缩进整段搬走），语义校验（kebab 归一化、撞出厂 id、形状判定与字段优先级）留给核心。包内 `preset/preset.yml` 按官方 `@deepseek-ai/dsh-agent-presets` 的**显示元数据**口径抄事实（`METADATA_FILE`/`renderPresetMetadata`，读不成就是没有元数据），**不**参与 composition
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterprisePresetError, presetError } from './preset/errors.js'
import type { PresetRecipe, PresetRecipeLocalMetadata, PresetRecipeManifest } from './preset/bundle.js'
import {
  readZipEntries,
  type ZipArchiveEntry,
  type ZipArchiveLimits,
} from './zip-archive.js'

/** 压缩包字节上限：与契约 `PresetVersion.sizeBytes` 的 `maximum` 逐字相同（50 MiB）。 */
export const PRESET_ARCHIVE_MAX_BYTES = 52_428_800
/** 解压后总字节上限：与技能包同口径（200 MiB）。 */
export const PRESET_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 209_715_200
/** 中央目录条目数上限：与技能包同口径。 */
export const PRESET_ARCHIVE_MAX_ENTRIES = 10_000
/** 配方正文（`preset/agent.cordis.yml`）字节上限：composition 正文，给足余量但绝不无界读入。 */
export const PRESET_AGENT_YML_MAX_BYTES = 1_048_576

/** 根清单文件名与配方正文的两条合法路径（`.yml` 优先）。 */
const PRESET_MANIFEST_PATH = 'manifest.json'
const PRESET_AGENT_YML_PATHS = ['preset/agent.cordis.yml', 'preset/agent.cordis.yaml'] as const
/**
 * 官方 preset 目录格式里的**显示元数据**文件名（`@deepseek-ai/dsh-agent-presets/lib/index.js:36`
 * `METADATA_FILE = "preset.yml"`）；官方只写 name/description/order（同文件 `:83-86`）。
 */
const PRESET_METADATA_PATH = 'preset/preset.yml'

/** `manifest.json` 的 `id` 规约：与契约 `PresetPresetId` 同源。 */
const PRESET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const MAX_PRESET_ID_LENGTH = 128
const MAX_DISPLAY_NAME_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 2000

/** 交给共享内核的三条上限（配方包口径）。 */
const PRESET_ZIP_LIMITS: ZipArchiveLimits = {
  maxBytes: PRESET_ARCHIVE_MAX_BYTES,
  maxEntries: PRESET_ARCHIVE_MAX_ENTRIES,
  maxUncompressedBytes: PRESET_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
}

function invalid(message: string, cause?: unknown): EnterprisePresetError {
  return cause === undefined
    ? new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', message)
    : new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', message, { cause })
}

/** 一个已通过全部门禁的 `.dshpreset` 包。 */
export interface EnterprisePresetArchive {
  /** `manifest.json` 的 `id`；与中心详情的 `presetId` 同源（**未**做 kebab 归一化，那是核心的事）。 */
  readonly presetId: string
  /** 包内配方正文的路径（诊断用；恒为两条合法路径之一）。 */
  readonly agentYmlPath: string
  /** 可直接交给核心 `createEnterprisePresetInstall().enable(recipe)` 的配方。 */
  readonly recipe: PresetRecipe
}

/** 读 `manifest.json`，只认 `format=dsh-preset` 且 `version=1`（与技能侧同把尺：version 是字符串）。 */
function readPresetManifest(text: string): { readonly id: string; readonly name: string; readonly description?: string; readonly order?: number } {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw invalid('manifest.json is not valid JSON', error)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid('manifest.json is not an object')
  const manifest = value as Record<string, unknown>
  if (manifest['format'] !== 'dsh-preset' || manifest['version'] !== '1') {
    throw invalid('manifest.json is not a dsh-preset v1 manifest')
  }
  const id = manifest['id']
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_PRESET_ID_LENGTH || !PRESET_ID_PATTERN.test(id)) {
    throw invalid('manifest.json has an invalid id')
  }
  const name = manifest['name']
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_DISPLAY_NAME_LENGTH) {
    throw invalid('manifest.json has an invalid name')
  }
  const description = manifest['description']
  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
    throw invalid('manifest.json has an invalid description')
  }
  const order = manifest['order']
  if (order !== undefined && (typeof order !== 'number' || !Number.isSafeInteger(order) || order < 0 || order > 1_000_000)) {
    throw invalid('manifest.json has an invalid order')
  }
  return {
    id,
    name,
    ...(typeof description === 'string' ? { description } : {}),
    ...(typeof order === 'number' ? { order } : {}),
  }
}

/**
 * 读包内**可选**的 `preset/preset.yml`（官方 preset 目录格式的显示元数据文件）。
 *
 * 官方口径逐条照抄（`@deepseek-ai/dsh-agent-presets/lib/index.js`）：它是独立于 composition 的显示元数据
 * （`:18-22`）、只按名取 `name`/`description`/`order`（`:83-86`）、并且 "Every read failure degrades to
 * no metadata"（`:30`）。所以这里：**只按名取四个键、缩进行/未知键/坏值一律忽略、整份读不成 mapping
 * 就当没有**——绝不因为一个只用于显示的辅助文件去拒一份合法配方。真机制品里那份写的是
 * `version: 1` + `id: <配方 id>`：`version` 不是官方元数据键故忽略，`id` 抄下来交给核心与
 * `manifest.json` 的 id 对齐（两份身份打架时由核心 fail-closed）。
 */
function readPresetLocalMetadata(entries: readonly ZipArchiveEntry[]): PresetRecipeLocalMetadata | undefined {
  const entry = entries.find(item => item.path === PRESET_METADATA_PATH && item.isDirectory === false)
  if (entry?.bytes === undefined) return undefined
  const facts: { id?: string, name?: string, description?: string, order?: number } = {}
  for (const raw of entry.bytes.toString('utf8').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/[ \t]+$/g, '')
    // 只认顶格的 `key: value`；缩进行（块）、注释行、空行全部跳过（官方元数据没有块形态）。
    if (line.trim() === '' || line.trimStart().startsWith('#') || /^[ \t]/.test(line)) continue
    const match = /^([A-Za-z][A-Za-z0-9_-]*)[ \t]*:(.*)$/.exec(line)
    if (match === null) continue
    const key = match[1]!
    const value = unquoteLocalScalar(match[2]!.trim())
    // 流式/锚点/标签/块标量：不猜，当没写（显示元数据不是权威，缺省无害）。
    if (value === '' || /^[\[{|>&*!]/.test(value)) continue
    if (key === 'id' && value.length <= MAX_PRESET_ID_LENGTH) facts.id = value
    else if (key === 'name' && value.length <= MAX_DISPLAY_NAME_LENGTH) facts.name = value
    else if (key === 'description' && value.length <= MAX_DESCRIPTION_LENGTH) facts.description = value
    else if (key === 'order' && /^\d+$/.test(value)) {
      const order = Number(value)
      if (Number.isSafeInteger(order) && order <= 1_000_000) facts.order = order
    }
  }
  return Object.keys(facts).length === 0 ? undefined : facts
}

/** 去掉一层的单/双引号；与核心 `unquoteScalar` 同形（本层只用于元数据，不搬正文）。 */
function unquoteLocalScalar(value: string): string {
  if (value.length >= 2
    && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * 解出一份 `.dshpreset` 的配方；任何不合规都抛 `ENT_PRESET_RECIPE_INVALID`。
 *
 * 布局判定（与服务端 `PresetArtifactInspector` 同口径）：根必须有 `manifest.json`；所有条目只允许在根或
 * `preset/` 下；`preset/agent.cordis.yml`（缺省回落 `.yaml`）必须存在且是**非空 UTF-8 文本**。
 * 其余 `preset/` 下的文件（规则文件、技能、`preset.yml`）一律**不参与 composition**——`preset.yml` 只按
 * 官方显示元数据口径抄四个键（见 `readPresetLocalMetadata`），技能文件一概不读（规划 §K2）。
 *
 * @param bytes - 已通过大小/SHA-256 校验的压缩包字节。
 * @returns 中心 `presetId`、正文路径与核心可直接安装的 `PresetRecipe`。
 */
export function decodeDshPresetArchive(bytes: Buffer): EnterprisePresetArchive {
  let entries: readonly ZipArchiveEntry[]
  try {
    entries = readZipEntries(bytes, PRESET_ZIP_LIMITS)
  } catch (error) {
    throw presetError(error, 'ENT_PRESET_RECIPE_INVALID', 'preset archive could not be parsed')
  }
  const manifestEntry = entries.find(entry => entry.path === PRESET_MANIFEST_PATH && entry.isDirectory === false)
  if (manifestEntry?.bytes === undefined) throw invalid('preset archive is missing manifest.json')
  const facts = readPresetManifest(manifestEntry.bytes.toString('utf8'))

  const agentPath = PRESET_AGENT_YML_PATHS.find(path =>
    entries.some(entry => entry.path === path && entry.isDirectory === false))
  const agentEntry = agentPath === undefined
    ? undefined
    : entries.find(entry => entry.path === agentPath && entry.isDirectory === false)
  if (agentPath === undefined || agentEntry?.bytes === undefined) {
    throw invalid('preset archive is missing preset/agent.cordis.yml')
  }
  if (agentEntry.bytes.byteLength === 0) throw invalid('preset agent composition is empty')
  if (agentEntry.bytes.byteLength > PRESET_AGENT_YML_MAX_BYTES) {
    throw invalid('preset agent composition is too large')
  }
  if (agentEntry.bytes.includes(0)) throw invalid('preset agent composition is not text')

  for (const entry of entries) {
    if (entry.path === PRESET_MANIFEST_PATH) continue
    // `zip -r` 打包目录树时会显式写入父目录条目 `preset/`（内核去掉尾斜杠后即 `preset`）：它不是内容，忽略。
    if (entry.isDirectory && entry.path === 'preset') continue
    const segments = entry.path.split('/')
    // 与服务端同一把尺：只允许根或 `preset/` 下的路径（`..`/绝对路径/反斜杠/符号链接已在共享内核里拒掉）。
    if (segments[0] !== 'preset' || segments.length < 2) {
      throw invalid('preset archive contains a path outside manifest.json and preset/')
    }
  }

  const manifest: PresetRecipeManifest = {
    id: facts.id,
    name: facts.name,
    ...(facts.description === undefined ? {} : { description: facts.description }),
    ...(facts.order === undefined ? {} : { order: facts.order }),
  }
  const localMetadata = readPresetLocalMetadata(entries)
  return {
    presetId: facts.id,
    agentYmlPath: agentPath,
    recipe: {
      manifest,
      agentCordisYml: agentEntry.bytes.toString('utf8'),
      ...(localMetadata === undefined ? {} : { localMetadata }),
    },
  }
}
