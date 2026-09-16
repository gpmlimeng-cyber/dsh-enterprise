# OwnDsh 部署记录

## 访问信息

| 项 | 值 |
|---|---|
| 控制台地址 | **http://62.234.16.179** |
| 管理员账号 | `admin` |
| 管理员密码 | 见 `/opt/owndsh/CREDENTIALS.txt`（权限 600） |
| 部署版本 | `0.1.0`（源码 commit `225c5a2`） |
| 镜像 | `ghcr.io/boe1900/owndsh-server:0.1.0` / `ghcr.io/boe1900/owndsh-console:0.1.0` |

## 目录结构

```
/opt/owndsh/
├── src/                      # 用户提供的 owndsh-0.1.0 源码
│   ├── .env                  # 部署配置（含真实密钥，权限 600）
│   ├── docker-compose.override.yml   # 本地修复层（nginx 动态 DNS）
│   └── deploy/nginx/
│       ├── nginx.conf        # 已修复：运行时解析上游
│       └── nginx.conf.orig   # 上游原始配置备份
├── owndsh.sh                 # 运维入口脚本
├── CREDENTIALS.txt           # 凭据（权限 600）
└── DEPLOYMENT.md             # 本文件
```

## 运维命令

```sh
/opt/owndsh/owndsh.sh ps                 # 查看状态
/opt/owndsh/owndsh.sh logs -f server     # 查看日志
/opt/owndsh/owndsh.sh restart            # 重启
/opt/owndsh/owndsh.sh down && /opt/owndsh/owndsh.sh up -d   # 重建
```

> ⚠️ 严禁执行 `docker compose down -v`，会删除 PostgreSQL / Redis / artifact 数据卷。

## 部署过程中的三个关键问题与处置

### 1. 安全组只放行 80/443/22，8080 不可达

初版按默认配置映射宿主机 8080，公网访问返回空响应。诊断发现：

- 服务器本机访问 `10.2.4.5:8080` 正常，访问 `62.234.16.179:8080` 超时
- `tcpdump` 显示 SYN 发出后无 SYN-ACK 返回
- 云端存在 `YJ-FIREWALL-INPUT` 链，且对**任意端口**（含无服务的 9999）都秒握手，是中间设备的伪应答

**处置**：将 `OWNDSH_HTTP_PORT` 改为 `80`，`ENT_PUBLIC_BASE_URL` 改为 `http://62.234.16.179`。这与项目架构一致——OwnDsh 自身不终止 TLS，TLS 应由外部反向代理提供。若后续需要 HTTPS，在安全组放行 443 后由 Nginx/负载均衡代理到 80 即可。

### 2. GHCR 直连几乎不可用（12 KB/s）

从 `ghcr.io` 拉取 server 镜像的 123MB 层，实测 35 秒仅下载 434 KB，且多次完全停滞（40.89MB 处卡死不动）。

**处置**：改用南京大学 GHCR 镜像源 `ghcr.nju.edu.cn`，40 秒内拉完，随后用 `docker tag` 打回 compose 期望的 `ghcr.io/...` 标签。镜像 digest 与官方一致，已校验：
- server: `sha256:a57e66c906ebde5c8da44f88a707eca08438f78bbe97c15c786ee6f1f9e622c4`
- console: `sha256:f6f19da9e90150f186879942aef008b47ce089a9a3915ec0a4c46cf1c647a877`

### 3. 上游缺陷：容器重建后 Console 永久 502

Docker Hub 在本机不可达，`postgres` / `redis` 走腾讯云镜像源（digest 与 Dockerfile 锁定值一致）。

**该问题不影响本次部署**，但务必知晓：`deploy/nginx/nginx.conf` 使用 `upstream enterprise_server { server server:8080; }`，nginx 在**启动时**解析并永久缓存该 IP。任何导致 server 容器 IP 变化的重启（`down`/`up`、`docker compose restart`、宿主机重启）都会让 console 持续 502，且**不会自愈**。

**处置（本地修复层）**：修改 `deploy/nginx/nginx.conf` 改用 Docker 内嵌 DNS 运行时解析：

```nginx
http {
  resolver 127.0.0.11 valid=10s ipv6=off;
  resolver_timeout 5s;
}
server {
  set $upstream_server server:8080;   # server 块级定义，所有 location 共享
  ...
  proxy_pass http://$upstream_server;
}
```

并通过 `docker-compose.override.yml` 将该文件挂载进 console 容器。已通过 `docker compose down && up` 完整重建验证（server IP 在 `.3`/`.4` 间变化，`/healthz` 均正常）。

> 注意：变量必须定义在 `server` 块级。若只定义在某个 `location` 内，其他 location 会报 `using uninitialized "upstream_server" variable` 并返回 500。

**建议将该修复提交给上游**，修复后即可删除 `docker-compose.override.yml`。

## 验收结果

| 检查项 | 结果 |
|---|---|
| 4 个容器全部 healthy | ✅ |
| Flyway 迁移（30 个，至 v29） | ✅ |
| `GET /healthz` 公网 | ✅ 200 `{"status":"UP"}` |
| Console 首页与静态资源 | ✅ 200 |
| 真实登录（captcha + PKCE） | ✅ 强制改密流程 → 授权码 |
| 管理员会话与管理 API | ✅ 200，角色 `enterprise_admin`，17 项权限 |
| 正式密码重新登录 | ✅ 直接 `REDIRECT`，不再要求改密 |
| `down` + `up` 完整重建 | ✅ 自愈，无 nginx 解析错误 |
| Docker 开机自启 | ✅ `enabled`，容器 `restart: unless-stopped` |

## 已知限制

- 当前为 **HTTP**（80 端口）。如需 HTTPS，需在安全组放行 443 并前置反向代理。
- 未启用插件签名（`ENT_PLUGIN_SIGNING_ENABLED=false`），符合默认开箱配置。
- 身份源目前仅 LOCAL；LDAP/OIDC 需登录控制台后配置。
- `.env` 中的密钥为该部署专属随机生成，请纳入备份流程；`ENT_MASTER_KEY` 丢失将导致 provider secret 与 Session 正文不可恢复。

---

## API 文档门户（P1 · 2026-09-16 上线）

在控制台同源提供标准 SaaS 形态的 API 文档页，**零后端改动、零 server 镜像重建**。

### 访问信息

| 项 | 值 |
|---|---|
| 地址 | **http://62.234.16.179/api-docs/** |
| 可见范围 | 已登录控制台的**任意角色**（`enterprise_admin` / `model_admin` / `plugin_admin` / `auditor`） |
| 未登录 | `302 → /login?redirect=%2Fapi-docs%2F` |
| 渲染器 | Scalar API Reference **1.68.0**（MIT，自托管，无 CDN）sha256 `6a1407db14f57f7be9c98464b6d7e8899ba417c63b0d81363db2efb3e1022e1f` |
| 文档规模 | 97 个操作 / 21 个 tag / 4 个分组 / 230 个模型 / 42 个错误码 |
| Try it out | 同源携带 `enterprise-admin` 会话 Cookie，**读写接口均可直接试调**（写操作在文档里带醒目风险提示） |

### 目录结构（部署层，不污染上游源码）

```
/opt/owndsh/api-docs/
├── config/
│   ├── tags.yaml             # 4 个 tagGroup / 21 个 tag 与 97 个 operationId 的映射
│   ├── overlay.zh.yaml       # 97 条中文摘要/描述、权限标注、写操作标记、42 个错误码释义
│   └── intro.zh.md           # 概览 / 鉴权与安全 / 三条快速开始 / 通用约定
├── public/                   # index.html（Scalar 宿主页）、theme.css、fonts/（自托管字体）
├── vendor/                   # scalar.standalone.js（3.7MB，gzip 1.05MB）+ sha256
├── build-docs.mjs            # 零依赖 Node 脚本：合并文案、提取权限、注入 servers/tags、瘦身、指纹、--check 门禁
└── dist/                     # 生成物，bind mount 进 console 容器（只读）
```

### 更新文档（无需重启容器）

```sh
cd /opt/owndsh/api-docs
# 改 config/*.yaml 或 public/* 之后重新生成；宿主无 node，构建在容器内跑
docker run --rm -v /opt/owndsh/api-docs:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -w /work -e OWNDSH_COMMIT=225c5a2 node:24-alpine node build-docs.mjs
# 门禁（CI/部署前自检）：契约新增接口而文档未覆盖时会失败
docker run --rm -v /opt/owndsh/api-docs:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -w /work node:24-alpine node build-docs.mjs --check --strict
```

`dist/` 是 bind mount，重新生成后**刷新页面即生效，无需 `docker compose up`**。

### 鉴权模型

- 文档静态资源与契约 JSON 均由 nginx `auth_request` 子请求 `/enterprise/admin/v1/bootstrap` 判定：
  已登录 → 子请求 200 → 放行；未登录 → 401 → 302 跳登录页。
- **复用既有接口，未新增任何后端端点**；`error_page 401` 限定在 `location /api-docs/` 内，
  因此 `/enterprise/*` 的 401 语义未被改动（仍为 401，供前端 `AuthRequiredError` 判断）。
- 页面带 `X-Robots-Tag: noindex, nofollow`，契约响应 `Cache-Control: no-cache`。

### nginx 变更（`src/deploy/nginx/nginx.conf`）

1. 新增 `absolute_redirect off;`（**P0 实测发现**：容器监听 8080、宿主只发布 80，
   nginx 默认会生成 `http://host:8080/login` 这类打不开的绝对跳转）。
2. 新增 `location /api-docs/`、`location = /_docs_auth`、`location @docs_login` 三块。
3. 备份：`nginx.conf.pre-api-docs`；override 备份：`docker-compose.override.yml.pre-api-docs`。

### 回滚

```sh
cd /opt/owndsh/src
cp -a deploy/nginx/nginx.conf.pre-api-docs deploy/nginx/nginx.conf
cp -a docker-compose.override.yml.pre-api-docs docker-compose.override.yml
docker compose up -d --no-deps console     # 只重建 console，不动 server/数据库
```

回滚后 `/api-docs/` 消失，其余功能不受影响（`/opt/owndsh/api-docs/` 可保留备用）。

### 已知边界

- 契约里的 97 个操作只有 29 条英文 `summary`、0 条 `description`，中文文案由 `overlay.zh.yaml` 提供；
  **改契约后必须同步补文案**，否则 `--check` 会失败（这是有意的漂移门禁）。
- 权限矩阵从 `@SaCheckPermission` 自动提取（95/97 命中；`bootstrap` 与改密接口本身不需要 `ent:*`）。
  上游事实：**配额管理接口复用 `ent:grant:read|write`**，会话正文读取用三段式 `ent:session:content:read`。
- Scalar 侧 `proxyUrl` 已显式置空，内网请求不会走 `proxy.scalar.com`；字体自托管，无外部 CDN 依赖。
- 文档门户为**部署层附加物**：上游 `owndsh-0.1.0` 源码未包含它，升级上游时需重放本节的 nginx 变更
  （补丁存档见工作区 `patches/`）。

---

## 帮助中心与文档入口（P2 · 2026-09-16 上线）

在控制台内提供两个文档入口，并上线与 API 文档同风格的**帮助中心**。

| 项 | 值 |
|---|---|
| 帮助中心 | **http://62.234.16.179/help/** （需登录，与 API 文档共用同一会话门禁） |
| API 参考 | **http://62.234.16.179/api-docs/** （已有） |
| 控制台入口 | 左侧导航栏「帮助中心」「API 文档」（新标签页打开，不进入页面 Tab 体系） |
| 生成器 | `/opt/owndsh/help/build-help.mjs`（零 npm 依赖，纯 Node 内置模块） |
| 共享资产 | `/opt/owndsh/docs-assets/`（`theme.css` + `fonts/`，两站同源，避免样式漂移） |
| 内容规模 | 已撰写 **5 篇 + 首页**，`config/site.yaml` 规划共 **37 篇**（其余标注"撰写中"） |
| 控制台镜像 | `ghcr.io/boe1900/owndsh-console:0.1.0-docs`（原 `:0.1.0` 保留可回滚） |

### 更新帮助内容（无需重启容器）

```sh
# 1) 刷新事实快照（角色权限矩阵来自运行库；界面文案语料来自控制台镜像）
sh /opt/owndsh/help/tools/collect-facts.sh

# 2) 门禁校验（frontmatter / sourceRefs / uiLabels / 站内链接与锚点）
docker run --rm -v /opt/owndsh/help:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -v /opt/owndsh:/opt/owndsh:ro -e OWNDSH_DEPLOY_ROOT=/opt/owndsh \
  -w /work node:24-alpine node build-help.mjs --check

# 3) 生成 dist/（bind mount，刷新页面即生效）
docker run --rm -v /opt/owndsh/help:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -v /opt/owndsh:/opt/owndsh:ro -e OWNDSH_DEPLOY_ROOT=/opt/owndsh \
  -w /work node:24-alpine node build-help.mjs
```

### 自动生成页（不靠人工抄写）

| 页面 | 真源 | 现状 |
|---|---|---|
| 角色与权限矩阵 | 运行库 `sys_role`/`sys_role_menu`/`sys_menu.perms` | ✅ 已上线：企业管理员 17 / 模型管理员 6 / 插件管理员 3 / 审计员 4 个 `ent:*` 权限 |
| 首页分组与进度卡片 | `config/site.yaml` + 实际已撰写页数 | ✅ 已上线 |
| 配置项参考、错误码速查、界面地图 | `.env.example`、契约、tag 映射 | 规划中（P3） |

### 门禁实测（它确实拦住了东西）

首次运行时 `--check` 拦下 3 个真实问题，均已修复：

1. `sourceRefs` 指向的 `DEPLOYMENT.md` 不在源码树内 → 增加"部署层根"解析（`OWNDSH_DEPLOY_ROOT`）；
2. 手册里写了界面按钮「卸载」，但**控制台产物里不存在**（卸载在企业插件市场/客户端，不在控制台）→ 从 `uiLabels` 移除；
3. 首页链到尚未撰写的错误码页 → 改为指向 API 参考的错误码字典。

### 控制台入口改动

- `console/src/app/console-shell.tsx`：侧栏 `navItems` 追加两个外链项（`DOC_TARGETS = { 'docs-help': '/help/', 'docs-api': '/api-docs/' }`），`onNavigate` 命中则 `window.open`，不进入 Tab 体系、不参与 `activeNav` 高亮；因而不影响既有的路由与角色过滤逻辑。
- 重建镜像（约 4 分钟，pnpm 安装 + vite + tsc 全绿）：

```sh
cd /opt/owndsh/src
docker build -f deploy/compose/Dockerfile.console -t ghcr.io/boe1900/owndsh-console:0.1.0-docs .
```

- `.env`：`OWNDSH_CONSOLE_IMAGE=ghcr.io/boe1900/owndsh-console:0.1.0-docs`（备份 `.env.pre-docs-nav`）。

### npm 镜像源（本部署可切换，已验证等价）

`deploy/compose/Dockerfile.console` 新增 `ARG OWNDSH_NPM_REGISTRY`（默认保持上游的 `registry.npmjs.org`）：

```sh
docker build -f deploy/compose/Dockerfile.console \
  --build-arg OWNDSH_NPM_REGISTRY=https://mirrors.tencentyun.com/npm \
  -t ghcr.io/boe1900/owndsh-console:0.1.0-docs-mirror .
```

**已验证**：官方源与腾讯镜像两次构建的 `dist` **逐字节一致**（`assets/*.js` + `index.html` 合并 sha256 = `06201725578c09ab`），
即镜像源只影响下载路径、不影响产物。本机网络对 `registry.npmjs.org` 可用，故线上镜像用的是官方源构建。

### 回滚

```sh
cd /opt/owndsh/src
cp -a deploy/nginx/nginx.conf.pre-help deploy/nginx/nginx.conf
cp -a docker-compose.override.yml.pre-help docker-compose.override.yml
cp -a .env.pre-docs-nav .env
docker compose up -d --no-deps console
```

只回滚**控制台入口**（保留帮助中心）：把 `.env` 的 `OWNDSH_CONSOLE_IMAGE` 改回 `:0.1.0` 再 `up -d --no-deps console` 即可。
只回滚**帮助中心**（保留入口）：删掉 `nginx.conf` 里的 `/help/` 两个 location 与 override 中的 help 挂载后重建 console。

### 已知边界

- 帮助中心为**部分撰写**状态（5/37）：未撰写页不出现在左侧导航，首页卡片显示"撰写中，敬请期待"，不产生死链。
- `/help/` 启用 CSP（`script-src 'self'` 等），因此页面**不得含内联脚本**——主题前导已外置为 `assets/theme-boot.js`。
- API 文档门户暂未启用 CSP（其宿主页含内联脚本）；若要与帮助中心一致加固，需先把该内联脚本外置并改用 `theme-boot.js` 范式。
- 帮助中心与 API 文档都通过 `auth_request` 复用 `/enterprise/admin/v1/bootstrap`，未新增任何后端接口。

### 浅色 / 深色主题切换（2026-09-16）

两个文档站点都提供了与控制台**同款**的主题切换控件（分段胶囊 + 滑动指示器），三者共用同一个 `localStorage` 键 `bui-theme`：

| 站点 | 位置 | 实现 |
|---|---|---|
| 帮助中心 `/help/` | 顶栏右侧 | `assets/help.js` 接线；翻转 `html.dark` + `data-theme`，写入 `bui-theme` |
| API 文档 `/api-docs/` | 页脚右侧 | 同上，并通过 Scalar 实例的 `updateConfiguration({…, darkMode})` 同步渲染器；`hideDarkModeToggle: true` 隐藏 Scalar 自带开关，避免两个控件打架 |
| 控制台 `/` | 登录页与服务壳 | 上游自带 `ThemeToggle`（同一存储契约） |

行为细节（与 console 的 `ThemeToggle` 对齐）：
- 无存储值时**默认深色**（与 console 一致）；
- 切换瞬间加 `html.theme-switching` 冻结过渡，避免上百个颜色各自动画；
- 跨标签页同步（监听 `storage` 事件）；
- 控件默认 `hidden`，由脚本接线后显示——无 JavaScript 时不会留下一个点不动的按钮；
- `theme.css` 中的 `.theme-toggle[hidden]{display:none}` 是必需的：作者样式的 `display` 会盖过 UA 的 `[hidden]`。

**行为验证**（静态检查无法证明"点了有效"）：

```sh
docker run --rm -v /opt/owndsh/help:/work -v /opt/owndsh/api-docs:/api-docs -w /tmp node:24-alpine \
  sh -c 'npm i --silent jsdom >/dev/null && NODE_PATH=/tmp/node_modules \
         OWNDSH_HELP_DIR=/work OWNDSH_API_DOCS_DIR=/api-docs node /work/tools/test-theme-toggle.cjs'
```

18 项断言全绿：类名翻转、`bui-theme` 持久化、`aria-pressed` 同步、指示器位移、重复点击幂等，
以及 API 文档页对 `updateConfiguration` 的调用契约（保留既有配置、只改 `darkMode`）。

---

## 文档门户改为完全公开（2026-09-16 · 产品决策）

按产品决策，API 文档与帮助中心**不再需要登录**，并对搜索引擎开放。

| 项 | 变更前 | 变更后 |
|---|---|---|
| `/api-docs/`、`/help/` | `auth_request` 复用 `/enterprise/admin/v1/bootstrap`；未登录 302 到登录页 | 直接静态提供，无鉴权 |
| 抓取策略 | 响应头 + 页面 meta 均为 `noindex, nofollow` | 均为 `index, follow` |
| 失效配置 | `location = /_docs_auth`、`@docs_login`、`@help_login` | 已删除（无引用） |

**配套防线（必读）**：帮助中心构建期新增「公开内容安全检查」，命中任一项即构建失败：
① 内网地址（`10.` / `172.16-31.` / `192.168.`）；② 部署 `.env` 中任何密钥类变量的**取值**；③ 私钥块。
因此**运维手册的内容必须保持"可公开"口径**，不得写入内网地址与备份路径等敏感信息。

**验证**：`/help/` 与 `/api-docs/` 均 200 且 `index, follow`；`/enterprise/admin/v1/bootstrap` 仍为 401（语义未受影响）；
帮助中心内联脚本数仍为 0（CSP 前提保持）。

**回滚**：`cp -a deploy/nginx/nginx.conf.pre-public-docs deploy/nginx/nginx.conf && docker compose up -d --force-recreate --no-deps console`

---

## 产品官网（P1 · 2026-09-16 上线）

| 项 | 值 |
|---|---|
| 地址 | **http://62.234.16.179/home/** （部署形态 C：先挂本机路径；不鉴权、可索引） |
| 页面 | 6 个公开页（首页 / 企业版 / 部署 / 下载 / 安全 / 关于）+ 404 + `sitemap.xml` + `robots.txt` |
| 生成器 | `/opt/owndsh/site/build.mjs`（零 npm 依赖，纯 Node 内置模块） |
| 素材 | 复用上游 `website/assets` 的真实截图与品牌图；样式令牌与字体取自 `/opt/owndsh/docs-assets` |
| SEO | 每页独立 title/description/canonical（带基路径）/OG/JSON-LD(`SoftwareApplication`)；根级 `robots.txt` 与 `sitemap.xml` 指向本页 |
| 预留占位 | 企业留资区、下载校验信息表、漏洞披露渠道、社区渠道、英文站（`site.locales` 增加 `en` 后自动输出 `hreflang`） |

### 更新官网（无需重启容器）

```sh
cd /opt/owndsh/site
# 门禁（链接与资源完整性 / SEO 必填 / og 图真实存在 / 外部域名白名单 / 公开内容安全）
docker run --rm -v /opt/owndsh/site:/work -v /opt/owndsh/docs-assets:/opt/owndsh/docs-assets:ro \
  -v /opt/owndsh/src:/opt/owndsh/src:ro -w /work node:24-alpine node build.mjs --check
# 生成 dist/
docker run --rm -v /opt/owndsh/site:/work -v /opt/owndsh/docs-assets:/opt/owndsh/docs-assets:ro \
  -v /opt/owndsh/src:/opt/owndsh/src:ro -w /work node:24-alpine node build.mjs
```

`dist/` 为 bind mount，重新生成后**刷新页面即生效**；注意生成器只清空 `dist` 内容、**不删除目录本身**
（删除目录会让容器内的挂载点指向已删除的 inode，表现为页面 403/500——见下文"踩坑记录"）。

### 迁移到域名根（或 Cloudflare Pages）

产物与路径无关，只需两个环境变量后重新构建：

```sh
OWNDSH_SITE_BASE=/ OWNDSH_SITE_ORIGIN=https://你的域名 node build.mjs
```

切到域名部署时，`nginx.conf` 里的 `location /home/` 改为 `location /` 的 server 块（或沿用上游 Pages 项目）。

### 门禁实测（它拦住了两个真实问题）

1. 分享图指向不存在的 `/og/*.png` → 门禁要求 `ogImage` 真实存在，于是改为复用真实截图；
2. 示例域名 `owndsh.example.com` 被判定为白名单外外部域名 → 改为占位写法（官网**不允许**任何第三方请求）。

### 三站互链

`/home/` ↔ `/help/` ↔ `/api-docs/` ↔ 控制台：官网页脚与顶栏指向两个文档站；两个文档站的页脚回指产品官网。
挂载自检 `tools/verify-mounts.sh` 现覆盖三个站点。

### 回滚

```sh
cd /opt/owndsh/src
cp -a deploy/nginx/nginx.conf.pre-site deploy/nginx/nginx.conf
cp -a docker-compose.override.yml.pre-site docker-compose.override.yml
docker compose up -d --force-recreate --no-deps console
```

---

## 文档门户改为完全公开（2026-09-16 · 产品决策）

按产品决策，API 文档与帮助中心**不再需要登录**，并对搜索引擎开放。

| 项 | 变更前 | 变更后 |
|---|---|---|
| `/api-docs/`、`/help/` | `auth_request` 复用 `/enterprise/admin/v1/bootstrap`；未登录 302 到登录页 | 直接静态提供，无鉴权 |
| 抓取策略 | 响应头 + 页面 meta 均为 `noindex, nofollow` | 均为 `index, follow` |
| 失效配置 | `location = /_docs_auth`、`@docs_login`、`@help_login` | 已删除（无引用） |

**配套防线（必读）**：帮助中心构建期新增「公开内容安全检查」，命中任一项即构建失败：
① 内网地址（`10.` / `172.16-31.` / `192.168.`）；② 部署 `.env` 中任何密钥类变量的**取值**；③ 私钥块。
因此**运维手册的内容必须保持"可公开"口径**，不得写入内网地址与备份路径等敏感信息。

**验证**：`/help/` 与 `/api-docs/` 均 200 且 `index, follow`；`/enterprise/admin/v1/bootstrap` 仍为 401（语义未受影响）；
帮助中心内联脚本数仍为 0（CSP 前提保持）。

**回滚**：`cp -a deploy/nginx/nginx.conf.pre-public-docs deploy/nginx/nginx.conf && docker compose up -d --force-recreate --no-deps console`

---

## 产品官网（P1 · 2026-09-16 上线）

| 项 | 值 |
|---|---|
| 地址 | **http://62.234.16.179/home/** （部署形态 C：先挂本机路径；不鉴权、可索引） |
| 页面 | 6 个公开页（首页 / 企业版 / 部署 / 下载 / 安全 / 关于）+ 404 + `sitemap.xml` + `robots.txt` |
| 生成器 | `/opt/owndsh/site/build.mjs`（零 npm 依赖，纯 Node 内置模块） |
| 素材 | 复用上游 `website/assets` 的真实截图与品牌图；样式令牌与字体取自 `/opt/owndsh/docs-assets` |
| SEO | 每页独立 title/description/canonical（带基路径）/OG/JSON-LD(`SoftwareApplication`)；根级 `robots.txt` 与 `sitemap.xml` 指向本页 |
| 预留占位 | 企业留资区、下载校验信息表、漏洞披露渠道、社区渠道、英文站（`site.locales` 增加 `en` 后自动输出 `hreflang`） |

### 更新官网（无需重启容器）

```sh
cd /opt/owndsh/site
# 门禁（链接与资源完整性 / SEO 必填 / og 图真实存在 / 外部域名白名单 / 公开内容安全）
docker run --rm -v /opt/owndsh/site:/work -v /opt/owndsh/docs-assets:/opt/owndsh/docs-assets:ro \
  -v /opt/owndsh/src:/opt/owndsh/src:ro -w /work node:24-alpine node build.mjs --check
# 生成 dist/
docker run --rm -v /opt/owndsh/site:/work -v /opt/owndsh/docs-assets:/opt/owndsh/docs-assets:ro \
  -v /opt/owndsh/src:/opt/owndsh/src:ro -w /work node:24-alpine node build.mjs
```

`dist/` 为 bind mount，重新生成后**刷新页面即生效**；注意生成器只清空 `dist` 内容、**不删除目录本身**
（删除目录会让容器内的挂载点指向已删除的 inode，表现为页面 403/500——见下文"踩坑记录"）。

### 迁移到域名根（或 Cloudflare Pages）

产物与路径无关，只需两个环境变量后重新构建：

```sh
OWNDSH_SITE_BASE=/ OWNDSH_SITE_ORIGIN=https://你的域名 node build.mjs
```

切到域名部署时，`nginx.conf` 里的 `location /home/` 改为 `location /` 的 server 块（或沿用上游 Pages 项目）。

### 门禁实测（它拦住了两个真实问题）

1. 分享图指向不存在的 `/og/*.png` → 门禁要求 `ogImage` 真实存在，于是改为复用真实截图；
2. 示例域名 `owndsh.example.com` 被判定为白名单外外部域名 → 改为占位写法（官网**不允许**任何第三方请求）。

### 三站互链

`/home/` ↔ `/help/` ↔ `/api-docs/` ↔ 控制台：官网页脚与顶栏指向两个文档站；两个文档站的页脚回指产品官网。
挂载自检 `tools/verify-mounts.sh` 现覆盖三个站点。

### 回滚

```sh
cd /opt/owndsh/src
cp -a deploy/nginx/nginx.conf.pre-site deploy/nginx/nginx.conf
cp -a docker-compose.override.yml.pre-site docker-compose.override.yml
docker compose up -d --force-recreate --no-deps console
```

### 修复记录：HTML 注释嵌套导致可见文本泄漏（2026-09-16）

- **现象**：官网 7 个页面各泄漏 2 行文件头注释（`[PROTOCOL]: … §4` 与 `§9 / §14`）。
- **原因**：`partials/nav.html`、`partials/footer.html` 的头部注释里写了 `<!-- inject:nav -->` / `<!-- inject:footer -->`，
  而 HTML 注释体内出现 `-->` 会提前闭合注释，后续文字变成正文。
- **修复**：片段注释改为不含注释标记的描述；`build.mjs` 新增注释完整性门禁
  （注释体内不得含 `--`、不得嵌套注释、剥离注释后不得残留 `[INPUT]/[OUTPUT]/[POS]/[PROTOCOL]`）。
- **复核**：`/opt/owndsh/site/tools/check-html-comments.py` 对官网 7 页 + 帮助中心 3 页 + API 文档 1 页共 11 页检查，
  泄漏与嵌套注释均为 0。生成器只清空 `dist` 内容、不删目录，因此重新生成后无需重启容器。

---

## 部署层 Git 仓库与服务器工作流（2026-09-16）

- 仓库：`https://github.com/gpmlimeng-cyber/dsh-enterprise`（公开）
- 服务器 clone：**`/opt/dsh-enterprise`**（完整历史）
- **唯一真源**：`/opt/owndsh/{site,help,api-docs,docs-assets,DEPLOYMENT.md,patches}` 均是指向 clone 的**符号链接**，
  原目录备份为 `*.pre-repo`（内容与 clone 逐字节一致，可随时回退）
- 因此"改内容 → 构建 → 线上生效 → 提交"都在同一目录完成，不存在两份漂移

### 日常命令

```sh
cd /opt/dsh-enterprise
git pull                      # 拉取其它来源的改动

# 构建：写进同一目录的 dist/，bind mount 让线上立即生效
docker run --rm -v /opt/dsh-enterprise/site:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -v /opt/dsh-enterprise/docs-assets:/opt/owndsh/docs-assets:ro -w /work node:24-alpine node build.mjs
docker run --rm -v /opt/dsh-enterprise/help:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -v /opt/dsh-enterprise:/deploy:ro -v /opt/dsh-enterprise/docs-assets:/opt/owndsh/docs-assets:ro \
  -e OWNDSH_DEPLOY_ROOT=/deploy -w /work node:24-alpine node build-help.mjs
docker run --rm -v /opt/dsh-enterprise/api-docs:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -w /work node:24-alpine node build-docs.mjs

sh /opt/owndsh/help/tools/verify-mounts.sh                       # 挂载自检
python3 /opt/dsh-enterprise/site/tools/check-html-comments.py    # 线上可见文本泄漏复查

git add -A && git commit -m "docs: …" && git push
```

### 推送凭证（一次性配置）

本机与 GitHub 之间**只有 22 端口可用**（HTTPS 到 github.com 超时），因此使用 SSH：

- 已生成专用密钥 `/root/.ssh/github_dsh_enterprise`，并在 `~/.ssh/config` 里配置别名 `github-dsh-enterprise`
- 公钥需在仓库 **Settings → Deploy keys → Add deploy key** 添加，并勾选 **Allow write access**：

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOrbGR88fQ9DGIk6iy36SLN0AuNtZy0camKTQnvyaVsk dsh-enterprise@62.234.16.179
```

- 添加后自检：`ssh -T github-dsh-enterprise`（应显示 "Hi … You've successfully authenticated"）

### 注意事项

1. **不要用 `git clean` / `git checkout` 替换 `dist/` 目录**：dist 是 console 容器的 bind mount 源，
   目录 inode 被替换会让容器内变成空目录（页面 403/500）。确需清理后执行
   `docker restart src-console-1`，再用 `verify-mounts.sh` 复核。
2. 三个生成器都**只清空 dist 内容、不删除目录**，因此正常重建不会触发上述问题；
   重建产物是确定性的（重建后 `git status` 保持干净）。
3. 服务器 `git push` 的默认 postBuffer 已调大（大内容推送需要）；本机推送如需可用同样方式设置。
