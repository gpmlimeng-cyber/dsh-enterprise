/**
 * [INPUT]: 依赖平台 request、export 线协议 hash 定义与 sessions.create 端口
 * [OUTPUT]: 对外提供 listRemoteSessions、downloadOwnedSession、restoreRemoteSession
 * [POS]: session-sync 恢复链路边界；校验全部完成后才 create 新 ID，失败不留半成品
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { SessionSyncError } from './errors.js'
import { INITIAL_ROLLING_HASH, rollingHash, sha256Base64 } from './hash.js'
import type { SyncableEvent, SyncableSessionHeader } from './types.js'

export interface RemoteSessionRequestPort {
  request(path: string | URL, init?: RequestInit): Promise<Response>
}

export interface SessionCreatePort {
  create(id: string, options: {
    seed: readonly SyncableEvent[]
    meta: {
      readonly cwd: string
      readonly parentSession: string
      readonly seedLength: number
    }
  }): Promise<{ readonly id: string }> | { readonly id: string }
}

export interface RemoteSessionSummary {
  readonly id: string
  readonly title: string | null
  readonly lastSeq: number
  readonly eventCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface DownloadedOwnedSession {
  readonly sessionId: string
  readonly header: SyncableSessionHeader
  readonly title: string | null
  readonly events: readonly SyncableEvent[]
}

function encode(event: SyncableEvent): string {
  return JSON.stringify(event)
}

async function readJson(path: string, port: RemoteSessionRequestPort, signal?: AbortSignal): Promise<unknown> {
  const response = await port.request(path, signal === undefined ? {} : { signal })
  if (!response.ok) {
    throw new SessionSyncError(
      'ENT_SESSION_UPLOAD_FAILED',
      `session remote read failed: HTTP ${response.status}`,
    )
  }
  return response.json()
}

function decodeOwnedSession(value: unknown): RemoteSessionSummary {
  const item = (value as { data?: unknown } | null)?.data ?? value
  const row = item as Record<string, unknown>
  if (typeof row !== 'object' || row === null
    || typeof row['id'] !== 'string' || row['id'].length === 0
    || !(row['title'] === null || typeof row['title'] === 'string')
    || typeof row['lastSeq'] !== 'number'
    || typeof row['eventCount'] !== 'number') {
    throw new SessionSyncError('ENT_SESSION_UPLOAD_FAILED', 'owned session shape is invalid')
  }
  return {
    id: row['id'],
    title: row['title'] as string | null,
    lastSeq: row['lastSeq'],
    eventCount: row['eventCount'],
    createdAt: typeof row['createdAt'] === 'string' ? row['createdAt'] : '',
    updatedAt: typeof row['updatedAt'] === 'string' ? row['updatedAt'] : '',
  }
}

export async function listRemoteSessions(
  port: RemoteSessionRequestPort,
  signal?: AbortSignal,
): Promise<readonly RemoteSessionSummary[]> {
  const payload = await readJson('/enterprise/api/v1/sessions?limit=50', port, signal)
  const data = (payload as { data?: { items?: unknown } } | null)?.data
  const items = data?.items
  if (!Array.isArray(items)) {
    throw new SessionSyncError('ENT_SESSION_UPLOAD_FAILED', 'owned session page is invalid')
  }
  return items.map(decodeOwnedSession)
}

interface ExportPage {
  header: SyncableSessionHeader
  title: string | null
  fromSeq: number
  toSeq: number
  previousRollingHash: string
  rollingHash: string
  payloadSha256: string
  payloadBase64: string
  hasMore: boolean
}

function decodeExportPage(value: unknown): ExportPage {
  const row = ((value as { data?: unknown } | null)?.data ?? value) as Record<string, unknown>
  if (typeof row !== 'object' || row === null
    || typeof row['header'] !== 'object' || row['header'] === null
    || typeof (row['header'] as { version?: unknown }).version !== 'number'
    || typeof row['payloadBase64'] !== 'string'
    || typeof row['payloadSha256'] !== 'string'
    || typeof row['previousRollingHash'] !== 'string'
    || typeof row['rollingHash'] !== 'string'
    || typeof row['fromSeq'] !== 'number'
    || typeof row['toSeq'] !== 'number'
    || typeof row['hasMore'] !== 'boolean') {
    throw new SessionSyncError('ENT_SESSION_UPLOAD_FAILED', 'export page shape is invalid')
  }
  return {
    header: row['header'] as SyncableSessionHeader,
    title: row['title'] === null || typeof row['title'] === 'string' ? row['title'] as string | null : null,
    fromSeq: row['fromSeq'],
    toSeq: row['toSeq'],
    previousRollingHash: row['previousRollingHash'],
    rollingHash: row['rollingHash'],
    payloadSha256: row['payloadSha256'],
    payloadBase64: row['payloadBase64'],
    hasMore: row['hasMore'],
  }
}

function parseJsonlEvents(payload: Buffer, fromSeq: number, toSeq: number): SyncableEvent[] {
  const text = payload.toString('utf8')
  if (!text.endsWith('\n') || text.includes('\r')) {
    throw new SessionSyncError('ENT_SESSION_FORMAT_UNSUPPORTED', 'export payload framing is invalid')
  }
  const lines = text.split('\n').filter(line => line.length > 0)
  const expected = toSeq - fromSeq + 1
  if (lines.length !== expected) {
    throw new SessionSyncError('ENT_SESSION_SEQ_GAP', 'export event count does not match range')
  }
  return lines.map((line, index) => {
    let event: unknown
    try {
      event = JSON.parse(line)
    } catch {
      throw new SessionSyncError('ENT_SESSION_FORMAT_UNSUPPORTED', 'export line is not JSON')
    }
    const record = event as Record<string, unknown>
    if (typeof record !== 'object' || record === null
      || record['seq'] !== fromSeq + index
      || typeof record['type'] !== 'string') {
      throw new SessionSyncError('ENT_SESSION_SEQ_GAP', 'export event seq is not continuous')
    }
    return record as SyncableEvent
  })
}

export async function downloadOwnedSession(
  port: RemoteSessionRequestPort,
  sessionId: string,
  signal?: AbortSignal,
): Promise<DownloadedOwnedSession> {
  let fromSeq = 0
  let previousRollingHash = INITIAL_ROLLING_HASH
  let header: SyncableSessionHeader | null = null
  let title: string | null = null
  const events: SyncableEvent[] = []
  let guard = 0
  while (guard < 10_000) {
    guard += 1
    const page = decodeExportPage(await readJson(
      `/enterprise/api/v1/sessions/${encodeURIComponent(sessionId)}/export?fromSeq=${fromSeq}&limit=200`,
      port,
      signal,
    ))
    const payload = Buffer.from(page.payloadBase64, 'base64')
    if (sha256Base64(payload) !== page.payloadSha256) {
      throw new SessionSyncError('ENT_SESSION_FORMAT_UNSUPPORTED', 'export payloadSha256 mismatch')
    }
    if (page.previousRollingHash !== previousRollingHash) {
      throw new SessionSyncError('ENT_SESSION_DIVERGED', 'export rolling hash chain broken')
    }
    let rolling = previousRollingHash
    for (const line of payload.toString('utf8').split('\n')) {
      if (line.length === 0) continue
      rolling = rollingHash(rolling, line).toString('base64')
    }
    if (rolling !== page.rollingHash) {
      throw new SessionSyncError('ENT_SESSION_DIVERGED', 'export rollingHash mismatch')
    }
    if (page.fromSeq !== fromSeq) {
      throw new SessionSyncError('ENT_SESSION_SEQ_GAP', 'export fromSeq mismatch')
    }
    if (page.fromSeq === 0) {
      header = page.header
      title = page.title
    }
    events.push(...parseJsonlEvents(payload, page.fromSeq, page.toSeq))
    previousRollingHash = page.rollingHash
    if (!page.hasMore) break
    fromSeq = page.toSeq + 1
  }
  if (header === null) {
    throw new SessionSyncError('ENT_SESSION_FORMAT_UNSUPPORTED', 'export missing header')
  }
  if (header.version !== 0) {
    throw new SessionSyncError('ENT_SESSION_FORMAT_UNSUPPORTED', 'export format version unsupported')
  }
  return { sessionId, header, title, events }
}

export interface RestoreRemoteOptions {
  readonly port: RemoteSessionRequestPort
  readonly createSession: SessionCreatePort
  readonly sourceSessionId: string
  /** 绝对工作目录；调用方负责存在性校验。 */
  readonly cwd: string
  readonly newSessionId?: string
  readonly signal?: AbortSignal
  readonly restoreRecord?: boolean
}

export interface RestoreRemoteResult {
  readonly restoredSessionId: string
  readonly sourceSessionId: string
  readonly eventCount: number
}

export async function restoreRemoteSession(
  options: RestoreRemoteOptions,
): Promise<RestoreRemoteResult> {
  if (!options.cwd.startsWith('/')) {
    throw new SessionSyncError('ENT_SESSION_UPLOAD_FAILED', 'restore cwd must be absolute')
  }
  const downloaded = await downloadOwnedSession(options.port, options.sourceSessionId, options.signal)
  if (downloaded.events.length === 0) {
    throw new SessionSyncError('ENT_SESSION_FORMAT_UNSUPPORTED', 'export produced no events')
  }
  const restoredSessionId = options.newSessionId ?? `restored-${randomUUID()}`
  const created = await options.createSession.create(restoredSessionId, {
    seed: downloaded.events,
    meta: {
      cwd: options.cwd,
      parentSession: options.sourceSessionId,
      seedLength: downloaded.events.length,
    },
  })
  if (options.restoreRecord !== false) {
    try {
      const response = await options.port.request(
        `/enterprise/api/v1/sessions/${encodeURIComponent(options.sourceSessionId)}/restore-record`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ restoredSessionId: created.id }),
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        },
      )
      if (!response.ok && response.status !== 404) {
        // 本地副本已成功；审计失败只记日志级错误，不回滚本地会话。
        throw new SessionSyncError(
          'ENT_SESSION_UPLOAD_FAILED',
          `restore-record failed: HTTP ${response.status}`,
        )
      }
    } catch (error) {
      if (error instanceof SessionSyncError && error.message.startsWith('restore-record failed')) {
        // fail-open for audit only
        return {
          restoredSessionId: created.id,
          sourceSessionId: options.sourceSessionId,
          eventCount: downloaded.events.length,
        }
      }
      throw error
    }
  }
  return {
    restoredSessionId: created.id,
    sourceSessionId: options.sourceSessionId,
    eventCount: downloaded.events.length,
  }
}
