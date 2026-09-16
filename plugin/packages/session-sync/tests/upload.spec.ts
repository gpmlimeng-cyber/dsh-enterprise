/**
 * [INPUT]: 依赖 registerSessionSync、mock 端口与 spy fetch
 * [OUTPUT]: 验证 disabled 零网络、mock 上传推进游标、终态不重试与切批
 * [POS]: session-sync 上传链路测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INITIAL_ROLLING_HASH,
  SessionUploadError,
  parseCursorFile,
  registerSessionSync,
  type SessionBatchBody,
  type SyncableEvent,
  type SyncableSession,
  type SyncableSessionHeader,
} from '../src/index.js'

const dirs: string[] = []

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-session-sync-up-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

function makeEvent(seq: number): SyncableEvent {
  return { seq, time: 1_700_000_000_000 + seq, type: 'turn/start', data: { turn: seq } }
}

function makeSession(id = 'session-1', seq = 1): SyncableSession {
  const header: SyncableSessionHeader = {
    version: 0,
    id,
    createdAt: 1_700_000_000_000,
    cwd: '/tmp/work',
  }
  return { id, header, seq }
}

describe('session upload pipeline', () => {
  it('stays disabled with no network and no enterprise dir when policy is off', async () => {
    const home = await tempHome()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: false,
    })

    expect(service.getStatus().mode).toBe('disabled')
    service.markDirty(makeSession())
    await service.flushOnce('session-1').catch(() => undefined)
    expect(fetchSpy).not.toHaveBeenCalled()
    await expect(readdir(join(home, 'enterprise'))).rejects.toMatchObject({ code: 'ENOENT' })
    await dispose()
    expect(service.getStatus().mode).toBe('disabled')
  })

  it('uploads one mock batch, advances cursor, and stays idle on success', async () => {
    const home = await tempHome()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const bodies: SessionBatchBody[] = []
    const flush = vi.fn(async () => true)
    const readFrom = vi.fn(async (_id: string, fromSeq: number) => {
      const events = [makeEvent(0), makeEvent(1)].filter(event => event.seq >= fromSeq)
      return {
        meta: makeSession('session-1', events.length).header,
        events,
      }
    })
    const appendBatch = vi.fn(async (_id: string, body: SessionBatchBody) => {
      bodies.push(body)
      return {
        acceptedThroughSeq: body.toSeq,
        rollingHash: 'Y'.repeat(43) + '=',
      }
    })

    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: true,
      deviceId: 'device-up',
      debounceMs: 10,
      sessions: { flush },
      sessionPersistence: { readFrom },
      uploader: { appendBatch },
    })
    await service.ensureCursors()
    expect(service.getStatus().mode).toBe('uploading')
    expect(service.getStatus().ready).toBe(true)

    service.markDirty(makeSession('session-1', 2))
    await service.flushOnce('session-1')

    expect(flush).toHaveBeenCalledTimes(1)
    expect(readFrom).toHaveBeenCalledWith('session-1', 0, expect.any(AbortSignal))
    expect(appendBatch).toHaveBeenCalledTimes(1)
    expect(bodies[0]!.header?.id).toBe('session-1')
    expect(bodies[0]!.previousRollingHash).toBe(INITIAL_ROLLING_HASH)
    expect(fetchSpy).not.toHaveBeenCalled()

    const raw = await readFile(join(home, 'enterprise', 'session-sync.json'), 'utf8')
    const cursor = parseCursorFile(raw)
    expect(cursor.cursors['session-1']).toBe(1)
    expect(cursor.rollingHashes?.['session-1']).toBe('Y'.repeat(43) + '=')
    expect(cursor.lastError).toBeNull()
    expect(cursor.terminalErrors?.['session-1']).toBeUndefined()

    await dispose()
  })

  it('splits large increments into multiple maxBatchBytes batches', async () => {
    const home = await tempHome()
    const bodies: SessionBatchBody[] = []
    const lineBytes = Buffer.byteLength(`${JSON.stringify(makeEvent(0))}\n`, 'utf8')
    const readFrom = vi.fn(async (_id: string, fromSeq: number) => ({
      meta: makeSession().header,
      events: [0, 1, 2].map(makeEvent).filter(event => event.seq >= fromSeq),
    }))

    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: true,
      deviceId: 'device-up',
      maxBatchBytes: lineBytes,
      sessions: { flush: async () => true },
      sessionPersistence: { readFrom },
      uploader: {
        appendBatch: async (_id, body) => {
          bodies.push(body)
          return { acceptedThroughSeq: body.toSeq, rollingHash: 'A'.repeat(43) + '=' }
        },
      },
    })
    await service.ensureCursors()
    await service.flushOnce('session-1')
    expect(bodies.length).toBe(3)
    expect(bodies.map(body => [body.fromSeq, body.toSeq])).toEqual([[0, 0], [1, 1], [2, 2]])
    expect(bodies[0]!.header).not.toBeNull()
    expect(bodies[1]!.header).toBeNull()
    expect(bodies[2]!.header).toBeNull()
    await dispose()
  })

  it('enters terminal state for DIVERGED and does not auto-retry', async () => {
    const home = await tempHome()
    const appendBatch = vi.fn(async () => {
      throw new SessionUploadError('ENT_SESSION_DIVERGED', 'diverged', {
        status: 409,
        retryable: false,
      })
    })
    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: true,
      deviceId: 'device-up',
      retryBaseMs: 5,
      sessions: { flush: async () => true },
      sessionPersistence: {
        readFrom: async () => ({ meta: makeSession().header, events: [makeEvent(0)] }),
      },
      uploader: { appendBatch },
    })
    await service.ensureCursors()
    await service.flushOnce('session-1')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(appendBatch).toHaveBeenCalledTimes(1)

    const raw = await readFile(join(home, 'enterprise', 'session-sync.json'), 'utf8')
    const cursor = parseCursorFile(raw)
    expect(cursor.terminalErrors?.['session-1']).toBe('ENT_SESSION_DIVERGED')
    expect(cursor.lastError).toBe('ENT_SESSION_DIVERGED')

    await service.flushOnce('session-1')
    expect(appendBatch).toHaveBeenCalledTimes(1)
    await dispose()
  })

  it('clearSessionError allows a new attempt after terminal state', async () => {
    const home = await tempHome()
    let fail = true
    const appendBatch = vi.fn(async (_id: string, body: SessionBatchBody) => {
      if (fail) {
        throw new SessionUploadError('ENT_SESSION_DIVERGED', 'diverged', { status: 409 })
      }
      return { acceptedThroughSeq: body.toSeq, rollingHash: 'B'.repeat(43) + '=' }
    })
    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: true,
      deviceId: 'device-up',
      sessions: { flush: async () => true },
      sessionPersistence: {
        readFrom: async (_id, fromSeq) => ({
          meta: makeSession().header,
          events: [makeEvent(0)].filter(event => event.seq >= fromSeq),
        }),
      },
      uploader: { appendBatch },
    })
    await service.ensureCursors()
    await service.flushOnce('session-1')
    expect(appendBatch).toHaveBeenCalledTimes(1)
    fail = false
    await service.clearSessionError('session-1')
    await service.flushOnce('session-1')
    expect(appendBatch).toHaveBeenCalledTimes(2)
    await dispose()
  })

  it('resumes from stored cursor using previousRollingHash', async () => {
    const home = await tempHome()
    const seedHash = 'C'.repeat(43) + '='
    const { writeCursorFile, emptyCursorFile } = await import('../src/cursor-store.js')
    await writeCursorFile(home, {
      ...emptyCursorFile('device-up'),
      cursors: { 'session-1': 1 },
      rollingHashes: { 'session-1': seedHash },
    })

    const bodies: SessionBatchBody[] = []
    const readFrom = vi.fn(async (_id: string, fromSeq: number) => {
      expect(fromSeq).toBe(2)
      return {
        meta: makeSession().header,
        events: [makeEvent(2)],
      }
    })
    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: true,
      deviceId: 'device-up',
      sessions: { flush: async () => true },
      sessionPersistence: { readFrom },
      uploader: {
        appendBatch: async (_id, body) => {
          bodies.push(body)
          return { acceptedThroughSeq: body.toSeq, rollingHash: 'D'.repeat(43) + '=' }
        },
      },
    })
    await service.ensureCursors()
    await service.flushOnce('session-1')
    expect(bodies[0]!.previousRollingHash).toBe(seedHash)
    expect(bodies[0]!.fromSeq).toBe(2)
    await dispose()
  })
})
