/**
 * [INPUT]: 依赖 `src/library/storage/domain.ts`（域规格 + 四张表 zod + 记录门禁）、`records.ts`（信封）、`tests/library-support.ts`（内存假域与临时目录），以及 node:fs/promises（直接改盘上文件来造 foreign 记录）
 * [OUTPUT]: 锁住域规格（`dshent_library`/version 1/per-record/四张表名过官方规约）、四张表的字段门禁与默认值、写入前门禁，以及**官方 per-record 信封三条读语义**（非 JSON/版本不接受 ⇒ 静默当不存在；版本对但 schema 不符 ⇒ 加载失败）
 * [POS]: tests 下资料库纵深的**域契约回归**；本文件红 = 有人改了域名/表名/字段名、把 `.default()` 去掉、或把"版本不接受静默丢弃"改成了迁移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import {
  assertLibraryDomainSpec,
  parseLibraryRecord,
  LIBRARY_DOMAIN_NAME,
  LIBRARY_DOMAIN_TABLE_NAMES,
  LIBRARY_DOMAIN_VERSION,
  LIBRARY_ROOT_TITLE,
  LIBRARY_TABLE_SCHEMAS,
  libraryAssetSchema,
  libraryDomainSpec,
  libraryNodeSchema,
  libraryRevisionSchema,
  librarySelectionSchema,
} from '../src/library/storage/domain.js'
import { LIBRARY_UNIT_NAME_PATTERN } from '../src/library/storage/keys.js'
import { decodeRecordEnvelope, encodeRecordEnvelope, LIBRARY_RECORD_ENVELOPE_VERSION } from '../src/library/storage/records.js'
import { createInMemoryLibraryDomain, makeLibraryTempDir } from './library-support.js'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function makeTemp(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-domain-')
  temps.push(path)
  return path
}

/** 一条合法的节点记录（各字段都显式给，便于逐字段改坏）。 */
function validNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scope: 'personal',
    ownerId: 'u1001',
    id: 'nd_1',
    parentId: null,
    kind: 'folder',
    title: '项目甲',
    depth: 0,
    assetId: null,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

function validAsset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scope: 'personal',
    ownerId: 'u1001',
    id: 'as_1',
    nodeId: 'nd_2',
    name: '报告.md',
    kind: 'markdown',
    mediaType: 'text/markdown',
    byteLength: 12,
    currentRevisionId: null,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

function validRevision(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scope: 'personal',
    ownerId: 'u1001',
    id: 'rv_1',
    assetId: 'as_1',
    number: 1,
    originalSha256: 'a'.repeat(64),
    originalByteLength: 12,
    originalRelativePath: 'as_1/rv_1/original.md',
    contentSha256: 'b'.repeat(64),
    contentByteLength: 12,
    contentRelativePath: 'as_1/rv_1/content.md',
    conversionWarnings: [],
    createdAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

function validSelection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scope: 'personal',
    ownerId: 'u1001',
    id: 'session-abc',
    sessionId: 'session-abc',
    nodeIds: ['nd_1'],
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

function codeOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return (error as LibraryError).code
  }
  throw new Error('expected the call to throw')
}

describe('域规格（照勘误：name/version/layout 与四张表名）', () => {
  it('域名 dshent_library · version 1 · layout per-record · 四张表', () => {
    expect(libraryDomainSpec.name).toBe('dshent_library')
    expect(libraryDomainSpec.version).toBe(1)
    expect(libraryDomainSpec.layout).toBe('per-record')
    expect(Object.keys(libraryDomainSpec.tables)).toEqual(['nodes', 'assets', 'revisions', 'selections'])
    expect(LIBRARY_DOMAIN_TABLE_NAMES).toEqual(['nodes', 'assets', 'revisions', 'selections'])
    expect(LIBRARY_ROOT_TITLE).toBe('我的资料')
  })

  it('域名与每个表名都过官方 UNIT_NAME_RE（否则官方 defineDomain 会抛）', () => {
    expect(LIBRARY_UNIT_NAME_PATTERN.test(libraryDomainSpec.name)).toBe(true)
    for (const name of Object.keys(libraryDomainSpec.tables)) {
      expect(LIBRARY_UNIT_NAME_PATTERN.test(name)).toBe(true)
    }
  })

  it('每张表都带 valueSchema（官方 DomainTableSpec 的形状）', () => {
    for (const name of LIBRARY_DOMAIN_TABLE_NAMES) {
      expect(libraryDomainSpec.tables[name].valueSchema).toBe(LIBRARY_TABLE_SCHEMAS[name])
    }
  })

  it('模块加载即校验：坏域名/坏表名/坏版本/坏布局/空表都抛（等价官方 defineDomain 的 fail-loud）', () => {
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, name: 'Dshent-Library' })).toThrowError(/UNIT_NAME|domain name/)
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, name: '1library' })).toThrow()
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, version: 1.5 })).toThrowError(/version/)
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, version: -1 })).toThrowError(/version/)
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, layout: 'single' as 'per-record' })).toThrowError(/layout/)
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, tables: { 'Bad Name': libraryDomainSpec.tables.nodes } })).toThrowError(/table name/)
    expect(() => assertLibraryDomainSpec({ ...libraryDomainSpec, tables: {} })).toThrowError(/at least one table/)
  })
})

describe('四张表的记录形状与默认值', () => {
  it('nodes：合法记录逐字段落地；parentId/assetId 允许 null', () => {
    const parsed = libraryNodeSchema.parse(validNode())
    expect(parsed).toMatchObject({ id: 'nd_1', kind: 'folder', title: '项目甲', depth: 0, assetId: null })
    expect(libraryNodeSchema.safeParse(validNode({ parentId: 'nd_0', kind: 'asset', assetId: 'as_1' })).success).toBe(true)
  })

  it('nodes：坏形状逐条拒（少字段/枚举错/深度为负/时间戳非 ISO）', () => {
    const { title: _title, ...withoutTitle } = validNode()
    expect(libraryNodeSchema.safeParse(withoutTitle).success).toBe(false)
    expect(libraryNodeSchema.safeParse(validNode({ kind: 'file' })).success).toBe(false)
    expect(libraryNodeSchema.safeParse(validNode({ depth: -1 })).success).toBe(false)
    expect(libraryNodeSchema.safeParse(validNode({ createdAt: '2026-10-02' })).success).toBe(false)
    expect(libraryNodeSchema.safeParse(validNode({ schemaVersion: 2 })).success).toBe(false)
    expect(libraryNodeSchema.safeParse(validNode({ scope: 'organization' })).success).toBe(false)
  })

  it('assets：status/source 有默认值（写库时由 parse 补齐）', () => {
    const parsed = libraryAssetSchema.parse(validAsset())
    expect(parsed.status).toBe('active')
    expect(parsed.source).toBe('upload')
    expect(libraryAssetSchema.safeParse(validAsset({ kind: 'xlsx' })).success).toBe(false)
    expect(libraryAssetSchema.safeParse(validAsset({ byteLength: -1 })).success).toBe(false)
  })

  it('revisions：正文**不在**记录里（勘误 C：大正文不进 KV 记录），只有路径/摘要/长度', () => {
    const parsed = libraryRevisionSchema.parse(validRevision())
    expect(parsed).not.toHaveProperty('content')
    expect(parsed.contentRelativePath).toBe('as_1/rv_1/content.md')
    expect(parsed.conversionStatus).toBe('pending')
    expect(parsed.conversionWarnings).toEqual([])
    expect(parsed.number).toBe(1)
    expect(libraryRevisionSchema.safeParse(validRevision({ number: 0 })).success).toBe(false)
    expect(libraryRevisionSchema.safeParse(validRevision({ originalSha256: 'XYZ' })).success).toBe(false)
  })

  it('selections：nodeIds 有 32 的上限（A26:182 / §4.4 C9）', () => {
    expect(librarySelectionSchema.safeParse(validSelection({ nodeIds: Array.from({ length: 32 }, (_, i) => `nd_${i}`) })).success).toBe(true)
    expect(librarySelectionSchema.safeParse(validSelection({ nodeIds: Array.from({ length: 33 }, (_, i) => `nd_${i}`) })).success).toBe(false)
  })

  it('parseLibraryRecord：过门禁时补默认值，不过门禁时抛 library/invalid-record', () => {
    expect(parseLibraryRecord('assets', validAsset()).status).toBe('active')
    expect(codeOf(() => parseLibraryRecord('assets', { nope: true }))).toBe('library/invalid-record')
    expect(codeOf(() => parseLibraryRecord('nodes', null))).toBe('library/invalid-record')
  })
})

describe('per-record 记录信封（官方语义的可执行表述）', () => {
  it('编码 = 2 空格缩进 + 尾换行，形状 {version, record}', () => {
    expect(encodeRecordEnvelope(1, { a: 1 })).toBe('{\n  "version": 1,\n  "record": {\n    "a": 1\n  }\n}\n')
    expect(LIBRARY_RECORD_ENVELOPE_VERSION).toBe(1)
    expect(LIBRARY_DOMAIN_VERSION).toBe(1)
  })

  it('版本被接受 ⇒ 取回记录', () => {
    expect(decodeRecordEnvelope<{ a: number }>(encodeRecordEnvelope(1, { a: 1 }), [1])).toEqual({ a: 1 })
  })

  it('非 JSON / 空文件 / 不是对象 ⇒ 静默当不存在（undefined，不抛）', () => {
    expect(decodeRecordEnvelope('not json at all', [1])).toBeUndefined()
    expect(decodeRecordEnvelope('', [1])).toBeUndefined()
    expect(decodeRecordEnvelope('null', [1])).toBeUndefined()
    expect(decodeRecordEnvelope('42', [1])).toBeUndefined()
  })

  it('版本戳不被接受 ⇒ 静默丢弃、不迁移（勘误 C）', () => {
    expect(decodeRecordEnvelope(encodeRecordEnvelope(99, { a: 1 }), [1])).toBeUndefined()
    expect(decodeRecordEnvelope('{"record":{"a":1}}', [1])).toBeUndefined()
    expect(decodeRecordEnvelope('{"version":"1","record":{"a":1}}', [1])).toBeUndefined()
  })
})

describe('内存假实现镜像官方 per-record 后端（磁盘形态的三组断言）', () => {
  it('空域完全不落盘（open 一个从未写过的域 = 零文件）', async () => {
    const persistRoot = join(await makeTemp(), 'storages')
    await createInMemoryLibraryDomain({ persistRoot })
    await expect(readdir(persistRoot)).rejects.toThrowError()
  })

  it('写入落盘 = storages/<域>/<表>/<key>.json，信封与官方逐字同形，0600/0700', async () => {
    const persistRoot = join(await makeTemp(), 'storages')
    const domain = await createInMemoryLibraryDomain({ persistRoot })
    const record = parseLibraryRecord('nodes', validNode())
    await domain.table('nodes').put('personal_u1001_nd_1', record)

    const directory = join(persistRoot, LIBRARY_DOMAIN_NAME, 'nodes')
    const file = join(directory, 'personal_u1001_nd_1.json')
    expect(await readFile(file, 'utf8')).toBe(encodeRecordEnvelope(1, record))
    expect((await stat(directory)).mode & 0o777).toBe(0o700)
    expect((await stat(file)).mode & 0o777).toBe(0o600)
  })

  it('重新打开时：有效记录读回、版本不被接受的静默消失、坏文件名跳过', async () => {
    const persistRoot = join(await makeTemp(), 'storages')
    const first = await createInMemoryLibraryDomain({ persistRoot })
    await first.table('nodes').put('personal_u1001_nd_1', parseLibraryRecord('nodes', validNode()))
    await first.table('nodes').put('personal_u1001_nd_2', parseLibraryRecord('nodes', validNode({ id: 'nd_2' })))

    const directory = join(persistRoot, LIBRARY_DOMAIN_NAME, 'nodes')
    // ① 版本戳 99：官方 per-record 语义 = 静默丢弃、不迁移
    await writeFile(join(directory, 'personal_u1001_nd_2.json'), encodeRecordEnvelope(99, { anything: true }))
    // ② 非 JSON：同样当作不存在
    await writeFile(join(directory, 'personal_u1001_broken.json'), 'not json')
    // ③ 文件名不是路径安全的键：官方直接跳过（不读、不报）
    await writeFile(join(directory, 'bad key.json'), encodeRecordEnvelope(1, {}))

    const reopened = await createInMemoryLibraryDomain({ persistRoot })
    expect([...reopened.table('nodes').keys()]).toEqual(['personal_u1001_nd_1'])
    expect(reopened.table('nodes').get('personal_u1001_nd_1')?.title).toBe('项目甲')
  })

  it('版本对但 schema 不符 ⇒ 加载失败（等价官方默认策略 open 抛 invalid-record）', async () => {
    const persistRoot = join(await makeTemp(), 'storages')
    const directory = join(persistRoot, LIBRARY_DOMAIN_NAME, 'nodes')
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(join(directory, 'personal_u1001_nd_1.json'), encodeRecordEnvelope(1, { nope: true }))
    await expect(createInMemoryLibraryDomain({ persistRoot })).rejects.toMatchObject({ code: 'library/invalid-record' })
  })

  it('删除只删记录、不删目录（勘误 B3：目录留着，断言不许写"目录被清理"）', async () => {
    const persistRoot = join(await makeTemp(), 'storages')
    const domain = await createInMemoryLibraryDomain({ persistRoot })
    await domain.table('nodes').put('personal_u1001_nd_1', parseLibraryRecord('nodes', validNode()))
    expect(await domain.table('nodes').delete('personal_u1001_nd_1')).toBe(true)
    expect(await domain.table('nodes').delete('personal_u1001_nd_1')).toBe(false)
    expect(await readdir(join(persistRoot, LIBRARY_DOMAIN_NAME, 'nodes'))).toEqual([])
  })
})
