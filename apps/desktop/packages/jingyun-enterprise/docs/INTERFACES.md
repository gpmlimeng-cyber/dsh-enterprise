# 冻结接口契约 —— jingyun-enterprise（集成实现必须遵守）

> 本文件是**唯一接口真源**。任何实现文件若与本文件不一致，以本文件为准并先改本文件再改代码。
> 协议报文形状的真源是企业仓库的 `contracts/`（OpenAPI 3.1 + `generated/schemas/*.json` + `fixtures/*.json`），不得凭记忆臆造字段。

## 0. 通用纪律

1. **零 `@dshent/*` 依赖**。只用 `node:*`、`@deepseek-ai/*`（peer）。不得新增运行时依赖。
2. **内部导入必须带 `.js` 后缀**（`import { x } from './y.js'`）；类型导入用 `import type`。
3. 每个文件必须有 GEB L3 头部（`[INPUT]/[OUTPUT]/[POS]/[PROTOCOL]`），中文描述职责边界。
4. 代码风格：单引号、2 空格缩进、行尾分号、导入按字典序分组排序。
5. **凭据纪律**：access token 只在内存；refresh token 只进 `EnterpriseStore` 的凭据文件（0600）；任何日志、错误 message、HTTP 响应体都不得包含令牌或口令。
6. **不得崩溃宿主**：所有跨进程/网络/文件操作必须 try/catch，失败降级为状态或错误码，绝不 `throw` 到 Cordis 顶层、绝不 `process.exit`。
7. 单文件 ≤ 800 行；超过即拆分。
8. 测试：vitest，放 `tests/<模块>.test.ts`；协议投影类必须用契约 fixture 作裁判（见 §7）。

## 1. 共享模块（已完成，勿改，只能引用）

```ts
// src/protocol/types.ts        所有报文窄类型 + ENTERPRISE_GATEWAY_ROUTES / ENTERPRISE_PROVIDER / ENTERPRISE_DEFAULT_MODEL
// src/protocol/error-codes.ts  ENTERPRISE_ERROR_CODES(46) / ENTERPRISE_LOCAL_ERROR_CODES / EnterpriseErrorCode / EnterpriseLocalErrorCode / EnterpriseClientErrorCode
// src/protocol/envelope.ts     EnterprisePlatformError / unwrapEnvelope / toPlatformError / toNetworkError
// src/protocol/http.ts         EnterpriseHttpClient / normalizeServerUrl / EnterpriseRequestInit
// src/config/schema.ts         Config 接口 + Schemastery Schema
```

`EnterpriseHttpClient` 用法（**唯一 HTTP 出口**，业务层禁止直接 `fetch`）：

```ts
const http = new EnterpriseHttpClient({
  baseUrl: 'http://127.0.0.1:8080',
  timeoutMs: 30_000,
  accessToken: () => tokenOrNull,          // 每次请求现取
  onUnauthorized: async () => newTokenOrNull, // 401 时单次续期重放；返回 null 表示无法续期
})
const data = await http.request<SomeData>('/enterprise/api/v1/bootstrap')
const stream = await http.requestResponse('/enterprise/gateway/v1/chat/completions', { method: 'POST', body, json: false })
```

## 2. src/platform/ —— E1 控制面

### storage.ts
```ts
export interface EnterpriseStoredConfig {
  serverUrl: string | null
  installationId: string | null
  deviceName: string | null
}
export interface EnterpriseStoredCredentials {
  accessToken: string | null
  accessTokenExpiresAt: string | null   // ISO8601
  refreshToken: string | null
  refreshExpiresIn: number | null
  clientId: EnterpriseClientId
}
export class EnterpriseStore {
  constructor(options: { dshHome: string; now?: () => Date })
  readonly dir: string                  // <dshHome>/enterprise
  readConfig(): EnterpriseStoredConfig
  writeConfig(patch: Partial<EnterpriseStoredConfig>): EnterpriseStoredConfig
  readCredentials(): EnterpriseStoredCredentials
  writeCredentials(next: EnterpriseStoredCredentials): void
  clearCredentials(): void
}
```
不变量：目录 `<dshHome>/enterprise`；`config.json` 权限 0644、`credentials.json` 权限 0600；写入走 tmp+rename 原子替换；JSON 损坏或字段类型不符时**回退默认值且不抛异常**（可记录 warn）。

### installation.ts
```ts
export function resolveInstallationId(store: EnterpriseStore): string   // UUIDv4，首次生成后持久化
export function defaultDeviceName(): string                             // `${hostname} (${platform})` 形态，长度 ≤120
```
UUID 必须匹配契约 `^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$`。

### pkce.ts
```ts
export function createCodeVerifier(): string      // 43–128，字符集 [A-Za-z0-9._~-]
export function codeChallengeS256(verifier: string): string  // base64url(sha256(verifier)) 无 padding
export function createState(): string             // 32–64，[A-Za-z0-9_-]
export function createTransactionId(): string     // 32–64，[A-Za-z0-9_-]
export interface EnterpriseLoopbackCallback {
  readonly redirectUri: string
  waitForCode(signal: AbortSignal): Promise<{ code: string; state: string }>
  close(): Promise<void>
}
export function startLoopbackCallback(options: { port?: number; timeoutMs: number }): Promise<EnterpriseLoopbackCallback>
```
不变量：回调服务器**只绑定 127.0.0.1**；只接受 `GET` 且携带 `code`+`state` 的回调；state 校验由调用方（auth 层）完成；超时/abort 必须关闭服务器释放端口。回调路径用默认 `/enterprise/auth/callback`（可配置）。

### auth.ts
```ts
export class EnterpriseAuthClient {
  constructor(http: EnterpriseHttpClient)
  createTransaction(p: { redirectUri: string; state: string; codeChallenge: string; installationId: string }): Promise<EnterpriseAuthSourcesData>
  listSources(transactionId: string): Promise<EnterpriseAuthSourcesData>
  passwordLogin(request: EnterprisePasswordLoginRequest): Promise<EnterprisePasswordStepData>
  exchangeToken(request: EnterpriseTokenRequest): Promise<EnterpriseTokenData>
  logout(): Promise<void>
}
```
端点：`GET /enterprise/auth/v1/authorize`、`GET /enterprise/auth/v1/sources`、`POST /enterprise/auth/v1/password`（`application/x-www-form-urlencoded`）、`POST /enterprise/auth/v1/token`（JSON）、`POST /enterprise/auth/v1/logout`。
`passwordLogin` 的 409（首登改密）必须作为**正常结果**返回而不是错误。
响应形状以 `contracts/paths/auth.yaml` 为准，不要臆造。

### device.ts
```ts
export class EnterpriseDeviceClient {
  constructor(http: EnterpriseHttpClient)
  enroll(request: EnterpriseDeviceEnrollRequest): Promise<unknown>     // POST /enterprise/api/v1/devices/enroll
  heartbeat(request: EnterpriseDeviceHeartbeatRequest): Promise<unknown> // POST /enterprise/api/v1/devices/heartbeat
}
```
响应主体以 `contracts/paths/device.yaml` 为准；只取用客户端需要的字段，不要复制整个 Device 结构。

### control-plane.ts
```ts
export interface EnterpriseControlPlaneOptions {
  dshHome: string
  harnessVersion: string
  bundleVersion: string
  requestTimeoutMs?: number
  callbackTimeoutMs?: number
  fetch?: typeof globalThis.fetch
  openBrowser?: (url: string) => Promise<void> | void
  now?: () => Date
  store?: EnterpriseStore
}
export class EnterpriseControlPlane {
  constructor(options: EnterpriseControlPlaneOptions)
  status(): EnterprisePlatformStatus
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void
  bootstrap(): EnterpriseBootstrapSnapshot | undefined
  serverUrl(): string | null
  accessToken(): string | null
  setServerUrl(url: string): Promise<{ serverUrl: string }>
  startLogin(): Promise<EnterpriseLoginFlow>
  refresh(): Promise<EnterprisePlatformStatus>
  logout(): Promise<void>
  request(path: string, init?: EnterpriseRequestInit): Promise<Response>  // 网关透传，带 Bearer
  dispose(): Promise<void>
}
```
状态机（必须按此顺序推进，失败落到 FAILED 并带 errorCode）：
`UNCONFIGURED`（无 serverUrl）→ `SIGNED_OUT` → `AUTHORIZING`（PKCE 事务）→ 换取 TokenData → `ENROLLING`（enroll）→ `BOOTSTRAPPING`（bootstrap）→ `READY`。
其它迁移：`refresh()` 成功回 `READY`、失败置 `REFRESHING`→`AUTH_EXPIRED`；中心返回 `ENT_DEVICE_REVOKED` 置 `DEVICE_REVOKED`；用户取消置 `CANCELLED`。
令牌过期策略：`accessTokenExpiresAt` 提前 60 秒视为过期；刷新用 `refresh_token` grant，**轮换后的 refreshToken 必须立即落盘**（旧值即刻作废）。`setServerUrl` 变更地址时必须清空旧凭据。

## 3. src/gateway/ —— E2 企业托管模型

### proxy.ts
```ts
export interface EnterpriseGatewayProxyPort {
  accessToken(): string | null
  request(path: string, init?: EnterpriseRequestInit): Promise<Response>
}
export interface EnterpriseGatewayProxy { readonly baseURL: string; readonly authorization: string; dispose(): Promise<void> }
export function startEnterpriseGatewayProxy(options: { port?: number; platform: EnterpriseGatewayProxyPort; fetch?: typeof globalThis.fetch }): Promise<EnterpriseGatewayProxy>
```
不变量：只绑定 `127.0.0.1`；端口默认随机；`baseURL = http://127.0.0.1:<port>/enterprise/gateway/v1`；对非 loopback 来源请求返回 403；只转发 `POST` 且路径限于 `/enterprise/gateway/v1/**`；**原样透传请求体与 SSE 流**，不得缓冲整个响应；`authorization` 是给官方 pi-ai profile 用的占位值（真正的令牌由 platform 注入），**绝不能把真实 access token 交给浏览器侧**。

### profiles.ts
```ts
export type EnterpriseProfiles = Record<string, PiAiProviderProfile>   // PiAiProviderProfile 来自 @deepseek-ai/dsh-llm-pi-ai
export function buildEnterpriseProfiles(snapshot: EnterpriseBootstrapSnapshot | undefined, baseURL: string, authorization: string): EnterpriseProfiles
```
规则：按 `apiProtocol` 分三组，route 名 `enterprise-openai-completions|enterprise-openai-responses|enterprise-anthropic-messages`；`anthropic-messages` 的 baseURL 去掉结尾 `/v1`（Anthropic SDK 自补 `/v1/messages`），OpenAI 系保留 `/v1`；`isDefault` 的模型额外产出 `enterprise` provider，模型 id 固定 `enterprise/default`、名称加「（企业默认）」；空快照返回 `{}`。`reasoningEfforts === false` 原样传递；`undefined` 字段必须**剔除**而不是置 null。

### register.ts
```ts
export interface EnterpriseGatewayOptions { platform: { bootstrap(): EnterpriseBootstrapSnapshot | undefined; subscribe(l: (s: EnterprisePlatformStatus) => void): () => void }; harnessVersion: string; bundleVersion: string }
export function registerEnterpriseGateway(ctx: Context, options: EnterpriseGatewayOptions): Promise<() => Promise<void>>
```
实现方式：`const official = ctx.isolate('settings').plugin(LlmPiAi, { providers })`，订阅 bootstrap 变化后按 **JSON 指纹**幂等 `official.update(next, true)`；返回完整 disposer（先退订、再等更新链、再 dispose 官方插件与代理）。**不得**自行实现任何 LLM wire 语义（消息/tools/replay/SSE 全归官方 pi-ai）。

## 4. src/market/ —— E4 企业插件市场

### core-packages.ts
```ts
export const ENTERPRISE_CORE_PACKAGES: readonly string[]
export function isCorePackage(name: string): boolean
```
名单必须与 `contracts/plugin-core-packages.json` **逐字一致**，并追加客户端自身两个包（`@jingyun-ai/jingyun-dsh`、`@jingyun-ai/jingyun-enterprise`）作为自保护。不得硬编码在服务端与客户端两处不同名单（这是上一轮审计的 P2 问题）。

### verify.ts
```ts
export function sha256Hex(bytes: Uint8Array): string
export interface ArtifactVerificationInput {
  bytes: Uint8Array
  assignment: EnterprisePluginAssignment
  verifySignature: boolean
  trustedPublicKey?: string
  corePackages?: readonly string[]
}
export type ArtifactVerification =
  | { ok: true }
  | { ok: false; code: EnterpriseClientErrorCode; message: string }
export function verifyPluginArtifact(input: ArtifactVerificationInput): ArtifactVerification
```
校验顺序（**先便宜后昂贵**）：① 核心包拒装 → ② `bytes.length !== assignment.sizeBytes` → ③ sha256 不等 → ④ 开启了验签时：`signatureBase64` 为空 → `ENT_ARTIFACT_UNSIGNED`；否则用 `node:crypto` 的 Ed25519 验签（公钥支持 SPKI PEM 与 DER Base64 两种输入）。
不变量：**不得**因为服务端响应里带字段就关闭校验；验签关闭时签名字段一律忽略（但大小与 sha256 永远校验）。

### assignments.ts
```ts
export interface InstalledPluginFact { version: string; sha256: string }
export interface MarketEntry {
  assignment: EnterprisePluginAssignment
  installed: InstalledPluginFact | null
  action: 'INSTALL' | 'UPGRADE' | 'UNINSTALL' | 'NONE'
  blockedReason?: string
}
export function planMarketActions(
  assignments: readonly EnterprisePluginAssignment[],
  installed: ReadonlyMap<string, InstalledPluginFact>,
): MarketEntry[]
```
规则：`desiredState === 'ABSENT'` 且已安装 → `UNINSTALL`；`INSTALLED` 且未安装 → `INSTALL`；已安装但 version 或 sha256 不同 → `UPGRADE`；完全一致 → `NONE`。**不在 assignments 中的本地包不做任何动作**（中心不远程撤回，与 dshent 语义一致）。核心包或 `downloadUrl === null` 时给 `blockedReason` 并降级为 `NONE`。

### installer.ts
```ts
export interface PluginCommandPort { run(argv: readonly string[], cwd: string): Promise<void> }
export class EnterprisePluginInstaller {
  constructor(options: {
    command: PluginCommandPort
    profile: string
    dshCommand: string
    download(assignment: EnterprisePluginAssignment): Promise<Uint8Array>
    verifySignature: boolean
    trustedPublicKey?: string
    marketInstallEnabled: boolean
  })
  apply(entries: readonly MarketEntry[]): Promise<{ applied: string[]; skipped: string[]; failures: { packageName: string; code: string }[] }>
}
```
要求：**先复用宿主既有插件安装机制**——必须先阅读 `packages/jingyun-dsh/src/plugins/service.ts`，能复用的调用就复用，不要另造一套安装器；确需子进程时经 `PluginCommandPort` 执行，tgz 落临时目录并在 `finally` 清理。单条失败不得中断其余条目。

## 5. src/usage/ —— E3 用量与配额

```ts
export interface QuotaWindowView { key: 'fiveHours' | 'daily' | 'weekly' | 'monthly'; label: string; limit: number | null; usedTokens: number; reservedTokens: number; resetsAt: string | null; percent: number | null; exhausted: boolean }
export interface QuotaPolicyView { policyId: string; name: string; scope: string; resourceType: string; resourceName: string; windows: QuotaWindowView[] }
export function toQuotaPolicyViews(policies: readonly EnterpriseQuotaUsagePolicy[]): QuotaPolicyView[]
export class EnterpriseUsageService {
  constructor(deps: { request<T>(path: string, init?: EnterpriseRequestInit): Promise<T> })
  me(signal?: AbortSignal): Promise<QuotaPolicyView[]>
}
```
`percent = limit === null || limit <= 0 ? null : Math.min(100, Math.round(used / limit * 1000) / 10)`；`exhausted = limit !== null && (used + reserved) >= limit`；窗口为 null 时**不产出该窗口**。端点为 `GET /enterprise/api/v1/usage/me`。

## 6. src/routes/ 与 src/client/

### routes/index.ts
```ts
export interface EnterpriseRouteDeps {
  platform: EnterpriseControlPlane
  usage: EnterpriseUsageService
  market: { list(): MarketEntry[]; plan(): Promise<MarketEntry[]>; apply(packageName?: string): Promise<unknown> }
  logger: { info(m: string): void; warn(m: string): void; error(m: string): void }
}
export function registerEnterpriseRoutes(ctx: { webServer: { register(route: { kind: 'exact'; path: string; handler: (req: any, res: any) => Promise<void> | void }): void } }, deps: EnterpriseRouteDeps): void
```
端点（全部 `/api/jingyun/enterprise` 前缀，返回 `{ success: true, data }` 或 `{ success: false, error }`，与 jingyun `sendJson/sendError` 一致）：
- `GET /status`、`POST /server-url`、`POST /login`、`POST /logout`、`POST /refresh`
- `GET /bootstrap`、`GET /usage`
- `GET /market`、`POST /market/apply`
**安全不变量（重要）**：所有以 `POST` 开头的动作端点必须做**同源校验**（`Origin`/`Host` 必须是 loopback 或自身 Host 头），否则返回 403；因为 jingyun 客户端刻意关闭了 DSH 的 BrowserAuth，路由是本机唯一的鉴权边界。GET 端点也至少校验 Host 为 loopback。校验失败不得泄露内部信息。

### client/index.tsx
- 与 `packages/jingyun-dsh/src/client/index.tsx` 同构：`export const inject = [...]`，向 DSH Web 插槽注册 React 组件。
- 只经 `fetch('/api/jingyun/enterprise/...')` 读状态；**禁止**读写 `localStorage/sessionStorage` 中的令牌；禁止渲染服务端 HTML。
- 至少交付三块：企业设置（服务地址 + 登录/登出 + 状态与错误码文案）、用量与配额、企业市场（列表 + 动作 + 阻塞原因）。
- 文案用中文；错误码到人话的映射集中在 `client/messages.ts`，不得散落。

## 7. 测试裁判（fixture 真源）

从 `/Users/limeng/DSH/DSH-ENT/repo/dsh-enterprise-main/contracts/fixtures/` 复制到 `tests/fixtures/`，至少：
`bootstrap-models-success.json`、`token-success.json`、`auth-sources-success.json`、`device-success.json`、`quota-usage-me-success.json`、`plugin-assignments-success.json`、`quota-error.json`、`unknown-error-code.json`。

必须覆盖的断言（最低集）：
1. `envelope`：成功信封解包、缺 `data` → `ENT_RESPONSE_INVALID`、契约内错误码保留、契约外错误码折叠为 `ENT_NETWORK_ERROR`、`Retry-After` 保留。
2. `http`：`normalizeServerUrl` 合法/非法用例、401 单次重放（用假 fetch 计数）、超时 abort。
3. `pkce`：`codeChallengeS256` 与 RFC 7636 附录 B 向量一致；verifier/state 字符集与长度。
4. `profiles`：用 `bootstrap-models-success.json` 投影出 enterprise provider 与 default sentinel；anthropic 去 `/v1`；空快照为 `{}`。
5. `verify`：大小不符、sha256 不符、核心包、未签名（验签开启）、验签通过/失败（自造 Ed25519 密钥对）。
6. `assignments`：四种 action 判定 + 不在名单中的本地包不动。
7. `usage`：四窗口视图、`percent` 边界（limit=0/null）、`exhausted`。
8. 集成：用 `node:http` 起 mock 企业服务端，覆盖 `setServerUrl → startLogin → token → enroll → bootstrap → READY` 与 `usage/me`、`market` 列表。

## 8. 验收门禁（提交前必须全绿）

```sh
cd apps/desktop/packages/jingyun-enterprise
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm build         # 产出 lib/index.mjs 与 lib/client.js
```

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
