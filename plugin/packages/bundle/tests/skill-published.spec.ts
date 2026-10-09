/**
 * [INPUT]: 依赖 `src/esc-route.ts` 的模式表/两张许可表/宿主内部读两个入口、`src/skill-published.ts` 的内核与合规判决、`src/skill-published-route.ts` 的注册器与路径常量、`src/skill-upload.ts` 的只读投影与状态文件名、`src/skill-install.ts` 的上限常量、`src/nuwax-auth.ts` 的会话持有者、`@dshent/platform-client` 的 `enterpriseLocalErrorStatus`、`tests/engine-route-match.ts`（引擎语义分发）、`tests/nuwax-support.ts`（每份 holder 一份隔离 dshHome）、`tests/zip-fixture.ts`（**独立**的畸形 ZIP 构造器）与 node:http/fs/crypto
 * [OUTPUT]: 锁定口径 64 B0：① 模式表逐条（五条全 GET、参数段只认 1..18 位纯数字、后两条只给宿主内部）；② **合法三条各 200 且上游一次 / 八种畸形一律 400 且零上游**；③ ★**浏览器可读表里没有 export**（单独一格：浏览器读 export 400 且零上游，宿主表里它在）；④ 既有七条字面规则逐条回归；⑤ 安装路由的形状门禁与 405；⑥ ★合规闸门在取制品之前（`allowCopy≠1` 四种取值各自拒且 **export 零调用**、判据绑定那一条记录的 targetId、`paymentRequired`）；⑦ 有界取制品（声明超 50 MiB ⇒ 413）；⑧ ZIP 四道门禁各自一格（逃逸/符号链接/条目数/解压总量）+ 布局三格；⑨ frontmatter 不过 ⇒ 400 且零落盘；⑩ 200 与 `GET /skills/self-installed` 逐字同形、七键记录、0600；⑪ 落点冲突/已装 ⇒ 既有码且盘上内容不变；⑫ 源码级反锁（无执行通道、不新增第二个 ZIP 解析器/下载器、既有三条通路与 platform-client 零改动、同一份 escReadPort 交给两张许可表）
 * [POS]: 口径 64 B0 的回归门禁；有人不判 `allowCopy`、先取制品后判合规、把数字段放开成任意串、把 export 放进浏览器可读表、
 *   覆盖同名技能、另写一个 unzip、或顺手改了既有七条字面规则与 `/skills/install`，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_ESC_READ_ENDPOINTS,
  ENTERPRISE_ESC_READ_ID_PATTERN,
  ENTERPRISE_ESC_READ_LOCAL_PATH,
  ENTERPRISE_ESC_READ_PATTERNS,
  readEnterpriseEscHostArtifact,
  registerEnterpriseEscReadRoute,
  resolveEnterpriseEscBrowserReadable,
  resolveEnterpriseEscHostReadable,
  type EnterpriseEscReadRoutePort,
} from '../src/esc-route.js'
import {
  createNuwaxSessionHolder,
  type NuwaxSessionHolder,
} from '../src/nuwax-auth.js'
import { SKILL_ARCHIVE_MAX_BYTES } from '../src/skill-archive.js'
import {
  decodePublishedSkillArchive,
  ENT_SKILL_PUBLISHED_COPY_FORBIDDEN,
  installPublishedSkill,
  publishedSkillArchivePath,
  publishedSkillDetailPath,
  requirePublishedSkillCopyable,
  type EnterprisePublishedSkillInstallOptions,
} from '../src/skill-published.js'
import {
  ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH,
  projectPublishedSkillFailure,
  registerEnterprisePublishedSkillRoute,
} from '../src/skill-published-route.js'
import { installedSelfSkills, SELF_INSTALLED_STATE_FILENAME } from '../src/skill-upload.js'
import type { EnterpriseSkillInstallOptions } from '../src/skill-install.js'
import { buildZip } from './zip-fixture.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { disposeNuwaxTempHomes, nuwaxTempHome } from './nuwax-support.js'

const ORIGIN = 'https://nuwax.example.com'
const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'correct horse battery staple'
const TICKET = 'published-ticket-must-not-leave-the-host'
const NOW = '2026-10-07T00:00:00.000Z'
/** 真机取证用过的两个 targetId：158 允许复制、700 不允许（同名/不同记录的判据必须绑 id）。 */
const TARGET_ID = 158
const FORBIDDEN_TARGET_ID = 700

const SKILL_ROOT_RELATIVE = 'skills'
const SELF_STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
/** 冻结的逐字七键（顺序即记录里的键序）。 */
const SELF_RECORD_KEYS = ['skillId', 'displayName', 'sha256', 'names', 'installedAt', 'sourceType', 'sourceInput']

const homes: string[] = []
const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
  // ★会话持有者带落盘：每个 holder 夹具一份自己的 dshHome，否则上一份票据会被当成"重启后的登录态"读回来。
  disposeNuwaxTempHomes()
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeTemp(prefix: string): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, prefix))
  homes.push(path)
  return path
}

const makeHome = (): Promise<string> => makeTemp('dshent-published-home-')

/** 登录用的平台反应（与既有两份 spec 同一体裁）。 */
function loginPlatform(): (input: string, init?: RequestInit) => Promise<Response> {
  return async (input: string): Promise<Response> => input.endsWith('/api/user/passwordLogin')
    ? new Response(JSON.stringify({ code: '0000', data: { token: 'jwt' } }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': `ticket=${TICKET}; Max-Age=604800; HttpOnly; Secure; SameSite=None`,
      },
    })
    : new Response(JSON.stringify({
      code: '0000',
      data: { uid: 1_784_006_361, userName: '538565', nickName: '李猛', tenantId: 1 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
}

/** 已登录的会话持有者（本机两条路由的取数就靠它那枚票据）。 */
async function signedInHolder(): Promise<NuwaxSessionHolder> {
  const holder = createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN, dshHome: nuwaxTempHome('published') })
  await holder.login(ACCOUNT, PASSWORD)
  return holder
}

/** 没登录的会话持有者（票据唯一来源为空 ⇒ 401 且零上游）。 */
function signedOutHolder(): NuwaxSessionHolder {
  return createNuwaxSessionHolder({ fetch: loginPlatform(), origin: ORIGIN, dshHome: nuwaxTempHome('published-out') })
}

/** 平台 fetch double：记下每次调用（url + init），反应由测试给。 */
interface PlatformDouble {
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly calls: { readonly url: string, readonly init: RequestInit | undefined }[]
  readonly countOf: (fragment: string) => number
}

function platformDouble(respond: (url: string, init: RequestInit | undefined) => Response): PlatformDouble {
  const calls: { url: string, init: RequestInit | undefined }[] = []
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init })
    return respond(input, init)
  })
  return {
    fetchImpl: fetchImpl as unknown as PlatformDouble['fetchImpl'],
    calls,
    countOf: fragment => calls.filter(call => call.url.includes(fragment)).length,
  }
}

/** 详情信封（真机形状：`code:'0000'` + `data` 里带合规判据）。 */
function detailResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ code: '0000', message: 'ok', success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** 制品响应（真机形状：`application/octet-stream` + 真 ZIP 字节）。 */
function artifactResponse(bytes: Buffer): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.byteLength) },
  })
}

/** 一份合规的**裸技能目录**导出包（`<name>/SKILL.md` + `<name>/references/…`，真机形状）。 */
function skillZip(
  name: string,
  options: { readonly description?: string, readonly extra?: readonly { readonly path: string, readonly content: string }[] } = {},
): Buffer {
  const description = options.description ?? `${name} 的说明`
  const entries = [
    { path: `${name}/SKILL.md`, content: `---\nname: ${name}\ndescription: ${description}\n---\n正文\n` },
    ...(options.extra ?? []).map(entry => ({ path: `${name}/${entry.path}`, content: entry.content })),
  ]
  return buildZip(entries)
}

/** 合规详情行（`allowCopy: 1` + 未付费）。 */
function allowedDetail(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: TARGET_ID, name: 'dev-engineer-toolkit', allowCopy: 1, paymentRequired: false, ...overrides }
}

/* ────────────────────────── 真路由 + 真 HTTP ────────────────────────── */

interface Wired {
  readonly baseUrl: string
  readonly routes: RegisteredRoute[]
  readonly escPort: EnterpriseEscReadRoutePort
  readonly installOptions: EnterprisePublishedSkillInstallOptions
}

/**
 * 把**两条**本机路由挂进一台真 HTTP 服务器，按引擎语义分发：
 *  · `registerEnterpriseEscReadRoute`（浏览器那条 `POST /esc/read`，走**浏览器可读表**）；
 *  · `registerEnterprisePublishedSkillRoute`（口径 64 的安装路由，内核走**宿主内部许可表**）。
 * 两者共用**同一个** `escReadPort`（同一枚 holder / 同一份 fetch）——这正是"同一份 HTTP 客户端、
 * 两张不同的许可表"在测试里的落地形状。
 */
async function wire(input: {
  readonly dshHome: string
  readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
  readonly holder?: NuwaxSessionHolder
  readonly onError?: (message: string, error: unknown) => void
}): Promise<Wired> {
  const holder = input.holder ?? await signedInHolder()
  const escPort: EnterpriseEscReadRoutePort = {
    holder,
    fetch: input.fetchImpl,
    onError: input.onError ?? (() => undefined),
  }
  const installOptions: EnterprisePublishedSkillInstallOptions = {
    // 平台面（带令牌的同源面）在**这条路上一字节都不打**：本面唯一取数通道是 escPort。
    platform: {
      request: async () => {
        throw new Error('the published-skill install must never touch the enterprise platform client')
      },
    },
    dshHome: input.dshHome,
    now: () => new Date(NOW),
    esc: escPort,
    ...(input.onError === undefined ? {} : { onError: input.onError }),
  }
  const routes: RegisteredRoute[] = []
  const webServer: WebServerRoutePort = {
    host: '127.0.0.1',
    port: 0,
    register: (registered) => {
      routes.push(registered)
      return () => {
        const index = routes.indexOf(registered)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  registerEnterpriseEscReadRoute(webServer, escPort)
  registerEnterprisePublishedSkillRoute(webServer, {
    install: targetId => installPublishedSkill(installOptions, targetId),
  }, input.onError)
  const server = createServer((request, response) => {
    const route = engineRouteMatch(routes, (request.url ?? '/').split('?')[0]!)
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, routes, escPort, installOptions }
}

/** 浏览器那条取数面（`POST /esc/read`）。 */
async function read(wired: Wired, body: unknown): Promise<Response> {
  return await fetch(`${wired.baseUrl}${ENTERPRISE_ESC_READ_LOCAL_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** 口径 64 的安装路由（`POST …/published/install`）。 */
async function install(
  wired: Wired,
  body: string,
  contentType = 'application/json',
): Promise<Response> {
  return await fetch(`${wired.baseUrl}${ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
}

/** 一条稳定失败码（不吞「居然成功了」这种最危险的形态）。 */
async function codeOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action()
    return '<resolved>'
  } catch (error) {
    return (error as { code?: string }).code ?? '<no-code>'
  }
}

/** 盘上有没有这个东西（不抛）。 */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/* ────────────────────────── ① 模式表（闭集仍是闭集） ────────────────────────── */

describe('口径 64 B0：参数化只读模式表', () => {
  it('恰好八条、全部 GET；后五条（详情 + 制品 + MCP 三条）只给宿主内部', () => {
    // ★口径 67 Phase C D0：模式表 5 → 8（旧值往**更强**方向改：多出来的三条一条都不许可浏览器读）。
    expect(ENTERPRISE_ESC_READ_PATTERNS).toHaveLength(8)
    expect(ENTERPRISE_ESC_READ_PATTERNS.map(rule => rule.method))
      .toEqual(['GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET'])
    expect(ENTERPRISE_ESC_READ_PATTERNS.map(rule => rule.template)).toEqual([
      '/api/agent/list/<id>',
      '/api/user/agent/collect/list/<id>/<id>',
      '/api/user/agent/dev/collect/list/<id>/<id>',
      '/api/published/skill/<id>',
      '/api/published/skill/export/<id>',
      '/api/mcp/list/<id>',
      '/api/mcp/deployed/list/<id>',
      '/api/mcp/<id>',
    ])
    // ★浏览器可读位：前三条（「我的专家」）给浏览器；后五条（详情判据 + 导出制品 + MCP 凭据面）**只给宿主内部**。
    expect(ENTERPRISE_ESC_READ_PATTERNS.map(rule => rule.browserReadable))
      .toEqual([true, true, true, false, false, false, false, false])
    // 每一条的正则都真的匹配它自己的模板形状（模板只是人话，正则才是判据）。
    expect(ENTERPRISE_ESC_READ_PATTERNS[0]!.pattern.test('/api/agent/list/158')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[1]!.pattern.test('/api/user/agent/collect/list/12/34')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[2]!.pattern.test('/api/user/agent/dev/collect/list/12/34')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[3]!.pattern.test('/api/published/skill/158')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[4]!.pattern.test('/api/published/skill/export/158')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[5]!.pattern.test('/api/mcp/list/3')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[6]!.pattern.test('/api/mcp/deployed/list/3')).toBe(true)
    expect(ENTERPRISE_ESC_READ_PATTERNS[7]!.pattern.test('/api/mcp/134')).toBe(true)
    // MCP 三条的参数段同样只认"1..18 位纯数字"，尾斜杠/查询串/百分号编码/路径逃逸/非数字一律不吃。
    for (const rule of ENTERPRISE_ESC_READ_PATTERNS.slice(5)) {
      for (const bad of [
        '/api/mcp/list/3/',
        '/api/mcp/list/3?page=1',
        '/api/mcp/list/%33',
        '/api/mcp/list/..',
        '/api/mcp/list/3a',
        '/api/mcp/list/',
      ]) {
        expect(rule.pattern.test(bad), `${rule.template} 不该吃 ${bad}`).toBe(false)
      }
    }
    expect(ENTERPRISE_ESC_READ_PATTERNS[7]!.pattern.test('/api/mcp/list')).toBe(false)
    expect(ENTERPRISE_ESC_READ_PATTERNS[5]!.pattern.test('/api/mcp/deployed/list/3')).toBe(false)
    // 参数段闭集：1..18 位纯数字（19 位、空、非数字、全角数字一律不认）。
    for (const value of ['1', '158', '123456789012345678']) {
      expect(ENTERPRISE_ESC_READ_ID_PATTERN.test(value), value).toBe(true)
    }
    for (const value of ['', '0x1f', '15a', '1234567890123456789', '１２３', '1.5', '-1', ' 1']) {
      expect(ENTERPRISE_ESC_READ_ID_PATTERN.test(value), value).toBe(false)
    }
  })

  it('★参数段只放行纯数字：合法三条各 200 且上游各一次', async () => {
    const double = platformDouble(() => detailResponse({ ok: true }))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    const legal: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
      ['/api/agent/list/158', { page: 1 }],
      ['/api/user/agent/collect/list/12/34', { page: 1 }],
      ['/api/user/agent/dev/collect/list/12/34', { page: 2 }],
    ]
    for (const [path, params] of legal) {
      const response = await read(wired, { path, params })
      expect(response.status, path).toBe(200)
      const body = (await response.json()) as { data?: unknown }
      expect(body.data, path).toEqual({ code: '0000', message: 'ok', success: true, data: { ok: true } })
    }
    expect(double.calls).toHaveLength(3)
    for (const call of double.calls) {
      expect(call.init?.method).toBe('GET')
      // 票据随宿主发出（浏览器拿不到），上游 URL 就是那条参数化路径。
      expect(new Headers(call.init?.headers).get('cookie')).toBe(`ticket=${TICKET}`)
    }
    expect(double.calls.map(call => new URL(call.url).pathname)).toEqual(legal.map(([path]) => path))
  })

  it('★八种畸形一律 400 且**零上游**（`15a` / 尾斜杠 / `..` / 查询串 / 百分号编码 / 超 18 位 / 缺段 / 多段）', async () => {
    const double = platformDouble(() => detailResponse({ ok: true }))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    const malformed = [
      '/api/agent/list/15a', // 非纯数字
      '/api/agent/list/158/', // 尾斜杠
      '/api/agent/list/../158', // 路径逃逸
      '/api/agent/list/158?page=1', // 查询串（参数走 params，不拼在 path 里）
      '/api/agent/list/%31%35%38', // 百分号编码
      '/api/agent/list/1234567890123456789', // 19 位（超上界）
      '/api/user/agent/collect/list/1', // 少一段
      '/api/user/agent/dev/collect/list/1/2/3', // 多一段
      '/api/user/agent/collect/list/1/x', // 第二段非数字
      '/api/agent/list/', // 空参数段
      '/api/published/skill/15a', // 详情那条的参数段同样只认纯数字
    ]
    for (const path of malformed) {
      const response = await read(wired, { path })
      expect(response.status, path).toBe(400)
      expect(await response.json(), path).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    // ★闭集纪律：不匹配 ⇒ **一次上游都不打**（不是"打了再判"）。
    expect(double.calls).toHaveLength(0)
  })

  it('★浏览器可读表里没有 export（单独一格）：浏览器读 export 400 且零上游；宿主许可表里它在', async () => {
    const double = platformDouble(() => artifactResponse(skillZip('dev-engineer-toolkit')))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    // 纯函数面：两张表逐字判一次。
    expect(resolveEnterpriseEscBrowserReadable('/api/published/skill/export/158')).toBeUndefined()
    expect(resolveEnterpriseEscHostReadable('/api/published/skill/export/158')).toBe('GET')
    // 真 HTTP：浏览器那条取数面读 export ⇒ 400，且**一次上游都不打**。
    const response = await read(wired, { path: '/api/published/skill/export/158' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    expect(double.calls).toHaveLength(0)
    // ★反向对照：宿主内部读面**能**取到同一份制品（同一个 escPort、同一枚票据）。
    const artifact = await readEnterpriseEscHostArtifact(wired.escPort, {
      path: '/api/published/skill/export/158',
      maxBytes: SKILL_ARCHIVE_MAX_BYTES,
    })
    expect(artifact.ok).toBe(true)
    expect(double.countOf('/api/published/skill/export/158')).toBe(1)
    // 判据详情那一条同样只住宿主内部（浏览器可读表里没有它）——界面按列表记录的 allowCopy 预判。
    expect(resolveEnterpriseEscBrowserReadable('/api/published/skill/158')).toBeUndefined()
    expect(resolveEnterpriseEscHostReadable('/api/published/skill/158')).toBe('GET')
  })

  it('既有七条字面规则逐条回归（一字未改）：逐条 200 且上游收到的路径与方法逐字相同', async () => {
    // 表本身一字未改（顺序与值都锁死）。
    expect(ENTERPRISE_ESC_READ_ENDPOINTS).toEqual({
      '/api/system/display/recommend/list': 'POST',
      '/api/published/category/list': 'GET',
      '/api/space/list': 'GET',
      '/api/connector/providers': 'GET',
      '/api/published/agent/list': 'POST',
      '/api/published/skill/list': 'POST',
      '/api/published/skill/enable/list': 'POST',
    })
    const double = platformDouble(() => detailResponse({ ok: true }))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    for (const [path, method] of Object.entries(ENTERPRISE_ESC_READ_ENDPOINTS)) {
      expect(resolveEnterpriseEscBrowserReadable(path), path).toBe(method)
      expect(resolveEnterpriseEscHostReadable(path), path).toBe(method)
      const before = double.calls.length
      const response = await read(wired, { path, params: {} })
      expect(response.status, path).toBe(200)
      expect(double.calls, path).toHaveLength(before + 1)
      const call = double.calls[before]!
      expect(call.init?.method, path).toBe(method)
      expect(new URL(call.url).pathname, path).toBe(path)
    }
  })
})

/* ────────────────────────── ② 安装路由：形状与投影 ────────────────────────── */

describe('口径 64 B0：已发布技能安装路由（形状门禁）', () => {
  it('注册形状：恰好一条 exact，路径逐字不带尾斜杠；父路径/截断/带尾斜杠都 404', async () => {
    const double = platformDouble(() => detailResponse(allowedDetail()))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    expect(ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH)
      .toBe('/enterprise/api/v1/local/skills/published/install')
    expect(ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH.endsWith('/')).toBe(false)
    expect(wired.routes.map(route => `${route.kind} ${route.path}`)).toContain(
      `exact ${ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH}`,
    )
    for (const path of [
      '/enterprise/api/v1/local/skills/published',
      '/enterprise/api/v1/local/skills/published/instal',
      `${ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH}/`,
      // ★不能掉进 `/skills` 那条 prefix（否则会被当成包 id 判 400）——这里判的是引擎层 404 之外，
      //   真正承重的是 exact 表优先（下面 200 那条用例会走到真 handler）。
      '/enterprise/api/v1/local/skills/install',
    ]) {
      const response = await fetch(`${wired.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetId: TARGET_ID }),
      })
      // `/skills/install` 由 platform-client 注册（本夹具没挂）⇒ 引擎层 404；其余是未注册路径。
      expect(response.status, path).toBe(404)
    }
    expect(double.calls).toHaveLength(0)
  })

  it('正文关闭键集恰好 {targetId}：多键/少键/字符串/浮点/0/负数/超安全整数/非 JSON/content-type 不对 一律 400 且零上游', async () => {
    const double = platformDouble(() => detailResponse(allowedDetail()))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    const bodies = [
      '{"targetId":158,"extra":1}', // 多一个键
      '{}', // 少键
      '{"targetId":"158"}', // 字符串 id（不是路径、也不是字符串 id）
      '{"targetId":158.5}', // 非整数
      '{"targetId":0}', // 下界外
      '{"targetId":-1}', // 负数
      '{"targetId":9007199254740992}', // 2^53（超安全整数）
      '{"targetId":1e18}', // 超上界
      '{"targetId":null}',
      'not json',
    ]
    for (const body of bodies) {
      const response = await install(wired, body)
      expect(response.status, body).toBe(400)
      expect(await response.json(), body).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect((await install(wired, '{"targetId":158}', 'text/plain')).status).toBe(400)
    // ★形状不过 ⇒ 一次详情、一次制品都不打。
    expect(double.calls).toHaveLength(0)
  })

  it('非 POST 一律 405 + Allow: POST', async () => {
    const double = platformDouble(() => detailResponse(allowedDetail()))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await fetch(`${wired.baseUrl}${ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH}`, { method })
      expect(response.status, `${method} 应当 405`).toBe(405)
      expect(response.headers.get('allow'), `${method} 的 Allow`).toBe('POST')
    }
    expect(double.calls).toHaveLength(0)
  })

  it('失败投影：状态码走唯一那张表（新码落表尾 503）且只回受控码', () => {
    const forbidden = Object.assign(new Error('x'), { code: ENT_SKILL_PUBLISHED_COPY_FORBIDDEN })
    expect(enterpriseLocalErrorStatus(forbidden)).toBe(503)
    expect(projectPublishedSkillFailure(forbidden))
      .toEqual({ status: 503, code: ENT_SKILL_PUBLISHED_COPY_FORBIDDEN, step: 'install-failed' })
    // 既有码原样透出（状态码走同一张表）。
    expect(projectPublishedSkillFailure(Object.assign(new Error('x'), { code: 'ENT_SKILL_NAME_CONFLICT' })))
      .toEqual({ status: 409, code: 'ENT_SKILL_NAME_CONFLICT', step: 'install-failed' })
    // 形状类失败（`TypeError`）在那张表上是 400，码归 `ENT_INVALID_REQUEST`。
    expect(projectPublishedSkillFailure(new TypeError('bad body')))
      .toEqual({ status: 400, code: 'ENT_INVALID_REQUEST', step: 'install-failed' })
    // 任意字符串绝不进响应体；未分类失败回落既有码。
    expect(projectPublishedSkillFailure(Object.assign(new Error('x'), { code: 'not a code' })).code)
      .toBe('ENT_SKILL_INSTALL_FAILED')
  })
})

/* ────────────────────────── ③ 合规闸门（必须在取制品之前） ────────────────────────── */

describe('口径 64 B0：合规闸门（宿主侧，按那一条记录的 targetId）', () => {
  it('★allowCopy≠1（0 / true / "1" / 缺席）⇒ 503 + 新码 + **export 零调用**', async () => {
    for (const allowCopy of [0, true, '1', undefined]) {
      const double = platformDouble(url => url.includes('/export/')
        ? artifactResponse(skillZip('dev-engineer-toolkit'))
        : detailResponse(allowedDetail({ allowCopy })))
      const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
      const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
      expect(response.status, `allowCopy=${String(allowCopy)}`).toBe(503)
      expect(await response.json()).toEqual({ error: { code: ENT_SKILL_PUBLISHED_COPY_FORBIDDEN } })
      // ★取证：详情打了一次、**制品一次都没打**（合规闸门在取制品之前）。
      expect(double.countOf('/api/published/skill/158'), `allowCopy=${String(allowCopy)}`).toBe(1)
      expect(double.countOf('/export/'), `allowCopy=${String(allowCopy)}`).toBe(0)
    }
  })

  it('★判据绑定**那一条记录**的 targetId：allowCopy=1 的 158 装得成、allowCopy=0 的 700 拒，且不打 700 的 export', async () => {
    const double = platformDouble((url) => {
      if (url.includes('/export/')) return artifactResponse(skillZip('routing-creator'))
      return url.includes('/skill/700')
        ? detailResponse({ id: 700, name: 'routing-creator', allowCopy: 0, paymentRequired: false })
        : detailResponse({ id: 158, name: 'dev-engineer-toolkit', allowCopy: 1, paymentRequired: false })
    })
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    const denied = await install(wired, JSON.stringify({ targetId: FORBIDDEN_TARGET_ID }))
    expect(denied.status).toBe(503)
    expect(await denied.json()).toEqual({ error: { code: ENT_SKILL_PUBLISHED_COPY_FORBIDDEN } })
    expect(double.countOf('/skill/700')).toBe(1)
    expect(double.countOf('/export/700')).toBe(0)
    // 同一个部署里、同样一份 200：允许复制的那条记录照装不误（判据是**逐条**的，不是"按名字"或"全局一次"）。
    const allowed = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
    expect(allowed.status).toBe(200)
    expect(double.countOf('/export/158')).toBe(1)
  })

  it('paymentRequired === true ⇒ 拒（同码、同一句话）；false ⇒ 放行', async () => {
    const double = platformDouble(url => url.includes('/export/')
      ? artifactResponse(skillZip('paid-skill'))
      : detailResponse(allowedDetail({ paymentRequired: true })))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl })
    const denied = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
    expect(denied.status).toBe(503)
    expect(await denied.json()).toEqual({ error: { code: ENT_SKILL_PUBLISHED_COPY_FORBIDDEN } })
    expect(double.countOf('/export/')).toBe(0)
  })

  it('详情不是成功码 / 没有 data 对象 ⇒ 平台拒绝 403 / 协议错 502（绝不猜"大概是允许"）', async () => {
    const rejected = platformDouble(() => new Response(
      JSON.stringify({ code: '4003', message: 'no such skill', data: null }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const wiredRejected = await wire({ dshHome: await makeHome(), fetchImpl: rejected.fetchImpl })
    const denied = await install(wiredRejected, JSON.stringify({ targetId: TARGET_ID }))
    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({ error: { code: 'ENT_NUWAX_REJECTED' } })
    expect(rejected.countOf('/export/')).toBe(0)

    const shapeless = platformDouble(() => new Response(
      JSON.stringify({ code: '0000', message: 'ok', data: null }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const wiredShapeless = await wire({ dshHome: await makeHome(), fetchImpl: shapeless.fetchImpl })
    const broken = await install(wiredShapeless, JSON.stringify({ targetId: TARGET_ID }))
    expect(broken.status).toBe(502)
    expect(await broken.json()).toEqual({ error: { code: 'ENT_NUWAX_PROTOCOL' } })
    expect(shapeless.countOf('/export/')).toBe(0)
    // 纯函数面同样逐条判（`allowCopy` 只在恰好 `1` 时放行）。
    expect(() => requirePublishedSkillCopyable({ code: '0000', data: { allowCopy: 1, paymentRequired: false } })).not.toThrow()
    for (const facts of [
      { allowCopy: 0 }, { allowCopy: true }, { allowCopy: '1' }, {}, { allowCopy: 1, paymentRequired: true },
    ]) {
      expect(await codeOf(async () => requirePublishedSkillCopyable({ code: '0000', data: facts })))
        .toBe(ENT_SKILL_PUBLISHED_COPY_FORBIDDEN)
    }
  })
})

/* ────────────────────────── ④ 制品与解包闸门 ────────────────────────── */

describe('口径 64 B0：有界取制品 + 共享 ZIP 内核四道门禁', () => {
  it('★声明超过 50 MiB ⇒ 413 `ENT_SKILL_SOURCE_TOO_LARGE`（有界读取，绝不截断）且零落盘', async () => {
    const dshHome = await makeHome()
    const double = platformDouble(url => url.includes('/export/')
      // 只声明 content-length（不真给 50 MiB 正文）：有界读在**读之前**就早退。
      ? new Response(null, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', 'content-length': String(SKILL_ARCHIVE_MAX_BYTES + 1) },
      })
      : detailResponse(allowedDetail()))
    const wired = await wire({ dshHome, fetchImpl: double.fetchImpl })
    const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: { code: 'ENT_SKILL_SOURCE_TOO_LARGE' } })
    expect(await exists(join(dshHome, SKILL_ROOT_RELATIVE))).toBe(false)
    expect(await exists(join(dshHome, SELF_STATE_RELATIVE))).toBe(false)
    // 宿主内部读面自己那层也逐字锁一次（调用方给的配额就是判据）。
    const small = await readEnterpriseEscHostArtifact(wired.escPort, {
      path: publishedSkillArchivePath(TARGET_ID),
      maxBytes: 16,
    })
    expect(small).toEqual({ ok: false, reason: 'too-large' })
    // 声明没超限但正文真的超限：同样明确失败（读的过程中早退）。
    const streaming = platformDouble(() => new Response(new Uint8Array(64), {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
    }))
    const wiredStreaming = await wire({ dshHome: await makeHome(), fetchImpl: streaming.fetchImpl })
    const tooLarge = await readEnterpriseEscHostArtifact(wiredStreaming.escPort, {
      path: publishedSkillArchivePath(TARGET_ID),
      maxBytes: 16,
    })
    expect(tooLarge).toEqual({ ok: false, reason: 'too-large' })
  })

  it('ZIP 四道门禁各自一格：路径逃逸 / 符号链接 / 条目数 / 解压总量 ⇒ 400 且零落盘', async () => {
    const home = await makeHome()
    const escape = buildZip([
      { path: 'dev-engineer-toolkit/SKILL.md', content: 'x' },
      { path: 'dev-engineer-toolkit/../evil.md', content: 'x' },
    ])
    // 符号链接：Unix 模式 S_IFLNK（0o120000）。
    const symlink = buildZip([
      { path: 'dev-engineer-toolkit/SKILL.md', content: 'x' },
      { path: 'dev-engineer-toolkit/leak', content: 'x', unixMode: 0o120777 },
    ])
    // 条目数：超过共享内核的 1 万条上限。
    const many = buildZip(Array.from({ length: 10_001 }, (_, index) => ({
      path: `dev-engineer-toolkit/f${index}`,
      content: '',
    })))
    // 解压总量：声明一条 > 200 MiB 的条目（判据在**解压之前**按声明值累加）。
    const bomb = buildZip([{
      path: 'dev-engineer-toolkit/SKILL.md',
      content: 'x',
      method: 0,
      uncompressedSize: 209_715_201,
      compressedSize: 1,
    }])
    for (const [label, bytes] of [['escape', escape], ['symlink', symlink], ['entries', many], ['bomb', bomb]] as const) {
      const double = platformDouble(url => url.includes('/export/')
        ? artifactResponse(bytes)
        : detailResponse(allowedDetail()))
      const dshHome = join(home, label)
      const wired = await wire({ dshHome, fetchImpl: double.fetchImpl })
      const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
      expect(response.status, label).toBe(400)
      expect(await response.json(), label).toEqual({ error: { code: 'ENT_SKILL_ARCHIVE_INVALID' } })
      // ★零落盘：连技能根都不建。
      expect(await exists(join(dshHome, SKILL_ROOT_RELATIVE)), label).toBe(false)
      expect(await exists(join(dshHome, SELF_STATE_RELATIVE)), label).toBe(false)
    }
  })

  it('布局三格：顶层不是一个目录 / 顶层裸文件 / 缺 SKILL.md ⇒ 400 且零落盘', async () => {
    const home = await makeHome()
    const twoTops = buildZip([{ path: 'a/SKILL.md', content: 'x' }, { path: 'b/SKILL.md', content: 'x' }])
    const bareFile = buildZip([{ path: 'SKILL.md', content: 'x' }])
    const noMarkdown = buildZip([{ path: 'dev-engineer-toolkit/references/a.md', content: 'x' }])
    for (const [label, bytes] of [['two', twoTops], ['bare', bareFile], ['nomd', noMarkdown]] as const) {
      const double = platformDouble(url => url.includes('/export/')
        ? artifactResponse(bytes)
        : detailResponse({ allowCopy: 1 }))
      const dshHome = join(home, label)
      const wired = await wire({ dshHome, fetchImpl: double.fetchImpl })
      const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
      expect(response.status, label).toBe(400)
      expect(await response.json(), label).toEqual({ error: { code: 'ENT_SKILL_ARCHIVE_INVALID' } })
      expect(await exists(join(dshHome, SKILL_ROOT_RELATIVE)), label).toBe(false)
    }
    // 纯函数面：解包器只认「恰好一个顶层目录 + 其中必须有 SKILL.md」。
    expect(() => decodePublishedSkillArchive(twoTops)).toThrow()
    expect(await codeOf(async () => decodePublishedSkillArchive(bareFile))).toBe('ENT_SKILL_ARCHIVE_INVALID')
    expect(await codeOf(async () => decodePublishedSkillArchive(noMarkdown))).toBe('ENT_SKILL_ARCHIVE_INVALID')
  })

  it('frontmatter 不过（非 kebab 名字 / 缺 description）⇒ 400 `ENT_SKILL_SKILLMD_INVALID` 且零落盘', async () => {
    const home = await makeHome()
    const cases = [
      buildZip([{ path: 'Pandas/SKILL.md', content: '---\nname: Pandas\ndescription: x\n---\n' }]),
      buildZip([{ path: 'no-desc/SKILL.md', content: '---\nname: no-desc\n---\n' }]),
      buildZip([{ path: 'no-front/SKILL.md', content: '正文没有 frontmatter\n' }]),
    ]
    for (const [index, bytes] of cases.entries()) {
      const double = platformDouble(url => url.includes('/export/')
        ? artifactResponse(bytes)
        : detailResponse({ allowCopy: 1 }))
      const dshHome = join(home, `fm${index}`)
      const wired = await wire({ dshHome, fetchImpl: double.fetchImpl })
      const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
      expect(response.status, `case ${index}`).toBe(400)
      expect(await response.json(), `case ${index}`).toEqual({ error: { code: 'ENT_SKILL_SKILLMD_INVALID' } })
      // ★frontmatter 闸门在**落盘之前**：技能根一个字节都不写。
      expect(await exists(join(dshHome, SKILL_ROOT_RELATIVE)), `case ${index}`).toBe(false)
      expect(await exists(join(dshHome, SELF_STATE_RELATIVE)), `case ${index}`).toBe(false)
    }
  })
})

/* ────────────────────────── ⑤ 落盘、记账与幂等 ────────────────────────── */

describe('口径 64 B0：落盘、记账与幂等', () => {
  it('★200 与 `GET /skills/self-installed` 逐字同形、七键记录、0600，且真身落在官方技能根', async () => {
    const dshHome = await makeHome()
    const zip = skillZip('dev-engineer-toolkit', {
      extra: [{ path: 'references/api-docs.md', content: '参考资料 · café\n' }],
    })
    const double = platformDouble(url => url.includes('/export/')
      ? artifactResponse(zip)
      : detailResponse(allowedDetail()))
    const wired = await wire({ dshHome, fetchImpl: double.fetchImpl })
    const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { skills: Record<string, unknown>[] } }
    // ★与 `GET /skills/self-installed` 的载荷逐字同形：同一份只读投影、同样的键序（JSON 逐字节）。
    const sameOptions: EnterpriseSkillInstallOptions = { platform: wired.installOptions.platform, dshHome, now: () => new Date(NOW) }
    const projected = await installedSelfSkills(sameOptions)
    expect(JSON.stringify(body)).toBe(JSON.stringify({ data: projected }))
    expect(body.data.skills).toHaveLength(1)
    const record = body.data.skills[0]!
    expect(Object.keys(record)).toEqual(SELF_RECORD_KEYS)
    expect(record['skillId']).toBe('dev-engineer-toolkit')
    expect(record['displayName']).toBe('dev-engineer-toolkit')
    expect(record['names']).toEqual(['dev-engineer-toolkit'])
    expect(record['sourceType']).toBe('system')
    // ★来源坐标是不透明的 `nuwax:<targetId>`：不写平台 URL、不写宿主路径。
    expect(record['sourceInput']).toBe(`nuwax:${TARGET_ID}`)
    expect(record['sha256']).toMatch(/^[0-9a-f]{64}$/)
    expect(record['installedAt']).toBe(NOW)
    // ★脱敏：整份响应里没有宿主绝对路径、没有平台 origin。
    expect(JSON.stringify(body)).not.toContain(dshHome)
    expect(JSON.stringify(body)).not.toContain(ORIGIN)
    // 真身：`<dshHome>/skills/<frontmatter name>/SKILL.md` + 嵌套资源一并复制。
    const skillDir = join(dshHome, SKILL_ROOT_RELATIVE, 'dev-engineer-toolkit')
    expect(await readFile(join(skillDir, 'SKILL.md'), 'utf8')).toContain('name: dev-engineer-toolkit')
    expect(await readFile(join(skillDir, 'references', 'api-docs.md'), 'utf8')).toBe('参考资料 · café\n')
    // 权限：技能文件 0600、自装清单 0600（临时件不残留）。
    expect((await stat(join(skillDir, 'SKILL.md'))).mode & 0o777).toBe(0o600)
    const statePath = join(dshHome, SELF_STATE_RELATIVE)
    expect((await stat(statePath)).mode & 0o777).toBe(0o600)
    const state = JSON.parse(await readFile(statePath, 'utf8')) as { records: Record<string, unknown>[] }
    expect(Object.keys(state)).toEqual(['records'])
    expect(Object.keys(state.records[0]!)).toEqual(SELF_RECORD_KEYS)
    expect((await readdir(join(dshHome, 'enterprise', 'skill-installs'))).some(name => name.endsWith('.tmp')))
      .toBe(false)
    // 取数次数：详情一次、制品一次。
    expect(double.countOf('/api/published/skill/158')).toBe(1)
    expect(double.countOf('/export/158')).toBe(1)
  })

  it('★落点冲突 / 已装 ⇒ 既有码且**绝不覆盖**（盘上内容仍是旧的）', async () => {
    const dshHome = await makeHome()
    const zip = skillZip('dev-engineer-toolkit')
    const double = platformDouble(url => url.includes('/export/')
      ? artifactResponse(zip)
      : detailResponse(allowedDetail()))
    const wired = await wire({ dshHome, fetchImpl: double.fetchImpl })
    const skillDir = join(dshHome, SKILL_ROOT_RELATIVE, 'dev-engineer-toolkit')
    // ① 盘上已有一个**不属任何记录**的同名技能目录（用户手工放的）⇒ 409，且内容一个字节都不许动。
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), 'OLD-CONTENT\n', 'utf8')
    const conflict = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: { code: 'ENT_SKILL_NAME_CONFLICT' } })
    expect(await readFile(join(skillDir, 'SKILL.md'), 'utf8')).toBe('OLD-CONTENT\n')
    expect(await exists(join(dshHome, SELF_STATE_RELATIVE))).toBe(false)

    // ② 先真装一枚，再装一次 ⇒ 409「已装过」，盘上内容逐字不变。
    const freshHome = await makeHome()
    const wiredFresh = await wire({ dshHome: freshHome, fetchImpl: double.fetchImpl })
    const first = await install(wiredFresh, JSON.stringify({ targetId: TARGET_ID }))
    expect(first.status).toBe(200)
    const installedPath = join(freshHome, SKILL_ROOT_RELATIVE, 'dev-engineer-toolkit', 'SKILL.md')
    const before = await readFile(installedPath, 'utf8')
    const again = await install(wiredFresh, JSON.stringify({ targetId: TARGET_ID }))
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: { code: 'ENT_SKILL_ALREADY_REGISTERED' } })
    expect(await readFile(installedPath, 'utf8')).toBe(before)
  })

  it('没登录 ⇒ 401 `ENT_AUTH_REQUIRED` 且零上游；制品回 200 + {"code":"4010"} ⇒ 401（不把 JSON 当 ZIP）', async () => {
    const double = platformDouble(() => detailResponse(allowedDetail()))
    const signedOut = await wire({ dshHome: await makeHome(), fetchImpl: double.fetchImpl, holder: signedOutHolder() })
    const unauthorized = await install(signedOut, JSON.stringify({ targetId: TARGET_ID }))
    expect(unauthorized.status).toBe(401)
    expect(await unauthorized.json()).toEqual({ error: { code: 'ENT_AUTH_REQUIRED' } })
    expect(double.calls).toHaveLength(0)

    const unauthenticated = platformDouble(url => url.includes('/export/')
      ? new Response(JSON.stringify({ code: '4010', message: 'not logged in' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
      : detailResponse(allowedDetail()))
    const wired = await wire({ dshHome: await makeHome(), fetchImpl: unauthenticated.fetchImpl })
    const response = await install(wired, JSON.stringify({ targetId: TARGET_ID }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'ENT_AUTH_REQUIRED' } })
    // 制品不是 ZIP（是一段 JSON 信封）⇒ 读面那层就判掉，绝不让解包器说"这个包结构不合法"。
    expect(await codeOf(async () => decodePublishedSkillArchive(Buffer.from('{}')))).toBe('ENT_SKILL_ARCHIVE_INVALID')
  })

  it('路径构造器只由安全整数合成（结构上拼不出逃逸路径）', () => {
    expect(publishedSkillDetailPath(158)).toBe('/api/published/skill/158')
    expect(publishedSkillArchivePath(158)).toBe('/api/published/skill/export/158')
    expect(resolveEnterpriseEscHostReadable(publishedSkillArchivePath(158))).toBe('GET')
    expect(resolveEnterpriseEscBrowserReadable(publishedSkillArchivePath(158))).toBeUndefined()
  })
})

/* ────────────────────────── ⑥ 源码级反锁 ────────────────────────── */

/** 去掉注释后的代码（注释里会出现 `exec`/`rm` 这些**词**，判据只吃代码）。 */
function codeOfSource(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('源码级反锁', () => {
  it('两个新文件没有任何执行通道、也不新增第二个 ZIP 解析器/下载器', async () => {
    const kernel = await readFile(new URL('../src/skill-published.ts', import.meta.url), 'utf8')
    const route = await readFile(new URL('../src/skill-published-route.ts', import.meta.url), 'utf8')
    for (const [name, text] of [['skill-published.ts', kernel], ['skill-published-route.ts', route]] as const) {
      const code = codeOfSource(text)
      expect(code, name).not.toContain('child_process')
      expect(code, name).not.toMatch(/\bexec(File|Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bspawn(Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bimport\s*\(/)
      expect(code, name).not.toContain('node:zlib')
      expect(code, name).not.toMatch(/\binflate(Raw)?(Sync)?\s*\(/)
    }
    // ★唯一 ZIP 内核与唯一下载面：解包走共享内核；取数走既有「只读面 + 票据」。
    expect(kernel).toContain("from './zip-archive.js'")
    expect(kernel).toContain('readZipEntries')
    expect(kernel).toContain('readEnterpriseEscHostArtifact')
    expect(kernel).toContain('readEnterpriseEscHostJson')
    expect(kernel).not.toContain('downloadVerifiedArtifact')
    expect(kernel).not.toContain('plugin-distribution')
    expect(kernel).not.toContain('platform.request')
    expect(kernel).toContain('placeEnterpriseSkillArchive')
    expect(kernel).toContain('validateSkillFrontmatter')
    // 源码级：全仓 `readZipEntries` 只定义一处（没有第二个解析器）。
    const srcDir = new URL('../src/', import.meta.url)
    const files = (await readdir(srcDir, { recursive: true })).filter(name => name.endsWith('.ts'))
    let definitions = 0
    for (const file of files) {
      definitions += (await readFile(new URL(file, srcDir), 'utf8')).match(/export function readZipEntries/g)?.length ?? 0
    }
    expect(definitions).toBe(1)
  })

  it('★既有三条通路与 `/skills/install` 一字未改、platform-client 零改动；组合层同一个 escReadPort 交给两张许可表', async () => {
    const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    // 既有三条通路仍在、仍走同一份 skillInstallOptions（本刀只**并列**加一条）。
    expect(index).toContain('skillUpload: (body, boundary) => uploadSkillArchive(skillInstallOptions, body, boundary)')
    expect(index).toContain('skillSelfInstalled: () => installedSelfSkills(skillInstallOptions)')
    expect(index).toContain('skillSystemSearch: () => discoverSystemSkills(skillInstallOptions)')
    expect(index).toContain('skillAdopt: path => adoptSystemSkill(skillInstallOptions, path)')
    expect(index).toContain('install: path => installThirdPartySkill(skillInstallOptions, path)')
    // 本刀：安装路由的内核端口**共用同一个 escReadPort**（同一枚 holder、同一份 fetch）。
    expect(index).toContain('const escReadPort: EnterpriseEscReadRoutePort = {')
    expect(index).toContain('registerEnterpriseEscReadRoute(ctx.webServer, escReadPort)')
    expect(index).toContain('registerEnterprisePublishedSkillRoute(ctx.webServer, {')
    expect(index).toContain('install: targetId => installPublishedSkill({ ...skillInstallOptions, esc: escReadPort }, targetId)')
    // ★绝不建第二份登录态。
    expect(index.match(/createNuwaxSessionHolder\(/g)).toHaveLength(1)
    // ★platform-client 零改动：四条既有 exact 子路径逐字仍在，且一个字节都没提到本刀。
    const platform = await readFile(new URL('../../platform-client/src/local-api.ts', import.meta.url), 'utf8')
    for (const constant of [
      'ENTERPRISE_SKILL_INSTALL_LOCAL_PATH',
      'ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH',
      'ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH',
      'ENTERPRISE_SKILL_CONTENT_LOCAL_PATH',
      'ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH',
      'ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH',
      'ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH',
      'ENTERPRISE_SKILL_ADOPT_LOCAL_PATH',
    ]) {
      expect(platform, constant).toContain(constant)
    }
    expect(platform).toContain('`${LOCAL_API_PREFIX}/skills/install`')
    expect(platform).not.toContain('published')
    expect(platform).not.toContain(ENT_SKILL_PUBLISHED_COPY_FORBIDDEN)
    // 既有两条通路的内核一字未改（仍是同一个导出与同一份落盘引擎）。
    const upload = await readFile(new URL('../src/skill-upload.ts', import.meta.url), 'utf8')
    const system = await readFile(new URL('../src/skill-system.ts', import.meta.url), 'utf8')
    expect(upload).toContain('export async function uploadSkillArchive')
    expect(upload).not.toContain('published')
    expect(system).toContain('export async function adoptSystemSkill')
    expect(system).not.toContain('published')
  })

  it('新码落 `skill-errors.ts` 的封闭码族、刻意不进 platform-client 那张码→状态表（行为断言 503）', async () => {
    const errors = await readFile(new URL('../src/skill-errors.ts', import.meta.url), 'utf8')
    expect(errors).toContain("| 'ENT_SKILL_PUBLISHED_COPY_FORBIDDEN'")
    // 一码一句话：本面**只**新增这一枚（其余结果全部沿用既有码）；码联合里那一行恰好一条。
    expect([...new Set(errors.match(/ENT_SKILL_PUBLISHED_[A-Z_]+/g))]).toEqual(['ENT_SKILL_PUBLISHED_COPY_FORBIDDEN'])
    expect(errors.match(/\| 'ENT_SKILL_PUBLISHED_[A-Z_]+'/g)).toHaveLength(1)
    const platform = await readFile(new URL('../../platform-client/src/local-api.ts', import.meta.url), 'utf8')
    expect(platform).not.toContain('ENT_SKILL_PUBLISHED_COPY_FORBIDDEN')
    // 落表尾默认：enterpriseLocalErrorStatus 对未列出的码回 503（platform-client 零改动的代价，如实锁死）。
    expect(enterpriseLocalErrorStatus(Object.assign(new Error('x'), { code: ENT_SKILL_PUBLISHED_COPY_FORBIDDEN })))
      .toBe(503)
    // 上游体量超上限那枚是**既有码**（413），不是本刀新造的。
    expect(enterpriseLocalErrorStatus(Object.assign(new Error('x'), { code: 'ENT_SKILL_SOURCE_TOO_LARGE' }))).toBe(413)
  })
})
