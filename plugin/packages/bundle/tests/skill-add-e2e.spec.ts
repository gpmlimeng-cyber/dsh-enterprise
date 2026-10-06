/**
 * [INPUT]: 依赖 **真的** `@dshent/platform-client` 的 `registerEnterpriseLocalApi`（workspace 链接 ⇒ 解析到该包 `lib/`，与生产同一份构建产物；跑前需先 `tsc -p` 出 lib）、**真的** bundle 端口实现（`src/skill-upload.ts`/`skill-system.ts`/`skill-online.ts`）、**真的** bundle 详情 prefix 注册面（`src/skill-route.ts`）、同目录 `engine-route-match.ts`（引擎语义分发）与 `zip-fixture.ts`（ZIP 构造器），以及 node:http/fetch/fs/crypto
 * [OUTPUT]: 本仓**唯一**的跨包端到端链路：真 Node HTTP + 真路由注册面（pc 的 exact 表 + bundle 的 prefix 表同处一张路由数组）+ 真端口函数 + 真临时 dshHome 上跑完「本地上传 / 系统搜索 + 纳入 / fail-closed 三条 / 负路径四条」，另有一条 `DSHENT_ONLINE_SMOKE=1` 的 opt-in 外网段（默认 skip）；并提供 `DSHENT_E2E_KEEP_HOME=<绝对路径>` 供 Lead 在测试之外复核盘上结果
 * [POS]: 补上「路由层 + 假端口」与「端口函数 + 假路由」两类既有测试之间的那条缝——刀 3a/3b/3d 新增的六条 exact 子路径全靠「exact 抢在 `/skills` prefix 之前」+「multipart 由路由层有界读取后交给 bundle」+「组合层端口一一对应」，任何一条错界面就是死的，而旧测试全测不出来；本文件**不退化成假件**：路由用真注册器、端口用真实现、落盘用真文件系统，只有「平台面」与「在线取数面」按契约注入（默认段用会抛错的桩，确保默认门禁一次都不打网）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ENTERPRISE_SKILL_ADOPT_LOCAL_PATH,
  ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH,
  ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH,
  ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH,
  ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH,
  ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH,
  registerEnterpriseLocalApi,
  type EnterpriseLocalPlatformPort,
  type WebServerRoutePort,
} from '@dshent/platform-client'
import { installedSkillStatus, type EnterpriseSkillInstallOptions } from '../src/skill-install.js'
import { registerEnterpriseSkillRoutes } from '../src/skill-route.js'
import { adoptSystemSkill, discoverSystemSkills } from '../src/skill-system.js'
import { installSkillFromResult, searchOnlineSkills, type EnterpriseOnlineSkillSearch } from '../src/skill-online.js'
import { installedSelfSkills, uploadSkillArchive } from '../src/skill-upload.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { buildZip, type ZipFixtureEntry } from './zip-fixture.js'

const NOW = '2026-10-05T00:00:00.000Z'
const ONLINE = process.env['DSHENT_ONLINE_SMOKE'] === '1'
const KEEP_HOME = process.env['DSHENT_E2E_KEEP_HOME']
const MAX_SKILL_UPLOAD_BODY_BYTES = 52_428_800
const installedNames = new Map<string, string>()

/* ────────────────────────── dshHome（真临时目录 / 可留档） ────────────────────────── */

/**
 * 一个 describe 一个 dshHome：**跨用例共享**（链路 1 装的东西就是链路 2 要盘点的东西），
 * 所以清理只能在 `afterAll`、绝不能在 `afterEach` 里做。
 */
async function resolveHome(): Promise<{ readonly path: string, readonly temporary: boolean }> {
  if (KEEP_HOME !== undefined && KEEP_HOME.startsWith('/')) {
    await mkdir(KEEP_HOME, { recursive: true, mode: 0o700 })
    return { path: KEEP_HOME, temporary: false }
  }
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  return { path: await mkdtemp(join(root, 'dshent-skill-add-e2e-')), temporary: true }
}

/* ────────────────────────── 真服务：pc exact 表 + bundle prefix 表 ────────────────────────── */

/** 平台面桩：默认链一次都不该碰它（碰了就是接线错了，直接红）。 */
function forbiddenPlatform(): { request: (input: string, init?: RequestInit) => Promise<Response> } {
  return {
    request: async () => {
      throw new Error('the skill-add e2e default path must never call the enterprise platform port')
    },
  }
}

/** 在线取数面：默认段用会抛错的桩（保证默认门禁一次都不打网），opt-in 段才是真 `fetch`。 */
function onlineFetch(): (input: string, init?: RequestInit) => Promise<Response> {
  if (!ONLINE) {
    return async () => {
      throw new Error('the default e2e run must never touch the network (set DSHENT_ONLINE_SMOKE=1 to opt in)')
    }
  }
  return async (input, init) => await fetch(input, init)
}

/** pc 的本地路由注册器需要的平台端口（默认链只用到它的形状，不会真发请求）。 */
function localPlatformStub(reject: (message: string) => never): EnterpriseLocalPlatformPort {
  return {
    status: () => ({ state: 'SIGNED_OUT', bundleVersion: '0.1.0', platformUrl: 'https://enterprise.example.com', transport: 'webServer.register' }),
    refresh: async () => reject('refresh'),
    setServerUrl: async serverUrl => ({ serverUrl }),
    startLogin: async () => reject('startLogin'),
    cancelLogin: () => true,
    logout: async () => reject('logout'),
    bootstrap: () => undefined,
    listPresets: async () => [],
    getPreset: async () => reject('getPreset'),
  } as unknown as EnterpriseLocalPlatformPort
}

interface Harness {
  readonly home: string
  readonly baseUrl: string
  readonly routes: readonly RegisteredRoute[]
  /** 端口函数被调用的次序（证明「真端口」真的被路由层调到、且负路径没进端口）。 */
  readonly calls: string[]
  /** 路由层留痕（错误投影的观测口）。 */
  readonly failures: { readonly operation: string, readonly status: number }[]
  readonly skillOptions: EnterpriseSkillInstallOptions
  close(): Promise<void>
}

async function startHarness(home: string): Promise<Harness> {
  let routes: RegisteredRoute[] = []
  const calls: string[] = []
  const failures: { operation: string, status: number }[] = []
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
  const skillOptions: EnterpriseSkillInstallOptions = {
    platform: forbiddenPlatform(),
    dshHome: home,
    now: () => new Date(NOW),
  }
  const onlineOptions = { fetch: onlineFetch(), dshHome: home, now: () => new Date(NOW) }
  /** 真实现 + 一层只用于观测的计数（不做任何替换或伪造）。 */
  const counted = <A extends readonly unknown[], R>(name: string, fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      calls.push(name)
      return await fn(...args)
    }
  registerEnterpriseLocalApi(webServer, {
    platform: localPlatformStub(message => {
      throw new Error(`the e2e platform stub must not be used (${message})`)
    }),
    pluginStatus: () => ({ assignmentRevision: 0, plugins: [] }),
    skillUpload: counted('upload', (body: Buffer, boundary: string) => uploadSkillArchive(skillOptions, body, boundary)),
    skillSelfInstalled: counted('self-installed', async () => await installedSelfSkills(skillOptions)),
    skillSystemSearch: counted('system-search', async () => await discoverSystemSkills(skillOptions)),
    skillAdopt: counted('adopt', async (path: string) => await adoptSystemSkill(skillOptions, path)),
    skillOnlineSearch: counted('online-search', async (query: string) => await searchOnlineSkills(onlineOptions, query)),
    skillInstallFromResult: counted('install-from-result', async (source: string) => await installSkillFromResult(onlineOptions, source)),
    onError: (operation: string, _error: unknown, status: number) => {
      failures.push({ operation, status })
    },
  })
  // bundle 的详情 prefix 也注册进**同一张路由数组**：exact 与 prefix 在真分发里相遇，这才是本任务要验的那条缝。
  registerEnterpriseSkillRoutes(webServer, forbiddenPlatform(), undefined, {
    files: async () => {
      throw new Error('the e2e detail routes are only registered to make the exact-vs-prefix seam real')
    },
    file: async () => {
      throw new Error('the e2e detail routes are only registered to make the exact-vs-prefix seam real')
    },
  })

  const server = createServer((incoming: IncomingMessage, response: ServerResponse) => {
    const pathname = (incoming.url ?? '').split('?')[0] ?? ''
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(incoming, response))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing e2e port')
  return {
    home,
    baseUrl: `http://127.0.0.1:${address.port}`,
    get routes() { return routes },
    calls,
    failures,
    skillOptions,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}

/* ────────────────────────── 制品与请求夹具 ────────────────────────── */

const SKILL_NAME = 'e2e-team-notes'

/** 真 `.dshskill`：根 `manifest.json` + `skills/<name>/SKILL.md` + **资源文件**（含非 ASCII 字节）。 */
function skillArchiveBytes(markdown: string, resource: string): { readonly bytes: Buffer, readonly markdown: Buffer, readonly resource: Buffer } {
  const markdownBytes = Buffer.from(markdown, 'utf8')
  const resourceBytes = Buffer.from(resource, 'utf8')
  const entries: ZipFixtureEntry[] = [
    {
      path: 'manifest.json',
      content: JSON.stringify({ format: 'dsh-skill', version: '1', id: SKILL_NAME, name: 'E2E 会议纪要', sourceDshVersion: '0.2.0-rc.2' }),
    },
    { path: `skills/${SKILL_NAME}/SKILL.md`, content: markdownBytes },
    { path: `skills/${SKILL_NAME}/references/guide.md`, content: resourceBytes },
  ]
  return { bytes: buildZip(entries), markdown: markdownBytes, resource: resourceBytes }
}

/** 真 multipart 正文（字段名恰好 `artifact`，与浏览器 `FormData` 的分帧同形）。 */
function multipart(boundary: string, parts: readonly { readonly name: string, readonly filename?: string, readonly data: Buffer }[]): Buffer {
  const chunks: Buffer[] = []
  for (const part of parts) {
    const disposition = `form-data; name="${part.name}"` + (part.filename === undefined ? '' : `; filename="${part.filename}"`)
    chunks.push(Buffer.from(`--${boundary}\r\ncontent-disposition: ${disposition}\r\ncontent-type: application/octet-stream\r\n\r\n`, 'utf8'))
    chunks.push(part.data)
    chunks.push(Buffer.from('\r\n', 'utf8'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'))
  return Buffer.concat(chunks)
}

function uploadBody(bytes: Buffer, boundary = '----dshentE2EBoundary'): Buffer {
  return multipart(boundary, [{ name: 'artifact', filename: 'team-notes.dshskill', data: bytes }])
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** 递归快照：相对路径 → 内容 sha256（用来证明「一个字节都没变」）。 */
async function treeSnapshot(root: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {}
  const walk = async (directory: string, prefix: string): Promise<void> => {
    const entries = [...await readdir(directory, { withFileTypes: true })]
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    for (const entry of entries) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute, relative)
        continue
      }
      snapshot[relative] = createHash('sha256').update(await readFile(absolute)).digest('hex')
    }
  }
  await walk(root, '')
  return snapshot
}

async function writeAdoptableSkill(root: string, directory: string, frontmatter: string): Promise<string> {
  const path = join(root, directory)
  await mkdir(path, { recursive: true, mode: 0o700 })
  await writeFile(join(path, 'SKILL.md'), `---\n${frontmatter}\n---\n正文\n`, { encoding: 'utf8', mode: 0o600 })
  await writeFile(join(path, 'notes.txt'), '资源\n', { encoding: 'utf8', mode: 0o600 })
  return path
}

/* ────────────────────────── 默认链（一次不打网） ────────────────────────── */

describe('skill add end-to-end: real routes → real ports → real disk', () => {
  let home: string
  let temporary = false
  let harness: Harness
  let archive: ReturnType<typeof skillArchiveBytes>

  beforeAll(async () => {
    const resolved = await resolveHome()
    home = resolved.path
    temporary = resolved.temporary
    harness = await startHarness(home)
    archive = skillArchiveBytes(
      `---\nname: ${SKILL_NAME}\ndescription: E2E 会议纪要技能\n---\n# 正文\n`,
      '# 参考资料\n\n- 第一项\n- 第二项（含非 ASCII：中文与 emoji ✅）\n',
    )
  })

  afterAll(async () => {
    if (harness !== undefined) await harness.close()
    if (temporary) await rm(home, { force: true, recursive: true })
    // 可复制摘要（不含任何凭据；本任务本来也没有）。
    console.log('[skill-add-e2e] summary '
      + JSON.stringify({
        dshHome: home,
        keepHome: KEEP_HOME ?? null,
        onlineSmoke: ONLINE,
        installed: [...installedNames.entries()].map(([name, sha256]) => ({ name, sha256 })),
        baseUrl: harness?.baseUrl ?? null,
      }))
  })

  it('carries a real multipart .dshskill from the real upload route to real bytes on disk', async () => {
    const boundary = '----dshentE2EBoundary'
    const response = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH}`, {
      body: uploadBody(archive.bytes, boundary),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      method: 'POST',
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { data: unknown }
    // ① 响应 `data` 与 `POST /skills/install` 同形 —— 这里直接与**真端口函数**的返回值逐字比对。
    expect(body.data).toEqual(await installedSkillStatus(harness.skillOptions))
    expect(body.data).toEqual({ skills: [] })
    expect(harness.calls).toEqual(['upload'])

    // ② 盘上字节与包内字节**逐字节**相同（含资源文件与非 ASCII）。
    expect(await readFile(join(home, 'skills', SKILL_NAME, 'SKILL.md'))).toEqual(archive.markdown)
    expect(await readFile(join(home, 'skills', SKILL_NAME, 'references', 'guide.md'))).toEqual(archive.resource)
    expect((await stat(join(home, 'skills', SKILL_NAME, 'SKILL.md'))).mode & 0o777).toBe(0o600)

    // ③ `GET /skills/self-installed`（真路由 → 真端口 → 真状态文件）能读到它。
    const selfInstalled = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH}`)
    expect(selfInstalled.status).toBe(200)
    const payload = await selfInstalled.json() as { data: { skills: Record<string, unknown>[] } }
    expect(payload.data.skills).toHaveLength(1)
    expect(payload.data.skills[0]).toMatchObject({
      skillId: SKILL_NAME,
      names: [SKILL_NAME],
      sourceType: 'upload',
      sourceInput: 'team-notes.dshskill',
    })
    expect(payload.data.skills[0]!['sha256']).toMatch(/^[0-9a-f]{64}$/)
    installedNames.set(SKILL_NAME, String(payload.data.skills[0]!['sha256']))
    expect(harness.calls).toEqual(['upload', 'self-installed'])
  })

  it('keeps every one of the six exact sub-paths ahead of the /skills detail prefix', async () => {
    // 真注册面：六条 exact + bundle 的详情 prefix 同处一张数组。
    const shapes = harness.routes.map(route => `${route.kind} ${route.path}`)
    for (const path of [
      ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH,
      ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH,
      ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH,
      ENTERPRISE_SKILL_ADOPT_LOCAL_PATH,
      ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH,
      ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH,
    ]) {
      expect(shapes).toContain(`exact ${path}`)
      expect(engineRouteMatch(harness.routes, path)?.kind).toBe('exact')
    }
    // 裸路径由 bundle 的**列表 exact** 拿走（它的注册面本来就是 exact + prefix 两条）；
    // prefix 那条要拿一个没有 exact 认领的子路径来验 —— 这正是详情路由的形状。
    expect(engineRouteMatch(harness.routes, '/enterprise/api/v1/local/skills')?.kind).toBe('exact')
    expect(engineRouteMatch(harness.routes, '/enterprise/api/v1/local/skills/1902500000000000001')?.kind).toBe('prefix')

    // 反证（在**真 HTTP** 上做）：只注册 bundle 的详情 prefix 时，同一个路径确实会被当成包 id 判 400。
    const prefixOnlyRoutes: RegisteredRoute[] = []
    const prefixOnly = createServer((incoming, response) => {
      const pathname = (incoming.url ?? '').split('?')[0] ?? ''
      const route = engineRouteMatch(prefixOnlyRoutes, pathname)
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(incoming, response))
    })
    const prefixOnlyWebServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        prefixOnlyRoutes.push(registered)
        return () => undefined
      },
    }
    registerEnterpriseSkillRoutes(prefixOnlyWebServer, forbiddenPlatform())
    await new Promise<void>(resolve => prefixOnly.listen(0, '127.0.0.1', resolve))
    try {
      const address = prefixOnly.address()
      if (address === null || typeof address === 'string') throw new Error('missing counterexample port')
      const prefixOnlyBase = `http://127.0.0.1:${address.port}`
      // 真服务器上：`GET /skills/upload` 由**exact** 接住 ⇒ 405（方法不对），**不是** 400 的「非法包 id」。
      const exactWins = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH}`)
      expect(exactWins.status).toBe(405)
      expect(exactWins.headers.get('allow')).toBe('POST')
      // 只有 bundle 的详情 prefix 时：同一个路径**确实**被当成包 id ⇒ 本地 400（界面直接死）。
      const swallowed = await fetch(`${prefixOnlyBase}${ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH}`)
      expect(swallowed.status).toBe(400)
      await expect(swallowed.json()).resolves.toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    } finally {
      await new Promise<void>(resolve => prefixOnly.close(() => resolve()))
    }
  })

  it('scans, adopts and re-scans a real skill directory through the real routes', async () => {
    const skillRoot = join(home, 'skills')
    const adopted = await writeAdoptableSkill(skillRoot, 'e2e-adopted', 'name: e2e-adopted\ndescription: 待纳入的技能')

    const before = await treeSnapshot(adopted)
    const discovery = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH}`)
    expect(discovery.status).toBe(200)
    const first = await discovery.json() as { data: { roots: { id: string, present: boolean }[], skills: { name: string, state: string }[] } }
    expect(first.data.roots).toEqual([{ id: 'user-dsh', path: skillRoot, present: true }])
    // 上面经真路由装进来的那条是 `registered`（自装记录认领），新目录是 `available`。
    expect(Object.fromEntries(first.data.skills.map(skill => [skill.name, skill.state]))).toEqual({
      [SKILL_NAME]: 'registered',
      'e2e-adopted': 'available',
    })

    const adoptedResponse = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_ADOPT_LOCAL_PATH}`, {
      body: JSON.stringify({ path: adopted }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(adoptedResponse.status).toBe(200)
    // ① 返回与 `GET /skills/self-installed` 同形（直接与那条真路由比对）。
    const adoptedBody = await adoptedResponse.json() as { data: unknown }
    const selfInstalled = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH}`)
    await expect(selfInstalled.json()).resolves.toEqual({ data: adoptedBody.data })

    // ② 该目录一个字节都没变（递归清单 + 每文件 sha256）。
    expect(await treeSnapshot(adopted)).toEqual(before)

    // ③ 再盘点那条变 `registered`。
    const second = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH}`)
    const after = await second.json() as { data: { skills: { name: string, state: string }[] } }
    expect(Object.fromEntries(after.data.skills.map(skill => [skill.name, skill.state])))
      .toEqual({ [SKILL_NAME]: 'registered', 'e2e-adopted': 'registered' })
  })

  it('projects the three fail-closed rejections through the real routes (never 500)', async () => {
    const skillRoot = join(home, 'skills')
    const post = (path: string, body: unknown) => fetch(`${harness.baseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    // ① 不在候选里 ⇒ 404。
    const unknown = await post(ENTERPRISE_SKILL_ADOPT_LOCAL_PATH, { path: join(skillRoot, 'not-a-skill') })
    expect(unknown.status).toBe(404)
    await expect(unknown.json()).resolves.toEqual({ error: { code: 'ENT_SKILL_DISCOVERY_UNKNOWN' } })

    // ② 已被认领 ⇒ 409。
    const registered = await post(ENTERPRISE_SKILL_ADOPT_LOCAL_PATH, { path: join(skillRoot, 'e2e-adopted') })
    expect(registered.status).toBe(409)
    await expect(registered.json()).resolves.toEqual({ error: { code: 'ENT_SKILL_ALREADY_REGISTERED' } })

    // ③ 折叠名冲突 ⇒ 409（`ENT_SKILL_NAME_CONFLICT`），不是 500。
    await writeAdoptableSkill(skillRoot, 'e2e-conflict-a', 'name: e2e-shared\ndescription: 甲')
    const conflicting = await writeAdoptableSkill(skillRoot, 'e2e-conflict-b', 'name: e2e-shared\ndescription: 乙')
    const conflict = await post(ENTERPRISE_SKILL_ADOPT_LOCAL_PATH, { path: conflicting })
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toEqual({ error: { code: 'ENT_SKILL_NAME_CONFLICT' } })
    expect(harness.failures.filter(item => item.status >= 500)).toEqual([])
  })

  it('rejects oversized, malformed and unknown-source requests at the real routes', async () => {
    // ① 声明超过 50 MiB 的 content-length ⇒ 413，且**读之前**就拒（端口一次都没进）。
    const callsBefore = [...harness.calls]
    const declared = await new Promise<{ status: number, body: string }>((resolve, reject) => {
      const target = new URL(`${harness.baseUrl}${ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH}`)
      const request = httpRequest({
        headers: {
          'content-type': 'multipart/form-data; boundary=----dshentE2EQuota',
          'content-length': String(MAX_SKILL_UPLOAD_BODY_BYTES + 1),
        },
        hostname: target.hostname,
        method: 'POST',
        path: target.pathname,
        port: target.port,
      }, response => {
        const chunks: Buffer[] = []
        response.on('data', chunk => chunks.push(chunk as Buffer))
        response.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), status: response.statusCode ?? 0 }))
      })
      request.on('error', reject)
      request.flushHeaders()
    })
    expect(declared.status).toBe(413)
    expect(JSON.parse(declared.body)).toEqual({ error: { code: 'ENT_SKILL_UPLOAD_TOO_LARGE' } })
    expect(harness.calls).toEqual(callsBefore)

    const post = (path: string, body: Buffer | string, boundary = '----dshentE2EBoundary') =>
      fetch(`${harness.baseUrl}${path}`, {
        body,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        method: 'POST',
      })

    // ② 非法 multipart：0 个 part / 2 个 part ⇒ 400（分帧与表单语义在 bundle 侧）。
    for (const body of [
      Buffer.from('------dshentE2EBoundary--\r\n', 'utf8'),
      multipart('----dshentE2EBoundary', [
        { name: 'artifact', filename: 'a.dshskill', data: archive.bytes },
        { name: 'artifact', filename: 'b.dshskill', data: archive.bytes },
      ]),
    ]) {
      const rejected = await post(ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH, body)
      expect(rejected.status).toBe(400)
      await expect(rejected.json()).resolves.toEqual({ error: { code: 'ENT_SKILL_UPLOAD_INVALID' } })
    }

    // ③ 未知源（在线安装）⇒ 400，且默认段一次都没打网（取数面是抛错桩）。
    const unknownSource = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH}`, {
      body: JSON.stringify({ source: 'acme:owner/repo/skill' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(unknownSource.status).toBe(400)
    await expect(unknownSource.json()).resolves.toEqual({ error: { code: 'ENT_SKILL_SOURCE_UNKNOWN' } })
    expect(harness.failures.map(item => item.status).sort()).toEqual([400, 400, 400, 404, 409, 409])
  })
})

/* ────────────────────────── opt-in 外网段（默认 skip） ────────────────────────── */

const smoke = ONLINE ? describe : describe.skip
smoke('skill add end-to-end over the real internet (opt-in via DSHENT_ONLINE_SMOKE=1)', () => {
  let home: string
  let temporary = false
  let harness: Harness

  beforeAll(async () => {
    const resolved = await resolveHome()
    home = resolved.path
    temporary = resolved.temporary
    harness = await startHarness(home)
  })

  afterAll(async () => {
    if (harness !== undefined) await harness.close()
    if (temporary) await rm(home, { force: true, recursive: true })
    console.log('[skill-add-e2e] online summary '
      + JSON.stringify({
        dshHome: home,
        keepHome: KEEP_HOME ?? null,
        installed: [...installedNames.entries()].map(([name, sha256]) => ({ name, sha256 })),
      }))
  })

  it('serves a real online search whose per-source report obeys the partial-success contract', async () => {
    const response = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH}?q=pdf`)
    expect(response.status).toBe(200)
    const payload = await response.json() as { data: EnterpriseOnlineSkillSearch }
    const search = payload.data
    // ★断**契约**，不断「三源全绿」那个**观测**（公网瞬断是产品要如实交代的部分成功）。
    expect(search.sources.map(source => source.id)).toEqual(['skills.sh', 'claude-plugins.dev', 'clawhub.ai'])
    expect(search.sources.some(source => source.ok)).toBe(true)
    for (const source of search.sources.filter(item => !item.ok)) {
      console.log(`[skill-add-e2e] source ${source.id} answered not-ok this run (partial success is by design)`)
    }
    expect(search.results.length).toBeGreaterThan(0)
    expect(search.results.every(result => result.installSource.includes(':'))).toBe(true)
    for (const result of search.results.filter(item => item.sourceId === 'clawhub.ai')) {
      expect(result.installSource.startsWith('skills.sh:')).toBe(true)
    }
  }, 120_000)

  it('installs a live result through the real route and lands the same bytes the tarball carries', async () => {
    const search = await searchOnlineSkills({ fetch: (input, init) => fetch(input, init), dshHome: home }, 'pdf')
    const target = search.results.find(result => result.sourceId === 'claude-plugins.dev') ?? search.results[0]
    expect(target).toBeDefined()

    // ① 真跑一条：**按结果逐个试**（失败路径在 frontmatter 闸门就返回、零落盘，重试安全），
    //    因为线上社区技能有相当一部分过不了我们的 §D.4 frontmatter 闸门（实测第一条就撞了
    //    `ENT_SKILL_SKILLMD_INVALID`）—— 那是**产品事实**，冒烟该如实记下来、并证明「至少有一条真装得成」。
    const attempts: { source: string, status: number, code: string | null }[] = []
    let installedSource: string | undefined
    for (const candidate of search.results.slice(0, 4)) {
      const response = await fetch(`${harness.baseUrl}${ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH}`, {
        body: JSON.stringify({ source: candidate.installSource }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json() as { data?: unknown, error?: { code?: string } }
      attempts.push({ source: candidate.installSource, status: response.status, code: body.error?.code ?? null })
      if (response.status === 200) {
        installedSource = candidate.installSource
        expect(body.data).toEqual(await installedSkillStatus(harness.skillOptions))
        break
      }
    }
    // 冒烟失败时最需要知道的恰恰是**每一条的稳定码**，所以这条日志是长期留着的观测口。
    console.log('[skill-add-e2e] live install attempts ' + JSON.stringify(attempts))
    expect(installedSource, 'at least one live result must install end to end').toBeDefined()

    const records = JSON.parse(await readFile(join(home, 'enterprise', 'skill-installs', 'self-installed.json'), 'utf8')) as {
      records: { skillId: string, names: string[], sha256: string, sourceInput: string, sourceType: string }[]
    }
    // ★`DSHENT_E2E_KEEP_HOME` 下两个 describe 共用同一个 dshHome（便于一次性复核两段结果），
    //   所以这里按**本次坐标**找那条记录，而不是假设整份清单只有一条。
    const record = records.records.find(item => item.sourceInput === installedSource)
    expect(record, 'the live install must have written a self-installed record').toBeDefined()
    expect(record!.sourceType).toBe('github')
    installedNames.set(record!.names[0]!, record!.sha256)

    // ★与 **codeload tarball 里那一份**逐字节比对：独立地（不用 `src/tar-archive.ts`）解出 gzip+tar，
    //   按 **frontmatter 的技能名**找到那枚 `SKILL.md`，再与盘上字节比。
    // 坐标形态两条路：`claude-plugins.dev:owner/repo/<ref>/<dir…>`（四段以上，ref 明写）与
    // `skills.sh:owner/repo/<skill>`（三段，没有 ref ⇒ 按 main → master 兜底探测）。这里只为取证而读坐标。
    const coordinate = record.sourceInput.split(':')[1]!.split('/')
    const [owner, repo] = coordinate
    const refs = coordinate.length >= 4 ? [coordinate[2]!] : ['main', 'master']
    let files: Map<string, Buffer> | undefined
    for (const ref of refs) {
      const tarball = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${ref}`)
      if (tarball.status !== 200) continue
      files = minimalTarFiles(Buffer.from(await tarball.arrayBuffer()))
      break
    }
    expect(files).toBeDefined()
    const expected = [...files!.entries()].find(([path, bytes]) =>
      path.endsWith('/SKILL.md') && frontmatterName(bytes) === record!.names[0])
    expect(expected).toBeDefined()
    const onDisk = await readFile(join(home, 'skills', record!.names[0]!, 'SKILL.md'))
    expect(onDisk.equals(expected![1])).toBe(true)
    // 该技能目录下的文件集合也必须与 tarball 的同名前缀逐条一致（名称 + 字节）。
    const prefix = expected![0].slice(0, expected![0].length - 'SKILL.md'.length)
    let compared = 0
    for (const [path, bytes] of files!) {
      if (!path.startsWith(prefix)) continue
      expect((await readFile(join(home, 'skills', record!.names[0]!, path.slice(prefix.length)))).equals(bytes)).toBe(true)
      compared += 1
    }
    expect(compared).toBeGreaterThan(0)
  }, 180_000)
})

/* ────────────────────────── 测试侧的独立 tar 读取（只为本文件的比对服务） ────────────────────────── */

/** 独立实现（与 `src/tar-archive.ts` 无任何共享代码）：只为「盘上字节 == tarball 里那一份」这一条断言取证。 */
function minimalTarFiles(gzip: Buffer): Map<string, Buffer> {
  const raw = gunzipSync(gzip)
  const files = new Map<string, Buffer>()
  let cursor = 0
  while (cursor + 512 <= raw.byteLength) {
    const header = raw.subarray(cursor, cursor + 512)
    if (header.every(byte => byte === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/s, '')
    const sizeText = header.subarray(124, 136).toString('latin1').replace(/\0.*$/s, '').trim()
    const size = sizeText === '' ? 0 : Number.parseInt(sizeText, 8)
    const typeflag = String.fromCharCode(header[156] ?? 0)
    const path = prefix === '' ? name : `${prefix}/${name}`
    const start = cursor + 512
    if (typeflag === '0' || typeflag === '\0') files.set(path, Buffer.from(raw.subarray(start, start + size)))
    cursor = start + Math.ceil(size / 512) * 512
  }
  return files
}

/** 从 `SKILL.md` 字节里抓 frontmatter 的 `name`（只用于比对取证，不是生产解析器）。 */
function frontmatterName(bytes: Buffer): string | undefined {
  const text = bytes.toString('utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (match === null) return undefined
  const name = /^name:\s*(\S+)\s*$/m.exec(match[1]!)
  return name?.[1]
}
