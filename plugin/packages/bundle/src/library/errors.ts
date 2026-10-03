/**
 * [INPUT]: 接收资料库纵深三处边界的失败分类——主键门禁（键层）、记录形状与归属（域层）、对象落点与不可变语义（对象层）
 * [OUTPUT]: 对外提供只携带稳定 `library/*` code 的 `LibraryError`、封闭的 code 联合与归一化函数 `libraryError`/`badRequest`
 * [POS]: bundle 资料库纵深的失败防泄漏边界——错误里不放宿主绝对路径、不放资料正文、不放底层 I/O 细节，调用方只拿到 `error.code`；码名与 workdsh 的 `library/*` 同形（方案 §4.4「D. HTTP 面」D3 要求 `library/*` → 400、`library/internal` → 500），界面侧将来在 `ui/src/error-messages.ts` 那张唯一码表里配人话与下一步动作（产品宪法：禁止把技术码直接砸给用户）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 资料库本刀（存储与域层）可能抛出的稳定错误码。
 *
 * 命名沿用 workdsh 的 `library/*` 族（小写中划线，与官方 `ENT_*` 大写族并列而不混用：
 * `ENT_*` 是「企业平台面」的码，`library/*` 是「资料库领域」的码，将来路由层按前缀分派投影）。
 * 本刀只落地存储与域层真正会抛的那一族；转换器（`conversion-failed` 等）与 HTTP 面
 * （`invalid-page` 等）留到后续刀，**不预造没人抛的码**。
 */
export type LibraryErrorCode =
  /** 入参形状非法（不是字符串 / 空串 / 超长 / 类型不对）。 */
  | 'library/invalid-request'
  /** 主键归一化后仍不可用（空段、段数为 0、段不是字符串）。 */
  | 'library/invalid-key'
  /** 同一 key 已被**别的**三元组（scope/ownerId/id）占用：fail-closed，绝不覆盖别人的记录。 */
  | 'library/key-collision'
  /** 展示名非法（空 / `.` / `..` / 含 `/` `\` 或控制字符 / 超长）。 */
  | 'library/invalid-name'
  /** 记录不存在（含 A8「主体隔离」：别的主体的记录在本主体视角下就是不存在）。 */
  | 'library/not-found'
  /** 记录在、对象层的原件或正文缺失（不可变原件的缺口，与 not-found 区分以便界面给不同人话）。 */
  | 'library/object-missing'
  /** 对象落点不是普通文件/目录（目录冒充文件、符号链接一律拒）。 */
  | 'library/object-invalid'
  /** 对象路径门禁不成立：`realpath` 逐字等式失败，落点跑出了对象根。 */
  | 'library/path-escape'
  /** 超过单文件上限（原件 50 MiB / 正文与草稿正文 8 MiB / conversion 1 MiB）。
   *  与 workdsh 的 `library/file-size` **同一语义**：本仓已经为这条语义落过这一枚码（见 `objects.ts`
   *  的上限注释与 §4.4 C8），不为一件事再造第二枚（`errors.ts` 的纪律：不预造无人抛的码）。 */
  | 'library/file-too-large'
  /** 同一 revisionId 二次写入：不可变原件不允许覆盖。 */
  | 'library/revision-immutable'
  /** 同父节点下大小写不敏感重名。 */
  | 'library/name-conflict'
  /** 父节点不是文件夹。 */
  | 'library/not-folder'
  /** 移动会形成环（把节点移到它自己的后代下）。 */
  | 'library/cycle'
  /** 记录形状不符 zod 门禁（写入前的 parse，或假实现/官方后端在读取边界的校验）。 */
  | 'library/invalid-record'
  /** `conversion.json` 空文件 / 非 JSON / 形状不符。 */
  | 'library/conversion-invalid'
  /** 正文不是合法 UTF-8 或夹 NUL（二进制冒充文本）。 */
  | 'library/invalid-text'
  /** 单主体容量超限（默认 5 GiB，A26:16）。 */
  | 'library/quota-exceeded'
  /** 单会话选中集合超限（默认 32 个节点，A26:182 / §4.4 C9）。 */
  | 'library/selection-too-large'
  /** 资产已停用：**读正文**与选中一律拒（§4.4 F13 的"停用即隔离"）。 */
  | 'library/disabled'
  /** 该资料不在本会话的选中集合里（工具边界的收窄，§4.4 F12/E4）。 */
  | 'library/not-selected'
  /** 工具调用处拿不到会话 id（没有 `exec.agent`）——没有会话就没有"本轮选中"，fail-closed。 */
  | 'library/session-required'
  /** 草稿只允许 `markdown`/`text` 资产（§4.4 C8 的 `library/draft-format`；别的格式没有可编辑的正文）。 */
  | 'library/draft-format'
  /**
   * 草稿乐观锁不匹配（§4.4 F8/C8）：`expectedRevision` 不是当前的那枚 token —— 有人（或另一次调用）
   * 已经改过这份草稿，**绝不静默覆盖**。
   */
  | 'library/revision-conflict'
  /**
   * 发布时草稿的**基准修订已经过期**（§4.4 F8/C8）：`asset.currentRevisionId !== draft.baseRevisionId`
   * ——分叉之后正文已经有了新版本，直接发布会把那一版盖掉 ⇒ 必须重新创建草稿。
   */
  | 'library/base-revision-conflict'
  /**
   * 发布类工具缺少用户的明确确认（§4.1 F7 / §4.4 E5）：`user_confirmed !== true` 一律拒。
   *
   * 这一条是 workdsh **自己**的布尔门闩（不是官方审批服务）——发布是"把草稿变成正式版本"的不可逆动作，
   * 必须由用户拍板，模型不许自行确认。
   */
  | 'library/user-confirmation-required'
  /** 未分类的 I/O 失败；HTTP 面把它投影成 500，其余都按族投影成 400/404/409/413。 */
  | 'library/internal'

/**
 * 只向路由与界面暴露固定 code 的资料库错误。
 *
 * `message` 是**给宿主日志**的英文技术句（不含绝对路径、不含正文），`cause` 保留原始异常，
 * 两者都不进响应体——响应体只由 code 决定。
 */
export class LibraryError extends Error {
  constructor(
    readonly code: LibraryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'LibraryError'
  }
}

/** 入参形状错误的简写；`library/invalid-request` 是它的固定码。 */
export function badRequest(message: string): LibraryError {
  return new LibraryError('library/invalid-request', message)
}

/** 把未知 I/O 或底层失败收敛为调用方指定的稳定 code；已是本类则原样透传（保留更精确的码）。 */
export function libraryError(
  error: unknown,
  fallback: LibraryErrorCode,
  message: string,
): LibraryError {
  return error instanceof LibraryError
    ? error
    : new LibraryError(fallback, message, { cause: error })
}
