/**
 * [INPUT]: 依赖 decode-primitives 的键集封闭判定、record/nonEmptyString/timestamp/enterpriseId 与唯一失败码类
 * [OUTPUT]: 对外提供技能包 DTO（`EnterpriseRuntimeSkill`/`EnterpriseSkillEntry`/`EnterpriseInstalledSkill`）与严格解码 `decodeEnterpriseSkills`（列表）、`decodeEnterpriseSkillDetail`（详情）与 `decodeEnterpriseInstalledSkills`（本机已装态）
 * [POS]: dsh-ui 浏览器契约层的技能分片——从逼近 800 行的 local-api-decode 拆出，专管企业技能目录投影；只保留 frontmatter 脱敏事实，SKILL.md 正文、artifact 路径与 SHA-256 在这里校验形状后即丢，永不进入界面；已装态是本机真值（Host 状态文件 + 落盘存在性），这里只校验形状与技能名规约
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

const SKILL_DETAIL_KEYS = [...SKILL_SUMMARY_KEYS, 'versionId', 'sha256', 'skills'] as const

/** manifest.json 的 id 规约（小写连字符等稳定标识），与契约 SkillPackageRef 同源。 */
const SKILL_PACKAGE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** 单个 SKILL.md 条目名：严格 kebab-case，与官方 `isSkillName` 同源。 */
const SKILL_ENTRY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SKILL_SHA256 = /^[0-9a-f]{64}$/

const SKILL_MAX_SIZE_BYTES = 52_428_800

/**
 * 校验并投影摘要字段（不含键集判定：调用方先按 `hasExactKeys` 选择列表/详情键集）。
 *
 * 两处刻意放宽，都为了兼容真实服务端输出而不牺牲边界安全：
 * - `description` 允许 JSON null（manifest.json 的 description 选填），投影为空串；
 * - 非 string 非 null 的描述、非正大小、越界技能数与非法时间戳一律判畸形。
 */
function decodeSkillSummaryFields(row: JsonRecord): EnterpriseRuntimeSkill {
  if (!enterpriseId(row['id'])
    || !nonEmptyString(row['skillId']) || row['skillId'].length > 128 || !SKILL_PACKAGE_REF.test(row['skillId'])
    || !nonEmptyString(row['displayName']) || row['displayName'].length > 120
    || !(row['description'] === null || (typeof row['description'] === 'string' && row['description'].length <= 2000))
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
 */
export function decodeEnterpriseSkills(value: unknown): readonly EnterpriseRuntimeSkill[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
  }
  return value.map(item => {
    const row = record(item)
    if (row === undefined || !hasExactKeys(row, SKILL_SUMMARY_KEYS)) {
      throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
    }
    return decodeSkillSummaryFields(row)
  })
}

/**
 * 严格解码技能包详情（`GET /enterprise/api/v1/skills/{skillPackageId}` 的 `data`）。
 *
 * 详情键集 = 摘要字段 + versionId + sha256 + skills；`sha256` 只作形状门禁后丢弃，
 * 条目只保留 frontmatter 事实（正文从不在这份契约里）。
 */
export function decodeEnterpriseSkillDetail(value: unknown): EnterpriseRuntimeSkill {
  const row = record(value)
  if (row === undefined
    || !hasExactKeys(row, SKILL_DETAIL_KEYS)
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
