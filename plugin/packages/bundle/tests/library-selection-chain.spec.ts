/**
 * [INPUT]: 依赖 `tests/library-route-support.ts`（真 HTTP）、`tests/library-support.ts`（临时 dshHome + 内存假域）、`src/library/{route,manager,tools,context-injection}.js`
 * [OUTPUT]: **「会话选中集合」这条链的端到端证据**（每一步的读数打到 stdout）：`set-task-selection` → `task-selection` → 注入段 `<library-document revision_id=…>` → 工具可见性；并逐条锁住 ① **选中一份时集合里是那一枚固定修订**（重复读同值，注入 XML 的 `revision_id` 与它逐字相同）；② 移除 ⇒ 集合空 + 注入 0 条 + 工具命中 0（反向锁）；③ **停用即剔除**（`items` 与 `nodeIds` 两个投影一起空、注入 0 条；重新启用即回来）；④ **删除即剔除**；⑤ **新会话为空**（没写过记录 ⇒ 空集合、注入 0、工具 0）；⑥ 选中两份 ⇒ 注入两段 XML、顺序 = 选择顺序
 * [POS]: tests 下「把资料加入当前对话」的**宿主侧贯穿验收**（本刀**零 Host 源码改动**，这条用例就是客户端那两处 composer 座位所依赖的契约的真相源）。与 `library-p0-e2e.spec.ts` 的分工：那一条走"上传→检索→读回→注入"的 P0 全链，这一条只走"选中集合"这一条纵深，把生命周期（选中/移除/停用/删除/新会话）逐条咬死
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { registerEnterpriseLibraryInjection } from '../src/library/context-injection.js'
import type { LibraryManager } from '../src/library/manager.js'
import { registerEnterpriseLibraryTools, type EnterpriseLibraryToolDefinition } from '../src/library/tools.js'
import { createLibraryRouteHarness, type LibraryRouteHarness } from './library-route-support.js'
import { createLibraryTestRig, makeLibraryTempDir } from './library-support.js'

const temps: string[] = []
const harnesses: LibraryRouteHarness[] = []

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(async harness => await harness.dispose()))
  await Promise.all(temps.splice(0).map(async path => await rm(path, { force: true, recursive: true })))
})

interface Envelope<T> { readonly data: T }
interface SelectionItemView { readonly nodeId: string, readonly assetId: string, readonly revisionId: string, readonly name: string, readonly kind: string }
interface SelectionView { readonly nodeIds: readonly string[], readonly items: readonly SelectionItemView[] }

/** 一行证据（跑测试时直接进 stdout：这就是"逐步给命令与输出"的那份输出）。 */
function step(index: number, title: string, detail: string): void {
  console.log(`[SEL-${String(index)}] ${title}\n         ${detail}`)
}

/** 一套夹具：真 HTTP 路由 + 真服务 + 真落盘。 */
async function rig(): Promise<{
  manager: LibraryManager
  harness: LibraryRouteHarness
  importDoc: (name: string, content: string) => Promise<{ nodeId: string, assetId: string, revisionId: string }>
  selectionOf: (sessionId: string) => Promise<SelectionView>
  select: (sessionId: string, nodeIds: readonly string[]) => Promise<void>
  inject: (sessionId: string) => Promise<readonly { name: string, text: string }[]>
}> {
  const home = await makeLibraryTempDir('dshent-library-selection-')
  temps.push(home)
  const testRig = await createLibraryTestRig({ home })
  const manager = testRig.manager
  const harness = await createLibraryRouteHarness({ manager: () => manager })
  harnesses.push(harness)
  return {
    manager,
    harness,
    importDoc: async (name, content) => {
      const imported = (await (await harness.post('/library', {
        endpoint: 'import', payload: { name, content },
      })).json() as Envelope<{ asset: { id: string }, revision: { id: string } }>).data
      const node = (await manager.listAllNodes()).find(candidate => candidate.assetId === imported.asset.id)!
      return { nodeId: node.id, assetId: imported.asset.id, revisionId: imported.revision.id }
    },
    selectionOf: async sessionId => (await (await harness.post('/library', {
      endpoint: 'task-selection', payload: { sessionId },
    })).json() as Envelope<SelectionView>).data,
    select: async (sessionId, nodeIds) => {
      await harness.post('/library', { endpoint: 'set-task-selection', payload: { sessionId, nodeIds } })
    },
    inject: async sessionId => {
      const listeners: ((assembly: unknown, context: { agent?: { id: string } }, next: () => Promise<{ contexts: { name: string, text: string }[] }>) => Promise<{ contexts: { name: string, text: string }[] }>)[] = []
      registerEnterpriseLibraryInjection({
        on: (_name, listener) => { listeners.push(listener); return () => undefined },
      }, { manager: () => manager })
      const assembly = { contexts: [] as { name: string, text: string }[] }
      const resolved = await listeners[0]!({}, { agent: { id: sessionId } }, async () => assembly)
      return resolved.contexts
    },
  }
}

/** 注册三个工具，返回按名字取的执行器（与 `library-p0-e2e.spec.ts` 同一手法）。 */
function toolsOf(manager: LibraryManager) {
  const definitions: EnterpriseLibraryToolDefinition[] = []
  registerEnterpriseLibraryTools({ register: definition => { definitions.push(definition); return () => undefined } }, { manager: () => manager })
  const byName = (name: string) => definitions.find(definition => definition.name === name)!
  return { names: definitions.map(definition => definition.name), search: byName('library_search'), read: byName('library_read') }
}

describe('会话选中集合：选中 → 注入 → 工具，以及生命周期', () => {
  it('① 选中一份 ⇒ 集合里是那一枚**固定修订**，注入 XML 的 revision_id 与它逐字相同', async () => {
    const rigged = await rig()
    const doc = await rigged.importDoc('发布规范.md', '# 发布规范\n\n发布前必须跑一遍门禁。\n')
    await rigged.select('session-a', [doc.nodeId])

    const first = await rigged.selectionOf('session-a')
    const second = await rigged.selectionOf('session-a')
    step(1, '选中一份 → task-selection', `nodeIds=${JSON.stringify(first.nodeIds)} · items=${JSON.stringify(first.items)}`)
    expect(first.nodeIds).toEqual([doc.nodeId])
    expect(first.items).toHaveLength(1)
    // **固定修订**：读出的是导入那一刻建的那一版，而且两次读同值（不是每次现算的"最新"）。
    expect(first.items[0]!.revisionId).toBe(doc.revisionId)
    expect(first.items[0]!.assetId).toBe(doc.assetId)
    expect(second.items[0]!.revisionId).toBe(first.items[0]!.revisionId)
    // 资产身上的 currentRevisionId 与选中集合里那一枚也是同一个（注入用的就是它）。
    const asset = (await rigged.manager.listAssets()).find(candidate => candidate.id === doc.assetId)!
    expect(asset.currentRevisionId).toBe(doc.revisionId)

    const contexts = await rigged.inject('session-a')
    const text = contexts[0]!.text
    step(1, '注入段', `name=${contexts[0]!.name} · 含 revision_id="${doc.revisionId}"=${String(text.includes(`revision_id="${doc.revisionId}"`))} · 含 asset_id="${doc.assetId}"=${String(text.includes(`asset_id="${doc.assetId}"`))} · 长度=${String(text.length)}`)
    expect(contexts).toHaveLength(1)
    expect(text).toContain(`<library-document name="发布规范.md" kind="markdown" asset_id="${doc.assetId}" revision_id="${doc.revisionId}">`)
    expect(text).toContain('发布前必须跑一遍门禁')
    // 反向锁：正文其余任意一份都没被带上（只注入已选的那一份）。
    const other = await rigged.importDoc('另一份.md', '# 另一份\n\n这一份不该被注入。\n')
    await rigged.select('session-a', [doc.nodeId, other.nodeId])
    const two = await rigged.inject('session-a')
    expect(two[0]!.text).toContain('这一份不该被注入')
    await rigged.select('session-a', [doc.nodeId])
    const one = await rigged.inject('session-a')
    expect(one[0]!.text).not.toContain('这一份不该被注入')
  })

  it('② 移除 ⇒ 集合空、注入 0 条、工具命中 0（反向锁继续绿）', async () => {
    const rigged = await rig()
    const doc = await rigged.importDoc('发布规范.md', '# 发布规范\n\n发布前必须跑一遍门禁。\n')
    const tools = toolsOf(rigged.manager)
    await rigged.select('session-b', [doc.nodeId])
    expect((await tools.search.execute({ query: '门禁' }, { agent: { id: 'session-b' } }) as { hits: unknown[] }).hits).toHaveLength(1)

    await rigged.select('session-b', [])
    const cleared = await rigged.selectionOf('session-b')
    const contexts = await rigged.inject('session-b')
    const hits = await tools.search.execute({ query: '门禁' }, { agent: { id: 'session-b' } }) as { hits: unknown[] }
    step(2, '移除后', `nodeIds=${JSON.stringify(cleared.nodeIds)} · items=${String(cleared.items.length)} · 注入条目=${String(contexts.length)} · 工具命中=${String(hits.hits.length)}`)
    expect(cleared).toEqual({ nodeIds: [], items: [] })
    expect(contexts).toEqual([])
    expect(hits.hits).toEqual([])
    // 未选中时 `library_read` 如实拒（`library/not-selected`），不是返回空正文。
    await expect(tools.read.execute({ asset_id: doc.assetId }, { agent: { id: 'session-b' } }))
      .rejects.toMatchObject({ code: 'library/not-selected' })
  })

  it('③ 停用即剔除：两个投影一起空 ⇒ 注入 0 条；重新启用即回来（记录仍持有那条 id）', async () => {
    const rigged = await rig()
    const doc = await rigged.importDoc('发布规范.md', '# 发布规范\n\n发布前必须跑一遍门禁。\n')
    await rigged.select('session-c', [doc.nodeId])
    await rigged.harness.post('/library', { endpoint: 'set-asset-status', payload: { assetId: doc.assetId, status: 'disabled' } })

    const disabled = await rigged.selectionOf('session-c')
    const contexts = await rigged.inject('session-c')
    step(3, '停用后', `nodeIds=${JSON.stringify(disabled.nodeIds)} · items=${String(disabled.items.length)} · 注入条目=${String(contexts.length)}`)
    // Host 的 `task-selection` 里 `nodeIds` 就是 `items.map(...)`（`route.ts` 逐字如此），故两个投影**一起**空：
    // 停用那一份在界面上与模型那边同时消失；Host 的选中**记录**里那条 id 只是躺着不再产出。
    expect(disabled.nodeIds).toEqual([])
    expect(disabled.items).toEqual([])
    expect(contexts).toEqual([])

    // 剔除是**读投影**，不是销毁记录：重新启用，那一份自己就回来了（不需要再选一次）。
    await rigged.harness.post('/library', { endpoint: 'set-asset-status', payload: { assetId: doc.assetId, status: 'active' } })
    const back = await rigged.selectionOf('session-c')
    step(3, '重新启用后', `nodeIds=${JSON.stringify(back.nodeIds)} · 修订=${JSON.stringify(back.items.map(item => item.revisionId))}`)
    expect(back.items.map(item => item.revisionId)).toEqual([doc.revisionId])
  })

  it('④ 删除即剔除：items 空、注入 0 条（记录里那条悬空 id 不再产出任何东西）', async () => {
    const rigged = await rig()
    const doc = await rigged.importDoc('发布规范.md', '# 发布规范\n\n发布前必须跑一遍门禁。\n')
    await rigged.select('session-d', [doc.nodeId])
    await rigged.harness.post('/library', { endpoint: 'remove', payload: { assetId: doc.assetId } })

    const removed = await rigged.selectionOf('session-d')
    const contexts = await rigged.inject('session-d')
    step(4, '删除后', `nodeIds=${JSON.stringify(removed.nodeIds)} · items=${String(removed.items.length)} · 注入条目=${String(contexts.length)}`)
    expect(removed.items).toEqual([])
    expect(contexts).toEqual([])
  })

  it('⑤ 新会话为空：没写过记录 ⇒ 空集合、注入 0 条、工具命中 0（不是"整库"）', async () => {
    const rigged = await rig()
    const doc = await rigged.importDoc('发布规范.md', '# 发布规范\n\n发布前必须跑一遍门禁。\n')
    await rigged.select('session-e', [doc.nodeId])
    const tools = toolsOf(rigged.manager)

    const fresh = await rigged.selectionOf('session-brand-new')
    const contexts = await rigged.inject('session-brand-new')
    const hits = await tools.search.execute({ query: '门禁' }, { agent: { id: 'session-brand-new' } }) as { hits: unknown[] }
    step(5, '新会话', `nodeIds=${JSON.stringify(fresh.nodeIds)} · items=${String(fresh.items.length)} · 注入条目=${String(contexts.length)} · 工具命中=${String(hits.hits.length)}`)
    expect(fresh).toEqual({ nodeIds: [], items: [] })
    expect(contexts).toEqual([])
    expect(hits.hits).toEqual([])
    // 对照：原来那个会话照旧有（新会话为空不是因为库空了）。
    expect((await rigged.selectionOf('session-e')).items).toHaveLength(1)
    expect((await tools.search.execute({ query: '门禁' }, { agent: { id: 'session-e' } }) as { hits: unknown[] }).hits).toHaveLength(1)
  })

  it('⑥ 选中两份 ⇒ 注入两段 XML，顺序 = 选择顺序；本链依赖的三个工具都在', async () => {
    const rigged = await rig()
    const first = await rigged.importDoc('甲.md', '# 甲\n\n甲的正文。\n')
    const second = await rigged.importDoc('乙.md', '# 乙\n\n乙的正文。\n')
    const tools = toolsOf(rigged.manager)
    await rigged.select('session-f', [second.nodeId, first.nodeId])

    const contexts = await rigged.inject('session-f')
    const text = contexts[0]!.text
    step(6, '两份', `工具=${tools.names.join(', ')} · 甲位置=${String(text.indexOf('甲.md'))} · 乙位置=${String(text.indexOf('乙.md'))}`)
    // 只锁这条链真正执行到的三件（工具面本身归 `library-tools.spec.ts`，本文件不重复锁清单）。
    expect(tools.names).toEqual(expect.arrayContaining(['library_search', 'library_read', 'library_save_markdown']))
    // 顺序 = 写进集合的顺序（乙在前）⇒ 乙的 `<library-document` 出现在甲之前。
    expect(text.indexOf('name="乙.md"')).toBeGreaterThan(-1)
    expect(text.indexOf('name="乙.md"')).toBeLessThan(text.indexOf('name="甲.md"'))
    expect(text.match(/<library-document /gu)).toHaveLength(2)
    // 两份都在同一轮的上限内（单文档 40000 / 整轮 80000）。
    expect(text.length).toBeLessThanOrEqual(80_000 + 512)
  })
})
