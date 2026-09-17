---
feature: cloud-workspace
status: in-progress
updated: 2026-09-17
branch: feat/cloud-workspace
commits:
---

# 云端工作空间（Cloud Workspace）最小同步闭环

## Report

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
| POST | `/` | body `{name, description?}`；slug 规范化 + 冲突 409；事务插 project+OWNER member；`GitRepositoryService.initBare`；审计 |
| GET | `/` | 当前用户作为成员的项目列表（id/slug/name/role/cloneUrl/defaultBranch） |
| GET | `/{projectId}` | 成员可见才返回 |
| POST | `/{projectId}/members` | OWNER 添加成员 `{userId}`（本企业用户）；幂等 |
| DELETE | `/{projectId}/members/{userId}` | OWNER 移除；禁止移除最后一个 OWNER |

**Git Smart HTTP**（`/enterprise/api/v1/git/{projectId}/**`）

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
| POST `/local/cloud-projects/{id}/clone` | `{rootDir}` 绝对路径；生成 slug 子目录；`git clone`；写映射；失败清理 |
| POST `/local/cloud-projects/{id}/pull` | mapped 才允许；`git pull --ff-only` 失败则报告需手动合并 |
| POST `/local/cloud-projects/{id}/commit` | `{message}`；有变更则 `add -A` + commit |
| POST `/local/cloud-projects/{id}/push` | `git push`；非 FF 把 stderr 映射为 `ENT_GIT_NON_FAST_FORWARD` |
| POST `/local/cloud-projects/{id}/members` | OWNER 加成员 |
| GET `/local/cloud-projects/{id}/status` | branch、dirty、last commit subject |

**Git 凭据（Access Token）**

- Host 生成一次性 `GIT_ASKPASS` 脚本：向本地 platform `GET /status` 侧信道不可行（token 不出 Host API）。改为：GitOps 通过注入的 `AccessTokenProvider` 接口在 Host 内取 token，写入 askpass 脚本内存环境不可持久化场景用临时 0700 文件 + 操作结束删除。
- username 固定 `oauth2`（服务端忽略用户名，只认 password=token）。
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
| 非 FF push | 客户端 `ENT_GIT_NON_FAST_FORWARD`（git stderr 保留） |
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

## [S3] Out of Scope

- 管理端 Console / 审计深度页 / 通知 / 活动流 / 配额绑定
- Desktop 独立仓库 UI、跨设备映射自动迁移
- SSH git、服务端自动 merge、web IDE
- 会话与云端项目的强制绑定（会话仍用任意本地 cwd）
- 大文件 LFS、repo GC 运维面

## Tasks

- [ ] T1: 规格冻结与 GEB 路线 — acceptance: 本文件 status=in-progress 前与用户决策一致 (covers: S2.1)
- [ ] T2: 服务端 workspace 纵向骨架 + V31 迁移 + properties/enabled — acceptance: 模块可编译；迁移 SQL 存在；默认 enabled=true 单测 (covers: S2.2)
- [ ] T3: 项目 CRUD + 成员服务 + bare init — acceptance: POST/GET cloud-projects 与 members 服务逻辑单测/MockMvc 过；bare 目录生成 (covers: S2.2)
- [ ] T4: Git Smart HTTP + Basic→Bearer 滤镜 + 非 FF 拒绝 — acceptance: JGit Upload/Receive 接线；无/错 token 401；非成员 403；ReceivePack 非 FF 拒绝单测 (covers: S2.2, S2.5)
- [ ] T5: OpenAPI paths/components/fixtures + 生成无漂移 — acceptance: contracts 校验通过 (covers: S2.3)
- [ ] T6: bootstrap cloudWorkspace 声明 — acceptance: BootstrapView 含 cloudWorkspace.enabled 默认 true (covers: S2.2)
- [ ] T7: @dshent/cloud-workspace 包 + GitOps/Mapping + 单测 — acceptance: typecheck+vitest 绿 (covers: S2.4)
- [ ] T8: platform-client local routes + bundle 接线 + workspace 白名单 — acceptance: local 路由注册；bundle build；workspace.test.mjs 含新包 (covers: S2.4)
- [ ] T9: UI 云端项目 tab — acceptance: 登录后设置内可见列表/创建/clone/pull/commit/push；enabled=false 隐藏 (covers: S2.4)
- [ ] T10: 文档回环（CLAUDE L1/L2/L3）+ 定向验证 — acceptance: 受影响包测试与 server 定向测试记录 PASS/FAIL (covers: S2.6)
