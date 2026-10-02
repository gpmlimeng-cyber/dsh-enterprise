/**
 * [INPUT]: 依赖 `src/library/objects.ts` 的原子写实现，并用 `vi.mock('node:fs/promises')` **只**拦住 `rename`（其余全部透传真实现），以便在纯用户态注入"临时件已写好、改名失败"这一刻
 * [OUTPUT]: 锁住两件在正常路径上观察不到的性质：① 改名之前临时件已经**完整**写好（同目录、`.<uuid>.tmp`、0600、内容逐字节等于最终内容）；② 改名失败 ⇒ 临时件被清理、修订目录与空的资产目录都不残留，且**同一 revisionId 可以重试成功**（回到"从未发生"的状态）
 * [POS]: tests 下的**失败路径**回归（单独成文件是因为 `vi.mock` 是文件级作用域，会波及同文件内所有 import）；本文件红 = 有人改成"先建空文件再往里写"、把临时件放到别的目录（跨目录 rename 不再是原子）、或失败路径不清理
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import { LibraryObjectStore } from '../src/library/objects.js'
import { makeLibraryTempDir } from './library-support.js'

/** 注入点：必须在 `vi.mock` 工厂之前用 `vi.hoisted` 定义（工厂会被提升到文件顶部执行）。 */
const faults = vi.hoisted(() => ({
  failNextRename: false,
  renames: [] as { from: string; to: string; text: string; mode: number; isTempName: boolean }[],
}))

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rename: async (from: string, to: string): Promise<void> => {
      // 记录"改名前这一刻"的事实：临时件在不在、叫什么、权限多少、内容是不是已经写全。
      const stats = await actual.stat(from)
      faults.renames.push({
        from,
        to,
        text: await actual.readFile(from, 'utf8'),
        mode: stats.mode & 0o777,
        isTempName: /^\.[0-9a-f-]{36}\.tmp$/.test(from.slice(from.lastIndexOf('/') + 1)),
      })
      if (faults.failNextRename) {
        faults.failNextRename = false
        throw new Error('injected rename failure')
      }
      await actual.rename(from, to)
    },
  }
})

const temps: string[] = []
afterEach(async () => {
  faults.failNextRename = false
  faults.renames.length = 0
  await Promise.all(temps.splice(0).map(path => rmPath(path)))
})

async function rmPath(path: string): Promise<void> {
  const { rm } = await import('node:fs/promises')
  await rm(path, { force: true, recursive: true })
}

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-atomic-')
  temps.push(path)
  return path
}

/** 递归找出任意 `.tmp` 残件（临时件清理的强断言）。 */
async function findTempFiles(root: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const found: string[] = []
  const queue = [root]
  while (queue.length > 0) {
    const current = queue.shift()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) queue.push(path)
      else if (entry.name.endsWith('.tmp')) found.push(path)
    }
  }
  return found
}

async function rejectionCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as LibraryError).code
  }
  throw new Error('expected the call to reject')
}

const SAMPLE = '# 标题\n正文\n'

describe('原子写：先写完临时件，再改名', () => {
  it('改名时临时件已完整写好：同目录、.<uuid>.tmp、0600、内容逐字节等于最终内容', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    await store.writeRevision({
      assetId: 'as_1',
      revisionId: 'rv_1',
      extension: 'md',
      original: Buffer.from(SAMPLE, 'utf8'),
      content: SAMPLE,
    })

    expect(faults.renames.map(entry => entry.to.slice(entry.to.lastIndexOf('/') + 1))).toEqual(['original.md', 'content.md'])
    for (const entry of faults.renames) {
      expect(entry.isTempName).toBe(true)
      // 同目录 rename 才是原子的：临时件的目录必须等于目标的目录。
      expect(entry.from.slice(0, entry.from.lastIndexOf('/'))).toBe(entry.to.slice(0, entry.to.lastIndexOf('/')))
      expect(entry.mode).toBe(0o600)
      expect(entry.text).toBe(SAMPLE)
    }
    expect(await findTempFiles(home)).toEqual([])
  })
})

describe('原子写失败路径：清理临时件与半成品', () => {
  it('rename 失败 ⇒ library/internal；临时件被删、修订目录与空资产目录都不残留，同一 revisionId 可重试成功', async () => {
    const home = await makeHome()
    const store = new LibraryObjectStore({ dshHome: home })
    faults.failNextRename = true

    const code = await rejectionCode(store.writeRevision({
      assetId: 'as_1',
      revisionId: 'rv_1',
      extension: 'md',
      original: Buffer.from(SAMPLE, 'utf8'),
      content: SAMPLE,
    }))
    expect(code).toBe('library/internal')
    // 注入点确实生效（否则这个测试就是空转）
    expect(faults.renames).toHaveLength(1)
    const temporary = faults.renames[0]!.from

    const { lstat } = await import('node:fs/promises')
    await expect(lstat(temporary)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(lstat(join(home, 'library', 'objects', 'as_1', 'rv_1'))).rejects.toMatchObject({ code: 'ENOENT' })
    // 资产目录是空目录 ⇒ 一并收走（只删空目录）
    await expect(lstat(join(home, 'library', 'objects', 'as_1'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await findTempFiles(home)).toEqual([])

    // 重试：同一条修订换一条路走成功 —— 失败没有把落点烧掉，也没有留下"已存在"的假象。
    const written = await store.writeRevision({
      assetId: 'as_1',
      revisionId: 'rv_1',
      extension: 'md',
      original: Buffer.from(SAMPLE, 'utf8'),
      content: SAMPLE,
    })
    expect(written.originalRelativePath).toBe('as_1/rv_1/original.md')
    expect(await store.readRevisionText('as_1', 'rv_1')).toEqual({ text: SAMPLE, byteLength: Buffer.byteLength(SAMPLE, 'utf8') })
  })
})
