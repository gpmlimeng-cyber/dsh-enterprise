/**
 * [INPUT]: 依赖共享 EnterpriseAccountStore、Harness Modal/Button、Lucide 图标、display-format 的大小格式化与同源技能 API（列表/详情/**已装态与安装/卸载**）
 * [OUTPUT]: 提供设置页内的企业技能目录（搜索/卡片/详情弹窗）、调用策略与条目纯投影（`enterpriseSkillInvocationLabel`/`enterpriseSkillMeta`/`enterpriseSkillEntryRows`）、安装态投影 `enterpriseSkillInstallState`、`buildSkillInstruction` 装配指令与 `EnterpriseSkillMarket` 视图 **本刀（列表三态 + 详情失败可见）**：新增唯一取数源 `createEnterpriseSkillListSource`（目录 + 已装清单，次级失败交码）、详情四态判定 `enterpriseSkillDetailState` 与状态文案常量；列表改由 `useSyncExternalStore` 订阅（加载/空/失败/就绪四态互斥 + 真重发的重试），详情取数失败不再静默回落列表投影，改渲染「以下是列表里的信息」+ 唯一提示组件 + 重试（`detailAttempt` 真的重发）。
 * [POS]: ui 的员工技能广场视图，由「企业设置」的技能 tab 承载；每行一个「安装」按钮经同源 `/skills/install` 由 Host 完成「下载 + SHA-256 校验 + 落盘到官方 `~/.dsh/skills`」，已装行显示已装态并可卸载；仍保留「复制装配指令」作为不装也能交给用户自己 Agent 会话的第二条路。默认不执行包内任何内容（安装 = 落盘），这一条在详情里如实写给用户。**本刀（失败文案降维 + 术语降维）**：目录加载失败与安装/卸载失败改渲染 `EnterpriseErrorNotice`（人话 + 「下一步：」+「技术信息」里的稳定码）；`技能 ID` 统一说成「标识」，卡片元信息加「来源」标签，装配指令里的 `技能 ID：` 同步改成 `标识：`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { CircleCheck, Copy, LoaderCircle, PackagePlus, RefreshCw, Search, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { EnterpriseAccountStore } from './account-store.js'
import { formatByteSize } from './display-format.js'
import { EnterpriseErrorNotice } from './error-notice.js'
import { enterpriseErrorAction, enterpriseErrorMessage } from './error-messages.js'
import type { EnterpriseInstalledSkill, EnterpriseLocalApi, EnterpriseRuntimeSkill, EnterpriseSkillEntry } from './local-api.js'
import { createEnterpriseLocalApi, enterpriseLocalErrorCode } from './local-api.js'
import {
  ENTERPRISE_DETAIL_FAILED,
  ENTERPRISE_DETAIL_LIST_LEVEL,
  ENTERPRISE_LIST_RETRY,
  ENTERPRISE_LIST_RETRY_LABEL,
  createEnterpriseListSource,
  enterpriseDegradedRead,
  enterpriseDetailState,
  type EnterpriseDetailState,
  type EnterpriseListSource,
} from './list-state.js'

const styles = `
.own-skill{color:var(--dsw-alias-label-primary,#101828);font-size:13px;letter-spacing:0;min-width:0}
.own-skill *{box-sizing:border-box}
.own-skill-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.own-skill-search{display:flex;align-items:center;gap:8px;flex:1;min-width:160px;border:1px solid var(--dsw-alias-stroke-border-2,#d0d5dd);border-radius:6px;padding:0 10px;height:36px}
.own-skill-search input{width:100%;min-width:0;border:0;background:none;color:inherit;font:inherit;outline:none}
.own-skill-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}
.own-skill-card{display:flex;flex-direction:column;gap:12px;min-width:0;padding:16px;border:1px solid var(--dsw-alias-stroke-border-2,#e4e7ec);border-radius:8px;background:var(--dsw-alias-background-primary,transparent)}
.own-skill-card:hover,.own-skill-card:focus-within{border-color:var(--dsw-alias-accent-primary,#2563eb)}
.own-skill-title{display:flex;align-items:flex-start;gap:10px;color:inherit;text-align:left;border:0;padding:0;background:none;cursor:pointer;font:inherit;width:100%}
.own-skill-glyph{display:grid;place-items:center;width:36px;height:36px;flex-shrink:0;border-radius:6px;background:var(--dsw-alias-background-secondary,#f2f4f7);color:var(--dsw-alias-label-secondary,#475467)}
.own-skill-title strong{display:block;font-size:14px;line-height:21px;overflow-wrap:anywhere}
.own-skill-sub{color:var(--dsw-alias-label-secondary,#667085);font-size:12px;line-height:19px;overflow-wrap:anywhere}
.own-skill-meta{margin-top:auto;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:11px}
.own-skill-empty,.own-skill-error{text-align:center;padding:44px 12px;color:var(--dsw-alias-label-secondary,#667085)}
.own-skill-error{color:var(--dsw-alias-state-error-primary,#c4320a)}
.own-skill-inlineError{padding:0;text-align:left;font-size:12px;line-height:19px}
.own-skill-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto}
.own-skill-actions .own-skill-spacer{flex:1}
.own-skill-installed{display:inline-flex;align-items:center;gap:4px;flex:none;color:var(--dsw-alias-state-success-primary,#027a48);font-size:11.5px;line-height:18px}
.own-skill-trust{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12.5px;line-height:19px}
.own-skill-entries{display:flex;flex-direction:column;gap:8px;list-style:none;margin:0;padding:0;min-width:0}
.own-skill-entry{display:flex;flex-direction:column;gap:4px;min-width:0;padding:10px 12px;border:1px solid var(--dsw-alias-stroke-border-2,#e4e7ec);border-radius:8px}
.own-skill-entryHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.own-skill-entryName{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-primary,#101828);overflow-wrap:anywhere}
.own-skill-policy{flex:none;border:1px solid var(--dsw-alias-stroke-border-2,#d0d5dd);border-radius:999px;padding:1px 8px;color:var(--dsw-alias-label-secondary,#475467);font-size:11px;line-height:17px;white-space:nowrap}
.own-skill-copy{width:100%;min-height:160px;resize:vertical;border:1px solid var(--dsw-alias-stroke-border-2,#d0d5dd);border-radius:8px;padding:12px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-primary,#101828);background:var(--dsw-alias-background-primary,#fff)}
`

/**
 * 调用策略标签：`modelInvocable` 决定 Agent 能否自行加载，否则只剩用户显式调用。
 * 契约只有这两个标签（DSH 侧 `disable-model-invocation` / `user-invocable` 的投影）。
 */
export function enterpriseSkillInvocationLabel(entry: EnterpriseSkillEntry): string {
  return entry.modelInvocable ? '模型可调用' : '仅用户可调用'
}

/** 卡片元信息：**来源版本**（标明这不是裸坐标）· 制品大小 · 包内技能数（与配方卡片同一份大小口径）。 */
export function enterpriseSkillMeta(skill: EnterpriseRuntimeSkill): string {
  return `来源 DSH ${skill.sourceDshVersion} · ${formatByteSize(skill.sizeBytes)} · ${skill.skillCount} 个技能`
}

/** 详情里一个技能条目的可渲染投影（只出界面真正展示的四个事实）。 */
export interface EnterpriseSkillEntryRow {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly policy: string
}

/** 包内条目 → 可渲染行；`whenToUse` 缺席即不产出该行（不画空标题）。 */
export function enterpriseSkillEntryRows(skill: EnterpriseRuntimeSkill): readonly EnterpriseSkillEntryRow[] {
  return skill.skills.map(entry => ({
    name: entry.name,
    description: entry.description,
    ...(entry.whenToUse === undefined ? {} : { whenToUse: entry.whenToUse }),
    policy: enterpriseSkillInvocationLabel(entry),
  }))
}

/**
 * 装配指令：把「下载什么、叫什么、放哪里、怎么生效」写成一段可直接交给 Agent 的话。
 *
 * 两条刻意的设计：不自动下载/落盘，先让 Agent 读详情并在落盘前向用户确认；
 * 目标目录与落点形态来自官方 `skill-filesystem` 的实测扫描约定（用户级 `~/.dsh/skills`），
 * 落盘后 watcher 自动发现，因此指令明确「无需重启」。
 * `versionId` 缺席（列表投影）时退回包详情地址，避免给出拼不出来的下载链接。
 */
export function buildSkillInstruction(skill: EnterpriseRuntimeSkill, platformUrl: string | null): string {
  const base = (platformUrl ?? '').replace(/\/$/, '')
  const downloadUrl = skill.versionId
    ? `${base}/enterprise/api/v1/skills/versions/${skill.versionId}/download`
    : `${base}/enterprise/api/v1/skills/${skill.id}`
  return [
    '请从 DSH Enterprise 下载并装配下面这个技能包。',
    '读取详情并检查安全信息后，在实际下载和落盘前向我确认。',
    `技能包：${downloadUrl}`,
    `名称：${skill.displayName}`,
    `标识：${skill.skillId}`,
    '建议目标目录：~/.dsh/skills/（也能放项目 <projectRoot>/.dsh/skills/）',
    '落点形态：~/.dsh/skills/<name>/SKILL.md，frontmatter 必填 kebab-case 的 name 与 description',
    '生效方式：官方 skill-filesystem 按 rank 扫描，落盘后 watcher 自动发现，无需重启。',
  ].join('\n')
}

/** 一个技能包在本机的安装态（列表行与详情弹窗共用同一份投影）。 */
export interface EnterpriseSkillInstallState {
  readonly installed: boolean
  /** 本包落盘的技能目录名；未装时是空数组。 */
  readonly names: readonly string[]
  /** 主按钮文案。 */
  readonly actionLabel: string
  /** 状态位文案。 */
  readonly statusLabel: string
  /** 该包是否有动作在途：在途时按钮禁用、文案切换。 */
  readonly busy: boolean
  /** 主按钮要触发的动作。 */
  readonly action: 'install' | 'uninstall'
}

/** 一次在途动作；与 `busy` 状态位同形。 */
export interface EnterpriseSkillPending {
  readonly packageId: string
  readonly action: 'install' | 'uninstall'
}

/**
 * 把「Host 已装清单 + 当前在途动作」投影成一行的安装态。
 *
 * 纯函数：已装判定只认 Host 回传的 `packageId`，界面**从不**自己猜「大概装上了」；
 * 卸载动作只在已装时出现，未装时的按钮永远是安装。
 */
export function enterpriseSkillInstallState(
  installed: readonly EnterpriseInstalledSkill[] | undefined,
  packageId: string,
  pending?: EnterpriseSkillPending | undefined,
): EnterpriseSkillInstallState {
  const record = (installed ?? []).find(item => item.packageId === packageId)
  const action: 'install' | 'uninstall' = record === undefined ? 'install' : 'uninstall'
  const inFlight = pending !== undefined && pending.packageId === packageId
  return {
    installed: record !== undefined,
    names: record?.names ?? [],
    actionLabel: inFlight ? (action === 'install' ? '安装中…' : '卸载中…') : action === 'install' ? '安装' : '卸载',
    statusLabel: record === undefined ? '未安装' : `已装 · ${record.names.length} 个技能`,
    busy: inFlight,
    action,
  }
}

/** 「企业设置 → 技能」目录取数中的轻提示（首帧就看得见，不空白）。 */
export const ENTERPRISE_SKILL_LIST_LOADING = '正在加载企业技能'
/** 目录取数成功但确实没有可见技能：说清「为什么空」+ 下一步。 */
export const ENTERPRISE_SKILL_LIST_EMPTY = '还没有可见的技能。请联系企业管理员发布，或稍后刷新再看。'
/** 搜索没命中时为「为什么空」补的一句（与「目录本身为空」分开说）。 */
export const ENTERPRISE_SKILL_LIST_NO_MATCH = '没有匹配的企业技能，试试换个关键词。'
/** 目录取数失败的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射给）。 */
export const ENTERPRISE_SKILL_LIST_FAILED = '技能目录加载失败'
/** 详情弹窗里「你现在看到的是列表级信息」那句如实交代（唯一一句，配方页共用同一份）。 */
export const ENTERPRISE_SKILL_DETAIL_LIST_LEVEL = ENTERPRISE_DETAIL_LIST_LEVEL
/** 详情取数失败提示的动作前缀。 */
export const ENTERPRISE_SKILL_DETAIL_FAILED = ENTERPRISE_DETAIL_FAILED

/** 「企业设置 → 技能」一份取数结果：目录 + 本机已装（次级事实，失败降级但如实交码）。 */
export interface EnterpriseSkillListPayload {
  readonly items: readonly EnterpriseRuntimeSkill[]
  /** 本机已装清单；降级时为空数组，且 `installedCode` 非空（界面据此如实说明 + 可重试）。 */
  readonly installed: readonly EnterpriseInstalledSkill[]
  readonly installedCode?: string | undefined
}

/**
 * 「企业设置 → 技能」列表的**唯一**取数源（非 React，测试可注入假 fetch 直测）。
 * 目录失败**原样抛出**（收敛成显式失败态），已装清单是次级事实（显式降级 + 交码），
 * 绝不再 `.catch(() => undefined)` 让所有行默默显示「未安装」。
 */
export function createEnterpriseSkillListSource(
  api: Pick<EnterpriseLocalApi, 'skills' | 'installedSkills'>,
): EnterpriseListSource<EnterpriseSkillListPayload> {
  return createEnterpriseListSource<EnterpriseSkillListPayload>({
    load: async (signal) => {
      const [items, installed] = await Promise.all([
        api.skills(signal),
        enterpriseDegradedRead(api.installedSkills(signal), [] as readonly EnterpriseInstalledSkill[]),
      ])
      return {
        items,
        installed: installed.value,
        ...(installed.code === undefined ? {} : { installedCode: installed.code }),
      }
    },
    isEmpty: payload => payload.items.length === 0,
  })
}

/** 详情弹窗此刻该说什么（纯投影，测试直调）：没选 / 读取中 / **列表级信息**（详情取数失败）/ 真详情。 */
export type EnterpriseSkillDetailState = EnterpriseDetailState
/** 判定只有一份：`enterpriseDetailState`（list-state.ts）——技能与配方两个详情弹窗共用同一份口径。 */
export const enterpriseSkillDetailState = enterpriseDetailState

/** 「企业设置 → 技能」页：列出可见技能包、按需读详情并复制装配指令。 */
export function EnterpriseSkillMarket({ store }: {
  readonly store: EnterpriseAccountStore
}): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const platformUrl = snapshot.status?.platformUrl ?? null
  const connected = snapshot.status?.state === 'READY' || snapshot.status?.state === 'REFRESHING'
  const [pending, setPending] = useState<EnterpriseSkillPending>()
  const [actionError, setActionError] = useState<{ readonly packageId: string, readonly code: string }>()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EnterpriseRuntimeSkill>()
  const [detail, setDetail] = useState<EnterpriseRuntimeSkill>()
  const [detailCode, setDetailCode] = useState<string>()
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [copied, setCopied] = useState(false)
  const details = useRef<HTMLDivElement>(null)
  const api = useMemo(() => createEnterpriseLocalApi(), [])
  // 目录取数只走这一个源（`useSyncExternalStore` 订阅它）：加载中 / 空 / 失败 / 就绪四态互斥，
  // 重试 = `source.retry()`（真的重发一次请求，见 tests/list-state.spec.ts 的请求计数取证）。
  const listSource = useMemo(() => createEnterpriseSkillListSource(api), [api])
  const listState = useSyncExternalStore(listSource.subscribe, listSource.getSnapshot, listSource.getSnapshot)
  const listValue = listState.kind === 'ready' || listState.kind === 'empty' ? listState.value : undefined
  const items = listValue?.items
  // 已装清单：种子来自取数源（每次取数成功都刷新），安装/卸载动作**用 Host 回传的清单覆盖**它（不做乐观切换）。
  const [installed, setInstalled] = useState<readonly EnterpriseInstalledSkill[] | undefined>()
  useEffect(() => {
    if (listValue !== undefined) setInstalled(listValue.installed)
  }, [listValue])
  const loading = listState.kind === 'loading'

  /**
   * 安装/卸载的唯一入口：Host 一次往返既执行动作又回传最新已装态，界面不自行推断结果。
   * 超时给到 120s（中心制品上限 50 MiB，要下载 + 校验 + 解包 + 落盘）。
   */
  const runAction = (packageId: string, action: 'install' | 'uninstall') => {
    if (pending !== undefined) return
    setPending({ packageId, action })
    setActionError(undefined)
    const signal = AbortSignal.timeout(120_000)
    const operation = action === 'install' ? api.installSkill : api.uninstallSkill
    void operation.call(api, packageId, signal)
      .then(next => setInstalled(next))
      .catch(error => {
        setActionError({ packageId, code: enterpriseLocalErrorCode(error) })
      })
      .finally(() => setPending(undefined))
  }

  // 只连上企业会话才取数；断连即中止在途并回到初始加载态（迟到结果由取数源丢弃）。
  useEffect(() => {
    if (!connected) {
      listSource.reset()
      return
    }
    listSource.load()
    return () => { listSource.reset() }
  }, [listSource, connected])

  useEffect(() => {
    setCopied(false)
    if (selected === undefined) {
      setDetail(undefined)
      setDetailCode(undefined)
      setDetailLoading(false)
      return
    }
    // 先清掉上一个包的详情：否则弹窗在取数期间会短暂显示上一个技能的条目。
    setDetail(undefined)
    setDetailCode(undefined)
    setDetailLoading(true)
    const root = details.current?.closest<HTMLElement>('[role="dialog"]')
    root?.querySelector<HTMLButtonElement>('button')?.focus()
    const signal = AbortSignal.timeout(8000)
    void api.skillDetail(selected.id, signal)
      .then(value => { setDetail(value); setDetailLoading(false) })
      // 详情失败**不再静默回落列表投影**：如实记下失败码，弹窗出「以下是列表里的信息」+ 人话 + 重试。
      .catch((error: unknown) => { setDetailCode(enterpriseLocalErrorCode(error)); setDetailLoading(false) })
  }, [selected, detailAttempt, api])

  const filtered = (items ?? []).filter(item => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return item.displayName.toLowerCase().includes(needle)
      || item.skillId.toLowerCase().includes(needle)
      || item.description.toLowerCase().includes(needle)
  })

  const shown = detail ?? selected
  const detailState = enterpriseSkillDetailState({
    selected: selected !== undefined,
    loading: detailLoading,
    hasDetail: detail !== undefined,
    errorCode: detailCode,
  })
  const entryRows = shown === undefined ? [] : enterpriseSkillEntryRows(shown)
  const instruction = shown === undefined ? '' : buildSkillInstruction(shown, platformUrl)

  return <>
    <style>{styles}</style>
    <div className="own-skill">
      <div className="own-skill-toolbar">
        <div className="own-skill-search">
          <Search aria-hidden size={14} />
          <input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="搜索企业技能" />
        </div>
        <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => { listSource.retry() }} disabled={loading || !connected}>
          {loading ? '加载中' : '刷新'}
        </Button>
      </div>
      {!connected ? (
        <div className="own-skill-empty">登录企业账号后可浏览已发布技能。</div>
      ) : listState.kind === 'loading' ? (
        <div className="own-skill-empty" role="status"><LoaderCircle aria-hidden size={16} /> {ENTERPRISE_SKILL_LIST_LOADING}</div>
      ) : listState.kind === 'failed' ? (
        <div className="own-skill-empty">
          <EnterpriseErrorNotice className="own-skill-error" code={listState.code} prefix={ENTERPRISE_SKILL_LIST_FAILED} />
          <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} aria-label={ENTERPRISE_LIST_RETRY_LABEL} onClick={() => { listSource.retry() }}>
            {ENTERPRISE_LIST_RETRY}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="own-skill-empty">{query.trim() === '' || items === undefined || items.length === 0 ? ENTERPRISE_SKILL_LIST_EMPTY : ENTERPRISE_SKILL_LIST_NO_MATCH}</div>
      ) : (
        <>
          {/* 次级取数降级的可见交代（本机已装状态没读全）：非打扰但看得见 + 可重试；措辞取自唯一映射。 */}
          {listValue?.installedCode === undefined ? null : (
            <p className="own-skill-sub" role="status">
              {`本机已装状态暂时没有读取到：${enterpriseErrorMessage(listValue.installedCode)}下一步：${enterpriseErrorAction(listValue.installedCode)}`}
              <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} aria-label={ENTERPRISE_LIST_RETRY_LABEL} onClick={() => { listSource.retry() }}>
                {ENTERPRISE_LIST_RETRY}
              </Button>
            </p>
          )}
          <div className="own-skill-grid">
          {filtered.map(item => {
            const state = enterpriseSkillInstallState(installed, item.id, pending)
            return (
              <article key={item.id} className="own-skill-card">
                <button type="button" className="own-skill-title" onClick={() => setSelected(item)}>
                  <span className="own-skill-glyph"><Sparkles aria-hidden size={16} /></span>
                  <span style={{ minWidth: 0 }}>
                    <strong>{item.displayName}</strong>
                    <span className="own-skill-sub">{item.description}</span>
                  </span>
                </button>
                <div className="own-skill-meta">{enterpriseSkillMeta(item)}</div>
                <div className="own-skill-actions">
                  {state.installed
                    ? <span className="own-skill-installed"><CircleCheck aria-hidden size={13} />{state.statusLabel}</span>
                    : <span className="own-skill-policy">{state.statusLabel}</span>}
                  <span className="own-skill-spacer" />
                  <Button
                    size="sm"
                    disabled={state.busy}
                    icon={state.action === 'install'
                      ? <PackagePlus aria-hidden size={14} />
                      : <Trash2 aria-hidden size={14} />}
                    onClick={() => runAction(item.id, state.action)}
                  >
                    {state.actionLabel}
                  </Button>
                </div>
                {actionError?.packageId === item.id
                  ? <EnterpriseErrorNotice
                    className="own-skill-error own-skill-inlineError"
                    code={actionError.code}
                    prefix={state.action === 'install' ? '安装失败' : '卸载失败'}
                  />
                  : null}
              </article>
            )
          })}
          </div>
        </>
      )}
      {selected !== undefined ? (
        <Modal open onClose={() => setSelected(undefined)} closeLabel="关闭" title={shown?.displayName ?? selected.displayName}>
          <div ref={details} style={{ display: 'grid', gap: 12, padding: 12 }}>
            <div className="own-skill-trust">
              <ShieldAlert aria-hidden size={16} />
              <span>技能包内的 SKILL.md 正文是 Agent 会加载并执行的自然语言指令，可能以 Agent 权限读写文件或调用工具。仅装配企业管理员发布的技能，并在装配前确认安全提示。「安装」只做下载、SHA-256 校验与落盘到 ~/.dsh/skills/，不会执行包内任何脚本；是否执行由你自己的 Agent 会话决定。</span>
            </div>
            <div className="own-skill-sub">{shown?.description === undefined || shown.description === '' ? '（暂无描述）' : shown.description}</div>
            <div className="own-skill-sub">标识：{shown?.skillId ?? selected.skillId}</div>
            {detailState.kind === 'loading' ? <div className="own-skill-sub" role="status">正在读取技能详情…</div> : null}
            {/* 详情取数失败：如实说明「你现在看到的是列表里的信息」，给出人话 + 下一步 + **真的重发**的重试。
                改前这里 `catch(() => setDetail(selected))` 静默回落列表投影——用户根本看不出少了一份详情。 */}
            {detailState.kind === 'list-level' ? (
              <>
                <div className="own-skill-sub" role="status">{ENTERPRISE_SKILL_DETAIL_LIST_LEVEL}</div>
                <EnterpriseErrorNotice className="own-skill-error own-skill-inlineError" code={detailState.code} prefix={ENTERPRISE_SKILL_DETAIL_FAILED} />
                <div>
                  <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} aria-label={ENTERPRISE_LIST_RETRY_LABEL}
                    onClick={() => { setDetailAttempt(current => current + 1) }}>
                    {ENTERPRISE_LIST_RETRY}
                  </Button>
                </div>
              </>
            ) : null}
            {entryRows.length === 0 ? null : (
              <ul className="own-skill-entries" aria-label="包含的技能">
                {entryRows.map(row => (
                  <li key={row.name} className="own-skill-entry">
                    <div className="own-skill-entryHead">
                      <code className="own-skill-entryName">{row.name}</code>
                      <span className="own-skill-policy">{row.policy}</span>
                    </div>
                    <div className="own-skill-sub">{row.description}</div>
                    {row.whenToUse === undefined ? null : <div className="own-skill-sub">何时使用：{row.whenToUse}</div>}
                  </li>
                ))}
              </ul>
            )}
            <textarea className="own-skill-copy" readOnly value={instruction} aria-label="装配指令" />
            {(() => {
              // 详情弹窗与卡片行共用同一份安装态投影：同一时刻只允许一个动作在途。
              const state = enterpriseSkillInstallState(installed, selected.id, pending)
              return (
                <div className="own-skill-actions">
                  {state.installed
                    ? <span className="own-skill-installed"><CircleCheck aria-hidden size={13} />{state.statusLabel}</span>
                    : <span className="own-skill-policy">{state.statusLabel}</span>}
                  <span className="own-skill-spacer" />
                  <Button
                    size="sm"
                    disabled={state.busy}
                    icon={state.action === 'install'
                      ? <PackagePlus aria-hidden size={14} />
                      : <Trash2 aria-hidden size={14} />}
                    onClick={() => runAction(selected.id, state.action)}
                  >
                    {state.actionLabel}
                  </Button>
                </div>
              )
            })()}
            {actionError?.packageId === selected.id
              ? <EnterpriseErrorNotice className="own-skill-error own-skill-inlineError" code={actionError.code} prefix="操作失败" />
              : null}
            <Button
              size="sm"
              icon={<Copy aria-hidden size={14} />}
              onClick={() => {
                void navigator.clipboard.writeText(instruction).then(() => setCopied(true))
              }}
            >
              {copied ? '已复制' : '复制装配指令'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  </>
}
