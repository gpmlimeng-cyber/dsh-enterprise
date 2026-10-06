/**
 * [INPUT]: 依赖 Cherry Studio v2.1.4 源码（轻量克隆 `~/.sshwork/cherry-lite`，`--filter=blob:none --no-checkout`，按需 `git show HEAD:<path>` 拉单个 blob）逐文件实读 `src/main/ai/mcp/**`（`McpRuntimeService`/`McpCatalogService`/`McpPackageService`/`mcpTransport`/`mcpClientSdk`/`mcpLaunch`/`mcpStdioLaunch`/`mcpToolId`/`mcpAbort`/`mcpRequestOptions`/`ServerLogBuffer`/`resourcePreview`/`createMcpBridgeServer`/`oauth/*`/`servers/factory`/`__tests__/*`）、`src/shared/{data/types/mcpServer,types/mcp,ai/tools/mcpToolName,ai/tools/mcpSourcePolicy,ipc/schemas/mcp,utils/mcp}.ts`、`src/main/data/{db/schemas/mcpServer,services/McpServerService}.ts`、`src/main/{ipc/handlers/mcp,features/apiGateway/routes/mcp,services/protocol/handlers/mcpInstall}.ts`、`src/renderer/routes/settings/mcp*`、`resources/skills/cherry-tool-guide/references/mcp.md`；对照侧实读本机官方 DSH 包 `@deepseek-ai/dsh-mcp-client@0.2.0-rc.2` 与 `@deepseek-ai/dsh-mcp-resources@0.2.0-rc.2`（README + `lib/types/*.d.ts` + `lib/index.js`）。
 * [OUTPUT]: 提供一份带证据的 Cherry MCP 功能取证报告与一张**能力对照表**（Cherry 有 / 我们有 / 缺口 / Cherry 哪条比我们弱），供排工期用；不改任何产品代码。
 * [POS]: research 目录的竞品取证层。**这份报告的价值在 §9 的对照表与 §10 的分期，不在 §1-§7 的功能复述**——§1-§7 是「上游怎么做」的依据，§9/§10 是「我们缺什么、哪条值得补」的裁决依据。取证纪律：每个结论带 `文件:行号`；下「不存在」结论前一律先做阳性对照（见 §0.2，本报告做了 11 组）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

# Cherry Studio MCP 功能取证报告

- **取证对象**：Cherry Studio **2.1.4**
- **权威坐标**：`CherryHQ/cherry-studio` tag **`v2.1.4`** = commit **`072aab935a0340b3e5f288b8328f3aaae24c918d`**（`git rev-parse HEAD` + `git describe --tags` 本机实测，与任务书给的坐标一致）
- **取证日期**：2026-10-05
- **目的**：查清上游 MCP 功能的真实实现边界，与 DSH 官方已有的 `dsh-mcp-client` / `dsh-mcp-resources` 做能力对照，作为排工期的证据
- **结论摘要**：Cherry 的 MCP 是**面向桌面应用的「服务器管理器」**（14 个内建 in-memory 服务器 + 四种传输 + OAuth + DXT/MCPB 包生态 + 反向桥接给外部 CLI 客户端），而 DSH 官方是**面向 profile 配置的「工具桥」**（两种传输 + 工具/资源发现 + 重连，**无** UI、无 OAuth、无包管理、无内建服务器）。**两边几乎不重叠**：Cherry 强在「用户怎么把服务器弄进来、怎么看见它」，DSH 强在「命名与身份契约、断线收敛、工具结果规范化」。详见 §9。

---

## 0. 取证方法与纪律

### 0.1 取源（本机唯一可行的一条）

```text
✗ 全量 git clone          → curl 56 Connection timed out
✗ raw.githubusercontent   → 本机 curl rc=28 不可达；web_fetch 亦被 SSRF 闸挡下
✓ 本机轻量克隆 ~/.sshwork/cherry-lite（--filter=blob:none --no-checkout）
    找路径：git ls-tree -r --name-only HEAD | grep -iE 'mcp'   → 252 条
    读文件：git show HEAD:<path>                                （promisor 按需拉单 blob）
```

★**取证过程本身有一次可记的教训**：首次遍历 `src/main/ai/mcp/[^/]+\.ts` 时，`McpPackageService.ts` 报
`fatal: could not fetch d1219963… from promisor remote`（网络瞬断），行数显示为 **0**。
若就此写「该文件为空」即为**又一次假阴性**。复验 `git cat-file -e HEAD:<path>` = **PRESENT**、重取即得 662 行
⇒ 本报告的所有 Cherry 行号均在**成功取到内容**之后给出；取不到的一律不写。

### 0.2 阳性对照记录（硬要求）

按 `cherry-skill-add-2026-10-05.md` §0.2 的教训——**阳性对照必须用「确定存在于目标文件内」的符号**。
本报告做了 **11 组**对照（6 组 Cherry 侧 + 4 组 DSH 侧 + 1 组阴性）：

```text
Cherry 侧（目标文件内确实存在的符号 → 命中数必须 ≥1）
  src/main/ai/mcp/McpRuntimeService.ts    abortTool                2  ✓
  src/main/ai/mcp/McpRuntimeService.ts    connectWithFallback      2  ✓
  src/main/ai/mcp/McpCatalogService.ts    writeToolsCache          7  ✓
  src/shared/data/types/mcpServer.ts      disabledTools            1  ✓
  src/main/ai/mcp/McpPackageService.ts    DXT_ENV_DENYLIST         2  ✓
  src/main/ai/mcp/mcpClientSdk.ts         getTransportCandidates   1  ✓

DSH 侧
  dsh-mcp-client/lib/index.js             reconnect               21  ✓
  dsh-mcp-client/lib/index.js             failOnStartupError       4  ✓
  dsh-mcp-client/lib/types/index.d.ts     StreamableHttpConfig     4  ✓
  dsh-mcp-resources/lib/index.js          list_mcp_resources       2  ✓

阴性对照（必须 0）
  McpRuntimeService.ts                    zzz_negative_zzz         0  ✓
```

**因此本报告下列「DSH 没有 X」的结论是成立的**（每一条都配了一次成功的阳性命中）：
`oauth`=0 · `prompts`=0 · `SSEClientTransport`=0 · `EventSource`=0 · `StreamableHTTPClientTransport`=2（存在）·
`resources/subscribe`=0 · `roots`=0 —— 见 §8。

### 0.3 范围与口径

- **「我们」= DSH 官方已有包**，不是 `dsh-enterprise`。企业仓目前**零 MCP 代码**（`plugin/**` 与 `server/**` 全仓 grep `mcp` 无业务命中），所以「缺口」的起点就是官方那两枚包。
- **只读源码 + 只读 README/.d.ts，未运行任何测试、未起任何服务器**。凡「运行时行为」都由源码注释或测试名**推断**，并在文中标注。
- Cherry 是 TS 源码、行号会漂 ⇒ **所有行号都是 tag `v2.1.4` / commit `072aab93…` 上的**。

---

## 1. 数据模型与持久化

### 1.1 实体（Zod 定义即真源）

- `src/shared/data/types/mcpServer.ts:40-105` `McpServerSchema = z.strictObject({…})` —— **严格对象**，33 个字段。
  关键字段（行号逐条实测）：

| 字段 | 行 | 语义 |
|---|---|---|
| `id` | `:42` | UUID v4，**数据库自动生成** |
| `name` | `:44` | 显示名，`min(1)` |
| `type` | `:46` | 通信类型，可选（见 §2.1） |
| `baseUrl` | `:50` | URL 型传输的地址 |
| `command` / `args` / `env` | `:52`/`:56`/`:58` | stdio 型的三件套 |
| `headers` | `:60` | 自定义请求头 |
| `registryUrl` | `:54` | 包管理器 registry（npx/uv 用，见 §2.3） |
| `longRunning` | `:70` | 长任务模式（超时策略，见 §3.3） |
| `timeout` | `:72` | **秒**（调用侧转 ms） |
| `dxtVersion` / `dxtPath` | `:74`/`:76` | DXT/MCPB 包版本与解出路径（见 §4.3） |
| `disabledTools` | `:84` | 逐工具禁用名单（支持通配，见 §3.2） |
| `disabledAutoApproveTools` | `:86` | 逐工具「强制弹窗确认」名单 |
| `shouldConfig` | `:88` | 是否仍需用户配置 |
| `sortOrder` | `:90` | 展示排序 |
| `isActive` | `:92` | **必填**，是否启用 |
| `installSource` | `:94` | 安装来源枚举 |
| `isTrusted` / `trustedAt` | `:96`/`:98` | 信任位与信任时间戳 |
| `installedAt` | `:100` | 安装时间 |
| `configSample` | `:82` | 配置样例（`McpConfigSampleSchema:15-19` = command/args/env） |

- **安装来源**：`mcpServer.ts:27` `McpServerInstallSourceSchema = z.enum(['builtin','manual','ai_assisted','protocol','unknown'])` ——
  五态，其中 `ai_assisted`（模型代装）与 `protocol`（协议一键装）是**两个独立的入口**，见 §4.2/§7。
- **通信类型**：`mcpServer.ts:23` `z.enum(['stdio','sse','streamableHttp','inMemory'])` —— **四种**（对照 DSH 的两种，见 §8/§9）。

### 1.2 持久化（SQLite / Drizzle）

- `src/main/data/db/schemas/mcpServer.ts:15-64` `sqliteTable('mcp_server', {…})`：
  - 列与实体逐一对应；`args`/`env`/`headers`/`tags`/`configSample`/`disabledTools`/`disabledAutoApproveTools`
    用 `text({ mode: 'json' })` 存（`:25`、`:26`、`:27`、`:31`、`:38`、`:39`、`:40`）；
    `longRunning`/`shouldConfig`/`isActive`/`isTrusted` 用 `integer({ mode: 'boolean' })`（`:32`、`:41`、`:43`、`:45`）。
  - **三个索引**：`mcp_server_name_idx`(`:52`)、`mcp_server_is_active_idx`(`:53`)、`mcp_server_sort_order_idx`(`:54`)。
  - **两条 DB 级 CHECK 约束**（`sql\`… IN (…)\``）：
    - `:55-58` `mcp_server_type_check`：`type` 必须 ∈ `('stdio','sse','streamableHttp','inMemory')`
    - `:59-62` `mcp_server_install_source_check`：`installSource` 必须 ∈ 五态枚举
  - `:8-14` 注释明写：**「Migrated from Redux state.mcp.servers」**，且**运行时探测位（`isUvInstalled`/`isBunInstalled`）故意不迁移**，启动时重新探测 ⇒
    这是**一次 v1→v2 存储迁移**的落地（迁移器见 `src/main/data/migration/v2/migrators/McpServerMigrator.ts`）。
- **服务层**：`src/main/data/services/McpServerService.ts`（250 行）——`getById:44` / `list(filters):57`（可筛 `isActive`/`type`）/ `create:88` / `update:151` / `findByIdOrName:181` / `delete:194`（**先显式删 Junction 表再删主行**，为的是能识别受影响的 agent 并发事件；FK CASCADE 只作兜底）/ `reorder:225`（按传入 id 顺序写 `sortOrder`）。
- **API 层**：`src/shared/data/api/schemas/mcpServers.ts`（138 行，DTO/Query/API 三套 Zod）+ `src/main/data/api/handlers/mcpServers.ts` ⇒ **MCP 服务器有 REST 面**（不止 IPC）。

### 1.3 凭据怎么存（★这是与 DSH 差别最大的一条）

```text
① 服务器自身的 env / headers：明文进 SQLite 的 JSON 列（mcpServer.ts:26 / :27）
② OAuth 令牌：明文 JSON 文件，且**没有 chmod**
   src/main/ai/mcp/oauth/storage.ts:17-26  JsonFileStorage
     filePath = join(configDir, `${serverUrlHash}_oauth.json`)
     serverUrlHash = md5(server.baseUrl)        （McpRuntimeService.ts:482-486）
   :51-70 writeStorage：mkdir -p → 写 `<file>.tmp` → rename（原子），
     **只写 JSON.stringify(data, null, 2)，无加密、无权限位设置**
③ 日志脱敏有两道，但都不碰磁盘
   mcpRedact.ts:5-10 redactCacheKey（缓存键里的配置片段打码）
   mcpTransport.ts:129 logger.debug(… redactDeep(options))（**记日志前**先 redact）
   McpPackageService.ts:224 DXT_ENV_DENYLIST = ['NODE_OPTIONS','LD_PRELOAD','LD_LIBRARY_PATH']（+ `DYLD_*` 前缀，:247）
```

⇒ **结论（事实）**：Cherry 把 MCP 凭据（含 OAuth refresh token）以**明文**落在磁盘上，仅靠「文件系统权限」保护，且代码里**没有 `chmod 0600`**。
对照 DSH：服务器 `env`/`headers` 写在 `cordis.yml` 里、用 `!!js process.env.X` 引用环境变量（README 例），**不在配置里存明文**；OAuth 这件事 DSH **根本不做**（§8）。

---

## 2. 传输形态

### 2.1 四种传输（`mcpTransport.ts:205-224` `createTransport` 是唯一入口）

| `type` | 实现 | 行号 | 备注 |
|---|---|---|---|
| `stdio` | `sdk.StdioClientTransport` | `:179` | 子进程；`stderr: 'pipe'` |
| `sse` | `sdk.SSEClientTransport` | `:138` | **旧式 SSE**（DSH 无） |
| `streamableHttp` | `sdk.StreamableHTTPClientTransport` | `:130` | 现代 Streamable HTTP（DSH 有） |
| `inMemory` | `sdk.InMemoryTransport.createLinkedPair()` | `:105` | **进程内**，14 个内建服务器用（§2.5） |

- 分派规则在 `mcpTransportKind.ts:5-10`：`inMemory`（且确有实现）> `baseUrl` → `url` > `command` → `stdio` > `invalid`。
- `mcpTransport.ts:209-213` 有一条**兼容注**：一个 `type==='inMemory'` 但本机没有实现的行，**回落**到它自己声明的 `baseUrl`/`command`（历史行遗留）。
- URL 型请求走 **Electron `net.fetch`**（`:31-33`）而不是全局 fetch —— 为的是吃系统代理/证书。
- 请求头合并 `:40-53 mergeHeaders`：**后来源覆盖前来源，且按大小写不敏感同名去重**（注释点明：用户填 `authorization` 要能顶掉内置的 `Authorization`，而不是两个都发）；来源顺序 `defaultAppHeaders()` → `server.headers` → `getBuiltinHttpHeaders(server)`（`:56`）。

### 2.2 传输自动回退（★DSH 完全没有）

```text
mcpClientSdk.ts:71-76  getTransportCandidates(server)
    type==='sse'            → ['sse', 'streamableHttp']
    type==='streamableHttp' → ['streamableHttp', 'sse']
    无 baseUrl               → null（不回退）
mcpClientSdk.ts:85-89  isTransportFallbackError
    SseError.code === 405
    StreamableHTTPError.code === 405 || 404
    ★显式排除 401/403/5xx —— 否则 OAuth 与真实服务器错误会被「回退失败」掩盖
McpRuntimeService.ts:608-646  逐个候选试；失败且属于上述错误 ⇒ client.close() 后换另一个
```

> 收益：用户**不必知道**自己配的是旧式还是新式 HTTP —— 配错也能连上（`mcpClientSdk.ts:66-70` 注释原文：这是为了「在没有用户干预的情况下桥接遗留 SSE 服务器与现代 Streamable HTTP 服务器」）。

### 2.3 stdio 启动解析（**npx / uvx / uv 包管理器耦合**）

- `mcpLaunch.ts:23-39 RUNNERS`：只识别三个命令 —— `npx`、`uvx`、`uv`。
  - `npx`：找不到时**回落内置 `bun`**，并把参数改写成 `bun x -y …`（`:28`，注释特意说明「按位置而不是按成员判断，免得本来就叫 `x`/`-y` 的包参数把前缀吞掉」）。
  - `uvx`/`uv`：共用 `uvRunner`（`:13-21`），`registryEnv` 注 `UV_DEFAULT_INDEX` + `PIP_INDEX_URL`。
  - `npx` 的 `registryEnv` 注 `NPM_CONFIG_REGISTRY`（`:29`）。
- `:84-101` 解析顺序：**用户 PATH 里的** → 内置二进制 → 原样（`unresolved` + `unavailableReason` 人话）。
- `:103-108` **解析结果按 `[命令, 排序后的 shell env]` 缓存**（并发同命令只解析一次）——注释强调**不共享 args 与 registry**。
- `:119-140 buildStdioEnvironment`：**Windows 专属处理** ——
  SDK 会在传入对象**之前**前置 `process.env.PATH`，所以必须把 env 里所有大小写变体的 `PATH` 收敛成**唯一一个大写 `PATH` 键**，否则「我们刚探测到的新 shell PATH 顶不掉过期的那个」。
  （这条正是任务书里 `mcpStdio.windows` 指的平台问题族；测试 `mcpStdio.windows.test.ts` 另有一条「missing absolute command 要把 spawn 错误抛上来」。）

### 2.4 in-memory 与 14 个内建服务器（★DSH 完全没有）

- `src/shared/utils/mcp.ts:6-21 BuiltinMcpServerNames` —— **14 个**：
  `@cherry/{flomo, qveris, mcp-auto-install, memory, sequentialthinking, brave-search, fetch, filesystem, dify-knowledge, python, didi-mcp, browser, nowledge-mem, hub}`。
- `servers/factory.ts:15-51 inMemoryServers` 注册**进程内实现**：memory / sequentialThinking / braveSearch / fetch / filesystem / difyKnowledge / python / didiMcp / browser（9 个）。
  - `:54-56 hasInMemoryImplementation` 是「这行能不能在进程内起」的唯一判据。
  - `:77-80 getBuiltinHttpHeaders`：`qveris` 用用户配的 env 里的 `QVERIS_API_KEY` 现算请求头（所以它**不能**存成静态 header）。
- 意义：**文件系统访问、Python 执行、浏览器控制、联网抓取**在 Cherry 里都是「一个内建 MCP 服务器」，用同一套工具协议暴露给模型 —— 这解释了大量 `servers/*.ts` 与 `src/main/features/browser/mcp/**`。

---

## 3. 工具 / 资源 / 提示 发现

### 3.1 两个服务分工（★这条决定了「热路径不许连服务器」的设计）

```text
McpRuntimeService   连接与生命周期：clients/pendingClients/pendingProbes 三张表（:207-211）
                    + liveness ping 复用（:437-466）、单飞连接（:368-418）、通知处理（:704-766）
McpCatalogService   工具目录：唯一的写入口 writeToolsCache（:142-155）→ 触发 onToolsCacheUpdated（:104-105）
```

- **`listTools` 是「只读缓存」的**（`McpCatalogService.ts:266-282`）：注释原文——「**never connects to the upstream MCP server**，so a dead or slow server can't block the agent/chat startup hot path」（引 issue #16242）。
  - 冷缓存（`undefined`，与「热过但是空的 `[]`」**刻意区分**）⇒ 返回 `[]` 并**踢一次非阻塞预热**。
  - 已确认空的服务器**不会**在热路径上被反复探测。
- **预热与退避**（`:303-322` + 常量 `:20-22`）：`PREWARM_CONCURRENCY = 3`；确认空 ⇒ 重试间隔 **5 分钟**；失败 ⇒ **30 秒**；`warmToolsCache` **永不 reject**（死服务器降级成「热过的空缓存」）。
- `:340-362 prewarmActiveServerTools`：启动就绪后**分批（每批 3）**预热所有 `isActive` 服务器，用 `Promise.allSettled` 保证一台失败不影响其它。
- `:180-220 listToolsImpl`：**先查 `getServerCapabilities()?.tools`** —— 只发布 prompts/resources 的服务器 `tools/list` 会回 `-32601`，「以前会被当成启动失败、导致这种服务器根本启用不了」（`:183-185` 注释）。
- 工具 schema 用 Zod `loose()` 归一（`:29-48`）：`properties`/`required` 缺失时补 `{}`/`[]`，但**保留协议扩展键**。

### 3.2 工具身份与命名（★与 DSH 是同一形状、不同实现）

```text
McpCatalogService.ts:199-203  id = buildMcpToolWireId({serverId, serverName, toolName})
mcpToolId.ts:38-51            buildMcpToolWireId
    body   = `mcp__${slug(serverName)}__${slug(toolName)}`.slice(0, 63 - suffix.length).replace(/_+$/,'')
    digest = sha256(serverId + '\0' + toolName).hex.slice(0, 20)      ← 80 bit
    suffix = `_${digest}`；MCP_TOOL_ID_MAX_LENGTH = 63（:7）
mcpToolId.ts:29-36            toWireSlug：先 tiny-pinyin 罗马化汉字（逐字加空格），再 toCamelCase
                              ★注释自陈缺口：kana/韩文仍会 slug 成空 ⇒ 只剩 digest
mcpToolName.ts:14-26          toCamelCase（非 ASCII 丢弃、数字开头补 `_`）
mcpToolName.ts:99-141         buildFunctionCallToolName：**遗留** `mcp__{server}__{tool}`，
                              超 63 时用 `_<FNV-1a 32 位 base36(serverName) 7 位>` 消歧（:107-114）
mcpToolName.ts:156-167        parseFunctionCallToolName（按最后一个 `__` 切）
```

> **对照 DSH**：DSH 的公开名同样是 `mcp__<serverName>__<rawName>`，但**命名空间是本机配置而非远端 `serverInfo.name`**，且「有损归一化时追加 **12 位十六进制** SHA-256」（README「Design philosophy」）。Cherry 用的是 **20 位（80 bit）** 摘要、且**总是**追加（不是只在有损时）。
> ⇒ **两者都做了「稳定身份」这件事，但 DSH 的契约声明得更硬**（README 明写「public-name algorithm is a v1 contract pinned by tests」）。**Cherry 更弱的地方**：它的 digest 掺了 `serverId`（UUID），所以**删了再建同名的服务器，工具名会变**；DSH 的摘要只吃 `(serverName, rawName)`，**换服务器实例名字不变**。

### 3.3 超时与取消（任务书点名的重点）

**超时策略单一真源** = `mcpRequestOptions.ts:16-22`：

```text
timeout              = policy.timeout ? policy.timeout * 1000 : 60_000      ← 秒 → ms，缺省 60s
resetTimeoutOnProgress = policy.longRunning ?? false
maxTotalTimeout      = policy.longRunning ? 10 * 60 * 1000 : undefined      ← 长任务总预算 10 分钟
```

- 注释 `:11-15` 强调这是 **single source of truth**，由 `McpRuntimeService` 在**每次调用**读当时的配置（引 issue #20266 ⇒ 改配置立即生效，不必重连）。
- **连接**超时是**另一条**：`McpRuntimeService.ts:120 MCP_CONNECT_TIMEOUT_FLOOR_MS = 180_000`，且 `:576` 取 `max(server.timeout*1000, 180s)` —— 「连接每次激活只做一次，给足余量以免慢 SSE 握手误判」。
- `:29 MCP_FORWARDING_TIMEOUT_MS = 2**31 - 1`（≈24.8 天）——注释：SDK **没有关闭计时器的开关**，所以用「setTimeout 安全的最大值」冒充「无超时」。
- **取消**（`mcpAbort.ts:16-25`）★这里有一条很细的判据：

  > SDK 的 `Protocol.request` 在**被 abort** 时抛的是 `McpError(ErrorCode.RequestTimeout, String(signal.reason))`，**没有 `data`**；
  > 而**真正的请求超时**用的是**同一个 code**、但消息是 `'Request timed out'`、且**带 `{timeout}` data**。
  > ⇒ **只看 code 不是证据**，必须同时匹配「signal 自己的 reason / AbortError」或「code + `data === undefined` + 消息含 reason」。

- `abortTool(callId, scope?)`（`McpRuntimeService.ts:1380-1398`）+ `toolCallKey`（`:87-89`）：

  ```text
  注册键 = scope ? `${scope}\0${callId}` : callId
  ★理由（:81-86 注释）：AI SDK 的 call id **不是进程内唯一**（provider 会跨 topic 复用 "call_0"）
  ⇒ 同一 scope 下撞 id：**全 abort**（「误杀同 scope 的兄弟可恢复，漏掉一个不可恢复」）
  ⇒ 跨 scope：**绝不波及**（另一个 topic 的 call_0 不许被连带）
  ```

- `activeToolCalls: Map<string, Set<AbortController>>`（`:220`）—— 同一个键**并发调用各存各的 controller**，不互相覆盖。
- 调用时与 abort 赛跑：`:1110-1119` `Promise.race([getOrCreateClient, abortPromise])` —— **只释放本次调用方的等待**，共享的初始化继续跑；`:1109-1118` 注释还提到监听器必须手动 `removeEventListener`（`once` 只在 abort 时清理，不 abort 就会随长生命周期信号累积闭包）。

### 3.4 资源与提示（Cherry **三件都做**：tools + resources + prompts）

| 能力 | 位置 | 要点 |
|---|---|---|
| `listPrompts` | `:1186-1238` | **分页**（`MCP_LIST_PAGE_LIMIT = 50`，`:124`）；`-32601` ⇒ 稳定空结果可缓存，其它错误 **rethrow 以免把空列表缓存满 TTL** |
| `getPrompt` | `:1243-1274` | **故意不缓存**（`:1256-1259` 注释：`prompts/list_changed` 只清列表键，渲染结果缓存会在服务器换模板后继续给旧模板） |
| `listResources` | `:1279-1329` | 同样分页 + `-32601` 处理；TTL **60 分钟**（`:1320`） |
| `getResource` | `:1334-1377` | **故意不缓存**（`:1358-1365` 注释：资源**内容**独立于列表变化，而唯一的失效通道清的是列表键 ⇒ 缓存会「在服务器说资源变了之后继续供旧字节、旧权限」满 TTL） |
| 资源模板 | `createMcpBridgeServer.ts:8` `ListResourceTemplatesRequestSchema` | 桥接面暴露模板发现 |
| 资源预览 | `resourcePreview.ts:22-43` | **有界读取**：`text.slice(0, maxChars)` + 回报 `totalChars`（让调用方知道被截）+ `isBinary`（有 blob 无 text）。注释 `:1-7`：上限放 main 侧，否则「几 MB 的资源会为了被丢弃而完整跨 IPC」 |

### 3.5 通知与失效（`setupNotificationHandlers` `:704-766`）

订阅了 **6 种**通知，且**每种的处理是刻意不同的**：

| 通知 | 行 | 处理 |
|---|---|---|
| `ToolListChanged` | `:710-713` | fire `onToolListChanged` → `McpCatalogService.onInit:110-114` 去 `refreshTools` |
| `ResourceListChanged` | `:716-720` | 只删 `mcp:list_resources:<key>` |
| `PromptListChanged` | `:723-727` | 只删 `mcp:list_prompts:<key>` |
| `ResourceUpdated` | `:730-734` | `clearResourceCaches`（资源专属缓存） |
| `Cancelled` | `:737-742` | 只记 debug |
| `LoggingMessage` | `:745-760` | redact 后进 `ServerLogBuffer`（§5） |

★`McpCatalogService.ts:87-105` 有一条**很值钱的架构注**：`onToolsCacheUpdated` 是**故意新造**的事件，而不是复用 `onToolListChanged` ——
后者语义是「上游说列表变了 ⇒ 去刷新」，它的消费者会**写**缓存；从写缓存路径再 fire 它就会 **refresh → write → fire → refresh 死循环**。
新事件是**终结性**的：消费者**只许再读缓存，绝不许写回**。
（消费者是 `createMcpBridgeServer`：Claude Agent SDK **每个会话只快照一次**工具列表、不会自己重列，所以桥接层订阅它并转成 MCP `tools/list_changed` 通知。）

---

## 4. 增删改查与校验

### 4.1 三服务分工（任务书点名的 `McpCatalogService`/`McpPackageService`）

| 服务 | 职责 | 真源 |
|---|---|---|
| `McpServerService` | **DB 层 CRUD**（纯数据，不碰连接） | `src/main/data/services/McpServerService.ts` |
| `McpRuntimeService` | **连接/生命周期/调用**（1425 行，本仓 MCP 最大单文件） | `src/main/ai/mcp/McpRuntimeService.ts` |
| `McpCatalogService` | **工具目录的缓存与预热**（唯一写入口，见 §3.1） | `src/main/ai/mcp/McpCatalogService.ts` |
| `McpPackageService` | **DXT/MCPB 包上传/解包/配置解析** | `src/main/ai/mcp/McpPackageService.ts` |

- IPC 面：`src/main/ipc/handlers/mcp.ts:14-54` 共 **16 个** action，分四组（注释 `:6-13` 自己说明分工）：
  `mcp.server.{remove,restart,stop,refresh_tools,list_prompts,list_resources,get_prompt,read_resource_preview,check_connectivity,get_version,get_logs}`、
  `mcp.protocol_install.{list_pending,install,cancel}`、`mcp.tool.abort_call`、`mcp.package.{upload_dxt,upload_mcpb}`。
- 路由 schema 集中且**输出类型刻意宽松**：`src/shared/ipc/schemas/mcp.ts:29-83`；`:18-22` 注释说明 `list_prompts`/`list_resources`/`get_prompt` 保持 `z.any()`（回的是裸协议形状、渲染层无类型消费），只有 `read_resource_preview` 有类型（它的形状只服务于 composer）。
- **推送事件 2 个**：`:85-88` `mcp.server.log` 与 `mcp.tool.call_progress`。

### 4.2 协议一键安装（`mcp://install?servers=<base64>`）★DSH 完全没有

```text
src/main/services/protocol/handlers/mcpInstall.ts:53-65  parseMcpInstallProtocolUrl
    url.pathname 必须 === '/install'
    取 searchParams.get('servers') → base64 → JSON.parse
    :34-51 parseMcpServerDtos：接受三种形状
        Array            → 逐个
        { mcpServers: [] } → 逐个
        { mcpServers: {name: cfg} } → 用键名当 fallbackName（:47）
    :6-32 toProtocolMcpServerInstall：**兼容旧键 `url` → `baseUrl`**（:19-21），
        并**强制** installSource='protocol'、isTrusted=false、isActive=false、installedAt=now（:25-31）
    ★即：协议装进来的服务器**默认不启用、不信任** —— 与 §7 的「模型代装」同一条纪律
IPC：list_pending / install / cancel 三个 action（handlers/mcp.ts:38-46），带 senderId 隔离
```

### 4.3 DXT / MCPB 包（`McpPackageService.ts`，662 行）★DSH 完全没有

- 两种格式：`McpPackageFormat = 'dxt' | 'mcpb'`（`:108`），manifest 分 `DxtManifest`（要求 `dxt_version`）/ `McpbManifest`（要求 `manifest_version`）（`:84-92`，校验在 `:527-537`）。
- **上传校验**（`:262-305 validatePackageUploadPayload`）：文件名非空/无首尾空白/无路径分隔符/无 NUL/字符白名单 `^[A-Za-z0-9._ ()@+-]+$`/后缀必须匹配格式（`:284`）/非空/≤ **100 MiB**（`:300-302`）。
- **解包前的两道共用 ZIP 门禁**（`:508-511`）：
  ```text
  assertZipEntriesWithin(entryNames, tempExtractDir)      ← zip-slip（路径逃逸）
  assertNoFoldedPathCollisions(entryNames, 'DXT package') ← 大小写+Unicode 折叠碰撞
  ```
  ★这两个函数**正是** `cherry-skill-add-2026-10-05.md` §7「已补」里那条（我们于 `402187c` 补上）的**同一个** Cherry 实现 ⇒ **DXT 包与技能包复用同一套容器门禁**。
- **manifest 必填校验**（`:538-555`）：`name` / `version` / `server` / `server.mcp_config` / `server.mcp_config.command` / `args` 必须是数组。
- **落点安全**：`:559 ensurePathWithin(this.mcpDir, join(mcpDir, 'server-'+manifest.name))` —— 注释（`:15-21`）明写手法是「**校验最终解析路径**，而不是净化输入」；`:558` 用服务器名当目录名 ⇒ **同名字段天然就是版本管理**。
- **原子替换**：`:561-563` 注释原文「Stage the new package first, then swap directories so a failed install does not destroy the last working version」。
- **DXT 运行期加固**（这套是 DSH 完全没有的）：
  | 加固 | 行 | 内容 |
  |---|---|---|
  | 命令净化 | `:125-147 validateCommand` | 只允许①裸命令名 ②绝对路径 ③`./`/`.\` 相对路径；拒 `..` |
  | 参数净化 | `:157-180 validateArgs` | 拒 `..` |
  | **变量替换** | `:182-216 performVariableSubstitution` | `${…}` 替换 |
  | **env 黑名单** | `:224` + `:233-260` | 拒 `NODE_OPTIONS`/`LD_PRELOAD`/`LD_LIBRARY_PATH` 与 `DYLD_*` 前缀；拒键/值里的 NUL。★注释 `:218-223` 说明理由：这些变量能改变子进程**如何加载代码** ⇒ 恶意 manifest 可绕过命令/参数校验执行任意代码 |
  | 平台覆盖 | `:307-353 applyPlatformOverrides` | `platform_overrides[process.platform]` 覆盖 command/args/env；**替换之后再校验一次**（`:336`、`:344`），顺序很重要 |
- 运行期解析：`getResolvedMcpConfig(dxtPath, userConfig)`（`:598-630`）在每次 stdio 启动时被 `mcpStdioLaunch.ts:38-50` 调用。

### 4.4 失败态

- 状态机：`McpRuntimeService.ts:248-276 setServerStatus(state, error?)` + 缓存键 `mcp.status.<id>`（`:111`）；状态值来自 `McpRuntimeStatus['state']`（`:92`）—— 代码里出现 `'disabled'`（`:225`、`:378`）、`'connecting'`（`:389`、`:475`）、`'connected'`（`:246`、`:453`、`:522`）、`'error'`（`:250`、`:539`，**带 error**）。
- **状态写入去重**：测试名 `McpRuntimeService.test.ts`「broadcasts on the first status write / does not re-broadcast when the state is unchanged / broadcasts again when the state changes / **re-broadcasts only when the error message changes**」⇒ 不是「有变化就广播」，而是**状态或错误消息变了才广播**。
- 启动失败**不阻断**别的服务器：`prewarmActiveServerTools` 用 `allSettled`（`:346-357`）。
- 删除/重连竞态有**显式防护**：`removedServerIds`（`:214`，「id 永不复用」）+ `pendingRemovals`（`:215`），`connectClient` 在**三个位置**复查（`:471`、`:515`）——注释 `:212-213` 原文：防止「晚到的 connect 自我关闭、而不是把 client 重新缓存进一个永远不会关它的地方」。
- 失败要**关掉旧 client**：`:821-824` 注释（引 issue #18144）——「一个没过存活 ping 的 client **仍然必须被关闭**，只把它从 map 里删掉会**孤立掉 stdio 子进程**」。
- 前端**有** `useMcpRuntimeStatus`（`src/renderer/hooks/useMcpRuntimeStatus.ts`）+ 诊断：`src/main/services/diagnostics/doctor/checks/mcp.ts` 与 `scan/rules/mcp.ts`（后者带 `mcp-connection-closed.positive/negative.jsonl` 夹具 ⇒ 有正反例回归）。

---

## 5. 日志与可观测（`ServerLogBuffer`）

- `ServerLogBuffer.ts:12-40`：**每服务器一个环形缓冲**，`maxEntries = 200`（`:16`），`append` 超限时 `splice(0, len - max)`（`:23-25`），`get` 返回**拷贝**（`:30`），另有 `remove`/`clear`。
- 消费面：`McpRuntimeService.ts:221` 实例化；`:346-352 emitServerLog`；`:354-357 getServerLogs` → IPC `mcp.server.get_logs`（handlers `:37`）→ 设置页 `McpSettings/McpLogsTab.tsx`。
- **日志来源有 4 条**：`'client'`（`:507`、`:535`、`:543`）、`'stdio'`（`mcpTransport.ts:188`、`:195`）、`'server'` 或 `notification.params.logger`（`:757`）。
- **stdout 只有一条路**：`mcpTransport.ts:199-200` 注释明写 —— `StdioClientTransport` **不把 stdout 暴露成可读流**（stdout 留给 JSON-RPC），所以**不要**挂一个永远不会触发的 listener（这是主动避免「看起来接上了其实没有」的假象）。
- `stderr` 用 `TextDecoder('utf-8', { fatal: false })` **流式**解码，`end` 时再 flush 一次（`:191-198`）。
- 工具调用进度：`callToolByProgress` 的 `onprogress` 同时**广播到渲染层**（`IpcApiService.broadcastToType(Main, 'mcp.tool.call_progress', …)` `:1125`）**并**回调外部消费者（`:1131-1137`，`try/catch` 包住，注释：「外部消费者抛错不许破坏调用与上面的广播」）。
- 可观测性埋点：`withSpanFunc`（`:1174-1180` 工具调用；`McpCatalogService.ts:244` 列工具）+ `@TraceMethod`（`:1261 getPrompt`、`:1366 getResource`）。
- 日志脱敏面：`redactDeep`（`mcpTransport.ts:129`、`McpRuntimeService.ts:545`、`:740`、`:1083`、`:1411`）、`redactCacheKey`（`McpCatalogService.ts:61`/`:70`、`McpRuntimeService.ts:184`/`:195`）、`redactRecord`（`servers/factory.ts:64`）。

---

## 6. UI 入口与交互

- **路由树**（TanStack Router，`src/renderer/routes/settings/`）——MCP 是一等设置区，**7 条路由**：

  | 路由 | 文件 | 内容 |
  |---|---|---|
  | `/settings/mcp` | `mcp.tsx:6-8` | 布局（`McpSettingsPage` + `Outlet`） |
  | `/settings/mcp/` | `mcp.index.tsx:4-7` | **重定向**到 `/servers` |
  | `/settings/mcp/servers` | `servers.tsx:10-13` | 已配服务器列表；**search schema 带 `protocolInstallRequestId`**（`:4-6`）⇒ 协议一键装会带参跳到这里 |
  | `/settings/mcp/builtin` | `builtin.tsx:12-14` | 内建服务器列表 |
  | `/settings/mcp/marketplaces` | `marketplaces.tsx:12-14` | **MCP 市场**（服务器目录） |
  | `/settings/mcp/npx-search` | `npx-search.tsx:16-18` | **npm 搜索**（从 npm 找 MCP 包） |
  | `/settings/mcp/mcp-install` | `mcp-install.tsx:12-14` | 复用 `EnvironmentDependencies` ⇒ **依赖安装器**（Node/uv/bun 等运行时） |

- 页面组件 `src/renderer/pages/settings/McpSettings/` 共 **24 个** `.tsx`，其中与「管理」直接相关的是：
  `McpServersList` / `McpServerCard` / `McpServerFields` / `AddMcpServerModal` / `QuickCreateMcpServerDialog`（快捷创建）/ `McpDetailList`（详情）/ `McpTool`（工具页签）/ `McpResource` / `McpPrompt` / `McpLogsTab`（日志页签）/ `McpMarketList` / `BuiltinMcpServerList` / `NpxSearch` / `McpProviderSettings` / `McpDescription` / `QVerisApiKeyGuide` / `McpProtocolInstallDialog` + `ProtocolInstallWarning` + `useMcpServerTrust.tsx`（**信任交互**）+ `mcp.search.ts` / `mcpPackage.ts` / `providers/{bailian,modelscope,config}.ts`（**三家国内 MCP 目录/云厂商接入**）。
- 「信任」是一条**一等公民**的用户交互：`useMcpServerTrust.tsx` + 实体 `isTrusted`/`trustedAt`（§1.1）+ 协议安装**强制** `isTrusted=false`（§4.2）+ 模型代装**默认不信任**（§7）。
- 工具调用呈现：`src/renderer/components/chat/messages/tools/mcp/MessageMcpTool.tsx`；composer 侧有 `mcpPromptTool` / `mcpResourceTool` / `mcpStatusTool` / `mcpPromptArgumentDialog`（**提示模板参数对话框** ⇒ prompts 有真实用户入口）。
- 资源目录侧：`src/renderer/components/resourceCatalog/dialogs/components/McpServerCatalogGrid.tsx`（MCP 服务器也进了「资源目录」这个统一货架）。

---

## 7. 与技能 / 插件 / Agent 的关系

### 7.1 与 Agent 绑定（**多对多**）

- `McpServerService.delete:194-196` 注释：删除服务器时「**cascade-remove its associations from all agents**」并**先显式删 Junction 行**（这样才能识别受影响的 agent、发事件）⇒ **`agent ↔ mcp_server` 是一张关联表**。
- `src/main/ai/mcp/servers/mcpManager.ts` + `src/main/runtime/agentMcpServers.ts`：**每个 agent 有自己的一组 MCP 服务器**。
- `tests` 侧证据：`mcpManager.test.ts`「appends to the existing mcps set when the agent already has servers」。

### 7.2 模型代装 MCP 服务器（★与「技能安装」同族，但更危险，因此门更严）

- 工具：`mcp__mcp-manager__install_mcp_server`（`resources/skills/cherry-tool-guide/references/mcp.md:3` 自述）。
- 面向模型的说明（该 md，**Cherry 自己写给模型的**）：
  - `:16-20` **approval-gated**：「对 stdio 服务器，你传的 config **就是一条本机命令行**：`command` + `args` 会真的在用户机器上起一个进程」；被拒就**停下报告**，**不许**改设置文件或 shell 绕过。
  - `:22-31` **Never invent a config**：「与技能的 `install_source` 不同，这里**你**编写整份 config ⇒ 幻觉出来的包名/端点会变成**真实的命令或请求**」；只装用户粘贴/链接/明确确认过的配置；`env`/`headers` 通常带 API key，**只从用户处取，不许编占位符、不许回显完整密钥**。
  - `:35-45` 两步语义：默认 `activate` **缺省**（注册成 **inactive + untrusted**，绑到当前 agent，等用户去 Settings → MCP 启用）；只有用户**明确要求现在打开**才传 `activate: true`（同时标 active + trusted 并启动）。
  - `:47-52` 恢复：字段错 ⇒ 改那个字段、**不要重试同样参数**、不要改成手改设置。
- 对应测试（`servers/__tests__/mcpManager.test.ts`）钉住的边界：
  「exposes **exactly** install_mcp_server」·「registers … **inactive by default**」·「activates and trusts … when `activate: true`」·
  「defaults type to stdio and **requires command** for stdio」·「**requires baseUrl** for remote」·「requires a name」·
  「rejects invalid field types via the shared schema (zod parse failure)」·「surfaces an install failure as an **error result, not a throw**」·
  「does not create when the agent is missing」·「**rolls back the created server when the bind fails**」·「still surfaces the bind error when the rollback delete also fails」。

⇒ **这是一条「模型把新能力注入自己运行时」的通道，Cherry 给它加了四道闸**：审批 + 默认不激活 + 默认不信任 + 失败不抛错只回错误结果。

### 7.3 反向桥接：Cherry **作为** MCP 服务器被外部客户端连（★最独特的一条）

```text
src/main/ai/mcp/createMcpBridgeServer.ts  把 Cherry 已成对的 MCP 服务器**重新暴露**成一个 MCP server
src/main/features/apiGateway/routes/mcp.ts:1  WebStandardStreamableHTTPServerTransport
    :21-29  列出可用服务器：{id, name, type:'streamableHttp', description?, url}
    :14     McpSessionStore（会话存储，有 SessionLimitReachedError / StoreClosedError）
```
- 桥接的**方向**与 `dsh-mcp-client` 正好相反：DSH 是「**我连别人**」，Cherry 这里还能「**别人连我**」（供 Claude Code 等外部 CLI 复用 Cherry 已配好的服务器）。
- 实例级细节：`createMcpBridgeServer.ts:29-39 McpBridgeOptions.listChanged` —— 只有**能真正承载 server→client 通知**的传输才置 true；
  无状态 HTTP 代理**不能**（每个请求自建自关 bridge，没有流可投递），否则就是「客户端信了却永远收不到」的假承诺。
- 桥接时**剥掉内部字段**：`toSdkTool` 删 `id/serverId/serverName/type`（`:41-48`），`toSdkResource` 删 `serverId/serverName`（`:50-55`），`toSdkPrompt` 删 `id/serverId/serverName`（`:57-60`）。

### 7.4 与技能的关系

- **正向**：MCP 功能自己的用户文档就装在**技能**里 —— `resources/skills/cherry-tool-guide/references/mcp.md` 是 `cherry-tool-guide` 技能的一份 reference（技能体系 → 教模型用 MCP 工具）。
- **负向（重要）**：`:11-12` 明写该工具「**Absent for sealed built-in agents**（Cherry Support）」⇒ **能力按 agent 开放**，不是全局。
- 两者**不共用**存储：技能在 `SkillService`，MCP 在 `mcp_server` 表 + `McpServerService`（两套 CRUD、两套 IPC）。

---

## 8. DSH 官方 MCP 能力面（对照基线，本机实测）

两枚包都在 `@deepseek-ai/dsh@0.2.0-rc.2` 的 `node_modules` 里，**已在所有 shipped profile 挂载**。

### 8.1 `@deepseek-ai/dsh-mcp-client`

| 维度 | 事实 | 出处 |
|---|---|---|
| 定位 | 「connects to MCP servers and registers their tools on `ctx.tools`」 | `package.json` `description` |
| 传输 | **只有两种**：`stdio` \| `streamable-http` | `lib/types/index.d.ts` `StdioConfig` / `StreamableHttpConfig` |
| 协议版本 | 「The official SDK selects the **2026-07-28** protocol when available and falls back to supported legacy revisions」 | README「Use this package」 |
| 命名 | `mcp__<serverName>__<rawName>`；「lossy normalization appends a **12-hex-char** SHA-256 hash」；「the raw name is the only wire name」 | README「Design philosophy」 |
| 配置字段 | `serverName`(`[A-Za-z0-9_-]{1,32}`) · `command`/`args`/`env`/`cwd` · `url`/`headers` · `toolCallTimeoutMs`(**60_000**) · `maxInstructionBytes`(**32_768**) · `failOnStartupError`(**false**) · `reconnect.{enabled(true),initialDelayMs(500),maxDelayMs(30_000),maxAttempts(10)}` | README 配置表 |
| 重连 | 指数退避 500ms→30s；**10 次连续失败后注销工具并停止**，直到重载配置/重启；连接稳定超过 `maxDelayMs` 会**重置预算** | README「Startup, updates, and reconnection」 |
| 同步语义 | 「**Full generation or none**」：拉取失败保留上一代；注册冲突**整体回滚**该代 | README「Design philosophy」 |
| env 洗白 | `scrubbedParentEnv()` 丢弃匹配 `/KEY\|PASSWORD\|SECRET\|TOKEN/i` 与 `DSH_*` 的环境名，配置的 `env` 覆盖其上 | README「Environment scrubbing」 |
| 结果规范化 | 规范值 `{ content: JsonValue[], structuredContent? }`；`isError` ⇒ **抛错**；图片走 attachment store（PNG/JPEG/WebP/GIF，需精确能力证明）；音频/嵌入资源 ⇒ 诊断文本 | README「Calling tools and reading results」 |
| 资源 | **不在本包**，交给 `dsh-mcp-resources` | README「Resources are read on demand」 |
| **明确不支持** | **prompts 模板**、**资源订阅**、task-required 工具、独立连接/发现超时（沿用 SDK 的 60s） | README「Known Limitations」 |

### 8.2 `@deepseek-ai/dsh-mcp-resources`

| 维度 | 事实 | 出处 |
|---|---|---|
| 定位 | 「Scoped MCP resource discovery and reading through shared model tools」 | `package.json` `description` |
| 工具 | **三个共享工具**：`list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource` | `lib/index.js`（各 2 处命中，§0.2 阳性对照） |
| 选择模型 | 每次调用**必须显式给 `server` 名**；「The shared tools **do not aggregate** different servers」 | README「Known Limitations」 |
| 提示注入 | 有 system-prompt 装配时加一节：`MCP resource servers` —— `Use list_mcp_resources, list_mcp_resource_templates, or read_mcp_resource with one of these names as the server argument: <JSON array>.` | README「Model Experience」（`lib/index.js` 该串命中 1） |
| 分页 | 「Without a cursor, the MCP SDK collects the server's pages」；显式 `cursor` 取该页 | README「Discover and read」 |
| 二进制 | 不投成原生图片/音频；文本渲染把 `blob` 换成 `[binary resource: <length> base64 characters; available to programmatic callers]` | README「Resource results」 |
| **明确不支持** | **资源订阅与更新通知**（「call the list or read tools again」） | README「Known Limitations」 |

### 8.3 「我们**没有**」的实测证据（阳性对照见 §0.2）

```bash
D=…/@deepseek-ai/dsh/node_modules/@deepseek-ai
grep -c "oauth\|OAuth"    $D/dsh-mcp-client/lib/index.js  → 0      # 无 OAuth
grep -c "prompts"         $D/dsh-mcp-client/lib/index.js  → 0      # 无 prompts
grep -c "SSEClientTransport\|EventSource\|text/event-stream" … → 0  # 无 SSE
grep -c "StreamableHTTPClientTransport" …                 → 2      # 有 Streamable HTTP（阳性对照）
grep -c "subscribe"       $D/dsh-mcp-{client,resources}/lib/index.js → 0 / 0   # 无订阅
grep -c "roots"           …                               → 0 / 0
```
★注意 `grep -c "sse"` 会得 **5**（命中 `assertNever`(×2)、`server processes`、`…assess`、`failed` 里的子串）——
这是**必须做词形区分**的实例，本报告据此改用 `SSEClientTransport`/`EventSource`/`text/event-stream`，结论 **0**。

---

## 9. 能力对照表

图例：**F**=事实（有行号） · **I**=由源码注释/测试名推断（未运行）。「缺口」列是**我们的**缺口。

| # | 能力 | Cherry 有 | 我们有 | 缺口 | Cherry 哪条比我们弱 |
|---|---|---|---|---|---|
| 1 | stdio 传输 | **F** `mcpTransport.ts:144-202` | **F** `StdioConfig` | — | env 洗白我们更严（DSH 按 `KEY\|PASSWORD\|SECRET\|TOKEN` 正则洗父环境） |
| 2 | Streamable HTTP | **F** `:123-131` | **F** `StreamableHttpConfig` | — | — |
| 3 | **旧式 SSE** | **F** `:133-139` | **无**（§8.3） | **有**（要支持遗留服务器则必补） | — |
| 4 | **传输自动回退** | **F** `mcpClientSdk.ts:71-89` | **无** | **有** | 我们是「配错就连不上」，更差 |
| 5 | **进程内 in-memory 服务器** | **F** `:103-115` + `servers/factory.ts:15-51` | **无** | **有**（≠必须） | — |
| 6 | **14 个内建服务器** | **F** `shared/utils/mcp.ts:6-21` | **无** | **有**（产品决策，非架构缺口） | — |
| 7 | **OAuth 授权流** | **F** `McpRuntimeService.ts:557-699` + `oauth/*` | **无**（§8.3） | **有** | ★Cherry 令牌**明文落盘无 chmod**（`oauth/storage.ts:51-70`）；我们若做应走凭据服务 |
| 8 | 工具身份/命名契约 | **F** `mcpToolId.ts:38-51`（20 hex 摘要，含 serverId） | **F** README（12 hex，只含 serverName+rawName） | — | ★**我们更稳**：Cherry 删了重建服务器会改名，我们不会 |
| 9 | 工具列表缓存/预热/退避 | **F** `McpCatalogService.ts:142-155,303-322`（5min/30s 两档） | **无**（每次发现由 SDK 管） | **有**（热路径保护） | — |
| 10 | 资源发现与读取 | **F** `:1279-1377` | **F** `dsh-mcp-resources`（3 工具） | — | ★**我们更强**：Cherry 无「共享工具」概念；我们的三工具 + 服务器名提示注入是产品化封装 |
| 11 | 资源模板 | **F** `createMcpBridgeServer.ts:8` | **F** `list_mcp_resource_templates` | — | — |
| 12 | **资源订阅/更新通知** | **F** 订阅了 4 种通知 `:704-766` | **无**（README 明确不支持） | **有**（两边都弱，但 Cherry 至少**收到**通知并失效缓存） | — |
| 13 | **prompts（模板）** | **F** `:1186-1274` + UI 参数对话框 | **无**（§8.3） | **有** | — |
| 14 | 每调用超时 + 长任务 10min 上限 | **F** `mcpRequestOptions.ts:16-22` | **F** `toolCallTimeoutMs: 60_000` | **部分**（我们有超时，无 longRunning/resetTimeoutOnProgress） | — |
| 15 | 连接超时下限 180s | **F** `McpRuntimeService.ts:120,576` | **无**（沿用 SDK 60s，README 自陈为 open direction） | **有**（小） | DSH 自己把这列为「open direction」 |
| 16 | 逐调用取消（scope 隔离） | **F** `:87-89,1380-1398` | **F** README「can be cancelled like any other tool call」 | — | — |
| 17 | 取消 vs 超时的**区分** | **F** `mcpAbort.ts:16-25` | **无对应实现** | **有**（细节但真实：只看 code 会把取消当失败记 error 日志） | — |
| 18 | 工具级禁用/强制确认名单 | **F** `mcpSourcePolicy.ts:31-47` + `disabledTools:84` | **无**（我们在更上层有审批，但无逐工具名单） | **有** | — |
| 19 | 断线重连（指数退避+预算） | **F** `:207-224` 状态机 + ping 复用 `:437-466` | **F** README `reconnect.*`（10 次上限、预算重置） | — | ★大致相当，DSH 的文档化更硬（README 列了全部默认值） |
| 20 | 单飞连接（并发不重复连） | **F** `:384-415` + 测试 | **无显式（SDK 内）** | **有**（小） | — |
| 21 | 服务器凭据存储 | **F** 明文 SQLite/JSON（`oauth/storage.ts:51-70`） | **F** 走 `!!js process.env` 引用（README 例） | **无缺口** | ★**我们更安全**（Cherry 明文落盘） |
| 22 | **DXT/MCPB 包上传与生态** | **F** `McpPackageService.ts` 全篇 | **无** | **有**（大） | — |
| 23 | 包 manifest 校验 + zip-slip/折叠碰撞 | **F** `:508-511`、`:538-555` | **无**（技能侧我们有等价物，MCP 侧无包） | **有**（若做包则必补） | — |
| 24 | 恶意 manifest 运行期加固（env 黑名单/命令净化） | **F** `:125-180,224,233-260` | **无** | **有**（若做包则必补） | — |
| 25 | 协议一键安装 `mcp://install?servers=` | **F** `mcpInstall.ts:53-65` | **无** | **有** | — |
| 26 | 模型代装 MCP（审批门） | **F** `servers/mcpManager.ts` + `references/mcp.md:16-45` | **无** | **有**（★与我们的技能/插件审批同族，见 §10） | — |
| 27 | 服务器信任位（`isTrusted`/`trustedAt`） | **F** `mcpServer.ts:96-98` + `useMcpServerTrust.tsx` | **无** | **有** | Cherry 的「信任」是**用户可见的一等交互**，我们无对应物 |
| 28 | 每服务器日志环形缓冲（200 条） | **F** `ServerLogBuffer.ts:12-40` | **无**（只有宿主日志） | **有** | — |
| 29 | 日志脱敏（缓存键/头/参数） | **F** `mcpRedact.ts`、`mcpTransport.ts:129` | **F**（DSH 不把凭据写进配置） | **无缺口** | — |
| 30 | MCP 设置 UI（7 路由 + 24 组件） | **F** §6 | **无**（纯 `cordis.yml` 配置） | **有**（大） | — |
| 31 | MCP 市场 / npm 搜索 / 依赖安装器 | **F** `marketplaces.tsx` / `npx-search.tsx` / `mcp-install.tsx` | **无** | **有**（产品决策） | — |
| 32 | **反向桥接（Cherry 作为 MCP server）** | **F** `apiGateway/routes/mcp.ts:1,21-29` + `createMcpBridgeServer.ts` | **无** | **有**（独特） | — |
| 33 | agent ↔ MCP 多对多绑定 | **F** `McpServerService.ts:194-196` 注释 + `agentMcpServers.ts` | **F**（Cordis scope/`inject`，README「空 caller scope 不加任何 MCP 工具」） | — | ★**我们的 scope 更细**（per-Agent scope，Cherry 是 per-agent 行关联） |
| 34 | 服务器指令进系统提示 | **F**（`maxInstructionBytes: 32768`，超限**拒绝连接**） | **F** README「Server instructions join the logged system prompt as literal text」 | — | 我们有**字节上限**并可拒绝；Cherry 无此上限 |
| 35 | 结果图片投成原生内容 | **F** `clampToolResultImages` `:146-163` | **F** README（attachment store + 精确能力证明） | — | ★**我们更强**：Cherry 是「clamp 尺寸」，我们是「经 attachment store 持久化」 |
| 36 | 工具名跨重启稳定 | **F**（但当 serverId 变即变，§9#8） | **F** README「Survive restarts and reloads」 | — | ★**我们更强** |

**统计**：共 36 行。其中 **「缺口」非空 21 行**（#3,4,5,6,7,9,12,13,14,15,17,18,20,22,23,24,25,26,27,28,30,31,32 —— 计 22 项，含 2 项标「小/部分」）；**「Cherry 更弱」13 行**；**两边持平/各有强弱 3 行**。

---

## 10. 采纳建议与分期（★以下是**建议**，不是事实）

### 10.1 我的判断：**不要照着 Cherry 的样子做**

理由（三条，都由上表支撑）：
1. **底座不同**。Cherry 的起点是「桌面应用 + 用户自己装东西」（§6 的 7 条 UI 路由、§4.3 的包生态、§2.5 的 14 个内建服务器），
   我们的起点是「profile 声明 + scope 隔离」（§8.1 的 `serverName` 命名空间、`failOnStartupError`、env 洗白）。
   把 Cherry 的 UI/包/市场搬过来，等于在一个**没有用户安装面**的宿主上盖一栋商铺。
2. **我们已经在三条上比它强**（#8 命名契约 / #21 凭据 / #35 结果规范化），照抄会**倒退**。
3. **它最值钱的东西不是功能，是纪律**：#17（取消≠超时的判据）、#9（热路径不许连服务器）、#12（通知消费的失效语义）、
   `McpCatalogService.ts:87-105` 那条「写缓存的路径不许再触发写缓存」的事件设计 —— 这些是**架构经验**，成本低、收益明确。

### 10.2 分期（建议）

**P0 —— 补「硬缺口」里最便宜的 3 条（纯 `dsh-mcp-client` 内部改动，不碰 UI/不碰契约）**
1. **#4 传输自动回退**（`getTransportCandidates` + `isTransportFallbackError` 的形状可**逐条照抄语义**）：
   收益最大、风险最低 —— 用户配错 `sse`/`streamable-http` 也能连上。代价：约 1 人日 + 两组测试（回退成功 / 401 与 5xx **不许**回退）。
2. **#17 取消与超时的区分**：目前我们会把「用户点了停止」记成错误日志。代价：约 0.5 人日（一个纯函数 + 表驱动测试）。
3. **#3 旧式 SSE**：DSH README 自陈只支持两种传输；补 SSE 是**协议覆盖**问题，不是体验问题。代价：约 1–2 人日（SDK 自带 transport，主要是配置 schema + 文档 + 测试）。
   ★依赖：先确认目标用户是否真有遗留 SSE 服务器；**没有就不做**。

**P1 —— 产品决策后再定（都需要先回答「我们的员工怎么把 MCP 服务器弄进来」）**
4. **#26 模型代装 + #27 信任位**：这条与我们**已有的企业审批族**（技能/插件/配方）同构，且 Cherry 的 `references/mcp.md` 已经
   把「模型代装的危险与纪律」写成了可复用的文案（approval-gated / never invent a config / 默认 inactive+untrusted）。
   ★**建议先裁这一条**，因为它决定后面所有事：如果 MCP 服务器只能由管理员经 profile 下发，那么 #25/#30/#31 全都不需要。
5. **#28 每服务器日志缓冲**：成本低、纯增量，但它服务于「有 UI 能看」；没有 UI 时价值有限。
6. **#12 资源订阅**：我们 README 明确列为不支持。补它需要「通知 → 失效 → 重列」这条链，而 `dsh-mcp-resources` 现在是**按需读取**设计。

**P2 —— 我认为**不该**做的（明确写出，免得以后被当成欠账）**
7. **#5/#6 in-memory 内建服务器**：#2.5 的 14 个服务器里有 4 个（filesystem / python / browser / fetch）在我们这里
   **已经是原生工具**（`dsh-bash-local`、`dsh-bash-sandbox`、browser 能力、web_search/web_fetch）。
   再用 MCP 包一层 = 同能力两个入口，违反本项目「不造第二个实现」的既有纪律。
8. **#22/#23/#24 DXT/MCPB 包 + #31 市场/npm 搜索**：这是「桌面应用分发第三方包」的形态。
   我们若真要接第三方 MCP，更自然的路径是**现有插件分发**（`plugin-distribution` 的 sha256 内容寻址 + 原子落盘），
   而不是再造一套包格式 —— 且注意 §4.3：**Cherry 的 DXT 解包用的就是我们已经实现过的 `assertZipEntriesWithin` / `assertNoFoldedPathCollisions`**
   （`McpPackageService.ts:508-511`），说明这条能力我们**已有零件**，缺的只是产品决策。
9. **#32 反向桥接**：Cherry 需要它是因为它是**宿主应用**、要让外部 CLI 复用它的服务器。我们的架构里 DSH 自己是宿主，
   这条要么无意义、要么应由官方而非企业层决定。

### 10.3 一句话

**P0 只做 #4（传输回退）与 #17（取消判据）这两条纯内部加固，其余等「MCP 服务器从哪来」这个产品问题有答案再动。**
Cherry 在这块最值得我们抄的是它的**架构纪律**，不是它的**功能清单**。

---

## 11. 本报告没做到的事（如实列出）

1. **未运行任何 Cherry 测试、未起任何 MCP 服务器**。所有运行时行为（重连、回退、OAuth 流程）都是**读源码 + 读测试名**的结果，不是实跑观测。
2. **未读完 252 个 mcp 相关路径**。深读的是 `src/main/ai/mcp/**` 主体 + 数据模型 + IPC/API + 路由；**未深读**：
   `src/main/features/browser/mcp/**`（浏览器 MCP 工具集，12 个 tools 文件）、`src/main/ai/mcp/servers/**` 的各内建服务器实现（20+ 文件）、
   `src/main/ai/tools/adapters/aiSdk/mcp/**`（AI SDK 适配层）、`src/main/data/migration/v2/migrators/**`（v1→v2 迁移细节）。
   ⇒ §9 中「Cherry 有」的能力若涉及上述目录，**可能低估**。
3. **未读 DSH 上游源码**，只读本机已发布的 `lib/`（编译产物）+ README + `.d.ts`。README 里「open direction / deferred work」那些**计划**我没有当能力算。
4. **`readMcpResourcePreview` 的 25 条**：`resourcePreview.ts` 我读了全文（43 行），但它只覆盖 3 条测试名；其余资源测试在 `src/main/ai/tools/adapters/aiSdk/builtin/__tests__/McpResourceTools.test.ts`，**未读**。
5. **§1.3 的「无 chmod」是我读 `oauth/storage.ts:51-70` 全函数得出的**（只有 `mkdir`/`writeFile`/`rename`，无 `mode`），
   但**没有**检查上层是否在别处统一设权限；结论强度为「该文件内无」，不是「全仓无」。
6. **未评估工作量**的置信度：§10.2 的人日数是**粗估**，依据是「改动面大小」而非实测。
