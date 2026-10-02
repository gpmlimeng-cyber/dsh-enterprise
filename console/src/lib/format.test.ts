/**
 * [INPUT]: 依赖 lib/format 的唯一字节格式化。
 * [OUTPUT]: 用一组边界值锁定后台口径（B/KiB/MiB 三档、一名小数），防止 4 份副本式漂移回归。
 * [POS]: lib 的展示格式化门禁；跨端口径统一另开一刀，本用例只锁后台内部。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes（后台唯一口径）', () => {
  it('锁住 0 / 1023 / 1024 / 1500 / 1048575 / 1048576 六个边界', () => {
    expect([0, 1023, 1024, 1500, 1048575, 1048576].map((value) => formatBytes(value))).toEqual([
      '0 B',
      '1023 B',
      '1.0 KiB',
      '1.5 KiB',
      '1024.0 KiB',
      '1.0 MiB'
    ]);
  });
});
