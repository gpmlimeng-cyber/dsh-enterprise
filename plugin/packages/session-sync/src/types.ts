/**
 * [INPUT]: 依赖设计 §12.1 游标文件与 P2a 不上传边界
 * [OUTPUT]: 对外提供游标文件、服务状态与寄存器依赖的稳定类型
 * [POS]: session-sync 包的类型契约边界，后续 dirty/upload 不得绕过本文件另立并行类型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const SESSION_SYNC_CURSOR_FORMAT_VERSION = 1 as const

export type SessionSyncMode = 'disabled' | 'idle'

export interface SessionSyncCursors {
  readonly [sessionId: string]: number
}

export interface SessionSyncCursorFile {
  readonly formatVersion: typeof SESSION_SYNC_CURSOR_FORMAT_VERSION
  readonly deviceId: string
  readonly cursors: SessionSyncCursors
  readonly lastPullAt: string | null
  readonly lastPushAt: string | null
  readonly lastError: string | null
}

export interface SessionSyncStatus {
  readonly mode: SessionSyncMode
  readonly deviceId: string | null
  readonly lastError: string | null
}

export interface SessionSyncLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface RegisterSessionSyncDeps {
  readonly dshHome: string
  /** 与 bootstrap sessionPolicy.enabled / enterprise.session.enabled 对齐；默认 false。 */
  readonly enterpriseSessionEnabled: boolean
  readonly deviceId?: string
  readonly logger?: SessionSyncLogger
  /** 仅测试注入；缺省走真实 fs。 */
  readonly now?: () => Date
}

export interface SessionSyncServiceHandle {
  readonly mode: SessionSyncMode
  getStatus(): SessionSyncStatus
  dispose(): void
}
