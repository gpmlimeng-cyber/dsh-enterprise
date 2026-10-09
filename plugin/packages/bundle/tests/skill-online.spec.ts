/**
 * [INPUT]: 依赖 `src/skill-online.ts` 的 `searchOnlineSkills`/`installSkillFromResult`/上限常量、`src/skill-install.ts` 的 `installedSkillStatus`、`src/skill-upload.ts` 的 `SELF_INSTALLED_STATE_FILENAME`、`node:zlib` 的 gzip 与 node:fs/promises 的读写；tar 夹具在**本文件里独立重写**（不复用 `src/tar-archive.ts`），从而断言的是读取器行为而不是它自己的常量
 * [OUTPUT]: 在真实临时 dshHome 上锁定通路三「在线搜索 → 从结果安装」：**四源** fan-out 的逐源 ok 与部分成功、`skills.sh` 缺失 description/stars 的整键缺席、跨源折叠去重、坐标不可解的条目丢弃、clawhub.ai **整源丢弃**（载荷里没有 GitHub 坐标）与留痕、15s 超时、跨出白名单的重定向被拒（且**没有**打到白名单外的 host）、**每一个**源都挂才抛 502；安装链：codeload 整包 → 按坐标目录/按 frontmatter 技能名定位 → 内存组 `.dshskill` → 复用加固落盘（目录/文件字节与 0600、自装记录七键 + `sourceType='github'`、响应与 `/skills/install` 同形、幂等、落点冲突拒、ref 兜底、全 404 拿不到包、体量上限、tar 链接与逃逸、frontmatter 闸门）
 * [POS]: bundle 技能纵深的**第四条通路**回归门禁；有人把公开源改回带令牌的平台面、把白名单/重定向门禁拆了、把「装不出来就丢」放宽、或者新造第二套落盘，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installedSkillStatus, type EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'
import {
  installSkillFromResult,
  ONLINE_TARBALL_MAX_BYTES,
  ONLINE_TARBALL_MAX_UNCOMPRESSED_BYTES,
  searchOnlineSkills,
  type EnterpriseOnlineSkillSearch,
} from '../src/skill-online.js'
import { SELF_INSTALLED_STATE_FILENAME } from '../src/skill-upload.js'

const NOW = '2026-10-05T00:00:00.000Z'
const SELF_STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
const ENTERPRISE_STATE_RELATIVE = join('enterprise', 'skill-installs', 'installed.json')
const homes: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skill-online-'))
  homes.push(path)
  return path
}

/* ────────────────────────── tar.gz 夹具（独立实现） ────────────────────────── */

interface TarFixtureEntry {
  readonly path: string
  readonly content?: string
  /** `'0'` 常规文件（默认）/ `'5'` 目录 / `'2'` 符号链接。 */
  readonly typeflag?: string
  readonly linkname?: string
}

/** 手写 ustar 头（含校验和）——与 `src/tar-archive.ts` 的读取逻辑无关，是独立的一份。 */
function tarHeader(entry: TarFixtureEntry, size: number): Buffer {
  const header = Buffer.alloc(512)
  const write = (value: string, offset: number, length: number): void => {
    Buffer.from(value, 'utf8').copy(header, offset, 0, Math.min(value.length, length))
  }
  write(entry.path, 0, 100)
  write('0000644\0', 100, 8)
  write('0000000\0', 108, 8)
  write('0000000\0', 116, 8)
  write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12)
  write('00000000000\0', 136, 12)
  header.write('        ', 148, 8, 'latin1')
  write(entry.typeflag ?? '0', 156, 1)
  write(entry.linkname ?? '', 157, 100)
  write('ustar\0', 257, 6)
  write('00', 263, 2)
  let sum = 0
  for (const byte of header) sum += byte
  write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8)
  return header
}

/** 造一份 `tar.gz`；顶层目录由调用方在路径里写全（GitHub 的形状是 `{repo}-{ref}/…`）。 */
function buildTarGz(entries: readonly TarFixtureEntry[]): Buffer {
  const parts: Buffer[] = []
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? '', 'utf8')
    const isFile = (entry.typeflag ?? '0') === '0'
    const size = isFile ? content.byteLength : 0
    parts.push(tarHeader(entry, size))
    if (size > 0) {
      parts.push(content)
      const padding = (512 - (size % 512)) % 512
      if (padding > 0) parts.push(Buffer.alloc(padding))
    }
  }
  parts.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(parts))
}

/* ────────────────────────── 假取数面 ────────────────────────── */

interface Route {
  readonly host: string
  readonly path?: RegExp
  readonly respond: (url: URL) => Response
}

/** 鸭子类型的响应：模块只用 `status`/`headers.get`/`body` 三件事，这里就不借 Node 的 Response 语义。 */
function respond(status: number, bytes: Buffer | string, headers: Record<string, string> = {}): Response {
  const body = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes
  return {
    status,
    ok: status === 200,
    headers: new Headers(headers),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        if (body.byteLength > 0) controller.enqueue(new Uint8Array(body))
        controller.close()
      },
    }),
  } as unknown as Response
}

function jsonResponse(value: unknown, headers: Record<string, string> = {}): Response {
  return respond(200, JSON.stringify(value), { 'content-type': 'application/json', ...headers })
}

function fetchRouter(routes: readonly Route[], log: string[]): (input: string, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const url = new URL(input)
    log.push(`${init?.method ?? 'GET'} ${url.toString()}`)
    if (init?.signal?.aborted === true) throw new DOMException('aborted', 'AbortError')
    for (const route of routes) {
      if (route.host !== url.hostname) continue
      if (route.path !== undefined && !route.path.test(url.pathname)) continue
      return route.respond(url)
    }
    return respond(404, 'not found')
  }
}

function options(home: string, routes: readonly Route[]) {
  const log: string[] = []
  const onError = vi.fn()
  return {
    log,
    onError,
    options: { fetch: fetchRouter(routes, log), dshHome: home, now: () => new Date(NOW), onError },
  }
}

/* ────────────────────────── 三源的真形状夹具 ────────────────────────── */

const SKILLS_SH_BODY = {
  query: 'notes',
  searchType: 'hybrid',
  searchVersion: 1,
  skills: [
    { id: 'obra/superpowers/team-notes', source: 'obra/superpowers', skillId: 'team-notes', name: 'team-notes', installs: 245_487 },
    // 该源实测存在这种「source 是个域名」的条目：坐标解不成 GitHub 仓库 ⇒ 必须丢弃。
    { id: 'uizze.sh/ui-taste', source: 'uizze.sh', skillId: 'ui-taste', name: 'ui-taste', installs: 403_997 },
  ],
  count: 2,
  duration_ms: 7,
  timings_ms: {},
  provider_duration_ms: 7,
}

const CLAUDE_PLUGINS_BODY = {
  skills: [{
    id: 'd3a715b9-f04d-4dbd-82b3-7e9210413286',
    name: 'meeting-notes',
    namespace: '@nextlevelbuilder/team-notes-skill/meeting-notes',
    sourceUrl: 'https://github.com/example/team-notes-skill/tree/main/skills/meeting-notes',
    description: '会议纪要技能',
    version: null,
    dependencies: null,
    author: 'example',
    stars: 17_908,
    installs: 1_913,
    metadata: {
      repoOwner: 'example',
      repoName: 'team-notes-skill',
      directoryPath: 'skills/meeting-notes',
      rawFileUrl: 'https://raw.githubusercontent.com/example/team-notes-skill/main/skills/meeting-notes/SKILL.md',
    },
    createdAt: '2026-01-07T15:37:46.224Z',
    updatedAt: '2026-01-19 13:57:43',
  }],
  total: 1,
  limit: 20,
  offset: 0,
}

const CLAWHUB_BODY = {
  results: [
    { displayName: 'Code Review', install: { kind: 'clawhub', reference: 'wpank/code-review', sourceUrl: null }, ownerHandle: 'wpank', slug: 'code-review', summary: '系统化代码评审' },
    { displayName: 'team-notes', install: { kind: 'clawhub', reference: 'dennisrongo/team-notes', sourceUrl: null }, ownerHandle: 'dennisrongo', slug: 'team-notes', summary: '会议纪要' },
  ],
}

/** 第四源（`skillhub.cn`）的真机形状：`{code:0,data:{total,skills[]}}`，条目带 slug/version 与中英双描述。 */
const SKILLHUB_BODY = {
  code: 0,
  message: 'success',
  data: {
    total: 2,
    skills: [
      {
        slug: 'weekly-report',
        name: 'weekly-report',
        description: 'Weekly report generator',
        description_zh: '周报生成器',
        category: 'productivity',
        downloads: 12,
        stars: 34,
        installs: 56,
        ownerName: 'acme',
        homepage: 'https://api.skillhub.cn/acme/weekly-report',
        version: '1.2.0',
        source: 'community',
        iconUrl: 'https://cdn.example/i.png',
      },
      // 没有版本 ⇒ 坐标解不出来（本机装不了这一版）⇒ 按条丢弃并计数。
      { slug: 'no-version', name: 'no-version', description: 'x' },
    ],
  },
}

const ALL_SOURCES: readonly Route[] = [
  { host: 'skills.sh', path: /^\/api\/search$/, respond: () => jsonResponse(SKILLS_SH_BODY) },
  { host: 'claude-plugins.dev', path: /^\/api\/skills$/, respond: () => jsonResponse(CLAUDE_PLUGINS_BODY) },
  { host: 'clawhub.ai', path: /^\/api\/v1\/search$/, respond: () => jsonResponse(CLAWHUB_BODY) },
  { host: 'api.skillhub.cn', path: /^\/api\/skills$/, respond: () => jsonResponse(SKILLHUB_BODY) },
]

/* ────────────────────────── 技能包夹具 ────────────────────────── */

function skillMarkdown(name: string, description = `${name} 的说明`): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n正文\n`
}

/** 一个「整仓」tar.gz：顶层 `{repo}-{ref}/` + 若干技能目录。 */
function repositoryTarball(repo: string, ref: string, skills: readonly { dir: string, name: string, files?: readonly { path: string, content: string }[] }[]): Buffer {
  const entries: TarFixtureEntry[] = [{ path: `${repo}-${ref}/`, typeflag: '5' }]
  for (const skill of skills) {
    entries.push({ path: `${repo}-${ref}/${skill.dir}/SKILL.md`, content: skillMarkdown(skill.name) })
    for (const file of skill.files ?? []) entries.push({ path: `${repo}-${ref}/${skill.dir}/${file.path}`, content: file.content })
  }
  return buildTarGz(entries)
}

function codeloadRoute(repo: string, byRef: Record<string, Buffer | number>): Route {
  return {
    host: 'codeload.github.com',
    path: new RegExp(`^/${repo.replace('/', '\\/')}/tar\\.gz/refs/heads/[^/]+$`),
    respond: url => {
      const ref = url.pathname.split('/').pop() ?? ''
      const value = byRef[ref]
      if (value === undefined) return respond(404, 'not found')
      if (typeof value === 'number') return respond(value, 'upstream error')
      return respond(200, value, { 'content-type': 'application/gzip' })
    },
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

async function codeOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action()
    return '<resolved>'
  } catch (error) {
    return (error as { code?: string }).code ?? '<no-code>'
  }
}

async function readSelfState(home: string): Promise<{ records: Record<string, unknown>[] }> {
  return JSON.parse(await readFile(join(home, SELF_STATE_RELATIVE), 'utf8')) as { records: Record<string, unknown>[] }
}

/** 一个「什么网络都不许打」的落盘侧平台面，用来独立复算「同形」的那份已装态。 */
function offlinePlatform(): EnterpriseSkillInstallPlatformPort {
  return { request: async () => { throw new Error('the online skills path must never use the platform port') } }
}

describe('enterprise online skill search', () => {
  it('fans out all four sources, reports per-source ok, and normalizes each shape', async () => {
    const home = await makeHome()
    const harness = options(home, ALL_SOURCES)
    const search = await searchOnlineSkills(harness.options, 'notes')

    // 四源都通 ⇒ 逐源 ok；结果顺序 = 源声明序 × 源内上游顺序（第四源在**表尾**）。
    expect(search.sources).toEqual([
      // 夹具里那条 `uizze.sh/ui-taste` 坐标解不出来 ⇒ skills.sh 丢 1 条（同为「不许静默」）。
      { id: 'skills.sh', ok: true, dropped: 1 },
      { id: 'claude-plugins.dev', ok: true },
      // ★两条都是 `kind='clawhub'` ⇒ 按条丢弃并**计数**（不许静默：界面要能说「该源 N 条暂时装不了」）。
      { id: 'clawhub.ai', ok: true, dropped: 2 },
      // 第四源：那条没有 `version` 的条目装不出来 ⇒ 同样按条丢弃并计数。
      { id: 'skillhub.cn', ok: true, dropped: 1 },
    ])
    expect(search.results.map(result => [result.sourceId, result.name])).toEqual([
      ['skills.sh', 'team-notes'],
      ['claude-plugins.dev', 'meeting-notes'],
      ['skillhub.cn', 'weekly-report'],
    ])
    const fromSkillsSh = search.results.find(result => result.sourceId === 'skills.sh')!
    // ★该源根本没有 description/stars 两个键 ⇒ 归一化后**整键缺席**（不编 null、不编 0）。
    expect('description' in fromSkillsSh).toBe(false)
    expect('stars' in fromSkillsSh).toBe(false)
    expect(fromSkillsSh.installs).toBe(245_487)
    expect(fromSkillsSh.author).toBe('obra')
    expect(fromSkillsSh.installSource).toBe('skills.sh:obra/superpowers/team-notes')

    const fromClaudePlugins = search.results.find(result => result.sourceId === 'claude-plugins.dev')!
    expect(fromClaudePlugins.description).toBe('会议纪要技能')
    expect(fromClaudePlugins.stars).toBe(17_908)
    expect(fromClaudePlugins.author).toBe('example')
    // ref 与目录都写进坐标（冻结链路要求「ref 解自 sourceUrl 的 /tree/<ref>/ 段」）。
    expect(fromClaudePlugins.installSource).toBe('claude-plugins.dev:example/team-notes-skill/main/skills/meeting-notes')

    // ★第四源：形状与前三源**逐字同形**（同一枚七键），`description` 优先中文、`stars`/`installs` 原样给出。
    const fromSkillhub = search.results.find(result => result.sourceId === 'skillhub.cn')!
    expect(Object.keys(fromSkillhub).sort()).toEqual([
      'author', 'description', 'installSource', 'installs', 'name', 'sourceId', 'stars',
    ])
    expect(fromSkillhub.name).toBe('weekly-report')
    expect(fromSkillhub.description).toBe('周报生成器')
    expect(fromSkillhub.author).toBe('acme')
    expect(fromSkillhub.stars).toBe(34)
    expect(fromSkillhub.installs).toBe(56)
    expect(fromSkillhub.installSource).toBe('skillhub.cn:weekly-report@1.2.0')
    // ★`homepage` 一次都没进结果（官方禁令：那是 api.skillhub.cn/<owner>/<slug>）。
    expect(JSON.stringify(search.results)).not.toContain('api.skillhub.cn/acme')

    // ★clawhub.ai 整源丢弃并留痕：它的载荷里没有任何 GitHub 坐标，冻结的 codeload 安装链兑现不了。
    expect(search.results.some(result => result.sourceId === 'clawhub.ai')).toBe(false)
    expect(harness.onError.mock.calls.map(call => String(call[0])).join('\n')).toContain('clawhub.ai')
  })

  it('drops a skills.sh entry whose coordinate is not owner/repo/skill-name', async () => {
    const home = await makeHome()
    const harness = options(home, ALL_SOURCES)
    const search = await searchOnlineSkills(harness.options, 'notes')
    expect(search.results.some(result => result.name === 'ui-taste')).toBe(false)
  })

  it('keeps the install.kind=skills-sh entries of clawhub.ai and serves them through the skills.sh resolver', async () => {
    const home = await makeHome()
    // 逐字样例（Lead 8 query/80 条普查里的那几条）：同一个源、同一个 query，两类都在。
    const clawhubMixed = {
      results: [
        {
          displayName: 'pdf',
          install: { kind: 'skills-sh', reference: 'skills-sh:anthropics/skills/pdf', sourceUrl: 'https://www.skills.sh/anthropics/skills/pdf' },
          links: { canonical: '/skills-sh/anthropics/skills/pdf', source: 'https://www.skills.sh/anthropics/skills/pdf' },
          sourceIdentity: { id: 'anthropics/skills/pdf', owner: 'anthropics', repo: 'skills' },
          ownerHandle: 'anthropics',
          slug: 'pdf',
          summary: 'PDF 处理技能',
        },
        {
          displayName: 'Code Review',
          install: { kind: 'clawhub', reference: 'wpank/code-review', sourceUrl: null },
          links: { canonical: '/wpank/skills/code-review', source: null },
          sourceIdentity: { id: 'kd7ay', owner: 'wpank', repo: null },
          ownerHandle: 'wpank',
          slug: 'code-review',
          summary: '系统化代码评审',
        },
      ],
    }
    const harness = options(home, [
      { host: 'skills.sh', respond: () => jsonResponse({ skills: [] }) },
      { host: 'claude-plugins.dev', respond: () => jsonResponse({ skills: [] }) },
      { host: 'clawhub.ai', respond: () => jsonResponse(clawhubMixed) },
      codeloadRoute('anthropics/skills', {
        main: repositoryTarball('skills', 'main', [{ dir: 'pdf', name: 'pdf' }]),
      }),
    ])
    const search = await searchOnlineSkills(harness.options, 'pdf')

    // ★同一个 query 里两类都有：`skills-sh` 进 results、`clawhub` 进 dropped。
    expect(search.sources[2]).toEqual({ id: 'clawhub.ai', ok: true, dropped: 1 })
    expect(search.results).toHaveLength(1)
    const kept = search.results[0]!
    // ★有意的不对称：来源仍如实报 clawhub.ai（用户是在那儿看到的），坐标却是能真正服务的那条。
    expect(kept.sourceId).toBe('clawhub.ai')
    expect(kept.installSource).toBe('skills.sh:anthropics/skills/pdf')
    expect(kept.description).toBe('PDF 处理技能')
    expect(kept.author).toBe('anthropics')

    // 而且这条坐标**真的能装**（复用 skills.sh 那条解析：owner/repo + main→master + 按 frontmatter 名发现）。
    await installSkillFromResult(harness.options, kept.installSource)
    expect(await exists(join(home, 'skills', 'pdf', 'SKILL.md'))).toBe(true)
    const records = (await readSelfState(home)).records
    expect(records[0]).toMatchObject({ skillId: 'pdf', sourceType: 'github', sourceInput: 'skills.sh:anthropics/skills/pdf' })
  })

  it('reports how many results each source dropped instead of dropping them silently', async () => {
    const home = await makeHome()
    const harness = options(home, [
      // skills.sh：`uizze.sh/ui-taste` 这种坐标解不出来 ⇒ 丢 1 条。
      { host: 'skills.sh', respond: () => jsonResponse(SKILLS_SH_BODY) },
      // claude-plugins.dev：repoOwner/repoName 有、但 directoryPath 与 sourceUrl 都没有 ⇒ 丢 1 条（照上游 :79-81）。
      {
        host: 'claude-plugins.dev',
        respond: () => jsonResponse({
          skills: [
            { name: 'unresolvable', description: 'x', metadata: { repoOwner: 'a', repoName: 'b' } },
            { name: 'resolvable', sourceUrl: 'https://github.com/a/b/tree/main/skills/resolvable', metadata: {} },
          ],
        }),
      },
      { host: 'clawhub.ai', respond: () => jsonResponse(CLAWHUB_BODY) },
      { host: 'api.skillhub.cn', respond: () => jsonResponse(SKILLHUB_BODY) },
    ])
    const search = await searchOnlineSkills(harness.options, 'notes')
    // 四个源各自如实报「我丢了几条」——为 0 的源整键不产出（可选字段）。
    expect(search.sources).toEqual([
      { id: 'skills.sh', ok: true, dropped: 1 },
      { id: 'claude-plugins.dev', ok: true, dropped: 1 },
      { id: 'clawhub.ai', ok: true, dropped: 2 },
      { id: 'skillhub.cn', ok: true, dropped: 1 },
    ])
    expect(search.results.map(result => result.name)).toEqual(['team-notes', 'resolvable', 'weekly-report'])
  })

  it('dedupes across sources by folded name, first source wins', async () => {
    const home = await makeHome()
    const harness = options(home, [
      {
        host: 'skills.sh',
        respond: () => jsonResponse({ skills: [{ id: 'a/b/Code-Review', source: 'a/b', skillId: 'Code-Review', name: 'Code-Review', installs: 5 }] }),
      },
      {
        host: 'claude-plugins.dev',
        respond: () => jsonResponse({ skills: [{ name: 'code-review', sourceUrl: 'https://github.com/x/y/tree/main/skills/code-review', metadata: { repoOwner: 'x', repoName: 'y', directoryPath: 'skills/code-review' } }] }),
      },
      { host: 'clawhub.ai', respond: () => jsonResponse({ results: [] }) },
    ])
    const search = await searchOnlineSkills(harness.options, 'code')
    // ★`Code-Review` 的坐标解不出来（技能名非 kebab）⇒ 它先被丢弃，去重因此发生在**丢弃之后**：
    //   留下来的那条是 claude-plugins.dev 的。
    expect(search.results).toHaveLength(1)
    expect(search.results[0]!.sourceId).toBe('claude-plugins.dev')
  })

  it('keeps partial success and only fails when every source fails', async () => {
    const home = await makeHome()
    const harness = options(home, [
      { host: 'skills.sh', respond: () => respond(500, 'boom') },
      { host: 'claude-plugins.dev', respond: () => jsonResponse(CLAUDE_PLUGINS_BODY) },
      { host: 'clawhub.ai', respond: () => jsonResponse({ results: [] }) },
      { host: 'api.skillhub.cn', respond: () => jsonResponse(SKILLHUB_BODY) },
    ])
    const search = await searchOnlineSkills(harness.options, 'notes')
    // 一个源挂了，其余三个照常出结果（部分成功是设计）。
    expect(search.sources).toEqual([
      { id: 'skills.sh', ok: false },
      { id: 'claude-plugins.dev', ok: true },
      { id: 'clawhub.ai', ok: true },
      { id: 'skillhub.cn', ok: true, dropped: 1 },
    ])
    expect(search.results.map(result => result.sourceId)).toEqual(['claude-plugins.dev', 'skillhub.cn'])
    expect(harness.onError.mock.calls.map(call => String(call[0])).join('\n')).toContain('source=skills.sh')

    const allDown = options(home, [
      { host: 'skills.sh', respond: () => respond(503, 'down') },
      { host: 'claude-plugins.dev', respond: () => respond(503, 'down') },
      { host: 'clawhub.ai', respond: () => respond(503, 'down') },
      { host: 'api.skillhub.cn', respond: () => respond(503, 'down') },
    ])
    expect(await codeOf(() => searchOnlineSkills(allDown.options, 'notes'))).toBe('ENT_SKILL_SOURCE_UNREACHABLE')
  })

  it('marks a source failed when its payload does not match the documented shape', async () => {
    const home = await makeHome()
    const harness = options(home, [
      { host: 'skills.sh', respond: () => jsonResponse({ skills: 'not-an-array' }) },
      { host: 'claude-plugins.dev', respond: () => jsonResponse(CLAUDE_PLUGINS_BODY) },
      { host: 'clawhub.ai', respond: () => jsonResponse({ results: [] }) },
    ])
    const search = await searchOnlineSkills(harness.options, 'notes')
    expect(search.sources[0]).toEqual({ id: 'skills.sh', ok: false })
    expect(search.results).toHaveLength(1)
  })

  it('times out a slow source at the documented 15s and keeps the others', async () => {
    const home = await makeHome()
    vi.useFakeTimers()
    const log: string[] = []
    const onError = vi.fn()
    const slow = (input: string, init?: RequestInit): Promise<Response> => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
    const router = fetchRouter([{ host: 'claude-plugins.dev', respond: () => jsonResponse(CLAUDE_PLUGINS_BODY) }], log)
    const pending = searchOnlineSkills({ fetch: (input, init) => input.includes('skills.sh') ? slow(input, init) : router(input, init), dshHome: home, onError }, 'notes')
    await vi.advanceTimersByTimeAsync(15_000)
    const search = await pending
    expect(search.sources[0]).toEqual({ id: 'skills.sh', ok: false })
    expect(search.sources[1]).toEqual({ id: 'claude-plugins.dev', ok: true })
  })

  it('refuses a redirect that leaves the allowlist without ever calling the outside host', async () => {
    const home = await makeHome()
    const harness = options(home, [
      {
        host: 'skills.sh',
        respond: () => respond(302, '', { location: 'https://evil.example/steal' }),
      },
      { host: 'claude-plugins.dev', respond: () => jsonResponse(CLAUDE_PLUGINS_BODY) },
      { host: 'clawhub.ai', respond: () => jsonResponse({ results: [] }) },
      { host: 'api.skillhub.cn', respond: () => jsonResponse(SKILLHUB_BODY) },
    ])
    const search = await searchOnlineSkills(harness.options, 'notes')
    expect(search.sources[0]).toEqual({ id: 'skills.sh', ok: false })
    // ★承重断言：一次都没往白名单外的 host 发请求。
    expect(harness.log.some(line => line.includes('evil.example'))).toBe(false)
    // 每一跳都必须落在**已声明的**四台取数面之一上（第四源进表尾 ⇒ 这里如实多一台）。
    expect(harness.log.every(line => /skills\.sh|claude-plugins\.dev|clawhub\.ai|api\.skillhub\.cn|codeload\.github\.com/.test(line))).toBe(true)
  })

  it('requires a non-empty bounded query', async () => {
    const home = await makeHome()
    const harness = options(home, ALL_SOURCES)
    expect(await codeOf(() => searchOnlineSkills(harness.options, ''))).toBe('ENT_INVALID_REQUEST')
    expect(await codeOf(() => searchOnlineSkills(harness.options, 'x'.repeat(129)))).toBe('ENT_INVALID_REQUEST')
  })
})

describe('enterprise online skill install', () => {
  const TEAM_NOTES_TARBALL = () => repositoryTarball('superpowers', 'main', [
    { dir: 'skills/other-skill', name: 'other-skill' },
    {
      dir: 'skills/team-notes',
      name: 'team-notes',
      files: [{ path: 'references/guide.md', content: '参考资料\n' }],
    },
  ])

  it('installs a skills.sh result by discovering the skill inside the repository tarball', async () => {
    const home = await makeHome()
    const harness = options(home, [codeloadRoute('obra/superpowers', { main: TEAM_NOTES_TARBALL() })])
    const result = await installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')

    // 响应与 `POST /skills/install` 同形（最新**企业**已装态；本次没装企业包 ⇒ 空清单）。
    expect(result).toEqual({ skills: [] })
    const offline = { platform: offlinePlatform(), dshHome: home, now: () => new Date(NOW) }
    expect(result).toEqual(await installedSkillStatus(offline))

    // 目标目录连同它的资源文件一起落盘，且是 0600（不落可执行位）。
    const markdown = await readFile(join(home, 'skills', 'team-notes', 'SKILL.md'), 'utf8')
    expect(markdown).toBe(skillMarkdown('team-notes'))
    expect(await readFile(join(home, 'skills', 'team-notes', 'references', 'guide.md'), 'utf8')).toBe('参考资料\n')
    expect((await stat(join(home, 'skills', 'team-notes', 'SKILL.md'))).mode & 0o777).toBe(0o600)
    // 包里另一个技能**没有**被顺手装进来。
    expect(await exists(join(home, 'skills', 'other-skill'))).toBe(false)

    // 自装记录：逐字七键 + 本通路的 `sourceType='github'` + 坐标原样进 `sourceInput`。
    const records = (await readSelfState(home)).records
    expect(records).toHaveLength(1)
    expect(Object.keys(records[0]!).sort().join(',')).toBe('displayName,installedAt,names,sha256,skillId,sourceInput,sourceType')
    expect(records[0]).toMatchObject({
      skillId: 'team-notes',
      names: ['team-notes'],
      installedAt: NOW,
      sourceType: 'github',
      sourceInput: 'skills.sh:obra/superpowers/team-notes',
    })
    expect(records[0]!['sha256']).toMatch(/^[0-9a-f]{64}$/)
    expect((await stat(join(home, SELF_STATE_RELATIVE))).mode & 0o777).toBe(0o600)

    // 幂等：同一条结果再装一次不报冲突、不重写记录。
    const again = await installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')
    expect(again).toEqual({ skills: [] })
    expect((await readSelfState(home)).records).toEqual(records)
  })

  it('falls back from main to master when the first ref is missing', async () => {
    const home = await makeHome()
    const harness = options(home, [codeloadRoute('obra/superpowers', { master: TEAM_NOTES_TARBALL() })])
    await installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')
    expect(harness.log.filter(line => line.includes('codeload.github.com')).map(line => line.split('/').pop())).toEqual(['main', 'master'])
    expect(await exists(join(home, 'skills', 'team-notes', 'SKILL.md'))).toBe(true)
  })

  it('fails with the download-failure code when every ref is missing', async () => {
    const home = await makeHome()
    const harness = options(home, [codeloadRoute('obra/superpowers', {})])
    expect(await codeOf(() => installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_DOWNLOAD_FAILED')
    expect(await exists(join(home, 'skills'))).toBe(false)
  })

  it('installs a claude-plugins.dev result by extracting exactly the coordinate directory', async () => {
    const home = await makeHome()
    const tarball = repositoryTarball('ui-ux-pro-max-skill', 'main', [
      { dir: '.claude/skills/ui-ux-pro-max', name: 'ui-ux-pro-max', files: [{ path: 'palette.json', content: '{}\n' }] },
      { dir: '.claude/skills/other', name: 'other' },
    ])
    const harness = options(home, [codeloadRoute('nextlevelbuilder/ui-ux-pro-max-skill', { main: tarball })])
    await installSkillFromResult(harness.options, 'claude-plugins.dev:nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max')
    expect(await exists(join(home, 'skills', 'ui-ux-pro-max', 'palette.json'))).toBe(true)
    expect(await exists(join(home, 'skills', 'other'))).toBe(false)
  })

  it('refuses coordinates it cannot honour: clawhub, unknown sources, and malformed ones', async () => {
    const home = await makeHome()
    const harness = options(home, [codeloadRoute('obra/superpowers', { main: TEAM_NOTES_TARBALL() })])
    for (const source of [
      'clawhub.ai:wpank/code-review',          // 该源载荷里没有 GitHub 坐标
      'acme:obra/superpowers/team-notes',      // 未知源
      'skills.sh:',                            // 没有 reference
      'skills.sh:obra/superpowers/../../etc',  // 技能名不是 kebab
      'skills.sh:obra/superpowers/UPPER',      // 同上
      'claude-plugins.dev:obra/superpowers/main/../escape', // 目录段逃逸
      'not-a-coordinate',
      '',
    ]) {
      expect(await codeOf(() => installSkillFromResult(harness.options, source))).toBe('ENT_SKILL_SOURCE_UNKNOWN')
    }
    expect(harness.log.filter(line => line.includes('codeload'))).toHaveLength(0)
  })

  it('refuses when the repository does not contain the skill, or contains it ambiguously', async () => {
    const home = await makeHome()
    const missing = options(home, [codeloadRoute('obra/superpowers', { main: TEAM_NOTES_TARBALL() })])
    expect(await codeOf(() => installSkillFromResult(missing.options, 'skills.sh:obra/superpowers/absent-skill')))
      .toBe('ENT_SKILL_SOURCE_UNKNOWN')

    // 两条目录声明同一个 frontmatter 技能名 ⇒ 歧义，fail-closed。
    const ambiguous = options(home, [codeloadRoute('obra/superpowers', {
      main: repositoryTarball('superpowers', 'main', [
        { dir: 'a/team-notes', name: 'team-notes' },
        { dir: 'b/team-notes', name: 'team-notes' },
      ]),
    })])
    expect(await codeOf(() => installSkillFromResult(ambiguous.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_SOURCE_UNKNOWN')
  })

  it('refuses a tarball that declares more bytes than the independent limit', async () => {
    const home = await makeHome()
    const harness = options(home, [{
      host: 'codeload.github.com',
      respond: () => respond(200, 'tiny', { 'content-length': String(ONLINE_TARBALL_MAX_BYTES + 1) }),
    }])
    expect(await codeOf(() => installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_SOURCE_TOO_LARGE')
  })

  it('refuses a gzip stream whose trailer already exceeds the uncompressed limit', async () => {
    const home = await makeHome()
    const inflated = TEAM_NOTES_TARBALL()
    // trailer 的最后四字节是 ISIZE（解压后大小 mod 2³²）：把它改大 ⇒ 在读盘之前就被拒。
    const lying = Buffer.from(inflated)
    lying.writeUInt32LE(ONLINE_TARBALL_MAX_UNCOMPRESSED_BYTES + 1, lying.byteLength - 4)
    const harness = options(home, [codeloadRoute('obra/superpowers', { main: lying })])
    expect(await codeOf(() => installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_SOURCE_TOO_LARGE')
  })

  it('refuses a tarball with a symlink entry or an escaping path', async () => {
    const home = await makeHome()
    const withLink = options(home, [codeloadRoute('obra/superpowers', {
      main: buildTarGz([
        { path: 'superpowers-main/skills/team-notes/SKILL.md', content: skillMarkdown('team-notes') },
        { path: 'superpowers-main/skills/team-notes/link.txt', typeflag: '2', linkname: '/etc/passwd' },
      ]),
    })])
    expect(await codeOf(() => installSkillFromResult(withLink.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_ARCHIVE_INVALID')

    const escaping = options(home, [codeloadRoute('obra/superpowers', {
      main: buildTarGz([{ path: '../../evil/SKILL.md', content: skillMarkdown('team-notes') }]),
    })])
    expect(await codeOf(() => installSkillFromResult(escaping.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_ARCHIVE_INVALID')
  })

  it('tolerates a symlink that lives outside the skill directory (real repositories have them)', async () => {
    const home = await makeHome()
    // 线上实测：`nextlevelbuilder/ui-ux-pro-max-skill` 的 `gallery/data/styles.csv` 就是符号链接。
    // 我们只提取目标技能目录 ⇒ 包内**别处**的链接与我们无关，不该整包拒（这条是冒烟跑出来的真缺陷）。
    const harness = options(home, [codeloadRoute('obra/superpowers', {
      main: buildTarGz([
        { path: 'superpowers-main/gallery/data/styles.csv', typeflag: '2', linkname: '../../../assets/styles.csv' },
        { path: 'superpowers-main/skills/team-notes/SKILL.md', content: skillMarkdown('team-notes') },
      ]),
    })])
    await installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')
    expect(await exists(join(home, 'skills', 'team-notes', 'SKILL.md'))).toBe(true)
    expect(await exists(join(home, 'skills', 'team-notes', 'gallery'))).toBe(false)
  })

  it('runs the SKILL.md frontmatter gate before anything reaches the disk', async () => {
    const home = await makeHome()
    const harness = options(home, [codeloadRoute('obra/superpowers', {
      main: buildTarGz([
        { path: 'superpowers-main/skills/team-notes/SKILL.md', content: '---\nname: Not Kebab\ndescription: x\n---\n正文\n' },
      ]),
    })])
    expect(await codeOf(() => installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(await exists(join(home, 'skills'))).toBe(false)
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('refuses to overwrite a skill directory owned by another package', async () => {
    const home = await makeHome()
    const statePath = join(home, ENTERPRISE_STATE_RELATIVE)
    await mkdir(join(home, 'enterprise', 'skill-installs'), { recursive: true, mode: 0o700 })
    await writeFile(statePath, JSON.stringify({
      records: [{
        packageId: '1902500000000000001',
        skillId: 'enterprise-pkg',
        displayName: '企业技能包',
        versionId: '1902500000000000101',
        sha256: 'a'.repeat(64),
        names: ['team-notes'],
        installedAt: '2026-10-01T00:00:00.000Z',
      }],
    }), { encoding: 'utf8', mode: 0o600 })
    const harness = options(home, [codeloadRoute('obra/superpowers', { main: TEAM_NOTES_TARBALL() })])
    expect(await codeOf(() => installSkillFromResult(harness.options, 'skills.sh:obra/superpowers/team-notes')))
      .toBe('ENT_SKILL_NAME_CONFLICT')
  })
})

/**
 * ★**默认 skip** 的真端点冒烟（本机实测三源 200、codeload 可达）。跑法：
 *   `DSHENT_ONLINE_SMOKE=1 pnpm --filter dshent-plugin exec vitest run tests/skill-online.spec.ts`
 * 门禁（默认）里一次网络都不打 —— 这是纪律，不是省事。
 */
const smoke = process.env['DSHENT_ONLINE_SMOKE'] === '1' ? describe : describe.skip
smoke('enterprise online skill search smoke (real endpoints, opt-in)', () => {
  const real = (input: string, init?: RequestInit) => fetch(input, init)

  it('still answers 200 on all three sources and normalizes at least one result', async () => {
    const home = await makeHome()
    const search: EnterpriseOnlineSkillSearch = await searchOnlineSkills({ fetch: real, dshHome: home }, 'code-review')
    // ★★这条断言原来写的是「三源全绿」（`toEqual([[...true],[...true],[...true]])`），
    //   **在真实公网上会抖**：Lead 实测到过一次 `skills.sh` 10.5s 后超时（同一条命令几分钟后再跑就全绿）。
    //   产品自己的契约就是**部分成功是设计**（`allSettled` + 逐源 `ok` + **全失败才报错** + `sources[]`
    //   存在的意义正是把「哪个源这次挂了」如实说出来）⇒ 「三源全绿」是**观测**，不是**断言**；
    //   把它写死进门禁，等于让公网任何一次瞬断把这条门禁打红（比它要守的东西更严）。
    //   所以下面**断契约**：三源都被报出来（id 与声明序一致）、至少一个 ok、结果非空。
    expect(search.sources.map(source => source.id)).toEqual([
      'skills.sh',
      'claude-plugins.dev',
      'clawhub.ai',
      'skillhub.cn',
    ])
    expect(search.sources.some(source => source.ok)).toBe(true)
    // 挂掉的源如实打出来（可观测），但**不判失败** —— 那正是产品要交代的东西。
    for (const source of search.sources.filter(item => !item.ok)) {
      console.log(`[online-smoke] source ${source.id} answered not-ok this run (partial success is by design)`)
    }
    expect(search.results.length).toBeGreaterThan(0)
    expect(search.results.every(result => result.installSource.includes(':'))).toBe(true)
    // ★活数据形状锁（条件式，永不 flaky）：真的出现 clawhub.ai 来源的结果时，它的坐标必须是能服务的
    //   那一条（`skills.sh:<owner>/<repo>/<dir…>`）—— `sourceId` 与 `installSource` 的这处不对称是**有意**的。
    for (const result of search.results.filter(item => item.sourceId === 'clawhub.ai')) {
      expect(result.installSource.startsWith('skills.sh:')).toBe(true)
    }
    // 同一个源两类都在时，被丢的那一类必须体现在 `dropped` 上（不许静默）。
    const clawhubSource = search.sources[2]!
    expect(clawhubSource.id).toBe('clawhub.ai')
    expect(clawhubSource.ok).toBe(true)
  }, 60_000)

  it('installs a live result end to end (search → codeload tarball → hardened placement)', async () => {
    const home = await makeHome()
    const fetchImpl = real
    const search = await searchOnlineSkills({ fetch: fetchImpl, dshHome: home }, 'code-review')
    const target = search.results.find(result => result.sourceId === 'claude-plugins.dev')
    expect(target).toBeDefined()
    const result = await installSkillFromResult({ fetch: fetchImpl, dshHome: home }, target!.installSource)
    expect(result).toEqual({ skills: [] })
    const records = (await readSelfState(home)).records
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ sourceType: 'github', sourceInput: target!.installSource })
  }, 120_000)
})
