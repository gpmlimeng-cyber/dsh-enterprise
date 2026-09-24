<!--
[INPUT]: 依赖控制台品牌资源、可覆盖的容器镜像引用、根 Docker Compose、npm 插件、Harness profile 与本 fork 产品边界；Session 同步状态见 docs/session-sync-revival-decision.md。
[OUTPUT]: 提供品牌展示、Compose 自托管、管理员初始化、员工桌面客户端入口、员工插件、更新、排障与静态官网发布入口。
[POS]: DSH Enterprise（dshent）公开用户入口；见 FORK.md，不再与上游 owndsh 同步。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md / FORK.md
-->

> **独立二开仓库 · DSH Enterprise（DSH 企业版）**：已与上游 [boe1900/owndsh](https://github.com/boe1900/owndsh) 脱钩，不再同步。  
> 分叉策略见 [`FORK.md`](FORK.md)；版权见 [`NOTICE`](NOTICE)。  
> 本地起栈前：`cp .env.example .env && sh scripts/gen-secrets.sh`（并修改 DB/Redis 口令）。

<div align="center">

<img src="console/public/owndsh-whale-mono-m2-animated.png" alt="DSH Enterprise 图标" width="128" height="128">

<h1>DSH Enterprise</h1>
<h2>DSH Enterprise · Truly Own Your DeepSeek-Harness.</h2>
<p><em>简称 DSH-Ent · 技术前缀 dshent</em></p>
<p><em>The Self-Hosted Control Plane for DeepSeek-Harness.</em></p>
<p>DSH 企业版：真正拥有属于你的 DeepSeek-Harness。<br>DeepSeek-Harness 的私有化控制面。</p>

</div>

**DSH Enterprise（DSH 企业版，简称 DSH-Ent）** 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的自托管团队控制面。管理员统一管理身份、模型、API Key、访问权限、配额、插件、设备和审计；员工继续在自己的 DSH Desktop 或 Harness Web 中工作。

DSH Enterprise 不 fork 官方 Harness Web UI，不接管员工工作区，也不远程执行员工工具。员工可以安装标准 Harness 插件（`dshent-plugin`），或使用预装插件和运行环境的 Desktop 客户端。

> **独立产品声明**：DSH Enterprise 是独立项目，与 DeepSeek AI 无隶属关系，**不是** DeepSeek 官方企业版。

> 当前处于预发布阶段。Docker 镜像只发布 `next`，npm 插件只发布 `next`，不会更新 `latest`。

## 能力

| 使用者 | 能力 |
|---|---|
| 平台管理员 | 自托管控制台、LOCAL/LDAP/OIDC 身份、成员与设备治理 |
| 模型管理员 | 集中保管供应商 API Key，管理模型、模型集、授权、Token、RPM 与并发 |
| 插件管理员 | 上传、签名、发布企业插件，设置可见范围并查看客户端状态 |
| 审计员 | 查询管理操作、模型调用、用量与 request ID 关联记录 |
| 员工 | 用企业账号登录 Harness，使用获准模型并自主安装企业插件，无需持有上游 API Key |

## 会话同步（可选能力 · 开发中）

目标：员工换电脑后，登录企业账号从会话列表**恢复并继续**任务（企业 Server 密文副本 + 恢复为**新本地会话**），不是个人 Git 会话镜像，也不默认开启。

| 项 | 状态 |
|---|---|
| 产品决议 | 已完成，见 [session-sync-revival-decision.md](docs/session-sync-revival-decision.md) |
| 服务端（T16） | 已具备批次/加密/审计能力 |
| `enterprise.session.enabled` | 默认 **`false`**（V1 客户端零 Session 同步请求） |
| 客户端上传 / 恢复 / UI | **未交付**；实现分支与路线图见 `feat/session-sync-p2a` 上的 `docs/compose/spec/session-sync-client-roadmap.md` |
| 社区参考 | 生态吸收见分支 `feat/session-sync-ecosystem` → `docs/ecosystem/dsh-session-sync-absorption.md` |

部署若将来打开旁路，仅在显式 `enterprise.session.enabled=true` 后 bootstrap 才会向客户端宣告 `sessionPolicy.enabled=true`；当前默认配置下员工端**不会**出现会话同步入口。

## Docker Compose 部署

当前镜像目标为 Linux `amd64`。准备 Docker Engine、Docker Compose `2.20.3+` 和 Git。

### 1. 启动

```sh
git clone https://github.com/gpmlimeng-cyber/dsh-enterprise.git
cd dsh-enterprise
docker compose up -d --wait
```

默认访问 [http://localhost:8080](http://localhost:8080)。引导管理员账号默认 `admin`，口令在 `.env` 的 `ENT_BOOTSTRAP_ADMIN_PASSWORD` 中配置；第一次登录会强制改密。数据库与账号由 PostgreSQL 创建，全部建表、种子数据和后续升级由 Server 内置 Flyway 自动执行。

需要让其他设备访问或覆盖默认凭据时，创建 `.env`：

```sh
cp .env.example .env
sh scripts/gen-secrets.sh
```

DSH Enterprise 只有一个公开地址配置。默认由 Compose 生成为 `http://localhost:8080`；需要让局域网设备访问时，把它改成部署机的实际 IP 和发布端口，例如：

```dotenv
ENT_PUBLIC_BASE_URL=http://192.168.1.50:8080
```

其中 `192.168.1.50` 替换为运行 Docker Compose 的机器 IP；若修改 `OWNDSH_HTTP_PORT`，这里使用相同端口。管理端回调会自动派生为 `<ENT_PUBLIC_BASE_URL>/enterprise/auth/callback`，不需要单独配置。

生产环境应由现有 Nginx、Ingress 或负载均衡提供可信 HTTPS，并把这个值改成外部 HTTPS 地址。DSH Enterprise Compose 只开放 Console 的 HTTP 端口，不直接管理证书。**JWT 与 master key 在 `.env.example` 中为空，必须先执行 `sh scripts/gen-secrets.sh` 或外部注入，否则 Compose 拒绝启动**（见 `FORK.md` §5）；数据库与 Redis 口令同样不得在公网使用示例值。

### 2. 生成密钥并设置初始密码

```sh
cp .env.example .env
sh scripts/gen-secrets.sh
# 编辑 .env：填写 DB/Redis 口令与引导管理员口令
```

```dotenv
ENT_BOOTSTRAP_ADMIN_USERNAME=admin
ENT_BOOTSTRAP_ADMIN_PASSWORD=<一次性口令>
```

第一次登录会强制设置符合安全策略的正式密码。

### 3. 管理服务

```sh
docker compose up -d --wait
docker compose ps
docker compose logs -f server
```

Server 日志仅输出到 stdout/stderr，由 Docker/K8s 与日志平台采集和轮转，不需要应用日志卷。

打开 `ENT_PUBLIC_BASE_URL` 配置的地址，以配置的初始账号和密码登录。数据库 marker 保证初始化只执行一次；首次改密后，默认初始密码立即失效。

### 4. 配置企业

1. 在“成员”中配置 LOCAL、LDAP 或 OIDC 身份来源。
2. 在“模型”中添加供应商、API Key 和受管模型。
3. 创建模型集，并向全部成员、用户组或指定成员授权。
4. 按需配置 Token 配额、RPM 和并发限制。
5. 按需上传、发布企业插件，并设置对全部或指定成员可见。
6. 邀请员工安装 DSH Enterprise 并登录；企业插件由员工在市场自行选择安装。

员工设备不会得到供应商 API Key；每次模型请求都由 DSH Enterprise 网关重新校验身份、授权和额度。

## 桌面客户端

后台在 `server/` 和 `console/`，自研插件在 `plugin/`，员工安装包在 `apps/`。现在只有桌面端。桌面客户端和插件基线都使用官方 DeepSeek Harness Desktop `0.1.7-rc.1`；`apps/desktop` 用这把锁构建自己的安装包，可改品牌并带上企业插件。上游源码不入库，安装包也不得宣传成 DeepSeek 官方软件。社区 Desktop 2.0.3 不再是插件基线。Web 和移动端在有版本锁前不建目录。

```sh
node scripts/bootstrap-harness-desktop.mjs
```

版本、本地安装边界和插件关系见[桌面客户端说明](docs/desktop-client.md)。

## 安装员工插件

已有官方 Harness Desktop 的设备用下面的命令安装企业插件。插件基线是官方 Desktop `0.1.7-rc.1`；旧的已映射 Harness 版本仍可按 caret peer 安装，但不再作为开发基线。

先确保 `pnpm` 是 PATH 中可直接执行的命令。Harness 当前基线使用 pnpm `11.7.0`：

```sh
corepack enable
corepack install --global pnpm@11.7.0
pnpm --version
```

安装 npm 测试版到需要使用的 profile：

```sh
# Harness Web
dsh plugin --profile web add --ignore-scripts dshent-plugin@next
dsh --profile web

# DSH Desktop
dsh plugin --profile desktop add --ignore-scripts dshent-plugin@next
```

从 DeepSeek Harness 源码运行 CLI 时：

```sh
pnpm --dir /path/to/deepseek-harness dsh \
  plugin --profile web add --ignore-scripts dshent-plugin@next
```

安装完成后重启对应 profile。DSH Enterprise 全屏页面会要求填写管理员提供的 DSH Enterprise Server HTTP(S) 地址；保存后完成企业登录即可使用管理员授权的模型。

Server 地址和 Refresh Token 由 Harness Host 的官方 settings/credentials 服务持久化。Access Token 只存在 Host 内存，浏览器页面不会读取或保存 Token；正常重启会静默恢复登录。主动退出、设备撤销、成员停用、改密或 30 天有效期结束后需要重新登录。

「DSH Enterprise 设置 → 插件」展示管理员发布且对本人可见的插件，支持搜索、详情、自主安装、更新和卸载。打开设置或刷新不会安装插件；其他设备独立选择。服务端签名（`ENT_PLUGIN_SIGNING_ENABLED=false`）和客户端验签（`verifyPluginSignatures=false`）默认关闭，无需配置公私钥；大小、SHA-256、兼容性和下载权限仍会校验。需要验签时可开启 `verifyPluginSignatures` 并配置部署专属公钥，详见[信任配置](plugin/packages/plugin-distribution/README.md)。从旧版迁移时必须更新员工 DSH Enterprise 插件，仅更新后台无法改变旧客户端的公钥要求或自动安装行为。

DSH Enterprise 闲置时不建立企业 SSE、不定时拉配置或提前续期。用户请求时按需续期，服务端认证 401 最多续期重试一次；Refresh Token 失效或设备撤销时显示登录门禁，重新登录后可继续对话。网络暂不可达保留凭据，可再次发起请求或在 DSH Enterprise 设置点击刷新；模型与插件目录在打开设置或主动刷新时更新。

## 更新

更新服务端测试镜像：

```sh
docker compose pull
docker compose up -d --wait
```

更新员工插件：

```sh
dsh plugin --profile web remove dshent-plugin
dsh plugin --profile web add --ignore-scripts dshent-plugin@next
```

把 `web` 换成实际使用的 profile。移除后重新安装可以避免 pnpm 复用同版本缓存。

## 常见问题

### `pnpm not found on PATH`

执行上面的 `corepack enable` 和 `corepack install --global pnpm@11.7.0`，直到直接运行 `pnpm --version` 成功。只写 `corepack pnpm ...` 不够，因为 `dsh plugin` 的子进程仍需要从 PATH 找到 pnpm。

### 保存 Server 后显示平台不可用

从员工设备访问 `<Server地址>/healthz`，再检查 DNS、防火墙、反向代理和 TLS 证书。Server 地址必须是完整 HTTP(S) origin，不能附带 API 路径。

### 登录后看不到模型

确认供应商和模型都已启用，并且该员工、员工所在用户组或全部成员拥有对应模型访问授权。配额策略不会代替访问授权。

### 重启后要求重新登录

确认启动的是原 profile，且它的官方 credentials provider 可写。主动退出、Server 地址切换、设备/成员撤销和 30 天有效期结束都会使长期会话失效。

### 能否像微信一样换设备接着聊？

企业侧「会话同步」是**可选、默认关闭、客户端上传/恢复尚未交付**的能力（见上文）。V1 只提供登录、受管模型与插件；本地会话默认仍留在各机 Harness 中。不要把社区 Git 会话同步插件当成企业 Server 复制。

### GHCR 镜像无法拉取

仓库维护者首次发布后需要把 `owndsh-server` 和 `owndsh-console` 两个 GHCR package 设为 Public。部署机无需 GitHub Token。

## 运维与开发

- [官网与 Cloudflare Pages 部署](website/README.md)
- [离线发布包、备份、恢复、升级与回滚](deploy/README.md)
- [插件 workspace 与真实 Harness 验收](plugin/README.md)
- [V1 产品功能清单](docs/v1-product-feature-catalog.md)
- [技术架构与安全边界](docs/owndsh-governance-mvp-design.md)

本地开发体验可运行 `./scripts/local-demo.sh`。该脚本要求同级存在锁定的 `deepseek-harness` checkout，并使用隔离状态启动正式 Server 和 Harness。

## 上游与声明

DSH Enterprise 是独立项目，不隶属于 DeepSeek AI 或 Anywhere Labs。DeepSeek Harness 与 DSH Desktop 的名称、代码和商标归各自所有；DSH Enterprise 只通过公开插件扩展点集成。
