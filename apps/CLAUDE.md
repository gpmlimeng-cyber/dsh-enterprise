# apps/

> L2 | 父级: ../CLAUDE.md

员工客户端打包层。这里不保存官方 Harness 源码，也不放后台、官网或插件实现。插件仍在 `plugin/`，各端只用清单引用。

现在只有 `desktop/`。不要预建 `web/` 或 `mobile/`：官方仓库有 Web 前端、没有移动端，空目录会被误当成已经能构建的产品。新增一端之前，先在 `upstream/` 加锁，再按 `desktop/` 的形态加打包脚本。

成员清单

desktop/: 用官方 DeepSeek Harness Desktop 构建 DSH Enterprise 安装包的入口。品牌、图标和内置插件在这里配置；上游源码、`node_modules` 和 `.desktop-build` 不入库。
