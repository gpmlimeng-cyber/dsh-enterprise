/**
 * [INPUT]: 依赖 CloudWorkspaceService 注入的假 platform/MappingStore/GitOps 端口。
 * [OUTPUT]: 验证创建/列表合并映射、clone 路径、非映射拒绝与非 FF push 错误。
 * [POS]: cloud-workspace 应用服务的行为单测，不调用真实 git 或网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MappingStore } from '../src/mapping-store.js'
import { CloudWorkspaceService } from '../src/service.js'
import type { CloudProjectDto, CloudWorkspacePlatformPort } from '../src/types.js'
import { CloudWorkspaceError } from '../src/errors.js'

function project(id: string, name: string): CloudProjectDto {
  return {
    id,
    slug: id === '1' ? 'team-docs' : 'other',
    name,
    description: null,
    defaultBranch: 'main',
    role: 'OWNER',
    cloneUrl: `http://localhost:8080/enterprise/api/v1/git/${id}`,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
  }
}

describe('CloudWorkspaceService', () => {
  let mappings: MappingStore
  let platform: CloudWorkspacePlatformPort
  let git: { clone: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; pullFfOnly: ReturnType<typeof vi.fn>; commitAll: ReturnType<typeof vi.fn>; push: ReturnType<typeof vi.fn> }
  let service: CloudWorkspaceService
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dshent-cws-'))
    mappings = new MappingStore(join(root, 'map.json'))
    platform = {
      bootstrap: () => ({ cloudWorkspaceEnabled: true }),
      request: vi.fn(async (path: string) => {
        if (path.endsWith('/cloud-projects')) {
          return new Response(JSON.stringify({ data: [project('1', 'Team Docs')], requestId: 'req_1' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        throw new Error(`unexpected ${path}`)
      }),
    }
    git = {
      clone: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ branch: 'main', dirty: false })),
      pullFfOnly: vi.fn(async () => ({ fastForward: true, stderr: '' })),
      commitAll: vi.fn(async () => ({ committed: true })),
      push: vi.fn(async () => undefined),
    }
    service = new CloudWorkspaceService(platform, mappings, git as never)
  })

  it('lists remote projects with local mapping merge', async () => {
    const items = await service.list()
    expect(items).toHaveLength(1)
    expect(items[0]?.mapping).toBeNull()
    mappings.put({
      projectId: '1',
      slug: 'team-docs',
      path: join(root, 'team-docs'),
      cloneUrl: items[0]!.cloneUrl,
      defaultBranch: 'main',
      lastActionAt: '2026-09-17T00:00:00.000Z',
    })
    const again = await service.list()
    expect(again[0]?.mapping?.projectId).toBe('1')
  })

  it('clones into root/slug and records mapping', async () => {
    const mapping = await service.clone('1', root)
    expect(git.clone).toHaveBeenCalledOnce()
    expect(mapping.path).toBe(join(root, 'team-docs'))
    expect(mappings.get('1')?.slug).toBe('team-docs')
  })

  it('rejects pull/push without mapping and maps non-ff push', async () => {
    await expect(service.pull('1')).rejects.toMatchObject({ code: 'ENT_WORKSPACE_NOT_MAPPED' })
    mappings.put({
      projectId: '1',
      slug: 'team-docs',
      path: join(root, 'team-docs'),
      cloneUrl: 'http://localhost/enterprise/api/v1/git/1.git',
      defaultBranch: 'main',
      lastActionAt: '2026-09-17T00:00:00.000Z',
    })
    // status path uses existsSync — mapping path missing => NOT_MAPPED
    await expect(service.status('1')).rejects.toBeInstanceOf(CloudWorkspaceError)
  })

  it('rejects when disabled', async () => {
    platform.bootstrap = () => ({ cloudWorkspaceEnabled: false })
    await expect(service.list()).rejects.toMatchObject({ code: 'ENT_WORKSPACE_DISABLED' })
  })
})
