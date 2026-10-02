/**
 * [INPUT]: 接收技能制品下载、ZIP 解包、包契约核对、本机落点与状态文件四类边界的失败分类
 * [OUTPUT]: 对外提供只携带稳定 `ENT_*` code 的 `EnterpriseSkillInstallError`、封闭的 code 联合与归一化函数 `skillInstallError`
 * [POS]: bundle 技能安装纵深的失败防泄漏边界——错误里不放响应正文、不放宿主绝对路径、不放子进程输出，浏览器只拿到 `error.code`；code 与 platform-client 的 `enterpriseLocalErrorStatus` 投影表一一对应
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 技能安装可能抛出的稳定错误码。
 *
 * 前缀沿用既有 `ENT_*` 体系：`ENT_PLATFORM_*`/`ENT_AUTH_*` 来自平台 Service，
 * `ENT_INVALID_REQUEST`/`ENT_RESOURCE_NOT_FOUND` 与既有路由投影同名，
 * `ENT_SKILL_*` 是本纵深新增的一族（下载/大小/hash/包契约/落点冲突/状态文件/落盘失败），
 * 末尾两枚属**读已装正文**这一条只读线：超限 `ENT_SKILL_CONTENT_TOO_LARGE`、
 * 落盘可疑（非普通文件 / 符号链接逃逸 / 非 UTF-8 正文）`ENT_SKILL_CONTENT_INVALID`；
 * 「本包没装」与「名字不在本包记录里」都复用既有 `ENT_RESOURCE_NOT_FOUND`，不为同一种结果造第二枚码。
 */
export type EnterpriseSkillInstallErrorCode =
  | 'ENT_INVALID_REQUEST'
  | 'ENT_RESOURCE_NOT_FOUND'
  | 'ENT_PLATFORM_UNAVAILABLE'
  | 'ENT_SKILL_DOWNLOAD_FAILED'
  | 'ENT_SKILL_SIZE_MISMATCH'
  | 'ENT_SKILL_HASH_MISMATCH'
  | 'ENT_SKILL_ARCHIVE_INVALID'
  | 'ENT_SKILL_PACKAGE_MISMATCH'
  | 'ENT_SKILL_NAME_CONFLICT'
  | 'ENT_SKILL_STATE_INVALID'
  | 'ENT_SKILL_INSTALL_FAILED'
  | 'ENT_SKILL_CONTENT_TOO_LARGE'
  | 'ENT_SKILL_CONTENT_INVALID'

/** 只向路由与界面暴露固定 code；`cause` 留在 Host 侧日志，不进响应体。 */
export class EnterpriseSkillInstallError extends Error {
  constructor(
    readonly code: EnterpriseSkillInstallErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'EnterpriseSkillInstallError'
  }
}

/** 把未知 I/O 或平台失败收敛为调用方指定的稳定 code；已是本类则原样透传。 */
export function skillInstallError(
  error: unknown,
  fallback: EnterpriseSkillInstallErrorCode,
  message: string,
): EnterpriseSkillInstallError {
  return error instanceof EnterpriseSkillInstallError
    ? error
    : new EnterpriseSkillInstallError(fallback, message, { cause: error })
}
