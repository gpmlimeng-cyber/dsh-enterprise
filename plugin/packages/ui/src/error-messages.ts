/**
 * [INPUT]: 接收任意 `ENT_*` 稳定错误码（来源可以是本地路由投影、store 快照、动作 promise 的 catch）
 * [OUTPUT]: 对外提供**唯一一份**错误码 → 员工可读呈现的纯投影：`enterpriseErrorPresentation`（人话 + 下一步动作 + 是否可重试 + 码原样保留）、`enterpriseErrorMessage` / `enterpriseErrorAction` / `enterpriseErrorRetryable` 与三条兜底常量。**本刀（资料库入口）**：新增三码——`ENT_LIBRARY_UNAVAILABLE`（资料库还没接线：页面失败态的「接入中」）、`ENT_LIBRARY_SETTING_READ_FAILED` / `ENT_LIBRARY_SETTING_SAVE_FAILED`（本机设置读/写失败：组件行那枚开关的失败态与重试），一律人话 + 下一步、不含裸码 **本刀（配方一键启用）**：新增十一枚配方启用码（`ENT_PRESET_AUTHORIZATION_REQUIRED` / `_AUTHORIZATION_STALE` / `_INSTALL_IN_PROGRESS` / `_INSTALL_CANCELLED` / `_STATE_INVALID` / `_RECIPE_INVALID` / `_INSTALL_FAILED` / `_UNINSTALL_FAILED` / `_BUNDLE_WRITE_FAILED` / `_ARTIFACT_UNAVAILABLE`）与降级链第二级那枚 `ENT_PRESET_LAUNCH_FAILED`（没打开新会话 → 请改用「复制导入指令」）。
 * [POS]: ui 的员工侧文案降维层（失败自愈）——产品宪法「必须给稳定错误码时，也要配对一句人话与下一步动作，禁止把技术码直接砸给用户」的唯一落点；界面只消费本模块，不再各写一份码表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 一枚错误码的员工侧呈现。`code` 永远原样保留——支持与排障仍然需要它，
 * 只是它不再出现在主文案里，而是收进「技术信息」折叠区（见 `error-notice.tsx`）。
 */
export interface EnterpriseErrorPresentation {
  /** 员工看得懂的一句话：发生了什么。 */
  readonly message: string
  /** 明确的下一步动作（重试 / 去登录 / 去安装 / 联系管理员…）。 */
  readonly action: string
  /** 是否值得原地再试一次（终态失败不该给「重试」画饼）。 */
  readonly retryable: boolean
  /** 稳定错误码，原样回传，不吞不改。 */
  readonly code: string
  /** 是否命中了下面那张表（未命中即走了兜底人话）。 */
  readonly known: boolean
}

/** 未在映射表里的码一律落到这句人话（绝不漏出裸码）。 */
export const ENTERPRISE_ERROR_FALLBACK_MESSAGE = '操作没有完成。'
/** 未在映射表里的码一律落到这个下一步。 */
export const ENTERPRISE_ERROR_FALLBACK_ACTION = '请重试；仍然失败请联系企业管理员。'

/** 下一步动作里最常用的几句，独立导出以便界面与测试共用同一份措辞。 */
export const ENTERPRISE_ERROR_ACTIONS = {
  retry: '重试',
  refresh: '刷新后重试',
  login: '去登录',
  admin: '联系企业管理员',
  close: '无需操作',
} as const

/** `ENT_*` 的形状门禁：只有受控标识符才进映射（Host 塞进来的任意字符串不作数）。 */
const ERROR_CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/**
 * **唯一一份**码 → 人话表。
 *
 * 取值口径（三条，逐条都能被 `tests/error-messages.spec.ts` 机械复核）：
 *  ① `message` 说「发生了什么」、`action` 说「我现在能做什么」，两句都不含裸码；
 *  ② `retryable` 只对**同一输入再试可能不同**的失败为 true（网络/上游/在途冲突），
 *     终态（包损坏、哈希不符、超限、可见范围、权限）为 false —— 不给必然失败的重试画饼；
 *  ③ 一个码只有一句话：技能 tab、企业技能页签、详情子页面、设置页共用这一份，不存在第二份措辞。
 *
 * 表里没有的码走 `ENTERPRISE_ERROR_FALLBACK_*`（同样有人话与下一步），界面因此永远拿得到可读文案。
 */
const ENTERPRISE_ERROR_TABLE: Readonly<Record<string, { readonly message: string; readonly action: string; readonly retryable: boolean }>> = {
  // ── 平台 / 本地路由 ────────────────────────────────────────────────────────────
  ENT_INVALID_REQUEST: { message: '提交的内容不完整或格式不正确。', action: '请检查后重试；仍然失败请联系企业管理员。', retryable: false },
  ENT_LOCAL_UNAVAILABLE: { message: '暂时无法连接本机服务。', action: '请稍后重试；仍然失败请重新打开应用。', retryable: true },
  ENT_LOCAL_RESPONSE_INVALID: { message: '本机服务返回了无法识别的结果。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_PLATFORM_UNAVAILABLE: { message: '暂时无法连接企业服务。', action: '请稍后重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_PLATFORM_DISPOSED: { message: '企业服务连接已关闭。', action: '请重新打开应用后重试。', retryable: true },
  ENT_RESPONSE_INVALID: { message: '企业服务返回了无法识别的结果。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_NETWORK_ERROR: { message: '网络连接失败。', action: '请检查网络后重试。', retryable: true },
  ENT_SERVER_URL_INVALID: { message: '企业服务地址不可用。', action: '请在「企业设置」里检查 Server 地址后重试。', retryable: false },
  ENT_REQUEST_TOO_LARGE: { message: '提交的内容太大。', action: '请减小内容后重试。', retryable: false },
  ENT_REQUEST_IN_PROGRESS: { message: '上一次请求还在处理中。', action: '请稍候再试。', retryable: true },
  ENT_REQUEST_ALREADY_COMPLETED: { message: '这项请求已经完成了。', action: '请刷新查看最新结果。', retryable: false },
  ENT_REVISION_CONFLICT: { message: '内容已被其他人修改。', action: '请刷新后重试。', retryable: true },
  ENT_SETTINGS_UNAVAILABLE: { message: '企业设置暂时无法保存。', action: '请稍后重试。', retryable: true },
  ENT_RESOURCE_NOT_FOUND: { message: '这项内容已经不在企业目录里了。', action: '请刷新后重试；仍然失败请联系企业管理员。', retryable: false },
  ENT_RESOURCE_NOT_OWNED: { message: '这项内容不属于当前账号。', action: '请换用正确的企业账号登录。', retryable: false },
  ENT_PERMISSION_DENIED: { message: '当前账号没有这项操作的权限。', action: '请联系企业管理员开通权限后重试。', retryable: false },
  ENT_MODEL_NOT_ASSIGNED: { message: '当前账号还没有可用的模型。', action: '请联系企业管理员为你开通模型。', retryable: false },

  // ── 登录 / 设备 ───────────────────────────────────────────────────────────────
  ENT_AUTH_REQUIRED: { message: '需要先登录企业账号。', action: '登录企业账号后重试。', retryable: false },
  ENT_AUTH_SESSION_EXPIRED: { message: '企业登录已过期。', action: '请重新登录企业账号。', retryable: false },
  ENT_AUTH_CANCELLED: { message: '登录已取消。', action: '需要时请重新发起登录。', retryable: false },
  ENT_AUTH_TIMEOUT: { message: '登录等待超时。', action: '请重试登录。', retryable: true },
  ENT_AUTH_CODE_INVALID: { message: '登录信息已失效。', action: '请重新发起登录。', retryable: false },
  ENT_AUTH_STATE_INVALID: { message: '登录信息已失效。', action: '请重新发起登录。', retryable: false },
  ENT_AUTH_CALLBACK_INVALID: { message: '登录回调信息不正确。', action: '请重新发起登录。', retryable: false },
  ENT_PKCE_INVALID: { message: '登录安全校验没有通过。', action: '请重新发起登录。', retryable: false },
  ENT_PKCE_REQUIRED: { message: '登录安全校验缺失。', action: '请重新发起登录。', retryable: false },
  ENT_INVALID_REDIRECT_URI: { message: '登录回调地址不正确。', action: '请联系企业管理员检查服务配置。', retryable: false },
  ENT_DEVICE_REVOKED: { message: '此设备已被管理员撤销。', action: '请联系企业管理员重新授权此设备。', retryable: false },
  ENT_DEVICE_ALREADY_BOUND: { message: '此设备已经绑定了其他账号。', action: '请联系企业管理员处理。', retryable: false },
  ENT_IDENTITY_ALREADY_LINKED: { message: '这个身份已经绑定过账号。', action: '请直接登录，或联系企业管理员。', retryable: false },
  ENT_LAST_ENTERPRISE_ADMIN: { message: '这是最后一个企业管理员。', action: '请先指定接替的管理员。', retryable: false },
  ENT_LAST_MEMBER_IDENTITY: { message: '这是最后一个可登录身份。', action: '请先绑定新的登录方式。', retryable: false },

  // ── 用量配额 ─────────────────────────────────────────────────────────────────
  ENT_QUOTA_RPM_EXCEEDED: { message: '请求太频繁，已超出企业限额。', action: '请稍候再试。', retryable: true },
  ENT_QUOTA_CONCURRENCY_EXCEEDED: { message: '同时进行的任务已达企业上限。', action: '请等当前任务结束后再试。', retryable: true },
  ENT_QUOTA_FIVE_HOURS_EXCEEDED: { message: '本时段的用量已用完。', action: '请等到下个时段，或联系企业管理员调整配额。', retryable: false },
  ENT_QUOTA_DAILY_EXCEEDED: { message: '今日的用量已用完。', action: '请明天再试，或联系企业管理员调整配额。', retryable: false },
  ENT_QUOTA_WEEKLY_EXCEEDED: { message: '本周的用量已用完。', action: '请下周再试，或联系企业管理员调整配额。', retryable: false },
  ENT_QUOTA_MONTHLY_EXCEEDED: { message: '本月的用量已用完。', action: '请联系企业管理员调整配额。', retryable: false },

  // ── 企业模型上游 ─────────────────────────────────────────────────────────────
  ENT_UPSTREAM_UNAVAILABLE: { message: '企业模型服务暂时不可用。', action: '请稍后重试。', retryable: true },
  ENT_UPSTREAM_TIMEOUT: { message: '企业模型服务响应超时。', action: '请重试。', retryable: true },
  ENT_UPSTREAM_RATE_LIMITED: { message: '企业模型服务当前请求过多。', action: '请稍候重试。', retryable: true },
  ENT_UPSTREAM_INVALID_RESPONSE: { message: '企业模型服务返回了无法识别的结果。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_UPSTREAM_AUTH_FAILED: { message: '企业模型服务鉴权失败。', action: '请联系企业管理员检查模型配置。', retryable: false },
  ENT_UPSTREAM_QUOTA_EXCEEDED: { message: '上游模型额度已用完。', action: '请联系企业管理员。', retryable: false },

  // ── 技能 ─────────────────────────────────────────────────────────────────────
  ENT_SKILL_DOWNLOAD_FAILED: { message: '技能包没有下载完成。', action: '请检查网络后重试。', retryable: true },
  ENT_SKILL_INSTALL_FAILED: { message: '技能没有安装成功。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_SKILL_SIZE_MISMATCH: { message: '技能包大小与中心记录不一致。', action: '请重新下载；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_SKILL_HASH_MISMATCH: { message: '技能包校验没有通过。', action: '请重新下载；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_SKILL_ARCHIVE_INVALID: { message: '技能包已损坏，无法打开。', action: '请重新下载；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_SKILL_PACKAGE_MISMATCH: { message: '技能包内容与中心记录不一致。', action: '请联系企业管理员重新发布这个技能。', retryable: false },
  ENT_SKILL_INVALID_PACKAGE: { message: '技能包内容不符合规范。', action: '请联系企业管理员重新发布这个技能。', retryable: false },
  ENT_SKILL_NAME_CONFLICT: { message: '本机已有同名技能。', action: '请先卸载同名技能，再重试安装。', retryable: false },
  ENT_SKILL_STATE_INVALID: { message: '本机的技能安装记录已损坏。', action: '请刷新后重试；仍然失败请联系企业管理员。', retryable: false },
  ENT_SKILL_CONTENT_TOO_LARGE: { message: '这个文件太大，暂时无法预览。', action: '请选择其它文件；或联系企业管理员调整包内文件。', retryable: false },
  ENT_SKILL_CONTENT_INVALID: { message: '这个文件不是可预览的文本。', action: '请选择文本文件查看。', retryable: false },
  ENT_SKILL_TOO_LARGE: { message: '技能包超出企业允许的大小。', action: '请联系企业管理员重新发布。', retryable: false },
  ENT_SKILL_NOT_PUBLISHED: { message: '这个技能还没有发布。', action: '请联系企业管理员确认发布状态。', retryable: false },
  ENT_SKILL_VISIBILITY_DENIED: { message: '这个技能不在你的可见范围内。', action: '请联系企业管理员开通可见范围。', retryable: false },

  // ── 插件 ─────────────────────────────────────────────────────────────────────
  ENT_PLUGIN_DOWNLOAD_FAILED: { message: '插件包没有下载完成。', action: '请检查网络后重试。', retryable: true },
  ENT_PLUGIN_SIZE_MISMATCH: { message: '插件包大小与中心记录不一致。', action: '请重试；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_PLUGIN_HASH_MISMATCH: { message: '插件包校验没有通过。', action: '请重试；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_PLUGIN_ARTIFACT_INVALID: { message: '插件包已损坏，无法使用。', action: '请联系企业管理员重新发布这个插件。', retryable: false },
  ENT_PLUGIN_ARCHIVE_TOO_LARGE: { message: '插件包超出企业允许的大小。', action: '请联系企业管理员重新发布。', retryable: false },
  ENT_PLUGIN_SIGNATURE_INVALID: { message: '企业插件的信任配置不可用。', action: '请联系企业管理员。', retryable: false },
  ENT_PLUGIN_INCOMPATIBLE: { message: '这个插件与当前客户端不兼容。', action: '请联系企业管理员更换版本。', retryable: false },
  ENT_PLUGIN_BUSY: { message: '另一项插件操作正在进行。', action: '请等它结束后重试。', retryable: true },
  ENT_PLUGIN_CLI_FAILED: { message: '插件安装工具执行失败。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_PLUGIN_COMMAND_FAILED: { message: '插件安装命令执行失败。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_PLUGIN_LOADER_INACTIVE: { message: '插件没有启动起来。', action: '请重试，或卸载这个插件。', retryable: true },
  ENT_PLUGIN_STATE_INVALID: { message: '本机的插件记录已损坏。', action: '请重试；仍然失败请联系企业管理员。', retryable: false },
  ENT_PLUGIN_NOT_ASSIGNED: { message: '这个插件不在你的可见范围内。', action: '请联系企业管理员开通可见范围。', retryable: false },
  ENT_PLUGIN_CORE_PROTECTED: { message: '这是企业必需的核心插件，不能卸载。', action: '无需操作。', retryable: false },

  // ── 配方 ─────────────────────────────────────────────────────────────────────
  ENT_PRESET_INVALID_PACKAGE: { message: '配方文件已损坏，无法打开。', action: '请重新下载；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_PRESET_NOT_PUBLISHED: { message: '这个配方还没有发布。', action: '请联系企业管理员确认发布状态。', retryable: false },
  ENT_PRESET_TOO_LARGE: { message: '配方超出企业允许的大小。', action: '请联系企业管理员重新发布。', retryable: false },
  ENT_PRESET_VISIBILITY_DENIED: { message: '这个配方不在你的可见范围内。', action: '请联系企业管理员开通可见范围。', retryable: false },
  // 配方**一键启用**的码族（bundle 的 `preset/errors.ts` 抛出，经 platform-client 的
  // `enterpriseLocalErrorStatus` 投影成 400/403/409/503）。retryable 只对**同一输入再试可能不同**的为 true：
  // 未授权 / 指纹已变要员工先做一次确认（再试同样的请求必然还是被拒），故 false；
  // 「进行中」「取消」与三枚本机/上游失败都是瞬时态，故 true。
  ENT_PRESET_AUTHORIZATION_REQUIRED: { message: '这条配方还没有在你的设备上确认过。', action: '请先查看它会带来什么，确认后即可启用。', retryable: false },
  ENT_PRESET_AUTHORIZATION_STALE: { message: '这条配方的内容已经变了。', action: '请重新查看并确认一次，再启用。', retryable: false },
  ENT_PRESET_INSTALL_IN_PROGRESS: { message: '这条配方正在处理中。', action: '请等它结束后再操作。', retryable: true },
  ENT_PRESET_INSTALL_CANCELLED: { message: '这次启用被取消了。', action: '请重新启用。', retryable: true },
  ENT_PRESET_STATE_INVALID: { message: '本机的配方记录已损坏。', action: '请重试；仍然失败请联系企业管理员。', retryable: false },
  ENT_PRESET_RECIPE_INVALID: { message: '这条配方的内容不符合规范，无法启用。', action: '请联系企业管理员重新发布这个配方。', retryable: false },
  ENT_PRESET_INSTALL_FAILED: { message: '配方没有启用成功。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_PRESET_UNINSTALL_FAILED: { message: '配方没有停用干净。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_PRESET_BUNDLE_WRITE_FAILED: { message: '本机没有写出这条配方需要的文件。', action: '请重试；仍然失败请检查本机的存储权限。', retryable: true },
  ENT_PRESET_ARTIFACT_UNAVAILABLE: { message: '暂时取不到这条配方的文件。', action: '请检查网络后重试；仍然失败请联系企业管理员。', retryable: true },
  // 降级链第二级（跳到新会话并填入指令）自己那枚失败码：本机没有可落的新会话/输入框（离线、没有工作区、
  // 官方那两件服务缺席或版本不匹配）。它**不代表**一键启用不可用，只说明这一级没走成 → 请改用第三级。
  ENT_PRESET_LAUNCH_FAILED: { message: '没能为你打开一个新的会话。', action: '请改用「复制导入指令」，粘贴给助手即可。', retryable: true },

  // ── 企业品牌 ─────────────────────────────────────────────────────────────────
  ENT_BRANDING_ASSET_INVALID: { message: '企业标识图片无法使用。', action: '请联系企业管理员重新上传。', retryable: false },
  ENT_BRANDING_ASSET_TOO_LARGE: { message: '企业标识图片超出大小限制。', action: '请联系企业管理员换一张更小的图片。', retryable: false },

  // ── 资料库（本机资料集合） ───────────────────────────────────────────────────
  ENT_LIBRARY_UNAVAILABLE: { message: '资料库还在接入中，暂时打不开。', action: '请稍后重试；仍然打不开请联系企业管理员。', retryable: true },
  ENT_LIBRARY_SETTING_READ_FAILED: { message: '本机保存的资料库开关没有读取到。', action: '已按默认关闭处理；请重试，或重新拨动一次开关。', retryable: true },
  ENT_LIBRARY_SETTING_SAVE_FAILED: { message: '资料库开关没有保存到本机。', action: '请重试；仍然失败请检查本机的存储权限。', retryable: true },

  // ── 帮助与反馈 ───────────────────────────────────────────────────────────────
  ENT_FEEDBACK_INVALID: { message: '反馈内容不完整。', action: '请填写描述并勾选同意后重试。', retryable: false },
  ENT_FEEDBACK_ATTACHMENT_INVALID: { message: '只支持 PNG/JPEG/WebP 图片，最多 3 张。', action: '请调整图片后重试。', retryable: false },
  ENT_FEEDBACK_ATTACHMENT_TOO_LARGE: { message: '单张图片不能超过 2 MiB。', action: '请压缩后重试。', retryable: false },
  ENT_FEEDBACK_STATE_CONFLICT: { message: '这次反馈的状态已经变化。', action: '请刷新后重试。', retryable: false },

  // ── 应用更新制品 ─────────────────────────────────────────────────────────────
  ENT_ARTIFACT_INTEGRITY_FAILED: { message: '更新包校验没有通过。', action: '请重新检查更新；仍然失败请联系企业管理员。', retryable: false },
  ENT_ARTIFACT_UNSIGNED: { message: '更新包没有企业签名。', action: '请联系企业管理员。', retryable: false },
  ENT_ARTIFACT_CORE_PACKAGE: { message: '核心包不能单独更新。', action: '请改用完整的应用更新。', retryable: false },

  // ── 会话同步 ─────────────────────────────────────────────────────────────────
  ENT_SESSION_SYNC_DISABLED: { message: '会话同步没有启用。', action: '如需同步请联系企业管理员开启。', retryable: false },
  ENT_SESSION_SYNC_NOT_READY: { message: '会话同步还没有准备好。', action: '请稍后重试。', retryable: true },
  ENT_SESSION_CONTENT_EXPIRED: { message: '会话内容已过期。', action: '请刷新后重试。', retryable: false },
  ENT_SESSION_FORMAT_UNSUPPORTED: { message: '这份会话的格式暂不支持同步。', action: '请联系企业管理员。', retryable: false },
  ENT_SESSION_DIVERGED: { message: '会话在两台设备上出现了不一致。', action: '请刷新后重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_SESSION_SEQ_GAP: { message: '会话同步缺少了中间内容。', action: '请刷新后重试。', retryable: true },
  ENT_SESSION_SOURCE_DEVICE_CONFLICT: { message: '会话来源设备冲突。', action: '请刷新后重试；仍然失败请联系企业管理员。', retryable: true },
  ENT_SESSION_BATCH_TOO_LARGE: { message: '本次同步的内容太多。', action: '请稍后重试。', retryable: true },
  ENT_SESSION_UPLOAD_FAILED: { message: '会话同步上传没有完成。', action: '请稍后重试。', retryable: true },
  ENT_SESSION_READ_FAILED: { message: '会话内容读取没有完成。', action: '请稍后重试。', retryable: true },
  ENT_SESSION_CURSOR_INVALID: { message: '会话同步位置已失效。', action: '请刷新后重试。', retryable: true },

  // ── 账户后台地址（企业设置） ─────────────────────────────────────────────────
  ENT_INVALID_ACCOUNT_ORIGIN: { message: '地址格式不正确：必须是 HTTPS，或指向本机的 HTTP 地址。', action: '请修改后重新保存。', retryable: false },
  ENT_ACCOUNT_ORIGIN_WRITE_FAILED: { message: '账户后台地址写入失败。', action: '请检查 Harness 配置目录权限后重试。', retryable: true },
  ENT_ACCOUNT_REMOUNT_FAILED: { message: '地址已保存，但账户后台没有重新挂载。', action: '请重启 Harness 后重试。', retryable: false },
}

/**
 * 表里出现过的全部码（排序后），供「新增码必须入表」这类机械门禁遍历。
 * **不是**可展示清单——员工侧只经 `enterpriseErrorPresentation` 取呈现。
 */
export const ENTERPRISE_ERROR_CODES: readonly string[] = Object.freeze(Object.keys(ENTERPRISE_ERROR_TABLE).sort())

/**
 * 码 → 呈现的**唯一入口**（纯函数，无 React、无 I/O）。
 *
 * 未命中映射表 / 码不是受控标识符形状 / 空串一律落到兜底：
 * `message` 仍是人话、`action` 仍是下一步，`code` 原样保留（支持排障取得到），只是 `known=false`。
 *
 * @param code - 任意 `ENT_*` 稳定错误码；`undefined` / 空串同样有兜底人话。
 * @returns 员工侧呈现（人话 + 下一步 + 可重试 + 原样码）。
 */
export function enterpriseErrorPresentation(code: string | undefined | null): EnterpriseErrorPresentation {
  const normalized = typeof code === 'string' ? code.trim() : ''
  const hit = ERROR_CODE_SHAPE.test(normalized) ? ENTERPRISE_ERROR_TABLE[normalized] : undefined
  return hit === undefined
    ? { message: ENTERPRISE_ERROR_FALLBACK_MESSAGE, action: ENTERPRISE_ERROR_FALLBACK_ACTION, retryable: true, code: normalized, known: false }
    : { message: hit.message, action: hit.action, retryable: hit.retryable, code: normalized, known: true }
}

/** 人话一句话（「发生了什么」）；未映射的码返回兜底人话，绝不返回裸码。 */
export function enterpriseErrorMessage(code: string | undefined | null): string {
  return enterpriseErrorPresentation(code).message
}

/** 下一步动作（「我现在能做什么」）；未映射的码返回兜底下一步。 */
export function enterpriseErrorAction(code: string | undefined | null): string {
  return enterpriseErrorPresentation(code).action
}

/** 这个失败是否值得原地再试一次。 */
export function enterpriseErrorRetryable(code: string | undefined | null): boolean {
  return enterpriseErrorPresentation(code).retryable
}
