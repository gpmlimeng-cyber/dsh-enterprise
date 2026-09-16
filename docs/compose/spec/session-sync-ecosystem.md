---
feature: session-sync-ecosystem
status: delivered
updated: 2026-09-16
branch: feat/session-sync-ecosystem
commits: c1b788f..465aad775f807e7420b528804170b8cdbab18ede
---

# Session 生态调研吸收：dsh-session-sync

## Report

**What was built** — 完成社区包 `dsh-session-sync`（PerryLink，0.2.14，Apache-2.0）的源码级调研吸收：新建 `docs/ecosystem/dsh-session-sync-absorption.md`（事实卡片、能力地图、与 T16 企业方案对照、可借鉴/不可采用/禁止混写、对 P2 输入）；更新 `owndsh-work-platform.md` 公开生态证据（保留 2026-08-14 结论时间戳，增加 2026-09-16 复查）；`docs/CLAUDE.md` 登记成员。不改 server/plugin 业务代码，不 vendor 源码。

**Verification** — `git diff c1b788f..HEAD --name-only` 仅 4 个 docs 路径；AC1–AC5 结构/链接/无 TBD/无业务路径均 PASS；无自动化测试（纯文档）。

**Journey log** — ① 社区插件真源是用户 Git 而非企业 Server，吸收重点是交互与安全纪律而非协议；② merge keep-both 与一源一写是两套产品哲学，文档写死禁止混写；③ 决议文件在 main 未提交，本分支交叉引用只指向已入库 design/catalog。

## [S1] Problem

`owndsh-work-platform.md`「公开生态证据」仍停留在 2026-08-14 结论：未发现完整跨设备 Session 复制插件。2026-09 npm 已出现 [dsh-session-sync](https://www.npmjs.com/package/dsh-session-sync)（PerryLink，Apache-2.0，0.2.x）自称支持 DSH 会话跨设备 Git 镜像同步。仓库缺少：

1. 与该插件的源码级能力对照（真源、冲突、命令面、依赖、与 Harness 边界）；
2. 对 `@dshent/session-sync` / T16–T18 设计的**可吸收点与明确不吸收点**；
3. 更新后的公开生态证据，避免决策者误读「生态仍空白」。

不吸收则后续点亮客户端时容易重复造轮子，或误把个人 Git 同步当成企业 Server 复制。

## [S2] Design

### S2.1 范围

| 项 | 决定 |
|---|---|
| 对象 | npm `dsh-session-sync` → 源 `github.com/PerryLink/dsh-session-sync` |
| 深度 | **源码级**：同步原语、冲突、CLI/工具、peer 依赖、安装形态 |
| 产出 | ① 新文档 `docs/ecosystem/dsh-session-sync-absorption.md`；② 修正 `docs/owndsh-work-platform.md` 公开生态证据段；③ `docs/CLAUDE.md` 成员清单登记 |
| 不改 | T16 服务端协议、`@dshent/session-sync` 实现、V1 门禁、`session-sync-revival-decision.md` 的产品决议 |

### S2.2 吸收文档结构（固定）

文档须包含：

1. **事实卡片**：版本、许可、仓库、兼容声明、依赖；
2. **能力地图**：真源、同步方向、冲突策略、命令/工具、自动同步、权限假设；
3. **与企业方案对照表**：对照 T16/T17 设计与 `session-sync-revival-decision.md`（一源一写 / 新 ID 恢复 / AES-GCM / 审计）；
4. **吸收清单**：明确「可借鉴 / 不可直接采用 / 禁止混写」各若干条，附源码依据（文件路径或符号）；
5. **对 P2 的具体输入**：仅列不改企业协议即可复用的模式（如 /sync 人机交互、diff 只读、游标类比），不写成任务实现。

### S2.3 公开生态证据修正

`owndsh-work-platform.md` §公开生态证据：

- 保留 2026-08-14 调研的时间戳与「完整企业语义仍缺失」主结论；
- 增补 2026-09 复查：点名 `dsh-session-sync` 为**个人向 Git 会话镜像**完整度较高的相邻实现；
- 重申：不构成跨插件协议，**不得**替代企业 Server 复制；复用限于特定交互/冲突模式。

### S2.4 证据纪律

- 版本/许可以 registry 元数据 + 仓库 README + 源码为准，不编造 API；
- 源码断言须给出可复核路径（如 `src/...` 或根文件名）；
- 未读到的标「未验证」；下载失败则降级为元数据级并显式标注。

### S2.5 验收对照

| AC | 可观察结果 |
|---|---|
| AC1 | 存在 `docs/ecosystem/dsh-session-sync-absorption.md`，含事实卡片、对照表、吸收清单 |
| AC2 | `owndsh-work-platform.md` 公开生态证据含 2026-09 与 `dsh-session-sync` 引用，且未删除 2026-08-14 结论时间戳 |
| AC3 | `docs/CLAUDE.md` 登记新文档 |
| AC4 | 不修改 `server/**`、`plugin/**` 业务代码、V1 门禁条目 |
| AC5 | 文档头 PROTOCOL 完整；markdown 无 TBD |

## [S3] Out of Scope

- 实现或点亮 `@dshent/session-sync` / P1–P5 客户端包；
- vendor 或 fork 社区插件源码进 monorepo；
- 修改 T16 OpenAPI / Server Session 表；
- 把社区插件列为受管插件分发；
- 与 `dsh-config-manager` 的配置同步合并文档。

## Tasks

- [x] T1: 拉取并固化 dsh-session-sync 源与版本事实 — acceptance: 本地存在可引用的源码快照说明（路径/commit/version），文档事实卡片与 registry 一致 (covers: S2.2, S2.4)
- [x] T2: 撰写 docs/ecosystem/dsh-session-sync-absorption.md — acceptance: 含事实卡片、能力地图、企业对照、吸收清单、对 P2 输入；AC1 满足 (covers: S2.1, S2.2; depends: T1)
- [x] T3: 更新 work-platform 公开生态证据与 docs/CLAUDE.md — acceptance: AC2+AC3 满足；旧结论时间戳保留 (covers: S2.3; depends: T2)
- [x] T4: 范围与链接自检 — acceptance: AC4+AC5；`rg` 确认无误改 server/plugin 业务路径 (covers: S2.1, S2.4, S2.5)
