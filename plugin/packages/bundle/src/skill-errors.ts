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
 *
 * **本刀（本地上传）**新增四枚（真源 `docs/plan/skill-install-sources.md` §B.1/§D.4）：
 * `ENT_SKILL_SKILLMD_INVALID`（`SKILL.md` frontmatter 闸门 D4-1…D4-8 任一条不过）、
 * `ENT_SKILL_UPLOAD_INVALID`（multipart 形状非法 / 不是恰好一个 `artifact` part）、
 * `ENT_SKILL_UPLOAD_TOO_LARGE`（超过 50 MiB 上传配额）、
 * `ENT_SKILL_UPLOAD_FAILED`（上传制品落盘失败）。四枚都与平台侧唯一那张码→状态表一一对应。
 *
 * **本刀（系统搜索 / 纳入）**新增三枚（真源 `docs/research/cherry-skill-add-2026-10-05.md` §2.4 的
 * `importSystem` 三条硬拒，上游 tag `v2.1.4` 的 `SkillService.ts:409-411`/`:412-414`/`:415-417`）：
 * `ENT_SKILL_DISCOVERY_UNKNOWN`（那条目录不在本次盘点候选里 —— 先 `realpath` 再查候选，`:406`）、
 * `ENT_SKILL_ALREADY_REGISTERED`（已被企业记录或自装记录认领，不必也不要再登记一次）、
 * 第三条**复用既有** `ENT_SKILL_NAME_CONFLICT`（折叠目录名已被别的技能占用，不造第二枚同义码）；
 * 另加一枚**基础设施码** `ENT_SKILL_ADOPT_FAILED`：纳入这一步本机自己失败（目录子树超过可摘要上限），
 * 与「策略拒绝」不是一回事，故与上面三枚分开（500，而不是 4xx 的「请求有问题」）。
 *
 * **本刀（在线搜索 / 从结果安装）**新增三枚（真源 `docs/plan/skill-install-sources.md` §B.2/§C/§F.1）：
 * `ENT_SKILL_SOURCE_UNKNOWN`（坐标不认：未知源、无 GitHub 坐标的源、坐标指不到任何技能）、
 * `ENT_SKILL_SOURCE_UNREACHABLE`（源连不上 / 超时 / 非 200 / 重定向跨出白名单）、
 * `ENT_SKILL_SOURCE_TOO_LARGE`（上游正文或解压后体量超过本通路的**独立**上限）。
 * 「包结构不合法」「`SKILL.md` frontmatter 不过」「上游拿不到包」「落盘失败」一律沿用**既有**码
 * （`ENT_SKILL_ARCHIVE_INVALID` / `ENT_SKILL_SKILLMD_INVALID` / `ENT_SKILL_DOWNLOAD_FAILED` /
 * `ENT_SKILL_INSTALL_FAILED`）—— 不为同一种结果造第二枚码。
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
  | 'ENT_SKILL_SKILLMD_INVALID'
  | 'ENT_SKILL_UPLOAD_INVALID'
  | 'ENT_SKILL_UPLOAD_TOO_LARGE'
  | 'ENT_SKILL_UPLOAD_FAILED'
  | 'ENT_SKILL_DISCOVERY_UNKNOWN'
  | 'ENT_SKILL_ALREADY_REGISTERED'
  | 'ENT_SKILL_ADOPT_FAILED'
  | 'ENT_SKILL_SOURCE_UNKNOWN'
  | 'ENT_SKILL_SOURCE_UNREACHABLE'
  | 'ENT_SKILL_SOURCE_TOO_LARGE'

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
