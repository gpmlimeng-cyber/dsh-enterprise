/**
 * [INPUT]: 依赖同源 JSON API 和宿主事件触发的状态读取
 * [OUTPUT]: 提供按需账号/插件操作、明确的地址保存结果与共享 snapshot；仅登录期间有界查询；原样承载宿主在 AUTHORIZING 下发的 `authorizeUrl`（不产生副作用，由登录弹窗消费） **本刀（企业插件安装的动态过程效果）**：新增「安装中」的**真进度**轮询——动作在途时按 `ENTERPRISE_PLUGIN_PROGRESS_POLL_MS` 反复读**我们自己那条只读** `GET /plugins`（Host 每走一步工序都先写真实受管态、这条路由同步投影它），把 Host 真走到的阶段刷进快照；`pluginSettled` 记动作收束时的**真实受管态**（收束交代的唯一真源）；`pluginProgressErrorCode` 单独承载「进度这一路读不到」（**不**改写 `pluginErrorCode`，因为读不到进度不等于安装失败，且下一拍会自愈重读）；装完自停（`#pluginProgressActive` 判据），store 卸载时也停表。
 * [POS]: dsh-ui 的浏览器状态控制器，在官方 slot 与 Settings tabs 间共享事实且隔离网络细节 **本刀**：进度轮询只读、可达、有界（在途才轮、无工序即停），并刻意与动作成败解耦。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  EnterpriseAccountBootstrap,
  EnterpriseLocalApi,
  EnterpriseLocalStatus,
  EnterprisePluginStatus,
  EnterpriseRemoteSession,
  EnterpriseSessionSyncStatus,
} from './local-api.js'
import { enterpriseLocalErrorCode } from './local-api.js'
import {
  ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS,
  ENTERPRISE_PLUGIN_PROGRESS_POLL_MS,
  ENTERPRISE_PLUGIN_PROGRESS_STATES,
  type EnterprisePluginSettledFact,
} from './plugin-install-progress.js'

export type EnterpriseAccountAction = 'configure' | 'login' | 'cancel' | 'logout' | 'uninstall'

export interface EnterpriseAccountSnapshot {
  readonly phase: 'loading' | 'ready' | 'error'
  readonly status?: EnterpriseLocalStatus
  readonly bootstrap?: EnterpriseAccountBootstrap
  readonly pluginStatus?: EnterprisePluginStatus
  readonly pluginsLoading?: boolean
  readonly pluginErrorCode?: string
  readonly pluginBusy?: { readonly action: 'install' | 'remove'; readonly packageName: string }
  /**
   * 刚结束那一次安装/卸载的**落地事实**（按最终真实受管态记下）。
   *
   * 它**不是**乐观猜测也不编造：值取自动作收束后 `pluginStatus.plugins[].state`（Host 真值），
   * 再由 `plugin-install-progress.ts` 的唯一投影翻成「安装完成，重新打开客户端后生效。」这类可见交代。
   * 下一次动作开始时清掉（与配方的 `applied` 回执同一口径）。
   */
  readonly pluginSettled?: EnterprisePluginSettledFact
  /**
   * 「安装中」那一路**进度**读不到时的稳定码。
   *
   * 与动作失败刻意分开：进度是一条**只读轮询**（同源 `GET /plugins`），它读不到**不等于**安装失败——
   * 安装请求仍在本机跑，下一拍还会自动重读（自愈）。故它不改写 `pluginErrorCode`、也不让任何行被判成失败，
   * 只在那一行多出一句可见的「进度暂时读不到…」（失败不静默）。
   */
  readonly pluginProgressErrorCode?: string
  readonly busy?: EnterpriseAccountAction
  readonly errorCode?: string
  readonly uninstallRestartRequested?: boolean
  readonly sessionSync?: EnterpriseSessionSyncStatus
  readonly remoteSessions?: readonly EnterpriseRemoteSession[]
  readonly sessionLoading?: boolean
  readonly sessionErrorCode?: string
  readonly restoreResult?: { readonly restoredSessionId: string; readonly sourceSessionId: string }
}

function connected(status: EnterpriseLocalStatus): boolean {
  return status.state === 'READY' || status.state === 'REFRESHING'
}

/** 引用计数管理请求生命周期；宿主事件只触发本地状态读取，不产生后台企业请求。 */
export class EnterpriseAccountStore {
  readonly #api: EnterpriseLocalApi
  readonly #listeners = new Set<() => void>()
  #snapshot: EnterpriseAccountSnapshot = { phase: 'loading' }
  #lifetime: AbortController | undefined
  #accountRequests = new AbortController()
  #loginTimer: ReturnType<typeof setTimeout> | undefined
  #loginDeadline = 0
  #refreshGeneration = 0
  #bootstrapLoading = false
  #pluginsLoading = false
  /** 「安装中」真进度的轮询状态：是否在轮、代次（作废迟到结果）、当前那一枚定时器、已轮拍数（上限用）。 */
  #pluginPolling = false
  #pluginPollGeneration = 0
  #pluginPollTicks = 0
  #pluginPollTimer: ReturnType<typeof setTimeout> | undefined

  constructor(api: EnterpriseLocalApi) {
    this.#api = api
  }

  /** 只读暴露同源网络边界，供设置页的就地动作（账户后台地址）复用同一实例。 */
  get api(): EnterpriseLocalApi {
    return this.#api
  }

  readonly getSnapshot = (): EnterpriseAccountSnapshot => this.#snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    if (this.#listeners.size === 1) this.#start()
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size === 0) this.#stop()
    }
  }

  /** 加载会话同步状态与远端列表；仅 enabled 时发 Session 请求。 */
  async refreshSessions(): Promise<void> {
    const signal = this.#signal()
    const generation = ++this.#refreshGeneration
    this.#set({ ...this.#snapshot, sessionLoading: true })
    try {
      const sessionSync = await this.#api.sessionSyncStatus(signal)
      if (signal.aborted || generation !== this.#refreshGeneration) return
      this.#set({ ...this.#snapshot, sessionSync, sessionLoading: sessionSync.enabled })
      if (!sessionSync.enabled) {
        this.#set({ ...this.#snapshot, sessionLoading: false, remoteSessions: [] })
        return
      }
      const remoteSessions = await this.#api.listSessions(signal)
      if (signal.aborted || generation !== this.#refreshGeneration) return
      this.#set({ ...this.#snapshot, remoteSessions, sessionLoading: false })
    } catch (error) {
      if (signal.aborted || generation !== this.#refreshGeneration) return
      this.#set({
        ...this.#snapshot,
        sessionLoading: false,
        sessionErrorCode: enterpriseLocalErrorCode(error),
      })
    }
  }

  /** 以新本地会话 ID 恢复远端副本；失败不更新 restoreResult。 */
  async restoreSession(sourceSessionId: string, cwd: string): Promise<boolean> {
    const signal = this.#signal()
    try {
      const restoreResult = await this.#api.restoreSession(sourceSessionId, cwd, signal)
      if (signal.aborted) return false
      this.#set({ ...this.#snapshot, restoreResult })
      await this.refreshSessions()
      return true
    } catch (error) {
      if (!signal.aborted) this.#set({ ...this.#snapshot, sessionErrorCode: enterpriseLocalErrorCode(error) })
      return false
    }
  }

  /** 显式重新读取状态；footer 点击与动作收敛共用该路径。 */
  async refresh(fromPlatform = false): Promise<void> {
    const signal = this.#signal()
    const generation = ++this.#refreshGeneration
    try {
      const status = await (fromPlatform ? this.#api.refresh(signal) : this.#api.status(signal))
      if (!signal.aborted && generation === this.#refreshGeneration) this.#acceptStatus(status)
    } catch (error) {
      if (signal.aborted || generation !== this.#refreshGeneration) return
      this.#set({ ...this.#snapshot, phase: this.#snapshot.status === undefined ? 'error' : 'ready', errorCode: enterpriseLocalErrorCode(error) })
    } finally {
      if (!signal.aborted && generation === this.#refreshGeneration) this.#scheduleLoginPoll()
    }
  }

  /** 只在账号连接可用时重新读取本地受管插件投影。 */
  async refreshPlugins(): Promise<void> {
    if (this.#snapshot.status === undefined || !connected(this.#snapshot.status)) return
    await this.refresh(true)
    if (this.#snapshot.status === undefined || !connected(this.#snapshot.status)) return
    await this.#loadPlugins()
  }

  async installPlugin(packageName: string, pluginVersionId: string): Promise<void> {
    await this.#pluginAction('install', packageName, signal => this.#api.installPlugin(packageName, pluginVersionId, signal))
  }

  async removePlugin(packageName: string): Promise<void> {
    await this.#pluginAction('remove', packageName, signal => this.#api.removePlugin(packageName, signal))
  }

  async #pluginAction(
    action: 'install' | 'remove', packageName: string,
    operation: (signal: AbortSignal) => Promise<EnterprisePluginStatus>,
  ): Promise<void> {
    if (this.#snapshot.pluginBusy !== undefined || this.#snapshot.busy !== undefined
      || this.#snapshot.status === undefined || !connected(this.#snapshot.status)) return
    const signal = this.#accountSignal()
    // 新一次动作开始：清掉上一次的失败码、进度读不到的码与**上一次的落地交代**（交代只属于刚结束的那次）。
    const {
      pluginErrorCode: _error, pluginSettled: _settled, pluginProgressErrorCode: _progress, ...snapshot
    } = this.#snapshot
    this.#set({ ...snapshot, pluginBusy: { action, packageName } })
    // 「安装中」的真进度：请求在途的这段时间里轮询那条只读状态路由，让 Host 真正走到的工序阶段上屏。
    this.#syncPluginProgressPoll()
    let failed = false
    try {
      const pluginStatus = await operation(signal)
      if (!signal.aborted && this.#snapshot.status !== undefined && connected(this.#snapshot.status)) {
        this.#set({ ...this.#snapshot, pluginStatus })
      }
    } catch (error) {
      failed = true
      if (signal.aborted) return
      await this.refresh()
      if (signal.aborted) return
      if (this.#snapshot.status !== undefined && connected(this.#snapshot.status)) await this.#loadPlugins()
      if (!signal.aborted) this.#set({ ...this.#snapshot, pluginErrorCode: enterpriseLocalErrorCode(error) })
    } finally {
      this.#stopPluginProgressPoll()
      if (!signal.aborted) {
        const { pluginBusy: _busy, pluginProgressErrorCode: _progress, ...settled } = this.#snapshot
        const settledFact = failed ? undefined : this.#pluginSettledFact(action, packageName)
        this.#set({ ...settled, ...(settledFact === undefined ? {} : { pluginSettled: settledFact }) })
      }
    }
  }

  /**
   * 一次动作**收束后**的落地事实（真值投影，不猜）。
   *
   * 值就是收束时 `pluginStatus` 里这一行的真实受管态；卸载方向在记录被 Host 删干净
   * （`reconcileAbsent` 的既有行为）时记 `EXPECTED` = 本机不再装着——这是事实，不是乐观值。
   * 只有落在「这次动作真的成功了」的那几个终态上才产出，其余（失败 / 还没到终态）返回 `undefined`，
   * 由失败提示组件或下一次轮询负责。
   */
  #pluginSettledFact(action: 'install' | 'remove', packageName: string): EnterprisePluginSettledFact | undefined {
    const state = this.#snapshot.pluginStatus?.plugins.find(item => item.packageName === packageName)?.state
      ?? (action === 'remove' ? 'EXPECTED' : undefined)
    if (action === 'install') {
      return state === 'ACTIVE' || state === 'RESTART_REQUIRED' ? { action, packageName, state } : undefined
    }
    return state === 'EXPECTED' || state === 'RESTART_REQUIRED' ? { action, packageName, state } : undefined
  }

  /** 现在还有工序要跟吗：本机有动作在途，或只读投影里有任一受管态落在「工序中间」。 */
  #pluginProgressActive(): boolean {
    if (this.#snapshot.pluginBusy !== undefined) return true
    return (this.#snapshot.pluginStatus?.plugins ?? [])
      .some(item => ENTERPRISE_PLUGIN_PROGRESS_STATES.includes(item.state))
  }

  #stopPluginProgressPoll(): void {
    clearTimeout(this.#pluginPollTimer)
    this.#pluginPollTimer = undefined
    this.#pluginPolling = false
    // 代次自增 = 在途的那一拍回来时按过期丢弃（不会回填、也不会再排下一拍）。
    this.#pluginPollGeneration += 1
  }

  /**
   * 「安装中」真进度的轮询：**只读**同源 `GET /plugins`，一次只跑一个循环。
   *
   * 四件事的取舍写在这里：
   *  ① 只读不改：它**不**写任何状态，也**不**参与成功/失败判定（那个由动作本身的响应负责）；
   *  ② 读不到不静默：失败把稳定码写进 `pluginProgressErrorCode`（界面在那一行说「进度暂时读不到…」），
   *     循环**不退出**——下一拍继续重读（自愈），且这个失败**不**影响正在进行的安装；
   *  ③ 自停：一旦没有工序在跑（动作结束且没有任何在途受管态）就停表，不留常驻轮询；
   *  ④ 有界：**只是观察到**本机在途（没有我们自己的动作在飞）时最多轮 `ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS` 拍
   *     ——Host 若在工序中崩过，落盘的受管态会永远停在中间那一格，无界轮询就成了常驻空转；
   *     有界之后进度仍停在最后报到的**真阶段**上（真事实，只是不再推进），下一次刷新/重试重开一轮。
   */
  #syncPluginProgressPoll(): void {
    if (!this.#pluginProgressActive()) {
      this.#stopPluginProgressPoll()
      return
    }
    if (this.#pluginPolling) return
    // 新一轮：计数从零起（上一轮可能因上限或动作收束而停下）。
    if (this.#pluginPollTicks >= ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS) this.#pluginPollTicks = 0
    this.#pluginPolling = true
    const generation = this.#pluginPollGeneration
    const signal = this.#accountSignal()
    const tick = async (): Promise<void> => {
      if (signal.aborted || generation !== this.#pluginPollGeneration || !this.#pluginPolling) return
      if (!this.#pluginProgressActive()) {
        this.#stopPluginProgressPoll()
        return
      }
      try {
        const pluginStatus = await this.#api.plugins(signal)
        if (signal.aborted || generation !== this.#pluginPollGeneration) return
        const { pluginProgressErrorCode: _code, ...rest } = this.#snapshot
        this.#set({ ...rest, pluginStatus })
      } catch (error) {
        if (signal.aborted || generation !== this.#pluginPollGeneration) return
        this.#set({ ...this.#snapshot, pluginProgressErrorCode: enterpriseLocalErrorCode(error) })
      }
      if (signal.aborted || generation !== this.#pluginPollGeneration || !this.#pluginPolling) return
      // 只有「观察到」的那种在途才计数：我们自己的动作在飞时不设上限（动作收束自然会停）。
      if (this.#snapshot.pluginBusy === undefined) this.#pluginPollTicks += 1
      if (this.#snapshot.pluginBusy === undefined && this.#pluginPollTicks >= ENTERPRISE_PLUGIN_PROGRESS_MAX_IDLE_TICKS) {
        this.#stopPluginProgressPoll()
        return
      }
      this.#pluginPollTimer = setTimeout(() => { void tick() }, ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
    }
    this.#pluginPollTimer = setTimeout(() => { void tick() }, ENTERPRISE_PLUGIN_PROGRESS_POLL_MS)
  }

  async startLogin(): Promise<void> {
    await this.#action('login', signal => this.#api.startLogin(signal))
  }

  async setServerUrl(serverUrl: string): Promise<boolean> {
    return this.#action('configure', signal => this.#api.setServerUrl(serverUrl, signal))
  }

  async cancelLogin(): Promise<void> {
    await this.#action('cancel', signal => this.#api.cancelLogin(signal))
  }

  async logout(): Promise<void> {
    await this.#action('logout', signal => this.#api.logout(signal))
  }

  async uninstall(): Promise<void> {
    await this.#action('uninstall', async signal => {
      const result = await this.#api.uninstall(signal)
      this.#set({ ...this.#snapshot, uninstallRestartRequested: result.restartRequested })
    })
  }

  #start(): void {
    this.#lifetime = new AbortController()
    void this.refresh()
  }

  #stop(): void {
    this.#lifetime?.abort()
    this.#lifetime = undefined
    this.#resetAccountRequests()
    // 卸载 store（最后一个订阅者走人）时也把「安装中」的进度轮询停掉，不留常驻定时器。
    this.#stopPluginProgressPoll()
    clearTimeout(this.#loginTimer)
    this.#loginTimer = undefined
    this.#loginDeadline = 0
  }

  #scheduleLoginPoll(): void {
    clearTimeout(this.#loginTimer)
    this.#loginTimer = undefined
    const state = this.#snapshot.status?.state
    if (state !== 'AUTHORIZING' && state !== 'ENROLLING' && state !== 'BOOTSTRAPPING') {
      this.#loginDeadline = 0
      return
    }
    if (this.#listeners.size === 0) return
    // 与 Host 的五分钟授权窗口对齐；本机断连时也不会无限轮询。
    if (this.#loginDeadline === 0) this.#loginDeadline = Date.now() + 330_000
    if (Date.now() >= this.#loginDeadline) return
    this.#loginTimer = setTimeout(() => { void this.refresh() }, 1_000)
  }

  #signal(): AbortSignal {
    if (this.#lifetime === undefined) this.#lifetime = new AbortController()
    return this.#lifetime.signal
  }

  #accountSignal(): AbortSignal {
    return AbortSignal.any([this.#signal(), this.#accountRequests.signal])
  }

  #resetAccountRequests(): void {
    this.#accountRequests.abort()
    this.#accountRequests = new AbortController()
    this.#bootstrapLoading = this.#pluginsLoading = false
  }

  async #action(
    action: EnterpriseAccountAction,
    operation: (signal: AbortSignal) => Promise<unknown>,
  ): Promise<boolean> {
    if (this.#snapshot.busy !== undefined || this.#snapshot.pluginBusy !== undefined) return false
    const signal = this.#signal()
    const { errorCode: _errorCode, ...withoutError } = this.#snapshot
    this.#set({ ...withoutError, busy: action })
    try {
      await operation(signal)
      if (!signal.aborted && action !== 'uninstall') await this.refresh()
      return !signal.aborted
    } catch (error) {
      if (!signal.aborted && action === 'logout') await this.refresh()
      if (!signal.aborted) this.#set({ ...this.#snapshot, errorCode: enterpriseLocalErrorCode(error) })
      return false
    } finally {
      if (!signal.aborted) {
        const { busy: _busy, ...settled } = this.#snapshot
        this.#set(settled)
      }
    }
  }

  /**
   * 宿主在 AUTHORIZING 期间下发的授权 URL 只由登录弹窗消费（弹窗内 iframe 直接渲染授权页），
   * 因此这里不产生任何副作用：状态本身已带该字段，store 只负责原样承载。
   */
  #acceptStatus(status: EnterpriseLocalStatus): void {
    const previousStatus = this.#snapshot.status
    const accountChanged = previousStatus === undefined || connected(previousStatus) !== connected(status)
      || previousStatus.platformUrl !== status.platformUrl || previousStatus.user?.id !== status.user?.id
    if (accountChanged) this.#resetAccountRequests()
    const retain = connected(status) && !accountChanged
    const reload = connected(status) && (accountChanged || previousStatus?.revision !== status.revision)
    this.#set({
      phase: 'ready',
      status,
      ...(retain && this.#snapshot.bootstrap !== undefined
        ? { bootstrap: this.#snapshot.bootstrap }
        : {}),
      ...(retain && this.#snapshot.pluginStatus !== undefined
        ? { pluginStatus: this.#snapshot.pluginStatus }
        : {}),
      ...(retain && this.#snapshot.pluginsLoading === true ? { pluginsLoading: true } : {}),
      ...(retain && this.#snapshot.pluginErrorCode !== undefined
        ? { pluginErrorCode: this.#snapshot.pluginErrorCode }
        : {}),
      ...(retain && this.#snapshot.pluginBusy !== undefined ? { pluginBusy: this.#snapshot.pluginBusy } : {}),
      // 「落地交代」与「进度读不到的码」与已取到的受管态同生共死：同一次动作的两条尾巴，掉一个另一个就没主了。
      ...(retain && this.#snapshot.pluginSettled !== undefined ? { pluginSettled: this.#snapshot.pluginSettled } : {}),
      ...(retain && this.#snapshot.pluginProgressErrorCode !== undefined
        ? { pluginProgressErrorCode: this.#snapshot.pluginProgressErrorCode }
        : {}),
      ...(this.#snapshot.busy === undefined ? {} : { busy: this.#snapshot.busy }),
      ...(status.errorCode === undefined ? {} : { errorCode: status.errorCode }),
    })
    if (reload) {
      void this.#loadBootstrap()
      void this.#loadPlugins()
    }
  }

  async #loadBootstrap(): Promise<void> {
    if (this.#bootstrapLoading) return
    this.#bootstrapLoading = true
    const signal = this.#accountSignal()
    try {
      const bootstrap = await this.#api.bootstrap(signal)
      if (!signal.aborted && bootstrap !== undefined && this.#snapshot.status !== undefined
        && connected(this.#snapshot.status)) {
        this.#set({ ...this.#snapshot, bootstrap })
      }
    } catch (error) {
      if (!signal.aborted) this.#set({ ...this.#snapshot, errorCode: enterpriseLocalErrorCode(error) })
    } finally {
      if (!signal.aborted) this.#bootstrapLoading = false
    }
  }

  async #loadPlugins(): Promise<void> {
    if (this.#pluginsLoading) return
    this.#pluginsLoading = true
    const signal = this.#accountSignal()
    const { pluginErrorCode: _pluginErrorCode, ...withoutError } = this.#snapshot
    this.#set({ ...withoutError, pluginsLoading: true })
    try {
      const pluginStatus = await this.#api.plugins(signal)
      if (!signal.aborted && this.#snapshot.status !== undefined && connected(this.#snapshot.status)) {
        const { pluginsLoading: _pluginsLoading, ...settled } = this.#snapshot
        this.#set({ ...settled, pluginStatus })
        // 取回来的投影里若已经有工序在跑（例如页面刷新时正好撞上一次安装），进度轮询从这一刻接上：
        // 界面于是看得见**真的**阶段推进，而不是一条冻在某一格的静态文字。
        this.#syncPluginProgressPoll()
      }
    } catch (error) {
      if (!signal.aborted) {
        const { pluginsLoading: _pluginsLoading, ...settled } = this.#snapshot
        this.#set({ ...settled, pluginErrorCode: enterpriseLocalErrorCode(error) })
      }
    } finally {
      if (!signal.aborted) this.#pluginsLoading = false
    }
  }

  #set(snapshot: EnterpriseAccountSnapshot): void {
    this.#snapshot = snapshot
    for (const listener of this.#listeners) listener()
  }
}
