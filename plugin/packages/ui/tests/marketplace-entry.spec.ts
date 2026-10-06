/**
 * [INPUT]: 依赖 marketplace-entry 的**唯一目录页外壳** `EnterpriseMarketLegacyShell`（点技能行本体在该视图内整页切换到**技能详情子页面** `EnterpriseSkillDetailPage`）、共享行子块 `EnterpriseMarketSkillRowActions`/`EnterpriseMarketInlineRows`、五个详情纯投影（`enterpriseSkillTreeRows`/`enterpriseSkillDefaultFilePath`/`enterpriseSkillFileCountText`/`enterpriseSkillTreeState`/`enterpriseSkillPreviewState`）、唯一 hook 入口 `EnterpriseMarketLegacyPage` 与共享逻辑层（`enterpriseMarketShellModel`、`enterpriseMarketSkillRowFacts`/`enterpriseMarketPluginRowFacts`）、注册常量、**页签真源**（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`）、组件清单/摘要/状态/开关语义纯投影、企业插件行投影、企业技能行投影（含详情归并的中心版本 `latestVersionId` 与标题行两枚标签取值）、标题行标签纯投影、技能节受管态纯投影、「有更新」判定与辅助标签投影、**组件页签折叠态常量** `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败行内提示投影、入口组件与版本签组件本身、页签文案计数投影，以及 local-api-decode 的 `EnterpriseRuntimeSkill`/`EnterpriseInstalledSkill`/`EnterpriseSkillFileEntry`/`EnterpriseInstalledSkillFile` 形状，以及 `client.tsx` 的 `apply`/`inject` 真注册面（最小 slots double）
 * [OUTPUT]: 验证入口身份常量、卡片一句话的单行约束、**page 视图的三页签结构**（页签条手写 `role="tablist"`、三个页签的 `aria-selected`/`aria-controls`/roving `tabIndex`/`id` 与三个 `role="tabpanel"` 的 `aria-labelledby` 严格配对、**默认选中「企业技能」**、切换后**只渲染该页签内容**、←/→/Home/End 走焦并选中、鼠标点击回调）、组件清单（插件/技能/配方）顺序与 reserved 语义、计数摘要口径、summary/page 两视图结构、版本签只对本条目 subject 出、企业插件页签的归并与门控，以及**企业技能页签的官方两行卡片**（标题 + 版本签 + 可选分类签、描述单行省略、右侧官方 `Switch`、开关左侧那枚辅助「有更新」标签）、受管态与「有更新」的独立判定、**两节行上的失败可见反馈**、**页签化后唯一剩下的组件节折叠**、**详情页顶部压缩的取值锁**、**类名隔离的源码级不变量**；**本刀（详情子页面 + 文件树）新增**：①「点行本体切到详情子页面、点动作永不触发」——两枚动作是行本体的同级兄弟、面包屑是唯一返回入口、`skillPage` 非空时列表/页签整段不挂载；②「框架逐项照官方详情页」——面包屑（可见文案 + `aria-label`）、`h3` 标题 + 版本徽标、等宽标识行（`skillId`）、描述、`detailSections`/`detailSection` 的结构与 CSS 取值（20/28-500、12/18-tertiary、28px/32px 间距、rotate(90deg) 的 chevron）；③「左文件树」——`enterpriseSkillTreeRows` 的层级投影（depth/parent/name、先序确定性排序）、目录行不是按钮而文件行是按钮、缩进取自 depth；④「默认选中并预览 SKILL.md」——`enterpriseSkillDefaultFilePath` 只在树里真有那条路径时才选它；⑤「未安装零请求」——`enterpriseSkillTreeState`/`enterpriseSkillPreviewState` 的未装态优先于任何 loading/失败、界面只说「安装后可浏览文件」；⑥「读取失败给稳定码 + 重试」与「预览是纯文本安全渲染（全文件无 `dangerouslySetInnerHTML`）」；⑦**弹层已彻底移除**的反向锁（源码无 `Modal`、无 `EnterpriseSkillDetailDialog`，任何函数调用都收不到 Modal 元素）；**本刀（版本签只显示版本）新增**：⑧ 纯投影 `enterpriseMarketSkillVersionLabel` 的短号规则与边界（5 个真实值 + 无 `@` / 多个 `@` / 仅 `@` / 尾部 `@` / 空串 / 不 trim 逐条锁死）；⑨ 行上签的**可见文案 = 短号**、**完整坐标挂在紧包它的 `.own-market-skillVersionHint` 的 `title` 上**（签本体确实在那枚节点里、正文里不再出现整串），详情页那枚徽标照旧整串显示（列表短号 / 详情全坐标）；⑩ 标题行结构快照与两套外壳共用 CSS 的长度/校验和按新结构**再基线化一次**（style 7840→8178 chars，校验和随之更新） **本刀（目录页签三态）**：新增八条——加载中不空白、空说清为什么空（不是失败）、失败带唯一提示组件 + 可用重试（点它真的调回调）、三态互斥只出一个 `data-market-list-state`、组件关闭仍整段不出现、次级降级一句 `role="status"` 且不遮行、无回调不给死按钮，并把取数 effect 的 `controller.abort()` 计数按新结构改为 2（目录取数搬进共享取数源）。 **本刀（资料库行）**：组件清单断言由三行改四行——「资料库」行顺序/标签/`gate='local'`、本机开关的「未开启 ↔ 可用」状态词与悬浮说明、写入口缺席/在途/写失败三种禁用口径（写失败不禁用）、计数摘要四段（含 `1 未开启`）、三个页签计数文案与组件页签行/开关数同步改 4，并新增 `enterpriseMarketComponentGate`/`enterpriseMarketComponentSwitchTitle` 的纯投影断言。 **本刀（企业标签）新增三条**：①「描述行」——`EnterpriseMarketSummaryLine` 的 children 恰好是 `[企业胶囊, ENTERPRISE_MARKET_SUMMARY]`、`textOf` = `企业 技能 · 配方`、正文与常量都不含「企业插件」（`enterpriseMarketEntrySummary()` 也照新值锁死）；②「详情徽章」——`BadgeView` 出**两枚** `own-market-tag`（第 1 枚「企业」`tone=info`、第 2 枚版本签 `tone=neutral`，位置与顺序逐项锁死），并用新助手 `collectOfficialTagProps`（按 `node.type === Tag` 取证，与 `domOutline` 的 `MOCK_PRIMITIVES` 同一套身份判定）断言「这枚徽章用的是官方 `Tag` **原语本体**、props 恰好只有 `{className,tone,children}`、`EnterpriseMarketBadgeTag()` 直调产出同一枚元素」，无版本时只剩企业徽章；③**反向锁「不新增 CSS 类」**——源码里 `.own-market-tag{` 只有一处声明、规则正文仍是 `flex:none;font-variant-numeric:tabular-nums`、整份 `<style>` 长度 10507 与 FNV-1a 校验和 3008014743 不变、被声明的类名集合里没有为徽章新造的名字。**本刀（企业标签移回标题行）**：用户两次指出「企业」必须在**标题行、标题后面**，故①描述行**回退**——`ENTERPRISE_MARKET_SUMMARY` 恢复 `'企业插件 · 技能 · 配方'`、`EnterpriseMarketSummaryLine` 的 children 恰好是一句纯文本、整行**零**官方 `Tag`（新增反向锁「描述行不再有胶囊」）；②列表标题行那一枚签由 `market-entry-badge.ts` 的 DOM 装饰负责，本文件只保留详情页 `BadgeView` 的企业徽章（该用例不动）。**新文件 `tests/market-entry-badge.spec.ts`** 覆盖 DOM 装饰：自造 domOutline 下「标题按钮 + titleRow」的定位与插入点、克隆官方「实验性」签实物（连哈希 `statusTag` 类一起）只换文本、官方行不被注入、幂等（同一条行只插一枚）、官方重渲染后重新铺、`dispose` 摘签 + 停观察、官方签不在场时退路 + warn、连样本都没有时不插 + warn、官方行标记不见时按 `data-plugin-panel`/`aria-busy` 区分静默与 warn、描述行 CSS 零新增。**本文件 68 条（描述行两条改写、条数不变），新文件另加 13 条（ui 包 425 → 438）。** **本刀（企业插件真取消）**：既有那条「失败前缀随动作走」的用例补一条 `action: 'cancel'` 断言（取消那一支**不给前缀**，见 `enterpriseMarketActionErrorLabel`），条数不变；样式两道字节级判据（长度 12028 / FNV-1a 校验和 2071534702）**一字未动**——取消按钮用的是官方 `Button` 原语，本文件与 `plugin-market.tsx` 都没新增任何 CSS 类。
 * **本刀（Codex 插件商店口径的目录卡片重构）**：① 页签条/搜索/筛选、七类分组 + 两列网格、两行卡片与
 *   「标题行零签」逐条锁定；② **行动作区不再用开关**——三条新助手把真 DOM 归一：
 *   `skillInstall`（未装那一格的官方「安装」按钮，按 `data-enterprise-skill-slot` 取）、
 *   `menuAction`（「⋯」里的项，按可见文案取；未接下拉宿主时按平铺渲染，两种形态都读得到）、
 *   `collectByClassName(…,'own-market-moreItem')`（整组项及其顺序）；③ 技能/插件/配方三处动作按
 *   「按真实能力给项」重写（技能 = 更新/卸载、插件 = 启用·停用(+非内置才有卸载)、配方 = 启用按钮 / 停用项），
 *   在途禁用、失败不禁用、以及「点动作不打开详情」的结构性保证全部保留；④ `domOutline` 把 Fragment
 *   当**透明**处理（`renderGrouped` 用 Fragment 铺行块，否则行子树会整段落进 `#opaque:`）；⑤ 两份结构大纲
 *   与共用 CSS 的长度/校验和按新结构**再基线化**（style 15215 → 18818、校验和 2453962714 → 2669689267），
 *   锁的形态（逐行大纲 + 长度 + FNV-1a）一字未改。**79 条（一条未删）。**
 *   **本刀（本地导入，+3 条）**：① 四项的**终态**逐项锁死（只有「本地导入」可点，其余三项恒「开发中」；
 *   写入口缺席时它**也**禁用——绝不出现「看着能点、点下去什么都不发生」的菜单项），真元素层再核一遍
 *   `disabled` 与「点它 = 先收起下拉、再打开选择器」；② 接线面缺席时**一枚元素都不画**，在场时那枚
 *   `<input type="file">` 的冻结属性（accept / 无障碍名 / 行内 `display:none`）与「选中即清空 value」
 *   逐条取证，三态反馈（进行中 / 成功 / 失败 + 真能点的「重新选择文件」）逐态落 DOM，且跨流码
 *   `ENT_SKILL_ARCHIVE_INVALID` 渲染出来的下一步**不是**「重新下载」；③ 三支视图都挂同一份 chrome
 *   （`{skillImportChrome}` 恰好三处）—— 源码级反向锁，少挂一支才会红。两份结构大纲各 +1 行（那枚选择器），
 *   `<style>` 长度与校验和**一字未动**（本刀零新增 CSS 类）。**92 条（一条未删）。**
 *   **本刀（系统搜索，+3 条）**：① 四项终态改成吃**接线对象**后逐项重锁（可点的是「系统搜索 + 本地导入」，
 *   另两项恒「开发中」；只接一项时只有那一项可点；写入口缺席时全部禁用；点那一项 = 先关下拉再走它自己的回调）；
 *   ② 结果面是**页内视图切换不是弹窗**（工具行/四个 tabpanel 整段不挂载、树里无 dialog role、源码里无
 *   `createPortal`、这一面只有一枚 `role="region"` + `tabIndex=-1` 的焦点落点、返回两条真路径与滚动还原的源码锁）；
 *   ③ 按根分组 + **两种空话**（根不存在 vs 根在但零候选，另加整体空话）+ 每条候选的标题/描述/三态中文/
 *   目录名那一句 + **只有可纳入才有按钮**（另两态在行上写清原因）+ 加载/失败（真重发）/在途（按钮禁用且
 *   原因可见）/成功/失败五条反馈，以及「成功与失败**都**重新盘点、界面从不自己把那条改成已装」的源码锁。
 *   两处既有计数按新结构更新：`{skillImportChrome}` 3 → 4（第四条分支）、`own-market-rows` 铺设点 3 → 4
 *   （结果面每个根一组）；三处互斥源码锁改成正则（锁的是那几步调用与顺序，不是缩进）。**95 条（一条未删）。**
 *   **本刀（通过 Agent 创建，+2 条）**：① 四项终态再扩一档（全部接上 ⇒ 只剩「在线搜索」灰着；逐项独立
 *   三例；真元素层点第①项 = 先关下拉再走它自己的回调）；② 那一段反馈的三态逐态落 DOM（空闲一枚都不画 /
 *   成功与「已复制」各一句 `role="status"` / 失败 = 唯一提示组件 + 一枚真能点的「复制这句指令」，
 *   且交回去的草稿与构造器产出的逐字相同），外加「**绝不新造第二个开会话端口**」的源码反向锁
 *   （`presetLaunch(` 恰好两处、文件里不出现 `openWorkspace`/`setDraft`）。**97 条（一条未删）。**
 *   **本刀（在线搜索，+3 条）**：① 四项终态**全部接通**后逐项锁「四项全可点、四行文案与整棵树里
 *   一个「（开发中）」都不剩」，并逐项独立（各只接一项时只有那一项可点）；② 结果面是**页内视图不是弹窗**
 *   （工具行/四个 tabpanel 整段不挂载、无 dialog role、面内源码无 portal、只有一枚 region 容器，
 *   且**查询框就在面内**：无障碍名/占位/受控值/输入回调/回车即搜），返回两条真路径 + 滚动还原的源码锁；
 *   ③ 逐源**两种坏消息分开说**（两个 kind、各带源名、`dropped` 那个数**照实渲染**）+ 每条结果的
 *   facts（来源恒有，作者/星标/安装量缺席不进那一句）+ 描述缺席不画 + 每行一枚【安装】（点它交回那条完整结果）
 *   + 查询三档 / 四态 / 安装四条反馈逐态落 DOM。**100 条（一条未删）。**
 * [POS]: dsh-ui 插件市场入口（唯一入口：官方插件页「插件市场」卡片）的产品词汇与交互门禁，真实渲染与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Fragment, isValidElement } from 'react'
import type { ReactNode } from 'react'
import { readFile, readdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { StateDot, Button, Switch, Tag, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseInstalledSkill, EnterpriseSkillFileEntry, EnterpriseRuntimeSkill } from '../src/local-api-decode.js'
import { apply, inject } from '../src/client.js'
// 插件详情子页面**原样复用**「企业设置 → 插件」那一份（本刀）：写法上与技能/配方详情同一条纪律——
// 纯组件本体与它的样式表都只在 `plugin-market.tsx` 里，本文件（以及这一面的代码）不复制第二份。
import {
  ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL,
  ENTERPRISE_PLUGIN_DETAIL_NOT_INSTALLED,
  ENTERPRISE_PLUGIN_DETAIL_PUBLISHER,
  ENTERPRISE_PLUGIN_DETAIL_TITLE,
} from '../src/plugin-market.js'
import type { EnterpriseOnlineSearchPageProps, EnterprisePluginPageProps, EnterpriseSystemSearchPageProps } from '../src/marketplace-entry.js'
import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_ARTWORK_ROW_SIZE,
  ENTERPRISE_MARKET_COMPONENTS,
  ENTERPRISE_MARKET_DEFAULT_EXPANDED,
  ENTERPRISE_MARKET_DISABLE_TEXT,
  ENTERPRISE_MARKET_ENABLE_TEXT,
  ENTERPRISE_MARKET_UNINSTALL_TEXT,
  ENTERPRISE_MARKET_DEFAULT_TAB,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  ENTERPRISE_MARKET_PLAN,
  ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
  ENTERPRISE_MARKET_SKILL_UPDATE_TAG,
  ENTERPRISE_MARKET_SUMMARY,
  ENTERPRISE_ARTWORK_HUE_COUNT,
  enterpriseArtworkHue,
  enterpriseArtworkInitial,
  ENTERPRISE_MARKET_TAB_IDS,
  ENTERPRISE_MARKET_TABLIST_LABEL,
  ENTERPRISE_MARKET_TABS,
  ENTERPRISE_DETAIL_ACTION_ADD_LABEL,
  ENTERPRISE_DETAIL_ACTION_REFRESH_LABEL,
  ENTERPRISE_ADD_MENU_DEVELOPING,
  ENTERPRISE_ADD_MENU_CREATE_ID,
  ENTERPRISE_ADD_MENU_IMPORT_ID,
  ENTERPRISE_ADD_MENU_ONLINE_ID,
  ENTERPRISE_ADD_MENU_SYSTEM_SEARCH_ID,
  EnterpriseSystemSearchPage,
  EnterpriseMarketCreateSkillNotice,
  EnterpriseOnlineSearchPage,
  EnterpriseMarketSkillImportNotice,
  enterpriseAddMenuEntries,
  enterpriseAddMenuEntryPlan,
  enterpriseAddMenuPlans,
  BadgeView,
  EnterpriseMarketBadge,
  EnterpriseMarketBadgeTag,
  EnterpriseMarketDetailActions,
  createEnterpriseMarketTabSeat,
  EnterpriseMarketInlineRows,
  EnterpriseMarketLegacyPage,
  EnterpriseMarketLegacyShell,
  EnterpriseMarketListHint,
  EnterpriseMarketDegradedNotice,
  EnterpriseMarketRowError,
  ENTERPRISE_MARKET_PLUGINS_EMPTY,
  ENTERPRISE_MARKET_PLUGINS_FAILED,
  ENTERPRISE_MARKET_PLUGINS_LOADING,
  ENTERPRISE_MARKET_SKILLS_EMPTY,
  ENTERPRISE_MARKET_SKILLS_FAILED,
  ENTERPRISE_MARKET_SKILLS_LOADING,
  createEnterpriseSkillCatalogSource,
  enterpriseMarketPanelState,
  loadEnterpriseSkillCatalog,
  EnterpriseMarketSkillRowActions,
  EnterpriseSkillDetailPage,
  ENTERPRISE_SKILL_CONTENT_FILENAME,
  ENTERPRISE_SKILL_DETAIL_BACK_LABEL,
  ENTERPRISE_SKILL_DETAIL_BACK_TEXT,
  ENTERPRISE_SKILL_DETAIL_FILES_TITLE,
  ENTERPRISE_SKILL_DETAIL_NAME_LABEL,
  ENTERPRISE_SKILL_DETAIL_NAME_TITLE,
  ENTERPRISE_SKILL_DETAIL_RETRY,
  ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL,
  ENTERPRISE_SKILL_DETAIL_SOURCE_TITLE,
  ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE,
  ENTERPRISE_SKILL_PREVIEW_EMPTY,
  ENTERPRISE_SKILL_PREVIEW_FAILED,
  ENTERPRISE_SKILL_PREVIEW_LOADING,
  ENTERPRISE_SKILL_PREVIEW_NONE,
  ENTERPRISE_SKILL_TREE_EMPTY,
  ENTERPRISE_SKILL_TREE_FAILED,
  ENTERPRISE_SKILL_TREE_LOADING,
  ENTERPRISE_SKILL_TREE_NOT_INSTALLED,
  enterpriseMarketComponentDot,
  enterpriseMarketComponentEnabled,
  enterpriseMarketComponentState,
  enterpriseMarketComponentSummary,
  enterpriseMarketComponentSummaryText,
  enterpriseMarketComponentSwitchDisabled,
  enterpriseMarketComponentSwitchTitle,
  enterpriseMarketComponentGate,
  enterpriseMarketEntryPlan,
  enterpriseMarketEntrySummary,
  enterpriseMarketActionErrorLabel,
  enterpriseMarketPluginConfigTag,
  enterpriseMarketPluginDetailBody,
  enterpriseMarketPluginDetailMarkdown,
  enterpriseMarketPluginRowFacts,
  enterpriseMarketPluginRows,
  enterpriseMarketPluginSectionVisible,
  enterpriseMarketPluginStatusLabel,
  enterpriseMarketRowDetailsId,
  enterpriseMarketRowKey,
  enterpriseMarketRowOpen,
  enterpriseMarketSectionOpen,
  enterpriseMarketShellModel,
  enterpriseMarketSkillCategoryTag,
  enterpriseMarketSkillConfigTag,
  enterpriseMarketSkillDot,
  enterpriseMarketSkillHasUpdate,
  enterpriseMarketSkillRowFacts,
  enterpriseMarketSkillRowHasUpdate,
  enterpriseMarketSkillRows,
  enterpriseMarketSkillSectionVisible,
  enterpriseMarketSkillState,
  enterpriseMarketSkillStatusLabel,
  enterpriseMarketSkillUpdateTag,
  enterpriseMarketSkillVersionTag,
  enterpriseMarketSkillVersionLabel,
  enterpriseMarketTabLabel,
  enterpriseMarketVersionTag,
  enterprisePluginDot,
  enterpriseSkillDefaultFilePath,
  enterpriseSkillFileCountText,
  enterpriseSkillPreviewState,
  enterpriseSkillTreeRows,
  enterpriseSkillTreeState,
  enterpriseSkillUpstreamNameNote,
  ENTERPRISE_MARKET_SECTION_IDS,
} from '../src/marketplace-entry.js'
// **本刀（本地导入）**：那条通路的**纯事实层**（上限 / accept / 三态 / 人话）——页面只画、判定全在它那儿。
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_INPUT_LABEL,
  ENTERPRISE_SKILL_IMPORT_MAX_BYTES,
  ENTERPRISE_SKILL_IMPORT_RESELECT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
  ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE,
  type EnterpriseSkillImportState,
} from '../src/skill-import.js'
// **本刀（系统搜索）**：结果面那一层的文案与纯投影（页面只画、判定都在 system-search.ts）。
import {
  ENTERPRISE_SYSTEM_ADOPT,
  ENTERPRISE_SYSTEM_ADOPT_FAILED_PREFIX,
  ENTERPRISE_SYSTEM_ADOPTING,
  ENTERPRISE_SYSTEM_BACK_LABEL,
  ENTERPRISE_SYSTEM_BACK_TEXT,
  ENTERPRISE_SYSTEM_CONFLICT_NOTE,
  ENTERPRISE_SYSTEM_DIRECTORY_PREFIX,
  ENTERPRISE_SYSTEM_EMPTY,
  ENTERPRISE_SYSTEM_LOADING,
  ENTERPRISE_SYSTEM_REFRESH,
  ENTERPRISE_SYSTEM_REFRESH_LABEL,
  ENTERPRISE_SYSTEM_REGISTERED_NOTE,
  ENTERPRISE_SYSTEM_ROOT_ABSENT,
  ENTERPRISE_SYSTEM_ROOT_EMPTY,
  ENTERPRISE_SYSTEM_SECTION_LABEL,
  ENTERPRISE_SYSTEM_STATE_AVAILABLE,
  ENTERPRISE_SYSTEM_TITLE,
  enterpriseSystemAdoptedText,
  enterpriseSystemAdoptingText,
} from '../src/system-search.js'
// **本刀（通过 Agent 创建）**：那一项的草稿、三段文案与三态反馈（页面只画、判定都在 skill-create.ts）。
import {
  ENTERPRISE_SKILL_CREATE_COPIED,
  ENTERPRISE_SKILL_CREATE_COPY,
  ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE,
  ENTERPRISE_SKILL_CREATE_COPY_LABEL,
  ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE,
  ENTERPRISE_SKILL_CREATE_OPENED,
  buildSkillCreateDraft,
} from '../src/skill-create.js'
// **本刀（在线搜索）**：那一面的文案与纯投影（页面只画、判定都在 online-search.ts）。
import {
  ENTERPRISE_ONLINE_AUTHOR_PREFIX,
  ENTERPRISE_ONLINE_BACK_LABEL,
  ENTERPRISE_ONLINE_BACK_TEXT,
  ENTERPRISE_ONLINE_EMPTY,
  ENTERPRISE_ONLINE_IDLE,
  ENTERPRISE_ONLINE_INSTALL,
  ENTERPRISE_ONLINE_INSTALLED,
  ENTERPRISE_ONLINE_INSTALLING,
  ENTERPRISE_ONLINE_INSTALLS_PREFIX,
  ENTERPRISE_ONLINE_INSTALL_FAILED_PREFIX,
  ENTERPRISE_ONLINE_LOADING,
  ENTERPRISE_ONLINE_QUERY_LABEL,
  ENTERPRISE_ONLINE_QUERY_PLACEHOLDER,
  ENTERPRISE_ONLINE_RESULTS_TITLE,
  ENTERPRISE_ONLINE_SEARCH,
  ENTERPRISE_ONLINE_SEARCH_LABEL,
  ENTERPRISE_ONLINE_SOURCE_PREFIX,
  ENTERPRISE_ONLINE_STARS_PREFIX,
  ENTERPRISE_ONLINE_TITLE,
  ENTERPRISE_ONLINE_TOO_SHORT,
  enterpriseOnlineCountText,
  enterpriseOnlineInstalledText,
  enterpriseOnlineInstallingText,
  enterpriseOnlineReadyText,
} from '../src/online-search.js'
// 列表失败态那两枚共享常量（结果面的重试按钮就用这一份，不另写一句「重试」）。
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL } from '../src/list-state.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
}))

/** 收集元素树里的可见文本，跳过 style 内容，用于无 DOM 断言页面结构。 */
function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return ''
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 两套外壳的共享子块（页签条 / 面板 / 组件节 / HERO / 行内失败提示）是**真函数组件**：
    // 它们的 children 由自己产出，必须先就地渲染一次才看得到文本；`vi.fn()` mock（Tag/Switch/StateDot）
    // 产出 undefined，退回读它的 children（否则 `v0.1.0` 这类标签文本会丢）。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return textOf(rendered as ReactNode)
  }
  return textOf(node.props.children as ReactNode)
}

/**
 * **当前**旧外壳产出快照：DOM 大纲（技能页签 / 企业插件页签）+ `<style>` 文本的长度与 FNV-1a 校验和。
 *
 * 锁的是「目录页此刻的真实结构」：页签条 + 搜索/筛选行、七类分组（组标题 + 下方分割线）、
 * 两列卡片网格里的**两行卡片**（标题行只有标题、第二行是描述或状态词），以及行上的动作区——
 * **本刀（卡片操作区不再用开关）**：未装是「安装」按钮、已装是「⋯」子块（未接下拉宿主时按**平铺**渲染，
 * 故大纲里是 `span.own-market-moreInline` + 若干 `button.own-market-moreItem`）。
 * 行块由 `renderGrouped`（Fragment）铺出，故 `domOutline` 把 Fragment 也当**透明**处理——
 * 否则行子树会整段落在 `#opaque:Symbol(react.fragment)` 后面、这份快照就白锁了。
 * 任何人再改行结构/类名/属性/顺序或那份 CSS，这里都会立刻显形。
 *
 * **本刀（本地导入）再基线化一次**：`<style>` 之后多一枚**恒不可见**的文件选择器（那份 chrome 挂在页面级，
 * 三支视图都挂）。变化**只有这一行**：`style(...)` 的长度与 FNV-1a 校验和**一字未动**（CSS 零新增类，
 * 那枚 input 用行内 `display:none` 收起），锁的形态（逐行大纲 + 长度 + 校验和）也一字未改。
 */
const LEGACY_SHELL_OUTLINE: readonly string[] = [
  "section[className=own-market-entry][aria-label=插件市场]",
  "  style(38597 chars)",
  // **本刀（本地导入）**加的这一行：接线面在场时那份 `<style>` 之后紧跟一枚**恒不可见**的文件选择器
  //（行内 `display:none`，零新增 CSS 类 ⇒ `<style>` 长度与校验和一字未动）。空闲态（`state === undefined`）
  // **不出**任何反馈，故整份大纲只多这一行；三种状态下的反馈另有专门用例逐条锁。
  "  input[type=file][accept=.dshskill,application/vnd.dsh.skill+zip,application/zip][aria-label=选择要导入的技能包文件][style=[object Object]][onChange=[fn]]",
  "  div[className=own-market-searchRow]",
  "    div[role=tablist][aria-label=企业市场][className=own-market-storeTabs]",
  "      button[id=market-tab-skills][type=button][role=tab][className=own-market-storeTab][aria-selected=true][aria-controls=market-panel-skills][tabIndex=0][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:技能 1",
  "      button[id=market-tab-plugins][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-plugins][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:插件 2",
  "      button[id=market-tab-presets][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-presets][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:配方 0",
  "      button[id=market-tab-components][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-components][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:组件 4",
  "    span[className=own-market-rowBarSpacer][aria-hidden=true]",
  "    span[className=own-market-query]",
  "      #opaque:[object Object]",
  "      input[type=search][className=own-market-queryInput][aria-label=搜索][placeholder=搜索技能、插件、配方][value=][readOnly=true][onChange=[fn]]",
  "    div[className=own-market-filterWrap]",
  "      button[type=button][className=own-market-filterBtn][aria-label=筛选][aria-expanded=false][onClick=[fn]]",
  "        #opaque:[object Object]",
  "  div[id=market-panel-skills][role=tabpanel][aria-labelledby=market-tab-skills][hidden=false][className=own-market-panel]",
  "    section[className=own-market-section][data-market-section=enterprise-skills]",
  "      section[className=own-market-categoryGroup][data-enterprise-market-group=其他]",
  "        h4[className=own-market-categoryTitle]",
  "          #text:其他",
  "        ul[className=own-market-rows]",
  "          li[className=own-market-row][data-enterprise-skill-package=1902500000000000001][data-enterprise-skill-id=meeting-notes][data-enterprise-skill-state=UPDATE_AVAILABLE]",
  "            div[className=own-market-rowLine]",
  "              button[type=button][className=own-market-rowOpen][data-enterprise-skill-open=1902500000000000001][aria-label=查看企业技能 会议纪要技能组 详情][disabled=true][title=详情入口未接通][onClick=[fn]]",
  "                span[className=own-market-rowIcon]",
  "                  svg[width=30][height=30][viewBox=0 0 36 36][fill=none][xmlns=http://www.w3.org/2000/svg][aria-hidden=true]",
  "                    text[x=18][y=18][textAnchor=middle][dominantBaseline=central][fontSize=19][fontWeight=600][fill=url(#ARTIFACT-ID)]",
  "                      #text:会",
  "                    defs",
  "                      linearGradient[id=ARTIFACT-ID][x1=4][y1=4][x2=32][y2=32][gradientUnits=userSpaceOnUse]",
  "                        stop[stopColor=var(--dsw-static-green-400)]",
  "                        stop[offset=1][stopColor=var(--dsw-static-green-500)]",
  "                div[className=own-market-rowMain]",
  "                  span[className=own-market-cardHead]",
  "                    span[className=own-market-cardId own-market-skillTitle]",
  "                      #text:会议纪要技能组",
  "                  span[className=own-market-cardDesc]",
  "                    #text:把会议录音与转写整理成结构化纪要。",
  "              span[className=own-market-moreInline]",
  "                button[type=button][className=own-market-moreItem][disabled=false][title=点此更新到中心当前版本][onClick=[fn]]",
  "                  #text:有更新",
  "                button[type=button][className=own-market-moreItem][disabled=false][title=从本机卸载这份技能][onClick=[fn]]",
  "                  #text:卸载",
  "            div[className=own-market-inlineError][role=alert]",
  "              span[className=own-error-message][style=[object Object]]",
  "                #text:安装失败：更新包校验没有通过。",
  "              span[className=own-error-action][style=[object Object]]",
  "                #text:下一步：",
  "                #text:请重新检查更新；仍然失败请联系企业管理员。",
  "              details[className=own-error-tech][style=[object Object]][data-enterprise-error-tech=ENT_ARTIFACT_INTEGRITY_FAILED]",
  "                summary[style=[object Object]]",
  "                  #text:技术信息",
  "                code[style=[object Object]][data-enterprise-error-code=ENT_ARTIFACT_INTEGRITY_FAILED]",
  "                  #text:ENT_ARTIFACT_INTEGRITY_FAILED",
  "  div[id=market-panel-plugins][role=tabpanel][aria-labelledby=market-tab-plugins][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-presets][role=tabpanel][aria-labelledby=market-tab-presets][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-components][role=tabpanel][aria-labelledby=market-tab-components][hidden=true][className=own-market-panel]",
]
/**
 * 企业插件页签那份大纲（同一份 `domOutline`）：插件行 = 图标 + 两行文案 + 官方状态词 + 动作区
 *（已装 ⇒ 「⋯」；**内置项不给卸载**，非内置项才多那一项）。
 */
const LEGACY_PLUGINS_OUTLINE: readonly string[] = [
  "section[className=own-market-entry][aria-label=插件市场]",
  "  style(38597 chars)",
  // 同一行文件选择器（三支视图共用同一份 chrome；插件页签这一份没有插件详情在场，故不挂第二份样式表）。
  "  input[type=file][accept=.dshskill,application/vnd.dsh.skill+zip,application/zip][aria-label=选择要导入的技能包文件][style=[object Object]][onChange=[fn]]",
  "  div[className=own-market-searchRow]",
  "    div[role=tablist][aria-label=企业市场][className=own-market-storeTabs]",
  "      button[id=market-tab-skills][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-skills][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:技能 1",
  "      button[id=market-tab-plugins][type=button][role=tab][className=own-market-storeTab][aria-selected=true][aria-controls=market-panel-plugins][tabIndex=0][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:插件 2",
  "      button[id=market-tab-presets][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-presets][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:配方 0",
  "      button[id=market-tab-components][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-components][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "        #text:组件 4",
  "    span[className=own-market-rowBarSpacer][aria-hidden=true]",
  "    span[className=own-market-query]",
  "      #opaque:[object Object]",
  "      input[type=search][className=own-market-queryInput][aria-label=搜索][placeholder=搜索技能、插件、配方][value=][readOnly=true][onChange=[fn]]",
  "    div[className=own-market-filterWrap]",
  "      button[type=button][className=own-market-filterBtn][aria-label=筛选][aria-expanded=false][onClick=[fn]]",
  "        #opaque:[object Object]",
  "  div[id=market-panel-skills][role=tabpanel][aria-labelledby=market-tab-skills][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-plugins][role=tabpanel][aria-labelledby=market-tab-plugins][hidden=false][className=own-market-panel]",
  "    section[className=own-market-section][data-market-section=enterprise-plugins]",
  "      div[data-enterprise-plugin-region=list]",
  "        section[className=own-market-categoryGroup][data-enterprise-market-group=其他]",
  "          h4[className=own-market-categoryTitle]",
  "            #text:其他",
  "          ul[className=own-market-rows]",
  "            li[className=own-market-row][data-enterprise-plugin-package=ent-a][data-enterprise-plugin-state=ACTIVE]",
  "              div[className=own-market-rowLine]",
  "                button[type=button][className=own-market-rowOpen][data-enterprise-plugin-open=ent-a][aria-label=查看企业插件 ent-a 详情][disabled=true][title=详情入口未接通][onClick=[fn]]",
  "                  span[className=own-market-rowIcon]",
  "                    svg[width=30][height=30][viewBox=0 0 36 36][fill=none][xmlns=http://www.w3.org/2000/svg][aria-hidden=true]",
  "                      text[x=18][y=18][textAnchor=middle][dominantBaseline=central][fontSize=19][fontWeight=600][fill=url(#ARTIFACT-ID)]",
  "                        #text:E",
  "                      defs",
  "                        linearGradient[id=ARTIFACT-ID][x1=4][y1=4][x2=32][y2=32][gradientUnits=userSpaceOnUse]",
  "                          stop[stopColor=var(--dsw-static-red-400)]",
  "                          stop[offset=1][stopColor=var(--dsw-static-red-600)]",
  "                  div[className=own-market-rowMain]",
  "                    span[className=own-market-cardHead]",
  "                      span[className=own-market-cardId own-market-skillTitle]",
  "                        #text:ent-a",
  "                    span[className=own-market-cardDesc]",
  "                      #text:企业插件分发的示例描述。",
  "                span[className=own-market-rowState]",
  "                  StateDot[state=done]",
  "                  #text:已安装 · 已启用",
  "                span[className=own-market-moreInline]",
  "                  button[type=button][className=own-market-moreItem][disabled=false][title=点此停用][onClick=[fn]]",
  "                    #text:停用",
  "              div[className=own-market-inlineError][role=alert]",
  "                span[className=own-error-message][style=[object Object]]",
  "                  #text:卸载失败：企业插件的信任配置不可用。",
  "                span[className=own-error-action][style=[object Object]]",
  "                  #text:下一步：",
  "                  #text:请联系企业管理员。",
  "                details[className=own-error-tech][style=[object Object]][data-enterprise-error-tech=ENT_PLUGIN_SIGNATURE_INVALID]",
  "                  summary[style=[object Object]]",
  "                    #text:技术信息",
  "                  code[style=[object Object]][data-enterprise-error-code=ENT_PLUGIN_SIGNATURE_INVALID]",
  "                    #text:ENT_PLUGIN_SIGNATURE_INVALID",
  "            li[className=own-market-row][data-enterprise-plugin-package=ent-b][data-enterprise-plugin-state=FAILED]",
  "              div[className=own-market-rowLine]",
  "                button[type=button][className=own-market-rowOpen][data-enterprise-plugin-open=ent-b][aria-label=查看企业插件 ent-b 详情][disabled=true][title=详情入口未接通][onClick=[fn]]",
  "                  span[className=own-market-rowIcon]",
  "                    svg[width=30][height=30][viewBox=0 0 36 36][fill=none][xmlns=http://www.w3.org/2000/svg][aria-hidden=true]",
  "                      text[x=18][y=18][textAnchor=middle][dominantBaseline=central][fontSize=19][fontWeight=600][fill=url(#ARTIFACT-ID)]",
  "                        #text:E",
  "                      defs",
  "                        linearGradient[id=ARTIFACT-ID][x1=4][y1=4][x2=32][y2=32][gradientUnits=userSpaceOnUse]",
  "                          stop[stopColor=var(--dsw-static-deepseek-400)]",
  "                          stop[offset=1][stopColor=var(--dsw-static-deepseek-600)]",
  "                  div[className=own-market-rowMain]",
  "                    span[className=own-market-cardHead]",
  "                      span[className=own-market-cardId own-market-skillTitle]",
  "                        #text:ent-b",
  "                    span[className=own-market-cardDesc]",
  "                      #text:已不在企业目录中",
  "                span[className=own-market-rowState]",
  "                  StateDot[state=error]",
  "                  #text:处理失败",
  "                span[className=own-market-moreInline]",
  "                  button[type=button][className=own-market-moreItem][disabled=false][title=点此停用][onClick=[fn]]",
  "                    #text:停用",
  "                  button[type=button][className=own-market-moreItem][disabled=true][title=从本机卸载这枚插件][onClick=[fn]]",
  "                    #text:卸载",
  "  div[id=market-panel-presets][role=tabpanel][aria-labelledby=market-tab-presets][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-components][role=tabpanel][aria-labelledby=market-tab-components][hidden=true][className=own-market-panel]",
]
/**
 * 两套外壳共用那份 CSS（`baseStyles` + `rowStyles`）的**字节级基线**。
 *
 * **本刀（企业插件安装的动态过程效果）再基线化一次：10507 → 12028 chars、校验和 3008014743 → 2071534702。**
 * 这是**再基线化，不是放宽判据**：锁的形态一字未改（仍然是「长度 + FNV-1a 校验和」两道，
 * 上面两处大纲里的 `style(N chars)` 也照旧逐字锁着）——只为这一刀真的新增了一份动画 CSS 而把基线推到新值：
 *   · `.own-market-progress` / `.own-market-progressFlow`(+`::after`) / `.own-market-progressText` /
 *     `.own-market-progressNote` / `.own-market-progressSettled` 与 `@keyframes own-market-progress-flow`；
 *   · 以及一条 `@media (prefers-reduced-motion:reduce)`（关掉滑动、改成静态淡色）。
 * 「安装中」那一条进度只在真的在装时才进 DOM，故两份结构大纲的**行部分一字未动**，
 * 变的只有 `<style>` 的长度那一行（`style(10507 chars)` → `style(12028 chars)`）。
 * 任何人再改这份 CSS（不管是加装饰还是删规则）都会在这里立刻显形。
 *
 * **本刀（搜索行降到官方 Input 那一档 + 框线变浅 + 上下层次）再基线化一次：
 * 20843 → 22299 chars、校验和 1320448966 → 351544358。**
 * 同样**只推基线、不放宽判据**（仍是上面那两道 + 两处大纲的 `style(N chars)`，锁的形态一字未改）。
 * 这一刀 CSS 有三处变动，逐条记清，否则后人无从复核：
 *   · **＋**：隐藏官方详情页那枚 48×48 图标的规则（`[data-plugin-item-detail] [class*="_detailHead"]
 *     [class*="_cardIcon"]`）**从 `detailStyles` 挪进了 `baseStyles`**。它服务的是**列表视图**那个分支的
 *     官方 `ItemDetail`，而 `detailStyles` 只在技能/配方详情子页面挂载 —— 寄居在那边等于**规则不在图标
 *     真正出现的那页面上**（真机验收「图标没消失」即栽在这里；选择器本身是对的）。
 *   · **－**：`.own-market-rowIcon[data-icon-kind=…]` 四条按类别上色的 static 规则**整组删除**
 *     （官方兜底图形自带青蓝渐变，再上色会与渐变打架；每张卡都挂同一个「企业」标识本就零信息量），
 *     容器改回中性色。
 *   · **搜索行**：搜索框与漏斗钮整行降到官方 `Input.module.css` 那一档（`height:32px` / `padding:0 8px` /
 *     `border-radius:8px` / `font-size:14px`，边框 `0.5px solid var(--dsw-alias-border-l4)`），
 *     并把「工具行 → 内容区」的间距收成**单点**（见下面 ⑤）。
 * ★ 兜底图形**尺寸 18 → 30**（官方 `ROW_ARTWORK_SIZE`：40px 框里放 30px 图形）**不动 CSS**，
 *   只动 SVG 的 width/height，故不进这两道基线 —— 它由「derives each row icon from the item id…」
 *   那条用例（task-17 ② 改名，原名 `gives every row the official fallback artwork…`）按
 *   「40 框 + 30 图形」这个配比单独锁死。
 * ★ 详情那份 CSS（baseStyles + rowStyles + detailStyles）随之也变了，但**没有任何常量锁它的字节数**，
 *   故本刀不必为它单独立基线（`EnterpriseSkillDetailPage` 那些用例按类名逐条断言，不按字节数）。
 * ★ 反向锁在「keeps the rule that hides the official detail icon in the list-view stylesheet」那条用例里：
 *   它直接锁「**这份** CSS 必须含那条规则」，比锁某张表的否定更贴近真实需求。
 *
 * **本刀（刷新/添加同行 + 移动端四页签/搜索/筛选适配 + 工具行搜索框右对齐）再基线化一次：
 * 26747 → 29717 chars、校验和 4237248219 → 1049969647。**
 * 同样**只推基线、不放宽判据**（仍是「长度 + FNV-1a 校验和」两道，上面两份大纲里的
 * `style(N chars)` 那两行也照旧逐字锁着）——本刀 CSS 有四处变动，逐条记清，否则后人无从复核：
 *   · **改**：`.own-market-titleActions` 由只有 `margin-left:auto` 一条声明，改成
 *     `display:flex;align-items:center;gap:8px;flex:none;margin-left:auto`（缺陷①：两枚按钮必须同行，
 *     三处事实链与算术见源文件该规则上方的注释）。**这条是桌面可见的**。
 *   · **＋**：一条 `@media (max-width: 560px){…}`（缺陷②：移动端四页签 + 搜索框 + 筛选钮），
 *     内含 `.own-market-searchRow` / `.own-market-storeTabs` / `.own-market-query` /
 *     `.own-market-rowBarSpacer` 四条**既有类名**的窄屏取值。**一个新 CSS 类都没加**，
 *     且四条规定只在这一条查询里 ⇒ 桌面（≥1024px）逐字节不生效。
 *   · **＋**：两处纯注释（本刀的口径与算术说明，零声明）。
 * ★ **本刀（task-15：非移动端搜索右对齐）动了 DOM**：列表工具行里那枚
 *   `<span className="own-market-rowBarSpacer">` 由「搜索框**之后**」上移到「搜索框**之前**」——
 *   `.own-market-query` 是 `flex:0 1 320px`（不 grow），占位原先住在它右边 ⇒ 空白吃在搜索框右侧、
 *   搜索框紧贴页签（用户报的现象）；上移后空白吃在左侧 ⇒「搜索框 320px + 筛选钮 32px」整组贴行右。
 *   故两份大纲里那行 spacer **随之上移一行**（**行内容一字未改**，只换了它与 query 块的先后），
 *   且两处 `style(29602 chars)` → `style(29717 chars)`。
 *   ⇒ 这两项**都是再基线化、不是放宽判据**：锁的形态（逐行大纲 + 长度 + FNV-1a 两道）一字未改。
 * ★ **本刀（task-16：把窄屏算术锁从「假锁」改成真锁）**：CSS **声明一条都没动**（四页签 / 搜索框 /
 *   筛选钮的窄屏取值、断点 560px、overflow-x:auto 全部原样），只改了两处**注释里的算术**：
 *   ① 源里那段窄屏说明的宽度模型（含计数文本、逐枚文案、212 是**下界**的纠正）；
 *   ② 本条注释本身。注释也是 `baseStyles` 的字节 ⇒ `style(29717 chars)` → `style(30488 chars)`、
 *   FNV-1a 校验和随之再基线化（29717/1049969647 → 30488/3379417455）。
 *   两份大纲里那两行 `style(N chars)` 同步改数 —— **仍是再基线化，不是放宽判据**。
 * ★ **本刀（task-17：行网格断点 560→900 + 逐条目派生图标 + 副标题顺序）**：CSS **真声明只改了一条**
 *   （`.own-market-rows` 那条单列回落的断点值 560 → 900，见源里那条带完整算术推导的注释）；
 *   另加了两处**注释**。⇒ `style(30488 chars)` → `style(32819 chars)`、
 *   FNV-1a 校验和 3379417455 → 2122687982（**再基线化，不是放宽判据**）。
 *   两份大纲**结构上各多一行**：图标由官方那枚 `path` 换成「首字母 `text` + 它的 `#text` 子节点」
 *   （每处 +1 行），而 `svg`/`defs`/`linearGradient`/两枚 `stop` 这五行的**形态一字未改**，
 *   只把两枚 `stopColor` 从写死的 `#54ECE7`/`#658EFF` 换成逐条目派生的既有 token 引用；
 *   `linearGradient` 的几何由竖直线段（x1=x2=15.1481）改成对角铺（4,4 → 32,32）。
 *   锁的形态（逐行大纲 + 长度 + FNV-1a 两道）一字未改。
 * ★ **本刀（task-19：列表纵向节奏与官方逐像素一致）**：CSS **真声明改了 7 条取值**
 *   （`.own-market-rows` 基准档 `gap:28px 48px`→`gap:12px 48px`、≤900px 档补 `gap:2px 0`、
 *   `.own-market-row` 内衬 `10px 12px`→`8px 12px`、`.own-market-rowIcon` `40px`→`48px`、
 *   `.own-market-rowMain` `gap:2px`→`4px`、`.own-market-cardId` `line-height:1.4`→`20px`、
 *   `.own-market-cardDesc` `line-height:1.55`→`18px`）＋两处注释。⇒
 *   `style(32819 chars)` → `style(34025 chars)`、FNV-1a 校验和 2122687982 → **2926950019**
 *   （**再基线化，不是放宽判据**）。★ 两份大纲这次**只动了 `style(N chars)` 那一行**：
 *   图标容器 40→48 只改 CSS，**渲染出的 `<svg>` 仍是 `width=30`**（`ROW_ARTWORK_SIZE` 未动）
 *   ⇒ 大纲的节点结构一行未变。
 * ★ **本刀（task-20：页头节奏收口）**：CSS **真声明改了 7 处**——`① 页签条改官方分段胶囊`
 *   （`.own-market-storeTabs` 由 flex 改 `display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr`
 *   + `padding:3px`→`2px` + 背景由 alias-background-secondary 换官方轨道填充 alias-interactive-bg-hover；
 *   `.own-market-storeTab` 由 `padding:5px 12px` 改 `height:28px;padding:0 16px;border-radius:999px`
 *   + inline-flex 居中；选中态的 box-shadow 由 lv1 改官方 `--dsw-elevation-soft`）、
 *   `② 工具行断点 560px → 600px`、`③ .own-market-entry 加 margin-top:-16px`（E）、
 *   `④⑤ 新增两条 :has() 作用域的官方 detailHead/detailMain 覆盖`（C+D）。
 *   ⇒ `style(34025 chars)` → `style(38113 chars)`、FNV-1a 校验和 2926950019 → **1011282763**
 *   （**再基线化，不是放宽判据**）。★ 两份大纲**仍只动 `style(N chars)` 那一行**：A 改的是官方
 *   `Button` 的 props（测试里是 `vi.fn()`，不进大纲），B/C/D/E 全是 CSS ⇒ 节点结构一行未变。
 * ★ **本刀（task-20 收口：隐藏官方图标那条也加闸门）**：本文件原先唯一一条**裸命中**官方 detail 类的
 *   规则——隐藏官方 48×48 图标的 `[data-plugin-item-detail] [class*="_detailHead"] [class*="_cardIcon"]`
 *   ——锚点也挂上 `:has(...own-market-entry...)` 闸门（与 C/D 同一条、同一个锚点）⇒ 本文件里**再无**
 *   任何会命中**其它 item 详情**的官方类覆盖（那条 `bare` 断言现为**空列表**）。同刀把添加钮里的
 *   `ChevronDown` 12→13（与同钮的 `Plus` 对齐；它是 props、不进基线）。⇒ `style(38113 chars)` →
 *   `style(38471 chars)`、FNV-1a 校验和 1011282763 → **298844786**（**再基线化，不是放宽判据**）；
 *   两份大纲**仍只动 `style(N chars)` 那一行**。
 * ★ **本刀（task-21：深色主题下的「白底白字」根因修复 + 窄屏行距）**：真机截图（深色主题）暴露六处
 *   「浅色填充 + 随主题翻转的字色」⇒ 白字压白、字看不见。**根因不是间距，是一批本版 DSH 根本不定义
 *   的 alias token 名**（`grep -rl dsw-alias-background-primary <整个 DSH 安装>` 一处都没有）——
 *   `var(...,#fff)` 的**兜底值**在生效，浅色主题下恰好对、深色主题下全错。逐处照官方对应面取**成对**
 *   token：选中页签 ← 官方分段控件指示块（`bg-layer-1` + `label-primary`）、授权弹层 ← 官方 `Modal`
 *   （`bg-layer-2`）、两个下拉菜单 ← 官方弹出面（`menu-surface-fill`）、筛选项 hover ← 与同族
 *   `moreItem:hover` 对齐（`interactive-bg-hover`）。同刀把窄屏换行形态的 `row-gap` 由 **0 改成 8px**
 *   （并**更正**旧注释里「8px 会叠在 margin-bottom 上、底距变 28px」那条**错误结论**：flex 的 row-gap
 *   只在两条线之间插入，最后一条线之后不加 ⇒ 底距恒为 20px）。⇒ `style(38471 chars)` → `style(38520 chars)`、
 *   FNV-1a 校验和 298844786 → **913835772**（**再基线化，不是放宽判据**）；两份大纲**仍只动
 *   `style(N chars)` 那一行**。
 * ★ **同刀第三次更正（安装/启用按钮）**：浅色真机截图暴露它是**灰底** —— 我上一版把它照 `.toolbar`
 *   变体填了 `button-tool-bar-fill`：token 名**是对的**、色也随主题翻，但**档位错了**：它根本不是
 *   工具栏按钮，而是官方**普通按钮的 `outline` 档**（三处调用都是 `variant="outline"`，官方
 *   `.outline{background:transparent;border:0.5px solid var(--dsw-alias-border-l3)}` 在浅色卡片上
 *   **本来就是白底黑字 + 一条浅描边**）。⇒ 正解是把那三条覆盖**整条删掉**，这个类完全交回官方
 *   （由反向锁守着：本文件 CSS 里**查无该规则**）。⇒ `style(38520 chars)` → `style(38605 chars)`、
 *   FNV-1a 校验和 913835772 → **2310043017**（**再基线化，不是放宽判据**）；两份大纲**仍只动
 *   `style(N chars)` 那一行**。
 * ★ **复审整改（在线/系统搜索两面的审查）**：搜索框 `.own-market-query` 的底色也是那枚**本版 DSH
 *   不存在**的 token（`background-primary` ⇒ 兜底 `#fff` 恒白 ⇒ 深色下就是一块白），按官方 Input 所在的
 *   面取 `bg-layer-1`（与本页选中页签**同一枚**，浅色下仍是白）。⇒ `style(38605 chars)` → `style(38597 chars)`、
 *   FNV-1a 校验和 2310043017 → **3703247831**（**再基线化，不是放宽判据**）；两份大纲**仍只动
 *   `style(N chars)` 那一行**。本刀其余改动全在 JSX 与别名文案上，CSS 只动这一处（-8 字符 = 换掉那个
 *   更长的 token 名本身），故长度差额可逐字对上。
 *   ★ 同一根因的**另外两处仍未动**（`.own-market-rowIcon` 的白底、`.own-market-addMenu` 的
 *   `--dsw-specific-menu`）：那两处各自挂着一句**用户口径**（「图标白底不透明」「添加技能下拉白底」），
 *   换 token 等于在深色下推翻它们 ⇒ 留给「8 个失效 token 名 / 约 70 处」那一趟统一裁决。
 *   ★ DOM 换位只发生在**列表工具行**；在线搜索面那一行是独立 DOM（子项 = 查询框 + spacer + 按钮，
 *   无 `.own-market-filterWrap`），本刀**一字未动**，由专门用例逐子项锁住（D2）。
 *   任何人再改这份 CSS（加装饰或删规则）都会在这里、以及那两处 `style(N chars)` 上立刻显形。
 */
const LEGACY_STYLE_LENGTH = 38597
const LEGACY_STYLE_CHECKSUM = 3703247831

/** 「企业技能」节的目录 fixture：与 skill-market.spec 的列表投影同形（列表态 versionId/skills 为空）。 */
const SKILL: EnterpriseRuntimeSkill = {
  id: '1902500000000000001',
  skillId: 'meeting-notes',
  displayName: '会议纪要技能组',
  description: '把会议录音与转写整理成结构化纪要。',
  sourceDshVersion: '0.1.7-rc.2',
  sizeBytes: 40_960,
  skillCount: 2,
  updatedAt: '2026-09-30T08:00:00Z',
  versionId: '',
  skills: [],
}

/**
 * 中心**详情**投影 fixture：与列表投影同形，但 `versionId` 是真值、`skills` 有条目
 * （`skill-api-decode` 的列表解码把 `versionId` 写死为空串，只有 `/skills/{id}` 详情带真值）。
 */
const SKILL_DETAIL: EnterpriseRuntimeSkill = {
  ...SKILL,
  versionId: '1902500000000000101',
  skills: [{ name: 'meeting-notes', description: '把会议记录整理成结构化纪要', modelInvocable: true, userInvocable: true }],
}

/** 带中心当前版本的行（= hook 入口把详情按 id 归并后的形态）。 */
function updatableRow(): ReturnType<typeof enterpriseMarketSkillRows>[number] {
  return enterpriseMarketSkillRows([SKILL], [SKILL_DETAIL])[0]!
}

/**
 * 带可选分类的目录行 fixture：分类签取值同源（列表投影的 `category`）。
 * 分类是服务端**新增**字段——这里只用于验证「有分类就出一枚签」，缺席时的安静缺席另有用例。
 */
const SKILL_WITH_CATEGORY: EnterpriseRuntimeSkill = { ...SKILL, category: '研发工具' }

/** 已装记录 fixture（Host 回传的落盘真值）：命中 `packageId` 即该行开关 `checked`。 */
function installedSkill(versionId: string, id: string = SKILL.id): EnterpriseInstalledSkill {
  return {
    packageId: id,
    skillId: SKILL.skillId,
    displayName: SKILL.displayName,
    versionId,
    sha256: 'a'.repeat(64),
    names: ['meeting-notes'],
    installedAt: '2026-09-30T08:00:00Z',
  }
}

/**
 * **唯一目录页外壳**（`plugins.item` 的 page 视图 = 官方插件页「插件市场」卡片点进去那一页）。
 *
 * 来历：这里原先是「旧外观 / 新外观」两行表（侧栏「应用商店」那条入口用另一套外观）。用户撤回独立应用商店后，
 * 唯一入口只剩官方插件页这一条，两套外观随之收敛成**一棵外壳 + 一枚行子块**，本表也就只剩一行——
 * 保留「表 + 逐个跑」的形状是为了让「语义类断言逐条覆盖到外壳上」这件事仍然逐项显式。
 */
const MARKET_SHELLS = [
  {
    label: '目录页（plugins.item 详情页）',
    shell: EnterpriseMarketLegacyShell,
    listClass: 'own-market-rows',
    titleClass: 'own-market-cardId',
    descClass: 'own-market-cardDesc',
  },
] as const

/** 外壳 props 形状（`Parameters` 直接从外壳签名取，避免测试自造第二份类型）。 */
type ShellProps = Parameters<typeof EnterpriseMarketLegacyShell>[0]

/** 同一组输入喂给外壳表，返回「外壳名 → 树」的逐项表，供语义类断言逐个跑。 */
function renderShells(props: ShellProps): readonly (typeof MARKET_SHELLS[number] & { readonly tree: ReactNode })[] {
  return MARKET_SHELLS.map(entry => ({ ...entry, tree: entry.shell(props) }))
}

/** 商业化字样黑名单：两套外壳的全树文本与样式文本都不许出现（旧新都不做买卖）。 */
const BANNED_COMMERCIAL_WORDS = ['价格', '¥', '购买', '购物车', '客服', '付款', '支付', '下单', '优惠', '折扣', '交易', '续费', '订阅费'] as const

describe('enterprise marketplace entry', () => {
  it('occupies one plugins.item id after the four official configuration cards', () => {
    expect(ENTERPRISE_MARKET_ENTRY_ID).toBe('plugin-market')
    expect(ENTERPRISE_MARKET_ENTRY_LABEL).toBe('插件市场')
    expect(ENTERPRISE_MARKET_ENTRY_ORDER).toBeGreaterThan(40)
  })

  it('keeps the summary a single line because the official page renders it twice', () => {
    const summary = enterpriseMarketEntrySummary()
    expect(summary).toBe(ENTERPRISE_MARKET_SUMMARY)
    expect(summary.trim()).toBe(summary)
    expect(summary).not.toContain('\n')
    expect(summary.length).toBeGreaterThan(0)
    // **本刀（企业标签移回标题行）**：描述行**恢复**成完整的「企业插件 · 技能 · 配方」——
    // 用户两次指出标签必须在标题行，故描述行不再承载「企业」二字之外的任何胶囊。
    // **本刀（task-17 ③）**：三个词**只换顺序**，与页签真源 `ENTERPRISE_MARKET_TABS` 的
    // 「技能 · 插件 · 配方 · 组件」同序 ⇒ 现在是「技能 · 企业插件 · 配方」。
    expect(summary).toBe('技能 · 企业插件 · 配方')
    expect(summary).toContain('企业插件')
    // 顺序与页签同源（本刀的核心判据）：逐词在页签文案里的**先后位次**必须一致。
    const orderOf = (word: string): number => summary.indexOf(word)
    expect(orderOf('技能')).toBeLessThan(orderOf('企业插件'))
    expect(orderOf('企业插件')).toBeLessThan(orderOf('配方'))
    // ★ 反向锁：**「组件」不许进这句话**（组件是台账不是目录，与页签第四枚无关）。
    expect(summary).not.toContain('组件')
    // 「企业」标签（文案常量）不再以胶囊身份出现在描述行；描述行的「企业插件」是一个整词。
    expect(ENTERPRISE_MARKET_BADGE_TEXT).toBe('企业')
  })

  it('renders the description line as the plain 技能 · 企业插件 · 配方 text, with no tag on it at all', () => {
    // 描述行 = 官方 `plugins.item` 的 `summary` 视图（官方把它渲染在列表卡描述与详情页正文两处）。
    for (const { label, shell } of MARKET_SHELLS) {
      const summary = shell({ view: 'summary' })
      expect(isValidElement(summary), label).toBe(true)
      // 外壳返回的是那枚**函数组件元素**，按测试既有手法就地调一次拿到真正的那行 `<span>`。
      const outer = summary as unknown as { type: (props: unknown) => ReactNode; props: unknown }
      const line = outer.type(outer.props) as { props: { className?: string; children?: ReactNode } }
      expect(line.props.className, label).toBe('own-market-entry-summary')
      // **反向锁**：描述行里一枚官方 `Tag` 都没有（胶囊已按用户裁决搬去标题行）。
      expect(collectOfficialTagProps(summary), label).toHaveLength(0)
      expect(collectByClassName(summary, 'own-market-tag'), label).toHaveLength(0)
      expect(line.props.children, label).toBe(ENTERPRISE_MARKET_SUMMARY)
      const text = textOf(summary)
      expect(text, label).toBe(ENTERPRISE_MARKET_SUMMARY)
      expect(text, label).toContain('企业插件')
    }
  })

  it('lists the page tabs as 插件/技能/配方 with 配方 the only reserved tab', () => {
    const plan = enterpriseMarketEntryPlan()
    expect(plan).toBe(ENTERPRISE_MARKET_PLAN)
    expect(plan.map(tab => tab.id)).toEqual(['plugins', 'skills', 'presets'])
    expect(plan.map(tab => tab.label)).toEqual(['插件', '技能', '配方'])
    expect(plan.slice(0, 2).map(tab => tab.note)).not.toContain('预留')
    expect(plan[1].note).toBe('已排期')
    expect(plan[2].note).toBe('预留')
  })

  it('renders the single-line summary for the card and the three-tab store page for the detail view', () => {
    // 两套外壳都必须有「summary 一句话 + page 三页签」这两面：逐个跑。
    for (const { label, shell } of MARKET_SHELLS) {
      const summary = shell({ view: 'summary' })
      expect(isValidElement(summary), label).toBe(true)
      // **本刀（企业标签移回标题行）**：描述行恢复纯文本（不再有「企业」胶囊）。
      expect(textOf(summary), label).toBe(ENTERPRISE_MARKET_SUMMARY)

      const page = shell({ view: 'page' })
      expect(isValidElement(page), label).toBe(true)
      expect(isValidElement(page) ? page.props['aria-label'] : undefined, label).toBe(ENTERPRISE_MARKET_ENTRY_LABEL)
      // page 视图 = 一条页签条 + 三个面板；页签文案 = 基础词 + 计数（无数据时技能/插件/配方为 0、
      // 组件恒为清单长度 4）——计数原先独占一行，现在并入页签（顶部压缩）。
      const text = textOf(page)
      for (const tab of ENTERPRISE_MARKET_TABS) expect(text, label).toContain(tab.label)
      expect(text, label).toContain(enterpriseMarketTabLabel('技能', 0))
      expect(text, label).toContain(enterpriseMarketTabLabel('插件', 0))
      expect(text, label).toContain(enterpriseMarketTabLabel('组件', ENTERPRISE_MARKET_COMPONENTS.length))
      // 卡片摘要仍只出现在 summary 视图（page 里一个字都不重复）。
      expect(text, label).not.toContain(ENTERPRISE_MARKET_SUMMARY)
    }
  })

  // 本刀的核心：page 视图顶部一条手写页签条，四个页签 + 四个面板严格配对，默认选中「技能」。
  // **本刀（企业配方页签）**：页签由三枚改四枚——「配方」插在**插件之后、组件之前**（用户指定的位次）。
  // **本刀（页签改名）**：四名逐字为 技能 / 插件 / 配方 / 组件，**不带「企业」前缀**。
  it('renders a hand-written tablist with the four page tabs and 技能 selected by default', () => {
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'presets', 'components'])
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label)).toEqual(['技能', '插件', '配方', '组件'])
    // 位次锁：配方在插件之后、组件之前（不是追加在末尾、也不是复用旧「应用商店」那批 id）。
    // **改名后的新锁**：页签不再带「企业」前缀，也不再用「包含内容」那类降维长名
    // （「企业」二字由标题行的徽章承担，页签再带一遍是噪音）。
    for (const tab of ENTERPRISE_MARKET_TABS) {
      expect(tab.label, tab.id).not.toContain('企业')
      expect(tab.label, tab.id).not.toContain('包含')
    }
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id).indexOf('presets')).toBeGreaterThan(ENTERPRISE_MARKET_TABS.map(tab => tab.id).indexOf('plugins'))
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id).indexOf('presets')).toBeLessThan(ENTERPRISE_MARKET_TABS.map(tab => tab.id).indexOf('components'))
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(ENTERPRISE_MARKET_TABS[0]?.id).toBe(ENTERPRISE_MARKET_DEFAULT_TAB)

    // 页签条是两套外壳**共用**的一份渲染，故两套都要过同一组 aria/计数/roving 断言。
    for (const { label, shell } of MARKET_SHELLS) {
      const page = shell({ view: 'page' })
      // 容器：手写 tablist（官方 SegmentedTabs 在编译期 pin 的 primitives 0.1.5-rc.2 里不存在，不许 import）。
      const tablists = collectByRole(page, 'tablist')
      expect(tablists, label).toHaveLength(1)
      expect(tablists[0]?.['aria-label'], label).toBe(ENTERPRISE_MARKET_TABLIST_LABEL)
      const tabs = collectByRole(page, 'tab')
      // 页签文案 = 基础词 + 紧凑计数（技能/插件/配方无目录时如实为 0，组件 = 清单长度 4）：
      // 原先两节内部的独立计数行已删，数字并入页签（详情页顶部少一行）。
      expect(tabs.map(tab => tab['children']), label).toEqual(['技能 0', '插件 0', '配方 0', '组件 4'])
      expect(tabs.map(tab => tab['children']), label).toEqual(ENTERPRISE_MARKET_TABS.map(tab => enterpriseMarketTabLabel(
        tab.label,
        tab.id === 'components' ? ENTERPRISE_MARKET_COMPONENTS.length : 0,
      )))
      // 默认选中 + roving tabIndex（只有当前页签可 Tab 到，其余靠方向键）。
      expect(tabs.map(tab => tab['aria-selected']), label).toEqual([true, false, false, false])
      expect(tabs.map(tab => tab['tabIndex']), label).toEqual([0, -1, -1, -1])
    }
  })

  // 本刀（用户裁决 A：4 个页签放到标题右侧）：页签的渲染位置由**座位是否注入**决定——
  // 注入 ⇒ 页面这一层不画页签、由官方 `plugins.detail.actions` 槽那一格渲染；不注入 ⇒ 留在页面里
  // （外壳自包含的默认形态）。两处**绝不并存**，故任何时刻全页只有一个 `tablist`。
  // ★ **本刀的排版口径（用户逐字）**：「搜索栏，左侧是 4 个标签，右侧是搜索栏和筛选按钮」+
  //   「把刷新和添加按钮放到标题行右侧，右对齐」。⇒ **页签在工具行左端**（不再看 `tabsInTitle`），
  //   **标题行只出刷新 + 「添加技能」两枚**（页签不在标题行）。两处绝不并存，全页只有一个 `tablist`。
  it('keeps the four page tabs in the tool row (left) and moves the two action buttons to the title slot', () => {
    const props = { view: 'page' as const, sessionUsable: true }
    const model = enterpriseMarketShellModel(props)
    // ① 工具行左端恒有四枚页签（**与 `tabsInTitle` 无关** —— 页签真源就在这一行）。
    const bare = EnterpriseMarketLegacyShell(props)
    const rowTabs = collectByRole(bare, 'tab')
    expect(rowTabs.map(tab => tab['children'])).toEqual(['技能 0', '插件 0', '配方 0', '组件 4'])
    expect(rowTabs.map(tab => tab['aria-selected'])).toEqual([true, false, false, false])
    // ② 注入座位（宿主传 `tabsInTitle`）时**页签数量不变** —— 仍只有这一处，不长第二份。
    const seated = EnterpriseMarketLegacyShell({ ...props, tabsInTitle: true })
    expect(collectByRole(seated, 'tab')).toHaveLength(4)
    // ③ 标题行那一格：**零枚页签**（页签已搬去工具行），只出刷新 + 「添加技能」两枚动作。
    const slot = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: model.tabEntries, activeTab: model.activeTab, onSelect: undefined },
    })
    expect(collectByRole(slot, 'tab')).toEqual([])
    expect(collectByRole(slot, 'tablist')).toEqual([])
    const slotActions = collectOfficialButtonProps(slot)
    expect(slotActions.map(props => props['aria-label']))
      .toEqual([ENTERPRISE_DETAIL_ACTION_REFRESH_LABEL, ENTERPRISE_DETAIL_ACTION_ADD_LABEL])
    // 标题槽这两枚动作**右对齐**（用户口径）：包在 margin-left:auto 的容器里。
    expect(collectByClassName(slot, 'own-market-titleActions')).toHaveLength(1)
    // 非本条目 subject 仍然一律 null（槽是 root 级、三种详情页都会渲染，过滤口径不变）。
    expect(EnterpriseMarketDetailActions({ subject: { kind: 'item', id: 'bash' } })).toBeNull()
    // ④ 座位源：**签名没变不通知**（页面每帧都发布，不设这道闸就会自激重渲染）；变了才通知；退订即静默。
    const seat = createEnterpriseMarketTabSeat()
    let notified = 0
    const off = seat.subscribe(() => { notified += 1 })
    const state = { entries: model.tabEntries, activeTab: model.activeTab, onSelect: undefined }
    seat.publish(state)
    seat.publish({ ...state })
    expect(notified).toBe(1)
    seat.publish({ ...state, activeTab: 'plugins' })
    expect(notified).toBe(2)
    off()
    seat.publish({ ...state, activeTab: 'presets' })
    expect(notified).toBe(2)
  })

  it('pairs every tab with its tabpanel and mounts only the selected panel content', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    // 三页签的 aria 四向配对与「只有当前页签挂载内容」是两套外壳共用的语义：逐个外壳 × 逐个页签跑。
    for (const { label: shellLabel, shell } of MARKET_SHELLS) {
    for (const tab of ENTERPRISE_MARKET_TABS) {
      const where = `${shellLabel} / ${tab.id}`
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        activeTab: tab.id,
        enterpriseSkills,
        enterprisePlugins: enterprisePlugins as never,
      })
      const ids = ENTERPRISE_MARKET_TAB_IDS[tab.id]
      const tabs = collectByRole(tree, 'tab')
      // 页签 id ↔ aria-controls ↔ 面板 id ↔ 面板 aria-labelledby 四处同源，且只有当前页签是选中态。
      expect(tabs.map(node => node['id']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.tab,
        ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
        ENTERPRISE_MARKET_TAB_IDS.presets.tab,
        ENTERPRISE_MARKET_TAB_IDS.components.tab,
      ])
      expect(tabs.map(node => node['aria-controls']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.panel,
        ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
        ENTERPRISE_MARKET_TAB_IDS.presets.panel,
        ENTERPRISE_MARKET_TAB_IDS.components.panel,
      ])
      expect(tabs.filter(node => node['aria-selected'] === true).map(node => node['id']), where).toEqual([ids.tab])
      const panels = collectByRole(tree, 'tabpanel')
      expect(panels.map(node => node['id']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.panel,
        ENTERPRISE_MARKET_TAB_IDS.plugins.panel,
        ENTERPRISE_MARKET_TAB_IDS.presets.panel,
        ENTERPRISE_MARKET_TAB_IDS.components.panel,
      ])
      expect(panels.map(node => node['aria-labelledby']), where).toEqual([
        ENTERPRISE_MARKET_TAB_IDS.skills.tab,
        ENTERPRISE_MARKET_TAB_IDS.plugins.tab,
        ENTERPRISE_MARKET_TAB_IDS.presets.tab,
        ENTERPRISE_MARKET_TAB_IDS.components.tab,
      ])
      // 每个 aria-controls 都能解析到一个真实面板；非当前页签的面板 hidden，且**内容整段不挂载**。
      for (const node of tabs) expect(panels.some(panel => panel['id'] === node['aria-controls']), where).toBe(true)
      expect(panels.filter(panel => panel['hidden'] === true).map(panel => panel['id']), where)
        .toEqual(panels.filter(panel => panel['id'] !== ids.panel).map(panel => panel['id']))
      const text = textOf(tree)
      if (tab.id === 'skills') {
        expect(text, where).toContain('会议纪要技能组')
        expect(text, where).not.toContain('内容清单')
        expect(text, where).not.toContain('ent-a')
      } else if (tab.id === 'plugins') {
        expect(text, where).toContain('ent-a')
        expect(text, where).not.toContain('会议纪要技能组')
        expect(text, where).not.toContain('内容清单')
      } else if (tab.id === 'presets') {
        // 这一组 props 没给配方目录（`enterprisePresets` 缺席 = 空目录）：门控不过 ⇒ 内容整段不挂载，
        // 页签条上只剩「配方 0」。配方行本身另有专门用例（preset 那一条）。
        expect(text, where).toContain(enterpriseMarketTabLabel('配方', 0))
        expect(text, where).not.toContain('会议纪要技能组')
        expect(text, where).not.toContain('ent-a')
        expect(text, where).not.toContain('内容清单')
      } else {
        expect(text, where).toContain('内容清单')
        expect(text, where).not.toContain('会议纪要技能组')
        expect(text, where).not.toContain('ent-a')
      }
    }
    }
  })

  it('switches the active tab from clicks and from the arrow/home/end keys', () => {
    // 页签键盘/点击契约在共用渲染里，两套外壳必须逐项一致。
    for (const { label, shell } of MARKET_SHELLS) {
      const onSelectTab = vi.fn()
      const tree = shell({ view: 'page', onSelectTab })
      const tabs = collectButtonProps(tree).filter(button => button['role'] === 'tab')
      expect(tabs, label).toHaveLength(4)
      // 点击：四个页签各自把 (tabId) 交回调用方。
      for (const [index, tab] of ENTERPRISE_MARKET_TABS.entries()) {
        tabs[index]?.['onClick']?.()
        expect(onSelectTab, label).toHaveBeenLastCalledWith(tab.id)
      }
      // 键盘：←/→ 循环、Home/End 跳首尾；都是「走焦 + 选中」一步到位，且拦住默认滚动。
      const press = (index: number, key: string): { preventDefault: () => void } => {
        const event = { key, preventDefault: vi.fn(), currentTarget: null }
        tabs[index]?.['onKeyDown']?.(event)
        return event
      }
      expect(press(0, 'ArrowRight').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('plugins')
      // 新增的第三枚页签照样落在 ←/→ 的循环路径上（配方：从企业插件往右一步就是它）。
      expect(press(1, 'ArrowRight').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('presets')
      expect(press(0, 'ArrowLeft').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('components')
      expect(press(3, 'ArrowRight').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('skills')
      expect(press(2, 'ArrowLeft').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('plugins')
      expect(press(2, 'Home').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('skills')
      expect(press(0, 'End').preventDefault, label).toHaveBeenCalled()
      expect(onSelectTab, label).toHaveBeenLastCalledWith('components')
      // 其余键不拦、不改选中（Tab / Enter / 空格交给浏览器与 onClick）。
      const ignored = press(0, 'Tab')
      expect(ignored.preventDefault, label).not.toHaveBeenCalled()
      const calls = onSelectTab.mock.calls.length
      press(0, 'Enter')
      expect(onSelectTab.mock.calls.length, label).toBe(calls)
    }
  })

  it('lists exactly four delivered components (no reserved row) with only 资料库 on the local gate', () => {
    expect(ENTERPRISE_MARKET_COMPONENTS.map(row => row.id)).toEqual(['plugins', 'skills', 'presets', 'library'])
    expect(ENTERPRISE_MARKET_COMPONENTS.map(row => row.label)).toEqual(['插件', '技能', '配方', '资料库'])
    // **本刀（企业配方页签）**：配方随「企业配方页签」一起交付，故**四行一个预留都没有**——
    // 「包含内容」页签不许再对着一个已经在商店里能用的页签说「预留」。
    expect(ENTERPRISE_MARKET_COMPONENTS.filter(row => row.reserved).map(row => row.id)).toEqual([])
    expect(ENTERPRISE_MARKET_COMPONENTS[0]?.reserved).toBe(false)
    expect(ENTERPRISE_MARKET_COMPONENTS[1]?.reserved).toBe(false)
    expect(ENTERPRISE_MARKET_COMPONENTS[2]?.reserved).toBe(false)
    // 资料库**不是预留**：它是可开关的功能，开关落在**本机设置**（`gate === 'local'`）；
    // 插件/技能/配方三行仍是企业会话口径（`gate === 'session'`）——配方行的门控与另两个目录页签同一条。
    expect(ENTERPRISE_MARKET_COMPONENTS.find(row => row.id === 'library')?.reserved).toBe(false)
    expect(ENTERPRISE_MARKET_COMPONENTS.filter(row => row.gate === 'local').map(row => row.id)).toEqual(['library'])
    expect(ENTERPRISE_MARKET_COMPONENTS.filter(row => row.gate === 'session').map(row => row.id)).toEqual(['plugins', 'skills', 'presets'])
    expect(enterpriseMarketComponentGate('library')).toBe('local')
    expect(enterpriseMarketComponentGate('presets')).toBe('session')
    expect(enterpriseMarketComponentGate('nope')).toBeUndefined()
  })

  it('keeps the 资料库 row on the local gate: default off, no login needed, writable without a session', () => {
    // 默认关：未拨动时是「未开启」而不是「需登录」（它根本不需要登录）。
    expect(enterpriseMarketComponentEnabled('library', false)).toBe(false)
    expect(enterpriseMarketComponentEnabled('library', true)).toBe(false)
    expect(enterpriseMarketComponentState('library', false)).toBe('未开启')
    expect(enterpriseMarketComponentState('library', false, true)).toBe('可用')
    expect(enterpriseMarketComponentDot('library', false, true)).toBe('done')
    expect(enterpriseMarketComponentDot('library', false)).toBe('idle')
    // 可拨性与登录态无关：有写入口就能拨（未登录也能拨）；没有写入口恒禁用（不给死开关）。
    expect(enterpriseMarketComponentSwitchDisabled('library', false, false, false, true)).toBe(false)
    expect(enterpriseMarketComponentSwitchDisabled('library', false, false, false, false)).toBe(true)
    // 写入在途禁用（官方 Switch 口径：在途不许连点），但**写失败后不禁用**（再拨一次就是重试）。
    expect(enterpriseMarketComponentSwitchDisabled('library', false, false, true, true, true)).toBe(true)
    expect(enterpriseMarketComponentSwitchDisabled('library', false, false, true, true, false)).toBe(false)
    // 悬浮说明与状态同源：关着说「打开后左侧会出现」，开着说「可在左侧进入」，在途说「正在保存」。
    expect(enterpriseMarketComponentSwitchTitle('library', false)).toBe('打开后左侧会出现「资料库」入口')
    expect(enterpriseMarketComponentSwitchTitle('library', false, true)).toBe('资料库入口已打开，可在左侧进入')
    expect(enterpriseMarketComponentSwitchTitle('library', false, true, true)).toBe('正在保存到本机设置')
  })

  it('derives per-component enablement, state, dot, and switch discipline from session usability', () => {
    // 插件/技能行同口径：未登录 → 不可用/需登录/idle/可拨动（有回调时），已登录 → 可用/可用/done/禁用（防假切换）。
    for (const id of ['plugins', 'skills'] as const) {
      expect(enterpriseMarketComponentEnabled(id, false)).toBe(false)
      expect(enterpriseMarketComponentState(id, false)).toBe('需登录')
      expect(enterpriseMarketComponentDot(id, false)).toBe('idle')
      expect(enterpriseMarketComponentSwitchDisabled(id, false, true)).toBe(false)
      expect(enterpriseMarketComponentEnabled(id, true)).toBe(true)
      expect(enterpriseMarketComponentState(id, true)).toBe('可用')
      expect(enterpriseMarketComponentDot(id, true)).toBe('done')
      expect(enterpriseMarketComponentSwitchDisabled(id, true, true)).toBe(true)
    }
    // 配方行（本刀改口径）：与插件/技能行**同一条**会话口径——未登录不可用/需登录、登录后可用/禁用那枚开关
    // （它已经不预留了：配方以「企业配方」页签在商店里交付）。
    for (const id of ['presets'] as const) {
      expect(enterpriseMarketComponentEnabled(id, false)).toBe(false)
      expect(enterpriseMarketComponentState(id, false)).toBe('需登录')
      expect(enterpriseMarketComponentDot(id, false)).toBe('idle')
      expect(enterpriseMarketComponentSwitchDisabled(id, false, true)).toBe(false)
      expect(enterpriseMarketComponentEnabled(id, true)).toBe(true)
      expect(enterpriseMarketComponentState(id, true)).toBe('可用')
      expect(enterpriseMarketComponentDot(id, true)).toBe('done')
      expect(enterpriseMarketComponentSwitchDisabled(id, true, true)).toBe(true)
    }
    // 无登录回调时：插件/技能/**配方**行开关也禁用（不提供假切换入口）。
    expect(enterpriseMarketComponentSwitchDisabled('plugins', false, false)).toBe(true)
    expect(enterpriseMarketComponentSwitchDisabled('skills', false, false)).toBe(true)
    expect(enterpriseMarketComponentSwitchDisabled('presets', false, false)).toBe(true)
  })

  it('counts the component summary with the official partsSummary 口径 (共 N 个 · N 可用 · N 未开启 · N 预留)', () => {
    // 「未开启」这一段是本机开关（资料库）默认关的**可见交代**：默认值必须看得见。
    // **本刀（企业配方页签）**：配方不再预留，故 `reserved` 恒 0、那一整段也不再出现（页面上的词是真的，不是台账）。
    expect(enterpriseMarketComponentSummary()).toEqual({ total: 4, ready: 0, off: 1, reserved: 0 })
    expect(enterpriseMarketComponentSummaryText()).toBe('共 4 个 · 1 未开启')
    expect(enterpriseMarketComponentSummary(undefined, true)).toEqual({ total: 4, ready: 3, off: 1, reserved: 0 })
    expect(enterpriseMarketComponentSummaryText(undefined, true)).toBe('共 4 个 · 3 可用 · 1 未开启')
    // 逐行状态与计数一致：未登录的插件/技能/配方需登录（不产出「可用」段）+ 资料库未开启。
    expect(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false)).toBe('共 4 个 · 1 未开启')
    // 资料库开关打开后，它那一段从「未开启」挪到「可用」——同一行、同一个投影。
    expect(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false, true)).toBe('共 4 个 · 1 可用')
  })

  it('renders the 组件 tab with the official component-section heading and per-row switch labels', () => {
    // 组件清单已搬进「组件」页签：只有选中该页签时才在树上（页签承担显隐）。这一节两套外壳共用同一份内容。
    for (const { label, shell } of MARKET_SHELLS) {
      const page = shell({ view: 'page', activeTab: 'components' })
      expect(isValidElement(page), label).toBe(true)
      const text = textOf(page)
      expect(text, label).toContain('内容清单')
      expect(text, label).toContain(enterpriseMarketComponentSummaryText(ENTERPRISE_MARKET_COMPONENTS, false))
      for (const row of ENTERPRISE_MARKET_COMPONENTS) expect(text, label).toContain(row.label)
      // 回归锁：正文不重复标题与摘要——标题 h3 由官方 ItemDetail 用 item.label 渲染（我们不再画），
      // 卡片摘要只在 summary 视图出现，desc 已按产品决策删除，「组件」页签里只有组件清单。
      expect(text, label).not.toContain('企业插件、技能与配方的统一入口')
      expect(text, label).not.toContain(ENTERPRISE_MARKET_SUMMARY)
      expect(text, label).not.toContain(ENTERPRISE_MARKET_ENTRY_LABEL)
      // 未选中「组件」时这份清单整段不挂载（默认页签是「企业技能」）。
      expect(textOf(shell({ view: 'page' })), label).not.toContain('内容清单')
    }
  })

  // 回归锁：注入 store（有 onOpenLogin 回调）后，组件行开关必须可点；
  // 此前 client.tsx 未给 plugins.item 注 inject 导致开关恒 disabled（点了没反应）的 bug 不许再犯。
  // 本刀新增第四行「资料库」：它的开关归**本机设置**，故这条用例同时锁「有写入口就可拨、没写入口才禁用」。
  it('keeps the component-row switches clickable when their own action is wired (no dead control)', () => {
    for (const { label, shell } of MARKET_SHELLS) {
      const onOpenLogin = vi.fn()
      const page = shell({ view: 'page', activeTab: 'components', sessionUsable: false, onOpenLogin })
      expect(isValidElement(page), label).toBe(true)
      // 「组件」页签里只有这四行组件开关（正文没有头部总开关：badge 槽只出只读的「版本号 + 包名」，
      // 见下面的 BadgeView 用例——那里断言标题行没有任何 Switch）。
      const switches = collectSwitchProps(page)
      expect(switches, label).toHaveLength(4)
      // 插件/技能/配方三行开关未登录且有回调 → 必须可点（disabled false）；配方行本刀起与它们同一条口径。
      // 注意：Switch 的无障碍名走 `label` prop（vi.fn() mock 不展开成 aria-label），切换动作走 `onChange`。
      const pluginsSwitch = switches.find(props => props.label === '启用插件')
      expect(pluginsSwitch, label).toBeDefined()
      expect(pluginsSwitch?.checked, label).toBe(false)
      expect(pluginsSwitch?.disabled, label).toBe(false)
      const skillsSwitch = switches.find(props => props.label === '启用技能')
      expect(skillsSwitch?.checked, label).toBe(false)
      expect(skillsSwitch?.disabled, label).toBe(false)
      const presetsSwitch = switches.find(props => props.label === '启用配方')
      expect(presetsSwitch?.checked, label).toBe(false)
      expect(presetsSwitch?.disabled, label).toBe(false)
      // 资料库行：这一份 props 没给 `onToggleLibrary`（本机写入口缺席）→ 开关禁用（**不给死开关**），
      // checked 取本地默认关。拨动与写失败的重试由下面「本机开关」那组用例覆盖。
      const librarySwitch = switches.find(props => props.label === '启用资料库')
      expect(librarySwitch?.checked, label).toBe(false)
      expect(librarySwitch?.disabled, label).toBe(true)
      // page 不含头部总开关（badge 槽只有只读的版本号 + 包名，功能开关就是这四行）。
      expect(switches.find(props => props.label === '启用插件市场'), label).toBeUndefined()
    }
  })

  // 「企业」徽章 + 版本号 + 包名走官方 plugins.detail.badge 槽（titleRow 里 h3 旁）：只对本条目 subject 生效；
  // 「预览版」文字签已按顶部压缩删掉（纯噪音、无信息量），标题行也没有可拨总开关。
  //
  // **座位实物（取证）**：`@deepseek-ai/dsh-client-ui-plugin-manager` 把该槽声明成 `kind:'list'`/`scope:'root'`
  // （`lib/types/client/slot-contract.d.ts:131`，运行时清单 `lib/client.js:3510`），渲染点在官方 `ItemDetail` 的
  // `titleRow`（`lib/client.js:2138` 的 `renderSlot("plugins.detail.badge", { subject })`，subject = `{kind:'item', id}`）；
  // 我们这行「插件市场」走的正是 `ItemDetail`（`lib/client.js:3177` 的 `ItemCard` → `lib/client.js:3333`），
  // 所以这枚徽章**进得去**详情页，不是白挂的座位。
  it('gates the badge on the plugin-market subject and renders nothing in the detail title (user rule B)', () => {
    // subject 过滤：其余 subject 一律 null（hook 前就返回，不碰状态）。
    expect(EnterpriseMarketBadge({ subject: { kind: 'item', id: 'shell' } })).toBeNull()
    expect(EnterpriseMarketBadge({ subject: { kind: 'bundle', pkg: { name: 'x' } } })).toBeNull()
    // **本刀（用户裁决 B：详情页标题删除右侧标签）**：本条目这一格**什么都不出** ——
    // 「企业」徽章与版本签都撤下详情页标题（包名更早就已撤下）；下面的断言是**反锁**：
    // 谁把签加回详情标题，这里先红。
    const withVersion = BadgeView({ version: '0.1.0' })
    expect(withVersion).toBeNull()
    expect(textOf(withVersion)).toBe('')
    expect(collectByClassName(withVersion, 'own-market-tag')).toEqual([])
    // 分工提醒：**列表卡标题行**那枚「企业」签由 `market-entry-badge.ts` 做 DOM 装饰，不在这一格，故仍然在。
    expect(BadgeView({})).toBeNull()
    // 反锁：详情标题这一格**没有任何官方 Tag**（企业签与版本签都撤下了）、没有包名行、没有开关。
    expect(collectOfficialTagProps(withVersion)).toEqual([])
    expect(collectByClassName(withVersion, 'own-market-badge-name')).toEqual([])
    expect(collectSwitchProps(withVersion)).toHaveLength(0)
    // **叶子组件本身的口径不变**（列表卡的 DOM 装饰与将来复用都读它）：
    // 「企业」签仍是官方 `Tag` 原语本体、tone=info、公开面之外一个属性都不给。
    const badgeTag = EnterpriseMarketBadgeTag()
    expect(collectOfficialTagProps(badgeTag)).toEqual([
      { className: 'own-market-tag', tone: 'info', children: ENTERPRISE_MARKET_BADGE_TEXT },
    ])
    expect(Object.keys(collectOfficialTagProps(badgeTag)[0] ?? {}).sort()).toEqual(['children', 'className', 'tone'])
    expect(textOf(BadgeView({}))).toBe('')
    // 版本签口径照官方 versionTag 'v{version}'。
    expect(enterpriseMarketVersionTag('1.2.3')).toBe('v1.2.3')
    expect(enterpriseMarketVersionTag(undefined)).toBeUndefined()
    expect(enterpriseMarketVersionTag('')).toBeUndefined()
  })

  // **反向锁：标题区动作只对「插件市场」这一条 item 渲染**（真机实测的泄漏回归）——
  // 官方 `plugins.detail.actions` 是 `kind:'list'/scope:'root'`，官方对 list 槽**没有 `only` 过滤**，
  // 且 `ItemDetail`(`PluginManagerPage.tsx:540`) / `RowDetail`(`:583`) / `PackageDetail`(`:642`) 三种详情页
  // 都 `renderSlot('plugins.detail.actions', { subject })` ⇒ 组件内部不按 subject 收口就是
  // **每个 item 详情页都出【刷新】【添加插件】**（与 badge 槽 `EnterpriseMarketBadge` 同一条范式）。
  it('gates the title-area action buttons on the plugin-market subject so they never leak to other detail pages', () => {
    // 非本条目：另一条 item、row、package 三种 subject 一律 null（官方三种详情页正是这些 subject）。
    expect(EnterpriseMarketDetailActions({ subject: { kind: 'item', id: 'bash' } })).toBeNull()
    expect(EnterpriseMarketDetailActions({ subject: { kind: 'row', pkg: { name: 'x' }, row: { rowId: 'y' } } })).toBeNull()
    expect(EnterpriseMarketDetailActions({ subject: { kind: 'package', pkg: { name: 'x' } } })).toBeNull()
    // 本条目但**座位没接线**：标题右侧这一格**什么都不出**（返回的是空 Fragment，不是 null——
    // 因为是本条目，函数已经越过 subject 门）；**页签与两枚动作都只在座位在场时出**。
    const noSeat = EnterpriseMarketDetailActions({ subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID } })
    expect(textOf(noSeat)).toBe('')
    expect(collectByRole(noSeat, 'tab')).toEqual([])
    expect(collectOfficialButtonProps(noSeat)).toEqual([])
    // 座位接线后：这一格**零枚页签**（页签已搬去工具行左端）、**出两枚动作**（刷新 + 「添加」，右对齐）。
    const model = enterpriseMarketShellModel({ view: 'page', sessionUsable: true })
    const seated = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: model.tabEntries, activeTab: model.activeTab, onSelect: undefined },
    })
    expect(collectByRole(seated, 'tab')).toEqual([])
    // 两枚动作在**标题槽**里（用户口径「把刷新和添加按钮放到标题行右侧」）：变体/尺寸/图标/无障碍名/title 逐字锁死。
    const actions = collectOfficialButtonProps(seated)
    expect(actions).toHaveLength(2)
    // 刷新 = `toolbar`（官方那一档**浅色实底**：`background: var(--dsw-alias-button-tool-bar-fill)`）；
    // 刷新钮 = 官方 `variant="ghost"`（用户口径：「应该是没有背景的，我意思是**图标浅色**，不是背景」）。
    // ★ **本条曾被写反**：早先断言 `toEqual(['toolbar',…])` + `not.toContain('ghost')`，并用一段
    //   「ghost 常态透明所以用户看不到浅色」的注释把那个误解**合理化**了——那是把「浅色」读成
    //   「浅灰实底」（`toolbar` = `button-tool-bar-fill`）造成的。**错误注释比错误代码更毒**，
    //   它会让下一个人照着再错一次；两处一并改掉。
    expect(actions.map(props => props['variant'])).toEqual(['ghost', 'primary'])
    // 反向锁的方向也跟着翻：现在要锁的是「刷新钮**不得**再回到有常态底的 toolbar/outline」。
    expect(actions.map(props => props['variant'])).not.toContain('toolbar')
    expect(actions.map(props => props['variant'])).not.toContain('outline')
    // ★ **本刀（task-20 A）**：官方「插件」根页那枚「+ 添加插件」是 `size="sm"` ⇒ 添加钮由 md 降到 sm，
    //   **刷新钮一字不动（仍 md）**。
    expect(actions.map(props => props['size'])).toEqual(['md', 'sm'])
    // 官方两档的真值（dsh-client-ui-primitives 的 Button.module.css 逐字）：
    //   .md 高 36px / 字 14px / 行高 22px / 内衬 14px / radius-md；.sm 高 28px / 字 12px / 行高 18px / 内衬 10px / radius-sm。
    expect(['md', 'sm']).toContain(actions[0]?.['size'])
    expect(actions[0]?.['size']).toBe('md')
    expect(actions[1]?.['size']).toBe('sm')
    // 刷新钮仍用官方 `icon` prop；**「添加技能」触发钮按 Cherry 用内联 children**
    // （`Plus` + 文字 + `ChevronDown`，`ResourceGrid.tsx:181-184`）——所以它**没有** `icon` prop。
    // 这不是「图标丢了」：三枚图形都在 children 里，形状照 Cherry。
    expect(actions[0]?.['icon']).toBeDefined()
    expect(actions[1]?.['icon']).toBeUndefined()
    expect(actions.every(props => props['variant'] !== undefined)).toBe(true)
    expect(actions.map(props => props['aria-label'])).toEqual([
      ENTERPRISE_DETAIL_ACTION_REFRESH_LABEL,
      ENTERPRISE_DETAIL_ACTION_ADD_LABEL,
    ])
    expect(actions.map(props => props['title'])).toEqual([
      '占位：本刀未接真刷新，下一刀接 store.refreshPlugins()',
      // 「添加技能」触发钮**刻意不挂 title**：本轮四项执行不接、原因写在各项的**可见标签**里
      // （官方 MenuItemButton 不透传 title，挂了也会被静默丢弃 ⇒ 那才是真的死控件）。
      undefined,
    ])
    // 「添加技能」触发钮是**下拉触发钮**：开合用 aria-expanded 表达，
    // 且**零 aria-haspopup**（本页既有源码级反锁禁 dialog 语义）。
    expect(actions[1]?.['aria-expanded']).toBe(false)
    expect(actions[1]?.['aria-label']).toBe(ENTERPRISE_DETAIL_ACTION_ADD_LABEL)
    // ★ 触发钮文案**逐字照 Cherry** `library.skill_add.add` = 「添加技能」（**不是**「添加」）。
    expect(ENTERPRISE_DETAIL_ACTION_ADD_LABEL).toBe('添加')
    // 这份输入没有目录行 ⇒ 工具行那侧官方 Button 恰好零枚（两枚动作都在标题槽里）。
    expect(collectOfficialButtonProps(EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true }))).toHaveLength(0)
  })

  // **反向锁（「企业标签不新增 CSS 类」）**：徽章与描述行胶囊只用官方原语 + 本文件**既有**的 `.own-market-tag`，
  // 源码里那个类的声明块仍然只有一条。（整份 `<style>` 的字节级基线已按**本刀**新增的进度动画
  // **再基线化**到 `LEGACY_STYLE_LENGTH` / `LEGACY_STYLE_CHECKSUM`——锁的形态没变，见那两个常量的注释。）
  /**
   * ★ **基线自证**：那三份 `style(NNNN chars)` / `LEGACY_STYLE_LENGTH` / `LEGACY_STYLE_CHECKSUM`
   * 是**手写常量**，任何人改 CSS 都会踩到它们。这条断言让基线**自己成为可验证的产物**，
   * 而不是靠人肉同步的负债——常量与真实 `<style>` 串一旦漂移，这里立刻红。
   */
  it('keeps the hand-written style baselines equal to the real <style> string (no human sync)', () => {
    const css = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))
    expect(css.length, 'LEGACY_STYLE_LENGTH 与真实 <style> 长度漂移了').toBe(LEGACY_STYLE_LENGTH)
    expect(styleChecksum(css), 'LEGACY_STYLE_CHECKSUM 与真实 <style> 校验和漂移了').toBe(LEGACY_STYLE_CHECKSUM)
    // 两份 outline 快照里那两行也必须与真实长度一致（它们是同一份基线的另两面）。
    for (const line of [...LEGACY_SHELL_OUTLINE, ...LEGACY_PLUGINS_OUTLINE]) {
      const matched = /^\s*style\((\d+) chars\)$/.exec(line)
      if (matched === null) continue
      expect(Number(matched[1]), 'outline 里的 style(N chars) 与真实长度漂移了').toBe(LEGACY_STYLE_LENGTH)
    }
  })

  /**
   * ★ 「添加技能」下拉：**按页签**、技能页签一套、**四项逐字照 Cherry**，**本刀起只放开「本地导入」那一项**。
   *
   * 锁五件事：
   * ① **按页签**：只有 `skills` 有清单；其余三个页签返回 `[]` ⇒ **整段不渲染**（不是渲染一枚空的）。
   * ② **四项文案与顺序**逐字照 Cherry `zh-cn.json` 的 `library.skill_add.*`
   *    （通过 Agent 创建 / 在线搜索 / 系统搜索 / 本地导入），**含两个条件项**（Cherry `:188`/`:198`）。
   * ③ **顺序锁**：菜单项顺序 === 投影数组顺序（防止将来加项时插到中间漂了）。
   * ④ 三项仍是「开发中」：原因**写进可见标签**（官方 `MenuItemButton` 不透传 `title`，挂了会被静默丢弃
   *    ⇒ 那才是真的死控件）；本地导入那一项的终态另有一条专门用例逐条锁（本刀）。
   * ⑤ 不得出现占位符式文案（「即将上线」「敬请期待」等都不是用户口径）。
   */
  it('ships the Cherry-shaped 添加技能 dropdown on the skills tab only, keeping the three unwired items at 开发中', () => {
    // ① 按页签：只有技能页签有清单；其余三个页签空清单（⇒ 渲染层整段不渲染）。
    expect(enterpriseAddMenuEntries('skills').map(entry => entry.label))
      .toEqual(['通过 Agent 创建', '在线搜索', '系统搜索', '本地导入'])
    for (const tab of ['plugins', 'presets', 'components'] as const) {
      expect(enterpriseAddMenuEntries(tab), tab).toEqual([])
    }
    // ②③ 顺序 === 投影数组顺序（含两个条件项，形状照抄 Cherry）。
    const entries = enterpriseAddMenuEntries('skills')
    expect(entries.map(entry => entry.id)).toEqual(['create-with-agent', 'online-search', 'system-search', 'local-import'])
    expect(entries.map(entry => entry.conditional)).toEqual([true, false, true, false])
    // ④ 「开发中」逐字三字；四项全 disabled。
    expect(ENTERPRISE_ADD_MENU_DEVELOPING).toBe('开发中')
    // ★ 触发钮现在落在**标题行右侧**（用户口径「把刷新和添加按钮放到标题行右侧，右对齐」），
    //   不再在工具行 —— 故这里从标题槽那一格取它，而不是从页面外壳。
    const addSlot = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: [], activeTab: 'skills', onSelect: undefined },
    })
    const add = collectOfficialButtonProps(addSlot)
      .find(props => props['aria-label'] === ENTERPRISE_DETAIL_ACTION_ADD_LABEL) ?? {}
    expect(add['aria-label']).toBe('添加')
    expect(add['aria-expanded']).toBe(false)
    expect(add['aria-haspopup']).toBeUndefined()
    // ⑤ 占位符式文案一律不许出现（用户口径就是「开发中」三字）。
    const text = textOf(EnterpriseMarketLegacyShell({ view: 'page' })) + textOf(addSlot)
    for (const placeholder of ['即将上线', '敬请期待', '暂未开放', 'TODO', 'Coming soon']) {
      expect(text, placeholder).not.toContain(placeholder)
    }
  })

  /**
   * ★ **本刀（本地导入）：四项的终态逐项锁死** —— 只有「本地导入」可点，其余三项仍是可见的「开发中」。
   *
   * 三条一起锁，缺一条都会漏掉一种坏形态：
   *  ① **纯投影**：哪一项禁用、禁用时那句可见原因、真正渲染的文案（可点那一项**不许**带「开发中」）；
   *  ② **写入口缺席时必须退回禁用**（没有 store / 老调用方 / 纯函数直调）——绝不出现「看着能点、
   *     点下去什么都不发生」的菜单项，也绝不把「能点」这件事做成一句空承诺；
   *  ③ **真元素**（官方 `MenuItemButton` 本体）：四项的 `disabled` 逐项相同；点第 4 项 =
   *     **先收起下拉、再打开文件选择器**（官方组件行不会自己关菜单，故这一下必须由我们做）；
   *     点禁用项时两个回调都不许被调到。
   */
  it('opens exactly the wired add-menu items and leaves the rest at 开发中', () => {
    const onCreateWithAgent = vi.fn()
    const onOnlineSearch = vi.fn()
    const onImportSkill = vi.fn()
    const onSystemSearch = vi.fn()
    const wiring = { onCreateWithAgent, onOnlineSearch, onImportSkill, onSystemSearch }
    const plans = enterpriseAddMenuPlans('skills', wiring)
    expect(plans.map(plan => plan.id))
      .toEqual([ENTERPRISE_ADD_MENU_CREATE_ID, ENTERPRISE_ADD_MENU_ONLINE_ID, ENTERPRISE_ADD_MENU_SYSTEM_SEARCH_ID, ENTERPRISE_ADD_MENU_IMPORT_ID])
    // **本刀（在线搜索）**：最后一项也放开了 ⇒ **四项全部可点**。
    expect(plans.map(plan => plan.disabled)).toEqual([false, false, false, false])
    expect(plans.map(plan => plan.text)).toEqual(['通过 Agent 创建', '在线搜索', '系统搜索', '本地导入'])
    // ★ 四项都接线之后，「（开发中）」这四个字在本页**一个都不剩**：四行文案里一处都没有。
    for (const plan of plans) {
      expect(plan.text, plan.id).not.toContain(ENTERPRISE_ADD_MENU_DEVELOPING)
      expect(plan.reason, plan.id).toBeUndefined()
    }
    // 禁用项都带**可见原因**；可点那些项没有原因（留着「开发中」就是假话）。
    for (const plan of plans) {
      if (plan.disabled) expect(plan.reason, plan.id).toBe(ENTERPRISE_ADD_MENU_DEVELOPING)
      else expect(plan.reason, plan.id).toBeUndefined()
    }
    // ★ 逐项独立：各只接一项 ⇒ 只有那一项可点（其余照旧灰着）
    //   （「哪一项可点」由**各自**的写入口决定，不是「接了一个就全开」）。
    expect(enterpriseAddMenuPlans('skills', { onImportSkill }).map(plan => plan.disabled)).toEqual([true, true, true, false])
    expect(enterpriseAddMenuPlans('skills', { onSystemSearch }).map(plan => plan.disabled)).toEqual([true, true, false, true])
    expect(enterpriseAddMenuPlans('skills', { onCreateWithAgent }).map(plan => plan.disabled)).toEqual([false, true, true, true])
    expect(enterpriseAddMenuPlans('skills', { onOnlineSearch }).map(plan => plan.disabled)).toEqual([true, false, true, true])
    // ② 写入口缺席 ⇒ 两项都照旧禁用、原因照旧看得见（同一句「开发中」，不是 no-op 的死控件）。
    const unwiredPlans = enterpriseAddMenuPlans('skills')
    expect(unwiredPlans.map(plan => plan.disabled)).toEqual([true, true, true, true])
    expect(unwiredPlans[0]!.text).toBe(`通过 Agent 创建（${ENTERPRISE_ADD_MENU_DEVELOPING}）`)
    expect(unwiredPlans[1]!.text).toBe(`在线搜索（${ENTERPRISE_ADD_MENU_DEVELOPING}）`)
    expect(unwiredPlans[2]!.text).toBe(`系统搜索（${ENTERPRISE_ADD_MENU_DEVELOPING}）`)
    expect(unwiredPlans[3]!.text).toBe(`本地导入（${ENTERPRISE_ADD_MENU_DEVELOPING}）`)
    expect(enterpriseAddMenuEntryPlan(enterpriseAddMenuEntries('skills')[3]!).disabled).toBe(true)
    // 单参入口与整份清单入口对同一项必须算出同一份终态（两处不可能漂）。
    expect(enterpriseAddMenuEntryPlan(enterpriseAddMenuEntries('skills')[0]!, { onCreateWithAgent }).disabled).toBe(false)
    expect(enterpriseAddMenuEntryPlan(enterpriseAddMenuEntries('skills')[1]!, { onOnlineSearch }).disabled).toBe(false)
    expect(enterpriseAddMenuEntryPlan(enterpriseAddMenuEntries('skills')[3]!, { onImportSkill }).disabled).toBe(false)
    expect(enterpriseAddMenuEntryPlan(enterpriseAddMenuEntries('skills')[2]!, { onSystemSearch }).disabled).toBe(false)
    // 无清单的页签仍是空清单（渲染层据此整段不渲染）。
    for (const tab of ['plugins', 'presets', 'components'] as const) {
      expect(enterpriseAddMenuPlans(tab, { onImportSkill, onSystemSearch }), tab).toEqual([])
    }
    // ③ 真元素：四项都是官方 `MenuItemButton`，禁用位与文案逐项相同。
    const onToggleAddMenu = vi.fn()
    const seat = {
      entries: [], activeTab: 'skills' as const, onSelect: undefined, addMenuOpen: true, onToggleAddMenu,
      onCreateWithAgent, onOnlineSearch, onImportSkill, onSystemSearch,
    }
    const slot = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: seat,
    })
    const items = collectOfficialMenuItemProps(slot)
    expect(items).toHaveLength(4)
    expect(items.map(props => props['disabled'])).toEqual([false, false, false, false])
    expect(items.map(props => props['children'])).toEqual(plans.map(plan => plan.text))
    for (const props of items) expect(typeof props['onSelect']).toBe('function')
    // ★ **「（开发中）」在这棵树里一个都不剩**（四项全接线的状态下，整棵树任何一处文本都没有那四个字）。
    expect(textOf(slot)).not.toContain(ENTERPRISE_ADD_MENU_DEVELOPING)
    // 四项**逐项独立**：点哪一项就走它自己那一枚回调（下面用顺序数组逐个证）。
    expect(onToggleAddMenu).not.toHaveBeenCalled()
    expect(onCreateWithAgent).not.toHaveBeenCalled()
    expect(onImportSkill).not.toHaveBeenCalled()
    expect(onSystemSearch).not.toHaveBeenCalled()
    expect(onOnlineSearch).not.toHaveBeenCalled()
    // 点「系统搜索」：**先收起下拉、再打开结果面**（顺序 = 用户看到的那一下），且**不**去碰另两项。
    const order: string[] = []
    onToggleAddMenu.mockImplementation(() => { order.push('close') })
    onCreateWithAgent.mockImplementation(() => { order.push('create') })
    onOnlineSearch.mockImplementation(() => { order.push('online') })
    onSystemSearch.mockImplementation(() => { order.push('system-search') })
    onImportSkill.mockImplementation(() => { order.push('import') })
    // 四项逐个点一遍：每一项都「先关下拉、再走它自己那一枚回调」，且**不**碰别的回调。
    for (const [index, expected] of [[0, 'create'], [1, 'online'], [2, 'system-search'], [3, 'import']] as const) {
      order.length = 0
      items[index]!['onSelect']()
      expect(order, String(index)).toEqual(['close', expected])
    }
    // 座位**没带写入口**时，真 DOM 里那两项也禁用（不是「能点但 no-op」）；只带一个时只有那一项可点。
    const bare = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: [], activeTab: 'skills', onSelect: undefined, addMenuOpen: true, onToggleAddMenu },
    })
    expect(collectOfficialMenuItemProps(bare).map(props => props['disabled'])).toEqual([true, true, true, true])
    const bareDisabled = collectOfficialMenuItemProps(EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: [], activeTab: 'skills', onSelect: undefined, addMenuOpen: true, onToggleAddMenu, onImportSkill },
    })).map(props => props['disabled'])
    expect(bareDisabled).toEqual([true, true, true, false])
    // 只带「通过 Agent 创建」的写入口 ⇒ 真元素里也只有①可点（逐项独立）。
    expect(collectOfficialMenuItemProps(EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: [], activeTab: 'skills', onSelect: undefined, addMenuOpen: true, onToggleAddMenu, onCreateWithAgent },
    })).map(props => props['disabled'])).toEqual([false, true, true, true])
    // 只带「在线搜索」的写入口 ⇒ 真元素里只有②可点，且树里其余三项仍带可见「开发中」。
    const onlyOnline = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: [], activeTab: 'skills', onSelect: undefined, addMenuOpen: true, onToggleAddMenu, onOnlineSearch },
    })
    expect(collectOfficialMenuItemProps(onlyOnline).map(props => props['disabled'])).toEqual([true, false, true, true])
    expect(collectOfficialMenuItemProps(onlyOnline)[1]!['children']).toBe('在线搜索')
  })

  /**
   * ★ **本刀（本地导入）：文件选择器 + 三条可见反馈**。
   *
   * ① **没有写入口就一枚元素都不画**（不画点了没反应的选择器）；
   * ② 接线面在场时那枚 `<input type="file">` 的**冻结属性**逐条锁死（accept 串 / 无障碍名 / 行内收起），
   *    且空闲态**不出**任何反馈（安静的页面上不加噪音）；
   * ③ 选中文件的那一下：**先把 value 清空再交出去**——不清的话「同一个文件再选一次」不会触发 change
   *    （浏览器认为值没变），那就是一次点了没反应；没选中任何文件即什么都不做；
   * ④ 三态都**看得见**：进行中 / 成功（含技能名）各一句 `role="status"`；失败走**唯一**的失败提示组件
   *    （`role="alert"` + 「下一步：」+ 折进「技术信息」的稳定码）+ 一枚**真能点**的「重新选择文件」。
   * ⑤ **跨流那一枚码**：`ENT_SKILL_ARCHIVE_INVALID` 在本地上传流下给的下一步**不是**「重新下载」
   *    （技能包就是员工手里那份文件）——这条在**渲染出来的文本**上锁死，不只看纯投影。
   */
  it('wires the local-import picker with frozen attributes and shows busy / done / failed feedback', () => {
    const onOpen = vi.fn()
    const onSelect = vi.fn()
    const port = (state: EnterpriseSkillImportState | undefined) => ({
      state, inputRef: { current: null }, onOpen, onSelect,
    })
    // ① 没有接线面：一枚元素都不画（连选择器都没有 ⇒ 不可能有「点了没反应」的入口）。
    const bare = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true })
    expect(collectByProp(bare, 'accept')).toEqual([])
    expect(collectByProp(bare, 'data-enterprise-skill-import')).toEqual([])
    // ② 冻结属性 + 空闲态不出反馈。
    const idle = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, skillImport: port(undefined) })
    const inputs = collectByProp(idle, 'accept')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!['type']).toBe('file')
    expect(inputs[0]!['accept']).toBe(ENTERPRISE_SKILL_IMPORT_ACCEPT)
    expect(inputs[0]!['aria-label']).toBe(ENTERPRISE_SKILL_IMPORT_INPUT_LABEL)
    // 恒不可见：行内「1px 剪裁」（与资料库那枚同一套手法，只是走行内以保**零新增 CSS 类**
    // —— 那份 `<style>` 的两道字节级判据一字未动，由基线用例锁）。
    expect(inputs[0]!['style']).toMatchObject({
      position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)',
    })
    expect(collectByProp(idle, 'data-enterprise-skill-import')).toEqual([])
    expect(collectByProp(idle, 'data-enterprise-error-code')).toEqual([])
    // 详情子页面那一支也带同一份（否则「在技能详情里点本地导入」就是死控件）。
    const skill = enterpriseMarketSkillRows([SKILL])[0]!
    const skillPageTree = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      skillImport: port(undefined),
      skillPage: {
        row: skill,
        facts: enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [skill] }, skill),
        fileEntries: [],
        filesLoading: false,
        fileLoading: false,
        onSelectFile: vi.fn(),
        onBack: vi.fn(),
      },
    })
    expect(collectByProp(skillPageTree, 'accept')).toHaveLength(1)
    // ③ 选中文件：先清空 value（让「同一个文件再选一次」仍然触发），再把 File 交给上层。
    const file = { name: 'meeting-notes.dshskill', size: 2048 } as unknown as File
    const event = { currentTarget: { files: { item: () => file }, value: 'C:\\fakepath\\meeting-notes.dshskill' } }
    inputs[0]!['onChange'](event)
    expect(onSelect).toHaveBeenCalledWith(file)
    expect(event.currentTarget.value).toBe('')
    // 用户在原生选择器里按了取消（没选中任何文件）⇒ 什么都不做，也不是一次静默失败。
    onSelect.mockClear()
    const cancelled = { currentTarget: { files: { item: () => null }, value: 'kept' } }
    inputs[0]!['onChange'](cancelled)
    expect(onSelect).not.toHaveBeenCalled()
    expect(cancelled.currentTarget.value).toBe('')
    // ④ 三态可见：进行中 / 成功各一句 role="status"；失败 = 唯一提示组件 + 真能点的重选按钮。
    const busy = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, skillImport: port({ kind: 'uploading', name: file.name, bytes: file.size }),
    })
    const busyNote = collectByProp(busy, 'data-enterprise-skill-import')[0]!
    expect(busyNote['data-enterprise-skill-import']).toBe('busy')
    expect(busyNote['role']).toBe('status')
    expect(textOf(busyNote['children'] as ReactNode)).toContain(file.name)
    expect(textOf(busyNote['children'] as ReactNode)).toContain('2.0 KiB')
    // 那枚纯组件本身也**可直接直调**（本仓的取证范式）：同一份状态给出同一句话、同一枚 role。
    const directBusy = EnterpriseMarketSkillImportNotice({ state: { kind: 'uploading', name: file.name, bytes: file.size } })
    expect(textOf(directBusy)).toContain(file.name)
    expect((directBusy as { props: Record<string, unknown> }).props['role']).toBe('status')
    const done = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      skillImport: port({ kind: 'done', name: file.name, bytes: file.size, names: ['meeting-notes'], listed: true }),
    })
    const doneNote = collectByProp(done, 'data-enterprise-skill-import')[0]!
    expect(doneNote['data-enterprise-skill-import']).toBe('done')
    expect(textOf(doneNote['children'] as ReactNode)).toContain('meeting-notes')
    const failed = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      skillImport: port({ kind: 'failed', name: file.name, bytes: file.size, code: ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE }),
    })
    // 失败**不是**一句 status 就完了：走唯一提示组件（人话 + 下一步 + 技术信息里的码）。
    expect(collectByProp(failed, 'data-enterprise-skill-import')).toEqual([])
    expect(collectByProp(failed, 'data-enterprise-error-code')[0]?.['data-enterprise-error-code'])
      .toBe(ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE)
    expect(textOf(failed)).toContain('下一步：')
    expect(textOf(failed)).toContain(file.name)
    // 那枚「重新选择文件」是**真按钮**（有写入口 ⇒ 点得动；点它就是重新打开选择器）。
    const reselect = collectOfficialButtonProps(failed)
      .find(props => props['aria-label'] === ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL)
    expect(reselect?.['children']).toBe(ENTERPRISE_SKILL_IMPORT_RESELECT)
    onOpen.mockClear()
    reselect?.['onClick']()
    expect(onOpen).toHaveBeenCalledTimes(1)
    // ⑤ 跨流码：本地上传流下渲染出来的「下一步」不许是「重新下载」（那句在这条流里是错的）。
    const archive = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      skillImport: port({ kind: 'failed', name: file.name, bytes: file.size, code: 'ENT_SKILL_ARCHIVE_INVALID' }),
    })
    const actionText = textOf(collectByClassName(archive, 'own-error-action')[0]?.['children'] as ReactNode)
    expect(actionText).toContain('重新选择')
    expect(actionText).not.toContain('重新下载')
  })

  /* ───────────── 本刀（在线搜索 → 安装）：页内结果面 + 查询框 + 逐源两种坏消息 ───────────── */

  /** 一份在线搜索真值：一个源挂了、一个源丢了 3 条、一个源正常；两条结果（一条带全套元信息）。 */
  function onlineValue(over: Partial<{ sources: readonly any[]; results: readonly any[] }> = {}) {
    return {
      sources: [
        { id: 'skills.sh', ok: false },
        { id: 'claude-plugins.dev', ok: true, dropped: 3 },
        { id: 'clawhub.ai', ok: true },
      ],
      results: [
        { sourceId: 'clawhub.ai', name: 'code-review', description: '把代码审查规则带进新会话。', author: 'acme', stars: 1200, installs: 3400, installSource: 'skills-sh:acme/tools/code-review' },
        { sourceId: 'clawhub.ai', name: 'meeting-notes', installSource: 'clawhub.ai:acme/notes/meeting-notes' },
      ],
      ...over,
    }
  }

  /** 在线结果面的输入（唯一构造点在控制器里；这里按同一形状直调那枚纯组件）。 */
  function onlinePageInput(over: Record<string, unknown> = {}): EnterpriseOnlineSearchPageProps {
    return {
      state: { kind: 'ready', value: onlineValue() },
      query: 'code',
      onQueryChange: vi.fn(),
      onSearch: vi.fn(),
      onInstall: vi.fn(),
      onReload: vi.fn(),
      onBack: vi.fn(),
      ...over,
    } as EnterpriseOnlineSearchPageProps
  }

  /**
   * ★ **本刀（在线搜索）：结果面是页内视图切换，不是弹窗**（口径 15/26，与系统搜索同一证据口径）。
   *
   * ① `onlineSearch` 非空 = **整页切换**（工具行 / 四个 tabpanel 整段不挂载）；② 树里没有 dialog role、
   * 源码里没有 portal、这一面只有**一枚** region（`tabIndex={-1}` 的焦点落点）；③ 返回两条真路径
   * （面包屑 + Esc）且返回后还原滚动；④ **查询框就在面内**（不是弹窗里的输入）。
   */
  it('opens the online-search result face as an in-page view switch with an in-face query box', async () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, onlineSearch: onlinePageInput() })
    expect(collectByClassName(tree, 'own-market-searchRow')).toHaveLength(1)
    expect(collectByRole(tree, 'tab')).toEqual([])
    expect(collectByRole(tree, 'tablist')).toEqual([])
    expect(collectByRole(tree, 'tabpanel')).toEqual([])
    expect(collectByRole(tree, 'dialog')).toEqual([])
    expect(collectByRole(tree, 'region')).toHaveLength(1)
    const region = collectByRole(tree, 'region')[0]!
    expect(region['aria-label']).toBe(ENTERPRISE_ONLINE_TITLE)
    expect(region['tabIndex']).toBe(-1)
    expect(region['data-enterprise-online-page']).toBe('true')
    // 面包屑是可见返回入口（与另三面同一形制）。
    const crumb = collectByClassName(tree, 'own-market-crumb')[0]!
    expect(crumb['aria-label']).toBe(ENTERPRISE_ONLINE_BACK_LABEL)
    expect(textOf(crumb['children'] as ReactNode)).toContain(ENTERPRISE_ONLINE_BACK_TEXT)
    // ④ 查询框（面内）：无障碍名 / 占位 / 受控值 / 输入回调 / 回车即搜。
    const input = collectByClassName(tree, 'own-market-queryInput')[0]!
    expect(input['aria-label']).toBe(ENTERPRISE_ONLINE_QUERY_LABEL)
    expect(input['placeholder']).toBe(ENTERPRISE_ONLINE_QUERY_PLACEHOLDER)
    expect(input['value']).toBe('code')
    const onQueryChange = vi.fn()
    const onSearch = vi.fn()
    const controlled = EnterpriseOnlineSearchPage(onlinePageInput({ onQueryChange, onSearch }))
    const controlledInput = collectByClassName(controlled, 'own-market-queryInput')[0]!
    controlledInput['onChange']({ currentTarget: { value: 'meeting' } })
    expect(onQueryChange).toHaveBeenCalledWith('meeting')
    controlledInput['onKeyDown']({ key: 'Enter' })
    expect(onSearch).toHaveBeenCalledTimes(1)
    // 源码级反向锁：无 portal / 无 dialog；切面判据与 Esc / 滚动还原都在（与系统搜索同一套）。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('if (props.onlineSearch !== undefined)')
    const faceStart = source.indexOf('export function EnterpriseOnlineSearchPage(')
    const faceEnd = source.indexOf('\nexport function ', faceStart + 1)
    expect(faceStart).toBeGreaterThan(0)
    expect(faceEnd).toBeGreaterThan(faceStart)
    const faceSource = source.slice(faceStart, faceEnd)
    expect(faceSource).not.toContain('role="dialog"')
    expect(faceSource).not.toContain('createPortal')
    expect((faceSource.match(/role="region"/g) ?? []).length).toBe(1)
    expect(source).toMatch(/if \(!onlineSearchOpen\) return[\s\S]{0,200}marketRoot\.current[\s\S]{0,300}Escape/)
    expect(source).toMatch(/onOpenOnlineSearch[\s\S]{0,300}scrollTargetOf\(marketRoot\.current\)/)
    expect(source).toMatch(/onlineScrollMemory\.current[\s\S]{0,200}scrollTop = saved\.top/)
  })

  /**
   * ★ **本刀（在线搜索）：逐源的两种坏消息分开说 + 结果逐条给足事实**。
   *
   * ① `ok:false` 的源一句、`dropped>0` 的源另一句，两行都在、都带源名、kind 不同；
   * ② 每条结果：技能名 + 那一句 facts（来源恒有，作者/星标/安装量缺席就不进那一句）+ 描述（缺席不画）
   *    + 一枚【安装】；③ 点【安装】交回去的是**那一条完整的结果**（含 `installSource` 那条坐标）。
   */
  it('says the two kinds of source news separately and gives every result its facts and one install action', () => {
    const tree = EnterpriseOnlineSearchPage(onlinePageInput())
    const notes = collectByProp(tree, 'data-enterprise-online-source-note')
    expect(notes.map(props => props['data-enterprise-online-source-note'])).toEqual(['skills.sh', 'claude-plugins.dev'])
    expect(notes.map(props => props['data-enterprise-online-source-note-kind'])).toEqual(['failed', 'dropped'])
    const noteTexts = notes.map(props => textOf(props['children'] as ReactNode))
    expect(noteTexts[0]).toContain('skills.sh')
    expect(noteTexts[0]).toContain('没有取到')
    // **照实渲染收到的那个数**（3 条），界面不自己算、也不假设它恒等于某个值。
    expect(noteTexts[1]).toContain('3 条')
    expect(noteTexts[1]).toContain('不提供可安装的来源')
    expect(noteTexts[0]).not.toContain('部分失败')
    // 每行：标题取技能名；描述缺席的那条**没有第二行**；facts 那句在行上。
    const rows = collectByProp(tree, 'data-enterprise-online-result')
    expect(rows.map(props => props['data-enterprise-online-result-source'])).toEqual(['clawhub.ai', 'clawhub.ai'])
    expect(collectByClassName(tree, 'own-market-cardId').map(props => textOf(props['children'] as ReactNode)))
      .toEqual(['code-review', 'meeting-notes'])
    expect(collectByClassName(tree, 'own-market-cardDesc')).toHaveLength(1)
    const rowNotes = collectByProp(tree, 'data-enterprise-online-result-note').map(props => textOf(props['children'] as ReactNode))
    expect(rowNotes[0]).toContain(`${ENTERPRISE_ONLINE_SOURCE_PREFIX}clawhub.ai`)
    expect(rowNotes[0]).toContain(`${ENTERPRISE_ONLINE_AUTHOR_PREFIX}acme`)
    // 两枚计数走千分位（第三方给的大数：真机上到过 963199 ⇒ 「963,199」）。
    expect(rowNotes[0]).toContain(`${ENTERPRISE_ONLINE_STARS_PREFIX}1,200`)
    expect(rowNotes[0]).toContain(`${ENTERPRISE_ONLINE_INSTALLS_PREFIX}3,400`)
    // 第二条只有来源那一段（另外三枚缺席 ⇒ 一句里没有它们的标签）。
    expect(rowNotes[1]).toBe(`${ENTERPRISE_ONLINE_SOURCE_PREFIX}clawhub.ai`)
    // 每条一行一枚【安装】，点它交回**那一条**结果（坐标原样）。
    const onInstall = vi.fn()
    const clickable = EnterpriseOnlineSearchPage(onlinePageInput({ onInstall }))
    const buttons = collectOfficialButtonProps(clickable)
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_ONLINE_INSTALL))
    expect(buttons.map(props => props['aria-label'])).toEqual([`${ENTERPRISE_ONLINE_INSTALL}code-review`, `${ENTERPRISE_ONLINE_INSTALL}meeting-notes`])
    buttons[0]!['onClick']()
    expect(onInstall.mock.calls[0]?.[0]).toMatchObject({ installSource: 'skills-sh:acme/tools/code-review' })
  })

  /**
   * ★ **本刀（在线搜索）：查询三档 + 四态 + 安装四条反馈**。
   *
   * ① 空闲 / 太短各一句人话，且【搜索】按钮在不足门槛时**禁用**（原因就是那句看得见的人话）；
   * ② 加载一句 `role="status"`、失败走唯一提示组件 + **真能点**的重试、零结果另给一句人话；
   * ③ 在途：那一行按钮变「正在安装…」且**所有**安装按钮禁用，原因写在页面上看得见的那一句里；
   * ④ 成功一句 `role="status"`；失败只落在**那一行**（人话 + 下一步 + 技术信息里的稳定码）。
   */
  it('turns the query tiers, the fetch states and the install state machine into visible feedback', () => {
    // ① 空闲 / 太短。
    const idle = EnterpriseOnlineSearchPage(onlinePageInput({ query: '   ' }))
    expect(collectByProp(idle, 'data-enterprise-online-state')[0]?.['data-enterprise-online-state']).toBe('idle')
    expect(textOf(idle)).toContain(ENTERPRISE_ONLINE_IDLE)
    const short = EnterpriseOnlineSearchPage(onlinePageInput({ query: 'a' }))
    expect(textOf(short)).toContain(ENTERPRISE_ONLINE_TOO_SHORT)
    expect(collectByProp(short, 'data-enterprise-online-result')).toEqual([])
    const shortButton = collectOfficialButtonProps(short)
      .find(props => props['aria-label'] === ENTERPRISE_ONLINE_SEARCH_LABEL)!
    expect(shortButton['disabled']).toBe(true)
    // 够长时那枚按钮可点（同一枚按钮的两种状态）。
    const readyButton = collectOfficialButtonProps(EnterpriseOnlineSearchPage(onlinePageInput()))
      .find(props => props['aria-label'] === ENTERPRISE_ONLINE_SEARCH_LABEL)!
    expect(readyButton['disabled']).toBe(false)
    // ② 加载 / 失败（真重发）/ 零结果。
    const loading = EnterpriseOnlineSearchPage(onlinePageInput({ state: { kind: 'loading' } }))
    expect(textOf(loading)).toContain(ENTERPRISE_ONLINE_LOADING)
    const onReload = vi.fn()
    const failed = EnterpriseOnlineSearchPage(onlinePageInput({
      state: { kind: 'failed', code: 'ENT_SKILL_SOURCE_UNREACHABLE' }, onReload,
    }))
    expect(collectByProp(failed, 'data-enterprise-error-code')[0]?.['data-enterprise-error-code']).toBe('ENT_SKILL_SOURCE_UNREACHABLE')
    expect(textOf(failed)).toContain('下一步：')
    const retry = collectOfficialButtonProps(failed).find(props => props['aria-label'] === ENTERPRISE_LIST_RETRY_LABEL)!
    retry['onClick']()
    expect(onReload).toHaveBeenCalledTimes(1)
    const empty = EnterpriseOnlineSearchPage(onlinePageInput({ state: { kind: 'empty', value: onlineValue({ results: [] }) } }))
    expect(collectByProp(empty, 'data-enterprise-online-empty').map(props => textOf(props['children'] as ReactNode)))
      .toEqual([ENTERPRISE_ONLINE_EMPTY])
    // 零结果时逐源那两句**照铺**（否则用户以为三个源本来就没东西）。
    expect(collectByProp(empty, 'data-enterprise-online-source-note')).toHaveLength(2)
    // ③ 在途：按钮禁用 + 文案变「正在安装…」+ 页面那句可见原因。
    const source = 'skills-sh:acme/tools/code-review'
    const adopting = EnterpriseOnlineSearchPage(onlinePageInput({ install: { source, name: 'code-review' } }))
    expect(collectByProp(adopting, 'data-enterprise-online-installing')[0]?.['data-enterprise-online-installing']).toBe(source)
    expect(textOf(adopting)).toContain(enterpriseOnlineInstallingText('code-review'))
    const busyButtons = collectOfficialButtonProps(adopting)
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_ONLINE_INSTALL))
    expect(busyButtons.map(props => props['children'])).toEqual([ENTERPRISE_ONLINE_INSTALLING, ENTERPRISE_ONLINE_INSTALL])
    expect(busyButtons.every(props => props['disabled'] === true)).toBe(true)
    // ④ 成功那句 + 失败只落在那一行（含「技术信息」里的码，别的行干净）。
    const installed = EnterpriseOnlineSearchPage(onlinePageInput({ installedNotice: enterpriseOnlineInstalledText('code-review') }))
    expect(textOf(collectByProp(installed, 'data-enterprise-online-installed')[0]?.['children'] as ReactNode))
      .toBe('已安装「code-review」。')
    const installFailed = EnterpriseOnlineSearchPage(onlinePageInput({
      installError: { source, code: 'ENT_SKILL_NAME_CONFLICT' },
    }))
    expect(collectByProp(installFailed, 'data-enterprise-error-code').map(props => props['data-enterprise-error-code']))
      .toEqual(['ENT_SKILL_NAME_CONFLICT'])
    expect(textOf(installFailed)).toContain(ENTERPRISE_ONLINE_INSTALL_FAILED_PREFIX)
    expect(textOf(installFailed)).toContain('请先卸载同名技能再试')
    expect(collectByProp(installFailed, 'data-enterprise-online-result')).toHaveLength(2)
  })

  /**
   * ★ **复审整改（页名重复 / 结果计数 / 就绪播报 / 行上收敛 / 两枚行内动作的档位）**。
   *
   * ① 结果面那一节的**可见名与无障碍名**都换成 `ENTERPRISE_ONLINE_RESULTS_TITLE`（原先它们与页名是
   *   **同一个常量** ⇒ 同屏上下各一遍，节的无障碍名又与外层 `role="region"` 同名）；
   * ② 节头那枚计数是 `enterpriseOnlineCountText(...)` 的产出——视图层原本自己拼 `` `${n} 条结果` ``，
   *   那串既没有任何用例锁过、零结果时还与那句空话同义；
   * ③ 有结果时就绪态补一句 `role="status"` 播报：加载那行在转就绪时**整行消失**，结果区又不是 live
   *   region ⇒ 读屏用户不知道搜完了；**零结果时不叠这一句**，改由那句空话自己带 `role="status"` 播报；
   * ④ 本次会话里已经装好的那一条：**不画**按钮、改画「已装」状态词（反复给按钮 = 反复装同一条）；
   * ⑤「纳入」与「安装」两枚行内动作取官方普通按钮的 `outline` 档（与市场页三处安装按钮同档）——
   *   `ghost` 只靠 hover 出底，**触屏没有 hover**，真机上就是一枚看不出能点的裸文字。
   */
  it('routes the section name, the count and the ready announcement through the projections, and settles an installed row', async () => {
    const tree = EnterpriseOnlineSearchPage(onlinePageInput())
    // ① 节名 ≠ 页名（同屏只说一遍页名；两个 landmark 也不同名）。
    const section = collectByProp(tree, 'data-enterprise-online-results')[0]!
    expect(section['aria-label']).toBe(ENTERPRISE_ONLINE_RESULTS_TITLE)
    expect(collectByClassName(tree, 'own-market-sectionTitle').map(props => textOf(props['children'] as ReactNode)))
      .toEqual([ENTERPRISE_ONLINE_RESULTS_TITLE])
    // ② 计数走投影（真源只有 online-search.ts 一处）。
    expect(textOf(collectByClassName(tree, 'own-market-sectionCount')[0]?.['children'] as ReactNode))
      .toBe(enterpriseOnlineCountText(2))
    const ready = collectByProp(tree, 'data-enterprise-online-ready')[0]!
    expect(ready['role']).toBe('status')
    expect(textOf(ready['children'] as ReactNode)).toBe(enterpriseOnlineReadyText(2))
    // ③ 零结果：计数**整枚缺席**（不再与那句空话同义）、**不**另加播报、那句空话自己是 live region。
    const empty = EnterpriseOnlineSearchPage(onlinePageInput({ state: { kind: 'empty', value: onlineValue({ results: [] }) } }))
    expect(collectByClassName(empty, 'own-market-sectionCount')).toEqual([])
    expect(collectByProp(empty, 'data-enterprise-online-ready')).toEqual([])
    expect(collectByProp(empty, 'data-enterprise-online-empty')[0]?.['role']).toBe('status')
    // ④ 装好的那一条收敛：状态词上屏、那一条**不画**按钮（另一条照旧给按钮）。
    const settledSource = 'skills-sh:acme/tools/code-review'
    const settled = EnterpriseOnlineSearchPage(onlinePageInput({ installedSources: [settledSource] }))
    const settledRow = collectByProp(settled, 'data-enterprise-online-result-installed')[0]!
    expect(settledRow['data-enterprise-online-result-installed']).toBe(settledSource)
    expect(textOf(settledRow['children'] as ReactNode)).toBe(ENTERPRISE_ONLINE_INSTALLED)
    const settledButtons = collectOfficialButtonProps(settled)
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_ONLINE_INSTALL))
    expect(settledButtons.map(props => props['aria-label'])).toEqual([`${ENTERPRISE_ONLINE_INSTALL}meeting-notes`])
    // ⑤ 两枚行内动作的档位（按 aria-label 前缀认出它们，与上面那条既有用例同一套取法）。
    expect(settledButtons.map(props => props['variant'])).toEqual(['outline'])
    const install = collectOfficialButtonProps(tree)
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_ONLINE_INSTALL))
    expect(install.map(props => props['variant'])).toEqual(['outline', 'outline'])
    const adopt = collectOfficialButtonProps(EnterpriseSystemSearchPage(systemPageInput()))
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_SYSTEM_ADOPT))
    expect(adopt).toHaveLength(1)
    expect(adopt[0]?.['variant']).toBe('outline')
    // 源码级反向锁：这一面里不许再出现视图层自己拼的计数文案（真源只有 online-search.ts 一处）。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    const faceStart = source.indexOf('export function EnterpriseOnlineSearchPage(')
    const faceEnd = source.indexOf('\nexport function ', faceStart + 1)
    expect(faceStart).toBeGreaterThan(0)
    expect(source.slice(faceStart, faceEnd)).not.toContain('条结果')
  })

  /**
   * ★ **复审整改（就绪态的重取入口）**：本机技能目录是**外部可变**的（别处刚建好一个目录、用户自己
   *   清了一个），而原先只有**失败态**才有重试 ⇒ 一切正常时用户没有任何入口。这枚「重新盘点」走的是
   *   **同一个** `props.onReload`（真重发，不是刷新页面）；加载 / 失败态**不画**它（失败态由既有那枚
   *   「重试」承担，不给两枚同义入口）。
   */
  it('offers a real reload entry in the ready state, and never a second one next to the failure retry', () => {
    const onReload = vi.fn()
    const ready = EnterpriseSystemSearchPage(systemPageInput({ onReload }))
    const refresh = collectOfficialButtonProps(ready)
      .find(props => props['aria-label'] === ENTERPRISE_SYSTEM_REFRESH_LABEL)!
    expect(refresh['children']).toBe(ENTERPRISE_SYSTEM_REFRESH)
    expect(refresh['variant']).toBe('outline')
    refresh['onClick']()
    expect(onReload).toHaveBeenCalledTimes(1)
    for (const state of [{ kind: 'loading' }, { kind: 'failed', code: 'ENT_LOCAL_UNAVAILABLE' }]) {
      const tree = EnterpriseSystemSearchPage(systemPageInput({ state, onReload }))
      expect(collectOfficialButtonProps(tree).filter(props => props['aria-label'] === ENTERPRISE_SYSTEM_REFRESH_LABEL))
        .toEqual([])
    }
  })

  /* ───────────── 本刀（通过 Agent 创建）：反馈三态 + 复制走 + 不开第二个端口 ───────────── */

  /**
   * ★ **本刀（通过 Agent 创建）**：那一段反馈的三态都看得见，且失败后**唯一**能走的路是一枚真按钮。
   *
   * ① 空闲（`state === undefined` / 整个 port 缺席）⇒ 一枚元素都不画；
   * ② 成功与「已复制」各一句 `role="status"` 人话（说清已经发生什么 + 你只要做什么）；
   * ③ 失败走**唯一**提示组件（人话 +「下一步：」+ 折进技术信息的稳定码），旁边那枚「复制这句指令」
   *    **真能点**，且点它交回去的正是**刚发出去的那一段草稿**（复制的内容 === 发出去的内容）；
   * ④ 复制失败换另一枚码（下一步不同），那枚按钮同时就是重试入口。
   */
  it('shows the agent-creation feedback, and offers the draft copy as the one real way out of a failure', () => {
    const draft = buildSkillCreateDraft()
    // ① 没有接线面 / 空闲：一枚元素都不画。
    expect(collectByProp(EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true }), 'data-enterprise-skill-create'))
      .toEqual([])
    expect(collectByProp(EnterpriseMarketCreateSkillNotice({ port: { state: undefined, onCopy: vi.fn() } }), 'data-enterprise-skill-create'))
      .toEqual([])
    // ② 成功。
    const opened = EnterpriseMarketCreateSkillNotice({ port: { state: { kind: 'opened' }, onCopy: vi.fn() } })
    const openedNote = collectByProp(opened, 'data-enterprise-skill-create')[0]!
    expect(openedNote['data-enterprise-skill-create']).toBe('status')
    expect(openedNote['role']).toBe('status')
    expect(textOf(openedNote['children'] as ReactNode)).toBe(ENTERPRISE_SKILL_CREATE_OPENED)
    // ② 复制成功那句也走同一个落点。
    const copied = EnterpriseMarketCreateSkillNotice({ port: { state: { kind: 'copied' }, onCopy: vi.fn() } })
    expect(textOf(collectByProp(copied, 'data-enterprise-skill-create')[0]?.['children'] as ReactNode))
      .toBe(ENTERPRISE_SKILL_CREATE_COPIED)
    // ③ 失败：唯一提示组件 + 真能点的复制按钮；交回去的草稿与构造器产出的**逐字相同**。
    const onCopy = vi.fn()
    const failed = EnterpriseMarketCreateSkillNotice({
      port: { state: { kind: 'failed', code: ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE, draft }, onCopy },
    })
    expect(collectByProp(failed, 'data-enterprise-skill-create')).toEqual([])
    expect(collectByProp(failed, 'data-enterprise-error-code')[0]?.['data-enterprise-error-code'])
      .toBe(ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE)
    expect(textOf(failed)).toContain('下一步：')
    // 失败态那句人话必须指向**屏幕上真有的那枚按钮**（「复制这句指令」），不是一句空劝。
    expect(textOf(failed)).toContain(ENTERPRISE_SKILL_CREATE_COPY)
    const copyButton = collectOfficialButtonProps(failed)
      .find(props => props['aria-label'] === ENTERPRISE_SKILL_CREATE_COPY_LABEL)!
    expect(copyButton['children']).toBe(ENTERPRISE_SKILL_CREATE_COPY)
    copyButton['onClick']()
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(onCopy.mock.calls[0]?.[0]).toBe(draft)
    // ④ 复制失败那枚码：同一枚按钮仍在（它就是重试入口），人话与下一步换了一套。
    const copyFailed = EnterpriseMarketCreateSkillNotice({
      port: { state: { kind: 'failed', code: ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE, draft }, onCopy },
    })
    expect(collectByProp(copyFailed, 'data-enterprise-error-code')[0]?.['data-enterprise-error-code'])
      .toBe(ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE)
    expect(textOf(copyFailed)).toContain('剪贴板权限')
    expect(collectOfficialButtonProps(copyFailed)
      .filter(props => props['aria-label'] === ENTERPRISE_SKILL_CREATE_COPY_LABEL)).toHaveLength(1)
  })

  /**
   * ★ **本刀（通过 Agent 创建）：绝不新造第二个「开会话」端口**。
   *
   * 控制器只有**一处**注入面（`useEnterpriseMarketController` 的 `presetLaunch`），它被用在两处：
   * 配方第二级降级链与本刀这一项。任何「第二个端口 / 第二套官方结构面接线」都会让这条红。
   */
  it('reuses the one and only session-launch port for the agent-creation item', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 同一个端口被两条通路用（配方那一级 + 本刀）。
    expect((source.match(/presetLaunch\(/g) ?? []).length).toBe(2)
    // 本刀那条通路的形状：先构造草稿、再交给同一个端口；成功/失败都落三态反馈（没有静默分支）。
    expect(source).toMatch(/const draft = buildSkillCreateDraft\(\)[\s\S]{0,200}presetLaunch\(draft\)/)
    expect(source).toMatch(/setSkillCreate\(ok[\s\S]{0,200}ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE/)
    // 没有第二个端口类型 / 没有直接碰官方结构面（那是 preset-launch.ts 与 client.tsx 的活）。
    for (const forbidden of ['EnterpriseSkillCreateLaunchPort', 'openWorkspace', 'setDraft']) {
      expect(source, forbidden).not.toContain(forbidden)
    }
    // 复制走那条路用的是既有的剪贴板写法（与配方第三级同一个 API），没有引入新依赖。
    expect(source).toContain('navigator.clipboard')
  })

  /**
   * **五支视图**（列表 / 技能详情 / 配方详情 / 系统搜索结果面 / **在线搜索结果面**）都必须挂同一份
   * **页面级 chrome** —— 源码级逐支锁（`{pageChrome}` 恰好五处）。这份 chrome 装两样东西：
   * **本地导入**那枚恒不可见的文件选择器（task-3）与**通过 Agent 创建**那条反馈（task-9）。
   * 每一支里「添加」下拉照样在场，少挂一处就是「在那一面里点本地导入 / 通过 Agent 创建、界面毫无反应」
   * 的死控件。
   */
  it('mounts the page chrome into all five views of the shell', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect((source.match(/\{pageChrome\}/g) ?? []).length).toBe(5)
    // 这份 chrome 里**两样**都在（不是只搬了其中一样；搬漏一样就是其中一项没反馈）。
    expect(source).toContain('<EnterpriseMarketSkillImportChrome port={props.skillImport} />')
    expect(source).toContain('<EnterpriseMarketCreateSkillNotice port={props.skillCreate} />')
    // 触发它们的「添加」下拉只有一处实现（标题行槽那一格），本次改动没有新增第二个下拉。
    expect((source.match(/<EnterpriseMarketAddMenuView/g) ?? []).length).toBe(2)
  })

  /* ───────────── 本刀（系统搜索 → 纳入）：结果面 = 页内视图切换 + 纳入四条可见反馈 ───────────── */

  /** 一份盘点真值：一枚在的根、一枚不存在的根，三条候选各占一态（可纳入 / 命名冲突 / 已装）。 */
  function systemValue(over: Partial<{ roots: readonly any[]; skills: readonly any[] }> = {}) {
    const root = { id: 'user-dsh', path: '/data/user/0/com.deepcode.shell/files/.dsh/skills', present: true }
    const absent = { id: 'other-cli', path: '/opt/other/skills', present: false }
    const base = `${root.path}`
    return {
      roots: [root, absent],
      skills: [
        { path: `${base}/code-review`, rootId: 'user-dsh', name: 'code-review', displayName: '代码审查', description: '把代码审查规则带进新会话。', state: 'available' },
        { path: `${base}/taken`, rootId: 'user-dsh', name: 'taken', state: 'conflict' },
        { path: `${base}/done`, rootId: 'user-dsh', name: 'done', state: 'registered' },
      ],
      ...over,
    }
  }

  /** 结果面的输入（唯一构造点在控制器里；这里按同一形状直调那枚纯组件）。 */
  function systemPageInput(over: Record<string, unknown> = {}): EnterpriseSystemSearchPageProps {
    return {
      state: { kind: 'ready', value: systemValue() },
      onAdopt: vi.fn(),
      onReload: vi.fn(),
      onBack: vi.fn(),
      ...over,
    } as EnterpriseSystemSearchPageProps
  }

  /** 与「系统搜索」那一整段控制器源码（测试里只做源码级判据，故按段落切片即可）。 */
  function sourceOfSystemFlow(): string {
    const source = readFileSync(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    const start = source.indexOf('const [systemSearchOpen, setSystemSearchOpen]')
    const end = source.indexOf('const systemSearch: EnterpriseSystemSearchPageProps')
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    return source.slice(start, end)
  }

  /**
   * ★ **本刀（系统搜索）：结果面是页内视图切换，不是弹窗**（口径 15）。
   *
   * 四件一起锁：① `systemSearch` 非空 = **整页切换**（列表 / 页签条 / 节容器整段不挂载），
   * 与技能/配方详情**同一条**形态；② 树里**没有** `role="dialog"`、没有 portal、没有遮罩类；
   * ③ 承载形式是一枚 `role="region"` + `tabIndex={-1}` 的容器（进面后焦点落它，读屏立刻报出这一面）；
   * ④ 返回只有两条真路径（面包屑按钮 + Esc，后者是控制器里钉在本页根节点上的那一条）。
   */
  it('opens the system-search result face as an in-page view switch — never a dialog, never a portal', async () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, systemSearch: systemPageInput() })
    // ① 整页切换：工具行（页签条 / 搜索框 / 筛选）与四个 tabpanel 一个都不在。
    expect(collectByClassName(tree, 'own-market-searchRow')).toEqual([])
    expect(collectByRole(tree, 'tab')).toEqual([])
    expect(collectByRole(tree, 'tablist')).toEqual([])
    expect(collectByRole(tree, 'tabpanel')).toEqual([])
    // ② 无弹层语义：没有 dialog role，也没有第二个详情容器（结果面就是那**一个** region）。
    expect(collectByRole(tree, 'dialog')).toEqual([])
    expect(collectByRole(tree, 'region')).toHaveLength(1)
    // ③ 承载形式与焦点落点：region + aria-label + tabIndex=-1（程序化聚焦）。
    const region = collectByRole(tree, 'region')[0]!
    expect(region['aria-label']).toBe(ENTERPRISE_SYSTEM_TITLE)
    expect(region['tabIndex']).toBe(-1)
    expect(region['data-enterprise-system-page']).toBe('true')
    // ④ 面包屑是可见的返回入口（完整无障碍名 + 我们自己的可见文案）。
    const crumb = collectByClassName(tree, 'own-market-crumb')[0]!
    expect(crumb['aria-label']).toBe(ENTERPRISE_SYSTEM_BACK_LABEL)
    expect(textOf(crumb['children'] as ReactNode)).toContain(ENTERPRISE_SYSTEM_BACK_TEXT)
    // 源码级反向锁：这一面不许引入 portal / dialog 语义。
    // ★ 判据**只圈这一面那一段源码**（不是整个文件）：本文件里另有**一处**合法 dialog——
    //   配方一键启用那份授权弹层（`role="dialog"`，用户明确要求过的确认层），把它一起算进来
    //   只会让这条断言变成「整个文件永远不许有 dialog」，那不是本刀要锁的东西。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(source).not.toContain('createPortal')
    const faceStart = source.indexOf('export function EnterpriseSystemSearchPage(')
    // 切到**下一个**导出的函数为止（不写死下一个函数的名字：那一面之后还会再插新面）。
    const faceEnd = source.indexOf('\nexport function ', faceStart + 1)
    expect(faceStart).toBeGreaterThan(0)
    expect(faceEnd).toBeGreaterThan(faceStart)
    const faceSource = source.slice(faceStart, faceEnd)
    expect(faceSource).not.toContain('role="dialog"')
    expect(faceSource).not.toContain('createPortal')
    // 这一面里**只有**那一枚 region（没有第二层承载容器）。
    expect((faceSource.match(/role="region"/g) ?? []).length).toBe(1)
    // 切面那一道判据本身也在源码里（否则「列表整段不挂载」这句话会变成一句注释）。
    expect(source).toContain('if (props.systemSearch !== undefined)')
    // Esc 那条真路径：监听钉在本页根节点上（不是 document），且只在结果面开着时挂。
    expect(source).toMatch(/if \(!systemSearchOpen\) return[\s\S]{0,200}marketRoot\.current[\s\S]{0,300}Escape/)
    // 返回后还原滚动位置（点击那一下读、返回时写回；判定复用既有 `scrollTargetOf`）。
    expect(source).toMatch(/onOpenSystemSearch[\s\S]{0,300}scrollTargetOf\(marketRoot\.current\)/)
    expect(source).toMatch(/systemScrollMemory\.current[\s\S]{0,200}scrollTop = saved\.top/)
  })

  /**
   * ★ **本刀（系统搜索）：按根分组 + 两种空话 + 每条候选的诚实交代**。
   *
   * 锁五件事：① 分组顺序 = Host 的根顺序；② 「根不存在」与「根在但零候选」是**两句不同**的人话；
   * ③ 标题取 frontmatter 技能名、描述缺席就整行不出、目录名进那一句 note；④ 三态中文上屏；
   * ⑤ **只有可纳入那一条**有按钮，另两态在行上写清为什么没有动作。
   */
  it('groups candidates per root with the two kinds of empty sentence and one action per adoptable row', () => {
    const input = systemPageInput()
    const tree = EnterpriseSystemSearchPage(input)
    const sections = collectByProp(tree, 'data-enterprise-system-root')
    expect(sections.map(props => props['data-enterprise-system-root'])).toEqual(['user-dsh', 'other-cli'])
    // 根的人话标签：唯一那枚本机根给「本机技能目录」，注入的根用 id；绝对路径只在 title 里（展示事实）。
    // ★ 本刀（复审整改）：本机根那枚标签**与页名逐字相同** ⇒ 那枚可见节头**不画**（画了屏幕上就是
    //   「本机技能目录」上下各一遍），只留它右边那枚计数；另一枚根（标签 ≠ 页名）照旧出节头。
    const titles = collectByClassName(tree, 'own-market-sectionTitle')
    expect(titles.map(props => textOf(props['children'] as ReactNode))).toEqual(['other-cli'])
    expect(titles[0]!['title']).toBe('/opt/other/skills')
    // 两节的**无障碍名**：会与页名重复的那一节换成中性词，另一枚照旧用根的人话标签
    //   ⇒ 两个 landmark 不同名，也与外层 `role="region"`（页名）不同名。
    expect(sections.map(props => props['aria-label'])).toEqual([ENTERPRISE_SYSTEM_SECTION_LABEL, 'other-cli'])
    // ② 不存在的那枚根：用「这个位置还没有技能目录」那句（**不是**「没有找到技能目录」那句）。
    const rootNotes = collectByProp(tree, 'data-enterprise-system-root-note')
    expect(rootNotes.map(props => textOf(props['children'] as ReactNode))).toEqual([ENTERPRISE_SYSTEM_ROOT_ABSENT])
    // 零候选的根（present=true）用另一句 —— 两句都要求得出来，故这里再单独跑一份真值。
    const presentEmpty = EnterpriseSystemSearchPage(systemPageInput({
      state: { kind: 'empty', value: { roots: [{ id: 'user-dsh', path: '/p', present: true }], skills: [] } },
    }))
    expect(collectByProp(presentEmpty, 'data-enterprise-system-root-note').map(props => textOf(props['children'] as ReactNode)))
      .toEqual([ENTERPRISE_SYSTEM_ROOT_EMPTY])
    // 零候选时那句**整体**空话也在（两个层次都要有：一个是整台机器，一个是某个位置）。
    expect(collectByProp(presentEmpty, 'data-enterprise-system-empty').map(props => textOf(props['children'] as ReactNode)))
      .toEqual([ENTERPRISE_SYSTEM_EMPTY])
    // ③④⑤ 三条候选各一行：状态中文与（另两态的）原因都看得见。
    const rows = collectByProp(tree, 'data-enterprise-system-skill')
    expect(rows.map(props => props['data-enterprise-system-skill-state'])).toEqual(['available', 'conflict', 'registered'])
    const notes = collectByProp(tree, 'data-enterprise-system-skill-note').map(props => textOf(props['children'] as ReactNode))
    expect(notes[0]).toBe(`${ENTERPRISE_SYSTEM_DIRECTORY_PREFIX}code-review · ${ENTERPRISE_SYSTEM_STATE_AVAILABLE}`)
    expect(notes[1]).toContain(ENTERPRISE_SYSTEM_CONFLICT_NOTE)
    expect(notes[2]).toContain(ENTERPRISE_SYSTEM_REGISTERED_NOTE)
    // 标题：有 frontmatter 技能名用名字，没有就用目录名；描述缺席的那两条没有第二行。
    expect(collectByClassName(tree, 'own-market-cardId').map(props => textOf(props['children'] as ReactNode)))
      .toEqual(['代码审查', 'taken', 'done'])
    expect(collectByClassName(tree, 'own-market-cardDesc')).toHaveLength(1)
    // ⑤ 只有可纳入那一条有【纳入】；另两行**一个按钮都不画**（能走的路才画，原因写在行上）。
    const adoptButtons = collectOfficialButtonProps(tree)
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_SYSTEM_ADOPT))
    expect(adoptButtons).toHaveLength(1)
    expect(adoptButtons[0]!['aria-label']).toBe(`${ENTERPRISE_SYSTEM_ADOPT}代码审查`)
    expect(adoptButtons[0]!['children']).toBe(ENTERPRISE_SYSTEM_ADOPT)
    expect(adoptButtons[0]!['disabled']).toBe(false)
    // 点它 = 把**那一条**候选（含 canonical path）原样交回控制器。
    const onAdopt = vi.fn()
    const clickable = EnterpriseSystemSearchPage(systemPageInput({ onAdopt }))
    const button = collectOfficialButtonProps(clickable)
      .find(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_SYSTEM_ADOPT))!
    button['onClick']()
    expect(onAdopt).toHaveBeenCalledTimes(1)
    expect(onAdopt.mock.calls[0]?.[0]).toMatchObject({ path: `${systemValue().roots[0]!.path}/code-review`, state: 'available' })
  })

  /**
   * ★ **本刀（系统搜索）：加载 / 失败 / 纳入的四条可见反馈**。
   *
   * ① 加载中有一句 `role="status"`（不空白）；② 失败走唯一提示组件 + **真能点**的重试
   * （点它真的调 `onReload`）；③ 在途：那一行按钮变「正在纳入…」且**所有**纳入按钮禁用，
   * 原因写在页面上看得见的那一句里；④ 成功一句 `role="status"`；⑤ 失败只落在**那一行**上
   * （人话 + 下一步 + 技术信息里的稳定码），别的行不受影响。
   */
  it('turns the discover / adopt state machine into visible feedback', () => {
    // ① 加载中。
    const loading = EnterpriseSystemSearchPage(systemPageInput({ state: { kind: 'loading' } }))
    expect(collectByProp(loading, 'data-enterprise-system-state')[0]?.['data-enterprise-system-state']).toBe('loading')
    expect(textOf(loading)).toContain(ENTERPRISE_SYSTEM_LOADING)
    // ② 失败：唯一提示组件 + 真重发。
    const onReload = vi.fn()
    const failed = EnterpriseSystemSearchPage(systemPageInput({
      state: { kind: 'failed', code: 'ENT_LOCAL_UNAVAILABLE' }, onReload,
    }))
    expect(collectByProp(failed, 'data-enterprise-error-code')[0]?.['data-enterprise-error-code']).toBe('ENT_LOCAL_UNAVAILABLE')
    expect(textOf(failed)).toContain('下一步：')
    // 失败态**不**铺候选行（没有真值就不假装有）。
    expect(collectByProp(failed, 'data-enterprise-system-skill')).toEqual([])
    const retryButton = collectOfficialButtonProps(failed)
      .find(props => props['aria-label'] === ENTERPRISE_LIST_RETRY_LABEL)!
    expect(retryButton['children']).toBe(ENTERPRISE_LIST_RETRY)
    retryButton['onClick']()
    expect(onReload).toHaveBeenCalledTimes(1)
    // ③ 在途：按钮禁用 + 文案变「正在纳入…」，页面上那句**可见原因**也在。
    const path = `${systemValue().roots[0]!.path}/code-review`
    const adopting = EnterpriseSystemSearchPage(systemPageInput({
      adopt: { path, name: '代码审查' },
    }))
    expect(collectByProp(adopting, 'data-enterprise-system-adopting')[0]?.['data-enterprise-system-adopting']).toBe(path)
    expect(textOf(adopting)).toContain(enterpriseSystemAdoptingText('代码审查'))
    const busyButtons = collectOfficialButtonProps(adopting)
      .filter(props => typeof props['aria-label'] === 'string' && (props['aria-label'] as string).startsWith(ENTERPRISE_SYSTEM_ADOPT))
    expect(busyButtons.map(props => props['children'])).toEqual([ENTERPRISE_SYSTEM_ADOPTING])
    // 一次只允许一条：在途时**其余**纳入按钮也禁用（Host 的自装清单是「读—改—写」一份文件）。
    expect(busyButtons.every(props => props['disabled'] === true)).toBe(true)
    // ④ 成功那句是 `role="status"`。
    const adopted = EnterpriseSystemSearchPage(systemPageInput({ adoptedNotice: enterpriseSystemAdoptedText('代码审查') }))
    const status = collectByProp(adopted, 'data-enterprise-system-adopted')
    expect(status[0]?.['data-enterprise-system-adopted']).toBe('true')
    expect(textOf(status[0]!['children'] as ReactNode)).toBe('已纳入「代码审查」。')
    // ⑤ 失败只落在那一行上（含「技术信息」里的稳定码），别的行没有提示。
    const failedAdopt = EnterpriseSystemSearchPage(systemPageInput({
      adoptError: { path, code: 'ENT_SKILL_NAME_CONFLICT' },
    }))
    const notices = collectByProp(failedAdopt, 'data-enterprise-error-code')
    expect(notices.map(props => props['data-enterprise-error-code'])).toEqual(['ENT_SKILL_NAME_CONFLICT'])
    // 前缀说清是「纳入失败」（人话与下一步由唯一映射给）。
    expect(textOf(failedAdopt)).toContain(ENTERPRISE_SYSTEM_ADOPT_FAILED_PREFIX)
    expect(textOf(failedAdopt)).toContain('请先卸载同名技能再试')
    // 只有出错那一行挂提示：其余两行干净。
    const withError = collectByProp(failedAdopt, 'data-enterprise-system-skill')
    expect(withError).toHaveLength(3)
    // ★ 源码级：成功之后**重新盘点**（让 Host 把那一行回成 registered），而不是界面自己把那一条改成
    //   「已装」（乐观切换 = 界面比磁盘更乐观，本仓反复禁掉的那件事）。
    expect(stripComments(sourceOfSystemFlow()))
      .toMatch(/setSystemAdoptedNotice\(enterpriseSystemAdoptedText\(name\)\)[\s\S]{0,200}setSystemAttempt/)
    expect(stripComments(sourceOfSystemFlow())).not.toContain("state: 'registered'")
    // 成功与失败**都**重新盘点（前者让那行变已装、后者让那条 stale 候选如实变形/消失）。
    expect((stripComments(sourceOfSystemFlow()).match(/setSystemAttempt\(current => current \+ 1\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('adds no CSS class for the 企业 badge: only the existing .own-market-tag declaration is reused', async () => {
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    // `.own-market-tag` 在源码里只有**一处**声明（没有为徽章另开第二条规则）。
    expect(source.match(/\.own-market-tag\{/g)).toHaveLength(1)
    const page = EnterpriseMarketLegacyShell({ view: 'page' })
    const css = collectStyleText(page)
    // 那一处声明的正文只有布局两件（flex:none + 等宽数字）——颜色与尺寸全归官方 `Tag` 与 tone。
    expect(cssRuleBody(css, '.own-market-tag')).toBe('flex:none;font-variant-numeric:tabular-nums')
    // 整份 `<style>` 仍被两道字节级判据锁着（长度 + FNV-1a 校验和）；基线值随本刀那份进度动画更新。
    expect(css.length).toBe(LEGACY_STYLE_LENGTH)
    expect(styleChecksum(css)).toBe(LEGACY_STYLE_CHECKSUM)
    // 被声明的类名集合里**没有**为这枚徽章新造的名字，而既有那个类还在。
    const declared = declaredClassNames(source)
    for (const invented of ['own-market-badgeTag', 'own-market-enterprise', 'own-market-enterpriseTag', 'own-market-tagInfo', 'own-market-badge']) {
      expect(declared.has(invented), invented).toBe(false)
    }
    expect(declared.has('own-market-tag')).toBe(true)
  })

  // 详情页顶部压缩的取值锁（本刀核心视觉）：页签条 top 间距 2→0、首个节 top 间距 24→12、
  // 独立计数行（`.own-market-sectionMeta`）整段退场、页签文案自带计数且行高不变（nowrap + 13/20）。
  // 这些数字一旦被改回去（例如又加回 24 / 又插回一行计数），本用例必须红。
  it('locks the compressed detail-page top spacing and the count-in-tab labels', () => {
    // 顶部压缩与「计数并入页签」是两套外壳**共用**的那份 CSS/文案，故两套都要锁同一组取值。
    for (const { label, shell, titleClass } of MARKET_SHELLS) {
      const page = shell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
      const css = collectStyleText(page)
      // 顶部间距：两个取值都收紧到压缩后的定值（节内 gap 不动，仍是 12）。
      const tabsRule = cssRuleBody(css, '.own-market-storeTabs')
      expect(tabsRule, label).toContain('margin:0')
      // ★ **本刀（task-20 B）**：页签条由 flex 改成官方分段控件的 inline-grid（等宽）。
      //   原来这里锁的 `flex-wrap:nowrap`（「不许换行」）在 grid 上已无意义 ⇒ 等价判据换成
      //   `grid-auto-flow:column`（列向排布，**永远不会换行**），锁的意图一字未变。
      expect(tabsRule, label).toContain('grid-auto-flow:column')
      expect(tabsRule, label).toContain('grid-auto-columns:1fr')
      const sectionRule = cssRuleBody(css, '.own-market-section')
      // ★ 本刀起节容器**不再自带顶部间距**（margin-top 归 0 / 整条撤掉）：它原先与搜索行那处
      //   同为 12px，两处相等 ⇒「工具行」与「内容区」一样重、上下等距（用户反馈「上下间隔一直」）。
      //   现在间距**只由 .own-market-searchRow 的 margin-bottom 一处控制**（单点旋钮）。
      expect(sectionRule, label).not.toContain('margin-top:')
      expect(sectionRule, label).toContain('gap:12px')
      // 层次靠两个值**递进**：工具行 → 内容区 20px（单点控制）；分类组之间 40px。
      const searchRule = cssRuleBody(css, '.own-market-searchRow')
      expect(searchRule, label).toContain('margin-bottom:20px')
      expect(searchRule, label).not.toContain('margin-bottom:12px')
      expect(cssRuleBody(css, '.own-market-categoryGroup + .own-market-categoryGroup'), label).toContain('margin-top:40px')
      // 独立计数行退场：类规则整条删除（不留死样式），DOM 里也不再出现该容器。
      expect(cssRuleBody(css, '.own-market-sectionMeta'), label).toBe('')
      expect(collectByClassName(page, 'own-market-sectionMeta'), label).toEqual([])
      // 页签行高不变：单行 nowrap，13/20——计数并入文案后不换行、不撑高页签条。
      const tabRule = cssRuleBody(css, '.own-market-storeTab')
      expect(tabRule, label).toContain('white-space:nowrap')
      expect(tabRule, label).toContain('font-size:13px')
      expect(tabRule, label).toContain('line-height:20px')
      // 计数确实落在页签上（技能 1），且压缩没有动到节里的行内容。
      const tabs = collectByRole(page, 'tab')
      expect(tabs.map(tab => tab['children']), label).toEqual(['技能 1', '插件 0', '配方 0', '组件 4'])
      expect(collectSectionByHook(page, 'enterprise-skills'), label).not.toBeUndefined()
      // 行标题类名两套外壳**同源**（同一枚子块渲染同一串类名，版式统一的落点）：都是 9723a97 那套 `.own-market-cardId`。
      expect(collectByClassName(page, titleClass).map(props => props['children']), label).toEqual(['会议纪要技能组'])
    }
    // 纯投影口径：基础词 + 计数，页签文案不会被写成「N 个」那种长写法。
    expect(enterpriseMarketTabLabel('技能', 3)).toBe('技能 3')
    expect(enterpriseMarketTabLabel('组件', 3)).toBe('组件 3')
  })

  // 「企业插件」节：catalog + 本机态归并、仅当「插件」组件 ON 且有记录时渲染。
  it('merges catalog and local records into enterprise plugin rows', () => {
    const catalog = [
      { pluginVersionId: 'v1', packageName: 'ent-a', version: '1.2.0', description: '甲插件的描述。', sizeBytes: 1024, operatingSystems: ['darwin'] },
      { pluginVersionId: 'v2', packageName: 'ent-b', version: '2.0.0', sizeBytes: 2048, operatingSystems: ['darwin'] },
    ] as const
    const local = [
      { packageName: 'ent-b', version: '2.0.0', desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null },
      { packageName: 'ent-c', version: null, desiredRevision: 2, desiredState: 'INSTALLED', state: 'RESTART_REQUIRED', lastErrorCode: null },
    ] as const
    const rows = enterpriseMarketPluginRows(catalog, local)
    // 目录顺序优先，本机独有（ent-c）追加；三行都归并出来。
    expect(rows.map(r => r.packageName)).toEqual(['ent-a', 'ent-b', 'ent-c'])
    // ent-a：只在目录 → 可选安装、版本取目录、inCatalog。
    expect(rows[0]).toMatchObject({ version: '1.2.0', state: 'EXPECTED', inCatalog: true })
    // 描述照解码层同一口径带上来：有就带上（第二行据此说描述）。
    expect(rows[0]?.description).toBe('甲插件的描述。')
    // 目录里没有描述的行**不产出这个键**（缺席＝没有描述＝第二行说「暂无描述」，不塞空串）。
    expect(rows[1]).not.toHaveProperty('description')
    // ent-b：目录 + 本机 ACTIVE → 本机态覆盖。
    expect(rows[1]).toMatchObject({ version: '2.0.0', state: 'ACTIVE', inCatalog: true })
    // ent-c：只在本机（已下架）→ inCatalog false，版本取本机；目录事实缺席，故也没有描述。
    expect(rows[2]).toMatchObject({ version: null, state: 'RESTART_REQUIRED', inCatalog: false })
    expect(rows[2]).not.toHaveProperty('description')
  })

  it('renders the enterprise plugin section only when the plugins component is on and rows exist', () => {
    expect(enterpriseMarketPluginSectionVisible(true, [{ packageName: 'x' } as never])).toBe(true)
    expect(enterpriseMarketPluginSectionVisible(false, [{ packageName: 'x' } as never])).toBe(false)
    expect(enterpriseMarketPluginSectionVisible(true, [])).toBe(false)
    expect(enterpriseMarketPluginSectionVisible(false, [])).toBe(false)
    // 状态点映射：已装 done / 失败 error / 进行中 ongoing / 等待 warning / 其余 idle。
    expect(enterprisePluginDot('ACTIVE')).toBe('done')
    expect(enterprisePluginDot('FAILED')).toBe('error')
    expect(enterprisePluginDot('INSTALLING')).toBe('ongoing')
    expect(enterprisePluginDot('RESTART_REQUIRED')).toBe('warning')
    expect(enterprisePluginDot('EXPECTED')).toBe('idle')
  })

  // 「企业插件」页签在「插件」组件 ON 时渲染插件行、OFF 时不渲染（含 catalog 数据）。
  it('renders the enterprise plugin rows in the 企业插件 tab only when the plugins component is on', () => {
    const enterprisePlugins = [
      { packageName: 'ent-a', version: '1.2.0', description: '把代码审查规则带进新会话。', state: 'ACTIVE', inCatalog: true },
      // 第二行没有描述：**必须**如实降级成「暂无描述」，不许空白、不许拿版本充数。
      { packageName: 'ent-b', version: '2.0.0', state: 'EXPECTED', inCatalog: true },
    ] as const
    for (const { label, shell } of MARKET_SHELLS) {
      // OFF：sessionUsable=false → 「插件」组件未开启 → 本页签里什么都没有（连节容器都不出）。
      const off = shell({ view: 'page', activeTab: 'plugins', sessionUsable: false, enterprisePlugins: enterprisePlugins as never })
      expect(textOf(off), label).not.toContain('ent-a')
      expect(collectSectionByHook(off, 'enterprise-plugins'), label).toBeUndefined()
      // 计数口径锁：页签数字取**真正要渲染的行数**（门控不过即 0），绝不出现「页签说 2 条、面板空白」。
      expect(collectByRole(off, 'tab').map(tab => tab['children']), label).toEqual(['技能 0', '插件 0', '配方 0', '组件 4'])
      // ON：sessionUsable=true → 「插件」组件开启 → 出插件行 + 逐个包名 + 计数。
      const on = shell({ view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: enterprisePlugins as never })
      const text = textOf(on)
      expect(text, label).toContain('ent-a')
      expect(text, label).toContain('ent-b')
      // **第二行 = 插件描述**（本刀）：有描述说描述，没有描述如实降级。
      expect(text, label).toContain('把代码审查规则带进新会话。')
      expect(text, label).toContain('暂无描述')
      // **版本不再上卡片**（用户口径：两行结构、标题行不留多余标签）：标题只显示名称、第二行只显示描述。
      // 版本信息一个字都没丢——它在**详情子页面**里照旧（下面另有详情用例锁着）。
      expect(text, label).not.toContain('v1.2.0')
      expect(text, label).not.toContain('v2.0.0')
      expect(text, label).not.toContain('企业发布 · v')
      // 标题行：**每张卡只有标题一枚子节点**（既没有企业签、也没有版本签）。
      const heads = collectByClassName(on, 'own-market-cardHead')
      expect(heads, label).toHaveLength(2)
      for (const head of heads) {
        // 只有一个子节点时 `children` 是**单个元素**而不是数组，故走 flattenElements 归一。
        expect(flattenElements(head['children'] as ReactNode), label).toHaveLength(1)
      }
      // 插件区里**一枚官方 Tag 都没有**（企业签与版本签都按用户口径撤掉）。
      const tags = collectOfficialTagProps(collectSectionByHook(on, 'enterprise-plugins'))
      expect(tags.map(props => props['children']), label).toEqual([])
      // 计数已并入页签文案（原先节内那行独立的 `2 个` 已删）：这里锁「插件 2」。
      expect(text, label).toContain(enterpriseMarketTabLabel('插件', 2))
      // 节内独立计数行确实不存在（新外壳的 HERO 会另有「2 个企业插件」这句 chip 文案，故不能再用 `2 个` 当代理断言）。
      expect(collectByClassName(on, 'own-market-sectionMeta'), label).toEqual([])
      expect(collectSectionByHook(on, 'enterprise-plugins'), label).not.toBeUndefined()
      // 回归锁：企业插件卡片只两行文案（包名 + 一句话说明），照官方已安装卡片 CardHead——
      // 不含详情页 RowsSection 的 mono 模块名行（那是 rowMain 结构，官方卡片没有）；
      // 也不越界渲染别页签的内容（组件清单只在「组件」页签）。
      expect(text, label).not.toContain('enterprise plugins · catalog')
      expect(text, label).not.toContain('已装 · v')
      expect(text, label).not.toContain('内容清单')
    }
  })

  // 「企业技能」节：目录 → 官方两行卡片行（标题 + 描述），后台预置的全部技能照列、不做过滤或归并。
  it('projects the enterprise skill catalog into official two-line rows without filtering or merging', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组', description: '' },
    ])
    expect(rows.map(row => row.id)).toEqual(['1902500000000000001', '1902500000000000002'])
    // 行带界面真正渲染的两行文案 + 标题行两枚标签的取值 + 中心当前版本：列表投影没有详情时
    // `latestVersionId` 是空串（不猜）；`sourceDshVersion` 是列表投影本来就有的字段（版本签直接用它）。
    expect(rows[0]).toEqual({
      id: '1902500000000000001',
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      sourceDshVersion: '0.1.7-rc.2',
      latestVersionId: '',
    })
    expect(rows[0]?.latestVersionId).toBe('')
    // 分类（服务端新增可选字段）照解码层同一口径投影：有非空值才产出这个键。
    expect(enterpriseMarketSkillRows([SKILL_WITH_CATEGORY])[0]?.category).toBe('研发工具')
    expect(enterpriseMarketSkillRows([SKILL])[0]?.category).toBeUndefined()
    expect(enterpriseMarketSkillRows([{ ...SKILL, category: '' }])[0]?.category).toBeUndefined()
    // 中心当前版本只能从**详情投影**来（列表投影的 versionId 恒为空串）：按 id 归并进行上。
    const merged = enterpriseMarketSkillRows([SKILL], [SKILL_DETAIL])
    expect(merged[0]?.latestVersionId).toBe('1902500000000000101')
    // 详情归并严格按 id：别的包的详情不落到本行（不猜、不错配）。
    expect(enterpriseMarketSkillRows([SKILL], [{ ...SKILL_DETAIL, id: 'x' }])[0]?.latestVersionId).toBe('')
    // 空描述归一为固定占位，与技能 tab 详情弹窗同一句话；目录顺序原样保留，**不做任何过滤**。
    expect(rows[1]?.description).toBe('（暂无描述）')
    expect(enterpriseMarketSkillRows()).toEqual([])
  })

  it('renders the enterprise skill section only when the skills component is on and the catalog is non-empty', () => {
    expect(enterpriseMarketSkillSectionVisible(true, [{ id: '1' } as never])).toBe(true)
    expect(enterpriseMarketSkillSectionVisible(false, [{ id: '1' } as never])).toBe(false)
    expect(enterpriseMarketSkillSectionVisible(true, [])).toBe(false)
    expect(enterpriseMarketSkillSectionVisible(false, [])).toBe(false)
  })

  // 默认页签（「企业技能」）在「技能」组件 ON 且目录非空时渲染技能行、OFF 时不渲染；
  // 两套外壳的**语义**（门控 / 计数并入页签 / 标题+描述两行 / 官方 Switch 是主控件 / 数据钩子）必须一致，
  // 而且（版式统一后）**行版式的类名与取值也完全一致**：两套外壳的目录行都由同一枚子块
  // `EnterpriseMarketInlineRows` 渲染，故下面同一组类名断言对两套外壳各跑一遍。
  it('renders the skill tab with the 安装 button as the not-installed control in both shells', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    for (const { label, shell, titleClass, descClass } of MARKET_SHELLS) {
      // OFF：sessionUsable=false → 「技能」组件未开启 → 默认页签里什么内容都没有（节容器都不出）。
      const off = shell({ view: 'page', sessionUsable: false, enterpriseSkills })
      expect(collectSectionByHook(off, 'enterprise-skills'), label).toBeUndefined()
      expect(textOf(off), label).not.toContain('会议纪要技能组')
      // ON：两行文案 + 计数（原先那行独立的 `1 个` 已删，计数并入页签文案 `技能 1`）。
      const on = shell({ view: 'page', sessionUsable: true, enterpriseSkills })
      const text = textOf(on)
      expect(text, label).toContain(enterpriseMarketTabLabel('技能', 1))
      // 节内独立计数行确实不存在（新外壳的 HERO 另有「共 1 个企业技能」这句 chip 文案，
      // 故「正文不含 `N 个`」不再是这条语义的代理断言——改锁那个容器本身）。
      expect(collectByClassName(on, 'own-market-sectionMeta'), label).toEqual([])
      // 两行结构：第 1 行标题、第 2 行描述各自成行（类名各自指认外壳，证明两套外观不同源）。
      expect(collectByClassName(on, titleClass).map(props => props['children']), label).toEqual(['会议纪要技能组'])
      expect(collectByClassName(on, descClass).map(props => props.children), label)
        .toEqual(['把会议录音与转写整理成结构化纪要。'])
      // 标题行容器那两枚签在同一个 head 里（两套外壳共用 `.own-market-cardHead`）。
      expect(collectByClassName(on, 'own-market-cardHead'), label).toHaveLength(1)
      // 旧元信息行退场：不再堆「DSH 版本 · 大小 · N 个技能」。
      expect(text, label).not.toContain('DSH 0.1.7-rc.2')
      // **未装行不出任何辅助标签**（那枚按钮只在「有更新」时出现，见下面的独立用例）。
      expect(collectByClassName(on, 'own-market-skillTag'), label).toEqual([])
      expect(collectDataValues(on, 'data-enterprise-skill-tag'), label).toEqual([])
      // 未装行 ⇒ 「安装」那一格（本刀卡片不再用开关，故行上**一枚 Switch 都没有**）。
      expect(collectSwitchProps(on), label).toEqual([])
      const install = skillInstall(on)
      expect(install, label).toBeDefined()
      // 未注入动作即禁用（不提供假入口），但语义照旧是「安装」方向。
      expect(install?.['disabled'], label).toBe(true)
      expect(install?.['aria-label'], label).toBe('安装企业技能 会议纪要技能组')
      // 数据钩子命名与企业插件节同风格（`enterprise-skills`）；别页签的节不在树上。
      expect(collectSectionByHook(on, 'enterprise-skills'), label).not.toBeUndefined()
      expect(collectSectionByHook(on, 'enterprise-plugins'), label).toBeUndefined()
      // 受管态仍如实落在行上（`AVAILABLE` = 未装可装，那枚开关据此关闭）。
      expect(collectDataValues(on, 'data-enterprise-skill-state'), label).toEqual(['AVAILABLE'])
      // 注入动作后开关可拨：拨一次即把 (row, next=true) 交给调用方（= 一键安装）。
      const onToggleSkill = vi.fn()
      const wired = shell({ view: 'page', sessionUsable: true, enterpriseSkills, onToggleSkill })
      const wiredInstall = skillInstall(wired)!
      expect(wiredInstall['disabled'], label).toBe(false)
      expect(wiredInstall['title'], label).toBe('安装到 ~/.dsh/skills')
      wiredInstall['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: '1902500000000000001' }), true)
    }
    // **版式统一的核心口径**：新外壳不再有卡片网格/卡片外壳/卡片标题，目录行与旧外壳**同一套**——
    // 行类名逐项相同、行取值 CSS 逐字节相同（同一枚子块 `EnterpriseMarketInlineRows` 渲染同一份 `rowStyles`）。
    const store = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills })
    expect(collectByClassName(store, 'own-market-rows')).toHaveLength(1)
    expect(collectByClassName(store, 'own-market-cardId').map(props => props['children'])).toEqual(['会议纪要技能组'])
    expect(collectByClassName(store, 'own-market-cardDesc').map(props => props.children))
      .toEqual(['把会议录音与转写整理成结构化纪要。'])
    // 卡片时代那套类名与规则**整组退场**（DOM 与 CSS 都不留死骨头）。
    const CARD_ERA_CLASSES = [
      'own-market-cardShell', 'own-market-cardGrid', 'own-market-cardContent', 'own-market-cardMainRow',
      'own-market-cardTitle', 'own-market-cardDescription', 'own-market-cardTrailing', 'own-market-cardActions',
      'own-market-phaseDot', 'own-market-configTag', 'own-market-rowStatus',
    ] as const
    const storeCss = collectStyleText(store)
    for (const dead of CARD_ERA_CLASSES) {
      expect(collectByClassName(store, dead), dead).toEqual([])
      expect(cssRuleBody(storeCss, `.${dead}`), dead).toBe('')
    }
    // 卡片时代那套「两列网格 + 窄屏单列」也随卡片一起退场（通栏行按容器宽度自适应，不再需要 520 断点）。
    expect(storeCss).not.toContain('@container')
    expect(storeCss).not.toContain('max-width:520px')
    // 行取值与旧外壳逐字节同源（同一份 `rowStyles`，两套外壳都渲染它）。
    const legacy = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills })
    const legacyCss = collectStyleText(legacy)
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('font-size:15px')
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('text-overflow:ellipsis')
    expect(cssRuleBody(legacyCss, '.own-market-cardDesc')).toContain('font-size:13px')
    expect(cssRuleBody(legacyCss, '.own-market-cardDesc')).toContain('-webkit-line-clamp:1')
    for (const selector of ['.own-market-cardId', '.own-market-cardDesc']) {
      expect(cssRuleBody(storeCss, selector), selector).toBe(cssRuleBody(legacyCss, selector))
    }
    expect(collectByClassName(legacy, 'own-market-cardDetails')).toEqual([])
  })

  // 标题行（第 1 行）新增两枚只读标签：**版本签**取列表投影本来就有的 `sourceDshVersion`（无需服务端改动）、
  // **分类签**取服务端新增的可选字段 `category`。为缺失设计：分类缺席/null/空串时整枚签不渲染（安静缺席）。
  // 本刀（图标彩色，参考官方）：几何仍照官方行图标（40×40 + `.5px solid border-l3` + `radius-md`），
  // 只把 `color` 换成官方那套**彩色静态词汇** `--dsw-static-*`（官方 ui-primitives 的
  // `FileTypeIcon.module.css` 逐类就是 `color: var(--dsw-static-<hue>-<step>)`，这是官方唯一的彩色图标家族）；
  // 没有品牌图资产，故按**类别**上色（技能 / 插件 / 配方 / 资料库），标记落在 `data-icon-kind` 上。
  // 本刀（图标白底 + 安装钮独立 hover）：两件都是用户口径，各给一条反锁。
  // 用户口径：更多按钮太窄、三个点要宽些 ⇒ 加宽到 36px、图标 20px，**高度仍与安装钮同 28px**。
  it('widens the more button and enlarges its dots while keeping the install-button height', async () => {
    const css = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true }))
    const more = cssRuleBody(css, '.own-market-moreBtn')
    expect(more).toContain('width:36px')
    expect(more).toContain('height:28px')
    expect(css).toContain('.own-market-moreBtn{display:inline-grid;place-items:center;width:36px;height:28px')
    // 三个点的图标放大到 20px（源码级：这是唯一的 MoreHorizontal 渲染点）。
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    expect(source).toContain('<MoreHorizontal aria-hidden size={20} />')
    expect(source).not.toContain('<MoreHorizontal aria-hidden size={16} />')
  })

  it('gives the row icon an opaque white plate and the install button its own hover token', () => {
    const css = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true }))
    // ① 图标容器**白底不透明**（卡片 hover 变灰时图标仍是白块）——反锁：不许退回 transparent/none。
    const icon = cssRuleBody(css, '.own-market-rowIcon')
    expect(icon).toContain('var(--dsw-alias-background-primary')
    expect(icon).not.toContain('background:none')
    expect(icon).not.toContain('background:transparent')
    // ② 安装钮 = 官方 **outline 档**，**本文件故意不覆盖它的任何背景**（反向锁：查无此规则）。
    //    ★ task-21 两次更正：原先填 background-primary —— 那枚 token 在本版 DSH 里不被定义
    //    （var 的兜底 #fff 在生效）⇒ 深色主题下白字压白、字看不见；随后改照官方 .toolbar 变体
    //    （button-tool-bar-fill）—— token 名对、色也随主题翻，但**档位错了**：官方 outline 按钮在
    //    浅色下本该是**白底黑字**，被盖成了工具栏灰（浅色真机截图确认）。⇒ 正解是**什么都不覆盖**，
    //    让官方 .outline 的 background:transparent + 0.5px 描边 + label-primary 在两套主题里自己生效。
    expect(cssRuleBody(css, '.own-market-installBtn')).toBe('')
    expect(css).not.toContain('.own-market-installBtn.own-market-installBtn')
    // 卡片 hover 仍是那一枚（两处不是同一个 token，故视觉上分得开）。
    expect(cssRuleBody(css, '.own-market-row:hover')).toContain('var(--dsw-alias-interactive-bg-hover)')
    expect(cssRuleBody(css, '.own-market-row:hover')).not.toContain('button-tool-bar-hover')
  })

  /**
   * ★ **反向锁（这条是本刀存在的全部理由）**：隐藏官方详情页左上角那枚 48×48 图标的规则
   * **必须出现在列表视图这一份 `<style>` 里**。
   *
   * 官方那枚图标渲染在**旧外壳列表分支**的官方 `ItemDetail` → `DetailTop` 里，而这一份
   * `<style>` 正是那个分支挂的（baseStyles + rowStyles）。**它曾经被写进 `detailStyles`**
   * ——而 detailStyles 只在技能/配方详情子页面挂载 ⇒ 规则在图标真正出现的那页面上**压根不存在**，
   * 真机验收「图标没消失」就是栽在这里（选择器本身是对的：`[class*="_cardIcon"]` 后缀匹配
   * 能命中真机的 `u9Hv6q_cardIcon`）。
   *
   * 这条锁比「detailStyles 不含它」更直接：**它锁的是真实需求（这条规则必须在场），
   * 而不是锁某张表的否定**。下一个人再把规则挪走，这条立刻红。
   */
  it('keeps the rule that hides the official detail icon in the list-view stylesheet', () => {
    const listCss = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))
    // 规则在场，且正文是那一条 display:none（不是被改成别的东西）。
    expect(cssRuleBody(listCss, '[data-plugin-item-detail]:has([class*="_detailSections"] .own-market-entry) [class*="_detailHead"] [class*="_cardIcon"]')).toBe('display:none')
    // 锚点不写死属性值（官方那个值是动态 item.id）；也不许退化成过宽的 span[aria-hidden]
    // （会误伤官方 crumbIcon 那枚同样是 aria-hidden 的 chevron span）。
    // ★ 收口：这条也必须带 :has(...own-market-entry...) 作用域 —— 否则它会连**其它 item 详情**的
    //   官方图标一起藏掉（本仓原先正是这个状态，由下面那条 `bare` 断言守着）。
    expect(listCss).not.toContain('[data-plugin-item-detail="plugin-market"]')
    expect(listCss).not.toContain('span[aria-hidden="true"]{display:none}')
    // 两套外壳的列表分支都带（官方那份 ItemDetail 在哪个外壳下出现，规则都得在场）。
    for (const { label, shell } of MARKET_SHELLS) {
      expect(cssRuleBody(collectStyleText(shell({ view: 'page' })), '[data-plugin-item-detail]:has([class*="_detailSections"] .own-market-entry) [class*="_detailHead"] [class*="_cardIcon"]'), label)
        .toBe('display:none')
    }
  })

  /**
   * ★ **搜索栏那一行 = 官方 Input 那一档**（用户裁决：这一行整体降一档、框线变浅）。
   * 四项逐值取自 pinned `ui-primitives@0.1.5-rc.2/lib/Input.module.css`：
   * `height:32px` / `padding:0 8px` / `border-radius:8px` / `font-size:14px`，
   * 边框取它同一行的 `border: 0.5px solid var(--dsw-alias-border-l4)`；漏斗钮与搜索框同高 32、同款边框。
   * ⚠️ 0.5px 发丝线在低 DPR 屏偏淡是**官方同款取舍**，不是我们偷懒 —— 照做，不偷偷加粗。
   * ★ 图标方框（`.own-market-rowIcon`）**保持官方 border-l3 不动**（用户明确裁决：图标框不参与变浅）。
   * ★ 同一行右侧那两枚动作胶囊（刷新 / ＋添加插件）**保持官方 size=md(36px) 不动**：
   *   官方 sm(28px) 自认「no dedicated figma node」，放在 32px 输入框旁会矮 4px 且不居中，
   *   与用户这轮「变协调」的诉求相反（用户裁决采纳 A 方案）。
   */
  it('keeps the search row on the official Input tier: 32px, 0.5px l4 border, big radius, while the icon frame stays l3', () => {
    const css = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))
    const query = cssRuleBody(css, '.own-market-query')
    expect(query).toContain('height:32px')
    expect(query).toContain('padding:0 8px')
    // 边框 0.5px + l4 逐字照官方 Input；圆角**刻意偏离**官方 Input 的 8px（用户口径要大圆角 → 胶囊档 999px）。
    expect(query).toContain('border:.5px solid var(--dsw-alias-border-l4')
    expect(query).not.toContain('border:1px')
    expect(query).toContain('border-radius:999px')
    expect(cssRuleBody(css, '.own-market-queryInput')).toContain('font-size:14px')
    // ★ **筛选钮是图标按钮、不是输入框**（用户口径「筛选按钮不要外框」）：逐值照官方 _iconButton
    //   （appearance:none; border:0; background:0 0; radius-sm; label-tertiary）。
    //   **0.5px border-l4 只属于搜索框**——这条锁就是防止下一个人又把它当同一类、给图标按钮套上框。
    const filter = cssRuleBody(css, '.own-market-filterBtn')
    expect(filter).toContain('border:0')
    expect(filter).not.toContain('border:1px')
    expect(filter).not.toContain('border-l4')
    expect(filter).toContain('background:0 0')
    expect(filter).toContain('border-radius:var(--dsw-radius-sm')
    expect(filter).toContain('var(--dsw-alias-label-tertiary')
    // 高度仍 32（与搜索框同行齐平）——高度对齐 ≠ 样式同类。
    expect(filter).toContain('width:32px')
    expect(filter).toContain('height:32px')
    // hover 仍有反馈（无框不等于无反馈）。
    expect(cssRuleBody(css, '.own-market-filterBtn:hover')).toContain('background:')
    // 图标方框：40×40 且**仍是 border-l3**（本轮明确不动它）。
    const frame = cssRuleBody(css, '.own-market-rowIcon')
    expect(frame).toContain('border:.5px solid var(--dsw-alias-border-l3')
    expect(frame).not.toContain('border-l4')
  })

  /**
   * ★ **用户裁决 B 锁成事实**：搜索框聚焦时**不得有蓝色 outline 环**，焦点提示**只由边框变色**承担。
   * 提示不丢（边框从常态的 border-l4 变成明显一档的 label-secondary），只是不靠那圈刺眼的蓝框。
   * 这条锁防的是「下一个人看到没有 focus 环，以为无障碍回退、又给加回去」。
   * ★ 同时记一条事实：本文件**另有 10 条** focus 环规则（groupToggle / moreBtn / moreItem /
   *   skillTag / storeTab / filterBtn / filterOption / rowOpen / crumb / fileOpen），
   *   用户本轮只裁决了搜索框这一条，**那些一律未动** —— 焦点可见性是逐控件的取舍，不是一刀切。
   */
  it('drops the blue focus ring on the search box and keeps the cue as a border-colour change', () => {
    const css = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))
    const focus = cssRuleBody(css, '.own-market-query:has(.own-market-queryInput:focus-visible)')
    expect(focus, '聚焦提示必须在场').not.toBe('')
    expect(focus).toContain('border-color:')
    expect(focus, '用户裁决 B：不得再有蓝色 outline 环').not.toContain('outline')
    expect(focus).not.toContain('focus-ring-color')
    // 常态边框仍是官方 Input 的 0.5px l4，聚焦时才换色 ⇒ 提示确实「只在聚焦时」出现。
    expect(cssRuleBody(css, '.own-market-query')).toContain('border:.5px solid var(--dsw-alias-border-l4')
  })

  /**
   * ★ 卡片标题「灰黑」+ 描述「再浅一点」（用户口径）。
   * · 描述：改用官方 `.cardDesc` 那一档 **label-tertiary**（app.asar 逐字同款），原先 secondary 深一档。
   * · 标题：**升一档**改用 label-primary（用户口径「卡片标题颜色再黑点，但不是全黑」）。
   *   本仓 `--dsw-alias-label-*` 只有 primary / secondary / tertiary 三档（官方 token 定义逐字：
   *   primary=static-neutral-bluish-1000、secondary=700、tertiary=600）。primary 官方实测
   *   `#0f1115` —— **本身就不是纯黑**（偏蓝的黑），所以「深但不是纯黑」这条口径**正好落在官方
   *   token 内**，不必造第四个颜色、不插 rgb 字面量。
   *   ★ **本条曾被写反**：早先锁的是 label-secondary（当时的用户口径是「标题灰黑」），并用一段
   *   「primary 与 secondary 之间没有更浅的语义档」的注释把它合理化。用户后来把口径改成「再黑点」，
   *   于是翻转 —— **方向由用户口径定，注释只负责解释为什么落在官方档位内，不负责论证用户该要哪档**。
   */
  it('tones the card title to the official primary and the description to the official tertiary', () => {
    const css = collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))
    expect(cssRuleBody(css, '.own-market-cardId')).toContain('color:var(--dsw-alias-label-primary')
    expect(cssRuleBody(css, '.own-market-cardId')).not.toContain('color:var(--dsw-alias-label-secondary')
    expect(cssRuleBody(css, '.own-market-cardDesc')).toContain('color:var(--dsw-alias-label-tertiary')
    expect(cssRuleBody(css, '.own-market-cardDesc')).not.toContain('color:var(--dsw-alias-label-secondary')
  })

  it('derives each row icon from the item id: initial letter + a hue from existing --dsw-static tokens (task-17 ②)', async () => {
    const tree = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
    })
    const css = collectStyleText(tree)
    // ① **容器仍是官方的**：40px 框 + radius-md + border-l3（用户裁决：图标框不参与变浅）。
    //    本刀只换框**里面**画什么，容器这一层一个字都没动。
    const frame = cssRuleBody(css, '.own-market-rowIcon')
    expect(frame).toContain('width:48px')
    expect(frame).toContain('height:48px')
    expect(frame).toContain('border-radius:var(--dsw-radius-md')
    expect(frame).toContain('border:.5px solid var(--dsw-alias-border-l3')
    // ② **图形尺寸仍是官方 ROW_ARTWORK_SIZE = 30**、viewBox 仍 36（「40 框 + 30 图形」这个配比不动）。
    const rowIcons = collectByClassName(tree, 'own-market-rowIcon')
    expect(rowIcons.length).toBeGreaterThan(0)
    const svgs = collectByTagName(tree, 'svg')
    expect(svgs.length).toBe(rowIcons.length)
    for (const svg of svgs) {
      expect(svg['width'], '图形宽度必须是官方 ROW_ARTWORK_SIZE = 30').toBe(ENTERPRISE_ARTWORK_ROW_SIZE)
      expect(svg['width']).toBe(30)
      expect(svg['height']).toBe(30)
      expect(svg['viewBox']).toBe('0 0 36 36')
    }
    // ③ **首字母**：画的是 `text`，且文字来自该条目的**可见标题**（会议纪要技能组 ⇒ 会）。
    //    ★ 反向锁：那枚「每行都一样」的通用图形 `path` 已**一个都不剩**（这正是可扫性为零的根因）。
    expect(collectByTagName(tree, 'path'), '通用图形必须已被首字母取代').toHaveLength(0)
    const texts = collectByTagName(tree, 'text')
    expect(texts.length).toBe(rowIcons.length)
    for (const node of texts) expect(textOf(node['children'] as ReactNode)).toBe('会')
    // ④ **色相**：两端取自既有的 `--dsw-static-*` token（逐枚同一档），且 `linearGradient` id 逐枚唯一
    //    （写死 id 会让同页几十枚解析到第一个 defs、整页染成同一色 —— 官方为此专门写了 useArtworkId）。
    const gradients = collectByTagName(tree, 'linearGradient')
    expect(gradients.length).toBe(rowIcons.length)
    const ids = gradients.map(el => el['id'])
    expect(new Set(ids).size, '渐变 id 必须逐枚唯一').toBe(gradients.length)
    for (const id of ids) expect(String(id)).toMatch(/^own-market-art-\d+$/)
    const expectedHue = enterpriseArtworkHue(SKILL.id)
    for (const el of gradients) {
      const stops = collectByTagName(el['children'] as ReactNode, 'stop')
      expect(stops.map(s => s['stopColor'])).toEqual([expectedHue.from, expectedHue.to])
      // 两端必须**都是既有 token 的 var() 引用**（不是十六进制字面量、不是新造颜色）。
      for (const stop of stops) expect(String(stop['stopColor'])).toMatch(/^var\(--dsw-static-[a-z]+-\d+\)$/)
    }
    // ⑤ **稳定派生**：同一 id 恒同一档；色相表**恰五档**、十枚 token 全部是仓内既有的 `--dsw-static-*`。
    expect(enterpriseArtworkHue(SKILL.id)).toEqual(expectedHue)
    expect(ENTERPRISE_ARTWORK_HUE_COUNT).toBe(5)
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    for (const token of [
      '--dsw-static-blue-400', '--dsw-static-blue-600',
      '--dsw-static-deepseek-400', '--dsw-static-deepseek-600',
      '--dsw-static-green-400', '--dsw-static-green-500',
      '--dsw-static-amber-400', '--dsw-static-amber-600',
      '--dsw-static-red-400', '--dsw-static-red-600',
    ]) expect(source, token).toContain(token)
    // ⑥ **首字母的边界**：CJK 取整字、ASCII 大写、空白/缺席一律退回 id、彻底取不到给「?」（绝不空白块）。
    expect(enterpriseArtworkInitial('会议纪要技能组', 'x')).toBe('会')
    expect(enterpriseArtworkInitial('meeting notes', 'x')).toBe('M')
    expect(enterpriseArtworkInitial('', 'meeting-notes')).toBe('M')
    expect(enterpriseArtworkInitial('   ', 'meeting-notes')).toBe('M')
    expect(enterpriseArtworkInitial(undefined, 'luhe-paper-free')).toBe('L')
    expect(enterpriseArtworkInitial(undefined, '')).toBe('?')
    // ⑦ **可扫性判据**（这条是本刀的目的）：截图里那六条真实 id **不再全落同一档**。
    const six = ['1902500000000000001', 'luhe-paper-free', 'contextweave-interactive-architecture',
      'owndsh-test-hello', 'meeting-notes', 'luhe-paper-free-pro']
    const hues = six.map(id => `${enterpriseArtworkHue(id).from}`)
    expect(new Set(hues).size, '六个真实条目至少落到三档，否则等于没区分').toBeGreaterThanOrEqual(3)
  })
  it('keeps the skill card to two lines: title on top, description below, no extra tags on the title row', () => {
    // 用户口径（本刀）：卡片两行结构——上面标题、下面描述；标题行**不留多余标签**。
    // 故版本签（own-market-skillVersionTag）与分类签（own-market-skillCategoryTag）都不再上卡片：
    // 分类已由**分组标题**承载（再挂一枚是重复信息），版本改在详情子页面看（那里照旧显示完整坐标）。
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
      })
      expect(collectByClassName(tree, 'own-market-skillVersionTag'), label).toEqual([])
      expect(collectByClassName(tree, 'own-market-skillCategoryTag'), label).toEqual([])
      expect(collectByClassName(tree, 'own-market-skillVersionHint'), label).toEqual([])
      // 标题行**只剩标题**一枚子节点（有分类也一样——分类不参与卡片渲染）。
      const head = collectByClassName(tree, 'own-market-cardHead')[0]
      const headKids = flattenElements(head?.['children'] as ReactNode)
      expect(headKids, label).toHaveLength(1)
      expect(isValidElement(headKids[0]) ? (headKids[0].props as Record<string, unknown>)['children'] : undefined, label)
        .toBe('会议纪要技能组')
      // 第二行 = 描述（两行结构的下一行），类名与取值一字未动。
      expect(collectByClassName(tree, 'own-market-cardDesc').map(props => props.children), label)
        .toEqual(['把会议录音与转写整理成结构化纪要。'])
      // 未装行恒只有那一枚「安装」按钮（卡片上没有别的签、也没有开关）。
      expect(skillInstall(tree)?.['aria-label'], label).toBe('安装企业技能 会议纪要技能组')
      expect(collectSwitchProps(tree), label).toEqual([])
      expect(collectTagProps(tree), label).toEqual([])
    }
    // 分类「缺席 / 空串 / 有值」三种形态**渲染同一棵树**（分类不再参与卡片）：都是一枚标题子节点。
    for (const skills of [
      enterpriseMarketSkillRows([SKILL]),
      enterpriseMarketSkillRows([{ ...SKILL, category: '' }]),
      enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    ]) {
      const bare = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills: skills })
      expect(flattenElements(collectByClassName(bare, 'own-market-cardHead')[0]?.['children'] as ReactNode))
        .toHaveLength(1)
    }
    // 两个纯投影仍在出口上（详情与将来的视图还要用），口径逐条不变：
    // 缺席/null/空串/纯空白都归一成 undefined，有值原样返回。
    expect(enterpriseMarketSkillCategoryTag(undefined)).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag(null)).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag('')).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag('   ')).toBeUndefined()
    expect(enterpriseMarketSkillCategoryTag('研发工具')).toBe('研发工具')
    expect(enterpriseMarketSkillVersionTag('0.1.7-rc.3')).toBe('0.1.7-rc.3')
    expect(enterpriseMarketSkillVersionTag('')).toBeUndefined()
  })

  // 本刀（版本签只显示版本）：真实导入的技能 `sourceDshVersion` 是**完整坐标**
  // （`skillhub.cn/dev-expert@2.0.3`），整串显示会把标题挤成一个字（真机截图已证），故行上只显示短号。
  // 纯投影：含 `@` → 取**最后一个** `@` 之后的部分；不含 `@` → 原样返回（既有技能显示形式一字不变）。
  it('projects the version tag label to the version segment with deterministic boundaries', () => {
    // 五个真实值：用户实测的三条完整坐标 + 既有技能那两种形态（无 `@`，必须原样）。
    expect(enterpriseMarketSkillVersionLabel('skillhub.cn/contextweave-interactive-architecture@1.6.1')).toBe('1.6.1')
    expect(enterpriseMarketSkillVersionLabel('skillhub.cn/cnfinancialscraper@1.0.49')).toBe('1.0.49')
    expect(enterpriseMarketSkillVersionLabel('skillhub.cn/dev-expert@2.0.3')).toBe('2.0.3')
    expect(enterpriseMarketSkillVersionLabel('0.1.7-rc.4')).toBe('0.1.7-rc.4')
    expect(enterpriseMarketSkillVersionLabel('0.2.0-rc.2')).toBe('0.2.0-rc.2')
    // 边界（逐条锁死行为）：无 `@` 原样；多个 `@` 取最后一个之后的段；仅 `@` / 尾部 `@` / 空串都不出签；
    // 不做 trim（尾段原样）；首段 `@` 前后为空也算一次性坐标的合法形态。
    expect(enterpriseMarketSkillVersionLabel('1.2.3')).toBe('1.2.3')
    expect(enterpriseMarketSkillVersionLabel('a@b@c')).toBe('c')
    expect(enterpriseMarketSkillVersionLabel('@1.2.3')).toBe('1.2.3')
    expect(enterpriseMarketSkillVersionLabel('foo@')).toBeUndefined()
    expect(enterpriseMarketSkillVersionLabel('@')).toBeUndefined()
    expect(enterpriseMarketSkillVersionLabel('')).toBeUndefined()
    expect(enterpriseMarketSkillVersionLabel(' skillhub.cn/x@1.2.3 ')).toBe('1.2.3 ')
    // 两枚投影成对：完整坐标只由 `enterpriseMarketSkillVersionTag` 说（title / 详情徽标），短号只给行上签。
    expect(enterpriseMarketSkillVersionTag('skillhub.cn/dev-expert@2.0.3')).toBe('skillhub.cn/dev-expert@2.0.3')
    expect(enterpriseMarketSkillVersionLabel(enterpriseMarketSkillVersionTag('skillhub.cn/dev-expert@2.0.3')!)).toBe('2.0.3')
  })

  // 本刀（列表短号 / 详情全坐标）：行上签显示短号、**完整坐标挂在签的 title 上**；详情页那枚徽标照旧整串显示。
  // 两套外壳共用同一份行子块与同一份 facts，故这里逐外壳跑同一组断言。
  // 详情保留完整坐标：卡片不再显示版本（用户口径：标题行不留多余标签），但**信息一个都没丢**——
  // 详情子页面那枚徽标照旧显示 sourceDshVersion 整串（比短号更全），短号投影仍在出口上供将来用。
  it('keeps the full source coordinate in the skill detail while the card shows no version at all', () => {
    const COORDINATE = 'skillhub.cn/dev-expert@2.0.3'
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true,
        enterpriseSkills: enterpriseMarketSkillRows([{ ...SKILL, sourceDshVersion: COORDINATE }]),
      })
      // ① 卡片上没有任何版本签（连那枚只承载 title 的包装节点都没有）。
      expect(collectByClassName(tree, 'own-market-skillVersionTag'), label).toEqual([])
      expect(collectByClassName(tree, 'own-market-skillVersionHint'), label).toEqual([])
      expect(textOf(tree), label).not.toContain(COORDINATE)
      // ② 详情页那枚徽标照旧显示**完整坐标**（详情信息更全）：同一份 facts 供两处。
      const detailRow = enterpriseMarketSkillRows([{ ...SKILL, sourceDshVersion: COORDINATE }])[0]!
      const detailFacts = enterpriseMarketSkillRowFacts(
        { view: 'page', sessionUsable: true, enterpriseSkills: [detailRow] }, detailRow,
      )
      expect(detailFacts.versionTag, label).toBe(COORDINATE)
      // 短号投影仍在出口上（将来的行内视图），只是卡片这一刀不再消费它。
      expect(detailFacts.versionLabel, label).toBe('2.0.3')
      const detail = EnterpriseSkillDetailPage({
        row: detailRow, facts: detailFacts, fileEntries: [], filesLoading: false, fileLoading: false,
        onSelectFile: () => undefined, onBack: () => undefined,
      })
      expect(textOf(detail), label).toContain(COORDINATE)
      expect(collectByClassName(detail, 'own-market-tag').map(props => props['children']), label).toEqual([COORDINATE])
    }
  })

  // 行高不变的口径（结构性锁）：第 1 行是**单行 nowrap flex**——标签过多时标题先让步省略、两枚签
  // `flex:none` 保持可见；官方 `Tag` 固定 19px 高（1px 上下内衬 + 17px 行高）< head 的 20px 行高，
  // 故加签不改变**标题那一行**的高度。去折叠后卡片内是四段（标题行 / 描述行 / 常显动作条 / 失败提示槽），
  // 但标题行自身仍是「标题 + 两枚签」的 20px 单行。
  it('keeps the skill title row single-line so the tags never grow the row', () => {
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
      })
      const css = collectStyleText(tree)
      const head = cssRuleBody(css, '.own-market-cardHead')
      expect(head, label).toContain('display:flex')
      expect(head, label).toContain('flex-wrap:nowrap')
      expect(head, label).toContain('align-items:center')
      expect(head, label).toContain('line-height:20px')
      expect(head, label).toContain('overflow:hidden')
      // 标题先让步（可收缩 + 继承卡片标题的 nowrap/ellipsis），两枚签 `flex:none` 保持可见。
      expect(cssRuleBody(css, '.own-market-skillTitle'), label).toContain('flex:0 1 auto')
      expect(cssRuleBody(css, '.own-market-skillTitle'), label).toContain('min-width:0')
      expect(cssRuleBody(css, '.own-market-tag'), label).toContain('flex:none')
    }
    // 第 1 行的省略口径：两套外壳共用**同一枚**标题类 `.own-market-cardId`（14/20-500 + nowrap + ellipsis）。
    const store = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    const storeCss = collectStyleText(store)
    expect(cssRuleBody(storeCss, '.own-market-cardId')).toContain('white-space:nowrap')
    expect(cssRuleBody(storeCss, '.own-market-cardId')).toContain('text-overflow:ellipsis')
    // 结构锁（**两套外壳同一套行**）：rowMain 里恰好两行（标题行 head + 描述行 cardDesc），
    // 标签变多只影响标题行内部，不会多出第三段；动作与失败提示落在 rowMain 之外的同一条 rowLine 上。
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
      })
      const main = collectByClassName(tree, 'own-market-rowMain')[0]
      const kids = main?.['children'] as ReactNode[]
      expect(kids, label).toHaveLength(2)
      expect(String((kids[0] as { props?: Record<string, unknown> }).props?.['className']), label).toContain('own-market-cardHead')
      expect(String((kids[1] as { props?: Record<string, unknown> }).props?.['className']), label).toContain('own-market-cardDesc')
      // rowLine 的直属子元素（展开共享动作子块后）= 可点行本体 + 右侧动作（本 fixture 未装、无更新 → 只有那枚官方 Switch）。
      const row = collectByDataProp(tree, 'data-enterprise-skill-package', SKILL.id)[0] as { props?: Record<string, unknown> } | undefined
      const line = collectByClassName(row?.['props']?.['children'] as ReactNode, 'own-market-rowLine')[0]
      const lineKids = rowLineChildren(tree, SKILL.id)
      expect(lineKids, label).toHaveLength(2)
      // 第 0 项是**行本体那枚可点按钮**（图标 + 两行文案都在它里面），第 1 项才是官方 Switch。
      expect((lineKids[0] as { type?: unknown }).type, label).toBe('button')
      expect(String((lineKids[0] as { props?: Record<string, unknown> }).props?.['className']), label)
        .toBe('own-market-rowOpen')
      // 第 1 项是**动作区**（本刀未装 ⇒ 官方 `Button` 的「安装」那一格，不再是 Switch）。
      expect((lineKids[1] as { type?: unknown }).type, label).toBe(Button as unknown)
      expect((lineKids[1] as { props?: Record<string, unknown> }).props?.['data-enterprise-skill-slot'], label).toBe('install')
      expect(collectByClassName(line?.['children'] as ReactNode, 'own-market-inlineError'), label).toEqual([])
    }
    const legacy = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    const legacyCss = collectStyleText(legacy)
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('white-space:nowrap')
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('text-overflow:ellipsis')
  })

  // 已装记录与在途动作是两个彼此独立的输入：判定「已装/在途」只认 Host 真值，从不乐观猜测；
  // 「有更新」只在**两侧 versionId 都拿得到**时才敢说（列表态行没有中心版本 → 一律按已装）。
  it('projects each skill row state from the installed records and the pending action, never from optimism', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    // 未装（清单缺席或为空）→ 可装。
    expect(enterpriseMarketSkillState(undefined, undefined, row)).toBe('AVAILABLE')
    expect(enterpriseMarketSkillState([], undefined, row)).toBe('AVAILABLE')
    // 已装记录命中本行 → 已装；行上没有中心版本（列表态 latestVersionId='') → 不判更新，只说已装。
    expect(enterpriseMarketSkillState([installedSkill('v2')], undefined, row)).toBe('INSTALLED')
    expect(enterpriseMarketSkillState([installedSkill('v1')], undefined, row)).toBe('INSTALLED')
    // 别的包的已装记录不算本行已装（行键 = 技能包 id）。
    expect(enterpriseMarketSkillState([installedSkill('v2', 'x')], undefined, row)).toBe('AVAILABLE')
    // 两侧 versionId 都拿得到且不等 → 有更新（本页唯一敢说「有更新」的条件）。
    const updatable = updatableRow()
    expect(enterpriseMarketSkillState([installedSkill('1902500000000000100')], undefined, updatable)).toBe('UPDATE_AVAILABLE')
    expect(enterpriseMarketSkillState([installedSkill(SKILL_DETAIL.versionId)], undefined, updatable)).toBe('INSTALLED')
    // 在途方向决定「安装中」还是「卸载中」（原先只传 id 时卸载在途会错报安装中）；在途优先于版本判定。
    expect(enterpriseMarketSkillState(undefined, { packageId: row.id, next: true }, row)).toBe('INSTALLING')
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: row.id, next: true }, row)).toBe('INSTALLING')
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: row.id, next: false }, row)).toBe('REMOVING')
    // 有更新的行在途时也只报在途，不混说版本。
    expect(enterpriseMarketSkillState([installedSkill('1902500000000000100')], { packageId: row.id, next: true }, updatable))
      .toBe('INSTALLING')
    // 别的包在途不影响本行；在途优先于已装判定。
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: 'x', next: false }, row)).toBe('INSTALLED')
    expect(enterpriseMarketSkillState([installedSkill('v2')], { packageId: row.id, next: false }, row)).toBe('REMOVING')
  })

  // 「有更新」独立用例：这个结论**只有两侧 versionId 参与**——sha256 换值不改结论、缺任一侧不判。
  it('derives 有更新 from both versionIds only, ignoring sha256 and missing sides', () => {
    const updatable = updatableRow()
    const older = installedSkill('1902500000000000100')
    // 两侧非空且不等 → 有更新；相等 → 无。
    expect(enterpriseMarketSkillHasUpdate(older.versionId, updatable.latestVersionId)).toBe(true)
    expect(enterpriseMarketSkillHasUpdate(SKILL_DETAIL.versionId, SKILL_DETAIL.versionId)).toBe(false)
    // 缺任一侧（未装 / 详情没取到）一律 false：宁可少说一句，也不猜「有更新」。
    expect(enterpriseMarketSkillHasUpdate('', updatable.latestVersionId)).toBe(false)
    expect(enterpriseMarketSkillHasUpdate(older.versionId, '')).toBe(false)
    expect(enterpriseMarketSkillHasUpdate('', '')).toBe(false)
    // 行的判定入口：行键必须命中已装记录（别的包的记录不算）。
    expect(enterpriseMarketSkillRowHasUpdate([older], updatable)).toBe(true)
    expect(enterpriseMarketSkillRowHasUpdate(undefined, updatable)).toBe(false)
    expect(enterpriseMarketSkillRowHasUpdate([{ ...older, packageId: 'x' }], updatable)).toBe(false)
    // **sha256 不参与**：本机记录的 sha256 与中心哈希不一致（界面本来就拿不到中心哈希）也照样只比 versionId。
    expect(enterpriseMarketSkillRowHasUpdate([{ ...older, sha256: 'b'.repeat(64) }], updatable)).toBe(true)
    expect(enterpriseMarketSkillRowHasUpdate([{ ...installedSkill(SKILL_DETAIL.versionId), sha256: 'b'.repeat(64) }], updatable)).toBe(false)
  })

  // 开关左侧那枚辅助标签：只在「有更新」时出现（其余态右侧就一个 Switch），点击 = 安装中心当前版本。
  // 版式统一后两套外壳的**落点是同一条 `.own-market-rowLine`**（辅助动作严格排在开关左侧），事实与行为逐项一致。
  it('renders the 更新 item in the row menu only when an update exists', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      // 未装行：那一格是安装按钮，没有「⋯」。
      const notInstalled = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], onToggleSkill })
      expect(menuAction(notInstalled, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL), label).toBeUndefined()
      expect(skillInstall(notInstalled), label).toBeDefined()
      // 已装且与中心同版本：只有「卸载」，没有「更新」。
      const current = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        installedSkills: [installedSkill(SKILL_DETAIL.versionId)], onToggleSkill,
      })
      expect(menuAction(current, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL), label).toBeUndefined()
      expect(menuAction(current, ENTERPRISE_MARKET_UNINSTALL_TEXT), label).toBeDefined()
      // 已装旧版本：多一项「更新」，可见文案与悬浮说明都取同一枚投影。
      const tree = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated], onToggleSkill })
      const update = menuAction(tree, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL)
      const updateTag = enterpriseMarketSkillUpdateTag(updatable.displayName)
      expect(update, label).toBeDefined()
      expect(update?.['children'], label).toBe(updateTag.label)
      expect(update?.['title'], label).toBe(updateTag.title)
      expect(update?.['disabled'], label).toBe(false)
      // 点击 = 安装中心当前版本（`next=true`），不是卸载、也不是 no-op。
      update?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: updatable.id }), true)
      // 顺序锁：同一枚「⋯」里「更新」严格排在「卸载」之前（破坏性动作永远在最后）。
      expect(collectByClassName(tree, 'own-market-moreItem').map(props => props['children']), label)
        .toEqual([ENTERPRISE_MARKET_SKILL_UPDATE_LABEL, ENTERPRISE_MARKET_UNINSTALL_TEXT])
      // 有更新时行上的受管态钩子如实报 `UPDATE_AVAILABLE`；「卸载」那一项可点（盘上装着旧版本）。
      expect(collectDataValues(tree, 'data-enterprise-skill-state'), label).toEqual(['UPDATE_AVAILABLE'])
      expect(menuAction(tree, ENTERPRISE_MARKET_UNINSTALL_TEXT)?.['disabled'], label).toBe(false)
    }
    expect(ENTERPRISE_MARKET_SKILL_UPDATE_TAG).toBe('UPDATE_AVAILABLE')
    // 纯投影与常量同源（改文案只改一处）。
    expect(enterpriseMarketSkillUpdateTag('会议纪要技能组')).toEqual({
      label: '有更新',
      ariaLabel: '更新企业技能 会议纪要技能组',
      title: '点此更新到中心当前版本',
    })
    expect(ENTERPRISE_MARKET_SKILL_UPDATE_LABEL).toBe('有更新')
  })

  // 在途语义：有更新的行在途时辅助标签**保留但禁用**（用户看得见「正在更新」）；未装行的在途一律不出现。
  it('keeps the update item visible but disabled while the row is busy', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    for (const { label, shell } of MARKET_SHELLS) {
      const busyUpdate = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
        pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
      })
      // 这一行在途（正在装/更新它）⇒ 它此刻归**未装**那一格：给的是「安装」按钮且禁用，
      // 没有「⋯」（用户看得见「正在安装」，但点不动——与「已装行在途」是两种现场）。
      expect(collectByClassName(busyUpdate, 'own-market-moreItem'), label).toEqual([])
      expect(skillInstall(busyUpdate)?.['disabled'], label).toBe(true)
      // 未装行在途（正在做首次安装）：那一格是安装按钮（禁用），没有「⋯」。
      const busyFresh = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
      })
      expect(collectByClassName(busyFresh, 'own-market-moreItem'), label).toEqual([])
      expect(skillInstall(busyFresh)?.['disabled'], label).toBe(true)
      // 没有动作回调（未登录/无 store）时同样禁用，但语义仍是「更新」。
      const unwired = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
      })
      expect(menuAction(unwired, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL), label)
        .toMatchObject({ disabled: true, title: '企业账号未登录，暂不可操作' })
    }
  })

  // 开关各态在真实树上的落点：`checked`/`disabled` + `label` 动作语义 + 行上的 `data-enterprise-skill-state` 一致
  // （未装 / 已装 / 有更新 / 安装中 / 卸载中）。
  it('renders the skill-row action states on the row with matching data hooks', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    const onToggleSkill = vi.fn()
    const cases: readonly {
      readonly name: string
      readonly installedSkills?: readonly EnterpriseInstalledSkill[]
      readonly pendingSkill?: { readonly packageId: string, readonly next: boolean }
      readonly state: string
      /** 这一态给的是「安装」那一格（true）还是「⋯」（false）。 */
      readonly install: boolean
      readonly disabled: boolean
    }[] = [
      { name: '未装', state: 'AVAILABLE', install: true, disabled: false },
      { name: '已装', installedSkills: [installedSkill('v2')], state: 'INSTALLED', install: false, disabled: false },
      { name: '安装中', pendingSkill: { packageId: row.id, next: true }, state: 'INSTALLING', install: true, disabled: true },
      { name: '卸载中', installedSkills: [installedSkill('v2')], pendingSkill: { packageId: row.id, next: false }, state: 'REMOVING', install: false, disabled: true },
    ]
    for (const { label: shellLabel, shell } of MARKET_SHELLS) {
      for (const item of cases) {
        const where = `${shellLabel} / ${item.name}`
        const tree = shell({
          view: 'page',
          sessionUsable: true,
          enterpriseSkills: [row],
          ...(item.installedSkills === undefined ? {} : { installedSkills: item.installedSkills }),
          ...(item.pendingSkill === undefined ? {} : { pendingSkill: item.pendingSkill }),
          onToggleSkill,
        })
        if (item.install) {
          expect(skillInstall(tree)?.['aria-label'], where).toBe('安装企业技能 会议纪要技能组')
          expect(skillInstall(tree)?.['disabled'], where).toBe(item.disabled)
          expect(collectByClassName(tree, 'own-market-moreItem'), where).toEqual([])
        } else {
          expect(skillInstall(tree), where).toBeUndefined()
          expect(menuAction(tree, ENTERPRISE_MARKET_UNINSTALL_TEXT)?.['disabled'], where).toBe(item.disabled)
        }
        // 行上的受管态钩子仍如实报态（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）。
        expect(collectDataValues(tree, 'data-enterprise-skill-state'), where).toEqual([item.state])
      }
      // 第五态「有更新」：行上带中心当前版本、本机装着旧版本 ⇒ 多一项「更新」，两项都可点。
      const updatable = updatableRow()
      const outdatedTree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        installedSkills: [installedSkill('1902500000000000100')], onToggleSkill,
      })
      expect(collectDataValues(outdatedTree, 'data-enterprise-skill-state'), shellLabel).toEqual(['UPDATE_AVAILABLE'])
      expect(menuAction(outdatedTree, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL)?.['disabled'], shellLabel).toBe(false)
      expect(menuAction(outdatedTree, ENTERPRISE_MARKET_UNINSTALL_TEXT)?.['disabled'], shellLabel).toBe(false)
    }
  })

  // 一键安装/卸载：开关在两个方向上都把 (row, next) 交给 onToggleSkill —— 未装拨上 = true，已装拨下 = false。
  it('drives the skill action in both directions from the real controls', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      const installable = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [row], onToggleSkill })
      const installButton = skillInstall(installable)
      expect(installButton?.['aria-label'], label).toBe('安装企业技能 会议纪要技能组')
      installButton?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)

      // 已装：那一格是「⋯」里的**卸载**（技能由员工自己装，故卸载恒有）。
      const installed = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [row], installedSkills: [installedSkill('v2')], onToggleSkill,
      })
      const uninstall = menuAction(installed, ENTERPRISE_MARKET_UNINSTALL_TEXT)
      expect(uninstall?.['title'], label).toBe('从本机卸载这份技能')
      expect(uninstall?.['disabled'], label).toBe(false)
      uninstall?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenLastCalledWith(expect.objectContaining({ id: row.id }), false)
    }
  })

  // 缺陷回归锁：企业技能行的动作失败时市场侧原先**没有任何可见反馈**（用户报「点了没反应」）。
  // 现在失败必须落在出错的那一行：role="alert" + 稳定错误码，且开关仍可拨（再拨一次就是重试）。
  it('shows the enterprise skill-row failure with its stable code and keeps the switch retryable', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      const failed = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills: [row],
        onToggleSkill,
        skillActionError: { id: row.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      })
      const alerts = collectAlerts(failed)
      expect(alerts, label).toHaveLength(1)
      expect(textOf(alerts[0]), label).toContain('安装失败')
      expect(textOf(alerts[0]), label).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
      // 复用市场侧既有类名体系（形制照技能 tab 的行内提示），不新造视觉——两套外壳同一份 `EnterpriseMarketRowError`。
      expect(isValidElement(alerts[0]) ? alerts[0].props.className : undefined, label).toBe('own-market-inlineError')
      // 失败没留下乐观已装：那一格仍是「安装」且可点，点上去就是重试。
      const installButton = skillInstall(failed)
      expect(installButton?.['disabled'], label).toBe(false)
      installButton?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)
    }
  })

  // 失败文案随「意图动作」走，且提示只落失败行：另一行不受影响、两个开关都照旧可拨。
  it('labels the failure by the attempted action and renders it only on the failing row', () => {
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'install', code: 'ENT_X' })).toBe('安装失败')
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'uninstall', code: 'ENT_X' })).toBe('卸载失败')
    // 取消那一支**不给前缀**（本刀）：用户是自己按的取消，「安装失败：这次安装被取消了」自相矛盾。
    expect(enterpriseMarketActionErrorLabel({ id: 'x', action: 'cancel', code: 'ENT_PLUGIN_INSTALL_CANCELLED' }))
      .toBeUndefined()
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组' },
    ])
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills: rows,
        installedSkills: [installedSkill('v1', rows[1]!.id)],
        onToggleSkill: vi.fn(),
        skillActionError: { id: rows[1]!.id, action: 'uninstall', code: 'ENT_SKILL_STATE_INVALID' },
      })
      const alerts = collectAlerts(tree)
      expect(alerts, label).toHaveLength(1)
      expect(textOf(alerts[0]), label).toContain('卸载失败')
      expect(textOf(alerts[0]), label).toContain('ENT_SKILL_STATE_INVALID')
      expect(textOf(alerts[0]), label).not.toContain('代码评审技能组')
      // 两行的动作都在（未装那行 = 安装按钮、已装那行 = 「⋯」里的卸载）、都没被提示禁用
      //（失败行可重试，正常行不受牵连）。
      expect(skillInstall(tree)?.['disabled'], label).toBe(false)
      expect(menuAction(tree, ENTERPRISE_MARKET_UNINSTALL_TEXT)?.['disabled'], label).toBe(false)
    }
  })

  // 回归锁（本轮改动的边界）：技能行右侧 = 官方 Switch（**始终在**）＋仅在有更新时出现的辅助标签，
  // 企业插件行的开关口径**完全未动**（同样一枚 Switch）。两行各在自己的页签里，故分两次渲染锁同一批语义。
  it('gives the skill row a menu again and leaves the plugin row action untouched', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const { label, shell } of MARKET_SHELLS) {
      const onTogglePluginEnabled = vi.fn()
      // 「企业插件」页签：插件行 = 状态点 + 文案 + 「⋯」；这一项的内置性（inCatalog:true）决定**没有卸载**。
      const pluginsTab = shell({
        view: 'page',
        activeTab: 'plugins',
        sessionUsable: true,
        enterprisePlugins: enterprisePlugins as never,
        onTogglePluginEnabled,
      })
      expect(collectByClassName(pluginsTab, 'own-market-moreItem').map(props => props['children']), label)
        .toEqual([ENTERPRISE_MARKET_DISABLE_TEXT])
      const pluginToggle = menuAction(pluginsTab, ENTERPRISE_MARKET_DISABLE_TEXT)!
      // ★ 已安装 + 启用着：那一项是**停用**，所以悬浮说明是「点此停用」，不是「点此卸载」。
      expect(pluginToggle['title'], label).toBe('点此停用')
      expect(pluginToggle['disabled'], label).toBe(false)
      pluginToggle['onClick']?.()
      expect(onTogglePluginEnabled, label).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
      // 「企业技能」页签：已装同版本行（行上没有中心版本 → 不判更新）只有「卸载」那一项；
      // 不再有 `data-enterprise-skill-tag` 钩子；技能行未占 rowState 版式（那是插件行的状态点位）。
      const skillsTab = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        installedSkills: [installedSkill('v2')],
        onToggleSkill: vi.fn(),
      })
      expect(collectByClassName(skillsTab, 'own-market-moreItem').map(props => props['children']), label)
        .toEqual([ENTERPRISE_MARKET_UNINSTALL_TEXT])
      expect(collectByClassName(skillsTab, 'own-market-skillTag'), label).toEqual([])
      expect(collectDataValues(skillsTab, 'data-enterprise-skill-tag'), label).toEqual([])
      expect(collectDataValues(skillsTab, 'data-enterprise-skill-state'), label).toEqual(['INSTALLED'])
      // 技能行不使用插件行那套 `.own-market-rowState`（那是插件行的状态点位）。
      expect(collectByClassName(skillsTab, 'own-market-rowState'), label).toEqual([])
    }
  })

  // 企业插件行原先也只有「目录不可装」的禁用 + title 提示，动作失败同样一个字都不说（失败码只留在 store 里，
  // 由「企业设置 → 插件」那个视图出头号提示）。这里一并补齐同范式的行内提示。
  it('shows the enterprise plugin-row failure with its code and leaves the other rows clean', () => {
    const enterprisePlugins = [
      { packageName: 'ent-a', version: '1.2.0', state: 'EXPECTED', inCatalog: true },
      { packageName: 'ent-b', version: '2.0.0', state: 'ACTIVE', inCatalog: true },
    ] as const
    for (const { label, shell } of MARKET_SHELLS) {
      const onInstallPlugin = vi.fn()
      const onTogglePluginEnabled = vi.fn()
      const tree = shell({
        view: 'page',
        activeTab: 'plugins',
        sessionUsable: true,
        enterprisePlugins: enterprisePlugins as never,
        onInstallPlugin,
        onTogglePluginEnabled,
        pluginActionError: { id: 'ent-a', action: 'install', code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
      })
      const alerts = collectAlerts(tree)
      expect(alerts, label).toHaveLength(1)
      expect(textOf(alerts[0]), label).toContain('安装失败')
      expect(textOf(alerts[0]), label).toContain('ENT_PLUGIN_SIGNATURE_INVALID')
      // 失败那一行是**未安装**那一格（ent-a 的本机记录是空的）⇒ 它的重试入口是那枚【＋】，不是开关。
      const retryPlus = collectSlotProps(tree, 'install')[0]
      expect(retryPlus?.['disabled'], label).toBe(false)
      expect(retryPlus?.['aria-label'], label).toBe('安装 ent-a')
      ;(retryPlus?.['onClick'] as (() => void) | undefined)?.()
      expect(onInstallPlugin, label).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }))
      expect(textOf(tree), label).toContain('ent-b')
    }
  })

  // 成功路径（没有失败事实直传）不得出现任何提示：提示只在失败时出现，成功时一个字都不多说。
  // 两个行页签 × 两套外壳各渲染一次，四处都必须干净。
  it('renders no inline alert when no action failed (success path stays clean)', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const { label, shell } of MARKET_SHELLS) {
      for (const tab of ['skills', 'plugins'] as const) {
        const tree = shell({
          view: 'page',
          activeTab: tab,
          sessionUsable: true,
          enterprisePlugins: enterprisePlugins as never,
          enterpriseSkills,
          installedSkills: [installedSkill('v1')],
          onTogglePluginEnabled: vi.fn(),
          onToggleSkill: vi.fn(),
        })
        const where = `${label} / ${tab}`
        expect(collectAlerts(tree), where).toEqual([])
        expect(textOf(tree), where).not.toContain('安装失败')
        expect(textOf(tree), where).not.toContain('卸载失败')
      }
      // 成功路径上动作只是如实反映 Host 真值（已装 ⇒ 「⋯」里就是卸载）。
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        installedSkills: [installedSkill('v1')],
        onToggleSkill: vi.fn(),
      })
      expect(menuAction(tree, ENTERPRISE_MARKET_UNINSTALL_TEXT), label).toBeDefined()
    }
  })

  // 折叠（照官方 PluginInventory groupToggle）：页签化后**只剩「组件」页签内部那一节**还带折叠语义；
  // 企业技能 / 企业插件两节的节头折叠随页签化退场（显隐由页签承担，这两节只剩一行计数）——
  // 原来锁「企业技能节折叠 aria 契约」的那条用例绑定的正是被移除的行为，故删除（语义由上面的页签用例接管）。
  it('honours an explicit expandedSections map and toggles aria-expanded on the only collapsible section', () => {
    // 缺席（bare call）→ 纯投影默认折叠（照官方 `?? false`）；页面纯函数体不传 expandedSections 时会传 defaultOpen=true（测试直调得完整树）。
    expect(enterpriseMarketSectionOpen(undefined, 'components')).toBe(false)
    expect(enterpriseMarketSectionOpen(undefined, 'components', true)).toBe(true)
    // 显式 provided → 按值。
    expect(enterpriseMarketSectionOpen({ components: false }, 'components')).toBe(false)
    expect(enterpriseMarketSectionOpen({ components: true }, 'components')).toBe(true)
    expect(ENTERPRISE_MARKET_SECTION_IDS.components).toBe('components')
    // 节 id 真源已收敛为唯一还带折叠的「组件」一节：另两个节名随折叠一起删掉，不留死字段。
    expect(Object.keys(ENTERPRISE_MARKET_SECTION_IDS)).toEqual(['components'])

    // 折叠态：组件清单整段不进 DOM，但节头按钮 + 标题 + 计数仍在（可再点开）。这一节两套外壳共用同一份渲染。
    for (const { label, shell } of MARKET_SHELLS) {
      const collapsed = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: { components: false },
        onToggleSection: vi.fn(),
      })
      const compBtn = collectButtonProps(collapsed).find(b => b['aria-controls'] === 'market-section-components')
      expect(compBtn, label).toBeDefined()
      expect(compBtn?.['aria-expanded'], label).toBe(false)
      // 折叠时列表整段不进 DOM（条件渲染，照官方 groupBody）——`.own-market-rows{display:flex}` 会覆盖
      // UA 的 `[hidden]{display:none}`，故不用 hidden 属性，直接不渲染 <ul>。节头/标题/计数仍在文本里。
      expect(collectElementById(collapsed, 'market-section-components'), label).toBeUndefined()
      expect(textOf(collapsed), label).toContain('内容清单')

      // 展开态：aria-expanded=true、列表在 DOM。
      const expanded = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: { components: true },
        onToggleSection: vi.fn(),
      })
      expect(collectButtonProps(expanded).find(b => b['aria-controls'] === 'market-section-components')?.['aria-expanded'], label).toBe(true)
      expect(collectElementById(expanded, 'market-section-components'), label).not.toBeUndefined()
      // 点节头触发 onToggleSection。
      const spy = vi.fn()
      const clickable = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: { components: false },
        onToggleSection: spy,
      })
      collectButtonProps(clickable).find(b => b['aria-controls'] === 'market-section-components')?.onClick?.()
      expect(spy, label).toHaveBeenCalledWith('components')
    }
  })

  // 页签化后的默认态：`ENTERPRISE_MARKET_DEFAULT_EXPANDED` 只剩一个字段（组件节默认展开）；
  // 「一进页面就看得见后台分配（预置）的全部技能」这条用户口径改由**默认页签 = 企业技能**承担。
  it('defaults to the 企业技能 tab and keeps the components section expanded by default', () => {
    expect(ENTERPRISE_MARKET_DEFAULT_TAB).toBe('skills')
    expect(ENTERPRISE_MARKET_DEFAULT_EXPANDED).toEqual({ components: true })
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    for (const { label, shell } of MARKET_SHELLS) {
      // 不传 activeTab（真运行时初值 = 默认页签）：技能列表直接在树上，未装的也照列。
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
        onToggleSection: vi.fn(),
      })
      expect(textOf(tree), label).toContain('会议纪要技能组')
      expect(collectElementById(tree, 'market-section-components'), label).toBeUndefined()
      // 默认态下技能行的动作就在树上（未装 ⇒ 「安装」按钮；没有回调故禁用）。
      expect(skillInstall(tree)?.['disabled'], label).toBe(true)
      expect(collectSwitchProps(tree), label).toEqual([])
      // 「组件」页签默认展开：切到它就直接看见组件清单（折叠按钮仍是展开态）。
      const componentsTab = shell({
        view: 'page',
        activeTab: 'components',
        expandedSections: ENTERPRISE_MARKET_DEFAULT_EXPANDED,
        onToggleSection: vi.fn(),
      })
      expect(collectElementById(componentsTab, 'market-section-components'), label).not.toBeUndefined()
    }
  })

  // ══ 本刀（去折叠）的门禁 —— **只锁新外壳**（旧外壳走 9723a97 的官方两行卡片，见上面的 MARKET_SHELLS 循环）══
  // 新外壳行版式源自参考对象 `jingyunstudio/jingyun-dsh` 的 `MarketplaceSection.tsx`（卡片 + 列表上方搜索框），
  // **但排版取值一律照官方** `@deepseek-ai/dsh-client-ui-settings-plugin-inventory` 的 `qSYn7G_*`。
  // 用户裁决 A 去掉了卡片折叠：动作常显，故 `[data-open]` 展开态、chevron、展开区、skillId 行与焦点环一并退场。
  it('locks the shared inline row values on every directory row in both shells', () => {
    for (const { label, shell } of MARKET_SHELLS) {
      const page = shell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]) })
      const css = collectStyleText(page)
      // 行 = **两列网格里的卡片**（用户口径：完全照参考图的分组样式）：
      // 容器两列 grid、卡片圆角、hover 整块变灰、**行间没有分割线**（分割线只由组标题承担）。
      const rows = cssRuleBody(css, '.own-market-rows')
      expect(rows, label).toContain('display:grid')
      expect(rows, label).toContain('repeat(2,minmax(0,1fr))')
      const row = cssRuleBody(css, '.own-market-row')
      expect(row, label).toContain('border-radius')
      // 用户口径「列表去除分割线」：这一条是反向锁，谁把 border-bottom 加回来就红。
      expect(row, label).not.toContain('border-bottom')
      // hover 变灰取官方卡片实物的同一枚 token（不许自造颜色 / color-mix 猜）。
      expect(cssRuleBody(css, '.own-market-row:hover'), label)
        .toContain('var(--dsw-alias-interactive-bg-hover)')
      // 分割线改由组标题承担（组标题的 border-bottom），组头字重 600。
      const groupTitle = cssRuleBody(css, '.own-market-categoryTitle')
      expect(groupTitle, label).toContain('border-bottom:0.5px solid')
      expect(groupTitle, label).toContain('font-weight:600')
      expect(cssRuleBody(css, '.own-market-rowLine'), label).toContain('display:flex')
      expect(cssRuleBody(css, '.own-market-rowIcon'), label).toContain('width:48px')
      expect(cssRuleBody(css, '.own-market-rowMain'), label).toContain('flex-direction:column')
      // 卡片标题/描述取值——
      // 标题 15px/**500**/1.4（字号是当时按参考图定的 15px；字重后按用户口径「细一号」从 600 收到 500，
      // 正好与官方 .ZVcBiW_cardTitle 的 font-weight:500 同档）、描述 13px/1.55；
      // 描述色为 `label-tertiary`（官方 .cardDesc 那一档）。
      const rowId = cssRuleBody(css, '.own-market-cardId')
      expect(rowId, label).toContain('font-size:15px')
      expect(rowId, label).toContain('font-weight:500')
      // ★ 反向锁：字重**不得**回到 600（用户口径「细一号」），也不得压到 400（那是正文档、标题会塌）。
      expect(rowId, label).not.toContain('font-weight:600')
      expect(rowId, label).toContain('line-height:20px')
      expect(rowId, label).toContain('text-overflow:ellipsis')
      const desc = cssRuleBody(css, '.own-market-cardDesc')
      expect(desc, label).toContain('font-size:13px')
      expect(desc, label).toContain('line-height:18px')
      expect(desc, label).toContain('-webkit-line-clamp:1')
      // 官方插件清单**卡片**那套取值一条都不许回来（DOM 与 CSS 双查）。
      for (const dead of [
        'own-market-cardShell', 'own-market-cardGrid', 'own-market-cardContent', 'own-market-cardMainRow',
        'own-market-cardTitle', 'own-market-cardDescription', 'own-market-cardTrailing', 'own-market-cardActions',
        'own-market-phaseDot', 'own-market-configTag', 'own-market-rowStatus',
      ]) {
        expect(cssRuleBody(css, `.${dead}`), `${label}/${dead}`).toBe('')
        expect(collectByClassName(page, dead), `${label}/${dead}`).toEqual([])
      }
      // 「两列网格 + 窄屏单列」随卡片一起退场（通栏行按容器宽度自适应，不再需要 520 断点）。
      expect(css, label).not.toContain('@container')
      expect(css, label).not.toContain('max-width:520px')
      // DOM 结构锁：恰好一条通栏行列表、一行、一枚图标框与一条行线；chevron 一件都没有。
      expect(collectByClassName(page, 'own-market-rows'), label).toHaveLength(1)
      expect(collectByClassName(page, 'own-market-row'), label).toHaveLength(1)
      expect(collectByClassName(page, 'own-market-rowIcon'), label).toHaveLength(1)
      expect(collectByClassName(page, 'own-market-rowLine'), label).toHaveLength(1)
      expect(collectByClassName(page, 'own-market-cardChevron'), label).toEqual([])
      // 组件页签的 rows 版式不受影响：同一串行类名、**四行**（本刀新增「资料库」行；行版式一字没动）。
      const components = shell({ view: 'page', activeTab: 'components' })
      expect(collectByClassName(components, 'own-market-rows'), label).toHaveLength(1)
      expect(collectByClassName(components, 'own-market-row'), label).toHaveLength(4)
      // **术语降维的反向锁**：内部模块路径（`dsh-preset / .dshpreset` 等）不再上屏——
      // 类名与文本两路都取证，防它以后被顺手加回来（数据仍留在 ENTERPRISE_MARKET_COMPONENTS 里作交付台账）。
      expect(collectByClassName(components, 'own-market-rowModule'), label).toEqual([])
      for (const row of ENTERPRISE_MARKET_COMPONENTS) {
        expect(textOf(components), label).not.toContain(row.module)
      }
    }
  })

  // 卡片**不折叠**（用户裁决 A）：新外壳目录卡片上直接就是标题/签/状态点/描述与两个动作（[有更新] + Switch），
  // 没有任何展开/收起机制——chevron、`aria-expanded`/`aria-controls`、展开区、`skillId` 行都不在树上。
  // 行键 / 展开区 id / 开合三个纯投影**仍留在共享层**（控制器那份状态按「不夹带清理」保留），这里继续锁它们的取值；
  // 同时锁死「新外壳不再消费它们」：`expandedRow` 传 null 还是某个行键，卡片产出逐项相同。
  it('renders every store-shell row without any disclosure: actions are always visible on the row', () => {
    const rows = enterpriseMarketSkillRows([
      SKILL,
      { ...SKILL, id: '1902500000000000002', skillId: 'code-review', displayName: '代码评审技能组' },
    ])
    const key = enterpriseMarketRowKey('skills', SKILL.id)
    // 共享层纯投影仍在（行键 / 展开区 id / 开合口径一字未改）——现在只是「保留事实」，没有外壳消费它。
    expect(key).toBe(`skills:${SKILL.id}`)
    expect(enterpriseMarketRowKey('plugins', 'ent-a')).toBe('plugins:ent-a')
    expect(enterpriseMarketRowDetailsId('skills', SKILL.id)).toBe(`market-details-skills-${SKILL.id}`)
    expect(enterpriseMarketRowDetailsId('plugins', '@scope/ent-a')).toBe('market-details-plugins--scope-ent-a')
    expect(enterpriseMarketRowOpen(undefined, key)).toBe(true)
    expect(enterpriseMarketRowOpen(null, key)).toBe(false)
    expect(enterpriseMarketRowOpen(key, key)).toBe(true)
    expect(enterpriseMarketRowOpen('skills:other', key)).toBe(false)

    // `expandedRow` 无论怎么传，行都长得一模一样（新外壳一行状态都不消费）。
    const shapes = [null, key, enterpriseMarketRowKey('skills', rows[1]!.id)].map(expandedRow => EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: rows, expandedRow, onToggleSkill: vi.fn(), onToggleRow: vi.fn(),
    }))
    for (const tree of shapes) {
      // 动作**常显**：两行各一枚「安装」按钮（未装那一格），且各自落在本行的 `.own-market-rowLine` 里。
      expect(collectByProp(tree, 'data-enterprise-skill-slot').map(props => String(props['aria-label']))).toEqual([
        '安装企业技能 会议纪要技能组',
        '安装企业技能 代码评审技能组',
      ])
      expect(collectSwitchProps(tree)).toEqual([])
      const lines = collectByClassName(tree, 'own-market-rowLine')
      expect(lines).toHaveLength(2)
      for (const line of lines) {
        // 展开共享动作子块后，行线上直接看得见那一枚动作控件（动作没有被搬进可点按钮里）。
        const kids = flattenElements(line['children'] as ReactNode)
        expect(kids.some(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-slot'] === 'install')).toBe(true)
      }
      // 展开机制一件都不在：chevron / 展开区 / `skillId` 行 / 行上的 `data-open`。
      expect(collectByClassName(tree, 'own-market-cardChevron')).toEqual([])
      expect(collectByClassName(tree, 'own-market-cardDetails')).toEqual([])
      expect(collectByClassName(tree, 'own-market-entryValue')).toEqual([])
      expect(collectByClassName(tree, 'own-market-row').map(props => props['data-open'])).toEqual([undefined, undefined])
      // 行主体不是 disclosure 按钮：没有 `aria-expanded` / `aria-controls` / `onClick`（点了不会发生任何事）。
      const mains = collectByClassName(tree, 'own-market-rowMain')
      expect(mains.map(props => props['aria-expanded'])).toEqual([undefined, undefined])
      expect(mains.map(props => props['aria-controls'])).toEqual([undefined, undefined])
      expect(mains.map(props => props['onClick'])).toEqual([undefined, undefined])
      // `skillId` 不再作为可见文本出现（那行 `code-review` 被用户明确判为无用）。
      expect(textOf(tree)).not.toContain('code-review')
    }
    // 行本体现在是**一枚真可点 button**（本轮新增的详情入口），但它只包住图标 + 两行文案：
    // 官方 Switch 与 `[有更新]` 是它的**同级兄弟**（不在按钮内），所以「点动作不会打开详情」是结构性的。
    const openButtons = collectButtonProps(shapes[0]!).filter(props => String(props['className'] ?? '').includes('own-market-rowOpen'))
    expect(openButtons).toHaveLength(2)
    for (const props of openButtons) {
      const inside = flattenElements(props['children'] as ReactNode)
      expect(inside.some(child => isValidElement(child) && child.type === (Switch as unknown))).toBe(false)
      expect(inside.some(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-tag'] !== undefined))
        .toBe(false)
    }
    // 行线那枚按钮是打开详情的唯一入口（回调缺席时 disabled，不给死按钮）。
    expect(openButtons.every(props => props['type'] === 'button')).toBe(true)
    expect(openButtons.every(props => props['disabled'] === true)).toBe(true)
    // 插件行同一套：`expandedRow: null` 时安装/卸载开关照样在行上（没有展开区可收起它）。
    const plugins = EnterpriseMarketLegacyShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true, expandedRow: null,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      onTogglePluginEnabled: vi.fn(),
    })
    // 插件行同一套：`expandedRow: null` 时那一项动作照样在行上（没有展开区可收起它）。
    expect(collectByClassName(plugins, 'own-market-moreItem').map(props => props['children']))
      .toEqual([ENTERPRISE_MARKET_DISABLE_TEXT])
    expect(collectByClassName(plugins, 'own-market-cardDetails')).toEqual([])
    expect(collectByClassName(plugins, 'own-market-cardChevron')).toEqual([])
    expect(collectByClassName(plugins, 'own-market-rowLine')).toHaveLength(1)
  })

  // **新增锁（本轮改动的核心）**：动作**在同一张卡片内部**——`[有更新]` 与官方 `Switch` 都落在该卡片的
  // `.own-market-cardContent` 之内（不是搬到卡片外面另起一条），失败提示也在同一张卡里；
  // 技能卡片与插件卡片各锁一遍（「动作常显」= 常显在**卡片上**，不是常显在别处）。
  it('keeps both row actions inside the same row as the title and the description', () => {
    const row = updatableRow()
    const tree = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: [row],
      installedSkills: [installedSkill('1902500000000000100')], onToggleSkill: vi.fn(),
      skillActionError: { id: row.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
    })
    const rowNode = collectByDataProp(tree, 'data-enterprise-skill-package', row.id)[0] as { props?: Record<string, unknown> } | undefined
    const kids = (rowNode?.props?.['children'] ?? []) as ReactNode[]
    // 行线 / 标题行 / 描述行都在同一个 `<li>` 里；有更新按钮、官方 Switch 与失败提示也都在本行里。
    expect(collectByClassName(kids, 'own-market-rowLine')).toHaveLength(1)
    expect(collectByClassName(kids, 'own-market-cardHead')).toHaveLength(1)
    expect(collectByClassName(kids, 'own-market-cardDesc')).toHaveLength(1)
    // 动作区（本刀：已装 ⇒ 「⋯」的两项）与失败提示都在本行里；枚数按真 DOM 数。
    expect(collectByClassName(kids, 'own-market-moreItem').map(props => props['children'])).toEqual(['有更新', ENTERPRISE_MARKET_UNINSTALL_TEXT])
    expect(collectSwitchProps(kids)).toHaveLength(0)
    expect(collectAlerts(kids)).toHaveLength(1)
    // 全树只有这一条行线：动作没有在行外重复挂载一份（也没有并行的「卡片内动作条」）。
    expect(collectByClassName(tree, 'own-market-rowLine')).toHaveLength(1)
    // 插件行同理：安装/卸载开关落在同一条行线里。
    const plugins = EnterpriseMarketLegacyShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      onTogglePluginEnabled: vi.fn(),
    })
    const pluginRow = collectByDataProp(plugins, 'data-enterprise-plugin-package', 'ent-a')[0] as { props?: Record<string, unknown> } | undefined
    const pluginKids = (pluginRow?.props?.['children'] ?? []) as ReactNode[]
    expect(collectByClassName(pluginKids, 'own-market-rowLine')).toHaveLength(1)
    expect(collectByClassName(pluginKids, 'own-market-moreItem').map(props => props['children']))
      .toEqual([ENTERPRISE_MARKET_DISABLE_TEXT])
  })

  // 行尾状态点：语义照官方 `StateDot`（活跃=已装/可用 → done、未观察=未装 → idle、需留意 → warning），
  // **在途用官方 `StateDot state="ongoing"`（旋转弧）** —— 官方与参考对象都没有的在途反馈，属我们补短板；
  // 旁边那枚「启用/已装」标签照参考对象的 configTag 语义，视觉改用官方 `Tag` 原语（不自绘颜色）。
  it('maps every directory row to the official StateDot semantics, config tag and status text', () => {
    // 技能行五态 → 状态点 / 标签 / 状态文案（安静态不重复说话：事实已由标签说清）。
    expect(enterpriseMarketSkillDot('AVAILABLE')).toBe('idle')
    expect(enterpriseMarketSkillDot('INSTALLED')).toBe('done')
    expect(enterpriseMarketSkillDot('UPDATE_AVAILABLE')).toBe('warning')
    expect(enterpriseMarketSkillDot('INSTALLING')).toBe('ongoing')
    expect(enterpriseMarketSkillDot('REMOVING')).toBe('ongoing')
    expect(enterpriseMarketSkillConfigTag('AVAILABLE')).toEqual({ enabled: false, label: '未装', tone: 'neutral' })
    expect(enterpriseMarketSkillConfigTag('INSTALLED')).toEqual({ enabled: true, label: '已装', tone: 'success' })
    expect(enterpriseMarketSkillConfigTag('UPDATE_AVAILABLE')).toEqual({ enabled: true, label: '已装', tone: 'success' })
    expect(enterpriseMarketSkillConfigTag('INSTALLING')).toEqual({ enabled: false, label: '未装', tone: 'neutral' })
    expect(enterpriseMarketSkillConfigTag('REMOVING')).toEqual({ enabled: true, label: '已装', tone: 'success' })
    expect(enterpriseMarketSkillStatusLabel('AVAILABLE')).toBeUndefined()
    expect(enterpriseMarketSkillStatusLabel('INSTALLED')).toBeUndefined()
    expect(enterpriseMarketSkillStatusLabel('UPDATE_AVAILABLE')).toBe('有更新')
    expect(enterpriseMarketSkillStatusLabel('INSTALLING')).toBe('安装中')
    expect(enterpriseMarketSkillStatusLabel('REMOVING')).toBe('卸载中')
    // 插件行的启停标签：**入参就是那一枚启停位**（不再从 `state` 自己推一套 `ACTIVE` 口径），
    // 词表也只有一处（`plugin-install-gate.ts` 的 `enterprisePluginEnabledLabel`）。
    expect(enterpriseMarketPluginConfigTag(true)).toEqual({ enabled: true, label: '已启用', tone: 'success' })
    expect(enterpriseMarketPluginConfigTag(false)).toEqual({ enabled: false, label: '已停用', tone: 'neutral' })
    expect(enterpriseMarketPluginStatusLabel('ACTIVE')).toBeUndefined()
    expect(enterpriseMarketPluginStatusLabel('EXPECTED')).toBeUndefined()
    expect(enterpriseMarketPluginStatusLabel('FAILED')).toBe('处理失败')
    expect(enterpriseMarketPluginStatusLabel('RESTART_REQUIRED')).toBe('等待重启')

    // 版式统一后**两套外壳的目录行逐项一致**：技能行不出状态点/事实标签——9723a97 那一版就没有这两件，
    // 技能行的「已装与否」由**哪一格动作**承载（未装 ⇒ 安装按钮 / 已装 ⇒ 「⋯」）、「有更新」由「⋯」里那一项承载（事实仍在行上，
    // 见 `data-enterprise-skill-state` 与下面的在途断言）；插件行则**恒出**「状态点 + 官方状态词」（点与词成对）。
    for (const { label, shell } of MARKET_SHELLS) {
      const skills = shell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]), onToggleSkill: vi.fn() })
      expect(collectStateDotProps(skills), label).toEqual([])
      expect(collectByClassName(skills, 'own-market-configTag'), label).toEqual([])
      expect(collectByClassName(skills, 'own-market-rowStatus'), label).toEqual([])
      expect(collectDataValues(skills, 'data-enterprise-skill-state'), label).toEqual(['AVAILABLE'])
      // 未装行：那一格是安装按钮，行仍由它主控（本刀卡片不再有开关）。
      expect(skillInstall(skills), label).toBeDefined()
      expect(collectSwitchProps(skills), label).toEqual([])
      // 在途：受管态如实报在途，但**不**因为「在途」而在技能行多长出一枚状态点/一行状态文字。
      const busy = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
        pendingSkill: { packageId: SKILL.id, next: true }, onToggleSkill: vi.fn(),
      })
      expect(collectStateDotProps(busy), label).toEqual([])
      expect(collectByClassName(busy, 'own-market-rowStatus'), label).toEqual([])
      expect(collectDataValues(busy, 'data-enterprise-skill-state'), label).toEqual(['INSTALLING'])
      // 已装旧版本：`UPDATE_AVAILABLE` 如实落在行上，「⋯」里多一项「更新」（状态词不再另说一句）。
      const outdated = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatableRow()],
        installedSkills: [installedSkill('1902500000000000100')], onToggleSkill: vi.fn(),
      })
      expect(collectDataValues(outdated, 'data-enterprise-skill-state'), label).toEqual(['UPDATE_AVAILABLE'])
      expect(menuAction(outdated, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL), label).toBeDefined()
      expect(collectStateDotProps(outdated), label).toEqual([])
      // 插件行：ACTIVE → done + 官方状态词「已安装」（不是 Tag 药丸那枚「已启用」）；FAILED → error + 「处理失败」。
      const active = shell({
        view: 'page', activeTab: 'plugins', sessionUsable: true,
        enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      })
      expect(collectStateDotProps(active).map(props => props['state']), label).toEqual(['done'])
      expect(collectByClassName(active, 'own-market-rowState'), label).toHaveLength(1)
      expect(collectByClassName(active, 'own-market-configTag'), label).toEqual([])
      expect(collectByClassName(active, 'own-market-rowStatus'), label).toEqual([])
      expect(textOf(active), label).toContain('已安装')
      const failed = shell({
        view: 'page', activeTab: 'plugins', sessionUsable: true,
        enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'FAILED', inCatalog: true }] as never,
      })
      expect(collectStateDotProps(failed).map(props => props['state']), label).toEqual(['error'])
      expect(textOf(failed), label).toContain('处理失败')
      // 「点与词成对」：状态点旁**必须**有可见状态词，绝不允许只出点不出词。
      const stateKids = (collectByClassName(failed, 'own-market-rowState')[0]?.['children'] ?? []) as ReactNode[]
      expect(stateKids.some(child => isValidElement(child) && child.type === (StateDot as unknown)), label).toBe(true)
      expect(textOf(stateKids), label).toContain('处理失败')
    }

  })

  // 旧外壳的**能力落点回归锁**（9723a97 那一版）：同样的十条能力，一条不许少，只是落点换成行内。
  // ① 版本签/分类签 → 标题行；②③④ 有更新动作 / 官方 Switch / role="alert" → **行内**（没有展开区）。
  // ⑤ 组件页签折叠与三行清单（与两套外壳共用的那份渲染）不变。
  it('keeps every pre-existing capability inside the legacy inline layout', () => {
    const row = updatableRow()
    const shared = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [row],
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: row.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      onToggleSkill: vi.fn(),
    }
    const tree = EnterpriseMarketLegacyShell(shared)
    // ① 标题行：**只有标题**（两行结构、无多余标签——版本签/分类签都按用户口径撤掉了）。
    expect(flattenElements(collectByClassName(tree, 'own-market-cardHead')[0]?.['children'] as ReactNode)).toHaveLength(1)
    expect(collectByClassName(tree, 'own-market-skillVersionTag')).toHaveLength(0)
    expect(collectByClassName(tree, 'own-market-skillCategoryTag')).toHaveLength(0)
    // ②③④ 三件事都在**行内**（同一个 rowLine 里）：两项动作（更新 / 卸载）+ role="alert"。
    expect(collectByClassName(tree, 'own-market-moreItem').map(props => props['children']))
      .toEqual([ENTERPRISE_MARKET_SKILL_UPDATE_LABEL, ENTERPRISE_MARKET_UNINSTALL_TEXT])
    expect(collectSwitchProps(tree)).toEqual([])
    expect(collectAlerts(tree)).toHaveLength(1)
    // 行内**没有**展开区/卡片网格/搜索框（那三件是新外观的落点）。
    expect(collectByClassName(tree, 'own-market-cardDetails')).toEqual([])
    expect(collectByClassName(tree, 'own-market-cardShell')).toEqual([])
    expect(collectByClassName(tree, 'own-market-cardGrid')).toEqual([])
    expect(collectByClassName(tree, 'own-market-catalogSearch')).toEqual([])
    // 动作区落在行本体那枚可点按钮**之外**的同一条 rowLine 上（结构性保证，不靠 stopPropagation）。
    const lineKids = rowLineChildren(tree, row.id)
    expect(lineKids).toHaveLength(2)
    expect(collectByClassName((lineKids[1] as { props?: Record<string, unknown> }).props?.['children'] as ReactNode, 'own-market-moreItem'))
      .toHaveLength(2)
    // 行内失败提示的类名与「技能」tab 同口径（两套外壳共用同一份 `EnterpriseMarketRowError`），且带稳定错误码。
    const alertNodes = collectAlerts(tree)
    expect(isValidElement(alertNodes[0]) ? (alertNodes[0].props as Record<string, unknown>)['className'] : undefined).toBe('own-market-inlineError')
    expect(textOf(alertNodes[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // 组件页签：折叠语义 + 四行清单（本刀新增「资料库」）+ 开关动作名逐项一致。
    const components = EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'components', expandedSections: { components: true }, onToggleSection: vi.fn() })
    expect(collectElementById(components, 'market-section-components')).not.toBeUndefined()
    expect(collectSwitchProps(components).map(props => props['label'])).toEqual(['启用插件', '启用技能', '启用配方', '启用资料库'])
    expect(textOf(components)).toContain('内容清单')
  })

  // 商业化字样反向断言：两套外壳（含 summary 与三个页签、含失败态与已装态）的全树文本与样式文本
  // 都不许出现价格/交易/购买/购物车/客服之类的字样。
  it('keeps both shells free of any commercial wording', () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [updatableRow()],
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'FAILED', inCatalog: false }] as never,
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      pluginActionError: { id: 'ent-a', action: 'install' as const, code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
    }
    for (const { label, shell } of MARKET_SHELLS) {
      const trees: readonly ReactNode[] = [
        shell({ view: 'summary' }),
        shell(props),
        shell({ ...props, activeTab: 'plugins' }),
        shell({ ...props, activeTab: 'components' }),
      ]
      for (const tree of trees) {
        const text = `${textOf(tree)}\n${collectStyleText(tree)}`
        for (const word of BANNED_COMMERCIAL_WORDS) {
          expect(text, `${label} / ${word}`).not.toContain(word)
        }
      }
    }
    // 详情子页面的文案也过一遍黑名单（新增文案最容易带进买卖话术）：面包屑、分区标题、四个文件状态提示、
    // 空文件兜底与重试按钮，逐条都不许出现买卖字样。
    for (const word of BANNED_COMMERCIAL_WORDS) {
      for (const copy of [
        ENTERPRISE_SKILL_DETAIL_BACK_TEXT, ENTERPRISE_SKILL_DETAIL_BACK_LABEL, ENTERPRISE_SKILL_DETAIL_FILES_TITLE,
        ENTERPRISE_SKILL_DETAIL_RETRY, ENTERPRISE_SKILL_TREE_NOT_INSTALLED, ENTERPRISE_SKILL_TREE_LOADING,
        ENTERPRISE_SKILL_TREE_FAILED, ENTERPRISE_SKILL_TREE_EMPTY, ENTERPRISE_SKILL_PREVIEW_NONE,
        ENTERPRISE_SKILL_PREVIEW_LOADING, ENTERPRISE_SKILL_PREVIEW_FAILED, ENTERPRISE_SKILL_PREVIEW_EMPTY,
      ]) {
        expect(copy, word).not.toContain(word)
      }
    }
  })

  // ══ 逻辑唯一性门禁：目录行、详情子页面、页签条与组件节都只吃**一份**逻辑（控制器 + 模型 + 行 facts）══
  it('proves the page keeps exactly one logic layer (one model, one row facts entry, one host)', async () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [updatableRow()],
      enterprisePlugins: [
        { packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true },
        { packageName: 'ent-b', version: null, state: 'RESTART_REQUIRED', inCatalog: false },
      ] as never,
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      pluginActionError: { id: 'ent-a', action: 'uninstall' as const, code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
      onToggleSkill: vi.fn(),
      onTogglePluginEnabled: vi.fn(),
    }
    // ① 模型只有一个：同一组 props 两次调用逐字段相等（纯函数、无隐藏状态）。
    expect(enterpriseMarketShellModel(props)).toEqual(enterpriseMarketShellModel(props))
    const model = enterpriseMarketShellModel(props)
    // ② 页签文案 === 模型给的文案（页签条只有一份实现）。
    for (const { label, shell } of MARKET_SHELLS) {
      expect(collectByRole(shell(props), 'tab').map(tab => tab['children']), label)
        .toEqual(model.tabEntries.map(entry => entry.text))
    }
    // ③「有更新」判定：同一行判更新时「⋯」里多那一项，文案取同一枚投影（行 facts 是唯一判定点）。
    const tree = EnterpriseMarketLegacyShell(props)
    const update = menuAction(tree, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL)
    expect(update).toBeDefined()
    expect(update?.['title']).toBe(enterpriseMarketSkillUpdateTag(props.enterpriseSkills[0]!.displayName).title)
    expect(enterpriseMarketSkillRowFacts(props, props.enterpriseSkills[0]!).hasUpdate).toBe(true)
    // ④ 失败码：行上的 role="alert" 文案（前缀 + 稳定码）取自同一份投影。
    expect(textOf(collectAlerts(tree)[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // ⑤ 行级 facts 只有一份：渲染出的两枚动作项与 facts 逐项相等（本行已装 ⇒ 「卸载」那一格）。
    const facts = enterpriseMarketSkillRowFacts(props, props.enterpriseSkills[0]!)
    for (const { label, shell } of MARKET_SHELLS) {
      const shellTree = shell(props)
      const uninstall = menuAction(shellTree, ENTERPRISE_MARKET_UNINSTALL_TEXT)
      expect(uninstall, label).toBeDefined()
      expect(uninstall?.['disabled'], label).toBe(props.onToggleSkill === undefined || facts.busy)
      expect(facts.enabled, label).toBe(true)
      expect(collectDataValues(shellTree, 'data-enterprise-skill-state'), label).toEqual([facts.state])
      // ⑥ 组件清单投影一致（四行、仅配方预留、资料库在本机开关上）——要切到「组件」页签才挂载那一节。
      expect(collectDataValues(shell({ ...props, activeTab: 'components' }), 'data-market-component'), label)
        .toEqual(['plugins', 'skills', 'presets', 'library'])
    }
    // ⑦ 源码级不变量：逻辑入口各只有一处定义 + 恰好一处调用；动作接线各只有一份。
    // 只看**代码**（剥掉注释）——否则文档里提到同一个标识符就会被误计一次。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    const count = (re: RegExp): number => (source.match(re) ?? []).length
    // 模型：1 处定义 + 外壳 1 处调用 + **宿主 1 处**（宿主为「标题右侧页签座位」取 tabEntries 时算一次）
    // = 3。仍是同一个纯函数，不是第二套模型。
    expect(count(/enterpriseMarketShellModel\(/g)).toBe(3)
    // 行 facts 唯一入口：**本刀多一处合法调用**——模型里的「状态筛选」要问每一行「现在启用中吗」，
    // 而「什么叫启用」的唯一真源就是这枚 facts（不另写第二份口径）。故 1 定义 + 行子块 1 + 详情输入构造 1
    // + 状态筛选 1 = 4。**仍然是同一个函数**，不是第二套事实。
    expect(count(/enterpriseMarketSkillRowFacts\(/g)).toBe(4)
    // 插件侧同理 4（同一枚 facts 供 行 / 插件详情 / 状态筛选 三处读）。
    expect(count(/enterpriseMarketPluginRowFacts\(/g)).toBe(4)
    // 安装/卸载动作接线各只有一份（复制逻辑会在这里翻倍）。
    expect(count(/\.installPlugin\(/g)).toBe(1)
    // 插件行的「⋯」里有**一处**卸载（非内置项才给）——与「企业设置 → 插件」详情走同一个写入口。
    expect(count(/\.removePlugin\(/g)).toBe(1)
    expect(count(/\.setPluginEnabled\(/g)).toBe(1)
    // 唯一 hook 入口只经同一个宿主接线（没有第二套取数/动作/弹窗）。
    expect(count(/EnterpriseMarketShellHost/g)).toBe(2)
    expect(count(/useEnterpriseMarketController\(/g)).toBe(2)
    // ⑧ **文件树与预览各只有一条取数调用**，且**正文路由不再被本页消费**：
    // 两条本机文件子路由（`/skills/<id>/files` 与 `…/file?path=`）就是详情子页面唯一的取数面。
    expect(count(/api\.skillFiles\(/g)).toBe(1)
    expect(count(/api\.skillFile\(/g)).toBe(1)
    expect(count(/api\.skillContent\(/g)).toBe(0)
    // 未装 / 无 store 时**一条请求都不发**：两个 effect 各自的第一道守卫。
    expect(source).toContain('if (api === undefined || detailPackageId === undefined || detailSkillName === undefined)')
    expect(source).toContain('if (api === undefined || detailPackageId === undefined || selectedEntry === undefined)')
    // 预览路径只可能是树里那条条目（`selectedEntry.path`），界面从不拼路径。
    expect(source).toContain('api.skillFile(detailPackageId, selectedEntry.path, controller.signal)')
    expect(source).not.toContain('SKILL.md/')
  })

  // ══ 行渲染唯一性门禁：目录行只有**一处实现**（共享子块），两个目录页签各调用它一次 ═══════════════════
  it('renders every directory row through the single shared sub-block', async () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [updatableRow()],
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      pluginActionError: { id: 'ent-a', action: 'uninstall' as const, code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
      onToggleSkill: vi.fn(),
      onTogglePluginEnabled: vi.fn(),
    }
    const tree = EnterpriseMarketLegacyShell(props)
    // ①a 结构级：`.own-market-rows` 那一块（连行、连行内动作与失败提示）逐行可取证。
    expect(rowsOutline(tree).length).toBeGreaterThan(10)
    // ①b 类名级：出同一串行类名，且不出卡片时代那套。
    for (const name of [
      'own-market-rows', 'own-market-row', 'own-market-rowLine', 'own-market-rowIcon', 'own-market-rowMain',
      'own-market-cardHead', 'own-market-cardId', 'own-market-cardDesc', 'own-market-inlineError',
    ]) {
      expect(collectByClassName(tree, name).length, name).toBeGreaterThan(0)
    }
    for (const dead of ['own-market-cardShell', 'own-market-cardGrid', 'own-market-cardTitle', 'own-market-cardDescription', 'own-market-cardActions']) {
      expect(collectByClassName(tree, dead), dead).toEqual([])
    }
    // ①c 源码级：行渲染只有**一处实现**，两个目录页签各调用它一次——将来谁想再画一份，这条门禁会先红。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('export function EnterpriseMarketInlineRows(')
    // **本刀（企业配方页签）**：三个目录页签（技能 / 插件 / 配方）各调用同一枚子块一次——三处、一枚实现。
    expect((source.match(/<EnterpriseMarketInlineRows /g) ?? []).length).toBe(3)
    // 反向锁：本文件里 `own-market-rows` 只有**四处**显式铺设点——
    // **本刀（分组 + 两列卡片网格）**把三个目录页签那三处收敛成 `renderGrouped` 里的**一处**
    //（三个页签都走同一枚分组渲染器，一处容器管住两列网格），加组件清单一处、配方详情包含内容一处 = 3；
    // **本刀（系统搜索）**加第四处：结果面里「每个根一组候选」也走**同一枚**类名（同一套行版式，零新类）；
    // **本刀（在线搜索）**加第五处：在线结果面同理。
    // 没有第六处（将来谁再手写一套行列表，这条会先红）。
    expect((source.match(/className="own-market-rows"/g) ?? []).length).toBe(5)
  })

  // ══ 结构快照门禁：旧外壳的**当前**输出（行本体可点这一刀之后的结构）逐行锁死 ══════════════════════
  // 上一轮这条用例证明的是「抽共享行子块一字未变」；本轮技能行**按设计**多了一枚可点行本体
  // （`button.own-market-rowOpen` 把图标 + 两行文案包起来，动作仍是它的同级兄弟），故快照与 CSS
  // 长度/校验和重新基线化，并明确锁住「插件行一字未动、动作没被藏起来」。
  // **本刀（卡片第二行改描述 + 标题行标签照技能）再基线化一次插件行那两段大纲**：插件行标题行从
  // 「只有 cardId」改成「cardHead = cardId + 「企业」签 + 版本短号签」，第二行从「企业发布 · v1.2.0」
  // 改成**描述**（本 fixture 里 ent-a 带描述、ent-b 已下架故仍是「已不在企业目录中」）。
  // 这是**再基线化、不是放宽判据**：锁的形态一字未改（仍是逐行逐字的大纲 + `<style>` 两道字节级判据），
  // 且 `style(12028 chars)` 与校验和**一字未动**——本刀一个 CSS 类都没加（见 plugin-card.spec 的反向锁）。
  it('pins the legacy shell output to the current structure (clickable row body, actions still siblings)', () => {
    const props = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY], [SKILL_DETAIL]),
      enterprisePlugins: [
        { packageName: 'ent-a', version: '1.2.0', description: '企业插件分发的示例描述。', state: 'ACTIVE', inCatalog: true },
        { packageName: 'ent-b', version: null, state: 'FAILED', inCatalog: false },
      ] as never,
      installedSkills: [installedSkill('1902500000000000100')],
      skillActionError: { id: SKILL.id, action: 'install' as const, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      pluginActionError: { id: 'ent-a', action: 'uninstall' as const, code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
      onToggleSkill: () => undefined,
      onTogglePluginEnabled: () => undefined,
      // **本刀（本地导入）**：接线面在场（真运行时恒在场：入口是官方插件页里那张卡，sessionUsable 那只
      // 是页内门控）⇒ 那份大纲里就该有它的**文件选择器**那一行（空闲态不出反馈，故只多这一行）。
      // 判据不是「多一行」，而是「**列表视图里它真的在**」：它挂在整个页面级 chrome 上，
      // 三支视图（列表 / 技能详情 / 配方详情）都要有（触发它的「添加」下拉住标题行槽里、三支都在场）。
      skillImport: {
        state: undefined,
        inputRef: { current: null },
        onOpen: () => undefined,
        onSelect: () => undefined,
      },
    }
    const skillsTree = EnterpriseMarketLegacyShell(props)
    expect(domOutline(skillsTree)).toEqual(LEGACY_SHELL_OUTLINE)
    expect(domOutline(EnterpriseMarketLegacyShell({ ...props, activeTab: 'plugins' }))).toEqual(LEGACY_PLUGINS_OUTLINE)
    expect(collectStyleText(skillsTree).length).toBe(LEGACY_STYLE_LENGTH)
    expect(styleChecksum(collectStyleText(skillsTree))).toBe(LEGACY_STYLE_CHECKSUM)
  })

  // 类名隔离的源码级不变量（本轮发现的真实隐患）：本页与「企业设置 → 插件」（`plugin-market.tsx`）都注入
  // 同名前缀的 `<style>`，而两者用的是**全局单类选择器**——同一个类名会被后挂载的那份 CSS 覆盖
  // （例如 `plugin-market` 的 `.own-market-card` 会把本页卡片改成 1px/8px/padding:16、`.own-market-search input`
  // 会以更高特异性压掉本页输入框的描边）。故本文件的类名必须与同包其他源文件**零交集**。
  it('keeps this page\'s style class names disjoint from every other source file', async () => {
    const mine = declaredClassNames(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 抽取器先自证有效：抽取器必须能拿到真正渲染的那串类名（通栏行 + 页签条 + 详情子页面 + 文件树/预览）。
    expect(mine.has('own-market-rows')).toBe(true)
    expect(mine.has('own-market-row')).toBe(true)
    expect(mine.has('own-market-storeTabs')).toBe(true)
    expect(mine.has('own-market-cardId')).toBe(true)
    expect(mine.has('own-market-cardDesc')).toBe(true)
    expect(mine.has('own-market-crumb')).toBe(true)
    expect(mine.has('own-market-detailTitle')).toBe(true)
    expect(mine.has('own-market-fileRows')).toBe(true)
    expect(mine.has('own-market-fileText')).toBe(true)
    // 卡片时代那套类名 + 独立应用商店外壳那套类名**整组删除**（死样式不留）：源文件里一个都不许再有声明。
    for (const dead of [
      'own-market-cardShell', 'own-market-cardGrid', 'own-market-cardContent', 'own-market-cardMainRow',
      'own-market-cardTitle', 'own-market-cardDescription', 'own-market-cardTrailing', 'own-market-cardActions',
      'own-market-phaseDot', 'own-market-configTag', 'own-market-rowStatus',
      'own-market-storeHero', 'own-market-storeHeroTitle', 'own-market-storeHeroChips', 'own-market-storeHeroChip',
      'own-market-storeHeroNote', 'own-market-catalogSearch', 'own-market-catalogSearchInput',
      'own-market-catalogSearchEmpty', 'own-market-storePage', 'own-market-catalog',
      // **本刀（撤掉详情左上角那枚 48×48 图标）**：真相是它本来就是本文件自己画的
      // `.own-market-detailIcon`（不是官方 cardIcon），连元素带这条死样式一并删除。
      // 故它进这份死样式清单——**不许复活**，免得又变成一枚没人要的 48×48 盒子。
      'own-market-detailIcon',
    ]) {
      expect(mine.has(dead), dead).toBe(false)
    }
    // 实渲染的那份 `<style>` 与源码声明一致：行取值 + 页签条 + 节容器在，卡片时代 / 商店外壳那套不在。
    // （`declaredClassNames` 按模板字面量抽取，故把 `<style>` 里的 CSS 重新包成一对反引号。）
    const cssClassesOf = (tree: ReactNode): Set<string> => declaredClassNames(`\`${collectStyleText(tree)}\``)
    const shellClasses = cssClassesOf(EnterpriseMarketLegacyShell({ view: 'page' }))
    for (const shared of [
      'own-market-rows', 'own-market-row', 'own-market-rowLine', 'own-market-rowMain',
      'own-market-cardId', 'own-market-cardDesc', 'own-market-storeTabs', 'own-market-storeTab',
      'own-market-section', 'own-market-cardHead', 'own-market-inlineError',
    ]) {
      expect(shellClasses.has(shared), shared).toBe(true)
    }
    // 详情子页面的样式**不在列表视图那份 `<style>` 里**（切进详情才挂 `detailStyles`，列表不背这份 CSS）。
    for (const detailOnly of ['own-market-crumb', 'own-market-detailTitle', 'own-market-fileRows', 'own-market-fileText']) {
      expect(shellClasses.has(detailOnly), detailOnly).toBe(false)
    }
    expect(shellClasses.has('own-market-storeHero')).toBe(false)
    expect(shellClasses.has('own-market-catalogSearch')).toBe(false)
    expect(shellClasses.has('own-market-cardShell')).toBe(false)
    expect(shellClasses.has('own-market-cardGrid')).toBe(false)
    // 会与 plugin-market 撞名的那三个旧名字（以及它们各自的派生名）不再出现。
    expect(mine.has('own-market-card')).toBe(false)
    expect(mine.has('own-market-search')).toBe(false)
    expect(mine.has('own-market-tabs')).toBe(false)
    const names = (await readdir(new URL('../src/', import.meta.url)))
      .filter(name => /\.tsx?$/.test(name) && name !== 'marketplace-entry.tsx')
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const other = declaredClassNames(await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8'))
      expect([...mine].filter(cls => other.has(cls)), name).toEqual([])
    }
  })
})

/**
 * **技能详情子页面 + 左文件树 / 右文件预览（本刀的新功能）**。
 *
 * 承载形式：点技能行**本体**（图标 + 标题 + 描述那一片）把面板**整页切到**详情子页面
 * （`EnterpriseMarketLegacyShell` 按 `props.skillPage` 走两个 return 分支：详情那一支里列表 / 页签整段不挂载），
 * 面包屑「返回技能列表」是唯一返回入口。**弹层（官方 `Modal`）已彻底移除**——下面有一条反向锁。
 *
 * 这里锁八件事：
 *  ① 行本体是一枚真 `<button>`（可点提示 = 光标 + focus 环 + `aria-label`），点它交回**那一行**；
 *  ② 点 `[有更新]` 与拨官方 `Switch` **不**触发详情——它们是行本体的**同级兄弟**（结构性保证），动作照常触发；
 *  ③ 详情子页面照**官方插件详情页**的结构与取值：面包屑（可见文案 + `aria-label`）/ `h3` 标题 + 版本徽标 /
 *     等宽标识行（`skillId`）/ 描述 / `detailSections` → `detailSection`；
 *  ④ 左文件树是 Host 真树的层级投影（`depth`/`parent`/`name`，目录行不是按钮、文件行是按钮）；
 *  ⑤ **默认选中并预览 `SKILL.md`**，点树里其它文件即切换右侧预览；
 *  ⑥ **未安装一条请求都不发**、只说「安装后可浏览文件」，绝不伪造树；
 *  ⑦ 读取失败 → `role="alert"` + 稳定错误码 + 重试；预览是 `<pre>` 里的**纯文本子节点**（全文件无 `dangerouslySetInnerHTML`）；
 *  ⑧ 详情里的动作与行上**同源**（同一枚子块 / 同一份 facts / 同一个回调）。
 */

/**
 * ★ **本刀（刷新 / 添加同行 + 移动端四页签 / 搜索框 / 筛选钮）的两条反向锁。**
 *
 * 为什么单独起一个 describe：这两条锁的是**同一份 CSS 的取值与作用域**，与页面行为无关
 * （本机无布局引擎，jsdom 不算盒模型，故一切几何结论都只能由「CSS 取值 + 算术」取证，
 * 而不是把组件挂上去量——那会是一条**假绿的锁**）。
 *
 * 三条锁：
 *  ① **缺陷①**：`.own-market-titleActions` 必须让两枚按钮成为同一行 flex 项、且自身不压缩
 *     （`display:flex` + `flex:none`）。它的取值**桌面可见**（用户口径①不限视口），故住在**顶层**，不出现在任何媒体查询里；
 *  ② **缺陷②**：窄屏那四条规则必须**只**住在 `@media (max-width: 560px)` 里
 *     （`splitTopLevelCss` 把顶层与媒体块分开后逐条断言）⇒ 桌面（≥1024px）不命中，版面逐字节不变；
 *  ③ **算术**：把每一块的 min-content 宽度按**本文件自己的 CSS 取值**算出来，
 *     证明 360 / 390 / 414px 三个窄宽度下两行都不溢出（页签 297px < 360px；第二行只要 120+32=152px）。
 */
describe('enterprise market responsive layout (refresh+add one row, narrow-screen toolbar)', () => {
  const shellCss = (): string => collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))

  /**
   * 页签行几何的**唯一一份取值**（全部取自本文件 CSS，不是估的）：
   *   · `.own-market-storeTab` 的 `padding:5px 12px` ⇒ 每枚横向内衬 **12×2 = 24px**；
   *   · `.own-market-storeTab` 的 `font-size:13px` ⇒ 逐字符宽按下面的假设算；
   *   · `.own-market-storeTabs` 的 `gap:2px` ⇒ **n−1** 道；`padding:3px` ⇒ 两端 **3×2 = 6px**。
   */
  // ★ **本刀（task-20 B）**：页签条改成官方分段胶囊（等宽）⇒ 三处取值随之改：
  //   每枚横向内衬 12×2 → **16×2 = 32**（官方 .tab 的 padding:0 16px）、轨道内衬 3×2 → **2×2 = 4**
  //   （官方是 4px，我们取 2px 是为了总高落到 32），并且**不再逐枚算宽**（见下面 measureTabs）。
  const TAB_H_PADDING = 16 * 2
  const TAB_FONT_SIZE = 13
  const TAB_GAP = 2
  const TAB_TRACK_PADDING = 2 * 2
  /**
   * **单字符宽的假设**（取不到真实字体度量，故取**上界**，宁可估宽不估窄）：
   *   · CJK（含全角标点、CJK 扩展 A）**1em** = `font-size` = **13px** —— 本仓沿用既有口径；
   *   · 数字与空格按**半角 0.5em** = 6.5px。
   *
   * ★ **task-16 纠正**：上一把刀写成「数字计数是半角 ⇒ 真实更窄 ⇒ 212 是上界」——**方向反了**。
   *   两处都错：① 页签文案是 `enterpriseMarketTabLabel(label, count) = label + ' ' + count`
   *   （`src/marketplace-entry.tsx:549`），**计数就渲染在页签里面**（真机截图「技能 11」），
   *   漏掉它只会把宽度**算小**；② 多数码合成字符只会让文案**更宽**，不可能更窄。
   *   故旧模型算出的 **212 是下界**，不是上界（本文件第 ③ 条用例末尾把这一点也锁进断言）。
   */
  const measureText = (text: string): number => {
    let width = 0
    for (const char of text) width += /[\u2e80-\u9fff\uff00-\uffef]/.test(char) ? TAB_FONT_SIZE : TAB_FONT_SIZE / 2
    return width
  }
  /**
   * 一组**最终页签文案**（已含计数）的整条页签轨宽度（**上界**）。
   *
   * ★ **本刀（task-20 B）起是「等宽」模型**：轨道是 `display:inline-grid` +
   *   `grid-auto-columns:1fr`（官方分段控件的行为）⇒ **每一列都被撑到最宽那一枚**的 max-content
   *   ⇒ 轨道宽 = n × (最宽文案 + 32) + (n−1)×2 + 4。故加一枚页签**会同时改变所有列的宽度**，
   *   不再是「只加一列」的线性增量。
   * ★ 文案**不在测试里另养一份清单**（上一把刀的 `TAB_LABELS` 就是那样，故源里加第五枚页签时
   *   这条锁**不会红**——它保护的正是它测不到的那件事）。这里一律从源真源派生：
   *   `ENTERPRISE_MARKET_TABS` → `enterpriseMarketShellModel(props).tabEntries` →
   *   `enterpriseMarketTabLabel(label, count)`。改源即改此算术。
   */
  const measureTabs = (labels: readonly string[]): number => {
    const widest = Math.max(...labels.map(label => measureText(label)))
    return labels.length * (widest + TAB_H_PADDING)
      + TAB_GAP * (labels.length - 1) + TAB_TRACK_PADDING
  }

  it('keeps the refresh / add slot to one row at every width (defect 1: display:flex + flex:none, top level)', () => {
    const css = shellCss()
    const rule = cssRuleBody(css, '.own-market-titleActions')
    // 缺陷①的三条取值逐字锁住：缺任何一条，两枚按钮就会在容器内部换行（用户看到的「两行」）。
    expect(rule).toContain('display:flex')
    expect(rule).toContain('flex:none')
    expect(rule).toContain('margin-left:auto')
    // `gap` 与官方 `_titleRow` 同值：两枚之间的间距一像素没变（原来由 inline 空白折叠给出）。
    expect(rule).toContain('gap:8px')
    // ★ 这三条取值是**桌面可见**的 ⇒ 必须住在**顶层**，不许只写在某个媒体查询里。
    const topLevel = splitTopLevelCss(css).map(part => part.text).join('\n')
    expect(topLevel).toContain('.own-market-titleActions{display:flex')
  })

  it('scopes every narrow-screen toolbar rule to the 560px breakpoint only (defect 2: desktop stays byte-identical)', () => {
    const css = shellCss()
    const topLevel = splitTopLevelCss(css).filter(part => part.scope === 'top')
    const topText = topLevel.map(part => part.text).join('\n')
    const mediaBlocks = splitTopLevelCss(css).filter(part => part.scope === 'media')

    // ── ① 桌面/宽屏那一套取值**仍在顶层**，且窄屏形态**一个字都没混进顶层**（这是最强反回归判据）。
    expect(cssRuleBody(topText, '.own-market-searchRow')).toContain('flex-wrap:nowrap')
    expect(cssRuleBody(topText, '.own-market-storeTabs')).toContain('flex:0 0 auto')
    expect(cssRuleBody(topText, '.own-market-query')).toContain('flex:0 1 320px')
    expect(cssRuleBody(topText, '.own-market-rowBarSpacer')).toContain('flex:1 1 auto')
    // ★ 注意：本文件**顶层本来就有**合法的 `flex-wrap:wrap`（如 `.own-market-titleRow`、进度行），
    //   所以这里**不能**对整份顶层串做子串否定（那会恒红）；必须**按规则**锁「这一条没被改成换行」。
    expect(cssRuleBody(topText, '.own-market-searchRow'), '窄屏的换行形态不许出现在顶层').toContain('flex-wrap:nowrap')
    expect(topText, '页签满宽不许出现在顶层').not.toContain('flex:0 0 100%')
    expect(topText, '页签横向滚动不许出现在顶层').not.toContain('overflow-x:auto')
    expect(cssRuleBody(topText, '.own-market-rowBarSpacer'), '窄屏隐藏占位那条不许出现在顶层').not.toContain('display:none')

    // ── ② 窄屏形态**确实住在** 560px 那条媒体查询里（既锁断点值、也锁四条规则的取值逐字）。
    const narrow = mediaBlocks.filter(part => part.text.indexOf('.own-market-storeTabs{flex:0 0 100%') !== -1)
    expect(narrow).toHaveLength(1)
    const narrowText = narrow[0]!.text
    expect(cssRuleBody(narrowText, '.own-market-searchRow')).toContain('flex-wrap:wrap')
    // ★ task-21 更正：原先写 row-gap:0 并说「8px 会叠在 margin-bottom 上、底距变 28px」——**错的**：
    //   flex 的 row-gap 只在两条线之间插入、最后一条线之后**不加** ⇒ 底距恒为 margin-bottom:20px。
    //   而 row-gap:0 让两行紧贴（真机截图里胶囊与搜索框连成一片）⇒ 改成 8px。
    expect(cssRuleBody(narrowText, '.own-market-searchRow')).toContain('row-gap:8px')
    // 页签独占第一行：满宽 + 不收缩 + 横向滚动（超宽时用到滚动，见下面那条算术锁）。
    expect(cssRuleBody(narrowText, '.own-market-storeTabs')).toContain('flex:0 0 100%')
    expect(cssRuleBody(narrowText, '.own-market-storeTabs')).toContain('overflow-x:auto')
    // 搜索框在第二行吃掉剩余宽度（上限解除），但它的 120px 下限不许动。
    expect(cssRuleBody(narrowText, '.own-market-query')).toContain('flex:1 1 auto')
    expect(cssRuleBody(narrowText, '.own-market-query')).toContain('min-width:120px')
    // 弹性占位在窄屏这一形态里只剩「会涨开的空盒子」这一个副作用 ⇒ 直接不显示；
    // 它本来就是 aria-hidden 的纯装饰，故第二行干净地只剩「搜索框（铺满）+ 筛选钮」两块。
    expect(cssRuleBody(narrowText, '.own-market-rowBarSpacer')).toContain('display:none')
  })

  /**
   * **窄屏可用宽**（W）：本仓**没有**权威的窄屏「内容宽」常量——可测到的只有容器自身语义
   * （`.own-market-query` 的 `flex:0 1 320px;max-width:320px` ⇒ 工具行内搜索框一个都不压时**恰好**
   * 320px 可用）与断点值（`@media (max-width: 560px)`）。取**最保守的那一条**，并把不确定性写明：
   *   · 真机（375 CSS px 宽）实测内容宽 ≈ **343px**，故 **320px** 是一个**下界型**假设：真实可用宽只会更大；
   *   · 因此「放得下」的结论在真机上**只会更容易成立**，而「放不下」的结论在更窄的屏上**只会更成立**；
   *   · 反过来说，**320–560px 之间**（含 360 / 390 / 414）五枚页签可能仍放得下 ⇒ 横向滚动那条降级路径
   *     在这些宽度上**不一定被触发**，这属于**未验证项**（本机无布局引擎，不许编渲染结论）；
   *   · ★ **它同时是「下界型假设」的落点**：真机 360px 下若可用宽 **< 264**（本模型算出的四枚总宽），
   *     四枚页签就会超宽、**横向滚动**（页签轨那条 `overflow-x:auto` 兜底），而不是换行或被压到 0 宽 ——
   *     即「四枚在 320px 放得下」这条断言**不保证**在任意真机宽度下都成立，只保证在本假设下成立。
   */
  const NARROW_AVAILABLE_WIDTH = 320

  it('fits four tabs and overflows with a fifth (per-tab text, counted labels, derived from ENTERPRISE_MARKET_TABS)', () => {
    const css = shellCss()
    const topText = splitTopLevelCss(css).filter(part => part.scope === 'top').map(part => part.text).join('\n')
    const narrowText = splitTopLevelCss(css).filter(part => part.scope === 'media' && part.text.indexOf('.own-market-storeTabs{flex:0 0 100%') !== -1).map(part => part.text).join('\n')

    // ── 先确认算术依赖的取值**真的在 CSS 里**（否则下面的算式就是照着注释算的，不是照着代码算的）。
    expect(cssRuleBody(topText, '.own-market-storeTab')).toContain('padding:0 16px')
    expect(cssRuleBody(topText, '.own-market-storeTab')).toContain('height:28px')
    expect(cssRuleBody(topText, '.own-market-storeTab')).toContain('font-size:13px')
    expect(cssRuleBody(topText, '.own-market-storeTab')).toContain('white-space:nowrap')
    expect(cssRuleBody(topText, '.own-market-storeTabs')).toContain('gap:2px')
    expect(cssRuleBody(topText, '.own-market-storeTabs')).toContain('padding:2px')
    // **等宽**是 task-20 的承重取值：只认 grid-auto-columns:1fr，逐枚宽的口径就不成立。
    expect(cssRuleBody(topText, '.own-market-storeTabs')).toContain('grid-auto-columns:1fr')
    expect(cssRuleBody(topText, '.own-market-storeTabs')).toContain('grid-auto-flow:column')
    expect(cssRuleBody(topText, '.own-market-query')).toContain('min-width:120px')
    expect(cssRuleBody(topText, '.own-market-filterBtn')).toContain('width:32px')
    expect(cssRuleBody(narrowText, '.own-market-storeTabs')).toContain('flex:0 0 100%')
    // 横向滚动兜底那条必须在窄屏块里（第五枚超宽时**唯一**的降级路径）。
    expect(cssRuleBody(narrowText, '.own-market-storeTabs')).toContain('overflow-x:auto')

    /**
     * ── 被测对象 = 源真源的派生结果，**不是**测试内手抄的一份清单。
     *
     * `enterpriseMarketShellModel` 是外壳与页签条**唯一**的模型入口，它的 `tabEntries` 就是
     * `ENTERPRISE_MARKET_TABS.map(tab => … enterpriseMarketTabLabel(tab.label, count))`
     * （`src/marketplace-entry.tsx:1947-1951`）⇒ 源里加/删/改页签，这里**必红**。
     * 每个用例显式给出计数，是为了让文案宽**不依赖 fixture 的偶然条数**（计数只由模型决定）。
     */
    const cases: readonly { readonly name: string; readonly counts: readonly number[] }[] = [
      { name: '零计数（与 294px 那条核对对应）', counts: [0, 0, 0, 0] },
      { name: '真机截图那一组计数（技能 11 / 插件 6 / 配方 1 / 组件 4）', counts: [11, 6, 1, 4] },
      { name: '十位数（上界方向：计数位数越多越宽）', counts: [10, 10, 10, 10] },
    ]
    for (const { name, counts } of cases) {
      const entries = enterpriseMarketShellModel({ view: 'page', sessionUsable: true }).tabEntries
      // ① 枚数与逐枚基础词都从源真源派生（测试里再抄一份清单就会被这条抓住）。
      expect(entries.map(entry => entry.label), name).toEqual(ENTERPRISE_MARKET_TABS.map(tab => tab.label))
      // ② 文案**确实含计数**（不是只有基础词）——这正是上一把刀漏掉的那一项。
      for (const entry of entries) expect(entry.text, name).toBe(enterpriseMarketTabLabel(entry.label, entry.count))

      // 逐枚文案：基础词取**源真源**（entries 的 label），计数由本用例显式给定 ⇒ 文案宽不依赖 fixture。
      const fourLabels = entries.map((entry, index) => enterpriseMarketTabLabel(entry.label, counts[index] ?? 0))
      const fourTotal = measureTabs(fourLabels)
      // ② 现状四枚**必须放得下**。
      expect(fourTotal, `${name}：四枚页签放不进 ${NARROW_AVAILABLE_WIDTH}px`).toBeLessThanOrEqual(NARROW_AVAILABLE_WIDTH)

      // ③ **第五枚「连接器」（3 个全角字，MCP 方案要加的那一枚）必须如实断言超宽**，
      //    由页签轨 `overflow-x:auto`（窄屏块里已逐字确认）横向滚动兜底——不许再用漏项模型声称放得下。
      const fifthLabel = enterpriseMarketTabLabel('连接器', 0)
      // 第五枚的文案宽 = 3 个全角字 + 「 0」两个半角 ⇒ 比任一枚两字基础词都宽。
      expect(measureText(fifthLabel), '三枚全角字 + 半角计数').toBeGreaterThan(measureText(fourLabels[0]!))
      const fiveTotal = measureTabs([...fourLabels, fifthLabel])
      expect(fiveTotal, `${name}：加了第五枚页签却没有超宽（模型或断点假设失效了）`).toBeGreaterThan(NARROW_AVAILABLE_WIDTH)
      // ★ **等宽**下加一枚页签的增量不再是「一列」：新枚的文案（连接器 0 = 52px）**比原四枚都宽**
      //   ⇒ 它成为新的最宽列 ⇒ **所有列**都从 39+32=71 涨到 52+32=84，再加它自己那一列与一道 gap。
      const connectorTextWidth = [...'连接器 0'].reduce((sum, char) => sum + measureText(char), 0)
      expect(connectorTextWidth).toBe(3 * TAB_FONT_SIZE + 2 * (TAB_FONT_SIZE / 2))
      expect(fiveTotal - fourTotal, name).toBe(
        4 * (connectorTextWidth - measureText(fourLabels[0]!))   // 四列各涨这么多
        + connectorTextWidth + TAB_H_PADDING + TAB_GAP,          // 再加新那一列与一道 gap
      )
    }

    // ── 第二行：搜索框（下限 120）+ 筛选钮（32）；`.own-market-filterWrap` 是 flex:none，随内容取 32。
    const secondRowMin = 120 + 32
    expect(secondRowMin).toBe(152)
    expect(secondRowMin).toBeLessThanOrEqual(NARROW_AVAILABLE_WIDTH)
  })

  it('pins the arithmetic to the numbers it claims (default fixture + on-device cross-check) and corrects 「212 是上界」', async () => {
    const entries = enterpriseMarketShellModel({ view: 'page', sessionUsable: true }).tabEntries
    const fourLabels = entries.map(entry => entry.text)
    const fourTotal = measureTabs(fourLabels)
    const fiveTotal = measureTabs([...fourLabels, enterpriseMarketTabLabel('连接器', 0)])
    const secondRowMin = 120 + 32

    // ── ① 默认 fixture（零计数）的逐值读数（**等宽**模型）：四枚文案都是 2 全角 + 1 半角 = 39
    //      ⇒ 最宽 39、每列 39+32 = 71 ⇒ 4×71 + 3×2 + 4 = **294**；加「连接器 0」(52) ⇒ 5×84 + 8 + 4 = **432**。
    expect(entries.map(entry => entry.text)).toEqual(['技能 0', '插件 0', '配方 0', '组件 4'])
    expect(fourTotal).toBe(294)
    expect(fiveTotal).toBe(432)
    expect(secondRowMin).toBe(152)

    /**
     * ── ② 与**真机截图硬测量**对照（Lead 用 DPR=2.781 反推：页签轨实宽 = 物理 249..1000 = 752px
     *    ⇒ 752 / 2.781 = **270.4 CSS px**）。截图那一组的真实计数是 **技能 11 / 插件 6 / 配方 1 / 组件 4**。
     *
     *    ★ 那条实测是**改动前**的几何（逐枚宽 + 内衬 24 + 轨道内衬 6），故对照也只能按**旧公式**做：
     *      `技能 11` 45.5 + `插件 6` 39 + `配方 1` 39 + `组件 4` 39 + 4×24 内衬 + 3×2 gap + 6 = **270.5px**
     *      ⇒ 与实测 **差 0.04%** —— 这一条验的是 `measureText` 的**逐字符宽假设**，不是当前版式。
     *      （`配方 0` 与 `配方 1` 在本模型里**同宽**——两者都是一个半角数字；截图实际是 1，故用 1。）
     *    ★ **若把数字也按 1em（不区分半角）**：四条文案各 4/3/3/3 个全角字 ⇒ 52+39+39+39 = 169，
     *      加 96 + 6 + 6 = **277px** ⇒ 与实测差 **2.4%**。这是**另一种假设下的上界**，不是本模型的读数；
     *      本模型仍按 task-16 的规格用 **0.5em**（更贴真实字体度量，且仍不低估）。
     *    ★ 本机没有布局引擎 ⇒ 这不是「我渲染过」，是**把模型钉到一条已存在的实测读数上**。
     */
    const onDeviceLabels = ENTERPRISE_MARKET_TABS.map((tab, index) => enterpriseMarketTabLabel(tab.label, [11, 6, 1, 4][index] ?? 0))
    // 旧公式（改动前的逐枚宽 + 内衬 24 + 轨道内衬 6）逐字复算：
    const legacyTrack = onDeviceLabels.reduce((sum, label) => sum + measureText(label) + 12 * 2, 0)
      + 2 * (onDeviceLabels.length - 1) + 3 * 2
    expect(legacyTrack).toBe(270.5)
    // ★ **task-20 起几何变了**：等宽 + 内衬 32 ⇒ 同一组计数现在是 **320px**（实测 270.4 对应的是旧版式，
    //   两者**不可再直接比**；这条差异是有意为之 —— 用户要的是「分段胶囊 + 与搜索框等高」）。
    expect(measureTabs(onDeviceLabels)).toBe(320)
    // 半角假设的反证：把同一个「技能 11」按 1em 算就会多出 6.5px，四条合计正好是上面那个 277。
    expect(measureText('技能 11')).toBe(2 * TAB_FONT_SIZE + 3 * (TAB_FONT_SIZE / 2))
    expect(4 * TAB_FONT_SIZE + 3 * TAB_FONT_SIZE + 3 * TAB_FONT_SIZE + 3 * TAB_FONT_SIZE).toBe(169)
    expect(169 + 4 * (12 * 2) + 3 * 2 + 3 * 2).toBe(277)

    /**
     * ── ③ ★ 上一把刀那句「212 是**上界**」的纠正（反向锁）。
     *    旧模型 = 每枚只数 2 个全角字、**不含计数**：
     *      n × (2 × 13 + 24) + 2 × (n − 1) + 6 ⇒ 四枚 = **212**。
     *    它对同一份四枚页签漏掉了「计数文本」⇒ 它算出的是**下界**：
     *    含计数的模型恒 **≥** 这个数（等号只在计数为空串时成立，而 `label + ' ' + count` 永不为空）。
     */
    //    （那一刀的公式里每枚内衬是 24、轨道内衬 6，故这里按**当年的取值**复算 212。）
    const staleLowerBound = fourLabels.length * (2 * TAB_FONT_SIZE + 12 * 2)
      + TAB_GAP * (fourLabels.length - 1) + 3 * 2
    expect(staleLowerBound).toBe(212)
    expect(fourTotal, '含计数的模型必须 ≥ 旧模型的 212（旧模型是下界，不是上界）').toBeGreaterThan(staleLowerBound)

    // ── ④ 源注释与模型**同一口径**（清掉 545 / 212 并存那处自相矛盾）：
    //      既不许再出现空口无凭的「溢出门槛」，也不许再出现方向说反的「上界」说法。
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    expect(source, '旧的「545 溢出门槛」口径必须已被清掉').not.toMatch(/545\s*溢出门槛/)
    expect(source, '「数字计数更窄 / 212 是上界」这个方向说反的说法必须已被清掉')
      .not.toMatch(/数字计数是半角，真实更窄/)
    // 断点声明只留真规则那几处：注释不再复述（只写数值，避免复制粘贴出第二个「声明样」的串）。
    // **本刀（task-17 ①）**：网格那条断点由 560 抬到 900 ⇒ 560 现在**只剩工具行那一条**、
    // 900 只有网格那一条（两处分档，见下面那组专门的用例）。
    // **本刀（task-20 B）**：工具行那条断点由 560 抬到 **600**（等宽页签变宽 + 补齐侧栏轨道与三道 gap）。
    expect(source.split('@media (max-width: 560px)').length - 1).toBe(0)
    expect(source.split('@media (max-width: 600px)').length - 1).toBe(1)
    expect(source.split('@media (max-width: 900px)').length - 1).toBe(1)
    // 含计数的模型与源注释里的读数同源（注释与断言不许各说一套）。
    // ★ task-20 起页签改成**等宽**分段胶囊 ⇒ 四枚 264 → **294**（零计数档）、五枚 342 → **432**。
    expect(source).toContain('294px')
    expect(source).toContain('432px')
    expect(source).toContain('320px')
  })

/**
 * ★ **本刀（task-17 ①）**：行网格「两列 → 单列」的回落断点。
 *
 * 用户在那张真机截图上看到的是「两列里标题普遍被省略」。断点 560 → 900 **不是看着合适**，
 * 而是由「最长那条标题需要多少 px 才不截断」反推出来的；下面三条用例把每一步都钉成断言：
 *  ① 断点值确实住在 `@media (max-width: 900px)` 里（顶层仍是两列，未动桌面卡片）；
 *  ② 两条断点**分档**（工具行仍 560）——它们量的是不同的东西，且互不串档；
 *  ③ 850 / 1024 / 1440 三档 + 「刚过断点」那一档的 列数 → 列宽 → 标题可用宽，逐档 ≥ 最长标题所需。
 */
describe('enterprise market row grid breakpoint (task-17 ①: two columns truncate the longest title)', () => {
  const css = (): string => collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))
  /** 截图里最长那条标题的**真源**：本仓导入清单 `tools/skillhub-import/convert.py:123` 的 displayName。 */
  const LONGEST_TITLE = '露禾论文写作助手（免费版pro）'
  /** 标题字号取本文件 CSS 的**真值**（`.own-market-cardId` 的 15px，不是描述行的 13px）。 */
  const TITLE_FONT_SIZE = 15
  /**
   * 标题可用宽 = 列宽 − 这个开销（行内衬 24 + 两道 gap 32 + 图标 **48** + 标题行两枚签与 gap ≈ 41）。
   * ★ **task-19 把图标 40 → 48** ⇒ 这个数由 137 涨到 **145**（+8），断点下限随之上移，见下面那条用例。
   */
  const TITLE_OVERHEAD = 145
  /** `.own-market-rows` 的列距（`gap:28px 48px` 的第二个值）。 */
  const GRID_COLUMN_GAP = 48
  /** 视口 − 内容宽（截图实测反推：折叠态侧栏轨道 56 + 两侧内衬 ≈67）。 */
  const CHROME = 123
  const GRID_BREAKPOINT = 900
  /** **task-20 B**：工具行那条断点由 560 抬到 600（等宽页签更宽 + 补齐侧栏轨道与三道 gap，见源注释算式）。 */
  const TOOL_ROW_BREAKPOINT = 600

  /** 一个文案的**上界**宽（CJK 1em、数字与空格 0.5em——与上面那条页签算术同一口径）。 */
  const textWidth = (text: string): number => {
    let width = 0
    for (const char of text) width += /[\u2e80-\u9fff\uff00-\uffef]/.test(char) ? TITLE_FONT_SIZE : TITLE_FONT_SIZE / 2
    return width
  }
  /** 某视口下：内容宽 → 列宽 → 标题可用宽（单列 = 内容宽；两列 = 各半再减一道列距）。 */
  const layoutAt = (viewport: number): { readonly columns: number; readonly column: number; readonly title: number } => {
    const content = viewport - CHROME
    const columns = viewport <= GRID_BREAKPOINT ? 1 : 2
    const column = columns === 1 ? content : (content - GRID_COLUMN_GAP) / 2
    return { columns, column, title: column - TITLE_OVERHEAD }
  }

  it('puts the grid single-column fallback at 900px, derived from the longest title (not 560)', async () => {
    const parts = splitTopLevelCss(css())
    const topText = parts.filter(part => part.scope === 'top').map(part => part.text).join('\n')
    const media = parts.filter(part => part.scope === 'media')

    // ① 顶层仍是**两列**、列距一字未动（本刀不碰桌面卡片内部结构）。
    expect(cssRuleBody(topText, '.own-market-rows')).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
    expect(cssRuleBody(topText, '.own-market-rows')).toContain('gap:12px 48px')
    // ② 单列回落**只**住在断点 900 的那条媒体查询里，且全文件只有这一条 900 断点（注释不复述声明）。
    const single = media.filter(part => part.text.includes('.own-market-rows{grid-template-columns:minmax(0,1fr)'))
    expect(single).toHaveLength(1)
    expect(single[0]!.text).toContain('@media (max-width: 900px)')
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    expect(source.split('@media (max-width: 900px)').length - 1, '900 断点声明只许一处').toBe(1)

    // ③ 断点值由算术推出，逐步给读数：
    //    最长标题 13 个全角字 + 3 个半角字母、字号 15px ⇒ 217.5px；
    //    两列要 2×(217.5 + 137) + 48 = 757px 内容宽；再加视口里内容之外的那 ≈123px ⇒ 下限 880px。
    expect(LONGEST_TITLE, '标题真源不许被改写').toBe('露禾论文写作助手（免费版pro）')
    expect([...LONGEST_TITLE].length).toBe(16)
    expect(textWidth(LONGEST_TITLE)).toBe(217.5)
    expect(2 * (217.5 + TITLE_OVERHEAD) + GRID_COLUMN_GAP).toBe(773)
    expect(773 + CHROME).toBe(896)
    // **task-19 复核**：图标 40 → 48 后下限由 880 抬到 896 ⇒ 900 **仍然够**（余量从 20px 收到 4px）。
    expect(GRID_BREAKPOINT).toBeGreaterThanOrEqual(896)
    expect(GRID_BREAKPOINT).toBeLessThan(1024)
    // 与截图实测互为印证：视口 845（= 722 + 123）下两列的列宽正好是实测的 337px。
    expect((845 - CHROME - GRID_COLUMN_GAP) / 2).toBe(337)
  })

  it('keeps the tool row at 600 while the grid moves to 900: the two breakpoints stay separate tiers', () => {
    const media = splitTopLevelCss(css()).filter(part => part.scope === 'media')
    // 工具行那四条窄屏取值仍在 560 那条里（本刀**一字未动**它）。
    const toolRow = media.filter(part => part.text.includes('.own-market-storeTabs{flex:0 0 100%'))
    expect(toolRow).toHaveLength(1)
    expect(toolRow[0]!.text).toContain(`@media (max-width: ${TOOL_ROW_BREAKPOINT}px)`)
    expect(TOOL_ROW_BREAKPOINT).toBe(600)
    expect(cssRuleBody(toolRow[0]!.text, '.own-market-searchRow')).toContain('flex-wrap:wrap')
    // ★ 分档 = **互不串档**：工具行那条里没有网格规则，网格那条里没有工具行规则。
    expect(toolRow[0]!.text, '网格规则不许混进工具行那档').not.toContain('.own-market-rows{grid-template-columns:minmax(0,1fr)')
    const grid = media.filter(part => part.text.includes('.own-market-rows{grid-template-columns:minmax(0,1fr)'))
    expect(grid).toHaveLength(1)
    expect(grid[0]!.text, '工具行规则不许混进网格那档').not.toContain('.own-market-storeTabs{flex:0 0 100%')
    expect(grid[0]!.text).not.toContain('flex-wrap:wrap')
    expect(grid[0]!.text).not.toContain('display:none')
    // 两档的断点值必须不同（同值就是「分档」失败）。
    expect(TOOL_ROW_BREAKPOINT).not.toBe(GRID_BREAKPOINT)
  })

  it('fits the longest title at 850 / 1024 / 1440 and just above the breakpoint', () => {
    // ① 三档逐档给读数（列数 → 列宽 → 标题可用宽）。
    expect(layoutAt(850)).toEqual({ columns: 1, column: 727, title: 582 })
    expect(layoutAt(1024)).toEqual({ columns: 2, column: 426.5, title: 281.5 })
    expect(layoutAt(1440)).toEqual({ columns: 2, column: 634.5, title: 489.5 })
    // ★ 最紧的一档是**刚过断点**（901）——它才是「断点抬够了」的真正判据（余量只有 2.5px）。
    expect(layoutAt(901)).toEqual({ columns: 2, column: 365, title: 220 })
    for (const viewport of [850, 901, 1024, 1440]) {
      expect(layoutAt(viewport).title, `${viewport}px：最长标题仍会被省略`).toBeGreaterThanOrEqual(217.5)
    }
    // ② 截图那个宽度（845）在**旧的 560 断点**下仍是两列、且装不下 ⇒ 用户报的现象可复现。
    //    ★ 截图当时图标还是 **40px** ⇒ 那时的开销是 **137**（不是本刀之后的 145）；337 − 137 = 200，
    //    正是截图里那个 ≈200px。用现在的 145 反推同一列只有 **192** —— 图标长大本身让文本列更窄，
    //    这也正是 task-19 必须重算断点的原因。
    const SCREENSHOT_TITLE_OVERHEAD = 137
    expect((845 - CHROME - GRID_COLUMN_GAP) / 2 - SCREENSHOT_TITLE_OVERHEAD).toBe(200)
    expect(200).toBeLessThan(217.5)
    expect((845 - CHROME - GRID_COLUMN_GAP) / 2 - TITLE_OVERHEAD).toBe(192)
    // ③ 同一宽度在**新的 900 断点**下变成单列 ⇒ 标题可用宽 577 ≥ 217.5，现象消失。
    expect(layoutAt(845)).toEqual({ columns: 1, column: 722, title: 577 })
  })
})

/**
 * ★ **本刀（task-19：列表纵向节奏与官方逐像素一致）**。用户口径：真机上「列表行间距比官方松散」。
 *
 * Lead 实测：我们 **94.4 CSS px/行** vs 官方 **66**（差 43%，差 28.4px —— 几乎正好是那条 `row-gap:28px`）。
 * 官方真源（`dsh-client-ui-plugin-manager/lib/client.js` 的 CSS module，逐字）：
 *   `_cards{gap:2px}` · `_cardHead{gap:14px;padding:8px}` · `_cardIcon{width:48px;height:48px}` ·
 *   `_cardMain{gap:4px}` · `_cardTitle{font-size:14px;line-height:20px}` · `_cardDesc{font-size:13px;line-height:18px}`
 * ⇒ 官方 = 8 + 48 + 8 = 64，＋2 = **66**。
 *
 * 这条用例**先**把算式依赖的每一个取值在 CSS 里确认，**再**做算术（不许照着注释算）。
 */
describe('enterprise market row rhythm (task-19: 66 CSS px per row, same as the official list)', () => {
  const css = (): string => collectStyleText(EnterpriseMarketLegacyShell({ view: 'page' }))

  it('pins the row rhythm to 8 + 48 + 8 + 2 = 66, computed from the seven CSS values themselves', () => {
    const parts = splitTopLevelCss(css())
    const top = parts.filter(part => part.scope === 'top').map(part => part.text).join('\n')
    const narrow = parts
      .filter(part => part.scope === 'media' && part.text.includes('.own-market-rows{grid-template-columns:minmax(0,1fr)'))
      .map(part => part.text).join('\n')

    // ── ① 七条取值逐条先在 CSS 里确认（缺任何一条，下面的算式就只是在复述注释）。
    const row = cssRuleBody(top, '.own-market-row')
    const icon = cssRuleBody(top, '.own-market-rowIcon')
    const main = cssRuleBody(top, '.own-market-rowMain')
    const title = cssRuleBody(top, '.own-market-cardId')
    const desc = cssRuleBody(top, '.own-market-cardDesc')
    expect(row).toContain('padding:8px 12px')          // 官方 _cardHead{padding:8px}（横向仍 12，见注释）
    expect(icon).toContain('width:48px')               // 官方 _cardIcon{width:48px}
    expect(icon).toContain('height:48px')              // 官方 _cardIcon{height:48px}
    expect(main).toContain('gap:4px')                  // 官方 _cardMain{gap:4px}
    expect(title).toContain('line-height:20px')        // 官方 _cardTitle{line-height:20px}
    expect(desc).toContain('line-height:18px')         // 官方 _cardDesc{line-height:18px}
    expect(cssRuleBody(narrow, '.own-market-rows')).toContain('gap:2px 0')   // 官方 _cards{gap:2px}（单列档）
    // ★ **标题字号保持 15px**（用户只要求「间距」）——不许顺手改成官方的 14px。
    expect(title).toContain('font-size:15px')
    expect(title).not.toContain('font-size:14px')
    // ★ 两列档的 12px 是**有意偏离**（官方没有两列形态）：它等于卡片自己的圆角半径。
    expect(cssRuleBody(top, '.own-market-rows')).toContain('gap:12px 48px')
    expect(row).toContain('border-radius:12px')

    // ── ② 然后才算（数字全部来自上面这些真值）。
    const PAD_V = 8
    const ICON = 48
    const MAIN_GAP = 4
    const TITLE_LH = 20
    const DESC_LH = 18
    const GAP_SINGLE = 2
    // 文本栈 20 + 4 + 18 = 42 比图标 48 矮 ⇒ **行高由图标决定**（与官方同一结论）。
    const textStack = TITLE_LH + MAIN_GAP + DESC_LH
    expect(textStack).toBe(42)
    expect(textStack).toBeLessThan(ICON)
    const rowHeight = PAD_V * 2 + ICON
    expect(rowHeight).toBe(64)
    expect(rowHeight + GAP_SINGLE).toBe(66)

    // ── ③ 官方逐条对照：同一个算式、同一个 66（官方值即上面注释里逐字引的那七条）。
    const OFFICIAL = { padV: 8, icon: 48, gap: 2, mainGap: 4, titleLh: 20, descLh: 18 }
    expect([PAD_V, ICON, GAP_SINGLE, MAIN_GAP, TITLE_LH, DESC_LH])
      .toEqual([OFFICIAL.padV, OFFICIAL.icon, OFFICIAL.gap, OFFICIAL.mainGap, OFFICIAL.titleLh, OFFICIAL.descLh])
    expect(OFFICIAL.padV * 2 + OFFICIAL.icon + OFFICIAL.gap).toBe(66)

    // ── ④ 如实记录一处**刻意不对齐**：官方 `_cardHead{gap:14px}` 是「图标 ↔ 文本」的横向间隙，
    //    我们对应的是 `.own-market-rowOpen{gap:16px}`（+2px）。本刀的冻结清单里没有它 ⇒ 不动；
    //    且它只会让「标题可用宽」更**保守**（需求更大），故 900px 断点仍成立（见上面那组用例）。
    expect(cssRuleBody(top, '.own-market-rowOpen')).toContain('gap:16px')
    expect(cssRuleBody(top, '.own-market-rowLine')).toContain('gap:16px')
  })
})

  /**
   * ★ **task-15（用户口径：「非移动端下，搜索应该右对齐」）的两条锁。**
   *
   * 缺陷机制（逐条可复核）：`.own-market-query` 是 `flex:0 1 320px`（**不 grow**），
   * `.own-market-rowBarSpacer` 是 `flex:1 1 auto`（吃光剩余）——**spacer 原先住在搜索框之后**，
   * 于是空白被它吃在搜索框**右边** ⇒ 搜索框紧贴页签（左），只有筛选钮贴行右。
   * 修法：把 spacer **上移到搜索框之前**（DOM = 视觉 = 焦点序），空白改吃在搜索框左边，
   * 于是「搜索框 320px + 筛选钮 32px」整组被推到行右。
   *
   * 下面用**渲染树**（不是文本快照）取证：`.own-market-searchRow` 的**直接子元素顺序**。
   */
  it('renders the tool row as tabs → spacer → search → filter so desktop pushes search+filter right (D1)', () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page' })
    const rows = collectByClassName(tree, 'own-market-searchRow')
    // 列表分支恰好一条工具行（页签 / 搜索 / 筛选同一条）。
    expect(rows).toHaveLength(1)
    const children = rows[0]!['children'] as ReactNode
    /**
     * 把一个子节点解析成「它最终渲染出的那个 DOM 元素的 className」。
     * 为什么需要展开：工具行第一项是**函数组件** `EnterpriseMarketTabList`（它的 className 在函数体里拼），
     * 直接读 props 会得到 undefined；用 createElement 调一次就拿得到真正落到 DOM 的那个类名。
     * 文本节点（JSX 换行空白）返回 undefined，由调用方过滤掉。
     */
    const resolveClass = (node: ReactNode): string | undefined => {
      if (!isValidElement(node)) return undefined
      if (typeof node.type === 'function') {
        const rendered = (node.type as (p: unknown) => ReactNode)(node.props)
        return resolveClass(rendered)
      }
      const cls = (node.props as Record<string, unknown>)['className']
      return typeof cls === 'string' ? cls : undefined
    }
    const order = (Array.isArray(children) ? children : [children])
      .map(resolveClass)
      .filter((cls): cls is string => cls !== undefined)
    // ① 精确顺序（D1 核心证据）：占位在**搜索框之前** ⇒ 桌面下剩余空白吃在搜索框左侧，
    //    「搜索框 320px + 筛选钮 32px」整组因此贴行右。
    expect(order).toEqual([
      'own-market-storeTabs',
      'own-market-rowBarSpacer',
      'own-market-query',
      'own-market-filterWrap',
    ])
  })

  it('leaves the online-search query row untouched (its own DOM: query → spacer → button) (D2)', () => {
    // 在线搜索面是**另一处独立 DOM**：本刀的换位只动了列表工具行，那一行的子元素顺序一字未改。
    const tree = EnterpriseMarketLegacyShell({
      view: 'page',
      onlineSearch: {
        // `loading` 是最小合法态（`enterpriseOnlineFace` 在 idle/too-short/loading 上都不读 value）
        state: { kind: 'loading' },
        query: 'pdf',
        onQueryChange: () => undefined,
        onSearch: () => undefined,
        onInstall: () => undefined,
        onReload: () => undefined,
      },
    } as unknown as EnterpriseMarketShellProps)
    const rows = collectByClassName(tree, 'own-market-searchRow')
    expect(rows).toHaveLength(1)
    const children = rows[0]!['children'] as ReactNode
    const resolveClass = (node: ReactNode): string | undefined => {
      if (!isValidElement(node)) return undefined
      if (typeof node.type === 'function') {
        const rendered = (node.type as (p: unknown) => ReactNode)(node.props)
        return resolveClass(rendered)
      }
      const cls = (node.props as Record<string, unknown>)['className']
      return typeof cls === 'string' ? cls : undefined
    }
    const order = (Array.isArray(children) ? children : [children]).map(resolveClass)
    // 查询框仍在左、占位仍是第二项、官方搜索按钮（无 className ⇒ undefined）仍在最右。
    expect(order).toEqual(['own-market-query', 'own-market-rowBarSpacer', undefined])
    // ★ 这一行**没有** `.own-market-filterWrap`：所以窄屏那条 `display:none`（隐藏占位）
    //   只命中列表工具行；在线搜索行的占位在窄屏仍按基规则吃空白 ⇒ 那一面行为不变。
    expect(order).not.toContain('own-market-filterWrap')
  })
})

describe('enterprise skill detail page', () => {
  /** 详情用例的目录行：带分类、且能判「有更新」（两枚动作因此都出得来）。 */
  const row = () => enterpriseMarketSkillRows([SKILL_WITH_CATEGORY], [SKILL_DETAIL])[0]!
  /** 已装旧版本 → `UPDATE_AVAILABLE`（`[有更新]` 出现），是详情动作区最全的一态。 */
  const outdated = () => installedSkill('1902500000000000100')

  /** 已装技能目录名（Host 已装记录里的 `names[0]`，默认预览路径由它与 `SKILL.md` 拼）。 */
  const SKILL_NAME = 'meeting-notes'
  /** Host 真树 fixture：**扁平**条目（目录 sizeBytes 恒 0），层级由路径给出。 */
  const FILES: readonly EnterpriseSkillFileEntry[] = [
    { path: SKILL_NAME, kind: 'directory', sizeBytes: 0 },
    { path: `${SKILL_NAME}/SKILL.md`, kind: 'file', sizeBytes: 2048 },
    { path: `${SKILL_NAME}/references`, kind: 'directory', sizeBytes: 0 },
    { path: `${SKILL_NAME}/references/checklist.md`, kind: 'file', sizeBytes: 512 },
  ]
  /** 默认预览那份文件（Host 回传的四键投影：包 id / 相对路径 / 字节数 / 纯文本）。 */
  const CONTENT = { packageId: SKILL.id, path: `${SKILL_NAME}/SKILL.md`, sizeBytes: 2048, text: '# 会议纪要\n- 正文' }

  /** 详情子页面的一组输入（默认 = 已装 + 树已取到 + 默认选中 SKILL.md + 正文已取到）。 */
  function pageInput(over: Record<string, unknown> = {}): Parameters<typeof EnterpriseSkillDetailPage>[0] {
    const skill = row()
    const shellProps: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [skill],
      installedSkills: [outdated()],
      onToggleSkill: vi.fn(),
    }
    return {
      row: skill,
      facts: enterpriseMarketSkillRowFacts(shellProps, skill),
      installed: outdated(),
      fileEntries: FILES,
      filesLoading: false,
      selectedPath: `${SKILL_NAME}/SKILL.md`,
      file: CONTENT,
      fileLoading: false,
      onSelectFile: vi.fn(),
      onBack: vi.fn(),
      ...over,
    }
  }

  /**
   * 详情子页面**经外壳**渲染（`<style>` 由外壳挂载：`EnterpriseSkillDetailPage` 自己是纯函数、不注入样式）。
   * 需要断 CSS 取值的用例走这一支；只断 DOM 的用例直接调纯函数（那也顺带证明它无 hook）。
   */
  function detailShell(input: Parameters<typeof EnterpriseSkillDetailPage>[0]): ReactNode {
    return EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [input.row],
      installedSkills: [outdated()],
      onToggleSkill: vi.fn(),
      onOpenSkillDetail: vi.fn(),
      skillPage: input,
    })
  }

  /** 某个函数组件（如官方 `Button`，本 spec 里是 `vi.fn()` mock）的 props 收集器。 */
  function collectComponentProps(node: ReactNode, component: unknown, acc: Record<string, any>[] = []): Record<string, any>[] {
    if (Array.isArray(node)) { for (const child of node) collectComponentProps(child, component, acc); return acc }
    if (!isValidElement(node)) return acc
    if (node.type === component) { acc.push(node.props as Record<string, any>); return acc }
    const props = node.props as Record<string, unknown>
    if (typeof node.type === 'function') {
      const rendered = (node.type as (p: unknown) => ReactNode)(props)
      if (rendered !== undefined && rendered !== null) return collectComponentProps(rendered as ReactNode, component, acc)
    }
    for (const value of Object.values(props)) {
      if (value !== null && typeof value === 'object') collectComponentProps(value as ReactNode, component, acc)
    }
    return acc
  }

  it('switches the whole panel to the detail from the row body, and never from the row actions', () => {
    for (const { label, shell } of MARKET_SHELLS) {
      const skill = row()
      const onOpenSkillDetail = vi.fn()
      const onToggleSkill = vi.fn()
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills: [skill],
        installedSkills: [outdated()],
        onToggleSkill,
        onOpenSkillDetail,
      })
      // ① 行本体 = 真 button：`type=button`、有 data 钩子、动作语义的 `aria-label`、可点说明的 title、
      //    且**可点**（注入了详情回调 → 不 disabled）。光标与 focus 环由 CSS 给（下面单独断言规则原文）。
      const open = collectByDataProp(tree, 'data-enterprise-skill-open', skill.id)[0] as { props?: Record<string, any> } | undefined
      expect(open, label).toBeDefined()
      expect(open?.props?.['type'], label).toBe('button')
      expect(open?.props?.['aria-label'], label).toBe(`查看企业技能 ${skill.displayName} 详情`)
      expect(open?.props?.['disabled'], label).toBe(false)
      expect(open?.props?.['title'], label).toBe('查看详情')
      // 点行本体 → 交回**那一行**（同一份目录投影，不是副本）。
      expect(onOpenSkillDetail, label).not.toHaveBeenCalled()
      open?.props?.['onClick']?.()
      expect(onOpenSkillDetail, label).toHaveBeenCalledTimes(1)
      expect(onOpenSkillDetail, label).toHaveBeenCalledWith(skill)

      // ② 点「⋯」里的两项 **不**打开详情，动作照常触发（两项都是行本体的同级兄弟）。
      onOpenSkillDetail.mockClear()
      const update = menuAction(tree, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL)!
      update['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(skill, true)
      const uninstall = menuAction(tree, ENTERPRISE_MARKET_UNINSTALL_TEXT)!
      uninstall['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(skill, false)
      expect(onOpenSkillDetail, label).not.toHaveBeenCalled()

      // ②b 结构性保证（不靠 stopPropagation）：两个动作是行本体那枚按钮的**同级兄弟**，不在它内部；
      //     行线/li 自身也没有 onClick。
      const buttonChildren = flattenElements(open?.props?.['children'] as ReactNode)
      expect(buttonChildren.some(child => isValidElement(child) && (child.props as Record<string, unknown>)['className'] === 'own-market-moreItem'), label).toBe(false)
      const rowNode = collectByDataProp(tree, 'data-enterprise-skill-package', skill.id)[0] as { props?: Record<string, any> } | undefined
      expect(rowNode?.props?.['onClick'], label).toBeUndefined()
      const line = collectByClassName(rowNode?.props?.['children'] as ReactNode, 'own-market-rowLine')[0]
      expect(line?.['onClick'], label).toBeUndefined()
      // 行线上的同级子元素顺序：行本体 → 「⋯」动作区（动作没被搬走、也没被藏起来）。
      const lineKids = rowLineChildren(tree, skill.id)
      expect(lineKids, label).toHaveLength(2)
      expect(String((lineKids[0] as { props?: Record<string, unknown> }).props?.['className']), label).toBe('own-market-rowOpen')
      expect(String((lineKids[1] as { props?: Record<string, unknown> }).props?.['className']), label).toBe('own-market-moreInline')

      // 点击提示的取值锁：光标 + hover 高亮 + focus 环（照本文件既有官方口径，不新造视觉）。
      const css = collectStyleText(tree)
      expect(cssRuleBody(css, '.own-market-rowOpen'), label).toContain('cursor:pointer')
      expect(cssRuleBody(css, '.own-market-rowOpen'), label).toContain('display:flex')
      expect(cssRuleBody(css, '.own-market-rowOpen'), label).toContain('flex:1')
      expect(cssRuleBody(css, '.own-market-rowOpen:focus-visible'), label).toContain('outline:')
      // 回调缺席时是 disabled：光标必须收回（否则「看着能点、点了没反应」）。
      expect(cssRuleBody(css, '.own-market-rowOpen:disabled'), label).toContain('cursor:default')
      // **反锁（用户口径：卡片 hover 只变背景、文字不变）**：把标题/描述染成主色的那条规则
      // 必须**不存在**——谁加回来这里先红。hover 的可见反馈只剩 `.own-market-row:hover` 的灰底。
      expect(css, label).not.toContain('.own-market-rowOpen:hover .own-market-cardId')
      expect(css, label).not.toContain('.own-market-rowOpen:hover .own-market-cardDesc')
    }
    // 回调缺席（纯函数直调 / 旧输入）时那枚按钮 disabled + 说明性 title——**不给死按钮**，也不另外分叉一套行结构。
    const bare = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, enterpriseSkills: [row()] })
    const bareOpen = collectByDataProp(bare, 'data-enterprise-skill-open', SKILL.id)[0] as { props?: Record<string, any> } | undefined
    expect(bareOpen?.props?.['disabled']).toBe(true)
    expect(bareOpen?.props?.['title']).toBe('详情入口未接通')
    // （`collectByDataProp` 对真函数组件会既走产出又扫 props，故这里按「至少一枚」取证，枚数不是语义。）
    expect(collectByDataProp(bare, 'data-enterprise-skill-open', SKILL.id).length).toBeGreaterThanOrEqual(1)
  })

  it('renders the detail as a full-page view instead of the list, with the crumb as the only way back', () => {
    const skill = row()
    const skillPage = pageInput()
    const base: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [skill],
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      installedSkills: [outdated()],
      onToggleSkill: vi.fn(),
      onOpenSkillDetail: vi.fn(),
    }
    // ① 列表视图：页签条 + 四个面板 + 行列表；**没有**详情。
    const list = EnterpriseMarketLegacyShell(base)
    expect(collectByRole(list, 'tablist')).toHaveLength(1)
    expect(collectByRole(list, 'tabpanel')).toHaveLength(4)
    expect(collectByClassName(list, 'own-market-rows')).not.toEqual([])
    expect(isValidElement(list) ? (list.props as Record<string, unknown>)['data-enterprise-skill-detail'] : undefined).toBeUndefined()
    expect(textOf(list)).not.toContain(ENTERPRISE_SKILL_DETAIL_FILES_TITLE)
    // 详情的那份 CSS **不随列表视图挂载**（切进去才带 `detailStyles`）。
    expect(collectStyleText(list)).not.toContain('.own-market-crumb')

    // ② 详情视图（`skillPage` 非空）：整页切换——页签条/面板/行列表**整段不挂载**。
    const detail = EnterpriseMarketLegacyShell({ ...base, skillPage })
    expect(collectByRole(detail, 'tablist')).toEqual([])
    expect(collectByRole(detail, 'tabpanel')).toEqual([])
    expect(collectByClassName(detail, 'own-market-rows')).toEqual([])
    expect(collectByClassName(detail, 'own-market-detail')).toHaveLength(1)
    const detailNode = collectByClassName(detail, 'own-market-detail')[0]
    expect(detailNode?.['data-enterprise-skill-detail']).toBe(skill.id)
    expect(collectStyleText(detail)).toContain('.own-market-crumb')
    // 详情里**没有**行本体那枚按钮（列表整段没挂载），也没有第二份行结构。
    expect(collectByDataProp(detail, 'data-enterprise-skill-open', skill.id)).toEqual([])

    // ③ 面包屑：可见文案「技能列表」+ `aria-label`「返回技能列表」+ 点击即 `onBack`（唯一返回入口）。
    const crumb = collectByClassName(detail, 'own-market-crumb')[0]
    expect(crumb?.['type']).toBe('button')
    expect(crumb?.['aria-label']).toBe(ENTERPRISE_SKILL_DETAIL_BACK_LABEL)
    expect(crumb?.['title']).toBe(ENTERPRISE_SKILL_DETAIL_BACK_LABEL)
    expect(textOf(crumb?.['children'] as ReactNode)).toContain(ENTERPRISE_SKILL_DETAIL_BACK_TEXT)
    const onBack = vi.fn()
    const clickable = EnterpriseMarketLegacyShell({ ...base, skillPage: pageInput({ onBack }) })
    collectByClassName(clickable, 'own-market-crumb')[0]?.['onClick']?.()
    expect(onBack).toHaveBeenCalledTimes(1)
    // 面包屑图标照官方：`chevron-down` 旋转 90° 当「返回」箭头（列表视图那份 `<style>` 里没有这条规则）。
    expect(cssRuleBody(collectStyleText(detail), '.own-market-crumbIcon')).toContain('transform:rotate(90deg)')
  })

  it('removed the modal for good: no Modal primitive, no dialog role, no second detail container', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 源码级反向锁：弹层那套标识符与官方 `Modal` 一律不再出现。
    expect(source).not.toContain('Modal')
    expect(source).not.toContain('EnterpriseSkillDetailDialog')
    expect(source).not.toContain('EnterpriseSkillDetailView')
    // 承载形式只剩「视图状态 + 两个 return 分支」：详情由外壳的第二个分支渲染。
    expect(source).toContain('if (props.skillPage !== undefined)')
    expect(source).toContain('<EnterpriseSkillDetailPage {...props.skillPage} />')
    // DOM 级反向锁：详情树里没有任何 `role="dialog"`（官方 Modal 会给），也没有第二个详情容器。
    const skill = row()
    const base: ShellProps = { view: 'page', sessionUsable: true, enterpriseSkills: [skill], onOpenSkillDetail: vi.fn() }
    const detail = EnterpriseMarketLegacyShell({ ...base, skillPage: pageInput() })
    expect(collectByRole(detail, 'dialog')).toEqual([])
    expect(collectByClassName(detail, 'own-market-detail')).toHaveLength(1)
    // 视图状态只有一份：详情目标只记**技能包 id**，行对象在渲染时从当前目录投影里取
    // （目录刷新后详情不会停在旧副本上；条目消失时 `skillPage` 自己就是 undefined，界面回到列表）。
    // **本刀（插件详情子页面 / 系统搜索）**：开的这一刻顺带清掉另几个目标（四个目标天然互斥，见下一条）。
    // 这里用正则而不是逐字串：处理体已经因为多清一个目标而换行，断言要锁的是**那几步调用及其顺序**，
    // 不是缩进（锁缩进只会让下一个人改一次格式就红，却不改变任何语义）。
    expect(source).toMatch(/onOpenSkillDetail: \(row\) => \{[\s\S]{0,400}?setSkillDetailId\(row\.id\)[\s\S]{0,200}?setPresetDetailId\(undefined\)[\s\S]{0,200}?setPluginDetailName\(undefined\)[\s\S]{0,200}?setSystemSearchOpen\(false\)/)
    // 配方详情目标与技能详情目标**互斥**（同一时刻只可能有一个非空，故外壳那几支 return 不可能同时命中），
    // 插件详情目标与系统搜索结果面同样在这一条互斥口径里。
    expect(source).toMatch(/onOpenPresetDetail: \(row\) => \{[\s\S]{0,400}?setPresetDetailId\(row\.id\)[\s\S]{0,200}?setSkillDetailId\(undefined\)[\s\S]{0,200}?setPluginDetailName\(undefined\)[\s\S]{0,200}?setSystemSearchOpen\(false\)/)
    expect(source).toMatch(/onOpenPluginDetail: \(row\) => \{[\s\S]{0,400}?setPluginDetailName\(row\.packageName\)[\s\S]{0,200}?setSkillDetailId\(undefined\)[\s\S]{0,200}?setPresetDetailId\(undefined\)[\s\S]{0,200}?setSystemSearchOpen\(false\)/)
    // 反过来：进系统搜索结果面也要清掉那三个详情目标（互斥是双向的，不是「单向记得清」）。
    expect(source).toMatch(/onOpenSystemSearch[\s\S]{0,600}setSkillDetailId\(undefined\)[\s\S]{0,200}setPresetDetailId\(undefined\)[\s\S]{0,200}setPluginDetailName\(undefined\)/)
    expect(source).toContain('enterpriseSkills.find(item => item.id === skillDetailId)')
    expect(source).toContain('const skillPage: EnterpriseSkillPageProps | undefined = skillPageRow === undefined ? undefined :')
  })

  it('follows the official plugin detail page: crumb, h3 title + version badge, mono id line, description, sections', () => {
    const input = pageInput()
    // DOM 走纯函数直调（证明它无 hook），CSS 取值走外壳（`detailStyles` 由外壳那份 `<style>` 挂载）。
    const tree = EnterpriseSkillDetailPage(input)
    const styled = detailShell(input)
    // ① 面包屑（官方 `DetailTop`）：可见文案 + 完整动作语义的 `aria-label` + 旋转过的 chevron。
    const crumb = collectByClassName(tree, 'own-market-crumb')[0]
    expect(crumb?.['aria-label']).toBe(ENTERPRISE_SKILL_DETAIL_BACK_LABEL)
    expect(textOf(crumb?.['children'] as ReactNode)).toContain(ENTERPRISE_SKILL_DETAIL_BACK_TEXT)
    expect(collectByClassName(tree, 'own-market-crumbIcon')).toHaveLength(1)
    // 头部：**只有动作区**（官方 `_detailHead` = actions，两端对齐）。左上角那枚 48×48 图标
    // 按用户口径**已从 JSX 撤掉**（它本来就是本文件自己画的 `.own-market-detailIcon`），
    // 故这里是**反向锁**：树上不得再出现这枚图标、那条类名也不得复活。
    expect(collectByClassName(tree, 'own-market-detailTop')).toHaveLength(1)
    expect(collectByClassName(tree, 'own-market-detailHead')).toHaveLength(1)
    expect(collectByClassName(tree, 'own-market-detailIcon')).toEqual([])
    expect(collectByClassName(tree, 'own-market-detailActions')).toHaveLength(1)
    // ② `h3` 标题 + 版本徽标（官方 titleRow：h3 + badge 槽）。
    const title = collectByTagName(tree, 'h3')[0]
    expect(title?.['className']).toBe('own-market-detailTitle')
    expect(title?.['children']).toBe(input.row.displayName)
    const badge = collectByClassName(tree, 'own-market-titleRow')[0]
    const badgeKids = (badge?.['children'] as ReactNode[]).filter(child => child !== null && child !== undefined)
    expect(badgeKids).toHaveLength(2)
    // **术语降维**：完整坐标不再是一条裸字符串——签被「来源」标签的包装节点包成一个单元
    // （标签在前、坐标签在后；`title` 说明它由「来源站 / 发布方 @ 版本号」构成）。
    const source = ((badgeKids[1] as { props?: Record<string, any> }).props ?? {})
    expect(source['className']).toBe('own-market-detailSource')
    expect(source['title']).toBe(ENTERPRISE_SKILL_DETAIL_SOURCE_TITLE)
    const sourceKids = source['children'] as ReactNode[]
    expect(((sourceKids[0] as { props?: Record<string, any> }).props ?? {})['children']).toBe(ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL)
    expect(((sourceKids[1] as { props?: Record<string, any> }).props ?? {})['children']).toBe(input.facts.versionTag)
    // 版本徽标只在 titleRow 那一处；详情头部的动作区与行上**同一枚子块**（本刀：更新那一项照旧恰好在场）。
    expect(menuAction(tree, ENTERPRISE_MARKET_SKILL_UPDATE_LABEL)).toBeDefined()
    // ③ 等宽标识行 = `skillId`（官方 `_detailName`：tertiary 12/18 + `<code>` mono）；
    //    **术语降维**：前面补一个人话标签「标识」并带悬浮说明（位置与取值都不变，只是不再是一串裸等宽字符）。
    const nameRow = collectByClassName(tree, 'own-market-detailName')[0]
    const nameKids = nameRow?.['children'] as ReactNode[]
    const nameLabel = (nameKids[0] as { props?: Record<string, any> }).props ?? {}
    expect(nameLabel['className']).toBe('own-market-detailNameLabel')
    expect(nameLabel['children']).toBe(ENTERPRISE_SKILL_DETAIL_NAME_LABEL)
    expect(nameLabel['title']).toBe(ENTERPRISE_SKILL_DETAIL_NAME_TITLE)
    expect(nameKids[1]).toMatchObject({ type: 'code', props: { children: input.row.skillId } })
    // ④ 描述（官方 `_detailDesc`）。
    expect(collectByClassName(tree, 'own-market-detailDesc').map(props => props['children'])).toEqual([input.row.description])
    // ⑤ 分区（官方 `_detailSections` → `_detailSection`）：文件区那一节 + 节头（标题 + 计数）。
    expect(collectByClassName(tree, 'own-market-detailSections')).toHaveLength(1)
    expect(collectByClassName(tree, 'own-market-detailSection')).toHaveLength(1)
    const section = collectByClassName(tree, 'own-market-detailSection')[0]
    expect(section?.['aria-label']).toBe(ENTERPRISE_SKILL_DETAIL_FILES_TITLE)
    expect(section?.['data-enterprise-skill-files']).toBe(input.row.id)
    expect(collectByTagName(tree, 'h4').map(props => props['children'])).toEqual([ENTERPRISE_SKILL_DETAIL_FILES_TITLE])
    expect(textOf(tree)).toContain(enterpriseSkillFileCountText(FILES))
    // ⑥ 取值逐条照官方 CSS module（_detailTop / _crumb / _detailHead / _detailMain / _detailTitle /
    //    _detailName / _detailDesc / _detailSections / _detailSection），本文件只是把那几条抄进 `detailStyles`。
    const css = collectStyleText(styled)
    expect(cssRuleBody(css, '.own-market-detailTop')).toContain('padding-top:28px')
    expect(cssRuleBody(css, '.own-market-crumb')).toContain('font-size:12.5px')
    expect(cssRuleBody(css, '.own-market-crumb')).toContain('gap:6px')
    expect(cssRuleBody(css, '.own-market-crumb:focus-visible')).toContain('outline:')
    expect(cssRuleBody(css, '.own-market-crumbIcon')).toBe('transform:rotate(90deg)')
    expect(cssRuleBody(css, '.own-market-detailHead')).toContain('margin:32px 0 0')
    expect(cssRuleBody(css, '.own-market-detailHead')).toContain('justify-content:space-between')
    // **本刀（撤掉左上角那枚 48×48 图标）反向锁**：
    //  ① 本文件自绘的那枚（.own-market-detailIcon）连元素带样式一并删除，不许复活；
    //  ② 官方 DetailTop 自己那枚仍在我们页面上（我们注册成官方 plugins.item，id=plugin-market），
    //     按**稳定后缀** _cardIcon 隐藏；作用域是两道：收在 detailHead 内（不误伤 crumbIcon 的 chevron）
    //     ＋ :has(...own-market-entry...) 闸门（不误伤**其它 item 详情** —— 原先那条裸锚点会误伤）。
    //     锚点 [data-plugin-item-detail] **仍不写死值**：官方那个值是动态 item.id（对 app.asar 逐字
    //     复核过属性存在、取 item.id）；固定值形制不得回来（见下面那条 not.toContain 锁）。
    expect(cssRuleBody(css, '.own-market-detailIcon')).toBe('')
    expect(cssRuleBody(css, '[data-plugin-item-detail]:has([class*="_detailSections"] .own-market-entry) [class*="_detailHead"] [class*="_cardIcon"]')).toBe('display:none')
    // 写死属性值的形制不得回来（永不生效）；过宽的 span[aria-hidden] 也不得回来（会误伤官方 crumbIcon）。
    expect(css).not.toContain('[data-plugin-item-detail="plugin-market"]')
    expect(css).not.toContain('span[aria-hidden="true"]{display:none}')
    expect(cssRuleBody(css, '.own-market-detailMain')).toContain('margin-top:20px')
    expect(cssRuleBody(css, '.own-market-detailTitle')).toContain('font-size:20px')
    expect(cssRuleBody(css, '.own-market-detailTitle')).toContain('line-height:28px')
    expect(cssRuleBody(css, '.own-market-detailTitle')).toContain('font-weight:500')
    expect(cssRuleBody(css, '.own-market-titleRow')).toContain('flex-wrap:wrap')
    expect(cssRuleBody(css, '.own-market-detailName')).toContain('font-size:12px')
    expect(cssRuleBody(css, '.own-market-detailName')).toContain('line-height:18px')
    expect(cssRuleBody(css, '.own-market-detailName')).toContain('var(--dsw-alias-label-tertiary')
    expect(cssRuleBody(css, '.own-market-detailName code')).toContain('font-family:var(--dsw-font-mono')
    expect(cssRuleBody(css, '.own-market-detailDesc')).toContain('font-size:14px')
    expect(cssRuleBody(css, '.own-market-detailDesc')).toContain('line-height:22px')
    expect(cssRuleBody(css, '.own-market-detailSections')).toContain('margin-top:32px')
    expect(cssRuleBody(css, '.own-market-detailSections')).toContain('gap:32px')
    expect(cssRuleBody(css, '.own-market-detailSection')).toContain('gap:12px')
  })

  it('projects the flat host entries into a hierarchical tree and shows files and directories differently', () => {
    // ① 纯投影：先序确定性排序 + depth/parent/name（层级感全部由路径给出，界面不猜）。
    const rows = enterpriseSkillTreeRows(FILES)
    expect(rows.map(item => item.path)).toEqual([
      SKILL_NAME, `${SKILL_NAME}/SKILL.md`, `${SKILL_NAME}/references`, `${SKILL_NAME}/references/checklist.md`,
    ])
    expect(rows.map(item => item.name)).toEqual(['meeting-notes', 'SKILL.md', 'references', 'checklist.md'])
    expect(rows.map(item => item.depth)).toEqual([0, 1, 1, 2])
    expect(rows.map(item => item.parent)).toEqual(['', SKILL_NAME, SKILL_NAME, `${SKILL_NAME}/references`])
    expect(rows.map(item => item.kind)).toEqual(['directory', 'file', 'directory', 'file'])
    // 乱序输入也得到同一棵先序树（确定性）。
    expect(enterpriseSkillTreeRows([...FILES].reverse()).map(item => item.path)).toEqual(rows.map(item => item.path))
    // 目录是结构、不是内容：计数只数文件。
    expect(enterpriseSkillFileCountText(FILES)).toBe('共 2 个文件')
    expect(enterpriseSkillFileCountText([])).toBe('共 0 个文件')
    // ② 实渲染：目录行**不是按钮**（点它不取任何东西），文件行是按钮且带动作语义的 `aria-label`。
    const tree = EnterpriseSkillDetailPage(pageInput())
    const rowsInTree = collectByClassName(tree, 'own-market-fileRow')
    expect(rowsInTree).toHaveLength(4)
    expect(rowsInTree.map(props => props['data-enterprise-file-kind'])).toEqual(['directory', 'file', 'directory', 'file'])
    expect(rowsInTree.map(props => props['data-enterprise-file-path'])).toEqual(rows.map(item => item.path))
    const dirNodes = rowsInTree.filter(props => props['data-enterprise-file-kind'] === 'directory')
    for (const dir of dirNodes) {
      expect(collectByClassName(dir['children'] as ReactNode, 'own-market-fileOpen')).toEqual([])
      expect(collectByClassName(dir['children'] as ReactNode, 'own-market-fileDir')).toHaveLength(1)
    }
    const fileButtons = collectByClassName(tree, 'own-market-fileOpen')
    expect(fileButtons.map(props => props['data-enterprise-file-open'])).toEqual([
      `${SKILL_NAME}/SKILL.md`, `${SKILL_NAME}/references/checklist.md`,
    ])
    for (const button of fileButtons) {
      expect(button['type']).toBe('button')
      expect(button['aria-label']).toBe(`预览 ${String(button['data-enterprise-file-open'])}`)
    }
    // ③ 层级感：每行按 depth 缩进（0 / 14 / 14 / 28 px），目录与文件在不同类名下因此视觉可区分。
    expect(rowsInTree.map(props => (props['style'] as { paddingLeft: string }).paddingLeft))
      .toEqual(['0px', '14px', '14px', '28px'])
    // ④ 左树右预览是同一格里的两列（容器查询在窄屏回落成上下两段）。
    const styled = collectStyleText(detailShell(pageInput()))
    expect(cssRuleBody(styled, '.own-market-fileSplit')).toContain('grid-template-columns:minmax(160px,240px)')
    expect(styled).toContain('@container (max-width: 520px)')
    expect(cssRuleBody(styled, '.own-market-fileOpen')).toContain('width:100%')
    expect(cssRuleBody(styled, '.own-market-fileDir')).toContain('color:var(--dsw-alias-label-tertiary')
  })

  it('selects and previews SKILL.md by default, and switches the preview from the tree', () => {
    // ① 默认路径只在**树里真有那条文件条目**时才选它；缺席时退到树里第一个文件；没有文件就什么都不选。
    expect(enterpriseSkillDefaultFilePath(SKILL_NAME, FILES)).toBe(`${SKILL_NAME}/SKILL.md`)
    expect(enterpriseSkillDefaultFilePath('other-skill', FILES)).toBe(`${SKILL_NAME}/SKILL.md`)
    expect(enterpriseSkillDefaultFilePath(SKILL_NAME, FILES.filter(entry => entry.kind === 'directory')))
      .toBeUndefined()
    // 目录条目不算「文件」：同名路径但 kind=directory 时不选它。
    expect(enterpriseSkillDefaultFilePath(SKILL_NAME, [{ path: `${SKILL_NAME}/SKILL.md`, kind: 'directory', sizeBytes: 0 }]))
      .toBeUndefined()
    expect(ENTERPRISE_SKILL_CONTENT_FILENAME).toBe('SKILL.md')

    // ② 实渲染：恰好一条 `selected=false→true` 的选中态落在默认那条上，预览正文就是它的内容。
    const tree = EnterpriseSkillDetailPage(pageInput())
    const buttons = collectByClassName(tree, 'own-market-fileOpen')
    expect(buttons.map(props => props['data-enterprise-file-selected'])).toEqual(['true', 'false'])
    expect(collectByClassName(tree, 'own-market-filePreview')[0]?.['data-enterprise-file-preview'])
      .toBe(`${SKILL_NAME}/SKILL.md`)
    expect(collectByClassName(tree, 'own-market-filePreviewPath')[0]?.['children']).toBe(`${SKILL_NAME}/SKILL.md`)
    const content = collectByDataProp(tree, 'data-enterprise-file-content', `${SKILL_NAME}/SKILL.md`)[0] as { props?: Record<string, unknown> } | undefined
    expect(content?.props?.['children']).toBe(CONTENT.text)
    // 体积提示取共享 `formatByteSize`（不是自己算的另一种口径）。
    expect(collectByClassName(tree, 'own-market-filePreviewMeta')[0]?.['children']).toBe('2.0 KiB')
    expect(collectByClassName(tree, 'own-market-fileSize').map(props => props['children'])).toEqual(['2.0 KiB', '512 B'])

    // ③ 点树里另一个文件 → 只交回那条**来自 Host 树**的路径（界面不拼路径、不接受用户输入）。
    const onSelectFile = vi.fn()
    const clickable = EnterpriseSkillDetailPage(pageInput({ onSelectFile }))
    const second = collectByClassName(clickable, 'own-market-fileOpen')[1]!
    second['onClick']?.()
    expect(onSelectFile).toHaveBeenCalledTimes(1)
    expect(onSelectFile).toHaveBeenCalledWith(`${SKILL_NAME}/references/checklist.md`)
    // 切换后的渲染：选中态与预览都跟着 `selectedPath` 走（同一份视图状态，不是第二份状态）。
    const switched = EnterpriseSkillDetailPage(pageInput({
      selectedPath: `${SKILL_NAME}/references/checklist.md`,
      file: { packageId: SKILL.id, path: `${SKILL_NAME}/references/checklist.md`, sizeBytes: 512, text: '- 检查单' },
    }))
    expect(collectByClassName(switched, 'own-market-fileOpen').map(props => props['data-enterprise-file-selected']))
      .toEqual(['false', 'true'])
    expect(collectByDataProp(switched, 'data-enterprise-file-content', `${SKILL_NAME}/references/checklist.md`)[0])
      .toBeDefined()
    // 空文件如实说「（文件为空）」，不假装有内容。
    const empty = EnterpriseSkillDetailPage(pageInput({
      selectedPath: `${SKILL_NAME}/references/checklist.md`,
      file: { packageId: SKILL.id, path: `${SKILL_NAME}/references/checklist.md`, sizeBytes: 0, text: '' },
    }))
    expect(textOf(empty)).toContain(ENTERPRISE_SKILL_PREVIEW_EMPTY)
  })

  it('shows the install hint and sends no request at all when the skill is not installed', async () => {
    // ① 纯投影：未装优先于任何 loading / 失败 / 已取到的数据（未装的包根本不该发文件请求）。
    expect(enterpriseSkillTreeState({ installed: false, loading: true }))
      .toEqual({ kind: 'not-installed', hint: ENTERPRISE_SKILL_TREE_NOT_INSTALLED })
    expect(enterpriseSkillTreeState({ installed: false, loading: false, errorCode: 'ENT_RESOURCE_NOT_FOUND', entries: FILES }).kind)
      .toBe('not-installed')
    expect(enterpriseSkillTreeState({ installed: false, loading: false, entries: FILES }).kind).toBe('not-installed')
    expect(enterpriseSkillPreviewState({ installed: false, loading: false, file: CONTENT }).kind).toBe('not-installed')
    expect(enterpriseSkillPreviewState({ installed: false, loading: true, errorCode: 'ENT_SKILL_CONTENT_INVALID' }).kind)
      .toBe('not-installed')

    // ② 实渲染：只说提示，没有文件按钮、没有树、没有正文块——**不伪造树**。
    const tree = EnterpriseSkillDetailPage(pageInput({
      installed: undefined, fileEntries: [], filesLoading: false, selectedPath: undefined, file: undefined,
    }))
    expect(textOf(tree)).toContain('安装后可浏览文件')
    expect(textOf(tree)).toContain(ENTERPRISE_SKILL_TREE_NOT_INSTALLED)
    expect(collectByClassName(tree, 'own-market-fileOpen')).toEqual([])
    expect(collectByClassName(tree, 'own-market-fileRows')).toEqual([])
    expect(collectByDataProp(tree, 'data-enterprise-file-content', `${SKILL_NAME}/SKILL.md`)).toEqual([])
    expect(collectByClassName(tree, 'own-market-filePreviewPath')[0]?.['children']).toBe('')
    expect(collectByClassName(tree, 'own-market-sectionCount')).toEqual([])

    // ③ 源码级：两个取数 effect 各自的第一道守卫就是「未装 / 无 store / 无包 id（或没选中条目）即返回」，
    //    且 `api.skillFiles(` 只有一处、位于守卫之后——未装时**一条请求都发不出去**。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    const guardIndex = source.indexOf('if (api === undefined || detailPackageId === undefined || detailSkillName === undefined)')
    const fetchIndex = source.indexOf('api.skillFiles(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(fetchIndex).toBeGreaterThan(guardIndex)
    expect((source.match(/api\.skillFiles\(/g) ?? []).length).toBe(1)
    expect((source.match(/api\.skillFile\(/g) ?? []).length).toBe(1)
    expect(source).toContain('if (api === undefined || detailPackageId === undefined || selectedEntry === undefined)')
  })

  it('reports read failures with the stable code and a retry, and renders the preview as plain text', async () => {
    // ① 纯投影：失败优先于「读取中」（否则一次失败会被下一轮 loading 盖成「正在读取」而看不到错误码）。
    expect(enterpriseSkillTreeState({ installed: true, loading: false, entries: FILES }).kind).toBe('available')
    expect(enterpriseSkillTreeState({ installed: true, loading: false, entries: [] }))
      .toEqual({ kind: 'empty', hint: ENTERPRISE_SKILL_TREE_EMPTY })
    expect(enterpriseSkillTreeState({ installed: true, loading: true }).kind).toBe('loading')
    expect(enterpriseSkillTreeState({ installed: true, loading: true, errorCode: 'ENT_SKILL_CONTENT_TOO_LARGE' }))
      .toEqual({ kind: 'failed', code: 'ENT_SKILL_CONTENT_TOO_LARGE', hint: ENTERPRISE_SKILL_TREE_FAILED })
    expect(enterpriseSkillTreeState({ installed: true, loading: false }).kind).toBe('loading')
    expect(enterpriseSkillPreviewState({ installed: true, loading: false }).kind).toBe('none')
    expect(enterpriseSkillPreviewState({ installed: true, loading: true }).kind).toBe('loading')
    expect(enterpriseSkillPreviewState({ installed: true, loading: true, errorCode: 'ENT_SKILL_CONTENT_INVALID' }))
      .toEqual({ kind: 'failed', code: 'ENT_SKILL_CONTENT_INVALID', hint: ENTERPRISE_SKILL_PREVIEW_FAILED })
    expect(enterpriseSkillPreviewState({ installed: true, loading: false, file: CONTENT }))
      .toEqual({ kind: 'available', path: CONTENT.path, sizeBytes: CONTENT.sizeBytes, text: CONTENT.text })

    // ② 树读取失败：可见反馈（role="alert" + 稳定错误码）+ 重试按钮（点了再取一次，不是死路）。
    const onReloadFiles = vi.fn()
    const treeFailed = EnterpriseSkillDetailPage(pageInput({
      fileEntries: [], filesLoading: false, filesErrorCode: 'ENT_SKILL_CONTENT_TOO_LARGE',
      selectedPath: undefined, file: undefined, onReloadFiles, onReloadFile: vi.fn(),
    }))
    const treeAlerts = collectAlerts(treeFailed)
    expect(treeAlerts).toHaveLength(1)
    expect(textOf(treeAlerts[0])).toContain(ENTERPRISE_SKILL_TREE_FAILED)
    expect(textOf(treeAlerts[0])).toContain('ENT_SKILL_CONTENT_TOO_LARGE')
    expect(collectByClassName(treeFailed, 'own-market-fileOpen')).toEqual([])
    const retries = collectComponentProps(treeFailed, Button).filter(props => props['children'] === ENTERPRISE_SKILL_DETAIL_RETRY)
    expect(retries).toHaveLength(1)
    retries[0]?.['onClick']?.()
    expect(onReloadFiles).toHaveBeenCalledTimes(1)
    // 读取中态只说提示、不出 alert（不闪错误）。
    const loading = EnterpriseSkillDetailPage(pageInput({ fileEntries: [], filesLoading: true, selectedPath: undefined, file: undefined }))
    expect(textOf(loading)).toContain(ENTERPRISE_SKILL_TREE_LOADING)
    expect(collectAlerts(loading)).toEqual([])

    // ③ 文件读取失败：同一套反馈（错误码 + 重试），失败态**不出正文块**。
    const onReloadFile = vi.fn()
    const fileFailed = EnterpriseSkillDetailPage(pageInput({ file: undefined, fileLoading: false, fileErrorCode: 'ENT_SKILL_CONTENT_INVALID', onReloadFile }))
    const fileAlerts = collectAlerts(fileFailed)
    expect(fileAlerts).toHaveLength(1)
    expect(textOf(fileAlerts[0])).toContain(ENTERPRISE_SKILL_PREVIEW_FAILED)
    expect(textOf(fileAlerts[0])).toContain('ENT_SKILL_CONTENT_INVALID')
    expect(collectByDataProp(fileFailed, 'data-enterprise-file-content', `${SKILL_NAME}/SKILL.md`)).toEqual([])
    const fileRetry = collectComponentProps(fileFailed, Button).filter(props => props['children'] === ENTERPRISE_SKILL_DETAIL_RETRY)
    expect(fileRetry).toHaveLength(1)
    fileRetry[0]?.['onClick']?.()
    expect(onReloadFile).toHaveBeenCalledTimes(1)
    // 成功路径不出任何 alert。
    expect(collectAlerts(EnterpriseSkillDetailPage(pageInput()))).toEqual([])

    // ④ **纯文本安全渲染**：正文是 `<pre>` 的文本子节点，全文件没有 `dangerouslySetInnerHTML` / `innerHTML`，
    //    也不解析 Markdown（原样把字符串交给 React 转义）。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(source).not.toContain('dangerouslySetInnerHTML')
    expect(source).not.toContain('innerHTML')
    expect(source).not.toContain('marked(')
    const escaping = EnterpriseSkillDetailPage(pageInput({
      file: { packageId: SKILL.id, path: CONTENT.path, sizeBytes: 12, text: '<img src=x onerror=alert(1)>' },
    }))
    const node = collectByDataProp(escaping, 'data-enterprise-file-content', CONTENT.path)[0] as { props?: Record<string, unknown> } | undefined
    // 字符串子节点（不是元素树）：React 会把 `<` 转义成文本，注入点为零。
    expect(typeof node?.props?.['children']).toBe('string')
    expect(node?.props?.['children']).toBe('<img src=x onerror=alert(1)>')
    expect((node as { type?: unknown } | undefined)?.type).toBe('pre')
    // 长文件靠 `max-height` 滚动看全（不做截断）。
    const styled = collectStyleText(detailShell(pageInput()))
    expect(cssRuleBody(styled, '.own-market-fileText')).toContain('max-height:360px')
    expect(cssRuleBody(styled, '.own-market-fileText')).toContain('overflow:auto')
    expect(cssRuleBody(styled, '.own-market-fileText')).toContain('white-space:pre-wrap')
  })

  it('shares one and the same action block, facts and callback with the row', () => {
    const skill = row()
    const shellProps: ShellProps = {
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [skill],
      installedSkills: [outdated()],
      onToggleSkill: vi.fn(),
      skillActionError: { id: skill.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      onOpenSkillDetail: vi.fn(),
    }
    const facts = enterpriseMarketSkillRowFacts(shellProps, skill)
    const rowTree = EnterpriseMarketLegacyShell(shellProps)
    const detailTree = EnterpriseMarketLegacyShell({ ...shellProps, skillPage: pageInput({
      facts,
      actionError: { id: skill.id, action: 'install', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
      onToggleSkill: shellProps.onToggleSkill,
    }) })
    // ① 详情里的动作与行上是**同一枚子块**：逐项同值（同一份 facts、同一个回调）。
    for (const item of [ENTERPRISE_MARKET_SKILL_UPDATE_LABEL, ENTERPRISE_MARKET_UNINSTALL_TEXT]) {
      const rowItem = menuAction(rowTree, item)!
      const detailItem = menuAction(detailTree, item)!
      expect(detailItem['children']).toBe(rowItem['children'])
      expect(detailItem['title']).toBe(rowItem['title'])
      expect(detailItem['disabled']).toBe(rowItem['disabled'])
    }
    // 动作回调就是同一个函数（点详情里的动作 = 点行上那一项，不存在第二套动作实现）。
    menuAction(detailTree, ENTERPRISE_MARKET_UNINSTALL_TEXT)!['onClick']?.()
    expect(shellProps.onToggleSkill).toHaveBeenCalledWith(skill, false)
    // ② 失败事实同源：详情里那条 alert 与行上那句一模一样（同一份 `skillActionError`）。
    expect(collectAlerts(detailTree).map(alert => textOf(alert)))
      .toEqual(collectAlerts(rowTree).map(alert => textOf(alert)))
    expect(textOf(collectAlerts(detailTree)[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // ③ 详情不另取一次数：一切来自行投影 + 行 facts + 已装记录（同一份 row 数据）。
    expect(textOf(detailTree)).toContain(skill.displayName)
    expect(textOf(detailTree)).toContain(skill.description)
    expect(textOf(detailTree)).toContain(skill.skillId)
    expect(textOf(detailTree)).toContain(skill.sourceDshVersion)
    // ④ 详情里的动作与行上一样是**两枚动作项**（更新 / 卸载），没有多挂、也没有少挂。
    expect(collectByClassName(detailTree, 'own-market-moreItem').map(props => props['children']))
      .toEqual([ENTERPRISE_MARKET_SKILL_UPDATE_LABEL, ENTERPRISE_MARKET_UNINSTALL_TEXT])
  })

  it('keeps the two file fetches abortable, non-silent and keyed only by the installed record', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // 唯一两处取文件：只经 `store.api`（同源固定路径），且各只有一处调用。
    expect((source.match(/api\.skillFiles\(/g) ?? []).length).toBe(1)
    expect((source.match(/api\.skillFile\(/g) ?? []).length).toBe(1)
    expect(source).toContain('api.skillFiles(detailPackageId, controller.signal)')
    expect(source).toContain('api.skillFile(detailPackageId, selectedEntry.path, controller.signal)')
    // 默认预览路径来自 Host 已装记录里的技能名（界面不拼路径、不碰 SKILL.md 文件名之外的任何路径片段）。
    expect(source).toContain('skillPageInstalled?.names[0]')
    expect(source).toContain('enterpriseSkillDefaultFilePath(detailSkillName, files.entries)')
    // 关详情 / 换包即中止在途请求，且迟到结果不回填。
    // **本刀（静默吞失败 → 显式失败态 + 可重试）**：技能目录那条取数从本文件的 effect 搬进了共享取数源
    // （`createEnterpriseSkillCatalogSource` → `list-state.ts` 的 `createEnterpriseListSource`，它自己负责
    // 「中止在途 + 丢弃迟到结果」），故本文件里的 `controller.abort()` 只剩各个取数 effect 各一处；
    // 目录取数不再在这里手写请求/兜底——下面两条同时锁住「没有人把第二套目录取数加回本文件」。
    // **本刀（配方一键启用）**：多了一处「逐行读本机真值（status）」的 effect，它也带一处关页面即中止，
    // 故计数 3 → 4（文件树 / 文件正文 / 配方详情三处 + 配方真值一处）。
    // **本刀（系统搜索）**：盘点的取数 effect 再带一处（关面即中止，迟到结果不回填）⇒ 4 → 5；
    // **本刀（在线搜索）**：搜索的取数 effect 同一条 ⇒ 5 → 6。
    expect((source.match(/controller\.abort\(\)/g) ?? []).length).toBe(6)
    expect(source).toContain('createEnterpriseSkillCatalogSource')
    expect((source.match(/api\.skills\(/g) ?? []).length).toBe(1)
    expect((source.match(/api\.installedSkills\(/g) ?? []).length).toBe(1)
    expect((source.match(/controller\.signal\.aborted/g) ?? []).length).toBeGreaterThanOrEqual(6)
    // 失败不静默：每一处 catch（技能动作 / 文件树 / 文件正文 / **配方详情** / **配方真值** /
    // **配方启用** / **配方停用** / **本地上传**）都把错误经 `enterpriseLocalErrorCode` 投影成稳定码，交给纯视图出
    // role="alert" 或行内提示；本条用例关心的两个文件取数各占一处。
    //（目录那一条改由 `enterpriseDegradedRead`（list-state.ts）投影稳定码，故本文件里原有七处；
    //  **本刀（本地导入）**：本地上传那一条通路也把失败投影成稳定码（`uploadSkill` 的 catch 一处，故 7 → 8），
    //  它落进 `EnterpriseMarketSkillImportNotice` 的失败态——人话 + 下一步 + 「技术信息」里的码，绝不静默；
    //  **本刀（系统搜索）**再加两处：盘点取数失败（落进结果面的失败态 + 真重发）与纳入失败
    //  （落进**那一行**的唯一提示组件）⇒ 8 → 10；
    //  **本刀（在线搜索）**再加两处：搜索取数失败（结果面失败态 + 真重发）与在线安装失败
    //  （落进**那一行**的唯一提示组件）⇒ 10 → 12。）
    expect((source.match(/enterpriseLocalErrorCode\(error\)/g) ?? []).length).toBe(12)
    // 界面不拼宿主路径、不读文件系统（那是 Host 的活）：两个 effect 只把**键**（包 id / 树里那条路径）交出去。
    //（`~/.dsh/skills` 那句只出现在行上那枚开关的悬浮文案里，是给用户看的落盘说明，不是我们构造的路径。）
    expect(source).not.toContain('readFileSync')
    expect(source).not.toContain('node:fs')
    //（`join(` 那种写法在本文件里只有 `Array.prototype.join` 拼展示用路径，`node:path` 一个都不引。）
    expect(source).not.toContain('node:path')
    expect(source).not.toContain('dirname(')
  })
})

/**
 * **插件详情子页面（face B，用户口径第 16 条）**。
 *
 * 承载形式：点插件行**标题**（图标 + 两行文案那一片，与同面技能/配方行**同款**的真 `<button>`）
 * 把「企业插件」页签的**内容区**换成该插件的详情子页面 —— 互斥由**复用的** `EnterprisePluginContentRegion`
 * 保证（`detail ?? list`，与「企业设置 → 插件」那一面同一枚容器、同一个 `data-enterprise-plugin-region` 判据），
 * 页头与四枚页签**保持可见、一字不改**。详情正文**原样复用** `plugin-market.tsx` 的纯组件
 * `EnterprisePluginDetailPage`（连它那份样式表一起挂上；两份表类名零交集，由隔离不变量守着）。
 *
 * 这里锁六件事：
 *  ① 入口是一枚真 `<button>`（`aria-label` 完整句式、点击键 = 包名、没有 `aria-haspopup`）；
 *  ② 互斥：详情在场时**本页签**的列表与它那四态提示一个元素都不挂载，页签条一字不动；
 *  ③ 复用而非复制：组件本体与样式表都来自 `plugin-market.tsx`，本文件一个字都不重写；
 *  ④ 返回两条真路径（左上角返回按钮 + Esc），**浏览器返回没接**（本页没有真实路由，且不许硬造）；
 *  ⑤ 动作区 = 行上**同一枚**子块（能装就装、已装就开关），本面仍然**没有卸载**；
 *  ⑥ **描述（用户口径第 19 条 → 第 20 条）**：详情的「描述」段正文由**唯一一枚**纯投影
 *     `enterpriseMarketPluginDetailBody(row.readme, row.description)` 决定 —— **有 README 就用 README**，
 *     没有才回落到行上**同一份** `row.description`；两者都没有 ⇒ 整段不出现（不画「暂无描述」空壳）。
 */
describe('enterprise plugin detail subpage (face B)', () => {
  /** 目录 + 本机记录归并后的那一行（已装、启用、目录里还有这一版）——详情用例的基准行。 */
  const row = () => enterpriseMarketPluginRows([
    {
      pluginVersionId: 'v1', packageName: 'ent-a', version: '1.2.0', displayName: '甲插件',
      description: '甲的描述。', sizeBytes: 2048, operatingSystems: ['darwin'],
    },
  ], [
    { packageName: 'ent-a', version: '1.2.0', desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null },
  ])[0]!

  /** 未安装那一行（目录里有、本机没有记录）——详情里给的就是【＋】那一格。 */
  const rowNotInstalled = () => enterpriseMarketPluginRows([
    {
      pluginVersionId: 'v1', packageName: 'ent-b', version: '2.0.0', displayName: '乙插件',
      description: '乙的描述。', sizeBytes: 4096, operatingSystems: ['darwin'],
    },
  ])[0]!

  /** 页签这一面的一整份 props（默认停在「企业插件」页签上、写入口齐全）。 */
  const shellProps = (over: Partial<ShellProps> = {}): ShellProps => ({
    view: 'page',
    activeTab: 'plugins',
    sessionUsable: true,
    enterprisePlugins: [row()],
    onInstallPlugin: vi.fn(),
    onTogglePluginEnabled: vi.fn(),
    onOpenPluginDetail: vi.fn(),
    ...over,
  })

  /** 详情子页面的一组输入（控制器是唯一构造点；这里按它的形状直造一份给纯函数直调用例）。 */
  function pageInput(over: Partial<EnterprisePluginPageProps> = {}): EnterprisePluginPageProps {
    const target = row()
    return {
      row: target,
      facts: enterpriseMarketPluginRowFacts(shellProps(), target),
      catalogVersionText: '1.2.0',
      onBack: vi.fn(),
      ...over,
    }
  }

  /** 详情态的外壳（把详情的输入塞进同一份 props 的那一个键上）。 */
  const detailShell = (page: EnterprisePluginPageProps, over: Partial<ShellProps> = {}): ReactNode =>
    EnterpriseMarketLegacyShell({ ...shellProps(over), pluginPage: page })

  it('replaces this tab\'s content area with the detail, and leaves the four tabs exactly as they were', () => {
    const list = EnterpriseMarketLegacyShell(shellProps())
    const detail = detailShell(pageInput())
    // ① 互斥：两态共用**同一个**容器判据，`list` → `detail`，不是叠一层。
    expect(collectDataValues(list, 'data-enterprise-plugin-region')).toEqual(['list'])
    expect(collectDataValues(detail, 'data-enterprise-plugin-region')).toEqual(['detail'])
    // ② 本页签的列表整段不挂载：一行都没有、四态提示也没有（`data-market-list-state` 是它的判据）。
    expect(collectByClassName(list, 'own-market-rows')).toHaveLength(1)
    expect(collectByClassName(detail, 'own-market-rows')).toHaveLength(0)
    expect(collectDataValues(detail, 'data-market-list-state')).toEqual([])
    // 行上那枚详情入口（`data-enterprise-plugin-open`）在详情里当然也不在——列表真的走了。
    expect(collectDataValues(list, 'data-enterprise-plugin-open')).toEqual(['ent-a'])
    expect(collectDataValues(detail, 'data-enterprise-plugin-open')).toEqual([])
    // ③ 详情在场：那枚内容区节点的钩子就是包名（与技能/配方详情同一形制）。
    expect(collectDataValues(detail, 'data-enterprise-plugin-detail')).toEqual(['ent-a'])
    // ④ 页头与四枚页签**一字不改**：两态的页签逐个 props 相等（详情只占内容区）。
    expect(collectByRole(detail, 'tablist')).toHaveLength(1)
    expect(collectByRole(detail, 'tab')).toHaveLength(4)
    // 逐个页签比**版面事实**（id / 选中态 / 配对关系 / roving tabIndex / 可见文案）——两态必定逐项相同。
    // （不比整份 props：`onKeyDown` 那种每次渲染新建的闭包会让深比无意义地失败。）
    const tabShape = (tree: ReactNode) => collectByRole(tree, 'tab').map(props => ({
      id: props['id'],
      selected: props['aria-selected'],
      controls: props['aria-controls'],
      tabIndex: props['tabIndex'],
      label: textOf(props['children'] as ReactNode),
    }))
    expect(tabShape(detail)).toEqual(tabShape(list))
    expect(collectByRole(detail, 'tab').map(props => props['aria-selected'])).toEqual([false, true, false, false])
  })

  it('renders the detail as a plain region in the same tree: no dialog, no overlay, no aria-haspopup', () => {
    const detail = detailShell(pageInput())
    // ① 详情容器就是一枚普通内容区节点：`role="region"` + 「插件详情：<名称>」，全树没有第二个 role。
    const region = collectByRole(detail, 'region')
    expect(region).toHaveLength(1)
    expect(region[0]?.['aria-label']).toBe(`${ENTERPRISE_PLUGIN_DETAIL_TITLE}：甲插件`)
    expect(collectByRole(detail, 'dialog')).toEqual([])
    expect(collectDataValues(detail, 'aria-modal')).toEqual([])
    // ② 入口那枚按钮**没有** `aria-haspopup`（它开的不是弹窗，挂 dialog 语义会说错话）。
    expect(collectDataValues(detail, 'aria-haspopup')).toEqual([])
    expect(collectDataValues(EnterpriseMarketLegacyShell(shellProps()), 'aria-haspopup')).toEqual([])
  })

  it('gives the plugin row a real detail entry: a button with the full action name and the package name as its key', () => {
    const tree = EnterpriseMarketLegacyShell(shellProps())
    // 行本体（图标 + 两行文案）是一枚真 `<button class="own-market-rowOpen">`——与技能/配方行同款同枚。
    const openers = collectByClassName(tree, 'own-market-rowOpen')
    expect(openers).toHaveLength(1)
    expect(openers[0]?.['type']).toBe('button')
    expect(openers[0]?.['aria-label']).toBe('查看企业插件 甲插件 详情')
    expect(collectDataValues(tree, 'data-enterprise-plugin-open')).toEqual(['ent-a'])
    // 点它交回**那一行**（不是渲染时临时凑一份行对象）。
    const onOpenPluginDetail = vi.fn()
    const wired = EnterpriseMarketLegacyShell(shellProps({ onOpenPluginDetail }))
    collectByClassName(wired, 'own-market-rowOpen')[0]?.['onClick']?.()
    expect(onOpenPluginDetail).toHaveBeenCalledTimes(1)
    expect(onOpenPluginDetail.mock.calls[0]?.[0]).toMatchObject({ packageName: 'ent-a' })
    // 没接线时是「禁用 + 说明」，不是一枚点了没反应的假按钮（与技能/配方行同一降级口径）。
    const dead = collectByClassName(EnterpriseMarketLegacyShell(shellProps({ onOpenPluginDetail: undefined })), 'own-market-rowOpen')[0]
    expect(dead?.['disabled']).toBe(true)
    expect(dead?.['title']).toBe('详情入口未接通')
    // 动作仍然是行本体的**同级兄弟**：点开关/＋绝不触发详情（结构性保证，不靠 stopPropagation）。
    expect(collectByClassName(wired, 'own-market-rowLine')[0]?.['children']).toBeDefined()
  })

  it('reuses the very same detail component and stylesheet instead of copying a second one', async () => {
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    // ① 源码：详情组件只被渲染**一处**，且 import 自「企业设置 → 插件」那一份（本文件不复制正文）。
    expect((source.match(/<EnterprisePluginDetailPage/g) ?? []).length).toBe(1)
    expect(source).toContain('EnterprisePluginDetailPage,')
    expect(source).toContain("} from './plugin-market.js'")
    // 详情容器那枚钩子只在被复用的组件里（本文件没有第二枚 `data-enterprise-plugin-detail=`）。
    expect(source).not.toContain('data-enterprise-plugin-detail=')
    // ② 样式表：详情态把「企业设置 → 插件」那份表也挂上（复用的组件照它排版）。
    const detail = detailShell(pageInput())
    const css = collectStyleText(detail)
    expect(css).toContain('.own-market-facts{')
    expect(css).toContain('.own-market-toolbar,')
    // ★ 本刀那份表的类名随卡片重构换过一次（`.own-market-installCta` → `.own-plugin-install`）。
    expect(css).toContain('.own-plugin-install{')
    // ③ 列表态**不多背**那份表：那份字节级基线一字未动（列表视图的 `<style>` 就是原样那一份）。
    const listCss = collectStyleText(EnterpriseMarketLegacyShell(shellProps()))
    expect(listCss).not.toContain('.own-market-facts{')
    expect(listCss).not.toContain('.own-plugin-progressNote{')
    expect(listCss.length).toBe(LEGACY_STYLE_LENGTH)
    expect(styleChecksum(listCss)).toBe(LEGACY_STYLE_CHECKSUM)
    // ④ 字段与设置页那份**逐字段逐顺序**相同（「原样复用」不是「长得像」）。
    expect(collectByClassName(detail, 'own-market-facts')).toHaveLength(1)
    expect(collectByClassName(detail, 'own-market-toolbar')).toHaveLength(1)
    expect(textOf(detail)).toContain('插件详情')
    expect(textOf(detail)).toContain(ENTERPRISE_PLUGIN_DETAIL_PUBLISHER)
    expect(textOf(detail)).toContain('甲插件')
    expect(textOf(detail)).toContain('2 KiB')
  })

  it('wires both return paths it really has (button + Esc) and refuses to fake a router', async () => {
    const onBack = vi.fn()
    const detail = detailShell(pageInput({ onBack }))
    // ① 返回按钮：那枚带完整动作语义无障碍名的按钮 = 唯一返回入口（点它就是把目标清掉）。
    const back = collectByProp(detail, 'data-enterprise-plugin-detail-back')
    expect(back).toHaveLength(1)
    expect(back[0]?.['aria-label']).toBe(ENTERPRISE_PLUGIN_DETAIL_BACK_LABEL)
    ;(back[0]?.['onClick'] as () => void)()
    expect(onBack).toHaveBeenCalledTimes(1)
    // ② 源码：Esc 命中即停冒泡（别把官方面板一起关掉）、监听钉在本页根节点上、返回后还原滚动位置与焦点。
    const code = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(code).toContain("event.key !== 'Escape'")
    expect(code).toContain('event.stopPropagation()')
    expect(code).toContain('node.addEventListener(\'keydown\', onKeyDown)')
    expect(code).toContain('pluginDetailPage.current?.querySelector<HTMLElement>(\'[data-enterprise-plugin-detail-title]\')?.focus()')
    expect(code).toContain("querySelectorAll<HTMLElement>('[data-enterprise-plugin-open]')")
    expect(code).toContain('scrollTargetOf(')
    expect(code).toContain('saved.target.scrollTop = saved.top')
    // ③ **不假装有路由**：本页是官方 `plugins.item` 的 page 视图，硬造 history 会与宿主打架，故一个都没有。
    expect(code).not.toContain('pushState')
    expect(code).not.toContain('popstate')
    expect(code).not.toContain('history.')
    // ④ 监听范围钉在**本页根节点**（`sectionRef` 由控制器注入），不是 `document` —— 不抢别处的 Esc。
    expect(code).toContain('sectionRef: marketRoot')
    expect(code).toContain('ref={props.sectionRef}')
    expect(code).not.toContain("document.addEventListener('keydown'")
  })

  it('carries the row\'s own control into the detail (install when absent, menu when installed)', async () => {
    // ① 已安装：详情里的动作就是行上那一枚「⋯」（同一枚子块、同一份 facts）——
    //    目录里仍提供 ⇒ 内置 ⇒ **没有**卸载那一项，只有启停。
    const installed = detailShell(pageInput())
    expect(collectDataValues(installed, 'data-enterprise-plugin-slot')).toEqual([])
    expect(collectByClassName(installed, 'own-market-moreItem').map(props => props['children']))
      .toEqual([ENTERPRISE_MARKET_DISABLE_TEXT])
    expect(textOf(installed)).not.toContain('卸载')
    // ② 未安装：给的是【＋】那一格，且「本机版本」如实说「未安装」。
    const bare = rowNotInstalled()
    const bareProps = shellProps({ enterprisePlugins: [bare] })
    const missing = detailShell({
      row: bare,
      facts: enterpriseMarketPluginRowFacts(bareProps, bare),
      catalogVersionText: '2.0.0',
      onBack: vi.fn(),
    }, { enterprisePlugins: [bare] })
    expect(collectDataValues(missing, 'data-enterprise-plugin-slot')).toEqual(['install'])
    expect(textOf(missing)).toContain(ENTERPRISE_PLUGIN_DETAIL_NOT_INSTALLED)
    // ③ 控件动不了时**可见原因**也在详情里（不许只挂一句 title）——行上那句说明被一并带进动作区。
    const lockedProps = shellProps({ enterprisePlugins: [bare], onInstallPlugin: undefined })
    const locked = detailShell({
      row: bare,
      facts: enterpriseMarketPluginRowFacts(lockedProps, bare),
      catalogVersionText: '2.0.0',
      onBack: vi.fn(),
    }, { enterprisePlugins: [bare], onInstallPlugin: undefined })
    expect(collectDataValues(locked, 'data-enterprise-plugin-slot')).toEqual(['install'])
    expect(collectDataValues(locked, 'data-enterprise-plugin-lock')).toEqual(['ent-b'])
    // ④ 源码：卸载**只有一处**写入口、且只在「⋯」里（没有确认弹层——破坏性确认归设置页详情那一面）。
    const code = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect((code.match(/\.removePlugin\(/g) ?? [])).toHaveLength(1)
    expect(code).not.toContain('确认卸载')
    expect(code).toContain('builtin ? [] : [')
  })

  it('carries the row\'s real description into the detail, and drops the block entirely when the row has none', () => {
    // ① 目录里有这一条、制品写了描述 ⇒ 详情里那一段就是**行上第二行那条同一份真值**（`row.description`）。
    expect(row().description).toBe('甲的描述。')
    const described = detailShell(pageInput())
    expect(collectDataValues(described, 'data-enterprise-plugin-detail-description')).toEqual([''])
    expect(textOf(described)).toContain('甲的描述。')
    // ② 已下架（目录里没有这一条 ⇒ 行投影上**根本没有** `description` 这个键）⇒ 详情里整段不出现，不留空壳。
    const delisted = enterpriseMarketPluginRows([], [{
      packageName: 'ent-z', version: '1.0.0', desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null,
    }])[0]!
    expect('description' in delisted).toBe(false)
    const withoutDescriptionProps = shellProps({ enterprisePlugins: [delisted] })
    const withoutDescription = detailShell({
      row: delisted,
      facts: enterpriseMarketPluginRowFacts(withoutDescriptionProps, delisted),
      catalogVersionText: '1.0.0',
      onBack: vi.fn(),
    }, { enterprisePlugins: [delisted] })
    expect(collectDataValues(withoutDescription, 'data-enterprise-plugin-detail-description')).toEqual([])
    // 详情里缺描述**整段不出现**（「暂无描述」是行上第二行的口径，不搬到这里当占位）。
    expect(textOf(withoutDescription)).not.toContain('暂无描述')
    // ③ 描述只是**多传一个 prop**：详情里事实表那些字段一个不少、顺序不变（两态对比）。
    expect(collectByClassName(described, 'own-market-facts')).toHaveLength(1)
    expect(collectByClassName(withoutDescription, 'own-market-facts')).toHaveLength(1)
    expect(textOf(described)).toContain(ENTERPRISE_PLUGIN_DETAIL_PUBLISHER)
    expect(textOf(withoutDescription)).toContain(ENTERPRISE_PLUGIN_DETAIL_PUBLISHER)
  })

  // 口径 20（描述来自 README）：详情「描述」段的**内容来源**换成制品里的 README，三态一条不丢。
  it('prefers the artifact README over the short description, falls back to it, and drops the block when neither exists', () => {
    const readme = '# 甲插件\n\n把代码审查规则带进新会话。\n\n## 用法\n\n- 打开新会话\n'
    /** 目录里这一条带 README 的行（其余事实与基准行逐字相同，只有 `readme` 这一件事在变）。 */
    const withReadme = (readmeValue: string | undefined, description: string | undefined) =>
      enterpriseMarketPluginRows([{
        pluginVersionId: 'v1', packageName: 'ent-a', version: '1.2.0', displayName: '甲插件',
        ...(description === undefined ? {} : { description }),
        ...(readmeValue === undefined ? {} : { readme: readmeValue }),
        sizeBytes: 2048, operatingSystems: ['darwin'],
      }], [{
        packageName: 'ent-a', version: '1.2.0', desiredRevision: 1, desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null,
      }])[0]!

    /** 把一行渲染成详情子页面（与上面那条用例同一手法：控制器形状的一份 props 直造）。 */
    const detailOf = (target: ReturnType<typeof withReadme>): ReactNode => {
      const props = shellProps({ enterprisePlugins: [target] })
      return detailShell({
        row: target,
        facts: enterpriseMarketPluginRowFacts(props, target),
        catalogVersionText: '1.2.0',
        onBack: vi.fn(),
      }, { enterprisePlugins: [target] })
    }
    /** 详情里那一段描述正文那一枚节点（纯文本路径的正文挂在它的 `children` 上；Markdown 路径是元素数组）。 */
    const bodyNode = (node: ReactNode): Record<string, any> => {
      const body = collectByProp(node, 'data-enterprise-plugin-detail-description-text')
      expect(body, '描述正文那枚节点不在树里').toHaveLength(1)
      return body[0]!
    }
    /** 纯文本路径的正文（那一枚节点的 `children` 就是一个字符串）。 */
    const bodyText = (node: ReactNode): string => String(bodyNode(node)['children'])

    // ① 两者都在 ⇒ **README 赢**（整篇正文上屏，含原始换行），短描述不上屏；
    //    ★口径 22：这一支的正文**不再是一个字符串**，而是 Markdown 排版出来的 React 元素，并由
    //    那一枚节点上的 `data-enterprise-plugin-markdown` 标出「这一段是 Markdown 渲染面」。
    const both = withReadme(readme, '甲的描述。')
    expect(both.readme).toBe(readme)
    expect(both.description).toBe('甲的描述。')
    expect(bodyNode(detailOf(both))['data-enterprise-plugin-markdown']).toBe('')
    expect(bodyNode(detailOf(both))['children']).not.toBe(readme)
    expect(textOf(detailOf(both))).toContain('甲插件')
    expect(textOf(detailOf(both))).toContain('把代码审查规则带进新会话。')
    expect(textOf(detailOf(both))).not.toContain('甲的描述。')
    // ★版式换了、容器一个字没换：仍是同一枚可聚焦的块内滚动区（12 行 × 20px = 240px + anywhere），
    //   Markdown 的块级元素就挂在这一枚节点**里面**（同一容器，不是新开一层浮层）。
    const markdownBody = bodyNode(detailOf(both))
    expect(markdownBody['tabIndex']).toBe(0)
    const markdownStyle = markdownBody['style'] as Record<string, unknown>
    expect(markdownStyle['maxHeight']).toBe('240px')
    expect(markdownStyle['overflowY']).toBe('auto')
    expect(markdownStyle['overflowWrap']).toBe('anywhere')
    expect(collectByTagName(markdownBody['children'] as ReactNode, 'h1')).toHaveLength(1)
    expect(collectByTagName(markdownBody['children'] as ReactNode, 'ul')).toHaveLength(1)
    // 详情仍是**子页面**（口径 15/16 的形态没被这一刀改动）：全树没有 dialog 语义。
    expect(collectByRole(detailOf(both), 'dialog')).toEqual([])
    // ② 只有短描述（制品没有 README）⇒ **回落**到它（口径 19 的既有行为，一个字不丢）：
    //    ★这一支仍是**纯文本子节点**、也不带 Markdown 标记（口径 22 只改 README 那一支的版式）。
    const fallback = withReadme(undefined, '甲的描述。')
    expect('readme' in fallback).toBe(false)
    expect(bodyText(detailOf(fallback))).toBe('甲的描述。')
    expect(bodyNode(detailOf(fallback))['data-enterprise-plugin-markdown']).toBeUndefined()
    // ③ 两者都没有 ⇒ 整段不进 DOM（既不画空壳、也不并列两段），连小标题都不出现。
    const neither = withReadme(undefined, undefined)
    expect('readme' in neither).toBe(false)
    expect(collectDataValues(detailOf(neither), 'data-enterprise-plugin-detail-description')).toEqual([])
    // ④ 行上第二行**仍然**是短描述：README 只进详情，不进两行 clamp 的卡片（两件事实互不侵占）。
    expect(textOf(EnterpriseMarketLegacyShell(shellProps({ enterprisePlugins: [both] })))).toContain('甲的描述。')
  })

  it('keeps README as data: no HTML injection, no third-party Markdown dependency (自写渲染器)', async () => {
    // README 里带着 Markdown 记号与一段**看起来像 HTML** 的文本：投影本身**只做取值**，一个字符都不改。
    const readme = '# 标题\n\n<b>这不是 HTML</b> 与 <script>alert(1)</script>\n'
    expect(enterpriseMarketPluginDetailBody(readme, '短描述。')).toBe(readme)
    // 投影本身只是取值：不改写、不 trim、不截断。
    expect(enterpriseMarketPluginDetailBody('  两边留白  ', '短描述。')).toBe('  两边留白  ')
    expect(enterpriseMarketPluginDetailBody(undefined, undefined)).toBeUndefined()
    for (const missing of [null, '', '   ']) {
      expect(enterpriseMarketPluginDetailBody(missing, '短描述。'), String(missing)).toBe('短描述。')
      expect(enterpriseMarketPluginDetailBody(missing, missing), String(missing)).toBeUndefined()
    }
    // 契约上限 65536 整串照旧（投影不截断——限长是服务端那一侧的事，界面只做版式上的块内滚动）。
    const huge = 'y'.repeat(65_536)
    expect(enterpriseMarketPluginDetailBody(huge, '短描述。')).toHaveLength(65_536)
    // 源码级锁：这一面**没有** HTML 注入口，也**没有**第三方 Markdown 渲染依赖。
    // ★口径 22 起 Markdown 排版确实存在了，但它落在**自写的那一叶**里（`markdown-render.tsx`），
    //  这一面只多传一枚由唯一投影算出的版式开关——「不新增任何依赖」这条纪律没有被放宽。
    const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const market = strip(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    expect(market).not.toContain('dangerouslySetInnerHTML')
    expect(market).not.toContain('innerHTML')
    for (const renderer of ['marked', 'markdown-it', 'remark', 'micromark', 'react-markdown']) {
      expect(market, renderer).not.toContain(renderer)
    }
    // 自写渲染器本身同样不许有任何 HTML 注入口，也不许悄悄退回第三方库。
    const renderer = strip(await readFile(new URL('../src/markdown-render.tsx', import.meta.url), 'utf8'))
    expect(renderer).not.toContain('dangerouslySetInnerHTML')
    expect(renderer).not.toContain('innerHTML')
    for (const lib of ['marked', 'markdown-it', 'remark', 'micromark', 'react-markdown']) {
      expect(renderer, lib).not.toContain(lib)
    }
    // 依赖面一个字节都没动（`package.json` 的 dependencies 仍不存在、devDependencies 仍是原来那两件）。
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, any>
    expect(pkg['dependencies']).toBeUndefined()
    expect(Object.keys(pkg['devDependencies'] as Record<string, unknown>).sort()).toEqual(['@deepseek-ai/dsh-client-ui-primitives', '@types/mdast'])
  })

  // 口径 22（README 渲染成 Markdown 排版）：版式开关由**唯一一枚**投影判定，且只有 README 那一支为真。
  it('switches the description block to Markdown only when the body really comes from the README', async () => {
    // ① 纯投影的真值表：非空白 README ⇒ true；缺席/null/空串/纯空白 ⇒ false（与正文投影同一口径）。
    expect(enterpriseMarketPluginDetailMarkdown('# 标题\n')).toBe(true)
    expect(enterpriseMarketPluginDetailMarkdown('  两边留白  ')).toBe(true)
    for (const missing of [undefined, null, '', '   ']) {
      expect(enterpriseMarketPluginDetailMarkdown(missing), String(missing)).toBe(false)
    }
    // ② 与正文投影**不可能各说一套**：开关为真 ⇔ 正文就是那一份 README 原样。
    for (const readme of ['# 标题\n', '  两边留白  ', undefined, null, '', '   ']) {
      const body = enterpriseMarketPluginDetailBody(readme, '短描述。')
      const markdown = enterpriseMarketPluginDetailMarkdown(readme)
      expect(body, String(readme)).toBe(markdown ? readme : '短描述。')
    }
    // ③ 源码级锁：本面传的是**唯一那一枚**投影（不许内联 `page.row.readme !== undefined` 之类的第二套口径），
    //    且口径 20 那行 `description=` 一字未改。
    const market = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    expect(market).toContain('descriptionMarkdown={enterpriseMarketPluginDetailMarkdown(page.row.readme)}')
    expect(market).toContain('description={enterpriseMarketPluginDetailBody(page.row.readme, page.row.description)}')
    expect(market).toContain('export function enterpriseMarketPluginDetailMarkdown(')
  })
})

/** 收集树里带某个 props 键的元素 props（如那枚返回按钮的 `data-enterprise-plugin-detail-back`）。 */
function collectByProp(node: ReactNode, key: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByProp(child, key, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props[key] !== undefined) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Button/Switch/Tag）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByProp(rendered as ReactNode, key, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByProp(value as ReactNode, key, acc)
  }
  return acc
}

/**
 * 跑一遍真注册面（`client.tsx` 的 `apply`）并收集座位：`slots.inject(name, register)` 的名字顺序
 * 与每次 `register(options, component)` 的形状。测试宿主没有官方 slots 台账，故只喂最小 double。
 */
function runClientRegistrations(): {
  readonly injected: readonly string[]
  readonly registrations: readonly { readonly options: Record<string, unknown>; readonly component: unknown }[]
} {
  const injected: string[] = []
  const registrations: { options: Record<string, unknown>; component: unknown }[] = []
  apply({
    slots: {
      inject: (name: string, register: () => unknown) => { injected.push(name); return register() },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ options, component })
        return () => undefined
      },
    },
    remote: { $on: () => () => undefined },
    get: () => undefined,
    inject: () => undefined,
    on: () => () => undefined,
    effect: (effect: () => unknown) => { effect() },
  })
  return { injected, registrations }
}

/** 收集元素树里所有 `<button>` 的 props（节头 groupToggle），递归展开函数组件子树。 */
function collectButtonProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectButtonProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === 'button') { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectButtonProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectButtonProps(value as ReactNode, acc)
  }
  return acc
}

/** 收集树里 `role` 匹配的元素 props（页签条 / 页签 / 面板的 aria 配对断言），递归展开函数组件子树。 */
function collectByRole(node: ReactNode, role: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByRole(child, role, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['role'] === role) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByRole(rendered as ReactNode, role, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByRole(value as ReactNode, role, acc)
  }
  return acc
}

/** 收集元素树里所有 `role="alert"` 的元素（行内失败提示），递归展开函数组件子树。 */
function collectAlerts(node: ReactNode, acc: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) { for (const child of node) collectAlerts(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['role'] === 'alert') { acc.push(node); return acc }
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectAlerts(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectAlerts(value as ReactNode, acc)
  }
  return acc
}

/** 找 id 匹配的元素（折叠时列表条件渲染不进 DOM，返回 undefined；展开时返回该元素）。 */
function collectElementById(node: ReactNode, id: string): unknown {
  if (Array.isArray(node)) { for (const child of node) { const r = collectElementById(child, id); if (r !== undefined) return r } return undefined }
  if (!isValidElement(node)) return undefined
  const props = node.props as Record<string, unknown>
  if (props['id'] === id) return node
  if (typeof node.type === 'function') { const r = collectElementById((node.type as (p: unknown) => ReactNode)(props), id); if (r !== undefined) return r }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') { const r = collectElementById(value as ReactNode, id); if (r !== undefined) return r }
  }
  return undefined
}

/** 找 `data-market-section` 匹配的节元素（锁两节的数据钩子命名）。 */
function collectSectionByHook(node: ReactNode, hook: string): unknown {
  if (Array.isArray(node)) {
    for (const child of node) { const r = collectSectionByHook(child, hook); if (r !== undefined) return r }
    return undefined
  }
  if (!isValidElement(node)) return undefined
  const props = node.props as Record<string, unknown>
  if (props['data-market-section'] === hook) return node
  if (typeof node.type === 'function') {
    const r = collectSectionByHook((node.type as (p: unknown) => ReactNode)(props), hook)
    if (r !== undefined) return r
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') {
      const r = collectSectionByHook(value as ReactNode, hook)
      if (r !== undefined) return r
    }
  }
  return undefined
}

/** 收集元素树里所有指定标签（`h3`/`h4`/`pre`）的 props，递归展开函数组件子树（详情子页面的结构取证用）。 */
function collectByTagName(node: ReactNode, tag: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByTagName(child, tag, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === tag) { acc.push(props as Record<string, any>); return acc }
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByTagName(rendered as ReactNode, tag, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByTagName(value as ReactNode, tag, acc)
  }
  return acc
}

/**
 * 收集元素树里所有**官方 `Tag` 原语本体**的元素 props（`node.type === Tag`，与 `domOutline` 里
 * `MOCK_PRIMITIVES` 的同一套身份判定）——用于把「这枚徽章用的是官方原语，不是自绘胶囊」变成可验证断言。
 * 注意与下面同名不同义的 `collectTagProps` 无关：那个收的是带 `data-enterprise-skill-tag` 的「有更新」按钮。
 */
function collectOfficialTagProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectOfficialTagProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === (Tag as unknown)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectOfficialTagProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectOfficialTagProps(value as ReactNode, acc)
  }
  return acc
}

/**
 * 收集元素树里所有**官方 `Button` 原语本体**的元素 props（`node.type === Button`，与
 * `collectOfficialTagProps` 同一套身份判定）——mock 的 Button（`vi.fn()`）渲染产出 undefined，
 * 故 `collectButtonProps`（只认原生 `button` 标签）收不到它，须按**组件引用**收集。
 * 用途：标题区两枚占位按钮的 variant/aria-label 断言。
 */
function collectOfficialButtonProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectOfficialButtonProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === (Button as unknown)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectOfficialButtonProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectOfficialButtonProps(value as ReactNode, acc)
  }
  return acc
}

/**
 * 收集元素树里所有**官方 `MenuItemButton` 本体**的元素 props（`node.type === MenuItemButton`，
 * 与 `collectOfficialButtonProps` 同一套身份判定）。
 *
 * 用途（本刀）：「添加技能」下拉四项的**终态**（哪一项可点、文案、激活回调）读的是**真元素**，
 * 而不是纯投影数组——投影算对了但渲染层没照它画，是两回事。
 */
function collectOfficialMenuItemProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectOfficialMenuItemProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === (MenuItemButton as unknown)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectOfficialMenuItemProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectOfficialMenuItemProps(value as ReactNode, acc)
  }
  return acc
}

/** 收集元素树里所有 `<Switch>` 的 props（`vi.fn()` mock 的组件由 JSX 引用，props 存于 element.props）；嵌套函数组件先展开再递归。 */
/**
 * 按**分流槽位**收集动作控件 props（`data-enterprise-plugin-slot`）。
 *
 * 为什么需要它：插件行的 ＋ 用的是官方 `Button`（本文件里是 `vi.fn()` mock），而 `collectButtonProps`
 * 只认原生 `button`；槽位属性才是「这一格画的是 ＋ 还是开关」的判据本身。
 */
function collectSlotProps(node: ReactNode, slot: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectSlotProps(child, slot, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.props['data-enterprise-plugin-slot'] === slot) { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectSlotProps(rendered as ReactNode, slot, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectSlotProps(value as ReactNode, slot, acc)
  }
  return acc
}

/**
 * 未安装那一格的「安装」按钮 props（本刀：目录卡片不再用开关，未装 ⇒ 一枚「安装」按钮）。
 *
 * 读的是**真 DOM**：官方 `Button` 原语那一格带 `data-enterprise-skill-slot="install"`，
 * 故按槽位属性取证，`disabled` / `title` / `aria-label` / `onClick` 全是渲染时写进去的那几个值。
 */
const skillInstall = (tree: ReactNode): Record<string, any> | undefined =>
  collectByProp(tree, 'data-enterprise-skill-slot')[0]

/**
 * 行上「⋯」的**动作项**（按可见文案取）——本刀卡片不再用开关，动作都进了这一枚子块：
 * 有下拉宿主时它在 `.own-market-moreMenu` 里，没有宿主时按**平铺**渲染（详情子页面那种情形），
 * 两种形态都是真 `<button class="own-market-moreItem">`，故判据一条就够。
 */
const menuAction = (tree: ReactNode, label: string): Record<string, any> | undefined =>
  collectByClassName(tree, 'own-market-moreItem').find(props => props['children'] === label)

function collectSwitchProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectSwitchProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === (Switch as unknown)) { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectSwitchProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectSwitchProps(value as ReactNode, acc)
  }
  return acc
}

/**
 * 剥掉注释后的源码：源码级不变量必须**只看代码**——否则头部 [OUTPUT] 里提到同一个标识符
 * （例如 `enterpriseMarketShellModel(props)`）就会被错误地多记一次，断言变成对文档敏感。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/**
 * 抽出某个源文件**样式块**里声明的 CSS 类名（只看模板字面量里像 CSS 的块，
 * 不把 JS 成员访问如 `props.length` 误当类名），用于锁「本文件与同包其他文件的类名零交集」。
 */
function declaredClassNames(source: string): Set<string> {
  const blocks = [...source.matchAll(/`([^`]*?)`/gs)]
    .map(match => match[1] ?? '')
    .filter(block => block.includes('{') && block.includes('}') && block.includes(':'))
  // CSS 注释里会**刻意**提到旧类名（例如「类名从旧名 .own-market-tabs 改成 .own-market-storeTabs」），
  // 那是改名理由的留痕、不是真的声明，故先剥掉 /* … */ 再抽类名，避免注释把断言弄成假阳性。
  const css = blocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  return new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)\s*[,:{[\s>]/g)].map(match => match[1]!))
}

/** 收集元素树里所有官方 `<StateDot>` 的 props（行尾状态点语义：活跃/未观察/在途…）。 */
function collectStateDotProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectStateDotProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === (StateDot as unknown)) { acc.push(node.props as Record<string, any>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectStateDotProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectStateDotProps(value as ReactNode, acc)
  }
  return acc
}

/** 收集元素树里某个 `data-*` 属性的全部取值（锁数据钩子：受管态如实报态、辅助标签只在有更新时出现）。 */
function collectDataValues(node: ReactNode, prop: string, acc: unknown[] = []): unknown[] {
  if (Array.isArray(node)) { for (const child of node) collectDataValues(child, prop, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props[prop] !== undefined) acc.push(props[prop])
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectDataValues(rendered as ReactNode, prop, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectDataValues(value as ReactNode, prop, acc)
  }
  return acc
}

/** 收集树里带 `data-enterprise-skill-tag` 的元素 props（开关左侧那枚辅助标签；不出现即空数组）。 */
function collectTagProps(node: ReactNode, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectTagProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['data-enterprise-skill-tag'] !== undefined) { acc.push(props as Record<string, any>); return acc }
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectTagProps(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectTagProps(value as ReactNode, acc)
  }
  return acc
}

/**
 * 收集树里某个 `data-*` 属性**取值命中**的**元素本身**（不是 props），用于继续向下取 children。
 * 与 `collectDataValues` 同族，但保留节点——锁「某一行的动作子元素顺序」时要继续下钻。
 */
function collectByDataProp(node: ReactNode, prop: string, value: unknown, acc: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) { for (const child of node) collectByDataProp(child, prop, value, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props[prop] === value) { acc.push(node); return acc }
  if (typeof node.type === 'function') collectByDataProp((node.type as (p: unknown) => ReactNode)(props), prop, value, acc)
  for (const v of Object.values(props)) {
    if (v !== null && typeof v === 'object') collectByDataProp(v as ReactNode, prop, value, acc)
  }
  return acc
}

/**
 * 把函数组件（共享子块，如 `EnterpriseMarketSkillRowActions`）就地展开成它产出的元素列表。
 *
 * 动作现在由**一枚共享子块**渲染（行本体与详情弹层用的是同一份实现），因此它出现在行线的 children 里
 * 是一个函数组件元素而不是 `[有更新]`/`Switch` 本身。顺序取证（辅助动作严格排在开关左侧）必须先把它展开，
 * 否则「辅助动作在左」这条语义会因为一次纯抽取而假红。`vi.fn()` mock（Switch/Tag/StateDot）产出 undefined，
 * 自然落回「原样保留」这一支。
 */
function flattenElements(node: ReactNode, acc: ReactNode[] = []): ReactNode[] {
  for (const child of Array.isArray(node) ? node : [node]) {
    if (child === null || child === undefined || child === false || child === true) continue
    if (isValidElement(child) && typeof child.type === 'function') {
      const rendered = (child.type as (p: unknown) => ReactNode)(child.props as Record<string, unknown>)
      if (rendered !== undefined && rendered !== null) { flattenElements(rendered as ReactNode, acc); continue }
    }
    acc.push(child)
  }
  return acc
}

/**
 * 把**逐次唯一**的渐变 id 归一成 `ARTIFACT-ID`（供 `domOutline` 的字面快照用；理由见那里那段注释）。
 * 两处都要归一：`id="own-market-art-37"` 与 path 上的 `fill="url(#own-market-art-37)"`。
 */
function normalizeArtworkId(value: unknown): string {
  const text = String(value)
  if (text.startsWith('own-market-art-')) return 'ARTIFACT-ID'
  if (text.startsWith('url(#own-market-art-')) return 'url(#ARTIFACT-ID)'
  return text
}

/**
 * 某行的动作区 = `.own-market-rowLine` 的直属子元素（`[有更新]` 与 `[Switch]` 都落在这条行线上；
 * 行本体那枚可点 `<button>` 也是同级子元素）。版式统一后两套外壳的行是**同一条 rowLine**。
 */
function rowLineChildren(tree: ReactNode, rowId: string): ReactNode[] {
  const row = collectByDataProp(tree, 'data-enterprise-skill-package', rowId)[0] as { props?: Record<string, unknown> } | undefined
  const kids = row?.props?.['children'] as ReactNode[] | undefined
  const line = collectByClassName(kids as ReactNode, 'own-market-rowLine')[0]
  return flattenElements(line?.['children'] as ReactNode)
}

/**
 * 一行动作区里「辅助标签」与「官方 Switch」的下标（两套外壳共用同一套判定）。
 * 顺序锁的语义是「辅助动作严格排在 Switch 左侧」——`switch` 必须大于 `tag`。
 */
function actionOrder(children: readonly ReactNode[]): { readonly tag: number; readonly switch: number } {
  return {
    tag: children.findIndex(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-tag'] !== undefined),
    switch: children.findIndex(child => isValidElement(child) && child.type === (Switch as unknown)),
  }
}

/** 三个官方原语在本 spec 里是 `vi.fn()`：大纲里记录它们的 props，而不是调它们。 */
const MOCK_PRIMITIVES: readonly (readonly [unknown, string])[] = [[Switch, 'Switch'], [Tag, 'Tag'], [StateDot, 'StateDot']]

/**
 * 整棵树的 DOM 大纲（**函数组件按透明处理**——它们在真实 DOM 里没有节点）：每行 = `标签[属性]` 或 `#text:…`。
 * 这份大纲既用于「旧外壳输出一字未变」的固定结构快照（②），也用于「两套外壳行逐项一致」的结构比对（①）：
 * 抽子块/拆组件这类纯重构不会在上面产生假差异，而任何一处类名、属性、文本或顺序的改动都会立刻显形。
 */
function domOutline(node: ReactNode, depth = 0): string[] {
  const pad = '  '.repeat(depth)
  if (node === null || node === undefined || node === false || node === true) return []
  if (typeof node === 'string' || typeof node === 'number') return [`${pad}#text:${String(node)}`]
  if (Array.isArray(node)) return node.flatMap(child => domOutline(child, depth))
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  const type = node.type as unknown
  if (type === 'style') return [`${pad}style(${String(props['children'] ?? '').length} chars)`]
  const attrs = Object.entries(props)
    .filter(([key, value]) => key !== 'children' && value !== undefined && value !== null)
    /**
     * ★ **逐次唯一的渐变 id 归一成一个占位**（后人看到 `ARTIFACT-ID` 会疑惑，故把理由写在这里）：
     * 卡片那枚官方兜底图标的 `linearGradient id` **必须每次渲染都不同** —— 写死成常量的话，同页几十枚
     * 图标的 `fill="url(#…)"` 会**全部**解析到文档里第一个同名 defs，整页染成同一色（官方为此专门写了
     * `useArtworkId()`，注释原文即此）。所以它的数值**天然每次都不同**，字面快照锁它等于
     * **锁了一个必然漂移的值**，写死具体数字只会永远红。
     * 要归一的是**两处**，缺一不可（只归一 `id` 的话，引用它的那枚 `fill="url(#…)"` 仍带着真实序号）：
     *   · `id="own-market-art-37"`（linearGradient 上那枚 id 本身）
     *   · `fill="url(#own-market-art-37)"`（**引用**它的那个 url(#…)）
     *   ★ task-17 ② 起图形本体是 `text`（不再是官方那枚 `path`），故这第二处落在 `text` 上 ——
     *     归一逻辑与占位名都没变。
     * 故快照照旧锁住「**有这么一枚 id、且它被引用着**」这个结构事实；而「id 逐枚唯一 / 命名规范 /
     * 两端色值 / 图形尺寸」由「derives each row icon from the item id…」那条用例（task-17 ② 改名）
     * **逐条独立断言**（那里拿得到真实值）。一句话：**结构进快照、值进断言**，各司其职。
     */
    .map(([key, value]) => `[${key}=${typeof value === 'function' ? '[fn]' : normalizeArtworkId(value)}]`)
    .join('')
  for (const [mock, name] of MOCK_PRIMITIVES) {
    if (type === mock) return [`${pad}${name}${attrs}`, ...domOutline(props['children'] as ReactNode, depth + 1)]
  }
  // Fragment 由 `renderGrouped` 铺出行块：当**透明**处理，否则整段行子树会落在 `#opaque:` 后面。
  if (type === Fragment) return domOutline(props['children'] as ReactNode, depth)
  if (typeof type === 'function') return domOutline((type as (p: unknown) => ReactNode)(props), depth)
  if (typeof type !== 'string') return [`${pad}#opaque:${String(type)}`]
  return [`${pad}${type}${attrs}`, ...domOutline(props['children'] as ReactNode, depth + 1)]
}

/** 收集所有 `ul.own-market-rows` 行块根（函数组件透明；命中即不再下钻，避免把嵌套列表算两次）。 */
function collectRowRoots(node: ReactNode, acc: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) { for (const child of node) collectRowRoots(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const className = props['className']
  if (typeof className === 'string' && className.split(/\s+/).includes('own-market-rows')) { acc.push(node); return acc }
  if (typeof node.type === 'function') { collectRowRoots((node.type as (p: unknown) => ReactNode)(props), acc); return acc }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectRowRoots(value as ReactNode, acc)
  }
  return acc
}

/** 行块大纲：两套外壳的目录行（连行内动作与失败提示）必须逐行相同——版式统一的结构级取证。 */
function rowsOutline(tree: ReactNode): string[] {
  return collectRowRoots(tree).flatMap(root => domOutline(root))
}

/** `<style>` 文本的 FNV-1a 校验和（旧外壳那份 CSS 的字节级快照）。 */
function styleChecksum(text: string): number {
  let hash = 2166136261
  for (const char of text) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 16777619) >>> 0 }
  return hash
}

/** 收集 `className` 命中的元素 props（按空格分隔的类名之一匹配），用于锁两行卡片结构。 */
function collectByClassName(node: ReactNode, name: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) collectByClassName(child, name, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const className = props['className']
  if (typeof className === 'string' && className.split(/\s+/).includes(name)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    // 真组件只走它的**产出**（props 里的 children 已经在产出里，再按 props 走一遍会重复计数）；
    // `vi.fn()` mock（官方 Switch/Tag/StateDot）产出 undefined 时退回按 props 递归，保住它们的 children。
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByClassName(rendered as ReactNode, name, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByClassName(value as ReactNode, name, acc)
  }
  return acc
}

/**
 * ★ **本刀（task-20）的四组门禁**：A 添加钮档位 / B 工具行等高 32 / B 窄屏阈值重算 / D 的
 * `:has()` 作用域与「不许裸命中官方类」。前两组锁取值与算术，后两组锁「覆盖的边界」。
 */
describe('enterprise market page-head rhythm (task-20)', () => {
  const shellCss20 = (): string => collectStyleText(EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true }))
  const topText = (): string => splitTopLevelCss(shellCss20()).filter(part => part.scope === 'top').map(part => part.text).join('\n')

  it('drops the add trigger to the official sm tier and keeps refresh at md (task-20 A)', async () => {
    const model = enterpriseMarketShellModel({ view: 'page', sessionUsable: true })
    const seated = EnterpriseMarketDetailActions({
      subject: { kind: 'item', id: ENTERPRISE_MARKET_ENTRY_ID },
      tabSeat: { entries: model.tabEntries, activeTab: model.activeTab, onSelect: undefined },
    })
    const actions = collectOfficialButtonProps(seated)
    // ① 两枚动作的档位：**刷新仍 md**（用户口径「刷新可以」）、**添加降到 sm**（官方「插件」根页那枚逐字）。
    expect(actions.map(props => props['size'])).toEqual(['md', 'sm'])
    expect(actions.map(props => props['variant'])).toEqual(['ghost', 'primary'])
    // ② 官方两档真值（Button.module.css 逐字）：md 高 36 / 字 14 / 行高 22 / 内衬 14 / radius-md；
    //    sm 高 28 / 字 12 / 行高 18 / 内衬 10 / radius-sm —— 这些是**官方原语**的取值，本文件不许覆盖。
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    expect(source).toContain('size="sm"\n        variant="primary"')
    expect(source).toContain('<Plus aria-hidden size={13} />')
    expect(source).not.toContain('<Plus aria-hidden size={12} />')
    // ③ 刷新钮**一字未动**：仍 md、仍 RefreshCw 16。
    expect(source).toContain('<RefreshCw aria-hidden size={16} />')
    expect(source).toContain('size="md"\n      variant="ghost"')
    // ④ 下拉定位不依赖按钮高度：官方 `Menu` 走 `portal` + `align` 由运行时量取触发钮矩形，
    //    本文件对那个锚点**只有一条 token 覆盖**、没有任何 top/left/偏移规则（高度变化因此不影响定位）。
    const css = shellCss20()   // 锚点规则住在 baseStyles 里（外壳挂载），详情动作组件自己不挂 <style>
    expect(source).toContain('align="end"')
    expect(source).toContain('portal')
    const anchorRules = [...css.matchAll(/\.own-market-addMenu[^{]*\{([^}]*)\}/g)].map(m => m[1]!)
    expect(anchorRules.length).toBeGreaterThan(0)
    for (const body of anchorRules) {
      expect(body).not.toContain('top:')
      expect(body).not.toContain('left:')
      expect(body).not.toContain('position:')
    }
  })

  it('makes the tab track exactly as tall as the search box: 2 + 28 + 2 = 32 (task-20 B)', () => {
    const css = shellCss20()
    const tabs = cssRuleBody(css, '.own-market-storeTabs')
    const tab = cssRuleBody(css, '.own-market-storeTab')
    const query = cssRuleBody(css, '.own-market-query')
    const filter = cssRuleBody(css, '.own-market-filterBtn')
    // ── ① 先把算式依赖的取值在 CSS 里确认（不许照注释算）。
    expect(tabs).toContain('padding:2px')
    expect(tab).toContain('height:28px')
    expect(query).toContain('height:32px')
    expect(filter).toContain('width:32px')
    expect(filter).toContain('height:32px')
    // ── ② 再算：轨道内衬(上+下) + 段高 = 32，必须**与搜索框读出来的那个高度逐字相等**。
    const trackPadding = 2
    const tabHeight = 28
    const searchHeight = 32
    expect(trackPadding * 2 + tabHeight).toBe(32)
    expect(query).toContain(`height:${trackPadding * 2 + tabHeight}px`)
    expect(trackPadding * 2 + tabHeight).toBe(searchHeight)
    // ── ③ 三处**有意偏离**逐条钉住（防后人当遗漏「修回去」）：
    //    ① 轨道内衬 2px（官方 4px）——唯一目的是总高落到 32。
    expect(tabs).toContain('padding:2px')
    expect(tabs).not.toContain('padding:4px')
    //    ② 轨道/胶囊圆角 999px（官方 radius-md / radius-sm）——用户原话「胶囊」。
    expect(tabs).toContain('border-radius:999px')
    expect(tab).toContain('border-radius:999px')
    expect(tabs).not.toContain('var(--dsw-radius-md)')
    //    ③ 我们**不用**官方那枚绝对定位滑动指示块：选中态是选中项自己那枚**随主题翻转**的浮起胶囊。
    expect(tabs).not.toContain('position:relative')
    expect(tab).not.toContain('position:absolute')
    expect(tab).not.toContain('z-index')
    //    ★ task-21 更正：填色改官方分段控件指示块那枚 bg-layer-1（与字色 label-primary **成对**、
    //    随主题一起翻转）；原先的 background-primary 在本版 DSH 里不存在 ⇒ 兜底 #fff ⇒ 深色下白字压白。
    expect(cssRuleBody(css, ".own-market-storeTab[aria-selected='true']"))
      .toContain('background:var(--dsw-alias-bg-layer-1)')
    expect(cssRuleBody(css, ".own-market-storeTab[aria-selected='true']"))
      .toContain('box-shadow:var(--dsw-elevation-soft)')
    // ── ④ 官方轨道填充（可见的灰底）逐字照抄；等宽由 grid 行为承担。
    expect(tabs).toContain('var(--dsw-alias-interactive-bg-hover,#2631480f)')
    expect(tabs).toContain('display:inline-grid')
    expect(tabs).toContain('grid-auto-columns:1fr')
  })

  it('derives the tool-row breakpoint from the equal-width track: 320 + 176 + 56 + 48 = 600 (task-20 B)', () => {
    const top = topText()
    const media = splitTopLevelCss(shellCss20()).filter(part => part.scope === 'media')
    // ── ① 先把算式依赖的取值在 CSS 里确认。
    expect(cssRuleBody(top, '.own-market-storeTabs')).toContain('flex:0 0 auto')      // 页签轨不收缩
    expect(cssRuleBody(top, '.own-market-query')).toContain('min-width:120px')       // 搜索框最小贡献
    expect(cssRuleBody(top, '.own-market-filterBtn')).toContain('width:32px')        // 筛选钮
    expect(cssRuleBody(top, '.own-market-searchRow')).toContain('gap:8px')
    expect(cssRuleBody(top, '.own-market-rowBarSpacer')).toContain('min-width:0')    // 占位可压到 0，但**仍占一道 gap**
    // ── ② 工具行一行所需的最小内容宽：四枚子块 ⇒ **三道** gap（上一把刀按两道算，是漏项）。
    const ROW_GAPS = 3 * 8
    const TAB_TRACK = 320          // 等宽模型的最坏档（两位数计数），由上面那条几何用例逐值算出
    const QUERY_MIN = 120
    const FILTER = 32
    const minRow = TAB_TRACK + ROW_GAPS + QUERY_MIN + FILTER
    expect(minRow).toBe(496)
    // ── ③ 视口侧：官方折叠态侧栏轨道 56 + 官方 _page 的左右内衬 2×clamp(24px,4vw,48px)（窄屏取下限 24）。
    const RAIL = 56
    const PADDING = 2 * 24
    expect(minRow + RAIL + PADDING).toBe(600)
    const toolRow = media.filter(part => part.text.includes('.own-market-storeTabs{flex:0 0 100%'))
    expect(toolRow).toHaveLength(1)
    expect(toolRow[0]!.text).toContain(`@media (max-width: ${minRow + RAIL + PADDING}px)`)
    // ── ④ 临界点以上逐档复核（内衬按 clamp(24px,4vw,48px) 随视口长）。
    for (const viewport of [601, 700, 1000]) {
      const padding = 2 * Math.min(48, Math.max(24, 0.04 * viewport))
      expect(viewport - RAIL - padding, `${viewport}px：工具行放不下`).toBeGreaterThanOrEqual(minRow)
    }
  })

  it('scopes every official detail override behind :has(...own-market-entry...): never a bare official class (task-20 C/D + 收口)', async () => {
    const css = shellCss20()
    const source = await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    // ── ① 两条覆盖逐字存在，且**都**带 `:has(... .own-market-entry ...)` 作用域闸门。
    const overrides = [
      '[data-plugin-item-detail]:has([class*="_detailSections"] .own-market-entry) > [class*="_detailTop"] > [class*="_detailHead"]{margin-top:12px}',
      '[data-plugin-item-detail]:has([class*="_detailSections"] .own-market-entry) > [class*="_detailMain"]{margin-top:8px;gap:4px}',
    ]
    for (const rule of overrides) expect(css, rule).toContain(rule)
    // ── ② 反向锁：本文件里**凡**用 `:has(` 去命中官方 detail 类的规则，选择器里都必须含 `.own-market-entry`
    //      作用域；反过来，任何 `_detail*` 覆盖规则都必须带 `:has(`（不许裸命中官方类）。
    const detailSelectors = [...css.matchAll(/([^\n{}]*_detail[^\n{}]*)\{/g)].map(match => match[1]!)
    const scoped = detailSelectors.filter(selector => selector.includes(':has('))
    expect(scoped, '带 :has 的官方 detail 覆盖恰好三条（C/D 两条 + 收口后的隐藏图标一条）').toHaveLength(3)
    for (const selector of scoped) {
      expect(selector, '官方 detail 类名的覆盖必须带 :has(...own-market-entry...) 作用域').toContain('.own-market-entry')
      expect(selector).toContain('[data-plugin-item-detail]')
    }
    // ★ **收口后不再有例外**：「隐藏官方左上角图标」那条是**更早一刀**留下的，原先只锚在官方数据
    //   属性上、不带 :has 作用域 ⇒ 它会命中**其它 item 详情**（任务书里登记为唯一例外）。本次把它
    //   一并挂到同一条闸门上 ⇒ 本文件里**任何**命中官方 detail 类的规则都必须带
    //   :has(...own-market-entry...)，一条裸的都不许有；将来谁再加一条裸的，这条断言会先红。
    const bare = detailSelectors.filter(selector => !selector.includes(':has('))
    expect(bare, '裸命中官方 detail 类的规则（无 :has 作用域）必须为空').toEqual([])
    // ── ③ C 的手法**据实更正**：真正承载「标题↔描述 8px」的是官方 `_detailMain{gap:8px}`（在 `_titleRow`
    //      与 `p._detailDesc` 之间），而 `span.own-market-entry-summary` 是 inline 盒（纵向 margin 不参与
    //      布局）且不是 `_detailMain` 的直接子 ⇒ 那条计划里的 `margin-top:-4px` **是空操作**，不许写。
    expect(cssRuleBody(css, '.own-market-entry-summary')).not.toContain('margin-top')
    expect(cssRuleBody(css, '.own-market-entry-summary')).toBe('color:var(--dsw-alias-label-secondary,#667085)')
    // ── ④ 官方「插件」根页的页头节奏没被我们改：本文件里一个 `_pageHead/_pageTitle/_pageIntro` 都不出现。
    //    只看**代码**（剥掉注释——本刀的注释里引述了这些官方类名，不剥会恒红）。
    const code = stripComments(source)
    for (const official of ['_pageHead', '_pageTitle', '_pageIntro', '_toolbar']) {
      expect(code, official).not.toContain(official)
    }
    // ── ⑤ `_detailTop{padding-top:28px}` **保留**（只压元素间距）：本文件不许出现对它的 padding 覆盖。
    expect(css).not.toMatch(/_detailTop[^{]*\{[^}]*padding/)
  })

  it('paints every light surface with the official theme-flipping token pair (task-21 token 对账)', () => {
    const css = shellCss20()
    // 真机截图（**深色主题**）暴露：六处「浅色填充 + 随主题翻转的字色」⇒ 白字压白、字看不见。
    // 根因是一批**本版 DSH 根本不定义**的 alias token 名（var 的兜底 #fff 在生效；浅色主题下
    // 兜底恰好是对的，所以只在深色下暴露）。逐处照官方对应面取**成对** token：
    //   · 选中页签        ← 官方 SegmentedControl 的指示块：bg-layer-1 + label-primary
    //   · 授权弹层        ← 官方 Modal 面：bg-layer-2 + label-primary
    //   · 两个下拉菜单     ← 官方弹出面：menu-surface-fill（项字色 label-primary 不变）
    //   · 筛选项 hover     ← 与同族 .own-market-moreItem:hover 对齐：interactive-bg-hover
    // ★ 第五处（安装/启用按钮）**不是**换 token，而是**把覆盖整条删掉** —— 见下面那条反向锁。
    const pairs: readonly (readonly [string, string])[] = [
      [".own-market-storeTab[aria-selected='true']", 'background:var(--dsw-alias-bg-layer-1)'],
      ['.own-market-approval', 'background:var(--dsw-alias-bg-layer-2)'],
      ['.own-market-moreMenu', 'background:var(--dsw-menu-surface-fill)'],
      ['.own-market-filterMenu', 'background:var(--dsw-menu-surface-fill)'],
      ['.own-market-filterOption:hover', 'background:var(--dsw-alias-interactive-bg-hover)'],
      // ★ **复审整改补的第六处**：搜索框的底色原先也是那枚不存在的 token ⇒ 兜底 #fff 恒白（深色下
      //   就是一块白）。它按官方 Input 所在的面取 `bg-layer-1`（与本页选中页签同一枚；浅色下仍是白）。
      //   这一处保留了 `,#fff` 兜底，故只断言到 token 名为止。
      ['.own-market-query', 'background:var(--dsw-alias-bg-layer-1'],
    ]
    for (const [selector, fill] of pairs) {
      const body = cssRuleBody(css, selector)
      expect(body, selector).toContain(fill)
      // 反向锁：这五处**不许**再退回那枚不存在的 token —— 它的兜底 #fff 就是白底白字的来源。
      expect(body, selector).not.toContain('--dsw-alias-background-primary')
    }
    // ★ **安装/启用按钮那条反向锁（第三次更正）**：它**不是工具栏按钮，是普通按钮** —— 官方
    //   `.outline{background:transparent;border:0.5px solid var(--dsw-alias-border-l3)}` 在浅色卡片上
    //   **本来就是白底黑字 + 一条浅描边**（用户口径）。本文件曾给它填过两种背景：background-primary
    //   ⇒ 深色下白块压白字；button-tool-bar-fill ⇒ 浅色下变成工具栏灰。**两次都错**。
    //   ⇒ 现在的要求是：本文件 CSS 里**查无该规则**，这个类完全交给官方 .outline。
    expect(cssRuleBody(css, '.own-market-installBtn')).toBe('')
    expect(css).not.toContain('.own-market-installBtn.own-market-installBtn')
    // ★ **已知存量（本轮有意未动）**：本文件另有 8 个失效 token 名、约 70 处仍在用
    //   （background-secondary / accent-primary / status-error / status-warning / stroke-border-2 /
    //   label-on-primary / label-disabled / fill-secondary）。它们今天表现为「深色下仍是浅色块」，
    //   字色多落在仍存在的 state-warn / 兜底深色上，故**不造成字看不见**；全面对账另立一刀。
  })
})

/** 取元素树里 `<style>` 注入的 CSS 文本（视觉口径可直接断言，不必等真机算样式）。 */
function collectStyleText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(collectStyleText).join('')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return String((node.props as Record<string, unknown>)['children'] ?? '')
  const children = (node.props as Record<string, unknown>)['children']
  if (children === null || children === undefined || typeof children !== 'object') return ''
  return collectStyleText(children as ReactNode)
}

/** 从 CSS 文本里取某条类规则的声明块（如 `.own-market-cardDesc{…}`），用于锁字号/单行口径。 */
function cssRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escaped}\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
}

/**
 * 把一份 CSS 文本切成**顶层片段**与**媒体查询片段**（按第一层大括号配对扫描）。
 *
 * 为什么要它：本刀的窄屏取值必须**只**住在 `@media (max-width: 560px)` 里，
 * 而「顶层不含某取值」这种反向锁**不能用子串搜索** —— `@media{…}` 的整段文本本来就在顶层串里，
 * `expect(css).not.toContain('flex-wrap:wrap')` 会把媒体块里的规则也算进来，恒红。
 * 故先按第一层括号把片段分开，再分别断言：顶层 = 宽屏那一套、媒体块 = 窄屏那一套。
 */
function splitTopLevelCss(css: string): { readonly scope: 'top' | 'media'; readonly text: string }[] {
  /**
   * ★ 注释必须**先整体失效**：CSS 注释里出现 `{`（例如引述一条媒体查询）会让大括号配对算错，
   *   从而把后面所有片段切歪（本仓已踩过一次：媒体块里的规则因此「看起来不在媒体块里」）。
   *   做法：把注释替换成**等长空白** ⇒ 偏移量与原文一致，注释里的括号再不参与配对。
   */
  let blanked = ''
  let k = 0
  while (k < css.length) {
    if (css.startsWith('/*', k)) {
      const end = css.indexOf('*/', k + 2)
      const stop = end === -1 ? css.length : end + 2
      blanked += ' '.repeat(stop - k)
      k = stop
      continue
    }
    blanked += css[k]
    k += 1
  }
  const out: { scope: 'top' | 'media'; text: string }[] = []
  let headerStart = -1
  let headerHasMedia = false
  let depth = 0
  for (let i = 0; i < blanked.length; i += 1) {
    const char = blanked[i]
    if (char === '{') { depth += 1; continue }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        out.push({ scope: headerHasMedia ? 'media' : 'top', text: css.slice(headerStart, i + 1) })
        headerStart = -1
        headerHasMedia = false
      }
      continue
    }
    // 只在**第一层**收集「头」（选择器 / at-rule）；块内声明不参与。
    if (depth === 0) {
      if (headerStart === -1) { if (/\s/.test(char)) continue; headerStart = i }
      if (char === '@') headerHasMedia = css.slice(i, i + 6) === '@media'
    }
  }
  return out
}

/**
 * **本刀（静默吞失败 → 显式失败态 + 可重试）**：两个目录页签的**加载 / 空 / 失败**三态。
 *
 * 这里锁四件事：
 *  ① 四态互斥：同一时刻只渲染一个 `data-market-list-state`（加载中 / 空 / 失败），且失败与空**不是**同一态；
 *  ② 失败态复用唯一提示组件（人话 + 下一步 + 「技术信息」里的稳定码，可见文本里没有裸码）+ 重试按钮；
 *  ③ 点重试 → 走调用方的重试回调（真运行时 = 取数源 `retry()`，真的重发请求；请求计数取证见 list-state.spec）；
 *  ④ 次级取数降级（已装状态 / 部分技能详情没读全）出**非打扰但可见**的一句 `role="status"`，且不遮住目录行。
 */
describe('enterprise directory tab three states (loading / empty / failed)', () => {
  /** 收集 `aria-label` 命中的元素 props（递归展开函数组件；重试按钮用它取证）。 */
  function collectByAriaLabel(node: ReactNode, label: string, acc: Record<string, any>[] = []): Record<string, any>[] {
    if (Array.isArray(node)) { for (const child of node) collectByAriaLabel(child, label, acc); return acc }
    if (!isValidElement(node)) return acc
    const props = node.props as Record<string, unknown>
    if (props['aria-label'] === label) acc.push(props as Record<string, any>)
    if (typeof node.type === 'function') {
      const rendered = (node.type as (p: unknown) => ReactNode)(props)
      if (rendered !== undefined && rendered !== null) return collectByAriaLabel(rendered as ReactNode, label, acc)
    }
    for (const value of Object.values(props)) {
      if (value !== null && typeof value === 'object') collectByAriaLabel(value as ReactNode, label, acc)
    }
    return acc
  }
  const RETRY_LABEL = '重新加载这个列表'

  it('shows a hint (never a blank panel) while the skills catalog is loading', () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: true, skillsListState: { kind: 'loading' } })
    expect(collectDataValues(tree, 'data-market-list-state')).toEqual(['loading'])
    expect(textOf(tree)).toContain(ENTERPRISE_MARKET_SKILLS_LOADING)
    // 加载中不是失败：没有 alert、没有裸码、没有重试按钮。
    expect(collectAlerts(tree)).toEqual([])
    expect(textOf(tree)).not.toContain('ENT_')
    expect(collectByAriaLabel(tree, RETRY_LABEL)).toEqual([])
  })

  it('says why the skills catalog is empty instead of pretending it failed', () => {
    const tree = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      skillsListState: { kind: 'empty', value: { rows: [], installed: [] } },
    })
    expect(collectDataValues(tree, 'data-market-list-state')).toEqual(['empty'])
    expect(textOf(tree)).toContain(ENTERPRISE_MARKET_SKILLS_EMPTY)
    expect(ENTERPRISE_MARKET_SKILLS_EMPTY).not.toContain('ENT_')
    expect(collectAlerts(tree)).toEqual([])
  })

  it('renders the catalog failure with the shared notice, the stable code and a working retry', () => {
    const onRetrySkills = vi.fn()
    const tree = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      skillsListState: { kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE' },
      onRetrySkills,
    })
    // 三态互斥：这一帧只有失败态这一个状态钩子。
    expect(collectDataValues(tree, 'data-market-list-state')).toEqual(['failed'])
    const alert = textOf(collectAlerts(tree)[0])
    expect(alert).toContain(ENTERPRISE_MARKET_SKILLS_FAILED)
    expect(alert).toContain('暂时无法连接企业服务。')
    expect(alert).toContain('下一步：')
    // 裸码不上屏：人话那一段（「技术信息」之前）一个字都不带码；码本身仍取得回（折叠区里）。
    const [human] = alert.split('技术信息')
    expect(human).not.toContain('ENT_')
    expect(alert).toContain('技术信息')
    expect(alert).toContain('ENT_PLATFORM_UNAVAILABLE')
    // 重试按钮存在且**真的**把点击交给调用方（真运行时那是取数源的 retry()）。
    const retry = collectByAriaLabel(tree, RETRY_LABEL)
    expect(retry).toHaveLength(1)
    expect(retry[0]?.['children']).toBe('重试')
    retry[0]?.['onClick']?.()
    expect(onRetrySkills).toHaveBeenCalledTimes(1)
    // 失败时**不**显示「空列表」那句（失败绝不假装没数据）。
    expect(textOf(tree)).not.toContain(ENTERPRISE_MARKET_SKILLS_EMPTY)
  })

  it('renders the plugin catalog failure and its retry on the plugins tab', () => {
    const onRetryPlugins = vi.fn()
    const tree = EnterpriseMarketLegacyShell({
      view: 'page',
      activeTab: 'plugins',
      sessionUsable: true,
      pluginsListState: { kind: 'failed', code: 'ENT_PLUGIN_LOADER_INACTIVE' },
      onRetryPlugins,
    })
    expect(collectDataValues(tree, 'data-market-list-state')).toEqual(['failed'])
    expect(textOf(tree)).toContain(ENTERPRISE_MARKET_PLUGINS_FAILED)
    expect(textOf(tree)).toContain('插件没有启动起来。')
    const retry = collectByAriaLabel(tree, RETRY_LABEL)
    expect(retry).toHaveLength(1)
    retry[0]?.['onClick']?.()
    expect(onRetryPlugins).toHaveBeenCalledTimes(1)
  })

  it('keeps loading / empty for the plugins tab and hides neither behind the row count', () => {
    const loading = EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'plugins', sessionUsable: true, pluginsListState: { kind: 'loading' } })
    expect(collectDataValues(loading, 'data-market-list-state')).toEqual(['loading'])
    expect(textOf(loading)).toContain(ENTERPRISE_MARKET_PLUGINS_LOADING)
    const empty = EnterpriseMarketLegacyShell({
      view: 'page', activeTab: 'plugins', sessionUsable: true,
      pluginsListState: { kind: 'empty', value: [] },
    })
    expect(collectDataValues(empty, 'data-market-list-state')).toEqual(['empty'])
    expect(textOf(empty)).toContain(ENTERPRISE_MARKET_PLUGINS_EMPTY)
    // 组件关闭（会话不可用）时仍然整段不出现：既有门控一字未动。
    const off = EnterpriseMarketLegacyShell({ view: 'page', sessionUsable: false, pluginsListState: { kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE' } })
    expect(collectDataValues(off, 'data-market-list-state')).toEqual([])
  })

  it('explains a degraded secondary read without hiding the rows', () => {
    const degraded = { rows: enterpriseMarketSkillRows([SKILL]), installed: [] as never[], installedCode: 'ENT_LOCAL_UNAVAILABLE' }
    const tree = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: degraded.rows,
      skillsListState: { kind: 'ready', value: degraded },
      onRetrySkills: vi.fn(),
    })
    const text = textOf(tree)
    // 目录行照旧在（降级只说明次级事实，不遮内容）。
    expect(text).toContain(SKILL.displayName)
    // 交代是「非打扰但可见」：role="status" 的一句 + 可用重试；不冒充 alert。
    expect(text).toContain('本机已装状态暂时没有读取到')
    expect(text).toContain('下一步：')
    expect(collectAlerts(tree)).toEqual([])
    expect(collectByAriaLabel(tree, RETRY_LABEL)).toHaveLength(1)
  })

  it('never renders a retry button when the caller has no retry to give (no dead control)', () => {
    const hint = EnterpriseMarketListHint({ state: { kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE', prefix: ENTERPRISE_MARKET_SKILLS_FAILED } })
    expect(collectByAriaLabel(hint as ReactNode, RETRY_LABEL)).toEqual([])
    // hidden / ready 两个成员在内容区不该产出任何三态节点。
    expect(EnterpriseMarketListHint({ state: { kind: 'hidden' } })).toBeNull()
    expect(EnterpriseMarketListHint({ state: { kind: 'ready' } })).toBeNull()
    // 降级提示的组件也只在有回调时才给按钮。
    const notice = EnterpriseMarketDegradedNotice({ code: 'ENT_LOCAL_UNAVAILABLE', subject: '本机已装状态' })
    expect(collectByAriaLabel(notice as ReactNode, RETRY_LABEL)).toEqual([])
    expect(textOf(notice as ReactNode)).toContain('本机已装状态暂时没有读取到')
  })

  it('exposes the catalog loader and the panel projection as the single sourcing point', () => {
    // 取数源与投影都在出口上（面板三态的唯一判定点）；旧口径（无 list 时按行数）仍保留给纯函数直调。
    expect(typeof loadEnterpriseSkillCatalog).toBe('function')
    expect(typeof createEnterpriseSkillCatalogSource).toBe('function')
    const base = { enabled: true, loadingHint: ENTERPRISE_MARKET_SKILLS_LOADING, emptyHint: ENTERPRISE_MARKET_SKILLS_EMPTY, failedPrefix: ENTERPRISE_MARKET_SKILLS_FAILED, rowCount: 0 }
    expect(enterpriseMarketPanelState(base)).toEqual({ kind: 'hidden' })
    expect(enterpriseMarketPanelState({ ...base, list: { kind: 'loading' } })).toEqual({ kind: 'loading', hint: ENTERPRISE_MARKET_SKILLS_LOADING })
  })
})
