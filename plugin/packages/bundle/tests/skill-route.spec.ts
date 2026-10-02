/**
 * [INPUT]: 依赖 `src/skill-route.ts` 的路由注册器与投影纯函数、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定企业技能目录本地只读路由的列表/详情 200 透传、非法包 id 本地 400、401/503 投影、405、`versions/` 下载路径不被当作包 id，以及**详情 prefix 必须不带尾斜杠**（用引擎同款「路径段前缀」匹配函数锁死，含带尾斜杠漏匹配的反例）
 * [POS]: bundle 的技能取数回归门禁；有人漏注册详情路由、把上游正文原样写出、把 401 折成 503、让 `/versions/...` 误撞详情路由，或把详情 prefix 改回带尾斜杠（线上 `/skills/<id>` 空体 404 的根因），本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_SKILL_LOCAL_PATH,
  ENTERPRISE_SKILLS_LIST_PATH,
  projectSkillEnvelope,
  projectSkillFailure,
  registerEnterpriseSkillRoutes,
} from '../src/skill-route.js'

/** 中心 runtime 列表的真实信封形状：数组 + requestId（requestId 必须止步于 Host）。 */
const LIST_BODY = {
  data: [
    {
      id: '1902500000000000001',
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      sourceDshVersion: '0.1.7-rc.2',
      sizeBytes: 40_960,
      skillCount: 2,
      updatedAt: '2026-09-30T08:00:00Z',
    },
  ],
  requestId: 'req_789ABCDEFGHJKMNPQRSTVWXYZ0',
}

/** 中心 runtime 详情的真实信封形状（与 contracts fixture runtime-skill-detail-success 同形）。 */
const DETAIL_BODY = {
  data: {
    id: '1902500000000000001',
    skillId: 'meeting-notes',
    displayName: '会议纪要技能组',
    description: '把会议录音与转写整理成结构化纪要。',
    sourceDshVersion: '0.1.7-rc.2',
    sizeBytes: 40_960,
    skillCount: 2,
    updatedAt: '2026-09-30T08:00:00Z',
    versionId: '1902500000000000101',
    sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    skills: [
      { name: 'meeting-notes', description: 'Use when asked to summarize meeting notes.', modelInvocable: true, userInvocable: true },
    ],
  },
  requestId: 'req_789ABCDEFGHJKMNPQRSTVWXYZ0',
}

describe('skill route projection', () => {
  it('strips the upstream envelope down to data and rejects other shapes', () => {
    expect(projectSkillEnvelope(LIST_BODY)).toBe(LIST_BODY.data)
    expect(projectSkillEnvelope(DETAIL_BODY)).toBe(DETAIL_BODY.data)
    expect(() => projectSkillEnvelope({ requestId: 'req_1' })).toThrow(TypeError)
    expect(() => projectSkillEnvelope([LIST_BODY])).toThrow(TypeError)
    expect(() => projectSkillEnvelope(null)).toThrow(TypeError)
  })

  it('projects 401 for auth rejections and 503 for everything else', () => {
    expect(projectSkillFailure(Object.assign(new Error('expired'), {
      code: 'ENT_AUTH_SESSION_EXPIRED',
      httpStatus: 401,
    }))).toEqual({ status: 401, code: 'ENT_AUTH_SESSION_EXPIRED', step: 'upstream-unauthorized-expired' })
    expect(projectSkillFailure(Object.assign(new Error('missing'), { code: 'ENT_AUTH_REQUIRED' })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'upstream-unauthorized' })
    expect(projectSkillFailure(Object.assign(new Error('unauthorized'), { httpStatus: 401 })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'upstream-unauthorized' })
    // 技能不可见（403）不是认证拒绝：投影 503 并保留受控上游码。
    expect(projectSkillFailure(Object.assign(new Error('hidden'), {
      code: 'ENT_SKILL_VISIBILITY_DENIED',
      httpStatus: 403,
    }))).toEqual({ status: 503, code: 'ENT_SKILL_VISIBILITY_DENIED', step: 'upstream-failed' })
    expect(projectSkillFailure(new Error('socket hang up')))
      .toEqual({ status: 503, code: 'ENT_PLATFORM_UNAVAILABLE', step: 'upstream-failed' })
    expect(projectSkillFailure(Object.assign(new Error('odd'), { code: 'not a code' })))
      .toEqual({ status: 503, code: 'ENT_PLATFORM_UNAVAILABLE', step: 'upstream-failed' })
  })
})

/** 注册的两条路由（exact + prefix）都要按真实 webServer 的语义分发。 */
type RegisteredRoute = Parameters<WebServerRoutePort['register']>[0]

/**
 * 引擎 `dsh-host-webserver` 的匹配语义（`lib/index.js` 的 `match()`）逐行照抄：
 * exact 表按整路径命中优先；miss 后在 prefix 表里只认「路径段前缀」——
 * `pathname === prefix || pathname.startsWith(`${prefix}/`)`，多条命中取最长者。
 *
 * 之所以在测试里复刻而不是调用真引擎：真引擎是 Cordis Service，起它要重启 DSH（本机禁止）。
 * 这份复刻是「详情 prefix 不许带尾斜杠」这条回归锁的判定核心——它必须与引擎一致，
 * 改这里之前先重读 `@deepseek-ai/dsh-host-webserver/lib/index.js` 的 `match()`。
 */
function engineRouteMatch(routes: readonly RegisteredRoute[], pathname: string): RegisteredRoute | undefined {
  const exact = routes.find(route => route.kind === 'exact' && route.path === pathname)
  if (exact !== undefined) return exact
  let best: RegisteredRoute | undefined
  for (const route of routes) {
    if (route.kind !== 'prefix') continue
    if (pathname !== route.path && !pathname.startsWith(`${route.path}/`)) continue
    if (best === undefined || route.path.length > best.path.length) best = route
  }
  return best
}

describe('GET /enterprise/api/v1/local/skills', () => {
  let server: Server
  let baseUrl: string
  let routes: RegisteredRoute[]
  let request: Mock<(input: string, init?: RequestInit) => Promise<Response>>
  let onError: Mock<(message: string, error: unknown) => void>

  function dispatch(incoming: IncomingMessage, response: ServerResponse): void {
    const pathname = (incoming.url ?? '').split('?')[0] ?? ''
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(incoming, response))
  }

  beforeEach(async () => {
    routes = []
    request = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async (input: string) => new Response(
        JSON.stringify(input === ENTERPRISE_SKILLS_LIST_PATH ? LIST_BODY : DETAIL_BODY),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    )
    onError = vi.fn<(message: string, error: unknown) => void>()
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        routes.push(registered)
        return () => {
          routes = routes.filter(route => route !== registered)
        }
      },
    }
    registerEnterpriseSkillRoutes(webServer, { request }, onError)
    server = createServer(dispatch)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('注册列表 exact 与详情 prefix 两条路由', () => {
    expect(ENTERPRISE_SKILLS_LIST_PATH).toBe('/enterprise/api/v1/skills')
    expect(ENTERPRISE_SKILL_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills')
    // 详情 prefix 与列表路径逐字相同、**不带尾斜杠**——引擎只认路径段前缀，带尾斜杠会漏掉 /skills/<id>。
    expect(routes.map(route => `${route.kind} ${route.path}`).sort())
      .toEqual(['exact /enterprise/api/v1/local/skills', 'prefix /enterprise/api/v1/local/skills'])
  })

  // 回归锁：线上 `GET /skills/code-review` 空响应体 404 的根因是详情 prefix 注册成 `/skills/`——
  // 引擎的 prefix 不是裸 startsWith，而是 `pathname === prefix || pathname.startsWith(prefix + '/')`，
  // 于是 `/skills/<id>` 谁都不命中（不进 handler，故响应体为空）；只有 `/skills/` 恰好等于 prefix 才进
  // handler（空包 id 被本地拒成 400）。这里用引擎同款匹配函数把「注册形状 + 匹配结果」一起锁死，
  // 不依赖 DSH 重启、也不依赖真引擎实例。
  it('详情 prefix 不带尾斜杠，引擎路径段语义才能命中 /skills/<id>', () => {
    const detail = routes.find(route => route.kind === 'prefix')
    expect(detail?.path).toBe(ENTERPRISE_SKILL_LOCAL_PATH)
    expect(detail?.path.endsWith('/')).toBe(false)
    // 子路径命中详情路由。
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/1902500000000000001`)).toBe(detail)
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/code-review`)).toBe(detail)
    // 裸列表路径仍归 exact（引擎 exact 表优先于 prefix 表）。
    expect(engineRouteMatch(routes, ENTERPRISE_SKILL_LOCAL_PATH)?.kind).toBe('exact')
    // 尾斜杠空包 id 仍进详情 handler（本地 400），修复前修复后行为一致。
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/`)?.kind).toBe('prefix')
    // 反例（修复前的注册形状）：带尾斜杠的 prefix 在引擎语义下漏掉 /skills/<id>。
    const legacy: RegisteredRoute[] = [{
      kind: 'prefix',
      path: `${ENTERPRISE_SKILL_LOCAL_PATH}/`,
      handler: () => undefined,
    }]
    expect(engineRouteMatch(legacy, `${ENTERPRISE_SKILL_LOCAL_PATH}/1902500000000000001`)).toBeUndefined()
    expect(engineRouteMatch(legacy, `${ENTERPRISE_SKILL_LOCAL_PATH}/`)).toBe(legacy[0])
  })

  it('GET 列表 200 透传 data 且不泄漏 requestId，并由 Host 代取中心路径', async () => {
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: LIST_BODY.data })
    expect(request).toHaveBeenCalledTimes(1)
    const [path, init] = request.mock.calls[0]!
    expect(path).toBe(ENTERPRISE_SKILLS_LIST_PATH)
    expect(init?.method).toBe('GET')
    // 取数只经平台 Service：路由自己不发 HTTP，也不自行拼 Authorization 头。
    expect(JSON.stringify(init?.headers)).not.toContain('uthorization')
    expect(onError).not.toHaveBeenCalled()
  })

  it('GET 详情 200 透传 data，并把包 id 拼进中心路径', async () => {
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/1902500000000000001`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: DETAIL_BODY.data })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![0]).toBe(`${ENTERPRISE_SKILLS_LIST_PATH}/1902500000000000001`)
  })

  it('非法包 id 与 versions/ 下载路径都在本地 400，绝不打上游', async () => {
    for (const suffix of ['', 'abc', '0', '-1', 'versions/1902500000000000101/download']) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${suffix}`)
      expect(response.status, suffix).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(request).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('上游 401 投影 401 并留 warn 判定点', async () => {
    request.mockRejectedValueOnce(Object.assign(new Error('platform login is required'), {
      code: 'ENT_AUTH_REQUIRED',
      httpStatus: 401,
    }))
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}`)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'ENT_AUTH_REQUIRED' } })
    const [message] = onError.mock.calls[0]!
    expect(message).toContain(`operation=GET ${ENTERPRISE_SKILL_LOCAL_PATH}`)
    expect(message).toContain('step=upstream-unauthorized')
  })

  it('上游异常投影 503 并留 warn 判定点，保留受控上游码', async () => {
    request.mockRejectedValueOnce(Object.assign(new Error('not visible'), {
      code: 'ENT_SKILL_VISIBILITY_DENIED',
      httpStatus: 403,
    }))
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_SKILL_VISIBILITY_DENIED' } })
    const [message] = onError.mock.calls[0]!
    expect(message).toContain('step=upstream-failed')
  })

  it('上游 200 但信封畸形时投影 503，不把 requestId 或任意正文写出', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: 'req_1' }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }))
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
  })

  it('上游返回非 2xx 但未抛异常时按状态码投影', async () => {
    request.mockResolvedValueOnce(new Response('{"error":{"code":"ENT_AUTH_REQUIRED"}}', { status: 401 }))
    expect((await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}`)).status).toBe(401)
    request.mockResolvedValueOnce(new Response('{"error":{"code":"ENT_PLATFORM_UNAVAILABLE"}}', { status: 503 }))
    const failed = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/1902500000000000001`)
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
  })

  it('非 GET 一律 405 并声明 Allow，且不触发任何取数', async () => {
    for (const path of [ENTERPRISE_SKILL_LOCAL_PATH, `${ENTERPRISE_SKILL_LOCAL_PATH}/1902500000000000001`]) {
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const response = await fetch(`${baseUrl}${path}`, { method })
        expect(response.status, `${method} ${path}`).toBe(405)
        expect(response.headers.get('allow')).toBe('GET')
        expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
      }
    }
    expect(request).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
