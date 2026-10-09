/**
 * [INPUT]: 依赖 node:crypto 的 createHash、`esc-route.ts` 的宿主内部读两个唯一入口 `readEnterpriseEscHostJson`/`readEnterpriseEscHostArtifact`、端口形状 `EnterpriseEscHostReadPort` 与读面族码的唯一联合 `EnterpriseEscReadErrorCode`、`zip-archive.ts` 的**唯一** ZIP 内核 `readZipEntries`（+ `ZipArchiveError`）、`skill-archive.ts` 的四条上限常量与技能文件形状、`skill-frontmatter.ts` 的 `validateSkillFrontmatter`、`skill-install.ts` 的 `placeEnterpriseSkillArchive`/`readInstalledSkillRecords`/`requireRelativeSkillPath`/`EnterpriseSkillInstallOptions`、`skill-upload.ts` 的 `installedSelfSkills`/`readSelfInstalledRecords`/`upsertSelfInstalledRecord`/`SYSTEM_ADOPT_SOURCE_TYPE`/`SelfInstalledSkillRecord`/`EnterpriseSelfInstalledSkills` 与 `skill-errors.ts` 的 `EnterpriseSkillInstallError`
 * [OUTPUT]: 对外提供口径 64 B0 的宿主内核 `installPublishedSkill(options, targetId)`（把「系统广场」一条**已发布技能**的导出 ZIP 装进 `<dshHome>/skills`）与 `decodePublishedSkillArchive(bytes)`（裸技能目录 ZIP 的**布局边界**：恰好一个顶层技能目录 + 其中必须有 `SKILL.md`）、两个路径构造器 `publishedSkillDetailPath`/`publishedSkillArchivePath`、合规判决 `requirePublishedSkillCopyable`、唯一新码 `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` 与 provenance 前缀 `PUBLISHED_SKILL_SOURCE_PREFIX`
 * [POS]: bundle 技能纵深的**第五面**（口径 64 B0：系统广场「已发布技能」→ 导出 → 安装）——与「本地上传」「系统搜索」「本地三方」并列，**共用**同一条加固落盘 `placeEnterpriseSkillArchive`、同一份自装记录（逐字七键）与同一个 ZIP 内核；本文件只多两件事：① **裸技能目录 ZIP** 的布局判定（`.dshskill` 那份是 `manifest.json + skills/<kebab>/…`，导出包是 `<技能名>/SKILL.md + <技能名>/references/…`，**没有容器**，故不能走 `decodeDshSkillArchive`）；② ★**合规闸门**。
 *   ★★**为什么合规判据必须由宿主自己判（本刀最重要的一条）**：真机实测平台**有字段、没有执行**——
 *   138 条记录里 `allowCopy=1` 只有 70 条，而 `allowCopy=0` 的 `export/700`（routing-creator）
 *   **照样回 200 + 128,784B ZIP**。⇒ 不自己判，就等于**替员工绕过发布者的授权**；
 *   判据必须绑定**那一条记录的 targetId**（同名技能可以有多条发布记录、各自 `allowCopy` 不同），
 *   故详情走 `GET /api/published/skill/<targetId>`（**id，不是名字**），且**必须在取制品之前**——
 *   `allowCopy !== 1` / `paymentRequired === true` 一律拒，且那两次拒**一次 export 都不打**（用例有请求计数取证）。
 *   ★判据面只住在宿主：详情与制品两条路径都在 `esc-route.ts` 的**宿主内部许可表**里
 *   （浏览器可读表里**没有**它们）⇒ 页面拿不到导出 ZIP，`allowCopy` 那道闸门不可能被前端绕过。
 *   ★**一码一句话**：`allowCopy !== 1` 与 `paymentRequired === true` 的下一步完全相同
 *   （重试永远无效：授权是发布者设的、付款也不是重试能改变的）⇒ 共用新码
 *   `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`（**刻意不进** platform-client 那张码→状态表，落表尾默认 503
 *   ⇒ platform-client 零改动，与 `ENT_SKILL_DISCOVERY_UNAVAILABLE`/`ENT_SKILL_THIRD_PARTY_UNAVAILABLE` 同一手法）。
 *   ★**不新增第二条下载通道**：全程走既有「只读面 + 票据」（`esc-route.ts` 的宿主内部两个入口，
 *   同一条 `sendEscPlatformRequest`：手动重定向拒绝、全程超时、有界读）；**不碰** `/skills/install`、
 *   不碰平台客户端、不引入任何新依赖。
 *   ★**有界取制品**：上限复用既有那条 50 MiB 配额（`SKILL_ARCHIVE_MAX_BYTES`，与中心验包同一把尺）；
 *   超限由调用方翻成既有码 `ENT_SKILL_SOURCE_TOO_LARGE`（413，语义就是"上游这份正文超过本通路的独立上限"），
 *   **绝不截断、绝不半装**。
 *   ★**落盘 = 复制进官方 user-dsh 根**（`<dshHome>/skills/<frontmatter name>`）：与三方那一面同一个理由
 *   ——官方 `skill-filesystem` 的根只有这里与项目根，落进来 Agent 才加载得到、界面「已安装」（读官方发现面）
 *   才看得到。**绝不覆盖**：已装过 ⇒ `ENT_SKILL_ALREADY_REGISTERED`、落点被占 ⇒ `ENT_SKILL_NAME_CONFLICT`
 *   （`ownNames` 恒空 ⇒ 连"同名目录是本包旧版本"这种可替换情形都不存在）。
 *   ★**记账**：自装记录**七键形状一字不改**，`sourceType` 沿用 `'system'`（与通路二/三方那一面同一枚来源标签）、
 *   `sourceInput` 存 `nuwax:<targetId>` —— ★**不写平台 URL、不写宿主路径**（来源坐标就是这个不透明的数字 id）。
 *   ★全程零 `exec`/`spawn`、不做动态 import、不写任何宿主绝对路径进响应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import {
  readEnterpriseEscHostArtifact,
  readEnterpriseEscHostJson,
  type EnterpriseEscHostReadPort,
  type EnterpriseEscReadErrorCode,
} from './esc-route.js'
import { EnterpriseSkillInstallError } from './skill-errors.js'
import { validateSkillFrontmatter } from './skill-frontmatter.js'
import {
  SKILL_ARCHIVE_MAX_BYTES,
  SKILL_ARCHIVE_MAX_ENTRIES,
  SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
  SKILL_MD_MAX_BYTES,
  type SkillArchiveFile,
} from './skill-archive.js'
import {
  placeEnterpriseSkillArchive,
  readInstalledSkillRecords,
  requireRelativeSkillPath,
  SKILL_CONTENT_FILENAME,
  type EnterpriseSkillInstallOptions,
} from './skill-install.js'
import {
  installedSelfSkills,
  readSelfInstalledRecords,
  SYSTEM_ADOPT_SOURCE_TYPE,
  upsertSelfInstalledRecord,
  type EnterpriseSelfInstalledSkills,
  type SelfInstalledSkillRecord,
} from './skill-upload.js'
import { ZipArchiveError, readZipEntries, type ZipArchiveLimits } from './zip-archive.js'

/**
 * 本面**唯一**的稳定码：发布者不允许复制（`allowCopy !== 1` 或 `paymentRequired === true`）。
 *
 * ★**一码一句话**：这两种拒的下一步完全相同 —— **重试永远无效**（授权由发布者在平台上设定，
 * 付款也不是"再点一次"能改变的）⇒ 不为同一种结果造第二枚码。
 * ★它与 `ENT_SKILL_DISCOVERY_UNAVAILABLE`/`ENT_SKILL_THIRD_PARTY_UNAVAILABLE` **同一手法**：
 * 刻意**不进** platform-client 的 `enterpriseLocalErrorStatus` 表、落在表尾默认 **503**
 * ⇒ platform-client 一个字节都不用改（界面那侧的 `retryable: false` 是界面自己的投影）。
 */
export const ENT_SKILL_PUBLISHED_COPY_FORBIDDEN = 'ENT_SKILL_PUBLISHED_COPY_FORBIDDEN'

/**
 * 自装记录 `sourceInput` 的来源前缀：`nuwax:<targetId>`。
 *
 * ★为什么不是平台 URL：① 记录是**脱敏事实**，URL 里带着部署域名与路径，比一个不透明数字更"多"；
 * ② `sourceInput` 在自装侧的**唯一消费点**是 `selfInstalledRecordPresent`（判记录还在不在），
 * 而它只对 `sourceType === 'system'` 且 `sourceInput` 是**绝对路径**时才用这一格 ——
 * `nuwax:<id>` 不是绝对路径，故存在性判据自然走 `names`（`<root>/<name>/SKILL.md`），
 * 与"我们真的把那棵目录放进去了"逐字一致。宿主路径同样不写（同样的脱敏纪律）。
 */
export const PUBLISHED_SKILL_SOURCE_PREFIX = 'nuwax:'

/** 平台统一信封的成功码（真源 `nuwax-auth.ts:66` 的 `PLATFORM_SUCCESS_CODE`，与 `esc-mock.ts:591` 同值）。 */
const PLATFORM_SUCCESS_CODE = '0000'

/** 交给共享 ZIP 内核的三条上限：与 `.dshskill` 中心验包**逐字同一把尺**（50 MiB / 1 万条 / 解压 200 MiB）。 */
const PUBLISHED_SKILL_ZIP_LIMITS: ZipArchiveLimits = {
  maxBytes: SKILL_ARCHIVE_MAX_BYTES,
  maxEntries: SKILL_ARCHIVE_MAX_ENTRIES,
  maxUncompressedBytes: SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
}

/** 详情路径：`GET /api/published/skill/<targetId>`（数字段只来自安全整数，结构上拼不出逃逸路径）。 */
export function publishedSkillDetailPath(targetId: number): string {
  return `/api/published/skill/${targetId}`
}

/** 制品路径：`GET /api/published/skill/export/<targetId>`（★这条**只在宿主内部许可表**里）。 */
export function publishedSkillArchivePath(targetId: number): string {
  return `/api/published/skill/export/${targetId}`
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function archiveInvalid(message: string, cause?: unknown): EnterpriseSkillInstallError {
  return cause === undefined
    ? new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message)
    : new EnterpriseSkillInstallError('ENT_SKILL_ARCHIVE_INVALID', message, { cause })
}

/**
 * **读面族**的失败（与 `esc-route.ts` 的 `EnterpriseEscReadErrorCode` 同一组码，不新造第二套字符串）。
 *
 * ★为什么不用 `EnterpriseSkillInstallError`：那枚错误类的码联合是**技能族**的封闭边界
 * （`skill-errors.ts`），而这里抛的是"平台这次读取被拒/读不懂"——它属读面族，落到路由那张唯一的
 * 码→状态表上分别是 403 与 502。两者只共享同一个约定：**只带稳定 `code`**。
 */
class PublishedSkillReadError extends Error {
  constructor(
    readonly code: EnterpriseEscReadErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PublishedSkillReadError'
  }
}

function copyForbidden(message: string): EnterpriseSkillInstallError {
  return new EnterpriseSkillInstallError('ENT_SKILL_PUBLISHED_COPY_FORBIDDEN', message)
}

/**
 * 从**详情信封**里读合规判据并**当场判决**（本面唯一一处判据，不含任何取数、不做任何 I/O）。
 *
 * 判据顺序（缺一即停）：
 *  ① 信封必须是对象且 `code` 是成功码（`'0000'`，兼容数字 `0`）—— 非成功码是**平台拒绝**这次读取
 *     （目标不存在 / 无权查看），如实说成 `ENT_NUWAX_REJECTED`（403），绝不拿它当"可以装"；
 *  ② `data` 必须是对象（判据就在里面；读不懂判**协议错**，绝不猜"大概是允许"）；
 *  ③ ★`allowCopy !== 1` ⇒ 拒（**fail-closed**：字段缺席、`true`、`'1'`、`0` 全部落在"不允许"这一侧）；
 *  ④ `paymentRequired === true` ⇒ 拒（同码；真机 138 条里付费 0 条，但字段在，就必须判）。
 *
 * @param envelope - `GET /api/published/skill/<targetId>` 的平台信封（宿主内部读面原样取回）。
 * @throws {PublishedSkillReadError} `ENT_NUWAX_REJECTED`（平台拒绝这次读取）/
 *   `ENT_NUWAX_PROTOCOL`（信封或 `data` 读不懂）——两者都是**读面族**的码，与 `esc-route.ts` 同源。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`（合规拒：`allowCopy` / 付款）。
 */
export function requirePublishedSkillCopyable(envelope: unknown): void {
  const record = asRecord(envelope)
  if (record === undefined) {
    throw new PublishedSkillReadError('ENT_NUWAX_PROTOCOL', 'the platform detail is not a JSON object')
  }
  const code = record['code']
  if (code !== PLATFORM_SUCCESS_CODE && code !== 0) {
    throw new PublishedSkillReadError('ENT_NUWAX_REJECTED', 'the platform refused to read this published skill')
  }
  const data = asRecord(record['data'])
  if (data === undefined) {
    throw new PublishedSkillReadError('ENT_NUWAX_PROTOCOL', 'the published skill detail carries no data object')
  }
  // ★`!== 1` 而不是 `=== 0`：判据要的是"发布者明确允许复制"，任何读不懂/缺席的取值都必须落在拒的一侧。
  if (data['allowCopy'] !== 1) {
    throw copyForbidden('the publisher does not allow copying this published skill')
  }
  if (data['paymentRequired'] === true) {
    throw copyForbidden('this published skill requires payment before it can be copied')
  }
}

/** 一个裸技能目录 ZIP 解出来的技能树（路径**相对技能目录**）。 */
export interface PublishedSkillTree {
  /** 包内那唯一一个顶层目录名（诊断用；落点名以 **frontmatter 的 `name`** 为准，与官方 watcher 同款）。 */
  readonly directory: string
  /** 技能目录下的全部文件（含 `SKILL.md`；路径相对该目录，已过共享内核的路径门禁）。 */
  readonly files: readonly SkillArchiveFile[]
}

/**
 * 解出一个**裸技能目录** ZIP（口径 64 的导出包）；任何不合规都抛 `ENT_SKILL_ARCHIVE_INVALID`。
 *
 * 布局判定（真机三份导出包的形状：`<技能名>/SKILL.md` + `<技能名>/references/*.md`）：
 *  · 容器层四道门禁全部由**共享内核** `readZipEntries` 承担（路径逃逸/符号链接/条目数/解压总量，
 *    三条上限见 `PUBLISHED_SKILL_ZIP_LIMITS`）——本文件**绝不自写第二个 ZIP 解析器**；
 *  · 顶层必须**恰好一个目录**（所有条目共享同一个首段；`zip -r` 可能写父目录条目 `flow-builder/`，
 *    它是目录条目、`readZipEntries` 会把尾斜杠去掉，故这里按"首段集合"判）；
 *  · 每个条目都必须在那个目录**里面**（顶层裸文件 ⇒ 拒：那说明这不是一份技能目录导出）；
 *  · 目录里必须有 `SKILL.md`，且它不超过 256 KiB（与 `.dshskill` 那条 `SKILL_MD_MAX_BYTES` 同一把尺）。
 *
 * ★它**不解析 frontmatter**（那是 `skill-frontmatter.ts` 的职责、由 `installPublishedSkill` 单独过闸），
 * 也**不执行包内任何内容**。
 *
 * @param bytes - 宿主内部读面取回的制品字节（已按 50 MiB 配额有界读取）。
 * @returns 顶层目录名与逐条文件。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_ARCHIVE_INVALID`：容器层或布局层任一不合规。
 */
export function decodePublishedSkillArchive(bytes: Buffer): PublishedSkillTree {
  let entries: ReturnType<typeof readZipEntries>
  try {
    entries = readZipEntries(bytes, PUBLISHED_SKILL_ZIP_LIMITS)
  } catch (error) {
    throw archiveInvalid(error instanceof ZipArchiveError ? error.message : 'archive could not be parsed', error)
  }
  const tops = new Set(entries.map(entry => entry.path.split('/')[0] ?? ''))
  if (tops.size !== 1) {
    throw archiveInvalid('the published skill archive must contain exactly one top-level directory')
  }
  const directory = [...tops][0] ?? ''
  if (directory.length === 0) throw archiveInvalid('the published skill archive has an empty skill directory')
  const files: SkillArchiveFile[] = []
  for (const entry of entries) {
    const segments = entry.path.split('/')
    // 顶层裸文件（`segments.length === 1`）：那份导出不是"一个技能目录"，拒。
    if (segments.length < 2) {
      throw archiveInvalid('the published skill archive must keep every entry inside the skill directory')
    }
    if (entry.isDirectory) continue
    const relative = segments.slice(1).join('/')
    if (relative.length === 0 || entry.bytes === undefined) {
      throw archiveInvalid('the published skill archive contains an invalid skill file path')
    }
    if (relative === SKILL_CONTENT_FILENAME && entry.bytes.byteLength > SKILL_MD_MAX_BYTES) {
      throw archiveInvalid('the published skill archive contains an oversized SKILL.md')
    }
    files.push({ path: relative, bytes: entry.bytes })
  }
  if (!files.some(file => file.path === SKILL_CONTENT_FILENAME)) {
    throw archiveInvalid('the published skill archive is missing SKILL.md')
  }
  return { directory, files }
}

/**
 * 本面需要的注入点：既有技能安装选项（落盘根/时钟/留痕）+ **宿主内部只读面**。
 *
 * ★`platform` 那一格在这条路上**一个字节都不打**（它只为满足既有落盘/记录入口的形状而存在，
 * 与三方那一面同一个约定）；本面唯一的取数通道是 `esc`（同一条只读面 + 同一枚票据）。
 */
export interface EnterprisePublishedSkillInstallOptions extends EnterpriseSkillInstallOptions {
  /** 宿主内部只读端口（组合层把 `registerEnterpriseEscReadRoute` 的同一个对象交进来）。 */
  readonly esc: EnterpriseEscHostReadPort
}

/**
 * 把「系统广场」一条**已发布技能**装进本机官方技能根（口径 64 B0 的宿主内核）。
 *
 * 闸门顺序（缺一即停，每一步都可测）：
 *  ① **形状门禁**：`targetId` 必须是 `1..2^53-1` 的安全整数（不是路径、不是字符串 id）⇒ 否则 400 `ENT_INVALID_REQUEST`；
 *  ② **详情判合规**（`GET /api/published/skill/<id>`，宿主内部读面）⇒ `allowCopy !== 1` 或
 *     `paymentRequired === true` ⇒ 拒 `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`；★这两条拒**在取制品之前**；
 *  ③ **有界取制品**（`GET /api/published/skill/export/<id>`，上限 50 MiB）⇒ 超限 ⇒ `ENT_SKILL_SOURCE_TOO_LARGE`；
 *  ④ 解包（共享 ZIP 内核四道门禁）⇒ `ENT_SKILL_ARCHIVE_INVALID`；
 *  ⑤ frontmatter 闸门（`validateSkillFrontmatter`）⇒ `ENT_SKILL_SKILLMD_INVALID`；
 *  ⑥ 落盘（`placeEnterpriseSkillArchive`，`ownNames` 恒空 ⇒ 绝不覆盖）：已装过 ⇒ `ENT_SKILL_ALREADY_REGISTERED`、
 *     落点被占 ⇒ `ENT_SKILL_NAME_CONFLICT`；记账写自装清单（逐字七键，`sourceType: 'system'`、
 *     `sourceInput: 'nuwax:<targetId>'`）。
 *
 * @param options - 既有技能安装选项 + 宿主内部只读端口。
 * @param targetId - 广场列表记录里那枚 `targetId`（**那一条记录**的 id，不是名字）。
 * @returns 安装后的**本机自装清单**（与 `GET /skills/self-installed` 逐字同形）。
 * @throws {EnterpriseSkillInstallError} 上表逐条；另有 `ENT_AUTH_REQUIRED`（没登录）/
 *   `ENT_NUWAX_REJECTED`（平台拒绝）/ `ENT_NUWAX_{UNAVAILABLE,TIMEOUT,PROTOCOL}`（上游故障）/
 *   `ENT_SKILL_{INSTALL_FAILED,STATE_INVALID}`（落盘与记账）。
 */
export async function installPublishedSkill(
  options: EnterprisePublishedSkillInstallOptions,
  targetId: unknown,
): Promise<EnterpriseSelfInstalledSkills> {
  // ① 形状门禁（安全整数与下界；`Number.isSafeInteger` 天然给出上界 2^53-1）。
  if (typeof targetId !== 'number' || !Number.isSafeInteger(targetId) || targetId < 1) {
    throw new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'targetId must be a positive safe integer')
  }
  const rootOptions: EnterpriseSkillInstallOptions = {
    platform: options.platform,
    ...(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.onError === undefined ? {} : { onError: options.onError }),
  }
  // ② 详情判合规（**必须在取制品之前**：不合规时 export 一次都不许打）。
  requirePublishedSkillCopyable(
    await readEnterpriseEscHostJson(options.esc, publishedSkillDetailPath(targetId)),
  )
  // ③ 有界取制品（50 MiB 配额复用既有那条；超限明确失败，绝不截断）。
  const artifact = await readEnterpriseEscHostArtifact(options.esc, {
    path: publishedSkillArchivePath(targetId),
    maxBytes: SKILL_ARCHIVE_MAX_BYTES,
  })
  if (!artifact.ok) {
    throw new EnterpriseSkillInstallError(
      'ENT_SKILL_SOURCE_TOO_LARGE',
      'the published skill artifact is larger than the local limit',
    )
  }
  // ④ 解包（共享内核的四道门禁全在）。
  const tree = decodePublishedSkillArchive(artifact.bytes)
  // ⑤ frontmatter 闸门（与另三条通路**同一份**实现；不过即整次拒绝、零落盘）。
  const markdown = tree.files.find(file => file.path === SKILL_CONTENT_FILENAME)
  if (markdown === undefined) throw archiveInvalid('the published skill archive is missing SKILL.md')
  const facts = validateSkillFrontmatter(markdown.bytes, tree.directory)
  const skillName = facts.name
  // 落点名与记录名必须是同一把尺：走过既有那份唯一的相对路径门禁（facts.name 必是 kebab，这里是复核）。
  const segments = requireRelativeSkillPath(skillName)
  if (segments.length !== 1 || segments[0] !== skillName) {
    throw new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'the published skill name is not a single segment')
  }
  const selfRecords = await readSelfInstalledRecords(rootOptions)
  const enterpriseRecords = await readInstalledSkillRecords(rootOptions)
  const ownedElsewhere = new Set<string>([
    ...enterpriseRecords.flatMap(record => [...record.names]),
    ...selfRecords.flatMap(record => [...record.names]),
  ])
  // ⑥ 两条 fail-closed（顺序：先「已装过」，再「落点被别人占了」——与三方那一面同款）。
  if (ownedElsewhere.has(skillName) || selfRecords.some(record => record.skillId === skillName)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_ALREADY_REGISTERED', 'this published skill is already installed')
  }
  await placeEnterpriseSkillArchive(rootOptions, {
    archive: {
      skillId: skillName,
      displayName: skillName,
      skills: [{ name: skillName, files: tree.files }],
    },
    // ★本面**绝不覆盖**：可替换集合恒空（同名目录存在 ⇒ 落点冲突预检直接 409）。
    ownNames: new Set<string>(),
    ownedElsewhere,
    failureCode: 'ENT_SKILL_INSTALL_FAILED',
    commit: async () => {
      const record: SelfInstalledSkillRecord = {
        skillId: skillName,
        displayName: skillName,
        // 摘要算在**这次接受的那份制品字节**上：它是唯一能与上游导出逐字节对照的事实
        // （自装清单里那枚 `sha256` 的口径，见 `skill-upload.ts` 的记录注释）。
        sha256: createHash('sha256').update(artifact.bytes).digest('hex'),
        names: [skillName],
        installedAt: (options.now ?? (() => new Date()))().toISOString(),
        // 沿用通路二那枚来源标签（`sourceType` 是自由字符串，加取值**不改**七键键集）。
        sourceType: SYSTEM_ADOPT_SOURCE_TYPE,
        // 来源坐标 = 广场那一条记录的 targetId；**不写平台 URL、不写宿主路径**。
        sourceInput: `${PUBLISHED_SKILL_SOURCE_PREFIX}${targetId}`,
      }
      await upsertSelfInstalledRecord(rootOptions, record)
    },
  })
  return await installedSelfSkills(rootOptions)
}
