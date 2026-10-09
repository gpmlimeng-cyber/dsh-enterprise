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
 *   ★**口径 49**：写入口族多两型——`EnterpriseEscDraftPort`（技能页下拉那两项"预填进新会话"的实现面）
 *    与 `EnterpriseEscAddSkillLock`（下拉里哪一项按不动、为什么）。两者都**不进** `EnterpriseEscApi`。
 *   ★**口径 55（本刀）**：`ResourceSourceEnum` 由四枚收窄成 `'system' | 'team' | 'connected'` ——
 *     技能页那枚 `'enabled'` 维度整枚删除之后**没有任何取值口**会构造它（联合里留着就是死路）。
 *     另：`EnterpriseEscSkillPort` 仍是**写入口**（`uploadSkill`/`selfInstalledSkills`/`uninstallSkill`），
 *     口径 54 的**只读**两格（`discoveredSkills`/`selfInstalledSkills`）走 `EnterpriseEscApi` 那一面。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** ★口径 46/47：本机技能写入口那两条记录形状（**类型**导入，故本文件仍无运行时依赖）。 */
import type { EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'

/** 资源类型：专家&专家团 / 技能 / 连接器。 */
export type ResourceTypeEnum = 'expert' | 'skill' | 'connector'

/**
 * 数据源：系统广场 / 团队空间 / 已连接的（连接器页专属）。
 *
 * ★**口径 55（用户裁决）**：技能页那枚 `'enabled'` 维度**整枚删除**（用户原话「和已安装重复」），
 *   故这一格也一并退场 —— 联合类型里留着一个**没有任何取值口**会构造的字面量，就是给下一个读者
 *   留一条"看着还能用"的死路。今天产出数据源的地方只有一处（`esc-toolbar.tsx` 的
 *   `sourceOptionsOf`：system / team / connected），而适配器表的键集被
 *   `Partial<Record<ResourceSourceEnum, …>>` 收在这条联合之内 ⇒ 联合收窄之后，"表里多一支
 *   没人选的适配器"在**类型层**就写不出来了（口径 55 顺手清掉的那支连接器 `enabled` 即此）。
 */
export type ResourceSourceEnum = 'system' | 'team' | 'connected'

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

/**
 * ★**口径 49**：技能页下拉里「查找技能 / 创建技能」用的**草稿端口**（把一句话预填进新会话输入框）。
 *
 * ★ 与 `EnterpriseEscSkillPort` **分开成两枚端口**，不是懒：两件事的**失败面对应的下一步不同**——
 *   本机技能写入口走同源本机路由（`/skills/*`），草稿端口走的是**官方会话服务**（`uiWorkspace` +
 *   `conversation`），缺的环不同、能做的补救也不同；混成一枚之后"哪半边缺席"就说不清了。
 * ★ 它也**不进** `EnterpriseEscApi`：那一面是**结构性只读**的（宿主侧那张闭集恰好六条读端点），
 *   而这里要做的是"打开一个会话 + 写它的输入框"——是**动作**，不是取数。
 * ★ **复用而不新造**：形状上与 `preset-launch.ts` 的 `EnterprisePresetLaunchPort` 同一条口径
 *   （`true` = 已打开空白/新会话并确实把文本交给了官方写入口，**不发送**），实现也**就是它**——
 *   `esc-entry.tsx` 的接线把同一个 `createEnterprisePresetLauncher(...)` 包一层按 kind 取文案。
 *   于是"跳新会话 + setDraft"这条机制在本仓仍然**只有一处实现**（`preset-launch.ts`），
 *   本页不会长出第二套开会话/写草稿的代码。
 */
export interface EnterpriseEscDraftPort {
  /**
   * 预填一句话进新会话输入框（**不发送**）。
   *
   * `true` = 已经打开（复用空白或新建的）会话、并确实调到了官方那枚写入口；
   * `false` / reject = 这一级没走成 ⇒ 界面必须**说出来**（人话 + 下一步 + `ENT_ESC_DRAFT_UNAVAILABLE`），
   * **绝不静默失败**、也绝不假装成功。
   */
  readonly launch: (instruction: string) => Promise<boolean>
}

/** 下拉里那两项「走会话」的菜单项（口径 49）。 */
export type EnterpriseEscDraftKind = 'find' | 'create'

/**
 * ★**口径 49（降级）**：下拉里**这一项按不动**的可见原因（"禁用即须有说明"的唯一判据来源）。
 *
 * 三件事实分开，因为补救动作不同：
 *   · `'upload'`  = 本机技能写入口缺席（本地导入那台状态机没接上）；
 *   · `'find'`    = 草稿端口缺席（官方会话服务那四个结构面缺一环）；
 *   · `'create'`  = 同上，另一项（分开是为了让界面能说清**是这一项**按不动，而不是两项都灰）。
 */
export type EnterpriseEscAddSkillLock = EnterpriseEscDraftKind | 'upload'
