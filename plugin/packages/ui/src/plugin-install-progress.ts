/**
 * [INPUT]: 只依赖 `local-api-decode.ts` 的受管态类型（不读网络、不读 React、不读宿主路径；也不需要 import 运行时值）
 * [OUTPUT]: 企业插件安装/卸载的**真进度**唯一投影 `enterprisePluginProgress`、**落地交代**唯一投影 `enterprisePluginSettledNotice`、在途受管态清单 `ENTERPRISE_PLUGIN_PROGRESS_STATES`、轮询间隔 `ENTERPRISE_PLUGIN_PROGRESS_POLL_MS` 与那一组可见文案常量
 * [POS]: ui 员工侧「安装中」这件事的**唯一口径真源**——`marketplace-entry.tsx`（官方插件页里的插件市场，插件行）与 `plugin-market.tsx`（企业设置 → 插件，卡片行 + 详情）两处渲染都只调这一份，阶段文字更只有一份（`plugin-market.tsx` 的官方状态词表 `enterprisePluginStatePresentation`），故两处不可能各说一套。
 *
 * **真进度从哪来（本仓唯一一条可达的路，已按实物核实）**：
 *   ① 本仓的受管插件安装**不**走官方 `pluginManager`——`bundle/src/index.ts:551` 的 `pluginAction` 端口转给
 *      `plugin-distribution/src/service.ts:203` 的 `install()`，后者经 `reconcileInstalled`（同文件 `:430`）
 *      调 `installManagedPlugin`（`dsh plugin` 子进程）。官方那套 `plugin-manager/install-state` /
 *      `install-log` 事件与 `waitForInstall` / `cancelInstall` 因此**对这个安装面一次都不会触发**：
 *      没有 requestId 可等、也没有可取消的句柄。把 `cancelInstall` 画成按钮就是假按钮。
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
 * **不给假取消**：`cancelable` 恒为 `false`（上游没有可达的取消面，见①），并把「不能取消」写成
 * 一句**可见**交代，而不是画一枚点了没用的按钮。
 *
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

/** 请求已提交、Host 还没报到在途阶段时的那句话（安装方向）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_PENDING_INSTALL = '正在处理安装请求…'
/** 同上（卸载方向）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_PENDING_REMOVE = '正在处理卸载请求…'

/**
 * 「这一步不能取消」的**可见**交代。
 *
 * 为什么是交代而不是按钮：官方 `cancelInstall` 只对官方 pluginManager 自己发起的安装有效，
 * 而本仓的受管插件安装走 `dsh plugin` 子进程（见文件头①）——上游没有把取消面交出来，
 * 画一枚点了没用的「取消」正是产品宪法禁止的假控件。于是把话说明白。
 */
export const ENTERPRISE_PLUGIN_PROGRESS_CANCEL_NOTICE = '这一步开始后不能取消，完成后会在这里告诉你结果。'

/** 进度这一路读不到时的可见交代（安装本身仍在进行，下一拍会自动重读）。 */
export const ENTERPRISE_PLUGIN_PROGRESS_READ_FAILED = '进度暂时读不到，安装仍在进行，稍后会自动重读。'

/** 安装完成且已经生效。 */
export const ENTERPRISE_PLUGIN_SETTLED_INSTALLED = '安装完成，已经生效。'
/** 安装完成、需要重新打开客户端才生效（本机受管插件的常规收束）。 */
export const ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART = '安装完成，重新打开客户端后生效。'
/** 卸载完成（本机的受管插件模块要重新加载才真正退场）。 */
export const ENTERPRISE_PLUGIN_SETTLED_REMOVED = '卸载完成，重新打开客户端后生效。'

/** 「安装中」这一段进度的两个相位。 */
export type EnterprisePluginProgressPhase = 'pending' | 'working'

/** 一次安装/卸载动作**刚从本客户端发出**（store 的 `pluginBusy`）。 */
export interface EnterprisePluginBusyFact {
  readonly action: 'install' | 'remove'
  readonly packageName: string
}

/** 一次安装/卸载动作**已经收束**的落地事实（store 在动作 finally 里按最终受管态记下）。 */
export interface EnterprisePluginSettledFact {
  readonly action: 'install' | 'remove'
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
  /** 恒为 `false`：上游没有可达的取消面，界面**不给**取消按钮。 */
  readonly cancelable: false
  /** 「不能取消」那句可见交代（恒有）。 */
  readonly cancelNotice: string
  /** 进度读不到时的可见交代；`undefined` = 这一路正常。 */
  readonly readFailedNotice?: string | undefined
}

/** 卸载方向（由真状态或我们发出的动作方向判定）。 */
function progressAction(input: EnterprisePluginProgressInput, owned: boolean): 'install' | 'remove' {
  if (owned) return input.busy!.action
  return input.state === 'REMOVE_PENDING' || input.state === 'REMOVING' ? 'remove' : 'install'
}

/**
 * 一行插件的**安装中**投影（纯函数，测试直调）。
 *
 * 判定只有两件现场事实，且都真的来自 Host：
 *   ①「有工序在跑」= 受管态命中 `ENTERPRISE_PLUGIN_PROGRESS_STATES`（Host 每个阶段都写过这条记录）；
 *   ②「是我们刚点的」= `busy.packageName` 命中这一行（请求还没结束）。
 * ①缺席而②在场 = 请求已提交、Host 还没报到在途阶段 ⇒ `pending`（**不**编一个假阶段出来）。
 * 已经收束到终态（`FAILED`）时整段返回 `undefined`：那一行的收束由失败提示组件负责，不叠「正在处理」。
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
  return {
    phase: working ? 'working' : 'pending',
    stageText: working
      ? input.stageText
      : action === 'remove' ? ENTERPRISE_PLUGIN_PROGRESS_PENDING_REMOVE : ENTERPRISE_PLUGIN_PROGRESS_PENDING_INSTALL,
    state: input.state,
    owned,
    indeterminate: true,
    cancelable: false,
    cancelNotice: ENTERPRISE_PLUGIN_PROGRESS_CANCEL_NOTICE,
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
  if (settled.action === 'install') {
    if (settled.state === 'ACTIVE') return ENTERPRISE_PLUGIN_SETTLED_INSTALLED
    if (settled.state === 'RESTART_REQUIRED') return ENTERPRISE_PLUGIN_SETTLED_INSTALLED_RESTART
    return undefined
  }
  if (settled.state === 'EXPECTED' || settled.state === 'RESTART_REQUIRED') return ENTERPRISE_PLUGIN_SETTLED_REMOVED
  return undefined
}
