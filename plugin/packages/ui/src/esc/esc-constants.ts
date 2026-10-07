/**
 * [INPUT]: 依赖本包 `esc-copy` 的文案常量与 `esc-types` 的两个枚举类型
 * [OUTPUT]: 对外提供 esc 页面的常量族：平台成功码 `ESC_SUCCESS_CODE`、资源类型全集 `ESC_RESOURCE_TYPES`、分类根节点映射 `ESC_RESOURCE_TYPE_TO_CATEGORY_TYPE`、原页面的菜单父级 code `ESC_MENU_PARENT_CODE`、左栏兜底菜单 `ESC_DEFAULT_CATEGORY_MENUS`、以及「更多」原跳转地址 `ESC_RESOURCE_MORE_SQUARE_PATH`
 * [POS]: 逐字移植自 NUWAX `src/pages/ExpertSkillConnector/constants.ts`（口径 31）。
 *   ★三处**如实差异**：① `dict()` 换成 `esc-copy` 的常量（DSH 侧没有那套 i18n 运行时）；
 *   ② `RESOURCE_ROUTE_PATH`（三条子路由）**不搬**——DSH 侧不再按路径分发，资源类型就是组件状态；
 *   ③ `ESC_MENU_PARENT_CODE` **保留但不消费**：原页面用它去菜单权限树里取二级菜单，DSH 侧没有那棵树，
 *   于是直接走原文件自己写好的本地兜底（`ESC_DEFAULT_CATEGORY_MENUS`）——这正是原代码在"菜单接口未配置"时的既有路径，
 *   不是降级发明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ENTERPRISE_ESC_COPY } from './esc-copy.js'
import type { CategoryMenuItem, EscRecommendTargetTypeEnum, EscRecommendType, ResourceTypeEnum } from './esc-types.js'

/** 平台业务成功码（与 NUWAX `SUCCESS_CODE` 同值：`src/constants/codes.constants.ts`）。 */
export const ESC_SUCCESS_CODE = '0000'

/* ══════════════ 本刀：「精选技能」（官方推荐）那一行的查询常量 ═══════════════
 * 全部逐字取自 NUWAX 前端源码（`feat-2026.9.30`），每一格都写了出处——
 * 这四格**由取数面自己封死**（`esc-api.ts` 的 `officialRecommendedSkills`），页面改不了它们。 */

/** 平台端点（宿主白名单闭集里的第七条；`bundle/src/esc-route.ts` 有一份同名字面量，两边必须一致）。 */
export const ENTERPRISE_ESC_RECOMMEND_PATH = '/api/system/display/recommend/list'

/** `recType`：官方推荐（`DisplayRecTypeEnum.Official`，`RecommendManage/types/index.ts:10`）。 */
export const ENTERPRISE_ESC_RECOMMEND_REC_TYPE: EscRecommendType = 'Official'

/** `targetType`：技能档（`DisplayRecommendTargetTypeEnum.Skill`，`types/interfaces/displayRecommend.ts:17`）。 */
export const ENTERPRISE_ESC_RECOMMEND_TARGET_TYPE: EscRecommendTargetTypeEnum = 'Skill'

/** `pageNo`：官方那页固定传 1（`RecommendListPage/index.tsx:191` 的 `pageNo: 1`）。 */
export const ENTERPRISE_ESC_RECOMMEND_PAGE_NO = 1

/**
 * `pageSize`：官方那页用它自己的 `LIST_PAGE_SIZE`（同一文件），本刀**不抄那个常量**而是取一个明确的展示上限。
 *
 * ★理由：`LIST_PAGE_SIZE` 是**管理端后台表格**的分页尺寸；本页这一行是精选位、摆的是卡片，
 * 数量由设计定。把一个后台表格参数偷偷变成产品版式决策，正是本仓反复在治的那种「语义漂移」。
 */
export const ENTERPRISE_ESC_RECOMMEND_PAGE_SIZE = 10

/** 全部资源类型（顺序即左栏顺序）。 */
export const ESC_RESOURCE_TYPES: readonly ResourceTypeEnum[] = ['expert', 'skill', 'connector']

/**
 * 左栏菜单在菜单权限树中的父级菜单 code。
 *
 * ★本刀**不消费**它：原页面用它从 `menuModel` 取后端配置的二级菜单，DSH 侧没有那棵树，
 * 故直接落到 `ESC_DEFAULT_CATEGORY_MENUS`（原文件在"后端还没配这个菜单"时的既有兜底）。
 * 保留常量是为了让这处差异可读、可追溯，而不是把它悄悄删掉。
 */
export const ESC_MENU_PARENT_CODE = 'expert_skill_connector'

/**
 * 资源类型 → 已发布分类接口中根节点类型映射。
 *
 * 连接器维度与新建/编辑连接器抽屉同源，按根节点 `key === 'Connector'` 匹配，**不走**该映射（原文件同此口径）。
 */
export const ESC_RESOURCE_TYPE_TO_CATEGORY_TYPE: Readonly<Partial<Record<ResourceTypeEnum, string>>> = {
  expert: 'Agent',
  skill: 'Skill',
}

/** 连接器维度在分类接口里的根节点 key（原文件里的字面量，提出来做唯一真源）。 */
export const ESC_CONNECTOR_CATEGORY_ROOT_KEY = 'Connector'

/**
 * 各资源类型「更多」的原跳转地址（广场分类页）。
 *
 * ★原页面在这一格 `history.push(squarePath)`（见原 `ResourceToolbar/index.tsx` 里那段"更多"跳转）。
 * 本页**不跳 umi 路由**（DSH 里没有那个广场页面），改由用户裁决指向**外部技能广场**，见
 * {@link ESC_RESOURCE_MORE_HREF}；这里保留原地址只为逐条对照，不参与跳转。
 */
export const ESC_RESOURCE_MORE_SQUARE_PATH: Readonly<Partial<Record<ResourceTypeEnum, string>>> = {
  expert: '/square?cate_type=Agent',
  skill: '/square?cate_type=Skill',
}

/**
 * 「更多」现在的真实去向（**用户裁决**：「更多超链接到 https://skillhub.cn/」）。
 *
 * ★这是一处**刻意的本页差异**：官方那枚「更多」跳的是 NUWAX 自己的广场分类页（umi 路由，带 `cate_type`），
 * 那个页面在 DSH 里不存在；用户指定用公开的技能广场顶替，于是这里渲染成一枚**真超链接**
 * （`target="_blank"` + `rel="noreferrer noopener"`），而不是像口径 31 那样置灰写"未接入"。
 * 只有**系统广场**维度画它（连接器栏原本就不展示这个入口），团队空间/我启用的两维保留占位但不显示 —— 与原页面一致。
 */
export const ESC_RESOURCE_MORE_HREF = 'https://skillhub.cn/'

/**
 * 左侧分类菜单本地兜底配置。
 *
 * 与原文件同构（`code`/`label`/`path`/`icon` 四格一字不差，`path` 仍写原页面的子路由以便逐条对照；
 * DSH 侧不再跳路由，`path` 只作标识）。`icon` 也保留原标识，由左栏组件映射到 lucide 图标。
 */
export const ESC_DEFAULT_CATEGORY_MENUS: readonly CategoryMenuItem[] = [
  {
    code: 'expert',
    // ★用户裁决「专家专家团，名字只显示专家即可」：显示层读 `menuExpertDisplay`（正字仍是 `menuExpert`）
    label: ENTERPRISE_ESC_COPY.menuExpertDisplay,
    path: '/expert-skill-connector/expert',
    icon: 'icons-nav-user',
  },
  {
    code: 'skill',
    label: ENTERPRISE_ESC_COPY.menuSkill,
    path: '/expert-skill-connector/skill',
    icon: 'icons-nav-skill',
  },
  {
    code: 'connector',
    label: ENTERPRISE_ESC_COPY.menuConnector,
    path: '/expert-skill-connector/connector',
    icon: 'icons-common-link',
  },
]
