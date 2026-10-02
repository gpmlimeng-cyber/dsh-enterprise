# DSH Enterprise (dshent) - DSH 企业版 · 企业 Agent 管理与本地 Harness 集成平台（独立二开 monorepo）

Java 21 + Spring Boot 4.1 + Sa-Token + PostgreSQL + React 19 + TypeScript + DeepSeek Harness 插件  
对外名：**DSH Enterprise** / **DSH 企业版**；简称 **DSH-Ent**；技术前缀 **dshent**。  
历史来源 OwnDsh / RuoYi-Vue-Plus；**已脱钩，不再与上游同步**（见 FORK.md）

<directory>
.github/ - CI/发布工作流（历史从 GHCR 镜像；二开后应指向自有 registry）
server/ - 后台：管理 API、模型网关、配额、审计；owndsh-enterprise 为自研核心，owndsh-common / owndsh-system 为冻结 vendored 遗产
console/ - 后台管理界面。不是员工 Web 客户端，不移入 apps/
website/ - 遗留静态官网；新公开页面以 enterprise/site 为准
enterprise/ - 对外官网、帮助、API 文档、历史补丁和运维记录。不是客户端运行时
contracts/ - 各端共用的 OpenAPI 3.1 真源、schema、fixture 与企业核心包清单
deploy/ - 后台和控制台的 Compose、nginx、安装/备份/升级脚本；TLS 由部署方终止
docs/ - 产品预研、MVP 实施规格与逐任务验收证据
plugin/ - 自研 Harness 插件工作区。各端只引用这里打出的包，不在 apps 里再写一份
scripts/ - 开发与运维脚本（含 gen-secrets.sh 密钥生成）
upstream/ - 第三方运行时版本锁（不保存第三方源码）；插件基线为官方 Harness Desktop，见 dsh-desktop.lock.json
</directory>

<config>
AGENTS.md - Agent 工作规则与 GEB 文档协议
FORK.md - 脱钩策略、vendored 冻结、合规清单与改名计划（制度真源）
NOTICE - RuoYi-Vue-Plus / OwnDsh / dshent 版权与第三方组件说明
README.md - 面向管理员与员工的产品入口
docker-compose.yml - 根 Compose 薄入口；密钥来自 .env，不注入 .env.example
.env.example - 环境变量模板；JWT/主密钥必须外部注入
scripts/gen-secrets.sh - 生成 .env 中 SA_TOKEN_JWT_SECRET_KEY / ENT_MASTER_KEY
apps/ - 员工客户端打包层。现在只有 desktop；web 和 mobile 在有版本锁前不建目录。结构边界见 FORK.md §2
.gitignore - 密钥、依赖、构建产物排除规则
.dockerignore - 构建上下文边界
.gitattributes - 跨平台文本与换行约定
</config>

T00 建立上游源码与插件工作区，T01 验证官方插件扩展面，T02 建立跨端协议真源，T03 建立 PostgreSQL/密码学/revision/审计基础，T04 建立身份适配器与治理 API，T05 建立 PKCE/Sa-Token/设备生命周期，T06 建立 Harness 内存 Access Token、Host Refresh Grant、installation、bootstrap 刷新与同源控制面，T07 交付 Server 配置与账号入口 UI（初版经官方 Settings/sidebar/shell.overlay slot 做全屏登录门禁；门禁与 `sidebar.footer.action` 已退场，现入口是官方 `settings.launcher` 个人中心菜单加非阻断登录弹窗），T08 建立 provider/model/grant 管理与 bootstrap 模型目录，T09 建立叠加配额、PostgreSQL reservation、Redis lease、结算恢复和用量查询，T10 建立请求级模型授权、三协议透明 upstream、计费终态和双审计，T11 直接挂载官方 rc.2 `dsh-llm-pi-ai`，建立 reasoningEfforts 动态目录、default sentinel、三协议模型流和本机认证代理，T12 建立 enterprise-admin PKCE、动态权限路由及身份/设备/模型/授权/配额/用量管理控制台，T13 建立受控 tgz 验包、JCS/Ed25519 签名、CAS 制品、发布/分配、逐请求下载授权与设备库存服务端，T14 通过官方 rc.2 subprocess/inventory 与 Desktop `desktopPnpm` 建立受管插件下载验签、CLI 调和、重启确认、库存与回滚客户端，T15 建立管理端插件纵向工作台与桌面员工插件状态 tab，T16 建立官方 format v0 精确 JSONL/hash、AES-GCM、并发远端副本、正文权限、tombstone 与 retention 服务端，T17 建立基于官方 rc.2 Session/Persistence 的 dirty queue、确认游标、断点退避、远端列表与新 ID 耐久恢复客户端。当前开发与发布验证基线为官方 DeepSeek Harness Desktop 0.1.7-rc.2（上游仓库 `apps/desktop`，commit `477b4f420553e8a52c2fbccc464d7561b239c443`）。`upstream/dsh-desktop.lock.json` 与 `upstream/deepseek-harness-desktop.lock.json` 锁定同一棵官方源码树，`upstream/deepseek-harness.lock.json` 从该桌面端基线派生；不再使用社区 Desktop 2.0.3。该版本不是插件运行时硬锁，发布包仍按 Harness caret peer 接受已映射的兼容版本，并从官方运行时身份读取实际版本。同级 `dsh-desktop/` 是只读官方 checkout，源码不入库。本仓库 `apps/desktop` 是企业打包层，用这把锁构建自己的安装包，品牌和内置插件在这里配置。普通 `dsh web` 仍是兼容运行面。

**同包不并行法则**：任一 package（`plugin/packages/*`、`server/*` 模块、`console/*`、`contracts/*` 等）在同一时刻只允许**一个写者**——**跨会话、跨 Agent、跨 worktree 一律适用，没有例外**。派工前必须声明 package 级写作用域；共享文件（注册面、聚合入口、公共 spec、`client.tsx`/`local-api.ts` 一类）由**先到者独占**，后到者只提交"需要增加什么"，由 owner 落地。子代理**不可中断**，故包级互斥必须在**派工之前**保证；Teammate 虽可 `interrupt_agent`，同样禁止并行写同一 package。出现冲突即停手并交 Lead 串行化。

模型协议法则：`@deepseek-ai/dsh-llm-pi-ai` 是客户端唯一协议实现，拥有消息、tools、reasoning、replay、SSE、通用重试与 provider 兼容语义；企业层只负责认证代理、授权、配额、审计、受管模型 ID 覆盖和上游密钥注入，不增加 provider 特定重试。后续模型能力优先升级锁定 Harness/官方依赖，禁止在企业代码中复制协议 adapter 或引入第二套 AI 抽象。

转发计量法则：V29 将实测 Token 与配额扣额分开，未知 usage 不进入实测总计。发送前提交 SENT/accepted 意图，明确 4xx 拒绝（不含 408）释放，响应丢失按未知用量记录；最终 usage 先写独立快照，终态事务失败后恢复任务按该快照结算。租约覆盖等待响应头与整个流，静默上游期间串行发送 SSE 心跳，取消先关闭上游再幂等结算。Token 允许已获准请求超额全额结算，额度耗尽后拒绝新请求；并发在途请求均可完成，不承诺固定超额上限。

T18 在 T16/T17 Session 纵向边界上交付管理 metadata/正文/删除页和桌面同步/恢复/删除 tab，并以耐久 `DELETED` 游标阻止 Harness 重启后自动重传。T19 建立封闭 action metadata 白名单、tenant 隔离审计查询、365 天有界 retention、用户治理事务接缝和 heartbeat 防洪。T20 建立默认同源 CORS、无已知 JWT secret、分层请求体上限、graceful drain、未知故障日志隔离、CI 秘密扫描和 PostgreSQL/Redis/artifact/key 恢复演练。T21 建立锁定 Linux amd64 release、HTTP Compose、一次性管理员、secret、健康检查、备份恢复、升级与仅应用回滚；PostgreSQL 只创建数据库/账号，库内 V0 基础表、种子数据与后续迁移统一随 Server 由 Flyway 执行，初始管理员仍由幂等 bootstrap 创建；TLS 交给部署方现有网关，应用日志仅输出 stdout/stderr，采集保留交给运行平台。T22 退役跨模块自动总编排，改由单后端、单 Harness 的无时限本地环境逐功能人工验收；T23 在 T22 人工确认完成前不启动。

第二阶段 P2-00 至 P2-07 已完成设计冻结、独立 `console`、Beautiful UI 产品壳、PKCE/固定角色路由、模型与访问策略、插件、成员与多身份，以及权限裁剪的用量/审计/运行异常和身份接入；控制台固定五个产品入口，身份源归入成员，LDAP 组映射绑定 LDAP 行操作，不提供设置或系统页面。P2-08 已完成真实 Harness/Desktop 模型调用、Organization/Member/RPM/并发、五角色矩阵、身份源、静态资源切换与受管插件安装/升级/回滚/卸载 E2E。P2-08A 已建立扁平用户组/模型集、集合授权，以及 Organization/Member × All Models/Model Set/Model 的 TOKEN/RATE 互斥策略，并允许 Organization × Provider 的共享 RATE 上限；四窗口 Token 走 PostgreSQL 预留，RPM/并发走既有 Redis lease，重叠策略已由锁定 Harness E2E 覆盖。P2-08B 已实现 LDAP 单人导入、组目录有界发现与产品用户组显式映射，不扩展目录镜像或定时同步；V1 Session 客户端已停用，上游 429 在 HTTP 提交前区分瞬时限流与硬额度并保留 `Retry-After`。P2-09 已移除旧管理前端，生产与开发均只保留 `console`。

P2-08C 将产品控制台会话收敛为服务端 Sa-Token 与 HttpOnly/SameSite=Strict host-only Cookie；HTTPS 使用 `__Host-enterprise-admin` 与 Secure，HTTP 使用 `enterprise-admin`。管理端以 shadcn authentication 双栏骨架和产品 tokens 原生承载 LOCAL/LDAP 登录，多个 OIDC 仍按身份源独立跳转。浏览器 JavaScript 不读取或保存 Token，管理 API Filter 在 MVC 权限注解前桥接协议对应 Cookie，新标签直接复用会话；注销和本人改密由服务端撤销会话并清 Cookie，其他标签在下次请求或刷新时返回登录。Desktop/Harness Host 使用内存 Bearer Access Token 与官方 credentials Refresh Grant。

员工客户端发行规则：标准 `dshent-plugin` 继续独立发布；可选 Pake 客户端已迁至 `boe1900/owndsh-desktop`，从 npm 消费官方 Harness 与插件，独立构建 macOS Intel/ARM 与 Windows x64，版本锁和窗口/服务生命周期由桌面仓库管理，不依赖社区 Desktop。桌面 profile 独立存放于应用数据目录，不预填 Server，不随包携带用户配置。插件零业务配置可安装，首次启动在官方 `settings.launcher` 个人中心菜单与登录弹窗中填写 HTTP(S) Server 地址并登录，不阻断官方界面；地址写入 Harness 官方 settings 中本插件 owner entry（id `owndsh`）的 volatile 字段（经 `settings.update`）；协议安全由部署方决定，插件只校验 origin 结构。Access Token 只在 Host 内存，30 天单次轮换 Refresh Token 只进入官方 credentials provider；Desktop/CLI/Web profile 重启后进行一次静默恢复；闲置时无企业 SSE、状态轮询或提前续期。请求时按需轮换 Access Token，服务端 401 最多续期重放一次；网络错误保留 Grant，用户重试恢复。UI 复用宿主模型/凭据/设置事件读取本地状态，登录期间只作有截止时间的临时查询。登录过期/设备撤销时账号区显示失效状态与登录入口，不阻断宿主。显式卸载通过官方插件命令移除 DSH Enterprise 与受管包。

服务地址边界：账号设置只读显示 Server；退出登录后在登录弹窗的地址编辑器修改。Host 将运行时修改收敛到无活动会话时的凭据清理与官方 settings 写入，保存与登录互斥；浏览器在服务/账号切换时丢弃旧请求结果。

我的用量：员工在个人中心菜单「我的用量」查看企业四窗口（5 小时/日/周/月）Token 用量（限额·已用·剩余与重置时刻）。Access Token 只在 Host 内存，故由 Host 提供只读本地路由 `GET /enterprise/api/v1/local/usage`（代取中心 `/enterprise/api/v1/usage/me`，剥掉上游 `requestId` 只留单键信封）：上游 401/会话过期投影 401、其余失败投影 503 并留 warn、非 GET 405；未登录时不发请求，失败文案复用既有错误码映射。

问题反馈：员工在个人中心菜单「帮助与反馈」提交问题/建议。中心接口 `POST /enterprise/api/v1/feedback` 为 **multipart**（`metadata` JSON + 同名可重复 `attachments`），需登录且提交者与 installationId **取服务端会话**（不信任请求体）；描述 1..510、`consent` 必须为 true、`diagnostics` 键集封闭（pluginVersion/hostVersion/os/installationId/lastErrorCode，服务端白名单+正则裁剪）；附件 ≤3 张、位图仅 PNG/JPEG/WebP（**显式拒 SVG**）、单张 ≤2 MiB、单边 ≤8192px，按魔数与尺寸校验；`Idempotency-Key` 选填 UUID v4 支持重放。管理端 `console` `/feedback` 页按状态分诊（NEW/TRIAGED/RESOLVED/IGNORED，`If-Match` revision）并写审计；V34 迁移建立两张表、`ent:feedback` 权限码与 C 型「问题反馈」菜单节点。员工端由 Host 提供 multipart 透传的本地路由并在本地先做同样限流。

品牌自定义：企业后台集中配置品牌（LOGO/企业名称/欢迎语/版本标识），员工端插件按配置呈现。服务端 `GET /enterprise/api/v1/branding` 免登录只读、只回白名单字段，返回 `revision` 与带 revision 的不可变资源地址；资源仅位图 MIME 白名单（显式拒 SVG 以免脚本面）、单文件 512KB 上限、平台同源，服务端不代拉任何远端 URL。管理端 `console` 品牌页由 `enterprise_admin` 上传/预览/发布/回滚并写审计（`V32__enterprise_branding.sql`）。客户端由 Host 侧取数（避免浏览器跨域）并缓存到 `$DSH_HOME/enterprise/branding.json` 与本地资源副本，经只读本地路由 `GET /enterprise/api/v1/local/branding`（资源 `/branding/asset/{light|dark|square}`）交给 UI；接口缺失/未配置/离线/超时/资源非法一律回落内置默认，不阻断界面。一期字段 `name`/`shortName`/`logo.{light,dark,square}`/`welcome.{headline,editionLabel}`；可见范围全局单例，表预留可空 `organization_id` 以便按组织扩展。

企业插件市场：后端上传、发布与 ALL/USER 可见范围管理复用现有插件模块；员工在「DSH Enterprise 设置 → 插件」内搜索、查看详情并自主安装/切换版本/卸载。同一份数据的第二个入口是官方侧栏插件页「官方」分组里的「插件市场」卡片（官方 `plugins.item` 槽位，只加卡片、不顶替官方页面）；二期结构切片后另有**独立应用商店**的侧栏一级入口「应用商店」（官方 `sidebar.panellist`，id/order 20）与主内容区整页面板（官方 `main` key `enterprise-store`），两处注册的是同一个市场组件、点进去都是同一份三页签商店（企业技能/企业插件/组件，默认企业技能），官方卡片保留并存。revision 不再触发安装，历史 required 也不强制；删除范围或退休只停止新安装，显式 ABSENT 才撤回已有受管包。签名、兼容性、逐请求授权与库存边界保留。部署时必须升级员工插件，旧客户端不会仅因后台变更自动转为自选模式。

企业配方广场：托管 Desktop `dsh-preset` v1 的 `.dshpreset` 包。控制台独立 `/presets` 纵向由 `plugin_admin`/`enterprise_admin` 上传、验包、发布/退休并原子替换 ALL/USER 可见范围；员工在「DSH Enterprise 设置 → 配方」浏览并复制导入指令，经 loopback `agent-preset.import` 安装。一期不做员工投稿、一键安装、设备配方库存与 Ed25519 签名；退休只停止新下载，不远程撤回本机已装配方。

企业技能目录：托管 DSH 标准技能包 `.dshskill`（`manifest.json` `format=dsh-skill` `version=1` + `skills/<name>/SKILL.md`，一包可含多个技能条目，frontmatter 遵循官方 `dsh-skill`/`dsh-skill-filesystem` 的 `name`（kebab-case）/`description`/`whenToUse` 与 `disable-model-invocation`/`user-invocable` 调用策略）。控制台独立 `/skills` 纵向由 `plugin_admin`/`enterprise_admin` 上传、验包、发布/退休并原子替换 ALL/USER 可见范围；员工在「DSH Enterprise 设置 → 技能」浏览并**一键安装**：Host 代取 Access Token 拉中心 `versions/{id}/download` 流式制品、强制校验 size+SHA-256、解 `.dshskill`（解压前路径逃逸/符号链接门禁）后原子落盘到官方 user-dsh 技能根 `~/.dsh/skills/<name>/SKILL.md`，由官方 `skill-filesystem` watcher 直接生效（**无需重启**；`<projectRoot>/.dsh/skills/` 仍是官方另一条根）；已装行显示已装态并可卸载，「复制装配指令」保留为交给用户自己 Agent 会话的第二条路。安装=落盘，**不执行**包内任何脚本（官方 0.2.0-rc.2 无 skills 安装 RPC，故这里只写官方发现契约承认的形状）。验包拒绝路径逃逸、`skills/` 子树外的旁路目录、非法/非 kebab-case 技能名、缺失 frontmatter、旧调用字段与包内重名；服务端只存 frontmatter 脱敏投影（jsonb）与内容寻址制品，**不存 SKILL.md 正文**。员工端一期不做员工投稿，二期补齐了一键安装（下载+SHA-256校验+落盘，见 `plugin/packages/bundle/src/skill-install.ts`）；仍不做设备技能库存与 Ed25519 签名；退休只停止新下载，不远程撤回本机已装配技能。

插件验签策略：客户端 `verifyPluginSignatures` 默认 false，HTTP 内网部署无需员工配置公钥；文件大小、SHA-256、兼容性、逐请求授权与核心包保护始终生效。显式开启后仅信任安装层配置的 Ed25519 公钥，目录、下载和缓存都严格验签，服务端响应无权关闭校验或替换信任根。服务端 `ENT_PLUGIN_SIGNING_ENABLED` 同样默认 false，关闭时不加载私钥、不生成签名；数据库保留非空 bytea，以零长度表示未签名，HTTP `signatureBase64` 对应空字符串，无需迁移。开启签名仅影响新上传版本，不补签旧制品。Docker 与离线安装默认不提供签名密钥；升级时先更新员工插件，旧客户端无法解析无签名版本。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
