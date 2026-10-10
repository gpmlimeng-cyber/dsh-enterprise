/**
 * [INPUT]: 依赖 `src/skill-online.ts` 的 `searchOnlineSkills`/`installSkillFromResult`/`ONLINE_SKILL_SOURCE_IDS`/`ONLINE_SEARCH_MAX_BYTES`/`SKILLHUB_REDIRECT_HOSTS`/`redirectRequestHeaders`、`src/skill-skillhub.ts` 的 `decodeBareSkillDirectory`/`parseSkillhubReference`/`requireSkillhubParts`/`SKILLHUB_SOURCE_INPUT_PREFIX`、`src/skill-install.ts` 的 `installedSkillStatus`/`SKILL_ARCHIVE_MAX_BYTES` 同族的已装态与上限、`src/skill-upload.ts` 的 `SELF_INSTALLED_STATE_FILENAME`、`tests/zip-fixture.ts`（**独立**的 ZIP 构造器）与 node:http/fs/crypto
 * [OUTPUT]: 锁定第四源 `skillhub.cn`：① 源 id **字面值与顺序**（跨包契约：表尾）；② 搜索合法响应**逐字段**解析（`name` 用主名、`description` 优先 `description_zh`、`stars`/`installs` 缺席即整键不产出、`homepage` 一律不用）与三类失败（`code!=0`/畸形/超限）；③ ★**302 只跟一跳**（两个 302 ⇒ 拒）、Location **不在白名单 ⇒ 拒且一次都没打出去**、跟随那一跳**请求头里没有 Authorization/Cookie**（真 HTTP 服务端**请求计数 + 头取证**）；④ **第三种布局**（根级 `SKILL.md` 认、外层目录也认、缺 `SKILL.md` 拒、两个顶层目录拒、顶层裸文件拒、混合形态按显式规则判）、落点名以 **frontmatter 的 `name`** 为准；⑤ frontmatter 不过 ⇒ 零落盘；⑥ 落点冲突/已装 ⇒ 既有码且**绝不覆盖**；⑦ **slug 去重**（同 slug 双源 ⇒ 只出一条且保直连源 `clawhub.ai`）；⑧ 源码级反锁（既有三源与 `/skills/published/*` 逐字节未改、唯一 ZIP 内核、无执行通道、不新造第二个下载器、platform-client 零改动）；⑨ ★制品 50 MiB 配额的**两半**：声明超限（`content-length`）与**流式**超限（无可信 `content-length`，当场停读、总量被那一档夹住）——独立复核补入，此前**流式**那一半删掉守卫后全量 797 条仍全绿
 * [POS]: bundle 技能纵深的第四源回归门禁；有人把 `skillhub.cn` 挪出表尾、把单跳重定向放开成"跟随任何 Location"、给跨域那一跳带上凭据、把 302 正文当制品、按显示名而不是 slug 去重、另写一个 unzip/下载器、把边读边数那条 50 MiB 守卫删掉，或顺手动了既有三源与已发布导出那两面，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SKILL_ARCHIVE_MAX_BYTES } from '../src/skill-archive.js'
import { installedSkillStatus, type EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'
import {
  installSkillFromResult,
  ONLINE_SEARCH_MAX_BYTES,
  ONLINE_SKILL_SOURCE_IDS,
  redirectRequestHeaders,
  searchOnlineSkills,
  SKILLHUB_REDIRECT_HOSTS,
} from '../src/skill-online.js'
import {
  decodeBareSkillDirectory,
  parseSkillhubReference,
  requireSkillhubParts,
  SKILLHUB_SOURCE_INPUT_PREFIX,
} from '../src/skill-skillhub.js'
import { SELF_INSTALLED_STATE_FILENAME } from '../src/skill-upload.js'
import { buildZip } from './zip-fixture.js'

const NOW = '2026-10-05T00:00:00.000Z'
const SELF_STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
const ENTERPRISE_STATE_RELATIVE = join('enterprise', 'skill-installs', 'installed.json')
/** 冻结的逐字七键（顺序即记录里的键序）。 */
const SELF_RECORD_KEYS = ['skillId', 'displayName', 'sha256', 'names', 'installedAt', 'sourceType', 'sourceInput']
/** 真机实测那一台 COS 主机（302 的落点）。 */
const COS_HOST = 'skillhub-1388575217.cos.accelerate.myqcloud.com'
const SLUG = 'weekly-report'
const VERSION = '1.2.0'
const DOWNLOAD_PATH = '/api/v1/download'
const ARTIFACT_PATH = `/skills/${SLUG}/${VERSION}.zip`

const homes: string[] = []
const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skillhub-'))
  homes.push(path)
  return path
}

/* ────────────────────────── 制品夹具（独立 ZIP 构造器） ────────────────────────── */

function skillMarkdown(name: string, description = `${name} 的说明`): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n正文\n`
}

/** 真实形状的**裸技能目录**包：根级 `SKILL.md` + `references/*` + `_meta.json`（没有外层目录、没有 manifest.json）。 */
function bareSkillZip(name: string, extra: readonly { readonly path: string, readonly content: string }[] = []): Buffer {
  return buildZip([
    { path: 'SKILL.md', content: skillMarkdown(name) },
    { path: 'references/guide.md', content: '参考资料\n' },
    { path: '_meta.json', content: '{"generated":true}\n' },
    ...extra.map(entry => ({ path: entry.path, content: entry.content })),
  ])
}

/** 302 那一跳的正文：一份**合法**的裸技能目录包（"302 正文不是制品"这条判据的最强形态）。 */
function decoyZip(): Buffer {
  return bareSkillZip('decoy-skill')
}

/* ────────────────────────── 真 HTTP 上游 double ────────────────────────── */

interface RecordedRequest {
  readonly method: string
  readonly url: string
  /** 服务端在**线缆上**看到的 Authorization（本仓的通路**永远**不该出现它）。 */
  readonly authorization: string | undefined
  readonly cookie: string | undefined
  readonly headers: IncomingHttpHeaders
}

interface UpstreamReply {
  readonly status: number
  readonly headers?: Record<string, string>
  readonly body?: Buffer | string
}

interface Upstream {
  readonly origin: string
  readonly requests: RecordedRequest[]
  /** 我们的代码**请求过**的每个 URL（含被拒的那些也留痕）——用来证明"白名单外一次都没打出去"。 */
  readonly called: string[]
  /** 我们的代码交给取数面的每一跳请求头**原件**（与上面服务端那份互为交叉证据）。 */
  readonly sentHeaders: (HeadersInit | undefined)[]
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>
}

/**
 * 本机起一台**真的** HTTP 服务当上游：宿主侧取数面把 `api.skillhub.cn` / COS 那台主机映射到它的
 * `127.0.0.1` 地址（别的 host 也照映射，但会进 `called` 留痕）。
 *
 * 于是这一条链上每一跳都是真 wire：真 302、真 `Location`、真正文、真请求头；而"请求计数 + 头取证"
 * 是在**服务端**按 `IncomingMessage` 取的，不是我们自己的记账。
 */
async function startUpstream(handler: (url: URL) => UpstreamReply): Promise<Upstream> {
  const requests: RecordedRequest[] = []
  const called: string[] = []
  const sentHeaders: (HeadersInit | undefined)[] = []
  const server = createServer((request, response) => {
    request.on('error', () => undefined)
    response.on('error', () => undefined)
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    requests.push({
      method: request.method ?? 'GET',
      url: request.url ?? '/',
      authorization: typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
      cookie: typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
      headers: request.headers,
    })
    const reply = handler(url)
    response.writeHead(reply.status, reply.headers ?? {})
    response.end(reply.body ?? '')
  })
  server.on('clientError', () => undefined)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    called.push(input)
    sentHeaders.push(init?.headers)
    const target = new URL(input)
    return await fetch(`${origin}${target.pathname}${target.search}`, init)
  }
  return { origin, requests, called, sentHeaders, fetch: fetchImpl }
}

/** 上游反应表：搜索面 + 下载面 + 制品面，各自可覆盖（默认 = 真机形状）。 */
interface UpstreamConfig {
  readonly search?: UpstreamReply
  readonly download?: UpstreamReply
  readonly artifact?: UpstreamReply
}

/** 真机形状的 302：`Location` 指到那台 COS；正文给一份**合法** ZIP（证明我们不看它）。 */
function redirectToCos(): UpstreamReply {
  return {
    status: 302,
    headers: { location: `https://${COS_HOST}${ARTIFACT_PATH}`, 'content-type': 'text/html' },
    body: decoyZip(),
  }
}

function defaultUpstream(config: UpstreamConfig = {}): (url: URL) => UpstreamReply {
  return (url) => {
    if (url.pathname === '/api/search') return { status: 200, headers: { 'content-type': 'application/json' }, body: '{"skills":[]}' }
    if (url.pathname === '/api/skills') {
      return config.search ?? {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: skillhubSearchBody([skillhubEntry()]),
      }
    }
    if (url.pathname === DOWNLOAD_PATH) return config.download ?? redirectToCos()
    if (url.pathname === ARTIFACT_PATH) {
      return config.artifact ?? { status: 200, headers: { 'content-type': 'application/zip' }, body: bareSkillZip(SLUG) }
    }
    return { status: 404, body: 'not found' }
  }
}

/* ────────────────────────── 搜索面夹具（真机形状） ────────────────────────── */

/** 一条真机形状的搜索条目（字段名逐个照抄实测响应）。 */
function skillhubEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: SLUG,
    name: SLUG,
    description: 'Weekly report generator',
    description_zh: '周报生成器',
    category: 'productivity',
    subCategories: [],
    tags: [],
    labels: [],
    downloads: 12,
    stars: 34,
    installs: 56,
    ownerName: 'acme',
    // ★这个字段**绝不**读（官方文档禁令）：主页由界面自己拼 https://skillhub.cn/skills/<slug>。
    homepage: `https://api.skillhub.cn/acme/${SLUG}`,
    version: VERSION,
    source: 'community',
    iconUrl: 'https://cdn.example/icon.png',
    ...overrides,
  }
}

function skillhubSearchBody(skills: readonly unknown[], code: unknown = 0): string {
  return JSON.stringify({ code, message: 'success', data: { total: skills.length, skills } })
}

function jsonReply(body: string): UpstreamReply {
  return { status: 200, headers: { 'content-type': 'application/json' }, body }
}

/** 只有第四源在线的搜索结果（其余三个源 404 ⇒ 逐源 ok:false，但部分成功照常保留）。 */
async function searchWith(config: UpstreamConfig, query = '周报'): Promise<{
  readonly search: Awaited<ReturnType<typeof searchOnlineSkills>>
  readonly upstream: Upstream
  readonly home: string
}> {
  const home = await makeHome()
  const upstream = await startUpstream(defaultUpstream(config))
  const search = await searchOnlineSkills({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) }, query)
  return { search, upstream, home }
}

/* ────────────────────────── ① 源表（跨包契约） ────────────────────────── */

describe('第四源：源 id 字面值与声明序', () => {
  it('★`skillhub.cn` 钉在表尾，顺序逐字冻结（界面那一刀按同一份顺序渲染来源 chip）', async () => {
    expect(ONLINE_SKILL_SOURCE_IDS).toEqual(['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'skillhub.cn'])
    // 响应里的 `sources[]` 必须**同一份顺序**（界面按它铺来源 chip）。
    const { search } = await searchWith({})
    expect(search.sources.map(source => source.id)).toEqual(['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'skillhub.cn'])
  })

  it('302 的落点白名单只有真机实测那一台 COS 主机；减头判据去掉全部凭据类请求头', () => {
    expect(SKILLHUB_REDIRECT_HOSTS).toEqual([COS_HOST])
    expect(redirectRequestHeaders({
      Authorization: 'Bearer must-not-leave',
      Cookie: 'ticket=must-not-leave',
      'X-Api-Key': 'must-not-leave',
      'Proxy-Authorization': 'must-not-leave',
      Accept: 'application/zip',
      'X-Trace': 'keep-me',
    })).toEqual({ accept: 'application/zip', 'x-trace': 'keep-me' })
    // 缺省（本通路第一跳的真实情形）= 空集合：公开源只 GET、不带任何 header。
    expect(redirectRequestHeaders()).toEqual({})
  })

  it('坐标两段的收窄判据只有一份（搜索与安装共用）：slug 必须满足自装记录 `skillId` 的同一把尺', () => {
    expect(requireSkillhubParts(SLUG, VERSION)).toEqual({ slug: SLUG, version: VERSION })
    expect(requireSkillhubParts('a/b', VERSION)).toBeUndefined()
    expect(requireSkillhubParts('.hidden', VERSION)).toBeUndefined()
    expect(requireSkillhubParts('', VERSION)).toBeUndefined()
    expect(requireSkillhubParts(SLUG, 'v1 beta')).toBeUndefined()
    expect(parseSkillhubReference(`${SLUG}@${VERSION}`)).toEqual({ slug: SLUG, version: VERSION })
    expect(parseSkillhubReference(SLUG)).toBeUndefined()
    expect(parseSkillhubReference(`${SLUG}@1@2`)).toBeUndefined()
    expect(parseSkillhubReference(`${SLUG}@`)).toBeUndefined()
  })
})

/* ────────────────────────── ② 搜索：逐字段与三类失败 ────────────────────────── */

describe('第四源搜索：合法响应逐字段、失败各自明确', () => {
  it('逐字段解析：主 `name`、`description_zh` 优先、`author=ownerName`、计数有就给、`homepage` 一律不用', async () => {
    const { search, upstream } = await searchWith({
      search: jsonReply(skillhubSearchBody([
        skillhubEntry(),
        // 只有中文描述 + 没有 stars/installs ⇒ 两枚计数**整键不产出**（"没说"与"说 0"分得开）。
        skillhubEntry({ slug: 'no-counts', name: 'no-counts', description_zh: '没有计数', stars: undefined, installs: undefined }),
        // 只有英文描述 ⇒ 回落到 description。
        skillhubEntry({ slug: 'en-only', name: 'en-only', description: 'English only', description_zh: undefined, stars: 0, installs: 0 }),
      ])),
    })
    const skillhubSource = search.sources.find(source => source.id === 'skillhub.cn')!
    expect(skillhubSource).toEqual({ id: 'skillhub.cn', ok: true })
    const results = search.results.filter(result => result.sourceId === 'skillhub.cn')
    expect(results.map(result => result.name)).toEqual([SLUG, 'no-counts', 'en-only'])

    const first = results[0]!
    // 形状与既有三源**逐字同形**：恰好这七枚键（没有多出来的 download/gallery/homepage/icon…）。
    expect(Object.keys(first).sort()).toEqual([
      'author', 'description', 'installSource', 'installs', 'name', 'sourceId', 'stars',
    ])
    expect(first).toEqual({
      sourceId: 'skillhub.cn',
      name: SLUG,
      description: '周报生成器',
      author: 'acme',
      stars: 34,
      installs: 56,
      installSource: `skillhub.cn:${SLUG}@${VERSION}`,
    })
    // ★`homepage` 一次都没进结果（官方禁令：那是 api.skillhub.cn/<owner>/<slug>）。
    expect(JSON.stringify(search.results)).not.toContain('api.skillhub.cn/acme')

    const second = results[1]!
    expect(second.description).toBe('没有计数')
    expect('stars' in second).toBe(false)
    expect('installs' in second).toBe(false)

    // `stars: 0` / `installs: 0` 是"说了 0"⇒ 如实给 0（不是缺席）。
    const third = results[2]!
    expect(third.description).toBe('English only')
    expect(third.stars).toBe(0)
    expect(third.installs).toBe(0)

    // 查询串进 `keyword=`、按相关度排序（真机取证的那条搜索面）；★第四源**绝不**走 `/api/v1/search`。
    expect(upstream.requests.some(request => request.url.startsWith('/api/skills?'))).toBe(true)
    expect(upstream.called.some(url => url.includes('keyword=') && url.includes('sortBy=score'))).toBe(true)
    const skillhubCalls = upstream.called.filter(url => url.includes('api.skillhub.cn'))
    expect(skillhubCalls).toHaveLength(1)
    expect(skillhubCalls[0]).toContain('https://api.skillhub.cn/api/skills?')
    expect(skillhubCalls.some(url => url.includes('/api/v1/search'))).toBe(false)
  })

  it('坐标解不出来的条目按条丢弃并计数（不静默），其余照常出来', async () => {
    const { search } = await searchWith({
      search: jsonReply(skillhubSearchBody([
        skillhubEntry(),
        skillhubEntry({ slug: undefined, name: 'no-slug' }),
        skillhubEntry({ slug: 'has', name: 'no-version', version: undefined }),
        skillhubEntry({ slug: 'bad/slug', name: 'bad-slug' }),
      ])),
    })
    expect(search.sources.find(source => source.id === 'skillhub.cn')).toEqual({ id: 'skillhub.cn', ok: true, dropped: 3 })
    expect(search.results.map(result => result.name)).toEqual([SLUG])
  })

  it('`code != 0`（含字符串 `\'0\'`）与畸形信封各自判这个源失败，绝不猜"大概有结果"', async () => {
    for (const body of [
      skillhubSearchBody([skillhubEntry()], 500),
      skillhubSearchBody([skillhubEntry()], '0'),
      JSON.stringify({ code: 0, message: 'success' }),
      JSON.stringify({ code: 0, message: 'success', data: { total: 0, skills: 'not-an-array' } }),
      JSON.stringify({ code: 0, message: 'success', data: { total: 0, skills: [{ description: '这条连 name 都没有' }] } }),
      'not json at all',
    ]) {
      const { search } = await searchWith({ search: jsonReply(body) })
      expect(search.sources.find(source => source.id === 'skillhub.cn')).toEqual({ id: 'skillhub.cn', ok: false })
      expect(search.results).toEqual([])
      // 其余源（夹具里只放了 skills.sh 一条空结果）不受影响 ⇒ 部分成功是设计。
      expect(search.sources[0]).toEqual({ id: 'skills.sh', ok: true })
    }
  })

  it('搜索响应超过独立上限（4 MiB）⇒ 这个源明确失败（**不读完**）', async () => {
    const home = await makeHome()
    const fetchImpl = async (input: string): Promise<Response> => input.includes('api.skillhub.cn')
      ? new Response('{}', { status: 200, headers: { 'content-length': String(ONLINE_SEARCH_MAX_BYTES + 1) } })
      : new Response('{"skills":[]}', { status: 200, headers: { 'content-type': 'application/json' } })
    const search = await searchOnlineSkills({ fetch: fetchImpl, dshHome: home, now: () => new Date(NOW) }, '周报')
    expect(search.sources.find(source => source.id === 'skillhub.cn')).toEqual({ id: 'skillhub.cn', ok: false })
  })
})

/* ────────────────────────── ③ 302 → COS：只跟一跳 ────────────────────────── */

describe('第四源取数：302 手动跟随**恰好一跳**（真 HTTP 请求计数 + 头取证）', () => {
  it('跟随那一跳：真 302 → 白名单主机 → 200 ZIP；302 正文（一份合法 ZIP）**不是**制品', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream())
    const result = await installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`)

    // 响应与 `POST /skills/install` 同形（本次没装企业包 ⇒ 空清单）。
    expect(result).toEqual({ skills: [] })
    const offline = { platform: offlinePlatform(), dshHome: home, now: () => new Date(NOW) }
    expect(result).toEqual(await installedSkillStatus(offline))

    // 正好两跳：先 `download`，再 COS 那个制品路径。
    expect(upstream.requests.map(request => request.url)).toEqual([
      `/api/v1/download?slug=${SLUG}&version=${VERSION}`,
      ARTIFACT_PATH,
    ])
    // ★头取证（服务端在线缆上看到的）：两跳都没有 Authorization、没有 Cookie。
    for (const request of upstream.requests) {
      expect(request.authorization).toBeUndefined()
      expect(request.cookie).toBeUndefined()
      expect(Object.keys(request.headers).some(key => key.toLowerCase() === 'authorization')).toBe(false)
    }
    // 交叉证据：交给取数面的请求头原件里也没有凭据类键。
    for (const headers of upstream.sentHeaders) {
      const keys = headers === undefined ? [] : [...new Headers(headers).keys()]
      expect(keys).not.toContain('authorization')
      expect(keys).not.toContain('cookie')
    }

    // ★落下来的是 Location 那一跳的制品（`weekly-report`），**不是** 302 正文里那份 `decoy-skill`。
    expect(await exists(join(home, 'skills', SLUG, 'SKILL.md'))).toBe(true)
    expect(await readFile(join(home, 'skills', SLUG, 'references', 'guide.md'), 'utf8')).toBe('参考资料\n')
    expect(await exists(join(home, 'skills', 'decoy-skill'))).toBe(false)

    // 自装记录：逐字七键 + `sourceType='system'` + `sourceInput='skillhub:<slug>@<version>'`（不写 URL/宿主路径）。
    const state = JSON.parse(await readFile(join(home, SELF_STATE_RELATIVE), 'utf8')) as { records: Record<string, unknown>[] }
    expect(state.records).toHaveLength(1)
    expect(Object.keys(state.records[0]!)).toEqual(SELF_RECORD_KEYS)
    expect(state.records[0]).toMatchObject({
      skillId: SLUG,
      displayName: SLUG,
      names: [SLUG],
      installedAt: NOW,
      sourceType: 'system',
      sourceInput: `${SKILLHUB_SOURCE_INPUT_PREFIX}${SLUG}@${VERSION}`,
    })
    // sha256 = **这次接受的制品字节**的摘要（与上游那份 ZIP 逐字节对照）。
    expect(state.records[0]!['sha256']).toBe(createHash('sha256').update(bareSkillZip(SLUG)).digest('hex'))
    expect((await stat(join(home, SELF_STATE_RELATIVE))).mode & 0o777).toBe(0o600)
    expect((await stat(join(home, 'skills', SLUG, 'SKILL.md'))).mode & 0o777).toBe(0o600)
    // 脱敏：记录里没有宿主绝对路径、没有制品 URL。
    expect(JSON.stringify(state)).not.toContain(home)
    expect(JSON.stringify(state)).not.toContain('https://')
    expect(JSON.stringify(state)).not.toContain(COS_HOST)
    // 临时件不残留。
    expect((await readdir(join(home, 'enterprise', 'skill-installs'))).some(name => name.endsWith('.tmp'))).toBe(false)
  })

  it('★第二个 302 一律拒（不跟第三跳）', async () => {
    const home = await makeHome()
    // 制品那一跳**又回一个** 302（同一台 COS 的另一条路径）。
    const upstream = await startUpstream(defaultUpstream({
      artifact: { status: 302, headers: { location: `https://${COS_HOST}${ARTIFACT_PATH}/again` }, body: '' },
    }))
    expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_UNREACHABLE')
    // 请求计数：**只有**两跳；第三个 URL 一次都没被打出去。
    expect(upstream.requests.map(request => request.url)).toEqual([
      `/api/v1/download?slug=${SLUG}&version=${VERSION}`,
      ARTIFACT_PATH,
    ])
    expect(upstream.called.some(url => url.includes('/again'))).toBe(false)
    expect(await exists(join(home, 'skills'))).toBe(false)
  })

  it('★`Location` 不在白名单 ⇒ 拒，且白名单外**一次都没打出去**', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream({
      download: { status: 302, headers: { location: 'https://evil.example/steal.zip' }, body: '<a href="https://evil.example/steal.zip">Found</a>' },
    }))
    expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_UNREACHABLE')
    expect(upstream.requests.map(request => request.url)).toEqual([`/api/v1/download?slug=${SLUG}&version=${VERSION}`])
    expect(upstream.called.some(url => url.includes('evil.example'))).toBe(false)
    expect(await exists(join(home, 'skills'))).toBe(false)

    // 相对 Location 会解析回 `api.skillhub.cn` ⇒ 同样不在**制品**白名单里（这份表只认那一台 COS）。
    const relative = await startUpstream(defaultUpstream({
      download: { status: 302, headers: { location: `${ARTIFACT_PATH}` }, body: '' },
    }))
    const relativeHome = await makeHome()
    expect(await codeOf(() => installSkillFromResult({ fetch: relative.fetch, dshHome: relativeHome, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_UNREACHABLE')
    expect(relative.requests).toHaveLength(1)

    // http（非 https）落点同样拒。
    const insecure = await startUpstream(defaultUpstream({
      download: { status: 302, headers: { location: `http://${COS_HOST}${ARTIFACT_PATH}` }, body: '' },
    }))
    const insecureHome = await makeHome()
    expect(await codeOf(() => installSkillFromResult({ fetch: insecure.fetch, dshHome: insecureHome, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_UNREACHABLE')
    expect(insecure.requests).toHaveLength(1)
  })

  it('其余 3xx（301/303 之外的非白名单状态码在这里是 301）与 404/5xx 各自明确失败', async () => {
    const cases: readonly (readonly [UpstreamReply, string])[] = [
      [{ status: 301, headers: { location: `https://${COS_HOST}${ARTIFACT_PATH}` }, body: '' }, 'ENT_SKILL_SOURCE_UNREACHABLE'],
      [{ status: 404, body: 'gone' }, 'ENT_SKILL_DOWNLOAD_FAILED'],
      [{ status: 500, body: 'boom' }, 'ENT_SKILL_SOURCE_UNREACHABLE'],
    ]
    for (const [download, expected] of cases) {
      const home = await makeHome()
      const upstream = await startUpstream(defaultUpstream({ download }))
      expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
        `skillhub.cn:${SLUG}@${VERSION}`)), `${download.status}`).toBe(expected)
      expect(upstream.requests).toHaveLength(1)
      expect(await exists(join(home, 'skills'))).toBe(false)
    }
  })

  it('302 **没有** `Location` ⇒ 拒；制品声明超过既有 50 MiB 配额 ⇒ 413 且零落盘', async () => {
    const home = await makeHome()
    const noLocation = await startUpstream(defaultUpstream({ download: { status: 302, body: 'Found' } }))
    expect(await codeOf(() => installSkillFromResult({ fetch: noLocation.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_UNREACHABLE')

    // 声明超限那一跳由一份假响应造（真 HTTP 服务端没法"声明的比真写的多"而不撒谎）。
    const oversized = async (input: string): Promise<Response> => input.includes(DOWNLOAD_PATH)
      ? new Response(null, { status: 302, headers: { location: `https://${COS_HOST}${ARTIFACT_PATH}` } })
      : new Response('tiny', { status: 200, headers: { 'content-length': String(SKILL_ARCHIVE_MAX_BYTES + 1) } })
    const oversizedHome = await makeHome()
    expect(await codeOf(() => installSkillFromResult({ fetch: oversized, dshHome: oversizedHome, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_TOO_LARGE')
    expect(await exists(join(oversizedHome, 'skills'))).toBe(false)
    expect(await exists(join(oversizedHome, SELF_STATE_RELATIVE))).toBe(false)
  })

  /**
   * ★上限的**另一半**：声明那一半（上面那条）由 `content-length` 挡住，而真实的 COS 制品是**流式**下发的
   * —— 没有可信 `content-length` 时唯一能拦住它的是 `readBoundedBytes` 里边读边数的那条守卫。
   * 本条用一份**没有 `content-length`** 的 150 MiB 流去打那一半（独立复核补入：删掉那条守卫时全量 797 条
   * 用例**全绿**，即该分支此前无人锁），并同时钉住"**不读完**"与"配额就是那 50 MiB"两件事。
   */
  it('★制品**流式**超过既有 50 MiB 配额（没有可信 content-length）⇒ 413、当场停读、零落盘', async () => {
    const home = await makeHome()
    const CHUNK = 2 * 1024 * 1024
    const PLANNED_CHUNKS = 75 // 这份流打算给 150 MiB：真读完就会把"不读完"这条判据顶穿
    let pulledBytes = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulledBytes >= PLANNED_CHUNKS * CHUNK) {
          controller.close()
          return
        }
        pulledBytes += CHUNK
        controller.enqueue(new Uint8Array(CHUNK))
      },
    })
    const oversized = async (input: string): Promise<Response> => input.includes(DOWNLOAD_PATH)
      ? new Response(null, { status: 302, headers: { location: `https://${COS_HOST}${ARTIFACT_PATH}` } })
      : new Response(stream, { status: 200, headers: { 'content-type': 'application/zip' } })
    expect(await codeOf(() => installSkillFromResult({ fetch: oversized, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SOURCE_TOO_LARGE')
    // 不读完：拉回来的总量被 50 MiB 那一档夹住（≪ 150 MiB）……
    expect(pulledBytes).toBeLessThan(PLANNED_CHUNKS * CHUNK)
    // ……而且确实**到了** 50 MiB 那一档才停（不是更早、也不是更晚 ⇒ 复用就是既有那一条配额）。
    expect(pulledBytes).toBeGreaterThan(SKILL_ARCHIVE_MAX_BYTES)
    expect(pulledBytes).toBeLessThanOrEqual(SKILL_ARCHIVE_MAX_BYTES + 4 * CHUNK)
    expect(await exists(join(home, 'skills'))).toBe(false)
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('坐标形状不合 ⇒ `ENT_SKILL_SOURCE_UNKNOWN`(400) 且**一次网络都不打**', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream())
    for (const source of [
      `skillhub.cn:${SLUG}`,              // 没有版本
      'skillhub.cn:@1.2.0',               // 没有 slug
      'skillhub.cn:.hidden@1.2.0',        // slug 不满足记录规约
      'skillhub.cn:a/b@1.2.0',            // slug 带斜杠
      'skillhub.cn:a@1@2',                // 两枚 @
      'skillhub.cn:',                     // 空引用
    ]) {
      expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) }, source)), source)
        .toBe('ENT_SKILL_SOURCE_UNKNOWN')
    }
    expect(upstream.called).toEqual([])
  })
})

/* ────────────────────────── ④ 第三种布局：裸技能目录 ────────────────────────── */

describe('第三种布局：裸技能目录 ZIP（共享 ZIP 内核 + 一条明确的分叉判据）', () => {
  it('根级 `SKILL.md` ⇒ `root` 形态（真机三份实测包的形状）', () => {
    const tree = decodeBareSkillDirectory(bareSkillZip(SLUG))
    expect(tree.layout).toBe('root')
    expect('directory' in tree).toBe(false)
    expect(tree.files.map(file => file.path)).toEqual(['SKILL.md', 'references/guide.md', '_meta.json'])
    expect(tree.files[0]!.bytes.toString('utf8')).toBe(skillMarkdown(SLUG))
  })

  it('顶层恰好一个目录 ⇒ `wrapped` 形态（父目录条目也认）', () => {
    const tree = decodeBareSkillDirectory(buildZip([
      { path: `${SLUG}/`, content: '' },
      { path: `${SLUG}/SKILL.md`, content: skillMarkdown(SLUG) },
      { path: `${SLUG}/references/guide.md`, content: '参考资料\n' },
    ]))
    expect(tree.layout).toBe('wrapped')
    expect(tree.directory).toBe(SLUG)
    expect(tree.files.map(file => file.path)).toEqual(['SKILL.md', 'references/guide.md'])
  })

  it('混合形态按**显式规则**判：根级 `SKILL.md` 赢，子目录里的文件如实一起落下（不静默丢字节）', () => {
    const tree = decodeBareSkillDirectory(buildZip([
      { path: 'SKILL.md', content: skillMarkdown(SLUG) },
      { path: 'nested/SKILL.md', content: skillMarkdown('nested-skill') },
    ]))
    expect(tree.layout).toBe('root')
    expect(tree.files.map(file => file.path)).toEqual(['SKILL.md', 'nested/SKILL.md'])
  })

  it('缺 `SKILL.md` / 两个顶层目录 / 顶层裸文件 / 空包 / 超限 `SKILL.md` 一律拒（稳定码）', () => {
    const cases: readonly (readonly [Buffer, string])[] = [
      [buildZip([{ path: `${SLUG}/readme.md`, content: 'x' }]), '缺 SKILL.md（wrapped）'],
      [buildZip([{ path: `${SLUG}/SKILL.md`, content: skillMarkdown(SLUG) }, { path: 'other/SKILL.md', content: skillMarkdown('other') }]), '两个顶层目录'],
      [buildZip([{ path: 'readme.md', content: 'x' }, { path: `${SLUG}/SKILL.md`, content: skillMarkdown(SLUG) }]), '顶层裸文件 + 一个目录'],
      [buildZip([{ path: `${SLUG}/`, content: '' }]), '只有目录条目'],
      [buildZip([{ path: `${SLUG}/SKILL.md`, content: 'x'.repeat(262_145) }]), 'wrapped 超限 SKILL.md'],
      [buildZip([{ path: 'SKILL.md', content: 'x'.repeat(262_145) }]), 'root 超限 SKILL.md'],
    ]
    for (const [bytes, label] of cases) {
      expect(codeOfSync(() => decodeBareSkillDirectory(bytes)), label).toBe('ENT_SKILL_ARCHIVE_INVALID')
    }
    expect(codeOfSync(() => decodeBareSkillDirectory(Buffer.from('not a zip at all')))).toBe('ENT_SKILL_ARCHIVE_INVALID')
    // 边界：恰好 256 KiB 的 `SKILL.md` 布局层**放行**（同一把尺与 `.dshskill`/导出包一致）。
    const boundary = decodeBareSkillDirectory(buildZip([
      { path: 'SKILL.md', content: 'x'.repeat(262_144) },
    ]))
    expect(boundary.files[0]!.bytes.byteLength).toBe(262_144)
  })

  it('★落点名以 **frontmatter 的 `name`** 为准（外层目录名不是 kebab 也一样）', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream({
      artifact: {
        status: 200,
        headers: { 'content-type': 'application/zip' },
        body: buildZip([
          { path: 'Weird Dir Name/', content: '' },
          { path: 'Weird Dir Name/SKILL.md', content: skillMarkdown(SLUG) },
        ]),
      },
    }))
    await installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) }, `skillhub.cn:${SLUG}@${VERSION}`)
    expect(await exists(join(home, 'skills', SLUG, 'SKILL.md'))).toBe(true)
    expect(await exists(join(home, 'skills', 'Weird Dir Name'))).toBe(false)
  })
})

/* ────────────────────────── ⑤⑥ 闸门顺序与落点 ────────────────────────── */

describe('第四源安装：闸门顺序、绝不覆盖', () => {
  it('frontmatter 不过 ⇒ 零落盘、零记录', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream({
      artifact: {
        status: 200,
        headers: { 'content-type': 'application/zip' },
        body: buildZip([{ path: 'SKILL.md', content: '---\nname: Not Kebab\ndescription: x\n---\n正文\n' }]),
      },
    }))
    expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(await exists(join(home, 'skills'))).toBe(false)
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('落点被**别的**归属占用 ⇒ `ENT_SKILL_NAME_CONFLICT` 且盘上内容一个字节不动', async () => {
    const home = await makeHome()
    await mkdir(join(home, 'enterprise', 'skill-installs'), { recursive: true, mode: 0o700 })
    await writeFile(join(home, ENTERPRISE_STATE_RELATIVE), JSON.stringify({
      records: [{
        packageId: '1902500000000000001',
        skillId: 'enterprise-pkg',
        displayName: '企业技能包',
        versionId: '1902500000000000101',
        sha256: 'a'.repeat(64),
        names: [SLUG],
        installedAt: '2026-10-01T00:00:00.000Z',
      }],
    }), { encoding: 'utf8', mode: 0o600 })
    const upstream = await startUpstream(defaultUpstream())
    expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_ALREADY_REGISTERED')
    expect(await exists(join(home, 'skills', SLUG))).toBe(false)

    // 盘上有一个**不属任何记录**的同名目录（用户手工放的）⇒ 落点冲突，且内容不许动。
    const manual = await makeHome()
    await mkdir(join(manual, 'skills', SLUG), { recursive: true, mode: 0o700 })
    await writeFile(join(manual, 'skills', SLUG, 'SKILL.md'), 'OLD-CONTENT\n', 'utf8')
    const manualUpstream = await startUpstream(defaultUpstream())
    expect(await codeOf(() => installSkillFromResult({ fetch: manualUpstream.fetch, dshHome: manual, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_NAME_CONFLICT')
    expect(await readFile(join(manual, 'skills', SLUG, 'SKILL.md'), 'utf8')).toBe('OLD-CONTENT\n')
    expect(await exists(join(manual, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('已装过 ⇒ `ENT_SKILL_ALREADY_REGISTERED` 且盘上内容逐字不变（绝不覆盖、绝不静默升级）', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream())
    const options = { fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) }
    await installSkillFromResult(options, `skillhub.cn:${SLUG}@${VERSION}`)
    const before = await readFile(join(home, 'skills', SLUG, 'SKILL.md'), 'utf8')
    const records = await readFile(join(home, SELF_STATE_RELATIVE), 'utf8')
    // 同一条结果再装一次（新的上游制品内容也换掉了——盘上仍必须是旧的那一份）。
    const changed = await startUpstream(defaultUpstream({
      artifact: {
        status: 200,
        headers: { 'content-type': 'application/zip' },
        body: bareSkillZip(SLUG, [{ path: 'references/new.md', content: '新版本\n' }]),
      },
    }))
    expect(await codeOf(() => installSkillFromResult({ fetch: changed.fetch, dshHome: home, now: () => new Date(NOW) },
      `skillhub.cn:${SLUG}@${VERSION}`))).toBe('ENT_SKILL_ALREADY_REGISTERED')
    expect(await readFile(join(home, 'skills', SLUG, 'SKILL.md'), 'utf8')).toBe(before)
    expect(await readFile(join(home, SELF_STATE_RELATIVE), 'utf8')).toBe(records)
    expect(await exists(join(home, 'skills', SLUG, 'references', 'new.md'))).toBe(false)
  })

  it('既有三源那条链一字未动：`clawhub.ai:` 坐标仍 400、`skills.sh:` 仍走 codeload', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream())
    expect(await codeOf(() => installSkillFromResult({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) },
      'clawhub.ai:wpank/code-review'))).toBe('ENT_SKILL_SOURCE_UNKNOWN')
    expect(upstream.called).toEqual([])
  })
})

/* ────────────────────────── ⑦ slug 去重 ────────────────────────── */

describe('去重：同 slug 双源只出一条，直连源优先', () => {
  /** 直连源 `clawhub.ai` 里可服务的那一类（`kind=skills-sh` ⇒ 坐标是 skills.sh 的）。 */
  const CLAWHUB_BODY = {
    results: [{
      displayName: 'pdf',
      install: { kind: 'skills-sh', reference: 'skills-sh:anthropics/skills/pdf', sourceUrl: 'https://www.skills.sh/anthropics/skills/pdf' },
      ownerHandle: 'anthropics',
      slug: 'pdf',
      summary: 'PDF 处理技能',
    }],
  }

  it('同一枚技能在两个源都出现 ⇒ 只留 `clawhub.ai` 那条（聚合源可能滞后，直连源的数据更原始）', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(url => {
      if (url.pathname === '/api/search') return { status: 200, body: '{"skills":[]}' }
      if (url.pathname === '/api/v1/search') {
        return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(CLAWHUB_BODY) }
      }
      if (url.pathname === '/api/skills') {
        // ★显示名**故意不同**（`PDF Toolkit` vs `pdf`）⇒ 既有那层"按折叠名去重"不会命中，
        //   出结果的唯一解释就是本刀新增的**按 slug**那条判据。
        return jsonReply(skillhubSearchBody([skillhubEntry({ slug: 'pdf', name: 'PDF Toolkit', version: '9.9.9' })]))
      }
      return { status: 404, body: 'not found' }
    })
    const search = await searchOnlineSkills({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) }, 'pdf')

    expect(search.results).toHaveLength(1)
    expect(search.results[0]!.sourceId).toBe('clawhub.ai')
    expect(search.results[0]!.installSource).toBe('skills.sh:anthropics/skills/pdf')
    // 两个源都如实报了 ok（聚合源那条是"被去重"，不是"装不出来" ⇒ 不进 dropped）。
    expect(search.sources).toEqual([
      { id: 'skills.sh', ok: true },
      { id: 'claude-plugins.dev', ok: false },
      { id: 'clawhub.ai', ok: true },
      { id: 'skillhub.cn', ok: true },
    ])
  })

  it('聚合源单独出现（没有直连源那条）⇒ 照常出厂', async () => {
    const home = await makeHome()
    const upstream = await startUpstream(defaultUpstream())
    const search = await searchOnlineSkills({ fetch: upstream.fetch, dshHome: home, now: () => new Date(NOW) }, '周报')
    expect(search.results.map(result => result.sourceId)).toEqual(['skillhub.cn'])
  })
})

/* ────────────────────────── ⑧ 源码级反锁 ────────────────────────── */

/** 去掉注释后的代码（注释里会出现 `/api/v1/search`/`homepage` 这些**词**，判据只吃代码）。 */
function codeOfSource(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** 按名字取出一个**函数体**原文（花括号配对；这几个函数体内没有字符串/正则里的花括号）。 */
function functionSource(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`)
  expect(start, `函数 ${name} 必须在源文件里`).toBeGreaterThanOrEqual(0)
  let index = source.indexOf('{', start)
  let depth = 0
  for (; index < source.length; index += 1) {
    const character = source[index]
    if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`函数 ${name} 的花括号不配对`)
}

function codeOfSync(action: () => unknown): string {
  try {
    action()
    return '<resolved>'
  } catch (error) {
    return (error as { code?: string }).code ?? '<no-code>'
  }
}

async function codeOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action()
    return '<resolved>'
  } catch (error) {
    return (error as { code?: string }).code ?? '<no-code>'
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** 一个「什么网络都不许打」的落盘侧平台面，用来独立复算「同形」的那份已装态。 */
function offlinePlatform(): EnterpriseSkillInstallPlatformPort {
  return { request: async () => { throw new Error('the online skills path must never use the platform port') } }
}

describe('源码级反锁', () => {
  const srcDir = new URL('../src/', import.meta.url)

  it('第四源在原文件里**追加在表尾**，且两个官方禁令字段/端点在代码里一个都不出现', async () => {
    const online = await readFile(new URL('skill-online.ts', srcDir), 'utf8')
    expect(online).toContain(
      "export const ONLINE_SKILL_SOURCE_IDS = ['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'skillhub.cn'] as const",
    )
    // 声明序：三个既有源的 id 仍**按原相对顺序**在 `skillhub.cn` 之前。
    const order = ["id: 'skills.sh'", "id: 'claude-plugins.dev'", "id: 'clawhub.ai'", "id: 'skillhub.cn'"]
      .map(literal => online.indexOf(literal))
    expect(order.every(index => index > 0)).toBe(true)
    expect([...order].sort((left, right) => left - right)).toEqual(order)
    // 两个既有 endpoint 字面值一字未改。
    expect(online).toContain('https://skills.sh/api/search?q=${encodeURIComponent(query)}')
    expect(online).toContain('https://claude-plugins.dev/api/skills?q=${encodeURIComponent(query)}&limit=20')
    expect(online).toContain('https://clawhub.ai/api/v1/search?q=${encodeURIComponent(query)}')
    // ★官方两条禁令：第四源的搜索面**不是** `/api/v1/search`（`clawhub.ai` 那条**既有** endpoint
    //   里的 `/api/v1/search` 与我们无关），且代码里一次都没读 `homepage`。
    const code = codeOfSource(online)
    expect(code).not.toContain('api.skillhub.cn/api/v1/search')
    expect(code).not.toContain('homepage')
    // 第四源的搜索面就是文档允许的那条。
    expect(code).toContain('https://api.skillhub.cn/api/skills?keyword=${encodeURIComponent(query)}&page=1&pageSize=20&sortBy=score')
  })

  it('★既有三源的六个函数体**逐字节未改**（md5 冻结，sha 与 HEAD 一致）', async () => {
    const online = await readFile(new URL('skill-online.ts', srcDir), 'utf8')
    const frozen: Record<string, string> = {
      normalizeSkillsSh: '8b280af611b10c44271554873841577f',
      normalizeClaudePlugins: '959263c73dad11236359beff5d0d80a3',
      normalizeClawhub: 'ed1e4c56ca4a70fe30ab7ed8c71eabb6',
      skillsShReference: '0273c9025b972595defb776b4eef5019',
      claudePluginsReference: '331a43b291903ab937e67227fbfdc2f2',
      clawhubSkillsShCoordinate: '3d6403bc8f0ac72928cb925d7db9b4eb',
    }
    for (const [name, digest] of Object.entries(frozen)) {
      expect(createHash('md5').update(functionSource(online, name)).digest('hex'), name).toBe(digest)
    }
  })

  it('★`/skills/published/*` 两个文件逐字节未改（md5 冻结）', async () => {
    expect(createHash('md5').update(await readFile(new URL('skill-published.ts', srcDir))).digest('hex'))
      .toBe('f0dac7580bcba3dda2d02dcc48e7d16f')
    expect(createHash('md5').update(await readFile(new URL('skill-published-route.ts', srcDir))).digest('hex'))
      .toBe('38e100f1b645e93a682d582413c8e2bf')
  })

  it('两个新/改文件没有执行通道；新文件不碰网络、不新造第二个解析器/下载器', async () => {
    const online = await readFile(new URL('skill-online.ts', srcDir), 'utf8')
    const kernel = await readFile(new URL('skill-skillhub.ts', srcDir), 'utf8')
    for (const [name, text] of [['skill-online.ts', online], ['skill-skillhub.ts', kernel]] as const) {
      const code = codeOfSource(text)
      expect(code, name).not.toContain('child_process')
      expect(code, name).not.toMatch(/\bexec(File|Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bspawn(Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bimport\s*\(/)
    }
    // 新文件：不碰 zlib/不解析 ZIP（共享内核做）、不碰平台面/既有读面/平台下载面（**没有第二个下载器**）。
    const kernelCode = codeOfSource(kernel)
    expect(kernelCode).not.toContain('node:zlib')
    expect(kernelCode).not.toMatch(/\binflate(Raw)?(Sync)?\s*\(/)
    expect(kernelCode).not.toContain('downloadVerifiedArtifact')
    expect(kernelCode).not.toContain('plugin-distribution')
    expect(kernelCode).not.toContain('platform-client')
    expect(kernelCode).not.toContain('esc-route')
    expect(kernelCode).not.toMatch(/\bfetch\s*\(/)
    expect(kernelCode).not.toContain('https://')
    // 而且它确实走的是那三份共享实现。
    expect(kernel).toContain("from './zip-archive.js'")
    expect(kernel).toContain('readZipEntries')
    expect(kernel).toContain('placeEnterpriseSkillArchive')
    expect(kernel).toContain('validateSkillFrontmatter')
    expect(kernel).toContain('upsertSelfInstalledRecord')
    // 全仓：唯一 ZIP 内核、唯一写侧编码器、唯一"减头"判据。
    const files = (await readdir(srcDir, { recursive: true })).filter(name => name.endsWith('.ts'))
    let readers = 0
    let writers = 0
    let strippers = 0
    for (const file of files) {
      const text = await readFile(new URL(file, srcDir), 'utf8')
      readers += text.match(/export function readZipEntries/g)?.length ?? 0
      writers += text.match(/export function writeZipArchive/g)?.length ?? 0
      strippers += text.match(/export function redirectRequestHeaders/g)?.length ?? 0
    }
    expect(readers).toBe(1)
    expect(writers).toBe(1)
    expect(strippers).toBe(1)
    // 第四源的取数只有一处，且它复用的是本文件既有的有界读取与超时常量。
    expect(online.match(/async function fetchSkillhubArtifact\(/g)).toHaveLength(1)
    expect(online).toContain('return await readBoundedBytes(response, SKILL_ARCHIVE_MAX_BYTES)')
    expect(online).toContain('fetchSkillhubArtifact(deps, parts.slug, parts.version)')
  })

  it('★组合层不内联 skillhub 实现 + platform-client 零改动：只有一份取数面、那张码→状态表没动', async () => {
    const index = await readFile(new URL('index.ts', srcDir), 'utf8')
    // 仍然只有一份无凭据取数面，两个端口**原样**接线（本刀只动 `skill-online.ts` 内部）。
    expect(index.match(/const onlineSkillOptions = \{/g)).toHaveLength(1)
    expect(index).toContain('skillOnlineSearch: query => searchOnlineSkills(onlineSkillOptions, query)')
    expect(index).toContain('skillInstallFromResult: source => installSkillFromResult(onlineSkillOptions, source)')
    // ★**加强**（不是放宽）：原来这一条是「`index.ts` 去掉注释后不得出现 `skillhub` 这个词」，
    //   它真正要锁的是「组合层**不内联** skillhub 的任何取数/安装实现」。后续一刀（SkillHub 维度
    //   **只读浏览面**）在 `index.ts` 里**合法地**多了两行 `import`（内核 + 路由注册器）与一处
    //   `registerEnterpriseSkillhubBrowseRoute(...)` —— 那是**委派**，不是内联；原措辞把
    //   「import 一个模块」与「自己写一份实现」混成了一件事，所以本刀收窄判据本身。
    //   ⇒ 收窄到它真正要锁的东西，并**同时加两条更硬的**：
    //   ① 组合层里**没有任何自造的 skillhub 取数代码**（`api.skillhub.cn`、`normalizeSkillhub`、
    //      `requireSkillhubParts`、`fetchWithinLimit`、`fetchSkillhubArtifact` 一律不许出现）。
    //      ★**刻意不断言"整个文件没有 `fetch(`"**：`index.ts` 里本来就有**两处**合法的裸 fetch
    //      （`onlineSkillOptions` 那一处与 NUWAX 会话那一处），全文锁 `fetch(` 会把这两处也误判，
    //      而那正是「本刀只碰 skillhub、不越界」的反证。
    //   ② 新面**必须共用那唯一一份**无凭据取数面（这就是「零新增 HTTP 通道」的机械锁 ——
    //      将来若有人给它新开一个 skillhub fetch 面，这条会红）。
    const indexCode = codeOfSource(index)
    for (const forbidden of ['api.skillhub.cn', 'normalizeSkillhub', 'requireSkillhubParts', 'fetchWithinLimit', 'fetchSkillhubArtifact']) {
      expect(indexCode, forbidden).not.toContain(forbidden)
    }
    expect(index).toContain('browse: request => browseSkillhubCatalog(onlineSkillOptions, request)')
    expect(index).toContain('registerEnterpriseSkillhubBrowseRoute(ctx.webServer')
    // platform-client：十条技能同源路由逐字仍在，且一个字节都没提到本刀。
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
      'ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH',
      'ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH',
    ]) {
      expect(platform, constant).toContain(constant)
    }
    expect(platform).not.toContain('skillhub')
    // 本刀**没有**新增错误码（全部沿用既有码 ⇒ platform-client 那张码→状态表不用动）。
    const errors = await readFile(new URL('skill-errors.ts', srcDir), 'utf8')
    expect(errors).not.toContain('SKILLHUB')
    expect(errors).not.toContain('skillhub')
  })
})
