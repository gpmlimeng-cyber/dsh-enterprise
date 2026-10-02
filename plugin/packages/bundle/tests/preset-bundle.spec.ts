/**
 * [INPUT]: 依赖 node:fs/promises/node:path、vitest，以及 src/preset 的合成段与 tests/preset-support 夹具
 * [OUTPUT]: 锁定最小 bundle 的两个文件**逐字节**形状（含 spike §1.2 实样对照）、官方方言逐字保留、**两种真实形状**（根 entry list + 根 mapping）的接受与逐字段映射（manifest > preset.yml > mapping 的优先级、id 必须一致、skills 绝不进产物）、摘要/幂等/目录形状/权限/realpath 三重等式与全部配方形状失败分支
 * [POS]: 配方纵深「合成」段门禁 —— 断言的是**字节**而不是"看起来对"，并把「与 spike 实样逐字一致」与「真机制品的根 mapping 也被接受」都写成可回归的对照
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
import { FULL_RECIPE_YML, ROOT_MAPPING_YML, SPIKE_RECIPE_YML, cleanupPresetHomes, makePresetHome, makeRecipe } from './preset-support.js'

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
    expect(() => renderPresetBundle(makeRecipe({ name: '' }))).toThrowError(/recipe name/)
    expect(() => renderPresetBundle(makeRecipe({ name: 'x'.repeat(121) }))).toThrowError(/recipe name/)
    expect(() => renderPresetBundle(makeRecipe({ order: 1.5 }))).toThrowError(/recipe order/)
    expect(() => renderPresetBundle(makeRecipe({ version: 'v1' }))).toThrowError(/recipe version/)
    // 曾经的 fail-closed（"根 mapping 一律拒"）已按真机制品形状放开：`plugins:` 根 mapping 是**合法**输入，
    // 逐字段映射见下面「根 mapping 形状」两个用例；这里只剩"两种形状都不成立"的真·非法输入。
    for (const body of ['42\n', '"just a scalar"\n', '{name: flow}\n', '  缩进开始的\n']) {
      expect(() => renderPresetBundle(makeRecipe({}, body)), JSON.stringify(body))
        .toThrowError(/agent.cordis.yml must be a root-level Cordis entry list or a root mapping/)
    }
  })

  it('accepts the root mapping shape (the real enterprise artifact) and keeps every row byte', () => {
    const rendered = renderPresetBundle({
      manifest: { id: 'ent-map', name: '根 mapping 显示名' },
      agentCordisYml: ROOT_MAPPING_YML,
    })
    expect(rendered.agentShape).toBe('mapping')
    expect(rendered.declarationId).toBe('ent-map')
    expect(rendered.displayName).toBe('根 mapping 显示名')
    // manifest 没写 description/order ⇒ 依次落到根 mapping（`preset.yml` 缺席）；行整段按相对缩进搬入。
    const body = rendered.cordisPatch.slice(rendered.cordisPatch.indexOf('- insert:'))
    expect(body).toBe(`- insert:
    - id: preset-ent-map
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: ent-map
        name: 根 mapping 显示名
        description: 根 mapping 的说明
        order: 70
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: from mapping
          - id: planning
            name: cordis:group
            group: true
            isolate:
              planMode: true
            config:
              - id: plan-mode
                name: '@deepseek-ai/dsh-plan-mode'
`)
    expect(rendered.mounts.map(mount => mount.name))
      .toEqual(['@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-plan-mode'])
    // K2：`skills` 只登记、绝不进产物（官方面也没有这个字段）。
    expect(rendered.declaredSkills).toEqual(['weekly-report', 'release-notes'])
    expect(rendered.cordisPatch).not.toContain('skills')
    expect(rendered.bundleSet.map(item => item.kind)).toEqual(['bundle', 'mount', 'mount'])
  })

  it('lets manifest.json win over the mapping for name/description/order (the framing decision)', () => {
    const rendered = renderPresetBundle({
      manifest: { id: 'ent-map', name: 'manifest 名', description: 'manifest 说明', order: 60 },
      agentCordisYml: ROOT_MAPPING_YML,
    })
    // 员工看到的是中心发布的那份门面；mapping 里的同名字段只是组合内标签，不许顶掉它。
    expect(rendered.displayName).toBe('manifest 名')
    expect(rendered.cordisPatch).toContain('        name: manifest 名')
    expect(rendered.cordisPatch).toContain('        description: manifest 说明')
    expect(rendered.cordisPatch).toContain('        order: 60')
    expect(rendered.cordisPatch).not.toContain('根 mapping 显示名')
    expect(rendered.cordisPatch).not.toContain('根 mapping 的说明')
  })

  it('lets preset.yml fill what manifest omits, but never override it, and never fight over the id', () => {
    const recipe = {
      manifest: { id: 'ent-spike', name: 'manifest 名' },
      agentCordisYml: SPIKE_RECIPE_YML,
      localMetadata: { name: 'preset.yml 名', description: 'preset.yml 说明', order: 80 },
    }
    const rendered = renderPresetBundle(recipe)
    expect(rendered.displayName).toBe('manifest 名')
    expect(rendered.cordisPatch).toContain('        description: preset.yml 说明')
    expect(rendered.cordisPatch).toContain('        order: 80')

    // 同一份制品里两个身份 ⇒ fail-closed；归一化后相同则不拒。
    expect(() => renderPresetBundle({ ...recipe, localMetadata: { id: 'other' } }))
      .toThrowError(/declares a preset id that differs/)
    expect(() => renderPresetBundle({ manifest: { id: 'ent-demo', name: 'x' }, agentCordisYml: 'id: other\n' }))
      .toThrowError(/declares a preset id that differs/)
    expect(renderPresetBundle({ manifest: { id: 'ent-demo', name: 'x' }, agentCordisYml: 'id: Ent-Demo\n' }).declarationId)
      .toBe('ent-demo')

    // preset.yml > 根 mapping：`order` 两边都写了就取官方那个显示元数据文件的值。
    const both = renderPresetBundle({
      manifest: { id: 'ent-map', name: '名' },
      agentCordisYml: ROOT_MAPPING_YML,
      localMetadata: { order: 80 },
    })
    expect(both.cordisPatch).toContain('        order: 80')
    expect(both.cordisPatch).not.toContain('        order: 70')
  })

  it('fills a missing display name from the mapping and never invents a description', () => {
    // manifest 没写名（容器层不该发生，但纯函数必须行为确定）⇒ 依次落到 preset.yml / 根 mapping。
    expect(renderPresetBundle({ manifest: { id: 'ent-map' }, agentCordisYml: ROOT_MAPPING_YML }).displayName)
      .toBe('根 mapping 显示名')
    // 三处都没写 description ⇒ 不写这一行（官方显示「暂无描述。」），绝不拿别名去凑。
    expect(renderPresetBundle({ manifest: { id: 'ent-min', name: 'Minimal' }, agentCordisYml: 'name: machine-label\n' })
      .cordisPatch).not.toContain('description:')
  })

  it('emits `plugins: []` when a mapping declares no rows, and reads block scalars past a topology comment', () => {
    expect(renderPresetBundle(makeRecipe({}, 'plugins:\n  - id: persona\n')).cordisPatch)
      .toContain('          - id: persona')
    for (const body of ['name: 无行\n', 'plugins: []\n']) {
      const rendered = renderPresetBundle({ manifest: { id: 'ent-empty', name: '空配方' }, agentCordisYml: body })
      // 空 row 列表必须是 `[]`：官方 schema 要求 `plugins` 是数组，留空即 `null`（会被官方拒）。
      expect(rendered.cordisPatch, JSON.stringify(body)).toContain('        plugins: []')
      expect(rendered.mounts, JSON.stringify(body)).toEqual([])
    }

    // 块标量 + 块后的**顶格注释**（合法 YAML；公共缩进只该在有内容的行上算，否则合法配方会被误拒）。
    const rendered = renderPresetBundle({
      manifest: { id: 'ent-block', name: '块标量' },
      agentCordisYml: '# 顶部注释\nname: block\nplugins:\n  - id: persona\n    name: \'@deepseek-ai/dsh-persona\'\n# 块后的顶格注释\ndescription: |\n  第一行\n  第二行\n',
    })
    expect(rendered.mounts.map(mount => mount.name)).toEqual(['@deepseek-ai/dsh-persona'])
    expect(rendered.cordisPatch).toContain('        description: "第一行\\n第二行"')
    // `>` 折行块标量同一条路（折成空格）。
    expect(renderPresetBundle({
      manifest: { id: 'ent-fold', name: '折行' },
      agentCordisYml: 'description: >\n  第一段\n  第二段\n',
    }).cordisPatch).toContain('        description: 第一段 第二段')
  })

  it('rejects a root mapping it cannot map faithfully (unknown key, duplicate key, non-sequence, bad order)', () => {
    const cases: readonly (readonly [string, RegExp])[] = [
      ['model: gpt-4\n', /root mapping key "model" is not one this synthesizer can map/],
      ['name: a\nname: b\n', /repeats the root mapping key "name"/],
      ['name: a\n- id: persona\n', /mixes a root mapping with a root list/],
      ['plugins:\n  id: persona\n', /plugins must be a block sequence of Cordis rows/],
      ['plugins: 3\n', /plugins must be a block sequence of Cordis rows/],
      ['order: 1.5\n', /order must be a plain decimal integer/],
      ['order: -1\n', /order must be a plain decimal integer/],
      ['name:\n  缩进但没有块标量\n', /name must be a plain or block scalar/],
      ['name: [flow]\n', /name uses a YAML form this synthesizer cannot map/],
      ['name: !!js x\n', /name uses a YAML form this synthesizer cannot map/],
    ]
    for (const [body, pattern] of cases) {
      expect(() => renderPresetBundle({ manifest: { id: 'ent-bad', name: 'x' }, agentCordisYml: body }), body)
        .toThrowError(pattern)
    }
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
