/**
 * [INPUT]: 依赖 @deepseek-ai/schemastery 的 Schema 工厂，与官方 DSH settings 注册机制对齐
 * [OUTPUT]: 对外提供 Config 接口与 Schemastery Schema，供 Host 插件与本地 UI 共用
 * [POS]: 企业集成的部署时配置边界；不含任何凭据字段，令牌一律走 storage 的凭据文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** 企业控制面地址；留空则首启由 UI 要求填写。 */
  baseUrl: string
  /** 是否校验企业插件签名；默认关闭以支持纯内网 HTTP 部署。 */
  verifyPluginSignatures: boolean
  /** 仅开启验签时使用的 Ed25519 SPKI PEM 或 DER Base64；中心响应无权替换。 */
  trustedPluginPublicKey: string
  /** 控制面请求超时（毫秒）。 */
  requestTimeoutMs: number
  /** 浏览器授权回调等待上限（毫秒）。 */
  callbackTimeoutMs: number
  /** 设备展示名；留空则由主机名与平台推导。 */
  deviceName: string
  /** 调用宿主插件命令时使用的 profile。 */
  profile: string
  /** 宿主插件命令入口；Windows 便携发行版会覆盖为内置 node 路径。 */
  dshCommand: string
  /** 本地 UI 暴露的市场安装动作开关；关闭后市场仅可浏览。 */
  marketInstallEnabled: boolean
}

// TS2375 的真因是 schemastery 双版本撕裂，不是这里写错了类型：本 workspace 直接依赖
// 3.18.1，而 `@deepseek-ai/dsh-llm-pi-ai@0.1.5-rc.2` 经 `dsh-llm@0.1.7-rc.2` 拉进 3.18.4；
// 两个版本都在 `declare global { namespace Schemastery }` 里声明同名 `Schema`/`Meta`，
// 全局命名空间被合并后 `Meta<T>.default` 取到 3.18.4 的 `SchemaOutput<T>`（含 `Volatile`），
// 于是 `Schema<Config>` 注解报 `string | Volatile<...>` 不可赋给 `string`；不注解则因
// 推断类型无法在 .d.ts 里具名而报 TS2883。显式断言把导出类型钉在模块内解析到的 3.18.1 上，
// 不改变任何运行时行为。真正的修法是消掉 3.18.1/3.18.4 双版本（见 task-2 的 peer 撕裂跟踪）。
export const Config = Schema.object({
  baseUrl: Schema.string()
    .default('')
    .description('企业控制面地址，例如 http://192.168.1.50:8080。留空时首启由界面要求填写。'),
  verifyPluginSignatures: Schema.boolean()
    .default(false)
    .description('校验企业插件 Ed25519 签名。默认关闭；开启前必须配置信任公钥。'),
  trustedPluginPublicKey: Schema.string()
    .default('')
    .description('Ed25519 公钥（SPKI PEM 或 DER Base64）。仅验签开启时读取，中心响应无法替换。'),
  requestTimeoutMs: Schema.number()
    .step(1)
    .min(1)
    .default(30_000)
    .description('控制面请求超时（毫秒）。'),
  callbackTimeoutMs: Schema.number()
    .step(1)
    .min(1)
    .default(300_000)
    .description('浏览器授权回调等待上限（毫秒）。'),
  deviceName: Schema.string()
    .default('')
    .description('设备展示名。留空时由主机名与平台推导。'),
  profile: Schema.string()
    .default('desktop')
    .description('宿主插件命令使用的 profile。'),
  dshCommand: Schema.string()
    .default('dsh')
    .description('宿主插件命令入口，用于企业插件安装与卸载。'),
  marketInstallEnabled: Schema.boolean()
    .default(true)
    .description('是否允许从企业市场安装/卸载插件。关闭后仅可浏览与查看授权。'),
}) as Schema<Config>
