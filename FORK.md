# FORK.md — 脱钩策略与二开基线

> **产品命名（已定）**  
> - 英文全称：**DSH Enterprise**  
> - 中文全称：**DSH 企业版**  
> - 简称：**DSH-Ent**  
> - 技术前缀 / 内部代号：**dshent**  
> 本文件是「不再与上游同步、完全自行二开」的制度真源。变更策略时先改这里。

## 1. 立场

| 项 | 决定 |
|---|---|
| 上游 | 历史来源：[boe1900/owndsh](https://github.com/boe1900/owndsh)（MIT），更深 vendored 源：[dromara/RuoYi-Vue-Plus](https://github.com/dromara/RuoYi-Vue-Plus) |
| 同步 | **永不同步**。不设 upstream remote 的自动回流；不接受「跟一下上游最新」的隐式假设 |
| 真源 | 本 monorepo 即唯一开发真源。`enterprise/` 为企业部署层与对外站点，与产品代码同仓 |
| 品牌 | **DSH Enterprise / DSH 企业版**，简称 **DSH-Ent**，技术前缀 **dshent**；Java 包名、表前缀按下方清单渐进改名 |
| 许可 | 保持 MIT；必须保留 RuoYi-Vue-Plus / OwnDsh 版权行（见 `server/LICENSE` 与 `NOTICE`） |

## 2. 仓库形态（monorepo）

```
owndsh/                         # 工作区目录名暂保留；产品标识见 FORK 代号
├── server/                     # Java 后端（含 vendored common/system）
├── console/                    # React 控制台
├── plugin/                     # Harness 插件工作区
├── contracts/                  # OpenAPI 真源
├── deploy/                     # Compose / nginx / 安装脚本
├── enterprise/                 # 部署层：官网 / 帮助 / API 文档 / patches / 运维记录
│   ├── site/  help/  api-docs/  docs-assets/
│   ├── patches/  analysis/  DEPLOYMENT.md
├── docs/  website/  scripts/  upstream/
├── FORK.md  NOTICE  README.md
└── docker-compose.yml          # 薄入口 → deploy/compose/compose.yml
```

约定：

- 产品功能改 `server/` `console/` `plugin/` `contracts/`；
- 对外站点与部署补丁改 `enterprise/`，**不再**维护独立的 dsh-enterprise 仓库补丁重放；
- `enterprise/patches/` 仅作历史存档与服务器应急，新改动直接进 monorepo 源。

## 3. vendored 上游策略（冻结 + 逐步吸收）

`server/owndsh-common/**` 与 `server/owndsh-modules/owndsh-system/**` 视为**冻结遗产**：

1. **不**主动 rebase / vendor 升级 RuoYi-Vue-Plus；
2. 未使用的 HTTP 面（`/system/**`、`/monitor/**` 等）按需物理删除或显式 404 拦截，**不得**仅依赖 nginx 不路由当安全边界；
3. enterprise 真正 import 的能力（用户/角色等）逐步收拢到自研模块后，再删对应 vendored 代码；
4. 每次吸收记录：来源文件、是否仍保留、替代实现位置。

## 4. 合规清单（已处理 / 待办）

| 状态 | 事项 |
|---|---|
| ✅ | `server/LICENSE` 恢复 `Copyright (c) 2019 RuoYi-Vue-Plus`，并追加 OwnDsh / dshent 版权行（不再改名顶替） |
| ✅ | 根目录 `NOTICE` 记录三层来源与 DeepSeek 免责 |
| ✅ | Compose 层移除公开默认 JWT / 主密钥（见 §5） |
| ✅ | CI 接入 `server-check`（mvn 测试 + 日志扫描）与 `console-check`（`release.yml`） |
| ✅ | 遗留 `/system/**` `/monitor/**` HTTP 面默认 404（`LegacyAdminSurfaceFilter`；逃生口 `ENT_LEGACY_HTTP_SURFACE_ENABLED`） |
| ✅ | 本地 `scripts/check-all.sh` 一键门禁 |
| ⬜ | 全局文案与镜像名去 `owndsh` 品牌（见 §6，可分期） |
| ⬜ | Provider / 身份源测试动作补审计（分析报告 P1） |

## 5. 安全脱钩（密钥默认值）

历史 compose 提供与 `.env.example` 相同的公开弱默认：

- `SA_TOKEN_JWT_SECRET_KEY=owndsh-jwt-secret-change-me-…`
- `ENT_MASTER_KEY=0123456789abcdef…`

本 fork 基线：

1. `deploy/compose/compose.yml` 对上述两项改为 `${VAR:?required}`，缺失或空值**拒绝启动**；
2. `.env.example` **不再**写入可用弱密钥，只留占位与生成说明；
3. 本地起栈前运行 `scripts/gen-secrets.sh` 写入 `.env`（已在 `.gitignore` 排除）；
4. 已部署服务器上的真实 `.env` 不受影响；升级 compose 后需确认两项已设置。

## 6. 改名清单（渐进，非一次大爆炸）

阶段一（已完成，标识层）：

- 内部代号 / 文档统一称 **dshent** 或 **DSH Enterprise**
- `NOTICE` / `FORK` / README 脱钩声明

阶段二（本轮进行中，构建与运行标识）：

| 位置 | 状态 | 值 |
|---|---|---|
| 展示名 | ✅ | DSH Enterprise / DSH 企业版 / DSH-Ent |
| Compose project 默认 | ✅ | `dshent`（`OWNDSH_COMPOSE_PROJECT_NAME` 可覆盖） |
| 本地构建镜像默认 | ✅ | `dshent-server:0.1.0` / `dshent-console:0.1.0` |
| 官网 / 帮助 / API 文档标题与免责 | ✅ | 已切换；站点 dist 需重新构建后生效 |
| `OWNDSH_*` 环境变量名 | ⬜ 保留 | 仍兼容旧名；阶段三再评估 `DSHENT_*` 主前缀 |
| 拉取用 GHCR 镜像 | ⬜ 暂保留 | `ghcr.io/boe1900/owndsh-*`；自有 registry 后再切 |
| npm 插件名 `dshent-plugin` | ✅ 已完成 | 员工安装命令改为 dshent-plugin@next；已推送 |
| 控制台 UI 字符串 OwnDsh 设置 | ✅ 源码已切 | 侧栏/登录/favicon 使用 `dshent-whale.png` + DSH Enterprise；需部署 `dshent-console` 镜像 |

阶段三（代码标识，成本最高）：

| 位置 | 说明 |
|---|---|
| Java 包名 `com.owndsh.*` | 建议改为 `com.dshent.*` 或公司域名反写；与 Flyway 表前缀 `ent_` 可解耦分步 |
| Maven `groupId` / artifactId | 与包名一并改 |
| 前端 `@dshent/*` 包与生成路径 | 与 contracts 生成脚本、plugin 工作区一并改 |
| 表名前缀 `ent_` / 错误码 `ENT_*` | **可不改**（已是企业命名空间）；避免无收益的 DB 迁移 |
| 环境变量主前缀 `OWNDSH_*` → `DSHENT_*` | 双读一段时间后删旧名 |
| npm 包名与控制台侧栏文案 | 需同步安装文档与员工升级说明 |

**原则**：二进制兼容与 DB 迁移成本高的标识最后改；文档与对外品牌可先改。

## 7. 升级与发布

- 版本号与 CHANGELOG 自管，不再对齐上游 tag；
- 镜像从本仓构建（根 `docker-compose.override.yml` 已支持本地 build）；
- `enterprise/` 站点构建仍用零依赖 Node 脚本，路径以 monorepo 根为准。

## 8. 禁止事项

- 不得把 `server/LICENSE` 里的 RuoYi-Vue-Plus 版权行删掉或改名顶替；
- 不得把 `.env`、生产密钥、`*.pem` 提交进仓；
- 不得假设「上游已经修了」而跳过本仓测试；
- 不得在未更新 `NOTICE` / 本文件的情况下引入新的第三方源码树。
