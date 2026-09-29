<!--
[INPUT]: 依赖 npm next 包、Harness 官方 plugin/profile/settings/credentials 扩展点与 DSH Enterprise Server。
[OUTPUT]: 提供员工安装、连接、登录、默认免公钥的插件安装、更新和卸载说明。
[POS]: npm 包详情页与插件内置 README；面向员工，不承载 workspace 开发细节。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# dshent-plugin

DSH Enterprise 的 DeepSeek Harness 官方扩展点插件。它把 DSH Desktop 或 Harness Web 连接到自托管 DSH Enterprise Server，让员工使用企业身份、受管模型和受管插件，而不在本机保存供应商 API Key。

> 当前稳定包为 `0.1.0`，插件基线是官方 Harness Desktop `0.1.7-rc.2`。

## 安装

先让 pnpm 在 PATH 中可用：

```sh
corepack enable
corepack install --global pnpm@11.7.0
```

选择实际使用的 Harness profile：

```sh
# Harness Web
dsh plugin --profile web add --ignore-scripts dshent-plugin@latest

# DSH Desktop
dsh plugin --profile desktop add --ignore-scripts dshent-plugin@latest
```

从 Harness 源码运行 CLI 时：

```sh
pnpm --dir /path/to/deepseek-harness dsh \
  plugin --profile web add --ignore-scripts dshent-plugin@latest
```

安装后重启对应 profile。填写管理员提供的 DSH Enterprise Server HTTP(S) 地址并完成企业登录。

## 登录保持

Server 地址由 Harness 官方 settings 服务保存；轮换 Refresh Token 由 Host 官方 credentials 服务保存；Access Token 只保留在 Host 内存。正常重启会静默恢复登录，浏览器 Client 不会读取或保存 Token。

主动退出、设备撤销、成员停用、改密或 30 天有效期结束后需要重新登录。

闲置时没有企业 SSE、定时配置请求或提前续期。请求遇到 Access Token 到期才续期，并合并并发续期；服务端认证 401 最多续期重试一次。Refresh Token 失效时显示登录门禁，网络故障保留凭据供下次请求重试。打开 DSH Enterprise 设置或点击刷新时更新目录；页面复用 Harness 已有通知读取本机状态，登录中仅作有截止时间的临时查询。

## 账户后台（地址可自己输入）

官方账户授权与账户查询默认指向本企业后台 `https://meizhiyun.chat`（账户与推理同源），**可自定义**。官方账户设置页（`ui-settings-account`）与账户控制器（`api-account-controller`）**原样复用**，不 fork、不改官方 UI。

要接自托管后台，在产品设置里输入自己的地址即可，不必改包：地址写入 Harness 官方 settings 中本插件 entry（`owndsh`）的 volatile 字段 `platformOrigin`/`inferenceOrigin`，**改完立即热重挂**（释放旧实例、用新地址挂载同一官方实现），无需重启。官方 0.1.7-rc.2 起 settings 不再有 per-namespace 注册，命名空间就是活动 profile entry 的 id，请按 entry 段而不是旧的独立段来读写。同源本地 API 也可直接写：

```
GET  /enterprise/api/v1/local/account-origin
POST /enterprise/api/v1/local/account-origin   {"platformOrigin":"…","inferenceOrigin":"…"}
```

三条约束：

1. **地址必须是 HTTPS，明文只允许本机回环。** 企业校验器与官方 `platformOrigin()` 同规则：`https:` 放行，`http:` 仅放行 `localhost`/`127.0.0.1`/`[::1]`，且不得带 userinfo、path、query 或 fragment——非法地址在写入前就被拒，正在运行的账户插件不会被换坏。请在自托管地址上终止 TLS，不要为让明文地址通过而放宽上游校验。
2. **`inferenceOrigin` 决定账户 token 允许附着到哪个推理/文件后台。** 接自托管后台时它应与账户后台一致，否则账户凭据不会随推理请求发出。
3. **官方 `deepseek-account` 行已被企业 bundle 停用。** 账户实现改由企业侧按用户地址挂载，`desktopPlatform` 由企业挂载点逐字重述；回归门禁见 `tests/account-origin.spec.ts`，其中包含"绝不把内网字面端点写进发布物"。

## 更新与卸载

```sh
dsh plugin --profile web remove dshent-plugin
dsh plugin --profile web add --ignore-scripts dshent-plugin@latest
```

完全卸载只执行第一条命令。把 `web` 换成实际 profile。

## 兼容性与边界

当前插件基线是官方 DeepSeek Harness Desktop `0.1.7-rc.2`。DSH Enterprise 不替换官方 Web/Desktop UI，不访问员工工作区，也不实现第二套模型协议。

登录和企业模型只需安装本包。管理员上传、发布并配置可见范围后，员工在「DSH Enterprise 设置 → 插件」内自主安装、更新或卸载。不会自动安装，其他设备独立选择。安装或卸载后需完全退出并重新打开客户端。

插件签名校验 `verifyPluginSignatures` 默认关闭，员工无需配置公钥；文件大小、SHA-256、目标系统和 Harness 兼容性仍会校验。需要验签的部署可在 profile 的 `owndsh.config` 中设置 `verifyPluginSignatures: true` 和部署专属 `trustedPluginPublicKey`，开启后缺公钥或签名错误会阻止安装。

管理员上传时仍需选择目标系统和对应 Harness commit。当前基线是 `0.1.7-rc.2`（`477b4f420553e8a52c2fbccc464d7561b239c443`）。已映射的旧版本仍包括 `0.1.1-rc.2`、`0.1.2-rc.1` 和 `0.1.5-rc.2`。旧版 DSH Enterprise 可能仍强制要求公钥或自动调和插件，需要先升级员工插件才能使用当前行为。

项目与完整部署说明：[github.com/boe1900/owndsh](https://github.com/boe1900/owndsh)
