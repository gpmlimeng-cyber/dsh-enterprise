/**
 * [INPUT]: 依赖 react 的 ReactNode、lucide-react 图标、官方 ui-primitives 的 Button，
 *           以及 marketplace-entry 的既有类型（EnterpriseMarketTabId / EnterpriseMarketShellModel 等）
 *           ——骨架阶段先只吃纯输入（文案 + 计数 + 回调），不接 store。
 * [OUTPUT]: 对外提供个性化页的三栏骨架组件 EnterprisePersonalizationShell：
 *           第一栏（左上标题 + 右上按钮组）→ 第二栏（全局 / 预设）→ 第三栏（功能页签 + 工具栏 + 内容区）。
 * [POS]: ui 的新页面框架副本（feat/personalization 线），与 marketplace-entry 的旧页签外壳并行存在，
 *        骨架阶段不替换旧外壳，等取值与数据接线齐了再做落点切换。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Grid2X2, List, Plus, RefreshCw, Search } from 'lucide-react'

/* ───────────────────────── 骨架真源（文案 + 结构） ───────────────────────── */

/** 页面主标题（第一栏左上角）。 */
export const ENTERPRISE_PERSONALIZATION_TITLE = '技能'

/** 页面副标题（标题下一句灰色说明）。 */
export const ENTERPRISE_PERSONALIZATION_SUBTITLE = '配置当前智能体的技能、工具、插件、子智能体与记忆。'

/** 第一栏右上角按钮组：原四页签的按钮化（用户口径「原页签对应第一栏右上角的按钮组」）。 */
export const ENTERPRISE_PERSONALIZATION_TOP_ACTIONS = [
  { id: 'skills', label: '技能' },
  { id: 'subagents', label: '子智能体' },
  { id: 'tools', label: '工具' },
  { id: 'plugins', label: '插件' },
  { id: 'memory', label: '记忆' },
] as const

export type EnterprisePersonalizationTopActionId = (typeof ENTERPRISE_PERSONALIZATION_TOP_ACTIONS)[number]['id']

/** 第二栏（分组胶囊）：用户口径「全局 + 预设」。 */
export const ENTERPRISE_PERSONALIZATION_GROUPS = [
  { id: 'global', label: '全局' },
  { id: 'preset', label: '预设' },
] as const

export type EnterprisePersonalizationGroupId = (typeof ENTERPRISE_PERSONALIZATION_GROUPS)[number]['id']

/** 第三栏功能页签（用户口径四枚：已安装技能 / 内置技能 / 技能市场 / 技能包）。 */
export const ENTERPRISE_PERSONALIZATION_TABS = [
  { id: 'installed', label: '已安装技能' },
  { id: 'builtin', label: '内置技能' },
  { id: 'market', label: '技能市场' },
  { id: 'packages', label: '技能包' },
] as const

export type EnterprisePersonalizationTabId = (typeof ENTERPRISE_PERSONALIZATION_TABS)[number]['id']

/** 功能页签默认选中「已安装技能」（有真实数据的一枚）。 */
export const ENTERPRISE_PERSONALIZATION_DEFAULT_TAB: EnterprisePersonalizationTabId = 'installed'

/** 第三栏工具栏左侧统计文案：技能市场/已安装技能用真实计数；技能包一期为预留（计数 0 时不出占位）。 */
export function enterprisePersonalizationCountText(count: number): string {
  return `共 ${count} 个技能`
}

/** 视图模式（卡片 / 表格）——骨架阶段默认卡片，由调用方持有。 */
export type EnterprisePersonalizationViewMode = 'card' | 'table'

/* ───────────────────────── 骨架 Props ───────────────────────── */

export interface EnterprisePersonalizationShellProps {
  /** 第二栏当前分组（缺席取默认「全局」）。 */
  readonly activeGroup?: EnterprisePersonalizationGroupId | undefined
  /** 切换第二栏分组；缺席时胶囊不可点（不给死按钮——本骨架的回调都是可选的）。 */
  readonly onSelectGroup?: ((group: EnterprisePersonalizationGroupId) => void) | undefined
  /** 第三栏当前功能页签（缺席取「已安装技能」）。 */
  readonly activeTab?: EnterprisePersonalizationTabId | undefined
  /** 切换功能页签。 */
  readonly onSelectTab?: ((tab: EnterprisePersonalizationTabId) => void) | undefined
  /** 内容区统计计数（当前页签要渲染的技能条数）。 */
  readonly count?: number | undefined
  /** 视图模式（卡片 / 表格）。 */
  readonly viewMode?: EnterprisePersonalizationViewMode | undefined
  /** 切换视图模式。 */
  readonly onViewMode?: ((mode: EnterprisePersonalizationViewMode) => void) | undefined
  /** 刷新（真的重发一次取数）。 */
  readonly onRefresh?: (() => void) | undefined
  /** 导入技能（占位动作，一期先回调）。 */
  readonly onImport?: (() => void) | undefined
  /** 创建技能（占位动作，一期先回调）。 */
  readonly onCreate?: (() => void) | undefined
  /** 搜索关键词（内容区列表的过滤词，一期只回显）。 */
  readonly search?: string | undefined
  /** 搜索变化回调。 */
  readonly onSearch?: ((value: string) => void) | undefined
  /** 内容区正文（当前页签的真实列表；骨架阶段由调用方注入，缺席时画占位）。 */
  readonly children?: ReactNode | undefined
}

/* ───────────────────────── 骨架样式 ───────────────────────── */

const skeletonStyles = `
/* 第一栏：左上标题（h2 + 副标题）+ 右上按钮组。顶部一行两头对齐。 */
.own-pers-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;min-width:0}
.own-pers-title{margin:0;font-size:18px;line-height:26px;font-weight:600;color:var(--dsw-alias-label-primary,#101828);letter-spacing:-0.01em}
.own-pers-subtitle{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:20px}
.own-pers-topActions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none}
.own-pers-topAction{border:1px solid transparent;border-radius:var(--dsw-radius-md,8px);padding:5px 10px;background:transparent;color:var(--dsw-alias-label-secondary,#667085);font:inherit;font-size:13px;line-height:20px;cursor:pointer;white-space:nowrap}
.own-pers-topAction:hover{background:var(--dsw-alias-bg-skeleton,#f2f4f7);color:var(--dsw-alias-label-primary,#101828)}
.own-pers-topAction[aria-pressed='true']{background:var(--dsw-alias-bg-skeleton,#f2f4f7);border-color:var(--dsw-alias-border-l2,#e4e7ec);color:var(--dsw-alias-label-primary,#101828);font-weight:500}
.own-pers-topAction:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}

/* 第二栏：分组胶囊（全局 / 预设）。 */
.own-pers-groups{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;min-width:0}
.own-pers-group{border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:999px;padding:4px 12px;background:transparent;color:var(--dsw-alias-label-secondary,#667085);font:inherit;font-size:13px;line-height:20px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.own-pers-group:hover{border-color:var(--dsw-alias-border-l1,#e4e7ec);color:var(--dsw-alias-label-primary,#101828)}
.own-pers-group[aria-pressed='true']{background:var(--dsw-alias-brand-primary,#2563eb);border-color:var(--dsw-alias-brand-primary,#2563eb);color:#fff}
.own-pers-group:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}

/* 第三栏：功能页签条（复用旧页签的下划线形态）。 */
.own-pers-tabs{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:22px;min-width:0;margin-top:16px;border-bottom:1px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-pers-tab{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary,#667085);cursor:pointer;font:inherit;font-size:13px;line-height:20px;margin-bottom:-1px;padding:7px 1px 8px;white-space:nowrap}
.own-pers-tab:hover{color:var(--dsw-alias-label-primary,#101828)}
.own-pers-tab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:2px}
.own-pers-tab[aria-selected='true']{border-bottom-color:var(--dsw-alias-label-primary,#101828);color:var(--dsw-alias-label-primary,#101828);font-weight:500}

/* 第三栏工具栏：左统计 + 右（搜索 / 卡片表格切换 / 刷新 / 导入 / 创建）。 */
.own-pers-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;min-width:0}
.own-pers-stats{color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:20px;flex:none;font-variant-numeric:tabular-nums}
.own-pers-toolbarSpacer{flex:1;min-width:12px}
.own-pers-search{display:flex;align-items:center;gap:8px;min-width:160px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);border-radius:var(--dsw-radius-md,6px);padding:0 10px;height:32px}
.own-pers-search input{width:100%;min-width:0;border:0;background:none;color:inherit;font:inherit;outline:none}
.own-pers-viewToggle{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,6px);overflow:hidden;flex:none}
.own-pers-viewBtn{display:grid;place-items:center;width:32px;height:32px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#667085);cursor:pointer}
.own-pers-viewBtn:hover{background:var(--dsw-alias-bg-skeleton,#f2f4f7);color:var(--dsw-alias-label-primary,#101828)}
.own-pers-viewBtn[aria-pressed='true']{background:var(--dsw-alias-bg-skeleton,#f2f4f7);color:var(--dsw-alias-label-primary,#101828)}
.own-pers-viewBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,#2563eb);outline-offset:-2px}
.own-pers-actions{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap}

/* 内容区容器（列表先按当前形式落这里）。 */
.own-pers-content{margin-top:16px;min-width:0}
.own-pers-placeholder{padding:32px 12px;text-align:center;color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:20px;border:1px dashed var(--dsw-alias-border-l2,#e4e7ec);border-radius:var(--dsw-radius-md,8px)}
`

/* ───────────────────────── 骨架组件 ───────────────────────── */

/**
 * 个性化页三栏骨架（纯函数，无 hook、无 store、可直接函数调用测试）：
 * 第一栏 = 标题 + 右上按钮组；第二栏 = 分组胶囊；第三栏 = 功能页签 + 工具栏 + 内容区。
 * 所有回调可选，缺席即对应控件不可点或不动作（不给死按钮、不编造数据）。
 */
export function EnterprisePersonalizationShell(props: EnterprisePersonalizationShellProps): ReactNode {
  const activeGroup = props.activeGroup ?? ENTERPRISE_PERSONALIZATION_GROUPS[0].id
  const activeTab = props.activeTab ?? ENTERPRISE_PERSONALIZATION_DEFAULT_TAB
  const viewMode = props.viewMode ?? 'card'
  const count = props.count ?? 0

  return (
    <section className="own-pers" aria-label={ENTERPRISE_PERSONALIZATION_TITLE}>
      <style>{skeletonStyles}</style>

      {/* ── 第一栏：左上标题 + 副标题，右上按钮组（原四页签） ── */}
      <header className="own-pers-header">
        <div>
          <h2 className="own-pers-title">{ENTERPRISE_PERSONALIZATION_TITLE}</h2>
          <p className="own-pers-subtitle">{ENTERPRISE_PERSONALIZATION_SUBTITLE}</p>
        </div>
        <nav className="own-pers-topActions" aria-label="个性化分区">
          {ENTERPRISE_PERSONALIZATION_TOP_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              className="own-pers-topAction"
              aria-pressed={action.id === 'skills'}
              onClick={() => { /* 一期骨架：技能即当前页，其余分区接线后续接 */ }}
            >{action.label}</button>
          ))}
        </nav>
      </header>

      {/* ── 第二栏：分组胶囊（全局 / 预设） ── */}
      <div className="own-pers-groups" role="group" aria-label="技能分组">
        {ENTERPRISE_PERSONALIZATION_GROUPS.map(group => (
          <button
            key={group.id}
            type="button"
            className="own-pers-group"
            aria-pressed={group.id === activeGroup}
            disabled={props.onSelectGroup === undefined}
            onClick={() => { props.onSelectGroup?.(group.id) }}
          >{group.label}</button>
        ))}
      </div>

      {/* ── 第三栏：功能页签 ── */}
      <div role="tablist" aria-label="技能视图" className="own-pers-tabs">
        {ENTERPRISE_PERSONALIZATION_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            className="own-pers-tab"
            tabIndex={tab.id === activeTab ? 0 : -1}
            onClick={() => { props.onSelectTab?.(tab.id) }}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── 第三栏工具栏：左统计 + 右（搜索 / 卡片表格 / 刷新 / 导入 / 创建） ── */}
      <div className="own-pers-toolbar">
        <span className="own-pers-stats">{enterprisePersonalizationCountText(count)}</span>
        <span className="own-pers-toolbarSpacer" />
        <label className="own-pers-search">
          <Search aria-hidden size={14} />
          <input
            value={props.search ?? ''}
            onChange={event => { props.onSearch?.(event.currentTarget.value) }}
            placeholder="搜索技能"
            aria-label="搜索技能"
          />
        </label>
        <div className="own-pers-viewToggle" role="group" aria-label="视图切换">
          <button
            type="button"
            className="own-pers-viewBtn"
            aria-pressed={viewMode === 'card'}
            aria-label="卡片视图"
            onClick={() => { props.onViewMode?.('card') }}
          ><Grid2X2 aria-hidden size={16} /></button>
          <button
            type="button"
            className="own-pers-viewBtn"
            aria-pressed={viewMode === 'table'}
            aria-label="表格视图"
            onClick={() => { props.onViewMode?.('table') }}
          ><List aria-hidden size={16} /></button>
        </div>
        <div className="own-pers-actions">
          <Button
            size="sm"
            icon={<RefreshCw aria-hidden size={14} />}
            onClick={() => { props.onRefresh?.() }}
          >刷新</Button>
          <Button
            size="sm"
            icon={<Plus aria-hidden size={14} />}
            onClick={() => { props.onImport?.() }}
          >导入技能</Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus aria-hidden size={14} />}
            onClick={() => { props.onCreate?.() }}
          >创建技能</Button>
        </div>
      </div>

      {/* ── 内容区：当前页签的真实列表（一期先按当前列表形式落这里） ── */}
      <div className="own-pers-content">
        {props.children ?? <div className="own-pers-placeholder">内容区（{ENTERPRISE_PERSONALIZATION_TABS.find(tab => tab.id === activeTab)?.label ?? ''}）</div>}
      </div>
    </section>
  )
}
