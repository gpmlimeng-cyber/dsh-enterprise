/**
 * [INPUT]: 只依赖 `list-state` 的四态类型与 `skill-api-decode` 的盘点投影类型（不依赖 React、不依赖任何宿主 API）
 * [OUTPUT]: 对外提供「添加技能 → 系统搜索」这一面（本机技能根盘点 → 纳入）的**纯事实层**：结果面的全部文案
 *   （标题 / 说明 / 返回 / 加载 / 两种空话 / 三态中文 / 纳入动作与它四条可见反馈）、唯一状态投影
 *   `enterpriseSystemFace`（四态 → loading / failed / ready + 「零候选」那句整体空话）、按根分组的
 *   `enterpriseSystemRootGroups`、单条候选的行投影 `enterpriseSystemSkillRow`（标题 / 描述 / 状态中文 /
 *   目录名与原因合成的那一句 note / 可纳入性）、根人话标签 `enterpriseSystemRootLabel` 与计数文案；
 *   **本刀（复审整改）**再加：每节的**无障碍名** `sectionLabel`（与页名逐字相同时换中性词
 *   `ENTERPRISE_SYSTEM_SECTION_LABEL`）与**可见节头** `headLabel`（会与页名重复时整键缺席，本刀修掉
 *   真机上「本机技能目录」上下各一遍的重复）、就绪态那枚 `ENTERPRISE_SYSTEM_REFRESH{,_LABEL}`，
 *   并把「已装」那行的可见原因收敛成 `ENTERPRISE_SYSTEM_REGISTERED_NOTE`（不再与状态词同义反复）
 * [POS]: dsh-ui 系统搜索那一面的**唯一判定与文案真源**（页面只画、控制器只接线）；真源是本刀冻结契约
 *   （`GET /skills/system-search` 的三态 + `POST /skills/adopt`）与口径 15（**详情是子页面、不是弹窗**）。
 *   ★ 它与 `local-api*.ts` 的分工：那边只管「同源固定路径发什么、收什么、怎么严格解码」，
 *   这边只管「收回来之后说什么、哪几条能点、为什么不能点」——本文件里没有一次 fetch、没有一处 React。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseListState } from './list-state.js'
import type {
  EnterpriseSystemRoot,
  EnterpriseSystemSkill,
  EnterpriseSystemSkillState,
  EnterpriseSystemSkills,
} from './skill-api-decode.js'

/** 结果面标题（与技能/配方详情子页面同一形态：面包屑 + 标题 + 说明）。 */
export const ENTERPRISE_SYSTEM_TITLE = '本机技能目录'
/** 标题下一句人话：这一面在干什么（不是技术说明，是「你能在这里做什么」）。 */
export const ENTERPRISE_SYSTEM_NOTE = '这里列出本机已有的技能目录；还没登记的，可以纳入进来一起用。'
/** 面包屑（可见文案）与它的完整无障碍名（与技能详情的「返回技能列表」同一形制）。 */
export const ENTERPRISE_SYSTEM_BACK_TEXT = '返回技能列表'
export const ENTERPRISE_SYSTEM_BACK_LABEL = '返回技能列表'
/** 在途那一句（`role="status"`）。 */
export const ENTERPRISE_SYSTEM_LOADING = '正在查找本机的技能目录…'
/** 零候选时那一句**整体**空话（与两种「按根」的空话分工见下面 `enterpriseSystemFace` 的注释）。 */
export const ENTERPRISE_SYSTEM_EMPTY = '本机没有找到可以纳入的技能目录。'
/** 根不存在（`present: false`）时那一句：**不是错误**，是这个位置本来就没有目录。 */
export const ENTERPRISE_SYSTEM_ROOT_ABSENT = '这个位置还没有技能目录。'
/** 根在、但一个候选都没有时那一句：与上面那句**刻意不同**（一个是位置不存在、一个是位置里没东西）。 */
export const ENTERPRISE_SYSTEM_ROOT_EMPTY = '这个位置里没有找到技能目录。'
/** 唯一那枚本机技能根（官方 `user-dsh` 根）的人话标签；其它（注入的）根直接用它的 id。 */
export const ENTERPRISE_SYSTEM_PRIMARY_ROOT_ID = 'user-dsh'
export const ENTERPRISE_SYSTEM_PRIMARY_ROOT_LABEL = '本机技能目录'
/**
 * 这一节在**根的标签与页名逐字相同**时改用的名字（本刀修的重复）。
 *
 * ★ 真机现象：只有一个本机根时，页标题、节标题、节的无障碍名是同一个词「本机技能目录」，
 *   屏幕上上下各读一遍、读屏还要再多报一遍（外层 `role="region"` 也叫这个）。节的无障碍名换成
 *   这枚中性词之后，两个 landmark 的名字不再相同；可见的节头则由 `headLabel` 缺席整枚不画。
 */
export const ENTERPRISE_SYSTEM_SECTION_LABEL = '技能目录'
/** 就绪态那枚**重新盘点**钮（本机技能目录是外部可变的：别的地方刚建好一个目录，这里要能重取）。 */
export const ENTERPRISE_SYSTEM_REFRESH = '重新盘点'
export const ENTERPRISE_SYSTEM_REFRESH_LABEL = '重新盘点本机技能目录'
/** 三态的中文（唯一映射：Host 的三态字面 → 员工可读的词，别处不许再翻一遍）。 */
export const ENTERPRISE_SYSTEM_STATE_REGISTERED = '已装'
export const ENTERPRISE_SYSTEM_STATE_CONFLICT = '命名冲突'
export const ENTERPRISE_SYSTEM_STATE_AVAILABLE = '可纳入'
/** 后两态**不画按钮**，故必须各自带一句可见原因（产品宪法：禁用即须有可见说明）。 */
// ★ 本刀去掉「这个目录已经在本机装好了」那半句：行上那句是「状态词：原因」的形制，状态词已经是
//   「已装」，再说一遍「已经装好了」就是同义反复（真机上读起来是「已装：这个目录已经在本机装好了」）。
export const ENTERPRISE_SYSTEM_REGISTERED_NOTE = '不用再纳入。'
export const ENTERPRISE_SYSTEM_CONFLICT_NOTE = '同名目录已被别的技能占用，不能纳入。'
/** 行上那一句里「目录名」的标签（只在标题不是目录名时才出现，见行投影）。 */
export const ENTERPRISE_SYSTEM_DIRECTORY_PREFIX = '目录名：'
/** 纳入动作的三段可见文案：可点 / 在途 / 成功。 */
export const ENTERPRISE_SYSTEM_ADOPT = '纳入'
export const ENTERPRISE_SYSTEM_ADOPTING = '正在纳入…'
/** 失败提示的动作前缀（人话与下一步仍由 `error-messages.ts` 的唯一映射给）。 */
export const ENTERPRISE_SYSTEM_ADOPT_FAILED_PREFIX = '纳入失败'
/** 「完成前不能纳入别的目录」这句是**所有**被禁用的纳入按钮的可见原因（写在进行中那一行里）。 */
export const ENTERPRISE_SYSTEM_ADOPT_BUSY_SUFFIX = '完成前不能纳入别的目录。'

/** 计入中那一行（`role="status"`）：说清正在纳入谁 + 为什么别的按钮这会儿不能点。 */
export function enterpriseSystemAdoptingText(name: string): string {
  return `正在${ENTERPRISE_SYSTEM_ADOPT}「${name}」…${ENTERPRISE_SYSTEM_ADOPT_BUSY_SUFFIX}`
}

/** 纳入成功那一行（`role="status"`）：说清刚刚纳入了谁。 */
export function enterpriseSystemAdoptedText(name: string): string {
  return `已${ENTERPRISE_SYSTEM_ADOPT}「${name}」。`
}

/** 一个根的人话标签：唯一那枚本机根给人话，其余（注入的）根用 id 原样（不编名字）。 */
export function enterpriseSystemRootLabel(root: EnterpriseSystemRoot): string {
  return root.id === ENTERPRISE_SYSTEM_PRIMARY_ROOT_ID ? ENTERPRISE_SYSTEM_PRIMARY_ROOT_LABEL : root.id
}

/** 一个根下的候选计数（0 说「没有技能目录」，不说「0 个」）。 */
export function enterpriseSystemCountText(count: number): string {
  return count === 0 ? '没有技能目录' : `${count} 个技能目录`
}

/** 一条候选在结果面上的**全部呈现事实**（唯一投影：界面不许再自己拼标题或状态词）。 */
export interface EnterpriseSystemSkillRow {
  /** canonical 绝对路径（纳入时原样回传给 Host 的那个不透明值）。 */
  readonly path: string
  /** 目录名（Host 侧用它拼落点，故它必须原样带着）。 */
  readonly name: string
  /** 标题：有 frontmatter 技能名就用它，缺席回退目录名（与卡片标题同一口径）。 */
  readonly title: string
  /** 描述：frontmatter 读不到就**没有这一行**（不是空串、不是占位句）。 */
  readonly description?: string | undefined
  readonly state: EnterpriseSystemSkillState
  /** 三态中文。 */
  readonly stateLabel: string
  /** 状态为非可纳入时的**可见原因**（可纳入时缺席）。 */
  readonly stateNote?: string | undefined
  /** 行上那一句可见 note（恒有）：只在标题不是目录名时带「目录名：X · 」，后面接状态与原因。 */
  readonly note: string
  /** 能不能点那枚【纳入】（只有 `available` 为真；另两态**不画**按钮）。 */
  readonly adoptable: boolean
}

/**
 * 一条候选 → 行投影（唯一判定点）。
 *
 * ★ 为什么「已装 / 命名冲突」**不画按钮**而不是画一枚禁用的：这两种状态下**没有任何**能做的动作
 *   （可做的是「别的目录」，不是这一条），画一枚灰按钮等于给一个不存在的动作留位置。故按既有口径
 *   「能走的路才画」，并在行上写清**为什么这条没有动作**。
 */
export function enterpriseSystemSkillRow(skill: EnterpriseSystemSkill): EnterpriseSystemSkillRow {
  const title = skill.displayName === undefined ? skill.name : skill.displayName
  const stateLabel = skill.state === 'registered'
    ? ENTERPRISE_SYSTEM_STATE_REGISTERED
    : skill.state === 'conflict'
      ? ENTERPRISE_SYSTEM_STATE_CONFLICT
      : ENTERPRISE_SYSTEM_STATE_AVAILABLE
  const stateNote = skill.state === 'registered'
    ? ENTERPRISE_SYSTEM_REGISTERED_NOTE
    : skill.state === 'conflict'
      ? ENTERPRISE_SYSTEM_CONFLICT_NOTE
      : undefined
  // 标题就是目录名时不再重复一遍（「目录名：x」只补在用了 frontmatter 名的情形）。
  const directory = title === skill.name ? '' : `${ENTERPRISE_SYSTEM_DIRECTORY_PREFIX}${skill.name} · `
  const note = `${directory}${stateLabel}${stateNote === undefined ? '' : `：${stateNote}`}`
  return {
    path: skill.path,
    name: skill.name,
    title,
    ...(skill.description === undefined ? {} : { description: skill.description }),
    state: skill.state,
    stateLabel,
    ...(stateNote === undefined ? {} : { stateNote }),
    note,
    adoptable: skill.state === 'available',
  }
}

/** 结果面上的一个根分组（根 + 它的候选 + 该根为空时那句人话）。 */
export interface EnterpriseSystemRootGroup {
  readonly root: EnterpriseSystemRoot
  readonly label: string
  /** 这一节的无障碍名（与页名逐字相同时换成中性词 `ENTERPRISE_SYSTEM_SECTION_LABEL`）。 */
  readonly sectionLabel: string
  /** 节头那枚**可见**标签；与页名逐字相同时**整键缺席**（画了就是把页名再说一遍）。 */
  readonly headLabel?: string | undefined
  /** 这个根下的候选（保持 Host 给的顺序，不重排）。 */
  readonly skills: readonly EnterpriseSystemSkill[]
  /** 这个根没有候选时那句人话（区分「位置不存在」与「位置里没东西」）。 */
  readonly emptyNote?: string | undefined
}

/**
 * 按根分组（顺序 = Host 给的根顺序；每组内保持候选原序）。
 *
 * 解码层已保证「每条候选的 `rootId` 必在 `roots` 里」，故这里不存在「无家可归的候选」这种分支
 *（真出现即协议畸形，在解码层就整条失败了，界面不会拿到）。
 *
 * ★ **本刀修的真机重复**：只有一个本机根时，根标签 === 页名（`ENTERPRISE_SYSTEM_TITLE`），原先
 *   页标题 / 节标题 / 节的无障碍名三处是同一个词。判据只有一个——**这一节的标签会不会与页名逐字重复**：
 *   会重复 ⇒ 不画那枚可见节头（页标题已经说了这是哪里），并给节换一枚不重复的无障碍名。多根时每个根
 *   的标签互不相同、也不再与页名重复的那一枚以外照旧出节头（读者要能分清哪一组是哪个位置）。
 */
export function enterpriseSystemRootGroups(value: EnterpriseSystemSkills): readonly EnterpriseSystemRootGroup[] {
  return value.roots.map((root) => {
    const skills = value.skills.filter(skill => skill.rootId === root.id)
    const label = enterpriseSystemRootLabel(root)
    const repeatsPageTitle = label === ENTERPRISE_SYSTEM_TITLE
    return {
      root,
      label,
      sectionLabel: repeatsPageTitle ? ENTERPRISE_SYSTEM_SECTION_LABEL : label,
      ...(repeatsPageTitle ? {} : { headLabel: label }),
      skills,
      ...(skills.length === 0
        ? { emptyNote: root.present ? ENTERPRISE_SYSTEM_ROOT_EMPTY : ENTERPRISE_SYSTEM_ROOT_ABSENT }
        : {}),
    }
  })
}

/** 结果面的**唯一状态投影**（四态 → 页面该画什么）。 */
export interface EnterpriseSystemFace {
  readonly kind: 'loading' | 'failed' | 'ready'
  /** 失败态那枚稳定码（人话与下一步由唯一映射给）。 */
  readonly failedCode?: string | undefined
  /** 按根分组（loading 时为空数组——那会儿还没有任何真值）。 */
  readonly groups: readonly EnterpriseSystemRootGroup[]
  /** 零候选时那一句**整体**人话（有候选时缺席）——与每组那句「按根」的空话分工不同、两句都要有。 */
  readonly emptyNote?: string | undefined
}

/**
 * 四态 → 结果面（纯函数，唯一判定点）。
 *
 * ★ 两种空话**都必须给**，它们回答的是两个不同的问题：
 *   · 每组那句（`group.emptyNote`）说「**这个位置**怎么了」（位置不存在 / 位置里没东西）；
 *   · 整体那句（`emptyNote`）说「**整台机器**上一条可纳入的都没有」。
 *   只有其中一句时，用户要么不知道是哪个位置空、要么以为只是这一组空——两个都要。
 *
 * @param state - 盘点取数的四态（`list-state` 的唯一状态机）。
 * @returns 页面所需的全部事实（loading / failed+码 / ready+分组+可选整体空话）。
 */
export function enterpriseSystemFace(state: EnterpriseListState<EnterpriseSystemSkills>): EnterpriseSystemFace {
  if (state.kind === 'loading') return { kind: 'loading', groups: [] }
  if (state.kind === 'failed') return { kind: 'failed', failedCode: state.code, groups: [] }
  const groups = enterpriseSystemRootGroups(state.value)
  // `empty` 与 `ready` 的差别只有一句话：零候选时补上那句整体空话（取值一律照 Host 的真值铺）。
  return state.kind === 'empty'
    ? { kind: 'ready', groups, emptyNote: ENTERPRISE_SYSTEM_EMPTY }
    : { kind: 'ready', groups }
}
