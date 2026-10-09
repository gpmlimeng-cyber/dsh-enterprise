/**
 * [INPUT]: 依赖 React 的 createElement、lucide-react 的 `Plus`/`Download`/`Search`/`Upload`、官方原语 `Input`/`Pill`/`Button`（`@deepseek-ai/dsh-client-ui-primitives`）、`official-ui` 接缝给出的官方 `Menu`/`MenuItemButton`、`esc-constants` 的「更多」原地址、`esc-copy` 的文案与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscToolbar`——**两段并列**（① 冻结头：三页签 + 右块；② 工具栏体：精选/维度/二级行）；★**口径 62（用户修正：二级 chip 行数据驱动）**：二级行的**唯一入口**是可选 prop `subTabs`（已投影好的 chip 行），缺席即逐字回到 `categories` 那一支、三个纯投影（`enterpriseEscSearchPlaceholder` / `enterpriseEscAddSkillLock` / `ENTERPRISE_ESC_ADD_SKILL_ITEMS`）与 `ENTERPRISE_ESC_MORE_PATH`
 * [POS]: esc 页面的**工具栏**，移植自 NUWAX `components/ResourceToolbar/index.tsx`（145 行）。
 *   ★四处注入点替换：① antd `Segmented` → 官方原语 `Pill` 组（DSH 体系里没有 Segmented，而 Pill 就是同一件事：
 *   一枚可选中态的小胶囊）；② antd `Input` + `@ant-design/icons` 的 `SearchOutlined` → 官方 `Input` + lucide `Search`；
 *   ③ 二级分类页签的 antd-less 自绘胶囊 → 同一个 `Pill`；④ umi `history.push` 跳广场 → **真超链接**指向
 *   外部技能广场 `https://skillhub.cn/`（**用户裁决**「更多超链接到 https://skillhub.cn/」，新开标签页 +
 *   `rel="noreferrer noopener"`；口径 31 那版是置灰写"未接入"，已被这条裁决取代）。
 *   ★版式与行为照抄：主行左右分置、搜索框 214px、「更多」用 `visibility` 隐藏**保留占位**（避免切主 tab 时右侧宽度跳动）、
 *   分类行 8px 间距 14px 上边距、页签胶囊 3px/12px 内衬 + 999px 圆角。
 *   ★antd Input 的 `allowClear` **没有**对应实现（官方 Input 不带清空钮）：这是本刀已知的一处小缺口，
 *   搜索框内容仍可全选删除，但少了那枚 × 按钮。
 *   ★用户裁决：药丸**不要描边**——本文件给每枚 `Pill` 都挂上 `esc-pill`（`esc-style` 用它压掉官方选中态自带的
 *   1px inset 环），于是资源类型 / 主 tab / 二级分类三行是同一套"无描边药丸"视觉。
 *   ★**口径 46/47**：右块那两枚不再是死控件——`onAddSkill`（本地导入，照商城那套）与 `onOpenInstalled`
 *   （切已安装技能页）；**判据是端口在不在场**，缺席即置灰并写明原因（不再写死 disabled）。
 *   ★**口径 49（本刀）**：三页主按钮的形态/尺寸/文案/动作按 WorkBuddy 实机逐页对齐，**只有技能页做下拉**：
 *   ① **技能页**那枚变成一个**三项下拉**（官方 `Menu` + `MenuItemButton`，与 `account-menu.tsx` 同一套原语，
 *      不自造下拉），三项按序「查找技能 / 上传技能 / 创建技能」——**上传技能**接的仍是口径 46 那枚本地导入
 *      写入口（行为一字不改，只是从"直接点"变成"从菜单里点"）；**查找技能 / 创建技能**走
 *      `preset-launch.ts` 那条"跳新会话 + `setDraft` 预填、**不发送**"（`onFindSkill`/`onCreateSkill`，
 *      由页壳经 `esc-aggregation` 接线到官方服务面）；
 *   ② **专家页**那枚改**白底描边**（`esc-add-skill-outline`，复用本页既有 `.esc-installed` 那条配方），
 *      **连接器页**保持黑胶囊（primary）——两页都**没有下拉**、动作仍是本地导入；
 *      ★**下拉在场时那枚按钮不许 `disabled`**：它是锚点，禁用了连菜单都点不开（整条新通路被关死）；
 *        上传那一项自己按不动由项级 `plan.disabled` 负责。没有下拉时才逐字回到口径 46 的 `disabled` 口径；
 *   ③ **文案暂不改**：三页都仍写「添加技能」。WorkBuddy 那两页分别是「我的专家」（进**子页**）与
 *      「添加连接器」（开 **MCP 弹窗**），那两件事本仓还没有排期（用户裁决：等子页与 MCP 弹窗排期再改名）
 *      —— 改了文案却不改行为就是让按钮说谎，故宁可暂缓；
 *   ④ **「已安装」只在技能页渲染**（专家/连接器页**整枚不渲染**，与 WorkBuddy 三页的分布一致）；
 *   ⑤ **搜索框 placeholder 随页变**（搜索专家 / 搜索技能 / 搜索连接器，取值只有
 *      `enterpriseEscSearchPlaceholder` 一处），旧那枚笼统的占位文案（见 esc-copy 的沿革注）已被替换。
 *   ★**为什么菜单开合态与失败上报要外置**：本组件是**纯投影**（不持 hook，直调可测），
 *   开合态住在 `esc-aggregation.tsx`；预填失败时由它渲染唯一提示组件 + 稳定码
 *   （`ENT_ESC_DRAFT_UNAVAILABLE`），本组件只经 `onSkillDraftFailure` **上报是哪一项没走成**。
 *   ★**前置刀沿革不动**：「添加技能」由 `size:'sm'`(h28) 升到 `size:'md'`(h36) 那一刀留下的档位
 *   被口径 49 收口——高度改由 `.esc-add-skill` 的 `height: var(--esc-btn-h)` **真钉死**
 *   （`min-height` 压不住官方 `.md` 的 36px，那正是上一轮"改了没生效"的根因）。
 *   ★**本刀第 ⑧ 条（滚动）**：本组件返回**两段** `[冻结头, 工具栏体]` 而不是一棵 `.esc-toolbar`——
 *   「三页签 + 右块」那一行住进 `.esc-tabs-freeze`（`position: sticky`），精选/维度/二级分类住进工具栏体。
 *   ★**为什么必须拆**：`position: sticky` 的吸附范围是**它的包含块**；页签行原先住在 `.esc-toolbar`
 *   里面、而那个盒子里还装着精选/维度/分类（比它高得多），于是"能吸附的距离"只剩那几行的高度、
 *   滚到底照样会走 ⇒ **冻不住**。提成**滚动面（`.esc-content`）的直属子节点**之后，包含块就是整段
 *   可滚高度 ⇒ 真的固定不动。三页签与右块仍**同一行**（用户裁决④那条结构一字未动），本刀只让那一行冻结。
 *   移动档由样式表把 sticky 关掉（`position: static`），既有那条「整页单滚动面」裁决保持。
 *   ★**口径 51（本刀）：三页主按钮的文案与动作逐页落地**（WorkBuddy 实机三页是三种交互，研究文件 §3）：
 *   ① **专家页**改「我的专家」、点它**进子页**（页内视图切换，由 `esc-page` 切到 `esc-my-experts.tsx`）；
 *   ② **连接器页**改「添加连接器」——WorkBuddy 那一枚开的是 MCP 管理弹窗，本刀**不做**那个弹窗
 *      ⇒ 该按钮**置灰 + 行上可见原因**（`customConnectorLocked`），绝不继续走本地导入文件选择器
 *      （那会让"文案说添加连接器、点开却是选文件"继续说谎）；
 *   ③ **技能页**一字不改（仍是三项下拉；那一页的文案仍是「添加技能」）。
 *   ★**判据仍是"端口在不在场"**：专家页看 `onOpenMyExperts`、连接器页看 `onCustomConnectors`
 *   （这个口子今天**全仓没有任何调用方会传**——本部署根本没有添加连接器管理接口）。
 *   两页的置灰原因都**行上可见**（`ENTERPRISE_ESC_LOCAL_COPY` 里那两句短句 + `role="status"`），
 *   挂一句 `title` 不算数（产品宪法：禁用控件不许只挂 `title`）——顺带把技能页那条降级路径
 *   （没有下拉供给、又没有本机写入口时的主按钮）也补上了同一句可见原因。
 *   形态/高度/右边界三件**一字未动**（专家页仍是 `.esc-add-skill-outline` 白底描边、连接器页仍是黑胶囊、
 *   盒高仍是 `height: var(--esc-btn-h)`）。
 *   ★**用户裁决（读不到 ⇒ 0）（本刀）**：顶栏「已安装(N)」的计数位**恒画 `(N)`**——
 *   `installedCount === undefined`（这一趟还没读回来 / 读失败）时画 `(0)`，与"真读到 0"**同形**；
 *   旧那枚橙色 `？` 整枚撤下。代价由按钮的 `title` 兜住：同一个 `(0)`、两种状态用**两句不同的 title**
 *   区分（读不到 ⇒ `installedCountUnreadable`「本机已装数量暂时读不到，先按 0 显示」；真 0 ⇒
 *   `installedFilterOpen` 那句）—— 这是"不许静默吞掉读不到"那条硬纪律在本刀的机器化落点。
 *   ★顺带**纠正文案错配**：`？` 原先挂的是 `ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable`
 *   （「分类暂时读不到」），而真机上分类那一面**本身是好的**（分类 chips 全在）—— 那句是给"分类字典
 *   读不到"用的，被计数借走就是让按钮指错原因。现在计数用**它自己**那枚新文案，
 *   `categoriesUnavailable` **收敛回分类那一处**（全 `src/esc` 的取值引用点只剩分类提示那一处，
 *   门禁有集合级反向锁）。
 *   ★不动的：计数来源（企业已装 + 本机自装**两份之和**）、请求次数与时机、「已安装」只在技能页、
 *   几何（110×32 / 右边界 / 字号）。子页「已安装技能」自己的读失败态**一字未动**（它另有如实交代）。
 *   ★**口径 55（本刀）**：技能页那枚「我启用的」维度**整枚删除**（用户裁决：他和已安装重复）⇒
 *     专家/技能页**恰好两枚**维度（系统广场 / 团队空间），连接器页第三枚仍是「已连接的」。
 *   ★**口径 54（本刀）**：新增第四态 prop `installedCountDiscovering`（官方发现面说 `complete === false`）
 *     —— 数字位画的仍是**真的读到的那几个**（**不许当 0**），只有 `title` 换成「还在发现中…」
 *     （句子里一个数字都没有 ⇒ **不许写死数字**）；title 优先级四档：暂定 > 发现中 > 口没接 > 正常。
 *   ★**口径 56（本刀，用户决定）**：连接器页那枚主按钮**改名「添加连接器」**——旧的那个名字在整个
 *     `src` 里**零出现**（连沿革注释也不写它：留一句"旧名叫 X"就是给同一件东西留第二个称呼，与
 *     "被替换的那一格必须整格不在"同一条纪律），并在它**左侧**
 *     加一枚「已安装」（形状/尺寸/字号照技能页那枚：**同一个类名** `.esc-installed`）。
 *     ★三件差别**逐条钉死**：① 连接器页那枚**不含数字**（那个数是**技能**的数，拿它冒充连接器的数
 *     比不给数字更坏）；② **恒禁用**（它打开的是**技能**的已安装页，本页没有"已安装的连接器"这回事，
 *     故即使页壳传了 `onOpenInstalled` 也不能放开）；③ 两枚都**行上可见**写明原因（那一行里只写**一句**，
 *     两枚同因：本部署还没有添加连接器的接口）。★**专家页整枚不渲染**（那一页没有这件东西）。
 *   ★**口径 51/49**（沿革）：连接器页那枚开的是 WorkBuddy 的 MCP 管理弹窗，本刀**仍不做**那个弹窗
 *     ⇒ 只改名与加那枚「已安装」，按钮照旧置灰 + 行上可见原因（绝不走本地导入文件选择器）。
 *   ★**口径 53（本刀，新裁决）**：技能页**再加第四枚**维度「企业技能」（`value: 'catalog'`，
 *     排在**最后**：系统广场 → 团队空间 → 本地三方 → 企业技能）。这是**新裁决、不是把口径 55/62
 *     那把锁放宽**（口径 55 删的是「我启用的」、口径 62 加的是「本地三方」，这一枚与两者语义无关）：
 *     它读的是**企业中心注册的技能包**，动作是真的"下载 + SHA-256 校验 + 落盘"。
 *     ★第四枚与第三枚一样**只在技能页**、一样带一句悬浮说明（四个字读不出"从哪来、装什么"）；
 *       前两枚照旧不挂 title、连接器页第三枚仍是「已连接的」（本刀两处都不动）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { Download, Plus, Search, Upload } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { ESC_RESOURCE_MORE_HREF, ESC_RESOURCE_MORE_SQUARE_PATH } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { OfficialMenu, OfficialMenuItemButton } from '../official-ui.js'
import { EnterpriseEscSubTabRow, type EnterpriseEscSubTab } from './esc-sub-tabs.js'
import type {
  EnterpriseEscAddSkillLock,
  ResourceCategoryInfo,
  ResourceSourceEnum,
  ResourceTypeEnum,
} from './esc-types.js'

/** ★**口径 49**：技能页主按钮下拉里的三项（先顺序即渲染顺序，逐字取自 WorkBuddy 实机）。 */
export const ENTERPRISE_ESC_ADD_SKILL_ITEMS: readonly {
  readonly key: 'find' | 'upload' | 'create'
  readonly label: string
}[] = [
  { key: 'find', label: ENTERPRISE_ESC_COPY.addSkillFind },
  { key: 'upload', label: ENTERPRISE_ESC_COPY.addSkillUpload },
  { key: 'create', label: ENTERPRISE_ESC_COPY.addSkillCreate },
]

/**
 * ★**口径 49**：下拉一项的**终态**（`disabled` + 禁用时的**可见**原因 + 真正渲染的文案）。
 *
 * ★**为什么原因写进可见文案、而不是挂 `title`**：官方 `MenuItemButton` 只把
 *   `{children, shortcut, icon, disabled, danger, separatorBefore, onSelect}` 交给那一行
 *   （app.asar 逐字核过，**不透传 `title`**）⇒ 挂上去会被静默丢弃、等于没有原因。
 *   产品宪法要的是「禁用即须有**可见**说明」，故这里照本仓商城页那条**同款做法**
 *   （`ENTERPRISE_ADD_MENU_DEVELOPING`：`标签（原因）`），把原因并进可见文案。
 */
export interface EnterpriseEscAddSkillItemPlan {
  readonly key: 'find' | 'upload' | 'create'
  readonly label: string
  /** `true` ⇒ 官方那枚真 `<button role="menuitem">` 带 `disabled`（不可聚焦、点不到）。 */
  readonly disabled: boolean
  /** 禁用时的**可见原因**（并进 `text`；可点时缺席）。 */
  readonly reason?: string | undefined
  /** 真正渲染的文案：可点 = 标签本身；禁用 = 「标签（原因）」。 */
  readonly text: string
}

/**
 * ★**口径 49**：搜索框 placeholder 的**唯一**取值口（随页变）。
 *
 * 三枚逐字取自 WorkBuddy 实机的 i18n（`analysis/workbuddy-add-skill-research.md`），旧那枚笼统的
 * 旧那枚笼统的占位文案已被**替换**（`esc-copy.ts` 里那一格整枚删除，不留第二真源）。
 * 做成纯函数而不是组件内的三元：它是可直调的判据（门禁锁三页逐字且互不相同），
 * 也保证"哪一页用哪一枚"只有这一处判断。
 */
export function enterpriseEscSearchPlaceholder(resourceType: ResourceTypeEnum): string {
  if (resourceType === 'skill') return ENTERPRISE_ESC_COPY.searchPlaceholderSkill
  if (resourceType === 'connector') return ENTERPRISE_ESC_COPY.searchPlaceholderConnector
  return ENTERPRISE_ESC_COPY.searchPlaceholderExpert
}

/**
 * ★**口径 49**：下拉里**哪一项按不动**（`undefined` = 三项都能按）。
 *
 * 与 `.esc-installed` 那枚同一条纪律：**判据是端口在不在场**，不是写死的 `disabled`；
 * 按不动的那一项必须配一句**可见原因**（`ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted`）。
 *
 * 三件事实分开报（上传缺本机写入口 / 查找缺草稿端口 / 创建缺草稿端口）——补救动作不同，
 * 混成一句会让员工看不出到底缺哪半边。
 */
export function enterpriseEscAddSkillLock(input: {
  readonly onAddSkill?: (() => void) | undefined
  readonly onFindSkill?: (() => void) | undefined
  readonly onCreateSkill?: (() => void) | undefined
}): readonly EnterpriseEscAddSkillLock[] {
  const locks: EnterpriseEscAddSkillLock[] = []
  if (input.onFindSkill === undefined) locks.push('find')
  if (input.onAddSkill === undefined) locks.push('upload')
  if (input.onCreateSkill === undefined) locks.push('create')
  return locks
}

/**
 * ★**口径 49**：三项的**终态清单**（渲染层唯一的输入，纯函数、可直调取证）。
 *
 * 口径与商城页那枚「添加」下拉**逐条同源**：可点 = 标签本身；不可点 = 标签 + 可见原因
 * `ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted`（见 `EnterpriseEscAddSkillItemPlan` 上方那段）。
 * 三项**顺序与文案**都取自 `ENTERPRISE_ESC_ADD_SKILL_ITEMS`（不在这里重抄一遍）。
 */
export function enterpriseEscAddSkillPlans(
  input: {
    readonly onAddSkill?: (() => void) | undefined
    readonly onFindSkill?: (() => void) | undefined
    readonly onCreateSkill?: (() => void) | undefined
  },
): readonly EnterpriseEscAddSkillItemPlan[] {
  const locked = enterpriseEscAddSkillLock(input)
  return ENTERPRISE_ESC_ADD_SKILL_ITEMS.map(item =>
    locked.includes(item.key)
      ? {
          key: item.key,
          label: item.label,
          disabled: true,
          reason: ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted,
          text: `${item.label}（${ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted}）`,
        }
      : { key: item.key, label: item.label, disabled: false, text: item.label },
  )
}

/**
 * ★**口径 51**：主按钮（三页共用的那一枚）上的取证钩子。
 *
 * 页壳在**返回**时按它把焦点还给这一枚（进子页/进已安装页都会把内容区整棵换掉，
 * 旧 DOM 引用已不可用 ⇒ 只能按选择器在新树里找回它）。写在属性上而不是类名上：
 * 类名清单要留给"形态"那一条判据（`.esc-add-skill esc-add-skill-outline`），不混两件事。
 */
export const ENTERPRISE_ESC_MAIN_ACTION_ATTR = 'data-esc-main-action'

/**
 * ★**口径 51**：专家页/连接器页那两枚主按钮的**终态**（文案 / 能不能按 / 按下去干什么 /
 * 悬浮说明 / 禁用时**行上可见**的原因）。技能页返回 `undefined`（那一页另有下拉与降级两态）。
 *
 * 与 `enterpriseEscAddSkillPlans` 同一条纪律：判据是**端口在不在场**，不是写死的 `disabled`；
 * 按不动时**必须**配一句可见原因（`lock`），因为产品宪法禁止"只挂一句 title 的禁用控件"。
 *
 * @param input - 资源类型与两枚端口（`onOpenMyExperts` / `onCustomConnectors`）。
 * @returns 那一页主按钮的终态；技能页为 `undefined`。
 */
export function enterpriseEscMainActionPlan(input: {
  readonly resourceType: ResourceTypeEnum
  readonly onOpenMyExperts?: (() => void) | undefined
  readonly onCustomConnectors?: (() => void) | undefined
}): EnterpriseEscMainActionPlan | undefined {
  if (input.resourceType === 'expert') {
    const wired = input.onOpenMyExperts !== undefined
    return {
      label: ENTERPRISE_ESC_COPY.myExperts,
      disabled: !wired,
      onClick: input.onOpenMyExperts,
      title: wired ? ENTERPRISE_ESC_LOCAL_COPY.myExpertsOpenTitle : ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted,
      lock: wired ? undefined : ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted,
    }
  }
  if (input.resourceType === 'connector') {
    const wired = input.onCustomConnectors !== undefined
    return {
      label: ENTERPRISE_ESC_COPY.customConnector,
      disabled: !wired,
      onClick: input.onCustomConnectors,
      // 今天恒走"未接线"那一支（本部署没有添加连接器管理接口）；真接线那天标题换成"会发生什么"。
      title: wired
        ? ENTERPRISE_ESC_LOCAL_COPY.customConnectorOpenTitle
        : ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked,
      lock: wired ? undefined : ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked,
    }
  }
  return undefined
}

/** 主按钮的终态（见 `enterpriseEscMainActionPlan`）。 */
export interface EnterpriseEscMainActionPlan {
  /** 按钮上的可见文案（三页各不相同：添加技能 / 我的专家 / 添加连接器）。 */
  readonly label: string
  /** `true` ⇒ 官方 `Button` 带 `disabled`（点不到）。 */
  readonly disabled: boolean
  /** 点它干什么（`disabled` 时缺席）。 */
  readonly onClick: (() => void) | undefined
  /** 悬浮说明（可用时是"会发生什么"，不可用时也写明原因）。 */
  readonly title: string
  /** 禁用时**行上可见**的那句原因（可点时缺席）。 */
  readonly lock?: string | undefined
}

/** 工具栏入参。 */
export interface EnterpriseEscToolbarProps {
  readonly resourceType: ResourceTypeEnum
  readonly source: ResourceSourceEnum
  readonly onSourceChange: (source: ResourceSourceEnum) => void
  /** 二级分类列表（首位为「全部」）。 */
  readonly categories: readonly ResourceCategoryInfo[]
  /** 当前分类 key，空串表示全部。 */
  readonly activeCategory: string
  readonly onCategoryChange: (key: string) => void
  /**
   * ★**口径 62**：二级行的**数据驱动入口**（由页壳投影好；缺席即逐字回到 `categories` 那一支）。
   *
   * 它的形状是"已经算好的一排 chip + 选中的那一枚 + 选它干什么"——工具栏**不认识任何数据形状**，
   * 故下一个维度（SkillHub 的市场来源）复用它时，这里一个字都不用改。
   * ★`chips` 里**恒含**首位那枚「全部」（由 `enterpriseEscSubTabs` 统一加，不在各维度各写一份）。
   */
  readonly subTabs?: {
    readonly chips: readonly EnterpriseEscSubTab[]
    readonly activeKey: string
    readonly onSelect: (key: string) => void
  } | undefined
  /** 搜索关键字（输入框受控值）。 */
  readonly keyword: string
  readonly onKeywordChange: (keyword: string) => void
  /** 是否显示「更多」入口（连接器页为 false，与原页面一致）。 */
  readonly showMore?: boolean | undefined
  /** 分类字典读不到时的降级提示（本页新增：原页面静默）。 */
  readonly categoriesUnavailable?: boolean | undefined
  /**
   * 本机已装技能数（顶栏「已安装(N)」那枚的计数）。
   *
   * ★**用户裁决（读不到 ⇒ 0）**：`undefined`＝**没读到真值**（这一趟还没回来／读失败），此时数字位
   * 画 `(0)`——与"真读到 0"**同一个形状**（用户已明确接受这个代价：真 0 与读不到的 0 在按钮上长得一样）。
   * 代价由 `title` 兜住：那枚按钮**仍然说得出**"这个数字是暂定的／读不到"（`installedCountUnreadable`），
   * 所以同一个 `(0)`、两种状态靠 `title` 区分 —— **绝不静默吞掉"读不到"**。
   * ★旧口径（`？` ＋ 借 `categoriesUnavailable` 那句）已按本裁决撤下，理由见下面渲染处那段。
   * ★取值来自**官方发现面** `GET /skills/discovered`（口径 54：本机 DSH 真的装着什么），
   *   不是我们那两份记录 —— 两份记录只作来源/元信息。
   */
  readonly installedCount?: number | undefined
  /**
   * 本机已装清单**这一趟读失败**（与 `installedCount === undefined` 同时给）。
   *
   * ★它仍是那枚按钮的一个真输入：计数位画 `(0)` 时，"这个 0 是暂定的"这件事由它与 `installedCount`
   * 一起判定（两条任一成立即暂定），说法落在 `title` 上。旧口径里它驱动的是那枚橙色 `？`，现已撤下。
   */
  readonly installedCountFailed?: boolean | undefined
  /**
   * ★**口径 54**：官方发现面说它**还没发现完**（`complete === false`）。
   *
   * 这一态与上面两态**不同**：读是读到了（数字位画的是**真的读到的那几个**，不是暂定的 0），
   * 但这个数**还会变**。用户裁决的原话是「`complete === false` ⇒ 如实说"还在发现中"
   * （不许当 0、不许写死数字）」⇒ 这里不写死任何数字，只把这件事**说出来**
   * （`installedCountDiscovering` 那句，落在 title 上，优先级在"暂定"之下、"口没接"之上）。
   * ★为什么不让它压过"暂定"：`installedCount === undefined` 时数字位画的是 `(0)`，
   *   那句"还在发现中"会让员工以为那个 0 是真的发现结果 —— 而它其实一个都没读到。
   */
  readonly installedCountDiscovering?: boolean | undefined
  /**
   * ★用户裁决（两栏结构）：
   *   · `leading` ＝ **第一栏左侧**：三页签（与右块同处这一行）。
   *   · `belowLeading` ＝ **第二栏**：「精选技能 / 精选专家」那一行。
   * 两个插槽把**行序**收进本组件，调用方不必关心谁先谁后。
   */
  readonly leading?: ReactNode | undefined
  readonly belowLeading?: ReactNode | undefined
  /**
   * ★口径 46：「添加技能」那枚的**写入口**（本地导入：打开文件选择器）。
   *
   * 与 `libraryGate` / `presetLaunch` 同一条注入范式：**端口缺席 ⇒ 这枚按钮置灰**并写明原因
   * （`actionNotPorted`）。这条位是"禁用即须有可见说明"的**唯一**判据来源 —— 不许写死 `disabled`。
   *
   * ★**口径 49 起**它不再直接挂在主按钮上：技能页那枚主按钮变成一个三项下拉，
   * 它是里面「上传技能」那一项的动作（**行为一字不改**，只是从"直接点"变成"从菜单里点"）；
   * 专家页/连接器页那两枚仍原样直接调它（那两页没有下拉，理由见 `esc-copy.ts` 的那段注释）。
   */
  readonly onAddSkill?: (() => void) | undefined
  /**
   * ★口径 47：「已安装」那枚的入口（切到已安装技能页）。
   *
   * 同上：缺席即置灰写明原因，绝不画一枚点了没反应的控件。
   */
  readonly onOpenInstalled?: (() => void) | undefined
  /**
   * ★**口径 49**：下拉里「查找技能」那一项（跳新会话 + 把提示词预填进输入框、**不发送**）。
   *
   * 缺席 ⇒ 这一项置灰 + 写明原因（`draftUnavailable`）。**只有技能页**会传它
   * （专家页/连接器页那两枚没有下拉，见 `esc-copy.ts` 里那段"文案暂不改"的理由）。
   */
  readonly onFindSkill?: (() => void) | undefined
  /** ★**口径 49**：下拉里「创建技能」那一项。口径同 `onFindSkill`。 */
  readonly onCreateSkill?: (() => void) | undefined
  /**
   * ★**口径 49**：下拉菜单的**开合态与写入口**（由页壳持有，因为本组件是**纯投影**、不持 hook）。
   *
   * 缺席 ⇒ 整枚按钮退化成"直接点 = 本地导入"那一态（`onAddSkill` 就是它的 onClick）——
   * 这是**降级路径**，与口径 46 之前逐字相同；门禁里有一条反向锁盯住它不许退化。
   */
  readonly addSkillMenu?: {
    readonly open: boolean
    readonly onClose: () => void
    readonly onToggle: () => void
  } | undefined
  /**
   * ★**口径 49**：下拉里某一项**按不动**时，请页壳在工具栏下方说一句（人话 + 下一步 + 稳定码）。
   *
   * 本组件不渲染那句话（它是纯投影，落点在 `esc-aggregation.tsx` 的 `EnterpriseErrorNotice`）——
   * 这里只负责**上报**"是哪一项没走成"，让失败可见的那一半留在有 hook 的那一层。
   */
  readonly onSkillDraftFailure?: ((kind: 'find' | 'create') => void) | undefined
  /**
   * ★**口径 51**：专家页那枚「我的专家」的入口（切到「我的专家」子页）。
   *
   * 缺席 ⇒ 置灰 + **行上可见**原因（`actionNotPorted`）。★它**不进** `api`（只读面）、
   * 也不是第二套路由机制：子页就是同一页里的一份视图状态（与「已安装技能」页同一条手法）。
   */
  readonly onOpenMyExperts?: (() => void) | undefined
  /**
   * ★**口径 51**：连接器页那枚「添加连接器」的入口（WorkBuddy 那边开的是 MCP 服务管理弹窗）。
   *
   * ★**今天全仓没有任何调用方会传它**：本部署的只读闭集里没有添加连接器管理面，
   * 本刀也明令不做那个弹窗 ⇒ 这一枚恒置灰 + 行上可见原因（`customConnectorLocked`）。
   * 保留这个口子不是"预留将来要用的代码"，而是让禁用判据保持在**端口**上
   * （写死 `disabled: true` 会让下一个读者分不清"本部署没有这个能力"与"忘了接线"）。
   */
  readonly onCustomConnectors?: (() => void) | undefined
}

/**
 * 主 tab 选项（构造顺序与显隐口径：**技能页恰好四枚**「系统广场 / 团队空间 / 本地三方 / 企业技能」，
 * 专家页两枚，连接器页那第三枚是「已连接的」）。
 *
 * ★**口径 55（用户裁决）**：技能页那枚「我启用的」（`value: 'enabled'`）**整枚删除**。
 *   用户原话是「我启用的」删掉，理由是**它跟「已安装」重复** —— 这一维读的是平台
 *   `POST /api/published/skill/enable/list`（这台部署本来就没有它），而它想回答的那个问题
 *   （"我这儿到底有哪些技能"）由「已安装」那一枚回答；口径 54 起「已安装」**已经换成本机 DSH
 *   的官方发现面**（磁盘上真的装着什么），比"平台记着谁启用过"更接近员工问的那件事。
 *   两枚并排只会让员工在同一屏上看到两个不同的数字。
 *   ★删的是**整枚维度**（选项 + 文案 + 取数适配器 + 端点缺失码 + 联合类型那一格），
 *   不是"藏起来"：本仓不容许"看着还能用"的第二真源（与口径 49 删旧占位符同一条纪律）。
 *   ★这也正是 WorkBuddy 实机的形状：它的专家页/技能页**就是这两枚**。
 *   连接器页那第三枚仍是「已连接的」（`'connected'`）——本刀一字未动。
 *
 * ★**口径 62（本刀，新裁决）**：技能页**再**加第三枚「本地三方」（`value: 'third-party'`）。
 *   用户原话是「我希望在系统广场、工作空间后增加一个标签，用以展示扫别的 Agent CLI 的技能库的
 *   技能，同样可以安装进DSH，就是本地三方 Agent技能源」。
 *   ★**这是新裁决、不是把口径 55 那把锁放宽**：口径 55 删的是「我启用的」（与「已安装」重复），
 *     这一枚与它**语义无关**（扫的是别的 Agent CLI 的技能库，动作是"复制进来"而不是"只登记"）。
 *     故那把锁**照旧存在**（仍是 `toHaveLength` + 逐字清单），只是数字与清单按本刀改为三枚。
 *   ★**只在技能页**（专家页/连接器页不动）：这一维度的语义是"技能库"，与专家/连接器无关；
 *     连接器页那第三枚仍逐字是「已连接的」（不改顺序、不改数量）。
 *   ★顺序 = 用户原话的顺序：系统广场 → 团队空间 → 本地三方。
 *
 * ★**口径 53（本刀，新裁决）**：技能页**再**加第四枚「企业技能」（`value: 'catalog'`），
 *   排在**最后**（系统广场 → 团队空间 → 本地三方 → 企业技能）。
 *   ★**这是新裁决、不是把口径 55/62 那把锁放宽**：那两刀删/加的两枚分别是「我启用的」
 *     （用户裁决：与「已安装」重复）与「本地三方」（扫别的 Agent CLI 的技能库），
 *     这一枚与两者**语义无关**（它读的是**企业中心发布并登记过**的技能包，动作是真的
 *     下载 + SHA-256 校验 + 落盘到 `~/.dsh/skills`）⇒ 那把锁**照旧存在**（仍是 `toHaveLength`
 *     + 逐字清单），只是数字与清单按本刀改为四枚。
 *   ★它也**只在技能页**：连接器页那第三枚一字未动，专家页仍是两枚。
 *
 * ★**本刀 ③（SkillHub 维度：第四枚的名字与来源都换）**：用户裁决「那一枚的名字与来源都换」——
 *   第四枚由「企业技能」（`'catalog'`）换成 **`SkillHub`**（`'skillhub'`），位次与数量一字未动
 *   （仍是四枚、仍排最后），换的是名字与它背后的数据面（企业中心目录 → 既有的在线搜索本机路由）。
 *   ★**「企业技能」维度整枚撤掉**：它的**内容不丢** —— 「应用商店 → 企业技能」（`marketplace-entry.tsx`
 *     那一枚页签与卡片）与企业设置 → 技能两处照旧，撤掉的只是"技能页这一枚入口"。
 *   ★**这一刀**没有把口径 55/62/53 那把锁放宽**：判据形状（`toEqual` 逐字 + 顺序 + `toHaveLength`）
 *     一字未改，只是第四个字符串按用户裁决换了值——每处改动都在 spec 里写明理由。
 *   ★**那一面的代码按 ① 明令不动**（`esc-catalog-list.tsx` 仍手拼卡片，与「已安装」并列登记为
 *     "下一刀收编"）⇒ `ResourceSourceEnum` 里 `'catalog'` 那一格**留着**、这里不再产出它。
 */
function sourceOptionsOf(resourceType: ResourceTypeEnum): readonly { readonly label: string; readonly value: ResourceSourceEnum }[] {
  return [
    { label: ENTERPRISE_ESC_COPY.mainTabSystem, value: 'system' },
    { label: ENTERPRISE_ESC_COPY.mainTabTeam, value: 'team' },
    // ★口径 62：第三枚**只在技能页**（`resourceType === 'skill'`），且排在「团队空间」之后。
    ...(resourceType === 'skill'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabThirdParty, value: 'third-party' as const }]
      : []),
    /**
     * ★**本刀 ③（SkillHub 维度）**：第四枚**只在技能页**，且排在**最后** —— 用户裁决原话是
     *   「那一枚的名字与来源都换」：位次与数量**一字未动**（仍是四枚），换掉的是那一枚的名字
     *   （「企业技能」→ `SkillHub`）与它背后的数据面（企业中心目录 → 既有的在线搜索本机路由）。
     *
     * ★**这是"换"、不是"把口径 53 那把锁放宽"**：那把锁照旧存在（仍是 `toHaveLength` + 逐字清单
     *   + 顺序），只是第四个字符串按用户裁决改了；每一条改动都在 spec 里写明理由。
     * ★**「企业技能」维度整枚撤掉**（本刀 ③）：它的内容**不丢** —— 「应用商店 → 企业技能」与企业设置
     *   → 技能两处照旧；撤掉的只是"技能页这一枚入口"。★那一面的**代码**本刀按 ① 明令不动
     *   （它仍手拼卡片，与「已安装」并列登记为"下一刀收编"）⇒ 这里不再产出 `'catalog'` 取值，
     *   但 `ResourceSourceEnum` 里那一格**留着**（删它要连带改那一面的代码与它的锁，那是下一刀的事）。
     * ★它**不进** `esc-list.ts` 的适配器表：这一维度不读 NUWAX 平台，内容由 `esc-skillhub.ts` 铺。
     */
    ...(resourceType === 'skill'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabSkillHub, value: 'skillhub' as const }]
      : []),
    ...(resourceType === 'connector'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabConnected, value: 'connected' as const }]
      : []),
  ]
}

/**
 * 资源聚合页顶部工具栏。
 *
 * ★**本刀第 ⑧ 条：这一层现在返回**两段**（`[冻结头, 工具栏体]`）而不是一棵 `.esc-toolbar`**。
 *
 * **为什么拆**：`position: sticky` 的吸附范围是**它的包含块**（最近的块级祖先的内容盒）——
 *   页签行原先住在 `.esc-toolbar` 里面，而那个盒子里还装着精选行/维度行/分类行（比它高得多），
 *   于是"能吸附的距离"只剩那几行的高度，滚到底照样会走 ⇒ **冻不住**。
 *   把它提成**滚动面（`.esc-content`）的直属子节点**之后，包含块就是整个可滚动高度 ⇒ 真的固定不动。
 *
 * **为什么必须提到滚动面外面**：三页签 + 右块（更多/搜索/已安装/添加）排成**一行**这件事是
 *   用户裁决④定的结构（同排由 flex 保证，不靠巧合）；本刀只让**那一行**冻结，不拆它内部。
 *
 * ★**间距一字未动**：`.esc-toolbar-second`（精选）的 `margin-top: 20px` 留在原处，
 *   连接器页没有精选行时由维度行的 `margin-top: 14px` 顶上——两页的行序与间距都与拆之前逐像素相同，
 *   变的只是"那一行的父节点是谁"。
 */
export function EnterpriseEscToolbar({
  resourceType,
  source,
  onSourceChange,
  categories,
  activeCategory,
  onCategoryChange,
  subTabs,
  keyword,
  onKeywordChange,
  showMore = true,
  categoriesUnavailable,
  installedCount,
  installedCountFailed,
  installedCountDiscovering,
  leading,
  belowLeading,
  onAddSkill,
  onOpenInstalled,
  onFindSkill,
  onCreateSkill,
  addSkillMenu,
  onSkillDraftFailure,
  onOpenMyExperts,
  onCustomConnectors,
}: EnterpriseEscToolbarProps): ReactNode {
  /**
   * ★**口径 49**：下拉里哪一项按不动（判据＝端口在不在场，见 `enterpriseEscAddSkillLock`）。
   * 三项**各自**一条可见原因；`actionNotPorted` 就是原因那句原话（"禁用即须有说明"）。
   */
  const lockInput = { onAddSkill, onFindSkill, onCreateSkill }
  const plans = enterpriseEscAddSkillPlans(lockInput)
  /**
   * ★**口径 49**：只有**技能页**有那枚三项下拉。
   *
   * 专家页与连接器页在 WorkBuddy 里根本不是下拉（进子页 / 开 MCP 弹窗，研究文件 §3 已证），
   * 本刀按用户裁决只对齐那两页的尺寸与形态、文案与动作**都不改** ⇒ 它们仍是一枚直接点的主按钮。
   * 这就是"三页共用同一枚按钮、形态由 `resourceType` 派生"那条纪律的本刀形态。
   */
  const menuable = resourceType === 'skill'
  /**
   * ★**口径 49**：这一页到底有没有那枚下拉 —— 两个条件**同时**要成立：
   *   ① 页面是技能页（专家/连接器页在 WorkBuddy 里不是下拉，见上面那段）；
   *   ② 下拉供给在场（页壳把开合态交下来了；纯函数直调 / 老调用方没有它）。
   *
   * 不成立时**整枚 Menu 都不建**（连同开合态与菜单项一起），主按钮直接是口径 46 那一枚真按钮 ——
   * 「端口缺席 ⇒ 不画一枚点了没反应的锚点」。
   */
  const withMenu = menuable && addSkillMenu !== undefined
  const menuOpen = withMenu && addSkillMenu.open
  /** 走会话的两项：**只负责把动作交上去**（真实的开会话 + 预填 + 失败可见都在页壳那一层）。 */
  const runDraft = (key: 'find' | 'create'): void => {
    if (addSkillMenu === undefined) return
    addSkillMenu.onClose()
    const run = key === 'find' ? onFindSkill : onCreateSkill
    if (run === undefined) {
      // 按不动的那一项：正常路径下 `disabled` 已经拦住了它；这一支只为"键盘/程序触发"兜底，
      // 仍然**不静默**——把失败上报给页壳，由唯一提示组件出人话 + 下一步 + 稳定码。
      onSkillDraftFailure?.(key)
      return
    }
    run()
  }
  /**
   * ★**口径 51**：专家页 / 连接器页那两枚主按钮的**终态**（技能页返回 `undefined`，见上面那段）。
   * 判据是端口在不在场；按不动时 `lock` 那格带一句**行上可见**的原因。
   */
  const mainAction = enterpriseEscMainActionPlan({ resourceType, onOpenMyExperts, onCustomConnectors })
  /**
   * ★**口径 49**：那一枚主按钮本身（三页共用**同一枚**，形态由 `resourceType` 派生）。
   *
   * 为什么先建它再决定包不包 Menu：没有下拉供给时（`addSkillMenu` 缺席、或这是专家/连接器页）
   * 它必须**逐字回到口径 46 那一态**——一枚直接调本地导入的真按钮。包一层 `Menu` 会多出一枚
   * 点了没反应的锚点（死控件），那是本仓反复禁掉的最坏形态。
   */
  const addSkillButton = createElement(
    Button,
    {
      // ★主按钮走**近黑实底**（本主题 button-primary-fill 即近黑），品牌色只留给状态标识。
      // ★**口径 49 的形态 + 口径 51 的文案**：技能/连接器页 = primary（黑胶囊，文案「添加技能」/
      //   「添加连接器」）；专家页 = `esc-add-skill-outline`（白底描边，文案「我的专家」）
      //   —— 描边档复用本页 `.esc-installed` 那条**既有**配方，不新造第二套白底按钮。
      //   ★口径 51 把三页的文案逐页落实（WorkBuddy 实机三页就是三个词）；连接器页那枚**同时置灰**
      //   并写明原因（那一页的动作本刀不做），故"改文案却不改行为"这条说谎路径被堵死。
      variant: resourceType === 'expert' ? 'outline' : 'primary',
      // 官方原语档位：`md` 给的是圆角/内衬的**基准**，高度另有 `.esc-add-skill` 的
      // `height: var(--esc-btn-h)` 真钉住（`min-height` 压不住官方 md 档的 `height: 36px` —— 上一轮就是这么没生效的）。
      size: 'md',
      className: resourceType === 'expert' ? 'esc-add-skill esc-add-skill-outline' : 'esc-add-skill',
      // ★口径 49：有下拉时按钮只开合菜单（不直接干上传那件事，连 `disabled` 都不写——
      //   锚点被禁用就点不开菜单，那是把整条新通路关死）；没有下拉时**逐字回到口径 46 那一态**
      //   （点击 = 本地导入，端口缺席即置灰 + 写明原因）——这就是那条不许退化的降级路径。
      //   ★口径 51：专家/连接器两页走 `mainAction`（各自的端口与文案），技能页沿用上面那两态。
      ...(withMenu
        ? { onClick: addSkillMenu!.onToggle, 'aria-haspopup': 'menu' as const, 'aria-expanded': menuOpen }
        : mainAction === undefined
          ? {
              disabled: onAddSkill === undefined,
              onClick: onAddSkill,
            }
          : {
              disabled: mainAction.disabled,
              onClick: mainAction.onClick,
            }),
      title: withMenu || mainAction === undefined
        ? (onAddSkill === undefined ? ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted : ENTERPRISE_ESC_LOCAL_COPY.addSkillLocalImport)
        : mainAction.title,
      // ★口径 51：页壳返回时按这一枚找回焦点（进子页/进已安装页都会把内容区整棵换掉）。
      ...{ [ENTERPRISE_ESC_MAIN_ACTION_ATTR]: '' },
    },
    createElement(Plus, { size: 14, 'aria-hidden': true }),
    // 文案三档：有下拉或技能页降级 ⇒「添加技能」；专家/连接器 ⇒ 那一页自己的词。
    withMenu || mainAction === undefined ? ENTERPRISE_ESC_COPY.addSkill : mainAction.label,
  )
  /**
   * ★**口径 51**：主按钮此刻按不动时那句**行上可见**的原因（产品宪法：禁用不许只挂 `title`）。
   *
   * 三页共用这一档：技能页那条降级路径（没有下拉供给、又没有本机写入口）也一并补上——
   * 这一句是**可见文字**（`role="status"`），不是悬浮说明。
   */
  const actionLock = withMenu
    ? undefined
    : mainAction === undefined
      ? (onAddSkill === undefined ? ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted : undefined)
      : mainAction.lock
  /**
   * 下拉菜单本体的**纯投影**（`data-esc-add-skill-item` 与类别行同一手法：给门禁一个稳定的判据钩子）。
   *
   * 三项按 `ENTERPRISE_ESC_ADD_SKILL_ITEMS` 的顺序铺：查找技能 / 上传技能 / 创建技能。
   * 每一项：`disabled` 取那一项的锁，`onSelect` **各调各的动作**（三个 handler 互不相同，
   * 门禁在源码级锁住这一点）；上传那一项走的仍是口径 46 那枚本地导入写入口，**行为一字不改**。
   *
   * ★**只在技能页、且下拉供给在场时**才包 Menu —— 其余形态直接返回 `addSkillButton`（见上面那段）。
   */
  const addSkillMenuList = withMenu
    ? createElement(
        OfficialMenu,
        {
          open: menuOpen,
          anchor: addSkillButton,
          onClose: addSkillMenu!.onClose,
          // 卡片挂到 body 并用锚点矩形定位（与个人中心菜单同一条：.esc-content 的 overflow 裁不到它）；
          // 对齐方式 = 官方 `placement: 'bottom-end'` 那件事（右边缘与按钮右边缘对齐）。
          portal: true,
          align: 'end',
          side: 'bottom',
        },
        // 子节点显式给成**一枚数组**（不是可变参数）：`createElement` 的 children 允许是数组，
        // 而可变参数那一版在类型上要求每个入参都是 ReactNode —— 数组形态更稳。
        plans.map(plan =>
          createElement(OfficialMenuItemButton, {
            key: plan.key,
            onSelect: () => {
              if (plan.key === 'upload') {
                addSkillMenu!.onClose()
                onAddSkill?.()
                return
              }
              runDraft(plan.key)
            },
            disabled: plan.disabled,
            ...{ 'data-esc-add-skill-item': plan.key },
            icon: createElement(plan.key === 'upload' ? Upload : plan.key === 'find' ? Search : Plus, {
              size: 14,
              'aria-hidden': true,
            }),
            // ★禁用那一项渲染的是**带原因**的那一串（官方 MenuItemButton 不透传 title，见 plan 上方那段）。
            children: plan.text,
          }),
        ),
      )
    : addSkillButton
  /**
   * ★**用户裁决（读不到 ⇒ 0）**：计数位是不是**暂定值**。
   *
   * 两个子情形合成这一态：① 这一趟还没读回来（首帧）；② 这一趟读失败（`installedCountFailed`）。
   * 两种情形下数字位都画 `(0)`（与"真读到 0"同形，用户裁决的代价），并且**共用同一句**如实交代
   * （`installedCountUnreadable`）——首帧那一瞬确实也还没读到真值，同一句话不撒谎；
   * 而句子里"读不到"这三个字说的是**结果**，不是对失败的猜测。
   */
  const installedCountProvisional = installedCount === undefined || installedCountFailed === true
  const tabRow = createElement(
    'div',
    { className: 'esc-tabs-freeze' },
    createElement(
      'div',
      { className: 'esc-toolbar-row' },
      leading === undefined ? null : createElement('div', { className: 'esc-toolbar-leading' }, leading),
      createElement(
        'div',
        { className: 'esc-toolbar-right' },
        showMore === true
          ? createElement('a', {
              className:
                source === 'system' ? 'esc-more' : 'esc-more esc-more-hidden',
              // 用户裁决：「更多」超链接到公开技能广场（官方那枚跳的是 NUWAX 自己的广场分类页）
              href: ESC_RESOURCE_MORE_HREF,
              target: '_blank',
              rel: 'noreferrer noopener',
              title: ENTERPRISE_ESC_LOCAL_COPY.moreExternal,
              children: ENTERPRISE_ESC_COPY.more,
            })
          : null,
        createElement(Input, {
          className: 'esc-search',
          icon: createElement(Search, { size: 14, 'aria-hidden': true }),
          // ★口径 49：placeholder 随页变（三枚互不相同，取值只有 `enterpriseEscSearchPlaceholder` 一处）。
          placeholder: enterpriseEscSearchPlaceholder(resourceType),
          value: keyword,
          'aria-label': enterpriseEscSearchPlaceholder(resourceType),
          onChange: (event: { target: { value: string } }) => onKeywordChange(event.target.value),
        }),
        /* 两枚控件（workbuddy 顶栏右块）。
           ★口径 46/47 起它们**不再是死控件**：「添加技能」接本地导入（照商城那套机制），
             「已安装」切到已安装技能页。写入口缺席（纯函数直调 / 没有本机写面）时仍回到
             "看得见 + 有文案 + 有 title + 置灰"那一态 —— 判据就是 `onAddSkill` / `onOpenInstalled`
             在不在场，不再写死 `disabled`。
           ★**口径 49**：「已安装」原先**只在技能页渲染**。
           ★★**口径 56（用户决定，本刀）：连接器页**也画它**（用户原话「左侧增加**已安装**，
             参照技能页面」）——但两页不是同一枚东西，差别有三件，逐条写在下面那三处；
             **专家页仍整枚不渲染**（那一页没有这件东西，不凭空多一件"点不动的东西"）。
           ★**用户裁决（读不到 ⇒ 0）**：数字位**永远**画 `(N)`；`installedCount === undefined`
             （还没读回来 / 读失败）时画 `(0)`，与"真读到 0"**同形**（这个代价用户已明确接受）。
             代价由 `title` 兜住：那枚按钮仍**说得出**"这个数字是暂定的"（`installedCountUnreadable`）
             —— 同一个 `(0)`、两种状态靠 title 区分，**绝不静默吞掉"读不到"**。
             旧那枚橙色 `？` 连同它借用的 `categoriesUnavailable`（分类那句）一并撤下：`？` 的**真因**
             是已装清单读不到，而分类那一面当时是好的 —— 借那句话就是让按钮**指错原因**。 */
        resourceType === 'expert'
          ? null
          : createElement(
              'button',
              {
                type: 'button',
                className: 'esc-installed',
                /**
                 * ★**口径 56**：连接器页那枚**恒禁用**（不看端口）。
                 *
                 * 为什么不能看 `onOpenInstalled`：那枚按钮打开的是**技能**的已安装页，
                 * 而连接器页没有"已安装的连接器" 这件事（本部署连接器是**平台侧**的，
                 * 本机没有一份可数的落盘清单）⇒ 它恒缺一个真实的去处，
                 * 故**不能**因为页壳传了 `onOpenInstalled` 就把它放开（那会点进技能的已安装页）。
                 */
                disabled: resourceType === 'connector' || onOpenInstalled === undefined,
                onClick: resourceType === 'connector' ? undefined : onOpenInstalled,
                /* 四态 → 四句 title（**优先级：暂定 > 发现中 > 口没接 > 正常**）：
                   ① 计数暂定（`installedCountProvisional`）⇒ 说清"这个数是暂定的"；
                   ② 官方还没发现完（`installedCountDiscovering`，口径 54）⇒ "还在发现中，这个数字还会变"；
                   ③ 计数真读到、但开合口没接 ⇒ `actionNotPorted`；
                   ④ 都正常 ⇒ `installedFilterOpen`。
                   ★为什么①压过②③：那句话讲的是**按钮上正画着的那个数字**——让它被别的说法顶掉，
                     界面上就留了一个**没有任何交代的假 0**（本仓硬纪律不许静默吞"读不到"）。
                   ★为什么②压过③：同一个理由的另一半 —— 数字位画着的是**部分发现结果**，
                     "还没发现完"是关于这个数字的最重要的一件事实，口没接是次要的。
                     两条事实各自仍被单独锁着（口径 46/47 那组：计数读到 + 口缺席 ⇒ actionNotPorted）。 */
                title: resourceType === 'connector'
                  ? ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted
                  : installedCountProvisional
                    ? ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable
                    : installedCountDiscovering === true
                      ? ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering
                      : onOpenInstalled === undefined
                        ? ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted
                        : ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen,
              },
              createElement(Download, { size: 14, 'aria-hidden': true }),
              createElement('span', null, ENTERPRISE_ESC_COPY.installedFilter),
              /**
               * ★技能页：数字位**恒在**（"读不到与真 0 同形"那条代价的落点）—— 没有第二枚 `？`、
               *   也不再有一条"不显示数字"的分支存着。
               * ★★**口径 56**：连接器页**整格不画数字**（要么不带括号数、要么写「已安装」本身）。
               *   为什么：那个数是**技能**的数（官方发现面的技能快照），拿它冒充"连接器已装 N 枚"
               *   就是**拿另一件东西的数字撒谎**（比不给数字更坏）。
               */
              resourceType === 'connector'
                ? null
                : createElement('span', {
                    className: 'esc-installed-count',
                    children: `(${installedCount ?? 0})`,
                  }),
            ),
        /* ★口径 51：主按钮按不动时的**行上可见原因**（紧挨着那一枚，不是悬浮说明）。
           ★★**口径 56**：连接器页那枚「已安装」**也得有一句行上可见的原因**
           （它恒禁用）—— 产品宪法：禁用控件不许只挂一句 `title`。
           两句各自**只出一次**（同一句话在一行里说两遍就是噪音，且会把那一行撑长）。 */
        actionLock === undefined && resourceType !== 'connector'
          ? null
          : createElement('span', {
              className: 'esc-toolbar-lock',
              role: 'status',
              /*
               * 连接器页：主按钮与「已安装」**都**按不动，它们的原因同源（都是本部署缺这个能力）
               * ⇒ 只写一句（写两遍只会让人以为是两个不同的毛病）。
               */
              children: actionLock ?? ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted,
            }),
        // ★口径 49：那一枚主按钮（技能页 = 三项下拉的锚；专家/连接器页 = 直接点的一枚）。
        addSkillMenuList,
      ),
    ),
  )
  return [
    // ① 冻结头：三页签 + 右块那一行（桌面档 sticky，理由见本函数上方那段）
    tabRow,
    // ② 工具栏体：精选行 / 维度行 / 二级分类行（**整段随内容一起滚**）
    createElement(
      'div',
      { className: 'esc-toolbar' },
      // ★第二栏：「精选」那一行（用户裁决）
      belowLeading === undefined ? null : createElement('div', { className: 'esc-toolbar-second' }, belowLeading),
      // 维度标签（系统广场/团队空间/本地三方）—— **无背景**（用户裁决）
      createElement(
        'div',
        { className: 'esc-source-tabs' },
        sourceOptionsOf(resourceType).map(option =>
          createElement(
            Pill,
            {
              key: option.value,
              className: 'esc-pill',
              active: option.value === source,
              ...{ 'data-esc-selected': option.value === source },
              onClick: () => onSourceChange(option.value),
              // ★**口径 62**：第三枚只有四个字（「本地三方」），完整说法「本地三方 Agent 技能源」
              //   落在悬浮说明上（引文案表那一格真源，与页内说明句同一句话）。
              //   ★另两枚**不挂** title：它们各自的四个字已经说全了，凭空多一句悬浮说明只会让
              //     "哪一枚需要看说明"这件事失去信号（判据落在这里：只有第三枚带 title）。
              //   ★**口径 53（本刀）**：第四枚同判——「企业技能」四个字也读不出"从哪来、装什么"，
              //     故它也挂一句（引 `ENTERPRISE_ESC_LOCAL_COPY.catalogTabTitle` 那一格真源，
              //     与这一维度的页内说明句同源）。前两枚照旧不挂、第三枚的说明一字未改。
              //   ★**本刀 ③**：第四枚换成 `SkillHub` 之后同判 —— 一个英文专名更读不出"这是谁家的东西、
              //     我搜的是什么"，故它照旧挂一句（`skillHubTabTitle`，与页内说明句同源）。
              ...(option.value === 'third-party' ? { title: ENTERPRISE_ESC_LOCAL_COPY.thirdPartyTabTitle } : {}),
              ...(option.value === 'skillhub' ? { title: ENTERPRISE_ESC_LOCAL_COPY.skillHubTabTitle } : {}),
              children: option.label,
            },
          ),
        ),
      ),
      /* ★**口径 62（用户修正：二级 chip 行数据驱动）**：二级行的**唯一入口**是 `subTabs`
         （由页壳投影好交下来），它落在**与二级分类行同一排、同一套类名/token**上。

         ★为什么把它做成"一个 prop 两种来源"而不是给工具栏加第二种行：
           · 后端目录分类（专家/技能/连接器的平台分类树）与**数据驱动的 chip**（本机来源根、
             将来的市场来源）在**视觉上是同一排东西**（用户明确要求"同一个视觉语言"）；
           · 两处各写一排的后果是可预见的：两种选中态、两种"全部"文案、两套间距。
         ★`subTabs` **缺席**时逐字回到后端分类那一支（口径 31 起的老行为，专家/连接器页与本维度的
           兄弟维度都走它）——这是一条**降级路径**，不是"新老两套并存"。
         ★页壳给的是**已经投影好的** chip（`enterpriseThirdPartySubChips` → `enterpriseEscSubTabs`），
           工具栏**不认任何数据形状**：它只画一排胶囊，故下一个维度复用它时一个字都不用改这里。 */
      subTabs !== undefined
        ? EnterpriseEscSubTabRow({ chips: subTabs.chips, activeKey: subTabs.activeKey, onSelect: subTabs.onSelect })
        : categories.length > 0
          ? createElement(
              'div',
              { className: 'esc-category-tabs' },
              categories.map(item =>
                createElement(Pill, {
                  key: item.key === '' ? '__all__' : item.key,
                  className: 'esc-pill',
                  active: item.key === activeCategory,
                  ...{ 'data-esc-selected': item.key === activeCategory },
                  onClick: () => onCategoryChange(item.key),
                  children: item.label,
                }),
              ),
            )
          : null,
      categoriesUnavailable === true
        ? (subTabs === undefined
            ? createElement('div', {
                className: 'esc-toolbar-note',
                children: ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable,
              })
            : null)
        : null,
    ),
  ]
}

/**
 * 「更多」的原跳转地址（只用于置灰提示里的说明，不参与跳转）。
 *
 * 单独导出是为了让测试盯住"这条地址没被误接成跳转"——它是本文件唯一还在引用它的地方。
 */
export const ENTERPRISE_ESC_MORE_PATH = ESC_RESOURCE_MORE_SQUARE_PATH
