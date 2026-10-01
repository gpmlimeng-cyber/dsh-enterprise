# client-plugin/

> L2 | 父级: ../CLAUDE.md

可发布的**客户端插件** `dshent-client-plugin`：把企业控制面（E1 登录 / E2 企业模型网关 / E3 用量配额 / E4 企业插件市场）接进任意 DSH 客户端。
与 `bundle/` 的区别：bundle 是自包含组合包、面向官方 Harness 且内联 `@dshent/*`；本包**不依赖 `@dshent/*`**，只依赖官方 `@deepseek-ai/*` 扩展面，因此可以装进第三方 DSH 客户端。

## 成员清单

- package.json: 可发布清单，`dsh.bundle.patch` + `dsh.client.inject`（runtime / ui-slots / ui-primitives）与官方 peer。
- tsconfig.json: 继承 `../../tsconfig.base.json`，只发声明到 `lib/types`。
- scripts/build.mjs: esbuild 双产物。Host → `lib/index.js`(esm/node22，官方运行时保持 external)；Client → `lib/client.js`(cjs/browser，`__ModuleLoader__` 包装)。
- cordis.patch.yml: 只插入 `dshent-client-plugin` 自己的 Host 行，不动宿主既有 row。
- README.md: 能力、安装、配置、安全模型与验证命令。
- docs/INTERFACES.md: **冻结的本地接口契约**，各实现文件必须遵守；改接口先改它。
- src/protocol/: 协议层（零宿主依赖）。`error-codes.ts` 由契约真源生成（56 个稳定码，与 OpenAPI `EnterpriseErrorCode` 逐字同序；新增 SKILL/BRANDING/FEEDBACK 三类时须同步 `client/messages.ts` 的穷尽文案表），`types.ts` 窄报文类型，`envelope.ts` 信封与错误折叠，`http.ts` 唯一 HTTP 出口（超时/Bearer/401 单次重放；非 raw 出口把非 2xx 折叠为 `EnterprisePlatformError`，raw 出口 `requestResponse` 原样返回 Response 供 SSE/二进制与 control-plane 自补的 401 重放消费）。
- src/config/: `schema.ts` Schemastery 配置（无凭据字段）与 `home.ts` 的 `$DSH_HOME` 解析。
- src/platform/: E1 控制面。`storage.ts` 凭据与配置落盘（0600/原子写）、`installation.ts` 设备身份、`pkce.ts` S256 与 loopback 回调、`auth.ts` 认证端点、`device.ts` 注册心跳、`control-plane.ts` 状态机与 bootstrap。
- src/gateway/: E2。`profiles.ts` bootstrap→官方 pi-ai profile 纯投影、`proxy.ts` loopback 认证代理、`register.ts` 隔离 settings 挂载官方插件并按指纹幂等更新。
- src/market/: E4。`core-packages.ts` 核心包保护、`verify.ts` 大小/哈希/签名校验、`assignments.ts` 期望状态调和、`installer.ts` 下载→校验→宿主命令安装。
- src/usage/: E3 用量与四窗口视图模型。
- src/routes/: 面向本机 UI 的 `/api/jingyun/enterprise/*` 控制器与同源 fail-closed 守卫。
- src/client/: 注入 DSH Web 插槽的设置/登录/用量/市场 React 组件（不读写令牌）。
- tests/: fixture 驱动的协议与投影单测 + mock 企业服务端集成测试；`tests/fixtures/` 复制自 `contracts/fixtures/`。`integration.test.ts` 的 `makeDshHome` 须预写 `<dshHome>/enterprise/config.json` 的 `installationId` 对齐 bootstrap fixture（`EnterpriseStore.dir` 是 `dshHome/enterprise`），否则 `resolveInstallationId` 随机生成 → bootstrap 校验不等 → 误判 `ENT_DEVICE_REVOKED`；`contract-drift.test.ts` 的错误码数量断言跟随契约真源（当前 56）。

## 纪律

1. 不依赖 `@dshent/*`；不 vendored 任何第三方客户端源码；不改客户端代码。
2. 令牌不出 Host 内存（refresh token 例外，只进 0600 凭据文件）；日志与错误消息不含令牌与口令。
3. 本机路由同源 fail-closed；loopback 代理只绑 `127.0.0.1`。
4. 报文形状以 `contracts/` 为真源，不得臆造；改协议先改契约。
5. 验证门禁：`build` + `typecheck` + `test` 全绿。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
