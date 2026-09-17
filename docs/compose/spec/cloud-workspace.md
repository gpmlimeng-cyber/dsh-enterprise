---
feature: cloud-workspace
status: in-progress
updated: 2026-09-17
branch: feat/cloud-workspace
commits: f4268ea..28d00bf
---

# 云端工作空间（Cloud Workspace）最小同步闭环

## Report

**What was built** — 云端工作空间最小同步闭环，让团队共享同一项目目录。服务端新增 `com.owndsh.enterprise.workspace` 纵向：Flyway `V31` 建立云端项目与成员两表，`repo-root` 下按 `projects/{id}.git` 持有 bare Git 仓库；员工经 `/enterprise/api/v1/cloud-projects` 自助创建项目（创建者自动 OWNER）并按 OWNER 权限加成员，文件真源完全交给 Git。传输走同一企业 HTTP 面的 Smart HTTP（JGit Upload/ReceivePack），`GitBasicAuthFilter` 只匹配 `/enterprise/api/v1/git/**`，把 HTTP Basic 的 password（企业 Access Token）改写为 Bearer 语义交给既有设备上下文解析，用户名被忽略；`ReceivePack` 保持 JGit 默认拒绝非 fast-forward。

创建流程按「先初始化 bare 仓库（HEAD 指向 defaultBranch）→ 单事务写入项目行、OWNER 成员与审计 → 事务失败则删除刚建仓库」实现，配套三类审计 action（CLOUD_PROJECT_CREATED / MEMBER_ADDED / MEMBER_REMOVED）在 Java 枚举、V31 check 约束与 `AuditMetadataPolicyTest` 三处同构。bootstrap 新增 `cloudWorkspace.enabled`（默认 true）作为客户端开关。

客户端新增 `@dshent/cloud-workspace`：本地映射 JSON（projectId→path，0600 原子写）、系统 `git` 经 `GIT_ASKPASS` 注入内存 Access Token（用户名固定 `oauth2`，临时目录 0700 且操作后删除，Token 不进入映射文件或 Client DTO）。platform-client 增加 `/cloud-projects*` 本地路由与错误状态注册，bundle 装配 Host 端口，UI 在「DSH Enterprise 设置 → 云端项目」提供创建、映射本地根目录、pull/commit/push 与成员添加。

**Verification**

| 门禁 | 结果 |
|---|---|
| server 企业模块定向（CloudWorkspaceService/GitSmartHttpService/GitSmartHttpController/GitBasicAuthFilter/BootstrapViewSessionPolicy/T08/AuditMetadataPolicy/T19） | **31/31 PASS** |
| server `EnterpriseSafetyDefaultsTest`（真实加载 application.yml） | **4/4 PASS** |
| server `EnterpriseContractSchemaTest` | FAIL 1 = `fixtures/usage-analytics-success.json`，**PRE-EXISTING**（未改动的 main worktree 同样失败；断言在首个失败处中止，另有 3 个 preset fixture 不一致亦为基线既有） |
| plugin `pnpm -r run build` / contracts `check:generated` | PASS（无生成漂移） |
| plugin 全量 vitest | 除上述基线 fixture 外全绿：cloud-workspace 17/17、platform-client 32/32、ui 32/32（S4 后）、session-sync 28/28（单文件运行；全量并发时偶发抖动）、llm-gateway 7/7、plugin-distribution 27/27、ent-admin-cli 3/3、bundle 3/3 |
| plugin `workspace.test.mjs` | **4/4 PASS** |
| deploy `deployment.test.mjs` | 11/14 = 与 main 基线一致（3 项环境相关失败） |
| 客户端非快进映射 | 用真实 git 输出验证 `rejected`/`fetch first` 命中映射正则 |

**Journey log**

1. 首轮实现经独立评审实测复现 6 项 CRITICAL：重复 YAML 键导致 Spring 启动失败、cloneUrl 带 `.git` 无法绑定 `@PathVariable long`（400）、`git clone --branch` 对空仓库必然失败、JGit `initBare` 的 HEAD 仍是 master、合约 id 类型与序列化不一致、`create()` 非原子且无审计。全部修复后二轮评审确认闭环。
2. 二轮评审又抓出修复自身引入的回归：新增数据卷未同步 T21 部署门禁与 backup/restore，等于让团队 Git 真源逃出备份契约；另有补偿路径遗留死代码。已一并修复并复验。
3. 补偿顺序被推翻一次：最初选择「先写库、失败再删行」，但审计事件是只追加账本，删行会留下一条成功创建记录。改为「先建仓、后事务」，成功审计只随提交出现。
4. 两个 fixture 门禁都在首个失败处中止，因此「只剩一个失败」的说法不成立；基线本就红，跨语言枚举同步（合约 audit 34 vs Java 39）没有任何门禁覆盖，本轮把 5 个 `PRESET_*` 补齐。
5. 本地路由沿用既有 `kind: 'prefix'` + 尾斜杠约定；platform-client 测试夹具原先要求 `path/` 双斜杠匹配，是夹具偏差而非实现缺陷，已放宽为 `startsWith`。


## [S1] Problem

客户端目前只支持**本地项目目录**：员工在 DSH Desktop / Harness 里选本地 cwd 做会话。团队协作同一项目时，资料分散在各人机器上，无法共享可合并的工作区真源。需要：发起人在 DSH 创建**云端项目**（资料存企业服务器），本地映射标准 Git 工作树；成员用自己客户端 pull / commit / push，经 Git 合并语义协同。

## [S2] Design

### S2.1 冻结决策（用户已确认）

| 决策 | 选择 |
|---|---|
| 首期范围 | **最小可用同步闭环**：创建云端项目 → 服务端 bare 仓库 → 成员本地映射 → pull/commit/push；管理台项目页后置 |
| 传输/存储 | 服务端 **bare Git + Smart HTTP**（JGit），挂在既有企业 HTTP 面 |
| 客户端入口 | 企业插件：新包 `@dshent/cloud-workspace` +「DSH Enterprise 设置 → 云端项目」 |
| Git 鉴权 | HTTP Basic：密码 = 企业 **Access Token**（Host 内存 token 经 credential helper 注入 git 子进程；服务端把 Basic password 当 Sa-Token Bearer） |
| 并发写入 | 经典 **非 fast-forward 拒绝**；客户端提示先 pull/merge 再 push |
| 创建/发现 | 登录员工在插件内**自助创建**，自动成为 OWNER；列表仅返回本人为成员的项目 |
| 本地映射 | 用户选根目录，自动建 `<root>/<project-slug>/`；插件本地映射元数据：projectId → path |

### S2.2 服务端

新纵向 `com.owndsh.enterprise.workspace`（domain / application / persistence / web + `EnterpriseWorkspaceConfiguration`）。

**配置**

- `enterprise.cloud-workspace.enabled` 默认 **true**（本特性即本轮产品面；可用部署关闭）
- `enterprise.cloud-workspace.repo-root` 必填（与插件 `artifact-root` 同风格）：磁盘上存放 `projects/<projectId>.git` bare 仓库

**表（Flyway `V31__enterprise_cloud_workspace.sql`）**

- `enterprise_cloud_project`：`id BIGINT PK`，`tenant_id`，`slug UNIQUE`，`name`，`description`，`default_branch`（默认 `main`），`created_by`，`created_at`，`updated_at`，`status`（ACTIVE）
- `enterprise_cloud_project_member`：`project_id`，`user_id`，`role`（OWNER|MEMBER），`created_at`，`PK(project_id,user_id)`

**Runtime JSON API**（前缀 `/enterprise/api/v1/cloud-projects`，`DeviceRequestContextResolver` + `EnterpriseResponse`）

| 方法 | 路径 | 行为 |
|---|---|---|
| POST | `/` | body `{name, description?}`；slug 规范化 + 冲突 409；**先初始化 bare 仓库（HEAD→defaultBranch），再在同一事务写 project+OWNER member 与审计**；事务失败则删除刚建仓库，成功审计只随提交出现 |
| GET | `/` | 当前用户作为成员的项目列表（id/slug/name/role/cloneUrl/defaultBranch） |
| GET | `/{projectId}` | 成员可见才返回 |
| POST | `/{projectId}/members` | OWNER 添加成员 `{userId}`（本企业用户）；幂等；审计 CLOUD_PROJECT_MEMBER_ADDED |
| DELETE | `/{projectId}/members/{userId}` | OWNER 移除；禁止移除最后一个 OWNER；审计 CLOUD_PROJECT_MEMBER_REMOVED |

**Git Smart HTTP**（`/enterprise/api/v1/git/{projectId}/**`；cloneUrl 不带 `.git` 后缀，与 `@PathVariable long` 兼容）

- `GET .../info/refs?service=git-upload-pack|git-receive-pack`
- `POST .../git-upload-pack`、`POST .../git-receive-pack`
- 实现：JGit `UploadPack` / `ReceivePack` 流式对接 servlet 流；bare 目录来自 `repo-root/projects/{id}.git`
- **非 fast-forward**：ReceivePack 默认拒绝（不设 `allowNonFastForwards`）
- 鉴权：`GitBasicAuthFilter` 仅匹配 `/enterprise/api/v1/git/**`；解析 `Authorization: Basic`，将 password 写入后续 Bearer 语义（覆写请求头为 `Bearer <password>`）；随后与 Runtime 相同解析会话。非成员 403，无/坏凭据 401 + `WWW-Authenticate: Basic realm="dshent-git"`
- 仓库名/路径参数只允许数据库中的 projectId（long），禁止任意路径拼接

**Bootstrap**

- `BootstrapView` 增加 `cloudWorkspace: { enabled }`（来自 properties；默认 true）。插件 UI 以该 flag 决定是否展示「云端项目」tab（与 sessionPolicy 同模式）。

**依赖**

- `owndsh-enterprise` pom 增加 `org.eclipse.jgit:org.eclipse.jgit`（仅企业模块）

**明确不做（服务端）**

- 管理台 Console 项目 CRUD、审批流、web 编辑器
- LFS、submodule 特殊处理、hooks 自定义 shell
- SSH 端口、独立 git 用户、Gitea/GitLab 嵌入

### S2.3 合约

- `contracts/paths/cloud-project.yaml` + `components/cloud-project.yaml`（或并入现有命名约定）
- bootstrap 增加 `cloudWorkspace` 对象
- fixtures：create/list/get 与 unauthorized 样本；`generated` 重生成

### S2.4 客户端（plugin workspace）

**新包** `plugin/packages/cloud-workspace` → `@dshent/cloud-workspace`（private，结构对齐 session-sync：ports 注入、零 Harness 真源依赖）。

职责：

1. **CloudWorkspaceService**：调 platform-client 本地 API / enterprise HTTP（list/create/addMember）
2. **GitOps**：`child_process` 调系统 `git`（PATH）；`GIT_ASKPASS` 临时脚本从 Host 拉取当前 Access Token（不写磁盘明文仓库外路径；脚本 self-delete）
3. **MappingStore**：JSON 持久化 `projectId → {path, slug, lastSyncedAt}`（与 session cursor-store 同思路的原子写）
4. **Local port**：注入 platform-client，注册路由（见下）
5. **host-bridge**：platform READY + `bootstrap.cloudWorkspace.enabled` 才 mount

**Local API**（挂 `/enterprise/api/v1/local/cloud-projects*`，随既有 local-api 注册）

| 路由 | 行为 |
|---|---|
| GET `/local/cloud-projects` | 远端列表 + 本地映射状态（mapped/path/dirty?） |
| POST `/local/cloud-projects` | `{name, description?}` 创建，返回项目 |
| POST `/local/cloud-projects/{id}/clone` | `{rootDir}` 绝对路径；生成 slug 子目录；**`git clone`（不带 `--branch`，兼容空仓库）**；写映射；失败清理 |
| POST `/local/cloud-projects/{id}/pull` | mapped 才允许；`git pull --ff-only` 失败则报告需手动合并 |
| POST `/local/cloud-projects/{id}/commit` | `{message}`；有变更则 `add -A` + commit |
| POST `/local/cloud-projects/{id}/push` | `git push`；非 FF 把 stderr 映射为 `ENT_GIT_NON_FAST_FORWARD` |
| POST `/local/cloud-projects/{id}/members` | OWNER 加成员 `{userId}` |
| GET `/local/cloud-projects/{id}/status` | branch、dirty、last commit subject |

**Git 凭据（Access Token）**

- Host 生成一次性 `GIT_ASKPASS` 脚本：向本地 platform `GET /status` 侧信道不可行（token 不出 Host API）。改为：GitOps 通过注入的 `AccessTokenProvider` 接口在 Host 内取 token，写入 askpass 脚本内存环境不可持久化场景用临时 0700 文件 + 操作结束删除。
- username 固定 `oauth2`（askpass 按提示词分流回答用户名/密码；服务端忽略用户名，只认 password=token）。
- **禁止**把 Access Token 打进 UI 日志、commit message、映射 JSON。

**UI**（`@dshent/ui`）

- `account-view.tsx` tab 行：`cloudWorkspaceEnabled` 时显示「云端项目」
- 新组件 `cloud-projects-view.tsx`：列表、创建表单、clone（选根目录文本输入/系统对话框若 Host 提供否则手动路径）、pull/commit/push、成员（简版 userId 添加）
- local-api 客户端方法与 store 增量

**bundle**

- 注入 cloud-workspace host port；`workspace.test.mjs` 正式包列表加入 `cloud-workspace`

### S2.5 错误契约

| 场景 | HTTP/码 |
|---|---|
| 未登录/坏 token | 401 `ENT_AUTH_REQUIRED` |
| 非成员 git 或 JSON | 403 `ENT_WORKSPACE_FORBIDDEN` |
| slug 冲突 | 409 `ENT_WORKSPACE_SLUG_CONFLICT` |
| 非 FF push | 客户端 `ENT_GIT_NON_FAST_FORWARD`（409，已用真实 git 输出验证匹配） |
| 无映射 | 400 `ENT_WORKSPACE_NOT_MAPPED` |
| 系统无 git | 500 `ENT_GIT_UNAVAILABLE` |
| enabled=false | 403 `ENT_WORKSPACE_DISABLED` |

### S2.6 测试边界

| 层 | 测试 |
|---|---|
| Server unit | slug 规范化、成员权限、properties 默认 |
| Server integration（或 MockMvc） | create/list/get、member add、git Basic 401、clone 语义用临时 repo + JGit 直推（若无全栈 Testcontainers 成本，则 JGit 接受 ReceivePack 单测拒非 FF） |
| contracts | fixtures 校验 + 生成无漂移 |
| cloud-workspace package | vitest：slug、mapping store、git 命令行构造、错误映射；无真实 git 也可 mock runner |
| bundle/workspace | build、bundle.spec（若需）、workspace.test.mjs 5 包 |

### S2.7 评审修复（2026-09-17）

首轮实现经独立评审实测复现 6 项 CRITICAL，已修复并复验：

| 编号 | 缺陷 | 修复 |
|---|---|---|
| C1 | `application.yml` 重复 `cloud-workspace:` 键导致 Spring 启动失败，并吞掉 `enterprise.session.retention-*` | 合并为单块并恢复 session retention 两行 |
| C2 | cloneUrl 带 `.git` 后缀无法绑定 `@PathVariable long`（实测 400） | cloneUrl 去掉 `.git` |
| C3 | `git clone --branch` 对空仓库必然失败（实测 exit 128） | 普通 clone，分支在首次提交后自然出现 |
| C4 | `init.defaultBranch` 写在 init 之后不移动 HEAD（实测仍为 master） | `setInitialBranch` + `RefUpdate.link` |
| C5 | 合约 `CloudProjectId` 声明 integer 而服务端序列化字符串，Java fixture 门禁失败 | 改为字符串 schema，与仓库 snowflake-as-string 约定一致 |
| C6 | `create()` 非原子且无审计 | 先建仓、后事务写行+审计；事务失败清理仓库；新增三类审计 action 与 V31 白名单 |

同时修复 HIGH/MEDIUM：本地 API 错误状态注册表（H1）、成员加入的本地路由与 UI（H2）、评审期未提交的 L2 地图（H3）、Git 控制器/服务与 GitOps 测试（H4）、slug 长度边界（M1）、部署卷（M2）、客户端透传服务端错误码（M3）、客户端 slug 校验（M4）、askpass 用户名（M5）、死代码与文档漂移（M6）、重复插入行（M7）。

## [S3] Out of Scope

- 管理端 Console / 审计深度页 / 通知 / 活动流 / 配额绑定
- Desktop 独立仓库 UI、跨设备映射自动迁移
- SSH git、服务端自动 merge、web IDE
- S4 追加：**原生工作区登记路径**的会话报告只表示「已发起」（见 S4.4.3/S4.7 D2）
- 会话与云端项目的**强制**绑定：原生路径下由官方 `startSession` 进入该工作区会话（见 S4），但用户仍可对任意本地目录开会话，服务端不校验会话与项目的对应关系
- 大文件 LFS、repo GC 运维面

## [S4] 增补：与创建本地项目一致的客户端体验（2026-09-17）

### S4.1 问题

首期把云端项目入口放在「DSH Enterprise 设置 → 云端项目」，且流程是「先在设置页建项目 → 再回来填本地根目录 → clone」。这与创建本地项目（官方工作区流程）的体验差距是：入口在设置页、两段式、目录靠手输。

### S4.2 参考实现与官方扩展面（已核实）

参考 `ZhangFengshun/dsh-remote-ssh`（VSCode Remote-SSH 类插件）：它把远程目录做成**本地镜像目录 + 标记文件 + Host 侧 fs API 拦截**，客户端视角是普通工作区；其入口依赖第三方侧栏插件 `dsh-better-sidebar` 的扩展面，自身不占用官方原生选择器。

本仓库可用的正门是官方客户端服务 `ctx.workspaces`（`dsh-client-runtime` 提供）：

| 能力 | 用途 |
|---|---|
| `pickDirectory()` | 打开 Host 原生目录选择器——**与本地工作区流程同一个对话框** |
| `create({ path })` | 把一个已存在路径登记为**原生工作区**（幂等） |
| `startSession(workspaceId)` | 直接进入该工作区会话 |

官方「Add workspace…」菜单位于 `ui-workspace` 声明、`kind: 'single'` 的 `sidebar.workspaces.directoryFlow` / `conversation.hero.workspace.directoryFlow` 空位，且**已被官方目录选择器占用**。因此把云端项目条目并入该菜单等价于接管官方选择器（影响所有本地工作区添加）。

### S4.3 冻结决策（本轮）

| 决策 | 选择 |
|---|---|
| 落地方式 | **登记为原生工作区**：官方 `pickDirectory()` 选目录 → clone 到 `<所选>/<slug>` → `create({path})` 登记 → `startSession()` 进会话 |
| 入口位置 | 维持插件自有入口（设置页 tab）；**不接管**官方目录选择器 |
| 依赖策略 | **可选接入**：`readOfficialWorkspaces(ctx)` 从 `ctx.get('workspaces')` 安全读取；任一必需能力缺失即返回 undefined，视图退回手动填根目录。不把 `@deepseek-ai/dsh-client-runtime` 写进 `dsh.client.inject`，维持「不依赖可能退役的 client-runtime row」既有约束 |
| 映射语义 | 不变：仍为 `projectId → <root>/<slug>`，与 S2.1 冻结决策一致 |
| 取消语义 | 用户在选择器取消 → `ENT_WORKSPACE_PICK_CANCELLED`，视图不报错、不 clone |

### S4.4 行为契约

1. 创建：表单提交 → `createCloudProject(name)` → 原生可用时紧接着 `openCloudProject(id)`（选目录、clone、登记、进会话），按钮文案为「创建并选择本地目录」。
2. 打开：列表行 —— 未映射且原生可用 → `openCloudProject(id)`（弹选择器）；已映射 → `openCloudProject(id, mapping.path)`（**不再弹选择器**，直接登记并进会话）；原生不可用 → 退回手动根目录 clone。
3. 会话只报告「已发起」：官方 `startSession` 返回 void 且自行吞掉失败，客户端无法确认会话是否真的打开，因此返回 `sessionRequested`（缺 `startSession` 或同步抛错为 false），UI 文案为「正在打开会话」而非「已进入」。映射与工作区登记在任一后续步骤失败时都保持有效。
4. 原生不可用时 `openCloudProject(id)`（无根目录入参）抛出 `ENT_LOCAL_UNAVAILABLE`，由视图呈现；`nativeWorkspacesAvailable` 为 false 时视图不渲染根目录输入以外的原生文案。

### S4.5 测试边界

| 层 | 断言 |
|---|---|
| `readOfficialWorkspaces` | ctx 缺失 / 服务缺失 / 能力不全 → undefined；完整服务 → pick/create 透传；`create` 返回无 id → 抛错 |
| `openCloudProject` | 取目录→clone→登记→进会话；取消不 clone；进会话失败保留映射；无原生时用显式根目录并返回 `workspaceId: null`；已映射时不弹选择器 |

### S4.6 明确不做

- 接管官方 `directoryFlow` 空位（等于替换官方目录选择器）
- 引入 `dsh-better-sidebar` 等第三方侧栏依赖
- 镜像目录 + fs API 拦截（云端项目已有真实 git 工作副本，无需该层）

### S4.7 评审修复（第二轮）

本轮增量经独立评审后修复：

| 编号 | 缺陷 | 修复 |
|---|---|---|
| D1 | 官方 `create()` 的标识字段被读成 `id`；官方契约名为 `workspaceId`（本机 0.1.0-rc.6 实证），对应版本上会导致登记后必然抛错 | 读取器同时接受 `workspaceId` 与 `id`，非空字符串方可；两侧字段名均有测试 |
| D2 | `enteredSession` 会撒谎：缺 `startSession` 时静默返回真；官方实现又自行吞错 | 端口新增 `requestSession()` 返回布尔；store 改为 `sessionRequested`；UI 文案降级为「正在打开会话」 |
| D3 | 创建后取消选目录 → 项目已建、无映射、列表不可见、名称被清空且无提示 | 创建后先刷新列表；取消时给出「项目已创建，尚未选择目录」提示并保留可重试路径 |
| D4 | 该编排是 store 中唯一没有中断守卫的方法 | 补 `connected()` 校验与每次 await 后的 abort 检查 |
| D5 | 失败路径跳过 `reload()`，列表停在旧事实 | `run()` 改为在 `finally` 中始终刷新 |
| D6 | 服务在 `apply` 时一次性捕获，cordis `get(strict=true)` 下启动次序不保证 | 改为按需读取（`createOfficialWorkspacesReader`） |
| D7 | 文档未随增量更新 | 本节、Report、commits 与 ui 计数同步 |

**未能在本机验证（需在锁定运行时上复核）**：锁定版本 0.1.5-rc.2 的 `ctx.workspaces` 真实形状。本机仅有 0.1.0-rc.6 的官方包，因此「`create` 返回字段名」与「`startSession` 是否抛错」两处只按 0.1.0-rc.6 实证并做了字段名容错；发布前须对锁定版本再核一次，检查点为该版本的 `dsh-client-runtime` 客户端契约里 `create` 的返回类型。

## Tasks

- [x] T1: 规格冻结与 GEB 路线 — acceptance: 本文件 status=in-progress 前与用户决策一致 (covers: S2.1)
- [x] T2: 服务端 workspace 纵向骨架 + V31 迁移 + properties/enabled — acceptance: 模块可编译；迁移 SQL 存在；默认 enabled=true 单测 (covers: S2.2)
- [x] T3: 项目 CRUD + 成员服务 + bare init — acceptance: POST/GET cloud-projects 与 members 服务逻辑单测/MockMvc 过；bare 目录生成 (covers: S2.2)
- [x] T4: Git Smart HTTP + Basic→Bearer 滤镜 + 非 FF 拒绝 — acceptance: JGit Upload/Receive 接线；无/错 token 401；非成员 403；ReceivePack 非 FF 拒绝单测 (covers: S2.2, S2.5)
- [x] T5: OpenAPI paths/components/fixtures + 生成无漂移 — acceptance: contracts 校验通过 (covers: S2.3)
- [x] T6: bootstrap cloudWorkspace 声明 — acceptance: BootstrapView 含 cloudWorkspace.enabled 默认 true (covers: S2.2)
- [x] T7: @dshent/cloud-workspace 包 + GitOps/Mapping + 单测 — acceptance: typecheck+vitest 绿 (covers: S2.4)
- [x] T8: platform-client local routes + bundle 接线 + workspace 白名单 — acceptance: local 路由注册；bundle build；workspace.test.mjs 含新包 (covers: S2.4)
- [x] T9: UI 云端项目 tab — acceptance: 登录后设置内可见列表/创建/clone/pull/commit/push；enabled=false 隐藏 (covers: S2.4)
- [x] T10: 文档回环（CLAUDE L1/L2/L3）+ 定向验证 — acceptance: 受影响包测试与 server 定向测试记录 PASS/FAIL (covers: S2.6)
- [x] T11: 官方 ctx.workspaces 可选接入 — acceptance: 端口读取器在缺失/不全时返回 undefined；完整时透传 (covers: S4.3, S4.5)
- [x] T12: 创建/打开流程改为原生选目录 + 登记工作区 + 进会话 — acceptance: 创建后一步进会话；已映射不重复弹选择器；取消不报错；原生缺失退回手动根目录 (covers: S4.4, S4.5)
