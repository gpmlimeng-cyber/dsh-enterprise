/**
 * [INPUT]: 无运行时依赖（纯类型 + 纯函数 + 文案常量）——只读 `skill-api-decode` 的三份形状（官方发现面条目 + 企业已装记录 + 本机自装记录）、`esc-copy` 的文案与 `esc-types` 的 `ResourceItem`
 * [OUTPUT]: 对外提供「已安装技能」页的**纯投影**：来源分组 `enterpriseEscInstalledGroups`（含分组顺序真源 `ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS`、组名取值 `enterpriseEscInstalledGroupTitleOf`、单条来源标注 `enterpriseEscInstalledSourceLabel`、元信息表 `enterpriseEscInstalledMetaTable`）与卡片投影 `enterpriseEscInstalledCard`（key / 卡片数据 / 那枚开关**能不能拨** / 元信息半句）
 * [POS]: 口径 47/54 的**事实层**（与 `esc-installed.tsx` 那种"带 hook 的视图"分开）。
 *   为什么非要拆出来：本仓的 vitest **没有 DOM、也跑不了 hook**（`useState` 一在组件本体里出现，用例就没法直调它）
 *   —— 于是"分几组、组名是什么、卡片取哪个字段、哪一枚开关该置灰"这些**判定**必须住在能直调的纯函数里，
 *   否则它们只能靠"看代码"保证。视图那一层因此只剩「把模型画出来」这一件事。
 * ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：
 *   · **列表真源 = 官方发现面**（`EnterpriseDiscoveredSkill[]`，宿主 `ctx.get('skills')` 的快照）；
 *     "装没装"这件事只有一个答案，就是它 —— 老那两份记录**不再作判据**。
 *   · **分组依据 = 官方给的 `source`**（再把"企业中心装下来的"单独认出来：它与本机导入的
 *     都落在 `user-dsh` 根里，只有企业那份记录能说清它与众不同）。组名就是"谁放进去的"。
 *   · **两份老记录降级成元信息**：企业记录贡献 `versionId`（版本）与 `packageId`（**卸载要用**）；
 *     自装记录贡献 `sha256`（摘要）与 `displayName`（显示名）。它们**缺席**时卡片照样画出来，
 *     只是那半句元信息/那枚开关的说明跟着变 —— 绝不因为"我们的记录里没有"就否认磁盘上的既定事实。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  EnterpriseDiscoveredSkill,
  EnterpriseInstalledSkill,
  EnterpriseSelfInstalledSkill,
} from '../skill-api-decode.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { ResourceItem } from './esc-types.js'

/**
 * 四类**已知**来源（顺序即分组的呈现顺序，这一条数组是顺序的唯一真源）。
 *
 * `center` = 与**企业已装记录**同名的那一枚（中心装下来的），其余三类按官方 `source` 归：
 *   · `user-dsh`/`user-agents` ⇒ `self`（本机导入的）
 *   · `project-dsh`/`project-agents` ⇒ `project`（项目里的）
 *   · `runtime`/`bundled` ⇒ `bundled`（官方内置）
 * 官方 `source` 是**开放取值域**（契约 `(string & {})`），没归到上面任何一类的落 `other:<原样 source>`。
 */
export const ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS = ['center', 'self', 'project', 'bundled'] as const

/** 四类已知来源之一。 */
export type EnterpriseEscInstalledSourceKind = (typeof ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS)[number]

/**
 * 一个分组的身份：四类已知来源之一，或 `other:<官方原样 source>`（未知来源**各自成组**）。
 *
 * ★为什么未知来源不并成一个大组：并了以后组名只能写"其它来源"，员工就**分不出**
 *   "谁放进去的"（而那是本刀唯一要求的来源标注）。各自成组时组名带上原样枚举
 *   （`其它来源（custom）`）——宁可显示一个英文枚举，也不假装认识它。
 */
export type EnterpriseEscInstalledGroupId = EnterpriseEscInstalledSourceKind | `other:${string}`

/** 官方 `source` 到四类已知来源的归一（唯一一处；判据是**枚举值**，不是路径）。 */
const SOURCE_KIND_OF: Readonly<Record<string, EnterpriseEscInstalledSourceKind>> = {
  'user-dsh': 'self',
  'user-agents': 'self',
  'project-dsh': 'project',
  'project-agents': 'project',
  runtime: 'bundled',
  bundled: 'bundled',
}

/** 一份已发现技能的**元信息**（来自那两份降级后的老记录；每一格都可缺席）。 */
export interface EnterpriseEscInstalledMeta {
  /** 企业已装记录里的 `versionId`（有就写进卡片那半句）。 */
  readonly versionId?: string | undefined
  /** 企业已装记录里的 `packageId`（**卸载路由的入参**；没有它就没有卸载可走）。 */
  readonly packageId?: string | undefined
  /** 自装记录里的 `sha256`（制品摘要）。 */
  readonly sha256?: string | undefined
  /** 两份记录任一给出的显示名（都为空时不写，标题回落技能名）。 */
  readonly displayName?: string | undefined
}

/** 两张老记录投影成"按技能名索引的元信息表"（唯一一处；不在视图里各算一遍）。 */
export interface EnterpriseEscInstalledMetaTable {
  readonly of: (name: string) => EnterpriseEscInstalledMeta
}

/**
 * 把两份**降级为元信息**的老记录建成索引表。
 *
 * ★索引键是**技能名（kebab）**：企业记录用 `skillId`、自装记录用 `names[]`，两边与发现面的
 *   `name` 都是同一套 kebab 名（口径 47 起"已装判定"用的就是这把公共键，本刀把它升级为
 *   磁盘真值的对撞键：广场卡片的已装判定同理）。
 * ★同名的两份记录**合并**：企业记录贡献 `versionId`/`packageId`，自装记录补 `sha256`，
 *   先到者不被后到者抹掉（各自只写自己有值的那几格）。
 */
export function enterpriseEscInstalledMetaTable(
  center: readonly EnterpriseInstalledSkill[],
  self: readonly EnterpriseSelfInstalledSkill[],
): EnterpriseEscInstalledMetaTable {
  const table = new Map<string, EnterpriseEscInstalledMeta>()
  const merge = (name: string, patch: EnterpriseEscInstalledMeta): void => {
    if (name.length === 0) return
    const current = table.get(name) ?? {}
    table.set(name, {
      versionId: patch.versionId ?? current.versionId,
      packageId: patch.packageId ?? current.packageId,
      sha256: patch.sha256 ?? current.sha256,
      displayName: patch.displayName ?? current.displayName,
    })
  }
  for (const record of center) {
    merge(record.skillId, {
      versionId: record.versionId,
      packageId: record.packageId,
      displayName: record.displayName,
    })
  }
  for (const record of self) {
    for (const name of record.names) {
      merge(name, { sha256: record.sha256, displayName: record.displayName })
    }
  }
  return { of: name => table.get(name) ?? {} }
}

/**
 * 一条已发现技能属于哪一组（唯一判定）。
 *
 * ★企业记录同名 ⇒ `center`：**先判它**，因为企业装下来的那些技能与"本机导入的"落的是
 *   **同一个** `user-dsh` 根，光看 `source` 分不出来；能分出来的只有我们那份企业记录。
 *   这也是它降级成"元信息"之后仍然**必须在场**的那一件用途。
 *
 * @param skill - 官方发现面的一条。
 * @param meta - 上面那张元信息表（判"是不是企业装下来的"就看它的 `packageId`）。
 * @returns 分组身份。
 */
export function enterpriseEscInstalledGroupIdOf(
  skill: EnterpriseDiscoveredSkill,
  meta: EnterpriseEscInstalledMetaTable,
): EnterpriseEscInstalledGroupId {
  if (meta.of(skill.name).packageId !== undefined) return 'center'
  const kind = SOURCE_KIND_OF[skill.source]
  return kind ?? `other:${skill.source}`
}

/**
 * 组名的唯一取值口（含未知来源那种"其它来源（custom）"的拼法）。
 *
 * @param id - `enterpriseEscInstalledGroupIdOf` 给的组身份。
 * @returns 员工看到的那一句组名（即"谁放进去的"）。
 */
export function enterpriseEscInstalledGroupTitleOf(id: EnterpriseEscInstalledGroupId): string {
  if (id === 'center') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupCenter
  if (id === 'self') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupSelf
  if (id === 'project') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupProject
  if (id === 'bundled') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupBundled
  return `${ENTERPRISE_ESC_LOCAL_COPY.installedGroupOther}（${id.slice('other:'.length)}）`
}

/**
 * 单条的**来源标注**（分组标题那一句，逐字同源）——给用例与将来别处的标注复用。
 *
 * @param skill - 官方发现面的一条。
 * @param meta - 元信息表。
 * @returns 这一条"是谁放进去的"。
 */
export function enterpriseEscInstalledSourceLabel(
  skill: EnterpriseDiscoveredSkill,
  meta: EnterpriseEscInstalledMetaTable,
): string {
  return enterpriseEscInstalledGroupTitleOf(enterpriseEscInstalledGroupIdOf(skill, meta))
}

/** 一张已安装卡片的**渲染数据** + 它那枚开关的**可拨性**（`locked` = 拨不动，原因由视图写成 title）。 */
export interface EnterpriseEscInstalledCard {
  /** React key：**按技能名**（发现面按名字标识技能；同名条目用序号兜住，故 key 恒唯一）。 */
  readonly key: string
  /** 卡片数据（标题＝显示名回落技能名、描述＝官方发现面给的真描述）。 */
  readonly item: ResourceItem
  /**
   * 这一枚的开关能不能拨。
   *
   * ★`false` 只有一种来由：**名字对上了企业已装记录**（`packageId` 在位）⇒ 有中心卸载路由可走。
   *   对不上的（本机导入 / 项目 / 官方内置 / 未知来源）一律 `true` 并写明原因
   *   —— 绝不画一枚拨了没反应的控件。
   */
  readonly locked: boolean
  /** 卸载入参（企业雪花包 id）；`locked` 时不给这个键。 */
  readonly packageId?: string | undefined
  /**
   * 元信息半句（`版本 1.2.3` / `摘要 ab12cd34…`）；两份老记录都没给相关事实时就**不给**这个键
   * （不编、不写"未知"）。
   */
  readonly meta?: string | undefined
}

/** 一个分组：身份 + 组名 + 卡片（顺序即四类已知来源的固定序，其后接未知来源组）。 */
export interface EnterpriseEscInstalledGroup {
  readonly id: EnterpriseEscInstalledGroupId
  readonly title: string
  readonly cards: readonly EnterpriseEscInstalledCard[]
}

/**
 * 一条已发现技能 → 一张卡片（唯一投影；视图不再自己算任何一格）。
 *
 * @param skill - 官方发现面的一条（**列表真源**）。
 * @param meta - 这一条的元信息（企业/自装两份记录里能对上名的那部分）。
 * @param index - 它在发现面里的位次（同名条目靠它把 key 分开）。
 * @returns 卡片数据与开关可拨性。
 */
export function enterpriseEscInstalledCard(
  skill: EnterpriseDiscoveredSkill,
  meta: EnterpriseEscInstalledMeta,
  index: number,
): EnterpriseEscInstalledCard {
  const displayName = meta.displayName !== undefined && meta.displayName.trim().length > 0
    ? meta.displayName
    : skill.name
  // 元信息半句：版本优先（企业记录给的中心版本号），没有版本就写摘要（自装记录给的制品摘要）。
  const metaText = meta.versionId !== undefined && meta.versionId.length > 0
    ? `${ENTERPRISE_ESC_LOCAL_COPY.installedMetaVersion} ${meta.versionId}`
    : meta.sha256 !== undefined && meta.sha256.length > 0
      ? `${ENTERPRISE_ESC_LOCAL_COPY.installedMetaDigest} ${meta.sha256.slice(0, 12)}…`
      : undefined
  return {
    key: `installed-${index}-${skill.name}`,
    item: {
      id: `installed-${skill.name}`,
      name: displayName,
      // ★描述用**官方发现面给的那一句**（SKILL.md frontmatter 的 description）——老那两份记录里
      //   根本没有介绍文案，旧实现只能拿包内目录名拼一句；换了真源之后这一行终于是真描述。
      description: skill.description,
    },
    locked: meta.packageId === undefined,
    ...(meta.packageId === undefined ? {} : { packageId: meta.packageId }),
    ...(metaText === undefined ? {} : { meta: metaText }),
  }
}

/**
 * 发现面快照 → 分组（顺序：四类已知来源固定序，其后是未知来源组**按来源名码元升序**）。
 *
 * ★空组**不进结果**（磁盘上真没有那一类技能时不画一个「（0）」的空壳）；
 *   一条都没有时返回空数组，由视图说整页空态。
 * ★未知来源组的顺序**不用** `localeCompare`：那随运行时区域变。这里用**码元升序**
 *   （与 `skill-install.ts` 里"码元升序确定性排序"同一条纪律），跑几次都一样。
 *
 * @param skills - 官方发现面快照的 `skills`。
 * @param meta - 两份老记录建成的元信息表。
 * @returns 有序分组。
 */
export function enterpriseEscInstalledGroups(
  skills: readonly EnterpriseDiscoveredSkill[],
  meta: EnterpriseEscInstalledMetaTable,
): readonly EnterpriseEscInstalledGroup[] {
  const buckets = new Map<EnterpriseEscInstalledGroupId, EnterpriseEscInstalledCard[]>()
  skills.forEach((skill, index) => {
    const id = enterpriseEscInstalledGroupIdOf(skill, meta)
    const card = enterpriseEscInstalledCard(skill, meta.of(skill.name), index)
    const bucket = buckets.get(id)
    if (bucket === undefined) buckets.set(id, [card])
    else bucket.push(card)
  })
  const known = ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS
    .filter(id => buckets.has(id))
    .map(id => ({ id, title: enterpriseEscInstalledGroupTitleOf(id), cards: buckets.get(id)! }))
  const other = [...buckets.keys()]
    .filter((id): id is `other:${string}` => id.startsWith('other:'))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map(id => ({ id, title: enterpriseEscInstalledGroupTitleOf(id), cards: buckets.get(id)! }))
  return [...known, ...other]
}
