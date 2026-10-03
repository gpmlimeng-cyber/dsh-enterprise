/**
 * [INPUT]: 依赖 esbuild、TypeScript CLI、client-plugin Host 源、Harness 官方 peers 与客户端半 UI 源
 * [OUTPUT]: 生成保留官方运行时单例的 Host ESM、lazy-CJS Client、声明与 sourcemap
 * [POS]: client-plugin 的发布构建器；与 bundle 的构建器同构，只是没有产品 workspace 依赖需要内联
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { execFileSync } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * esbuild 原生二进制路径纠正（仅 Android 本机生效，非 Android 环境自动跳过）：
 * 仓库克隆在 `/data/data/...`（`/data/user/0` 的 symlink 目标，即“真”路径）下时，
 * `untrusted_app_34` 域对该前缀字符串的 `execve` 一律 EACCES——同一 inode 换成
 * `/data/user/0/...` symlink 前缀即可执行（`realpath` 会把现代前缀还原成旧前缀，
 * 不能用；read/stat 不受限，execve 是另一套按路径字符串判定的策略）。
 * esbuild JS API 默认 `require.resolve` 拿到的正是旧前缀 ⇒ `The service was stopped:
 * spawn ... EACCES`。这里按 Android 官方 $PREFIX 约定把旧前缀改写成现代前缀写回
 * `process.env.ESBUILD_BINARY_PATH`；必须在 `await import('esbuild')` 之前完成——
 * esbuild 在模块加载期就把该 env 读进模块级常量，且静态 `import` 会被 hoist 到任何
 * 顶层语句之前执行（故这里必须用动态 import）。非 Android 平台不改写，交由 esbuild
 * 自己解析（那套平台没有路径字符串策略问题）。
 */
async function prepareEsbuildBinaryPath() {
  if (process.platform !== 'android') return
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const legacyBin = resolve(scriptDir, '../../../node_modules/.pnpm/@esbuild+android-arm64@0.28.1/node_modules/@esbuild/android-arm64/bin/esbuild')
  const modernBin = legacyBin.replace(/^\/data\/data\//, '/data/user/0/')
  try {
    if ((await stat(modernBin)).isFile()) process.env.ESBUILD_BINARY_PATH = modernBin
  } catch {
    // stat 失败（文件缺失/不可读）⇒ 不改 env，保留 esbuild 默认解析路径，让真实构建错误照常上抛
  }
}

await prepareEsbuildBinaryPath()
const { build } = await import('esbuild')

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB_ROOT = resolve(PACKAGE_ROOT, 'lib')
const CLIENT_MODULE_ID = 'dshent-client-plugin'

await rm(LIB_ROOT, { force: true, recursive: true })
await mkdir(LIB_ROOT, { recursive: true })

// 声明与类型：tsc 只发声明，产物由 esbuild 生成
execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: PACKAGE_ROOT,
  stdio: 'inherit',
})

// Host 半：官方运行时必须由目标 profile 提供，不得内联
await build({
  absWorkingDir: PACKAGE_ROOT,
  bundle: true,
  entryPoints: ['src/index.ts'],
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-credentials',
    '@deepseek-ai/dsh-llm-pi-ai',
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/schemastery',
  ],
  format: 'esm',
  outfile: 'lib/index.js',
  platform: 'node',
  sourcemap: true,
  target: 'node22',
})

// Client 半：由宿主 __ModuleLoader__ 装载，React 与 UI primitives 由宿主提供
await build({
  absWorkingDir: PACKAGE_ROOT,
  banner: {
    js: `window.__ModuleLoader__.load({ id: '${CLIENT_MODULE_ID}', factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  bundle: true,
  entryPoints: ['src/client/index.tsx'],
  external: [
    'react',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  footer: { js: 'return module.exports } })' },
  format: 'cjs',
  outfile: 'lib/client.js',
  platform: 'browser',
  sourcemap: true,
  target: ['chrome120', 'safari17'],
})
