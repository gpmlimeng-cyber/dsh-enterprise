/**
 * [INPUT]: 依赖 node:crypto 的 createHash、`@dshent/platform-client` 的 `resolveEnterpriseDshHome`、本包 `tar-archive.ts`（`readTarGzipEntries`）、`zip-archive.ts`（`writeZipArchive`）、`skill-archive.ts`（`decodeDshSkillArchive`）、`skill-frontmatter.ts`（`validateSkillFrontmatter`）、`skill-install.ts`（`placeEnterpriseSkillArchive`/`installedSkillStatus`/`readInstalledSkillRecords`/`SKILL_CONTENT_FILENAME`）与 `skill-upload.ts`（`upsertSelfInstalledRecord`/`readSelfInstalledRecords`/`installedSelfSkills`/`SYSTEM_ADOPT_SOURCE_TYPE` 同族的记录形状）
 * [OUTPUT]: 对外提供通路三「在线搜索」的两件事：`searchOnlineSkills(options, query)`（三源 fan-out + 归一化 + 去重 + **逐源 ok**）与 `installSkillFromResult(options, source)`（把 `installSource` 坐标解成 codeload tarball → 内存组 `.dshskill` → **复用加固落盘**），以及 `EnterpriseOnlineSkillSearch`/`EnterpriseOnlineSkillResult`/`EnterpriseOnlineSkillSource` 形状、四条独立上限常量与 `ONLINE_SKILL_SOURCE_IDS`
 * [POS]: bundle 技能纵深的**第四条通路**（真源 `docs/research/cherry-skill-add-2026-10-05.md` §1 与 `docs/plan/skill-install-sources.md` §B.2/§C/§F.1）——上游 Cherry 的**三个聚合源**（`skillMarketplace.ts:345-374` 的 `MARKETPLACE_SOURCES`）与我们**自己的**安装链：★公开源一律走**无凭据裸取数面** `options.fetch`，**绝不**用平台面（`platform-service.ts:709-733` 那个 `request` 是同源 + 注入 Bearer 的，拿它打第三方等于把企业令牌发给公网）；★SSRF 白名单（`skills.sh`/`claude-plugins.dev`/`clawhub.ai`/`codeload.github.com`）+ 手动重定向（跨出白名单即拒）+ 只 GET 不带任何 header；★「装不出来就丢」是**按条**判、不是按源：`clawhub.ai` 的 `install.kind` 实测两种（**75/80 是 `clawhub`、5/80 是 `skills-sh`**；我自己那次 4 query/40 条是 38+2），前者载荷里没有本机装得出来的坐标 ⇒ 丢并**计数**（`sources[].dropped`，不许静默），后者的 `reference` 形如 `skills-sh:<owner>/<repo>/<dir…>` ⇒ 保留并走**与 `skills.sh` 源同一份**解析（详见 `normalizeClawhub`）；★落盘不新造第二套：内存组包 → `decodeDshSkillArchive` → `placeEnterpriseSkillArchive`，与中心安装/本地上传**同一套**落点冲突预检与原子改名；★全程零 exec/spawn、不做动态 import、不落可执行位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { decodeDshSkillArchive } from './skill-archive.js'
import { EnterpriseSkillInstallError, skillInstallError } from './skill-errors.js'
import { validateSkillFrontmatter } from './skill-frontmatter.js'
import {
  installedSkillStatus,
  placeEnterpriseSkillArchive,
  readInstalledSkillRecords,
  SKILL_CONTENT_FILENAME,
  type EnterpriseInstalledSkills,
  type EnterpriseSkillInstallOptions,
  type EnterpriseSkillInstallPlatformPort,
} from './skill-install.js'
import {
  installedSelfSkills,
  readSelfInstalledRecords,
  upsertSelfInstalledRecord,
  type SelfInstalledSkillRecord,
} from './skill-upload.js'
import {
  readTarGzipEntries,
  TarArchiveError,
  TarArchiveTooLargeError,
  type TarArchiveEntry,
} from './tar-archive.js'
import { writeZipArchive, type ZipWriteEntry } from './zip-archive.js'

/** 三源声明序（响应里 `sources[]` 与去重的「先到先得」都按它）。 */
export const ONLINE_SKILL_SOURCE_IDS = ['skills.sh', 'claude-plugins.dev', 'clawhub.ai'] as const
export type OnlineSkillSourceId = (typeof ONLINE_SKILL_SOURCE_IDS)[number]

/**
 * 单次取数的超时（照上游 `skillSearch.ts:10` 的 `REQUEST_TIMEOUT_MS = 15_000`）。
 * 覆盖「拿到响应头 + 读完正文」全程：只给响应头设超时会让一个卡住的正文永远挂着。
 */
export const ONLINE_SKILL_REQUEST_TIMEOUT_MS = 15_000
/**
 * 单个搜索响应的字节上限（**独立常量**：既不是 JSON 路由那 256 KiB，也不是上传那 50 MiB）。
 * 三源实测 16~27 KB，这里留三个数量级冗余，只用来挡住「源返回一个巨型正文」。
 */
export const ONLINE_SEARCH_MAX_BYTES = 4_194_304
/**
 * 单个 `tar.gz` 的字节上限（**独立常量**，真源 `docs/plan/skill-install-sources.md` §C）：
 * 实测一个中等仓库整包 4,017,095 字节，这里放到 64 MiB；★不与上传那 50 MiB 共用常量。
 */
export const ONLINE_TARBALL_MAX_BYTES = 67_108_864
/** `tar.gz` **解压后**总字节上限（tar 炸弹闸门；比技能包 200 MiB 略宽，因为整仓比一个技能大得多）。 */
export const ONLINE_TARBALL_MAX_UNCOMPRESSED_BYTES = 268_435_456
/** tar 条目数上限（`.gitignore` 级别的整仓树；与上游 `MAX_SKILL_FILES = 20_000` 同量级）。 */
export const ONLINE_TARBALL_MAX_ENTRIES = 20_000
/** 单条 tar 条目字节上限（整仓里任何单文件都不该超过 32 MiB）。 */
export const ONLINE_TARBALL_MAX_ENTRY_BYTES = 33_554_432

/**
 * SSRF 白名单（`skill-install-sources.md` §F.1）：**只有**这四个 host 会被取数。
 * 三个搜索源 + `codeload.github.com`；★`raw.githubusercontent.com` **不在**白名单里 ——
 * 本机实测它连不上（curl rc=28），而且按文件逐取会撞 GitHub Contents API 的 60/小时配额。
 */
const ALLOWED_HOSTS: readonly string[] = ['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'codeload.github.com']
/** 手动跟随的重定向上限（每次跳转都重新过白名单）。 */
const MAX_REDIRECTS = 2
/** 搜索串形状上限（界面输入；与既有 `q` 查询参数门禁同量级）。 */
const MAX_QUERY_LENGTH = 128
/** `installSource` 形状上限（与既有 `sourceInput` 那枚 1024 同量级）。 */
const MAX_INSTALL_SOURCE_LENGTH = 1024
/** `manifest.json` 的 `id` 规约（与 `skill-archive.ts` 的 `SKILL_PACKAGE_REF_PATTERN` 同源）。 */
const SKILL_PACKAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
/**
 * 坐标里每一段的形状：字母数字与 `._-`，**允许前导点**（真实数据里 `.claude/skills/<name>` 就是这种目录），
 * 但 `.` / `..` 单独成段一律拒（那是路径逃逸）。不含 `/`：带斜杠的段会改变坐标的字段数，绝不接受。
 */
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/
/** 技能名规约（官方 `dsh-skill` 的 kebab 名）。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 本通路写进自装记录的来源类型（`docs/plan/skill-install-sources.md:676` 已列 `github` 这个词）。 */
const ONLINE_SOURCE_TYPE = 'github'
/** `clawhub.ai` 条目里那条 skills.sh 化坐标的前缀（`install.reference` 实测形如 `skills-sh:<owner>/<repo>/<skill>`）。 */
const CLAWHUB_SKILLS_SH_PREFIX = 'skills-sh:'

/**
 * 一个源在这次 fan-out 里的如实状态：`ok:false` 只表示**这个源挂了**，部分成功照常保留其余结果。
 *
 * `dropped` 是**可选**的「这个源这次丢了几条结果」（装不出来的那些，见各 `normalize*`）。它存在的原因是
 * 一条纪律：**丢弃不许静默**。界面看到 `clawhub.ai: ok:true` 却一条结果都没有时，会以为这个源本来就没结果；
 * 有了这枚计数才能如实说「该源 N 条结果暂时无法安装」。为 0 时整键不产出。
 */
export interface EnterpriseOnlineSkillSource {
  readonly id: OnlineSkillSourceId
  readonly ok: boolean
  readonly dropped?: number
}

/**
 * 归一化后的一条搜索结果。
 *
 * ★`installSource` 是**唯一**能回传给 `installSkillFromResult` 的坐标串，形状 `"<sourceId>:<reference>"`。
 * ★`description`/`stars` 缺席即**整键不产出**（`skills.sh` 的条目根本没有这两个键 —— 不编 `null`、不编 `0`）。
 */
export interface EnterpriseOnlineSkillResult {
  readonly sourceId: OnlineSkillSourceId
  readonly name: string
  readonly description?: string
  readonly author?: string
  readonly stars?: number
  readonly installs?: number
  readonly installSource: string
}

/** `GET /enterprise/api/v1/local/skills/online-search` 的本地投影。 */
export interface EnterpriseOnlineSkillSearch {
  readonly sources: readonly EnterpriseOnlineSkillSource[]
  readonly results: readonly EnterpriseOnlineSkillResult[]
}

/**
 * 本通路需要的最小依赖。
 *
 * ★`fetch` 是**无凭据裸取数面**（`typeof fetch` 形状）：公开源只走它。
 * ★本通路**没有** `platform` 字段：带令牌的平台面在结构上就进不来（见 `offlinePlatformPort`）。
 */
export interface EnterpriseSkillOnlineOptions {
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  readonly now?: () => Date
  /** 判定点留痕（源失败、被丢弃的结果）；组合层接到 Host logger。 */
  readonly onError?: (message: string, error: unknown) => void
}

interface OnlineDependencies {
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>
  readonly now: () => Date
  readonly onError: ((message: string, error: unknown) => void) | undefined
  /** 交给本机记账函数的形状（`platform` 是**毒化桩**，见下）。 */
  readonly local: EnterpriseSkillInstallOptions
}

/**
 * 传给 `placeEnterpriseSkillArchive`/`installedSkillStatus` 这些**纯本机**函数的结构化依赖。
 *
 * 它们的入参形状要求一个 `platform` 面，但落盘与已装态读取**一次网络都不用**。这里给一个**毒化桩**：
 * 万一将来有人在在线通路的调用链上真的发起平台请求，会当场抛错而不是把企业令牌发给公网。
 */
function offlinePlatformPort(): EnterpriseSkillInstallPlatformPort {
  return {
    request: async () => {
      throw new EnterpriseSkillInstallError(
        'ENT_SKILL_INSTALL_FAILED',
        'the online skills path must never use the authenticated platform port',
      )
    },
  }
}

function resolveDependencies(options: EnterpriseSkillOnlineOptions): OnlineDependencies {
  const dshHome = resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome })
  const now = options.now ?? (() => new Date())
  return {
    fetch: options.fetch,
    now,
    onError: options.onError,
    local: {
      platform: offlinePlatformPort(),
      dshHome,
      now,
      ...(options.onError === undefined ? {} : { onError: options.onError }),
    },
  }
}

function unreachable(message: string, cause?: unknown): EnterpriseSkillInstallError {
  return cause === undefined
    ? new EnterpriseSkillInstallError('ENT_SKILL_SOURCE_UNREACHABLE', message)
    : new EnterpriseSkillInstallError('ENT_SKILL_SOURCE_UNREACHABLE', message, { cause })
}

function sourceUnknown(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_SOURCE_UNKNOWN', message)
}

function tooLarge(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_SOURCE_TOO_LARGE', message)
}

function archiveInvalid(message: string, cause?: unknown): EnterpriseSkillInstallError {
  return cause === undefined
    ? new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message)
    : new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message, { cause })
}

/** 白名单 + 只走 https + 不带内嵌凭据；任何一条不满足即拒（取数层与坐标层共用）。 */
function requireAllowedUrl(value: string, onRejected: (message: string) => EnterpriseSkillInstallError): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw onRejected(`the url is not absolute (${String(error)})`)
  }
  if (url.protocol !== 'https:') throw onRejected('only https urls are allowed')
  if (url.username !== '' || url.password !== '') throw onRejected('urls must not embed credentials')
  if (!ALLOWED_HOSTS.includes(url.hostname)) throw onRejected(`host ${url.hostname} is not on the allowlist`)
  return url
}

/** 把响应正文有界读掉（超过上限即取消读取并抛 `ENT_SKILL_SOURCE_TOO_LARGE`，**不读完**）。 */
async function readBoundedBytes(response: Response, limit: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    await cancelBody(response)
    throw tooLarge('the upstream response declares more bytes than the limit')
  }
  const body = response.body
  if (body === null) return Buffer.alloc(0)
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    for (;;) {
      const step = await reader.read()
      if (step.done === true) break
      const chunk = step.value
      if (chunk === undefined) continue
      total += chunk.byteLength
      if (total > limit) {
        await reader.cancel().catch(() => undefined)
        throw tooLarge('the upstream response is larger than the limit')
      }
      chunks.push(Buffer.from(chunk))
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // 已经取消/释放过：这里只保证不把清理失败当成业务失败。
    }
  }
  return Buffer.concat(chunks)
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // 取消失败不影响判定：正文本来就要丢掉。
  }
}

/**
 * 一次受控取数：15s 超时（含正文）×  白名单 ×  手动重定向 ×  有界读取 ×  **零 header**。
 *
 * 返回状态码而不是「非 2xx 即抛」：`codeload` 的 404 是「这个 ref 没有」（调用方要换 ref 重试），
 * 而 403/429/5xx 是「上游不可用」，两者的下一步不同。
 */
async function fetchWithinLimit(
  deps: OnlineDependencies,
  url: string,
  limit: number,
): Promise<{ readonly status: number, readonly bytes: Buffer }> {
  let current = requireAllowedUrl(url, message => unreachable(message))
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ONLINE_SKILL_REQUEST_TIMEOUT_MS)
    try {
      // ★不带任何 header：公开源不需要凭据，而带上平台令牌就是把企业身份发给第三方。
      // ★`redirect: 'manual'`：跨出白名单的重定向必须由我们**看见并拒掉**，而不是被 fetch 默默跟过去。
      const response = await deps.fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await cancelBody(response)
        if (location === null || location === undefined || location === '') {
          throw unreachable('the upstream redirected without a location')
        }
        current = requireAllowedUrl(new URL(location, current).toString(), message => unreachable(message))
        continue
      }
      if (response.status !== 200) {
        await cancelBody(response)
        return { status: response.status, bytes: Buffer.alloc(0) }
      }
      return { status: response.status, bytes: await readBoundedBytes(response, limit) }
    } catch (error) {
      throw skillInstallError(error, 'ENT_SKILL_SOURCE_UNREACHABLE', `the upstream request failed (${current.hostname})`)
    } finally {
      clearTimeout(timer)
    }
  }
  throw unreachable('the upstream redirected too many times')
}

async function fetchSearchJson(deps: OnlineDependencies, url: string, sourceId: OnlineSkillSourceId): Promise<unknown> {
  const { status, bytes } = await fetchWithinLimit(deps, url, ONLINE_SEARCH_MAX_BYTES)
  if (status !== 200) throw unreachable(`${sourceId} answered HTTP ${status}`)
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw skillInstallError(error, 'ENT_SKILL_SOURCE_UNREACHABLE', `${sourceId} answered a body that is not JSON`)
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function requireArray(source: unknown, key: string, label: string): readonly unknown[] {
  const record = asRecord(source)
  const list = record?.[key]
  if (!Array.isArray(list)) throw unreachable(`${label} answered an invalid search response`)
  return list
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function optionalCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined
}

function requireSafeSegment(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.length > 100) return undefined
  if (value === '.' || value === '..' || !SAFE_SEGMENT_PATTERN.test(value)) return undefined
  return value
}

/** `/` 分隔的仓库内目录路径 → 逐段收窄（挡住 `..`/空段/控制字符/超长段）。 */
function requireDirectoryPath(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.length > 512) return undefined
  const segments = value.split('/')
  for (const segment of segments) {
    if (requireSafeSegment(segment) === undefined) return undefined
  }
  return segments.join('/')
}

/**
 * 从 `https://github.com/{owner}/{repo}/tree/{ref}/{dir…}` 反解坐标（照上游
 * `getDirectoryPathFromGithubTreeUrl`（`:38-67`）—— 它对 host/owner/repo/type 四项全校验，我们逐项对齐）。
 */
function parseGithubTreeUrl(value: string | undefined): { owner: string, repo: string, ref: string, directoryPath: string } | undefined {
  if (value === undefined) return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return undefined
  const segments = url.pathname.split('/').filter(segment => segment.length > 0)
  if (segments.length < 5 || segments[2] !== 'tree') return undefined
  const owner = requireSafeSegment(segments[0])
  const repo = requireSafeSegment(segments[1])
  const ref = requireSafeSegment(segments[3])
  const directoryPath = requireDirectoryPath(segments.slice(4).join('/'))
  if (owner === undefined || repo === undefined || ref === undefined || directoryPath === undefined) return undefined
  return { owner, repo, ref, directoryPath }
}

/**
 * `skills.sh` 的坐标可解性判据（**装不出来就丢**）：`id` 必须恰好是 `owner/repo/skill-name` 三段。
 *
 * 实测该源 100 条里有 1 条是 `uizze.sh/ui-taste`（`source` 也是个域名、不是 `owner/repo`）——那种
 * 坐标解不成 GitHub 仓库，按 fail-closed 丢弃，**不猜**它是哪个 host 的包。
 */
function skillsShReference(id: string): string | undefined {
  const segments = id.split('/')
  if (segments.length !== 3) return undefined
  const owner = requireSafeSegment(segments[0])
  const repo = requireSafeSegment(segments[1])
  const skillName = segments[2]
  if (owner === undefined || repo === undefined || skillName === undefined || !SKILL_NAME_PATTERN.test(skillName)) {
    return undefined
  }
  // 3 段：`owner/repo/skill-name`（**不带 ref** —— 该源没有任何 URL/ref 信息，安装时按 main → master 兜底）。
  return `${owner}/${repo}/${skillName}`
}

/** 归一化 `skills.sh`（`:307-322`）：只有 `{id, source, skillId, name, installs}`，**没有** description/stars。 */
function normalizeSkillsSh(value: unknown): OnlineSourceOutcome {
  const list = requireArray(value, 'skills', 'skills.sh')
  const results: EnterpriseOnlineSkillResult[] = []
  let dropped = 0
  for (const item of list) {
    const entry = asRecord(item)
    const name = optionalString(entry?.['name'])
    const id = optionalString(entry?.['id'])
    if (entry === undefined || name === undefined || id === undefined) {
      throw unreachable('skills.sh answered an invalid search entry')
    }
    const reference = skillsShReference(id)
    // ★装不出来就丢（不猜 host、不猜目录），但**计数**：不许静默不完整。
    if (reference === undefined) {
      dropped += 1
      continue
    }
    const author = optionalString(entry['source'])?.split('/')[0]
    const installs = optionalCount(entry['installs'])
    results.push({
      sourceId: 'skills.sh',
      name,
      ...(author === undefined ? {} : { author }),
      ...(installs === undefined ? {} : { installs }),
      installSource: `skills.sh:${reference}`,
    })
  }
  return { results, dropped }
}

/**
 * `claude-plugins.dev` 的坐标（照上游 `:79-81` 的 fail-closed：**repoOwner/repoName 必需、directoryPath 必需**
 * —— 注释逐字「directoryPath is required to avoid ambiguous repo scans that may install a different skill」）。
 *
 * `directoryPath` 缺失时按上游既有回退从 `sourceUrl` 反解（`getDirectoryPathFromGithubTreeUrl`）；
 * ★ref 一并**写进坐标**（`owner/repo/<ref>/<directoryPath>`）：冻结链路要求「ref 解自 sourceUrl 的
 * `/tree/<ref>/` 段」，而坐标串是唯一能带到安装步的事实 —— 丢掉 ref 就只能盲试 main/master。
 * sourceUrl 解不到 ref 时写 `main`（安装侧仍保留 main → master 兜底探测）。
 */
function claudePluginsReference(entry: Record<string, unknown>): string | undefined {
  const metadata = asRecord(entry['metadata'])
  const fromUrl = parseGithubTreeUrl(optionalString(entry['sourceUrl']))
  const metaOwner = requireSafeSegment(optionalString(metadata?.['repoOwner']))
  const metaRepo = requireSafeSegment(optionalString(metadata?.['repoName']))
  const metaDirectory = requireDirectoryPath(optionalString(metadata?.['directoryPath']))
  const owner = metaOwner ?? fromUrl?.owner
  const repo = metaRepo ?? fromUrl?.repo
  const directoryPath = metaDirectory ?? fromUrl?.directoryPath
  if (owner === undefined || repo === undefined || directoryPath === undefined) return undefined
  // metadata 与 sourceUrl 同时给了同一件事却不一致 ⇒ 这条结果自相矛盾，丢弃而不是猜哪个是真的。
  // ★这条守卫同时挡住「带斜杠的 ref」（`/tree/feature/x/<dir>`）：那时 URL 里解出的 ref 与目录会错位，
  //   于是与 metadata.directoryPath 不一致 ⇒ 直接丢，绝不按一个错位的坐标去抓包。
  if (fromUrl !== undefined
    && ((metaOwner !== undefined && metaOwner !== fromUrl.owner)
      || (metaRepo !== undefined && metaRepo !== fromUrl.repo)
      || (metaDirectory !== undefined && metaDirectory !== fromUrl.directoryPath))) {
    return undefined
  }
  const ref = fromUrl?.ref ?? 'main'
  return `${owner}/${repo}/${ref}/${directoryPath}`
}

/** 归一化 `claude-plugins.dev`（`:69-95`）：三者中唯一带真描述/真 star/真 install 数的源。 */
function normalizeClaudePlugins(value: unknown): OnlineSourceOutcome {
  const list = requireArray(value, 'skills', 'claude-plugins.dev')
  const results: EnterpriseOnlineSkillResult[] = []
  let dropped = 0
  for (const item of list) {
    const entry = asRecord(item)
    const name = optionalString(entry?.['name'])
    if (entry === undefined || name === undefined) {
      throw unreachable('claude-plugins.dev answered an invalid search entry')
    }
    const reference = claudePluginsReference(entry)
    if (reference === undefined) {
      dropped += 1
      continue
    }
    const description = optionalString(entry['description'])
    const author = optionalString(entry['author'])
    const stars = optionalCount(entry['stars'])
    const installs = optionalCount(entry['installs'])
    results.push({
      sourceId: 'claude-plugins.dev',
      name,
      ...(description === undefined ? {} : { description }),
      ...(author === undefined ? {} : { author }),
      ...(stars === undefined ? {} : { stars }),
      ...(installs === undefined ? {} : { installs }),
      installSource: `claude-plugins.dev:${reference}`,
    })
  }
  return { results, dropped }
}

/**
 * 归一化 `clawhub.ai`（`:324-343`）：顶层键是 **`results[]`**（不是 `skills[]`），字段名完全不同
 * （`displayName`/`summary`/`ownerHandle`/`score`）。
 *
 * ★★**按条丢弃，不是按源**（第一版写成「整源丢弃」，**是错的**，已按复核退回改正）：
 * 该源的 `install.kind` 至少有两种，实测分布 **75/80 是 `clawhub`、5/80 是 `skills-sh`**
 *（Lead 的 8 query 普查；我自己 4 query/40 条那次是 38+2，比例一致）——
 *   · `kind === 'skills-sh'`（5/80）：`reference` 形如 `skills-sh:<owner>/<repo>/<dir…>`
 *     （逐字样例：`skills-sh:anthropics/skills/pdf`、`skills-sh:jsmastery-pro/skills/test`、
 *     `skills-sh:boshu2/agentops/doc`、`skills-sh:nexu-io/open-design/doc`），**带可解坐标** ⇒ 保留，
 *     并且走**与 `skills.sh` 源完全同一份**解析（`skillsShReference`，绝不写第二份）；
 *   · `kind === 'clawhub'`（其余 75/80）：载荷里**没有**本机装得出来的坐标（`install.sourceUrl=null`、
 *     `sourceIdentity.repo=null`、`links.source=null`；ClawHub 自己也没有机器下载面 ——
 *     `/api/v1/skills/…`、`/api/v1/skill/…`、`/api/v1/download/…` 实测**全部 404**）⇒ 本仓冻结的
 *     `codeload.github.com` 安装链兑现不了 ⇒ 按条丢弃并**计数**（不静默）。
 *
 * ★**有意的不对称**（别当成 bug）：留下来的那类结果 `sourceId` 仍是 **`'clawhub.ai'`** —— 用户是在那儿
 * 看到它的，这点必须诚实；但 `installSource` 用的是**能真正服务**的那个坐标 `skills.sh:<owner>/<repo>/<skill>`
 * ⇒ 安装侧原样复用既有 resolver（`resolveInstallPlan` 的 `skills.sh` 分支），不需要为 ClawHub 造第二条链路。
 */
function normalizeClawhub(value: unknown, deps: OnlineDependencies): OnlineSourceOutcome {
  const list = requireArray(value, 'results', 'clawhub.ai')
  const results: EnterpriseOnlineSkillResult[] = []
  let dropped = 0
  for (const item of list) {
    const entry = asRecord(item)
    const name = optionalString(entry?.['displayName'])
    if (entry === undefined || name === undefined) {
      throw unreachable('clawhub.ai answered an invalid search entry')
    }
    const coordinate = clawhubSkillsShCoordinate(entry)
    if (coordinate === undefined) {
      dropped += 1
      continue
    }
    const description = optionalString(entry['summary'])
    const author = optionalString(entry['ownerHandle']) ?? optionalString(asRecord(entry['publisher'])?.['handle'])
    results.push({
      // ★来源仍是 clawhub.ai（用户在那儿看到的），坐标却是 skills.sh 的那一条。
      sourceId: 'clawhub.ai',
      name,
      ...(description === undefined ? {} : { description }),
      ...(author === undefined ? {} : { author }),
      installSource: `skills.sh:${coordinate}`,
    })
  }
  if (dropped > 0) {
    deps.onError?.(
      `enterprise online skill search dropped ${dropped} clawhub.ai result(s):`
      + ' only install.kind=skills-sh entries carry a coordinate this host can serve',
      undefined,
    )
  }
  return { results, dropped }
}

/** `clawhub.ai` 里可服务的那一类：`install.kind === 'skills-sh'` + `reference` 能解成 owner/repo/skill。 */
function clawhubSkillsShCoordinate(entry: Record<string, unknown>): string | undefined {
  const install = asRecord(entry['install'])
  if (install === undefined || install['kind'] !== 'skills-sh') return undefined
  const reference = optionalString(install['reference'])
  if (reference === undefined) return undefined
  // `reference` 实测形如 `skills-sh:anthropics/skills/pdf`（前缀可选）；剥掉前缀后就是 skills.sh 的 id 形状。
  const id = reference.startsWith(CLAWHUB_SKILLS_SH_PREFIX)
    ? reference.slice(CLAWHUB_SKILLS_SH_PREFIX.length)
    : reference
  return skillsShReference(id)
}

/** 一个源这一次的归一化产出：留下来的结果 + 被丢弃的条数（两者都要如实上报）。 */
interface OnlineSourceOutcome {
  readonly results: readonly EnterpriseOnlineSkillResult[]
  /** 装不出来而丢掉的条数；`searchOnlineSkills` 把它如实写进 `sources[].dropped`。 */
  readonly dropped: number
}

interface OnlineSourceDeclaration {
  readonly id: OnlineSkillSourceId
  readonly endpoint: (query: string) => string
  readonly normalize: (value: unknown, deps: OnlineDependencies) => OnlineSourceOutcome
}

const ONLINE_SKILL_SOURCES: readonly OnlineSourceDeclaration[] = [
  {
    id: 'skills.sh',
    endpoint: query => `https://skills.sh/api/search?q=${encodeURIComponent(query)}`,
    normalize: normalizeSkillsSh,
  },
  {
    id: 'claude-plugins.dev',
    endpoint: query => `https://claude-plugins.dev/api/skills?q=${encodeURIComponent(query)}&limit=20`,
    normalize: normalizeClaudePlugins,
  },
  {
    id: 'clawhub.ai',
    endpoint: query => `https://clawhub.ai/api/v1/search?q=${encodeURIComponent(query)}`,
    normalize: normalizeClawhub,
  },
]

function requireQuery(query: unknown): string {
  if (typeof query !== 'string' || query.trim().length === 0 || query.length > MAX_QUERY_LENGTH) {
    throw new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'the search query is invalid')
  }
  for (const character of query) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) {
      throw new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'the search query is invalid')
    }
  }
  return query
}

/**
 * 三源 fan-out：`Promise.allSettled` + **部分成功保留**（照上游 `skillMarketplace.ts:388-405`），
 * 只有**全失败**才抛 `ENT_SKILL_SOURCE_UNREACHABLE`(502)；每个失败源留一条 `onError` 痕。
 *
 * 去重照上游 `:407-413`：按 `name.toLowerCase()` **先到先得**，顺序 = 源声明序 × 源内上游顺序。
 * 去重在**丢弃之后**做 —— 否则一个源里「解不出坐标」的同名条目会把它自己挡掉后面那个能装的。
 *
 * @param options - 无凭据取数面、可选 dshHome/时钟/留痕端口。
 * @param query - 搜索串（非空、≤128 字、无控制字符）。
 * @returns 逐源状态与归一化结果。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`（查询串形状非法）、
 *   `ENT_SKILL_SOURCE_UNREACHABLE`（**每一个**源都失败）。
 */
export async function searchOnlineSkills(
  options: EnterpriseSkillOnlineOptions,
  query: unknown,
): Promise<EnterpriseOnlineSkillSearch> {
  const deps = resolveDependencies(options)
  const text = requireQuery(query)
  const settled = await Promise.allSettled(ONLINE_SKILL_SOURCES.map(async (source) => {
    const value = await fetchSearchJson(deps, source.endpoint(text), source.id)
    return source.normalize(value, deps)
  }))
  const sources: EnterpriseOnlineSkillSource[] = []
  const results: EnterpriseOnlineSkillResult[] = []
  const seen = new Set<string>()
  for (let index = 0; index < ONLINE_SKILL_SOURCES.length; index += 1) {
    const source = ONLINE_SKILL_SOURCES[index]!
    const outcome = settled[index]!
    if (outcome.status === 'rejected') {
      sources.push({ id: source.id, ok: false })
      deps.onError?.(`enterprise online skill search source failed [source=${source.id}]`, outcome.reason)
      continue
    }
    const dropped = outcome.value.dropped
    sources.push({ id: source.id, ok: true, ...(dropped === 0 ? {} : { dropped }) })
    for (const result of outcome.value.results) {
      const key = result.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      results.push(result)
    }
  }
  if (sources.every(source => !source.ok)) {
    throw unreachable('every online skill source is unavailable')
  }
  return { sources, results }
}

/** 一个已解出的安装计划：仓库坐标 + 该试哪些 ref + 怎么在整包里定位目标技能。 */
type InstallPlan =
  | {
    readonly sourceId: OnlineSkillSourceId
    readonly owner: string
    readonly repo: string
    readonly refs: readonly string[]
    readonly mode: 'directory'
    readonly directoryPath: string
  }
  | {
    readonly sourceId: OnlineSkillSourceId
    readonly owner: string
    readonly repo: string
    readonly refs: readonly string[]
    readonly mode: 'discover'
    readonly skillName: string
  }

function requireInstallSource(source: unknown): { readonly sourceId: OnlineSkillSourceId, readonly reference: string } {
  if (typeof source !== 'string' || source.length === 0 || source.length > MAX_INSTALL_SOURCE_LENGTH) {
    throw sourceUnknown('the install source is not one of the coordinates this host hands out')
  }
  for (const character of source) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) throw sourceUnknown('the install source is not a valid coordinate')
  }
  const separator = source.indexOf(':')
  if (separator <= 0) throw sourceUnknown('the install source is not a valid coordinate')
  const sourceId = source.slice(0, separator)
  const reference = source.slice(separator + 1)
  if (!ONLINE_SKILL_SOURCE_IDS.includes(sourceId as OnlineSkillSourceId)) {
    throw sourceUnknown(`the install source names an unknown source (${sourceId})`)
  }
  if (reference.length === 0) throw sourceUnknown('the install source has no reference')
  return { sourceId: sourceId as OnlineSkillSourceId, reference }
}

/**
 * 把坐标解成安装计划。
 *
 * ★`clawhub.ai` 这个 `sourceId` **一律 400**：它在盘点阶段就已经**按条**筛过 —— 只有
 * `install.kind === 'skills-sh'` 的那些会以 `skills.sh:<owner>/<repo>/<dir…>` 的坐标留下来
 *（见 `normalizeClawhub`，那里 `sourceId` 仍报 `clawhub.ai`、坐标却是 skills.sh 的，这是**有意**的不对称），
 * 其余（`kind === 'clawhub'`，实测 75/80）在出结果之前就被丢掉并计进 `sources[].dropped`。
 * ⇒ 这里是一条**防御性**门：把一个 `clawhub.ai:` 开头的坐标走到安装步的，只可能是过期/手造的请求。
 */
function resolveInstallPlan(sourceId: OnlineSkillSourceId, reference: string): InstallPlan {
  const segments = reference.split('/')
  if (sourceId === 'clawhub.ai') {
    throw sourceUnknown('clawhub.ai coordinates are not installable through this host\'s codeload path')
  }
  if (sourceId === 'skills.sh') {
    // `owner/repo/skill-name`（该源没有 ref/目录信息）⇒ ref 只能 main → master 兜底、目录按技能名在包里找。
    if (segments.length !== 3) throw sourceUnknown('the skills.sh coordinate is invalid')
    const [owner, repo, skillName] = segments
    if (requireSafeSegment(owner) === undefined || requireSafeSegment(repo) === undefined
      || skillName === undefined || !SKILL_NAME_PATTERN.test(skillName)) {
      throw sourceUnknown('the skills.sh coordinate is invalid')
    }
    return { sourceId, owner: owner!, repo: repo!, refs: ['main', 'master'], mode: 'discover', skillName }
  }
  // `claude-plugins.dev`：`owner/repo/<ref>/<directoryPath…>`（ref 缺失时归一化那步已写成 main）。
  if (segments.length < 4) throw sourceUnknown('the claude-plugins.dev coordinate is invalid')
  const [owner, repo, ref] = segments
  const directoryPath = requireDirectoryPath(segments.slice(3).join('/'))
  if (requireSafeSegment(owner) === undefined || requireSafeSegment(repo) === undefined
    || requireSafeSegment(ref) === undefined || directoryPath === undefined) {
    throw sourceUnknown('the claude-plugins.dev coordinate is invalid')
  }
  const refs = ref === 'main' ? ['main', 'master'] : ref === 'master' ? ['master', 'main'] : [ref!, 'main', 'master']
  return { sourceId, owner: owner!, repo: repo!, refs, mode: 'directory', directoryPath }
}

/** 抓一个 ref 的整仓 `tar.gz`；404 返回 undefined（调用方换下一个 ref），其余非 200 判上游不可用。 */
async function fetchRepositoryTree(deps: OnlineDependencies, plan: InstallPlan): Promise<readonly TarArchiveEntry[] | undefined> {
  for (const ref of plan.refs) {
    const url = `https://codeload.github.com/${plan.owner}/${plan.repo}/tar.gz/refs/heads/${ref}`
    const { status, bytes } = await fetchWithinLimit(deps, url, ONLINE_TARBALL_MAX_BYTES)
    if (status === 404) continue
    if (status !== 200) throw unreachable(`codeload answered HTTP ${status} for ${plan.owner}/${plan.repo}@${ref}`)
    try {
      return readTarGzipEntries(bytes, {
        maxEntries: ONLINE_TARBALL_MAX_ENTRIES,
        maxUncompressedBytes: ONLINE_TARBALL_MAX_UNCOMPRESSED_BYTES,
        maxEntryBytes: ONLINE_TARBALL_MAX_ENTRY_BYTES,
      })
    } catch (error) {
      // ★体量超限与结构非法必须分开：前者是 413「太大了」，后者是 400「这个包不合法」。
      if (error instanceof TarArchiveTooLargeError) throw tooLarge(error.message)
      if (error instanceof TarArchiveError) throw archiveInvalid(error.message, error)
      throw error
    }
  }
  return undefined
}

/** GitHub 的整仓包顶层是 `{repo}-{ref}/`：所有条目必须同属一个顶层目录，否则这份包来路可疑。 */
function requireArchiveRoot(entries: readonly TarArchiveEntry[]): string {
  let root: string | undefined
  for (const entry of entries) {
    const top = entry.path.split('/')[0]
    if (top === undefined || top.length === 0) throw archiveInvalid('the tarball has an entry without a top-level directory')
    if (root === undefined) root = top
    else if (root !== top) throw archiveInvalid('the tarball does not share a single top-level directory')
  }
  if (root === undefined) throw archiveInvalid('the tarball is empty')
  return root
}

interface SelectedSkill {
  /** 技能名（frontmatter 的 `name`，也是写进 `.dshskill` 的目录名）。 */
  readonly name: string
  /** 相对该技能目录的文件清单（`path` 用 `/`，含 `SKILL.md`）。 */
  readonly files: readonly { readonly path: string, readonly bytes: Buffer }[]
}

/**
 * 在一个目录前缀下收齐文件（不含该前缀本身），并做两条判定：
 *  ① **必须有 `SKILL.md`**；
 *  ② ★**该目录里只允许常规文件与目录**：链接（软/硬）、设备、FIFO 一律整包拒
 *     （`ENT_SKILL_ARCHIVE_INVALID`）—— 我们只提取这一个子目录，所以「包里别处的链接」与我们无关
 *     （线上整仓实测常见），但**进了这份技能目录的链接**必须 fail-closed：跟随它就等于把技能目录外的
 *     字节搬进技能包，不跟随又留一个语义不明的条目。
 */
function collectDirectory(
  entries: readonly TarArchiveEntry[],
  prefix: string,
  label: string,
): { readonly files: readonly { readonly path: string, readonly bytes: Buffer }[] } {
  const files: { path: string, bytes: Buffer }[] = []
  for (const entry of entries) {
    if (!entry.path.startsWith(`${prefix}/`)) continue
    const relative = entry.path.slice(prefix.length + 1)
    if (relative.length === 0) continue
    if (entry.kind === 'directory') continue
    if (entry.kind !== 'file' || entry.bytes === undefined) {
      throw archiveInvalid(`the ${label} contains a non-regular entry (${relative})`)
    }
    files.push({ path: relative, bytes: entry.bytes })
  }
  if (!files.some(file => file.path === SKILL_CONTENT_FILENAME)) {
    throw sourceUnknown(`the ${label} does not contain ${SKILL_CONTENT_FILENAME}`)
  }
  return { files }
}

/** 校验并取回技能名：frontmatter 闸门（§D.4）与官方 watcher 同一枚字段（`name`）。 */
function skillNameOf(files: readonly { readonly path: string, readonly bytes: Buffer }[], label: string): string {
  const markdown = files.find(file => file.path === SKILL_CONTENT_FILENAME)
  if (markdown === undefined) throw sourceUnknown(`the ${label} does not contain ${SKILL_CONTENT_FILENAME}`)
  return validateSkillFrontmatter(markdown.bytes, label).name
}

/** 按计划在整包里定位目标技能（目录模式按前缀；发现模式按 **frontmatter 的技能名**，歧义即拒）。 */
function selectSkill(entries: readonly TarArchiveEntry[], plan: InstallPlan): SelectedSkill {
  const root = requireArchiveRoot(entries)
  if (plan.mode === 'directory') {
    const directory = collectDirectory(entries, `${root}/${plan.directoryPath}`, `directory ${plan.directoryPath}`)
    return { name: skillNameOf(directory.files, plan.directoryPath), files: directory.files }
  }
  // 发现模式：只认 **frontmatter 里那个技能名**（官方 watcher 的同一把尺），必须唯一命中。
  const matches: { readonly directory: string, readonly files: readonly { readonly path: string, readonly bytes: Buffer }[] }[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    if (entry.kind !== 'file') continue
    const segments = entry.path.split('/')
    if (segments[segments.length - 1] !== SKILL_CONTENT_FILENAME || segments.length < 3) continue
    const directory = entry.path.slice(0, entry.path.length - SKILL_CONTENT_FILENAME.length - 1)
    if (seen.has(directory)) continue
    seen.add(directory)
    const files = collectDirectory(entries, directory, directory).files
    let name: string
    try {
      name = skillNameOf(files, directory)
    } catch (error) {
      // 包内其它技能不合规（缺 frontmatter 等）与「找不到目标技能」是两件事：前者跳过、继续找。
      // ★但**目录名就是坐标里那个技能名**时不能吞：那是用户在找的那一条，它的 `SKILL.md` 坏掉必须如实
      //   报 `ENT_SKILL_SKILLMD_INVALID`（「这条技能的文件头不合法」），而不是含糊的「仓库里没这条技能」。
      const basename = directory.slice(directory.lastIndexOf('/') + 1)
      if (basename === plan.skillName) throw error
      continue
    }
    if (name === plan.skillName) matches.push({ directory, files })
  }
  if (matches.length === 0) throw sourceUnknown(`the repository does not contain a skill named ${plan.skillName}`)
  if (matches.length > 1) throw sourceUnknown(`the repository contains ${matches.length} skills named ${plan.skillName}`)
  const hit = matches[0]!
  return { name: plan.skillName, files: hit.files }
}

/** 内存里组一个 `.dshskill`：`manifest.json` + `skills/<name>/**`（与中心/本地上传同一份布局契约）。 */
function buildSkillArchive(skill: SelectedSkill): Buffer {
  const entries: ZipWriteEntry[] = [{
    path: 'manifest.json',
    bytes: Buffer.from(JSON.stringify({ format: 'dsh-skill', version: '1', id: skill.name, name: skill.name }), 'utf8'),
  }]
  const files = [...skill.files].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  for (const file of files) entries.push({ path: `skills/${skill.name}/${file.path}`, bytes: file.bytes })
  try {
    return writeZipArchive(entries)
  } catch (error) {
    throw archiveInvalid('the skill could not be packed into a skill archive', error)
  }
}

function sanitizeSourceInput(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '')
  return cleaned.length > MAX_INSTALL_SOURCE_LENGTH ? cleaned.slice(0, MAX_INSTALL_SOURCE_LENGTH) : cleaned
}

/**
 * 从一条搜索结果安装：坐标 → codeload 整仓 `tar.gz` → 只取目标技能目录 → **内存组 `.dshskill`** →
 * `decodeDshSkillArchive`（同一道包闸门）→ `placeEnterpriseSkillArchive`（**同一套加固落盘**：
 * 落点冲突预检 → 暂存 → 逐个原子改名 → 失败整体回滚）→ 原子写**同一份**自装清单。
 *
 * 判据与顺序：
 *  ① 坐标形状与源（未知源 / 无 GitHub 坐标的 clawhub → `ENT_SKILL_SOURCE_UNKNOWN`(400)）；
 *  ② 仓库整包（ref 逐个试；全 404 → `ENT_SKILL_DOWNLOAD_FAILED`(502)；其它非 200 / 网络失败 / 超时 →
 *     `ENT_SKILL_SOURCE_UNREACHABLE`(502)；超上限 → `ENT_SKILL_SOURCE_TOO_LARGE`(413)；tar/gzip 非法 →
 *     `ENT_SKILL_ARCHIVE_INVALID`(400)）；
 *  ③ 定位目标技能（目录模式按坐标里的目录；发现模式按 **frontmatter 技能名**，0 条或 >1 条都拒）；
 *  ④ 打包 → 解包闸门 → `SKILL.md` frontmatter 闸门（不过即 `ENT_SKILL_SKILLMD_INVALID`(400)）；
 *  ⑤ 幂等（同 `skillId` 同 `sha256` 且目录仍在 ⇒ 直接回当前已装态）；
 *  ⑥ 落盘冲突预检（**企业记录 ∪ 自装记录 − 自己**）→ 落盘 → 写自装记录（`sourceType='github'`）。
 *
 * @param options - 无凭据取数面、可选 dshHome/时钟/留痕端口。
 * @param source - `installSource` 坐标串（`"<sourceId>:<reference>"`）。
 * @returns **与企业安装同形**的最新已装态（界面复用既有解码器；自装清单另经 `/skills/self-installed` 读）。
 * @throws {EnterpriseSkillInstallError} 上述各码。
 */
export async function installSkillFromResult(
  options: EnterpriseSkillOnlineOptions,
  source: unknown,
): Promise<EnterpriseInstalledSkills> {
  const deps = resolveDependencies(options)
  const coordinate = requireInstallSource(source)
  const plan = resolveInstallPlan(coordinate.sourceId, coordinate.reference)
  const entries = await fetchRepositoryTree(deps, plan)
  if (entries === undefined) {
    throw new EnterpriseSkillInstallError(
      'ENT_SKILL_DOWNLOAD_FAILED',
      `the repository ${plan.owner}/${plan.repo} could not be fetched for any of ${plan.refs.join('/')}`,
    )
  }
  const skill = selectSkill(entries, plan)
  // frontmatter 闸门（§D.4）：不合规就整包拒（与上传通路同一枚码），绝不把半个技能落盘。
  const facts = validateSkillFrontmatter(
    skill.files.find(file => file.path === SKILL_CONTENT_FILENAME)!.bytes,
    `${plan.owner}/${plan.repo}`,
  )
  const packed = buildSkillArchive({ name: facts.name, files: skill.files })
  const archive = decodeDshSkillArchive(packed)
  const sha256 = createHash('sha256').update(packed).digest('hex')

  // 两个清单先 fail-closed 读完（损坏即拒），再动磁盘。
  const selfRecords = await readSelfInstalledRecords(deps.local)
  const enterpriseRecords = await readInstalledSkillRecords(deps.local)
  const existing = selfRecords.find(record => record.skillId === archive.skillId)
  if (existing !== undefined && existing.sha256 === sha256) {
    const present = await installedSelfSkills(deps.local)
    if (present.skills.some(record => record.skillId === archive.skillId)) return await installedSkillStatus(deps.local)
  }
  const ownedElsewhere = new Set<string>([
    ...enterpriseRecords.flatMap(record => [...record.names]),
    ...selfRecords.filter(record => record.skillId !== archive.skillId).flatMap(record => [...record.names]),
  ])
  const ownNames = new Set(existing?.names ?? [])
  await placeEnterpriseSkillArchive(deps.local, {
    archive,
    ownNames,
    ownedElsewhere,
    failureCode: 'ENT_SKILL_INSTALL_FAILED',
    commit: async () => {
      const record: SelfInstalledSkillRecord = {
        skillId: archive.skillId,
        displayName: archive.displayName ?? archive.skills[0]!.name,
        sha256,
        names: archive.skills.map(entry => entry.name),
        installedAt: deps.now().toISOString(),
        // 本通路的来源类型是 `github`（plan:676 已列该词）；`sourceInput` 是用户点下来的那条**在线坐标**。
        sourceType: ONLINE_SOURCE_TYPE,
        sourceInput: sanitizeSourceInput(`${coordinate.sourceId}:${coordinate.reference}`),
      }
      await upsertSelfInstalledRecord(deps.local, record)
    },
  })
  return await installedSkillStatus(deps.local)
}
