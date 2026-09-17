/**
 * [INPUT]: 依赖 MappingStore 与 slug 工具纯函数。
 * [OUTPUT]: 验证映射原子读写、slug 规则与路径校验。
 * [POS]: cloud-workspace 的持久化与纯函数单测。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MappingStore } from '../src/mapping-store.js'
import { isValidProjectId, isValidRootDir, slugify } from '../src/slug.js'
import { CloudWorkspaceError, toCloudWorkspaceError } from '../src/errors.js'

describe('slugify', () => {
  it('normalizes display names', () => {
    expect(slugify('Team Docs!')).toBe('team-docs')
    expect(slugify('  ')).toBe('project')
    expect(slugify('A'.repeat(80)).length).toBeLessThanOrEqual(64)
  })

  it('validates ids and roots', () => {
    expect(isValidProjectId('42')).toBe(true)
    expect(isValidProjectId('0')).toBe(false)
    expect(isValidRootDir('/tmp/work')).toBe(true)
    expect(isValidRootDir('relative')).toBe(false)
  })
})

describe('MappingStore', () => {
  it('round-trips mappings atomically', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dshent-map-'))
    const store = new MappingStore(join(dir, 'nested', 'mappings.json'))
    store.put({
      projectId: '42',
      slug: 'team-docs',
      path: '/tmp/work/team-docs',
      cloneUrl: 'http://localhost:8080/enterprise/api/v1/git/42',
      defaultBranch: 'main',
      lastActionAt: '2026-09-17T00:00:00.000Z',
    })
    expect(store.get('42')?.path).toBe('/tmp/work/team-docs')
    expect(store.list()).toHaveLength(1)
    const parsed = JSON.parse(readFileSync(join(dir, 'nested', 'mappings.json'), 'utf8'))
    expect(parsed.version).toBe(1)
    store.remove('42')
    expect(store.list()).toHaveLength(0)
  })
})

describe('errors', () => {
  it('maps known errors', () => {
    const error = toCloudWorkspaceError(new CloudWorkspaceError('ENT_WORKSPACE_NOT_MAPPED', 'x', 400))
    expect(error.code).toBe('ENT_WORKSPACE_NOT_MAPPED')
    const wrapped = toCloudWorkspaceError(new Error('boom'))
    expect(wrapped.code).toBe('ENT_INVALID_REQUEST')
  })
})
