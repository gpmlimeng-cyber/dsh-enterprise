/**
 * [INPUT]: 依赖 Harness `ctx.webServer.register()` route port、平台操作端口、组合层注入的插件动作端口（含**取消**）与技能安装端口、品牌只读端口与可选投影留痕端口
 * [OUTPUT]: 提供账号/配置按需刷新、插件操作（`/plugins/{install,remove,cancel}`，**取消**打官方 `pluginManager.cancelInstall` 且响应与只读 GET 同形、零新增字段）、**企业技能安装/卸载/已装态/已装正文**、**企业配方一键启用的三条子路径（`/presets/<id>/{enable,disable,status}`，由既有 `/presets` prefix 按后缀分派、注册面零新增字符串）**、本地品牌投影与原生登录（来源列表 / 凭证代提交 / 改密代提交）的严格同源 JSON 路由，无常驻状态连接；凭证正文只按固定键集读入并原样转发，绝不进日志；每个把异常投影成 HTTP 状态的回调都经 `onError` 上报操作名与原始 error；三条详情 prefix（品牌位图 / 会话恢复 / 配方详情）的注册 path 一律**不带尾斜杠**，技能四条路由是 `/skills` prefix 的 exact 子路径（`ENTERPRISE_SKILL_*_LOCAL_PATH`，含只读的 `/skills/content`）；并对外导出稳定码→HTTP 状态的**唯一**映射 `enterpriseLocalErrorStatus`——bundle 侧两条本机技能文件子路由（`/skills/<id>/files`、`/skills/<id>/file`）与这里的 `/skills/content`、以及配方一键启用三条子路径必须共用同一张表
 * **本刀（资料库）**：`enterpriseLocalErrorStatus` 新增四枚资料库码——`ENT_LIBRARY_CONFLICT` / `ENT_LIBRARY_DISABLED`→409、
 *   `ENT_LIBRARY_TOO_LARGE`→413、`ENT_LIBRARY_INTERNAL`→500（本表唯一一枚 500；表尾默认仍是 503「本机暂时不可用、可重试」，
 *   两者不同义），供 bundle 的 `library/route.ts` 把领域码 `library/*` 投影成 HTTP 时走同一张表。
 * **本刀（本地上传）**：新注册两条 exact 子路径——`POST /skills/upload`（multipart，**恰好一个 `artifact` part**；
 *   50 MiB **独立**配额 `MAX_SKILL_UPLOAD_BODY_BYTES`，绝不动 `MAX_LOCAL_BODY_BYTES` 那 256 KiB 的 JSON 上限；
 *   运输层四件事=方法/content-length 预检/content-type 形状/有界读取，**分帧解析与表单语义在 bundle 侧**，
 *   复用全仓唯一那份 `parseFeedbackMultipart`）与 `GET /skills/self-installed`（本机自装清单，与 `/skills/installed`
 *   并列但读的是**另一份**状态文件）；两者都必须靠 exact 表抢在 bundle `/skills` 详情 prefix 之前（坐标见上方注释）；
 *   并把上传族五枚码（含**既有** `ENT_SKILL_ARCHIVE_INVALID`）钉进 `enterpriseLocalErrorStatus`。
 * * **本刀（草稿/发布/修订）**：再新增两枚草稿族乐观锁冲突码——`ENT_LIBRARY_REVISION_CONFLICT`（草稿被改过 ⇒
 *   刷新后重试）与 `ENT_LIBRARY_BASE_REVISION_CONFLICT`（正文已有新版本 ⇒ 重新创建草稿），都判 409。两枚**分开**
 *   而不是并进 `ENT_LIBRARY_CONFLICT`：后者的人话是「请换一个名字」（重名冲突），对这两条是错的下一步。
 * **本刀（系统搜索）**：再注册两条 exact 子路径——`GET /skills/system-search`（本机技能根盘点：每根
 *   `{id,path,present}` + 每条候选三态 `registered|conflict|available`）与 `POST /skills/adopt`（正文**关闭键集**
 *   恰好 `{path}`，把那条 canonical 绝对路径原样交给 bundle；成功回的是**与 `/skills/self-installed` 逐字同形**的
 *   `{skills: […]}` ⇒ 界面复用既有解码器）。两条同样靠 exact 表抢在 bundle `/skills` 详情 prefix 之前
 *   （否则 `system-search`/`adopt` 会被当成包 id 判 400）；纳入族三枚码钉进 `enterpriseLocalErrorStatus`：
 *   `ENT_SKILL_DISCOVERY_UNKNOWN`→404、`ENT_SKILL_ALREADY_REGISTERED`→409、`ENT_SKILL_ADOPT_FAILED`→500
 *   （`ENT_SKILL_NAME_CONFLICT` 已在表里判 409，不重复）。
 * **本刀（在线搜索）**：再注册两条 exact 子路径——`GET /skills/online-search?q=…`（三源 fan-out 的归一化结果：
 *   `{sources:[{id,ok}], results:[{sourceId,name,description?,author?,stars?,installs?,installSource}]}`，
 *   部分成功如实报、全失败才错）与 `POST /skills/install-from-result`（正文**关闭键集**恰好 `{source}`，
 *   即搜索响应里那枚 `installSource` 坐标串；成功回的是**与 `/skills/install` 逐字同形**的最新已装态）。
 *   两条同样靠 exact 表抢在 bundle `/skills` 详情 prefix 之前；本刀往唯一那张码→状态表加四枚：
 *   `ENT_SKILL_SOURCE_UNKNOWN`→400、`ENT_SKILL_SOURCE_UNREACHABLE`→502、`ENT_SKILL_SOURCE_TOO_LARGE`→413，
 *   以及**既有** `ENT_SKILL_DOWNLOAD_FAILED`→502（此前不在表里 ⇒ 被折成 503；同族的「上游这次没给到」）。
 * [POS]: platform-client 的 Host/Client 同源协作边界，只序列化脱敏 DTO 并把认证 HTTP 留在 Host Service；路由形状受引擎 `match()`（`lib/index.js:322`）约束——exact 表整路径优先、prefix 只认 `pathname === prefix` 或 `pathname.startsWith(prefix + '/')`、多条命中取最长，故带尾斜杠的 prefix 会在引擎层空体 404 而根本不进 handler，而 `/skills/install` 这类子路径动作必须靠 exact 表抢在 `/skills` prefix 之前。`/skills/content` 的两个查询参数（包 id / 技能目录名）在这里只按形状收窄后原样转交：**名字不是路径**，是不是本包的、落点怎么拼、有没有符号链接逃逸，一律由 bundle 侧的已装记录与 `realpath` 判定
 * **本刀（插件行动分流）**：新注册两条 exact 动作路由 `POST <local>/plugins/{enable,disable}`（方向由 path 决定，
 *   正文关闭键集恰好 `{packageName}`，响应与 `GET /plugins` 同形）与可选端口 `pluginSetEnabled`；
 *   组合层没接线（旧 bundle）时如实 **503**（不是 404），界面那枚开关永远拿得到一句可重试的真话。
 *   ★ 停用只摘 bundle 层（官方 `setBundleEnabled(name,false)`），**绝不等同于卸载**。
 * **本刀（插件侧 NUWAX 员工登录）**：本文件**不注册任何新路由**（三条 `/nuwax/{login,logout,status}` 由 bundle 的
 *   `nuwax-route.ts` 自持），只往唯一那张码→状态表加五枚（第六枚 `ENT_NUWAX_NOT_CONFIGURED` 有意落在**表尾 503**
 *   默认上：部署配置问题就是"本机这块暂时不可用、可重试"）：
 *   `ENT_NUWAX_INVALID_CREDENTIALS`→401（凭据不对，与既有 `ENT_AUTH_REQUIRED` 同域）、
 *   `ENT_NUWAX_REJECTED`→403（凭据有效但平台不允许这次登录：风控/验证码/账号被锁，**不是**"再输一次就好"）、
 *   `ENT_NUWAX_UNAVAILABLE`/`ENT_NUWAX_TIMEOUT`/`ENT_NUWAX_PROTOCOL`→502（**上游**故障或上游回了读不懂的东西，
 *   与既有 `ENT_SKILL_SOURCE_UNREACHABLE` 同族，绝不折成 503 的"本机暂时不可用"）。
 * **本刀（口径 67 Phase C D2：连接器启用到本机）**：本文件**仍不注册任何新路由**（四条连接器路由
 *   `/connectors/{enable,disable,connected}` 与 `<mcpId>/status` 的注册面全在 bundle 的
 *   `connector-enable-route.ts`），只往唯一那张码→状态表补上连接器族**全部 11 枚码**（内核
 *   `connector-enable.ts` 的码边界；此前一枚都不在表里 ⇒ 全被表尾折成 503，而 403「还没在本机确认过这枚
 *   连接器」与 503「本机暂时不可用、可重试」是**实质不同**的下一步）：`ENT_INVALID_REQUEST`→400（已有）、
 *   `_CONFIG_UNAVAILABLE`/`_STATE_INVALID`/`_LOCAL_WRITE_FAILED`/`_INSTALL_FAILED`/`_UNINSTALL_FAILED`→503、
 *   `_CONFIG_INVALID`→502（上游协议问题，与 `ENT_NUWAX_PROTOCOL` 同族）、
 *   `_AUTHORIZATION_REQUIRED`→403、`_AUTHORIZATION_STALE`/`_INSTALL_IN_PROGRESS`/`_INSTALL_CANCELLED`→409
 *   （最后一枚与 `ENT_PLUGIN_INSTALL_CANCELLED` **逐字同判**）。语义与理由逐条写在
 *   `enterpriseLocalErrorStatus` 里那一段注释；bundle 侧的回归锁按**这一张表**逐枚断言。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  BRANDING_ASSET_LOCAL_PATH,
  BRANDING_ASSET_SLOTS,
  BRANDING_LOCAL_PATH,
  type BrandingAssetSlot,
  type EnterpriseBrandingPort,
} from './branding.js'
import type {
  BootstrapSnapshot,
  EnterpriseCredentialResult,
  EnterpriseCredentialsInput,
  EnterpriseLoginFlow,
  EnterpriseLoginForm,
  EnterprisePasswordChangeInput,
  EnterprisePlatformStatus,
} from './types.js'

const LOCAL_API_PREFIX = '/enterprise/api/v1/local'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const MAX_LOCAL_BODY_BYTES = 256 * 1024

/**
 * 三条 **prefix** 路由的注册 path：与各自的父路径（品牌文档 / 会话列表 / 配方列表）**逐字相同，不带尾斜杠**。
 *
 * 引擎 `dsh-host-webserver` 的 `match()`（`lib/index.js`）只做「路径段前缀」匹配：
 * `pathname === prefix || pathname.startsWith(`${prefix}/`)`；先查 exact 表（整路径命中即返回，不比长度），
 * miss 后才在 prefix 表里取**最长**命中。因此注册成 `${...}/asset/`、`${...}/sessions/`、`${...}/presets/`
 * 时，`/asset/light`、`/sessions/<id>/copies`、`/presets/<id>` 既不等于 prefix、也不以 `prefix + '/'` 开头，
 * 引擎层直接回 404（**空响应体，handler 根本不会被调用**）——这正是品牌位图、远端会话恢复与配方详情
 * 三条线空体 404 的根因，与 `bundle/src/skill-route.ts` 的详情路由同族（那里已修）。
 *
 * ★可被证伪的坐标（本文件这几条 exact 子路径**承重**的依据，不是风格问题）：
 * `@deepseek-ai/dsh-host-webserver/lib/index.js:148-149` 是 `exact` / `prefixes` **两张表**；
 * `:322` 原注释「Longest-prefix-wins over the prefix table **after an exact-table miss**」；
 * `:324-325` 先 `this.exact.get(pathname)` 且命中即返回；`:327-328` 才走 prefix 表并要求段边界。
 * ⇒ `/skills/upload`（本刀新增）**确实**会命中 bundle 侧那条 `/skills` 前缀（`rest === 'upload'`），
 * 因此它必须是 exact，否则会被详情 handler 当成包 id 去过 `^[1-9][0-9]{0,18}$` 而回 400。
 *
 * exact 与 prefix 是引擎里的**两张表**（`register()` 只对同 kind、同 path 抛重复），
 * 所以 `/sessions`、`/presets` 上「列表 exact + 详情 prefix」共用同一字符串并不冲突，且 exact 优先命中；
 * `/sessions/sync` 这条 sibling exact 同理不会被上面那条更短的 prefix 抢走。
 *
 * 下面这三条只用于 `register()`；handler 内 `slice()` 用的仍是**含斜杠**的边界串（`${...}/asset/` 等），
 * 二者不是同一条串，切勿为了「去重」把它们合并回带尾斜杠的形状。
 */
const BRANDING_ASSET_PREFIX_ROUTE = BRANDING_ASSET_LOCAL_PATH
const SESSION_RESTORE_PREFIX_ROUTE = `${LOCAL_API_PREFIX}/sessions`
const PRESET_DETAIL_PREFIX_ROUTE = `${LOCAL_API_PREFIX}/presets`

/**
 * 企业技能**安装动作**的三条 exact 注册 path。
 *
 * 技能目录的列表/详情在 `bundle/src/skill-route.ts` 里注册成「`/skills` exact 列表 + `/skills` prefix 详情」，
 * 本文件这第三条线是它的**子路径动作**：引擎 `match()`（`lib/index.js:322`）先查 exact 表整路径命中、
 * 再在 prefix 表里取最长，因此 `/skills/install`、`/skills/uninstall`、`/skills/installed` 一律由 exact 表
 * 优先命中，绝不会掉进 `/skills` 那条 prefix 被当成包 id。两条防线彼此独立：
 * 即便 exact 表整张消失，详情 handler 的 `^[1-9][0-9]{0,18}$` 也只会回 400，不会带着 `install` 打上游。
 */
export const ENTERPRISE_SKILL_INSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/install`
export const ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/uninstall`
export const ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/installed`
/**
 * 已装技能**正文**的只读 exact 路由：`GET <local>/skills/content?packageId=…&name=…`。
 *
 * 与上面三条动作路由同一族、同样靠 exact 表抢在 bundle 侧的 `/skills` 详情 prefix 之前；
 * 两个查询参数都不是路径——名字在 bundle 侧只会被当成「本包已装记录里的键」，
 * 因此即便有人手工构造请求，也拼不出技能目录之外的任何文件。
 */
export const ENTERPRISE_SKILL_CONTENT_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/content`

/**
 * 通路一「本地上传」的 exact 动作路由：`POST <local>/skills/upload`（真源 `docs/plan/skill-install-sources.md` §B.1 方案甲）。
 *
 * 与上面四条同族，同样靠 exact 表抢在 bundle 侧 `/skills` 详情 prefix 之前 ——
 * 否则 `rest === 'upload'` 会被详情 handler 当成包 id 去过 `^[1-9][0-9]{0,18}$` 而回 400
 * （引擎两张表与「exact 先于 prefix」的逐行坐标见上面 `BRANDING_ASSET_PREFIX_ROUTE` 那段注释）。
 * 请求是 `multipart/form-data`（**恰好一个** `artifact` 文件 part）；响应 `data` 与
 * `POST /skills/install` 的 `data` **逐字同形**（`{skills: [...]}`，UI 侧复用既有解码器）。
 */
export const ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/upload`

/**
 * 本机**自装**清单的只读 exact 路由：`GET <local>/skills/self-installed`（§E.2③，与 `/skills/installed` 并列）。
 *
 * 自装记录**不在** `installed.json` 里（那份是严格八键 + 雪花 id 的中心口径），因此它需要自己这条只读面；
 * 界面靠它回「已装 N 个技能在本机技能目录：a、b」，而**不会**在「企业技能」列表里看到自装行。
 */
export const ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/self-installed`

/**
 * 通路二「系统搜索」的**盘点** exact 只读路由：`GET <local>/skills/system-search`（本机技能根 + 候选三态）。
 *
 * 与上面六条同族，同样靠 exact 表抢在 bundle 侧 `/skills` 详情 prefix 之前 ——
 * 引擎 `dsh-host-webserver/lib/index.js` 是两张表（`:148-149`），`:324-325` 先查 exact 命中即返回，
 * `:327-328` 的 prefix 只认 `pathname === prefix || startsWith(prefix + '/')` ⇒ `/skills/system-search`
 * **确实会被** `/skills` prefix 命中，这条 exact 是**承重**的（否则 `system-search` 会被当包 id 判 400）。
 */
export const ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/system-search`

/**
 * 通路二「系统搜索」的**纳入** exact 动作路由：`POST <local>/skills/adopt`，正文关闭键集恰好 `{path}`。
 *
 * 只做**形状收窄**（键集 / 非空有界字符串）并把那条 canonical 绝对路径原样转交：
 * 「这条路径是不是本次盘点发现的、落点怎么拼、有没有符号链接逃逸」全由 bundle 侧判定
 *（`skill-system.ts` 先 `realpath` 再查候选 + `requireRelativeSkillPath` + realpath 逐字等式）。
 * 响应 `data` 与 `GET /skills/self-installed` **逐字同形**（`{skills: […]}`），界面因此复用同一份解码器。
 */
export const ENTERPRISE_SKILL_ADOPT_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/adopt`

/**
 * `/skills/adopt` 入参 `path` 的形状上限：与 bundle 侧同一条 1024（`MAX_ADOPT_PATH_LENGTH`）。
 *
 * 它是**运输层**的粗门禁，不承担路径语义：真正「这条路径算不算我们发现的那一条」由 bundle 侧按
 * canonical 路径逐字比对（这里既不知道技能根在哪，也不知道 allowlist 是什么）。
 */
const MAX_SKILL_ADOPT_PATH_LENGTH = 1024

/**
 * 通路三「在线搜索」的**搜索** exact 只读路由：`GET <local>/skills/online-search?q=<查询串>`。
 *
 * 与上面八条同族，同样靠 exact 表抢在 bundle 侧 `/skills` 详情 prefix 之前 ——
 * 否则 `online-search` 会被当成包 id 判 400。查询串只做**形状收窄**（非空、有界、无控制字符）后原样转交：
 * 三个公开源的端点、白名单、超时、归一化与去重全在 bundle 侧（`skill-online.ts`）。
 */
export const ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/online-search`

/**
 * 通路三「在线搜索」的**安装** exact 动作路由：`POST <local>/skills/install-from-result`，
 * 正文关闭键集恰好 `{source}` —— 那个串就是搜索响应里原样回来的 `installSource`（`"<sourceId>:<reference>"`）。
 *
 * 响应 `data` 与 `POST /skills/install` **逐字同形**（最新已装态，界面复用既有解码器）；
 * 真正装进来的技能在**自装清单**里（与 `/skills/upload` 同一条纪律）。
 */
export const ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH = `${LOCAL_API_PREFIX}/skills/install-from-result`

/** `/skills/online-search` 的 `q` 形状上限（与 bundle 侧 `MAX_QUERY_LENGTH` 同值 128）。 */
const MAX_SKILL_ONLINE_QUERY_LENGTH = 128

/** `/skills/install-from-result` 的 `source` 形状上限（与 bundle 侧那枚 1024 同值）。 */
const MAX_SKILL_INSTALL_SOURCE_LENGTH = 1024

/**
 * 本地上传的**独立**配额：50 MiB（与 bundle 侧制品上限 `SKILL_ARCHIVE_MAX_BYTES` 逐字同值）。
 *
 * ★它与 `MAX_LOCAL_BODY_BYTES`（256 KiB，**所有** JSON 路由的正文上限）互不影响：把 JSON 上限抬到
 * 50 MiB 等于同时放宽全部 JSON 动作路由的请求体，绝不允许；上传只在这条 multipart 路由上另开配额。
 */
export const MAX_SKILL_UPLOAD_BODY_BYTES = 52_428_800

/** multipart boundary 的 RFC 2046 bchars 子集（与 bundle 侧 `feedback-route.ts` 同一份形状门禁）。 */
const UPLOAD_BOUNDARY_SHAPE = /^[0-9A-Za-z'()+_,\-./:=? ]{1,70}$/

/** 只回显受控形状的稳定码；否则换成表尾默认码，绝不把内码甩给界面。 */
const LOCAL_ERROR_CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/**
 * 受管插件**取消**动作的 exact 注册 path：`POST <local>/plugins/cancel`，body 是关闭键集的 `{packageName}`。
 *
 * 它与 `POST <local>/plugins/{install,remove}` 同一族（同一个引擎 exact 表、同一套键集门禁与错误投影），
 * 属于本刀「安装/卸载/进度/取消全走官方服务面」的最后一块：官方 `pluginManager.cancelInstall(requestId)`
 * 的 requestId 只有 bundle 侧握着，故这里只做形状收窄 + 原样转交 + 把**当前**受管状态回给界面。
 *
 * ⚠ **响应形状与 GET 完全同形**（`{data: pluginStatus()}`），**不新增任何字段**：
 * 员工端解码器是关闭键集（`ui/src/local-api-decode.ts` 的 `hasExactKeys`），多发一个键就会让整条
 * 判 `ENT_LOCAL_RESPONSE_INVALID`。取消的**结果**由界面从「那次安装请求自己的收束」读
 * （真的取消掉 ⇒ 它抛 `ENT_PLUGIN_INSTALL_CANCELLED`），本路由只负责把取消指令送到官方面上。
 */
export const ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH = `${LOCAL_API_PREFIX}/plugins/cancel`

/**
 * 受管插件**启用 / 停用**动作的两条 exact 注册 path：`POST <local>/plugins/{enable,disable}`。
 *
 * 方向由**路径**决定（不是一个 `{enabled}` 布尔入参）：与官方插件页那枚开关走的本机服务面同形，
 * 正文因此可以小到关闭键集恰好 `{packageName}`。
 *
 * ★ 语义（用户明确纠正过）：「停用」**绝不等同于卸载**——它只把这枚插件的 bundle 层从本机 profile 上
 * 摘下来（官方 `pluginManager.setBundleEnabled(name,false)`：依赖与本机记录都留着），
 * 卸载仍然只有 `POST /plugins/remove` 那一条路，且界面只在**详情页**给（带确认 + 说清影响）。
 *
 * ⚠ 响应与 `GET /plugins` **完全同形**（`{data: pluginStatus()}`）：员工端解码器是关闭键集，
 * 这里多发一个键就会让整条判畸形。启停位那一枚 `enabled` 是**受管记录自己的**字段（随投影一起走）。
 */
export const ENTERPRISE_PLUGIN_ENABLE_LOCAL_PATH = `${LOCAL_API_PREFIX}/plugins/enable`
export const ENTERPRISE_PLUGIN_DISABLE_LOCAL_PATH = `${LOCAL_API_PREFIX}/plugins/disable`

/** 中心雪花 id 与官方 kebab 技能目录名的形状门禁（与 bundle 侧同规约，两处都是「先收窄再使用」）。 */
const ENTERPRISE_ID_PATTERN = /^[1-9][0-9]{0,18}$/
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 配方一键启用三条**子路径动作**的固定后缀：`/presets/<id>/{enable,disable,status}`。
 *
 * ⚠ 为什么必须由**已有的** `/presets` prefix 分派，而不是再 `register()` 三条路由：
 * 引擎 `dsh-host-webserver` 的 `register()`（`lib/index.js:177-180`）对**同 kind 同 path** 直接抛
 * `webserver: duplicate prefix route`（启动即崩），而 `/enterprise/api/v1/local/presets` 这条 prefix
 * 已由本文件注册给配方详情；exact 表又表达不了动态 `<id>`（`match()` 只按整路径查 exact 表）。
 * 于是形状与 `bundle/src/skill-route.ts` 用 `/skills` prefix 分派本机文件子路径**完全同款**：
 * 注册面零新增字符串（与既有 exact/prefix 两张表零重叠），三条子路径由同一条 handler 按后缀分派。
 */
const PRESET_ENABLE_SUFFIX = '/enable'
const PRESET_DISABLE_SUFFIX = '/disable'
const PRESET_STATUS_SUFFIX = '/status'

/** 配方**声明 id**（= 官方 Loader row id 去掉 `preset-` 前缀；与 bundle 的 `DECLARATION_ID_PATTERN` 同规约）。 */
const PRESET_DECLARATION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 披露弹层确认过的那份集合指纹（与 bundle 的指纹同形状）。 */
const PRESET_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

/** Harness `ctx.webServer` Service 公开的 route 结构。 */
export interface WebServerRoutePort {
  readonly host: '127.0.0.1' | '0.0.0.0'
  readonly port: number
  register(route: {
    readonly kind: 'exact' | 'prefix'
    readonly path: string
    readonly handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

/** 挂载到本地同源 API 的脱敏 Service 操作端口。 */
export interface EnterpriseLocalPlatformPort {
  status(): EnterprisePlatformStatus
  refresh(): Promise<EnterprisePlatformStatus>
  setServerUrl(serverUrl: string): Promise<{ readonly serverUrl: string }>
  startLogin(): Promise<EnterpriseLoginFlow>
  /**
   * 原生登录（安卓）：宿主已自己开好服务端事务，这里交出可选认证来源供界面渲染表单。
   * 没有进行中的原生事务时抛 `ENT_INVALID_REQUEST`。
   */
  loginForm(): EnterpriseLoginForm
  /** 代提交账号密码；成功即已驱动本机回调，失败按中心错误码抛出。 */
  submitCredentials(input: EnterpriseCredentialsInput, signal?: AbortSignal): Promise<EnterpriseCredentialResult>
  /** 走完「需改密」分支；成功后同样已驱动本机回调（再次被策略拒时返回 change-password）。 */
  submitPasswordChange(input: EnterprisePasswordChangeInput, signal?: AbortSignal): Promise<EnterpriseCredentialResult>
  cancelLogin(): boolean
  logout(): Promise<void>
  bootstrap(): BootstrapSnapshot | undefined
  listPresets(signal?: AbortSignal): Promise<unknown>
  getPreset(packageId: string, signal?: AbortSignal): Promise<unknown>
}

/** 会话同步本地投影端口；由 session-sync host-bridge 注入，避免反向依赖。 */
export interface EnterpriseLocalSessionPort {
  status(): {
    readonly enabled: boolean
    readonly deviceId: string | null
    readonly pendingSessionIds: readonly string[]
    readonly lastError: string | null
  }
  list(signal?: AbortSignal): Promise<unknown>
  restore(sourceSessionId: string, cwd: string, signal?: AbortSignal): Promise<{
    readonly restoredSessionId: string
    readonly sourceSessionId: string
  }>
}

export interface EnterpriseLocalApiOptions {
  readonly platform: EnterpriseLocalPlatformPort
  /** 由组合层绑定 distribution，避免 platform-client 反向依赖具体插件包。 */
  readonly pluginStatus: () => unknown
  readonly pluginAction?: (action: 'install' | 'remove', packageName: string, pluginVersionId?: string) => Promise<void>
  /**
   * 取消**在途**的受管插件安装（bundle 侧转官方 `pluginManager.cancelInstall`）。
   *
   * 与 `pluginAction` 同一手法：组合层无条件接线、端口在**调用时**实时解引用官方服务，
   * 故官方服务稍后就绪也进得了这条动作。缺席（旧 bundle）时本条路由如实按「分发不可用」拒（503），
   * **不是** 404：界面上那枚取消键永远拿得到一句真话。
   */
  readonly pluginCancel?: (packageName: string) => Promise<unknown>
  /**
   * 把一枚**已安装**的受管插件置为启用 / 停用（bundle 侧转官方 `pluginManager.setBundleEnabled`）。
   *
   * 与 `pluginAction` / `pluginCancel` 同一手法：组合层无条件接线、端口在**调用时**实时解引用官方服务。
   * 缺席（旧 bundle）时这两条路由如实按「分发不可用」拒（503），**不是** 404——界面那枚开关永远
   * 拿得到一句真话（可重试），而不是一个「本机没有这条路由」的假故障。
   */
  readonly pluginSetEnabled?: (packageName: string, enabled: boolean) => Promise<unknown>
  /**
   * 由组合层绑定企业技能安装器（bundle 的 `skill-install.ts`）；返回**安装后的最新已装态**，
   * 让界面一次往返就拿到真值而不是自行猜测。缺席时不注册 `/skills/install|uninstall`。
   */
  readonly skillAction?: (action: 'install' | 'uninstall', packageId: string) => Promise<unknown>
  /** 已装技能清单；缺席时不注册 `/skills/installed`。 */
  readonly skillStatus?: () => unknown | Promise<unknown>
  /**
   * 读一条**已装**技能的 `SKILL.md` 正文（bundle 的 `skill-install.ts`）；缺席时不注册 `/skills/content`。
   *
   * 路由只做形状收窄并把两个参数原样转交——**名字是不是本包的、落点怎么拼、有没有符号链接逃逸，
   * 一律由 bundle 侧判定**（那里才有本机已装记录与技能根）。
   */
  readonly skillContent?: (packageId: string, name: string) => Promise<unknown>
  /**
   * 通路一「本地上传」的 Host 端口（bundle 的 `skill-upload.ts`）。
   *
   * 入参是本机路由**已按 50 MiB 配额有界读取**的 multipart 正文与它的 boundary：
   * 运输层的四件事（方法 / `content-length` 预检 / `content-type` 形状 / 有界读取）在本文件，
   * **分帧解析与表单语义（恰好一个 `artifact` part）在 bundle 侧** —— 那里才有全仓唯一那份
   * multipart 分帧实现（`feedback-route.ts` 的 `parseFeedbackMultipart`），绝不新造第二个。
   * 返回值原样进 `{data}`（bundle 回的是与 `/skills/install` 同形的企业已装态）。缺席即不注册这条路由。
   */
  readonly skillUpload?: (body: Buffer, boundary: string) => Promise<unknown>
  /** 本机自装清单（bundle 的 `skill-upload.ts` 读独立状态文件）；缺席时不注册 `/skills/self-installed`。 */
  readonly skillSelfInstalled?: () => unknown | Promise<unknown>
  /**
   * 通路二「系统搜索」的**盘点**端口（bundle 的 `skill-system.ts` 扫描本机技能根）；缺席时不注册
   * `/skills/system-search`。只读：不改任何状态文件、不动任何技能目录。
   */
  readonly skillSystemSearch?: () => unknown | Promise<unknown>
  /**
   * 通路二「系统搜索」的**纳入**端口（bundle 的 `skill-system.ts`）；缺席时不注册 `/skills/adopt`。
   *
   * 入参是盘点投影里那枚 canonical 绝对路径。本文件**只**做键集与形状门禁，语义（是不是候选、
   * 三态 fail-closed、只登记不复制）全在 bundle 侧；返回值原样进 `{data}`（与 `/skills/self-installed` 同形）。
   */
  readonly skillAdopt?: (path: string) => Promise<unknown>
  /**
   * 通路三「在线搜索」的**搜索**端口（bundle 的 `skill-online.ts` 三源 fan-out）；缺席时不注册
   * `/skills/online-search`。只读：不改任何状态文件、不动任何技能目录。
   */
  readonly skillOnlineSearch?: (query: string) => unknown | Promise<unknown>
  /**
   * 通路三「在线搜索」的**安装**端口（bundle 的 `skill-online.ts`：codeload 整仓包 → 复用加固落盘）；
   * 缺席时不注册 `/skills/install-from-result`。
   *
   * 入参是搜索投影里那枚 `installSource` 坐标串。本文件**只**做键集与形状门禁，语义（源白名单、
   * 坐标解析、抓包、落盘）全在 bundle 侧；返回值原样进 `{data}`（与 `/skills/install` 同形）。
   */
  readonly skillInstallFromResult?: (source: string) => Promise<unknown>
  /**
   * 企业配方**一键启用**（bundle 的 `preset-service.ts`）；缺席时 `<id>/enable` 如实按非法请求拒。
   *
   * 入参 `confirmFingerprint` 是员工在披露弹层里确认过的那份**集合指纹**：交上来即「确认并授权」，
   * 不交则只按已授权状态尝试启用（未授权/指纹已变由 bundle 侧如实拒）。返回值原样进 `{data}`。
   */
  readonly presetEnable?: (presetPackageId: string, confirmFingerprint?: string) => Promise<unknown>
  /** 企业配方**停用**（bundle 的 `preset-service.ts`）；`declarationId` 是 kebab 声明 id。 */
  readonly presetDisable?: (declarationId: string) => Promise<unknown>
  /** `/presets/<id>/status` 的真值（三态授权 + 进行中 + 披露清单）；只读、不写任何授权。 */
  readonly presetStatus?: (presetPackageId: string) => Promise<unknown>
  /** 由组合层绑定整包卸载；返回的重启动作必须在 HTTP 成功响应写出后才执行。 */
  readonly uninstallPlugin?: () => Promise<{ readonly restart?: () => void }>
  /** 由组合层绑定会话同步；缺省时不注册 /sessions* 路由。 */
  readonly sessionSync?: EnterpriseLocalSessionPort
  /** 由 platform-client 品牌缓存绑定；缺省时不注册 /branding* 路由。 */
  readonly branding?: EnterpriseBrandingPort
  /**
   * 本地路由把异常投影成 HTTP 状态码时的留痕端口；由组合层绑定 Host logger。
   * 只上报操作名、原始 error 与最终状态码，不改变任何响应语义。
   */
  readonly onError?: (operation: string, error: unknown, status: number) => void
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

/** 品牌位图是本地缓存副本：只回白名单 MIME 与长度，浏览器不需要任何解码逻辑。 */
function writeAsset(response: ServerResponse, contentType: string, bytes: Buffer): void {
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': String(bytes.byteLength),
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
  })
  response.end(bytes)
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return 'ENT_PLATFORM_UNAVAILABLE'
}

/**
 * 与 {@link errorCode} 同源，但**没有**受控码时返回 undefined（上传/纳入路由要按状态兜底成同族码）。
 *
 * ★不能借道 `errorCode()`：那个函数在「异常身上根本没有 `code`」时会**替换**成 `ENT_PLATFORM_UNAVAILABLE`，
 * 而那枚码本身符合受控码形状 ⇒ 会把下面两条投影函数的「按状态兜底」整段变成死代码，
 * 于是「读正文时才发现超了 50 MiB」（`RangeError`，413）会被报成一句和事实无关的兜底码。
 * 这里只认异常**真的携带**的、形状受控的 code。
 */
function controlledErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code: unknown = (error as { code?: unknown }).code
  return typeof code === 'string' && LOCAL_ERROR_CODE_SHAPE.test(code) ? code : undefined
}

/**
 * 稳定错误码 → HTTP 状态的**唯一**映射（本地路由的失败投影）。
 *
 * 原先它是本文件私有的 `actionErrorStatus`，现在对外导出：`bundle/src/skill-route.ts` 的两条
 * **本机技能文件**子路由（`/skills/<id>/files`、`/skills/<id>/file`）必须与本文件的
 * `/skills/content` 用同一张表，否则同一种失败会在两条同族路由上给出两个状态码。
 * 另含配方发布口 fail-closed 的四个码：它们目前只由管理端 HTTP 端点产生、不走本机路由，
 * 仍然放进同一张表，以守住"一个稳定码只在一处定状态"的纪律。
 * 只读形状，不含任何路由副作用。
 *
 * @param error - 路由 handler 里逃出来的异常（带受控 `code` 的稳定错误或内建类型错误）。
 * @returns 该失败投影成的 HTTP 状态码。
 */
export function enterpriseLocalErrorStatus(error: unknown): number {
  if (error instanceof RangeError) return 413
  if (error instanceof SyntaxError || error instanceof TypeError) return 400
  const code = errorCode(error)
  if (code === 'ENT_INVALID_REQUEST') return 400
  if (code === 'ENT_PLUGIN_BUSY') return 409
  // 官方安装面取消了这次安装（bundle 侧 `ENT_PLUGIN_INSTALL_CANCELLED`）：请求本身合法、本机状态不允许
  // 这次调用收尾 ⇒ 409（与配方族 `ENT_PRESET_INSTALL_CANCELLED` 同判，重新看一眼前提再重试即可）。
  if (code === 'ENT_PLUGIN_INSTALL_CANCELLED') return 409
  // 技能落点已被同名技能目录占用：请求本身合法、本机状态冲突，故 409 而不是 400/503。
  if (code === 'ENT_SKILL_NAME_CONFLICT') return 409
  // 已装技能正文不是普通文件 / 符号链接逃逸 / 非法 UTF-8：请求本身合法、本机落盘状态可疑，同族判 409。
  if (code === 'ENT_SKILL_CONTENT_INVALID') return 409
  // 正文超过包内 SKILL.md 的同一条上限（256 KiB）：请求合法但资源太大，判 413（与请求体超限同码）。
  if (code === 'ENT_SKILL_CONTENT_TOO_LARGE') return 413
  // 本地上传通路（§B.1 步骤 4/5/6）：
  //  · 超过 50 MiB 上传配额 → 413；
  //  · 制品结构非法（`ENT_SKILL_ARCHIVE_INVALID`，**既有码、此前不在表里** ⇒ 会被表尾默认折成 503，
  //    而「这个包的结构不合法」重试多少次都一样，503 是错的下一步）与 frontmatter 闸门不过 → 400；
  //  · 制品落盘失败 → 500（本机写盘失败，与既有 `ENT_LIBRARY_INTERNAL` 同族）。
  //  · `ENT_SKILL_NAME_CONFLICT` 已在上面判 409，不重复。
  if (code === 'ENT_SKILL_UPLOAD_TOO_LARGE') return 413
  if (code === 'ENT_SKILL_UPLOAD_INVALID'
    || code === 'ENT_SKILL_ARCHIVE_INVALID'
    || code === 'ENT_SKILL_SKILLMD_INVALID') return 400
  if (code === 'ENT_SKILL_UPLOAD_FAILED') return 500
  // 通路二「系统搜索 → 纳入」族（真源 `cherry-skill-add-2026-10-05.md` §2.4 的三条硬拒 + 一枚基础设施码）：
  //  · 那条目录不在本次盘点候选里（含先 `realpath` 归一之后仍对不上）→ 404：它**不是**我们发现的东西，
  //    多给一个状态码只会让界面以为「差一点就成」；
  //  · 已被任一记录认领 → 409（请求合法，本机状态不允许重复登记）：与 `ENT_SKILL_NAME_CONFLICT` 同族但
  //    **下一步不同**（这条是「不必再纳入」，那条是「换个名字」），故各留一枚码；
  //  · 本机自己完不成这次登记（目录子树超过可摘要上限）→ 500：既不是「请求有问题」(4xx)、
  //    也不是「暂时不可用」(表尾 503)，重试同样不会变好。
  if (code === 'ENT_SKILL_DISCOVERY_UNKNOWN') return 404
  if (code === 'ENT_SKILL_ALREADY_REGISTERED') return 409
  if (code === 'ENT_SKILL_ADOPT_FAILED') return 500
  // 通路三「在线搜索 → 从结果安装」族（真源 `docs/plan/skill-install-sources.md` §B.2/§C/§F.1）：
  //  · 坐标不认（未知源 / 无 GitHub 坐标的源 / 坐标指不到技能）→ 400：**换一条结果**，重试同一串没有意义；
  //  · 上游不可用（连不上 / 超时 / 非 200 / 重定向跨出白名单）→ 502：这是**上游**的故障，可稍后重试；
  //    与既有 `ENT_PLATFORM_UNAVAILABLE`（本机平台面）不同源，也不该被折成 503 的「本机暂时不可用」；
  //  · 上游体量超上限 → 413（请求合法，但这份资源太大，本机按纪律不收）。
  //  · `ENT_SKILL_DOWNLOAD_FAILED`（**既有码，此前不在表里** ⇒ 会被表尾默认折成 503）与上面那条同族：
  //    都是「上游这次没给到」，判 502；★它同时被中心安装 `/skills/install` 使用，故那条路由的同类失败
  //    也从 503 变 502（更准确的状态，已在交付说明里点明）。
  if (code === 'ENT_SKILL_SOURCE_UNKNOWN') return 400
  if (code === 'ENT_SKILL_SOURCE_UNREACHABLE' || code === 'ENT_SKILL_DOWNLOAD_FAILED') return 502
  if (code === 'ENT_SKILL_SOURCE_TOO_LARGE') return 413
  if (code === 'ENT_AUTH_REQUIRED' || code === 'ENT_AUTH_SESSION_EXPIRED') return 401
  if (code === 'ENT_DEVICE_REVOKED' || code === 'ENT_PERMISSION_DENIED') return 403
  if (code === 'ENT_RESOURCE_NOT_FOUND') return 404
  if (code === 'ENT_SESSION_SYNC_DISABLED') return 403
  // 资料库族（bundle 的 `library/route.ts` 把 `library/*` 翻成这四枚码后走本表；四枚各自的状态码由这里唯一定死）：
  //  · 冲突族（同父重名 / 键已被占用 / 不可变修订已存在）→ 409（请求合法、本机状态不允许）；
  //  · 已停用 → 409（同族：请求合法，但这份资料当前不可被读取）；
  //  · 超限族（单文件 / 单会话选中集合）→ 413；
  //  · 未分类内部错误 → 500（**与技能上传那枚 `ENT_SKILL_UPLOAD_FAILED` 同族**：都是「本机内部失败、
  //    不是暂时不可用」，与表尾默认的 503 不同义）。
  //  **草稿族两枚乐观锁冲突**（草稿/发布这一刀新增，各自一枚而不是并进 `ENT_LIBRARY_CONFLICT`）：两者的下一步不同
  //  ——"草稿被别人改过 ⇒ 刷新后重试"与"正文已有新版本 ⇒ 重新创建草稿"；并进同码就会让界面拿一句"请换一个名字"
  //  （那是重名冲突的人话，对这两条是错的）。两枚都判 409：请求合法、当前状态不允许这一次写入。
  if (code === 'ENT_LIBRARY_CONFLICT' || code === 'ENT_LIBRARY_DISABLED') return 409
  if (code === 'ENT_LIBRARY_REVISION_CONFLICT' || code === 'ENT_LIBRARY_BASE_REVISION_CONFLICT') return 409
  if (code === 'ENT_LIBRARY_TOO_LARGE') return 413
  if (code === 'ENT_LIBRARY_INTERNAL') return 500
  // 配方发布口 fail-closed 引用校验（ENT_PRESET_DEPENDENCIES_INVALID / _KIND_UNSUPPORTED 是
  // "这份版本的引用声明本身不合法"→400；ENT_PRESET_REQUIRES_MISSING / _NOT_PUBLISHED 是
  // "声明合法但中心当前没有可分发目标"→409，管理员补齐或改钉后重试）。
  if (code === 'ENT_PRESET_DEPENDENCIES_INVALID' || code === 'ENT_PRESET_DEPENDENCY_KIND_UNSUPPORTED') return 400
  if (code === 'ENT_PRESET_REQUIRES_MISSING' || code === 'ENT_PRESET_REQUIRES_NOT_PUBLISHED') return 409
  // 配方**一键启用**的稳定码族（bundle 的 `preset/errors.ts` 抛出，经 `preset-service.ts` 收敛成一枚码）：
  //  · 未授权 = 需要员工先确认披露（权限族，与 ENT_PERMISSION_DENIED 同域）→ 403；
  //  · 指纹已变 = 员工确认过的那份披露与当前配方已不一致 / 进行中 = 同配方已在装或卸（与 ENT_PLUGIN_BUSY 同族）→ 409；
  //  · 本机状态文件损坏、官方安装被取消 → 409（请求合法，本机状态不允许这次调用，重新看一眼/重试即可）；
  //  · 配方形状非法（含制品包内身份与详情不符）→ 400；
  //  · 官方安装/卸载失败、制品拿不到、合成 bundle 写不下 → 503（本机或上游失败，可重试）。
  if (code === 'ENT_PRESET_AUTHORIZATION_REQUIRED') return 403
  if (code === 'ENT_PRESET_AUTHORIZATION_STALE'
    || code === 'ENT_PRESET_INSTALL_IN_PROGRESS'
    || code === 'ENT_PRESET_INSTALL_CANCELLED'
    || code === 'ENT_PRESET_STATE_INVALID') return 409
  if (code === 'ENT_PRESET_RECIPE_INVALID') return 400
  if (code === 'ENT_PRESET_INSTALL_FAILED'
    || code === 'ENT_PRESET_UNINSTALL_FAILED'
    || code === 'ENT_PRESET_BUNDLE_WRITE_FAILED'
    || code === 'ENT_PRESET_ARTIFACT_UNAVAILABLE') return 503
  // 插件侧 NUWAX 员工登录族（bundle 的 `nuwax-route.ts` 把 `nuwax-auth.ts` 的六枚码投影到本表）：
  //  · 凭据不对 → 401（与既有 `ENT_AUTH_REQUIRED` 同域：这一层就是"你是谁"没通过）；
  //  · 平台拒绝（风控/验证码/账号被锁）→ 403：请求合法、身份也对，是**平台侧不允许这次登录**，
  //    与 `ENT_PERMISSION_DENIED` 同判（"再输一次同样的口令"不是正确的下一步）；
  //  · 上游不可达 / 超时 / 上游回了读不懂的东西 → 502：三种都是**上游**的事，可稍后重试，
  //    与 `ENT_SKILL_SOURCE_UNREACHABLE` 同族；★不折成 503 —— 那句人话是"本机暂时不可用"，会指错方向。
  //  · `ENT_NUWAX_NOT_CONFIGURED`（部署没配平台地址）**有意不列**：表尾 503 就是它的状态。
  if (code === 'ENT_NUWAX_INVALID_CREDENTIALS') return 401
  if (code === 'ENT_NUWAX_REJECTED') return 403
  if (code === 'ENT_NUWAX_UNAVAILABLE' || code === 'ENT_NUWAX_TIMEOUT' || code === 'ENT_NUWAX_PROTOCOL') return 502
  // 连接器族（口径 67 Phase C D2 的本机 HTTP 面：bundle 的 `connector-enable-route.ts` / `connector-enable.ts`
  // 抛出内核那 11 枚码，状态只由**这一张**表定，bundle 侧不另立第二张）。逐枚的理由：
  //  · 平台这次读不动 / 本机状态坏 / 本机写不动 / 官方装卸失败 → 503（本机这块暂时不可用、可重试）；
  //  · **平台答了我们读不懂的东西**（`_CONFIG_INVALID`：信封不是信封、`mcpServers` 不是对象、`serverName`
  //    不在域内、`url` 非 http(s)…）→ 502：与 `ENT_NUWAX_PROTOCOL` 同族，是**上游**的协议问题，
  //    折成 503 那句"本机暂时不可用"会让人一直重试、而它永远不会自己好；
  //  · 这枚连接器**还没在本机确认过** → 403（与 `ENT_PRESET_AUTHORIZATION_REQUIRED` 同判：需要员工先看披露再确认）；
  //  · 披露变了要重新确认 / 同一枚连接器已在装或卸 → 409（与 `ENT_PRESET_AUTHORIZATION_STALE` /
  //    `ENT_PRESET_INSTALL_IN_PROGRESS` 同判：请求合法，本机当前状态不允许这一次调用）；
  //  · 官方安装被**取消**（用户/宿主在途中取消）→ 与上面那条 `ENT_PLUGIN_INSTALL_CANCELLED`（判 **409**）
  //    **逐字同判**：同一件事在两条族线上给两个状态码，界面就得写两套文案。
  //  ★`ENT_INVALID_REQUEST`（形状）已在上面判 400，不重复列。
  if (code === 'ENT_CONNECTOR_CONFIG_UNAVAILABLE'
    || code === 'ENT_CONNECTOR_STATE_INVALID'
    || code === 'ENT_CONNECTOR_LOCAL_WRITE_FAILED'
    || code === 'ENT_CONNECTOR_INSTALL_FAILED'
    || code === 'ENT_CONNECTOR_UNINSTALL_FAILED') return 503
  if (code === 'ENT_CONNECTOR_CONFIG_INVALID') return 502
  if (code === 'ENT_CONNECTOR_AUTHORIZATION_REQUIRED') return 403
  if (code === 'ENT_CONNECTOR_AUTHORIZATION_STALE'
    || code === 'ENT_CONNECTOR_INSTALL_IN_PROGRESS'
    || code === 'ENT_CONNECTOR_INSTALL_CANCELLED') return 409
  return 503
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_LOCAL_BODY_BYTES) throw new RangeError('request body is too large')
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

async function requireEmptyObject(request: IncomingMessage): Promise<void> {
  const value = await readJson(request)
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value as Record<string, unknown>).length !== 0) {
    throw new TypeError('action body must be an empty object')
  }
}

function singleHeader(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0]
}

/**
 * 从 `content-type` 头里取 multipart boundary；不是 `multipart/form-data` 或边界形状非法即 undefined。
 *
 * 与 bundle 侧 `feedback-route.ts` 的 `feedbackMultipartBoundary` 同一份形状门禁（bchars 子集），
 * 只是这里**只取边界**：分帧与 part 语义留给 bundle 侧唯一那份 multipart 解析器。
 */
function multipartBoundaryOf(contentType: string | undefined): string | undefined {
  if (contentType === undefined || !/^multipart\/form-data\s*;/i.test(contentType)) return undefined
  const match = /boundary=(?:"([^"]*)"|([^;]*))/i.exec(contentType)
  const boundary = (match?.[1] ?? match?.[2] ?? '').trim()
  return UPLOAD_BOUNDARY_SHAPE.test(boundary) ? boundary : undefined
}

/**
 * 有界读取请求正文；超过上限时继续排空（**不缓冲**）并返回 undefined。
 *
 * 与 bundle 侧 `feedback-route.ts` 的 `readBoundedBody` 同款手法：排空而不是 `destroy()`，
 * 让浏览器读得到那条 413 响应，而不是一个 connection reset。
 */
async function readBoundedUploadBody(request: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  let overflow = false
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += bytes.length
    if (total > limit) {
      overflow = true
      continue
    }
    chunks.push(bytes)
  }
  return overflow ? undefined : Buffer.concat(chunks)
}

/**
 * 上传路由的失败码投影：**受控码原样回显**（与其余路由不同 —— 见下），否则按状态兜底成上传族码。
 *
 * 为什么不像 `/skills/install` 那样把 400/413 折成 `ENT_INVALID_REQUEST`/`ENT_REQUEST_TOO_LARGE`：
 * 冻结契约把 `ENT_SKILL_UPLOAD_INVALID`(400)、`ENT_SKILL_ARCHIVE_INVALID`(400)、`ENT_SKILL_SKILLMD_INVALID`(400)、
 * `ENT_SKILL_UPLOAD_TOO_LARGE`(413) 逐枚写进了界面要认的码表，折掉它们就等于让用户看不到「是包不对还是路不对」。
 */
function uploadFailureCode(error: unknown, status: number): string {
  const code = controlledErrorCode(error)
  if (code !== undefined) return code
  if (status === 413) return 'ENT_SKILL_UPLOAD_TOO_LARGE'
  if (status === 400) return 'ENT_SKILL_UPLOAD_INVALID'
  if (status === 500) return 'ENT_SKILL_UPLOAD_FAILED'
  return 'ENT_PLATFORM_UNAVAILABLE'
}

/**
 * `/skills/adopt` 的失败码投影：**受控码原样回显**（与上传那条同一考虑 —— 三条 fail-closed 的码各有
 * 不同的下一步「看清单 / 不用再纳入 / 换个名字」，折成 `ENT_INVALID_REQUEST` 就等于把原因抹掉），
 * 其余按状态兜底成同族码。
 */
function skillAdoptFailureCode(error: unknown, status: number): string {
  const code = controlledErrorCode(error)
  if (code !== undefined) return code
  if (status === 413) return 'ENT_REQUEST_TOO_LARGE'
  if (status === 400) return 'ENT_INVALID_REQUEST'
  if (status === 404) return 'ENT_SKILL_DISCOVERY_UNKNOWN'
  if (status === 409) return 'ENT_SKILL_NAME_CONFLICT'
  if (status === 500) return 'ENT_SKILL_ADOPT_FAILED'
  return 'ENT_PLATFORM_UNAVAILABLE'
}

/**
 * 通路三两条路由的失败码投影：**受控码原样回显**（与上传/纳入同一考虑 —— 「坐标不认」「上游不可用」
 * 「体量超限」三条的下一步完全不同，折成一枚就等于把原因抹掉），其余按状态兜底成同族码。
 */
function skillOnlineFailureCode(error: unknown, status: number): string {
  const code = controlledErrorCode(error)
  if (code !== undefined) return code
  if (status === 413) return 'ENT_SKILL_SOURCE_TOO_LARGE'
  if (status === 502) return 'ENT_SKILL_SOURCE_UNREACHABLE'
  if (status === 400) return 'ENT_INVALID_REQUEST'
  return 'ENT_PLATFORM_UNAVAILABLE'
}

function parseServerUrlInput(value: unknown): { readonly serverUrl: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('server URL body must be an object')
  }
  const body = value as Record<string, unknown>
  if (Object.keys(body).join(',') !== 'serverUrl'
    || typeof body['serverUrl'] !== 'string'
    || body['serverUrl'].length === 0
    || body['serverUrl'].length > 2048) {
    throw new TypeError('server URL body is invalid')
  }
  return { serverUrl: body['serverUrl'] }
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? '/', 'http://enterprise.local')
}

/**
 * 逐字段读必填字符串：键集必须**完全一致**、每个值都是非空有界字符串，否则 TypeError（投影 400）。
 *
 * 原生登录的凭证正文走这里——多余键即拒，避免任何越界字段被顺手转发给企业服务器。
 */
function requiredStrings(value: unknown, keys: readonly string[], maxLength: number): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('body must be an object')
  const body = value as Record<string, unknown>
  const expected = [...keys].sort().join(',')
  if (Object.keys(body).sort().join(',') !== expected) throw new TypeError('unexpected body keys')
  const result: Record<string, string> = {}
  for (const key of keys) {
    const field = body[key]
    if (typeof field !== 'string' || field.length === 0 || field.length > maxLength) throw new TypeError(`invalid ${key}`)
    result[key] = field
  }
  return result
}

/**
 * `POST <local>/presets/<id>/enable` 的请求体：**关闭键集**，只有两种合法形状。
 *
 *  · `{}`（键集为空）——只按已授权状态尝试启用；未授权/指纹已变由 bundle 侧如实拒。
 *  · `{confirmFingerprint}`——员工在披露弹层确认过的那份集合指纹；bundle 侧据此写授权。
 *
 * 多一个键、少一个键、键名前缀相同（如 `confirmFingerprints`）、值不是 64 位小写十六进制一律
 * `TypeError`（投影 400）——任何越界字段都不得进入授权写入。
 *
 * @param request - 已通过 content-type/体积门禁的请求流。
 * @returns 确认指纹；空对象时 undefined。
 */
async function readPresetEnableBody(request: IncomingMessage): Promise<string | undefined> {
  const value = await readJson(request)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('preset enable body must be an object')
  }
  const body = value as Record<string, unknown>
  const keys = Object.keys(body).sort().join(',')
  if (keys === '') return undefined
  const fingerprint = body['confirmFingerprint']
  if (keys !== 'confirmFingerprint'
    || typeof fingerprint !== 'string' || !PRESET_FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new TypeError('preset enable body is invalid')
  }
  return fingerprint
}

function registerJsonAction(
  webServer: WebServerRoutePort,
  path: string,
  action: () => Promise<unknown>,
  onError?: (operation: string, error: unknown, status: number) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: `${LOCAL_API_PREFIX}${path}`,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      try {
        await requireEmptyObject(request)
        writeJson(response, 200, { data: await action() })
      } catch (error) {
        const status = enterpriseLocalErrorStatus(error)
        onError?.(`POST ${LOCAL_API_PREFIX}${path}`, error, status)
        writeJson(response, status, {
          error: { code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
        })
      }
    },
  })
}

/** 以单一事务注册 T06 本地路由，并返回合并 disposer。 */
export function registerEnterpriseLocalApi(
  webServer: WebServerRoutePort,
  options: EnterpriseLocalApiOptions,
): () => void {
  const disposers: (() => void)[] = []

  try {
    disposers.push(registerJsonAction(webServer, '/refresh', () => options.platform.refresh(), options.onError))
    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/status`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        writeJson(response, 200, { data: options.platform.status() })
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/server`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }
        try {
          const input = parseServerUrlInput(await readJson(request))
          writeJson(response, 200, { data: await options.platform.setServerUrl(input.serverUrl) })
        } catch (error) {
          const status = enterpriseLocalErrorStatus(error)
          options.onError?.(`POST ${LOCAL_API_PREFIX}/server`, error, status)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
          })
        }
      },
    }))

    disposers.push(registerJsonAction(webServer, '/auth/start', async () => options.platform.startLogin(), options.onError))
    disposers.push(registerJsonAction(webServer, '/auth/cancel', async () => ({
      cancelled: options.platform.cancelLogin(),
    }), options.onError))
    disposers.push(registerJsonAction(webServer, '/logout', async () => {
      await options.platform.logout()
      return { loggedOut: true }
    }, options.onError))

    // 原生登录（安卓）：宿主已自己开好服务端事务，界面直接收账号密码——凭证只在内存中转发，
    // 既不写盘也不进日志；成功后宿主自己把 redirectUri 走完（本机回调照常触发）。
    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/auth/form`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        try {
          writeJson(response, 200, { data: options.platform.loginForm() })
        } catch (error) {
          options.onError?.(`GET ${LOCAL_API_PREFIX}/auth/form`, error, enterpriseLocalErrorStatus(error))
          writeJson(response, enterpriseLocalErrorStatus(error), { error: { code: errorCode(error) } })
        }
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/auth/password`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }
        const operation = `POST ${LOCAL_API_PREFIX}/auth/password`
        try {
          const body = requiredStrings(await readJson(request), ['sourceId', 'username', 'password'], 512)
          writeJson(response, 200, { data: await options.platform.submitCredentials({
            sourceId: body['sourceId'] as string,
            username: body['username'] as string,
            password: body['password'] as string,
          }) })
        } catch (error) {
          const status = enterpriseLocalErrorStatus(error)
          // 凭证永不进日志：这里只留操作名、原始 error（不含正文）与状态码。
          options.onError?.(operation, error, status)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : status === 413 ? 'ENT_REQUEST_TOO_LARGE' : errorCode(error) },
          })
        }
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/auth/password-change`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }
        const operation = `POST ${LOCAL_API_PREFIX}/auth/password-change`
        try {
          const body = requiredStrings(await readJson(request), ['challenge', 'newPassword'], 512)
          writeJson(response, 200, { data: await options.platform.submitPasswordChange({
            challenge: body['challenge'] as string,
            newPassword: body['newPassword'] as string,
          }) })
        } catch (error) {
          const status = enterpriseLocalErrorStatus(error)
          options.onError?.(operation, error, status)
          writeJson(response, status, {
            error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : status === 413 ? 'ENT_REQUEST_TOO_LARGE' : errorCode(error) },
          })
        }
      },
    }))

    if (options.uninstallPlugin !== undefined) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/uninstall`,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          try {
            await requireEmptyObject(request)
            const result = await options.uninstallPlugin?.()
            const restart = result?.restart
            writeJson(response, 200, { data: { uninstalled: true, restartRequested: restart !== undefined } })
            restart?.()
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            writeJson(response, status, {
              error: { code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
            })
          }
        },
      }))
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/bootstrap`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        writeJson(response, 200, { data: options.platform.bootstrap() ?? null })
      },
    }))

    if (options.branding !== undefined) {
      const branding = options.branding
      // 品牌是本地缓存投影：读失败也必须回一个可渲染的答案（null 由 ui 回落内置默认），故恒 200。
      disposers.push(webServer.register({
        kind: 'exact',
        path: BRANDING_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: await branding.document() })
          } catch (error) {
            options.onError?.(`GET ${BRANDING_LOCAL_PATH}`, error, 200)
            writeJson(response, 200, { data: null })
          }
        },
      }))
      disposers.push(webServer.register({
        kind: 'prefix',
        // 不带尾斜杠：引擎按「路径段前缀」匹配，带尾斜杠会让 /branding/asset/<slot> 在引擎层就 404。
        path: BRANDING_ASSET_PREFIX_ROUTE,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          const slot = requestUrl(request).pathname.slice(`${BRANDING_ASSET_LOCAL_PATH}/`.length)
          if (!BRANDING_ASSET_SLOTS.includes(slot as BrandingAssetSlot)) {
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
            return
          }
          try {
            const asset = await branding.asset(slot as BrandingAssetSlot)
            if (asset === undefined) {
              writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
              return
            }
            writeAsset(response, asset.contentType, asset.bytes)
          } catch (error) {
            options.onError?.(`GET ${BRANDING_ASSET_LOCAL_PATH}/${slot}`, error, 404)
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
          }
        },
      }))
    }

    for (const action of ['install', 'remove'] as const) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/plugins/${action}`,
        handler: async (request, response) => {
          if (request.method !== 'POST') { methodNotAllowed(response, 'POST'); return }
          try {
            const value = await readJson(request)
            if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid plugin action')
            const body = value as Record<string, unknown>
            if (Object.keys(body).sort().join(',') !== (action === 'install' ? 'packageName,pluginVersionId' : 'packageName')
              || typeof body['packageName'] !== 'string' || body['packageName'].length > 214
              || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(body['packageName'])
              || action === 'install' && (typeof body['pluginVersionId'] !== 'string' || !/^[1-9][0-9]{0,18}$/.test(body['pluginVersionId']))) {
              throw new TypeError('invalid plugin action')
            }
            if (options.pluginAction === undefined) throw new Error('plugin distribution is unavailable')
            await options.pluginAction(action, body['packageName'], body['pluginVersionId'] as string | undefined)
            writeJson(response, 200, { data: options.pluginStatus() })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            writeJson(response, status, { error: {
              code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
            } })
          }
        },
      }))
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/plugins`,
      handler: (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        writeJson(response, 200, { data: options.pluginStatus() })
      },
    }))

    // 受管插件**启用 / 停用**：与 install/remove/cancel 同一族、同一套键集门禁与错误投影。
    // 方向由 path 决定（`/enable` 与 `/disable` 是两条独立路由）。
    for (const [suffix, enabled] of [['enable', true], ['disable', false]] as const) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/plugins/${suffix}`,
        handler: async (request, response) => {
          if (request.method !== 'POST') { methodNotAllowed(response, 'POST'); return }
          try {
            const value = await readJson(request)
            if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid plugin enable')
            const body = value as Record<string, unknown>
            if (Object.keys(body).sort().join(',') !== 'packageName'
              || typeof body['packageName'] !== 'string' || body['packageName'].length > 214
              || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(body['packageName'])) {
              throw new TypeError('invalid plugin enable')
            }
            if (options.pluginSetEnabled === undefined) throw new Error('plugin distribution is unavailable')
            await options.pluginSetEnabled(body['packageName'], enabled)
            writeJson(response, 200, { data: options.pluginStatus() })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            writeJson(response, status, { error: {
              code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
            } })
          }
        },
      }))
    }

    // 受管插件**取消**：关闭键集 `{packageName}`，与上面两条动作同一个错误投影；
    // 响应与 GET 同形（**不加字段**，见 ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH 的注释）。
    disposers.push(webServer.register({
      kind: 'exact',
      path: ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH,
      handler: async (request, response) => {
        if (request.method !== 'POST') { methodNotAllowed(response, 'POST'); return }
        try {
          const value = await readJson(request)
          if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid plugin cancel')
          const body = value as Record<string, unknown>
          if (Object.keys(body).sort().join(',') !== 'packageName'
            || typeof body['packageName'] !== 'string' || body['packageName'].length > 214
            || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(body['packageName'])) {
            throw new TypeError('invalid plugin cancel')
          }
          if (options.pluginCancel === undefined) throw new Error('plugin distribution is unavailable')
          await options.pluginCancel(body['packageName'])
          writeJson(response, 200, { data: options.pluginStatus() })
        } catch (error) {
          const status = enterpriseLocalErrorStatus(error)
          writeJson(response, status, { error: {
            code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
          } })
        }
      },
    }))

    if (options.skillStatus !== undefined) {
      const skillStatus = options.skillStatus
      disposers.push(webServer.register({
        kind: 'exact',
        path: ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: await skillStatus() })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(`GET ${ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH}`, error, status)
            writeJson(response, status, { error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) } })
          }
        },
      }))
    }

    if (options.skillContent !== undefined) {
      const skillContent = options.skillContent
      disposers.push(webServer.register({
        kind: 'exact',
        path: ENTERPRISE_SKILL_CONTENT_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          const query = requestUrl(request).searchParams
          const keys = [...query.keys()]
          const packageId = query.get('packageId')
          const name = query.get('name')
          // 查询键集必须**恰好**是这两个标识符（多给、少给、重复一律 400）：越界参数不得进入这条只读路由。
          // 两个值各自按形状在**本地**收窄：包 id 是中心雪花、技能名是官方 kebab 目录名。
          // 名字只当「本包已装记录里的键」转交，绝不在这里拼任何路径。
          if (keys.length !== 2 || keys.some(key => key !== 'packageId' && key !== 'name')
            || packageId === null || !ENTERPRISE_ID_PATTERN.test(packageId)
            || name === null || name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
            writeJson(response, 400, { error: { code: 'ENT_INVALID_REQUEST' } })
            return
          }
          try {
            writeJson(response, 200, { data: await skillContent(packageId, name) })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(`GET ${ENTERPRISE_SKILL_CONTENT_LOCAL_PATH}`, error, status)
            writeJson(response, status, { error: {
              code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
            } })
          }
        },
      }))
    }

    if (options.skillUpload !== undefined) {
      const skillUpload = options.skillUpload
      disposers.push(webServer.register({
        kind: 'exact',
        // 精确路径抢在 bundle 侧 `/skills` 详情 prefix 之前（否则 `upload` 会被当包 id 判 400）。
        path: ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          const operation = `POST ${ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH}`
          // 还没读完正文的本地拒绝统一 `resume()` 排空（照 feedback-route 的既有手法），
          // 让浏览器读得到这条 4xx/5xx，而不是一个 connection reset。
          const reject = (status: number, code: string): void => {
            request.resume()
            writeJson(response, status, { error: { code } })
          }
          const declared = Number(singleHeader(request.headers['content-length']))
          if (Number.isFinite(declared) && declared > MAX_SKILL_UPLOAD_BODY_BYTES) {
            reject(413, 'ENT_SKILL_UPLOAD_TOO_LARGE')
            return
          }
          const boundary = multipartBoundaryOf(singleHeader(request.headers['content-type']))
          if (boundary === undefined) {
            reject(400, 'ENT_SKILL_UPLOAD_INVALID')
            return
          }
          try {
            const body = await readBoundedUploadBody(request, MAX_SKILL_UPLOAD_BODY_BYTES)
            // 超限时读盘已排空（不缓冲），这里只回稳定码 —— 与声明长度那一条同一个码。
            if (body === undefined) throw new RangeError('upload body is too large')
            writeJson(response, 200, { data: await skillUpload(body, boundary) })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(operation, error, status)
            writeJson(response, status, { error: { code: uploadFailureCode(error, status) } })
          }
        },
      }))
    }

    if (options.skillSelfInstalled !== undefined) {
      const skillSelfInstalled = options.skillSelfInstalled
      disposers.push(webServer.register({
        kind: 'exact',
        path: ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: await skillSelfInstalled() })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(`GET ${ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH}`, error, status)
            writeJson(response, status, { error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) } })
          }
        },
      }))
    }

    if (options.skillSystemSearch !== undefined) {
      const skillSystemSearch = options.skillSystemSearch
      disposers.push(webServer.register({
        kind: 'exact',
        // 同一条承重理由：`system-search` 若掉进 bundle 侧 `/skills` 详情 prefix 会被当包 id 判 400。
        path: ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: await skillSystemSearch() })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(`GET ${ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH}`, error, status)
            writeJson(response, status, { error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) } })
          }
        },
      }))
    }

    if (options.skillAdopt !== undefined) {
      const skillAdopt = options.skillAdopt
      disposers.push(webServer.register({
        kind: 'exact',
        // 同理：`adopt` 必须由 exact 表接住，否则会被 `/skills` 前缀当成包 id。
        path: ENTERPRISE_SKILL_ADOPT_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          const operation = `POST ${ENTERPRISE_SKILL_ADOPT_LOCAL_PATH}`
          try {
            const value = await readJson(request)
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
              throw new TypeError('invalid skill adopt')
            }
            const body = value as Record<string, unknown>
            // 关闭键集恰好 `{path}`（与 `/plugins/{action}` 同一把尺）：越界键、非字符串、空串、超长
            // 都在这里变成 400，**一次都不进** bundle —— 那条路径的语义（是不是候选）由 bundle 判定。
            if (Object.keys(body).sort().join(',') !== 'path'
              || typeof body['path'] !== 'string'
              || body['path'].length === 0
              || body['path'].length > MAX_SKILL_ADOPT_PATH_LENGTH) {
              throw new TypeError('invalid skill adopt')
            }
            writeJson(response, 200, { data: await skillAdopt(body['path']) })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(operation, error, status)
            writeJson(response, status, { error: { code: skillAdoptFailureCode(error, status) } })
          }
        },
      }))
    }

    if (options.skillOnlineSearch !== undefined) {
      const skillOnlineSearch = options.skillOnlineSearch
      disposers.push(webServer.register({
        kind: 'exact',
        // 同一条承重理由：`online-search` 若掉进 bundle 侧 `/skills` 详情 prefix 会被当包 id 判 400。
        path: ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          const operation = `GET ${ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH}`
          try {
            const query = requestUrl(request).searchParams.get('q')
            // 只做形状收窄：非空、有界、无控制字符。语义（三源、白名单、超时、归一化）全在 bundle 侧。
            if (query === null || query.length === 0 || query.length > MAX_SKILL_ONLINE_QUERY_LENGTH) {
              throw new TypeError('invalid skill online search query')
            }
            for (const character of query) {
              const point = character.codePointAt(0) ?? 0
              if (point < 0x20 || point === 0x7f) throw new TypeError('invalid skill online search query')
            }
            writeJson(response, 200, { data: await skillOnlineSearch(query) })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(operation, error, status)
            writeJson(response, status, { error: { code: skillOnlineFailureCode(error, status) } })
          }
        },
      }))
    }

    if (options.skillInstallFromResult !== undefined) {
      const skillInstallFromResult = options.skillInstallFromResult
      disposers.push(webServer.register({
        kind: 'exact',
        // 同理：`install-from-result` 必须由 exact 表接住，否则会被 `/skills` 前缀当成包 id。
        path: ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          const operation = `POST ${ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH}`
          try {
            const value = await readJson(request)
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
              throw new TypeError('invalid skill install-from-result body')
            }
            const body = value as Record<string, unknown>
            // 关闭键集恰好 `{source}`（与 `/plugins/{action}` 同一把尺）：越界键、非字符串、空串、超长
            // 都在这里变成 400，**一次都不进** bundle —— 坐标语义（源白名单 / 解析）由 bundle 判定。
            if (Object.keys(body).sort().join(',') !== 'source'
              || typeof body['source'] !== 'string'
              || body['source'].length === 0
              || body['source'].length > MAX_SKILL_INSTALL_SOURCE_LENGTH) {
              throw new TypeError('invalid skill install-from-result body')
            }
            writeJson(response, 200, { data: await skillInstallFromResult(body['source']) })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            options.onError?.(operation, error, status)
            writeJson(response, status, { error: { code: skillOnlineFailureCode(error, status) } })
          }
        },
      }))
    }

    if (options.skillAction !== undefined) {
      const skillAction = options.skillAction
      for (const action of ['install', 'uninstall'] as const) {
        const path = action === 'install'
          ? ENTERPRISE_SKILL_INSTALL_LOCAL_PATH
          : ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH
        disposers.push(webServer.register({
          kind: 'exact',
          path,
          handler: async (request, response) => {
            if (request.method !== 'POST') { methodNotAllowed(response, 'POST'); return }
            try {
              const value = await readJson(request)
              if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid skill action')
              const body = value as Record<string, unknown>
              // 与 `/plugins/{action}` 同一把尺：键集完全一致、packageId 是中心雪花 id 形状。
              // 越界字符串绝不进入 bundle 的路径构造（那里还会再校验一次 manifest 里的技能名）。
              if (Object.keys(body).sort().join(',') !== 'packageId'
                || typeof body['packageId'] !== 'string'
                || !ENTERPRISE_ID_PATTERN.test(body['packageId'])) {
                throw new TypeError('invalid skill action')
              }
              writeJson(response, 200, { data: await skillAction(action, body['packageId']) })
            } catch (error) {
              const status = enterpriseLocalErrorStatus(error)
              options.onError?.(`POST ${path}`, error, status)
              writeJson(response, status, { error: {
                code: status === 413 ? 'ENT_REQUEST_TOO_LARGE' : status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error),
              } })
            }
          },
        }))
      }
    }

    if (options.sessionSync !== undefined) {
      const sessionSync = options.sessionSync
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/sessions/sync`,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          writeJson(response, 200, { data: sessionSync.status() })
        },
      }))
      disposers.push(webServer.register({
        kind: 'exact',
        path: `${LOCAL_API_PREFIX}/sessions`,
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            methodNotAllowed(response, 'GET')
            return
          }
          try {
            writeJson(response, 200, { data: { items: await sessionSync.list() } })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            writeJson(response, status, { error: {
              code: errorCode(error) === 'ENT_SESSION_SYNC_DISABLED' ? 'ENT_SESSION_SYNC_DISABLED' : errorCode(error),
            } })
          }
        },
      }))
      disposers.push(webServer.register({
        kind: 'prefix',
        // 不带尾斜杠：否则 /sessions/<id>/copies 到不了本 handler（URL 里的 id 由下面的边界常量切出）。
        path: SESSION_RESTORE_PREFIX_ROUTE,
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            methodNotAllowed(response, 'POST')
            return
          }
          const rest = requestUrl(request).pathname.slice(`${LOCAL_API_PREFIX}/sessions/`.length)
          const match = /^([^/]+)\/copies$/.exec(rest)
          if (match === null) {
            writeJson(response, 404, { error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
            return
          }
          const sourceSessionId = decodeURIComponent(match[1]!)
          try {
            const body = await readJson(request)
            const cwd = typeof body === 'object' && body !== null && !Array.isArray(body)
              ? (body as { cwd?: unknown }).cwd
              : undefined
            if (typeof cwd !== 'string' || !cwd.startsWith('/') || cwd.length > 4096) {
              throw new TypeError('invalid restore cwd')
            }
            const result = await sessionSync.restore(sourceSessionId, cwd)
            writeJson(response, 200, {
              data: {
                restoredSessionId: result.restoredSessionId,
                sourceSessionId: result.sourceSessionId,
              },
            })
          } catch (error) {
            const status = enterpriseLocalErrorStatus(error)
            writeJson(response, status, {
              error: { code: status === 400 ? 'ENT_INVALID_REQUEST' : errorCode(error) },
            })
          }
        },
      }))
    }

    /**
     * 配方一键启用三条子路径的分派（**注册面零新增字符串**，见 `PRESET_ENABLE_SUFFIX` 的注释）。
     *
     *  · `POST <id>/enable` → `presetEnable(id, confirmFingerprint?)`（`id` 是中心雪花）；
     *  · `POST <id>/disable` → `presetDisable(id)`（`id` 是**声明 id**，kebab）；
     *  · `GET  <id>/status` → `presetStatus(id)`（`id` 是中心雪花）；
     *  · 端口缺席（组合层没接线）→ 400，与 `bundle/src/skill-route.ts` 的本机文件端口同款口径：
     *    如实按非法请求拒，不暴露、不猜、不打上游。
     *
     * 失败投影只走 `enterpriseLocalErrorStatus` 这**唯一一张**表；`onError` 留操作名与原始 error。
     */
    const dispatchPresetAction = async (
      request: IncomingMessage,
      response: ServerResponse,
      action: 'enable' | 'disable' | 'status',
      rest: string,
    ): Promise<void> => {
      const id = rest.slice(0, -`/${action}`.length)
      const operation = `${action === 'status' ? 'GET' : 'POST'} ${LOCAL_API_PREFIX}/presets/${rest}`
      const missing = (action === 'enable' && options.presetEnable === undefined)
        || (action === 'disable' && options.presetDisable === undefined)
        || (action === 'status' && options.presetStatus === undefined)
      if (missing) {
        writeJson(response, 400, { error: { code: 'ENT_INVALID_REQUEST' } })
        return
      }
      if ((action === 'status' && request.method !== 'GET')
        || (action !== 'status' && request.method !== 'POST')) {
        methodNotAllowed(response, action === 'status' ? 'GET' : 'POST')
        return
      }
      try {
        if (action === 'disable') {
          if (!PRESET_DECLARATION_ID_PATTERN.test(id)) throw new TypeError('invalid preset declaration id')
          await requireEmptyObject(request)
          writeJson(response, 200, { data: await options.presetDisable?.(id) })
          return
        }
        if (!ENTERPRISE_ID_PATTERN.test(id)) throw new TypeError('invalid preset package id')
        if (action === 'status') {
          writeJson(response, 200, { data: await options.presetStatus?.(id) })
          return
        }
        const confirmFingerprint = await readPresetEnableBody(request)
        writeJson(response, 200, { data: await options.presetEnable?.(id, confirmFingerprint) })
      } catch (error) {
        const status = enterpriseLocalErrorStatus(error)
        options.onError?.(operation, error, status)
        writeJson(response, status, {
          error: {
            code: status === 413 ? 'ENT_REQUEST_TOO_LARGE'
              : status === 400 ? 'ENT_INVALID_REQUEST'
                : errorCode(error),
          },
        })
      }
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: `${LOCAL_API_PREFIX}/presets`,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        try {
          const value = await options.platform.listPresets()
          writeJson(response, 200, { data: value })
        } catch (error) {
          const status = enterpriseLocalErrorStatus(error)
          writeJson(response, status, { error: { code: errorCode(error) } })
        }
      },
    }))

    disposers.push(webServer.register({
      kind: 'prefix',
      // 不带尾斜杠：否则 /presets/<id> 到不了本 handler（`/presets` 裸路径由上面的 exact 路由优先命中）。
      path: PRESET_DETAIL_PREFIX_ROUTE,
      handler: async (request, response) => {
        const rest = requestUrl(request).pathname.slice(`${LOCAL_API_PREFIX}/presets/`.length)
        const action = rest.endsWith(PRESET_ENABLE_SUFFIX) ? 'enable'
          : rest.endsWith(PRESET_DISABLE_SUFFIX) ? 'disable'
            : rest.endsWith(PRESET_STATUS_SUFFIX) ? 'status'
              : undefined
        if (action !== undefined) {
          await dispatchPresetAction(request, response, action, rest)
          return
        }
        if (request.method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }
        try {
          if (!ENTERPRISE_ID_PATTERN.test(rest)) throw new TypeError('invalid preset package id')
          const value = await options.platform.getPreset(rest)
          writeJson(response, 200, { data: value })
        } catch (error) {
          const status = enterpriseLocalErrorStatus(error)
          writeJson(response, status, { error: { code: errorCode(error) } })
        }
      },
    }))

  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
