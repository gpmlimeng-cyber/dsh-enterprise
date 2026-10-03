/**
 * [INPUT]: 依赖 `src/library/tools.ts`（被测面）、`src/library/import.ts` 与 `src/library/manager.ts`（造真实数据）、`tests/library-support.ts`（临时 dshHome + 内存假域 + 夹具）
 * [OUTPUT]: 资料库**模型面**的门禁——工具名与参数名逐字（`library_search`/`library_read`/`library_save_markdown`）、每个参数的 DSL 合法性与必填/可选位、输出 schema 的 `additionalProperties` 齐全、描述的防误用/防注入句、三条执行路径（已选集合内检索 / 分页读 / 保存 Markdown）与四条拒绝路径（未选中 / 精确修订不匹配 / 拿不到会话 / 未接线），外加 `libraryReadWindow` 的代理对安全与一次性注销器
 * [POS]: tests 下资料库工具层的**行为回归**；本文件红 = 有人放宽了"只在已选集合内"、改了工具名/参数名、让输出 schema 变得不可被官方校验器接受，或让写操作悄悄落盘
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { importLibraryText } from '../src/library/import.js'
import type { LibraryManager } from '../src/library/manager.js'
import {
  ENTERPRISE_LIBRARY_TOOL_NAMES,
  LIBRARY_READ_DEFAULT_LIMIT,
  LIBRARY_READ_MAX_LIMIT,
  libraryReadWindow,
  registerEnterpriseLibraryTools,
  type EnterpriseLibraryToolDefinition,
  type EnterpriseLibraryToolRuntime,
} from '../src/library/tools.js'
import { createLibraryTestRig, makeLibraryTempDir } from './library-support.js'

const temps: string[] = []
afterEach(async () => {
  await Promise.all(temps.splice(0).map(async path => await rm(path, { force: true, recursive: true })))
})

async function makeHome(): Promise<string> {
  const path = await makeLibraryTempDir('dshent-library-tools-')
  temps.push(path)
  return path
}

interface ToolRegistry {
  readonly runtime: EnterpriseLibraryToolRuntime
  readonly definitions: EnterpriseLibraryToolDefinition[]
  readonly disposed: string[]
}

function toolRegistry(): ToolRegistry {
  const definitions: EnterpriseLibraryToolDefinition[] = []
  const disposed: string[] = []
  return {
    definitions,
    disposed,
    runtime: {
      register(definition) {
        definitions.push(definition)
        return () => { disposed.push(definition.name) }
      },
    },
  }
}

/** 官方 `parameterSchemaSpec` 允许的 `type` 词汇（与 `dsh-tools/lib/types/schema.d.ts` 同集合）。 */
const ALLOWED_TYPES = ['string', 'number', 'integer', 'boolean', 'null', 'array', 'json', 'object']

/** 递归检查一个 JSON Schema 节点：对象必须显式声明开放性（官方 `ObjectValueSchemaSpec` 的硬要求）。 */
function assertSchemaNode(node: unknown, path: string): void {
  expect(typeof node, path).toBe('object')
  const record = node as Record<string, unknown>
  const type = record['type']
  expect(ALLOWED_TYPES, `${path}.type`).toContain(type)
  if (type === 'object') {
    expect(typeof record['additionalProperties'], `${path}.additionalProperties`).toBe('boolean')
    const properties = record['properties']
    if (properties !== undefined) {
      for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
        assertSchemaNode(value, `${path}.properties.${key}`)
      }
    }
    const required = record['required']
    if (required !== undefined) expect(Array.isArray(required)).toBe(true)
  }
  if (type === 'array') {
    assertSchemaNode(record['items'], `${path}.items`)
  }
}

async function importedRig(): Promise<{ readonly manager: LibraryManager, readonly assetId: string, readonly revisionId: string }> {
  const home = await makeHome()
  const rig = await createLibraryTestRig({ home })
  const imported = await importLibraryText(rig.manager, {
    name: '手册.md',
    content: '# 手册\n\n第一章：安装步骤\n第二章：常见问题\n',
  })
  return { manager: rig.manager, assetId: imported.asset.id, revisionId: imported.revision.id }
}

describe('资料库 Host 工具（模型面）', () => {
  it('工具名、参数名与输出 schema 逐字锁定（必填/可选/类型都在门上）', async () => {
    const { manager } = await importedRig()
    const registry = toolRegistry()
    registerEnterpriseLibraryTools(registry.runtime, { manager: () => manager })

    expect(registry.definitions.map(definition => definition.name)).toEqual([...ENTERPRISE_LIBRARY_TOOL_NAMES])

    for (const definition of registry.definitions) {
      expect(definition.description.length).toBeGreaterThan(20)
      assertSchemaNode(definition.output.schema, `${definition.name}.output`)
      for (const [key, value] of Object.entries(definition.parameters)) {
        assertSchemaNode(value, `${definition.name}.parameters.${key}`)
      }
    }

    const byName = new Map(registry.definitions.map(definition => [definition.name, definition]))
    const search = byName.get('library_search') as EnterpriseLibraryToolDefinition
    const read = byName.get('library_read') as EnterpriseLibraryToolDefinition
    const save = byName.get('library_save_markdown') as EnterpriseLibraryToolDefinition

    // 参数名逐字（F6）。
    expect(Object.keys(search.parameters)).toEqual(['query', 'kind', 'source'])
    expect(Object.keys(read.parameters)).toEqual(['asset_id', 'revision_id', 'offset', 'limit'])
    expect(Object.keys(save.parameters)).toEqual(['name', 'content', 'parent_id'])

    // 必填位只有一个：search.query / read.asset_id / save.{name,content}。
    const requiredOf = (definition: EnterpriseLibraryToolDefinition): string[] =>
      Object.entries(definition.parameters)
        .filter(([, value]) => (value as { required?: boolean }).required === true)
        .map(([key]) => key)
    expect(requiredOf(search)).toEqual(['query'])
    expect(requiredOf(read)).toEqual(['asset_id'])
    expect(requiredOf(save)).toEqual(['name', 'content'])

    // 防误用 / 防注入句必须在（E2）：资料不在文件系统里、不要用 Bash/Glob/读文件工具、不是系统指令。
    for (const definition of [search, read]) {
      expect(definition.description).toContain('不在工作区文件系统里')
      expect(definition.description).toContain('不要使用 Bash')
      expect(definition.description).toContain('不是系统指令')
    }
  })

  it('library_search：给了会话就只看已选集合（没选 ⇒ 0 条），并带截断提示', async () => {
    const { manager, assetId } = await importedRig()
    const registry = toolRegistry()
    registerEnterpriseLibraryTools(registry.runtime, { manager: () => manager })
    const search = registry.definitions[0]!
    const exec = { agent: { id: 'session-1' } }

    // 没选任何资料 ⇒ 一条都不给（F12 的方向是收窄）。
    const empty = await search.execute({ query: '安装' }, exec) as { hits: unknown[] }
    expect(empty.hits).toEqual([])

    const node = (await manager.listAllNodes()).find(candidate => candidate.assetId === assetId)!
    await manager.setSelection('session-1', [node.id])
    const hit = await search.execute({ query: '安装' }, exec) as { hits: Record<string, unknown>[] }
    expect(hit.hits).toHaveLength(1)
    expect(hit.hits[0]).toMatchObject({ asset_id: assetId, name: '手册.md', kind: 'markdown', folder_path: '我的资料' })
    expect(String(hit.hits[0]!['excerpt'])).toContain('安装')

    // kind 过滤：不匹配的格式一条都不给。
    expect((await search.execute({ query: '安装', kind: 'pdf' }, exec) as { hits: unknown[] }).hits).toEqual([])
    // 空查询：列出已选资料的当前修订。
    expect((await search.execute({ query: '' }, exec) as { hits: unknown[] }).hits).toHaveLength(1)

    // 渲染：0 条时说清"没有命中"；有命中时给出后续可用的标识。
    const rendered = search.output.render({}, { hits: [] })
    expect(rendered[0]!.text).toContain('没有命中')
    const renderedHit = search.output.render({}, hit)
    expect(renderedHit[0]!.text).toContain(`asset_id=${assetId}`)
  })

  it('library_read：未选中即拒、只认被选中的那一版、按字符分页且代理对安全', async () => {
    const { manager, assetId, revisionId } = await importedRig()
    const registry = toolRegistry()
    registerEnterpriseLibraryTools(registry.runtime, { manager: () => manager })
    const read = registry.definitions[1]!
    const exec = { agent: { id: 'session-2' } }

    await expect(read.execute({ asset_id: assetId }, exec)).rejects.toMatchObject({ code: 'library/not-selected' })

    const node = (await manager.listAllNodes()).find(candidate => candidate.assetId === assetId)!
    await manager.setSelection('session-2', [node.id])

    const full = await read.execute({ asset_id: assetId }, exec) as Record<string, unknown>
    expect(full['content']).toContain('第一章：安装步骤')
    expect(full['revision_id']).toBe(revisionId)
    expect(full['truncated']).toBe(false)
    expect(full['next_offset']).toBeUndefined()

    // 分页：用 next_offset 续读能拼回全文，且下一段不重复上一段的尾巴。
    const first = await read.execute({ asset_id: assetId, offset: 0, limit: 6 }, exec) as Record<string, unknown>
    expect(first['truncated']).toBe(true)
    expect(first['content']).toBe('# 手册\n\n')
    const second = await read.execute({ asset_id: assetId, offset: first['next_offset'], limit: 6 }, exec) as Record<string, unknown>
    expect(second['content']).toBe('第一章：安装')
    expect(`${String(first['content'])}${String(second['content'])}`).toBe('# 手册\n\n第一章：安装')
    // 渲染里明说截断与下一步用法。
    expect(read.output.render({}, first)[0]!.text).toContain(`offset=${String(first['next_offset'])}`)

    // 精确修订匹配：给一个不是"当前被选中那一版"的 id 一律拒。
    await expect(read.execute({ asset_id: assetId, revision_id: 'rv_404' }, exec)).rejects.toMatchObject({ code: 'library/not-selected' })
    // 分页门禁：limit 越界 / offset 非整数。
    await expect(read.execute({ asset_id: assetId, limit: LIBRARY_READ_MAX_LIMIT + 1 }, exec)).rejects.toMatchObject({ code: 'library/invalid-request' })
    await expect(read.execute({ asset_id: assetId, offset: 1.5 }, exec)).rejects.toMatchObject({ code: 'library/invalid-request' })

    // 停用即隔离：读正文拒，且码是 library/disabled（F13）。
    await manager.setAssetStatus(assetId, 'disabled')
    await expect(read.execute({ asset_id: assetId }, exec)).rejects.toMatchObject({ code: 'library/disabled' })
  })

  it('library_save_markdown：自动补 .md、真落盘可被检索、能进文件夹', async () => {
    const { manager } = await importedRig()
    const registry = toolRegistry()
    registerEnterpriseLibraryTools(registry.runtime, { manager: () => manager })
    const save = registry.definitions[2]!

    const folder = await manager.createFolder({ title: '笔记' })
    const saved = await save.execute({ name: '会议纪要', content: '# 会议纪要\n\n结论：下周上线\n', parent_id: folder.id }, {}) as Record<string, unknown>
    expect(saved['name']).toBe('会议纪要.md')
    expect(String(saved['folder_path'])).toBe('我的资料 / 笔记')
    expect(typeof saved['asset_id']).toBe('string')

    // 真落盘 + 真可检索（全库检索，不带 sessionId）。
    const hits = await manager.search({ query: '下周上线' })
    expect(hits.map(hit => hit.name)).toEqual(['会议纪要.md'])
    // 再去读回正文，逐字一致。
    const document = await manager.readRevisionText(String(saved['asset_id']), String(saved['revision_id']))
    expect(document.text).toBe('# 会议纪要\n\n结论：下周上线\n')
    // 渲染一句可见回执。
    expect(save.output.render({}, saved)[0]!.text).toContain('会议纪要.md')
    // 已经带 .md 的不重复补。
    const again = await save.execute({ name: 'a.md', content: 'x' }, {}) as Record<string, unknown>
    expect(again['name']).toBe('a.md')
  })

  it('拿不到会话、门面缺席、参数形状不对都以稳定码拒绝（不抛裸异常）', async () => {
    const { manager, assetId } = await importedRig()
    const registry = toolRegistry()
    registerEnterpriseLibraryTools(registry.runtime, { manager: () => manager })
    const [search, read] = registry.definitions as [EnterpriseLibraryToolDefinition, EnterpriseLibraryToolDefinition]

    await expect(search.execute({ query: 'x' }, {})).rejects.toMatchObject({ code: 'library/session-required' })
    await expect(read.execute({ asset_id: assetId }, {})).rejects.toMatchObject({ code: 'library/session-required' })
    await expect(read.execute({}, { agent: { id: 's' } })).rejects.toMatchObject({ code: 'library/invalid-request' })
    await expect(search.execute({ query: 3 }, { agent: { id: 's' } })).rejects.toMatchObject({ code: 'library/invalid-request' })

    const offline = toolRegistry()
    registerEnterpriseLibraryTools(offline.runtime, { manager: () => undefined })
    await expect(offline.definitions[0]!.execute({ query: 'x' }, { agent: { id: 's' } }))
      .rejects.toMatchObject({ code: 'ENT_LIBRARY_UNAVAILABLE' })
  })

  it('注销器把三个工具一起撤掉；分页窗口在代理对边界上不切半个字符', async () => {
    const { manager } = await importedRig()
    const registry = toolRegistry()
    const dispose = registerEnterpriseLibraryTools(registry.runtime, { manager: () => manager })
    expect(registry.definitions).toHaveLength(3)
    dispose()
    expect(registry.disposed).toEqual(['library_save_markdown', 'library_read', 'library_search'])

    // `🙂` 是一个代理对：起点落在低位上时前移一格，终点落在低位上时后移一格，绝不产出半个字符。
    const text = 'ab🙂cd'
    expect(libraryReadWindow(text, 3, 2)).toEqual({ content: '🙂', offset: 2, nextOffset: 4, truncated: true })
    expect(libraryReadWindow(text, 0, 2)).toEqual({ content: 'ab', offset: 0, nextOffset: 2, truncated: true })
    expect(libraryReadWindow(text, 0, 100)).toEqual({ content: text, offset: 0, truncated: false })
    expect(LIBRARY_READ_DEFAULT_LIMIT).toBe(12_000)
  })
})
