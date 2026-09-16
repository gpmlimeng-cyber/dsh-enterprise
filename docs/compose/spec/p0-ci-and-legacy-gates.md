---
feature: p0-ci-and-legacy-gates
status: delivered
updated: 2026-09-16
branch: p0-ci-gates
commits: d3c77fa..7fd642f
---

# P0 CI 与遗留 HTTP 面门禁

## Report

**What was built** — 默认拒绝上游 `/system/**` 与 `/monitor/**` HTTP 面（404 `ENT_LEGACY_SURFACE_DISABLED`，逃生口 `ENT_LEGACY_HTTP_SURFACE_ENABLED`），进程内 Service 依赖保留。`release.yml` 新增并行 `server-check`（enterprise+server Maven 测试 + surefire 日志密钥扫描）与 `console-check`（pnpm check），不阻塞 images 发布拓扑。新增 `scripts/check-all.sh` 本地门禁：compose config、扫描器自测、三站 `--check`，`FULL=1` 时对齐重型检查。

**Verification** — `sh scripts/check-all.sh` PASS（compose/扫描器/三站）；`./mvnw -pl owndsh-server -am test -Dtest=LegacyAdminSurfaceFilterTest,SecurityConfigEnterpriseRouteTest …` PASS 6 tests；FULL 集成套件与 GitHub runner 未在本机执行（PRE-EXISTING 重型依赖 Testcontainers）。

**Journey log** — 首轮 review 发现 FORK §4 误删品牌开放项，已恢复；Filter 注册曾二次 `new`，已复用实例；补 doFilter 级行为测（404 body / 逃生口 / 企业路径放行）。

## [S1] Problem

独立二开后，分析报告 P1 仍成立：

1. GitHub Actions **从不**运行后端测试（`pom.xml` 默认 `maven.test.skip=true`，`Dockerfile.server` `-DskipTests`，workflow 无 maven 步骤）；console 的 `check` 也未接入流水线。
2. 上游 `owndsh-system` 的 `/system/**`、`/monitor/**` HTTP 面仍在 classpath；当前仅靠 nginx 不路由遮蔽。一旦有人发布 server 端口或加一条 location，暴露面立刻可达，且不在企业审计白名单内。
3. 本地缺少一键门禁入口，三站 `--check`、compose 密钥必填、日志扫描等约定分散，难以在提交前执行。

## [S2] Design

### S2.1 遗留管理面 HTTP 拒绝

- 在 `owndsh-common-security` 增加高优先级 Servlet Filter：凡路径匹配 `/system/**` 或 `/monitor/**`（含前缀后 `/` 或结尾）直接 **404**，响应体 `{"error":"ENT_LEGACY_SURFACE_DISABLED"}`。
- **不**删除 `owndsh-system` 模块（企业层进程内仍依赖 `ISysUserService` / `sys_user` 表）；只切断 HTTP 暴露。
- 逃生口：环境变量 `ENT_LEGACY_HTTP_SURFACE_ENABLED=true` 时放行（默认 false）。仅 env，不引入 Spring 属性双源。
- 单元测试锁定路径判定与 `doFilter` 行为。

### S2.2 CI 门禁（`release.yml`）

| Job | 内容 |
|---|---|
| `server-check` | Java 21 + enterprise+server `mvn test` + surefire 扫描 |
| `console-check` | Node 24 + pnpm 11.24 + `pnpm --dir console run check` |

`images`/`plugin-publish` 的 `needs` 保持现状，首日不卡死发布。

### S2.3 本地 `scripts/check-all.sh`

compose config（无 `.env` 时 dummy 注入）、扫描器自测、三站 `--check`；`FULL=1` 时追加 mvn 与 console。缺资产时用 `SKIP_SITES=1` 跳过三站。

### S2.4 文档回环

`FORK.md` §4 勾选 CI/legacy/check-all，并**保留**品牌改名开放项；相关 L2/L3 与 `docs/compose/` 已登记。

## [S3] Out of Scope

- 物理删除 `owndsh-system` Controller 或 Maven 模块
- Provider / 身份源测试动作补审计
- 插件黑名单对齐、退休版本 SQL 修复
- 阶段三 Java 包名 / 镜像 / npm 改名
- 修改 `Dockerfile.server` 的 `-DskipTests`
- 改变 `plugin-publish` 对 `server-check` 的依赖关系
- 本机跑通 GitHub Actions runner 上的 FULL 集成套件

## Tasks

- [x] T1: 实现 Legacy HTTP 面拒绝 Filter + 单元测试 — acceptance: `/system/**` 与 `/monitor/**` 返回 404 且含 `ENT_LEGACY_SURFACE_DISABLED`；企业与健康路径不受影响；`SecurityConfigEnterpriseRouteTest` 语义不回退 (covers: S2.1)
- [x] T2: `release.yml` 增加 `server-check` 与 `console-check` — acceptance: workflow YAML 含两 job；命令与 S2.2 一致 (covers: S2.2)
- [x] T3: 新增 `scripts/check-all.sh` 并更新 scripts L2 — acceptance: 无 `.env` 时可完成 compose config；扫描器自测可跑；`FULL=1` 文档化 (covers: S2.3)
- [x] T4: 更新 FORK/CLAUDE 回环 — acceptance: FORK P1 勾选状态与实现一致；相关 L2 提及新文件 (covers: S2.4)
- [x] T5: 本地验证并记录 — acceptance: 至少跑通扫描器自测 + compose config + 安全 Filter 单元测试；给出命令与结果 (covers: S2.1, S2.2, S2.3)
