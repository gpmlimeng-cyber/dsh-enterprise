/**
 * [INPUT]: 依赖 CloudWorkspacePlatformPort、MappingStore、GitOps 与路径/slug 校验。
 * [OUTPUT]: 对外提供 list/create/clone/pull/commit/push/status/addMember 用例与本地映射合并视图。
 * [POS]: cloud-workspace 的应用服务；HTTP 细节留在注入端口，不直接读写 Host Token 存储。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CloudWorkspaceError, type CloudWorkspaceErrorCode } from './errors.js'
import type { GitOps } from './git-ops.js'
import type { MappingStore } from './mapping-store.js'
import { isValidProjectId, isValidProjectSlug, isValidRootDir, slugify } from './slug.js'
import type {
  CloudProjectDto,
  CloudProjectListItem,
  CloudProjectMapping,
  CloudProjectMemberDto,
  CloudWorkspacePlatformPort,
} from './types.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeProject(value: unknown): CloudProjectDto {
  if (!isRecord(value)
    || typeof value['id'] !== 'string' || !isValidProjectId(value['id'])
    || typeof value['slug'] !== 'string' || !isValidProjectSlug(value['slug'])
    || typeof value['name'] !== 'string'
    || typeof value['cloneUrl'] !== 'string'
    || (value['role'] !== 'OWNER' && value['role'] !== 'MEMBER')) {
    throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '云端项目响应不合法', 400)
  }
  return {
    id: value['id'],
    slug: value['slug'],
    name: value['name'],
    description: typeof value['description'] === 'string' ? value['description'] : null,
    defaultBranch: typeof value['defaultBranch'] === 'string' && value['defaultBranch'].length > 0
      ? value['defaultBranch']
      : 'main',
    role: value['role'],
    cloneUrl: value['cloneUrl'],
    createdAt: typeof value['createdAt'] === 'string' ? value['createdAt'] : '',
    updatedAt: typeof value['updatedAt'] === 'string' ? value['updatedAt'] : '',
  }
}

function decodeProjectList(value: unknown): CloudProjectDto[] {
  if (!Array.isArray(value)) {
    throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '云端项目列表响应不合法', 400)
  }
  return value.map(decodeProject)
}

const KNOWN_CODES = new Set<string>([
  'ENT_WORKSPACE_DISABLED',
  'ENT_WORKSPACE_NOT_MAPPED',
  'ENT_WORKSPACE_FORBIDDEN',
  'ENT_WORKSPACE_SLUG_CONFLICT',
  'ENT_WORKSPACE_LAST_OWNER',
  'ENT_GIT_UNAVAILABLE',
  'ENT_INVALID_REQUEST',
  'ENT_RESOURCE_NOT_FOUND',
  'ENT_AUTH_REQUIRED',
])

const STATUS_TO_CODE: Readonly<Record<number, CloudWorkspaceErrorCode>> = {
  400: 'ENT_INVALID_REQUEST',
  401: 'ENT_AUTH_REQUIRED',
  403: 'ENT_WORKSPACE_FORBIDDEN',
  404: 'ENT_RESOURCE_NOT_FOUND',
  409: 'ENT_INVALID_REQUEST',
}

export class CloudWorkspaceService {
  constructor(
    private readonly platform: CloudWorkspacePlatformPort,
    private readonly mappings: MappingStore,
    private readonly git: GitOps,
  ) {}

  /** 优先采用服务端 envelope 的稳定 code，仅在缺失时按 HTTP 状态回退。 */
  private async json<T>(path: string, init: RequestInit, decode: (value: unknown) => T): Promise<T> {
    const response = await this.platform.request(path, init)
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = undefined
    }
    const envelope = isRecord(body) ? body : undefined
    if (!response.ok) {
      const raw = envelope === undefined ? undefined : envelope['error']
      const code = isRecord(raw) && typeof raw['code'] === 'string' && KNOWN_CODES.has(raw['code'])
        ? raw['code'] as CloudWorkspaceErrorCode
        : STATUS_TO_CODE[response.status] ?? 'ENT_INVALID_REQUEST'
      throw new CloudWorkspaceError(code, `云端工作空间请求失败（HTTP ${response.status}）`, response.status)
    }
    if (envelope === undefined) {
      throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '云端工作空间响应不合法', 400)
    }
    return decode(envelope['data'])
  }

  requireEnabled(): void {
    if (this.platform.bootstrap()?.cloudWorkspaceEnabled !== true) {
      throw new CloudWorkspaceError('ENT_WORKSPACE_DISABLED', '云端工作空间未启用', 403)
    }
  }

  async list(signal?: AbortSignal): Promise<readonly CloudProjectListItem[]> {
    this.requireEnabled()
    const projects = await this.json(
      '/enterprise/api/v1/cloud-projects',
      { method: 'GET', ...(signal === undefined ? {} : { signal }) },
      decodeProjectList,
    )
    return projects.map(project => ({
      ...project,
      mapping: this.mappings.get(project.id),
    }))
  }

  async create(name: string, description?: string | null, signal?: AbortSignal): Promise<CloudProjectDto> {
    this.requireEnabled()
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '项目名称不合法', 400)
    }
    return this.json(
      '/enterprise/api/v1/cloud-projects',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description ?? null }),
        ...(signal === undefined ? {} : { signal }),
      },
      decodeProject,
    )
  }

  async addMember(
    projectId: string,
    userId: string,
    signal?: AbortSignal,
  ): Promise<CloudProjectMemberDto> {
    this.requireEnabled()
    if (!isValidProjectId(projectId) || !isValidProjectId(userId)) {
      throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '项目或成员标识不合法', 400)
    }
    return this.json(
      `/enterprise/api/v1/cloud-projects/${encodeURIComponent(projectId)}/members`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
        ...(signal === undefined ? {} : { signal }),
      },
      (value) => {
        if (!isRecord(value) || typeof value['userId'] !== 'string') {
          throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '成员响应不合法', 400)
        }
        return { userId: value['userId'], role: typeof value['role'] === 'string' ? value['role'] : 'MEMBER' }
      },
    )
  }

  async clone(projectId: string, rootDir: string, signal?: AbortSignal): Promise<CloudProjectMapping> {
    this.requireEnabled()
    if (!isValidProjectId(projectId) || !isValidRootDir(rootDir)) {
      throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '项目或根目录不合法', 400)
    }
    const existing = this.mappings.get(projectId)
    if (existing !== null && existsSync(existing.path)) return existing
    const list = await this.list(signal)
    const project = list.find(value => value.id === projectId)
    if (project === undefined) {
      throw new CloudWorkspaceError('ENT_RESOURCE_NOT_FOUND', '云端项目不存在', 404)
    }
    // 服务端 slug 已由 decodeProject 按语法校验，拼接前再确认一次避免路径逃逸。
    const slug = isValidProjectSlug(project.slug) ? project.slug : slugify(project.name)
    const targetPath = join(rootDir, slug)
    if (existsSync(targetPath)) {
      throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '本地目录已存在', 400)
    }
    await this.git.clone(project.cloneUrl, targetPath, signal)
    const mapping: CloudProjectMapping = {
      projectId: project.id,
      slug,
      path: targetPath,
      cloneUrl: project.cloneUrl,
      defaultBranch: project.defaultBranch,
      lastActionAt: new Date().toISOString(),
    }
    this.mappings.put(mapping)
    return mapping
  }

  private requireMapping(projectId: string): CloudProjectMapping {
    const mapping = this.mappings.get(projectId)
    if (mapping === null || !existsSync(mapping.path)) {
      throw new CloudWorkspaceError('ENT_WORKSPACE_NOT_MAPPED', '尚未映射本地目录', 400)
    }
    return mapping
  }

  async status(projectId: string, signal?: AbortSignal): Promise<{
    branch: string
    dirty: boolean
    path: string
  }> {
    this.requireEnabled()
    const mapping = this.requireMapping(projectId)
    const status = await this.git.status(mapping.path, signal)
    return { ...status, path: mapping.path }
  }

  async pull(projectId: string, signal?: AbortSignal): Promise<{ fastForward: boolean; message: string }> {
    this.requireEnabled()
    const mapping = this.requireMapping(projectId)
    const result = await this.git.pullFfOnly(mapping.path, signal)
    this.touch(mapping)
    if (!result.fastForward) {
      return {
        fastForward: false,
        message: '存在分叉，未能 fast-forward；请在本地手动 merge 后再 pull/push',
      }
    }
    return { fastForward: true, message: '已同步远端' }
  }

  async commit(projectId: string, message: string, signal?: AbortSignal): Promise<{ committed: boolean }> {
    this.requireEnabled()
    const mapping = this.requireMapping(projectId)
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new CloudWorkspaceError('ENT_INVALID_REQUEST', '提交说明不能为空', 400)
    }
    const result = await this.git.commitAll(mapping.path, message.trim(), signal)
    this.touch(mapping)
    return result
  }

  async push(projectId: string, signal?: AbortSignal): Promise<void> {
    this.requireEnabled()
    const mapping = this.requireMapping(projectId)
    await this.git.push(mapping.path, signal)
    this.touch(mapping)
  }

  private touch(mapping: CloudProjectMapping): void {
    this.mappings.put({
      ...mapping,
      lastActionAt: new Date().toISOString(),
    })
  }
}
