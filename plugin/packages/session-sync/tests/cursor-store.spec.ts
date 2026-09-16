/**
 * [INPUT]: 依赖 cursor-store 与临时目录
 * [OUTPUT]: 验证游标 roundtrip 与非法 JSON/字段拒绝
 * [POS]: session-sync 游标边界测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SessionSyncError,
  ensureCursorFile,
  parseCursorFile,
  readCursorFile,
  resolveSessionSyncCursorPath,
  writeCursorFile,
  emptyCursorFile,
} from '../src/index.js'

const dirs: string[] = []

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-session-sync-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('cursor-store', () => {
  it('roundtrips deviceId and lastError through atomic write', async () => {
    const home = await tempHome()
    const file = emptyCursorFile('device-1')
    const withError = { ...file, lastError: 'ENT_SESSION_SEQ_GAP' }
    await writeCursorFile(home, withError)
    const raw = await readFile(resolveSessionSyncCursorPath(home), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    const back = await readCursorFile(home)
    expect(back?.deviceId).toBe('device-1')
    expect(back?.lastError).toBe('ENT_SESSION_SEQ_GAP')
    expect(back?.cursors).toEqual({})
  })

  it('returns null when cursor file is missing', async () => {
    const home = await tempHome()
    expect(await readCursorFile(home)).toBeNull()
  })

  it('ensureCursorFile creates a stable file once', async () => {
    const home = await tempHome()
    const first = await ensureCursorFile(home, 'preferred-device')
    const second = await ensureCursorFile(home, 'other')
    expect(first.deviceId).toBe('preferred-device')
    expect(second.deviceId).toBe('preferred-device')
  })

  it('rejects invalid JSON and invalid cursor seq', () => {
    expect(() => parseCursorFile('{')).toThrow(SessionSyncError)
    try {
      parseCursorFile(JSON.stringify({
        formatVersion: 1,
        deviceId: 'd',
        cursors: { s1: -1 },
        lastPullAt: null,
        lastPushAt: null,
        lastError: null,
      }))
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(SessionSyncError)
      expect((error as SessionSyncError).code).toBe('ENT_SESSION_CURSOR_INVALID')
    }
  })

  it('accepts P2a files without extension fields and roundtrips P2b maps', async () => {
    const home = await tempHome()
    const legacy = parseCursorFile(JSON.stringify({
      formatVersion: 1,
      deviceId: 'device-p2a',
      cursors: { s1: 3 },
      lastPullAt: null,
      lastPushAt: null,
      lastError: null,
    }))
    expect(legacy.rollingHashes).toEqual({})
    expect(legacy.terminalErrors).toEqual({})
    expect(legacy.pushedAt).toEqual({})

    await writeCursorFile(home, {
      ...legacy,
      cursors: { s1: 4 },
      rollingHashes: { s1: 'A'.repeat(43) + '=' },
      terminalErrors: { s1: 'ENT_SESSION_DIVERGED' },
      pushedAt: { s1: '2026-09-16T00:00:00.000Z' },
    })
    const back = await readCursorFile(home)
    expect(back?.cursors['s1']).toBe(4)
    expect(back?.rollingHashes?.['s1']).toBe('A'.repeat(43) + '=')
    expect(back?.terminalErrors?.['s1']).toBe('ENT_SESSION_DIVERGED')
  })
})
