/**
 * [INPUT]: 依赖 batch/hash/wire 纯函数与 T16 线协议定义
 * [OUTPUT]: 验证切批、JSONL、rolling hash、payloadSha256 与 idempotencyKey
 * [POS]: session-sync 协议纯函数测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  INITIAL_ROLLING_HASH,
  buildJsonlPayload,
  encodeEventLine,
  finalRollingHash,
  rollingHashBase64,
  sha256Base64,
  sliceEventsByBytes,
  splitSessionEvents,
  toSessionBatchBody,
} from '../src/index.js'
import type { SyncableEvent, SyncableSessionHeader } from '../src/index.js'

function event(seq: number, type = 'turn/start', data: unknown = { turn: seq }): SyncableEvent {
  return { seq, time: 1_700_000_000_000 + seq, type, data }
}

const header: SyncableSessionHeader = {
  version: 0,
  id: 'session-01',
  createdAt: 1_700_000_000_000,
  cwd: '/tmp/work',
}

describe('session batch wire', () => {
  it('encodes JSONL with trailing newline and no CRLF', () => {
    const line = encodeEventLine(event(0))
    expect(line.at(-1)).toBe(0x0a)
    expect(line.includes(0x0d)).toBe(false)
    const payload = buildJsonlPayload([event(0), event(1)])
    expect(payload.toString('utf8').endsWith('\n')).toBe(true)
    expect(payload.toString('utf8').trim().split('\n')).toHaveLength(2)
  })

  it('splits batches by maxBatchBytes and marks first slice header only', () => {
    const events = [event(0), event(1), event(2)]
    const oneLine = encodeEventLine(event(0)).length
    const slices = splitSessionEvents(events, { maxBatchBytes: oneLine + 1 })
    expect(slices.length).toBeGreaterThan(1)
    expect(slices[0]!.isFirstSlice).toBe(true)
    expect(slices[0]!.fromSeq).toBe(0)
    expect(slices.slice(1).every(slice => !slice.isFirstSlice)).toBe(true)
    for (const slice of slices) {
      expect(slice.payload.length).toBeLessThanOrEqual(oneLine + 1)
      expect(slice.payload.at(-1)).toBe(0x0a)
    }
  })

  it('keeps a single oversized event as its own slice', () => {
    const events = [event(0), event(1)]
    const slices = sliceEventsByBytes(events, 8)
    expect(slices).toHaveLength(2)
    expect(slices[0]!.toSeq).toBe(0)
    expect(slices[1]!.fromSeq).toBe(1)
  })

  it('computes rolling hash as SHA-256(prev || rawLine)', () => {
    const line = encodeEventLine(event(0))
    const withoutNl = line.subarray(0, line.length - 1)
    const expected = createHash('sha256')
      .update(Buffer.alloc(32))
      .update(withoutNl)
      .digest('base64')
    expect(rollingHashBase64(INITIAL_ROLLING_HASH, withoutNl)).toBe(expected)
    expect(finalRollingHash(INITIAL_ROLLING_HASH, line)).toBe(expected)
  })

  it('builds T16 body with header only on fromSeq=0 and correct hashes', () => {
    const slice = {
      fromSeq: 0,
      toSeq: 0,
      events: [event(0)],
      payload: buildJsonlPayload([event(0)]),
      isFirstSlice: true,
    }
    const body = toSessionBatchBody({
      deviceId: 'device-a',
      sessionId: 'session-01',
      slice,
      previousRollingHash: INITIAL_ROLLING_HASH,
      header,
      title: '修复订单',
    })
    expect(body.idempotencyKey).toBe('device-a:session-01:0:0')
    expect(body.fromSeq).toBe(0)
    expect(body.toSeq).toBe(0)
    expect(body.header).toEqual(header)
    expect(body.title).toBe('修复订单')
    expect(body.payloadSha256).toBe(sha256Base64(slice.payload))
    expect(body.payloadBase64).toBe(slice.payload.toString('base64'))
    expect(body.previousRollingHash).toBe(INITIAL_ROLLING_HASH)
    expect(body.payloadSha256.length).toBe(44)
  })

  it('nulls header on continuation batches', () => {
    const events = [event(1)]
    const slices = splitSessionEvents(events, { maxBatchBytes: 1024 })
    expect(slices[0]!.isFirstSlice).toBe(false)
    const body = toSessionBatchBody({
      deviceId: 'device-a',
      sessionId: 'session-01',
      slice: slices[0]!,
      previousRollingHash: INITIAL_ROLLING_HASH,
      header,
      title: null,
    })
    expect(body.header).toBeNull()
    expect(body.title).toBeNull()
  })
})
