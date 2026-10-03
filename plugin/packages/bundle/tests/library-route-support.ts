/**
 * [INPUT]: 依赖 node:http（真 HTTP 服务器）、`tests/engine-route-match.ts`（引擎语义匹配器）与本包 `src/library/route.ts` 的端口类型
 * [OUTPUT]: 对外提供 `createLibraryRouteHarness`（把资料库两条路由挂进一个**真实 Node HTTP 服务器**，并用引擎语义分发请求）与 `post`/`get` 便捷方法
 * [POS]: 资料库路由测试的**共用夹具**（不是产品代码、不被 vitest 直接收集）。为什么不直接调 handler：注册形状（exact/prefix、不带尾斜杠）本身是被测对象之一，只有走"引擎 match → 真 HTTP"才能同时锁住形状与行为（与 `skill-install-route.spec.ts` 同一手法）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import type { EnterpriseLibraryRoutePort } from '../src/library/route.js'
import { registerEnterpriseLibraryRoutes } from '../src/library/route.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'

/** 本地 API 前缀（与 `platform-client` 的 `LOCAL_API_PREFIX` 同值）。 */
export const LIBRARY_LOCAL_PREFIX = '/enterprise/api/v1/local'

/** 一台挂着资料库路由的真 HTTP 服务器。 */
export interface LibraryRouteHarness {
  readonly baseUrl: string
  /** 注册出来的全部路由（形状断言用）。 */
  readonly routes: readonly RegisteredRoute[]
  post(path: string, body: unknown): Promise<Response>
  get(path: string): Promise<Response>
  dispose(): Promise<void>
}

/**
 * 起一台测试服务器。
 *
 * @param port - 资料库路由端口（门面 + 留痕）。
 * @returns 夹具（`dispose` 会同时关服务器与注销路由）。
 */
export async function createLibraryRouteHarness(port: EnterpriseLibraryRoutePort): Promise<LibraryRouteHarness> {
  const routes: RegisteredRoute[] = []
  const disposeRoutes = registerEnterpriseLibraryRoutes({
    host: '127.0.0.1',
    port: 0,
    register: route => {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index > -1) routes.splice(index, 1)
      }
    },
  }, port)

  const server: Server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(request, response))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing test port')
  const baseUrl = `http://127.0.0.1:${address.port}${LIBRARY_LOCAL_PREFIX}`

  return {
    baseUrl,
    routes,
    post: async (path, body) => await fetch(`${baseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }),
    get: async path => await fetch(`${baseUrl}${path}`),
    dispose: async () => {
      disposeRoutes()
      await new Promise<void>(resolve => { server.close(() => { resolve() }) })
    },
  }
}
