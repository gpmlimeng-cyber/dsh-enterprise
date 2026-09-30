/**
 * [INPUT]: 依赖 desktop-runtime 的能力探测/更新状态源/相位映射/重载与重启执行器，以及假的宿主全局载体
 * [OUTPUT]: 锁定「逐 app 特性检测」的四条判定（动作面、protocolVersion、updates.open、相位解码）、status 一次初值 + subscribe 订阅（不轮询、卸载即取消）、九个失败码的中文文案，以及重载/重启的唯一降级链
 * [POS]: dsh-ui 桌面运行时的契约回归；有人把 Harness 当成有动作面的 fork、把 subscribe 换成轮询、或让重启在无通道时假装成功，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_DESKTOP_ABSENT,
  ENTERPRISE_UPDATE_ABSENT,
  ENTERPRISE_UPDATE_FAILURES,
  ENTERPRISE_UPDATE_PHASES,
  createEnterpriseDesktopSource,
  createEnterpriseUpdateSource,
  decodeEnterpriseUpdatePresentation,
  enterpriseDesktopActions,
  enterpriseUpdateFailureText,
  enterpriseUpdatePhase,
  enterpriseUpdateTrailing,
  runEnterpriseReload,
  runEnterpriseRestart,
} from '../src/desktop-runtime.js'

/** 让 `pending.catch(...)` 这些微任务跑完，断言降级链的最终落点。 */
async function flush(): Promise<void> {
  await new Promise(resolve => { setTimeout(resolve, 0) })
}

describe('the desktop action channel is detected, never assumed', () => {
  it('answers undefined for pure Web, for a non-object carrier and for a non-callable invoke', () => {
    expect(enterpriseDesktopActions({})).toBeUndefined()
    expect(enterpriseDesktopActions({ dshDesktopActions: undefined })).toBeUndefined()
    expect(enterpriseDesktopActions({ dshDesktopActions: null })).toBeUndefined()
    expect(enterpriseDesktopActions({ dshDesktopActions: 'invoke' })).toBeUndefined()
    expect(enterpriseDesktopActions({ dshDesktopActions: { invoke: 7 } })).toBeUndefined()
    // Harness.app（0.2.0-rc.2）asar 内没有 renderer-action：只有 dshDesktop 时必须仍然判为不可用。
    expect(enterpriseDesktopActions({ dshDesktop: { protocolVersion: 1 } })).toBeUndefined()
  })

  it('forwards the two whitelisted actions to the fork carrier with its own this', async () => {
    const calls: string[] = []
    const carrier = {
      invoke(this: { readonly name: string }, action: string) {
        calls.push(`${this.name}:${action}`)
        return Promise.resolve('ok')
      },
      name: 'dsh-desktop',
    }
    const actions = enterpriseDesktopActions({ dshDesktopActions: carrier })
    expect(actions).toBeDefined()
    await expect(actions!.invoke('reload')).resolves.toBe('ok')
    await expect(actions!.invoke('restart')).resolves.toBe('ok')
    expect(calls).toEqual(['dsh-desktop:reload', 'dsh-desktop:restart'])
  })
})

describe('the update presentation is decoded strictly', () => {
  it('accepts every official phase and rejects anything else', () => {
    for (const phase of ENTERPRISE_UPDATE_PHASES) {
      expect(enterpriseUpdatePhase(phase)).toBe(phase)
      expect(decodeEnterpriseUpdatePresentation({ phase })).toEqual({ phase })
    }
    expect(enterpriseUpdatePhase('downloading…')).toBeUndefined()
    expect(decodeEnterpriseUpdatePresentation({ phase: 'downloaded' })).toBeUndefined()
    expect(decodeEnterpriseUpdatePresentation(null)).toBeUndefined()
    expect(decodeEnterpriseUpdatePresentation([{ phase: 'idle' }])).toBeUndefined()
    expect(decodeEnterpriseUpdatePresentation({ phase: 3 })).toBeUndefined()
  })

  it('keeps version/percent/failure only when they are usable, and never invents a current version', () => {
    expect(decodeEnterpriseUpdatePresentation({ phase: 'available', version: '2.0.16' })).toEqual({ phase: 'available', version: '2.0.16' })
    expect(decodeEnterpriseUpdatePresentation({ phase: 'available', version: '' })).toEqual({ phase: 'available' })
    expect(decodeEnterpriseUpdatePresentation({ phase: 'downloading', percent: 42.5 })).toEqual({ phase: 'downloading', percent: 42.5 })
    expect(decodeEnterpriseUpdatePresentation({ phase: 'downloading', percent: Number.NaN })).toEqual({ phase: 'downloading' })
    expect(decodeEnterpriseUpdatePresentation({ phase: 'downloading', percent: 180 })).toEqual({ phase: 'downloading', percent: 100 })
    expect(decodeEnterpriseUpdatePresentation({ phase: 'error', failure: 'check-network' })).toEqual({ phase: 'error', failure: 'check-network' })
    // 官方没有 currentVersion/releaseNotes：多余的字段不进我们的投影。
    expect(decodeEnterpriseUpdatePresentation({ currentVersion: '2.0.15', phase: 'idle' })).toEqual({ phase: 'idle' })
  })

  it('maps all nine official failure codes to official Chinese copy and defaults the rest', () => {
    expect(ENTERPRISE_UPDATE_FAILURES).toHaveLength(9)
    for (const code of ENTERPRISE_UPDATE_FAILURES) {
      const text = enterpriseUpdateFailureText(code)
      expect(text.length).toBeGreaterThan(4)
      expect(text).toMatch(/。[」]?$/u)
    }
    expect(enterpriseUpdateFailureText('check-network')).toBe('检查更新失败，请检查网络连接后重试。')
    expect(enterpriseUpdateFailureText('tasks-changed')).toBe('有新任务开始运行，请重新确认是否停止任务并更新。')
    // 不认识或没给的失败码走官方默认的 install 口径，不透传原始字符串。
    expect(enterpriseUpdateFailureText(undefined)).toBe(enterpriseUpdateFailureText('install'))
    expect(enterpriseUpdateFailureText('boom')).toBe(enterpriseUpdateFailureText('install'))
  })
})

describe('the trailing state follows the official phase', () => {
  it('maps idle/available/busy/ready/error onto the queue wording', () => {
    // 队列第 3 项修订：右侧是「状态标签 + 快捷按钮」两件事，谁都不重复行标签「检查更新」。
    expect(enterpriseUpdateTrailing(undefined)).toEqual({ action: 'open', actionLabel: '检查', disabled: false, state: '未检查' })
    expect(enterpriseUpdateTrailing({ phase: 'idle' })).toEqual({ action: 'open', actionLabel: '检查', disabled: false, state: '未检查' })
    // 见过一轮 checking 之后，idle 才说得出口「已是最新」。
    expect(enterpriseUpdateTrailing({ phase: 'idle' }, true))
      .toEqual({ action: 'open', actionLabel: '检查', disabled: false, state: '已是最新' })
    expect(enterpriseUpdateTrailing({ phase: 'available', version: '2.0.16' }))
      .toEqual({ action: 'open', actionLabel: '更新', disabled: false, state: '有可用更新 2.0.16' })
    expect(enterpriseUpdateTrailing({ phase: 'available' }))
      .toEqual({ action: 'open', actionLabel: '更新', disabled: false, state: '有可用更新' })
    expect(enterpriseUpdateTrailing({ phase: 'checking' }))
      .toEqual({ action: 'none', disabled: true, state: '检查中…' })
    for (const [phase, state] of [['downloading', '下载中 42%'], ['verifying', '校验中'], ['installing', '安装中']] as const) {
      expect(enterpriseUpdateTrailing({ phase, percent: phase === 'downloading' ? 42 : 100 }))
        .toEqual({ action: 'none', disabled: true, state })
    }
    expect(enterpriseUpdateTrailing({ phase: 'ready' }))
      .toEqual({ action: 'open', actionLabel: '重启安装', disabled: false, state: '已下载，待重启' })
    expect(enterpriseUpdateTrailing({ phase: 'error', failure: 'download-network' })).toEqual({
      action: 'open',
      actionLabel: '重试',
      disabled: false,
      state: '下载更新失败，请检查网络连接后重试。',
      stateTitle: '下载更新失败，请检查网络连接后重试。',
    })
    // 失败原因归右侧状态标签，用官方 install 兜底文案；行标签仍是「检查更新」。
    expect(enterpriseUpdateTrailing({ phase: 'error' }))
      .toEqual({
        action: 'open',
        actionLabel: '重试',
        disabled: false,
        state: enterpriseUpdateFailureText('install'),
        stateTitle: enterpriseUpdateFailureText('install'),
      })
  })

  it('never lets the right-hand copy repeat the row label', () => {
    const phases = ['idle', 'checking', 'available', 'downloading', 'verifying', 'installing', 'ready', 'error'] as const
    for (const phase of phases) {
      for (const checked of [false, true]) {
        const trailing = enterpriseUpdateTrailing({ phase, version: '2.0.16' }, checked)
        expect(trailing.state, phase).not.toBe('检查更新')
        expect(trailing.actionLabel, phase).not.toBe('检查更新')
        // 按钮文案与状态标签也不能互相重复（否则等于同一条信息说两遍）。
        if (trailing.actionLabel !== undefined) expect(trailing.actionLabel, phase).not.toBe(trailing.state)
      }
    }
  })
})

/** 官方 DesktopUpdateSource 的时序口径：订阅先到就赢、status 只问一次、dispose 之后一概不再发布。 */
describe('the update source mirrors the official preload without polling', () => {
  function carrier(status: () => Promise<unknown>) {
    const listeners: ((presentation: unknown) => void)[] = []
    let off = 0
    return {
      bridge: {
        protocolVersion: 1,
        updates: {
          open: vi.fn(() => Promise.resolve()),
          status: vi.fn(status),
          subscribe: (listener: (presentation: unknown) => void) => {
            listeners.push(listener)
            return () => { off += 1; listeners.splice(listeners.indexOf(listener), 1) }
          },
        },
      },
      emit: (presentation: unknown) => { for (const listener of [...listeners]) listener(presentation) },
      unsubscribes: () => off,
    }
  }

  it('is absent for pure Web, for a missing updates object and for a non-callable open', () => {
    for (const scope of [
      {},
      { dshDesktop: {} },
      { dshDesktop: { protocolVersion: 2, updates: { open: () => Promise.resolve() } } },
      { dshDesktop: { protocolVersion: 1 } },
      { dshDesktop: { protocolVersion: 1, updates: { status: () => Promise.resolve({ phase: 'idle' }) } } },
    ]) {
      const source = createEnterpriseUpdateSource(scope)
      expect(source.available).toBe(false)
      expect(source.getSnapshot()).toBeUndefined()
      expect(() => { source.open() }).not.toThrow()
    }
    expect(createEnterpriseUpdateSource({})).toBe(ENTERPRISE_UPDATE_ABSENT)
  })

  it('takes exactly one initial status and then only follows the official pushes', async () => {
    const fake = carrier(() => Promise.resolve({ phase: 'available', version: '2.0.16' }))
    const source = createEnterpriseUpdateSource({ dshDesktop: fake.bridge })
    expect(source.available).toBe(true)
    // 订阅前没有任何事实：界面不拿自造默认值充数。
    expect(source.getSnapshot()).toBeUndefined()
    await flush()
    expect(source.getSnapshot()).toEqual({ phase: 'available', version: '2.0.16' })
    expect(fake.bridge.updates.status).toHaveBeenCalledTimes(1)
    const seen: (string | undefined)[] = []
    const off = source.subscribe(() => { seen.push(source.getSnapshot()?.phase) })
    fake.emit({ phase: 'downloading', percent: 10 })
    fake.emit({ phase: 'downloading', percent: 55 })
    fake.emit({ phase: 'ready' })
    expect(seen).toEqual(['downloading', 'downloading', 'ready'])
    // 轮询禁令：subscribe 之后 status 不再被问第二次。
    expect(fake.bridge.updates.status).toHaveBeenCalledTimes(1)
    // 形状不认识的推送整条丢弃，不覆盖已接受的事实。
    fake.emit({ phase: 'unknown' })
    fake.emit('nope')
    expect(source.getSnapshot()).toEqual({ phase: 'ready' })
    off()
    expect(source.getSnapshot()).toEqual({ phase: 'ready' })
    expect(fake.unsubscribes()).toBe(0)
  })

  it('lets the first subscription win over a late initial status', async () => {
    let resolveStatus: (value: unknown) => void = () => undefined
    const fake = carrier(() => new Promise(resolve => { resolveStatus = resolve }))
    const source = createEnterpriseUpdateSource({ dshDesktop: fake.bridge })
    source.subscribe(() => undefined)
    fake.emit({ phase: 'error', failure: 'check' })
    resolveStatus({ phase: 'idle' })
    await flush()
    expect(source.getSnapshot()).toEqual({ phase: 'error', failure: 'check' })
  })

  it('forwards open to the official phase-driven entry and detaches on dispose', async () => {
    const fake = carrier(() => Promise.resolve({ phase: 'idle' }))
    const source = createEnterpriseUpdateSource({ dshDesktop: fake.bridge })
    source.open()
    expect(fake.bridge.updates.open).toHaveBeenCalledTimes(1)
    source.dispose()
    expect(fake.unsubscribes()).toBe(1)
    // dispose 之后不再发布、也不再动手：迟到的推送与 open 都被忽略。
    const seen = vi.fn()
    source.subscribe(seen)
    fake.emit({ phase: 'available' })
    source.open()
    expect(seen).not.toHaveBeenCalled()
    expect(fake.bridge.updates.open).toHaveBeenCalledTimes(1)
    await flush()
  })

  it('survives a bridge whose status and subscribe are missing', async () => {
    const source = createEnterpriseUpdateSource({
      dshDesktop: { protocolVersion: 1, updates: { open: () => Promise.resolve() } },
    })
    expect(source.available).toBe(true)
    expect(source.getSnapshot()).toBeUndefined()
    await flush()
    expect(source.getSnapshot()).toBeUndefined()
  })
})

describe('the desktop source keeps the two capabilities independent', () => {
  it('reports Harness.app as updates-only and the fork as both', () => {
    const harness = createEnterpriseDesktopSource({
      dshDesktop: { protocolVersion: 1, updates: { open: () => Promise.resolve() } },
    })
    expect(harness.actions).toBeUndefined()
    expect(harness.updates.available).toBe(true)

    const fork = createEnterpriseDesktopSource({
      dshDesktopActions: { invoke: () => Promise.resolve() },
      dshDesktop: { protocolVersion: 1, updates: { open: () => Promise.resolve() } },
    })
    expect(fork.actions).toBeDefined()
    expect(fork.updates.available).toBe(true)
  })

  it('answers the absent source for pure Web', () => {
    expect(createEnterpriseDesktopSource({})).toEqual(ENTERPRISE_DESKTOP_ABSENT)
    expect(createEnterpriseDesktopSource({}).actions).toBeUndefined()
  })
})

describe('reload and restart have exactly one degradation chain each', () => {
  it('prefers the official renderer action and falls back to a real page reload otherwise', async () => {
    const reload = vi.fn()
    const invoke = vi.fn(() => Promise.resolve())
    runEnterpriseReload({ invoke }, reload)
    await flush()
    expect(invoke).toHaveBeenCalledWith('reload')
    expect(reload).not.toHaveBeenCalled()

    runEnterpriseReload(undefined, reload)
    expect(reload).toHaveBeenCalledTimes(1)

    // 官方通道拒绝或同步抛出时同样必须落地到页面重载，而不是留一句错误日志。
    const rejected = vi.fn(() => Promise.reject(new Error('nope')))
    runEnterpriseReload({ invoke: rejected }, reload)
    await flush()
    expect(reload).toHaveBeenCalledTimes(2)
    runEnterpriseReload({ invoke: () => { throw new Error('sync') } }, reload)
    expect(reload).toHaveBeenCalledTimes(3)
  })

  it('only ever restarts through the official channel and reports the refusal', async () => {
    const failed = vi.fn()
    const invoke = vi.fn(() => Promise.resolve())
    runEnterpriseRestart({ invoke }, failed)
    await flush()
    expect(invoke).toHaveBeenCalledWith('restart')
    expect(failed).not.toHaveBeenCalled()

    // 没有动作面时什么都不做：行项本来就不在列，绝不退回自造 IPC 或 location。
    runEnterpriseRestart(undefined, failed)
    expect(failed).not.toHaveBeenCalled()

    runEnterpriseRestart({ invoke: () => Promise.reject(new Error('spawn failed')) }, failed)
    await flush()
    expect(failed).toHaveBeenCalledTimes(1)
    runEnterpriseRestart({ invoke: () => { throw new Error('sync') } }, failed)
    expect(failed).toHaveBeenCalledTimes(2)
  })
})
