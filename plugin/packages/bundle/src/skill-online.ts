/**
 * [INPUT]: 依赖 node:crypto 的 createHash、`@dshent/platform-client` 的 `resolveEnterpriseDshHome`、本包 `tar-archive.ts`（`readTarGzipEntries`）、`zip-archive.ts`（`writeZipArchive`）、`skill-archive.ts`（`decodeDshSkillArchive`/`SKILL_ARCHIVE_MAX_BYTES`）、`skill-frontmatter.ts`（`validateSkillFrontmatter`）、`skill-install.ts`（`placeEnterpriseSkillArchive`/`installedSkillStatus`/`readInstalledSkillRecords`/`SKILL_CONTENT_FILENAME`）、`skill-skillhub.ts`（`installSkillhubSkill`/`parseSkillhubReference`/`requireSkillhubParts`/`SkillhubArtifact`）与 `skill-upload.ts`（`upsertSelfInstalledRecord`/`readSelfInstalledRecords`/`installedSelfSkills`/`SYSTEM_ADOPT_SOURCE_TYPE` 同族的记录形状）
 * [OUTPUT]: 对外提供通路三「在线搜索」的两件事：`searchOnlineSkills(options, query)`（**四源** fan-out + 归一化 + 去重 + **逐源 ok**）与 `installSkillFromResult(options, source)`（把 `installSource` 坐标解成 codeload tarball → 内存组 `.dshskill` → **复用加固落盘**；`skillhub.cn` 那条坐标走**单跳 302 → COS 制品** → 复用 `skill-skillhub.ts` 的第三布局与加固落盘），以及 `EnterpriseOnlineSkillSearch`/`EnterpriseOnlineSkillResult`/`EnterpriseOnlineSkillSource` 形状、四条独立上限常量、`ONLINE_SKILL_SOURCE_IDS`、`SKILLHUB_REDIRECT_HOSTS` 与 `redirectRequestHeaders`（白名单跳的**减头**判据）
 * [POS]: bundle 技能纵深的**第四条通路**（真源 `docs/research/cherry-skill-add-2026-10-05.md` §1 与 `docs/plan/skill-install-sources.md` §B.2/§C/§F.1）——上游 Cherry 的**三个聚合源**（`skillMarketplace.ts:345-374` 的 `MARKETPLACE_SOURCES`）加**本刀第四源** `skillhub.cn` 与我们**自己的**安装链：★公开源一律走**无凭据裸取数面** `options.fetch`，**绝不**用平台面（`platform-service.ts:709-733` 那个 `request` 是同源 + 注入 Bearer 的，拿它打第三方等于把企业令牌发给公网）；★SSRF 白名单（`skills.sh`/`claude-plugins.dev`/`clawhub.ai`/`api.skillhub.cn`/`codeload.github.com`）+ 手动重定向（跨出白名单即拒）+ 只 GET 不带任何 header；★**第四源** `skillhub.cn`（API Base `https://api.skillhub.cn`，免鉴权）追加在 `ONLINE_SKILL_SOURCE_IDS` **表尾** —— 顺序是**跨包契约**（界面那一刀按同一份顺序渲染来源 chip），既有三源**一字未改**：搜索走 `GET /api/skills?keyword=&page=&pageSize=&sortBy=score`（★**不用**官方文档禁掉的 `/api/v1/search`）、条目里 `description` 优先 `description_zh`、`name` 用主 `name`、`stars`/`installs` 有就给没有就整键不产出（"没说"与"说 0"分得开）、`homepage` 字段**一律不用**（主页由界面自己拼 `https://skillhub.cn/skills/<slug>`）；下载是 `GET /api/v1/download?slug=&version=` 的 **302 → `*.cos.accelerate.myqcloud.com`**，故本文件另有一条**只跟随一跳**的取数（`SKILLHUB_REDIRECT_HOSTS` 独立白名单 + 白名单跳**减头**：绝不给重定向那一跳带 `Authorization`/任何凭据头，COS 的 URL 自带授权），跳转正文（`<a href=…>`）**不是**制品；★它自己聚合别家（`source=clawhub` 那一桶与既有的直连 `clawhub.ai` **重叠**）⇒ 结果合并时按 **slug 去重**，直连源优先（理由见 `searchOnlineSkills` 的注释）；★「装不出来就丢」是**按条**判、不是按源：`clawhub.ai` 的 `install.kind` 实测两种（**75/80 是 `clawhub`、5/80 是 `skills-sh`**；我自己那次 4 query/40 条是 38+2），前者载荷里没有本机装得出来的坐标 ⇒ 丢并**计数**（`sources[].dropped`，不许静默），后者的 `reference` 形如 `skills-sh:<owner>/<repo>/<dir…>` ⇒ 保留并走**与 `skills.sh` 源同一份**解析（详见 `normalizeClawhub`）；★落盘不新造第二套：内存组包 → `decodeDshSkillArchive` → `placeEnterpriseSkillArchive`，与中心安装/本地上传**同一套**落点冲突预检与原子改名；★全程零 exec/spawn、不做动态 import、不落可执行位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 *
 * ─────────────────────────────── 本刀（在线搜索的取数延迟：逐源截止时间） ───────────────────────────────
 * 真机读数（用户反馈「数据加载很慢」）：`GET /enterprise/api/v1/local/skills/online-search?q=test` 连测两次
 * 都是 **5.41 s**；逐源计时给出的账是 `clawhub.ai /api/v1/search` **4.03 s 冷 / 1.88 s 暖**（元凶）、
 * `skills.sh` 0.86–0.94 s、`claude-plugins.dev` 0.35 s、`api.skillhub.cn` 0.28 s。四源**本来就并发**，
 * 但整条路由 = 最慢那一个源 + 其余开销 ⇒ **一个慢源把整页拖到 5.4 秒**（对照：`/skills/third-party`
 * 暖缓存 0.40 s、企业平台整条链路 ~0.1 s，都不是这一刀的事）。
 *
 * **做了什么**：新增具名常量 `ONLINE_SEARCH_SOURCE_TIMEOUT_MS = 2500`（数值出处：恰好容得下 clawhub 的
 * 暖态 1.88 s 并留抖动余量，又把最坏情况从 5.4 s 压到 ~2.5 s + 其余源耗时；其余三家实测全部 ≤0.94 s，
 * 2500 对它们宽裕 —— 这条线是为**最慢那一家**设的，不是为平均设的）。
 *
 * **怎么做的**：★**唯一一处 timeout 实现** —— `fetchWithinLimit` 那段既有的 `AbortController` + `setTimeout`
 * 现在按一枚 `timeoutMs` **参数**决定预算：搜索面传本常量、安装面照旧传 `ONLINE_SKILL_REQUEST_TIMEOUT_MS`。
 * **没有第二处实现、没有 `Promise.race`、没有外层兜底计时器**。
 *
 * **语义一条没动**：四源**仍然并发**（`Promise.allSettled` 那行未动）；每个源**自己**一个 controller
 * ⇒ ★**一条超时不连坐**别的源；超时走既有的 catch 收敛成 `ENT_SKILL_SOURCE_UNREACHABLE`，在**既有的**
 * 逐源状态里**如实标成 `ok:false`** —— ★**响应形状一个字节没改**（`EnterpriseOnlineSkillSource` 仍是
 * `{id, ok, dropped?}`，界面那句「这一源这次没取到」照原形状渲染，**一个字段都不用加**）；
 * 「部分成功保留、全失败才 502」那句也一字未动 ⇒ **该源超时不算整体失败**。
 *
 * ★**有意的取舍（代价如实登记，不藏）**：网络慢时 **`clawhub.ai` 会在结果里缺席**（那一源少一批结果）。
 * 这是**故意**的：宁可少一个源的那部分，也不要整页 5.4 秒。缺席**如实可见**（那一源 `ok:false`），不为留住
 * 它把整页拖回 5 秒。
 *
 * ★**与两条既有常量互不替代**：`ONLINE_SEARCH_MAX_BYTES`（4 MiB）挡的是「源回一个**巨型正文**」（无界的
 * **体积**），本常量挡的是「源**慢到**让整页不可用」（无界的**等待**）—— 27 KB 的正文可以慢到 4 秒，
 * 5 MiB 的正文也可以 40 ms 到；`ONLINE_SKILL_REQUEST_TIMEOUT_MS`（15 s）是**传输层**兜底（按跳重计，
 * 装几百 MB 的整仓包 legitimately 要很久），本常量是**搜索面**的产品级上限。两者**并存**，不合并。
 */

import { createHash } from 'node:crypto'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { decodeDshSkillArchive, SKILL_ARCHIVE_MAX_BYTES } from './skill-archive.js'
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
  installSkillhubSkill,
  parseSkillhubReference,
  requireSkillhubParts,
  type SkillhubArtifact,
} from './skill-skillhub.js'
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

/**
 * 四源声明序（响应里 `sources[]` 与去重的「先到先得」都按它）。
 *
 * ★**顺序本身是跨包契约**：第四源 `skillhub.cn` 钉死在**表尾**（既有三源的相对顺序与字面值一个字节未动），
 * 界面那一刀按同一份顺序渲染来源 chip；"先到先得"的去重也因此天然让**直连源**赢过**聚合源**
 * （skillhub.cn 聚合别家 ⇒ 同一条技能若它先被直连源产出，就轮不到它）。
 */
export const ONLINE_SKILL_SOURCE_IDS = ['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'skillhub.cn'] as const
export type OnlineSkillSourceId = (typeof ONLINE_SKILL_SOURCE_IDS)[number]

/**
 * 单次取数的超时（照上游 `skillSearch.ts:10` 的 `REQUEST_TIMEOUT_MS = 15_000`）。
 * 覆盖「拿到响应头 + 读完正文」全程：只给响应头设超时会让一个卡住的正文永远挂着。
 *
 * ★**这条只管安装面**（codeload 整仓包与 skillhub 制品）：它按**每一跳**重新计时，一次安装允许多跳。
 * 搜索面**不走**这条 —— 见下面 `ONLINE_SEARCH_SOURCE_TIMEOUT_MS`。
 */
export const ONLINE_SKILL_REQUEST_TIMEOUT_MS = 15_000
/**
 * ★**逐源取数截止时间**（本刀）：搜索面的**每一源**各自一条，四个源**仍然是并发**取的。
 *
 * **为什么要有它**：四源并发 ⇒ 整条路由的耗时 = **最慢那一个源** + 其余开销。真机实测
 * `GET /enterprise/api/v1/local/skills/online-search?q=test` 连测两次都是 **5.41 s**，
 * 逐源计时给出的账是：
 *  | 源 | 端点 | 实测 |
 *  |---|---|---|
 *  | `clawhub.ai` | `/api/v1/search` | **4.03 s 冷 / 1.88 s 暖** ← 元凶 |
 *  | `skills.sh` | `/api/search` | 0.86–0.94 s |
 *  | `claude-plugins.dev` | `/api/skills` | 0.35 s |
 *  | `api.skillhub.cn` | `/api/skills` | 0.28 s |
 * ⇒ **一个慢源把整页拖到 5.4 秒**，而其余三源加起来不到 2 秒。
 *
 * **数值怎么来的**：取 **2500 ms** = 恰好容得下 clawhub 的**暖态** 1.88 s（留约 0.6 s 余量给抖动），
 * 又把最坏情况从 5.4 s 压到 ~2.5 s + 其余源耗时。其余三家实测全部 ≤0.94 s，2500 对它们是**宽裕**的 ——
 * 这条线是为**最慢那一家**设的，不是为平均设的。
 *
 * ★**它与 `ONLINE_SKILL_REQUEST_TIMEOUT_MS` 的分工（两条都在、职责不重叠）**：
 * 15 s 是**传输层**的兜底（装一个几百 MB 的整仓包 legitimately 要很久；且它按跳重计），
 * 2.5 s 是**搜索面**的产品级上限（这是一次交互里的页面加载，用户等不了 5 秒）。二者**并存**：
 * 搜索面那 2.5 s 先到就先放弃；安装面根本没有 2.5 s 这条线。
 *
 * ★**与 `ONLINE_SEARCH_MAX_BYTES` 的关系（一个管字节、一个管时间，互不替代）**：
 * 字节上限挡的是「源回一个巨型正文」（无界的**体积**）；本条挡的是「源慢到让整页不可用」（无界的**等待**）。
 * 一个 27 KB 的正文可以慢到 4 秒，一个 5 MiB 的正文也可以 40 ms 就到 —— 谁都替不了谁，
 * 所以两条常量**都在**，不合并、不互相推导。
 *
 * ★**有意的取舍（代价写在这里，不藏）**：网络慢的时候 **`clawhub.ai` 会在结果里缺席**（这一源少一批结果）。
 * 这是**故意的**：宁可少一个源的 5% 结果，也不要整页 5.4 秒。缺席是**如实可见**的 —— 那一源在既有的
 * 逐源状态里被标成 `ok:false`，界面那句「这一源这次没取到」照既有形状渲染，**为此新增任何字段都是多余的**
 * （响应形状一个字节没动）。★**一条超时不连坐**：每个源有自己的 `AbortController` 与定时器，
 * 一家超时其余三家照常返回；该源超时也**不算整体失败**（既有「部分成功保留、全失败才 502」一字不动）。
 *
 * ★**唯一一处实现**：定时器与 `AbortController` 全在 `fetchWithinLimit` 里（既有那段），由那枚
 * `timeoutMs` 参数决定用哪条线 —— 搜索面传本常量、安装面传 `ONLINE_SKILL_REQUEST_TIMEOUT_MS`。
 * 本刀**没有**第二处 timeout、没有 `Promise.race`、没有外层兜底计时器。
 */
export const ONLINE_SEARCH_SOURCE_TIMEOUT_MS = 2500
/**
 * 单个搜索响应的字节上限（**独立常量**：既不是 JSON 路由那 256 KiB，也不是上传那 50 MiB）。
 * 三源实测 16~27 KB，这里留三个数量级冗余，只用来挡住「源返回一个巨型正文」。
 *
 * ★它管**字节**、`ONLINE_SEARCH_SOURCE_TIMEOUT_MS` 管**时间**，互不替代（理由见那条常量的注释）。
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
 * SSRF 白名单（`skill-install-sources.md` §F.1）：**只有**这五个 host 会被取数。
 * 三个搜索源 + `codeload.github.com`（整仓 tarball）+ **本刀第四源** `api.skillhub.cn`（搜索与 302 的起点）；
 * ★`raw.githubusercontent.com` **不在**白名单里 —— 本机实测它连不上（curl rc=28），而且按文件逐取会撞
 * GitHub Contents API 的 60/小时配额。
 * ★`skillhub.cn` 那条 302 的**落点**（`*.cos.accelerate.myqcloud.com`）**刻意不在这里** ——
 * 它是另一类信任关系（对象存储、URL 自带一次性授权），走下面 `SKILLHUB_REDIRECT_HOSTS` 那份**独立**白名单，
 * 免得"搜索源白名单"被顺手当成"任何跳转都能去"的通行证。
 */
const ALLOWED_HOSTS: readonly string[] = ['skills.sh', 'claude-plugins.dev', 'clawhub.ai', 'api.skillhub.cn', 'codeload.github.com']
/** 手动跟随的重定向上限（每次跳转都重新过白名单）。 */
const MAX_REDIRECTS = 2
/**
 * skillhub.cn **制品**重定向的**独立**白名单（本刀只放行真机实测的那一台 COS 主机：
 * `GET /api/v1/download?slug=&version=` 实测 302 到 `https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/<slug>/<version>.zip`）。
 *
 * ★为什么必须与 `ALLOWED_HOSTS` **分开**：两份表说的是两件事 —— 那一份是"我们的取数面有哪几个 host"，
 * 这一份是"这一跳的对象存储确实属于我们信任的那条链路"。混成一份，"跨域跳转能被看见并拒掉"这条判据就没了
 * （任何进过白名单的 host 都会顺理成章地成为跳转落点）。其余域一律拒，**绝不**"跟随任何 Location"。
 */
export const SKILLHUB_REDIRECT_HOSTS: readonly string[] = ['skillhub-1388575217.cos.accelerate.myqcloud.com']
/** 制品下载**只跟随一跳**（`MAX_REDIRECTS` 那条多跳策略属搜索面与整仓面，**绝不**复用到制品跳上）。 */
const SKILLHUB_ARTIFACT_MAX_REDIRECTS = 1
/** 算"重定向"的状态码：只有这四个跟随；其余 3xx（300/301/304/305/306）一律判协议错。 */
const REDIRECT_STATUSES: readonly number[] = [302, 303, 307, 308]
/**
 * 凭据类请求头（小写比对）：它们**绝不**跟着重定向离开平台域。
 *
 * COS 的下载 URL **自带**一次性授权，我们一个凭据字节都不需要送过去；而本通路的取数面本来就只 GET、不带任何 header
 * —— 这道减头是"结构上不可能带上"的第二重保证：将来若有人在第一跳加了头，白名单那一跳也不会把它带出去。
 */
const CREDENTIAL_HEADERS: readonly string[] = [
  'authorization',
  'cookie',
  'proxy-authorization',
  'proxy-authenticate',
  'x-api-key',
  'x-auth-token',
]
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
 * 一次受控取数：白名单 × 手动重定向 × 有界读取 × **零 header** × 逐跳 `timeoutMs` 截止时间。
 *
 * 返回状态码而不是「非 2xx 即抛」：`codeload` 的 404 是「这个 ref 没有」（调用方要换 ref 重试），
 * 而 403/429/5xx 是「上游不可用」，两者的下一步不同。
 *
 * ★**截止时间是本函数里唯一一处 timeout 实现**：`AbortController` + `setTimeout` 只在这里一对，
 * 搜索面传 `ONLINE_SEARCH_SOURCE_TIMEOUT_MS`、安装面传 `ONLINE_SKILL_REQUEST_TIMEOUT_MS`（同一段代码，
 * 两种预算）。每个调用点**自己**一个 controller ⇒ **一个源超时不会连坐别的源**（四源仍并发）。
 *
 * @param timeoutMs - 这一跳的截止时间；超时即 `controller.abort()`，`deps.fetch` 以 `AbortError` 收敛成
 *   `ENT_SKILL_SOURCE_UNREACHABLE`（走 catch 那条既有收敛），**该源因此在逐源状态里被如实标成 `ok:false`**。
 */
async function fetchWithinLimit(
  deps: OnlineDependencies,
  url: string,
  limit: number,
  timeoutMs: number,
): Promise<{ readonly status: number, readonly bytes: Buffer }> {
  let current = requireAllowedUrl(url, message => unreachable(message))
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController()
    // ★每一跳一个自己的定时器（不跨跳复用）：跳数上限由 `MAX_REDIRECTS` 管。
    const timer = setTimeout(() => controller.abort(), timeoutMs)
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
      // ★成功 / 失败 / 抛出（含 abort 本身）三条路径**都**走这里 ⇒ 不留悬挂定时器。
      //   少了这一句，每次搜索都要在事件循环里留一个最长 2.5 s（安装面 15 s）的空转定时器。
      clearTimeout(timer)
    }
  }
  throw unreachable('the upstream redirected too many times')
}

async function fetchSearchJson(deps: OnlineDependencies, url: string, sourceId: OnlineSkillSourceId): Promise<unknown> {
  // ★搜索面那条 2.5 s 的逐源截止时间（唯一实现见 `fetchWithinLimit`）；安装面那条 15 s 不参与搜索。
  const { status, bytes } = await fetchWithinLimit(deps, url, ONLINE_SEARCH_MAX_BYTES, ONLINE_SEARCH_SOURCE_TIMEOUT_MS)
  if (status !== 200) throw unreachable(`${sourceId} answered HTTP ${status}`)
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw skillInstallError(error, 'ENT_SKILL_SOURCE_UNREACHABLE', `${sourceId} answered a body that is not JSON`)
  }
}

/**
 * 白名单跳的**减头**判据：把一枚请求头集合里所有凭据类键去掉，只留与身份无关的那些。
 *
 * 参数缺省（本通路第一跳的真实情形）得到**空集合** —— 公开源只 GET、不带任何 header。
 * 导出它是为了让"减头"这件事**能被单独取证**：跨域那一跳拿到的永远是本函数的输出，
 * 而不是上一跳的请求头原件（`fetchSkillhubArtifact` 的注释给出为什么这一跳一个凭据字节都不许带）。
 */
export function redirectRequestHeaders(headers?: HeadersInit): Record<string, string> {
  const sanitized: Record<string, string> = {}
  if (headers === undefined) return sanitized
  new Headers(headers).forEach((value, key) => {
    if (CREDENTIAL_HEADERS.includes(key.toLowerCase())) return
    sanitized[key] = value
  })
  return sanitized
}

/** 制品重定向落点的**独立**门禁：https + 无内嵌凭据 + `SKILLHUB_REDIRECT_HOSTS`（**不是** `ALLOWED_HOSTS`）。 */
function requireSkillhubRedirectTarget(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw unreachable(`the skillhub.cn redirect target is not absolute (${String(error)})`)
  }
  if (url.protocol !== 'https:') throw unreachable('the skillhub.cn redirect target is not https')
  if (url.username !== '' || url.password !== '') {
    throw unreachable('the skillhub.cn redirect target must not embed credentials')
  }
  if (!SKILLHUB_REDIRECT_HOSTS.includes(url.hostname)) {
    throw unreachable(`the skillhub.cn redirect target host ${url.hostname} is not on the redirect allowlist`)
  }
  return url
}

/**
 * 取一枚 skillhub.cn 制品：`GET https://api.skillhub.cn/api/v1/download?slug=&version=` → **手动跟随恰好一跳** 302 → COS ZIP。
 *
 * 判据与顺序：
 *  ① 起点过 `ALLOWED_HOSTS`（`api.skillhub.cn` 在白名单里）；
 *  ② `redirect: 'manual'` + **只跟随一跳**（`SKILLHUB_ARTIFACT_MAX_REDIRECTS`，与搜索面那条两跳策略分开）：
 *     第二个 3xx 一律判 `ENT_SKILL_SOURCE_UNREACHABLE`，**绝不**再跟；
 *  ③ 落点过**独立**白名单（`requireSkillhubRedirectTarget`）；相对 Location 会解析回 `api.skillhub.cn`
 *     ⇒ 同样被那份白名单拒（这条通路只认实测那一台 COS 主机）；
 *  ④ ★**白名单那一跳减头**（`redirectRequestHeaders`）：绝不给它带 `Authorization`/任何凭据头；
 *  ⑤ ★302 的正文（真实形状是一段 `<a href=…>` 的 HTML）**不是**制品：无论跟不跟得成，当场 `cancel` 掉正文，
 *     只有**跟随成功那一跳**的 200 正文才进有界读取；
 *  ⑥ 有界读取上限复用既有那 **50 MiB** 配额（`SKILL_ARCHIVE_MAX_BYTES`，与中心验包/导出包同一把尺），超限即
 *     `ENT_SKILL_SOURCE_TOO_LARGE`，**绝不截断、绝不半装**。
 *
 * @param deps - 无凭据取数面（公开源只走它）。
 * @param slug - 上游 slug（已按 `requireSkillhubParts` 收窄）。
 * @param version - 搜索那一刻看到的那一版（制品 URL 按版本取 ⇒ 装到的就是用户看到的那一版）。
 * @returns 制品 ZIP 的字节。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_DOWNLOAD_FAILED`（404：这一版拿不到了）/
 *   `ENT_SKILL_SOURCE_UNREACHABLE`（网络、超时、非 200、重定向越界或过多）/
 *   `ENT_SKILL_SOURCE_TOO_LARGE`（超过 50 MiB 配额）。
 */
async function fetchSkillhubArtifact(deps: OnlineDependencies, slug: string, version: string): Promise<Buffer> {
  const query = `slug=${encodeURIComponent(slug)}&version=${encodeURIComponent(version)}`
  let current = requireAllowedUrl(`https://api.skillhub.cn/api/v1/download?${query}`, message => unreachable(message))
  // 第一跳不带任何 header（公开源不要凭据）；白名单那一跳再从它做一次**减头**。
  let headers = redirectRequestHeaders()
  for (let hop = 0; hop <= SKILLHUB_ARTIFACT_MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ONLINE_SKILL_REQUEST_TIMEOUT_MS)
    try {
      const response = await deps.fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers,
        signal: controller.signal,
      })
      if (REDIRECT_STATUSES.includes(response.status)) {
        const location = response.headers.get('location')
        // ★跳转正文不是制品：先丢掉，再判这次跳转认不认。
        await cancelBody(response)
        if (location === null || location === undefined || location === '') {
          throw unreachable('skillhub.cn redirected without a location')
        }
        current = requireSkillhubRedirectTarget(new URL(location, current).toString())
        headers = redirectRequestHeaders(headers)
        continue
      }
      if (response.status >= 300 && response.status < 400) {
        await cancelBody(response)
        throw unreachable(`skillhub.cn answered an unsupported redirect (${response.status})`)
      }
      if (response.status === 404) {
        await cancelBody(response)
        // 「这一版拿不到了」与「上游挂了」的下一步不同（前者该重新搜索，后者可以重试）。
        throw new EnterpriseSkillInstallError(
          'ENT_SKILL_DOWNLOAD_FAILED',
          'the skillhub.cn artifact is not available any more',
        )
      }
      if (response.status !== 200) {
        await cancelBody(response)
        throw unreachable(`skillhub.cn answered HTTP ${response.status}`)
      }
      return await readBoundedBytes(response, SKILL_ARCHIVE_MAX_BYTES)
    } catch (error) {
      // 已经是受控码的（上面的 404/超限）原样穿透；其余收敛成"源不可达"。
      throw skillInstallError(error, 'ENT_SKILL_SOURCE_UNREACHABLE', `the skillhub.cn artifact request failed (${current.hostname})`)
    } finally {
      clearTimeout(timer)
    }
  }
  throw unreachable('skillhub.cn redirected more than once')
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

/**
 * 归一化 `skillhub.cn`（**第四源**，API Base `https://api.skillhub.cn`，免鉴权）：顶层是
 * `{"code":0,"message":"success","data":{"total":<n>,"skills":[…]}}`。
 *
 * ★只认 `code === 0`（真机实测形状就是**数值** 0）：字符串 `'0'`、缺席、`null` 与任何非 0 值一律判
 * **这个源这次挂了**（`ENT_SKILL_SOURCE_UNREACHABLE`）—— 判据宁可严：平台的失败码我们读不懂，
 * 绝不拿它当"大概有结果"。
 * ★官方文档两条禁令逐条照做：搜索**不用** `/api/v1/search`（走 `/api/skills`，见 `ONLINE_SKILL_SOURCES`）；
 * **不用**返回的 `homepage` 字段（那是 `api.skillhub.cn/<owner>/<slug>`）—— 主页由界面自己按 slug 拼
 * `https://skillhub.cn/skills/<slug>`，本文件连这个字段都不读。
 * ★字段映射（与既有三源**逐字同形**的那一枚结果形状，**不多一枚键**）：
 * `name` 取主 `name`（**不是** `description_zh`）；`description` **优先** `description_zh`（中文站点、
 * 界面也面向中文员工），它缺席时才回落 `description`；`author` 取 `ownerName`；`stars`/`installs`
 * **有就给、没有就整键不产出**（"没说"与"说 0"分得开，`optionalCount` 已经这么判）。
 * ★坐标 `skillhub.cn:<slug>@<version>`：**必须**同时有形状合规的 `slug` 与 `version` ——
 * ① 版本要写进自装记录的 provenance（不写版本，记录就对"装了哪一版"撒谎）；
 * ② 制品 URL 按版本取 ⇒ 装到的就是用户看到的那一版（不按版本取，"最新"会在搜索与下载之间漂移）。
 * 两者缺一或形状不合 ⇒ **按条丢弃并计数**（装不出来就丢，且不静默）；判据与安装侧是**同一把尺**
 * （`requireSkillhubParts`，见 `skill-skillhub.ts`）。
 */
function normalizeSkillhub(value: unknown, deps: OnlineDependencies): OnlineSourceOutcome {
  const record = asRecord(value)
  const data = asRecord(record?.['data'])
  if (record === undefined || data === undefined || record['code'] !== 0) {
    throw unreachable('skillhub.cn answered an invalid search response')
  }
  const list = requireArray(data, 'skills', 'skillhub.cn')
  const results: EnterpriseOnlineSkillResult[] = []
  let dropped = 0
  for (const item of list) {
    const entry = asRecord(item)
    const name = optionalString(entry?.['name'])
    if (entry === undefined || name === undefined) {
      throw unreachable('skillhub.cn answered an invalid search entry')
    }
    const parts = requireSkillhubParts(optionalString(entry['slug']), optionalString(entry['version']))
    if (parts === undefined) {
      dropped += 1
      continue
    }
    const description = optionalString(entry['description_zh']) ?? optionalString(entry['description'])
    const author = optionalString(entry['ownerName'])
    const stars = optionalCount(entry['stars'])
    const installs = optionalCount(entry['installs'])
    results.push({
      sourceId: 'skillhub.cn',
      name,
      ...(description === undefined ? {} : { description }),
      ...(author === undefined ? {} : { author }),
      ...(stars === undefined ? {} : { stars }),
      ...(installs === undefined ? {} : { installs }),
      installSource: `skillhub.cn:${parts.slug}@${parts.version}`,
    })
  }
  if (dropped > 0) {
    deps.onError?.(
      `enterprise online skill search dropped ${dropped} skillhub.cn result(s):`
      + ' a result without a well-formed slug@version cannot be installed from this host',
      undefined,
    )
  }
  return { results, dropped }
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
  // ── 第四源（本刀）─────────────────────────────────────────────────────────────────────────────
  // ★**追加在表尾**：既有三源的相对顺序与三个 endpoint 字面值一个字节未动；表尾位置是跨包契约
  //   （界面按同一份顺序渲染来源 chip），同时让"先到先得"的去重天然把聚合源排在直连源之后。
  {
    id: 'skillhub.cn',
    // 搜索面按官方文档给的那条：`/api/skills?keyword=&page=&pageSize=&sortBy=`（**不是** `/api/v1/search`）。
    // `pageSize=20` 与 `claude-plugins.dev` 那枚 `limit=20` 同量级；`sortBy=score` 是相关度排序
    // （真机 `keyword=周报&sortBy=score` 实测 200、total=1907）；`order`/`category`/`source`/`labels`
    // 四个可选筛选一律不传 —— 本通路只做"按查询串搜"，不自作主张收窄用户看到的结果集。
    endpoint: query => `https://api.skillhub.cn/api/skills?keyword=${encodeURIComponent(query)}&page=1&pageSize=20&sortBy=score`,
    normalize: normalizeSkillhub,
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
 * 四源 fan-out：`Promise.allSettled` + **部分成功保留**（照上游 `skillMarketplace.ts:388-405`），
 * 只有**全失败**才抛 `ENT_SKILL_SOURCE_UNREACHABLE`(502)；每个失败源留一条 `onError` 痕。
 *
 * 去重照上游 `:407-413`：按 `name.toLowerCase()` **先到先得**，顺序 = 源声明序 × 源内上游顺序。
 * 去重在**丢弃之后**做 —— 否则一个源里「解不出坐标」的同名条目会把它自己挡掉后面那个能装的。
 * ★本刀**另加**一层按 **slug** 的去重，**只作用于聚合源 `skillhub.cn`**（同一 slug 已被更早的源产出
 * ⇒ 丢掉聚合源那一条；理由与"直连源优先"见合并循环里那段注释）。既有三源之间的行为因此**一个字节未变**。
 *
 * ★**逐源截止时间**（本刀 `ONLINE_SEARCH_SOURCE_TIMEOUT_MS = 2500`）：`Promise.allSettled` 下面那一行
 * **一个字都没改** —— 四源**仍然并发**，★**一条超时不连坐**别的源（每源自己的 `AbortController`）。
 * 超时的那一源经既有 catch 收敛成 `ENT_SKILL_SOURCE_UNREACHABLE`，走到下面那个 `rejected` 分支，
 * 于是被标成 `{id, ok:false}` —— ★**这正是「如实」**：它和「这个源 500」「这个源载荷形状不对」共用同一条
 * 失败通道与同一枚 `ok:false`，**不需要为超时另造一枚码、也不需要给响应加一枚字段**（界面那句
 * 「这一源这次没取到」照既有形状渲染）。★也因此**一条超时不等于整体失败**：`sources.every(ok === false)`
 * 那句未动 ⇒ 其余三源有结果就是 200。
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
  // ★第四源带来的第二层去重键（按 **slug**）；既有那层按折叠名去重**一字未改**（两个集合各管一件事）。
  const slugs = new Set<string>()
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
      // ★**只作用于聚合源 skillhub.cn 的一条新判据**（既有三源之间的相对行为因此完全不变）：
      // `skillhub.cn` 自己聚合别家（`source=clawhub` 那一桶与既有的直连 `clawhub.ai` 重叠）⇒
      // 同一条技能会在两个源里各出现一次。**直连源优先**：直连源的数据更原始，聚合源可能滞后
      // （版本/描述/计数都可能旧一拍），而用户点"安装"要的是那份最原始的事实。
      // 它在 `ONLINE_SKILL_SOURCE_IDS` **表尾** ⇒ "先到先得"天然等于"直连源赢"，这条判据只会挡下它自己。
      const slug = slugKeyOf(result)
      if (result.sourceId === 'skillhub.cn' && slug !== undefined && slugs.has(slug)) continue
      seen.add(key)
      if (slug !== undefined) slugs.add(slug)
      results.push(result)
    }
  }
  if (sources.every(source => !source.ok)) {
    throw unreachable('every online skill source is unavailable')
  }
  return { sources, results }
}

/**
 * 一条结果里那枚"同一个技能"的判据（**按 slug**，不是按显示名）：坐标引用里最后一段、去掉 `@<version>` 后缀、
 * 折叠成小写。
 *
 * 四种源的坐标最后一段恰好都是那枚技能在来源侧的名字：`skills.sh:<owner>/<repo>/<skill>`、
 * `claude-plugins.dev:<owner>/<repo>/<ref>/<dir…>`（最后一段是目录名）、`clawhub.ai` 留下来的那条
 * `skills.sh:<owner>/<repo>/<skill>`（`sourceId` 仍是 clawhub.ai，见 `normalizeClawhub`）、
 * `skillhub.cn:<slug>@<version>`。★它**只**用于上面那条聚合源判据，不参与既有三源之间的去重。
 */
function slugKeyOf(result: EnterpriseOnlineSkillResult): string | undefined {
  const separator = result.installSource.indexOf(':')
  if (separator <= 0) return undefined
  const reference = result.installSource.slice(separator + 1)
  const at = reference.lastIndexOf('@')
  const withoutVersion = at > 0 ? reference.slice(0, at) : reference
  const last = withoutVersion.split('/').filter(segment => segment.length > 0).pop()
  if (last === undefined) return undefined
  const folded = last.toLowerCase()
  return folded.length === 0 ? undefined : folded
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
 *
 * ★`skillhub.cn` 这个 `sourceId` 同样**一律 400**，理由不同：它的坐标由 `installSkillFromResult` 在更前面
 * 就分派给 `installSkillhubSkill`（302 → COS 制品那条链），**根本不该**走到本函数；显式拦住它是为了让它
 * 不可能掉进下面 `claude-plugins.dev` 的分支（那会把一个 slug 当成仓库坐标去抓包）。
 */
function resolveInstallPlan(sourceId: OnlineSkillSourceId, reference: string): InstallPlan {
  const segments = reference.split('/')
  if (sourceId === 'clawhub.ai') {
    throw sourceUnknown('clawhub.ai coordinates are not installable through this host\'s codeload path')
  }
  if (sourceId === 'skillhub.cn') {
    // ★防御性门（照上面 clawhub.ai 那条）：`installSkillFromResult` 已经在前面把第四源分派给
    // `installSkillhubSkill`（它走 302 → COS 制品那条链，不是 codeload）。走到这里只可能是过期/手造的请求；
    // ★**必须显式拦**：否则它会掉进下面 `claude-plugins.dev` 那条分支，把一个 slug 当仓库坐标去抓包。
    throw sourceUnknown('skillhub.cn coordinates are served by the artifact path, not the codeload path')
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
    // ★安装面用**自己那条** 15 s（整仓包本来就大，且 ref 要逐个试）；搜索面那条 2.5 s 不蔓延到这里。
    const { status, bytes } = await fetchWithinLimit(
      deps,
      url,
      ONLINE_TARBALL_MAX_BYTES,
      ONLINE_SKILL_REQUEST_TIMEOUT_MS,
    )
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
 * 从一条搜索结果安装。**两条链**，按 `sourceId` 分派：
 *  · 既有三源：坐标 → codeload 整仓 `tar.gz` → 只取目标技能目录 → **内存组 `.dshskill`** →
 *    `decodeDshSkillArchive`（同一道包闸门）→ `placeEnterpriseSkillArchive`（**同一套加固落盘**：
 *    落点冲突预检 → 暂存 → 逐个原子改名 → 失败整体回滚）→ 原子写**同一份**自装清单（`sourceType='github'`）；
 *  · ★第四源 `skillhub.cn`（本刀）：坐标 `skillhub.cn:<slug>@<version>` → `GET /api/v1/download`
 *    **单跳 302 → COS** 的那份**裸技能目录 ZIP** → `decodeBareSkillDirectory`（第三布局，**同一个** ZIP 内核）
 *    → 同一份 frontmatter 闸门 → **同一份** `placeEnterpriseSkillArchive`（`ownNames` 恒空 ⇒ 绝不覆盖）
 *    → 同一份七键自装记录（`sourceType='system'`、`sourceInput='skillhub:<slug>@<version>'`）。
 * 两条链的**返回值逐字同形**（都是 `installedSkillStatus`，与 `/skills/install` 同形）。
 *
 * 判据与顺序（既有三源那条链）：
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
  // ★第四源（skillhub.cn）的坐标**不走** codeload 那条链：它是 `302 → COS` 的一份**裸技能目录 ZIP**，
  //   取数（单跳重定向 + 独立白名单 + 减头 + 50 MiB 有界读）在下面 `fetchSkillhubArtifact`，
  //   布局与安装内核在 `skill-skillhub.ts`（同一份加固落盘、同一份七键自装记录、同一个 ZIP 内核）。
  if (coordinate.sourceId === 'skillhub.cn') {
    const parts = parseSkillhubReference(coordinate.reference)
    if (parts === undefined) throw sourceUnknown('the skillhub.cn coordinate is invalid')
    const artifact: SkillhubArtifact = {
      bytes: await fetchSkillhubArtifact(deps, parts.slug, parts.version),
      slug: parts.slug,
      version: parts.version,
    }
    return await installSkillhubSkill(deps.local, artifact)
  }
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
