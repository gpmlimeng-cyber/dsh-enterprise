/**
 * [INPUT]: 依赖浏览器 fetch 与 FormData/Blob、local-api-decode 的全部严格解码与失败码投影
 * [OUTPUT]: **本刀（登录入口换成 NUWAX）**：`createEnterpriseLocalApi` 新增三个同源方法 `nuwaxStatus` / `nuwaxLogin(account,password)` / `nuwaxLogout`（前两条响应同形 ⇒ 共用 `decodeEnterpriseNuwaxStatus`；口令只进 POST 正文，不写 URL 也不进请求头）与三条导出常量 `ENTERPRISE_NUWAX_{LOGIN,LOGOUT,STATUS}_LOCAL_PATH`（与 Host 的 exact 注册面逐字同值）。对外提供 `createEnterpriseLocalApi`（固定同源路径的取数与动作，含请 Host 打开帮助中心的 `openHelp`、读**已装**技能正文的 `skillContent`，以及详情子页面用的 `skillFiles`（本机文件树）与 `skillFile`（树里一个文本文件））、五条同源技能路径常量（`ENTERPRISE_SKILL_{INSTALL,UNINSTALL,INSTALLED,CONTENT}_LOCAL_PATH` 与 `enterpriseSkillFilesPath`/`enterpriseSkillFilePath` 两条**动态**本机文件路径构造器）与 local-api-decode 的全部导出 **本刀（配方一键启用）**：新增三件配方动作 `presetStatus` / `enablePreset` / `disablePreset`（路径与 body 严格照路由形状：`GET …/presets/<雪花 id>/status`、`POST …/presets/<雪花 id>/enable`（body 关闭键集 `{}` 或恰好 `{confirmFingerprint}`）、`POST …/presets/<声明 id>/disable`（body 恒 `{}`））与三个路径构造器 `enterprisePreset{Enable,Status,Disable}Path` + 三条子路径共用的注册面前缀 `ENTERPRISE_PRESET_ACTION_LOCAL_PATH`） **本刀（企业插件真取消）**：新增 `cancelPlugin(packageName, signal)`——同源 POST `/enterprise/api/v1/local/plugins/cancel`，正文关闭键集恰好 `{packageName}`，响应与只读 `GET /plugins` **完全同形**（复用同一个严格解码器，**零新增字段**），并导出与 Host exact 注册面逐字同值的常量 `ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH`。
 * [POS]: dsh-ui 的浏览器网络边界——只发同源固定路径请求，调用方无法注入平台 origin 或 Authorization；DTO 契约与解码在 local-api-decode.ts，本文件只管发与收 **本刀**：`/presets` 那三条子路径由 Host 的同一个 prefix 按后缀分派，本文件只多三件固定路径的收发，边界口径（只同源、只发固定路径、键集封闭）一字未改。 **本刀（企业插件真取消）**：`/plugins/cancel` 是本族第三件动作（与 `install`/`remove` 同源同族），浏览器侧只多一次 POST 收发；取消的**结果**不由这条响应判定（响应同形、零新增字段），而是由那次安装请求自己的收束（`ENT_PLUGIN_INSTALL_CANCELLED`）读出来——故本文件不解析任何取消语义。
 * **本刀（本地导入）**：`uploadSkill` 是本族第二条**上传**路径（`POST /skills/upload`，multipart 恰好一个
 *   `artifact` file part，正文构造与反馈附件同一手法 `skillUploadForm`；响应与 `installSkill` 完全同形
 *   ⇒ 复用同一个严格解码器），`selfInstalledSkills` 是它配套的那条只读 `GET /skills/self-installed`
 *   （自装是**独立**记录，不比企业已装清单多一个字段）；并导出 `ENTERPRISE_SKILL_{UPLOAD,SELF_INSTALLED}_LOCAL_PATH`
 *   与 multipart 字段名 `ENTERPRISE_SKILL_UPLOAD_FIELD`。浏览器只发同源固定路径与用户选中的文件字节，**不传任何宿主路径**。
 * **本刀（系统搜索）**：新增 `systemSearch(signal)`（只读盘点 `GET /skills/system-search`：本机技能根 + 每条候选三态）
 *   与 `adoptSystemSkill(path, signal)`（纳入 `POST /skills/adopt`，正文**关闭键集恰好 `{path}`**；`path` 只可能是
 *   盘点投影里给过的那条 canonical 绝对路径，界面原样收下、原样回传，**从不拼、从不接受用户输入**；
 *   响应与 `GET /skills/self-installed` 逐字同形 ⇒ 复用同一个严格解码器）；并导出与 `platform-client`
 *   逐字同值的 `ENTERPRISE_SKILL_{SYSTEM_SEARCH,ADOPT}_LOCAL_PATH`（两条都是 exact 路由：否则会被 `/skills` prefix 当包 id）。
 * **本刀（在线搜索）**：新增 `onlineSearchSkills(query, signal)`（只读 `GET /skills/online-search?q=…`）与
 *   `installSkillFromResult(source, signal)`（`POST /skills/install-from-result`，正文**关闭键集恰好 `{source}`**；
 *   `source` 只可能是搜索结果里原样回来的那条 `installSource`，界面原样回传、从不拼、从不解析；
 *   响应与 `GET /skills/installed` 逐字同形 ⇒ 复用同一个严格解码器）；并导出与 `platform-client` 逐字同值的
 *   `ENTERPRISE_SKILL_{ONLINE_SEARCH,INSTALL_FROM_RESULT}_LOCAL_PATH`。
 * **本刀（插件行动分流）**：新增 `setPluginEnabled(packageName, enabled, signal)` —— 两条**独立**的同源路径
 *   `POST /enterprise/api/v1/local/plugins/{enable,disable}`（方向由路径决定，正文恒是关闭键集 `{packageName}`），
 *   响应与只读 `GET /plugins` 完全同形故复用同一个严格解码器；并导出与 `platform-client` 逐字同值的
 *   `ENTERPRISE_PLUGIN_{ENABLE,DISABLE}_LOCAL_PATH`。**关闭开关＝停用，不是卸载**：卸载仍走 `removePlugin`。
 *   ★**口径 54（本刀）**：新增 `discoveredSkills(signal)`（同源只读 `GET /skills/discovered`，严格解码）
 *     与路径常量 `ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH` —— 它是**「已安装」的真源**（宿主官方
 *     `ctx.get('skills')` 的快照 = 本机运行时真正加载的那一份），答的是"磁盘上真的装着什么"；
 *     老那两份记录（`installedSkills` / `selfInstalledSkills`）**降级为来源/元信息**，不再作判据。
 * **本刀（口径 62：本地三方 Agent 技能源）**：新增 `thirdPartySkills(signal)`（只读扫描
 *   `GET /skills/third-party`：别家 Agent CLI 的技能库里有哪几枚候选、各自什么状态）与
 *   `installThirdPartySkill(path, signal)`（`POST /skills/third-party/install`，正文**关闭键集恰好 `{path}`**；
 *   `path` 就是扫描投影里那枚不透明 `id`，界面原样回传、**从不拼路径**——响应里压根没有路径可拼）；
 *   并导出与 Host exact 注册面逐字同值的 `ENTERPRISE_SKILL_THIRD_PARTY{,_INSTALL}_LOCAL_PATH`。
 *   ★语义与通路二（`system-search`/`adopt`）**不同**：那条是"只登记"（目录本来就在官方加载的根里），
 *     这条是"**复制**进 `<dshHome>/skills`"（源目录在别人的库里，官方扫不到）⇒ 两套语义各自有名字。
 * **本刀（口径 64：系统广场「已发布技能」安装）**：新增 `installPublishedSkill(targetId, signal)`
 *   （`POST /skills/published/install`，正文**关闭键集恰好** `{targetId}`，坐标是**安全整数**
 *   `1..2^53-1`——不是路径、不是字符串 id、更不是 `packageId`）与路径常量
 *   `ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH`（与 Host exact 注册面逐字同值）。
 *   ★响应与 `GET /skills/self-installed` **逐字同形** ⇒ **复用** `decodeEnterpriseSelfInstalledSkills`
 *     那一枚既有严格解码器（宿主收尾那行就是 `installedSelfSkills(…)`）；**不**用企业已装那份七键闭合的
 *     解码器——响应里没有中心 `packageId`/`versionId`，用它会把每一次成功都判成 `ENT_LOCAL_RESPONSE_INVALID`
 *     （见 `local-api-decode.ts` 那一格的长注释）。
 *   ★它与 `installSkill` 是**两条路**：坐标（安全整数 vs 雪花字符串）、制品来源（平台导出 ZIP vs 中心制品）、
 *     响应（本机自装清单 vs 企业已装清单）三件全不同 ⇒ 两格并列，各只有一个调用点（门禁反锁）。
 *  **本刀（S5a：自装技能的两个本机动作）**：新增两格动作 —— `uninstallSelfInstalledSkill(name, signal)`
 *   与 `revealSelfInstalledSkill(name, signal)`（`POST /skills/self-installed/{uninstall,reveal}`，
 *   正文**关闭键集恰好** `{name}`，键名收敛成导出常量 `ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY`）
 *   与两条 exact 注册面常量 `ENTERPRISE_SKILL_SELF_INSTALLED_{UNINSTALL,REVEAL}_LOCAL_PATH`。
 *   ★`name` 是技能在**本机的目录名**（kebab）而不是记录里的 `skillId`（后者跨四条安装通路语义不统一，
 *     真正的落盘名在记录的 `names[]` 里）；界面的可用性判据因此只看「`name` 在不在这份记录里」，
 *     而**归属的权威仍在宿主**（中心记录认领 ⇒ 404、两条自装记录认领 ⇒ 409，界面不写第二套判据）。
 *   ★响应的严格口径在 `skill-api-decode.ts`（自装清单那一族）：卸载回执 `{skills,removed}`
 *     （`skills` **复用**既有自装清单解码器；两格各自严格、宿主多带的日志键忽略），
 *     打开文件夹回执 `{revealed:true}` 单键封闭（宿主绝对路径不进浏览器）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  EnterpriseLocalApiError,
  decodeBootstrap,
  decodeEnterpriseAccountOrigin,
  decodeEnterpriseAccountOriginUpdate,
  decodeEnterpriseBranding,
  decodeEnterpriseFeedbackReceipt,
  decodeEnterpriseDataEnvelope,
  decodeEnterpriseCredentialResult,
  decodeEnterpriseErrorCode,
  decodeEnterpriseDiscoveredSkills,
  decodeEnterpriseInstalledSkills,
  decodeEnterpriseInstalledSkillContent,
  decodeEnterpriseInstalledSkillFile,
  decodeEnterpriseInstalledSkillFiles,
  decodeEnterpriseLocalStatus,
  decodeEnterpriseLoginCancel,
  decodeEnterpriseLoginForm,
  decodeEnterpriseLoginStart,
  decodeEnterpriseLogout,
  decodeEnterpriseLibraryHits,
  decodeEnterpriseLibraryImport,
  decodeEnterpriseLibrarySetTaskSelection,
  decodeEnterpriseLibrarySpace,
  decodeEnterpriseLibraryTaskSelection,
  decodeEnterpriseLibraryText,
  decodeEnterprisePluginStatus,
  decodeEnterprisePresets,
  decodeEnterprisePresetDisable,
  decodeEnterprisePresetEnable,
  decodeEnterprisePresetStatus,
  decodeEnterpriseRestoredSession,
  decodeEnterpriseOnlineSkillSearch,
  decodeEnterpriseSelfInstalledSkills,
  decodeEnterpriseSelfInstalledUninstall,
  decodeEnterpriseSelfInstalledReveal,
  decodeEnterpriseServerUrl,
  decodeEnterpriseSkillDetail,
  decodeEnterpriseSkills,
  decodeEnterpriseSystemSkills,
  decodeEnterpriseThirdPartySkills,
  decodeEnterpriseNuwaxStatus,
  decodeEnterpriseUninstall,
  decodeEnterpriseUsage,
  decodeRemoteSessions,
  decodeSessionSyncStatus,
  type EnterpriseFeedbackDraft,
  type EnterpriseLocalApi,
} from './local-api-decode.js'
import type { EnterpriseBrandingDocument } from './branding.js'

export * from './local-api-decode.js'
export type { EnterpriseBrandingDocument }

const LOCAL_API_PREFIX = '/enterprise/api/v1/local'

/**
 * 资料库单入口**相对**本地 API 前缀的路径（`POST`，正文恒是关闭键集的 `{endpoint,payload}`）。
 *
 * 与 Host 的 `bundle/src/library/route.ts` 注册的 exact 路径逐字同值：源码里宿主绝对路径不出现，
 * 界面这一侧也从拼不出第二条资料库路径（原件流式 GET 由浏览器直接按 `<img>/<a>` 语义使用，
 * 本刀不做原件下载，故这里只保留这一条）。
 */
const LIBRARY_ENTRY_PATH = '/library'

/**
 * 资料库单入口的请求体：`{endpoint, payload}` 两键封闭。
 *
 * 为什么保留这层内层协议（而不是每个动作一条路径）：Host 侧一条 exact 就够（引擎 exact 表只认整条
 * 字面路径，12 个动作逐条拆表会把路由表撑大且表达不了动态 id），浏览器这一侧也就只需要认识一个路径。
 */
function libraryInit(endpoint: string, payload: unknown, signal: AbortSignal): RequestInit {
  return jsonInit('POST', { endpoint, payload }, signal)
}

/**
 * 取消动作**相对**本地 API 前缀的路径（与 `install`/`remove` 两位内联兄弟同形）。
 * 它只出现一次：下面那条导出的注册面常量由它拼出来，`requestJson` 再拼上固定前缀。
 */
const PLUGIN_CANCEL_PATH = '/plugins/cancel'

/**
 * 启用 / 停用**相对**本地 API 前缀的两条路径（与 `install`/`remove` 两位内联兄弟同形）。
 *
 * 两条各自只出现一次：下面那两条导出的注册面常量由它们拼出来，`requestJson` 再拼上固定前缀。
 * 方向由路径决定（`/enable` 与 `/disable` 是两条独立的路由，不是一个 `{enabled}` 布尔入参）——
 * 与官方插件页「启用/停用」那枚开关走的本机服务面同形，正文因此可以小到恰好 `{packageName}`。
 */
const PLUGIN_ENABLE_PATH = '/plugins/enable'
const PLUGIN_DISABLE_PATH = '/plugins/disable'

/**
 * NUWAX 员工登录三条**相对**路径（本刀：登录入口换成 NUWAX）。
 *
 * 与 Host 的 `bundle/src/nuwax-route.ts` 注册的三条 exact 路径逐字同值
 * （`/enterprise/api/v1/local/nuwax/{login,logout,status}`）；三条互不为前缀，不抢路由。
 * `login` 与 `logout` 是动作、`status` 是只读投影——前者收 `{account,password}` 关闭键集，
 * 后两者不读正文。
 */
const NUWAX_LOGIN_PATH = '/nuwax/login'
const NUWAX_LOGOUT_PATH = '/nuwax/logout'
const NUWAX_STATUS_PATH = '/nuwax/status'

/**
 * 系统广场「已发布技能」**安装**动作的**相对**路径（口径 64）。
 *
 * 与 Host 的 `bundle/src/skill-published-route.ts` 注册的那条 **exact** 路径逐字同值；
 * 它只在这里与下面那条导出的注册面常量各出现一次（`${…}` 拼接），故全 `src` 里那枚带引号的
 * 路径字面量**恰好一处**（门禁反向锁盯着这一点：两条安装路不许各写一次）。
 * ★正文是关闭键集**恰好** `{targetId}`（安全整数）；响应与 `GET /skills/self-installed` 逐字同形。
 */
const SKILL_PUBLISHED_INSTALL_PATH = '/skills/published/install'

/**
 * ★**本刀（S5a）**：自装技能两个本机动作的**相对**路径（与 Host 的 exact 注册面逐字同值）。
 *
 * 两条都是 `POST`、都注册在既有只读 `GET /skills/self-installed` 之下（Host 侧两条 **exact** sibling：
 * 引擎 exact 表优先 ⇒ 不会被 `skill-route.ts` 那条 `/skills` prefix 当成包 id 判 400）：
 *   · `uninstall` —— **破坏性**：删掉本机这份技能目录（其余归属一个字节都不动）；
 *   · `reveal` —— 非破坏性：用系统文件管理器打开这条技能所在文件夹（宿主绝对路径不回浏览器）。
 * ★各自的**带引号字面量**只在这里与下面那条导出的注册面常量各出现一次（`${…}` 拼接）——
 *   门禁反向锁盯着"两条动作不许各写第二遍路径"。
 */
const SKILL_SELF_INSTALLED_UNINSTALL_PATH = '/skills/self-installed/uninstall'
const SKILL_SELF_INSTALLED_REVEAL_PATH = '/skills/self-installed/reveal'

/**
 * ★**本刀（S5a）**：这两条动作正文里那**唯一**一枚键的名字（冻结契约逐字：`name`）。
 *
 * ★**为什么单列成常量**：契约的两侧（宿主路由的键集门禁与这里）**必须同名**——改一处漏一处就是
 *   「每一次调用都 400」「一次都不进端口」这种最难查的形状。单列之后，若契约改口径只动这一行。
 * ★`name` 的值是技能在**本机的目录名**（kebab），不是 `skillId`/`packageId`/`targetId`：
 *   宿主按「`name` ∈ 某条自装记录的 `names`」判归属 ⇒ "客户端替宿主挑一条记录"在形状上不可表达。
 */
export const ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY = 'name'

function errorCode(value: unknown): string {
  const code = decodeEnterpriseErrorCode(value)
  return code ?? 'ENT_PLATFORM_UNAVAILABLE'
}

async function requestJson(
  path: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(`${LOCAL_API_PREFIX}${path}`, init)
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  }
  if (!response.ok) throw new EnterpriseLocalApiError(errorCode(payload), response.status)
  const envelope = decodeEnterpriseDataEnvelope(payload)
  if (envelope === undefined) throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  return envelope
}

function getInit(signal: AbortSignal): RequestInit {
  return { cache: 'no-store', headers: { accept: 'application/json' }, signal }
}

function postInit(signal: AbortSignal): RequestInit {
  return {
    body: '{}',
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    method: 'POST',
    signal,
  }
}

/**
 * 无正文回执的同源 POST：只认「2xx 即成」，错误码仍走 `decodeEnterpriseErrorCode` 的受控投影。
 *
 * 「帮助与文档」用它请 Host 打开系统浏览器——地址由 Host 派生，浏览器既不给 URL 也不读正文，
 * 因此不引入任何新 DTO，也不把响应体回显到界面。
 */
async function postNoContent(
  path: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<void> {
  const response = await fetcher(`${LOCAL_API_PREFIX}${path}`, postInit(signal))
  if (response.ok) return
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID', response.status)
  }
  throw new EnterpriseLocalApiError(errorCode(payload), response.status)
}

function jsonInit(method: 'POST', body: unknown, signal: AbortSignal): RequestInit {
  return {
    body: JSON.stringify(body),
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    method,
    signal,
  }
}

/**
 * 反馈草稿 → multipart 正文。
 *
 * 三处刻意的省略：不写 `diagnostics`（Host 采集）、`occurredAt` 只在问题态出现（建议态提交它会与
 * 产品口径矛盾）、空联系人不产生空 part。`content-type` 交给浏览器，boundary 由它生成。
 */
function feedbackForm(draft: EnterpriseFeedbackDraft): FormData {
  const form = new FormData()
  const occurredAt = draft.type === 'issue' ? draft.occurredAt : undefined
  const contact = draft.contact === undefined || draft.contact === '' ? undefined : draft.contact
  form.append('metadata', new Blob([JSON.stringify({
    consent: draft.consent,
    description: draft.description,
    type: draft.type,
    ...(occurredAt === undefined || occurredAt === '' ? {} : { occurredAt }),
    ...(contact === undefined ? {} : { contact }),
  })], { type: 'application/json' }))
  for (const attachment of draft.attachments) form.append('attachments', attachment, attachment.name)
  return form
}

/**
 * 本地技能包 → multipart 正文（**与 `feedbackForm` 同一手法**）。
 *
 * 恰好一个 file part，字段名与冻结契约逐字相同（`artifact`）；`content-type` 交给浏览器、
 * boundary 由它生成。文件名原样带上——Host 只把它当**展示事实**（界面上那句「你选的是哪个文件」），
 * 绝不据此拼任何路径；字节内容才是唯一被落盘的东西。
 */
function skillUploadForm(file: File): FormData {
  const form = new FormData()
  form.append(ENTERPRISE_SKILL_UPLOAD_FIELD, file, file.name)
  return form
}

/** 创建只访问同源固定路径的浏览器 API；调用方无法注入平台 origin 或 Authorization。 */
export function createEnterpriseLocalApi(
  fetcher: typeof fetch = fetch,

): EnterpriseLocalApi {
  return {
    status: async signal => decodeEnterpriseLocalStatus(await requestJson('/status', getInit(signal), fetcher)),
    /**
     * NUWAX 三条（本刀：登录入口换成 NUWAX）——与上面那条 `status` 同一层，都是同源固定路径。
     *
     * 口令只进这一次 POST 的正文：不写 URL、不进 header、不回显、不落盘；`login` 与 `status`
     * 的响应**同形**，因此共用同一个严格解码器（宿主多回一个键即整条判畸形）。
     */
    nuwaxStatus: async signal => decodeEnterpriseNuwaxStatus(
      await requestJson(NUWAX_STATUS_PATH, getInit(signal), fetcher),
    ),
    nuwaxLogin: async (account: string, password: string, signal: AbortSignal) => decodeEnterpriseNuwaxStatus(
      await requestJson(NUWAX_LOGIN_PATH, jsonInit('POST', { account, password }, signal), fetcher),
    ),
    nuwaxLogout: async signal => postNoContent(NUWAX_LOGOUT_PATH, signal, fetcher),
    branding: async signal => decodeEnterpriseBranding(await requestJson('/branding', getInit(signal), fetcher)),
    refresh: async signal => decodeEnterpriseLocalStatus(await requestJson('/refresh', jsonInit('POST', {}, signal), fetcher)),
    setServerUrl: async (serverUrl, signal) => decodeEnterpriseServerUrl(
      await requestJson('/server', jsonInit('POST', { serverUrl }, signal), fetcher),
    ),
    accountOrigin: async signal => decodeEnterpriseAccountOrigin(
      await requestJson('/account-origin', getInit(signal), fetcher),
    ),
    setAccountOrigin: async (origin, signal) => decodeEnterpriseAccountOriginUpdate(
      await requestJson('/account-origin', jsonInit('POST', {
        ...(origin.platformOrigin === undefined ? {} : { platformOrigin: origin.platformOrigin }),
        ...(origin.inferenceOrigin === undefined ? {} : { inferenceOrigin: origin.inferenceOrigin }),
      }, signal), fetcher),
    ),
    bootstrap: async signal => decodeBootstrap(await requestJson('/bootstrap', getInit(signal), fetcher)),
    usage: async signal => decodeEnterpriseUsage(await requestJson('/usage', getInit(signal), fetcher)),
    openHelp: async signal => postNoContent('/help/open', signal, fetcher),
    submitFeedback: async (draft, signal, idempotencyKey) => decodeEnterpriseFeedbackReceipt(
      await requestJson('/feedback', {
        body: feedbackForm(draft),
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
        },
        method: 'POST',
        signal,
      }, fetcher),
    ),
    plugins: async signal => decodeEnterprisePluginStatus(await requestJson('/plugins', getInit(signal), fetcher)),
    presets: async signal => decodeEnterprisePresets(await requestJson('/presets', getInit(signal), fetcher)),
    presetDetail: async (packageId, signal) => {
      const items = decodeEnterprisePresets([await requestJson(`/presets/${packageId}`, getInit(signal), fetcher)])
      return items[0]!
    },
    // 配方**一键启用**三条（与 Host 的 `/presets` prefix 按后缀分派逐字对应）：
    //  · status 走 GET、只读；
    //  · enable 走 POST，正文是**关闭键集**——没有确认指纹时就是 `{}`（绝不替用户顺手授权），
    //    有确认指纹时恰好一个键 `confirmFingerprint`（Host 侧多一个键、少一个键、键名前缀相同一律 400）；
    //  · disable 走 POST，正文恒为 `{}`，路径里是**声明 id**（kebab）而不是雪花包 id。
    presetStatus: async (packageId, signal) => decodeEnterprisePresetStatus(
      await requestJson(enterprisePresetStatusPath(packageId), getInit(signal), fetcher),
    ),
    enablePreset: async (packageId, confirmFingerprint, signal) => decodeEnterprisePresetEnable(
      await requestJson(
        enterprisePresetEnablePath(packageId),
        jsonInit('POST', confirmFingerprint === undefined ? {} : { confirmFingerprint }, signal),
        fetcher,
      ),
    ),
    disablePreset: async (declarationId, signal) => decodeEnterprisePresetDisable(
      await requestJson(enterprisePresetDisablePath(declarationId), jsonInit('POST', {}, signal), fetcher),
    ),
    skills: async signal => decodeEnterpriseSkills(await requestJson('/skills', getInit(signal), fetcher)),
    skillDetail: async (packageId, signal) => decodeEnterpriseSkillDetail(
      await requestJson(`/skills/${packageId}`, getInit(signal), fetcher),
    ),
    installPlugin: async (packageName, pluginVersionId, signal) => decodeEnterprisePluginStatus(
      await requestJson('/plugins/install', jsonInit('POST', { packageName, pluginVersionId }, signal), fetcher),
    ),
    removePlugin: async (packageName, signal) => decodeEnterprisePluginStatus(
      await requestJson('/plugins/remove', jsonInit('POST', { packageName }, signal), fetcher),
    ),
    // 启用 / 停用：与 install/remove 同族同源，正文是关闭键集 `{packageName}`；
    // 响应与只读 `GET /plugins` **完全同形**（Host 侧零新增字段），故解码器一字不改。
    // **关掉是停用，不是卸载**：卸载是 `removePlugin`（只在详情页可达）。
    setPluginEnabled: async (packageName, enabled, signal) => decodeEnterprisePluginStatus(
      await requestJson(
        enabled ? PLUGIN_ENABLE_PATH : PLUGIN_DISABLE_PATH,
        jsonInit('POST', { packageName }, signal),
        fetcher,
      ),
    ),
    // 取消**在途**安装：与 install/remove 同族同源，正文是关闭键集 `{packageName}`；
    // 响应与只读 `GET /plugins` **完全同形**（Host 侧零新增字段），故解码器一字不改。
    // 相对路径只在这里与导出的注册面常量各出现一次（`${PLUGIN_CANCEL_PATH}` 拼接）。
    cancelPlugin: async (packageName, signal) => decodeEnterprisePluginStatus(
      await requestJson(PLUGIN_CANCEL_PATH, jsonInit('POST', { packageName }, signal), fetcher),
    ),
    // 资料库六条：全部走**同一条**单入口 `POST /library`（正文 `{endpoint,payload}`），
    // 与 Host 侧 `bundle/src/library/route.ts` 的内层协议逐字同形；浏览器侧同样只发固定路径。
    librarySpace: async signal => decodeEnterpriseLibrarySpace(
      await requestJson(LIBRARY_ENTRY_PATH, libraryInit('space', {}, signal), fetcher),
    ),
    libraryImport: async (input, signal) => decodeEnterpriseLibraryImport(
      await requestJson(LIBRARY_ENTRY_PATH, libraryInit('import', {
        name: input.name,
        content: input.content,
        // 关闭键集：没有父节点就**不发这个键**（不塞 null 让 Host 去猜语义）。
        ...(input.parentId === undefined || input.parentId === null ? {} : { parentId: input.parentId }),
      }, signal), fetcher),
    ),
    librarySearch: async (query, signal) => decodeEnterpriseLibraryHits(
      await requestJson(LIBRARY_ENTRY_PATH, libraryInit('search', { query }, signal), fetcher),
    ),
    libraryReadText: async (assetId, signal) => decodeEnterpriseLibraryText(
      await requestJson(LIBRARY_ENTRY_PATH, libraryInit('read-text', { assetId }, signal), fetcher),
    ),
    // 会话选中集合两条（P1-A）：读回物化条目、写回**完整**集合（`nodeIds` 不是增量）。
    // 写那一条的响应形状与读**不同**（Host 只回 `{nodeIds}`），故两条各用各的严格解码器，
    // 界面绝不用写回执去拼条目——条目一律以随后那次读为准。
    libraryTaskSelection: async (sessionId, signal) => decodeEnterpriseLibraryTaskSelection(
      await requestJson(LIBRARY_ENTRY_PATH, libraryInit('task-selection', { sessionId }, signal), fetcher),
    ),
    librarySetTaskSelection: async (sessionId, nodeIds, signal) => decodeEnterpriseLibrarySetTaskSelection(
      await requestJson(LIBRARY_ENTRY_PATH, libraryInit('set-task-selection', { sessionId, nodeIds: [...nodeIds] }, signal), fetcher),
    ),
    installedSkills: async signal => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/installed', getInit(signal), fetcher),
    ),
    skillContent: async (packageId, name, signal) => decodeEnterpriseInstalledSkillContent(
      await requestJson(
        `/skills/content?packageId=${encodeURIComponent(packageId)}&name=${encodeURIComponent(name)}`,
        getInit(signal),
        fetcher,
      ),
    ),
    // 本机技能文件家族两条（与 `/skills/content` 同族、同源、同一条 Host 路径解析）：
    // ① 文件树按**包 id** 取（路径段由 Host 自己拼，与我们无关）；
    // ② 读文件按**包 id + 相对路径**取，路径只能来自①回传的条目——界面从不接受用户输入的路径。
    skillFiles: async (packageId, signal) => decodeEnterpriseInstalledSkillFiles(
      await requestJson(enterpriseSkillFilesPath(packageId), getInit(signal), fetcher),
    ),
    skillFile: async (packageId, path, signal) => decodeEnterpriseInstalledSkillFile(
      await requestJson(enterpriseSkillFilePath(packageId, path), getInit(signal), fetcher),
    ),
    installSkill: async (packageId, signal) => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/install', jsonInit('POST', { packageId }, signal), fetcher),
    ),
    // 系统广场「已发布技能」安装（口径 64）：与上面那一格**并列**、不共用任何一个字面量。
    //  · 坐标是**安全整数** `targetId`（不是路径、不是字符串 id、不是 packageId）；
    //  · 响应与 `GET /skills/self-installed` **逐字同形**（宿主收尾那行就是 `installedSelfSkills(…)`）
    //    ⇒ **复用** `decodeEnterpriseSelfInstalledSkills`：拿企业已装那份七键闭合的解码器来解它，
    //    会把每一次成功都判成畸形（响应里没有 `packageId`/`versionId`，见 local-api-decode 那一格）。
    //  · 合规判据的权威在宿主（`allowCopy !== 1` / `paymentRequired` ⇒ `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`），
    //    本层只负责把这一枚数字原样交上去。
    installPublishedSkill: async (targetId, signal) => decodeEnterpriseSelfInstalledSkills(
      await requestJson(SKILL_PUBLISHED_INSTALL_PATH, jsonInit('POST', { targetId }, signal), fetcher),
    ),
    uninstallSkill: async (packageId, signal) => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/uninstall', jsonInit('POST', { packageId }, signal), fetcher),
    ),
    // 本地导入两条（本刀）：上传是 multipart（正文构造见 `skillUploadForm`，与反馈附件同一手法），
    // 自装清单是 GET。上传成功的响应与 install **完全同形** ⇒ 同一个解码器，一句都不改写。
    uploadSkill: async (file, signal) => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/upload', {
        body: skillUploadForm(file),
        cache: 'no-store',
        headers: { accept: 'application/json' },
        method: 'POST',
        signal,
      }, fetcher),
    ),
    selfInstalledSkills: async signal => decodeEnterpriseSelfInstalledSkills(
      await requestJson('/skills/self-installed', getInit(signal), fetcher),
    ),
    // ★**本刀（S5a）**：自装技能的两个本机动作（与 Host 侧两条 exact sibling 逐字对应）。
    //  · 两条正文都是**关闭键集恰好**那一枚键（`ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY` = `name`），
    //    `name` 是技能在本机的**目录名**（kebab）——界面从不传路径、也从不替宿主挑记录；
    //  · 卸载回执是 `{skills,removed}`（`skills` 与 `GET /skills/self-installed` 逐字同形
    //    ⇒ **复用**同一枚严格解码器），打开文件夹回执是单键 `{revealed:true}`；
    //  · 归属判据（只有自装技能能卸）的**权威在宿主**：被中心记录认领 ⇒ 404、两条自装记录认领 ⇒ 409，
    //    界面不写第二套判据，只按稳定码出人话。
    uninstallSelfInstalledSkill: async (name, signal) => decodeEnterpriseSelfInstalledUninstall(
      await requestJson(
        SKILL_SELF_INSTALLED_UNINSTALL_PATH,
        jsonInit('POST', { [ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY]: name }, signal),
        fetcher,
      ),
    ),
    revealSelfInstalledSkill: async (name, signal) => decodeEnterpriseSelfInstalledReveal(
      await requestJson(
        SKILL_SELF_INSTALLED_REVEAL_PATH,
        jsonInit('POST', { [ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY]: name }, signal),
        fetcher,
      ),
    ),
    // 官方发现面（口径 54，本刀）：「已安装」的**真源**。只读 GET、单键信封、**恰好两格**
    // （`skills` + `complete`）；宿主侧已把 `path`/`resourceBase` 挡在白名单之外，本层再挡一道
    // （多一格即 `ENT_LOCAL_RESPONSE_INVALID`）。空列表是合法结果，读不到由非 2xx + 稳定码表达。
    discoveredSkills: async signal => decodeEnterpriseDiscoveredSkills(
      await requestJson('/skills/discovered', getInit(signal), fetcher),
    ),
    // 系统搜索两条（本刀）：盘点是 GET（只读，不改任何状态）；纳入是 POST，正文**关闭键集恰好 `{path}`**，
    // `path` 就是盘点投影里那条候选的 canonical 绝对路径 —— 界面把它当**不透明值原样回传**，
    // 从不拼、从不改、从不接受用户输入（Host 侧会再 realpath 一遍并在本次候选里逐字比对）。
    // 纳入成功的响应与 `GET /skills/self-installed` **逐字同形** ⇒ 复用同一个解码器，一句都不改写。
    systemSearch: async signal => decodeEnterpriseSystemSkills(
      await requestJson('/skills/system-search', getInit(signal), fetcher),
    ),
    adoptSystemSkill: async (path, signal) => decodeEnterpriseSelfInstalledSkills(
      await requestJson('/skills/adopt', jsonInit('POST', { path }, signal), fetcher),
    ),
    // 在线搜索两条（本刀）：搜索是 GET（只读，查询串进 `q` 并按标识符编码）；安装是 POST，
    // 正文**关闭键集恰好 `{source}`**，`source` 就是搜索结果里原样回来的 `installSource`
    // —— 界面把它当**不透明值原样回传**，从不拼、从不解析、从不接受用户输入（Host 侧再判源与坐标）。
    // 安装成功的响应与 `GET /skills/installed` **逐字同形** ⇒ 复用同一个严格解码器，一句都不改写。
    onlineSearchSkills: async (query, signal) => decodeEnterpriseOnlineSkillSearch(
      await requestJson(`/skills/online-search?q=${encodeURIComponent(query)}`, getInit(signal), fetcher),
    ),
    installSkillFromResult: async (source, signal) => decodeEnterpriseInstalledSkills(
      await requestJson('/skills/install-from-result', jsonInit('POST', { source }, signal), fetcher),
    ),
    // 本地三方 Agent 技能源两条（口径 62）：扫描是只读 GET（宿主绝对路径**不进**响应，
    // 每条候选只带一枚不透明 `id`）；安装是 POST，正文**关闭键集恰好 `{path}`**，`path` 就是
    // 扫描投影里那枚 `id` —— 界面把它当**不透明值原样回传**，从不拼、从不改、从不接受用户输入
    // （Host 侧再 realpath 一遍并在本次候选里逐字比对，不在即 400 `ENT_SKILL_DISCOVERY_UNKNOWN`）。
    // 安装成功的响应与 `GET /skills/self-installed` **逐字同形** ⇒ 复用同一个严格解码器，
    // 一句都不改写；界面**不**用它的返回值改状态（它只念一句结果），真值一律靠重新扫描。
    thirdPartySkills: async signal => decodeEnterpriseThirdPartySkills(
      await requestJson('/skills/third-party', getInit(signal), fetcher),
    ),
    installThirdPartySkill: async (path, signal) => decodeEnterpriseSelfInstalledSkills(
      await requestJson('/skills/third-party/install', jsonInit('POST', { path }, signal), fetcher),
    ),
    startLogin: async signal => decodeEnterpriseLoginStart(
      await requestJson('/auth/start', postInit(signal), fetcher),
    ),
    cancelLogin: async signal => decodeEnterpriseLoginCancel(
      await requestJson('/auth/cancel', postInit(signal), fetcher),
    ),
    loginForm: async signal => decodeEnterpriseLoginForm(
      await requestJson('/auth/form', getInit(signal), fetcher),
    ),
    submitCredentials: async (input, signal) => decodeEnterpriseCredentialResult(
      await requestJson('/auth/password', jsonInit('POST', input, signal), fetcher),
    ),
    submitPasswordChange: async (input, signal) => decodeEnterpriseCredentialResult(
      await requestJson('/auth/password-change', jsonInit('POST', input, signal), fetcher),
    ),
    logout: async signal => decodeEnterpriseLogout(
      await requestJson('/logout', postInit(signal), fetcher),
    ),
    uninstall: async signal => decodeEnterpriseUninstall(
      await requestJson('/uninstall', postInit(signal), fetcher),
    ),
    sessionSyncStatus: async signal => decodeSessionSyncStatus(
      await requestJson('/sessions/sync', getInit(signal), fetcher),
    ),
    listSessions: async signal => decodeRemoteSessions(
      await requestJson('/sessions', getInit(signal), fetcher),
    ),
    restoreSession: async (sourceSessionId, cwd, signal) => decodeEnterpriseRestoredSession(
      await requestJson(
        `/sessions/${encodeURIComponent(sourceSessionId)}/copies`,
        jsonInit('POST', { cwd }, signal),
        fetcher,
      ),
    ),
  }
}

/**
 * 受管插件**取消**动作的 exact 同源路径：`POST /enterprise/api/v1/local/plugins/cancel`。
 *
 * 与 `platform-client` 的 `ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH` **逐字相同**（Host 侧 exact 路由注册面）；
 * 正文是关闭键集恰好 `{packageName}`，响应与只读 `GET /plugins` 完全同形（Host 侧零新增字段）。
 * 与 `install`/`remove` 两条内联路径不同，这一条单独导出是给测试与文档核对的——
 * 「取消真的打到了那一条路由」这件事必须是可逐字断言的。
 */
export const ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH = `${LOCAL_API_PREFIX}${PLUGIN_CANCEL_PATH}`

/**
 * 受管插件**启用**动作的 exact 同源路径：`POST /enterprise/api/v1/local/plugins/enable`。
 *
 * 与 `platform-client` 的 `ENTERPRISE_PLUGIN_ENABLE_LOCAL_PATH` **逐字相同**；正文是关闭键集恰好
 * `{packageName}`，响应与只读 `GET /plugins` 完全同形（Host 侧零新增字段，只有 `enabled` 那一枚启停位）。
 */
export const ENTERPRISE_PLUGIN_ENABLE_LOCAL_PATH = `${LOCAL_API_PREFIX}${PLUGIN_ENABLE_PATH}`

/**
 * 受管插件**停用**动作的 exact 同源路径：`POST /enterprise/api/v1/local/plugins/disable`。
 *
 * ★ 停用**不是**卸载：这条路只把 bundle 层从这个 profile 上摘下来（官方 `setBundleEnabled(name,false)`），
 * 依赖与本机记录都留着。卸载走 `/plugins/remove`，且只在详情页可达。
 */
export const ENTERPRISE_PLUGIN_DISABLE_LOCAL_PATH = `${LOCAL_API_PREFIX}${PLUGIN_DISABLE_PATH}`

/** 保持在同源路径上的反馈提交路径常量；测试与文档用它核对 Host 的注册路径。 */
/** NUWAX 三条注册面路径（与 Host 的 exact 路径逐字同值；界面这一侧也从拼不出第二条）。 */
export const ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH = `${LOCAL_API_PREFIX}${NUWAX_LOGIN_PATH}`
export const ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH = `${LOCAL_API_PREFIX}${NUWAX_LOGOUT_PATH}`
export const ENTERPRISE_NUWAX_STATUS_LOCAL_PATH = `${LOCAL_API_PREFIX}${NUWAX_STATUS_PATH}`
export const ENTERPRISE_FEEDBACK_LOCAL_PATH = `${LOCAL_API_PREFIX}/feedback`

/** 「帮助与文档」的同源路径常量：Host 侧同源路由的注册路径必须与它逐字相同。 */
export const ENTERPRISE_HELP_OPEN_LOCAL_PATH = `${LOCAL_API_PREFIX}/help/open`

/**
 * 企业技能一键安装的三条同源路径常量；Host 侧（platform-client 的 exact 路由）注册路径必须与它们逐字相同。
 *
 * 三条都是 `/skills` prefix 的**子路径**，靠引擎 exact 表优先命中；界面只发这三条，不发任何宿主路径。
 */export const ENTERPRISE_SKILL_INSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/install`
export const ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/uninstall`
export const ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/installed`

/**
 * **本地导入**两条同源路径常量；Host 侧注册路径必须与它们逐字相同。
 *
 * `upload` 是 multipart 上传安装（与 `install` 同一个落盘内核、同一个响应形状，只是制品来自浏览器
 * 而不是中心）；`self-installed` 是只读的一份**独立**清单——自装包没有中心雪花包 id，故它不会出现在
 * `installed` 那份企业已装清单里，界面要说出「这次装了什么」只能读它。
 */
export const ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/upload`
export const ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/self-installed`

/**
 * ★**本刀（S5a）**：自装技能**两个本机动作**的 exact 同源路径常量；Host 侧注册路径必须与它们逐字相同。
 *
 * 与 `platform-client`/bundle 的 `skill-self-installed-route.ts` 两条 exact 注册面逐字同值：
 * `POST /enterprise/api/v1/local/skills/self-installed/{uninstall,reveal}`。它们都是那条只读
 * `GET …/skills/self-installed` 的 **exact sibling**，故 Host 侧必须注册成 exact（否则 `self-installed`
 * 会被 `/skills` 那条 prefix 当包 id 判 400 —— 与 `third-party`/`published` 同一个坑、同一条解法）。
 * 两枚常量单独导出的理由与 `ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH` 相同：「这次动作真的打到了那一条路由」
 * 必须是可逐字断言的；而正文**关闭键集恰好** `{name}`（见 `ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY`）。
 */
export const ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}${SKILL_SELF_INSTALLED_UNINSTALL_PATH}`
export const ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH = `${LOCAL_API_PREFIX}${SKILL_SELF_INSTALLED_REVEAL_PATH}`

/**
 * **官方发现面**的同源路径常量（口径 54）；Host 侧注册路径必须与它逐字相同。
 *
 * ★它是「已安装」的**真源**：答的是"本机 DSH 真的装着什么"（宿主官方服务 `ctx.get('skills')` 的快照），
 *   而不是我们那两份记录里写了什么。与上面那族同属 `/skills` 前缀之下，故 Host 侧必须注册成
 *   **exact**（否则 `discovered` 会被 `/skills` 那条详情 prefix 当成包 id 判 400 —— 与
 *   `system-search`/`online-search` 同一个坑，坐标见 `bundle/src/skill-route.ts` 头注）。
 * ★响应**只**有 `{skills, complete}` 两格，`path`/`resourceBase` 在 Host 侧就不出厂。
 */
export const ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/discovered`

/**
 * **系统搜索**两条同源路径常量（本刀）；Host 侧注册路径必须与它们逐字相同。
 *
 * `system-search` 是只读盘点（本机技能根 + 每条候选的三态：已认领 / 命名冲突 / 可纳入）；
 * `adopt` 是**纳入**动作（`POST`，正文关闭键集恰好 `{path}`）——它把一条**本机已有**的技能目录
 * 登记进自装清单，**不复制、不移动、不删除**。两条都是 exact 路由（否则 `system-search`/`adopt`
 * 会掉进 Host 侧 `/skills` 详情 prefix 被当包 id 判 400），故常量必须两边逐字同值。
 */
export const ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/system-search`
export const ENTERPRISE_SKILL_ADOPT_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/adopt`

/**
 * **在线搜索**两条同源路径常量（本刀）；Host 侧注册路径必须与它们逐字相同。
 *
 * `online-search` 是只读搜索（三源 fan-out 的归一化结果：逐源状态 + 结果清单），查询串进 `q`；
 * `install-from-result` 是**安装**动作（`POST`，正文关闭键集恰好 `{source}`），坐标就是搜索结果里
 * 原样回来的那条 `installSource`。两条都是 exact 路由（否则 `online-search`/`install-from-result`
 * 会掉进 Host 侧 `/skills` 详情 prefix 被当包 id 判 400），故常量必须两边逐字同值。
 */
export const ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/online-search`
export const ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/install-from-result`

/**
 * **本地三方 Agent 技能源**两条同源路径常量（口径 62）；Host 侧注册路径必须与它们逐字相同。
 *
 * ★契约逐字取自冻结文件 `analysis/esc-third-party-skills-spec.md` §3.2（那是两侧唯一的真源）：
 *   `GET  /enterprise/api/v1/local/skills/third-party`（只读扫描）、
 *   `POST /enterprise/api/v1/local/skills/third-party/install`（复制安装，正文关闭键集恰好 `{path}`）。
 * ★它们与既有通路二（`/skills/system-search`、`/skills/adopt`）**是两条不同的路**，故另立两条常量、
 *   不共用任何一个字面：那条是"只登记本机已有目录"，这条是"把别的 CLI 的目录**复制**进来"
 *   —— 混用会让"装没装、装的是哪一份"两件事在同一个字段上打架。
 */
export const ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/third-party`
export const ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/third-party/install`

/**
 * **系统广场「已发布技能」安装**那条 exact 同源路径常量（口径 64）；Host 侧注册路径必须与它逐字相同。
 *
 * 与 `platform-client`/bundle 的 `ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH` 逐字同值：
 * `POST /enterprise/api/v1/local/skills/published/install`。它是 `/skills` 那条 prefix 的**子路径**，
 * 故 Host 侧必须注册成 **exact**（否则 `published` 会被当成包 id 判 400 —— 与 `third-party` 同一个坑）。
 * 单独导出的理由与 `ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH` 相同：「安装真的打到了那一条路由」这件事
 * 必须是可逐字断言的；而正文**关闭键集恰好** `{targetId}`（安全整数）。
 */
export const ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}${SKILL_PUBLISHED_INSTALL_PATH}`

/**
 * 上传那条 multipart 里 file part 的**字段名**（冻结契约逐字：`artifact`）。
 *
 * 与路径常量一样是**契约面**而不是实现细节：Host 侧按这个字段名取文件，改名即两边同时破。
 */
export const ENTERPRISE_SKILL_UPLOAD_FIELD = 'artifact'

/**
 * 已装技能**正文**的只读路径常量；Host 侧（platform-client 的 exact 路由）注册路径必须与它逐字相同。
 *
 * 两个查询参数都是**标识符而不是路径**：包 id 是中心雪花、技能名是官方 kebab 目录名；
 * 界面只会把 Host 自己回传的已装记录里的名字填进来，绝不接受用户输入的路径。
 */
export const ENTERPRISE_SKILL_CONTENT_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/content`

/**
 * 本机技能**文件树**的路径构造器：`/skills/<包 id>/files`（**相对本地 API 前缀**，与其余调用点同形）。
 *
 * 它交给 `requestJson`，由后者拼上固定的 `LOCAL_API_PREFIX` —— 拼完就是 Host 注册面
 * （`bundle/src/skill-route.ts` 的 `/skills` prefix handler 按剩余段分派）上那条 `<id>/files` 子路径。
 * 路径里唯一的变量是包 id（中心雪花，经 `encodeURIComponent` 后拼接）；任何非雪花输入都只会变成
 * 路径段里的字面量，而 Host 侧还有一道雪花正则与已装记录归属判定，绝不带着任意字符串拼文件系统路径。
 *
 * @param packageId - 中心技能包雪花 id（来自已装记录）。
 * @returns 相对本地 API 前缀的路径（与 Host 注册面的子路径逐字对应）。
 */
export function enterpriseSkillFilesPath(packageId: string): string {
  return `/skills/${encodeURIComponent(packageId)}/files`
}

/**
 * 本机技能**单个文件**的路径构造器：`/skills/<包 id>/file?path=<相对路径>`（**相对本地 API 前缀**）。
 *
 * 两个变量都是**标识符而不是路径片段**：包 id 走路径段、相对路径走查询串，两者各自
 * `encodeURIComponent`（`../` 之类只会变成查询串里的字面量，永远不成为路径片段）。
 * 界面只会把文件树回传过的路径填进来——它从不自己拼路径、也不接受用户输入的路径。
 *
 * @param packageId - 中心技能包雪花 id（来自已装记录）。
 * @param path - 来自文件树条目的相对路径（`/` 分隔，首段是技能目录名）。
 * @returns 相对本地 API 前缀的路径（与 Host 注册面的子路径逐字对应）。
 */
export function enterpriseSkillFilePath(packageId: string, path: string): string {
  return `/skills/${encodeURIComponent(packageId)}/file?path=${encodeURIComponent(path)}`
}

/**
 * 配方**一键启用**三条子路径的构造器（**相对本地 API 前缀**，交给 `requestJson` 拼前缀）。
 *
 * 形状与 `platform-client` 那条 `/presets` prefix handler 的分派条件逐字相反推：
 * 注册面**零新增字符串**，三条子路径由既有 `/presets` prefix 按后缀 `/{enable,disable,status}` 分派。
 *
 * 三个变量各自 `encodeURIComponent`：`enable`/`status` 收 **中心雪花包 id**，
 * `disable` 收 Host 归一化后的**声明 id**（kebab）——两者都不接受用户输入，
 * 前者来自配方目录投影、后者来自 status / enable 的回执，界面从不自己拼标识。
 *
 * @param packageId - 中心配方包雪花 id（来自配方目录行）。
 * @returns 相对本地 API 前缀的 path（与 Host 注册面的子路径逐字对应）。
 */
export function enterprisePresetEnablePath(packageId: string): string {
  return `/presets/${encodeURIComponent(packageId)}/enable`
}

/** @param declarationId - Host 回执里的声明 id（kebab）；不是雪花包 id。 */
export function enterprisePresetDisablePath(declarationId: string): string {
  return `/presets/${encodeURIComponent(declarationId)}/disable`
}

/** @param packageId - 中心配方包雪花 id。 */
export function enterprisePresetStatusPath(packageId: string): string {
  return `/presets/${encodeURIComponent(packageId)}/status`
}

/**
 * 配方一键启用三条子路径**共用的**注册面前缀。
 *
 * 三条动作都挂在**同一个** `/presets` prefix 上（Host 侧按后缀 `/{enable,disable,status}` 分派，
 * 注册面零新增字符串 —— 重复 `register()` 同 path 会让 Host 启动即崩，理由见 platform-client 的注释）。
 * 具体子路径请用上面三个构造器，别自己拼字符串。
 */
export const ENTERPRISE_PRESET_ACTION_LOCAL_PATH = `${LOCAL_API_PREFIX}/presets`
