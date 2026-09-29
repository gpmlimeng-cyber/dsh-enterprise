# dshent-client-plugin

DSH Enterprise 控制面的**客户端插件**。装进任意 DSH 客户端（官方 Harness Desktop/Web、或第三方 DSH 客户端如 Jingyun DSH Client）后，
员工用企业账号登录、使用企业托管模型、查看用量配额、从企业市场安装受管插件。

**它是一个插件，不是客户端发行版**：只依赖官方 `@deepseek-ai/*` 扩展面，不 vendored 任何客户端源码，也不要求客户端改代码。

## 能力

| 代号 | 能力 | 说明 |
|---|---|---|
| E1 | 企业登录与控制面接入 | PKCE(S256) + loopback 回调；轮换 Refresh Token；设备注册与心跳；bootstrap 快照 |
| E2 | 企业托管模型与网关 | 把 bootstrap 模型目录投影成官方 `dsh-llm-pi-ai` provider；本机 loopback 代理注入企业凭据 |
| E3 | 用量与配额 | 5 小时 / 日 / 周 / 月四窗口用量视图 |
| E4 | 企业插件市场 | 列表、期望状态调和、SHA-256 与可选 Ed25519 验签、安装/卸载 |

会话同步（T16/T18 语义）不在本期范围；`sessionPolicy` 会被读取并如实降级展示。

## 安装

```sh
dsh plugin install dshent-client-plugin@next --profile <profile>
```

或在客户端 profile 的配置里 insert：

```yaml
- insert:
    - id: dshent-client-plugin
      name: 'dshent-client-plugin'
```

`cordis.patch.yml` 只插入自己的 Host 行，**不改动宿主既有 row**（包括宿主的默认模型与 provider 设置）。

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `baseUrl` | 空 | 企业控制面地址，如 `http://192.168.1.50:8080`；留空时首启由界面要求填写 |
| `verifyPluginSignatures` | `false` | 是否校验企业插件 Ed25519 签名；纯内网 HTTP 部署可保持关闭 |
| `trustedPluginPublicKey` | 空 | 仅验签开启时使用的 SPKI PEM 或 DER Base64；中心响应无权替换 |
| `requestTimeoutMs` | `30000` | 控制面请求超时 |
| `callbackTimeoutMs` | `300000` | 浏览器授权回调等待上限 |
| `deviceName` | 空 | 留空由主机名与平台推导 |
| `profile` | `desktop` | 宿主插件命令使用的 profile |
| `dshCommand` | `dsh` | 宿主插件命令入口，用于受管插件安装/卸载 |
| `marketInstallEnabled` | `true` | 关闭后市场只读 |

## 安全模型（重要）

- **access token 只在 Host 内存**；浏览器侧永远拿不到企业令牌。refresh token 只进 `$DSH_HOME/enterprise/credentials.json`（0600）。
- 模型流量走 **Host 私有 loopback 代理**（只绑定 `127.0.0.1`），由 Host 注入 `Authorization`；代理拒绝非 loopback 来源。
- 插件自身的本机路由（`/api/jingyun/enterprise/*` 或宿主等价前缀）是**本机唯一鉴权边界**：写动作必须同源校验且 fail-closed。
- 企业插件制品必须通过 大小 + SHA-256 校验；核心包保护名单与 `contracts/plugin-core-packages.json` 逐字一致。
- 验签默认关闭时，签名不参与校验，但大小与哈希**永远**校验；服务端响应无权关闭任何一道校验。

## 构建与验证

```sh
pnpm -C plugin --filter dshent-client-plugin run build      # tsc 声明 + esbuild Host/Client
pnpm -C plugin --filter dshent-client-plugin run typecheck
pnpm -C plugin --filter dshent-client-plugin run test
```

接口契约与实现纪律见 `docs/INTERFACES.md`；协议真源是根仓库 `contracts/`（OpenAPI 3.1 + JSON Schema + fixture）。
