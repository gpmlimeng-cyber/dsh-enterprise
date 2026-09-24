# 员工桌面客户端

状态：已接入版本锁（2026-09-24）

员工桌面客户端基于官方 DeepSeek Harness Desktop，包名 `@deepseek-ai/dsh-desktop`，上游源码路径 `apps/desktop`。本仓库不保存该源码树。`apps/desktop` 是企业打包层，用同一把锁构建 DSH Enterprise 安装包。它不是 DeepSeek 官方企业软件。

## 锁定版本

| 项 | 值 |
|---|---|
| 仓库 | `https://github.com/deepseek-ai/deepseek-harness.git` |
| 版本 | `0.1.7-rc.1` |
| commit | `46a7f68b0922371ce7144b668b90e377d8e799f4` |
| 许可证 | MIT |
| 真源 | `upstream/deepseek-harness-desktop.lock.json` |

这把锁就是插件开发基线。`upstream/dsh-desktop.lock.json` 与 `upstream/deepseek-harness.lock.json` 必须和它指向同一仓库、版本和 commit。社区 Desktop `2.0.3` 已退出插件基线。

## 准备源码

默认放到本仓库同级的 `dsh-desktop/`：

```sh
node scripts/bootstrap-harness-desktop.mjs
node scripts/bootstrap-harness-desktop.mjs --check-only
```

已有官方 checkout 时传入路径。脏工作区只允许 `--check-only`；准备命令拒绝在有本地改动时切换 commit。

```sh
node scripts/bootstrap-harness-desktop.mjs --check-only /path/to/deepseek-harness
```

## 本地运行边界

本机没有 Apple Developer ID 时，不能生成可分发的签名并公证安装包。可运行的本地应用是 ad-hoc 签名的开发包，启动器会写死源码目录和运行时目录。不要删除对应 checkout，否则已安装的应用无法启动。

不要把 `node_modules/`、`.desktop-build/`、`.env`、`*.pem` 或 `/Applications` 里的 `.app` 提交进本仓库。`/desktop/` 仍是已迁出的本地缓存，保持忽略。

官方打包入口是 Harness 仓库里的 `pnpm run package:desktop:mac:arm64`。企业安装包不要直接改那个 checkout，使用本仓库的打包层：

```sh
node apps/desktop/scripts/desktop-package.mjs plan
node apps/desktop/scripts/desktop-package.mjs package --dir
```

`brand.json` 控制产品名、应用 ID 和可选图标。`plugins.json` 控制打进安装包资源的插件 tgz。官方运行时不会在首次启动时自动安装这些插件，打包后用 `install-plugins` 写入 desktop profile。可分发的 macOS 包仍需要 Apple 签名和公证凭据，凭据不得写入本仓库。

## 与企业插件的关系

打开桌面端后，员工仍要填写管理员提供的 DSH Enterprise Server 地址并登录。`dshent-plugin` 的开发基线是本锁；安装时按运行时版本查找已映射 commit，因此 `0.1.7-rc.1` 必须出现在插件兼容表中。旧映射版本仍可安装，但不能代替这把基线。本锁不表示插件已在 `0.1.7-rc.1` 完成新的纵向验收。
