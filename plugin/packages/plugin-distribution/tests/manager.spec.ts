/**
 * [INPUT]: 只依赖 `src/manager.ts`（不 import 任何官方运行时值）与 vitest
 * [OUTPUT]: 锁死官方安装面端口的**形状门禁**（四枚方法全在才算可达）、官方 `ChangeResult` 的受控投影（不泄漏 pnpm 输出/日志路径）、
 *           `cancelInstall` 的闭集收窄（未知形状绝不谎报 cancelled）、晚绑定持有者的 wire/unwire fail-closed，以及两枚官方事件的形状门禁
 * [POS]: plugin-distribution 官方安装边界的**单元门禁**。它守的是「官方与我们的接缝」：官方字段名/闭集一旦变了，这里先红，
 *        而不是等到真机上把 `installed` 记成别的东西
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createLateBoundManagedPluginManagerPort,
  makeManagedPluginManagerPort,
  managedPluginManagerFromContext,
  readInstallLogChunk,
  readInstallProgress,
  unavailableManagedPluginManagerPort,
  type OfficialPluginManagerLike,
} from '../src/index.js'

/** 官方 `PluginManager` 的最小结构面：四枚方法都在时才算「可达」。 */
function officialManager(overrides: Partial<OfficialPluginManagerLike> = {}): OfficialPluginManagerLike {
  return {
    installBundle: async (spec: string) => ({ target: spec, changed: true, application: 'applied' }),
    removeBundle: async (name: string) => ({ target: name, changed: true, application: 'applied' }),
    waitForInstall: async () => null,
    cancelInstall: async () => ({ status: 'cancelled' }),
    ...overrides,
  }
}

describe('managedPluginManagerFromContext（形状门禁：不接半个端口）', () => {
  it('accepts only a manager that exposes all four methods', () => {
    const manager = officialManager()
    expect(managedPluginManagerFromContext({ get: () => manager })).toBe(manager)
    for (const method of ['installBundle', 'removeBundle', 'waitForInstall', 'cancelInstall'] as const) {
      expect(managedPluginManagerFromContext({ get: () => ({ ...manager, [method]: undefined }) })).toBeUndefined()
    }
    expect(managedPluginManagerFromContext({ get: () => undefined })).toBeUndefined()
    expect(managedPluginManagerFromContext({ get: () => 'pluginManager' })).toBeUndefined()
  })
})

describe('makeManagedPluginManagerPort（受控投影 + 闭集收窄）', () => {
  it('projects only stable ChangeResult fields and never leaks pnpm output or log paths', async () => {
    const port = makeManagedPluginManagerPort(officialManager({
      installBundle: async () => ({
        target: '@example/dsh-tools',
        changed: true,
        application: 'failed',
        stage: 'install',
        enabled: true,
        bundle: '@example/dsh-tools',
        failedAt: 'registry',
        warnings: ['inactive entry kept'],
        pendingBuilds: ['esbuild'],
        registries: [null, 'https://registry.example.com'],
        error: { code: 'operation-error', diagnostic: 'pnpm exited 1' },
        // 下面这些官方字段**一个都不该**出现在投影里。
        packageResult: { exitCode: 1, output: 'SECRET OUTPUT', truncated: false, logPath: '/profile/.plugin-manager/logs/x' },
      }),
    }))
    const result = await port.installBundle('/abs/artifact.tgz', { enabled: true, requestId: 'req-1' })
    expect(result).toEqual({
      target: '@example/dsh-tools',
      changed: true,
      application: 'failed',
      stage: 'install',
      enabled: true,
      bundle: '@example/dsh-tools',
      failedAt: 'registry',
      warnings: ['inactive entry kept'],
      pendingBuilds: ['esbuild'],
      registries: [null, 'https://registry.example.com'],
      error: { code: 'operation-error', diagnostic: 'pnpm exited 1' },
    })
    expect(JSON.stringify(result)).not.toMatch(/SECRET OUTPUT|logPath/)
  })

  it('clamps an unknown cancellation shape to not-running instead of claiming a cancel happened', async () => {
    const asked: string[] = []
    const port = makeManagedPluginManagerPort(officialManager({
      cancelInstall: async (requestId: string) => {
        asked.push(requestId)
        return { status: 'whatever-the-name-becomes' }
      },
    }))
    await expect(port.cancelInstall('req-2')).resolves.toEqual({ status: 'not-running' })
    await expect(makeManagedPluginManagerPort(officialManager()).cancelInstall('req-3')).resolves.toEqual({ status: 'cancelled' })
    expect(asked).toEqual(['req-2'])
  })

  it('passes waitForInstall through, keeping the official null as null', async () => {
    const port = makeManagedPluginManagerPort(officialManager({
      waitForInstall: async (requestId: string) => (requestId === 'idle'
        ? null
        : { target: 'pkg', changed: true, application: 'restart-required' }),
    }))
    await expect(port.waitForInstall('idle')).resolves.toBeNull()
    await expect(port.waitForInstall('busy')).resolves.toMatchObject({ application: 'restart-required' })
  })

  it('treats a malformed official result as a failure rather than a success', async () => {
    const port = makeManagedPluginManagerPort(officialManager({ installBundle: async () => 'not-a-result' }))
    await expect(port.installBundle('/abs/artifact.tgz')).resolves.toEqual({
      target: '/abs/artifact.tgz', changed: false, application: 'failed',
    })
  })
})

describe('createLateBoundManagedPluginManagerPort（服务尚未 provide 时端口不被判死）', () => {
  it('fails closed before wiring, forwards to the official manager after wiring, and fails closed again after unwiring', async () => {
    const holder = createLateBoundManagedPluginManagerPort()
    expect(holder.wired()).toBe(false)
    await expect(holder.port.removeBundle('pkg')).rejects.toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })

    const remove = vi.fn(async (name: string) => ({ target: name, changed: true, application: 'applied' }))
    holder.wire(officialManager({ removeBundle: remove }))
    expect(holder.wired()).toBe(true)
    await expect(holder.port.removeBundle('pkg')).resolves.toMatchObject({ application: 'applied' })
    expect(remove).toHaveBeenCalledWith('pkg')

    holder.unwire()
    expect(holder.wired()).toBe(false)
    await expect(holder.port.removeBundle('pkg')).rejects.toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
  })

  it('the absent-service port refuses every one of the four surfaces with the same stable code', async () => {
    const port = unavailableManagedPluginManagerPort()
    for (const call of [
      () => port.installBundle('/abs/artifact.tgz'),
      () => port.removeBundle('pkg'),
      () => port.waitForInstall('req'),
      () => port.cancelInstall('req'),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'ENT_PLUGIN_CLI_FAILED' })
    }
  })
})

describe('官方事件形状门禁', () => {
  it('reads install progress only for the closed phase set, with attempt only while installing', () => {
    expect(readInstallProgress({
      requestId: 'req-1', phase: 'installing',
      attempt: { registry: null, index: 1, total: 2 },
    })).toEqual({ requestId: 'req-1', phase: 'installing', attempt: { registry: null, index: 1, total: 2 } })
    expect(readInstallProgress({ requestId: 'req-1', phase: 'cancelling' })).toEqual({ requestId: 'req-1', phase: 'cancelling' })
    expect(readInstallProgress({ requestId: 'req-1', phase: 'applying' })).toEqual({ requestId: 'req-1', phase: 'applying' })
    // 闭集之外的 phase / 缺 requestId 一律不认（不猜官方加了什么新阶段）。
    expect(readInstallProgress({ requestId: 'req-1', phase: 'thinking' })).toBeUndefined()
    expect(readInstallProgress({ phase: 'installing' })).toBeUndefined()
    expect(readInstallProgress(undefined)).toBeUndefined()
    // attempt 只在 installing 上出现；形状不合就如实降级成「只有阶段」。
    expect(readInstallProgress({ requestId: 'req-1', phase: 'applying', attempt: { registry: null, index: 1, total: 2 } }))
      .toEqual({ requestId: 'req-1', phase: 'applying' })
    expect(readInstallProgress({ requestId: 'req-1', phase: 'installing', attempt: { registry: 7, index: 1, total: 2 } }))
      .toEqual({ requestId: 'req-1', phase: 'installing' })
  })

  it('reads install log chunks with the stream closed set and keeps the exit code only when official sent one', () => {
    expect(readInstallLogChunk({
      requestId: 'req-1', jobId: 'job-1', argv: ['pnpm', 'add'], cwd: '/profile', stream: 'stderr', text: 'boom', exitCode: 1,
    })).toEqual({ requestId: 'req-1', jobId: 'job-1', stream: 'stderr', text: 'boom', exitCode: 1 })
    // 没有 requestId 的跑（官方在别处发起的安装）：字段不带，绝不认领。
    expect(readInstallLogChunk({ jobId: 'job-1', stream: 'stdout', text: 'ok' }))
      .toEqual({ jobId: 'job-1', stream: 'stdout', text: 'ok' })
    expect(readInstallLogChunk({ jobId: 'job-1', stream: 'stdin', text: 'ok' })).toBeUndefined()
    expect(readInstallLogChunk({ jobId: '', stream: 'stdout', text: 'ok' })).toBeUndefined()
    expect(readInstallLogChunk({ jobId: 'job-1', stream: 'stdout' })).toBeUndefined()
    expect(readInstallLogChunk(null)).toBeUndefined()
  })
})
