# apps/

> L2 | 父级: ../CLAUDE.md

企业客户端打包层。这里不保存官方 Harness 源码；打包时读取 `upstream/deepseek-harness-desktop.lock.json`，使用同级只读 checkout 的官方脚本构建。

成员清单

desktop/: 用官方 DeepSeek Harness Desktop 构建 DSH Enterprise 安装包的入口。品牌、图标和内置插件在这里配置；上游源码、`node_modules` 和 `.desktop-build` 不入库。
