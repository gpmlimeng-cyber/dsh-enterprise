/**
 * [INPUT]: 依赖 service/cursor-store/types/errors
 * [OUTPUT]: 对外暴露 registerSessionSync、EnterpriseSessionSyncService 与游标 API
 * [POS]: @dshent/session-sync 包 facade
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export {
  EnterpriseSessionSyncService,
  registerSessionSync,
} from './service.js'
export {
  emptyCursorFile,
  ensureCursorFile,
  parseCursorFile,
  readCursorFile,
  resolveSessionSyncCursorPath,
  writeCursorFile,
} from './cursor-store.js'
export { SessionSyncError, type SessionSyncErrorCode } from './errors.js'
export {
  SESSION_SYNC_CURSOR_FORMAT_VERSION,
  type RegisterSessionSyncDeps,
  type SessionSyncCursorFile,
  type SessionSyncCursors,
  type SessionSyncLogger,
  type SessionSyncMode,
  type SessionSyncServiceHandle,
  type SessionSyncStatus,
} from './types.js'
