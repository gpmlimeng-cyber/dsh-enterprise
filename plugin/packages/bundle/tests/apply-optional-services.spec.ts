/**
 * [INPUT]: 依赖 bundle 导出的 apply/Config、Cordis 未注入属性抛错语义与注入清单。
 * [OUTPUT]: 验证 apply 在仅注入五个必需服务时不会读取任何未注入属性（含 sessions），并禁止源码直读可选服务。
 * [POS]: bundle 的启动期回归门禁；用户端真实启动栈曾在此处抛 "cannot get property without inject"。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Config, inject, apply } from '../src/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** inject 清单里声明的必需服务。 */
const REQUIRED = inject as readonly string[]

/**
 * 复刻 Cordis `ReflectService.handler.get` 的语义：
 * 非特殊属性若不在目标对象上，直接抛出与宿主一致的错误文案。
 * 这是用户端 "failed to apply loader entry owndsh" 崩溃的根因模型。
 */
const CORE = new Set([
  'get', 'set', 'inject', 'provide', 'effect', 'on', 'off', 'once', 'logger',
  'events', 'service', 'reflect', 'fiber', 'config', 'name', 'hooks', 'scope',
  'export', 'declare', 'get(name', 'update', 'teardown', 'lifecycle',
])

function createHostContext(): Record<string, unknown> {
  const stubs: Record<string, unknown> = {}
  for (const name of REQUIRED) {
    if (name === 'webServer') {
      stubs[name] = { register: () => () => undefined, host: '127.0.0.1', port: 0 }
    } else if (name === 'credentials') {
      stubs[name] = {
        get: () => undefined,
        set: () => Promise.resolve(),
        resolve: () => Promise.resolve(),
        addListener: () => () => undefined,
      }
    } else if (name === 'llm') {
      stubs[name] = { provide: () => undefined, registry: { get: () => undefined } }
    } else if (name === 'subprocess') {
      stubs[name] = { spawn: () => { throw new Error('not used in this test') } }
    } else if (name === 'pluginInventory') {
      stubs[name] = { list: () => Promise.resolve([]), update: () => Promise.resolve(undefined) }
    } else {
      stubs[name] = {}
    }
  }

  const target: Record<string, unknown> = {
    ...stubs,
    name: 'owndsh',
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    get: (key: string) => {
      if (key in stubs) return stubs[key]
      return undefined
    },
    inject: (_names: string[], callback: (isolated: unknown) => unknown) => {
      const isolated: Record<string, unknown> = {
        settings: {
          register: () => ({ dispose: () => undefined }),
        },
      }
      return callback(isolated)
    },
    effect: (fn: () => () => void, _label?: string) => {
      // 只登记，不在本测试里执行清理链。
      void fn
      return fn
    },
    on: () => () => undefined,
    once: () => () => undefined,
    off: () => undefined,
    set: () => undefined,
    provide: () => undefined,
    service: (fn: unknown) => fn,
  }

  return new Proxy(target, {
    get(recv, prop) {
      if (typeof prop === 'symbol' || CORE.has(String(prop)) || String(prop).startsWith('_')) {
        return Reflect.get(recv, prop)
      }
      if (prop in recv) return Reflect.get(recv, prop)
      const error = new Error(`cannot get property "${String(prop)}" without inject`)
      throw error
    },
  }) as Record<string, unknown>
}

describe('bundle apply boot contract', () => {
  it('declares exactly the five required host services', () => {
    expect([...REQUIRED].sort()).toEqual([
      'credentials', 'llm', 'pluginInventory', 'subprocess', 'webServer',
    ])
  })

  it('applies without reading any non-injected property', () => {
    const ctx = createHostContext()
    // 未提供 sessions / sessionPersistence；直读它们必须与宿主一样抛错。
    expect(() => ctx['sessions']).toThrow('cannot get property "sessions" without inject')
    expect(() => ctx['sessionPersistence']).toThrow('cannot get property "sessionPersistence" without inject')

    // 回归：apply 只能通过 ctx.get 访问可选服务。
    // 桩上下文不足以让 Cordis Service 构造函数跑完，因此只断言绝不能出现
    // 与用户端崩溃同款的 "without inject" —— 修复前这一行会先于更深处的
    // TypeError 抛出，足以把该回归卡住。
    expect(() => apply(ctx as never, Config({}))).not.toThrowError(/without inject/)
  })

  it('source never reads optional services as raw properties', () => {
    const source = readFileSync(resolve(ROOT, 'src/index.ts'), 'utf8')
    expect(source).not.toMatch(/\bctx\.sessions\b/)
    expect(source).not.toMatch(/\bctx\.sessionPersistence\b/)
    expect(source).not.toMatch(/\bctx\.desktopProfiles\b/)
    expect(source).not.toMatch(/\bctx\.desktopPnpm\b/)
    expect(source).not.toMatch(/\bctx\.desktopActions\b/)
  })
})
