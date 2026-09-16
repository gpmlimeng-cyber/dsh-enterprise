/**
 * [INPUT]: 依赖 restore 远程端口与 create port、hash 工具
 * [OUTPUT]: 验证分页校验、断链拒绝、成功恢复与失败无 restore-record
 * [POS]: session-sync 恢复链路测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  INITIAL_ROLLING_HASH,
  downloadOwnedSession,
  listRemoteSessions,
  restoreRemoteSession,
  sha256Base64,
  type RemoteSessionRequestPort,
  type SessionCreatePort,
  type SyncableEvent,
} from '../src/index.js'

function event(seq: number): SyncableEvent {
  return { seq, time: 1_700_000_000_000 + seq, type: 'turn/start', data: { turn: seq } }
}

function page(events: SyncableEvent[], previous: string, hasMore: boolean) {
  const lines = events.map(e => JSON.stringify(e))
  const payload = Buffer.from(`${lines.join('\n')}\n`, 'utf8')
  let rolling = previous
  for (const line of lines) {
    rolling = createHash('sha256').update(Buffer.from(rolling, 'base64')).update(line).digest('base64')
  }
  return {
    data: {
      sessionId: 'session-1',
      header: {
        version: 0,
        id: 'session-1',
        createdAt: 1_700_000_000_000,
        cwd: '/tmp/work',
      },
      title: events[0]!.seq === 0 ? '修复订单' : null,
      fromSeq: events[0]!.seq,
      toSeq: events[events.length - 1]!.seq,
      eventCount: events.length,
      previousRollingHash: previous,
      rollingHash: rolling,
      payloadSha256: sha256Base64(payload),
      payloadBase64: payload.toString('base64'),
      hasMore,
    },
  }
}

function portFrom(pages: Record<string, unknown>): RemoteSessionRequestPort {
  return {
    request: async (path) => {
      const key = String(path)
      const value = pages[key]
      if (value === undefined) {
        return new Response('missing', { status: 404 })
      }
      return new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  }
}

describe('session restore', () => {
  it('lists owned sessions', async () => {
    const port = portFrom({
      '/enterprise/api/v1/sessions?limit=50': {
        data: {
          items: [{
            id: 'session-1',
            title: '修复订单',
            sourceDeviceId: '90018',
            sourceDeviceName: 'mac',
            formatVersion: 0,
            lastSeq: 1,
            eventCount: 2,
            status: 'ACTIVE',
            createdAt: '2026-09-16T00:00:00Z',
            updatedAt: '2026-09-16T00:01:00Z',
          }],
          page: { hasMore: false, limit: 50, next: null },
        },
      },
    })
    await expect(listRemoteSessions(port)).resolves.toEqual([
      expect.objectContaining({ id: 'session-1', title: '修复订单', lastSeq: 1 }),
    ])
  })

  it('downloads multiple pages and verifies hash chain', async () => {
    const first = page([event(0), event(1)], INITIAL_ROLLING_HASH, true)
    const firstHash = first.data.rollingHash
    const second = page([event(2)], firstHash, false)
    const port = portFrom({
      '/enterprise/api/v1/sessions/session-1/export?fromSeq=0&limit=200': first,
      '/enterprise/api/v1/sessions/session-1/export?fromSeq=2&limit=200': second,
    })
    const downloaded = await downloadOwnedSession(port, 'session-1')
    expect(downloaded.events.map(item => item.seq)).toEqual([0, 1, 2])
    expect(downloaded.header.id).toBe('session-1')
  })

  it('rejects broken rolling hash chain', async () => {
    const first = page([event(0)], INITIAL_ROLLING_HASH, false)
    first.data.rollingHash = 'B'.repeat(43) + '='
    const port = portFrom({
      '/enterprise/api/v1/sessions/session-1/export?fromSeq=0&limit=200': first,
    })
    await expect(downloadOwnedSession(port, 'session-1')).rejects.toMatchObject({
      code: 'ENT_SESSION_DIVERGED',
    })
  })

  it('creates a new local session and posts restore-record', async () => {
    const single = page([event(0), event(1)], INITIAL_ROLLING_HASH, false)
    const request = vi.fn(async (path: string | URL) => {
      if (String(path).includes('/restore-record')) {
        return new Response(JSON.stringify({ data: { restoredSessionId: 'new-1' } }), { status: 200 })
      }
      return new Response(JSON.stringify(single), { status: 200 })
    })
    const create = vi.fn(async (id: string) => ({ id }))
    const result = await restoreRemoteSession({
      port: { request: request as unknown as RemoteSessionRequestPort['request'] },
      createSession: { create },
      sourceSessionId: 'session-1',
      cwd: '/tmp/work',
      newSessionId: 'restored-1',
    })
    expect(result.restoredSessionId).toBe('restored-1')
    expect(create).toHaveBeenCalledWith('restored-1', expect.objectContaining({
      meta: expect.objectContaining({ parentSession: 'session-1', cwd: '/tmp/work' }),
    }))
    expect(request).toHaveBeenCalledWith(
      '/enterprise/api/v1/sessions/session-1/restore-record',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does not call restore-record when create fails', async () => {
    const single = page([event(0)], INITIAL_ROLLING_HASH, false)
    const restoreRecord = vi.fn()
    const port: RemoteSessionRequestPort = {
      request: async (path) => {
        if (String(path).includes('/restore-record')) {
          restoreRecord()
          return new Response('{}', { status: 200 })
        }
        return new Response(JSON.stringify(single), { status: 200 })
      },
    }
    await expect(restoreRemoteSession({
      port,
      createSession: {
        create: () => {
          throw new Error('create failed')
        },
      },
      sourceSessionId: 'session-1',
      cwd: '/tmp/work',
    })).rejects.toThrow('create failed')
    expect(restoreRecord).not.toHaveBeenCalled()
  })
})
