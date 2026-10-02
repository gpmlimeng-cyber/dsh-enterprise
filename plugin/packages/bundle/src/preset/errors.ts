/**
 * [INPUT]: 接收企业配方「合成 → 授权 → 安装 → 卸载」四段边界的失败分类
 * [OUTPUT]: 对外提供只携带稳定 `ENT_*` code 的 `EnterprisePresetError`、封闭的 code 联合与归一化函数 `presetError`/`presetBadRequest`
 * [POS]: bundle 配方一键启用纵深的失败防泄漏边界——错误里不放宿主绝对路径、不放官方 pnpm 输出、不放配方正文，界面只拿到 `error.code`；code 沿用本包既有 `ENT_*` 体系（与 `skill-errors.ts` 同形、不混入 `library/*` 族），并保持「只加进本包既有 errors 体系、不碰 ui 的 error-messages.ts」的纪律
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 配方一键启用可能抛出的稳定错误码。
 *
 * 前缀沿用既有 `ENT_*` 体系：`ENT_INVALID_REQUEST`/`ENT_RESOURCE_NOT_FOUND` 与既有路由投影同名，
 * `ENT_PRESET_*` 是本纵深新增的一族。每一枚都对应一条**真实会抛**的边界，不预造没人抛的码：
 * 配方包形状非法、合成落盘失败、需要授权、指纹已变、重复点击正在进行中、官方安装失败、官方安装被取消、
 * 官方卸载失败、本机状态文件损坏。
 */
export type EnterprisePresetErrorCode =
  | 'ENT_INVALID_REQUEST'
  | 'ENT_RESOURCE_NOT_FOUND'
  | 'ENT_PRESET_RECIPE_INVALID'
  | 'ENT_PRESET_BUNDLE_WRITE_FAILED'
  | 'ENT_PRESET_AUTHORIZATION_REQUIRED'
  | 'ENT_PRESET_AUTHORIZATION_STALE'
  | 'ENT_PRESET_INSTALL_IN_PROGRESS'
  | 'ENT_PRESET_INSTALL_FAILED'
  | 'ENT_PRESET_INSTALL_CANCELLED'
  | 'ENT_PRESET_UNINSTALL_FAILED'
  | 'ENT_PRESET_STATE_INVALID'

/** 只向路由与界面暴露固定 code；`cause` 留在 Host 侧日志，不进响应体。 */
export class EnterprisePresetError extends Error {
  constructor(
    readonly code: EnterprisePresetErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'EnterprisePresetError'
  }
}

/** 入参形状错误的简写；`ENT_INVALID_REQUEST` 是它的固定码。 */
export function presetBadRequest(message: string): EnterprisePresetError {
  return new EnterprisePresetError('ENT_INVALID_REQUEST', message)
}

/** 把未知 I/O 或官方失败收敛为调用方指定的稳定 code；已是本类则原样透传（保留更精确的码）。 */
export function presetError(
  error: unknown,
  fallback: EnterprisePresetErrorCode,
  message: string,
): EnterprisePresetError {
  return error instanceof EnterprisePresetError
    ? error
    : new EnterprisePresetError(fallback, message, { cause: error })
}
