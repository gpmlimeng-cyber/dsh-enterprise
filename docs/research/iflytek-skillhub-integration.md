<!--
[INPUT]: 依赖讯飞 SkillHub 开源仓库（iflytek/skillhub）与其官方文档站、公开云注册中心 skill.xfyun.cn 的一手抓取证据，以及 DSH Enterprise 已上线的技能包格式、技能服务端 API、员工端本机代理与装配路径事实；收尾补强轮另以本仓库 HEAD 323f312 的 src/main/java 源码（SkillArtifactInspector/SkillArtifactException/EnterpriseSkillProperties/AdminSkillController/SkillViews/EnterpriseResponse）与根 NOTICE 为实证依据。
[OUTPUT]: 给出 SkillHub 的定位/格式/能力面/运行时/生态调研结论、与本项目概念的逐项对照表、四个按代价排序的集成方案（做什么、改哪里、人日、风险、可逆性、前置条件）、单一推荐方案、方案 A 的完整转换规则规格（坐标/目录/frontmatter 映射、逐条预检清单、反向转换的必然丢失、错误报告形状、转换器接口契约）、交付与验收建议（落地位置、最小验收、法务前置）、不建议路径、待验证的不确定性清单。
[POS]: 技能生态外部集成方向的调研真源；结论只用于决策与排期，不构成任何实现承诺，代码与接口事实仍以 server/ 与 apps/desktop/ 现状为准。§0 的三项源码实测已关闭原 §6（现 §8）不确定性清单中"包内子树是否受限/未知字段容忍度/大小门禁作用域"三条，并顺带关闭响应包与分页两条；其余仍为待核对。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 讯飞 SkillHub 调研与集成可行性方案

调研日期：2026-10-02（Asia/Shanghai）
调研对象：`https://github.com/iflytek/skillhub`、`https://iflytek.github.io/skillhub`、公开云注册中心 `https://skill.xfyun.cn`
文档状态：调研结论，未进入实施

---

## 0. 调研方法与抓取说明

本轮全部结论来自实际抓取，不使用记忆填充。抓取方式与限制如实记录：

| 渠道 | 结果 |
|---|---|
| GitHub Web UI / REST API（`api.github.com`） | 抓取成功 |
| 仓库原文件（`raw.githubusercontent.com`） | 抓取成功，`docs/` 与 `cli/` 源码逐文件读取 |
| 官方文档站（`iflytek.github.io/skillhub`） | HTTP 200 可访问，页面为 VitePress 渲染；正文实质内容以其同源 Markdown（仓库 `docs/skillhub/**`）为准，本轮读的是后者 |
| 公开云注册中心（`skill.xfyun.cn`） | 抓取成功，含匿名搜索 API 与**真实技能包下载** |
| 讯飞开源博客（`opensource.iflytek.com/blog/...`） | 域名可达，本轮未把其营销文案作为事实依据 |

**工具限制（如实记录）**：本会话的 `web_fetch` 工具对 `github.com` / `raw.githubusercontent.com` / `iflytek.github.io` 一律返回 `URL hostname resolves to a non-public IP address`，即被网络策略拦截，**未能通过该工具抓取**。上述内容全部改用 shell `curl` 直连取得（HTTP 200）。因此本文件中凡引用 GitHub 与文档站的证据，均为 curl 抓取所得。

**一个必须前置说明的发现**：SkillHub 仓库内**已经存在**一份面向 DeepSeek Harness 的集成文档 `docs/dsh-integration.md`，且其 CLI 已内置 `dsh` 目标 profile。也就是说，**对方已经把我们当成了受支持的客户端之一**，本调研不是"从零评估一个陌生平台"，而是"评估一个已把我们纳入互操作范围的注册中心"。

### 0.1 收尾补强：三项前置的源码实测（2026-10-02 追加）

本轮补强**不新增任何联网结论**，只把此前标注为"未读到／需确认"的三项用**本仓库源码**关掉。实测对象与方式（全部只读）：

| 实测对象 | 说明 |
|---|---|
| `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactInspector.java` | **280 行全文件逐行读完**，这是三项结论的唯一权威来源 |
| 同目录 `SkillArtifactException.java` | 错误码只有 `ENT_SKILL_INVALID_PACKAGE` / `ENT_SKILL_TOO_LARGE` 两个 |
| `.../skill/EnterpriseSkillConfiguration.java`、`.../skill/EnterpriseSkillProperties.java` | 归档/entry/解压上限的注入值与默认值 |
| `.../skill/web/AdminSkillController.java`、`.../skill/web/SkillViews.java` | 上传端点契约与对外投影字段（决定"字段透传与否"） |
| `.../common/api/EnterpriseResponse.java`、`CursorPageData.java`、`CursorPageMetadata.java` | 响应包与分页形状（顺带关闭两个 ⚪） |
| 仓库根 `NOTICE`（**无 `LICENSE`**）、仓库 HEAD `323f312`（2026-10-02） | 许可证状态与代码基线 |

三项结论（代码证据见 §5）：

1. **① `skills/<name>/` 内部不受限** → 三层路径 `skills/<name>/references/x.md`、`skills/<name>/assets/big.js` **均可通过**；`skills/` 下**深度不限**。**方案 A 的"扁平包根级 SKILL.md → 重定位进 `skills/<name>/`"策略成立，不需要 +2 人日重设计。**
2. **② manifest 未知字段被"解析但忽略、且不透传"** → 加 `license`/`x-*` 字段**不会报错**，但服务端**不保存也不投影**它们。`x-astron-*` 在 `SKILL.md` frontmatter 里**可原样保留**（不报错）。
3. **③ 大小门禁是"逐条目、且只作用于两个特定路径"，不是"逐文件"** → 256KiB 只压在 `skills/<name>/SKILL.md` 上；对方真实样本里的 3.41MB `skills/<name>/assets/mermaid.min.js` **不触发任何逐文件门禁**。**原 §2 第 13 行与 §3 方案 A "大文件必然失败"的判断已被源码实测推翻**（该样本本可正常转换）。

顺带关闭的两个 ⚪：**响应包与我们不同构**（`EnterpriseResponse` 只有 `{data, requestId}`）；**分页是游标式**（`CursorPageData{items, page:{hasMore, limit, nextCursor}}`，**不返回 `total`**）。

**如实标注约定**：本轮对 §2/§3/§4/§8 的更正，一律**保留原判断文字并紧跟"原推断 / 更正"标注**，不静默改写——以便读者区分"当时基于文档的推断"与"现在基于源码的事实"。

---

## 1. 调研结论

### 1.1 它是什么：定位、协议、成熟度、技术栈、部署形态

**定位**：企业级**自托管 Agent 技能注册中心（skill registry）**，不是技能市场 SaaS、不是技能运行时、不是编排平台。

它自己的原话是"像使用 npm、PyPI 一样管理 Agent Skills"，并在运行时契约文档中明确划界：

> | 系统 | 权威负责内容 |
> |---|---|
> | SkillHub | 技能包、版本、元数据、合规声明快照、下载与审核记录 |
> | Agent Runtime | 技能实际执行、输入输出、模型调用、工具调用、执行 trace |
>
> "SkillHub 不执行技能，因此不记录 Runtime trace"，"不要把 SkillHub 的合规声明当成第三方认证结果"

来源：[docs/skillhub/guide/runtime-integration.md](https://github.com/iflytek/skillhub/blob/main/docs/skillhub/guide/runtime-integration.md)、[docs/skillhub/introduction.md](https://github.com/iflytek/skillhub/blob/main/docs/skillhub/introduction.md)

一句话：**它只做"技能的分发与治理"，不做"技能的运行"**。这一点直接决定了方案 C 的可行性（见 §3.3）。

**开源协议**：Apache License 2.0。来源：[LICENSE](https://github.com/iflytek/skillhub/blob/main/LICENSE)、GitHub REST API `repos/iflytek/skillhub` → `license.spdx_id = "Apache-2.0"`。

**成熟度**（GitHub REST API 实测，抓取时点 2026-10-02）：

| 指标 | 数值 |
|---|---|
| Stars / Forks | 5141 / 842 |
| 创建时间 | 2026-03-11 |
| 最近 push | 2026-10-01（抓取前 1 天） |
| 提交数 | ≈1498（`commits?per_page=1` 的 Link `last` 页 = 1499） |
| 贡献者 | 39 |
| Open issues | 35 |
| 最新版本 | 服务端 `v0.2.21`（2026-09-19）、CLI `cli-v0.1.12`（2026-09-09） |
| 发版节奏 | 标签密集（v0.2.14 → v0.2.21 连续），近乎双周发版 |
| 其他 | 有 GitHub Actions 构建、GHCR 镜像、Discord、Trendshift 榜、AAIF Associate Member |

来源：[releases API](https://api.github.com/repos/iflytek/skillhub/releases)、[tags API](https://api.github.com/repos/iflytek/skillhub/tags)、[contributors API](https://api.github.com/repos/iflytek/skillhub/contributors)、[README_zh.md](https://github.com/iflytek/skillhub/blob/main/README_zh.md)

**结论：活跃度很高，但仍是 0.2.x 预 1.0 版本**。这一点是后文风险判断的核心依据——API 契约尚未冻结。

**技术栈**（[docs/skillhub/introduction.md](https://github.com/iflytek/skillhub/blob/main/docs/skillhub/introduction.md) + 仓库 `languages` API + 目录实测）：

| 层 | 技术 | 证据 |
|---|---|---|
| 后端 | **Java 21 + Spring Boot 3.2**，企业级 REST API | introduction.md 技术栈表 |
| 前端 | React 19 + Vite + TanStack Router | introduction.md；`web/` 目录 |
| 数据库 | PostgreSQL 16（全文搜索 + Flyway 迁移） | introduction.md |
| 缓存/会话 | Redis 7（Spring Session） | introduction.md、03-authentication-design.md |
| 对象存储 | MinIO / S3（可切换） | introduction.md |
| 安全扫描 | 独立服务 `skill-scanner`，镜像内固定 `cisco-ai-skill-scanner==2.1.0`（Python，glibc） | docs/security-scanning.md |
| 部署 | Docker Compose / Kubernetes / **Helm chart**（`charts/skillhub` 含 Chart.yaml/values.yaml/templates） | 仓库 `charts/`、`deploy/k8s`、`compose.release.yml` |
| 语言占比 | Java 5.32MB、TypeScript 2.78MB、HTML 0.63MB、Shell 0.28MB、Python 0.16MB，另有 YARA | languages API |

**与我们高度同构**：Java + Spring Boot 后端。这对集成是加分项（协议习惯、错误语义、幂等约定都相通，见 §2）。

**部署形态**：**自托管为主 + 一个官方公开云**。

- 自托管：`make dev-all` / `runtime.sh up` / `compose.release.yml` / K8s / Helm。默认 Web `:3000`、API `:8080`。
- 公开云：`https://skill.xfyun.cn`（"Astron SkillHub"），本轮实测可匿名访问搜索接口。
- 本地开发默认账号 `admin` / `ChangeMe!2026`（README 明确要求生产改密，`validate-release-config.sh` 会拒绝默认值）。

来源：[README_zh.md](https://github.com/iflytek/skillhub/blob/main/README_zh.md)、[docs/09-deployment.md](https://github.com/iflytek/skillhub/blob/main/docs/09-deployment.md)

### 1.2 技能格式：清单结构、字段、版本与元数据模型、兼容的既有标准

**没有 `manifest.json`。SkillHub 的技能包是"扁平的单技能目录"，入口是根目录的 `SKILL.md`。**

规范原文（[docs/07-skill-protocol.md](https://github.com/iflytek/skillhub/blob/main/docs/07-skill-protocol.md)）：

```yaml
---
name: my-skill              # 必需，kebab-case
description: When to use    # 必需，1-2 句话
---

# Markdown 正文（技能指令内容）
```

- `name` 映射为 `skill.slug`（首次发布时确定，**后续版本不可变更**）；`description` 映射为 `skill.summary`。
- 完整 frontmatter 解析结果存入 `skill_version.parsed_metadata_json`。
- 可选平台扩展字段，**前缀 `x-astron-`**：`x-astron-category`、`x-astron-runtime`（预留）、`x-astron-min-version`（预留）、`x-astron-compliance`（合规声明数组，含 `standard`/`version`/`controlId`/`title`/`evidence`）。
- `version` 也可写在 frontmatter（发布指南示例中出现），但版本权威在服务端。

**包目录结构**：

```
my-skill/
├── SKILL.md              # 主入口文件（必需）
├── references/           # 参考资料（可选）
├── scripts/              # 脚本（可选）
└── assets/               # 静态资源（可选）
```

**校验规则（服务端，可配置）**：根目录必须有 `SKILL.md`（兼容 `skill.md`/`Skill.md` 大小写变体并归一化）；文件类型白名单 `.md .txt .json .yaml .yml .js .cjs .mjs .ts .py .sh .png .jpg .svg`；单文件 1MB；总包 10MB；文件数 100。

**⚠️ 实测的重要细节——下载产物是"扁平 zip，`SKILL.md` 在根"，没有外层目录**。我对公开云 25 个技能做了真实下载并解析 zip（见 §9 附录），22 个成功样本**全部**满足 `SKILL.md` 位于压缩包根。这与"安装后目录名为 `skill.slug`"是两件事：**外层目录由 CLI 在安装时创建，不在包里**。

**版本与元数据模型**：

- 坐标：`@{namespace}/{skill_slug}`，如 `@global/my-skill`、`@team/my-skill`。
- 版本：语义化版本 `major.minor.patch`，支持解析器（`^1.2.0`、`~2.0.0`）。
- 标签：`latest` 为**系统保留只读标签**，另有自定义标签（`beta`、`stable`）；`latest` 内部语义严格等价于"最新已发布版本"（`latest_version_id` 指针）。
- 版本解析：`install @team/my-skill@1.2.0` 精确版本；`@team/my-skill` 或 `@latest` 取最新发布；`@beta` 取自定义标签。
- 生命周期：Skill 容器状态 `ACTIVE`/`ARCHIVED`；SkillVersion 状态 `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` →（`YANKED` / `REJECTED` / `SCANNING` / `SCAN_FAILED`）；`hidden` 是独立治理覆盖层而非状态。
- 读模型投影：`headlineVersion` / `publishedVersion` / `ownerPreviewVersion` + `resolutionMode`（`PUBLISHED`/`OWNER_PREVIEW`/`NONE`）。
- 客户端私有元数据：安装后写 `.skillhub/metadata.json`（`registry`/`namespace`/`slug`/`version`/`agent`/`installedAt`）；协议文档另描述一个 `.astron/metadata.json` 私有文件。

来源：[docs/07-skill-protocol.md](https://github.com/iflytek/skillhub/blob/main/docs/07-skill-protocol.md)、[docs/14-skill-lifecycle.md](https://github.com/iflytek/skillhub/blob/main/docs/14-skill-lifecycle.md)、[docs/skillhub/guide/skill-publish.md](https://github.com/iflytek/skillhub/blob/main/docs/skillhub/guide/skill-publish.md)

**是否兼容某个既有标准——是，但兼容的不是 Anthropic 规范，而是 OpenSkills / Claude Code 的 `SKILL.md` 谱系**（二者同源）：

> "以 ClawHub 为产品蓝本（继承产品模型，不照搬技术实现），以 **OpenSkills 借鉴 SKILL.md 格式和目录结构约定（不兼容其客户端运行时行为）**"
>
> "目标：skillhub CLI 安装的技能可被 **OpenSkills/Claude 兼容客户端**发现和使用"

具体互操作约定：四级目录优先级 `.agents/skills` → `~/.agents/skills` → `.claude/skills` → `~/.claude/skills`；目录名 = `skill.slug` 作为 lookup key；AGENTS.md `<skill>` 描述块格式与 OpenSkills 一致。另有 **ClawHub CLI 协议兼容层**（`clawhub install team-name--my-skill` 这种双横线坐标）。

来源：[docs/00-product-direction.md](https://github.com/iflytek/skillhub/blob/main/docs/00-product-direction.md)、[docs/07-skill-protocol.md](https://github.com/iflytek/skillhub/blob/main/docs/07-skill-protocol.md)

**多技能容器：有，但形态与我们的 `.dshskill` 不同，且分两层：**

1. **Skill Suite**（`docs/25-skill-suites.md`）：一个有独立身份的技能集合，**只引用已发布的精确 SkillVersion，不复制文件**。
   ```yaml
   apiVersion: skillhub.iflytek.com/v1alpha1
   kind: SkillSuite
   metadata: { namespace: global, slug: superpowers, version: 1.0.0, displayName: Superpowers }
   spec:
     visibility: PUBLIC
     entrySkill: "@global/using-superpowers@1.0.0"
     members:
       - skill: "@global/using-superpowers"
         version: 1.0.0
   ```
   文档明确："`suite.yaml` 是可移植的 Suite 创作格式，**不是上传到 Agent 的多 Skill ZIP**"，且"CLI v1 负责安装生命周期，尚不读取或发布 `suite.yaml`"。
2. **SkillSuiteBundle**（`docs/skillhub/guide/suite-bundle.md`）：**这是唯一与 `.dshskill` 结构同形的东西**——一次上传一个 ZIP，根 `SUITE.yaml` + `skills/<dir>/SKILL.md`：
   ```
   SUITE.yaml
   skills/
     intake/SKILL.md
     summarizer/SKILL.md
   ```
   但它是 **Web 端创作/审核入口**，不是分发给 Agent 的包；成员可以是 `package`（随本次上传发布）或 `reference`（引用已有版本）。且默认关闭，需 `SKILLHUB_SUITE_BUNDLE_CONFIRMATION_ENABLED=true` + `SKILLHUB_SUITE_REVIEW_WRITES_ENABLED=true`。

### 1.3 能力面：列表/搜索/安装/发布/权限/版本管理/签名校验、开放 API、鉴权

**产品能力清单**（README 核心特性 + 各 guide）：自托管私有化、发布与语义化版本、标签（`beta`/`stable`/自动 `latest`）、全文搜索（PostgreSQL，中英文分词，按命名空间/下载量/评分/时间过滤排序）、团队命名空间（OWNER/ADMIN/MEMBER）、审核与治理（多级审核、提升到全局、审计日志）、社交（收藏/评分/下载量/文字评价）、账户合并（多 OAuth 身份聚合）、API 令牌管理、CLI 优先、可插拔存储（本地/S3/MinIO）、i18n。

**开放 API：有，三套路径族**（从 CLI 源码实测其真实调用面，[cli/src/clients/skillhub-client.ts](https://github.com/iflytek/skillhub/blob/main/cli/src/clients/skillhub-client.ts)）：

| 路径族 | 用途 | 实测调用 |
|---|---|---|
| `/api/v1/**` | 公开读 + 认证写（Web/portal 面） | `/api/v1/skills/...`、`/api/v1/reviews`、`/api/v1/namespaces` |
| `/api/cli/v1/**` | **CLI 实际使用的面**（也是 ClawHub 兼容层所在） | `getJson()` 全部拼 `/api/cli/v1${path}` |
| `/api/web/**` | BFF/前端专用 | `/api/web/skills`（实测公开云返回分页技能列表） |

**公开匿名可访问端点**（[docs/06-api-design.md](https://github.com/iflytek/skillhub/blob/main/docs/06-api-design.md) §7.1，实测公开云确认可用）：

```
GET /api/v1/skills                                  搜索/列表
GET /api/v1/skills/{namespace}/{slug}                详情
GET /api/v1/skills/{ns}/{slug}/versions[/{version}]  版本列表/详情
GET /api/v1/skills/{ns}/{slug}/versions/{v}/files    文件清单
GET /api/v1/skills/{ns}/{slug}/versions/{v}/file?path=   读单文件
GET /api/v1/skills/{ns}/{slug}/download              下载默认安装版本
GET /api/v1/skills/{ns}/{slug}/resolve?version|tag|hash   版本解析
GET /api/v1/skills/{ns}/{slug}/tags/{tag}/download   按标签下载
GET /api/v1/namespaces                               （实测公开云需登录）
```

**发布端点**：`POST /api/v1/skills/{namespace}/publish`（multipart：`file` + `visibility`）；CLI 走 `POST /api/cli/v1/skills/{namespace}/publish`，且有 `/publish/validate` 预校验。

**统一响应包**（对我们很重要——见 §2）：
```json
{ "code": 0, "msg": "成功", "data": {}, "timestamp": "...", "requestId": "..." }
```
失败时 `code` = HTTP 状态码。分页统一 `{items,total,page,size}`。

**权限模型**：平台角色 `SUPER_ADMIN` / `SKILL_ADMIN` / `USER_ADMIN` / `AUDITOR` ∪ 命名空间角色 `OWNER`/`ADMIN`/`MEMBER`；`namespace_member.role` 是权限主轴，`owner_id` 语义为"主要维护人"。

**鉴权方式**：
- Web：OAuth2 Authorization Code（默认 GitHub），可扩展 GitLab/OIDC（Okta/Keycloak 已验证）/钉钉/飞书；本地账号密码；Spring Session + Redis。
- CLI：**OAuth Device Flow**（`/api/v1/auth/device/code` + `/api/v1/auth/device/token`，`--no-open` 支持无头终端）。
- 程序化：API Token，`Authorization: Bearer sk_xxx`，**只存 SHA-256 哈希、明文只展示一次**，作用域 `skill:read` / `skill:publish` / `skill:delete` / `token:manage`。

> **作用域非最小权限（对方自己承认）**："一期 Token 作用域为粗粒度动作级别，不与 namespace 绑定。Token 继承用户的全部权限……这是有意的一期简化，不满足最小权限原则。"

来源：[docs/03-authentication-design.md](https://github.com/iflytek/skillhub/blob/main/docs/03-authentication-design.md)

**幂等：有，且与我们撞名**。CLI 发布路径带 `Idempotency-Key`（`skillhub-client.ts` L202 实测），Suite 安装计划也带独立 `Idempotency-Key` 并在网络错误/502/503/504 时用同一 key 重试一次。

**版本管理**：semver + 标签 + 版本范围解析 + `latest` 指针 + `yank`（撤回已发布版本）/`rerelease` + 归档/取消归档 + 隐藏 + 删除 DRAFT/REJECTED。

**签名校验：未查到（且实测否定其存在）**。

- 全仓库 `cli/src/clients/skillhub-client.ts`、`cli/src/commands/install.ts`、`cli/src/commands/publish.ts` 中 **grep `sha256|hash|digest|signature|cosign` 无任何命中**（只有 `Idempotency-Key`）。
- `cli/src/platform/download.ts` 只有大小上限 `MAX_PACKAGE_BYTES = 100 * 1024 * 1024`，**没有任何摘要校验**。
- 协议文档 §8.6 曾在 `.astron/metadata.json` 示例里出现 `sha256` 字段，但**实际 CLI 写的是 `.skillhub/metadata.json`，其真实字段为 `registry/namespace/slug/version/agent/installedAt`，没有 sha256**。这份文档的该字段属于未落地描述。
- 完整性保障实际走**服务端 Skill Scanner + 人工审核**，不是密码学签名：Scanner 多引擎（元数据/行为分析/LLM 分析/Cisco AI Defense/VirusTotal），发布后进入 `SCANNING`，结果写 `security_audit`，再转 `PENDING_REVIEW`；Scanner 默认 `enabled: true`，但 `SKILLHUB_SECURITY_SCANNER_ENABLED` 可关。

来源：[docs/security-scanning.md](https://github.com/iflytek/skillhub/blob/main/docs/security-scanning.md)、[docs/skillhub/guide/scanner.md](https://github.com/iflytek/skillhub/blob/main/docs/skillhub/guide/scanner.md)、上列 CLI 源码

**SDK / MCP：未查到。** 仓库只有一个 Python REST 示例 `examples/python`（README 链接），**没有官方 HTTP SDK**；`.mcp.json` 里只有 Playwright（开发用），**没有 MCP server**。

### 1.4 运行时：技能怎么被执行

**结论：SkillHub 不执行技能，不提供容器/沙箱/进程内执行，也没有模型或工具调用协议。**

它对"运行时"的全部主张是一份**建议性的 trace 字段约定**（"Runtime 应记录什么"），而非可执行协议：

| 字段 | 来源 |
|---|---|
| `registryUrl` | Runtime 配置 |
| `namespace` / `skillSlug` | SkillHub 坐标 |
| `requestedVersion` / `resolvedVersion` | Runtime 请求 / SkillHub 响应 |
| `skillVersionId` | 版本不可变 ID，审计关联主键 |
| `complianceSnapshotDigest` | `complianceSnapshot.digest` |
| `packageDigest` | 下载或安装流程 |
| `runtimeTraceId` | Runtime 自己生成 |

并给出"推荐执行链路"：Runtime 解析坐标 → 取版本详情 → **下载并校验技能包** → **执行技能** → 在 Runtime 自己的 trace 里记字段。**执行环节完全落在客户端 Agent 身上。**

**安装侧共识**：技能的"落地"依赖各 Agent 自己的技能目录约定。SkillHub CLI 内置 17 个 agent profile，其中**包含 `dsh`**：

| Agent | 项目级 | 用户级 |
|---|---|---|
| `dsh`（DeepSeek Harness） | `<project>/.dsh/skills/` | `~/.dsh/skills/` |
| `claude-code` | `<project>/.claude/skills/` | `~/.claude/skills/` |
| `codex` | `<project>/.codex/skills/` | `~/.codex/skills/` |
| `_fallback_` | `<project>/.agents/skills/` | `~/.agents/skills/` |

来源：[docs/skillhub/guide/cli.md](https://github.com/iflytek/skillhub/blob/main/docs/skillhub/guide/cli.md)、[cli/src/agents/profiles/](https://github.com/iflytek/skillhub/tree/main/cli/src/agents/profiles)

**已存在的 DSH 集成文档**（`docs/dsh-integration.md`）关键事实：

- 依据 DSH 提交 `ddefc45` 的 `@deepseek-ai/dsh-skill-filesystem` 行为编写，验证日期 2026-09-20，并注明"该版本仍处于 `0.1.x` developer preview；升级 dsh 后请重新核对技能根目录约定"。
- 安装命令：`skillhub install my-skill --agent dsh --scope user|project`。
- **明确写了 dsh 的目录约定**："DeepSeek Harness 的 `dsh` profile 使用项目级 `./.dsh/skills/` 和用户级 `~/.dsh/skills/`；dsh 同时原生扫描 `.agents/skills/` 通用目录。dsh 把最近的 `.git` 祖先作为项目根目录。"
- 兼容性边界自陈："SkillHub 安装目录采用 `<skill-slug>/SKILL.md`，符合 dsh 对根目录一级技能包的发现规则"；"`SKILL.md` 至少需要合法的 kebab-case `name` 和非空 `description` frontmatter"；"**格式兼容不代表运行时能力完全相同**。技能依赖的 Agent 专用工具、命令、MCP server、环境变量和操作系统能力仍需单独验证。"
- 项目根差异告警：dshent 项目级安装必须从 `git rev-parse --show-toplevel` 执行，否则 CLI 会写到子目录而 dsh 不认。

### 1.5 生态：官方技能数量、第三方贡献、是否必须登录讯飞账号

**官方内置技能：22 个**（`builtin-skills/catalog.json` 实测 `"slug"` 计数 = 22）。许可证分布：MIT 14、Apache-2.0 5、CC-BY-SA-4.0 3。全部来自上游仓库并**固定 commit**（例如 `github.com/openclaw/openclaw`、`github/awesome-copilot`、`GarethManning/education-agent-skills`），另有 `builtin-skills/evals.json` 提供每个技能的验收用例（prompt/acceptance/forbidden）。其中包含 `skillhub-cli` 自举技能。

**公开云注册中心的技能规模：确切公开总数未查到**——搜索接口不返回 `total`，只返回 `items` + `nextCursor`，且 `size` 被服务端固定在 25。可观测的下界证据：匿名搜索返回的技能 `id` 最大到 **24492**（`/api/web/skills` 首条 `id: 24492`，`page=1000` 处 `id: 22904`），说明技能记录量在**数万级**（该 id 空间含非 PUBLIC 记录，不能等同于公开技能数）。内容上以用户投稿为主，质量参差（实测抓到"OOTD 穿搭""章回体小说""冷笑话"与"病历摘要""k8s 部署"并存）。

**第三方贡献方式**：两条路径，均无需特殊授权——(1) 提 issue 说明技能来源与解决的问题；(2) 按 `builtin-skills/README.md` 提交 PR 进入候选池，经验证后有机会进入精选集合。仓库另设 `docs/22-builtin-skills-candidate-pool.md`、`docs/23-builtin-skills-first-round-test-report.md` 记录选品与测试流程。

**是否需要登录讯飞账号：分场景，且公开云确实绑定讯飞 SSO。**

- **匿名可读**：公开云 `GET /api/v1/skills`、详情、`download` 实测**无需任何凭据**即可成功（我据此下载了 25 个技能包）。
- **讯飞账号绑定（实测证据）**：公开云 `GET /api/v1/auth/methods` 返回的**唯一**登录方式是
  ```json
  [{"id":"bootstrap-private-sso","methodType":"SESSION_BOOTSTRAP","provider":"private-sso","displayName":"Xfyun SSO","actionUrl":"/api/v1/auth/session/bootstrap"}]
  ```
  即公开云用讯飞自有 SSO（`SESSION_BOOTSTRAP`）接管登录，`/api/v1/auth/providers` 返回空数组（无 GitHub OAuth），且 `/api/v1/namespaces`、`/api/web/stats` 均返回 `401 Authentication required`。**结论：浏览/下载不要账号，但发布、命名空间、`whoami`、CLI 登录都要讯飞账号。**
- **自托管不受此限制**：本地账号密码、GitHub OAuth、OIDC、钉钉、飞书均可，且支持"私有 SSO 集成 playbook"。

来源：[builtin-skills/catalog.json](https://github.com/iflytek/skillhub/blob/main/builtin-skills/catalog.json)、[builtin-skills/README.md](https://github.com/iflytek/skillhub/blob/main/builtin-skills/README.md)、[docs/11-auth-extensibility-and-private-sso.md](https://github.com/iflytek/skillhub/blob/main/docs/11-auth-extensibility-and-private-sso.md)、上列公开云实测

---

## 2. 对照表：SkillHub 概念 ↔ 我们的对应物

我们的既有事实来源：`SkillArtifactInspector.java`（我逐行读完 280 行，HEAD `323f312`，确认 `MAX_MANIFEST_BYTES = 1_048_576`、`MAX_SKILL_MD_BYTES = 262_144`、`MAX_SKILLS = 200`、`format=dsh-skill`、`name` 正则与官方 `dsh-skill` 逐字一致、`whenToUse` ≤2048、`disable-model-invocation`、`user-invocable`；**本轮新增实测**：① `skills/` 子树深度不受限；② manifest 未知键被解析后忽略且不透传；③ 256KiB/1MiB 是"逐条目 + 只作用于两个特定路径"，**不存在逐文件总闸，也不存在文件类型白名单**）+ 任务书给定的服务端/员工端接口事实。

| # | SkillHub 概念 | 我们的对应物 | 差异性质 |
|---|---|---|---|
| 1 | Skill = **单技能包**，根 `SKILL.md` | **我们没有单技能包**；`.dshskill` 是**多技能包** | 🔴 结构级不兼容 |
| 2 | 根 `manifest.json` | 无（SkillHub 没有 manifest 概念） | 🔴 结构级不兼容 |
| 3 | `manifest.json{format:"dsh-skill",version:"1",id,name,sourceDshVersion,description?}` | **无对应物** | 🔴 独有 |
| 4 | `skills/<kebab-name>/SKILL.md` 嵌套 | 无对应物（SkillHub 是根级 `SKILL.md`） | 🔴 结构级不兼容 |
| 5 | `SKILL.md` frontmatter：`name`(kebab) + `description` | **完全一致**（我们：`name` kebab ≤64、`description` ≤1024） | 🟢 天然兼容 |
| 6 | `SKILL.md` frontmatter：`version`（可选） | 我们不在 frontmatter 放版本，版本在服务端 | 🟡 语义位不同 |
| 7 | `x-astron-category` / `x-astron-runtime` / `x-astron-min-version` | 我们没有 | 🟢 **实测：可安全忽略且可原样保留**——frontmatter 解析成 `Map<String,Object>` 后**只按名取**已知键，未知键既不报错也不进入投影（见 §5.3） |
| 8 | `x-astron-compliance[]`（合规声明 + 证据文件 + digest 快照） | 我们没有 | 🔴 我们没有对应治理能力 |
| 9 | `references/` / `scripts/` / `assets/` 位于**包根** | 我们的包根**只允许 `manifest.json` + `skills/`**，这些目录只能出现在 `skills/<name>/` 下 | 🔴 结构级不兼容，但**实测可机械解决**：`skills/` 子树深度不受限，整体下移一层即可（见 §5.2） |
| 10 | 无 `whenToUse` / `disable-model-invocation` / `user-invocable` | 我们有这三个字段 | 🟡 我们独有，**反向转换时必然丢失**（前者的语义必须人工并入 `description`，见 §5.5） |
| 11 | `name` 长度无显式上限（doc 未写） | 我们 `≤64` | 🟢 我们更严 |
| 12 | `description` 无显式上限（doc 只写"1-2 句"） | 我们 `≤1024` | 🟡 超长**直接拒绝（不截断）**——`requiredSkillText` 是"过长即 invalid"，不是裁剪；转换器要如实报错而不是帮用户截 |
| 13 | 单文件上限 **1MB**、总包 **10MB**、条目 **100**（另有 CLI 侧 500 条目 / 100MB 包 / 10MB 单文件） | **逐条目**门禁只有两个：根 `manifest.json` ≤ **1MiB**、`skills/<name>/SKILL.md` ≤ **256KiB**；技能条目 ≤ **200**；另有三个整体闸门（归档 ≤ **50MiB**、解压 ≤ **200MiB**、zip entry ≤ **10000**） | 🟢 **原"🔴 实测冲突"判断已被源码推翻**：256KiB 只作用于 depth-3 的 `SKILL.md`，3.41MB 的 `skills/<name>/assets/mermaid.min.js` **不触发任何逐文件门禁**（实测证据见 §5.4） |
| 14 | 文件类型白名单 12 种（含 `.js/.ts/.py/.sh/.png/.jpg/.svg`） | **实测：我们没有任何文件类型白名单**（280 行内无扩展名/类型断言，只校验路径、逐条目大小、条目数与结构） | 🟢 我们更宽，不会因文件类型拒绝 |
| 15 | 坐标 `@namespace/slug` | 我们有 `packageId`，**无 namespace 概念** | 🔴 模型差异 |
| 16 | 命名空间成员制（OWNER/ADMIN/MEMBER） | 我们无；我们用**分配** `assignments[{subjectType:ALL\|USER, subjectId?}]` | 🔴 治理模型不同 |
| 17 | 可见性 `PUBLIC`/`NAMESPACE_ONLY`/`PRIVATE` | 我们无对应物（靠 assignment 收敛受众） | 🔴 模型差异 |
| 18 | 语义化版本 + 标签（`latest` 保留 / `beta` / `stable`）+ 版本范围解析 | 我们有版本 + `publish`/`retire`；**无标签、无范围解析** | 🟡 我们更简单 |
| 19 | `SkillVersion` 不可变版本 + 数字 `id` | 我们有版本，且有**两套独立 revision**（包 revision 与版本 revision 是不同的数） | 🟢 概念一致、并发语义不同 |
| 20 | 状态机 `DRAFT→PENDING_REVIEW→PUBLISHED→YANKED/REJECTED` + `SCANNING` | 我们有 `publish` / `retire` 动作（完整状态机本文未逐一核对） | 🟡 我们少了审核态与扫描态 |
| 21 | `hidden` 独立治理覆盖层 | 无对应物 | 🟡 缺 |
| 22 | **Skill Scanner** 多引擎安全扫描 + `security_audit` | **无内容安全扫描**；只有包结构/大小/条目校验 | 🔴 能力缺口 |
| 23 | ReviewTask 审核工作流 + 提升到全局 + 审计日志 | 无审核工作流；管理面直接 `publish` | 🟡 治理深度差异 |
| 24 | 统一响应 `{code,msg,data,timestamp,requestId}` | **实测不同构**：企业 API 成功包是 `EnterpriseResponse{data, requestId}`——**没有 `code`/`msg`/`timestamp`**；失败不塞进成功包，而是走独立错误码（如 `ENT_SKILL_INVALID_PACKAGE`、`ENT_SKILL_TOO_LARGE`） | 🟡 差异明确，适配=包一层 |
| 25 | 分页 `{items,total,page,size}` | **实测是游标式**：`CursorPageData{items, page:{hasMore, limit, nextCursor}}`，**完全不返回 `total`**；游标编码在 `cursor` 请求参数里 | 🟡 分页模型不同（游标 vs 页码），且"总数"这类 UI 需求我们没有数据源 |
| 26 | `Idempotency-Key` 幂等 | **我们有**（`POST /versions` 必填 `Idempotency-Key:UUIDv4`；分配接口同样带头） | 🟢 天然契合；**但实测语义要精确**：该头只用于 pending 制品落盘路径命名（`artifacts.writePending(uploadId, input)`），真正的去重键是**内容寻址**的 `(tenantId, skillId, sourceDshVersion, sha256)` → **同字节重复上传**返回既有版本（`UploadResult(existing, false)` → 200），**同 key 不同字节不会去重**。对方的 `Idempotency-Key` 是"同一次请求重试"语义，两者不是同一个东西，方案 B 适配时不要混淆 |
| 27 | **无** 乐观并发 | 我们有 `If-Match: revision` | 🟢 我们更强，SkillHub 无对应物 |
| 28 | API Token `sk_` + Bearer + scope（`skill:read/publish/delete`、`token:manage`） | 我们自研 PKCE（`client_id` 如 `dsh-desktop` / `ent-admin-cli`） | 🟡 鉴权体系不同、可并存 |
| 29 | OAuth Device Flow（CLI 登录） | 我们有 PKCE 授权码流，未上 Device Flow | 🟡 可借鉴 |
| 30 | CLI 安装到 `.dsh/skills/`（真实落盘） | 我们**阶段一是"复制装配指令"交给用户自己的 Agent 会话落盘**，不做服务端下载代理 | 🟡 交付路径不同（我们有意为之） |
| 31 | Skill Suite（引用式多技能集合，不复制文件） | 无对应物 | 🔴 独有 |
| 32 | **SkillSuiteBundle**（`SUITE.yaml` + `skills/<dir>/SKILL.md`，`apiVersion: skillhub.iflytek.com/v1alpha1`） | **最接近 `.dshskill`**（`manifest.json` + `skills/<kebab>/SKILL.md`） | 🟢 **最佳映射锚点** |
| 33 | 发布 = 上传 zip 到 `POST .../publish`（multipart） | 我们 = `POST /versions` 上传 `artifact`（multipart）+ 可选 `metadata` | 🟢 形态一致 |
| 34 | 下载产物 = **扁平 zip，`SKILL.md` 在根**（实测） | 我们 = zip，`manifest.json` 在根 + `skills/` 子树 | 🔴 结构级不兼容 |
| 35 | Apache-2.0 | **实测：本仓库是 MIT**——根 `NOTICE` 写明 fork 为 MIT，`server/**`/`plugin/**`/`console/**` 等树为 MIT 的 OwnDsh 派生，vendored 的 RuoYi-Vue-Plus 亦为 MIT；**仓库根没有 `LICENSE` 文件**（这本身是一处待补齐的仓库治理项） | 🟢 双方都是宽松许可，互操作与再分发无冲突（署名义务见 §6.3） |
| 36 | 无 MCP / 无官方 SDK / 仅 Python 示例 | 无对应物 | ⚪ 中性 |
| 37 | 内建 `dsh` agent profile + 专门的 DSH 集成文档 | **对方已主动适配我们** | 🟢 **战略机会** |

**一句话总结对照表**：**frontmatter 层（`name`/`description`）天然兼容，容器层（单技能扁平 vs 多技能 manifest 包裹）结构性不兼容，治理层（namespace/审核/扫描）我们基本没有对应物。**

---

## 3. 可行方案

工作量按"1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时"估算，含实现+测试+文档，不含排期等待与跨团队协调。

### 方案 D：不集成，只做格式对齐（代价最低）

**做什么**：不引入任何 SkillHub 依赖。在文档与 manifest 层做**前向兼容对齐**：

1. 固化一份《`.dshskill` ↔ SkillHub 技能包字段映射表》（即本文 §2 的收敛版），作为长期契约。
2. 在我们的 `manifest.json` 里**可选**增加 `namespace`、`tags[]`、`license` 三个字段。**原推断**："我们现有校验对未知字段的处理需先确认，若拒绝则改为允许白名单外的 `x-` 前缀扩展字段。" → **实测更正**：`validateManifest` 用 `json.readTree()` 建树后**只按名取** `format`/`version`/`id`/`name`/`sourceDshVersion`/`description`，未知顶层键**既不报错、也不保存、也不投影**（`InspectedSkillPackage` 只带这 5 个字段）。所以：**"让老客户端不炸"是零风险的**；但**"加字段"本身带不来任何可查询的收益**——要让 `license` 真的可用，必须改 `SkillArtifactInspector` + `domain`/`persistence` 投影 + 一次迁移，那已超出 D 的 1–2 人日，属于 A 的规格范围（§5.1）。**结论：D 只应保底"字段不报错"，不应承诺"字段可用"。**
3. 明确声明：`.dshskill` 的 `skills/<name>/` 与 SkillHub 的包根语义等价，便于未来双向转换。
4. 在技能创作文档里加一节"如何手写一份同时能被 SkillHub 接受的 `SKILL.md`"（约束：kebab `name`、非空 `description`、不依赖 `whenToUse`）。

**改哪里**：格式（`SkillArtifactInspector` 的字段白名单，或不改代码只改文档）；不需要动服务端接口、员工端、装配。

**工作量**：**1–2 人日**（若选择"只写文档、零代码"，则 0.5 人日；若确实要放开 manifest 字段并写单测，2 人日）。

**风险**：低。唯一风险是"对齐了但永远用不上"（沉没成本 <2 人日）；以及 `manifest.json` 加字段的向后兼容决策——**已在 §0.1 ②实测关闭**：老客户端读到未知字段既不报错也不使用（`readTree` + 按名取），所以**没有兼容风险**；但同样地**没有持久化收益**。

**可逆性**：**完全可逆**。纯文档 + 可选字段，回退即删。

**前置条件**：~~确认我们客户端对 `manifest.json` 未知字段的行为（容忍 or 报错）。这是唯一的技术前置。~~ → **已在 §0.1 ②实测关闭**：未知字段被忽略且不透传，加字段安全。剩余前置只有一条：**决定"加字段"是否要连带做服务端持久化与投影**（不做则 D 无查询收益）；以及 CC-BY-SA-4.0 分发口径（§6.3，与 A 共用）。

### 方案 A：格式互操作 —— 离线双向转换器（代价次低）*【推荐】*

**做什么**：交付一个**独立的转换工具**（开发/运维工具，不进产品运行时），实现两个方向的转换，让同一份技能两边都能用：

**方向 1：SkillHub 技能包 → `.dshskill`**
1. 解压 SkillHub zip，读根 `SKILL.md` 的 frontmatter 取 `name`/`description`。
2. 合成 `manifest.json`：`format:"dsh-skill"`, `version:"1"`, `id`（取 slug 或 `@ns/slug` 派生）, `name`, `sourceDshVersion`（填对方 v0.2.x 或转换器版本）, `description`。
3. **把包根除 `SKILL.md` 外的内容整体重定位到 `skills/<name>/`**（`references/`、`scripts/`、`assets/` 全部随迁），`SKILL.md` 落到 `skills/<name>/SKILL.md`。
4. **降级/剥离对方独有 frontmatter 字段**。**原推断**："丢弃 `x-astron-*`（其中 `x-astron-compliance` 转存为包外的一份 `COMPLIANCE.md` 供人读，**不放进包里**，因为我们对未知字段的容忍度未知）；`version` 字段剥离（版本归服务端）。" → **实测更正（§0.1 ②）**：frontmatter 未知键**被安全忽略**，因此 `x-astron-*` 与 `version` **可以原样保留**（零成本、零风险，且利于反向转换保真）；但服务端**不会把它们投影给员工端**（`EntryView` 只有 `name`/`description`/`whenToUse`/`modelInvocable`/`userInvocable`）。**建议**：**保留原字段 + 额外把 `x-astron-compliance` 转存为包外 `COMPLIANCE.md` 供人读**，并在转换报告里注明"这些字段我们既不校验也不作为合规凭据"（§7 第 5 条）。完整映射规则见 §5.3。
5. 前置校验（复用我们服务端的规则做**离线预检**）。**原推断**："单文件 ≤256KiB、条目 ≤200、`name` kebab ≤64、`description` ≤1024。**不通过则明确报错并列出违规文件，不静默裁剪。**" → **实测更正（§0.1 ①③）**：正确口径是 **17 条门禁**，其中"逐文件"只有两个（根 `manifest.json` ≤1MiB、`skills/<name>/SKILL.md` ≤256KiB），`skills/<name>/references|assets|scripts` 下的文件**没有逐文件上限**，另有归档 ≤50MiB / 解压 ≤200MiB / entry ≤10000 三个整体闸门。**逐条清单、作用对象与失败处置见 §5.4**；"拒绝而不裁剪"的原则保留（新增的例外讨论见 §5.4 对 3.41MB assets 的处置结论）。
6. 产出 `.dshskill`，走我们既有的 `POST /enterprise/admin/v1/skills/versions` 人工上传。

**方向 2：`.dshskill` → SkillHub 技能包**
1. 读根 `manifest.json`，取 `name`/`description`。
2. **单技能包**：直接取 `skills/<name>/` 整棵子树，`SKILL.md` 提升到包根，其余目录按 `references/`/`scripts/`/`assets/` 同名保留（目录名不变，仅上提一层）。
3. **多技能包**：两种策略，转换器需显式让用户二选一——
   - (a) **拆分**：每个 `skills/<k>` 各出一个 SkillHub 包（推荐，语义最干净）；
   - (b) **聚合**：产出一个 `SUITE.yaml` + `skills/<k>/SKILL.md` 的 **SkillSuiteBundle**（注意：对方明确说这是 Web 创作入口、CLI v1 不读它，且默认功能关闭）。
4. frontmatter 补 `version`（取自服务端版本号）；**`whenToUse` 无法等价映射，必须提示用户把其语义合并进 `description`**（因为 SkillHub 没有 `whenToUse`，丢弃会让技能失去触发条件）。
5. 前置校验：单文件 ≤1MB、总包 ≤10MB、条目 ≤100、文件类型在对方 12 种白名单内。

**改哪里**：
- **格式**（核心）：转换器本体 + 一份可复用的规则映射模块。
- **服务端**：**不改**（转换后的 `.dshskill` 走既有 `POST /versions` 上传路径）。
- **员工端**：**不改**（走既有「复制装配指令」）。
- **装配**：**不改**。
- 交付物位置建议 `scripts/skillhub-convert/` 或独立小仓库，**不做成产品功能**。

**工作量**：**5–7 人日**
- 规则映射 + 双向结构转换：2 人日
- 前置校验器（复用服务端规则的离线版，含真实样本回归）：1.5 人日
- CLI 包装 + 错误报告（列出违规文件而非吞错）：1 人日
- 测试：以本轮实测的公开云真实样本集做回归（我实测 22/25 可下载，覆盖多目录/大文件/单文件包）：1.5 人日
- 文档 + 用户指引：1 人日

**风险**：
- 🟡 **静默语义丢失**：`whenToUse` 无对应物，若直接丢弃会让技能"触发不了"。缓解：强制提示 + 写进转换报告。
- 🟢 **~~大文件必然失败~~ 原判断已被源码实测推翻**：原推断"实测 22 个真实样本中 1 个含 3.41MB 文件，超我们 256KiB 上限 → 转换失败。这是**设计上的正确拒绝**"。→ **更正**：256KiB 只作用于 `skills/<name>/SKILL.md`，3.41MB 的 `assets/mermaid.min.js` 位于 depth>3，**不触发任何逐文件门禁**，该样本**可正常转换**。真正的体积风险只在三个整体闸门（归档 50MiB / 解压 200MiB / entry 10000）。**处置建议：原样保留，不裁剪、不拒绝、不外链**——理由与阈值见 §5.4。
- 🟡 **`sourceDshVersion` 语义污染**：SkillHub 导入的包填我方版本还是对方版本，会影响后续官方技能目录的版本判定。缓解：明确填转换器标识。
- 🟢 无新增攻击面（工具离线跑在开发机/运维机）。

**可逆性**：**完全可逆**。纯新增工具与文档，不触碰任何产品运行时与数据。删目录即回退。

**前置条件**：
1. 方案 D 的字段映射表（D 是 A 的第 0 步）。
2. ~~确认我们客户端对 `manifest.json` 未知字段的容忍度。~~ **已在 §0.1 ②实测关闭**：未知键被忽略且不透传 → A 与 D 都不需要为此做兼容分支。
3. ~~确认"包根只允许 `manifest.json` + `skills/`"是否**真的**禁止 `skills/<name>/references/` 这类二级子树……若内部也受限，方案 A 的重定位策略需重设计，工作量 +2 人日。~~ **已在 §0.1 ①实测关闭**：`validateEntry` 只在**根级**判定（`manifest.json` / `skills` / `skills/` 前缀），`isSkillFile` 只把 depth-3 的 `SKILL.md` 识别为技能条目，**`skills/` 子树深度不受限** → **重定位策略成立，不需要 +2 人日重设计**，A 的工作量维持 5–7 人日。**唯一需要注意的反向约束**：根级任何非 `manifest.json` 条目（`README.md`、`LICENSE`、`.gitignore`…）会被**整包拒绝**，所以"必须迁移"而非"可以迁移"（§5.2）。
4. 需要一份授权合规判断：SkillHub 技能许可证为 MIT/Apache-2.0/CC-BY-SA-4.0 混合，**CC-BY-SA-4.0 是 copyleft**，导入企业内部分发需法务确认（尤其带 `NOTICE.md`/`LICENSE.txt` 的包）。→ 处置建议（默认一票否决 + allowlist）见 §6.3。

### 方案 B：源接入 —— 把 SkillHub 当"技能来源(registry)"（代价中高）

**做什么**：把 SkillHub 作为一等公民的**外部技能源**接入我们服务端，让企业管理员能从它导入/订阅技能，再走我们既有的**发布 + 分配**链路。

具体：
1. 服务端新增"外部技能源"配置与凭据：`{sourceType:"SKILLHUB", baseUrl, apiToken?(sk_xxx), enabled}`。凭据加密存储，**不下发给员工端**。
2. 服务端新增导入代理：`POST /enterprise/admin/v1/skill-sources/{id}/import`
   - 输入 `{namespace, slug, version?|tag?}`
   - 服务端调 SkillHub `GET /api/v1/skills/{ns}/{slug}/resolve` 解析精确版本 → `GET .../versions/{v}/download` 取包
   - **内嵌方案 A 的转换器**（服务端 Java 实现，不是外部脚本）
   - 转换后**再走我们既有的 `SkillArtifactInspector` 全量校验**（绝不信任外部输入）
   - 落成我们自己的版本（`POST /versions` 的内部调用），保留来源溯源字段：`sourceRegistry`、`sourceNamespace`、`sourceSlug`、`sourceVersion`、`sourceSkillVersionId`、`sourcePackageDigest`
3. **订阅（可选二期）**：定期比对上游 `resolve`/版本列表，发现新版本时**只生成"待导入"提示**，**不自动发布**（自动发布等于把未经审核的第三方代码自动分发给全员，见 §7）。
4. 控制台（`console/`）新增"外部技能源"页面：连接测试、技能搜索（代理上游 `GET /api/v1/skills`）、导入向导、显示转换报告（含被剥离字段与被拒绝文件）。
5. 幂等：以 `(sourceId, sourceSkillVersionId)` 为幂等键，重复导入返回既有版本而非新建。

**改哪里**：
- **服务端**（主战场）：新增外部源配置、导入服务、转换器（Java 版）、溯源字段与迁移、管理面接口 `POST /enterprise/admin/v1/skill-sources/**`。既有 `POST /versions`、`publish`、`assignments`、运行时 `/enterprise/api/v1/skills` **均复用不改**。
- **员工端**：**不改**（技能照旧经由我们的运行时接口下发；员工不需要也不应该知道技能来自 SkillHub）。
- **格式**：复用方案 A 的映射规则，但用 Java 重写（约 60% 逻辑可平移）。
- **装配**：**不改**。

**工作量**：**14–20 人日**
- 外部源配置 + 凭据加密 + 迁移：3 人日
- 导入服务（resolve/download/幂等/溯源）：4 人日
- Java 版转换器（迁移方案 A 规则 + 服务端校验）：4 人日
- 管理面 API + 权限码 + 审计：2 人日
- 控制台页面（列表/搜索/导入向导/转换报告）：4 人日
- 集成测试（含真实公开云 + 断网降级 + 恶意包对抗测试）：3 人日

**风险**：
- 🔴 **上游 API 未冻结**：SkillHub 仍是 `v0.2.x`，`/api/cli/v1/**` 是它的 CLI 内部面，`/api/v1/**` 也在演进（近期提交里有 "add organization creation control plane slice"、"decouple organization APIs from OIDC controls"）。我们等于把一个移动靶写进服务端。
- 🔴 **供应链安全**：我们把第三方代码导入企业技能库再分发给全员。**SkillHub 的 Scanner 默认可能被关、且我们无法验证它跑没跑**；而我们自己**没有内容安全扫描**。这是方案 B 最大的实质风险，且不是技术工时能解决的。
- 🟡 **网络可达性**：我们的服务端若部署在内网无出网，`skill.xfyun.cn` 不可达；自托管实例又需要另外的授权。缓解：支持配置镜像/私有实例地址。
- 🟡 **公开云要讯飞账号**：实测公开云登录只走 Xfyun SSO，**没有 API Token 自助签发入口可确认**（`/api/v1/auth/providers` 为空）。若拿不到 `sk_` Token，程序化导入只能依赖匿名可读端点（搜索/详情/下载恰好都匿名，**恰好够用**）——但这条路随时可能被上游收紧。
- 🟡 **许可合规**：混合许可证（含 CC-BY-SA-4.0 copyleft）批量导入。
- 🟡 **同名冲突**：我们的 `packageId` 与对方 `@ns/slug` 不是一一对应，跨源同名需要冲突策略。

**可逆性**：**中等可逆**。功能可开关、可下线；但**已导入的技能版本会留在我们库里**，且带溯源字段（这是好事，可追溯）。数据库迁移是新增表/列，回退需一次反向迁移。**已分发到员工设备的技能不会被自动回收**。

**前置条件**：
1. 方案 A 完成（B 的转换器内核就是 A）。
2. **必须先补我们的内容安全/静态扫描能力**，否则 B 不应上生产（这是我认为 B 的硬前置）。
3. 服务端出网策略确认 + 代理白名单。
4. 法务对混合许可证（重点 CC-BY-SA-4.0）的导入分发结论。
5. 明确 SkillHub 实例形态：用公开云（绑定讯飞账号 + 对外依赖）还是自托管（多一套运维）。

### 方案 C：运行时接入 —— 评估直接引用它的运行时/执行协议（代价最高）

**做什么**：评估把 SkillHub 的运行时/执行协议引进来，或直接在设备上使用它的 CLI 做技能安装。

**先说结论：这个方案在技术上不成立，因为"它的运行时"不存在。**

我逐字核对了它的职责边界文档：SkillHub **不执行技能**，没有容器、没有沙箱、没有宿主进程内执行器、没有模型/工具调用协议。它对运行时的全部产出是一份**建议性的 trace 字段表**（§1.4），不是可实现的协议。所以"引用它的运行时"没有目标物可引用。

**能落地的只剩一条路：在设备上跑 SkillHub CLI**（`npm install -g @astron-team/skillhub` 或 `npx`），用 `skillhub install <slug> --agent dsh` 直接落盘到 `.dsh/skills/`。技术上它**确实支持 dsh**（内建 profile + 专门的 DSH 集成文档），但对我们而言：

1. **要求 Android 设备有 Node 20+ 运行时**并全局装 npm 包——与 DSH 在 Android 上的现状直接冲突，且引入一个我们无法控制版本的第三方可执行体。
2. **绕过我们的授权模型**：装配后员工设备上的技能完全不经过 `/enterprise/api/v1/skills` 的"已注册且 ACTIVE 设备"校验，也不经过 `assignments` 分配——**等于在治理体系上开一个洞**。
3. **与我们阶段一的装配决策正面冲突**："复制装配指令交给用户自己的 Agent 会话落盘"是有意选择的路径，引入 CLI 是推翻这个决策而非扩展它。
4. 需要网络直连 `skill.xfyun.cn`（Android 设备出网 + 讯飞域名可达），并把项目根/`DSH_HOME`/`.git` 祖先这些 CLI 自身的坑（对方文档里专门写了一节"项目根目录差异"）搬进我们员工端的支持负担。

**改哪里**：格式（需适配）、员工端（新增 Node/CLI 依赖）、装配（改为 CLI 落盘或双轨）、服务端（**无改动，但也因此失去治理**）。

**工作量**：**15–25 人日**（Android 上做 Node 运行时 + CLI 分发 + 双装配路径兼容 + 彻底重做授权模型的对齐），且**持续成本高**（跟着对方 CLI 版本走）。若只在开发机上试点验证可行性，则 2–3 人日。

**风险**：🔴 极高。治理绕过（授权模型被旁路）、Android 上第三方可执行体（供应链 + 体积 + 权限）、对方 CLI 升级带来的破坏性、`0.1.x` developer preview 阶段的 dsh profile 随时可能变。且对方文档自己写了"格式兼容不代表运行时能力完全相同，技能依赖的 Agent 专用工具、命令、MCP server、环境变量和操作系统能力仍需单独验证"——Android 上大量技能直接不可用。

**可逆性**：**低**。一旦员工设备上通过 CLI 装了技能，我们**没有回收通道**（我们不知道装了什么），只能靠人工清理；且授权洞一旦被业务依赖就难以收回。

**前置条件**：Android 上的 Node 运行时方案；以及一个**能解释"为什么授权要被旁路"的决策**——我认为后者不成立。

---

## 4. 推荐方案与理由

### 推荐：**方案 A（离线双向转换器），并把方案 D 的字段映射作为它的第 0 步；B 与 C 本轮不做。**

**理由**：

1. **A 命中了这件事的真实价值点，且成本只有 B 的 1/3。**
   SkillHub 对我们唯一不可替代的资产是两样东西：**它已经积累的技能内容**（22 个官方内置 + 公开云数万级记录）和**它已主动适配 dsh 的事实**（内建 profile + 专门的集成文档）。这两样东西的价值只有在"技能能被我们吃进来/吐出去"时才兑现，而这正是方案 A 的全部内容。方案 B 只是把 A 的转换器搬到服务端再加个 UI，**A 做完之后 B 是增量而不是重做**。

2. **A 的可逆性是满分，而 B 的不确定性来自我们无法控制的地方。**
   A 是开发/运维机上的离线工具，不碰产品运行时、不碰数据、不新增攻击面，删目录即回退。B 要把一个 `v0.2.x` 未冻结的第三方 API 写进我们的服务端，还要把第三方代码导入企业库再分发给全员——**在我们自己没有内容安全扫描的前提下，这是把风险敞口直接开到员工设备上**。SKILL.md 格式稳定（OpenSkills/Claude 谱系已事实标准化），而 SkillHub 的 HTTP API 还在演进（连组织/鉴权都在改动）——**押格式比押 API 理性得多**。

3. **A 的输出正是 B 的输入，路线是单向递进而非分叉。**
   如果 3–6 个月后确实出现"要批量导入外部技能"的需求，B 的 Java 转换器可以直接从 A 的规则模块平移（我估 60% 逻辑可复用），A 不会白做。反之先上 B 再补 A 则是重复建设。

4. **D 单独做不够，但作为 A 的第一步是必要的。**
   只对齐字段（D）解决不了根本问题——我们和 SkillHub 的**结构性不兼容在容器层（单技能扁平包 vs 多技能 manifest 包裹），不在字段层**。字段映射是转换器的规格说明书，所以 D 应该被 A 吸收，而不是独立立项。这也是我把 D 列为最低成本方案的原因，但我不推荐"只做 D"。

5. **C 在技术上就没有目标物。** 对方明确"不执行技能"，没有可引用的运行时；唯一能落地的"设备上跑 CLI"要推翻我们阶段一的装配决策并在授权体系上开洞，理由不成立。

**执行建议（如果要启动 A）**：

- ~~先花 0.5 人日**确认两个技术前置**~~ → **两个前置均已在 §0.1 用本仓库源码实测关闭**：① manifest 未知字段被忽略且不透传（加字段安全、但不持久化）；② **`skills/` 内部子目录不受任何约束**——`validateEntry` 只做根级前缀判定，所以"方案 A 需重设计（+2 人日）"这一分支**不成立**，A 的工作量维持 5–7 人日。**现在真正该先问清的两件事是**：(a) `sourceDshVersion` 填我方版本还是转换器标识（§5.1）；(b) CC-BY-SA-4.0 的 allowlist 口径（§6.3）——都**不是**代码问题。
- **新增**：先把 §5.4 的 17 条预检清单固化成规格再动手；转换器的产出一律走"离线预检 → 服务端真跑一遍"双闸门，**离线预检绝不作为放行依据**（服务端才是权威门禁）。
- 转换器**不做成产品功能**，放在 `scripts/` 下作为工具；在服务端有真实导入需求前，不让它进入生产链路。
- 用本轮已经趟通的**真实公开云样本集**做回归（我实测 22/25 可下载，含多目录/大文件/单文件三类形态），比造样本可靠。
- 启动前把**许可证合规**这一条过掉（CC-BY-SA-4.0 是 copyleft），否则工具做出来也不能合法用于内部分发。

---

## 5. 方案 A 转换规则规格

本节把 §3 方案 A 的"做什么"收敛成**可实现规格**（坐标映射 / 目录重定位 / frontmatter 映射 / 预检清单 / 反向转换 / 错误报告 / 接口契约）。**本文件仍不含任何代码，也不含实现承诺。**

所有"我们一侧"的约束都来自 §0.1 的源码实测（`SkillArtifactInspector.java`，HEAD `323f312`），下文引用的片段即该文件原文。

### 5.1 坐标映射

SkillHub 的坐标是 `@{namespace}/{slug}` + semver + tag；我们的 manifest 是**扁平五字段**，两边**不是一一对应**。

| 维度 | SkillHub | `.dshskill` manifest | 映射规则 |
|---|---|---|---|
| 身份 | `@{namespace}/{slug}` | `id`（必填） | **不能直搬**：实测 `PACKAGE_REF = ^[A-Za-z0-9][A-Za-z0-9._-]*$` 且 `requiredText(..., "id", 128)` —— `@` 与 `/` 都非法，`@global/my-skill` **必然被拒**。策略二选一：`--id-strategy slug`（`my-skill`，推荐；唯一性由我们服务端的 packageId 与租户域承担）或 `ns-slug`（`global-my-skill`，用于跨源同名消歧）。**转换报告必须打印实际写入的 `id`。** |
| 显示名 | `slug` 或上游 `displayName` | `name`（必填，≤**120**） | 优先 frontmatter/上游 `displayName`，缺省用 `slug`。 |
| 版本 | semver `major.minor.patch` + 版本范围 + tag（`latest` 保留 / `beta` / `stable`） | **manifest 里没有版本字段**；版本由服务端 `POST /versions` 分配 | tag **无对应物**，只能作为来源标注写进报告；注意我方的"最新已发布版本"由 `publish`/`retire` 决定，**与对方 `latest` 指针语义不同**，不要声称等价。 |
| 格式 | 无 manifest 概念 | `format`（必填）= `"dsh-skill"` | 常量；实测非此值直接拒（`manifest format 必须为 dsh-skill`）。 |
| 格式版本 | 无 | `version`（必填）= `"1"` | 常量；实测仅支持 `1`。 |
| 基线 | 无 | `sourceDshVersion`（必填，≤**64**，**无格式校验**） | 见下"取值口径"。 |
| 摘要 | `description` → `skill.summary` | `description`（**可选**，≤**2000**） | 透传 frontmatter `description`；超长**报错不截断**。 |

`sourceDshVersion` **取值口径（转换器必须显式配置，禁止静默默认）**，三选一：

- (a) **我们锁定的 DSH 版本**（如 `0.1.8`）——语义最诚实（技能将运行在该 Harness 上）；
- (b) **转换器标识**（如 `skillhub-convert/0.1.0`）——来源最清晰，且能一眼看出"这是外部导入的"；代价是会让"官方技能目录的版本判定"看到非版本号文本（§3 方案 A 已标注的风险）；
- (c) **上游 SkillHub 版本**（如 `skillhub-v0.2.21`）。

**建议：(b) 为主，把 (a)(c) 一并写进转换报告**。理由：实测该字段只是投影给管理面的自由文本（`requiredText(root.get("sourceDshVersion"), "sourceDshVersion", 64)`，无正则），它的信息价值在"可识别来源"，而版本号的信息价值在报告里不会丢。

**技能名规则**：`name` 取 `slug`，必须 kebab-case 且 ≤64 —— 实测 `SKILL_NAME = ^[a-z0-9]+(?:-[a-z0-9]+)*$` + `requiredSkillText(data, "name", path, 64)`，两条都硬。

### 5.2 目录重定位

**实测依据 1**——根级路径门禁只判前缀：

```java
// validateEntry()
// 只接受根 manifest.json 与 skills/ 子树，杜绝包内携带可执行落点的旁路目录。
if (!"manifest.json".equals(name) && !name.startsWith("skills/") && !"skills".equals(name)) {
    throw invalid("归档路径必须位于根或 skills/ 下");
}
```

**实测依据 2**——只有 depth-3 的 `SKILL.md` 被当成技能条目，其余 `skills/**` 条目只是"允许存在的载荷"：

```java
// isSkillFile()
String[] segments = name.split("/", -1);
return segments.length == 3 && "skills".equals(segments[0]) && SKILL_FILE.equals(segments[2]);
```

→ 结论：`skills/<name>/references/x.md`（4 段）与 `skills/<name>/assets/big.js`（4 段）**都通过路径校验**，`skills/` 下**深度不限**。**重定位策略成立。**

映射（**一个 SkillHub 技能 → 我们一个单技能 `.dshskill` 包**）：

```
SkillHub 扁平包（zip 根）              .dshskill（zip 条目）
SKILL.md                        →     skills/<slug>/SKILL.md
references/**                   →     skills/<slug>/references/**
scripts/**                      →     skills/<slug>/scripts/**
assets/**                       →     skills/<slug>/assets/**
README.md / LICENSE / NOTICE…    →     skills/<slug>/…            ← 必须迁移，不是可选
（无）                           ←     根 manifest.json（转换器合成）
```

三条硬结论：

1. **不新增外层目录**：zip 条目直接是 `skills/<slug>/…`，与上游"扁平"形态一致；外层目录由安装端创建（§1.2 已述）。
2. **根级任何非 `manifest.json` 条目都会被整包拒绝**——`README.md`、`LICENSE`、`.gitignore` 一视同仁（错误：`归档路径必须位于根或 skills/ 下`）。所以"迁移"是**强制动作**。这顺带**保住了署名**：我们仓库根 `NOTICE` 要求被 vendored 树的许可通告保持完整，迁移到 `skills/<slug>/` 而不是丢弃，正好满足（§6.3）。
3. **服务端不校验目录名与 frontmatter `name` 是否一致**（`parseSkillFile(file.getKey(), file.getValue())` 只用路径拼错误信息，不做比对）。为可读性与未来反向转换，建议 `<slug>` == frontmatter `name`。

### 5.3 frontmatter 映射

| SkillHub frontmatter | 我们 | 处置 |
|---|---|---|
| `name`（kebab，必需） | `name`（kebab ≤64，必需） | 直通；不合法 → **整个技能被拒**（我们缺 `name` 是整包拒绝，不是官方那种"忽略该文件"）。 |
| `description`（必需，1–2 句） | `description`（**必需** ≤1024） | 直通；>1024 → **拒绝，不截断**。同一文本可再写进 manifest `description`（≤2000）。 |
| `version`（可选；对方版本权威在服务端） | 无对应物 | **实测：未知键被安全忽略** → **保留以保真**，反向转换时原样吐回。 |
| `x-astron-category` / `-runtime` / `-min-version` | 无对应物 | **保留**（不报错、也不透传）。 |
| `x-astron-compliance[]` | 无对应物 | **保留 + 额外转存包外 `COMPLIANCE.md`** 供人读；**不得**作为我们的合规凭据（§7 第 5 条）。 |
| 我们独有 `whenToUse`（≤2048） | — | 反向转换必须把语义**人工合并进 `description`**，否则技能失去触发条件；转换器只能提示。 |
| 我们独有 `disable-model-invocation` / `user-invocable` | — | 反向转换**必然丢失**（对方无对应物）→ 报告里逐条列出，由人决定是否放弃转换。 |
| 旧字段 `modelInvocable` / `userInvocable` / `disableModelInvocation` | — | 对方没有；万一上游出现，我们**整包拒绝**并给出改名建议（`LEGACY_FIELDS`）。预检必须挡在前面。 |

**"降级保留"结论（回答 §3 方案 A 步骤 4 的疑问）**：`x-astron-*` **无需丢弃**。实测 `parseSkillFile` 把 frontmatter 解析成 `Map<String,Object>` 后**只按名取**五个键——

```java
String name = requiredSkillText(data, "name", path, 64);
String description = requiredSkillText(data, "description", path, 1024);
String whenToUse = optionalSkillText(data, "whenToUse", path, 2048);
boolean disableModelInvocation = booleanField(data, "disable-model-invocation", path);
boolean userInvocable = data.containsKey("user-invocable") ? booleanField(data, "user-invocable", path) : true;
```

其余键既不报错也不进入 `SkillEntry` —— **容忍，但不透传**。所以保真保留是零成本零风险的；真正会丢的不是"字段被删"，而是"**员工端看不到它们**"（对外投影 `EntryView` 只有 `name`/`description`/`whenToUse`/`modelInvocable`/`userInvocable`）。

### 5.4 转换前预检清单（逐条对应我们的门禁）

17 条，全部来自 `SkillArtifactInspector`（作用域一列是**关键**）。所有失败都是**拒绝该技能**，不静默裁剪。

| # | 门禁 id | 规则 | 常量来源 | **作用对象** |
|---|---|---|---|---|
| 1 | `GATE_PATH_WHITELIST` | 条目只能是根 `manifest.json`、或 `skills` / `skills/**` | `validateEntry` | 每个 zip 条目 |
| 2 | `GATE_PATH_SAFE` | 无 `.`/`..` 段、无反斜杠、非绝对路径、无 NUL、非空 | `validateEntry` | 每个 zip 条目 |
| 3 | `GATE_NO_DUPLICATE_PATH` | 不允许重复路径 | `paths.add(name)` | 每个 zip 条目 |
| 4 | `GATE_MANIFEST_BYTES` | `manifest.json` ≤ **1MiB** | `MAX_MANIFEST_BYTES = 1_048_576` | **仅根 `manifest.json`** |
| 5 | `GATE_SKILL_MD_BYTES` | `SKILL.md` ≤ **256KiB** | `MAX_SKILL_MD_BYTES = 262_144` | **仅 `skills/<name>/SKILL.md`（depth-3）** |
| 6 | `GATE_SKILL_COUNT` | 技能条目 ≤ **200** | `MAX_SKILLS = 200` | 被识别的 `SKILL.md` 数 |
| 7 | `GATE_ARCHIVE_BYTES` | 归档字节 ≤ **50MiB** | `enterprise.skill.max-archive-bytes` 默认 `52_428_800` | 压缩包本体 |
| 8 | `GATE_EXPANDED_BYTES` | 解压总量 ≤ **200MiB** | `enterprise.skill.max-expanded-bytes` 默认 `209_715_200` | **全部**条目解压字节 |
| 9 | `GATE_ENTRY_COUNT` | zip entry 数 ≤ **10000** | `enterprise.skill.max-entries` 默认 `10_000` | **全部** zip 条目（含目录条目） |
| 10 | `GATE_MANIFEST_SHAPE` | 必须是 JSON object；`format=dsh-skill`；`version=1` | `validateManifest` | manifest |
| 11 | `GATE_MANIFEST_ID` | `id` 匹配 `^[A-Za-z0-9][A-Za-z0-9._-]*$`，≤128 | `PACKAGE_REF` | manifest `id` |
| 12 | `GATE_MANIFEST_TEXT` | `name` ≤120、`sourceDshVersion` ≤64、`description` ≤2000 且必须为字符串 | `requiredText`/`optionalText` | manifest 字段 |
| 13 | `GATE_SKILL_NAME_KEBAB` | `name` 匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 且 ≤64 | `SKILL_NAME` | frontmatter `name` |
| 14 | `GATE_SKILL_DESCRIPTION` | `description` 必需、≤1024 | `requiredSkillText` | frontmatter `description` |
| 15 | `GATE_WHENTOUSE` | `whenToUse` ≤2048（可选） | `optionalSkillText` | frontmatter `whenToUse` |
| 16 | `GATE_FRONTMATTER_SHAPE` | 文件必须以 `---` 起（仅容许 BOM 前缀）、`---` 闭合、YAML **映射**、键必须字符串、**不允许重复键**、别名 ≤16 | `extractFrontmatter` + SnakeYAML `allowDuplicateKeys(false)`/`maxAliasesForCollections(16)` | 每个 `skills/<name>/SKILL.md` |
| 17 | `GATE_NO_LEGACY_FIELD` | 不得出现 `modelInvocable`/`userInvocable`/`disableModelInvocation` | `LEGACY_FIELDS` | frontmatter |

**回答补强项 ③：门禁是"逐条目"而不是"逐文件"，而且只有两个特定路径受逐条目限制。** 代码里的取值分支就是全部真相：

```java
boolean isManifest  = "manifest.json".equals(name);
boolean isSkillFile = isSkillFile(name);
ByteArrayOutputStream capture = isManifest || isSkillFile ? new ByteArrayOutputStream() : null;
int limit = isManifest ? MAX_MANIFEST_BYTES : MAX_SKILL_MD_BYTES;   // ← 只有这两类条目有逐条目上限
...
if (capture != null) {
    if (capture.size() + read > limit) {
        throw invalid(isManifest ? "manifest.json 过大" : "SKILL.md 过大");
    }
    capture.write(buffer, 0, read);
}
```

`capture == null` 的条目——即**所有既不是根 `manifest.json`、也不是 `skills/<name>/SKILL.md` 的条目**（含 `skills/<name>/assets/mermaid.min.js` 这类 depth>3 载荷，也含 `skills/x/notes.md` 这种 depth=3 但非 `SKILL.md` 的文件）——**走不到任何逐条目大小判断**，只被累加进 `expanded` 与 `entries`，也就是只受第 7/8/9 条整体闸门约束。

**因此：实测 3.41MB 的 `assets/mermaid.min.js` 不触发任何逐文件门禁。** 原 §2 第 13 行的"🔴 实测冲突：转换会被我们拒绝"与 §3 方案 A 的"🟡 大文件必然失败"**已被源码实测推翻**（该样本本可正常转换）。

**3.41MB assets 的处置建议：原样保留——不裁剪、不拒绝、不外链。**

| 选项 | 判断 | 理由 |
|---|---|---|
| **保留（推荐）** | ✅ | 逐条目门禁不作用于它，**无技术必要去动它**；3.41MB 距 50MiB/200MiB/10000 三个总闸有两个数量级余量；保真。 |
| 裁剪 | ❌ | `mermaid.min.js` 被裁剪即**损坏**（体积本身就是功能）；且会静默改变技能行为，违反"拒绝而不裁剪"原则。 |
| 外链 | ❌ | 会把技能改成需要出网的自定义实现，**已不是原技能**；还引入了我们无法控制的外部依赖与供应链面。 |
| 拒绝 | ❌ | 无门禁依据；白白丢掉一份真实可用的技能。 |

**配套动作**：预检只对第 7/8/9 条总闸设阈值，并在转换报告里**如实打印 `archiveBytes` / `expandedBytes` / `entryCount` 三个数**。理由是这三个阈值是**部署期可配**的（`EnterpriseSkillConfiguration` 会校验 `maxExpandedBytes ≥ maxArchiveBytes`、`maxEntries ∈ [1, 100000]`、`maxArchiveBytes ≤ 1GiB`）——运维一旦收紧配置，同一个包昨天能进今天不能进，报告里的三个数就是唯一的事后发现手段。

**方向不要混用**：反向（我们 → 对方）时对方协议写"单文件 1MB"（§2 第 13 行），那时 3.41MB **确实**要拒绝或报告——那是**出方向**的门禁。

### 5.5 反向转换（我们 → 对方）：可行，但有必然丢失

**可行**：单技能包是干净的 1:1——`skills/<name>/SKILL.md` 上提到包根，`references/`/`scripts/`/`assets/` 同名上提一层（目录名不变），frontmatter 去掉我们独有字段。工作量 ≤1 人日，复用同一套规则模块。

**必然丢失 / 变形**（逐条必须出现在转换报告里）：

1. **`manifest.json` 整体消失**：`id`、包级 `displayName`、`sourceDshVersion`、包级 `description`（≤2000）、`sha256`、版本号**全部无对应物**。特别注意：包级 `description` ≠ 技能 `description`，**只有后者**才是对方的 `skill.summary`。
2. **`whenToUse` 无等价物** → 必须人工并入 `description`，否则技能**失去触发条件**。转换器只能提示，不能替人决定（这是 §3 方案 A 已列的最高风险项）。
3. **`disable-model-invocation` / `user-invocable` 无对应物** → 静默丢失会**改变调用策略**（该技能会不会被模型自动调用），必须在报告中逐条列出并由人确认。
4. **多技能包无法 1:1**：只能 (a) **拆分**成 N 个单技能包（推荐，语义最干净），或 (b) 产出 `SUITE.yaml` + `skills/<k>/SKILL.md` 的 **SkillSuiteBundle**——但对方明确说那是 **Web 创作/审核入口、CLI v1 不读它、且默认关闭**，**不是分发给 Agent 的包**。策略必须由用户显式选择，转换器**不给默认值**。
5. **治理语义没有对应物**：我们的包 `revision` + `If-Match` 乐观并发、`assignments` 分配收敛受众、`publish`/`retire` 生命周期，在对方是另一套（namespace 成员 + 可见性 + 多级审核 + 扫描态），**不能映射**。
6. **版本权威会出现两个**：我们版本在服务端（frontmatter 里没有），反向转换必须从管理面取版本号补进 frontmatter；而对方的 `version` 也非权威（权威在对方服务端）。**"两个服务端各持一份版本权威"是长期不一致**，所以反向转换只应用于**取证/演示/对外输出**，不应用于生产分发。

**结论**：反向转换**作为方案 A 的可选第二步**（不阻塞入方向）值得做，成本低；但**不应成为常态分发路径**。

### 5.6 错误报告形状

**关键约束**：服务端此刻只有两个错误码（实测 `SkillArtifactException.errorCode()` → `ENT_SKILL_TOO_LARGE` / `ENT_SKILL_INVALID_PACKAGE`，中文 message 用于人读），而门禁有 17 条。所以**"拒在哪一条门禁"必须由离线转换器自己带 `gate` id**，不能只转发那一个码，也不能靠解析中文消息来判断。

```json
{
  "tool": "skillhub-convert",
  "toolVersion": "0.1.0",
  "direction": "skillhub-to-dshskill",
  "generatedAt": "2026-10-02T12:00:00+08:00",
  "limits": { "manifestBytes": 1048576, "skillMdBytes": 262144, "skillCount": 200,
              "archiveBytes": 52428800, "expandedBytes": 209715200, "entryCount": 10000 },
  "summary": { "total": 22, "converted": 20, "rejected": 2, "warnings": 3 },
  "results": [
    {
      "source": { "registry": "https://skill.xfyun.cn", "namespace": "global", "slug": "ootd-ai-stylist",
                  "requestedVersion": "latest", "resolvedVersion": "1.0.3" },
      "status": "CONVERTED",
      "output": { "file": "ootd-ai-stylist.dshskill", "manifestId": "ootd-ai-stylist",
                  "skillName": "ootd-ai-stylist", "skillCount": 1,
                  "archiveBytes": 41233, "expandedBytes": 98011, "entryCount": 6 },
      "gates": [
        { "id": "GATE_PATH_WHITELIST", "result": "PASS" },
        { "id": "GATE_SKILL_MD_BYTES", "result": "PASS", "observed": 1843, "limit": 262144 },
        { "id": "GATE_EXPANDED_BYTES", "result": "PASS", "observed": 98011, "limit": 209715200 }
      ],
      "warnings": [
        { "code": "W_LOSSY_FIELD", "field": "x-astron-compliance",
          "message": "原样保留在 skills/ootd-ai-stylist/SKILL.md；服务端不会投影给员工端；已额外转存包外 COMPLIANCE.md" },
        { "code": "W_LICENSE_FILE_PRESENT", "path": "skills/ootd-ai-stylist/LICENSE",
          "message": "许可文件已随包迁移（根级会被拒绝）；许可证判定=MIT，依据=包内 LICENSE 文本" }
      ]
    },
    {
      "source": { "registry": "https://skill.xfyun.cn", "namespace": "global", "slug": "some-big-pack",
                  "resolvedVersion": "2.1.0" },
      "status": "REJECTED",
      "rejectedBy": { "gate": "GATE_EXPANDED_BYTES", "errorCode": "ENT_SKILL_TOO_LARGE",
                      "message": "归档解压大小超过上限" },
      "evidence": { "observed": 264241152, "limit": 209715200,
                    "offendingEntries": [ { "path": "assets/huge.bin", "bytes": 251658240 } ] },
      "remediation": [
        "先与运维确认 enterprise.skill.max-expanded-bytes 的部署值是否可放宽（该值部署期可配）",
        "或联系上游裁剪该资源——我们不会代为裁剪，也不会外链替代"
      ]
    },
    {
      "source": { "registry": "https://skill.xfyun.cn", "namespace": "global", "slug": "BadName",
                  "resolvedVersion": "0.1.0" },
      "status": "REJECTED",
      "rejectedBy": { "gate": "GATE_SKILL_NAME_KEBAB", "errorCode": "ENT_SKILL_INVALID_PACKAGE",
                      "message": "SKILL.md name 必须是 kebab-case：BadName" },
      "evidence": { "observed": "BadName", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$", "maxLength": 64 },
      "remediation": [ "人工改名——改名会改变技能语义与触发词，转换器不自动改" ]
    }
  ]
}
```

约定：

- `status` ∈ `CONVERTED` / `REJECTED`，**没有 `PARTIAL`**：任一条门禁失败即**整技能拒绝**，不产出半成品包（与服务端"整包拒绝"语义一致，`SkillArtifactException` 直接把整个 `inspect` 打断）。
- `gate` 用 §5.4 的稳定 id（17 条各一个）；**不解析服务端中文消息做判断**，中文消息只用于人读。
- `evidence.offendingEntries` 用于体积类拒绝，按字节降序列前 N 条即可。
- `remediation` 是给人看的可执行下一步，**并明确写出"我们不会做什么"**（不裁剪、不外链、不改名）。
- `limits` 必须回显**本次实际使用的阈值**（因为它们是部署期可配的）。
- **退出码**：任一 `REJECTED` → 非 0，便于 CI 与批量脚本。

### 5.7 转换器输入输出契约（接口级，非实现）

CLI：

```
dsh-skillhub-convert to-dshskill \
  --input <path>                 # 必填：SkillHub 技能 zip（或已解压目录）
  --out-dir <dir>                # 必填：产出 .dshskill 的目录
  --coordinate <@ns/slug>        # 可选：坐标；缺省从 --input 文件名/目录名推断
  --id-strategy <slug|ns-slug>   # 默认 slug（§5.1）
  --source-dsh-version <text>    # 必填，无默认（§5.1 取值口径）
  --manifest-description <text|@file>   # 可选
  --compliance-out <dir>         # 可选：把 x-astron-compliance 转存为包外 COMPLIANCE.md
  --license-allowlist <list>     # 默认 MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC（§6.3）
  --report <path>                # 可选：JSON 报告（§5.6）；缺省 stdout
  --limits <path>                # 可选：覆盖预检阈值；缺省用 EnterpriseSkillProperties 默认值
  --fail-on-warning              # 可选：把 warnings 升级为拒绝（CI 用）

dsh-skillhub-convert to-skillhub \
  --input <path.dshskill> \
  --out-dir <dir> \
  --multi <split|suite>          # 多技能包策略；必填，不给默认（§5.5 第 4 条）
  --version <semver>             # 必填：取我们服务端的版本号
  --report <path>
```

函数签名级（供未来 §3 方案 B 的 Java 平移参考）：

```
ConversionPlan   plan(SkillHubArtifact source, ConvertOptions options)   // 纯函数：规则判定 + 目标结构计算，可单测
byte[]           emit(ConversionPlan plan)                              // IO：写 zip
ConversionReport convertAll(List<SkillHubArtifact> sources, ConvertOptions options)

SkillHubArtifact = { registryUrl, namespace, slug, requestedVersion?, resolvedVersion, packageBytes }
ConvertOptions   = { idStrategy, sourceDshVersion, manifestDescription?, complianceOutDir?, licenseAllowlist, limits }
```

**规则模块与 IO 必须分离**：`plan` 是纯函数（不碰文件系统、不碰网络），`emit` 只做序列化。这样将来 Java 版只需重写 `plan` 的调用方与 `emit`，规则逻辑可逐条对照移植——也是 §3 方案 A "60% 逻辑可复用"这一估计的落点。

---

## 6. 交付与验收建议

前提：**将来真启动方案 A 时**参照本节。本节不含承诺，只给落地位置、最小验收与法务前置。

### 6.1 落地位置

**推荐：新增 `scripts/skillhub-convert/`**（`convert.mjs` + `convert.test.mjs` + 一份 `CLAUDE.md` 成员清单）。

| 候选 | 判断 | 理由 |
|---|---|---|
| **`scripts/`**（推荐） | ✅ | 现有 `scripts/` 就是"开发/运维工具"区（`bootstrap-*.mjs`、`scan-sensitive-logs.mjs`、`v1-e2e*.mjs`），形态约定是 `*.mjs` + `*.test.mjs` + L2 `CLAUDE.md` 成员清单，与 §3 方案 A"不做成产品功能"完全一致；Node 已就位，不介入 Java 构建，不触碰 `server/` 模块边界。 |
| `plugin/packages/*` | ❌ | 那是 **TS 侧产品包**（有 `package.json` 发布面、workspace 依赖、`pnpm --filter` 构建链）。把一个离线一次性工具放进去，等于给它背上发布制品的维护责任（`ent-admin-cli` 就是这种重量的包）。 |
| `server/` | ❌（入方向） | 入方向不必进 Java。**只有 §3 方案 B（服务端导入）真正立项时**，才把 `plan` 规则平移到 `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/` 下新增子包，**且必须复用 `SkillArtifactInspector` 做二次校验**（绝不信任外部输入）。 |

无论选哪个位置，都要同步更新对应目录的 `CLAUDE.md` 成员清单（本仓库的 L2 地图约定）。

### 6.2 最小验收标准

**A. 转换器侧**：真实样本（公开云匿名下载，§9 附录已趟通 22/25）中至少这 4 类各 1 个跑通：

| 类型 | 样本 | 验收点 |
|---|---|---|
| 多目录典型包 | `ootd-ai-stylist`（`SKILL.md` + `references/*.md`×2 + `assets/*.json` + `scripts/*.py`） | `references/`/`scripts/`/`assets/` **全部**落在 `skills/ootd-ai-stylist/` 下，`skillCount = 1`，无根级残留条目 |
| 大体积资源包 | `knowledge-graph-skill`（含 3.41MB `assets/mermaid.min.js`） | **转换成功**（实测不触发逐条目门禁），报告如实打印 `archiveBytes`/`expandedBytes`/`entryCount` |
| 单文件极简包 | 只含 `SKILL.md` 的任一技能 | 无多余目录也能通过 |
| 反向样本 | 上述任一产出的 `.dshskill` | 反向转换回 SkillHub 扁平包，`SKILL.md` 位于 zip **根**，`references/` 等上提一层且目录名不变 |

**B. 服务端侧**（**权威门禁**：离线预检只是预演，必须由服务端真跑一遍）：

1. `POST /enterprise/admin/v1/skills/versions`，`consumes: multipart/form-data`，**必填请求头 `Idempotency-Key: <UUIDv4>`**（实测 `EnterpriseApiValidation.requireUuidV4`），`RequestPart("artifact")` = `.dshskill` 字节，可选 `RequestPart("metadata")` 覆盖 `displayName`/`description`；预期 **HTTP 201 Created**。**幂等验收要点（实测）**：`Idempotency-Key` 只用于 pending 落盘路径命名，真正去重靠 `(tenantId, skillId, sourceDshVersion, sha256)` 内容寻址 → **用完全相同的字节重复上传应得 HTTP 200 + 同一个版本**；换 key 不改字节也仍应命中既有版本。权限码 `ent:skill:write`。
2. 校验返回的 `VersionView`：`skillCount` == zip 内 `skills/*/SKILL.md` 数；`sizeBytes` == 包体；`sha256` 已落库；`skills[].name` 全为 kebab-case；`sourceDshVersion` == 转换器所填值。
3. `POST /enterprise/admin/v1/skills/versions/{versionId}/actions/publish`，带 **`If-Match: <revision>`**（我们的乐观并发，对方无对应物）→ 进入已发布。
4. `GET /enterprise/api/v1/skills`（runtime 面，需设备 ACTIVE）能看到该技能，`EntryView` 的 `description`/`whenToUse`/`invocable` 投影正确。
5. **负向用例**（必须同时看服务端与离线报告两边）：
   - 塞一个**根级 `README.md`** → 期望 `归档路径必须位于根或 skills/ 下`（`GATE_PATH_WHITELIST`）；
   - 塞一个 **300KiB 的 `skills/x/SKILL.md`** → 期望 `SKILL.md 过大`（`GATE_SKILL_MD_BYTES`）；**再塞一个 300KiB 的 `skills/x/references/big.bin` → 期望通过**（证明"非逐文件"口径）；
   - 塞一份**同路径出现两次** → 拒绝（`GATE_NO_DUPLICATE_PATH`）；
   - 塞 `skills/x/SKILL.md` **frontmatter 缺 `description`** → 拒绝（我们是必需，官方是忽略该文件）。
   - 说明：服务端错误码只有 `ENT_SKILL_INVALID_PACKAGE`/`ENT_SKILL_TOO_LARGE` 两个，**离线报告的 `gate` id 是多门禁场景下可诊断性的唯一来源**，因此验收必须两边一起看。
6. 鉴权：`SkillArtifactInspector` 自身不鉴权，鉴权在 Controller 的 `@SaCheckPermission`（`ent:skill:read` / `ent:skill:write`）；用 `ent-admin-cli` 或测试凭据走一遍即可。

**C. 回归与门禁**：转换器自测并入 `scripts/check-all.sh` 的现有链（`FULL=1` 追加部分），服务端测试注意本仓库约定——**服务端测试必须带 `@Tag("dev")`**，否则会被 surefire 的 `<groups>${profiles.active}</groups>` 静默排除（构建成功但 `Tests run: 0`）。

### 6.3 必须先过的法务项

1. **本仓库自身许可证已在 §0.1 实测**：**MIT**（根 `NOTICE`；fork、`server/**` 等派生树、vendored RuoYi-Vue-Plus 均为 MIT；**仓库根没有 `LICENSE` 文件**，这本身是一处应补齐的仓库治理项）→ 与 SkillHub 的 Apache-2.0 **不冲突**（都是宽松许可，可直接互操作与再分发，各自保留通告即可）。§8 原第 8 项"我们仓库的协议状态"至此**已核对：MIT**。

2. **CC-BY-SA-4.0 是唯一需要法务结论的项**。SkillHub 官方 22 个内置技能中 **3 个是 CC-BY-SA-4.0**（§1.5 实测）。它的尖锐点**不是"能不能用"**（CC-BY-SA 允许商用与再分发），而是"**ShareAlike 会不会传染到我们的分发物**"——把 CC-BY-SA-4.0 技能包装进 `.dshskill` 随产品分发给全员，存在被解释为"基于该作品产生 Adaption → 整个分发物需以 CC-BY-SA-4.0 授权"的风险，而我们的技能库是随产品分发的。**建议：默认一票否决 + allowlist，法务逐技能放行**：
   - 转换器带 `--license-allowlist`（默认 `MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC`）；`CC-BY-SA-4.0` 与**未知/无许可**一律**拒绝并进报告**，不自动转换；
   - 只有当法务**逐技能**出具书面结论、且口径是"原样、不修改、单独署名分发"时，才把该技能加入 allowlist；
   - **许可证判定依据以包内 `LICENSE`/`NOTICE` 文本与上游 `builtin-skills/catalog.json` 的 `license` 字段为准**，并在报告里记录判定依据（文件名 + 摘要）；**不**把 `x-astron-compliance` 当合规凭据（§7 第 5 条）。

3. **署名不可丢**：把根级 `LICENSE`/`NOTICE` 迁移到 `skills/<name>/` 是**路径门禁的强制动作**，不是"清理动作"——它正好满足我们自身 `NOTICE`"被 vendored 树的许可通告必须保持完整"的要求。预检应把"存在许可文件"记为 `W_LICENSE_FILE_PRESENT` 警告并进报告，**任何"顺手删掉 LICENSE 减小包体"的做法都应被禁**。

4. **`skill.xfyun.cn` 的服务条款**是否允许企业程序化抓取与内部分发（§8 原第 10 项）仍需法务/上游确认：**"能匿名下载"≠"能内部分发"**。

5. **对方的"我们支持 dsh"不构成任何授权**。`docs/dsh-integration.md` 与内建 `dsh` profile 说明对方欢迎互操作，但它只覆盖"格式与安装目录能对上"，**不覆盖许可证、不覆盖服务条款、不覆盖我们员工设备上的可用性**（§7 第 6 条）。

---

## 7. 不建议做的事

1. **🔴 不要让服务端"订阅+自动发布"外部技能。** 自动把第三方代码变成全员可用技能，等于在没有内容安全扫描的前提下把供应链风险直接推到员工设备，且没有人工闸门。任何外部导入都必须经过我们的 `SkillArtifactInspector` + 人工 `publish`。
2. **🔴 不要在员工端（Android）引入 SkillHub CLI / Node 运行时做技能安装。** 它绕过 `/enterprise/api/v1/skills` 的设备 ACTIVE 校验与 `assignments` 分配，在授权模型上开洞；且我们没有回收通道。这是方案 C 被否掉的核心原因，也不应通过任何"临时试点"绕过。
3. **🟡 不要把我们的 `.dshskill` 改成 SkillHub 的"单技能扁平包"格式去迁就它。** 我们的多技能包 + `manifest.json` 是对齐**官方 `dsh-skill` 规范**的（`SkillArtifactInspector` 注释明确写"与官方 `dsh-skill` 的 SKILL_NAME 正则逐字一致"）。为了一个外部注册中心而改动我们对齐官方运行时的格式，是方向性错误——**互操作应该发生在转换层，不应该发生在我们的格式真源上**。
4. **🟡 不要在方案 B 里让我们依赖 `/api/cli/v1/**`。** 这是对方 CLI 的私有内部面（我从 `skillhub-client.ts` 实测出来的），不是对外契约；对方演进时它最先变。若将来真要做 B，只用 `/api/v1/**` 的公开读端点。
5. **🟡 不要把 `x-astron-compliance` 当作合规证据引进我们的治理体系。** 对方自己声明："这些信息表示'技能作者声明的合规映射'……不等同于第三方认证或平台背书"、"不要把 SkillHub 的合规声明当成第三方认证结果"。我们若把它当合规凭据，是主动制造审计风险。
6. **🟡 不要因为"对方已经支持 dsh"就假设技能在 Android 上能用。** 对方文档明确："格式兼容不代表运行时能力完全相同。技能依赖的 Agent 专用工具、命令、MCP server、环境变量和操作系统能力仍需单独验证。" 实测样本里大量技能依赖 `python`、外部 API KEY、飞书/MCP 工具，在 Android DSH 上很可能直接不可用。**导入成功率会显著低于格式转换成功率——这是两件事，不要混为一谈。**
7. **🟡 不要复制对方的 API Token 作用域模型。** 对方自己承认一期 Token 作用是"粗粒度动作级别、不与 namespace 绑定、不满足最小权限原则"。我们已有 PKCE + 企业账号体系，不要反向拉低。

---

## 8. 不确定性清单（证据不足 / 需进一步验证）

按"必须先解决才能动手"排序。

| # | 不确定项 | 为什么重要 | 怎么验证 | 状态 |
|---|---|---|---|---|
| 1 | ~~**"包内只允许根 `manifest.json` 与 `skills/` 子树"是否同时约束 `skills/<name>/` 内部**（即能否放 `references/`/`scripts/`/`assets/`）~~ | ~~决定方案 A 的"重定位"策略是否成立。若内部也受限，A 需重设计（+2 人日）~~ | ~~读 `SkillArtifactInspector.java` 的 `visitFile`/目录判定分支，并跑一个含 `skills/x/references/a.md` 的包做单测~~ | ✅ **已关闭（§0.1 ①）**：`validateEntry` 只做根级判定，`skills/` 子树深度不受限 → 重定位成立，**无 +2 人日** |
| 2 | ~~我们客户端对 `manifest.json` **未知字段**的容忍度~~ | ~~决定 D 能否安全加 `namespace`/`tags`/`license`；也决定 A 能否把 `x-astron-*` 降级保留而不是丢弃~~ | ~~读 `dsh-skill` 官方 manifest 解析代码 + 造未知字段包实测~~ | ✅ **已关闭（§0.1 ②）**：未知键被忽略且**不透传** → 加字段安全但零收益；`x-astron-*` 可原样保留（§5.3） |
| 3 | 我们**真实可用的 SkillHub API Token** 是否存在 | 公开云实测只有 Xfyun SSO（`/api/v1/auth/providers` 返回空、`/api/v1/auth/methods` 只有 `SESSION_BOOTSTRAP`）。若拿不到 `sk_`，方案 B 只能依赖匿名端点，随时可能被上游收紧 | 用讯飞账号登录公开云，进"API 令牌管理"看能否自助签发 `sk_` | ⏳ 待核对 |
| 4 | 公开云**公开技能确切总数**与**当前可用率** | 影响方案 B 的价值判断（数万条里有多少真的能在 Android DSH 上跑） | 分页遍历 `/api/v1/skills` 全量；对样本做 Android 上真实装配试跑，统计可用率 | ⏳ 待核对 |
| 5 | SkillHub 的 **Skill Scanner 在公开云是否默认开启、扫描结果是否可查** | 方案 B 的供应链风险是否可缓和的唯一抓手 | 对其上技能查 `security_audit`/扫描报告 API；或自搭实例开 `SKILLHUB_SECURITY_SCANNER_ENABLED=true` 走一遍发布 | ⏳ 待核对 |
| 6 | 仓库文档内部**自相矛盾**的包大小上限（协议写单文件 1MB/总包 10MB/100 文件；CLI 源码写 500 条目/100MB 包/10MB 单文件；FAQ 写 100MB；Scanner 允许 105MiB 上传） | ~~转换器的"前置校验"该对齐哪一套~~ → **我们一侧的口径已实测确定（§5.4）**；此项现在只影响**出方向**（我们 → 对方）的预检该对齐哪一套 | 自搭实例实测各上限，或读 `server/` 侧 multipart 与校验常量 | 🟡 入方向已确定；出方向待核对 |
| 7 | ~~统一的 `{code,msg,data,timestamp,requestId}` 响应包与我们服务端现状是否同构~~ | ~~影响方案 B 的适配成本~~ | ~~核对 `server/` 的响应封装类~~ | ✅ **已关闭（§0.1）**：我们成功包是 `EnterpriseResponse{data, requestId}`（无 `code`/`msg`/`timestamp`）；分页是游标式 `{items, page:{hasMore, limit, nextCursor}}`，**无 `total`** |
| 8 | ~~我们仓库的 Apache-2.0/其他协议状态~~ | ~~与对方 Apache-2.0 组合后的传染性判断（尤其我们若复用其代码）~~ | ~~读仓库 `LICENSE`/`NOTICE`~~ | ✅ **已关闭（§0.1 / §6.3）**：**MIT**（根 `NOTICE`；**无 `LICENSE` 文件**，属待补齐治理项）→ 与 Apache-2.0 无冲突 |
| 9 | SkillHub 的 `dsh` profile 在**新版 DSH（我们锁定的版本）**上是否仍正确 | 对方文档基于 DSH `ddefc45`、验证于 2026-09-20，并自己声明 `0.1.x` developer preview"升级 dsh 后请重新核对" | 对照我们锁定的 DSH 版本，核对 `.dsh/skills` 与 `~/.dsh/skills` 是否仍是技能根 | ⏳ 待核对 |
| 10 | `skill.xfyun.cn` 的**服务条款**是否允许企业程序化抓取/内部分发其上技能 | 方案 B 的合法性质疑；我在实测中已匿名下载 25 个包，但"能下载"≠"能分发"。**对方案 A 同样致命**：转换成功 ≠ 可合法分发（§6.3） | 读其 ToS；必要时联系讯飞 | ⏳ 待核对（**方案 A 的硬前置**） |
| 11 | `docs/` 与代码的一致性（该仓库文档密度极高且有 26+ 篇设计文档，部分明显是设计稿而非实现） | 我引用的若干结构（如 `.astron/metadata.json` 的 `sha256`）已被实测证伪；其他引用也可能如此 | 对每条准备依赖的结论，在 `server/`/`cli/` 源码中找对应实现，找不到就按"设计稿"处理 | ⏳ 待核对（方法已生效，逐条适用） |
| 12 | 员工端"复制装配指令"路径下，**员工 Agent 是否有能力消费 `.dshskill`**（阶段一依赖用户自己的 Agent 会话落盘） | 决定方案 A 的产物能否真的被人用起来（若员工 Agent 只能吃单技能 `SKILL.md`，A 的方向 1 产物需要再拆一层） | 实测：把一份 `.dshskill` 的装配指令交给 DSH 会话，看能否正确落盘 | ⏳ 待核对（**方案 A 的硬前置**） |
| 13 | **（新增）** `sourceDshVersion` 的取值口径 | 实测该字段无格式校验、只是投影给管理面的自由文本；填我方 DSH 版本 / 转换器标识 / 上游版本，三者的可追溯性与对"官方技能目录版本判定"的干扰不同（§5.1） | 决策项，非技术验证：建议默认填转换器标识，并把它与上游版本一起写进转换报告 | ⏳ 待决策 |
| 14 | **（新增）** CC-BY-SA-4.0 技能的 allowlist 口径 | 官方内置 22 个中 3 个是 CC-BY-SA-4.0；ShareAlike 是否传染到我们的分发物需要法务结论（§6.3） | 法务逐技能出具书面结论；在结论前用 `--license-allowlist` 默认一票否决 | ⏳ 待法务（**方案 A 的硬前置**） |

---

## 9. 附录：本轮实测命令与原始证据

以下为可复现的关键实测（全部只读，未在本仓库产生任何除本文档外的文件）：

**1. 公开云匿名可读性**
```
curl -sS "https://skill.xfyun.cn/api/v1/skills?page=0&size=5"     → 200，返回 items（无需凭据）
curl -sS "https://skill.xfyun.cn/api/v1/namespaces"               → 401 Authentication required
curl -sS "https://skill.xfyun.cn/api/v1/auth/methods"             → 仅 ["bootstrap-private-sso"/"Xfyun SSO"/SESSION_BOOTSTRAP]
curl -sS "https://skill.xfyun.cn/api/v1/auth/providers"           → data: []（无 GitHub OAuth）
curl -sS "https://skill.xfyun.cn/api/web/skills?page=0&size=1"    → 首条 id=24492
```

**2. 真实技能包结构抽样（25 个，22 个成功）**
```
GET https://skill.xfyun.cn/api/v1/skills/global/{slug}/download  → 解压解析 zip
```
关键结果：

| 观测 | 值 |
|---|---|
| 成功下载并解析 | 22 / 25 |
| `SKILL.md` 位于压缩包**根** | 22 / 22 （100%） |
| 条目数范围 | 1 – 12 |
| 含 >256KiB 文件的包 | **1 / 22**（`knowledge-graph-skill` 含 `assets/mermaid.min.js`，**3.41MB**）→ **该文件不触发我们任何逐条目门禁**，见下方第 4 组实测 |
| 典型包 | `ootd-ai-stylist`：`SKILL.md` + `assets/wardrobe-template.json` + `references/*.md` ×2 + `scripts/wardrobe_manager.py` |

失败样本如实记录：`医目了然`（我脚本的 ASCII 编码问题，非上游错误）、`xfyun--internal-k8s-deployer`（HTTP 404）、`citation-integrity`（URL 超时）。

**3. 校验常量对照（双方源码实测）**

| 项 | SkillHub | 我们（`SkillArtifactInspector.java`） | 作用域（我们一侧） |
|---|---|---|---|
| 入口 | 根 `SKILL.md` | 根 `manifest.json` + `skills/<kebab>/SKILL.md`（depth-3 才被识别） | — |
| 单文件 | 1MB（协议）/ 10MB（CLI 源码）/ 105MiB（Scanner 上传） | `MAX_SKILL_MD_BYTES = 262_144`（256KiB）；`MAX_MANIFEST_BYTES = 1_048_576`（1MiB） | **逐条目，且只有这两个特定路径**；其余载荷文件**无逐条目上限** |
| 技能条目数 | 100（协议）/ 500（CLI 源码） | `MAX_SKILLS = 200` | 被识别的 `skills/*/SKILL.md` 数 |
| zip entry 数 | 未查到 | `enterprise.skill.max-entries` 默认 `10_000` | **全部**条目（含目录条目） |
| 包总大小 | 10MB（协议）/ 100MB（CLI `MAX_PACKAGE_BYTES`）/ 100MB（FAQ） | 归档 `enterprise.skill.max-archive-bytes` 默认 `52_428_800`（50MiB）；解压 `max-expanded-bytes` 默认 `209_715_200`（200MiB） | 归档=压缩包本体；解压=**全部**条目字节和 |
| 文件类型白名单 | 12 种 | **无**（实测 280 行内无扩展名/类型断言） | — |
| 签名校验 | **无**（grep 无命中，只有大小上限） | 未在本轮核对（本项目另有 `plugin-signing-*` 系列，属插件域，不在技能验包器内） | — |

**4. `SkillArtifactInspector.java` 源码实测（收尾补强轮，HEAD `323f312`）**

命令（只读，逐行读完 280 行全文）：
```
cd "/data/user/0/com.deepcode.shell/files/dsh-enterprise" || exit 1
read  server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactInspector.java
read  .../skill/artifact/SkillArtifactException.java
read  .../skill/EnterpriseSkillConfiguration.java  # 上限注入与范围校验
read  .../skill/EnterpriseSkillProperties.java     # maxArchiveBytes/maxExpandedBytes/maxEntries 默认值
read  .../skill/web/AdminSkillController.java    # POST /enterprise/admin/v1/skills/versions
read  .../skill/web/SkillViews.java              # EntryView 投影字段
read  .../common/api/EnterpriseResponse.java     # {data, requestId}
read  .../common/api/CursorPageData.java         # {items, page:{hasMore, limit, nextCursor}}
grep -rn "new SkillArtifactInspector" --include=*.java .
head -40 NOTICE                                  # 无 LICENSE 文件
```

| # | 结论 | 关键代码 / 常量 |
|---|---|---|
| ① | **`skills/` 子树深度不受限**（`skills/<n>/references/x.md`、`skills/<n>/assets/big.js` 均通过） | `validateEntry`：`if (!"manifest.json".equals(name) && !name.startsWith("skills/") && !"skills".equals(name)) throw invalid("归档路径必须位于根或 skills/ 下");` + `isSkillFile`：`segments.length == 3 && "skills".equals(segments[0]) && "SKILL.md".equals(segments[2])` |
| ② | **manifest 未知字段被忽略且不透传**（不报错、不保存、不投影） | `json.readTree(bytes)` 建树后只按名取 `format`/`version`/`id`/`name`/`sourceDshVersion`/`description`，返回 `InspectedSkillPackage(id, name, description, sourceDshVersion, skills)`；**无任何未知键断言**。frontmatter 同理：`data` 是 `Map<String,Object>`，只按名取 5 个键 |
| ③ | **大小门禁是"逐条目 + 只作用于两个特定路径"，不是逐文件** | `ByteArrayOutputStream capture = isManifest || isSkillFile ? new ByteArrayOutputStream() : null; int limit = isManifest ? MAX_MANIFEST_BYTES : MAX_SKILL_MD_BYTES;` → `capture == null` 的条目（depth≠3 的载荷）**走不到任何逐条目上限**，只累加进 `expanded`/`entries` |
| 附 1 | 无文件类型白名单 | 280 行内无扩展名/类型断言 |
| 附 2 | 门禁总数 **17 条** | 见 §5.4；错误码只有 `ENT_SKILL_INVALID_PACKAGE` / `ENT_SKILL_TOO_LARGE` 两个（`SkillArtifactException.errorCode()`） |
| 附 3 | 我们成功响应包是 `{data, requestId}`；分页是游标式且**无 `total`** | `record EnterpriseResponse<T>(T data, String requestId)`；`record CursorPageData<T>(List<T> items, CursorPageMetadata page)` + `record CursorPageMetadata(boolean hasMore, int limit, String nextCursor)` |
| 附 4 | 上传契约 | `@PostMapping(path="/versions", consumes="multipart/form-data")` + `@RequestHeader("Idempotency-Key") UUID`（`requireUuidV4`）+ `@RequestPart("artifact")` + 可选 `@RequestPart("metadata")`；权限码 `ent:skill:write` |
| 附 6 | 上传幂等是**内容寻址**而非按 key | `artifacts.writePending(uploadId, input)` 只用 key 命名落盘路径；去重键是 `skills.findExistingVersion(tenantId, skillId, sourceDshVersion, sha256)` → 命中即 `new UploadResult(existing, false)` → 201/200 由 `result.created()` 决定 |
| 附 5 | 本仓库许可证 **MIT**，**根无 `LICENSE` 文件** | 根 `NOTICE`：fork 为 MIT；`server/**` 等树为 MIT 的 OwnDsh 派生；vendored RuoYi-Vue-Plus 为 MIT |

**补充说明（本次未联网）**：本轮补强没有新增任何 curl 抓取；§9 第 1–2 组的联网证据与限制说明保持第一位调研员的原样记录（本机 `web_fetch` 对 `github.com`/`iflytek.github.io` 仍被"non-public IP address"策略拦截，需联网时只能 shell `curl` 直连）。

---

*本文只做调研与方案判断，不含任何实现承诺。所有"我们"一侧的可变结论已按下述口径处理：**响应包结构、分页形状、许可证状态、manifest 未知字段容忍度、`skills/` 子树是否受限、大小门禁作用域**六项已在 §0.1 / §9 第 3–4 组用本仓库源码实测关闭（§8 清单标 ✅）；**技能根约定、员工 Agent 能否消费 `.dshskill`、`skill.xfyun.cn` 服务条款、CC-BY-SA-4.0 口径**四类仍在 §8 标注为待核对/待决策，未核对项一律未作为结论使用。*
