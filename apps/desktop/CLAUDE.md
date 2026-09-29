# apps/desktop/

> L2 | 父级: ../CLAUDE.md

[协议]：变更时更新此头，然后检查 ../CLAUDE.md

用锁定的官方 `@deepseek-ai/dsh-desktop` 构建自己的安装包。不复制上游 `apps/desktop` 源码。产品名、应用 ID、可选图标和内置插件包是本目录的客制点。

打包会临时替换上游 checkout 里的 `electron-builder.config.mjs`，结束或失败后恢复。拒绝在脏 checkout 上开始。没有 Apple 签名和公证凭据时，不能产出可分发的 macOS 安装包。

成员清单

package.json: 企业桌面打包入口，命令转到 scripts/desktop-package.mjs。
brand.json: 产品名、应用 ID、安装包文件名前缀和可选图标；禁止使用 DeepSeek 产品名或 `com.deepseek.*`。
plugins.json: 打进安装包资源的内置插件。当前是工作区 `dshent-plugin`，不是 npm `@next`。
scripts/desktop-package.mjs: 校验品牌与插件、暂存 tgz、临时覆盖上游打包配置并调用官方 package 脚本。
scripts/desktop-package.test.mjs: 品牌拒绝、资源追加、overlay 恢复和真实版本锁回归。
.gitignore: 忽略 `.build/`，包括暂存插件、overlay 备份和官方产物副本。
