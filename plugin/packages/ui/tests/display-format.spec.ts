/**
 * [INPUT]: 只依赖 display-format 的两枚纯格式化叶子（不依赖 React、不依赖宿主 API）
 * [OUTPUT]: 验证 `formatByteSize` 的三段式边界，与 `formatCount` 的**确定性**千分位
 *   （同一份代码在任何机器上必须给同一个分隔符，故刻意不走 `toLocaleString`）
 * [POS]: dsh-ui 展示格式化叶子的机械门禁——在线搜索结果里那两枚第三方大数（星标 / 安装量）就取这里
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import { formatByteSize, formatCount } from '../src/display-format.js'

describe('display format: byte size', () => {
  it('keeps the three-step human readable sizes', () => {
    expect(formatByteSize(0)).toBe('0 B')
    expect(formatByteSize(1023)).toBe('1023 B')
    expect(formatByteSize(1024)).toBe('1.0 KiB')
    expect(formatByteSize(1024 * 1024 - 1)).toBe('1024.0 KiB')
    expect(formatByteSize(1024 * 1024)).toBe('1.0 MiB')
  })
})

describe('display format: count', () => {
  it('groups thousands deterministically and never abbreviates them', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(7)).toBe('7')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1000)).toBe('1,000')
    // 真机上出现过的那两枚：963199 / 886888。
    expect(formatCount(963199)).toBe('963,199')
    expect(formatCount(886888)).toBe('886,888')
    expect(formatCount(1234567)).toBe('1,234,567')
    // 分隔符是**逗号**（不是某些区域默认的小圆点/空格）——「同一份代码不同机器给不同结果」不算通过。
    expect(formatCount(1000)).toBe('1,000')
    expect(formatCount(1000)).not.toContain('.')
    expect(formatCount(1000)).not.toContain(' ')
    // 不缩写：`963.2k` 会把用户判断「这个来源靠不靠谱」要用的精度丢掉。
    expect(formatCount(963199)).not.toContain('k')
  })
})
