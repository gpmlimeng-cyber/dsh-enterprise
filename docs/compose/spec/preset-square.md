---
feature: preset-square
status: delivered
updated: 2026-09-16
branch: feat/preset-square-design
commits: 2e09934..HEAD
---

# DSH Enterprise 配方广场（Preset Square）

## Report

**What was built** — 企业控制面私有 `.dshpreset` 目录：管理员在 `/presets` 上传验包、发布/退休并原子替换 ALL/USER 可见范围；员工在设置「配方」tab 浏览并复制 Desktop 导入指令（不自动 import）。包格式对齐 Desktop `dsh-preset` v1，下载每次重算可见性，退休只停新下载。

**Verification** — console `tsc` + Vitest `61/61` PASS；`PresetArtifactInspectorTest` `4/4`；`AuditMetadataPolicyTest` `2/2`；`RbacSeedTest` `3/3`；`EnterpriseMigrationTest` `8/8`（V30 空库与 legacy 接管）；`@owndsh/platform-client` `29/29`；`@owndsh/ui` typecheck + `19/19` PASS。未跑真实 Desktop loopback E2E（属人工验收）。

**Journey log** — 一期刻意不做一键安装，避免把 `.dshpreset` 塞进 plugin-distribution 状态机；员工发现面必须走 Host 本地 API（Client 不持有 Access Token）；`EnterpriseErrorCode` 与 `x-enterprise-error-statuses` 必须同步扩枚举，否则 contracts generate 失败。

## [S1] Problem

DSH Desktop 的公共配方广场（`https://dshdesktop.com/preset/`）让社区交换 `.dshpreset` 工作配方；员工在本机经 loopback `agent-preset.import` 导入。DSH Enterprise 作为私有化控制面，目前只有受管插件分发，没有企业批准的 Agent Preset 目录：

1. 企业无法把已评审的自定义 Agent Preset（角色/skill/工具组合）集中发布给员工，员工只能依赖外网公共广场或手拷文件。
2. 自定义 Preset 是**可执行配置**（可加载插件、暴露工具、以 Agent 权限读文件）。公共广场的「信任来源=社区」不适用于企业；需要管理员独占发布与可见范围裁决。
3. 控制台现有 `/plugins` 只治理 npm/tgz 插件制品；`.dshpreset` 是另一种包格式与安装语义，不能塞进同一张 assignment/库存状态机。

目标：在企业控制面建立与 Desktop `dsh-preset` v1 同构的私有配方目录——管理员上传/发布/限定可见范围，员工在已登录的 Desktop 设置内浏览并复制导入指令（一期），后续再接一键安装。

## [S2] Design

### S2.1 冻结决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 配方本体 | 企业目录托管 Desktop `format=dsh-preset` `version=1` 的 `.dshpreset` ZIP | 不发明第二套包格式；导入链路与 Desktop 官方契约对齐 |
| 贡献模型 | 仅 `plugin_admin` / `enterprise_admin` 上传与发布 | 与插件市场同一治理心智；可执行配置必须过审 |
| 员工导入 | **一期**复制导入指令 + 授权下载；**二期**企业插件一键安装 | 一期不扩展 `plugin-distribution` 状态机，降低供应链改动面 |
| 控制台 | 独立产品纵向 `/presets`（不是 `/plugins` 子页） | 两种制品、两种权限语义、两种员工消费方式 |
| 员工发现面 | `owndsh-plugin`「DSH Enterprise 设置 → 配方」tab | 员工无控制台角色；复用既有插件市场设置 tab 模式 |

### S2.2 包契约（只读兼容，不修改 Desktop）

对齐 [dsh-desktop `docs/preset-packages.md`](https://github.com/dataelement/dsh-desktop/blob/main/docs/preset-packages.md)：

```text
manifest.json
preset/
├── agent.cordis.yml
├── preset.yml            # optional
└── skills, plugins, and other preset-owned assets
```

`manifest.json` 必填：`format=dsh-preset`、`version=1`、`id`、`name`、`sourceDshVersion`。  
`description`、`exportedAt` 可选。

服务端验包拒绝：绝对路径、`..` 穿越、反斜杠路径、缺失 `preset/agent.cordis.yml`、非 `dsh-preset`/非 v1 manifest、超过大小上限、非法 ZIP entry（符号链接等）。  
服务端**不**解析/执行 Cordis YAML，只做结构与元数据校验；深度语义由 Desktop 导入器的 Harness preset scanner 负责。

默认上限：单包解压前 ≤ 50 MiB，entry 数 ≤ 10 000；与插件包量级一致。超限返回 `413`。

### S2.3 数据模型（Flyway `V30`）

不复用 `ent_plugin_*` 表；新建三表 + 权限码。无 DEPT 可见范围（产品已移除部门资源）。

**`ent_preset_package`**

| 列 | 约束 |
|---|---|
| `id` | bigint PK |
| `tenant_id` | varchar(20) not null |
| `preset_id` | varchar(128) not null，来自 manifest `id`，tenant 内唯一 |
| `display_name` | varchar(120) not null，来自 manifest `name` |
| `description` | text，可空，来自 manifest `description` |
| `status` | `ACTIVE` \| `DISABLED` |
| `revision` | bigint ≥ 0，CAS |

**`ent_preset_version`**

| 列 | 约束 |
|---|---|
| `id` | bigint PK |
| `tenant_id` | varchar(20) |
| `package_id` | FK → package |
| `source_dsh_version` | varchar(64)，manifest `sourceDshVersion` |
| `artifact_ref` | varchar(1024)，CAS 相对引用 |
| `size_bytes` | bigint > 0 |
| `sha256` | `^[0-9a-f]{64}$`，tenant 内唯一 |
| `status` | `VALIDATED` → `PUBLISHED` → `RETIRED`（上传成功即 `VALIDATED`，无独立 UPLOADED 停留态） |
| `created_by` | FK → `sys_user` |
| `created_at` | timestamptz |
| `revision` | bigint ≥ 0 |

`uq (package_id, source_dsh_version)`：同一 Desktop 基线版本每包只保留一条；重复上传同 sha256 幂等返回既有行。

**`ent_preset_assignment`**

| 列 | 约束 |
|---|---|
| `id` | bigint PK |
| `tenant_id` | varchar(20) |
| `package_id` | FK |
| `subject_type` | `ALL` \| `USER` |
| `subject_id` | ALL 时为 null；USER 时为成员 ID |
| `status` | `ACTIVE` \| `DISABLED` |
| `revision` | bigint ≥ 0 |

唯一索引：每 package 至多一条 `ALL`；每 `(package, USER, subject)` 至多一条。

**权限码**（写入角色-权限关联，授予 `enterprise_admin` 与 `plugin_admin`）

| code | 读/写 |
|---|---|
| `ent:preset:read` | 管理列表/详情/库存级元数据 |
| `ent:preset:write` | 上传、发布、退休、可见范围批量替换 |

员工 runtime API 使用登录用户 + ACTIVE 设备既有门禁，不新增员工权限码。

### S2.4 制品存储

- 与插件一致：内容按 SHA-256 寻址落盘（`ent_artifact` 既有约定或 preset 专用目录），数据库只存 `artifact_ref` + `sha256`。
- 一期**不**强制 Ed25519 签名；完整性始终校验 size + sha256。签名策略与 `ENT_PLUGIN_SIGNING_ENABLED` 对齐作为后续开放项，写入 Out of Scope。
- 上传 multipart：`artifact`（二进制 `.dshpreset`）+ `metadata`（application/json，可选覆盖显示名/描述；缺省从 manifest 读取）。

### S2.5 协议（OpenAPI 分片 `paths/preset.yaml`）

**管理端**（Cookie，`ent:preset:*`）

| Method | Path | 语义 |
|---|---|---|
| GET | `/enterprise/admin/v1/presets` | cursor 列表；每项含 package + 最新 PUBLISHED/VALIDATED 版本摘要 + 可见范围集合 |
| POST | `/enterprise/admin/v1/presets/versions` | multipart 上传；幂等键；返回 `VALIDATED` 版本 |
| POST | `/enterprise/admin/v1/presets/versions/{presetVersionId}/actions/publish` | 发布；`If-Match: revision` |
| POST | `/enterprise/admin/v1/presets/versions/{presetVersionId}/actions/retire` | 退休；停止新下载授权 |
| POST | `/enterprise/admin/v1/presets/{presetPackageId}/assignments/batch` | **全量原子替换**可见范围（与插件 batch 同语义，禁止增量补丁误删） |

**Runtime**（Bearer，员工插件）

| Method | Path | 语义 |
|---|---|---|
| GET | `/enterprise/api/v1/presets` | 当前用户解析后的有效可见已发布配方；`sort=newest` |
| GET | `/enterprise/api/v1/presets/{presetPackageId}` | 详情：manifest 元数据、最新已发布版本、可见性已解析、`sourceDshVersion`、`sizeBytes` |
| GET | `/enterprise/api/v1/presets/versions/{presetVersionId}/download` | 逐请求重算可见性后流式下载；支持单 Range；RETIRED 或不可见 → 403 |

**错误码**（稳定字符串，进入根协议 error 目录）

| code | HTTP | 场景 |
|---|---|---|
| `ENT_PRESET_INVALID_PACKAGE` | 400 | manifest/结构不合法 |
| `ENT_PRESET_TOO_LARGE` | 413 | 超包体或 entry 上限 |
| `ENT_PRESET_NOT_PUBLISHED` | 403/409 | 未发布或已退休仍请求下载/发布态非法 |
| `ENT_PRESET_VISIBILITY_DENIED` | 403 | 下载/列表裁决不可见 |

下载路径**每次**重算 assignment，与插件 `RuntimePluginDownload` 相同，不缓存授权。

### S2.6 控制台 `/presets`

- `product-routes.ts` 增加第六项：`{ to: '/presets', label: '配方', icon: BookOpen, allowedRoles: ['enterprise_admin', 'plugin_admin'] }`。
- 页面信息架构对齐 `/plugins` 工作台，但卡片/表格字段改为配方语义：
  - 列表：名称、presetId、最新 sourceDshVersion、状态、可见范围（ALL / N 人）、更新时间、操作（发布/退休/编辑范围/下载包）。
  - 上传抽屉：选择 `.dshpreset`，显示服务端解析出的 manifest 预览，确认后写入。
  - 详情：manifest 元数据、版本历史、可见范围编辑、安全提示（可执行配置、需来自可信管理员）。
- 无「员工投稿队列」、无公开 SEO 页、无下载量排行（企业目录按更新时间排序；下载计数可作为审计 metadata，不做产品排序键）。

### S2.7 员工侧设置 tab（`owndsh-plugin`）

- 在既有「插件」tab 旁增加「配方」tab（`plugin/packages/ui`），数据来自 runtime `/enterprise/api/v1/presets`。
- 卡片展示 name / description / sourceDshVersion / size；详情弹窗含安全提示。
- 一期唯一主动作：**复制导入指令**（不自动下载、不自动 import）。指令文案固定为：

```text
请先读取并遵循 Preset Square Skill，然后从 DSH Enterprise 下载并导入下面这个 Preset。
读取详情并检查安全信息后，在实际下载和导入前向我确认。
Preset：{downloadUrl}
名称：{displayName}
预设 ID：{presetId}
建议目标标识：{presetId}-ent   # 本地已有同 id 时 Desktop 要求新 id，避免覆盖
```

`downloadUrl` 形如 `{ENT_PUBLIC_BASE_URL}/enterprise/api/v1/presets/versions/{versionId}/download`。  
Agent 侧约定：用企业已登录 Access Token 下载二进制，再调用 Desktop loopback `POST $DSH_WEB_URL/api/agent-preset.import?agentPreset=<targetId>&install=1`，**禁止**把 ZIP base64 进模型上下文或手解压进 preset root。该约定写入员工 tab 旁的静态说明，不新增第二套 Skill 包。

### S2.8 审计

新增封闭 action（进入既有 action 白名单与 metadata DTO）：

| action | metadata |
|---|---|
| `PRESET_VERSION_UPLOADED` | packageId, versionId, presetId, sourceDshVersion, sha256, sizeBytes |
| `PRESET_VERSION_PUBLISHED` | packageId, versionId, revision |
| `PRESET_VERSION_RETIRED` | packageId, versionId, revision |
| `PRESET_ASSIGNMENTS_REPLACED` | packageId, all:boolean, userCount |
| `PRESET_DOWNLOAD_AUTHORIZED` | versionId, deviceId, memberId（成功授权时；与插件下载审计粒度一致，避免洪泛可沿用既有限频） |

不记录包内 YAML/skill 正文。

### S2.9 非功能与边界

- 多租户：所有表与查询强制 `tenant_id`。
- 上传者身份：`created_by` = 当前管理会话用户。
- 退休后：已下载到员工本机的 Preset **不**远程撤回（Desktop 本地文件语义）；只停止新的授权下载。与插件「删除范围或退休只停止新安装」一致。
- 不实现第二套包管理器、不 fork Desktop UI、不把配方与插件 assignment 混表。

## [S3] Out of Scope

- 企业插件一键安装 / 回滚 / 设备 Preset 库存上报（二期）
- 员工投稿与审核队列
- `.dshpreset` Ed25519 签名与信任根
- 公开互联网广场、SEO、匿名下载
- DEPT/部门可见范围
- 以下载量/星级排序或评论
- 修改 DSH Desktop 导入器或 `dsh-preset` format 版本
- 控制台员工角色进入 `/presets`
- 把 Preset 嵌入插件 tgz 或反向把插件塞进 Preset 包的分发
- Session/会话内自动应用配方

## Tasks

- [x] T1: OpenAPI 增加 `paths/preset.yaml` 与 schema/error，登记根协议并生成 contracts — acceptance: 管理 5 + runtime 3 operation 可生成；错误码进入封闭目录；fixture 至少覆盖 version success 与 invalid package (covers: S2.5)
- [x] T2: Flyway `V30` 建三表、唯一索引与 `ent:preset:read/write` 角色授权 — acceptance: 空库迁移成功；`plugin_admin`/`enterprise_admin` 含新权限；越权角色不可写 (covers: S2.3)
- [x] T3: Server `preset` 纵向模块：验包、CAS 制品、发布/退休、assignments batch、runtime 列表/详情/下载授权 — acceptance: 非法包 400；同 sha256 幂等；RETIRED 下载 403；USER 可见性逐请求裁决；Testcontainers 事务通过 (covers: S2.2, S2.4, S2.5, S2.8)
- [x] T4: 审计 action 白名单与 metadata DTO 接入 preset 五类事件 — acceptance: 上传/发布/退休/范围替换/授权下载各产生一条可查询审计且无包内正文 (covers: S2.8)
- [x] T5: 控制台 `/presets` 纵向：product-routes、上传预览、列表/详情/可见范围/发布退休 — acceptance: `plugin_admin` 可完成上传→发布→ALL/USER 范围；`enterprise_admin` 并集可见；无 `ent:preset:write` 时写操作被拒；`pnpm check` 通过 (covers: S2.6)
- [x] T6: 员工插件设置「配方」tab：runtime 列表、详情、安全提示、复制导入指令 — acceptance: 无可见配方时空态；有配方时可复制含 downloadUrl 的指令；不发出 loopback import 请求 (covers: S2.7)
- [x] T7: 文档回环：`docs/v1-product-feature-catalog.md`、根 `CLAUDE.md`、console/plugin/server/contracts 相关 L2 — acceptance: 功能地图出现配方广场且状态为待实现/已实现之一；L2 成员清单含新路径 (covers: S2.1, S2.6, S2.7)
