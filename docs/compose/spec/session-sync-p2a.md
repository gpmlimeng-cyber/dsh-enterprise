---
feature: session-sync-p2a
status: delivered
updated: 2026-09-16
branch: feat/session-sync-p2a
commits: 0489e76..2ddd574b012157422b1596ea2eee6fcb638f90b2
---

# Session 同步 P2a：@dshent/session-sync 骨架包

## Report

**What was built** — 新 workspace 包 ：严格游标 JSON 原子存储、（disabled|idle）、 在  时零网络/零 enterprise 目录；未接 bundle（保留 V1 产物无  门禁）。

**Verification** — 包 vitest 6/6 PASS；tsc --noEmit PASS； 4/4 PASS（含正式包集合含 session-sync）。

**Journey log** — ① worktree 无 node_modules，用主仓  跑 vitest/tsc；② ensureCursors 须把 preferred deviceId 传入游标工厂，否则被 randomUUID 覆盖；③ bundle 接线明确划出本轮，避免破坏 V1 字符串门禁。

## [S1] Problem

P1 已允许服务端 bootstrap 宣告 `sessionPolicy.enabled`，但 monorepo 仍无 `@dshent/session-sync` 客户端包。P2 完整上传链路过大，需要先落地可测骨架：类型契约、游标原子存储、`registerSessionSync` 在关闭时不产生网络/Session 扫描，为后续 dirty/upload/restore 留稳定 seam。

## [S2] Design

### S2.1 范围

| 项 | 决定 |
|---|---|
| 新包 | `plugin/packages/session-sync`，`@dshent/session-sync`，private workspace |
| 依赖 | 仅 Node 内置 +（可选 peer）cordis；**不**依赖 `@deepseek-ai/dsh-session` 真 API（P2b 再接） |
| 接入 bundle | **本轮不做**——`bundle.spec.ts` 仍断言产物不含 `enterpriseSessionSync`（V1 门禁） |
| 配置 | `enterpriseSessionEnabled` 布尔；false 为默认 |
| 游标路径 | `$DSH_HOME/enterprise/session-sync.json`（与设计 §12.1 一致） |

### S2.2 契约

**SessionSyncCursorFile**（严格 JSON，原子写）：

```json
{
  "formatVersion": 1,
  "deviceId": "<uuid>",
  "cursors": {},
  "lastPullAt": null,
  "lastPushAt": null,
  "lastError": null
}
```

**状态机（骨架可见状态）**：`disabled`（enabled=false）| `idle`（enabled，无 worker）。

**registerSessionSync(ctx, deps)**：

1. `deps.enterpriseSessionEnabled === false` → 返回 no-op dispose，**不**创建定时器、不读 sessions 目录、不发 HTTP。
2. `true` → 创建服务实例并 `ctx.effect` 注册；状态为 `idle`；**不**上传（P2b）。

### S2.3 错误行为

- 游标文件损坏 / 非法字段 → 抛稳定码 `ENT_SESSION_CURSOR_INVALID`，不静默覆盖为半文件。
- 未启用时 getStatus **不得**抛错，返回 `{ mode: 'disabled' }`。

### S2.4 测试

| 用例 | 断言 |
|---|---|
| cursor roundtrip | 原子写后读回 deviceId/lastError |
| cursor invalid | 非法 JSON → 错误码 |
| register disabled | 无 fs 写、状态 disabled、dispose 安全 |
| register enabled | 状态 idle；**无** fetch/网络调用 |

## [S3] Out of Scope

- bundle `apply` 接线、UI tab、platform-client 本地 API  
- dirty queue / flush / readFrom / POST batches / restore  
- 修改 `bundle.spec.ts` 的 `not.toContain('enterpriseSessionSync')`  
- OpenAPI / Server 变更  

## Tasks

- [x] T1: 建包骨架 package.json/tsconfig/CLAUDE/README — acceptance: `pnpm --filter @dshent/session-sync typecheck` 可运行 (covers: S2.1)
- [x] T2: types + cursor-store 原子读写与校验 — acceptance: 单测 roundtrip + invalid (covers: S2.2, S2.3; depends: T1)
- [x] T3: service + registerSessionSync 开关语义 — acceptance: disabled 零网络零 sessions 扫描单测通过 (covers: S2.2, S2.4; depends: T2)
- [x] T4: vitest 定向测试 — acceptance: 包内 tests 全部 PASS (covers: S2.4; depends: T3)
- [x] T5: 文档头与 workspace 清单一致性 — acceptance: plugin/CLAUDE 或包 CLAUDE 已登记；无 bundle 改动 (covers: S2.1, S3)
