/**
 * [INPUT]: 依赖 node:test、node:assert 与 bootstrap-harness-desktop.mjs 的纯校验函数
 * [OUTPUT]: 覆盖官方 Harness Desktop 锁格式，以及拒绝缺字段的失败分支
 * [POS]: 员工桌面客户端锁的回归测试，不访问网络，不改动 checkout
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateHarnessDesktopLock } from './bootstrap-harness-desktop.mjs'

const LOCK_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'upstream', 'deepseek-harness-desktop.lock.json')

test('official desktop lock pins Harness apps/desktop 0.1.7-rc.1', () => {
  const lock = validateHarnessDesktopLock(JSON.parse(readFileSync(LOCK_PATH, 'utf8')))
  assert.equal(lock.version, '0.1.7-rc.1')
  assert.equal(lock.commit, '46a7f68b0922371ce7144b668b90e377d8e799f4')
  assert.equal(lock.desktop.package, '@deepseek-ai/dsh-desktop')
})

test('desktop lock rejects a missing package pin', () => {
  assert.throws(
    () =>
      validateHarnessDesktopLock({
        role: 'employee-desktop-client',
        repository: 'https://example.com/deepseek-harness.git',
        version: '0.1.7-rc.1',
        commit: '46a7f68b0922371ce7144b668b90e377d8e799f4',
        license: 'MIT',
        desktop: { path: 'apps/desktop' },
      }),
    /desktop package/,
  )
})
