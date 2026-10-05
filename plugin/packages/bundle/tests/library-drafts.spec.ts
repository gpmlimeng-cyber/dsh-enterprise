/**
 * [INPUT]: 依赖 `src/library/{manager,objects,route,tools,storage/domain,errors}.js`（被测面）、`src/library/import.js`（造真实数据）、`tests/library-support.ts`（临时 dshHome + 内存假域 + 夹具）、`tests/library-route-support.ts`（真 HTTP）与 `node:fs/promises`（直接读盘上的落点做断言）
 * [OUTPUT]: 「草稿 → 发布 → 不可变修订」这一刀的门禁——① `drafts` 表进域规格且**记录里不含正文**（大正文不进 KV 的反向锁）；② 创建/更新/发布的语义与**乐观锁两枚冲突码**（`library/revision-conflict` / `library/base-revision-conflict`）；③ 只允许 markdown/text（`library/draft-format`）、停用即隔离（`library/disabled`）、草稿正文 8 MiB 上限（`library/file-too-large`）；④ **发布=冻结**：`number = 上一版 + 1`、资产指针移过去、草稿记录与草稿对象一起消失、同一草稿再也发不了第二次；⑤ 修订**只能新建、绝不覆盖**（源码级反向锁 + 行为锁）；⑥ 级联删除把草稿一起清掉；⑦ 3 个草稿 endpoint 的真 HTTP 形状与两条冲突投影（409 + 两枚新 ENT 码）；⑧ 3 个草稿工具的名字/参数名/输出字段逐字 + **`user_confirmed` 硬门闩**（缺确认即拒，且**零副作用**）；⑨ 端到端一条：导入 → 草稿 → 改 → 发布 → `library_read` 读回**冻结正文**
 * [POS]: tests 下资料库「能写能发布」的**行为回归**；本文件红 = 有人放开了乐观锁、让草稿的正文跑进了 KV 记录、让发布变得可覆盖/可重复，或把 `user_confirmed` 降级成提示词约定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryError } from '../src/library/errors.js'
import { importLibraryText } from '../src/library/import.js'
import { LIBRARY_DRAFTS_DIR_SEGMENTS } from '../src/library/objects.js'
import { LibraryManager, type LibraryIdKind, type LibraryManagerOptions } from '../src/library/manager.js'
import {
  parseLibraryRecord,
  libraryDraftSchema,
  LIBRARY_TABLE_SCHEMAS,
  type LibraryDomainPort,
  type LibraryDraftRecord,
} from '../src/library/storage/domain.js'
import { projectLibraryFailure } from '../src/library/route.js'
import {
  ENTERPRISE_LIBRARY_TOOL_NAMES,
  registerEnterpriseLibraryTools,
  type EnterpriseLibraryToolDefinition,
  type EnterpriseLibraryToolRuntime,
} from '../src/library/tools.js'
import { createInMemoryLibraryDomain, createLibraryTestRig, makeLibraryTempDir, type LibraryTestRig } from './library-support.js'
import { createLibraryRouteHarness, type LibraryRouteHarness } from './library-route-support.js'

const temps: string[] = []
const harnesses: LibraryRouteHarness[] = []
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(async harness => await harness.dispose()))
  await Promise.all(temps.splice(0).map(async path => await rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-drafts-')
  temps.push(path)
  return path
}

/** 确定性 id 分配器：本文件的断言要能对着具体 id 说话（顺序 = 申请顺序）。 */
function sequentialIds(): (kind: LibraryIdKind) => string {
  const counters = new Map<LibraryIdKind, number>()
  return kind => {
    const next = (counters.get(kind) ?? 0) + 1
    counters.set(kind, next)
    return `${kind}${next}`
  }
}

/** 一套夹具：临时 dshHome + 内存假域 + 真对象层 + 真服务门面（id 确定性）。 */
async function rig(options: Partial<LibraryManagerOptions> = {}): Promise<LibraryTestRig> {
  return await createLibraryTestRig({
    home: await makeHome(),
    manager: { newId: sequentialIds(), ...options },
  })
}

/** 导入一份 markdown，返回资产与它的第一版修订。 */
async function importDoc(manager: LibraryManager, name = '发布规范.md', content = '# 发布规范\n\n发布前必须跑一遍门禁。\n') {
  const imported = await importLibraryText(manager, { name, content })
  return { asset: imported.asset, revision: imported.revision, content, content2: '# 发布规范（v2）\n\n发布前必须跑一遍门禁，并留痕。\n' }
}

/** 工具注册表替身（与 `library-tools.spec.ts` 同一手法：只收定义、可断言注销顺序）。 */
function toolRegistry(): { readonly runtime: EnterpriseLibraryToolRuntime, readonly definitions: EnterpriseLibraryToolDefinition[] } {
  const definitions: EnterpriseLibraryToolDefinition[] = []
  return {
    definitions,
    runtime: {
      register(definition) {
        definitions.push(definition)
        return () => { definitions.splice(definitions.indexOf(definition), 1) }
      },
    },
  }
}

function defineOf(definitions: readonly EnterpriseLibraryToolDefinition[], name: string): EnterpriseLibraryToolDefinition {
  const definition = definitions.find(candidate => candidate.name === name)
  if (definition === undefined) throw new Error(`tool ${name} is not registered`)
  return definition
}

/** 草稿对象目录：`<dshHome>/library/drafts/<draftId>`（用仓里的根常量拼，别在测试里硬写 'drafts'）。 */
function draftDirectory(home: string, draftId: string): string {
  return join(home, ...LIBRARY_DRAFTS_DIR_SEGMENTS, draftId)
}

// ───────────────────────────── ① 域层：第五张表 ─────────────────────────────

describe('草稿的域层（第五张表 drafts）', () => {
  it('① drafts 进入域规格与表 schema 表；记录形状过门禁（缺键/坏 sha/负字节数一律 library/invalid-record）', () => {
    expect(Object.keys(LIBRARY_TABLE_SCHEMAS)).toEqual(['nodes', 'assets', 'revisions', 'selections', 'drafts'])
    expect(LIBRARY_TABLE_SCHEMAS.drafts).toBe(libraryDraftSchema)

    const valid = {
      schemaVersion: 1,
      scope: 'personal',
      ownerId: 'u1001',
      id: 'dr1',
      assetId: 'as1',
      baseRevisionId: 'rv1',
      revision: 'dr2',
      contentRelativePath: 'dr1/dr2.md',
      contentSha256: 'a'.repeat(64),
      contentByteLength: 12,
      createdAt: '2026-10-03T00:00:00.000Z',
      updatedAt: '2026-10-03T00:00:00.000Z',
    }
    expect(parseLibraryRecord('drafts', valid)).toEqual(valid)
    expect(() => parseLibraryRecord('drafts', { ...valid, contentSha256: 'nope' }))
      .toThrowError(LibraryError)
    expect(() => parseLibraryRecord('drafts', { ...valid, contentByteLength: -1 })).toThrowError(LibraryError)
    const { revision: _dropped, ...missing } = valid
    expect(() => parseLibraryRecord('drafts', missing)).toThrowError(LibraryError)
  })

  it('② ★反向锁：草稿记录里**没有正文**（大正文不进 KV 记录），只有相对路径 + sha256 + 字节数三件套', () => {
    const keys = Object.keys(libraryDraftSchema.shape)
    expect(keys).toEqual([
      'schemaVersion', 'scope', 'ownerId', 'id', 'assetId', 'baseRevisionId', 'revision',
      'contentRelativePath', 'contentSha256', 'contentByteLength', 'createdAt', 'updatedAt',
    ])
    // 正文键一个都不许在（A30 的 draft 是 `content: z.string().max(8MiB)`；本仓按勘误 C 改成对象层）。
    expect(keys).not.toContain('content')
    expect(keys).toContain('contentRelativePath')
  })
})

// ───────────────────────────── ②③④ 服务：草稿生命周期 ─────────────────────────────

describe('草稿服务：创建 / 更新 / 发布', () => {
  it('③ 创建草稿：从当前修订分叉，正文落草稿对象树（0600），记录里是指向它的相对路径', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const created = await rigged.manager.createDraft({ assetId: doc.asset.id })

    expect(created.text).toBe(doc.content)
    expect(created.draft.assetId).toBe(doc.asset.id)
    expect(created.draft.baseRevisionId).toBe(doc.revision.id)
    expect(created.draft.contentByteLength).toBe(Buffer.byteLength(doc.content, 'utf8'))
    expect(created.draft.contentRelativePath).toBe(`${created.draft.id}/${created.draft.revision}.md`)

    const path = join(rigged.home, ...LIBRARY_DRAFTS_DIR_SEGMENTS, created.draft.contentRelativePath)
    expect(await readFile(path, 'utf8')).toBe(doc.content)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    // 草稿不改动正式修订：还是那一版，指针没动。
    expect((await rigged.manager.getAsset(doc.asset.id)).currentRevisionId).toBe(doc.revision.id)
    expect(await rigged.manager.listRevisions(doc.asset.id)).toHaveLength(1)
  })

  it('④ 更新草稿：换一枚 token、写新落点、删掉旧落点；token 对不上 ⇒ library/revision-conflict', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const created = await rigged.manager.createDraft({ assetId: doc.asset.id })
    const updated = await rigged.manager.updateDraft(created.draft.id, doc.content2, created.draft.revision)

    expect(updated.draft.revision).not.toBe(created.draft.revision)
    expect(updated.draft.contentByteLength).toBe(Buffer.byteLength(doc.content2, 'utf8'))
    expect(await readFile(join(rigged.home, ...LIBRARY_DRAFTS_DIR_SEGMENTS, updated.draft.contentRelativePath), 'utf8')).toBe(doc.content2)
    // 旧落点已经不可达 ⇒ 必须被删掉（否则每改一次就永久多一份垃圾）。
    await expect(stat(join(rigged.home, ...LIBRARY_DRAFTS_DIR_SEGMENTS, created.draft.contentRelativePath))).rejects.toMatchObject({ code: 'ENOENT' })
    // 旧 token 再用一次必须被拒（乐观锁：绝不静默覆盖别人的改动）。
    await expect(rigged.manager.updateDraft(created.draft.id, 'x', created.draft.revision))
      .rejects.toMatchObject({ code: 'library/revision-conflict' })
  })

  it('⑤ 发布：number = 上一版 + 1、正文冻结成新修订、资产指针移过去、**草稿记录与草稿对象一起消失**', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const created = await rigged.manager.createDraft({ assetId: doc.asset.id })
    const updated = await rigged.manager.updateDraft(created.draft.id, doc.content2, created.draft.revision)
    const published = await rigged.manager.publishDraft(updated.draft.id, updated.draft.revision)

    expect(published.number).toBe(doc.revision.number + 1)
    expect(published.conversionStatus).toBe('ready')
    expect(published.assetId).toBe(doc.asset.id)
    expect((await rigged.manager.getAsset(doc.asset.id)).currentRevisionId).toBe(published.id)
    expect(await rigged.manager.listRevisions(doc.asset.id)).toHaveLength(2)
    // 冻结：读回来的就是发布那一刻的正文（`content.md` 与记录里的 sha256/字节数三方一致）。
    const frozen = await rigged.manager.readRevisionText(doc.asset.id, published.id)
    expect(frozen.text).toBe(doc.content2)
    expect(published.contentByteLength).toBe(frozen.byteLength)
    // 草稿是发布的终点：记录没了、对象目录也没了、列表里 0 条。
    expect(await rigged.manager.listDrafts(doc.asset.id)).toEqual([])
    expect((await rigged.manager.getDraft(updated.draft.id).then(() => 'ok', error => (error as LibraryError).code)))
      .toBe('library/not-found')
    await expect(stat(draftDirectory(rigged.home, updated.draft.id))).rejects.toMatchObject({ code: 'ENOENT' })
    // 同一草稿发布第二次：草稿已不存在 ⇒ not-found（发布**不可重复**，与"修订不可覆盖"同一条纪律）。
    await expect(rigged.manager.publishDraft(updated.draft.id, updated.draft.revision))
      .rejects.toMatchObject({ code: 'library/not-found' })
  })

  it('⑥ 基准过期 ⇒ library/base-revision-conflict（分叉之后正文已有新版本，绝不把那一版盖掉）', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const created = await rigged.manager.createDraft({ assetId: doc.asset.id })
    // 别人在这中间发布了新版本（这里用 writeRevision 直接推进当前修订，等价效果）。
    await rigged.manager.writeRevision({ assetId: doc.asset.id, original: Buffer.from('# 别人的新版\n'), content: '# 别人的新版\n' })
    const stale = await rigged.manager.publishDraft(created.draft.id, created.draft.revision)
      .then(() => 'ok', error => (error as LibraryError).code)
    expect(stale).toBe('library/base-revision-conflict')
    // 草稿原样留着（不是"发了一半"）：员工可以重新创建草稿再来。
    expect(await rigged.manager.listDrafts(doc.asset.id)).toHaveLength(1)
  })

  it('⑦ 门禁三连：只允许 markdown/text（draft-format）、停用即隔离（disabled）、手动指定 baseRevisionId 也可', async () => {
    const rigged = await rig()
    const md = await importDoc(rigged.manager)
    // 手动钉一个 base（这里就是第一版）：允许，且 baseRevisionId 如实记下。
    const explicit = await rigged.manager.createDraft({ assetId: md.asset.id, baseRevisionId: md.revision.id })
    expect(explicit.draft.baseRevisionId).toBe(md.revision.id)

    // 停用：创建与发布两侧都拒（`setAssetStatus` 之后草稿仍在，但发布被拒）。
    await rigged.manager.setAssetStatus(md.asset.id, 'disabled')
    await expect(rigged.manager.createDraft({ assetId: md.asset.id }))
      .rejects.toMatchObject({ code: 'library/disabled' })
    await expect(rigged.manager.publishDraft(explicit.draft.id, explicit.draft.revision))
      .rejects.toMatchObject({ code: 'library/disabled' })
    await rigged.manager.setAssetStatus(md.asset.id, 'active')

    // 非 markdown/text：`createAsset` 允许别的格式（P0 只导入 md/txt，这里直接造一份 pdf 形状的资产）。
    const workspace = await rigged.manager.createAsset({ name: '手册.pdf', kind: 'pdf' })
    await expect(rigged.manager.createDraft({ assetId: workspace.id }))
      .rejects.toMatchObject({ code: 'library/draft-format' })
  })

  it('⑧ 草稿正文 8 MiB 上限（library/file-too-large）；列表按最近改动在前', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const first = await rigged.manager.createDraft({ assetId: doc.asset.id })
    const second = await rigged.manager.createDraft({ assetId: doc.asset.id })
    const tooBig = 'x'.repeat(8 * 1024 * 1024 + 1)
    await expect(rigged.manager.updateDraft(first.draft.id, tooBig, first.draft.revision))
      .rejects.toMatchObject({ code: 'library/file-too-large' })
    // 被拒的更新**零副作用**：旧 token 依然有效、旧正文一字未动。
    expect((await rigged.manager.getDraft(first.draft.id)).revision).toBe(first.draft.revision)
    const after = await rigged.manager.updateDraft(first.draft.id, '改一下', first.draft.revision)
    // 最近改动在前（second 先建、first 后改）⇒ first 排前面。
    const listed = await rigged.manager.listDrafts(doc.asset.id)
    expect(listed.map(draft => draft.id)).toEqual([after.draft.id, second.draft.id])
    expect(listed.map(draft => draft.contentByteLength)).toEqual([Buffer.byteLength('改一下', 'utf8'), Buffer.byteLength(doc.content, 'utf8')])
  })

  it('⑨ 级联删除：删掉资产 ⇒ 草稿记录与草稿对象一起清掉（§4.4 C11 的"…/修订/回执/草稿"）', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const created = await rigged.manager.createDraft({ assetId: doc.asset.id })
    await rigged.manager.removeAsset(doc.asset.id)
    expect(await rigged.manager.listDrafts()).toEqual([])
    await expect(stat(draftDirectory(rigged.home, created.draft.id))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('⑩ ★修订只能新建、绝不覆盖：`manager.ts` 里没有对 revisions 表的 update（源码级反向锁）', async () => {
    const source = await readFile(new URL('../src/library/manager.ts', import.meta.url), 'utf8')
    expect(source.includes('this.revisions.update(')).toBe(false)
    expect(source.includes("this.revisions.put(")).toBe(true)
    // 对象层同样：不可变原件的二次写入由对象层自己拒（这里只锁"服务层没有覆盖路径"）。
    const objects = await readFile(new URL('../src/library/objects.ts', import.meta.url), 'utf8')
    expect(objects.includes('revision-immutable')).toBe(true)
  })
})

// ───────────────────────────── ③ HTTP 面：3 个 endpoint ─────────────────────────────

describe('草稿的 HTTP 面（真 HTTP）', () => {
  async function harnessOf(rigged: LibraryTestRig): Promise<LibraryRouteHarness> {
    const harness = await createLibraryRouteHarness({ manager: () => rigged.manager })
    harnesses.push(harness)
    return harness
  }

  it('⑪ create-draft / update-draft / publish-draft 三条走通；出网形状里**没有正文**（正文只走 read-text）', async () => {
    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const harness = await harnessOf(rigged)

    const created = await harness.post('/library', { endpoint: 'create-draft', payload: { assetId: doc.asset.id } })
    expect(created.status).toBe(200)
    const createdBody = await created.json() as { data: { draft: Record<string, unknown>, content: string } }
    expect(Object.keys(createdBody.data.draft).sort()).toEqual([
      'assetId', 'baseRevisionId', 'contentByteLength', 'createdAt', 'id', 'revision', 'updatedAt',
    ])
    expect(createdBody.data.content).toBe(doc.content)

    const draftId = String(createdBody.data.draft['id'])
    const token = String(createdBody.data.draft['revision'])
    const updated = await harness.post('/library', { endpoint: 'update-draft', payload: { draftId, content: doc.content2, expectedRevision: token } })
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json() as { data: { draft: Record<string, unknown> } }
    const nextToken = String(updatedBody.data.draft['revision'])
    expect(nextToken).not.toBe(token)

    const published = await harness.post('/library', { endpoint: 'publish-draft', payload: { draftId, expectedRevision: nextToken } })
    expect(published.status).toBe(200)
    const publishedBody = await published.json() as { data: { assetId: string, revision: Record<string, unknown> } }
    expect(publishedBody.data.assetId).toBe(doc.asset.id)
    expect(publishedBody.data.revision['number']).toBe(2)
    expect(publishedBody.data.revision['conversionStatus']).toBe('ready')
    expect(Object.keys(publishedBody.data.revision)).not.toContain('content')

    // 发布之后 `read-text` 读回的就是冻结正文。
    const read = await harness.post('/library', { endpoint: 'read-text', payload: { assetId: doc.asset.id } })
    expect(((await read.json()) as { data: { content: string } }).data.content).toBe(doc.content2)
  })

  it('⑫ 两条冲突各自一枚 ENT 码并投影 409；形状不全 ⇒ 400', async () => {
    expect(projectLibraryFailure(new LibraryError('library/revision-conflict', 'x')))
      .toEqual({ status: 409, code: 'ENT_LIBRARY_REVISION_CONFLICT' })
    expect(projectLibraryFailure(new LibraryError('library/base-revision-conflict', 'x')))
      .toEqual({ status: 409, code: 'ENT_LIBRARY_BASE_REVISION_CONFLICT' })
    expect(projectLibraryFailure(new LibraryError('library/draft-format', 'x')))
      .toEqual({ status: 400, code: 'ENT_INVALID_REQUEST' })

    const rigged = await rig()
    const doc = await importDoc(rigged.manager)
    const harness = await harnessOf(rigged)
    const created = await harness.post('/library', { endpoint: 'create-draft', payload: { assetId: doc.asset.id } })
    const draftId = String(((await created.json()) as { data: { draft: { id: string } } }).data.draft.id)

    const badToken = await harness.post('/library', { endpoint: 'update-draft', payload: { draftId, content: 'x', expectedRevision: 'nope' } })
    expect(badToken.status).toBe(409)
    expect((await badToken.json()) as { error: { code: string } }).toEqual({ error: { code: 'ENT_LIBRARY_REVISION_CONFLICT' } })

    const missing = await harness.post('/library', { endpoint: 'update-draft', payload: { draftId, content: 'x' } })
    expect(missing.status).toBe(400)
    expect((await missing.json()) as { error: { code: string } }).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })

    const unknown = await harness.post('/library', { endpoint: 'no-such-endpoint', payload: {} })
    expect(unknown.status).toBe(400)
  })
})

// ───────────────────────────── ④ 工具面：3 个草稿工具 + 确认门闩 ─────────────────────────────

describe('草稿的模型面（3 个工具 + user_confirmed 门闩）', () => {
  async function toolRig(): Promise<{ readonly rigged: LibraryTestRig, readonly definitions: readonly EnterpriseLibraryToolDefinition[] }> {
    const rigged = await rig()
    const registry = toolRegistry()
    registerEnterpriseLibraryTools(registry.runtime, { manager: () => rigged.manager })
    return { rigged, definitions: registry.definitions }
  }

  it('⑬ 工具名与参数名逐字（E1/F6）：create{asset_id,base_revision_id} · update{draft_id,content,expected_revision} · publish{draft_id,expected_revision,user_confirmed}', async () => {
    const { definitions } = await toolRig()
    expect(ENTERPRISE_LIBRARY_TOOL_NAMES).toEqual([
      'library_search', 'library_read', 'library_save_markdown',
      'library_create_draft', 'library_update_draft', 'library_publish_revision',
    ])
    expect(definitions.map(definition => definition.name)).toEqual([...ENTERPRISE_LIBRARY_TOOL_NAMES])

    const create = defineOf(definitions, 'library_create_draft')
    // ★ 根必须是对象型（官方 DeepSeek 严格校验：type:null 会拒掉整条请求）。
    expect(create.parameters['type']).toBe('object')
    const createProps = create.parameters['properties'] as Record<string, unknown>
    expect(Object.keys(createProps)).toEqual(['asset_id', 'base_revision_id'])
    expect(create.parameters['required']).toEqual(['asset_id'])
    expect((createProps['asset_id'] as { type?: string }).type).toBe('string')
    expect(Object.keys(create.output.schema['properties'] as Record<string, unknown>))
      .toEqual(['draft_id', 'asset_id', 'base_revision_id', 'revision', 'content'])

    const update = defineOf(definitions, 'library_update_draft')
    expect(Object.keys(update.parameters['properties'] as Record<string, unknown>)).toEqual(['draft_id', 'content', 'expected_revision'])
    expect(Object.keys(update.output.schema['properties'] as Record<string, unknown>))
      .toEqual(['draft_id', 'revision', 'updated_at'])

    const publish = defineOf(definitions, 'library_publish_revision')
    const publishProps = publish.parameters['properties'] as Record<string, unknown>
    expect(Object.keys(publishProps)).toEqual(['draft_id', 'expected_revision', 'user_confirmed'])
    expect(publish.parameters['required']).toEqual(['draft_id', 'expected_revision', 'user_confirmed'])
    expect(publishProps['user_confirmed']).toMatchObject({ type: 'boolean' })
    expect(Object.keys(publish.output.schema['properties'] as Record<string, unknown>))
      .toEqual(['asset_id', 'revision_id', 'revision_number', 'name'])
    // 描述里的两条硬口径：不许自行确认 + 不是工作区文件系统（防误用/防注入，E2）。
    expect(publish.description).toContain('不许')
    expect(publish.description).toContain('user_confirmed')
    expect(create.description).toContain('工作区文件系统')
    expect(update.description).toContain('不是工作区文件');
    for (const definition of [create, update, publish]) {
      expect(definition.output.schema['additionalProperties']).toBe(false)
    }
  })

  it('⑭ ★缺 user_confirmed ⇒ library/user-confirmation-required，且**零副作用**（草稿还在、没有新修订）', async () => {
    const { rigged, definitions } = await toolRig()
    const doc = await importDoc(rigged.manager)
    const create = defineOf(definitions, 'library_create_draft')
    const created = await create.execute({ asset_id: doc.asset.id }, { agent: { id: 'session-draft' } }) as { draft_id: string, revision: string, content: string }
    expect(created.content).toBe(doc.content)

    const publish = defineOf(definitions, 'library_publish_revision')
    for (const value of [undefined, false]) {
      await expect(publish.execute({ draft_id: created.draft_id, expected_revision: created.revision, user_confirmed: value }, { agent: { id: 'session-draft' } }))
        .rejects.toMatchObject({ code: 'library/user-confirmation-required' })
    }
    expect(await rigged.manager.listRevisions(doc.asset.id)).toHaveLength(1)
    expect(await rigged.manager.listDrafts(doc.asset.id)).toHaveLength(1)
  })

  it('⑮ 确认后发布成功：输出字段逐字（asset_id/revision_id/revision_number/name），且 `library_read` 读回冻结正文', async () => {
    const { rigged, definitions } = await toolRig()
    const doc = await importDoc(rigged.manager)
    const created = await defineOf(definitions, 'library_create_draft').execute(
      { asset_id: doc.asset.id }, { agent: { id: 'session-e2e' } },
    ) as { draft_id: string, revision: string }
    const updated = await defineOf(definitions, 'library_update_draft').execute(
      { draft_id: created.draft_id, content: doc.content2, expected_revision: created.revision },
      { agent: { id: 'session-e2e' } },
    ) as { revision: string, updated_at: string }
    expect(updated.updated_at).toBe((await rigged.manager.getDraft(created.draft_id)).updatedAt)

    const published = await defineOf(definitions, 'library_publish_revision').execute(
      { draft_id: created.draft_id, expected_revision: updated.revision, user_confirmed: true },
      { agent: { id: 'session-e2e' } },
    ) as Record<string, unknown>
    expect(Object.keys(published).sort()).toEqual(['asset_id', 'name', 'revision_id', 'revision_number'])
    expect(published['name']).toBe(doc.asset.name)
    expect(published['revision_number']).toBe(2)

    // 端到端收口：把这份资料加入会话 ⇒ `library_read` 读回的是发布那一刻的正文（冻结）。
    await rigged.manager.setSelection('session-e2e', [(await rigged.manager.listAllNodes()).find(node => node.assetId === doc.asset.id)!.id])
    const read = await defineOf(definitions, 'library_read').execute(
      { asset_id: doc.asset.id }, { agent: { id: 'session-e2e' } },
    ) as { content: string, revision_id: string }
    expect(read.revision_id).toBe(String(published['revision_id']))
    expect(read.content).toBe(doc.content2)
  })
})

// ───────────────────────────── ⑤ 域层落盘：草稿记录跨重启 ─────────────────────────────

describe('草稿记录的持久化（per-record 信封）', () => {
  it('⑯ 草稿记录按 `<域>/drafts/<key>.json` 落盘、跨"重启"（重新 open）读回同一条', async () => {
    const home = await makeHome()
    const persistRoot = join(home, 'storages')
    const first = await createLibraryTestRig({
      home,
      manager: { newId: sequentialIds() },
      domain: await createInMemoryLibraryDomainWithRoot(persistRoot),
    })
    const doc = await importDoc(first.manager)
    const created = await first.manager.createDraft({ assetId: doc.asset.id })

    const reopened = await createInMemoryLibraryDomainWithRoot(persistRoot)
    const second = new LibraryManager({
      domain: reopened as unknown as LibraryDomainPort,
      objects: first.objects,
      subject: { scope: 'personal', ownerId: 'u1001' },
    })
    const reloaded = await second.getDraft(created.draft.id)
    expect(reloaded).toEqual(created.draft)
    // 记录里**不含正文**：盘上那份 JSON 里也找不到正文（只找得到相对路径与 sha256）。
    const raw = await readFile(join(persistRoot, 'dshent_library', 'drafts', `${keyOfDraft(reloaded)}.json`), 'utf8')
    expect(raw).toContain('contentRelativePath')
    expect(raw).not.toContain(doc.content.replace(/\n/gu, '\\n'))
  })
})

/** 草稿记录键（测试自己按仓内规约拼一遍：`<scope>_<ownerId>_<id>` 的归一化形态）。 */
function keyOfDraft(draft: LibraryDraftRecord): string {
  return `personal_u1001_${draft.id}`
}

/** 带落盘根的假域（与 `library-support.ts` 的 `createInMemoryLibraryDomain` 同源，只是显式传 `persistRoot`）。 */
async function createInMemoryLibraryDomainWithRoot(persistRoot: string) {
  return await createInMemoryLibraryDomain({ persistRoot })
}
