/**
 * [INPUT]: 依赖 esbuild、TypeScript CLI、client-plugin Host 源、Harness 官方 peers 与客户端半 UI 源
 * [OUTPUT]: 生成保留官方运行时单例的 Host ESM、lazy-CJS Client、声明与 sourcemap
 * [POS]: client-plugin 的发布构建器；与 bundle 的构建器同构，只是没有产品 workspace 依赖需要内联
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { execFileSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

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
