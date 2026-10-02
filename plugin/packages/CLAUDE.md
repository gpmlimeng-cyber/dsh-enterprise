# packages/

> L2 | 父级: ../CLAUDE.md

成员清单

bundle/: 可发布的自包含 Harness 组合包，注入官方 credentials 并聚合 Host、企业模型覆盖、本地 API、受管插件、条件 Session 同步与 Client 账号入口；停用官方 `deepseek-account` 行后按本插件 owner entry（id `owndsh`）的 volatile 地址以自定义地址热重挂官方账户实现，默认 sessionPolicy 关闭时不启动同步；另以 `GET /enterprise/api/v1/local/usage` 由 Host 代取中心 `usage/me`（Access Token 不进浏览器，上游 401 投影 401、其余失败投影 503）；同处提供三条同源只读/写路由：用量镜像（`usage-route.ts`，代取中心 `/usage/me`、令牌不进浏览器）、**反馈 multipart 透传**与**帮助中心出口**（`help-route.ts`：地址由 Host 自持平台地址派生，浏览器无法注入 URL）（`feedback-route.ts`：Host 采集 diagnostics 覆盖浏览器字段、本地按中心同口径限流、按魔数重写附件 content-type 并更换 boundary）
client-plugin/: 可发布的**客户端插件** `dshent-client-plugin`，把 E1 登录/令牌/设备、E2 企业模型网关、E3 用量配额、E4 企业插件市场接进任意 DSH 客户端；不依赖 `@dshent/*`，只依赖官方 `@deepseek-ai/*` 扩展面，用于第三方 DSH 客户端（如 Jingyun DSH Client）而不 vendored 其源码。
contracts/: OpenAPI 生成的 DTO/Zod schema、品牌 ID、错误解码与跨语言 fixture 门禁。
ent-admin-cli/: 管理员/Agent 只读 CLI `dsh-ent-admin`，Desktop PKCE 设备流鉴权，`--json` 稳定 stdout 契约；不进入 Harness Host，不做写操作。
llm-gateway/: 在 profile 已挂载的官方 `dsh-llm-pi-ai` 上并入企业 route 与本机认证代理桥，提供三协议动态目录/default，不实现模型协议，也不自建第二份实例。
platform-client/: `ctx.enterprisePlatform` Service，构建前先产出 contracts 依赖，使用官方 settings 持久化 Server 地址、官方 credentials 保存轮换 Refresh Token，并独占内存 Access Token 与认证请求。
plugin-distribution/: `ctx.enterprisePluginDistribution` Service，强制制品大小/hash/兼容性校验、默认关闭 Ed25519 验签，并提供官方 CLI、原子状态、重启确认、库存与卸载。
session-sync/: 企业 Session 同步客户端 `@dshent/session-sync`；P2b 上传链路 + P2d host-bridge（仅 sessionPolicy.enabled 时由 bundle 挂载），不导入 dsh-session 真包。
ui/: 基于 `dsh.client` 与官方 `settings.section`/`settings.launcher`/`plugins.item`/`main`/`sidebar.panellist` slots 的 Server 配置、账号入口与登录弹窗、个人中心「我的用量」行内折叠快捷块（默认折叠、首次展开才取数，三列＝周期｜剩余额度百分比｜详情预留）、账号和受管插件浏览器半边，以及**独立应用商店（一份实现两处入口）**：官方插件页「官方」分组里的插件市场入口卡片仍保留，同时新增侧栏一级入口「应用商店」（`sidebar.panellist`，id 与 `main.key` 同为 `enterprise-store`、order 20、图标 `EnterpriseStoreIcon`）与主内容区整页面板（`main`，注册时注入恒定的 `view:'page'`），两处注册的是同一个 `EnterpriseMarketPage`，点进去都是**三页签商店整页**（企业技能 / 企业插件 / 组件，默认「企业技能」，页签条手写 `role="tablist"`；官方 `SegmentedTabs` 因编译期 pin 未对齐而不用）；全屏门禁已退场（未登录不阻断宿主），`inject` 声明含官方 `layout`（供跳回官方插件列表）；「帮助与反馈」multipart 弹窗（含粘贴截图、occurredAt 随 type 显隐、diagnostics 由 Host 采集、失败文案复用既有映射），设置分区标题统一为「企业设置」。