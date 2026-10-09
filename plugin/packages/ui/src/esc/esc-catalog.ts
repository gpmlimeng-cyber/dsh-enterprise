/**
 * [INPUT]: 依赖 `list-state` 的四态类型、`skill-market.tsx` 的**唯一**取数源工厂
 *   `createEnterpriseSkillListSource` 与它那四句目录文案 + `enterpriseSkillMeta`（**刻意复用**，
 *   见下面那段"为什么这一面直接 import 设置页那个视图文件"）、`skill-api-decode` 的两份包投影类型、
 *   `esc-sub-tabs` 的 chip 机制与按 key 过滤、`esc-types` 的 `ResourceItem` 与 `esc-copy` 的文案
 * [OUTPUT]: 对外提供「企业技能」（口径 53，技能页第四枚维度）这一面的**纯事实层**：
 *   可见文案（页内说明 / 加载 / 失败前缀 / **两句不同的空话** / 刷新 / 安装动作三态 / 在途与成功交代 /
 *   两种禁用原因）、唯一卡片投影 `enterpriseCatalogItem`(`s`)（**唯一**会填 `ResourceItem.packageId`
 *   与 `.meta` 的地方）、已装判定键 `enterpriseCatalogInstalledPackages`（**`packageId` 精确命中**）、
 *   二级 chip 投影 `enterpriseCatalogSubChips`、唯一状态投影 `enterpriseCatalogFace`（四态 → loading /
 *   failed / empty / ready，**互斥**）、以及一枚【＋】的**按钮终态** `enterpriseCatalogActionPlan`
 *   （可点 / 这一枚在途 / 被别人的在途挡住 / 写入口缺席，四档各有自己的可见文案）
 * [POS]: dsh-ui 技能页**第四枚维度**的**唯一判定与文案真源**（页面只画、聚合层只接线）。
 *   真源是冻结契约 `analysis/esc-skill-install-spec.md`（口径 53，用户裁决 A + 落点甲）。
 *
 *   ★**为什么这一面直接 import `../skill-market.js`（而 `esc-third-party.ts` 是零依赖叶子）**：
 *     本维度的数据源就是**企业设置 → 技能**那一页的**同一个**取数源工厂
 *     （`createEnterpriseSkillListSource`：目录 + 本机已装，次级失败显式降级并交码），
 *     "同一个目录的同一句话"比"一个不 import React 的纯文件"更重要 —— 若在这里另抄一份
 *     加载/空/失败文案与元信息格式，两处就一定会漂（而漂了之后员工会在两个页面里
 *     读到同一件事的两种说法）。代价如实写明：本文件因此**不再是**零依赖叶子
 *     （经 `skill-market.tsx` 间接依赖 React 与官方原语）。方向是单向的（`esc/` → `skill-market`），
 *     后者不认识 esc，无循环。
 *
 *   ★**它和 `esc-third-party.ts` 的关系（为什么两枚维度不是一枚）**：
 *     · 那一面扫的是**别的 Agent CLI 的技能库**，动作是「把目录**复制**进来」；
 *     · 这一面读的是**企业中心发布并登记过**的技能包，动作是「**下载 + SHA-256 校验 + 落盘**」
 *       —— 也就是口径 53 用户那句「把后台注册的技能，安装到 DSH 本地」。
 *     两面的候选形状、状态字面、可装判据、失败码族**全都不同**，故各自成文；谁也不冒充谁。
 *
 *   ★**零编造**：本文件不产生任何卡片文案与已装态 —— 名字/描述/分类/元信息全部取自上响应，
 *     而"装没装"由 `packageId` 对撞 `GET /skills/installed` 那份真值（**不是按名字猜**）。
 *     界面**从不乐观切换**：失败不翻态、成功也只认 Host 回传的那份清单。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseListState } from '../list-state.js'
import type { EnterpriseInstalledSkill, EnterpriseRuntimeSkill } from '../skill-api-decode.js'
import {
  ENTERPRISE_SKILL_LIST_EMPTY,
  ENTERPRISE_SKILL_LIST_FAILED,
  ENTERPRISE_SKILL_LIST_LOADING,
  ENTERPRISE_SKILL_LIST_NO_MATCH,
  enterpriseSkillMeta,
  type EnterpriseSkillListPayload,
} from '../skill-market.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { enterpriseEscSubTabFilter, type EnterpriseEscSubTab } from './esc-sub-tabs.js'
import type { ResourceItem } from './esc-types.js'

/**
 * 这一维度的**完整说法**（「企业技能目录」）。
 *
 * ★它是 `esc-copy.ts` 那一格的**唯一再出口**（不在这里另写一份字面量）：本文件的页内说明句与
 *   工具栏那一枚标签的悬浮说明都引它 ⇒ "悬浮说明"与"页内说明"不可能各说各的。
 */
export const ENTERPRISE_CATALOG_SOURCE_TITLE = ENTERPRISE_ESC_LOCAL_COPY.catalogSourceTitle
/** 页内说明句：这一面在干什么、以及【＋】到底做了什么（"会下载、会落盘"必须说出来）。 */
export const ENTERPRISE_CATALOG_NOTE = '这里列出企业中心注册的技能包；安装会下载并校验后落盘到本机 DSH，无需重启。'
/**
 * 在途那一句（`role="status"`，整块内容区里那一行）。
 *
 * 与 `esc-third-party.ts` 那枚**刻意同词**（都是"正在安装"）：两处说的是同一件事，
 * 没有理由长出第二种说法；而它与**按钮上**那三个字（`INSTALLING`）也是同一个词根。
 */
export const ENTERPRISE_CATALOG_INSTALLING = '安装中…'
/** 加载态那一句：**复用**设置页那一枚（同一个目录、同一句话）。 */
export const ENTERPRISE_CATALOG_LOADING = ENTERPRISE_SKILL_LIST_LOADING
/** 失败提示的动作前缀：**复用**设置页那一枚（人话与下一步由 `error-messages.ts` 的唯一映射给）。 */
export const ENTERPRISE_CATALOG_FAILED_PREFIX = ENTERPRISE_SKILL_LIST_FAILED
/**
 * ★**两句不同的「为什么空」**（口径 53 明令：不许合成一句）。
 *
 * 它们回答两个不同的问题、下一步也不同：
 *   · `EMPTY`：**目录本身是空的**（企业还没发布任何对当前账号可见的技能包）——下一步是"找管理员发布"；
 *   · `NO_MATCH`：目录里有东西、是**这次搜索没命中**——下一步是"换个关键词"。
 * 两句都**直接复用**设置页那两格（同一个目录的同一件事，不许出现第二套措辞）。
 *
 * ★为什么这里不需要第三句（"选了某枚分类之后空了"）：二级 chip 是**由同一份响应投出来的**
 *   （`enterpriseCatalogSubChips` 只收真有条目的分类）⇒ 单凭选中一枚 chip **不可能**把列表清空，
 *   能清空它的只有关键词 ⇒ 上屏的那一句必然是真话。
 */
export const ENTERPRISE_CATALOG_EMPTY = ENTERPRISE_SKILL_LIST_EMPTY
export const ENTERPRISE_CATALOG_NO_MATCH = ENTERPRISE_SKILL_LIST_NO_MATCH
/**
 * 就绪态那枚**重新读取**钮（本机那两份真值都是**外部可变**的：管理员刚发布了新包、
 * 或在别处（设置页 / 应用商店）刚装了一枚，这一面必须能重取）。
 *
 * ★它与失败态那枚「重试」（`ENTERPRISE_LIST_RETRY`，四个列表共用）**刻意不同词**：
 *   一个说"再试一次那条失败的请求"，一个说"重新读一遍目录"。
 */
export const ENTERPRISE_CATALOG_REFRESH = '刷新'
export const ENTERPRISE_CATALOG_REFRESH_LABEL = '重新读取企业技能目录'
/** 【＋】可点时那三件（按钮文案 / 悬浮说明 / 无障碍名）。 */
export const ENTERPRISE_CATALOG_INSTALL = '安装'
export const ENTERPRISE_CATALOG_INSTALL_TITLE = '安装到本机 DSH（下载 + 校验 + 落盘，无需重启）'
/**
 * 写入口**整条缺席**时那枚按钮的可见原因（纯函数直调 / 本部署那半边没接线）。
 *
 * 判据是**端口在不在场**，不是写死的 `disabled`（本仓既有那几枚按钮同一条纪律）。
 */
export const ENTERPRISE_CATALOG_INSTALL_NOT_PORTED = '这台机器还没有接上企业技能的安装接口。'
/** 在途时**其余**每一枚【＋】的可见原因（它们会禁用，故必须各有一句可见说明）。 */
export const ENTERPRISE_CATALOG_BLOCKED_BY_BUSY = '另一枚技能正在安装，稍后再试。'
/** 安装失败提示的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射按稳定码给）。 */
export const ENTERPRISE_CATALOG_INSTALL_FAILED_PREFIX = '安装失败'

/* ══════════════ 卡片投影（唯一入口）══════════════ */

/**
 * 一条企业技能包 → 既有 `ResourceItem`（**唯一**会填 `packageId` / `meta` 的地方）。
 *
 * 三处刻意的取值：
 *   · `id` 恒带 `catalog-` 前缀（与列表/精选那几支的 `${前缀}-${原始 id}` 同一条约定，
 *     避免跨维度撞 React key）；而**回传宿主的那枚值**是 `packageId`（不带前缀、原样），
 *     这条区分是硬的：`id` 是本页的呈现键、`packageId` 是中心坐标，两者**不许互相冒充**；
 *   · `meta` 走 `enterpriseSkillMeta`（与设置页那一行**逐字同源**：来源 DSH 版本 · 大小 · 内含技能数）；
 *   · 图标/发布者/统计**一格都不填**：企业目录的响应里根本没有这三样东西，
 *     编一个空值出来只会让卡片画出一行"看起来该有却没有"的东西。
 */
export function enterpriseCatalogItem(skill: EnterpriseRuntimeSkill): ResourceItem {
  return {
    id: `catalog-${skill.id}`,
    packageId: skill.id,
    name: skill.displayName,
    description: skill.description,
    meta: enterpriseSkillMeta(skill),
    ...(skill.category === undefined ? {} : { category: skill.category }),
  }
}

/** 一批企业技能包 → 卡片（顺序保持响应原序，不重排）。 */
export function enterpriseCatalogItems(skills: readonly EnterpriseRuntimeSkill[]): readonly ResourceItem[] {
  return skills.map(enterpriseCatalogItem)
}

/**
 * 已装判定键：`GET /skills/installed` 那张真值里的 `packageId`（口径 53 的**硬判据**）。
 *
 * ★为什么是它而不是名字：`GET /skills` 的 `id` 与 `GET /skills/installed` 的 `packageId`
 *   是**同一个键**（企业中心雪花号），精确命中不需要任何猜测；而广场那批只能按 kebab 名对撞
 *   磁盘真值（那是两台独立发版列车之间的折中）。这一维度既然拿得到同一把钥匙，就不用折中。
 */
export function enterpriseCatalogInstalledPackages(
  installed: readonly EnterpriseInstalledSkill[],
): ReadonlySet<string> {
  return new Set(installed.map(each => each.packageId))
}

/* ══════════════ 二级 chip 行（数据驱动）══════════════ */

/**
 * ★**口径 53**：由**目录响应自己**的 `category` 投影出这一维度的二级 chip 行。
 *
 * 三条判据：
 *  ① **文案与 key 都取自响应**（`category` 原样）：界面**不消费后端目录那套静态分类树**
 *     （那是 NUWAX 平台 `POST /api/published/category/list` 的东西，与企业技能包的 `category`
 *     是两套毫不相干的取值域），也不写死任何清单——管理员加一个分类，这一行自动跟着变；
 *  ② **`category` 缺席 / 空串的条目不投 chip**：它们仍然**照旧铺在「全部」里**（一枚都不丢），
 *     只是不配拥有一枚自己的筛选项——"没有分类"不是一个分类；
 *  ③ 按**首次出现顺序**去重（响应原序），不排序：后端给什么顺序就什么顺序，界面不自作主张。
 *
 * @param skills - 一次目录取数的真响应（**未过滤**的那一份：chip 必须对得上整份目录）。
 * @returns chip 行数据（**不含**「全部」——那一枚由 `esc-sub-tabs.ts` 统一加，两处不可能漂）。
 */
export function enterpriseCatalogSubChips(skills: readonly EnterpriseRuntimeSkill[]): readonly EnterpriseEscSubTab[] {
  const seen = new Set<string>()
  const chips: EnterpriseEscSubTab[] = []
  for (const skill of skills) {
    const category = skill.category
    if (category === undefined || category.trim() === '' || seen.has(category)) continue
    seen.add(category)
    chips.push({ key: category, label: category })
  }
  return chips
}

/* ══════════════ 四态投影 ══════════════ */

/** 结果面的**唯一状态投影**（四态 → 页面该画什么；同一时刻只可能命中一档）。 */
export interface EnterpriseCatalogFace {
  readonly kind: 'loading' | 'failed' | 'empty' | 'ready'
  /** 失败态那枚稳定码（人话与下一步由唯一映射给）。 */
  readonly failedCode?: string | undefined
  /** 就绪态要铺的卡片（已按选中分类 + 关键词过滤；另三态恒空）。 */
  readonly items: readonly ResourceItem[]
  /** 空态那一句「为什么空」（两句不同的话由 `noMatch` 选，见那两枚常量的说明）。 */
  readonly emptyNote?: string | undefined
  /** 空态到底空在哪（`true` = 目录里有东西、这次搜索没命中；`false` = 目录本身就是空的）。 */
  readonly noMatch?: boolean | undefined
  /**
   * 已装 `packageId` 集合（**卡片据此在「更多 + 去试试」与【＋】之间分流**）。
   * ★它是 `packageId` 精确命中的结果——界面不许退回"按名字猜"。
   */
  readonly installed: ReadonlySet<string>
  /**
   * 本机已装清单**这次没读全**（`enterpriseDegradedRead` 交出来的稳定码）。
   *
   * ★次级取数允许降级，但**降级必须说出来**（界面据此出一句 `role="status"` + 重试）：
   *   静默吞掉会让员工把"读不到"读成"一枚都没装"，于是每张卡都画着【＋】。
   */
  readonly installedCode?: string | undefined
}

/** 关键词判据（与设置页那一行**同一套三个字段**：显示名 / 标识 / 描述；大小写不敏感）。 */
function matchesKeyword(skill: EnterpriseRuntimeSkill, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (needle === '') return true
  return skill.displayName.toLowerCase().includes(needle)
    || skill.skillId.toLowerCase().includes(needle)
    || skill.description.toLowerCase().includes(needle)
}

/** 四态 + 二级分类 + 关键词 → 结果面（纯函数，唯一判定点）。 */
export function enterpriseCatalogFace(input: {
  /** 目录取数的四态（`createEnterpriseSkillListSource` 的唯一状态机）。 */
  readonly state: EnterpriseListState<EnterpriseSkillListPayload>
  /** 搜索关键词（已防抖）。 */
  readonly keyword: string
  /** 选中的二级分类 key（空串 = 全部；必须是 `enterpriseEscSubTabs` 投影出来的那一枚）。 */
  readonly category: string
  /** 当前**有效**的已装真值（Host 回传的最新清单优先于取数源里那份；见 `esc-catalog-list.tsx`）。 */
  readonly installed: readonly EnterpriseInstalledSkill[]
}): EnterpriseCatalogFace {
  if (input.state.kind === 'loading') {
    return { kind: 'loading', items: [], installed: enterpriseCatalogInstalledPackages(input.installed) }
  }
  /**
   * ★**失败态绝不回落空列表**：`failed` 分支的 `items` 恒空、且**不带** `emptyNote`
   *   —— 目录读不到时画一句"还没有可见的技能"就是**撒谎**（与 `esc-third-party.ts` 同判）。
   * ★已装清单**照旧交出去**（它与目录是两条腿：目录失败不代表已装读不到），降级码原样带上。
   */
  if (input.state.kind === 'failed') {
    return {
      kind: 'failed',
      failedCode: input.state.code,
      items: [],
      installed: enterpriseCatalogInstalledPackages(input.installed),
    }
  }
  const value = input.state.value
  const installed = enterpriseCatalogInstalledPackages(input.installed)
  const scoped = enterpriseEscSubTabFilter(value.items, input.category, skill => skill.category ?? '')
  const matched = scoped.filter(skill => matchesKeyword(skill, input.keyword))
  if (matched.length > 0) {
    return {
      kind: 'ready',
      items: enterpriseCatalogItems(matched),
      installed,
      ...(value.installedCode === undefined ? {} : { installedCode: value.installedCode }),
    }
  }
  const noMatch = value.items.length > 0
  return {
    kind: 'empty',
    items: [],
    installed,
    noMatch,
    emptyNote: noMatch ? ENTERPRISE_CATALOG_NO_MATCH : ENTERPRISE_CATALOG_EMPTY,
    ...(value.installedCode === undefined ? {} : { installedCode: value.installedCode }),
  }
}

/* ══════════════ 【＋】的按钮终态 ══════════════ */

/** 那一枚【＋】当前处在哪一档（四档互斥，各有自己的可见文案）。 */
export type EnterpriseCatalogActionKind =
  /** 这一枚正在装（按钮文案变「安装中…」、禁用）。 */
  | 'this-busy'
  /** 别的枚正在装（按钮禁用 + **行上可见原因**，不是只挂 title）。 */
  | 'blocked'
  /** 这一次真的可以点。 */
  | 'install'
  /** 写入口整条缺席（本部署还没接上这条接口）；按钮禁用 + 可见原因。 */
  | 'not-ported'

/** 一枚【＋】的**终态**（渲染层唯一的输入：文案 / 能不能点 / 为什么不能点 / 悬浮说明 / 无障碍名）。 */
export interface EnterpriseCatalogActionPlan {
  readonly kind: EnterpriseCatalogActionKind
  /** 按钮上不一定看得见的文案（圆形图标钮）——但它就是读屏与悬浮说明念出来的那一句。 */
  readonly text: string
  readonly disabled: boolean
  /** 禁用时的**可见原因**（可点、以及在途那一档时缺席 —— 在途时按钮自己已经写着「安装中…」）。 */
  readonly reason?: string | undefined
  /** 悬浮说明（可用时说会发生什么；不可用时与 `reason` 同源）。 */
  readonly title: string
  /** 无障碍名（读屏听到的是「安装 X」/「安装中…」）。 */
  readonly ariaLabel: string
}

/**
 * 一枚【＋】的终态（唯一判定点）。
 *
 * 判据只有三件事实：**这一枚是不是在途那一枚**、**有没有别的枚在途**、**端口在不在场**。
 * 优先级刻意定成"在途 > 其余在途 > 端口"：正在装的那一枚才是当下最要紧的事实，
 * 它的说明必须说"正在安装"，而不是被一句"另一枚正在安装"顶掉（那会让员工找不到自己的那一条）。
 *
 * ★**已装那一档不在这里**：装好的卡片**根本不画【＋】**（改画「更多 + 去试试」），
 *   故"已装"不是一个按钮终态、而是一条渲染分流（判据是 `installed.has(packageId)`）。
 *
 * @param input - 端口在不在场、这一枚的包 id 与名字、在途的那一枚。
 * @returns 按钮终态（文案 + 可点性 + 可见原因 + 悬浮说明 + 无障碍名）。
 */
export function enterpriseCatalogActionPlan(input: {
  readonly wired: boolean
  readonly packageId: string
  readonly name: string
  readonly busy?: string | undefined
}): EnterpriseCatalogActionPlan {
  if (input.busy !== undefined && input.busy === input.packageId) {
    return {
      kind: 'this-busy',
      text: ENTERPRISE_CATALOG_INSTALLING,
      disabled: true,
      title: ENTERPRISE_CATALOG_INSTALLING,
      ariaLabel: ENTERPRISE_CATALOG_INSTALLING,
    }
  }
  if (input.busy !== undefined) {
    return {
      kind: 'blocked',
      text: ENTERPRISE_CATALOG_INSTALL,
      disabled: true,
      reason: ENTERPRISE_CATALOG_BLOCKED_BY_BUSY,
      title: ENTERPRISE_CATALOG_BLOCKED_BY_BUSY,
      ariaLabel: `${ENTERPRISE_CATALOG_INSTALL}${input.name}`,
    }
  }
  if (!input.wired) {
    return {
      kind: 'not-ported',
      text: ENTERPRISE_CATALOG_INSTALL,
      disabled: true,
      reason: ENTERPRISE_CATALOG_INSTALL_NOT_PORTED,
      title: ENTERPRISE_CATALOG_INSTALL_NOT_PORTED,
      ariaLabel: `${ENTERPRISE_CATALOG_INSTALL}${input.name}`,
    }
  }
  return {
    kind: 'install',
    text: ENTERPRISE_CATALOG_INSTALL,
    disabled: false,
    title: ENTERPRISE_CATALOG_INSTALL_TITLE,
    ariaLabel: `${ENTERPRISE_CATALOG_INSTALL}${input.name}`,
  }
}

/** 正在安装某一枚那行 `role="status"` 里那一整句（说清正在装谁）。 */
export function enterpriseCatalogInstallingText(name: string): string {
  return `正在${ENTERPRISE_CATALOG_INSTALL}「${name}」…`
}

/** 装好一枚那行 `role="status"` 里那一整句（说清刚刚装了谁）。 */
export function enterpriseCatalogInstalledText(name: string): string {
  return `已${ENTERPRISE_CATALOG_INSTALL}「${name}」。`
}
