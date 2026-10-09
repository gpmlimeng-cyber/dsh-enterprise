/**
 * [INPUT]: 无运行时依赖（纯类型 + 一个纯函数）
 * [OUTPUT]: 对外提供「专家·技能·连接器」页面的两族类型——① **归一化后的展示类型**（`ResourceTypeEnum`/`ResourceSourceEnum`/`ResourceItem`/`ResourceStat`/`ResourceCategoryInfo`/`CategoryMenuItem`）与 `mapPublishedStats`；② **平台原始响应的字段子集**（`EscPlatformEnvelope`/`EscPage`/`EscPublishedItem`/`EscConnectorProvider`/`EscCategoryNode`/`EscSpace`/`EscCreator`/`EscStatistics`）；**本刀（Phase C D1）**另加第三族：三枚端口类型（`EnterpriseEscSkillPort` / `EnterpriseEscDraftPort` / **`EnterpriseEscConnectorPort`**）
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
 *   ★**口径 62**：`ResourceSourceEnum` 再加 `'third-party'`（技能页第三枚维度「本地三方」）
 *     —— 它**没有**平台取数适配器（那一维度的内容走 `esc-third-party.ts` 那条独立通路），
 *     故"这一维度不发平台请求"这件事在**类型层**就成立（适配器表里没有它那一支）。
 *   ★**口径 53（本刀）**：`ResourceSourceEnum` 再加 `'catalog'`（技能页**第四枚**维度「企业技能」）
 *     —— 数据源是**企业中心注册的技能包**（`createEnterpriseSkillListSource`，与「企业设置 → 技能」
 *     同一个取数源），同样**没有**平台取数适配器；`ResourceItem` 多两格（`packageId` / `meta`）
 *     供这一维度的卡片投影与**精确命中**已装判定；`EnterpriseEscSkillPort` 多一枚 `installSkill`
 *     （**复用** `local-api.ts` 那条 `/skills/install`，见那一格的长注释）。
 *   ★**口径 64（本刀）**：系统广场那批 NUWAX 已发布技能的**安装坐标与授权预判**就地扩进既有投影——
 *     `ResourceItem` 多两格（`targetId`：**只在安全整数时在场**；`allowCopy`：原值，只有数字 `1`
 *     才算允许复制）、`EscPublishedItem` 多一格 `allowCopy`（原始类型仍是数字：归一化是投影层的判据）、
 *     `EnterpriseEscSkillPort` 多一枚 `installPublishedSkill(targetId, signal)`（**与 `installSkill` 并列**，
 *     两条路的坐标/制品/响应三件都不同，见那一格的长注释——混成一格就是让两套坐标系在同一个字段上打架）。
 *     这两格**不新造取数器**：`esc-list.ts` 的 `mapPublishedItem` 就是它们的唯一取值口。
 *   ★**本刀（S5a：技能卡「更多」里的两个本机管理动作）**：`EnterpriseEscSkillPort` 再多**两格可选**
 *     写入口——`uninstallSelfInstalledSkill(name, signal)` 与 `revealSelfInstalledSkill(name, signal)`
 *     （`POST …/skills/self-installed/{uninstall,reveal}`，正文关闭键集恰好 `{name}`；`name` 是技能在
 *     **本机的目录名** kebab，不是 `packageId`/`skillId`/`targetId`）。两条**刻意可选**：判据仍是
 *     「端口在不在场」（缺席 ⇒ 「更多」里那两行**不画**——官方 `MenuItem` 没有 `title` 位，
 *     一枚禁用的菜单行说不出为什么按不动，见 `esc-more-menu.tsx` 的文件头）。
 *   ★**本刀（S5b：技能卡那枚「去试试」真的能用）**：`EnterpriseEscSkillPort` 再多**一格可选**写入口
 *     ——`fillSkillTryDraft(draft)`：把一句拼好的指令交给官方那条「新建会话 + 写入输入框（**不发送**）」
 *     的链路。它**不是**新机制：`client.tsx` 把它接在**同一个** `createEnterprisePresetLauncher(...)`
 *     上（与 `EnterpriseEscDraftPort.launch` 同一枚构造器、同一份四个结构面），故本仓"开会话 + 写草稿"
 *     仍然**只有一处实现**（`preset-launch.ts`）。**刻意可选**：判据仍是「端口在不在场」
 *     （缺席 ⇒ 那枚按钮禁用 + **行上可见**写明原因，见 `esc-skill-try.ts` 的计划投影）。
 *   ★**本刀（Phase C D1：连接器广场）**：新增**第三枚端口** `EnterpriseEscConnectorPort`
 *     （只有只读一格 `catalog`；写入口属 D2，本刀**刻意不造**——见那一格的说明）。
 *     它**不进** `EnterpriseEscApi`（那一面是平台镜像；连接器广场是本机同源脱敏投影）。
 *   ★**本刀（用户冻结规格 §3：已安装页「更多」四行）**：`EnterpriseEscSkillPort` 再多**一格可选**
 *     写入口 `editSkillFile(name, signal)`（用系统默认应用打开这枚技能的 `SKILL.md`）。
 *     ★**它今天**没有**任何接线**（`client.tsx` 不提供）：宿主那条同族路由还没落地 ⇒ 判据如实落在
 *     "端口在不在场"上（缺席 ⇒ 那一行**整行不画**，不画成禁用）。声明它是为了让那个 `false`
 *     是一次**查端口**的结果，而不是界面里写死的一个常量——两者的区别在于路由落地那天要不要改界面。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** ★口径 46/47：本机技能写入口那两条记录形状（**类型**导入，故本文件仍无运行时依赖）。 */
import type { EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill, EnterpriseSelfInstalledUninstall } from '../skill-api-decode.js'
/**
 * ★**本刀（Phase C D1：连接器广场）**：本机连接器广场的投影形状（**类型**导入，本文件仍无运行时依赖）。
 *
 * 只借它的**形状**：取数、拆信封与严格解码全在 `local-api.ts` / `local-api-decode.ts` 那一份唯一实现里。
 */
import type { EnterpriseConnectorCatalog } from '../local-api-decode.js'

/** 资源类型：专家&专家团 / 技能 / 连接器。 */
export type ResourceTypeEnum = 'expert' | 'skill' | 'connector'

/**
 * 数据源：系统广场 / 团队空间 / 本地三方 / 企业技能（技能页）/ 已连接的（连接器页专属）。
 *
 * ★**口径 55（用户裁决）**：技能页那枚 `'enabled'` 维度**整枚删除**（用户原话「和已安装重复」），
 *   故这一格也一并退场 —— 联合类型里留着一个**没有任何取值口**会构造的字面量，就是给下一个读者
 *   留一条"看着还能用"的死路。今天产出数据源的地方只有一处（`esc-toolbar.tsx` 的
 *   `sourceOptionsOf`：system / team / third-party / catalog / connected），而适配器表的键集被
 *   `Partial<Record<ResourceSourceEnum, …>>` 收在这条联合之内 ⇒ 联合收窄之后，"表里多一支
 *   没人选的适配器"在**类型层**就写不出来了（口径 55 顺手清掉的那支连接器 `enabled` 即此）。
 * ★**口径 62**：新增 `'third-party'`（「本地三方」= 本地三方 Agent 技能源，**只在技能页**）。
 *   它**没有**平台取数适配器（`esc-list.ts` 的适配器表里没有它那一支 ⇒ `Partial<Record<…>>` 收得下，
 *   而"取数"根本不该发生：这一维度的内容由 `esc-third-party.ts` 那条独立通路铺）。
 * ★**口径 53（本刀，新裁决）**：再新增 `'catalog'`（「企业技能」= 企业中心注册的技能包，**只在技能页**，
 *   排在**最后**）。它与 `'third-party'` **同一条形态、不同一条数据面**：
 *   · 都不进 `esc-list.ts` 的适配器表（本维度不读 NUWAX 平台，故"不发平台请求"在类型层成立）；
 *   · 内容各自走一条独立通路（`esc-third-party.ts` / `esc-catalog.ts`），由聚合层整块换掉卡片网格。
 *   ★它与 `'third-party'` 的**语义差别**（这决定了为什么是两枚维度而不是一枚）：
 *     `'third-party'` 扫的是**别的 Agent CLI 的技能库**（动作是把目录**复制**进来），
 *     `'catalog'` 读的是**企业中心自己发布、登记过的技能包**（动作是**下载 + SHA-256 校验 + 落盘**，
 *     即口径 53 用户裁决的那句「把后台注册的技能安装到 DSH 本地」）。
 *   ★它同样是**页专属**取值：`'catalog'` 只可能来自技能页（`sourceOptionsOf` 里有一道 `resourceType` 闸）。
 */
export type ResourceSourceEnum = 'system' | 'team' | 'third-party' | 'catalog' | 'connected'

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
  /**
   * ★**口径 53（本刀）**：企业技能包在**企业中心**的那枚雪花 id（`GET /skills/installed` 的
   *   `packageId` 与 `GET /skills` 的 `id` 是**同一个键**）。
   *
   * ★为什么单独立一格而不是塞进 `skillId`：`skillId` 是**数字**（NUWAX 平台的 `targetId`），
   *   而这里是一枚**字符串**雪花号——两套坐标系（真机实测：广场 `id=4194` vs 中心
   *   `packageId=2105915576743428098`）。混成一格就等于让"这两条技能是不是同一枚"永远说不清。
   * ★它**只由企业在维度**的卡片投影填（`esc-catalog.ts` 的 `enterpriseCatalogItem`），
   *   取值口唯一；已装判定与安装动作都认它，**不按名字猜**（口径 53 的硬判据）。
   */
  readonly packageId?: string | undefined
  /**
   * ★**口径 53（本刀）**：卡片元信息行（版本短号 / 大小 / 内含技能数）。
   *
   * 只有企业技能维度填（取值唯一：`skill-market.tsx` 的 `enterpriseSkillMeta`——与「企业设置 → 技能」
   * 那一页**逐字同源**）；缺席即整行不进 DOM（其它维度的卡片渲染一字未变）。
   */
  readonly meta?: string | undefined
  /**
   * ★**口径 64（本刀）**：系统广场那条记录在平台上的**安装坐标**（`EscPublishedItem.targetId`）。
   *
   * ★**它只在真的是"安全整数"时才在场**（`esc-list.ts` 的 `escSafeTargetId` 是唯一判定点）：
   *   非数字 / 小数 / 非有限 / `< 1` / `> 2^53-1` 一律**整格缺席** —— 这是 fail-closed 的落点，
   *   因为宿主那条路由的正文门禁就是「安全整数 `1..2^53-1`」，畸形值发过去只会换回一个 400。
   * ★它与 `skillId` **不是同一件事、也不许互相冒充**：`skillId` 是页内既有的跳转坐标（专家/技能两档
   *   共用一套归一化），而这一格**只服务**「系统广场那批已发布技能装到本机」这一条动作路
   *   （宿主 `POST …/local/skills/published/install` 收的就是它）。两格今天取同一个平台字段，
   *   但**判据不同**（这一格带安全整数门禁），故各自有名字、各自有取值口。
   */
  readonly targetId?: number | undefined
  /**
   * ★**口径 64（本刀）**：那条记录里发布者是否允许复制（平台 `allowCopy` 的**原值**）。
   *
   * ★**只有数字 `1` 才算允许**（`allowCopy === 1`）；缺席 / 非数字 / `0` / 其它任何值一律按
   *   **不允许**判（fail-closed，判据在 `esc-system.tsx` 的 `escSystemInstallPlan`）。
   *   真机实测平台**有字段没有执行**（138 条里 68 条 `allowCopy=0`，而 `export/700` 照样回 200 ZIP），
   *   故这道闸门只能我们自己判；而判据的**权威在宿主**（它按那条记录的详情再判一遍），
   *   界面这一格只是**预判**——判不过就在行上给可见原因并禁用，绝不画一枚点下去必被拒的按钮。
   */
  readonly allowCopy?: number | undefined
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
  /**
   * ★**口径 64（本刀）**：发布者是否允许复制（平台那条记录里的 `allowCopy`）。
   *
   * 平台给的是**数字**（真机实测 `1` / `0` 两值）。这里**不**写成 `boolean`：归一化（"只有 1 才算
   * 允许、其余一律不允许"）是**投影层**的判据，写进原始类型就会让"原值是什么"这件事在类型层消失，
   * 而那条 fail-closed 判据恰恰要能对着各种畸形原值被机械复核（`true` / `'1'` / 缺席都要判不允许）。
   */
  readonly allowCopy?: number | undefined
}

/** 平台连接器提供方目录的一条（连接器页「团队空间 / 已连接的」两格仍读它；本刀不动那两格）。 */
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
 * ★**口径 53（本刀）**：再加一枚 `installSkill`——把**企业中心注册的技能包**装到本机
 *   （用户裁决原话：「把后台注册的技能，安装到 DSH 本地」）。
 *
 *   ★**它为什么是可选**：判据仍是「端口在不在场」（本仓既有纪律：禁用即须有可见说明，绝不写死
 *     `disabled`），故"没接上"必须是一个**可表达的事实**（纯函数直调 / 老调用方 / 本部署没接线），
 *     而不是一个编译期就能骗过的必填位。真接线在 `client.tsx`（一定给）。
 *   ★**它复用哪一枚实现**：`local-api.ts` 的 `installSkill`（`POST …/local/skills/install`，
 *     正文关闭键集恰好 `{packageId}`，响应是 Host 落盘后的**最新已装清单**）。
 *     界面这一侧**绝不手写第二套 fetch + decode**——口径 47 那个 bug（整只信封喂给只认拆封体的解码器）
 *     就是这么来的；本仓全 `src` 里 `'/skills/install'` 这个字面量**只有一个调用点**（门禁反向锁）。
 *   ★**成功以 Host 回传的清单为准**：它的返回值就是"装完之后本机真的有哪些包"，界面据此翻卡片，
 *     **不做乐观切换**（不自己往清单里塞一枚、也不自己加计数）。
 */
export interface EnterpriseEscSkillPort {
  readonly uploadSkill: (file: File, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>
  readonly selfInstalledSkills: (signal: AbortSignal) => Promise<readonly EnterpriseSelfInstalledSkill[]>
  readonly uninstallSkill: (packageId: string, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>
  /** ★口径 53：企业技能包安装（复用 `local-api.ts` 那条既有实现；见接口上方那段）。 */
  readonly installSkill?: ((packageId: string, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>) | undefined
  /**
   * ★**口径 64（本刀）**：**系统广场**那批 NUWAX 已发布技能的安装
   *   （复用 `local-api.ts` 的 `installPublishedSkill`：`POST …/local/skills/published/install`，
   *   正文**关闭键集恰好** `{targetId}`，`targetId` 是**安全整数**而不是路径/字符串 id）。
   *
   * ★**它为什么与上一格分开、而不是并进 `installSkill`**：两条路的**坐标与制品来源完全不同**——
   *   · `installSkill(packageId)`：坐标是企业中心的**雪花字符串**，制品由 Host 代取中心 `/skills/…/download`，
   *     响应是**企业已装清单**（含 `packageId`/`versionId`），落盘后还要能被「企业技能」那一维度精确命中；
   *   · 这一格：坐标是平台这条记录的**数字 `targetId`**，制品是平台导出的裸技能目录 ZIP，
   *     响应是**本机自装清单**（没有中心包 id）——它改不动"企业已装"那份账。
   *   ⇒ 把二者混成一格就等于让"装的是哪一份、装没装"在同一个字段上打架（两套坐标系不可能同真）。
   * ★**它同样刻意可选**：判据仍是「端口在不在场」（缺席 ⇒ 那批【＋】禁用 + **行上可见**写明原因），
   *   而不是一个编译期就能骗过的必填位。真接线在 `client.tsx`（与 `installSkill` **同一处、同一枚实例**）。
   */
  readonly installPublishedSkill?: ((targetId: number, signal: AbortSignal) => Promise<readonly EnterpriseSelfInstalledSkill[]>) | undefined
  /**
   * ★**本刀（S5a）**：技能卡「更多」下拉里那两枚**本机管理动作**的实现面。
   *
   * ★**入参是技能在本机的目录名（kebab），不是 `packageId`、不是 `skillId`、不是 `targetId`**：
   *   宿主那两条路由的判据是「`name` ∈ 某条**自装**记录的 `names[]`」，故界面这一侧**只交名字**、
   *   从不交路径、也从不替宿主挑记录（"传一个路径进来"在宿主端口的形状上不可表达）。
   * ★**两条为什么与上面那几格都分开**：坐标（落盘目录名）、动作（删本机目录 / 开系统文件管理器）、
   *   失败面（404 找不到归属 / 409 跨归属或状态重叠 / 503 系统交接失败）与那几条"装东西"的路全不同；
   *   混进 `installSkill` 那类格子里，等于让"装/卸/开"三件事在同一个字段上打架。
   * ★**两条都刻意可选**：判据仍是「端口在不在场」（缺席 ⇒ 那两行**不画**，见 `esc-skill-more.ts`
   *   的计划投影与 `esc-more-menu.tsx` 的文件头——官方 `MenuItem` 没有 `title` 位，一枚禁用的菜单行
   *   说不出为什么按不动，故"不适用"一律表达为不画）。真接线在 `client.tsx`（同一枚 `escSkillApi` 实例）。
   */
  readonly uninstallSelfInstalledSkill?: ((name: string, signal: AbortSignal) => Promise<EnterpriseSelfInstalledUninstall>) | undefined
  readonly revealSelfInstalledSkill?: ((name: string, signal: AbortSignal) => Promise<{ readonly revealed: true }>) | undefined
  /**
   * ★**本刀（S5b）**：技能卡那枚「去试试」的写入口——**新建一个会话 + 把一句指令填进输入框**
   * （**不发送**，用户按发送才发出去）。
   *
   * ★**入参是那句拼好的指令**（唯一构造器是 `esc-skill-try.ts` 的 `enterpriseEscSkillTryDraft(name)`，
   *   名字来自卡片自己的 `item.name`）——界面这一侧**不交路径、不交 URL、不交任何内部键名**。
   * ★**它为什么是"跳新会话"而不是一条本机路由**：会话只能由**官方** `openWorkspace` 建（这是本仓的
   *   硬边界：不自己造会话、不自己发 HTTP）。故这一格的实现**复用** `preset-launch.ts` 那条唯一链路
   *   ——`client.tsx` 里接的就是**同一个** `createEnterprisePresetLauncher(...)`（与「查找技能 / 创建技能」
   *   那两项走的是同一枚构造器、同一份四个官方结构面）⇒ 全仓 `openWorkspace` / `setDraft` 的调用点
   *   **仍然只有 `preset-launch.ts` 一处**（门禁逐字节盯着这一点）。
   * ★`true` = 已经打开（复用空白或新建的）会话、并确实把文本交给了官方那枚写入口；`false` / reject
   *   = 这一级没走成 ⇒ 界面出 `ENT_SKILL_TRY_LAUNCH_FAILED` 的人话 + 下一步（**绝不静默**、也绝不假装成功）。
   * ★**为什么与 `EnterpriseEscDraftPort` 分成两格**（它们共用同一枚构造器，看起来像重复）：两处的
   *   **失败面与落点不同**——那一格属于工具栏下拉（漏填的是**界面写死的**两句提示词，用户自己也能贴），
   *   这一格属于**某一张卡片**（漏填的是**按这枚技能拼的**指令，卡片上还得说清是哪一枚失败了）。
   *   合并成一格就会让"哪一处缺席 / 哪一枚失败"说不清，而这正是本仓不肯含糊的那一格。
   */
  readonly fillSkillTryDraft?: ((draft: string) => Promise<boolean>) | undefined
  /**
   * ★**本刀（用户冻结规格 §3）**：「更多」里 `编辑` 那一行的实现面——**用系统默认应用打开这枚技能的
   * `SKILL.md`**（本机动作）。
   *
   * ★**它今天故意没有任何接线**（`client.tsx` 里**不**提供这一格）：那需要宿主侧新开一条只读/本机动作
   *   路由（与「打开文件夹」同族：`execFile` + argv、**不走 shell**、失败给稳定码），而那条路由
   *   **还没落地**。声明在这里是为了让判据**如实**：`esc-installed.tsx` 交下去的是
   *   `skillPort.editSkillFile !== undefined` 这个**端口在不在场**的事实（今天恒 `false` ⇒
   *   那一行**整行不画**，见 `esc-more-menu.tsx` 文件头与 `esc-skill-more.ts` 的计划投影），
   *   而不是界面里写死一个 `disabled` / 写死一个 `false`。
   *   ⇒ 路由落地那天要动的只有一处：在 `client.tsx` 的端口上补一格（界面一个字都不用改），
   *     那一行随之出现在那四行里的第二格。
   *
   * ★**入参仍是技能在本机的目录名（kebab）**，与上面那两格同一把键（界面不交路径：宿主拿到名字后
   *   自己在官方技能根里寻址，因此"传一个路径进来"在这个形状上不可表达）。
   */
  readonly editSkillFile?: ((name: string, signal: AbortSignal) => Promise<{ readonly revealed: true }>) | undefined
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
 * ★**本刀（Phase C D1：连接器广场）**：esc 连接器页「系统广场」那一格的**只读**数据端口。
 *
 * ★**为什么它是一枚独立端口、而不是 `EnterpriseEscApi` 上的第七个方法**：`esc-api.ts` 是**平台面**的
 *   镜像——它的每一条都对应平台一个只读端点，浏览器可读表由宿主那张闭集裁决（口径 31 起"新增一条
 *   `/api/...` 字面量"本身就是一件要被门禁咬住的事）。连接器广场走的是**本机同源脱敏投影**
 *   （`local-api.ts` 那一族：`plugins`/`skills`/`presets` 同一条边界，宿主从零构造、配置面一个字都不出厂）
 *   ⇒ 它**不进** `api`，与 `EnterpriseEscSkillPort` 走同一条注入范式。
 * ★**只有只读一格、没有写入口，这不是"还没写"**：本刀（D1）**不做**启用/断开（那是 D2）——
 *   故这一枚端口上**不存在**任何写方法，卡片那枚启用动作因此**恒禁用 + 行上可见原因**
 *   （判据是"端口上有没有那枚写方法"，不是界面写死一个 `disabled`）。
 * ★**它同时是"界面不碰平台 MCP 面"的结构性保证**：端口只交出 `EnterpriseConnectorCatalog`
 *   （宿主脱敏后的 `{connectors,complete,spaces}`），界面拿不到 `mcpConfig`/`deployedConfig`/`url`
 *   那类配置面——它们**在类型上就不可表达**（不是靠界面自觉不读）。
 * ★`signal` 必填（与 `EnterpriseLocalApi.connectors` 同形）：取数源每次 `load`/`retry` 都带**新的**
 *   `AbortSignal`，离开这一格 / 换维度即中止（迟到结果不回填，由 `createEnterpriseListSource` 保证）。
 */
export interface EnterpriseEscConnectorPort {
  /** 读一次本机连接器广场（`GET /enterprise/api/v1/local/connectors`；失败**原样抛**，绝不回落空列表）。 */
  readonly catalog: (signal: AbortSignal) => Promise<EnterpriseConnectorCatalog>
}

/**
 * ★**口径 49（降级）**：下拉里**这一项按不动**的可见原因（"禁用即须有说明"的唯一判据来源）。
 *
 * 三件事实分开，因为补救动作不同：
 *   · `'upload'`  = 本机技能写入口缺席（本地导入那台状态机没接上）；
 *   · `'find'`    = 草稿端口缺席（官方会话服务那四个结构面缺一环）；
 *   · `'create'`  = 同上，另一项（分开是为了让界面能说清**是这一项**按不动，而不是两项都灰）。
 */
export type EnterpriseEscAddSkillLock = EnterpriseEscDraftKind | 'upload'
