/**
 * [INPUT]: 依赖 `src/skill-discovery.ts` 的路由注册器与两枚纯投影/形状常量、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定口径 54 的本机官方发现面路由——逐键白名单（`path`/`resourceBase` **不在**）、服务缺席/快照抛错/快照读不懂三类失败都回**明确失败码且绝不当空列表**、非 GET 405、只读不碰 SKILL.md 正文、以及「浏览器拿不到宿主绝对路径」这条泄漏面
 * [POS]: bundle 的技能发现取数回归门禁；有人把官方快照原样写出（`deepEqual(input)` 那一格会当场红）、把服务缺席折成 200+空列表、或把 `complete` 当 0 处理，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_DISCOVERED_OPTIONAL_KEYS,
  ENTERPRISE_DISCOVERED_SKILL_KEYS,
  ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH,
  ENT_SKILL_DISCOVERY_UNAVAILABLE,
  projectDiscoveredSkills,
  projectSkillDiscoveryFailure,
  registerEnterpriseSkillDiscoveryRoute,
  type EnterpriseSkillDiscoveryPort,
  type EnterpriseSkillSnapshotPort,
} from '../src/skill-discovery.js'

/**
 * 官方 `skills.snapshot()` 的真实形状（宿主契约逐字）——**含**我们不许出厂的两格：
 * `path`（宿主绝对路径）与 `resourceBase`（`{kind:'directory',path}` 更是一枚绝对路径）。
 * 这份夹具故意带上它们：本刀要证的不是"我们没写这两格"，而是"它们进不了响应体"。
 */
const HOST_PATH = '/Users/somebody/.dsh/skills'
const SNAPSHOT = {
  complete: true,
  skills: [
    {
      path: `${HOST_PATH}/agent-manager`,
      name: 'agent-manager',
      description: '把子代理管起来',
      whenToUse: '需要多代理协作时',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'user-dsh',
      provider: 'skill-filesystem',
      resourceBase: { kind: 'directory', path: `${HOST_PATH}/agent-manager` },
    },
    {
      path: `${HOST_PATH}/skill-creator`,
      name: 'skill-creator',
      description: '写技能',
      invocation: { modelInvocable: false, userInvocable: true },
      source: 'bundled',
      provider: 'skill-filesystem',
      resourceBase: { kind: 'directory', path: `${HOST_PATH}/skill-creator` },
    },
  ],
}

const ENVELOPE_KEYS = ['skills', 'complete']

describe('skill discovery projection', () => {
  it('只留白名单字段：逐键集合断言，且 path / resourceBase 不在里面', () => {
    const projected = projectDiscoveredSkills(SNAPSHOT)
    expect(Object.keys(projected)).toEqual(ENVELOPE_KEYS)
    expect(projected.complete).toBe(true)
    expect(projected.skills).toHaveLength(2)
    for (const each of projected.skills) {
      // ★逐键**集合**断言（不是"包含"）：多一格少一格都红。可选那一格缺席是**合法**的
      //   （"官方没说 whenToUse"与"官方说了空串"是两件事），故判据是**两枚允许的集合二选一**。
      const keys = new Set(Object.keys(each))
      expect(
        [
          ENTERPRISE_DISCOVERED_SKILL_KEYS.length,
          ENTERPRISE_DISCOVERED_SKILL_KEYS.length + ENTERPRISE_DISCOVERED_OPTIONAL_KEYS.length,
        ],
        '键数只能是白名单或白名单+可选',
      ).toContain(keys.size)
      for (const key of ENTERPRISE_DISCOVERED_SKILL_KEYS) expect(keys.has(key), key).toBe(true)
      for (const key of keys) {
        expect([...ENTERPRISE_DISCOVERED_SKILL_KEYS, ...ENTERPRISE_DISCOVERED_OPTIONAL_KEYS], key).toContain(key)
      }
      // ★泄漏面的两枚反向锁（`resourceBase.path` 与 `path` 都不许出现）。
      expect('path' in each).toBe(false)
      expect('resourceBase' in each).toBe(false)
    }
    // ① `whenToUse` 真的非空 ⇒ 出厂；② 缺席 ⇒ **不给这个键**（不编空串）。
    expect(projected.skills[0]).toEqual({
      name: 'agent-manager',
      description: '把子代理管起来',
      whenToUse: '需要多代理协作时',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'user-dsh',
      provider: 'skill-filesystem',
    })
    expect('whenToUse' in projected.skills[1]!).toBe(false)
    expect(projected.skills[1]!.invocation).toEqual({ modelInvocable: false, userInvocable: true })
    // ★来源标注的**唯一**依据就是 `source` 这一枚（不是路径）：它必须逐字出厂。
    expect(projected.skills.map(each => each.source)).toEqual(['user-dsh', 'bundled'])
  })

  it('整条响应体里一个宿主绝对路径字节都没有（含嵌套）', () => {
    const serialized = JSON.stringify(projectDiscoveredSkills(SNAPSHOT))
    expect(serialized).not.toContain(HOST_PATH)
    expect(serialized).not.toContain('/Users/')
    expect(serialized).not.toContain('directory')
  })

  it('空列表是合法结果（磁盘真的一枚都没有），与"读不到"泾渭分明', () => {
    expect(projectDiscoveredSkills({ skills: [], complete: true })).toEqual({ skills: [], complete: true })
  })

  it('快照读不懂 ⇒ 抛（绝不静默折成空列表）', () => {
    for (const bad of [
      null,
      [],
      'skills',
      {},
      { skills: [] },
      { skills: 'none', complete: true },
      { skills: [], complete: 'yes' },
      { skills: [null], complete: true },
      { skills: [{ description: 'x', invocation: { modelInvocable: true, userInvocable: true }, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: '', description: 'x', invocation: { modelInvocable: true, userInvocable: true }, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: 'a', description: 'x', invocation: { modelInvocable: true }, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: 'a', description: 'x', invocation: null, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: 'a', description: 'x', invocation: { modelInvocable: true, userInvocable: true }, source: 7, provider: 'b' }], complete: true },
    ]) {
      // 判据落在**抛出的码**上（`toThrow(串)` 匹的是 message，这里要的是稳定码本身）。
      let caught: unknown
      try {
        projectDiscoveredSkills(bad)
      } catch (error) {
        caught = error
      }
      expect(caught, JSON.stringify(bad)).toBeInstanceOf(Error)
      expect((caught as { readonly code?: string }).code, JSON.stringify(bad)).toBe(ENT_SKILL_DISCOVERY_UNAVAILABLE)
    }
  })

  it('失败投影：三枚都收在同一枚码上、状态码走唯一那张表（503）', () => {
    expect(projectSkillDiscoveryFailure(new Error('boom')))
      .toEqual({ status: 503, code: ENT_SKILL_DISCOVERY_UNAVAILABLE, step: 'snapshot-failed' })
    // 官方自己带受控码时**原样**透出（那是它的事实），状态码仍走同一张表。
    expect(projectSkillDiscoveryFailure(Object.assign(new Error('x'), { code: 'ENT_AUTH_REQUIRED' })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'snapshot-failed' })
    // 非法形状的码一律回落本面稳定码，绝不复述任意字符串。
    expect(projectSkillDiscoveryFailure(Object.assign(new Error('x'), { code: 'not a code' })).code)
      .toBe(ENT_SKILL_DISCOVERY_UNAVAILABLE)
  })
})

describe('GET /enterprise/api/v1/local/skills/discovered', () => {
  let server: Server
  let baseUrl: string
  let route: Parameters<WebServerRoutePort['register']>[0] | undefined
  let snapshot: Mock<(options: { readonly signal?: AbortSignal }) => Promise<unknown>>
  let service: EnterpriseSkillSnapshotPort | undefined
  let onError: Mock<(message: string, error: unknown) => void>

  const wire = (port: EnterpriseSkillDiscoveryPort | undefined): void => {
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        route = registered
        return () => { route = undefined }
      },
    }
    registerEnterpriseSkillDiscoveryRoute(webServer, port, onError)
  }

  beforeEach(async () => {
    route = undefined
    snapshot = vi.fn<(options: { readonly signal?: AbortSignal }) => Promise<unknown>>(async () => SNAPSHOT)
    service = { snapshot }
    onError = vi.fn<(message: string, error: unknown) => void>()
    // ★端口形状与组合层逐字同款：**每次调用现场解引用**（服务晚就绪也照常可用）。
    wire({ discover: () => service })
    server = createServer((incoming, response) => {
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(incoming, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('GET 200：`{data:{skills,complete}}`，逐键白名单、无宿主路径、只打一次快照', async () => {
    expect(ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/discovered')
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: unknown }
    expect(Object.keys(body)).toEqual(['data'])
    expect(Object.keys(body.data as object)).toEqual(ENVELOPE_KEYS)
    expect(body.data).toEqual(projectDiscoveredSkills(SNAPSHOT))
    // ★结构级泄漏锁：整份响应正文里不许出现宿主绝对路径，也不许与官方快照**逐字相等**
    //   （后者是最强的反向锁：`deepEqual(输入)` 一旦成立就说明我们把它原样写出去了）。
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(HOST_PATH)
    expect(serialized).not.toContain('resourceBase')
    expect(serialized).not.toEqual(JSON.stringify({ data: SNAPSHOT }))
    expect(snapshot).toHaveBeenCalledTimes(1)
    // ★只读、不读正文：快照调用**只**带 `{}`（不传路径、不传 scope、不读 SKILL.md）。
    expect(snapshot.mock.calls[0]![0]).toEqual({})
    expect(onError).not.toHaveBeenCalled()
  })

  it('`complete=false` 原样出厂（那是官方自己的交代，不许被我们折成 true 或 0）', async () => {
    snapshot.mockResolvedValueOnce({ skills: SNAPSHOT.skills.slice(0, 1), complete: false })
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: { readonly complete: boolean; readonly skills: readonly unknown[] } }
    expect(body.data.complete).toBe(false)
    expect(body.data.skills).toHaveLength(1)
  })

  it('★服务缺席（老宿主没有 skills 服务）⇒ 明确失败码 503，**绝不空列表**', async () => {
    service = undefined
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    // 反向锁：这一态**没有**打过快照，也**没有**任何 200。
    expect(snapshot).not.toHaveBeenCalled()
    const [message] = onError.mock.calls[0]!
    expect(message).toContain(`operation=GET ${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(message).toContain('step=service-absent')
    expect(message).toContain('status=503')
  })

  it('组合层整个没接线（端口缺席）⇒ 同一枚码，不是 404、不是 200+空', async () => {
    wire(undefined)
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
  })

  it('★snapshot 抛错 ⇒ 明确失败码 503，**绝不空列表**', async () => {
    snapshot.mockRejectedValueOnce(new Error('scan exploded'))
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    const [message, error] = onError.mock.calls[0]!
    expect(message).toContain('step=snapshot-failed')
    expect(message).toContain('scan exploded')
    expect(error).toBeInstanceOf(Error)
  })

  it('★快照读不懂 ⇒ 明确失败码 503（不是 200+空列表）', async () => {
    snapshot.mockResolvedValueOnce({ skills: 'nope', complete: true })
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
  })

  it('非 GET 一律 405 + Allow: GET，且不触发任何快照', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow')).toBe('GET')
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(snapshot).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
