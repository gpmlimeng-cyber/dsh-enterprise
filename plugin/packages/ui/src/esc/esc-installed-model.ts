/**
 * [INPUT]: 无运行时依赖（纯类型 + 纯函数 + 文案常量）——只读 `skill-api-decode` 的三份形状（官方发现面条目 + 企业已装记录 + 本机自装记录）、`esc-copy` 的文案与 `esc-types` 的 `ResourceItem`
 * [OUTPUT]: 对外提供「已安装技能」页的**纯投影**：来源分组 `enterpriseEscInstalledGroups`（含分组顺序真源 `ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS`、组名取值 `enterpriseEscInstalledGroupTitleOf`、单条来源标注 `enterpriseEscInstalledSourceLabel`、元信息表 `enterpriseEscInstalledMetaTable`）、**账本条数** `enterpriseEscInstalledCount`（顶栏与页头**同一个数**的取值口）与卡片投影 `enterpriseEscInstalledCard`（key / **判据键 `name`** / 卡片数据 / 那枚开关**能不能拨** / 元信息半句）
 * [POS]: 口径 47/54 的**事实层**（与 `esc-installed.tsx` 那种"带 hook 的视图"分开）。
 *   为什么非要拆出来：本仓的 vitest **没有 DOM、也跑不了 hook**（`useState` 一在组件本体里出现，用例就没法直调它）
 *   —— 于是"分几组、组名是什么、卡片取哪个字段、哪一枚开关该置灰"这些**判定**必须住在能直调的纯函数里，
 *   否则它们只能靠"看代码"保证。视图那一层因此只剩「把模型画出来」这一件事。
 * ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：
 *   · **列表真源 = 官方发现面**（`EnterpriseDiscoveredSkill[]`，宿主 `ctx.get('skills')` 的快照）；
 *   · **两份老记录降级成元信息**：企业记录贡献 `versionId`（版本）与 `packageId`（**卸载要用**）；
 *     自装记录贡献 `sha256`（摘要）、`displayName`（显示名）与 `sourceInput`（**渠道坐标**，见下）。
 * ★**本刀（已安装页补「更多 + 去试试」）**：卡片投影多一格 `name`＝**发现面里的 kebab 技能名**
 *   （＝本机落盘目录名）。它是「更多」「去试试」两个计划的**唯一键**，与 `item.name`（给员工看的标题，
 *   显示名优先）**刻意分成两格**：拿显示名当键会两头都错（显示名不在自装记录的 `names[]` 里 ⇒ 静默丢掉
 *   卸载入口；非 ASCII 拼不出合法指令 ⇒ 那枚「去试试」被禁用）。判据一个字都没变（仍是 `names[]`），
 *   改的只是"视图从哪里拿到那把键"。
 * ★★**本刀（用户最终裁决：`已安装` = DSH 自己装过的那本账，按"来源渠道"分四组）——这一页的账目口径**：
 *
 *   用户原话：「**系统内置，来自内部市场、来自外部市场、用户自定义**」⇒ **四组**、组名与顺序逐字照此：
 *     ① `builtin`  「系统内置」    官方 `source ∈ { bundled, runtime }`（**优先于 ②③**）
 *     ② `internal` 「来自内部市场」 名字命中**中心已装记录**（`installed.json`，键是它那枚 kebab `skillId`）
 *                                  ∪ 自装记录的 `sourceInput` 以 `nuwax:` 开头（＝平台系统广场导出安装的）
 *     ③ `external` 「来自外部市场」 自装记录的 `sourceInput` 以四个市场 id 之一开头：
 *                                  `skillhub:` / `skills.sh:` / `clawhub.ai:` / `claude-plugins.dev:`
 *     ④ `custom`   「用户自定义」   **其余有 DSH 记录**的自装（本地上传的 `.dshskill` / 从「本地三方」
 *                                  复制进来的（记的是来源根 id）/ 从「系统搜索」纳入的（记的是绝对路径）），
 *                                  以及**未知前缀**（不新造第五组、不隐藏）
 *   ★**其余一律不在这一页**：没有 DSH 记录的一律出去（那 7 枚无记录 `user-dsh` 与 41 枚无记录
 *     `user-agents`；它们仍在「本地三方」那一面 —— 宿主 `buildThirdPartySkillRoots` 的根表里就有
 *     `~/.dsh/skills` 与 `~/.agents/skills`，故"出去"不等于"丢掉"）。
 *   ★**`sourceInput` 的每个取值都按 `bundle` 源码逐条查实**（本文件只读前缀，判据一处；取值出处见下面
 *     那两条前缀常量的注释）。**判据只认"记录 + source 枚举 + sourceInput 前缀"** —— 绝不拿
 *     "它在不在磁盘上"当"装过"（发现面里每一条都在磁盘上，那正是要筛掉的那批）。
 *   ★**已知缺口（就地登记，不藏）**：`project-dsh` / `project-agents` 这两类**没有 DSH 记录** ⇒ 按本口径
 *     它们**不在这一页**，而它们也还不在「本地三方」（那一面的根表里没有项目根）⇒ **项目根的技能当前
 *     无处显示**。这是已知缺口，等「本地三方」扩项目根那一刀一起解决（不在这里硬塞第五组）。
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
 * 四个**来源渠道**分组（顺序即分组的呈现顺序，这一条数组是顺序的唯一真源；用户原话的顺序）。
 *
 * 与旧那套（按官方 `source` 枚举分 `center/self/project/bundled`）**不同**：这一版问的是
 * "**它当初是从哪条渠道装进来的**"（内置 / 内部市场 / 外部市场 / 用户自己），而答案只能从
 * **两份 DSH 记录**里读（`sourceInput` 那枚渠道坐标 + 中心记录的在场）。
 */
export const ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS = ['builtin', 'internal', 'external', 'custom'] as const

/** 四个来源渠道之一。 */
export type EnterpriseEscInstalledSourceKind = (typeof ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS)[number]

/** 一个分组的身份（恰好四类——未知来源落 `custom`，不各自成组）。 */
export type EnterpriseEscInstalledGroupId = EnterpriseEscInstalledSourceKind

/**
 * **内部市场**的 `sourceInput` 前缀（唯一一处；取值出处逐条查实过）：
 *   · `nuwax:` —— `bundle/src/skill-published.ts:344`（常量 `PUBLISHED_SKILL_SOURCE_PREFIX` @ `:86`）
 *     写的是 `nuwax:<targetId>`，即**平台系统广场导出安装**那一条。
 */
export const ENTERPRISE_ESC_INTERNAL_MARKET_PREFIXES = ['nuwax:'] as const

/**
 * **外部市场**的 `sourceInput` 前缀（唯一一处；取值出处逐条查实过）：
 *   · `skillhub:`      —— `bundle/src/skill-skillhub.ts:278`（常量 `SKILLHUB_SOURCE_INPUT_PREFIX` @ `:57`），
 *                         写的是 `skillhub:<slug>@<version>`；在线搜索的第四源（`skillhub.cn`）在
 *                         `skill-online.ts:1166` 提前 return、委托同一条链，故落盘的也是这一枚前缀。
 *   · `skills.sh:`     —— `bundle/src/skill-online.ts:1221` 写 `${sourceId}:${reference}`，
 *   · `claude-plugins.dev:`  `sourceId` 取自 `ONLINE_SKILL_SOURCE_IDS`（同文件 `:49`）。
 *   · `clawhub.ai:`    —— 同上（`clawhub.ai` 那条的 `reference` 里嵌套 `skills-sh:…`，但坐标前缀仍是它）。
 * ★**不改 `bundle` 的记账**：这四个前缀是**冻结契约**里已经在写的事实，这里只做只读判据。
 */
export const ENTERPRISE_ESC_EXTERNAL_MARKET_PREFIXES = [
  'skillhub:',
  'skills.sh:',
  'claude-plugins.dev:',
  'clawhub.ai:',
] as const

/**
 * 一条自装记录的 `sourceInput` → 它属于哪个渠道（**唯一判定**；`internal` / `external` / `custom`）。
 *
 * 三条纪律：
 *   ① **只认前缀**、用 `startsWith`（不做 trim / 不做大小写折叠）：写进去的就是
 *      `<前缀><载荷>`，任何"顺手规整一下"都会让判据与契约漂开；
 *   ② **未知前缀（含空串、文件名、绝对路径、来源根 id）一律落 `custom`** —— 不新造第五组、
 *      不隐藏（用户裁决原话：其余**有记录**的自装就是「用户自定义」）；
 *   ③ 本函数**不发请求、不读磁盘、不认识任何路径**：`sourceInput` 是**记录里的字符串**，不是文件系统。
 *
 * @param sourceInput - 自装记录里那枚渠道坐标（缺席 = 这一版 Host 没给 ⇒ 同样落 `custom`）。
 * @returns 这一条记录属于哪个渠道分组。
 */
export function enterpriseEscSelfChannelOf(
  sourceInput: string | undefined,
): 'internal' | 'external' | 'custom' {
  const value = sourceInput ?? ''
  if (ENTERPRISE_ESC_INTERNAL_MARKET_PREFIXES.some(prefix => value.startsWith(prefix))) return 'internal'
  if (ENTERPRISE_ESC_EXTERNAL_MARKET_PREFIXES.some(prefix => value.startsWith(prefix))) return 'external'
  return 'custom'
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
  /**
   * ★**本刀**：自装记录里的 `sourceInput`（**渠道坐标**）——「内部市场 / 外部市场 / 用户自定义」
   *   这三组的**唯一判据**（见 `enterpriseEscSelfChannelOf`）。缺席 = 那一版 Host 没给这一格。
   */
  readonly sourceInput?: string | undefined
  /**
   * ★**本刀**：这一条**命中了自装记录**（`names[]` 里有它）——"有 DSH 记录"这一半的显式标记
   *   （另一半是 `packageId` ＝中心已装记录）。
   *
   * ★为什么单列一位而不是拿 `sha256` 在场来推：判据要**读得出来**它判的是什么（自装记录命中），
   *   而不是"因为自装记录恰好总带 sha256，所以 sha256 在场就等价于命中"——那条等价关系是**耦合**，
   *   契约哪天允许 sha256 缺席，这一页就会静默漏掉一整批技能。
   */
  readonly selfRecorded?: true | undefined
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
      sourceInput: patch.sourceInput ?? current.sourceInput,
      selfRecorded: patch.selfRecorded ?? current.selfRecorded,
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
      // ★本刀：`sourceInput`（渠道坐标）与 `selfRecorded`（**命中了自装记录**）一起并进这一把键 ——
      //   前者判「内部市场 / 外部市场 / 用户自定义」，后者判"这一条到底在不在 DSH 那本账上"。
      merge(name, {
        sha256: record.sha256,
        displayName: record.displayName,
        sourceInput: record.sourceInput,
        selfRecorded: true,
      })
    }
  }
  return { of: name => table.get(name) ?? {} }
}

/**
 * 一条已发现技能属于哪一组（**唯一判定**）——`undefined` 表示**这一页不出现**。
 *
 * 判据三条，顺序即优先级（用户原话「系统内置，来自内部市场、来自外部市场、用户自定义」）：
 *   ① **系统内置**：官方 `source ∈ { bundled, runtime }`（**优先于** ②③——一枚内置技能即便
 *      名字也命中记录，它"是谁放进去的"只有一个答案：DSH 自己）；
 *   ② **来自内部市场**：名字命中**中心已装记录**（`installed.json`；它的 `skillId` 就是那枚技能的
 *      kebab 名，见 `contracts/fixtures/skill-version-success.json:5`），或自装记录的 `sourceInput`
 *      以 `nuwax:` 开头（平台系统广场导出安装）；
 *   ③ **来自外部市场 / 用户自定义**：命中**自装记录**（`names[]`）时按 `sourceInput` 前缀分档
 *      （`enterpriseEscSelfChannelOf`；未知前缀落 `custom`）。
 * ★**没有任何 DSH 记录 ⇒ `undefined`**：这正是本刀那条用户裁决（"电脑上装的不是 DSH 安装的
 *   就不要出现在已安装里"）的落点。**判据只认记录 + source 枚举**，绝不看"它在不在磁盘上"。
 * ★`project-dsh` / `project-agents` 这两类**没有记录** ⇒ 同样 `undefined`（已知缺口，见文件头）。
 *
 * @param skill - 官方发现面的一条。
 * @param meta - 上面那张元信息表（"在不在账上"就看 `packageId` / `selfRecorded`）。
 * @returns 分组身份；`undefined` = 这一条**不进这一页**。
 */
export function enterpriseEscInstalledGroupIdOf(
  skill: EnterpriseDiscoveredSkill,
  meta: EnterpriseEscInstalledMetaTable,
): EnterpriseEscInstalledGroupId | undefined {
  if (skill.source === 'bundled' || skill.source === 'runtime') return 'builtin'
  const record = meta.of(skill.name)
  if (record.packageId !== undefined) return 'internal'
  if (record.selfRecorded === true) return enterpriseEscSelfChannelOf(record.sourceInput)
  return undefined
}

/**
 * 组名的唯一取值口（四个渠道，逐字照用户给的说法）。
 *
 * @param id - `enterpriseEscInstalledGroupIdOf` 给的组身份。
 * @returns 员工看到的那一句组名（即"从哪条渠道装进来的"）。
 */
export function enterpriseEscInstalledGroupTitleOf(id: EnterpriseEscInstalledGroupId): string {
  if (id === 'builtin') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupBuiltin
  if (id === 'internal') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupInternal
  if (id === 'external') return ENTERPRISE_ESC_LOCAL_COPY.installedGroupExternal
  return ENTERPRISE_ESC_LOCAL_COPY.installedGroupCustom
}

/**
 * 单条的**来源标注**（分组标题那一句，逐字同源）——给用例与将来别处的标注复用。
 *
 * @param skill - 官方发现面的一条。
 * @param meta - 元信息表。
 * @returns 这一条"是从哪条渠道装进来的"；**账外那一条给 `undefined`**（它不在这一页，
 *   没有组名可标——不编一个"其它"糊上去）。
 */
export function enterpriseEscInstalledSourceLabel(
  skill: EnterpriseDiscoveredSkill,
  meta: EnterpriseEscInstalledMetaTable,
): string | undefined {
  const id = enterpriseEscInstalledGroupIdOf(skill, meta)
  return id === undefined ? undefined : enterpriseEscInstalledGroupTitleOf(id)
}

/** 一张已安装卡片的**渲染数据** + 它那枚开关的**可拨性**（`locked` = 拨不动，原因由视图写成 title）。 */
export interface EnterpriseEscInstalledCard {
  /** React key：**按技能名**（发现面按名字标识技能；同名条目用序号兜住，故 key 恒唯一）。 */
  readonly key: string
  /**
   * ★**本刀**：这一条在**官方发现面里的技能名**（kebab＝本机落盘目录名）——「更多」「去试试」两个计划的
   *   **唯一键**（视图不再从别处猜）。
   *
   * ★**为什么它必须与 `item.name` 分开**：`item.name` 是**给员工看的标题**（显示名优先、缺则回落技能名），
   *   而这一格是**判据键**——`enterpriseEscSkillMorePlan` 只认自装记录的 `names[]`（落盘目录名），
   *   `enterpriseEscSkillTryPlan` 也按同一把键拼指令。拿显示名当键会**两头都错**：显示名（如
   *   「会议纪要技能组」）既不在 `names[]` 里（⇒ 一枚本该能卸的卡静默失去卸载入口），也拼不出合法
   *   指令（非 ASCII ⇒ 禁用）。两格各自成立、互不替代：标题那格照旧给员工看，这一格只给判据用。
   */
  readonly name: string
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

/** 一个分组：身份 + 组名 + 卡片（顺序即 `ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS` 的固定序）。 */
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
    // ★本刀：判据键（发现面的 kebab 名）与**给员工看的标题**分成两格——见接口上那一段。
    name: skill.name,
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
 * 发现面快照 → 分组（顺序：`ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS` 的固定序）。
 *
 * ★**这里同时是这一页的那道"账目筛子"**：`enterpriseEscInstalledGroupIdOf` 给 `undefined` 的
 *   （没有任何 DSH 记录）**一条都不进结果**——那正是用户裁决「电脑上装的不是 DSH 安装的就不要出现在
 *   已安装里」的落点。它们在「本地三方」那一面照旧出现（宿主根表里有 `~/.dsh/skills` 等）。
 * ★空组**不进结果**（没有那一类渠道的技能时不画一个「（0）」的空壳）；一条都没有时返回空数组，
 *   由视图说整页空态（那句空话要说真话：见 `installedEmpty`）。
 * ★★**分组只决定"归到哪一组 / 画不画"，绝不参与任何动作的可用性**：安装 / 卸载 / 打开文件夹 /
 *   「去试试」的判据仍然只有两件 —— **记录 + 端口在不在场**（分别见 `esc-card.tsx` 那两道闸与
 *   `esc-skill-more.ts` / `esc-skill-try.ts` 两枚纯投影）。分组是**显示口径**，不是权限、不是能力，
 *   也不是权威事实（`sourceInput` 是自由串，用户自造一个前缀就能"换组"——这一句是给后来者的提醒）。
 *
 * @param skills - 官方发现面快照的 `skills`。
 * @param meta - 两份老记录建成的元信息表。
 * @returns 有序分组（只含账上那几条）。
 */
export function enterpriseEscInstalledGroups(
  skills: readonly EnterpriseDiscoveredSkill[],
  meta: EnterpriseEscInstalledMetaTable,
): readonly EnterpriseEscInstalledGroup[] {
  const buckets = new Map<EnterpriseEscInstalledGroupId, EnterpriseEscInstalledCard[]>()
  skills.forEach((skill, index) => {
    const id = enterpriseEscInstalledGroupIdOf(skill, meta)
    // ★账外（没有任何 DSH 记录）⇒ 这一页不出现（不是"画成禁用"、也不是"归到用户自定义"）。
    if (id === undefined) return
    const card = enterpriseEscInstalledCard(skill, meta.of(skill.name), index)
    const bucket = buckets.get(id)
    if (bucket === undefined) buckets.set(id, [card])
    else bucket.push(card)
  })
  return ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS
    .filter(id => buckets.has(id))
    .map(id => ({ id, title: enterpriseEscInstalledGroupTitleOf(id), cards: buckets.get(id)! }))
}

/**
 * ★**本刀（用户裁决：同一个词在同一屏上只指一个数）**：这一页的**账本条数**。
 *
 * ＝ `enterpriseEscInstalledGroups` 铺出来的卡片总数（**同一个判据、同一个纯投影**）。
 *
 * ★**为什么单列一个函数**：顶栏那枚「已安装(N)」与页头「已安装技能（N）」**都是它的消费者** ——
 *   判据（"系统内置 ∪ 有 DSH 记录"）只有一处实现（`enterpriseEscInstalledGroupIdOf`），两个消费者
 *   调**同一个函数**、吃**同一份输入**，故真机上不可能再出现「已安装(64)」对「已安装技能（14）」
 *   这种"同一个词指两个数"的自相矛盾。
 * ★**反向锁**：同名的技能若**既**命中中心记录**又**出现在发现面里，它仍然只是**一枚**（按名字去重，
 *   不是"两份之和"）—— 计数与列表永远同长。
 *
 * @param skills - 官方发现面快照的 `skills`（**列表真源**）。
 * @param meta - 两份 DSH 记录建成的元信息表（"在不在账上"的判据）。
 * @returns 账上那几条的枚数（＝`enterpriseEscInstalledGroups(skills, meta)` 的卡片总数）。
 */
export function enterpriseEscInstalledCount(
  skills: readonly EnterpriseDiscoveredSkill[],
  meta: EnterpriseEscInstalledMetaTable,
): number {
  return enterpriseEscInstalledGroups(skills, meta)
    .reduce((total, group) => total + group.cards.length, 0)
}
