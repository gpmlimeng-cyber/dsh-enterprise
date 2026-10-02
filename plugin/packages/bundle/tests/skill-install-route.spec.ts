/**
 * [INPUT]: 依赖 platform-client 的真实本地路由注册器 `registerEnterpriseLocalApi` 与 route 形状、`src/skill-route.ts` 的只读镜像、`src/skill-install.ts` 的真实安装端口、`tests/zip-fixture.ts` 的 ZIP 构造器与 `tests/engine-route-match.ts` 的引擎语义匹配器
 * [OUTPUT]: 在真实 Node HTTP 上把「platform-client 的三条 `/skills/*` exact 动作路由 + bundle 的 `/skills` exact 列表 / `/skills/{id}` prefix 详情 + 真实下载校验解包落盘」串成一条链，锁定安装 200、已装态 200、卸载 200、非法入参 400、非 POST 405、以及 `/skills/{packageId}` 详情仍归 prefix 不被 exact 抢走
 * [POS]: bundle 技能纵深的**跨包集成门禁**——这是不重启 DSH 能拿到的最强证据：单测各包都绿仍可能因为路由形状在引擎语义下互抢而线上 404，这里用引擎语义分发 + 真 HTTP + 真磁盘把那条缝堵上
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  registerEnterpriseLocalApi,
  type EnterpriseLocalPlatformPort,
  type EnterprisePlatformStatus,
  type WebServerRoutePort,
} from '@dshent/platform-client'
import { createEnterpriseSkillInstall } from '../src/skill-install.js'
import { registerEnterpriseSkillRoutes } from '../src/skill-route.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { buildZip } from './zip-fixture.js'

const PACKAGE_ID = '1902500000000000001'
const VERSION_ID = '1902500000000000101'
const LIST_PATH = '/enterprise/api/v1/skills'
/** 非法包 id 的形状（与 `src/skill-route.ts` 的雪花正则同源）。 */
const NOT_A_PACKAGE_ID = 'code-review'
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skill-route-'))
  homes.push(path)
  return path
}

describe('enterprise skill install over the real local API', () => {
  it('installs, reports and uninstalls a skill package through the same-origin routes', async () => {
    const dshHome = await makeHome()
    const archive = buildZip([
      { path: 'manifest.json', content: JSON.stringify({ format: 'dsh-skill', version: 1, id: 'meeting-pkg', name: '会议纪要技能组' }) },
      { path: 'skills/meeting-notes/SKILL.md', content: '---\nname: meeting-notes\ndescription: 整理会议纪要\n---\n正文\n' },
    ])
    const detail = {
      data: {
        id: PACKAGE_ID,
        skillId: 'meeting-pkg',
        displayName: '会议纪要技能组',
        description: '把会议录音与转写整理成结构化纪要。',
        sourceDshVersion: '0.2.0-rc.2',
        sizeBytes: archive.byteLength,
        skillCount: 1,
        updatedAt: '2026-09-30T08:00:00Z',
        versionId: VERSION_ID,
        sha256: createHash('sha256').update(archive).digest('hex'),
        skills: [{ name: 'meeting-notes', description: '整理会议纪要', modelInvocable: true, userInvocable: true }],
      },
      requestId: 'req_789ABCDEFGHJKMNPQRSTVWXYZ0',
    }
    // 平台面：中心详情与授权下载都由它代取（浏览器永远看不到这条令牌）。
    const platformRequest = vi.fn(async (input: string): Promise<Response> => {
      if (input.startsWith(`${LIST_PATH}/versions/`)) return new Response(archive)
      if (input === `${LIST_PATH}/${PACKAGE_ID}`) {
        return new Response(JSON.stringify(detail), { headers: { 'content-type': 'application/json' } })
      }
      return new Response('not found', { status: 404 })
    })
    const platform: EnterpriseLocalPlatformPort = {
      status: (): EnterprisePlatformStatus => ({
        state: 'READY', bundleVersion: '0.1.0', platformUrl: 'https://enterprise.example.com', transport: 'webServer.register',
      }),
      refresh: async () => platform.status(),
      setServerUrl: async serverUrl => ({ serverUrl }),
      startLogin: async () => ({ flowId: 'flow-1' }),
      loginForm: () => ({ transactionId: 'tx-1', sources: [] }),
      submitCredentials: async () => ({ state: 'authenticated' }),
      submitPasswordChange: async () => ({ state: 'authenticated' }),
      cancelLogin: () => true,
      logout: async () => undefined,
      bootstrap: () => undefined,
      listPresets: async () => [],
      getPreset: async () => ({ id: '1' }),
    }
    const skillInstall = createEnterpriseSkillInstall({
      platform: { request: (input, init) => platformRequest(input, init as RequestInit | undefined) },
      dshHome,
      now: () => new Date('2026-10-02T00:00:00.000Z'),
    })

    // 与真实 Host 装配同形：platform-client 注册本地 API（含三条技能动作），bundle 注册技能只读镜像。
    const routes: RegisteredRoute[] = []
    const registered = new Map<string, () => void>()
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (route) => {
        const key = `${route.kind}:${route.path}`
        if (registered.has(key)) throw new Error(`duplicate route ${key}`)
        routes.push(route)
        const dispose = (): void => {
          registered.delete(key)
          routes.splice(routes.indexOf(route), 1)
        }
        registered.set(key, dispose)
        return dispose
      },
    }
    const disposeLocal = registerEnterpriseLocalApi(webServer, {
      platform,
      pluginStatus: () => ({ assignmentRevision: 0, plugins: [] }),
      skillStatus: () => skillInstall.status(),
      skillAction: (action, packageId) => skillInstall.action(action, packageId),
    })
    const disposeSkills = registerEnterpriseSkillRoutes(webServer, { request: platformRequest })

    const server: Server = createServer((request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      const route = engineRouteMatch(routes, pathname)
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(request, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const get = (path: string) => fetch(`${baseUrl}/enterprise/api/v1/local${path}`)
      const post = (path: string, body: unknown) => fetch(`${baseUrl}/enterprise/api/v1/local${path}`, {
        body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method: 'POST',
      })

      // 1) 未装：单键 {data} 信封里是空清单。
      await expect((await get('/skills/installed')).json()).resolves.toEqual({ data: { skills: [] } })

      // 2) 一键安装：真 HTTP → 真端口 → 真下载校验 → 真解包 → 真落盘。
      const installed = await post('/skills/install', { packageId: PACKAGE_ID })
      expect(installed.status).toBe(200)
      const installedBody = await installed.json() as { data: { skills: { packageId: string, names: string[], installedAt: string }[] } }
      expect(installedBody.data.skills).toEqual([
        expect.objectContaining({ packageId: PACKAGE_ID, names: ['meeting-notes'], installedAt: '2026-10-02T00:00:00.000Z' }),
      ])
      expect(await readFile(join(dshHome, 'skills', 'meeting-notes', 'SKILL.md'), 'utf8')).toContain('name: meeting-notes')
      // 落点必须是官方 user-dsh 根：`<dshHome>/skills`（rank 400），而不是某个企业私有目录。
      expect((await stat(join(dshHome, 'skills'))).isDirectory()).toBe(true)

      // 3) 已装态：与安装响应同一份真值。
      await expect((await get('/skills/installed')).json()).resolves.toEqual({ data: installedBody.data })

      // 4) 详情 prefix 仍可达（`/skills/<雪花 id>` 不被三条 exact 抢走），且非法包 id 本地 400、零上游。
      const upstreamBefore = platformRequest.mock.calls.length
      const detailResponse = await get(`/skills/${PACKAGE_ID}`)
      expect(detailResponse.status).toBe(200)
      await expect(detailResponse.json()).resolves.toEqual({ data: detail.data })
      expect(platformRequest.mock.calls.length).toBe(upstreamBefore + 1)
      expect((await get(`/skills/${NOT_A_PACKAGE_ID}`)).status).toBe(400)
      expect(platformRequest.mock.calls.length).toBe(upstreamBefore + 1)

      // 5) 入参门禁与 405：动作只认 POST + 单键雪花朵。
      expect((await post('/skills/install', { packageId: NOT_A_PACKAGE_ID })).status).toBe(400)
      expect((await post('/skills/install', { packageId: PACKAGE_ID, extra: true })).status).toBe(400)
      const wrongMethod = await fetch(`${baseUrl}/enterprise/api/v1/local/skills/install`, { method: 'GET' })
      expect(wrongMethod.status).toBe(405)
      expect(wrongMethod.headers.get('allow')).toBe('POST')

      // 6) 卸载：磁盘清掉、清单回空，重复卸载报 404 稳定码。
      await expect((await post('/skills/uninstall', { packageId: PACKAGE_ID })).json()).resolves.toEqual({ data: { skills: [] } })
      await expect(stat(join(dshHome, 'skills', 'meeting-notes'))).rejects.toMatchObject({ code: 'ENOENT' })
      const again = await post('/skills/uninstall', { packageId: PACKAGE_ID })
      expect(again.status).toBe(404)
      await expect(again.json()).resolves.toEqual({ error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
      disposeSkills()
      disposeLocal()
    }
  })
})
