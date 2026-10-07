/**
 * [INPUT]: 依赖 `src/esc-route.ts` 的路由与闭集、`src/nuwax-auth.ts` 的会话持有者、`tests/engine-route-match.ts`（引擎语义匹配器）与 node:http 真服务器；平台反应由真实 `Response` 构造（不打真网）
 * [OUTPUT]: 锁定 esc 代理面**两条 exact 路由**：① 取数面——注册形状、**只读闭集**（未登记路径/前缀相似路径/写端点/带查询串一律 400）、正文关闭键集与扁平参数门禁、**未登录即 401 且零平台调用**、GET/POST 两种转发形状（带票据 cookie、查询参数按重复键）、响应原样回（含 `success`/`message` 两格）、**票据绝不出现在响应里**、上游四类失败映射（3xx/5xx/401/4xx 与超时）、两处上限（请求体 413 / 平台正文 502）、以及配置显式停用时的 503；② 图片面——非 GET 405、未登录 401 零调用、`src` 门禁（缺参、重复、非绝对、非 http(s)、带凭据、**第二个域**、闭集外路径、超长 一律 400 且零调用）、成功路径（带票据 cookie、`nosniff`、私有缓存、字节原样、响应无凭据）、**平台 `200 + {"code":"4010"}` ⇒ 401**（不把它当图片回给浏览器）、`200` 但非图片 ⇒ 502、3xx ⇒ 502（只调一次）、超限 ⇒ 502
 * [POS]: 口径 31 的**宿主面**回归门禁（真 HTTP + 引擎语义分发，不是直接调 handler）；只读这条性质就是这里锁住的：
 *   有人把某个写端点加进闭集、把"没登录"折成"平台拒绝"、或者让票据漏进响应，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_ESC_IMAGE_LOCAL_PATH,
  ENTERPRISE_ESC_IMAGE_PATH_PREFIXES,
  ENTERPRISE_ESC_MAX_BODY_BYTES,
  ENTERPRISE_ESC_MOCK_LOCAL_PATH,
  ENTERPRISE_ESC_READ_ENDPOINTS,
  ENTERPRISE_ESC_READ_LOCAL_PATH,
  registerEnterpriseEscReadRoute,
  type EnterpriseEscReadRoutePort,
} from '../src/esc-route.js'
import { ENTERPRISE_ESC_MOCK_FILE_ENV, readEscMockSwitch } from '../src/esc-mock.js'
import {
  createNuwaxSessionHolder,
  NUWAX_ORIGIN_ENV,
  type NuwaxAuthDependencies,
  type NuwaxSessionHolder,
} from '../src/nuwax-auth.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'

const ORIGIN = 'https://nuwax.example.com'
const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'correct horse battery staple'
const TICKET = 'esc-ticket-must-not-leave-the-host'

const servers: Server[] = []

/** 演示数据开关用的临时目录（用例建的，用例结束删）。 */
const mockDirs: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => { resolve() }) })))
  for (const dir of mockDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** 登录用的平台反应（与登录路由的测试同一体裁）。 */
function loginPlatform(): NuwaxAuthDependencies['fetch'] {
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

/** 已登录的会话持有者（本机路由的取数就靠它那枚票据）。 */
async function signedInHolder(): Promise<NuwaxSessionHolder> {
  const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN })
  await holder.login(ACCOUNT, PASSWORD)
  return holder
}

/** 平台 fetch double：记下每次调用（url + init），反应由测试给。 */
interface PlatformDouble {
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly calls: { readonly url: string; readonly init: RequestInit | undefined }[]
}

function platformDouble(respond: (url: string, init: RequestInit | undefined) => Response): PlatformDouble {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init })
    return respond(input, init)
  })
  return { fetchImpl: fetchImpl as unknown as PlatformDouble['fetchImpl'], calls }
}

/** 平台成功信封（**带 message/success 两格**：本面要求原样回交，故测试也按原样给）。 */
function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ code: '0000', message: 'ok', data, success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** 路由夹具：真 HTTP 服务器 + 引擎语义分发。 */
interface RouteHarness {
  readonly routes: readonly RegisteredRoute[]
  /** 夹具自己的 origin（无正文请求直接用它拼 URL）。 */
  readonly origin: string
  post(body: unknown, headers?: Record<string, string>): Promise<Response>
  send(path: string, method: string, body: string, contentType: string): Promise<Response>
  /** 无正文请求（GET/HEAD 不能带 body，Node 的 fetch 会直接抛）。 */
  bare(path: string, method: string): Promise<Response>
  dispose(): Promise<void>
}

async function startHarness(port: EnterpriseEscReadRoutePort): Promise<RouteHarness> {
  const routes: RegisteredRoute[] = []
  const disposeRoutes = registerEnterpriseEscReadRoute({
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
  return {
    routes,
    origin,
    post: async (body, headers) => await fetch(`${origin}${ENTERPRISE_ESC_READ_LOCAL_PATH}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    }),
    send: async (path, method, body, contentType) => await fetch(`${origin}${path}`, {
      method,
      body,
      headers: { 'content-type': contentType },
    }),
    bare: async (path, method) => await fetch(`${origin}${path}`, { method }),
    dispose: async () => {
      disposeRoutes()
      await new Promise<void>(resolve => server.close(() => { resolve() }))
      expect(routes).toHaveLength(0)
    },
  }
}

/** 读错误码（失败体统一 `{error:{code}}`）。 */
async function errorCodeOf(response: Response): Promise<string> {
  const payload = (await response.json()) as { error?: { code?: string } }
  return payload.error?.code ?? ''
}

describe('esc-route：注册形状与只读闭集', () => {
  it('恰好三条 exact 路由（取数 + 图片 + 演示数据开关状态），路径逐字、不带尾斜杠，父路径本身 404', async () => {
    const harness = await startHarness({ holder: await signedInHolder() })
    expect(ENTERPRISE_ESC_READ_LOCAL_PATH).toBe('/enterprise/api/v1/local/esc/read')
    expect(ENTERPRISE_ESC_IMAGE_LOCAL_PATH).toBe('/enterprise/api/v1/local/esc/image')
    expect(ENTERPRISE_ESC_MOCK_LOCAL_PATH).toBe('/enterprise/api/v1/local/esc/mock')
    expect(harness.routes.map(route => `${route.kind} ${route.path}`)).toEqual([
      `exact ${ENTERPRISE_ESC_READ_LOCAL_PATH}`,
      `exact ${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}`,
      `exact ${ENTERPRISE_ESC_MOCK_LOCAL_PATH}`,
    ])
    expect(ENTERPRISE_ESC_READ_LOCAL_PATH.endsWith('/')).toBe(false)
    expect(ENTERPRISE_ESC_IMAGE_LOCAL_PATH.endsWith('/')).toBe(false)
    expect(ENTERPRISE_ESC_MOCK_LOCAL_PATH.endsWith('/')).toBe(false)
    // 父路径 `/esc`、截断的前缀、以及带尾斜杠的三条都不是登记路径 ⇒ 引擎判 404（exact 不做前缀匹配）。
    for (const path of [
      '/enterprise/api/v1/local/esc',
      '/enterprise/api/v1/local/esc/rea',
      '/enterprise/api/v1/local/esc/imag',
      '/enterprise/api/v1/local/esc/moc',
      `${ENTERPRISE_ESC_READ_LOCAL_PATH}/`,
      `${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}/`,
      `${ENTERPRISE_ESC_MOCK_LOCAL_PATH}/`,
    ]) {
      const response = await harness.send(path, 'POST', '{"path":"/api/space/list"}', 'application/json')
      expect(response.status, path).toBe(404)
    }
    await harness.dispose()
  })

  it('闭集里七条全是只读端点（三条 GET + 四条读语义 POST），写端点一条都没有', async () => {
    expect(ENTERPRISE_ESC_READ_ENDPOINTS).toEqual({
      // ★本刀新增第七条：「精选技能」那一行（官方推荐）。它是**读语义**的 POST，
      //   查询体四格全部由客户端取数面封死，页面改不了 —— 见 esc-constants.ts 的出处注释。
      '/api/system/display/recommend/list': 'POST',
      '/api/published/category/list': 'GET',
      '/api/space/list': 'GET',
      '/api/connector/providers': 'GET',
      '/api/published/agent/list': 'POST',
      '/api/published/skill/list': 'POST',
      '/api/published/skill/enable/list': 'POST',
    })
    // ★反向锁：任何**改平台状态**的端点都不许进来（收藏、启停、建连/断开、删除…）。
    for (const writePath of [
      '/api/published/skill/enable/1',
      '/api/published/skill/unEnable/1',
      '/api/published/agent/collect/1',
      '/api/connector/connections/api-key',
      '/api/connector/connections/1/status',
      // ★本刀：推荐管理那组**写**端点一条都不许进来。本面只放行那条 `list`（只读查询）——
      //   `save`/`update`/`delete/{id}`/`updateSort` 全是改平台数据，必须永远留在闭集之外。
      '/api/system/display/recommend/save',
      '/api/system/display/recommend/update',
      '/api/system/display/recommend/delete/1',
      '/api/system/display/recommend/updateSort',
    ]) {
      expect(Object.keys(ENTERPRISE_ESC_READ_ENDPOINTS)).not.toContain(writePath)
    }
  })

  it('非 POST 一律 405 + Allow: POST', async () => {
    const harness = await startHarness({ holder: await signedInHolder() })
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await harness.bare(ENTERPRISE_ESC_READ_LOCAL_PATH, method)
      expect(response.status, `${method} 应当 405`).toBe(405)
      expect(response.headers.get('allow'), `${method} 的 Allow`).toBe('POST')
    }
    await harness.dispose()
  })
})

describe('esc-route：正文门禁（形状与闭集）', () => {
  it('非 JSON content-type / 空正文 / 多一个键 / params 非扁平 一律 400，且一次平台都不打', async () => {
    const double = platformDouble(() => envelope([]))
    const harness = await startHarness({ holder: await signedInHolder(), fetch: double.fetchImpl })
    // content-type 不对
    expect((await harness.send(ENTERPRISE_ESC_READ_LOCAL_PATH, 'POST', '{"path":"/api/space/list"}', 'text/plain')).status).toBe(400)
    // 空正文
    expect((await harness.send(ENTERPRISE_ESC_READ_LOCAL_PATH, 'POST', '', 'application/json')).status).toBe(400)
    // 关闭键集：多一个键
    expect((await harness.post({ path: '/api/space/list', extra: 1 })).status).toBe(400)
    // params 必须是扁平对象
    expect((await harness.post({ path: '/api/space/list', params: { nested: { a: 1 } } })).status).toBe(400)
    expect((await harness.post({ path: '/api/space/list', params: [1, 2] })).status).toBe(400)
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('未登记的平台路径一律 400：写端点、前缀相似、带查询串、空串、非字符串', async () => {
    const double = platformDouble(() => envelope([]))
    const harness = await startHarness({ holder: await signedInHolder(), fetch: double.fetchImpl })
    for (const path of [
      '/api/published/skill/enable/1', // 写端点（不在闭集）
      '/api/published/agent', // 闭集里那条的前缀
      '/api/published/agent/list/extra', // 多一层
      '/api/space/list?spaceId=1', // 闭集路径**不带**查询串（参数走 params）
      'https://evil.example.com/api/space/list', // 绝对地址
      '/api/space/list/', // 尾斜杠
      '', // 空串
      42, // 非字符串
    ]) {
      const response = await harness.post({ path })
      expect(response.status, `path=${String(path)}`).toBe(400)
      expect(await errorCodeOf(response)).toBe('ENT_INVALID_REQUEST')
    }
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('请求体超过 64 KiB ⇒ 413（传输层早退，不打平台）', async () => {
    const double = platformDouble(() => envelope([]))
    const harness = await startHarness({ holder: await signedInHolder(), fetch: double.fetchImpl })
    const huge = { path: '/api/published/agent/list', params: { kw: 'x'.repeat(ENTERPRISE_ESC_MAX_BODY_BYTES) } }
    expect((await harness.post(huge)).status).toBe(413)
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })
})

describe('esc-route：会话与转发', () => {
  it('宿主进程里没有 NUWAX 会话 ⇒ 401 ENT_AUTH_REQUIRED，且**零平台调用**', async () => {
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN })
    const double = platformDouble(() => envelope([]))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const response = await harness.post({ path: '/api/space/list' })
    expect(response.status).toBe(401)
    expect(await errorCodeOf(response)).toBe('ENT_AUTH_REQUIRED')
    // 票据过期之后这条路径同样成立：登出即没会话，也绝不"替用户打一趟平台"。
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('GET 端点：带票据 cookie 打平台，查询参数按重复键拼上，响应原样回', async () => {
    const holder = await signedInHolder()
    const double = platformDouble(() => envelope([{ id: 52, name: '团队空间' }]))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const response = await harness.post({
      path: '/api/connector/providers',
      params: { pageNum: 2, pageSize: 20, scope: 'official', keyword: 'oss', spaceIds: [1, 2] },
    })
    expect(response.status).toBe(200)
    expect(double.calls).toHaveLength(1)
    const url = new URL(double.calls[0]!.url)
    expect(`${url.origin}${url.pathname}`).toBe(`${ORIGIN}/api/connector/providers`)
    expect(url.searchParams.get('pageNum')).toBe('2')
    expect(url.searchParams.get('pageSize')).toBe('20')
    expect(url.searchParams.get('scope')).toBe('official')
    expect(url.searchParams.get('keyword')).toBe('oss')
    // 数组按**重复键**发（平台就是这么收的），不折成逗号
    expect(url.searchParams.getAll('spaceIds')).toEqual(['1', '2'])
    // 票据只在宿主拼的 cookie 头里
    const headers = double.calls[0]!.init?.headers as Record<string, string>
    expect(headers['cookie']).toBe(`ticket=${TICKET}`)
    // 不跟随重定向是传输层的红线
    expect(double.calls[0]!.init?.redirect).toBe('manual')
    // 响应原样（`data` 就是平台那封信封，message/success 两格都在）
    expect(await response.json()).toEqual({
      data: { code: '0000', message: 'ok', data: [{ id: 52, name: '团队空间' }], success: true },
    })
    await harness.dispose()
  })

  it('POST 端点：参数进 JSON 正文（不是查询串），响应同样原样回', async () => {
    const holder = await signedInHolder()
    const double = platformDouble(() => envelope({ records: [], current: 1, pages: 1 }))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const response = await harness.post({
      path: '/api/published/agent/list',
      params: { page: 1, pageSize: 20, category: 'Agent', official: true },
    })
    expect(response.status).toBe(200)
    const call = double.calls[0]!
    const url = new URL(call.url)
    expect(`${url.origin}${url.pathname}`).toBe(`${ORIGIN}/api/published/agent/list`)
    expect(url.search).toBe('')
    expect(call.init?.method).toBe('POST')
    expect(JSON.parse(String(call.init?.body))).toEqual({ page: 1, pageSize: 20, category: 'Agent', official: true })
    const headers = call.init?.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(headers['cookie']).toBe(`ticket=${TICKET}`)
    expect(await response.json()).toEqual({
      data: { code: '0000', message: 'ok', data: { records: [], current: 1, pages: 1 }, success: true },
    })
    await harness.dispose()
  })

  it('票据绝不出现在响应体里（成功与失败两条路径都一样）', async () => {
    const holder = await signedInHolder()
    const double = platformDouble(() => envelope({ records: [] }))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const ok = await (await harness.post({ path: '/api/space/list' })).text()
    expect(ok).not.toContain(TICKET)
    expect(ok).not.toContain('ticket=')
    const failing = await startHarness({ holder: await signedInHolder(), fetch: platformDouble(() => new Response('boom', { status: 500 })).fetchImpl })
    const bad = await (await failing.post({ path: '/api/space/list' })).text()
    expect(bad).not.toContain(TICKET)
    await harness.dispose()
    await failing.dispose()
  })
})

describe('esc-route：上游失败与配置', () => {
  it('3xx ⇒ 502 ENT_NUWAX_PROTOCOL（绝不跟随重定向）', async () => {
    const holder = await signedInHolder()
    const harness = await startHarness({
      holder,
      fetch: platformDouble(() => new Response(null, { status: 302, headers: { location: 'https://evil.example.com' } })).fetchImpl,
    })
    const response = await harness.post({ path: '/api/space/list' })
    expect(response.status).toBe(502)
    expect(await errorCodeOf(response)).toBe('ENT_NUWAX_PROTOCOL')
    await harness.dispose()
  })

  it('5xx ⇒ 502 ENT_NUWAX_UNAVAILABLE；平台 403 ⇒ 403 ENT_NUWAX_REJECTED；平台 401 ⇒ 401 ENT_AUTH_REQUIRED', async () => {
    const holder = await signedInHolder()
    for (const [status, expectedStatus, expectedCode] of [
      [500, 502, 'ENT_NUWAX_UNAVAILABLE'],
      [503, 502, 'ENT_NUWAX_UNAVAILABLE'],
      [403, 403, 'ENT_NUWAX_REJECTED'],
      [401, 401, 'ENT_AUTH_REQUIRED'],
    ] as const) {
      const harness = await startHarness({ holder, fetch: platformDouble(() => new Response('x', { status })).fetchImpl })
      const response = await harness.post({ path: '/api/space/list' })
      expect(response.status, `platform HTTP ${status}`).toBe(expectedStatus)
      expect(await errorCodeOf(response), `platform HTTP ${status}`).toBe(expectedCode)
      await harness.dispose()
    }
  })

  it('平台回的不是 JSON / JSON 里没有 code ⇒ 502 ENT_NUWAX_PROTOCOL', async () => {
    const holder = await signedInHolder()
    for (const body of ['not json at all', JSON.stringify({ message: 'no code here' }), JSON.stringify([1, 2])]) {
      const harness = await startHarness({
        holder,
        fetch: platformDouble(() => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })).fetchImpl,
      })
      const response = await harness.post({ path: '/api/space/list' })
      expect(response.status, body).toBe(502)
      expect(await errorCodeOf(response), body).toBe('ENT_NUWAX_PROTOCOL')
      await harness.dispose()
    }
  })

  it('平台声明超过上限的正文 ⇒ 502（不是把它读进内存）', async () => {
    const holder = await signedInHolder()
    const harness = await startHarness({
      holder,
      maxBytes: 32,
      fetch: platformDouble(() => new Response(JSON.stringify({ code: '0000', data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'content-length': '4096' },
      })).fetchImpl,
    })
    const response = await harness.post({ path: '/api/space/list' })
    expect(response.status).toBe(502)
    expect(await errorCodeOf(response)).toBe('ENT_NUWAX_PROTOCOL')
    await harness.dispose()
  })

  it('传输层异常 ⇒ 502 ENT_NUWAX_UNAVAILABLE；超时 ⇒ 502 ENT_NUWAX_TIMEOUT', async () => {
    const holder = await signedInHolder()
    const boom = await startHarness({
      holder,
      fetch: platformDouble(() => { throw new Error('socket closed') }),
    })
    const network = await boom.post({ path: '/api/space/list' })
    expect(network.status).toBe(502)
    expect(await errorCodeOf(network)).toBe('ENT_NUWAX_UNAVAILABLE')
    await boom.dispose()
    const abort = await startHarness({
      holder,
      timeoutMs: 5,
      // 超时这条路径让 double **跟随 signal**（真实 fetch 的行为）：AbortController 一响就抛 AbortError。
      fetch: (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      }),
    })
    const timedOut = await abort.post({ path: '/api/space/list' })
    expect(timedOut.status).toBe(502)
    expect(await errorCodeOf(timedOut)).toBe('ENT_NUWAX_TIMEOUT')
    await abort.dispose()
  })

  it('部署配置显式停用 NUWAX origin ⇒ 503 ENT_NUWAX_NOT_CONFIGURED，且零平台调用', async () => {
    const holder = await signedInHolder()
    const double = platformDouble(() => envelope([]))
    const harness = await startHarness({ holder, fetch: double.fetchImpl, env: { [NUWAX_ORIGIN_ENV]: '   ' } })
    const response = await harness.post({ path: '/api/space/list' })
    expect(response.status).toBe(503)
    expect(await errorCodeOf(response)).toBe('ENT_NUWAX_NOT_CONFIGURED')
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })
})

/**
 * 图片面（本轮新增）：平台交给页面的图标/头像 URL 全是要票据的，浏览器直连必破图，
 * 故这条路线**必须**只接受"会话自己那一台 + 图片路径闭集"的目标，且判决与 JSON 面刻意差一处
 * （平台用 **HTTP 200 + `{"code":"4010"}`** 表示未登录）。
 */
describe('esc-route：图片代理（带票据取图标/头像）', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const IMAGE_URL = `${ORIGIN}/api/logo/skill/flow-builder`
  const pull = (src: string): string => `${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}?src=${encodeURIComponent(src)}`

  it('非 GET 一律 405 + Allow: GET', async () => {
    const harness = await startHarness({ holder: await signedInHolder() })
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await harness.send(ENTERPRISE_ESC_IMAGE_LOCAL_PATH, method, '', 'application/json')
      expect(response.status, `${method} 应当 405`).toBe(405)
      expect(response.headers.get('allow'), `${method} 的 Allow`).toBe('GET')
    }
    await harness.dispose()
  })

  it('没登录 ⇒ 401 ENT_AUTH_REQUIRED，且零平台调用（图片也不许绕过登录态）', async () => {
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN })
    const double = platformDouble(() => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const response = await harness.bare(pull(IMAGE_URL), 'GET')
    expect(response.status).toBe(401)
    expect(await errorCodeOf(response)).toBe('ENT_AUTH_REQUIRED')
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('src 门禁：缺参/重复/非绝对/非 http(s)/带凭据/第二个域/闭集外路径/超长 ⇒ 400 且零平台调用', async () => {
    // 图片路径闭集**逐字**锁住：加一条新家族必须同时改这里（它就是"这条路线能读平台哪些路径"的真源）。
    expect([...ENTERPRISE_ESC_IMAGE_PATH_PREFIXES]).toEqual(['/api/logo/', '/api/f/'])
    const double = platformDouble(() => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }))
    const harness = await startHarness({ holder: await signedInHolder(), fetch: double.fetchImpl })
    for (const path of [
      ENTERPRISE_ESC_IMAGE_LOCAL_PATH, // 缺 src
      `${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}?src=a&src=b`, // 两个 src
      pull('not a url'), // 非绝对地址
      pull('javascript:alert(1)'), // 非 http(s)
      pull(`data:image/png;base64,${'A'.repeat(8)}`), // 非 http(s)（data:）
      pull('https://u:p@nuwax.example.com/api/f/x.png'), // 带凭据
      pull('https://evil.example.com/api/f/x.png'), // **第二个域**：票据绝不发过去
      pull(`${ORIGIN}/api/user/info`), // 闭集外路径：这条路线不当"平台任意接口的可读面"
      pull(`${ORIGIN}/api/logo`), // 前缀相似但不在闭集（闭集要带尾斜杠）
      pull(`${ORIGIN}/other/logo/x.png`), // 不在 `/api/` 下的静态资源
      `${ENTERPRISE_ESC_IMAGE_LOCAL_PATH}?src=${'a'.repeat(3000)}`, // 超长
    ]) {
      const response = await harness.bare(path, 'GET')
      expect(response.status, path).toBe(400)
      expect(await errorCodeOf(response), path).toBe('ENT_INVALID_REQUEST')
    }
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('成功：带票据 cookie 打平台那一张图，字节与 content-type 原样回，响应里没有凭据', async () => {
    const double = platformDouble(() => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }))
    const harness = await startHarness({ holder: await signedInHolder(), fetch: double.fetchImpl })
    const response = await harness.bare(pull(IMAGE_URL), 'GET')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('cache-control')).toBe('private, max-age=300')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG)
    expect(double.calls).toHaveLength(1)
    const call = double.calls[0]!
    const url = new URL(call.url)
    expect(`${url.origin}${url.pathname}`).toBe(IMAGE_URL)
    expect(url.search).toBe('')
    expect(call.init?.method).toBe('GET')
    expect(call.init?.redirect).toBe('manual')
    const headers = call.init?.headers as Record<string, string>
    expect(headers['cookie']).toBe(`ticket=${TICKET}`)
    expect(headers['accept']).toBe('image/*')
    await harness.dispose()
  })

  it('平台回 200 + `{"code":"4010"}`（实测的头像未登录形状）⇒ 401 ENT_AUTH_REQUIRED，不把它当图片回给浏览器', async () => {
    const holder = await signedInHolder()
    const double = platformDouble(() => new Response(JSON.stringify({ code: '4010', message: '未登录或登录超时', data: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const response = await harness.bare(pull(`${ORIGIN}/api/f/local/default/avatar.png`), 'GET')
    expect(response.status).toBe(401)
    expect(await errorCodeOf(response)).toBe('ENT_AUTH_REQUIRED')
    const text = await (await harness.bare(pull(`${ORIGIN}/api/f/local/default/avatar.png`), 'GET')).text()
    expect(text).not.toContain(TICKET)
    await harness.dispose()
  })

  it('平台回 200 但不是图片（HTML / 别的 JSON 码）⇒ 502 ENT_NUWAX_PROTOCOL', async () => {
    const holder = await signedInHolder()
    for (const upstream of [
      new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      new Response(JSON.stringify({ code: '5000', message: 'boom' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ]) {
      const harness = await startHarness({ holder, fetch: platformDouble(() => upstream).fetchImpl })
      const response = await harness.bare(pull(IMAGE_URL), 'GET')
      expect(response.status).toBe(502)
      expect(await errorCodeOf(response)).toBe('ENT_NUWAX_PROTOCOL')
      await harness.dispose()
    }
  })

  it('3xx ⇒ 502 ENT_NUWAX_PROTOCOL（只有一次调用：绝不跟着跳到第二个域）', async () => {
    const holder = await signedInHolder()
    const double = platformDouble(() => new Response(null, { status: 302, headers: { location: 'https://evil.example.com/x.png' } }))
    const harness = await startHarness({ holder, fetch: double.fetchImpl })
    const response = await harness.bare(pull(IMAGE_URL), 'GET')
    expect(response.status).toBe(502)
    expect(await errorCodeOf(response)).toBe('ENT_NUWAX_PROTOCOL')
    expect(double.calls).toHaveLength(1)
    await harness.dispose()
  })

  it('图片超过上限 ⇒ 502（声明超限即早退，不读进内存）', async () => {
    const holder = await signedInHolder()
    const harness = await startHarness({
      holder,
      maxImageBytes: 16,
      fetch: platformDouble(() => new Response(PNG, {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '4096' },
      })).fetchImpl,
    })
    const response = await harness.bare(pull(IMAGE_URL), 'GET')
    expect(response.status).toBe(502)
    expect(await errorCodeOf(response)).toBe('ENT_NUWAX_PROTOCOL')
    await harness.dispose()
  })
})

describe('esc-route：演示数据闸门（口径 32，默认关）', () => {
  /** 造一个临时开关文件（返回绝对路径），测试结束随临时目录一起删。 */
  function switchFile(body: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'esc-route-mock-'))
    mockDirs.push(dir)
    const file = join(dir, 'esc-mock.json')
    writeFileSync(file, body, 'utf8')
    return file
  }

  it('开关开着 ⇒ 连接器目录**没登录也回 200**（信封是平台形状 + 多一枚 mock:true），且零平台调用', async () => {
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN })
    const double = platformDouble(() => envelope([]))
    const file = switchFile('{"enabled": true}')
    const harness = await startHarness({
      holder,
      fetch: double.fetchImpl,
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: file }),
    })
    const response = await harness.post({ path: '/api/connector/providers', params: { scope: 'official', pageNum: 1, pageSize: 20 } })
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { readonly data: Record<string, unknown>; readonly mock: boolean }
    expect(payload.mock).toBe(true)
    // 交给页面的仍是**平台信封本身**：页面那套归一化因此一字不改地跑
    const envelopeBody = payload.data as { readonly code: string; readonly data: Record<string, unknown> }
    expect(envelopeBody.code).toBe('0000')
    expect((envelopeBody.data['records'] as readonly unknown[]).length).toBe(20)
    expect(envelopeBody.data['pageNum']).toBe(1)
    // 演示数据不来自平台 ⇒ 一次都不许打平台（哪怕是没登录的情况）
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('★演示数据只服务被模拟的那两条：别的端点（含**空间列表**）照旧过会话闸门或走真平台', async () => {
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN })
    const double = platformDouble(() => envelope([]))
    const file = switchFile('{"enabled": true}')
    const harness = await startHarness({
      holder,
      fetch: double.fetchImpl,
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: file }),
    })
    // ① 专家/技能那三条：既没被模拟、也没有会话 ⇒ 401（证明演示闸门不放宽它们）
    for (const path of ['/api/published/agent/list', '/api/published/skill/list', '/api/published/skill/enable/list']) {
      const response = await harness.post({ path, params: { page: 1 } })
      expect(response.status, path).toBe(401)
      expect(await errorCodeOf(response), path).toBe('ENT_AUTH_REQUIRED')
    }
    // ② 分类树**是**被模拟的（连接器栏的二级分类要靠它）⇒ 200；这一趟**没有会话**，
    //    故拼不出真树、退回"只有 Connector 一根"的演示树，也**没有**打平台（零调用）。
    const category = await harness.post({ path: '/api/published/category/list', params: {} })
    expect(category.status).toBe(200)
    expect(double.calls).toHaveLength(0)
    await harness.dispose()
  })

  it('★分类树是"平台真树 + 演示补的 Connector 一根"（口径 34）：专家/技能两栏拿到真分类，连接器栏有分类可点', async () => {
    // 平台那趟返回一棵**只有 Agent 根**的真树（本机实测 Agent 7 / Skill 12，这里取两棵的代表值）
    const realTree = {
      code: '0000',
      displayCode: '0000',
      message: 'success',
      data: [
        { key: 'Agent', label: 'Agent', type: 'Agent', children: [{ key: 'BusinessService', label: '商业服务' }] },
        { key: 'Skill', label: 'Skill', type: 'Skill', children: [{ key: 'Education', label: '教育学习' }] },
      ],
    }
    const double = platformDouble(() => new Response(JSON.stringify(realTree), { status: 200 }))
    const harness = await startHarness({
      holder: await signedInHolder(),
      fetch: double.fetchImpl,
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: switchFile('{"enabled": true}') }),
    })
    const response = await harness.post({ path: '/api/published/category/list', params: {} })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      readonly mock?: boolean
      readonly data: { readonly code: string; readonly data: readonly { readonly key: string }[] }
    }
    // 真树的两根**一根不少**（专家/技能两栏的二级分类就是从这两棵里取的）+ 演示补的第三根
    expect(body.data.data.map(root => root.key)).toEqual(['Agent', 'Skill', 'Connector'])
    expect(body.data.code).toBe('0000')
    // 信封上仍带 `mock: true`（这一份响应里有演示成分，不许冒充纯平台数据）
    expect(body.mock).toBe(true)
    expect(double.calls).toHaveLength(1)
    await harness.dispose()
  })

  it('★空间列表**不**吃演示数据（用户裁决「空间要使用后台真实的空间」）：照旧走会话闸门与真平台', async () => {
    // 没登录 ⇒ 401（若它被演示数据接管，这里会是 200 + 演示空间）
    const anon = await startHarness({
      holder: createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN }),
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: switchFile('{"enabled": true}') }),
    })
    const denied = await anon.post({ path: '/api/space/list', params: {} })
    expect(denied.status).toBe(401)
    expect(await errorCodeOf(denied)).toBe('ENT_AUTH_REQUIRED')
    await anon.dispose()

    // 已登录 ⇒ 真平台信封原样交回，且**没有** `mock: true` 这枚标记
    const double = platformDouble(() => envelope([{ id: 3, name: '数智化' }]))
    const signedIn = await startHarness({
      holder: await signedInHolder(),
      fetch: double.fetchImpl,
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: switchFile('{"enabled": true}') }),
    })
    const response = await signedIn.post({ path: '/api/space/list', params: {} })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { readonly mock?: boolean; readonly data: { readonly data: unknown } }
    expect(body.mock).toBeUndefined()
    expect(body.data.data).toEqual([{ id: 3, name: '数智化' }])
    expect(double.calls).toHaveLength(1)
    await signedIn.dispose()
  })

  it('演示数据也真按查询参数筛（分页原样回 pageNum、分类与关键词真生效）', async () => {
    const file = switchFile('{"enabled": true}')
    const harness = await startHarness({
      holder: createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN }),
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: file }),
    })
    const page2 = await harness.post({
      path: '/api/connector/providers',
      params: { scope: 'official', pageNum: 2, pageSize: 20 },
    })
    const page2Body = ((await page2.json()) as { readonly data: { readonly data: Record<string, unknown> } }).data
    expect(page2Body.data['pageNum']).toBe(2)
    expect((page2Body.data['records'] as readonly unknown[]).length).toBe(4)
    const filtered = await harness.post({
      path: '/api/connector/providers',
      params: { scope: 'official', pageSize: 50, category: '开发工具', keyword: 'git' },
    })
    const filteredBody = ((await filtered.json()) as {
      readonly data: { readonly data: { readonly records: readonly { readonly service: string }[] } }
    }).data
    expect(filteredBody.data.records.map(item => item.service)).toEqual(['github', 'gitlab'])
    await harness.dispose()
  })

  it('开关没打开（端口没注入读取器 / 文件写着 false / 文件畸形）⇒ 取数照旧 401，演示数据一格都不放出去', async () => {
    const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN })
    const falseFile = switchFile('{"enabled": false}')
    const brokenFile = switchFile('{ 这不是 JSON')
    const cases: readonly [string, EnterpriseEscReadRoutePort['mock']][] = [
      ['端口没注入', undefined],
      ['写着 false', () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: falseFile })],
      ['文件畸形', () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: brokenFile })],
    ]
    for (const [name, mock] of cases) {
      const double = platformDouble(() => envelope([]))
      const harness = await startHarness({ holder, fetch: double.fetchImpl, ...(mock === undefined ? {} : { mock }) })
      const response = await harness.post({ path: '/api/connector/providers', params: { scope: 'official' } })
      expect(response.status, name).toBe(401)
      expect(await errorCodeOf(response), name).toBe('ENT_AUTH_REQUIRED')
      expect(double.calls, name).toHaveLength(0)
      await harness.dispose()
    }
  })

  it('GET /esc/mock 报开关状态（没注入 / 开着 / 写着 false）；非 GET ⇒ 405 + Allow: GET', async () => {
    const off = await startHarness({ holder: await signedInHolder() })
    const offBody = (await (await off.bare(ENTERPRISE_ESC_MOCK_LOCAL_PATH, 'GET')).json()) as {
      readonly data: { readonly enabled: boolean; readonly reason: string; readonly endpoints: readonly string[] }
    }
    expect(offBody.data).toEqual({ enabled: false, reason: 'absent', endpoints: [] })
    // 非 GET 一律 405（这是只读状态，没有任何写语义）
    const notGet = await off.bare(ENTERPRISE_ESC_MOCK_LOCAL_PATH, 'POST')
    expect(notGet.status).toBe(405)
    expect(notGet.headers.get('allow')).toBe('GET')
    // 响应里**不许**出现开关文件的绝对路径（浏览器不需要知道本机文件在哪）
    expect(JSON.stringify(offBody)).not.toContain(tmpdir())
    await off.dispose()

    const file = switchFile('{"enabled": true}')
    const on = await startHarness({
      holder: await signedInHolder(),
      mock: () => readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: file }),
    })
    const onBody = (await (await on.bare(ENTERPRISE_ESC_MOCK_LOCAL_PATH, 'GET')).json()) as {
      readonly data: { readonly enabled: boolean; readonly reason: string; readonly endpoints: readonly string[] }
    }
    expect(onBody.data.enabled).toBe(true)
    expect(onBody.data.reason).toBe('enabled')
    expect(onBody.data.endpoints).toEqual(['/api/connector/providers', '/api/published/category/list'])
    expect(JSON.stringify(onBody)).not.toContain(file)
    await on.dispose()
  })
})
