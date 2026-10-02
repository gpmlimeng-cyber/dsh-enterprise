/**
 * [INPUT]: 依赖 node:fs/promises/node:path、vitest，以及 src/preset 的合成段与 tests/preset-support 夹具
 * [OUTPUT]: 锁定最小 bundle 的两个文件**逐字节**形状（含 spike §1.2 实样对照）、官方方言逐字保留、摘要/幂等/目录形状/权限/realpath 三重等式与全部配方形状失败分支
 * [POS]: 配方纵深「合成」段门禁 —— 断言的是**字节**而不是"看起来对"，并把「与 spike 实样逐字一致」写成可回归的对照
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, readFile, readdir, realpath, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  extractPresetMounts,
  normalizePresetId,
  presetBundlePackageName,
  presetBundleSet,
  presetRowId,
  renderPresetBundle,
  synthesizePresetBundle,
  type PresetRecipe,
} from '../src/preset/index.js'
import { FULL_RECIPE_YML, SPIKE_RECIPE_YML, cleanupPresetHomes, makePresetHome, makeRecipe } from './preset-support.js'

/** spike `docs/notes/preset-bundle-spike.md` §1.2 的 patch 正文（逐字抄录，仅去掉它自己的注释行）。 */
const SPIKE_PATCH_BODY = `- insert:
    - id: preset-ent-spike
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: ent-spike
        name: Ent Spike
        description: 企业配方 spike 验证用最小预设（persona 一处）。
        order: 50
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: You are a helpful software engineer assistant.
              complete: true
              includeRuntimeContext: false
`

const SPIKE_PACKAGE_JSON = `{
  "name": "dsh-ent-preset-ent-spike",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "企业配方 spike 验证用最小预设（persona 一处）。",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
`

function spikeRecipe(): PresetRecipe {
  return makeRecipe({
    id: 'ent-spike',
    name: 'Ent Spike',
    description: '企业配方 spike 验证用最小预设（persona 一处）。',
    order: 50,
  }, SPIKE_RECIPE_YML)
}

afterEach(cleanupPresetHomes)

describe('preset bundle synthesis', () => {
  it('renders exactly the two files byte-for-byte, matching the spike sample', () => {
    const rendered = renderPresetBundle(spikeRecipe())
    expect(rendered.declarationId).toBe('ent-spike')
    expect(rendered.rowId).toBe('preset-ent-spike')
    expect(rendered.packageName).toBe('dsh-ent-preset-ent-spike')
    expect(rendered.version).toBe('1.0.0')
    expect(rendered.packageJson).toBe(SPIKE_PACKAGE_JSON)
    // 头两行是我们生成的可追溯注释；其后正文必须与 spike §1.2 逐字一致。
    const body = rendered.cordisPatch.slice(rendered.cordisPatch.indexOf('- insert:'))
    expect(body).toBe(SPIKE_PATCH_BODY)
    expect(rendered.digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keeps every official dialect byte (!!js, cordis:group + isolate, nested config)', () => {
    const rendered = renderPresetBundle(makeRecipe({ id: 'ent-full', name: '企业全量方言', order: 70 }, FULL_RECIPE_YML))
    expect(rendered.cordisPatch).toContain("            disabled: !!js process.platform === 'win32'")
    expect(rendered.cordisPatch).toContain(`          - id: planning
            name: cordis:group
            group: true
            isolate:
              planMode: true
            config:
              - id: plan-mode
                name: '@deepseek-ai/dsh-plan-mode'`)
    expect(extractPresetMounts(FULL_RECIPE_YML).map(mount => mount.name)).toEqual([
      '@deepseek-ai/dsh-persona',
      '@deepseek-ai/dsh-agent-instructions',
      '@deepseek-ai/dsh-tool-bash',
      '@deepseek-ai/dsh-plan-mode',
    ])
  })

  it('omits optional fields instead of inventing them', () => {
    const rendered = renderPresetBundle({
      manifest: { id: 'ent-min', name: 'Minimal' },
      agentCordisYml: SPIKE_RECIPE_YML,
    })
    expect(rendered.cordisPatch).not.toContain('description:')
    expect(rendered.cordisPatch).not.toContain('order:')
    expect(rendered.packageJson).toContain('"description": "Minimal"')
    expect(rendered.packageJson).toContain('"version": "1.0.0"')
  })

  it('quotes display text only when YAML could misread it', () => {
    const rendered = renderPresetBundle(makeRecipe({ id: 'ent-quote', name: '报销: 专员', description: 'first\nsecond' }))
    expect(rendered.cordisPatch).toContain('name: "报销: 专员"')
    expect(rendered.cordisPatch).toContain('description: "first\\nsecond"')
  })

  it('rejects every recipe shape it cannot map faithfully', () => {
    expect(() => normalizePresetId('---')).toThrowError(/preset id/)
    expect(normalizePresetId('ENT Demo')).toBe('ent-demo')
    expect(() => normalizePresetId('x'.repeat(65))).toThrowError(/preset id/)
    for (const factoryId of ['standard', 'ptc', 'minimal', 'cordis']) {
      expect(() => normalizePresetId(factoryId)).toThrowError(/shipped preset id/)
    }
    expect(() => renderPresetBundle(makeRecipe({}, ''))).toThrowError(/agent.cordis.yml is empty/)
    expect(() => renderPresetBundle(makeRecipe({}, 'plugins:\n  - id: persona\n'))).toThrowError(/root-level Cordis entry list/)
    expect(() => renderPresetBundle(makeRecipe({ name: '' }))).toThrowError(/recipe name/)
    expect(() => renderPresetBundle(makeRecipe({ name: 'x'.repeat(121) }))).toThrowError(/recipe name/)
    expect(() => renderPresetBundle(makeRecipe({ order: 1.5 }))).toThrowError(/recipe order/)
    expect(() => renderPresetBundle(makeRecipe({ version: 'v1' }))).toThrowError(/recipe version/)
  })

  it('exposes the bundle set as our bundle plus the recipe mounts', () => {
    const rendered = renderPresetBundle(makeRecipe({ id: 'ent-set', name: 'Set', description: 'set desc' }, FULL_RECIPE_YML))
    const items = presetBundleSet({
      packageName: presetBundlePackageName(rendered.declarationId),
      digest: rendered.digest,
      mounts: rendered.mounts,
      manifest: { id: rendered.declarationId, name: rendered.displayName, description: 'set desc' },
    })
    expect(items.filter(item => item.kind === 'bundle')).toEqual([
      { kind: 'bundle', name: 'dsh-ent-preset-ent-set', summary: 'set desc', digest: rendered.digest },
    ])
    expect(items.filter(item => item.kind === 'mount').map(item => item.name)).toEqual([
      '@deepseek-ai/dsh-agent-instructions',
      '@deepseek-ai/dsh-persona',
      '@deepseek-ai/dsh-plan-mode',
      '@deepseek-ai/dsh-tool-bash',
    ])
  })

  it('writes exactly two files under a digest directory with private modes and is idempotent', async () => {
    const dshHome = await makePresetHome()
    const first = await synthesizePresetBundle({ dshHome }, spikeRecipe())
    // Android 上 `/data/user/0` ↔ `/data/data` 是同一条路径的两种写法，落盘返回值是 realpath 规范形。
    expect(first.bundleDir).toBe(await realpath(join(dshHome, 'enterprise', 'preset-bundles', 'ent-spike', first.digest)))
    expect(first.fileNames).toEqual(['cordis.patch.yml', 'package.json'])
    expect((await readdir(first.bundleDir)).sort()).toEqual(['cordis.patch.yml', 'package.json'])
    expect((await readFile(join(first.bundleDir, 'package.json'), 'utf8'))).toBe(SPIKE_PACKAGE_JSON)
    expect((await stat(join(first.bundleDir, 'package.json'))).mode & 0o777).toBe(0o600)
    expect((await stat(join(first.bundleDir, 'cordis.patch.yml'))).mode & 0o777).toBe(0o600)
    expect((await stat(first.bundleDir)).mode & 0o777).toBe(0o700)
    expect((await readdir(join(dshHome, 'enterprise', 'preset-bundles', 'ent-spike'))).some(name => name.startsWith('.staging-'))).toBe(false)

    const before = (await stat(join(first.bundleDir, 'package.json'))).ino
    const second = await synthesizePresetBundle({ dshHome }, spikeRecipe())
    expect(second.bundleDir).toBe(first.bundleDir)
    expect((await stat(join(second.bundleDir, 'package.json'))).ino).toBe(before)
  })

  it('gives a different directory when only the version changes', async () => {
    const dshHome = await makePresetHome()
    const first = await synthesizePresetBundle({ dshHome }, spikeRecipe())
    const bumped = spikeRecipe()
    const second = await synthesizePresetBundle({ dshHome }, {
      manifest: { ...bumped.manifest, version: '2.0.0' },
      agentCordisYml: bumped.agentCordisYml,
    })
    expect(second.digest).not.toBe(first.digest)
    expect(second.bundleDir).not.toBe(first.bundleDir)
    expect(second.packageJson).toContain('"version": "2.0.0"')
  })

  it('refuses a digest directory holding different bytes', async () => {
    const dshHome = await makePresetHome()
    const first = await synthesizePresetBundle({ dshHome }, spikeRecipe())
    await writeFile(join(first.bundleDir, 'package.json'), '{}\n', { mode: 0o600 })
    await expect(synthesizePresetBundle({ dshHome }, spikeRecipe()))
      .rejects.toMatchObject({ code: 'ENT_PRESET_BUNDLE_WRITE_FAILED' })
  })

  it('refuses a bundle root that escapes the harness home through a symlink', async () => {
    const dshHome = await makePresetHome()
    const elsewhere = join(dshHome, 'elsewhere')
    await mkdir(join(dshHome, 'enterprise'), { recursive: true, mode: 0o700 })
    await mkdir(elsewhere, { recursive: true, mode: 0o700 })
    await symlink(elsewhere, join(dshHome, 'enterprise', 'preset-bundles'))
    await expect(synthesizePresetBundle({ dshHome }, spikeRecipe()))
      .rejects.toMatchObject({ code: 'ENT_PRESET_BUNDLE_WRITE_FAILED' })
  })

  it('keeps the row id convention preset-<id> in one place', () => {
    expect(presetRowId(presetRowId('x'))).toBe('preset-preset-x')
    expect(presetRowId('ent-demo')).toBe('preset-ent-demo')
  })
})
