/**
 * [INPUT]: 依赖 React 的 createElement、lucide-react 的 `Plus`/`Download`/`Search`/`Upload`、官方原语 `Input`/`Pill`/`Button`（`@deepseek-ai/dsh-client-ui-primitives`）、`official-ui` 接缝给出的官方 `Menu`/`MenuItemButton`、`esc-constants` 的「更多」原地址、`esc-copy` 的文案与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscToolbar`——**两段并列**（① 冻结头：三页签 + 右块；② 工具栏体：精选/维度/二级分类）、三个纯投影（`enterpriseEscSearchPlaceholder` / `enterpriseEscAddSkillLock` / `ENTERPRISE_ESC_ADD_SKILL_ITEMS`）与 `ENTERPRISE_ESC_MORE_PATH`
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
 *      「自定义连接器」（开 **MCP 弹窗**），那两件事本仓还没有排期（用户裁决：等子页与 MCP 弹窗排期再改名）
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
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { Download, Plus, Search, Upload } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { ESC_RESOURCE_MORE_HREF, ESC_RESOURCE_MORE_SQUARE_PATH } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { OfficialMenu, OfficialMenuItemButton } from '../official-ui.js'
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
   * ★`undefined` 与 `0` 是两件事实：读不到就是读不到，界面出「已安装」不带计数并另缀一枚 `？`
   * （**不写0**——写0 等于对用户谎称「这台机器上一个技能都没装」）；读到空清单才真的是 0。
   * ★取值来自本仓**既有真值** `GET /skills/installed`，不是新接口。
   */
  readonly installedCount?: number | undefined
  /** 本机已装清单读不到时的可见说明（与 `installedCount === undefined` 同时给）。 */
  readonly installedCountFailed?: boolean | undefined
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
}

/**
 * 主 tab 选项（逐条照抄原文件的构造顺序与显隐口径：
 * 「已连接的」仅连接器页、「我启用的」仅技能页，其余两枚恒在）。
 */
function sourceOptionsOf(resourceType: ResourceTypeEnum): readonly { readonly label: string; readonly value: ResourceSourceEnum }[] {
  return [
    { label: ENTERPRISE_ESC_COPY.mainTabSystem, value: 'system' },
    { label: ENTERPRISE_ESC_COPY.mainTabTeam, value: 'team' },
    ...(resourceType === 'connector'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabConnected, value: 'connected' as const }]
      : []),
    ...(resourceType === 'skill'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabEnabled, value: 'enabled' as const }]
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
  keyword,
  onKeywordChange,
  showMore = true,
  categoriesUnavailable,
  installedCount,
  installedCountFailed,
  leading,
  belowLeading,
  onAddSkill,
  onOpenInstalled,
  onFindSkill,
  onCreateSkill,
  addSkillMenu,
  onSkillDraftFailure,
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
      // ★**口径 49 的形态**：技能/连接器页 = primary（黑胶囊）；专家页 = `esc-add-skill-outline`
      //   （白底描边，复用本页 `.esc-installed` 那条**既有**配方，不新造第二套白底按钮）。
      //   ★**文案暂不改**：三页都仍写「添加技能」——WorkBuddy 那两页分别是「我的专家」/「自定义连接器」，
      //   而它们在那边的行为是进子页 / 开 MCP 弹窗，我们这两页**还没有**那两件事（用户裁决：
      //   等"我的专家"子页与 MCP 弹窗排期再改名）。改了文案却不改行为就是让按钮说谎，故宁可暂缓。
      variant: resourceType === 'expert' ? 'outline' : 'primary',
      // 官方原语档位：`md` 给的是圆角/内衬的**基准**，高度另有 `.esc-add-skill` 的
      // `height: var(--esc-btn-h)` 真钉住（`min-height` 压不住官方 md 档的 `height: 36px` —— 上一轮就是这么没生效的）。
      size: 'md',
      className: resourceType === 'expert' ? 'esc-add-skill esc-add-skill-outline' : 'esc-add-skill',
      // ★口径 49：有下拉时按钮只开合菜单（不直接干上传那件事，连 `disabled` 都不写——
      //   锚点被禁用就点不开菜单，那是把整条新通路关死）；没有下拉时**逐字回到口径 46 那一态**
      //   （点击 = 本地导入，端口缺席即置灰 + 写明原因）——这就是那条不许退化的降级路径。
      ...(withMenu
        ? { onClick: addSkillMenu!.onToggle, 'aria-haspopup': 'menu' as const, 'aria-expanded': menuOpen }
        : {
            disabled: onAddSkill === undefined,
            onClick: onAddSkill,
          }),
      title: withMenu || onAddSkill !== undefined
        ? ENTERPRISE_ESC_LOCAL_COPY.addSkillLocalImport
        : ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted,
    },
    createElement(Plus, { size: 14, 'aria-hidden': true }),
    ENTERPRISE_ESC_COPY.addSkill,
  )
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
           ★**口径 49**：「已安装」**只在技能页渲染**——WorkBuddy 三页里只有技能页有这枚
             （专家/连接器页右块只有「搜索 + 主按钮」）。**整枚不渲染**（不是 disabled、不是
             visibility 隐藏）：那两页上它没有任何对应物，画一枚灰的等于凭空多一件"点不动的东西"。 */
        resourceType !== 'skill'
          ? null
          : createElement(
              'button',
              {
                type: 'button',
                className: 'esc-installed',
                disabled: onOpenInstalled === undefined,
                onClick: onOpenInstalled,
                title: onOpenInstalled === undefined
                  ? ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted
                  : ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen,
              },
              createElement(Download, { size: 14, 'aria-hidden': true }),
              createElement('span', null, ENTERPRISE_ESC_COPY.installedFilter),
              installedCount === undefined
                ? null
                : createElement('span', { className: 'esc-installed-count', children: `(${installedCount})` }),
              installedCountFailed === true
                ? createElement('span', {
                    className: 'esc-installed-failed',
                    role: 'status',
                    children: '？',
                    title: ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable,
                  })
                : null,
            ),
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
      // 维度标签（系统广场/团队空间/我启用的）—— **无背景**（用户裁决）
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
              children: option.label,
            },
          ),
        ),
      ),
      categories.length > 0
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
        ? createElement('div', {
            className: 'esc-toolbar-note',
            children: ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable,
          })
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
