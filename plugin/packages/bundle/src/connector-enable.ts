/**
 * [INPUT]: 依赖 node:crypto / node:fs/promises / node:path、platform-client 的 `resolveEnterpriseDshHome`，以及 `./plugin-install-port.js` 的官方 `ChangeResult` 投影（**不 import 任何 `@deepseek-ai/*` 的运行时值**）；**平台取数入口与官方安装面都由组合层注入**（本文件不碰 `fetch`、不持票据、不 spawn 任何子进程）
 * [OUTPUT]: 对外提供 Phase C D2「把一枚连接器启用到本机」的四段实现——①取配置 `readConnectorPlatformConfig`（平台那份 `mcpConfig.serverConfig` → 一条连接器事实）②合成 `renderConnectorBundle` / `synthesizeConnectorBundle`（配置型 bundle：`package.json` + `cordis.patch.yml`）③装卸 `createEnterpriseConnectorEnable`（`enable` / `disable` / `connection` / `busy`，唯一安装面 = 官方 `pluginManager`）④授权闸门（`connectorEnableFingerprint` / `connectorEnableDisclosure` + 三态）；以及官方管理面的形状闸门 `connectorEnablePortFromContext` / `officialConnectorEnablePort`、凭据落点 `connectorSecretPath` 与本事自己的码边界 `EnterpriseConnectorEnableError`。**HTTP 面那一刀补上的三个共用出口**（`enable` 与只读投影/「已连接的」盘点共用，见各自注释）：`readEnterpriseConnectorDisclosure`（①取配置那一段的**唯一**实现，写路由与只读 `status` 同一份披露/同一枚指纹）、`readConnectorOfficialBundles`（官方清单的唯一读点 + 形状折叠）、`connectorConnectionFrom`（`connected = installed && enabled` 这条判据的**唯一**纯实现）
 * [POS]: Phase C 连接器**纵深第二段**的宿主半边（口径 67 D2），与 D0/D1 的 `connector-plaza.ts` 并列：
 *   plaza 是**只读投影**（平台目录 → 浏览器安全格），本文件是**写入口**（平台一枚连接器 → 本机一条
 *   `@deepseek-ai/dsh-mcp-client` 行）。★本文件**自己**仍不碰 HTTP：本机路由名与响应形状由并列的
 *   `connector-enable-route.ts`（形状门禁 + 三条精确路由 + 一条 `<mcpId>/status` 前缀路由 + 「已连接的」
 *   盘点）与 `connector-enable-service.ts`（出 host 的脱敏投影）落地；本文件只为它们交出上面那三个
 *   共用出口，故**判定只有一处**、两条路由不可能对同一份官方状态给出两种说法。故本目录与 P0 那套
 *   `src/connector/*` **互不 import**。
 *
 *   ### ★为什么是「配置型 bundle + 官方 installBundle」而不是 profile patch / 运行时 `ctx.plugin()`
 *   这三条路都不是我拍的，是**取证结论**（`~/.sshwork/mcp-layer/REPORT.md` §①②）：
 *   ① **运行时 `ctx.plugin()` 挂一行**：`dsh-mcp-client` 把工具注册进 `ctx.tools`，而工具注册表 =
 *      `@deepseek-ai/dsh-tools` 的 `ScopedLayers`，**注册落在哪一层只由 `this.ctx` 决定**；host 组合根
 *      没有 scope 标签 ⇒ 我们在 `apply()` 里 `ctx.plugin()` 出来的实例落在 **global 层**（所有 agent 都看得见，
 *      语义其实是对的），但它的生命周期绑在**我们的插件实例**上：企业插件一旦被禁/被换，连接器无声消失，
 *      且「已连接」会变成「我们的插件在不在」。更要紧的是它**不是官方安装面**——官方规范只认一个安装面
 *      （`references/host-plugin.md:58`）。
 *   ② **写 profile 的 `cordis.patch.yml`**：那是**部署配置**（`dsh-web-app/cordis.patch.yml` 的注释逐字：
 *      「Edit cordis.patch.yml, not this file」），手写它等于绕开官方安装器、还要重启才生效，且
 *      `mcp-conformance.md` §2 把「bundle 自己的 patch ✅ / profile 的 ❌」列为**两条硬边界**之一。
 *   ③ **`<dshHome>/.agent-presets/<id>/` 目录**：官方原文「Nothing reads that directory any more」⇒ **已死**，
 *      本刀不许用它（报告 §0 的陷阱条目）。
 *   ⇒ 唯一记载的正确做法 = 合成一份**配置型 bundle**（`package.json` 带 `dsh.bundle.patch` + 同目录
 *      `cordis.patch.yml` insert 一条 `@deepseek-ai/dsh-mcp-client`），交给官方 `pluginManager.installBundle`
 *      （target = **绝对包目录**）；撤回 = `removeBundle`。官方模板逐字见 `docs/plan/mcp-conformance.md` §3。
 *
 *   ### ★为什么 `transport` 必须逐字写出来
 *   官方 `dsh-mcp-client` 的 `Config` 是一个**按 `transport` 判别的联合**（`z.const('stdio')` /
 *    `z.const('streamable-http')`，`lib/index.js:780-798`），而 `createTransport(config)` 的 `switch` **没有
 *   default 分支**（`lib/types/transport.js:38-45`）⇒ 任何 `transport` 不在那两支里的行都拿不到 transport。
 *   ★如实登记一处与交接口径的出入：交接里说「只给 url+headers 会过 schema 但 createTransport 返回
 *   undefined」，我读到的源码是**两道都在**（schema 那道就过不去，因为它要求 `transport` 在场）——
 *   但**结论一字不差**：不写 `transport` 就永远连不上（一道失败在 schema、一道失败在工厂），而
 *   `failOnStartupError: true` 让这一行**响亮失败**而不是「装好了但零工具」。
 *
 *   ### ★为什么 token 只进 0600 文件 + `!!js` 引用它
 *   官方只认一种合规写法：Loader `!!js` **引用**，绝不把 secret 抄进配置/对话文本
 *   （`mcp-bundle.md:5` 逐字）。但 `!!js` 的求值器是**同步**的（`new Function("ctx","expr",
 *   "with(ctx){return eval(expr)}")`，`cordis-plugin-loader/lib/index.js:233`），而官方凭据面
 *   `ctx.credentials.resolve` 是**异步**的 ⇒ 表达式里能用的只有**同步**读得到的东西。
 *   `process.env` 是既有的官方示例，但本部署**没有人**会把企业那枚 token 放进宿主进程环境
 *   （`docs/plan/mcp-marketplace-tab.md` §15 第 4 条把这件事列为「最大真前置」）；而
 *   `dsh-credentials-local` 明文自陈保管文件**永不物化进环境**（P0-3 的取证）。
 *   ⇒ 唯一能被同步读到、又完全由我们自己掌握 0600 权限的落点，就是
 *   `<dshHome>/enterprise/connector-secrets/<mcpId>.json`：patch 里只出现**那个文件的绝对路径**
 *   与一句 `!!js`（`process.getBuiltinModule("node:fs")`，不用 `require`；`getBuiltinModule` 不经过
 *   模块解析、也不受 `with(ctx)` 影响）。
 *   ★代价（如实登记）：这份 patch **只**把 `url` 留在文本里，`headers` 的值一个字节都不在文本里；
 *   `url` 本身若夹带 URL 内嵌凭据（`https://u:p@host/`）就会落进 patch 文本——冻结契约明确要求
 *   `url: <平台给的 url>` 逐字进 patch，故本刀**不自行加一条拒绝规则**（那会是自创契约），
 *   只把这条残余风险登记在此：凭据应当走 `headers`（平台的 `mcpConfig.serverConfig` 正是这个形状）。
 *
 *   ### ★「已连接」落哪：不新增第二本账
 *   已连接 = **官方管理面的状态**（`pluginManager.listBundles()` 里那条 bundle 在不在、启用没启用）
 *   ＋ 我们**按 bundle 名派生的 id**。本文件的 `connection()` 就是这条口径的唯一读点，**不维护**
 *   「连接器 → 状态」的真值文件：官方那份才是「行有没有挂上」的事实来源，我们再抄一份只会漂移。
 *   ⇒ 连带一条**语义后果**（如实登记）：因为不记账，「从没装过」与「已经卸干净了」在本机**不可区分**，
 *   故 `disable()` 对两者回同一个成功结果（`alreadyAbsent: true`），而不是像配方纵深那样回
 *   `ENT_RESOURCE_NOT_FOUND`——那需要一本我们刻意不要的账。
 *
 *   ### ★凭据为什么不在装机失败时回滚
 *   凭据文件是**就地覆盖**的（同目录临时件 + `rename`），旧值不可恢复；而同一个 mcpId 的**旧行可能还在跑**
 *   并引用这个路径 ⇒ 装机失败时删掉它，会把一个可能正在工作的连接器弄断（`failOnStartupError: true`
 *   会让它在下次重启时连行都激活不了）。故本刀**不**在失败路径上删凭据，只把失败如实上报；
 *   要收回凭据就走 `disable()`（那是唯一下令收回的地方）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import {
  isOfficialPluginManager,
  projectOfficialResult,
  type OfficialApplication,
  type OfficialApplicationKind,
  type OfficialBundleApplication,
  type OfficialPluginManagerLike,
  officialApplicationKind,
} from './plugin-install-port.js'

/* ══════════════════════════ ① 码边界（本面唯一一处稳定码） ══════════════════════════ */

/**
 * 本面可能抛出的**全部**稳定码；每一枚都对应一条真实会抛的边界（不预造没人抛的码）。
 *
 *  - `ENT_INVALID_REQUEST`：`mcpId` 不是平台的十进制 id（`^[0-9]{1,18}$`）。形状错在**入口**就止，
 *    绝不拿一个可疑字符串去拼平台路径（与 `esc-route.ts` 的参数段判据同一条尺）。
 *  - `ENT_CONNECTOR_CONFIG_UNAVAILABLE`：★**这次没读到**平台那枚连接器配置（读面抛了无码的错）。
 *    下一步 = 重试。★上游自己带的**受控码**（`ENT_AUTH_REQUIRED` / `ENT_NUWAX_*` 那族）**原样上抛**——
 *    它们的状态由 `enterpriseLocalErrorStatus` 那张唯一表定死（401/403/502），折成「本机不可用」
 *    会把用户引向错的下一步（没登录时该说「请先登录」）。
 *  - `ENT_CONNECTOR_CONFIG_INVALID`：★**读回来了但读不懂**（信封不是信封 / `mcpServers` 不是一个对象 /
 *    那条 `serverName` 不在 / `url` 非 http(s) / 头值不是字符串）。下一步 = 找管理员（重试无用）。
 *    ★它为什么与上一枚**分开**：两枚的下一步不同（重试 vs 追溯平台那条记录），这正是本仓
 *    「一枚码一句话」的判据；形状读不懂时**绝不猜、绝不拼**一条看起来能跑的配置。
 *  - `ENT_CONNECTOR_AUTHORIZATION_REQUIRED`：这台连接器**从没**被本机确认过（没有授权记录，调用方也没交来
 *    与当前披露逐字相等的指纹）。下一步 = 先看披露再确认。
 *  - `ENT_CONNECTOR_AUTHORIZATION_STALE`：本机有记录，但它**盖不住当前这份披露**（平台那条记录的
 *    id/name/serverName/url/host/是否需要凭据变了），**或者**调用方交来的指纹与当前披露不一致。
 *    下一步 = 重新看披露再确认。
 *    ★两枚都**先于任何落盘**：授权没过 ⇒ 零落盘、零安装（本刀最硬的一条闸门）。
 *  - `ENT_CONNECTOR_STATE_INVALID`：本机状态读不懂——授权状态文件损坏 / 字段形状不符，
 *    **或**官方 `listBundles()` 交回的东西不是一张表。下一步 = 本机这块先别动（fail-closed），
 *    绝不按「空清单」继续装第二遍、也绝不假装「没装过」。
 *  - `ENT_CONNECTOR_LOCAL_WRITE_FAILED`：本机写不动（合成落盘 / 凭据文件写）——`step` 在 Host 日志里
 *    区分 `bundle-write` 与 `secret-write`。★凭据那一格与制品那一格**共用一枚码**，因为对员工的
 *    下一步完全相同（重试；仍然失败找管理员），而**归属**这层信息由 `step` 承担（本仓
 *    「一个码一句话、下一步相同就不拆」的既有判据）。
 *  - `ENT_CONNECTOR_INSTALL_IN_PROGRESS`：同一个 mcpId 正在装/卸，再点**拒绝**而不排队（与配方纵深同一条纪律）。
 *  - `ENT_CONNECTOR_INSTALL_FAILED`：官方安装面抛错，或官方**自己**回 `application: 'failed'`
 *    （两种收敛到同一枚码：界面文案相同、原因只进 `onError` 日志）。
 *  - `ENT_CONNECTOR_INSTALL_CANCELLED`：官方回 `cancelled`（用户/宿主在安装途中取消）——它不是失败，单独一枚。
 *  - `ENT_CONNECTOR_UNINSTALL_FAILED`：官方 `removeBundle` 抛错/回 failed/cancelled，**或**装完了但那枚
 *    秘密文件删不掉。★后者**必须抛、不许静默**：留着它就等于「已断开但凭据还在」，下一次启用会拿着
 *    一份属于旧披露的凭据去连。
 */
export type EnterpriseConnectorEnableErrorCode =
  | 'ENT_INVALID_REQUEST'
  | 'ENT_CONNECTOR_CONFIG_UNAVAILABLE'
  | 'ENT_CONNECTOR_CONFIG_INVALID'
  | 'ENT_CONNECTOR_AUTHORIZATION_REQUIRED'
  | 'ENT_CONNECTOR_AUTHORIZATION_STALE'
  | 'ENT_CONNECTOR_STATE_INVALID'
  | 'ENT_CONNECTOR_LOCAL_WRITE_FAILED'
  | 'ENT_CONNECTOR_INSTALL_IN_PROGRESS'
  | 'ENT_CONNECTOR_INSTALL_FAILED'
  | 'ENT_CONNECTOR_INSTALL_CANCELLED'
  | 'ENT_CONNECTOR_UNINSTALL_FAILED'

/** 判定点：只进 Host 日志（`onError`），**不进响应体**——员工看到的是同一句话，排障的人靠它分段。 */
export type EnterpriseConnectorEnableStep =
  | 'platform-read'
  | 'envelope'
  | 'config'
  | 'authorization-read'
  | 'authorization-write'
  | 'bundle-write'
  | 'secret-write'
  | 'official-state'
  | 'install'
  | 'uninstall'
  | 'secret-delete'

/** 本面唯一的失败形态：只携带稳定 `code`（+ 只进日志的 `step`），与全仓同约定。 */
export class EnterpriseConnectorEnableError extends Error {
  constructor(
    readonly code: EnterpriseConnectorEnableErrorCode,
    message: string,
    readonly step: EnterpriseConnectorEnableStep,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'EnterpriseConnectorEnableError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

function connectorError(
  code: EnterpriseConnectorEnableErrorCode,
  step: EnterpriseConnectorEnableStep,
  message: string,
  cause?: unknown,
): EnterpriseConnectorEnableError {
  return new EnterpriseConnectorEnableError(code, message, step, cause)
}

function badRequest(message: string): EnterpriseConnectorEnableError {
  return connectorError('ENT_INVALID_REQUEST', 'config', message)
}

/* ══════════════════════════ 通用形状与常量 ══════════════════════════ */

/** 平台连接器 id 的形状（与 `esc-route.ts` 的参数段同一条尺：1..18 位**十进制**，`\d` 不用）。 */
export const CONNECTOR_MCP_ID_PATTERN = /^[0-9]{1,18}$/

/** 官方 `serverName` 的取值域（`dsh-mcp-client` 的 `Config`：`[A-Za-z0-9_-]{1,32}`）。 */
export const MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** 官方 MCP 客户端包名（本 bundle 的 patch 只 insert 这一条）。 */
export const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client'

/**
 * 本面**唯一**的传输：平台那枚连接的 `installType` 实测是 `STREAMABLE_HTTP`（报告 §5③：39/51），
 * 且官方只有 `stdio` / `streamable-http` 两支（**没有** sse）。
 */
export const CONNECTOR_TRANSPORT = 'streamable-http'

/** bundle 包名（官方模板 `templates/mcp/package.json` 的 `@local/` 形态；一个连接器一个包名）。 */
export const CONNECTOR_BUNDLE_PACKAGE_PREFIX = '@local/dsent-connector-'

/** 合成物版本：只进我们自己的 `package.json`（官方模板也是 `1.0.0`）。 */
export const CONNECTOR_BUNDLE_VERSION = '1.0.0'

/** 合成落根（`<dshHome>` 下，与配方纵深的 `enterprise/preset-bundles` 同级同形）。 */
export const CONNECTOR_BUNDLE_ROOT_SEGMENTS = ['enterprise', 'connector-bundles'] as const

/** 凭据落根（本刀要害：token 只进这里，绝不进 patch 文本）。 */
export const CONNECTOR_SECRET_ROOT_SEGMENTS = ['enterprise', 'connector-secrets'] as const

/** 授权状态落根（与配方纵深的 `enterprise/preset-authorizations` 同级同形）。 */
export const CONNECTOR_AUTHORIZATION_ROOT_SEGMENTS = ['enterprise', 'connector-authorizations'] as const

/** 授权状态文件名。 */
export const CONNECTOR_AUTHORIZATION_FILENAME = 'authorizations.json'

/** 合成物里**恰好**这两个文件；顺序即磁盘上应有的全集。 */
export const CONNECTOR_BUNDLE_FILENAMES = ['cordis.patch.yml', 'package.json'] as const

/** 目录 0o700 / 文件 0o600（与 `nuwax-session.json` / `skill-installs/*.json` 那三份同构）。 */
export const CONNECTOR_SECRET_DIR_MODE = 0o700
export const CONNECTOR_SECRET_FILE_MODE = 0o600

/** 有界常量（每一项都是「上限的上限」，不是我们打算真的用到的量）。 */
export const CONNECTOR_MAX_NAME_LENGTH = 120
export const CONNECTOR_MAX_URL_LENGTH = 2048
export const CONNECTOR_MAX_HEADERS = 32
export const CONNECTOR_MAX_HEADER_NAME_LENGTH = 64
export const CONNECTOR_MAX_HEADER_VALUE_LENGTH = 8192

const HEADER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,63}$/
const HEX64_PATTERN = /^[0-9a-f]{64}$/
const FINGERPRINT_DOMAIN = 'dsh-ent-connector-enable/v1'
const BUNDLE_DIGEST_DOMAIN = 'dsh-ent-connector-enable-bundle/v1'
const CODE_SHAPE = /^ENT_[A-Z0-9_]{1,64}$/

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/** 只认异常**真的携带**的字符串 `code`（没有就是没有，绝不兜底）。 */
function carriedCodeOf(error: unknown): string | undefined {
  const code: unknown = (error as { readonly code?: unknown } | null | undefined)?.code
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/** `mcpId` 的唯一收窄点：形状不对 ⇒ `ENT_INVALID_REQUEST`（入口即止，绝不拼路径）。 */
export function requireConnectorMcpId(value: unknown): string {
  if (typeof value !== 'string' || !CONNECTOR_MCP_ID_PATTERN.test(value)) {
    throw badRequest('connector id must be the platform decimal id (1..18 digits)')
  }
  return value
}

/* ══════════════════════════ 命名与落点（纯函数） ══════════════════════════ */

/** bundle 包名：`@local/dsent-connector-<mcpId>`。 */
export function connectorBundlePackageName(mcpId: string): string {
  return `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}${requireConnectorMcpId(mcpId)}`
}

/** Loader row id：`connector-<mcpId>`（一个条目 = 一个服务器，故 id 进 row id）。 */
export function connectorRowId(mcpId: string): string {
  return `connector-${requireConnectorMcpId(mcpId)}`
}

/** 平台详情路径（**宿主自己拼**：数字段来自已收窄的 mcpId，故没有可注入的输入）。 */
export function connectorPlatformDetailPath(mcpId: string): string {
  return `/api/mcp/${requireConnectorMcpId(mcpId)}`
}

/** 模型看到的工具名前缀（`mcp__<serverName>__`，官方不可逆契约）。 */
export function connectorToolNamePrefix(serverName: string): string {
  return `mcp__${serverName}__`
}

export interface ConnectorEnableStateOptions {
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  readonly env?: NodeJS.ProcessEnv
}

/** 合成落根：`<dshHome>/enterprise/connector-bundles`。 */
export function connectorBundleRoot(options: ConnectorEnableStateOptions = {}): string {
  return join(resolveEnterpriseDshHome(options), ...CONNECTOR_BUNDLE_ROOT_SEGMENTS)
}

/** 凭据落根：`<dshHome>/enterprise/connector-secrets`。 */
export function connectorSecretRoot(options: ConnectorEnableStateOptions = {}): string {
  return join(resolveEnterpriseDshHome(options), ...CONNECTOR_SECRET_ROOT_SEGMENTS)
}

/**
 * 一条连接器的合成落点：`<bundleRoot>/<mcpId>/<内容摘要>`。
 *
 * ★为什么带摘要那一层：官方纪律是「失败时**修同一个** bundle，不要造重复的」
 * （`mcp-bundle.md:5`）——同一 mcpId 的**同一份配置**因此恒落到同一目录（幂等、可枚举），
 * 配置真的变了才有第二个目录，而这两个目录的服务名相同，后者会替换前者的行。
 */
export function connectorBundleDirectory(
  options: ConnectorEnableStateOptions,
  mcpId: string,
  digest: string,
): string {
  return join(connectorBundleRoot(options), requireConnectorMcpId(mcpId), requireDigest(digest))
}

/** 一枚 64 位十六进制摘要（`mcpId` 之外的第二个不许出域的入参）。 */
function requireDigest(value: unknown): string {
  if (typeof value !== 'string' || !HEX64_PATTERN.test(value)) {
    throw badRequest('connector bundle digest must be a sha256 hex digest')
  }
  return value
}

/** 那枚秘密文件的绝对路径（`<dshHome>/enterprise/connector-secrets/<mcpId>.json`）。 */
export function connectorSecretPath(options: ConnectorEnableStateOptions, mcpId: string): string {
  return join(connectorSecretRoot(options), `${requireConnectorMcpId(mcpId)}.json`)
}

/** 授权状态文件路径。 */
export function connectorAuthorizationPath(options: ConnectorEnableStateOptions = {}): string {
  return join(resolveEnterpriseDshHome(options), ...CONNECTOR_AUTHORIZATION_ROOT_SEGMENTS, CONNECTOR_AUTHORIZATION_FILENAME)
}

/* ══════════════════════════ ② 取配置（平台那份制品面） ══════════════════════════ */

/**
 * 一条连接器**在本机落地**所需要的全部事实（都是平台那份配置的直译，没有一处是我们编的）。
 *
 * `headers` 是**凭据本体**（值可能是 token）⇒ 它只允许进那枚 0600 文件，**永不进 patch 文本**。
 */
export interface ConnectorPlatformConfig {
  readonly mcpId: string
  /** 平台行里的显示名（员工看到的只有这个，不是 `serverName`）。 */
  readonly name: string
  /** 平台那份配置里**那一条** `mcpServers` 的键名（本地命名空间，工具名的组成部分）。 */
  readonly serverName: string
  readonly url: string
  /** 平台给了头就原样收下（string→string）；平台没给就**没有这个键**（= 这台连接器不需要凭据）。 */
  readonly headers?: Readonly<Record<string, string>>
}

/**
 * **纯函数**：平台信封 → 一条连接器事实。形状读不懂一律抛，**绝不猜、绝不拼**。
 *
 * 判据逐条（左边是输入形态，右边是为什么拒）：
 *
 * | 输入 | 判定 |
 * |---|---|
 * | 信封不是「带 `code` 的对象」 | 拒（与 `esc-route.ts` 的 `parseEnvelope` 同一判据） |
 * | `data` 不是对象 | 拒（详情行的形状没读到） |
 * | `data.id` 缺席或不等于请求的 mcpId | 拒（平台回了**另一条**记录，绝不能拿它落地） |
 * | `data.name` 不是 1..120 的非空字符串 | 拒（连接器没有名字就没法告诉员工他在启用什么） |
 * | `data.mcpConfig` 不是对象 / `serverConfig` 不是字符串 | 拒（那正是本刀的制品面） |
 * | `serverConfig` 解不出 JSON | 拒（**不猜**） |
 * | `mcpServers` 不是一个对象 / 条目数 ≠ 1 | 拒（一个连接器一个名字；多条目时我们**无权挑一条**） |
 * | 那一条的值不是对象 / `url` 非 1..2048 的 http(s) | 拒 |
 * | `headers` 在场但不是 string→string 的映射 | 拒（值不是字符串 ⇒ 形状读不懂） |
 *
 * ★`headers` **缺席**是合法的，而且它与「`headers: {}`」是**同一个事实**：这台连接器不需要凭据
 *   ⇒ 不写凭据文件、patch 里也不出现 `headers:` 那一行。
 *
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_CONFIG_INVALID`（每一处都有独立 `step`）
 */
export function readConnectorPlatformConfig(envelope: unknown, mcpId: string): ConnectorPlatformConfig {
  const id = requireConnectorMcpId(mcpId)
  const wrapper = asRecord(envelope)
  if (wrapper === undefined || wrapper['code'] === undefined) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'envelope', 'the platform answered something that is not an envelope')
  }
  const data = asRecord(wrapper['data'])
  if (data === undefined) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform answered a connector detail without a row object')
  }
  if (String(data['id']) !== id) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform answered a connector row that is not the requested one')
  }
  const name = data['name']
  if (typeof name !== 'string' || name.length === 0 || name.length > CONNECTOR_MAX_NAME_LENGTH) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform answered a connector row without a usable display name')
  }
  const mcpConfig = asRecord(data['mcpConfig'])
  const serverConfig = mcpConfig === undefined ? undefined : mcpConfig['serverConfig']
  if (typeof serverConfig !== 'string') {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform answered a connector row without mcpConfig.serverConfig')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(serverConfig) as unknown
  } catch (error) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform serverConfig is not valid JSON', error)
  }
  const root = asRecord(parsed)
  const servers = root === undefined ? undefined : asRecord(root['mcpServers'])
  if (servers === undefined) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform serverConfig does not hold an mcpServers object')
  }
  const names = Object.keys(servers)
  if (names.length !== 1) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform serverConfig must name exactly one server')
  }
  const serverName = names[0] as string
  if (!MCP_SERVER_NAME_PATTERN.test(serverName)) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform serverName does not fit the official domain')
  }
  const entry = asRecord(servers[serverName])
  if (entry === undefined) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform server entry is not an object')
  }
  const url = entry['url']
  if (typeof url !== 'string' || url.length === 0 || url.length > CONNECTOR_MAX_URL_LENGTH) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform server entry has no usable url')
  }
  if (!/^https?:\/\//.test(url)) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform url must be an http(s) URL')
  }
  const headers = readPlatformHeaders(entry['headers'])
  return Object.freeze({
    mcpId: id,
    name,
    serverName,
    url,
    ...(headers === undefined ? {} : { headers }),
  })
}

/**
 * `headers` 的**唯一**收窄点：要么没有（= 不需要凭据），要么是 string→string 的有界映射。
 *
 * ★空映射与缺席**归一成同一个事实**（没有凭据）：「平台给了一个空对象」与「平台没给」对这条连接器
 *   是同一件事（一个头都送不出去），不给它们造两种落盘形态。
 * ★本函数**不判**值的语义（不看它像不像 token）：平台是凭据内容的权威，我们只管形状。
 */
function readPlatformHeaders(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined
  const raw = asRecord(value)
  if (raw === undefined) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform server headers are not an object')
  }
  const names = Object.keys(raw)
  if (names.length === 0) return undefined
  if (names.length > CONNECTOR_MAX_HEADERS) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform server headers are too many')
  }
  const headers: Record<string, string> = {}
  for (const headerName of names) {
    if (!HEADER_NAME_PATTERN.test(headerName) || headerName.length > CONNECTOR_MAX_HEADER_NAME_LENGTH) {
      throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform server header name is not a valid header name')
    }
    const headerValue = raw[headerName]
    if (typeof headerValue !== 'string' || headerValue.length > CONNECTOR_MAX_HEADER_VALUE_LENGTH) {
      throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform server header value is not a usable string')
    }
    headers[headerName] = headerValue
  }
  return Object.freeze(headers)
}

/* ══════════════════════════ ③ 授权闸门（披露指纹 = 纯函数） ══════════════════════════ */

/**
 * 弹层要逐项列出的披露数据——**它就是指纹的输入**，多一格少一格都要两边一起改。
 *
 * ★这里**没有、也永远不会有**头值/凭据值：披露是给员工看「我要把什么挂到本机」，而凭据本身
 *   在披露里只需要回答「需不需要」。
 */
export interface ConnectorEnableDisclosure {
  readonly mcpId: string
  readonly name: string
  readonly serverName: string
  readonly url: string
  /** URL 的 host（单列一格：换域等于换了一台服务器，即便 url 路径没变也要重新确认）。 */
  readonly host: string
  /** 这台连接器要不要凭据（= 平台给了头）。 */
  readonly credentials: boolean
}

/** 由平台那份配置派生出披露（纯函数；`url` 解析不出 host ⇒ 拒）。 */
export function connectorEnableDisclosure(config: ConnectorPlatformConfig): ConnectorEnableDisclosure {
  let host: string
  try {
    host = new URL(config.url).host
  } catch (error) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform url could not be parsed', error)
  }
  if (host.length === 0) {
    throw connectorError('ENT_CONNECTOR_CONFIG_INVALID', 'config', 'the platform url has no host')
  }
  return Object.freeze({
    mcpId: config.mcpId,
    name: config.name,
    serverName: config.serverName,
    url: config.url,
    host,
    credentials: config.headers !== undefined,
  })
}

/**
 * 披露指纹（**纯函数**）：只吃能改变「会被挂到本机的是什么」的身份，不吃任何凭据值。
 *
 * ⇒ 平台轮换 token（只有头值变）时指纹**不变** ⇒ 不重新打扰员工（那是同一台服务器、同一份披露），
 *   但本刀仍会把新的头写进那枚 0600 文件并让官方重装一次，让新凭据真正生效。
 * ⇒ 换 serverName / 换 url / 换 host / 从「要凭据」变成「不要凭据」/ 平台把这条改名 ⇒ 指纹必变 ⇒ 重新确认。
 */
export function connectorEnableFingerprint(disclosure: ConnectorEnableDisclosure): string {
  const canonical = JSON.stringify({
    credentials: disclosure.credentials,
    host: disclosure.host,
    mcpId: disclosure.mcpId,
    name: disclosure.name,
    serverName: disclosure.serverName,
    url: disclosure.url,
  })
  return createHash('sha256').update(`${FINGERPRINT_DOMAIN}\n`).update(canonical).digest('hex')
}

/** 授权三态（与配方纵深同一套词）：从未授权 / 当前指纹已授权 / 授权过但指纹已变。 */
export type ConnectorAuthorizationState = 'needs-authorization' | 'authorized' | 'fingerprint-changed'

/** 一条本机授权记录；只保存脱敏事实（mcpId、指纹、授权时间）。 */
export interface ConnectorAuthorizationRecord {
  readonly mcpId: string
  readonly fingerprint: string
  readonly authorizedAt: string
}

/** 严格读授权状态；文件不存在是合法空状态，损坏一律 fail-closed（**不当成空清单覆盖**）。 */
export async function readConnectorAuthorizations(
  options: ConnectorEnableStateOptions = {},
): Promise<readonly ConnectorAuthorizationRecord[]> {
  let text: string
  try {
    text = await readFile(connectorAuthorizationPath(options), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'authorization-read', 'connector authorization state could not be read', error)
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'authorization-read', 'connector authorization state is not valid JSON', error)
  }
  const root = asRecord(value)
  if (root === undefined || Object.keys(root).join(',') !== 'records' || !Array.isArray(root['records'])) {
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'authorization-read', 'connector authorization state has an invalid shape')
  }
  const records: ConnectorAuthorizationRecord[] = []
  for (const item of root['records'] as unknown[]) {
    const row = asRecord(item)
    if (row === undefined
      || Object.keys(row).sort().join(',') !== 'authorizedAt,fingerprint,mcpId'
      || typeof row['mcpId'] !== 'string' || !CONNECTOR_MCP_ID_PATTERN.test(row['mcpId'])
      || typeof row['fingerprint'] !== 'string' || !HEX64_PATTERN.test(row['fingerprint'])
      || typeof row['authorizedAt'] !== 'string' || !Number.isFinite(Date.parse(row['authorizedAt']))) {
      throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'authorization-read', 'connector authorization record has invalid fields')
    }
    records.push({ mcpId: row['mcpId'], fingerprint: row['fingerprint'], authorizedAt: row['authorizedAt'] })
  }
  return records
}

/** 原子写授权状态：同目录临时件 + `rename`（与 `preset/authorization.ts` 同一套纪律）。 */
async function writeConnectorAuthorizations(
  options: ConnectorEnableStateOptions & { readonly now?: () => Date },
  records: readonly ConnectorAuthorizationRecord[],
): Promise<void> {
  const path = connectorAuthorizationPath(options)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true, mode: CONNECTOR_SECRET_DIR_MODE })
    await writeFile(temporary, JSON.stringify({ records }), { encoding: 'utf8', mode: CONNECTOR_SECRET_FILE_MODE })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'authorization-write', 'connector authorization state could not be written', error)
  }
}

/**
 * 授权闸门的**唯一**实现（`enable` 与未来的服务层共用同一份判定，绝不各写一套）。
 *
 * 逐条语义（这是本刀最要紧的一段，交接里的三态口径就在这里）：
 *  ① 调用方交来的 `confirmFingerprint` 与当前披露指纹**逐字相等** ⇒ 写授权（覆盖同 mcpId 的旧指纹）并放行。
 *  ② 调用方交了指纹但**不相等** ⇒ 拒 `ENT_CONNECTOR_AUTHORIZATION_STALE`（他确认的是**另一份**披露，
 *     绝不能拿它当这一份的许可），**一个字都不落盘**。
 *  ③ 调用方没交指纹，但本机记录里的指纹与当前披露逐字相等 ⇒ 放行（同一个人确认过同一份披露，
 *     重新打扰他只是噪声）——这条正是「同一 mcpId 再启用」能拿到幂等结果的原因。
 *  ④ 调用方没交指纹、本机也没有记录 ⇒ 拒 `_AUTHORIZATION_REQUIRED`。
 *  ⑤ 调用方没交指纹、记录指纹已变 ⇒ 拒 `_AUTHORIZATION_STALE`。
 */
async function resolveConnectorAuthorization(
  options: ConnectorEnableStateOptions & { readonly now?: () => Date },
  disclosure: ConnectorEnableDisclosure,
  confirmFingerprint: unknown,
): Promise<string> {
  const fingerprint = connectorEnableFingerprint(disclosure)
  const records = await readConnectorAuthorizations(options)
  const existing = records.find(item => item.mcpId === disclosure.mcpId)
  if (confirmFingerprint !== undefined) {
    if (confirmFingerprint !== fingerprint) {
      throw connectorError(
        'ENT_CONNECTOR_AUTHORIZATION_STALE',
        'authorization-read',
        'the confirmed fingerprint does not match the current connector disclosure',
      )
    }
    const authorizedAt = (options.now ?? (() => new Date()))().toISOString()
    const kept = records.filter(item => item.mcpId !== disclosure.mcpId)
    kept.push({ mcpId: disclosure.mcpId, fingerprint, authorizedAt })
    kept.sort((left, right) => left.mcpId.localeCompare(right.mcpId))
    await writeConnectorAuthorizations(options, kept)
    return fingerprint
  }
  if (existing === undefined) {
    throw connectorError(
      'ENT_CONNECTOR_AUTHORIZATION_REQUIRED',
      'authorization-read',
      'this connector has never been confirmed on this machine',
    )
  }
  if (existing.fingerprint !== fingerprint) {
    throw connectorError(
      'ENT_CONNECTOR_AUTHORIZATION_STALE',
      'authorization-read',
      'this connector disclosure changed since it was confirmed on this machine',
    )
  }
  return fingerprint
}

/* ══════════════════════════ ④ 合成段（配置型 bundle + 凭据文件） ══════════════════════════ */

/** 合成结果：两个文件的正文 + 身份 + 稳定摘要 + 凭据落点。 */
export interface RenderedConnectorBundle {
  readonly mcpId: string
  readonly packageName: string
  readonly rowId: string
  readonly serverName: string
  readonly packageJson: string
  readonly cordisPatch: string
  readonly digest: string
  readonly toolNamePrefix: string
  /** 需要凭据时才在场：patch 里那句 `!!js` 读的就是这个绝对路径。 */
  readonly secretPath?: string
}

/**
 * 凭据文件里**逐字冻结三键**的正文（`headers` 是那枚 0600 文件里唯一被 patch 读到的部分）。
 *
 * ★另外两键（`mcpId` / `serverName`）不是给 loader 用的，是**给人看的**：一份落在盘上的凭据文件
 *   必须能自证「我是谁的、为哪台服务器留的」，否则排障时只能靠文件名猜。
 */
export interface ConnectorSecretFile {
  readonly mcpId: string
  readonly serverName: string
  readonly headers: Readonly<Record<string, string>>
}

function serializeConnectorSecret(secret: ConnectorSecretFile): string {
  return JSON.stringify({ mcpId: secret.mcpId, serverName: secret.serverName, headers: secret.headers })
}

/**
 * 那句 `!!js`（**唯一**的凭据引用写法，照官方先例 `README:43` / `:52` 的形态）。
 *
 * 逐条说明：
 *  · 用 `process.getBuiltinModule("node:fs")` 而**不是** `require`：官方用 `new Function("ctx","expr",
 *    "with(ctx){return eval(expr)}")` 求值（`cordis-plugin-loader/lib/index.js:233`），`require` 在那里
 *    不是一个受支持的入口，而 `getBuiltinModule` 不经过模块解析、也不受 `with(ctx)` 影响。
 *  · 路径用 `JSON.stringify` 嵌进去：路径里出现 `"` 或 `\` 也不会把表达式拆坏。
 *  · 整句是一个**表达式**（IIFE），因为 loader 求的就是一个表达式，不是一个语句块。
 *  · **不做**任何兜底（文件不在就让它抛）：`failOnStartupError: true` 的取义就是「连不上要响亮失败，
 *    不许装作已连接」。
 */
function credentialHeadersExpression(secretPath: string): string {
  return `!!js (() => JSON.parse(process.getBuiltinModule("node:fs").readFileSync(${JSON.stringify(secretPath)}, "utf8")).headers)()`
}

/**
 * **纯函数**：把一条连接器渲染成恰好两个文件的完整正文。
 *
 * | 产物 | 取值 | 出处 |
 * |---|---|---|
 * | `package.json.name` | `@local/dsent-connector-<mcpId>` | 官方模板 `templates/mcp/package.json` 的 `@local/` 形态 |
 * | `package.json.version` | `1.0.0` | 官方模板逐字 |
 * | `package.json.dsh.bundle.patch` | `./cordis.patch.yml` | 官方模板逐字 |
 * | patch `id` | `connector-<mcpId>` | 一条条目 = 一个服务器 |
 * | patch `name` | `@deepseek-ai/dsh-mcp-client` | 官方模板逐字 |
 * | `config.serverName` | 平台那一条的键名 | 官方要求 `[A-Za-z0-9_-]{1,32}` 且作用域内唯一 |
 * | `config.transport` | `streamable-http` | ★必须写：不写就永远连不上（见文件头部） |
 * | `config.url` | 平台给的 url | 冻结契约 |
 * | `config.headers` | **只有** `!!js` 读那枚 0600 文件的绝对路径 | `mcp-conformance.md` §4.7（明文一律拒） |
 * | `config.failOnStartupError` | 恒 `true` | 连不上要响亮失败（官方模板也是 `true`） |
 *
 * 未写的官方字段（`toolCallTimeoutMs` / `maxInstructionBytes` / `reconnect.*`）一律**不写**，
 * 让官方默认值生效——企业侧不复制官方默认值，免得官方改了默认我们还钉着旧数。
 */
export function renderConnectorBundle(
  config: ConnectorPlatformConfig,
  secretPath: string,
): RenderedConnectorBundle {
  const mcpId = requireConnectorMcpId(config.mcpId)
  const needsCredentials = config.headers !== undefined
  const configLines = [
    `        serverName: ${config.serverName}`,
    `        transport: ${CONNECTOR_TRANSPORT}`,
    `        url: ${yamlScalar(config.url)}`,
    ...(needsCredentials ? [`        headers: ${credentialHeadersExpression(secretPath)}`] : []),
    '        failOnStartupError: true',
  ]
  const cordisPatch = [
    `# generated by dshent connector enable: one ${MCP_CLIENT_MODULE} row for connector ${mcpId}.`,
    '# 字段契约见 docs/plan/mcp-conformance.md §4；请勿手改（改 serverName = 改工具名，会作废会话历史与权限规则）。',
    '- insert:',
    `    - id: ${connectorRowId(mcpId)}`,
    `      name: '${MCP_CLIENT_MODULE}'`,
    '      config:',
    ...configLines,
    '',
  ].join('\n')
  const packageJson = `${JSON.stringify({
    name: connectorBundlePackageName(mcpId),
    version: CONNECTOR_BUNDLE_VERSION,
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2)}\n`
  return Object.freeze({
    mcpId,
    packageName: connectorBundlePackageName(mcpId),
    rowId: connectorRowId(mcpId),
    serverName: config.serverName,
    packageJson,
    cordisPatch,
    digest: connectorBundleDigest(packageJson, cordisPatch),
    toolNamePrefix: connectorToolNamePrefix(config.serverName),
    ...(needsCredentials ? { secretPath } : {}),
  })
}

/** 两个文件正文的稳定摘要：同一 mcpId + 同一配置 ⇒ 同一目录（「修同一个 bundle，不重复建」）。 */
export function connectorBundleDigest(packageJson: string, cordisPatch: string): string {
  return createHash('sha256')
    .update(`${BUNDLE_DIGEST_DOMAIN}\n`)
    .update(packageJson)
    .update('\u0000')
    .update(cordisPatch)
    .digest('hex')
}

/** 把 YAML 纯量安全地写进块上下文：能裸写就裸写，否则退化成双引号 JSON 标量（与配方纵深同一把尺）。 */
function yamlScalar(value: string): string {
  if (value.length > 0
    && !/[\n\r\t]/.test(value)
    && /^[^\s\-?:,[\]{}#&*!|>'"%@`]/.test(value)
    && !/[:#]\s/.test(value)
    && !/:\s*$/.test(value)) {
    return value
  }
  return JSON.stringify(value)
}

/**
 * 落盘合成：**幂等、原子、可枚举**（与 `synthesizePresetBundle` 同一套纪律，不另造第二套）。
 *
 * 同一摘要目录已存在且逐字节相同 ⇒ 直接复用，不重写；写盘走 `<declRoot>/.staging-<uuid>` + `rename`，
 * 并做 realpath 等式（落根 / 连接器目录 / 摘要目录），最后再按真实路径复核一次「没跑出落根」。
 *
 * ★本函数**只写我们自己的落根**：`<DSH_HOME>/profiles/<name>/` 之下的那两个文件由官方
 *   `installBundle` 负责，手写它们就是违规（`mcp-conformance.md` §2 的第 1 条硬边界）。
 *
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_LOCAL_WRITE_FAILED`（`step=bundle-write`）
 */
export async function synthesizeConnectorBundle(
  options: ConnectorEnableStateOptions,
  rendered: RenderedConnectorBundle,
): Promise<string> {
  const home = resolveEnterpriseDshHome(options)
  const root = connectorBundleRoot(options)
  try {
    // `home` 可能经符号链接（Android 上 `/data/user/0` ↔ `/data/data`），故等式一律 realpath 比 realpath。
    await mkdir(home, { recursive: true, mode: CONNECTOR_SECRET_DIR_MODE })
    const realHome = await realpath(home)
    await mkdir(root, { recursive: true, mode: CONNECTOR_SECRET_DIR_MODE })
    const realRoot = await realpath(root)
    if (realRoot !== join(realHome, ...CONNECTOR_BUNDLE_ROOT_SEGMENTS)) {
      throw new Error('connector bundle root escapes the harness home')
    }
    const declRoot = join(root, rendered.mcpId)
    await mkdir(declRoot, { recursive: true, mode: CONNECTOR_SECRET_DIR_MODE })
    const realDeclRoot = await realpath(declRoot)
    if (realDeclRoot !== join(realRoot, rendered.mcpId)) {
      throw new Error('connector bundle directory escapes the bundle root')
    }
    const target = join(realDeclRoot, rendered.digest)
    const existing = await readBundleDirectory(target)
    if (existing !== undefined) {
      if (existing.packageJson !== rendered.packageJson || existing.cordisPatch !== rendered.cordisPatch) {
        throw new Error('connector bundle digest directory holds different bytes')
      }
      // ★已存在的那份也要过**同一道** realpath 等式：摘要目录若被换成符号链接，读到的就是别处的字节。
      const realExisting = await realpath(target)
      if (realExisting !== join(realDeclRoot, rendered.digest) || !realExisting.startsWith(realRoot + sep)) {
        throw new Error('connector bundle digest directory failed the realpath equality check')
      }
      return realExisting
    }
    const staging = join(realDeclRoot, `.staging-${randomUUID()}`)
    await mkdir(staging, { recursive: false, mode: CONNECTOR_SECRET_DIR_MODE })
    try {
      await writeFile(join(staging, 'package.json'), rendered.packageJson, { encoding: 'utf8', flag: 'wx', mode: CONNECTOR_SECRET_FILE_MODE })
      await writeFile(join(staging, 'cordis.patch.yml'), rendered.cordisPatch, { encoding: 'utf8', flag: 'wx', mode: CONNECTOR_SECRET_FILE_MODE })
      const entries = (await readdir(staging)).sort()
      if (entries.join(',') !== CONNECTOR_BUNDLE_FILENAMES.join(',')) {
        throw new Error('connector bundle staging does not hold exactly the two expected files')
      }
      try {
        await rename(staging, target)
      } catch (error) {
        // 只有并发者先我们一步放好**同样内容**时才接受；否则原样抛。
        const raced = await readBundleDirectory(target)
        if (raced === undefined || raced.packageJson !== rendered.packageJson || raced.cordisPatch !== rendered.cordisPatch) {
          throw error
        }
      }
    } catch (error) {
      await rm(staging, { force: true, recursive: true }).catch(() => undefined)
      throw error
    }
    const realTarget = await realpath(target)
    if (realTarget !== join(realDeclRoot, rendered.digest) || !realTarget.startsWith(realRoot + sep)) {
      throw new Error('connector bundle directory failed the realpath equality check')
    }
    return realTarget
  } catch (error) {
    if (error instanceof EnterpriseConnectorEnableError) throw error
    throw connectorError('ENT_CONNECTOR_LOCAL_WRITE_FAILED', 'bundle-write', 'connector bundle could not be written', error)
  }
}

/** 读一个摘要目录里恰好两个文件的正文；目录不存在返回 `undefined`，文件数不对即视为可疑（抛）。 */
export async function readConnectorBundleDirectory(
  bundleDir: string,
): Promise<{ readonly packageJson: string; readonly cordisPatch: string } | undefined> {
  const entries = await readBundleDirectory(bundleDir)
  return entries === undefined ? undefined : { packageJson: entries.packageJson, cordisPatch: entries.cordisPatch }
}

async function readBundleDirectory(
  dir: string,
): Promise<{ readonly packageJson: string; readonly cordisPatch: string } | undefined> {
  let entries: string[]
  try {
    entries = (await readdir(dir)).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  if (entries.join(',') !== CONNECTOR_BUNDLE_FILENAMES.join(',')) {
    throw new Error('connector bundle directory does not hold exactly the two expected files')
  }
  return {
    packageJson: await readFile(join(dir, 'package.json'), 'utf8'),
    cordisPatch: await readFile(join(dir, 'cordis.patch.yml'), 'utf8'),
  }
}

/**
 * 原子写那枚凭据文件（0o700 目录 + 0o600 文件 + **同目录**临时件 + `rename`）。
 *
 * ★与 `nuwax-session.json` / `skill-installs/*.json` / `preset-authorizations/*.json` 三份**同构**：
 *   临时件与目标**同目录**（跨设备 `rename` 会退化成复制+删除，就不再是原子的），`flag: 'wx'` 拒覆盖
 *   一个已经在那里的临时件，`rename` 之后才可能被读到。
 * ★本函数**只写凭据**：patch 文本、bundle 目录都不在这里。
 *
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_LOCAL_WRITE_FAILED`（`step=secret-write`）
 */
export async function writeConnectorSecret(
  options: ConnectorEnableStateOptions,
  secret: ConnectorSecretFile,
): Promise<string> {
  const mcpId = requireConnectorMcpId(secret.mcpId)
  const target = connectorSecretPath(options, mcpId)
  const temporary = join(dirname(target), `.${mcpId}.${randomUUID()}.tmp`)
  try {
    await mkdir(dirname(target), { recursive: true, mode: CONNECTOR_SECRET_DIR_MODE })
    await writeFile(temporary, serializeConnectorSecret(secret), {
      encoding: 'utf8',
      flag: 'wx',
      mode: CONNECTOR_SECRET_FILE_MODE,
    })
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    if (error instanceof EnterpriseConnectorEnableError) throw error
    throw connectorError('ENT_CONNECTOR_LOCAL_WRITE_FAILED', 'secret-write', 'connector credential file could not be written', error)
  }
  return target
}

/** 读回那枚凭据文件（只在幂等判定里用：比对它与当前披露要写的是不是同一份）。 */
export async function readConnectorSecret(
  options: ConnectorEnableStateOptions,
  mcpId: string,
): Promise<ConnectorSecretFile | undefined> {
  let text: string
  try {
    text = await readFile(connectorSecretPath(options, mcpId), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw connectorError('ENT_CONNECTOR_LOCAL_WRITE_FAILED', 'secret-write', 'connector credential file could not be read', error)
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'secret-write', 'connector credential file is not valid JSON', error)
  }
  const row = asRecord(value)
  if (row === undefined
    || Object.keys(row).sort().join(',') !== 'headers,mcpId,serverName'
    || typeof row['mcpId'] !== 'string'
    || typeof row['serverName'] !== 'string') {
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'secret-write', 'connector credential file has an invalid shape')
  }
  const headers = readPlatformHeaders(row['headers'])
  if (headers === undefined) {
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'secret-write', 'connector credential file holds no headers')
  }
  return { mcpId: row['mcpId'], serverName: row['serverName'], headers }
}

/**
 * 删掉那枚凭据文件（**卸妆的最后一步**，也是「已断开但凭据还在」唯一的下令收回点）。
 *
 * ★删不掉 ⇒ **抛**（`ENT_CONNECTOR_UNINSTALL_FAILED`，`step=secret-delete`），绝不静默：
 *   留着它，下一次启用会拿着一份属于旧披露的凭据去连。
 * @returns 是否真的删掉了一份（`false` = 本来就没有，合法）。
 */
export async function deleteConnectorSecret(options: ConnectorEnableStateOptions, mcpId: string): Promise<boolean> {
  const target = connectorSecretPath(options, mcpId)
  try {
    await rm(target, { force: false })
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw connectorError('ENT_CONNECTOR_UNINSTALL_FAILED', 'secret-delete', 'the connector credential file could not be removed', error)
  }
}

/* ══════════════════════════ ⑤ 官方安装面（唯一安装面 = 官方） ══════════════════════════ */

/**
 * 官方 `listBundles()` 一行里，本面**唯一**读到的三格（其余字段一律不进来）。
 *
 * 官方原型的字段远多于此（版本、描述、meta、rows、overrides、readOnlyReason……）；
 * 这里只投影「这条 bundle 在不在、启用没启用、叫什么」，因为这三格就是「已连接」的全部事实。
 */
export interface ConnectorOfficialBundleSummary {
  readonly name: string
  readonly installed: boolean
  readonly enabled: boolean
}

/**
 * 本面需要的官方管理面：`installBundle` / `removeBundle`（写）**加上** `listBundles`（读）。
 *
 * ★为什么把它与 `plugin-install-port.ts` 那个两方法的结构面分开：那个是**横切**的写面（配方与连接器
 *   共用）；本面还要**读**「这条 bundle 在不在」，而官方 `PluginManager.listBundles()` 正是那一格
 *   唯一的真源（`lib/index.js:1456`）。合起来仍只是**同一个官方服务**的投影，不是第二个安装器。
 */
export interface ConnectorEnablePort {
  installBundle(spec: string, options?: { readonly enabled?: boolean }): Promise<OfficialBundleApplication>
  removeBundle(name: string): Promise<OfficialBundleApplication>
  listBundles(): Promise<readonly ConnectorOfficialBundleSummary[]>
}

/**
 * 形状闸门：**三个**方法都在才算官方管理面（缺一个即不认，不做半可用降级）。
 *
 * ★它就是 ⑤ 号锁的落点：「官方管理面缺席/形状不对 ⇒ fail-closed（**不装**）」——`ctx.get('pluginManager')`
 *   拿到 undefined、或拿到一个只有 `installBundle` 的东西，本面**一个字节都不写**（连合成都不进）。
 */
export function isConnectorEnableManager(
  value: unknown,
): value is OfficialPluginManagerLike & { listBundles(): Promise<unknown> } {
  if (!isOfficialPluginManager(value)) return false
  return typeof (value as { listBundles?: unknown }).listBundles === 'function'
}

/** 官方默认端口：**原样转发**，不吞任何异常（官方错误由编排层当 `cause` 保留）。 */
export function officialConnectorEnablePort(manager: unknown): ConnectorEnablePort {
  if (!isConnectorEnableManager(manager)) {
    throw badRequest('official plugin manager does not expose installBundle/removeBundle/listBundles')
  }
  const official = manager
  return {
    async installBundle(spec, options) {
      return projectOfficialResult(spec, await official.installBundle(spec, options ?? {}))
    },
    async removeBundle(name) {
      return projectOfficialResult(name, await official.removeBundle(name))
    },
    async listBundles() {
      return projectOfficialBundleSummaries(await official.listBundles())
    },
  }
}

/** 官方服务可达性：普通 Host 插件 `ctx.get('pluginManager')` 即可；形状不对即 `undefined`（fail-closed）。 */
export function connectorEnablePortFromContext(ctx: { get(name: string): unknown }): ConnectorEnablePort | undefined {
  const manager = ctx.get('pluginManager')
  return isConnectorEnableManager(manager) ? officialConnectorEnablePort(manager) : undefined
}

/**
 * 官方 `listBundles()` 的**受控投影**：只认「数组里每一项都是对象、`name` 是字符串」，
 * 其余两格按 `=== true` 收敛（官方没说 true 就是没装上/没启用，绝不真值性转换）。
 *
 * ★形状读不懂 ⇒ **抛** `ENT_CONNECTOR_STATE_INVALID`（fail-closed）：把一张读不懂的表当成
 *   「一条都没装」，会让本面在一个已经装好的连接器上再装一遍，或者把「已断开」说成成功。
 */
export function projectOfficialBundleSummaries(value: unknown): readonly ConnectorOfficialBundleSummary[] {
  if (!Array.isArray(value)) {
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'official-state', 'the official plugin manager did not answer a bundle list')
  }
  const summaries: ConnectorOfficialBundleSummary[] = []
  for (const item of value) {
    const row = asRecord(item)
    if (row === undefined || typeof row['name'] !== 'string') {
      throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'official-state', 'the official plugin manager answered a malformed bundle row')
    }
    summaries.push({ name: row['name'], installed: row['installed'] === true, enabled: row['enabled'] === true })
  }
  return summaries
}

/* ══════════════════════════ ⑥ 编排（装 / 卸 / 读「已连接」） ══════════════════════════ */

/** 一台连接器在本机的**官方**状态（本面唯一的「已连接」真源）。 */
export interface ConnectorConnection {
  readonly mcpId: string
  readonly packageName: string
  readonly installed: boolean
  readonly enabled: boolean
  /** 已连接 = 官方说它装着**且**启用着（装了但没启用 ⇒ 行没挂上、工具没注册，不算连接）。 */
  readonly connected: boolean
}

export interface EnterpriseConnectorEnableOptions extends ConnectorEnableStateOptions {
  /** 官方管理面（**必需**）：缺席这件事在类型上不可表达，由组合层用 `connectorEnablePortFromContext` 决议。 */
  readonly port: ConnectorEnablePort
  /** 宿主内部读面：拿平台一枚连接器的详情信封（生产实现 = `esc-route.ts` 的 `readEnterpriseEscHostJson`）。 */
  readonly readPlatformJson: (path: string) => Promise<unknown>
  readonly now?: () => Date
  /** 失败留痕（操作名 / 判定点 / 原始 error）；不改变任何结果语义。 */
  readonly onError?: (message: string, error: unknown) => void
}

export interface EnterpriseConnectorEnableResult {
  readonly ok: true
  readonly mcpId: string
  readonly packageName: string
  readonly rowId: string
  readonly serverName: string
  readonly fingerprint: string
  readonly disclosure: ConnectorEnableDisclosure
  readonly connection: ConnectorConnection
  readonly application: OfficialApplicationKind
  readonly officialApplication: OfficialApplication
  /** `true` = 本来就已经装好且配置逐字相同，**这次没有调官方安装面**（同一 mcpId 再启用的如实结果）。 */
  readonly alreadyInstalled: boolean
}

export interface EnterpriseConnectorDisableResult {
  readonly ok: true
  readonly mcpId: string
  readonly packageName: string
  readonly connection: ConnectorConnection
  /** 这次真的调了官方 `removeBundle` 并成功。 */
  readonly removed: boolean
  /** `true` = 官方说它本来就没装着（**也可能从来没装过**：本面不记账，故两者不可区分）。 */
  readonly alreadyAbsent: boolean
  /** 这次真的删掉了一份凭据文件。 */
  readonly secretRemoved: boolean
  readonly officialApplication?: OfficialApplication
}

/** 编排器：同一实例内做「重复点不重装、进行中拒绝、失败不落地」的全部编排。 */
export interface EnterpriseConnectorEnable {
  /** 读「已连接」（官方状态 + 按 bundle 名派生的 id）——本面唯一的读点，**没有第二本账**。 */
  connection(mcpId: string): Promise<ConnectorConnection>
  /**
   * 把一枚连接器启用到本机。
   *
   * @param mcpId - 平台的十进制连接器 id。
   * @param confirmFingerprint - 员工确认过的那份披露指纹（可选）。**只有**它与当前披露指纹逐字相等时
   *   才会写授权；不相等一律拒（`_AUTHORIZATION_STALE`），一个字都不落盘。
   */
  enable(mcpId: string, confirmFingerprint?: string): Promise<EnterpriseConnectorEnableResult>
  /** 断开：官方 `removeBundle`（若装着）＋ 删掉那枚凭据文件（若在）。 */
  disable(mcpId: string): Promise<EnterpriseConnectorDisableResult>
  busy(mcpId?: string): boolean
}

/* ── ⑥ 的**共用**读点与纯判据：`connection()`、`enable()` 与只读投影/「已连接的」盘点共用 ── */

/**
 * 官方清单的**唯一**读点（形状折叠与失败码只此一处）：`connection()` 与「已连接的」盘点共用。
 *
 * ★折叠纪律：`port.listBundles()` 自己带的**受控码原样上抛**（它已经把畸形表折成
 * `ENT_CONNECTOR_STATE_INVALID`），其余无码失败（官方服务抛的裸 `Error`）才收成本面那枚
 * `ENT_CONNECTOR_STATE_INVALID`（`step=official-state`）——**绝不**把一张读不懂的表当成
 * 「一条都没装」（那会让本面在一个已装好的连接器上再装一遍，或把「已断开」说成成功）。
 *
 * @param port - 官方管理面（三个方法都在的那一枚）。
 * @returns 官方清单（每行已由端口投影成 `{name, installed, enabled}`）。
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`（`step=official-state`）。
 */
export async function readConnectorOfficialBundles(
  port: ConnectorEnablePort,
): Promise<readonly ConnectorOfficialBundleSummary[]> {
  try {
    return await port.listBundles()
  } catch (error) {
    if (error instanceof EnterpriseConnectorEnableError) throw error
    throw connectorError('ENT_CONNECTOR_STATE_INVALID', 'official-state', 'the official bundle list could not be read', error)
  }
}

/**
 * **纯函数**：官方清单一行（或那一行缺席）→ 本面那枚「连接事实」。
 *
 * ★它就是 `connected = installed && enabled` 这条判据的**唯一**实现：`connection()`（单枚）与
 *   「已连接的」盘点（一批）都走这里，故两条路由不可能对同一份官方状态给出两种说法。
 * ★`installed`/`enabled` 按 `=== true` 收敛（官方没说 true 就是没装上/没启用，绝不真值性转换）；
 *   ★「装了但没启用」不算连接：行没挂上、工具没注册。
 *
 * @param mcpId - 平台的十进制连接器 id（形状由 {@link requireConnectorMcpId} 定）。
 * @param entry - 官方清单里**包名逐字相等**的那一行；缺席即「没装上」。
 * @returns 逐格事实（`packageName` 逐字来自 {@link connectorBundlePackageName}，不自己拼）。
 * @throws {EnterpriseConnectorEnableError} `ENT_INVALID_REQUEST`（`mcpId` 形状不对）。
 */
export function connectorConnectionFrom(
  mcpId: string,
  entry: ConnectorOfficialBundleSummary | undefined,
): ConnectorConnection {
  const id = requireConnectorMcpId(mcpId)
  const packageName = connectorBundlePackageName(id)
  const installed = entry?.installed === true
  const enabled = installed && entry?.enabled === true
  return { mcpId: id, packageName, installed, enabled, connected: enabled }
}

/**
 * 平台取数（**唯一**一处形状折叠）：上游受控码原样穿透，其余（无码的传输/解析失败）收成「这次没读到」。
 *
 * @param options - 至少要有读面与留痕端口（`createEnterpriseConnectorEnable` 的 options 天然满足）。
 * @param path - 宿主自己拼的平台路径（已在宿主内部许可表里）。
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_CONFIG_UNAVAILABLE`（`step=platform-read`）。
 */
async function readConnectorPlatformEnvelope(
  options: Pick<EnterpriseConnectorEnableOptions, 'readPlatformJson' | 'onError'>,
  path: string,
): Promise<unknown> {
  try {
    return await options.readPlatformJson(path)
  } catch (error) {
    const code = carriedCodeOf(error)
    if (code !== undefined && CODE_SHAPE.test(code)) throw error
    options.onError?.(`connector platform read failed (${path})`, error)
    throw connectorError('ENT_CONNECTOR_CONFIG_UNAVAILABLE', 'platform-read', 'the platform connector detail could not be read', error)
  }
}

/**
 * ① 取配置那一段的**唯一**实现：平台详情信封 → 配置 → 披露 → 指纹。
 *
 * ★它是 `enable()`（写）与只读 `status` 投影**共用**的同一条路：两条路由因此看的是同一份披露、
 *   同一枚指纹（界面拿 `status` 里的指纹去确认，`enable` 校验的就是同一枚）。**绝不**各读一遍、
 *   各算一份——那会让"员工确认的那份披露"与"真正会装的那份"有机会不一致。
 *
 * @param options - 读面与留痕端口（同上）。
 * @param mcpId - 平台的十进制连接器 id。
 * @returns 配置、披露与披露指纹（三者同源；指纹不吃任何凭据值）。
 * @throws {EnterpriseConnectorEnableError} 与 {@link readConnectorPlatformConfig} 同（形状读不懂即明确失败）。
 */
export async function readEnterpriseConnectorDisclosure(
  options: Pick<EnterpriseConnectorEnableOptions, 'readPlatformJson' | 'onError'>,
  mcpId: string,
): Promise<{
  readonly config: ConnectorPlatformConfig
  readonly disclosure: ConnectorEnableDisclosure
  readonly fingerprint: string
}> {
  const id = requireConnectorMcpId(mcpId)
  const envelope = await readConnectorPlatformEnvelope(options, connectorPlatformDetailPath(id))
  const config = readConnectorPlatformConfig(envelope, id)
  const disclosure = connectorEnableDisclosure(config)
  return Object.freeze({ config, disclosure, fingerprint: connectorEnableFingerprint(disclosure) })
}

/** 组装编排器；`port` 与 `readPlatformJson` 是仅有的两个外部依赖（测试用假件即可覆盖全部分支）。 */
export function createEnterpriseConnectorEnable(
  options: EnterpriseConnectorEnableOptions,
): EnterpriseConnectorEnable {
  const inFlight = new Set<string>()
  const report = (message: string, error: unknown): void => {
    options.onError?.(message, error)
  }

  async function connection(mcpId: string): Promise<ConnectorConnection> {
    const id = requireConnectorMcpId(mcpId)
    const packageName = connectorBundlePackageName(id)
    const entry = (await readConnectorOfficialBundles(options.port)).find(item => item.name === packageName)
    return connectorConnectionFrom(id, entry)
  }

  async function enable(mcpId: string, confirmFingerprint?: string): Promise<EnterpriseConnectorEnableResult> {
    const id = requireConnectorMcpId(mcpId)
    if (inFlight.has(id)) {
      throw connectorError('ENT_CONNECTOR_INSTALL_IN_PROGRESS', 'install', 'this connector is already being installed or removed')
    }
    inFlight.add(id)
    try {
      // ① 取配置（平台那份制品面）——这一步之前**零落盘**；与只读 `status` 投影**共用**同一份实现。
      const { config, disclosure } = await readEnterpriseConnectorDisclosure(options, id)
      const secretPath = connectorSecretPath(options, id)
      const rendered = renderConnectorBundle(config, secretPath)
      const dir = connectorBundleDirectory(options, id, rendered.digest)
      // ② 官方那面的状态先读（**只读**）：它读不懂 ⇒ 当场 fail-closed，连授权记录都不写。
      //    顺序是因果的：一个本机读不懂官方状态的环境，不该在盘上留下任何"这次启用过"的痕迹。
      const before = await connection(id)
      // ③ 授权闸门——它在**任何落盘之前**：指纹不对 ⇒ 零落盘、零安装。
      const fingerprint = await resolveConnectorAuthorization(options, disclosure, confirmFingerprint)
      // ④ 幂等：本来就已经装着、启用着、盘上逐字节就是这一份、凭据也逐字相同 ⇒ **不重复装**。
      if (before.connected) {
        const onDisk = await readConnectorBundleDirectory(dir).catch(() => undefined)
        if (onDisk !== undefined
          && onDisk.packageJson === rendered.packageJson
          && onDisk.cordisPatch === rendered.cordisPatch
          && await secretMatches(options, config, id, rendered.secretPath)) {
          return {
            ok: true,
            mcpId: id,
            packageName: rendered.packageName,
            rowId: rendered.rowId,
            serverName: rendered.serverName,
            fingerprint,
            disclosure,
            connection: before,
            application: 'hot',
            officialApplication: 'applied',
            alreadyInstalled: true,
          }
        }
      }
      // ⑤ 合成（幂等、原子）→ 凭据（原子）→ 官方安装面（**唯一**安装通道）。
      await synthesizeConnectorBundle(options, rendered)
      if (rendered.secretPath !== undefined && config.headers !== undefined) {
        await writeConnectorSecret(options, { mcpId: id, serverName: rendered.serverName, headers: config.headers })
      }
      let applied: OfficialBundleApplication
      try {
        applied = await options.port.installBundle(dir, { enabled: true })
      } catch (error) {
        report(`connector bundle install failed (${rendered.packageName})`, error)
        throw connectorError('ENT_CONNECTOR_INSTALL_FAILED', 'install', 'the official install surface rejected the connector bundle', error)
      }
      if (applied.application === 'failed') {
        report(`connector bundle install reported failure (${rendered.packageName})`, applied.error)
        throw connectorError('ENT_CONNECTOR_INSTALL_FAILED', 'install', 'the official install surface reported a failed connector bundle')
      }
      if (applied.application === 'cancelled') {
        throw connectorError('ENT_CONNECTOR_INSTALL_CANCELLED', 'install', 'the official install surface cancelled the connector bundle')
      }
      return {
        ok: true,
        mcpId: id,
        packageName: rendered.packageName,
        rowId: rendered.rowId,
        serverName: rendered.serverName,
        fingerprint,
        disclosure,
        connection: { ...before, installed: true, enabled: true, connected: true },
        application: officialApplicationKind(applied.application),
        officialApplication: applied.application,
        alreadyInstalled: false,
      }
    } finally {
      inFlight.delete(id)
    }
  }

  async function disable(mcpId: string): Promise<EnterpriseConnectorDisableResult> {
    const id = requireConnectorMcpId(mcpId)
    if (inFlight.has(id)) {
      throw connectorError('ENT_CONNECTOR_INSTALL_IN_PROGRESS', 'uninstall', 'this connector is already being installed or removed')
    }
    inFlight.add(id)
    try {
      const before = await connection(id)
      let removed = false
      let officialApplication: OfficialApplication | undefined
      if (before.installed) {
        let applied: OfficialBundleApplication
        try {
          applied = await options.port.removeBundle(before.packageName)
        } catch (error) {
          report(`connector bundle removal failed (${before.packageName})`, error)
          throw connectorError('ENT_CONNECTOR_UNINSTALL_FAILED', 'uninstall', 'the official install surface rejected the connector removal', error)
        }
        // ★官方没成功卸掉时**绝不**删凭据：那条行还挂着、还在用它（因果顺序，不是取舍）。
        if (applied.application === 'failed' || applied.application === 'cancelled') {
          report(`connector bundle removal reported ${applied.application} (${before.packageName})`, applied.error)
          throw connectorError('ENT_CONNECTOR_UNINSTALL_FAILED', 'uninstall', 'the official install surface did not remove the connector bundle')
        }
        removed = true
        officialApplication = applied.application
      }
      const secretRemoved = await deleteConnectorSecret(options, id)
      return {
        ok: true,
        mcpId: id,
        packageName: before.packageName,
        connection: { ...before, installed: false, enabled: false, connected: false },
        removed,
        alreadyAbsent: !before.installed,
        secretRemoved,
        ...(officialApplication === undefined ? {} : { officialApplication }),
      }
    } finally {
      inFlight.delete(id)
    }
  }

  return {
    connection,
    enable,
    disable,
    busy: (mcpId?: string) => mcpId === undefined
      ? inFlight.size > 0
      : inFlight.has(CONNECTOR_MCP_ID_PATTERN.test(mcpId) ? mcpId : ''),
  }
}

/**
 * 幂等判定的凭据那一半：不需要凭据 ⇒ 恒 `true`；需要 ⇒ 盘上那份必须与这次要写的**逐字相同**。
 *
 * ★凭据**不同**时我们**故意不走幂等**：新 token 要真正生效，必须让官方把那行重挂一次
 *   （`installBundle` 对同一个包名会重新装载），而不是改完文件就宣称「已连接」——
 *   跑着的会话拿的仍是旧 token，那是假话。
 */
async function secretMatches(
  options: ConnectorEnableStateOptions,
  config: ConnectorPlatformConfig,
  mcpId: string,
  secretPath: string | undefined,
): Promise<boolean> {
  if (config.headers === undefined) return true
  if (secretPath === undefined) return false
  const existing = await readConnectorSecret(options, mcpId)
  if (existing === undefined) return false
  return existing.serverName === config.serverName
    && serializeConnectorSecret({ mcpId, serverName: config.serverName, headers: config.headers })
      === serializeConnectorSecret(existing)
}
