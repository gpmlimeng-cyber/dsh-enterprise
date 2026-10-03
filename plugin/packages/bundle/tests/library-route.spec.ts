/**
 * [INPUT]: 依赖 `tests/library-route-support.ts`（真 HTTP + 引擎语义分发）、`tests/library-support.ts`（临时 dshHome + 内存假域 + 夹具）、`src/library/route.ts`（被测面与常量）、node:fs/promises（直接读盘）
 * [OUTPUT]: 资料库本机 HTTP 面的端到端门禁——**空库态 → 建文件夹 → 导入 md（真落盘：`original.md`/`content.md`/`conversion.json`）→ search 命中 → read-text 逐字读回 → 流式原件 GET 字节一致 → 停用即隔离 → 选中集合双形态 → 改名/移动/级联删除**，外加注册形状（恰好两条、prefix 不带尾斜杠）、非法输入（未知 endpoint / 扩展名不认 / 夹 NUL / 超长正文 / 路径穿越形状）与主体边界
 * [POS]: bundle 资料库纵深的**跨面集成门禁**——单测服务层全绿仍可能因为路由形状、JSON 投影或补偿路径出错；这里用真 HTTP + 真磁盘把整条链钉死（不需要重启 DSH，也不需要打包）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import type { LibraryManager } from '../src/library/manager.js'
import {
  ENTERPRISE_LIBRARY_ENDPOINTS,
  ENTERPRISE_LIBRARY_OBJECTS_PREFIX,
  projectLibraryFailure,
} from '../src/library/route.js'
import {
  createInMemoryLibraryDomain,
  createLibraryTestRig,
  makeLibraryTempDir,
  type InMemoryLibraryDomain,
} from './library-support.js'
import { createLibraryRouteHarness, type LibraryRouteHarness } from './library-route-support.js'

const temps: string[] = []
const harnesses: LibraryRouteHarness[] = []

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(async harness => await harness.dispose()))
  await Promise.all(temps.splice(0).map(async path => await rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-route-')
  temps.push(path)
  return path
}

async function harnessFor(manager: LibraryManager): Promise<LibraryRouteHarness> {
  const harness = await createLibraryRouteHarness({ manager: () => manager })
  harnesses.push(harness)
  return harness
}

/** 确定性 id（与产品前缀同形，便于直接拼磁盘路径做断言）。 */
function sequenceIds(): (kind: string) => string {
  const prefixes: Record<string, string> = { node: 'nd', asset: 'as', revision: 'rv' }
  const counters = new Map<string, number>()
  return (kind: string) => {
    const next = (counters.get(kind) ?? 0) + 1
    counters.set(kind, next)
    return `${prefixes[kind] ?? kind}_${next}`
  }
}

interface Envelope<T> { readonly data: T }
interface NodeView { readonly id: string, readonly title: string, readonly parentId: string | null, readonly kind: string, readonly assetId: string | null }
interface AssetView { readonly id: string, readonly name: string, readonly kind: string, readonly status: string, readonly currentRevisionId: string | null }
interface HitView { readonly assetId: string, readonly revisionId: string, readonly name: string, readonly excerpt: string, readonly folderPath: string }
interface SpaceView { readonly rootTitle: string, readonly nodes: NodeView[], readonly assets: AssetView[] }

describe('资料库本机 HTTP 面（真 HTTP + 真落盘）', () => {
  it('导入 → 落盘 → 检索 → 读回 → 原件字节 → 状态/选中 → 改名/移动/级联删除', async () => {
    const home = await makeHome()
    const rig = await createLibraryTestRig({ home, manager: { newId: sequenceIds() } })
    const harness = await harnessFor(rig.manager)
    const RAW = '# 周报\r\n\r\n本周完成 A 与 B\r\n'

    // 0) 注册形状：恰好两条路由；prefix **不带尾斜杠**（带尾斜杠会让子路径在引擎层空体 404）。
    expect(harness.routes.map(route => `${route.kind}:${route.path}`).sort()).toEqual([
      `exact:/enterprise/api/v1/local/library`,
      `prefix:${ENTERPRISE_LIBRARY_OBJECTS_PREFIX}`,
    ])
    expect(ENTERPRISE_LIBRARY_OBJECTS_PREFIX.endsWith('/')).toBe(false)

    // 1) 空库态：三件都是空的，rootTitle 是中文的「我的资料」。
    const empty = await (await harness.post('/library', { endpoint: 'space', payload: {} })).json() as Envelope<SpaceView>
    expect(empty.data).toEqual({ rootTitle: '我的资料', nodes: [], assets: [] })

    // 2) 建文件夹。
    const folder = (await (await harness.post('/library', {
      endpoint: 'create-folder', payload: { title: '项目甲' },
    })).json() as Envelope<{ node: NodeView }>).data.node
    expect(folder).toMatchObject({ title: '项目甲', kind: 'folder', parentId: null })

    // 3) 导入一份 md：原件字节是原文（保留 \r\n），派生正文归一化。
    const imported = (await (await harness.post('/library', {
      endpoint: 'import', payload: { name: '周报.md', content: RAW },
    })).json() as Envelope<{ asset: AssetView, revision: { id: string, conversionStatus: string, number: number } }>).data
    expect(imported.asset).toMatchObject({ name: '周报.md', kind: 'markdown', status: 'active' })
    expect(imported.revision).toMatchObject({ number: 1, conversionStatus: 'ready' })
    const objectDir = join(home, 'library', 'objects', imported.asset.id, imported.revision.id)
    expect(await readFile(join(objectDir, 'original.md'), 'utf8')).toBe(RAW)
    expect(await readFile(join(objectDir, 'content.md'), 'utf8')).toBe('# 周报\n\n本周完成 A 与 B\n')
    const conversion = JSON.parse(await readFile(join(objectDir, 'conversion.json'), 'utf8')) as Record<string, unknown>
    expect(Object.keys(conversion)).toEqual(['version', 'kind', 'originalSha256', 'warnings', 'locations'])
    expect(conversion['version']).toBe(1)
    expect(conversion['kind']).toBe('markdown')
    expect(String(conversion['originalSha256'])).toMatch(/^[0-9a-f]{64}$/)
    expect(conversion['warnings']).toEqual([])
    expect(conversion['locations']).toEqual([])

    // 4) 检索：只出现在正文里的词命中，摘录里带它，路径是中文根。
    const hits = (await (await harness.post('/library', {
      endpoint: 'search', payload: { query: '完成' },
    })).json() as Envelope<{ hits: HitView[] }>).data.hits
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ name: '周报.md', assetId: imported.asset.id, revisionId: imported.revision.id, folderPath: '我的资料' })
    expect(hits[0]!.excerpt).toContain('完成 A')

    // 5) 正文读回：与派生正文逐字一致。
    const read = (await (await harness.post('/library', {
      endpoint: 'read-text', payload: { assetId: imported.asset.id },
    })).json() as Envelope<{ content: string, byteLength: number, name: string }>).data
    expect(read.content).toBe('# 周报\n\n本周完成 A 与 B\n')
    expect(read.byteLength).toBe(Buffer.byteLength(read.content, 'utf8'))
    expect(read.name).toBe('周报.md')

    // 6) 流式原件：字节与导入时逐字一致（含 \r\n），content-type 取资产媒体类型。
    const original = await harness.get(`/library/objects/${imported.asset.id}/${imported.revision.id}`)
    expect(original.status).toBe(200)
    expect(original.headers.get('content-type')).toBe('text/markdown')
    expect(original.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await original.arrayBuffer()).toString('utf8')).toBe(RAW)

    // 7) 建文件夹后 `list` 只看直接子节点；`space` 是整库。
    const rootList = (await (await harness.post('/library', {
      endpoint: 'list', payload: {},
    })).json() as Envelope<{ nodes: NodeView[], assets: AssetView[] }>).data
    expect(rootList.nodes.map(node => node.title).sort()).toEqual(['周报.md', '项目甲'].sort())
    expect(rootList.assets.map(asset => asset.id)).toEqual([imported.asset.id])

    // 8) 停用即隔离（F13）：read-text 409 + 稳定码，检索跳过它；原件仍可读（员工自己的文件）。
    const disabled = (await (await harness.post('/library', {
      endpoint: 'set-asset-status', payload: { assetId: imported.asset.id, status: 'disabled' },
    })).json() as Envelope<{ asset: AssetView }>).data.asset
    expect(disabled.status).toBe('disabled')
    const blocked = await harness.post('/library', { endpoint: 'read-text', payload: { assetId: imported.asset.id } })
    expect(blocked.status).toBe(409)
    expect(await blocked.json()).toEqual({ error: { code: 'ENT_LIBRARY_DISABLED' } })
    expect((await (await harness.post('/library', {
      endpoint: 'search', payload: { query: '' },
    })).json() as Envelope<{ hits: HitView[] }>).data.hits).toEqual([])
    expect((await harness.get(`/library/objects/${imported.asset.id}/${imported.revision.id}`)).status).toBe(200)

    // 9) 恢复可用；选中集合双形态（写进去的是节点，读出来带资产与精确修订）。
    await harness.post('/library', { endpoint: 'set-asset-status', payload: { assetId: imported.asset.id, status: 'active' } })
    const assetNode = rootList.nodes.find(node => node.assetId === imported.asset.id) as NodeView
    const selection = (await (await harness.post('/library', {
      endpoint: 'set-task-selection', payload: { sessionId: 'session-1', nodeIds: [assetNode.id] },
    })).json() as Envelope<{ nodeIds: string[] }>).data
    expect(selection.nodeIds).toEqual([assetNode.id])
    const readBack = (await (await harness.post('/library', {
      endpoint: 'task-selection', payload: { sessionId: 'session-1' },
    })).json() as Envelope<{ items: { assetId: string, revisionId: string, name: string }[] }>).data
    expect(readBack.items).toEqual([
      { nodeId: assetNode.id, assetId: imported.asset.id, revisionId: imported.revision.id, name: '周报.md', kind: 'markdown' },
    ])

    // 10) 改名 + 移动进文件夹（`list` 按父节点过滤）。
    const renamed = (await (await harness.post('/library', {
      endpoint: 'rename', payload: { nodeId: assetNode.id, title: '周报-改名.md' },
    })).json() as Envelope<{ node: NodeView }>).data.node
    expect(renamed.title).toBe('周报-改名.md')
    await harness.post('/library', { endpoint: 'move', payload: { nodeId: assetNode.id, parentId: folder.id } })
    const nested = (await (await harness.post('/library', {
      endpoint: 'list', payload: { parentId: folder.id },
    })).json() as Envelope<{ nodes: NodeView[], assets: AssetView[] }>).data
    expect(nested.nodes.map(node => node.title)).toEqual(['周报-改名.md'])
    expect(nested.assets.map(asset => asset.name)).toEqual(['周报-改名.md'])

    // 11) 级联删除文件夹：节点/资产/修订一起没，对象目录也不再被引用。
    const removed = (await (await harness.post('/library', {
      endpoint: 'remove', payload: { nodeId: folder.id },
    })).json() as Envelope<{ removed: { nodes: number, assets: number, revisions: number } }>).data.removed
    expect(removed).toEqual({ nodes: 2, assets: 1, revisions: 1 })
    const after = await (await harness.post('/library', { endpoint: 'space', payload: {} })).json() as Envelope<SpaceView>
    expect(after.data).toEqual({ rootTitle: '我的资料', nodes: [], assets: [] })
  })

  it('非法输入一律被拒且不抛未处理异常（未知 endpoint / 扩展名 / NUL / 超长 / 坏形状）', async () => {
    const home = await makeHome()
    const rig = await createLibraryTestRig({ home, manager: { newId: sequenceIds() } })
    const harness = await harnessFor(rig.manager)

    const unknown = await harness.post('/library', { endpoint: 'publish-draft', payload: {} })
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })

    // 不认识的扩展名（P0 只做 md/txt）。
    expect((await harness.post('/library', { endpoint: 'import', payload: { name: 'a.pdf', content: 'x' } })).status).toBe(400)
    // 名字超长（>256）。
    expect((await harness.post('/library', {
      endpoint: 'import', payload: { name: `${'a'.repeat(300)}.md`, content: 'x' },
    })).status).toBe(400)
    // 夹 NUL：不是文本。
    expect((await harness.post('/library', {
      endpoint: 'import', payload: { name: 'a.md', content: 'x\u0000y' },
    })).status).toBe(400)
    // 超长正文（> 8 MiB）⇒ 413，且那次导入不留空壳资产（补偿真的跑了）。
    const huge = await harness.post('/library', {
      endpoint: 'import', payload: { name: 'huge.md', content: 'a'.repeat(8 * 1024 * 1024 + 1) },
    })
    expect(huge.status).toBe(413)
    expect(await huge.json()).toEqual({ error: { code: 'ENT_LIBRARY_TOO_LARGE' } })
    const left = (await (await harness.post('/library', { endpoint: 'space', payload: {} })).json() as Envelope<SpaceView>).data
    expect(left.nodes).toEqual([])
    expect(left.assets).toEqual([])

    // 路径穿越形状：id 段里带 `..`/斜杠一律 400（本层只认 `[A-Za-z0-9_-]`），绝不进 `path.join`。
    expect((await harness.post('/library', {
      endpoint: 'read-text', payload: { assetId: '../../etc/passwd' },
    })).status).toBe(400)
    expect((await harness.post('/library', {
      endpoint: 'remove', payload: { assetId: '..%2fsecret' },
    })).status).toBe(400)
    // 路径穿越形状：`%2e%2e%2f` 这一段（fetch 不会把它规范化成 `.`/`..`）必须被 id 形状门禁拒掉，
    // 绝不进 `path.join`；同前缀下只给一段也拒（形状不成立）。
    const traversal = await harness.get('/library/objects/%2e%2e%2fsecret/rv_1')
    expect(traversal.status).toBe(400)
    expect((await harness.get('/library/objects/only-one-segment')).status).toBe(400)

    // 方法不对：单入口只认 POST，原件只认 GET。
    const wrongEntryMethod = await harness.get('/library')
    expect(wrongEntryMethod.status).toBe(405)
    expect(wrongEntryMethod.headers.get('allow')).toBe('POST')
    const wrongObjectMethod = await fetch(`${harness.baseUrl}/library/objects/as_1/rv_1`, {
      body: '{}', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(wrongObjectMethod.status).toBe(405)
    expect(wrongObjectMethod.headers.get('allow')).toBe('GET')

    // 坏正文（不是 JSON / 不是对象）也是 400，不是 500。
    const badBody = await fetch(`${harness.baseUrl}/library`, {
      body: 'not json', headers: { 'content-type': 'application/json' }, method: 'POST',
    })
    expect(badBody.status).toBe(400)
  })

  it('未接线时如实回 503（不是 404、不是空列表）', async () => {
    const harness = await createLibraryRouteHarness({ manager: () => undefined })
    harnesses.push(harness)
    const response = await harness.post('/library', { endpoint: 'space', payload: {} })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ENT_LIBRARY_UNAVAILABLE' } })
  })

  it('主体边界：同一份存储上，别的主体看不到、也读不到本主体的资料', async () => {
    const home = await makeHome()
    const domain: InMemoryLibraryDomain = await createInMemoryLibraryDomain()
    const mine = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })
    const other = await createLibraryTestRig({
      home, domain, subject: { scope: 'personal', ownerId: 'u2002' }, manager: { newId: sequenceIds() },
    })
    const mineHarness = await harnessFor(mine.manager)
    const otherHarness = await harnessFor(other.manager)

    const imported = (await (await mineHarness.post('/library', {
      endpoint: 'import', payload: { name: '私密.md', content: '只属于 u1001' },
    })).json() as Envelope<{ asset: AssetView, revision: { id: string } }>).data
    expect((await (await mineHarness.post('/library', { endpoint: 'search', payload: { query: 'u1001' } })).json() as Envelope<{ hits: HitView[] }>).data.hits).toHaveLength(1)

    // 别的登录主体：整库是空的，按 id 直读与读原件都 404（不是 403——不泄漏"存在但不对"）。
    const otherSpace = await (await otherHarness.post('/library', { endpoint: 'space', payload: {} })).json() as Envelope<SpaceView>
    expect(otherSpace.data).toEqual({ rootTitle: '我的资料', nodes: [], assets: [] })
    const stolenRead = await otherHarness.post('/library', { endpoint: 'read-text', payload: { assetId: imported.asset.id } })
    expect(stolenRead.status).toBe(404)
    expect(await stolenRead.json()).toEqual({ error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
    expect((await otherHarness.get(`/library/objects/${imported.asset.id}/${imported.revision.id}`)).status).toBe(404)
  })

  it('失败投影是纯函数，逐个码定死状态（含唯一的 500 与"文件太大"413）', () => {
    expect(projectLibraryFailure(new LibraryError('library/internal', 'boom'))).toEqual({ status: 500, code: 'ENT_LIBRARY_INTERNAL' })
    expect(projectLibraryFailure(new LibraryError('library/not-found', 'gone'))).toEqual({ status: 404, code: 'ENT_RESOURCE_NOT_FOUND' })
    expect(projectLibraryFailure(new LibraryError('library/disabled', 'off'))).toEqual({ status: 409, code: 'ENT_LIBRARY_DISABLED' })
    expect(projectLibraryFailure(new LibraryError('library/name-conflict', 'dup'))).toEqual({ status: 409, code: 'ENT_LIBRARY_CONFLICT' })
    expect(projectLibraryFailure(new LibraryError('library/file-too-large', 'big'))).toEqual({ status: 413, code: 'ENT_LIBRARY_TOO_LARGE' })
    expect(projectLibraryFailure(new LibraryError('library/invalid-request', 'shape'))).toEqual({ status: 400, code: 'ENT_INVALID_REQUEST' })
    // 非领域失败也走同一张状态表（RangeError→413、TypeError→400、其余→503 可重试）。
    expect(projectLibraryFailure(new RangeError('too large'))).toEqual({ status: 413, code: 'ENT_LIBRARY_TOO_LARGE' })
    expect(projectLibraryFailure(new TypeError('bad json'))).toEqual({ status: 400, code: 'ENT_INVALID_REQUEST' })
    expect(projectLibraryFailure(new Error('unknown'))).toEqual({ status: 503, code: 'ENT_LIBRARY_UNAVAILABLE' })
  })

  it('单入口的 endpoint 清单恰好是 P1-A 的 15 个（少一个/多一个都不行；加流式 GET 共 16 = §4.4 D1）', () => {
    expect([...ENTERPRISE_LIBRARY_ENDPOINTS]).toEqual([
      'space', 'list', 'create-folder', 'import', 'search',
      'create-draft', 'update-draft', 'publish-draft',
      'read-text', 'rename', 'move', 'remove', 'set-asset-status', 'task-selection', 'set-task-selection',
    ])
  })
})
