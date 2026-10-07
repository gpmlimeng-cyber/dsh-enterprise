/**
 * [INPUT]: 依赖 EnterpriseAccountStore、local-api 端口和可控请求与时钟
 * [OUTPUT]: 验证地址保存成败、退出失败后的状态收敛、跨服务/账号迟到响应隔离与订阅/查询生命周期；**本刀（登录入口换成 NUWAX）**另有七条钉住独立的 NUWAX 会话切片（成功即真值、失败只写自己那格码、在途不重复提交、只读刷新不覆盖在途结果、企业刷新不抹掉它、登出只看 2xx、状态读失败如实写码）
 * [POS]: dsh-ui 账号状态控制器测试，覆盖三个官方 slot 共享的行为真源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import { EnterpriseAccountStore } from '../src/account-store.js'
import type { EnterpriseAccountBootstrap, EnterpriseLocalApi, EnterpriseLocalStatus, EnterprisePluginStatus } from '../src/local-api.js'
import { EnterpriseLocalApiError } from '../src/local-api.js'

const base = {
  bundleVersion: '0.1.0',
  platformUrl: 'https://enterprise.example.com',
  transport: 'webServer.register' as const,
}

describe('EnterpriseAccountStore', () => {
  it('reports failed and busy saves as unsuccessful, and refreshes local state after a failed logout', async () => {
    let status: EnterpriseLocalStatus = { ...base, state: 'READY' }
    const api: EnterpriseLocalApi = {
      status: vi.fn(async () => status), refresh: vi.fn(), bootstrap: vi.fn(), plugins: vi.fn(),
      setServerUrl: vi.fn(async () => { throw new EnterpriseLocalApiError('ENT_INVALID_REQUEST', 400) }),
      logout: vi.fn(async () => { status = { ...base, state: 'SIGNED_OUT' }; throw new EnterpriseLocalApiError('ENT_PLATFORM_UNAVAILABLE', 503) }),
      startLogin: vi.fn(), cancelLogin: vi.fn(), uninstall: vi.fn(), installPlugin: vi.fn(), removePlugin: vi.fn(),
    }
    const store = new EnterpriseAccountStore(api)
    await store.refresh()
    await store.logout()
    expect(store.getSnapshot()).toMatchObject({ status: { state: 'SIGNED_OUT' }, errorCode: 'ENT_PLATFORM_UNAVAILABLE' })
    await expect(store.setServerUrl('https://example.com/path')).resolves.toBe(false)
    expect(store.getSnapshot().errorCode).toBe('ENT_INVALID_REQUEST')
    let finish!: (value: { serverUrl: string }) => void
    vi.mocked(api.setServerUrl).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const saving = store.setServerUrl('https://new.example')
    await expect(store.setServerUrl('https://other.example')).resolves.toBe(false)
    finish({ serverUrl: 'https://new.example' })
    await expect(saving).resolves.toBe(true)
    expect(store.getSnapshot().errorCode).toBeUndefined()
    expect(api.setServerUrl).toHaveBeenCalledTimes(2)
  })

  it.each(['server', 'account', 'sign-out', 'old failure'])(
    'discards old account and plugin responses after %s, even when revisions match', async change => {
      const old: EnterpriseAccountBootstrap = {
        user: { id: '10031', username: 'old', displayName: 'Old', departmentId: null },
        device: { id: '90018', installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a', status: 'ACTIVE' },
      }
      const next = { ...old, user: { ...old.user, id: '10032', username: 'new' } }
      const nextPlugins = { assignmentRevision: 8, plugins: [] }
      let status: EnterpriseLocalStatus = { ...base, state: 'READY', revision: 7, user: old.user }
      let resolveOld!: (value: EnterpriseAccountBootstrap) => void
      let rejectOld!: (error: Error) => void
      let resolvePlugins!: (value: EnterprisePluginStatus) => void
      let oldSignal!: AbortSignal
      const api: EnterpriseLocalApi = {
        status: vi.fn(async () => status), refresh: vi.fn(),
        bootstrap: vi.fn().mockImplementationOnce((signal: AbortSignal) => {
          oldSignal = signal
          return new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject })
        }).mockResolvedValue(next),
        plugins: vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolvePlugins = resolve })).mockResolvedValue(nextPlugins),
        setServerUrl: vi.fn(), startLogin: vi.fn(), cancelLogin: vi.fn(), logout: vi.fn(), uninstall: vi.fn(),
        installPlugin: vi.fn(), removePlugin: vi.fn(), setPluginEnabled: vi.fn(),
      }
      const store = new EnterpriseAccountStore(api)
      await store.refresh()
      if (change === 'sign-out') { status = { ...status, state: 'SIGNED_OUT' }; await store.refresh() }
      status = { ...status, state: 'READY', ...(change === 'account' ? { user: next.user } : { platformUrl: 'https://new.example' }) }
      await store.refresh()
      await vi.waitFor(() => expect(store.getSnapshot().bootstrap).toEqual(next))
      expect(oldSignal.aborted).toBe(true)
      if (change === 'old failure') rejectOld(new EnterpriseLocalApiError('ENT_PLATFORM_UNAVAILABLE', 503))
      else resolveOld(old)
      resolvePlugins({ assignmentRevision: 1, plugins: [] })
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(store.getSnapshot().bootstrap).toEqual(next)
      expect(store.getSnapshot().pluginStatus).toEqual(nextPlugins)
      expect(store.getSnapshot().errorCode).toBeUndefined()
      expect(api.bootstrap).toHaveBeenCalledTimes(2)
      expect(api.plugins).toHaveBeenCalledTimes(2)
    },
  )

  it('only polls during login, stops at the deadline, and ignores superseded or unmounted requests', async () => {
    vi.useFakeTimers()
    const api: EnterpriseLocalApi = {
      status: vi.fn(async () => ({ ...base, state: 'AUTHORIZING' as const })), refresh: vi.fn(),
      setServerUrl: vi.fn(), bootstrap: vi.fn(), plugins: vi.fn(), installPlugin: vi.fn(), removePlugin: vi.fn(),
      startLogin: vi.fn(), cancelLogin: vi.fn(), logout: vi.fn(), uninstall: vi.fn(),
    }
    const store = new EnterpriseAccountStore(api)
    const unsubscribe = store.subscribe(() => {})
    try {
      await vi.advanceTimersByTimeAsync(331_000)
      const calls = vi.mocked(api.status).mock.calls.length
      expect(calls).toBeGreaterThan(1)
      await vi.advanceTimersByTimeAsync(600_000)
      expect(api.status).toHaveBeenCalledTimes(calls)
      let resolveOld!: (value: EnterpriseLocalStatus) => void
      vi.mocked(api.status).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      const stale = store.refresh()
      vi.mocked(api.status).mockResolvedValue({ ...base, state: 'SIGNED_OUT' })
      await store.refresh()
      resolveOld({ ...base, state: 'AUTHORIZING' })
      await stale
      expect(store.getSnapshot().status?.state).toBe('SIGNED_OUT')
      const settledCalls = vi.mocked(api.status).mock.calls.length
      await vi.advanceTimersByTimeAsync(600_000)
      expect(api.status).toHaveBeenCalledTimes(settledCalls)
      vi.mocked(api.status).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      const pending = store.refresh()
      unsubscribe()
      expect(vi.mocked(api.status).mock.calls.at(-1)?.[0]?.aborted).toBe(true)
      resolveOld({ ...base, state: 'AUTHORIZING' })
      await pending
      expect(store.getSnapshot().status?.state).toBe('SIGNED_OUT')
      expect(vi.getTimerCount()).toBe(0)
    } finally { unsubscribe(); vi.useRealTimers() }
  })

  it('reads state on demand, serializes actions, and loads READY account facts', async () => {
    let current: EnterpriseLocalStatus = { ...base, state: 'SIGNED_OUT' }
    const publish = async (status: EnterpriseLocalStatus) => { current = status; await store.refresh() }
    const api: EnterpriseLocalApi = {
      status: vi.fn(async () => current),
      refresh: vi.fn(async () => current),
      setServerUrl: vi.fn(async serverUrl => ({ serverUrl })),
      bootstrap: vi.fn(async () => ({
        user: { id: '10031', username: 'zhangsan', displayName: 'Zhang San', departmentId: '210' },
        device: { id: '90018', installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a', status: 'ACTIVE' },
      })),
      plugins: vi.fn(async () => ({
        assignmentRevision: 7,
        plugins: [{
          packageName: '@example/dsh-code-review',
          version: '1.2.0',
          desiredRevision: 7,
          desiredState: 'INSTALLED',
          state: 'RESTART_REQUIRED',
          lastErrorCode: null,
        }],
      })),
      installPlugin: vi.fn(async () => ({ assignmentRevision: 7, plugins: [] })),
      removePlugin: vi.fn(async () => ({ assignmentRevision: 7, plugins: [] })),
      setPluginEnabled: vi.fn(async () => ({ assignmentRevision: 7, plugins: [] })),
      startLogin: vi.fn(async () => { current = { ...base, state: 'AUTHORIZING', flowId: 'flow-1' }; return { flowId: 'flow-1' } }),
      cancelLogin: vi.fn(async () => { current = { ...base, state: 'CANCELLED', errorCode: 'ENT_AUTH_CANCELLED' }; return { cancelled: true } }),
      logout: vi.fn(async () => { current = { ...base, state: 'SIGNED_OUT' }; return { loggedOut: true } }),
      uninstall: vi.fn(async () => ({ uninstalled: true, restartRequested: false })),
    }
    const store = new EnterpriseAccountStore(api)
    const changed = vi.fn()
    const unsubscribe = store.subscribe(changed)
    await vi.waitFor(() => { expect(store.getSnapshot().status?.state).toBe('SIGNED_OUT') })

    await store.startLogin()
    expect(store.getSnapshot().status?.state).toBe('AUTHORIZING')
    await store.cancelLogin()
    expect(store.getSnapshot()).toMatchObject({ status: { state: 'CANCELLED' }, errorCode: 'ENT_AUTH_CANCELLED' })

    await publish({
      ...base,
      state: 'READY',
      revision: 7,
      connectedAt: '2026-08-18T00:00:00.000Z',
      user: { id: '10031', username: 'zhangsan', displayName: 'Zhang San', departmentId: '210' },
    })
    await vi.waitFor(() => { expect(store.getSnapshot().bootstrap?.device.id).toBe('90018') })
    await vi.waitFor(() => { expect(store.getSnapshot().pluginStatus?.assignmentRevision).toBe(7) })
    await publish({ ...current, state: 'REFRESHING', revision: 7 })
    await publish({ ...current, state: 'READY', revision: 7 })
    expect(api.bootstrap).toHaveBeenCalledOnce()
    expect(api.plugins).toHaveBeenCalledOnce()
    await publish({ ...current, state: 'READY', revision: 8 })
    await vi.waitFor(() => { expect(api.bootstrap).toHaveBeenCalledTimes(2) })
    await vi.waitFor(() => { expect(api.plugins).toHaveBeenCalledTimes(2) })
    await store.refreshPlugins()
    expect(api.plugins).toHaveBeenCalledTimes(3)
    expect(api.installPlugin).not.toHaveBeenCalled()
    expect(api.removePlugin).not.toHaveBeenCalled()
    await store.installPlugin('@example/dsh-code-review', '880')
    expect(api.installPlugin).toHaveBeenCalledWith('@example/dsh-code-review', '880', expect.any(AbortSignal))
    await store.removePlugin('@example/dsh-code-review')
    expect(api.removePlugin).toHaveBeenCalledOnce()
    // 启用 / 停用：与装/卸同一条串行纪律，方向由**入参**决定（`false` = 停用，绝不是卸载）。
    await store.setPluginEnabled('@example/dsh-code-review', false)
    expect(api.setPluginEnabled).toHaveBeenCalledWith('@example/dsh-code-review', false, expect.any(AbortSignal))
    expect(api.removePlugin).toHaveBeenCalledOnce()
    await store.logout()
    expect(store.getSnapshot().status?.state).toBe('SIGNED_OUT')
    expect(store.getSnapshot().bootstrap).toBeUndefined()
    expect(store.getSnapshot().pluginStatus).toBeUndefined()
    await store.uninstall()
    expect(store.getSnapshot().uninstallRestartRequested).toBe(false)
    expect(api.uninstall).toHaveBeenCalledOnce()

    unsubscribe()
    expect(api.refresh).toHaveBeenCalledOnce()
  })

  it('maps local failures to a stable code without service messages', async () => {
    const api: EnterpriseLocalApi = {
      status: vi.fn(async () => { throw new EnterpriseLocalApiError('ENT_PLATFORM_UNAVAILABLE', 503) }),
      refresh: vi.fn(),
      setServerUrl: vi.fn(),
      bootstrap: vi.fn(),
      plugins: vi.fn(),
      installPlugin: vi.fn(),
      removePlugin: vi.fn(),
      startLogin: vi.fn(),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
      uninstall: vi.fn(),
      // 两条读各自独立：企业这条失败、NUWAX 那条成功也在快照里（等值断言故意把这条也钉住）。
      nuwaxStatus: vi.fn(async () => ({ state: 'signed-out' as const })),
      nuwaxLogin: vi.fn(),
      nuwaxLogout: vi.fn(),
    }
    const store = new EnterpriseAccountStore(api)
    const unsubscribe = store.subscribe(() => undefined)
    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        phase: 'error',
        errorCode: 'ENT_PLATFORM_UNAVAILABLE',
        nuwax: { state: 'signed-out' },
      })
    })
    unsubscribe()
  })
})

describe('企业插件「启用 / 停用」（本刀：关闭开关＝停用，不是卸载）', () => {
  it('records the settled fact only when the response really flipped 启停位, and never touches 卸载', async () => {
    const records = [{
      packageName: '@example/dsh-tools', version: '1.0.0', desiredRevision: 7,
      desiredState: 'INSTALLED' as const, state: 'ACTIVE' as const, lastErrorCode: null, enabled: true,
    }]
    const ready: EnterpriseLocalStatus = { ...base, state: 'READY' }
    const api: EnterpriseLocalApi = {
      status: vi.fn(async () => ready),
      refresh: vi.fn(async () => ready),
      setServerUrl: vi.fn(),
      bootstrap: vi.fn(),
      plugins: vi.fn(async () => ({ assignmentRevision: 7, plugins: records.map(item => ({ ...item })) })),
      installPlugin: vi.fn(),
      removePlugin: vi.fn(),
      // 停用成功：Host 回的这条投影里那一枚启停位如实翻了（响应即真值，客户端不自行翻开关）。
      setPluginEnabled: vi.fn(async (_name: string, enabled: boolean) => {
        records[0] = { ...records[0]!, enabled }
        return { assignmentRevision: 7, plugins: records.map(item => ({ ...item })) }
      }),
      startLogin: vi.fn(),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
      uninstall: vi.fn(),
    } as unknown as EnterpriseLocalApi
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    await store.refresh()
    await vi.waitFor(() => { expect(store.getSnapshot().status?.state).toBe('READY') })
    await store.setPluginEnabled('@example/dsh-tools', false)
    expect(api.setPluginEnabled).toHaveBeenCalledWith('@example/dsh-tools', false, expect.any(AbortSignal))
    // 卸载那条路一次都没走（关掉开关不等于卸载——这是用户明确纠正过的语义）。
    expect(api.removePlugin).not.toHaveBeenCalled()
    // 落地事实按**真实收束态**记：动作是 disable、状态取自 Host 那条记录。
    expect(store.getSnapshot().pluginSettled).toMatchObject({
      action: 'disable', packageName: '@example/dsh-tools', state: 'ACTIVE',
    })
    expect(store.getSnapshot().pluginBusy).toBeUndefined()
  })
})

/**
 * **本刀（口径 30：登录入口换成 NUWAX）**：NUWAX 会话切片的状态机。
 *
 * 七条口径逐条钉住：登录成功即真值、失败只写 NUWAX 那格码、在途不重复提交、只读刷新**不覆盖**在途结果、
 * 企业刷新**不抹掉** NUWAX 登录态、登出只看 2xx（失败不假装已登出）、状态读失败如实写码。
 */
describe('EnterpriseAccountStore · NUWAX 员工登录（本刀）', () => {
  const PRINCIPAL = { uid: 538565, userName: '538565', nickName: '李猛', tenantId: 1 }
  const SIGNED_IN = { state: 'signed-in' as const, principal: PRINCIPAL, expiresAt: 1_000 }

  /** 一具只把 NUWAX 三条做成可控的 api；企业那几条给能跑通的最小实现。 */
  function nuwaxApi(overrides: Partial<EnterpriseLocalApi> = {}): EnterpriseLocalApi {
    const signedOut: EnterpriseLocalStatus = { ...base, state: 'SIGNED_OUT' }
    return {
      status: vi.fn(async () => signedOut),
      refresh: vi.fn(async () => signedOut),
      setServerUrl: vi.fn(),
      bootstrap: vi.fn(),
      plugins: vi.fn(),
      installPlugin: vi.fn(),
      removePlugin: vi.fn(),
      startLogin: vi.fn(),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
      uninstall: vi.fn(),
      nuwaxStatus: vi.fn(async () => ({ state: 'signed-out' as const })),
      nuwaxLogin: vi.fn(async () => SIGNED_IN),
      nuwaxLogout: vi.fn(async () => undefined),
      ...overrides,
    } as unknown as EnterpriseLocalApi
  }

  it('收下登录成功那份真值（主体 + 过期时刻），并把在途与失败码一起收束掉', async () => {
    const api = nuwaxApi()
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    await vi.waitFor(() => { expect(store.getSnapshot().nuwax?.state).toBe('signed-out') })

    await expect(store.nuwaxLogin('538565', 'secret')).resolves.toBe(true)
    expect(api.nuwaxLogin).toHaveBeenCalledWith('538565', 'secret', expect.any(AbortSignal))
    expect(store.getSnapshot().nuwax).toEqual(SIGNED_IN)
    expect(store.getSnapshot().nuwaxBusy).toBeUndefined()
    expect(store.getSnapshot().nuwaxErrorCode).toBeUndefined()
  })

  it('失败只写 NUWAX 那格码，绝不污染企业那三格', async () => {
    const api = nuwaxApi({
      nuwaxLogin: vi.fn(async () => { throw new EnterpriseLocalApiError('ENT_NUWAX_INVALID_CREDENTIALS', 401) }),
    })
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    await store.refresh()
    const before = store.getSnapshot()
    await expect(store.nuwaxLogin('538565', 'wrong')).resolves.toBe(false)
    const after = store.getSnapshot()
    expect(after.nuwaxErrorCode).toBe('ENT_NUWAX_INVALID_CREDENTIALS')
    expect(after.errorCode).toBe(before.errorCode)
    expect(after.sessionErrorCode).toBe(before.sessionErrorCode)
    expect(after.pluginErrorCode).toBe(before.pluginErrorCode)
    expect(after.nuwaxBusy).toBeUndefined()
  })

  it('在途不重复提交：第二次在第一次收束前返回 false，且只打了一趟平台', async () => {
    let finish!: (value: typeof SIGNED_IN) => void
    const api = nuwaxApi({ nuwaxLogin: vi.fn(() => new Promise<typeof SIGNED_IN>(resolve => { finish = resolve })) })
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    const first = store.nuwaxLogin('538565', 'secret')
    await vi.waitFor(() => { expect(store.getSnapshot().nuwaxBusy).toBe('login') })
    await expect(store.nuwaxLogin('538565', 'secret')).resolves.toBe(false)
    finish(SIGNED_IN)
    await expect(first).resolves.toBe(true)
    expect(api.nuwaxLogin).toHaveBeenCalledOnce()
  })

  it('只读刷新不覆盖在途结果（否则迟到的旧态会把刚建立的会话抹回去）', async () => {
    let finish!: (value: typeof SIGNED_IN) => void
    const api = nuwaxApi({ nuwaxLogin: vi.fn(() => new Promise<typeof SIGNED_IN>(resolve => { finish = resolve })) })
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    await vi.waitFor(() => { expect(store.getSnapshot().nuwax?.state).toBe('signed-out') })
    const login = store.nuwaxLogin('538565', 'secret')
    await vi.waitFor(() => { expect(store.getSnapshot().nuwaxBusy).toBe('login') })
    await store.refreshNuwax()
    // 在途期间读到的那条 signed-out 不许进快照：还是刷新前那条真值。
    expect(store.getSnapshot().nuwax?.state).toBe('signed-out')
    finish(SIGNED_IN)
    await login
    expect(store.getSnapshot().nuwax).toEqual(SIGNED_IN)
  })

  it('企业状态每刷新一次都不抹掉 NUWAX 登录态（两条会话各自独立）', async () => {
    const api = nuwaxApi()
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    await store.nuwaxLogin('538565', 'secret')
    expect(store.getSnapshot().nuwax).toEqual(SIGNED_IN)
    // 企业侧连刷三次（`#acceptStatus` 每次都整体重建快照）——NUWAX 三格必须原样还在。
    await store.refresh()
    await store.refresh()
    await store.refresh(true)
    expect(store.getSnapshot().nuwax).toEqual(SIGNED_IN)
  })

  it('登出只看 2xx：成功即 signed-out，失败写码且保留原登录态（不假装已登出）', async () => {
    const ok = nuwaxApi()
    const store = new EnterpriseAccountStore(ok)
    store.subscribe(() => undefined)
    await store.nuwaxLogin('538565', 'secret')
    await expect(store.nuwaxLogout()).resolves.toBe(true)
    expect(store.getSnapshot().nuwax).toEqual({ state: 'signed-out' })
    expect(ok.nuwaxLogout).toHaveBeenCalledOnce()

    const failing = nuwaxApi({
      nuwaxLogin: vi.fn(async () => SIGNED_IN),
      nuwaxLogout: vi.fn(async () => { throw new EnterpriseLocalApiError('ENT_NUWAX_UNAVAILABLE', 502) }),
    })
    const other = new EnterpriseAccountStore(failing)
    other.subscribe(() => undefined)
    await other.nuwaxLogin('538565', 'secret')
    await expect(other.nuwaxLogout()).resolves.toBe(false)
    expect(other.getSnapshot().nuwaxErrorCode).toBe('ENT_NUWAX_UNAVAILABLE')
    expect(other.getSnapshot().nuwax).toEqual(SIGNED_IN)
  })

  it('状态读失败如实写码，不静默当成未登录', async () => {
    const api = nuwaxApi({
      nuwaxStatus: vi.fn(async () => { throw new EnterpriseLocalApiError('ENT_NUWAX_NOT_CONFIGURED', 503) }),
    })
    const store = new EnterpriseAccountStore(api)
    store.subscribe(() => undefined)
    await vi.waitFor(() => { expect(store.getSnapshot().nuwaxErrorCode).toBe('ENT_NUWAX_NOT_CONFIGURED') })
    expect(store.getSnapshot().nuwax).toBeUndefined()
  })
})
