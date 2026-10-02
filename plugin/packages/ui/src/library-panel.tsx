/**
 * [INPUT]: 依赖 React（useSyncExternalStore/useEffect）、lucide-react 的 Upload 与 RefreshCw、官方 ui-primitives 的 Button、list-state 的唯一四态状态机与唯一取数源 `createEnterpriseListSource`（含共用的重试文案）、error-notice 的唯一失败呈现 `EnterpriseErrorNotice`、以及 local-api 的 `EnterpriseLocalApiError`（只为一个稳定码，不发任何请求）
 * [OUTPUT]: 资料库**页面主体**：目录取数源 `createEnterpriseLibraryCatalogSource`（端口缺席＝宿主面还没接线时**如实**出 `ENT_LIBRARY_UNAVAILABLE`，绝不回落成空列表）、纯呈现 `EnterpriseLibraryPanelView`（加载中／空／失败四态之一 + 未接入控件的禁用与原因）、含 hook 的宿主 `EnterpriseLibraryPanel`（订阅取数源并在挂载时发起一次取数），以及页面文案常量 `ENTERPRISE_LIBRARY_{PAGE_LABEL,PAGE_NOTE,LOADING,EMPTY,EMPTY_NEXT,FAILED_PREFIX,UPLOAD,SEARCH_LABEL,SEARCH_PLACEHOLDER,NOT_WIRED,NOT_WIRED_ID}`
 * [POS]: ui 的资料库页（侧栏一级入口点进去的 main 面板内容）。三态齐备、零白屏、零死按钮：加载中给轻提示、空说清「还没有内容」+ 下一步、失败给人话 + 下一步 + **真的重发**的重试；上传／查找这些还没接上的控件**一律禁用并把原因写在页面上**（不是只挂在 title 里）。本页不发明宿主路由：数据只能从注入的取数端口进来，端口缺席时如实说「接入中」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { RefreshCw, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useSyncExternalStore } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { EnterpriseErrorNotice } from './error-notice.js'
import {
  ENTERPRISE_LIST_RETRY,
  ENTERPRISE_LIST_RETRY_LABEL,
  createEnterpriseListSource,
  type EnterpriseListSource,
  type EnterpriseListState,
} from './list-state.js'
import { EnterpriseLocalApiError } from './local-api.js'

/** 页面标题（与侧栏入口同一句话；入口的可见文案由官方侧栏按 `sidebar.panellist` 的 metadata 渲染）。 */
export const ENTERPRISE_LIBRARY_PAGE_LABEL = '资料库'

/** 页面说明：一句话说清这里是干什么的（员工词，不出现任何技术缩写）。 */
export const ENTERPRISE_LIBRARY_PAGE_NOTE = '把你的资料集中放好，随时取用。'

/** 加载中：轻提示（不扔骨架、不留白屏）。 */
export const ENTERPRISE_LIBRARY_LOADING = '正在读取资料库，请稍候…'

/** 空态第一句：说清「为什么这里什么都没有」。 */
export const ENTERPRISE_LIBRARY_EMPTY = '资料库还没有内容。'

/** 空态第二句：下一步该做什么（上传还没接上，所以指到「有人放进来之后重试」这条真实可达的路）。 */
export const ENTERPRISE_LIBRARY_EMPTY_NEXT = `下一步：等企业管理员放进资料后，点「${ENTERPRISE_LIST_RETRY}」即可看到。`

/** 失败态的动作前缀（人话与下一步由 error-messages.ts 的唯一映射给，本页不自造一句）。 */
export const ENTERPRISE_LIBRARY_FAILED_PREFIX = '资料库读取失败'

/** 上传控件（**未接入**：见 `ENTERPRISE_LIBRARY_NOT_WIRED`）。 */
export const ENTERPRISE_LIBRARY_UPLOAD = '上传资料'

/** 查找框的无障碍名（控件本身也是未接入的，但无障碍名不能因此省掉）。 */
export const ENTERPRISE_LIBRARY_SEARCH_LABEL = '查找资料'

/** 查找框的占位文案。 */
export const ENTERPRISE_LIBRARY_SEARCH_PLACEHOLDER = '输入名称查找资料'

/** 未接入控件**写在页面上**的原因（零死按钮：禁用一定配一句为什么）。 */
export const ENTERPRISE_LIBRARY_NOT_WIRED = '资料库接入中，暂不可用'

/** 那句原因在 DOM 里的 id（两个禁用控件各自用 `aria-describedby` 指过来，读屏也听得到原因）。 */
export const ENTERPRISE_LIBRARY_NOT_WIRED_ID = 'own-library-not-wired'

/** 目录里的一行：界面只需要「一个稳定的标识 + 一行标题」这两件事实（多一个字都不猜）。 */
export interface EnterpriseLibraryItem {
  readonly id: string
  readonly title: string
}

/** 本页唯一的取数源类型（入口层与 `main` 座位的 inject 面都只认这一份形状）。 */
export type EnterpriseLibrarySource = EnterpriseListSource<readonly EnterpriseLibraryItem[]>

/**
 * 目录取数端口：由宿主侧接过来（`main` 座位的 `inject` 面）。
 * 这一刀宿主侧还没有可接入的资料库读面，因此真运行时这个端口**缺席**，页面如实说「接入中」。
 */
export type EnterpriseLibraryCatalogLoader = (signal: AbortSignal) => Promise<readonly EnterpriseLibraryItem[]>

/**
 * 建资料库目录的取数源（四态 + 真重发都由 `createEnterpriseListSource` 那份唯一状态机给）。
 *
 * 端口缺席时**如实抛** `ENT_LIBRARY_UNAVAILABLE`（页面出「接入中」的失败态 + 重试），
 * 绝不回落成空列表——那会让员工以为「公司没给我资料」，是本仓明令消灭的静默吞失败。
 *
 * @param load - 宿主侧注入的目录取数；缺席＝资料库还没接线。
 * @returns 取数源（非 React，测试可直调 `retry()` 数请求轮次）。
 */
export function createEnterpriseLibraryCatalogSource(
  load?: EnterpriseLibraryCatalogLoader,
): EnterpriseLibrarySource {
  return createEnterpriseListSource<readonly EnterpriseLibraryItem[]>({
    load: load ?? (() => Promise.reject(new EnterpriseLocalApiError('ENT_LIBRARY_UNAVAILABLE'))),
    isEmpty: value => value.length === 0,
    // 本页的失败只可能是「资料库这一层的事」：带稳定码的照原样交出去，其余一律落资料库自己的码。
    errorCode: error => (error instanceof EnterpriseLocalApiError ? error.code : 'ENT_LIBRARY_UNAVAILABLE'),
  })
}

/** 页面样式：只在本页挂载时进 DOM，类名 `own-library-*` 与同包其它源文件零交集；颜色一律取 `--dsw-*` token。 */
const libraryStyles = `
.own-library-page{box-sizing:border-box;display:flex;flex-direction:column;gap:16px;height:100%;min-width:0;padding:24px 28px;color:var(--dsw-alias-label-primary,#101828)}
.own-library-head{display:flex;flex-direction:column;gap:4px;min-width:0}
.own-library-title{margin:0;font-size:18px;line-height:26px;font-weight:600}
.own-library-note{margin:0;color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:20px}
.own-library-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;min-width:0}
.own-library-search{box-sizing:border-box;height:28px;min-width:200px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3,#d0d5dd);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:13px}
.own-library-search:disabled{cursor:default;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-library-notWired{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px}
.own-library-body{min-width:0}
.own-library-hint{margin:0;display:flex;flex-direction:column;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:20px}
.own-library-hint p{margin:0}
.own-library-error{padding:0;text-align:left;font-size:13px;line-height:20px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
.own-library-actions{margin-top:8px}
.own-library-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.own-library-item{padding:10px 2px;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);font-size:13.5px;line-height:20px;overflow-wrap:anywhere}
.own-library-item:last-child{border-bottom:0}
`

/**
 * 资料库页面（**纯函数**，无 hook，可直接函数调用测试）。
 *
 * 三态互斥由 `state.kind` 一人决定：加载中只说「正在读取」，空说清「还没有内容 + 下一步」，
 * 失败渲染唯一的失败呈现（人话 + 下一步 + 「技术信息」里的稳定码）并给**真的重发**的重试。
 * 「重试」按钮只在回调接通时出现（不给死按钮）。
 *
 * @param state - 目录四态之一（取自 `createEnterpriseLibraryCatalogSource`）。
 * @param onReload - 重试（用户点它＝真的再取一次）；缺席即不渲染那枚按钮。
 */
export function EnterpriseLibraryPanelView({
  state,
  onReload,
}: {
  readonly state: EnterpriseListState<readonly EnterpriseLibraryItem[]>
  readonly onReload?: (() => void) | undefined
}): ReactNode {
  const reload = onReload === undefined ? null : (
    <div className="own-library-actions">
      <Button
        size="sm"
        icon={<RefreshCw aria-hidden="true" size={14} />}
        aria-label={ENTERPRISE_LIST_RETRY_LABEL}
        onClick={() => { onReload() }}
      >
        {ENTERPRISE_LIST_RETRY}
      </Button>
    </div>
  )
  let body: ReactNode
  if (state.kind === 'loading') {
    body = <p className="own-library-hint" role="status">{ENTERPRISE_LIBRARY_LOADING}</p>
  } else if (state.kind === 'empty') {
    body = (
      <>
        <div className="own-library-hint" role="status">
          <p>{ENTERPRISE_LIBRARY_EMPTY}</p>
          <p>{ENTERPRISE_LIBRARY_EMPTY_NEXT}</p>
        </div>
        {/* 重试按钮放在 `role="status"` 之外：live region 里不放可交互控件（读屏会把它当提示语念一遍）。 */}
        {reload}
      </>
    )
  } else if (state.kind === 'failed') {
    body = (
      <div className="own-library-body">
        <EnterpriseErrorNotice className="own-library-error" code={state.code} prefix={ENTERPRISE_LIBRARY_FAILED_PREFIX} />
        {reload}
      </div>
    )
  } else {
    body = (
      <ul className="own-library-items">
        {state.value.map(item => (
          <li key={item.id} className="own-library-item" data-enterprise-library-item={item.id}>{item.title}</li>
        ))}
      </ul>
    )
  }
  return (
    <section className="own-library-page" aria-label={ENTERPRISE_LIBRARY_PAGE_LABEL} data-enterprise-library-state={state.kind}>
      <style>{libraryStyles}</style>
      <header className="own-library-head">
        <h2 className="own-library-title">{ENTERPRISE_LIBRARY_PAGE_LABEL}</h2>
        <p className="own-library-note">{ENTERPRISE_LIBRARY_PAGE_NOTE}</p>
      </header>
      {/* 未接入的两枚控件：**禁用 + 页面上写着原因**（不是只有 title），并用 aria-describedby 指过去。 */}
      <div className="own-library-toolbar">
        <Button
          variant="outline"
          size="sm"
          disabled
          aria-describedby={ENTERPRISE_LIBRARY_NOT_WIRED_ID}
          icon={<Upload aria-hidden="true" size={14} />}
        >
          {ENTERPRISE_LIBRARY_UPLOAD}
        </Button>
        <input
          className="own-library-search"
          type="search"
          aria-label={ENTERPRISE_LIBRARY_SEARCH_LABEL}
          aria-describedby={ENTERPRISE_LIBRARY_NOT_WIRED_ID}
          disabled
          placeholder={ENTERPRISE_LIBRARY_SEARCH_PLACEHOLDER}
        />
        <span className="own-library-notWired" id={ENTERPRISE_LIBRARY_NOT_WIRED_ID}>{ENTERPRISE_LIBRARY_NOT_WIRED}</span>
      </div>
      {body}
    </section>
  )
}

/** 没有取数源（纯函数直调／座位还没注入）时 `useSyncExternalStore` 用的恒定快照与空订阅：引用必须稳定。 */
const LIBRARY_LOADING_SNAPSHOT: EnterpriseListState<readonly EnterpriseLibraryItem[]> = { kind: 'loading' }
const LIBRARY_NOOP_SUBSCRIBE = (): (() => void) => () => undefined
const LIBRARY_LOADING_GET_SNAPSHOT = (): EnterpriseListState<readonly EnterpriseLibraryItem[]> => LIBRARY_LOADING_SNAPSHOT

/**
 * 官方 `main` 槽（key = `library`）上的页面宿主：订阅取数源、挂载即取一次、卸载即中止。
 *
 * 它只做接线（订阅 + 生命周期），呈现全部交给纯函数 `EnterpriseLibraryPanelView`，
 * 因此「页面长什么样」这件事在测试里不需要 DOM。
 *
 * @param source - 由注册面的 `inject` 注入的取数源；缺席时页面停在「加载中」的恒定快照（不假装空）。
 */
export function EnterpriseLibraryPanel({
  source,
}: {
  readonly source?: EnterpriseLibrarySource | undefined
}): ReactNode {
  const state = useSyncExternalStore(
    source?.subscribe ?? LIBRARY_NOOP_SUBSCRIBE,
    source?.getSnapshot ?? LIBRARY_LOADING_GET_SNAPSHOT,
    source?.getSnapshot ?? LIBRARY_LOADING_GET_SNAPSHOT,
  )
  useEffect(() => {
    if (source === undefined) return
    // 幂等启动：已有结果或用例重复挂载都不会打出第二条请求。
    source.load()
    // 离开页面即中止在途并回到初始加载态（迟到结果由源的代际守卫丢弃）。
    return () => { source.reset() }
  }, [source])
  return (
    <EnterpriseLibraryPanelView
      state={state}
      onReload={source === undefined ? undefined : () => { source.retry() }}
    />
  )
}
