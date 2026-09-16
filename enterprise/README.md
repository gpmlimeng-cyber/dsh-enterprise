# enterprise/ — DSH Enterprise 部署层（monorepo 子树）

本目录是 **DSH Enterprise（内部代号 dshent）** 的企业部署层：产品官网、帮助中心、API 文档门户，
以及运维记录、补丁存档与上游分析。

> 产品源码在 monorepo 根（`../server`、`../console` 等）。本目录**不再**是独立仓库，也**不再**维护「只含部署产出、不含源码」的边界。  
> 分叉与脱钩策略见 [`../FORK.md`](../FORK.md)；线上记录中的历史地址与镜像名可能仍带 owndsh，属迁移痕迹。

## 三个站点

| 站点 | 线上地址 | 源目录 | 渲染方式 |
|---|---|---|---|
| 产品官网 | `/home/` | `site/` | 手写 HTML + `build.mjs` 注入导航/页脚/SEO 元数据 |
| 帮助中心 | `/help/` | `help/` | Markdown + `build-help.mjs`（受限 Markdown 子集） |
| API 参考 | `/api-docs/` | `api-docs/` | OpenAPI 契约 → 增强 spec → Scalar 渲染器 |

三个站点同源、共享一套设计令牌与自托管字体（`docs-assets/`），并通过页脚互相链接；均**公开可访问、可被搜索引擎收录**。

## 目录结构

```
enterprise/
├── README.md                 本文件
├── DEPLOYMENT.md             部署记录：拓扑、访问信息、上线过程、验收、回滚（密钥只留引用，不入库）
├── .gitignore                密钥排除规则
├── site/                     产品官网源 + dist/
├── help/                     帮助中心源 + dist/
├── api-docs/                 API 文档门户源 + dist/
├── docs-assets/              共享设计令牌与字体
├── patches/                  历史补丁存档（新改动直接改 monorepo 源）
├── analysis/                 上游代码分析报告与核查证据
├── licenses/                 第三方组件许可（Inter / Lucide）与说明
└── tools/                    密钥扫描等辅助脚本
```

## 构建

三个站点都是**零 npm 依赖**的 Node 脚本，可在任意路径构建——所有路径都能用环境变量覆盖，
因此本仓库不依赖服务器上的 `/opt/owndsh` 布局：

```sh
# 产品官网
cd site
OWNDSH_DOCS_ASSETS=../docs-assets OWNDSH_UPSTREAM_ASSETS=<上游 website/assets> node build.mjs

# 帮助中心（--check 只跑门禁）
cd help
OWNDSH_DOCS_ASSETS=../docs-assets OWNDSH_SRC_ROOT=<上游源码> OWNDSH_DEPLOY_ROOT=.. \
  node build-help.mjs

# API 文档门户
cd api-docs
OWNDSH_SRC_ROOT=<上游源码> node build-docs.mjs
```

宿主无 Node 时用容器（这也是线上的实际做法）：

```sh
docker run --rm -v "$PWD:/work" -v /opt/owndsh/docs-assets:/opt/owndsh/docs-assets:ro \
  -w /work node:24-alpine node build.mjs
```

## 构建期门禁（防止文档与实现漂移）

| 门禁 | 规则 | 位置 |
|---|---|---|
| 链接与资源完整性 | 页面内每个 `href/src`（含相对路径与锚点）必须在产物中存在 | 三站 |
| SEO 必填 | 可索引页必须有 title/description/canonical/og 图，且分享图必须真实存在 | 官网 |
| 外部请求白名单 | 除白名单外不得出现第三方域名（无 CDN、无分析、字体图片自托管） | 官网 |
| CSS 令牌完整性 | `var(--x)`（无兜底）引用的变量必须有定义 | 帮助中心 |
| HTML 注释完整性 | 注释体内不得含 `--`、不得嵌套注释；剥离注释后不得残留文件头标记 | 官网 |
| 公开内容安全 | 内容不得含内网地址、`.env` 密钥取值、私钥块 | 帮助中心 / 官网 |
| 覆盖校验 | 契约里的每个接口都要有分组与中文文案 | API 文档 |

线上复核脚本：`site/tools/check-html-comments.py`（三站可见文本泄漏检查）。

## 密钥约定（重要）

本仓库**不包含**任何密钥：

- `.env`、`.env.*`、`CREDENTIALS.txt`、`*.pem`、`id_*` 已在 `.gitignore` 中排除；
- `DEPLOYMENT.md` 里只写"凭据见服务器上的 600 权限文件"，不写口令；
- 推送前请运行扫描脚本（比对服务器密钥清单与待推送目录，只报告"哪个键出现在哪个文件"）：

```sh
ssh root@<server> 'cat /opt/owndsh/src/.env /opt/owndsh/CREDENTIALS.txt' > /tmp/secrets.lst
python3 tools/check-no-secrets.py /tmp/secrets.lst .
```

## 服务器上的工作流（clone 即唯一真源）

线上服务器已在 `/opt/dsh-enterprise` 放置本仓库的 clone，并把 `/opt/owndsh/{site,help,api-docs,docs-assets,DEPLOYMENT.md,patches}` 改为指向它的**符号链接**，因此内容与线上服务是同一份文件——改完构建即生效，不存在两份漂移：

```sh
cd /opt/dsh-enterprise
git pull
# 改 site/content/**、help/content/**、api-docs/public/**
docker run --rm -v /opt/dsh-enterprise/site:/work -v /opt/owndsh/src:/opt/owndsh/src:ro \
  -v /opt/dsh-enterprise/docs-assets:/opt/owndsh/docs-assets:ro -w /work node:24-alpine node build.mjs
sh /opt/owndsh/help/tools/verify-mounts.sh
git add -A && git commit -m "docs: …" && git push
```

两个操作约定：
1. 该机与 GitHub 之间只有 **22 端口**可用（HTTPS 超时），因此推送使用仓库专用 SSH deploy key；
2. 不要用 `git clean` / `git checkout` 替换 `dist/` 目录——它是容器 bind mount 源，
   目录 inode 被替换会让容器内变空目录（页面 403/500）；确需清理后执行
   `docker restart src-console-1` 并用 `verify-mounts.sh` 复核。

## 部署与回滚

线上部署方式、访问信息、验收记录与回滚命令见 [`DEPLOYMENT.md`](DEPLOYMENT.md)；
对上游的改动以补丁形式存于 `patches/`，可直接 `git apply`。

## 许可

本仓库内容用于部署 OwnDsh（上游 MIT）。第三方组件许可见 [`licenses/`](licenses/)：
Scalar API Reference（MIT）、Inter 与 JetBrains Mono 字体（SIL OFL 1.1）、Lucide 图标（ISC）。
OwnDsh 是独立项目，与 DeepSeek AI 或 Anywhere Labs 无隶属关系；DeepSeek Harness 与 DSH Desktop
的名称、代码与商标归各自所有。
