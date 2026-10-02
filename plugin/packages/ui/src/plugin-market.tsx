/**
 * [INPUT]: 依赖共享 EnterpriseAccountStore 的企业目录/本机事实、Harness Modal/Button 与 Lucide 图标
 * [OUTPUT]: 提供设置页内的插件搜索/已安装筛选、版本详情、显式安装/卸载及状态文案。**本刀（失败文案降维）**：删除本文件的插件码表，失败一律渲染 `EnterpriseErrorNotice`（人话 + 「下一步：」+「技术信息」里的稳定码），兜底不再把码拼进可见句子 **本刀（目录三态 + 可重试）**：新增纯投影 `enterprisePluginCatalogState` / `enterprisePluginCatalogEmptyText` / `enterprisePluginCatalogVersionText`，目录四态（未登录 / 加载中 / 失败 / 空（三种原因）/ 就绪）显式化；失败态给唯一提示组件 + 真重发的重试，目录没取到时详情那一格不再谎称「已下架」。 **本刀（死开关改造）**：安装按钮原先 `disabled={busy || !connected || fatal !== undefined || item.installErrorCode !== undefined || waiting}` 且一句 `title` 都没有——禁用了却一个字不说，是产品宪法禁止的死控件。现改为：① 新增纯投影 `enterprisePluginRowGate`（唯一入口）与 `EnterprisePluginRowGate`/`EnterprisePluginGateNotes`，禁用原因全部来自新叶 `plugin-install-gate.ts` 的 `enterprisePluginLockReason`（目录判定 / 在途 / 等重启 / 别的操作用着 / 状态读不到），`installErrorCode` 只拦安装、不拦卸载；② 每一枚禁用都配**行上可见**的一句（`role="status"`，落点复用既有 `.own-market-sub`，不新增 CSS）与一句悬浮说明 `enterprisePluginSwitchTitle`；③ 平台彻底退出决策面：目录声明的 `operatingSystems` 与设备系统都不再进来（数据面字段照旧随行携带），卡片行与详情弹窗**一个字都不提系统**——「声明含当前平台 / 不含 / 根本没有该字段」三种形态渲染逐字相同；④ 不可达的 `!connected` 条件删掉（连不上时 `catalog`/`local` 皆空、一行都渲染不出来），并写清这条推理。 **本刀（企业插件安装的动态过程效果）**：卡片行与详情弹窗新增「安装中」那一条**真进度**（`EnterprisePluginCardProgressNotes` 与 `EnterprisePluginCardSettledNote`，两处共用同一个 `pluginProgressFacts` 入参），阶段文字直接取本文件那张 `STATES`（故与行脚状态词是同一张表、不可能漂）；`role="progressbar"` + `aria-live="polite"` + `aria-valuetext`（不确定态、无 aria-valuenow），CSS 另加 `own-plugin-progress*` 一族与一条 `@media (prefers-reduced-motion:reduce)`；进度与交代都由 `plugin-install-progress.ts` 的唯一投影算出，本文件不自造阶段词、不编百分比。
 * [POS]: ui 的员工插件管理视图，由「企业设置」的插件 tab 承载，数据与执行由 DSH Enterprise Host 拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Check, Download, Package, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { EnterpriseAccountStore } from './account-store.js'
import { ConfirmAction } from './confirm-action.js'
import { EnterpriseErrorNotice } from './error-notice.js'
import type { ManagedPluginState } from './local-api.js'
import {
  enterprisePluginLockNotice,
  enterprisePluginLockReason,
  enterprisePluginSwitchTitle,
  type EnterprisePluginLockReason,
} from './plugin-install-gate.js'
// 「安装中」那一条**真进度**的唯一投影（与官方插件页里的插件市场共用同一份；
// 阶段文字就取下面那张 `STATES` 状态词表，故两处不可能各说一套）。
import {
  enterprisePluginProgress,
  enterprisePluginSettledNotice,
  type EnterprisePluginBusyFact,
  type EnterprisePluginProgress,
  type EnterprisePluginSettledFact,
} from './plugin-install-progress.js'

const STATES: Record<ManagedPluginState, { title: string; description: string; color: string }> = {
  EXPECTED: { title: '未安装', description: '可选择安装', color: '#667085' },
  DOWNLOAD_PENDING: { title: '等待下载', description: '制品下载即将开始', color: '#2563eb' },
  DOWNLOADING: { title: '正在下载', description: '正在获取企业插件', color: '#2563eb' },
  VERIFIED: { title: '校验通过', description: '制品完整性与兼容性校验通过', color: '#2563eb' },
  INSTALLING: { title: '正在安装', description: '正在更新本机插件', color: '#2563eb' },
  RESTART_REQUIRED: { title: '等待重启', description: '重启 Harness 后生效', color: '#b54708' },
  ACTIVE: { title: '已安装', description: '插件已启用', color: '#16803c' },
  REMOVE_PENDING: { title: '等待卸载', description: '卸载操作即将开始', color: '#b54708' },
  REMOVING: { title: '正在卸载', description: '正在更新本机插件', color: '#b54708' },
  FAILED: { title: '处理失败', description: '请重试', color: '#c4320a' },
  ROLLBACK: { title: '切换版本', description: '正在安装所选版本', color: '#2563eb' },
}

export const enterprisePluginStatePresentation = (state: ManagedPluginState) => STATES[state]

/** 目录取数中的轻提示。 */
export const ENTERPRISE_PLUGIN_LIST_LOADING = '正在加载插件'
/** 未登录时的空态（说清「为什么空」+ 下一步）。 */
export const ENTERPRISE_PLUGIN_LIST_SIGNED_OUT = '登录企业账号后可用'
/** 目录取数失败的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射给）。 */
export const ENTERPRISE_PLUGIN_LIST_FAILED = '插件目录加载失败'
/** 目录本身为空。 */
export const ENTERPRISE_PLUGIN_LIST_EMPTY_CATALOG = '企业还没有发布任何插件。请联系企业管理员发布，或稍后刷新再看。'
/** 搜索没命中。 */
export const ENTERPRISE_PLUGIN_LIST_EMPTY_SEARCH = '没有匹配的插件，试试换个关键词。'
/** 「已安装」筛选下确实一个都没装。 */
export const ENTERPRISE_PLUGIN_LIST_EMPTY_INSTALLED = '还没有安装任何企业插件。'
/** 详情弹窗里企业目录那一格读不到时的如实说法（**不谎称「已下架」**）。 */
export const ENTERPRISE_PLUGIN_VERSION_UNREADABLE = '暂时无法读取'
/** 详情弹窗里「已不在企业目录中」的既有口径。 */
export const ENTERPRISE_PLUGIN_VERSION_DELISTED = '已下架'

/**
 * 详情弹窗「企业版本」那一格的取值（纯投影，测试直调）。
 * 目录取到了才敢说「已下架」；目录本身没取到（失败/在途）时说「暂时无法读取」——
 * 否则用户会把一次取数失败读成「这个插件被下架了」。
 */
export function enterprisePluginCatalogVersionText(input: {
  readonly catalogState: EnterprisePluginCatalogState
  readonly version?: string | undefined
}): string {
  if (input.version !== undefined) return input.version
  return input.catalogState.kind === 'failed' || input.catalogState.kind === 'loading'
    ? ENTERPRISE_PLUGIN_VERSION_UNREADABLE
    : ENTERPRISE_PLUGIN_VERSION_DELISTED
}

/**
 * 「企业设置 → 插件」目录此刻该说什么（纯投影，测试直调）：未登录 / 加载中 / 失败 / 空 / 就绪。
 *
 * 三态**互斥**由这个联合体保证：失败与空不可能同时成立（失败要在没有可渲染行时才算失败），
 * 因此「插件目录取数失败」不会再被显示成「暂无可用企业插件」那片空白。
 */
export type EnterprisePluginCatalogState =
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'empty'; readonly reason: 'catalog' | 'search' | 'installed' }
  | { readonly kind: 'ready' }

export function enterprisePluginCatalogState(input: {
  readonly connected: boolean
  readonly loading: boolean
  readonly errorCode?: string | undefined
  /** 过滤后真正要渲染的行数。 */
  readonly rowCount: number
  /** 未过滤的可用目录行数（用来把「目录为空」与「筛选后为空」分开说）。 */
  readonly catalogCount: number
  readonly searching: boolean
  readonly view: 'all' | 'installed'
}): EnterprisePluginCatalogState {
  if (!input.connected) return { kind: 'signed-out' }
  // 有行可渲染就是就绪（同一个失败码可能是行级动作失败，那由行上的提示负责，不把整列判成失败）。
  if (input.rowCount > 0) return { kind: 'ready' }
  // 一行都没有：先看是不是还在取数（重试在途也走这一支——用户点完立刻见到进行中态），再看失败，最后才是空。
  if (input.loading) return { kind: 'loading' }
  if (input.errorCode !== undefined) return { kind: 'failed', code: input.errorCode }
  if (input.catalogCount === 0) return { kind: 'empty', reason: 'catalog' }
  if (input.searching) return { kind: 'empty', reason: 'search' }
  return { kind: 'empty', reason: input.view === 'installed' ? 'installed' : 'catalog' }
}

/** 空态的三句「为什么空 + 下一步」（按原因取，不写成一坨三元表达式）。 */
export function enterprisePluginCatalogEmptyText(reason: 'catalog' | 'search' | 'installed'): string {
  if (reason === 'search') return ENTERPRISE_PLUGIN_LIST_EMPTY_SEARCH
  if (reason === 'installed') return ENTERPRISE_PLUGIN_LIST_EMPTY_INSTALLED
  return ENTERPRISE_PLUGIN_LIST_EMPTY_CATALOG
}

/**
 * 一行插件的**动作门禁**与**可见提示**（纯投影，测试直调）：卡片行与详情弹窗读的是同一份事实。
 *
 * 为什么要有它：动作控件动不了时必须**在界面上**说清为什么——原先这里只有 `title`（安装按钮一句
 * 「该插件当前不可安装」），正是产品宪法禁止的「死开关」。四件现场事实（受管态 / 等重启 / 别的操作用着 /
 * 状态读不到）与目录判定经 `plugin-install-gate.ts` 的**唯一**判定折成禁用原因；
 * `installErrorCode`（目录判定不可安装）只拦安装、**不**拦卸载——卸载是用户的自救动作。
 */
export interface EnterprisePluginRowGate {
  /** 安装按钮的禁用原因（`undefined` = 可点）。 */
  readonly installLock: EnterprisePluginLockReason | undefined
  /** 卸载按钮的禁用原因（`undefined` = 可点）；目录判定不拦卸载。 */
  readonly uninstallLock: EnterprisePluginLockReason | undefined
  /** 安装禁用时的可见一句话；`undefined` = 没有（可点，或原因由唯一提示组件说）。 */
  readonly installLockNotice: string | undefined
  /** 卸载禁用时的可见一句话。 */
  readonly uninstallLockNotice: string | undefined
  /** 安装按钮的悬浮说明（补充，不替代上面那句）。 */
  readonly installTitle: string
  /** 卸载按钮的悬浮说明。 */
  readonly uninstallTitle: string
}

/**
 * 折出上面那份门禁的**唯一**入口。
 *
 * **与系统声明无关**：目录给的 `operatingSystems` 不进来、也不参与任何一步，
 * 所以「声明含当前平台 / 不含 / 根本没有该字段」三种形态在这一行上渲染结果逐字相同。
 *
 * @param input.item - 企业目录里的这一版（缺席 = 已下架，只剩本机记录）。
 * @param input.state - 本机受管态（无本机记录按 `EXPECTED`）。
 */
export function enterprisePluginRowGate(input: {
  readonly item?: { readonly installErrorCode?: string | undefined } | undefined
  readonly state: ManagedPluginState
  readonly restartPending: boolean
  readonly busy: boolean
  readonly fatal: boolean
}): EnterprisePluginRowGate {
  const installLock = enterprisePluginLockReason({
    hasAction: true,
    state: input.state,
    installErrorCode: input.item?.installErrorCode,
    restartPending: input.restartPending,
    busy: input.busy,
    fatal: input.fatal,
  })
  const uninstallLock = enterprisePluginLockReason({
    hasAction: true,
    state: input.state,
    restartPending: input.restartPending,
    busy: input.busy,
    fatal: input.fatal,
  })
  return {
    installLock,
    uninstallLock,
    installLockNotice: enterprisePluginLockNotice(installLock),
    uninstallLockNotice: enterprisePluginLockNotice(uninstallLock),
    installTitle: enterprisePluginSwitchTitle({
      enabled: input.state === 'ACTIVE',
      lockReason: installLock,
      installErrorCode: input.item?.installErrorCode,
    }),
    uninstallTitle: enterprisePluginSwitchTitle({ enabled: true, lockReason: uninstallLock }),
  }
}

/**
 * 卡片行上那句**可见**说明（安装/卸载为什么点不动）。
 * 没有要说的就整段不进 DOM；行落点用本页既有的次级文案类（`.own-market-sub`），不新增 CSS。
 */
export function EnterprisePluginGateNotes({ gate, subject }: {
  readonly gate: EnterprisePluginRowGate
  readonly subject: string
}): ReactNode {
  const notice = gate.installLockNotice ?? gate.uninstallLockNotice
  if (notice === undefined) return null
  return (
    <div className="own-market-sub" role="status" data-enterprise-plugin-lock={subject}>{notice}</div>
  )
}

/**
 * 「**安装中**」那一条真进度（本页落点：卡片行与详情弹窗共用同一个入参形状）。
 *
 * 语义与官方插件页里那一条**逐项同源**（同一份 `plugin-install-progress.ts` 投影、同一串文案常量），
 * 只有承载类名不同——两份 `<style>` 都是全局单类选择器、类名必须与同包其他源文件零交集，
 * 故这里用它自己的 `own-plugin-progress*` 一族，而不是复用别页的类名（复用会互相覆盖）。
 * ① `role="progressbar"` 且**不给** `aria-valuenow`：这是「不知道还剩多少」的不确定态，
 *    `aria-valuetext` 里放**真阶段文字**，读屏因此听到「正在下载」而不是任何百分比；
 * ② `aria-live="polite"`：阶段一推进就播报；
 * ③ 那条流光 `aria-hidden`——动效只是"还在动"的暗示，关掉它（`prefers-reduced-motion`）信息一字不少。
 * 没有进度时整段不进 DOM。
 */
export function EnterprisePluginCardProgressNotes({ name, progress }: {
  readonly name: string
  readonly progress: EnterprisePluginProgress | undefined
}): ReactNode {
  if (progress === undefined) return null
  return (
    <div
      className="own-plugin-progress"
      data-enterprise-plugin-progress={name}
      data-enterprise-plugin-progress-phase={progress.phase}
      data-enterprise-plugin-progress-stage={progress.state}
      data-enterprise-plugin-progress-indeterminate={progress.indeterminate ? 'true' : 'false'}
      data-enterprise-plugin-progress-cancelable={progress.cancelable ? 'true' : 'false'}
    >
      <span
        className="own-plugin-progressFlow"
        role="progressbar"
        aria-live="polite"
        aria-label={`${name} 安装进度`}
        aria-valuetext={progress.stageText}
      />
      <span className="own-plugin-progressText">{progress.stageText}</span>
      {progress.readFailedNotice === undefined ? null : (
        <span className="own-plugin-progressNote">{progress.readFailedNotice}</span>
      )}
      {/* 上游没有可达的取消面 ⇒ 只给一句「不能取消」的交代，**不画**点了没用的取消按钮。 */}
      <span className="own-plugin-progressNote">{progress.cancelNotice}</span>
    </div>
  )
}

/**
 * 一次安装/卸载**刚结束**的落地交代（完成 / 需重启的明确收束）。
 *
 * `role="status"`（不是 `alert`）：不打断，但读屏要能接着进度那条收到「安装完成…」。
 * 失败不走这里——失败由本页既有的 `EnterpriseErrorNotice`（`role="alert"` + 稳定码）负责。
 */
export function EnterprisePluginCardSettledNote({ name, notice }: {
  readonly name: string
  readonly notice: string | undefined
}): ReactNode {
  if (notice === undefined) return null
  return (
    <div className="own-plugin-progressSettled" role="status" data-enterprise-plugin-settled={name}>{notice}</div>
  )
}

/**
 * 一行插件的进度与交代（本页唯一取值入口，卡片行与详情弹窗都调它，避免两处各算一份）。
 *
 * 阶段文字取 `STATES[state].title`——与卡片行页脚那句状态词**同一张表**，所以「行上说正在下载、
 * 进度说下载中」这种漂移在本页结构上不可能发生。
 */
function pluginProgressFacts(snapshot: {
  readonly pluginBusy?: EnterprisePluginBusyFact | undefined
  readonly pluginSettled?: EnterprisePluginSettledFact | undefined
  readonly pluginProgressErrorCode?: string | undefined
}, name: string, state: ManagedPluginState): {
  readonly progress: EnterprisePluginProgress | undefined
  readonly settledNotice: string | undefined
} {
  return {
    progress: enterprisePluginProgress({
      packageName: name,
      busy: snapshot.pluginBusy,
      state,
      stageText: STATES[state].title,
      readErrorCode: snapshot.pluginProgressErrorCode,
    }),
    settledNotice: enterprisePluginSettledNotice({ packageName: name, settled: snapshot.pluginSettled }),
  }
}

const bytes = (value: number) => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`

const styles = `
.own-market{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-market *{box-sizing:border-box}
.own-market-toolbar,.own-market-tabs,.own-market-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.own-market-tabs{border-bottom:1px solid var(--dsw-alias-stroke-border-2,#e4e7ec);gap:20px;margin-bottom:18px}
.own-market-tabs button{color:var(--dsw-alias-label-secondary,#475467);font:inherit;border:0;border-bottom:2px solid transparent;background:none;padding:10px 0;cursor:pointer}
.own-market-tabs button[aria-pressed=true]{color:var(--dsw-alias-label-primary,#101828);border-bottom-color:var(--dsw-alias-accent-primary,#2563eb)}
.own-market-toolbar{margin-bottom:18px}.own-market-search{display:flex;align-items:center;gap:8px;flex:1;min-width:140px;border:1px solid var(--dsw-alias-stroke-border-2,#d0d5dd);border-radius:6px;padding:0 10px;height:36px}
.own-market-search input{width:100%;min-width:0;border:0;background:none;color:inherit;font:inherit;outline:none}.own-market-search:focus-within{outline:2px solid var(--dsw-alias-accent-primary,#2563eb);outline-offset:2px}
.own-market-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:12px}
.own-market-card{display:flex;flex-direction:column;gap:14px;min-width:0;padding:16px;border:1px solid var(--dsw-alias-stroke-border-2,#e4e7ec);border-radius:8px;background:var(--dsw-alias-background-primary,transparent)}
.own-market-card:focus-within,.own-market-card:hover{border-color:var(--dsw-alias-accent-primary,#2563eb)}
.own-market-title{display:flex;align-items:flex-start;gap:10px;color:inherit;text-align:left;border:0;padding:0;background:none;cursor:pointer;font:inherit;min-width:0;width:100%}
.own-market-glyph{display:grid;place-items:center;width:36px;height:36px;flex-shrink:0;border-radius:6px;background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-label-secondary,#475467)}
.own-market-title strong{display:block;font-size:14px;line-height:21px;overflow-wrap:anywhere}.own-market-sub{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-market-card footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:auto;min-height:30px}
.own-market-empty{text-align:center;padding:44px 12px;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-notice{padding:10px 0;line-height:20px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary,#667085)}
.own-market-error{color:var(--dsw-alias-state-error-primary,#c4320a)}
.own-market-facts{display:grid;grid-template-columns:minmax(70px,auto) minmax(0,1fr);gap:12px 20px;font-size:13px;margin:0}.own-market-facts dt{color:var(--dsw-alias-label-secondary,#667085)}.own-market-facts dd{margin:0;overflow-wrap:anywhere}
/* ── 「安装中」那一条真进度（卡片行与详情弹窗共用） ───────────────────────────────
   类名带 own-plugin- 前缀：本页与官方插件页那份 style 都是全局单类选择器、又必须零交集，
   故这条进度用它自己的一族（与另一处那条 own-market-progress* 是**同一份投影、两个落点**）。
   画的是**不确定态**流光而不是会填满的进度条——这条链从 Host 只拿得到阶段、拿不到百分比
   （留档在 plugin-install-progress.ts 的文件头）；动效只是装饰，阶段文字是独立文本节点。 */
.own-plugin-progress{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;padding:2px 0}
.own-plugin-progressFlow{position:relative;display:block;flex:0 1 96px;width:96px;height:4px;border-radius:2px;background:var(--dsw-alias-background-secondary,#f2f4f7);overflow:hidden}
.own-plugin-progressFlow::after{content:'';position:absolute;top:0;bottom:0;width:40%;border-radius:2px;background:var(--dsw-alias-accent-primary,#2563eb);animation:own-plugin-progress-flow 1.3s ease-in-out infinite}
.own-plugin-progressText{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px}
.own-plugin-progressNote{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-plugin-progressSettled{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
@keyframes own-plugin-progress-flow{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
/* 尊重「减少动态效果」：滑动关掉、装饰层改成静态淡色；阶段文字与进度条语义一字不少。 */
@media (prefers-reduced-motion: reduce){.own-plugin-progressFlow::after{width:100%;opacity:.4;animation:none;transform:none}}
`

export function EnterprisePluginMarket({ store }: {
  readonly store: EnterpriseAccountStore
}): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [view, setView] = useState<'all' | 'installed'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string>()
  const details = useRef<HTMLDListElement>(null)
  useEffect(() => {
    if (selected === undefined) return
    const root = details.current?.closest<HTMLElement>('[role="dialog"]')
    if (!root) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    root.querySelector<HTMLButtonElement>('button')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); setSelected(undefined) }
      if (event.key !== 'Tab') return
      const buttons = root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => { root.removeEventListener('keydown', onKeyDown); if (previous?.isConnected) previous.focus() }
  }, [selected])
  const status = snapshot.pluginStatus
  const connected = snapshot.status?.state === 'READY' || snapshot.status?.state === 'REFRESHING'
  const catalog = connected ? status?.catalog ?? [] : []
  const local = new Map((connected ? status?.plugins ?? [] : []).map(item => [item.packageName, item]))
  const available = new Map(catalog.map(item => [item.packageName, item]))
  const names = [...new Set([...available.keys(), ...local.keys()])]
  const installed = (name: string) => local.get(name)?.desiredState === 'INSTALLED' && local.get(name)?.version != null
  const rows = names.filter(name => (view === 'all' || installed(name)) && name.toLowerCase().includes(query.trim().toLowerCase()))
  const busy = snapshot.pluginBusy !== undefined || snapshot.busy !== undefined
  const fatal = status?.fatalErrorCode
  // 目录失败码：`fatal` 是「状态本身都读不到」，`pluginErrorCode` 是插件投影那一次取数/动作的失败码。
  const catalogErrorCode = snapshot.pluginErrorCode ?? fatal
  // 目录四态（纯投影）：有行就绪；一行都没有时按「在途 → 失败 → 空（说清为什么空）」逐级判定。
  const catalogState = enterprisePluginCatalogState({
    connected,
    loading: snapshot.pluginsLoading === true,
    errorCode: catalogErrorCode,
    rowCount: rows.length,
    catalogCount: catalog.length,
    searching: query.trim() !== '',
    view,
  })
  const selectedItem = selected === undefined ? undefined : available.get(selected)
  const selectedLocal = selected === undefined ? undefined : local.get(selected)
  const restartRequired = [...local.values()].some(item => item.state === 'RESTART_REQUIRED')
  /**
   * 一行插件的动作门禁（纯投影的唯一入口）。`!connected` 不在这里：连不上企业服务时
   * `catalog`/`local` 两张表都是空的（`connected ? … : []`，见上面），一行都渲染不出来，
   * 那个条件在**任何可达路径上**都不可能命中——留着只会让「禁用了却没解释」多一个隐分支。
   * **平台不进来**：目录声明的 `operatingSystems` 谁都不读，三行禁用的成因只有目录判定 / 在途 / 等重启 / 忙 / 读不到。
   */
  const gateFor = (name: string): EnterprisePluginRowGate => enterprisePluginRowGate({
    item: available.get(name),
    state: local.get(name)?.state ?? 'EXPECTED',
    restartPending: local.get(name)?.state === 'RESTART_REQUIRED',
    busy,
    fatal: fatal !== undefined,
  })
  /**
   * 一行插件的**真进度**与落地交代（本页唯一取值入口）。
   * 入参是同一份 store 快照（在途动作 / 轮询刷新的真实受管态 / 那一路读不到的码），
   * 卡片行与详情弹窗都调它，故两处不可能各算一份进度。
   */
  const progressFor = (name: string): { readonly progress: EnterprisePluginProgress | undefined; readonly settledNotice: string | undefined } =>
    pluginProgressFacts(snapshot, name, local.get(name)?.state ?? 'EXPECTED')
  /** 详情弹窗那一行的进度/交代（关闭弹窗就是 `undefined`，连算都不用算）。 */
  const detailPending = selected === undefined ? undefined : progressFor(selected)
  const actions = (name: string) => {
    const item = available.get(name)
    const record = local.get(name)
    const gate = gateFor(name)
    const sameVersion = record?.desiredState === 'INSTALLED' && record.version === item?.version && record.state === 'ACTIVE'
    return <div className="own-market-actions">
      {item && !sameVersion ? <Button size="sm" variant="outline"
        disabled={gate.installLock !== undefined}
        title={gate.installTitle}
        icon={<Download size={14} aria-hidden />}
        onClick={() => { void store.installPlugin(name, item.pluginVersionId) }}>
        {snapshot.pluginBusy?.packageName === name && snapshot.pluginBusy.action === 'install' ? '正在安装' : record?.state === 'FAILED' ? '重试' : installed(name) ? '更新版本' : '安装'}
      </Button> : sameVersion ? <span style={{ color: '#16803c', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} aria-hidden />已安装</span> : null}
      {record?.version != null && (record.desiredState === 'INSTALLED' || record.state === 'FAILED') ? <ConfirmAction
        title="卸载企业插件" description={name} confirmLabel="确认卸载" disabled={gate.uninstallLock !== undefined}
        onConfirm={() => { setSelected(undefined); void store.removePlugin(name) }}>
        {open => <Button size="sm" variant="ghost" aria-label={`卸载 ${name}`} title={gate.uninstallTitle}
          disabled={gate.uninstallLock !== undefined}
          icon={<Trash2 size={14} aria-hidden />} onClick={open} />}
      </ConfirmAction> : null}
    </div>
  }

  return <section className="own-market" aria-label="企业插件市场">
    <style>{styles}</style>
    <div className="own-market-tabs" role="group" aria-label="插件视图">
      <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>全部插件</button>
      <button type="button" aria-pressed={view === 'installed'} onClick={() => setView('installed')}>已安装 ({names.filter(installed).length})</button>
      <span className="own-market-sub" style={{ marginLeft: 'auto' }}>{catalog.length} 个可用插件</span>
    </div>
    <div className="own-market-toolbar">
      <label className="own-market-search"><Search size={16} aria-hidden /><input type="search" aria-label="搜索企业插件" placeholder="搜索企业插件" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <Button size="sm" variant="ghost" aria-label="刷新插件" title="刷新插件" disabled={!connected || snapshot.pluginsLoading || busy}
        icon={<RefreshCw size={16} aria-hidden />} onClick={() => { void store.refreshPlugins() }} />
    </div>
    {restartRequired ? <div className="own-market-notice" role="status">插件变更已保存，完全退出并重新打开客户端后生效。</div> : null}
    {/* 目录四态（未登录 / 加载中 / 失败 / 空 / 就绪）由纯投影算一次：失败**不再与空混同**。
        失败态复用唯一提示组件（人话 + 下一步 + 技术信息里的码）并给**真的重发**的重试。 */}
    {catalogState.kind === 'signed-out' ? <div className="own-market-empty">{ENTERPRISE_PLUGIN_LIST_SIGNED_OUT}</div> : null}
    {catalogState.kind === 'loading' ? <div className="own-market-empty" role="status">{ENTERPRISE_PLUGIN_LIST_LOADING}</div> : null}
    {catalogState.kind === 'failed' ? (
      <div className="own-market-notice">
        <EnterpriseErrorNotice className="own-market-notice own-market-error" code={catalogState.code} prefix={ENTERPRISE_PLUGIN_LIST_FAILED} />
        <Button size="sm" icon={<RefreshCw size={14} aria-hidden />} aria-label="重新加载插件目录"
          onClick={() => { void store.refreshPlugins() }}>
          重试
        </Button>
      </div>
    ) : null}
    {catalogState.kind === 'empty' ? <div className="own-market-empty">{enterprisePluginCatalogEmptyText(catalogState.reason)}</div> : null}
    {/* 行级/动作级的失败码照旧单独出（它与目录四态无关，命中哪一行由上面的行内提示负责）。 */}
    {catalogState.kind !== 'failed' && (snapshot.pluginErrorCode !== undefined || fatal !== undefined)
      ? <EnterpriseErrorNotice className="own-market-notice own-market-error" code={(snapshot.pluginErrorCode ?? fatal)!} />
      : null}
    {status?.lastReportErrorCode ? <div className="own-market-notice" role="status">设备状态暂未上报</div> : null}
    <div className="own-market-grid">
      {rows.map(name => {
        const item = available.get(name)
        const record = local.get(name)
        const presentation = record ? STATES[record.state] : undefined
        // 这一行的进度与交代只算一次（同一份 store 快照 + 本行真实受管态），下面两处落点读同一份。
        const pending = progressFor(name)
        return <article className="own-market-card" key={name} data-enterprise-plugin-package={name} data-enterprise-plugin-state={record?.state ?? 'AVAILABLE'}>
          <button type="button" className="own-market-title" aria-haspopup="dialog" onClick={() => setSelected(name)}>
            <span className="own-market-glyph"><Package size={20} aria-hidden /></span>
            <span style={{ minWidth: 0 }}><strong>{name}</strong><span className="own-market-sub">企业发布 · v{item?.version ?? record?.version}</span></span>
          </button>
          {/* 只报体积：平台已退出决策面，行上不再出现任何平台词（声明含/不含当前平台渲染逐字相同）。 */}
          <div className="own-market-sub">{item ? bytes(item.sizeBytes) : '已不在企业目录中'}</div>
          {/* 目录判定不可安装：原因 +「下一步：」+ 技术信息里的码，全部可见（原先这一句只在按钮的 title 里）。 */}
          {item?.installErrorCode ? <EnterpriseErrorNotice className="own-market-sub" code={item.installErrorCode} /> : null}
          {/* 动作点不动时**在行上**说清为什么（原因只来自那一份平台无关的门禁）。 */}
          <EnterprisePluginGateNotes gate={gateFor(name)} subject={name} />
          {/* 「安装中」这一行的**真进度**（阶段文字 + 不确定态流光 + 「不能取消」交代）：没有工序就整段不进 DOM。 */}
          <EnterprisePluginCardProgressNotes name={name} progress={pending.progress} />
          {/* 刚结束那一次动作的落地交代（完成 / 需重启）：`role="status"` 把「安装中 → 完成」接上。 */}
          <EnterprisePluginCardSettledNote name={name} notice={pending.settledNotice} />
          {record?.lastErrorCode ? <EnterpriseErrorNotice className="own-market-sub own-market-error" code={record.lastErrorCode} /> : null}
          <footer><span style={{ color: presentation?.color ?? 'var(--dsw-alias-label-secondary,#667085)' }}>{presentation?.title ?? '可选安装'}</span>{actions(name)}</footer>
        </article>
      })}
    </div>
    <Modal open={connected && selected !== undefined} onClose={() => setSelected(undefined)} closeLabel="关闭" title="插件详情"
      footer={selected === undefined ? null : actions(selected)}>
      <dl ref={details} className="own-market-facts">
        <dt>插件</dt><dd>{selected}</dd>
        <dt>企业版本</dt><dd>{enterprisePluginCatalogVersionText({ catalogState, version: selectedItem?.version })}</dd>
        <dt>本机版本</dt><dd>{selectedLocal?.desiredState === 'INSTALLED' ? selectedLocal.version : '未安装'}</dd>
        <dt>发布方</dt><dd>企业管理员</dd>
        {selectedItem ? <><dt>大小</dt><dd>{bytes(selectedItem.sizeBytes)}</dd></> : null}
        {selectedItem?.installErrorCode ? <><dt>安装状态</dt><dd><EnterpriseErrorNotice code={selectedItem.installErrorCode} /></dd></> : null}
        {/* 详情与卡片行**同一份门禁**：这里同样不许只挂 title。 */}
        {selected === undefined || gateFor(selected).installLockNotice === undefined
          ? null : <><dt>暂时不能安装</dt><dd>{gateFor(selected).installLockNotice}</dd></>}
      </dl>
      {/* 详情弹窗里**同一份**进度与交代：卡片行装到一半时用户点进详情，看到的阶段与行上逐字相同
          （同一份 store 快照、同一枚 `pluginProgressFacts`），不会出现「行上在装、详情说没在装」。 */}
      {selected === undefined || detailPending === undefined ? null : (
        <>
          <EnterprisePluginCardProgressNotes name={selected} progress={detailPending.progress} />
          <EnterprisePluginCardSettledNote name={selected} notice={detailPending.settledNotice} />
        </>
      )}
    </Modal>
  </section>
}
