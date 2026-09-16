---
feature: p0-ci-and-legacy-gates
status: designed
updated: 2026-09-16
branch: p0-ci-gates
commits: 
---

# P0 CI 与遗留 HTTP 面门禁

## Report

## [S1] Problem

独立二开后，分析报告 P1 仍成立：

1. GitHub Actions **从不**运行后端测试（`pom.xml` 默认 `maven.test.skip=true`，`Dockerfile.server` `-DskipTests`，workflow 无 maven 步骤）；console 的 `check` 也未接入流水线。
2. 上游 `owndsh-system` 的 `/system/**`、`/monitor/**` HTTP 面仍在 classpath；当前仅靠 nginx 不路由遮蔽。一旦有人发布 server 端口或加一条 location，暴露面立刻可达，且不在企业审计白名单内。
3. 本地缺少一键门禁入口，三站 `--check`、compose 密钥必填、日志扫描等约定分散，难以在提交前执行。

## [S2] Design

### S2.1 遗留管理面 HTTP 拒绝

- 在 `owndsh-common-security` 增加高优先级 Servlet Filter：凡路径匹配 `/system/**` 或 `/monitor/**`（含前缀 `/system`、`/monitor` 后紧跟 `/` 或结尾）直接 **404**，响应体为最小 JSON `{"error":"ENT_LEGACY_SURFACE_DISABLED"}`。
- **不**删除 `owndsh-system` 模块（企业层进程内仍依赖 `ISysUserService` / `sys_user` 表）；只切断 HTTP 暴露。
- 可选逃生口：环境变量 / 配置 `ent.legacy-http-surface.enabled=true` 时放行（默认 false）。默认拒绝，用于本地极少数调试。
- 单元测试锁定：`/system/user/list`、`/monitor/cache` 被拒；`/enterprise/**`、`/healthz`、`/auth/code` 放行。

### S2.2 CI 门禁（`release.yml`）

新增独立 job（与 images/plugin 并行，互不阻塞制品构建）：

| Job | 内容 |
|---|---|
| `server-check` | Java 21 + `./mvnw -B -ntp -pl owndsh-modules/owndsh-enterprise,owndsh-server -am test -Dmaven.test.skip=false -DskipTests=false`；随后对 `target/surefire-reports` 与测试日志跑 `node scripts/scan-sensitive-logs.mjs`（若目录存在） |
| `console-check` | Node 24 + pnpm 11.24 + `pnpm --dir console install --frozen-lockfile && pnpm --dir console run check` |

- `server-check` 需要 Docker（Testcontainers）；GitHub `ubuntu-latest` 自带。
- 集成测试失败即 job 失败，**不**继续发布路径依赖：`images`/`plugin-publish` 的 `needs` 保持现状，避免首日就卡死发布；PR 上红灯可见。
- 工作流头部 L3 注释更新为 DSH Enterprise 表述。

### S2.3 本地 `scripts/check-all.sh`

POSIX 脚本，可单独跑任一段：

1. `docker compose config`（缺 `.env` 时用临时 env 注入 dummy 密钥，只验拓扑）
2. `node scripts/scan-sensitive-logs.test.mjs`（扫描器自测）
3. `node` 构建三站 `--check`（可跳过；缺上游资产时允许 skip 并警告）
4. 可选 `FULL=1` 时调用与 CI 相同的 mvn/pnpm check

退出码：任一步失败非 0；skip 步骤计 warning 不失败。

### S2.4 文档回环

- `FORK.md` 合规清单勾选 CI 与 legacy 面两项。
- `scripts/CLAUDE.md`、`.github/workflows/CLAUDE.md`、`owndsh-common-security/CLAUDE.md` L2 更新成员说明。
- `SecurityConfig` 相关文件 L3 头同步。

## [S3] Out of Scope

- 物理删除 `owndsh-system` Controller 源码或 Maven 模块
- Provider / 身份源测试动作补审计
- 插件黑名单对齐、退休版本 SQL 修复
- 阶段三 Java 包名 / 镜像 / npm 改名
- 修改 `Dockerfile.server` 的 `-DskipTests`（镜像构建仍跳过测试，测试由 CI job 负责）
- 改变 `plugin-publish` 对 `server-check` 的依赖关系

## Tasks

- [ ] T1: 实现 Legacy HTTP 面拒绝 Filter + 单元测试 — acceptance: `/system/**` 与 `/monitor/**` 返回 404 且含 `ENT_LEGACY_SURFACE_DISABLED`；企业与健康路径不受影响；`SecurityConfigEnterpriseRouteTest` 语义不回退 (covers: S2.1)
- [ ] T2: `release.yml` 增加 `server-check` 与 `console-check` — acceptance: workflow YAML 含两 job；命令与 S2.2 一致 (covers: S2.2)
- [ ] T3: 新增 `scripts/check-all.sh` 并更新 scripts L2 — acceptance: 无 `.env` 时可完成 compose config；扫描器自测可跑；`FULL=1` 文档化 (covers: S2.3)
- [ ] T4: 更新 FORK/CLAUDE 回环 — acceptance: FORK P1 勾选状态与实现一致；相关 L2 提及新文件 (covers: S2.4)
- [ ] T5: 本地验证并记录 — acceptance: 至少跑通扫描器自测 + compose config + 安全 Filter 单元测试；给出命令与结果 (covers: S2.1, S2.2, S2.3)
