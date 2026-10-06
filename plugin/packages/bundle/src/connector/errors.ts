/**
 * [INPUT]: 接收连接器「能力声明 → 策略求值 → 配置型 bundle 合成 → 官方安装面」四段边界的失败分类
 * [OUTPUT]: 对外提供只携带稳定 `ENT_*` code 的 `EnterpriseConnectorError`、封闭的 code 联合与归一化函数 `connectorBadRequest`/`connectorError`
 * [POS]: bundle 连接器纵深的失败防泄漏边界——错误里不放宿主绝对路径、**不放凭据值**、不放官方 pnpm 输出，界面只拿 `error.code`；code 沿用本包既有 `ENT_*` 体系（与 `preset/errors.ts`、`skill-errors.ts` 同形），不混入 `library/*` 族
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 连接器纵深可能抛出的稳定错误码。每一枚都对应一条**真实会抛**的边界，不预造没人抛的码：
 *
 * - `ENT_CONNECTOR_DECLARATION_INVALID`：能力声明缺必填、字段越界、`effects` 为空集（空集会让
 *   §3.2 的 L1 判据**空集真**，等于"什么都不做的东西自动放行"，故当场拒）。
 * - `ENT_CONNECTOR_LEVEL_DECLARED`：声明方自贴 `L1`/`L2`/`L3`（或 `level`/`permission`/`tier` 这类键）。
 *   `connector-architecture.md` §3.2 纪律 2 逐字：层级是**求值器算出来的**，不能由被治理方自己发许可。
 * - `ENT_CONNECTOR_ID_DUPLICATE`：注册表里两条声明用同一个 `capabilityId`（它是进会话历史与权限规则的稳定标识）。
 * - `ENT_CONNECTOR_SECRET_INLINE`：配置型 bundle 的凭据位置收到**明文**而不是引用（`mcp-conformance.md` §4.7：
 *   唯一允许的形态是 Loader `!!js` 引用，配置里只出现键名）。
 * - `ENT_CONNECTOR_BUNDLE_WRITE_FAILED`：合成落盘失败（路径逃逸 / 目录形状 / I-O）。
 * - `ENT_CONNECTOR_INSTALL_FAILED` / `ENT_CONNECTOR_UNINSTALL_FAILED`：官方安装面抛错，或官方**自己**回
 *   `application: 'failed'`（两种都收敛到同一枚码，界面文案相同、原因只进 Host 日志）。
 * - `ENT_CONNECTOR_INSTALL_CANCELLED`：官方回 `cancelled`（用户/宿主在安装途中取消）——它不是失败，单独一枚。
 * - `ENT_CONNECTOR_INSTALL_IN_PROGRESS`：同一个连接器正在装/卸，再点**拒绝**而不排队（与配方纵深同一条纪律）。
 * - `ENT_CONNECTOR_STATE_INVALID`：本机已装清单损坏或形状不符（fail-closed，绝不按"空清单"继续装第二遍）。
 * - `ENT_CONNECTOR_CREDENTIAL_MISSING`：声明/配置里点名的凭据键**当前没配**（`describe().configured === false`）。
 * - `ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE`：★本纵深最有价值的一枚——凭据**配了，但送不到 MCP 子进程**。
 *   官方 `cordis-plugin-loader` 的 `!!js` 求值器是**同步**的（`new Function("ctx","expr","with(ctx){return eval(expr)}")`，
 *   `lib/index.js:233`），而 `ctx.credentials.resolve` 是异步的 ⇒ 配置型 bundle 里的 `env` **只能**引用
 *   `process.env`；`dsh-credentials-local` 又明文自陈保管文件**永不物化进环境**（`README.md:115`）
 *   ⇒ `source: 'file'` 的键（也就是 `writable: true` 的那个）**到不了子进程**。此时**必须报不可用**，
 *   而不是生成一份 env 解析成空串、启动后"零工具"的配置。
 * - `ENT_RESOURCE_NOT_FOUND`：卸载一条**本机没装过**的连接器；与 `preset/errors.ts`、`skill-errors.ts` 同码，
 *   不为同一种结果造第二枚。
 *
 * `ENT_INVALID_REQUEST` 与既有路由投影同名（入参形状错误的简写），由 `connectorBadRequest` 抛。
 */
export type EnterpriseConnectorErrorCode =
  | 'ENT_INVALID_REQUEST'
  | 'ENT_RESOURCE_NOT_FOUND'
  | 'ENT_CONNECTOR_DECLARATION_INVALID'
  | 'ENT_CONNECTOR_LEVEL_DECLARED'
  | 'ENT_CONNECTOR_ID_DUPLICATE'
  | 'ENT_CONNECTOR_SECRET_INLINE'
  | 'ENT_CONNECTOR_BUNDLE_WRITE_FAILED'
  | 'ENT_CONNECTOR_INSTALL_IN_PROGRESS'
  | 'ENT_CONNECTOR_INSTALL_FAILED'
  | 'ENT_CONNECTOR_INSTALL_CANCELLED'
  | 'ENT_CONNECTOR_UNINSTALL_FAILED'
  | 'ENT_CONNECTOR_STATE_INVALID'
  | 'ENT_CONNECTOR_CREDENTIAL_MISSING'
  | 'ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE'

/** 只向路由与界面暴露固定 code；`cause` 留在 Host 侧日志，不进响应体。 */
export class EnterpriseConnectorError extends Error {
  constructor(
    readonly code: EnterpriseConnectorErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'EnterpriseConnectorError'
  }
}

/** 入参形状错误的简写；`ENT_INVALID_REQUEST` 是它的固定码。 */
export function connectorBadRequest(message: string): EnterpriseConnectorError {
  return new EnterpriseConnectorError('ENT_INVALID_REQUEST', message)
}

/** 把未知 I/O 或官方失败收敛为调用方指定的稳定 code；已是本类则原样透传（保留更精确的码）。 */
export function connectorError(
  error: unknown,
  fallback: EnterpriseConnectorErrorCode,
  message: string,
): EnterpriseConnectorError {
  return error instanceof EnterpriseConnectorError
    ? error
    : new EnterpriseConnectorError(fallback, message, { cause: error })
}
