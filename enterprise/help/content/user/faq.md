---
title: 员工常见问题
audience: user
order: 9
summary: pnpm 不在 PATH、保存 Server 后平台不可用、登录后看不到模型、重启要重新登录、镜像拉不动。
verifiedAt: 2026-09-16
sourceRefs:
  - README.md#常见问题
  - README.md#安装员工插件
uiLabels: [插件, 设置]
status: draft
---

# 员工常见问题

## `pnpm not found on PATH`

`dsh plugin` 的子进程会从 `PATH` 里找 `pnpm`，所以必须先让它可以直接执行：

```sh
corepack enable
corepack install --global pnpm@11.7.0
pnpm --version
```

> ⚠️ 只写 `corepack pnpm ...` 不够——`dsh plugin` 的子进程仍然找不到 `pnpm`。
> 判断标准很简单：**直接运行 `pnpm --version` 能成功**。

## 保存 Server 后显示"平台不可用"

按这个顺序排查：

1. 在**员工设备上**访问 `<Server地址>/healthz`，应返回 `{"status":"UP"}`；
2. 检查 DNS 是否解析到正确主机；
3. 检查防火墙 / 安全组是否放行了你使用的端口（HTTP 80 或 HTTPS 443）；
4. 检查反向代理与 TLS 证书是否有效；
5. 确认 Server 地址是**完整的 HTTP(S) origin**，且**不带 API 路径**（不要写 `https://host/enterprise/...`）。

## 登录后看不到模型

按这个顺序判断：

1. 管理员是否**启用**了供应商与模型（停用的模型不会下发）；
2. 你（或你所在的用户组、或全部成员）是否拥有对应**模型访问授权**；
3. 是否只是**配额**用尽——配额用尽是 `429` 提示，不是"看不到模型"。

> 💡 配额策略**不能**代替访问授权。如果模型列表里根本没有你要的模型，先让管理员查授权。

## 重启后要求重新登录

正常情况下重启会**静默恢复**登录。出现重新登录，通常是：

- 启动的不是原来那个 profile；
- 该 profile 的官方 credentials provider 不可写（保存不下 Refresh Token）；
- 你主动退出过、切换过 Server 地址；
- 设备被撤销、成员被停用、或 30 天有效期到期。

## 关于登录保持的几个事实

- Server 地址与 Refresh Token 由 Harness Host 的官方 settings/credentials 服务持久化；
- **Access Token 只存在 Host 内存**，浏览器页面不会读取或保存它；
- OwnDsh 闲置时不会建立常驻连接、不定时拉配置、不提前续期；有请求时按需续期，401 最多重试一次；
- 网络暂时不可达时凭据会保留，可再次发起请求，或在 OwnDsh 设置里手动刷新。

## 插件相关问题

- **打开设置不会自动安装插件**：企业插件需要你自己在 设置 → 插件 中选择安装；
- 只展示管理员**已发布**且**对你可见**的插件；
- 同一员工的多台设备各自独立选择，不互相同步；
- 安装后没生效：确认重启的是**同一个 profile**。

## 相关

- API 参考：[认证 API](/api-docs/#tag/授权与登录)、[模型网关](/api-docs/#tag/OpenAI%20兼容)
- 相邻篇目：《为已有 Harness / 社区 Desktop 安装企业插件》《会话、登录保持与恢复》
