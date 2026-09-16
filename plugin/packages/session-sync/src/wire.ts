/**
 * [INPUT]: 依赖 EventSlice、SessionBatchBody 与 deviceId/sessionId
 * [OUTPUT]: 对外提供 buildIdempotencyKey、toSessionBatchBody
 * [POS]: session-sync 线协议组装边界；与 T16 POST batches 字段一一对应
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EventSlice } from './batch.js'
import { rollingHashBase64, sha256Base64 } from './hash.js'
import type { SessionBatchBody, SyncableSessionHeader } from './types.js'

export function buildIdempotencyKey(
  deviceId: string,
  sessionId: string,
  fromSeq: number,
  toSeq: number,
): string {
  return `${deviceId}:${sessionId}:${fromSeq}:${toSeq}`
}

export function toSessionBatchBody(options: {
  deviceId: string
  sessionId: string
  slice: EventSlice
  previousRollingHash: string
  header: SyncableSessionHeader | null
  title: string | null
}): SessionBatchBody {
  const { deviceId, sessionId, slice, previousRollingHash, header, title } = options
  return {
    idempotencyKey: buildIdempotencyKey(deviceId, sessionId, slice.fromSeq, slice.toSeq),
    fromSeq: slice.fromSeq,
    toSeq: slice.toSeq,
    previousRollingHash,
    payloadSha256: sha256Base64(slice.payload),
    payloadBase64: slice.payload.toString('base64'),
    header: slice.fromSeq === 0 ? header : null,
    title: slice.fromSeq === 0 ? title : null,
  }
}

/** 逐行推进 rolling hash，返回批次最终 hash 的 canonical Base64。 */
export function finalRollingHash(
  previousRollingHash: string,
  payload: Buffer,
): string {
  let current = previousRollingHash
  let start = 0
  for (let index = 0; index < payload.length; index++) {
    if (payload[index] !== 0x0a) continue
    const line = payload.subarray(start, index)
    current = rollingHashBase64(current, line)
    start = index + 1
  }
  if (start !== payload.length) {
    throw new TypeError('payload must be newline-terminated JSONL')
  }
  return current
}
