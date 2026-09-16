/**
 * [INPUT]: 依赖 node:test 风格 vitest 与 src/config
 * [OUTPUT]: 验证 server origin 归一化与配置读写
 * [POS]: ent-admin-cli config 边界测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig, normalizeServerOrigin, resolveServerUrl, saveConfig } from '../src/config.js'

describe('normalizeServerOrigin', () => {
  it('accepts http and https origins', () => {
    expect(normalizeServerOrigin('https://dsh.example.com')).toBe('https://dsh.example.com')
    expect(normalizeServerOrigin('http://127.0.0.1:8080/')).toBe('http://127.0.0.1:8080')
  })

  it('rejects path and credentials', () => {
    expect(() => normalizeServerOrigin('https://dsh.example.com/enterprise')).toThrow(TypeError)
    expect(() => normalizeServerOrigin('https://user:pass@dsh.example.com')).toThrow(TypeError)
  })
})

describe('config file', () => {
  it('round-trips config with 0600 intent', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    await saveConfig({ serverUrl: 'https://dsh.example.com' }, env)
    const raw = await readFile(join(home, 'config.json'), 'utf8')
    expect(JSON.parse(raw)).toEqual({ serverUrl: 'https://dsh.example.com' })
    expect(await loadConfig(env)).toEqual({ serverUrl: 'https://dsh.example.com' })
  })

  it('fails closed on malformed config', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    await writeFile(join(home, 'config.json'), '{"serverUrl":42}\n', 'utf8')
    await expect(loadConfig(env)).rejects.toThrow()
  })

  it('resolveServerUrl prefers flag over file', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ent-admin-'))
    const env = { DSH_ENT_ADMIN_HOME: home }
    await saveConfig({ serverUrl: 'https://file.example.com' }, env)
    await expect(resolveServerUrl({ server: 'https://flag.example.com', env })).resolves.toBe(
      'https://flag.example.com',
    )
  })
})
