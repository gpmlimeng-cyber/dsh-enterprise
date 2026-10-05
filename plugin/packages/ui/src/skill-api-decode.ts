/**
 * [INPUT]: 依赖 decode-primitives 的键集封闭判定、record/nonEmptyString/timestamp/enterpriseId 与唯一失败码类
 * [OUTPUT]: 对外提供技能包 DTO（`EnterpriseRuntimeSkill` / `EnterpriseSkillEntry` / `EnterpriseInstalledSkill` / `EnterpriseInstalledSkillContent` / `EnterpriseSkillFiles` + `EnterpriseSkillFileEntry` / `EnterpriseInstalledSkillFile`）与严格解码 `decodeEnterpriseSkills`（列表，可选分类 `category` 进白名单）、`decodeEnterpriseSkillDetail`（详情）、`decodeEnterpriseInstalledSkills`（本机已装态）、`decodeEnterpriseInstalledSkillContent`（**已装技能的 SKILL.md 正文**：单键封闭 + 正文 ≤256 KiB）、`decodeEnterpriseInstalledSkillFiles`（**本机真树条目**：路径形状 + 类型 + 目录 sizeBytes 恒 0 + 条目数 ≤1000 + 路径去重）与 `decodeEnterpriseInstalledSkillFile`（**树里一个文本文件**：四键封闭 + 路径形状 + 正文 ≤256 KiB）
 * [POS]: dsh-ui 浏览器契约层的技能分片——从逼近 800 行的 local-api-decode 拆出，专管企业技能目录投影；只保留 frontmatter 脱敏事实，SKILL.md 正文、artifact 路径与 SHA-256 在这里校验形状后即丢，永不进入界面（**唯一例外**是下面那条「读已装技能正文」的只读投影：正文由用户主动点开详情才取，形状与上限在这里同样收窄）；**可选分类 `category`（服务端新增字段，列表与详情投影都会有）在这里严格校验形状并把「缺席/null/空串」统一归一成「没有这个键」**（照 `whenToUse` 的既有归一策略，为缺失设计）；已装态是本机真值（Host 状态文件 + 落盘存在性），这里只校验形状与技能名规约
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterpriseLocalApiError, enterpriseId, hasExactKeys, nonEmptyString, record, timestamp } from './decode-primitives.js'
import type { JsonRecord } from './decode-primitives.js'

/** 单个技能条目（来自 SKILL.md frontmatter 的脱敏投影，绝不含正文）。 */
export interface EnterpriseSkillEntry {
  readonly name: string
  readonly description: string
  /** 何时该用该技能；服务端缺席时为 null，本层投影成「没有这个键」。 */
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

/**
 * 技能包的浏览器投影：列表与详情共用一份形状。
 *
 * `versionId` 与 `skills` 只有详情才有——列表投影给空串/空数组，界面据此判断「详情是否已就绪」
 * （照 preset 用 `versionId` 判下载地址的同口径）；`sha256` 在解码时校验形状后**不投影**，
 * 与受管插件的「删除 SHA」策略一致。
 */
export interface EnterpriseRuntimeSkill {
  readonly id: string
  readonly skillId: string
  readonly displayName: string
  /** 服务端 manifest.json 的 description 选填，投影时空值归一为空串（界面固定占位）。 */
  readonly description: string
  /**
   * 服务端新增的**可选分类**（列表与详情投影都会有）。**为缺失设计**：本层把缺席 / JSON null / 空串
   * 一律归一成「没有这个键」（照上面 `whenToUse` 的同一策略），故界面只需判 `undefined`；
   * 类型不是 string/null、或超过 64 字符一律判 `ENT_LOCAL_RESPONSE_INVALID`。
   */
  readonly category?: string
  /**
   * 包级**内置**标记（契约 `RuntimeSkillSummary.builtin`）。
   *
   * 形状是**必填 boolean**（服务端恒发真值），但本层**读侧 tolerant**：缺席按 `false` 处理并记一条
   * 结构化 warn（理由与发布顺序无关性，见 `SKILL_SUMMARY_OPTIONAL_KEYS` 上方那段注释）。
   * **非 boolean 一律判畸形**——容错只对「缺席」，不对「错型」。
   * 用途：员工端「已安装」分组只显示**非内置**的已装行（判据 `builtin === false`，属排队中的 task-5）。
   * 可见性**不**由它裁决（服务端仍按 assignment ∪ builtin 取并集），它只是把真值投影给界面做展示分组。
   */
  readonly builtin: boolean
  readonly sourceDshVersion: string
  readonly sizeBytes: number
  readonly skillCount: number
  readonly updatedAt: string
  readonly versionId: string
  readonly skills: readonly EnterpriseSkillEntry[]
}

/** 摘要字段清单：列表必须恰好是这些键，详情在此之上追加 versionId/sha256/skills。 */
const SKILL_SUMMARY_KEYS = [
  'id', 'skillId', 'displayName', 'description', 'sourceDshVersion', 'sizeBytes', 'skillCount', 'updatedAt',
] as const

/**
 * 摘要的可选键：`category`（服务端新增的可选分类，**为缺失设计**）与 `builtin`（见下）。
 * 它**不**进必填键集——字段尚未上线时整条投影必须照旧可解；但只要它出现，类型就必须对，否则整条判畸形。
 */
const SKILL_SUMMARY_OPTIONAL_KEYS = ['category', 'builtin'] as const

/**
 * ★ `builtin`：**读侧 tolerant / 写侧 required**，两者不矛盾，是协议演进的标准形态。
 *
 * 写侧（契约 `RuntimeSkillSummary`）把它列进 `required`（`type: boolean`）⇒ 语义上服务端**必须**投影；
 * 读侧（本层）**刻意容忍缺席**，因为服务端与员工插件是**两条独立发版列车**
 * （`deploy/compose/compose.yml` 里只有 server / console，**没有员工客户端服务**；
 * L1 与 deploy/README 也写明「插件继续独立发布、先更新员工插件」）⇒ 「先升客户端后升服务端」
 * 是运维纪律而**非代码强制**，混部窗口必然存在。
 * 那时若严格拒收，整页技能目录会**全部**判 `ENT_LOCAL_RESPONSE_INVALID`（列表一片空白）；
 * 而容忍缺席的唯一误伤是「内置包被当非内置」——该误伤只影响尚未上线的「已安装」分组（task-5），
 * **当前误伤面为零**。0 代价 vs 整页不可用，故取 tolerant。
 * ★ **但绝不静默**：缺席时记一条**结构化 warn**（口径同 `library-selection.ts` 的
 *   `deps.warn('owndsh: …')`，缺席退 `console.warn`），带 `missing: ['builtin']` 与
 *   「旧服务端未投影 builtin」的方向性提示 ⇒ 出错**可定位**，不是无声无息。
 * ★ **容错只对「缺席」，不对「错型」**：`true` / `false` 原样透传且**不 warn**；
 *   非 boolean（`"true"` 字符串 / `null` / 0 / 1）一律整条判畸形 —— 错型是协议 bug，必须暴露。
 * ★ 可见性**不**由它裁决（服务端仍按 assignment ∪ builtin 取并集），它只是把真值投影给界面做展示分组。
 * ★ `featured` 与它不同：**仍未贯通到员工端**（只在管理端投影），故本层没有对应键，别照它写。
 */

const SKILL_DETAIL_KEYS = [...SKILL_SUMMARY_KEYS, 'versionId', 'sha256', 'skills'] as const

/** manifest.json 的 id 规约（小写连字符等稳定标识），与契约 SkillPackageRef 同源。 */
const SKILL_PACKAGE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * ★ 本包 warn 的**唯一出口**（口径同 `library-selection.ts` / `shortcuts-open.ts`）：
 * 消息前缀 `owndsh: `，第二参数是可选的错误对象，**不是** `console.log`。
 * 之所以收口到一处：解码层是**所有**技能取数的必经之路，若各分支自己 console 会刷屏；
 * 而「同一个原因只记一次」由调用方（见下）保证。
 */
function warn(message: string, detail?: unknown): void {
  console.warn(`owndsh: ${message}`, detail ?? '')
}

/** 已经 warn 过的 `builtin` 缺席（同一原因只记一次，避免一页几十行刷屏）。 */
const warnedMissingBuiltin = new Set<string>()

/**
 * `builtin` 的**读侧 tolerant 投影**：缺席 → `false` + 一条结构化 warn；`true`/`false` 原样透传（不 warn）。
 *
 * **非 boolean 由调用方先判畸形**（这里只处理 undefined 与 boolean 两种已放行的形态）。
 * warn 里带 `missing: ['builtin']` 这样的结构化字段 + 一句方向性提示，
 * 让「服务端没投影 builtin」这件事**可定位**，而不是无声无息地按 false 落地。
 */
function decodeBuiltin(row: JsonRecord, id: string): boolean {
  const value = row['builtin']
  if (value === true || value === false) return value
  // 缺席：同一包只记一次（列表可能一页几十行，按 id 去重即可，不按「全局一次」——那会漏掉别的包）。
  if (!warnedMissingBuiltin.has(id)) {
    warnedMissingBuiltin.add(id)
    warn('runtime 技能投影缺少 builtin，按非内置处理（旧服务端未投影该字段）', {
      missing: ['builtin'],
      skillId: id,
    })
  }
  return false
}

/** 仅供测试：清掉「同一包只 warn 一次」的去重集合，让每条用例从干净状态开始。 */
export function resetSkillDecodeWarnings(): void {
  warnedMissingBuiltin.clear()
}

/** 单个 SKILL.md 条目名：严格 kebab-case，与官方 `isSkillName` 同源。 */
const SKILL_ENTRY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SKILL_SHA256 = /^[0-9a-f]{64}$/

const SKILL_MAX_SIZE_BYTES = 52_428_800

/**
 * 校验并投影摘要字段（不含键集判定：调用方先按 `hasExactKeys` 选择列表/详情键集）。
 *
 * 三处刻意放宽，都为了兼容真实服务端输出而不牺牲边界安全：
 * - `description` 允许 JSON null（manifest.json 的 description 选填），投影为空串；
 * - `category` 允许缺席 / JSON null / 空串（服务端新增的可选分类），三者都归一成「没有这个键」；
 * - 非 string 非 null 的描述与分类、非正大小、越界技能数与非法时间戳一律判畸形。
 */
function decodeSkillSummaryFields(row: JsonRecord): EnterpriseRuntimeSkill {
  if (!enterpriseId(row['id'])
    || !nonEmptyString(row['skillId']) || row['skillId'].length > 128 || !SKILL_PACKAGE_REF.test(row['skillId'])
    || !nonEmptyString(row['displayName']) || row['displayName'].length > 120
    || !(row['description'] === null || (typeof row['description'] === 'string' && row['description'].length <= 2000))
    || !(row['category'] === undefined || row['category'] === null
      || (typeof row['category'] === 'string' && row['category'].length <= 64))
    // `builtin` **读侧 tolerant**（见键集上方那段注释）：缺席按 false 处理并记 warn；
    // 但**非 boolean 一律判畸形** —— 容错只对「缺席」，不对「错型」（错型是协议 bug，必须暴露）。
    || !(row['builtin'] === undefined || typeof row['builtin'] === 'boolean')
    || !nonEmptyString(row['sourceDshVersion']) || row['sourceDshVersion'].length > 64
    || !Number.isSafeInteger(row['sizeBytes']) || Number(row['sizeBytes']) <= 0 || Number(row['sizeBytes']) > SKILL_MAX_SIZE_BYTES
    || !Number.isSafeInteger(row['skillCount']) || Number(row['skillCount']) < 1 || Number(row['skillCount']) > 200
    || !timestamp(row['updatedAt'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    id: row['id'],
    skillId: row['skillId'],
    displayName: row['displayName'],
    description: typeof row['description'] === 'string' ? row['description'] : '',
    // 分类：只有真拿到非空串才产出这个键；缺席/null/空串一概不产出（界面据此不渲染分类签，不塞占位）。
    ...(nonEmptyString(row['category']) ? { category: row['category'] } : {}),
    // `builtin` 读侧 tolerant：缺席按 false 落地，**并记一条结构化 warn**（不是静默兜底）——
    // 错在服务端没投影这条真值，方向性提示要能直接指到「旧服务端未投影 builtin」。
    builtin: decodeBuiltin(row, String(row['id'])),
    sourceDshVersion: row['sourceDshVersion'],
    sizeBytes: Number(row['sizeBytes']),
    skillCount: Number(row['skillCount']),
    updatedAt: row['updatedAt'],
    versionId: '',
    skills: [],
  }
}

function decodeSkillEntry(value: unknown): EnterpriseSkillEntry {
  const entry = record(value)
  if (entry === undefined
    || !hasExactKeys(entry, ['name', 'description', 'modelInvocable', 'userInvocable'], ['whenToUse'])
    || typeof entry['name'] !== 'string' || entry['name'].length > 64 || !SKILL_ENTRY_NAME.test(entry['name'])
    || !nonEmptyString(entry['description']) || entry['description'].length > 1024
    || !(entry['whenToUse'] === undefined || entry['whenToUse'] === null
      || (typeof entry['whenToUse'] === 'string' && entry['whenToUse'].length <= 2048))
    || typeof entry['modelInvocable'] !== 'boolean'
    || typeof entry['userInvocable'] !== 'boolean') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    name: entry['name'],
    description: entry['description'],
    ...(nonEmptyString(entry['whenToUse']) ? { whenToUse: entry['whenToUse'] } : {}),
    modelInvocable: entry['modelInvocable'],
    userInvocable: entry['userInvocable'],
  }
}

/**
 * 严格解码可见技能包摘要列表（`GET /enterprise/api/v1/skills` 的 `data`）。
 *
 * 未知字段（含详情专有的 versionId/sha256/skills）、负数或越界大小、非法时间戳一律抛
 * `ENT_LOCAL_RESPONSE_INVALID`；超过 200 条视为畸形而非截断。
 * `category` 是唯一可选键：缺席/null/空串都照旧解出（不产出该键），类型不对（非 string/null）才判畸形。
 */
export function decodeEnterpriseSkills(value: unknown): readonly EnterpriseRuntimeSkill[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return value.map(item => {
    const row = record(item)
    if (row === undefined || !hasExactKeys(row, SKILL_SUMMARY_KEYS, SKILL_SUMMARY_OPTIONAL_KEYS)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return decodeSkillSummaryFields(row)
  })
}

/**
 * 严格解码技能包详情（`GET /enterprise/api/v1/skills/{skillPackageId}` 的 `data`）。
 *
 * 详情键集 = 摘要字段 + versionId + sha256 + skills；`sha256` 只作形状门禁后丢弃，
 * 条目只保留 frontmatter 事实（正文从不在这份契约里）。可选分类 `category` 与列表同一口径。
 */
export function decodeEnterpriseSkillDetail(value: unknown): EnterpriseRuntimeSkill {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, SKILL_DETAIL_KEYS, SKILL_SUMMARY_OPTIONAL_KEYS)
    || !enterpriseId(row['versionId'])
    || typeof row['sha256'] !== 'string' || !SKILL_SHA256.test(row['sha256'])
    || !Array.isArray(row['skills']) || row['skills'].length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    ...decodeSkillSummaryFields(row),
    versionId: row['versionId'],
    skills: row['skills'].map(decodeSkillEntry),
  }
}

/**
 * 一条**已装**技能包记录（`GET /enterprise/api/v1/local/skills/installed` 的 `data.skills` 项）。
 *
 * 这是 Host 落盘态的唯一投影：没有宿主绝对路径、没有包内文件名清单，
 * `names` 是本包落盘的技能目录名（kebab），界面只用它显示「含 N 个技能」与做已装判定。
 */
export interface EnterpriseInstalledSkill {
  readonly packageId: string
  readonly skillId: string
  readonly displayName: string
  readonly versionId: string
  readonly sha256: string
  readonly names: readonly string[]
  readonly installedAt: string
}

const INSTALLED_SKILL_KEYS = [
  'packageId', 'skillId', 'displayName', 'versionId', 'sha256', 'names', 'installedAt',
] as const

function decodeInstalledSkill(value: unknown): EnterpriseInstalledSkill {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, INSTALLED_SKILL_KEYS)
    || !enterpriseId(row['packageId'])
    || !enterpriseId(row['versionId'])
    || !nonEmptyString(row['skillId']) || row['skillId'].length > 128 || !SKILL_PACKAGE_REF.test(row['skillId'])
    || !nonEmptyString(row['displayName']) || row['displayName'].length > 120
    || typeof row['sha256'] !== 'string' || !SKILL_SHA256.test(row['sha256'])
    || !Array.isArray(row['names']) || row['names'].length === 0 || row['names'].length > 200
    || !timestamp(row['installedAt'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const names: string[] = []
  for (const name of row['names']) {
    // 技能名同时是磁盘目录名：这里与官方 `isSkillName` 同规约收窄，界面拿到的永远是安全形状。
    if (typeof name !== 'string' || name.length > 64 || !SKILL_ENTRY_NAME.test(name) || names.includes(name)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    names.push(name)
  }
  return {
    packageId: row['packageId'],
    skillId: row['skillId'],
    displayName: row['displayName'],
    versionId: row['versionId'],
    sha256: row['sha256'],
    names,
    installedAt: row['installedAt'],
  }
}

/**
 * 严格解码本机已装技能清单（`GET /enterprise/api/v1/local/skills/installed` 的 `data`）。
 *
 * 信封必须是单键 `{ skills: [...] }`：Host 多塞任何字段（宿主路径、清单文件路径）都整条判失败。
 */
export function decodeEnterpriseInstalledSkills(value: unknown): readonly EnterpriseInstalledSkill[] {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['skills'])
    || !Array.isArray(row['skills']) || row['skills'].length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return row['skills'].map(decodeInstalledSkill)
}

/**
 * 一条**已装**技能的正文（`GET /enterprise/api/v1/local/skills/content` 的 `data`）。
 *
 * 这是本包唯一会承载 SKILL.md **正文**的投影，因此边界写死：单键封闭（多一个宿主路径即整条判失败）、
 * 包 id 雪花、技能名官方 kebab、正文是字符串且不超过 256 KiB（与 Host 侧的字节上限同值——
 * 解码后是 UTF-16 码元，其数不可能超过字节数，故这条上界对两侧都成立）。
 * 正文原样交给界面展示，本层**不解析** frontmatter、不做 Markdown 渲染。
 */
export interface EnterpriseInstalledSkillContent {
  readonly packageId: string
  readonly name: string
  readonly content: string
}

/** 正文上限：与 Host 的 SKILL.md 字节上限（`SKILL_MD_MAX_BYTES = 262144`）逐字同值。 */
const SKILL_CONTENT_MAX_LENGTH = 262_144

export function decodeEnterpriseInstalledSkillContent(value: unknown): EnterpriseInstalledSkillContent {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['packageId', 'name', 'content'])
    || !enterpriseId(row['packageId'])
    || typeof row['name'] !== 'string' || row['name'].length > 64 || !SKILL_ENTRY_NAME.test(row['name'])
    || typeof row['content'] !== 'string' || row['content'].length > SKILL_CONTENT_MAX_LENGTH) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { packageId: row['packageId'], name: row['name'], content: row['content'] }
}

/**
 * 一条**本机技能文件树**条目（`GET /enterprise/api/v1/local/skills/<id>/files` 的 `data.entries` 项）。
 *
 * 与 Host 侧 `EnterpriseSkillFileEntry`（bundle 的 `skill-install.ts`）**逐字段同形**：
 * `path` 是相对 `<dshHome>/skills` 的 `/` 分隔路径（目录不带尾斜杠），
 * `kind` 只有两种取值，目录的 `sizeBytes` 恒 0（键集对三种消费者统一，界面不必分叉判形状）。
 */
export interface EnterpriseSkillFileEntry {
  readonly path: string
  readonly kind: 'file' | 'directory'
  readonly sizeBytes: number
}

/**
 * `GET /enterprise/api/v1/local/skills/<id>/files` 的本地投影。
 *
 * 树来自**本机真目录**（Host 侧 `installedSkillFiles`），界面从不自己编树、也不猜有哪些文件；
 * 未安装的包在 Host 侧就是 404，因此界面这一侧拿不到任何条目。
 */
export interface EnterpriseSkillFiles {
  readonly packageId: string
  /** Host 已按 `path` 码元升序**确定性**排序；本层原样保留顺序（层级感由路径本身决定）。 */
  readonly entries: readonly EnterpriseSkillFileEntry[]
}

/** `GET .../skills/<id>/file?path=` 的本地投影：**纯文本**约定（二进制在 Host 侧就按稳定码拒了）。 */
export interface EnterpriseInstalledSkillFile {
  readonly packageId: string
  /** 与请求里的 `path` 逐字相同的规范相对路径。 */
  readonly path: string
  readonly sizeBytes: number
  readonly text: string
}

/** 相对路径总长上限：与 Host 侧 `SKILL_FILE_PATH_MAX_LENGTH` 同值。 */
const SKILL_FILE_PATH_MAX_LENGTH = 1024
/** 单段路径长度上限：与 Host 侧 `SKILL_FILE_SEGMENT_MAX_LENGTH`（多数文件系统的 NAME_MAX）同值。 */
const SKILL_FILE_SEGMENT_MAX_LENGTH = 255
/** 文件树条目数上限：与 Host 侧 `SKILL_FILE_MAX_ENTRIES` 同值（超限在 Host 侧就是 413）。 */
const SKILL_FILE_MAX_ENTRIES = 1000
/** 单文件字节上限：与 Host 的 SKILL.md 上限（`SKILL_MD_MAX_BYTES = 262144`）逐字同值。 */
const SKILL_FILE_MAX_BYTES = 262_144

/**
 * 本机技能相对路径的**形状收窄**（**不是安全边界**：路径安全判定在 Host 的 `requireRelativeSkillPath`）。
 *
 * 界面这一侧只回显 Host 自己在文件树里给过的路径、**从不拼路径**，故这里只保证拿到的字符串是它认识的形状：
 * 非空且 ≤1024、`/` 分隔、不以 `/` 开头、无反斜杠、无 `%`（二次编码绕过的形状）、无控制字符、
 * 无空段 / `.` / `..`、单段 ≤255，且首段是官方 kebab 技能目录名（≤64）。
 * 任一条不满足即整条判 `ENT_LOCAL_RESPONSE_INVALID`——与其余投影同一条 fail-closed 口径。
 */
function relativeSkillFilePath(value: unknown): string | undefined {
  if (!nonEmptyString(value) || value.length > SKILL_FILE_PATH_MAX_LENGTH) return undefined
  if (value.startsWith('/') || value.includes('\\') || value.includes('%')) return undefined
  const segments = value.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment.length > SKILL_FILE_SEGMENT_MAX_LENGTH) return undefined
    if (segment === '.' || segment === '..') return undefined
    for (const character of segment) {
      const code = character.codePointAt(0) ?? 0
      if (code < 0x20 || code === 0x7f) return undefined
    }
  }
  const skill = segments[0]!
  if (skill.length > 64 || !SKILL_ENTRY_NAME.test(skill)) return undefined
  return value
}

/**
 * 严格解码本机技能**文件树**（`GET .../skills/<id>/files` 的 `data`）。
 *
 * 三处封闭：键集恰好 `{packageId, entries}`、每条恰好 `{path, kind, sizeBytes}`、
 * 路径必须过上面的形状收窄且**树内不重复**（同一路径两次说明 Host 侧真树读崩了，不静默去重）。
 * 目录的 `sizeBytes` 必须是 0（与 Host 的 `kind:'directory'` 条目同一条约定）；文件 ≤256 KiB。
 */
export function decodeEnterpriseInstalledSkillFiles(value: unknown): EnterpriseSkillFiles {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['packageId', 'entries'])
    || !enterpriseId(row['packageId'])
    || !Array.isArray(row['entries']) || row['entries'].length > SKILL_FILE_MAX_ENTRIES) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const entries: EnterpriseSkillFileEntry[] = []
  const seen = new Set<string>()
  for (const item of row['entries']) {
    const entry = record(item)
    if (entry === undefined || !hasExactKeys(entry, ['path', 'kind', 'sizeBytes'])) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    const path = relativeSkillFilePath(entry['path'])
    const kind = entry['kind']
    const sizeBytes = entry['sizeBytes']
    if (path === undefined || (kind !== 'file' && kind !== 'directory')
      || !Number.isSafeInteger(sizeBytes) || Number(sizeBytes) < 0
      || Number(sizeBytes) > (kind === 'directory' ? 0 : SKILL_FILE_MAX_BYTES)
      || seen.has(path)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    seen.add(path)
    entries.push({ path, kind, sizeBytes: Number(sizeBytes) })
  }
  return { packageId: row['packageId'], entries }
}

/**
 * 严格解码本机技能树里的**一个文本文件**（`GET .../skills/<id>/file?path=` 的 `data`）。
 *
 * 四键封闭（Host 多塞宿主绝对路径即整条判失败）、路径同样过形状收窄、
 * `text` 必须是字符串且 ≤256 KiB（与 Host 的字节上限同值）。
 * 正文原样交给界面以**纯文本**渲染（`<pre>` 文本子节点，界面不解析 Markdown、不注入 HTML）。
 */
export function decodeEnterpriseInstalledSkillFile(value: unknown): EnterpriseInstalledSkillFile {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['packageId', 'path', 'sizeBytes', 'text'])
    || !enterpriseId(row['packageId'])
    || typeof row['text'] !== 'string' || row['text'].length > SKILL_FILE_MAX_BYTES) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const path = relativeSkillFilePath(row['path'])
  const sizeBytes = row['sizeBytes']
  if (path === undefined
    || !Number.isSafeInteger(sizeBytes) || Number(sizeBytes) < 0 || Number(sizeBytes) > SKILL_FILE_MAX_BYTES) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { packageId: row['packageId'], path, sizeBytes: Number(sizeBytes), text: row['text'] }
}
