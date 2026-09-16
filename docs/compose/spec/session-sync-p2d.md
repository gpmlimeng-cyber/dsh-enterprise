---
feature: session-sync-p2d
status: delivered
updated: 2026-09-16
branch: feat/session-sync-p2d
commits: f159ba8..<filled>
---

# Session 同步 P2d：bundle 条件接线

## Report

**What was built** — session-sync 新增 `tryRegisterHostSessionSync`：仅在平台 READY 且 `bootstrap.sessionPolicy.enabled===true`、且存在 `sessions`/`sessionPersistence` 端口时注册上传服务；uploader 经 `platform.request` 打 T16 batches。bundle `apply()` 组合该桥并订阅 `session/event`→`markDirty`；登出/关闸时 dispose。`bundle.spec` 改为双向门禁（允许条件注册符号，禁止 `@deepseek-ai/dsh-session` peer/hard import）。

**Verification** — session-sync typecheck PASS；vitest **23/23**；bundle build+spec **3/3**；workspace.test.mjs PASS。

**Journey log** — ① Cordis `ctx.on` 返回 disposer，无 `ctx.off`；② bundle 不 import dsh-session 时 Events 无 `session/event` 类型增广，用本地窄类型订阅；③ esbuild 内联后 lib 无 `from '@dshent/session-sync'` 字符串，门禁只断言 src。

## [S1] Problem

P2b 上传链路已在 `@dshent/session-sync` 可测，但 bundle Host 入口从不调用 `registerSessionSync`，生产 Harness 里同步永远点不亮。需要在 **bootstrap `sessionPolicy.enabled===true` 时** 才注入真实 ports 并注册；默认关闭时保持零 Session HTTP，且未启用运行时不创建同步服务。

## [S2] Design

### S2.1 范围

| 项 | 决定 |
|---|---|
| 组合根 | `plugin/packages/bundle/src/index.ts` + session-sync 新增 `host-bridge` |
| 依赖 | bundle devDep `@dshent/session-sync`；**不** peer 依赖 `@deepseek-ai/dsh-session*` |
| 未启用路径 | 不调用 `registerSessionSync`、不 `ctx.on('session/event')`、不发 `/sessions/*` |
| 已启用路径 | READY + `sessionPolicy.enabled===true` + 存在 `sessions`/`sessionPersistence` 时注册 |
| UI / restore | 仍 Out of Scope |
| V1 门禁 | 改为开关双向：`enabled=false` 零 Session 请求；产物允许出现条件注册代码，但 false 路径不实例化服务 |

### S2.2 Host 桥（session-sync/host-bridge）

```ts
interface HostPlatformPort {
  status(): { state: string }
  bootstrap(): { sessionPolicy: { enabled: boolean; maxBatchBytes: number } } | undefined
  request(path: string | URL, init?: RequestInit): Promise<Response>
  subscribe(listener: (status: { state: string }) => void): () => void
}

interface HostSessionRuntimePort {
  sessions?: SessionStorePort
  sessionPersistence?: SessionPersistencePort
}

tryRegisterHostSessionSync(options: {
  dshHome: string
  platform: HostPlatformPort
  runtime: HostSessionRuntimePort
  logger?: SessionSyncLogger
  onSessionEvent?: (listener: (session: SyncableSession) => void) => () => void
}): { readonly enabled: boolean; dispose(): Promise<void> }
```

行为：

1. `isSessionSyncEnabled(platform)`：`bootstrap()?.sessionPolicy?.enabled === true` 且 `status().state` 为 `READY`/`REFRESHING`。
2. 未启用 → 返回 `{ enabled: false }`，**零** `registerSessionSync`、零 event 订阅。
3. 已启用 → `registerSessionSync({ enterpriseSessionEnabled: true, maxBatchBytes, sessions, sessionPersistence, uploader })`；缺 ports 则不注册并记 warn。
4. uploader：`POST /enterprise/api/v1/sessions/{id}/batches`，错误经 `uploadErrorFromResponse`。
5. `onSessionEvent` 绑定 `markDirty`。
6. 平台状态变化时幂等 mount/unmount：登出或 enabled 变 false 时 dispose。

### S2.3 bundle 接线

- `apply()` 在创建 `EnterprisePlatformService` 后调用 `tryRegisterHostSessionSync`。
- `dshHome`：`resolveEnterpriseDshHome()`（platform-client 导出）。
- runtime：`ctx.get('sessions')` / `ctx.get('sessionPersistence')`（可选，不进 hard `inject`）。
- event：`ctx.on('session/event', …)` 仅在 mount 成功后订阅，dispose 时移除。
- logger：`ctx.logger` 脱敏，仅 code/sessionId。

### S2.4 测试

| 用例 | 断言 |
|---|---|
| host disabled | bootstrap enabled=false → 不调用 registerSessionSync，无 request |
| host enabled | enabled=true + ports → mode uploading；markDirty 后 uploader 收到 T16 body |
| bundle source | `src/index.ts` 含条件注册；`peerDependencies` 无 dsh-session；`lib` 无 hard `from '@deepseek-ai/dsh-session'` |
| bundle false path | 源码判定函数在 enabled=false 时返回 false（单测 host-bridge） |
| V1 双向 | bundle.spec 不再要求产物字符串永不含 `enterpriseSessionSync`；改为 host-bridge 语义 + 无 dsh-session 硬依赖 |

### S2.5 Out of Scope

- UI tab、platform-client `/sessions/*` 本地 API、restore/export  
- OpenAPI / Server 变更  
- 真实双设备 E2E（P4）

## Tasks

- [x] T1: session-sync host-bridge：enabled 判定、mount/unmount、uploader 错误映射 — acceptance: host 单测 disabled/enabled 全绿 (covers: S2.2)
- [x] T2: bundle apply 条件接线 + package.json workspace dep — acceptance: typecheck/build 过；无 dsh-session peer (covers: S2.3)
- [x] T3: 更新 bundle.spec 双向门禁与 workspace 文档 — acceptance: bundle 3/3；session-sync 新测试通过 (covers: S2.4, S1)
