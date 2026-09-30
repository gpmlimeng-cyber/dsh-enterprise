/**
 * [INPUT]: 只依赖宿主注入的全局载体形状（`globalThis.dshDesktopActions` 与 `globalThis.dshDesktop`），不导入官方类型、不打进第二份实现，也不自造任何 IPC 通道
 * [OUTPUT]: 对外提供桌面能力探测 `enterpriseDesktopActions`/`createEnterpriseDesktopSource`、更新状态只读源 `createEnterpriseUpdateSource`（status 取一次初值 + subscribe 订阅，无轮询）、严格状态解码 `decodeEnterpriseUpdatePresentation`、右侧「状态标签 + 快捷按钮」两件事的映射 `enterpriseUpdateTrailing`（含 idle 的 `enterpriseUpdateIdleState`）与九个 failure 的中文文案，以及重载/重启的唯一执行口径 `runEnterpriseReload`/`runEnterpriseRestart`
 * [POS]: dsh-ui 的桌面运行时接缝。两个 app 的能力不同（Harness 0.2.0-rc.2 只有 `dshDesktop.updates`，动作白名单只在 fork 的 `dshDesktopActions` 里），所以这里逐项特性检测、把「能就显示、不能就隐藏」收敛成纯判定：视图层只消费事实，不猜通道
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 官方 fork 动作白名单里本插件用到的两项（`reload` / `restart`，均无参）。 */
export type EnterpriseDesktopAction = 'reload' | 'restart'

/**
 * 渲染进程动作接缝。Harness.app（0.2.0-rc.2）asar 内没有任何 renderer-action 通道，
 * 探测结果就是 undefined；只有 fork（DSH Desktop.app）才提供它。
 */
export interface EnterpriseDesktopActions {
  invoke(action: EnterpriseDesktopAction): Promise<unknown>
}

/** 全局载体只声明我们真正探测的两个字段：宿主实物可以是任何形状，未知即降级。 */
export interface EnterpriseDesktopScope {
  readonly dshDesktopActions?: unknown
  readonly dshDesktop?: unknown
}

function defaultScope(): EnterpriseDesktopScope {
  return globalThis as unknown as EnterpriseDesktopScope
}

/**
 * 重载/重启的能力探测：只有 `dshDesktopActions.invoke` 可调用才算有桌面动作面。
 * 纯 Web（`globalThis` 上没有这一项）与 Harness.app 都得到 undefined，行项据此隐藏，
 * 绝不退回自己拼 IPC 通道。
 */
export function enterpriseDesktopActions(
  scope: EnterpriseDesktopScope = defaultScope(),
): EnterpriseDesktopActions | undefined {
  const carrier = scope.dshDesktopActions
  if (typeof carrier !== 'object' || carrier === null) return undefined
  const invoke = (carrier as { readonly invoke?: unknown }).invoke
  if (typeof invoke !== 'function') return undefined
  const call = (invoke as (...args: unknown[]) => unknown).bind(carrier)
  return { invoke: async action => call(action) }
}

/** 官方更新状态机的相位全集（0.2.0-rc.2 ui-settings-general 的 updateCopy 映射）。 */
export const ENTERPRISE_UPDATE_PHASES = [
  'idle',
  'checking',
  'available',
  'downloading',
  'verifying',
  'installing',
  'ready',
  'error',
] as const

export type EnterpriseUpdatePhase = typeof ENTERPRISE_UPDATE_PHASES[number]

/** 官方九类失败码；文案逐条取官方 zh 词表 `desktop.update.*`，不自造第二套词汇。 */
export const ENTERPRISE_UPDATE_FAILURES = [
  'check',
  'check-network',
  'download',
  'download-network',
  'install',
  'install-network',
  'stop-failed',
  'tasks-changed',
  'tasks-unavailable',
] as const

export type EnterpriseUpdateFailure = typeof ENTERPRISE_UPDATE_FAILURES[number]

/**
 * 官方 `dshDesktop.updates` 推送的呈现事实。官方没有 `currentVersion`/`releaseNotes`
 * （「当前版本」是编译期字面量），因此这里也不留这两个字段。
 */
export interface EnterpriseUpdatePresentation {
  readonly phase: EnterpriseUpdatePhase
  readonly version?: string | undefined
  readonly percent?: number | undefined
  readonly failure?: string | undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function enterpriseUpdatePhase(value: unknown): EnterpriseUpdatePhase | undefined {
  return ENTERPRISE_UPDATE_PHASES.find(phase => phase === value)
}

/** 严格解码：相位不认识就整条丢弃；百分比收敛到 0–100，非有限数当没有。 */
export function decodeEnterpriseUpdatePresentation(value: unknown): EnterpriseUpdatePresentation | undefined {
  if (!isRecord(value)) return undefined
  const phase = enterpriseUpdatePhase(value['phase'])
  if (phase === undefined) return undefined
  const version = value['version']
  const percent = value['percent']
  const failure = value['failure']
  return {
    phase,
    ...(typeof version === 'string' && version !== '' ? { version } : {}),
    ...(typeof percent === 'number' && Number.isFinite(percent)
      ? { percent: Math.min(100, Math.max(0, percent)) }
      : {}),
    ...(typeof failure === 'string' && failure !== '' ? { failure } : {}),
  }
}

const UPDATE_FAILURE_TEXTS: Readonly<Record<EnterpriseUpdateFailure, string>> = {
  check: '检查更新失败，请稍后重试。',
  'check-network': '检查更新失败，请检查网络连接后重试。',
  download: '下载更新失败，请重试。',
  'download-network': '下载更新失败，请检查网络连接后重试。',
  install: '安装更新失败，请稍后重试。',
  'install-network': '安装更新失败，请检查网络连接后重试。',
  'stop-failed': '未能安全停止任务，更新尚未安装，请稍后重试。',
  'tasks-changed': '有新任务开始运行，请重新确认是否停止任务并更新。',
  'tasks-unavailable': '无法确认任务状态，请在工作区就绪后重试更新。',
}

/** 失败码到中文文案：不认识或没给一律走官方默认的 install 口径，不透传原始字符串。 */
export function enterpriseUpdateFailureText(failure: string | undefined): string {
  const known = ENTERPRISE_UPDATE_FAILURES.find(code => code === failure)
  return UPDATE_FAILURE_TEXTS[known ?? 'install']
}

export type EnterpriseUpdateAction = 'open' | 'none'

/**
 * 右侧控件的全部呈现事实：**状态标签**（弱化色）与**快捷按钮**两件事，谁都不重复行标签「检查更新」。
 *
 * `actionLabel` 缺席即没有第二入口（忙相位只读）；`disabled` 同时管行与按钮。
 * `stateTitle` 只在失败相位的长文案上用（行内省略号截断时兜住完整原因）。
 */
export interface EnterpriseUpdateTrailing {
  readonly state: string
  readonly stateTitle?: string | undefined
  readonly action: EnterpriseUpdateAction
  readonly actionLabel?: string | undefined
  readonly disabled: boolean
}

/** idle 右侧的「最近状态」：本进程还没检查过说「未检查」，检查过一轮没更新说「已是最新」。 */
export function enterpriseUpdateIdleState(checked: boolean): string {
  return checked ? '已是最新' : '未检查'
}

/**
 * 相位 → 右侧映射（队列第 3 项修订后的口径）：
 * idle=最近状态 + 「检查」／checking=「检查中…」（无按钮，禁用）／available=「有可用更新 <版本>」+「更新」／
 * downloading·verifying·installing=「下载中 N%」「校验中」「安装中」（无按钮，禁用）／ready=「已下载，待重启」+「重启安装」／
 * error=失败中文文案 + 「重试」。
 *
 * 行标签恒为「检查更新」，因此这里的 `state` 与 `actionLabel` 都不得等于它——失败原因也不再顶到行标签上。
 */
export function enterpriseUpdateTrailing(
  presentation: EnterpriseUpdatePresentation | undefined,
  checked = false,
): EnterpriseUpdateTrailing {
  if (presentation === undefined) {
    return { action: 'open', actionLabel: '检查', disabled: false, state: enterpriseUpdateIdleState(checked) }
  }
  switch (presentation.phase) {
    case 'idle':
      return { action: 'open', actionLabel: '检查', disabled: false, state: enterpriseUpdateIdleState(checked) }
    case 'checking':
      return { action: 'none', disabled: true, state: '检查中…' }
    case 'available':
      return {
        action: 'open',
        actionLabel: '更新',
        disabled: false,
        state: presentation.version === undefined ? '有可用更新' : `有可用更新 ${presentation.version}`,
      }
    case 'downloading':
      return { action: 'none', disabled: true, state: `下载中 ${presentation.percent ?? 0}%` }
    case 'verifying':
      return { action: 'none', disabled: true, state: '校验中' }
    case 'installing':
      return { action: 'none', disabled: true, state: '安装中' }
    case 'ready':
      return { action: 'open', actionLabel: '重启安装', disabled: false, state: '已下载，待重启' }
    case 'error': {
      const failure = enterpriseUpdateFailureText(presentation.failure)
      return { action: 'open', actionLabel: '重试', disabled: false, state: failure, stateTitle: failure }
    }
  }
}

/** 只读更新状态源；不可用时就是 `ENTERPRISE_UPDATE_ABSENT`，行项整条隐藏。 */
export interface EnterpriseUpdateSource {
  readonly available: boolean
  getSnapshot(): EnterpriseUpdatePresentation | undefined
  subscribe(listener: () => void): () => void
  /** 官方 phase 驱动的唯一入口：idle→检查、available→下载、ready→quitAndInstall。 */
  open(): void
  dispose(): void
}

export const ENTERPRISE_UPDATE_ABSENT: EnterpriseUpdateSource = {
  available: false,
  dispose: () => undefined,
  getSnapshot: () => undefined,
  open: () => undefined,
  subscribe: () => () => undefined,
}

interface EnterpriseUpdateCarrier {
  readonly open: () => Promise<unknown> | unknown
  readonly status?: (() => Promise<unknown>) | undefined
  readonly subscribe?: ((listener: (presentation: unknown) => void) => unknown) | undefined
}

/**
 * 更新通道探测：`protocolVersion === 1` 且 `updates.open` 可调用才算可用。
 * 非 product 帧只给 `{ protocolVersion: 1 }`，所以两个条件缺一不可。
 */
function updateCarrier(scope: EnterpriseDesktopScope): EnterpriseUpdateCarrier | undefined {
  const carrier = scope.dshDesktop
  if (typeof carrier !== 'object' || carrier === null) return undefined
  const desktop = carrier as { readonly protocolVersion?: unknown; readonly updates?: unknown }
  if (desktop.protocolVersion !== 1) return undefined
  const updates = desktop.updates
  if (typeof updates !== 'object' || updates === null) return undefined
  const port = updates as { readonly open?: unknown; readonly status?: unknown; readonly subscribe?: unknown }
  if (typeof port.open !== 'function') return undefined
  const open = (port.open as (...args: unknown[]) => unknown).bind(updates) as () => Promise<unknown>
  const status = typeof port.status === 'function'
    ? (port.status as (...args: unknown[]) => unknown).bind(updates) as () => Promise<unknown>
    : undefined
  const subscribe = typeof port.subscribe === 'function'
    ? (port.subscribe as (...args: unknown[]) => unknown).bind(updates) as (
      listener: (presentation: unknown) => void,
    ) => unknown
    : undefined
  return {
    open,
    ...(status === undefined ? {} : { status }),
    ...(subscribe === undefined ? {} : { subscribe }),
  }
}

/**
 * 官方更新的只读镜像：`status()` 取一次初值，此后全部由 `subscribe(cb)` 推送——**不轮询**。
 * 订阅先到就赢（`received`），迟到的 status 不再覆盖；`dispose()` 后不再发布也不再看推送，
 * 与官方 DesktopUpdateSource 的时序口径一致（卸载时取消订阅）。
 */
export function createEnterpriseUpdateSource(
  scope: EnterpriseDesktopScope = defaultScope(),
): EnterpriseUpdateSource {
  const carrier = updateCarrier(scope)
  if (carrier === undefined) return ENTERPRISE_UPDATE_ABSENT
  let live = true
  let received = false
  let presentation: EnterpriseUpdatePresentation | undefined
  const listeners = new Set<() => void>()
  const publish = (value: unknown): void => {
    const next = decodeEnterpriseUpdatePresentation(value)
    if (!live || next === undefined) return
    presentation = next
    for (const listener of [...listeners]) listener()
  }
  const off = carrier.subscribe?.((value) => {
    if (!live) return
    received = true
    publish(value)
  })
  if (carrier.status !== undefined) {
    void carrier.status().then(value => { if (live && !received) publish(value) }, () => undefined)
  }
  return {
    available: true,
    dispose: () => {
      live = false
      if (typeof off === 'function') (off as () => void)()
      listeners.clear()
    },
    getSnapshot: () => presentation,
    open: () => { if (live) void Promise.resolve(carrier.open()).catch(() => undefined) },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/** 桌面能力面：动作与更新各自独立探测，任何一半缺席都不影响另一半。 */
export interface EnterpriseDesktopSource {
  readonly actions: EnterpriseDesktopActions | undefined
  readonly updates: EnterpriseUpdateSource
}

export const ENTERPRISE_DESKTOP_ABSENT: EnterpriseDesktopSource = {
  actions: undefined,
  updates: ENTERPRISE_UPDATE_ABSENT,
}

export function createEnterpriseDesktopSource(
  scope: EnterpriseDesktopScope = defaultScope(),
): EnterpriseDesktopSource {
  return { actions: enterpriseDesktopActions(scope), updates: createEnterpriseUpdateSource(scope) }
}

/**
 * 重载的唯一口径：有官方动作面就走 `invoke('reload')`（fork），否则 `location.reload()`。
 * fork 的 invoke 拒绝时同样回落到页面重载：用户要的是「重新载入」，不是一条错误日志。
 */
export function runEnterpriseReload(
  actions: EnterpriseDesktopActions | undefined,
  reload: () => void,
): void {
  if (actions === undefined) { reload(); return }
  let pending: Promise<unknown>
  try {
    pending = actions.invoke('reload')
  } catch {
    reload()
    return
  }
  void pending.catch(() => { reload() })
}

/**
 * 重启的唯一口径：只有官方动作面可用时才会被调用（行项在不可用时隐藏）；
 * 失败交由调用方给可见反馈，官方 `app.relaunch` 的 spawn 失败只写 stderr，我们不能静默。
 */
export function runEnterpriseRestart(
  actions: EnterpriseDesktopActions | undefined,
  onRejected: () => void,
): void {
  if (actions === undefined) return
  let pending: Promise<unknown>
  try {
    pending = actions.invoke('restart')
  } catch {
    onRejected()
    return
  }
  void pending.catch(() => { onRejected() })
}
