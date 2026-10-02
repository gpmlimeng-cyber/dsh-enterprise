/**
 * [INPUT]: 依赖 node:fs 遍历 console/src 全部 .ts/.tsx 文本。
 * [OUTPUT]: 产品宪法术语降维表的机械反向锁——RETIRED 的中文旧译（见 product-charter 术语表左侧列）不得再出现在源码里。
 * [POS]: lib 的文案门禁；对应 docs/notes/product-charter.md 术语降维表与 docs/notes/direction-decisions.md 第 9/10 条。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * console/src 根：本文件位于 src/lib 故向上一级。
 * jsdom 环境下 `import.meta.url` 不是 `file:` URL（`fileURLToPath` 会抛），因此校验失败时回落到 vitest 的工作目录。
 */
const SOURCE_ROOT = (() => {
  try {
    const resolved = fileURLToPath(new URL('../', import.meta.url));
    if (existsSync(join(resolved, 'lib', 'errors.ts'))) return resolved;
  } catch {
    // 落到下面的 cwd 分支
  }
  return join(process.cwd(), 'src');
})();

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe('产品宪法术语降维表', () => {
  it('后台源码不再出现 RETIRED 的中文旧译', () => {
    // 断言自身也要经得起扫描：被禁词由字符拼装，不写成本文件里的字面量。
    const bannedWord = ['退', '休'].join('');
    const files = collectSourceFiles(SOURCE_ROOT);
    // 先证明扫描真的扫到了源码，避免路径解析错时“0 命中”假绿。
    expect(files.length).toBeGreaterThan(100);
    const offenders = files
      .filter((path) => readFileSync(path, 'utf8').includes(bannedWord))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(offenders).toEqual([]);
  });
});
