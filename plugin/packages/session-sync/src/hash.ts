/**
 * [INPUT]: 依赖 Node crypto 与设计 §12.2 rolling hash / payload SHA-256 定义
 * [OUTPUT]: 对外提供 INITIAL_ROLLING_HASH、rollingHash、sha256Base64、base64 工具
 * [POS]: session-sync 纯函数密码学校验边界；与服务端 SessionBatchParser 同定义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'

export const HASH_BYTES = 32 as const

/** H[-1]：32 个零字节的 canonical Base64。 */
export const INITIAL_ROLLING_HASH = Buffer.alloc(HASH_BYTES).toString('base64')

export function rollingHash(previous: Buffer | string, rawLineWithoutNewline: Buffer | string): Buffer {
  const prev = typeof previous === 'string' ? Buffer.from(previous, 'base64') : previous
  const line = typeof rawLineWithoutNewline === 'string'
    ? Buffer.from(rawLineWithoutNewline, 'utf8')
    : rawLineWithoutNewline
  if (prev.length !== HASH_BYTES) {
    throw new TypeError('previous rolling hash must be 32 bytes')
  }
  return createHash('sha256').update(prev).update(line).digest()
}

export function rollingHashBase64(previous: Buffer | string, rawLineWithoutNewline: Buffer | string): string {
  return rollingHash(previous, rawLineWithoutNewline).toString('base64')
}

export function sha256Base64(payload: Buffer | string): string {
  const bytes = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload
  return createHash('sha256').update(bytes).digest('base64')
}

export function decodeRollingHash(encoded: string): Buffer {
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length !== HASH_BYTES || bytes.toString('base64') !== encoded) {
    throw new TypeError('rolling hash must be canonical 32-byte base64')
  }
  return bytes
}
