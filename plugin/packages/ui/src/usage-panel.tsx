/**
 * [INPUT]: 依赖 React（useCallback/useEffect/useRef/useState）、Lucide 的 ChevronDown/ChevronRight/LoaderCircle、account-state 的共享脱敏订阅与错误呈现、local-api 的四窗口 DTO 与失败码投影
 * [OUTPUT]: 对外提供「我的用量」行内折叠块——四窗口三列投影（周期｜剩余额度百分比｜详情）、取数决策 enterpriseUsageFetchDecision、开关与懒加载控制器 useEnterpriseUsageSection，以及展开区组件 EnterpriseUsagePanel 与折叠箭头企业侧渲染 enterpriseUsageChevron
 * [POS]: dsh-ui 个人中心菜单内的用量快捷块（自带展开态，**不是**弹窗）：默认折叠、首次展开才取数，只读 Host 代取的同源路由 `/enterprise/api/v1/local/usage`（Access Token 不进浏览器）；开关状态由 account-menu 持有，展开区在同一棵树里渲染
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  enterpriseErrorDisplay,
  enterpriseSessionUsable,
  useAccount,
} from './account-state.js'
import type { EnterpriseAccountStore } from './account-store.js'
import {
  enterpriseLocalErrorCode,
  type EnterpriseQuotaUsagePolicy,
  type EnterpriseTokenWindowUsage,
} from './local-api.js'

/** 四个自然窗口的稳定键与显示顺序；顺序即产品顺序，与中心 `usage/me` 的语义一一对应。 */
export const ENTERPRISE_USAGE_WINDOW_KEYS = ['fiveHours', 'daily', 'weekly', 'monthly'] as const

export type EnterpriseUsageWindowKey = typeof ENTERPRISE_USAGE_WINDOW_KEYS[number]

/** 展开区的三列标题（周期｜剩余额度｜详情），列序即产品口径，行与表头共用同一个模板。 */
export const ENTERPRISE_USAGE_COLUMNS = ['周期', '剩余额度', '详情'] as const

/** 窗口中文标签固定为「5 小时 / 日 / 周 / 月」，与 client-plugin 的用量投影用词同源。 */
const WINDOW_LABELS: Readonly<Record<EnterpriseUsageWindowKey, string>> = {
  fiveHours: '5 小时',
  daily: '日',
  weekly: '周',
  monthly: '月',
}

/** 详情列本期的唯一事实：没有详情页可跳，点了就说清尚未上线，不做假跳转、不留死链。 */
export const ENTERPRISE_USAGE_DETAILS_HINT = 'Token 统计详情页即将上线'

/** 未登录时的展开区引导语：与旧弹窗同一句话，用户看到的词汇不变。 */
export const ENTERPRISE_USAGE_SIGNED_OUT_HINT = '登录企业账号后可查看本人四个窗口的 Token 用量。'

/** 单个窗口的呈现事实：限额/已用/剩余/重置时刻与三条派生判定。 */
export interface EnterpriseUsageWindowView {
  readonly key: EnterpriseUsageWindowKey
  readonly label: string
  readonly limit: number | null
  readonly usedTokens: number
  readonly reservedTokens: number
  readonly resetsAt: string | null
  /** 已用占限额的百分比；无上限或非法上限时不给数字，避免界面出现 Infinity/NaN。 */
  readonly percent: number | null
  /** 剩余额度百分比（含在途预留）；本行显示的是它，而不是已用百分比。 */
  readonly remainingPercent: number | null
  /** 耗尽判定用「已用 + 已预留」：预留代表在途请求已经占住的额度。 */
  readonly exhausted: boolean
  /** 剩余额度 = 限额 − 已用 − 预留，下限 0；无上限时为 null。 */
  readonly remainingTokens: number | null
}

/** 一条策略的呈现事实：标题与按产品顺序排列的生效窗口。 */
export interface EnterpriseUsagePolicyView {
  readonly policyId: string
  readonly title: string
  readonly windows: readonly EnterpriseUsageWindowView[]
}

/** 百分比：上限内保留一位小数并封顶 100；口径与 client-plugin 的 `toPercent` 相同。 */
export function enterpriseUsagePercent(usedTokens: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null
  return Math.min(100, Math.round((usedTokens / limit) * 1000) / 10)
}

/** 剩余额度：无上限时不给数字；已用加预留超过限额时收敛到 0，不显示负数。 */
export function enterpriseUsageRemaining(
  usedTokens: number,
  reservedTokens: number,
  limit: number | null,
): number | null {
  if (limit === null) return null
  return Math.max(0, limit - usedTokens - reservedTokens)
}

/**
 * 剩余额度百分比：本行三列里的「剩余额度」列。
 *
 * 与已用百分比互补但**不共用**一个换算：分子是 `enterpriseUsageRemaining` 的结果（已扣预留、下限 0），
 * 因此耗尽时必然恰好是 0（警示色据此判定），而不是被四舍五入成 0.1。
 */
export function enterpriseUsageRemainingPercent(
  usedTokens: number,
  reservedTokens: number,
  limit: number | null,
): number | null {
  const remaining = enterpriseUsageRemaining(usedTokens, reservedTokens, limit)
  if (remaining === null || limit === null || limit <= 0) return null
  return Math.min(100, Math.round((remaining / limit) * 1000) / 10)
}

function windowView(key: EnterpriseUsageWindowKey, window: EnterpriseTokenWindowUsage): EnterpriseUsageWindowView {
  const limit = window.limit
  return {
    key,
    label: WINDOW_LABELS[key],
    limit,
    usedTokens: window.usedTokens,
    reservedTokens: window.reservedTokens,
    resetsAt: window.resetsAt,
    percent: enterpriseUsagePercent(window.usedTokens, limit),
    remainingPercent: enterpriseUsageRemainingPercent(window.usedTokens, window.reservedTokens, limit),
    exhausted: limit !== null && window.usedTokens + window.reservedTokens >= limit,
    remainingTokens: enterpriseUsageRemaining(window.usedTokens, window.reservedTokens, limit),
  }
}

/**
 * 纯投影：策略 → 视图。
 *
 * 不变量：窗口为 null 时**不产出**该窗口（中心只返回生效窗口，UI 不得补零造出「有额度」的错觉）；
 * 输出顺序恒为 fiveHours → daily → weekly → monthly，不按数据存在性重排。
 */
export function enterpriseUsageWindows(policy: EnterpriseQuotaUsagePolicy): readonly EnterpriseUsageWindowView[] {
  const windows: EnterpriseUsageWindowView[] = []
  for (const key of ENTERPRISE_USAGE_WINDOW_KEYS) {
    const window = policy[key]
    if (window === null) continue
    windows.push(windowView(key, window))
  }
  return windows
}

/** 策略标题：资源名可读时用「策略名 · 资源名」，否则只显示策略名；两者都不透传服务端任意结构。 */
export function enterpriseUsagePolicyView(policy: EnterpriseQuotaUsagePolicy): EnterpriseUsagePolicyView {
  const resourceName = policy.resourceName ?? ''
  return {
    policyId: policy.policyId,
    title: resourceName === '' ? policy.name : `${policy.name} · ${resourceName}`,
    windows: enterpriseUsageWindows(policy),
  }
}

/** 千分位分组不依赖 ICU：任何运行环境的输出一致，界面与测试看到同一个字符串。 */
export function enterpriseTokenText(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 额度文案：无上限是「不限」，有上限就是分组后的数字。 */
export function enterpriseUsageAmountText(value: number | null): string {
  return value === null ? '不限' : enterpriseTokenText(value)
}

/** 剩余额度列文案：无上限不给数字（「不限」），其余是百分比。 */
export function enterpriseUsageRemainingText(window: EnterpriseUsageWindowView): string {
  return window.remainingPercent === null ? '不限' : `${window.remainingPercent}%`
}

/** 重置时刻按浏览器本地时区显示；未提供或不可解析时如实说「未提供」，不渲染 Invalid Date。 */
export function enterpriseUsageResetText(resetsAt: string | null): string {
  if (resetsAt === null) return '未提供'
  const at = new Date(resetsAt)
  if (Number.isNaN(at.getTime())) return '未提供'
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/**
 * 取数决策（纯函数，唯一判断点）：折叠态一律不发请求；同一个账号/连接代次只取一次
 * （`loaded` 由调用方按「本次代次是否已经取过」给出），只有显式刷新才会把 loaded 打回 false。
 */
export type EnterpriseUsageFetchDecision = 'skip' | 'signed-out' | 'fetch'

export function enterpriseUsageFetchDecision(input: {
  readonly expanded: boolean
  readonly usable: boolean
  readonly loaded: boolean
}): EnterpriseUsageFetchDecision {
  if (!input.expanded || input.loaded) return 'skip'
  return input.usable ? 'fetch' : 'signed-out'
}

/** 展开区的四个互斥状态；`ready` 的空数组表示中心没有生效配额，不是错误。 */
export type EnterpriseUsagePanelState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly policies: readonly EnterpriseQuotaUsagePolicy[] }
  | { readonly kind: 'failed'; readonly errorCode: string }

export interface EnterpriseUsageSectionController {
  /** 行是否展开；默认 false（首次渲染没有任何数据行）。 */
  readonly expanded: boolean
  readonly state: EnterpriseUsagePanelState
  readonly toggle: () => void
  /** 展开区里的「刷新」：绕过 loaded 判定重新取一次；没有可用会话时什么都不做。 */
  readonly refresh: () => void
}

/**
 * 折叠块的唯一状态持有者：展开态与取数结果都住在这里，展开区由调用方在同一棵树里渲染。
 * 开关与元素分家就是线上那种「点了没反应」，所以这里不把结果交给外部（无 store、无事件总线）。
 */
export function useEnterpriseUsageSection(store: EnterpriseAccountStore): EnterpriseUsageSectionController {
  const snapshot = useAccount(store)
  const [expanded, setExpanded] = useState(false)
  const [state, setState] = useState<EnterpriseUsagePanelState>({ kind: 'idle' })
  const [reload, setReload] = useState(0)
  const usable = enterpriseSessionUsable(snapshot.status?.state)
  // 代次键：账号或连接代次一变，缓存的事实作废，展开时重新取一次。
  const generation = `${snapshot.status?.revision ?? ''}|${snapshot.status?.user?.id ?? ''}|${String(usable)}`
  const fetched = useRef<string | undefined>(undefined)
  const token = `${generation}#${reload}`

  useEffect(() => {
    fetched.current = undefined
    setState({ kind: 'idle' })
  }, [generation])

  useEffect(() => {
    const decision = enterpriseUsageFetchDecision({
      expanded,
      loaded: fetched.current === token,
      usable,
    })
    if (decision === 'skip') return
    if (decision === 'signed-out') {
      setState({ kind: 'signed-out' })
      return
    }
    fetched.current = token
    const request = new AbortController()
    setState({ kind: 'loading' })
    /** 被折叠/卸载打断的取数必须允许下一次展开重试；已完成的取数保留结果，避免重复请求。 */
    const abandonIfInterrupted = (): boolean => {
      if (!request.signal.aborted) return false
      if (fetched.current === token) fetched.current = undefined
      return true
    }
    void (async () => {
      try {
        const policies = await store.api.usage(request.signal)
        if (abandonIfInterrupted()) return
        setState({ kind: 'ready', policies })
      } catch (error) {
        if (abandonIfInterrupted()) return
        setState({ kind: 'failed', errorCode: enterpriseLocalErrorCode(error) })
      }
    })()
    return () => { request.abort() }
  }, [expanded, store, token, usable])

  const toggle = useCallback(() => { setExpanded(current => !current) }, [])
  const refresh = useCallback(() => {
    if (!usable) return
    fetched.current = undefined
    setReload(current => current + 1)
  }, [usable])
  return { expanded, refresh, state, toggle }
}

/** 折叠箭头：展开时朝下、折叠时朝右；两个图形都来自 Lucide（官方接缝里没有这两颗图标）。 */
export function enterpriseUsageChevron(expanded: boolean): ReactNode {
  return expanded ? <ChevronDown aria-hidden size={14} /> : <ChevronRight aria-hidden size={14} />
}

export interface EnterpriseUsageRowContentProps {
  readonly expanded: boolean
}

/** 行内右侧：折叠箭头；`data-expanded` 供样式与测试识别当前态，行本体仍是官方 MenuItemButton。 */
export function EnterpriseUsageRowContent(props: EnterpriseUsageRowContentProps): ReactNode {
  return <span aria-hidden className="own-usage-chevron" data-expanded={props.expanded ? 'true' : 'false'}>
    {enterpriseUsageChevron(props.expanded)}
  </span>
}

export interface EnterpriseUsagePanelProps {
  readonly state: EnterpriseUsagePanelState
  readonly onRefresh: () => void
  /**
   * 详情页接缝：本期调用方不传，于是详情按钮是不可用态 + 「即将上线」提示；未来设置页另起一页时
   * 只需在这一处把真实跳转接上，行结构与三列布局都不动。
   */
  readonly onOpenUsageDetails?: (() => void) | undefined
}

/**
 * 展开区：三列表头 + 每个生效策略一张三列清单；加载/失败/未登录三态都在这里收敛，
 * 失败文案复用 account-state 既有错误码映射，不另写一套。
 */
export function EnterpriseUsagePanel(props: EnterpriseUsagePanelProps): ReactNode {
  const [detailsHint, setDetailsHint] = useState(false)
  const openDetails = (): void => {
    if (props.onOpenUsageDetails !== undefined) { props.onOpenUsageDetails(); return }
    setDetailsHint(true)
  }
  const errorDisplay = props.state.kind === 'failed' ? enterpriseErrorDisplay(props.state.errorCode) : undefined
  const refreshable = props.state.kind === 'ready' || props.state.kind === 'failed'
  return <div aria-label="我的用量" className="own-usage-panel" role="group">
    {props.state.kind === 'idle' || props.state.kind === 'loading'
      ? <p className="own-usage-hint" role="status">
        <LoaderCircle aria-hidden className="own-menu-spin" size={14} />正在读取企业用量…
      </p>
      : null}
    {props.state.kind === 'signed-out'
      ? <p className="own-usage-hint">{ENTERPRISE_USAGE_SIGNED_OUT_HINT}</p>
      : null}
    {errorDisplay === undefined
      ? null
      : <p className="own-usage-error" role="alert">
        {errorDisplay.message}{errorDisplay.code === undefined ? null : `（${errorDisplay.code}）`}
      </p>}
    {props.state.kind === 'ready'
      ? (props.state.policies.length === 0
        ? <p className="own-usage-hint">当前没有生效的企业配额。</p>
        : props.state.policies.map(policy => {
          const view = enterpriseUsagePolicyView(policy)
          return <section className="own-usage-policy" key={view.policyId}>
            <h3 className="own-usage-policy-title">{view.title}</h3>
            <div className="own-usage-head">
              {ENTERPRISE_USAGE_COLUMNS.map(column => <span className="own-usage-head-cell" key={column}>{column}</span>)}
            </div>
            {view.windows.length === 0
              ? <p className="own-usage-hint">该策略当前没有生效窗口。</p>
              : view.windows.map(window => <div className="own-usage-item" key={window.key}>
                <span className="own-usage-period">{window.label}</span>
                <span
                  className="own-usage-percent"
                  data-exhausted={window.exhausted ? 'true' : 'false'}
                  title={`限额 ${enterpriseUsageAmountText(window.limit)} · 已用 ${enterpriseTokenText(window.usedTokens)} · 剩余 ${enterpriseUsageAmountText(window.remainingTokens)}`}
                >{enterpriseUsageRemainingText(window)}</span>
                <button
                  aria-disabled="true"
                  className="own-usage-details"
                  onClick={openDetails}
                  type="button"
                >详情</button>
              </div>)}
          </section>
        }))
      : null}
    {detailsHint && props.onOpenUsageDetails === undefined
      ? <p className="own-usage-notice" role="status">{ENTERPRISE_USAGE_DETAILS_HINT}</p>
      : null}
    {refreshable
      ? <button className="own-usage-refresh" onClick={props.onRefresh} type="button">刷新</button>
      : null}
  </div>
}
