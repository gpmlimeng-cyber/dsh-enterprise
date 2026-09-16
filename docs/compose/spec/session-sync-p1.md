---
feature: session-sync-p1
status: designed
updated: 2026-09-16
branch: feat/session-sync-p1
commits: 
---

# Session 同步 P1：bootstrap sessionPolicy 可配置

## Report

## [S1] Problem

`BootstrapView.from` 将 `sessionPolicy` 写死为 `new SessionPolicy(false, 90, 1_048_576)`，与已有的 `EnterpriseSessionProperties`（`enterprise.session.retentionDays` / `maxBatchBytes`）脱节。部署无法打开 Session 旁路开关（`enabled`），P2/P3 客户端点亮缺少服务端宣告入口；客户端测试与 V1 门禁依赖 `enabled=false` 默认行为，必须保持。

## [S2] Design

### S2.1 冻结决策

| 决策 | 选择 |
|---|---|
| 配置前缀 | 沿用 `enterprise.session.*` |
| 新属性 | `enterprise.session.enabled`，默认 **false** |
| 同步宣告 | bootstrap 的 `sessionPolicy` 三字段全部来自 `EnterpriseSessionProperties`（enabled / retentionDays / maxBatchBytes），**禁止**在 View 里再写死字面量 |
| 协议 | **不改** OpenAPI 字段结构；仅运行时取值可随部署变化 |
| V1 默认 | 未配置时 bootstrap 仍为 `enabled:false` + 90 + 1048576（T08/脚本断言不破） |

### S2.2 行为契约

1. `EnterpriseSessionProperties` 增加 `boolean enabled = false` 及 getter/setter。
2. `BootstrapView.from(snapshot, SessionPolicy)`（或等价：`from(snapshot, EnterpriseSessionProperties)`）使用传入策略；无 `false` 硬编码路径。
3. `BootstrapController` 注入 `EnterpriseSessionProperties`，每次请求组装策略（与 Server 真源一致，避免陈旧缓存）。
4. 文档：`EnterpriseSessionProperties` / session CLAUDE.md / module README 提及 `enabled` 默认关闭、显式 `true` 才对客户端宣告旁路。

### S2.3 错误行为

- 非法 `enabled` 值由 Spring 绑定失败（与其它 `enterprise.session.*` 一致），不新增业务错误码。
- 不改变 Runtime/Admin Session HTTP 路由注册（P1 不碰控制器安全栅栏）。

### S2.4 测试边界

| 测试 | 断言 |
|---|---|
| `EnterpriseSessionPropertiesTest` | 默认 `enabled==false`；retentionDays==90；maxBatchBytes==1_048_576 |
| 新增 `BootstrapView` 单测（或扩展） | `enabled=true` 时投影为 true 且 retention/batch 来自入参；默认 false 路径与现契约一致 |
| 既有 T08 契约测试 | 默认部署下仍出现 `"sessionPolicy":{"enabled":false`（PRE-EXISTING 行为） |

## [S3] Out of Scope

- 客户端 `@dshent/session-sync`、platform-client 本地 API、UI tab  
- 管理端 Session 页面开关 UI  
- 改 OpenAPI schema、协议 hash 重算（字段未变）  
- 真实 PostgreSQL Session 上传 E2E  

## Tasks

- [ ] T1: EnterpriseSessionProperties 增加 enabled 默认 false — acceptance: 单测断言默认 false 与既有 1MiB/90 默认不变 (covers: S2.1, S2.4)
- [ ] T2: BootstrapView 使用注入的 SessionPolicy — acceptance: 源码无 `new SessionPolicy(false, 90` 字面量；单测覆盖 true/false (covers: S2.2; depends: T1)
- [ ] T3: BootstrapController 注入 properties 并转发 — acceptance: 控制器编译通过并调用新 from 签名 (covers: S2.2; depends: T2)
- [ ] T4: 文档头与 session CLAUDE/README 一句 enabled 说明 — acceptance: 文档记载默认关闭与配置键 (covers: S2.2)
- [ ] T5: 编译与定向测试 — acceptance: `./mvnw -pl owndsh-modules/owndsh-enterprise -am test -Dtest='EnterpriseSessionPropertiesTest,BootstrapView*,T08*'` 记录 PASS/FAIL (covers: S2.4)
