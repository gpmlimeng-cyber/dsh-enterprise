/**
 * [INPUT]: 依赖 React（useState/useEffect）、品牌位图 brand、lucide-react 三枚组件图标、官方 ui-primitives 的 Switch/Tag/StateDot（pinned 0.1.5-rc.2 的 .d.ts 已导出，不走 official-ui 收窄接缝）、account-state 的 `enterpriseSessionUsable` 与 account-store 的 `EnterpriseAccountSnapshot`（shared 面、订阅只在 WithStore 包装内）、local-api-decode 的技能 DTO（`EnterpriseRuntimeSkill` 列表/详情 + 已装记录 `EnterpriseInstalledSkill`——「有更新」要比对的两侧 versionId 分别来自二者）与失败码唯一投影 `enterpriseLocalErrorCode`（行内失败提示的 code 来源，与技能 tab 同源）、消费官方 `plugins.item` owner props（`view`/`form`）
 * [OUTPUT]: 提供官方插件页「官方」分组里的「插件市场」入口卡片与带「开关 + 组件列表 + 企业插件节 + 企业技能节」的详情页（布局逐值照官方 PackageDetail+RowsSection 实物），以及可脱离 DOM 测试的组件清单/计数摘要/组件状态纯投影、企业插件行投影、企业技能行投影（官方两行卡片：标题 + 描述，并带上中心当前版本 `latestVersionId`）、技能行受管态纯投影 `enterpriseMarketSkillState`（`AVAILABLE`/`INSTALLED`/`UPDATE_AVAILABLE`/`INSTALLING`/`REMOVING`）、右侧那一枚简要标签的纯投影 `enterpriseMarketSkillTag` 与文案常量 `ENTERPRISE_MARKET_SKILL_TAG_LABELS`、「有更新」判定纯投影 `enterpriseMarketSkillHasUpdate`、失败可见反馈 `EnterpriseMarketActionError` 与文案投影 `enterpriseMarketActionErrorLabel`，以及注册常量；卡片摘要与详情页正文**不重复同一句**——摘要只在 `summary` 视图出现（官方必渲染的那一份），详情页只留标题与组件列表
 * [POS]: ui 的企业扩展市场入口，只占官方 `plugins.item` 槽位（卡片一句话走 `summary`、详情正文走 `page`），不注册侧栏入口与独立市场弹层；store 与开登录回调均为可选注入（共享注册面经 `client.tsx` 的 `inject` 给本条目注入 store，缺席时降级为占位态，注入后自动升级为真值态）；组件行 `reserved` 只剩配方一行，插件与技能行随企业会话真值，两个目录节（企业插件/企业技能）都只在对应大组件开启且目录非空时出现，**两节右侧的口径按官方卡片分开**——企业插件行维持原样（状态点 + 文案 + `Switch` 一键安装/卸载），企业技能行改成官方两行卡片（第 1 行标题 `own-market-cardId`、第 2 行描述 `own-market-cardDesc` 单行省略，不再出现元信息行）且**右侧只留一枚简要状态标签**：取值严格限定 `未安装`/`已安装`/`有更新`/`安装中…`/`卸载中…`（`ENTERPRISE_MARKET_SKILL_TAG_LABELS`），这枚标签**本身就是该行的主操作**——真实 `<button>`（标签观感、非开关观感，键盘可达、`aria-label` 给动作语义、`data-enterprise-skill-tag` 给测试），点击即安装/更新/卸载，在途禁用，**技能行不再有 Switch**；`installedSkills`（Host 回传的已装记录，含 `versionId`）/`pendingSkill`（行键 + 方向，卸载在途才出 `卸载中…`）/`onToggleSkill` 三个直传输入决定 `data-enterprise-skill-state`，动作返回的已装清单覆盖本地真值、失败即退回未装（界面不保留乐观已装）；**「有更新」= 本机已装记录的 `versionId` 与中心当前版本不一致**（两侧都非空且不等才判，缺一不猜；`sha256` 按本包契约「校验形状后即丢」不投影，故版本身份用 versionId）——中心列表投影不带 versionId、只有 `/skills/{id}` 详情带，故 hook 入口只对**已装行**按需取详情，经 `enterpriseMarketSkillRows(skills, details)` 把中心当前版本归并进 `latestVersionId`（详情取不到即留空＝不判更新）；**两节的行共用同一份失败可见反馈**：动作失败时命中该行的 `role="alert"` 行内提示（`安装失败`/`卸载失败` + `enterpriseLocalErrorCode` 的稳定码，照「技能」tab 的 `own-skill-inlineError` 口径），失败后该行标签/开关不再禁用、可原地重试；技能目录与已装清单由 hook 入口分别经 `store.api.skills()` 与 `store.api.installedSkills()` **并行**取（已装态取数失败只降级为全部未装，不拖垮目录），纯函数体只收直传的行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Package, Sparkles, BookMarked, ChevronDown } from 'lucide-react'
import { StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { enterpriseSessionUsable, useAccount } from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import { enterprisePluginStatePresentation } from './plugin-market.js'
import type { EnterpriseInstalledSkill, EnterprisePluginCatalogItem, EnterprisePluginItem, EnterpriseRuntimeSkill, ManagedPluginState } from './local-api-decode.js'
import { enterpriseLocalErrorCode } from './local-api-decode.js'
import { EnterpriseLoginDialog, useEnterpriseLoginDialog } from './login-dialog.js'

/** 本入口在官方插件页占用的 slot id，同时是卡片 DOM 的 `data-plugin-item` 与详情页路由键。 */
export const ENTERPRISE_MARKET_ENTRY_ID = 'plugin-market'

/** 卡片与详情页共用的标题，官方把它渲染在卡片标题与详情页 `h3` 两处。 */
export const ENTERPRISE_MARKET_ENTRY_LABEL = '插件市场'

/** 在官方 `plugins.item` 中排在官方四个配置卡片（10/20/30/40）之后。 */
export const ENTERPRISE_MARKET_ENTRY_ORDER = 50

/** 卡片与详情页描述行共用的一句话；官方会把 `summary` 渲染两次，故必须保持单行。 */
export const ENTERPRISE_MARKET_SUMMARY = '企业插件 · 技能 · 配方'

/** 详情页组件列表真源：三行按交付顺序，`reserved` 决定状态点与开关禁用。 */
export const ENTERPRISE_MARKET_COMPONENTS = [
  { id: 'plugins', label: '插件', module: 'enterprise plugins · remote.pluginManager', note: '企业发布的插件与官方插件包', reserved: false },
  { id: 'skills', label: '技能', module: 'official skills/list', note: '企业发布的技能包与装配指令', reserved: false },
  { id: 'presets', label: '配方', module: 'dsh-preset / .dshpreset', note: '企业配方广场', reserved: true },
] as const

/** 详情页页签排期清单，按交付顺序；插件与技能已进入排期，配方仍为预留页签。 */
export const ENTERPRISE_MARKET_PLAN = [
  { id: 'plugins', label: '插件', note: '官方 / 已安装 / 企业插件 三分组' },
  { id: 'skills', label: '技能', note: '已排期' },
  { id: 'presets', label: '配方', note: '预留' },
] as const

/** 计数摘要分段，照官方 `partsSummary` 口径。 */
export type EnterpriseMarketSummary = { readonly total: number; readonly ready: number; readonly reserved: number }

/**
 * 一次企业市场安装/卸载失败的行内提示（插件行与技能行共用同一形状）。
 * `id` 是行键（企业插件 = packageName、企业技能 = 技能包雪花 id），`code` 一律来自
 * `enterpriseLocalErrorCode` 这一份失败码唯一投影——界面只负责显示，不自造文案也不吞错误码。
 */
export interface EnterpriseMarketActionError {
  /** 出错的行键：与该行的 `data-enterprise-*-package` 同值。 */
  readonly id: string
  /** 失败的动作：行内前缀文案由它决定（安装失败 / 卸载失败）。 */
  readonly action: 'install' | 'uninstall'
  /** 稳定错误码（`ENT_…`），与「技能」tab、插件设置页同一份投影。 */
  readonly code: string
}

/** 失败动作 → 行内提示前缀，照「技能」tab 的行内提示口径（安装失败 / 卸载失败）。 */
export function enterpriseMarketActionErrorLabel(error: EnterpriseMarketActionError): string {
  return error.action === 'install' ? '安装失败' : '卸载失败'
}

/** 官方 `plugins.item` 送给注册者的业务字段。 */
export interface EnterpriseMarketEntryProps {
  /** 官方 dispatch 的视图：卡片一句话用 `summary`，详情页正文用 `page`。 */
  readonly view: 'summary' | 'page'
  /**
   * 官方对注册了配置命名空间的条目传入配置表单；本入口没有配置命名空间，
   * `PluginManagerPage.formFor()` 会提前返回 `undefined`，因此这里只声明不消费。
   */
  readonly form?: never
  /**
   * 企业账号共享 store：`EnterpriseMarketPage` 订阅它并把会话可用性/开登录回调喂给本纯函数体。
   * 本组件自身不调 hook（保持纯函数可测）；`store` 缺席时由调用方给 `sessionUsable=false`。
   */
  readonly store?: EnterpriseAccountStore | undefined
  /**
   * 会话可用性直传（测试用）：真运行时由 `EnterpriseMarketPage` 订阅 store 算出后传入，缺席取 false。
   */
  readonly sessionUsable?: boolean
  /**
   * 打开企业登录弹窗的回调：未登录时拨动总开关/组件开关触发；缺席时开关恒禁用（不提供假切换）。
   */
  readonly onOpenLogin?: (() => void) | undefined
  /**
   * 企业后台上传的真实插件目录（`store.pluginStatus.catalog`，经 hook 入口订阅后直传）。
   * 仅当「插件」组件开启（`sessionUsable`）时在页面追加「企业插件」节渲染；缺席/关闭时该节不出现。
   */
  readonly enterprisePlugins?: readonly EnterpriseMarketPluginRow[] | undefined
  /**
   * 企业技能目录（`store.api.skills()` 的列表投影 + 已装行的中心详情投影，经 hook 入口取数后直传）。
   * 与本 props 的「企业插件」节同规则：仅当「技能」组件开启（`sessionUsable`）且目录非空时
   * 追加「企业技能」节；行右侧只有一枚可点标签（`onToggleSkill` + 已装态直传）。
   */
  readonly enterpriseSkills?: readonly EnterpriseMarketSkillRow[] | undefined
  /**
   * 本机已装技能记录（`store.api.installedSkills()` 的投影，经 hook 入口取数后直传）。
   * 整套记录而不只是 id：判定「已装」用 `packageId`，判定「有更新」要用记录里的 `versionId` 与
   * 行上的 `latestVersionId` 比。缺席时所有行显示未装；已装态由 Host 回传真值判定，纯函数体不猜。
   */
  readonly installedSkills?: readonly EnterpriseInstalledSkill[] | undefined
  /** 当前正在安装/卸载的技能包动作（行键 + 方向）；命中行的标签禁用并显示「安装中…/卸载中…」。 */
  readonly pendingSkill?: EnterpriseMarketSkillPending | undefined
  /**
   * 企业插件的安装/卸载动作（`store.installPlugin` / `store.removePlugin`）；缺席时开关禁用。
   * 注：安装动作在 hook 入口调用后触发 store 刷新，本纯函数体不持 store。
   */
  readonly onTogglePlugin?: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined
  /**
   * 企业技能的一键安装/卸载动作；缺席时技能行的标签禁用（与企业插件行同一降级口径）。
   * `next` 由标签投影的动作决定：已装行点标签传 `false`（卸载），其余传 `true`（安装/更新）。
   */
  readonly onToggleSkill?: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined
  /**
   * 企业插件行最近一次安装/卸载失败（`EnterpriseMarketPage` 把 store 已收下的 `pluginErrorCode`
   * 归到刚发起动作的那一行）：命中 `packageName` 的行渲染 `role="alert"` 行内提示；缺席即无失败。
   * 有失败提示**不**禁用该行开关——用户要能原地重试。
   */
  readonly pluginActionError?: EnterpriseMarketActionError | undefined
  /**
   * 企业技能行最近一次安装/卸载失败（行键 = 技能包 id）：命中该行时渲染 `role="alert"` 行内提示。
   * 与插件行同口径：提示出现不影响标签可点性（失败后仍可再点一次重试）。
   */
  readonly skillActionError?: EnterpriseMarketActionError | undefined
  /**
   * 各节的折叠态（照官方 `PluginInventorySettingsTab`：`aria-expanded` + 默认折叠）。缺席视为全展开
   * （纯函数直调测试不传即得完整树）；真运行时由 `EnterpriseMarketPage` 的 `useState` 供给。
   */
  readonly expandedSections?: { readonly components: boolean; readonly enterprisePlugins: boolean; readonly enterpriseSkills: boolean } | undefined
  /** 折叠切换回调（点节头按钮触发）；缺席时节头按钮禁用（不提供死按钮）。 */
  readonly onToggleSection?: ((section: EnterpriseMarketSectionId) => void) | undefined
}

/** 可折叠的节 id 联合：组件节 / 企业插件节 / 企业技能节（三节共用同一份节头与折叠语义）。 */
export type EnterpriseMarketSectionId = 'components' | 'enterprisePlugins' | 'enterpriseSkills'

/** 节头的可点按钮 id 与内容区 id（`aria-controls` 用），三节各自独立。 */
export const ENTERPRISE_MARKET_SECTION_IDS = {
  components: 'components',
  enterprisePlugins: 'enterprise-plugins',
  enterpriseSkills: 'enterprise-skills',
} as const

/** 「企业插件」节的一行：企业后台上传的插件（catalog）+ 本机安装态。 */
export interface EnterpriseMarketPluginRow {
  readonly packageName: string
  /** 企业目录版本；已不在目录则取本机版本，都无则 null。 */
  readonly version: string | null
  /** 本机受管态（未安装/安装中/已装…）；无本机记录则 EXPECTED（可选安装）。 */
  readonly state: ManagedPluginState
  /** 企业目录是否仍提供（false = 已下架但本机仍装着）。 */
  readonly inCatalog: boolean
  /** 目录里的安装不可用原因（如不兼容/权限），有则禁安装。 */
  readonly installErrorCode?: string | undefined
}

/** 目录 + 本机态 → 可渲染的「企业插件」行（纯函数，按 packageName 归并，目录顺序优先）。 */
export function enterpriseMarketPluginRows(
  catalog: readonly EnterprisePluginCatalogItem[] = [],
  local: readonly EnterprisePluginItem[] = [],
): EnterpriseMarketPluginRow[] {
  const localByName = new Map(local.map(item => [item.packageName, item]))
  const names = [...new Set([...catalog.map(item => item.packageName), ...localByName.keys()])]
  return names.map((packageName) => {
    const cat = catalog.find(item => item.packageName === packageName)
    const rec = localByName.get(packageName)
    return {
      packageName,
      version: cat?.version ?? rec?.version ?? null,
      state: rec?.state ?? 'EXPECTED',
      inCatalog: cat !== undefined,
      installErrorCode: cat?.installErrorCode,
    }
  })
}

/** 「企业插件」节是否该渲染（「插件」组件开启且有目录/本机记录）。 */
export function enterpriseMarketPluginSectionVisible(
  pluginsComponentEnabled: boolean,
  rows: readonly EnterpriseMarketPluginRow[],
): boolean {
  return pluginsComponentEnabled && rows.length > 0
}

/**
 * 「企业技能」节的一行：企业后台上传的技能包。
 * 口径照官方已安装卡片 `CardHead`——**只两行**：第 1 行标题（displayName）、第 2 行描述
 * （description，单行省略不撑高卡片），右侧只留一枚简要状态标签（见 `enterpriseMarketSkillTag`），
 * 不再堆状态点 + 元信息 + 开关。「复制装配指令」仍是「技能」tab 的第二条路，这里给的是「一键落盘」。
 */
export interface EnterpriseMarketSkillRow {
  /** 技能包雪花 id，同时是详情取数键（`store.api.skillDetail(id)`）与安装动作入参。 */
  readonly id: string
  /** manifest.json 的稳定标识（kebab-case 等），进 `data-enterprise-skill-id`。 */
  readonly skillId: string
  readonly displayName: string
  /** 空描述归一为固定占位，与技能 tab 详情弹窗同一句话。 */
  readonly description: string
  /**
   * 中心当前版本的 versionId（「有更新」比对的另一侧）。列表投影不带这个字段、只有详情带，
   * 故由 hook 入口对已装行按需取详情后经 `enterpriseMarketSkillRows` 归并进来；
   * 取不到即空串 = 不判更新（宁可少说一句，也不猜「有更新」）。
   */
  readonly latestVersionId: string
}

/**
 * 技能目录 → 可渲染的「企业技能」行（纯函数，按目录顺序，不做归并——本机已装态另行直传）。
 * @param skills - `store.api.skills()` 的列表投影（只有摘要，`versionId` 为空串）。
 * @param details - 可选的中心详情投影（`store.api.skillDetail(id)`），只用来补中心当前版本；
 *   按 id 归并，缺该行详情即留空串——未装行不需要它（没有本机版本可比）。
 */
export function enterpriseMarketSkillRows(
  skills: readonly EnterpriseRuntimeSkill[] = [],
  details: readonly EnterpriseRuntimeSkill[] = [],
): EnterpriseMarketSkillRow[] {
  const latestById = new Map(details.map(detail => [detail.id, detail.versionId]))
  return skills.map(skill => ({
    id: skill.id,
    skillId: skill.skillId,
    displayName: skill.displayName,
    description: skill.description === '' ? '（暂无描述）' : skill.description,
    latestVersionId: latestById.get(skill.id) ?? '',
  }))
}

/**
 * 「企业技能」行现在的受管态（与 `data-enterprise-skill-state` / `data-enterprise-skill-tag` 同源）：
 * `INSTALLED` 已落盘且与中心同版本、`UPDATE_AVAILABLE` 已落盘但中心有别的版本、
 * `INSTALLING`/`REMOVING` 动作在途、`AVAILABLE` 未装可装。
 */
export type EnterpriseMarketSkillState = 'AVAILABLE' | 'INSTALLED' | 'UPDATE_AVAILABLE' | 'INSTALLING' | 'REMOVING'

/** 右侧那一枚简要标签的文案口径（**取值严格限定这五个**，改文案只改这一处）；在途态带省略号。 */
export const ENTERPRISE_MARKET_SKILL_TAG_LABELS = {
  AVAILABLE: '未安装',
  INSTALLED: '已安装',
  UPDATE_AVAILABLE: '有更新',
  INSTALLING: '安装中…',
  REMOVING: '卸载中…',
} as const satisfies Record<EnterpriseMarketSkillState, string>

/**
 * 本机已装记录与中心当前版本是否不一致（=「有更新」）。
 * 两侧都必须拿得到非空 versionId 才判：未装、详情没取到（旧 Host 没有详情路由）都返回 false——不猜版本。
 * 比的是 versionId 而不是 `sha256`：`sha256` 按本包契约在解码时校验形状后即丢（`skill-api-decode` 的
 * 「与本包 SHA 不出界面同策」），本层能拿到的版本身份只有这一份 versionId。
 * @param installedVersionId - 本机已装记录的 versionId（`EnterpriseInstalledSkill.versionId`）。
 * @param latestVersionId - 中心当前版本的 versionId（行上的 `latestVersionId`）。
 * @returns 是否有更新。
 */
export function enterpriseMarketSkillHasUpdate(installedVersionId: string, latestVersionId: string): boolean {
  return installedVersionId !== '' && latestVersionId !== '' && installedVersionId !== latestVersionId
}

/** 「企业技能」行当前在途的动作：行键 + 方向（`true` = 安装/更新、`false` = 卸载），与 hook 入口的 `pendingSkill` 同形。 */
export interface EnterpriseMarketSkillPending {
  readonly packageId: string
  readonly next: boolean
}

/**
 * 一行技能包当前的受管态（唯一判定点，纯函数直调可测）。
 * 优先级：在途 > 未装 > 有更新 > 已装——在途时界面只说「正在进行」，不混说版本。
 * @param installedSkills - Host 回传的已装记录（缺席＝全部未装，界面不猜）。
 * @param pending - 当前在途动作；命中本行时按方向出 `INSTALLING`/`REMOVING`。
 * @param row - 已投影的目录行（带中心当前版本）。
 * @returns 受管态。
 */
export function enterpriseMarketSkillState(
  installedSkills: readonly EnterpriseInstalledSkill[] | undefined,
  pending: EnterpriseMarketSkillPending | undefined,
  row: EnterpriseMarketSkillRow,
): EnterpriseMarketSkillState {
  if (pending?.packageId === row.id) return pending.next ? 'INSTALLING' : 'REMOVING'
  const record = installedSkills?.find(item => item.packageId === row.id)
  if (record === undefined) return 'AVAILABLE'
  return enterpriseMarketSkillHasUpdate(record.versionId, row.latestVersionId) ? 'UPDATE_AVAILABLE' : 'INSTALLED'
}

/** 右侧那一枚简要状态标签的可渲染投影（文案 / 点击动作 / 无障碍名 / 悬浮说明一次产出，避免四处各判一次）。 */
export interface EnterpriseMarketSkillTag {
  /** 可见文案，取值严格限定 `ENTERPRISE_MARKET_SKILL_TAG_LABELS`。 */
  readonly label: string
  /** 点击该标签要触发的动作：已装 → 卸载；未装与有更新 → 安装（有更新即重装到中心当前版本）。 */
  readonly action: 'install' | 'uninstall'
  /** 无障碍名（动作语义，读屏与键盘听到的就是它），照原先开关 `label` 的「动作 + 企业技能 + 名称」口径。 */
  readonly ariaLabel: string
  /** 悬浮说明；在途态说明为什么点不动。 */
  readonly title: string
}

/**
 * 受管态 + 技能名 → 右侧那枚标签的完整投影。这枚标签**就是该行的主操作**（不是开关、不是状态点），
 * 所以动作语义与无障碍名和状态一样由这里统一给出，渲染层只负责把它挂到真实 `<button>` 上。
 * @param state - `enterpriseMarketSkillState` 的结果。
 * @param displayName - 技能显示名，进无障碍名。
 * @returns 标签投影。
 */
export function enterpriseMarketSkillTag(state: EnterpriseMarketSkillState, displayName: string): EnterpriseMarketSkillTag {
  switch (state) {
    case 'INSTALLED':
      return { label: ENTERPRISE_MARKET_SKILL_TAG_LABELS.INSTALLED, action: 'uninstall', ariaLabel: `卸载企业技能 ${displayName}`, title: '点此卸载' }
    case 'UPDATE_AVAILABLE':
      return { label: ENTERPRISE_MARKET_SKILL_TAG_LABELS.UPDATE_AVAILABLE, action: 'install', ariaLabel: `更新企业技能 ${displayName}`, title: '点此更新到中心当前版本' }
    case 'INSTALLING':
      return { label: ENTERPRISE_MARKET_SKILL_TAG_LABELS.INSTALLING, action: 'install', ariaLabel: `正在安装企业技能 ${displayName}`, title: '安装进行中，暂不可操作' }
    case 'REMOVING':
      return { label: ENTERPRISE_MARKET_SKILL_TAG_LABELS.REMOVING, action: 'uninstall', ariaLabel: `正在卸载企业技能 ${displayName}`, title: '卸载进行中，暂不可操作' }
    default:
      return { label: ENTERPRISE_MARKET_SKILL_TAG_LABELS.AVAILABLE, action: 'install', ariaLabel: `安装企业技能 ${displayName}`, title: '点此安装到 ~/.dsh/skills' }
  }
}

/** 「企业技能」节是否该渲染（「技能」组件开启且目录非空），与企业插件节同规则。 */
export function enterpriseMarketSkillSectionVisible(
  skillsComponentEnabled: boolean,
  rows: readonly EnterpriseMarketSkillRow[],
): boolean {
  return skillsComponentEnabled && rows.length > 0
}

/**
 * 一节当前是否展开（照官方 `PluginInventorySettingsTab` 的 `searching || (open ?? false)`：
 * 官方搜索时强制展开，我们当前无搜索故退化为 `open ?? defaultOpen`；默认全折叠）。
 * @param expandedSections - 当前折叠态（缺席＝全展开，测试直调不传即得完整树）。
 * @param section - 节 id。
 * @param defaultOpen - 缺席时的默认展开值。
 * @returns 是否展开。
 */
export function enterpriseMarketSectionOpen(
  expandedSections: Record<EnterpriseMarketSectionId, boolean> | undefined,
  section: EnterpriseMarketSectionId,
  defaultOpen = false,
): boolean {
  if (expandedSections === undefined) return defaultOpen
  return expandedSections[section]
}

/** 企业插件受管态 → 官方 StateDot 语义（已装绿/进行中蓝/等待或失败红棕/其余灰）。 */
export function enterprisePluginDot(state: ManagedPluginState): StateDotState {
  if (state === 'ACTIVE') return 'done'
  if (state === 'FAILED') return 'error'
  if (state === 'DOWNLOADING' || state === 'INSTALLING' || state === 'REMOVING') return 'ongoing'
  if (state === 'RESTART_REQUIRED' || state === 'REMOVE_PENDING' || state === 'ROLLBACK') return 'warning'
  return 'idle'
}

/** 入口卡片与详情页描述行共用的一句话。 */
export const enterpriseMarketEntrySummary = (): string => ENTERPRISE_MARKET_SUMMARY

/** 详情页预留的页签清单，按交付顺序。 */
export const enterpriseMarketEntryPlan = (): typeof ENTERPRISE_MARKET_PLAN => ENTERPRISE_MARKET_PLAN

/** 组件清单原样投影，按交付顺序。 */
export const enterpriseMarketComponents = (): typeof ENTERPRISE_MARKET_COMPONENTS => ENTERPRISE_MARKET_COMPONENTS

/** 每行组件当前是否可用（配方恒预留不可用；插件与技能行随企业会话真值）。 */
export function enterpriseMarketComponentEnabled(id: string, sessionUsable: boolean): boolean {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return false
  return sessionUsable
}

/** 组件状态行的可见文案：预留 → 预留；可用 → 可用；否则 → 需登录。 */
export function enterpriseMarketComponentState(id: string, sessionUsable: boolean): '预留' | '可用' | '需登录' {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return '预留'
  return sessionUsable ? '可用' : '需登录'
}

/** 组件状态点：预留与需登录都是 idle，可用是 done（照官方 StateDot 语义）。 */
export function enterpriseMarketComponentDot(id: string, sessionUsable: boolean): StateDotState {
  return enterpriseMarketComponentState(id, sessionUsable) === '可用' ? 'done' : 'idle'
}

/** 组件行开关是否禁用（预留恒禁用；插件/技能行在已可用或回调缺席时禁用，避免假切换）。 */
export function enterpriseMarketComponentSwitchDisabled(id: string, sessionUsable: boolean, hasLoginAction: boolean): boolean {
  const row = ENTERPRISE_MARKET_COMPONENTS.find(item => item.id === id)
  if (row === undefined || row.reserved) return true
  if (!hasLoginAction) return true
  return sessionUsable
}

/** 计数摘要三段：总可用/预留，照官方 partsSummary 的口径拆段。 */
export function enterpriseMarketComponentSummary(
  rows: readonly { readonly id: string }[] = ENTERPRISE_MARKET_COMPONENTS,
  sessionUsable = false,
): EnterpriseMarketSummary {
  const present = rows.filter(row => ENTERPRISE_MARKET_COMPONENTS.some(item => item.id === row.id))
  const reserved = present.filter(row => enterpriseMarketComponentState(row.id, sessionUsable) === '预留').length
  const ready = present.filter(row => enterpriseMarketComponentState(row.id, sessionUsable) === '可用').length
  return { total: present.length, ready, reserved }
}

/** 计数摘要三段拼成一行，照官方 `partsSummary` 的「共 N 个 · N 可用 · N 预留」口径。 */
export function enterpriseMarketComponentSummaryText(
  rows: readonly { readonly id: string }[] = ENTERPRISE_MARKET_COMPONENTS,
  sessionUsable = false,
): string {
  const summary = enterpriseMarketComponentSummary(rows, sessionUsable)
  return [`共 ${summary.total} 个`, summary.ready > 0 ? `${summary.ready} 可用` : '', summary.reserved > 0 ? `${summary.reserved} 预留` : '']
    .filter(Boolean)
    .join(' · ')
}

const styles = `
.own-market-entry{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-market-entry *{box-sizing:border-box}
.own-market-entry-summary{color:var(--dsw-alias-label-secondary,#667085)}
/* 包名：负 margin 抵消官方 .detailSections 的 margin-top 32，让它紧贴官方描述（照智能体团队 detailMain gap 8）。
   官方把 page 放在 detailSections（mt 32）而智能体团队的包名在 detailMain（gap 8）内——item 与 package 结构差异，只能在这里调平。 */
/* 包名在 badge 槽内换行成标题下独立一行（照官方 .detailName：mono 12/18 tertiary）。
   flex-basis:100% 借官方 titleRow 的 flex-wrap:wrap 让它独占一行，落在标题下、描述上（贴智能体团队 标题→包名→描述）；
   因官方 ItemDetail 只有 titleRow→desc 两行、描述间无独立插点，只能借 titleRow 换行。 */
.own-market-badge-name{flex-basis:100%;min-width:0;margin-top:4px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#98a2b3);overflow-wrap:anywhere}
.own-market-tag{flex:none;font-variant-numeric:tabular-nums}
.own-market-section{display:flex;flex-direction:column;gap:12px;min-width:0;margin-top:24px}
.own-market-sectionHead{display:flex;align-items:baseline;gap:10px;min-width:0}
.own-market-sectionTitle{margin:0;font-size:14px;line-height:20px;font-weight:500}
/* 节头可点按钮：照官方 groupToggle（flex none + gap8 + 无边框 + 透明 + 左对齐 + focus-ring）。 */
.own-market-groupToggle{display:flex;flex:none;align-items:center;gap:8px;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.own-market-groupToggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-groupToggle[disabled]{cursor:default}
.own-market-groupTitle{font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary,#101828)}
/* chevron：收起 rotate(-90°) → 展开 rotate(0)，照官方 groupToggle 的 .chevron 口径。 */
.own-market-chevron{flex:none;transform:rotate(-90deg);transition:transform .15s ease}
.own-market-groupToggle[aria-expanded='true'] .own-market-chevron{transform:none}
.own-market-sectionCount{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.own-market-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.own-market-row{padding:12px 2px;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);min-width:0}
.own-market-row:last-child{border-bottom:0}
.own-market-rowLine{display:flex;align-items:center;gap:16px;min-width:0}
.own-market-rowIcon{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;width:40px;height:40px;border:0.5px solid var(--dsw-alias-border-l3,#d0d5dd);border-radius:8px;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowMain{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}
.own-market-rowId{font-size:13.5px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828);overflow-wrap:anywhere}
.own-market-row[data-state='off'] .own-market-rowId{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowModule{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary,#98a2b3);overflow-wrap:anywhere}
.own-market-rowNote{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
/* 企业插件卡片两行文案，照官方已安装卡片 .cardTitle/.cardDesc 字号：title 14/20-500-ellipsis、desc 13/18-tertiary-单行。 */
.own-market-cardId{font-size:14px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary,#101828);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.own-market-row[data-state='off'] .own-market-cardId{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-cardDesc{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:13px;line-height:18px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
.own-market-rowState{display:inline-flex;flex-shrink:0;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:18px;white-space:nowrap}
.own-market-row[data-state='off'] .own-market-rowState{color:var(--dsw-alias-label-secondary,#667085)}
.own-market-rowStateFailed{color:var(--dsw-alias-state-error-primary,#c4320a)}
/* 技能行右侧那一枚简要状态标签：版式复用上面的 .own-market-rowState（12.5/18 次要色 nowrap），
   这里只补「签」的形制与交互态——无边框 + 999px 圆角 + 淡底（照官方 Tag 的签观感），
   它同时是该行的主操作按钮，故必须有 focus-ring 与 disabled 观感（标签观感、绝不是开关观感）。 */
.own-market-skillTag{border:0;border-radius:999px;padding:1px 10px;background:var(--dsw-alias-background-secondary,#f2f4f7);font:inherit;cursor:pointer}
.own-market-skillTag:hover:not(:disabled){background:var(--dsw-alias-border-l2,#e4e7ec);color:var(--dsw-alias-label-primary,#101828)}
.own-market-skillTag:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-market-skillTag:disabled{cursor:default;opacity:.6}
.own-market-skillTag[data-enterprise-skill-tag='INSTALLED']{color:var(--dsw-alias-state-success-primary,#027a48)}
.own-market-skillTag[data-enterprise-skill-tag='UPDATE_AVAILABLE']{color:var(--dsw-alias-accent-primary,#2563eb)}
/* 行内失败提示（企业插件行/企业技能行共用）：取值照「技能」tab 的 .own-skill-inlineError（error 色 + 12/19 + 左对齐 + 无内衬）。
   那份 CSS 归 skill-market 的 <style> 持有、切到本页时并不在 DOM，故这里补一份同值规则，不借道未挂载的样式表。 */
.own-market-inlineError{padding:0;text-align:left;font-size:12px;line-height:19px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
`

/** 组件行图标：三枚 lucide 图标按 id 定位，避免借用官方 `*Regular` 图标。 */
const COMPONENT_GLYPHS = { plugins: Package, skills: Sparkles, presets: BookMarked } as const

function ComponentGlyph({ id }: { readonly id: string }): ReactNode {
  const Glyph = COMPONENT_GLYPHS[id as keyof typeof COMPONENT_GLYPHS] ?? Package
  return <Glyph size={18} aria-hidden="true" />
}

/**
 * 官方 `plugins.detail.badge` 贡献（titleRow 里 h3 旁）：只对本入口出「版本号 + 标签」，
 * 其余 subject 返回 null（官方槽语义）。hook 组件：订阅 store 取版本与会话可用性。
 */
export function EnterpriseMarketBadge({ subject, store }: {
  readonly subject: { readonly kind: string; readonly id?: string }
  readonly store?: EnterpriseAccountStore | undefined
}): ReactNode {
  if (subject.kind !== 'item' || subject.id !== ENTERPRISE_MARKET_ENTRY_ID) return null
  const snapshot = useAccount(store as EnterpriseAccountStore)
  return <BadgeView version={snapshot.status?.bundleVersion} />
}

/** 版本签文案，照官方 `versionTag: 'v{version}'` 口径；缺版本时返回 undefined（不渲染版本签）。 */
export function enterpriseMarketVersionTag(bundleVersion: string | undefined): string | undefined {
  return bundleVersion === undefined || bundleVersion === '' ? undefined : `v${bundleVersion}`
}

/**
 * badge 槽的纯呈现（照智能体团队 titleRow：版本号 + 标签 + 包名），不调 hook —— 测试直接调用。
 * 产品决策：标题行不再放可拨开关（拨不动的开关像坏的），也不放状态签（只读头部，状态由组件行体现）。
 * 包名走 `flex-basis:100%` 在官方 `titleRow` 的 `flex-wrap:wrap` 下换行成独立一行——官方 `ItemDetail`
 * 只有 `titleRow → desc` 两行、描述之间无独立插点，包名借官方换行落在标题下、描述上（贴智能体团队 标题→包名→描述）。
 * @param props - `version` 插件 bundle 版本（来自 store status）。
 * @returns 标题行内的「版本号」「预览版」两签 + 独立换行的「包名」。
 */
export function BadgeView({ version }: { readonly version?: string | undefined }): ReactNode {
  const versionTag = enterpriseMarketVersionTag(version)
  return (
    <>
      {versionTag === undefined ? null : <Tag className="own-market-tag" tone="neutral">{versionTag}</Tag>}
      <Tag className="own-market-tag" tone="info">预览版</Tag>
      <span className="own-market-badge-name">
        <code data-plugin-name>{ENTERPRISE_MARKET_ENTRY_ID}</code>
      </span>
    </>
  )
}

/**
 * 官方插件页「官方」分组里的「插件市场」入口（纯函数：无 hook、无订阅，测试直接调用）。
 * @param props - 官方 `plugins.item` 的 owner props，`view` 区分卡片与详情正文；`sessionUsable`/`onOpenLogin`/`enterprisePlugins`/`enterpriseSkills` 为可选注入。
 * @returns `summary` 时为单行卡片文案，`page` 时为带「开关 + 组件列表 + 企业插件节 + 企业技能节」的详情页正文。
 */
export function EnterpriseMarketEntry({
  view, sessionUsable = false, onOpenLogin, enterprisePlugins = [], enterpriseSkills = [], onTogglePlugin,
  installedSkills, pendingSkill, onToggleSkill, pluginActionError, skillActionError,
  expandedSections = undefined, onToggleSection,
}: EnterpriseMarketEntryProps): ReactNode {
  if (view === 'summary') return <span className="own-market-entry-summary">{ENTERPRISE_MARKET_SUMMARY}</span>
  const hasLoginAction = typeof onOpenLogin === 'function'
  const rows = ENTERPRISE_MARKET_COMPONENTS.map(row => ({
    ...row,
    enabled: enterpriseMarketComponentEnabled(row.id, sessionUsable),
    state: enterpriseMarketComponentState(row.id, sessionUsable),
    dot: enterpriseMarketComponentDot(row.id, sessionUsable),
    switchDisabled: enterpriseMarketComponentSwitchDisabled(row.id, sessionUsable, hasLoginAction),
  }))
  const pluginsEnabled = enterpriseMarketComponentEnabled('plugins', sessionUsable)
  const pluginRowsVisible = enterpriseMarketPluginSectionVisible(pluginsEnabled, enterprisePlugins)
  // 「企业技能」节与企业插件节同规则：只在「技能」大组件开启（= 会话可用）且目录非空时出现。
  const skillsEnabled = enterpriseMarketComponentEnabled('skills', sessionUsable)
  const skillRowsVisible = enterpriseMarketSkillSectionVisible(skillsEnabled, enterpriseSkills)
  // 折叠：默认三节全折叠（照官方 PluginInventory）；纯函数不传 expandedSections 时全展开（测试直调得完整树）。
  const sectionOpen: Record<EnterpriseMarketSectionId, boolean> = {
    components: enterpriseMarketSectionOpen(expandedSections, 'components', true),
    enterprisePlugins: enterpriseMarketSectionOpen(expandedSections, 'enterprisePlugins', true),
    enterpriseSkills: enterpriseMarketSectionOpen(expandedSections, 'enterpriseSkills', true),
  }
  const canToggle = typeof onToggleSection === 'function'
  /**
   * 一行的失败行内提示：只有行键命中时才出现，`role="alert"` 交给读屏立刻播报，稳定错误码放在 `code` 里。
   * 照「技能」tab 的行内提示口径（`安装失败`/`卸载失败` + `<code>{code}</code>`），且**不**参与该行开关的
   * `disabled` 计算——失败恰恰是最需要能再拨一次的场景。
   */
  const rowError = (error: EnterpriseMarketActionError | undefined, id: string): ReactNode => (
    error?.id === id
      ? <div className="own-market-inlineError" role="alert">{enterpriseMarketActionErrorLabel(error)} <code>{error.code}</code></div>
      : null
  )
  /** 一节的节头：照官方 groupToggle button（chevron + 标题 + 计数同排，aria-expanded/controls）。 */
  const sectionHead = (section: EnterpriseMarketSectionId, title: string, count: ReactNode): ReactNode => (
    <div className="own-market-sectionHead">
      <button
        type="button"
        className="own-market-groupToggle"
        aria-expanded={sectionOpen[section]}
        aria-controls={`market-section-${ENTERPRISE_MARKET_SECTION_IDS[section]}`}
        disabled={!canToggle}
        title={canToggle ? undefined : '折叠动作未接通'}
        onClick={() => { onToggleSection?.(section) }}
      >
        <ChevronDown className="own-market-chevron" size={12} aria-hidden="true" />
        <span className="own-market-groupTitle">{title}</span>
      </button>
      <span className="own-market-sectionCount">{count}</span>
    </div>
  )
  return (
    <section className="own-market-entry" aria-label={ENTERPRISE_MARKET_ENTRY_LABEL}>
      <style>{styles}</style>
      <section className="own-market-section">
        {sectionHead('components', '包含的组件', enterpriseMarketComponentSummaryText(rows, sessionUsable))}
        {/* 条件渲染而非 hidden 属性：`.own-market-rows{display:flex}` 类选择器会覆盖 UA 的
            `[hidden]{display:none}`（author > UA），hidden 属性存在但列表不消失——照官方 groupBody
            的 `{open ? <div> : null}` 写法，收起时列表真正不进 DOM。 */}
        {sectionOpen.components ? (
          <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.components}`}>
            {rows.map(row => (
              <li
                key={row.id}
                className="own-market-row"
                data-market-component={row.id}
                data-state={row.enabled ? 'on' : 'off'}
              >
                <div className="own-market-rowLine">
                  <span className="own-market-rowIcon"><ComponentGlyph id={row.id} /></span>
                  <div className="own-market-rowMain">
                    <span className="own-market-rowId">{row.label}</span>
                    <span className="own-market-rowNote">{row.note}</span>
                    <code className="own-market-rowModule">{row.module}</code>
                  </div>
                  <span className="own-market-rowState">
                    <StateDot state={row.dot} />
                    {row.state}
                  </span>
                  <Switch
                    checked={row.enabled}
                    label={`启用组件 ${row.label}`}
                    disabled={row.switchDisabled}
                    title={row.reserved ? `预留：${row.label}组件未接入` : row.enabled ? '请在企业账号中退出登录' : '登录企业账号后启用'}
                    onChange={() => { onOpenLogin?.() }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {/* 「企业插件」节：仅当上面的「插件」大组件开启时出现，列企业后台上传的真实插件目录。 */}
      {pluginRowsVisible ? (
        <section className="own-market-section" data-market-section="enterprise-plugins">
          {sectionHead('enterprisePlugins', '企业插件', `${enterprisePlugins.length} 个`)}
          {sectionOpen.enterprisePlugins ? (
            <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.enterprisePlugins}`}>
              {enterprisePlugins.map(plugin => (
                <li
                  key={plugin.packageName}
                  className="own-market-row"
                  data-enterprise-plugin-package={plugin.packageName}
                  data-enterprise-plugin-state={plugin.state}
                >
                  <div className="own-market-rowLine">
                    <span className="own-market-rowIcon"><Package size={18} aria-hidden="true" /></span>
                    {/* 两行文案，照官方已安装卡片 CardHead（title 行 + description 行）：
                        第 1 行 = 包名（= 官方 title），第 2 行 = 一句话说明（= 官方 description，单行 ellipsis）。
                        不再放 mono 模块名——那是详情页 RowsSection 的 rowMain 结构，官方卡片没有。 */}
                    <div className="own-market-rowMain">
                      <span className="own-market-cardId">{plugin.packageName}</span>
                      <span className="own-market-cardDesc">
                        {plugin.inCatalog ? `企业发布 · v${plugin.version ?? ''}` : '已不在企业目录中'}
                      </span>
                    </div>
                    <span className="own-market-rowState">
                      <StateDot state={enterprisePluginDot(plugin.state)} />
                      {enterprisePluginStatePresentation(plugin.state).title}
                    </span>
                    <Switch
                      checked={plugin.state === 'ACTIVE'}
                      label={`安装企业插件 ${plugin.packageName}`}
                      disabled={!onTogglePlugin || plugin.installErrorCode !== undefined
                        || plugin.state === 'INSTALLING' || plugin.state === 'DOWNLOADING' || plugin.state === 'REMOVING' || plugin.state === 'ROLLBACK'}
                      title={plugin.installErrorCode !== undefined ? '该插件当前不可安装'
                        : plugin.state === 'ACTIVE' ? '点此卸载' : '点此安装'}
                      onChange={(next) => { onTogglePlugin?.(plugin, next) }}
                    />
                  </div>
                  {/* 安装/卸载失败的可见反馈：这是原先「拨了没反应」的那一处——动作失败只有 store 收着码，
                      本页一个字都没说。失败后开关照旧可拨（上面的 disabled 不含本提示）。 */}
                  {rowError(pluginActionError, plugin.packageName)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {/* 「企业技能」节：与企业插件节同规则——「技能」大组件开启（= 会话可用）且目录非空才出现。
          行 = 官方两行卡片（标题 + 描述）+ 右侧一枚可点标签；一键安装/卸载到官方 `~/.dsh/skills`，
          已装态与中心当前版本都由 Host 回传（`installedSkills` + 行上的 `latestVersionId`）。 */}
      {skillRowsVisible ? (
        <section className="own-market-section" data-market-section="enterprise-skills">
          {sectionHead('enterpriseSkills', '企业技能', `${enterpriseSkills.length} 个`)}
          {sectionOpen.enterpriseSkills ? (
            <ul className="own-market-rows" id={`market-section-${ENTERPRISE_MARKET_SECTION_IDS.enterpriseSkills}`}>
              {enterpriseSkills.map(skill => {
                const skillState = enterpriseMarketSkillState(installedSkills, pendingSkill, skill)
                const tag = enterpriseMarketSkillTag(skillState, skill.displayName)
                const busy = skillState === 'INSTALLING' || skillState === 'REMOVING'
                return (
                  <li
                    key={skill.id}
                    className="own-market-row"
                    data-enterprise-skill-package={skill.id}
                    data-enterprise-skill-id={skill.skillId}
                    data-enterprise-skill-state={skillState}
                  >
                    <div className="own-market-rowLine">
                      <span className="own-market-rowIcon"><Sparkles size={18} aria-hidden="true" /></span>
                      {/* 两行文案照官方已安装卡片 CardHead（title 行 + description 行）：
                          第 1 行 = displayName（= 官方 title，14/20-500-省略），
                          第 2 行 = description（= 官方 description，13/18-tertiary-**单行**省略，不换行撑高卡片）。 */}
                      <div className="own-market-rowMain">
                        <span className="own-market-cardId">{skill.displayName}</span>
                        <span className="own-market-cardDesc">{skill.description}</span>
                      </div>
                      {/* 右侧只留这一枚简要状态标签（取值：未安装/已安装/有更新/安装中…/卸载中…），
                          它**就是该行的主操作**：真实 <button>（标签观感、非开关观感），键盘可达，
                          aria-label 给动作语义；点击即安装/更新/卸载，在途禁用。技能行不再有 Switch。 */}
                      <button
                        type="button"
                        className="own-market-rowState own-market-skillTag"
                        data-enterprise-skill-tag={skillState}
                        aria-label={tag.ariaLabel}
                        disabled={!onToggleSkill || busy}
                        title={onToggleSkill === undefined ? '企业账号未登录，暂不可操作' : tag.title}
                        onClick={() => { onToggleSkill?.(skill, tag.action === 'install') }}
                      >
                        {tag.label}
                      </button>
                    </div>
                    {/* 失败可见反馈（与「技能」tab 的 own-skill-inlineError 同一口径）：失败即在该行给
                        role="alert" + 稳定错误码，且退回未装态（已装清单仍由 Host 回传真值主导）；
                        失败**不**禁用标签——再点一次就是重试。 */}
                    {rowError(skillActionError, skill.id)}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}

/**
 * 官方 `plugins.item` 的真实入口（唯一含 hook 的导出）：订阅企业账号 store、自持登录弹窗，
 * 把会话可用性、插件目录与开登录回调喂给纯函数体 `EnterpriseMarketEntry`。`store` 缺席时开关恒禁用（不提供假切换）。
 *
 * 技能目录不在 store 快照里，故由本入口按会话可用性就地取（`store.api.skills()`，同源固定路径）；
 * 取数失败/未登录都收敛成空目录——「企业技能」节据此不出现，不残留半个错误态。
 * 已装态与目录并行取（`store.api.installedSkills()`），并**只对已装行**再补一次详情
 * （`store.api.skillDetail(id)`：中心列表投影不带 versionId，判定「有更新」要靠详情里的它）。
 * @param props - `view` 透传官方视图；`store` 由共享注册面（`client.tsx` 的 `plugins.item` inject）注入。
 * @returns 官方插件页「插件市场」入口，`page` 视图下头部总开关与组件行开关都真实可用。
 */
export function EnterpriseMarketPage({ view, store }: { readonly view: 'summary' | 'page'; readonly store?: EnterpriseAccountStore | undefined }): ReactNode {
  const snapshot = useAccount(store as EnterpriseAccountStore)
  const dialog = useEnterpriseLoginDialog(store as EnterpriseAccountStore)
  const sessionUsable = enterpriseSessionUsable(snapshot.status?.state)
  // 折叠态：默认三节全折叠（照官方 PluginInventory `?? false`）；本组件是唯一 hook 入口，纯函数体不持状态。
  const [expandedSections, setExpandedSections] = useState<Record<EnterpriseMarketSectionId, boolean>>({
    components: false,
    enterprisePlugins: false,
    enterpriseSkills: false,
  })
  const onToggleSection = (section: EnterpriseMarketSectionId): void => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  const hasStore = store !== undefined
  const openLogin = hasStore ? dialog.openDialog : undefined
  const pluginStatus = snapshot.pluginStatus
  const catalog = pluginStatus?.catalog ?? []
  const local = pluginStatus?.plugins ?? []
  const enterprisePlugins = enterpriseMarketPluginRows(catalog, local)
  // 技能目录：只在 `page` 视图（企业技能节的宿主）+ 有 store + 会话可用时取；卡片视图不预取。
  // 会话不可用/取数失败一律回落空目录（节随之消失）；依赖变化即中止在途请求，避免迟到结果跨会话回填。
  // 已装态与目录**并行**取：旧 Host 没有 `/skills/installed` 时目录照常显示，只是所有行显示未装。
  // 已装清单保留**整套记录**（不只 id）：判定「有更新」要记录里的 `versionId`。
  const [enterpriseSkills, setEnterpriseSkills] = useState<readonly EnterpriseMarketSkillRow[]>([])
  const [installedSkills, setInstalledSkills] = useState<readonly EnterpriseInstalledSkill[]>([])
  const [pendingSkill, setPendingSkill] = useState<EnterpriseMarketSkillPending>()
  useEffect(() => {
    if (view !== 'page' || !hasStore || !sessionUsable) {
      setEnterpriseSkills([])
      setInstalledSkills([])
      return
    }
    const controller = new AbortController()
    // 两条取数各自兜底：目录失败回落空目录（节消失），已装清单失败只回落全部未装（不拖垮目录）。
    const api = store!.api
    void Promise.all([
      api.skills(controller.signal).catch(() => [] as readonly EnterpriseRuntimeSkill[]),
      api.installedSkills(controller.signal).catch(() => [] as readonly EnterpriseInstalledSkill[]),
    ])
      .then(async ([items, installed]) => {
        if (controller.signal.aborted) return
        setInstalledSkills(installed)
        // 中心列表投影不带 `versionId`（只有详情带），故**只对已装行**按需取详情：没有本机版本的未装行
        // 无从比较，不白跑请求；某行详情失败即留空（该行不判「有更新」），不拖垮整个目录。
        const details = await Promise.all(installed.map(item =>
          api.skillDetail(item.packageId, controller.signal).catch(() => undefined),
        ))
        if (controller.signal.aborted) return
        setEnterpriseSkills(enterpriseMarketSkillRows(items, details.filter(detail => detail !== undefined)))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setEnterpriseSkills([])
        setInstalledSkills([])
      })
    return () => { controller.abort() }
  }, [view, hasStore, sessionUsable, store])
  const versionIdByPackage = new Map(catalog.map(item => [item.packageName, item.pluginVersionId]))
  // 失败可见反馈（两行共用同一份口径）：
  // · 技能侧：动作 promise 的 catch 直接拿到错误对象（行键 = 技能包 id）；
  // · 插件侧：`store.#pluginAction` 把失败**吞**进 `snapshot.pluginErrorCode`（不 rethrow，设置页插件
  //   市场正是靠它出头号提示），所以这里记住「刚发起动作的那一行与动作」，再把 store 已收下的稳定码
  //   归到该行；`localCode` 只用于本地就能判定、根本没发出请求的那一种（目录里已无可安装版本）。
  // 每次发起动作都先清掉旧提示（照「技能」tab 的 `setActionError(undefined)`），成功后自然不会再出现。
  const [skillActionError, setSkillActionError] = useState<EnterpriseMarketActionError>()
  const [pluginAction, setPluginAction] = useState<{
    readonly packageName: string
    readonly action: 'install' | 'uninstall'
    readonly localCode?: string
  }>()
  const pluginErrorCode = pluginAction?.localCode ?? snapshot.pluginErrorCode
  const pluginActionError: EnterpriseMarketActionError | undefined =
    pluginAction !== undefined && pluginErrorCode !== undefined
      ? { id: pluginAction.packageName, action: pluginAction.action, code: pluginErrorCode }
      : undefined
  const onTogglePlugin: ((row: EnterpriseMarketPluginRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      const action: 'install' | 'uninstall' = next ? 'install' : 'uninstall'
      if (next) {
        const versionId = versionIdByPackage.get(row.packageName)
        if (versionId === undefined) {
          // 本机还装着、企业目录里已经没有可安装的版本（下架/版本被撤）：不发请求，也不留静默 no-op。
          setPluginAction({ packageName: row.packageName, action, localCode: 'ENT_RESOURCE_NOT_FOUND' })
          return
        }
        setPluginAction({ packageName: row.packageName, action })
        void store!.installPlugin(row.packageName, versionId)
      } else {
        setPluginAction({ packageName: row.packageName, action })
        void store!.removePlugin(row.packageName)
      }
    }
    : undefined
  const onToggleSkill: ((row: EnterpriseMarketSkillRow, next: boolean) => void) | undefined = hasStore
    ? (row, next) => {
      // 与企业插件同一并发纪律：同一时刻只允许一个技能动作，动作返回的已装清单直接覆盖本地真值。
      if (pendingSkill !== undefined) return
      setPendingSkill({ packageId: row.id, next })
      setSkillActionError(undefined)
      const signal = AbortSignal.timeout(120_000)
      const operation = next ? store!.api.installSkill : store!.api.uninstallSkill
      void operation.call(store!.api, row.id, signal)
        .then(items => setInstalledSkills(items))
        .catch((error: unknown) => {
          // 失败就把该行退回未装态：不保留乐观已装，避免界面比磁盘更乐观。
          if (next) setInstalledSkills(previous => previous.filter(item => item.packageId !== row.id))
          // 并把失败摆到这一行上（稳定错误码 + 安装/卸载前缀）：原先这里只吞错误，用户拨了开关没有任何反应。
          setSkillActionError({ id: row.id, action: next ? 'install' : 'uninstall', code: enterpriseLocalErrorCode(error) })
        })
        .finally(() => setPendingSkill(undefined))
    }
    : undefined
  return (
    <>
      <EnterpriseMarketEntry
        view={view}
        sessionUsable={sessionUsable}
        onOpenLogin={openLogin}
        enterprisePlugins={enterprisePlugins}
        enterpriseSkills={enterpriseSkills}
        onTogglePlugin={onTogglePlugin}
        installedSkills={installedSkills}
        pendingSkill={pendingSkill}
        onToggleSkill={onToggleSkill}
        pluginActionError={pluginActionError}
        skillActionError={skillActionError}
        expandedSections={expandedSections}
        onToggleSection={onToggleSection}
      />
      <EnterpriseLoginDialog store={store as EnterpriseAccountStore} open={dialog.open} onClose={dialog.closeDialog} />
    </>
  )
}
