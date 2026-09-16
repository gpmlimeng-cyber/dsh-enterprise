---
feature: ent-admin-cli
status: delivered
updated: 2026-09-16
branch: feat/ent-admin-cli
commits: adeea00..HEAD
---

# dsh-ent-admin CLI

## Report

**What was built** — 新增 `@dshent/ent-admin-cli`（bin `dsh-ent-admin`）：DSH Enterprise 控制面只读 CLI。鉴权复用 Desktop PKCE 设备流（`client_id=dsh-desktop`），Access Token 仅进程内存，Refresh Token 以 0600 写入 `~/.dsh-ent-admin/credentials.json`。覆盖 members/devices/providers/models/model-sets/model-grants/quotas/plugins/audit/usage 的 list|get，以及 `usage me`、`quotas windows`。`--json` 时 stdout 纯 JSON、exit 0/1/2、未登录 `ENT_AUTH_REQUIRED` exit 2；无 `--json` 时列表输出人类可读行。审计筛选 CLI kebab flag 映射为 OpenAPI camelCase query。401 认证拒绝强制 refresh 并重放一次。

**Verification** — `pnpm --filter @dshent/ent-admin-cli run typecheck` PASS；`run test` PASS 16 tests；`run build` PASS；`node --test workspace.test.mjs` PASS 4；`node lib/cli.js --help` 与未登录 `members list --json` exit 2 + `ENT_AUTH_REQUIRED` PASS。

**Journey log** — 形态从「必做 MCP」收敛为「CLI 优先、MCP 后置」，因 Agent 可直接 Bash 调 CLI。鉴权不新增 API Token，复用已上线 PKCE 设备流。独立 SDK 包 YAGNI 砍掉，逻辑内聚在 CLI 包内。Review 指出 audit query 大小写与 workspace package 白名单两处 critical，已修。

## [S1] Problem

DSH Enterprise 后台已有完整 OpenAPI 管理面（97 个 operation），但外部只有 Console Cookie 和 Desktop 内嵌 Host 两条消费路径。管理员与 AI Agent（Claude Code / Cursor / MiMo 等带 shell 的客户端）无法在终端直接、可脚本化地查询控制面，必须打开浏览器点控制台，或手写 HTTP 客户端。

## [S2] Design

### 形态

独立 Node CLI 包 `@dshent/ent-admin-cli`，bin 名 **`dsh-ent-admin`**。挂在 `plugin/packages/ent-admin-cli`，复用 workspace 的 `@dshent/contracts`（DTO / Zod / 错误码）与 `pnpm`/`vitest` 门禁。**不是** Harness 受管插件，**不是**独立发布 npm SDK。

内部模块化 `auth` / `http` / `commands`，但不导出为独立 package——第二消费者（MCP / SDK 包）出现时再抽出。

### 鉴权

复用 **Desktop PKCE 设备流**（`client_id=dsh-desktop`），不改服务端：

1. 本地生成 installation UUID v4（`~/.dsh-ent-admin/installation.json`，0600）。
2. PKCE S256 verifier/challenge；在 `127.0.0.1:<ephemeral>/callback` 起回环监听。
3. 打开系统浏览器访问 `GET /enterprise/auth/v1/authorize?client_id=dsh-desktop&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256&installation_id=...`。
4. 回环收到 `code` 后 `POST /enterprise/auth/v1/token`（JSON camelCase）换 `accessToken`（内存，12h）+ `refreshToken`。
5. `POST /enterprise/api/v1/devices/enroll` 绑定设备。
6. Refresh Token 落盘 `~/.dsh-ent-admin/credentials.json`（0600），Access Token **只存进程内存**。
7. 启动命令时若 Access 缺失/过期，用 Refresh 单次轮换；服务端 401 认证拒绝时强制 refresh 并重放一次（与 platform-client 对齐）。

Server origin 写在 `~/.dsh-ent-admin/config.json`；也可用 `--server` / `DSH_ENT_ADMIN_SERVER` 覆盖。`DSH_ENT_ADMIN_HOME` 可重定向配置目录。

### Agent 契约（stdout/stderr/exit）

- **有 `--json`**：stdout 只输出 JSON；错误也是 JSON envelope；人类日志走 stderr。
- **无 `--json`**：list 输出 `id  extra` 行；详情仍 JSON；错误文案走 stderr。
- 退出码：`0` 成功；`1` 业务/服务端错误；`2` 用法或未登录。
- 未登录时 `--json` 输出 `{"error":{"code":"ENT_AUTH_REQUIRED","retryable":false,"status":401,"requestId":null}}`。

### 命令面（第一期只读）

| 命令 | 对应 operation |
|---|---|
| `login` / `logout` / `status` | PKCE + token + bootstrap |
| `members list\|get` | listMembers / getMember |
| `devices list\|get` | listDevices / getDevice |
| `providers list\|get` | listModelProviders / getModelProvider |
| `models list\|get` | listManagedModels / getManagedModel |
| `model-sets list\|get` | listModelSets / getModelSet |
| `model-grants list` | listModelGrants |
| `quotas list\|get` | listQuotaPolicies / getQuotaPolicy |
| `quotas windows <id>` | getQuotaPolicyWindows |
| `usage me` | getMyQuotaUsage |
| `usage list` | listUsageLedger |
| `plugins list` | listPluginPackages |
| `audit list` | listAuditEvents |

分页：`--cursor`、`--limit`。审计筛选 CLI flag → OpenAPI query：`--request-id`→`requestId`，`--actor-id`→`actorId`，`--resource-type`→`resourceType`，`--resource-id`→`resourceId`，`--action`/`--from`/`--to` 同名。

### 错误

统一 `decodeEnterpriseError`，只暴露 `code` / `retryable` / `requestId`；不打印 Token、不解析 message 作控制流。

### 配置与密钥边界

| 路径 | 内容 | 权限 |
|---|---|---|
| `~/.dsh-ent-admin/config.json` | serverUrl | 0600 |
| `~/.dsh-ent-admin/installation.json` | installationId/name/createdAt | 0600 |
| `~/.dsh-ent-admin/credentials.json` | refreshToken + expiresAt + serverUrl | 0600 |

Access Token 永不落盘。不写 settings.yaml，不碰 Harness `$DSH_HOME`。

### 与既有代码关系

- **依赖** `@dshent/contracts` 的类型与 `decodeEnterpriseError`。
- **不依赖** `@dshent/platform-client`（Cordis/Harness 耦合）；PKCE/浏览器/安装 ID 在本包内自包含实现，语义对齐 T05。
- **不修改** server / contracts / console。
- **修改** `plugin/workspace.test.mjs` 正式 package 白名单纳入 `ent-admin-cli`。

## [S3] Out of Scope

- MCP Server / Streamable HTTP
- 独立 npm SDK 包（`@dshent/admin-client`）
- 任何写操作（create/update/delete/enable/disable/upload/publish）
- API Token / Service Account
- Harness 受管插件形态
- Session 同步 runtime API（V1 已停用）
- 多语言 client、交互式 TUI

## Tasks

- [x] T1: 包脚手架 — acceptance: `package.json`/`tsconfig` 进 workspace，`pnpm --filter @dshent/ent-admin-cli typecheck` 可跑（covers: S2）
- [x] T2: config + installation + credentials 存取 — acceptance: 单测覆盖读写/权限/损坏文件 fail-closed（covers: S2）
- [x] T3: PKCE login + token 轮换 + enroll — acceptance: 单测覆盖 PKCE 对、loopback state 校验、refresh 路径；登录命令在无 server 时给出稳定错误（covers: S2）
- [x] T4: http 客户端 + 错误解码 + --json 输出 — acceptance: 未登录/401/业务错误的 JSON 与 exit code 单测通过（covers: S2）
- [x] T5: 只读 domain 命令 — acceptance: `members/devices/models/.../audit` 的 list/get 对 `--json` 吐 stdout JSON；命令帮助可列出（covers: S2）
- [x] T6: workspace 门禁 — acceptance: `pnpm --filter @dshent/ent-admin-cli test` 与 typecheck 全绿；`node --test workspace.test.mjs` 通过（covers: S2）
