<!--
[INPUT]: 依赖中心既有技能链路实测（AdminSkillController/SkillCatalogService/SkillArtifactInspector/
         SkillArtifactStore/SkillViews 与 V35、V4 迁移）、中心控制台技能管理页与 product-routes、
         docs/plan/enterprise-marketplace-phase2.md（二期排期与 S1/S4/S5 服务端补强口径）、
         docs/plan/borrow-from-skillhub.md（P0 借鉴项：PENDING_REVIEW）、
         docs/research/iflytek-skillhub-integration.md（方案 A/B 规格、17 条门禁、法务与不确定项）、
         docs/compose/spec/skill-catalog.md（官方无技能安装 RPC 的能力核对结论），
         以及任务书转述的服务器侧 skillhub.cn 导入原型实测结论（本机不可达，见 §K）。
[OUTPUT]: 给出「企业中心多渠道技能导入」的目标与边界、共享渠道适配器抽象与放置位置判断、
         端到端导入流程（含重复导入策略）、中心独有治理口径（权限/审核/许可/provenance/内容安全缺口）、
         服务端改动清单（表/迁移/契约/错误码/审计）、控制台 UI、安全清单、三期人日与开放问题。
[POS]: docs/plan 下的中心侧方案规划；只写方案不写代码，客户端侧方案由 docs/plan/skill-install-sources.md 负责。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md（docs/CLAUDE.md 成员清单需由落地者补一行）。
-->

# 企业中心 · 多渠道技能导入（Skill Ingest Center）方案规划

> **本文只做方案规划，不含任何代码、迁移与契约改动。**
> **范围**：企业中心（服务端 + 控制台）如何从不同渠道把技能**导入企业目录**，再走中心既有的受控分发链路。
> **不在本文范围**：客户端（员工个人设备）的用户自发安装与「粘贴地址安装」交互 —— 那份方案由
> `docs/plan/skill-install-sources.md` 负责，本文只对两端共享的**渠道适配器**提要求与形状建议，不重复设计。

---

## 0. 一句话结论

中心的技能导入**不需要新造一条安装链路**：既有 `POST /enterprise/admin/v1/skills/versions`（上传已打包的
`.dshskill`）就是唯一的入口闸门。多渠道导入要做的是**在它前面加一层"来源 → .dshskill"的转换与来源取证**，
在它这一层加**许可与 provenance 的强制闸门**，在它后面复用既有的 `publish → assignments → 员工端可见` 链路。
**推荐把"取包/转换/预检"放在离线（管理员本机）工具里，服务端只做权威校验与治理**；服务端直拉列为 P2 可选档位。

---

## 1. 事实基线（先读这一节，含对任务书前提的纠偏）

### 1.1 中心现有的技能链路（实测）

| 环节 | 事实 | 出处 |
|---|---|---|
| HTTP 入口 | `@RequestMapping("/enterprise/admin/v1/skills")`，5 个端点：列表 / 上传 / 发布 / 退休 / 批量分配 | `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/web/AdminSkillController.java:39`（`:57`列表、`:82`上传、`:105`发布、`:116`退休、`:127`分配） |
| 上传形态 | `multipart/form-data`，必填头 `Idempotency-Key: UUIDv4`，`@RequestPart("artifact")` + 可选 `metadata`（仅 `displayName`/`description` 覆盖） | `AdminSkillController.java:82-103`；覆盖字段见 `skill/web/SkillUploadMetadata.java` 与 `skill/application/SkillDisplayOverride.java` |
| 上传语义 | `writePending`（有界写 + 边写边算 SHA-256）→ `inspector.inspect` → **先查既有版本** → 物化 CAS + 建库 | `skill/application/SkillCatalogService.java:88-164`（去重判断在 `:110-113`） |
| 去重键 | **内容寻址** `(tenantId, skillId, sourceDshVersion, sha256)`，命中即返回既有版本且 `created=false` → HTTP 200 | `SkillCatalogService.java:110-113`；SQL 见 `skill/persistence/JdbcSkillStore.java:122-133` |
| 唯一键 | `uq_ent_skill_version_source (package_id, source_dsh_version)`、`uq_ent_skill_version_hash (tenant_id, sha256)` | `server/.../db/migration/V35__enterprise_skill_catalog.sql:45-46` |
| 幂等/并发 | `Idempotency-Key` 只用于 pending 落盘文件命名，**不是去重键**；真去重是内容寻址；发布/退休用 `If-Match: revision` | `SkillArtifactStore.java:51-87`（`temporaryRoot.resolve(uploadId + ".part")`）；`AdminSkillController.java:109`、`:120`、`:131` |
| 验包闸门 | 单遍 ZIP 校验，不解压到文件系统、不保留正文；只认根 `manifest.json` + `skills/<name>/SKILL.md` | `skill/artifact/SkillArtifactInspector.java:66-114`（路径白名单 `:121-136`、manifest `:138-165`、frontmatter `:168-202`） |
| 上限常量 | 归档 ≤ 50 MiB、解压 ≤ 200 MiB、entry ≤ 10000；`manifest.json` ≤ 1 MiB、`SKILL.md` ≤ 256 KiB、技能条目 ≤ 200 | `skill/EnterpriseSkillProperties.java:16-18`；`SkillArtifactInspector.java:41-43` |
| 错误码 | 仅两个：`ENT_SKILL_INVALID_PACKAGE`（400）/ `ENT_SKILL_TOO_LARGE`（413） | `skill/artifact/SkillArtifactException.java`（`errorCode()`）；映射见 `common/api/EnterpriseExceptionHandler.java:344-356` |
| 状态机 | `VALIDATED → PUBLISHED → RETIRED`，**没有 DRAFT、没有 PENDING_REVIEW、没有 SCANNING** | `skill/domain/SkillVersion.java`（`enum Status`）；DDL 约束 `V35…sql:42`；契约枚举 `contracts/components/skill.yaml:15-17` |
| 包/版本/分配三表 | `ent_skill_package`（V35 无策展/来源字段；V36/V37 后加了 `builtin`/`featured`/`category`，但**代码尚未消费**）、`ent_skill_version`（无来源字段）、`ent_skill_assignment` | `V35…sql:6-19`、`:21-48`、`:53-79`；`V36__enterprise_skill_marks.sql`、`V37__enterprise_skill_category.sql` |
| 权限码 | `ent:skill:read` / `ent:skill:write`，**当前同时授予企业管理员与插件管理员** | `V35…sql:86-102`（menu 1026/1027 → role 1900300000000000001 与 …003）；角色身份见 `V4__enterprise_audit.sql:70,72` |
| 审计 | `ent_audit_event` 只追加（触发器禁 UPDATE），`metadata_json jsonb`；action 是 **DDL 白名单约束** | `V4__enterprise_audit.sql:7-28`、`:51-61`（append-only 触发器）；技能类 action 见 `V35…sql:104-122` |
| 投影 | 出站视图永不含 artifact 路径与 SKILL.md 正文 | `skill/web/SkillViews.java:23-43`、`:80-105` |

### 1.2 中心控制台（实测）

- 技能管理页：`console/src/features/skills/skill-management-page.tsx`。列表由 `listSkillPackages` 游标分页驱动（`:70-73`），
  工具栏只有一个动作 —— 「上传技能包」（`:321-326` 的 `toolbarAction`）；上传序列化器 `serializeSkillUpload`（`:61-68`）；
  状态筛选只有 VALIDATED/PUBLISHED/RETIRED 三档（`:305-313`）。
- 对话框与预览件已存在且可复用：`UploadSkillVersionDialog`（`console/src/features/skills/skill-editors.tsx:182`）、
  `SkillManifestPreview`（`:158`）、`SkillEntriesPreview`（`:137`）、`SkillSafetyNotice`（`:125`）。
- 菜单真源：`console/src/app/product-routes.ts:18-28`（`/skills` 对 `enterprise_admin` + `plugin_admin` 可见）；
  分组见 `:45-50`（「技能与插件」组 = `/plugins` `/presets` `/skills`）。
- API 层是**契约生成物**：`console/src/api/generated/{sdk.gen.ts,types.gen.ts}`；新增端点必须先进
  `contracts/enterprise-openapi.yaml` 再重新生成，不能在控制台手写第二套请求。

### 1.3 任务书前提的核对（含并行提交带来的时效说明）

> **时效说明**：本文初稿核对时仓库内**只到 `V35`**；随后并行提交
> `b301fbb fix(server): 把线上已应用的 V36/V37 迁移补回仓库` 在仓库里补上了这两个迁移。
> 下表是**核对后的现状**，并标出哪些前提需要修正。

1. ✅ **`V36__enterprise_skill_marks.sql` 与 `V37__enterprise_skill_category.sql` 现已存在**
   （此前"线上已应用、仓库缺失"，由 `b301fbb` 补回；文件名与任务书一致）。
   但它们的**真实内容与任务书的描述不完全一致**：
   - `V36__enterprise_skill_marks.sql`：给 `ent_skill_package` 加
     `builtin boolean not null default false` 与 `featured boolean not null default false`（既有行回填 false）；
     并把 **`SKILL_MARKS_CHANGED`** 加进 `ent_audit_event.ck_ent_audit_event_action` 白名单。
   - `V37__enterprise_skill_category.sql`：给 `ent_skill_package` 加 **`category varchar(32)`（可空，NULL = 没有分类）**
     \+ 约束 `ck_ent_skill_package_category (category is null or btrim(category) <> '')`。
   - **没有落地**：`shop_visible`、`featured_weight`、`tags` —— 这三个是
     `docs/plan/enterprise-marketplace-phase2.md:304`（S1）计划里的字段，**不在**真实的 `V36/V37` 中。
2. ⚠️ **DDL 已就位，但 Java 与契约还没消费它们**：全仓 grep `builtin` / `featured` / `category` / `SKILL_MARKS`
   在 `server/.../skill/**` 与 `contracts/**` **零命中**。即现在**没有**标记读写端点
   （`AdminSkillController` 仍只有 5 个端点）、`audit/AuditAction.java` 枚举里**没有** `SKILL_MARKS_CHANGED`
   （**DDL 白名单与 Java 枚举已不同步**）、`SkillViews` 也不投影这三列。
   → **列存在 ≠ 标记能力可用**；导入要读/写它们必须一并补写入路径与投影（见 §D.6、§E）。
3. **`ent_skill_package` / `ent_skill_version` 上没有任何"来源"字段**（无 `source_url`/`provenance`/`source_registry`，
   全仓迁移 grep 零命中）。provenance 是**净新增**，不是加个已有列。
4. 任务书说撞的是 `(tenantId, skillId, sourceDshVersion)` 唯一键；**实际 DDL 是 `(package_id, source_dsh_version)`**
   （`V35…sql:45`），`package_id` 与 `skill_id` 在 `uq_ent_skill_package_skill (tenant_id, skill_id)`（`:18`）下同一租户内等价。
   讨论重复导入时按**实际 DDL** 口径走，见 §C.5。

### 1.4 两个"外部站"必须分清（不许混用端点）

| 站点 | 谁在研究 | 依据 |
|---|---|---|
| `skill.xfyun.cn`（讯飞 SkillHub） | 仓库内已有调研 | `docs/research/iflytek-skillhub-integration.md`（987 行，含 37 项对照表、方案 A/B/C/D、17 条门禁） |
| `skillhub.cn`（腾讯云系 AI Skills 社区） | 上一轮**服务器侧原型**，本仓库无副本 | 任务书转述：脚本 `/opt/work/skillhub-import/{common_auth.py,fetch_top_n.py,license_scan.py}` 与证据 `EVIDENCE.md`、`raw/`、`converted/` |

两者的列表/详情/下载端点、许可字段有无、包结构**都不一样**；本文引用 `skillhub.cn` 的结论时一律标注为
"服务器原型结论（本机不可达，见 §K-1）"，**不与 `skill.xfyun.cn` 的端点混用**。

---

## A. 目标与边界

### A.1 目标

企业中心要支持**多渠道**把一个技能**导入企业目录**，并复用既有受控链路把它分发给员工：

```text
渠道（本地上传 / 粘贴地址 / 三方商城 / 代码托管 / npm 等）
  └─► 取包 → 解包 → 转换 → 预检  ⇒ 产出标准 .dshskill + 导入报告（ImportReport）
        └─► 中心权威校验（SkillArtifactInspector）+ 许可闸门 + provenance 落库
              └─► 建成一个技能版本（草稿态）
                    └─► 人工 publish → assignments → 员工端 /enterprise/api/v1/skills 可见
```

关键定位：**中心是"导入 + 治理 + 分发"的控制点，不是运行时，也不执行包内任何内容。**

### A.2 不做什么（明确边界）

1. **不做自动定时拉取 / 订阅式自动发布**。上游新版本只能产出"待导入"提示，绝不能自动建版本或自动发布。
   依据：`docs/research/iflytek-skillhub-integration.md:880`（"不要让服务端订阅+自动发布外部技能"）、
   `docs/plan/borrow-from-skillhub.md:60-62`（"不要做订阅 + 自动发布"）。
2. **不做静默导入**。每一笔导入都必须有操作人、来源、许可判定与审计，并且默认落在**草稿**而非直接可见（见 §D）。
3. **不执行包内任何内容**。`scripts/`、`assets/`、`references/` 一律只作为字节与路径处理；
   这条与客户端安装侧同口径 —— "安装＝落盘，绝不执行包内任何内容"（`docs/compose/spec/skill-catalog.md:118`）。
4. **不做内容安全扫描（诚实写明这是缺口）**。当前中心只有**结构/大小/路径/条目**校验，没有任何静态或动态
   内容安全扫描能力（`docs/research/iflytek-skillhub-integration.md:345` 第 22 项："**无内容安全扫描**；只有包结构/大小/条目校验"）。
   → 因此本方案**不得**承诺"导入即安全"；默认档位见 §D.5。
5. **不做跨租户共享 / 公开互联网广场**。导入产物只落在本租户（所有表的 `tenant_id` 口径不变）。
6. **不在服务端改技能格式真源**。`.dshskill`（`manifest.json` + `skills/<name>/SKILL.md`）对齐官方 `dsh-skill`，
   外部格式差异一律在**转换层**消化，不动我们的格式（`docs/research/iflytek-skillhub-integration.md:882`）。
7. **中心是服务端，与官方客户端插件安装能力无关**（见 §A.3）。

### A.3 中心能否复用官方"插件安装"能力？—— 不能，必须写清边界

官方 `ctx.pluginManager.installBundle` / `removeBundle` 是**插件（npm 包 / tgz）**安装，**不是技能安装**；
技能侧官方**唯一**的能力面是 `dsh-skill-filesystem` 的"发现契约"。

> 出处：`docs/compose/spec/skill-catalog.md:120` ——
> "官方没有技能安装 RPC —— `@deepseek-ai/dsh-plugin-manager` 只提供 `installBundle`/`removeBundle`
> （pnpm 装 npm 包，不是技能），技能的唯一官方能力面是 `dsh-skill-filesystem` 的「发现契约」。"
> 旁证：`plugin/packages/ui/src/marketplace-entry.tsx:36` 把企业插件行标注为 `remote.pluginManager`。

由此三条边界：

| 命题 | 结论 |
|---|---|
| 中心服务端能调 `installBundle` 来"装技能"吗？ | **不能，也不该**。那是客户端 Host 侧插件能力，且语义是 npm 包安装。 |
| 中心能用官方能力校验技能包吗？ | **不能**。官方只保证"发现形状"；权威验包是中心自己的 `SkillArtifactInspector`（`SkillArtifactInspector.java:66-114`）。 |
| 官方能力与中心是什么关系？ | **无关的两层**：官方定义客户端的技能发现契约，中心定义企业目录的准入、许可与分发。中心的导入只保证"产出一个官方形状能发现的 `.dshskill`"，不保证"能在 Android 上跑起来"（`docs/research/iflytek-skillhub-integration.md:885`）。 |

---

## B. 与客户端方案的关系（架构关键）

### B.1 共享渠道适配器：一个来源 = 一个适配器

```text
        ┌──────────────────── 渠道适配器（每个来源一个） ────────────────────┐
来源描述 →│ resolve(定位精确版本) → fetch(取字节) → unpack → convert → preflight │→ .dshskill + ImportReport
        └──────────────────────────────────────────────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
        消费方 1：客户端（员工个人设备）          消费方 2：企业中心（管理员导入）
        用户自发安装 / 粘贴地址                   管理员从渠道导入企业目录
        交付路径：本地落盘 ~/.dsh/skills          交付路径：POST /versions → publish → assignments
        （细节见 docs/plan/skill-install-sources.md，本文不设计）
```

**本文只提"要求与形状建议"**（客户端那份文档给实现细节）：

| # | 要求 | 理由 / 出处 |
|---|---|---|
| R1 | **`sourceType` 必须是一个两端共用的稳定枚举**（例：`LOCAL_FILE` / `URL_ARCHIVE` / `SKILLHUB_CN` / `SKILLHUB_XFYUN` / `GITHUB_REPO` / `NPM_PACKAGE`），不允许各自起名 | provenance 要写进 `ent_skill_import`/`ent_skill_version`，命名漂移会污染审计与检索 |
| R2 | **适配器输出统一为 `.dshskill` + 一份 `ImportReport`**（来源、上游坐标、许可判定与依据、sha256、三个体积数、逐条门禁结果、警告与被剥离字段） | `ImportReport` 是管理员预览（§F）与控制台失败反馈的唯一数据源；离线报告的门禁 id 是多门禁场景下**唯一**的可诊断性来源（服务端只有 2 个错误码，`SkillArtifactException.java`） |
| R3 | **适配器只做预检（预演），服务端必须再跑一遍真验包** | "绝不信任外部输入"（`docs/research/iflytek-skillhub-integration.md:448`）；服务端权威件是 `SkillArtifactInspector` |
| R4 | **许可判定口径两端一致**：默认 allowlist `MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC`，`CC-BY-SA-*` 与未知/无许可默认拒绝；依据必须在**包内取证**（`LICENSE`/`NOTICE` 文本 + 摘要） | `docs/research/iflytek-skillhub-integration.md:865-870`；`skillhub.cn` 列表条目**没有 license 字段**，许可必须回包内取证（任务书原型结论） |
| R5 | **`sourceDshVersion` 取值必须显式配置、禁止静默默认**：推荐填来源标识（如 `skillhub-convert/0.1.0` 或 `skillhub-cn/<上游版本>`），并在报告里同时记录我们锁定的 DSH 版本与上游版本 | 该字段实测无格式校验、只是投影给管理面的自由文本，且**它是我们版本自然键的组成部分**（`V35…sql:45`）——取值直接决定"同一技能能不能并存多个来源版本"，见 §C.5 |
| R6 | **适配器不得引入新的包形状**：产出必须仍是 `manifest.json` + `skills/<name>/SKILL.md`；包根**只能**有 `manifest.json` | `SkillArtifactInspector.java:121-136`（根级非 manifest 条目整包拒绝：`归档路径必须位于根或 skills/ 下`）→ 上游包根的 `README.md`/`LICENSE`/`NOTICE` **必须迁移**到 `skills/<name>/`，不是可选清理（顺带保住署名，`:609`） |
| R7 | **适配器不做内容安全扫描**（没有能力），只如实报告"未扫描" | 见 §A.2-4；不许用"已通过预检"暗示安全 |

### B.2 中心侧独有的部分：落在哪一层

| 关注点 | 落点 | 说明 |
|---|---|---|
| 渠道适配器本体（取包/转换/离线预检） | **离线工具**（建议 `scripts/skill-import/`，与既有 `scripts/bootstrap-*.mjs` 同区） | 与 `docs/research/iflytek-skillhub-integration.md:822-832` 的落地位置判断一致（`scripts/` ✅ / `plugin/packages/*` ❌ / `server/` 仅方案 B 立项时才进） |
| 权威验包 | 服务端既有 `SkillArtifactInspector`（**不改**） | `SkillCatalogService.java:96-102` |
| 接入既有链路 | 服务端**复用** `POST /admin/v1/skills/versions`（**不新造上传端点**） | `AdminSkillController.java:82-103` |
| 许可闸门 | **服务端**（导入路径强制，不信任工具报告） | 新增配置 + 校验；见 §D.4 |
| provenance | **服务端**（导入记录表 + 版本列 + 审计） | 见 §D.6 / §E |
| 审计 / 分配 / 投影衔接 | 沿用既有：`AuditSink`（`SkillCatalogService.java:305-317`）、`SKILL_ASSIGNMENTS_REPLACED`、`SkillViews` 加字段 | 见 §E |
| 控制台 UI | `console/`，生成 SDK 驱动 | 见 §F |

### B.3 ★ 判断：适配器放**服务端直拉**还是**离线/管理员本机工具**？

**推荐：离线/管理员本机工具为主（P0/P1），服务端受控直拉列为 P2 可选项；无论哪种，服务端都是权威闸门。**

| 维度 | 服务端直拉 | 离线工具（管理员本机拉好再上传） |
|---|---|---|
| SSRF 面 | ❌ 引入：管理员可指定任意 URL，服务端成为出站代理；需 egress 白名单 + DNS/重定向逐跳校验（§G） | ✅ 零：服务端只收 multipart，出站发生在管理员机器 |
| 凭据 | ⚠️ 三方私有源 token 必须落在服务端（加密存储、轮换、泄露影响面大） | ✅ 凭据留在管理员机器；v1 可明确"不支持私有源 token" |
| 可复现性 | ⚠️ 上游 API 未冻结（`docs/research/iflytek-skillhub-integration.md:469`：SkillHub `v0.2.x`，`/api/v1/**` 仍在演进），服务端要跟着改 | ✅ 工具版本可 pin，转换规则与报告可复现、可离线重跑 |
| 离线可用性 | ❌ 中心若内网无出网，功能直接不可用（`:471` 已记录该风险） | ✅ 只需管理员机器能出网 |
| 审计 | ✅ 服务端天然拿到 actor + `requestId` + `sourceIp`（`SkillMutationContext`） | ⚠️ provenance 由工具提交，**必须由服务端复核并签名落库**（不能只信报告） |
| 工时 | ❌ 转换器要 Java 重写 + 出网层 + 并发/超时/临时文件 + 源配置表（研究估 14–20 人日，`:460-466`） | ✅ 转换器一次实现，直接产出既有上传端点能吃的产物（研究估 5–7 人日，`:417-422`） |
| 合规可逆性 | ⚠️ 抓取器写进服务端后，ToS/法务结论一变就要动服务端 | ✅ 纯新增工具，完全可逆（`:430`）；合规未拍板前可先跑通 |

**三条理由（浓缩）**：

1. **收益/风险比不对称**：服务端直拉省下的只是"管理员少点一次上传"，换来的是 SSRF、凭据、上游漂移、
   内网无出网四类持续成本；而既有 `POST /versions` 已经能吃 `.dshskill`，链路改动为零。
2. **合规尚未拍板**：`CC-BY-SA-4.0` 的 ShareAlike 口径与三方站服务条款都还是"待法务/待核对"
   （`docs/research/iflytek-skillhub-integration.md:905,909`；`docs/plan/borrow-from-skillhub.md:66-67`）。
   离线工具完全可逆，服务端抓取器是**不可逆的架构承诺**。
3. **服务端必须强制的三件事（许可闸门、provenance、二次验包）与"谁去拉包"正交** ——
   即便把拉取放在管理员机器上，服务端依然能、也必须把这三件事做硬（§D）。反过来，把拉取搬进服务端
   **并不会让治理变强**，只会让攻击面变大。

> **例外口径（什么时候该上服务端直拉）**：当出现"必须由中心统一出网"的硬需求，例如
  ①需要服务端统一持有私有源凭据；②需要定时比对上游新版本（只产出"待导入"提示，不自动发布）；
  ③管理员设备被策略禁止直连外网。此时按 P2 立项，且必须带 §G 的完整 SSRF 缓解与源配置表。

---

## C. 中心侧的多渠道导入流程（端到端）

### C.1 流程总览（推荐：离线工具路线）

```text
① 管理员在控制台「技能管理」页点「从地址导入」
      ↓
② 控制台解析来源（sourceType + locator），显示"这一步将产出什么"的准备态
      ↓
③ 取包/转换  ← 在离线工具（管理员本机）或 P2 的服务端受控拉取层完成
      ↓ 产出 .dshskill + ImportReport
④ 管理员在控制台**预览确认**（将创建/将升级、文件树、许可、sha256、来源、门禁报告）  ← §F
      ↓ 确认后
⑤ 上传到既有端点 POST /enterprise/admin/v1/skills/versions（multipart + Idempotency-Key）
      ↓
⑥ 服务端权威闸门：写 pending(.part) → SkillArtifactInspector 验包 → 许可闸门 → provenance 落库
      ↓ 建成版本，状态 = VALIDATED（草稿）
⑦ 人工发布 POST …/versions/{id}/actions/publish（If-Match: revision）
      ↓
⑧ 分配 POST …/{packageId}/assignments/batch（If-Match: revision）
      ↓
⑨ 员工端 GET /enterprise/api/v1/skills 可见（按 assignment），下载走受控授权端点
```

**逐步骤责任、失败与错误码**

| 步 | 谁负责 | 失败时的处置与码 |
|---|---|---|
| ②来源解析 | 控制台（纯本地解析） | 未知/不支持来源 → 新增 `ENT_SKILL_SOURCE_UNSUPPORTED`（400）。**不要**复用 `ENT_INVALID_REQUEST`（它太泛，见 `EnterpriseExceptionHandler.java:475-483`） |
| ③取包/转换 | 离线工具（或 P2 服务端拉取层） | 工具侧给 `gate id` + 人类可读原因；网络类失败在服务端表现为"没东西可上传"，不产生新码；若走 P2 服务端拉取：`ENT_SKILL_SOURCE_UNAVAILABLE`（502/504）、`ENT_SKILL_SOURCE_BLOCKED`（403，egress/SSRF 拒绝） |
| ⑤上传 | 控制台 | 复用 `ENT_SKILL_INVALID_PACKAGE`(400) / `ENT_SKILL_TOO_LARGE`(413) / `ENT_INVALID_REQUEST`(400)，见 `EnterpriseExceptionHandler.java:344-356`、`:475-483` |
| ⑥许可闸门 | 服务端 | 新增 `ENT_SKILL_LICENSE_REJECTED`（403）——**不要**塞进 `ENT_INVALID_PACKAGE`（那是包结构问题，语义不同） |
| ⑥撞唯一键 | 服务端 | 新增 `ENT_SKILL_VERSION_CONFLICT`（409），见 §C.5（现状落在 `ENT_INVALID_REQUEST`，无法诊断） |
| ⑦发布 | 服务端既有 `changeStatus` | 复用 `ENT_SKILL_NOT_PUBLISHED`(403) / `ENT_REVISION_CONFLICT`(409)，见 `SkillCatalogService.java:239-261` |
| ⑧分配 | 服务端既有 `replaceAssignments` | 复用 `ENT_PERMISSION_DENIED`(403) / `ENT_REVISION_CONFLICT`(409) / `ENT_RESOURCE_NOT_FOUND`(404)，见 `SkillCatalogService.java:180-237` |

### C.2 谁负责"拉取/转换"（对应 §B.3 的推荐）

- **P0/P1**：离线工具。控制台的"来源解析"只负责**校验 locator 形状 + 拼出给管理员的操作指引**
  （例如"在本机运行 `skill-import …`"），并上传工具产出的 `.dshskill` 与报告 sidecar。
- **P2**：服务端新增"受控拉取层"（专用 fetch 组件，不复用模型网关的出站客户端），带 egress 白名单与
  §G 全套缓解；此时控制台的"来源解析"才真正驱动服务端作业。

### C.3 服务端 `SkillArtifactInspector` 要不要为"非本地上传"新增校验？

**结论：新增"来源语义"的校验不在 `SkillArtifactInspector`，而在导入服务层。**

理由：`SkillArtifactInspector` 的职责是**不可信 ZIP 的结构验包**（`SkillArtifactInspector.java:2-4` 的 `[INPUT]`/`[POS]`：
"读取不可信 .dshskill ZIP"、"单遍验包闸门"），它对"包从哪来"无感知也不该有感知 —— 一旦把来源逻辑塞进去，
它就同时承担了格式与治理两种职责，且会污染既有的本地管理员上传路径。

正确的分法：

| 校验 | 放在哪 | 说明 |
|---|---|---|
| 包结构/大小/路径/frontmatter（17 条门禁） | `SkillArtifactInspector`（**不改**） | `docs/research/iflytek-skillhub-integration.md:637-659` 有逐条清单 |
| 来源类型是否受支持、locator 合法性 | 新的导入服务层 | 只对 `source_type != LOCAL_UPLOAD` 生效 |
| 许可闸门 | 新的导入服务层 | 对**所有**来源生效（含本地上传，否则可绕过） |
| provenance 完整性 | 新的导入服务层 | 只要有 `source_type`，就必须有 `source_url`/`source_ref`/`fetched_at` |
| "是否允许这个来源" | 源配置（P2）或全局开关 | 见 §E.2 |

**唯一建议对 `SkillArtifactInspector` 相关的补强**（非来源语义，属内容缺口）：在导入服务里额外做
**"包内是否含可执行/脚本类载荷"的清点**，并把结果写进 `ImportReport`（只报告、不拒绝）——
因为当前验包**没有任何文件类型白名单**（`:337` 第 14 项："我们没有任何文件类型白名单"），
管理员预览时应当看得见"这个包带了 `scripts/*.py`"。

### C.4 建成版本时是什么状态？VALIDATED 还是 PENDING_REVIEW？

**P0 推荐：`VALIDATED`（现状，零状态机改动）+ provenance 区分来源；P1 再引入 `PENDING_REVIEW`。**

| 方案 | 优点 | 代价 | 建议 |
|---|---|---|---|
| 建成 `VALIDATED` | 零改动；既有 `publish` 闸门 (`SkillCatalogService.java:166-171`) 就是人工闸门 | 无法在状态上区分"本地上传的可信包"与"三方导入的包" | ✅ **P0**（靠 `source_type` + provenance 区分，UI 上出"导入"来源标记） |
| 建成 `PENDING_REVIEW` | 语义最准；与 `docs/plan/borrow-from-skillhub.md:34-36` 的 **P0 借鉴项**对齐 | **该状态当前不存在**：`SkillVersion.Status` 只有三态，DDL 约束 `V35…sql:42` 与契约枚举 `contracts/components/skill.yaml:15-17` 都要改，`publish` 的 `from` 参数 (`SkillCatalogService.java:166-171`) 与前端状态筛选 (`skill-management-page.tsx:305-313`) 也要同步 | ✅ **P1**，且**必须与"第二人复核"一起做**才有意义（§D.2） |

> **导入功能要不要依赖 PENDING_REVIEW？——不依赖，但强烈建议 P1 补上。**
> P0 用"导入即草稿（VALIDATED）+ 禁止一键全员可见"已经能达成 §D.5 要求的默认档位；
> PENDING_REVIEW 的增量价值是**把"待审"变成可查询、可分派、可统计的一档**，这需要一张
> 审批/审核记录（`docs/plan/enterprise-marketplace-phase2.md:308` 的 S5 已规划 `ent_skill_access_request`，
> 但那是"员工申请授权"，与"导入审核"不是同一件事，别混用表）。

### C.5 ★ 重复导入同一个技能怎么办（撞唯一键）

**先说清现状（实测）**：

1. 第 3 步先按 `(tenantId, skillId, sourceDshVersion, sha256)` 查既有版本；
   **完全相同字节** → 直接返回既有版本、`created=false`、HTTP 200（`SkillCatalogService.java:110-113`，
   契约 `contracts/paths/skill.yaml:49-53` 明确写了 "Existing version returned for an idempotent natural key"）。
2. 若字节不同但 `(package_id, source_dsh_version)` 相同 → `insertVersion` 撞 `uq_ent_skill_version_source`
   （`V35…sql:45`）→ 抛 `DataIntegrityViolationException` → 捕获后二次查既有版本（用新 sha256）也查不到
   → 抛 `IllegalArgumentException("技能 package/version 或 SHA-256 冲突")`（`SkillCatalogService.java:150-160`）
   → 最终被兜底映射成 **HTTP 400 `ENT_INVALID_REQUEST` "请求参数不合法"**（`EnterpriseExceptionHandler.java:475-483`）。
   **即：今天是"拒绝，但拒绝得不可诊断"。**

**推荐策略（四条，写死口径）**：

| 场景 | 策略 | 理由 |
|---|---|---|
| 同来源、同上游版本、**同 sha256** | **幂等返回既有版本（200）**，不新建 | 现状已支持，保持（`SkillCatalogService.java:110-113`） |
| 同来源、**上游有新版本**（内容变了） | **用新的 `sourceDshVersion` 值导入为"新版本"**，旧版本保持原状（草稿/已发布/已退休都不动） | `sourceDshVersion` 是我们版本自然键的一部分（`V35…sql:45`），它天然就是"版本维度"；不覆盖是因为版本表**只增不改**（无 update 语义）且 `SkillVersion` 是 record（`skill/domain/SkillVersion.java`） |
| 同来源、同 `sourceDshVersion`、**内容却不同** | **明确拒绝**，返回新码 `ENT_SKILL_VERSION_CONFLICT`（409），并在消息里给出既有版本 id 与 sha256 供排查 | 这是"上游在同一版本号上改内容"的脏情况，**绝不能静默覆盖**；也不该让管理员看到一句泛化的"请求参数不合法" |
| 上游版本 **≤** 目录里已有的同源版本 | **不建版本**，返回/提示"已存在更高版本"（附既有版本 id 与来源） | 静默丢弃会让管理员以为导入成功；这是**提示而非错误**，需要 `PackageView`/`VersionView` 能带上来源与上游版本用于比较（见 §E.4） |

**两条硬红线**：

1. **绝不"导入即覆盖升级"**。已发布版本可能已经分发到员工设备，而**已分发到设备的技能没有回收通道**
   （`docs/research/iflytek-skillhub-integration.md:476`："已分发到员工设备的技能不会被自动回收"）。
2. **绝不"导入即全员可见"**。导入产物只能到草稿；`ALL` 分配必须由人在 `assignments` 端点显式做
   （`SkillCatalogService.java:180-237`），且这一动作要留审计。

### C.6 幂等：`Idempotency-Key` 与内容寻址的分工（现状就是对的，别改）

- `Idempotency-Key: UUIDv4` 必填（`AdminSkillController.java:85-90`），但**只用于 pending 落盘路径命名**
  （`SkillArtifactStore.java:54`：`temporaryRoot.resolve(uploadId + ".part")`）。
- **真正的去重是内容寻址** `(tenantId, skillId, sourceDshVersion, sha256)`。
- 导入路径**沿用这套语义**，不引入第二套幂等键。若要给"导入作业"做幂等（P2 服务端直拉场景），
  用 `ent_skill_import.idempotency_key`（§E.1），**不要**去改 `POST /versions` 的语义。

---

## D. 治理（中心相对客户端的独有约束）★重点

### D.1 导入权限：谁能用？

**现状（实测）**：`ent:skill:read` 与 `ent:skill:write` **同时**授予企业管理员（role …001）与
插件管理员（role …003）—— `V35…sql:96-100`（角色身份见 `V4__enterprise_audit.sql:70,72`）。
也就是说，**插件管理员今天已经有完整的技能写入面（上传+发布+分配）**，比"仅导入到草稿"宽得多。

**建议的权限码拆分**：

| 权限码 | 语义 | 建议授予 | 与现状的关系 |
|---|---|---|---|
| `ent:skill:read` | 读目录 | enterprise_admin + plugin_admin | **不变** |
| `ent:skill:import`（**新增**） | **仅**"导入到草稿"：允许调用导入端点并建 `VALIDATED` 版本；**不允许** `publish`、**不允许** `assignments` | plugin_admin（+ enterprise_admin） | 这是**对 plugin_admin 的收窄**，属显式行为变更，必须写进迁移与发布说明 |
| `ent:skill:write` | 完整写入链（发布 + 分配 + 退休） | **仅** enterprise_admin（如确需 plugin_admin 也能发布，则由配置显式放开） | 现状 plugin_admin 也持有 → 收窄 |
| `ent:skill:license:override`（**可选，P2**） | 法务逐技能放行 copyleft / 无许可包 | 仅 enterprise_admin | 新增；没有它时 copyleft 一律拒 |

落地注意：控制台读的是 bootstrap 权限事实（`skill-management-page.tsx:210` 的
`bootstrap.permissions.includes('ent:skill:write')`），拆码后**前端按钮可见性必须同步**，
否则会出现"看得见按钮、一点 403"。菜单真源 `product-routes.ts:23` 的角色可见性也要一并核对。

### D.2 审核链：是否要 PENDING_REVIEW？是否需要第二人复核？

- **PENDING_REVIEW：要，但归 P1**（与 `docs/plan/borrow-from-skillhub.md:34-36` 的 P0 借鉴项对齐 ——
  它在那里是 P0，是因为它同时服务二期的"申请/审批"；对**导入**这条线，P0 用 VALIDATED 草稿即可达成同等防护）。
  引入时需同时改：`SkillVersion.Status`、`V35…sql:42` 的 check 约束、`contracts/components/skill.yaml:15-17` 枚举、
  `changeStatus` 的 `from` 参数、控制台状态筛选（`skill-management-page.tsx:305-313`）。
- **第二人复核：建议做，且用"导入者 ≠ 发布者"这个最小规则**（不需要新表）：
  - 需要能把 `version.created_by` 投影出来（**现状 `VersionView` 不含 `createdBy`**，`SkillViews.java:92-105`）→ 属 §E.4 补投影项；
  - 规则校验放在 `publish` 服务层：若该版本 `source_type != LOCAL_UPLOAD` 且 `created_by == 当前 actor` → 拒绝，
    给新码 `ENT_SKILL_SECOND_REVIEW_REQUIRED`（403）。
  - 若后续要求更重的审核（会签/理由/时限），再上独立审核表，**不要**复用 S5 的 `ent_skill_access_request`（语义不同）。

### D.3 许可闸门：服务端是否强制？copyleft 是否一律拒？

- **服务端强制：是。** 无论包来自哪里（含本地上传），许可判定必须在服务端跑一遍；
  只信工具的 `ImportReport` 等于把闸门交给管理员机器。
- **默认 allowlist**：`MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC`
  （对齐 `docs/research/iflytek-skillhub-integration.md:866`）。
- **copyleft（`CC-BY-SA-*`）：默认一律拒。** 依据同上 `:865-868`：
  ShareAlike 是否传染到我们的分发物需要法务逐技能结论；结论出来前默认一票否决。
  `docs/plan/borrow-from-skillhub.md:66-67` 同口径（"默认一票否决 + `--license-allowlist`"）。
- **未知/无许可：默认拒**（而不是"默认放行"）。`skillhub.cn` 原型的实测教训：**列表条目没有 license 字段**，
  许可必须回包内取证 —— 所以"查不到许可"是常态而非异常。
- **判定依据必须在包内取证**：包内 `LICENSE`/`NOTICE` 文本（文件名 + 摘要）写进 provenance；
  **不得**把上游的合规声明字段当作合规凭据（`docs/research/iflytek-skillhub-integration.md:884` 第 5 条：
  不要拿 `x-astron-compliance` 当合规证据）。
- **配置化**：`enterprise.skill.import.license-allowlist`（默认上表）+ `enterprise.skill.import.require-license`
  （默认 true）+ `enterprise.skill.import.copyleft-policy`（默认 `REJECT`）。放在
  `EnterpriseSkillProperties`（`skill/EnterpriseSkillProperties.java`）之外或之内需落地时定，但**必须是部署期配置**。
- **诚实边界**：许可判定是**文本启发式**（在包内找许可证文件 + 识别 SPDX 标识/关键字），**不是法律结论**；
  文档与 UI 都必须这么写（"仅供合规初筛，不构成法律意见"）。

### D.4 provenance：必须记录什么？落在哪张表/哪些字段？

**必须记录的 8 个事实**：来源类型、来源定位（URL/坐标）、解析到的精确版本/ref、拉取时间、
许可 SPDX + 判定依据、sha256、操作人、以及"转换器/适配器版本"。

**落点建议（两层）**：

| 层 | 表/字段 | 内容 | 理由 |
|---|---|---|---|
| **每次导入操作** | **新表 `ent_skill_import`** | 幂等键、source_type、locator、resolved_ref、status、version_id、sha256、size_bytes、license_spdx、license_evidence(jsonb)、report(jsonb)、error_code、created_by、created_at、updated_at、revision | 导入是**有生命周期与失败态**的操作（下载中/已转换/被拒），无法塞进不可变的版本行；也是 §F 预览与进度反馈的数据源 |
| **每条版本事实** | **`ent_skill_version` 加列** | `source_type`、`source_url`、`source_ref`、`upstream_version`、`license_spdx`、`license_evidence`、`fetched_at`、`import_id` | provenance 是**版本级**事实（同一个包的不同版本可以来自不同渠道）；放包级 `ent_skill_package` 会错 |
| **审计** | `ent_audit_event`（**不改表结构**） | 新 action + `metadata_json` 带 source_type/sha256/license | 表是只追加、禁 UPDATE（`V4__enterprise_audit.sql:51-61`），action 白名单需迁移扩展（§E.5） |

**约束**：`source_type` 为 `LOCAL_UPLOAD` 时，其余来源列可为空（存量行回填 `LOCAL_UPLOAD`）；
**非本地来源时 provenance 列不得为空**（在服务层强制，不在 DDL 上用复杂 check，便于回填）。

### D.5 内容安全缺口与"因此我们建议的默认档位"

**必须写进文档的缺口**：中心**没有**任何内容安全扫描能力，只有结构/大小/路径/条目校验
（`docs/research/iflytek-skillhub-integration.md:345` 第 22 项）。**这不会因为做了导入功能而改变。**

**因此建议的默认档位（四条，缺一不可）**：

1. **导入只能落草稿**：导入建的版本状态一律 `VALIDATED`（P1 起 `PENDING_REVIEW`），**绝不直接 `PUBLISHED`**。
2. **禁止"导入即全员可见"**：导入路径**不得**写 `ent_skill_assignment`；`ALL` 分配只能由人在分配端点显式提交
   （`AdminSkillController.java:127-143`）。技术手段：导入服务不注入 `SkillAssignment` 相关依赖。
3. **发布必须由人点**，且默认要求"第二人"（§D.2）；UI 上对导入来源的版本显示醒目的"未经内容安全扫描"提示
   （可复用 `SkillSafetyNotice`，`skill-editors.tsx:125`）。
4. **默认关闭服务端直拉**：只要 `source_type != LOCAL_UPLOAD` 且未配置受控拉取，一律拒绝（fail-closed）。

**明确不做的事**：不承诺"预检通过 = 安全"；不把 `ImportReport` 的"无告警"当安全结论；
不引入"自动扫描后自动发布"（我们没有扫描器，且自动发布被 §A.2-1 禁止）。

### D.6 与 builtin / featured / category 的关系

**现状（核对后）**：`ent_skill_package` 在 `V35` 里只有
`id, tenant_id, skill_id, display_name, description, status, revision`（`V35…sql:6-19`）；
`V36__enterprise_skill_marks.sql` 后加了 `builtin`/`featured`（均 `not null default false`，既有行回填 false），
`V37__enterprise_skill_category.sql` 后加了 `category varchar(32)`（可空，NULL = 没有分类）。
**但这三列目前没有任何读写路径** —— 代码与契约零消费（§1.3-2），
`shop_visible`/`featured_weight`/`tags` 仍未落地（二期 S1 的部分计划项，`:304`）。

**建议口径（五条）**：

1. **导入不自动设置任何策展标记**：导入产物令 `builtin=false`、`featured=false`、`category` 默认 NULL。
   理由：把"从外部导入"与"运营决定推荐/内置"解耦；这也是 S1 兼容性注意要求的默认值策略
   （`docs/plan/enterprise-marketplace-phase2.md:312` 的原话是"`V36` 迁移必须给存量行默认值（`shop_visible=false`），
   避免'升级即全量进商店'"，同样的纪律适用于本方案）。
2. **导入服务不写这三列**：`builtin`/`featured`/`category` 的写入应归属一个**独立的标记写路径**
   （`AdminSkillController` 新增 marks 端点 + `revision` 乐观锁 + `SKILL_MARKS_CHANGED` 审计），
   而不是塞进导入事务。理由：导入是"引入字节与来源"，标记是"运营治理"，两条链的成功/失败应能分别重试。
   → **前置**：该写路径**当前不存在**（§1.3-2），属待补能力（P1）。
3. **`category` 可以由导入者填或从来源映射，但它只是元数据，不产生任何授权**。
   授权永远只来自 `ent_skill_assignment`（`JdbcSkillStore.findVisiblePublished` 的 assignment 过滤，
   见 `docs/plan/enterprise-marketplace-phase2.md:277-278`）。
   注意 `category` 只有 `varchar(32)`，来源侧分类名超长时要**报错不截断**（与 frontmatter `description` 同纪律）。
4. **`builtin` 不由导入设置**：即便管理员想让全员默认可见，也必须走 `assignments`（`ALL`），
   并在 UI 上明确"这一步等于向全员分发"，避免把分发动作藏进"导入向导的勾选框"。
   V36 的 `[POS]` 已声明"`builtin` 参与 runtime 默认可见性"，届时**默认可见性与导入解耦**这一点更要守住：
   导入只到草稿，`builtin` 由人另行显式开启。
5. **`tags` 一律不做**（未落地，且与导入正交）：不要为导入先行引入 `tags` 列；要标签能力就按二期 S1 单独排。

---

## E. 服务端需要的改动（文件 / 迁移级，不含代码）

### E.1 是否需要新表？

**结论：一张新表 + 现有表加列（不新造目录表）。**

| 变更 | 对象 | 内容 | 必要性 |
|---|---|---|---|
| **新表** | `ent_skill_import` | 导入操作记录（见 §D.4 第一层）；`unique (tenant_id, idempotency_key)`；`check` status 枚举；`fk` 到 `ent_skill_version(id)`（可空）；`check (jsonb_typeof(report)='object')` | 导入是**异步/多步/可失败**的操作，且需要"预览 → 确认 → 落库"的三段状态 |
| **加列** | `ent_skill_version` | `source_type varchar(32) not null default 'LOCAL_UPLOAD'`、`source_url varchar(1024)`、`source_ref varchar(256)`、`upstream_version varchar(128)`、`license_spdx varchar(64)`、`license_evidence jsonb`、`fetched_at timestamptz`、`import_id bigint`（fk `ent_skill_import`，可空） | provenance 是版本级事实（§D.4） |
| **加索引** | `ent_skill_version` | `ix_ent_skill_version_source_type (tenant_id, source_type)`；`ix_ent_skill_version_license (tenant_id, license_spdx)` | 支持"按来源/许可筛选"与治理报表 |
| **不加列** | `ent_skill_package` | 显示名/描述已有（`V35…sql:6-19`）；策展字段已由 `V36`/`V37` 落地（`builtin`/`featured`/`category`），**导入不在这里夹带**（§D.6） | 职责分离 |
| **不改** | `ent_skill_assignment` | 导入不得写它（§D.5-2） | — |

**许可判定记录**：**P0 不单独建表** —— `license_spdx` 列 + `license_evidence jsonb`（含依据文件名与摘要）
+ 审计已足够。**只有**当出现"逐技能法务放行 + 放行人 + 放行有效期"这种需求（P2），再考虑
`ent_skill_license_decision`，且届时与 `ent_skill_import.license_evidence` 的关系要写清（前者是人工结论，后者是机器取证）。

### E.2 迁移版本号怎么顺延（**核对后已明确**）

- **实测：当前最新迁移是 `V37__enterprise_skill_category.sql`**
  （`server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/`，由并行提交 `b301fbb` 补回仓库）。
  完整尾部顺序：`V35__enterprise_skill_catalog.sql` → `V36__enterprise_skill_marks.sql` → `V37__enterprise_skill_category.sql`。
- **建议：本方案的导入迁移取 `V38__enterprise_skill_import.sql`**（下一个空号）。
- **不要再抢 `V36`/`V37`**：它们已存在且已在线上应用（`b301fbb` 的提交信息即为"把线上已应用的 V36/V37 迁移补回仓库"），
  改动它们会与线上已执行的历史冲突。
- **与二期 S1 的差额要显式记录**：二期计划里 `V36` 还想承载 `shop_visible`/`featured_weight`/`tags`（`:304`），
  **实际只落了 `builtin`/`featured`/`category`** → 差额（`shop_visible`/`featured_weight`/`tags`）需要**新的迁移号**
  （例如 `V39`）在二期排期里补，**不要**回头改 `V36`。
- **审计 action 白名单已含 `SKILL_MARKS_CHANGED`（V36 加的），但 `audit/AuditAction.java` 枚举里还没有它**
  （§1.3-2）→ 落地标记能力时**先补枚举**，否则 DDL 放行、Java 层写不出去。本方案新增的导入类 action
  （§E.6）应随 `V38` 一起加进白名单，并**同步**补 `AuditAction` 枚举。

### E.3 契约（`contracts/enterprise-openapi.yaml`）要加什么

现状：技能路径分片在 `contracts/paths/skill.yaml`，聚合在 `contracts/enterprise-openapi.yaml:154-169`；
错误码目录在 `enterprise-openapi.yaml:230-280`（`x-enterprise-error-statuses`）；组件在 `contracts/components/skill.yaml`。

**建议新增/修改（不改既有 5 个端点的语义）**：

| 类型 | 名称 | 内容 | 期次 |
|---|---|---|---|
| Path | `POST /enterprise/admin/v1/skills/imports`（**P2 才需要**，若走服务端直拉） | 创建导入作业：body = `{sourceType, locator, ref?, idempotencyKey}` → 返回 `SkillImport` | P2 |
| Path | `GET /enterprise/admin/v1/skills/imports/{importId}` | 作业状态与报告（进度/失败反馈） | P2 |
| Path | `POST /enterprise/admin/v1/skills/imports/{importId}/actions/confirm` | 预览确认后落成版本（对应 §C.1 ⑤⑥） | P2 |
| Path | （P0/P1 **不需要新端点**）| 导入 = 工具产出 `.dshskill` + 走既有 `SkillVersionUpload`（`contracts/paths/skill.yaml:21-57`）；来源元数据用**新增的 multipart part**（如 `provenance`）随包提交 | P0 |
| Part / Schema | `SkillImportProvenance` | `{sourceType, sourceUrl?, sourceRef?, upstreamVersion?, licenseSpdx?, licenseEvidence?, fetchedAt?}` | P0 |
| Schema | `SkillImport` / `SkillImportReport` | 作业与报告（门禁结果、体积三数、警告、被剥离字段） | P1/P2 |
| Schema | `SkillProvenance`（版本投影） | 拼进 `SkillVersion`，让管理员看得到来源与许可 | P0 |
| Enum | `SkillSourceType` | `LOCAL_UPLOAD` / `URL_ARCHIVE` / `SKILLHUB_CN` / `SKILLHUB_XFYUN` / `GITHUB_REPO` / `NPM_PACKAGE`（与客户端共享，R1） | P0 |
| Enum | `SkillVersionStatus` | 加 `PENDING_REVIEW`（**依赖状态机改动**） | P1 |
| 错误码表 | `x-enterprise-error-statuses` | 见 §E.5 | P0/P1/P2 |

**流程约束**：控制台 API 是生成物（`console/src/api/generated/`），因此**契约先行**，不能在控制台手写请求。

### E.4 投影要补什么（`skill/web/SkillViews.java`）

| 视图 | 现状 | 建议补 | 期次 |
|---|---|---|---|
| `VersionView`（`:92-105`） | id/packageId/skillId/sourceDshVersion/sizeBytes/sha256/status/skillCount/skills/createdAt/revision | `sourceType`、`sourceUrl`、`sourceRef`、`upstreamVersion`、`licenseSpdx`、`fetchedAt`、`createdBy`（第二人复核需要，§D.2） | P0 |
| `PackageView`（`:80-90`） | 无来源信息 | 可选：`latestSourceType`（列表行"来源"列用；`skill-management-page.tsx:116-159` 的列定义要同步） | P0 |
| `EntryView`（`:107-114`） | name/description/whenToUse/modelInvocable/userInvocable | **不改**（正文与来源不进条目投影） | — |
| `RuntimeSummaryView`（`:128-138`） | 无 `versionId`（二期 S6 已指出） | **不改**（与导入正交；但注意别与二期 S6 的同名改动冲突） | — |

**纪律**：投影**永不**出 artifact 路径与 SKILL.md 正文（`SkillViews.java:1-5` 的 `[POS]`），
provenance 列里也不得放包内正文快照。

### E.5 错误码清单（新增哪些、复用哪些）

**复用（不改语义）**：`ENT_INVALID_REQUEST`(400)、`ENT_PERMISSION_DENIED`(403)、`ENT_RESOURCE_NOT_FOUND`(404)、
`ENT_SKILL_INVALID_PACKAGE`(400)、`ENT_SKILL_TOO_LARGE`(413)、`ENT_SKILL_NOT_PUBLISHED`(403)、
`ENT_REVISION_CONFLICT`(409)。出处：`EnterpriseExceptionHandler.java:333-356`、`:475-483`；
契约目录 `contracts/enterprise-openapi.yaml:230-280`。

**新增建议（命名沿用 `ENT_SKILL_*` 口径，状态码沿用既有分段）**：

| 新码 | HTTP | 何时 | 期次 |
|---|---|---|---|
| `ENT_SKILL_SOURCE_UNSUPPORTED` | 400 | `source_type` 不在受支持枚举内 | P0 |
| `ENT_SKILL_IMPORT_PROVENANCE_REQUIRED` | 400 | 非本地来源但 provenance 字段缺失/不完整 | P0 |
| `ENT_SKILL_LICENSE_REJECTED` | 403 | 许可不在 allowlist / 未知 / copyleft（默认策略） | P0 |
| `ENT_SKILL_VERSION_CONFLICT` | 409 | 同 `(package_id, source_dsh_version)` 但内容不同（§C.5） | P0 |
| `ENT_SKILL_SECOND_REVIEW_REQUIRED` | 403 | 非本地来源、且发布者 == 导入者（§D.2） | P1 |
| `ENT_SKILL_SOURCE_BLOCKED` | 403 | egress/SSRF 策略拒绝（服务端直拉） | P2 |
| `ENT_SKILL_SOURCE_UNAVAILABLE` | 502/504 | 上游不可达/超时（服务端直拉） | P2 |

**注意**：现状 `ENT_SKILL_INVALID_PACKAGE` 只有一个笼统消息（"技能归档无效"，`EnterpriseExceptionHandler.java:352-355`），
**多门禁场景无法定位到具体哪一条** —— 这正是 §F 要求"预览必须显示逐条门禁结果"的原因；
服务端若要改善可诊断性，建议在 `SkillArtifactException` 的 message 里加**稳定 gate id**
（对齐 `docs/research/iflytek-skillhub-integration.md:641-659` 的 17 条 id），但这是**独立的可选改进**，不要顺带混进导入功能。

### E.6 审计事件（沿用 `ent_audit` 既有命名口径）

现状 action 白名单是 DDL 约束（`V35…sql:104-122`），加 action **必须**改约束；枚举在
`audit/AuditAction.java`（`PLUGIN_*`/`PRESET_*`/`SKILL_*` 前缀），metadata 是 record（`skill/application/SkillAuditMetadata.java`）。

**建议新增 action（保持 `SKILL_*` 口径）**：

| action | 触发 | metadata（建议字段） |
|---|---|---|
| `SKILL_VERSION_IMPORTED` | 导入建版本成功（对应 §C.1 ⑥） | `{packageId, versionId, sourceType, sha256, sizeBytes, licenseSpdx, importId}` |
| `SKILL_IMPORT_REJECTED` | 许可/冲突/验包失败 | `{sourceType, sha256?, errorCode, gateId?}` |
| `SKILL_IMPORT_CONFIRMED`（仅 P2 服务端作业） | 预览确认后落库 | `{importId, versionId}` |

**建议不改**：`SKILL_VERSION_UPLOADED` 的语义（本地上传）保持不变 —— 导入是**并列**的新事件，
不是"上传的一个变体"，否则审计里分不出"人工上传"与"外部导入"。
审计写入点复用 `SkillCatalogService.audit(...)`（`:305-317`），保持 `requestId`/`sourceIp`/`userAgentHash` 一致。

---

## F. 控制台 UI

### F.1 入口位置

- **位置：技能管理页的工具栏**，与「上传技能包」并列（`skill-management-page.tsx:321-326` 的 `toolbarAction`）。
  建议顺序：`[上传技能包] [从地址导入]`，两者都是 `ent:skill:import`（或 write）门控的 `Button size="xs"`。
- **不做成新菜单**：`product-routes.ts:18-28` 的九页结构刚刚定稿（`:45-50` 分组），
  导入是**技能目录的一个动作**，不是第十个页面。
- **不在设置弹窗里做**（二期已有同类结论：设置弹窗面积受限，`docs/plan/enterprise-marketplace-phase2.md:393`）。

### F.2 交互步骤（四步向导，复用既有对话框语言）

```text
① 来源与地址
   sourceType 下拉（本地上传 / 粘贴地址 / 三方商城 …） + locator 输入
   └ 本地解析校验（① 形状；② 该来源是否在受支持枚举内）
② 解析与预览（**确认前必须看到这些**）
   · 将创建 / 将升级（撞既有版本时给出"已存在更高版本"提示，§C.5）
   · manifest 摘要：id / name / sourceDshVersion / description
   · 包内文件树 + 逐条目大小（技能条目、脚本类载荷单独标出，作为内容安全缺口的可见补偿）
   · 许可（SPDX + 判定依据文件名 + 摘要）+ "仅供合规初筛，不构成法律意见"提示
   · sha256、sizeBytes、archive/expanded/entry 三个体积数
   · 逐条门禁结果（pass/fail + gate id）与警告清单
   · 来源（sourceType/locator/upstreamVersion/fetchedAt）
③ 确认导入 → 走既有上传（`serializeSkillUpload`，`skill-management-page.tsx:61-68` + `Idempotency-Key`）
④ 结果
   · 成功：抽屉保持打开，展示服务端解析结果（**现状口径**：`:234-237` 注释明确"文档化的服务端解析结果正是管理员需要核对的确认页"）
   · 失败：`role="alert"` + **稳定错误码**（沿用页面既有 `errorMessage`，`:43-50`）
```

**可复用的现成件**（不必重画）：`UploadSkillVersionDialog`（`skill-editors.tsx:182`）、
`SkillManifestPreview`（`:158`）、`SkillEntriesPreview`（`:137`）、`SkillSafetyNotice`（`:125`）。
建议新增一个 `ImportSkillDialog`，与 `UploadSkillVersionDialog` **并列**而不是把它改造成多模式
（现状文件 `[POS]` 明确"上传 serializer + 技能工作台"，掺模式会破坏既有测试形状）。

### F.3 进度与失败反馈

- **P0（离线工具）**：没有服务端长任务，进度 = "本机工具运行中"（控制台无法感知）→
  控制台的进度语义只剩**上传本身**（按钮 `saving` 态，`:331` 已有 `upload.isPending` 用法）。
  此时向导的第 ①② 步必须有**明确的"这一步在你自己机器上跑"文案**，否则用户会以为点了按钮就该自动完成。
- **P2（服务端直拉）**：导入作业有状态机（`ent_skill_import.status`），需要轮询或 SSE；
  失败反馈必须带 `error_code` 与（若是网络类）可重试按钮；**不要**做乐观 UI（一期插件/技能行的既有纪律是
  "界面从不乐观猜测"，见 `plugin/packages/ui/CLAUDE.md` 对 `marketplace-entry` 行的描述）。

### F.4 导入后在列表里如何体现来源

- **新增一列「来源」**：展示 `sourceType`（中文标签）+ 可选 `upstreamVersion`；数据来自 §E.4 的 `PackageView` 补充字段。
  列定义在 `skill-management-page.tsx:116-159`（`skillColumns`）追加，注意现有列宽是硬编码的 `w-[…]` 口径。
- **状态筛选要扩**：现有筛选只有三档（`:305-313`）→ 引入 `PENDING_REVIEW` 时必须加第四档
  （依赖 §D.2 的状态机改动。
- **行内动作不变**：导入的版本照旧只有 `publish`（VALIDATED 时）/`retire`（PUBLISHED 时）
  与「编辑范围」（`:183-197`），**不新增"导入即发布"按钮**。
- **详情页要显示 provenance**：`SkillDetailDialog` 内加一节"来源与许可"；
  文案必须包含"**未经内容安全扫描**"（§D.5-3）。

---

## G. 安全清单（中心侧特有面）

### G.1 SSRF（**仅当** P2 服务端直拉时成立；离线工具路线天然免除）

| # | 要求 | 说明 |
|---|---|---|
| G1 | **仅允许 `https://`**，明文 HTTP 直接拒 | 与「凭据不得明文出网」同一底线 |
| G2 | **egress allowlist**（host 白名单可配置） | 默认只放行已批准的来源域名；未命中 → `ENT_SKILL_SOURCE_BLOCKED`(403) |
| G3 | **DNS 解析后校验 IP**，拒绝 loopback/私有段/链路本地/组播/保留段，**尤其云元数据 `169.254.169.254`** | 只在"解析前"校验 host 无效，必须解析后校验 |
| G4 | **重定向逐跳校验**，跳数上限（建议 ≤3），且**跨 host 不转发任何认证头** | 302 到 COS 是真实场景（`skillhub.cn` 原型：下载 302 到 COS） |
| G5 | **连接/读取超时 + 总字节上限**（复用 `max-archive-bytes` = 50 MiB 口径，`EnterpriseSkillProperties.java:16`） | 边下边计数、超限即断 |
| G6 | **内容类型与扩展名校验**（期望 zip；不做"按 content-type 信任"） | 最终仍以 `SkillArtifactInspector` 为准 |
| G7 | **DNS 重绑定防护**：连接使用已校验的 IP（或连接后再校验对端 IP） | 经典绕过 |
| G8 | **不复用模型网关出站客户端**：`model/gateway/JdkDeepSeekUpstreamClient.java` 的信任模型是"固定上游 + 凭据"，与本场景"用户指定任意 URL"完全不同 | 旁证：服务端已有出站能力（`model/gateway`、`model/application/JdkProviderProbe.java`），但**不能**据此认为"直拉很简单" |

### G.2 凭据

- **v1 明确不支持三方私有源 token**（口径写明：只支持匿名可读端点）。依据：`skillhub.cn` 原型与
  `docs/research/iflytek-skillhub-integration.md:898` 都记着"公开云的 API Token 自助签发存在性未确认"。
- 若 P2 必须支持：token 存服务端密钥设施（**不进配置库、不进响应、不进日志**），
  每个来源一条凭据、可轮换、可禁用；**绝不下发给员工端或控制台前端**。
- 凭据泄露影响面评估必须写进部署说明：中心凭据泄露 = 上游账号被冒用。

### G.3 资源上限与失败回滚

- **导入任务并发上限 + 超时**（P2）；P0 由管理员本机自然限流。
- **临时文件清理**：复用 `SkillArtifactStore` 的 `.part` 语义（`SkillArtifactStore.java:51-87`
  写 `tmp/<uploadId>.part`，`finally { artifacts.deletePending(pending); }` 见 `SkillCatalogService.java:161-163`），
  **不要**新写一套临时目录约定。
- **失败不留半成品版本**：既有 `SkillCatalogService.upload` 的补偿纪律必须原样照搬 ——
  验包失败删 pending（`:99-102`）、事务失败删已物化制品（`:150-160`）、
  `finalized[0]` 记录已落盘 CAS 以便回滚。**新增的许可闸门/冲突检测必须排在"物化落盘之前"**，
  否则会产生"CAS 里有字节、库里没版本"的孤儿制品。
- **导入作业本身也要能回滚**：`ent_skill_import` 失败态只是记录，**不删**（审计价值），
  但必须保证它不指向任何半成品版本（`version_id` 仅在成功时写）。

### G.4 供应链：provenance 不可篡改（谁能改审计？）

- **谁也不能改**：`ent_audit_event` 是只追加（触发器 `trg_ent_audit_event_no_update`，
  `V4__enterprise_audit.sql:51-61`）；应用层无 update/delete 路径。
- **因此 provenance 的权威副本必须进审计**（§E.6），不能只躺在 `ent_skill_import.report` jsonb 里
  （那张表可以（也必然会）有状态迁移）。
- **`ent_skill_import` 的写入纪律**：状态只能单向推进（RECEIVED → FETCHED → CONVERTED → VALIDATED /
  REJECTED / FAILED），`report` 与 `sha256` **确定后不可改**（用 `revision` 乐观锁 + 服务层禁止改写；
  若要 DDL 级强约束，可对"进入终态后禁止 UPDATE"加触发器，与审计同范式）。
- **导入者与发布者要能对账**：靠 `created_by`（版本）+ 审计 action（导入/发布）两条独立记录，
  **不靠** `ent_skill_import` 单点。
- **转换器版本必须进 provenance**：否则无法回答"这个包是哪版转换规则产出的"（`sourceDshVersion` 口径，R5）。

---

## H. 分期与人日

> 人日口径沿用仓库既有调研：**1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时**，含实现+测试+文档，
> 不含排期等待与跨团队协调（`docs/research/iflytek-skillhub-integration.md:368`；
> `docs/plan/enterprise-marketplace-phase2.md:334` 同口径）。区间为 min–max。

### P0 — 最小可用（**已有本地上传 + 一种来源的导入**）：**12–21 人日**

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | 离线工具最小版：**一种来源**（URL 直链 `.dshskill` 或一种三方站）→ `.dshskill` + `ImportReport`；含 17 条门禁的离线预演 | 3–5 | 无（可直接引 `docs/research/iflytek-skillhub-integration.md:637-690` 的门禁清单） |
| P0-2 | 服务端 provenance：迁移 **`V38`**（`ent_skill_import` + `ent_skill_version` 加列）+ 域/持久化/投影补字段 | 2–3 | 迁移号已明确（最新为 `V37`，§E.2） |
| P0-3 | 服务端许可闸门（默认 allowlist + copyleft/未知拒 + 配置项） | 1–2 | P0-2 |
| P0-4 | 服务端冲突码 `ENT_SKILL_VERSION_CONFLICT` + 非本地来源 provenance 必填校验 | 1–2 | P0-2（现状冲突落 400 `ENT_INVALID_REQUEST`，`:475-483`） |
| P0-5 | 控制台「从地址导入」入口 + 四步向导 + 预览确认（复用 `SkillManifestPreview`/`SkillEntriesPreview`）+ 列表「来源」列 | 3–5 | P0-2（投影字段）、契约先行（§E.3） |
| P0-6 | 审计：新 action + DDL 白名单迁移 + `AuditAction` 枚举 + metadata record | 1–2 | P0-2（可与 P0-2 同一迁移） |
| P0-7 | 联调 + 验收（含负向：根级多余条目、无许可包、同版本号异内容、导入后仍未分配） | 1–2 | P0-1…P0-6 |

**P0 合计：12–21 人日**（逐项区间相加：min 3+2+1+1+3+1+1 = 12；max 5+3+2+2+5+2+2 = 21）。

### P1 — 审核与多来源（**9–16 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P1-1 | **`PENDING_REVIEW` 状态机**（`SkillVersion.Status` + `V35…sql:42` 约束 + 契约枚举 + `changeStatus` `from` 参数 + 控制台筛选第四档） | 2–3 | **⚠️ 依赖"尚不存在的能力"**（当前三态，见 §1.1） |
| P1-2 | 第二人复核规则（导入者 ≠ 发布者）+ `createdBy` 投影 + `ENT_SKILL_SECOND_REVIEW_REQUIRED` | 1–2 | P0-2、P1-1（若用状态机表达审核） |
| P1-3 | 第二种来源适配器 + 适配器注册/选择 | 2–4 | P0-1 |
| P1-4 | `ImportReport` 完整回放（报告持久化、失败可重查、逐条 gate 呈现） | 1–2 | P0-2 |
| P1-5 | 批量导入（多技能依次导入 + 汇总报告） | 1–2 | P1-3 |
| P1-6 | 策展字段接入：**先补标记写路径**（marks 端点 + `revision` 乐观锁 + `SKILL_MARKS_CHANGED` 审计 + `AuditAction` 枚举），再做 `builtin`/`featured`/`category` 的读写与投影；`tags` 不做 | 2–3 | 列已存在（`V36`/`V37`）但**代码零消费**（§1.3-2）；`tags`/`shop_visible`/`featured_weight` 需二期另开迁移 |

### P2 — 服务端受控拉取与生态（**10–16 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P2-1 | 受控拉取层：egress 白名单 + §G 全套 SSRF 缓解 + 超时/字节上限/并发 | 3–5 | P0 全部；部署侧确认出网策略 |
| P2-2 | 导入作业 API（`POST/GET /skills/imports` + confirm）+ `ent_skill_import` 作业状态机 + 进度反馈 | 3–5 | P2-1 |
| P2-3 | 来源配置表 + 凭据加密存储（若确需私有源） | 2–3 | P2-1 |
| P2-4 | 上游新版本比对 → **只产出"待导入"提示**（禁止自动发布） | 2–3 | P2-2 |

### 依赖"尚不存在的能力"的步骤（汇总，便于排期时标红）

| 步骤 | 依赖 | 现状证据 |
|---|---|---|
| P1-1 / P1-2（审核链） | **`PENDING_REVIEW` 状态** | `SkillVersion.java` 只有 `VALIDATED/PUBLISHED/RETIRED`；`V35…sql:42`；`contracts/components/skill.yaml:15-17` |
| P1-6（分类/标签） | **标记读写路径（Java/契约/UI），不是列** | 列已落地（`V36`/`V37`：`builtin`/`featured`/`category`），但 `server/.../skill/**` 与 `contracts/**` 对这三列**零命中**（§1.3-2）；`SKILL_MARKS_CHANGED` 只在 DDL 白名单里，`AuditAction` 枚举缺失 |
| P2-2 的"进度反馈" | 服务端长任务/作业表能力 | 现状无任何作业表；`ent_skill_import` 是本方案新增 |
| 许可逐技能法务放行 | 法务结论 | `docs/research/iflytek-skillhub-integration.md:909`（待法务） |

---

## I. 开放问题（≤6 条）

1. **服务端直拉还是离线工具？** 本文推荐"离线工具为主、服务端直拉 P2"（§B.3）。
   若要反过来（管理体验优先），需要产品方接受 SSRF/凭据/出网三类持续成本，并确认中心部署形态确实能出网。
2. **导入即草稿还是可直达发布？** 本文推荐"导入一律草稿，且默认禁止导入路径写分配"（§D.5）。
   若业务需要"导入后立刻全员可用"，那等于取消人工闸门，必须由业务方书面确认并承担供应链风险。
3. **copyleft 是否默认一律拒？** 本文推荐默认拒 + 法务逐技能 allowlist（§D.3）。
   若企业已有**通用**的 CC-BY-SA 采纳政策，可直接把 `CC-BY-SA-4.0` 加进 allowlist（但那要考虑 ShareAlike 传染）。
4. **是否需要"批量导入"？** 影响 P1-5 与导入报告的形态。
   注意：批量导入会把"逐个预览确认"的防护压缩成"批量一键"，**必须**在 UI 上保留逐包预览的可展开入口。
5. **`ent:skill:write` 是否要从 plugin_admin 收回？** 现状 plugin_admin 已持有完整写入链
   （`V35…sql:96-100`）；收窄是行为变更，需确认没有团队已依赖它。
6. **迁移号已明确，但需避让并行变更**：最新是 `V37__enterprise_skill_category.sql`，本方案取 `V38`（§E.2）。
   需与二期 S1 的**差额项**（`shop_visible`/`featured_weight`/`tags`）以及正在改 `console/`、`plugin/packages/ui/`
   的并行变更协调，避免抢号。

---

## J. 明确不做的清单（≥4 条 + 理由）

1. **不做服务端"订阅 + 自动发布"外部技能。**
   理由：我们没有内容安全扫描（`docs/research/iflytek-skillhub-integration.md:345`），
   自动发布 = 把未经审核的第三方代码自动分发给全员；两条来源文档都把它列为红线
   （`docs/research/iflytek-skillhub-integration.md:880`；`docs/plan/borrow-from-skillhub.md:60-62`）。
2. **不在员工端（Android）引入三方 CLI / Node 去做"导入"或"安装"。**
   理由：会绕过 `/enterprise/api/v1/skills` 的 `ACTIVE` 设备校验与 `assignments` 分配，在授权模型上开洞
   （`docs/research/iflytek-skillhub-integration.md:881`）；且我方没有回收通道。
3. **不为迁就外部格式改动我们的 `.dshskill` 格式真源。**
   理由：我们的包格式对齐官方 `dsh-skill`（`SkillArtifactInspector.java:2-4` 与 `:44-45`）；
   互操作必须发生在**转换层**（`docs/research/iflytek-skillhub-integration.md:882`）。
4. **不把上游的合规声明（如 `x-astron-compliance`）当合规凭据。**
   理由：上游自己声明那不是第三方认证；拿它当凭据是主动制造审计风险（`:884` 第 5 条）。
5. **不用 `iframe` / 复制官方页面来"内嵌"来源站或官方页面。**
   理由：与二期既有结论一致（`docs/plan/enterprise-marketplace-phase2.md:389`），
   且会破坏主题 token 与模块边界纪律。
6. **不把"预检通过"当作安全结论、不引入"扫描后自动发布"、不承诺技能在 Android 上一定能跑。**
   理由：`ImportReport` 只反映结构/许可，不反映内容安全（§D.5）；格式兼容 ≠ 运行时可用
   （`docs/research/iflytek-skillhub-integration.md:885`）。
7. **不为导入新造第二套上传/幂等/临时文件机制。**
   理由：既有 `POST /versions` + 内容寻址去重 + `.part` 临时文件 + CAS 物化 + 补偿回滚已经完备
   （`SkillCatalogService.java:88-164`、`SkillArtifactStore.java:51-87`）；平行造一套必然产生一致性缺口。

---

## K. 不确定项（读不到 / 证据不足，**不编造**）

1. **服务器侧 `skillhub.cn` 导入原型在本机不可达**：`/opt/work/skillhub-import/`（`common_auth.py`、
   `fetch_top_n.py`、`license_scan.py`、`EVIDENCE.md`、`raw/`、`converted/`）**在当前环境不存在**
   （`ls /opt` → `No such file or directory`），且在仓库内 grep `skillhub-import` / `skillhub.cn` / `fetch_top_n`
   **零命中**。因此本文对 `skillhub.cn` 的端点（`GET /api/skills?sortBy=score&order=desc`、
   `/api/v1/skills/{slug}?namespace=`、`/api/v1/download?slug&namespace` → 302 到 COS）、
   "列表条目无 license 字段"、以及 "Top100 允许 19 / 拒绝 81" 的结论，**只能转述任务书口径**，
   未经本机复核。→ **落地前必须把该原型的 `EVIDENCE.md` 与脚本取回可访问位置**。
2. **`V36`/`V37` 与二期 S1 的差额归属未定**：`V36`/`V37` 已存在并已在线上应用（`b301fbb`），
   但它们**没有**包含二期 S1 计划里的 `shop_visible`/`featured_weight`/`tags`（`docs/plan/enterprise-marketplace-phase2.md:304`）。
   这些差额要用哪个号（例如 `V39`）、由哪条线负责，**尚无结论**；本文只建议"另开号、不回头改 `V36`"。
   另：`SKILL_MARKS_CHANGED` 已在 DDL 白名单但**不在** `AuditAction` 枚举 —— 这是本轮核对发现的**既有不一致**，
   作者未验证它是"有意留白"还是"遗漏"。
3. **`skillhub.cn` 与 `skill.xfyun.cn` 的许可字段有无尚不统一**：后者调研文档有 37 项对照表；
   前者只有"列表无 license 字段"这一条转述结论。若将来两者都做，需要一份**两站并列**的字段映射表。
4. **服务端部署形态是否允许出网未确认**：`docs/research/iflytek-skillhub-integration.md:471` 只提出该风险
   （"我们的服务端若部署在内网无出网"），没有部署侧结论。这直接决定 P2 是否可行。
5. **许可判定的实现精度未定**：包内 `LICENSE`/`NOTICE` 的**文本识别边界**（多许可并存、仅 SPDX 注释、
   仅 README 提及）没有实测样本结论 → 本文只给"必须在包内取证 + 默认拒"的策略，不给识别算法承诺。
6. **"内容安全扫描"能力的缺失是已验证事实**（`docs/research/iflytek-skillhub-integration.md:345`），
   但**是否/何时补齐**不在本文范围；本文只保证默认档位不依赖它（§D.5）。
7. **`ent_skill_import` 的终态不可改约束**是否要上 DDL 触发器（同 `ent_audit_event` 范式）未定 ——
   本文只给建议，不拍板（§G.4）。
8. **本次任务并行的两个代理正在改 `plugin/packages/ui/**` 与 `console/**`**，
   因此 §F 列出的控制台文件行号**可能漂移**；且 `console/src/features/skills/skill-management-page.tsx`
   的状态筛选/列定义可能在并行变更中被改动。落地前需重新核行号。
9. **`docs/plan/skill-install-sources.md`（客户端侧方案）本文写作时不存在**，其适配器接口细节未读；
   本文只提 R1–R7 的要求，**若该文档给出不同的 `sourceType` 命名或报告形状，以对齐协商结果为准**
   （本文不重复设计）。

---

## L. 证据索引（文件 · 行号）

**服务端（中心）**

- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/web/AdminSkillController.java:39,57-80,82-103,105-114,116-125,127-143,145-149`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/application/SkillCatalogService.java:88-164`（`110-113` 去重、`150-160` 冲突、`161-163` pending 清理）、`166-178`、`180-237`、`239-261`、`305-317`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactInspector.java:41-53,66-114,121-136,138-165,168-202,204-214`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactStore.java:51-87,89-105,107-127,137-145,181-199`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/artifact/SkillArtifactException.java`（`errorCode()`）
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/EnterpriseSkillProperties.java:16-18`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/domain/SkillVersion.java`（`enum Status`、record 只增不改）
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/web/SkillViews.java:23-43,80-105,107-114,128-138`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/persistence/JdbcSkillStore.java:122-133`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/common/api/EnterpriseExceptionHandler.java:333-356,475-483`
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/audit/AuditAction.java:40-44`
- `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V35__enterprise_skill_catalog.sql:6-19,21-48,45-46,42,53-79,86-102,104-122`
- `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V36__enterprise_skill_marks.sql`（加 `builtin`/`featured`；白名单加 `SKILL_MARKS_CHANGED`）
- `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V37__enterprise_skill_category.sql`（加 `category varchar(32)` + `ck_ent_skill_package_category`）
- 补回提交：`b301fbb fix(server): 把线上已应用的 V36/V37 迁移补回仓库`（并行代理提交，非本文作者）
- `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V4__enterprise_audit.sql:7-28,51-61,70,72`
- 出站能力旁证：`server/.../model/gateway/JdkDeepSeekUpstreamClient.java`、`server/.../model/application/JdkProviderProbe.java`

**契约**

- `contracts/enterprise-openapi.yaml:154-169`（技能路径）、`:230-280`（错误码目录）
- `contracts/paths/skill.yaml:6-19,21-57,59-99,101-136`
- `contracts/components/skill.yaml:15-17`（`SkillVersionStatus`）

**控制台**（并行变更中，行号可能漂移）

- `console/src/features/skills/skill-management-page.tsx:61-68,70-73,103-114,116-159,183-197,210,225-238,305-313,321-326`
- `console/src/features/skills/skill-editors.tsx:125,137,158,173,182`
- `console/src/app/product-routes.ts:18-28,45-50`
- `console/src/api/generated/{sdk.gen.ts,types.gen.ts}`（生成物，契约先行）

**仓库内文档**

- `docs/plan/enterprise-marketplace-phase2.md:277-279`（可见性分层）、`:304`（S1 `V36`）、`:307`（S4 `ENT_SKILL_NOT_ASSIGNED`）、`:308`（S5 申请表）、`:312`（`V36` 默认值兼容性）、`:336-368`（P0/P1/P2 排期）、`:346`（P0-7）、`:367`（P2-2 转换器）、`:389,393`（不建议做的事）
- `docs/plan/borrow-from-skillhub.md:34-36`（PENDING_REVIEW 借鉴 = P0）、`:59-67`（不要抄 / 法务）、`:72-74`（P0 落点）、`:92-97`（不确定项）
- `docs/research/iflytek-skillhub-integration.md:320-362`（37 项对照表）、`:368`（人日口径）、`:389-436`（方案 A）、`:438-483`（方案 B）、`:637-690`（17 条门禁）、`:822-832`（落地位置）、`:861-874`（法务）、`:878-886`（不建议做的事）、`:890-909`（不确定项）
- `docs/compose/spec/skill-catalog.md:118`（安装＝落盘不执行）、`:120`（官方无技能安装 RPC 的能力核对结论）、`:122-131`（Out of Scope）

**服务器侧原型（本机不可达，见 §K-1）**

- `/opt/work/skillhub-import/common_auth.py`
- `/opt/work/skillhub-import/fetch_top_n.py`
- `/opt/work/skillhub-import/license_scan.py`
- `/opt/work/skillhub-import/EVIDENCE.md`、`/opt/work/skillhub-import/raw/`、`/opt/work/skillhub-import/converted/`

---

## M. 落地交接清单（给实施者）

1. **迁移号**：最新为 `V37`，本方案取 **`V38`**；与二期 S1 差额项（`shop_visible`/`featured_weight`/`tags`）
   及并行变更协调（§E.2、§I-6）。
2. **新增导入 action 时同步补 `audit/AuditAction.java` 枚举** —— `V36` 已暴露"DDL 白名单有、枚举没有"的不一致（§1.3-2、§E.2）。
3. **契约先行**：`contracts/` 改完再生成控制台 SDK；不在控制台手写请求（§E.3）。
4. **`docs/CLAUDE.md` 成员清单补一行**（本文属 `docs/plan/`）—— 由落地者做，本文作者未改任何其他文件。
5. **审计 action 白名单是 DDL 约束**：新增 action 必须随迁移一起改（`V35…sql:104-122` 范式）。
6. **默认档位不可协商地保持 fail-closed**：导入只到草稿、导入不写分配、许可未知即拒、服务端直拉默认关闭（§D.5）。
