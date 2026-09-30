# jingyun-enterprise/

> L2 | 父级: ../../CLAUDE.md

DSH 企业版客户端集成包：把 `repo/dsh-enterprise-main`（dshent 控制面）的能力**原生移植**进 jingyun 客户端发行版。
不依赖 `@dshent/*` 任何包，只依赖官方 `@deepseek-ai/*`。协议真源是企业仓库的 `contracts/`（OpenAPI 3.1 + 50 JSON Schema + fixture）。

## 成员清单

### 配置与构建
- package.json: 包名 `@jingyun-ai/jingyun-enterprise`，Host/Client 双产物出口，`dsh.bundle.patch` 与 `dsh.client` 声明。
- tsconfig.json: 严格模式 TS 配置，覆盖 `src/**` 与 `tests/**`。
- tsdown.config.ts: 双产物构建。Host → `lib/index.mjs`(esm/node)；Client → `lib/client.js`(cjs/browser，`__ModuleLoader__` 包装)。
- cordis.patch.yml: 向 profile 插入 `jingyun-enterprise` Host 行。

### src/protocol/ 协议层（零宿主依赖，可单测）
- error-codes.ts: 由契约真源生成的 46 个稳定 `ENT_*` 码 + 客户端本地码，唯一错误码字面量真源。
- types.ts: 客户端可见报文的窄类型（bootstrap/token/auth/device/assignment/quota/usage），凭据不经此处持久化。
- envelope.ts: `{data, requestId}` 成功信封与 `{error:{code,message,requestId,retryable}}` 失败信封的解析与错误构造。
- http.ts: 带超时、Bearer 注入、401 单次续期重放的 HTTP 客户端。

### src/platform/ 控制面（E1）
- storage.ts: `$DSH_HOME/enterprise/` 下的服务地址、installation、凭据读写；凭据文件权限收紧。
- installation.ts: installationId(UUIDv4) 生成与持久化，设备名解析。
- pkce.ts: S256 code verifier/challenge、state、transaction、loopback 回调等待。
- auth.ts: `authorize/sources/password/token/logout` 的纯协议客户端。
- device.ts: `devices/enroll` 与 `devices/heartbeat`。
- control-plane.ts: 连接状态机（UNCONFIGURED→…→READY）、bootstrap 快照、订阅、网关透传请求。

### src/gateway/ 企业模型（E2）
- profiles.ts: bootstrap 模型目录 → 官方 `dsh-llm-pi-ai` provider profile 纯投影。
- proxy.ts: Host 私有 loopback 认证代理，只做 Bearer 注入与路径转发，不实现任何 LLM wire 语义。
- register.ts: 隔离 settings 挂载官方 pi-ai 插件，并按 bootstrap 指纹幂等更新。

### src/market/ 企业插件市场（E4）
- core-packages.ts: 核心包保护名单（与企业契约 `plugin-core-packages.json` 对齐）。
- verify.ts: 大小、SHA-256、核心包、Ed25519 签名四道校验，验签默认关闭。
- assignments.ts: assignment 视图模型与期望状态（INSTALLED/ABSENT）调和计划。
- installer.ts: 下载→校验→经宿主插件命令安装/卸载的执行器。

### src/usage/ 用量与配额（E3）
- service.ts: `usage/me` 查询与四窗口（5h/日/周/月）视图模型。

### src/routes/ 与 src/client/
- routes/: 面向本地 UI 的 `/api/jingyun/enterprise/*` 控制器。
- client/: 注入 DSH Web 插槽的企业设置/登录/用量/市场 React 组件。

### docs/ 与 tests/
- docs/INTERFACES.md: 冻结的本地接口契约（各实现文件必须遵守）。
- tests/: fixture 驱动的协议与投影单测，以及 mock 企业服务端集成测试。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
