/**
 * [INPUT]: 依赖 bundle manifest/Config/patch、构建产物和 Node vm 中的官方 React lazy-CJS seed 模型
 * [OUTPUT]: 验证默认关闭的验签配置、dsh.bundle/dsh.client、credentials/pi-ai/分发注入、兼容 peers 与 Client apply
 * [POS]: bundle 发布不变量测试，拒绝 Typert ambient shim、Harness 源码路径和未打包运行依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import { describe, expect, it, vi } from 'vitest'
import { Config, inject } from '../src/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('enterprise bundle', () => {
  it('declares the official bundle and Client module manifests without runtime dependencies', async () => {
    const manifest = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8')) as Record<string, any>
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client).toMatchObject({ platform: 'web' })
    expect(manifest.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-settings-general',
    ])
    expect(manifest.dependencies).toBeUndefined()
    expect(manifest.peerDependencies['@deepseek-ai/dsh-llm']).toBe('>=0.1.5-rc.2 <0.3.0')
    expect(manifest.peerDependencies['@deepseek-ai/dsh-credentials']).toBe('>=0.1.5-rc.2 <0.3.0')
    expect(manifest.peerDependencies['@deepseek-ai/dsh-llm-pi-ai']).toBe('>=0.1.5-rc.2 <0.3.0')
    expect(manifest.peerDependencies['@deepseek-ai/dsh-session']).toBeUndefined()
    expect(manifest.peerDependencies['@deepseek-ai/dsh-subprocess']).toBe('>=0.1.5-rc.2 <0.3.0')
    expect(manifest.peerDependencies['@deepseek-ai/dsh-host-plugin-inventory']).toBe('>=0.1.5-rc.2 <0.3.0')
    expect(manifest.peerDependencies['@deepseek-ai/schemastery']).toBe('^3.18.1')
    expect(inject).toEqual([
      'webServer', 'credentials', 'settings', 'llm', 'subprocess', 'pluginInventory',
    ])
    expect(Config({
      baseUrl: 'https://enterprise.example.com',
      verifyPluginSignatures: true,
      trustedPluginPublicKey: 'ed25519-spki',
    })).toMatchObject({
      profile: 'web',
      verifyPluginSignatures: true,
      dshCommand: 'dsh',
      requestTimeoutMs: 30_000,
      disposeTimeoutMs: 3_000,
    })
    expect(Config({})).toMatchObject({ baseUrl: '', verifyPluginSignatures: false, trustedPluginPublicKey: '' })
    const patch = await readFile(resolve(ROOT, 'cordis.patch.yml'), 'utf8')
    expect(patch).toContain("name: 'dshent-plugin'")
    // 产品裁决（2026-09-30）：官方模型行不改——patch 不得覆盖官方模型行的 config。
    expect(patch).not.toMatch(/- id: llm-deepseek\n/)
    expect(patch).not.toContain('deepseek-harness')
    const source = await readFile(resolve(ROOT, 'src/index.ts'), 'utf8')
    expect(source).toContain('const HARNESS_VERSION = APP_IDENTITY.version')
    expect(source).toContain("createRequire(import.meta.url)('../package.json')")
    expect(source).not.toContain("const HARNESS_VERSION = '0.1.1-rc.2'")
  })

  it('maps an engine release to its verified commit and never fabricates an unmapped one', async () => {
    const source = await readFile(resolve(ROOT, 'src/index.ts'), 'utf8')
    // 事实源：官方发行 tag `dsh-v0.2.0-rc.2` -> 639ed015…（该 commit 的 apps/cli/package.json 声明
    // version 0.2.0-rc.2；同一 tag->commit 方法可逐字复现表内既有五条）。
    expect(source).toContain("'0.2.0-rc.2': '639ed015397290b3745d163aafe02ffee4aa3f84'")
    // 诚实口径：表里没有的版本必须**省略** harnessCommit（交给 verification 降级为警告），
    // 而不是把它硬编码成某个旧 commit 去假装命中白名单。
    expect(source).toContain('VERIFIED_HARNESS_COMMITS[HARNESS_VERSION] === undefined ? {} : {')
    expect(source).not.toMatch(/'0\.2\.0-rc\.2': '(?!639ed015)[0-9a-f]{40}'/)
    expect(source).not.toContain('harnessCommit: HARNESS_COMMIT')
  })

  it('materializes the built lazy-CJS Client factory and registers the official settings slots', async () => {
    const source = await readFile(resolve(ROOT, 'lib/client.js'), 'utf8')
    expect(source).toContain("id: 'dshent-plugin'")
    expect(source).not.toContain('@deepseek-ai/dsh-typert-protocol')
    let factory: ((require: (id: string) => unknown) => Record<string, unknown>) | undefined
    runInNewContext(source, {
      AbortController,
      DOMException,
      fetch,
      window: {
        __ModuleLoader__: {
          load(record: { factory: typeof factory }) { factory = record.factory },
        },
      },
    })
    const client = factory?.((id) => {
      if (id === 'react') return React
      if (id === 'react/jsx-runtime') return ReactJsxRuntime
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Modal: vi.fn(), Button: vi.fn() }
      throw new Error(`unexpected Client external: ${id}`)
    }) as { apply?: (ctx: unknown) => void } | undefined
    expect(client?.apply).toBeTypeOf('function')
    const register = vi.fn(() => () => undefined)
    // 外观选项组要读官方 ui-theme（`ctx.get('theme')` 按需 + `ctx.inject(['theme'])` 等服务出现后补发通知），
    // 所以假 ctx 必须提供 inject/get/on/remote，否则组合根在 createEnterpriseThemeSource 处就崩。
    const injected: string[][] = []
    const ctx = {
      effect: () => undefined,
      get: () => undefined,
      inject: (deps: readonly string[], callback: () => void) => { injected.push([...deps]); callback(); return () => undefined },
      on: () => () => undefined,
      remote: { $on: () => () => undefined },
      slots: { inject: (_name: string, callback: () => unknown) => callback(), register },
    }
    client?.apply?.(ctx)
    // 外观组读 ui-theme，快捷键面板读 ui-shortcuts；客户端注册**四个** settings/plugins 座位
    // （企业设置页 / 个人中心登录入口 / 官方插件页市场卡片 / 插件详情徽标）。
    // 独立应用商店的两处座位（`main` 面板 + `sidebar.panellist` 入口）已按用户要求撤销，故不再是六处。
    expect(injected).toEqual([['theme'], ['shortcuts']])
    expect(register).toHaveBeenCalledTimes(4)
  })

  it('contains no ambient Remote shim or sibling source import', async () => {
    const files = [
      resolve(ROOT, 'src/index.ts'),
      resolve(ROOT, 'lib/index.js'),
      resolve(ROOT, 'lib/client.js'),
    ]
    const combined = (await Promise.all(files.map(path => readFile(path, 'utf8')))).join('\n')
    const source = await readFile(resolve(ROOT, 'src/index.ts'), 'utf8')
    const manifest = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8')) as Record<string, any>
    expect(combined).not.toMatch(/declare module ['"]@deepseek-ai\/dsh-typert-protocol/)
    expect(combined).not.toContain('/deepseek-harness/')
    expect(combined).not.toContain('../deepseek-harness')
    expect(combined).toContain("from '@deepseek-ai/dsh-llm'")
    expect(combined).toMatch(/from ["']@deepseek-ai\/dsh-credentials["']/)
    // 官方 llm-pi-ai 经 peer 声明接入（经 @dshent/llm-gateway 封装，index.ts 不再直接 from pi-ai）。
    expect(manifest.peerDependencies['@deepseek-ai/dsh-llm-pi-ai']).toBe('>=0.1.5-rc.2 <0.3.0')
    expect(combined).not.toContain("from '@deepseek-ai/dsh-session'")
    expect(combined).toContain("from '@deepseek-ai/schemastery'")
    expect(combined).toContain('enterprisePluginDistribution')
    // P2d 双向门禁：允许条件注册代码存在，但不得硬依赖官方 dsh-session 包。
    expect(combined).toContain('tryRegisterHostSessionSync')
    expect(combined).toContain('enterpriseSessionSync.dispose()')
    expect(source).toContain("from '@dshent/session-sync'")
    expect(manifest.peerDependencies['@deepseek-ai/dsh-session']).toBeUndefined()
    expect(combined).toContain('ENT_PLUGIN_CORE_PROTECTED')
    expect(combined).toContain('require("@deepseek-ai/dsh-client-ui-primitives")')
    expect(combined).not.toContain('globalThis.confirm(')
  })
})
