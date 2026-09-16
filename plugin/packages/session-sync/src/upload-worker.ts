/**
 * [INPUT]: 依赖 dirty 集合、防抖时钟、flush/readFrom/uploader 端口与游标原子写
 * [OUTPUT]: 对外提供 SessionUploadScheduler：单 session worker、切批上传、终态与 dispose
 * [POS]: session-sync 上传编排核心；网络永不进入 append 路径，仅由 markDirty 触发
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { splitSessionEvents } from './batch.js'
import { ensureCursorFile, readCursorFile, writeCursorFile } from './cursor-store.js'
import {
  SessionSyncError,
  SessionUploadError,
  isTerminalSessionSyncCode,
} from './errors.js'
import { INITIAL_ROLLING_HASH } from './hash.js'
import type {
  EnterpriseSessionUploaderPort,
  SessionPersistencePort,
  SessionStorePort,
  SessionSyncCursorFile,
  SessionSyncLogger,
  SyncableEvent,
  SyncableSession,
  SyncableSessionHeader,
} from './types.js'
import { finalRollingHash, toSessionBatchBody } from './wire.js'

export interface SessionUploadSchedulerOptions {
  readonly dshHome: string
  readonly deviceId: string
  readonly maxBatchBytes: number
  readonly debounceMs: number
  readonly disposeTimeoutMs: number
  readonly retryBaseMs: number
  readonly logger: SessionSyncLogger
  readonly now: () => Date
  readonly sessions: SessionStorePort
  readonly sessionPersistence: SessionPersistencePort
  readonly uploader: EnterpriseSessionUploaderPort
  readonly titleFor?: (sessionId: string) => string | null
}

interface SessionEntry {
  dirty: boolean
  timer: NodeJS.Timeout | null
  running: Promise<void> | null
  session: SyncableSession | null
  disposed: boolean
  retryAttempt: number
  retryTimer: NodeJS.Timeout | null
}

export class SessionUploadScheduler {
  readonly #options: SessionUploadSchedulerOptions
  readonly #entries = new Map<string, SessionEntry>()
  readonly #liveSessions = new Map<string, SyncableSession>()
  readonly #abortControllers = new Set<AbortController>()
  #cursor: SessionSyncCursorFile | null = null
  #cursorWrite: Promise<void> = Promise.resolve()
  #disposed = false
  #inFlight = new Set<Promise<unknown>>()

  constructor(options: SessionUploadSchedulerOptions) {
    this.#options = options
  }

  get pendingSessionIds(): string[] {
    const ids = new Set<string>()
    for (const [id, entry] of this.#entries) {
      if (entry.dirty || entry.running !== null) ids.add(id)
    }
    return [...ids]
  }

  markDirty(session: SyncableSession): void {
    if (this.#disposed) return
    this.#liveSessions.set(session.id, session)
    const entry = this.#ensureEntry(session.id)
    entry.session = session
    entry.dirty = true
    if (entry.timer !== null || entry.running !== null || entry.retryTimer !== null) return
    const timer = setTimeout(() => {
      entry.timer = null
      void this.#kick(session.id)
    }, this.#options.debounceMs)
    timer.unref?.()
    entry.timer = timer
  }

  async flushOnce(sessionId: string): Promise<void> {
    if (this.#disposed) {
      throw new SessionSyncError('ENT_SESSION_SYNC_DISABLED', 'scheduler disposed')
    }
    const entry = this.#ensureEntry(sessionId)
    entry.dirty = false
    await this.#kick(sessionId)
  }

  clearSessionError(sessionId: string): Promise<void> {
    const entry = this.#entries.get(sessionId)
    if (entry !== undefined) {
      entry.retryAttempt = 0
      if (entry.retryTimer !== null) {
        clearTimeout(entry.retryTimer)
        entry.retryTimer = null
      }
    }
    return this.#mutateCursor(file => ({
      ...file,
      lastError: null,
      terminalErrors: omitKey(file.terminalErrors ?? {}, sessionId),
    })).catch((error: unknown) => {
      this.#options.logger.warn(`session-sync clear error failed: ${errorCode(error)}`)
    })
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    for (const entry of this.#entries.values()) {
      entry.disposed = true
      if (entry.timer !== null) {
        clearTimeout(entry.timer)
        entry.timer = null
      }
      if (entry.retryTimer !== null) {
        clearTimeout(entry.retryTimer)
        entry.retryTimer = null
      }
    }
    for (const controller of this.#abortControllers) {
      controller.abort(new DOMException('session-sync disposed', 'AbortError'))
    }
    this.#abortControllers.clear()
    const running = [...this.#inFlight]
    const timeout = new Promise<void>(resolve => {
      const timer = setTimeout(resolve, this.#options.disposeTimeoutMs)
      timer.unref?.()
    })
    await Promise.race([Promise.allSettled(running).then(() => undefined), timeout])
    this.#liveSessions.clear()
  }

  async ensureCursor(): Promise<SessionSyncCursorFile> {
    const file = await ensureCursorFile(this.#options.dshHome, this.#options.deviceId)
    this.#cursor = file
    return file
  }

  #ensureEntry(sessionId: string): SessionEntry {
    let entry = this.#entries.get(sessionId)
    if (entry === undefined) {
      entry = {
        dirty: false,
        timer: null,
        running: null,
        session: this.#liveSessions.get(sessionId) ?? null,
        disposed: false,
        retryAttempt: 0,
        retryTimer: null,
      }
      this.#entries.set(sessionId, entry)
    }
    return entry
  }

  async #kick(sessionId: string): Promise<void> {
    const entry = this.#ensureEntry(sessionId)
    if (this.#disposed || entry.disposed) return
    if (entry.running !== null) {
      entry.dirty = true
      await entry.running
      return
    }
    const task = this.#runSession(sessionId, entry).finally(() => {
      entry.running = null
      this.#inFlight.delete(task)
    })
    entry.running = task
    this.#inFlight.add(task)
    await task
  }

  async #runSession(sessionId: string, entry: SessionEntry): Promise<void> {
    for (let guard = 0; guard < 64; guard += 1) {
      if (this.#disposed || entry.disposed) return
      if (entry.retryTimer !== null) return
      entry.dirty = false
      try {
        await this.#uploadOnce(sessionId, entry)
      } catch (error) {
        if (isAbortError(error) && (this.#disposed || entry.disposed)) return
        await this.#handleSessionFailure(sessionId, entry, error)
        return
      }
      if (entry.dirty && !this.#disposed && !entry.disposed) {
        continue
      }
      return
    }
    this.#options.logger.warn(`session-sync drain guard tripped for ${sessionId}`)
  }

  async #uploadOnce(sessionId: string, entry: SessionEntry): Promise<void> {
    const cursor = await this.#loadCursor()
    if ((cursor.terminalErrors ?? {})[sessionId] !== undefined) {
      return
    }
    const live = entry.session ?? this.#liveSessions.get(sessionId) ?? null
    if (live !== null) {
      try {
        await this.#options.sessions.flush(live)
      } catch (error) {
        this.#options.logger.debug(`session-sync flush failed for ${sessionId}: ${errorCode(error)}`)
      }
    }
    const fromSeq = (cursor.cursors[sessionId] ?? -1) + 1
    const readController = this.#createController()
    let meta: SyncableSessionHeader
    let events: readonly SyncableEvent[]
    try {
      const page = await this.#track(
        this.#options.sessionPersistence.readFrom(sessionId, fromSeq, readController.signal),
      )
      meta = page.meta
      events = page.events
    } catch (error) {
      if (isAbortError(error) || this.#disposed || entry.disposed) return
      throw new SessionSyncError(
        'ENT_SESSION_READ_FAILED',
        `session persistence read failed for ${sessionId}`,
        { cause: error },
      )
    }
    if (this.#disposed || entry.disposed) return
    if (events.length === 0) return

    const slices = splitSessionEvents(events, {
      maxBatchBytes: this.#options.maxBatchBytes,
    })
    let previousRollingHash = (cursor.rollingHashes ?? {})[sessionId] ?? INITIAL_ROLLING_HASH
    const title = this.#options.titleFor?.(sessionId) ?? null

    for (const slice of slices) {
      if (this.#disposed || entry.disposed) return
      const body = toSessionBatchBody({
        deviceId: this.#options.deviceId,
        sessionId,
        slice,
        previousRollingHash,
        header: slice.isFirstSlice ? meta : null,
        title,
      })
      const batchController = this.#createController()
      const accepted = await this.#track(
        this.#options.uploader.appendBatch(sessionId, body, batchController.signal),
      )
      previousRollingHash = finalRollingHash(previousRollingHash, slice.payload)
      if (this.#disposed || entry.disposed) return
      const acceptedSeq = Number(accepted.acceptedThroughSeq)
      const nowIso = this.#options.now().toISOString()
      await this.#mutateCursor(file => ({
        ...file,
        cursors: { ...file.cursors, [sessionId]: acceptedSeq },
        rollingHashes: { ...(file.rollingHashes ?? {}), [sessionId]: accepted.rollingHash },
        pushedAt: { ...(file.pushedAt ?? {}), [sessionId]: nowIso },
        lastPushAt: nowIso,
        lastError: null,
      }))
      entry.retryAttempt = 0
      this.#options.logger.debug(`session-sync pushed ${sessionId} through ${acceptedSeq}`)
    }
  }

  #createController(): AbortController {
    const controller = new AbortController()
    this.#abortControllers.add(controller)
    return controller
  }

  async #handleSessionFailure(sessionId: string, entry: SessionEntry, error: unknown): Promise<void> {
    if (this.#disposed || entry.disposed) return
    const code = errorCode(error)
    if (isTerminalSessionSyncCode(code)) {
      entry.dirty = false
      this.#options.logger.warn(`session-sync terminal ${code} for ${sessionId}`)
      try {
        await this.#mutateCursor(file => ({
          ...file,
          lastError: code,
          terminalErrors: { ...(file.terminalErrors ?? {}), [sessionId]: code },
        }))
      } catch (writeError: unknown) {
        this.#options.logger.warn(`session-sync terminal persist failed: ${errorCode(writeError)}`)
      }
      return
    }
    const retryable = error instanceof SessionUploadError
      ? error.retryable
      : code !== 'ENT_SESSION_SYNC_DISABLED'
    if (!retryable) {
      await this.#mutateCursor(file => ({ ...file, lastError: code })).catch(() => undefined)
      return
    }
    entry.retryAttempt += 1
    const delay = Math.min(
      this.#options.retryBaseMs * 2 ** Math.min(entry.retryAttempt - 1, 6),
      60_000,
    )
    this.#options.logger.warn(`session-sync retry ${sessionId} in ${delay}ms after ${code}`)
    const timer = setTimeout(() => {
      entry.retryTimer = null
      if (!this.#disposed && !entry.disposed) {
        entry.dirty = true
        void this.#kick(sessionId)
      }
    }, delay)
    timer.unref?.()
    entry.retryTimer = timer
    await this.#mutateCursor(file => ({ ...file, lastError: code })).catch(() => undefined)
  }

  async #loadCursor(): Promise<SessionSyncCursorFile> {
    if (this.#cursor !== null) return this.#cursor
    return this.ensureCursor()
  }

  #mutateCursor(
    update: (file: SessionSyncCursorFile) => SessionSyncCursorFile,
  ): Promise<void> {
    this.#cursorWrite = this.#cursorWrite.then(async () => {
      const current = this.#cursor
        ?? await readCursorFile(this.#options.dshHome)
        ?? await ensureCursorFile(this.#options.dshHome, this.#options.deviceId)
      const next = update(current)
      await writeCursorFile(this.#options.dshHome, next)
      this.#cursor = next
    })
    return this.#cursorWrite
  }

  #track<T>(promise: Promise<T>): Promise<T> {
    const tracked = promise.then(
      value => {
        this.#inFlight.delete(tracked)
        return value
      },
      error => {
        this.#inFlight.delete(tracked)
        throw error
      },
    )
    this.#inFlight.add(tracked)
    return tracked
  }
}

function errorCode(error: unknown): string {
  if (error instanceof SessionUploadError || error instanceof SessionSyncError) {
    return error.code
  }
  if (typeof error === 'object' && error !== null && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return 'ENT_SESSION_UPLOAD_FAILED'
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function omitKey(map: Record<string, string> | undefined, key: string): Record<string, string> {
  if (map === undefined) return {}
  const next = { ...map }
  delete next[key]
  return next
}
