# DSH Enterprise (dshent) - DSH 企业版 · 企业 Agent 管理与本地 Harness 集成平台（独立二开 monorepo）

Java 21 + Spring Boot 4.1 + Sa-Token + PostgreSQL + React 19 + TypeScript + DeepSeek Harness 插件  
对外名：**DSH Enterprise** / **DSH 企业版**；简称 **DSH-Ent**；技术前缀 **dshent**。  
历史来源 OwnDsh / RuoYi-Vue-Plus；**已脱钩，不再与上游同步**（见 FORK.md）

<directory>
.github/ - CI/发布工作流（历史从 GHCR 镜像；二开后应指向自有 registry）
server/ - Java 后端；owndsh-enterprise 为自研核心，owndsh-common / owndsh-system 为冻结 vendored 遗产
console/ - Vite/TanStack 产品控制台，静态路由与 OpenAPI Fetch client
website/ - 零依赖静态官网（上游遗留；对外营销站以 enterprise/site 为准）
enterprise/ - 企业部署层 monorepo 目录：官网 / 帮助 / API 文档 / patches / 运维与分析
contracts/ - OpenAPI 3.1 协议真源、跨语言 schema、fixture 验收与企业核心包清单（plugin-core-packages.json）
deploy/ - Compose、nginx、安装/备份/升级脚本；TLS 由部署方终止
docs/ - 产品预研、MVP 实施规格与逐任务验收证据
plugin/ - pnpm workspace，构建标准 Harness 插件；只使用官方扩展点
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
apps/ - 企业桌面打包层；用锁定的官方 Harness Desktop 构建自己的安装包，不入库上游源码
.gitignore - 密钥、依赖、构建产物排除规则
.dockerignore - 构建上下文边界
.gitattributes - 跨平台文本与换行约定
</config>

T00 建立上游源码与插件工作区，T01 验证官方插件扩展面，T02 建立跨端协议真源，T03 建立 PostgreSQL/密码学/revision/审计基础，T04 建立身份适配器与治理 API，T05 建立 PKCE/Sa-Token/设备生命周期，T06 建立 Harness 内存 Access Token、Host Refresh Grant、installation、bootstrap 刷新与同源控制面，T07 通过官方 Settings/sidebar/shell.overlay slot 交付 Server 配置与登录门禁，T08 建立 provider/model/grant 管理与 bootstrap 模型目录，T09 建立叠加配额、PostgreSQL reservation、Redis lease、结算恢复和用量查询，T10 建立请求级模型授权、三协议透明 upstream、计费终态和双审计，T11 直接挂载官方 rc.2 `dsh-llm-pi-ai`，建立 reasoningEfforts 动态目录、default sentinel、三协议模型流和本机认证代理，T12 建立 enterprise-admin PKCE、动态权限路由及身份/设备/模型/授权/配额/用量管理控制台，T13 建立受控 tgz 验包、JCS/Ed25519 签名、CAS 制品、发布/分配、逐请求下载授权与设备库存服务端，T14 通过官方 rc.2 subprocess/inventory 与 Desktop `desktopPnpm` 建立受管插件下载验签、CLI 调和、重启确认、库存与回滚客户端，T15 建立管理端插件纵向工作台与桌面员工插件状态 tab，T16 建立官方 format v0 精确 JSONL/hash、AES-GCM、并发远端副本、正文权限、tombstone 与 retention 服务端，T17 建立基于官方 rc.2 Session/Persistence 的 dirty queue、确认游标、断点退避、远端列表与新 ID 耐久恢复客户端。当前开发与发布验证基线为官方 DeepSeek Harness Desktop 0.1.7-rc.1（上游仓库 `apps/desktop`，commit `46a7f68b0922371ce7144b668b90e377d8e799f4`）。`upstream/dsh-desktop.lock.json` 与 `upstream/deepseek-harness-desktop.lock.json` 锁定同一棵官方源码树，`upstream/deepseek-harness.lock.json` 从该桌面端基线派生；不再使用社区 Desktop 2.0.3。该版本不是插件运行时硬锁，发布包仍按 Harness caret peer 接受已映射的兼容版本，并从官方运行时身份读取实际版本。同级 `dsh-desktop/` 是只读官方 checkout，源码不入库。本仓库 `apps/desktop` 是企业打包层，用这把锁构建自己的安装包，品牌和内置插件在这里配置。普通 `dsh web` 仍是兼容运行面。

模型协议法则：`@deepseek-ai/dsh-llm-pi-ai` 是客户端唯一协议实现，拥有消息、tools、reasoning、replay、SSE、通用重试与 provider 兼容语义；企业层只负责认证代理、授权、配额、审计、受管模型 ID 覆盖和上游密钥注入，不增加 provider 特定重试。后续模型能力优先升级锁定 Harness/官方依赖，禁止在企业代码中复制协议 adapter 或引入第二套 AI 抽象。

转发计量法则：V29 将实测 Token 与配额扣额分开，未知 usage 不进入实测总计。发送前提交 SENT/accepted 意图，明确 4xx 拒绝（不含 408）释放，响应丢失按未知用量记录；最终 usage 先写独立快照，终态事务失败后恢复任务按该快照结算。租约覆盖等待响应头与整个流，静默上游期间串行发送 SSE 心跳，取消先关闭上游再幂等结算。Token 允许已获准请求超额全额结算，额度耗尽后拒绝新请求；并发在途请求均可完成，不承诺固定超额上限。

T18 在 T16/T17 Session 纵向边界上交付管理 metadata/正文/删除页和桌面同步/恢复/删除 tab，并以耐久 `DELETED` 游标阻止 Harness 重启后自动重传。T19 建立封闭 action metadata 白名单、tenant 隔离审计查询、365 天有界 retention、用户治理事务接缝和 heartbeat 防洪。T20 建立默认同源 CORS、无已知 JWT secret、分层请求体上限、graceful drain、未知故障日志隔离、CI 秘密扫描和 PostgreSQL/Redis/artifact/key 恢复演练。T21 建立锁定 Linux amd64 release、HTTP Compose、一次性管理员、secret、健康检查、备份恢复、升级与仅应用回滚；PostgreSQL 只创建数据库/账号，库内 V0 基础表、种子数据与后续迁移统一随 Server 由 Flyway 执行，初始管理员仍由幂等 bootstrap 创建；TLS 交给部署方现有网关，应用日志仅输出 stdout/stderr，采集保留交给运行平台。T22 退役跨模块自动总编排，改由单后端、单 Harness 的无时限本地环境逐功能人工验收；T23 在 T22 人工确认完成前不启动。

第二阶段 P2-00 至 P2-07 已完成设计冻结、独立 `console`、Beautiful UI 产品壳、PKCE/固定角色路由、模型与访问策略、插件、成员与多身份，以及权限裁剪的用量/审计/运行异常和身份接入；控制台固定五个产品入口，身份源归入成员，LDAP 组映射绑定 LDAP 行操作，不提供设置或系统页面。P2-08 已完成真实 Harness/Desktop 模型调用、Organization/Member/RPM/并发、五角色矩阵、身份源、静态资源切换与受管插件安装/升级/回滚/卸载 E2E。P2-08A 已建立扁平用户组/模型集、集合授权，以及 Organization/Member × All Models/Model Set/Model 的 TOKEN/RATE 互斥策略，并允许 Organization × Provider 的共享 RATE 上限；四窗口 Token 走 PostgreSQL 预留，RPM/并发走既有 Redis lease，重叠策略已由锁定 Harness E2E 覆盖。P2-08B 已实现 LDAP 单人导入、组目录有界发现与产品用户组显式映射，不扩展目录镜像或定时同步；V1 Session 客户端已停用，上游 429 在 HTTP 提交前区分瞬时限流与硬额度并保留 `Retry-After`。P2-09 已移除旧管理前端，生产与开发均只保留 `console`。

P2-08C 将产品控制台会话收敛为服务端 Sa-Token 与 HttpOnly/SameSite=Strict host-only Cookie；HTTPS 使用 `__Host-enterprise-admin` 与 Secure，HTTP 使用 `enterprise-admin`。管理端以 shadcn authentication 双栏骨架和产品 tokens 原生承载 LOCAL/LDAP 登录，多个 OIDC 仍按身份源独立跳转。浏览器 JavaScript 不读取或保存 Token，管理 API Filter 在 MVC 权限注解前桥接协议对应 Cookie，新标签直接复用会话；注销和本人改密由服务端撤销会话并清 Cookie，其他标签在下次请求或刷新时返回登录。Desktop/Harness Host 使用内存 Bearer Access Token 与官方 credentials Refresh Grant。

员工客户端发行规则：标准 `dshent-plugin` 继续独立发布；可选 Pake 客户端已迁至 `boe1900/owndsh-desktop`，从 npm 消费官方 Harness 与插件，独立构建 macOS Intel/ARM 与 Windows x64，版本锁和窗口/服务生命周期由桌面仓库管理，不依赖社区 Desktop。桌面 profile 独立存放于应用数据目录，不预填 Server，不随包携带用户配置。插件零业务配置可安装，首次启动以官方 `shell.overlay` 全屏要求填写 HTTP(S) Server 地址并登录，地址写入 Harness 官方 settings；协议安全由部署方决定，插件只校验 origin 结构。Access Token 只在 Host 内存，30 天单次轮换 Refresh Token 只进入官方 credentials provider；Desktop/CLI/Web profile 重启后进行一次静默恢复；闲置时无企业 SSE、状态轮询或提前续期。请求时按需轮换 Access Token，服务端 401 最多续期重放一次；网络错误保留 Grant，用户重试恢复。UI 复用宿主模型/凭据/设置事件读取本地状态，登录期间只作有截止时间的临时查询。登录过期/设备撤销重新阻断。显式卸载通过官方插件命令移除 DSH Enterprise 与受管包。

服务地址边界：账号设置只读显示 Server；退出登录后在门禁修改。Host 将运行时修改收敛到无活动会话时的凭据清理与官方 settings 写入，保存与登录互斥；浏览器在服务/账号切换时丢弃旧请求结果。

企业插件市场：后端上传、发布与 ALL/USER 可见范围管理复用现有插件模块；员工在「DSH Enterprise 设置 → 插件」内搜索、查看详情并自主安装/切换版本/卸载，不另设侧栏入口或独立市场弹层。revision 不再触发安装，历史 required 也不强制；删除范围或退休只停止新安装，显式 ABSENT 才撤回已有受管包。签名、兼容性、逐请求授权与库存边界保留。部署时必须升级员工插件，旧客户端不会仅因后台变更自动转为自选模式。

企业配方广场：托管 Desktop `dsh-preset` v1 的 `.dshpreset` 包。控制台独立 `/presets` 纵向由 `plugin_admin`/`enterprise_admin` 上传、验包、发布/退休并原子替换 ALL/USER 可见范围；员工在「DSH Enterprise 设置 → 配方」浏览并复制导入指令，经 loopback `agent-preset.import` 安装。一期不做员工投稿、一键安装、设备配方库存与 Ed25519 签名；退休只停止新下载，不远程撤回本机已装配方。

插件验签策略：客户端 `verifyPluginSignatures` 默认 false，HTTP 内网部署无需员工配置公钥；文件大小、SHA-256、兼容性、逐请求授权与核心包保护始终生效。显式开启后仅信任安装层配置的 Ed25519 公钥，目录、下载和缓存都严格验签，服务端响应无权关闭校验或替换信任根。服务端 `ENT_PLUGIN_SIGNING_ENABLED` 同样默认 false，关闭时不加载私钥、不生成签名；数据库保留非空 bytea，以零长度表示未签名，HTTP `signatureBase64` 对应空字符串，无需迁移。开启签名仅影响新上传版本，不补签旧制品。Docker 与离线安装默认不提供签名密钥；升级时先更新员工插件，旧客户端无法解析无签名版本。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
