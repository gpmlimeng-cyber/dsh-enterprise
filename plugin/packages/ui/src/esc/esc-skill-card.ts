/**
 * [INPUT]: 只依赖 `esc-card` 的两枚计划形状（`EscCardInstall` / `EscCardTryNow`）与 `esc-more-menu` 的
 *   `EscCardMore` —— **全部是类型导入**；不依赖 React、不发请求、
 *   不认识任何路由 / 官方服务 / 平台 DTO，也不认识"账本"（两份 DSH 记录）
 * [OUTPUT]: 对外提供技能卡（**系统广场 / 团队空间 / 精选行三处共用**）的三件纯事实——
 *   ① **隐藏规则** `enterpriseEscSkillCardHidden`（磁盘上已有同名技能 ⇒ 从列表里**去掉**）
 *     与它用的空集合常量 `ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED`；
 *   ② **刚装标记的生命周期** `enterpriseEscSkillCardMarkState`（**唯一 reducer**）+ 状态形状
 *     `EnterpriseEscSkillCardMarkState` + 初值 `ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY`；
 *   ③ **卡片入参的唯一装配点** `enterpriseEscSkillCardParams` + 入参形状 `EnterpriseEscSkillCardParams`；
 *   ④ **第三条"为什么空"**（隐藏规则的自然后果）：唯一判定 `enterpriseEscSkillAllInstalledEmpty`
 *     ＋两句文案 `ENTERPRISE_ESC_SKILL_ALL_INSTALLED_TITLE` / `…_NEXT`。
 * [POS]: 用户冻结规格 `analysis/esc-skill-card-spec.md` §1/§2 的**事实层**（技能卡那一档）。
 *   广场网格（`esc-aggregation.tsx`）与精选行（`esc-featured.tsx`）都调这里的三件事实，**各不重写**：
 *   "哪一枚该不出现""刚装那一枚现在长什么样""这一枚卡片拿到哪些入参"三件事在本仓**只有一份实现**。
 *
 *   ★★**为什么必须单开这一叶（而不是在两处各写一遍）**——三条都是本仓被咬过的形状：
 *     ① **隐藏规则**：规格 §1① 要的是"广场与团队空间两个维度、以及精选那一行"**同一条规则**。
 *        两处各写一次 `installedIds.has(name)`，只要有一处忘了"刚装那一枚例外"，同一枚技能就会
 *        在广场里画着、在精选里消失（或反过来）——那正是用户报的"同一屏同一件东西两种形态"。
 *        故判据收成**一个函数**，三处调用点（广场网格 / 精选行 / 团队空间）都是它。
 *     ② **刚装那枚的形态**：规格 §1③ 要的是"**只显示「去试试」**：没有「…」、没有【＋】"。
 *        表达这件事的唯一正确形态是**入参里根本没有 `more` 与 `install` 两格**（不是"给了计划但不画"、
 *        也不是"画成禁用"）：卡片层那两枚控件的构造点因此**物理上进不去**。这条一旦散在两处，
 *        下一个改精选行的人只要"顺手把 `moreOf` 也交下去"，那枚 `⋯` 就会在精选卡上冒出来。
 *     ③ **入参逐键同源**：规格 §2 的根因就是"精选那边少递了那份安装计划"⇒ 卡片退回默认形态、
 *        把兜底那句长说明（「这类技能没有可下载的技能包…」）打出来，卡片被撑高成"描述三行"。
 *        故**卡片入参的装配只有这一处**：两处调用点吃同一份夹具时，拿到的对象**逐键相等**。
 *     ④ **"都装过了"这种空**（本刀补的第二处真话）：隐藏规则把已装的逐枚滤掉之后，某一维度可能
 *        **一条不剩**——那时员工看到的若是官方那句「暂无数据」，界面就是在说假话（平台明明给了数据、
 *        是我们自己藏起来的）。判据与两句话收在本文件（`enterpriseEscSkillAllInstalledEmpty`），
 *        视图只负责画：**有数据但一枚没剩下** ⇒ 说"都装到本机了" + 下一步；`listed === 0`（真没有
 *        数据）才走既有那一态。⚠这条同样是**两个数**的判据，不是一个布尔。
 *
 *   ★**隐藏判据是"磁盘上已有同名技能"（`installedIds`，来自官方发现面），不是账本**：
 *     账本（`GET /skills/installed` 那份中心已装记录 + `GET /skills/self-installed` 那份自装记录）
 *     只记"**DSH 自己装过**的那几条"——照它隐藏，会出现"盘上明明有这枚技能（用户手放进去的、
 *     官方内置的），广场照旧画着、点下去必撞 `ENT_SKILL_NAME_CONFLICT`"这种**骗人**的形态。
 *     官方发现面（`ctx.get('skills')` 的快照）答的才是"磁盘上真的装着什么"，故判据只认它。
 *     ⇒ 本文件与 `esc-installed-model.ts` 那套**账目口径**（四组渠道）是**两件事**，判据不许互借：
 *       那一套答"这枚算不算 DSH 装的"，这一套答"盘上有没有同名技能"。
 *
 *   ★**标记的生命周期写死在 reducer 里，只有两个事件**：
 *     `installed`（安装成功 ⇒ 记下那一枚的名字）与 `relist`（列表重读 / 切维度 ⇒ 撤掉，**不许永久留着**）。
 *     ⚠**为什么"安装成功之后那一次自动重读"不算 `relist`**：那次读是**这次安装动作自己的收尾**
 *     （成功回执 ⇒ 请官方发现面重读一遍，见 `esc-aggregation.tsx` 的 `runSystemInstall`）；把它也算成
 *     "列表重读"，标记会在**同一次动作里**刚置上就被撤掉 —— 那个例外就永远看不见了（自相矛盾）。
 *     故派发点写在各维度/分类/搜索/刷新那几个**用户发起**的重读出口上（聚合层逐处派发，门禁按点计数）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EscCardInstall, EscCardTryNow } from './esc-card.js'
import type { EscCardMore } from './esc-more-menu.js'

/* ────────────────────────── 一、隐藏规则（唯一判据） ────────────────────────── */

/**
 * 空集合常量（**同一引用**：精选行在专家档 / 读不到已安装清单时要一个"没有已装"的集合，
 * 每次现造一个 `new Set()` 会让下游的依赖数组每渲染一次都变一次）。
 */
export const ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED: ReadonlySet<string> = new Set<string>()

/**
 * 这一枚技能卡该不该**从列表里去掉了**（规格 §1① + §1② 的**唯一判据**）。
 *
 * 三条，缺一条都会画错：
 *   ① 判据是**磁盘上已有同名技能**（`installedNames` ＝官方发现面给的 kebab 名集合）。
 *      账户本那条路（"DSH 装过没有"）在这里是**错的**：盘上有、账上没有的那些（用户手放进去的、
 *      官方内置的）点下去只会撞 `ENT_SKILL_NAME_CONFLICT` —— 拿它判就是让界面替宿主说谎。
 *   ② **不是灰化、不是打标**：调用方据此把这一条**从列表里滤掉**（连元素都不进树）。
 *   ③ **刚装的那一枚例外**（`justInstalledSkillName`）：本页本次会话里刚安装成功的那一枚
 *      **留在原地**（位置照旧）——它是"我刚点出来的东西"凭空消失这件事的唯一补丁。
 *
 * @param input - 这一条的名字、磁盘真值集合、刚装那一枚的名字（缺席 = 没有刚装的）。
 * @returns `true` = 这一条不进列表（调用方滤掉）。
 */
export function enterpriseEscSkillCardHidden(input: {
  /** 这一条技能的名字（广场那份的 `name`、发现面那份的 kebab 名 —— 同一套命名）。 */
  readonly name: string
  /** 磁盘真值：**官方发现面**给的已装技能名集合（不是账本、不是两份记录）。 */
  readonly installedNames: ReadonlySet<string>
  /** 本页本次会话里刚安装成功的那一枚（**唯一例外**；缺席 = 没有）。 */
  readonly justInstalledSkillName?: string | undefined
}): boolean {
  if (!input.installedNames.has(input.name)) return false
  return input.justInstalledSkillName !== input.name
}

/* ────────────────────────── 二、刚装标记的生命周期（唯一 reducer） ────────────────────────── */

/**
 * 刚装那一枚的标记（**两件事**，故是一个小对象而不是一枚裸字符串）：
 *   · `name` —— 本页本次会话里刚安装成功的那一枚技能名；
 *   · `ownRead` —— **这次列表重读就是那次安装自己引发的**（只消费一次，见下面 reducer 的第 ① 条）。
 *
 * ⚠`ownRead` 不是"另一个真值"，它是**同一件事的一次性状态**：安装成功后官方发现面要重读一遍
 *   （把新名字并进磁盘真值），那一趟读**不该**把刚置上的标记撤掉；再往后的任何一次重读才是"列表重读"。
 */
export interface EnterpriseEscSkillCardMarkState {
  readonly name?: string | undefined
  readonly ownRead?: true | undefined
}

/** 初值（**同一引用**：`setState` 拿到同值时会 bail out，不会多渲染一轮）。 */
export const ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY: EnterpriseEscSkillCardMarkState = Object.freeze({})

/** 两个事件（**只有这两个**：装成功与列表重读）。 */
export type EnterpriseEscSkillCardMarkEvent =
  /** 安装成功（`name` = 刚装好的那一枚）。 */
  | { readonly kind: 'installed'; readonly name: string }
  /** 列表重读 / 切维度 / 换分类 / 改搜索词 / 刷新（撤掉标记——**不许永久留着**）。 */
  | { readonly kind: 'relist' }

/**
 * 标记的状态机（**纯函数**，规格 §1② 那条生命周期的唯一实现）。
 *
 * `installed` ⇒ 置上（并记下"紧接着那一次重读是我自己引发的"）；
 * `relist`    ⇒ 第 ① 次（`ownRead === true`）只消费掉那一格、标记**留着**（那是本次安装的收尾）；
 *               第 ② 次起撤掉（＝真正的"列表重读 / 切维度"）。
 *
 * ★★**`relist` 到底指哪一类重读（这条判据的边界与理由，用户 2026-10-09 裁决确认）**：
 *   「列表重读」在本仓有**两类**，它们长得很像、必须分开：
 *     ① **用户发起的重读** —— 切维度 / 切资源类型 / 换分类 / 改搜索词 / 失败重试。共同点是
 *        "**员工要重新看这一面**"：他要的是一面**干净的、当下的**列表，而不是上一轮操作留下的痕迹；
 *     ② **动作自己的收尾重读** —— 安装成功后请官方发现面重读一遍（好把新名字并进磁盘真值）。
 *        共同点是"**这一次动作还没说完**"：它是那个动作的最后一步，不是员工要换一面的意思。
 *   ⇒ 只有 ① 算 `relist`；② 不算（它由 `installed` 事件带下来的 `ownRead` 那一格消费掉）。
 *   **为什么这个分界不能省**：若把 ② 也算 `relist`，标记会在**同一次安装动作里**刚置上就被撤掉
 *   —— 而"刚装的那一枚留在原地"这条例外（规格 §1②）恰恰只在**那一次**动作之后起作用 ⇒
 *   那条例外会变成**永远看不见**的东西（规格被做成了不可见，等于没做）。这不是实现细节，
 *   是"这个例外到底是给谁看的"这件事的落点：它就是给**按下安装的那个人**看的。
 * ★为什么要把"自己引发的那一次"单列一格，而不是让调用方在派发时自己判：判据一旦散到派发点上，
 *   两处派发（维度 / 分类 / 搜索 / 刷新）迟早会在"这一次算不算"上漂；收在这里就只有一份答案。
 * ★返回**同一引用**表示"没有变化"（调用方可据此跳过 setState 的额外渲染）。
 */
export function enterpriseEscSkillCardMarkState(
  current: EnterpriseEscSkillCardMarkState,
  event: EnterpriseEscSkillCardMarkEvent,
): EnterpriseEscSkillCardMarkState {
  if (event.kind === 'installed') {
    if (event.name.length === 0) return current
    return { name: event.name, ownRead: true }
  }
  // ① 这一次重读是那次安装自己的收尾 ⇒ 只消费掉那一格，标记留着（否则例外永远看不见）。
  if (current.ownRead === true) return { name: current.name }
  // ② 真正的"列表重读 / 切维度" ⇒ 撤掉；已经是空的就是空（**同一引用**，不触发多余渲染）。
  return current.name === undefined ? current : ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY
}

/* ────────────────────────── 三、卡片入参的唯一装配点 ────────────────────────── */

/**
 * 一张**技能卡**的入参（不含 `key` 与 `item`：那两格是"这一枚是谁 / 在列表里的位次"，必然不同）。
 *
 * ★形状刻意只覆盖**技能**这一档（`iconShape` / `showUse` 恒为方图标 + 技能档）：专家卡与连接器卡
 *   的动作不在本刀里，故它们仍由两处调用点各自铺那几格（本刀一个字都没动它们）。
 */
export interface EnterpriseEscSkillCardParams {
  readonly iconShape: 'square'
  readonly showUse: true
  /** 已装（这一页只画未装的与"刚装那一枚"，故它决定卡片走哪一支动作）。 */
  readonly installed: boolean
  /** 未装那一档那枚【＋】的终态；**刚装那一枚没有这一格**（见下面）／维度不允许时也缺席。 */
  readonly install?: EscCardInstall | undefined
  /** 已装那一档那枚「更多」的终态；**刚装那一枚没有这一格**（见下面）／算不出来时也缺席。 */
  readonly more?: EscCardMore | undefined
  /**
   * 那枚「去试试」的终态（`esc-skill-try.ts` 那枚唯一事实层给的）。
   *
   * ★**可选，但生产路径上恒在**：广场网格与精选行都由聚合层交下来的**同一个** `tryOf` 给计划
   * （技能档恒有值）；只有"某个调用方没接这条动作"时才缺席 —— 那一档卡片逐字回到改前那一态
   * （禁用 + `title = actionNotPorted`，与 `esc-card.tsx` 的 `tryNow` 契约**逐字一致**）。
   */
  readonly tryNow?: EscCardTryNow | undefined
}

/**
 * 一枚技能卡 → 它的卡片入参（**全仓唯一装配点**）。
 *
 * ★**广场网格与精选行都只调它**（`esc-aggregation.tsx` 与 `esc-featured.tsx` 各一处，都是这一枚函数）：
 *   同一份夹具（同一枚 `item`、同一批子计划）下，两处拿到的对象**逐键相等** —— 这就是规格 §2
 *   "精选卡与广场卡接同一份安装计划"的落法；改前精选行少递那份安装计划 ⇒ 卡片退回默认形态、
 *   把兜底那句长说明打出来（用户看到的"描述三行"）。
 *
 * ★**刚装那一枚（`justInstalled`）只显示「去试试」**：`install` 与 `more` **两格都不进返回值**
 *   —— 不是"给了但不画"、也不是"画成禁用"，而是**卡片层那两枚控件的构造点物理上够不到**。
 *   同时 `installed` 被钉成 `true`（刚装成功的这一枚必然已装；这里显式写出来，免得调用方
 *   因为发现面还没重读完而给出 `false`，那会让卡片改画那枚【＋】——一枚"装了还能再装"的按钮）。
 *
 * @param input - 这一枚的 `item` 用不到（key 与 item 由调用方自己给）、装没装、是不是刚装的那一枚、
 *   以及三枚**已由各自唯一事实层算好**的子计划（安装 / 更多 / 去试试）。
 * @returns 卡片入参（调用方与 `item`/`key` 一起铺成 `EnterpriseEscCard` 的 props）。
 */
export function enterpriseEscSkillCardParams(input: {
  /** 这一枚在磁盘上装没装（与隐藏规则**同一份真值**：官方发现面的名字集合）。 */
  readonly installed: boolean
  /** 这一枚是不是"本页本次会话里刚安装成功的那一枚"（标记的状态由上面那枚 reducer 说）。 */
  readonly justInstalled: boolean
  /** 未装那一档那枚【＋】的终态（维度/端口不允许时缺席）。 */
  readonly install?: EscCardInstall | undefined
  /** 已装那一档那枚「更多」的终态（不是本机自装 / 端口缺席时缺席）。 */
  readonly more?: EscCardMore | undefined
  /** 那枚「去试试」的终态（唯一事实层 `esc-skill-try.ts` 给的，本函数只转交）。 */
  readonly tryNow?: EscCardTryNow | undefined
}): EnterpriseEscSkillCardParams {
  if (input.justInstalled) {
    // ★规格 §1③：刚装那一枚**只有**「去试试」——`more` 与 `install` 两格不出现（见上面那段推理）。
    return {
      iconShape: 'square',
      showUse: true,
      installed: true,
      ...(input.tryNow === undefined ? {} : { tryNow: input.tryNow }),
    }
  }
  return {
    iconShape: 'square',
    showUse: true,
    installed: input.installed,
    ...(input.install === undefined ? {} : { install: input.install }),
    ...(input.more === undefined ? {} : { more: input.more }),
    ...(input.tryNow === undefined ? {} : { tryNow: input.tryNow }),
  }
}

/* ────────────────────────── 四、第三条"为什么空"（隐藏规则的自然后果） ────────────────────────── */

/**
 * 第三种"为什么空"的**第一句**（为什么）：这一面读到了东西，可一枚都没剩下。
 *
 * ★措辞**不许**写成「暂无数据」：那是"平台上没有 / 没读到"那一类的说法，而这一格里平台明明给了数据，
 *   只是**每一枚都已经被装到本机**（隐藏规则把它们逐枚滤掉了）——照旧画「暂无数据」就是**假话**。
 */
export const ENTERPRISE_ESC_SKILL_ALL_INSTALLED_TITLE = '这个维度里的技能都已经装到本机了。'
/**
 * 第三种"为什么空"的**第二句**（下一步）：说清员工现在能去哪儿。
 *
 * ★两处落点都在**同一页**上：工具栏右块那枚「已安装」（点开就是那一页）与左上的三页签/维度行
 *   （换一面看别的技能）——不下沉到别处、也不写"刷新试试"（刷新换不出新数据：数据没少，是被滤掉了）。
 */
export const ENTERPRISE_ESC_SKILL_ALL_INSTALLED_NEXT =
  '想看或管理它们，点右上角「已安装」；也可以换个维度或搜索词看看别的技能。'

/**
 * 第三种"为什么空"的**唯一判定**（纯投影）：这一面到底是"没有数据"还是"都装过了"。
 *
 * 判据只有一条、且是**两个数**（不是"列表为空"这一个布尔）：
 *   · `listed === 0`          ⇒ **确实没有数据**（平台没给 / 这一维度本来是空的）⇒ `undefined`，
 *                               由既有那一态（插图 + 官方那句「暂无数据」）说；
 *   · `listed > 0 && visible === 0` ⇒ **都装过了**（读到的每一枚都被隐藏规则滤掉）⇒ 两句话；
 *   · `visible > 0`           ⇒ 有东西要画 ⇒ `undefined`。
 *
 * ★为什么必须是**两个数**而不是"`visible === 0`"一个布尔：一个布尔分不出"平台什么都没给"与
 *   "给了一堆、全被我们藏了"——那是两句完全不同的话（前者是平台的实情，后者是我们的动作造成的）。
 * ★本函数是**纯投影**（可直调取证）：判定与两句文案都归这一处，视图只负责画。
 */
export function enterpriseEscSkillAllInstalledEmpty(input: {
  /** 这一面**读到**了几条（`list.length`）。 */
  readonly listed: number
  /** 其中**真的画出来**几条（`visibleList.length`，＝滤掉已装之后的条数）。 */
  readonly visible: number
}): { readonly title: string; readonly body: string } | undefined {
  if (input.listed === 0) return undefined
  if (input.visible > 0) return undefined
  return { title: ENTERPRISE_ESC_SKILL_ALL_INSTALLED_TITLE, body: ENTERPRISE_ESC_SKILL_ALL_INSTALLED_NEXT }
}

