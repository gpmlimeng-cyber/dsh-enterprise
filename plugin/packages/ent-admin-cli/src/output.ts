/**
 * [INPUT]: 依赖 EntAdminHttpError 与 process stdio
 * [OUTPUT]: 对外提供 printJson/printHuman/exitCodeFor
 * [POS]: ent-admin-cli 的 stdout/stderr/exit 契约，服务 Agent
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EntAdminHttpError } from './http.js'

export function exitCodeFor(error: unknown): number {
  if (error instanceof EntAdminHttpError) {
    if (error.code === 'ENT_AUTH_REQUIRED') return 2
    return 1
  }
  if (error instanceof TypeError) return 2
  if (error instanceof Error && error.message.includes('not configured')) return 2
  return 1
}

export function printJson(value: unknown, stdout: NodeJS.WritableStream = process.stdout): void {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

export function printErrorJson(error: unknown, stdout: NodeJS.WritableStream = process.stdout): void {
  if (error instanceof EntAdminHttpError) {
    printJson(
      {
        error: {
          code: error.code,
          retryable: error.retryable,
          status: error.status,
          requestId: error.requestId,
        },
      },
      stdout,
    )
    return
  }
  const code = error instanceof Error && error.message.includes('not configured') ? 'ENT_INVALID_REQUEST' : 'ENT_PLATFORM_UNAVAILABLE'
  printJson(
    {
      error: {
        code,
        retryable: false,
        status: 0,
        requestId: null,
        message: error instanceof Error ? error.message : String(error),
      },
    },
    stdout,
  )
}

export function printHuman(message: string, stderr: NodeJS.WritableStream = process.stderr): void {
  stderr.write(`${message}\n`)
}

export function printPageSummary(data: unknown, stderr: NodeJS.WritableStream = process.stderr): void {
  if (typeof data !== 'object' || data === null) return
  const record = data as Record<string, unknown>
  const page = record['data'] as Record<string, unknown> | undefined
  if (page === undefined) return
  const items = page['items']
  const count = Array.isArray(items) ? items.length : undefined
  const next = page['nextCursor']
  stderr.write(`items=${count ?? '?'} nextCursor=${typeof next === 'string' && next.length > 0 ? next : '-'}\n`)
}
