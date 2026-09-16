/**
 * [INPUT]: 依赖 vitest、src/cli 与 src/http
 * [OUTPUT]: 验证 Agent --json 契约、exit code 与未登录错误
 * [POS]: ent-admin-cli CLI 契约测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { mapAuditFilters, runCli } from '../src/cli.js'
import { EntAdminHttpError } from '../src/http.js'
import { exitCodeFor } from '../src/output.js'

function collect(): { stream: Writable; text: () => string } {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk))
      callback()
    },
  })
  return { stream, text: () => chunks.join('') }
}

describe('runCli contract', () => {
  it('prints pure JSON and exit 2 when not authenticated', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = {
      DSH_ENT_ADMIN_HOME: home,
      DSH_ENT_ADMIN_SERVER: 'https://dsh.example.com',
    }
    const out = collect()
    const err = collect()
    const code = await runCli({
      argv: ['members', 'list', '--json'],
      env,
      stdout: out.stream,
      stderr: err.stream,
    })
    expect(code).toBe(2)
    const payload = JSON.parse(out.text())
    expect(payload.error.code).toBe('ENT_AUTH_REQUIRED')
  })

  it('prints help for unknown resource', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    const out = collect()
    const err = collect()
    const code = await runCli({ argv: ['nope'], env, stdout: out.stream, stderr: err.stream })
    expect(code).toBe(2)
    expect(err.text()).toContain('dsh-ent-admin')
  })

  it('status without server exits 2 with human stderr by default', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    const out = collect()
    const err = collect()
    const code = await runCli({ argv: ['status'], env, stdout: out.stream, stderr: err.stream })
    expect(code).toBe(2)
    expect(out.text()).toBe('')
    expect(err.text()).toContain('not configured')
  })

  it('status without server exits 2 with JSON when --json', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    const out = collect()
    const err = collect()
    const code = await runCli({ argv: ['status', '--json'], env, stdout: out.stream, stderr: err.stream })
    expect(code).toBe(2)
    expect(JSON.parse(out.text()).error.code).toBe('ENT_INVALID_REQUEST')
  })
})

describe('exitCodeFor', () => {
  it('maps auth required to 2 and business errors to 1', () => {
    expect(exitCodeFor(new EntAdminHttpError('ENT_AUTH_REQUIRED', false, 401, null))).toBe(2)
    expect(exitCodeFor(new EntAdminHttpError('ENT_PERMISSION_DENIED', false, 403, null))).toBe(1)
    expect(exitCodeFor(new TypeError('bad'))).toBe(2)
  })
})

describe('mapAuditFilters', () => {
  it('maps kebab CLI flags to OpenAPI camelCase query keys', () => {
    expect(
      mapAuditFilters({
        'request-id': 'req_abc',
        'actor-id': 'usr_1',
        action: 'model.invoke',
        'resource-type': 'model',
        'resource-id': 'm1',
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
        json: true,
      }),
    ).toEqual({
      requestId: 'req_abc',
      actorId: 'usr_1',
      action: 'model.invoke',
      resourceType: 'model',
      resourceId: 'm1',
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-02T00:00:00Z',
    })
  })
})
