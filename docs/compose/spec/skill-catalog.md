---
feature: skill-catalog
status: delivered
updated: 2026-10-05
branch: (working tree)
---

# DSH Enterprise 企业技能目录（Skill Catalog）

## Report

**What was built** — 企业控制面私有 `.dshskill` 目录：管理员在 `/skills` 上传验包、发布/退休并原子替换 ALL/USER 可见范围；员工在设置「技能」tab 浏览并复制装配指令，落盘到 `~/.dsh/skills/` 后由官方 `skill-filesystem` watcher 直接生效。包格式与 DSH 标准技能规范同构（`manifest.json` `format=dsh-skill` `version=1` + `skills/<name>/SKILL.md`，一包多技能）。

**Verification** — 契约生成与 fixture 门禁 `@dshent/contracts` `9/9` PASS；服务端 `AuditMetadataPolicyTest` `2/2`（`-Pdev -Dmaven.test.skip=false` 真实执行）；控制台 `tsc --noEmit` 零诊断 + Vitest `79/79`（含技能 `4+7`）。迁移 `V35`、`RbacSeedTest`、跨端 HTTP/Harness E2E **未执行**——本机无 Docker（Testcontainers 不可用），如实标注为未验证。**2026-10-02 修正**：本字段原记 `SkillArtifactInspectorTest` `8/8`，与源文件里实际的 `14` 个 `@Test` 不符（**原计数有误**，按实测改正）；另追加 `10` 条 §S2.2 资源文件用例 ⇒ 现共 `24`（`git show HEAD:` 读数 `14` + 新增 `10`）。**2026-10-05 实跑**：`SkillArtifactInspectorTest` **`24/24` 在本机最小独立跑道实跑通过**（`24 tests found / 24 started / 24 successful / 0 failed / 0 skipped`，JDK **`21.0.12`**（Termux 构建，与 `server/pom.xml:20` 的 `java.version=21` 同主版本）＋ `snakeyaml:2.6` ＋ `jackson-databind`/`jackson-core` `3.1.4`（`tools.jackson.core`）＋ `com.fasterxml.jackson.core:jackson-annotations:2.21` ＋ `junit-platform-console-standalone:6.0.3`，命令 `javac --release 21` + `ConsoleLauncher execute --select-class …`，须 `-Djava.io.tmpdir=<存在的目录>` 覆盖，见 §S2.2 末尾「运行环境备忘」）。★**这不等价于 Maven 实跑**：本跑道的 classpath 被窄化到上述 5 个 jar、未走 surefire 的选中集与 `argLine`/系统属性、未走 Maven 资源过滤 ⇒ **`SkillArtifactInspectorTest` 在 Maven 下是否被 surefire 选中、资源如何过滤，仍未验证**。

## [S1] Problem

DSH 的技能（skill）是**会被 Agent 加载执行的任务专项指令**，官方 `dsh-skill` 注册表从本地目录、插件数据与远程服务收集它们。DSH Enterprise 目前只有受管插件分发（`/plugins`）与配方广场（`/presets`），没有企业技能目录：

1. 企业无法把已评审的自定义技能集中发布给员工，员工只能依赖外网公共技能市场或手拷文件到 `~/.dsh/skills`。
2. 技能正文会被 `dsh-tool-skill` 在会话内无条件注入或由模型按需加载——公共来源的信任模型不适用于企业；需要管理员独占发布与可见范围裁决。
3. 技能是第三种制品与消费方式：插件是 npm/tgz、配方是 `.dshpreset`（经 loopback `agent-preset.import`），技能是 `skills/<name>/SKILL.md` 树（落盘即被 watcher 发现）。

目标：建立与 DSH 官方技能规范同构的私有技能目录，管理员上传/发布/限定可见范围，员工目录内浏览并复制装配指令。

## [S2] Design

### S2.1 冻结决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 包格式 | `.dshskill` ZIP：根 `manifest.json`（`format=dsh-skill` `version=1` `id` `name` `sourceDshVersion`，可选 `description`）+ `skills/<name>/SKILL.md` | 与官方技能规范同构，不发明第二套格式；服务端按官方规则验包 |
| 包内多技能 | **允许**（`skills/<a>/SKILL.md` + `skills/<b>/SKILL.md`） | 对齐官方 `dsh.skills` 数组语义与 `dsh-agent-preset` 包内 `skills/` 多目录形态；"系列技能"（如 lark-* 一族）本就是一组 |
| 贡献模型 | 仅 `plugin_admin` / `enterprise_admin` 上传与发布 | 与插件/配方同一治理心智；可执行指令必须过审 |
| 员工消费 | 一期**复制装配指令**（不自动落盘）；落盘调和器列为二期 | 官方无 `skills/install` RPC（已全量核对 0.2.0-rc.2 asar）；落盘后 watcher 自动发现，无需重启 |
| 控制台 | 独立纵向 `/skills`（不是 `/plugins` 子页） | 三种制品、三种权限语义、三种消费方式 |
| 员工发现面 | `dshent-plugin`「DSH Enterprise 设置 → 技能」tab | 复用既有插件/配方 tab 模式 |
| 正文持久化 | **不存** SKILL.md 正文；只存 frontmatter 脱敏投影（jsonb）与内容寻址制品 | 技能正文属可执行内容，最小化企业侧留存面；与配方"不记录包内 YAML"一致 |

### S2.2 包契约

```text
manifest.json
skills/
├── <name-a>/SKILL.md      # frontmatter 必填 name(kebab-case) + description
└── <name-b>/SKILL.md      # 可选 whenToUse / disable-model-invocation / user-invocable
```

服务端验包**拒绝**：绝对路径、`..` 穿越、反斜杠路径、非 `manifest.json`/`skills/` 子树下的旁路目录、重复路径、缺失 `manifest.json`、非 `dsh-skill`/非 v1 manifest、非法 `id`、包内零个 `SKILL.md`、非 kebab-case 技能名、缺失 `name`/`description`、非法/非布尔调用策略、官方已废弃的旧字段名（`modelInvocable`/`userInvocable`/`disableModelInvocation`）、包内 frontmatter 重名、超 entry 数或解压上限（`413`）。

服务端**不**解析或执行技能正文语义，深度语义由官方 `skill-filesystem` 负责。默认上限：单包压缩前 ≤ 50 MiB、解压后 ≤ 200 MiB、entry ≤ 10 000、包内技能 ≤ 200、根 `manifest.json` ≤ 1 MiB、`skills/<name>/SKILL.md` ≤ 256 KiB —— **后两条逐条目上限只作用于这两个路径**。

**`skills/<name>/` 下的资源文件**（`references/*.md`、`scripts/*.py`、`assets/*`、`skills/<name>/LICENSE.txt`、裸目录条目 `skills` 与 `skills/<name>/references/`）**被接受、但不被解析**：路径裁决只看是否命中 `skills/` 前缀（`SkillArtifactInspector.java:134`），**只有恰好 3 段且末段为 `SKILL.md` 的条目**才被当作技能条目解析 frontmatter（`:118-120`）；判据还有三条——只有 manifest 与 `SKILL.md` 才建捕获缓冲（`:84`、`:90`），故资源文件**不计入** 1 MiB / 256 KiB 单文件上限（`:85`、`:91-92`）；资源文件**不占**「包内技能 ≤ 200」名额，只计入**解压总量与 entry 数** —— `SkillArtifactInspector.java:79` 的 `entries` 计数与 `:88-89` 的 `expanded` 累加是**无差别**施加于全部 entry 的两道闸；整包至少要有一个 `skills/<name>/SKILL.md`，只放资源文件仍被拒（`:114`）。

员工端一键安装（§S2.7）同口径：解包只按中央目录的 `relative` 相对路径逐层收集（`plugin/packages/bundle/src/skill-archive.ts:142` 的 `segments.slice(2).join('/')`，任意深度），256 KiB 只压 `relative === 'SKILL.md'`（`:144`）；本地「已装技能」正文/文件读取的 256 KiB 是**读取路径**上限（`plugin/packages/bundle/src/skill-install.ts:786`、`:813`，越界返回 `ENT_SKILL_CONTENT_TOO_LARGE`），**安装本身**按字节原样落盘、不做单文件体积裁决。★**行号为 2026-10-05 实测（改这两份文件后需同步）**：本条原引 `skill-archive.ts:133`/`:135` 与 `skill-install.ts:715`/`:742`，那**不是写错**，而是刀 3a 改了这两个文件本身导致**整体位移**——`skill-archive.ts` 因 additive 多回 `displayName`（HEAD 152 行 → 现 161 行，+9）、`skill-install.ts` 因抽出 `placeEnterpriseSkillArchive`/`readInstalledSkillRecords`（942 → 1013 行，+71）；两处偏移量分别恰为 9 与 71，与文件增量一致。

**运行环境备忘（本机，2026-10-05 实证；三条都是「名字/路径会骗人」的坑，跑任何编译产物/Java 测试前先读）**

1. **`/data/data/...` 是 `noexec` tmpfs**（`/proc/mounts`：`tmpfs /data/data tmpfs rw,nosuid,nodev,noexec`），而 **`/data/user/0/...` 是同一份数据的可执行别名** ⇒ 本机执行任何编译产物或其子进程**必须用 `/data/user/0` 前缀**。这正是 `apt-get install openjdk-21` 连续 3 次下载 129 MB 成功后卡在配置阶段的根因：apt 派生的 dpkg 在 `execvp` 自己的 helper（`sh`/`rm`/`tar`/`diff`/`dpkg-deb`/`start-stop-daemon`）时被 `noexec` 拦掉，报成「`not found in PATH or not executable`」——**误导性地指向 PATH，实际 PATH 是对的**。
2. **Termux 构建的 JDK 把 `java.io.tmpdir` 硬编码为 `/data/data/com.termux/files/usr/tmp/`**，本机该目录不存在 ⇒ `@TempDir` 会**全崩** `NoSuchFileException`（表现为整类用例「Failed to create default temp directory」，看着像代码全红，其实是环境）。**Maven `-Pdev` 实跑会踩同一个坑**，必须加 `-Djava.io.tmpdir=<存在的目录>`。另需 `LD_LIBRARY_PATH` 指向 `libandroid-shmem.so` 等，否则 `libjvm.so` 的 `dlopen` 失败。
3. **Jackson 3 的注解 artifact 仍在 2.x groupId**：`tools.jackson.core:jackson-annotations:3.1.4` **是 404**，正确坐标是 `com.fasterxml.jackson.core:jackson-annotations:2.21`（依据 `jackson-databind-3.1.4.pom` 自身注释「Annotations remain at Jackson 2.x group id」＋ `jackson-bom-3.1.4.pom`）。仅凭「Jackson 3」这个名字去找依赖会持续踩坑。

### S2.3 数据模型（Flyway `V35`）

不复用 `ent_plugin_*` / `ent_preset_*`；新建三表 + `ent:skill` 权限码，全部强制 `tenant_id`。

**`ent_skill_package`**：`id` PK、`tenant_id`、`skill_id`（来自 manifest `id`，tenant 内唯一）、`display_name`、`description`、`status` `ACTIVE|DISABLED`、`revision` CAS。

**`ent_skill_version`**：`package_id` FK、`source_dsh_version`、`artifact_ref`（CAS 相对引用）、`size_bytes`、`sha256`（tenant 内唯一）、`status` `VALIDATED→PUBLISHED→RETIRED`、**`skill_count` + `skills jsonb`（frontmatter 脱敏投影，GIN 索引）**、`created_by`、`created_at`、`revision`；唯一 `(package_id, source_dsh_version)`。

**`ent_skill_assignment`**：`subject_type` `ALL|USER`、`subject_id`、`status`、`revision`；每 package 至多一条 `ALL`，每 `(package, USER, subject)` 至多一条。

**权限码**：`ent:skill:read` / `ent:skill:write`，授予 `enterprise_admin` 与 `plugin_admin`。按配方（V30）先例**只登记 F 型权限行**——控制台侧栏由前端 `product-routes.ts` 驱动、不消费 `sys_menu`，C 型页面节点只会复用同一 `perms` 造成重复行。

**审计 action**（V35 扩展白名单至 45 条）：`SKILL_VERSION_UPLOADED` / `SKILL_VERSION_PUBLISHED` / `SKILL_VERSION_RETIRED` / `SKILL_ASSIGNMENTS_REPLACED` / `SKILL_DOWNLOAD_AUTHORIZED`，metadata 为显式 DTO，不记录 SKILL.md 正文。

### S2.4 协议（OpenAPI 分片 `paths/skill.yaml`）

**管理端**（Cookie，`ent:skill:*`）

| Method | Path | 语义 |
|---|---|---|
| GET | `/enterprise/admin/v1/skills` | cursor 列表；每项含 package + 全部版本（含条目投影）+ 可见范围 |
| POST | `/enterprise/admin/v1/skills/versions` | multipart（`artifact` + 可选 `metadata`）；幂等键；同 sha256 幂等返回 |
| POST | `/enterprise/admin/v1/skills/versions/{id}/actions/publish` | 发布；`If-Match: revision` |
| POST | `/enterprise/admin/v1/skills/versions/{id}/actions/retire` | 退休；停止新下载授权 |
| POST | `/enterprise/admin/v1/skills/{packageId}/assignments/batch` | **全量原子替换**可见范围 |

**Runtime**（Bearer，员工插件）

| Method | Path | 语义 |
|---|---|---|
| GET | `/enterprise/api/v1/skills` | 当前用户有效可见的已发布技能；`sort=newest` |
| GET | `/enterprise/api/v1/skills/{packageId}` | 详情：versionId、sha256、条目投影、可见性已解析 |
| GET | `/enterprise/api/v1/skills/versions/{id}/download` | 逐请求重算可见性后流式下载；单 Range；RETIRED/不可见 → 403 |

**错误码**：`ENT_SKILL_INVALID_PACKAGE`(400)、`ENT_SKILL_TOO_LARGE`(413)、`ENT_SKILL_NOT_PUBLISHED`(403)、`ENT_SKILL_VISIBILITY_DENIED`(403)，已进 `EnterpriseErrorCode` 与 `x-enterprise-error-statuses` 封闭目录。

### S2.5 控制台 `/skills`

`product-routes.ts` 第九项：`{ to: '/skills', label: '技能', icon: Sparkles, allowedRoles: ['enterprise_admin', 'plugin_admin'] }`。包级工作台单表（技能包/skillId、最新基线、技能数、状态、可见范围 ALL/N 人、更新时间），行操作=发布/退休（作用于最新版本 + CAS）/编辑范围/详情；上传对话框展示服务端解析出的 manifest 与**每个 SKILL.md 条目**的调用策略；详情含版本历史、可见范围编辑与安全提示。

### S2.6 员工端设置 tab

「插件」「配方」旁增加「技能」tab；卡片展示 displayName/description/`DSH {sourceDshVersion}`/大小/技能数；详情展示每个条目的 name/description/`whenToUse`/调用策略（模型可调用、仅用户可调用）与安全提示。一期唯一主动作：**复制装配指令**，文案含下载 URL、名称、skillId、建议目标目录 `~/.dsh/skills/`，并要求实际下载落盘前确认。

### S2.7 员工端一键安装（二期增量，2026-10-02）

一期冻结的「员工端唯一主动作＝复制装配指令」已被二期增量取代：同一 tab 的每个技能行现在有一个**「安装」按钮**，点击即完成安装并回显成功/失败；已装行显示「已装 · N 个技能」并可卸载。「复制装配指令」保留为第二条路（不装也可交给用户自己的 Agent 会话）。

```text
同源路由（本机 API 前缀 /enterprise/api/v1/local，三条都是 /skills 的 exact 子路径）
  GET  /skills/installed   → { data: { skills: [...] } }        # Host 落盘真值
  POST /skills/install     → { packageId } → { data: { skills: [...] } }
  POST /skills/uninstall   → { packageId } → { data: { skills: [...] } }

安装顺序（任一步失败都不改变磁盘上的既有技能）
  中心详情取权威 versionId/sha256/sizeBytes/技能名集合
  → 代取 Access Token 下载 versions/{id}/download 到 .part，强制 size+SHA-256
  → 解 .dshskill（解压前拒绝路径逃逸/绝对路径/盘符/反斜杠/`..`/控制字符/重复路径/符号链接/ZIP64/加密/未知压缩方法，解压中执行 50MiB/200MiB/1万条目/256KiB 上限）
  → 包契约与详情逐项对齐（manifest.id、技能名集合）
  → 落点冲突预检（同名技能目录一律不覆盖）
  → 解到 <dshHome>/enterprise/skill-staging/<uuid>
  → 逐个原子改名进官方 user-dsh 根 <dshHome>/skills/<name>/
  → 原子写 <dshHome>/enterprise/skill-installs/installed.json
```

四条边界：**安装＝落盘，绝不执行包内任何内容**（`scripts/` 由用户自己的 Agent 会话决定是否执行）；落点就是官方 `dsh-skill-filesystem` 的 rank 400 根（`resolveDshHome` 的 `显式 → $DSH_HOME → ~/.dsh` 优先级），watcher 深度 1 直发现，**无需重启**；下载内核复用 `plugin-distribution` 的 `downloadVerifiedArtifact`（与受管插件同一份 `.part` + 内容寻址 + 原子改名纪律，不另写一份落盘逻辑）；同 sha256 幂等、状态文件损坏 fail-closed、失败回滚本次已改名的目录。

**官方能力核对结论（二期重核 0.2.0-rc.2）**：官方没有技能安装 RPC——`@deepseek-ai/dsh-plugin-manager` 只提供 `installBundle`/`removeBundle`（pnpm 装 npm 包，不是技能），技能的唯一官方能力面是 `dsh-skill-filesystem` 的「发现契约」。因此 Host 侧最小落盘不违背「复用官方」，前提是只写它承认的形状；`dsh plugin add <tgz>` 与官方 Web UI 安装则确实是同一条 pnpm 路径（`runPluginCommand` / `PluginManager.installBundle`）。

## [S3] Out of Scope

- 员工投稿与审核队列
- 一键落盘调和器（Host 侧下载+SHA256 校验+写入 `~/.dsh/skills`）与设备技能库存上报
- `.dshskill` Ed25519 签名与信任根
- 公开互联网广场、SEO、匿名下载
- DEPT/部门可见范围、下载量/星级排序
- 管理端「下载包」operation（契约无 admin download；控制台只有 Cookie 会话，调 runtime 下载面必然 401/403）
- 修改官方技能加载器、`skill-filesystem` 发现规则或 `dsh-preset` 格式
- 把技能嵌入插件 tgz 或 `.dshpreset` 反向分发

## Tasks

- [x] T1: `paths/skill.yaml` + `components/skill.yaml` + 根协议 path/schema/错误码/fixture 登记并生成 contracts — acceptance: 管理 5 + runtime 3 operation 可生成；错误码进封闭目录；fixture 通过严格 Zod（`9/9`）
- [x] T2: Flyway `V35` 建三表、唯一索引、`ent:skill` F 型权限行并扩展审计 action 白名单至 45 — acceptance: 静态核验菜单 ID 无冲突、F 型权限码 25 个与 RBAC 期望一致、审计 action 只增不减（真实迁移待 Docker）
- [x] T3: Server `skill` 纵向模块：验包（含 SKILL.md frontmatter）、CAS 制品、发布/退休、assignments batch、runtime 列表/详情/下载授权 — acceptance: `SkillArtifactInspectorTest` `8/8`（★**该计数有误**：沿革与实测见上方 Verification）、`AuditMetadataPolicyTest` `2/2`、`mvn compile` 通过
- [x] T4: 控制台 `/skills` 页 + 路由 + 上传/详情/可见范围 — acceptance: `tsc` 零诊断、Vitest 79/79（含技能 11）
- [x] T5: 员工端「技能」tab + 复制装配指令（不自动落盘） — acceptance: 见员工端验证
- [x] T6: GEB 三层文档回环（root CLAUDE.md、各 L2 成员清单、L3 头部）与门禁修正（`RbacSeedTest` 预存重复行缺陷）
