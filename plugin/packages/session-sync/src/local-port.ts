/**
 * [INPUT]: 依赖 HostPlatformPort、SessionCreatePort 与当前 session-sync handle
 * [OUTPUT]: 对外提供 createHostSessionLocalPort：供 platform-client 本地 API 消费的脱敏端口
 * [POS]: session-sync 与本地 UI/API 的投影边界；未启用时 list/restore 响应禁用错误
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { SessionSyncError } from './errors.js'
import type { HostPlatformPort } from './host-bridge.js'
import {
  listRemoteSessions,
  restoreRemoteSession,
  type RemoteSessionSummary,
  type SessionCreatePort,
} from './restore.js'
import type { HostSessionSyncHandle } from './host-bridge.js'

export interface HostSessionLocalStatus {
  readonly enabled: boolean
  readonly deviceId: string | null
  readonly pendingSessionIds: readonly string[]
  readonly lastError: string | null
}

export interface HostSessionLocalPort {
  status(): HostSessionLocalStatus
  list(signal?: AbortSignal): Promise<readonly RemoteSessionSummary[]>
  restore(sourceSessionId: string, cwd: string, signal?: AbortSignal): Promise<{
    readonly restoredSessionId: string
    readonly sourceSessionId: string
    readonly eventCount: number
  }>
}

export interface CreateHostSessionLocalPortOptions {
  readonly platform: HostPlatformPort
  readonly getHandle: () => HostSessionSyncHandle | null
  readonly createSession?: SessionCreatePort
}

export function createHostSessionLocalPort(
  options: CreateHostSessionLocalPortOptions,
): HostSessionLocalPort {
  const requireEnabled = (): HostSessionSyncHandle => {
    const handle = options.getHandle()
    if (handle === null || !handle.enabled) {
      throw new SessionSyncError('ENT_SESSION_SYNC_DISABLED', 'session sync is not enabled')
    }
    return handle
  }
  return {
    status(): HostSessionLocalStatus {
      const handle = options.getHandle()
      if (handle === null || !handle.enabled) {
        return { enabled: false, deviceId: null, pendingSessionIds: [], lastError: null }
      }
      return handle.status()
    },
    async list(signal?: AbortSignal): Promise<readonly RemoteSessionSummary[]> {
      requireEnabled()
      return listRemoteSessions(options.platform, signal)
    },
    async restore(sourceSessionId: string, cwd: string, signal?: AbortSignal) {
      requireEnabled()
      if (options.createSession === undefined) {
        throw new SessionSyncError('ENT_SESSION_SYNC_DISABLED', 'session create port is unavailable')
      }
      return restoreRemoteSession({
        port: options.platform,
        createSession: options.createSession,
        sourceSessionId,
        cwd,
        ...(signal === undefined ? {} : { signal }),
      })
    },
  }
}
