<!--
[INPUT]: 依赖 npm dsh-session-sync@0.2.14 与 GitHub PerryLink/dsh-session-sync@4bc3af06 源码（ARCHITECTURE.md / lib/merge.mjs / lib/engine.mjs / lib/mirror.mjs / lib/git.mjs / index.mjs / cordis.patch.yml）；对照 T16 服务端与 owndsh-governance-mvp-design.md §12、session 设计一源一写与恢复新 ID 语义。
[OUTPUT]: 记录社区 dsh-session-sync 的源码级能力、与企业 Session 方案的差异，以及可吸收/不可采用边界，供 @dshent/session-sync 点亮设计参考。
[POS]: docs/ecosystem 下的生态调研吸收真源；更新 owndsh-work-platform.md 公开生态证据时引用本文件。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md / owndsh-work-platform.md
-->

# 生态吸收：dsh-session-sync（PerryLink）

状态：`absorbed-reference`  
调研日期：2026-09-16（Asia/Shanghai）  
对照基线：DSH Desktop `2.0.3` / Harness `0.1.1-rc.2`；企业方案见 `../owndsh-governance-mvp-design.md` §12/§16.4 与 `../v1-product-feature-catalog.md` §10（一源一写 / 恢复新 ID / 默认关闭旁路）

---

## 1. 事实卡片

| 项 | 值 |
|---|---|
| npm | [`dsh-session-sync`](https://www.npmjs.com/package/dsh-session-sync) **0.2.14** |
| 仓库 | `https://github.com/PerryLink/dsh-session-sync` |
| 取证 commit | `4bc3af06ed723d0218af1a0d935c4abe8fe0567a`（2026-09-12） |
| 许可 | **Apache-2.0** |
| 形态 | 标准 DSH bundle（`dsh.bundle.patch` → `cordis.patch.yml` 裸行 `id: session-sync`） |
| 产物 | 单入口 `index.mjs` + `lib/`（ESM，无构建产物必要步骤） |
| 运行时依赖 | 极薄：源码 `lib/` 几乎零依赖；`domain` 用 zod + 官方 storage-domain；**无企业 Server** |
| peer 兼容声明 | `0.1.2-rc.1` / `0.1.5-rc.2` 区间；README 自述 verified `dsh-v0.1.5-rc.2` |
| 真源 | **用户自备 Git remote**；会话文件在镜像里是**不透明字节** |
| 明确不做 | 企业账号、租户、AES-GCM 服务端密文、管理正文权限、tombstone retention |

插件自述权限面：`filesystem:read/write`、`session-log:read`、`network:git-remote`、`subprocess:git`、**`credentials:none`**。

---

## 2. 能力地图（源码级）

### 2.1 分层

| 层 | 职责 |
|---|---|
| `index.mjs` | Config、`/sync` 命令、`sync_*` 工具、auto mode、`apply()` 接线 |
| `lib/mirror.mjs` | `$DSH_HOME/sessions` → 工作树**字节镜像**（不解析 JSONL/zstd） |
| `lib/merge.mjs` | **纯函数** append-only 三分支分类 |
| `lib/engine.mjs` | push/pull/status 编排；git 串行调度；拒绝后调和重推一次（**永不 force**） |
| `lib/git.mjs` | git 动词白名单；禁 force/reset/rebase/切分支 |
| `lib/encrypted.mjs` | 可选 **age** 加密镜像（encrypt-then-push）；缺 age 降级明文并告警 |
| `lib/gate.mjs` | 写操作确认门（`userQuestions`/`approval`，无应答 **fail closed**） |

### 2.2 同步模型

```text
device A: $DSH_HOME/sessions --byte mirror--> repoDir/sessions --git--> user remote
device B: pull --> 三分支 merge --> keep-both + fork 文件 + 可选 sessions.fork 子会话
```

- **无云端控制面**；设备间只经 Git 历史对齐。  
- **多写**：允许两台设备各自 mirror + merge（与企业「一源一写」相反）。  
- **冲突**：`classifyPath`（`lib/merge.mjs`）：`identical` / `ours-only` / `theirs-only` / `append-both` / `diverged`；双边冲突 **保留 ours + 远端 fork 文件**，fork 文件名 `*.remote-fork-<UTC14>-<device8>`，镜像清理**永不删 fork**。  
- **会话级 fork**：冲突且会话存活时 `ctx.sessions.fork` + 注入 notice（`index.mjs` / ARCHITECTURE §Conflict）。

### 2.3 人机与自动面

| 面 | 行为 |
|---|---|
| `/sync` | `status` / `diff` / `log` / `pull` / `push` / `help` |
| 模型工具 | `sync_status` / `sync_pull` / `sync_push` |
| 确认 | 写操作确认；只读不问 |
| Auto | `autoPullOnStart` / `autoPushOnTurnEnd` / `pullIntervalMinutes`（默认全关） |
| 状态存储 | `storageDomain` 表 `session-sync`（deviceId、lastPull/PushAt、lastError…） |

### 2.4 与 Harness Session API 的关系

- 硬 `inject`：`sessions`、`commands`、`storageDomain`、`subprocess`。  
- **不解析** session 事件语义；移动的是存储文件字节。  
- Session 事件类型（`sync/push` 等）经 **自适应门控**：宿主未支持时跳过 append，避免破坏加载——对 rc.2 保持关闭（ARCHITECTURE §Session events）。  
- **不依赖** 企业 `sessionPersistence.readFrom` 增量批协议；是文件系统镜像，不是 T16 线协议。

---

## 3. 与企业方案对照

| 维度 | dsh-session-sync | dshent T16–T18 + 决议 |
|---|---|---|
| 真源 | 用户 Git 仓 | 企业 Server（AES-GCM 事件批） |
| 身份/租户 | 无 | 企业账号 + 设备 + owner |
| 冲突 | keep-both + fork，**允许多设备写** | **一源一写**；恢复 **新本地 ID** |
| 增量 | 整树镜像 + git diff | `fromSeq`/`lastAckSeq` + rolling hash |
| 加密 | 可选 age（边缘可降级） | 服务端强制 AES-GCM（T16） |
| 确认 | 本地 userQuestions/approval | 导入确认管道 + dry-run 默认 |
| 管理/审计 | 无 | 管理列表/正文权限/审计/tombstone |
| 分发 | 个人 npm/git | 企业插件目录（可选能力） |
| 与 V1 门禁 | 无关 | enabled=false 时零 Session API |

**定性**：这是完整的**个人跨设备 Git 会话同步产品**；**不是**企业 Session 复制。二者解决不同问题，协议不可互换。

---

## 4. 吸收清单

### 4.1 可借鉴（模式，不搬协议）

| # | 模式 | 源码依据 | 对企业 P2 的含义 |
|---|---|---|---|
| A1 | **字节镜像不解析物理编码** | `lib/mirror.mjs`；ARCHITECTURE Overview | 若做「文件级应急备份」可参考；**企业主路仍应走 Session 事件批**，不镜像 zstd 文件冒充同步 |
| A2 | **append-only 三分支 + 永不静默丢** | `lib/merge.mjs` `classifyPath` | 仅当未来要做多端/fork 产品时再评估；**当前决议一源一写，不实现此合并** |
| A3 | **fork 文件永不删** | `mirror.mjs` + `FORK_NAME_RE` | 冲突工件生命周期纪律可迁移到「人工终态导出包」 |
| A4 | **写确认 fail-closed** | `lib/gate.mjs`；README | 客户端 pull 落地前确认；与 T17 dry-run 默认一致 |
| A5 | **git 动词白名单、禁 force** | `lib/git.mjs` `ALLOWED_VERBS` / `assertSafe` | 任何若引入 git 的运维旁路必须同等收紧 |
| A6 | **sanitize 后再打日志/回显** | `lib/sanitize.mjs` | 与企业 `redact` 纪律同向，可并列写进 P2 评审清单 |
| A7 | **`/sync` 状态可读文案 + diff 只读** | `lib/status.mjs` / `lib/render.mjs`；README | UI：backlog/游标/最后成功；diff 不写库 |
| A8 | **auto 行为全部 effect 可逆** | ARCHITECTURE Auto modes | 热重载/卸载必须停定时器与上传 worker（设计已有 dispose 约束） |
| A9 | **加密后端缺密钥显式降级** | `lib/backend.mjs` `selectEncryptionMode`；encrypted.mjs | 企业侧：**禁止**「假加密」；enabled/加密失败应 fail loud（T16 更严，不得降级明文推远端） |

### 4.2 不可直接采用

| # | 原因 |
|---|---|
| B1 | **Git 真源** 替代企业 Server → 无租户隔离、无管理删除 tombstone、密钥落在用户 Git 权限模型 |
| B2 | **整树镜像** 与 T16 hash 链/幂等批协议不兼容；混用会形成第二真源 |
| B3 | **多设备 keep-both** 与决议「一源一写 + 新 ID 恢复」冲突 |
| B4 | **age 可降级明文** 不满足「服务端密文」产品红线 |
| B5 | peer 偏 `0.1.5-rc.2`；与仓库锁定 `0.1.1-rc.2` 需单独兼容验证，**不得**未验即入受管分发 |
| B6 | Apache-2.0；若 vendor 源码进 monorepo 须走合规与 NOTICE，**本决议不 vendor** |

### 4.3 禁止混写

- 不得用 `dsh-session-sync` 替代 `@dshent/session-sync` 或 T16 API。  
- 不得把其 Git mirror 布局写进企业 bundle-format / OpenAPI。  
- 不得因「社区已能同步」关闭 T16 服务端或跳过 P0/P1 开关纪律。  
- 员工私装该插件时，会话可能进个人 Git——合规话术见生态证据与管理员文档（非本文件强制实现）。

---

## 5. 对 P2 / 设计的具体输入（非任务清单）

1. **定位文案**：对内可称企业方案为「Server 加密复制 + 换机恢复副本」；对外勿与「Git 个人同步插件」混称「官方会话同步」。  
2. **UI**：status 的 ahead/behind/dirty 语义对企业无意义；应用 backlog、lastAckSeq、终态错误码。  
3. **测试夹具**：`lib/merge.mjs` 的五类判定可作**概念**参考单测命名；企业单测仍针对 hash/seq，不对 git 三分支。  
4. **未来实验**：若产品明确要「多端 fork 共享」，可单独立项评估 keep-both；**不得**塞进当前默认关闭旁路包。  
5. **供应链**：若管理员考虑「允许员工自装」，须评估 session 进个人仓的合规，而非技术合并。

---

## 6. 品味自检

- **核心实现**：把社区插件定性为「完整的个人 Git 会话同步」，用对照表切开与 T16 的协议边界，吸收交互与安全纪律而非搬运真源。  
- **品味自检**：merge.mjs 的「绝不静默丢字节」有品味，但与企业一源一写是两套产品哲学；文档写死禁止混写，避免优雅实现污染架构。  
- **改进建议**：P2 开工前对照 rc.2 真实 `dsh-session` / `sessionPersistence` 公开面再 freeze 一次接口表；本吸收不替代该核对。
