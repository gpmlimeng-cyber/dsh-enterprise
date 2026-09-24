/**
 * [INPUT]: 依赖 upstream/deepseek-harness-desktop.lock.json、Node.js 与 Git CLI
 * [OUTPUT]: 在产品仓库同级目录准备官方 DeepSeek Harness Desktop checkout，或只校验已有 checkout
 * [POS]: 员工桌面客户端基线入口；不复制源码，不改社区 Desktop 2.0.3 锁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOCK_PATH = resolve(PROJECT_ROOT, 'upstream', 'deepseek-harness-desktop.lock.json')

function fail(message) {
  throw new Error(message)
}

export function validateHarnessDesktopLock(lock, label = 'Harness Desktop lock') {
  if (lock?.role !== 'employee-desktop-client') {
    fail(`${label} role must be employee-desktop-client`)
  }
  if (typeof lock?.repository !== 'string' || !lock.repository) fail(`${label} is missing repository`)
  if (typeof lock?.version !== 'string' || !lock.version) fail(`${label} is missing version`)
  if (lock.license !== 'MIT') fail(`${label} must preserve the MIT license`)
  if (!COMMIT_PATTERN.test(lock?.commit ?? '')) {
    fail(`${label} commit must be a 40-character lowercase Git commit`)
  }
  if (lock.desktop?.path !== 'apps/desktop') fail(`${label} desktop path must be apps/desktop`)
  if (lock.desktop?.package !== '@deepseek-ai/dsh-desktop') {
    fail(`${label} desktop package must be @deepseek-ai/dsh-desktop`)
  }
  return lock
}

function normalized(url) {
  return url.trim().replace(/\/$/, '').replace(/\.git$/, '')
}

function git(gitArgs, cwd, capture = false) {
  return execFileSync('git', gitArgs, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function inspectHarnessDesktopCheckout(checkout, lock) {
  if (!existsSync(resolve(checkout, '.git'))) fail(`destination is not a Git checkout: ${checkout}`)
  const origin = git(['remote', 'get-url', 'origin'], checkout, true).trim()
  if (normalized(origin) !== normalized(lock.repository)) {
    fail(`Harness Desktop origin mismatch: expected ${lock.repository}, got ${origin}`)
  }
  const head = git(['rev-parse', 'HEAD'], checkout, true).trim()
  if (head !== lock.commit) fail(`Harness Desktop checkout is not at ${lock.commit}: ${checkout}`)
  const root = readManifest(resolve(checkout, 'package.json'))
  if (root.version !== lock.version) fail(`Harness version is ${root.version}, expected ${lock.version}`)
  const desktopManifestPath = resolve(checkout, lock.desktop.path, 'package.json')
  const desktop = readManifest(desktopManifestPath)
  if (desktop.name !== lock.desktop.package) {
    fail(`desktop package is ${desktop.name}, expected ${lock.desktop.package}`)
  }
  if (desktop.version !== lock.version) fail(`desktop version is ${desktop.version}, expected ${lock.version}`)
  const dirty = git(['status', '--porcelain'], checkout, true).trim()
  return { checkout, head, version: desktop.version, dirty: Boolean(dirty) }
}

function prepare(checkout, lock) {
  if (!existsSync(checkout)) git(['clone', lock.repository, checkout])
  const status = existsSync(resolve(checkout, '.git'))
    ? git(['status', '--porcelain'], checkout, true).trim()
    : ''
  if (status) fail(`Harness Desktop checkout has local changes: ${checkout}`)
  git(['fetch', 'origin', '--tags', '--prune'], checkout)
  git(['cat-file', '-e', `${lock.commit}^{commit}`], checkout)
  git(['switch', '--detach', lock.commit], checkout)
}

function main() {
  const lock = validateHarnessDesktopLock(JSON.parse(readFileSync(LOCK_PATH, 'utf8')))
  const args = process.argv.slice(2)
  const checkOnly = args[0] === '--check-only'
  if (checkOnly) args.shift()
  if (args.length > 1) fail('usage: node scripts/bootstrap-harness-desktop.mjs [--check-only] [destination]')
  const checkout = resolve(args[0] ?? resolve(PROJECT_ROOT, '..', 'deepseek-harness-desktop'))
  if (!checkOnly) prepare(checkout, lock)
  else if (!existsSync(checkout)) fail(`Harness Desktop checkout does not exist: ${checkout}`)
  const inspected = inspectHarnessDesktopCheckout(checkout, lock)
  if (inspected.dirty) {
    process.stderr.write(`Harness Desktop checkout has local changes: ${checkout}\n`)
  }
  process.stdout.write(`${JSON.stringify(inspected, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
