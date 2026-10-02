/**
 * [INPUT]: 接收下载、校验、官方安装面（`pluginManager`）、Loader 与状态持久化边界的失败分类
 * [OUTPUT]: 对外提供只携带稳定 code 的 PluginDistributionError 与归一化函数
 * [POS]: plugin-distribution 的失败防泄漏边界，库存不保存响应正文、路径或子进程输出
 *
 * `ENT_PLUGIN_CLI_FAILED` 是**线上稳定的旧名**，本刀之后它的语义是「官方安装面不可用 / 官方安装或卸载失败」：
 * 员工侧文案表（`ui/src/error-messages.ts`）已把它写成「插件安装工具执行失败。请重试；仍然失败请联系企业管理员。」
 * —— 官方 `pluginManager` 就是那件「插件安装工具」，故**不改码名**（改名会让员工端掉进未映射兜底文案，
 * 而 ui 侧本会话不可改）。官方的失败事实原样保留在 `cause` 与宿主日志里（含官方 `error.code` / `diagnostic`）。
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type PluginDistributionErrorCode =
  | 'ENT_AUTH_REQUIRED'
  | 'ENT_PERMISSION_DENIED'
  | 'ENT_PLUGIN_BUSY'
  | 'ENT_PLUGIN_CORE_PROTECTED'
  | 'ENT_PLUGIN_DOWNLOAD_FAILED'
  | 'ENT_PLUGIN_SIZE_MISMATCH'
  | 'ENT_PLUGIN_HASH_MISMATCH'
  | 'ENT_PLUGIN_SIGNATURE_INVALID'
  | 'ENT_PLUGIN_INCOMPATIBLE'
  | 'ENT_PLUGIN_CLI_FAILED'
  /**
   * 官方 `cancelInstall` 让这次安装在 `applying` 之前停住（`application === 'cancelled'`，文件已回滚）。
   *
   * 这是本刀**唯一**新增的码：取消不是失败，用 `ENT_PLUGIN_CLI_FAILED`（「安装工具执行失败」）会在员工侧
   * 说错话。它与配方族的 `ENT_PRESET_INSTALL_CANCELLED` 逐字同族、同一状态投影（400/409/503 那张唯一表里
   * 判 409：请求合法、本机状态不允许这次调用）。**ui 侧需同批补一行员工文案**（见交付说明）。
   */
  | 'ENT_PLUGIN_INSTALL_CANCELLED'
  | 'ENT_PLUGIN_LOADER_INACTIVE'
  | 'ENT_PLUGIN_STATE_INVALID'

/** 分发失败只向状态机暴露固定 code；cause 不进入持久化或平台库存。 */
export class PluginDistributionError extends Error {
  constructor(readonly code: PluginDistributionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PluginDistributionError'
  }
}

/** 把未知 I/O 或 provider 失败收敛为调用方指定的稳定 code。 */
export function distributionError(
  error: unknown,
  fallback: PluginDistributionErrorCode,
  message: string,
): PluginDistributionError {
  return error instanceof PluginDistributionError
    ? error
    : new PluginDistributionError(fallback, message, { cause: error })
}
