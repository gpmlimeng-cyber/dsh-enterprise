/**
 * [INPUT]: 依赖 decode-primitives 的键集封闭判定、record/nonEmptyString/timestamp/enterpriseId 与唯一失败码类
 * [OUTPUT]: 对外提供技能包 DTO（`EnterpriseRuntimeSkill` / `EnterpriseSkillEntry` / `EnterpriseInstalledSkill` / `EnterpriseInstalledSkillContent` / `EnterpriseSkillFiles` + `EnterpriseSkillFileEntry` / `EnterpriseInstalledSkillFile`）与严格解码 `decodeEnterpriseSkills`（列表，可选分类 `category` 进白名单）、`decodeEnterpriseSkillDetail`（详情）、`decodeEnterpriseInstalledSkills`（本机已装态）、`decodeEnterpriseInstalledSkillContent` …… **本刀（本地导入的结果交代）**：再加一份 `EnterpriseSelfInstalledSkill` 与 `decodeEnterpriseSelfInstalledSkills`（`GET /skills/self-installed`）——这份**刻意宽容**：必需五键（skillId / displayName / sha256 / names / installedAt）只校验形状，Host 多附的 provenance 之类字段一律忽略（用途只有「念一句结果」，不该被留痕字段打成硬失败）；其中 `sourceInput`（Host 落盘时记下的**用户原始文件名**）是**可选第六件**，收下它是为了把「这次装好的技能名」精确对上是哪一枚记录（对不上就只报成功、不编名字，故它不该把整条记录判死）；**本刀（系统搜索）**再加一份盘点投影 `EnterpriseSystemRoot`/`EnterpriseSystemSkill`/`EnterpriseSystemSkills` 与严格解码 `decodeEnterpriseSystemSkills`（`GET /skills/system-search`）——单键封闭信封 + 根三键/候选五键（+两枚可选）封闭 + `state` 三字面 + **每条候选的 `rootId` 必须在 `roots` 里**（界面按根分组铺设，指向不存在根的候选没有诚实落点）+ 路径去重与条数封顶；**本刀（在线搜索）**再加一份 `EnterpriseOnlineSkillSource`/`EnterpriseOnlineSkillResult`/`EnterpriseOnlineSkillSearch` 与严格解码 `decodeEnterpriseOnlineSkillSearch`（`GET /skills/online-search`）——信封单键封闭 + 来源两键（+可选 `dropped`，**只允许正数**）/结果三键（+四枚可选）封闭 + **结果的 `sourceId` 必须在 `sources` 里** + 两枚计数非负安全整数 + 来源 id 去重、**坐标串 `installSource` 去重**（界面拿它当 React key 与「行→结果」的回找坐标）与条数封顶；★来源 id **不做封闭字面集**（Host 可增源，写死会让良性变化变成整次搜索失败），显示时直接用 id 当来源名；（**已装技能的 SKILL.md 正文**：单键封闭 + 正文 ≤256 KiB）、`decodeEnterpriseInstalledSkillFiles`（**本机真树条目**：路径形状 + 类型 + 目录 sizeBytes 恒 0 + 条目数 ≤1000 + 路径去重）与 `decodeEnterpriseInstalledSkillFile`（**树里一个文本文件**：四键封闭 + 路径形状 + 正文 ≤256 KiB）
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
 * 一条**本地上传自装**技能记录（`GET /enterprise/api/v1/local/skills/self-installed` 的 `data.skills` 项）。
 *
 * 与 `EnterpriseInstalledSkill` 的关键差别：它**没有中心雪花包 id**（自装包不来自中心目录），
 * 故形状里不出现 `packageId`/`versionId`——这正是它**不会**出现在 `/skills/installed` 那条企业
 * 已装清单里的原因（两份记录是两回事，各自独立）。
 *
 * `sha256` 与 `names` 是落盘事实：前者是包内制品的摘要，后者是本包解出的技能目录名集合
 * （既是磁盘目录名、也是列表里要念出来的名字来源）。
 *
 * **本刀（本地导入的结果交代）**：另带一枚**可选** `sourceInput`——Host 落盘时原样记下的**用户文件名**
 * （已去目录部分与控制字符）。界面在上传成功后要说出「这次装好了哪几个技能」，唯一可靠的取法就是
 * 拿用户刚选的文件名来这条清单里**精确匹配**那一枚记录（见 `skill-import.ts` 的
 * `enterpriseSkillImportNames`）；没有它就只剩「取最新那一枚」这种猜法，而猜错会把**上一个**技能的
 * 名字报成本次结果。它是**可选**的：老 Host 不给这一枚时照旧解得出记录，只是界面那一句里少说半句名字。
 */
export interface EnterpriseSelfInstalledSkill {
  readonly skillId: string
  readonly displayName: string
  readonly sha256: string
  readonly names: readonly string[]
  readonly installedAt: string
  /** 用户原始文件名（Host 侧 `sourceInput`；缺席 = 这一版 Host 不提供，界面不据此编名字）。 */
  readonly sourceInput?: string | undefined
}

/** 自装记录的五枚必需键（冻结契约：「每条至少含五键」）。 */
const SELF_INSTALLED_KEYS = ['skillId', 'displayName', 'sha256', 'names', 'installedAt'] as const

/**
 * 解码一条自装记录：**必需五键 + 只校验形状，多给的一律忽略**。
 *
 * ★ **为什么这一条刻意「宽容」而不是像隔壁那样键集封闭**：冻结契约写明 Host 会在这条投影上
 * 附 **provenance** 之类的额外字段（来源留痕），而本层的用途只有一件——「把上传结果说出来」
 * （念出技能名）。若照隔壁 `hasExactKeys` 那样封闭，Host 每加一枚留痕字段就会让**整句反馈**
 * 变成 `ENT_LOCAL_RESPONSE_INVALID`，那是把「多说一句」的功能做成一次硬失败。
 * ⇒ 这里只保证**我读的五件事实形状对**：id / 名 / 摘要 / 目录名集合 / 时间；其余键原样放过、不进投影
 * （故它也不会被回显到界面）。
 *
 * 仍然严格的两条：`skillId` 与 `names` 的形状（它们是**标识符**，要拿去念名字、将来还要拿去对
 * 本机目录），以及 `names` 非空——空名字集合的记录说不出任何真话，判畸形而不是画一句空话。
 * `sourceInput` 是**第六枚可选事实**（本刀）：有就收下（长度与形状收窄），缺席/形状不对就当它没有——
 * 它只用来把「这次装好的名字」对上号，对不上时界面只说成功、不编名字，故它不该把整条记录判死。
 */
function decodeSelfInstalledSkill(value: unknown): EnterpriseSelfInstalledSkill {
  const row = record(value)
  if (row === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  for (const key of SELF_INSTALLED_KEYS) {
    if (row[key] === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if (!nonEmptyString(row['skillId']) || row['skillId'].length > 128 || !SKILL_PACKAGE_REF.test(row['skillId'])
    || typeof row['displayName'] !== 'string' || row['displayName'].length > 120
    || typeof row['sha256'] !== 'string' || row['sha256'].length === 0 || row['sha256'].length > 128
    || !Array.isArray(row['names']) || row['names'].length === 0 || row['names'].length > 200
    || !timestamp(row['installedAt'])) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const names: string[] = []
  for (const name of row['names']) {
    if (typeof name !== 'string' || name.length > 64 || !SKILL_ENTRY_NAME.test(name) || names.includes(name)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    names.push(name)
  }
  // 可选第六件：只收「非空且不超过 Host 侧上限（1024）」的字符串，其余形态一律当它没有（不判死记录）。
  const sourceInput = typeof row['sourceInput'] === 'string' && row['sourceInput'].length > 0 && row['sourceInput'].length <= 1024
    ? row['sourceInput']
    : undefined
  return {
    skillId: row['skillId'],
    displayName: row['displayName'],
    sha256: row['sha256'],
    names,
    installedAt: row['installedAt'],
    ...(sourceInput === undefined ? {} : { sourceInput }),
  }
}

/**
 * 解码**本地自装**技能清单（`GET /enterprise/api/v1/local/skills/self-installed` 的 `data`）。
 *
 * 信封这一层仍要求 `{ skills: [...] }`（形状对不上就是协议 bug，必须显式失败）；
 * 但**每条记录**按上面 `decodeSelfInstalledSkill` 的宽容口径解——多给的留痕字段不判失败。
 * 条数封顶 200，与隔壁已装清单同值（界面这一侧只用来念一句结果）。
 */
export function decodeEnterpriseSelfInstalledSkills(value: unknown): readonly EnterpriseSelfInstalledSkill[] {
  const row = record(value)
  if (row === undefined
    || !Array.isArray(row['skills']) || row['skills'].length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return row['skills'].map(decodeSelfInstalledSkill)
}

/* ───────────────── 通路二「系统搜索」的盘点投影（本刀） ───────────────── */

/**
 * 盘点响应里的一条**技能根**（`GET /skills/system-search` 的 `data.roots` 项）。
 *
 * `present` 是「这个根真的存在且能被读成目录清单」这一件事实：`false` **不是错误**（根不存在是常态，
 * Host 静默给 `false`），界面据此说两种不同的空话（根不在 vs 根在但没候选），故它必须如实过桥。
 */
export interface EnterpriseSystemRoot {
  readonly id: string
  /** 根的**声明**路径（不是 canonical；界面只把它当**展示事实**，绝不据此拼任何路径）。 */
  readonly path: string
  readonly present: boolean
}

/**
 * 一条**候选**技能目录（`data.skills` 项）的三态。
 *
 * `registered` = 已被任一份记录认领（企业已装 ∪ 自装）；`conflict` = 折叠名已被别的技能占用；
 * `available` = 可纳入。三态是 Host 的唯一判定，界面**只做翻译**，绝不自己再算一遍。
 */
export type EnterpriseSystemSkillState = 'registered' | 'conflict' | 'available'

/**
 * 一条候选技能目录。
 *
 * ★ `path` 是 `realpath` 之后的 **canonical 绝对路径**：它是这条候选的**去重键**，也是纳入时
 *   回传给 Host 的那个字面量（`POST /skills/adopt` 的 `{path}`）。界面把它当**不透明值**——
 *   原样收下、原样回传，**从不拼、从不改、从不接受用户输入**（Host 侧会再 `realpath` 一遍并在
 *   本次候选里逐字比对，故这条回传既不是信任边界、也不是路径构造）。
 * ★ `name` 是**目录名**（Host 侧用它与根拼出落点，故它必须仍是目录名）；
 *   `displayName` 是 `SKILL.md` frontmatter 里那个**技能名**。两者都读不到时 `displayName`/`description`
 *   **整键缺席**（不是空串）——界面因此能区分「没有这个名字」与「名字是空的」。
 */
export interface EnterpriseSystemSkill {
  readonly path: string
  readonly rootId: string
  readonly name: string
  readonly displayName?: string | undefined
  readonly description?: string | undefined
  readonly state: EnterpriseSystemSkillState
}

/** `GET /enterprise/api/v1/local/skills/system-search` 的投影。 */
export interface EnterpriseSystemSkills {
  /** 根清单（顺序 = Host 的声明序，界面按它分组、不再排序）。 */
  readonly roots: readonly EnterpriseSystemRoot[]
  /** 候选清单（顺序 = Host 的目录名序，界面按根分组后保持原序）。 */
  readonly skills: readonly EnterpriseSystemSkill[]
}

/** 根 id 的形状上限：与 Host 侧 `MAX_SYSTEM_ROOT_ID_LENGTH` 逐字同值。 */
const SYSTEM_ROOT_ID_MAX = 64
/** 根的**数量**上限：根是声明出来的（v1 只有一枚），给一个宽裕的上界即可。 */
const SYSTEM_ROOT_MAX = 64
/**
 * 候选**数量**上限：1000（与既有文件树条目上限 `SKILL_FILE_MAX_ENTRIES` 同值）。
 *
 * Host 侧对候选数**没有**自己的上限（一个目录里有多少条就能列出多少条），故这里封顶不是为了对齐契约，
 * 而是为了**有界渲染**：超过就是「本机技能目录实在太多」这种需要 Host 先加一道闸的情形，此时显式失败
 * （`ENT_LOCAL_RESPONSE_INVALID`）比默默铺一万行更诚实。
 */
const SYSTEM_SKILL_MAX = 1000
/** `displayName` 上限：与 Host 侧 frontmatter 的 `name` 上限逐字同值。 */
const SYSTEM_DISPLAY_NAME_MAX = 64
/** `description` 上限：与 Host 侧 frontmatter 的 `description` 上限逐字同值。 */
const SYSTEM_DESCRIPTION_MAX = 1024
/** 路径字面量的形状上限：与 Host 侧 `MAX_ADOPT_PATH_LENGTH` 逐字同值（回传时会被同一条收窄）。 */
const SYSTEM_PATH_MAX = 1024
/** 三种状态的字面真源（多一个字面都会在这里被判畸形）。 */
const SYSTEM_SKILL_STATES: readonly EnterpriseSystemSkillState[] = ['registered', 'conflict', 'available']

/**
 * 路径字面量的**形状**校验（只做形状，不做语义）。
 *
 * 界面对路径的纪律是「原样收下、原样回传」，故这里只挡住**不可能**是 Host canonical 路径的形态：
 * 空串、超长（Host 侧回传也会被同一条 1024 拦）、含控制字符（含 NUL）。**不**要求它看起来像绝对路径
 * （那是 Host 的判定：`isAbsolute` + `realpath` 逐字等式），界面不在这里猜第二遍。
 */
function systemPathShape(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > SYSTEM_PATH_MAX) return false
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return false
  }
  return true
}

function decodeSystemRoot(value: unknown): EnterpriseSystemRoot {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['id', 'path', 'present'])
    || typeof row['id'] !== 'string' || row['id'].length === 0 || row['id'].length > SYSTEM_ROOT_ID_MAX
    || !systemPathShape(row['path'])
    || typeof row['present'] !== 'boolean') {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return { id: row['id'], path: row['path'], present: row['present'] }
}

function decodeSystemSkill(value: unknown): EnterpriseSystemSkill {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['path', 'rootId', 'name', 'state'], ['displayName', 'description'])
    || !systemPathShape(row['path'])
    || typeof row['rootId'] !== 'string' || row['rootId'].length === 0 || row['rootId'].length > SYSTEM_ROOT_ID_MAX
    // 目录名走官方技能名规约（Host 侧只把合法 kebab 目录列进候选，故这里照收窄）。
    || typeof row['name'] !== 'string' || row['name'].length > 64 || !SKILL_ENTRY_NAME.test(row['name'])
    || !SYSTEM_SKILL_STATES.includes(row['state'] as EnterpriseSystemSkillState)) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  // 两枚可选文本，口径**照本文件既有那两枚**（`whenToUse` / `category`）：缺席 / JSON null / 空串
  // 三者都归一成「没有这个键」（界面因此只需判 `undefined`，不必满地判空串）；只有**类型不对**或
  // 超上限才判畸形。★ Host 的 frontmatter 解析对这一层是「有就带上」——一份写着空描述的 SKILL.md
  // 完全可能把 `description: ''` 带出来，那时判整条畸形会让**整个盘点**失败，代价远大于「少一行描述」。
  if (!(row['displayName'] === undefined || row['displayName'] === null
    || (typeof row['displayName'] === 'string' && row['displayName'].length <= SYSTEM_DISPLAY_NAME_MAX))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  if (!(row['description'] === undefined || row['description'] === null
    || (typeof row['description'] === 'string' && row['description'].length <= SYSTEM_DESCRIPTION_MAX))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const displayName = nonEmptyString(row['displayName']) ? row['displayName'] : undefined
  const description = nonEmptyString(row['description']) ? row['description'] : undefined
  return {
    path: row['path'],
    rootId: row['rootId'],
    name: row['name'],
    state: row['state'] as EnterpriseSystemSkillState,
    ...(displayName === undefined ? {} : { displayName }),
    ...(description === undefined ? {} : { description }),
  }
}

/**
 * 解码**本机技能根盘点**（`GET /enterprise/api/v1/local/skills/system-search` 的 `data`）。
 *
 * 严格三条（每一条都是「界面上少说一句假话」的前提）：
 *  ① 信封**单键封闭** `{roots, skills}`（Host 多塞一枚字段即整条判畸形）；
 *  ② 每条根三键封闭、每条候选五键（+两枚可选）封闭，`state` 只能是那三种字面；
 *  ③ **每条候选的 `rootId` 必须真的在 `roots` 里**：界面按根分组铺设，一条指向不存在根候选
 *     没有任何诚实的落点（编一个组等于替 Host 编结构）⇒ 判协议畸形，而不是悄悄丢掉它。
 * 另加两条**有界**约束：候选路径去重（Host 已按 canonical 去重，重复即协议 bug）、条数封顶。
 *
 * @param value - 响应 `data`。
 * @returns `{roots, skills}`（顺序原样保留：根按声明序、候选按目录名序）。
 * @throws {EnterpriseLocalApiError} `ENT_LOCAL_RESPONSE_INVALID`：任一形状不满足。
 */
export function decodeEnterpriseSystemSkills(value: unknown): EnterpriseSystemSkills {
  const row = record(value)
  if (row === undefined || !hasExactKeys(row, ['roots', 'skills'])
    || !Array.isArray(row['roots']) || row['roots'].length > SYSTEM_ROOT_MAX
    || !Array.isArray(row['skills']) || row['skills'].length > SYSTEM_SKILL_MAX) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const roots = row['roots'].map(decodeSystemRoot)
  const rootIds = new Set(roots.map(root => root.id))
  const skills = row['skills'].map(decodeSystemSkill)
  const seen = new Set<string>()
  for (const skill of skills) {
    if (!rootIds.has(skill.rootId) || seen.has(skill.path)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    seen.add(skill.path)
  }
  return { roots, skills }
}

/* ───────────────── 通路三「在线搜索」的投影（本刀） ───────────────── */

/**
 * 一个**在线来源**在这次 fan-out 里的如实状态。
 *
 * ★ `ok:false` 与 `dropped>0` 是**两种不同的坏消息**，界面必须分开说（本刀最要紧的一条）：
 *   · `ok:false` = 这个源**这次没取到**（网络/上游挂了）；
 *   · `dropped>0` = 取到了，但**有 N 条不提供可安装的来源**、被如实丢掉了（Host 侧计数，为 0 时整键不产出）。
 *   把两者混成一句「部分失败」，就等于把「有东西被丢了」这件事静默掉。
 */
export interface EnterpriseOnlineSkillSource {
  /**
   * 来源 id（Host 的声明序 + 界面上的来源名）。
   *
   * ★ 界面**不把它当封闭字面集**判死：来源是 Host 那边可增的（今天三枚），今天多一枚不该让整次搜索
   *   在浏览器侧变成 `ENT_LOCAL_RESPONSE_INVALID`。故这里只校验形状（非空、有界、无控制字符），
   *   显示时直接用这个 id 本身当来源名——**不编造**、也不维护第二份「id → 人话名」的映射表。
   */
  readonly id: string
  readonly ok: boolean
  /** 这个源这次丢了几条（**正数才有这个键**，为 0 时整键缺席）。 */
  readonly dropped?: number | undefined
}

/**
 * 归一化后的一条搜索结果。
 *
 * ★ `installSource` 是**唯一**能回传给 `POST /skills/install-from-result` 的坐标串
 *   （形状 `"<源 id>:<坐标>"`；注意头部那个 id 是**适配器**名，未必等于 `sourceId`，故界面只做形状校验、
 *   **不校验前缀**、更不解析它：原样收下、原样回传）。
 * ★ 解码层另外保证它在**一次响应里唯一**：界面拿它当 React key、又拿它把「这一行」对回原始结果
 *   （`results.find(...)`）。这条唯一性由 `decodeEnterpriseOnlineSkillSearch` 判死（那里的第三条约束），
 *   界面因此可以放心 `find`。
 * ★ 四枚可选字段（描述 / 作者 / 星标 / 安装量）**缺席就是没有**（照 `whenToUse`/`category` 的既有归一策略：
 *   缺席 / null / 空串都不产出该键）——界面据此决定「那一行画不画」，绝不自己在界面上编占位句。
 */
export interface EnterpriseOnlineSkillResult {
  readonly sourceId: string
  readonly name: string
  readonly description?: string | undefined
  readonly author?: string | undefined
  readonly stars?: number | undefined
  readonly installs?: number | undefined
  readonly installSource: string
}

/** `GET /enterprise/api/v1/local/skills/online-search?q=…` 的投影。 */
export interface EnterpriseOnlineSkillSearch {
  readonly sources: readonly EnterpriseOnlineSkillSource[]
  readonly results: readonly EnterpriseOnlineSkillResult[]
}

/** 来源条数上限：今天三枚，留到 16（多一枚来源不该让整次搜索判死）。 */
const ONLINE_SOURCE_MAX = 16
/**
 * 结果条数上限：500。
 *
 * Host 侧对结果条数**没有**自己的上限（三个源返回多少就归一化多少），故这里封顶不是为了对齐契约，
 * 而是为了**有界渲染**：真到这一步说明上游给了异常多的一页，此时显式失败（`ENT_LOCAL_RESPONSE_INVALID`）
 * 比默默铺五百行以上更诚实（与系统搜索那枚 1000 同一条考虑）。
 */
const ONLINE_RESULT_MAX = 500
/** 来源 id 上限：与 Host 侧那枚 64 同量级（只用于展示与归属判定）。 */
const ONLINE_SOURCE_ID_MAX = 64
/** 搜索结果里三枚**文本**字段的上限：故意宽裕（见下面 `decodeOnlineResult` 的注释）。 */
const ONLINE_NAME_MAX = 200
const ONLINE_AUTHOR_MAX = 200
const ONLINE_DESCRIPTION_MAX = 4000
/** 坐标串上限：与 Host 侧 `MAX_INSTALL_SOURCE_LENGTH` 逐字同值（回传时会被同一条收窄）。 */
const ONLINE_INSTALL_SOURCE_MAX = 1024
/** 计数上限：非负安全整数且不超过这个上界（挡住病态的大数/浮点）。 */
const ONLINE_COUNT_MAX = 1_000_000_000

/** 文本形状：非空、有界、无控制字符（含 NUL）——搜索结果是**任意第三方 API**给的字，故只做形状收窄。 */
function onlineText(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return false
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return false
  }
  return true
}

function decodeOnlineSource(value: unknown): EnterpriseOnlineSkillSource {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['id', 'ok'], ['dropped'])
    || !onlineText(row['id'], ONLINE_SOURCE_ID_MAX)
    || typeof row['ok'] !== 'boolean'
    // `dropped` 只在**正数**时才由 Host 产出：非整数 / 0 / 负数 / 超上界一律判畸形（0 应当整键缺席）。
    || !(row['dropped'] === undefined
      || (typeof row['dropped'] === 'number' && Number.isSafeInteger(row['dropped'])
        && row['dropped'] > 0 && row['dropped'] <= ONLINE_COUNT_MAX))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return {
    id: row['id'],
    ok: row['ok'],
    ...(row['dropped'] === undefined ? {} : { dropped: row['dropped'] }),
  }
}

function decodeOnlineResult(value: unknown): EnterpriseOnlineSkillResult {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, ['sourceId', 'name', 'installSource'], ['description', 'author', 'stars', 'installs'])
    || !onlineText(row['sourceId'], ONLINE_SOURCE_ID_MAX)
    // 三枚文本字段的上限刻意**宽裕**：这些字来自任意第三方 API（Host 侧没有逐字段上限），
    // 一份啰嗦的描述不该把整次搜索判死；上限只用来挡住病态输入。
    || !onlineText(row['name'], ONLINE_NAME_MAX)
    // 坐标串只做形状：**不校验前缀**（头部那个 id 是适配器名，未必等于 `sourceId`），更不解析。
    || !onlineText(row['installSource'], ONLINE_INSTALL_SOURCE_MAX)
    || !(row['description'] === undefined || row['description'] === null
      || (typeof row['description'] === 'string' && row['description'].length <= ONLINE_DESCRIPTION_MAX))
    || !(row['author'] === undefined || row['author'] === null
      || (typeof row['author'] === 'string' && row['author'].length <= ONLINE_AUTHOR_MAX))
    || !(row['stars'] === undefined || row['stars'] === null
      || (typeof row['stars'] === 'number' && Number.isSafeInteger(row['stars'])
        && row['stars'] >= 0 && row['stars'] <= ONLINE_COUNT_MAX))
    || !(row['installs'] === undefined || row['installs'] === null
      || (typeof row['installs'] === 'number' && Number.isSafeInteger(row['installs'])
        && row['installs'] >= 0 && row['installs'] <= ONLINE_COUNT_MAX))) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const description = nonEmptyString(row['description']) ? row['description'] : undefined
  const author = nonEmptyString(row['author']) ? row['author'] : undefined
  return {
    sourceId: row['sourceId'],
    name: row['name'],
    installSource: row['installSource'],
    ...(description === undefined ? {} : { description }),
    ...(author === undefined ? {} : { author }),
    ...(row['stars'] === undefined || row['stars'] === null ? {} : { stars: row['stars'] }),
    ...(row['installs'] === undefined || row['installs'] === null ? {} : { installs: row['installs'] }),
  }
}

/**
 * 解码**在线搜索**的归一化结果（`GET /enterprise/api/v1/local/skills/online-search` 的 `data`）。
 *
 * 严格四条：① 信封单键封闭 `{sources, results}`；② 每条来源两键（+可选 `dropped`）封闭、`ok` 是布尔；
 * ③ 每条结果三键（+四枚可选）封闭、两枚计数非负安全整数；④ **每条结果的 `sourceId` 必须真的在
 * `sources` 里**（界面按来源标名，指向一个这次没出现的来源的条目没有诚实的落点 ⇒ 判协议畸形，
 * 而不是替 Host 编一个来源）。另加**三条**有界约束：来源 id 去重、条数封顶、以及**坐标串去重**
 * （`installSource` 界面拿它当 React key、又拿它把「这一行」对回原始结果 `results.find(...)` 的**唯一**
 * 依据；重复时轻则两行共用一个 key，重则**点第二行的【安装】装的是第一行那条技能**——这种「界面靠一个
 * Host 没保证唯一的坐标」必须在边界判死，不让界面去猜）。
 *
 * ★ 为什么来源 id **不做封闭字面集**：来源是 Host 那边可增的（今天三枚）；把它写死会让「上游多接一个源」
 *   这种良性变化在浏览器侧变成整次搜索失败。显示时直接用 id 当来源名（不编造、不维护第二份映射表）。
 *
 * @param value - 响应 `data`。
 * @returns `{sources, results}`（顺序原样保留）。
 * @throws {EnterpriseLocalApiError} `ENT_LOCAL_RESPONSE_INVALID`：任一形状不满足。
 */
export function decodeEnterpriseOnlineSkillSearch(value: unknown): EnterpriseOnlineSkillSearch {
  const row = record(value)
  if (row === undefined || !hasExactKeys(row, ['sources', 'results'])
    || !Array.isArray(row['sources']) || row['sources'].length > ONLINE_SOURCE_MAX
    || !Array.isArray(row['results']) || row['results'].length > ONLINE_RESULT_MAX) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  const sources = row['sources'].map(decodeOnlineSource)
  const sourceIds = new Set<string>()
  for (const source of sources) {
    if (sourceIds.has(source.id)) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    sourceIds.add(source.id)
  }
  const results = row['results'].map(decodeOnlineResult)
  // 坐标串去重（第三条有界约束）：`installSource` 是界面拿它当 React key、又拿它把「这一行」对回
  // 原始结果（`results.find(...)`）的**唯一**依据 —— 重复时轻则两行共用一个 key（React 只认第一条），
  // 重则**点第二行的【安装】装的是第一行那条技能**。故在边界判死，不让界面去猜。
  const installSources = new Set<string>()
  for (const result of results) {
    if (!sourceIds.has(result.sourceId) || installSources.has(result.installSource)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    installSources.add(result.installSource)
  }
  return { sources, results }
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
