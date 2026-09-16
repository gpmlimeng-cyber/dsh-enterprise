---
feature: session-sync-p2c-p3
status: delivered
updated: 2026-09-16
branch: feat/session-sync-p2c-p3
commits: d101cf0..<filled>
---

# Session 同步 P2c+P3：恢复链路与设置页

## Report

**What was built** — session-sync 新增 restore 流水线（列表、export 分页 hash 校验、`sessions.create` 新 ID、restore-record）；platform-client 本地路由 `/local/sessions/sync|/sessions|/{id}/copies`；ui 设置页「会话同步」tab（仅 `sessionPolicyEnabled`），支持远端列表与绝对 cwd 恢复确认。

**Verification** — session-sync 28/28；ui typecheck+test；bundle build 3/3；workspace 4/4。

**Journey log** — ① export 每页都带 header；② UI bootstrap 只投影 `sessionPolicy.enabled` 布尔决定 tab；③ 恢复 create 前完成全部校验，失败不写 restore-record。

## [S1] Problem

P2b/P2d 已可上传，但员工换机后仍无法从企业 Server 拉回会话并在本机继续。需要：远端列表、export 分页下载与 hash 校验、以**新本地 Session ID** 创建副本（一源一写）、restore-record 审计；并在设置页提供「会话同步」入口（仅 enabled 时渲染）。

## [S2] Design

### S2.1 范围

| 项 | 决定 |
|---|---|
| P2c | session-sync `restore.ts`：list → export 分页 → 校验 → `sessions.create` 新 ID → restore-record |
| P3 API | platform-client local：`GET /sessions/sync`、`GET /sessions`、`POST /sessions/{id}/copies` |
| P3 UI | ui：设置页「会话同步」tab，仅 `sessionPolicy.enabled`；列表 + 选 cwd 恢复 |
| 默认关闭 | enabled=false：不渲染 tab；local session 路由返回 404/禁用，零远端 Session HTTP |
| 不做 | 删除远端、自动恢复、bundle 额外策略 |

### S2.2 恢复流水线

```
GET /enterprise/api/v1/sessions?cursor=…
GET /sessions/{id}/export?fromSeq=&limit=200  (循环 hasMore)
  校验：payloadSha256、rolling 链、事件 seq 连续、header.version===0
sessions.create(newId, { seed, meta: { cwd, parentSession: sourceId, seedLength } })
POST /sessions/{sourceId}/restore-record { restoredSessionId: newId }
```

失败：校验失败 / create 失败 → 不调用 restore-record；不留下半成品（create 前全部校验完）。

### S2.3 本地 API（同源）

| 路由 | 响应 data |
|---|---|
| GET `/local/sessions/sync` | `{ enabled, deviceId, pendingSessionIds, lastError }` |
| GET `/local/sessions` | `{ items: OwnedSession 摘要[] }`（脱敏：id/title/lastSeq/eventCount/updatedAt） |
| POST `/local/sessions/{id}/copies` body `{ cwd }` | `{ restoredSessionId, sourceSessionId }` |

cwd：绝对路径、存在性由 Host 检查（fs.stat）；非法 → 400。

### S2.4 UI

- tabs 增「会话同步」；仅 bootstrap sessionPolicy.enabled 时出现。
- 列表 + 每行「恢复」→ 确认对话框输入/选择 cwd → 调用 local API。
- enabled=false：不渲染 tab、不调用 session local API。

### S2.5 测试

- restore：分页 hash 链、断链拒绝、坏 payloadSha256 拒绝、成功 create+restore-record、失败无 restore-record
- local-api platform：enabled 时路由；disabled 时 session 路由 404
- ui：decode 严格；tab 仅 enabled；恢复确认

## Tasks

- [x] T1: session-sync restore 下载/校验/create/restore-record — acceptance: 单测全绿 (covers: S2.2)
- [x] T2: platform-client session local 路由 + bundle 注入 — acceptance: 路由单测；disabled 零远端 HTTP (covers: S2.3)
- [x] T3: ui session tab + local-api decode + store — acceptance: ui 测试通过 (covers: S2.4, S2.5)
- [x] T4: 文档/roadmap/提交推送 — acceptance: status delivered；PR 打开
