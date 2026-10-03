/**
 * [INPUT]: 依赖 marketplace-entry 的**唯一目录页外壳** `EnterpriseMarketLegacyShell`（点技能行本体在该视图内整页切换到**技能详情子页面** `EnterpriseSkillDetailPage`）、共享行子块 `EnterpriseMarketSkillRowActions`/`EnterpriseMarketInlineRows`、五个详情纯投影（`enterpriseSkillTreeRows`/`enterpriseSkillDefaultFilePath`/`enterpriseSkillFileCountText`/`enterpriseSkillTreeState`/`enterpriseSkillPreviewState`）、唯一 hook 入口 `EnterpriseMarketLegacyPage` 与共享逻辑层（`enterpriseMarketShellModel`、`enterpriseMarketSkillRowFacts`/`enterpriseMarketPluginRowFacts`）、注册常量、**页签真源**（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_DEFAULT_TAB`/`ENTERPRISE_MARKET_TAB_IDS`/`ENTERPRISE_MARKET_TABLIST_LABEL`）、组件清单/摘要/状态/开关语义纯投影、企业插件行投影、企业技能行投影（含详情归并的中心版本 `latestVersionId` 与标题行两枚标签取值）、标题行标签纯投影、技能节受管态纯投影、「有更新」判定与辅助标签投影、**组件页签折叠态常量** `ENTERPRISE_MARKET_DEFAULT_EXPANDED`、失败行内提示投影、入口组件与版本签组件本身、页签文案计数投影，以及 local-api-decode 的 `EnterpriseRuntimeSkill`/`EnterpriseInstalledSkill`/`EnterpriseSkillFileEntry`/`EnterpriseInstalledSkillFile` 形状，以及 `client.tsx` 的 `apply`/`inject` 真注册面（最小 slots double）
 * [OUTPUT]: 验证入口身份常量、卡片一句话的单行约束、**page 视图的三页签结构**（页签条手写 `role="tablist"`、三个页签的 `aria-selected`/`aria-controls`/roving `tabIndex`/`id` 与三个 `role="tabpanel"` 的 `aria-labelledby` 严格配对、**默认选中「企业技能」**、切换后**只渲染该页签内容**、←/→/Home/End 走焦并选中、鼠标点击回调）、组件清单（插件/技能/配方）顺序与 reserved 语义、计数摘要口径、summary/page 两视图结构、版本签只对本条目 subject 出、企业插件页签的归并与门控，以及**企业技能页签的官方两行卡片**（标题 + 版本签 + 可选分类签、描述单行省略、右侧官方 `Switch`、开关左侧那枚辅助「有更新」标签）、受管态与「有更新」的独立判定、**两节行上的失败可见反馈**、**页签化后唯一剩下的组件节折叠**、**详情页顶部压缩的取值锁**、**类名隔离的源码级不变量**；**本刀（详情子页面 + 文件树）新增**：①「点行本体切到详情子页面、点动作永不触发」——两枚动作是行本体的同级兄弟、面包屑是唯一返回入口、`skillPage` 非空时列表/页签整段不挂载；②「框架逐项照官方详情页」——面包屑（可见文案 + `aria-label`）、`h3` 标题 + 版本徽标、等宽标识行（`skillId`）、描述、`detailSections`/`detailSection` 的结构与 CSS 取值（20/28-500、12/18-tertiary、28px/32px 间距、rotate(90deg) 的 chevron）；③「左文件树」——`enterpriseSkillTreeRows` 的层级投影（depth/parent/name、先序确定性排序）、目录行不是按钮而文件行是按钮、缩进取自 depth；④「默认选中并预览 SKILL.md」——`enterpriseSkillDefaultFilePath` 只在树里真有那条路径时才选它；⑤「未安装零请求」——`enterpriseSkillTreeState`/`enterpriseSkillPreviewState` 的未装态优先于任何 loading/失败、界面只说「安装后可浏览文件」；⑥「读取失败给稳定码 + 重试」与「预览是纯文本安全渲染（全文件无 `dangerouslySetInnerHTML`）」；⑦**弹层已彻底移除**的反向锁（源码无 `Modal`、无 `EnterpriseSkillDetailDialog`，任何函数调用都收不到 Modal 元素）；**本刀（版本签只显示版本）新增**：⑧ 纯投影 `enterpriseMarketSkillVersionLabel` 的短号规则与边界（5 个真实值 + 无 `@` / 多个 `@` / 仅 `@` / 尾部 `@` / 空串 / 不 trim 逐条锁死）；⑨ 行上签的**可见文案 = 短号**、**完整坐标挂在紧包它的 `.own-market-skillVersionHint` 的 `title` 上**（签本体确实在那枚节点里、正文里不再出现整串），详情页那枚徽标照旧整串显示（列表短号 / 详情全坐标）；⑩ 标题行结构快照与两套外壳共用 CSS 的长度/校验和按新结构**再基线化一次**（style 7840→8178 chars，校验和随之更新） **本刀（目录页签三态）**：新增八条——加载中不空白、空说清为什么空（不是失败）、失败带唯一提示组件 + 可用重试（点它真的调回调）、三态互斥只出一个 `data-market-list-state`、组件关闭仍整段不出现、次级降级一句 `role="status"` 且不遮行、无回调不给死按钮，并把取数 effect 的 `controller.abort()` 计数按新结构改为 2（目录取数搬进共享取数源）。 **本刀（资料库行）**：组件清单断言由三行改四行——「资料库」行顺序/标签/`gate='local'`、本机开关的「未开启 ↔ 可用」状态词与悬浮说明、写入口缺席/在途/写失败三种禁用口径（写失败不禁用）、计数摘要四段（含 `1 未开启`）、三个页签计数文案与组件页签行/开关数同步改 4，并新增 `enterpriseMarketComponentGate`/`enterpriseMarketComponentSwitchTitle` 的纯投影断言。 **本刀（企业标签）新增三条**：①「描述行」——`EnterpriseMarketSummaryLine` 的 children 恰好是 `[企业胶囊, ENTERPRISE_MARKET_SUMMARY]`、`textOf` = `企业 技能 · 配方`、正文与常量都不含「企业插件」（`enterpriseMarketEntrySummary()` 也照新值锁死）；②「详情徽章」——`BadgeView` 出**两枚** `own-market-tag`（第 1 枚「企业」`tone=info`、第 2 枚版本签 `tone=neutral`，位置与顺序逐项锁死），并用新助手 `collectOfficialTagProps`（按 `node.type === Tag` 取证，与 `domOutline` 的 `MOCK_PRIMITIVES` 同一套身份判定）断言「这枚徽章用的是官方 `Tag` **原语本体**、props 恰好只有 `{className,tone,children}`、`EnterpriseMarketBadgeTag()` 直调产出同一枚元素」，无版本时只剩企业徽章；③**反向锁「不新增 CSS 类」**——源码里 `.own-market-tag{` 只有一处声明、规则正文仍是 `flex:none;font-variant-numeric:tabular-nums`、整份 `<style>` 长度 10507 与 FNV-1a 校验和 3008014743 不变、被声明的类名集合里没有为徽章新造的名字。**本刀（企业标签移回标题行）**：用户两次指出「企业」必须在**标题行、标题后面**，故①描述行**回退**——`ENTERPRISE_MARKET_SUMMARY` 恢复 `'企业插件 · 技能 · 配方'`、`EnterpriseMarketSummaryLine` 的 children 恰好是一句纯文本、整行**零**官方 `Tag`（新增反向锁「描述行不再有胶囊」）；②列表标题行那一枚签由 `market-entry-badge.ts` 的 DOM 装饰负责，本文件只保留详情页 `BadgeView` 的企业徽章（该用例不动）。**新文件 `tests/market-entry-badge.spec.ts`** 覆盖 DOM 装饰：自造 domOutline 下「标题按钮 + titleRow」的定位与插入点、克隆官方「实验性」签实物（连哈希 `statusTag` 类一起）只换文本、官方行不被注入、幂等（同一条行只插一枚）、官方重渲染后重新铺、`dispose` 摘签 + 停观察、官方签不在场时退路 + warn、连样本都没有时不插 + warn、官方行标记不见时按 `data-plugin-panel`/`aria-busy` 区分静默与 warn、描述行 CSS 零新增。**本文件 68 条（描述行两条改写、条数不变），新文件另加 13 条（ui 包 425 → 438）。** **本刀（企业插件真取消）**：既有那条「失败前缀随动作走」的用例补一条 `action: 'cancel'` 断言（取消那一支**不给前缀**，见 `enterpriseMarketActionErrorLabel`），条数不变；样式两道字节级判据（长度 12028 / FNV-1a 校验和 2071534702）**一字未动**——取消按钮用的是官方 `Button` 原语，本文件与 `plugin-market.tsx` 都没新增任何 CSS 类。
 * [POS]: dsh-ui 插件市场入口（唯一入口：官方插件页「插件市场」卡片）的产品词汇与交互门禁，真实渲染与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { StateDot, Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnterpriseInstalledSkill, EnterpriseSkillFileEntry, EnterpriseRuntimeSkill } from '../src/local-api-decode.js'
import { apply, inject } from '../src/client.js'
import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_MARKET_COMPONENTS,
  ENTERPRISE_MARKET_DEFAULT_EXPANDED,
  ENTERPRISE_MARKET_DEFAULT_TAB,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
  ENTERPRISE_MARKET_ENTRY_ORDER,
  ENTERPRISE_MARKET_PLAN,
  ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
  ENTERPRISE_MARKET_SKILL_UPDATE_TAG,
  ENTERPRISE_MARKET_SUMMARY,
  ENTERPRISE_MARKET_TAB_IDS,
  ENTERPRISE_MARKET_TABLIST_LABEL,
  ENTERPRISE_MARKET_TABS,
  BadgeView,
  EnterpriseMarketBadge,
  EnterpriseMarketBadgeTag,
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
 * 来历与含义（读之前先看清它现在锁的是什么）：上一轮「抽共享行子块」时这三份值是**改动前**捕获的，
 * 用来证明「抽子块一字未变」；本轮按用户要求给**技能行本体加了详情入口**（行本体成为一枚真 `<button>`），
 * 技能行的结构因此**按设计变了一次**，这三份值随之重新基线化。现在它们锁的是：
 *  · 技能行行线 = 「可点行本体（图标 + 两行文案）」+「`[有更新]`」+「官方 `Switch`」三者**同级**，
 *    动作既不在可点按钮内、也没有因为可点而消失；
 *  · 企业插件行**一字未动**（本轮不给插件行详情入口）；
 *  · 两套外壳共用的那份 CSS 也随之定值（`rowStyles` 多了 `.own-market-rowOpen` 的四条规则（本体 / hover / focus-visible / disabled））。
 * **本刀（版本签只显示版本）再基线化一次**：行上版本签的可见文案改成短号、完整坐标挂在紧包它的
 * `.own-market-skillVersionHint` 的 `title` 上，故大纲多出那一层 span（Tag 本体与分类签一字未动）、
 * 共用 CSS 多一条 `.own-market-skillVersionHint` 规则（style 长度 7840 → 8178、校验和随之更新）。
 * 任何人再改行结构/类名/属性/顺序或那份 CSS，这里都会立刻显形。
 */
const LEGACY_SHELL_OUTLINE: readonly string[] = [
  "section[className=own-market-entry][aria-label=插件市场]",
  "  style(12741 chars)",
  "  div[role=tablist][aria-label=企业市场][className=own-market-storeTabs]",
  "    button[id=market-tab-skills][type=button][role=tab][className=own-market-storeTab][aria-selected=true][aria-controls=market-panel-skills][tabIndex=0][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:企业技能 1",
  "    button[id=market-tab-plugins][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-plugins][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:企业插件 2",
  "    button[id=market-tab-presets][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-presets][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:企业配方 0",
  "    button[id=market-tab-components][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-components][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:包含内容 4",
  "  div[id=market-panel-skills][role=tabpanel][aria-labelledby=market-tab-skills][hidden=false][className=own-market-panel]",
  "    section[className=own-market-section][data-market-section=enterprise-skills]",
  "      ul[className=own-market-rows]",
  "        li[className=own-market-row][data-enterprise-skill-package=1902500000000000001][data-enterprise-skill-id=meeting-notes][data-enterprise-skill-state=UPDATE_AVAILABLE]",
  "          div[className=own-market-rowLine]",
  "            button[type=button][className=own-market-rowOpen][data-enterprise-skill-open=1902500000000000001][aria-label=查看企业技能 会议纪要技能组 详情][disabled=true][title=详情入口未接通][onClick=[fn]]",
  "              span[className=own-market-rowIcon]",
  "                #opaque:[object Object]",
  "              div[className=own-market-rowMain]",
  "                span[className=own-market-cardHead]",
  "                  span[className=own-market-cardId own-market-skillTitle]",
  "                    #text:会议纪要技能组",
  "                  span[className=own-market-skillVersionHint][title=0.1.7-rc.2]",
  "                    Tag[className=own-market-tag own-market-skillVersionTag][tone=neutral]",
  "                      #text:0.1.7-rc.2",
  "                  Tag[className=own-market-tag own-market-skillCategoryTag][tone=info]",
  "                    #text:研发工具",
  "                span[className=own-market-cardDesc]",
  "                  #text:把会议录音与转写整理成结构化纪要。",
  "            button[type=button][className=own-market-skillTag][data-enterprise-skill-tag=UPDATE_AVAILABLE][aria-label=更新企业技能 会议纪要技能组][disabled=false][title=点此更新到中心当前版本][onClick=[fn]]",
  "              #text:有更新",
  "            Switch[checked=true][label=卸载企业技能 会议纪要技能组][disabled=false][title=点此卸载][onChange=[fn]]",
  "          div[className=own-market-inlineError][role=alert]",
  "            span[className=own-error-message][style=[object Object]]",
  "              #text:安装失败：更新包校验没有通过。",
  "            span[className=own-error-action][style=[object Object]]",
  "              #text:下一步：",
  "              #text:请重新检查更新；仍然失败请联系企业管理员。",
  "            details[className=own-error-tech][style=[object Object]][data-enterprise-error-tech=ENT_ARTIFACT_INTEGRITY_FAILED]",
  "              summary[style=[object Object]]",
  "                #text:技术信息",
  "              code[style=[object Object]][data-enterprise-error-code=ENT_ARTIFACT_INTEGRITY_FAILED]",
  "                #text:ENT_ARTIFACT_INTEGRITY_FAILED",
  "  div[id=market-panel-plugins][role=tabpanel][aria-labelledby=market-tab-plugins][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-presets][role=tabpanel][aria-labelledby=market-tab-presets][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-components][role=tabpanel][aria-labelledby=market-tab-components][hidden=true][className=own-market-panel]",
]
const LEGACY_PLUGINS_OUTLINE: readonly string[] = [
  "section[className=own-market-entry][aria-label=插件市场]",
  "  style(12741 chars)",
  "  div[role=tablist][aria-label=企业市场][className=own-market-storeTabs]",
  "    button[id=market-tab-skills][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-skills][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:企业技能 1",
  "    button[id=market-tab-plugins][type=button][role=tab][className=own-market-storeTab][aria-selected=true][aria-controls=market-panel-plugins][tabIndex=0][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:企业插件 2",
  "    button[id=market-tab-presets][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-presets][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:企业配方 0",
  "    button[id=market-tab-components][type=button][role=tab][className=own-market-storeTab][aria-selected=false][aria-controls=market-panel-components][tabIndex=-1][onClick=[fn]][onKeyDown=[fn]]",
  "      #text:包含内容 4",
  "  div[id=market-panel-skills][role=tabpanel][aria-labelledby=market-tab-skills][hidden=true][className=own-market-panel]",
  "  div[id=market-panel-plugins][role=tabpanel][aria-labelledby=market-tab-plugins][hidden=false][className=own-market-panel]",
  "    section[className=own-market-section][data-market-section=enterprise-plugins]",
  "      ul[className=own-market-rows]",
  "        li[className=own-market-row][data-enterprise-plugin-package=ent-a][data-enterprise-plugin-state=ACTIVE]",
  "          div[className=own-market-rowLine]",
  "            span[className=own-market-rowIcon]",
  "              #opaque:[object Object]",
  "            div[className=own-market-rowMain]",
  "              span[className=own-market-cardHead]",
  "                span[className=own-market-cardId own-market-skillTitle]",
  "                  #text:ent-a",
  "                Tag[className=own-market-tag][tone=info]",
  "                  #text:企业",
  "                Tag[className=own-market-tag own-market-skillVersionTag][tone=neutral]",
  "                  #text:v1.2.0",
  "              span[className=own-market-cardDesc]",
  "                #text:企业插件分发的示例描述。",
  "            span[className=own-market-rowState]",
  "              StateDot[state=done]",
  "              #text:已安装 · 已启用",
  "            Switch[checked=true][label=启用 ent-a][disabled=false][title=点此停用][data-enterprise-plugin-slot=switch][onChange=[fn]]",
  "          div[className=own-market-inlineError][role=alert]",
  "            span[className=own-error-message][style=[object Object]]",
  "              #text:卸载失败：企业插件的信任配置不可用。",
  "            span[className=own-error-action][style=[object Object]]",
  "              #text:下一步：",
  "              #text:请联系企业管理员。",
  "            details[className=own-error-tech][style=[object Object]][data-enterprise-error-tech=ENT_PLUGIN_SIGNATURE_INVALID]",
  "              summary[style=[object Object]]",
  "                #text:技术信息",
  "              code[style=[object Object]][data-enterprise-error-code=ENT_PLUGIN_SIGNATURE_INVALID]",
  "                #text:ENT_PLUGIN_SIGNATURE_INVALID",
  "        li[className=own-market-row][data-enterprise-plugin-package=ent-b][data-enterprise-plugin-state=FAILED]",
  "          div[className=own-market-rowLine]",
  "            span[className=own-market-rowIcon]",
  "              #opaque:[object Object]",
  "            div[className=own-market-rowMain]",
  "              span[className=own-market-cardHead]",
  "                span[className=own-market-cardId own-market-skillTitle]",
  "                  #text:ent-b",
  "                Tag[className=own-market-tag][tone=info]",
  "                  #text:企业",
  "              span[className=own-market-cardDesc]",
  "                #text:已不在企业目录中",
  "            span[className=own-market-rowState]",
  "              StateDot[state=error]",
  "              #text:处理失败",
  "            Switch[checked=true][label=启用 ent-b][disabled=false][title=点此停用][data-enterprise-plugin-slot=switch][onChange=[fn]]",
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
 */
const LEGACY_STYLE_LENGTH = 12741
const LEGACY_STYLE_CHECKSUM = 2814388023

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
    expect(summary).toBe('企业插件 · 技能 · 配方')
    expect(summary).toContain('企业插件')
    // 「企业」标签（文案常量）不再以胶囊身份出现在描述行；描述行的「企业插件」是一个整词。
    expect(ENTERPRISE_MARKET_BADGE_TEXT).toBe('企业')
  })

  it('renders the description line as the plain 企业插件 · 技能 · 配方 text, with no tag on it at all', () => {
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
      // page 视图 = 一条页签条 + 三个面板；页签文案 = 基础词 + 计数（无数据时企业技能/企业插件为 0、
      // 组件恒为清单长度 3）——计数原先独占一行，现在并入页签（顶部压缩）。
      const text = textOf(page)
      for (const tab of ENTERPRISE_MARKET_TABS) expect(text, label).toContain(tab.label)
      expect(text, label).toContain(enterpriseMarketTabLabel('企业技能', 0))
      expect(text, label).toContain(enterpriseMarketTabLabel('企业插件', 0))
      expect(text, label).toContain(enterpriseMarketTabLabel('包含内容', ENTERPRISE_MARKET_COMPONENTS.length))
      // 卡片摘要仍只出现在 summary 视图（page 里一个字都不重复）。
      expect(text, label).not.toContain(ENTERPRISE_MARKET_SUMMARY)
    }
  })

  // 本刀的核心：page 视图顶部一条手写页签条，四个页签 + 四个面板严格配对，默认选中「企业技能」。
  // **本刀（企业配方页签）**：页签由三枚改四枚——「企业配方」插在**企业插件之后、包含内容之前**（用户指定的位次）。
  it('renders a hand-written tablist with the four page tabs and 企业技能 selected by default', () => {
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.id)).toEqual(['skills', 'plugins', 'presets', 'components'])
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label)).toEqual(['企业技能', '企业插件', '企业配方', '包含内容'])
    // 位次锁：配方在企业插件之后、包含内容之前（不是追加在末尾、也不是复用旧「应用商店」那批 id）。
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
      // 页签文案 = 基础词 + 紧凑计数（企业技能/企业插件无目录时如实为 0，组件 = 清单长度 3）：
      // 原先两节内部的独立计数行已删，数字并入页签（详情页顶部少一行）。
      expect(tabs.map(tab => tab['children']), label).toEqual(['企业技能 0', '企业插件 0', '企业配方 0', '包含内容 4'])
      expect(tabs.map(tab => tab['children']), label).toEqual(ENTERPRISE_MARKET_TABS.map(tab => enterpriseMarketTabLabel(
        tab.label,
        tab.id === 'components' ? ENTERPRISE_MARKET_COMPONENTS.length : 0,
      )))
      // 默认选中 + roving tabIndex（只有当前页签可 Tab 到，其余靠方向键）。
      expect(tabs.map(tab => tab['aria-selected']), label).toEqual([true, false, false, false])
      expect(tabs.map(tab => tab['tabIndex']), label).toEqual([0, -1, -1, -1])
    }
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
        // 页签条上只剩「企业配方 0」。配方行本身另有专门用例（preset 那一条）。
        expect(text, where).toContain(enterpriseMarketTabLabel('企业配方', 0))
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
  it('gates the badge on the plugin-market subject and renders the 企业 badge + version + package name (no 预览版, no switch)', () => {
    // subject 过滤：其余 subject 一律 null（hook 前就返回，不碰状态）。
    expect(EnterpriseMarketBadge({ subject: { kind: 'item', id: 'shell' } })).toBeNull()
    expect(EnterpriseMarketBadge({ subject: { kind: 'bundle', pkg: { name: 'x' } } })).toBeNull()
    // 纯呈现（BadgeView 不调 hook）：有版本 → 企业徽章 + 版本签 + 包名行；无版本 → 徽章 + 包名行。
    const withVersion = BadgeView({ version: '0.1.0' })
    expect(textOf(withVersion)).toContain('v0.1.0')
    expect(textOf(withVersion)).not.toContain('预览版')
    const tags = collectByClassName(withVersion, 'own-market-tag')
    expect(tags).toHaveLength(2)
    // 第 1 枚是「企业」徽章（h3 标题正后方），第 2 枚才是版本签。
    expect(tags.map(props => props['children'])).toEqual([ENTERPRISE_MARKET_BADGE_TEXT, 'v0.1.0'])
    expect(tags.map(props => props['tone'])).toEqual(['info', 'neutral'])
    // **「与官方实验性签样式一致」的可验证口径**：徽章是官方 `Tag` **原语本体的元素**（不是自绘 span），
    // tone 与官方「实验性」签同款 `info`，且官方公开面（tone/className/children）之外一个属性都不给。
    const tagElements = collectOfficialTagProps(withVersion)
    expect(tagElements).toHaveLength(2)
    expect(tagElements[0]).toEqual({ className: 'own-market-tag', tone: 'info', children: ENTERPRISE_MARKET_BADGE_TEXT })
    expect(Object.keys(tagElements[0] ?? {}).sort()).toEqual(['children', 'className', 'tone'])
    // **唯一渲染**：BadgeTag 直接调用出来的就是同一枚元素（详情页徽章与描述行胶囊共用这一份）。
    expect(collectOfficialTagProps(EnterpriseMarketBadgeTag())[0]).toEqual(tagElements[0])
    // 包名行照旧（本刀不动它：它是我们 badge 槽里换行的一行，不是官方 chrome 的字号/间距）。
    expect(collectByClassName(withVersion, 'own-market-badge-name')).toHaveLength(1)
    expect(textOf(withVersion)).toContain(ENTERPRISE_MARKET_ENTRY_ID)
    // 标题行只有签、无可拨开关（拨不动的开关像坏的，产品决策去掉）。
    expect(collectSwitchProps(withVersion)).toHaveLength(0)
    const withoutVersion = BadgeView({})
    expect(textOf(withoutVersion)).not.toContain('预览版')
    // 无版本时**只剩**企业徽章（版本签那一枚不在）。
    const bareTags = collectByClassName(withoutVersion, 'own-market-tag')
    expect(bareTags).toHaveLength(1)
    expect(bareTags[0]?.['children']).toBe(ENTERPRISE_MARKET_BADGE_TEXT)
    expect(bareTags[0]?.['tone']).toBe('info')
    expect(textOf(withoutVersion)).toContain(ENTERPRISE_MARKET_BADGE_TEXT)
    expect(textOf(withoutVersion)).not.toContain('v')
    // 版本签口径照官方 versionTag 'v{version}'。
    expect(enterpriseMarketVersionTag('1.2.3')).toBe('v1.2.3')
    expect(enterpriseMarketVersionTag(undefined)).toBeUndefined()
    expect(enterpriseMarketVersionTag('')).toBeUndefined()
  })

  // **反向锁（「企业标签不新增 CSS 类」）**：徽章与描述行胶囊只用官方原语 + 本文件**既有**的 `.own-market-tag`，
  // 源码里那个类的声明块仍然只有一条。（整份 `<style>` 的字节级基线已按**本刀**新增的进度动画
  // **再基线化**到 `LEGACY_STYLE_LENGTH` / `LEGACY_STYLE_CHECKSUM`——锁的形态没变，见那两个常量的注释。）
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
      expect(tabsRule, label).toContain('margin-top:0')
      expect(tabsRule, label).toContain('flex-wrap:nowrap')
      const sectionRule = cssRuleBody(css, '.own-market-section')
      expect(sectionRule, label).toContain('margin-top:12px')
      expect(sectionRule, label).not.toContain('margin-top:24px')
      expect(sectionRule, label).toContain('gap:12px')
      // 独立计数行退场：类规则整条删除（不留死样式），DOM 里也不再出现该容器。
      expect(cssRuleBody(css, '.own-market-sectionMeta'), label).toBe('')
      expect(collectByClassName(page, 'own-market-sectionMeta'), label).toEqual([])
      // 页签行高不变：单行 nowrap，13/20——计数并入文案后不换行、不撑高页签条。
      const tabRule = cssRuleBody(css, '.own-market-storeTab')
      expect(tabRule, label).toContain('white-space:nowrap')
      expect(tabRule, label).toContain('font-size:13px')
      expect(tabRule, label).toContain('line-height:20px')
      // 计数确实落在页签上（企业技能 1），且压缩没有动到节里的行内容。
      const tabs = collectByRole(page, 'tab')
      expect(tabs.map(tab => tab['children']), label).toEqual(['企业技能 1', '企业插件 0', '企业配方 0', '包含内容 4'])
      expect(collectSectionByHook(page, 'enterprise-skills'), label).not.toBeUndefined()
      // 行标题类名两套外壳**同源**（同一枚子块渲染同一串类名，版式统一的落点）：都是 9723a97 那套 `.own-market-cardId`。
      expect(collectByClassName(page, titleClass).map(props => props['children']), label).toEqual(['会议纪要技能组'])
    }
    // 纯投影口径：基础词 + 计数，页签文案不会被写成「N 个」那种长写法。
    expect(enterpriseMarketTabLabel('企业技能', 3)).toBe('企业技能 3')
    expect(enterpriseMarketTabLabel('包含内容', 3)).toBe('包含内容 3')
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
      expect(collectByRole(off, 'tab').map(tab => tab['children']), label).toEqual(['企业技能 0', '企业插件 0', '企业配方 0', '包含内容 4'])
      // ON：sessionUsable=true → 「插件」组件开启 → 出插件行 + 逐个包名 + 计数。
      const on = shell({ view: 'page', activeTab: 'plugins', sessionUsable: true, enterprisePlugins: enterprisePlugins as never })
      const text = textOf(on)
      expect(text, label).toContain('ent-a')
      expect(text, label).toContain('ent-b')
      // **第二行 = 插件描述**（本刀）：有描述说描述，没有描述如实降级。
      expect(text, label).toContain('把代码审查规则带进新会话。')
      expect(text, label).toContain('暂无描述')
      // **版本信息一个字都没丢**：它从第二行搬到了标题行那枚短号签上（`v{version}` 仍是官方 badge 槽同一枚字面），
      // 而旧第二行的那句「企业发布 · v…」作为**行上文案**已经退场（组件清单里的说明文字另有出处，不在行上）。
      expect(text, label).toContain('v1.2.0')
      expect(text, label).toContain('v2.0.0')
      expect(text, label).not.toContain('企业发布 · v')
      // 标题行的两枚签与技能行**同款同枚**：企业签（info）+ 版本短号签（neutral），类名照技能那一串。
      const heads = collectByClassName(on, 'own-market-cardHead')
      expect(heads, label).toHaveLength(2)
      const tags = collectOfficialTagProps(collectSectionByHook(on, 'enterprise-plugins'))
      expect(tags.map(props => props['children']), label)
        .toEqual(['企业', 'v1.2.0', '企业', 'v2.0.0'])
      expect(tags.map(props => props['tone']), label).toEqual(['info', 'neutral', 'info', 'neutral'])
      expect(tags[1]?.['className'], label).toBe('own-market-tag own-market-skillVersionTag')
      // 计数已并入页签文案（原先节内那行独立的 `2 个` 已删）：这里锁「企业插件 2」。
      expect(text, label).toContain(enterpriseMarketTabLabel('企业插件', 2))
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
  it('renders the skill tab with the official Switch as the row primary control in both shells', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    for (const { label, shell, titleClass, descClass } of MARKET_SHELLS) {
      // OFF：sessionUsable=false → 「技能」组件未开启 → 默认页签里什么内容都没有（节容器都不出）。
      const off = shell({ view: 'page', sessionUsable: false, enterpriseSkills })
      expect(collectSectionByHook(off, 'enterprise-skills'), label).toBeUndefined()
      expect(textOf(off), label).not.toContain('会议纪要技能组')
      // ON：两行文案 + 计数（原先那行独立的 `1 个` 已删，计数并入页签文案 `企业技能 1`）。
      const on = shell({ view: 'page', sessionUsable: true, enterpriseSkills })
      const text = textOf(on)
      expect(text, label).toContain(enterpriseMarketTabLabel('企业技能', 1))
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
      const switches = collectSwitchProps(on)
      expect(switches, label).toHaveLength(1)
      const skillSwitch = switches.find(props => String(props['label']).includes('会议纪要技能组'))
      expect(skillSwitch, label).toBeDefined()
      // 未注入动作即禁用（不提供假入口），但语义照旧是「安装」方向。
      expect(skillSwitch?.['checked'], label).toBe(false)
      expect(skillSwitch?.['disabled'], label).toBe(true)
      expect(skillSwitch?.['label'], label).toBe('安装企业技能 会议纪要技能组')
      // 数据钩子命名与企业插件节同风格（`enterprise-skills`）；别页签的节不在树上。
      expect(collectSectionByHook(on, 'enterprise-skills'), label).not.toBeUndefined()
      expect(collectSectionByHook(on, 'enterprise-plugins'), label).toBeUndefined()
      // 受管态仍如实落在行上（`AVAILABLE` = 未装可装，那枚开关据此关闭）。
      expect(collectDataValues(on, 'data-enterprise-skill-state'), label).toEqual(['AVAILABLE'])
      // 注入动作后开关可拨：拨一次即把 (row, next=true) 交给调用方（= 一键安装）。
      const onToggleSkill = vi.fn()
      const wired = shell({ view: 'page', sessionUsable: true, enterpriseSkills, onToggleSkill })
      const wiredSwitch = collectSwitchProps(wired).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(wiredSwitch['disabled'], label).toBe(false)
      expect(wiredSwitch['title'], label).toBe('点此安装到 ~/.dsh/skills')
      wiredSwitch['onChange']?.(true)
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
    expect(cssRuleBody(legacyCss, '.own-market-cardId')).toContain('font-size:14px')
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
  it('adds a version tag and an optional category tag to the skill title row', () => {
    // 两枚签的取值、tone、顺序与「分类缺席即整枚不渲染」在两套外壳里必须一模一样（同一份 facts + 同一份 head 容器）。
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
      })
      // 版本签：**可见文案是短号**（`enterpriseMarketSkillVersionLabel`，含 `@` 取最后一个 `@` 之后；
      // 本 fixture 无 `@` 故与原值同形——完整坐标那一路由下面两条坐标用例锁死）。
      // 仍不加 `v` 前缀（那是详情页 badge 的口径），复用官方 `Tag` 原语 + 既有 `.own-market-tag` 定位。
      const versionTags = collectByClassName(tree, 'own-market-skillVersionTag')
      expect(versionTags, label).toHaveLength(1)
      expect(versionTags[0]?.['children'], label).toBe(enterpriseMarketSkillVersionLabel(SKILL_WITH_CATEGORY.sourceDshVersion))
      expect(versionTags[0]?.['children'], label).toBe('0.1.7-rc.2')
      expect(versionTags[0]?.['tone'], label).toBe('neutral')
      expect(String(versionTags[0]?.['className']), label).toContain('own-market-tag')
      // 分类签：有分类才出，文案照原值。
      const categoryTags = collectByClassName(tree, 'own-market-skillCategoryTag')
      expect(categoryTags, label).toHaveLength(1)
      expect(categoryTags[0]?.['children'], label).toBe('研发工具')
      expect(categoryTags[0]?.['tone'], label).toBe('info')
      // 顺序锁：两枚签都在**标题那一行**的 head 容器里，且严格排在标题**之后**（标题 → 版本签 → 分类签）。
      // 版本签外面包着一枚**只承载完整坐标 title** 的节点（官方 Tag 只吃 tone/className/children），
      // 故第 2 格是那枚包装节点、它的唯一子节点才是版本签本体（位置没变，仍是紧随标题、排在分类签之前）。
      const head = collectByClassName(tree, 'own-market-cardHead')[0]
      const headKids = head?.['children'] as ReactNode[]
      expect(headKids, label).toHaveLength(3)
      expect(isValidElement(headKids[0]) ? (headKids[0].props as Record<string, unknown>)['children'] : undefined, label).toBe('会议纪要技能组')
      const headVersionHint = headKids[1] as { props?: Record<string, unknown> } | undefined
      expect(String(headVersionHint?.props?.['className']), label).toBe('own-market-skillVersionHint')
      expect(headVersionHint?.props?.['title'], label).toBe('0.1.7-rc.2')
      expect(textOf(headKids[1] as ReactNode), label).toBe('0.1.7-rc.2')
      expect(isValidElement(headKids[2]) ? (headKids[2].props as Record<string, unknown>)['children'] : undefined, label).toBe('研发工具')
      // 恒只有那枚官方 Switch；未装行不出辅助标签。
      expect(collectSwitchProps(tree).map(props => String(props['label'])), label).toEqual(['安装企业技能 会议纪要技能组'])
      expect(collectTagProps(tree), label).toEqual([])
      // 分类缺席（undefined）/ 空串：**分类签不出现**（安静缺席是预期行为，绝不塞占位文案）；
      // 版本签与其余内容照旧在（少一枚分类签不动别的）。
      for (const skills of [
        enterpriseMarketSkillRows([SKILL]),
        enterpriseMarketSkillRows([{ ...SKILL, category: '' }]),
      ]) {
        const bare = shell({ view: 'page', sessionUsable: true, enterpriseSkills: skills })
        expect(collectByClassName(bare, 'own-market-skillCategoryTag'), label).toEqual([])
        expect(collectByClassName(bare, 'own-market-skillVersionTag'), label).toHaveLength(1)
        // 分类签那一格是 `null`（不渲染），故 head 里**元素**只剩标题 + 版本签两枚。
        const bareKids = (collectByClassName(bare, 'own-market-cardHead')[0]?.['children'] as ReactNode[])
          .filter(child => child !== null && child !== undefined)
        expect(bareKids, label).toHaveLength(2)
        expect(isValidElement(bareKids[0]) ? (bareKids[0].props as Record<string, unknown>)['children'] : undefined, label).toBe('会议纪要技能组')
        // 版本签本体在包装节点里：可见文案照旧、完整坐标照旧挂在包装节点的 title 上。
        expect(textOf(bareKids[1] as ReactNode), label).toBe('0.1.7-rc.2')
        expect((bareKids[1] as { props?: Record<string, unknown> }).props?.['title'], label).toBe('0.1.7-rc.2')
      }
    }
    // 第 2 行描述不受标签影响：两套外壳共用同一枚子块、同一枚 `.own-market-cardDesc`（与旧外壳一字不差）。
    const store = EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL_WITH_CATEGORY]),
    })
    expect(collectByClassName(store, 'own-market-cardDesc').map(props => props.children))
      .toEqual(['把会议录音与转写整理成结构化纪要。'])
    // 纯投影：缺席/null/空串/纯空白都归一成 undefined（标题行标签的最后一道防线），有值原样返回。
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
  it('shows only the version segment in the row tag while the full coordinate stays on the tag title and in the detail', () => {
    const COORDINATE = 'skillhub.cn/dev-expert@2.0.3'
    for (const { label, shell } of MARKET_SHELLS) {
      const tree = shell({
        view: 'page', sessionUsable: true,
        enterpriseSkills: enterpriseMarketSkillRows([{ ...SKILL, sourceDshVersion: COORDINATE }]),
      })
      // ① 行上签的**可见文案 = 短号**（不再是 `sourceDshVersion` 整串）；tone 与类名一字未动。
      const versionTags = collectByClassName(tree, 'own-market-skillVersionTag')
      expect(versionTags, label).toHaveLength(1)
      expect(versionTags[0]?.['children'], label).toBe('2.0.3')
      expect(versionTags[0]?.['tone'], label).toBe('neutral')
      expect(String(versionTags[0]?.['className']), label).toContain('own-market-tag')
      // ② 签上有**完整坐标**（悬停可见）：承载 title 的那枚节点必须**紧包**版本签本体，
      //    且整串坐标不再作为可见文本出现（它正是把标题挤成一个字的那一段）。
      const hint = collectByClassName(tree, 'own-market-skillVersionHint')[0]
      expect(hint, label).toBeDefined()
      expect(hint?.['title'], label).toBe(COORDINATE)
      const hintKids = flattenElements(hint?.['children'] as ReactNode)
      expect(hintKids, label).toHaveLength(1)
      expect(isValidElement(hintKids[0]) ? (hintKids[0].props as Record<string, unknown>)['className'] : undefined, label)
        .toBe('own-market-tag own-market-skillVersionTag')
      expect(textOf(hintKids[0] as ReactNode), label).toBe('2.0.3')
      expect(textOf(tree), label).not.toContain(COORDINATE)
      // 位置不变：标题行里仍是「标题 → 版本签（包装节点）→（无分类时到此处就结束）」。
      const headKids = ((collectByClassName(tree, 'own-market-cardHead')[0]?.['children'] ?? []) as ReactNode[])
        .filter(child => child !== null && child !== undefined)
      expect(headKids, label).toHaveLength(2)
      expect(textOf(headKids[0] as ReactNode), label).toBe('会议纪要技能组')
      // ③ 详情页那枚徽标照旧显示**完整坐标**（详情信息更全，只有列表需要短号）：同一份 facts 供两处。
      const detailRow = enterpriseMarketSkillRows([{ ...SKILL, sourceDshVersion: COORDINATE }])[0]!
      const detailFacts = enterpriseMarketSkillRowFacts(
        { view: 'page', sessionUsable: true, enterpriseSkills: [detailRow] }, detailRow,
      )
      expect(detailFacts.versionTag, label).toBe(COORDINATE)
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
      expect((lineKids[1] as { type?: unknown }).type, label).toBe(Switch as unknown)
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
  it('renders the auxiliary update label left of the switch only when an update exists', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      // 未装行：不出现。
      const notInstalled = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], onToggleSkill })
      expect(collectTagProps(notInstalled), label).toEqual([])
      // 已装且与中心同版本：不出现。
      const current = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        installedSkills: [installedSkill(SKILL_DETAIL.versionId)], onToggleSkill,
      })
      expect(collectTagProps(current), label).toEqual([])
      // 已装旧版本：出现，文案/无障碍名/悬浮说明按投影给。
      const tree = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated], onToggleSkill })
      const tags = collectTagProps(tree)
      expect(tags, label).toHaveLength(1)
      expect(tags[0], label).toMatchObject({
        type: 'button',
        'data-enterprise-skill-tag': 'UPDATE_AVAILABLE',
        'aria-label': '更新企业技能 会议纪要技能组',
        title: '点此更新到中心当前版本',
        disabled: false,
        children: ENTERPRISE_MARKET_SKILL_UPDATE_LABEL,
      })
      // 点击 = 安装中心当前版本（`next=true`），不是卸载、也不是 no-op。
      tags[0]?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: updatable.id }), true)
      // 顺序锁：标签严格排在 Switch **左侧**（开关仍是该行主控件，不许反过来）——两套外壳同一枚 rowLine。
      const kids = rowLineChildren(tree, updatable.id)
      const order = actionOrder(kids)
      expect(order.tag, label).toBeGreaterThanOrEqual(0)
      expect(order.switch, label).toBeGreaterThan(order.tag)
      // 有更新时行上的受管态钩子如实报 `UPDATE_AVAILABLE`；那枚开关仍开着（盘上装着旧版本）、可拨（拨下去 = 卸载）。
      expect(collectDataValues(tree, 'data-enterprise-skill-state'), label).toEqual(['UPDATE_AVAILABLE'])
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(true)
      expect(skillSwitch['label'], label).toBe('卸载企业技能 会议纪要技能组')
      expect(skillSwitch['disabled'], label).toBe(false)
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
  it('keeps the update label visible but disabled while the row is busy', () => {
    const updatable = updatableRow()
    const outdated = installedSkill('1902500000000000100')
    for (const { label, shell } of MARKET_SHELLS) {
      const busyUpdate = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
        pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
      })
      const tags = collectTagProps(busyUpdate)
      expect(tags, label).toHaveLength(1)
      expect(tags[0]?.['disabled'], label).toBe(true)
      // 未装行在途（正在做首次安装）：右侧就一个 Switch，不出现辅助标签。
      const busyFresh = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        pendingSkill: { packageId: updatable.id, next: true }, onToggleSkill: vi.fn(),
      })
      expect(collectTagProps(busyFresh), label).toEqual([])
      // 没有动作回调（未登录/无 store）时标签禁用，但语义仍是「更新」。
      const unwired = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable], installedSkills: [outdated],
      })
      expect(collectTagProps(unwired)[0], label).toMatchObject({ disabled: true, title: '企业账号未登录，暂不可操作' })
    }
  })

  // 开关各态在真实树上的落点：`checked`/`disabled` + `label` 动作语义 + 行上的 `data-enterprise-skill-state` 一致
  // （未装 / 已装 / 有更新 / 安装中 / 卸载中）。
  it('renders the skill-row switch states on the row with matching data hooks', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    const onToggleSkill = vi.fn()
    const cases: readonly {
      readonly name: string
      readonly installedSkills?: readonly EnterpriseInstalledSkill[]
      readonly pendingSkill?: { readonly packageId: string, readonly next: boolean }
      readonly state: string
      readonly label: string
      readonly checked: boolean
      readonly disabled: boolean
    }[] = [
      { name: '未装', state: 'AVAILABLE', label: '安装企业技能 会议纪要技能组', checked: false, disabled: false },
      { name: '已装', installedSkills: [installedSkill('v2')], state: 'INSTALLED', label: '卸载企业技能 会议纪要技能组', checked: true, disabled: false },
      { name: '安装中', pendingSkill: { packageId: row.id, next: true }, state: 'INSTALLING', label: '安装企业技能 会议纪要技能组', checked: false, disabled: true },
      { name: '卸载中', installedSkills: [installedSkill('v2')], pendingSkill: { packageId: row.id, next: false }, state: 'REMOVING', label: '卸载企业技能 会议纪要技能组', checked: true, disabled: true },
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
        const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
        expect(skillSwitch['label'], where).toBe(item.label)
        expect(skillSwitch['checked'], where).toBe(item.checked)
        // 在途禁用（并发动作会互相覆盖已装清单），其余一律可拨。
        expect(skillSwitch['disabled'], where).toBe(item.disabled)
        // 行上的受管态钩子仍如实报态（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）。
        expect(collectDataValues(tree, 'data-enterprise-skill-state'), where).toEqual([item.state])
      }
      // 第五态「有更新」：行上带中心当前版本、本机装着旧版本 → 开关照旧开着且可拨（拨下去 = 卸载）。
      const updatable = updatableRow()
      const outdatedTree = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatable],
        installedSkills: [installedSkill('1902500000000000100')], onToggleSkill,
      })
      expect(collectDataValues(outdatedTree, 'data-enterprise-skill-state'), shellLabel).toEqual(['UPDATE_AVAILABLE'])
      const outdatedSwitch = collectSwitchProps(outdatedTree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(outdatedSwitch['checked'], shellLabel).toBe(true)
      expect(outdatedSwitch['disabled'], shellLabel).toBe(false)
      expect(outdatedSwitch['label'], shellLabel).toBe('卸载企业技能 会议纪要技能组')
    }
  })

  // 一键安装/卸载：开关在两个方向上都把 (row, next) 交给 onToggleSkill —— 未装拨上 = true，已装拨下 = false。
  it('toggles the skill action from the switch in both directions', () => {
    const row = enterpriseMarketSkillRows([SKILL])[0]!
    for (const { label, shell } of MARKET_SHELLS) {
      const onToggleSkill = vi.fn()
      const installable = shell({ view: 'page', sessionUsable: true, enterpriseSkills: [row], onToggleSkill })
      const installSwitch = collectSwitchProps(installable).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(installSwitch['checked'], label).toBe(false)
      expect(installSwitch['label'], label).toBe('安装企业技能 会议纪要技能组')
      installSwitch['onChange']?.(true)
      expect(onToggleSkill, label).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), true)

      // 已装：开关是打开的，拨下去即卸载（`next=false`）。
      const installed = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [row], installedSkills: [installedSkill('v2')], onToggleSkill,
      })
      const installedSwitch = collectSwitchProps(installed).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(installedSwitch['checked'], label).toBe(true)
      expect(installedSwitch['label'], label).toBe('卸载企业技能 会议纪要技能组')
      expect(installedSwitch['title'], label).toBe('点此卸载')
      installedSwitch['onChange']?.(false)
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
      // 失败没留下乐观已装：开关仍是「未装」态且可拨，拨上去就是重试。
      const skillSwitch = collectSwitchProps(failed).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(false)
      expect(skillSwitch['disabled'], label).toBe(false)
      skillSwitch['onChange']?.(true)
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
      // 两行开关都在（一关一开）、都没被提示禁用（失败行可重试，正常行不受牵连）。
      const switches = collectSwitchProps(tree).filter(props => String(props['label']).includes('企业技能'))
      expect(switches, label).toHaveLength(2)
      expect(switches[0]?.['checked'], label).toBe(false)
      expect(switches[1]?.['checked'], label).toBe(true)
      expect(switches[0]?.['disabled'], label).toBe(false)
      expect(switches[1]?.['disabled'], label).toBe(false)
    }
  })

  // 回归锁（本轮改动的边界）：技能行右侧 = 官方 Switch（**始终在**）＋仅在有更新时出现的辅助标签，
  // 企业插件行的开关口径**完全未动**（同样一枚 Switch）。两行各在自己的页签里，故分两次渲染锁同一批语义。
  it('gives the skill row a Switch again and leaves the plugin row switch untouched', () => {
    const enterpriseSkills = enterpriseMarketSkillRows([SKILL])
    const enterprisePlugins = [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as const
    for (const { label, shell } of MARKET_SHELLS) {
      const onTogglePluginEnabled = vi.fn()
      // 「企业插件」页签：插件行照旧「状态点 + 文案 + Switch」，checked/title/onChange 口径一字未改。
      const pluginsTab = shell({
        view: 'page',
        activeTab: 'plugins',
        sessionUsable: true,
        enterprisePlugins: enterprisePlugins as never,
        onTogglePluginEnabled,
      })
      const pluginSwitch = collectSwitchProps(pluginsTab).find(props => props['label'] === '启用 ent-a')!
      expect(collectSwitchProps(pluginsTab).map(props => String(props['label'])), label).toEqual(['启用 ent-a'])
      expect(pluginSwitch['checked'], label).toBe(true)
      // ★ 已安装 + 启用着：关掉它是**停用**，所以那句悬浮说明是「点此停用」，不是「点此卸载」。
      expect(pluginSwitch['title'], label).toBe('点此停用')
      expect(pluginSwitch['disabled'], label).toBe(false)
      pluginSwitch['onChange']?.(false)
      expect(onTogglePluginEnabled, label).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'ent-a' }), false)
      // 「企业技能」页签：已装同版本行（行上没有中心版本 → 不判更新）右侧只有那枚开关：
      // 不出辅助标签、也没有 `data-enterprise-skill-tag` 钩子；技能行未占 rowState 版式（那是组件行的状态点位）。
      const skillsTab = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        installedSkills: [installedSkill('v2')],
        onToggleSkill: vi.fn(),
      })
      expect(collectSwitchProps(skillsTab).map(props => String(props['label'])), label).toEqual(['卸载企业技能 会议纪要技能组'])
      expect(collectByClassName(skillsTab, 'own-market-skillTag'), label).toEqual([])
      expect(collectDataValues(skillsTab, 'data-enterprise-skill-tag'), label).toEqual([])
      expect(collectDataValues(skillsTab, 'data-enterprise-skill-state'), label).toEqual(['INSTALLED'])
      // 技能行不使用组件行那套 `.own-market-rowState`（旧外壳只在插件行用它）。
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
      // 成功路径上开关只是如实反映 Host 真值（已装 → 打开）。
      const tree = shell({
        view: 'page',
        sessionUsable: true,
        enterpriseSkills,
        installedSkills: [installedSkill('v1')],
        onToggleSkill: vi.fn(),
      })
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(true)
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
      // 默认态下技能行那枚开关就在树上（未装 → 关闭）。
      const skillSwitch = collectSwitchProps(tree).find(props => String(props['label']).includes('会议纪要技能组'))!
      expect(skillSwitch['checked'], label).toBe(false)
      expect(skillSwitch['disabled'], label).toBe(true)
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
      // 行 = 通栏行（行底 0.5px 分隔线 + 40×40 图标框 + 两行文案），不是卡片。
      expect(cssRuleBody(css, '.own-market-rows'), label).toContain('display:flex')
      expect(cssRuleBody(css, '.own-market-row'), label).toContain('border-bottom:0.5px solid')
      expect(cssRuleBody(css, '.own-market-rowLine'), label).toContain('display:flex')
      expect(cssRuleBody(css, '.own-market-rowIcon'), label).toContain('width:40px')
      expect(cssRuleBody(css, '.own-market-rowMain'), label).toContain('flex-direction:column')
      const rowId = cssRuleBody(css, '.own-market-cardId')
      expect(rowId, label).toContain('font-size:14px')
      expect(rowId, label).toContain('font-weight:500')
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
      // 动作**常显**：两行各一枚官方 Switch，且各自落在本行的 `.own-market-rowLine` 里。
      expect(collectSwitchProps(tree).map(props => String(props['label']))).toEqual([
        '安装企业技能 会议纪要技能组',
        '安装企业技能 代码评审技能组',
      ])
      const lines = collectByClassName(tree, 'own-market-rowLine')
      expect(lines).toHaveLength(2)
      for (const line of lines) {
        // 展开共享动作子块后，行线上直接看得见那枚官方 Switch（动作没有被搬进可点按钮里）。
        const kids = flattenElements(line['children'] as ReactNode)
        expect(kids.some(child => isValidElement(child) && child.type === (Switch as unknown))).toBe(true)
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
    expect(collectSwitchProps(plugins).map(props => String(props['label']))).toEqual(['启用 ent-a'])
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
    expect(collectTagProps(kids)).toHaveLength(1)
    expect(collectSwitchProps(kids)).toHaveLength(1)
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
    expect(collectSwitchProps(pluginKids)).toHaveLength(1)
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
    // 技能行的「已装与否」由官方 `Switch.checked` 承载、「有更新」由那枚辅助标签承载（事实仍在行上，
    // 见 `data-enterprise-skill-state` 与下面的在途断言）；插件行则**恒出**「状态点 + 官方状态词」（点与词成对）。
    for (const { label, shell } of MARKET_SHELLS) {
      const skills = shell({ view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]), onToggleSkill: vi.fn() })
      expect(collectStateDotProps(skills), label).toEqual([])
      expect(collectByClassName(skills, 'own-market-configTag'), label).toEqual([])
      expect(collectByClassName(skills, 'own-market-rowStatus'), label).toEqual([])
      expect(collectDataValues(skills, 'data-enterprise-skill-state'), label).toEqual(['AVAILABLE'])
      // 未装行的开关：`checked=false`、可拨（行仍由 switch 主控）。
      expect(collectSwitchProps(skills)[0]?.['checked'], label).toBe(false)
      // 在途：受管态如实报在途，但**不**因为「在途」而在技能行多长出一枚状态点/一行状态文字。
      const busy = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: enterpriseMarketSkillRows([SKILL]),
        pendingSkill: { packageId: SKILL.id, next: true }, onToggleSkill: vi.fn(),
      })
      expect(collectStateDotProps(busy), label).toEqual([])
      expect(collectByClassName(busy, 'own-market-rowStatus'), label).toEqual([])
      expect(collectDataValues(busy, 'data-enterprise-skill-state'), label).toEqual(['INSTALLING'])
      // 已装旧版本：`UPDATE_AVAILABLE` 如实落在行上，辅助标签出现（状态词不再另说一句）。
      const outdated = shell({
        view: 'page', sessionUsable: true, enterpriseSkills: [updatableRow()],
        installedSkills: [installedSkill('1902500000000000100')], onToggleSkill: vi.fn(),
      })
      expect(collectDataValues(outdated, 'data-enterprise-skill-state'), label).toEqual(['UPDATE_AVAILABLE'])
      expect(collectTagProps(outdated), label).toHaveLength(1)
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
    // ① 标题行：标题 + 版本签 + 分类签（分类缺席时那一格是 null，不塞占位）。
    expect((collectByClassName(tree, 'own-market-cardHead')[0]?.['children'] as ReactNode[])).toHaveLength(3)
    expect(collectByClassName(tree, 'own-market-skillVersionTag')).toHaveLength(1)
    // ②③④ 三件事都在**行内**（同一个 rowLine 里）：有更新按钮 + 官方 Switch + role="alert" 各恰好一件。
    expect(collectTagProps(tree)).toHaveLength(1)
    expect(collectSwitchProps(tree)).toHaveLength(1)
    expect(collectAlerts(tree)).toHaveLength(1)
    // 行内**没有**展开区/卡片网格/搜索框（那三件是新外观的落点）。
    expect(collectByClassName(tree, 'own-market-cardDetails')).toEqual([])
    expect(collectByClassName(tree, 'own-market-cardShell')).toEqual([])
    expect(collectByClassName(tree, 'own-market-cardGrid')).toEqual([])
    expect(collectByClassName(tree, 'own-market-catalogSearch')).toEqual([])
    // 辅助动作严格排在 Switch **左侧**（开关仍是主控件）。
    const lineKids = rowLineChildren(tree, row.id)
    const order = actionOrder(lineKids)
    expect(order.tag).toBeGreaterThanOrEqual(0)
    expect(order.switch).toBeGreaterThan(order.tag)
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
    // ③「有更新」判定：同一行判更新时那枚辅助动作出现，点击走安装方向（行 facts 是唯一判定点）。
    const tree = EnterpriseMarketLegacyShell(props)
    const tag = collectTagProps(tree)
    expect(tag).toHaveLength(1)
    expect(tag[0]?.['aria-label']).toBe(enterpriseMarketSkillUpdateTag(props.enterpriseSkills[0]!.displayName).ariaLabel)
    expect(enterpriseMarketSkillRowFacts(props, props.enterpriseSkills[0]!).hasUpdate).toBe(true)
    // ④ 失败码：行上的 role="alert" 文案（前缀 + 稳定码）取自同一份投影。
    expect(textOf(collectAlerts(tree)[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // ⑤ 行级 facts 只有一份：渲染出的开关 checked/disabled/label 与 facts 逐项相等。
    const facts = enterpriseMarketSkillRowFacts(props, props.enterpriseSkills[0]!)
    for (const { label, shell } of MARKET_SHELLS) {
      const shellTree = shell(props)
      const skillSwitch = collectSwitchProps(shellTree).find(item => String(item['label']).includes('企业技能'))!
      expect(skillSwitch['checked'], label).toBe(facts.enabled)
      expect(skillSwitch['disabled'], label).toBe(props.onToggleSkill === undefined || facts.busy)
      expect(collectDataValues(shellTree, 'data-enterprise-skill-state'), label).toEqual([facts.state])
      // ⑥ 组件清单投影一致（四行、仅配方预留、资料库在本机开关上）——要切到「组件」页签才挂载那一节。
      expect(collectDataValues(shell({ ...props, activeTab: 'components' }), 'data-market-component'), label)
        .toEqual(['plugins', 'skills', 'presets', 'library'])
    }
    // ⑦ 源码级不变量：逻辑入口各只有一处定义 + 恰好一处调用；动作接线各只有一份。
    // 只看**代码**（剥掉注释）——否则文档里提到同一个标识符就会被误计一次。
    const source = stripComments(await readFile(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8'))
    const count = (re: RegExp): number => (source.match(re) ?? []).length
    // 模型：1 处定义 + 外壳 1 处调用 = 2。
    expect(count(/enterpriseMarketShellModel\(/g)).toBe(2)
    // 行 facts 唯一入口：1 处定义 + 共享行子块 `EnterpriseMarketInlineRows` 1 处 + 详情子页面的输入构造 1 处 = 3
    //（详情与行共用同一枚函数，故详情里的动作不可能另算一份事实）。
    expect(count(/enterpriseMarketSkillRowFacts\(/g)).toBe(3)
    expect(count(/enterpriseMarketPluginRowFacts\(/g)).toBe(2)
    // 安装/卸载动作接线各只有一份（复制逻辑会在这里翻倍）。
    expect(count(/\.installPlugin\(/g)).toBe(1)
    // 插件行**没有**卸载动作：卸载只在「企业设置 → 插件」的详情弹窗里，故本文件一次都不该出现它。
    expect(count(/\.removePlugin\(/g)).toBe(0)
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
    // 反向锁：本文件里 `own-market-rows` 只有五处**显式**铺设点，且都在既有结构里——
    // 目录行子块的三枚页签（技能/插件/配方）各一处、组件清单那一处、配方详情「这份配方包含」的分组各一处；
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

      // ② 点 `[有更新]` 与拨 `Switch` **不**打开详情，动作照常触发。
      onOpenSkillDetail.mockClear()
      const tag = collectByDataProp(tree, 'data-enterprise-skill-tag', ENTERPRISE_MARKET_SKILL_UPDATE_TAG)[0] as { props?: Record<string, any> } | undefined
      expect(tag, label).toBeDefined()
      tag?.props?.['onClick']?.()
      expect(onToggleSkill, label).toHaveBeenCalledWith(skill, true)
      const skillSwitch = collectSwitchProps(tree)[0]!
      skillSwitch['onChange']?.(false)
      expect(onToggleSkill, label).toHaveBeenCalledWith(skill, false)
      expect(onOpenSkillDetail, label).not.toHaveBeenCalled()

      // ②b 结构性保证（不靠 stopPropagation）：两个动作是行本体那枚按钮的**同级兄弟**，不在它内部；
      //     行线/li 自身也没有 onClick。
      const buttonChildren = flattenElements(open?.props?.['children'] as ReactNode)
      expect(buttonChildren.some(child => isValidElement(child) && child.type === (Switch as unknown)), label).toBe(false)
      expect(
        buttonChildren.some(child => isValidElement(child) && (child.props as Record<string, unknown>)['data-enterprise-skill-tag'] !== undefined),
        label,
      ).toBe(false)
      const rowNode = collectByDataProp(tree, 'data-enterprise-skill-package', skill.id)[0] as { props?: Record<string, any> } | undefined
      expect(rowNode?.props?.['onClick'], label).toBeUndefined()
      const line = collectByClassName(rowNode?.props?.['children'] as ReactNode, 'own-market-rowLine')[0]
      expect(line?.['onClick'], label).toBeUndefined()
      // 行线上的同级子元素顺序：行本体 → [有更新] → Switch（动作没被搬走、也没被藏起来）。
      const lineKids = rowLineChildren(tree, skill.id)
      expect(lineKids, label).toHaveLength(3)
      expect(String((lineKids[0] as { props?: Record<string, unknown> }).props?.['className']), label).toBe('own-market-rowOpen')
      expect((lineKids[2] as { type?: unknown }).type, label).toBe(Switch as unknown)

      // 点击提示的取值锁：光标 + hover 高亮 + focus 环（照本文件既有官方口径，不新造视觉）。
      const css = collectStyleText(tree)
      expect(cssRuleBody(css, '.own-market-rowOpen'), label).toContain('cursor:pointer')
      expect(cssRuleBody(css, '.own-market-rowOpen'), label).toContain('display:flex')
      expect(cssRuleBody(css, '.own-market-rowOpen'), label).toContain('flex:1')
      expect(cssRuleBody(css, '.own-market-rowOpen:focus-visible'), label).toContain('outline:')
      // 回调缺席时是 disabled：光标必须收回（否则「看着能点、点了没反应」）。
      expect(cssRuleBody(css, '.own-market-rowOpen:disabled'), label).toContain('cursor:default')
      // hover 高亮那条规则有两条选择器（标题 + 描述），故直接锁规则原文而不走单选择器取值器。
      expect(css, label).toContain('.own-market-rowOpen:hover .own-market-cardId')
      expect(css, label).toContain('color:var(--dsw-alias-accent-primary')
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
    expect(source).toContain('onOpenSkillDetail: (row) => { setSkillDetailId(row.id); setPresetDetailId(undefined) }')
    // 配方详情目标与技能详情目标**互斥**（同一时刻只可能有一个非空，故外壳那两支 return 不可能同时命中）。
    expect(source).toContain('onOpenPresetDetail: (row) => { setPresetDetailId(row.id); setSkillDetailId(undefined) }')
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
    // 头部：图标框 + 动作区（官方 `_detailHead` = icon + actions，两端对齐）。
    expect(collectByClassName(tree, 'own-market-detailTop')).toHaveLength(1)
    expect(collectByClassName(tree, 'own-market-detailHead')).toHaveLength(1)
    expect(collectByClassName(tree, 'own-market-detailIcon')).toHaveLength(1)
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
    // 版本徽标只在 titleRow 那一处；行上那枚「有更新」辅助动作在详情里照旧恰好一枚（动作同源，不重复挂）。
    expect(collectTagProps(tree)).toHaveLength(1)
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
    // ⑥ 取值逐条照官方 CSS module（_detailTop / _crumb / _detailHead / _cardIcon / _detailMain / _detailTitle /
    //    _detailName / _detailDesc / _detailSections / _detailSection），本文件只是把那几条抄进 `detailStyles`。
    const css = collectStyleText(styled)
    expect(cssRuleBody(css, '.own-market-detailTop')).toContain('padding-top:28px')
    expect(cssRuleBody(css, '.own-market-crumb')).toContain('font-size:12.5px')
    expect(cssRuleBody(css, '.own-market-crumb')).toContain('gap:6px')
    expect(cssRuleBody(css, '.own-market-crumb:focus-visible')).toContain('outline:')
    expect(cssRuleBody(css, '.own-market-crumbIcon')).toBe('transform:rotate(90deg)')
    expect(cssRuleBody(css, '.own-market-detailHead')).toContain('margin:32px 0 0')
    expect(cssRuleBody(css, '.own-market-detailHead')).toContain('justify-content:space-between')
    expect(cssRuleBody(css, '.own-market-detailIcon')).toContain('width:48px')
    expect(cssRuleBody(css, '.own-market-detailIcon')).toContain('height:48px')
    expect(cssRuleBody(css, '.own-market-detailIcon')).toContain('border:.5px solid var(--dsw-alias-border-l3')
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
    const rowSwitch = collectSwitchProps(rowTree).find(props => String(props['label']).includes('企业技能'))!
    const detailSwitch = collectSwitchProps(detailTree)[0]!
    expect(detailSwitch['checked']).toBe(rowSwitch['checked'])
    expect(detailSwitch['label']).toBe(rowSwitch['label'])
    expect(detailSwitch['disabled']).toBe(rowSwitch['disabled'])
    const rowTag = collectTagProps(rowTree)[0]!
    const detailTag = collectTagProps(detailTree)[0]!
    expect(detailTag['data-enterprise-skill-tag']).toBe(rowTag['data-enterprise-skill-tag'])
    expect(detailTag['aria-label']).toBe(rowTag['aria-label'])
    expect(detailTag['disabled']).toBe(rowTag['disabled'])
    // 动作回调就是同一个函数（点详情里的动作 = 拨行上那一枚，不存在第二套动作实现）。
    detailSwitch['onChange']?.(false)
    expect(shellProps.onToggleSkill).toHaveBeenCalledWith(skill, false)
    expect(detailTag['onClick']).toBeDefined()
    // ② 失败事实同源：详情里那条 alert 与行上那句一模一样（同一份 `skillActionError`）。
    expect(collectAlerts(detailTree).map(alert => textOf(alert)))
      .toEqual(collectAlerts(rowTree).map(alert => textOf(alert)))
    expect(textOf(collectAlerts(detailTree)[0])).toContain('ENT_ARTIFACT_INTEGRITY_FAILED')
    // ③ 详情不另取一次数：一切来自行投影 + 行 facts + 已装记录（同一份 row 数据）。
    expect(textOf(detailTree)).toContain(skill.displayName)
    expect(textOf(detailTree)).toContain(skill.description)
    expect(textOf(detailTree)).toContain(skill.skillId)
    expect(textOf(detailTree)).toContain(skill.sourceDshVersion)
    // ④ 详情里的动作与行上一样是**行线上的同级关系**的复刻：动作区里恰好一枚辅助标签 + 一枚 Switch。
    expect(collectTagProps(detailTree)).toHaveLength(1)
    expect(collectSwitchProps(detailTree)).toHaveLength(1)
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
    expect((source.match(/controller\.abort\(\)/g) ?? []).length).toBe(4)
    expect(source).toContain('createEnterpriseSkillCatalogSource')
    expect((source.match(/api\.skills\(/g) ?? []).length).toBe(1)
    expect((source.match(/api\.installedSkills\(/g) ?? []).length).toBe(1)
    expect((source.match(/controller\.signal\.aborted/g) ?? []).length).toBeGreaterThanOrEqual(6)
    // 失败不静默：每一处 catch（技能动作 / 文件树 / 文件正文 / **配方详情** / **配方真值** /
    // **配方启用** / **配方停用**）都把错误经 `enterpriseLocalErrorCode` 投影成稳定码，交给纯视图出
    // role="alert" 或行内提示；本条用例关心的两个文件取数各占一处。
    //（目录那一条改由 `enterpriseDegradedRead`（list-state.ts）投影稳定码，故本文件里只剩这七处。）
    expect((source.match(/enterpriseLocalErrorCode\(error\)/g) ?? []).length).toBe(7)
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
    .map(([key, value]) => `[${key}=${typeof value === 'function' ? '[fn]' : String(value)}]`)
    .join('')
  for (const [mock, name] of MOCK_PRIMITIVES) {
    if (type === mock) return [`${pad}${name}${attrs}`, ...domOutline(props['children'] as ReactNode, depth + 1)]
  }
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
