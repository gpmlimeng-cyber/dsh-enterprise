/**
 * [INPUT]: 依赖 `src/skillhub-browser.ts` 的 `browseSkillhubCatalog` 与五条上限常量、`src/skillhub-browser-route.ts`
 *   的注册器/路径常量/失败投影、`src/skill-online.ts` 的 `MAX_QUERY_LENGTH`（共用上限的对照物）与
 *   `parseSkillhubReference`（坐标形态的对照物）、`src/skill-skillhub.ts` 的 `requireSkillhubParts`、
 *   `tests/engine-route-match.ts`（引擎语义分发）、node:http 与 vitest
 * [OUTPUT]: 锁定 SkillHub 维度宿主面：① **浏览模式**（无 `q` ⇒ 自动显示、`sortBy=downloads` 显式给出）；
 *   ② **分类过滤**（合法值放行、**不在表内本地 400 且一次都不打上游**）；③ **三档排序逐档**（downloads/installs/score
 *   各自的 URL 与**真区分度**）；④ **分页与 hasMore**（`page*pageSize<total`，`total` 缺席即 `hasMore:false`）；
 *   ⑤ **非法参数零上游调用**（sort/page/q/category 四类）；⑥ **上游失败 ⇒ 明确码且不折成空列表**；
 *   ⑦ **`installSource` 与既有链一致**（能被 `parseSkillhubReference` 解析成两段）；⑧ ★**响应键集恰好**
 *   （多一个键即畸形；反向锁：宿主路径/上游原始字段一律不出厂）；⑨ 分类表 TTL 缓存与失败不拖累列表；
 *   ⑩ 405 + `Allow`；⑪ 源码级反锁（零 exec/spawn/动态 import、**既有 `/skills/online-search` 一字未改**）
 * [POS]: bundle 技能纵深**第二条技能面**（SkillHub 单来源只读浏览）的回归门禁；有人把默认排序改成 score、
 *   把浏览模式回退成"必须给 q"、把分类不按真实取值收窄、把上游失败折成空列表、把 `installSource` 拼成别的形态、
 *   或在响应里多加一枚键，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 *
 * ★**测试一个真请求都不发**：上游**全部**由注入的 fetcher double 构造（`router` 按 URL 形状分发），
 * 真机读数（`total=188,534`、`pageSize` 上限 100、三档 `sortBy`、`/api/v1/categories` 13 枚等）只写在
 * 夹具与注释里，断言的是**我们怎么用那些读数**，不是"再打一次真网验证"。
 * ★**分类缓存是模块级的**：夹具必须提供**可控的 `now`**（`options.now`）来驱动 TTL，否则同一进程里
 *  第一次用例取到的分类表会泄进后面那些用例（这既是坑也是本文件刻意锁住的行为，见 ⑨）。
 */

import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import { parseSkillhubReference } from '../src/skill-skillhub.js'
import { MAX_QUERY_LENGTH } from '../src/skill-online.js'
import {
  SKILLHUB_BROWSE_CATEGORY_TTL_MS,
  SKILLHUB_BROWSE_MAX_PAGE,
  SKILLHUB_BROWSE_MAX_Q_LENGTH,
  SKILLHUB_BROWSE_PAGE_SIZE,
  SKILLHUB_BROWSE_SORTS,
  type EnterpriseSkillhubBrowseRequest,
} from '../src/skillhub-browser.js'
import {
  ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH,
  projectSkillhubBrowseFailure,
  registerEnterpriseSkillhubBrowseRoute,
} from '../src/skillhub-browser-route.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'

/**
 * ★**分类缓存是模块级的，所以内核必须逐个用例重新 import**（`vi.resetModules()` + 动态 import）。
 *
 * ★这不是测试洁癖、是一条**必须被独立验证**的性质：缓存活着 ⇒ 后面的用例根本不会打分类接口 ⇒
 * 「这个用例到底在测缓存还是在测取数」就说不清了。★**生产代码里因此不导出任何"清缓存"的口子** ——
 * 那是一个只服务测试的 API，进了产品就是死代码（下一个版本没人会记得更新它）。
 */
type BrowseKernel = typeof import('../src/skillhub-browser.js')
async function freshKernel(): Promise<BrowseKernel> {
  vi.resetModules()
  return await import('../src/skillhub-browser.js') as BrowseKernel
}

/* ────────────────────────── fetcher double（一个真请求都不发） ────────────────────────── */

interface Route {
  readonly path: RegExp
  readonly respond: (url: URL) => Response
}

/** 鸭子类型的响应：模块只用 `status`/`headers.get`/`body` 三件事。 */
function respond(status: number, bytes: string, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status === 200,
    headers: new Headers(headers),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        const body = Buffer.from(bytes, 'utf8')
        if (body.byteLength > 0) controller.enqueue(new Uint8Array(body))
        controller.close()
      },
    }),
  } as unknown as Response
}

function skillhubJson(value: unknown): Response {
  return respond(200, JSON.stringify(value), { 'content-type': 'application/json' })
}

/** 一行技能（**上游真形状**，字段很富 —— 出厂只挑其中八格）。 */
function upstreamRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '编程专家.Skill',
    slug: 'dev-expert',
    version: '2.0.3',
    description: 'english description',
    description_zh: '中文描述',
    category: 'dev-programming',
    downloads: 2661869,
    installs: 0,
    stars: 326,
    score: 100000,
    iconUrl: 'https://cloudcache.tencent-cloud.com/x.png',
    homepage: 'https://api.skillhub.cn/indiv-ebandao/dev-expert',
    namespace: { canonicalName: '@indiv-ebandao/dev-expert', displayName: 'user_741dc82b' },
    ownerName: 'user_741dc82b',
    verified: false,
    claim_state: 'unclaimed',
    labels: { requires_api_key: 'false' },
    tags: null,
    subCategories: [{ key: 'dev-code-gen', name: '代码生成' }],
    upstream_url: null,
    created_at: 1781813129820,
    updated_at: 1791600242527,
    ...overrides,
  }
}

function skillList(skills: readonly unknown[], total: unknown): string {
  return JSON.stringify({ code: 0, data: { skills, total }, message: 'success' })
}

/** 真机 `/api/v1/categories` 的真实形状（13 枚，含中文名）。 */
const REAL_CATEGORY_BODY = JSON.stringify({
  count: 13,
  items: [
    { key: 'pay-skill', name: 'Pay Skill', nameEn: 'Pay Skill', sortOrder: 0, level: 1, active: true },
    { key: 'office-efficiency', name: '办公效率', nameEn: 'Office Efficiency', sortOrder: 10, level: 1, active: true },
    { key: 'content-creation', name: '内容创作', nameEn: 'Content Creation', sortOrder: 20, level: 1, active: true },
    { key: 'dev-programming', name: '开发编程', nameEn: 'Development', sortOrder: 30, level: 1, active: true },
    { key: 'data-analysis', name: '数据分析', nameEn: 'Data Analysis', sortOrder: 40, level: 1, active: true },
    { key: 'design-media', name: '设计多媒体', nameEn: 'Design & Media', sortOrder: 50, level: 1, active: true },
    { key: 'ai-agent', name: 'AI Agent', nameEn: 'AI Agent', sortOrder: 60, level: 1, active: true },
    { key: 'knowledge-management', name: '知识管理', nameEn: 'Knowledge Management', sortOrder: 70, level: 1, active: true },
    { key: 'business-ops', name: '商业运营', nameEn: 'Business Operations', sortOrder: 80, level: 1, active: true },
    { key: 'education', name: '教育学习', nameEn: 'Education', sortOrder: 90, level: 1, active: true },
    { key: 'professional', name: '行业专业', nameEn: 'Professional', sortOrder: 100, level: 1, active: true },
    { key: 'it-ops-security', name: 'IT 运维与安全', nameEn: 'IT Ops & Security', sortOrder: 110, level: 1, active: true },
    { key: 'life-service', name: '生活服务', nameEn: 'Life Service', sortOrder: 120, level: 1, active: true },
  ],
})

interface Harness {
  readonly options: { fetch: (input: string, init?: RequestInit) => Promise<Response>, now: () => Date, onError: (message: string, error: unknown) => void }
  readonly log: string[]
  readonly onError: ReturnType<typeof vi.fn>
  /** 上一次列表请求的查询参数（不含 categories 那条）。 */
  lastListUrl: () => URL
  /** 分类接口被打了几次（缓存锁用）。 */
  categoryCalls: () => number
  /** 把时钟往后拨 `ms`（驱动 TTL）。 */
  advance: (ms: number) => void
}

/**
 * 装一套 fetcher double：`listRespond` 控制 `/api/skills` 的回包（可抛错 ⇒ 模拟网络失败），
 * `categoryRespond` 控制 `/api/v1/categories`。**两个端点分开计数**，好分别锁"分类缓存"与"列表取数"。
 */
function harness(options: {
  readonly list: (url: URL) => Response
  readonly categories?: (url: URL) => Response
  readonly startAt?: number
}): Harness {
  const log: string[] = []
  const onError = vi.fn<(message: string, error: unknown) => void>()
  let clock = options.startAt ?? new Date('2026-10-10T00:00:00.000Z').getTime()
  let listUrl = ''
  let categoryHits = 0
  const fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input)
    log.push(`${init?.method ?? 'GET'} ${url.toString()}`)
    if (init?.signal?.aborted === true) throw new DOMException('aborted', 'AbortError')
    if (url.pathname === '/api/v1/categories') {
      categoryHits += 1
      return (options.categories ?? (() => skillhubJson(JSON.parse(REAL_CATEGORY_BODY))))(url)
    }
    if (url.pathname !== '/api/skills') return respond(404, 'not found')
    listUrl = url.toString()
    return options.list(url)
  }
  return {
    options: { fetch, now: () => new Date(clock), onError },
    log,
    onError,
    lastListUrl: () => new URL(listUrl),
    categoryCalls: () => categoryHits,
    advance: ms => { clock += ms },
  }
}

/** 默认的列表回包：2 行。 */
const defaultList = (_url: URL): Response => skillhubJson(
  JSON.parse(skillList([upstreamRow(), upstreamRow({ name: 'weekly-report', slug: 'weekly-report', version: '1.2.0', description_zh: '', downloads: 12, category: 'ai-agent' })], 188534)),
)

/* ────────────────────────── 路由面 ────────────────────────── */

describe('skillhub 浏览路由（exact 只读）', () => {
  let server: Server
  let route: RegisteredRoute | undefined
  let routes: RegisteredRoute[] = []
  let browse: ReturnType<typeof vi.fn> | undefined
  let onError: ReturnType<typeof vi.fn>
  let baseUrl = ''

  const wire = (port: { browse: (request: unknown) => Promise<unknown> } | undefined): void => {
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        routes.push(registered)
        route = routes.length === 1 ? registered : route
        return () => {
          routes = routes.filter(entry => entry !== registered)
          route = routes[0]
        }
      },
    }
    registerEnterpriseSkillhubBrowseRoute(webServer, port, onError)
  }

  beforeEach(async () => {
    routes = []
    route = undefined
    browse = vi.fn<(request: unknown) => Promise<unknown>>(async () => ({
      skills: [], total: 0, categories: [], page: 1, hasMore: false,
    }))
    onError = vi.fn<(message: string, error: unknown) => void>()
    wire({ browse })
    server = createServer((incoming, response) => {
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route!.handler(incoming, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  const get = (query = '', init?: RequestInit): Promise<Response> =>
    fetch(`${baseUrl}${ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH}${query}`, init)

  it('★注册形状与引擎语义：exact、抢在 `/skills` prefix 之前、路径逐字', () => {
    expect(ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/skillhub')
    expect(route!.kind).toBe('exact')
    // ★引擎语义下它必须命中**自己**那条 exact，而不是 `skill-route.ts` 那条 `/skills` prefix
    //   （那个坑：`skillhub` 会被当成包 id 判 400 —— 与 `third-party`/`discovered` 同一个坑）。
    const all: RegisteredRoute[] = [
      { kind: 'prefix', path: '/enterprise/api/v1/local/skills', handler: async () => undefined },
      route!,
    ]
    expect(engineRouteMatch(all, ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH)).toBe(route!)
    // 反例：不是 exact 的话就会被那条 prefix 抢走。
    const notExact: RegisteredRoute[] = [
      { kind: 'prefix', path: '/enterprise/api/v1/local/skills', handler: async () => undefined },
      { kind: 'prefix', path: ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH, handler: async () => undefined },
    ]
    expect(engineRouteMatch(notExact, ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH)?.kind).toBe('prefix')
  })

  it('★GET 200 且信封单键 `{data}`；四个查询键原样转交；缺省时 `browse()` 收到空对象（浏览模式）', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: unknown }
    expect(Object.keys(body)).toEqual(['data'])
    expect(browse).toHaveBeenCalledTimes(1)
    expect(browse).toHaveBeenCalledWith({})

    const withAll = await get('?q=pdf&category=dev-programming&sort=installs&page=3')
    expect(withAll.status).toBe(200)
    expect(browse).toHaveBeenLastCalledWith({ q: 'pdf', category: 'dev-programming', sort: 'installs', page: '3' })
  })

  it('★非 GET ⇒ 405 + `Allow: GET`，且**一次都不进端口**', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await get('', { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow'), method).toBe('GET')
      expect(await response.json(), method).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(browse).not.toHaveBeenCalled()
  })

  it('★查询键集越界/重复 ⇒ 400 且**一次都不进端口**（`pageSize`、`source`、`sort` 重复）', async () => {
    for (const query of ['?pageSize=9999', '?source=clawhub', '?sort=a&sort=b', '?q=a&q=b']) {
      const response = await get(query)
      expect(response.status, query).toBe(400)
      expect(await response.json(), query).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(browse).not.toHaveBeenCalled()
  })

  it('★端口缺席 ⇒ 明确失败码（502 `ENT_SKILL_SOURCE_UNREACHABLE`），**绝不是 200 空列表**', async () => {
    const empty: RegisteredRoute[] = []
    const port: RegisteredRoute = { kind: 'exact', path: ENTERPRISE_SKILLHUB_BROWSE_LOCAL_PATH, handler: async () => undefined }
    empty.push(port)
    routes = empty
    const error = Object.assign(new Error('boom'), { code: 'ENT_SKILL_SOURCE_UNREACHABLE' })
    expect(projectSkillhubBrowseFailure(error)).toEqual({ status: 502, code: 'ENT_SKILL_SOURCE_UNREACHABLE', step: 'browse-failed' })
    // 无码异常也回落同一枚码，**绝不复述任意字符串**（那会把上游自由文本泄进响应体）。
    const leaky = Object.assign(new Error('/Users/someone/.sshwork/secret'), { code: 'not a code' })
    expect(projectSkillhubBrowseFailure(leaky)).toEqual({ status: 503, code: 'ENT_SKILL_SOURCE_UNREACHABLE', step: 'browse-failed' })
    expect(projectSkillhubBrowseFailure(new TypeError('bad')).status).toBe(400)
  })

  it('★端口抛错 ⇒ 按唯一那张表投影 + `onError` 留 `step=browse-failed` 判定点', async () => {
    browse!.mockRejectedValueOnce(Object.assign(new Error('upstream'), { code: 'ENT_SKILL_SOURCE_UNREACHABLE' }))
    const response = await get()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: { code: 'ENT_SKILL_SOURCE_UNREACHABLE' } })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String(onError.mock.calls[0]![0])).toContain('step=browse-failed')
    expect(String(onError.mock.calls[0]![0])).toContain('status=502')
  })

  it('★响应**键集恰好**是 `{skills,total,categories,page,hasMore}`（多一个键就判畸形）', async () => {
    browse!.mockResolvedValueOnce({
      skills: [{ name: 'x', slug: 'x', version: '1.0.0', installSource: 'skillhub.cn:x@1.0.0' }],
      total: 1,
      categories: [{ key: 'dev-programming', name: '开发编程' }],
      page: 1,
      hasMore: false,
    })
    const body = await (await get()).json() as { readonly data: Record<string, unknown> }
    expect(Object.keys(body.data).sort()).toEqual(['categories', 'hasMore', 'page', 'skills', 'total'])
    expect(Object.keys((body.data['skills'] as unknown[])[0] as object).sort())
      .toEqual(['installSource', 'name', 'slug', 'version'])
  })
})

/* ────────────────────────── 内核面 ────────────────────────── */

describe('browseSkillhubCatalog（浏览模式 / 分类 / 排序 / 分页）', () => {
  let browse: BrowseKernel['browseSkillhubCatalog']

  beforeEach(async () => {
    ;(await freshKernel()).browseSkillhubCatalog // 先触发重新 import，确保模块缓存已重置
    browse = (await freshKernel()).browseSkillhubCatalog
  })

  it('★① 浏览模式：无 `q` ⇒ 自动显示，URL **显式**带 `sortBy=downloads`（不靠上游默认序）', async () => {
    const h = harness({ list: defaultList })
    const result = await browse(h.options, {})
    const url = h.lastListUrl()
    expect(url.pathname).toBe('/api/skills')
    expect(url.searchParams.get('keyword')).toBeNull()
    expect(url.searchParams.get('sortBy')).toBe('downloads')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('pageSize')).toBe(String(SKILLHUB_BROWSE_PAGE_SIZE))
    expect(result.skills).toHaveLength(2)
    expect(result.total).toBe(188534)
    expect(result.page).toBe(1)
    // 188,534 > 100 ⇒ 第一页当然还有下一页。
    expect(result.hasMore).toBe(true)
  })

  it('★② 分类过滤：合法取值放行并进 URL；★不在表内 ⇒ 本地 400 且**一次都不打上游**', async () => {
    const h = harness({ list: defaultList })
    await browse(h.options, { category: 'dev-programming' })
    expect(h.lastListUrl().searchParams.get('category')).toBe('dev-programming')

    for (const bogus of ['totally-bogus-xyz', 'dev programming', 'DEV-PROGRAMMING', '../etc']) {
      const fresh = harness({ list: defaultList })
      await expect(browse(fresh.options, { category: bogus })).rejects.toMatchObject({
        code: 'ENT_INVALID_REQUEST',
      })
      // ★**零列表请求**（分类接口那次是允许的 —— 合法取值集就在它身上）。
      expect(fresh.log.filter(line => line.includes('/api/skills?'))).toEqual([])
    }
  })

  it('★③ 排序逐档：downloads / installs / score 各自的 URL，且缺省是 downloads', async () => {
    // ★真机读数：三档顺序**真的互不相同**（见文件头 ②）⇒ 这里锁的是"真的挑了那一档"，
    //   而不是三档殊途同归。
    for (const sort of SKILLHUB_BROWSE_SORTS) {
      const h = harness({ list: defaultList })
      await browse(h.options, { sort })
      expect(h.lastListUrl().searchParams.get('sortBy'), sort).toBe(sort)
    }
    expect(SKILLHUB_BROWSE_SORTS).toEqual(['downloads', 'installs', 'score'])
    // ★不多写一档：`downloadCount`/`hot`/`newest` 上游全 400（上游原话：`参数错误：sortBy 不合法`）。
    for (const bogus of ['downloadCount', 'hot', 'newest', 'name', 'Downloads']) {
      const fresh = harness({ list: defaultList })
      await expect(browse(fresh.options, { sort: bogus })).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
      expect(fresh.log.filter(line => line.includes('/api/skills?'))).toEqual([])
    }
  })

  it('★④ 分页与 hasMore：按 `page*pageSize < total` 算；最后一页 `false`；`total` 缺席 ⇒ 不编', async () => {
    const withTotal = (total: number): ((url: URL) => Response) => () => skillhubJson(
      JSON.parse(skillList([upstreamRow()], total)),
    )
    // 200 行、pageSize 100 ⇒ 第 2 页正好是尾页。
    const second = harness({ list: withTotal(200) })
    expect((await browse(second.options, { page: 2 })).hasMore).toBe(false)
    // 201 行 ⇒ 第 2 页还有下一页。
    const stillMore = harness({ list: withTotal(201) })
    expect((await browse(stillMore.options, { page: 2 })).hasMore).toBe(true)
    // ★**空数组不等于没有下一页**：上游 `page=999999` 回的是 `code=0` + `skills:[]` + 真 total
    //   （真机 `page=999999` 就是这个形状）。★`hasMore` 在这里仍是 `true`，因为
    //   `20 * 100 = 2000 < total`：按算术还有第 21 页（只是本机闸门把 `page` 收在 20）。
    //   ⇒ **"这一页返回空数组"绝不能被当成"到底了"** —— 那正是"按数组为空判 hasMore"的错法。
    const beyondTotal = 188_535
    const emptyButNotLast = harness({
      list: url => skillhubJson(JSON.parse(skillList(
        Number(url.searchParams.get('page'))! * 100 > beyondTotal ? [] : [upstreamRow()],
        beyondTotal,
      ))),
    })
    // 用第 2000 行之后才越界的夹具：page=20 时 20*100=2000 ≤ 188535 ⇒ 上游**该回行**，
    // 所以这里改用一个 total 小到"第 20 页已越过"的夹具，才能真正拿到空数组。
    const smallTotal = 1_500
    const reallyEmpty = harness({
      list: url => skillhubJson(JSON.parse(skillList(
        Number(url.searchParams.get('page'))! * 100 > smallTotal ? [] : [upstreamRow()],
        smallTotal,
      ))),
    })
    const beyond = await browse(reallyEmpty.options, { page: 20 })
    expect(beyond.skills).toEqual([])
    expect(beyond.total).toBe(smallTotal)
    expect(beyond.hasMore).toBe(false)
    // 同一个 `total` 下第 15 页（1500 = 尾页边界）之后仍有下一页的那一格：
    expect((await browse(reallyEmpty.options, { page: 10 })).hasMore).toBe(true)
    void emptyButNotLast
    // `total` 读不懂 ⇒ **整键不产出**且 `hasMore:false`（绝不编一个 0 或一个乐观的 true）。
    const noTotal = harness({ list: () => skillhubJson({ code: 0, data: { skills: [upstreamRow()] }, message: 'success' }) })
    const partial = await browse(noTotal.options, {})
    expect(Object.keys(partial)).not.toContain('total')
    expect(partial.hasMore).toBe(false)
  })

  it('★⑤ 非法 page（0 / -1 / 1.5 / 1e3 / 超上限 / 非数字 / 带空格）⇒ 400 且零上游调用', async () => {
    // ★`''` 与 `null`/`undefined` 是**同一件事**（"没给" ⇒ 缺省 1），**不是**非法值：
    //   界面上 `?page=` 那种空参数是常客，把它判 400 只会制造一个用户修不好的错误。
    //   `'1e3'`/`' 1'`/`'01'` 一律拒——我们**不替上游猜**它在想什么（上游那侧我们只发自己拼好的十进制串）。
    for (const page of ['0', '-1', '1.5', '1e3', 'abc', ' ', '01', String(SKILLHUB_BROWSE_MAX_PAGE + 1), '999999', '1.0']) {
      const h = harness({ list: defaultList })
      await expect(browse(h.options, { page }), page).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
      expect(h.log.filter(line => line.includes('/api/skills?')), page).toEqual([])
    }
    // 边界值合法：缺省 / 空串 / 1 与上限本身。
    expect(SKILLHUB_BROWSE_MAX_PAGE).toBe(20)
    for (const page of ['', undefined, 1, SKILLHUB_BROWSE_MAX_PAGE, String(SKILLHUB_BROWSE_MAX_PAGE)]) {
      const h = harness({ list: defaultList })
      await expect(browse(h.options, { page }), String(page)).resolves.toBeDefined()
      expect(h.lastListUrl().searchParams.get('page'), String(page))
        .toBe(String(page === '' || page === undefined ? 1 : page))
    }
  })

  it('★超长 `q` ⇒ 400 且零上游调用；上限与在线搜索**同一个常量**', async () => {
    expect(SKILLHUB_BROWSE_MAX_Q_LENGTH).toBe(MAX_QUERY_LENGTH)
    const h = harness({ list: defaultList })
    await expect(browse(h.options, { q: 'x'.repeat(MAX_QUERY_LENGTH + 1) }))
      .rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
    expect(h.log.filter(line => line.includes('/api/skills?'))).toEqual([])
    // 控制字符同样拒。
    const ctl = harness({ list: defaultList })
    await expect(browse(ctl.options, { q: 'a\u0000b' })).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
    expect(ctl.log.filter(line => line.includes('/api/skills?'))).toEqual([])
    // 空串 = 回到浏览模式（**不是** 0 条结果，也不是 400）。
    const blank = harness({ list: defaultList })
    await browse(blank.options, { q: '' })
    expect(blank.lastListUrl().searchParams.get('keyword')).toBeNull()
  })

  it('★⑥ 上游失败 ⇒ 明确码 `ENT_SKILL_SOURCE_UNREACHABLE`（502），**绝不折成空列表**', async () => {
    const cases: readonly (readonly [string, () => Response])[] = [
      ['非 200', () => respond(503, 'nope')],
      ['不是 JSON', () => respond(200, 'not json at all')],
      ['code 非 0', () => respond(200, JSON.stringify({ code: 500, data: { skills: [], total: 0 }, message: 'err' }))],
      ['data 缺席', () => respond(200, JSON.stringify({ code: 0, message: 'success' }))],
      ['skills 不是数组', () => respond(200, JSON.stringify({ code: 0, data: { skills: {}, total: 1 }, message: 'success' }))],
      ['行没有 name', () => respond(200, skillList([{ slug: 'x', version: '1.0.0' }], 1))],
      ['网络抛错', () => { throw new Error('ECONNRESET') }],
    ]
    for (const [label, list] of cases) {
      const h = harness({ list })
      await expect(browse(h.options, {}), label).rejects.toMatchObject({
        code: 'ENT_SKILL_SOURCE_UNREACHABLE',
      })
    }
  })

  it('★⑦ `installSource` 与既有安装链**逐字一致**（能被 `parseSkillhubReference` 解回两段）', async () => {
    const h = harness({ list: defaultList })
    const result = await browse(h.options, {})
    for (const skill of result.skills) {
      expect(skill.installSource).toBe(`skillhub.cn:${skill.slug}@${skill.version}`)
      const prefix = 'skillhub.cn:'
      expect(skill.installSource.startsWith(prefix)).toBe(true)
      // ★**同一把尺**：既有安装侧那个解析器必须原样解得开（解不开 = 界面点安装会拿到 400）。
      expect(parseSkillhubReference(skill.installSource.slice(prefix.length))).toEqual({
        slug: skill.slug,
        version: skill.version,
      })
    }
    expect(result.skills[0]!.installSource).toBe('skillhub.cn:dev-expert@2.0.3')
  })

  it('★⑧ 出厂投影：`description_zh` 优先；**上游原始字段与宿主路径一律不出厂**；计数缺席整键不产出', async () => {
    const h = harness({
      list: () => skillhubJson(JSON.parse(skillList([
        upstreamRow(),
        // `description_zh` 是空串 ⇒ 回落到 `description`（**空串当没说**，不是"有个空描述"）。
        upstreamRow({ name: 'b', slug: 'b', version: '1.0.0', description_zh: '', description: 'fallback' }),
        // `installs`/`stars`/`downloads` 是负数 ⇒ 那一格「没说」，**绝不编成 0**。
        upstreamRow({ name: 'c', slug: 'c', version: '1.0.0', installs: -1, stars: undefined, downloads: 'lots' }),
      ], 3))),
    })
    const result = await browse(h.options, {})
    expect(result.skills[0]!.description).toBe('中文描述')
    expect(result.skills[1]!.description).toBe('fallback')
    // ★`installs: 0`（真 0）**要产出** —— "平台说 0"与"平台没说"分得开。
    expect(result.skills[0]!.installs).toBe(0)
    // 第 3 行：`installs: -1`、`stars` 缺席、`downloads: 'lots'` ⇒ **三个计数格整键不产出**
    //   （`onlineCountOf` 那把尺：非有限/负数/非数值一律"没说"，绝不折成 0）。
    //   而 `category`/`description` 那一行仍成立（它们**本来就报过**），所以行键集是
    //   {name, slug, category, description, version, installSource} —— 少三枚计数格，多一枚都没有。
    expect(Object.keys(result.skills[2]!).sort())
      .toEqual(['category', 'description', 'installSource', 'name', 'slug', 'version'])
    for (const absent of ['installs', 'stars', 'downloads']) {
      expect(result.skills[2]![absent as 'installs'], absent).toBeUndefined()
    }

    const serialized = JSON.stringify(result)
    // ★反向锁：上游那些富字段与宿主路径**一个都不许出厂**。
    for (const forbidden of ['namespace', 'canonicalName', 'iconUrl', 'homepage', 'ownerName', 'labels',
      'requires_api_key', 'tags', 'subCategories', '代码生成', 'upstream_url', 'claim_state', 'verified',
      'claimable', 'score', 'created_at', 'updated_at', 'isServiceized', 'last_synced_at',
      'claimed_user_handle', 'upstream_owner_login', 'source', '/Users/', '.sshwork']) {
      expect(serialized, forbidden).not.toContain(forbidden)
    }
    // ★也不许整份上游载荷原样写出。
    expect(serialized).not.toBe(JSON.stringify({ data: JSON.parse(skillList([upstreamRow()], 1)) }))
  })

  it('★⑧b 按条丢弃：坐标形状不合的行丢掉、**计数留痕**，且响应**不加键**', async () => {
    const h = harness({
      list: () => skillhubJson(JSON.parse(skillList([
        upstreamRow(),
        upstreamRow({ name: 'bad', slug: '', version: '1.0.0' }),
        upstreamRow({ name: 'bad2', slug: 'ok', version: 'bad version!' }),
        upstreamRow({ name: 'ok2', slug: 'ok2', version: '1.0.0' }),
      ], 4))),
    })
    const result = await browse(h.options, {})
    expect(result.skills.map(skill => skill.slug)).toEqual(['dev-expert', 'ok2'])
    // ★`dropped` 只进 `onError`，**绝不出现在响应键里**（键集是冻结的）。
    expect(Object.keys(result).sort()).toEqual(['categories', 'hasMore', 'page', 'skills', 'total'])
    expect(h.onError).toHaveBeenCalledTimes(1)
    expect(String(h.onError.mock.calls[0]![0])).toContain('dropped 2')
  })

  it('★⑨ 分类表：13 枚带中文名出厂、**带 TTL 缓存**（不每页打一次）、失败则整键不产出且不拖累列表', async () => {
    const first = harness({ list: defaultList })
    const one = await browse(first.options, {})
    expect(one.categories).toHaveLength(13)
    expect(one.categories![0]).toEqual({ key: 'pay-skill', name: 'Pay Skill', nameEn: 'Pay Skill' })
    expect(one.categories!.find(entry => entry.key === 'dev-programming')!.name).toBe('开发编程')
    expect(first.categoryCalls()).toBe(1)

    // ★**同一个进程、同一个 TTL 内**：第二次浏览**不再**打分类接口（缓存的整个理由）。
    const second = await browse(first.options, { page: 2 })
    expect(second.categories).toHaveLength(13)
    expect(first.categoryCalls()).toBe(1)
    // 过了 TTL ⇒ 重新取。
    first.advance(SKILLHUB_BROWSE_CATEGORY_TTL_MS)
    await browse(first.options, {})
    expect(first.categoryCalls()).toBe(2)
    expect(SKILLHUB_BROWSE_CATEGORY_TTL_MS).toBe(3_600_000)

    // ★**分类表挂了但列表好好的** ⇒ `categories` **整键不产出**，列表照常 200（主次不倒）。
    //   ★**必须重新 import**：上面那段已经用 `first` 把分类表缓存热了，同一个模块实例里
    //   第二次根本不会去打分类接口 —— 那这条就测不到"失败"这条路了（这正是缓存必须独立验证的原因）。
    const coldBrowse = (await freshKernel()).browseSkillhubCatalog
    const degraded = harness({ list: defaultList, categories: () => respond(500, 'boom') })
    const partial = await coldBrowse(degraded.options, {})
    expect(Object.keys(partial)).not.toContain('categories')
    expect(partial.skills).toHaveLength(2)
    expect(degraded.onError).toHaveBeenCalled()

    // ★形状读不懂（`items` 不是数组 / 全是坏行）同样整键不产出，**绝不编、绝不回落空数组**。
    //   ★两次都重新 import（否则会命中上面那次失败的缓存，"不产出"就变成"因为压根没去取"）。
    const garbageBrowse = (await freshKernel()).browseSkillhubCatalog
    const garbage = harness({ list: defaultList, categories: () => skillhubJson({ count: 0, items: 'nope' }) })
    expect(Object.keys(await garbageBrowse(garbage.options, {}))).not.toContain('categories')
    const badRowsBrowse = (await freshKernel()).browseSkillhubCatalog
    const badRows = harness({ list: defaultList, categories: () => skillhubJson({ items: [{ key: 'X Y', name: '坏' }, { name: '没 key' }] }) })
    expect(Object.keys(await badRowsBrowse(badRows.options, {}))).not.toContain('categories')
  })

  it('★⑩ 只读：全程不碰磁盘、零 exec/spawn/动态 import；★既有 `/skills/online-search` 与四源 fan-out **一字未改**', async () => {
    const srcDir = new URL('../src/', import.meta.url)
    const browser = await readFile(new URL('skillhub-browser.ts', srcDir), 'utf8')
    const route = await readFile(new URL('skillhub-browser-route.ts', srcDir), 'utf8')
    for (const [label, source] of [['kernel', browser], ['route', route]] as const) {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, label).not.toMatch(/\bexec(File|Sync)?\s*\(/)
      expect(code, label).not.toMatch(/\bspawn\w*\s*\(/)
      expect(code, label).not.toMatch(/\bchild_process\b/)
      expect(code, label).not.toContain('import(')
    }
    // ★**反向锁**：既有在线搜索的第四源 endpoint 与四源声明一字未改（我们只加出口，不改行为）。
    const online = await readFile(new URL('skill-online.ts', srcDir), 'utf8')
    expect(online).toContain('https://api.skillhub.cn/api/skills?keyword=${encodeURIComponent(query)}&page=1&pageSize=20&sortBy=score')
    expect(online).toContain("export const ONLINE_SKILL_SOURCE_IDS = ['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'skillhub.cn']")
    // ★新面**没有**偷偷用带凭据的平台面（那等于把企业令牌发给公网）。
    expect(browser).not.toContain('enterprisePlatform')
    expect(browser).not.toContain('Authorization')
    // ★`pageSize` 常量必须就是上游硬上限 100（多要一字节就是拿 400 换一次失败）。
    expect(SKILLHUB_BROWSE_PAGE_SIZE).toBe(100)
  })
})
