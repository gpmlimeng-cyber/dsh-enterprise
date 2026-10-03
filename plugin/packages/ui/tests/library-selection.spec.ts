/**
 * [INPUT]: 依赖 `src/library-selection.ts`（选中集合 store 与生命周期）、`src/library-selection-trigger.ts`（`@` 触发源与两个纯函数）、`src/library-selection-view.tsx`（两处 composer 座位的呈现与注册选项）、`src/library-api-decode.ts`（两条 endpoint 的严格解码）、`src/local-api.ts`（同源两条的收发）、`src/library-panel.ts`（目录树行投影）
 * [OUTPUT]: 资料库 P1-A 的门禁——① 两条 endpoint 的 DTO 键集封闭；② 同源两条的路径与请求体逐字；③ **选中集合的产生与生命周期**：选中一份 ⇒ 集合里出现 Host 给的那枚固定修订、再点即移除、`remove`/`clear` 走同一条覆盖写、**停用/已删即从集合的两个投影里一起消失（Host 读侧剔除）**、**新会话为空**、**读不到时绝不用未知状态去写**（一次"加入"的点击不会把原先选的一堆覆盖掉）、失败给稳定码 + 留痕；④ `@` 触发源的形状与拾取语义（候选过滤/上限/已选提示、onPick 写集合并清掉草稿里的 `@查询`、取目录失败**原样抛**且取消不算失败）；⑤ 界面落点：**未选中 ⇒ 一个节点都不渲染**（既有输入区行为逐字不变）、有条目即可见可逐份移除可清空、失败出说明 + 重试、按钮的 disabled 与插入串（`@` / ` @`）
 * [POS]: tests 下资料库「把资料加入当前对话」的**行为回归**；本仓 vitest 没有 DOM，故组件用纯呈现直调、壳只验它交给纯呈现的那几个字段（与 `library-page.spec.ts` 同一手法）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
}))

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  ENTERPRISE_LIBRARY_SET_TASK_SELECTION_KEYS,
  ENTERPRISE_LIBRARY_TASK_SELECTION_KEYS,
  decodeEnterpriseLibrarySetTaskSelection,
  decodeEnterpriseLibrarySpace,
  decodeEnterpriseLibraryTaskSelection,
  type EnterpriseLibrarySelection,
  type EnterpriseLibrarySelectionItem,
} from '../src/library-api-decode.js'
import { EnterpriseLocalApiError, createEnterpriseLocalApi } from '../src/local-api.js'
import { enterpriseLibraryItems, type EnterpriseLibraryItem } from '../src/library-panel.js'
import {
  ENTERPRISE_LIBRARY_SELECTION_EMPTY,
  ENTERPRISE_LIBRARY_SELECTION_FAILED,
  ENTERPRISE_LIBRARY_SELECTION_REMOVE_PREFIX,
  ENTERPRISE_LIBRARY_SELECTION_RETRY,
  ENTERPRISE_LIBRARY_SELECTION_TITLE,
  createEnterpriseLibrarySelectionStore,
  type EnterpriseLibrarySelectionApi,
} from '../src/library-selection.js'
import {
  ENTERPRISE_LIBRARY_TRIGGER_LIMIT,
  ENTERPRISE_LIBRARY_TRIGGER_SELECTED_HINT,
  createEnterpriseLibraryTriggerSource,
  enterpriseLibraryTriggerCandidates,
  enterpriseLibraryTriggerInsertion,
} from '../src/library-selection-trigger.js'
import {
  ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ARIA,
  ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ID,
  ENTERPRISE_LIBRARY_TRIGGER_BUTTON_LABEL,
  EnterpriseLibrarySelectionView,
  EnterpriseLibraryTriggerButton,
  EnterpriseLibraryTriggerButtonView,
  enterpriseLibrarySelectionDockOptions,
  enterpriseLibraryTriggerButtonOptions,
} from '../src/library-selection-view.js'

const NOW = '2026-10-03T08:00:00.000Z'

function node(id: string, kind: 'folder' | 'asset', title: string, assetId: string | null): Record<string, unknown> {
  return { id, parentId: null, kind, title, assetId, createdAt: NOW, updatedAt: NOW }
}

function asset(id: string, name: string, status: 'active' | 'disabled' = 'active'): Record<string, unknown> {
  return {
    id, name, kind: 'markdown', mediaType: 'text/markdown', byteLength: 12, currentRevisionId: `rv_${id}`,
    status, source: 'upload', createdAt: NOW, updatedAt: NOW,
  }
}

/** 目录树：两条文件行（`nd_a` / `nd_b`）+ 一个文件夹（不该出现在 `@` 候选里）+ 一条停用文件行。 */
const ROWS: readonly EnterpriseLibraryItem[] = enterpriseLibraryItems(decodeEnterpriseLibrarySpace({
  rootTitle: '我的资料',
  nodes: [
    node('nd_a', 'asset', 'aaa.md', 'as_a'),
    node('nd_b', 'asset', 'bbb.md', 'as_b'),
    node('nd_dir', 'folder', '项目甲', null),
    node('nd_off', 'asset', 'off.md', 'as_off'),
  ],
  assets: [asset('as_a', 'aaa.md'), asset('as_b', 'bbb.md'), asset('as_off', 'off.md', 'disabled')],
}))

const ITEM_A: EnterpriseLibrarySelectionItem = { nodeId: 'nd_a', assetId: 'as_a', revisionId: 'rv_as_a', name: 'aaa.md', kind: 'markdown' }
const ITEM_B: EnterpriseLibrarySelectionItem = { nodeId: 'nd_b', assetId: 'as_b', revisionId: 'rv_as_b', name: 'bbb.md', kind: 'markdown' }

/** 收集树上 `type === target` 的元素。 */
function collectByType(nodeValue: ReactNode, target: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(nodeValue)) { for (const child of nodeValue) collectByType(child, target, acc); return acc }
  if (!isValidElement(nodeValue)) return acc
  if (nodeValue.type === target) { acc.push(nodeValue.props as Record<string, unknown>); return acc }
  const props = nodeValue.props as Record<string, unknown>
  if (typeof nodeValue.type === 'function') {
    const rendered = (nodeValue.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return collectByType(rendered as ReactNode, target, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') collectByType(value as ReactNode, target, acc)
  }
  return acc
}

/** 收集可见文本。 */
function visibleText(nodeValue: ReactNode): string {
  if (typeof nodeValue === 'string' || typeof nodeValue === 'number') return String(nodeValue)
  if (Array.isArray(nodeValue)) return nodeValue.map(visibleText).join(' ')
  if (!isValidElement(nodeValue)) return ''
  return visibleText((nodeValue.props as Record<string, unknown>)['children'] as ReactNode)
}

/**
 * 假 Host：**照 Host 的读侧语义**实现——写进去的是节点 id 清单，读出来的是"还活着且未停用"的条目。
 *
 * 这就是"停用 / 删除即剔除"那条口径的真源位置：`nodeIds` 里那条 id 还在（记录不假编），
 * 而 `items` 里没有它（模型与界面都看不到）。
 */
function fakeHost(options: { failRead?: boolean, failWrite?: boolean, catalog?: Map<string, EnterpriseLibrarySelectionItem> } = {}) {
  const stored = new Map<string, readonly string[]>()
  let catalog = options.catalog ?? new Map<string, EnterpriseLibrarySelectionItem>([
    [ITEM_A.nodeId, ITEM_A],
    [ITEM_B.nodeId, ITEM_B],
  ])
  const reads: string[] = []
  const writes: { sessionId: string, nodeIds: readonly string[] }[] = []
  const api: EnterpriseLibrarySelectionApi = {
    libraryTaskSelection: async (sessionId) => {
      reads.push(sessionId)
      // 真码走 `EnterpriseLocalApiError`（界面那一层就是靠 `instanceof` 取码的）。
      if (options.failRead === true) throw new EnterpriseLocalApiError('ENT_LIBRARY_UNAVAILABLE', 503)
      const items = (stored.get(sessionId) ?? []).map(id => catalog.get(id)).filter((item): item is EnterpriseLibrarySelectionItem => item !== undefined)
      // **与真 Host 逐字同形**：`task-selection` 的 nodeIds 就是 items 的投影（`route.ts` 里是 `items.map(...)`），
      // 所以停用/已删的节点在两处都不出现——记录里那条 id 只是躺着，界面看不见、也写不回去。
      return { nodeIds: items.map(item => item.nodeId), items }
    },
    librarySetTaskSelection: async (sessionId, nodeIds) => {
      writes.push({ sessionId, nodeIds: [...nodeIds] })
      if (options.failWrite === true) throw new Error('write failed')
      const kept = [...nodeIds]
      stored.set(sessionId, kept)
      return { nodeIds: kept }
    },
  }
  return {
    api,
    reads,
    writes,
    /** 模拟"资料被删/停用"：目录里不再有它，但记录里的 id 不动（读投影因此不再产出它）。 */
    dropFromCatalog: (nodeId: string) => { catalog = new Map([...catalog].filter(([id]) => id !== nodeId)) },
    /** 模拟"重新启用"：那一份回来了（记录里一直有它，故无需重选）。 */
    restoreToCatalog: (item: EnterpriseLibrarySelectionItem) => { catalog = new Map([...catalog, [item.nodeId, item]]) },
  }
}

function storeOf(host: ReturnType<typeof fakeHost>) {
  const warns: string[] = []
  const store = createEnterpriseLibrarySelectionStore({ api: host.api, warn: message => { warns.push(message) } })
  return { store, warns }
}

describe('会话选中集合：两条 endpoint 的严格解码', () => {
  it('task-selection 逐字段解码；多一个键、坏 id、错枚举都整条判畸形', () => {
    const decoded: EnterpriseLibrarySelection = decodeEnterpriseLibraryTaskSelection({ nodeIds: ['nd_a'], items: [ITEM_A] })
    expect(decoded).toEqual({ nodeIds: ['nd_a'], items: [ITEM_A] })
    expect(ENTERPRISE_LIBRARY_TASK_SELECTION_KEYS).toEqual(['nodeIds', 'items'])
    // 键集封闭：Host 多塞一个键（主体 / 路径 / 时间戳）就进不了界面。
    expect(() => decodeEnterpriseLibraryTaskSelection({ nodeIds: [], items: [], total: 0 })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibraryTaskSelection({ nodeIds: ['../../etc'], items: [] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibraryTaskSelection({ nodeIds: [], items: [{ ...ITEM_A, extra: 1 }] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibraryTaskSelection({ nodeIds: [], items: [{ ...ITEM_A, kind: 'exe' }] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })

  it('set-task-selection 的回执恰好只有 nodeIds：带 items 的响应判畸形（写回执不是读投影）', () => {
    expect(decodeEnterpriseLibrarySetTaskSelection({ nodeIds: ['nd_a', 'nd_b'] })).toEqual({ nodeIds: ['nd_a', 'nd_b'] })
    expect(ENTERPRISE_LIBRARY_SET_TASK_SELECTION_KEYS).toEqual(['nodeIds'])
    expect(() => decodeEnterpriseLibrarySetTaskSelection({ nodeIds: [], items: [] })).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    expect(() => decodeEnterpriseLibrarySetTaskSelection({})).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })
})

describe('会话选中集合：同源两条的路径与请求体', () => {
  it('两条都打 POST /library 的封闭键集；读按读 DTO、写按写 DTO 各自解码', async () => {
    const calls: { url: string, body: unknown, method: string }[] = []
    const fetcher = (async (input: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { endpoint: string }
      calls.push({ url: input, body, method: String(init.method) })
      const data = body.endpoint === 'task-selection'
        ? { nodeIds: ['nd_a'], items: [ITEM_A] }
        : { nodeIds: ['nd_a', 'nd_b'] }
      return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' }, status: 200 })
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal

    await expect(api.libraryTaskSelection('session-1', signal)).resolves.toEqual({ nodeIds: ['nd_a'], items: [ITEM_A] })
    await expect(api.librarySetTaskSelection('session-1', ['nd_a', 'nd_b'], signal)).resolves.toEqual({ nodeIds: ['nd_a', 'nd_b'] })

    expect(calls).toEqual([
      { url: '/enterprise/api/v1/local/library', method: 'POST', body: { endpoint: 'task-selection', payload: { sessionId: 'session-1' } } },
      { url: '/enterprise/api/v1/local/library', method: 'POST', body: { endpoint: 'set-task-selection', payload: { sessionId: 'session-1', nodeIds: ['nd_a', 'nd_b'] } } },
    ])
  })

  it('写回执里多一个 items 即判畸形（界面绝不拿写回执去拼条目）', async () => {
    const extra = (async () => new Response(JSON.stringify({ data: { nodeIds: [], items: [] } }), { status: 200 })) as unknown as typeof fetch
    await expect(createEnterpriseLocalApi(extra).librarySetTaskSelection('s', [], new AbortController().signal))
      .rejects.toMatchObject({ code: 'ENT_LOCAL_RESPONSE_INVALID' })
  })
})

describe('选中集合 store：产生与生命周期', () => {
  it('新会话为空：没读过是稳定空快照；ensure 之后是 ready + 空集合（Host 里根本没有这条记录）', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    // 引用稳定：`useSyncExternalStore` 靠 Object.is 判等，每次新建对象会无限重渲染。
    expect(store.getSnapshot('session-new')).toBe(ENTERPRISE_LIBRARY_SELECTION_EMPTY)
    expect(store.getSnapshot('session-new')).toBe(store.getSnapshot('session-new'))

    store.ensure('session-new')
    await vi.waitFor(() => { expect(store.getSnapshot('session-new').status).toBe('ready') })
    expect(store.getSnapshot('session-new')).toMatchObject({ status: 'ready', items: [], nodeIds: [], code: undefined })
    expect(host.reads).toEqual(['session-new'])
    // ensure 幂等：已经读过不再重复发。
    store.ensure('session-new')
    await Promise.resolve()
    expect(host.reads).toEqual(['session-new'])
  })

  it('选中一份 ⇒ 集合里出现 Host 给的那枚**固定修订**，而不是一个新算的"最新"', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    await store.toggle('session-1', 'nd_a')
    expect(host.writes).toEqual([{ sessionId: 'session-1', nodeIds: ['nd_a'] }])
    const snapshot = store.getSnapshot('session-1')
    expect(snapshot.status).toBe('ready')
    expect(snapshot.items).toEqual([ITEM_A])
    // 固定修订：注入段 `<library-document revision_id=…>` 用的就是这一位，界面既不猜也不算。
    expect(snapshot.items[0]!.revisionId).toBe(ITEM_A.revisionId)
    expect(snapshot.nodeIds).toEqual(['nd_a'])
  })

  it('再点同一份即取消；remove 移除指定一份；clear 写空集合（三条都走同一条覆盖写）', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    await store.toggle('s', 'nd_a')
    await store.toggle('s', 'nd_b')
    await store.toggle('s', 'nd_a')
    expect(host.writes.map(write => write.nodeIds)).toEqual([['nd_a'], ['nd_a', 'nd_b'], ['nd_b']])
    await store.remove('s', 'nd_b')
    await store.clear('s')
    expect(host.writes.map(write => write.nodeIds)).toEqual([['nd_a'], ['nd_a', 'nd_b'], ['nd_b'], [], []])
    expect(store.getSnapshot('s')).toMatchObject({ status: 'ready', items: [], nodeIds: [] })
  })

  it('停用 / 删除即从集合剔除：记录里的 id 还在，但条目与模型都看不到它（Host 读侧剔除）', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    await store.toggle('s', 'nd_a')
    await store.toggle('s', 'nd_b')
    expect(store.getSnapshot('s').items.map(item => item.nodeId)).toEqual(['nd_a', 'nd_b'])
    // 资料被删 / 停用：目录里不再有 nd_b（Host 的 `selectedItems` 就是这么滤的）。
    host.dropFromCatalog('nd_b')
    await store.refresh('s')
    const snapshot = store.getSnapshot('s')
    expect(snapshot.items.map(item => item.nodeId)).toEqual(['nd_a'])
    // 同一份物化的两个投影同源：`nodeIds` 也只含还活着的那些（Host 就是 `items.map(...)`），
    // 因此界面接下来写回的集合天然不含悬空 id——不需要（也不该）由界面去"猜"清理。
    expect(snapshot.nodeIds).toEqual(['nd_a'])
    // 剔除是**读投影**，不是销毁记录：把它放回来，那一份自己就回来了（本仓真 Host 的语义）。
    host.restoreToCatalog(ITEM_B)
    await store.refresh('s')
    expect(store.getSnapshot('s').items.map(item => item.nodeId)).toEqual(['nd_a', 'nd_b'])
  })

  it('★ 读不到时绝不用未知状态去写：一次"加入"的点击不会把用户原先选的一堆覆盖成一份', async () => {
    const host = fakeHost({ failRead: true })
    const { store, warns } = storeOf(host)
    await store.toggle('s', 'nd_a')
    expect(host.reads).toEqual(['s'])
    expect(host.writes).toEqual([])
    expect(store.getSnapshot('s')).toMatchObject({ status: 'failed', code: 'ENT_LIBRARY_UNAVAILABLE' })
    expect(warns).toContain('owndsh: library selection could not be read before writing')
  })

  it('读失败与写失败都留稳定码，且失败时**不保留**旧条目（不拿过期清单冒充现状）', async () => {
    const ok = fakeHost()
    const { store } = storeOf(ok)
    await store.toggle('s', 'nd_a')
    expect(store.getSnapshot('s').items).toHaveLength(1)
    const failing = fakeHost({ failRead: true })
    const second = storeOf(failing)
    await second.store.toggle('s', 'nd_a')
    expect(second.store.getSnapshot('s')).toMatchObject({ status: 'failed', items: [], code: 'ENT_LIBRARY_UNAVAILABLE' })

    const badWrite = fakeHost({ failWrite: true })
    const third = storeOf(badWrite)
    await third.store.toggle('s', 'nd_a')
    expect(badWrite.writes).toHaveLength(1)
    expect(third.store.getSnapshot('s')).toMatchObject({ status: 'failed', items: [], code: 'ENT_LOCAL_UNAVAILABLE' })
  })

  it('订阅按会话分键：变化通知、退订后不再通知、dispose 后不再发请求', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    const seen: string[] = []
    const off = store.subscribe('s', () => { seen.push(store.getSnapshot('s').status) })
    expect(seen).toEqual([])
    await store.toggle('s', 'nd_a')
    expect(seen).toContain('ready')
    off()
    const before = seen.length
    await store.remove('s', 'nd_a')
    expect(seen).toHaveLength(before)

    const other = storeOf(fakeHost())
    other.store.dispose()
    await other.store.toggle('s', 'nd_a')
    expect(other.store.getSnapshot('s')).toBe(ENTERPRISE_LIBRARY_SELECTION_EMPTY)
  })
})

describe('@ 触发源：候选与拾取', () => {
  it('候选只要文件行、排除停用、按查询过滤、保持目录先序、已选的带提示、有上限', () => {
    const all = enterpriseLibraryTriggerCandidates(ROWS, '', [])
    expect(all.map(candidate => candidate.value)).toEqual(['nd_a', 'nd_b'])
    expect(all[0]).toMatchObject({ name: 'aaa.md', label: 'aaa.md', icon: 'file', value: 'nd_a' })
    expect(all[0]).not.toHaveProperty('hint')
    expect(enterpriseLibraryTriggerCandidates(ROWS, 'bbb', []).map(candidate => candidate.value)).toEqual(['nd_b'])
    expect(enterpriseLibraryTriggerCandidates(ROWS, 'BBB', []).map(candidate => candidate.value)).toEqual(['nd_b'])
    expect(enterpriseLibraryTriggerCandidates(ROWS, '没有这种', [])).toEqual([])
    expect(enterpriseLibraryTriggerCandidates(ROWS, '', ['nd_b'])[1]!.hint).toBe(ENTERPRISE_LIBRARY_TRIGGER_SELECTED_HINT)
    // 上限：超出部分由用户继续打字收窄。
    const many: EnterpriseLibraryItem[] = Array.from({ length: ENTERPRISE_LIBRARY_TRIGGER_LIMIT + 5 }, (_value, index) => ({
      id: `nd_${String(index)}`, title: `f${String(index)}.md`, kind: 'asset', assetId: `as_${String(index)}`, status: 'active',
    }))
    expect(enterpriseLibraryTriggerCandidates(many, '', [])).toHaveLength(ENTERPRISE_LIBRARY_TRIGGER_LIMIT)
  })

  it('源的形状逐字（trigger/name/order/showGroupTitle），拾取 ⇒ 写集合 + 把 `@查询` 换成空串', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    const source = createEnterpriseLibraryTriggerSource({
      store,
      loadCatalog: async () => ROWS,
      warn: () => undefined,
    })
    expect(source).toMatchObject({ trigger: '@', name: 'dshent-library', order: 30, showGroupTitle: false })

    const candidates = await source.candidates({ sessionId: 'session-9' }, { query: '', signal: new AbortController().signal })
    expect(candidates.map(candidate => candidate.value)).toEqual(['nd_a', 'nd_b'])

    const outcome = source.onPick({ candidate: candidates[1]!, session: { sessionId: 'session-9' } })
    expect(outcome).toEqual({ text: '' })
    await vi.waitFor(() => { expect(host.writes).toHaveLength(1) })
    expect(host.writes[0]).toEqual({ sessionId: 'session-9', nodeIds: ['nd_b'] })
    await vi.waitFor(() => { expect(store.getSnapshot('session-9').items).toEqual([ITEM_B]) })
    expect(store.getSnapshot('session-9').items[0]!.revisionId).toBe(ITEM_B.revisionId)
  })

  it('没有 value 或没有会话 id 的拾取一律不认（不写、不吞）', () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    const source = createEnterpriseLibraryTriggerSource({ store, loadCatalog: async () => ROWS, warn: () => undefined })
    expect(source.onPick({ candidate: { name: 'x' }, session: { sessionId: 's' } })).toBeUndefined()
    expect(source.onPick({ candidate: { name: 'x', value: 'nd_a' }, session: { sessionId: undefined } })).toBeUndefined()
    expect(host.writes).toEqual([])
  })

  it('取目录失败 ⇒ **原样抛** + 留痕（不返回空列表——那正是本仓禁的"把失败写成没有数据"）', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    const warns: string[] = []
    const source = createEnterpriseLibraryTriggerSource({
      store,
      loadCatalog: async () => { throw new Error('boom') },
      warn: message => { warns.push(message) },
    })
    // 官方管线靠这个 rejection 把该组标成 failed（`source-failed`），我们自己再记一条留痕。
    await expect(source.candidates({ sessionId: 's' }, { query: '', signal: new AbortController().signal })).rejects.toThrowError('boom')
    expect(warns).toEqual(['owndsh: library trigger candidates could not be loaded'])
  })

  it('取目录被取消（官方换查询 / 关菜单时会 abort）⇒ 原样抛，但不记成失败留痕', async () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    const warns: string[] = []
    const controller = new AbortController()
    const source = createEnterpriseLibraryTriggerSource({
      store,
      loadCatalog: async () => { controller.abort(); throw new Error('aborted') },
      warn: message => { warns.push(message) },
    })
    await expect(source.candidates({ sessionId: 's' }, { query: '', signal: controller.signal })).rejects.toThrowError('aborted')
    expect(warns).toEqual([])
  })

  it('插入串：行首/空白后插 `@`，紧贴字后面必须补一个空格（否则官方菜单不认这个 `@`）', () => {
    expect(enterpriseLibraryTriggerInsertion('', 0)).toBe('@')
    expect(enterpriseLibraryTriggerInsertion('已有一段文字', 0)).toBe('@')
    expect(enterpriseLibraryTriggerInsertion('前面有空格 ', 6)).toBe('@')
    expect(enterpriseLibraryTriggerInsertion('前面没有空格', 6)).toBe(' @')
  })
})

describe('界面落点：已选条目条与 @ 按钮', () => {
  it('未选中 ⇒ 一个节点都不渲染（既有输入区行为逐字不变）', () => {
    expect(EnterpriseLibrarySelectionView({
      snapshot: ENTERPRISE_LIBRARY_SELECTION_EMPTY,
      onRemove: () => undefined,
      onClear: () => undefined,
      onRetry: () => undefined,
    })).toBeNull()
    expect(EnterpriseLibrarySelectionView({
      snapshot: { status: 'ready', items: [], nodeIds: [], code: undefined },
      onRemove: () => undefined,
      onClear: () => undefined,
      onRetry: () => undefined,
    })).toBeNull()
  })

  it('有条目 ⇒ 每份一枚可见名 + 无障碍名的移除按钮，点它按 nodeId 回调；另有「全部移除」', () => {
    const removed: string[] = []
    let cleared = 0
    const view = EnterpriseLibrarySelectionView({
      snapshot: { status: 'ready', items: [ITEM_A, ITEM_B], nodeIds: ['nd_a', 'nd_b'], code: undefined },
      onRemove: nodeId => { removed.push(nodeId) },
      onClear: () => { cleared += 1 },
      onRetry: () => undefined,
    })
    expect(visibleText(view)).toContain(ENTERPRISE_LIBRARY_SELECTION_TITLE)
    expect(visibleText(view)).toContain('aaa.md')
    expect(visibleText(view)).toContain('bbb.md')
    // 容器声明成有名的一组（读屏听得到这是"本轮已加入的资料"）。
    expect((view as { props: Record<string, unknown> }).props['role']).toBe('group')
    expect((view as { props: Record<string, unknown> }).props['aria-label']).toBe(ENTERPRISE_LIBRARY_SELECTION_TITLE)
    const buttons = collectByType(view, Button)
    const removeA = buttons.find(props => props['aria-label'] === `${ENTERPRISE_LIBRARY_SELECTION_REMOVE_PREFIX}aaa.md`)
    expect(removeA).toBeTruthy()
    expect(removeA!['data-enterprise-library-selection-remove']).toBe('nd_a')
    ;(removeA!['onClick'] as () => void)()
    expect(removed).toEqual(['nd_a'])
    const clear = buttons.find(props => props['data-enterprise-library-selection-clear'] !== undefined)
    ;(clear!['onClick'] as () => void)()
    expect(cleared).toBe(1)
  })

  it('失败态 ⇒ 出人话 + 稳定码 + 能点动的重试，且**不**渲染任何条目', () => {
    let retried = 0
    const view = EnterpriseLibrarySelectionView({
      snapshot: { status: 'failed', items: [], nodeIds: ['nd_a'], code: 'ENT_LIBRARY_UNAVAILABLE' },
      onRemove: () => undefined,
      onClear: () => undefined,
      onRetry: () => { retried += 1 },
    })
    const text = visibleText(view)
    expect(text).toContain(ENTERPRISE_LIBRARY_SELECTION_FAILED)
    expect(text).toContain('ENT_LIBRARY_UNAVAILABLE')
    const buttons = collectByType(view, Button)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!['aria-label']).toBe(ENTERPRISE_LIBRARY_SELECTION_RETRY)
    ;(buttons[0]!['onClick'] as () => void)()
    expect(retried).toBe(1)
  })

  it('@ 按钮的纯呈现：无障碍名 + 真禁用位（拿不到官方输入动作时不给死按钮）', () => {
    let opened = 0
    const live = EnterpriseLibraryTriggerButtonView({ disabled: false, onOpen: () => { opened += 1 } })
    const props = (live as { props: Record<string, unknown> }).props
    expect(props['aria-label']).toBe(ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ARIA)
    expect(props['disabled']).toBe(false)
    expect(props['data-enterprise-library-trigger']).toBe(ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ID)
    expect(visibleText(live)).toBe(ENTERPRISE_LIBRARY_TRIGGER_BUTTON_LABEL)
    ;(props['onClick'] as () => void)()
    expect(opened).toBe(1)
    expect((EnterpriseLibraryTriggerButtonView({ disabled: true, onOpen: () => undefined }) as { props: Record<string, unknown> }).props['disabled']).toBe(true)
  })

  it('@ 按钮的取草稿壳：按插入点前面的字符决定插 `@` 还是 ` @`，走 insertText 而不是整份替换', () => {
    const inserted: { text: string, span: unknown }[] = []
    const actions = { captureInsertion: () => ({ start: 6 }), insertText: (text: string, span: unknown) => { inserted.push({ text, span }); return true } }
    const element = EnterpriseLibraryTriggerButton({ inputActions: actions, useInput: selector => selector({ draft: '前面没有空格' }) })
    const props = (element as { props: Record<string, unknown> }).props
    expect(props['disabled']).toBe(false)
    expect(props['aria-label']).toBe(ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ARIA)
    ;(props['onClick'] as () => void)()
    expect(inserted).toEqual([{ text: ' @', span: { start: 6 } }])

    const head = EnterpriseLibraryTriggerButton({ inputActions: { captureInsertion: () => ({ start: 0 }), insertText: (text, span) => { inserted.push({ text, span }); return true } }, useInput: selector => selector({ draft: '前面没有空格' }) })
    ;((head as { props: Record<string, unknown> }).props['onClick'] as () => void)()
    expect(inserted[1]!.text).toBe('@')

    // 官方输入动作缺席：出真禁用态，点了也不炸（零死按钮、零异常）。
    const cold = EnterpriseLibraryTriggerButton({ useInput: selector => selector({ draft: '' }) })
    const coldProps = (cold as { props: Record<string, unknown> }).props
    expect(coldProps['disabled']).toBe(true)
    expect(() => { (coldProps['onClick'] as () => void)() }).not.toThrow()
  })

  it('两处座位的注册选项：dock 的 inject 把官方给的那个会话 id 原样交进组件；按钮只占 list 的一格', () => {
    const host = fakeHost()
    const { store } = storeOf(host)
    const dock = enterpriseLibrarySelectionDockOptions(store)
    expect(dock).toMatchObject({ name: 'conversation.input.dock', id: 'dshent-library-selection', order: 30 })
    const face = (dock['inject'] as (sessionId: unknown) => { sessionId: string, selection: unknown })('session-42')
    expect(face.sessionId).toBe('session-42')
    expect(face.selection).toBe(store)
    expect((dock['inject'] as (sessionId: unknown) => { sessionId?: string })(undefined).sessionId).toBeUndefined()

    expect(enterpriseLibraryTriggerButtonOptions()).toEqual({
      name: 'conversation.input.left',
      id: ENTERPRISE_LIBRARY_TRIGGER_BUTTON_ID,
      order: 30,
      label: ENTERPRISE_LIBRARY_TRIGGER_BUTTON_LABEL,
    })
  })
})
