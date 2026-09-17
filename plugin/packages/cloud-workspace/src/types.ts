/**
 * [INPUT]: 依赖云端项目 wire DTO 与本地映射事实。
 * [OUTPUT]: 对外提供 CloudProject、本地映射状态、clone/pull/commit/push 请求与 AccessToken 端口类型。
 * [POS]: cloud-workspace 的公共类型层；不含 Git 执行或 HTTP 实现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface CloudProjectDto {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly defaultBranch: string
  readonly role: 'OWNER' | 'MEMBER'
  readonly cloneUrl: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CloudProjectMapping {
  readonly projectId: string
  readonly slug: string
  readonly path: string
  readonly cloneUrl: string
  readonly defaultBranch: string
  readonly lastActionAt: string
}

export interface CloudProjectListItem extends CloudProjectDto {
  readonly mapping: CloudProjectMapping | null
}

export interface AccessTokenProvider {
  getAccessToken(): Promise<string>
}

export interface CloudWorkspaceLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface GitCommandRunner {
  run(
    cwd: string | null,
    argv: readonly string[],
    env: NodeJS.ProcessEnv,
    signal?: AbortSignal,
  ): Promise<{
    readonly exitCode: number
    readonly stdout: string
    readonly stderr: string
  }>
}

export interface CloudWorkspaceBootstrapFacts {
  readonly cloudWorkspaceEnabled?: boolean
  readonly sessionPolicy?: { readonly enabled?: boolean }
}

export interface CloudWorkspacePlatformPort {
  request(path: string, init?: RequestInit): Promise<Response>
  bootstrap(): CloudWorkspaceBootstrapFacts | undefined
}
