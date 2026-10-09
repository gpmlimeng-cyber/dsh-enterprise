/**
 * [INPUT]: 只依赖 `esc-copy.ts` 的 `ENTERPRISE_ESC_COPY.tryNow`（按钮上那三个字的**唯一真源**）；
 *   不依赖 React、不依赖官方原语、不发请求、不认识任何路由 / 官方服务 / 平台 DTO
 * [OUTPUT]: 对外提供技能卡「去试试」的**唯一事实层**——唯一草稿文案构造器 `enterpriseEscSkillTryDraft(name)`、
 *   唯一可用性投影 `enterpriseEscSkillTryPlan(input)`、计划形状 `EnterpriseEscSkillTryPlan`，以及三句禁用原因、
 *   一句在途交代、一句成功交代、失败前缀与名字形状上限；
 *   ★**本刀（技能页性能）**再加**唯一一张按名取的计划表** `enterpriseEscSkillTryTable(input)`——
 *   它是 `enterpriseEscSkillTryPlan` 在全 `src` 里的**唯一调用点**，也是"渲染时按名取**同一个对象**"的落点
 * [POS]: dsh-ui 技能卡那一枚「去试试」的**唯一判定与文案真源**：卡片只画、页面层只接线。
 *
 *   ★**它是什么**：把「这枚技能」变成一句**可读的**指令，交给官方那条「新建会话 + 写入输入框（**不发送**）」
 *     的链路。那条链路在本仓**只有一处实现**（`preset-launch.ts`，经 `EnterpriseEscSkillPort.fillSkillTryDraft`
 *     注入）——本文件**不碰官方服务、不 import 任何 `@deepseek-ai/*`、也不自己造会话**（会话只能由官方
 *     `openWorkspace` 建）。故这里只做两件纯事：拼那句话、判这枚按钮能不能点。
 *
 *   ★**为什么技能名必须与「已装/未装」判据同一把键**：卡片是在**这一枚 `item.name`** 上分流
 *     「更多 + 去试试」的（`esc-aggregation.tsx` 的 `installedIds` 收的就是官方发现面的 kebab 名），
 *     而草稿里写的正是**同一个名字**。两处若各取一把键（比如这里改用 `packageId` / `skillId`），
 *     员工就会在"这枚看着已装"的卡上拿到一句指向**别的**技能的指令——那是本仓最不能接受的一类谎。
 *
 *   ★**fail-closed（空名 / 非法名 ⇒ 不给文案）**：名字空、纯空白、或带路径分隔 / 空白 / 协议 / 引号
 *     一类字符 ⇒ `enterpriseEscSkillTryDraft` 返回 `undefined` ⇒ 计划**禁用 + 行上可见原因**
 *     （`.esc-card-lock` + `role="status"`，与未装那一档**同一条落点**）。绝不拿一枚可疑字符串去拼指令，
 *     也绝不画一枚点了没反应的按钮（产品宪法：禁用控件不许只挂一句 `title`）。
 *
 *   ★**零编造**：草稿里**只有技能名**（卡片自己的数据）——没有路径、没有 URL、没有内部键名
 *     （`packageId` / `targetId` / `skillId` / 宿主路由一个都不出现）。那是**一句给 Agent 读的话**，
 *     不是一份内部坐标；门禁逐字锁这一点。
 *
 *   ★**本刀（技能页性能：「不再白算」那一半）**：计划**不再在渲染里逐卡现造**，改由
 *     `enterpriseEscSkillTryTable(input)` 出**一张按名取的表**（`useMemo` 在页面层建一次）——
 *     三处调用点（广场网格 / 精选行 / 企业技能目录）都改成"按名取"。
 *     理由只有一个、且是可验证的：`EnterpriseEscCard` 是 `memo` 包的，memo 的判据是 props **逐键浅相等**
 *     ⇒ 计划若不是同一枚对象，几百张卡在**任何一次**状态变化（切分类 / 搜索 / 装 / 卸 / 数据刷新）里
 *     都会被判成"props 变了"而整树重画——那正是真机上"技能页很卡、hover 也卡"的机制。
 *     ★**表要的是"参考同一个对象"，不是"少算一次"**：一帧里省下的那点算术不是重点，
 *     重点是那张卡**能不能被跳过**（`tests/esc-plan-reference.spec.ts` 用两次"渲染"逐键比对锁这一点）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ENTERPRISE_ESC_COPY } from './esc-copy.js'
import { enterpriseEscPlanTable } from './esc-plan-table.js'

/**
 * 技能名的**可接受形状**（唯一判据）。
 *
 * 只收 ASCII 字母数字与 `-` / `_` / `.` **单**分隔（`dev-engineer-toolkit`、`code-review` 这类真名在内）；
 * 两端必须是字母数字、分隔符不得连续、不得连续出现 ⇒ `..` / `--` / 前导点这类**看着像路径**的形状天然出局。
 * 刻意**不收**：空白、`/` `\` `:` `?` `#` `=`、引号、尖括号、非 ASCII —— 它们要么是路径 / URL 的组成部分，
 * 要么会把那句指令里的引号结构撑破（`「…」` 中间再塞一枚引号，读起来就不再是"一枚技能名"）。
 *
 * ★口径：官方 kebab 名（`name`（kebab-case））远窄于这条；这里放宽到 `[A-Za-z0-9._-]` 是为了**不误伤**
 *   平台上那批历史名字（大小写、点号），同时仍把一切"像坐标"的东西挡在门外——宁可少给一句草稿
 *   （禁用 + 写明原因），也不把内部坐标写进给 Agent 读的句子里。
 */
const ENTERPRISE_ESC_SKILL_TRY_NAME_SHAPE = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/

/** 技能名长度上限：超过它就不是一枚技能名，而是一段别的东西（宁可禁用 + 写明原因）。 */
export const ENTERPRISE_ESC_SKILL_TRY_NAME_MAX = 64

/* ────────────────────────── 一、可见文案（唯一一份） ────────────────────────── */

/**
 * 禁用原因①：**这枚技能还没装到本机**。
 *
 * 卡片只在 `installed === true` 那一支画「去试试」，故这一档在生产路径上画不出来；它仍必须**有话说**：
 * 计划是纯投影、可被任何调用方按任意 `installed` 直调，缺一句话就等于留了一个"禁用但不说为什么"的口子。
 */
export const ENTERPRISE_ESC_SKILL_TRY_NOT_INSTALLED = '这枚技能还没装到本机，先装上再试'
/**
 * 禁用原因②：**这枚技能的名字读不出来**（空 / 非法——见上面那条形状判据）。
 *
 * 措辞刻意不提"格式非法"这种技术说法：员工能做的是换一枚技能，而不是去改名字。
 */
export const ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT = '这枚技能的名字不可用，写不出要交给助手的指令'
/**
 * 禁用原因③：**本机还没接上那条官方链路**（`fillSkillTryDraft` 端口缺席：官方 `uiWorkspace` /
 * `conversation` 那几个结构面缺一环）。
 *
 * 与 `actionNotPorted` 分开：那一句是"整条动作本刀没移植"，这一句是"移植了、但这台机器这次没有那件服务"
 * ——补救动作不同（前者等版本，后者看官方服务挂没挂上），两件事共用一个字符串就会在可用那天说鬼话。
 */
export const ENTERPRISE_ESC_SKILL_TRY_NOT_WIRED = '本机还没有接上「打开新会话」这条通路'
/**
 * 在途那句（`role="status"`，按既有 `.esc-card-lock` 落点**行上可见**）。
 *
 * ★为什么在途也要上屏：这是一次**异步动作**（官方要建/选一个会话再写输入框），静默期间用户只会以为
 *   "点了没反应"；而这句话说的是我们**正在做**什么（填进去，不是发出去）。
 */
export const ENTERPRISE_ESC_SKILL_TRY_BUSY = '正在把这句话填进新会话的输入框…'
/**
 * 可点时的悬浮说明（说清"点它会做什么"，特别是**不发送**这一件）。
 *
 * 它与禁用那三句**互斥**：一支说会发生什么、另一支说为什么现在按不动——共用一个字符串，
 * 下一个接线的人就会在按钮可用的那天看到一句"还没接上"的鬼话。
 */
export const ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE = '在新会话的输入框里填好这句指令（只填，不发送）'
/** 失败提示的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射按稳定码给）。 */
export const ENTERPRISE_ESC_SKILL_TRY_FAILED_PREFIX = '去试试失败'

/**
 * **唯一草稿文案构造器**（纯函数，可直调取证）。
 *
 * 用**技能名**拼一句员工读得懂、Agent 也知道该干什么的指令。三个刻意选择：
 *   ① **点名这枚技能**（`「name」`）：Agent 会话里可能同时看得到好几枚技能，不点名就等于把"用哪一枚"
 *      这件事丢回给模型猜；
 *   ② **要求先交代再动手**：这句话被填进输入框时，用户还**没有**说具体任务（那正是"去试试"的语义：
 *      先开个场），故指令要求 Agent 先说明它能做什么、需要什么材料 —— 用户据此补一句再按发送；
 *   ③ **一个发送动作的字眼都不含**（本文件全篇没有发送 / 提交类 API，界面侧也只把文本交给官方写入口）。
 *
 * @param name - 卡片自己的技能名（`ResourceItem.name`；与「已装/未装」判据同一把键）。
 * @returns 那句指令；名字空 / 非法 / 超长 ⇒ `undefined`（**不给文案**，由计划判成禁用 + 写明原因）。
 */
export function enterpriseEscSkillTryDraft(name: string): string | undefined {
  const skill = typeof name === 'string' ? name.trim() : ''
  if (skill.length === 0 || skill.length > ENTERPRISE_ESC_SKILL_TRY_NAME_MAX) return undefined
  if (!ENTERPRISE_ESC_SKILL_TRY_NAME_SHAPE.test(skill)) return undefined
  return `请用「${skill}」这枚技能帮我干活：先告诉我它能做什么、需要我准备什么。`
}

/**
 * 成功交代那一整句（`role="status"` 里那一行）。
 *
 * ★**措辞必须如实**：我们**只填不发送**，故这句话说的是"已经在新会话里填好，按发送即可"，
 *   绝不写成"已发送 / 已开始"——那是界面替用户按下了发送键才配得上的说法。
 * ★带上技能名（与 S5a 那两句成功交代同一条）：员工一次点了几枚时，得能看出是哪一枚刚办好的。
 *
 * @param name - 刚办好的那枚技能名（调用方拿得到草稿，故名字一定合法）。
 */
export function enterpriseEscSkillTryFilledText(name: string): string {
  return `已在新会话的输入框里填好「${name}」这句指令，按发送即可。`
}

/* ────────────────────────── 二、计划投影（唯一入口） ────────────────────────── */

/**
 * 技能卡「去试试」的**终态**（本文件唯一认识的输出形状）。
 *
 * ★形状与卡片层的 `EscCardTryNow` **刻意同构**（那一侧不 import 本模块：卡片是本页最底的一层展示件，
 *   它不认识"技能名能不能拼出指令"这件事，换个维度要给真实动作时构造同样的对象即可）。
 * ★`onTry` **只在可点那一档在场**：于是"禁用 ⇒ 连 `onClick` 都没有"是**结构事实**，不是靠 `disabled`
 *   挡着（与 `EscCardInstall.onInstall` 口径 64 同一条纪律）。
 */
export interface EnterpriseEscSkillTryPlan {
  /** 按钮上那三个字（`ENTERPRISE_ESC_COPY.tryNow`，不在这里另写一份字面量）。 */
  readonly text: string
  readonly disabled: boolean
  /** 悬浮说明（可点 ⇒ 说会发生什么；不可点 ⇒ 与 `reason` 同源）。 */
  readonly title: string
  /** 无障碍名（可点与不可点都给；名字不合法时只说"去试试"，**不回显**可疑字符串）。 */
  readonly ariaLabel: string
  /** 禁用时的**行上可见**原因（在途那一档缺席——那时写的是 `busyText`）。 */
  readonly reason?: string | undefined
  /** 在途时的**行上可见**交代（与 `reason` 互斥：同一时刻只说一件事）。 */
  readonly busyText?: string | undefined
  /** 失败那一次的唯一提示件入参（稳定码 + 动作前缀）；缺席 = 没有失败要说。 */
  readonly failure?: { readonly code: string; readonly prefix: string } | undefined
  /** 点它干什么（**只有可点那一档才有**）；参数是我们拼好的那句指令。 */
  readonly onTry?: (() => void) | undefined
}

/**
 * 一枚技能卡上的「去试试」计划（**唯一判定点**）。
 *
 * 四件事实各归各的，**全部**由本函数说了算（页面层只接线、卡片只画）：
 *   · **已装**（`installed`）—— 没装就没有可试的东西（`NOT_INSTALLED`）；
 *   · **有文案**（名字能不能拼出指令）—— 拼不出就禁用（`NO_DRAFT`）；
 *   · **端口在场**（`wired`：`fillSkillTryDraft` 接没接上）—— 缺席就禁用（`NOT_WIRED`），
 *     **不写死 `disabled`**（判据是"端口在不在场"，与全仓那几枚按钮同一条纪律）；
 *   · **在途**（`pending`）—— 这一次还没收束，同一枚按钮禁用 + 一句可见交代。
 *
 * ★**成功与失败都不在这里翻状态**：本函数是纯投影，一个字节的本地状态都不改；失败只把
 *   "唯一提示件要的两件"（稳定码 + 动作前缀）交给卡片，成败的收束由页面层按端口的返回值做。
 *
 * @param input - 这一枚技能的名字、装没装、端口在不在场、在途与失败、以及唯一的写入口。
 * @returns 卡片那枚「去试试」的终态（**恒有值**：不可用时是"禁用 + 写明原因"，不是"整枚不画"——
 *   已装卡片上那枚按钮是版式的一部分，缺了它用户只会以为"这枚技能没法试"）。
 */
export function enterpriseEscSkillTryPlan(input: {
  /** 这一枚技能的名字（卡片给的就是它；草稿与可用性都只认这一把键）。 */
  readonly name: string
  /** 这一枚装没装（与卡片 `installed` **同源**：同一个已装判据的两处投影）。 */
  readonly installed: boolean
  /** 那条官方链路的端口在不在场（`EnterpriseEscSkillPort.fillSkillTryDraft`）。 */
  readonly wired: boolean
  /** 在途：这一次还没收束（缺席 = 没有动作在跑）。 */
  readonly pending?: boolean | undefined
  /** 上一次失败（只交给命中这一枚的那一次；只带稳定码，前缀由本文件给）。 */
  readonly failure?: { readonly code: string } | undefined
  /** 真写入口：拿到**拼好的那句指令**之后去开新会话并写输入框（**不发送**）。 */
  readonly onTry: (draft: string) => void
}): EnterpriseEscSkillTryPlan {
  const draft = enterpriseEscSkillTryDraft(input.name)
  const skill = draft === undefined ? undefined : input.name.trim()
  const text = ENTERPRISE_ESC_COPY.tryNow
  const busy = input.pending === true
  // 三档禁用原因**按同一优先级**取一枚（未装 > 没文案 > 端口缺席）：一句一个理由，不叠着说。
  const reason = !input.installed
    ? ENTERPRISE_ESC_SKILL_TRY_NOT_INSTALLED
    : draft === undefined
      ? ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT
      : !input.wired
        ? ENTERPRISE_ESC_SKILL_TRY_NOT_WIRED
        : undefined
  return {
    text,
    disabled: busy || reason !== undefined,
    // 三支互斥：在途说"正在做"，其余不可点说"为什么按不动"，可点说"点它会做什么"。
    title: busy ? ENTERPRISE_ESC_SKILL_TRY_BUSY : (reason ?? ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE),
    // 无障碍名只在名字**真的可用**时才带上它（可疑字符串不进无障碍名，也不进任何可见文案）。
    ariaLabel: skill === undefined ? text : `${text}：${skill}`,
    // ★`reason` 与 `busyText` 互斥：同一时刻卡片上只有一句话（在途那一档按钮已禁用，不需要第二句原因）。
    ...(busy && reason === undefined ? { busyText: ENTERPRISE_ESC_SKILL_TRY_BUSY } : {}),
    ...(reason === undefined ? {} : { reason }),
    ...(input.failure === undefined
      ? {}
      : { failure: { code: input.failure.code, prefix: ENTERPRISE_ESC_SKILL_TRY_FAILED_PREFIX } }),
    // ★可点那一档**才**给写入口（`disabled` 那一档连 `onClick` 都不挂）。
    //   指令在这里就拼好并闭包进去：卡片永远拿不到那句原文，也就没有第二处拼它的地方。
    ...(draft === undefined || busy || reason !== undefined
      ? {}
      : { onTry: () => { input.onTry(draft) } }),
  }
}

/* ────────────────────────── 三、计划表（按名取，唯一构造点） ────────────────────────── */

/**
 * 某一面（一轮数据 + 一份状态）的「去试试」计划表 —— **`enterpriseEscSkillTryPlan` 在 `src` 里的唯一调用点**。
 *
 * ★**为什么是"表"而不是"工厂函数"**：工厂每被调一次就造一枚新对象，而卡片是 `memo` 的
 *   （判据是 props 逐键浅相等）⇒ 逐卡现造的对象等于"每张卡每次渲染都变了"。表把这枚对象**按名字存住**，
 *   同一份数据 + 同一份状态下取到的永远是**同一枚**（`enterpriseEscPlanTable` 就是那条性质的唯一实现）。
 * ★**为什么要"装没装"这一格**：同一枚技能名在两张卡上可能落在不同的已装真值下（企业技能目录那份
 *   按 `packageId` 判、广场那份按发现面名字判）⇒ 两档各自成一张表，**绝不互相借答案**。
 *   调用方照旧自己给 `installed`（本函数不替它从别处猜一个），所以三处调用点的语义与改前逐字相同。
 * ★**名字不做任何编码**（不拼进键、不塞分隔符）：名字是外部数据，本叶不假设它的形状。
 *   分档用"两张表"表达，正是为了免掉"拼键"这件容易撞车的事。
 *
 * @param input - 这**一份状态**：端口在不在场、在途与失败、以及唯一执行路。
 * @returns `get(name, installed)` —— 同一份状态下、同名同档取两次是**同一枚计划**。
 */
export function enterpriseEscSkillTryTable(input: {
  /** 那条官方链路的端口在不在场（`fillSkillTryDraft`）。 */
  readonly wired: boolean
  /** 在途的那一枚技能名（缺席 = 没有动作在跑；只影响**这一枚**）。 */
  readonly pending?: string | undefined
  /** 上一次失败（只对命中同一个名字的那一枚生效）。 */
  readonly failure?: { readonly name: string; readonly code: string } | undefined
  /** 真写入口：拿到拼好的那句指令之后去开新会话并写输入框（**不发送**）。 */
  readonly onTry: (name: string, draft: string) => void
}): (name: string, installed: boolean) => EnterpriseEscSkillTryPlan {
  /** 唯一构造点（`enterpriseEscSkillTryPlan(` 在本文件之外**一次都不许出现**，门禁逐文件计数锁着）。 */
  const buildPlan = (name: string, installed: boolean): EnterpriseEscSkillTryPlan =>
    enterpriseEscSkillTryPlan({
      name,
      installed,
      wired: input.wired,
      ...(input.pending !== undefined && input.pending === name ? { pending: true } : {}),
      ...(input.failure !== undefined && input.failure.name === name ? { failure: { code: input.failure.code } } : {}),
      onTry: (draft: string) => { input.onTry(name, draft) },
    })
  /**
   * 两档各一张表：`installed` 是判据的一部分 —— 同一枚技能名在两张卡上可能落在不同的已装真值下
   * （企业技能目录那份按 `packageId` 判、广场那份按发现面名字判），两档**绝不互相借答案**。
   * ★`installed` 仍由调用方给（本函数不替它从别处猜一个）：三处调用点的语义与改前逐字相同。
   */
  const installedTable = enterpriseEscPlanTable<string, EnterpriseEscSkillTryPlan>(name => buildPlan(name, true))
  const notInstalledTable = enterpriseEscPlanTable<string, EnterpriseEscSkillTryPlan>(name => buildPlan(name, false))
  return (name, installed) => (installed ? installedTable : notInstalledTable)(name)
}
