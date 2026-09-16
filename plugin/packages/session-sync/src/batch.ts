/**
 * [INPUT]: 依赖 SyncableEvent 与 maxBatchBytes 语义
 * [OUTPUT]: 对外提供 encodeEventLine、buildJsonlPayload、sliceEventsByBytes、splitSessionEvents
 * [POS]: session-sync 切批纯函数；单批明文字节 ≤ maxBatchBytes，与 T16 BATCH_TOO_LARGE 对齐
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { SyncableEvent } from './types.js'

export interface EventSlice {
  readonly fromSeq: number
  readonly toSeq: number
  readonly events: readonly SyncableEvent[]
  /** 含换行的 UTF-8 JSONL 字节。 */
  readonly payload: Buffer
  /** 仅整段第一片且 fromSeq===0 时携带 header。 */
  readonly isFirstSlice: boolean
}

export function encodeEventLine(event: SyncableEvent): Buffer {
  return Buffer.from(`${JSON.stringify(event)}\n`, 'utf8')
}

export function buildJsonlPayload(events: readonly SyncableEvent[]): Buffer {
  return Buffer.concat(events.map(encodeEventLine))
}

/**
 * 按累计 payload 字节切片；单事件本身超过上限时仍独占一片，
 * 由服务端 BATCH_TOO_LARGE / 客户端终态处理（不静默丢弃）。
 */
export function sliceEventsByBytes(
  events: readonly SyncableEvent[],
  maxBatchBytes: number,
): EventSlice[] {
  if (!Number.isSafeInteger(maxBatchBytes) || maxBatchBytes < 1) {
    throw new TypeError('maxBatchBytes must be a positive safe integer')
  }
  const slices: EventSlice[] = []
  let current: SyncableEvent[] = []
  let currentBytes = 0

  const pushCurrent = (): void => {
    if (current.length === 0) return
    slices.push({
      fromSeq: current[0]!.seq,
      toSeq: current[current.length - 1]!.seq,
      events: current,
      payload: buildJsonlPayload(current),
      isFirstSlice: slices.length === 0,
    })
    current = []
    currentBytes = 0
  }

  for (const event of events) {
    const line = encodeEventLine(event)
    if (current.length > 0 && currentBytes + line.length > maxBatchBytes) {
      pushCurrent()
    }
    current.push(event)
    currentBytes += line.length
  }
  pushCurrent()
  return slices
}

export function splitSessionEvents(
  events: readonly SyncableEvent[],
  options: { maxBatchBytes: number },
): EventSlice[] {
  return sliceEventsByBytes(events, options.maxBatchBytes).map(slice => ({
    ...slice,
    isFirstSlice: slice.isFirstSlice && slice.fromSeq === 0,
  }))
}
