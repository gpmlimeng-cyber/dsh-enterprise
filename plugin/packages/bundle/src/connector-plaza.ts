/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、稳定码→HTTP 状态唯一映射 `enterpriseLocalErrorStatus`；**取数入口由组合层注入**，生产实现就是本包 `esc-route.ts` 的**宿主内部读唯一入口** `readEnterpriseEscHostJson`（同一份 HTTP 客户端 + 同一枚票据 + 同一套判决；本文件自己不碰 `fetch`、不持票据）
 * [OUTPUT]: 对外提供 `GET /enterprise/api/v1/local/connectors` 的注册函数 `registerEnterpriseConnectorPlazaRoute`、端口契约 `EnterpriseConnectorPlazaPort`、宿主侧脱敏投影 `readConnectorPlaza` / `projectConnectorRow`、安全格闭集 `ENTERPRISE_CONNECTOR_KEYS`（+可选四格 `ENTERPRISE_CONNECTOR_OPTIONAL_KEYS`）、两枚有界常量 `ENTERPRISE_CONNECTOR_MAX_SPACES` / `ENTERPRISE_CONNECTOR_MAX_CONNECTORS` 与唯一稳定码 `ENT_CONNECTOR_PLAZA_UNAVAILABLE`
 * [POS]: Phase C 连接器广场的**宿主半边**（口径 67 D0+D1）——D0 把三条 MCP 只读路径加进 `esc-route.ts` 的
 *   **宿主内部许可表**（浏览器可读表**零新增**），D1 就是本文件：把平台连接器目录投影成浏览器唯一看得见的
 *   `{data:{connectors,complete,spaces}}`。它与 `skill-discovery.ts`（官方发现面只读镜像）并列，
 *   同样是"宿主侧脱敏投影 + 部分成功/失败语义 + 判定点日志"的范式，差别只有一处：**取数来自平台**（经
 *   `esc-route.ts` 的宿主内部读面），而发现面读的是宿主进程内的官方服务。
 *   ★**为什么广场必须宿主侧投影、不能像 esc 只读面那样把平台原始行交给浏览器**：
 *   真机取证（`analysis/connector-plaza-probe.md` §2）——平台每一行 18 键里带 `mcpConfig` / `deployedConfig`，
 *   实测 `GET /api/mcp/134` 的 `mcpConfig` **就是可直接落地的客户端配置**
 *   `{"mcpServers":{"qixinhuiyan-mcp":{"url":"https://mcp.qixin…"}}}` ⇒ 它可能夹带 URL 内嵌凭据、header、token。
 *   进了浏览器就等于把凭据发给前端。故 D1 **从零构造**每一条连接器（不是"删掉危险键"），
 *   出厂只有 {@link ENTERPRISE_CONNECTOR_KEYS} 那几格，且反向锁整份响应正文逐字 grep 不到配置面。
 *   ★**两条可选格的派生纪律**：`official` 由平台 `platformMcp` 派生，但**只在它真的是布尔**时才产键
 *   （"平台没说"与"平台说 false"是两件事——本仓无任何 `platformMcp` 语义取证，故绝不做真值性转换、
 *   也不拿别的字段推断）；`toolCount` 只借 `deployedConfig.tools[]` 的**长度**（配置正文一个字都不出去），
 *   没真读到那个数组就不给键。其余可选格（`description`/`icon`）缺席或形状不对同样不给键，也不让整条失败。
 *   ★**部分成功 / 全失败**：某个空间读失败（含形状读不懂、整批行有读不懂的）⇒ 那个空间 `ok:false`（`count:0`）、
 *   其余照出、`complete:false`、经 `onError` 留 `step=space-mcp-failed`；**一个空间都没成功** ⇒ 失败：
 *   上游自带的受控码（`esc-route.ts` 交回的 `ENT_AUTH_REQUIRED` / `ENT_NUWAX_*`）**原样上抛**（⇒ 401/502，
 *   不把"请先登录"折成"本机不可用"），其余情况是本面那枚 `ENT_CONNECTOR_PLAZA_UNAVAILABLE`（⇒ 503）。
 *   **绝不静默回空列表**（空列表 = 谎称"你们企业一台连接器都没有"）。
 *   ★**有界**：空间数与连接器总数各一枚上限，超限 ⇒ 截断（多出来的空间**不查**）+ `complete:false`，
 *   不报错、也不静默丢；`complete` **原样出厂**，不许被折成 `true`。
 *   ★**为什么跨空间盘点走逐空间 GET、不引入 POST 读**：`POST /api/mcp/deployed/list` 的真实查询体
 *   至今未文档化（`docs/research/nuwax-plugin-backend-2026-10-06.md` §缺陷 4 实测 `{}` 与
 *   `{spaceId,pageNum,pageSize}` 都回 `5000`），而 `GET /api/mcp/list/<spaceId>` 已有真机读数
 *   （空间 3 ⇒ 42 条、248 ⇒ 9 条、2 ⇒ 0 条）。同一条事实用**已有动词**取，就不必为一张表再开一套动词支持。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'

/** 本机连接器广场的唯一路径（exact：引擎 exact 整路径优先于任何 prefix）。 */
export const ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH = '/enterprise/api/v1/local/connectors'

/** 空间维度的平台路径（**已在浏览器可读表的旧七条字面规则里**，本刀不动它）。 */
const PLATFORM_SPACE_LIST_PATH = '/api/space/list'

/** 逐空间连接器目录的平台路径形状（D0 新加的三条宿主内部规则之一）。 */
function platformSpaceMcpListPath(spaceId: number): string {
  return `/api/mcp/list/${String(spaceId)}`
}

/**
 * 本面唯一的稳定码：**这台部署的连接器目录这次读不到**。
 *
 * ★四种来由收在**一枚**码上，因为它们对员工是同一件事、下一步也是同一条（重试；仍然失败找管理员）：
 *   ① 空间列表那条宿主内部读失败（`step=space-list-failed`）；
 *   ② 空间列表读回来了，但形状读不懂（同一个判定点：那不是"没有空间"）；
 *   ③ **每一个**空间都读失败（`step=space-mcp-failed`）——存在成功的空间时不走这里，那属于部分成功；
 *   ④ 路由 handler 里逃出来的任何其它异常（`step=plaza-failed`）。
 * ★**状态码走 `enterpriseLocalErrorStatus` 那张唯一表**：本码刻意**不进**那张表，落在表尾默认 503
 *   （与 `ENT_NUWAX_NOT_CONFIGURED` / `ENT_SKILL_DISCOVERY_UNAVAILABLE` 同一手法：本机这块暂时不可用、
 *   可重试），因此不需要动 platform-client 一个字节。
 * ★**绝不用空列表代替它**：空列表 = "你们企业一台连接器都没有"，那是假话。
 */
export const ENT_CONNECTOR_PLAZA_UNAVAILABLE = 'ENT_CONNECTOR_PLAZA_UNAVAILABLE'

/**
 * 一次盘点最多看几个空间（**有界**：超限 ⇒ 截断并把 `complete:false`，不报错、也不静默丢）。
 *
 * 取 64 是**余量**不是实测值：真机三个空间（2/3/248）。一个有界常量必须显著大于当前真实空间数，
 * 否则它会在某天悄悄变成"少报"；同时它又必须小到"空间数被平台灌爆"时本面仍在可控范围内。
 */
export const ENTERPRISE_CONNECTOR_MAX_SPACES = 64

/**
 * 连接器总数上限（**有界**：超限 ⇒ 截断并把 `complete:false`）。
 *
 * 1000 的口径：真机最大那个空间（3）42 条，`/api/mcp/list` 还受平台自己 100 条分页的限制
 * （`docs/research/nuwax-plugin-backend-2026-10-06.md` §缺陷 8）⇒ 这是"上限的上限"，
 * 不是我们打算真的渲染的数量。
 */
export const ENTERPRISE_CONNECTOR_MAX_CONNECTORS = 1000

/**
 * 一条出厂连接器的**必填**安全格；顺序即响应里的键序（用例按这个清单做逐键集合断言）。
 *
 * ★这里没有、也永远不会有：`mcpConfig` / `deployedConfig` / `serverConfig` / `url` / `headers` /
 *   `permissions` 原文 / `creatorId` / `uid` / `serverName`。投影是**从零构造**（见 `projectConnectorRow`），
 *   不是"删掉危险键"——任何输入下都不可能漏出去。
 */
export const ENTERPRISE_CONNECTOR_KEYS = [
  'id',
  'name',
  'installType',
  'deployStatus',
  'space',
] as const

/**
 * 可选安全格：平台"没说"就不给这个键（"没说"与"说了空/说了 0"分得开）。
 *
 * · `description` / `icon`：平台行里就有，缺席或形状不对都不出厂（它们是给人看的皮，不该让整条失败）；
 * · `toolCount`：**只在真读到 `deployedConfig.tools[]` 时**给（借那一格的**长度**，配置面本身一个字都不出去）；
 * · `official`：见 {@link projectOfficialFlag}。
 */
export const ENTERPRISE_CONNECTOR_OPTIONAL_KEYS = ['description', 'icon', 'official', 'toolCount'] as const

/** 一个空间在响应里的安全格（`ok:false` ⇒ 这个空间的数这次没读到，`count` 恒 0）。 */
export interface EnterpriseConnectorSpace {
  readonly id: number
  readonly name: string
  readonly ok: boolean
  readonly count: number
}

/** 一条投影后的连接器（浏览器侧解码器收的就是这个形状）。 */
export interface EnterpriseConnector {
  readonly id: number
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly installType: string
  readonly deployStatus: string
  readonly official?: boolean
  readonly toolCount?: number
  readonly space: { readonly id: number; readonly name: string }
}

/** 一次盘点：`complete` 缺席外仅供参考——见 {@link readConnectorPlaza} 的判定。 */
export interface EnterpriseConnectorPlaza {
  readonly connectors: readonly EnterpriseConnector[]
  readonly complete: boolean
  readonly spaces: readonly EnterpriseConnectorSpace[]
}

/**
 * 本面**唯一**的失败形态：带稳定码的异常（`enterpriseLocalErrorStatus` 只读 `.code`，与全仓同约定）。
 *
 * `step` 只进 Host 日志，不进响应体——员工看到的是同一句话，排障的人靠 `step` 分得清是哪一段断的。
 */
export type EnterpriseConnectorPlazaStep = 'space-list-failed' | 'space-mcp-failed' | 'plaza-failed'

class ConnectorPlazaError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly step: EnterpriseConnectorPlazaStep,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'ConnectorPlazaError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

/** 收敛成本面唯一那枚码（同时带上判定点）。 */
function plazaUnavailable(step: EnterpriseConnectorPlazaStep, message: string, cause?: unknown): ConnectorPlazaError {
  return new ConnectorPlazaError(ENT_CONNECTOR_PLAZA_UNAVAILABLE, message, step, cause)
}

/** 有界：两枚常量都可被调用方收紧（测试用；生产走上面那两个默认值）。 */
export interface EnterpriseConnectorPlazaLimits {
  readonly maxSpaces?: number | undefined
  readonly maxConnectors?: number | undefined
}

/**
 * 本面的取数能力：**必填**，且它的生产实现就是 `esc-route.ts` 宿主内部读的那一个入口。
 *
 * ★为什么**必填**而不是给一个默认值：本面没有自己的票据，它必须拿到组合层那一个 `escReadPort`
 *   （与浏览器那条 `POST /esc/read`、与已发布技能安装面**同一个对象**）——由组合层显式交进来，
 *   "忘了接线"这件事在类型上就不可表达，而不是在运行期退化成一个打不出请求的桩。
 * ★它**不改变信任边界**：本文件不新增任何 HTTP 客户端、不碰 `fetch`、不碰票据
 *   （票据只在 `esc-route.ts` 的会话持有者里），许可表那一关也在 `esc-route.ts`。
 */
export interface EnterpriseConnectorPlazaPort extends EnterpriseConnectorPlazaLimits {
  readonly readHostJson: (path: string) => Promise<unknown>
  /** 部分失败的留痕（判定点 `space-mcp-failed`）；不改变任何响应语义。 */
  readonly onError?: ((message: string, error: unknown) => void) | undefined
}

/** 写一个 JSON 响应（与全仓本机路由同一形状：无缓存、UTF-8、`nosniff`）。 */
function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

/** 方法不符：405 + `Allow`（与全仓本机路由同判）。 */
function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

/** 从异常里取稳定码（只认字符串 `code`；取不到回本面那枚码）。 */
function errorCodeOf(error: unknown): string {
  const code: unknown = (error as { readonly code?: unknown } | null | undefined)?.code
  return typeof code === 'string' && code.length > 0 ? code : ENT_CONNECTOR_PLAZA_UNAVAILABLE
}

/**
 * 上游自己带的**受控稳定码**（`esc-route.ts` 交回来的 `ENT_AUTH_REQUIRED` / `ENT_NUWAX_*`）。
 *
 * ★判据是**两段**：异常身上真的带了一个字符串 `code`（`carriedCodeOf` —— 不能用 `errorCodeOf`，
 *   那个函数在没有码时会**替换**成本面那枚兜底码，用它判会把每一条无码异常都误判成"受控码"），
 *   且那枚码形状受控。命中即**原样上抛**——那些码的状态是 `enterpriseLocalErrorStatus` 那张唯一表
 *   定死的（401/403/502），把它们折成"本机这块暂时不可用"会把用户引向错的下一步
 *   （没登录时会说"重试"，而不是"请先登录"）。
 *
 * @returns 该异常（当它带受控码时）；否则 `undefined`（调用方按本面那枚码收口）。
 */
function withStableCode(error: unknown): unknown {
  const code = carriedCodeOf(error)
  return code !== undefined && CODE_SHAPE.test(code) ? error : undefined
}

/** 只认异常**真的携带**的字符串 `code`（没有就是没有，绝不兜底）。 */
function carriedCodeOf(error: unknown): string | undefined {
  const code: unknown = (error as { readonly code?: unknown } | null | undefined)?.code
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/** 受控码形状（与全仓同约定：`ENT_` 前缀 + 大写/数字/下划线）。 */
const CODE_SHAPE = /^ENT_[A-Z0-9_]{1,64}$/

/** 只认真对象（数组与 null 都不算）。 */
function asRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * 一次平台取数的结果：生产实现（`esc-route.ts` 的宿主内部读）交回**已解析**的信封对象；
 * 本函数也接受一枚 `Response`（测试的假平台直接给 `Response` 时不必自己再解析一遍）。
 */
type HostReadResult = unknown | Response

/** 收窄取数结果：`Response` 先解析（非 JSON ⇒ 本面失败），其余原样交给形状闸门。 */
async function readHostValue(
  read: () => Promise<HostReadResult>,
  what: string,
  step: EnterpriseConnectorPlazaStep,
): Promise<unknown> {
  const raw = await read()
  if (typeof Response !== 'undefined' && raw instanceof Response) {
    try {
      return (await raw.json()) as unknown
    } catch {
      throw plazaUnavailable(step, `the platform answered a non-JSON body (${what})`)
    }
  }
  return raw
}

/**
 * 平台信封的 `data`（形状不对 ⇒ 本面失败，**绝不当成"没有数据"**）。
 *
 * ★它只认"带 `code` 的对象"这一个形状（与 `esc-route.ts` 的 `parseEnvelope` 同一判据）——
 *   平台在没登录时回的 `{"code":"4010"}` **也算**信封，`data` 缺席由调用方按自己的形状闸门判。
 */
function envelopeData(envelope: unknown, what: string, step: EnterpriseConnectorPlazaStep): unknown {
  const record = asRecordOrUndefined(envelope)
  if (record === undefined || record['code'] === undefined) {
    throw plazaUnavailable(step, `the platform answered something that is not an envelope (${what})`)
  }
  return record['data']
}

/** 一枚**安全**整数（雪花 id 的十进制；非安全整数与越界一律不是本面的输入）。 */
function isSafeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * `official` 的**唯一**派生点（读平台 `platformMcp`）。
 *
 * ★纪律：**平台的显式布尔**才是这一格的事实来源。缺席（`undefined`）或形状不是布尔 ⇒ **不给这个键**
 *   ——"平台没说"与"平台说不是官方"是两件事，后者是 `false`，前者不是。
 *   ★为什么不猜别的形态：本仓无任何 `platformMcp` 语义的取证（`analysis/*` 全仓 grep 只命中探针里那一行
 *   键名），因此本函数**只**把布尔原样读回，绝不做"真值性转换"、也不拿别的字段推断。
 */
function projectOfficialFlag(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/**
 * `toolCount` 的**唯一**派生点（只在真读到 `deployedConfig.tools[]` 时给）。
 *
 * ★只回**长度**：`deployedConfig` 的正文（其中 `serverConfig` 可能带凭据）一个字都不出去。
 */
function projectToolCount(row: Record<string, unknown>): number | undefined {
  const deployed = asRecordOrUndefined(row['deployedConfig'])
  if (deployed === undefined) return undefined
  const tools = deployed['tools']
  return Array.isArray(tools) ? tools.length : undefined
}

/**
 * 把平台一条 MCP 行投影成**安全格**；形状读不懂 ⇒ 抛（宁可如实失败，也不静默少报一台连接器）。
 *
 * ★必填的只有"这条记录的身份与它在本机怎么呈现"那几格：`id` / `name` / `installType` / `deployStatus`；
 *   其余（描述、图标、官方位、工具数）都是可选，平台没说就不给键。
 * ★`space` **不从行里取**：行里的 `spaceId` 与"这条是从哪个空间查出来的"是同一个事实，而空间**名字**
 *   只有 `/api/space/list` 有 ⇒ 唯一来源是调用方交进来的那个空间（同一个事实不留第二个来源）。
 *
 * @param raw - 平台行（`/api/mcp/list/<spaceId>` 里的一条）。
 * @param space - 这一批的所属空间（`{id,name}` 取自空间列表）。
 * @returns 逐键安全格、无配置面的连接器。
 * @throws {ConnectorPlazaError} 行的必填格形状不对。
 */
export function projectConnectorRow(
  raw: unknown,
  space: { readonly id: number; readonly name: string },
): EnterpriseConnector {
  const row = asRecordOrUndefined(raw)
  if (row === undefined) {
    throw plazaUnavailable('space-mcp-failed', 'the platform answered a non-object MCP row')
  }
  const id = row['id']
  if (!isSafeId(id)) {
    throw plazaUnavailable('space-mcp-failed', 'the platform answered an MCP row without a safe integer id')
  }
  const name = row['name']
  if (typeof name !== 'string' || name.length === 0) {
    throw plazaUnavailable('space-mcp-failed', 'the platform answered an MCP row without a name')
  }
  const installType = row['installType']
  const deployStatus = row['deployStatus']
  if (typeof installType !== 'string' || typeof deployStatus !== 'string') {
    throw plazaUnavailable('space-mcp-failed', 'the platform answered an MCP row without installType/deployStatus')
  }
  const description = row['description']
  const icon = row['icon']
  const official = projectOfficialFlag(row['platformMcp'])
  const toolCount = projectToolCount(row)
  return {
    id,
    name,
    // 可选四格：缺席/形状不对/空串一律**不给键**（"没说"与"说空"分得开），且绝不让整条失败。
    ...(typeof description === 'string' && description.length > 0 ? { description } : {}),
    ...(typeof icon === 'string' && icon.length > 0 ? { icon } : {}),
    installType,
    deployStatus,
    ...(official === undefined ? {} : { official }),
    ...(toolCount === undefined ? {} : { toolCount }),
    // ★`mcpConfig` / `deployedConfig` / `serverConfig` / `creatorId` / `uid` / `permissions` 就在这里被
    //   **结构性**丢掉：上面这个字面量里没有它们的位置。
    space: { id: space.id, name: space.name },
  }
}

/** 空间列表里一条的投影（只取 `{id,name}`：其余字段本面用不到，也就不出厂）。 */
function projectSpaceEntry(raw: unknown): { readonly id: number; readonly name: string } {
  const row = asRecordOrUndefined(raw)
  if (row === undefined || !isSafeId(row['id'])) {
    throw plazaUnavailable('space-list-failed', 'the platform answered a space without a safe integer id')
  }
  const name = row['name']
  if (typeof name !== 'string' || name.length === 0) {
    throw plazaUnavailable('space-list-failed', 'the platform answered a space without a name')
  }
  return { id: row['id'], name }
}

/**
 * 逐空间盘点连接器目录，投影成**浏览器唯一看得见的**那份 `{connectors,complete,spaces}`。
 *
 * 判定顺序与语义（逐条都是刻意的）：
 *  ① **空间列表**经宿主内部读面取（`/api/space/list` 是既有字面规则）⇒ 形状不是数组/条目读不懂 ⇒
 *     本面明确失败（`step=space-list-failed`），**绝不折成"没有空间"**；
 *  ② 空间数超过 {@link EnterpriseConnectorPlazaLimits.maxSpaces} ⇒ 截断（多出来的空间**不查**，
 *     用 `complete:false` 如实说"这份不是全部"）；
 *  ③ **逐空间**取 `/api/mcp/list/<spaceId>`：某一个失败 ⇒ 那个空间 `ok:false`（`count:0`）、
 *     **其余照出**（部分成功保留），失败经 `onError` 留 `step=space-mcp-failed`；
 *  ④ 连接器总数超过 {@link EnterpriseConnectorPlazaLimits.maxConnectors} ⇒ 截断（`complete:false`）；
 *  ⑤ **一个空间都没成功** ⇒ 抛本面唯一那枚码（`step=space-mcp-failed`）——**绝不静默回空列表**；
 *  ⑥ `complete` 只有在"每个空间都 ok **且** 两处都没截断"时才是 `true`。
 *
 * ★`complete` **原样出厂**：它不从任何别的地方反推，也不允许被折成 `true`。
 *
 * @param port - 取数入口（默认就是 `esc-route.ts` 的宿主内部读；测试可注入）。
 * @returns 脱敏后的连接器广场。
 * @throws {ConnectorPlazaError} 见上面的判定顺序。
 */
export async function readConnectorPlaza(port: EnterpriseConnectorPlazaPort): Promise<EnterpriseConnectorPlaza> {
  const readHostJson = port.readHostJson
  const maxSpaces = port.maxSpaces ?? ENTERPRISE_CONNECTOR_MAX_SPACES
  const maxConnectors = port.maxConnectors ?? ENTERPRISE_CONNECTOR_MAX_CONNECTORS

  let spacesRaw: unknown
  try {
    spacesRaw = await readHostValue(() => readHostJson(PLATFORM_SPACE_LIST_PATH), 'space list', 'space-list-failed')
  } catch (error) {
    // ★受控码**原样穿透**：没登录时 `esc-route.ts` 交回来的是 `ENT_AUTH_REQUIRED`（⇒ 401），
    //   把"请先登录"折成本面那枚 503 是错的下一步（这是全仓同一条纪律：一个码一句话）。
    throw withStableCode(error) ?? plazaUnavailable('space-list-failed', 'the platform space list could not be read', error)
  }
  const listed = envelopeData(spacesRaw, 'space list', 'space-list-failed')
  if (!Array.isArray(listed)) {
    throw plazaUnavailable('space-list-failed', 'the platform space list is not an array')
  }
  const spaces = listed.map(entry => projectSpaceEntry(entry))
  const truncatedSpaces = spaces.length > maxSpaces
  const considered = truncatedSpaces ? spaces.slice(0, maxSpaces) : spaces

  const connectors: EnterpriseConnector[] = []
  const reported: EnterpriseConnectorSpace[] = []
  let succeeded = 0
  let truncatedConnectors = false
  let stoppedEarly = false
  /** 本次盘点里**第一枚**带受控码的上游失败（没登录 / 上游不可用…）：全失败时由它定状态，不埋在 503 里。 */
  let firstStableFailure: unknown
  for (const space of considered) {
    if (connectors.length >= maxConnectors) {
      // ★有界：到顶就不再查后面那些空间（少打无用的上游），`complete:false` 如实说出这件事。
      truncatedConnectors = true
      stoppedEarly = true
      break
    }
    // ★先整流投影成一份新数组再出厂：`projectConnectorRow` 抛错时这一批**一条都不出厂**（不做半批）。
    //   与"某个空间整批读不到"是同一种如实：宁可说这个空间这次没读到，也不给它半份列表。
    let batch: EnterpriseConnector[]
    let rows: unknown[]
    try {
      const raw = await readHostValue(
        () => readHostJson(platformSpaceMcpListPath(space.id)),
        `mcp list of space ${String(space.id)}`,
        'space-mcp-failed',
      )
      const data = envelopeData(raw, `mcp list of space ${String(space.id)}`, 'space-mcp-failed')
      if (!Array.isArray(data)) throw new TypeError('the platform MCP list is not an array')
      rows = data
      batch = rows.map(row => projectConnectorRow(row, space))
    } catch (error) {
      // ★受控码记下来（全失败时按它如实报状态）；形状类失败一律只影响这一个空间。
      firstStableFailure ??= withStableCode(error)
      reported.push({ id: space.id, name: space.name, ok: false, count: 0 })
      port.onError?.(`enterprise connector plaza: space ${String(space.id)} MCP list failed [step=space-mcp-failed]`, error)
      continue
    }
    succeeded += 1
    reported.push({ id: space.id, name: space.name, ok: true, count: rows.length })
    let cut = false
    for (const each of batch) {
      if (connectors.length >= maxConnectors) {
        truncatedConnectors = true
        cut = true
        break
      }
      connectors.push(each)
    }
    if (cut) break
  }

  if (succeeded === 0) {
    // ★**绝不静默回空列表**：一个空间都没成功 ⇒ 失败。上游自己带的受控码（没登录 / 不可用 / 超时）
    //   **原样上抛**（⇒ 401/502），其余情况才是本面那枚 503。
    throw firstStableFailure
      ?? plazaUnavailable('space-mcp-failed', 'every space MCP list could not be read')
  }
  return {
    connectors,
    complete: succeeded === considered.length && !stoppedEarly && !truncatedSpaces && !truncatedConnectors,
    spaces: reported,
  }
}

/**
 * 在 Harness `ctx.webServer` 上注册本机连接器广场的**只读**同源路由。
 *
 * 非 GET 一律 405 + `Allow: GET`（**零副作用**：方法不对时一次取数都不发生）；
 * 失败一律收敛成 `{error:{code}}` 并走 `enterpriseLocalErrorStatus` 那张唯一表（本面那枚码落表尾 503），
 * 同时经 `onError` 留判定点；异常绝不逃到 Cordis 顶层。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 见 {@link EnterpriseConnectorPlazaPort}（生产由组合层交同一个 `escReadPort` 的宿主内部读面）。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseConnectorPlazaRoute(
  webServer: WebServerRoutePort,
  port: EnterpriseConnectorPlazaPort,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      let status = 200
      let body: unknown
      try {
        body = { data: await readConnectorPlaza(port) }
      } catch (error) {
        status = enterpriseLocalErrorStatus(error)
        body = { error: { code: errorCodeOf(error) } }
        const step = error instanceof ConnectorPlazaError ? error.step : 'plaza-failed'
        port.onError?.(
          `enterprise connector plaza request projected to ${String(status)}`
            + ` [operation=GET ${ENTERPRISE_CONNECTOR_PLAZA_LOCAL_PATH} step=${step} status=${String(status)}]`,
          error,
        )
      }
      writeJson(response, status, body)
    },
  })
}
