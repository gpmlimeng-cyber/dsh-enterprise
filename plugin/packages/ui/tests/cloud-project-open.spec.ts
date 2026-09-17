/**
 * [INPUT]: 依赖 EnterpriseAccountStore、官方工作区端口读取器与可控本地 API 替身。
 * [OUTPUT]: 验证原生选目录→clone→登记工作区→请求会话的编排、取消语义、字段名兼容与端口缺失时的降级。
 * [POS]: dsh-ui 云端项目「与本地项目一致体验」的行为门禁。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import { EnterpriseAccountStore } from '../src/account-store.js'
import { EnterpriseLocalApiError } from '../src/local-api.js'
import type { EnterpriseLocalApi, EnterpriseLocalStatus } from '../src/local-api.js'
import { createOfficialWorkspacesReader, readOfficialWorkspaces } from '../src/workspaces-port.js'

const base = {
  bundleVersion: '0.1.0',
  platformUrl: 'https://enterprise.example.com',
  transport: 'webServer.register' as const,
}

function readyStatus(): EnterpriseLocalStatus {
  return { ...base, state: 'READY' }
}

function apiWith(clone: (projectId: string, rootDir: string) => Promise<{ path: string }>): EnterpriseLocalApi {
  return {
    status: vi.fn(async () => readyStatus()),
    cloneCloudProject: vi.fn(clone),
    listCloudProjects: vi.fn(async () => []),
  } as unknown as EnterpriseLocalApi
}

async function storeWith(
  clone: (projectId: string, rootDir: string) => Promise<{ path: string }>,
  service?: Record<string, unknown> | undefined,
): Promise<EnterpriseAccountStore> {
  const store = new EnterpriseAccountStore(
    apiWith(clone),
    createOfficialWorkspacesReader(service === undefined ? {} : { get: () => service }),
  )
  await store.refresh()
  return store
}

describe('official workspaces reader', () => {
  it('returns undefined when the service is absent or incomplete', () => {
    expect(readOfficialWorkspaces(undefined)).toBeUndefined()
    expect(readOfficialWorkspaces({})).toBeUndefined()
    expect(readOfficialWorkspaces({ get: () => undefined })).toBeUndefined()
    expect(readOfficialWorkspaces({ get: () => null })).toBeUndefined()
    expect(readOfficialWorkspaces({ get: () => 'workspaces' })).toBeUndefined()
    // create 缺失与 pickDirectory 缺失都必须判定为不可用。
    expect(readOfficialWorkspaces({ get: () => ({ pickDirectory: () => null }) })).toBeUndefined()
    expect(readOfficialWorkspaces({ get: () => ({ create: () => ({}) }) })).toBeUndefined()
  })

  it('accepts the official workspaceId field and the legacy id field', async () => {
    for (const view of [{ workspaceId: 'w_official' }, { id: 'w_legacy' }]) {
      const port = readOfficialWorkspaces({
        get: () => ({ pickDirectory: async () => '/tmp/root', create: async () => view, startSession: () => undefined }),
      })
      await expect(port!.create({ path: '/tmp/root/x' })).resolves.toEqual({
        workspaceId: (view as { workspaceId?: string }).workspaceId ?? 'w_legacy',
      })
    }
  })

  it('rejects a created view without a usable identifier', async () => {
    for (const view of [{}, { workspaceId: '' }, { id: 7 }, null]) {
      const port = readOfficialWorkspaces({
        get: () => ({ pickDirectory: async () => null, create: async () => view }),
      })
      await expect(port!.create({ path: '/x' })).rejects.toThrow('official workspace create returned no workspace id')
    }
  })

  it('preserves the receiver when rebinding members and turns sync throws into rejections', async () => {
    const service = {
      marker: 'bound',
      pickDirectory(this: { marker: string }) {
        return Promise.resolve(this.marker)
      },
      create(this: { marker: string }, input: { path: string }) {
        if (input.path === '/boom') throw new Error('sync failure')
        return Promise.resolve({ workspaceId: this.marker })
      },
      startSession() { throw new Error('session flow failed') },
    }
    const port = readOfficialWorkspaces({ get: () => service })

    await expect(port!.pickDirectory()).resolves.toBe('bound')
    await expect(port!.create({ path: '/ok' })).resolves.toEqual({ workspaceId: 'bound' })
    await expect(port!.create({ path: '/boom' })).rejects.toThrow('sync failure')
    // 官方 startSession 同步抛错时只报告「未发起」，不向上抛。
    expect(port!.requestSession('w_1')).toBe(false)
  })

  it('reports no session request when the official service exposes no startSession', () => {
    const port = readOfficialWorkspaces({
      get: () => ({ pickDirectory: async () => null, create: async () => ({ workspaceId: 'w_1' }) }),
    })
    expect(port!.requestSession('w_1')).toBe(false)
  })

  it('re-reads the service on every call so a late-registered provider is still seen', () => {
    let available: Record<string, unknown> | undefined
    const read = createOfficialWorkspacesReader({ get: () => available })
    expect(read()).toBeUndefined()
    available = { pickDirectory: async () => null, create: async () => ({ workspaceId: 'w_1' }) }
    expect(read()).toBeDefined()
  })
})

describe('EnterpriseAccountStore.openCloudProject', () => {
  it('picks a directory, clones, registers a native workspace and requests its session', async () => {
    const clone = vi.fn(async (_id: string, rootDir: string) => ({ path: `${rootDir}/team-docs` }))
    const requestSession = vi.fn(() => true)
    const create = vi.fn(async () => ({ workspaceId: 'w_9' }))
    const store = await storeWith(clone, { pickDirectory: async () => '/tmp/root', create, startSession: requestSession })

    expect(store.nativeWorkspacesAvailable()).toBe(true)
    await expect(store.openCloudProject('42')).resolves.toEqual({
      path: '/tmp/root/team-docs',
      workspaceId: 'w_9',
      sessionRequested: true,
    })
    expect(clone).toHaveBeenCalledWith('42', '/tmp/root', expect.anything())
    expect(create).toHaveBeenCalledWith({ path: '/tmp/root/team-docs' })
    expect(requestSession).toHaveBeenCalledWith('w_9')
  })

  it('does not claim a session request when the official service cannot start one', async () => {
    const store = await storeWith(
      async () => ({ path: '/tmp/root/team-docs' }),
      { pickDirectory: async () => '/tmp/root', create: async () => ({ workspaceId: 'w_9' }) },
    )

    await expect(store.openCloudProject('42')).resolves.toMatchObject({ sessionRequested: false })
  })

  it('treats a cancelled picker as a no-op without cloning', async () => {
    const clone = vi.fn()
    const store = await storeWith(clone as never, { pickDirectory: async () => null, create: vi.fn() })

    await expect(store.openCloudProject('42')).rejects.toMatchObject({ code: 'ENT_WORKSPACE_PICK_CANCELLED' })
    expect(clone).not.toHaveBeenCalled()
  })

  it('keeps the mapping when registering the workspace fails', async () => {
    const clone = vi.fn(async () => ({ path: '/tmp/root/team-docs' }))
    const store = await storeWith(clone, {
      pickDirectory: async () => '/tmp/root',
      create: async () => { throw new Error('create failed') },
    })

    await expect(store.openCloudProject('42')).rejects.toThrow('create failed')
    expect(clone).toHaveBeenCalledTimes(1)
  })

  it('degrades to an explicit root directory when the official service is unavailable', async () => {
    const clone = vi.fn(async (_id: string, rootDir: string) => ({ path: `${rootDir}/team-docs` }))
    const store = await storeWith(clone)

    expect(store.nativeWorkspacesAvailable()).toBe(false)
    await expect(store.openCloudProject('42', '/tmp/root')).resolves.toEqual({
      path: '/tmp/root/team-docs',
      workspaceId: null,
      sessionRequested: false,
    })
    await expect(store.openCloudProject('42')).rejects.toMatchObject({ code: 'ENT_LOCAL_UNAVAILABLE' })
  })

  it('opens an already mapped project without asking for a directory again', async () => {
    const clone = vi.fn(async () => ({ path: '/tmp/root/team-docs' }))
    const pickDirectory = vi.fn(async () => '/somewhere/else')
    const store = await storeWith(clone, { pickDirectory, create: async () => ({ workspaceId: 'w_9' }) })

    await store.openCloudProject('42', '/tmp/root/team-docs')

    expect(pickDirectory).not.toHaveBeenCalled()
    expect(clone).toHaveBeenCalledWith('42', '/tmp/root/team-docs', expect.anything())
  })

  it('refuses to start when the account is not connected', async () => {
    const store = new EnterpriseAccountStore(
      {
        status: vi.fn(async () => ({ ...base, state: 'SIGNED_OUT' })),
        cloneCloudProject: vi.fn(),
      } as unknown as EnterpriseLocalApi,
      createOfficialWorkspacesReader({
        get: () => ({ pickDirectory: async () => '/tmp/root', create: async () => ({ workspaceId: 'w' }) }),
      }),
    )
    await store.refresh()

    await expect(store.openCloudProject('42')).rejects.toBeInstanceOf(EnterpriseLocalApiError)
  })
})
