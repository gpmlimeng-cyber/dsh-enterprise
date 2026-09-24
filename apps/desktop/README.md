# 企业桌面安装包

这里用官方 DeepSeek Harness Desktop 构建 DSH Enterprise 自己的安装包。上游源码仍在同级 `dsh-desktop/`，不复制进本仓库。

品牌在 `brand.json`。内置插件在 `plugins.json`，默认把工作区 `dshent-plugin` 打进安装包资源 `dshent/bundled-plugins`。官方运行时不会在首次启动时自动安装这些插件；安装包带上 tgz 和清单，之后用下面的安装命令写入 desktop profile。不要把产品名或应用 ID 改成 DeepSeek 的。

```sh
node scripts/bootstrap-harness-desktop.mjs --check-only
node apps/desktop/scripts/desktop-package.mjs plan
node apps/desktop/scripts/desktop-package.mjs stage-plugins
node apps/desktop/scripts/desktop-package.mjs package --dir
```

macOS 可分发包还需要 `DSH_DESKTOP_MACOS_SIGNING_IDENTITY`、`DSH_DESKTOP_MACOS_TEAM_ID`，以及 Apple 公证凭据。凭据不要写入仓库。打包会临时替换上游 `apps/desktop/electron-builder.config.mjs`，失败时运行：

```sh
node apps/desktop/scripts/desktop-package.mjs restore
```

可选图标放到 `apps/desktop/brand/`，再在 `brand.json` 里写相对路径 `icons.mac` 和 `icons.windows`。不配置时继续使用上游图标，安装包仍不得宣传成 DeepSeek 官方软件。
