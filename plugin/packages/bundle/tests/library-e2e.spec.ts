/**
 * [INPUT]: 依赖 `LibraryManager`（服务门面）、`LibraryObjectStore`（对象层）、`tests/library-support.ts`（可落盘的内存假域 + 临时 dshHome），以及 node:fs/promises 直接读盘核对布局
 * [OUTPUT]: 一条完整链路的端到端证据：**建节点 → 建资产 → 写修订 → 读回 → 删资产**（记录层与对象层逐件落盘、再逐件清掉），外加"跨重启（同 persistRoot + 同 dshHome 重开）记录与正文都还在"与"版本戳不被接受的记录静默消失、不迁移、不生成 .bak"两条落盘语义
 * [POS]: tests 下资料库纵深的**端到端门禁**（本刀唯一一条贯穿"服务门面 → 存储 → 对象层"的验收）；磁盘形状对齐 `~/.sshwork/libport-probe/disk-manifest.txt` 的实测形态（`storages/<域>/<表>/<key>.json` + 0600/0700）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LIBRARY_DOMAIN_NAME } from '../src/library/storage/domain.js'
import { encodeRecordEnvelope } from '../src/library/storage/records.js'
import {
  createInMemoryLibraryDomain,
  createLibraryTestRig,
  makeLibraryTempDir,
} from './library-support.js'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-e2e-')
  temps.push(path)
  return path
}

/** 与产品默认一致的前缀（`LIBRARY_ID_PREFIXES`），让断言里的键可读。 */
function sequenceIds(): (kind: string) => string {
  const prefixes: Record<string, string> = { node: 'nd', asset: 'as', revision: 'rv' }
  const counters = new Map<string, number>()
  return (kind: string) => {
    const next = (counters.get(kind) ?? 0) + 1
    counters.set(kind, next)
    return `${prefixes[kind] ?? kind}_${next}`
  }
}

const BODY = '# 项目甲周报\n\n- 本周完成 A、B\n- 下周计划 C\n'

/** 一条记录在磁盘上的落点（对齐 probe 的实测形态：`storages/<域>/<表>/<key>.json`）。 */
function recordPath(persistRoot: string, table: string, key: string): string {
  return join(persistRoot, LIBRARY_DOMAIN_NAME, table, `${key}.json`)
}

describe('端到端：服务门面 → 存储 + 对象层（建节点 → 建资产 → 写修订 → 读回 → 删资产）', () => {
  it('每一步都逐件落盘，删除时逐件清掉', async () => {
    const home = await makeHome()
    const persistRoot = join(home, 'storages')
    const domain = await createInMemoryLibraryDomain({ persistRoot })
    const { manager, objects } = await createLibraryTestRig({ home, domain, manager: { newId: sequenceIds() } })

    // ① 建节点
    const folder = await manager.createFolder({ title: '项目甲' })
    const nodeFile = recordPath(persistRoot, 'nodes', `personal_u1001_${folder.id}`)
    expect(await readFile(nodeFile, 'utf8')).toBe(encodeRecordEnvelope(1, folder))
    expect((await stat(nodeFile)).mode & 0o777).toBe(0o600)

    // ② 建资产（同时建树上的文件节点）
    const asset = await manager.createAsset({ name: '周报.md', kind: 'markdown', parentId: folder.id })
    expect(await readFile(recordPath(persistRoot, 'assets', `personal_u1001_${asset.id}`), 'utf8')).toContain('"name": "周报.md"')
    expect((await manager.getNode(asset.nodeId)).parentId).toBe(folder.id)

    // ③ 写修订：KV 记录里只有路径/摘要，正文与原件落在对象层
    const revision = await manager.writeRevision({
      assetId: asset.id,
      original: Buffer.from(BODY, 'utf8'),
      content: BODY,
    })
    const revisionFile = recordPath(persistRoot, 'revisions', `personal_u1001_${revision.id}`)
    const revisionText = await readFile(revisionFile, 'utf8')
    expect(revisionText).toContain('"contentRelativePath": "as_1/rv_1/content.md"')
    expect(revisionText).not.toContain('项目甲周报')
    const objectDirectory = join(home, 'library', 'objects', asset.id, revision.id)
    expect(await readFile(join(objectDirectory, 'content.md'), 'utf8')).toBe(BODY)
    expect(await readFile(join(objectDirectory, 'original.md'), 'utf8')).toBe(BODY)
    expect((await readdir(objectDirectory)).sort()).toEqual(['content.md', 'original.md'])
    expect((await stat(objectDirectory)).mode & 0o777).toBe(0o700)

    // ④ 读回：正文与原件都从对象层来，且摘要与记录一致
    const document = await manager.readRevisionText(asset.id, revision.id)
    expect(document.text).toBe(BODY)
    expect(document.byteLength).toBe(Buffer.byteLength(BODY, 'utf8'))
    const original = await manager.readRevisionOriginal(asset.id, revision.id)
    expect(original.bytes.toString('utf8')).toBe(BODY)
    expect(original.sha256).toBe(revision.originalSha256)
    expect((await manager.getAsset(asset.id)).currentRevisionId).toBe(revision.id)

    // ⑤ 删资产：修订记录、资产记录、树节点、对象目录一起清掉
    const summary = await manager.removeAsset(asset.id)
    expect(summary).toEqual({ nodes: 1, assets: 1, revisions: 1 })
    expect(await manager.listAssets()).toEqual([])
    expect(await manager.listNodes(folder.id)).toEqual([])
    expect(await readdir(join(persistRoot, LIBRARY_DOMAIN_NAME, 'revisions'))).toEqual([])
    expect(await readdir(join(persistRoot, LIBRARY_DOMAIN_NAME, 'assets'))).toEqual([])
    expect(await objects.revisionExists(asset.id, revision.id)).toBe(false)
    // 只删空目录：文件夹节点与它的记录都还在
    expect([...domain.table('nodes').keys()]).toEqual([`personal_u1001_${folder.id}`])
  })

  it('跨重启：同 persistRoot + 同 dshHome 重开 ⇒ 记录与正文都还在', async () => {
    const home = await makeHome()
    const persistRoot = join(home, 'storages')
    const first = await createLibraryTestRig({
      home,
      domain: await createInMemoryLibraryDomain({ persistRoot }),
      manager: { newId: sequenceIds() },
    })
    const folder = await first.manager.createFolder({ title: '项目甲' })
    const asset = await first.manager.createAsset({ name: '周报.md', kind: 'markdown', parentId: folder.id })
    const revision = await first.manager.writeRevision({
      assetId: asset.id,
      original: Buffer.from(BODY, 'utf8'),
      content: BODY,
      conversion: { version: 1, kind: 'markdown', originalSha256: revision0Sha(), warnings: [], locations: [] },
    })

    // 模拟进程重启：新域实例（从同一 persistRoot 加载）+ 新服务实例（同一 dshHome 上的对象层）
    const restarted = await createLibraryTestRig({
      home,
      domain: await createInMemoryLibraryDomain({ persistRoot }),
      manager: { newId: sequenceIds() },
    })
    expect((await restarted.manager.getNode(folder.id)).title).toBe('项目甲')
    expect((await restarted.manager.getAsset(asset.id)).name).toBe('周报.md')
    expect((await restarted.manager.listRevisions(asset.id)).map(item => item.number)).toEqual([1])
    expect((await restarted.manager.readRevisionText(asset.id, revision.id)).text).toBe(BODY)
    expect(await restarted.manager.readRevisionConversion(asset.id, revision.id)).toMatchObject({ kind: 'markdown' })
  })

  it('版本戳不被接受的记录：open 成功、该记录静默消失、不迁移、不生成 .bak', async () => {
    const home = await makeHome()
    const persistRoot = join(home, 'storages')
    const first = await createLibraryTestRig({
      home,
      domain: await createInMemoryLibraryDomain({ persistRoot }),
      manager: { newId: sequenceIds() },
    })
    const doomed = await first.manager.createFolder({ title: '会被丢弃的' })
    const kept = await first.manager.createFolder({ title: '留下的' })

    const directory = join(persistRoot, LIBRARY_DOMAIN_NAME, 'nodes')
    const foreignPath = recordPath(persistRoot, 'nodes', `personal_u1001_${doomed.id}`)
    const foreignText = encodeRecordEnvelope(99, { version99: true })
    await writeFile(foreignPath, foreignText)

    const reopened = await createInMemoryLibraryDomain({ persistRoot })
    // open 成功、该记录静默消失（当作不存在），其余记录不受影响
    expect([...reopened.table('nodes').keys()]).toEqual([`personal_u1001_${kept.id}`])
    // 不迁移、不改名、不删：foreign 文件原样躺在盘上（官方语义就是"读作不存在"，没有任何副作用）
    expect((await readFile(foreignPath, 'utf8'))).toBe(foreignText)
    const entries = (await readdir(directory)).sort()
    expect(entries).toEqual([`personal_u1001_${doomed.id}.json`, `personal_u1001_${kept.id}.json`])
    expect(entries.some(name => name.includes('.bak') || name.endsWith('.tmp'))).toBe(false)
  })

  it('空域完全不落盘（没有任何写 ⇒ 没有 storages 目录、也没有 library 目录）', async () => {
    const home = await makeHome()
    const persistRoot = join(home, 'storages')
    const { manager } = await createLibraryTestRig({
      home,
      domain: await createInMemoryLibraryDomain({ persistRoot }),
      manager: { newId: sequenceIds() },
    })
    expect(await manager.listNodes()).toEqual([])
    expect(await manager.listAssets()).toEqual([])
    await expect(readdir(persistRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readdir(join(home, 'library'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

/** 占位：转换元数据里要的原件摘要（与 revisions 记录里的同一形状，测试里给一个合法值即可）。 */
function revision0Sha(): string {
  return 'a'.repeat(64)
}
