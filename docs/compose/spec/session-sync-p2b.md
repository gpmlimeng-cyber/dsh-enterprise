---
feature: session-sync-p2b
status: delivered
updated: 2026-09-16
branch: feat/session-sync-p2b
commits: 378af99..<filled-at-finalize>
---

# Session 同步 P2b：最小可测上传链路

## Report

**What was built** — `@dshent/session-sync` 在 P2a 骨架上落地最小可测上传链路：dirty 标记、2s 防抖、单 session worker、按 `maxBatchBytes` 切批、T16 `POST /enterprise/api/v1/sessions/{id}/batches` 线协议（raw JSONL + rolling hash + payloadSha256）、游标原子写与终态不自动重试。Harness 0.1.1-rc.2 的 `sessions.flush` / `sessionPersistence.readFrom` 已 lock 为结构端口，运行时不 import `@deepseek-ai/dsh-session*`；未接 bundle/UI/local API/restore。

**Verification** — 见下方 Verification 段（交付时填写命令结果）。

**Journey log** — ① rc.2 真 API 从 npm pack 取证：`flush(session): Promise<boolean>`、`readFrom(id, fromSeq, signal?)`；② 终态 persist 必须 await，否则 flushOnce 返回后游标仍是旧状态；③ V1 门禁依赖 bundle 先 build 再测，仅改 session-sync 不影响 `enterpriseSessionSync` 断言。

## [S1] Problem

P2a 已提供 `@dshent/session-sync` 骨架（游标 + disabled/idle + register 零副作用），但客户端仍无法把本地会话增量推到企业 Server。员工换机后的“远端可恢复”依赖服务端已有 T16 批次协议；缺的是客户端 dirty→debounce→flush→readFrom→切批→POST→游标闭环。本轮只做上传链路最小可测实现，不接 bundle UI / platform-client 本地 API / restore。

## [S2] Design

### S2.1 范围与约束

| 项 | 决定 |
|---|---|
| 包 | 继续扩展 `plugin/packages/session-sync`（`@dshent/session-sync`） |
| 接入 bundle | **不做**——`bundle.spec.ts` 仍断言产物不含 `enterpriseSessionSync`（V1 门禁） |
| 默认关闭 | `enterpriseSessionEnabled === false`：不扫 sessions、不发 HTTP、不写游标 |
| Harness 真 API | **结构端口**对齐 rc.2 公开签名；运行时不 import `@deepseek-ai/dsh-session*`（P2d 接线再注入真实 ctx） |
| 网络 | 仅在 `markDirty` 防抖后由单 session worker 发起；append 路径永不 await 网络 |
| 终态 | 五类错误不自动重试；写入 `cursor.lastError` 并停该 session worker |
| 并发 | 同一 session 单 worker；新事件只标 dirty，当前批完成后重读 |
| dispose | 停新任务；在途请求 `AbortSignal` + ≤3s 等待 |

### S2.2 已 lock 的 Harness 0.1.1-rc.2 公开 API（结构端口来源）

来自 npm `@deepseek-ai/dsh-session@0.1.1-rc.2` / `@deepseek-ai/dsh-session-persistence@0.1.1-rc.2`：

```ts
// ctx.sessions
flush(session: Session): Promise<boolean>

// Session 结构消费面
session.id: SessionId          // branded string
session.header: SessionHeader  // version|id|createdAt|cwd?|parentSession?|seedLength?|origin?|delegationDepth?|agentPreset?
session.seq: number            // 下一 seq == log length

// ctx.sessionPersistence
readFrom(id: SessionId, fromSeq: number, signal?: AbortSignal):
  Promise<{ meta: SessionHeader; events: SessionEvent[] }>

// SessionEvent 包络（服务端解析面）
// { seq: number; time: number; type: string; data: unknown; ... }
```

客户端端口：

```ts
interface SessionStorePort {
  flush(session: SyncableSession): Promise<boolean> | boolean
}
interface SessionPersistencePort {
  readFrom(id: string, fromSeq: number, signal?: AbortSignal): Promise<{
    meta: { version: number; id: string; createdAt: number; [k: string]: unknown }
    events: readonly SyncableEvent[]
  }>
}
interface EnterpriseSessionUploaderPort {
  // POST /enterprise/api/v1/sessions/{id}/batches
  // 成功：{ data: { acceptedThroughSeq, rollingHash }, requestId }
  // 失败：throw EnterpriseSessionUploadError { code, status, retryable }
  appendBatch(sessionId: string, body: SessionBatchBody, signal: AbortSignal): Promise<SessionBatchAccepted>
}
```

`markDirty(session)` 接受带 `id`/`header`/`seq` 的 live session；flush 失败或已离开 store 时，仅用 id + 已有 header 读 persistence。

### S2.3 上传流水线

```
session/event 或 markDirty(session)
        │
        ▼
  dirtySet.add(sessionId) ── debounce 2s/session ──► 单 worker
                                                      │
                                                      ▼
                                    sessions.flush(session)  // live only
                                                      │
                                                      ▼
                    persistence.readFrom(id, cursor+1)
                                                      │
                    ┌─────────────────────────────────┘
                    ▼
         按 maxBatchBytes 切批（字节 = UTF-8 JSONL）
                    │
                    ▼
         逐批 POST batches（idempotencyKey = deviceId:sessionId:from:to）
                    │ success
                    ▼
         原子写游标 cursors[id]=toSeq, lastPushAt, lastError=null
                    │ 终态错误
                    ▼
         lastError=code；该 session 停止自动重试（需显式 clearSessionError）
```

### S2.4 线协议（对齐 T16 / 设计 §12.2）

`POST /enterprise/api/v1/sessions/{sessionId}/batches`

```json
{
  "idempotencyKey": "<deviceId>:<sessionId>:<fromSeq>:<toSeq>",
  "fromSeq": 0,
  "toSeq": 37,
  "previousRollingHash": "<44-char base64 of 32 bytes>",
  "payloadSha256": "<44-char base64 sha256 of payload bytes>",
  "payloadBase64": "<base64 of JSONL bytes>",
  "header": { "...完整 SessionHeader 字段..." },
  "title": null
}
```

规则：

- payload：每事件 `JSON.stringify(event) + "\n"`，无空行、无 CRLF，以 `\n` 结尾。
- `payloadSha256`：对含换行的完整 payload 字节 SHA-256，canonical Base64（含 `=`）。
- rolling hash：`H[-1]=32×0x00`；`H[n]=SHA-256(H[n-1] || rawLineWithoutNewline)`。
- 首批（`fromSeq===0`）必须携带完整 `header`（version/id/createdAt + 已知可选字段）；后续批 `header: null`。
- 单批明文字节不得超过 `maxBatchBytes`（来自 bootstrap `sessionPolicy.maxBatchBytes`，默认 1MiB）。
- 成功响应读 `data.acceptedThroughSeq` 与 `data.rollingHash`；本地游标以 `acceptedThroughSeq` 为准，并保存该批最终 rollingHash 作为下一批 `previousRollingHash`。

### S2.5 错误与重试

| 服务端 code | HTTP | 客户端行为 |
|---|---|---|
| `ENT_SESSION_SEQ_GAP` | 409 | 终态，不重试 |
| `ENT_SESSION_DIVERGED` | 409 | 终态，不重试 |
| `ENT_SESSION_SOURCE_DEVICE_CONFLICT` | 409 | 终态，不重试 |
| `ENT_SESSION_FORMAT_UNSUPPORTED` | 400 | 终态，不重试 |
| `ENT_SESSION_CONTENT_EXPIRED` | 404 | 终态，不重试 |
| `ENT_SESSION_BATCH_TOO_LARGE` | 413 | 终态（切批 bug），不重试 |
| 网络 / 5xx / `ENT_PLATFORM_UNAVAILABLE` | — | 指数退避（有界），可重试 |
| 认证 `ENT_AUTH_*` / 401 | 401 | 交 uploader/port 处理；本地不硬编码 token |

终态后：`cursors[sessionId]` 保持已确认水位；`lastError` 固化；该 session 的 dirty 队列不再自动排水，直到 `clearSessionError(sessionId)`。

### S2.6 游标文件扩展（兼容 P2a formatVersion=1）

在既有 `SessionSyncCursorFile` 上扩展 per-session 元数据，**不破坏**旧字段：

```json
{
  "formatVersion": 1,
  "deviceId": "…",
  "cursors": { "session-1": 37 },
  "lastPullAt": null,
  "lastPushAt": "ISO",
  "lastError": null,
  "rollingHashes": { "session-1": "<base64>" },
  "terminalErrors": { "session-1": "ENT_SESSION_DIVERGED" },
  "pushedAt": { "session-1": "ISO" }
}
```

解析规则：缺失新字段视为 `{}` / `null`（向后兼容）；出现则严格校验。`lastError` 仍保留“最近一次错误”字符串（脱敏后的 code），供 `getStatus()`。

### S2.7 register / 状态机

- `enterpriseSessionEnabled === false`：与 P2a 相同——no-op dispose，无 fs 写、无 HTTP、无 sessions 扫描。
- `true` 且未注入 ports：idle（仅 ensureCursors）。
- `true` + 注入 `sessions` / `sessionPersistence` / `uploader`：进入 `uploading-ready`（仍不自动扫目录；只响应 `markDirty`）。
- `markDirty` 在 disabled 时忽略；在终态 session 上忽略。
- 新增 `SessionSyncMode = 'disabled' | 'idle' | 'uploading'`（`uploading` = 有 worker 在跑或 ready；`getStatus().mode` 对外仍区分 idle/ready 可用 uploading 表示 ready+active，骨架 idle 保持）。

对外 handle 扩展：

```ts
interface SessionSyncServiceHandle {
  mode: SessionSyncMode
  getStatus(): SessionSyncStatus
  markDirty(session: SyncableSession): void
  flushOnce(sessionId: string): Promise<void>   // 测试/强制排空
  clearSessionError(sessionId: string): void
  dispose(): void | Promise<void>
}
```

### S2.8 日志脱敏

- 只允许：sessionId、seq 区间、错误 code、状态名。
- 禁止：事件正文、title、cwd、Authorization、payload/base64。

### S2.9 测试

| 用例 | 断言 |
|---|---|
| batch split | 超 `maxBatchBytes` 时切多批；每批 payload 以 `\n` 结尾且 ≤ 上限；首批带 header、后续不带 |
| rolling/hash | 与设计 H[-1]/H[n] 一致；`payloadSha256` 对含换行字节计算 |
| terminal set | 五类 + BATCH_TOO_LARGE 进入终态；不重试；lastError 固化 |
| disabled zero net | enabled=false + markDirty/flushOnce → 零 fetch、零 enterprise 目录 |
| mock upload | 注入 mock ports：debounce 后 1 批上传成功、游标推进、lastError=null |
| resume mid-stream | 游标已有 k 时从 k+1 起；previousRollingHash 用存储 hash |
| dispose | 在途 abort；≤3s 返回；不再开始新批 |

### S2.10 Out of Scope

- bundle `registerSessionSync` 接线 / cordis row
- UI 会话同步 tab
- platform-client `/sessions*` 本地 API
- restore / export 下载 / `sessions.create` 新副本
- 修改 `bundle.spec.ts` 的 `not.toContain('enterpriseSessionSync')`
- OpenAPI / Server 变更
- 真实 Harness E2E

## Tasks

- [x] T1: 扩展 types/errors：SyncableSession/Event、端口、终态集合、上传错误 — acceptance: `tsc --noEmit` 过；终态 code 集合与 T16 对齐 (covers: S2.2, S2.5)
- [x] T2: wire + hash + batch splitter 纯函数 — acceptance: 单测覆盖切批边界、JSONL/rolling/payloadSha256 (covers: S2.4, S2.9)
- [x] T3: cursor 扩展 rollingHashes/terminalErrors/pushedAt 兼容读写 — acceptance: 旧 P2a 文件可读；新字段 roundtrip；损坏 fail-closed (covers: S2.6)
- [x] T4: upload worker：dirty/debounce/单 session/游标/终态/dispose — acceptance: mock 端口单测全绿；disabled 零网络 (covers: S2.3, S2.5, S2.7, S2.9)
- [x] T5: register 接线 + 包导出 + L2/README — acceptance: enabled=false 回归仍过；无 bundle 改动 (covers: S2.1, S2.7)
- [x] T6: 更新 roadmap 未完成清单与本 spec Report — acceptance: 文件 status=delivered；roadmap 指向 P2b 已交付 (covers: S1, S3)
