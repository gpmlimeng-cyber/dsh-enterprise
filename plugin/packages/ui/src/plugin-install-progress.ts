/**
 * [INPUT]: 只依赖 `local-api-decode.ts` 的受管态类型（不读网络、不读 React、不读宿主路径；也不需要 import 运行时值）
 * [OUTPUT]: 企业插件安装/卸载的**真进度**唯一投影 `enterprisePluginProgress`（阶段 + 不确定态 + **按真状态算的** `cancelable`/`canceling`/取消原因）、**落地交代**唯一投影 `enterprisePluginSettledNotice`、在途受管态清单 `ENTERPRISE_PLUGIN_PROGRESS_STATES`、**官方取消句柄真实存在的那一个受管态** `ENTERPRISE_PLUGIN_CANCELABLE_STATES`、轮询间隔 `ENTERPRISE_PLUGIN_PROGRESS_POLL_MS` 与那一组可见文案常量
 * [POS]: ui 员工侧「安装中」这件事的**唯一口径真源**——`marketplace-entry.tsx`（官方插件页里的插件市场，插件行）与 `plugin-market.tsx`（企业设置 → 插件，卡片行 + 详情）两处渲染都只调这一份，阶段文字更只有一份（`plugin-market.tsx` 的官方状态词表 `enterprisePluginStatePresentation`），故两处不可能各说一套。
 *
 * **真进度从哪来（本仓唯一一条可达的路，已按实物核实）**：
 *   ① 本仓的受管插件安装**已经改走官方 `pluginManager`**（`bundle/src/manager-wiring.ts` 晚绑定官方服务；
 *      `plugin-distribution/src/service.ts` 的 `installThroughOfficialManager` 用**我们自己生成的 requestId**
 *      调官方 `installBundle`）——官方那套 `plugin-manager/install-state` / `install-log` 事件与
 *      `waitForInstall` / `cancelInstall` 因此**对这个安装面真的会触发**，取消有真实句柄可下。
 *      ⚠ 但官方的三相位（`installing` / `applying` / `cancelling`）**不进线协议**（受管态是闭集、零新增字段），
 *      界面上唯一看得到的仍是本仓自己的受管态 ⇒ 下面 ② 那条只读状态路由是界面侧**唯一**的真进度源。
 *   ② Host 在 `reconcileInstalled` 里**每走一步都先把真状态写进本机记录**
 *      （`this.put(… 'DOWNLOAD_PENDING' → 'DOWNLOADING' → 'VERIFIED' → 'INSTALLING' → 'RESTART_REQUIRED')`，
 *      卸载侧 `:513` 的 `REMOVE_PENDING → 'REMOVING' → 'RESTART_REQUIRED'`；换版本还先走 `'ROLLBACK'`），
 *      而只读路由 `GET /enterprise/api/v1/local/plugins`（`platform-client/src/local-api.ts` 的精确路由）
 *      同步投影这份记录。于是**我们自己已有的状态路由**就是一条真进度：界面在安装进行中轮询它，
 *      拿到的 `plugins[].state` 是 Host 真正走到的工序阶段。
 *
 * **绝不假装进度**：官方与本机都**不给百分比**，这条链只给「阶段」。故本层只产出
 * `phase`（`pending` = 请求已提交、还没报到在途阶段；`working` = 已报到在途阶段）+ **真阶段文字** +
 * 恒 `indeterminate: true` 的不确定态指示；界面据此只画**流光**（不确定态），
 * 不画会走满的进度条、也不产出任何 `0%…100%` 数字——阶段推进时变的是**文字**，不是百分比。
 *
 * **取消：能取消时才给真按钮，不能取消时给可见原因**：
 *   官方 `cancelInstall(requestId)` 的句柄只在**一个**受管态里存在——`INSTALLING`
 *   （`service.ts:683` 在 `installBundle` 之前那一刻挂上、`:690` 的 `finally` 摘掉；`cancel()` 也只认这枚句柄）。
 *   · `ROLLBACK` / `DOWNLOAD_PENDING` / `DOWNLOADING` / `VERIFIED` 都还没把句柄交出来（此时取消是一次 no-op）；
 *   · 卸载方向（`REMOVE_PENDING` / `REMOVING`）压根没有安装句柄（官方 `cancelInstall` 只管安装那一跑）。
 *   故 `cancelable` 是**按真状态算的**（不是恒真、也不是恒假）：能取消时界面给一枚真按钮，
 *   不能取消时给**一句可见原因**（`cancelNotice`），而不是一枚点了没用的按钮。
 *   取消请求在途时（store 的 `pluginCancelBusy`）本层出 `canceling: true` 与「正在取消…」那句，
 *   界面据此禁用按钮并播报；**取消的结果**不由本层宣判——它由那次安装请求自己的收束
 *   （抛 `ENT_PLUGIN_INSTALL_CANCELLED`）经唯一提示组件呈现。
 *
 * **本刀（插件行动分流）**：动作族从 `install | remove` 扩成 `install | remove | enable | disable`
 *   （`EnterprisePluginAction`）——**停用方向必须有自己那句「正在停用这枚插件…」**（沿用既有的进度/收束链，
 *   但绝不能说成「卸载」），启用/停用没有官方取消句柄故只给一句可见原因
 *   （`ENTERPRISE_PLUGIN_PROGRESS_CANCEL_SWITCH`），落地交代换成两句明说「仍装在本机」的
 *   `ENTERPRISE_PLUGIN_SETTLED_DISABLED{,_RESTART}` / `..._ENABLED{,_RESTART}`。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ManagedPluginState } from './local-api-decode.js'

/**
 * 「这台机器此刻正在走工序」的受管态（比 `ENTERPRISE_PLUGIN_IN_FLIGHT_STATES` 宽一档）。
 *
 * 两份清单回答的是**两个不同的问题**，故不合并、但保持包含关系（下面那条断言把它钉住）：
 *   · `ENTERPRISE_PLUGIN_IN_FLIGHT_STATES` = 「把开关放开安全吗」（开关口径，只收会立刻拒第二次点击的那几态）；
 *   · 本清单 = 「现在有工序在跑吗」（进度口径，把 `DOWNLOAD_PENDING` / `VERIFIED` / `REMOVE_PENDING`
 *     这三个同样在工序中间、只是还没到「写盘」阶段的态也收进来）。
 * `RESTART_REQUIRED` / `ACTIVE` / `FAILED` / `EXPECTED` **一律不在**清单里：它们是「工序已经落地」的态，
 * 由行上状态词、等重启交代与失败提示负责，不是「安装中」。
 */
export const ENTERPRISE_PLUGIN_PROGRESS_STATES: readonly ManagedPluginState[] = [
  'ROLLBACK',
  'DOWNLOAD_PENDING',
  'DOWNLOADING',
  'VERIFIED',
  'INSTALLING',
  'REMOVE_PENDING',
  'REMOVING',
]

/**
 * 「安装中」时的轮询间隔（毫秒）。
 *
 * 真源是一次**只读 GET**（见文件头①），Host 侧同步投影、不写任何东西，故间隔取一个既能让阶段推进
 * 看得见、又不会把本机路由打满的值。进程落在 Node 里，间隔与渲染无关（不需要跟动画帧对齐）。
 */
export const ENTERPRISE_PLUGIN_PROGRESS_POLL_MS = 1200

/**
 * 「只是**观察到**本机在途、但没有我们自己的动作在飞」时允许轮询的**上限拍数**（≈30 秒）。
 *
 * 为什么必须有这个上界：Host 每走一步工序都会把真状态**落盘**（`plugin-distribution` 的 `put()`），
 * 于是进程若正好在工序中间崩过，磁盘上的受管态就会永远停在 `DOWNLOADING` / `INSTALLING` 那一格。
 * 没有上界的话，界面一打开就会每 1.2 秒读一次状态路由、永不停止（常驻空转）。
 * 有界之后行为仍然诚实：进度条**留在最后报到的那个真阶段**上（阶段是真的、只是不再推进），
 * 用户下一次刷新/点重试会重新起一轮——我们**不**替 Host 猜「其实已经结束了」。
 *
 * 有我们自己的动作在飞（`pluginBusy` 在）时**不**设上限：那段窗口是由动作本身界定的，
 * 动作一收束就 `finally` 停表。
 */
export const ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS = 25

/**
 * 官方取消句柄**真实存在**的那一个受管态：只有 `INSTALLING`。
 *
 * 真源是 `plugin-distribution/src/service.ts`：`installThroughOfficialManager` 在调官方 `installBundle`
 * **之前那一刻**才把 `installHandle = { packageName, requestId }` 挂上（`:683`）、在 `finally` 里摘掉（`:690`），
 * 而写到这个句柄之前的最后一步正是 `await this.put(assignment, 'INSTALLING')`（`:663`）。于是：
 *   · `ROLLBACK` / `DOWNLOAD_PENDING` / `DOWNLOADING` / `VERIFIED` —— 句柄还没挂上，取消会落到
 *     `cancel()` 的 `not-running` 分支（一次诚实的 no-op，不是取消）；
 *   · `REMOVE_PENDING` / `REMOVING` —— 卸载路径**从不**挂安装句柄（`installHandle` 只在安装链上写），
 *     官方 `cancelInstall` 只管安装那一跑。
 * 所以这张清单只有一格：它是「界面此刻给不给那枚取消按钮」的**唯一**判据，多一格就是假按钮。
 */
export const ENTERPRISE_PLUGIN_CANCELABLE_STATES: readonly ManagedPluginState[] = ['INSTALLING']

/** 请求已提交、Host 还没报到在途阶段时的那句话（安装方向）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_PENDING_INSTALL = '正在处理安装请求…'
/** 同上（卸载方向）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_PENDING_REMOVE = '正在处理卸载请求…'
/** 同上（停用方向）——关闭开关＝停用，**不是**卸载，这一句必须说对。 */
export const ENTERPRISE_PLUGIN_PROGRESS_PENDING_DISABLE = '正在停用这枚插件…'
/** 同上（启用方向）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_PENDING_ENABLE = '正在启用这枚插件…'

/**
 * 「现在还不能取消」的**可见**原因（安装请求刚提交、官方句柄还没交出来）。
 *
 * 为什么是交代而不是按钮：这一刻取消打不到任何东西（见 `ENTERPRISE_PLUGIN_CANCELABLE_STATES`），
 * 画一枚点了没用的按钮正是产品宪法禁止的假控件。于是把话说明白，并给出**什么时候可以**。
 */
export const ENTERPRISE_PLUGIN_PROGRESS_CANCEL_PENDING = '安装请求已提交，走到「正在安装」后就能取消。'
/** 同上：Host 已报到在途工序，但还没到挂上官方取消句柄的那一步。 */
export const ENTERPRISE_PLUGIN_PROGRESS_CANCEL_EARLY = '下载与校验还在进行，走到「正在安装」后就能取消。'
/** 卸载方向没有取消面（官方 `cancelInstall` 只管安装那一跑）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_CANCEL_REMOVE = '卸载已经开始，完成前不能中断。'
/** 启用 / 停用方向没有取消面：它是一次本机开关切换（官方只改 profile 的 bundle 层），不是一次下载。 */
export const ENTERPRISE_PLUGIN_PROGRESS_CANCEL_SWITCH = '启用 / 停用是一次本机切换，不能中断，很快就结束。'

/**
 * 取消请求**已在路上**时的可见交代。
 *
 * 它与「不能取消」的原因共用同一个落点（进度条旁边那句），但语义不同：这是**正在做**，
 * 界面另外把那枚按钮置为不可用（有可见交代，不是死控件），并以 `role="status"` 播报。
 */
export const ENTERPRISE_PLUGIN_PROGRESS_CANCELLING = '正在取消这次安装…'

/** 进度这一路读不到时的可见交代（安装本身仍在进行，下一拍会自动重读）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_READ_FAILED = '进度暂时读不到，安装仍在进行，稍后会自动重读。'

/** 安装完成且已经生效。 */
export const ENTERPRISE_PLUGIN_SETTLED_INSTALLED = '安装完成，已经生效。'
/** 安装完成、需要重新打开客户端才生效（本机受管插件的常规收束）。 */
export const ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART = '安装完成，重新打开客户端后生效。'
/** 卸载完成（本机的受管插件模块要重新加载才真正退场）。 */
export const ENTERPRISE_PLUGIN_SETTLED_REMOVED = '卸载完成，重新打开客户端后生效。'
/** 停用完成且已经生效（这枚插件不再参与运行，**依赖仍在本机**）。 */
export const ENTERPRISE_PLUGIN_SETTLED_DISABLED = '已停用：这枚插件不再参与运行，它仍装在本机。'
/** 停用完成、需要重新打开客户端才完全退场。 */
export const ENTERPRISE_PLUGIN_SETTLED_DISABLED_RESTART = '已停用，重新打开客户端后完全退场。'
/** 启用完成且已经生效。 */
export const ENTERPRISE_PLUGIN_SETTLED_ENABLED = '已启用：这枚插件已恢复运行。'
/** 启用完成、需要重新打开客户端才生效。 */
export const ENTERPRISE_PLUGIN_SETTLED_ENABLED_RESTART = '已启用，重新打开客户端后生效。'

/**
 * 本客户端能发起的四种受管插件动作。
 *
 * 它们是**两个方向对**：`install`/`remove` 动的是「装没装」，`enable`/`disable` 动的是「启用着没」。
 * 四种共用一个在途事实（`pluginBusy`）与同一份进度投影，故行上不会出现「装到一半说在停用」。
 */
export type EnterprisePluginAction = 'install' | 'remove' | 'enable' | 'disable'

/** 「安装中」这一段进度的两个相位。 */
export type EnterprisePluginProgressPhase = 'pending' | 'working'

/** 一次安装/卸载/启用/停用动作**刚从本客户端发出**（store 的 `pluginBusy`）。 */
export interface EnterprisePluginBusyFact {
  readonly action: EnterprisePluginAction
  readonly packageName: string
}

/** 一次安装/卸载/启用/停用动作**已经收束**的落地事实（store 在动作 finally 里按最终受管态记下）。 */
export interface EnterprisePluginSettledFact {
  readonly action: EnterprisePluginAction
  readonly packageName: string
  /** 收束时的真实受管态（卸载把记录删干净了就是 `EXPECTED` = 本机不再装着）。 */
  readonly state: ManagedPluginState
}

/** 给一行算进度所需**全部**输入（都是现场事实，没有一件是估算出来的）。 */
export interface EnterprisePluginProgressInput {
  /** 这一行的包名——只用来判定「在途的那个动作是不是这一行」，别的行一律不显示进度。 */
  readonly packageName: string
  /** 本客户端刚发出、还没结束的动作；缺席 = 本客户端没在动这一行。 */
  readonly busy?: EnterprisePluginBusyFact | undefined
  /** 本机受管态（Host 只读投影，安装进行中由 store 轮询刷新）。 */
  readonly state: ManagedPluginState
  /**
   * **真阶段文字**：唯一词表是 `plugin-market.tsx` 的 `enterprisePluginStatePresentation(state).title`
   * （「正在下载」「正在安装」…）。由调用方传入而不是在本层再写一份，是为了让两处渲染与既有状态词
   * **一个字都不会分叉**。
   */
  readonly stageText: string
  /** 进度这一路读不到时的稳定码（store 的 `pluginProgressErrorCode`）；有值即多出一句可见交代。 */
  readonly readErrorCode?: string | undefined
  /**
   * **本客户端刚发出、还没结束**的取消请求（store 的 `pluginCancelBusy`）。
   *
   * 与 `busy` 同一口径：只有 `packageName` 命中本行才算「正在取消这一行」。缺席 = 本客户端没在取消。
   */
  readonly cancelBusy?: { readonly packageName: string } | undefined
}

/** 一行的「安装中」投影；`undefined` = 这一行没有正在进行的安装/卸载。 */
export interface EnterprisePluginProgress {
  readonly phase: EnterprisePluginProgressPhase
  /** 屏幕上那句话：`working` 时是**真阶段文字**，`pending` 时是「正在处理…请求」。 */
  readonly stageText: string
  /** 原始受管态（数据钩子：如实报态，界面与测试都不必反推）。 */
  readonly state: ManagedPluginState
  /** 本方向是不是这个客户端发起的（`false` = 只是观察到本机在装，比如页面刷新时正好撞上）。 */
  readonly owned: boolean
  /**
   * 恒为 `true`：这条链**只给阶段、不给百分比**（见文件头「绝不假装进度」）。
   * 界面据此只画不确定态流光；任何会走满的进度条都属于「假装」。
   */
  readonly indeterminate: true
  /**
   * 此刻**真的**能取消吗（按真状态算，不是恒真也不是恒假）。
   *
   * `true` 只在两个条件同时成立时给出：方向是**安装**、且受管态命中
   * `ENTERPRISE_PLUGIN_CANCELABLE_STATES`（官方取消句柄真实存在的那一格）。界面据此决定
   * 「给一枚真按钮」还是「给一句可见原因」——见 {@link EnterprisePluginProgress.cancelNotice}。
   * 它只描述**这一行的状态**：取消请求已经在路上时（`canceling`）它仍然是 `true`（状态没变），
   * 界面把那枚按钮留着、置为不可用即可，**不**把入口整枚撤掉。
   */
  readonly cancelable: boolean
  /** 本客户端刚发出的取消请求还在路上（`cancelBusy` 命中本行）：按钮置为不可用并播报「正在取消…」。 */
  readonly canceling: boolean
  /**
   * 「现在不能取消」或「正在取消」的**可见**交代；`undefined` = 现在能取消（那枚按钮自己把话说清）。
   *
   * 两个分支刻意分开：不能取消时是**原因**（什么时候可以 / 为什么这条路没有取消面），
   * 正在取消时是**进行态**（界面另以 `role="status"` 播报，且按钮保持可见但不可用）。
   */
  readonly cancelNotice: string | undefined
  /** 进度读不到时的可见交代；`undefined` = 这一路正常。 */
  readonly readFailedNotice?: string | undefined
}

/** 卸载方向（由真状态或我们发出的动作方向判定）。 */
function progressAction(input: EnterprisePluginProgressInput, owned: boolean): EnterprisePluginAction {
  if (owned) return input.busy!.action
  return input.state === 'REMOVE_PENDING' || input.state === 'REMOVING' ? 'remove' : 'install'
}

/**
 * 「现在为什么取消不了」那一句（纯查表，只有一个入口，故两处渲染取到同一个词）。
 *
 * 四个分支对应四种**不同**的事实：请求刚提交（句柄还没交出来）、已报到在途工序但还没到
 * 挂句柄那一步、卸载方向压根没有取消面、以及启用/停用（本机开关切换，从来没有取消面）。
 * 它们各说各的真话，不合并成一句含糊的「暂不可取消」。
 */
function cancelNoticeText(action: EnterprisePluginAction, phase: EnterprisePluginProgressPhase): string {
  if (action === 'remove') return ENTERPRISE_PLUGIN_PROGRESS_CANCEL_REMOVE
  if (action === 'enable' || action === 'disable') return ENTERPRISE_PLUGIN_PROGRESS_CANCEL_SWITCH
  return phase === 'pending' ? ENTERPRISE_PLUGIN_PROGRESS_CANCEL_PENDING : ENTERPRISE_PLUGIN_PROGRESS_CANCEL_EARLY
}

/** 请求已提交、Host 还没报到在途阶段时那句话的唯一取值表（四个方向各一句，见常量注释）。 */
function pendingStageText(action: EnterprisePluginAction): string {
  if (action === 'remove') return ENTERPRISE_PLUGIN_PROGRESS_PENDING_REMOVE
  if (action === 'disable') return ENTERPRISE_PLUGIN_PROGRESS_PENDING_DISABLE
  if (action === 'enable') return ENTERPRISE_PLUGIN_PROGRESS_PENDING_ENABLE
  return ENTERPRISE_PLUGIN_PROGRESS_PENDING_INSTALL
}

/**
 * 一行插件的**安装中**投影（纯函数，测试直调）。
 *
 * 判定只有两件现场事实，且都真的来自 Host：
 *   ①「有工序在跑」= 受管态命中 `ENTERPRISE_PLUGIN_PROGRESS_STATES`（Host 每个阶段都写过这条记录）；
 *   ②「是我们刚点的」= `busy.packageName` 命中这一行（请求还没结束）。
 * ①缺席而②在场 = 请求已提交、Host 还没报到在途阶段 ⇒ `pending`（**不**编一个假阶段出来）。
 * 已经收束到终态（`FAILED`）时整段返回 `undefined`：那一行的收束由失败提示组件负责，不叠「正在处理」。
 * 取消三件（`cancelable` / `canceling` / `cancelNotice`）也都只从这三件现场事实推出来，不猜、不恒真，
 * 判据与理由写在 `ENTERPRISE_PLUGIN_CANCELABLE_STATES` 与 `cancelNoticeText` 旁边。
 *
 * @param input - 见 {@link EnterprisePluginProgressInput}。
 * @returns 进度投影；`undefined` = 这一行没有正在进行的安装/卸载。
 */
export function enterprisePluginProgress(input: EnterprisePluginProgressInput): EnterprisePluginProgress | undefined {
  const owned = input.busy !== undefined && input.busy.packageName === input.packageName
  const working = ENTERPRISE_PLUGIN_PROGRESS_STATES.includes(input.state)
  // 没有在途阶段可报、又不是我们发起的动作 ⇒ 这一行没有安装在进行（**不**给静态行挂进度）。
  if (!working && !owned) return undefined
  // 已经失败：收束交给唯一提示组件（`role="alert"` + 稳定码），再叠一句「正在处理」只会自相矛盾。
  if (!working && input.state === 'FAILED') return undefined
  const action = progressAction(input, owned)
  const phase: EnterprisePluginProgressPhase = working ? 'working' : 'pending'
  // 取消这一族的三枚事实都按**真状态**算：句柄在不在（`cancelable`）、本客户端的取消请求在不在路上
  // （`canceling`，只认命中本行的那一份）、以及取消不了时**为什么**（`cancelNotice`）。
  const canceling = input.cancelBusy !== undefined && input.cancelBusy.packageName === input.packageName
  // `cancelable` 说的是**这一行的真状态**（官方句柄在不在），与「我们是不是已经请它取消了」无关：
  // 取消请求在途时这一行**仍然**是可取消那一格，界面据此把那枚按钮留着并置为不可用（`canceling`），
  // 而不是把按钮整枚撤掉——那样用户会以为取消入口消失了。
  const cancelable = action === 'install' && ENTERPRISE_PLUGIN_CANCELABLE_STATES.includes(input.state)
  return {
    phase,
    stageText: working
      ? input.stageText
      : pendingStageText(action),
    state: input.state,
    owned,
    indeterminate: true,
    cancelable,
    canceling,
    cancelNotice: canceling
      ? ENTERPRISE_PLUGIN_PROGRESS_CANCELLING
      : cancelable ? undefined : cancelNoticeText(action, phase),
    ...(input.readErrorCode === undefined ? {} : { readFailedNotice: ENTERPRISE_PLUGIN_PROGRESS_READ_FAILED }),
  }
}

/**
 * 一次安装/卸载**收束后**那句可见交代（纯函数，测试直调）。
 *
 * 与进度分开是刻意的：进度是「正在发生」，交代是「已经发生、接下来要做什么」。
 * 失败**不**在这里出句子——它的收束是唯一提示组件 + 可重试的那枚开关，本层不替它说话。
 * 只认命中本行的那一份事实，故别的行、过期的动作都不会把这句话挂错地方。
 */
export function enterprisePluginSettledNotice(input: {
  readonly packageName: string
  readonly settled?: EnterprisePluginSettledFact | undefined
}): string | undefined {
  const settled = input.settled
  if (settled === undefined || settled.packageName !== input.packageName) return undefined
  const restart = settled.state === 'RESTART_REQUIRED'
  if (settled.action === 'install') {
    if (settled.state === 'ACTIVE') return ENTERPRISE_PLUGIN_SETTLED_INSTALLED
    if (restart) return ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART
    return undefined
  }
  // 启用 / 停用：**关掉是停用，不是卸载**——这两句里一个「卸载」字都没有，
  // 且都明说插件仍装在本机（注销/卸载的口径归 `remove` 那一支）。
  if (settled.action === 'disable') {
    if (restart) return ENTERPRISE_PLUGIN_SETTLED_DISABLED_RESTART
    return settled.state === 'ACTIVE' ? ENTERPRISE_PLUGIN_SETTLED_DISABLED : undefined
  }
  if (settled.action === 'enable') {
    if (restart) return ENTERPRISE_PLUGIN_SETTLED_ENABLED_RESTART
    return settled.state === 'ACTIVE' ? ENTERPRISE_PLUGIN_SETTLED_ENABLED : undefined
  }
  if (settled.state === 'EXPECTED' || restart) return ENTERPRISE_PLUGIN_SETTLED_REMOVED
  return undefined
}
