/**
 * [INPUT]: 依赖 `src/nuwax-route.ts` 的三条路由与常量、`src/nuwax-auth.ts` 的会话持有者、`tests/engine-route-match.ts`（引擎语义匹配器）、`tests/nuwax-support.ts`（每份 holder 一份隔离 dshHome）与 node:http 真服务器；平台反应由真实 `Response` 构造（不打真网）
 * [OUTPUT]: 锁定 NUWAX 登录本机 HTTP 面：三条 exact 路由的注册形状（逐字路径、互不为前缀、方法各不相同）、`POST /login` 200 且**响应体不含票据**、三条路由一致投影**服务地址**（`origin`，未配置时如实缺席、绝不编地址）、`GET /status` 与 `POST /logout` 的登录态投影、四类失败投影（401 凭据 / 502 上游 / 503 未配置 / 400-413 形状）、以及两条路由的 405 + Allow
 * [POS]: 口径 29 的**本机面**回归门禁（真 HTTP + 引擎语义分发，不是直接调 handler）；有人把票据塞回响应、把 405 的 Allow 拿掉、或者让形状门禁漏过去，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createNuwaxSessionHolder,
  NUWAX_ORIGIN_ENV,
  type NuwaxAuthDependencies,
  type NuwaxSessionHolder,
} from '../src/nuwax-auth.js'
import {
  ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH,
  ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH,
  ENTERPRISE_NUWAX_MAX_BODY_BYTES,
  ENTERPRISE_NUWAX_STATUS_LOCAL_PATH,
  registerEnterpriseNuwaxRoutes,
} from '../src/nuwax-route.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { disposeNuwaxTempHomes, nuwaxTempHome } from './nuwax-support.js'

const ORIGIN = 'https://nuwax.example.com'
const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'correct horse battery staple'
const TICKET = 'jwt-ticket-must-not-leave-the-host'

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => { resolve() }) })))
  // ★会话持有者带落盘：每个 holder 夹具一份自己的 dshHome，否则上一份票据会被当成"重启后的登录态"读回来。
  disposeNuwaxTempHomes()
})

/** 一次成功的平台往返（登录 + 自证）。 */
function successfulPlatform(): NuwaxAuthDependencies['fetch'] {
  return async (input: string): Promise<Response> => input.endsWith('/api/user/passwordLogin')
    ? new Response(JSON.stringify({ code: '0000', data: { token: 'jwt' } }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': `ticket=${TICKET}; Max-Age=604800; HttpOnly; Secure; SameSite=None`,
      },
    })
    : new Response(JSON.stringify({ code: '0000', data: { uid: 1_784_006_361, userName: '538565', nickName: '李猛', tenantId: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
}

/** 路由夹具：真 HTTP 服务器 + 引擎语义分发（形状与行为一起锁）。 */
interface RouteHarness {
  readonly routes: readonly RegisteredRoute[]
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response>
  get(path: string): Promise<Response>
  raw(path: string, method: string, body: string, contentType: string): Promise<Response>
  dispose(): Promise<void>
}

async function startHarness(holder: NuwaxSessionHolder): Promise<RouteHarness> {
  const routes: RegisteredRoute[] = []
  const disposeRoutes = registerEnterpriseNuwaxRoutes({
    host: '127.0.0.1',
    port: 0,
    register: route => {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index > -1) routes.splice(index, 1)
      }
    },
  }, { holder })
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(request, response))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing test port')
  const origin = `http://127.0.0.1:${address.port}`
  const harness: RouteHarness = {
    routes,
    post: async (path, body, headers) => await fetch(`${origin}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    }),
    get: async path => await fetch(`${origin}${path}`),
    raw: async (path, method, body, contentType) => await fetch(`${origin}${path}`, {
      method,
      body,
      headers: { 'content-type': contentType },
    }),
    // 夹具自检口：注销函数必须能把三条路由摘干净（测试之间不许互相污染）。
    dispose: async () => {
      disposeRoutes()
      await new Promise<void>(resolve => server.close(() => { resolve() }))
      expect(routes).toHaveLength(0)
    },
  }
  return harness
}

describe('nuwax-route：注册形状', () => {
  it('恰好三条 exact 路由，路径逐字、互不为前缀（不存在 prefix 抢路由的问题）', async () => {
    const holder = createNuwaxSessionHolder({ fetch: successfulPlatform(), origin: ORIGIN, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(holder)
    expect(harness.routes.map(route => `${route.kind} ${route.path}`)).toEqual([
      `exact ${ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH}`,
      `exact ${ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH}`,
      `exact ${ENTERPRISE_NUWAX_STATUS_LOCAL_PATH}`,
    ])
    expect(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH).toBe('/enterprise/api/v1/local/nuwax/login')
    expect(ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH).toBe('/enterprise/api/v1/local/nuwax/logout')
    expect(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH).toBe('/enterprise/api/v1/local/nuwax/status')
    // 三条互不为前缀，且都不带尾斜杠。
    for (const left of harness.routes) {
      for (const right of harness.routes) {
        if (left === right) continue
        expect(right.path.startsWith(`${left.path}/`)).toBe(false)
      }
      expect(left.path.endsWith('/')).toBe(false)
    }
    // 未注册的邻居路径根本不进 handler。
    expect((await harness.get('/enterprise/api/v1/local/nuwax')).status).toBe(404)
    // 注销口真的把三条都摘掉（不然插件卸载后路由会留着）。
    await harness.dispose()
  })
})

describe('nuwax-route：登录与登录态', () => {
  it('POST /login 200：回派生的登录态，**票据不出宿主**', async () => {
    const holder = createNuwaxSessionHolder({ fetch: successfulPlatform(), origin: ORIGIN, now: () => 0, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(holder)
    const response = await harness.post(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH, { account: ACCOUNT, password: PASSWORD })
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toContain(TICKET)
    expect(text).not.toContain(PASSWORD)
    expect(JSON.parse(text)).toEqual({
      data: {
        state: 'signed-in',
        // 服务地址（**地址不是凭据**）：界面靠它显示「这次登录打到哪台」。
        origin: ORIGIN,
        principal: { uid: 1_784_006_361, userName: '538565', nickName: '李猛', tenantId: 1 },
        expiresAt: 604_800_000,
      },
    })
    expect(holder.current()?.ticket).toBe(TICKET)
  })

  it('GET /status 如实反映登录态（未登录时只有 state）', async () => {
    const holder = createNuwaxSessionHolder({ fetch: successfulPlatform(), origin: ORIGIN, now: () => 0, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(holder)
    const before = await harness.get(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH)
    expect(before.status).toBe(200)
    expect(JSON.parse(await before.text())).toEqual({ data: { state: 'signed-out', origin: ORIGIN } })

    await harness.post(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH, { account: ACCOUNT, password: PASSWORD })
    const after = await harness.get(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH)
    const payload = JSON.parse(await after.text()) as { data: { state: string } }
    expect(payload.data.state).toBe('signed-in')
  })

  it('POST /logout 200 且真的丢掉宿主内存里的票据（无网络调用）', async () => {
    let platformCalls = 0
    const platform: NuwaxAuthDependencies['fetch'] = async (input, init) => {
      platformCalls += 1
      return await successfulPlatform()(input, init)
    }
    const holder = createNuwaxSessionHolder({ fetch: platform, origin: ORIGIN, now: () => 0, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(holder)
    await harness.post(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH, { account: ACCOUNT, password: PASSWORD })
    const callsAfterLogin = platformCalls
    const response = await harness.post(ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH, {})
    expect(response.status).toBe(200)
    expect(JSON.parse(await response.text())).toEqual({ data: { state: 'signed-out', origin: ORIGIN } })
    expect(platformCalls).toBe(callsAfterLogin)
    expect(holder.current()).toBeUndefined()
  })

  it('部署显式停用时：登录态照旧、地址那一格**如实缺席**（不编地址、也不回落企业默认域）', async () => {
    const disabled = createNuwaxSessionHolder({ fetch: successfulPlatform(), env: { [NUWAX_ORIGIN_ENV]: '' }, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(disabled)
    const status = await harness.get(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH)
    expect(status.status).toBe(200)
    const payload = JSON.parse(await status.text()) as { data: Record<string, unknown> }
    expect(payload.data).toEqual({ state: 'signed-out' })
    expect('origin' in payload.data).toBe(false)
    // 登出走同一个投影：形状与 status 一致，也不带地址。
    expect(JSON.parse(await (await harness.post(ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH, {})).text()))
      .toEqual({ data: { state: 'signed-out' } })
  })
})

describe('nuwax-route：失败投影（走同一张码→状态表）', () => {
  it('凭据不对 → 401；上游 5xx → 502；未配置 → 503', async () => {
    const rejected = createNuwaxSessionHolder({
      fetch: async () => new Response(JSON.stringify({ code: '0001', message: '用户不存在或密码错误' }), { status: 200 }),
      origin: ORIGIN, dshHome: nuwaxTempHome('route') })
    const first = await startHarness(rejected)
    const unauthorized = await first.post(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH, { account: ACCOUNT, password: PASSWORD })
    expect(unauthorized.status).toBe(401)
    expect(await unauthorized.json()).toEqual({ error: { code: 'ENT_NUWAX_INVALID_CREDENTIALS' } })

    const broken = createNuwaxSessionHolder({ fetch: async () => new Response('nope', { status: 503 }), origin: ORIGIN, dshHome: nuwaxTempHome('route') })
    const second = await startHarness(broken)
    expect((await second.post(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH, { account: ACCOUNT, password: PASSWORD })).status).toBe(502)

    const unconfigured = createNuwaxSessionHolder({ fetch: successfulPlatform(), env: { [NUWAX_ORIGIN_ENV]: '' }, dshHome: nuwaxTempHome('route') })
    const third = await startHarness(unconfigured)
    const missing = await third.post(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH, { account: ACCOUNT, password: PASSWORD })
    expect(missing.status).toBe(503)
    expect(await missing.json()).toEqual({ error: { code: 'ENT_NUWAX_NOT_CONFIGURED' } })
  })

  it('正文形状门禁：非 JSON 类型 / 空体 / 多出来的键 / 缺字段 → 400；超大 → 413', async () => {
    const holder = createNuwaxSessionHolder({ fetch: successfulPlatform(), origin: ORIGIN, now: () => 0, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(holder)
    const path = ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH

    expect((await harness.raw(path, 'POST', JSON.stringify({ account: ACCOUNT, password: PASSWORD }), 'text/plain')).status).toBe(400)
    expect((await harness.raw(path, 'POST', '', 'application/json')).status).toBe(400)
    expect((await harness.post(path, { account: ACCOUNT, password: PASSWORD, extra: 1 })).status).toBe(400)
    expect((await harness.post(path, { account: ACCOUNT })).status).toBe(400)
    expect((await harness.post(path, { account: '', password: PASSWORD })).status).toBe(400)
    expect((await harness.post(path, { account: ACCOUNT, password: 'x'.repeat(1025) })).status).toBe(400)
    const oversized = await harness.raw(path, 'POST', JSON.stringify({ account: 'a'.repeat(ENTERPRISE_NUWAX_MAX_BODY_BYTES + 1), password: 'x' }), 'application/json')
    expect(oversized.status).toBe(413)
    // 五次形状拒绝**一次都没打平台**。
    expect(holder.current()).toBeUndefined()
  })

  it('方法不符 → 405 + Allow（异常体只回稳定码）', async () => {
    const holder = createNuwaxSessionHolder({ fetch: successfulPlatform(), origin: ORIGIN, now: () => 0, dshHome: nuwaxTempHome('route') })
    const harness = await startHarness(holder)

    const onLogin = await harness.get(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH)
    expect(onLogin.status).toBe(405)
    expect(onLogin.headers.get('allow')).toBe('POST')
    expect(await onLogin.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })

    const onStatus = await harness.post(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH, {})
    expect(onStatus.status).toBe(405)
    expect(onStatus.headers.get('allow')).toBe('GET')

    const onLogout = await harness.get(ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH)
    expect(onLogout.status).toBe(405)
    expect(onLogout.headers.get('allow')).toBe('POST')
  })
})
