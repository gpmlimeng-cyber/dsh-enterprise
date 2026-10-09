/**
 * [INPUT]: 接收任意 `ENT_*` 稳定错误码（来源可以是本地路由投影、store 快照、动作 promise 的 catch）
 * [OUTPUT]: **本刀（登录入口换成 NUWAX）**：表里新增六枚 NUWAX 码（`ENT_NUWAX_NOT_CONFIGURED` / `_INVALID_CREDENTIALS` / `_REJECTED` / `_UNAVAILABLE` / `_TIMEOUT` / `_PROTOCOL`），下一步逐句不同——被平台拒绝（风控/账号锁定）是**终态**，不给「再输一次同样的口令」画饼。对外提供**唯一一份**错误码 → 员工可读呈现的纯投影：`enterpriseErrorPresentation`（人话 + 下一步动作 + 是否可重试 + 码原样保留）、`enterpriseErrorMessage` / `enterpriseErrorAction` / `enterpriseErrorRetryable` 与三条兜底常量。**本刀（资料库入口）**：新增三码——`ENT_LIBRARY_UNAVAILABLE`（资料库还没接线：页面失败态的「接入中」）、`ENT_LIBRARY_SETTING_READ_FAILED` / `ENT_LIBRARY_SETTING_SAVE_FAILED`（本机设置读/写失败：组件行那枚开关的失败态与重试），一律人话 + 下一步、不含裸码 **本刀（配方一键启用）**：新增十一枚配方启用码（`ENT_PRESET_AUTHORIZATION_REQUIRED` / `_AUTHORIZATION_STALE` / `_INSTALL_IN_PROGRESS` / `_INSTALL_CANCELLED` / `_STATE_INVALID` / `_RECIPE_INVALID` / `_INSTALL_FAILED` / `_UNINSTALL_FAILED` / `_BUNDLE_WRITE_FAILED` / `_ARTIFACT_UNAVAILABLE`）与降级链第二级那枚 `ENT_PRESET_LAUNCH_FAILED`（没打开新会话 → 请改用「复制导入指令」）。**本刀（企业插件真取消）**：新增一枚 `ENT_PLUGIN_INSTALL_CANCELLED`（「这次安装被取消了。请重试。」，`retryable: true`）——取消是员工自己的动作、本机什么都没变（Host 已把记录回到安装前），故它的收束就是再试一次，与配方族那枚同判。**本刀（本地导入）**：新增三枚上传码 `ENT_SKILL_UPLOAD_{TOO_LARGE,INVALID,FAILED}`——超限与「不是有效技能包」是终态（下一步是**换一份文件**，`skill-import.ts` 的「重新选择文件」那枚按钮承担动作），只有落盘失败可原地再试；再补一枚 Host 侧第 4 枚 `ENT_SKILL_SKILLMD_INVALID`（ZIP 结构没问题、是 `SKILL.md` 的 frontmatter 写错了 ⇒ 下一步是**改文件头**，与「换一份文件」不同）。**本刀（系统搜索 → 纳入）**：新增三枚纳入码 `ENT_SKILL_DISCOVERY_UNKNOWN` / `ENT_SKILL_ALREADY_REGISTERED` / `ENT_SKILL_ADOPT_FAILED`；并把「一个码只有一句话」的边界写清（同流一套、真跨流的码用 `actions` 按流取，见下表注）。**本刀（在线搜索）**：新增三枚在线来源码 `ENT_SKILL_SOURCE_{UNKNOWN,UNREACHABLE,TOO_LARGE}`（下一步各不相同：换一条结果 / 检查网络重试 / 换一条结果），并把 `ENT_SKILL_ARCHIVE_INVALID`、`ENT_SKILL_SKILLMD_INVALID`、`ENT_SKILL_INSTALL_FAILED` 三枚**跨流码**补上 `'online-install'` 这一流的口径（那三句默认文案里的「重新下载 / 重新导入 / 联系企业管理员」在**在线安装流**下说不通——包在第三方仓库、本机替用户取）；流值清单一并导出成 `ENTERPRISE_ERROR_FLOWS`（供逐流逐句的机械判据遍历）。**本刀（通过 Agent 创建）**：新增两枚**本机动作**码 `ENT_SKILL_CREATE_{LAUNCH,COPY}_FAILED`——前者是「新会话没开起来」（下一步：把这句指令复制走，界面那枚按钮就是它），后者是「剪贴板没写成」（下一步：检查权限后重试）；两枚刻意分开，因为下一步真的不同。**本刀（esc 失败面收口）**：新增两枚 `ENT_ESC_DIRECTORY_UNAVAILABLE` / `ENT_ESC_RECOMMEND_UNAVAILABLE`——平台那枚 `4040`（本部署没有这个端点）在专家/技能目录与精选行上各说各的事实，不再共用「没有连接器目录」那一句；三枚的**面级**取值真源在 `esc-api.ts` 的 `ESC_MISSING_ENDPOINT_CODES`，且三枚一律 `retryable: false`（重试对"端点不存在"永远无效）。**本刀（口径 49：技能页主按钮三项下拉）**：新增一枚 `ENT_ESC_DRAFT_UNAVAILABLE`——「查找技能 / 创建技能」那两项走 `preset-launch.ts` 的"跳新会话 + 预填、不发送"，预填没走成（端口缺席，或这一次返回 false / 抛）时必须**说出来**；下一步是"手动新建一个会话把这句话贴进去"，故 `retryable: false`（同一条官方链路再点一次还是同一结果，不给必然失败的重试画饼）。**本刀（口径 51：专家页「我的专家」子页）**：新增一枚 `ENT_ESC_MY_EXPERTS_UNAVAILABLE`——本部署的只读闭集**恰好七条**（`bundle/src/esc-route.ts` 的 `ENTERPRISE_ESC_READ_ENDPOINTS`），里面**没有**"我的专家"这条接口，且本刀**不许**新增端点、**不许**拿 `/api/published/agent/list`（那是**专家广场**列表）冒充"我的" ⇒ 子页内容区在全部 tab／分段组合下都是同一份如实交代；`retryable: false` 的理由与本族那四枚「这一版部署没有这个端点」逐条相同。**本刀（Phase C D1：连接器广场）**：新增一枚 `ENT_CONNECTOR_PLAZA_UNAVAILABLE`（宿主 `bundle/src/connector-plaza.ts` 那枚码，四种来由共用一句）——「这一次没读到连接器清单」+「重试」，`retryable: true`（广场失败态里就有那枚真重发的按钮），与同族那几枚「这一版部署没有这个端点」（`retryable: false`）刻意分成两枚。**本刀（S5b）**：新增一枚 `ENT_SKILL_TRY_LAUNCH_FAILED`（技能卡那枚「去试试」没能把指令填进新会话）+ 唯一码值常量 `ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE`——它与「通过 Agent 创建的启动失败」「配方启动失败」都**同形**（同一条 `preset-launch.ts` 链路这一环不成立），但那两枚的下一步都指向**界面上真有的复制按钮 / 配方指令**，在这一格是**说假话**（这句指令按技能名现拼、从不显示、卡片上也没有复制钮）⇒ 新开一枚，下一步是"自己新建一个会话让它用这枚技能干活"，`retryable: false`（与 `ENT_ESC_DRAFT_UNAVAILABLE` 对同一条链路逐条同判）。
 * [POS]: ui 的员工侧文案降维层（失败自愈）——产品宪法「必须给稳定错误码时，也要配对一句人话与下一步动作，禁止把技术码直接砸给用户」的唯一落点；界面只消费本模块，不再各写一份码表
 *   ★**口径 55（本刀）**：删掉 `ENT_ESC_ENABLE_LIST_UNAVAILABLE` 那一格 —— 它只为技能页「我启用的」
 *     那枚维度存在，维度整枚删除后**永远取不到**（本仓不会再有任何请求打到那条端点），
 *     留着就是一张没有落点的死条目（`ESC_MISSING_ENDPOINT_CODES` 同步少一格）。
 *   ★**口径 60（本刀）**：`ENT_SKILL_UPLOAD_TOO_LARGE` 那句「下一步」里的上限改**引用**本地导入通路
 *     那枚唯一常量 `ENTERPRISE_SKILL_IMPORT_MAX_TEXT`（`skill-import.ts`）——本表第一次从通路叶片取词，
 *     换来的是"接受多大"在全 `src` 里只有一个数字真源（门禁：剥注释后全 src 的 `50 MiB` 恰好出现一次）。
 *     方向是单向的（`skill-import.ts` 不依赖本表）⇒ 没有循环；那枚常量本就是 `enterpriseErrorAction`
 *     这条用例双向绑定过的东西，本刀只是把绑带从"用例"换成"代码"。
 *   ★**口径 62（本刀）**：新增一枚 `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（本地三方 Agent 技能源的
 *     扫描读不到，宿主回 503）—— 它**不是**同族那几枚「这一版部署没有这个端点」：
 *     那几枚是部署事实（`retryable: false`），这一枚是"这一次没读到"（`retryable: true`，
 *     下一步就是点界面那一枚真重发的重试）。同刀复用既有的 `ENT_SKILL_DISCOVERY_UNKNOWN` /
 *     `ENT_SKILL_NAME_CONFLICT` / `ENT_SKILL_ALREADY_REGISTERED` 三枚做安装失败的三条收束，
 *     一码一句话这一点不变（不许为同一种结果造第二枚码）。
 *   ★**口径 64（本刀）**：新增一枚 `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`（系统广场「已发布技能」的
 *     复制授权被拒：`allowCopy !== 1` 或 `paymentRequired === true`）——`retryable: false`
 *     （授权是发布者设定的，重试永远无效；界面据此**不画**重试按钮），并另出一枚常量
 *     `ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE`（码值只有一处，供界面把同一句话用作
 *     **卡片上那枚【＋】的可见禁用原因**）。同刀**一个既有码的文案都没有改**。
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

// ★**口径 60**：本表唯一一处需要"上限数字"的那句话改引本地导入那条通路的事实常量
//   （`skill-import.ts` 是那件事的真源；本模块只借它的**人话形态**，不引它的任何行为）。
//   方向是单向的：`skill-import.ts` 不反过来依赖本表，故没有循环。
import { ENTERPRISE_SKILL_IMPORT_MAX_TEXT } from './skill-import.js'

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
 * 员工侧的**流**标识（本刀：只有「真跨流、且两条流的下一步不同」的码才用得到它）。
 *
 * `'local-upload'` = 员工从**本机选一份技能包上传**那条通路（技能包就在员工手里那份文件）；
 * 其余通路（中心下载安装、插件、配方、账号……）一律走表的**默认**那句 `action`，不必传流。
 */
export type EnterpriseErrorFlow = 'local-upload' | 'online-install'

/**
 * 全部流值（供「逐流逐句都成立」那类机械判据遍历；新增一个流值必须同时进这里）。
 *
 * `'online-install'` = 员工从**在线搜索结果**里点安装那条通路（技能包在第三方仓库里，本机替他去取）。
 */
export const ENTERPRISE_ERROR_FLOWS: readonly EnterpriseErrorFlow[] = ['local-upload', 'online-install']

/**
 * **唯一一份**码 → 人话表。
 *
 * 取值口径（三条，逐条都能被 `tests/error-messages.spec.ts` 机械复核）：
 *  ① `message` 说「发生了什么」、`action` 说「我现在能做什么」，两句都不含裸码；
 *  ② `retryable` 只对**同一输入再试可能不同**的失败为 true（网络/上游/在途冲突），
 *     终态（包损坏、哈希不符、超限、可见范围、权限）为 false —— 不给必然失败的重试画饼；
 *  ③ 一个码只有一句话：技能 tab、企业技能页签、详情子页面、设置页共用这一份，不存在第二份措辞。
 *
 * ★ **本刀（本地导入）给第③条补一个精确边界**：第③条要挡的是**同一条流内**各写一套（同一个失败在四个
 *   入口说四句话）。而有的码**真的跨了两条流**——最典型的是 `ENT_SKILL_ARCHIVE_INVALID`：中心安装流里
 *   技能包是应用替员工下载的（损坏 ⇒ 重新下载 / 找管理员重发），本地上传流里技能包**就是员工手里那份文件**
 *   （损坏 ⇒ 换一份文件，世上没有「重新下载」这一步）。此时把两条流压成一句话，必然有一边是错的下一步。
 *   ⇒ 表里给这种码多一枚**流专属 action**（`actions`），并按流查询；**默认 `action` 一个字都不改**，
 *   故中心安装流（以及全部既有入口）的输出与本刀之前**逐字相同**。措辞仍然只在这一个文件里
 *   —— 不在调用方各写一份（那正是第③条禁止的第二份码表）。
 *
 * 表里没有的码走 `ENTERPRISE_ERROR_FALLBACK_*`（同样有人话与下一步），界面因此永远拿得到可读文案。
 */
interface EnterpriseErrorEntry {
  readonly message: string
  readonly action: string
  readonly retryable: boolean
  /**
   * **流专属的下一步**（缺席 = 两条流共用上面那句 `action`）。
   *
   * 只给真跨流的码写；每多一条流都要**同时**补 `tests/error-messages.spec.ts` 里那条「逐流逐句都成立」的判据。
   */
  readonly actions?: Readonly<Partial<Record<EnterpriseErrorFlow, string>>> | undefined
}

const ENTERPRISE_ERROR_TABLE: Readonly<Record<string, EnterpriseErrorEntry>> = {
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

  // ── NUWAX 员工登录（口径 29/30：登录入口换成 NUWAX） ───────────────────────────
  // 六枚与宿主 `bundle/src/nuwax-auth.ts` 的 `NuwaxAuthErrorCode` 一一对应，也是 platform-client
  // 那张码→HTTP 状态表的五枚（第六枚 `ENT_NUWAX_NOT_CONFIGURED` 落在表尾 503）的界面侧措辞。
  // 逐句的「下一步」刻意各不相同：**再输一次同样的口令不是万能解**——
  // 凭据错是「检查后重试」，被平台拒绝（风控/账号锁定）是「确认账号状态或找管理员」，
  // 地址没配是「本机部署问题」，超时/连不上/回畸形才是「稍后重试」。
  ENT_NUWAX_NOT_CONFIGURED: { message: 'NUWAX 平台地址还没有配置。', action: '请联系企业管理员完成部署配置。', retryable: false },
  ENT_NUWAX_INVALID_CREDENTIALS: { message: 'NUWAX 账号或口令不正确。', action: '请检查账号与口令后重试。', retryable: true },
  ENT_NUWAX_REJECTED: { message: 'NUWAX 平台拒绝了这次登录。', action: '请确认账号状态，或联系企业管理员。', retryable: false },
  ENT_NUWAX_UNAVAILABLE: { message: '暂时连不上 NUWAX 平台。', action: '请检查网络后重试。', retryable: true },
  ENT_NUWAX_TIMEOUT: { message: 'NUWAX 平台响应超时。', action: '请稍后重试。', retryable: true },
  ENT_NUWAX_PROTOCOL: { message: 'NUWAX 平台返回了无法识别的结果。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  /**
   * ★esc 页三处「**部署侧没有该端点**」的稳定码（实测：平台回 `4040 No static resource …`，
   *   而同页的其它列表正常回 200 ⇒ 不是网络、不是登录、也不是我们路由的问题）。
   *   那不是"出错了"，是**这一版部署没有这个能力**——重试没有意义，故三枚都 `retryable: false`，
   *   下一步是「换版本 / 联系管理员」，而不是让用户对着一句 4040 反复点重试。
   *   ★三枚**分开**：缺的是连接器目录、这一类目录，还是推荐内容，是三件不同的事实、三句不同的话；
   *   由 `esc-api.ts` 的 `ESC_MISSING_ENDPOINT_CODES` 按**取数面（资源类型）**取对应那一枚。
   *   ★**口径 55（用户裁决）删掉的那一枚**：原先这里还有 `ENT_ESC_ENABLE_LIST_UNAVAILABLE`
   *   （「这台 NUWAX 服务还没有提供『我启用的』技能清单。」）—— 它只为技能页那枚「我启用的」维度
   *   存在；维度整枚删除之后，那枚码**永远取不到**（本仓不会再有任何请求打到
   *   `/api/published/skill/enable/list`）⇒ 留着它就是一张"看着还能用"的死条目。
   *   故它与 `ESC_MISSING_ENDPOINT_CODES.enabled` 一并删除（唯一码表里少一枚 = 少一句没有落点的话）。
   */
  ENT_ESC_CONNECTOR_UNAVAILABLE: { message: '这台 NUWAX 服务还没有提供连接器目录。', action: '请联系企业管理员确认部署版本；专家与技能不受影响。', retryable: false },
  ENT_ESC_DIRECTORY_UNAVAILABLE: { message: '这台 NUWAX 服务还没有提供这一类目录。', action: '请联系企业管理员确认部署版本。', retryable: false },
  ENT_ESC_RECOMMEND_UNAVAILABLE: { message: '这台 NUWAX 服务还没有提供推荐内容。', action: '请联系企业管理员确认部署版本；下面的目录不受影响。', retryable: false },
  /**
   * ★**口径 49**：技能页主按钮下拉里「查找技能 / 创建技能」**没把话填进新会话**。
   *
   * 两条通路都收在这一枚：草稿端口整个缺席（官方会话服务那四个结构面缺一环 ⇒ 这一项按不动）
   * 与这一次预填返回 `false` / 抛（工作区快照为空、官方 `shell(id)` 抛错 …）。
   * ★**为什么合一枚而不拆两枚**：从员工那一侧看，两件事的**下一步是同一件事**——
   *   "这句话没进输入框，你自己新建一个会话把这句贴进去"。拆开只会给同一个补救动作两个码。
   * ★**为什么 `retryable: false`**：预填失败的形态是"官方那条链路这一环不成立"
   *   （没有可落的工作区 / 该会话没有 binding），同样的调用再点一次还是同一结果——
   *   给必然失败的重试画饼正是本表第②条禁止的。补救是"改用复制粘贴"，故人话里直接给出来。
   */
  ENT_ESC_DRAFT_UNAVAILABLE: { message: '这句话没能填进新会话的输入框。', action: '请手动新建一个会话，把这句话粘贴进输入框再发送。', retryable: false },
  /**
   * ★**口径 51**：「我的专家」子页**要不到清单**——这台部署的只读白名单里根本没有这条接口。
   *
   * **事实**（有源码级反向锁盯着）：宿主那张只读闭集**恰好七条**
   * （`bundle/src/esc-route.ts` 的 `ENTERPRISE_ESC_READ_ENDPOINTS`：`agent/list`、`skill/list`、
   * `skill/enable/list`、`connector/providers`、`category/list`、`space/list`、
   * `system/display/recommend/list`），全部在 `esc-api.ts` 里逐条落地——**没有一条**是"我创建的专家"。
   *
   * ★**为什么 `retryable: false`**：与同族那四枚「这一版部署没有这个端点」逐条同判——
   *   对"端点不存在"重试**永远无效**，给必然失败的重试画饼正是本表第②条禁止的。
   *   下一步是"找管理员确认部署版本"，而不是让员工对着同一句话反复点。
   * ★**为什么不拿 `/api/published/agent/list` 冒充"我的"**：那条是**专家广场**列表
   *   （平台上全部已发布专家），把它画成"我创建的"就是拿别人的数据冒充自己的——
   *   这正是本仓"不许编造事实"那条纪律点名的禁区，故宁可如实说"没有这个接口"。
   */
  ENT_ESC_MY_EXPERTS_UNAVAILABLE: {
    message: '这台 NUWAX 服务还没有提供「我的专家」清单所需的只读接口。',
    action: '请联系企业管理员确认部署版本；返回后仍可浏览专家目录。',
    retryable: false,
  },

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
  ENT_SKILL_INSTALL_FAILED: {
    message: '技能没有安装成功。',
    action: '请重试；仍然失败请联系企业管理员。',
    retryable: true,
    // 在线安装流：这份技能不是企业目录里的东西，管理员帮不上 ⇒ 下一步是换一条搜索结果。
    actions: { 'online-install': '请重试；仍然失败请换一条搜索结果。' },
  },
  ENT_SKILL_SIZE_MISMATCH: { message: '技能包大小与中心记录不一致。', action: '请重新下载；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_SKILL_HASH_MISMATCH: { message: '技能包校验没有通过。', action: '请重新下载；仍然失败请联系企业管理员重新发布。', retryable: false },
  // ★ **跨流码**：中心安装流里这句「重新下载」是对的（包是应用替员工下的）；本地上传流里技能包
  //   就是员工手里那份文件，世上没有「重新下载」这一步 ⇒ 那一流走 `actions['local-upload']`（换一份）。
  ENT_SKILL_ARCHIVE_INVALID: {
    message: '技能包已损坏，无法打开。',
    action: '请重新下载；仍然失败请联系企业管理员重新发布。',
    retryable: false,
    actions: {
      'local-upload': '请重新选择一份技能包文件再试；仍然失败请联系技能发布方确认这份包是否完整。',
      // 在线安装流：包在第三方仓库里、由本机替他取；「重新下载」在这里也说不通（用户手里没有文件），
      // 而「联系企业管理员重新发布」更不对——那份技能不是企业发布的 ⇒ 下一步是换一条结果 / 换一个来源。
      'online-install': '请换一条搜索结果再试；仍然失败请换一个来源。',
    },
  },
  ENT_SKILL_PACKAGE_MISMATCH: { message: '技能包内容与中心记录不一致。', action: '请联系企业管理员重新发布这个技能。', retryable: false },
  ENT_SKILL_INVALID_PACKAGE: { message: '技能包内容不符合规范。', action: '请联系企业管理员重新发布这个技能。', retryable: false },
  // **本刀（本地导入）**：ZIP 容器没问题、是里面 `SKILL.md` 开头那段信息（frontmatter）没过闸门。
  // 它与上面那枚 `ENT_SKILL_UPLOAD_INVALID`（压根不是有效技能包）**不是一回事**：下一步也不同
  // ——前者要**改文件头**，后者要**换一份文件**，故两枚码各自留着、文案不许互相抄。
  ENT_SKILL_SKILLMD_INVALID: {
    message: '这个技能包里技能的说明写得不符合规范。',
    action: '请改好技能文件开头那段信息后重新导入；技能包来自他人时，请联系发布方修正。',
    retryable: false,
    // 在线安装流：文件在远端，用户改不了它 ⇒ 下一步是换一条结果（或让该技能的发布方修）。
    actions: { 'online-install': '请换一条搜索结果再试；仍然失败请联系该技能的发布方修正。' },
  },
  // ★ **两条流共用一个码**（中心安装装不下 / 本地上传撞名）：故这句必须两条流都成立。
  //   改前是「请先卸载同名技能，再重试安装。」—— 但**本机自装的那份今天没有任何界面能卸载**
  //   （bundle 侧本刀不提供自装卸载，官方技能面也没有删除能力）⇒ 那句话指着一个员工做不到的动作。
  //   现在给的是**两条流都走得通**的下一步：先试卸载（企业目录装来的那份在「⋯」里真能卸），走不通就找人清。
  ENT_SKILL_NAME_CONFLICT: { message: '本机已有同名技能。', action: '请先卸载同名技能再试；无法卸载时，请联系企业管理员协助清理本机的同名技能。', retryable: false },
  ENT_SKILL_STATE_INVALID: { message: '本机的技能安装记录已损坏。', action: '请刷新后重试；仍然失败请联系企业管理员。', retryable: false },
  ENT_SKILL_CONTENT_TOO_LARGE: { message: '这个文件太大，暂时无法预览。', action: '请选择其它文件；或联系企业管理员调整包内文件。', retryable: false },
  ENT_SKILL_CONTENT_INVALID: { message: '这个文件不是可预览的文本。', action: '请选择文本文件查看。', retryable: false },
  ENT_SKILL_TOO_LARGE: { message: '技能包超出企业允许的大小。', action: '请联系企业管理员重新发布。', retryable: false },
  ENT_SKILL_NOT_PUBLISHED: { message: '这个技能还没有发布。', action: '请联系企业管理员确认发布状态。', retryable: false },
  ENT_SKILL_VISIBILITY_DENIED: { message: '这个技能不在你的可见范围内。', action: '请联系企业管理员开通可见范围。', retryable: false },
  // **本刀（本地导入）**：员工自己选一个本机 `.dshskill` 上传安装那条通路的三枚码。
  // 超限是**终态**（同一份文件再传一次必然还是超限 ⇒ 不给「重试」画饼；界面给的是「重新选择文件」，
  // 那是换一份输入，不是原地重发），故 retryable=false；形状不对同理（换一份文件才有意义）。
  // 只有第三枚（Host 落盘/落点失败）是瞬时态，同一份文件再传一次可能就过了，故 retryable=true。
  // 三句都逐字含本地上传的下一步（选文件 / 换小一点），不出现裸码，也不出现中心安装那套「重新下载」。
  // ★**口径 60**：这一句里的上限**不再自带一个字面量**，而是引用 `skill-import.ts` 那枚唯一的
  //   `ENTERPRISE_SKILL_IMPORT_MAX_TEXT`（字节常量亦然）——于是"接受多大"这件事在全 `src` 里
  //   恰好一个数字真源（门禁：剥注释后全 src 的 `50 MiB` 只许出现一次，就是那枚常量的定义处）。
  //   旧形态靠一条 `toContain` 用例把两处字面量绑在一起；本刀把这条绑带换成**真依赖**，更强也更短。
  ENT_SKILL_UPLOAD_TOO_LARGE: { message: '这个技能包太大了，没有导入。', action: `请选择不超过 ${ENTERPRISE_SKILL_IMPORT_MAX_TEXT} 的技能包，再试一次。`, retryable: false },
  ENT_SKILL_UPLOAD_INVALID: { message: '这个文件不是有效的技能包。', action: '请选择 .dshskill 技能包文件后重试。', retryable: false },
  ENT_SKILL_UPLOAD_FAILED: { message: '技能包没有导入成功。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  // **本刀（系统搜索 → 纳入）**：纳入那条通路的三枚码。三句「下一步」刻意各不相同，因为下一步真的不同：
  //   · 找不到（404）——这条候选已经不是这次盘点发现的那一条了（被移走 / 改名 / 换成了符号链接）⇒ 重新搜一次；
  //     同一份 path 再发一次必然还是 404，故 retryable=false（那不是「再试一次」能解决的）。
  //   · 已登记（409）——本机没坏，是这份已经登记过了 ⇒ 回列表刷新就能看见它。
  //   · 完不成登记（500）——目录子树超深 / 条目超上限 / 内容超 20 MiB，本机自己算不出摘要；读盘写盘的
  //     瞬时失败也可能落在这里，故 retryable=true（重试有意义）。
  ENT_SKILL_DISCOVERY_UNKNOWN: { message: '这条技能目录已经不在这次搜索的结果里了。', action: '请返回后重新搜索一次。', retryable: false },
  ENT_SKILL_ALREADY_REGISTERED: { message: '这份技能已经登记过了。', action: '请返回列表刷新一次查看它。', retryable: false },
  ENT_SKILL_ADOPT_FAILED: { message: '本机没能完成这份技能的登记。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  // **本刀（通过 Agent 创建）**：两枚**本机动作**码（不是 Host 路由码）。它们的下一步**不是**同一件事，
  // 故分开两枚、各一句：前者是「新会话没开起来」⇒ 把这句指令复制走（界面那一枚按钮就是它）；
  // 后者是「剪贴板没写成」⇒ 检查权限后重试（界面那枚按钮同时就是重试）。两枚都**不带**预设/配方字样：
  // 它们只属于这一条通路，出现在技术信息里时不该指向别的功能。
  ENT_SKILL_CREATE_LAUNCH_FAILED: { message: '没能为你打开一个新的会话。', action: '请点「复制这句指令」，粘贴给助手即可。', retryable: true },
  ENT_SKILL_CREATE_COPY_FAILED: { message: '没能把这句指令复制到剪贴板。', action: '请检查剪贴板权限后重试。', retryable: false },
  /**
   * **本刀（S5b）**：技能卡那枚「去试试」**没能把指令填进新会话**。
   *
   * 出现时机与上面那枚「通过 Agent 创建」的启动失败**同形**（都是 `preset-launch.ts` 那条
   * "跳新会话 + `setDraft`"的链路这一环不成立：端口缺席 / 没有可落的工作区 / 官方那次打开被中止），
   * 但**下一步真的不同**，故不能借上面那枚：
   *   · 上面那枚的下一步是「点『复制这句指令』」——界面上真有那枚按钮（那句指令也显示在菜单里）；
   *   · 这一枚的那句指令是**按这枚技能现拼的、从不显示**，卡片上**没有**复制按钮 ⇒ 让它"点复制"
   *     是**说假话**（`ENT_PRESET_LAUNCH_FAILED` 那句指向「复制导入指令」、`ENT_ESC_DRAFT_UNAVAILABLE`
   *     那句要求"把这句话粘贴进去"，在这一格同样没有可执行的落点）。
   * ★**为什么 `retryable: false`**：失败面是"官方那条链路这一环不成立"（与
   *   `ENT_ESC_DRAFT_UNAVAILABLE` 逐条同判：同一条链路、同一份结构面，同样的调用再点一次面对的是
   *   同一形状）；故下一步给的是**一定能做**的那件事——自己新建一个会话，让它用这枚技能干活
   *   （不需要我们那句原文）。那不叫"重试"，故本码不画重试的饼。
   */
  ENT_SKILL_TRY_LAUNCH_FAILED: { message: '没能为这枚技能打开一个新的会话。', action: '请手动新建一个会话，让它用这枚技能帮你干活。', retryable: false },
  // **本刀（在线搜索 → 安装）**：三枚新码，**下一步各不相同**（这是它们分三枚的理由）：
  //   · 源不认（400）——这条结果没有可安装的来源（上游没给坐标 / 源不在白名单）⇒ 换一条结果；
  //   · 源取不到（502）——**这次**没取到（网络 / 上游挂了）⇒ 检查网络重试，或换一个来源；
  //   · 体量超限（413）——那个仓库超出可安装上限（终态）⇒ 换一条结果（同一份再取一次也一样大）。
  ENT_SKILL_SOURCE_UNKNOWN: { message: '这条搜索结果不提供可安装的来源。', action: '请换一条搜索结果再试。', retryable: false },
  ENT_SKILL_SOURCE_UNREACHABLE: { message: '暂时连不上这个技能来源。', action: '请检查网络后重试，或换一个来源。', retryable: true },
  ENT_SKILL_SOURCE_TOO_LARGE: { message: '这个技能的仓库超出可安装的大小。', action: '请换一条体积更小的搜索结果再试。', retryable: false },
  /**
   * ★**口径 62（本刀）**：本地三方 Agent 技能源的**扫描读不到**那一枚（宿主回 503）。
   *
   * ★它与同族那几枚 `ENT_ESC_*_UNAVAILABLE`（「这一版部署没有这个端点」）**刻意分成两枚**：
   *   那几枚说的是**部署事实**（重试永远无效，`retryable: false`），而这一枚说的是**这一次读失败**
   *   （根表读不动 / 扫描抛错）——`retryable: true`，下一步就是**重试**。把两件事混成一句会让
   *   "这台部署根本没有这个功能"与"刚才那一下没读到"在界面上长得一样，而它们要员工做的事完全不同
   *   （找管理员 vs 再点一次）。
   * ★下一步里的「重试」有**落点**：本维度失败态里就有那一枚真重发的按钮（不是"稍后再试"那种空话）。
   */
  ENT_SKILL_THIRD_PARTY_UNAVAILABLE: { message: '没有读到本机三方技能源的内容。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  /**
   * ★**本刀（Phase C D1：连接器广场）**：本机连接器广场那**一枚**稳定码
   *   （宿主 `bundle/src/connector-plaza.ts` 的 `ENT_CONNECTOR_PLAZA_UNAVAILABLE`）。
   *
   * ★**四种来由共用一句话**（与宿主那条"一个码一句话"逐条对齐）：空间列表读不到 / 空间列表读不懂 /
   *   每一个空间都读失败 / 路由 handler 里逃出来的其它异常——它们对员工是**同一件事**
   *   （这次没读到连接器清单），下一步也**同一条**（重试；仍然失败找管理员）。
   * ★`retryable: true` 且下一步里的「重试」有**落点**：广场失败态里就有那一枚**真的重发**的按钮
   *   （与 `ENT_SKILL_THIRD_PARTY_UNAVAILABLE` 同判）。
   * ★它与同族那几枚 `ENT_ESC_*_UNAVAILABLE`（"这一版部署没有这个端点"、`retryable: false`）
   *   **刻意分成两枚**：那几枚说的是**部署事实**，这一枚说的是**这一次读失败**——两件事要员工做的事不同。
   */
  ENT_CONNECTOR_PLAZA_UNAVAILABLE: { message: '这次没有读到连接器清单。', action: '请重试；仍然失败请联系企业管理员。', retryable: true },
  /**
   * ★**口径 64（本刀）**：**系统广场「已发布技能」的复制授权被拒**那一枚
   *   （宿主按**那条记录**的详情判：`allowCopy !== 1` 或 `paymentRequired === true`）。
   *
   * ★**为什么必须自己判、以及为什么重试无效**：真机实测平台**有 `allowCopy` 字段、没有执行**
   *   （138 条里 68 条 `allowCopy=0`，而 `allowCopy=0` 的 `export/700` **照样回 200 + 128,784B ZIP**）
   *   ⇒ 不自己判就等于**替员工绕过发布者的授权**。授权由发布者在平台上设定、付款也不是"再点一次"
   *   能改变的 ⇒ `retryable: false`（与「这一版部署没有这个端点」那几枚同一条判据：**不给必然失败的
   *   重试画饼**——界面那一侧据此**不画**重试按钮）。
   * ★**一码一句话**：`allowCopy !== 1` 与 `paymentRequired === true` 的**下一步完全相同**
   *   （找发布者 / 找管理员），故共用这一枚码，不为同一种结果造第二枚。
   */
  ENT_SKILL_PUBLISHED_COPY_FORBIDDEN: { message: '这枚技能的发布者不允许复制到本机。', action: '请联系发布者或企业管理员；这一条重试无效。', retryable: false },

  // ── 插件 ─────────────────────────────────────────────────────────────────────
  ENT_PLUGIN_DOWNLOAD_FAILED: { message: '插件包没有下载完成。', action: '请检查网络后重试。', retryable: true },
  ENT_PLUGIN_SIZE_MISMATCH: { message: '插件包大小与中心记录不一致。', action: '请重试；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_PLUGIN_HASH_MISMATCH: { message: '插件包校验没有通过。', action: '请重试；仍然失败请联系企业管理员重新发布。', retryable: false },
  ENT_PLUGIN_ARTIFACT_INVALID: { message: '插件包已损坏，无法使用。', action: '请联系企业管理员重新发布这个插件。', retryable: false },
  ENT_PLUGIN_ARCHIVE_TOO_LARGE: { message: '插件包超出企业允许的大小。', action: '请联系企业管理员重新发布。', retryable: false },
  ENT_PLUGIN_SIGNATURE_INVALID: { message: '企业插件的信任配置不可用。', action: '请联系企业管理员。', retryable: false },
  ENT_PLUGIN_INCOMPATIBLE: { message: '这个插件与当前客户端不兼容。', action: '请联系企业管理员更换版本。', retryable: false },
  ENT_PLUGIN_BUSY: { message: '另一项插件操作正在进行。', action: '请等它结束后重试。', retryable: true },
  // 员工自己按下的取消**不是**失败：本机什么都没变（Host 已把记录回到安装前那一条），所以下一步就是再试一次。
  // 与配方族那枚 `ENT_PRESET_INSTALL_CANCELLED` 同判（瞬时态、可重试）。
  ENT_PLUGIN_INSTALL_CANCELLED: { message: '这次安装被取消了。', action: '请重试。', retryable: true },
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
  // 读本机文件失败（浏览器读不出选中的那个文件）：与"上传到资料库失败"分开说，因为下一步不同。
  ENT_LIBRARY_FILE_READ_FAILED: { message: '选中的文件读不出来。', action: '请确认文件还在、内容没有损坏，然后重新选一次。', retryable: true },
  // 上传/改名撞了同名、或这份资料的版本已被占用：请求合法、只是当前状态不允许，改个名字或刷新即可。
  ENT_LIBRARY_CONFLICT: { message: '资料库里有同名的内容了。', action: '请换一个名字，或先删掉/改名原来的那份。', retryable: false },
  // 这份资料被停用了：模型不能读它，员工也打不开正文（原件仍可下载）。
  ENT_LIBRARY_DISABLED: { message: '这份资料已停用。', action: '请在企业设置里重新启用后再打开。', retryable: false },
  // 单份太大（正文超过上限）：员工能据此换一份更小的，故 413 的下一步是"换小一点"。
  ENT_LIBRARY_TOO_LARGE: { message: '这份资料太大了，暂时放不进资料库。', action: '请拆分后再上传，或改存更小的文件。', retryable: false },
  // 本机出错了（不是请求的问题）：如实说"我们这边出错了"并给重试，不把内部细节砸给员工。
  ENT_LIBRARY_INTERNAL: { message: '资料库这边出错了。', action: '请稍后重试；仍然失败请联系企业管理员。', retryable: true },

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
/**
 * ★**口径 49**：技能页主按钮下拉里「查找技能 / 创建技能」预填失败时的稳定码。
 *
 * 单独出一枚常量（而不是让调用方各写一遍字面量）：它就是"一个码只有一句话"那条纪律的落点，
 * 码值写在这里、人话与下一步写在上面的表里，**两处不可能漂**（门禁逐字锁住两者同值 + 入表）。
 */
export const ENTERPRISE_ESC_DRAFT_FAILED_CODE = 'ENT_ESC_DRAFT_UNAVAILABLE'

/**
 * ★**口径 51**：「我的专家」子页内容区那枚稳定码。
 *
 * 与 `ENTERPRISE_ESC_DRAFT_FAILED_CODE` 同一条纪律：**码值只在这一处**，人话与下一步在上面的表里，
 * 界面侧只引用这枚常量（门禁逐字锁住"常量值 === 表里的键"，两处不可能漂）。
 */
export const ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE = 'ENT_ESC_MY_EXPERTS_UNAVAILABLE'

/**
 * ★**口径 64（本刀）**：系统广场「已发布技能」的复制授权被拒时那枚稳定码。
 *
 * 与上面两枚同一条纪律：**码值只在这一处**，人话与下一步在表里，界面侧只引用这枚常量
 * （门禁逐字锁住"常量值 === 表里的键"）。界面用它做**另一件事**：把"发布者不允许复制"这句
 * **行上可见的原因**写在卡片上（`esc-system.tsx` 的 `ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON`）
 * —— 于是这句话在全仓只有一处真源（表里那一格），预判与真失败说的是同一句。
 */
export const ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE = 'ENT_SKILL_PUBLISHED_COPY_FORBIDDEN'

/**
 * ★**本刀（S5b）**：技能卡那枚「去试试」的**唯一稳定码**（新建会话 + 写草稿那条链路这一环没走成）。
 *
 * 与上面三枚同一条纪律：**码值只在这一处**，人话与下一步在表里，界面侧只引用这枚常量
 * （门禁逐字锁住"常量值 === 表里的键"）。
 *
 * ★**为什么码值不叫 `ENT_ESC_*`**（常量名带 `ESC`，码值带 `SKILL`，这不是笔误）：
 *   语义上它属于**技能动作**那一族（与 `ENT_SKILL_CREATE_LAUNCH_FAILED` 同族：都是本机那条
 *   "跳新会话 + 写输入框"的动作没走成），而不属于 `ENT_ESC_*` 那五枚——那五枚说的是
 *   "这一版部署缺端点 / 本页草稿没填成"这一类**页面级**事实。族按语义分，不按它出现在哪个页面分。
 */
export const ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE = 'ENT_SKILL_TRY_LAUNCH_FAILED'

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

/**
 * 下一步动作的**按流**取值：`flow` 命中该码的流专属表述时用它，否则用默认那句。
 *
 * ★ 唯一的调用方是「本地上传」那一条失败反馈（`EnterpriseErrorNotice` 的 `flow` prop）；
 *   不传 `flow` 的每一处都与 `enterpriseErrorAction` **逐字等价**（既有入口一个字节都不变）。
 *
 * @param code - 任意 `ENT_*` 稳定错误码。
 * @param flow - 员工侧流的标识（缺席 = 默认流那句）。
 * @returns 该流下可执行的下一步；未映射/畸形码仍是兜底那句。
 */
export function enterpriseErrorActionIn(
  code: string | undefined | null,
  flow?: EnterpriseErrorFlow | undefined,
): string {
  const normalized = typeof code === 'string' ? code.trim() : ''
  const hit = ERROR_CODE_SHAPE.test(normalized) ? ENTERPRISE_ERROR_TABLE[normalized] : undefined
  if (hit === undefined) return ENTERPRISE_ERROR_FALLBACK_ACTION
  return (flow === undefined ? undefined : hit.actions?.[flow]) ?? hit.action
}

/** 这个失败是否值得原地再试一次。 */
export function enterpriseErrorRetryable(code: string | undefined | null): boolean {
  return enterpriseErrorPresentation(code).retryable
}
