/**
 * [INPUT]: 依赖 CloudWorkspaceService 与注入的 AccessTokenProvider/平台端口。
 * [OUTPUT]: 对外提供 host-bridge 注册入口、createCloudWorkspaceLocalPort 与公共 re-export。
 * [POS]: cloud-workspace 的包 facade；不直接依赖 Cordis/Harness 真包。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { defaultMappingPath, MappingStore } from './mapping-store.js'
import { CloudWorkspaceError, toCloudWorkspaceError } from './errors.js'
import { createDefaultGitRunner, GitOps } from './git-ops.js'
import { CloudWorkspaceService } from './service.js'
import type {
  AccessTokenProvider,
  CloudProjectDto,
  CloudProjectListItem,
  CloudWorkspacePlatformPort,
  GitCommandRunner,
} from './types.js'

export { CloudWorkspaceError, isCloudWorkspaceError, toCloudWorkspaceError } from './errors.js'
export type { CloudWorkspaceErrorCode } from './errors.js'
export { defaultMappingPath, MappingStore } from './mapping-store.js'
export { createDefaultGitRunner, GitOps } from './git-ops.js'
export { CloudWorkspaceService } from './service.js'
export { slugify, isValidProjectId, isValidRootDir } from './slug.js'
export type {
  AccessTokenProvider,
  CloudProjectDto,
  CloudProjectListItem,
  CloudProjectMapping,
  CloudWorkspaceLogger,
  CloudWorkspacePlatformPort,
  GitCommandRunner,
} from './types.js'

export interface CloudWorkspaceDeps {
  readonly dshHome: string
  readonly platform: CloudWorkspacePlatformPort
  readonly tokens: AccessTokenProvider
  readonly runner?: GitCommandRunner
}

export interface CloudWorkspaceHandle {
  readonly service: CloudWorkspaceService
  list(signal?: AbortSignal): Promise<readonly CloudProjectListItem[]>
  create(name: string, description?: string | null, signal?: AbortSignal): Promise<CloudProjectDto>
  clone(projectId: string, rootDir: string, signal?: AbortSignal): Promise<CloudProjectListItem['mapping']>
  pull(projectId: string, signal?: AbortSignal): Promise<{ fastForward: boolean; message: string }>
  commit(projectId: string, message: string, signal?: AbortSignal): Promise<{ committed: boolean }>
  push(projectId: string, signal?: AbortSignal): Promise<void>
  status(projectId: string, signal?: AbortSignal): Promise<{ branch: string; dirty: boolean; path: string }>
}

export function createCloudWorkspaceHandle(deps: CloudWorkspaceDeps): CloudWorkspaceHandle {
  const mappings = new MappingStore(defaultMappingPath(deps.dshHome))
  const git = new GitOps(deps.runner ?? createDefaultGitRunner(), deps.tokens)
  const service = new CloudWorkspaceService(deps.platform, mappings, git)
  return {
    service,
    list: signal => service.list(signal),
    create: (name, description, signal) => service.create(name, description, signal),
    clone: (projectId, rootDir, signal) => service.clone(projectId, rootDir, signal),
    pull: (projectId, signal) => service.pull(projectId, signal),
    commit: (projectId, message, signal) => service.commit(projectId, message, signal),
    push: (projectId, signal) => service.push(projectId, signal),
    status: (projectId, signal) => service.status(projectId, signal),
  }
}

export interface CloudWorkspaceLocalPort {
  list(): Promise<unknown>
  create(body: { name: string; description?: string | null }): Promise<unknown>
  clone(projectId: string, body: { rootDir: string }): Promise<unknown>
  pull(projectId: string): Promise<unknown>
  commit(projectId: string, body: { message: string }): Promise<unknown>
  push(projectId: string): Promise<unknown>
  status(projectId: string): Promise<unknown>
}

export function createCloudWorkspaceLocalPort(
  getHandle: () => CloudWorkspaceHandle | null,
): CloudWorkspaceLocalPort {
  const require = (): CloudWorkspaceHandle => {
    const handle = getHandle()
    if (handle === null) {
      throw new CloudWorkspaceError('ENT_WORKSPACE_DISABLED', '云端工作空间不可用', 403)
    }
    return handle
  }
  return {
    list: async () => {
      try {
        return await require().list()
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
    create: async (body) => {
      try {
        return await require().create(body.name, body.description ?? null)
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
    clone: async (projectId, body) => {
      try {
        return await require().clone(projectId, body.rootDir)
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
    pull: async (projectId) => {
      try {
        return await require().pull(projectId)
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
    commit: async (projectId, body) => {
      try {
        return await require().commit(projectId, body.message)
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
    push: async (projectId) => {
      try {
        return await require().push(projectId)
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
    status: async (projectId) => {
      try {
        return await require().status(projectId)
      } catch (error) {
        throw toCloudWorkspaceError(error)
      }
    },
  }
}
