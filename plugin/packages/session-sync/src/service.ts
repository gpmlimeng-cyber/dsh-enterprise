/**
 * [INPUT]: 依赖 types/cursor-store 与寄存器开关；不调用 dsh-session / HTTP
 * [OUTPUT]: 对外提供 disabled/idle 服务与无副作用 registerSessionSync
 * [POS]: session-sync 客户端服务入口；上传/恢复由 P2b 扩展本服务，不得另起平行服务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ensureCursorFile } from './cursor-store.js'
import type {
  RegisterSessionSyncDeps,
  SessionSyncLogger,
  SessionSyncServiceHandle,
  SessionSyncStatus,
} from './types.js'

const NOOP_LOGGER: SessionSyncLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

export class EnterpriseSessionSyncService implements SessionSyncServiceHandle {
  readonly mode: 'disabled' | 'idle'

  #deviceId: string | null
  #lastError: string | null
  readonly #logger: SessionSyncLogger
  readonly #dshHome: string

  constructor(options: {
    mode: 'disabled' | 'idle'
    dshHome: string
    deviceId?: string | null
    lastError?: string | null
    logger?: SessionSyncLogger
  }) {
    this.mode = options.mode
    this.#deviceId = options.deviceId ?? null
    this.#lastError = options.lastError ?? null
    this.#logger = options.logger ?? NOOP_LOGGER
    this.#dshHome = options.dshHome
  }

  getStatus(): SessionSyncStatus {
    return {
      mode: this.mode,
      deviceId: this.#deviceId,
      lastError: this.#lastError,
    }
  }

  /** P2b 扩展点：启用后确保游标文件存在（骨架仅此一次 fs 触达）。 */
  async ensureCursors(): Promise<void> {
    if (this.mode !== 'idle') {
      return
    }
    const file = await ensureCursorFile(this.#dshHome, this.#deviceId ?? undefined)
    this.#deviceId = file.deviceId
    this.#lastError = file.lastError
  }

  dispose(): void {
    this.#logger.debug('session-sync dispose')
  }
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
    return { service, dispose: () => service.dispose() }
  }

  const service = new EnterpriseSessionSyncService({
    mode: 'idle',
    dshHome: deps.dshHome,
    deviceId: deps.deviceId ?? null,
    logger,
  })
  // 有界初始化：仅 ensure 游标文件；不扫描 sessions、不发网。
  void service.ensureCursors().catch((error: unknown) => {
    service.dispose()
    logger.warn(`session-sync cursor init failed: ${error instanceof Error ? error.name : 'Error'}`)
  })
  return { service, dispose: () => service.dispose() }
}
