/**
 * [INPUT]: 依赖 `src/library/manager.ts`（服务门面）、`tests/library-support.ts`（内存假域 + 临时 dshHome + 夹具）、`src/library/storage/domain.ts`（预置记录用 zod 门禁）
 * [OUTPUT]: 锁住服务门面的全部语义：四张表的增删改查、list 由服务层排序（后端序不保证）、名称/父节点/环三重门禁、主体隔离（A8）与键碰撞（写拒读 not-found）、容量与选择上限、级联删除（节点树 → 资产 → 修订 → 对象 → 选择），以及**多步写的补偿回滚**与**同一实例内串行**
 * [POS]: tests 下资料库服务层的**行为回归**；本文件红 = 有人把排序交回后端、放宽了重名/环/主体隔离、让失败的写留下孤儿记录或孤儿对象、或破坏了实例内串行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import {
  LibraryManager,
  type LibraryManagerOptions,
} from '../src/library/manager.js'
import {
  LibraryObjectStore,
  type LibraryRevisionObjects,
  type LibraryRevisionWriteInput,
} from '../src/library/objects.js'
import { parseLibraryRecord } from '../src/library/storage/domain.js'
import {
  createInMemoryLibraryDomain,
  createLibraryTestRig,
  makeLibraryTempDir,
  type InMemoryLibraryDomain,
  type LibraryTestRig,
} from './library-support.js'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-manager-')
  temps.push(path)
  return path
}

/**
 * 确定性 id 分配器：`nd_1`/`as_1`/`rv_1`…（断言不依赖 uuid）。
 * 前缀与产品默认实现一致（`LIBRARY_ID_PREFIXES`），否则测试会拿着 `node_1` 这种键去断言。
 */
function sequenceIds(): (kind: string) => string {
  const prefixes: Record<string, string> = { node: 'nd', asset: 'as', revision: 'rv' }
  const counters = new Map<string, number>()
  return (kind: string) => {
    const next = (counters.get(kind) ?? 0) + 1
    counters.set(kind, next)
    return `${prefixes[kind] ?? kind}_${next}`
  }
}

/** 一套夹具：确定性 id + 默认主体 u1001。 */
async function makeRig(options: {
  readonly domain?: InMemoryLibraryDomain | undefined
  readonly manager?: Omit<LibraryManagerOptions, 'domain' | 'objects' | 'subject'> | undefined
} = {}): Promise<LibraryTestRig & { readonly home: string }> {
  const home = await makeHome()
  return await createLibraryTestRig({
    home,
    domain: options.domain,
    manager: { newId: sequenceIds(), ...(options.manager ?? {}) },
  })
}

const SAMPLE = '# 标题\n正文\n'

async function rejectionCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as LibraryError).code
  }
  throw new Error('expected the call to reject')
}

describe('节点：建 / 读 / 列 / 改名 / 移动 / 删', () => {
  it('顶层文件夹：parentId=null、depth=0、kind=folder、assetId=null，读回逐字段一致', async () => {
    const { manager, domain } = await makeRig()
    const folder = await manager.createFolder({ title: '项目甲' })
    expect(folder).toMatchObject({ id: 'nd_1', parentId: null, kind: 'folder', title: '项目甲', depth: 0, assetId: null })
    expect(folder.createdAt).toBe(folder.updatedAt)
    expect(await manager.getNode('nd_1')).toEqual(folder)
    // 键形状在真实落表处也成立：<scope>_<ownerId>_<id>
    expect([...domain.table('nodes').keys()]).toEqual(['personal_u1001_nd_1'])
  })

  it('嵌套文件夹：depth = 父 depth + 1', async () => {
    const { manager } = await makeRig()
    const parent = await manager.createFolder({ title: 'A' })
    const child = await manager.createFolder({ title: 'B', parentId: parent.id })
    const grand = await manager.createFolder({ title: 'C', parentId: child.id })
    expect([parent.depth, child.depth, grand.depth]).toEqual([0, 1, 2])
  })

  it.each(['', '   ', '.', '..', 'a/b', 'a\\b', 'x'.repeat(257), 'a\u0000b'])('非法标题 %j ⇒ library/invalid-name', async (title) => {
    const { manager } = await makeRig()
    expect(await rejectionCode(manager.createFolder({ title }))).toBe('library/invalid-name')
  })

  it('同父下大小写不敏感重名 ⇒ library/name-conflict（不同父可以同名）', async () => {
    const { manager } = await makeRig()
    const a = await manager.createFolder({ title: '报告' })
    const b = await manager.createFolder({ title: '报告2' })
    expect(await rejectionCode(manager.createFolder({ title: '报告' }))).toBe('library/name-conflict')
    const upper = await manager.createFolder({ title: 'REPORT' })
    expect(await rejectionCode(manager.createFolder({ title: 'report' }))).toBe('library/name-conflict')
    // 换一个父：同名（连大小写都不同）是允许的
    const nested = await manager.createFolder({ title: 'report', parentId: a.id })
    expect([upper.title, nested.title, b.kind]).toEqual(['REPORT', 'report', 'folder'])
  })

  it('父不存在 ⇒ not-found；父是文件节点 ⇒ library/not-folder', async () => {
    const { manager } = await makeRig()
    expect(await rejectionCode(manager.createFolder({ title: 'x', parentId: 'nd_404' }))).toBe('library/not-found')
    const asset = await manager.createAsset({ name: '报告.md', kind: 'markdown' })
    const node = await manager.getNode(asset.nodeId)
    expect(await rejectionCode(manager.createFolder({ title: 'x', parentId: node.id }))).toBe('library/not-folder')
    // 列一个文件节点的子节点不是错误：它没有子节点
    expect(await manager.listNodes(node.id)).toEqual([])
  })

  it('listNodes 只列直接子节点，且顺序由服务层给（文件夹先、再 zh-CN 标题）', async () => {
    // shuffleKeys：让后端返回与期望相反的序，证明排序不是"碰巧和插入序一致"。
    const home = await makeHome()
    const domain = await createInMemoryLibraryDomain({ shuffleKeys: true })
    const { manager } = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })
    const zeta = await manager.createFolder({ title: 'zeta' })
    await manager.createFolder({ title: 'alpha' })
    await manager.createFolder({ title: 'Beta' })
    await manager.createAsset({ name: 'A1', kind: 'text' })
    await manager.createFolder({ title: 'inner', parentId: zeta.id })

    const top = await manager.listNodes()
    expect(top.map(node => node.title)).toEqual(['alpha', 'Beta', 'zeta', 'A1'])
    expect(top.map(node => node.kind)).toEqual(['folder', 'folder', 'folder', 'asset'])
    const inner = await manager.listNodes(zeta.id)
    expect(inner.map(node => node.title)).toEqual(['inner'])
    expect((await manager.listAllNodes()).length).toBe(5)
  })

  it('renameNode：改得动、重名照样拒、排除自己', async () => {
    const { manager } = await makeRig()
    const node = await manager.createFolder({ title: 'A' })
    await manager.createFolder({ title: 'B' })
    const renamed = await manager.renameNode(node.id, '  A2  ')
    expect(renamed.title).toBe('A2')
    expect(renamed.updatedAt >= renamed.createdAt).toBe(true)
    expect(await rejectionCode(manager.renameNode(node.id, 'b'))).toBe('library/name-conflict')
    expect((await manager.renameNode(node.id, 'A2')).title).toBe('A2')
    expect(await rejectionCode(manager.renameNode('nd_404', 'x'))).toBe('library/not-found')
  })

  it('moveNode：换父改 depth 并重算整棵子树；成环/非文件夹/自身一律拒；同父是幂等', async () => {
    const { manager } = await makeRig()
    const root = await manager.createFolder({ title: 'root' })
    const a = await manager.createFolder({ title: 'a', parentId: root.id })
    const b = await manager.createFolder({ title: 'b', parentId: a.id })
    const target = await manager.createFolder({ title: 'target' })

    const moved = await manager.moveNode(a.id, target.id)
    expect(moved.parentId).toBe(target.id)
    expect(moved.depth).toBe(1)
    expect((await manager.getNode(b.id)).depth).toBe(2)

    expect(await rejectionCode(manager.moveNode(a.id, a.id))).toBe('library/cycle')
    expect(await rejectionCode(manager.moveNode(a.id, b.id))).toBe('library/cycle')
    const asset = await manager.createAsset({ name: 'x.md', kind: 'markdown' })
    expect(await rejectionCode(manager.moveNode(a.id, asset.nodeId))).toBe('library/not-folder')

    const same = await manager.moveNode(a.id, target.id)
    expect(same).toEqual(moved)
    const backToRoot = await manager.moveNode(a.id, null)
    expect(backToRoot.parentId).toBeNull()
    expect(backToRoot.depth).toBe(0)
    expect((await manager.getNode(b.id)).depth).toBe(1)
  })
})

describe('资产：建（同时建树节点）/ 读 / 列 / 状态', () => {
  it('createAsset 落两条记录（assets + kind=asset 的 nodes），默认媒体类型与来源', async () => {
    const { manager, domain } = await makeRig()
    const asset = await manager.createAsset({ name: '报告.md', kind: 'markdown' })
    expect(asset).toMatchObject({
      id: 'as_1', nodeId: 'nd_1', name: '报告.md', kind: 'markdown', mediaType: 'text/markdown',
      byteLength: 0, currentRevisionId: null, status: 'active', source: 'upload',
    })
    const node = await manager.getNode('nd_1')
    expect(node).toMatchObject({ kind: 'asset', title: '报告.md', assetId: 'as_1', depth: 0 })
    expect([...domain.table('assets').keys()]).toEqual(['personal_u1001_as_1'])
    expect(await manager.getAsset('as_1')).toEqual(asset)
  })

  it('显式媒体类型与来源会被接受；非法 kind / 非法媒体类型一律拒', async () => {
    const { manager } = await makeRig()
    const asset = await manager.createAsset({ name: 'a', kind: 'text', mediaType: 'text/plain', source: 'task' })
    expect(asset.source).toBe('task')
    expect(await rejectionCode(manager.createAsset({ name: 'b', kind: 'xlsx' as 'text' }))).toBe('library/invalid-request')
    expect(await rejectionCode(manager.createAsset({ name: 'c', kind: 'text', mediaType: 'nope' }))).toBe('library/invalid-request')
  })

  it('listAssets 按名字排序（后端序不保证）', async () => {
    const home = await makeHome()
    const domain = await createInMemoryLibraryDomain({ shuffleKeys: true })
    const { manager } = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })
    await manager.createAsset({ name: 'zeta.txt', kind: 'text' })
    await manager.createAsset({ name: 'alpha.txt', kind: 'text' })
    expect((await manager.listAssets()).map(asset => asset.name)).toEqual(['alpha.txt', 'zeta.txt'])
  })

  it('setAssetStatus：停用后状态落库，非法状态拒', async () => {
    const { manager } = await makeRig()
    const asset = await manager.createAsset({ name: 'a.txt', kind: 'text' })
    expect((await manager.setAssetStatus(asset.id, 'disabled')).status).toBe('disabled')
    expect((await manager.getAsset(asset.id)).status).toBe('disabled')
    expect(await rejectionCode(manager.setAssetStatus(asset.id, 'gone' as 'active'))).toBe('library/invalid-request')
  })
})

describe('修订：写 / 读 / 列表 / 配额 / 补偿', () => {
  it('writeRevision：对象三件落盘 + 记录落表 + 资产指针更新 + number 递增', async () => {
    const { manager, objects, home } = await makeRig()
    const asset = await manager.createAsset({ name: '报告.md', kind: 'markdown' })

    const first = await manager.writeRevision({ assetId: asset.id, original: Buffer.from(SAMPLE, 'utf8'), content: SAMPLE })
    expect(first).toMatchObject({
      id: 'rv_1', assetId: 'as_1', number: 1, originalRelativePath: 'as_1/rv_1/original.md',
      contentRelativePath: 'as_1/rv_1/content.md', conversionStatus: 'pending', conversionWarnings: [],
    })
    expect(first.originalSha256).toBe(first.contentSha256)
    expect(first.contentByteLength).toBe(Buffer.byteLength(SAMPLE, 'utf8'))
    // 正文只进对象层：KV 记录里没有它（勘误 C）
    expect(first).not.toHaveProperty('content')
    expect(await objects.readRevisionText('as_1', 'rv_1')).toEqual({ text: SAMPLE, byteLength: Buffer.byteLength(SAMPLE, 'utf8') })
    expect(await objects.revisionExists('as_1', 'rv_1')).toBe(true)
    expect(home.length).toBeGreaterThan(0)

    const updatedAsset = await manager.getAsset('as_1')
    expect(updatedAsset.currentRevisionId).toBe('rv_1')
    expect(updatedAsset.byteLength).toBe(Buffer.byteLength(SAMPLE, 'utf8'))

    const second = await manager.writeRevision({ assetId: asset.id, original: Buffer.from('第二版'), content: '第二版' })
    expect(second.number).toBe(2)
    expect(second.originalRelativePath).toBe('as_1/rv_2/original.md')
    expect((await manager.getAsset('as_1')).currentRevisionId).toBe('rv_2')
    expect((await manager.listRevisions('as_1')).map(revision => revision.number)).toEqual([1, 2])
  })

  it('writeRevision：扩展名默认取资产 kind；conversion 落盘后 status=ready', async () => {
    const { manager } = await makeRig()
    const asset = await manager.createAsset({ name: 'a.txt', kind: 'text' })
    const revision = await manager.writeRevision({
      assetId: asset.id,
      original: Buffer.from('纯文本'),
      content: '纯文本',
      conversion: {
        version: 1,
        kind: 'text',
        originalSha256: 'a'.repeat(64),
        warnings: ['扫不到标题'],
        locations: [],
      },
    })
    expect(revision.originalRelativePath).toBe('as_1/rv_1/original.txt')
    expect(revision.conversionStatus).toBe('ready')
    expect(revision.conversionWarnings).toEqual(['扫不到标题'])
    expect(await manager.readRevisionConversion('as_1', 'rv_1')).toMatchObject({ kind: 'text', warnings: ['扫不到标题'] })
  })

  it('readRevisionText / readRevisionOriginal 走对象层；修订不属于该资产 ⇒ not-found', async () => {
    const { manager } = await makeRig()
    const first = await manager.createAsset({ name: 'a.md', kind: 'markdown' })
    const second = await manager.createAsset({ name: 'b.md', kind: 'markdown' })
    await manager.writeRevision({ assetId: first.id, original: Buffer.from(SAMPLE, 'utf8'), content: SAMPLE })

    const document = await manager.readRevisionText('as_1', 'rv_1')
    expect(document.text).toBe(SAMPLE)
    expect(document.revision.id).toBe('rv_1')
    const original = await manager.readRevisionOriginal('as_1', 'rv_1')
    expect(original.bytes.toString('utf8')).toBe(SAMPLE)
    expect(original.sha256).toBe(document.revision.originalSha256)

    expect(await rejectionCode(manager.readRevisionText(second.id, 'rv_1'))).toBe('library/not-found')
    expect(await rejectionCode(manager.getRevision('as_2', 'rv_1'))).toBe('library/not-found')
  })

  it('单主体配额：写入前就判（超限 ⇒ library/quota-exceeded，且一个字节都不落）', async () => {
    const home = await makeHome()
    const { manager, objects } = await createLibraryTestRig({
      home,
      manager: { newId: sequenceIds(), limits: { maxSubjectBytes: 8 } },
    })
    const asset = await manager.createAsset({ name: 'a.txt', kind: 'text' })
    await manager.writeRevision({ assetId: asset.id, original: Buffer.from('12345'), content: '12345' })
    expect(await rejectionCode(manager.writeRevision({ assetId: asset.id, original: Buffer.from('123456789'), content: 'x' })))
      .toBe('library/quota-exceeded')
    expect(await manager.listRevisions(asset.id)).toHaveLength(1)
    expect(await objects.revisionExists('as_1', 'rv_2')).toBe(false)
  })

  it('补偿：资产指针更新失败 ⇒ 刚落的修订记录与对象都撤掉，资产回到"没有修订"', async () => {
    const home = await makeHome()
    let failed = false
    const domain = await createInMemoryLibraryDomain({
      failWrite: (table, kind) => {
        if (table === 'assets' && kind === 'update' && !failed) {
          failed = true
          return new Error('injected assets.update failure')
        }
        return undefined
      },
    })
    const { manager, objects, domain: used } = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })
    const asset = await manager.createAsset({ name: 'a.md', kind: 'markdown' })
    expect(await rejectionCode(manager.writeRevision({ assetId: asset.id, original: Buffer.from(SAMPLE), content: SAMPLE })))
      .toBe('library/internal')

    expect(failed).toBe(true)
    expect(await manager.listRevisions('as_1')).toEqual([])
    expect([...used.table('revisions').keys()]).toEqual([])
    expect(await objects.revisionExists('as_1', 'rv_1')).toBe(false)
    expect((await manager.getAsset('as_1')).currentRevisionId).toBeNull()
    // 补偿后可以重试：失败那次留下的落点/键都已清掉（这里 id 分配器是计数器，所以拿到 rv_2；
    // 生产用的是 uuid，重试不复用 id 也不影响"编号从 1 重新开始"这条语义）。
    expect(await objects.revisionExists('as_1', 'rv_1')).toBe(false)
    const retry = await manager.writeRevision({ assetId: asset.id, original: Buffer.from(SAMPLE), content: SAMPLE })
    expect(retry.number).toBe(1)
    expect((await manager.getAsset('as_1')).currentRevisionId).toBe(retry.id)
  })

  it('补偿：节点落盘失败 ⇒ createAsset 撤掉刚落的资产记录（不留看不见的孤儿）', async () => {
    const home = await makeHome()
    let failed = false
    const domain = await createInMemoryLibraryDomain({
      failWrite: (table, kind) => {
        if (table === 'nodes' && kind === 'put' && !failed) {
          failed = true
          return new Error('injected nodes.put failure')
        }
        return undefined
      },
    })
    const { manager, domain: used } = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })
    expect(await rejectionCode(manager.createAsset({ name: 'a.md', kind: 'markdown' }))).toBe('library/internal')
    expect(failed).toBe(true)
    expect([...used.table('assets').keys()]).toEqual([])
    expect([...used.table('nodes').keys()]).toEqual([])
    expect(await manager.listAssets()).toEqual([])
  })
})

describe('选择：会话级选中集合', () => {
  it('setSelection 去重保序；getSelection 未设置返回 undefined；clearSelection 报存在性', async () => {
    const { manager } = await makeRig()
    const a = await manager.createFolder({ title: 'a' })
    const b = await manager.createFolder({ title: 'b' })
    const selection = await manager.setSelection('session-abc', [b.id, a.id, b.id])
    expect(selection.nodeIds).toEqual([b.id, a.id])
    expect(selection.sessionId).toBe('session-abc')
    expect((await manager.getSelection('session-abc'))?.nodeIds).toEqual([b.id, a.id])
    expect(await manager.getSelection('session-none')).toBeUndefined()
    expect(await manager.clearSelection('session-abc')).toBe(true)
    expect(await manager.clearSelection('session-abc')).toBe(false)
  })

  it('数量超限 ⇒ library/selection-too-large；节点不存在 ⇒ not-found；停用资产被跳过', async () => {
    const home = await makeHome()
    const { manager } = await createLibraryTestRig({ home, manager: { newId: sequenceIds(), limits: { maxSelectionNodes: 2 } } })
    const a = await manager.createFolder({ title: 'a' })
    const b = await manager.createFolder({ title: 'b' })
    const asset = await manager.createAsset({ name: 'x.md', kind: 'markdown' })
    expect(await rejectionCode(manager.setSelection('s', [a.id, b.id, asset.nodeId]))).toBe('library/selection-too-large')
    expect(await rejectionCode(manager.setSelection('s', [a.id, 'nd_404']))).toBe('library/not-found')
    await manager.setAssetStatus(asset.id, 'disabled')
    expect((await manager.setSelection('s', [a.id, asset.nodeId])).nodeIds).toEqual([a.id])
  })
})

describe('主体隔离与键归属（A8 + 勘误 B1）', () => {
  it('别的主体的记录在本主体视角下是 library/not-found，list 也看不到', async () => {
    const home = await makeHome()
    const domain = await createInMemoryLibraryDomain()
    const first = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })
    const other = await createLibraryTestRig({
      home,
      domain,
      subject: { scope: 'personal', ownerId: 'u2002' },
      manager: { newId: sequenceIds() },
    })
    const mine = await first.manager.createFolder({ title: '我的' })
    await first.manager.createAsset({ name: 'a.md', kind: 'markdown' })

    expect(await rejectionCode(other.manager.getNode(mine.id))).toBe('library/not-found')
    expect(await other.manager.listNodes()).toEqual([])
    expect(await other.manager.listAssets()).toEqual([])
    // 但盘上是两份记录（键前缀不同）
    // u1001 有两条节点（一个文件夹 + 一个文件节点），u2002 一条都没有
    expect([...domain.table('nodes').keys()].sort()).toEqual(['personal_u1001_nd_1', 'personal_u1001_nd_2'])
  })

  it('键被别的三元组占用 ⇒ 写拒 library/key-collision；读同一键 ⇒ not-found（不泄漏存在性）', async () => {
    const home = await makeHome()
    const domain = await createInMemoryLibraryDomain()
    // 预置一条 ownerId='a'、id='b_c' 的记录，它的键与 ownerId='a_b'、id='c' 完全同形：
    //   normalize(['personal','a','b_c']) === normalize(['personal','a_b','c']) === 'personal_a_b_c'
    await domain.table('nodes').put('personal_a_b_c', parseLibraryRecord('nodes', {
      schemaVersion: 1,
      scope: 'personal',
      ownerId: 'a',
      id: 'b_c',
      parentId: null,
      kind: 'folder',
      title: '别人的目录',
      depth: 0,
      assetId: null,
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    }))
    const rig = await createLibraryTestRig({
      home,
      domain,
      subject: { scope: 'personal', ownerId: 'a_b' },
      manager: { newId: () => 'c' },
    })
    expect(await rejectionCode(rig.manager.createFolder({ title: '我的 c' }))).toBe('library/key-collision')
    expect(await rejectionCode(rig.manager.getNode('c'))).toBe('library/not-found')
    expect(await rig.manager.listNodes()).toEqual([])
  })
})

describe('级联删除（节点树 → 资产 → 修订 → 对象 → 选择）', () => {
  it('removeNode 递归删子树 + 资产 + 修订 + 对象，并把节点从选择里剔掉', async () => {
    const { manager, objects, domain } = await makeRig()
    const root = await manager.createFolder({ title: 'root' })
    const child = await manager.createFolder({ title: 'child', parentId: root.id })
    const asset = await manager.createAsset({ name: 'a.md', kind: 'markdown', parentId: child.id })
    await manager.writeRevision({ assetId: asset.id, original: Buffer.from(SAMPLE), content: SAMPLE })
    await manager.writeRevision({ assetId: asset.id, original: Buffer.from('v2'), content: 'v2' })
    await manager.setSelection('session-abc', [root.id, asset.nodeId])
    expect(await objects.revisionExists(asset.id, 'rv_1')).toBe(true)

    const summary = await manager.removeNode(root.id)
    expect(summary).toEqual({ nodes: 3, assets: 1, revisions: 2 })
    expect(await manager.listAllNodes()).toEqual([])
    expect(await manager.listAssets()).toEqual([])
    expect([...domain.table('revisions').keys()]).toEqual([])
    expect(await objects.revisionExists(asset.id, 'rv_1')).toBe(false)
    // 选择里被删掉的节点 id 被剔掉；全空 ⇒ 整条选择记录删掉（不留空记录）
    expect(await manager.getSelection('session-abc')).toBeUndefined()
    expect(await rejectionCode(manager.getNode(root.id))).toBe('library/not-found')
  })

  it('removeAsset 等价于删它的树节点（级联到修订与对象）', async () => {
    const { manager, objects } = await makeRig()
    const asset = await manager.createAsset({ name: 'a.md', kind: 'markdown' })
    await manager.writeRevision({ assetId: asset.id, original: Buffer.from(SAMPLE), content: SAMPLE })
    await manager.setSelection('s', [])
    const summary = await manager.removeAsset(asset.id)
    expect(summary).toEqual({ nodes: 1, assets: 1, revisions: 1 })
    expect(await manager.listAssets()).toEqual([])
    expect(await objects.revisionExists(asset.id, 'rv_1')).toBe(false)
    expect(await rejectionCode(manager.removeAsset(asset.id))).toBe('library/not-found')
  })

  it('选择里还有其他节点时只做剔除、不删整条记录', async () => {
    const { manager } = await makeRig()
    const keep = await manager.createFolder({ title: 'keep' })
    const drop = await manager.createFolder({ title: 'drop' })
    await manager.setSelection('s', [keep.id, drop.id])
    await manager.removeNode(drop.id)
    expect((await manager.getSelection('s'))?.nodeIds).toEqual([keep.id])
  })
})

describe('同一实例内串行（勘误 B4：仅进程内）', () => {
  it('两个并发 writeRevision 的多步写不交错（对象层的 enter/exit 严格成对）', async () => {
    const home = await makeHome()
    const events: string[] = []
    class TracingObjectStore extends LibraryObjectStore {
      override async writeRevision(input: LibraryRevisionWriteInput): Promise<LibraryRevisionObjects> {
        events.push('enter')
        await new Promise(resolve => setTimeout(resolve, 5))
        const result = await super.writeRevision(input)
        events.push('exit')
        return result
      }
    }
    const domain = await createInMemoryLibraryDomain({ writeDelayMs: 1 })
    const objects = new TracingObjectStore({ dshHome: home })
    const manager = new LibraryManager({
      domain,
      objects,
      subject: { scope: 'personal', ownerId: 'u1001' },
      newId: sequenceIds(),
    })
    const asset = await manager.createAsset({ name: 'a.md', kind: 'markdown' })
    async function write(index: number): Promise<void> {
      await manager.writeRevision({ assetId: asset.id, original: Buffer.from(`第 ${index} 版`), content: `第 ${index} 版` })
    }
    await Promise.all([write(1), write(2), write(3)])
    expect(events).toEqual(['enter', 'exit', 'enter', 'exit', 'enter', 'exit'])
    expect((await manager.listRevisions(asset.id)).map(revision => revision.number)).toEqual([1, 2, 3])
  })
})

describe('构造期门禁', () => {
  it('缺 domain/objects、或主体 id 不能压成安全键 ⇒ 立刻拒', async () => {
    const home = await makeHome()
    const domain = await createInMemoryLibraryDomain()
    const objects = new LibraryObjectStore({ dshHome: home })
    expect(() => new LibraryManager({
      domain: undefined as unknown as InMemoryLibraryDomain,
      objects,
      subject: { scope: 'personal', ownerId: 'u1' },
    })).toThrowError(/needs a domain/)
    expect(() => new LibraryManager({
      domain,
      objects: undefined as unknown as LibraryObjectStore,
      subject: { scope: 'personal', ownerId: 'u1' },
    })).toThrowError(/needs an object store/)
    expect(() => new LibraryManager({ domain, objects, subject: { scope: 'personal', ownerId: '' } })).toThrowError(/non-empty/)
  })

  it('主体 id 含非法字符时键被归一化，服务照常可用（中文主体 id 也压得出安全键）', async () => {
    const home = await makeHome()
    const domain = await createInMemoryLibraryDomain()
    const { manager } = await createLibraryTestRig({
      home,
      domain,
      subject: { scope: 'personal', ownerId: '会话:1' },
      manager: { newId: sequenceIds() },
    })
    const folder = await manager.createFolder({ title: 'A' })
    expect(folder.ownerId).toBe('会话:1')
    // CJK 不在官方字符集里 ⇒ 逐字符归一为 `-`（勘误 B1 的字面要求）；键因此"丢失"了原文，
    // 这正是记录里必须留 ownerId/id 原始值的原因：键只定位，归属由记录字段裁决。
    expect([...domain.table('nodes').keys()]).toEqual(['personal_---1_nd_1'])
    expect((await manager.listNodes()).map(node => node.id)).toEqual([folder.id])
  })
})
