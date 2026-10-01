/**
 * [INPUT]: 依赖 `src/skill-route.ts` 的路由注册器与投影纯函数、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定企业技能目录本地只读路由的列表/详情 200 透传、非法包 id 本地 400、401/503 投影、405、以及 `versions/` 下载路径不被当作包 id
 * [POS]: bundle 的技能取数回归门禁；有人漏注册详情路由、把上游正文原样写出、把 401 折成 503，或让 `/versions/...` 误撞详情路由，本文件都会红
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

describe('GET /enterprise/api/v1/local/skills', () => {
  let server: Server
  let baseUrl: string
  let routes: RegisteredRoute[]
  let request: Mock<(input: string, init?: RequestInit) => Promise<Response>>
  let onError: Mock<(message: string, error: unknown) => void>

  function dispatch(incoming: IncomingMessage, response: ServerResponse): void {
    const pathname = (incoming.url ?? '').split('?')[0] ?? ''
    const exact = routes.find(route => route.kind === 'exact' && route.path === pathname)
    const prefixed = routes
      .filter(route => route.kind === 'prefix' && pathname.startsWith(route.path))
      .sort((left, right) => right.path.length - left.path.length)[0]
    const route = exact ?? prefixed
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
    expect(routes.map(route => `${route.kind} ${route.path}`).sort())
      .toEqual(['exact /enterprise/api/v1/local/skills', 'prefix /enterprise/api/v1/local/skills/'])
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
