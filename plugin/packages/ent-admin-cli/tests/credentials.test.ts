/**
 * [INPUT]: 依赖 vitest 与 src/credentials
 * [OUTPUT]: 验证 Refresh Token 落盘校验与损坏文件 fail-closed
 * [POS]: ent-admin-cli 凭据边界测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { deleteCredentials, loadCredentials, saveCredentials } from '../src/credentials.js'

function sampleRefresh(): string {
  return `dshr_${randomBytes(32).toString('base64url').slice(0, 43)}`
}

describe('credentials', () => {
  it('round-trips a valid refresh token', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    const record = {
      serverUrl: 'https://dsh.example.com',
      installationId: '11111111-1111-4111-8111-111111111111',
      refreshToken: sampleRefresh(),
      refreshExpiresAt: Date.now() + 86_400_000,
    }
    await saveCredentials(record, env)
    expect(await loadCredentials(env)).toEqual(record)
    const raw = await readFile(join(home, 'credentials.json'), 'utf8')
    expect(JSON.parse(raw).refreshToken.startsWith('dshr_')).toBe(true)
    await deleteCredentials(env)
    expect(await loadCredentials(env)).toBeUndefined()
  })

  it('rejects malformed credentials', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    await writeFile(join(home, 'credentials.json'), '{"refreshToken":"nope"}\n', 'utf8')
    await expect(loadCredentials(env)).rejects.toThrow()
  })
})
