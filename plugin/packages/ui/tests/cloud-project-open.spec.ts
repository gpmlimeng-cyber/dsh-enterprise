/**
 * [INPUT]: 依赖 EnterpriseAccountStore、官方工作区端口读取器与可控本地 API 替身。
 * [OUTPUT]: 验证原生选目录→clone→登记工作区→进会话的编排、取消语义与端口缺失时的降级。
 * [POS]: dsh-ui 云端项目「与本地项目一致体验」的行为门禁。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import { EnterpriseAccountStore } from '../src/account-store.js'
import { EnterpriseLocalApiError } from '../src/local-api.js'
import type { EnterpriseLocalApi } from '../src/local-api.js'
import { readOfficialWorkspaces } from '../src/workspaces-port.js'

function apiWith(clone: (projectId: string, rootDir: string) => Promise<{ path: string }>): EnterpriseLocalApi {
  return {
    cloneCloudProject: vi.fn(clone),
    listCloudProjects: vi.fn(async () => []),
  } as unknown as EnterpriseLocalApi
}

describe('readOfficialWorkspaces', () => {
  it('returns undefined when the service is absent or incomplete', () => {
    expect(readOfficialWorkspaces(undefined)).toBeUndefined()
    expect(readOfficialWorkspaces({})).toBeUndefined()
    expect(readOfficialWorkspaces({ get: () => undefined })).toBeUndefined()
    expect(readOfficialWorkspaces({ get: () => ({ pickDirectory: () => null }) })).toBeUndefined()
  })

  it('adapts a complete official service and validates the created id', async () => {
    const create = vi.fn(async () => ({ id: 'w_1' }))
    const port = readOfficialWorkspaces({
      get: (name: string) => (name === 'workspaces' ? { pickDirectory: async () => '/tmp/root', create, startSession: () => undefined } : undefined),
    })
    expect(port).toBeDefined()
    await expect(port!.pickDirectory()).resolves.toBe('/tmp/root')
    await expect(port!.create({ path: '/tmp/root/x' })).resolves.toEqual({ id: 'w_1' })
    expect(create).toHaveBeenCalledWith({ path: '/tmp/root/x' })

    const broken = readOfficialWorkspaces({ get: () => ({ pickDirectory: async () => null, create: async () => ({}) }) })
    await expect(broken!.create({ path: '/x' })).rejects.toThrow('official workspace create returned no id')
  })
})

describe('EnterpriseAccountStore.openCloudProject', () => {
  it('picks a directory, clones, registers a native workspace and enters its session', async () => {
    const clone = vi.fn(async (_id: string, rootDir: string) => ({ path: `${rootDir}/team-docs` }))
    const startSession = vi.fn()
    const create = vi.fn(async () => ({ id: 'w_9' }))
    const store = new EnterpriseAccountStore(apiWith(clone), {
      pickDirectory: async () => '/tmp/root',
      create,
      startSession,
    })

    expect(store.nativeWorkspacesAvailable).toBe(true)
    await expect(store.openCloudProject('42')).resolves.toEqual({
      path: '/tmp/root/team-docs',
      workspaceId: 'w_9',
      enteredSession: true,
    })
    expect(clone).toHaveBeenCalledWith('42', '/tmp/root', expect.anything())
    expect(create).toHaveBeenCalledWith({ path: '/tmp/root/team-docs' })
    expect(startSession).toHaveBeenCalledWith('w_9')
  })

  it('treats a cancelled picker as a no-op without cloning', async () => {
    const clone = vi.fn()
    const store = new EnterpriseAccountStore(apiWith(clone as never), {
      pickDirectory: async () => null,
      create: vi.fn(),
      startSession: vi.fn(),
    })

    await expect(store.openCloudProject('42')).rejects.toMatchObject({ code: 'ENT_WORKSPACE_PICK_CANCELLED' })
    expect(clone).not.toHaveBeenCalled()
  })

  it('keeps the mapping when entering the session fails', async () => {
    const store = new EnterpriseAccountStore(
      apiWith(async () => ({ path: '/tmp/root/team-docs' })),
      {
        pickDirectory: async () => '/tmp/root',
        create: async () => ({ id: 'w_9' }),
        startSession: () => { throw new Error('session flow unavailable') },
      },
    )

    await expect(store.openCloudProject('42')).resolves.toEqual({
      path: '/tmp/root/team-docs',
      workspaceId: 'w_9',
      enteredSession: false,
    })
  })

  it('degrades to an explicit root directory when the official service is unavailable', async () => {
    const clone = vi.fn(async (_id: string, rootDir: string) => ({ path: `${rootDir}/team-docs` }))
    const store = new EnterpriseAccountStore(apiWith(clone))

    expect(store.nativeWorkspacesAvailable).toBe(false)
    await expect(store.openCloudProject('42', '/tmp/root')).resolves.toEqual({
      path: '/tmp/root/team-docs',
      workspaceId: null,
      enteredSession: false,
    })
    await expect(store.openCloudProject('42')).rejects.toBeInstanceOf(EnterpriseLocalApiError)
  })

  it('opens an already mapped project without asking for a directory again', async () => {
    const clone = vi.fn(async () => ({ path: '/tmp/root/team-docs' }))
    const pickDirectory = vi.fn(async () => '/somewhere/else')
    const store = new EnterpriseAccountStore(apiWith(clone), {
      pickDirectory,
      create: async () => ({ id: 'w_9' }),
      startSession: vi.fn(),
    })

    await store.openCloudProject('42', '/tmp/root/team-docs')

    expect(pickDirectory).not.toHaveBeenCalled()
    expect(clone).toHaveBeenCalledWith('42', '/tmp/root/team-docs', expect.anything())
  })
})
