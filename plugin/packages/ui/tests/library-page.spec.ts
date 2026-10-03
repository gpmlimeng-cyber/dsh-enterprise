/**
 * [INPUT]: 依赖 `src/library-panel.tsx`（树行投影、纯呈现、取数源）、`src/library-api-decode.ts`（资料库 DTO 严格解码）、`src/local-api.ts`（同源四条的收发）、`src/error-notice.ts` 的技术码判据
 * [OUTPUT]: 资料库**页面与取数**的门禁——① 树行投影（文件夹先、`zh-CN` 序、depth、停用位）；② 四份 DTO 的键集封闭（Host 多塞一个键即整条判畸形）；③ 页面三块内容区（目录树 / 查找命中 / 正文预览）与三枚控件的可用性（接入即可用、未接入禁用并写明原因）；④ 三个动作真发请求（上传 / 查找 / 看正文）与三条失败路径（动作失败给稳定码、读文件失败给本机码）；⑤ 同源四条的**路径与请求体**逐字（`POST /library` + `{endpoint,payload}`）+ 响应畸形即 `ENT_LOCAL_RESPONSE_INVALID`
 * [POS]: tests 下资料库「最小可用页面 + 同源取数」的**行为回归**；本仓 vitest 没有 DOM，故页面用纯函数直调、取数用假 fetch 断言真请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

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
  Modal: vi.fn(),
}))

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { ENTERPRISE_ERROR_TECH_ATTR } from '../src/error-notice.js'
import {
  ENTERPRISE_LIBRARY_DISABLED_BADGE,
  ENTERPRISE_LIBRARY_NOT_WIRED,
  ENTERPRISE_LIBRARY_NOT_WIRED_ID,
  ENTERPRISE_LIBRARY_PREVIEW_BACK,
  ENTERPRISE_LIBRARY_SEARCH_ACTION,
  ENTERPRISE_LIBRARY_SEARCH_EMPTY,
  ENTERPRISE_LIBRARY_SEARCH_LABEL,
  ENTERPRISE_LIBRARY_UPLOAD,
  ENTERPRISE_LIBRARY_UPLOADED,
  EnterpriseLibraryPanelView,
  createEnterpriseLibraryCatalogSource,
  enterpriseLibraryItems,
  enterpriseLibrarySearchTitle,
  type EnterpriseLibraryPageModel,
  type EnterpriseLibrarySearchState,
} from '../src/library-panel.js'
import {
  decodeEnterpriseLibraryHits,
  decodeEnterpriseLibraryImport,
  decodeEnterpriseLibrarySpace,
  decodeEnterpriseLibraryText,
  type EnterpriseLibraryHit,
  type EnterpriseLibrarySpace,
} from '../src/library-api-decode.js'
import { createEnterpriseLocalApi } from '../src/local-api.js'

/** 收集可见文本（跳过 `<style>` 与「技术信息」里那枚稳定码）。 */
function visibleText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(visibleText).join(' ')
  if (!isValidElement(node)) return ''
  const props = node.props as Record<string, unknown>
  if (node.type === 'style') return ''
  if (props[ENTERPRISE_ERROR_TECH_ATTR] !== undefined) return ''
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return visibleText(rendered as ReactNode)
  }
  return visibleText(props['children'] as ReactNode)
}

/** 收集「技术信息」里的稳定码。 */
function technicalCodes(node: ReactNode, acc: string[] = []): string[] {
  if (Array.isArray(node)) { for (const child of node) technicalCodes(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const code = props[ENTERPRISE_ERROR_TECH_ATTR]
  if (typeof code === 'string') acc.push(code)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return technicalCodes(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') technicalCodes(value as ReactNode, acc)
  }
  return acc
}

/** 收集树上 `type === target` 的元素（保留顺序）。 */
function collectByType(node: ReactNode, target: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) { for (const child of node) collectByType(child, target, acc); return acc }
  if (!isValidElement(node)) return acc
  if (node.type === target) { acc.push(node.props as Record<string, unknown>); return acc }
  const props = node.props as Record<string, unknown>
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByType(rendered as ReactNode, target, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByType(value as ReactNode, target, acc)
  }
  return acc
}

/** 收集所有 `data-enterprise-library-open` 按钮（树行与命中行都是它）。 */
function openButtons(node: ReactNode, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) { for (const child of node) openButtons(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (props['data-enterprise-library-open'] !== undefined) acc.push(props)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return openButtons(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') openButtons(value as ReactNode, acc)
  }
  return acc
}

const NOW = '2026-10-03T08:00:00.000Z'

function node(id: string, parentId: string | null, kind: 'folder' | 'asset', title: string, assetId: string | null): Record<string, unknown> {
  return { id, parentId, kind, title, assetId, createdAt: NOW, updatedAt: NOW }
}

function asset(id: string, name: string, status: 'active' | 'disabled' = 'active'): Record<string, unknown> {
  return {
    id, name, kind: 'markdown', mediaType: 'text/markdown', byteLength: 12, currentRevisionId: `rv_${id}`,
    status, source: 'upload', createdAt: NOW, updatedAt: NOW,
  }
}

const SPACE: EnterpriseLibrarySpace = decodeEnterpriseLibrarySpace({
  rootTitle: '我的资料',
  nodes: [
    node('nd_2', null, 'asset', 'bbb.md', 'as_2'),
    node('nd_3', null, 'folder', '项目甲', null),
    node('nd_1', null, 'asset', 'aaa.md', 'as_1'),
    node('nd_4', 'nd_3', 'asset', 'ccc.md', 'as_3'),
  ],
  assets: [asset('as_1', 'aaa.md'), asset('as_2', 'bbb.md'), asset('as_3', 'ccc.md', 'disabled')],
})

const HIT: EnterpriseLibraryHit = {
  assetId: 'as_1',
  revisionId: 'rv_as_1',
  name: 'aaa.md',
  kind: 'markdown',
  source: 'upload',
  updatedAt: NOW,
  folderPath: '我的资料',
  excerpt: '这里有一段摘录',
}

function model(overrides: Partial<EnterpriseLibraryPageModel> = {}): EnterpriseLibraryPageModel {
  return {
    query: '',
    onQueryChange: () => undefined,
    onSearch: () => undefined,
    onClearSearch: () => undefined,
    search: { kind: 'idle' },
    preview: { kind: 'idle' },
    onOpenAsset: () => undefined,
    onClosePreview: () => undefined,
    upload: { kind: 'idle' },
    onUploadClick: () => undefined,
    onUploadChange: () => undefined,
    ...overrides,
  }
}

function ready(hits: readonly EnterpriseLibraryHit[]): EnterpriseLibrarySearchState {
  return { kind: 'ready', hits }
}

describe('资料库页面：目录树 / 查找 / 预览三块内容区', () => {
  it('树行投影：文件夹先、同层按 zh-CN 序、depth 逐层加一、停用位带上', () => {
    const rows = enterpriseLibraryItems(SPACE)
    // 先序展开：同一层里文件夹排在文件之前，文件夹的子节点紧跟它（depth 逐层 +1）。
    expect(rows.map(row => `${String(row.depth)}:${row.kind ?? ''}:${row.title}`)).toEqual([
      '0:folder:项目甲',
      '1:asset:ccc.md',
      '0:asset:aaa.md',
      '0:asset:bbb.md',
    ])
    expect(rows[1]!.status).toBe('disabled')
    expect(rows[0]!.assetId).toBeNull()
  })

  it('四份 DTO 的键集是封闭的：多一个键、错一个时间戳、错一个枚举都整条判畸形', () => {
    expect(decodeEnterpriseLibrarySpace({ rootTitle: '我的资料', nodes: [], assets: [] })).toEqual({ rootTitle: '我的资料', nodes: [], assets: [] })
    expect(() => decodeEnterpriseLibrarySpace({ rootTitle: '我的资料', nodes: [], assets: [], extra: 1 })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibrarySpace({ rootTitle: '我的资料', nodes: [{ ...node('nd_1', null, 'asset', 'a.md', 'as_1'), extra: 1 }], assets: [] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    // 文件夹不该带资产 id / 文件节点必须带（Host 的建树不变量）。
    expect(() => decodeEnterpriseLibrarySpace({ rootTitle: '我的资料', nodes: [node('nd_1', null, 'folder', 'x', 'as_1')], assets: [] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibrarySpace({ rootTitle: '我的资料', nodes: [{ ...node('nd_1', null, 'asset', 'a.md', 'as_1'), updatedAt: '2026/10/03' }], assets: [] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)

    const imported = decodeEnterpriseLibraryImport({ asset: asset('as_1', 'a.md'), revision: { id: 'rv_1', assetId: 'as_1', number: 1, originalByteLength: 3, contentByteLength: 3, conversionStatus: 'ready', createdAt: NOW } })
    expect(imported.asset.id).toBe('as_1')
    expect(() => decodeEnterpriseLibraryImport({ asset: asset('as_1', 'a.md'), revision: { id: 'rv_1', assetId: 'as_1', number: 0, originalByteLength: 3, contentByteLength: 3, conversionStatus: 'ready', createdAt: NOW } })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)

    expect(decodeEnterpriseLibraryHits({ hits: [HIT] })).toEqual([HIT])
    expect(() => decodeEnterpriseLibraryHits({ hits: [{ ...HIT, excerpt: undefined }] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibraryHits({ hits: [{ ...HIT, kind: 'zip' }] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)

    expect(decodeEnterpriseLibraryText({ assetId: 'as_1', revisionId: 'rv_1', name: 'a.md', kind: 'markdown', content: '正文', byteLength: 6 }).content).toBe('正文')
    expect(() => decodeEnterpriseLibraryText({ assetId: 'as_1', revisionId: 'rv_1', name: 'a.md', kind: 'markdown', content: '正文', byteLength: 6, path: '/etc/passwd' })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })

  it('接入后：上传与查找可用；未接入：禁用 + 页面上写着原因 + aria-describedby 指过去', () => {
    const wired = EnterpriseLibraryPanelView({ state: { kind: 'ready', value: enterpriseLibraryItems(SPACE) }, model: model() })
    const upload = collectByType(wired, Button).find(props => props['children'] === ENTERPRISE_LIBRARY_UPLOAD)!
    expect(upload['disabled']).toBe(false)
    expect(upload['aria-describedby']).toBeUndefined()
    const search = collectByType(wired, 'input').find(props => props['aria-label'] === ENTERPRISE_LIBRARY_SEARCH_LABEL)!
    expect(search['disabled']).toBe(false)
    expect(visibleText(wired)).not.toContain(ENTERPRISE_LIBRARY_NOT_WIRED)
    // 目录树：文件行是可点按钮、文件夹行不是。
    expect(openButtons(wired).map(props => props['data-enterprise-library-open'])).toEqual(['as_3', 'as_1', 'as_2'])
    expect(visibleText(wired)).toContain(ENTERPRISE_LIBRARY_DISABLED_BADGE)

    const cold = EnterpriseLibraryPanelView({ state: { kind: 'ready', value: enterpriseLibraryItems(SPACE) } })
    const coldUpload = collectByType(cold, Button).find(props => props['children'] === ENTERPRISE_LIBRARY_UPLOAD)!
    expect(coldUpload['disabled']).toBe(true)
    expect(coldUpload['aria-describedby']).toBe(ENTERPRISE_LIBRARY_NOT_WIRED_ID)
    expect(visibleText(cold)).toContain(ENTERPRISE_LIBRARY_NOT_WIRED)
  })

  it('查找：命中列表带路径与摘录、点一行打开正文、返回按钮回到列表；空命中说清「没找到」', () => {
    const opened: string[] = []
    const closed = vi.fn()
    const hits = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: enterpriseLibraryItems(SPACE) },
      model: model({ query: '摘录', search: ready([HIT]), onOpenAsset: id => { opened.push(id) } }),
    })
    const text = visibleText(hits)
    expect(text).toContain(enterpriseLibrarySearchTitle(1))
    expect(text).toContain(HIT.excerpt)
    expect(text).toContain('我的资料')
    expect(openButtons(hits)).toHaveLength(1)
    ;(openButtons(hits)[0]!['onClick'] as () => void)()
    expect(opened).toEqual(['as_1'])

    const empty = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: [] },
      model: model({ search: ready([]) }),
    })
    expect(visibleText(empty)).toContain(ENTERPRISE_LIBRARY_SEARCH_EMPTY)

    // 预览：正文是 `<pre>` 的纯文本子节点（不注入 HTML），返回按钮真的回调。
    const preview = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: enterpriseLibraryItems(SPACE) },
      model: model({ preview: { kind: 'ready', title: 'aaa.md', content: '<b>正文</b>', byteLength: 11 }, onClosePreview: closed }),
    })
    const pre = collectByType(preview, 'pre')[0]
    expect(pre['children']).toBe('<b>正文</b>')
    expect(visibleText(preview)).toContain('aaa.md')
    const back = collectByType(preview, 'button').find(props => props['aria-label'] === ENTERPRISE_LIBRARY_PREVIEW_BACK)!
    ;(back['onClick'] as () => void)()
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('查找失败 / 预览失败 / 上传失败：人话 + 下一步 + 收进「技术信息」的稳定码', () => {
    const searchFailed = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: [] },
      model: model({ search: { kind: 'failed', code: 'ENT_LIBRARY_TOO_LARGE' } }),
    })
    expect(visibleText(searchFailed)).toContain('这份资料太大了，暂时放不进资料库。')
    expect(technicalCodes(searchFailed)).toContain('ENT_LIBRARY_TOO_LARGE')
    expect(visibleText(searchFailed)).not.toContain('ENT_LIBRARY_TOO_LARGE')

    const previewFailed = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: enterpriseLibraryItems(SPACE) },
      model: model({ preview: { kind: 'failed', title: 'aaa.md', code: 'ENT_LIBRARY_DISABLED' } }),
    })
    expect(visibleText(previewFailed)).toContain('这份资料已停用。')
    expect(technicalCodes(previewFailed)).toContain('ENT_LIBRARY_DISABLED')

    const uploadFailed = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: [] },
      model: model({ upload: { kind: 'failed', code: 'ENT_LIBRARY_FILE_READ_FAILED' } }),
    })
    expect(visibleText(uploadFailed)).toContain('选中的文件读不出来。')
    expect(technicalCodes(uploadFailed)).toContain('ENT_LIBRARY_FILE_READ_FAILED')

    const saved = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: [] },
      model: model({ upload: { kind: 'saved', name: '周报.md' } }),
    })
    expect(visibleText(saved)).toContain(`${ENTERPRISE_LIBRARY_UPLOADED}周报.md`)
  })

  it('键盘可达：查找框回车即触发同一枚查找动作，文件输入也有无障碍名', () => {
    const onSearch = vi.fn()
    const tree = EnterpriseLibraryPanelView({
      state: { kind: 'ready', value: [] },
      model: model({ query: '安装', onSearch }),
    })
    const search = collectByType(tree, 'input').find(props => props['aria-label'] === ENTERPRISE_LIBRARY_SEARCH_LABEL)!
    ;(search['onKeyDown'] as (event: { key: string }) => void)({ key: 'Enter' })
    expect(onSearch).toHaveBeenCalledTimes(1)
    const action = collectByType(tree, Button).find(props => props['children'] === ENTERPRISE_LIBRARY_SEARCH_ACTION)!
    expect(action['disabled']).toBe(false)
    ;(action['onClick'] as () => void)()
    expect(onSearch).toHaveBeenCalledTimes(2)
    // 空关键词时那枚按钮禁用（不给"点了什么都不发生"的按钮）。
    const blank = collectByType(EnterpriseLibraryPanelView({ state: { kind: 'ready', value: [] }, model: model({ query: '  ' }) }), Button)
      .find(props => props['children'] === ENTERPRISE_LIBRARY_SEARCH_ACTION)!
    expect(blank['disabled']).toBe(true)
    // 文件输入在树上且可被读屏叫出名字。
    const fileInput = collectByType(tree, 'input').find(props => props['type'] === 'file')!
    expect(String(fileInput['aria-label'])).toContain('.md')
  })

  it('取数源：端口缺席如实出「接入中」，给了端口就按 space 取一次（重试真重发）', async () => {
    const cold = createEnterpriseLibraryCatalogSource()
    cold.load()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(cold.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_LIBRARY_UNAVAILABLE' })

    const load = vi.fn(async () => enterpriseLibraryItems(SPACE))
    const warm = createEnterpriseLibraryCatalogSource(load)
    warm.load()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(warm.getSnapshot().kind).toBe('ready')
    expect(load).toHaveBeenCalledTimes(1)
    warm.retry()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(load).toHaveBeenCalledTimes(2)
    expect(warm.requests()).toBe(2)
  })
})

describe('资料库同源取数：路径、请求体与严格解码', () => {
  it('四条都打 POST /library + 关闭键集的 {endpoint,payload}，并按 DTO 解码', async () => {
    const calls: { url: string, body: unknown, method: string }[] = []
    const fetcher = (async (input: string, init: RequestInit) => {
      calls.push({ url: input, body: JSON.parse(String(init.body)) as unknown, method: String(init.method) })
      const endpoint = (JSON.parse(String(init.body)) as { endpoint: string }).endpoint
      const data = endpoint === 'space'
        ? { rootTitle: '我的资料', nodes: [], assets: [] }
        : endpoint === 'import'
          ? { asset: asset('as_1', 'a.md'), revision: { id: 'rv_1', assetId: 'as_1', number: 1, originalByteLength: 3, contentByteLength: 3, conversionStatus: 'ready', createdAt: NOW } }
          : endpoint === 'search'
            ? { hits: [HIT] }
            : { assetId: 'as_1', revisionId: 'rv_1', name: 'a.md', kind: 'markdown', content: '正文', byteLength: 6 }
      return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' }, status: 200 })
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal

    await expect(api.librarySpace(signal)).resolves.toEqual({ rootTitle: '我的资料', nodes: [], assets: [] })
    await expect(api.libraryImport({ name: 'a.md', content: '正文' }, signal)).resolves.toMatchObject({ asset: { id: 'as_1' } })
    await expect(api.librarySearch('摘录', signal)).resolves.toEqual([HIT])
    await expect(api.libraryReadText('as_1', signal)).resolves.toMatchObject({ content: '正文' })

    expect(calls.map(call => call.url)).toEqual([
      '/enterprise/api/v1/local/library',
      '/enterprise/api/v1/local/library',
      '/enterprise/api/v1/local/library',
      '/enterprise/api/v1/local/library',
    ])
    expect(calls.every(call => call.method === 'POST')).toBe(true)
    expect(calls.map(call => call.body)).toEqual([
      { endpoint: 'space', payload: {} },
      { endpoint: 'import', payload: { name: 'a.md', content: '正文' } },
      { endpoint: 'search', payload: { query: '摘录' } },
      { endpoint: 'read-text', payload: { assetId: 'as_1' } },
    ])
  })

  it('非 2xx 的稳定码原样抛出；响应多一个键即判畸形', async () => {
    const failing = (async () => new Response(JSON.stringify({ error: { code: 'ENT_LIBRARY_UNAVAILABLE' } }), { status: 503 })) as unknown as typeof fetch
    await expect(createEnterpriseLocalApi(failing).librarySpace(new AbortController().signal))
      .rejects.toMatchObject({ code: 'ENT_LIBRARY_UNAVAILABLE', status: 503 })

    const extra = (async () => new Response(JSON.stringify({
      data: { rootTitle: '我的资料', nodes: [], assets: [], rootPath: '/data/library' },
    }), { status: 200 })) as unknown as typeof fetch
    await expect(createEnterpriseLocalApi(extra).librarySpace(new AbortController().signal))
      .rejects.toMatchObject({ code: 'ENT_LOCAL_RESPONSE_INVALID' })
  })
})
