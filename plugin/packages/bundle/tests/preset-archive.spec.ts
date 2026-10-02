/**
 * [INPUT]: 依赖同目录手写 ZIP 构造器 `zip-fixture.ts`、src/preset-archive.ts 的解码器、核心合成段（只用于"容器→核心"那条缝）与核心的稳定码
 * [OUTPUT]: 锁定 `.dshpreset` 布局判定——合规包出 `PresetRecipe`（`yml` 优先、`.yaml` 回落）、根之外路径/缺 `manifest.json`/缺 `preset/agent.cordis.yml`/空正文/manifest 形状非法一律 `ENT_PRESET_RECIPE_INVALID`、**可选的 `preset/preset.yml`** 只按官方显示元数据口径抄事实（未知键/坏值/读不成一律降级为没有元数据，绝不因此拒包）、且**容器层失败**（CRC、加密、ZIP64、符号链接）也被翻成同一个稳定码（`cause` 保留共享内核的 `ZipArchiveError`）
 * [POS]: 配方纵深「制品解包边界」门禁。ZIP 容器层本身由 `skill-archive.spec.ts` 用同一批畸形包覆盖（同一条共享内核）；本文件只证**配方布局**那把尺，以及两种包格式共用内核这件事没有把技能的错误码漏进配方族
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import { ZipArchiveError } from '../src/zip-archive.js'
import { decodeDshPresetArchive, PRESET_AGENT_YML_MAX_BYTES } from '../src/preset-archive.js'
import { renderPresetBundle } from '../src/preset/index.js'
import { buildZip, type ZipFixtureEntry } from './zip-fixture.js'

const AGENT_YML = `- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: You are the enterprise onboarding assistant.
`

function manifestJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: 'dsh-preset',
    version: '1',
    id: 'ent-demo',
    name: '企业配方演示',
    description: '演示用的企业配方。',
    order: 60,
    sourceDshVersion: '0.2.0-rc.2',
    ...overrides,
  })
}

/** 合规包：根 `manifest.json` + `preset/agent.cordis.yml`（+ 可选额外条目）。 */
function presetZip(
  entries: readonly ZipFixtureEntry[] = [],
  manifest: string = manifestJson(),
): Buffer {
  return buildZip([
    { content: manifest, path: 'manifest.json' },
    { content: AGENT_YML, path: 'preset/agent.cordis.yml' },
    ...entries,
  ])
}

describe('decodeDshPresetArchive', () => {
  it('解出预设配方：id/name/description/order 与正文逐字', () => {
    const archive = decodeDshPresetArchive(presetZip())
    expect(archive.presetId).toBe('ent-demo')
    expect(archive.agentYmlPath).toBe('preset/agent.cordis.yml')
    expect(archive.recipe).toEqual({
      manifest: { id: 'ent-demo', name: '企业配方演示', description: '演示用的企业配方。', order: 60 },
      agentCordisYml: AGENT_YML,
    })
  })

  it('缺省的描述与 order 不进 manifest（不伪造字段）', () => {
    const manifest = JSON.stringify({ format: 'dsh-preset', version: '1', id: 'ent-demo', name: '演示' })
    const archive = decodeDshPresetArchive(presetZip([], manifest))
    expect(archive.recipe.manifest).toEqual({ id: 'ent-demo', name: '演示' })
  })

  it('`.yaml` 是合法回落；两条都在时优先 `.yml`', () => {
    const onlyYaml = buildZip([
      { content: manifestJson(), path: 'manifest.json' },
      { content: AGENT_YML, path: 'preset/agent.cordis.yaml' },
    ])
    expect(decodeDshPresetArchive(onlyYaml).agentYmlPath).toBe('preset/agent.cordis.yaml')

    const both = presetZip([{ content: '- id: other\n', path: 'preset/agent.cordis.yaml' }])
    const archive = decodeDshPresetArchive(both)
    expect(archive.agentYmlPath).toBe('preset/agent.cordis.yml')
    expect(archive.recipe.agentCordisYml).toBe(AGENT_YML)
  })

  it('忽略 `preset/` 下的规则文件，但不允许根与 preset/ 之外的任何条目', () => {
    const withRules = presetZip([
      { content: '# 规则\n', path: 'preset/CLAUDE.md' },
      { content: 'zip 目录条目', path: 'preset/' },
    ])
    expect(decodeDshPresetArchive(withRules).recipe.manifest.id).toBe('ent-demo')

    for (const path of ['AGENTS.md', 'other/thing.txt', 'preset/../escape.txt']) {
      expect(() => decodeDshPresetArchive(presetZip([{ content: 'x', path }])), path)
        .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))
    }
  })

  it('缺 manifest.json / 不是 dsh-preset v1 / 字段形状非法一律拒', () => {
    const withoutManifest = buildZip([{ content: AGENT_YML, path: 'preset/agent.cordis.yml' }])
    expect(() => decodeDshPresetArchive(withoutManifest))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))

    for (const manifest of [
      'not json',
      JSON.stringify([]),
      JSON.stringify({ format: 'dsh-skill', version: '1', id: 'ent-demo', name: 'x' }),
      JSON.stringify({ format: 'dsh-preset', version: 1, id: 'ent-demo', name: 'x' }),
      JSON.stringify({ format: 'dsh-preset', version: '1', id: '-bad', name: 'x' }),
      JSON.stringify({ format: 'dsh-preset', version: '1', id: 'ent-demo', name: '' }),
      JSON.stringify({ format: 'dsh-preset', version: '1', id: 'ent-demo', name: 'x', description: 3 }),
      JSON.stringify({ format: 'dsh-preset', version: '1', id: 'ent-demo', name: 'x', order: -1 }),
      JSON.stringify({ format: 'dsh-preset', version: '1', id: 'ent-demo', name: 'x', order: 1.5 }),
    ]) {
      expect(() => decodeDshPresetArchive(presetZip([], manifest)), manifest)
        .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))
    }
  })

  it('缺配方正文 / 空正文 / 超上限正文一律拒', () => {
    const withoutAgent = buildZip([{ content: manifestJson(), path: 'manifest.json' }])
    expect(() => decodeDshPresetArchive(withoutAgent))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))

    const empty = buildZip([
      { content: manifestJson(), path: 'manifest.json' },
      { content: Buffer.alloc(0), path: 'preset/agent.cordis.yml' },
    ])
    expect(() => decodeDshPresetArchive(empty))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))

    const oversized = buildZip([
      { content: manifestJson(), path: 'manifest.json' },
      { content: Buffer.alloc(PRESET_AGENT_YML_MAX_BYTES + 1, 0x61), path: 'preset/agent.cordis.yml' },
    ])
    expect(() => decodeDshPresetArchive(oversized))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))
  })

  it('包内 preset/preset.yml 只按官方显示元数据口径抄事实：未知键忽略、读不成就是没有元数据', () => {
    const withMetadata = presetZip([{
      content: 'name: 手机操控\ndescription: 官方元数据说明\norder: 50\nversion: 1\nid: ent-demo\nunknown: x\n',
      path: 'preset/preset.yml',
    }])
    // 只按名取 name/description/order/id；`version` 与未知键既不是官方元数据键、也不是我们的口径 ⇒ 不进事实。
    expect(decodeDshPresetArchive(withMetadata).recipe.localMetadata)
      .toEqual({ id: 'ent-demo', name: '手机操控', description: '官方元数据说明', order: 50 })

    // 官方口径「Every read failure degrades to no metadata」：畸形元数据只降级，绝不因此拒一份合法配方。
    for (const content of ['43\n', '- a\n- b\n', 'order: 1.5\n', 'name: [flow]\n', 'name:\n  缩进块\n']) {
      expect(decodeDshPresetArchive(presetZip([{ content, path: 'preset/preset.yml' }])).recipe.localMetadata,
        JSON.stringify(content)).toBeUndefined()
    }
  })

  it('preset/preset.yml 与 manifest 的 id 打架：解包照抄、合成 fail-closed（同一份制品不许两个身份）', () => {
    const archive = decodeDshPresetArchive(presetZip([{ content: 'id: other-preset\n', path: 'preset/preset.yml' }]))
    expect(archive.recipe.localMetadata).toEqual({ id: 'other-preset' })
    expect(() => renderPresetBundle(archive.recipe))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))
  })

  it('容器层失败翻成配方族的同一枚码，cause 里保留共享内核的错误', () => {
    // CRC 不符 / 加密位 / ZIP64 locator：三种都在共享内核里被拒（技能侧同一批包由 skill-archive.spec 覆盖）。
    const badCrc = buildZip([
      { content: manifestJson(), path: 'manifest.json' },
      { content: AGENT_YML, crc: 0, path: 'preset/agent.cordis.yml' },
    ])
    const error = (() => {
      try {
        decodeDshPresetArchive(badCrc)
        return undefined
      } catch (thrown) {
        return thrown as Error & { code?: string, cause?: unknown }
      }
    })()
    expect(error?.code).toBe('ENT_PRESET_RECIPE_INVALID')
    expect(error?.cause).toBeInstanceOf(ZipArchiveError)

    const encrypted = buildZip([{ content: manifestJson(), flags: 0x0001, path: 'manifest.json' }])
    expect(() => decodeDshPresetArchive(encrypted))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))

    const zip64 = buildZip([{ content: manifestJson(), path: 'manifest.json' }], { zip64Locator: true })
    expect(() => decodeDshPresetArchive(zip64))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))

    // 符号链接条目（Unix 生产者的 S_IFLNK）：共享内核拒，配方族拿到同一个稳定码。
    const symlink = buildZip([
      { content: manifestJson(), path: 'manifest.json' },
      { content: AGENT_YML, path: 'preset/agent.cordis.yml' },
      { content: '/etc/passwd', path: 'preset/link', unixMode: 0o120777 },
    ])
    expect(() => decodeDshPresetArchive(symlink))
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))
  })
})
