/**
 * [INPUT]: 依赖 `src/library/host.ts`（被测装配面）、`src/library/route.ts` 的端口形状、`src/library/storage/domain.ts` 的域规格、`tests/library-support.ts`（内存假域 + 临时 dshHome + route 形状）、`tests/engine-route-match.ts`
 * [OUTPUT]: 资料库**宿主装配**的门禁——域门面缺席时如实停在"还没接线"（`manager()` 恒 undefined + 一条 warn）、在场时按**同一份域规格对象**开域、主体晚绑定与换主体换门面、`dispose` 关域、以及 `mountEnterpriseLibraryFaces` 挂的表面数（路由 1 条 / 加工具 / 加注入）与一次性注销
 * [POS]: tests 下资料库装配层的**行为回归**；本文件红 = 有人把"没接线"做成了静默空列表、把主体写死成了常量、或让注销器只撤一半
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEnterpriseLibraryHost, mountEnterpriseLibraryFaces } from '../src/library/host.js'
import type { LibrarySubject } from '../src/library/manager.js'
import { LibraryManager } from '../src/library/manager.js'
import { ENTERPRISE_LIBRARY_LOCAL_PATH, ENTERPRISE_LIBRARY_OBJECTS_PREFIX } from '../src/library/route.js'
import { libraryDomainSpec } from '../src/library/storage/domain.js'
import type { EnterpriseLibraryToolDefinition, EnterpriseLibraryToolRuntime } from '../src/library/tools.js'
import type { RegisteredRoute } from './engine-route-match.js'
import { createInMemoryLibraryDomain, makeLibraryTempDir, type InMemoryLibraryDomain } from './library-support.js'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map(async path => await rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-host-')
  temps.push(path)
  return path
}

/** 与真实装配同形的 route port：重复注册抛错（引擎行为），注销时移除。 */
function routeTable(): { readonly routes: RegisteredRoute[], readonly webServer: { host: '127.0.0.1', port: number, register: (route: RegisteredRoute) => () => void } } {
  const routes: RegisteredRoute[] = []
  const keys = new Set<string>()
  return {
    routes,
    webServer: {
      host: '127.0.0.1',
      port: 0,
      register: route => {
        const key = `${route.kind}:${route.path}`
        if (keys.has(key)) throw new Error(`duplicate route ${key}`)
        keys.add(key)
        routes.push(route)
        return () => {
          keys.delete(key)
          routes.splice(routes.indexOf(route), 1)
        }
      },
    },
  }
}

function toolTable(): { readonly definitions: EnterpriseLibraryToolDefinition[], readonly runtime: EnterpriseLibraryToolRuntime } {
  const definitions: EnterpriseLibraryToolDefinition[] = []
  return {
    definitions,
    runtime: { register: definition => { definitions.push(definition); return () => { definitions.splice(definitions.indexOf(definition), 1) } } },
  }
}

function eventTable(): { readonly count: () => number, readonly port: { on: (name: 'system-prompt/assemble', listener: never) => () => void } } {
  const live = new Set<unknown>()
  return {
    count: () => live.size,
    port: {
      on: (_name, listener) => {
        live.add(listener)
        return () => { live.delete(listener) }
      },
    },
  }
}

describe('资料库宿主装配', () => {
  it('存储域服务缺席 ⇒ 如实停在"还没接线"（warn 一条，门面恒 undefined）', async () => {
    const home = await makeHome()
    const logged: string[] = []
    const host = createEnterpriseLibraryHost({
      dshHome: home,
      readSubject: () => ({ scope: 'personal', ownerId: 'u1001' }),
      log: (level, message) => { logged.push(`${level}:${message}`) },
    })
    await host.start()
    expect(host.port.manager()).toBeUndefined()
    expect(logged.some(line => line.includes('storage domain service is not mounted'))).toBe(true)
    await host.dispose()
  })

  it('开域用**同一份**域规格对象；主体晚绑定、换主体换门面、dispose 关域', async () => {
    const home = await makeHome()
    const domain: InMemoryLibraryDomain = await createInMemoryLibraryDomain()
    const opened: unknown[] = []
    const closed = vi.fn(async () => undefined)
    let subject: LibrarySubject | undefined = { scope: 'personal', ownerId: 'u1001' }
    const host = createEnterpriseLibraryHost({
      dshHome: home,
      facility: {
        open: spec => {
          opened.push(spec)
          return { name: domain.name, table: (name: string) => domain.table(name as never), close: closed }
        },
      },
      readSubject: () => subject,
      log: () => undefined,
    })

    expect(host.port.manager()).toBeUndefined()
    await host.start()
    expect(opened).toEqual([libraryDomainSpec])

    const first = host.port.manager()
    expect(first).toBeInstanceOf(LibraryManager)
    expect(host.port.manager()).toBe(first)
    const folder = await (first as LibraryManager).createFolder({ title: '项目甲' })
    expect((await (first as LibraryManager).listNodes()).map(node => node.title)).toEqual(['项目甲'])

    // 换主体：门面换一个实例，但**同一份域**上的数据按主体隔离（新主体看不到 u1001 的文件夹）。
    subject = { scope: 'personal', ownerId: 'u2002' }
    const second = host.port.manager()
    expect(second).not.toBe(first)
    expect((await (second as LibraryManager).listNodes())).toEqual([])

    // 未登录（没有可归属主体）：门面缺席，但域还开着。
    subject = undefined
    expect(host.port.manager()).toBeUndefined()

    // 再回到老主体：是**新**实例（缓存已被换主体冲掉），数据仍在。
    subject = { scope: 'personal', ownerId: 'u1001' }
    const third = host.port.manager()
    expect(third).not.toBe(second)
    expect((await (third as LibraryManager).getNode(folder.id)).title).toBe('项目甲')

    await host.dispose()
    expect(closed).toHaveBeenCalledTimes(1)
    expect(host.port.manager()).toBeUndefined()
  })

  it('挂三个面：路由 1 条 + 3 个工具 + 1 个注入监听；注销一次全撤', async () => {
    const home = await makeHome()
    const routes = routeTable()
    const tools = toolTable()
    const events = eventTable()
    const domain = await createInMemoryLibraryDomain()
    const host = createEnterpriseLibraryHost({
      dshHome: home,
      facility: { open: () => ({ name: domain.name, table: (name: string) => domain.table(name as never) }) },
      readSubject: () => ({ scope: 'personal', ownerId: 'u1001' }),
      log: () => undefined,
    })
    await host.start()

    const dispose = mountEnterpriseLibraryFaces(host, {
      webServer: routes.webServer,
      tools: tools.runtime,
      events: events.port as never,
    })
    expect(routes.routes.map(route => `${route.kind}:${route.path}`).sort()).toEqual([
      `exact:${ENTERPRISE_LIBRARY_LOCAL_PATH}`,
      `prefix:${ENTERPRISE_LIBRARY_OBJECTS_PREFIX}`,
    ])
    expect(tools.definitions).toHaveLength(3)
    expect(events.count()).toBe(1)

    dispose()
    expect(routes.routes).toEqual([])
    expect(tools.definitions).toEqual([])
    expect(events.count()).toBe(0)
  })

  it('没有 tools / events 时只挂路由（不假装有工具面）', async () => {
    const home = await makeHome()
    const routes = routeTable()
    const host = createEnterpriseLibraryHost({
      dshHome: home,
      readSubject: () => undefined,
      log: () => undefined,
    })
    const dispose = mountEnterpriseLibraryFaces(host, { webServer: routes.webServer })
    expect(routes.routes).toHaveLength(2)
    dispose()
    expect(routes.routes).toEqual([])
  })
})
