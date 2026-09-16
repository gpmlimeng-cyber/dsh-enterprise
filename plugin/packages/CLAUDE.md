# packages/

> L2 | 父级: ../CLAUDE.md

成员清单

bundle/: 可发布的自包含 Harness 组合包，注入官方 credentials 并聚合 Host、企业模型覆盖、本地 API、受管插件和 Client 门禁；V1 不启动 Session 同步。
contracts/: OpenAPI 生成的 DTO/Zod schema、品牌 ID、错误解码与跨语言 fixture 门禁。
ent-admin-cli/: 管理员/Agent 只读 CLI `dsh-ent-admin`，Desktop PKCE 设备流鉴权，`--json` 稳定 stdout 契约；不进入 Harness Host，不做写操作。
llm-gateway/: 官方 `dsh-llm-pi-ai` 的企业 profile 与本机认证代理桥，提供三协议动态目录/default，不实现模型协议。
platform-client/: `ctx.enterprisePlatform` Service，构建前先产出 contracts 依赖，使用官方 settings 持久化 Server 地址、官方 credentials 保存轮换 Refresh Token，并独占内存 Access Token 与认证请求。
plugin-distribution/: `ctx.enterprisePluginDistribution` Service，强制制品大小/hash/兼容性校验、默认关闭 Ed25519 验签，并提供官方 CLI、原子状态、重启确认、库存与卸载。
session-sync/: 企业 Session 同步客户端 `@dshent/session-sync`；P2b 上传链路 + P2d host-bridge（仅 sessionPolicy.enabled 时由 bundle 挂载），不导入 dsh-session 真包。
ui/: 基于 `dsh.client` 与官方 Settings/sidebar/shell.overlay slots 的 Server 配置、全局登录门禁、账号和受管插件浏览器半边。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
