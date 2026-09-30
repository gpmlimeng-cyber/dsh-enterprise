/**
 * [INPUT]: 依赖调用方给出的官方 slots 服务面（只读 `entries(name)`）、一个对话框存在性探针（`[role="dialog"]` 计数）、一次 warn 端口与官方包版本摘要串
 * [OUTPUT]: 对外提供 reach-in 打开器 createEnterpriseShortcutsReachIn、入口形状判定 enterpriseShortcutsOverlayEntry、探针计数 enterpriseShortcutDialogCount、版本摘要 enterpriseShortcutsVersionText 与降级文案常量 ENTERPRISE_SHORTCUTS_GUIDE
 * [POS]: dsh-ui 的「快捷键」入口执行层。产品裁决 B：点击后**真打开**官方「编辑快捷键」对话框——官方没有受支持 API，只能逐级可选链摸它挂在 `shell.overlay` 上的私有 store；任何一层缺失、形状变化或对话框限时未出现都走可见降级（自渲染一览 + 引导），绝不静默
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 *
 * ⚠️ unsupported workaround — 依赖官方 slot 内部 store，官方升级可能失效。
 * 依据（上游 deepseek-ai/deepseek-harness @ 639ed015）：`shortcuts` 服务公开面 13 项无 invoke/dispatch/open，
 * `ShortcutRegistry.invoke` 所在类在 `client/index.ts:40` 是 private 字段；`ui-shortcuts/src/client/index.ts:32-33,47-65`
 * 的对话框 store 是 `create: () => instance`，包 exports 只有 `.`/`./client`。唯一 reach-in 路径是
 * `ctx.slots.entries('shell.overlay').find(x => x.options?.id === 'shortcuts')?.store?.create?.().actions?.open?.()`
 * （`ui-slots/src/index.ts:851,1273`，本包运行基线 0.1.7-rc.2 的 `Slots.entries(key)` 已实测存在）。
 * 官方一旦重命名 slot id 或改 store 形状，这里会退到降级路径而不是抛错，并留下带版本的 warn 便于定位。
 */

/** 降级引导：官方对话框没打开时唯一能走的正当路径（同时会调官方 `openSettings()`）。 */
export const ENTERPRISE_SHORTCUTS_GUIDE = '未能打开官方「编辑快捷键」对话框，请到 设置 → 通用 → 编辑快捷键'

/** 官方 `shell.overlay` 上那个对话框的注册 id；reach-in 只认这一个 id。 */
export const ENTERPRISE_SHORTCUTS_OVERLAY_ID = 'shortcuts'

/** 探针限时与间隔：官方 store 的 `open()` 是同步调用、modal 在同一帧后挂载，数百毫秒足够。 */
export const ENTERPRISE_SHORTCUTS_PROBE_MS = 600
export const ENTERPRISE_SHORTCUTS_PROBE_INTERVAL_MS = 60

/** 官方 slots 服务面（结构读取）：只用到 `entries`，其余一概不碰。 */
export interface EnterpriseShortcutsSlotsPort {
  entries(name: string): readonly unknown[]
}

/** 对话框存在性探针：运行时是 `document.querySelectorAll('[role="dialog"]').length`。 */
export interface EnterpriseDialogProbePort {
  dialogCount(): number
}

export interface EnterpriseShortcutsOpenResult {
  readonly outcome: 'opened' | 'unavailable'
  /** 失败时的判定点，进 warn 日志用；成功时缺席。 */
  readonly step?: string | undefined
}

export interface EnterpriseShortcutsReachIn {
  /**
   * 逐级可选链打开官方对话框并**校验它真的出现了**：返回 `opened` 表示探针在限时内观察到新对话框，
   * 其余一切（入口缺失、store 形状变化、调用抛错、限时未出现）返回 `unavailable` 并恰好记一次 warn。
   */
  open(): Promise<EnterpriseShortcutsOpenResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 从 `shell.overlay` 的 entries 里挑出官方快捷键对话框那一项。
 *
 * 形状不认识（不是对象、没有 options、id 不匹配）一律返回 undefined——「不可用」是合法结论，
 * 不是异常，调用方据此走降级路径。
 */
export function enterpriseShortcutsOverlayEntry(entries: readonly unknown[]): unknown | undefined {
  return entries.find(candidate => {
    if (!isRecord(candidate)) return false
    const options = candidate['options']
    return isRecord(options) && options['id'] === ENTERPRISE_SHORTCUTS_OVERLAY_ID
  })
}

/** 探针的唯一读数：官方原语用 `[role="dialog"][aria-modal="true"]` 认自己的模态，这里按同一口径计数。 */
export function enterpriseShortcutDialogCount(document: { querySelectorAll(selector: string): { length: number } }): number {
  return document.querySelectorAll('[role="dialog"]').length
}

/**
 * 版本摘要：把官方快捷键服务上结构可见的版本字段拼成一行进 warn，**只用于定位失效**，
 * 绝不作为拒绝执行的条件（shape 检查才是判据）。
 */
export function enterpriseShortcutsVersionText(service: unknown): string {
  if (!isRecord(service)) return 'service=absent'
  const parts = ['catalog', 'fixedCatalog'].map(key => {
    const store = service[key]
    return isRecord(store) ? `${key}=present` : `${key}=absent`
  })
  const version = service['version']
  const protocolVersion = service['protocolVersion']
  return [
    typeof version === 'string' && version !== '' ? `version=${version}` : 'version=unknown',
    typeof protocolVersion === 'string' || typeof protocolVersion === 'number'
      ? `protocolVersion=${String(protocolVersion)}`
      : 'protocolVersion=unknown',
    ...parts,
  ].join(' ')
}

export interface EnterpriseShortcutsReachInOptions {
  readonly slots: EnterpriseShortcutsSlotsPort
  readonly probe: EnterpriseDialogProbePort
  /** warn 端口：组合层接 Host logger，测试注入记录器；每次不可用恰好调用一次。 */
  readonly warn: (message: string) => void
  /** 官方包版本/protocolVersion 摘要，随 warn 一起落盘。 */
  readonly version: () => string
  readonly wait?: ((milliseconds: number) => Promise<void>) | undefined
  readonly probeMs?: number | undefined
  readonly intervalMs?: number | undefined
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => { globalThis.setTimeout(resolve, milliseconds) })
}

/**
 * reach-in 打开器。调用顺序照产品裁决：**先关我们的菜单**（调用方已把菜单状态置为关闭）、
 * 下一 tick 才调它；这里只负责「调」与「校验」。
 */
export function createEnterpriseShortcutsReachIn(
  options: EnterpriseShortcutsReachInOptions,
): EnterpriseShortcutsReachIn {
  const wait = options.wait ?? sleep
  const probeMs = options.probeMs ?? ENTERPRISE_SHORTCUTS_PROBE_MS
  const intervalMs = options.intervalMs ?? ENTERPRISE_SHORTCUTS_PROBE_INTERVAL_MS
  const report = (step: string, error?: unknown): EnterpriseShortcutsOpenResult => {
    const detail = error === undefined
      ? ''
      : ` error=${error instanceof Error ? `${error.name}: ${error.message}` : typeof error}`
    options.warn('owndsh: official shortcuts dialog reach-in failed'
      + ` [operation=openShortcuts step=${step} path=slots.entries(shell.overlay)`
      + ` id=${ENTERPRISE_SHORTCUTS_OVERLAY_ID} ${options.version()}${detail}]`)
    return { outcome: 'unavailable', step }
  }
  const invoke = (): 'called' | 'unavailable' | 'threw' => {
    try {
      const entries = options.slots.entries('shell.overlay')
      if (!Array.isArray(entries)) return 'unavailable'
      const entry: unknown = enterpriseShortcutsOverlayEntry(entries)
      if (!isRecord(entry)) return 'unavailable'
      const store: unknown = entry['store']
      if (!isRecord(store)) return 'unavailable'
      const create: unknown = store['create']
      if (typeof create !== 'function') return 'unavailable'
      const instance: unknown = (create as (this: unknown) => unknown).call(store)
      if (!isRecord(instance)) return 'unavailable'
      const actions: unknown = instance['actions']
      if (!isRecord(actions)) return 'unavailable'
      const open: unknown = actions['open']
      if (typeof open !== 'function') return 'unavailable'
      ;(open as (this: unknown) => unknown).call(actions)
      return 'called'
    } catch {
      return 'threw'
    }
  }
  return {
    open: async () => {
      const before = options.probe.dialogCount()
      const called = invoke()
      if (called !== 'called') return report(called === 'threw' ? 'invoke-threw' : 'entry-shape-unavailable')
      // 有界轮询（次数由限时与间隔算出，不依赖墙钟）：官方 modal 先挂载才可能被观察到。
      const attempts = Math.max(1, Math.ceil(probeMs / intervalMs))
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        await wait(intervalMs)
        if (options.probe.dialogCount() > before) return { outcome: 'opened' }
      }
      return report('dialog-not-observed')
    },
  }
}
