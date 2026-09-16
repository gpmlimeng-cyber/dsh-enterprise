---
title: 为已有 Harness / 社区 Desktop 安装企业插件
audience: user
order: 3
summary: 用 corepack 备好 pnpm 基线，一条 dsh plugin 命令装上企业插件，然后填写管理员给你的 Server 地址。
verifiedAt: 2026-09-16
sourceRefs:
  - README.md#安装员工插件
  - README.md#更新
  - README.md#常见问题
uiLabels: [插件, 设置, 安装, 更新]
status: draft
---

# 为已有 Harness / 社区 Desktop 安装企业插件

> 💡 **先确认走哪条路**：如果你用的是独立仓库构建的 **OwnDsh Desktop**，请直接看《使用 OwnDsh Desktop》——
> 它已经预装插件与运行环境，不需要 Node、pnpm 或本节命令。
> 本节适用于**已经装好** DeepSeek Harness / 社区 Desktop、只想接入企业的设备。

## 1. 先让 `pnpm` 可用

`dsh plugin` 的子进程会从 `PATH` 查找 `pnpm`，所以必须先让它成为可直接执行的命令。
Harness 当前基线使用 pnpm `11.7.0`：

```sh
corepack enable
corepack install --global pnpm@11.7.0
pnpm --version
```

> ⚠️ 只写 `corepack pnpm ...` 是不够的——`dsh plugin` 的子进程仍然找不到 `pnpm`。
> 必须做到**直接运行 `pnpm --version` 成功**，再用下面的命令。

## 2. 安装企业插件

按你实际使用的 profile 选择一条：

```sh
# Harness Web
dsh plugin --profile web add --ignore-scripts owndsh-plugin@next
dsh --profile web

# DSH Desktop
dsh plugin --profile desktop add --ignore-scripts owndsh-plugin@next
```

从 DeepSeek Harness 源码运行 CLI 时，用 `--dir` 指向你的 checkout：

```sh
pnpm --dir /path/to/deepseek-harness dsh \
  plugin --profile web add --ignore-scripts owndsh-plugin@next
```

> 💡 `--ignore-scripts` 是**故意**加的：安装阶段不执行包脚本，插件的实际行为只在 Harness 运行时生效。

**安装完成后重启对应的 profile**（Web 端刷新页面不够，需要重启 profile 进程）。

## 3. 填写 Server 地址并登录

重启后会出现 OwnDsh 全屏页面，要求填写管理员提供给你的 **OwnDsh Server 地址**：

- 必须是完整的 **HTTP(S) origin**，例如 `https://owndsh.example.com`；
- **不能带 API 路径**（不要写 `https://owndsh.example.com/enterprise/...`）。

**操作路径**：OwnDsh 全屏页面 → 填写 Server 地址 → 保存 → 企业登录

保存后由 Harness Host 的官方 settings/credentials 服务持久化 Server 地址与 Refresh Token；
Access Token 只存在于 Host 内存，浏览器页面不会读取或保存它。**正常重启会静默恢复登录。**

> 🔒 供应商 API Key 不会下发到你的设备。每次模型请求都由 OwnDsh 网关重新校验身份、授权与额度。

## 4. 存不上 / 连不上时

| 现象 | 先做这一步 |
|---|---|
| 保存 Server 后显示平台不可用 | 在设备上访问 `<Server地址>/healthz`，确认返回 `{"status":"UP"}`；再查 DNS、防火墙、反向代理与 TLS 证书 |
| 提示 `pnpm not found on PATH` | 回到第 1 节，直到 `pnpm --version` 直接可跑 |
| 插件装上了但页面没出现 | 确认重启的是**同一个 profile**，且插件装在该 profile 下 |

更完整的排查见《员工常见问题》。

## 5. 安装企业插件（可选）

管理员发布并对你可见的插件，在**操作路径**：OwnDsh 设置 → 插件 里可以搜索、查看详情、**自主安装、更新和卸载**。

> 💡 打开设置或刷新页面**不会**自动安装任何插件；同一员工的其他设备各自独立选择。
> 服务端签名与客户端验签在本部署默认关闭（无需配置公私钥），但大小、SHA-256、兼容性与下载权限仍会校验。

## 相关

- API 参考：[插件分发](/api-docs/#tag/插件分发)（拉取分配、下载构件、上报清单）
- 上一篇：《使用 OwnDsh Desktop（无需 Node/pnpm）》
