/**
 * [INPUT]: 无运行时依赖（纯类型 + 一个纯函数）
 * [OUTPUT]: 对外提供「专家·技能·连接器」页面的两族类型——① **归一化后的展示类型**（`ResourceTypeEnum`/`ResourceSourceEnum`/`ResourceItem`/`ResourceStat`/`ResourceCategoryInfo`/`CategoryMenuItem`）与 `mapPublishedStats`；② **平台原始响应的字段子集**（`EscPlatformEnvelope`/`EscPage`/`EscPublishedItem`/`EscConnectorProvider`/`EscCategoryNode`/`EscSpace`/`EscCreator`/`EscStatistics`）
 * [POS]: esc 页面（口径 31）的类型真源，逐字移植自 NUWAX `src/pages/ExpertSkillConnector/types.ts`。
 *   ★两处**如实收窄**（不是漏抄）：① 平台原始类型只声明**本刀真正消费**的字段——原文件从 `@/types/interfaces/*`
 *   引了整族类型（agent/library/square/systemManage/workspace），DSH 侧没有那套类型，逐个内联一份完整副本
 *   只会带来"抄错一个字段就编译不过"的假精度；这里按 **消费点** 声明，字段名与平台一致。② 包一层 `Esc` 前缀，
 *   因为本包已有自己的 `Page`/`RequestResponse` 语境，撞名会让读者以为两者同源。
 *   ★`mapPublishedStats` 三格（人/会话/收藏）与原文件同序同义，但**如实收了一处**（口径 42）：
 *    平台没回的字段**不入列**（原文件写 `?? 0`，把"没回"与"回了 0"压成同一个数，见函数上方那段）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** ★口径 46/47：本机技能写入口那两条记录形状（**类型**导入，故本文件仍无运行时依赖）。 */
import type { EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'

/** 资源类型：专家&专家团 / 技能 / 连接器。 */
export type ResourceTypeEnum = 'expert' | 'skill' | 'connector'

/**
 * 数据源：系统广场 / 团队空间 / 已连接的（连接器页专属）/
 * 我启用的（技能页=当前用户启用的技能；连接器页=当前用户启用开关打开的连接器）。
 */
export type ResourceSourceEnum = 'system' | 'team' | 'connected' | 'enabled'

/** 卡片统计项图标类型。 */
export type ResourceStatType = 'user' | 'link' | 'star'

/** 卡片统计项。 */
export interface ResourceStat {
  readonly type: ResourceStatType
  readonly value: number | string
}

/* ══════════════ 「精选技能」那一行（官方推荐）══════════════ */

/** 推荐目标类型（逐字抄 NUWAX `types/interfaces/displayRecommend.ts:13-20` 的 `DisplayRecommendTargetTypeEnum`）。 */
export type EscRecommendTargetTypeEnum = 'Agent' | 'PageApp' | 'UserApp' | 'Skill' | 'Plugin' | 'Workflow'

/** 推荐类型（逐字抄 `DisplayRecTypeEnum`：Home / Official / ChatBoxNav）。 */
export type EscRecommendType = 'Home' | 'Official' | 'ChatBoxNav'

/**
 * 推荐列表里的一条记录 —— 字段子集，逐字对齐
 * NUWAX `types/interfaces/displayRecommend.ts:28-43` 的 `DisplayRecommendInfo`。
 *
 * ★**只声明本页真消费的字段**（与本文件对平台原始类型的既有收窄口径一致）：那一行只画 `label` 与 `icon`，
 * 故 `placeholder`/`category`/`prompts`/`sort`/`modified`/`created` **一律不声明**——
 * 声明了却不用，就是给未来埋一个"看起来能用、其实没人验过"的字段。
 * `targetId` 保留是因为它标着"这条推荐指向哪个技能"，将来要回查详情时它是唯一的凭据。
 */
export interface EscRecommendRecord {
  readonly id: number
  readonly targetType: EscRecommendTargetTypeEnum | string
  readonly targetId: number
  readonly recType: EscRecommendType | string
  readonly label: string
  readonly icon?: string | undefined
}

/** 分页信封（服务端 `{records,total,pageNo,pageSize}`；`total` 等四格都可能缺席，故全部可选）。 */
export interface EscRecommendPage {
  readonly records: readonly EscRecommendRecord[]
  readonly total?: number | undefined
  readonly pageNo?: number | undefined
  readonly pageSize?: number | undefined
}

/** 归一化后的资源卡片数据（纯展示）——字段语义逐条照抄原文件注释里的口径。 */
export interface ResourceItem {
  /** 唯一标识（资源类型 + 原始 ID，避免跨类型撞 key）。 */
  readonly id: string
  /** 专家（团）对应的智能体 ID（召唤跳转用）；技能/连接器不填。 */
  readonly agentId?: number | undefined
  /** 技能 ID（选择透传跳转用）；专家/连接器不填。 */
  readonly skillId?: number | undefined
  /** 名称。 */
  readonly name: string
  /** 描述。 */
  readonly description?: string | undefined
  /** 图标（URL，为空时回退默认图）。 */
  readonly icon?: string | undefined
  /** 分类（团队空间接口的客户端筛选用；连接器卡片标题下方展示）。 */
  readonly category?: string | undefined
  /** 发布者信息（系统广场已发布数据携带，卡片标题下方展示头像与昵称）。 */
  readonly publishUser?: EscCreator | undefined
  /** 标签。 */
  readonly tags?: readonly string[] | undefined
  /** 连接器服务标识（断开连接按 service 匹配用户连接 id）。 */
  readonly service?: string | undefined
  /** 连接状态（连接器特有：卡片标题下方展示已连接/未连接）。 */
  readonly connected?: boolean | undefined
  /** 连接器连接 id（切换连接启用状态接口以连接 id 寻址；已连接时有值）。 */
  readonly connectionId?: number | undefined
  /** 所属空间 ID（连接器特有：团队空间维度列表响应每条自带）。 */
  readonly spaceId?: number | undefined
  /** 连接启用状态（连接器卡片右上角开关的选中态）。 */
  readonly connectionEnabled?: boolean | undefined
  /** 技能启用状态（技能卡片右上角启用开关的选中态）。 */
  readonly skillEnabled?: boolean | undefined
  /** 当前用户是否已收藏（专家卡片收藏图标选中态）。 */
  readonly collected?: boolean | undefined
  /** 是否需要付费（专家/技能卡片的付费角标）。 */
  readonly paymentRequired?: boolean | undefined
  /** 是否已订阅。 */
  readonly subscribed?: boolean | undefined
  /** 认证方式（连接器特有；`no_auth` 免鉴权）。 */
  readonly authType?: string | undefined
  /** 底部统计项。 */
  readonly stats?: readonly ResourceStat[] | undefined
}

/** 二级分类 tab。 */
export interface ResourceCategoryInfo {
  /** 分类标识，空串表示「全部」。 */
  readonly key: string
  /** 分类名称。 */
  readonly label: string
}

/** 左侧分类菜单项。 */
export interface CategoryMenuItem {
  /** 菜单 code（与资源类型对应）。 */
  readonly code: ResourceTypeEnum
  /** 菜单名称。 */
  readonly label: string
  /** 跳转路径（DSH 侧不再跳路由，保留字段以逐字对应原结构）。 */
  readonly path: string
  /** 图标标识（DSH 侧改走 lucide，保留字段以逐字对应原结构）。 */
  readonly icon: string
}

// ————————————————— 平台原始响应（只声明本刀消费的字段） —————————————————

/** 发布者信息（`/api/published/*` 响应的 `publishUser`）。 */
export interface EscCreator {
  readonly userId?: number | undefined
  readonly userName?: string | undefined
  readonly nickName?: string | undefined
  readonly avatar?: string | undefined
}

/** 统计信息（`/api/published/*` 响应的 `statistics`）。 */
export interface EscStatistics {
  readonly userCount?: number | undefined
  readonly convCount?: number | undefined
  readonly collectCount?: number | undefined
}

/** 已发布条目（`POST /api/published/{agent,skill}/list` 与 `skill/enable/list` 的一条）。 */
export interface EscPublishedItem {
  readonly id: number
  readonly targetId: number
  readonly name: string
  readonly description?: string | undefined
  readonly icon?: string | undefined
  readonly category?: string | undefined
  readonly publishUser?: EscCreator | undefined
  readonly statistics?: EscStatistics | undefined
  readonly collect?: boolean | undefined
  readonly paymentRequired?: boolean | undefined
  readonly subscribed?: boolean | undefined
  /** 技能维度的启用位（平台在部分口径下不回，故可选）。 */
  readonly enabled?: boolean | undefined
}

/** 连接器提供方（`GET /api/connector/providers` 的一条）。 */
export interface EscConnectorProvider {
  readonly id: number
  /** 服务标识（平台契约里是**必填**：如图中 `aliyun_oss`）——卡片名称的兜底就取自它。 */
  readonly service: string
  /** 显示名（平台契约里同样是必填）——卡片标题优先用它。 */
  readonly displayName: string
  readonly description?: string | undefined
  readonly icon?: string | undefined
  readonly category?: string | undefined
  readonly tags?: readonly string[] | undefined
  readonly authType?: string | undefined
  readonly spaceId?: number | undefined
  readonly connected?: boolean | undefined
  readonly connectionId?: number | undefined
  readonly connectionEnabled?: boolean | undefined
}

/** 广场分类节点（`GET /api/published/category/list`，树形）。 */
export interface EscCategoryNode {
  readonly key: string
  readonly label?: string | undefined
  readonly type?: string | undefined
  readonly children?: readonly EscCategoryNode[] | undefined
}

/** 空间（`GET /api/space/list` 的一条）。 */
export interface EscSpace {
  readonly id: number
  readonly name: string
}

/** 分页壳（`Page<T>`）：`POST /api/published/*` 用 `current`/`pages`，连接器用 `pageNum`。 */
export interface EscPage<T> {
  readonly records?: readonly T[] | undefined
  readonly current?: number | undefined
  readonly pages?: number | undefined
  readonly total?: number | undefined
  readonly pageNum?: number | undefined
}

/** 平台统一响应壳（`code === '0000'` 为成功，见 `ESC_SUCCESS_CODE`）。 */
export interface EscPlatformEnvelope<T> {
  readonly code: string
  readonly message?: string | undefined
  readonly data: T
  readonly success?: boolean | undefined
}

/**
 * 广场已发布条目的统计信息映射为卡片统计项（人/会话/收藏，与原文件同序）。
 *
 * ★**口径 42（用户裁决「专家卡片调整成和技能卡片布局一致…底部标签」）**：只映射**平台真回了数**的那几格。
 *   原写法三格都写 `?? 0` —— 它把"平台没回这个人数字段"与"平台回了一个 0"压成了同一个 0，
 *   可这两件事在界面上该说完全不同的话（前者是缺口、该画短横；后者是"确实是 0"）。
 *   卡片层拿不到这个区分，就只能把某一格**钉死**成短横：口径 40 那一版的技能标签行正是如此
 *   （安装/使用两格写死 `-`）——代价是**专家卡那两格的真数**从此没法复用同一行。
 *   ⇒ 现在 `null` / `undefined` / 非数字一律**不入列**，卡片层按"这一格在不在"决定画真数还是短横。
 *   真机事实（本轮复测）：平台对**技能**不回 `userCount`/`convCount`（7 条全是 `null`），
 *   对**专家**回真数 —— 于是同一行在两种卡上分别画成 `★1 👤- 💬-` 与 `★0 👤2 💬12`。
 */
export const mapPublishedStats = (
  statistics?: EscStatistics | undefined,
): ResourceStat[] => {
  if (!statistics) return []
  const cellOf = (type: ResourceStatType, value: number | null | undefined): readonly ResourceStat[] =>
    typeof value === 'number' ? [{ type, value }] : []
  return [
    ...cellOf('user', statistics.userCount),
    ...cellOf('link', statistics.convCount),
    ...cellOf('star', statistics.collectCount),
  ]
}

/**
 * ★口径 46/47：esc 页需要的**本机技能写入口**（只读那六条平台取数之外的那些）。
 *
 * ★ 为什么不塞进 `EnterpriseEscApi`：那一面是**结构性只读**的（宿主侧那张闭集恰好六条读端点，
 *   浏览器连平台 URL 都拼不出来）。把写动作混进去，等于让"esc 只读"这条不变式名存实亡。
 *   写入口走**独立端口**，与 `libraryGate` / `presetLaunch` / 商城那枚 `skillImport` 同一条注入范式。
 * ★ 三条都是**同源本机路由**（`/enterprise/api/v1/local/skills/*`），不碰平台、不碰 NUWAX 会话：
 *   · `uploadSkill`：本地导入（multipart，字段名固定 `artifact`）；
 *   · `selfInstalledSkills`：本机自装清单（**用户自定义**那一组的唯一来源）；
 *   · `uninstallSkill`：卸载一枚**企业**已装技能包（`packageId` 是中心雪花 id）。
 * ★ 本机自装包**没有**中心雪花 id，也就**没有**卸载路由（见 `skill-upload.ts` 的落盘面）——
 *   故「用户自定义」那一组的开关只能是**置灰 + 写明原因**，绝不画一枚拨了没反应的控件。
 */
export interface EnterpriseEscSkillPort {
  readonly uploadSkill: (file: File, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>
  readonly selfInstalledSkills: (signal: AbortSignal) => Promise<readonly EnterpriseSelfInstalledSkill[]>
  readonly uninstallSkill: (packageId: string, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>
}
