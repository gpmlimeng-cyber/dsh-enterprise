# DSH Enterprise 企业管理平台 API

DSH Enterprise（DSH 企业版）是面向企业的 Agent 治理平台。本页是平台 HTTP 协议的唯一对外说明，**由契约 `contracts/enterprise-openapi.yaml` 在构建期自动生成**——接口、字段、错误码均与线上服务同版，不存在"文档写的是旧版"的情况。页脚展示的协议指纹可用于与线上代码逐字核对。

- **接口规模**：4 个命名空间、97 个操作、230 个数据模型、42 个稳定错误码
- **协议版本**：`0.1.0`（OpenAPI 3.1）
- **命名空间**：`/enterprise/admin/v1`（控制台管理）、`/enterprise/api/v1`（员工终端）、`/enterprise/auth/v1`（授权登录）、`/enterprise/gateway/v1`（模型网关）

---

## 我应该从哪里开始

| 你的角色 | 建议路径 |
|---|---|
| 集成管理后台 / 写自动化脚本 | 用**控制台浏览器会话**调管理端 API：登录后直接在控制台内打开本页，页面同源，`Try it out` 会自动携带会话 Cookie |
| 开发桌面端 / 编辑器插件 | 走 **PKCE 授权码 + Token 交换**：`/enterprise/auth/v1/authorize` → `/enterprise/auth/v1/token`（详见下文） |
| 接入模型能力（OpenAI/Anthropic 兼容） | 直接调 **模型网关** `/enterprise/gateway/v1/*`，请求只用平台托管别名，成功响应是 SSE 流 |
| 排查线上问题 | 先查 **错误码字典**（本页底部），再查 `/healthz` |

---

## 快速开始

### 1. 控制台浏览器会话（管理端 API，推荐用 Try it out）

控制台使用**同源 HttpOnly Cookie** 作为会话凭据，JavaScript 接触不到 Token：

```bash
# 浏览器里已登录控制台时，本页的 Try it out 直接可用（同源携带 Cookie）
# 若要用命令行复现，从浏览器开发者工具复制 Cookie 后：
curl -s http://<你的控制台地址>/enterprise/admin/v1/bootstrap \
  -H 'Cookie: enterprise-admin=<粘贴会话 Cookie>'
```

要点：
- Cookie 名在 HTTP 下是 `enterprise-admin`，在 HTTPS 下自动变为 `__Host-enterprise-admin`（`Secure` + host-only）。浏览器负责处理，代码无需区分。
- 属性为 `HttpOnly; SameSite=Strict; Path=/`，因此**只有同源页面**能带上它，跨站请求天然失效。
- 所有**非 GET** 请求还会校验 `Origin`（缺失时看 `Referer`）必须与请求同源；不一致返回 `401 ENT_AUTH_REQUIRED`。这是该平台的 CSRF 防线，不是配置错误。
- 权限粒度是 `ent:*` 权限码（如 `ent:member:write`）。`GET /enterprise/admin/v1/bootstrap` 会返回当前账号的权限清单；权限不足返回 `403 ENT_PERMISSION_DENIED`。

### 2. 桌面端 / 插件：PKCE 授权码换 Token

```bash
# ① 生成 PKCE 参数（code_verifier 48 字节随机，S256 挑战）
VERIFIER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-64)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr '+/' '-_' | tr -d '=')

# ② 浏览器打开授权地址（未登录会先引导登录），回调拿到 code
#    GET /enterprise/auth/v1/authorize?client_id=dsh-desktop&redirect_uri=<白名单地址>
#        &code_challenge=<CHALLENGE>&code_challenge_method=S256&state=<随机值>
#    redirect_uri 必须在客户端白名单内，否则 400 ENT_INVALID_REDIRECT_URI
#    缺少 PKCE 参数则 400 ENT_PKCE_REQUIRED

# ③ 授权码换 Token（授权码一次性，重复使用返回 401 ENT_AUTH_CODE_INVALID）
curl -s -X POST http://<你的控制台地址>/enterprise/auth/v1/token \
  -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"dsh-desktop\",\"code\":\"<上一步的 code>\",\"codeVerifier\":\"$VERIFIER\",\"redirectUri\":\"<与上一步完全一致>\"}"

# ④ 用返回的 Token 调员工端 API（Sa-Token Bearer）
curl -s http://<你的控制台地址>/enterprise/api/v1/bootstrap \
  -H 'Authorization: Bearer <accessToken>'
```

### 3. 模型网关（OpenAI / Anthropic 兼容，SSE 流式）

```bash
curl -N -X POST http://<你的控制台地址>/enterprise/gateway/v1/chat/completions \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "enterprise/default",
    "messages": [{"role": "user", "content": "用一句话解释什么是 Agent 治理"}],
    "stream": true
  }'
```

要点：
- `model` **只能**填平台托管别名或 `enterprise/default`。上游真实模型名、供应商地址与凭据不接受透传（填了会 400）。
- 成功响应是 `text/event-stream`；**只有失败**才返回企业 JSON 错误信封。
- 推理模型可用 `thinking.type` 与 `reasoning_effort=high|max`（需该托管模型支持）。
- 未授权该模型 → `403 ENT_MODEL_NOT_ASSIGNED`；配额用尽 → `429 ENT_QUOTA_*`（见错误码字典）。

---

## 通用约定

### 成功信封与分页

- 企业 API 的成功响应统一为 `{ "data": …, "requestId": "…" }`；网关的流式成功响应例外。
- 列表接口使用**服务端签名的 opaque cursor**：`?cursor=<cursor>&limit=50`。cursor 不可解析、不可自行构造，客户端只应原样回传。
- 失败响应统一为 `{ "error": { "code": "ENT_…", "message": …, "details": … }, "requestId": "…" }`，`requestId` 是排查日志的关键。

### 条件写与并发

- 更新/撤销类接口要求 `If-Match: <revision>`（乐观锁）。版本不匹配返回 `409 ENT_REVISION_CONFLICT`：请重新读取资源、拿到新 `revision` 后重试，不要盲目重试。
- 批量类接口（如批量授权、插件分配）是"请求-结果"语义：同一幂等键重复提交会返回 `409 ENT_REQUEST_ALREADY_COMPLETED`，进行中返回 `409 ENT_REQUEST_IN_PROGRESS`。
- 覆盖式（replace）接口是**全量替换**语义：未出现在请求中的既有条目会被移除。

### 限流与重试

| 现象 | 建议 |
|---|---|
| `429 ENT_QUOTA_RPM_EXCEEDED` / `ENT_QUOTA_CONCURRENCY_EXCEEDED` | 指数退避 + 抖动重试；并发超限时降低并发而非重试 |
| `429 ENT_QUOTA_*_EXCEEDED`（5h/日/周/月） | 不要重试，等窗口重置或申请提额；窗口重置时间可从配额窗口接口读取 |
| `429 ENT_UPSTREAM_RATE_LIMITED` | 上游限流，退避重试；持续出现需管理员调整供应商通道 |
| `502/503/504 ENT_UPSTREAM_*` / `ENT_PLATFORM_UNAVAILABLE` | 幂等操作可退避重试；写操作请先确认上一次是否已生效 |

### 认证方式总览

| 场景 | 方式 | 说明 |
|---|---|---|
| 控制台（本页 Try it out） | Cookie `enterprise-admin` / `__Host-enterprise-admin` | 同源、HttpOnly、SameSite=Strict；非安全方法有同源校验 |
| 桌面端 / Harness / 脚本 | `Authorization: Bearer <Sa-Token>` | 由 `/enterprise/auth/v1/token` 交换得到 |
| 模型网关 | `Authorization: Bearer <Sa-Token>` | 与其他员工端 API 共用同一 Token |
| 授权/登录接口 | 无需预先认证 | 登录事务需要该事务自带的 CSRF 令牌 |

> 平台的 CORS 默认**拒绝所有跨域来源**（`allowed-origin patterns: []`），管理端与员工端均设计为同源/服务端调用。请不要尝试从第三方域名直接调用管理端 API。

---

## 版本与变更

- 本页内容由契约自动生成，**契约变更即文档变更**；页脚协议指纹等于 `contracts/generated/protocol-sha256.txt` 的当前值。
- 契约生成物的漂移门禁（上游仓库）：

```bash
cd plugin
pnpm --filter @dshent/contracts check:generated   # 内容比对，不修改工作区
```

- 生产可观测性入口：`GET /healthz` → `{"status":"UP"}`。
