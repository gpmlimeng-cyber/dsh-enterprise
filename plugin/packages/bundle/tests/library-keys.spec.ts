/**
 * [INPUT]: 依赖 `src/library/storage/keys.ts` 的主键纯函数层与 node:crypto（独立重算折叠结果，避免"用被测代码证明被测代码"）
 * [OUTPUT]: 逐条锁住勘误 B1 的主键门禁：`: / . 空白` 归一为 `-`、空串/空段拒、组合形状 `_`、240/300 的确定性折叠与长度上限，以及"任何输出都能过官方 SAFE_KEY_RE"
 * [POS]: tests 下资料库纵深的**第一道门禁回归**；本文件红 = 有人放宽了字符集、改了分隔符、或让超长键裸截断（三者都会让官方后端拒写或让两个主体静默串在同一条记录上）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import {
  foldLibraryKey,
  isLibraryKeySafe,
  libraryRecordKey,
  normalizeLibraryKey,
  sanitizeLibraryKeyPart,
  LIBRARY_KEY_MAX_LENGTH,
  LIBRARY_KEY_SEPARATOR,
  LIBRARY_SAFE_KEY_PATTERN,
  LIBRARY_UNIT_NAME_PATTERN,
} from '../src/library/storage/keys.js'

/** 取出稳定错误码：断言"抛哪个码"而不是断言英文技术文案（文案会变，码不能变）。 */
function codeOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return (error as LibraryError).code
  }
  throw new Error('expected the call to throw')
}

/** 独立重算一次折叠（与被测实现无关的期望值）。 */
function expectedFold(key: string): string {
  const digest = createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16)
  return `${key.slice(0, 96)}-${digest}-${key.slice(-86)}`
}

describe('官方字符集常量（口径来源）', () => {
  it('照抄官方 SAFE_KEY_RE 与 UNIT_NAME_RE，并确认我们的域名/表名命中', () => {
    // 来源：dsh-storage-json/lib/index.js:302（SAFE_KEY_RE）与 dsh-storage/lib/index.js:80（UNIT_NAME_RE）
    expect(LIBRARY_SAFE_KEY_PATTERN.source).toBe('^[a-zA-Z0-9_-]+$')
    expect(LIBRARY_UNIT_NAME_PATTERN.source).toBe('^[a-z][a-z0-9_]*$')
    expect(LIBRARY_SAFE_KEY_PATTERN.test('a-b_c9')).toBe(true)
    expect(LIBRARY_SAFE_KEY_PATTERN.test('node_root')).toBe(true)
    for (const name of ['dshent_library', 'nodes', 'assets', 'revisions', 'selections']) {
      expect(LIBRARY_UNIT_NAME_PATTERN.test(name)).toBe(true)
    }
  })
})

describe('单段归一化：非法字符一字一替换为 -', () => {
  it.each([
    [':', '-'],
    ['/', '-'],
    ['.', '-'],
    [' ', '-'],
    ['\t', '-'],
    ['a:b', 'a-b'],
    ['a/b', 'a-b'],
    ['a.b', 'a-b'],
    ['a b', 'a-b'],
    ['项目甲／中文名·括号(1)', '-----------1-'],
    ['a::b', 'a--b'],
  ])('%j → %j', (input, output) => {
    expect(sanitizeLibraryKeyPart(input)).toBe(output)
  })

  it('保留字符集内的字符（含下划线与中划线）', () => {
    expect(sanitizeLibraryKeyPart('a-b_c9')).toBe('a-b_c9')
  })

  it('空串归一化后仍是空串（由组合层拒，不在这一层造 -）', () => {
    expect(sanitizeLibraryKeyPart('')).toBe('')
  })
})

describe('组合：_ 连接的三元组', () => {
  it('形状 = <scope>_<ownerId>_<id>（勘误 B1：冒号写法写入即抛，故不用冒号）', () => {
    const key = libraryRecordKey({ scope: 'personal', ownerId: 'u1001', id: 'nd_abc' })
    expect(key).toBe('personal_u1001_nd_abc')
    // `_` 既是分隔符又是合法字符 ⇒ 键在纯字符串上**不可反解**（这里 `nd_abc` 自己带 `_`）。
    // 这不是缺陷而是设计：段边界的权威在记录自身的 scope/ownerId/id 上，服务层用它们做归属校验。
    expect(key.split(LIBRARY_KEY_SEPARATOR)).toEqual(['personal', 'u1001', 'nd', 'abc'])
  })

  it('每段都过一遍归一化，非法字符不会漏到键上', () => {
    expect(normalizeLibraryKey(['a:b', 'c/d', 'e.f'])).toBe('a-b_c-d_e-f')
    expect(normalizeLibraryKey(['会话 1', 'u 2', 'id 3'])).toBe('---1_u-2_id-3')
  })

  it('空串段 ⇒ library/invalid-key（身份缺失不许静默补 -）', () => {
    for (const parts of [[''], ['a', '', 'b'], ['a', 'b', '']]) {
      expect(() => normalizeLibraryKey(parts)).toThrowError(LibraryError)
      expect(codeOf(() => normalizeLibraryKey(parts))).toBe('library/invalid-key')
    }
  })

  it('段数为 0 / 不是数组 / 段不是字符串 ⇒ 拒', () => {
    expect(codeOf(() => normalizeLibraryKey([]))).toBe('library/invalid-key')
    expect(codeOf(() => normalizeLibraryKey(undefined as unknown as string[]))).toBe('library/invalid-key')
    expect(codeOf(() => normalizeLibraryKey(['a', 1 as unknown as string]))).toBe('library/invalid-request')
  })

  it('全非法字的段仍然是合法键（只有"-"），不因归一化变空', () => {
    const key = normalizeLibraryKey(['::', '...'])
    expect(key).toBe('--_---')
    expect(isLibraryKeySafe(key)).toBe(true)
  })
})

describe('长度门禁：240/300 的确定性折叠', () => {
  it('240 字（实测能写、但不留余量）⇒ 折叠到 200', () => {
    const raw = 'x'.repeat(240)
    const key = normalizeLibraryKey([raw])
    expect(key.length).toBe(LIBRARY_KEY_MAX_LENGTH)
    expect(key).toBe(expectedFold(raw))
    expect(isLibraryKeySafe(key)).toBe(true)
  })

  it('300 字（实测抛 ENAMETOOLONG）⇒ 同样折叠到 200', () => {
    const raw = 'y'.repeat(300)
    const key = normalizeLibraryKey([raw])
    expect(key.length).toBe(LIBRARY_KEY_MAX_LENGTH)
    expect(key).toBe(expectedFold(raw))
    expect(isLibraryKeySafe(key)).toBe(true)
  })

  it('折叠是确定性的（同输入同输出），且同前缀同后缀的两个长键仍被区分开', () => {
    const a = 'a'.repeat(240) + 'A'
    const b = 'a'.repeat(240) + 'B'
    expect(normalizeLibraryKey([a])).toBe(normalizeLibraryKey([a]))
    expect(normalizeLibraryKey([a])).not.toBe(normalizeLibraryKey([b]))
  })

  it('短键不折叠（逐字原样返回）', () => {
    const short = 'a'.repeat(200)
    expect(normalizeLibraryKey([short])).toBe(short)
    expect(foldLibraryKey('abc')).toBe(expectedFold('abc'))
  })

  it('折叠件三段尺寸与分隔符固定（96 + 1 + 16 + 1 + 86 = 200）', () => {
    const folded = normalizeLibraryKey(['z'.repeat(500)])
    const [head, digest, tail] = folded.split('-')
    expect(head!.length).toBe(96)
    expect(digest!.length).toBe(16)
    expect(tail!.length).toBe(86)
    expect(digest).toMatch(/^[0-9a-f]{16}$/)
    expect(folded.length).toBe(LIBRARY_KEY_MAX_LENGTH)
  })
})

describe('键门禁 isLibraryKeySafe', () => {
  it.each([':', '/', '.', ' ', '', 'a:b', 'a/b', 'a.b', 'a b', 'x'.repeat(240), 'x'.repeat(300)])(
    '裸输入 %j 不是合法键',
    (raw) => {
      expect(isLibraryKeySafe(raw)).toBe(false)
    },
  )

  it.each(['a', 'a-b_c9', 'personal_u1001_nd_abc', '-', '--', 'x'.repeat(200)])(
    '归一化产出的 %j 是合法键',
    (key) => {
      expect(isLibraryKeySafe(key)).toBe(true)
    },
  )

  it('非字符串一律不合法', () => {
    expect(isLibraryKeySafe(undefined)).toBe(false)
    expect(isLibraryKeySafe(42)).toBe(false)
  })

  it('任何归一化输出都天然过官方 SAFE_KEY_RE（这是"不接宿主也能保证不被官方拒"的那条等式）', () => {
    const inputs: string[][] = [
      ['personal', 'u1001', 'nd_abc'],
      ['会话 1', 'user@example.com', 'rv:1/2'],
      ['', 'x', 'y'],
      ['a'.repeat(300), 'b'.repeat(300), 'c'.repeat(300)],
      [':::', '...', '   '],
    ]
    for (const parts of inputs) {
      let key: string
      try {
        key = normalizeLibraryKey(parts)
      } catch {
        // 空段是**有意**拒的（在上面的用例里已锁），这里只关心能产出键的那些。
        continue
      }
      expect(LIBRARY_SAFE_KEY_PATTERN.test(key)).toBe(true)
      expect(key.length).toBeLessThanOrEqual(LIBRARY_KEY_MAX_LENGTH)
    }
  })
})
