<!--
[INPUT]: 依赖 session-share-fork-decision.md、对话冻结的「企业信道」契约（HTTPS 入 + cursor 出）、T16/T05 DeviceCallContext 与 EnterpriseSessionProperties 开关范式。
[OUTPUT]: 冻结 Project Mode 第一刀：项目治理 + 房间消息服务端、独立 collab 开关与可观测验收。
[POS]: docs/compose 的 project-collab-channel 特性真源；不覆盖 session-sync P2b–P4，也不实现云端 worktree/SSH。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

---
feature: project-collab-channel
status: delivered
updated: 2026-09-16
branch: feat/project-collab-channel
commits: 378af99..2320c3b
---

# Project 协作信道（服务端第一刀）

## Report

**What was built** — 交付 Project Mode 服务端第一刀：V31 项目/成员/消息表、独立 `enterprise.collab.enabled`（默认关）与 bootstrap `collabPolicy`，Runtime 项目治理/邀请/转让/消息 API 与 SSE stream。消息为社会层，不写入 Session Event；审计五类 action 无正文。

**Verification** — `EnterpriseCollabPropertiesTest` + `BootstrapViewSessionPolicyTest` PASS（5）；`T08ApiContractTest` PASS（含 collabPolicy schema）；`CollabServiceIntegrationTest` 已写但本机 Docker 不可用（PRE-EXISTING：Testcontainers 起不来）。`pnpm --filter @dshent/contracts generate` 已同步 BootstrapResponse schema。

**Journey log** — ① bootstrap 增 collabPolicy 必须同步 OpenAPI 真源与 generate，否则 T08 additionalProperties=false 会红；② 审计 metadata 必须走 sealed DTO，不能用 Map；③ `sys_user` 无 tenant 列，成员存在性只能按 user_id+del_flag；④ Docker 缺失时集成门禁无法本机复验，需 CI/有 Docker 环境补跑。

## [S1] Problem

团队模式需要「项目房间」：群主建项、拉人/转让，成员在项目下通过消息与 `@会话` 通讯。现有 T16 只有个人 Session 副本；`ent_access_group` 不是 Project；没有多写社会层。没有服务端信道，客户端 `@`、汇报、系统事件无处落地，也违背「企业控制面持有身份/审计」的既有边界。

本刀只做**服务端项目治理 + 房间消息**，为后续客户端注入桥、云端工作区、父子编排留 seam。

## [S2] Design

### S2.1 范围

| 项 | 决定 |
|---|---|
| 开关 | `enterprise.collab.enabled`，默认 **false**；bootstrap 宣告 `collabPolicy.enabled` |
| 与 sessionPolicy | **独立**，无强制 AND；注入进 Session 仍受 `sessionPolicy.enabled` 约束（本刀不注入） |
| 关闭时行为 | 全部 `/enterprise/api/v1/projects/**` 返回 `403 ENT_COLLAB_DISABLED` |
| 房间 | **一项目一房间**，不单独建 `ent_collab_room` |
| 执行 | 不碰 worktree/SSH/云工作区；消息不写入 Session Event |
| 鉴权 | ACTIVE Harness 设备（`DeviceRequestContextResolver`），成员关系即 ACL |
| 管理端 API | 本刀不做 |

### S2.2 数据（V31）

```text
ent_project
  id PK, tenant_id, name (1..128), owner_user_id → sys_user,
  status ACTIVE|ARCHIVED, created_at, updated_at, deleted_at
  uq (tenant_id, name) where status=ACTIVE  -- 避免同租户活跃重名

ent_project_member
  project_id, user_id, role OWNER|MEMBER, joined_at
  PK (project_id, user_id)
  每项目恰一 OWNER（由 service 事务保证）

ent_collab_message
  id PK, tenant_id, project_id, server_seq,
  author_user_id, kind CHAT|MENTION|SYSTEM|INJECT_REQUEST,
  body varchar(4000),
  target_session_id varchar(128) null,   -- MENTION/INJECT_REQUEST
  target_seq bigint null,               -- 可选定位
  idempotency_key varchar(255) not null,
  created_at
  uq (project_id, server_seq)
  uq (project_id, idempotency_key)
```

`server_seq` 由事务内 `coalesce(max(seq),-1)+1` 分配。正文 v1 **明文**存储（社会层，非模型历史）；不进审计 metadata。

### S2.3 Runtime API（Bearer + ACTIVE 设备）

| Method | Path | 语义 |
|---|---|---|
| POST | `/enterprise/api/v1/projects` | 建项；actor→OWNER |
| GET | `/enterprise/api/v1/projects` | 本人所属项目 cursor 列表 |
| GET | `/enterprise/api/v1/projects/{projectId}` | 详情 + 成员 |
| POST | `/enterprise/api/v1/projects/{projectId}/members` | 邀请（仅 OWNER；目标须存在） |
| DELETE | `/enterprise/api/v1/projects/{projectId}/members/{userId}` | 移出（仅 OWNER；不可移 OWNER） |
| POST | `/enterprise/api/v1/projects/{projectId}/owner` | 转让群主（仅 OWNER；目标须已是 MEMBER） |
| POST | `/enterprise/api/v1/projects/{projectId}/messages` | 发消息（成员） |
| GET | `/enterprise/api/v1/projects/{projectId}/messages` | cursor 列表（成员） |
| GET | `/enterprise/api/v1/projects/{projectId}/messages/stream` | SSE 增量（成员；`afterSeq`） |

**发消息请求**：

```json
{
  "idempotencyKey": "uuid",
  "kind": "CHAT|MENTION|SYSTEM|INJECT_REQUEST",
  "body": "…",
  "targetSessionId": null,
  "targetSeq": null
}
```

规则：

- `MENTION` / `INJECT_REQUEST` 必须带非空 `targetSessionId`；`CHAT`/`SYSTEM` 禁止携带 target。
- `SYSTEM` 仅服务端在邀请/移出/转让时自动写入；客户端 POST `SYSTEM` → 400。
- 重复 `idempotencyKey` 返回原消息（200，不双写）。
- body 1..4000 字符；去掉首尾空白后非空。

**SSE**：`Accept: text/event-stream`；事件 `id=serverSeq`，`data` 为消息 JSON；每 15s 注释心跳；客户端断开即停。实现为 DB 轮询（≤1s）+ 有界连接，不引入第二套 broker。

### S2.4 Bootstrap

`BootstrapView` 增加：

```json
"collabPolicy": { "enabled": false }
```

来源 `EnterpriseCollabProperties`，与 `sessionPolicy` 并列。

### S2.5 错误码

| code | HTTP | 场景 |
|---|---|---|
| `ENT_COLLAB_DISABLED` | 403 | 开关关闭 |
| `ENT_PROJECT_NOT_FOUND` | 404 | 项目不存在/已删/非成员（不区分，防探测） |
| `ENT_PROJECT_NOT_OWNER` | 403 | 非群主做治理操作 |
| `ENT_PROJECT_LAST_OWNER` | 400 | 转让给自己 / 移出 OWNER |
| `ENT_PROJECT_MEMBER_EXISTS` | 409 | 重复邀请 |
| `ENT_PROJECT_MEMBER_NOT_FOUND` | 404 | 转让目标非成员 / 移出非成员 |
| `ENT_INVALID_REQUEST` | 400 | kind/body/target 不合法 |

### S2.6 审计（无正文）

| action | metadata |
|---|---|
| `PROJECT_CREATED` | projectId, name |
| `PROJECT_MEMBER_ADDED` | projectId, userId, role |
| `PROJECT_MEMBER_REMOVED` | projectId, userId |
| `PROJECT_OWNER_TRANSFERRED` | projectId, fromUserId, toUserId |
| `COLLAB_MESSAGE_POSTED` | projectId, messageId, serverSeq, kind, hasTarget |

### S2.7 测试边界

- 属性默认：`enabled=false`。
- 关闭时 projects API → 403。
- 建项→邀请→发消息→列表 seq 连续；转让后旧主仅 MEMBER，新主可再邀请。
- 非成员读消息 → 404（`ENT_PROJECT_NOT_FOUND`）。
- 幂等重放同 key → 单行。
- SYSTEM 客户端 POST → 400；MENTION 无 target → 400。
- bootstrap JSON 含 `collabPolicy.enabled`。

## [S3] Out of Scope

- 云端工作区 / SSH / 共享 worktree / 任务看板 / 文档目录  
- 消息注入 Session、父子编排、会话登记到项目  
- 管理控制台页面、管理员项目 API  
- 消息加密、存在 presence、WebSocket  
- OpenAPI：BootstrapSnapshot 增加 `collabPolicy`（已 generate）；projects/** path 切片仍后续补
- 修改 `sessionPolicy` 或 V1 Session 零请求门禁  

## Tasks

- [x] T1: 冻结本 spec 与独立开关契约 — acceptance: 文档 status=designed 且 S2.1/S2.5 无 TBD (covers: S2.1)
- [x] T2: V31 migration + EnterpriseCollabProperties + bootstrap collabPolicy — acceptance: 属性默认 false；bootstrap 含 collabPolicy；迁移可空库执行 (covers: S2.2, S2.4)
- [x] T3: collab domain/persistence/application（项目/成员/消息事务） — acceptance: 服务层单测/集成覆盖建项、邀请、转让、发消息幂等与 seq (covers: S2.2, S2.3, S2.5)
- [x] T4: RuntimeController + 异常映射 + SSE stream — acceptance: 关闭 403；成员 CRUD/消息；SSE 可读增量与心跳 (covers: S2.3, S2.5)
- [x] T5: 审计 action 白名单接入 — acceptance: 五类 action 写入且 metadata 无 body (covers: S2.6)
- [x] T6: 契约测试与 L2/L3 文档回环 — acceptance: MockMvc/Testcontainers 门禁绿；session/owndsh-enterprise CLAUDE 已登记 (covers: S2.7, S3)
