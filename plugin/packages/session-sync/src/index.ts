/**
 * [INPUT]: 依赖 service/cursor-store/types/errors/batch/hash/wire/upload-worker/host-bridge
 * [OUTPUT]: 对外暴露 registerSessionSync、EnterpriseSessionSyncService、游标、上传原语与 Host 桥
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
export {
  SessionSyncError,
  SessionUploadError,
  TERMINAL_SESSION_SYNC_CODES,
  isTerminalSessionSyncCode,
  uploadErrorFromResponse,
  type SessionSyncErrorCode,
} from './errors.js'
export {
  HASH_BYTES,
  INITIAL_ROLLING_HASH,
  decodeRollingHash,
  rollingHash,
  rollingHashBase64,
  sha256Base64,
} from './hash.js'
export {
  buildJsonlPayload,
  encodeEventLine,
  sliceEventsByBytes,
  splitSessionEvents,
  type EventSlice,
} from './batch.js'
export {
  buildIdempotencyKey,
  finalRollingHash,
  toSessionBatchBody,
} from './wire.js'
export { SessionUploadScheduler, type SessionUploadSchedulerOptions } from './upload-worker.js'
export {
  downloadOwnedSession,
  listRemoteSessions,
  restoreRemoteSession,
  type DownloadedOwnedSession,
  type RemoteSessionRequestPort,
  type RemoteSessionSummary,
  type RestoreRemoteOptions,
  type RestoreRemoteResult,
  type SessionCreatePort,
} from './restore.js'
export {
  createHostSessionLocalPort,
  type CreateHostSessionLocalPortOptions,
  type HostSessionLocalPort,
  type HostSessionLocalStatus,
} from './local-port.js'
export {
  isHostSessionSyncEnabled,
  tryRegisterHostSessionSync,
  type HostBootstrapPort,
  type HostPlatformPort,
  type HostPlatformStatusPort,
  type HostSessionPolicyPort,
  type HostSessionRuntimePort,
  type HostSessionSyncHandle,
  type TryRegisterHostSessionSyncOptions,
} from './host-bridge.js'
export {
  SESSION_SYNC_CURSOR_FORMAT_VERSION,
  type EnterpriseSessionUploaderPort,
  type RegisterSessionSyncDeps,
  type SessionBatchAccepted,
  type SessionBatchBody,
  type SessionPersistencePort,
  type SessionStorePort,
  type SessionSyncCursorFile,
  type SessionSyncCursors,
  type SessionSyncLogger,
  type SessionSyncMode,
  type SessionSyncServiceHandle,
  type SessionSyncStatus,
  type SessionSyncStringMap,
  type SyncableEvent,
  type SyncableSession,
  type SyncableSessionHeader,
} from './types.js'
