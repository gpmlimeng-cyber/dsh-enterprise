# OwnDsh 0.1.0 代码分析报告

> 分析对象：`owndsh-0.1.0.zip`（22,087,824 B，sha256 `28f1eaeb…`）
> 分析性质：**只读**。除本报告与 `findings/` 证据文件外，未改动任何项目文件。
> 取证基线：解压后 1,572 个文件 / 41 MB；871 `.java`、156 `.md`、91 `.ts`、86 `.tsx`。

---

## 一、现象层：这东西到底是什么

哥，先说结论：**这不是一个"烂尾玩具"，也不是一个"随手糊的套壳"。它是一个工程素养明显高于平均水准的自研控制面，但它把一座旧庄园的承重墙当成了自己的地基，而且这座庄园的门牌被换过了。**

### 1.1 结构总览

| 顶层目录 | 性质 | 规模 | 自研度 |
|---|---|---|---|
| `server/owndsh-enterprise/` | **自研核心** | 355 文件 / 27,516 行 | ★★★★★ |
| `server/owndsh-modules/owndsh-system/` | **上游 vendored** | 150 文件 / 16,964 行 | ☆（仅 3/150 有 GEB 头） |
| `server/owndsh-common/*` | **上游 vendored** | 16 个子模块 / ~32.9k 行 | ☆（7/267 有 GEB 头） |
| `server/owndsh-server/` | 装配层（半自研） | 23 文件 / 873 行 | ★★★ |
| `console/` | **自研前端** | 手写 21,706 行 + 生成 6,488 行 | ★★★★★ |
| `plugin/` | **自研插件** | 7,581 行（不含生成物） | ★★★★★ |
| `contracts/` | OpenAPI 3.1 真源 | 42 个稳定错误码 | ★★★★★ |
| `deploy/` `website/` `scripts/` `docs/` | 交付与文档 | — | — |

**上游 fork 边界极其清晰**：`owndsh-enterprise` 中 `@author Lion Li` 出现 **0 次**，而 `owndsh-common` 146 次、`owndsh-system` 102 次。作者没有假装自研，边界是诚实的。

### 1.2 技术栈

Java 21 + Spring Boot 4.1.0 + Sa-Token 1.45.0 + PostgreSQL + Flyway(V0–V29) + Redis/Redisson + MyBatis-Plus；
React 19 + TypeScript 6 + Vite 8 + TanStack(Router/Query/Table/Form) + Zod + Hey API；
pnpm 11.7.0（插件）/ 11.24.0（console）；Node 22.19+/24。

架构范式（每个模块一致）：`domain/ application/ persistence/ web/` 纵向切片 + 组合根 `*Configuration.java`，端口/适配器（DIP）。**这个一致性是真正的加分项**——不是"有几个模块这样"，而是"所有自研模块都这样"。

---

## 二、本质层：五个真实问题（按严重度排序）

### 【P0】MIT 许可证版权声明被改名 —— 法律风险，铁证

```
上游 dromara/RuoYi-Vue-Plus LICENSE:  Copyright (c) 2019 RuoYi-Vue-Plus
本项目 server/LICENSE:                 Copyright (c) 2019 OwnDsh-Vue-Plus   ← 被改名
```

MIT 的核心义务是**原样保留版权声明**。改名即违约。证据链：
- `server/LICENSE` 除该行外与上游 MIT 文本逐字节相同（已比对 `v5.5.1` 原文）；
- 仓库**无** `NOTICE` / `THIRD-PARTY` 文件；
- `server/README.md` 声称"第三方代码的 MIT 许可证保留在 LICENSE"——这句话本身就不成立，因为声明已被改；
- `server/CLAUDE.md` 仅以"OwnDsh-Vue-Plus 上游"指代，未记录上游仓库 URL，且声称的 commit `7180b529776834fee912113b23f0bd7a387a8222` **公开不可解析**；
- 讽刺的是，自研文件 `server/owndsh-server/src/main/java/com/owndsh/OwnDshApplication.java:16` 仍留着 `@author Lion Li`。

**修复**：恢复 LICENSE 原文，新增 `NOTICE` 记录上游仓库 + 可解析 commit + MIT 全文，或直接替换为干净重写的等价实现。

---

### 【P1】CI 从不运行后端测试，T20 的"CI 秘密扫描"也没接上

| 声称 | 现实 |
|---|---|
| `CLAUDE.md:34` "T20 建立…CI 秘密扫描" | `scripts/scan-sensitive-logs.mjs` 自身注释写着"CI 日志泄漏门禁"，但 `.github/workflows/release.yml` 中**零引用** |
| `release.yml` 唯一工作流 | 只有 `images`（docker build）、`plugin-check`、`plugin-publish` 三个 job，**无任何 maven/mvnw/test 步骤** |
| `server/pom.xml:66` | `<maven.test.skip>true</maven.test.skip>` —— 打包默认跳过 |
| `deploy/compose/Dockerfile.server:13` | `mvn … -DskipTests …` |

**后果**：51 个 enterprise 集成测试（Testcontainers + 真实 PG/Redis/OpenLDAP）与 11 个 server 测试**完全依赖人工执行**，release tag 可以在测试从未跑过的状态下发布镜像。

值得注意的不对称：`plugin/package.json:25` 的 `check` **确实**包含 `test`，CI 也调用了 `pnpm --dir plugin run check` —— 所以插件测试是有门禁的；`console/package.json:17` 的 `check` 也含 `test`，但 **CI 从不构建 console**（`images` job 直接 `docker build`，绕过了 `check`）。防线是零星存在的，不是系统性存在的。

**修复**：CI 增加 `mvn -B -ntp verify -Dmaven.test.skip=false`，把 `scan-sensitive-logs.mjs` 与 `console` 的 `check` 接进流水线。

---

### 【P1】Compose 层提供公开默认密钥，直接否证 T20 的安全承诺

`docs/t20-security-fault-acceptance.md:27` 白纸黑字：

> `SA_TOKEN_JWT_SECRET_KEY` **无仓库 fallback**，缺失时 Spring placeholder 解析失败，不能再用上游已知样例密钥签发平台 Token。

而 `application.yml:174` 的无默认值写法，被**部署层重新引入了默认值**：

```yaml
# deploy/compose/compose.yml:80-81
SA_TOKEN_JWT_SECRET_KEY: ${SA_TOKEN_JWT_SECRET_KEY:-owndsh-jwt-secret-change-me-000000000000000000000000}
ENT_MASTER_KEY:           ${ENT_MASTER_KEY:-0123456789abcdef0123456789abcdef}
```

且根目录 `docker-compose.yml` 以 `env_file: ./.env.example` 装配，`.env.example:19-20` 携带**同样公开的两个值**。

**为什么测试没拦住**：`EnterpriseSafetyDefaultsTest.java:51,65` 只断言 `application.yml` 的占位符文本（`"${SA_TOKEN_JWT_SECRET_KEY}"`），**不覆盖 compose/env_file 层**。测试是对的，但测错了层——这正是"防线看似存在却失效"的典型形态。

**加重项**：全仓库无任何运行期守卫拒绝这个已知值（已 grep 确认），且 `ENT_MASTER_KEY` 被 `EnterpriseIdentityConfiguration.java:70-82` 校验为"恰好 32 字节"——`0123456789abcdef0123456789abcdef` 恰好 32 字节，**校验通过**。于是 `docker compose up` 即可用公开密钥签发 JWT 并解密全部信封。

注意 `deploy/scripts/install.sh:83-84` 确实用 `openssl rand` 生成真密钥——但那是**可选路径**，`compose up` 不是。

**修复**：Compose 层改为 `${SA_TOKEN_JWT_SECRET_KEY:?required}`（缺失即拒绝启动），或在启动时检测已知样例值并 fail-closed。

---

### 【P1】上游遗留 admin 面仍在 classpath，仅靠拓扑遮蔽

`V0__host_baseline.sql`（1,279 行）建立 **18 张 `sys_*` 表** + 上游菜单树；`owndsh-system` 含 **19 个 Controller**（`SysUserController`、`SysRoleController`、`SysMenuController`、`SysOssConfigController`、`SysClientController`…），全部带 `@SaCheckPermission("system:*")`。

更关键的是 **`V17__enterprise_admin_system_access.sql`** 临时禁用不可变触发器 `trg_ent_built_in_role_menu_immutable`，**故意**把「系统设置」「运行状态」子树授予内置 `enterprise_admin` 角色。

**运行期是否可达？——我做了两轮核验，结论要精确：**

- `deploy/compose/compose.yml` 中 **只有 `console` 服务发布端口**（`:116-117`），`server` 服务**无 `ports`**，仅在 `backend` 网络；
- `deploy/nginx/nginx.conf` 只代理 `/healthz`、`/enterprise/gateway/v1/*`、`/enterprise/admin/v1/`、`/enterprise/api/v1/`、`/enterprise/auth/`、`/auth/code`、`/assets/`、`/`。

⇒ **在出厂拓扑下，`/system/**` 外部不可达。** 我最初的"HTTP 可直达"假设**被证伪**，这里如实修正。

但风险并未消除，只是被推迟：
1. `owndsh-enterprise` 的 pom **硬依赖** `owndsh-system`（`ConsoleBootstrapController`、`MemberManagementService`、`OwnDshPlatformSessionGateway` 直接 import `com.owndsh.system.*` 并使用真实 `sys_user`/`sys_role`），**不是死代码**；
2. `scripts/local-demo.sh` 直连 Server HTTP 端口运行，此时上游面完全暴露；
3. 任何人加一条 nginx `location` 或发布 server 端口，上游面**立即**可达；
4. 该面**不在自研 31 项 `AuditAction` 白名单覆盖内**——命中它不产生企业审计。

**同时存在功能重复**：`AdminMemberController`（`/enterprise/admin/v1/members`，`ent:member:*`）与 `SysUserController`（`/system/user`，`system:user:*`）是两套成员管理 API。

**修复**：物理删除 `owndsh-system` 中不被自研消费的 Controller（保留其 domain/persistence），或对 `/system/**`、`/monitor/**` 增加显式 404 拦截。**不要**依赖"nginx 没配"作为安全边界。

---

### 【P2】双真源漂移：同一契约在两个地方各自演化

这是最"慢性"的一类腐烂，逐条列证据：

| # | 真源 A | 真源 B | 后果 |
|---|---|---|---|
| 1 | 服务端核心包黑名单 **3 个**（`PluginArtifactInspector.java:29-33`） | 客户端黑名单 **6 个**（`plugin-distribution/src/service.ts:30-37`，多 `@owndsh/contracts`、`@owndsh/llm-gateway`、`@owndsh/ui`） | 服务端**会接受并发布**这 3 个包，防线只在客户端 `:157,205,219,408` |
| 2 | zod 硬编码 `sizeBytes ≤ 52428800`（`zod.gen.ts:1772`） | 服务端可配至 `1_073_741_824`（`EnterprisePluginConfiguration.java:45-46`） | 上限一调高，客户端校验即失败 |
| 3 | `console/src/api/generated/types.gen.ts` | `plugin/packages/contracts/src/generated/types.gen.ts` | **sha256 完全相同**（6,488 行）却是两个脚本独立生成，**无 drift 检查** |
| 4 | 契约定义 **42** 个 `ENT_*` | console 手写 **17** 个契约中不存在的码（`ENT_MODELS_UNAVAILABLE`、`ENT_PLUGIN_*_FAILED`…） | 错误码命名空间混用 |
| 5 | 文档/验收称 **30** 个 action | 枚举与 V21 DB 约束实际均为 **31**（我逐项 diff 确认一致） | 文档漂移（代码与 DB 是自洽的，这点要公平地说） |

**JCS（RFC 8785）也有两份实现**：Java 用 `org.erdtman.jcs.JsonCanonicalizer`，TypeScript 手写 `canonicalizeJson`，**无共享 fixture**。签名验证跨语言一致性就建立在这两份实现"恰好一致"上。

**修复**：单一真源 + 生成时 drift 检查（`git diff --exit-code`）；黑名单下沉到契约层由两端共同消费。

---

### 【P2】`JdbcPluginStore.java:111` 静默丢弃退休版本分配

```sql
where priority=1 and (version_status='PUBLISHED' or desired_state='ABSENT')
```

当 USER 优先级行指向 `RETIRED` + `INSTALLED` 的版本时，**整行被丢弃且不回退到 DEPT/ALL**。这与 `docs/t13-plugin-server-acceptance.md:32`「assignment 已引用的退休版本仍可下载」的表述不自洽——用户会看到"分配消失"，且无任何日志或错误码提示。

---

### 【P2】审计逃逸：两类管理员探测动作不留痕

`T19` 声称"管理员动作闭环留痕"。我逐行核验了两个方法体：

- **`ProviderService.test`**（`model/application/ProviderService.java:185-215`）：会**解密 `PROVIDER_SECRET`** 并向上游发起真实探测，但该类唯一的 `auditSink.append` 在 `:270`（仅变更路径）。**测试路径零审计。**
- **`IdentitySourceService.testConnection`**（`auth/application/IdentitySourceService.java:223-236`）：只调 `recordConnectionTest` 落库，**从不构造 `AuditEvent`**；`AdminIdentitySourceController:139` 直接暴露该端点。

⇒ 管理员可**无限次**验证/试探已存密钥的有效性而不留痕，构成口令/密钥探测的免审计通道。

**修复**：为 test/probe 动作新增 `AuditAction`（或用 `RESULT=FAILURE` 的既有码），纳入封闭白名单。注意新增 action 需同步 V21 风格的 DB check 约束。

---

## 三、哲学层：这套代码真正的设计智慧

哥，批评说完了，得说点公道话。**这套代码的核心不变量，是我见过的国产自研控制面里少有的"有骨头"的。**

### 3.1 计量学是博士级的

V29 的核心设计（`V29__gateway_usage_accounting.sql:6-17`）在**数据库层**用 check 约束强制了会计恒等式：

```sql
constraint ck_ent_usage_ledger_charge check (
    charged_tokens >= 0 and (
        (result = 'SETTLED'     and charged_tokens = total_tokens)
     or (result = 'CHARGED_MAX' and total_tokens = 0)          -- 未知用量绝不污染实测总计
    )
);
```

译成人话：**"我们不知道用了多少"和"用了 0"是两件不同的事**，并且这个区别被 DB 约束而非文档守护。`QuotaReservationService.java:299-323` 的 `settleLocked` 与之严格对应。

配套还有：`SELECT … FOR UPDATE` 行锁 + idempotencyKey 双相幂等 + `RESERVED→SENT→SETTLED/CHARGED_MAX` 状态机 + 独立事务写 usage 快照 + `recoverExpired` 恢复任务 + 4xx（**不含 408**，`ModelGatewayService.java:503`）释放。Redis 侧用**单个 Lua 脚本**保证多策略 RPM/并发"全成或全败"（`RedisQuotaRateLimiter.java:31-53`）。

### 3.2 审计白名单是编译期的，不是运行期字符串过滤

`AuditMetadata` 是 sealed marker 接口，每个 action 对应唯一不可变 DTO；`AuditEvent.java:45-47` 在 `metadata.action() != action` 时**直接抛异常**。`JdbcAuditSink` 只有一条 INSERT，DB 侧 `ent_reject_audit_update` 触发器拒绝一切 UPDATE。

**类型系统 + 数据库双保险**。这比"运行时黑名单过滤字段名"高一个维度——黑名单永远漏，白名单天然完备。

### 3.3 密码学实现是对的

HKDF-SHA-256（32 字节空 salt）→ 按 `purpose` 派生 AES-256-GCM 密钥；随机 12 字节 nonce；AAD 绑定 `tenant:table:id:field:key_version`。密文搬到别的租户/表/字段/行都会认证失败。`SecretAad` 还拒绝含 `:` 的 tenant/id 以防 AAD 拼接歧义。master key 与 PRK 在 `finally` 中清零。

**密钥永不下发客户端**：`ModelGatewayService.java:174-192` 逐请求解密 → 注入 upstream header → `finally` 清零。`ModelGatewayController.java:43-46` 的转发头白名单只有 8 个协议头，**`Authorization` 不在其中**。

### 3.4 认证链路的细节经得起推敲

- **LDAP 注入**：`LdapFilterEscaper` 全量 RFC4515 转义（NUL/`()*\`/<0x20/≥0x7f），三处调用点均转义（`LdapIdentityAdapter.java:123,161,221`）；
- **OIDC**：强制 `CODE`+S256+nonce、只接受 Discovery 已广告的**非对称** alg、issuer 等值校验、60s 时钟偏移、`setFollowRedirects(false)`；
- **Refresh 轮换**：`SELECT … FOR UPDATE` 行锁 + ROTATED 命中即**整族 REVOKED=REPLAYED**（`RefreshSessionService.java:117-135`），8 路并发测试证明仅 1 次成功；
- **LOCAL**：DUMMY_HASH + 缺失账号仍做一次比对（防时序枚举），`enabled` 折进 matched 避免区分"停用"与"密码错"；
- **cookie**：`__Host-` 前缀（HTTPS）+ HttpOnly + SameSite=Strict，仅 `/enterprise/admin/**` 桥接，JS 永不读 token。

### 3.5 工程纪律

- **GEB L3 头部覆盖**：enterprise **355/355 = 100%**、console 96/96、plugin 27/27（对比 `owndsh-common` 7/267 = 3%、`owndsh-system` 3/150 = 2%）——作者在新代码上是严格执行的；
- **100+ 文件零 TODO/FIXME/HACK**，零 `System.out`，零 `printStackTrace`；
- **单文件最大 545 行**，无一处突破 ≤800 行红线；
- **日志不泄露**：enterprise main 中 `log.*(ex.getMessage)` 命中 **0** 次（T20 的"不记录异常 message"是真的）；
- **容器加固**：`read_only`、`cap_drop: [ALL]`、`no-new-privileges`、非 root（UID 10001）、镜像 digest 固定；
- **CORS 默认拒绝**（`allowed-origin-patterns: []`）、actuator 仅暴露 `health`、API docs 默认关闭、分层请求体上限（nginx 52m / server 10m gateway / 1m session）；
- **无边界循环防护**：两个 retention job 都是有界批（`while (deleteBefore(...) == batchSize)`）；
- **上游基线可追溯**：`upstream/*.lock.json` 锁定 DSH Desktop 2.0.3 commit `1eb398d…`、harness `0.1.1-rc.2` commit `b150a55…`、beautiful-ui `3ea4c18…`。

---

## 四、象限洞察：哥，你可能还没意识到的

**象限 3（你未知的已知）** —— 你在用的框架正在替你做决定：
- Sa-Token 的 Caffeine 前置缓存 `expireAfterWrite(5s)`（`PlusSaTokenDao.java:27-33`）意味着**跨节点撤销最长有 5 秒窗口**。设备撤销的"即时性"是有水分的，文档里没写这一条。
- `AllUrlHandler` 反射所有 MVC 路由进 Sa-Token 匹配表，但 `SecurityConfig.java:128-130` 对 `/enterprise/**` **整体豁免**全局登录检查，改由每个端点自保。这是有意的设计（设备 token 不走 Sa-Token 登录），但**新增 enterprise 端点时忘记加 `@SaCheckPermission` 就等于开放**。而 `RuntimeSessionController.java:54-104` 的 export/delete/list **确实没有** `@SaCheckPermission`——依赖设备 token + owner 作用域。设备 token 泄露 = 该用户全部 Session 正文可读。

**象限 4（你未知的未知）** —— 比 bug 更值钱的三件事：

1. **你不是在维护一个项目，你在维护两个。** `owndsh-system`（16,964 行）+ `owndsh-common`（32.9k 行）是上游 vendored 快照，它们有**自己的上游**（RuoYi-Vue-Plus），会持续演进，而你的 fork 没有回流机制。随着时间推移，这个 gap 只会扩大。要么明确"永不同步上游"并冻结，要么建立回流流程——**不能装作它不存在**。
2. **"文档声称完成"与"CI 验证完成"之间的鸿沟，是这类项目最大的隐性负债。** T17/T18 在 `CLAUDE.md` 里被描述为已交付，实际 `docs/` 中 t17/t18 验收文档**不存在**（t18 的 PNG 资产却在 `docs/assets/` 里躺着）；`docs/` 也没有 t20 之外的 T20 系列；`server/CLAUDE.md` 文档化的 `owndsh-extend/` 目录**不存在**。Session 客户端同步（T17）被明确停用是**有意的**（`plugin/packages/bundle/src/index.ts:4`、`docs/v1-product-feature-catalog.md:75,§10,296` 三处印证）——但文档没说清楚"哪些是设计停用，哪些是没做完"。
3. **`docs/owndsh-governance-mvp-design.md:544,974` 指定 `ENT_MASTER_KEY_FILE`（文件挂载），实现读的却是环境变量** `EnterpriseIdentityProperties.masterKey`。设计意图是"密钥不进环境变量"（更安全，环境变量会出现在 `/proc/*/environ`、`docker inspect`），实现走了更弱的路。**这是一次静默的安全降级，没人注意到。**

---

## 五、优先级改进清单

| 优先级 | 事项 | 证据 |
|---|---|---|
| **P0** | 恢复 LICENSE 版权原样 + 新增 NOTICE | `server/LICENSE` |
| **P0** | Compose 密钥改 `:?required` 或 fail-closed 检测 | `compose.yml:80-81`、`.env.example:19-20` |
| **P1** | CI 接入 `mvn verify`、console `check`、`scan-sensitive-logs.mjs` | `release.yml`、`pom.xml:66` |
| **P1** | 物理移除/拦截 `/system/**`、`/monitor/**` | `V17`、19 个 Controller |
| **P1** | 为 `ProviderService.test` / `IdentitySourceService.testConnection` 补审计 | 二处方法体 |
| **P2** | 统一插件核心包黑名单（服务端补齐至 6） | 3 vs 6 |
| **P2** | 修复 `JdbcPluginStore.java:111` 的退休版本静默丢弃 | 该行 SQL |
| **P2** | 生成物 drift 检查；zod 上限对齐配置 | `types.gen.ts`、`zod.gen.ts:1772` |
| **P2** | `ENT_MASTER_KEY_FILE` 按设计实现 | 设计文档 vs 实现 |
| **P3** | 冗余扫描的运行时 action 粒度（`CONFIG_CHANGED` 被 3 处共用） | `AccessGroupService:190` 等 |
| **P3** | `SessionService.INITIAL_ROLLING_HASH` 改为私有 + 克隆访问器（当前 `public static final byte[]` 可变） | `SessionService.java:43` |
| **P3** | 抽取重复的 SHA-256/Base64 helper、三适配器的 `requireSource`/`decryptSecret` | 多处 |
| **P3** | 补齐 t17/t18 验收文档，或明确标注停用；删除 `owndsh-extend` 幽灵文档 | `docs/`、`server/CLAUDE.md` |
| **P3** | `AdminSessionCookie.requireSameOriginForUnsafe` 在 Origin+Referer 双缺失时 fail-open，建议改为 fail-closed | `:48-52` |

---

## 六、总评

哥，用一句话说：**这是一套"内核可信、边界可疑、门禁缺失"的代码。**

- **内核可信**：计量、密码学、审计白名单、并发幂等、认证细节——这些"写错了就完蛋"的地方，作者想清楚了，而且用 DB 约束和类型系统把不变量钉死了。这是真功夫。
- **边界可疑**：上游 vendored 代码的暴露面、名字被换掉的许可证、设计意图与实现分叉的密钥加载方式——这些"不属于任何模块"的灰色地带，恰恰没人管。
- **门禁缺失**：51 个精心编写的集成测试从不运行。**再好的测试，不跑就等于零。**

最扎心的一点：这套代码里最能体现作者水平的东西（V29 会计恒等式、编译期审计白名单），恰恰是最容易被"看起来更紧急的迭代"侵蚀掉的东西。**把 CI 接上、把 LICENSE 改回来、把 Compose 密钥堵上——这三件事的投入产出比，高于再写一万行新功能。**

---

### 附：证据文件

- `findings/license-evidence.txt` —— 许可证比对原始证据
- `findings/metrics.txt` —— 独立度量数据
- `findings/verified-issues.txt` —— 逐条复核结论（含"证伪"记录）

> **方法论声明**：本报告所有结论均由 captain 亲自 grep/read 源文件复核。子代理的额外发现（plugin R1-R7、auth、session/audit）在采纳前均已独立重验；其中"上游 HTTP 面外部可达"假设经两轮核验**被证伪并已在报告中如实修正**。区分"已核实事实"与"未核实断言"是本报告的基本纪律。
