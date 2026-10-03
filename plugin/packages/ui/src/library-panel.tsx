/**
 * [INPUT]: 依赖 React（useSyncExternalStore/useEffect/useRef/useState）、lucide-react 的 Upload/RefreshCw/Search/ChevronLeft/FileText/Folder、官方 ui-primitives 的 Button、list-state 的唯一四态状态机与唯一取数源 `createEnterpriseListSource`、error-notice 的唯一失败呈现 `EnterpriseErrorNotice`、local-api 的 `EnterpriseLocalApiError`/`enterpriseLocalErrorCode`/`EnterpriseLocalApi`，以及 local-api-decode 的资料库 DTO（`EnterpriseLibrarySpace`/`EnterpriseLibraryHit`）
 * [OUTPUT]: 资料库**页面主体**：目录取数源 `createEnterpriseLibraryCatalogSource`（端口缺席＝宿主面还没接线时**如实**出 `ENT_LIBRARY_UNAVAILABLE`，绝不回落成空列表）、树行投影 `enterpriseLibraryItems`、纯呈现 `EnterpriseLibraryPanelView`（目录四态之一 + 目录树／查找命中／正文预览三块内容区 + 未接入控件的禁用与原因）、含 hook 的宿主 `EnterpriseLibraryPanel`（订阅取数源 + 上传／查找／看正文三件动作），以及全部页面文案常量与页面端口类型
 * [POS]: ui 的资料库页（侧栏一级入口点进去的 main 面板内容）。三态齐备、零白屏、零死按钮：加载中给轻提示、空说清「还没有内容」+ 下一步（**指向真的能点的「上传资料」**）、失败给人话 + 下一步 + **真的重发**的重试；上传／查找／看正文三件**只在注入端口到位时才可用**（端口缺席时禁用并把原因写在页面上，不是只挂在 title 里）。本页不发明宿主路由：数据只能从注入的端口进来（全文件无 fetch）
 * [PROTOCOL]: 变更时更新此头部、页面文案常量与 `tests/library-page.spec.ts`，然后检查 CLAUDE.md
 */

import { ChevronLeft, FileText, Folder, RefreshCw, Search, Upload } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { EnterpriseErrorNotice } from './error-notice.js'
import {
  ENTERPRISE_LIST_RETRY,
  ENTERPRISE_LIST_RETRY_LABEL,
  createEnterpriseListSource,
  type EnterpriseListSource,
  type EnterpriseListState,
} from './list-state.js'
import { EnterpriseLocalApiError, enterpriseLocalErrorCode, type EnterpriseLocalApi } from './local-api.js'
import type { EnterpriseLibraryHit, EnterpriseLibrarySpace } from './library-api-decode.js'

/** 页面标题（与侧栏入口同一句话；入口的可见文案由官方侧栏按 `sidebar.panellist` 的 metadata 渲染）。 */
export const ENTERPRISE_LIBRARY_PAGE_LABEL = '资料库'

/** 页面说明：一句话说清这里是干什么的（员工词，不出现任何技术缩写）。 */
export const ENTERPRISE_LIBRARY_PAGE_NOTE = '把你的资料集中放好，随时取用。'

/** 加载中：轻提示（不扔骨架、不留白屏）。 */
export const ENTERPRISE_LIBRARY_LOADING = '正在读取资料库，请稍候…'

/** 空态第一句：说清「为什么这里什么都没有」。 */
export const ENTERPRISE_LIBRARY_EMPTY = '资料库还没有内容。'

/** 上传控件（可见的那一枚按钮；空态的「下一步」指的就是它）。 */
export const ENTERPRISE_LIBRARY_UPLOAD = '上传资料'

/** 空态第二句：下一步是**真的能点的**那枚「上传资料」。 */
export const ENTERPRISE_LIBRARY_EMPTY_NEXT = `下一步：点「${ENTERPRISE_LIBRARY_UPLOAD}」把 .md 或 .txt 放进来。`

/** 失败态的动作前缀（人话与下一步由 error-messages.ts 的唯一映射给，本页不自造一句）。 */
export const ENTERPRISE_LIBRARY_FAILED_PREFIX = '资料库读取失败'

/** 真正吃文件的 file 输入的无障碍名（可见按钮点它；它自己也可键盘聚焦）。 */
export const ENTERPRISE_LIBRARY_UPLOAD_INPUT_LABEL = '选择要上传的 .md 或 .txt 文件'

/** 上传中提示（在途时可见，不静默）。 */
export const ENTERPRISE_LIBRARY_UPLOADING = '正在保存…'

/** 上传成功回执前缀：员工要确认「真的存进去了」（后面紧跟文件名）。 */
export const ENTERPRISE_LIBRARY_UPLOADED = '已保存到资料库：'

/** 上传失败的动作前缀（人话与下一步取自唯一映射表）。 */
export const ENTERPRISE_LIBRARY_UPLOAD_FAILED_PREFIX = '上传失败'

/** 查找框的无障碍名。 */
export const ENTERPRISE_LIBRARY_SEARCH_LABEL = '查找资料'

/** 查找框的占位文案。 */
export const ENTERPRISE_LIBRARY_SEARCH_PLACEHOLDER = '输入关键词查找资料'

/** 查找按钮（与输入框里回车是同一个动作）。 */
export const ENTERPRISE_LIBRARY_SEARCH_ACTION = '查找'

/** 清除查找（回到目录）。 */
export const ENTERPRISE_LIBRARY_SEARCH_CLEAR = '清除查找'

/** 查找中提示。 */
export const ENTERPRISE_LIBRARY_SEARCHING = '正在查找…'

/** 查找失败的动作前缀。 */
export const ENTERPRISE_LIBRARY_SEARCH_FAILED_PREFIX = '查找失败'

/** 一条都没命中。 */
export const ENTERPRISE_LIBRARY_SEARCH_EMPTY = '没有找到匹配的资料。'

/** 命中列表的小标题（带条数；`count` 由调用方从真实命中数取）。 */
export function enterpriseLibrarySearchTitle(count: number): string {
  return `找到 ${String(count)} 条`
}

/** 正文预览的小标题与返回动作。 */
export const ENTERPRISE_LIBRARY_PREVIEW_LABEL = '资料内容'

/** 回到列表（预览态的返回）。 */
export const ENTERPRISE_LIBRARY_PREVIEW_BACK = '返回列表'

/** 预览失败的动作前缀。 */
export const ENTERPRISE_LIBRARY_PREVIEW_FAILED_PREFIX = '打不开这份资料'

/** 预览加载中提示。 */
export const ENTERPRISE_LIBRARY_PREVIEW_LOADING = '正在打开…'

/** 已停用的行上那枚只读角标（照列，但说清状态）。 */
export const ENTERPRISE_LIBRARY_DISABLED_BADGE = '已停用'

/** 未接入控件**写在页面上**的原因（零死按钮：禁用一定配一句为什么）。 */
export const ENTERPRISE_LIBRARY_NOT_WIRED = '资料库接入中，暂不可用'

/** 那句原因在 DOM 里的 id（未接入时控件用 `aria-describedby` 指过来，读屏也听得到原因）。 */
export const ENTERPRISE_LIBRARY_NOT_WIRED_ID = 'own-library-not-wired'

/** 目录里的一行：界面只需要「一个稳定的标识 + 一行标题」这两件事实（多一个字都不猜）。 */
export interface EnterpriseLibraryItem {
  readonly id: string
  readonly title: string
  /** 树里的缩进层级（根下为 0）；缺省按 0。 */
  readonly depth?: number | undefined
  /** `folder`（只做层级展示，没有动作）或 `asset`（可点开看内容）；缺省按既有的纯列表渲染。 */
  readonly kind?: 'folder' | 'asset' | undefined
  /** 文件行指向的资产 id（文件夹行是 `null`）。 */
  readonly assetId?: string | null | undefined
  /** 资产是否已停用（停用的行照列，点开会被 Host 拒——界面如实带上这一位）。 */
  readonly status?: 'active' | 'disabled' | undefined
}

/** 本页唯一的取数源类型（入口层与 `main` 座位的 inject 面都只认这一份形状）。 */
export type EnterpriseLibrarySource = EnterpriseListSource<readonly EnterpriseLibraryItem[]>

/**
 * 目录取数端口：由宿主侧接过来（`main` 座位的 `inject` 面）。
 * 端口缺席＝宿主侧还没接线，页面如实说「接入中」。
 */
export type EnterpriseLibraryCatalogLoader = (signal: AbortSignal) => Promise<readonly EnterpriseLibraryItem[]>

/**
 * 页面动作端口：三件**会改变或读取状态**的动作（上传 / 查找 / 看正文）。
 *
 * 形状直接取自 `EnterpriseLocalApi` 的三条方法（同源固定路径 + 严格解码），因此本页拿不到也不该拿到
 * 任何 origin / Authorization——它根本不认识 fetch。
 */
export interface EnterpriseLibraryPagePort {
  readonly importText: EnterpriseLocalApi['libraryImport']
  readonly search: EnterpriseLocalApi['librarySearch']
  readonly readText: EnterpriseLocalApi['libraryReadText']
}

/** 查找区四态（与目录的四态分开：查过一次才出现，不是页面主状态）。 */
export type EnterpriseLibrarySearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly hits: readonly EnterpriseLibraryHit[] }
  | { readonly kind: 'failed'; readonly code: string }

/** 预览区四态。 */
export type EnterpriseLibraryPreviewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly title: string }
  | { readonly kind: 'ready'; readonly title: string; readonly content: string; readonly byteLength: number }
  | { readonly kind: 'failed'; readonly title: string; readonly code: string }

/** 上传四态。 */
export type EnterpriseLibraryUploadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly name: string }
  | { readonly kind: 'failed'; readonly code: string }

/** file 输入的 change 事件里本层真正要的两件事实（结构取窄，便于纯函数直调测试）。 */
export interface EnterpriseLibraryFileChangeEvent {
  readonly target: {
    readonly files?: { item(index: number): File | null } | null | undefined
    value?: string | undefined
  }
}

/** 页面的**可交互模型**：纯呈现函数只读它、不持有任何状态（状态全在 `EnterpriseLibraryPanel` 的 hook 里）。 */
export interface EnterpriseLibraryPageModel {
  readonly query: string
  readonly onQueryChange: (next: string) => void
  readonly onSearch: () => void
  readonly onClearSearch: () => void
  readonly search: EnterpriseLibrarySearchState
  readonly preview: EnterpriseLibraryPreviewState
  readonly onOpenAsset: (assetId: string) => void
  readonly onClosePreview: () => void
  readonly upload: EnterpriseLibraryUploadState
  readonly onUploadClick: () => void
  readonly onUploadChange: (event: EnterpriseLibraryFileChangeEvent) => void
  readonly uploadRef?: RefObject<HTMLInputElement> | undefined
}

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

/**
 * 整库目录 → 树行（纯投影，先序展开）。
 *
 * 顺序规则与 Host 的 `listNodes` 同源：同一父下**文件夹先**，再按 `zh-CN` 规则比名字；
 * `depth` 由父链算（根下的节点 depth = 0）。父不在目录里的节点（理论上不会出现）挂在根下——
 * 这样"看不见的节点"不会凭空消失，只是被摆到最外面。
 *
 * @param space - `space` 端点的严格解码结果。
 * @returns 先序排列的树行。
 */
export function enterpriseLibraryItems(space: EnterpriseLibrarySpace): readonly EnterpriseLibraryItem[] {
  const byParent = new Map<string | null, { id: string, title: string, kind: 'folder' | 'asset', assetId: string | null }[]>()
  const known = new Set(space.nodes.map(node => node.id))
  for (const node of space.nodes) {
    const parentId = node.parentId !== null && known.has(node.parentId) ? node.parentId : null
    const bucket = byParent.get(parentId) ?? []
    bucket.push({ id: node.id, title: node.title, kind: node.kind, assetId: node.assetId })
    byParent.set(parentId, bucket)
  }
  const status = new Map(space.assets.map(asset => [asset.id, asset.status]))
  const rows: EnterpriseLibraryItem[] = []
  const visit = (parentId: string | null, depth: number): void => {
    const bucket = [...(byParent.get(parentId) ?? [])].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.title.localeCompare(b.title, 'zh-CN')
    })
    for (const node of bucket) {
      rows.push({
        id: node.id,
        title: node.title,
        depth,
        kind: node.kind,
        assetId: node.assetId,
        ...(node.assetId === null ? {} : { status: status.get(node.assetId) ?? 'active' }),
      })
      if (node.kind === 'folder') visit(node.id, depth + 1)
    }
  }
  visit(null, 0)
  return rows
}

/** 一次失败 → 界面用的稳定码（动作失败与取数源同一份判定）。 */
function codeOf(error: unknown): string {
  return error instanceof EnterpriseLocalApiError ? error.code : enterpriseLocalErrorCode(error)
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
.own-library-file{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.own-library-notWired{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px}
.own-library-body{min-width:0;display:flex;flex-direction:column;gap:12px}
.own-library-hint{margin:0;display:flex;flex-direction:column;gap:6px;color:var(--dsw-alias-label-secondary,#667085);font-size:13px;line-height:20px}
.own-library-hint p{margin:0}
.own-library-error{padding:0;text-align:left;font-size:13px;line-height:20px;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#c4320a)}
.own-library-status{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#667085)}
.own-library-actions{margin-top:8px;display:flex;gap:8px;align-items:center}
.own-library-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.own-library-item{padding:0;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);font-size:13.5px;line-height:20px;overflow-wrap:anywhere}
.own-library-item:last-child{border-bottom:0}
.own-library-folder{display:flex;align-items:center;gap:8px;padding:10px 2px;color:var(--dsw-alias-label-secondary,#667085)}
.own-library-open{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:10px 2px;border:0;background:none;color:inherit;font:inherit;font-size:13.5px;line-height:20px;text-align:left;cursor:pointer;border-radius:6px}
.own-library-open:hover{background:var(--dsw-alias-bg-layer-2,#f9fafb)}
.own-library-open:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#155eef);outline-offset:2px}
.own-library-badge{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#98a2b3)}
.own-library-rowText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.own-library-hit{display:flex;flex-direction:column;gap:2px;padding:10px 2px;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-library-hit:last-child{border-bottom:0}
.own-library-hitPath{color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px}
.own-library-hitExcerpt{margin:0;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:19px;overflow-wrap:anywhere}
.own-library-preview{display:flex;flex-direction:column;gap:10px;min-width:0}
.own-library-previewTitle{margin:0;font-size:15px;line-height:22px;font-weight:600;overflow-wrap:anywhere}
.own-library-text{margin:0;padding:12px;max-height:52vh;overflow:auto;border:0.5px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fcfcfd);color:var(--dsw-alias-label-primary,#101828);font-size:12.5px;line-height:19px;white-space:pre-wrap;overflow-wrap:anywhere}
.own-library-meta{margin:0;color:var(--dsw-alias-label-tertiary,#98a2b3);font-size:12px;line-height:18px}
`

/** 目录树（文件夹无可点行为、文件行是真 button）。 */
function catalogRows(
  state: EnterpriseListState<readonly EnterpriseLibraryItem[]>,
  model: EnterpriseLibraryPageModel | undefined,
): ReactNode {
  const rows = state.kind === 'ready' ? state.value : []
  return (
    <ul className="own-library-items" data-enterprise-library-list="catalog">
      {rows.map(row => {
        const indent = { paddingLeft: `${String(2 + (row.depth ?? 0) * 14)}px` }
        if (row.kind === 'folder' || row.assetId === null || row.assetId === undefined) {
          return (
            <li key={row.id} className="own-library-item">
              <div className="own-library-folder" style={indent}>
                <Folder aria-hidden="true" size={14} />
                <span className="own-library-rowText">{row.title}</span>
              </div>
            </li>
          )
        }
        const assetId = row.assetId
        return (
          <li key={row.id} className="own-library-item">
            <button
              type="button"
              className="own-library-open"
              data-enterprise-library-open={assetId}
              style={indent}
              aria-label={`查看 ${row.title} 的内容`}
              onClick={() => { model?.onOpenAsset(assetId) }}
            >
              <FileText aria-hidden="true" size={14} />
              <span className="own-library-rowText">{row.title}</span>
              {row.status === 'disabled' ? <span className="own-library-badge">{ENTERPRISE_LIBRARY_DISABLED_BADGE}</span> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** 查找结果（每条也是一个真 button，点开看正文）。 */
function searchBlock(model: EnterpriseLibraryPageModel): ReactNode {
  if (model.search.kind === 'loading') return <p className="own-library-hint" role="status">{ENTERPRISE_LIBRARY_SEARCHING}</p>
  if (model.search.kind === 'failed') {
    return <EnterpriseErrorNotice className="own-library-error" code={model.search.code} prefix={ENTERPRISE_LIBRARY_SEARCH_FAILED_PREFIX} />
  }
  if (model.search.kind === 'idle') return null
  const hits = model.search.hits
  if (hits.length === 0) return <p className="own-library-hint" role="status">{ENTERPRISE_LIBRARY_SEARCH_EMPTY}</p>
  return (
    <div className="own-library-body" data-enterprise-library-list="search">
      <p className="own-library-status">{enterpriseLibrarySearchTitle(hits.length)}</p>
      <ul className="own-library-items">
        {hits.map(hit => (
          <li key={`${hit.assetId}-${hit.revisionId}`} className="own-library-hit">
            <button
              type="button"
              className="own-library-open"
              data-enterprise-library-open={hit.assetId}
              aria-label={`查看 ${hit.name} 的内容`}
              onClick={() => { model.onOpenAsset(hit.assetId) }}
            >
              <Search aria-hidden="true" size={14} />
              <span className="own-library-rowText">{hit.name}</span>
            </button>
            <span className="own-library-hitPath">{hit.folderPath}{hit.location === undefined ? '' : ` · ${hit.location}`}</span>
            <p className="own-library-hitExcerpt">{hit.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 预览的返回按钮（两种预览态共用一枚）。 */
function previewBack(model: EnterpriseLibraryPageModel): ReactNode {
  return (
    <button type="button" className="own-library-open" aria-label={ENTERPRISE_LIBRARY_PREVIEW_BACK} onClick={() => { model.onClosePreview() }}>
      <ChevronLeft aria-hidden="true" size={14} />
      <span>{ENTERPRISE_LIBRARY_PREVIEW_BACK}</span>
    </button>
  )
}

/** 正文预览（纯文本子节点，绝不注入 HTML）。 */
function previewBlock(model: EnterpriseLibraryPageModel): ReactNode {
  if (model.preview.kind === 'loading') {
    return (
      <div className="own-library-preview" data-enterprise-library-preview="loading">
        {previewBack(model)}
        <p className="own-library-hint" role="status">{ENTERPRISE_LIBRARY_PREVIEW_LOADING}</p>
      </div>
    )
  }
  const state = model.preview
  return (
    <div className="own-library-preview" data-enterprise-library-preview={state.kind}>
      {previewBack(model)}
      <h3 className="own-library-previewTitle">{state.kind === 'ready' || state.kind === 'failed' ? state.title : ''}</h3>
      <p className="own-library-meta">{ENTERPRISE_LIBRARY_PREVIEW_LABEL}</p>
      {state.kind === 'failed'
        ? <EnterpriseErrorNotice className="own-library-error" code={state.code} prefix={ENTERPRISE_LIBRARY_PREVIEW_FAILED_PREFIX} />
        : <pre className="own-library-text">{state.kind === 'ready' ? state.content : ''}</pre>}
    </div>
  )
}

/**
 * 资料库页面（**纯函数**，无 hook，可直接函数调用测试）。
 *
 * 三态互斥由 `state.kind` 一人决定：加载中只说「正在读取」，空说清「还没有内容 + 下一步」，
 * 失败渲染唯一的失败呈现（人话 + 下一步 + 「技术信息」里的稳定码）并给**真的重发**的重试。
 * 「重试」按钮只在回调接通时出现（不给死按钮）；三枚控件只在 `model` 到位时可用。
 *
 * @param props.state - 目录四态之一（取自 `createEnterpriseLibraryCatalogSource`）。
 * @param props.onReload - 重试（用户点它＝真的再取一次）；缺席即不渲染那枚按钮。
 * @param props.model - 页面动作模型；**缺席＝宿主动作端口还没接线**，控件一律禁用并在页面上写明原因。
 */
export function EnterpriseLibraryPanelView({
  state,
  onReload,
  model,
}: {
  readonly state: EnterpriseListState<readonly EnterpriseLibraryItem[]>
  readonly onReload?: (() => void) | undefined
  readonly model?: EnterpriseLibraryPageModel | undefined
}): ReactNode {
  const wired = model !== undefined
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
  } else if (model !== undefined && model.preview.kind !== 'idle') {
    body = previewBlock(model)
  } else if (model !== undefined && model.search.kind !== 'idle') {
    body = searchBlock(model)
  } else {
    body = catalogRows(state, model)
  }

  return (
    <section className="own-library-page" aria-label={ENTERPRISE_LIBRARY_PAGE_LABEL} data-enterprise-library-state={state.kind}>
      <style>{libraryStyles}</style>
      <header className="own-library-head">
        <h2 className="own-library-title">{ENTERPRISE_LIBRARY_PAGE_LABEL}</h2>
        <p className="own-library-note">{ENTERPRISE_LIBRARY_PAGE_NOTE}</p>
      </header>
      {/* 三枚控件：接入后可用；未接入时**禁用 + 页面上写着原因**（不是只有 title），并用 aria-describedby 指过去。 */}
      <div className="own-library-toolbar">
        <Button
          variant="outline"
          size="sm"
          disabled={!wired || model?.upload.kind === 'saving'}
          {...(wired ? {} : { 'aria-describedby': ENTERPRISE_LIBRARY_NOT_WIRED_ID })}
          icon={<Upload aria-hidden="true" size={14} />}
          onClick={() => { model?.onUploadClick() }}
        >
          {ENTERPRISE_LIBRARY_UPLOAD}
        </Button>
        <input
          ref={model?.uploadRef}
          className="own-library-file"
          type="file"
          accept=".md,.markdown,.txt,.text,text/markdown,text/plain"
          aria-label={ENTERPRISE_LIBRARY_UPLOAD_INPUT_LABEL}
          disabled={!wired}
          onChange={event => { model?.onUploadChange(event) }}
        />
        <input
          className="own-library-search"
          type="search"
          aria-label={ENTERPRISE_LIBRARY_SEARCH_LABEL}
          {...(wired ? {} : { 'aria-describedby': ENTERPRISE_LIBRARY_NOT_WIRED_ID })}
          disabled={!wired}
          placeholder={ENTERPRISE_LIBRARY_SEARCH_PLACEHOLDER}
          value={model?.query ?? ''}
          onChange={event => { model?.onQueryChange(event.target.value) }}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            model?.onSearch()
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!wired || (model?.query.trim().length ?? 0) === 0}
          icon={<Search aria-hidden="true" size={14} />}
          onClick={() => { model?.onSearch() }}
        >
          {ENTERPRISE_LIBRARY_SEARCH_ACTION}
        </Button>
        {wired && model.search.kind !== 'idle' ? (
          <Button size="sm" onClick={() => { model.onClearSearch() }}>{ENTERPRISE_LIBRARY_SEARCH_CLEAR}</Button>
        ) : null}
        {wired ? null : <span className="own-library-notWired" id={ENTERPRISE_LIBRARY_NOT_WIRED_ID}>{ENTERPRISE_LIBRARY_NOT_WIRED}</span>}
      </div>
      {wired && model.upload.kind === 'saving' ? <p className="own-library-status" role="status">{ENTERPRISE_LIBRARY_UPLOADING}</p> : null}
      {wired && model.upload.kind === 'saved'
        ? <p className="own-library-status" role="status">{`${ENTERPRISE_LIBRARY_UPLOADED}${model.upload.name}`}</p>
        : null}
      {wired && model.upload.kind === 'failed'
        ? <EnterpriseErrorNotice className="own-library-error" code={model.upload.code} prefix={ENTERPRISE_LIBRARY_UPLOAD_FAILED_PREFIX} />
        : null}
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
 * 它只做接线（订阅 + 生命周期 + 三个动作的在途/失败状态），呈现全部交给纯函数
 * `EnterpriseLibraryPanelView`，因此「页面长什么样」这件事在测试里不需要 DOM。
 *
 * @param props.source - 由注册面的 `inject` 注入的取数源；缺席时页面停在「加载中」的恒定快照（不假装空）。
 * @param props.api - 三件动作的端口；缺席时控件禁用并说明原因。
 */
export function EnterpriseLibraryPanel({
  source,
  api,
}: {
  readonly source?: EnterpriseLibrarySource | undefined
  readonly api?: EnterpriseLibraryPagePort | undefined
}): ReactNode {
  const state = useSyncExternalStore(
    source?.subscribe ?? LIBRARY_NOOP_SUBSCRIBE,
    source?.getSnapshot ?? LIBRARY_LOADING_GET_SNAPSHOT,
    source?.getSnapshot ?? LIBRARY_LOADING_GET_SNAPSHOT,
  )
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<EnterpriseLibrarySearchState>({ kind: 'idle' })
  const [preview, setPreview] = useState<EnterpriseLibraryPreviewState>({ kind: 'idle' })
  const [upload, setUpload] = useState<EnterpriseLibraryUploadState>({ kind: 'idle' })
  // 三个动作各自的在途请求：重新发起或卸载即中止，迟到结果不回填。
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => {
    if (source === undefined) return
    // 幂等启动：已有结果或用例重复挂载都不会打出第二条请求。
    source.load()
    // 离开页面即中止在途并回到初始加载态（迟到结果由源的代际守卫丢弃）。
    return () => { source.reset() }
  }, [source])

  useEffect(() => () => { inFlight.current?.abort() }, [])

  const runSearch = (): void => {
    if (api === undefined) return
    const term = query.trim()
    if (term.length === 0) return
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setPreview({ kind: 'idle' })
    setSearch({ kind: 'loading' })
    void api.search(term, controller.signal).then(
      hits => { setSearch({ kind: 'ready', hits }) },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setSearch({ kind: 'failed', code: codeOf(error) })
      },
    )
  }

  const openAsset = (assetId: string): void => {
    if (api === undefined) return
    const known = state.kind === 'ready' ? state.value.find(row => row.assetId === assetId) : undefined
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setPreview({ kind: 'loading', title: known?.title ?? '' })
    void api.readText(assetId, controller.signal).then(
      text => { setPreview({ kind: 'ready', title: text.name, content: text.content, byteLength: text.byteLength }) },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setPreview({ kind: 'failed', title: known?.title ?? '', code: codeOf(error) })
      },
    )
  }

  const uploadFile = (file: { readonly name: string, readonly content: string }): void => {
    if (api === undefined) return
    setUpload({ kind: 'saving' })
    void api.importText({ name: file.name, content: file.content }, new AbortController().signal).then(
      () => {
        setUpload({ kind: 'saved', name: file.name })
        // 存完就让目录重新取一次：员工马上能看到它（不靠"刷新页面才出现"）。
        source?.retry()
      },
      (error: unknown) => { setUpload({ kind: 'failed', code: codeOf(error) }) },
    )
  }

  const model: EnterpriseLibraryPageModel | undefined = api === undefined ? undefined : {
    query,
    onQueryChange: setQuery,
    onSearch: runSearch,
    onClearSearch: () => { setSearch({ kind: 'idle' }); setQuery('') },
    search,
    preview,
    onOpenAsset: openAsset,
    onClosePreview: () => { setPreview({ kind: 'idle' }) },
    upload,
    onUploadClick: () => { uploadRef.current?.click() },
    uploadRef,
    onUploadChange: event => {
      const files = event.target.files
      const file = files === undefined || files === null ? null : files.item(0)
      if (event.target.value !== undefined) event.target.value = ''
      if (file === null) return
      void file.text().then(
        content => { uploadFile({ name: file.name, content }) },
        () => { setUpload({ kind: 'failed', code: 'ENT_LIBRARY_FILE_READ_FAILED' }) },
      )
    },
  }

  return (
    <EnterpriseLibraryPanelView
      state={state}
      onReload={source === undefined ? undefined : () => { source.retry() }}
      model={model}
    />
  )
}
