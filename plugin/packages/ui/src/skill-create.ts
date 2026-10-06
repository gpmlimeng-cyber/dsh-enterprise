/**
 * [INPUT]: 只依赖常量（不依赖 React、不依赖任何宿主 API、不发网络、不碰剪贴板）
 * [OUTPUT]: 对外提供「添加技能 → 通过 Agent 创建」这一条通路的**纯事实层**：那份交给助手的草稿
 *   `buildSkillCreateDraft()`、它在界面上的三段文案（打开成功 / 复制走 / 复制那枚按钮的可见文案与无障碍名）、
 *   状态机 `EnterpriseSkillCreateState` 与唯一人话投影 `enterpriseSkillCreateNotice`，以及两枚**本机动作**码
 *   （`ENTERPRISE_SKILL_CREATE_{LAUNCH,COPY}_FAILED_CODE`）
 * [POS]: dsh-ui「通过 Agent 创建」那一项的**唯一判定与文案真源**（页面只画、控制器只接线）；它刻意只做一件事——
 *   把「怎么让助手在本机造出一份能被加载的技能」如实写成一段人话。★它**不**承诺任何具体技能存在
 *   （`skill-creator` 那半句是条件句：本机实测没装），只把官方 watcher 的**硬门**讲清楚
 *   （`SKILL.md` 的 frontmatter 必须有 `name` 与 `description`，见 `dsh-skill-filesystem/lib/index.js:679`/`:685`）。
 *   与它咬合的两条通路：① 助手把技能写进 `~/.dsh/skills/<name>/` 之后，「系统搜索」会把它列成 `available`，
 *   用户再点【纳入】即可登记（`system-search.ts`）；② 也可以直接选一份 `.dshskill` 用「本地导入」装（`skill-import.ts`）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 官方本机技能根的写法（与「本机技能目录/系统搜索结果」里显示的那一枚是同一处落点）。 */
export const ENTERPRISE_SKILL_CREATE_DRAFT_ROOT = '~/.dsh/skills/<技能名>/'
/** 官方要求的那份技能正文文件名（frontmatter 就在这里）。 */
export const ENTERPRISE_SKILL_CREATE_DRAFT_FILE = 'SKILL.md'

/**
 * **交给助手的那一段草稿**（纯函数：同样的调用永远得到同一段字，便于用例逐条取证与逐字复核）。
 *
 * 四件事按顺序说清（与冻结契约一对一）：
 *  ① 目标——在本机创建一份可被加载的 DSH 技能；
 *  ② 落点——`~/.dsh/skills/<技能名>/SKILL.md`（官方 `user-dsh` 根，也是「系统搜索」扫的那一处）；
 *  ③ **硬门**——`SKILL.md` 开头的说明区（frontmatter）里 `name`（全小写连字符、与目录名一致）与
 *     `description` 缺一不可（官方 watcher 判的就是这两项，缺了这份技能不会被加载）；
 *  ④ `skill-creator` 那句**只能是条件句**——本机实测**没装**它，写成「优先用它」就是承诺一个不存在的东西；
 *     故这里是「**如果已经装了**…就优先用它；没装就按上面的要求写文件」。
 * 末尾再补一句「写完之后怎么走」（纳入口在哪儿），让用户知道下一步——这正是本仓「可执行的下一步」那条口径。
 *
 * ★ 为什么把 draft 写进代码而不是让模型现场发挥：它是一段**会被用户直接发出去**的文字（进官方输入框或剪贴板），
 *   故必须可审、可测、逐字稳定；用户按发送之前看到的就是这一份（本文件是唯一真源）。
 */
export function buildSkillCreateDraft(): string {
  return [
    '请在本机创建一份 DeepSeek Harness 技能，让我以后能直接调用它。',
    '',
    `落点：技能目录建在 ${ENTERPRISE_SKILL_CREATE_DRAFT_ROOT} 下，技能正文写在该目录里的 ${ENTERPRISE_SKILL_CREATE_DRAFT_FILE}。`,
    '技能名用全小写连字符写法（kebab-case，例如 code-review），目录名与它保持一致。',
    '',
    `${ENTERPRISE_SKILL_CREATE_DRAFT_FILE} 开头要有一段说明区（frontmatter），下面两项缺一不可，缺了这份技能不会被加载：`,
    '  name: 技能名，全小写连字符写法，与本技能目录名一致',
    '  description: 一句话说清「什么时候该用这个技能」',
    '',
    '如果本机已经装了 skill-creator 技能，就优先用它来创建；没有装的话，直接按上面的要求写文件即可。',
    '',
    '写完告诉我技能名与它的落点，我随后会把这份技能纳入进来。',
  ].join('\n')
}

/** 失败态那枚按钮的可见文案（它的动作就是**把这句刚发出去的草稿复制走**）。 */
export const ENTERPRISE_SKILL_CREATE_COPY = '复制这句指令'
/** 上面那枚按钮的完整无障碍名（可见文案在按钮上，读屏要听到完整动作与去处）。 */
export const ENTERPRISE_SKILL_CREATE_COPY_LABEL = '复制这句指令，粘贴给助手即可'
/**
 * 打开成功那句（`role="status"`）：说清**已经发生**了什么 + 用户只需要做什么。
 *
 * ★ 它**可能来不及播报**（官方会把主视图切到新会话、本页可能随之被卸载）。按 Lead 裁决**维持现状**：
 * 不改成「先提示再切」——真反馈（新会话 + 输入框里的草稿）优先于我们这句话，且页面没被卸载的路径它仍是对的。
 * 完整三条理由见 `marketplace-entry.tsx` 里 `onCreateWithAgent` 成功那一支的注释（唯一权威处）。
 */
export const ENTERPRISE_SKILL_CREATE_OPENED = '已经为你打开一个新会话，并把指令填进了输入框——按发送即可。'
/** 复制成功那句（`role="status"`）：接在失败之后，说清下一步。 */
export const ENTERPRISE_SKILL_CREATE_COPIED = '已复制这句指令，粘贴给助手即可。'

/**
 * **本机动作**码（不是 Host 路由码：它们只可能由本机这一侧产生）。
 *
 * 两枚分开而不是共用一枚：它们的**下一步不是同一件事**——开新会话失败要「把这句指令复制走」，
 * 复制失败要「检查剪贴板权限后重试/再点一次那一项」。同一个码给两句不同的话会逼出第二张码表，
 * 故宁可两枚码、各一句（与 `ENT_PRESET_LAUNCH_FAILED` 同族的做法）。
 * 命名刻意**不带** preset：这两枚只属于「通过 Agent 创建」这一条通路，出现在技术信息里时不该指向别的功能。
 */
export const ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE = 'ENT_SKILL_CREATE_LAUNCH_FAILED'
export const ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE = 'ENT_SKILL_CREATE_COPY_FAILED'

/**
 * 「通过 Agent 创建」的可见反馈状态（三态，**没有 idle 成员**：`undefined` 就是没有反馈）。
 *
 * ★ 失败态**带上那一段刚发出去的草稿**：复制按钮复制的必须是**同一段字**，故把它放进状态里
 *   （而不是让渲染层再调一次构造器、也不是另存一个 ref）——「复制的内容 === 发出去的内容」由此是结构性的，
 *   不靠人记得同步两处。
 */
export type EnterpriseSkillCreateState =
  /** 已经打开一个新会话、并把指令交给了官方输入框（**未发送**，用户按发送即可）。 */
  | { readonly kind: 'opened' }
  /** 没成：开新会话失败 / 复制失败，各带自己那枚稳定码与（复制用的）那一段草稿。 */
  | { readonly kind: 'failed'; readonly code: string; readonly draft: string }
  /** 草稿已经复制走（失败之后的落点：粘贴给助手就能继续）。 */
  | { readonly kind: 'copied' }

/**
 * 状态机 → 界面反馈的**唯一投影**（纯函数）。
 *
 * 两种形态：`status` 是一句 `role="status"` 人话；`failed` **一个字都不说人话**，只交出那枚稳定码
 * （人话与下一步由 `error-messages.ts` 的唯一映射给）——失败文案因此永远不会在本文件里长出第二份。
 *
 * @param state - 当前反馈状态。
 * @returns `{kind:'status', text}` 或 `{kind:'failed', code}`。
 */
export type EnterpriseSkillCreateNotice =
  | { readonly kind: 'status'; readonly text: string }
  | { readonly kind: 'failed'; readonly code: string }

export function enterpriseSkillCreateNotice(state: EnterpriseSkillCreateState): EnterpriseSkillCreateNotice {
  if (state.kind === 'opened') return { kind: 'status', text: ENTERPRISE_SKILL_CREATE_OPENED }
  if (state.kind === 'copied') return { kind: 'status', text: ENTERPRISE_SKILL_CREATE_COPIED }
  return { kind: 'failed', code: state.code }
}
