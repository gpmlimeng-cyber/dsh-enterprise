/**
 * [INPUT]: 依赖 esbuild、TypeScript CLI、bundle Host、Harness peers、共享 UI primitives 与 UI Client
 * [OUTPUT]: 生成内联产品包且保留全部官方运行时单例的 Host ESM、lazy-CJS Client、声明与 sourcemap
 * [POS]: bundle 的发布构建器，消化产品 workspace 依赖并保持 Harness 核心类由目标 profile 提供
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { execFileSync } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * esbuild 原生二进制路径纠正（仅 Android 本机生效，非 Android 环境自动跳过）：
 * 与 client-plugin/scripts/build.mjs 同源逻辑——仓库在 `/data/data/...` 旧式前缀下时
 * `untrusted_app_34` 域对该前缀的 `execve` 一律 EACCES，把同一路径改写成
 * `/data/user/0/...` symlink 前缀后写回 `process.env.ESBUILD_BINARY_PATH`。
 * 必须在 `await import('esbuild')` 之前完成：esbuild 在模块加载期就把该 env 读进
 * 模块级常量，且静态 `import` 会被 hoist 到任何顶层语句之前执行（故这里用动态 import）。
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
const CLIENT_MODULE_ID = 'dshent-plugin'

await rm(LIB_ROOT, { force: true, recursive: true })
await mkdir(LIB_ROOT, { recursive: true })

execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: PACKAGE_ROOT,
  stdio: 'inherit',
})

await build({
  absWorkingDir: PACKAGE_ROOT,
  bundle: true,
  entryPoints: ['src/index.ts'],
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-credentials',
    '@deepseek-ai/dsh-deepseek-account-platform',
    '@deepseek-ai/dsh-llm',
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

await build({
  absWorkingDir: PACKAGE_ROOT,
  banner: {
    js: `window.__ModuleLoader__.load({ id: '${CLIENT_MODULE_ID}', factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  bundle: true,
  entryPoints: ['../ui/src/client.tsx'],
  external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
  footer: { js: 'return module.exports } })' },
  format: 'cjs',
  outfile: 'lib/client.js',
  platform: 'browser',
  sourcemap: true,
  target: ['chrome120', 'safari17'],
})
