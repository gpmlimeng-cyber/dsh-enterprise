/**
 * [INPUT]: 依赖 node:crypto 的 createHash、node:fs/promises 的 lstat/readdir/readFile/readlink/realpath、node:path 的 isAbsolute/join/resolve、platform-client 的 `resolveEnterpriseDshHome`、本包 `skill-install.ts` 的 `SKILL_LOCAL_ROOT_SEGMENTS`/`SKILL_CONTENT_FILENAME`/`SKILL_FILE_MAX_ENTRIES`/`SKILL_FILE_MAX_DEPTH`/`readInstalledSkillRecords`/`requireRelativeSkillPath` 与 `EnterpriseSkillInstallOptions`、`skill-upload.ts` 的 `SelfInstalledSkillRecord`/`EnterpriseSelfInstalledSkills`/`readSelfInstalledRecords`/`upsertSelfInstalledRecord`/`installedSelfSkills`/`SYSTEM_ADOPT_SOURCE_TYPE`、`skill-frontmatter.ts` 的 `parseSkillFrontmatter` 与 `skill-errors.ts` 的稳定码
 * [OUTPUT]: 对外提供通路二「系统搜索」的两件事：`discoverSystemSkills(options)`（本机技能根盘点 + 三态）与 `adoptSystemSkill(options, path)`（**只登记、不复制、不动该目录一个字节**），以及 `EnterpriseSystemSkills`/`EnterpriseSystemSkill`/`EnterpriseSystemRoot` 形状、`SKILL_SYSTEM_PRIMARY_ROOT_ID`/`SYSTEM_SEARCH_SOURCE_INPUT` 常量（`SYSTEM_ADOPT_SOURCE_TYPE` 自 `skill-upload.ts` 转出）与目录内容摘要 `digestSkillDirectory(path)`
 * [POS]: bundle 技能纵深的**第三条通路**（真源 `docs/research/cherry-skill-add-2026-10-05.md` §2.2/§2.3/§2.4 + `docs/plan/skill-install-sources.md` §E.2③）——上游 `SkillService.discoverSystem`/`importSystem` 的**语义**逐条对齐（canonical 路径去重、三态、先 `realpath` 再查候选、三条 fail-closed 硬拒），另有两处**有意偏离**（都写在函数注释里，别当成漏抄）：① 三态把上游的「自家库技能判 conflict」**合并成 registered**；② 上游 `:360` 排除它自己的受管根，我们**反过来包含** `<dshHome>/skills`。★「是不是技能」的判据是 **frontmatter 的 `name`**、不是目录名（官方 watcher `dsh-skill-filesystem/lib/index.js:679`/`:685` 同款）；★本文件**不复制、不移动、不删除**任何技能目录，只往刀 3a 建成的**同一份**自装清单里登记一条记录；★**本刀**：纳入写进 `sourceInput` 的**不再是那条目录的 canonical 绝对路径**，而是**来源根 id**（根 id 拿不到 ⇒ 固定字面量 `SYSTEM_SEARCH_SOURCE_INPUT`，绝不回落成路径）—— 理由是这份记录**会出厂**（`GET /skills/self-installed` 与 uninstall/reveal/edit 的响应都带它）⇒ 宿主绝对路径不许进记录（出厂口另有 `skill-upload.ts` 的只读投影守卫兜住盘上旧记录）；★全程零 exec/spawn、不做动态 import、不改权限位；★**已知识别边界**：官方还认根下裸 `.md` 当技能（`dsh-skill-filesystem/lib/index.js:586-592`），v1 只认「一级子目录 + `SKILL.md`」，那种技能**不在清单里** —— 理由与三条结构性约束见 `listRoot` 的注释（属单独一刀）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, readlink, realpath } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterpriseSkillInstallError, skillInstallError } from './skill-errors.js'
import { parseSkillFrontmatter } from './skill-frontmatter.js'
import {
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
} from './skill-upload.js'

/** 本机唯一确定的技能根在盘点响应里的稳定 id（官方 `skill-filesystem` 的 `user-dsh` 根）。 */
export const SKILL_SYSTEM_PRIMARY_ROOT_ID = 'user-dsh'
/**
 * 根 id 取不到时，纳入写进自装记录 `sourceInput` 的**固定字面量**（**非路径形态**）。
 *
 * ★它是一枚**兜底**，不是常态取值：常态写的是 `candidate.rootId`（来源根表里的 id，见 `adoptSourceInput`）。
 * 宁可写一枚固定字面量，也**绝不**回落成路径 —— 这一格会出厂（见 `adoptSystemSkill` 第 ⑤ 步的注释）。
 */
export const SYSTEM_SEARCH_SOURCE_INPUT = 'system-search'
/** 纳入写进自装记录的 `sourceType`（取值与上游同源，定义在记录所有者 `skill-upload.ts` 里，这里转出）。 */
export { SYSTEM_ADOPT_SOURCE_TYPE }

/** 判据用的 `SKILL.md` 单文件读取上限：与包内 frontmatter 闸门同一条 256 KiB（超出即「读不到」，不报错）。 */
const SKILL_MD_MAX_BYTES = 256 * 1024
/** 注入根 id 的形状上限（只用于投影与日志，不参与任何路径构造）。 */
const MAX_SYSTEM_ROOT_ID_LENGTH = 64
/** 纳入入参 `path` 的形状上限：与 `resolveInstalledSkillTarget` 的路径门禁同值 1024。 */
const MAX_ADOPT_PATH_LENGTH = 1024
/** 目录摘要的总字节上限：超过即本机自己完不成这次登记（`ENT_SKILL_ADOPT_FAILED`），不静默算半个摘要。 */
const MAX_DIGEST_TOTAL_BYTES = 20 * 1024 * 1024

/** 一个可注入的**额外只读**技能根（v1 默认空：本机除 `~/.dsh/skills` 外没有别的 CLI 技能根）。 */
export interface EnterpriseSystemRootDeclaration {
  readonly id: string
  readonly path: string
}

export interface EnterpriseSkillSystemOptions extends EnterpriseSkillInstallOptions {
  /** 额外只读根（v1 默认 `[]`）；存在的意义是将来放开跨 CLI 根时**不用改结构**。 */
  readonly extraRoots?: readonly EnterpriseSystemRootDeclaration[]
}

/** 盘点响应里的一条根：`present` 表示「这个根真的存在且能被读成目录清单」。 */
export interface EnterpriseSystemRoot {
  readonly id: string
  readonly path: string
  readonly present: boolean
}

/**
 * 一条**候选**技能目录（盘点响应 `data.skills` 的条目）。
 *
 * ★**是不是候选由 frontmatter 的 `name` 决定，不由目录名决定**（与官方 watcher 同一把尺，见 `skillFacts`）：
 * `name` 是**目录名**（`path` 的 basename，界面照旧能按它显示「这份技能在哪个目录」），
 * `displayName` 是 frontmatter 里那个**技能名**（纳入后写进自装记录的 `skillId`/`names` 就是它）。
 * 两者在常态下相同；目录名不是官方 kebab 时后者才是技能的真名。
 */
export interface EnterpriseSystemSkill {
  /** `realpath` 之后的 **canonical 绝对路径**（去重键也是它；纳入时按它比对候选）。 */
  readonly path: string
  readonly rootId: string
  /** 目录名（`path` 的 basename）。 */
  readonly name: string
  /** frontmatter 的 `name`：技能的真名（官方 watcher 只认它，`dsh-skill-filesystem/lib/index.js:679`）。 */
  readonly displayName?: string
  /** frontmatter 的 `description`。 */
  readonly description?: string
  /** 三态：已被任一记录认领 / 折叠名被别的技能占用 / 可纳入。 */
  readonly state: 'registered' | 'conflict' | 'available'
}

/** `GET /enterprise/api/v1/local/skills/system-search` 的本地投影。 */
export interface EnterpriseSystemSkills {
  readonly roots: readonly EnterpriseSystemRoot[]
  readonly skills: readonly EnterpriseSystemSkill[]
}

interface SystemDependencies {
  readonly dshHome: string
  readonly now: () => Date
  readonly onError: ((message: string, error: unknown) => void) | undefined
  readonly extraRoots: readonly EnterpriseSystemRootDeclaration[]
}

/** 扫描期的一条候选：目录名与 frontmatter 技能名**分开存**（两者的判据完全不同，见 `systemDiscovery`）。 */
interface ScannedCandidate {
  /** 目录名（`canonicalPath` 的 basename）——只用于展示与「这条目录在哪」。 */
  readonly name: string
  /** frontmatter 的 `name`——技能真名，也是纳入后写进自装记录的那个 kebab 键。 */
  readonly skillName: string
  readonly canonicalPath: string
  readonly rootId: string
  readonly description: string
}

interface ScannedRoot extends EnterpriseSystemRoot {
  /** `realpath(<root>)`；根不存在/不可解析时 undefined（此时 `present` 恒 false）。 */
  readonly resolvedPath: string | undefined
  readonly candidates: readonly ScannedCandidate[]
}

interface SystemDiscovery {
  readonly roots: readonly ScannedRoot[]
  readonly skills: readonly EnterpriseSystemSkill[]
}

function discoveryUnknown(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_DISCOVERY_UNKNOWN', message)
}

function resolveSystemDependencies(options: EnterpriseSkillSystemOptions): SystemDependencies {
  const extraRoots = options.extraRoots ?? []
  for (const root of extraRoots) {
    if (typeof root.id !== 'string' || root.id.length === 0 || root.id.length > MAX_SYSTEM_ROOT_ID_LENGTH
      || typeof root.path !== 'string' || root.path.length === 0) {
      throw new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'a system skill root declaration is invalid')
    }
  }
  return {
    dshHome: resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    now: options.now ?? (() => new Date()),
    onError: options.onError,
    extraRoots,
  }
}

/**
 * 本次要扫的根清单：**唯一确定的** `<dshHome>/skills`（官方 `user-dsh` 根）在前，注入的额外只读根按序在后。
 *
 * ★**有意偏离上游**：Cherry `SkillService.ts:360` 主动排除它自己的受管根
 * （`canonicalPath === managedRoot || startsWith(managedRoot + sep)` ⇒ `continue`），因为那个根是它的库。
 * 我们**必须包含** `<dshHome>/skills`：它既是企业包与本机自装的落盘根，**也是用户自己的技能根**，
 * 而且在本机是**唯一**确定的根（`.claude`/`.codex`/`.gemini`/`.cursor`/`.continue`/`.aider` 全不存在）。
 * 照抄那条排除会让这条通路永远什么都找不到 —— 这是本文件与上游**取舍相反**的第一处。
 *
 * 同一个真实目录挂在多个根下（例如额外根是指向主根的符号链接）只保留**先出现**的那一枚（`resolve()` 后按文本去重）。
 */
function systemRoots(deps: SystemDependencies): readonly EnterpriseSystemRootDeclaration[] {
  const declarations: EnterpriseSystemRootDeclaration[] = [
    { id: SKILL_SYSTEM_PRIMARY_ROOT_ID, path: join(deps.dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS) },
    ...deps.extraRoots.map(root => ({ id: root.id, path: root.path })),
  ]
  const seen = new Set<string>()
  const roots: EnterpriseSystemRootDeclaration[] = []
  for (const declaration of declarations) {
    const path = resolve(declaration.path)
    if (seen.has(path)) continue
    seen.add(path)
    roots.push({ id: declaration.id, path })
  }
  return roots
}

async function realpathOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EINVAL' || code === 'ELOOP') return undefined
    throw skillInstallError(error, 'ENT_SKILL_ADOPT_FAILED', 'the skill directory could not be resolved')
  }
}

/** 含 `SKILL.md` 的一级子目录才算候选；`lstat` 不跟随符号链接 ⇒ 指向别处的 `SKILL.md` 不算。 */
async function hasSkillMarkdown(directory: string): Promise<boolean> {
  try {
    return (await lstat(join(directory, SKILL_CONTENT_FILENAME))).isFile()
  } catch {
    return false
  }
}

/**
 * 读一条目录里那份 `SKILL.md` 的 **frontmatter 技能名**（顺带 `description`）；读不到或不合规 ⇒ `undefined`。
 *
 * ★**候选与否的判据就在这一步**，而它判的是 frontmatter 的 `name`、**不是目录名** —— 与官方 watcher 同一把尺：
 * `@deepseek-ai/dsh-skill-filesystem/lib/index.js:584-597` 对根下每个一级目录取 `<dir>/SKILL.md` 去解析，
 * `:679` 取 `stringField(parsed.data, 'name')`、`:685` 用 `isSkillName`（`@deepseek-ai/dsh-skill/lib/index.js:17`
 * 的 `^[a-z0-9]+(?:-[a-z0-9]+)*$`）判，不合法就 `logger.warn(... ignored: invalid skill name ...)` 并忽略
 * （`:679` 那两行前还要求 `description` 同在，故 `name`/`description` 缺一不可）。
 * ⇒ **只要 frontmatter 的 name 合法，目录名长什么样都不影响它是一条活技能**（`My Skill/` 里声明
 * `name: my-skill` 照样会被官方加载）， поэтому「可纳入性」也必须落在这一枚字段上；目录名非 kebab 不是
 * 「不是技能」的理由。这也正是刀 3a 的 frontmatter 闸门与服务端 `SkillArtifactInspector:167-202` 管的字段。
 *
 * 解析失败/超 256 KiB/不是普通文件一律 `undefined`（调用方会留一条 `onError` 痕，**不许静默丢**）。
 */
async function skillFacts(directory: string): Promise<{ skillName: string, description: string } | undefined> {
  try {
    const target = join(directory, SKILL_CONTENT_FILENAME)
    const stats = await lstat(target)
    if (!stats.isFile() || stats.size > SKILL_MD_MAX_BYTES) return undefined
    const facts = parseSkillFrontmatter(await readFile(target))
    return { skillName: facts.name, description: facts.description }
  } catch {
    return undefined
  }
}

/**
 * 扫一个根：不存在即静默跳过（§2.2），返回该根的一级候选（**尚未**做跨根去重）。
 *
 * ★**已知识别边界（v1 有意不覆盖，不是漏做）**：官方 watcher 除了「一级子目录 + `SKILL.md`」，**还**认
 * **根下的裸 `.md` 文件**当技能 —— `@deepseek-ai/dsh-skill-filesystem/lib/index.js:586-592`：
 * `entry.type === 'directory' ? {path: join(entry.path,'SKILL.md'), directory: entry.path}`
 * `: entry.type === 'file' && entry.name.endsWith('.md') ? {path: entry.path, directory: root.path} : undefined`
 *（那个分支里 `directory` 取**根本身**）。⇒ `~/.dsh/skills/foo.md` 确实是一条活技能，而本函数只收目录形态，
 * 所以它**不会出现**在这份盘点清单里（界面也就看不到、纳入不了它）。
 *
 * 为什么不在本刀顺手扩（三条**结构性**理由，必须一起解决才成立）：
 *  ① 自装记录是 **task-2 冻结的逐字七键**形状（`readSelfInstalledRecords` 的键集比对），里面**没有「形态」位**
 *     —— 目录与文件在记录里长得一样；
 *  ② 要收它只有两条路，而两条都要动冻结面：**新加一枚形态键**（改七键形状，连带 UI 那份宽容解码器），
 *     或者**把形态塞进 `sourceType`**（那是「来源」语义：`upload` / `system` / 将来的 `github`…），
 *     塞形态就等于让一个字段同时表达两件事；
 *  ③ `skills[].path` 会变成**多态**（目录的 canonical 路径 / 文件的 canonical 路径），而契约里**没有判别位**，
 *     调用方（界面、纳入）无从知道该按哪种去 `realpath` / 判存在性。
 * ⇒ 这是**单独一刀**（记录形状 + 投影形状 + 读取语义一起改），不属于「系统搜索」这条通路的尾巴。
 */
async function listRoot(
  deps: SystemDependencies,
  root: EnterpriseSystemRootDeclaration,
): Promise<{ present: boolean, resolvedPath: string | undefined, candidates: ScannedCandidate[] }> {
  let entries
  try {
    entries = await readdir(root.path, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // §2.2：目录不存在 = `readdir` 抛 ENOENT = 被吞 = 该根没有候选。不报错、不中断、**不进日志**
    //（上游只 `logger.debug`）。其它不可读原因同样不中断，但留一条痕，免得「看不见」与「读不了」混同。
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      deps.onError?.(`enterprise skill system root could not be listed [root=${root.id}]`, error)
    }
    return { present: false, resolvedPath: undefined, candidates: [] }
  }
  const resolvedPath = await realpathOrUndefined(root.path)
  const candidates: ScannedCandidate[] = []
  // 目录项顺序按名字排定：盘点响应必须是确定的（同一份磁盘内容每次都得到同一个顺序）。
  for (const entry of [...entries].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    // `dirent.isDirectory()` 基于 lstat：目录符号链接**不进候选**（它的真实身份是别处的一个目录）。
    if (!entry.isDirectory()) continue
    const absolutePath = join(root.path, entry.name)
    // 官方 watcher 的同款顺序（`:584-597`）：先要有一份可读的 `SKILL.md`…
    if (!await hasSkillMarkdown(absolutePath)) continue
    // …再要 frontmatter 的 `name` 合法（`:679`/`:685`）。**目录名不参与**这一步的判定。
    const facts = await skillFacts(absolutePath)
    if (facts === undefined) {
      // 这里**不许静默丢**：磁盘上确实摆着一份 `SKILL.md`，但它不是一条可被加载的技能
      //（官方 watcher 在这个位置同样是 warn + 忽略）。留一条痕，让「本机有什么没被列出来」可查。
      deps.onError?.(
        `enterprise skill system entry ignored [root=${root.id} directory=${entry.name}]:`
        + ` ${SKILL_CONTENT_FILENAME} frontmatter has no usable name/description`,
        undefined,
      )
      continue
    }
    const canonicalPath = await realpathOrUndefined(absolutePath)
    // 扫到一半消失（竞态）或不可解析：跳过这一条，不让整次盘点失败。
    if (canonicalPath === undefined) continue
    candidates.push({
      name: entry.name,
      skillName: facts.skillName,
      canonicalPath,
      rootId: root.id,
      description: facts.description,
    })
  }
  return { present: true, resolvedPath, candidates }
}

/**
 * 扫全部根并按 §2.3 的**canonical 路径**去重（不是技能名）：同一个真实目录挂在多个根下只列一次，
 * 保留**先出现**的根（主根在前的序由 `systemRoots` 定）。
 */
async function scanRoots(deps: SystemDependencies): Promise<readonly ScannedRoot[]> {
  const seen = new Set<string>()
  const roots: ScannedRoot[] = []
  for (const root of systemRoots(deps)) {
    const listed = await listRoot(deps, root)
    const candidates: ScannedCandidate[] = []
    for (const candidate of listed.candidates) {
      if (seen.has(candidate.canonicalPath)) continue
      seen.add(candidate.canonicalPath)
      candidates.push(candidate)
    }
    roots.push({
      id: root.id,
      path: root.path,
      present: listed.present,
      resolvedPath: listed.resolvedPath,
      candidates,
    })
  }
  return roots
}

/** 两份记录里被认领的**技能名**（企业已装**全量不过滤** ∪ 自装清单；两份记录里 `names` 都是 kebab 技能名）。 */
async function claimedSkillNames(options: EnterpriseSkillInstallOptions): Promise<ReadonlySet<string>> {
  const claimed = new Set<string>()
  for (const record of await readInstalledSkillRecords(options)) {
    for (const name of record.names) claimed.add(name)
  }
  for (const record of await readSelfInstalledRecords(options)) {
    for (const name of record.names) claimed.add(name)
  }
  return claimed
}

/** 折叠名（`name.toLowerCase()`，上游 `skillPaths.ts:25-27` 的 `normalizeFolderKey`）是否被**别的**名字占用。 */
function foldedNameTaken(name: string, names: Iterable<string>): boolean {
  const folded = name.toLowerCase()
  for (const other of names) {
    if (other !== name && other.toLowerCase() === folded) return true
  }
  return false
}

/**
 * 折叠后的**技能名**是否已被**另一条候选目录**占用（身份判据是 canonical 路径，不是名字本身）。
 *
 * 两条目录声明同一个技能名在官方那侧就是同一个名字：官方 watcher 用 frontmatter 的 `name` 建注册表
 * （`dsh-skill-filesystem/lib/index.js:679` → `dsh-skill` 的 `SkillRegistry`），同名两条只能有一条胜出。
 * ⇒ 两条都报 `conflict`（"这个名字已被别的技能占用"），纳入会被拒到歧义被消除为止。
 */
function foldedSkillNameTakenByAnotherCandidate(
  candidate: ScannedCandidate,
  entries: readonly { readonly candidate: ScannedCandidate }[],
): boolean {
  const folded = candidate.skillName.toLowerCase()
  return entries.some(entry => entry.candidate.canonicalPath !== candidate.canonicalPath
    && entry.candidate.skillName.toLowerCase() === folded)
}

function project(discovery: SystemDiscovery): EnterpriseSystemSkills {
  return {
    roots: discovery.roots.map(root => ({ id: root.id, path: root.path, present: root.present })),
    skills: discovery.skills,
  }
}

/**
 * 一次盘点（出网投影 + 内部根信息），两条公开入口共用，避免「列出什么」与「能不能纳入」判成两套。
 *
 * 候选的**身份键是 frontmatter 的 `name`**（官方 watcher 只看它，见 `skillFacts`）；目录名只用于展示。
 * **三态判据**（上游 `:377-379` 逐字 `registered ? 'registered' : folderConflict ? 'conflict' : 'available'`）：
 *  · `registered` —— 该技能名**已被任何一份记录认领**（企业 `installed.json` ∪ 刀 3a 的自装清单）。
 *    ★**有意偏离上游**：Cherry 的 `installedByPath`（`:335-343`）只收 `source === 'system'` 且
 *    `sourceUrl` 以 `file:` 开头的技能，于是**它会把自家库下发的企业技能判成 `conflict`**；我们按
 *    **技能名**判认领并把两源合并成 `registered` —— 否则界面会对自家下发的技能显示「命名冲突」。
 *  · `conflict` —— 技能名没被认领，但**折叠名**已被别的技能占用：另一份记录里的名字，**或本机另一条候选
 *    目录声明了同一个技能名**。后者是这条通路在 v1 里**真实可达**的一条：官方 watcher 只认 frontmatter 的
 *    `name`，两个目录（`notes-a/`、`notes-b/`）都写 `name: shared-notes` 就是同名两条。
 *  · `available` —— 两者都没命中，可纳入。
 */
async function systemDiscovery(
  options: EnterpriseSkillSystemOptions,
  deps: SystemDependencies,
): Promise<SystemDiscovery> {
  const roots = await scanRoots(deps)
  const claimed = await claimedSkillNames(options)
  const entries = roots.flatMap(root => root.candidates.map(candidate => ({ rootId: root.id, candidate })))
  const skills: EnterpriseSystemSkill[] = []
  for (const { candidate } of entries) {
    const state: EnterpriseSystemSkill['state'] = claimed.has(candidate.skillName)
      ? 'registered'
      : foldedNameTaken(candidate.skillName, claimed)
          || foldedSkillNameTakenByAnotherCandidate(candidate, entries)
        ? 'conflict'
        : 'available'
    skills.push({
      path: candidate.canonicalPath,
      rootId: candidate.rootId,
      // `name` 是**目录名**（`path` 的 basename），`displayName` 是 frontmatter 里的**技能名**。
      name: candidate.name,
      displayName: candidate.skillName,
      description: candidate.description,
      state,
    })
  }
  return { roots, skills }
}

/**
 * 盘点本机技能根：每个根一条 `{id,path,present}`，每条候选一条三态记录。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口，以及可注入的额外只读根（默认空）。
 * @returns 根清单与候选清单（顺序确定：根按声明序、候选按目录名序）。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_STATE_INVALID`：注入的根声明形状非法、或状态文件损坏。
 */
export async function discoverSystemSkills(
  options: EnterpriseSkillSystemOptions,
): Promise<EnterpriseSystemSkills> {
  return project(await systemDiscovery(options, resolveSystemDependencies(options)))
}

/**
 * 纳入一份**本机已有**的技能目录：只往刀 3a 的自装清单登记，**不复制、不移动、不删除、不改权限位**。
 *
 * 它已经在 `<dshHome>/skills` 里就位了（官方 `skill-filesystem` watcher 本来就会加载它），
 * 复制一遍只会在同一个根下造第二份。
 *
 * 判定顺序（与上游 `importSystem` 同一序，`SkillService.ts:406`/`:409-417`）：
 *  ① 入参形状（绝对路径、有界、无控制字符）——不合形状一律按「不是我发现的那条」处理（404，不泄露更多）；
 *  ② **先 `realpath` 归一**，再在本次盘点候选里按 canonical 路径**逐字**比对（`:406`）；
 *  ③ 路径安全复用本仓既有那一份，且**目录 / 技能名各过各的尺**（与 `resolveInstalledSkillTarget` 的等式同款，
 *     **不用 `startsWith` 代替**）：目录侧 = 「`realpath(根)` 与目录名拼出来的落点**逐字等于** canonical 路径」+
 *     `lstat` 复查目录本身是真目录（不跟随符号链接）；技能名侧 = `requireRelativeSkillPath(skillName)`
 *    （kebab / 无 `..` / 无控制字符 / 无 `%` 编码绕过 / 长度），保证写下去的 `skillId`/`names` 读得回来；
 *  ④ 三条 fail-closed 硬拒：不在候选里 → `ENT_SKILL_DISCOVERY_UNKNOWN`(404)、已被认领 →
 *     `ENT_SKILL_ALREADY_REGISTERED`(409)、`conflict` → `ENT_SKILL_NAME_CONFLICT`(409，**既有码**)；
 *  ⑤ 递归算该目录内容摘要 → 并入**同一份**自装清单（`upsertSelfInstalledRecord`，七键 + 0600 原子写）。
 *     ★本刀：`sourceInput` 写的是**来源根 id**（`candidate.rootId`；拿不到 ⇒ `SYSTEM_SEARCH_SOURCE_INPUT`），
 *     **不再写那条 canonical 绝对路径** —— 记录会出厂，路径不许进记录（理由见函数体第 ⑤ 步的注释）。
 *
 * @param options - 平台面、可选 dshHome、时钟与留痕端口，以及可注入的额外只读根（默认空）。
 * @param path - `/skills/system-search` 投影里那条候选的 `path`（canonical 绝对路径）。
 * @returns 登记后的**本机自装清单**（与 `GET /skills/self-installed` 逐字同形，界面复用同一份解码器）。
 * @throws {EnterpriseSkillInstallError} 上述 404/409 三枚，加 `ENT_SKILL_ADOPT_FAILED`（本机自己完不成这次登记）、
 *   `ENT_SKILL_STATE_INVALID`（自装清单损坏或写盘失败）。
 */
export async function adoptSystemSkill(
  options: EnterpriseSkillSystemOptions,
  path: unknown,
): Promise<EnterpriseSelfInstalledSkills> {
  const deps = resolveSystemDependencies(options)
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_ADOPT_PATH_LENGTH || !isAbsolute(path)) {
    throw discoveryUnknown('the requested directory is not a discovered system skill')
  }
  for (const character of path) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) throw discoveryUnknown('the requested directory is not a discovered system skill')
  }
  // ② 先 realpath 再查候选（上游 `:406`）：传符号链接路径也会被归一到真实路径再比对。
  const canonicalPath = await realpathOrUndefined(path)
  if (canonicalPath === undefined) throw discoveryUnknown('the requested directory is not a discovered system skill')
  const discovery = await systemDiscovery(options, deps)
  const candidate = discovery.skills.find(skill => skill.path === canonicalPath)
  if (candidate === undefined) throw discoveryUnknown('the requested directory is not a discovered system skill')
  // ③ 路径安全：**两个对象各有各的尺**（这里与 `resolveInstalledSkillTarget` 同款的三重等式，不用 `startsWith`）。
  //  · 目录（要登记的落点）：`realpath(根) + 目录名` 必须**逐字等于** canonical 路径，再 `lstat` 复查它是真目录。
  //    目录名本身是 `readdir` 给的单个目录项名（结构上不可能含分隔符），且**不由我们收窄** —— 官方 watcher
  //    不看目录名（`My Skill/` 里声明 `name: my-skill` 也是活技能），拿 kebab 去卡目录名会把活技能挡在门外。
  //  · 技能名（要写进自装记录的那个 kebab 键）：过既有那份 `requireRelativeSkillPath` —— 它保证写下去的
  //    `skillId`/`names` 一定能被 `readSelfInstalledRecords` 的 kebab 重新收窄读回来（那份记录读盘时会过一遍）。
  const root = discovery.roots.find(item => item.id === candidate.rootId)
  const skillName = candidate.displayName ?? candidate.name
  const segments = requireRelativeSkillPath(skillName)
  if (segments.length !== 1 || segments[0] !== skillName
    || root?.resolvedPath === undefined
    || join(root.resolvedPath, candidate.name) !== canonicalPath) {
    throw discoveryUnknown('the requested directory is not a discovered system skill')
  }
  const stats = await lstat(canonicalPath).catch(() => undefined)
  if (stats === undefined || !stats.isDirectory()) {
    throw discoveryUnknown('the requested directory is not a discovered system skill')
  }
  // ④ 三条 fail-closed（顺序照上游：先「已被导入」，再「名字被别人占了」）。
  if (candidate.state === 'registered') {
    throw new EnterpriseSkillInstallError('ENT_SKILL_ALREADY_REGISTERED', 'this system skill is already registered')
  }
  if (candidate.state === 'conflict') {
    throw new EnterpriseSkillInstallError('ENT_SKILL_NAME_CONFLICT', 'a different skill already uses this folder name')
  }
  // ⑤ 只登记：算摘要 → 并入同一份自装清单。
  // 记录的 `skillId`/`names` 用 **frontmatter 的技能名**（官方 watcher 认定的就是它）。
  // ★本刀：`sourceInput` **不再写那条目录的 canonical 绝对路径**，改写**来源根 id**（与「本地三方复制」
  //   那一面同一形态：`skill-third-party.ts` 写的也是 `candidate.rootId`）；根 id 拿不到就写固定字面量
  //   `SYSTEM_SEARCH_SOURCE_INPUT`，**绝不**回落成路径。
  //   ★为什么（记录会出厂 ⇒ 路径不许进记录）：这份七键记录会随 `GET /skills/self-installed` 与
  //   uninstall/reveal/edit 的响应进浏览器（界面靠 `sourceInput` 做上传文件名匹配与渠道分类），
  //   把本机绝对路径写进去就等于破了「宿主绝对路径不进浏览器」这条既有不变量。
  //   ★连带的如实登记：旧记录里那条路径还兼职「目录名 ≠ 技能名」时的存在性判据，新记录不再携带目录名
  //   （那本来就不是出厂的来源坐标）⇒ `installedSelfSkills` 一侧按**技能名**回扫技能根补上这条只读判据
  //   （见 `skill-upload.ts` 的 `scanLiveSystemSkillNames`），刚纳入的记录**不会**凭空消失。
  const sha256 = await digestSkillDirectory(canonicalPath)
  await upsertSelfInstalledRecord(options, {
    skillId: skillName,
    displayName: skillName,
    sha256,
    names: [skillName],
    installedAt: deps.now().toISOString(),
    sourceType: SYSTEM_ADOPT_SOURCE_TYPE,
    // 来源坐标 = 这条技能所在**根表的 id**（`user-dsh` / 注入根 id），不是路径、不是 URL、没有分隔符。
    sourceInput: adoptSourceInput(candidate.rootId),
  })
  return await installedSelfSkills(options)
}

/**
 * 来源根 id 的取用与收窄：拿不到一枚可用的根 id 时写 {@link SYSTEM_SEARCH_SOURCE_INPUT}（**绝不**回落成路径）。
 *
 * 根 id 来自**既有根表**（`systemRoots` 的声明 id；主根恒为 `SKILL_SYSTEM_PRIMARY_ROOT_ID`），
 * 形状上限与 `resolveSystemDependencies` 对注入根 id 的那把尺同值。这里再判一次「没有分隔符、没有 `..`」
 * 是最后一道硬边界：这一格**会出厂** ⇒ 任何形似路径的东西都不许从这里溜进去。
 */
function adoptSourceInput(rootId: string): string {
  if (rootId.length === 0 || rootId.length > MAX_SYSTEM_ROOT_ID_LENGTH
    || rootId.includes('/') || rootId.includes('\\')
    || rootId.split('/').some(segment => segment === '..')) {
    return SYSTEM_SEARCH_SOURCE_INPUT
  }
  return rootId
}

/**
 * 递归算一个技能目录的**内容摘要**（sha256），用于自装记录里的 `sha256` 那一枚。
 *
 * 摘要只看**目录里有什么**（相对路径、类型、字节），不含目录自身的名字或绝对位置 ⇒ 同一个目录换个位置
 * 或改个名字都不改变摘要。纪律：
 *  · 条目按名字排序逐条喂入 ⇒ 同一份内容总得到同一个摘要（与文件系统返回顺序无关）；
 *  · **符号链接一律不跟随**：只把链接目标字符串（`readlink`）计入摘要 —— 技能目录**之外**的字节绝不进摘要，
 *    也不会被打开；
 *  · 目录 / 常规文件 / 其它类型（FIFO / socket / 设备）各自打类型标记，其它类型**绝不打开**；
 *  · 条目数与深度复用本仓既有上限（`SKILL_FILE_MAX_ENTRIES` / `SKILL_FILE_MAX_DEPTH`），另有总字节上限
 *    `MAX_DIGEST_TOTAL_BYTES`：任一超限即抛 `ENT_SKILL_ADOPT_FAILED`（宁可如实失败，也不写一个半截摘要）。
 *
 * @param directory - canonical 的技能目录绝对路径。
 * @returns 64 位小写十六进制摘要。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_ADOPT_FAILED`：子树超限或读取失败。
 */
export async function digestSkillDirectory(directory: string): Promise<string> {
  const hash = createHash('sha256')
  const budget = { entries: 0, bytes: 0 }
  try {
    await digestInto(hash, directory, '', 0, budget)
  } catch (error) {
    throw skillInstallError(error, 'ENT_SKILL_ADOPT_FAILED', 'the skill directory could not be digested')
  }
  return hash.digest('hex')
}

async function digestInto(
  hash: ReturnType<typeof createHash>,
  directory: string,
  prefix: string,
  depth: number,
  budget: { entries: number, bytes: number },
): Promise<void> {
  if (depth > SKILL_FILE_MAX_DEPTH) throw tooLargeToDigest()
  const entries = [...await readdir(directory, { withFileTypes: true })]
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  for (const entry of entries) {
    budget.entries += 1
    if (budget.entries > SKILL_FILE_MAX_ENTRIES) throw tooLargeToDigest()
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    const absolutePath = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      hash.update(`link\0${relativePath}\0${await readlink(absolutePath)}\0`)
      continue
    }
    if (entry.isDirectory()) {
      hash.update(`dir\0${relativePath}\0`)
      await digestInto(hash, absolutePath, relativePath, depth + 1, budget)
      continue
    }
    if (entry.isFile()) {
      const stats = await lstat(absolutePath)
      budget.bytes += stats.size
      if (budget.bytes > MAX_DIGEST_TOTAL_BYTES) throw tooLargeToDigest()
      hash.update(`file\0${relativePath}\0${stats.size}\0`)
      hash.update(await readFile(absolutePath))
      hash.update('\0')
      continue
    }
    hash.update(`other\0${relativePath}\0`)
  }
}

function tooLargeToDigest(): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError(
    'ENT_SKILL_ADOPT_FAILED',
    'the skill directory is too large to digest',
  )
}
