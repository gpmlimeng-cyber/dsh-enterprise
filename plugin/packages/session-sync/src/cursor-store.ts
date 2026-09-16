/**
 * [INPUT]: 依赖 Node fs/path 与 SessionSyncCursorFile 契约（含 P2b 扩展字段）
 * [OUTPUT]: 对外提供 resolveSessionSyncCursorPath / readCursorFile / writeCursorFile 原子边界
 * [POS]: session-sync 唯一游标持久化边界；损坏文件响亮失败，不写半文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SessionSyncError } from './errors.js'
import {
  SESSION_SYNC_CURSOR_FORMAT_VERSION,
  type SessionSyncCursorFile,
  type SessionSyncCursors,
  type SessionSyncStringMap,
} from './types.js'

export function resolveSessionSyncCursorPath(dshHome: string): string {
  return join(dshHome, 'enterprise', 'session-sync.json')
}

export function emptyCursorFile(deviceId: string = randomUUID()): SessionSyncCursorFile {
  return {
    formatVersion: SESSION_SYNC_CURSOR_FORMAT_VERSION,
    deviceId,
    cursors: {},
    lastPullAt: null,
    lastPushAt: null,
    lastError: null,
    rollingHashes: {},
    terminalErrors: {},
    pushedAt: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCursors(value: unknown): SessionSyncCursors {
  if (!isRecord(value)) {
    throw new SessionSyncError('ENT_SESSION_CURSOR_INVALID', 'cursors must be an object')
  }
  const cursors: Record<string, number> = {}
  for (const [sessionId, seq] of Object.entries(value)) {
    if (sessionId.length === 0 || !Number.isSafeInteger(seq) || Number(seq) < 0) {
      throw new SessionSyncError('ENT_SESSION_CURSOR_INVALID', `invalid cursor for ${sessionId}`)
    }
    cursors[sessionId] = Number(seq)
  }
  return cursors
}

function parseOptionalStringMap(value: unknown, field: string): SessionSyncStringMap | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) {
    throw new SessionSyncError('ENT_SESSION_CURSOR_INVALID', `${field} must be an object`)
  }
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key.length === 0 || typeof entry !== 'string') {
      throw new SessionSyncError('ENT_SESSION_CURSOR_INVALID', `invalid ${field} entry for ${key}`)
    }
    out[key] = entry
  }
  return out
}

export function parseCursorFile(raw: string): SessionSyncCursorFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SessionSyncError('ENT_SESSION_CURSOR_INVALID', 'cursor file is not valid JSON')
  }
  if (!isRecord(parsed)
    || parsed['formatVersion'] !== SESSION_SYNC_CURSOR_FORMAT_VERSION
    || typeof parsed['deviceId'] !== 'string'
    || parsed['deviceId'].length === 0
    || parsed['lastPullAt'] !== null && typeof parsed['lastPullAt'] !== 'string'
    || parsed['lastPushAt'] !== null && typeof parsed['lastPushAt'] !== 'string'
    || parsed['lastError'] !== null && typeof parsed['lastError'] !== 'string') {
    throw new SessionSyncError('ENT_SESSION_CURSOR_INVALID', 'cursor file shape is invalid')
  }
  const rollingHashes = parseOptionalStringMap(parsed['rollingHashes'], 'rollingHashes')
  const terminalErrors = parseOptionalStringMap(parsed['terminalErrors'], 'terminalErrors')
  const pushedAt = parseOptionalStringMap(parsed['pushedAt'], 'pushedAt')
  return {
    formatVersion: SESSION_SYNC_CURSOR_FORMAT_VERSION,
    deviceId: parsed['deviceId'],
    cursors: parseCursors(parsed['cursors']),
    lastPullAt: parsed['lastPullAt'] as string | null,
    lastPushAt: parsed['lastPushAt'] as string | null,
    lastError: parsed['lastError'] as string | null,
    rollingHashes: rollingHashes ?? {},
    terminalErrors: terminalErrors ?? {},
    pushedAt: pushedAt ?? {},
  }
}

export async function readCursorFile(dshHome: string): Promise<SessionSyncCursorFile | null> {
  const path = resolveSessionSyncCursorPath(dshHome)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return null
    }
    throw error
  }
  return parseCursorFile(raw)
}

export async function writeCursorFile(
  dshHome: string,
  next: SessionSyncCursorFile,
): Promise<void> {
  const path = resolveSessionSyncCursorPath(dshHome)
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`
  const serialized: SessionSyncCursorFile = {
    ...next,
    rollingHashes: next.rollingHashes ?? {},
    terminalErrors: next.terminalErrors ?? {},
    pushedAt: next.pushedAt ?? {},
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(tmp, `${JSON.stringify(serialized, null, 2)}\n`, 'utf8')
  try {
    await rename(tmp, path)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
}

export async function ensureCursorFile(
  dshHome: string,
  preferredDeviceId?: string,
): Promise<SessionSyncCursorFile> {
  const existing = await readCursorFile(dshHome)
  if (existing !== null) {
    return existing
  }
  const created = emptyCursorFile(preferredDeviceId)
  await writeCursorFile(dshHome, created)
  return created
}
