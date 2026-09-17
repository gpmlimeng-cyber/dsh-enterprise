/**
 * [INPUT]: 接收云端工作空间可预期失败的稳定错误码。
 * [OUTPUT]: 对外提供 CloudWorkspaceError 与错误码常量。
 * [POS]: cloud-workspace 的错误边界，供本地 API 与 UI 映射 HTTP 状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type CloudWorkspaceErrorCode =
  | 'ENT_WORKSPACE_DISABLED'
  | 'ENT_WORKSPACE_NOT_MAPPED'
  | 'ENT_GIT_NON_FAST_FORWARD'
  | 'ENT_GIT_UNAVAILABLE'
  | 'ENT_INVALID_REQUEST'
  | 'ENT_RESOURCE_NOT_FOUND'
  | 'ENT_AUTH_REQUIRED'

export class CloudWorkspaceError extends Error {
  constructor(
    readonly code: CloudWorkspaceErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'CloudWorkspaceError'
  }
}

export function isCloudWorkspaceError(error: unknown): error is CloudWorkspaceError {
  return error instanceof CloudWorkspaceError
}

export function toCloudWorkspaceError(error: unknown): CloudWorkspaceError {
  if (isCloudWorkspaceError(error)) return error
  return new CloudWorkspaceError('ENT_INVALID_REQUEST', error instanceof Error ? error.message : String(error), 400, error)
}
