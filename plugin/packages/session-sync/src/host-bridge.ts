/**
 * [INPUT]: 依赖 registerSessionSync、平台 bootstrap/request/subscribe 与可选 sessions/sessionPersistence 端口
 * [OUTPUT]: 对外提供 tryRegisterHostSessionSync：仅在 sessionPolicy.enabled 时注入真实 ports 并注册
 * [POS]: session-sync 与 Harness Host 的组合桥；bundle apply 消费，未启用路径零注册零 Session HTTP
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  SessionUploadError,
  uploadErrorFromResponse,
} from './errors.js'
import { registerSessionSync } from './service.js'
import type {
  EnterpriseSessionUploaderPort,
  RegisterSessionSyncDeps,
  SessionBatchAccepted,
  SessionBatchBody,
  SessionPersistencePort,
  SessionStorePort,
  SessionSyncLogger,
  SessionSyncServiceHandle,
  SyncableSession,
} from './types.js'

export interface HostPlatformStatusPort {
  readonly state: string
}

export interface HostSessionPolicyPort {
  readonly enabled: boolean
  readonly maxBatchBytes: number
}

export interface HostBootstrapPort {
  readonly sessionPolicy: HostSessionPolicyPort
}

export interface HostPlatformPort {
  status(): HostPlatformStatusPort
  bootstrap(): HostBootstrapPort | undefined
  request(path: string | URL, init?: RequestInit): Promise<Response>
  subscribe(listener: (status: HostPlatformStatusPort) => void): () => void
}

export interface HostSessionRuntimePort {
  sessions?: SessionStorePort
  sessionPersistence?: SessionPersistencePort
}

export interface TryRegisterHostSessionSyncOptions {
  readonly dshHome: string
  readonly platform: HostPlatformPort
  readonly runtime: HostSessionRuntimePort
  readonly logger?: SessionSyncLogger
  /** 通常包装 `ctx.on('session/event', …)`；返回 disposer。 */
  readonly onSessionEvent?: (listener: (session: SyncableSession) => void) => () => void
  readonly deviceId?: string
  readonly now?: () => Date
  readonly debounceMs?: number
  readonly disposeTimeoutMs?: number
  readonly retryBaseMs?: number
}

export interface HostSessionSyncHandle {
  readonly enabled: boolean
  status(): {
    readonly enabled: boolean
    readonly deviceId: string | null
    readonly pendingSessionIds: readonly string[]
    readonly lastError: string | null
  }
  dispose(): Promise<void>
}

const ACTIVE_STATES = new Set(['READY', 'REFRESHING'])

export function isHostSessionSyncEnabled(platform: HostPlatformPort): boolean {
  if (!ACTIVE_STATES.has(platform.status().state)) return false
  const policy = platform.bootstrap()?.sessionPolicy
  return policy?.enabled === true
}

function createPlatformUploader(
  platform: HostPlatformPort,
  logger: SessionSyncLogger | undefined,
): EnterpriseSessionUploaderPort {
  return {
    async appendBatch(
      sessionId: string,
      body: SessionBatchBody,
      signal: AbortSignal,
    ): Promise<SessionBatchAccepted> {
      const path = `/enterprise/api/v1/sessions/${encodeURIComponent(sessionId)}/batches`
      let response: Response
      try {
        response = await platform.request(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        throw new SessionUploadError(
          'ENT_SESSION_UPLOAD_FAILED',
          'session batch request failed',
          { retryable: true, cause: error },
        )
      }
      if (!response.ok) {
        const code = await decodeEnterpriseErrorCode(response)
        throw uploadErrorFromResponse(response.status, code)
      }
      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        throw new SessionUploadError(
          'ENT_SESSION_UPLOAD_FAILED',
          'session batch response is not JSON',
          { status: response.status, retryable: false, cause: error },
        )
      }
      const data = (payload as { data?: unknown } | null)?.data as
        | { acceptedThroughSeq?: unknown; rollingHash?: unknown }
        | undefined
      if (data === undefined
        || typeof data.acceptedThroughSeq !== 'number'
        || typeof data.rollingHash !== 'string') {
        logger?.warn('session-sync batch response missing data')
        throw new SessionUploadError(
          'ENT_SESSION_UPLOAD_FAILED',
          'session batch response shape is invalid',
          { status: response.status, retryable: false },
        )
      }
      return {
        acceptedThroughSeq: data.acceptedThroughSeq,
        rollingHash: data.rollingHash,
      }
    },
  }
}

async function decodeEnterpriseErrorCode(response: Response): Promise<string | null> {
  try {
    const payload = await response.json() as { error?: { code?: unknown } } | null
    const code = payload?.error?.code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

/**
 * 幂等挂载：仅当平台已就绪且 bootstrap 宣告 sessionPolicy.enabled 时注册上传服务。
 * 未启用时返回 enabled=false，不订阅 session/event、不发 HTTP。
 */
export function tryRegisterHostSessionSync(
  options: TryRegisterHostSessionSyncOptions,
): HostSessionSyncHandle {
  const logger = options.logger
  let service: SessionSyncServiceHandle | null = null
  let unsubscribeEvents: (() => void) | null = null
  let unsubscribePlatform: (() => void) | null = null
  let disposed = false
  let mounting = false

  const teardown = async (): Promise<void> => {
    unsubscribeEvents?.()
    unsubscribeEvents = null
    const current = service
    service = null
    if (current !== null) await current.dispose()
  }

  const mount = async (): Promise<void> => {
    if (disposed || mounting || service !== null) return
    if (!isHostSessionSyncEnabled(options.platform)) return
    const sessions = options.runtime.sessions
    const sessionPersistence = options.runtime.sessionPersistence
    if (sessions === undefined || sessionPersistence === undefined) {
      logger?.warn('session-sync enabled but session ports are missing')
      return
    }
    mounting = true
    try {
      const policy = options.platform.bootstrap()!.sessionPolicy
      const deps: RegisterSessionSyncDeps = {
        dshHome: options.dshHome,
        enterpriseSessionEnabled: true,
        maxBatchBytes: policy.maxBatchBytes,
        sessions,
        sessionPersistence,
        uploader: createPlatformUploader(options.platform, logger),
        ...(options.logger === undefined ? {} : { logger: options.logger }),
        ...(options.deviceId === undefined ? {} : { deviceId: options.deviceId }),
        ...(options.now === undefined ? {} : { now: options.now }),
        ...(options.debounceMs === undefined ? {} : { debounceMs: options.debounceMs }),
        ...(options.disposeTimeoutMs === undefined ? {} : {
          disposeTimeoutMs: options.disposeTimeoutMs,
        }),
        ...(options.retryBaseMs === undefined ? {} : { retryBaseMs: options.retryBaseMs }),
      }
      const registered = registerSessionSync(deps)
      service = registered.service
      if (options.onSessionEvent !== undefined) {
        unsubscribeEvents = options.onSessionEvent(session => {
          service?.markDirty(session)
        })
      }
      logger?.debug('session-sync host registration active')
    } finally {
      mounting = false
    }
  }

  void mount()
  unsubscribePlatform = options.platform.subscribe(status => {
    if (disposed) return
    if (!ACTIVE_STATES.has(status.state) || !isHostSessionSyncEnabled(options.platform)) {
      void teardown()
      return
    }
    void mount()
  })

  return {
    get enabled(): boolean {
      return service !== null
    },
    status() {
      if (service === null) {
        return { enabled: false, deviceId: null, pendingSessionIds: [], lastError: null }
      }
      const snapshot = service.getStatus()
      return {
        enabled: true,
        deviceId: snapshot.deviceId,
        pendingSessionIds: snapshot.pendingSessionIds,
        lastError: snapshot.lastError,
      }
    },
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      unsubscribePlatform?.()
      unsubscribePlatform = null
      await teardown()
    },
  }
}
