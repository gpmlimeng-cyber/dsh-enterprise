/**
 * [INPUT]: 依赖 node:crypto 的 createHash、node:fs/promises 的 lstat/readdir/readFile/realpath/stat、node:os 的 homedir、node:path 的 isAbsolute/join/resolve、platform-client 的 `resolveEnterpriseDshHome`、本包 `skill-errors.ts` 的 `EnterpriseSkillInstallError`、`skill-frontmatter.ts` 的 `validateSkillFrontmatter`、`skill-install.ts` 的 `placeEnterpriseSkillArchive`/`readInstalledSkillRecords`/`requireRelativeSkillPath`/`SKILL_CONTENT_FILENAME`/`SKILL_FILE_MAX_DEPTH`/`SKILL_FILE_MAX_ENTRIES`/`SKILL_LOCAL_ROOT_SEGMENTS`/`EnterpriseSkillInstallOptions`/`SkillArchiveEntry` 与 `skill-upload.ts` 的 `installedSelfSkills`/`readSelfInstalledRecords`/`SYSTEM_ADOPT_SOURCE_TYPE`/`upsertSelfInstalledRecord`/`SelfInstalledSkillRecord`/`EnterpriseSelfInstalledSkills`
 * [OUTPUT]: 对外提供口径 62「本地三方 Agent 技能源」的宿主内核 `discoverThirdPartySkills(options)`（**25 个内建根** + 三态候选 + 别名归并 + `skipped` 计数 + `count` 恒等于该根名下条数）与 `installThirdPartySkill(options, path)`（**复制**进 `<dshHome>/skills`），以及 `buildThirdPartySkillRoots`（根表，按 id 区分）、`thirdPartySkillRootId`、`ENTERPRISE_THIRD_PARTY_{ROOT,SKILL}[_OPTIONAL]_KEYS`（逐键清单）、`ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（唯一新码）与两个注入点 `home`/`env`
 * [POS]: bundle 技能纵深的**第四面（只读盘点 + 复制式安装）**——与通路二「系统搜索」（`skill-system.ts`）**共用扫描判据**（一级子目录 + 普通文件 `SKILL.md`、认 frontmatter 的 `name`、canonical 路径去重），但**语义刻意不同**：那条是「只登记」（`adoptSystemSkill`：写自装清单、一个字节都不复制），本面是「**复制**」（`placeEnterpriseSkillArchive`：落点冲突预检 + 暂存 + 逐个原子改名 + 失败整体回滚 + 原子写自装记录）。
 *   ★**为什么必须复制**（口径 54 之后只登记会自相矛盾）：官方 `skill-filesystem` 的根只有 `<dshHome>/skills` 与项目根，
 *   而本面扫的那些根**大多不在**官方扫描范围内 ⇒ 只登记的话 ① Agent 的 `<available_skills>` 里没有它（官方加载不到 =
 *   没真的装）② 界面「已安装」（读官方发现面 = 磁盘真值）也不会显示它。两套语义**并存但各有名字**（`/skills/adopt`
 *   vs `/skills/third-party/install`），是否统一留后续独立裁决（见 `CLAUDE.md` 本刀那行）。
 *   ★**出厂契约（Lead 冻结）**：`roots[]` 必填恰好 `{id,name,present,count,skipped}` + 可选 `aliasOf`
 *   （不是别名就**不给这个键**）；`skills[]` 必填恰好 `{id,name,rootId,sourceName,directory,status}` +
 *   可选 `description` —— ★**技能条目上没有 `aliasOf`**（界面那半边的解码器是封闭键集，多一枚键会让
 *   **整份响应**判畸形），别名信息只记在 `roots[]` 上；★**每枚技能在所有根里只出厂一次**（归最先认领它
 *   canonical 路径的那个根，别名那次**不 push 条目**；别名根照样出现在 `roots[]`、`count:0` ⇒ **归并 ≠ 消失**）；
 *   `count` = 该根名下出厂条数，**恒等于** `skills[]` 里 `rootId === 本根` 的条数（由最终 `skills` 现算）；
 *   `skipped` 是**数**不是列表（响应里不许出现「被跳过的条目」）。
 *   ★**根表是内建常量、不由界面声明**：① Cherry `src/main/ai/skills/systemSkillSources.ts:20-42` 的 **15 个根**逐条搬
 *   （含 `XDG_CONFIG_HOME`/`CLAUDE_CONFIG_DIR`/`CODEX_HOME` 三处环境变量覆盖与各自 fallback，一个不删）；
 *   ② 本机真机普查新增的 **10 个**根（WorkBuddy / 两个市场 / MateClaw / Trae CN / QoderWork CN / Hermes / **DSH 自己的根** / 两条别名根 Junie·Roo）
 *   ⇒ 表里共 **25 个**（`~/.agents/skills`/`~/.claude/skills`/`~/.openclaw/skills` 早已在 Cherry 那 15 个里，不重复造 id）；
 *   ③ 别名根（`~/.qwen/skills`、`~/.junie/skills` …）留在表里、扫描期按 `realpath` 归并成 `aliasOf`。
 *   `agents` 与 `agents-xdg` **同名不同 id**（UI 只能按 `id` 去重/分组）；**工作区/项目根刻意不在根表里**（Cherry 亦如此）。
 *   ★**`path` 一律不出厂**（口径 54 同款纪律）：响应只有 `sourceName`（人话）与 `directory`（目录名），
 *   宿主绝对路径一个字节都不进浏览器（`EnterpriseThirdPartyRoot` 上根本没有 `path` 这一格）；
 *   目录不存在 ⇒ 该根 `present:false` + `count:0`（**不是失败**），但**读不动/扫不动**（根表决议失败、
 *   `readdir` 非 ENOENT/ENOTDIR、`realpath` 失败）⇒ 抛 `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（→503），**绝不静默回空列表**。
 *   ★**丢弃不许静默**：每根带 `skipped`（有 `SKILL.md` 但过不了 frontmatter 闸门的目录数）；**没有** `SKILL.md`
 *   的普通子目录不算、也不计数（它们根本不是技能目录）。
 *   ★**源目录一个字节都不动**（不 move/rsync/删源）：方向只有「源 → `<dshHome>/skills`」单向读，源树只读，
 *   复制载荷在内存里先过一遍闸门，再由既有加固落盘写成新目录。
 *   ★全程零 `exec`/`spawn`、不做动态 import；扫描只读 `SKILL.md`，不读技能正文以外的宿主状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterpriseSkillInstallError, skillInstallError } from './skill-errors.js'
import { validateSkillFrontmatter } from './skill-frontmatter.js'
import type { SkillArchiveEntry } from './skill-archive.js'
import {
  placeEnterpriseSkillArchive,
  readInstalledSkillRecords,
  requireRelativeSkillPath,
  SKILL_CONTENT_FILENAME,
  SKILL_FILE_MAX_DEPTH,
  SKILL_FILE_MAX_ENTRIES,
  SKILL_LOCAL_ROOT_SEGMENTS,
  type EnterpriseSkillInstallOptions,
} from './skill-install.js'
import {
  installedSelfSkills,
  readSelfInstalledRecords,
  SYSTEM_ADOPT_SOURCE_TYPE,
  upsertSelfInstalledRecord,
  type EnterpriseSelfInstalledSkills,
  type SelfInstalledSkillRecord,
} from './skill-upload.js'

/**
 * 本面**唯一**的稳定码：本机三方技能源这次读不动。
 *
 * 与 `skill-discovery.ts` 的 `ENT_SKILL_DISCOVERY_UNAVAILABLE` **同一手法**：刻意不进 platform-client 的
 * `enterpriseLocalErrorStatus` 表、落在表尾默认 **503**（本机这块暂时不可用、可重试）⇒ platform-client
 * 一个字节都不用改。**绝不用空列表代替它**（空列表 = 谎称「本机没有三方技能」）。
 */
export const ENT_SKILL_THIRD_PARTY_UNAVAILABLE = 'ENT_SKILL_THIRD_PARTY_UNAVAILABLE'

/** 根表的静态声明：`id` 是人机共用的稳定键，`name` 只用于显示（**可以重复**）。 */
export interface ThirdPartySkillRootDeclaration {
  /** 稳定 id（`agents` / `agents-xdg` / `claude-code` / `workbuddy` …）。 */
  readonly id: string
  /** 人话来源名（如 `Claude Code`）；★`agents` 与 `agents-xdg` **都是** `Agent Skills`。 */
  readonly name: string
  /** 宿主绝对路径 —— **只在本文件内使用，绝不出厂**（见 `EnterpriseThirdPartyRoot`）。 */
  readonly path: string
}

/** `data.roots[]` 的一条：★**没有** `path` 这一格（宿主绝对路径不进浏览器）。 */
export interface EnterpriseThirdPartyRoot {
  readonly id: string
  readonly name: string
  /** 这个根此刻存在且可列（不存在 ⇒ false + `count: 0`，**不是失败**）。 */
  readonly present: boolean
  /** 归属该根的候选条数（已按 canonical 路径去重后的数；别名根恒 0）。 */
  readonly count: number
  /**
   * 本根下**有 `SKILL.md`（普通文件）但过不了 frontmatter 闸门**的目录数（`name` 缺/非 kebab、`description` 缺…）。
   *
   * ★判据只统计「看着就是技能、但名字/描述不合我们规范」的那些（真机 11 个真根上共 26 枚）。**没有**
   * `SKILL.md` 的普通子目录不算（它们根本不是技能目录；例如 `~/.hermes/skills` 那 14 个子目录、
   * `~/.workbuddy/skills/_bm_skillid_migration.json` 那种文件）—— 把它们算进来就等于说"跳过了 14 个技能"。
   * ★**丢弃不许静默**：这一格就是界面上「另有 N 个目录不符合技能规范，已跳过」那句话的落点。
   * ★**绝不为迁就第三方命名放宽闸门**（`name: Pandas` 大写就是不合规，拒是对的）。
   */
  readonly skipped: number
  /**
   * 该根**是某个已声明根的别名**时给出那个根的 `id`；否则**不给这一格**（不是 `undefined`、也不是空串）。
   *
   * 两条判据都落在**真实路径**上（绝不用 `name` 判别名）：① 根本身的 `realpath` 与先出现过的某个根相同；
   * ② 它的一级候选**全部**已被先出现的根认领（本机形态：别名根里每个技能都是一个符号链接）。
   * 界面据此把「别名、暂无自己的技能」解释清楚，**不重复出 chip**。
   */
  readonly aliasOf?: string
}

/**
 * `data.skills[]` 的一条：必填**恰好** `{id,name,rootId,sourceName,directory,status}` + 可选 `description`。
 *
 * ★**没有** `path`（宿主绝对路径；路径信息只到 `directory`=目录名），也**没有** `aliasOf`
 *   （别名只记在 `roots[]` 上；每枚技能在所有根里**只出厂一次**）。
 */
export interface EnterpriseThirdPartySkill {
  /** `sha256(realpath)` 前 16 位（稳定可复算；与既有通路二同款）。 */
  readonly id: string
  /** **frontmatter 的技能名**（官方 watcher 认的就是它，也是复制进 `<dshHome>/skills` 的目录名）。 */
  readonly name: string
  readonly description: string
  readonly rootId: string
  /** 人话来源名（该根的 `name`）；★重名根靠 `rootId` 区分，不许按它去重。 */
  readonly sourceName: string
  /** 该技能目录的**目录名**（不是路径）。 */
  readonly directory: string
  readonly status: 'available' | 'installed' | 'conflict'
  // ★**本形状没有 `aliasOf`**：`aliasOf` 只允许出现在 `roots[]` 上（界面那半边的解码器是
  //   「六键必填 + 可选 `description`」的封闭键集，技能条目多一枚键会让**整份响应**判畸形）。
  //   别名信息由「别名根那条 root 带 aliasOf」+「每枚技能只出厂一次」两句一起说清。
}

/** `GET /enterprise/api/v1/local/skills/third-party` 的本地投影。 */
export interface EnterpriseThirdPartySkills {
  readonly roots: readonly EnterpriseThirdPartyRoot[]
  readonly skills: readonly EnterpriseThirdPartySkill[]
}

/** `data.roots[]` 的逐键清单（顺序即响应里的键序，用例按它做集合断言）。 */
export const ENTERPRISE_THIRD_PARTY_ROOT_KEYS = ['id', 'name', 'present', 'count', 'skipped'] as const

/** `data.roots[]` 的**可选**键（只有真的是别名根才出现）。 */
export const ENTERPRISE_THIRD_PARTY_ROOT_OPTIONAL_KEYS = ['aliasOf'] as const

/** `data.skills[]` 的**必填**键清单（界面那侧的锁：六键必填 + 可选 `description`）。 */
export const ENTERPRISE_THIRD_PARTY_SKILL_KEYS = [
  'id',
  'name',
  'rootId',
  'sourceName',
  'directory',
  'status',
] as const

/** `data.skills[]` 的**可选**键（只有这一枚，且只可能是 `description`）。★`aliasOf` **不在**技能条目上。 */
export const ENTERPRISE_THIRD_PARTY_SKILL_OPTIONAL_KEYS = ['description'] as const

/**
 * 根表决议与 dshHome 之外的注入点：`home` 缺省 `homedir()`、`env` 缺省 `process.env`。
 *
 * 三个环境变量覆盖与 Cherry `resolveHomePath` 逐字同款：`configured?.trim()` 为真则
 * `resolve(home, value)`（**相对值按 home 解**，这是上游的原样行为），否则 `join(home, ...fallback)`。
 * 判据全部落在**调用时**（没有可缓存的状态），故测试可以给一份真实临时 home 来锁根表。
 */
export interface EnterpriseThirdPartySkillOptions extends EnterpriseSkillInstallOptions {
  readonly home?: string
  readonly env?: Readonly<Record<string, string | undefined>>
}

/** 扫描期的一条候选（= 出厂那条技能加一枚内核事实：canonical 路径，去重键与安装时的比对依据）。 */
interface ScannedThirdPartyCandidate {
  /** 出厂那条（`id`/`name`/`description`/`rootId`/`sourceName`/`directory`/`status`/`aliasOf?`）。 */
  readonly skill: EnterpriseThirdPartySkill
  /** `realpath(<根>/<目录名>)`。 */
  readonly canonicalPath: string
}

interface ScannedThirdPartyRoot extends ThirdPartySkillRootDeclaration {
  readonly present: boolean
  /** `realpath(<path>)`；根不存在/不可解析 ⇒ undefined（此时 `present` 恒 false，且**不扫**）。 */
  readonly resolvedPath: string | undefined
  /** 该根是某个**先出现**的根的别名时给出那个根的 id。 */
  readonly aliasOf: string | undefined
  /** 本根下「有 `SKILL.md` 但过不了 frontmatter 闸门」的目录数（丢弃**不许静默**）。 */
  readonly skipped: number
  readonly candidates: readonly ScannedThirdPartyCandidate[]
}

/** 出厂投影的**精确**形状（★与端口契约逐字一致：`path` 与 `resolvedPath` 都不在这里）。 */
interface ThirdPartyProjection extends EnterpriseThirdPartySkills {
  readonly roots: readonly EnterpriseThirdPartyRoot[]
}

/**
 * 一次盘点的**两相**：出厂投影（路由直接回）与扫描期根（安装那一侧复核落点等式时用）。
 *
 * ★出厂契约（Lead 冻结，界面那半边的封闭解码器是它的锁）：`roots[]` 必填 `{id,name,present,count,skipped}`
 * + 可选 `aliasOf`；`skills[]` 必填**恰好** `{id,name,rootId,sourceName,directory,status}` + 可选 `description`
 * （**技能条目上没有 `aliasOf`**）；每枚技能在所有根里**只出现一次**；
 * `roots[].count === skills[] 里 rootId === 本根 的条数`。
 */
interface ThirdPartyDiscovered {
  readonly projection: ThirdPartyProjection
  readonly roots: readonly ScannedThirdPartyRoot[]
}

/** 读 `SKILL.md` 的单文件上限：与包内 frontmatter 闸门同一条 256 KiB（超出即「读不到」）。 */
const SKILL_MD_MAX_BYTES = 256 * 1024
/** 入参 `path` 的形状上限：与既有通路二 `MAX_ADOPT_PATH_LENGTH` 同一条 1024（不引第二套数）。 */
const MAX_THIRD_PARTY_PATH_LENGTH = 1024
/** 复制一棵源子树时读入内存的总字节上限（与既有摘要预算 `MAX_DIGEST_TOTAL_BYTES` 同量级）。 */
const MAX_SOURCE_TREE_BYTES = 20 * 1024 * 1024
/** id 的截断长度（`sha256(realpath)` 前 16 位，与既有通路二的候选 id 同款）。 */
const THIRD_PARTY_ID_LENGTH = 16

/** 扫描期的任何意外失败都收在这一枚码上（本机这块这次读不动），**绝不静默回空列表**。 */
function unavailable(error: unknown, message: string): EnterpriseSkillInstallError {
  return error instanceof EnterpriseSkillInstallError
    ? error
    : new EnterpriseSkillInstallError(ENT_SKILL_THIRD_PARTY_UNAVAILABLE, message, { cause: error })
}

/** `realpath` 的 ENOENT 语义：不是故障，是「不在那儿」（根不存在 ⇒ present:false）。 */
async function realpathOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EINVAL' || code === 'ELOOP') return undefined
    throw error
  }
}

/**
 * 一条一级子目录的**判定结果**（`skipped` 与「不是技能目录」的分界就在这一枚 `hasFrontmatter`）。
 *
 * `hasFrontmatter` 的定义：该子目录下有一份**普通文件** `SKILL.md`（`lstat` 不跟随符号链接）且 ≤256 KiB。
 * 只有这种目录才可能是「看着像技能」的；没有 `SKILL.md` 的普通子目录**根本不是技能目录**（不计、不报）。
 */
interface ThirdPartyDirectoryFacts {
  readonly hasFrontmatter: boolean
  readonly facts: { readonly skillName: string, readonly description: string } | undefined
}

/**
 * 读一条一级子目录里那份 `SKILL.md` 的 **frontmatter 事实**。
 *
 * ★与 `skill-system.ts` 的 `skillFacts` **同一把尺**：候选与否判的是 frontmatter 的 `name`、**不是目录名**
 * （官方 watcher `dsh-skill-filesystem/lib/index.js:679`/`:685` 只认它，`name`/`description` 缺一不可）。
 * ★返回两件事而不是一件，因为调用方要分开说两句话：① 「有 `SKILL.md` 但名字/描述不合规」⇒ **计入 `skipped`**
 * （丢弃不许静默）；② 「连 `SKILL.md` 都没有」⇒ 根本不是技能目录，**不计数**。
 */
async function skillFacts(directory: string): Promise<ThirdPartyDirectoryFacts> {
  try {
    const target = join(directory, SKILL_CONTENT_FILENAME)
    const stats = await lstat(target)
    if (!stats.isFile() || stats.size > SKILL_MD_MAX_BYTES) return { hasFrontmatter: false, facts: undefined }
    try {
      const parsed = validateSkillFrontmatter(await readFile(target), directory)
      return { hasFrontmatter: true, facts: { skillName: parsed.name, description: parsed.description } }
    } catch {
      // 有 SKILL.md 但**过不了闸门**（name 缺/非 kebab、description 缺…）：这是 `skipped` 那一格。
      return { hasFrontmatter: true, facts: undefined }
    }
  } catch {
    return { hasFrontmatter: false, facts: undefined }
  }
}

/** `sha256(realpath)` 前 16 位：稳定可复算，且**不含**路径本身（路径不进响应体）。 */
export function thirdPartySkillRootId(canonicalPath: string): string {
  return createHash('sha256').update(canonicalPath).digest('hex').slice(0, THIRD_PARTY_ID_LENGTH)
}

/** 排除判据用到的路径段（检出/项目树常见的容器；大小写敏感，与真实目录名一致）。 */
const PROJECT_PATH_SEGMENTS: ReadonlySet<string> = new Set(['Downloads', 'Documents', '资料'])
/** 本仓测试脚手架的家目录段：`~/.sshwork` 下的临时 dshHome 是夹具，永远不是用户的技能库。 */
const TEST_SCAFFOLD_SEGMENT = '.sshwork'

/**
 * 这个根要不要**从表里剔除**（五类排除里能静态判定的四类；别名那类走扫描期 `aliasOf`）。
 *
 * 逐条（每条都能在真机上指出反例，故不许静默丢 —— 反例都写在 `buildThirdPartySkillRoots` 的注释里）：
 *  ① **测试脚手架**：路径落在 `<home>/.sshwork` 之下 ⇒ 剔除（那是本仓 `tests/*.spec.ts` 的临时夹具）；
 *  ② **检出/项目树**：从 `home` 到该根的**祖先段**里出现 `.git`（检出）或 `Downloads`/`Documents`/`资料`
 *     （项目树常驻容器）⇒ 剔除（项目根归官方 `listLocal()`，Cherry 亦不列）；
 *  ③ **内置/包内**：祖先段里出现 `builtin` 或 `skill-packages` 或 `connectors-marketplace`
 *     （`~/.trae-cn/builtin/<套件>/skills`、`~/.octop/skill-packages/<包>/skills`、连接器市场包）⇒ 剔除；
 *  ④ **嵌套**：路径里出现**两段以上** `skills`（`…/skills/<x>/skills`）⇒ 剔除（那不是根，是技能内部的子目录）。
 *
 * ★只吃**祖先段**（去掉最后那段 `skills`）：段名判据因此不会被 `~/.trae-cn/skills` 这种合法根误伤。
 *
 * @param path - 待判定根的绝对路径。
 * @param home - 用户目录（判据只在该目录之下成立；测试脚手架与容器段都在它之下）。
 * @returns 命中任一条即 true（剔除）。
 */
function thirdPartyRootExcluded(path: string, home: string): boolean {
  const split = (value: string): string[] => resolve(value).split(/[\\/]+/).filter(segment => segment !== '')
  const segments = split(path)
  const homeSegments = split(home)
  // 只取 `home` 之后的段（含根自己的最后一段）；不在 `home` 之下的根一律不按这些段名剔除。
  const under = homeSegments.every((segment, index) => segments[index] === segment)
  const relative = under ? segments.slice(homeSegments.length) : segments
  // ④ 嵌套 `skills/<x>/skills`（根自己那一段 `skills` 不计）。
  if (relative.filter(segment => segment === 'skills').length > 1) return true
  const ancestors = relative.slice(0, -1)
  // ② 检出/项目树。
  if (ancestors.includes('.git')) return true
  if (ancestors.some(segment => PROJECT_PATH_SEGMENTS.has(segment))) return true
  // ③ 内置/包内/连接器市场包。
  if (ancestors.some(segment => segment === 'builtin' || segment === 'skill-packages' || segment === 'connectors-marketplace')) return true
  // ① 测试脚手架（`~/.sshwork` 本身或它下面任何一层）。
  if (relative.includes(TEST_SCAFFOLD_SEGMENT)) return true
  return false
}

/**
 * 根表：**内建常量**，不由界面声明（口径 62 §3.1）。
 *
 * 三段构成，顺序即响应顺序（确定性）：
 *  ① Cherry `systemSkillSources.ts:20-42` 的 **15 个根**逐条搬（三个环境变量覆盖规则与上游逐字同款：
 *     `resolveHomePath`：`configured?.trim()` 为真 ⇒ `resolve(home, value)`，否则 `join(home, ...fallback)`）；
 *     ★**照旧全留在表里**（别的机器上它们是真根，本机多数为 0 枚 —— 绝不为"本机没有"删根）。
 *  ② 本机真机普查新增的根（2026-10-09，深度 ≤4 全量普查里**真有技能**的那些）：`~/.workbuddy/skills`、
 *     `~/.workbuddy/skills-marketplace/skills`（与上一根**仅 23 枚同名**、是独立来源 ⇒ 单列一根）、
 *     `~/.codebuddy/skills-marketplace/skills`、`~/.mateclaw/skills`、`~/.trae-cn/skills`、
 *     `~/.qoderworkcn/skills`、`~/.hermes/skills`，以及**我们自己的根** `~/.dsh/skills`
 *     （它答的是"用户自己的技能"，`status` 多为 installed，与上面那些第三方根并列展示）。
 *  ③ 别名根（`~/.junie/skills`、`~/.roo/skills` 等本机 40+ 个，实参多为 `~/.agents/skills`）：**也留在表里**，
 *     扫描期按 `realpath` 归并成 `aliasOf`，界面据此解释、**不重复出 chip**（判据在 `thirdPartyDiscovery`）。
 *
 * ★`agents` 与 `agents-xdg` 的 `name` **都是** `Agent Skills`（上游真实如此）⇒ 一律靠 `id` 区分。
 * ★**工作区/项目根不在本表里**（上游注释逐字：「These are discovery roots only. Workspace/project roots
 *   are intentionally absent because they are handled by SkillService.listLocal()」）。
 *
 * ── 本机不纳入的五类（**逐条登记，绝不静默丢**；静态四条见 `thirdPartyRootExcluded`）────────────
 *  1. **本仓测试脚手架** `~/.sshwork/dbg-home-*` / `~/.sshwork/dbg-dsh-*`：那是测试夹具、不是用户的库 ⇒
 *     **表里根本不出现**（本表没声明任何 `~/.sshwork` 路径；`thirdPartyRootExcluded` 再兜一道）。
 *  2. **检出/项目树**（祖先里有 `.git`、或路径段是 `Downloads`/`Documents`/`资料`）：`~/WorkBuddy/AionUi/.claude/skills`、
 *     `~/DPH/halo-dsh/.agents/skills`、`~/Documents/HIWORK/skillhub/…`、`~/资料/AgentPro/…` ⇒ 不进表
 *     （项目根归官方发现面，Cherry 也是 intentionally absent）。
 *  3. **内置/包内**：`~/.trae-cn/builtin/<套件>/skills`、`~/.octop/skill-packages/<包>/skills`、以及嵌套的
 *     `…/skills/<x>/skills` ⇒ 不进表。
 *  4. **连接器市场包** `~/.workbuddy/connectors-marketplace/connectors/<连接器>/skills`（数百个）⇒ v1 明确不列，
 *     **已知噪音**（它们是连接器自带的技能副本，不是用户的技能库）。
 *  5. **符号链接别名**：不删根，但扫描期按 `realpath` 归并进 `aliasOf`（见上）。
 *
 * @param home - 用户目录（测试注入真实临时 home；缺省 `homedir()`）。
 * @param env - 环境（缺省 `process.env`）；只读三个变量，其余一律不看。
 * @returns 根表（顺序即响应顺序；确定性）。
 */
export function buildThirdPartySkillRoots(
  home: string = homedir(),
  env: Readonly<Record<string, string | undefined>> = process.env,
): readonly ThirdPartySkillRootDeclaration[] {
  const resolveHomePath = (configured: string | undefined, fallback: readonly string[]): string => {
    const value = configured?.trim()
    return value !== undefined && value !== '' ? resolve(home, value) : join(home, ...fallback)
  }
  const configHome = resolveHomePath(env['XDG_CONFIG_HOME'], ['.config'])
  const claudeHome = resolveHomePath(env['CLAUDE_CONFIG_DIR'], ['.claude'])
  const codexHome = resolveHomePath(env['CODEX_HOME'], ['.codex'])
  const declared: readonly ThirdPartySkillRootDeclaration[] = [
    // ① Cherry 那 15 个（逐条搬，一个不删）。
    { id: 'agents', name: 'Agent Skills', path: join(home, '.agents', 'skills') },
    { id: 'agents-xdg', name: 'Agent Skills', path: join(configHome, 'agents', 'skills') },
    { id: 'claude-code', name: 'Claude Code', path: join(claudeHome, 'skills') },
    { id: 'codex', name: 'Codex', path: join(codexHome, 'skills') },
    { id: 'cursor', name: 'Cursor', path: join(home, '.cursor', 'skills') },
    { id: 'gemini-cli', name: 'Gemini CLI', path: join(home, '.gemini', 'skills') },
    { id: 'github-copilot', name: 'GitHub Copilot', path: join(home, '.copilot', 'skills') },
    { id: 'opencode', name: 'OpenCode', path: join(configHome, 'opencode', 'skills') },
    { id: 'openclaw', name: 'OpenClaw', path: join(home, '.openclaw', 'skills') },
    { id: 'clawdbot', name: 'ClawdBot', path: join(home, '.clawdbot', 'skills') },
    { id: 'moltbot', name: 'MoltBot', path: join(home, '.moltbot', 'skills') },
    { id: 'qoder', name: 'Qoder', path: join(home, '.qoder', 'skills') },
    { id: 'qoder-cn', name: 'Qoder CN', path: join(home, '.qoder-cn', 'skills') },
    { id: 'qwen-code', name: 'Qwen Code', path: join(home, '.qwen', 'skills') },
    { id: 'minimax-code', name: 'MiniMax Code', path: join(home, '.minimax', 'skills') },
    // ② 本机真机普查新增。
    { id: 'workbuddy', name: 'WorkBuddy', path: join(home, '.workbuddy', 'skills') },
    { id: 'workbuddy-marketplace', name: 'WorkBuddy 市场', path: join(home, '.workbuddy', 'skills-marketplace', 'skills') },
    { id: 'codebuddy-marketplace', name: 'CodeBuddy 市场', path: join(home, '.codebuddy', 'skills-marketplace', 'skills') },
    { id: 'mateclaw', name: 'MateClaw', path: join(home, '.mateclaw', 'skills') },
    { id: 'trae-cn', name: 'Trae CN', path: join(home, '.trae-cn', 'skills') },
    { id: 'qoderworkcn', name: 'QoderWork CN', path: join(home, '.qoderworkcn', 'skills') },
    { id: 'hermes', name: 'Hermes', path: join(home, '.hermes', 'skills') },
    //    ★我们自己的根也进表（用户自己的技能），`status` 多为 installed。
    { id: 'dsh', name: 'DSH', path: join(home, '.dsh', 'skills') },
    // ③ 别名根（本机实测 40+ 个，实参多为 `~/.agents/skills`）：留在表里，扫描期按 realpath 归并成 `aliasOf`。
    { id: 'junie', name: 'Junie', path: join(home, '.junie', 'skills') },
    { id: 'roo', name: 'Roo Code', path: join(home, '.roo', 'skills') },
  ]
  // ★排除兜底（见函数头五类登记）：剔除检出/项目树、内置/包内、嵌套 `skills/<x>/skills`、测试脚手架。
  return declared.filter(root => !thirdPartyRootExcluded(root.path, home))
}

/**
 * 扫一个根：不存在 ⇒ `present:false` + 零候选（**不是失败**）；可列但扫不动 ⇒ 抛明确失败码。
 *
 * ★纪律与既有通路二**相反的一处**（有意为之，不是漏抄）：通路二对 `readdir` 的其余错误（EACCES 等）
 * 只留痕、返回空候选；本面**不许那样** —— 把「读不了」显示成「这一根没有技能」正是本维度最不能有的假话，
 * 故非 ENOENT/ENOTDIR 一律抛 `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`。
 *
 * ★候选判据（与通路二同一把尺，别名那一条是本面新增）：
 *  ① `lstat` 判身份：真目录 ⇒ 直接收；**目录符号链接 ⇒ 跟随一次**（本机实测 `~/.qwen/skills/brandkit`
 *     就是指向 `~/.agents/skills/brandkit` 的链接），跟随的目标必须是目录，否则跳过（它自己的身份是链接）；
 *  ② 目标目录里要有普通文件 `SKILL.md`（没有 ⇒ 不是技能目录，**不计 skipped**）；
 *  ③ frontmatter 闸门（`name` 合法 + `description` 在）——不过 ⇒ **计入 `skipped`**，且**不进候选**。
 *  别名归并不在这里判（交给 `thirdPartyDiscovery` 按 canonical 路径的先出现者）。
 *
 * @param root - 根表里的一条。
 * @returns 是否可列、`realpath`、候选（含 canonical 路径）与 `skipped` 计数。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`：非 ENOENT/ENOTDIR 的读失败、
 *   或某个候选目录 `realpath` 解析失败（**绝不折成"这一根没有技能"**）。
 */
async function listThirdPartyRoot(
  root: ThirdPartySkillRootDeclaration,
): Promise<{
    present: boolean
    resolvedPath: string | undefined
    candidates: readonly ScannedThirdPartyCandidate[]
    skipped: number
  }> {
  let entries
  try {
    entries = await readdir(root.path, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { present: false, resolvedPath: undefined, candidates: [], skipped: 0 }
    }
    throw unavailable(error, 'a third-party skill root could not be listed')
  }
  const resolvedPath = await realpathOrUndefined(root.path)
  // 可列却解析不出真实路径（竞态/权限）：**不假装它没有候选**，如实失败。
  if (resolvedPath === undefined) throw unavailable(undefined, 'a third-party skill root could not be resolved')
  const candidates: ScannedThirdPartyCandidate[] = []
  let skipped = 0
  // 目录项按名字码元升序处理：同一份磁盘内容每次都得到同一个顺序（响应的确定性从一开始就定下）。
  const sorted = [...entries].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  for (const entry of sorted) {
    const absolutePath = join(root.path, entry.name)
    let isDirectory = entry.isDirectory()
    if (!isDirectory && entry.isSymbolicLink()) {
      // 目录符号链接：跟随**一次**（`stat` 跟随链接），目标必须是目录 —— 这正是本机别名根的形态。
      isDirectory = (await stat(absolutePath).catch(() => undefined))?.isDirectory() === true
    }
    if (!isDirectory) continue
    const directory = join(resolvedPath, entry.name)
    const observed = await skillFacts(directory)
    // 没有 `SKILL.md` 的普通子目录**不是技能目录**：既不列、也不计入 `skipped`（把它算进来就是假话）。
    if (!observed.hasFrontmatter) continue
    if (observed.facts === undefined) {
      // 看着就是技能、但名字/描述不合我们规范 ⇒ 计数 + 不列（**绝不放宽闸门去迁就第三方命名**）。
      skipped += 1
      continue
    }
    const canonicalPath = await realpathOrUndefined(directory)
    if (canonicalPath === undefined) throw unavailable(undefined, 'a third-party skill directory could not be resolved')
    candidates.push({
      canonicalPath,
      skill: {
        id: thirdPartySkillRootId(canonicalPath),
        name: observed.facts.skillName,
        description: observed.facts.description,
        rootId: root.id,
        sourceName: root.name,
        directory: entry.name,
        status: 'available',
      },
    })
  }
  return { present: true, resolvedPath, candidates, skipped }
}

/** 已装占用面的两个集合：技能**名**（记录里的 kebab 名）与 `<dshHome>/skills` 下的**目录名**。 */
interface InstalledOccupancy {
  readonly names: ReadonlySet<string>
  readonly directoryNames: ReadonlySet<string>
}

async function installedOccupancy(options: EnterpriseSkillInstallOptions): Promise<InstalledOccupancy> {
  const names = new Set<string>()
  for (const record of await readInstalledSkillRecords(options)) for (const name of record.names) names.add(name)
  for (const record of await readSelfInstalledRecords(options)) for (const name of record.names) names.add(name)
  const directoryNames = new Set<string>()
  const root = join(
    resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    ...SKILL_LOCAL_ROOT_SEGMENTS,
  )
  try {
    // 目录符号链接也算「这个名字被占了」：复制过去只会撞上它。
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.isSymbolicLink()) directoryNames.add(entry.name)
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // 还没装过任何技能 ⇒ 这个根本来就不存在：空集合是**事实**，不是降级。
    if (code !== 'ENOENT' && code !== 'ENOTDIR') throw unavailable(error, 'the installed skill root could not be listed')
  }
  return { names, directoryNames }
}

/** 折叠名（`toLowerCase()`）是否被**别的**名字占用（与既有通路二的 `foldedNameTaken` 同一判据）。 */
function foldedNameTaken(name: string, names: Iterable<string>): boolean {
  const folded = name.toLowerCase()
  for (const other of names) {
    if (other !== name && other.toLowerCase() === folded) return true
  }
  return false
}

/**
 * 三态（口径 62 §3.2）：
 *  · `installed` —— **技能名**已存在（`<dshHome>/skills/<name>` 目录在，或本机自装/企业记录里有它）；
 *  · `conflict`  —— 技能名没被占，但**目录名**被另一个**不同技能**占用（自家根下同名目录声明的是别的技能名，
 *    或本次扫描里另一条候选目录名相同而技能名不同）—— 复制过去会覆盖别人的目录，故不可装；
 *  · `available` —— 两者都没命中。
 *
 * ★判据全部落在**本机事实**（磁盘目录名 ∪ 两份记录的技能名 ∪ 本次扫描的 directory ↔ name 配对）上，
 *   不猜、不用来源根的路径去推。
 */
function statusOf(
  candidate: ScannedThirdPartyCandidate,
  entries: readonly ScannedThirdPartyCandidate[],
  occupancy: InstalledOccupancy,
): EnterpriseThirdPartySkill['status'] {
  const name = candidate.skill.name
  if (occupancy.names.has(name) || occupancy.directoryNames.has(name)) return 'installed'
  if (foldedNameTaken(name, occupancy.names)) return 'conflict'
  if (occupancy.directoryNames.has(candidate.skill.directory)) return 'conflict'
  for (const other of entries) {
    if (other.canonicalPath === candidate.canonicalPath) continue
    // 判据一：另一条候选的**技能名**就是这一条的**目录名** ⇒ 这一条要落进去的那个目录名，
    // 已经被另一个不同技能的名字占着（两条都装就必然有一条覆盖另一条）。
    if (other.skill.name === candidate.skill.directory && other.skill.name !== name) return 'conflict'
    // 判据二：两条候选的**目录名**相同而技能名不同 ⇒ 同名目录里装的是两个不同技能。
    if (other.skill.directory !== candidate.skill.directory) continue
    if (other.skill.name !== name) return 'conflict'
  }
  return 'available'
}

/**
 * 一次盘点：根表 → 逐根扫 → canonical 去重（+ 别名归并）→ 三态 → 投影（**顺序确定**：根表序 + 根内 `name` 码元升序）。
 *
 * 去重键是 **canonical 路径**（不是技能名）：同一个真实目录被多个根命中**只出厂一次**、归属取**先出现**的根；
 * 后来那些根若**自己一个新候选都没带来**，就在 `roots[]` 上带 `aliasOf`（界面据此解释「这是别名根」）。
 * ★别名根照样出现在 `roots[]` 里（`count:0`）⇒ **归并 ≠ 消失**（不静默丢）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口，以及 `home`/`env` 注入点。
 * @returns 根清单（含 `present`/`count`/`skipped`/`aliasOf?`）与候选清单（**不含任何宿主绝对路径**）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`：根表决议失败 / 某根列不动 /
 *   某条候选解析不出真实路径（**绝不折成空列表**）。
 */
async function thirdPartyDiscovery(options: EnterpriseThirdPartySkillOptions): Promise<ThirdPartyDiscovered> {
  const home = options.home ?? homedir()
  const env = options.env ?? process.env
  const occupancy = await installedOccupancy(options)
  // 主根（`<dshHome>/skills`）不在本根表里，它只作为上面 `occupancy` 的"已装"判据来源；
  // 而 `~/.dsh/skills` 作为**用户自己的技能根**在表里（id `dsh`）。
  const declarations = buildThirdPartySkillRoots(home, env)
  // canonical 路径 → **先认领它的那个根 id**：这是 `roots[].aliasOf` 的唯一依据（绝不按 `name` 判别名）。
  const claimedBy = new Map<string, string>()
  // 根的真实路径 → 先出现的根 id（同一个真实目录声明了两次 ⇒ 后一个是别名根）。
  const rootOwner = new Map<string, string>()
  const scanned: ScannedThirdPartyRoot[] = []
  const candidates: ScannedThirdPartyCandidate[] = []
  for (const declaration of declarations) {
    const listed = await listThirdPartyRoot(declaration)
    const kept: ScannedThirdPartyCandidate[] = []
    // ★`preOwned` 必须在**本根认领之前**记下来：判据 ② 是「它列到的每一条**先前就已被别的根认领**」，
    //   放到认领之后再看的话，任何一根都会「被自己认领」而误判成别名根（真机复现过：canonical 根
    //   自己带 `aliasOf: 自己`）。这是本函数唯一一处顺序敏感的判定，别顺手挪。
    const preOwned: string[] = []
    for (const candidate of listed.candidates) {
      const owner = claimedBy.get(candidate.canonicalPath)
      // ★**别名那次不出厂**：同一个真实技能（canonical 路径）在所有根里**只出厂一次**、归最先认领它的根。
      //   `aliasOf` 只记在**根**上（见下），技能条目形状因此恒为「六键必填 + 可选 description」。
      if (owner !== undefined) {
        preOwned.push(owner)
        continue
      }
      claimedBy.set(candidate.canonicalPath, declaration.id)
      kept.push(candidate)
      candidates.push(candidate)
    }
    // ★别名根的判据（全部落在**真实路径 / 认领记录**上，不用名字）：它**自己一个新候选都没带来** ——
    //   ① 根本身 realpath 与先出现过的某个根相同（整根就是一个链接）；或
    //   ② 它列到了候选，但**每一条都先前已被别的根认领**（本机形态：别名根里每个技能都是符号链接）。
    //   ⇒ `aliasOf` = 认领根 id（判据 ② 取第一条被认领候选的认领者）。**混合根**（自己带来了新候选）**不给**这一格。
    //   ★查 `rootOwner` 必须在**把本根登记进去之前**（否则自己就成了自己的别名）。
    let aliasOf = listed.resolvedPath !== undefined ? rootOwner.get(listed.resolvedPath) : undefined
    if (aliasOf === undefined && listed.candidates.length > 0 && preOwned.length === listed.candidates.length) {
      aliasOf = preOwned[0]
    }
    if (listed.resolvedPath !== undefined && !rootOwner.has(listed.resolvedPath)) {
      rootOwner.set(listed.resolvedPath, declaration.id)
    }
    scanned.push({
      id: declaration.id,
      name: declaration.name,
      path: declaration.path,
      present: listed.present,
      resolvedPath: listed.resolvedPath,
      aliasOf,
      skipped: listed.skipped,
      candidates: kept,
    })
  }
  const skills: EnterpriseThirdPartySkill[] = candidates.map(candidate => ({
    ...candidate.skill,
    status: statusOf(candidate, candidates, occupancy),
  }))
  // 确定性排序：先**根表顺序**（不是 id 序），根内按技能名码元升序；同名再按目录名定序（同根内可能重名）。
  const rootOrder = new Map(declarations.map((declaration, index) => [declaration.id, index]))
  skills.sort((left, right) => {
    const leftRoot = rootOrder.get(left.rootId) ?? Number.MAX_SAFE_INTEGER
    const rightRoot = rootOrder.get(right.rootId) ?? Number.MAX_SAFE_INTEGER
    if (leftRoot !== rightRoot) return leftRoot - rightRoot
    if (left.name !== right.name) return left.name < right.name ? -1 : 1
    if (left.directory === right.directory) return 0
    return left.directory < right.directory ? -1 : 1
  })
  // ★`count` 由最终 `skills` **现算**（不是扫描时累加）：出厂契约要求
  //   `roots[].count` 与 `skills[]` 里 `rootId === 本根` 的条数**逐字相等**（含别名那几条）——
  //   两处各写一遍迟早打架，那就必然有一个是假的。`count: 0` 因此恰好等价于"这个根名下没有条"。
  const countOf = (rootId: string): number => skills.filter(skill => skill.rootId === rootId).length
  // ★出厂投影：**从零构造**（不是"删掉 path"），任何输入下都不可能漏出宿主绝对路径；
  //   可选键只在真的有值时出现（不是别名就不给这一格，也不给 `undefined`）。
  return {
    projection: {
      roots: scanned.map(root => ({
        id: root.id,
        name: root.name,
        present: root.present,
        count: countOf(root.id),
        ...(root.aliasOf === undefined ? {} : { aliasOf: root.aliasOf }),
        skipped: root.skipped,
      })),
      skills,
    },
    roots: scanned,
  }
}

/**
 * 盘点本机**三方 Agent 技能源**（口径 62 的只读面）。
 *
 * 空列表是**合法结果**（本机一枚三方技能都没有）；目录不存在 ⇒ 该根 `present:false` + `count:0`。
 * 扫描抛错/根表读不动 ⇒ 抛 `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（路由投影 503），**绝不静默回空列表**。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口，以及 `home`/`env` 注入点。
 * @returns `{roots, skills}`：**完全不含**宿主绝对路径（`path` 一律不出厂）。
 */
export async function discoverThirdPartySkills(
  options: EnterpriseThirdPartySkillOptions,
): Promise<EnterpriseThirdPartySkills> {
  try {
    return (await thirdPartyDiscovery(options)).projection
  } catch (error) {
    throw unavailable(error, 'third-party skill sources could not be scanned')
  }
}

/** 复制的来源：一棵已经过闸门、读进内存的源技能树（**源目录此后一个字节都不再被读**）。 */
interface SourceTree {
  readonly files: readonly { readonly path: string, readonly bytes: Buffer }[]
  /** 与 `digestSkillDirectory` **逐字节同口径**的内容摘要（同一遍读取算出来，不重读磁盘）。 */
  readonly sha256: string
}

/**
 * 把一棵源技能目录读进内存并**同时**算内容摘要（供自装记录那一枚 `sha256` 用）。
 *
 * ★纪律：**源目录只读**（`readdir` + `readFile`，全程零写操作）；`lstat` 不跟随符号链接 ⇒ 任何符号链接
 * 条目**直接跳过**（既不进复制载荷、也不进摘要），故源树之外的字节永远不会被读、被复制。
 * ★摘要口径与 `digestSkillDirectory` 逐字相同（目录 `dir\0path\0`、文件 `file\0path\0size\0<bytes>\0`、
 * 其它 `other\0path\0`，条目按名字码元升序）：**没有符号链接的源目录上两者必须给出同一个摘要** —— 用例里
 * 用 `digestSkillDirectory` 对同一棵源树做等式断言（本刀就是靠那条等式抓出这里少写/多写了一个 NUL）。
 * 超限（条目数 > `SKILL_FILE_MAX_ENTRIES`、深度 > `SKILL_FILE_MAX_DEPTH`、总字节 > `MAX_SOURCE_TREE_BYTES`）
 * 一律抛 `ENT_SKILL_INSTALL_FAILED`（本机完不成这次复制，重试同样不会变好）。
 */
async function readSourceTree(directory: string): Promise<SourceTree> {
  const hash = createHash('sha256')
  const files: { path: string, bytes: Buffer }[] = []
  const budget = { entries: 0, bytes: 0 }
  const walk = async (current: string, prefix: string, depth: number): Promise<void> => {
    if (depth > SKILL_FILE_MAX_DEPTH) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_INSTALL_FAILED', 'the third-party skill directory is too deep to copy')
    }
    const entries = [...await readdir(current, { withFileTypes: true })]
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    for (const entry of entries) {
      budget.entries += 1
      if (budget.entries > SKILL_FILE_MAX_ENTRIES) {
        throw new EnterpriseSkillInstallError('ENT_SKILL_INSTALL_FAILED', 'the third-party skill directory has too many entries')
      }
      const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      const absolutePath = join(current, entry.name)
      // 符号链接一律跳过：`readdir` 的 dirent 来自 lstat，故这里判的是它**自己**的身份。
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        // ★与 `digestInto` 逐字同源：目录标记是 `dir\0<相对路径>\0`（**一个** NUL），别写成两个。
        hash.update(`dir\0${relativePath}\0`)
        await walk(absolutePath, relativePath, depth + 1)
        continue
      }
      if (entry.isFile()) {
        const stats = await lstat(absolutePath)
        budget.bytes += stats.size
        if (budget.bytes > MAX_SOURCE_TREE_BYTES) {
          throw new EnterpriseSkillInstallError('ENT_SKILL_INSTALL_FAILED', 'the third-party skill directory is too large to copy')
        }
        // 与 `digestSkillDirectory` 逐字同源的三段喂入（顺序也不能变）：类型+相对路径 → 尺寸 → 字节。
        // 只在**这一遍**读到内存，字节既进摘要也进复制载荷（同一份，不重读磁盘）。
        const bytes = await readFile(absolutePath)
        hash.update(`file\0${relativePath}\0${stats.size}\0`)
        hash.update(bytes)
        hash.update('\0')
        files.push({ path: relativePath, bytes })
        continue
      }
      // FIFO/socket/设备等：不打开、不复制、摘要记为 other（与 `digestSkillDirectory` 同一口径）。
      // 与 `digestInto` 同源：`other\0<相对路径>\0`（同样只有一个 NUL）。
      hash.update(`other\0${relativePath}\0`)
    }
  }
  await walk(directory, '', 0)
  return { files, sha256: hash.digest('hex') }
}

/**
 * 把候选比对与路径门禁挑出来的那一条**复制**进 `<dshHome>/skills/<frontmatter name>`。
 *
 * 闸门顺序（口径 62 §3.2）：
 *  ① 入参形状（绝对路径、有界、无控制字符）→ 不合形状按「不是我发现的那条」拒；
 *  ② 先 `realpath` 归一，再在**本次扫描**的候选里按 canonical 路径逐字比对（不在 ⇒ `ENT_SKILL_DISCOVERY_UNKNOWN`）；
 *  ③ 落点等式复核（`realpath(根) + 目录名 === canonical 路径`、`lstat` 复查目录是真目录、`lstat` 复查
 *     `SKILL.md` 是真普通文件且 ≤256 KiB）—— 符号链接/逃逸门禁全在这一步，且**全部发生在复制之前**；
 *  ④ `SKILL.md` frontmatter 闸门（`validateSkillFrontmatter`，与刀 3a **同一份**实现）；
 *  ⑤ 已装过 ⇒ `ENT_SKILL_ALREADY_REGISTERED`；落点被别的技能占 ⇒ `ENT_SKILL_NAME_CONFLICT`；
 *  ⑥ 读源树（**只读**）→ 既有加固落盘 `placeEnterpriseSkillArchive`（落点冲突预检 → 暂存 → 逐个原子改名 →
 *     失败整体回滚）→ 原子写自装记录（逐字七键、`sourceType: 'system'`、来源根 id 进 `sourceInput`）。
 *
 * ★**源目录一个字节都不动**（不 move、不 rsync、不删源）；★**绝不覆盖**已有同名技能。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口，以及 `home`/`env` 注入点。
 * @param path - `/skills/third-party` 投影里那条候选的 canonical 绝对路径（界面原样回传）。
 * @returns 安装后的**本机自装清单**（与 `GET /skills/self-installed` 逐字同形）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_DISCOVERY_UNKNOWN`（不在候选集）/ `ENT_SKILL_SKILLMD_INVALID`
 *   （frontmatter 不过）/ `ENT_SKILL_ALREADY_REGISTERED` / `ENT_SKILL_NAME_CONFLICT` / `ENT_SKILL_INSTALL_FAILED` /
 *   `ENT_SKILL_STATE_INVALID`（自装清单损坏或写盘失败）/ `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（扫描本身失败）。
 */
export async function installThirdPartySkill(
  options: EnterpriseThirdPartySkillOptions,
  path: unknown,
): Promise<EnterpriseSelfInstalledSkills> {
  const discoveryUnknown = (message: string): EnterpriseSkillInstallError =>
    new EnterpriseSkillInstallError('ENT_SKILL_DISCOVERY_UNKNOWN', message)
  // ① 入参形状（与既有通路二的 `adoptSystemSkill` 同一把尺）。
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_THIRD_PARTY_PATH_LENGTH || !isAbsolute(path)) {
    throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  }
  for (const character of path) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  }
  // ② 先 `realpath` 再查候选：传符号链接路径也会被归一到真实路径再比对（不在候选集里一律拒）。
  const canonicalPath = await realpathOrUndefined(path)
  if (canonicalPath === undefined) throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  const rootOptions: EnterpriseSkillInstallOptions = {
    platform: options.platform,
    ...(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.onError === undefined ? {} : { onError: options.onError }),
  }
  const discovery = await thirdPartyDiscovery(options)
  const candidate = discovery.projection.skills.find(skill => skill.id === thirdPartySkillRootId(canonicalPath))
  if (candidate === undefined) throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  const skillName = candidate.name
  // ③ 路径安全：**两个对象各有各的尺**（与 `adoptSystemSkill` 的三重等式同款，不用 `startsWith`）。
  //   · 目录侧：`realpath(根) + 目录名` 必须逐字等于 canonical 路径 —— 目录名是 `readdir` 给的单个目录项名，
  //     结构上不可能含分隔符，且**不由我们收窄**（官方 watcher 不看目录名）；
  //   · 技能名侧（要写进自装记录、也是复制落点的那个 kebab 键）：过既有那份 `requireRelativeSkillPath`。
  const segments = requireRelativeSkillPath(skillName)
  const root = discovery.roots.find(item => item.id === candidate.rootId)
  if (segments.length !== 1 || segments[0] !== skillName || root?.resolvedPath === undefined) {
    throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  }
  // 落点等式：`realpath(根) + 目录名` 这一路径的 **realpath** 必须逐字等于候选的 canonical 路径。
  // ★用 `realpath` 而不是裸 `join` 相等，是因为本机别名根里的一级子目录**是符号链接**（口径 62 §3.1）：
  //   那一条的 canonical 是**链接目标**，`join` 永远不会等于它 —— 但那正是我们要复制的那份内容。
  const rootDirectory = join(root.resolvedPath, candidate.directory)
  if (await realpathOrUndefined(rootDirectory) !== canonicalPath) {
    throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  }
  const stats = await lstat(canonicalPath).catch(() => undefined)
  if (stats === undefined || !stats.isDirectory()) {
    throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  }
  // `SKILL.md` 本身也必须是真的普通文件（`lstat` 不跟随符号链接）——闸门在**复制之前**。
  const markdownPath = join(canonicalPath, SKILL_CONTENT_FILENAME)
  const markdownStats = await lstat(markdownPath).catch(() => undefined)
  if (markdownStats === undefined || !markdownStats.isFile() || markdownStats.size > SKILL_MD_MAX_BYTES) {
    throw discoveryUnknown('the requested directory is not a discovered third-party skill')
  }
  // ④ frontmatter 闸门（与刀 3a 完全同一份实现；不过即整次拒绝，零落盘）。
  const facts = validateSkillFrontmatter(await readFile(markdownPath), candidate.directory)
  const selfRecords = await readSelfInstalledRecords(rootOptions)
  const enterpriseRecords = await readInstalledSkillRecords(rootOptions)
  const installedNames = new Set<string>([
    ...enterpriseRecords.flatMap(record => [...record.names]),
    ...selfRecords.flatMap(record => [...record.names]),
  ])
  // ⑤ 两条 fail-closed（顺序：先「已装过」，再「落点被别人占了」）。
  if (installedNames.has(skillName) || selfRecords.some(record => record.skillId === skillName)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_ALREADY_REGISTERED', 'this third-party skill is already installed')
  }
  const ownedElsewhere = new Set<string>([
    ...enterpriseRecords.flatMap(record => [...record.names]),
    ...selfRecords.flatMap(record => [...record.names]),
  ])
  if (ownedElsewhere.has(skillName)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_NAME_CONFLICT', 'a different skill already uses this folder name')
  }
  // ★三态里判成 `conflict` 的那一条**也要在这里拒**：`statusOf` 的两条判据里有一条是
  // 「这条的**目录名**已被另一个不同技能的名字占着」—— 那是**扫描期**才看得见的事实（另一条候选），
  // 不体现在磁盘或两份记录里，故落盘预检兜不住它。界面按 `status` 画状态、这一层按 `status` 拒请求，
  // 两处说的是同一句话：**这一条此刻不能装**。
  if (candidate.status === 'conflict') {
    throw new EnterpriseSkillInstallError('ENT_SKILL_NAME_CONFLICT', 'a different skill already uses this folder name')
  }
  // ⑥ 读源树（**只读**）→ 既有加固落盘（落点冲突预检也在里面：同名目录存在但不在可替换集合里 ⇒ 409）→ 原子记账。
  const tree = await readSourceTree(canonicalPath)
  const entry: SkillArchiveEntry = { name: facts.name, files: tree.files }
  await placeEnterpriseSkillArchive(rootOptions, {
    archive: { skillId: facts.name, displayName: facts.name, skills: [entry] },
    // 本面**绝不覆盖**：可替换集合恒空（同名目录存在 ⇒ 落点冲突预检直接 409）。
    ownNames: new Set<string>(),
    ownedElsewhere,
    failureCode: 'ENT_SKILL_INSTALL_FAILED',
    commit: async () => {
      const record: SelfInstalledSkillRecord = {
        skillId: skillName,
        displayName: skillName,
        sha256: tree.sha256,
        names: [skillName],
        installedAt: (options.now ?? (() => new Date()))().toISOString(),
        // 沿用通路二那枚来源标签（`sourceType` 是自由字符串，加取值**不改**七键键集）；
        // 来源根 id 进 `sourceInput` —— **不写宿主绝对路径**，且它正是「这条来自哪个 CLI」的唯一坐标。
        sourceType: SYSTEM_ADOPT_SOURCE_TYPE,
        sourceInput: candidate.rootId,
      }
      await upsertSelfInstalledRecord(rootOptions, record)
    },
  })
  return await installedSelfSkills(rootOptions)
}

/** 本面复用既有那份归一化（`skill-errors.ts` 的唯一实现），不新造第二套。 */
export { skillInstallError }
