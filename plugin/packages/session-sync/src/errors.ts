/**
 * [INPUT]: 依赖 session-sync 稳定错误码词汇
 * [OUTPUT]: 对外提供 SessionSyncError，仅 code 进入日志/状态，不携带密钥
 * [POS]: session-sync 错误分类边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type SessionSyncErrorCode = 'ENT_SESSION_CURSOR_INVALID'

export class SessionSyncError extends Error {
  readonly code: SessionSyncErrorCode

  constructor(code: SessionSyncErrorCode, message: string) {
    super(message)
    this.name = 'SessionSyncError'
    this.code = code
  }
}
