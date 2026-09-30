/**
 * [INPUT]: 依赖 React（useSyncExternalStore/useRef/useState）、Harness 共享 Modal/Button，以及宿主 Context 的 `shortcuts` 官方服务（`catalog`/`fixedCatalog` 两个可观察目录，0.2.0-rc.2 `@deepseek-ai/dsh-client-shortcuts`）
 * [OUTPUT]: 对外提供官方快捷键注册表只读源 `createEnterpriseShortcutsSource`、严格行解码 `decodeEnterpriseShortcutEntry`、分组投影 `enterpriseShortcutGroups` 与范围说明 `enterpriseShortcutScopeNote`、入口订阅 `useEnterpriseShortcuts`、带降级引导的弹窗开关 `useEnterpriseShortcutsDialog`（`openDialog(notice?)`）与只读弹窗 `EnterpriseShortcutsDialog`（`notice` 非空即展示官方一览 + 引导，用于 reach-in 失败的降级路径），以及取某条官方行键帽的 `enterpriseShortcutKeys`
 * [POS]: dsh-ui 的「快捷键」入口与只读速查弹窗。数据源只有官方注册表这一条：读 `ctx.get('shortcuts')` 的官方目录（官方 README 描述的「可观察目录」），注册表不可读时**只**退回 launcher props 里的 `settingsShortcut` 并标注范围——绝不自造按键表，也**不**注册任何全局键盘监听（官方 `shortcuts.open` 命令已由官方自己绑定 primary+Slash）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'

/** 官方插件的 context 接缝（与 theme-options 同一套）：按需读取服务，并等一次服务出现。 */
export interface EnterpriseShortcutContextPort {
  get(name: string): unknown
  inject(deps: readonly string[], callback: () => void): unknown
}

/** 分组中文标签逐条取官方 `ui-shortcuts` zh 词表；`launcher` 是本插件自定的降级分组。 */
export const ENTERPRISE_SHORTCUT_GROUP_LABELS: Readonly<Record<string, string>> = {
  application: '应用操作',
  input: '消息输入',
  menus: '菜单与弹层',
  approval: '审批区域',
  launcher: '客户端启动参数',
}

/** 分组顺序照官方速查：可编辑命令一律 application，固定操作按官方 group 归入 input/menus/approval。 */
export const ENTERPRISE_SHORTCUT_GROUP_ORDER = ['application', 'input', 'menus', 'approval', 'launcher'] as const

export interface EnterpriseShortcutRow {
  readonly id: string
  readonly label: string
  /** 键帽按官方 `presentBinding` 的产物原样展示（Windows 会把 `+` 作为独立一项）。 */
  readonly keys: readonly string[]
  readonly aria?: string | undefined
  readonly group: string
  /** 数据来源：官方注册表，或 launcher props 里唯一拿得到的 `settingsShortcut`。 */
  readonly scope: 'registry' | 'launcher'
}

/** 官方两个目录的原始快照；引用稳定，可直接喂给 useSyncExternalStore。 */
export interface EnterpriseShortcutsData {
  readonly catalog: readonly unknown[]
  readonly fixed: readonly unknown[]
}

const EMPTY_ROWS: readonly unknown[] = []

export const ENTERPRISE_SHORTCUTS_EMPTY: EnterpriseShortcutsData = { catalog: EMPTY_ROWS, fixed: EMPTY_ROWS }

export interface EnterpriseShortcutsSource {
  getSnapshot(): EnterpriseShortcutsData
  subscribe(listener: () => void): () => void
}

export const ENTERPRISE_SHORTCUTS_ABSENT: EnterpriseShortcutsSource = {
  getSnapshot: () => ENTERPRISE_SHORTCUTS_EMPTY,
  subscribe: () => () => undefined,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 官方目录的读取面：只要 `getSnapshot`/`subscribe` 是函数就够，其余字段一概不碰。 */
function storeSnapshot(store: unknown): readonly unknown[] {
  if (!isRecord(store)) return EMPTY_ROWS
  const getSnapshot = store['getSnapshot']
  if (typeof getSnapshot !== 'function') return EMPTY_ROWS
  const value = (getSnapshot as () => unknown).call(store)
  return Array.isArray(value) ? value : EMPTY_ROWS
}

function storeSubscribe(store: unknown, notify: () => void): (() => void) | undefined {
  if (!isRecord(store)) return undefined
  const subscribe = store['subscribe']
  if (typeof subscribe !== 'function') return undefined
  const off = (subscribe as (listener: () => void) => unknown).call(store, notify)
  return typeof off === 'function' ? off as () => void : undefined
}

function shortcutStores(context: EnterpriseShortcutContextPort): {
  readonly catalog: unknown
  readonly fixedCatalog: unknown
} {
  const service = context.get('shortcuts')
  if (!isRecord(service)) return { catalog: undefined, fixedCatalog: undefined }
  return { catalog: service['catalog'], fixedCatalog: service['fixedCatalog'] }
}

/**
 * 官方快捷键注册表的只读源。两个目录各自订阅、快照合并成一个稳定对象
 * （`getSnapshot` 必须返回同一引用，否则 useSyncExternalStore 会自激）；
 * 服务晚到时由 `inject` 补一次通知并补挂目录订阅，插件不硬注入 `shortcuts`。
 */
export function createEnterpriseShortcutsSource(
  context: EnterpriseShortcutContextPort,
): EnterpriseShortcutsSource {
  const listeners = new Set<() => void>()
  let detach: (() => void) | undefined
  let snapshot: EnterpriseShortcutsData = ENTERPRISE_SHORTCUTS_EMPTY
  const notify = (): void => { for (const listener of [...listeners]) listener() }
  const attach = (): void => {
    if (detach !== undefined) return
    const stores = shortcutStores(context)
    const offs = [
      storeSubscribe(stores.catalog, notify),
      storeSubscribe(stores.fixedCatalog, notify),
    ].filter((off): off is () => void => off !== undefined)
    if (offs.length === 0) return
    detach = () => { for (const off of offs) off() }
  }
  context.inject(['shortcuts'], () => { attach(); notify() })
  attach()
  return {
    getSnapshot: () => {
      const stores = shortcutStores(context)
      const catalog = storeSnapshot(stores.catalog)
      const fixed = storeSnapshot(stores.fixedCatalog)
      if (snapshot.catalog !== catalog || snapshot.fixed !== fixed) snapshot = { catalog, fixed }
      return snapshot
    },
    subscribe: (listener) => {
      listeners.add(listener)
      attach()
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        detach?.()
        detach = undefined
      }
    },
  }
}

/** 官方一行 → 我们的只读行；形状不认识就整行丢弃，界面不出现半个命令。 */
export function decodeEnterpriseShortcutEntry(
  value: unknown,
  group: string,
  scope: EnterpriseShortcutRow['scope'],
): EnterpriseShortcutRow | undefined {
  if (!isRecord(value)) return undefined
  const id = value['id']
  const label = value['label']
  const keys = value['keys']
  const aria = value['aria']
  if (typeof id !== 'string' || id === '' || typeof label !== 'string' || label === '') return undefined
  if (!Array.isArray(keys)) return undefined
  const list = keys as unknown[]
  if (!list.every(key => typeof key === 'string')) return undefined
  return {
    id,
    keys: list as readonly string[],
    label,
    group,
    scope,
    ...(typeof aria === 'string' && aria !== '' ? { aria } : {}),
  }
}

/**
 * 固定操作的官方分组字段：照原样保留官方给的分组字符串，缺失才落到可编辑命令的默认分组。
 * 不认识的官方分组不翻译、也不丢弃——渲染时直接用原始 id 当组标题（绝不给它编一个中文名）。
 */
function fixedGroupOf(value: unknown): string {
  if (!isRecord(value)) return 'application'
  const group = value['group']
  return typeof group === 'string' && group !== '' ? group : 'application'
}

/**
 * 官方目录 → 只读行。可编辑命令照官方速查一律归入 `application`（官方 Reference 的 ranked 投影），
 * 固定操作带自己的官方 group；官方目录整体不可读时才退回 launcher 的 `settingsShortcut`（唯一一行）。
 */
export function enterpriseShortcutRows(
  data: EnterpriseShortcutsData,
  settingsShortcut?: { readonly keys: readonly string[]; readonly aria?: string | undefined } | undefined,
): readonly EnterpriseShortcutRow[] {
  const rows: EnterpriseShortcutRow[] = []
  for (const raw of data.catalog) {
    const row = decodeEnterpriseShortcutEntry(raw, 'application', 'registry')
    if (row !== undefined) rows.push(row)
  }
  for (const raw of data.fixed) {
    const row = decodeEnterpriseShortcutEntry(raw, fixedGroupOf(raw), 'registry')
    if (row !== undefined) rows.push(row)
  }
  if (rows.length > 0) return rows
  if (settingsShortcut === undefined || settingsShortcut.keys.length === 0) return rows
  // 降级只有这一行，且标注范围：启动参数给的是官方 `settings.open` 命令的键帽，不是第二套按键表。
  return [{
    group: 'launcher',
    id: 'settings.open',
    keys: [...settingsShortcut.keys],
    label: '设置',
    scope: 'launcher',
    ...(settingsShortcut.aria === undefined ? {} : { aria: settingsShortcut.aria }),
  }]
}

export interface EnterpriseShortcutGroup {
  readonly group: string
  readonly label: string
  readonly rows: readonly EnterpriseShortcutRow[]
}

/** 分组：官方顺序优先，之后是数据里出现过的其它分组；组内保持官方注册顺序。 */
export function enterpriseShortcutGroups(
  rows: readonly EnterpriseShortcutRow[],
): readonly EnterpriseShortcutGroup[] {
  const groups: EnterpriseShortcutGroup[] = []
  const seen = new Set<string>()
  for (const group of [...ENTERPRISE_SHORTCUT_GROUP_ORDER, ...rows.map(row => row.group)]) {
    if (seen.has(group)) continue
    seen.add(group)
    const members = rows.filter(row => row.group === group)
    if (members.length === 0) continue
    groups.push({ group, label: ENTERPRISE_SHORTCUT_GROUP_LABELS[group] ?? group, rows: members })
  }
  return groups
}

/** 范围说明：只要有一行来自启动参数，就必须把「这不是完整注册表」说清楚。 */
export function enterpriseShortcutScopeNote(rows: readonly EnterpriseShortcutRow[]): string | undefined {
  return rows.some(row => row.scope === 'launcher')
    ? '范围：仅客户端启动参数提供的「设置」快捷键；本客户端没有可读的官方快捷键注册表。'
    : undefined
}

/** 取某条官方命令的键帽，供菜单行使用官方 `shortcut` 槽渲染（找不到就不显示）。 */
export function enterpriseShortcutKeys(
  rows: readonly EnterpriseShortcutRow[],
  id: string,
): { readonly keys: readonly string[]; readonly aria?: string | undefined } | undefined {
  const row = rows.find(candidate => candidate.id === id)
  if (row === undefined || row.keys.length === 0) return undefined
  return { keys: row.keys, ...(row.aria === undefined ? {} : { aria: row.aria }) }
}

/** 菜单入口的订阅：官方目录不可读时是空数据，入口行据此隐藏。 */
export function useEnterpriseShortcuts(
  source: EnterpriseShortcutsSource | undefined,
): EnterpriseShortcutsData {
  const resolved = source ?? ENTERPRISE_SHORTCUTS_ABSENT
  return useSyncExternalStore(resolved.subscribe, resolved.getSnapshot, resolved.getSnapshot)
}

export interface EnterpriseShortcutsDialogController {
  readonly open: boolean
  /** 产品裁决 B 的降级引导；非空时弹窗顶部亮出它并给「打开设置」这颗按钮。 */
  readonly notice: string | undefined
  readonly openDialog: (notice?: string) => void
  readonly closeDialog: () => void
}

/**
 * 弹窗开关的唯一持有者。开关必须与弹窗元素在同一棵树里（组件在 account-menu 中渲染），
 * 否则「快捷键」会表现为点击静默无反应。
 */
export function useEnterpriseShortcutsDialog(): EnterpriseShortcutsDialogController {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const openDialog = useCallback((next?: string) => { setNotice(next); setOpen(true) }, [])
  const closeDialog = useCallback(() => { setOpen(false); setNotice(undefined) }, [])
  return { closeDialog, notice, open, openDialog }
}

/** 弹窗自持排版：键帽用官方 token 自绘（本包 devDependency 的官方类型接缝没有 ShortcutKeys）。 */
const SHORTCUTS_STYLES = `
      [role="dialog"]:has(.own-shortcuts-body) { box-sizing: border-box; max-height: calc(100vh - 48px); width: min(480px, calc(100vw - 48px)); }
      .own-shortcuts-content { min-height: 0; overflow-y: auto; }
      .own-shortcuts-group { display: flex; flex-direction: column; gap: 8px; }
      .own-shortcuts-group + .own-shortcuts-group { border-top: 0.5px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 8%, transparent)); margin-top: 14px; padding-top: 14px; }
      .own-shortcuts-group-title { color: var(--dsw-alias-label-secondary, #475467); font-size: 12px; font-weight: 500; line-height: 18px; margin: 0; }
      .own-shortcuts-list { display: flex; flex-direction: column; gap: 6px; margin: 0; }
      .own-shortcuts-row { align-items: center; display: flex; gap: 12px; justify-content: space-between; }
      .own-shortcuts-label { color: var(--dsw-alias-label-primary, #101828); flex: 1; font-size: 13px; line-height: 20px; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .own-shortcuts-keys { align-items: center; display: flex; flex: none; gap: 4px; margin: 0; }
      .own-shortcuts-key { background: var(--dsw-alias-bg-module-platform, color-mix(in srgb, currentColor 6%, transparent)); border-radius: var(--dsw-radius-sm, 8px); color: var(--dsw-alias-label-secondary, #475467); font: inherit; font-size: 11px; line-height: 16px; padding: 2px 6px; }
      .own-shortcuts-plus { color: var(--dsw-alias-label-caption, #667085); font-size: 11px; line-height: 16px; }
      .own-shortcuts-unbound, .own-shortcuts-note { color: var(--dsw-alias-label-tertiary, #667085); font-size: 12px; line-height: 18px; margin: 0; }
      .own-shortcuts-note { margin-top: 14px; }
      /* 降级引导（产品裁决 B 的失败路径）：警示色 + 一颗「打开设置」，下面照旧是官方一览。 */
      .own-shortcuts-notice { align-items: center; color: var(--dsw-alias-status-warning, #b54708); display: flex; flex-wrap: wrap; font-size: 13px; gap: 8px; line-height: 20px; margin: 0 0 12px; }
`

const FOOTER_STYLE: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }

export interface EnterpriseShortcutsDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly rows: readonly EnterpriseShortcutRow[]
  /** 降级引导（产品裁决 B 的失败路径）：reach-in 没打开官方对话框时亮出，绝不静默。 */
  readonly notice?: string | undefined
  /** 引导里的「打开设置」：与自动调用同一条官方 `openSettings()`，用户手动再来一次。 */
  readonly onOpenSettings?: (() => void) | undefined
}

/**
 * 只读快捷键速查：行与键帽全部来自官方注册表（或降级后的 `settingsShortcut`），
 * 这里不做录制、不做编辑、不写偏好，也不注册任何按键。
 *
 * 它同时是 reach-in 失败时的降级面：`notice` 非空时顶部亮出「请到 设置 → 通用 → 编辑快捷键」
 * 与「打开设置」按钮，下面照旧是官方 catalog 的自渲染一览——不是只给一句话。
 */
export function EnterpriseShortcutsDialog(props: EnterpriseShortcutsDialogProps): ReactNode {
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(props.onClose)
  useEffect(() => { closeRef.current = props.onClose }, [props.onClose])
  // 官方 Modal 已给初始焦点、Tab 与遮罩关闭；这里只隔离外层 Settings 的 Escape，与本包其它弹窗同一处理。
  useEffect(() => {
    if (!props.open) return
    const root = bodyRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (root === null || root === undefined) return
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeRef.current()
    }
    root.addEventListener('keydown', onKeyDown)
    return () => { root.removeEventListener('keydown', onKeyDown) }
  }, [props.open])
  const groups = enterpriseShortcutGroups(props.rows)
  const note = enterpriseShortcutScopeNote(props.rows)
  return <Modal
    closeLabel="关闭"
    contentClassName="own-shortcuts-content"
    description="当前客户端已注册的快捷键（只读）"
    footer={<div style={FOOTER_STYLE}><Button onClick={props.onClose} variant="outline">关闭</Button></div>}
    onClose={props.onClose}
    open={props.open}
    title="快捷键"
  >
    <div className="own-shortcuts-body" ref={bodyRef}>
      <style>{SHORTCUTS_STYLES}</style>
      {props.notice === undefined
        ? null
        : <p className="own-shortcuts-notice" role="status">
          {props.notice}
          {props.onOpenSettings === undefined
            ? null
            : <Button onClick={props.onOpenSettings} variant="outline">打开设置</Button>}
        </p>}
      {groups.length === 0
        ? <p className="own-shortcuts-note">本客户端没有提供可读的快捷键数据。</p>
        : groups.map(group => <section aria-label={group.label} className="own-shortcuts-group" key={group.group}>
          <h3 className="own-shortcuts-group-title">{group.label}</h3>
          <dl className="own-shortcuts-list">
            {group.rows.map(row => <div className="own-shortcuts-row" key={row.id}>
              <dt className="own-shortcuts-label" title={row.label}>{row.label}</dt>
              <dd className="own-shortcuts-keys">
                {row.keys.length === 0
                  ? <span className="own-shortcuts-unbound">暂无快捷键</span>
                  : row.keys.map((key, index) => key === '+'
                    ? <span className="own-shortcuts-plus" key={`${row.id}-${index}`}>+</span>
                    : <kbd className="own-shortcuts-key" key={`${row.id}-${index}`}>{key}</kbd>)}
              </dd>
            </div>)}
          </dl>
        </section>)}
      {note === undefined ? null : <p className="own-shortcuts-note">{note}</p>}
    </div>
  </Modal>
}
