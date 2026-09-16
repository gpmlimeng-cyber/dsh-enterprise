/**
 * [INPUT]: 依赖 session-sync 稳定错误码词汇与 T16 终态集合
 * [OUTPUT]: 对外提供 SessionSyncError、终态判定与上传错误，仅 code 进入日志/状态
 * [POS]: session-sync 错误分类边界；终态集合与服务端 ENT_SESSION_* 对齐
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type SessionSyncErrorCode =
  | 'ENT_SESSION_CURSOR_INVALID'
  | 'ENT_SESSION_SYNC_DISABLED'
  | 'ENT_SESSION_SYNC_NOT_READY'
  | 'ENT_SESSION_SEQ_GAP'
  | 'ENT_SESSION_DIVERGED'
  | 'ENT_SESSION_SOURCE_DEVICE_CONFLICT'
  | 'ENT_SESSION_FORMAT_UNSUPPORTED'
  | 'ENT_SESSION_CONTENT_EXPIRED'
  | 'ENT_SESSION_BATCH_TOO_LARGE'
  | 'ENT_SESSION_UPLOAD_FAILED'
  | 'ENT_SESSION_READ_FAILED'

/** 服务端返回后不得自动重试的封闭集合（设计 §16.4）。 */
export const TERMINAL_SESSION_SYNC_CODES = new Set<SessionSyncErrorCode>([
  'ENT_SESSION_SEQ_GAP',
  'ENT_SESSION_DIVERGED',
  'ENT_SESSION_SOURCE_DEVICE_CONFLICT',
  'ENT_SESSION_FORMAT_UNSUPPORTED',
  'ENT_SESSION_CONTENT_EXPIRED',
  'ENT_SESSION_BATCH_TOO_LARGE',
])

export function isTerminalSessionSyncCode(code: string): code is SessionSyncErrorCode {
  return TERMINAL_SESSION_SYNC_CODES.has(code as SessionSyncErrorCode)
}

export class SessionSyncError extends Error {
  readonly code: SessionSyncErrorCode

  constructor(code: SessionSyncErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SessionSyncError'
    this.code = code
  }
}

export class SessionUploadError extends SessionSyncError {
  readonly status: number | null
  readonly retryable: boolean

  constructor(
    code: SessionSyncErrorCode,
    message: string,
    options: { status?: number | null; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(code, message, options)
    this.name = 'SessionUploadError'
    this.status = options.status ?? null
    this.retryable = options.retryable ?? !isTerminalSessionSyncCode(code)
  }
}

export function uploadErrorFromResponse(
  status: number,
  code: string | null,
): SessionUploadError {
  const stable = (code && isTerminalSessionSyncCode(code) ? code : null)
    ?? (status === 413 ? 'ENT_SESSION_BATCH_TOO_LARGE' as const : null)
  if (stable !== null) {
    return new SessionUploadError(stable, `session batch rejected: ${stable}`, {
      status,
      retryable: false,
    })
  }
  return new SessionUploadError(
    'ENT_SESSION_UPLOAD_FAILED',
    `session batch failed with HTTP ${status}`,
    { status, retryable: status >= 500 || status === 429 || status === 401 },
  )
}
