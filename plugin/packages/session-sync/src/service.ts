/**
 * [INPUT]: 依赖 types/cursor-store/upload-worker 与寄存器开关；不直接 import dsh-session
 * [OUTPUT]: 对外提供 disabled/idle/uploading 服务与无副作用 registerSessionSync
 * [POS]: session-sync 客户端服务入口；上传由 ports 注入，bundle 接线留 P2d
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ensureCursorFile } from './cursor-store.js'
import type {
  RegisterSessionSyncDeps,
  SessionSyncLogger,
  SessionSyncMode,
  SessionSyncServiceHandle,
  SessionSyncStatus,
  SyncableSession,
} from './types.js'
import { SessionUploadScheduler } from './upload-worker.js'

const NOOP_LOGGER: SessionSyncLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

const DEFAULT_MAX_BATCH_BYTES = 1024 * 1024
const DEFAULT_DEBOUNCE_MS = 2000
const DEFAULT_DISPOSE_TIMEOUT_MS = 3000
const DEFAULT_RETRY_BASE_MS = 1000

export class EnterpriseSessionSyncService implements SessionSyncServiceHandle {
  readonly mode: SessionSyncMode

  #deviceId: string | null
  #lastError: string | null
  readonly #logger: SessionSyncLogger
  readonly #dshHome: string
  readonly #scheduler: SessionUploadScheduler | null
  #ready: boolean

  constructor(options: {
    mode: SessionSyncMode
    dshHome: string
    deviceId?: string | null
    lastError?: string | null
    logger?: SessionSyncLogger
    scheduler?: SessionUploadScheduler | null
  }) {
    this.mode = options.mode
    this.#deviceId = options.deviceId ?? null
    this.#lastError = options.lastError ?? null
    this.#logger = options.logger ?? NOOP_LOGGER
    this.#dshHome = options.dshHome
    this.#scheduler = options.scheduler ?? null
    this.#ready = options.scheduler != null
  }

  getStatus(): SessionSyncStatus {
    return {
      mode: this.mode,
      deviceId: this.#deviceId,
      lastError: this.#lastError,
      ready: this.#ready && this.#scheduler !== null,
      pendingSessionIds: this.#scheduler?.pendingSessionIds ?? [],
    }
  }

  /** P2a 扩展点：启用后确保游标文件存在。 */
  async ensureCursors(): Promise<void> {
    if (this.mode === 'disabled') {
      return
    }
    if (this.#scheduler !== null) {
      const file = await this.#scheduler.ensureCursor()
      this.#deviceId = file.deviceId
      this.#lastError = file.lastError
      return
    }
    const file = await ensureCursorFile(this.#dshHome, this.#deviceId ?? undefined)
    this.#deviceId = file.deviceId
    this.#lastError = file.lastError
  }

  markDirty(session: SyncableSession): void {
    if (this.mode === 'disabled' || this.#scheduler === null) return
    this.#scheduler.markDirty(session)
  }

  async flushOnce(sessionId: string): Promise<void> {
    if (this.mode === 'disabled') {
      return
    }
    if (this.#scheduler === null) {
      throw new TypeError('session-sync upload ports are not configured')
    }
    await this.#scheduler.flushOnce(sessionId)
  }

  clearSessionError(sessionId: string): Promise<void> {
    this.#lastError = null
    if (this.#scheduler === null) return Promise.resolve()
    return this.#scheduler.clearSessionError(sessionId)
  }

  async dispose(): Promise<void> {
    this.#logger.debug('session-sync dispose')
    this.#ready = false
    if (this.#scheduler !== null) {
      await this.#scheduler.dispose()
    }
  }
}

function hasUploadPorts(deps: RegisterSessionSyncDeps): boolean {
  return deps.sessions !== undefined
    && deps.sessionPersistence !== undefined
    && deps.uploader !== undefined
}

export function registerSessionSync(
  deps: RegisterSessionSyncDeps,
): { service: SessionSyncServiceHandle; dispose: () => void } {
  const logger = deps.logger ?? NOOP_LOGGER
  if (!deps.enterpriseSessionEnabled) {
    logger.debug('session-sync disabled by enterprise session policy')
    const service = new EnterpriseSessionSyncService({
      mode: 'disabled',
      dshHome: deps.dshHome,
      logger,
    })
    return { service, dispose: () => { void service.dispose() } }
  }

  const deviceId = deps.deviceId ?? null
  let scheduler: SessionUploadScheduler | null = null
  if (hasUploadPorts(deps)) {
    scheduler = new SessionUploadScheduler({
      dshHome: deps.dshHome,
      deviceId: deviceId ?? cryptoRandomId(),
      maxBatchBytes: deps.maxBatchBytes ?? DEFAULT_MAX_BATCH_BYTES,
      debounceMs: deps.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      disposeTimeoutMs: deps.disposeTimeoutMs ?? DEFAULT_DISPOSE_TIMEOUT_MS,
      retryBaseMs: deps.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
      logger,
      now: deps.now ?? (() => new Date()),
      sessions: deps.sessions!,
      sessionPersistence: deps.sessionPersistence!,
      uploader: deps.uploader!,
      ...(deps.titleFor === undefined ? {} : { titleFor: deps.titleFor }),
    })
  }

  const service = new EnterpriseSessionSyncService({
    mode: scheduler === null ? 'idle' : 'uploading',
    dshHome: deps.dshHome,
    deviceId,
    logger,
    scheduler,
  })
  void service.ensureCursors().catch((error: unknown) => {
    void service.dispose()
    logger.warn(`session-sync cursor init failed: ${error instanceof Error ? error.name : 'Error'}`)
  })
  return { service, dispose: () => { void service.dispose() } }
}

function cryptoRandomId(): string {
  return globalThis.crypto.randomUUID()
}
