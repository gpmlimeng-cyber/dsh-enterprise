/**
 * [INPUT]: 依赖设计 §12.1/§12.2 游标、线协议与 rc.2 结构端口契约
 * [OUTPUT]: 对外提供游标文件、服务状态、寄存器 deps、Syncable 端口与上传 DTO 类型
 * [POS]: session-sync 包的类型契约边界，后续 dirty/upload 不得绕过本文件另立并行类型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const SESSION_SYNC_CURSOR_FORMAT_VERSION = 1 as const

export type SessionSyncMode = 'disabled' | 'idle' | 'uploading'

export interface SessionSyncCursors {
  readonly [sessionId: string]: number
}

export interface SessionSyncStringMap {
  readonly [key: string]: string
}

export interface SessionSyncCursorFile {
  readonly formatVersion: typeof SESSION_SYNC_CURSOR_FORMAT_VERSION
  readonly deviceId: string
  readonly cursors: SessionSyncCursors
  readonly lastPullAt: string | null
  readonly lastPushAt: string | null
  readonly lastError: string | null
  /** sessionId → 该会话已确认批次的最终 rollingHash（canonical Base64）。 */
  readonly rollingHashes?: SessionSyncStringMap
  /** sessionId → 终态错误码；命中后不自动重试。 */
  readonly terminalErrors?: SessionSyncStringMap
  /** sessionId → 最近一次成功推送时间。 */
  readonly pushedAt?: SessionSyncStringMap
}

export interface SessionSyncStatus {
  readonly mode: SessionSyncMode
  readonly deviceId: string | null
  readonly lastError: string | null
  readonly ready: boolean
  readonly pendingSessionIds: readonly string[]
}

export interface SessionSyncLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

/** Harness `SessionHeader` 在上传路径上的结构消费面（rc.2）。 */
export interface SyncableSessionHeader {
  readonly version: number
  readonly id: string
  readonly createdAt: number
  readonly cwd?: string
  readonly parentSession?: string
  readonly seedLength?: number
  readonly origin?: 'subagent'
  readonly delegationDepth?: number
  readonly agentPreset?: string
}

/** 上传路径只需事件包络字段；未知额外字段随 JSON.stringify 原样发出。 */
export interface SyncableEvent {
  readonly seq: number
  readonly time: number
  readonly type: string
  readonly data: unknown
  readonly [key: string]: unknown
}

/** live `Session` 的最小结构面，对齐 rc.2 `ctx.sessions` 消费点。 */
export interface SyncableSession {
  readonly id: string
  readonly header: SyncableSessionHeader
  readonly seq: number
}

export interface SessionStorePort {
  flush(session: SyncableSession): Promise<boolean> | boolean
}

export interface SessionPersistencePort {
  readFrom(
    id: string,
    fromSeq: number,
    signal?: AbortSignal,
  ): Promise<{
    meta: SyncableSessionHeader
    events: readonly SyncableEvent[]
  }>
}

/** T16 批次请求体（客户端发送形状）。 */
export interface SessionBatchBody {
  readonly idempotencyKey: string
  readonly fromSeq: number
  readonly toSeq: number
  readonly previousRollingHash: string
  readonly payloadSha256: string
  readonly payloadBase64: string
  readonly header: SyncableSessionHeader | null
  readonly title: string | null
}

export interface SessionBatchAccepted {
  readonly acceptedThroughSeq: number
  readonly rollingHash: string
}

/** 企业批次上传端口；实现方持有 Bearer / base URL，本包不碰 token。 */
export interface EnterpriseSessionUploaderPort {
  appendBatch(
    sessionId: string,
    body: SessionBatchBody,
    signal: AbortSignal,
  ): Promise<SessionBatchAccepted>
}

export interface RegisterSessionSyncDeps {
  readonly dshHome: string
  /** 与 bootstrap sessionPolicy.enabled / enterprise.session.enabled 对齐；默认 false。 */
  readonly enterpriseSessionEnabled: boolean
  readonly deviceId?: string
  readonly logger?: SessionSyncLogger
  /** 仅测试注入；缺省走真实 fs。 */
  readonly now?: () => Date
  /** bootstrap sessionPolicy.maxBatchBytes；默认 1MiB。 */
  readonly maxBatchBytes?: number
  /** dirty 防抖；默认 2000ms。 */
  readonly debounceMs?: number
  /** dispose 等待在途上限；默认 3000ms。 */
  readonly disposeTimeoutMs?: number
  /** 可重试错误的退避基数；默认 1000ms。 */
  readonly retryBaseMs?: number
  readonly sessions?: SessionStorePort
  readonly sessionPersistence?: SessionPersistencePort
  readonly uploader?: EnterpriseSessionUploaderPort
  /** 可选 title 投影；缺省 null。 */
  readonly titleFor?: (sessionId: string) => string | null
}

export interface SessionSyncServiceHandle {
  readonly mode: SessionSyncMode
  getStatus(): SessionSyncStatus
  markDirty(session: SyncableSession): void
  flushOnce(sessionId: string): Promise<void>
  clearSessionError(sessionId: string): Promise<void>
  dispose(): void | Promise<void>
}
