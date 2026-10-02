/**
 * [INPUT]: 依赖 `src/library/objects.ts`（对象层）、`tests/library-support.ts`（临时 dshHome），以及 node:fs/promises 的 stat/symlink/readFile 等（造权限、符号链接、坏文件）
 * [OUTPUT]: 锁住对象层的落盘形状（`<dshHome>/library/objects/<assetId>/<revisionId>/{original.<ext>,content.md,conversion.json}`）、权限 0600/0700、不可变语义（同一 revisionId 二次写拒）、读语义（缺文件/空文件/超大文件/非法 UTF-8/坏 conversion），以及**抄自 skill-install.ts 的路径门禁**（`../`、绝对路径、中间目录符号链接、文件本身符号链接一律 fail-closed）
 * [POS]: tests 下资料库纵深的**二进制层回归**；本文件红 = 有人放开了覆盖（不可变被破坏）、放开了符号链接逃逸、或改了 0600/0700 与信封缩进
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { lstat, mkdir, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import {
  decodeConversionRecord,
  encodeConversionRecord,
  LibraryObjectStore,
  LIBRARY_CONTENT_FILENAME,
  LIBRARY_CONVERSION_FILENAME,
  LIBRARY_MAX_CONVERSION_BYTES,
  LIBRARY_MAX_ORIGINAL_BYTES,
  LIBRARY_MAX_TEXT_BYTES,
  type LibraryConversionRecord,
} from '../src/library/objects.js'
import { makeLibraryTempDir } from './library-support.js'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-objects-')
  temps.push(path)
  return path
}

const SAMPLE = '# 标题\n正文\n'
const CONVERSION: LibraryConversionRecord = {
  version: 1,
  kind: 'markdown',
  originalSha256: 'a'.repeat(64),
  warnings: ['w1'],
  locations: [{ kind: 'heading', ordinal: 1, text: '标题' }],
}

function revisionDirectory(home: string, assetId = 'as_1', revisionId = 'rv_1'): string {
  return join(home, 'library', 'objects', assetId, revisionId)
}

async function writeSample(store: LibraryObjectStore, overrides: Record<string, unknown> = {}) {
  return await store.writeRevision({
    assetId: 'as_1',
    revisionId: 'rv_1',
    extension: 'md',
    original: Buffer.from(SAMPLE, 'utf8'),
    content: SAMPLE,
    ...overrides,
  })
}

function codeOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return (error as LibraryError).code
  }
  throw new Error('expected the call to throw')
}

/** 断言一个路径**确实不存在**（`lstat` 抛 `ENOENT`），而不是断言"抛了某个码"——两者语义不同。 */
async function expectMissing(path: string): Promise<void> {
  await expect(lstat(path)).rejects.toMatchObject({ code: 'ENOENT' })
}

async function rejectionCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as LibraryError).code
  }
  throw new Error('expected the call to reject')
}

describe('落盘形状与权限', () => {
  it('写三个文件：original.<ext> / content.md / conversion.json，返回摘要与相对路径', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store, { conversion: CONVERSION })

    // 返回的是 realpath 之后的**真实**落点：本机 `/data/user/0/...` 是 `/data/data/...` 的符号链接，
    // 两个字符串不相等，落点等式的权威在真身那一侧（与 skill-install.ts 的 resolvedDirectory 同口径）。
    expect(written.directory).toBe(await realpath(revisionDirectory(home)))
    expect(written.originalFilename).toBe('original.md')
    expect(written.originalRelativePath).toBe('as_1/rv_1/original.md')
    expect(written.contentRelativePath).toBe('as_1/rv_1/content.md')
    expect(written.originalByteLength).toBe(Buffer.byteLength(SAMPLE, 'utf8'))
    expect(written.contentByteLength).toBe(Buffer.byteLength(SAMPLE, 'utf8'))
    expect(written.originalSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(written.contentSha256).toBe(written.originalSha256)
    expect(written.conversionWritten).toBe(true)

    expect(await readFile(join(written.directory, 'original.md'), 'utf8')).toBe(SAMPLE)
    expect(await readFile(join(written.directory, LIBRARY_CONTENT_FILENAME), 'utf8')).toBe(SAMPLE)
  })

  it('权限：目录 0700、文件 0600', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store, { conversion: CONVERSION })

    expect((await stat(join(home, 'library'))).mode & 0o777).toBe(0o700)
    expect((await stat(join(home, 'library', 'objects'))).mode & 0o777).toBe(0o700)
    expect((await stat(written.directory)).mode & 0o777).toBe(0o700)
    for (const filename of ['original.md', LIBRARY_CONTENT_FILENAME, LIBRARY_CONVERSION_FILENAME]) {
      expect((await stat(join(written.directory, filename))).mode & 0o777).toBe(0o600)
    }
  })

  it('conversion.json 逐字节等于规定形状：键序 + 2 空格缩进 + 尾换行', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const dir = revisionDirectory(home)
    await writeSample(store, { conversion: CONVERSION })

    const expected = encodeConversionRecord(CONVERSION)
    expect(await readFile(join(dir, LIBRARY_CONVERSION_FILENAME), 'utf8')).toBe(expected)
    expect(expected).toBe(`${JSON.stringify({
      version: 1,
      kind: 'markdown',
      originalSha256: 'a'.repeat(64),
      warnings: ['w1'],
      locations: [{ kind: 'heading', ordinal: 1, text: '标题' }],
    }, null, 2)}\n`)
    expect(decodeConversionRecord(expected)).toEqual(CONVERSION)
  })

  it('不带 conversion 时只写两个文件，读 conversion 得 undefined（未转换是合法态）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    expect(written.conversionWritten).toBe(false)
    const entries = await readFile(join(written.directory, LIBRARY_CONTENT_FILENAME), 'utf8')
    expect(entries).toBe(SAMPLE)
    expect(await store.readRevisionConversion('as_1', 'rv_1')).toBeUndefined()
  })

  it('写完不留任何 .tmp 残件', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store, { conversion: CONVERSION })
    expect((await readdir(written.directory)).sort()).toEqual(['content.md', 'conversion.json', 'original.md'])
  })
})

describe('不可变语义：同一 revisionId 只允许写一次', () => {
  it('二次写 ⇒ library/revision-immutable，且盘上内容逐字节未变', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    await writeSample(store, { conversion: CONVERSION })

    const code = await rejectionCode(writeSample(store, { content: '被覆盖的正文', conversion: undefined }))
    expect(code).toBe('library/revision-immutable')
    expect(await readFile(join(revisionDirectory(home), LIBRARY_CONTENT_FILENAME), 'utf8')).toBe(SAMPLE)
    expect(await store.readRevisionConversion('as_1', 'rv_1')).toEqual(CONVERSION)
  })

  it('落点只要是"存在的任何东西"就拒（含悬空符号链接）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const dir = revisionDirectory(home)
    await mkdir(join(home, 'library', 'objects', 'as_1'), { recursive: true, mode: 0o700 })
    await symlink(join(home, 'nowhere'), dir)
    expect(await store.revisionExists('as_1', 'rv_1')).toBe(true)
    expect(await rejectionCode(writeSample(store))).toBe('library/revision-immutable')
  })

  it('revisionExists / removeRevisionObjects：删除后连空的资产目录一起收走', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    await writeSample(store)
    expect(await store.revisionExists('as_1', 'rv_1')).toBe(true)
    expect(await store.removeRevisionObjects('as_1', 'rv_1')).toBe(true)
    expect(await store.revisionExists('as_1', 'rv_1')).toBe(false)
    // 资产目录空了就删掉；对象根不动（只删空目录，绝不递归删别人的东西）
    await expectMissing(join(home, 'library', 'objects', 'as_1'))
    expect(await store.removeRevisionObjects('as_1', 'rv_1')).toBe(false)
  })
})

describe('读语义：缺文件 / 空文件 / 超大文件 / 非法 UTF-8', () => {
  it('对象根不存在 ⇒ library/not-found（还没有任何资料）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/not-found')
  })

  it('修订目录不存在 / 文件被删 ⇒ library/object-missing（记录在、原件没了）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_9'))).toBe('library/object-missing')
    await rm(join(written.directory, LIBRARY_CONTENT_FILENAME))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/object-missing')
  })

  it('空文件是合法内容：正文 = 空串（0 字节）、原件 = 0 字节', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await store.writeRevision({
      assetId: 'as_1',
      revisionId: 'rv_1',
      extension: 'txt',
      original: Buffer.alloc(0),
      content: '',
    })
    expect(await store.readRevisionText('as_1', 'rv_1')).toEqual({ text: '', byteLength: 0 })
    const original = await store.readRevisionOriginal('as_1', 'rv_1', 'txt')
    expect(original.byteLength).toBe(0)
    expect(original.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(written.contentByteLength).toBe(0)
  })

  it('正文超过 8 MiB ⇒ library/file-too-large（先看 size，不读进内存）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    await writeFile(join(written.directory, LIBRARY_CONTENT_FILENAME), Buffer.alloc(LIBRARY_MAX_TEXT_BYTES + 1))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/file-too-large')
  })

  it('原件超过 50 MiB ⇒ 写入前就拒（fail fast，不落任何字节）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    expect(await rejectionCode(writeSample(store, { original: Buffer.alloc(LIBRARY_MAX_ORIGINAL_BYTES + 1) })))
      .toBe('library/file-too-large')
    expect(await store.revisionExists('as_1', 'rv_1')).toBe(false)
  })

  it('非法 UTF-8 或夹 NUL ⇒ library/invalid-text（二进制不许冒充文本）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    await writeFile(join(written.directory, LIBRARY_CONTENT_FILENAME), Buffer.from([0xff, 0xfe, 0xfd]))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/invalid-text')
    await writeFile(join(written.directory, LIBRARY_CONTENT_FILENAME), Buffer.from('前\u0000后', 'utf8'))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/invalid-text')
  })

  it('conversion.json 空 / 非 JSON / 形状不符 ⇒ library/conversion-invalid；超大 ⇒ file-too-large', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    const file = join(written.directory, LIBRARY_CONVERSION_FILENAME)
    await writeFile(file, '')
    expect(await rejectionCode(store.readRevisionConversion('as_1', 'rv_1'))).toBe('library/conversion-invalid')
    await writeFile(file, 'not json')
    expect(await rejectionCode(store.readRevisionConversion('as_1', 'rv_1'))).toBe('library/conversion-invalid')
    await writeFile(file, JSON.stringify({ version: 1, kind: 'markdown' }))
    expect(await rejectionCode(store.readRevisionConversion('as_1', 'rv_1'))).toBe('library/conversion-invalid')
    await writeFile(file, Buffer.alloc(LIBRARY_MAX_CONVERSION_BYTES + 1))
    expect(await rejectionCode(store.readRevisionConversion('as_1', 'rv_1'))).toBe('library/file-too-large')
    expect(codeOf(() => encodeConversionRecord({ version: 1, kind: 'markdown' } as LibraryConversionRecord)))
      .toBe('library/conversion-invalid')
  })
})

describe('路径门禁（抄 skill-install.ts 的 lstat + realpath 等式）', () => {
  it.each(['..', '.', 'a/b', '/abs', 'C:\\x', 'a b', 'a:b', ''])('assetId %j 不是键形状 ⇒ invalid-request', async (bad) => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    expect(await rejectionCode(writeSample(store, { assetId: bad }))).toBe('library/invalid-request')
    expect(await rejectionCode(store.readRevisionText(bad, 'rv_1'))).toBe('library/invalid-request')
    expect(await rejectionCode(store.removeRevisionObjects(bad, 'rv_1'))).toBe('library/invalid-request')
  })

  it.each(['..', 'a/b', '/abs', ''])('revisionId %j 不是键形状 ⇒ invalid-request', async (bad) => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    expect(await rejectionCode(writeSample(store, { revisionId: bad }))).toBe('library/invalid-request')
    expect(await rejectionCode(store.readRevisionText('as_1', bad))).toBe('library/invalid-request')
  })

  it.each(['..', 'a/b', '', 'tar.gz', 'a:b', 'x'.repeat(17)])('extension %j 不合法 ⇒ invalid-request', async (bad) => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    expect(await rejectionCode(writeSample(store, { extension: bad }))).toBe('library/invalid-request')
  })

  it('扩展名先小写归一（MD → original.md），文件名不会被原样拼进路径', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store, { extension: 'MD' })
    expect(written.originalFilename).toBe('original.md')
    expect((await readdir(written.directory)).includes('original.md')).toBe(true)
  })

  it('中间目录被换成符号链接（指向对象根之外）⇒ path-escape，且失败后不留半成品', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const objectsRoot = join(home, 'library', 'objects')
    const outside = await makeHome()
    await mkdir(objectsRoot, { recursive: true, mode: 0o700 })
    await symlink(outside, join(objectsRoot, 'as_1'))

    expect(await rejectionCode(writeSample(store))).toBe('library/path-escape')
    // 清理：通过符号链接建出来的目录被删掉；对象根之外的目录一个字节都没多出来。
    await expectMissing(join(outside, 'rv_1'))
    await expectMissing(join(objectsRoot, 'as_1', 'rv_1'))
    expect(await readdir(outside)).toEqual([])
  })

  it('修订目录本身是符号链接 ⇒ object-invalid（读与删都拒）', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const elsewhere = await makeHome()
    await mkdir(join(home, 'library', 'objects', 'as_1'), { recursive: true, mode: 0o700 })
    await symlink(elsewhere, revisionDirectory(home))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/object-invalid')
    expect(await rejectionCode(store.removeRevisionObjects('as_1', 'rv_1'))).toBe('library/object-invalid')
  })

  it('content.md 本身是符号链接（哪怕指向对象根内）⇒ object-invalid', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    const target = join(written.directory, 'original.md')
    await rm(join(written.directory, LIBRARY_CONTENT_FILENAME))
    await symlink(target, join(written.directory, LIBRARY_CONTENT_FILENAME))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/object-invalid')
  })

  it('文件被目录冒充（或反之）⇒ object-invalid', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    const written = await writeSample(store)
    await rm(join(written.directory, LIBRARY_CONTENT_FILENAME))
    await mkdir(join(written.directory, LIBRARY_CONTENT_FILENAME))
    expect(await rejectionCode(store.readRevisionText('as_1', 'rv_1'))).toBe('library/object-invalid')

    const other = await makeHome()
    const store2 = new LibraryObjectStore({ dshHome: other })
    await mkdir(join(other, 'library', 'objects', 'as_1', 'rv_1'), { recursive: true, mode: 0o700 })
    await writeFile(join(other, 'library', 'objects', 'as_1', 'rv_2'), 'not a directory')
    expect(await rejectionCode(store2.readRevisionText('as_1', 'rv_2'))).toBe('library/object-invalid')
  })

  it('对象层构造要求显式 dshHome', () => {
    expect(codeOf(() => new LibraryObjectStore({ dshHome: '' }))).toBe('library/invalid-request')
  })
})
