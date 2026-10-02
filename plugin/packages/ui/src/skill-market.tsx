/**
 * [INPUT]: 依赖共享 EnterpriseAccountStore、Harness Modal/Button、Lucide 图标、display-format 的大小格式化与同源技能 API（列表/详情/**已装态与安装/卸载**）
 * [OUTPUT]: 提供设置页内的企业技能目录（搜索/卡片/详情弹窗）、调用策略与条目纯投影（`enterpriseSkillInvocationLabel`/`enterpriseSkillMeta`/`enterpriseSkillEntryRows`）、安装态投影 `enterpriseSkillInstallState`、`buildSkillInstruction` 装配指令与 `EnterpriseSkillMarket` 视图
 * [POS]: ui 的员工技能广场视图，由「企业设置」的技能 tab 承载；每行一个「安装」按钮经同源 `/skills/install` 由 Host 完成「下载 + SHA-256 校验 + 落盘到官方 `~/.dsh/skills`」，已装行显示已装态并可卸载；仍保留「复制装配指令」作为不装也能交给用户自己 Agent 会话的第二条路。默认不执行包内任何内容（安装 = 落盘），这一条在详情里如实写给用户
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { CircleCheck, Copy, LoaderCircle, PackagePlus, RefreshCw, Search, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { EnterpriseAccountStore } from './account-store.js'
import { formatByteSize } from './display-format.js'
import type { EnterpriseInstalledSkill, EnterpriseRuntimeSkill, EnterpriseSkillEntry } from './local-api.js'
import { createEnterpriseLocalApi, enterpriseLocalErrorCode } from './local-api.js'

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

/** 卡片元信息：DSH 来源版本 · 制品大小 · 包内技能数（与配方卡片同一份大小口径）。 */
export function enterpriseSkillMeta(skill: EnterpriseRuntimeSkill): string {
  return `DSH ${skill.sourceDshVersion} · ${formatByteSize(skill.sizeBytes)} · ${skill.skillCount} 个技能`
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
    `技能 ID：${skill.skillId}`,
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

/** 「企业设置 → 技能」页：列出可见技能包、按需读详情并复制装配指令。 */
export function EnterpriseSkillMarket({ store }: {
  readonly store: EnterpriseAccountStore
}): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const platformUrl = snapshot.status?.platformUrl ?? null
  const connected = snapshot.status?.state === 'READY' || snapshot.status?.state === 'REFRESHING'
  const [items, setItems] = useState<readonly EnterpriseRuntimeSkill[] | undefined>()
  const [installed, setInstalled] = useState<readonly EnterpriseInstalledSkill[] | undefined>()
  const [pending, setPending] = useState<EnterpriseSkillPending>()
  const [actionError, setActionError] = useState<{ readonly packageId: string, readonly code: string }>()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorCode, setErrorCode] = useState<string>()
  const [selected, setSelected] = useState<EnterpriseRuntimeSkill>()
  const [detail, setDetail] = useState<EnterpriseRuntimeSkill>()
  const [copied, setCopied] = useState(false)
  const details = useRef<HTMLDivElement>(null)
  const api = createEnterpriseLocalApi()

  const load = async () => {
    if (!connected) {
      setItems(undefined)
      setInstalled(undefined)
      return
    }
    setLoading(true)
    setErrorCode(undefined)
    try {
      const signal = AbortSignal.timeout(8000)
      // 已装态取数失败**不**拖垮目录：旧 Host 还没有 `/skills/installed` 时技能列表照常可用，
      // 只是所有行显示「未安装」，点安装会拿到一个明确的错误码而不是空白页。
      const [list, installedList] = await Promise.all([
        api.skills(signal),
        api.installedSkills(signal).catch(() => undefined),
      ])
      setItems(list)
      setInstalled(installedList)
    } catch (error) {
      setErrorCode(error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'ENT_PLATFORM_UNAVAILABLE')
    } finally {
      setLoading(false)
    }
  }

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

  useEffect(() => { void load() }, [connected])

  useEffect(() => {
    setCopied(false)
    if (selected === undefined) {
      setDetail(undefined)
      return
    }
    // 先清掉上一个包的详情：否则弹窗在取数期间会短暂显示上一个技能的条目。
    setDetail(undefined)
    const root = details.current?.closest<HTMLElement>('[role="dialog"]')
    root?.querySelector<HTMLButtonElement>('button')?.focus()
    const signal = AbortSignal.timeout(8000)
    void api.skillDetail(selected.id, signal)
      .then(value => setDetail(value))
      .catch(() => setDetail(selected))
  }, [selected])

  const filtered = (items ?? []).filter(item => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return item.displayName.toLowerCase().includes(needle)
      || item.skillId.toLowerCase().includes(needle)
      || item.description.toLowerCase().includes(needle)
  })

  const shown = detail ?? selected
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
        <Button size="sm" icon={<RefreshCw aria-hidden size={14} />} onClick={() => void load()} disabled={loading || !connected}>
          {loading ? '加载中' : '刷新'}
        </Button>
      </div>
      {!connected ? (
        <div className="own-skill-empty">登录企业账号后可浏览已发布技能。</div>
      ) : loading && items === undefined ? (
        <div className="own-skill-empty"><LoaderCircle aria-hidden size={16} /> 正在加载企业技能</div>
      ) : errorCode !== undefined ? (
        <div className="own-skill-error" role="alert">技能目录加载失败 <code>{errorCode}</code></div>
      ) : filtered.length === 0 ? (
        <div className="own-skill-empty">暂无可见技能</div>
      ) : (
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
                  ? <div className="own-skill-error own-skill-inlineError" role="alert">
                    {state.action === 'install' ? '安装失败' : '卸载失败'} <code>{actionError.code}</code>
                  </div>
                  : null}
              </article>
            )
          })}
        </div>
      )}
      {selected !== undefined ? (
        <Modal open onClose={() => setSelected(undefined)} closeLabel="关闭" title={shown?.displayName ?? selected.displayName}>
          <div ref={details} style={{ display: 'grid', gap: 12, padding: 12 }}>
            <div className="own-skill-trust">
              <ShieldAlert aria-hidden size={16} />
              <span>技能包内的 SKILL.md 正文是 Agent 会加载并执行的自然语言指令，可能以 Agent 权限读写文件或调用工具。仅装配企业管理员发布的技能，并在装配前确认安全提示。「安装」只做下载、SHA-256 校验与落盘到 ~/.dsh/skills/，不会执行包内任何脚本；是否执行由你自己的 Agent 会话决定。</span>
            </div>
            <div className="own-skill-sub">{shown?.description === undefined || shown.description === '' ? '（暂无描述）' : shown.description}</div>
            <div className="own-skill-sub">技能 ID：{shown?.skillId ?? selected.skillId}</div>
            {detail === undefined ? <div className="own-skill-sub">正在读取技能详情…</div> : null}
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
              ? <div className="own-skill-error own-skill-inlineError" role="alert">
                操作失败 <code>{actionError.code}</code>
              </div>
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
